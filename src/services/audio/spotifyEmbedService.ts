import type {
  SpotifyEmbedController,
  SpotifyEmbedPlaybackUpdate,
  SpotifyIFrameAPI,
} from '@/types/spotify';

type ProgressCallback = (currentSeconds: number, progressRatio: number) => void;

/**
 * Spotify Embed Service
 * Spotify iFrame API (https://open.spotify.com/embed/iframe-api/v1) ve Embed Player'ı yönetir.
 * Deezer yerine resmi Spotify ses/oynatıcı entegrasyonu sağlar.
 */
class SpotifyEmbedService {
  private controller: SpotifyEmbedController | null = null;
  private isApiReady: boolean = false;
  private apiReadyPromise: Promise<SpotifyIFrameAPI> | null = null;
  private isPlaying: boolean = false;
  private stopTimeoutId: number | null = null;
  private currentProgressCallback: ProgressCallback | null = null;
  private currentTrackUri: string | null = null;
  private targetDuration: number = 0;
  private clipStartTime: number = 0;
  private animationFrameId: number | null = null;
  private lastPlayTime: number = 0;
  private pausedElapsed: number = 0;

  /**
   * Spotify iFrame API scriptini dinamik olarak yükler ve hazır olduğunda IFrameAPI örneğini döner.
   */
  public async loadIFrameApi(): Promise<SpotifyIFrameAPI> {
    if (this.isApiReady && window.SpotifyIFrameApi) {
      return window.SpotifyIFrameApi;
    }

    if (this.apiReadyPromise) {
      return this.apiReadyPromise;
    }

    this.apiReadyPromise = new Promise<SpotifyIFrameAPI>((resolve) => {
      // Zaten window'da hazır mı?
      if (window.SpotifyIFrameApi) {
        this.isApiReady = true;
        resolve(window.SpotifyIFrameApi);
        return;
      }

      const existingCallback = window.onSpotifyIframeApiReady;
      window.onSpotifyIframeApiReady = (IFrameAPI: SpotifyIFrameAPI) => {
        window.SpotifyIFrameApi = IFrameAPI;
        this.isApiReady = true;
        if (existingCallback) existingCallback(IFrameAPI);
        resolve(IFrameAPI);
      };

      // Script zaten sayfaya eklenmiş mi?
      const existingScript = document.querySelector('script[src*="iframe-api"]');
      if (!existingScript) {
        const script = document.createElement('script');
        script.src = 'https://open.spotify.com/embed/iframe-api/v1';
        script.async = true;
        document.body.appendChild(script);
      }
    });

    return this.apiReadyPromise;
  }

  /**
   * Belirtilen DOM elementine bir Spotify Embed Controller bağlar.
   */
  public async createController(
    element: HTMLElement,
    trackUriOrId: string,
    options: { width?: number | string; height?: number | string } = {}
  ): Promise<SpotifyEmbedController> {
    const api = await this.loadIFrameApi();
    const uri = this.formatUri(trackUriOrId);

    return new Promise((resolve) => {
      api.createController(
        element,
        {
          uri,
          width: options.width ?? '100%',
          height: options.height ?? 152,
        },
        (controller) => {
          this.controller = controller;
          this.currentTrackUri = uri;

          // Dinleyiciyi kaydet
          controller.addListener('playback_update', this.handlePlaybackUpdate);

          resolve(controller);
        }
      );
    });
  }

  private isContinuous: boolean = false;
  private isTrackReady: boolean = false;
  private trackReadyListeners: ((e: SpotifyEmbedPlaybackUpdate) => void)[] = [];
  private hasStartedPlaying: boolean = false;
  private onEndCallback: (() => void) | null = null;
  private safetyTimeoutId: number | null = null;
  private timerFallbackId: number | null = null;

  // Sıfırıncı Saniye Pre-buffer (Priming) ve Lisans Optimizasyonu
  private isPriming: boolean = false;
  private isPrimed: boolean = false;
  private primeResolve: (() => void) | null = null;
  private primeTimeoutId: number | null = null;
  private primedUris = new Set<string>();

