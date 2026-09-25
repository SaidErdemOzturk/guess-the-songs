import type { Song } from '@/types/song';
import { itunesService } from '@/services/api/itunesService';

export type AudioProgressCallback = (currentSeconds: number, progressRatio: number) => void;

/**
 * Web Audio Service
 * Gerçek şarkı önizlemelerini (iTunes 30s AAC/MP3) HTML5 Audio elementi ile çalar.
 * Bip bip/synthesizer gibi sentetik mock sesler tamamen kaldırılmıştır.
 */
class WebAudioService {
  private currentAudioElement: HTMLAudioElement | null = null;
  private isPlaying: boolean = false;
  private globalVolume: number = 0.75;
  private isMuted: boolean = false;
  private stopTimeoutId: number | null = null;
  private animationFrameId: number | null = null;
  private currentProgressCallback: AudioProgressCallback | null = null;

  /**
   * Şarkının gerçek önizleme kesitini belirtilen süre kadar çalar.
   * Mock ses (osilatör/melodi) çalınmaz; parça ses dosyası yoksa Apple iTunes'dan anında temin edilir.
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

    let audioUrl = song.previewUrl;

    // Eğer şarkının previewUrl'i henüz yoksa, Apple iTunes API'sinden anında ara ve çek
    if (!audioUrl) {
      console.log(`🍏 [WebAudio] "${song.artist} - ${song.title}" için önizleme sesi aranıyor...`);
      const fetchedUrl = await itunesService.getPreviewUrl(song.title, song.artist);
      if (fetchedUrl) {
        audioUrl = fetchedUrl;
        song.previewUrl = fetchedUrl;
      }
    }

    if (!audioUrl) {
      console.warn(`⚠️ [WebAudio] "${song.artist} - ${song.title}" için ses önizleme linki bulunamadı.`);
      this.isPlaying = false;
      if (onEnd) onEnd();
      return;
    }

    if (!this.isPlaying) {
      // Bekleme sırasında durdurulduysa çalma
      return;
    }

    const audio = new Audio(audioUrl);
    this.currentAudioElement = audio;
    audio.volume = this.isMuted ? 0 : this.globalVolume;
    audio.currentTime = song.startSecond || 0;

    const startPerfTime = performance.now();

    try {
      await audio.play();
    } catch (err) {
      console.warn('[WebAudio] Ses çalınamadı (kullanıcı etkileşimi gerekebilir):', err);
      this.stopCurrentAudio();
      if (onEnd) onEnd();
      return;
    }

    const updateProgress = () => {
      if (!this.isPlaying || !this.currentAudioElement) return;

      const elapsedSeconds = (performance.now() - startPerfTime) / 1000;
      const clampedSeconds = Math.min(durationInSeconds, Math.max(0, elapsedSeconds));
      const ratio = durationInSeconds > 0 ? clampedSeconds / durationInSeconds : 0;

      if (this.currentProgressCallback) {
        this.currentProgressCallback(clampedSeconds, ratio);
      }

      if (elapsedSeconds < durationInSeconds) {
        this.animationFrameId = requestAnimationFrame(updateProgress);
      }
    };

    this.animationFrameId = requestAnimationFrame(updateProgress);

    this.stopTimeoutId = window.setTimeout(() => {
      if (this.currentProgressCallback) {
        this.currentProgressCallback(durationInSeconds, 1);
      }
      this.stopCurrentAudio();
      if (onEnd) onEnd();
    }, durationInSeconds * 1000);
  }

  public stopCurrentAudio(): void {
    if (this.stopTimeoutId !== null) {
      clearTimeout(this.stopTimeoutId);
      this.stopTimeoutId = null;
    }

    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.currentAudioElement) {
      try {
        this.currentAudioElement.pause();
        this.currentAudioElement.src = '';
      } catch {
        // Hata bastır
      }
      this.currentAudioElement = null;
    }

    this.isPlaying = false;
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  public setVolume(volume: number): void {
    this.globalVolume = Math.max(0, Math.min(1, volume));
    if (this.currentAudioElement) {
      this.currentAudioElement.volume = this.isMuted ? 0 : this.globalVolume;
    }
    if (this.globalVolume === 0) {
      this.isMuted = true;
    }
  }

  public getVolume(): number {
    return this.globalVolume;
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.currentAudioElement) {
      this.currentAudioElement.volume = this.isMuted ? 0 : this.globalVolume;
    }
    return this.isMuted;
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }
}

export const webAudioService = new WebAudioService();
