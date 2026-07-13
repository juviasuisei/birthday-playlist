import { test } from '@fast-check/vitest';
import fc from 'fast-check';
import { describe, beforeEach, afterEach, vi, expect } from 'vitest';
import { createNavigationController } from '../../src/controller/navigation-controller';
import { createEventBus } from '../../src/event-bus';
import type { SongCollection, SongEntry } from '../../src/types';

/**
 * Feature: birthday-playlist, Property 12: Navigation Transition Guard
 *
 * For any sequence of navigation events emitted while a transition is already
 * in progress, the NavigationController SHALL ignore all subsequent events until
 * the current transition completes — resulting in exactly one transition per
 * burst of rapid events.
 *
 * Validates: Requirements 9.7
 */
describe('Property 12: Navigation Transition Guard', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function makeSongEntry(index: number): SongEntry {
    return {
      id: `entry-${index}`,
      year: 1981 + index,
      releaseDate: `${1981 + index}-06-15`,
      song: `Song ${index}`,
      artist: `Artist ${index}`,
      album: `Album ${index}`,
      artistPhotoUrl: null,
      appleMusicUrl: null,
      spotifyUrl: null,
      albumCoverUrl: null,
      musicVideoUrl: null,
      thoughts: null,
    };
  }

  function makeCollection(size: number): SongCollection {
    const entries: SongEntry[] = [];
    for (let i = 0; i < size; i++) {
      entries.push(makeSongEntry(i));
    }
    return {
      entries,
      startYear: 1981,
      endYear: 1981 + size - 1,
    };
  }

  /**
   * Arbitrary: generates a starting index (0 to 18, so goNext is valid for a 20-entry collection)
   * and a burst count (1-20 rapid navigation events).
   */
  const navigationBurstArbitrary = fc.tuple(
    fc.integer({ min: 0, max: 18 }), // startingIndex
    fc.integer({ min: 1, max: 20 }), // burstCount
  );

  test.prop([navigationBurstArbitrary], { numRuns: 100 })(
    'ignores rapid navigation events during an active transition, resulting in exactly one transition per burst',
    async ([startingIndex, burstCount]) => {
      const bus = createEventBus();
      const controller = createNavigationController(bus);
      const collection = makeCollection(20);

      controller.init(collection);

      // Set index to starting position via entry:select
      bus.emit('entry:select', { index: startingIndex });

      // Track nav:transition:start emissions
      let transitionStartCount = 0;
      bus.on('nav:transition:start', () => {
        transitionStartCount++;
      });

      // Call goNext() once — this starts the transition
      controller.goNext();

      // Immediately call goNext() N more times (burst)
      for (let i = 0; i < burstCount; i++) {
        controller.goNext();
      }

      // Advance timers by 600ms * (burstCount + 1) to let everything settle
      // Each transition takes 600ms (3 phases × 200ms)
      await vi.advanceTimersByTimeAsync(600 * (burstCount + 1));

      // Assert that only ONE transition occurred (index moved by exactly 1)
      expect(controller.getCurrentIndex()).toBe(startingIndex + 1);

      // Assert nav:transition:start was emitted exactly once during the burst
      expect(transitionStartCount).toBe(1);
    },
  );
});
