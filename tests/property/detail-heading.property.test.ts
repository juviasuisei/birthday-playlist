import { test } from '@fast-check/vitest';
import fc from 'fast-check';
import { describe, expect, beforeEach, afterEach } from 'vitest';
import { createDetailComponent } from '../../src/renderer/detail-component';
import { createEventBus } from '../../src/event-bus';
import { createMarkdownParser } from '../../src/engine/markdown-parser';
import type { SongCollection, SongEntry } from '../../src/types';
import type { EventBus } from '../../src/event-bus';

// Feature: birthday-playlist, Property 5: Detail Heading Format

/**
 * Validates: Requirements 3.3, 3.4
 *
 * For any SongEntry with a year, song title, and artist, the detail heading SHALL
 * be formatted as "{year} • {song} • {artist}" and the secondary line SHALL contain
 * the album name and release date.
 */

/** Arbitrary for generating a SongEntry with a non-null year */
const songEntryArb: fc.Arbitrary<SongEntry> = fc.record({
  id: fc.uuid(),
  year: fc.integer({ min: 1981, max: 2024 }),
  releaseDate: fc.oneof(
    fc.integer({ min: 1981, max: 2024 }).chain((year) =>
      fc.integer({ min: 1, max: 12 }).chain((month) =>
        fc.integer({ min: 1, max: 28 }).map((day) =>
          `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        )
      )
    ),
    fc.constant(null as string | null)
  ),
  song: fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
  artist: fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
  album: fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
  artistPhotoUrl: fc.option(fc.webUrl(), { nil: null }),
  appleMusicUrl: fc.option(fc.webUrl(), { nil: null }),
  spotifyUrl: fc.option(fc.webUrl(), { nil: null }),
  albumCoverUrl: fc.option(fc.webUrl(), { nil: null }),
  musicVideoUrl: fc.option(fc.webUrl(), { nil: null }),
  thoughts: fc.option(fc.string({ maxLength: 200 }), { nil: null }),
});

describe('Property 5: Detail Heading Format', () => {
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
    'detail heading matches "{year} • {song} • {artist}" pattern and secondary line contains album and date',
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

      // 1. The .detail-heading text content matches "{year} • {song} • {artist}"
      const headingEl = container.querySelector('.detail-heading');
      expect(headingEl).not.toBeNull();

      const expectedHeading = `${entry.year} \u2022 ${entry.song} \u2022 ${entry.artist}`;
      expect(headingEl!.textContent).toBe(expectedHeading);

      // 2. The .detail-album text content matches the entry's album
      const albumEl = container.querySelector('.detail-album');
      expect(albumEl).not.toBeNull();
      expect(albumEl!.textContent).toBe(entry.album);

      // 3. The .detail-date text content is non-empty when releaseDate is non-null
      const dateEl = container.querySelector('.detail-date');
      expect(dateEl).not.toBeNull();
      if (entry.releaseDate !== null) {
        expect(dateEl!.textContent!.length).toBeGreaterThan(0);
      }

      detail.destroy();
    }
  );
});
