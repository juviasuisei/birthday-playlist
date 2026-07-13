/**
 * Rate limiter using a sliding-window algorithm.
 * Enforces a maximum number of resolved acquire() calls within any
 * contiguous 1-second window.
 */

export interface RateLimiter {
  /** Waits until a request slot is available, then resolves */
  acquire(): Promise<void>;
}

/**
 * Creates a rate limiter that allows at most `maxPerSecond` resolved
 * acquire() calls within any contiguous 1000ms window.
 *
 * Uses a sliding window of timestamps to track recent calls. When the
 * window is full, the next acquire() delays until the oldest timestamp
 * falls outside the window.
 */
export function createRateLimiter(maxPerSecond: number): RateLimiter {
  // Timestamps (in ms) of the most recent resolved acquire() calls
  const timestamps: number[] = [];
  // Queue of pending acquire() callers waiting for a slot
  const pending: Array<() => void> = [];

  function cleanWindow(now: number): void {
    while (timestamps.length > 0 && timestamps[0]! <= now - 1000) {
      timestamps.shift();
    }
  }

  function tryDrain(): void {
    while (pending.length > 0) {
      const now = Date.now();
      cleanWindow(now);

      if (timestamps.length < maxPerSecond) {
        // Slot available — resolve the next pending caller
        timestamps.push(now);
        const next = pending.shift()!;
        next();
      } else {
        // Window is full — schedule drain after the oldest entry expires
        const oldest = timestamps[0]!;
        const delay = oldest + 1000 - now;
        setTimeout(tryDrain, Math.max(delay, 1));
        return;
      }
    }
  }

  function acquire(): Promise<void> {
    const now = Date.now();
    cleanWindow(now);

    if (timestamps.length < maxPerSecond && pending.length === 0) {
      // Slot available and no one waiting — resolve immediately
      timestamps.push(now);
      return Promise.resolve();
    }

    // Enqueue and schedule drain
    return new Promise<void>((resolve) => {
      pending.push(resolve);
      if (pending.length === 1) {
        // First pending caller triggers the drain schedule
        if (timestamps.length >= maxPerSecond) {
          const oldest = timestamps[0]!;
          const delay = oldest + 1000 - now;
          setTimeout(tryDrain, Math.max(delay, 1));
        } else {
          // Slot available but we queued to maintain FIFO — drain immediately
          setTimeout(tryDrain, 0);
        }
      }
    });
  }

  return { acquire };
}
