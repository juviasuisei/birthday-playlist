import { test } from '@fast-check/vitest';
import fc from 'fast-check';
import { describe, expect, beforeEach, afterEach } from 'vitest';
import { createTimelineComponent } from '../../src/renderer/timeline-component';
import { createEventBus } from '../../src/event-bus';
import type { SongCollection, SongEntry } from '../../src/types';

// Feature: birthday-playlist, Property 13: Tab Order Matches Chronological Order

/**
 * Validates: Requirements 10.1
 *
 * For any rendered timeline, the keyboard tab order of album cover elements
 * SHALL match the chronological sort order of the SongCollection entries.
 */

/** Arbitrary for generating a SongEntry */
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

/** Arbitrary for generating a SongCollection with 1-20 entries */
const songCollectionArb: fc.Arbitrary<SongCollection> = fc
  .array(songEntryArb, { minLength: 1, maxLength: 20 })
  .map((entries) => {
    const years = entries.map((e) => e.year).filter((y): y is number => y !== null);
    return {
      entries,
      startYear: years.length > 0 ? Math.min(...years) : 1981,
      endYear: years.length > 0 ? Math.max(...years) : 2024,
    };
  });

describe('Property 13: Tab Order Matches Chronological Order', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  test.prop(
    [songCollectionArb],
    { numRuns: 100 },
  )(
    'DOM order of timeline entries matches chronological order with tabindex="0"',
    (collection) => {
      const bus = createEventBus();
      const timeline = createTimelineComponent(bus);

      timeline.mount(container);
      timeline.update(collection);

      const entryElements = container.querySelectorAll('.timeline__entry');

      // Verify we have the correct number of entries
      expect(entryElements.length).toBe(collection.entries.length);

      // Verify each entry has tabindex="0" and data-index matching its position
      entryElements.forEach((el, i) => {
        // 1. All .timeline__entry elements have tabindex="0"
        expect(el.getAttribute('tabindex')).toBe('0');

        // 2. DOM order matches chronological order (data-index = position index)
        expect(el.getAttribute('data-index')).toBe(String(i));
      });

      timeline.destroy();
    }
  );
});
