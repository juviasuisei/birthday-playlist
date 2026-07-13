import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRateLimiter } from '../../src/data/rate-limiter.ts';

describe('RateLimiter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves immediately when under the limit', async () => {
    const limiter = createRateLimiter(5);

    const promise = limiter.acquire();
    await expect(promise).resolves.toBeUndefined();
  });

  it('allows maxPerSecond calls to resolve immediately', async () => {
    const limiter = createRateLimiter(5);

    // 5 calls should all resolve immediately
    for (let i = 0; i < 5; i++) {
      await limiter.acquire();
    }
  });

  it('delays the 6th call until a slot opens', async () => {
    const limiter = createRateLimiter(5);

    // Fill the window with 5 calls
    for (let i = 0; i < 5; i++) {
      await limiter.acquire();
    }

    // The 6th call should not resolve immediately
    let resolved = false;
    const sixthCall = limiter.acquire().then(() => {
      resolved = true;
    });

    // Should not be resolved yet
    await vi.advanceTimersByTimeAsync(500);
    expect(resolved).toBe(false);

    // After the full 1000ms window passes, it should resolve
    await vi.advanceTimersByTimeAsync(500);
    expect(resolved).toBe(true);

    await sixthCall;
  });

  it('handles maxPerSecond of 1', async () => {
    const limiter = createRateLimiter(1);

    // First call resolves immediately
    await limiter.acquire();

    // Second call should be delayed
    let resolved = false;
    const secondCall = limiter.acquire().then(() => {
      resolved = true;
    });

    await vi.advanceTimersByTimeAsync(500);
    expect(resolved).toBe(false);

    await vi.advanceTimersByTimeAsync(500);
    expect(resolved).toBe(true);

    await secondCall;
  });

  it('allows new calls after the window slides', async () => {
    const limiter = createRateLimiter(5);

    // Fill the window
    for (let i = 0; i < 5; i++) {
      await limiter.acquire();
    }

    // Advance past the window
    await vi.advanceTimersByTimeAsync(1001);

    // Should resolve immediately again
    const promise = limiter.acquire();
    await expect(promise).resolves.toBeUndefined();
  });
});
