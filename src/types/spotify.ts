export interface SpotifyTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface SpotifyImage {
  url: string;
  height: number | null;
  width: number | null;
}

export interface SpotifyArtist {
  id: string;
  name: string;
  uri?: string;
}

export interface SpotifyAlbum {
  id: string;
  name: string;
  images: SpotifyImage[];
  release_date: string;
}

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: SpotifyArtist[];
  album: SpotifyAlbum;
  duration_ms: number;
  preview_url: string | null;
  popularity?: number;
}

export interface SpotifyPlaylistItem {
  added_at?: string;
  item?: SpotifyTrack; // Yeni Spotify API formatı
  track?: SpotifyTrack; // Eski Spotify API formatı
}

export interface SpotifyPlaylistResponse {
  id: string;
  name: string;
  description?: string;
  images?: SpotifyImage[];
  // Yeni Spotify API formatı: items.items
  items?: {
    items: SpotifyPlaylistItem[];
    total: number;
    limit?: number;
    offset?: number;
  };
  // Klasik Spotify API formatı: tracks.items
  tracks?: {
    items: SpotifyPlaylistItem[];
    total: number;
    limit?: number;
    offset?: number;
  };
}

export interface SpotifySearchResponse {
  tracks?: {
    items: SpotifyTrack[];
    total: number;
  };
}

/**
 * Spotify IFrame API & Embed Types
 */
export interface SpotifyEmbedPlaybackUpdate {
  data: {
    position: number;     // in milliseconds
    duration: number;     // in milliseconds
    isPaused: boolean;
    isBuffering: boolean;
    playingURI: string;
  };
}

export interface SpotifyEmbedController {
  loadUri: (uri: string, preferVideo?: boolean, startAt?: number) => void;
  play: () => void;
  pause: () => void;
  resume: () => void;
  togglePlay: () => void;
  seek: (seconds: number) => void;
  destroy: () => void;
  addListener: (
    event: 'playback_update' | 'ready',
    callback: (e: SpotifyEmbedPlaybackUpdate) => void
  ) => void;
  removeListener: (
    event: 'playback_update' | 'ready',
    callback: (e: SpotifyEmbedPlaybackUpdate) => void
  ) => void;
}

export interface SpotifyIFrameAPICreateOptions {
  uri?: string;
  url?: string;
  width?: number | string;
  height?: number | string;
  preferVideo?: boolean;
}

export interface SpotifyIFrameAPI {
  createController: (
    element: HTMLElement,
    options: SpotifyIFrameAPICreateOptions,
    callback: (EmbedController: SpotifyEmbedController) => void
  ) => void;
}

declare global {
  interface Window {
    onSpotifyIframeApiReady?: (IFrameAPI: SpotifyIFrameAPI) => void;
    SpotifyIFrameApi?: SpotifyIFrameAPI;
  }
}