  private controllerPromise: Promise<SpotifyEmbedController> | null = null;

  /**
   * Varsayılan arka plan oynatıcı elementini oluşturur (viewport içi, görünmez ve kırpılmış container).
   * Not: Tarayıcıların ekran dışı (-9999px) iframe throttling yapmaması için viewport içinde
   * (bottom: 0, right: 0) tutulur; clip ile görsel olarak tamamen gizlenir.
   */
  public async ensureHiddenController(initialUri?: string): Promise<SpotifyEmbedController> {
    if (this.controller) {
      return this.controller;
    }
    if (this.controllerPromise) {
      return this.controllerPromise;
    }

    let container = document.getElementById('spotify-embed-background-player');
    if (!container) {
      container = document.createElement('div');
      container.id = 'spotify-embed-background-player';
      container.setAttribute('aria-hidden', 'true');
      container.style.position = 'fixed';
      container.style.bottom = '0';
      container.style.right = '0';
      container.style.width = '1px';
      container.style.height = '1px';
      container.style.opacity = '0.001';
      container.style.pointerEvents = 'none';
      container.style.zIndex = '-9999';
      container.style.overflow = 'hidden';
      container.style.clip = 'rect(0, 0, 0, 0)';
      document.body.appendChild(container);
    }

    // Spotify createController hedef elementi doğrudan iframe ile değiştirdiği için,
    // wrapper'ın kendisinin ezilmemesi amacıyla içine bir yuva (slot) elementi koyuyoruz.
    let slot = container.querySelector('#spotify-embed-slot') as HTMLElement | null;
    if (!slot) {
      slot = document.createElement('div');
      slot.id = 'spotify-embed-slot';
      container.appendChild(slot);
    }

    const defaultUri = initialUri ? this.formatUri(initialUri) : 'spotify:track:4cOdK2wGLETKBW3PvgPWqT';
    if (initialUri) {
      this.currentTrackUri = defaultUri;
    }

    this.controllerPromise = this.createController(slot, defaultUri, {
      width: 1,
      height: 1,
    })
      .then((controller) => {
        this.controllerPromise = null;
        const iframe = container?.querySelector('iframe');
        if (iframe) {
          iframe.style.width = '1px';
          iframe.style.height = '1px';
          iframe.style.opacity = '0.001';
          iframe.style.pointerEvents = 'none';
          iframe.tabIndex = -1;
          iframe.setAttribute('aria-hidden', 'true');
          iframe.setAttribute('allow', 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture');
        }
        return controller;
      })
      .catch((err) => {
        this.controllerPromise = null;
        throw err;
      });

    return this.controllerPromise;
  }

  /**
   * Parçayı Spotify Embed'e yükler ve 0. saniyeye (en başa) hazırlar.
   * Kesinlikle arka planda play() ÇAĞRILMAZ.
   * Böylece ilk şarkı çekildiğinde oluşan 'Get Spotify' uyarısı ve tarayıcı autoplay engelleri tamamen önlenir.
   */
  public async loadTrack(trackUriOrId: string): Promise<void> {
    const uri = this.formatUri(trackUriOrId);
    const controller = await this.ensureHiddenController(uri);

    if (this.currentTrackUri === uri && this.isTrackReady) {
      try {
        controller.seek(0);
      } catch { }
      return;
    }

    this.currentTrackUri = uri;
    this.isTrackReady = false;
    this.isPrimed = true;

    try {
      controller.loadUri(uri);
      // Şarkının 00:00 konumunda başlaması için seek(0) emri gönder
      window.setTimeout(() => {
        try {
          controller.seek(0);
          this.isTrackReady = true;
        } catch { }
      }, 250);
    } catch (err) {
      console.warn('⚠️ [SpotifyEmbed] loadUri hatası:', err);
    }
  }

  /**
   * Geriye dönük uyumluluk: loadTrack fonksiyonunu çağırır.
   */
  public async primeTrack(trackUriOrId: string): Promise<void> {
    await this.loadTrack(trackUriOrId);
  }

  /**
   * Spotify Embed ile belirtilen saniye kadar klip oynatır.
   * UX İllüzyonu: Parça primed ise anında başlar; gecikme olsa dahi süre sayacı
   * tam ses çıktığında (playback_update !isPaused) başlar.
   */
  public async playClip(
    trackUriOrId: string,
    durationSeconds: number,
    onEnd?: () => void,
    onProgress?: ProgressCallback,
    continuous: boolean = false
  ): Promise<boolean> {
    // Çok hızlı ardışık çift tıklamaları engelle
    const now = performance.now();
    if (now - this.lastPlayTime < 150) {
      return true;
    }
    this.lastPlayTime = now;

    // Eğer o anda priming sürüyorsa sonlandırıp gerçek oynatmaya devret
    if (this.isPriming) {
      if (this.primeTimeoutId !== null) {
        clearTimeout(this.primeTimeoutId);
        this.primeTimeoutId = null;
      }
      this.isPriming = false;
      if (this.primeResolve) {
        this.primeResolve();
      }
    }

    this.stopClip();
    this.isPlaying = true;
    this.isContinuous = continuous;
    this.hasStartedPlaying = false;
    this.pausedElapsed = 0;
    this.targetDuration = durationSeconds;
    this.currentProgressCallback = onProgress || null;
    this.onEndCallback = onEnd || null;

    try {
      const uri = this.formatUri(trackUriOrId);

      // Şarkı henüz hazır değilse yükle
      if (this.currentTrackUri !== uri || !this.isTrackReady) {
        await this.loadTrack(uri);
      }

      const controller = await this.ensureHiddenController(uri);

      // Her oynatma başında şarkıyı kesinlikle 0. saniyeye (en başa) sar
      try {
        controller.seek(0);
      } catch { }

      // Şarkıyı başlat
      controller.play();

      // UI/UX Optimizasyonu:
      // Sayacı hemen başlatmıyoruz. handlePlaybackUpdate içinde !isPaused geldiği
      // mikrosaniyede startPlaybackTimer() devreye girer.
      // Her ihtimale karşı 1.2s'lik emniyet zamanlayıcısı koyuyoruz:
      this.timerFallbackId = window.setTimeout(() => {
        if (this.isPlaying && !this.hasStartedPlaying) {
          this.startPlaybackTimer();
        }
      }, 1200);

      // Güvenlik zaman aşımı: Eğer ağ veya iframe hiç başlamazsa, döngüyü kırmak için sıfırla (kesintisiz modda uygulanmaz)
      if (!continuous) {
        const maxWait = Math.max(durationSeconds + 6, 10);
        this.safetyTimeoutId = window.setTimeout(() => {
          if (!this.hasStartedPlaying && this.isPlaying) {
            console.warn('⚠️ [SpotifyEmbed] Oynatma zaman aşımına uğradı, iframe sıfırlanıyor.');
            this.resetController();
            if (this.onEndCallback) {
              const cb = this.onEndCallback;
              this.onEndCallback = null;
              cb();
            }
          }
        }, maxWait * 1000);
      }

      return true;
    } catch (err) {
      console.error('❌ [SpotifyEmbedService] playClip hatası:', err);
      this.stopClip();
      return false;
    }
  }

  /**
   * Ses fiziksel olarak hoparlörden çıkmaya başladığında sayacı ve durdurma zamanlayıcısını başlatır.
   */
  private startPlaybackTimer(): void {
    if (!this.isPlaying || this.hasStartedPlaying) return;

    if (this.timerFallbackId !== null) {
      clearTimeout(this.timerFallbackId);
      this.timerFallbackId = null;
    }

    this.hasStartedPlaying = true;
    this.clipStartTime = performance.now() - (this.pausedElapsed * 1000);

    const updateProgress = () => {
      if (!this.isPlaying) return;
      const elapsed = (performance.now() - this.clipStartTime) / 1000;

      if (this.isContinuous) {
        if (this.currentProgressCallback) {
          this.currentProgressCallback(elapsed, (elapsed % 30) / 30);
        }
        this.animationFrameId = requestAnimationFrame(updateProgress);
        return;
      }

      const clamped = Math.min(this.targetDuration, Math.max(0, elapsed));
      const ratio = this.targetDuration > 0 ? clamped / this.targetDuration : 0;

      if (this.currentProgressCallback) {
        this.currentProgressCallback(clamped, ratio);
      }

      if (elapsed < this.targetDuration) {
        this.animationFrameId = requestAnimationFrame(updateProgress);
      }
    };

    this.animationFrameId = requestAnimationFrame(updateProgress);

    if (!this.isContinuous) {
      const remainingDuration = Math.max(0, this.targetDuration - this.pausedElapsed);
      const playDurationMs = remainingDuration * 1000;

      this.stopTimeoutId = window.setTimeout(() => {
        if (this.currentProgressCallback) {
          this.currentProgressCallback(this.targetDuration, 1);
        }
        const cb = this.onEndCallback;
        this.stopClip();
        if (cb) {
          cb();
        }
      }, playDurationMs);
    }
  }

  /**
   * Çalan şarkıyı sıfırlamadan (en başa sarmadan), kaldığı saniyede duraklatır.
   */
  public pauseClip(): void {
    if (this.timerFallbackId !== null) {
      clearTimeout(this.timerFallbackId);
      this.timerFallbackId = null;
    }

    if (this.stopTimeoutId !== null) {
      clearTimeout(this.stopTimeoutId);
      this.stopTimeoutId = null;
    }

    if (this.safetyTimeoutId !== null) {
      clearTimeout(this.safetyTimeoutId);
      this.safetyTimeoutId = null;
    }

    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.hasStartedPlaying) {
      this.pausedElapsed = Math.max(0, (performance.now() - this.clipStartTime) / 1000);
    }

    this.isPlaying = false;
    this.hasStartedPlaying = false;

    if (this.controller) {
      try {
        // Kesinlikle seek(0) YAPILMAZ! Sadece pause edilir.
        this.controller.pause();
      } catch {
        // Sessiz hata tolere
      }
    }

    const container = document.getElementById('spotify-embed-background-player');
    if (container) {
      const iframe = container.querySelector('iframe') as HTMLIFrameElement | null;
      if (iframe && iframe.contentWindow) {
        try {
          iframe.contentWindow.postMessage({ command: 'pause' }, '*');
        } catch { }
      }
    }
  }

