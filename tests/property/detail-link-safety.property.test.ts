import { test } from '@fast-check/vitest';
import fc from 'fast-check';
import { describe, expect, beforeEach, afterEach } from 'vitest';
import { createDetailComponent } from '../../src/renderer/detail-component';
import { createEventBus } from '../../src/event-bus';
import { createMarkdownParser } from '../../src/engine/markdown-parser';
import type { SongCollection, SongEntry } from '../../src/types';
import type { EventBus } from '../../src/event-bus';

// Feature: birthday-playlist, Property 7: External Link Safety

/**
 * Validates: Requirements 6.3, 6.6, 7.4
 *
 * For any rendered streaming link or markdown-originated anchor element, the link
 * SHALL have `target="_blank"` and `rel="noopener noreferrer"`, and each streaming
 * icon SHALL have an accessible name containing the service name.
 */

/** Generate a markdown string that includes one or more links */
const markdownWithLinksArb: fc.Arbitrary<string> = fc
  .tuple(
    fc.string({ minLength: 1, maxLength: 20 }).filter((s) => !s.includes('[') && !s.includes(']') && !s.includes('(') && !s.includes(')')),
    fc.webUrl(),
  )
  .map(([text, url]) => `Check out [${text}](${url}) for more info.`);

/** Arbitrary for generating a SongEntry with optional streaming URLs and markdown thoughts */
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
  song: fc.string({ minLength: 1, maxLength: 30 }),
  artist: fc.string({ minLength: 1, maxLength: 30 }),
  album: fc.string({ minLength: 1, maxLength: 30 }),
  artistPhotoUrl: fc.option(fc.webUrl(), { nil: null }),
  appleMusicUrl: fc.option(fc.webUrl(), { nil: null }),
  spotifyUrl: fc.option(fc.webUrl(), { nil: null }),
  albumCoverUrl: fc.option(fc.webUrl(), { nil: null }),
  musicVideoUrl: fc.option(fc.webUrl(), { nil: null }),
  thoughts: fc.oneof(
    fc.constant(null),
    markdownWithLinksArb,
  ),
});

describe('Property 7: External Link Safety', () => {
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
    'all anchor elements have target="_blank" and rel="noopener noreferrer", and streaming icons have accessible names',
    (entry) => {
      const parser = createMarkdownParser();
      const detail = createDetailComponent(bus, parser);
      detail.mount(container);

      const collection: SongCollection = {
        entries: [entry],
        startYear: entry.year,
        endYear: entry.year,
      };

      detail.open(0, collection);

      const allAnchors = container.querySelectorAll('a');

      // 1. All <a> elements have target="_blank"
      allAnchors.forEach((anchor) => {
        expect(anchor.getAttribute('target')).toBe('_blank');
      });

      // 2. All <a> elements have rel="noopener noreferrer"
      allAnchors.forEach((anchor) => {
        expect(anchor.getAttribute('rel')).toBe('noopener noreferrer');
      });

      // 3. Streaming links have accessible names containing service name
      const streamingLinks = container.querySelectorAll('.detail-links a');
      streamingLinks.forEach((link) => {
        const ariaLabel = link.getAttribute('aria-label') ?? '';
        const hasServiceName =
          ariaLabel.includes('Apple Music') || ariaLabel.includes('Spotify');
        expect(hasServiceName).toBe(true);
      });

      detail.close();
      detail.destroy();
    }
  );
});
