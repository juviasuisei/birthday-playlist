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
  year: fc.option(fc.integer({ min: 1981, max: 2024 }), { nil: null }),
  releaseDate: fc.option(
    fc
      .integer({ min: 0, max: 365 * 44 })
      .map((dayOffset) => {
        const base = new Date('1981-01-01');
        base.setDate(base.getDate() + dayOffset);
        return base.toISOString().split('T')[0]!;
      }),
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

/** Arbitrary for generating a SongCollection with 1-50 entries */
const songCollectionArb: fc.Arbitrary<SongCollection> = fc
  .array(songEntryArb, { minLength: 1, maxLength: 50 })
  .map((entries) => {
    const years = entries
      .map((e) => e.year)
      .filter((y): y is number => y !== null);
    const startYear = years.length > 0 ? Math.min(...years) : 1981;
    const endYear = years.length > 0 ? Math.max(...years) : 2024;
    return { entries, startYear, endYear };
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
    'tab order of timeline entries matches chronological sort order',
    (collection) => {
      const bus = createEventBus();
      const timeline = createTimelineComponent(bus);

      timeline.mount(container);
      timeline.update(collection);

      // Query all elements with tabindex="0" in DOM order
      const tabbableElements = container.querySelectorAll('[tabindex="0"]');

      // There should be exactly as many tabbable elements as entries
      expect(tabbableElements.length).toBe(collection.entries.length);

      // Assert their data-index values are 0, 1, 2, ... in sequence
      // This verifies DOM order = tab order = chronological order
      tabbableElements.forEach((el, i) => {
        const dataIndex = el.getAttribute('data-index');
        expect(dataIndex).toBe(String(i));
      });

      timeline.destroy();
    }
  );
});
