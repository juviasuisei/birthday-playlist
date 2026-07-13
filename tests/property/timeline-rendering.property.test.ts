import { test } from '@fast-check/vitest';
import fc from 'fast-check';
import { describe, expect, beforeEach, afterEach } from 'vitest';
import { createTimelineComponent } from '../../src/renderer/timeline-component';
import { createEventBus } from '../../src/event-bus';
import type { SongCollection, SongEntry } from '../../src/types';
import type { EventBus } from '../../src/event-bus';

// Feature: birthday-playlist, Property 4: Timeline Rendering Completeness

/**
 * Validates: Requirements 2.1, 2.2
 *
 * For any SongCollection, the TimelineComponent SHALL render exactly
 * `collection.entries.length` album cover elements, each paired with a year label
 * matching its entry's year, in the same order as the sorted collection.
 */

/** Arbitrary for generating a SongEntry with a non-null year */
const songEntryArb: fc.Arbitrary<SongEntry> = fc.record({
  id: fc.uuid(),
  year: fc.integer({ min: 1981, max: 2024 }),
  releaseDate: fc.integer({ min: 1981, max: 2024 }).chain((year) =>
    fc.integer({ min: 1, max: 12 }).chain((month) =>
      fc.integer({ min: 1, max: 28 }).map((day) =>
        `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      )
    )
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

/** Arbitrary for generating a SongCollection with 1-50 entries */
const songCollectionArb: fc.Arbitrary<SongCollection> = fc
  .array(songEntryArb, { minLength: 1, maxLength: 50 })
  .map((entries) => {
    const years = entries.map((e) => e.year).filter((y): y is number => y !== null);
    const startYear = years.length > 0 ? Math.min(...years) : 1981;
    const endYear = years.length > 0 ? Math.max(...years) : 2024;
    return { entries, startYear, endYear };
  });

describe('Property 4: Timeline Rendering Completeness', () => {
  let container: HTMLElement;
  let bus: EventBus;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    bus = createEventBus();
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  test.prop(
    [songCollectionArb],
    { numRuns: 100 },
  )(
    'renders exactly collection.entries.length entries with correct year labels in order',
    (collection) => {
      const timeline = createTimelineComponent(bus);
      timeline.mount(container);
      timeline.update(collection);

      const entryElements = container.querySelectorAll('.timeline__entry');

      // 1. Number of .timeline__entry elements equals collection.entries.length
      expect(entryElements.length).toBe(collection.entries.length);

      // 2. Each entry's year label matches the corresponding entry's year
      entryElements.forEach((entryEl, i) => {
        const yearEl = entryEl.querySelector('.timeline__year');
        expect(yearEl).not.toBeNull();
        const expectedYear = collection.entries[i]!.year != null
          ? String(collection.entries[i]!.year)
          : '';
        expect(yearEl!.textContent).toBe(expectedYear);
      });

      // 3. Entries are in the same order (data-index matches position)
      entryElements.forEach((entryEl, i) => {
        expect(entryEl.getAttribute('data-index')).toBe(String(i));
      });

      timeline.destroy();
    }
  );
});
