import type { SongEntry } from '../types';

/**
 * Sorts SongEntry[] by releaseDate ascending.
 * Entries with null releaseDate go to end.
 * Returns a new sorted array (does not mutate the input).
 */
export function sortSongs(entries: SongEntry[]): SongEntry[] {
  return [...entries].sort((a, b) => {
    if (a.releaseDate === null && b.releaseDate === null) return 0;
    if (a.releaseDate === null) return 1;
    if (b.releaseDate === null) return -1;
    // ISO date strings sort correctly via lexicographic comparison
    if (a.releaseDate < b.releaseDate) return -1;
    if (a.releaseDate > b.releaseDate) return 1;
    return 0;
  });
}