  /**
   * Duraklatılan kesintisiz şarkıyı kaldığı saniyeden devam ettirir (en başa sarmaz).
   */
  public async resumeContinuous(onProgress?: ProgressCallback): Promise<boolean> {
    if (!this.controller || !this.currentTrackUri) {
      return false;
    }

    this.isPlaying = true;
    this.isContinuous = true;
    this.hasStartedPlaying = false;
    if (onProgress) {
      this.currentProgressCallback = onProgress;
    }

    try {
      // Kesinlikle seek(0) ÇAĞRILMAZ, doğrudan play/resume emri verilir
      this.controller.play();

      this.timerFallbackId = window.setTimeout(() => {
        if (this.isPlaying && !this.hasStartedPlaying) {
          this.startPlaybackTimer();
        }
      }, 1200);

      return true;
    } catch (err) {
      console.error('❌ [SpotifyEmbedService] resumeContinuous hatası:', err);
      return false;
    }
  }

  /**
   * Çalan klibi kesin olarak durdurur ve bir sonraki deneme için 00:00 (en başa) sarar.
   */
  public stopClip(): void {
    if (this.timerFallbackId !== null) {
      clearTimeout(this.timerFallbackId);
      this.timerFallbackId = null;
    }

    if (this.stopTimeoutId !== null) {
      clearTimeout(this.stopTimeoutId);
      this.stopTimeoutId = null;
    }

    if (this.safetyTimeoutId !== null) {
      clearTimeout(this.safetyTimeoutId);
      this.safetyTimeoutId = null;
    }

    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    this.isPlaying = false;
    this.isContinuous = false;
    this.hasStartedPlaying = false;
    this.onEndCallback = null;
    this.pausedElapsed = 0;

    if (this.controller) {
      try {
        // Durdurulduğunda hemen pause et ve bir sonraki deneme için 00:00 (en başa) sar
        this.controller.pause();
        this.controller.seek(0);
      } catch {
        // Sessiz hata tolere
      }
    }

    // İframe'e postMessage ile de durdurma emri gönder (çift güvenlik)
    const container = document.getElementById('spotify-embed-background-player');
    if (container) {
      const iframe = container.querySelector('iframe') as HTMLIFrameElement | null;
      if (iframe && iframe.contentWindow) {
        try {
          iframe.contentWindow.postMessage({ command: 'pause' }, '*');
        } catch { }
      }
    }
  }

