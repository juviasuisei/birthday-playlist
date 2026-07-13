/** Raw Airtable record shape (fields as returned from API) */
export interface AirtableRecord {
  id: string;
  fields: {
    "Release Date"?: string;
    "Song"?: string;
    "Artist"?: string;
    "Album"?: string;
    "Artist Photo"?: string;
    "Apple Music"?: string;
    "Spotify"?: string;
    "Album Cover"?: string;
    "Music Video"?: string;
    "Thoughts"?: string;
  };
  createdTime: string;
}

export interface AirtableResponse {
  records: AirtableRecord[];
  offset?: string;
}

/** Runtime domain model after normalization */
export interface SongEntry {
  id: string;
  year: number | null;
  releaseDate: string | null;
  song: string;
  artist: string;
  album: string;
  artistPhotoUrl: string | null;
  appleMusicUrl: string | null;
  spotifyUrl: string | null;
  albumCoverUrl: string | null;
  musicVideoUrl: string | null;
  thoughts: string | null;
}

/** Sorted, validated collection ready for rendering */
export interface SongCollection {
  entries: SongEntry[];
  startYear: number;
  endYear: number;
}

export type EventMap = {
  "loading:start": undefined;
  "loading:progress": { fetched: number; total: number | null };
  "data:loaded": { collection: SongCollection };
  "data:error": { message: string };
  "entry:select": { index: number };
  "entry:deselect": undefined;
  "nav:next": undefined;
  "nav:prev": undefined;
  "nav:transition:start": undefined;
  "nav:transition:end": undefined;
  "layout:changed": { mode: "horizontal" | "vertical" };
};

export interface AppState {
  phase: "loading" | "ready" | "error";
  collection: SongCollection | null;
  selectedIndex: number | null;
  isTransitioning: boolean;
  layoutMode: "horizontal" | "vertical";
  errorMessage: string | null;
}
