import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createNavigationController } from '../../src/controller/navigation-controller';
import { createEventBus } from '../../src/event-bus';
import type { EventBus } from '../../src/event-bus';
import type { SongCollection, SongEntry } from '../../src/types';

function makeSongEntry(index: number): SongEntry {
  return {
    id: `rec${index}`,
    year: 1981 + index,
    releaseDate: `${1981 + index}-06-15`,
    song: `Song ${index}`,
    artist: `Artist ${index}`,
    album: `Album ${index}`,
    artistPhotoUrl: null,
    appleMusicUrl: null,
    spotifyUrl: null,
    albumCoverUrl: `https://example.com/cover${index}.jpg`,
    musicVideoUrl: null,
    thoughts: null,
  };
}

function makeCollection(count: number): SongCollection {
  const entries = Array.from({ length: count }, (_, i) => makeSongEntry(i));
  return {
    entries,
    startYear: 1981,
    endYear: 1981 + count - 1,
  };
}

describe('NavigationController', () => {
  let bus: EventBus;

  beforeEach(() => {
    vi.useFakeTimers();
    bus = createEventBus();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('init and state', () => {
    it('starts at index 0 after init', () => {
      const nav = createNavigationController(bus);
      nav.init(makeCollection(5));
      expect(nav.getCurrentIndex()).toBe(0);
      nav.destroy();
    });

    it('updates current index on entry:select', () => {
      const nav = createNavigationController(bus);
      nav.init(makeCollection(5));
      bus.emit('entry:select', { index: 3 });
      expect(nav.getCurrentIndex()).toBe(3);
      nav.destroy();
    });

    it('ignores entry:select with out-of-bounds index', () => {
      const nav = createNavigationController(bus);
      nav.init(makeCollection(5));
      bus.emit('entry:select', { index: 10 });
      expect(nav.getCurrentIndex()).toBe(0);
      bus.emit('entry:select', { index: -1 });
      expect(nav.getCurrentIndex()).toBe(0);
      nav.destroy();
    });
  });

  describe('canGoNext / canGoPrev', () => {
    it('canGoNext is true when not at last entry', () => {
      const nav = createNavigationController(bus);
      nav.init(makeCollection(5));
      expect(nav.canGoNext()).toBe(true);
      nav.destroy();
    });

    it('canGoNext is false at last entry', () => {
      const nav = createNavigationController(bus);
      nav.init(makeCollection(5));
      bus.emit('entry:select', { index: 4 });
      expect(nav.canGoNext()).toBe(false);
      nav.destroy();
    });

    it('canGoPrev is false at first entry', () => {
      const nav = createNavigationController(bus);
      nav.init(makeCollection(5));
      expect(nav.canGoPrev()).toBe(false);
      nav.destroy();
    });

    it('canGoPrev is true when not at first entry', () => {
      const nav = createNavigationController(bus);
      nav.init(makeCollection(5));
      bus.emit('entry:select', { index: 2 });
      expect(nav.canGoPrev()).toBe(true);
      nav.destroy();
    });

    it('canGoNext and canGoPrev are false without init', () => {
      const nav = createNavigationController(bus);
      expect(nav.canGoNext()).toBe(false);
      expect(nav.canGoPrev()).toBe(false);
      nav.destroy();
    });
  });

  describe('goNext', () => {
    it('increments index after full transition', async () => {
      const nav = createNavigationController(bus);
      nav.init(makeCollection(5));

      nav.goNext();

      // Advance through all three phases (200ms each)
      await vi.advanceTimersByTimeAsync(600);

      expect(nav.getCurrentIndex()).toBe(1);
      nav.destroy();
    });

    it('does not go past the last entry', async () => {
      const nav = createNavigationController(bus);
      nav.init(makeCollection(3));
      bus.emit('entry:select', { index: 2 });

      nav.goNext();
      await vi.advanceTimersByTimeAsync(600);

      expect(nav.getCurrentIndex()).toBe(2);
      nav.destroy();
    });
  });

  describe('goPrev', () => {
    it('decrements index after full transition', async () => {
      const nav = createNavigationController(bus);
      nav.init(makeCollection(5));
      bus.emit('entry:select', { index: 3 });

      nav.goPrev();
      await vi.advanceTimersByTimeAsync(600);

      expect(nav.getCurrentIndex()).toBe(2);
      nav.destroy();
    });

    it('does not go before the first entry', async () => {
      const nav = createNavigationController(bus);
      nav.init(makeCollection(5));

      nav.goPrev();
      await vi.advanceTimersByTimeAsync(600);

      expect(nav.getCurrentIndex()).toBe(0);
      nav.destroy();
    });
  });

  describe('transition events', () => {
    it('emits nav:transition:start and nav:transition:end', async () => {
      const nav = createNavigationController(bus);
      nav.init(makeCollection(5));

      const events: string[] = [];
      bus.on('nav:transition:start', () => events.push('start'));
      bus.on('nav:transition:end', () => events.push('end'));

      nav.goNext();
      await vi.advanceTimersByTimeAsync(600);

      expect(events).toEqual(['start', 'end']);
      nav.destroy();
    });

    it('emits start immediately when goNext is called', async () => {
      const nav = createNavigationController(bus);
      nav.init(makeCollection(5));

      const events: string[] = [];
      bus.on('nav:transition:start', () => events.push('start'));

      nav.goNext();

      // start should be emitted synchronously (before any delay)
      expect(events).toEqual(['start']);

      await vi.advanceTimersByTimeAsync(600);
      nav.destroy();
    });
  });

  describe('transition guard', () => {
    it('ignores goNext while transitioning', async () => {
      const nav = createNavigationController(bus);
      nav.init(makeCollection(10));

      const startCount: number[] = [];
      bus.on('nav:transition:start', () => startCount.push(1));

      nav.goNext(); // starts transition to index 1

      // Try to navigate again while still in fade-out phase
      await vi.advanceTimersByTimeAsync(100);
      nav.goNext(); // should be ignored

      await vi.advanceTimersByTimeAsync(500);

      // Only one transition should have started
      expect(startCount.length).toBe(1);
      expect(nav.getCurrentIndex()).toBe(1);
      nav.destroy();
    });

    it('ignores goPrev while transitioning', async () => {
      const nav = createNavigationController(bus);
      nav.init(makeCollection(10));
      bus.emit('entry:select', { index: 5 });

      nav.goNext(); // starts transition to index 6

      await vi.advanceTimersByTimeAsync(100);
      nav.goPrev(); // should be ignored

      await vi.advanceTimersByTimeAsync(500);

      expect(nav.getCurrentIndex()).toBe(6);
      nav.destroy();
    });

    it('allows navigation after transition completes', async () => {
      const nav = createNavigationController(bus);
      nav.init(makeCollection(10));

      nav.goNext();
      await vi.advanceTimersByTimeAsync(600);
      expect(nav.getCurrentIndex()).toBe(1);

      nav.goNext();
      await vi.advanceTimersByTimeAsync(600);
      expect(nav.getCurrentIndex()).toBe(2);

      nav.destroy();
    });

    it('ignores nav:next events via bus while transitioning', async () => {
      const nav = createNavigationController(bus);
      nav.init(makeCollection(10));

      bus.emit('nav:next', undefined); // starts transition
      await vi.advanceTimersByTimeAsync(100);
      bus.emit('nav:next', undefined); // should be ignored

      await vi.advanceTimersByTimeAsync(500);

      expect(nav.getCurrentIndex()).toBe(1);
      nav.destroy();
    });
  });

  describe('three-phase animation timing', () => {
    it('index does not change during fade-out phase', async () => {
      const nav = createNavigationController(bus);
      nav.init(makeCollection(5));

      nav.goNext();
      // Still in fade-out phase at 100ms
      await vi.advanceTimersByTimeAsync(100);
      expect(nav.getCurrentIndex()).toBe(0);

      await vi.advanceTimersByTimeAsync(500);
      nav.destroy();
    });

    it('index changes during slide phase', async () => {
      const nav = createNavigationController(bus);
      nav.init(makeCollection(5));

      nav.goNext();
      // After 200ms fade-out completes, enters slide phase and updates index
      await vi.advanceTimersByTimeAsync(200);
      expect(nav.getCurrentIndex()).toBe(1);

      await vi.advanceTimersByTimeAsync(400);
      nav.destroy();
    });

    it('transition:end emitted after all three phases (600ms total)', async () => {
      const nav = createNavigationController(bus);
      nav.init(makeCollection(5));

      let ended = false;
      bus.on('nav:transition:end', () => { ended = true; });

      nav.goNext();

      await vi.advanceTimersByTimeAsync(599);
      expect(ended).toBe(false);

      await vi.advanceTimersByTimeAsync(1);
      expect(ended).toBe(true);

      nav.destroy();
    });
  });

  describe('nav:next and nav:prev bus events', () => {
    it('responds to nav:next event from bus', async () => {
      const nav = createNavigationController(bus);
      nav.init(makeCollection(5));

      bus.emit('nav:next', undefined);
      await vi.advanceTimersByTimeAsync(600);

      expect(nav.getCurrentIndex()).toBe(1);
      nav.destroy();
    });

    it('responds to nav:prev event from bus', async () => {
      const nav = createNavigationController(bus);
      nav.init(makeCollection(5));
      bus.emit('entry:select', { index: 3 });

      bus.emit('nav:prev', undefined);
      await vi.advanceTimersByTimeAsync(600);

      expect(nav.getCurrentIndex()).toBe(2);
      nav.destroy();
    });
  });

  describe('destroy', () => {
    it('stops responding to events after destroy', async () => {
      const nav = createNavigationController(bus);
      nav.init(makeCollection(5));
      nav.destroy();

      bus.emit('nav:next', undefined);
      await vi.advanceTimersByTimeAsync(600);

      expect(nav.getCurrentIndex()).toBe(0);
    });

    it('does not emit events during in-flight transition after destroy', async () => {
      const nav = createNavigationController(bus);
      nav.init(makeCollection(5));

      const events: string[] = [];
      bus.on('nav:transition:end', () => events.push('end'));

      nav.goNext();
      await vi.advanceTimersByTimeAsync(100);
      nav.destroy();

      await vi.advanceTimersByTimeAsync(600);

      expect(events).toEqual([]);
    });
  });
});
