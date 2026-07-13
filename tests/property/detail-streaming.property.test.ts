import { test } from '@fast-check/vitest';
import fc from 'fast-check';
import { describe, expect, beforeEach, afterEach } from 'vitest';
import { createDetailComponent } from '../../src/renderer/detail-component';
import { createEventBus } from '../../src/event-bus';
import { createMarkdownParser } from '../../src/engine/markdown-parser';
import type { SongCollection, SongEntry } from '../../src/types';
import type { EventBus } from '../../src/event-bus';

// Feature: birthday-playlist, Property 6: Streaming Icon Conditional Rendering

/**
 * Validates: Requirements 3.5, 3.7, 6.1, 6.2, 6.4, 6.5
 *
 * For any SongEntry, the Apple Music icon SHALL be rendered if and only if
 * the entry has a non-null Apple Music URL, and the Spotify icon SHALL be
 * rendered if and only if the entry has a non-null Spotify URL.
 */

/** Arbitrary for generating a SongEntry with independent streaming URL nullability */
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

describe('Property 6: Streaming Icon Conditional Rendering', () => {
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
    [songEntryArb],
    { numRuns: 100 },
  )(
    'Apple Music and Spotify icons are rendered if and only if their URLs are non-null',
    (entry) => {
      const parser = createMarkdownParser();
      const detail = createDetailComponent(bus, parser);
      detail.mount(container);

      const collection: SongCollection = {
        entries: [entry],
        startYear: entry.year ?? 1981,
        endYear: entry.year ?? 2024,
      };

      detail.open(0, collection);

      const appleMusicLink = container.querySelector('a[aria-label*="Apple Music"]');
      const spotifyLink = container.querySelector('a[aria-label*="Spotify"]');

      // 1. If appleMusicUrl is non-null, a link with aria-label containing "Apple Music" exists
      // 2. If appleMusicUrl is null, no such link exists
      if (entry.appleMusicUrl !== null) {
        expect(appleMusicLink).not.toBeNull();
      } else {
        expect(appleMusicLink).toBeNull();
      }

      // 3. If spotifyUrl is non-null, a link with aria-label containing "Spotify" exists
      // 4. If spotifyUrl is null, no such link exists
      if (entry.spotifyUrl !== null) {
        expect(spotifyLink).not.toBeNull();
      } else {
        expect(spotifyLink).toBeNull();
      }

      detail.destroy();
    }
  );
});
