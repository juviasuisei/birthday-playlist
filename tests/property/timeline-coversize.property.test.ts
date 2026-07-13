import { test } from '@fast-check/vitest';
import fc from 'fast-check';
import { describe, expect, beforeEach, afterEach } from 'vitest';
import { createTimelineComponent } from '../../src/renderer/timeline-component';
import { createEventBus } from '../../src/event-bus';
import type { SongEntry, SongCollection } from '../../src/types';
import type { EventBus } from '../../src/event-bus';

// Feature: birthday-playlist, Property 14: Album Cover Size Invariants

/**
 * Validates: Requirements 5.3, 5.5
 *
 * For any rendered album cover in the timeline, width SHALL equal height (1:1 aspect ratio),
 * and when the viewport is 768px or greater, dimensions SHALL be between 150px and 300px inclusive.
 */

/** Generate a valid ISO date string between 1981 and 2024 */
const releaseDateArb: fc.Arbitrary<string> = fc
  .integer({ min: new Date('1981-01-01').getTime(), max: new Date('2024-12-31').getTime() })
  .map((ts) => new Date(ts).toISOString().split('T')[0]);

/** Arbitrary for generating a SongEntry */
const songEntryArb: fc.Arbitrary<SongEntry> = fc.record({
  id: fc.uuid(),
  year: fc.integer({ min: 1981, max: 2024 }),
  releaseDate: releaseDateArb,
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

/** Arbitrary for generating a SongCollection with 1-10 entries */
const songCollectionArb: fc.Arbitrary<SongCollection> = fc
  .array(songEntryArb, { minLength: 1, maxLength: 10 })
  .map((entries) => {
    const years = entries.map((e) => e.year).filter((y): y is number => y !== null);
    return {
      entries,
      startYear: years.length > 0 ? Math.min(...years) : 1981,
      endYear: years.length > 0 ? Math.max(...years) : 2024,
    };
  });

describe('Property 14: Album Cover Size Invariants', () => {
  let container: HTMLElement;
  let bus: EventBus;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    bus = createEventBus();
    // Simulate viewport >= 768px (jsdom default innerWidth is 1024)
    Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true, configurable: true });
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  test.prop(
    [songCollectionArb],
    { numRuns: 100 },
  )(
    'each album cover has equal width and height (1:1 aspect ratio) and dimensions are between 150 and 300 inclusive',
    (collection) => {
      const timeline = createTimelineComponent(bus);
      timeline.mount(container);
      timeline.update(collection);

      // Query all cover images and placeholders
      const coverImages = container.querySelectorAll<HTMLImageElement>('.timeline__cover');
      const coverPlaceholders = container.querySelectorAll<HTMLElement>('.timeline__cover-placeholder');

      // Verify cover images have equal width and height attributes
      coverImages.forEach((img) => {
        const width = img.width;
        const height = img.height;

        // Width must equal height (1:1 aspect ratio)
        expect(width).toBe(height);

        // Dimensions must be between 150 and 300 inclusive
        expect(width).toBeGreaterThanOrEqual(150);
        expect(width).toBeLessThanOrEqual(300);
      });

      // Verify placeholder elements have equal width and height via inline styles
      coverPlaceholders.forEach((placeholder) => {
        const widthStyle = placeholder.style.width;
        const heightStyle = placeholder.style.height;

        // Both should be defined
        expect(widthStyle).toBeTruthy();
        expect(heightStyle).toBeTruthy();

        // Extract numeric values
        const widthValue = parseInt(widthStyle, 10);
        const heightValue = parseInt(heightStyle, 10);

        // Width must equal height (1:1 aspect ratio)
        expect(widthValue).toBe(heightValue);

        // Dimensions must be between 150 and 300 inclusive
        expect(widthValue).toBeGreaterThanOrEqual(150);
        expect(widthValue).toBeLessThanOrEqual(300);
      });

      // Every entry should have either a cover image or a placeholder
      const totalCovers = coverImages.length + coverPlaceholders.length;
      expect(totalCovers).toBe(collection.entries.length);

      timeline.destroy();
    }
  );
});
