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
  private isPlaying: boolean = false;
  private isMuted: boolean = false;
  private currentVolume: number = 75; // 0 - 100

  private progressInterval: ReturnType<typeof setInterval> | null = null;
  private clipTimeout: ReturnType<typeof setTimeout> | null = null;
  private activeOnEndCallback: (() => void) | null = null;
  private playlistFetchQueue: Promise<any> = Promise.resolve();

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
              console.warn('⚠️ [YouTubePlayerService] Player hatası:', err.data);
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
   * Oynatıcı durum değişikliklerini takip eder
   */
  private handleStateChange(state: YTPlayerState): void {
    // 1: PLAYING, 2: PAUSED, 0: ENDED
    if (state === 1) {
      this.isPlaying = true;
    } else if (state === 0 || state === 2) {
      // YouTube native endSeconds'a ulaştığında ENDED (0) veya PAUSED (2) olur
      if (this.isPlaying && this.activeOnEndCallback) {
        this.stopClip();
      }
    }
  }

  /**
   * YouTube IFrame API ile belirtilen playlist'teki video ID'lerini çeker.
   * Eşzamanlı çağrıların birbirinin cuePlaylist durumunu ezmemesi için sıralı (queue) yürütür.
   */
  public async fetchPlaylistVideoIds(playlistId: string): Promise<string[]> {
    if (!playlistId) return [];

    return new Promise<string[]>((resolve) => {
      this.playlistFetchQueue = this.playlistFetchQueue
        .then(async () => {
          try {
            const player = await this.ensurePlayer();
            const ids = await new Promise<string[]>((res) => {
              let isResolved = false;
              const done = (resultIds: string[]) => {
                if (!isResolved) {
                  isResolved = true;
                  res(resultIds);
                }
              };

              try {
                player.cuePlaylist?.({
                  list: playlistId,
                  listType: 'playlist',
                });
              } catch {
                return done([]);
              }

              const interval = setInterval(() => {
                try {
                  const list = player.getPlaylist?.();
                  if (Array.isArray(list) && list.length > 0) {
                    clearInterval(interval);
                    done(list);
                  }
                } catch {}
              }, 150);

              setTimeout(() => {
                clearInterval(interval);
                try {
                  const list = player.getPlaylist?.();
                  done(Array.isArray(list) ? list : []);
                } catch {
                  done([]);
                }
              }, 1800);
            });
            resolve(ids);
          } catch (err) {
            console.warn('⚠️ [YouTubePlayerService] Playlist çekme hatası:', err);
            resolve([]);
          }
        })
        .catch(() => {
          resolve([]);
        });
    });
  }

  /**
   * Parçayı önceden yükler/kuyruğa alır (sıfır gecikme için)
   */
  public async preloadVideo(videoId: string): Promise<void> {
    if (!videoId) return;
    try {
      const player = await this.ensurePlayer();
      this.currentVideoId = videoId;
      player.cueVideoById({
        videoId,
        startSeconds: 0,
      });
    } catch (err) {
      console.warn('⚠️ [YouTubePlayerService] Preload başarısız:', err);
    }
  }

  /**
   * Şarkının gerçek 00:00 başlangıçlı intro klibini belirtilen süre kadar çalar.
   * YouTube IFrame yerel endSeconds desteği ve çok katmanlı durdurma garantisiyle çalışır.
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

      // 1. YouTube IFrame Yerel startSeconds ve endSeconds
      // YouTube bu parametrelerle videoyu tam olarak durationSeconds süresince çalar ve yerel olarak durdurur.
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

      // 2. Anlık Süre ve İlerleme Takibi (Progress Bar)
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

      // 3. Yazılımsal Güvenlik Zaman Aşımı (Watchdog)
      // Ağ veya iframe takılsa dahi sürenin sonunda sesin çalmaya devam etmesini kesin engeller.
      if (!continuous && durationSeconds > 0) {
        this.clipTimeout = setTimeout(() => {
          this.stopClip();
        }, (durationSeconds + 0.35) * 1000);
      }

      return true;
    } catch (err) {
      console.error('❌ [YouTubePlayerService] playClip hatası:', err);
      this.isPlaying = false;
      return false;
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
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
    if (this.clipTimeout) {
      clearTimeout(this.clipTimeout);
      this.clipTimeout = null;
    }
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
