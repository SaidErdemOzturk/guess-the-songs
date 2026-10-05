import type { Song } from '@/types/song';
import { youtubePlayerService } from '@/services/audio/youtubePlayerService';
import { resolveYouTubeId } from '@/services/audio/youtubeResolver';

export type AudioProgressCallback = (currentSeconds: number, progressRatio: number) => void;

/**
 * Web Audio Service
 * Şarkıları YouTube IFrame Player API ile doğrudan 00:00 intro başlangıçlı olarak çalar.
 */
class WebAudioService {
  private isPlaying: boolean = false;
  private globalVolume: number = 0.75;
  private isMuted: boolean = false;

  /**
   * Sıradaki şarkının YouTube embed isteklerini tamamlar ve hazır (CUED) olmasını bekler.
   */
  public async preloadSong(song: Song): Promise<boolean> {
    const videoId = song.youtubeId || resolveYouTubeId(song);
    if (videoId) {
      try {
        return await youtubePlayerService.prepareSong(videoId);
      } catch {
        return false;
      }
    }
    return false;
  }

  /**
   * Şarkının embed isteklerinin tamamlanıp oynatmaya hazır olup olmadığını sorgular.
   */
  public isSongEmbedReady(song?: Song | null): boolean {
    if (!song) return false;
    const videoId = song.youtubeId || resolveYouTubeId(song);
    return youtubePlayerService.isVideoEmbedReady(videoId);
  }

  /**
   * Şarkının gerçek 00:00 intro kesitini YouTube IFrame Player ile belirtilen süre kadar çalar.
   */
  public async playSongClip(
    song: Song,
    durationInSeconds: number,
    onEnd?: () => void,
    onProgress?: AudioProgressCallback
  ): Promise<void> {
    this.stopCurrentAudio();
    this.isPlaying = true;

    const videoId = song.youtubeId || resolveYouTubeId(song);

    if (videoId) {
      console.log(`🎧 [YouTube Player] "${song.artist} - ${song.title}" (ID: ${videoId}) 00:00 intro başlangıçlı çalınıyor...`);
      const started = await youtubePlayerService.playClip(
        videoId,
        durationInSeconds,
        () => {
          this.isPlaying = false;
          if (onEnd) onEnd();
        },
        onProgress,
        false
      );

      if (started) {
        return;
      }
    }

    console.warn(`⚠️ [WebAudio] "${song.artist} - ${song.title}" için YouTube parçası başlatılamadı.`);
    this.isPlaying = false;
    if (onEnd) onEnd();
  }

  /**
   * Şarkıyı kullanıcı sonraki şarkıya geçene kadar kesintisiz/sürekli çalar.
   */
  public async playSongContinuous(
    song: Song,
    onProgress?: AudioProgressCallback
  ): Promise<void> {
    this.stopCurrentAudio();
    this.isPlaying = true;

    const videoId = song.youtubeId || resolveYouTubeId(song);

    if (videoId) {
      console.log(`🎧 [YouTube Player] "${song.artist} - ${song.title}" sürekli çalınıyor...`);
      const started = await youtubePlayerService.playClip(
        videoId,
        0,
        undefined,
        onProgress,
        true
      );

      if (started) {
        return;
      }
    }

    console.warn(`⚠️ [WebAudio] "${song.artist} - ${song.title}" için YouTube parçası başlatılamadı.`);
    this.isPlaying = false;
  }

  /**
   * Şarkıyı sıfırlamadan (en başa sarmadan) duraklatır.
   */
  public pauseAudio(): void {
    youtubePlayerService.pauseClip();
    this.isPlaying = false;
  }

  /**
   * Duraklatılan şarkıyı kaldığı saniyeden çalmaya devam ettirir.
   */
  public async resumeAudio(onProgress?: AudioProgressCallback): Promise<void> {
    this.isPlaying = true;
    const resumed = await youtubePlayerService.resumeContinuous(onProgress);
    if (!resumed) {
      this.isPlaying = false;
    }
  }

  /**
   * O an çalan sesi durdurur.
   */
  public stopCurrentAudio(): void {
    youtubePlayerService.stopClip();
    this.isPlaying = false;
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  public setVolume(volume: number): void {
    this.globalVolume = Math.max(0, Math.min(1, volume));
    youtubePlayerService.setVolume(this.globalVolume);
    if (this.globalVolume === 0) {
      this.isMuted = true;
    }
  }

  public getVolume(): number {
    return this.globalVolume;
  }

  public toggleMute(): boolean {
    this.isMuted = youtubePlayerService.toggleMute();
    return this.isMuted;
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  /**
   * Oynatma hatası dinleyicisi (Örn: 101/150 embed engeli)
   */
  public onPlaybackError(listener: (videoId: string, errorCode: number) => void): () => void {
    return youtubePlayerService.onPlaybackError(listener);
  }
}

export const webAudioService = new WebAudioService();
