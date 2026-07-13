import { describe, it, expect } from 'vitest';
import { sortSongs } from '../../src/engine/song-sorter';
import type { SongEntry } from '../../src/types';

function makeSongEntry(overrides: Partial<SongEntry> = {}): SongEntry {
  return {
    id: 'test-id',
    year: null,
    releaseDate: null,
    song: 'Test Song',
    artist: 'Test Artist',
    album: 'Test Album',
    artistPhotoUrl: null,
    appleMusicUrl: null,
    spotifyUrl: null,
    albumCoverUrl: null,
    musicVideoUrl: null,
    thoughts: null,
    ...overrides,
  };
}

describe('sortSongs', () => {
  it('returns an empty array when given an empty array', () => {
    expect(sortSongs([])).toEqual([]);
  });

  it('sorts entries by releaseDate ascending', () => {
    const entries = [
      makeSongEntry({ id: 'c', releaseDate: '2000-05-01' }),
      makeSongEntry({ id: 'a', releaseDate: '1981-06-15' }),
      makeSongEntry({ id: 'b', releaseDate: '1995-03-20' }),
    ];

    const sorted = sortSongs(entries);
    expect(sorted.map((e) => e.id)).toEqual(['a', 'b', 'c']);
  });

  it('places entries with null releaseDate at the end', () => {
    const entries = [
      makeSongEntry({ id: 'null1', releaseDate: null }),
      makeSongEntry({ id: 'dated', releaseDate: '1990-01-01' }),
      makeSongEntry({ id: 'null2', releaseDate: null }),
    ];

    const sorted = sortSongs(entries);
    expect(sorted[0]!.id).toBe('dated');
    expect(sorted[1]!.releaseDate).toBeNull();
    expect(sorted[2]!.releaseDate).toBeNull();
  });

  it('does not mutate the original array', () => {
    const entries = [
      makeSongEntry({ id: 'b', releaseDate: '2000-01-01' }),
      makeSongEntry({ id: 'a', releaseDate: '1990-01-01' }),
    ];
    const original = [...entries];

    sortSongs(entries);

    expect(entries).toEqual(original);
  });

  it('handles a single entry', () => {
    const entries = [makeSongEntry({ id: 'only', releaseDate: '1985-07-04' })];
    const sorted = sortSongs(entries);
    expect(sorted).toEqual(entries);
  });

  it('handles all null releaseDates', () => {
    const entries = [
      makeSongEntry({ id: 'a', releaseDate: null }),
      makeSongEntry({ id: 'b', releaseDate: null }),
    ];
    const sorted = sortSongs(entries);
    expect(sorted.length).toBe(2);
    expect(sorted.every((e) => e.releaseDate === null)).toBe(true);
  });
});
