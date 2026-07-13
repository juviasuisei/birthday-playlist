import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDetailComponent } from '../../src/renderer/detail-component';
import { createEventBus } from '../../src/event-bus';
import { createMarkdownParser } from '../../src/engine/markdown-parser';
import type { EventBus } from '../../src/event-bus';
import type { MarkdownParser } from '../../src/engine/markdown-parser';
import type { SongCollection, SongEntry } from '../../src/types';

function makeSongEntry(overrides: Partial<SongEntry> = {}): SongEntry {
  return {
    id: 'entry-1',
    year: 1981,
    releaseDate: '1981-10-07',
    song: 'When It\'s Over',
    artist: 'Loverboy',
    album: 'Get Lucky',
    artistPhotoUrl: 'https://example.com/artist.jpg',
    appleMusicUrl: 'https://music.apple.com/song/123',
    spotifyUrl: 'https://open.spotify.com/track/123',
    albumCoverUrl: 'https://example.com/cover.jpg',
    musicVideoUrl: null,
    thoughts: '## Why this song\n\nThis was a **great** track.',
    ...overrides,
  };
}

function makeCollection(count = 3): SongCollection {
  const entries: SongEntry[] = [];
  for (let i = 0; i < count; i++) {
    entries.push(
      makeSongEntry({
        id: `entry-${i}`,
        year: 1981 + i,
        releaseDate: `${1981 + i}-10-07`,
        song: `Song ${i}`,
        artist: `Artist ${i}`,
        album: `Album ${i}`,
      }),
    );
  }
  return {
    entries,
    startYear: 1981,
    endYear: 1981 + count - 1,
  };
}

