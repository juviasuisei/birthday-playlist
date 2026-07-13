import { test } from '@fast-check/vitest';
import fc from 'fast-check';
import { describe, beforeEach, afterEach, vi, expect } from 'vitest';
import { createDataService } from '../../src/data/data-service';
import { createEventBus } from '../../src/event-bus';
import type { AirtableRecord, AirtableResponse } from '../../src/types';

/**
 * Feature: birthday-playlist, Property 1: Pagination Completeness
 *
 * For any sequence of paginated Airtable responses containing 1–50 pages
 * with varying record counts, the DataService SHALL collect every record
 * from every page and stop fetching when no offset token is present or
 * after 50 pages, whichever comes first.
 *
 * Validates: Requirements 1.2
 */
describe('Property 1: Pagination Completeness', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  /**
   * Arbitrary: generates a sequence of Airtable pages.
   * Each page has 1–100 records. Pages either chain via offset tokens
   * or terminate (last page has no offset).
   */
  const pagesArbitrary = fc
    .integer({ min: 1, max: 50 })
    .chain((numPages) =>
      fc.tuple(
        fc.constant(numPages),
        fc.array(
          fc.integer({ min: 1, max: 100 }),
          { minLength: numPages, maxLength: numPages },
        ),
      ),
    );

  function makeRecord(pageIndex: number, recordIndex: number): AirtableRecord {
    return {
      id: `rec_p${pageIndex}_r${recordIndex}`,
      fields: {
        'Release Date': `${1981 + pageIndex}-01-01`,
        Song: `Song ${pageIndex}-${recordIndex}`,
        Artist: `Artist ${pageIndex}`,
        Album: `Album ${pageIndex}`,
      },
      createdTime: '2024-01-01T00:00:00.000Z',
    };
  }

  function buildPages(
    numPages: number,
    recordCounts: number[],
  ): AirtableResponse[] {
    const pages: AirtableResponse[] = [];
    for (let p = 0; p < numPages; p++) {
      const count = recordCounts[p]!;
      const records: AirtableRecord[] = [];
      for (let r = 0; r < count; r++) {
        records.push(makeRecord(p, r));
      }
      pages.push({
        records,
        // Last page has no offset; earlier pages have an offset token
        ...(p < numPages - 1 ? { offset: `offset_page_${p + 1}` } : {}),
      });
    }
    return pages;
  }

  test.prop([pagesArbitrary], { numRuns: 100 })(
    'collects every record from all pages and stops when no offset or at 50 pages',
    async ([numPages, recordCounts]) => {
      const pages = buildPages(numPages, recordCounts);
      const totalExpectedRecords = recordCounts.reduce((sum, c) => sum + c, 0);

      let fetchCallCount = 0;

      // Mock global fetch to return pages in sequence
      const mockFetch = vi.fn(async (_url: string | URL | Request) => {
        const pageIndex = fetchCallCount;
        fetchCallCount++;

        const page = pages[pageIndex];
        if (!page) {
          // Should not be reached if pagination logic is correct
          return new Response(JSON.stringify({ records: [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        return new Response(JSON.stringify(page), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      });

      vi.stubGlobal('fetch', mockFetch);

      const bus = createEventBus();
      const service = createDataService(
        {
          baseId: 'appTEST',
          tableId: 'tblTEST',
          token: 'pat_test_token',
          maxPages: 50,
          timeoutMs: 30000,
          rateLimit: 1000, // High rate limit to avoid timing issues in tests
        },
        bus,
      );

      // Run fetchAll with fake timers to avoid rate limiter delays
      const resultPromise = service.fetchAll();
      // Advance timers to let rate limiter and any internal delays resolve
      await vi.advanceTimersByTimeAsync(numPages * 2000);
      const result = await resultPromise;

      // Verify all records were collected
      expect(result.entries.length).toBe(totalExpectedRecords);

      // Verify fetch was called exactly numPages times
      expect(fetchCallCount).toBe(numPages);

      // Verify all record IDs are present (every record from every page)
      const collectedIds = new Set(result.entries.map((e) => e.id));
      for (let p = 0; p < numPages; p++) {
        const count = recordCounts[p]!;
        for (let r = 0; r < count; r++) {
          const expectedId = `rec_p${p}_r${r}`;
          expect(collectedIds.has(expectedId)).toBe(true);
        }
      }
    },
  );
});
