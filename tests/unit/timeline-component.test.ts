import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createTimelineComponent } from '../../src/renderer/timeline-component';
import { createEventBus } from '../../src/event-bus';
import type { EventBus } from '../../src/event-bus';
import type { SongCollection, SongEntry } from '../../src/types';

function makeSongEntry(overrides: Partial<SongEntry> = {}): SongEntry {
  return {
    id: 'entry-1',
    year: 1981,
    releaseDate: '1981-06-15',
    song: 'Bette Davis Eyes',
    artist: 'Kim Carnes',
    album: 'Mistaken Identity',
    artistPhotoUrl: null,
    appleMusicUrl: null,
    spotifyUrl: null,
    albumCoverUrl: 'https://example.com/cover.jpg',
    musicVideoUrl: null,
    thoughts: null,
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
        releaseDate: `${1981 + i}-01-01`,
        song: `Song ${i}`,
        artist: `Artist ${i}`,
        album: `Album ${i}`,
        albumCoverUrl: `https://example.com/cover-${i}.jpg`,
      }),
    );
  }
  return {
    entries,
    startYear: 1981,
    endYear: 1981 + count - 1,
  };
}

describe('TimelineComponent', () => {
  let bus: EventBus;
  let container: HTMLElement;

  beforeEach(() => {
    bus = createEventBus();
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  describe('mount', () => {
    it('creates the timeline DOM structure with role="list"', () => {
      const tc = createTimelineComponent(bus);
      tc.mount(container);

      const timeline = container.querySelector('.timeline');
      expect(timeline).not.toBeNull();
      expect(timeline!.getAttribute('role')).toBe('list');

      const entries = container.querySelector('.timeline__entries');
      expect(entries).not.toBeNull();

      tc.destroy();
    });
  });

  describe('update', () => {
    it('renders one entry per song in chronological order', () => {
      const tc = createTimelineComponent(bus);
      tc.mount(container);

      const collection = makeCollection(3);
      tc.update(collection);

      const entryEls = container.querySelectorAll('.timeline__entry');
      expect(entryEls.length).toBe(3);

      entryEls.forEach((el, i) => {
        expect(el.getAttribute('data-index')).toBe(String(i));
      });

      tc.destroy();
    });

    it('renders album cover images with correct alt text', () => {
      const tc = createTimelineComponent(bus);
      tc.mount(container);

      const collection = makeCollection(1);
      tc.update(collection);

      const img = container.querySelector('.timeline__cover') as HTMLImageElement;
      expect(img).not.toBeNull();
      expect(img.src).toBe('https://example.com/cover-0.jpg');
      expect(img.alt).toBe('Album: Song 0 by Artist 0');

      tc.destroy();
    });

    it('renders year labels for each entry', () => {
      const tc = createTimelineComponent(bus);
      tc.mount(container);

      const collection = makeCollection(3);
      tc.update(collection);

      const yearLabels = container.querySelectorAll('.timeline__year');
      expect(yearLabels.length).toBe(3);
      expect(yearLabels[0]!.textContent).toBe('1981');
      expect(yearLabels[1]!.textContent).toBe('1982');
      expect(yearLabels[2]!.textContent).toBe('1983');

      tc.destroy();
    });

    it('clears previous entries when updated', () => {
      const tc = createTimelineComponent(bus);
      tc.mount(container);

      tc.update(makeCollection(3));
      expect(container.querySelectorAll('.timeline__entry').length).toBe(3);

      tc.update(makeCollection(2));
      expect(container.querySelectorAll('.timeline__entry').length).toBe(2);

      tc.destroy();
    });
  });

  describe('keyboard accessibility', () => {
    it('makes each entry focusable with tabindex and role="listitem"', () => {
      const tc = createTimelineComponent(bus);
      tc.mount(container);
      tc.update(makeCollection(3));

      const entries = container.querySelectorAll('.timeline__entry');
      entries.forEach((entry) => {
        expect(entry.getAttribute('tabindex')).toBe('0');
        expect(entry.getAttribute('role')).toBe('listitem');
      });

      tc.destroy();
    });

    it('entries are in chronological tab order', () => {
      const tc = createTimelineComponent(bus);
      tc.mount(container);
      tc.update(makeCollection(3));

      const entries = container.querySelectorAll('.timeline__entry');
      expect(entries[0]!.getAttribute('data-index')).toBe('0');
      expect(entries[1]!.getAttribute('data-index')).toBe('1');
      expect(entries[2]!.getAttribute('data-index')).toBe('2');

      tc.destroy();
    });
  });

  describe('events', () => {
    it('emits entry:select on click', () => {
      const tc = createTimelineComponent(bus);
      tc.mount(container);
      tc.update(makeCollection(3));

      let selectedIndex: number | null = null;
      bus.on('entry:select', (payload) => {
        selectedIndex = payload.index;
      });

      const secondEntry = container.querySelector('[data-index="1"]') as HTMLElement;
      secondEntry.click();

      expect(selectedIndex).toBe(1);

      tc.destroy();
    });

    it('emits entry:select on Enter key', () => {
      const tc = createTimelineComponent(bus);
      tc.mount(container);
      tc.update(makeCollection(3));

      let selectedIndex: number | null = null;
      bus.on('entry:select', (payload) => {
        selectedIndex = payload.index;
      });

      const firstEntry = container.querySelector('[data-index="0"]') as HTMLElement;
      const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
      firstEntry.dispatchEvent(event);

      expect(selectedIndex).toBe(0);

      tc.destroy();
    });

    it('emits entry:select on Space key', () => {
      const tc = createTimelineComponent(bus);
      tc.mount(container);
      tc.update(makeCollection(3));

      let selectedIndex: number | null = null;
      bus.on('entry:select', (payload) => {
        selectedIndex = payload.index;
      });

      const thirdEntry = container.querySelector('[data-index="2"]') as HTMLElement;
      const event = new KeyboardEvent('keydown', { key: ' ', bubbles: true });
      thirdEntry.dispatchEvent(event);

      expect(selectedIndex).toBe(2);

      tc.destroy();
    });

    it('subscribes to data:loaded and calls update', () => {
      const tc = createTimelineComponent(bus);
      tc.mount(container);

      const collection = makeCollection(2);
      bus.emit('data:loaded', { collection });

      const entries = container.querySelectorAll('.timeline__entry');
      expect(entries.length).toBe(2);

      tc.destroy();
    });

    it('subscribes to layout:changed and toggles class', () => {
      const tc = createTimelineComponent(bus);
      tc.mount(container);

      const timeline = container.querySelector('.timeline') as HTMLElement;

      bus.emit('layout:changed', { mode: 'vertical' });
      expect(timeline.classList.contains('timeline--vertical')).toBe(true);
      expect(timeline.classList.contains('timeline--horizontal')).toBe(false);

      bus.emit('layout:changed', { mode: 'horizontal' });
      expect(timeline.classList.contains('timeline--horizontal')).toBe(true);
      expect(timeline.classList.contains('timeline--vertical')).toBe(false);

      tc.destroy();
    });
  });

  describe('image error handling', () => {
    it('replaces broken image with placeholder showing song title', () => {
      const tc = createTimelineComponent(bus);
      tc.mount(container);
      tc.update(makeCollection(1));

      const img = container.querySelector('.timeline__cover') as HTMLImageElement;
      expect(img).not.toBeNull();

      // Simulate image load error
      const errorEvent = new Event('error');
      img.dispatchEvent(errorEvent);

      // Image should be replaced by a placeholder
      const placeholder = container.querySelector('.timeline__cover-placeholder') as HTMLElement;
      expect(placeholder).not.toBeNull();
      expect(placeholder.textContent).toBe('Song 0');
      expect(placeholder.style.width).toBe('180px');
      expect(placeholder.style.height).toBe('180px');

      tc.destroy();
    });

    it('shows placeholder directly when albumCoverUrl is null', () => {
      const tc = createTimelineComponent(bus);
      tc.mount(container);

      const collection: SongCollection = {
        entries: [makeSongEntry({ albumCoverUrl: null, song: 'No Cover' })],
        startYear: 1981,
        endYear: 1981,
      };
      tc.update(collection);

      const placeholder = container.querySelector('.timeline__cover-placeholder');
      expect(placeholder).not.toBeNull();
      expect(placeholder!.textContent).toBe('No Cover');

      const img = container.querySelector('.timeline__cover');
      expect(img).toBeNull();

      tc.destroy();
    });
  });

  describe('layout', () => {
    it('uses horizontal class by default when window >= 768px', () => {
      // jsdom default window.innerWidth is 1024
      const tc = createTimelineComponent(bus);
      tc.mount(container);

      const timeline = container.querySelector('.timeline') as HTMLElement;
      expect(timeline.classList.contains('timeline--horizontal')).toBe(true);

      tc.destroy();
    });
  });

  describe('scrollToIndex', () => {
    it('resolves the promise even when element does not exist', async () => {
      const tc = createTimelineComponent(bus);
      tc.mount(container);
      tc.update(makeCollection(3));

      await expect(tc.scrollToIndex(99)).resolves.toBeUndefined();

      tc.destroy();
    });

    it('calls scrollTo on the timeline container', async () => {
      const tc = createTimelineComponent(bus);
      tc.mount(container);
      tc.update(makeCollection(3));

      const timeline = container.querySelector('.timeline') as HTMLElement;
      timeline.scrollTo = vi.fn();

      await tc.scrollToIndex(1);

      expect(timeline.scrollTo).toHaveBeenCalled();

      tc.destroy();
    });
  });

  describe('destroy', () => {
    it('removes the timeline from the DOM', () => {
      const tc = createTimelineComponent(bus);
      tc.mount(container);

      expect(container.querySelector('.timeline')).not.toBeNull();

      tc.destroy();

      expect(container.querySelector('.timeline')).toBeNull();
    });

    it('unsubscribes from bus events', () => {
      const tc = createTimelineComponent(bus);
      tc.mount(container);
      tc.destroy();

      bus.emit('data:loaded', { collection: makeCollection(2) });

      expect(container.querySelectorAll('.timeline__entry').length).toBe(0);
    });
  });
});
