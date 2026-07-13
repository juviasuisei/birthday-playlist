import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createDataService, type DataServiceConfig } from '../../src/data/data-service';
import { createEventBus, type EventBus } from '../../src/event-bus';
import type { AirtableResponse } from '../../src/types';

function makeConfig(overrides: Partial<DataServiceConfig> = {}): DataServiceConfig {
  return {
    baseId: 'appTEST123',
    tableId: 'tblTEST456',
    token: 'pat_valid_token',
    maxPages: 50,
    timeoutMs: 30000,
    rateLimit: 100, // high limit to avoid rate-limiter delays in most tests
    ...overrides,
  };
}

function makeAirtableResponse(
  recordCount: number,
  offset?: string,
  startId: number = 1,
): AirtableResponse {
  const records = Array.from({ length: recordCount }, (_, i) => ({
    id: `rec${startId + i}`,
    fields: {
      'Release Date': `${1981 + startId + i}-06-15`,
      Song: `Song ${startId + i}`,
      Artist: `Artist ${startId + i}`,
      Album: `Album ${startId + i}`,
    },
    createdTime: '2024-01-01T00:00:00.000Z',
  }));

  return { records, offset };
}

describe('DataService', () => {
  let bus: EventBus;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    bus = createEventBus();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('successful multi-page fetch', () => {
    it('fetches all pages and returns a complete SongCollection', async () => {
      // Page 1: 3 records with offset
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => makeAirtableResponse(3, 'offset_page2', 0),
      });
      // Page 2: 2 records, no offset (last page)
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => makeAirtableResponse(2, undefined, 3),
      });

      const config = makeConfig();
      const service = createDataService(config, bus);

      const resultPromise = service.fetchAll();
      // Advance timers to allow rate limiter to resolve
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.entries).toHaveLength(5);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      // Second call should include offset
      expect(fetchMock.mock.calls[1][0]).toContain('offset_page2');
    });

    it('stops at maxPages even if offset is still present', async () => {
      const config = makeConfig({ maxPages: 2 });

      // Both pages return offsets
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => makeAirtableResponse(2, 'offset_page2', 0),
      });
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => makeAirtableResponse(2, 'offset_page3', 2),
      });

      const service = createDataService(config, bus);
      const resultPromise = service.fetchAll();
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      // Should only fetch 2 pages (maxPages = 2)
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(result.entries).toHaveLength(4);
    });

    it('emits loading:start and data:loaded events', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => makeAirtableResponse(1, undefined, 0),
      });

      const config = makeConfig();
      const service = createDataService(config, bus);

      const loadingStart = vi.fn();
      const dataLoaded = vi.fn();
      bus.on('loading:start', loadingStart);
      bus.on('data:loaded', dataLoaded);

      const resultPromise = service.fetchAll();
      await vi.runAllTimersAsync();
      await resultPromise;

      expect(loadingStart).toHaveBeenCalledOnce();
      expect(dataLoaded).toHaveBeenCalledOnce();
      expect(dataLoaded).toHaveBeenCalledWith(
        expect.objectContaining({
          collection: expect.objectContaining({
            entries: expect.any(Array),
          }),
        }),
      );
    });

    it('emits loading:progress on each page', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => makeAirtableResponse(3, 'offset2', 0),
      });
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => makeAirtableResponse(2, undefined, 3),
      });

      const config = makeConfig();
      const service = createDataService(config, bus);

      const progress = vi.fn();
      bus.on('loading:progress', progress);

      const resultPromise = service.fetchAll();
      await vi.runAllTimersAsync();
      await resultPromise;

      expect(progress).toHaveBeenCalledTimes(2);
      expect(progress).toHaveBeenNthCalledWith(1, { fetched: 3, total: null });
      expect(progress).toHaveBeenNthCalledWith(2, { fetched: 5, total: null });
    });
  });

  describe('error handling (4xx/5xx)', () => {
    it('throws and emits data:error on 4xx response', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
      });

      const config = makeConfig();
      const service = createDataService(config, bus);

      const errorHandler = vi.fn();
      bus.on('data:error', errorHandler);

      const resultPromise = service.fetchAll();
      // Catch the rejection to prevent unhandled rejection warnings
      resultPromise.catch(() => {});
      await vi.runAllTimersAsync();

      await expect(resultPromise).rejects.toThrow();
      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.any(String) }),
      );
    });

    it('throws and emits data:error on 5xx response', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const config = makeConfig();
      const service = createDataService(config, bus);

      const errorHandler = vi.fn();
      bus.on('data:error', errorHandler);

      const resultPromise = service.fetchAll();
      resultPromise.catch(() => {});
      await vi.runAllTimersAsync();

      await expect(resultPromise).rejects.toThrow();
      expect(errorHandler).toHaveBeenCalledOnce();
    });
  });

  describe('timeout (abort after 30s)', () => {
    it('aborts and throws when fetch exceeds timeoutMs', async () => {
      const config = makeConfig({ timeoutMs: 5000 });

      // Simulate a fetch that never resolves until abort
      fetchMock.mockImplementation((_url: string, options: { signal: AbortSignal }) => {
        return new Promise((_resolve, reject) => {
          options.signal.addEventListener('abort', () => {
            const err = new DOMException('The operation was aborted.', 'AbortError');
            reject(err);
          });
        });
      });

      const service = createDataService(config, bus);

      const errorHandler = vi.fn();
      bus.on('data:error', errorHandler);

      const resultPromise = service.fetchAll();
      resultPromise.catch(() => {});

      // Advance time past the timeout
      await vi.advanceTimersByTimeAsync(5001);

      await expect(resultPromise).rejects.toThrow();
      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.any(String) }),
      );
    });
  });

  describe('missing token guard', () => {
    it('throws immediately with empty string token', async () => {
      const config = makeConfig({ token: '' });
      const service = createDataService(config, bus);

      const errorHandler = vi.fn();
      bus.on('data:error', errorHandler);

      await expect(service.fetchAll()).rejects.toThrow(
        'Configuration error. Data cannot be loaded.',
      );
      expect(errorHandler).toHaveBeenCalledWith({
        message: 'Configuration error. Data cannot be loaded.',
      });
      // Should NOT make any fetch calls
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('throws immediately with whitespace-only token', async () => {
      const config = makeConfig({ token: '   ' });
      const service = createDataService(config, bus);

      const errorHandler = vi.fn();
      bus.on('data:error', errorHandler);

      await expect(service.fetchAll()).rejects.toThrow(
        'Configuration error. Data cannot be loaded.',
      );
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('429 retry logic', () => {
    it('retries up to 3 times on 429 and succeeds when server recovers', async () => {
      // First two calls: 429, third call: success
      fetchMock
        .mockResolvedValueOnce({ ok: false, status: 429, statusText: 'Too Many Requests' })
        .mockResolvedValueOnce({ ok: false, status: 429, statusText: 'Too Many Requests' })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => makeAirtableResponse(2, undefined, 0),
        });

      const config = makeConfig();
      const service = createDataService(config, bus);

      const resultPromise = service.fetchAll();
      // Advance timers to allow retry delays (1s each)
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(result.entries).toHaveLength(2);
    });

    it('throws after exhausting all 3 retries on persistent 429', async () => {
      // All 4 calls (initial + 3 retries) return 429
      fetchMock.mockResolvedValue({ ok: false, status: 429, statusText: 'Too Many Requests' });

      const config = makeConfig();
      const service = createDataService(config, bus);

      const errorHandler = vi.fn();
      bus.on('data:error', errorHandler);

      const resultPromise = service.fetchAll();
      resultPromise.catch(() => {});
      await vi.runAllTimersAsync();

      await expect(resultPromise).rejects.toThrow();
      // Initial + 3 retries = 4 fetch calls
      expect(fetchMock).toHaveBeenCalledTimes(4);
      expect(errorHandler).toHaveBeenCalledOnce();
    });
  });

  describe('authentication', () => {
    it('sends bearer token in Authorization header', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => makeAirtableResponse(1, undefined, 0),
      });

      const config = makeConfig({ token: 'pat_my_secret_token' });
      const service = createDataService(config, bus);

      const resultPromise = service.fetchAll();
      await vi.runAllTimersAsync();
      await resultPromise;

      expect(fetchMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: { Authorization: 'Bearer pat_my_secret_token' },
        }),
      );
    });
  });
});