  /**
   * Spotify Embed iframe'ini ve controller'ı tamamen sıfırlar.
   * 429 hatası veya aşırı retry döngüsünü anında kırar.
   */
  public resetController(): void {
    this.stopClip();
    this.isContinuous = false;
    this.pausedElapsed = 0;
    if (this.primeTimeoutId !== null) {
      clearTimeout(this.primeTimeoutId);
      this.primeTimeoutId = null;
    }
    if (this.timerFallbackId !== null) {
      clearTimeout(this.timerFallbackId);
      this.timerFallbackId = null;
    }
    this.isPriming = false;
    this.isPrimed = false;
    this.primedUris.clear();
    if (this.controller) {
      try {
        this.controller.destroy();
      } catch { }
      this.controller = null;
    }
    this.controllerPromise = null;
    const container = document.getElementById('spotify-embed-background-player');
    if (container) {
      container.innerHTML = '';
    }
    this.currentTrackUri = null;
    this.isTrackReady = false;
    console.log('🔄 [SpotifyEmbed] Iframe ve controller temizlendi (429 döngüsü kırıldı).');
  }

  /**
   * Standart Embed iframe URL'i üretir.
   */
  public getEmbedUrl(trackId: string, theme: '0' | '1' = '0'): string {
    const cleanId = trackId.replace('spotify:track:', '');
    return `https://open.spotify.com/embed/track/${cleanId}?utm_source=generator&theme=${theme}`;
  }

