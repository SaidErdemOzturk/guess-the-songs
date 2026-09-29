import type { Song } from '@/types/song';
import { spotifyEmbedService } from '@/services/audio/spotifyEmbedService';

export type AudioProgressCallback = (currentSeconds: number, progressRatio: number) => void;

/**
 * Web Audio Service
 * Şarkıları Spotify Embed ile doğrudan 00:00 intro başlangıçlı olarak çalar.
 */
class WebAudioService {
  private isPlaying: boolean = false;
  private globalVolume: number = 0.75;
  private isMuted: boolean = false;
  private currentProgressCallback: AudioProgressCallback | null = null;

  /**
   * Sıradaki şarkının sesini Spotify Embed üzerinden hazırlar.
   */
  public async preloadSong(song: Song): Promise<void> {
    if (song.spotifyId) {
      try {
        await spotifyEmbedService.loadTrack(song.spotifyId);
      } catch { }
    }
  }

  /**
   * Şarkının gerçek 00:00 intro kesitini Spotify Embed ile belirtilen süre kadar çalar.
   */
  public async playSongClip(
    song: Song,
    durationInSeconds: number,
    onEnd?: () => void,
    onProgress?: AudioProgressCallback
  ): Promise<void> {
    this.stopCurrentAudio();
    this.isPlaying = true;
    this.currentProgressCallback = onProgress || null;

    if (song.spotifyId) {
      console.log(`🎧 [Spotify Embed] "${song.artist} - ${song.title}" 00:00 intro başlangıçlı çalınıyor...`);
      const embedStarted = await spotifyEmbedService.playClip(
        song.spotifyId,
        durationInSeconds,
        () => {
          this.isPlaying = false;
          if (onEnd) onEnd();
        },
        onProgress
      );
      if (embedStarted) {
        return;
      }
    }

    console.warn(`⚠️ [WebAudio] "${song.artist} - ${song.title}" için Spotify parçası başlatılamadı.`);
    this.isPlaying = false;
  }

  public stopCurrentAudio(): void {
    spotifyEmbedService.stopClip();
    this.isPlaying = false;
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  public setVolume(volume: number): void {
    this.globalVolume = Math.max(0, Math.min(1, volume));
    if (this.globalVolume === 0) {
      this.isMuted = true;
    }
  }

  public getVolume(): number {
    return this.globalVolume;
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    return this.isMuted;
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }
}

export const webAudioService = new WebAudioService();