describe('DetailComponent', () => {
  let bus: EventBus;
  let parser: MarkdownParser;
  let container: HTMLElement;

  beforeEach(() => {
    bus = createEventBus();
    parser = createMarkdownParser();
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  describe('heading format', () => {
    it('renders heading as "{year} • {song} • {artist}"', () => {
      const dc = createDetailComponent(bus, parser);
      dc.mount(container);

      const collection = makeCollection(1);
      dc.open(0, collection);

      const heading = container.querySelector('.detail-heading');
      expect(heading).not.toBeNull();
      expect(heading!.textContent).toBe('1981 \u2022 Song 0 \u2022 Artist 0');

      dc.destroy();
    });
  });

  describe('secondary line', () => {
    it('renders album name and formatted release date', () => {
      const dc = createDetailComponent(bus, parser);
      dc.mount(container);

      const collection: SongCollection = {
        entries: [makeSongEntry({ album: 'Get Lucky', releaseDate: '1981-10-07' })],
        startYear: 1981,
        endYear: 1981,
      };
      dc.open(0, collection);

      const album = container.querySelector('.detail-album');
      expect(album).not.toBeNull();
      expect(album!.textContent).toBe('Get Lucky');

      const date = container.querySelector('.detail-date');
      expect(date).not.toBeNull();
      expect(date!.textContent).toBe('October 7, 1981');

      dc.destroy();
    });
  });

  describe('streaming links', () => {
    it('shows Apple Music link when URL exists', () => {
      const dc = createDetailComponent(bus, parser);
      dc.mount(container);

      const collection: SongCollection = {
        entries: [makeSongEntry({ appleMusicUrl: 'https://music.apple.com/song/123' })],
        startYear: 1981,
        endYear: 1981,
      };
      dc.open(0, collection);

      const link = container.querySelector('a[aria-label="Listen on Apple Music (opens in new tab)"]');
      expect(link).not.toBeNull();
      expect(link!.getAttribute('href')).toBe('https://music.apple.com/song/123');
      expect(link!.getAttribute('target')).toBe('_blank');
      expect(link!.getAttribute('rel')).toBe('noopener noreferrer');

      dc.destroy();
    });

    it('shows Spotify link when URL exists', () => {
      const dc = createDetailComponent(bus, parser);
      dc.mount(container);

      const collection: SongCollection = {
        entries: [makeSongEntry({ spotifyUrl: 'https://open.spotify.com/track/123' })],
        startYear: 1981,
        endYear: 1981,
      };
      dc.open(0, collection);

      const link = container.querySelector('a[aria-label="Listen on Spotify (opens in new tab)"]');
      expect(link).not.toBeNull();
      expect(link!.getAttribute('href')).toBe('https://open.spotify.com/track/123');
      expect(link!.getAttribute('target')).toBe('_blank');
      expect(link!.getAttribute('rel')).toBe('noopener noreferrer');

      dc.destroy();
    });

    it('hides Apple Music link when URL is null', () => {
      const dc = createDetailComponent(bus, parser);
      dc.mount(container);

      const collection: SongCollection = {
        entries: [makeSongEntry({ appleMusicUrl: null })],
        startYear: 1981,
        endYear: 1981,
      };
      dc.open(0, collection);

      const link = container.querySelector('a[aria-label="Listen on Apple Music (opens in new tab)"]');
      expect(link).toBeNull();

      dc.destroy();
    });

    it('hides Spotify link when URL is null', () => {
      const dc = createDetailComponent(bus, parser);
      dc.mount(container);

      const collection: SongCollection = {
        entries: [makeSongEntry({ spotifyUrl: null })],
        startYear: 1981,
        endYear: 1981,
      };
      dc.open(0, collection);

      const link = container.querySelector('a[aria-label="Listen on Spotify (opens in new tab)"]');
      expect(link).toBeNull();

      dc.destroy();
    });

    it('hides streaming links section when both URLs are null', () => {
      const dc = createDetailComponent(bus, parser);
      dc.mount(container);

      const collection: SongCollection = {
        entries: [makeSongEntry({ appleMusicUrl: null, spotifyUrl: null })],
        startYear: 1981,
        endYear: 1981,
      };
      dc.open(0, collection);

      const links = container.querySelector('.detail-links');
      expect(links).toBeNull();

      dc.destroy();
    });
  });

  describe('artist photo', () => {
    it('renders artist photo with correct height', () => {
      const dc = createDetailComponent(bus, parser);
      dc.mount(container);

      const collection: SongCollection = {
        entries: [makeSongEntry({ artistPhotoUrl: 'https://example.com/artist.jpg' })],
        startYear: 1981,
        endYear: 1981,
      };
      dc.open(0, collection);

      const img = container.querySelector('.detail-artist-photo img') as HTMLImageElement;
      expect(img).not.toBeNull();
      expect(img.style.height).toBe('200px');
      expect(img.style.width).toBe('auto');

      dc.destroy();
    });
  });

  describe('markdown notes', () => {
    it('renders markdown thoughts as HTML', () => {
      const dc = createDetailComponent(bus, parser);
      dc.mount(container);

      const collection: SongCollection = {
        entries: [makeSongEntry({ thoughts: '## Why this song\n\nThis was **great**.' })],
        startYear: 1981,
        endYear: 1981,
      };
      dc.open(0, collection);

      const notes = container.querySelector('.detail-notes');
      expect(notes).not.toBeNull();
      expect(notes!.innerHTML).toContain('<h2>');
      expect(notes!.innerHTML).toContain('<strong>great</strong>');

      dc.destroy();
    });

    it('does not render notes section when thoughts is null', () => {
      const dc = createDetailComponent(bus, parser);
      dc.mount(container);

      const collection: SongCollection = {
        entries: [makeSongEntry({ thoughts: null })],
        startYear: 1981,
        endYear: 1981,
      };
      dc.open(0, collection);

      const notes = container.querySelector('.detail-notes');
      expect(notes).toBeNull();

      dc.destroy();
    });

    it('does not render notes section when thoughts is empty', () => {
      const dc = createDetailComponent(bus, parser);
      dc.mount(container);

      const collection: SongCollection = {
        entries: [makeSongEntry({ thoughts: '   ' })],
        startYear: 1981,
        endYear: 1981,
      };
      dc.open(0, collection);

      const notes = container.querySelector('.detail-notes');
      expect(notes).toBeNull();

      dc.destroy();
    });
  });

  describe('keyboard interactions', () => {
    it('closes on Escape key', () => {
      const dc = createDetailComponent(bus, parser);
      dc.mount(container);
      dc.open(0, makeCollection(3));

      expect(container.querySelector('.detail-overlay')).not.toBeNull();

      const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
      document.dispatchEvent(event);

      expect(container.querySelector('.detail-overlay')).toBeNull();

      dc.destroy();
    });

    it('navigates next on ArrowRight key', () => {
      const dc = createDetailComponent(bus, parser);
      dc.mount(container);
      dc.open(0, makeCollection(3));

      let navNextEmitted = false;
      bus.on('nav:next', () => { navNextEmitted = true; });

      const event = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true });
      document.dispatchEvent(event);

      expect(navNextEmitted).toBe(true);

      dc.destroy();
    });

    it('navigates prev on ArrowLeft key', () => {
      const dc = createDetailComponent(bus, parser);
      dc.mount(container);
      dc.open(1, makeCollection(3));

      let navPrevEmitted = false;
      bus.on('nav:prev', () => { navPrevEmitted = true; });

      const event = new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true });
      document.dispatchEvent(event);

      expect(navPrevEmitted).toBe(true);

      dc.destroy();
    });

    it('does not navigate left at first entry', () => {
      const dc = createDetailComponent(bus, parser);
      dc.mount(container);
      dc.open(0, makeCollection(3));

      let navPrevEmitted = false;
      bus.on('nav:prev', () => { navPrevEmitted = true; });

      const event = new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true });
      document.dispatchEvent(event);

      expect(navPrevEmitted).toBe(false);

      dc.destroy();
    });

    it('does not navigate right at last entry', () => {
      const dc = createDetailComponent(bus, parser);
      dc.mount(container);
      dc.open(2, makeCollection(3));

      let navNextEmitted = false;
      bus.on('nav:next', () => { navNextEmitted = true; });

      const event = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true });
      document.dispatchEvent(event);

      expect(navNextEmitted).toBe(false);

      dc.destroy();
    });
  });

  describe('overlay click', () => {
    it('closes on click outside content area', () => {
      const dc = createDetailComponent(bus, parser);
      dc.mount(container);
      dc.open(0, makeCollection(3));

      const overlay = container.querySelector('.detail-overlay') as HTMLElement;
      expect(overlay).not.toBeNull();

      // Simulate click on the overlay itself (outside content)
      const clickEvent = new MouseEvent('click', { bubbles: true });
      Object.defineProperty(clickEvent, 'target', { value: overlay });
      overlay.dispatchEvent(clickEvent);

      expect(container.querySelector('.detail-overlay')).toBeNull();

      dc.destroy();
    });

    it('does not close on click inside content area', () => {
      const dc = createDetailComponent(bus, parser);
      dc.mount(container);
      dc.open(0, makeCollection(3));

      const content = container.querySelector('.detail-content') as HTMLElement;
      expect(content).not.toBeNull();

      const clickEvent = new MouseEvent('click', { bubbles: true });
      Object.defineProperty(clickEvent, 'target', { value: content });
      content.dispatchEvent(clickEvent);

      expect(container.querySelector('.detail-overlay')).not.toBeNull();

      dc.destroy();
    });
  });

  describe('navigation buttons', () => {
    it('emits nav:next when next button is clicked', () => {
      const dc = createDetailComponent(bus, parser);
      dc.mount(container);
      dc.open(0, makeCollection(3));

      let navNextEmitted = false;
      bus.on('nav:next', () => { navNextEmitted = true; });

      const nextBtn = container.querySelector('.detail-nav-next') as HTMLElement;
      expect(nextBtn).not.toBeNull();
      nextBtn.click();

      expect(navNextEmitted).toBe(true);

      dc.destroy();
    });

    it('emits nav:prev when prev button is clicked', () => {
      const dc = createDetailComponent(bus, parser);
      dc.mount(container);
      dc.open(1, makeCollection(3));

      let navPrevEmitted = false;
      bus.on('nav:prev', () => { navPrevEmitted = true; });

      const prevBtn = container.querySelector('.detail-nav-prev') as HTMLElement;
      expect(prevBtn).not.toBeNull();
      prevBtn.click();

      expect(navPrevEmitted).toBe(true);

      dc.destroy();
    });

    it('hides prev button at first entry', () => {
      const dc = createDetailComponent(bus, parser);
      dc.mount(container);
      dc.open(0, makeCollection(3));

      const prevBtn = container.querySelector('.detail-nav-prev') as HTMLElement;
      expect(prevBtn).not.toBeNull();
      expect(prevBtn.classList.contains('detail-nav--hidden')).toBe(true);

      dc.destroy();
    });

    it('hides next button at last entry', () => {
      const dc = createDetailComponent(bus, parser);
      dc.mount(container);
      dc.open(2, makeCollection(3));

      const nextBtn = container.querySelector('.detail-nav-next') as HTMLElement;
      expect(nextBtn).not.toBeNull();
      expect(nextBtn.classList.contains('detail-nav--hidden')).toBe(true);

      dc.destroy();
    });
  });

  describe('ARIA attributes', () => {
    it('has correct dialog role and aria attributes', () => {
      const dc = createDetailComponent(bus, parser);
      dc.mount(container);
      dc.open(0, makeCollection(1));

      const overlay = container.querySelector('.detail-overlay');
      expect(overlay).not.toBeNull();
      expect(overlay!.getAttribute('role')).toBe('dialog');
      expect(overlay!.getAttribute('aria-modal')).toBe('true');
      expect(overlay!.getAttribute('aria-label')).toBe('Song details');

      dc.destroy();
    });
  });

  describe('focus management', () => {
    it('emits entry:deselect on close', () => {
      const dc = createDetailComponent(bus, parser);
      dc.mount(container);
      dc.open(0, makeCollection(1));

      let deselected = false;
      bus.on('entry:deselect', () => { deselected = true; });

      dc.close();

      expect(deselected).toBe(true);

      dc.destroy();
    });
  });

  describe('destroy', () => {
    it('cleans up the overlay from the DOM', () => {
      const dc = createDetailComponent(bus, parser);
      dc.mount(container);
      dc.open(0, makeCollection(1));

      expect(container.querySelector('.detail-overlay')).not.toBeNull();

      dc.destroy();

      expect(container.querySelector('.detail-overlay')).toBeNull();
    });
  });
});