  public getController(): SpotifyEmbedController | null {
    return this.controller;
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  public getIsTrackReady(): boolean {
    return this.isTrackReady;
  }

  public getIsPrimed(): boolean {
    return this.isPrimed;
  }

  /**
   * Spotify Embed Oynatıcı Durum Takibi
   */
  private handlePlaybackUpdate = (e: SpotifyEmbedPlaybackUpdate) => {
    if (!e?.data) return;
    const { isPaused, position, isBuffering } = e.data;

    // Hazır olma dinleyicilerini bilgilendir
    this.trackReadyListeners.forEach((listener) => {
      try {
        listener(e);
      } catch { }
    });

    // 1. UI/UX Senkronizasyonu:
    // Süre sayacı butona basıldığı anda değil, ses fiziksel olarak başladığı anda (isPaused: false) tetiklenir
    if (this.isPlaying && !isPaused && !this.hasStartedPlaying) {
      this.startPlaybackTimer();
    }

    // 2. Durdurulmuşken Spotify sonradan kendiliğinden çalmaya başladıysa durdur ve 0'a sar
    if (!this.isPlaying && !isPaused) {
      try {
        this.controller?.pause();
        this.controller?.seek(0);
      } catch { }
      return;
    }

    // 3. Kesintisiz oynatma modundayken parça/önizleme bittiğinde başa sarıp kesintisiz çalmaya devam et
    if (this.isPlaying && this.isContinuous && isPaused && this.hasStartedPlaying) {
      try {
        this.controller?.seek(0);
        this.controller?.play();
      } catch { }
      return;
    }
  };

  private formatUri(idOrUri: string): string {
    if (idOrUri.startsWith('spotify:')) {
      return idOrUri;
    }
    return `spotify:track:${idOrUri}`;
  }
}

export const spotifyEmbedService = new SpotifyEmbedService();
