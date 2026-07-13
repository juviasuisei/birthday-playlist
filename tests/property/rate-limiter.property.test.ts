import { test } from '@fast-check/vitest';
import fc from 'fast-check';
import { describe, beforeEach, afterEach, vi } from 'vitest';
import { createRateLimiter } from '../../src/data/rate-limiter';

/**
 * Feature: birthday-playlist, Property 2: Rate Limiter Enforcement
 *
 * For any sequence of N acquire() calls to the RateLimiter,
 * no more than 5 calls SHALL resolve within any contiguous 1-second window.
 *
 * Validates: Requirements 1.3
 */
describe('Property 2: Rate Limiter Enforcement', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test.prop(
    [fc.array(fc.nat({ max: 500 }), { minLength: 1, maxLength: 30 })],
    { numRuns: 100 },
  )(
    'no more than 5 acquire() calls resolve within any contiguous 1-second window',
    async (delays) => {
      const limiter = createRateLimiter(5);
      const resolutionTimestamps: number[] = [];

      // Schedule acquire() calls with arbitrary delays between them
      const promises: Promise<void>[] = [];

      for (const delay of delays) {
        // Advance time by the generated delay before the next acquire
        await vi.advanceTimersByTimeAsync(delay);

        const p = limiter.acquire().then(() => {
          resolutionTimestamps.push(Date.now());
        });
        promises.push(p);
      }

      // Advance time enough to let all pending acquires resolve
      // Max theoretical wait: each call beyond the first 5 could wait up to 1000ms
      await vi.advanceTimersByTimeAsync(delays.length * 1000);

      // Wait for all promises to settle
      await Promise.all(promises);

      // Verify the windowed count property:
      // For any contiguous 1-second window, at most 5 calls resolved.
      for (let i = 0; i < resolutionTimestamps.length; i++) {
        const windowStart = resolutionTimestamps[i]!;
        const windowEnd = windowStart + 1000;

        // Count how many timestamps fall within [windowStart, windowStart + 1000)
        let count = 0;
        for (let j = i; j < resolutionTimestamps.length; j++) {
          if (resolutionTimestamps[j]! < windowEnd) {
            count++;
          } else {
            break;
          }
        }

        if (count > 5) {
          throw new Error(
            `Found ${count} resolved calls in 1-second window starting at ${windowStart}ms. ` +
            `Timestamps in window: ${resolutionTimestamps.slice(i, i + count).join(', ')}`,
          );
        }
      }
    },
  );
});
