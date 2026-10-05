import type { YTPlayer, YTPlayerState } from '@/types/youtube';
import type { AudioProgressCallback } from './webAudioService';

/**
 * YouTube IFrame Player Service
 * Resmi YouTube IFrame Player API (https://developers.google.com/youtube/iframe_api_reference)
 * üzerinden arka planda 00:00 başlangıçlı intro oynatımını ve süre bazlı klip yönetimini sağlar.
 */
class YouTubePlayerService {
  private player: YTPlayer | null = null;
  private isApiReady: boolean = false;
  private apiInitPromise: Promise<void> | null = null;
  private playerReadyPromise: Promise<YTPlayer> | null = null;

  private currentVideoId: string | null = null;
  private cuedVideoId: string | null = null;
  private isEmbedReady: boolean = false;
  private cuedResolve: ((ready: boolean) => void) | null = null;
  private cuedReject: ((reason?: any) => void) | null = null;
  private cuedTimer: ReturnType<typeof setTimeout> | null = null;

  private pendingPlaybackStart: {
    videoId: string;
    durationSeconds: number;
    continuous: boolean;
    onProgress?: AudioProgressCallback;
  } | null = null;
  private playbackStartTimeout: ReturnType<typeof setTimeout> | null = null;

  private isPlaying: boolean = false;
  private isMuted: boolean = false;
  private currentVolume: number = 75; // 0 - 100

  private progressInterval: ReturnType<typeof setInterval> | null = null;
  private clipTimeout: ReturnType<typeof setTimeout> | null = null;
  private activeOnEndCallback: (() => void) | null = null;
  private unplayableVideoIds: Set<string> = new Set();
  private errorListeners: Set<(videoId: string, errorCode: number) => void> = new Set();
  private activePreparePromise: Promise<boolean> | null = null;
  private lastReportedErrorVideoId: string = '';
  private lastReportedErrorTime: number = 0;

  /**
   * YouTube IFrame API scriptini dinamik olarak yükler ve hazır olmasını bekler.
   */
  public async loadYouTubeApi(): Promise<void> {
    if (typeof window === 'undefined') return;

    if (window.YT && window.YT.Player) {
      this.isApiReady = true;
      return;
    }

    if (this.apiInitPromise) {
      return this.apiInitPromise;
    }

    this.apiInitPromise = new Promise<void>((resolve) => {
      let isDone = false;
      const finish = () => {
        if (!isDone) {
          isDone = true;
          this.isApiReady = true;
          console.log('🎬 [YouTubePlayerService] YouTube IFrame API yüklendi ve hazır.');
          resolve();
        }
      };

      const existingCallback = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (existingCallback) {
          try { existingCallback(); } catch {}
        }
        finish();
      };

      // Zaten yüklendiyse veya script önceden eklendiyse polling yap
      const pollInterval = setInterval(() => {
        if (window.YT && window.YT.Player) {
          clearInterval(pollInterval);
          finish();
        }
      }, 100);

      // Maksimum 3.5 saniye bekle
      setTimeout(() => {
        clearInterval(pollInterval);
        finish();
      }, 3500);

      // Script DOM'da yoksa ekle
      if (!document.getElementById('youtube-iframe-api-script')) {
        const script = document.createElement('script');
        script.id = 'youtube-iframe-api-script';
        script.src = 'https://www.youtube.com/iframe_api';
        script.async = true;
        document.head.appendChild(script);
      }
    });

