import { test } from '@fast-check/vitest';
import fc from 'fast-check';
import { afterEach, beforeEach, describe, expect } from 'vitest';
import { createEventBus } from '../../src/event-bus';
import { createTimelineComponent } from '../../src/renderer/timeline-component';
import type { SongCollection, SongEntry } from '../../src/types';

// Feature: birthday-playlist, Property 14: Album Cover Size Invariants

/**
 * Validates: Requirements 5.3, 5.5
 *
 * For any rendered album cover in the timeline, width SHALL equal height (1:1 aspect ratio),
 * and when the viewport is 768px or greater, dimensions SHALL be between 150px and 300px inclusive.
 */

/** Arbitrary for generating a SongEntry */
const songEntryArb: fc.Arbitrary<SongEntry> = fc.record({
  id: fc.uuid(),
  year: fc.option(fc.integer({ min: 1981, max: 2024 }), { nil: null }),
  releaseDate: fc.option(
    fc.integer({ min: 1981, max: 2024 }).chain((year) =>
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

/** Arbitrary for generating a SongCollection with 1-20 entries */
const songCollectionArb: fc.Arbitrary<SongCollection> = fc
  .array(songEntryArb, { minLength: 1, maxLength: 20 })
  .map((entries) => {
    const years = entries
      .map((e) => e.year)
      .filter((y): y is number => y !== null);
    const startYear = years.length > 0 ? Math.min(...years) : 1981;
    const endYear = years.length > 0 ? Math.max(...years) : 2024;
    return { entries, startYear, endYear };
  });

describe('Property 14: Album Cover Size Invariants', () => {
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
    'all album covers have 1:1 aspect ratio with dimensions between 150px and 300px',
    (collection) => {
      const bus = createEventBus();
      const timeline = createTimelineComponent(bus);

      timeline.mount(container);
      timeline.update(collection);

      // Query all <img> cover elements
      const imgCovers = container.querySelectorAll<HTMLImageElement>('.timeline__cover');

      // Query all placeholder <div> elements
      const placeholders = container.querySelectorAll<HTMLElement>('.timeline__cover-placeholder');

      // Verify img elements: width attribute equals height attribute (1:1 ratio)
      imgCovers.forEach((img) => {
        const width = img.width;
        const height = img.height;

        // Width must equal height (1:1 aspect ratio)
        expect(width).toBe(height);

        // Dimensions must be between 150px and 300px inclusive (DEFAULT_COVER_SIZE = 180)
        expect(width).toBeGreaterThanOrEqual(150);
        expect(width).toBeLessThanOrEqual(300);
      });

      // Verify placeholder elements: inline style width equals height (1:1 ratio)
      placeholders.forEach((placeholder) => {
        const width = placeholder.style.width;
        const height = placeholder.style.height;

        // Width must equal height (1:1 aspect ratio)
        expect(width).toBe(height);

        // Parse numeric values and verify range
        const widthPx = parseInt(width, 10);
        const heightPx = parseInt(height, 10);

        expect(widthPx).toBe(heightPx);
        expect(widthPx).toBeGreaterThanOrEqual(150);
        expect(widthPx).toBeLessThanOrEqual(300);
      });

      // Ensure we actually tested something (every entry produces either a cover or placeholder)
      expect(imgCovers.length + placeholders.length).toBe(collection.entries.length);

      timeline.destroy();
    }
  );
});
