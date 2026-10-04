/**
 * YouTube IFrame Player API Types
 * https://developers.google.com/youtube/iframe_api_reference
 */

export type YTPlayerState =
  | -1 // UNSTARTED
  | 0  // ENDED
  | 1  // PLAYING
  | 2  // PAUSED
  | 3  // BUFFERING
  | 5; // CUED

export interface YTPlayerVars {
  autoplay?: 0 | 1;
  controls?: 0 | 1;
  disablekb?: 0 | 1;
  enablejsapi?: 0 | 1;
  fs?: 0 | 1;
  iv_load_policy?: 1 | 3;
  loop?: 0 | 1;
  modestbranding?: 0 | 1;
  origin?: string;
  playsinline?: 0 | 1;
  rel?: 0 | 1;
  start?: number;
  end?: number;
}

export interface YTPlayerOptions {
  width?: string | number;
  height?: string | number;
  videoId?: string;
  playerVars?: YTPlayerVars;
  events?: {
    onReady?: (event: { target: YTPlayer }) => void;
    onStateChange?: (event: { data: YTPlayerState; target: YTPlayer }) => void;
    onError?: (event: { data: number; target: YTPlayer }) => void;
  };
}

export interface YTPlayer {
  loadVideoById(
    options: { videoId: string; startSeconds?: number; endSeconds?: number } | string,
    startSeconds?: number
  ): void;
  cueVideoById(
    options: { videoId: string; startSeconds?: number } | string,
    startSeconds?: number
  ): void;
  cuePlaylist(
    options: { list: string; listType?: 'playlist' | 'search' | 'user_uploads'; index?: number; startSeconds?: number } | string[],
    index?: number,
    startSeconds?: number
  ): void;
  loadPlaylist(
    options: { list: string; listType?: 'playlist' | 'search' | 'user_uploads'; index?: number; startSeconds?: number } | string[],
    index?: number,
    startSeconds?: number
  ): void;
  getPlaylist(): string[];
  getPlaylistIndex(): number;
  playVideo(): void;
  pauseVideo(): void;
  stopVideo(): void;
  seekTo(seconds: number, allowSeekAhead?: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): YTPlayerState;
  setVolume(volume: number): void;
  getVolume(): number;
  mute(): void;
  unMute(): void;
  isMuted(): boolean;
  destroy(): void;
  getIframe(): HTMLIFrameElement;
}

export interface YouTubeNamespace {
  Player: new (element: HTMLElement | string, options: YTPlayerOptions) => YTPlayer;
  PlayerState: {
    UNSTARTED: -1;
    ENDED: 0;
    PLAYING: 1;
    PAUSED: 2;
    BUFFERING: 3;
    CUED: 5;
  };
}

declare global {
  interface Window {
    onYouTubeIframeAPIReady?: () => void;
    YT?: YouTubeNamespace;
  }
}