    return this.apiInitPromise;
  }

  /**
   * Arka planda çalışan gizli YouTube Player nesnesini oluşturur ve hazır olmasını sağlar.
   */
  public async ensurePlayer(): Promise<YTPlayer> {
    if (this.player && typeof this.player.loadVideoById === 'function') {
      return this.player;
    }

    if (this.playerReadyPromise) {
      return this.playerReadyPromise;
    }

    this.playerReadyPromise = new Promise<YTPlayer>(async (resolve, reject) => {
      try {
        await this.loadYouTubeApi();

        // Arka plan DOM kapsayıcısı
        let container = document.getElementById('youtube-bg-player-container');
        if (!container) {
          container = document.createElement('div');
          container.id = 'youtube-bg-player-container';
          container.style.position = 'fixed';
          container.style.top = '-9999px';
          container.style.left = '-9999px';
          container.style.width = '240px';
          container.style.height = '180px';
          container.style.opacity = '0.01';
          container.style.pointerEvents = 'none';
          container.style.zIndex = '-999';
          document.body.appendChild(container);
        }

        let host = document.getElementById('youtube-audio-host');
        // Eğer önceki bir denemeden iframe kalmışsa sıfır div oluştur
        if (host && host.tagName === 'IFRAME') {
          host.remove();
          host = null;
        }
        if (!host) {
          host = document.createElement('div');
          host.id = 'youtube-audio-host';
          container.appendChild(host);
        }

        let isFinished = false;

        const finishPlayer = (p: YTPlayer) => {
          if (!isFinished && p && typeof p.loadVideoById === 'function') {
            isFinished = true;
            this.player = p;
            try {
              p.setVolume?.(this.currentVolume);
              if (this.isMuted) p.mute?.(); else p.unMute?.();
            } catch {}
            console.log('✅ [YouTubePlayerService] YouTube oynatıcı hazır ve metotları doğrulandı.');
            resolve(p);
          }
        };

        const timer = setTimeout(() => {
          if (this.player && typeof this.player.loadVideoById === 'function') {
            finishPlayer(this.player);
          } else {
            this.playerReadyPromise = null;
            reject(new Error('YouTube Player init timeout'));
          }
        }, 5000);

        if (!window.YT || !window.YT.Player) {
          clearTimeout(timer);
          this.playerReadyPromise = null;
          reject(new Error('YT.Player not available'));
          return;
        }

        new window.YT.Player('youtube-audio-host', {
          width: '240',
          height: '180',
          playerVars: {
            autoplay: 0,
            controls: 0,
            disablekb: 1,
            enablejsapi: 1,
            fs: 0,
            iv_load_policy: 3,
            modestbranding: 1,
            playsinline: 1,
            rel: 0,
            origin: window.location.origin,
            widget_referrer: window.location.origin,
          },
          events: {
            onReady: (event) => {
              clearTimeout(timer);
              const target = event.target;
              const checkReady = () => {
                if (target && typeof target.loadVideoById === 'function') {
                  finishPlayer(target);
                } else {
                  setTimeout(checkReady, 50);
                }
              };
              checkReady();
            },
            onStateChange: (event) => {
              this.handleStateChange(event.data);
            },
            onError: (err) => {
              const errorCode = typeof err?.data === 'number' ? err.data : Number(err?.data) || -1;
              const failedVideoId = this.currentVideoId;
              console.warn(`⚠️ [YouTubePlayerService] Player hatası (kod: ${errorCode}) - Video: ${failedVideoId}`);

              if (failedVideoId) {
                this.unplayableVideoIds.add(failedVideoId);
              }

              if (this.cuedTimer) {
                clearTimeout(this.cuedTimer);
                this.cuedTimer = null;
              }
              if (this.cuedReject) {
                const reject = this.cuedReject;
                this.cuedResolve = null;
                this.cuedReject = null;
                reject(new Error(`YouTube player error code ${errorCode}`));
              }

              // Oynatma süreci ve zamanlayıcıları sıfırla
              this.isPlaying = false;
              this.clearTimers();

              const now = Date.now();
              if (failedVideoId && this.lastReportedErrorVideoId === failedVideoId && now - this.lastReportedErrorTime < 3000) {
                return;
              }
              if (failedVideoId) {
                this.lastReportedErrorVideoId = failedVideoId;
                this.lastReportedErrorTime = now;
              }

              // Dinleyicileri (örn: GameRound otomatik şarkı değiştirici) uyar
              this.errorListeners.forEach((listener) => {
                try {
                  listener(failedVideoId || '', errorCode);
                } catch (e) {
                  console.error('Playback error listener hatası:', e);
                }
              });
            },
          },
        });
      } catch (err) {
        this.playerReadyPromise = null;
        reject(err);
      }
    });

    return this.playerReadyPromise;
  }

  /**
   * Oynatma hatası dinleyicisi ekler (örn: 101/150 embed kısıtlaması durumunda otomatik geçiş için)
   */
  public onPlaybackError(listener: (videoId: string, errorCode: number) => void): () => void {
    this.errorListeners.add(listener);
    return () => {
      this.errorListeners.delete(listener);
    };
  }

  /**
   * Bir videonun embed engeline (101/150) takılıp takılmadığını sorgular
   */
  public isVideoUnplayable(videoId?: string): boolean {
    if (!videoId) return false;
    return this.unplayableVideoIds.has(videoId);
  }

  /**
   * Bir videoyu manuel olarak oynatılamaz işaretler
   */
  public markVideoUnplayable(videoId: string): void {
    if (videoId) {
      this.unplayableVideoIds.add(videoId);
    }
  }

  /**
   * Videonun embed isteklerinin tamamlanıp hazır (CUED) olduğunu döner
   */
  public isVideoEmbedReady(videoId?: string): boolean {
    if (!videoId) return this.isEmbedReady;
    return this.cuedVideoId === videoId && this.isEmbedReady;
  }

  /**
   * Oynatıcı durum değişikliklerini takip eder
   */
  private handleStateChange(state: YTPlayerState): void {
    // 5: CUED (Embed istekleri tamamlandı, video bilgileri yüklendi ve oynatmaya hazır)
    if (state === 5) {
      console.log(`🎬 [YouTubePlayerService] Embed hazır (CUED): ${this.cuedVideoId}`);
      this.isEmbedReady = true;
      if (this.cuedResolve) {
        if (this.cuedTimer) clearTimeout(this.cuedTimer);
        this.cuedTimer = null;
        const resolve = this.cuedResolve;
        this.cuedResolve = null;
        this.cuedReject = null;
        resolve(true);
      }
      return;
    }

    // 1: PLAYING (Ses akışı gerçekte başladı)
    if (state === 1) {
      this.isPlaying = true;
      this.isEmbedReady = true;

      // Bekleyen cued promise varsa çöz
      if (this.cuedResolve) {
        if (this.cuedTimer) clearTimeout(this.cuedTimer);
        this.cuedTimer = null;
        const resolve = this.cuedResolve;
        this.cuedResolve = null;
        this.cuedReject = null;
        resolve(true);
      }

      // Bekleyen klip süresi ve progress zamanlayıcılarını ses GERÇEKTE başladığı an devreye al
      if (this.pendingPlaybackStart) {
        const { durationSeconds, continuous, onProgress } = this.pendingPlaybackStart;
        this.pendingPlaybackStart = null;
        if (this.playbackStartTimeout) {
          clearTimeout(this.playbackStartTimeout);
          this.playbackStartTimeout = null;
        }
        this.startActivePlaybackTimers(durationSeconds, continuous, onProgress);
      }
    } else if (state === 0 || state === 2) {
      // 0: ENDED, 2: PAUSED
      if (this.isPlaying && this.activeOnEndCallback) {
        this.stopClip();
      }
    }
  }

  /**
   * Belirtilen videonun YouTube embed isteklerinin tamamlanıp hazır olmasını (CUED) bekler.
   */
  public async prepareSong(videoId: string, timeoutMs: number = 3000): Promise<boolean> {
    if (!videoId) return false;

    // Eğer bu video zaten cued ve hazır durumdaysa hemen onay ver
    if (this.cuedVideoId === videoId) {
      if (this.isEmbedReady) return true;
      if (this.activePreparePromise) return this.activePreparePromise;
    }

    // Önceki bekleyen cued promise varsa temizle
    if (this.cuedTimer) {
      clearTimeout(this.cuedTimer);
      this.cuedTimer = null;
    }
    if (this.cuedResolve) {
      this.cuedResolve(false);
      this.cuedResolve = null;
      this.cuedReject = null;
    }

    this.isEmbedReady = false;
    this.cuedVideoId = videoId;
    this.currentVideoId = videoId;

    this.activePreparePromise = (async () => {
      try {
        const player = await this.ensurePlayer();

        return await new Promise<boolean>((resolve, reject) => {
          this.cuedResolve = resolve;
          this.cuedReject = reject;

          this.cuedTimer = setTimeout(() => {
            console.warn(`⏳ [YouTubePlayerService] prepareSong timeout (${timeoutMs}ms) for: ${videoId}`);
            this.cuedTimer = null;
            this.cuedResolve = null;
            this.cuedReject = null;
            this.isEmbedReady = true;
            resolve(true);
          }, timeoutMs);

          try {
            player.cueVideoById({
              videoId,
              startSeconds: 0,
            });
          } catch (err) {
            if (this.cuedTimer) clearTimeout(this.cuedTimer);
            this.cuedTimer = null;
            this.cuedResolve = null;
            this.cuedReject = null;
            reject(err);
          }
        });
      } catch (err) {
        console.warn('⚠️ [YouTubePlayerService] prepareSong başarısız:', err);
        return false;
      } finally {
        this.activePreparePromise = null;
      }
    })();

    return this.activePreparePromise;
  }

  /**
   * Parçayı önceden yükler/kuyruğa alır (sıfır gecikme için)
   */
  public async preloadVideo(videoId: string): Promise<boolean> {
    return this.prepareSong(videoId);
  }

  /**
   * Şarkının gerçek 00:00 başlangıçlı intro klibini belirtilen süre kadar çalar.
   * YouTube IFrame yerel endSeconds desteği ve sesin GERÇEKTEN başladığı anı (state === 1)
   * dinleyerek zamanlayıcıları başlatır; böylece yüklenme/buffering esnasında süre asla sıfırlanmaz.
   */
  public async playClip(
    videoId: string,
    durationSeconds: number,
    onEnd?: () => void,
    onProgress?: AudioProgressCallback,
    continuous: boolean = false
  ): Promise<boolean> {
    if (!videoId) return false;

    // Önceki timer ve callback'leri temizle
    this.clearTimers();
    this.activeOnEndCallback = onEnd || null;
    this.isPlaying = true;

    try {
      const player = await this.ensurePlayer();

      // Ses seviyesi ve mute durumunu uygula
      try {
        player.setVolume?.(this.currentVolume);
        if (this.isMuted) {
          player.mute?.();
        } else {
          player.unMute?.();
        }
      } catch {}

      this.currentVideoId = videoId;

      // Zamanlayıcıları henüz BAŞLATMIYORUZ!
      // YouTube buffer yapıp sesi GERÇEKTEN çalmaya başladığında (state === 1: PLAYING) başlatacağız.
      this.pendingPlaybackStart = {
        videoId,
        durationSeconds,
        continuous,
        onProgress,
      };

      // 7 saniye içinde ses başlamazsa güvenlik olarak durdur
      this.playbackStartTimeout = setTimeout(() => {
        if (this.pendingPlaybackStart) {
          console.warn('⚠️ [YouTubePlayerService] Playback başlatma zaman aşımı (7s), durduruluyor.');
          this.pendingPlaybackStart = null;
          this.stopClip();
        }
      }, 7000);

      // YouTube IFrame video yüklemesini başlat
      if (!continuous && durationSeconds > 0) {
        player.loadVideoById({
          videoId,
          startSeconds: 0,
          endSeconds: durationSeconds,
        });
      } else {
        player.loadVideoById({
          videoId,
          startSeconds: 0,
        });
      }

      // Eğer player anında PLAYING durumuna geçtiyse hemen başlat
      if (player.getPlayerState && player.getPlayerState() === 1) {
        if (this.playbackStartTimeout) {
          clearTimeout(this.playbackStartTimeout);
          this.playbackStartTimeout = null;
        }
        this.pendingPlaybackStart = null;
        this.startActivePlaybackTimers(durationSeconds, continuous, onProgress);
      }

      return true;
    } catch (err) {
      console.error('❌ [YouTubePlayerService] playClip hatası:', err);
      this.isPlaying = false;
      this.clearTimers();
      return false;
    }
  }

  /**
   * Ses GERÇEKTE başladığı anda (state === 1) zamanlayıcıları ve ilerleme barını devreye sokar.
   */
  private startActivePlaybackTimers(
    durationSeconds: number,
    continuous: boolean,
    onProgress?: AudioProgressCallback
  ): void {
    if (!this.player) return;
    const player = this.player;

    if (onProgress) {
      onProgress(0, 0);
    }

    // 1. Anlık Süre ve İlerleme Takibi (Progress Bar)
    this.progressInterval = setInterval(() => {
      try {
        const currentTime = player.getCurrentTime ? player.getCurrentTime() : 0;
        if (!continuous && durationSeconds > 0) {
          const bounded = Math.min(durationSeconds, Math.max(0, currentTime));
          if (onProgress) {
            onProgress(bounded, bounded / durationSeconds);
          }
          // Yazılımsal Güvenlik Eşiği: Eğer YouTube endSeconds tetiklemesi milisaniyelik gecikirse kesin durdur
          if (currentTime >= durationSeconds) {
            this.stopClip();
          }
        } else {
          const duration = player.getDuration ? player.getDuration() : 180;
          if (onProgress) {
            onProgress(currentTime, duration > 0 ? Math.min(1, currentTime / duration) : 0);
          }
        }
      } catch {}
    }, 50);

    // 2. Yazılımsal Güvenlik Zaman Aşımı (Watchdog)
    // Sadece ses başladıktan SONRA durationSeconds + 0.35s kadar bekler!
    if (!continuous && durationSeconds > 0) {
      this.clipTimeout = setTimeout(() => {
        this.stopClip();
      }, (durationSeconds + 0.35) * 1000);
    }
  }

  /**
   * Şarkıyı kaldığı saniyeden sürekli çalmaya devam ettirir (Doğru tahmin / Pes etme anı).
   */
  public async resumeContinuous(onProgress?: AudioProgressCallback): Promise<boolean> {
    try {
      const player = await this.ensurePlayer();
      this.clearTimers();
      this.activeOnEndCallback = null;
      this.isPlaying = true;

      // Kısıtlama olmadan tüm parçayı çalmak için endSeconds olmadan load veya play
      const current = player.getCurrentTime ? player.getCurrentTime() : 0;
      if (this.currentVideoId) {
        player.loadVideoById({
          videoId: this.currentVideoId,
          startSeconds: current,
        });
      } else {
        player.playVideo?.();
      }

      this.progressInterval = setInterval(() => {
        try {
          const currentTime = player.getCurrentTime ? player.getCurrentTime() : 0;
          const duration = player.getDuration ? player.getDuration() : 180;
          if (onProgress) {
            onProgress(currentTime, duration > 0 ? Math.min(1, currentTime / duration) : 0);
          }
        } catch {}
      }, 100);

      return true;
    } catch (err) {
      console.error('❌ [YouTubePlayerService] resumeContinuous hatası:', err);
      this.isPlaying = false;
      return false;
    }
  }

  /**
   * Şarkıyı duraklatır
   */
  public pauseClip(): void {
    this.clearTimers();
    this.isPlaying = false;
    if (this.player) {
      try {
        this.player.pauseVideo?.();
      } catch {}
    }
  }

  /**
   * Şarkıyı tamamen durdurur ve durumu sonlandırır.
   */
  public stopClip(): void {
    this.clearTimers();
    const callback = this.activeOnEndCallback;
    this.activeOnEndCallback = null;
    this.isPlaying = false;

    if (this.player) {
      try {
        this.player.pauseVideo?.();
        this.player.stopVideo?.();
      } catch {}
    }

    if (callback) {
      try {
        callback();
      } catch {}
    }
  }

  public setVolume(volume: number): void {
    this.currentVolume = Math.round(Math.max(0, Math.min(1, volume)) * 100);
    if (this.player) {
      try {
        this.player.setVolume(this.currentVolume);
      } catch {}
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.player) {
      try {
        if (this.isMuted) {
          this.player.mute();
        } else {
          this.player.unMute();
        }
      } catch {}
    }
    return this.isMuted;
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  private clearTimers(): void {
    if (this.progressInterval !== null) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
    if (this.clipTimeout !== null) {
      clearTimeout(this.clipTimeout);
      this.clipTimeout = null;
    }
    if (this.playbackStartTimeout !== null) {
      clearTimeout(this.playbackStartTimeout);
      this.playbackStartTimeout = null;
    }
    this.pendingPlaybackStart = null;
  }

  public destroy(): void {
    this.clearTimers();
    if (this.player) {
      try {
        this.player.destroy();
      } catch {}
      this.player = null;
    }
    this.playerReadyPromise = null;
  }
}

export const youtubePlayerService = new YouTubePlayerService();
