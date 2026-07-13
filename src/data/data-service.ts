import type { EventBus } from '../event-bus';
import type { AirtableRecord, AirtableResponse, SongCollection, SongEntry } from '../types';
import { createRateLimiter } from './rate-limiter';
import { sortSongs } from '../engine/song-sorter';

export interface DataServiceConfig {
  baseId: string;
  tableId: string;
  token: string;
  maxPages: number;
  timeoutMs: number;
  rateLimit: number;
}

export interface DataService {
  fetchAll(): Promise<SongCollection>;
}

/**
 * Normalizes a raw AirtableRecord into a SongEntry domain model.
 * Maps space-separated field names to camelCase, extracts year from
 * the release date, and null-coalesces missing fields.
 */
function normalizeRecord(record: AirtableRecord): SongEntry {
  const fields = record.fields;
  const releaseDate = fields["Release Date"] ?? null;

  let year: number | null = null;
  if (releaseDate) {
    const parsed = new Date(releaseDate);
    if (!isNaN(parsed.getTime())) {
      year = parsed.getFullYear();
    }
  }

  return {
    id: record.id,
    year,
    releaseDate,
    song: fields["Song"] ?? '',
    artist: fields["Artist"] ?? '',
    album: fields["Album"] ?? '',
    artistPhotoUrl: fields["Artist Photo"] ?? null,
    appleMusicUrl: fields["Apple Music"] ?? null,
    spotifyUrl: fields["Spotify"] ?? null,
    albumCoverUrl: fields["Album Cover"] ?? null,
    musicVideoUrl: fields["Music Video"] ?? null,
    thoughts: fields["Thoughts"] ?? null,
  };
}

/**
 * Creates a DataService that fetches all song records from Airtable,
 * handles pagination, rate limiting, timeouts, and normalizes the data
 * into a SongCollection.
 */
export function createDataService(config: DataServiceConfig, bus: EventBus): DataService {
  const rateLimiter = createRateLimiter(config.rateLimit);

  async function fetchAll(): Promise<SongCollection> {
    // Guard against empty/missing token at runtime
    if (!config.token || config.token.trim() === '') {
      const errorMessage = 'Configuration error. Data cannot be loaded.';
      bus.emit('data:error', { message: errorMessage });
      throw new Error(errorMessage);
    }

    bus.emit('loading:start', undefined);

    // Set up abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);

    const allRecords: AirtableRecord[] = [];
    let offset: string | undefined;
    let pageCount = 0;

    try {
      do {
        await rateLimiter.acquire();

        const url = buildUrl(config.baseId, config.tableId, offset);
        const response = await fetchWithRetry(url, config.token, controller.signal);

        const data = await response.json() as AirtableResponse;
        allRecords.push(...data.records);
        pageCount++;

        bus.emit('loading:progress', { fetched: allRecords.length, total: null });

        offset = data.offset;
      } while (offset && pageCount < config.maxPages);

      clearTimeout(timeoutId);

      // Normalize all records
      const entries = allRecords.map(normalizeRecord);

      // Sort by release date ascending (nulls at end)
      const sorted = sortSongs(entries);

      // Build SongCollection
      const nonNullYears = sorted
        .map((e) => e.year)
        .filter((y): y is number => y !== null);

      const startYear = nonNullYears.length > 0 ? nonNullYears[0]! : 0;
      const endYear = nonNullYears.length > 0 ? nonNullYears[nonNullYears.length - 1]! : 0;

      const collection: SongCollection = {
        entries: sorted,
        startYear,
        endYear,
      };

      bus.emit('data:loaded', { collection });

      return collection;
    } catch (error: unknown) {
      clearTimeout(timeoutId);

      let message = "We couldn't load the music data. Please try again later.";
      if (error instanceof DOMException && error.name === 'AbortError') {
        message = "We couldn't load the music data. Please try again later.";
      } else if (error instanceof Error && error.message === 'Configuration error. Data cannot be loaded.') {
        // Already emitted, re-throw as-is
        throw error;
      }

      bus.emit('data:error', { message });
      throw new Error(message);
    }
  }

  return { fetchAll };
}

/**
 * Builds the Airtable API URL with sort parameters and optional offset.
 */
function buildUrl(baseId: string, tableId: string, offset?: string): string {
  let url = `https://api.airtable.com/v0/${baseId}/${tableId}?sort%5B0%5D%5Bfield%5D=Release%20Date&sort%5B0%5D%5Bdirection%5D=asc`;
  if (offset) {
    url += `&offset=${encodeURIComponent(offset)}`;
  }
  return url;
}

/**
 * Fetches with retry logic for 429 (rate limit exceeded) responses.
 * Retries up to 3 times with a 1-second delay between retries.
 */
async function fetchWithRetry(
  url: string,
  token: string,
  signal: AbortSignal,
  maxRetries: number = 3,
): Promise<Response> {
  let lastResponse: Response | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      signal,
    });

    if (response.status !== 429) {
      if (!response.ok) {
        throw new Error(`Airtable API error: ${response.status} ${response.statusText}`);
      }
      return response;
    }

    lastResponse = response;

    // Wait 1 second before retrying on 429
    if (attempt < maxRetries) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  // All retries exhausted
  throw new Error(`Rate limit exceeded after ${maxRetries} retries (status: ${lastResponse?.status})`);
}
