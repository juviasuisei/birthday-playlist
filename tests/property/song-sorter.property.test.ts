import { test } from '@fast-check/vitest';
import fc from 'fast-check';
import { describe, expect } from 'vitest';
import { sortSongs } from '../../src/engine/song-sorter';
import type { SongEntry } from '../../src/types';

// Feature: birthday-playlist, Property 3: Sort Order Invariant

/**
 * Validates: Requirements 1.4
 *
 * For any array of SongEntry records with arbitrary release dates (including null values),
 * after sorting: (a) all entries with non-null dates SHALL appear before entries with null dates,
 * and (b) entries with non-null dates SHALL be in ascending chronological order.
 */

/** Arbitrary for generating a SongEntry with an optional releaseDate */
const songEntryArb: fc.Arbitrary<SongEntry> = fc.record({
  id: fc.uuid(),
  year: fc.option(fc.integer({ min: 1900, max: 2100 }), { nil: null }),
  releaseDate: fc.option(
    fc.integer({ min: 1900, max: 2100 }).chain((year) =>
      fc.integer({ min: 1, max: 12 }).chain((month) =>
        fc.integer({ min: 1, max: 28 }).map((day) =>
          `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        )
      )
    ),
    { nil: null }
  ),
  song: fc.string({ minLength: 1, maxLength: 50 }),
  artist: fc.string({ minLength: 1, maxLength: 50 }),
  album: fc.string({ minLength: 1, maxLength: 50 }),
  artistPhotoUrl: fc.option(fc.webUrl(), { nil: null }),
  appleMusicUrl: fc.option(fc.webUrl(), { nil: null }),
  spotifyUrl: fc.option(fc.webUrl(), { nil: null }),
  albumCoverUrl: fc.option(fc.webUrl(), { nil: null }),
  musicVideoUrl: fc.option(fc.webUrl(), { nil: null }),
  thoughts: fc.option(fc.string({ maxLength: 200 }), { nil: null }),
});

describe('Property 3: Sort Order Invariant', () => {
  test.prop(
    [fc.array(songEntryArb, { minLength: 0, maxLength: 50 })],
    { numRuns: 100 },
  )(
    'non-null dated entries appear before null-dated entries, in ascending chronological order',
    (entries) => {
      const sorted = sortSongs(entries);

      // Output has the same length as input (no entries lost)
      expect(sorted).toHaveLength(entries.length);

      // Find the boundary between non-null and null dated entries
      const firstNullIndex = sorted.findIndex((e) => e.releaseDate === null);

      if (firstNullIndex === -1) {
        // All entries have non-null dates — check ascending order
        for (let i = 1; i < sorted.length; i++) {
          expect(sorted[i]!.releaseDate! >= sorted[i - 1]!.releaseDate!).toBe(true);
        }
      } else {
        // (a) All entries after firstNullIndex must also be null
        for (let i = firstNullIndex; i < sorted.length; i++) {
          expect(sorted[i]!.releaseDate).toBeNull();
        }

        // (a) All entries before firstNullIndex must be non-null
        for (let i = 0; i < firstNullIndex; i++) {
          expect(sorted[i]!.releaseDate).not.toBeNull();
        }

        // (b) Non-null dated entries are in ascending chronological order
        for (let i = 1; i < firstNullIndex; i++) {
          expect(sorted[i]!.releaseDate! >= sorted[i - 1]!.releaseDate!).toBe(true);
        }
      }
    }
  );
});
