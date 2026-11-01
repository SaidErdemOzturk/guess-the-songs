import type { Song } from '@/types/song';
import { youtubePlayerService } from '@/services/audio/youtubePlayerService';
import { resolveYouTubeId } from '@/services/audio/youtubeResolver';
import { cleanTurkishText } from '@/utils/formatters';

export type AudioProgressCallback = (currentSeconds: number, progressRatio: number) => void;

const GENERIC_CHANNELS = [
  'netd muzik',
  'netd',
  'poll production',
  'dmc',
  'dogan music',
  'avrupa muzik',
  'sony music',
  'universal music',
  'warner music',
  'mahzen media',
  'hypers',
  'pasaj muzik',
  'dokuz sekiz',
  'vevo',
  'topic',
  'various artists',
  'youtube',
  'sanatci',
];

function cleanSearchTerm(raw: string): string {
  return raw
    .replace(/\s*-\s*topic$/i, '')
    .replace(/vevo$/i, '')
    .replace(/\s*[([].*?[)\]]/g, ' ')
    .replace(/\b(feat|ft|prod)\.?\b.*$/i, ' ')
    .replace(/\b(official|video|audio|klip|lyrics|lyric|hd|4k|remastered|remaster|visualizer|live|akustik|acoustic)\b/gi, ' ')
    .replace(/[|"'“”‘’]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Web Audio Service
 * Mobil cihazlarda (iOS Dynamic Island / Denetim Merkezi / Kilit Ekranı ve Android Bildirim Çubuğu)
 * YouTube oynatıcısının aktifleşip şarkı adını/kapak fotoğrafını sızdırmasını %100 engellemek için
 * şarkıları HTML5 <video>/<iframe> yerine doğrudan Web Audio API (AudioContext + AudioBufferSourceNode)
 * üzerinden çalar.
 */
class WebAudioService {
  private audioCtx: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private activeSourceNode: AudioBufferSourceNode | null = null;

  private audioBufferCache = new Map<string, AudioBuffer>();
  private inFlightPreloads = new Map<string, Promise<AudioBuffer | null>>();

  private isPlaying: boolean = false;
  private globalVolume: number = 0.75;
  private isMuted: boolean = false;

  private activeSongKey: string | null = null;
  private activeBuffer: AudioBuffer | null = null;
  private playbackStartCtxTime: number = 0;
  private playbackOffsetSeconds: number = 0;
  private pausedAtSeconds: number = 0;

  private progressInterval: ReturnType<typeof setInterval> | null = null;
  private clipTimeout: ReturnType<typeof setTimeout> | null = null;
  private activeOnEndCallback: (() => void) | null = null;
  private playSessionId: number = 0;

  private errorListeners = new Set<(videoId: string, errorCode: number) => void>();

  constructor() {
    if (typeof window !== 'undefined') {
      const unlock = () => {
        this.ensureAudioContext(true);
        this.maskMediaSession();
      };
      window.addEventListener('touchstart', unlock, { passive: true, once: true });
      window.addEventListener('touchend', unlock, { passive: true, once: true });
      window.addEventListener('click', unlock, { passive: true, once: true });
    }
  }

  /**
   * Mobil işletim sisteminin (iOS / Android) üst bildirim çubuğunda veya kilit ekranında
   * herhangi bir şarkı bilgisinin görünmesini engeller.
   */
  private maskMediaSession(): void {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: 'Şarkıyı Tahmin Et',
        artist: 'Gizli Parça 🎵',
        album: 'Guess The Song',
        artwork: [],
      });
      navigator.mediaSession.playbackState = 'none';
    } catch {
      // Desteklenmeyen tarayıcılarda yoksay
    }
  }

  /**
   * Web Audio API AudioContext nesnesini hazırlar ve iOS Safari ses kilidini açar.
   */
  private ensureAudioContext(unlockSilent: boolean = false): AudioContext | null {
    if (typeof window === 'undefined') return null;

    if (!this.audioCtx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;

      this.audioCtx = new AudioCtx();
      this.gainNode = this.audioCtx.createGain();
      this.gainNode.gain.value = this.isMuted ? 0 : this.globalVolume;
      this.gainNode.connect(this.audioCtx.destination);
    }

    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }

    if (unlockSilent && this.audioCtx) {
      try {
        const silentBuffer = this.audioCtx.createBuffer(1, 1, 22050);
        const src = this.audioCtx.createBufferSource();
        src.buffer = silentBuffer;
        src.connect(this.audioCtx.destination);
        src.start(0);
      } catch {
        // Yoksay
      }
    }

    return this.audioCtx;
  }

  private getSongCacheKey(song: Song): string {
    const videoId = song.youtubeId || resolveYouTubeId(song);
    if (videoId) return `yt_${videoId}`;
    return `song_${song.id}_${song.artist}_${song.title}`;
  }

  /**
   * Şarkı için iTunes AAC CDN'inden en uygun önizleme ses URL'sini bulur.
   */
  private async resolvePreviewAudioUrl(song: Song): Promise<string | null> {
    if (song.previewUrl) return song.previewUrl;

    let rawArtist = cleanSearchTerm(song.artist || '');
    let rawTitle = cleanSearchTerm(song.title || '');

    // Eğer başlık içinde tire ( - / – / — ) varsa ve sanatçı kanal adıysa ayrıştır
    const dashMatch = rawTitle.match(/^(.+?)\s*[-–—]\s*(.+)$/);
    const normArtistCheck = cleanTurkishText(rawArtist);
    const isGenericChannel = GENERIC_CHANNELS.some((ch) => normArtistCheck.includes(ch));

    if (dashMatch && (!rawArtist || isGenericChannel)) {
      rawArtist = cleanSearchTerm(dashMatch[1]);
      rawTitle = cleanSearchTerm(dashMatch[2]);
    } else if (isGenericChannel) {
      rawArtist = '';
    }

    const queries: string[] = [];
    if (rawArtist && rawTitle) {
      queries.push(`${rawArtist} ${rawTitle}`);
    }
    if (rawTitle) {
      queries.push(rawTitle);
    }

    const normTargetTitle = cleanTurkishText(rawTitle || song.title || '');
    const normTargetArtist = cleanTurkishText(rawArtist || '');
    const titleWords = normTargetTitle.split(/\s+/).filter((w) => w.length >= 2);
    const artistWords = normTargetArtist.split(/\s+/).filter((w) => w.length >= 2);

    const countries = song.region === 'global' ? ['us', 'tr'] : ['tr', 'us'];

    for (const q of queries) {
      for (const country of countries) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3500);
        try {
          const url = `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=music&entity=song&limit=8&country=${country}`;
          const res = await fetch(url, { signal: controller.signal });
          clearTimeout(timeout);
          if (!res.ok) continue;

          const data = await res.json();
          const results: any[] = data?.results || [];
          if (results.length === 0) continue;

          // En iyi eşleşen şarkıyı puanla
          let bestItem: any = null;
          let bestScore = -1;

          for (const item of results) {
            if (!item.previewUrl) continue;
            const itemTitle = cleanTurkishText(item.trackName || '');
            const itemArtist = cleanTurkishText(item.artistName || '');
            const combined = `${itemArtist} ${itemTitle}`;

            let score = 0;
            for (const w of titleWords) {
              if (itemTitle.includes(w)) score += 3;
              else if (combined.includes(w)) score += 1;
            }
            for (const w of artistWords) {
              if (itemArtist.includes(w)) score += 3;
              else if (combined.includes(w)) score += 1;
            }

            if (score > bestScore) {
              bestScore = score;
              bestItem = item;
            }
          }

          if (bestItem?.previewUrl) {
            song.previewUrl = bestItem.previewUrl;
            return bestItem.previewUrl;
          }
        } catch {
          clearTimeout(timeout);
        }
      }
    }

    return null;
  }

  /**
   * Yedek olarak Invidious CORS-açık ses akışından ilk ~20 saniyelik AAC verisini çeker.
   */
  private async fetchInvidiousAudioArrayBuffer(videoId: string): Promise<ArrayBuffer | null> {
    if (!videoId) return null;
    const instances = [
      'https://inv.nadeko.net',
      'https://invidious.jing.rocks',
      'https://invidious.nerdvpn.de',
    ];

    for (const baseUrl of instances) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      try {
        const streamUrl = `${baseUrl}/latest_version?id=${encodeURIComponent(videoId)}&itag=140&local=true`;
        const res = await fetch(streamUrl, {
          signal: controller.signal,
          headers: {
            Range: 'bytes=0-400000',
          },
        });
        clearTimeout(timeout);
        if (res.ok || res.status === 206) {
          const buf = await res.arrayBuffer();
          if (buf.byteLength > 8192) {
            return buf;
          }
        }
      } catch {
        clearTimeout(timeout);
      }
    }
    return null;
  }

  /**
   * Şarkının ses dosyasını indirir ve Web Audio API AudioBuffer nesnesine dönüştürür.
   */
  private async loadAndDecodeSong(song: Song): Promise<AudioBuffer | null> {
    const cacheKey = this.getSongCacheKey(song);

    if (this.audioBufferCache.has(cacheKey)) {
      return this.audioBufferCache.get(cacheKey)!;
    }

    if (this.inFlightPreloads.has(cacheKey)) {
      return this.inFlightPreloads.get(cacheKey)!;
    }

    const promise = (async (): Promise<AudioBuffer | null> => {
      const ctx = this.ensureAudioContext(false);
      if (!ctx) return null;

      // 1. Öncelik: iTunes AAC (.m4a) yüksek hızlı CORS-açık ses akışı
      const previewUrl = await this.resolvePreviewAudioUrl(song);
      if (previewUrl) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 5000);
          const response = await fetch(previewUrl, { signal: controller.signal });
          clearTimeout(timeout);

          if (response.ok) {
            const arrayBuffer = await response.arrayBuffer();
            const decoded = await ctx.decodeAudioData(arrayBuffer.slice(0));
            this.audioBufferCache.set(cacheKey, decoded);
            return decoded;
          }
        } catch (err) {
          console.warn('[WebAudioService] Önizleme sesi decode edilemedi:', err);
        }
      }

      // 2. Yedek: Invidious doğrudan ses akışı
      const videoId = song.youtubeId || resolveYouTubeId(song);
      if (videoId) {
        const invBuffer = await this.fetchInvidiousAudioArrayBuffer(videoId);
        if (invBuffer) {
          try {
            const decoded = await ctx.decodeAudioData(invBuffer.slice(0));
            this.audioBufferCache.set(cacheKey, decoded);
            return decoded;
          } catch {
            // Decode başarısızsa devam et
          }
        }
      }

      return null;
    })();

    this.inFlightPreloads.set(cacheKey, promise);
    try {
      return await promise;
    } finally {
      this.inFlightPreloads.delete(cacheKey);
    }
  }

  /**
   * Sıradaki şarkının ses verisini arka planda indirir ve Web Audio API için hazırlar.
   */
  public async preloadSong(song: Song): Promise<boolean> {
    try {
      const buffer = await this.loadAndDecodeSong(song);
      return Boolean(buffer);
    } catch {
      return false;
    }
  }

  /**
   * Şarkının ses tamponunun (AudioBuffer) hazır olup olmadığını döner.
   */
  public isSongEmbedReady(song?: Song | null): boolean {
    if (!song) return false;
    return this.audioBufferCache.has(this.getSongCacheKey(song));
  }

  /**
   * Şarkı kesitini Web Audio API (AudioBufferSourceNode) üzerinden çalar.
   * Hiçbir YouTube iframe'i veya <video>/<audio> etiketi tetiklenmez; telefonun üst kısmında
   * YouTube bildirimi veya şarkı adı kesinlikle görünmez.
   */
  public async playSongClip(
    song: Song,
    durationInSeconds: number,
    onEnd?: () => void,
    onProgress?: AudioProgressCallback
  ): Promise<void> {
    this.stopCurrentAudio();
    const sessionId = ++this.playSessionId;
    this.isPlaying = true;
    this.maskMediaSession();

    const ctx = this.ensureAudioContext(false);
    const buffer = await this.loadAndDecodeSong(song);

    // Bekleme sırasında kullanıcı durdurduysa veya başka bir çalma başlattıysa iptal et
    if (sessionId !== this.playSessionId || !this.isPlaying) {
      return;
    }

    if (!ctx || !buffer) {
      const videoId = song.youtubeId || resolveYouTubeId(song);
      console.warn(`⚠️ [WebAudio] "${song.artist} - ${song.title}" için Web Audio tamponu oluşturulamadı.`);
      this.isPlaying = false;
      if (videoId) {
        youtubePlayerService.markVideoUnplayable(videoId);
        this.notifyPlaybackError(videoId, 150);
      }
      if (onEnd) onEnd();
      return;
    }

    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {}
    }

    this.activeSongKey = this.getSongCacheKey(song);
    this.activeBuffer = buffer;
    this.pausedAtSeconds = 0;

    this.startBufferPlayback(buffer, 0, durationInSeconds, false, onEnd, onProgress);
  }

  /**
   * Şarkıyı kullanıcı sonraki şarkıya geçene kadar kesintisiz çalar.
   */
  public async playSongContinuous(
    song: Song,
    onProgress?: AudioProgressCallback
  ): Promise<void> {
    this.stopCurrentAudio();
    const sessionId = ++this.playSessionId;
    this.isPlaying = true;
    this.maskMediaSession();

    const ctx = this.ensureAudioContext(false);
    const buffer = await this.loadAndDecodeSong(song);

    if (sessionId !== this.playSessionId || !this.isPlaying || !ctx || !buffer) {
      this.isPlaying = false;
      return;
    }

    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {}
    }

    this.activeSongKey = this.getSongCacheKey(song);
    this.activeBuffer = buffer;
    this.pausedAtSeconds = 0;

    this.startBufferPlayback(buffer, 0, buffer.duration, true, undefined, onProgress);
  }

  private startBufferPlayback(
    buffer: AudioBuffer,
    offsetSeconds: number,
    durationSeconds: number,
    continuous: boolean,
    onEnd?: () => void,
    onProgress?: AudioProgressCallback
  ): void {
    const ctx = this.ensureAudioContext(false);
    if (!ctx || !this.gainNode) return;

    this.clearTimers();
    this.activeOnEndCallback = onEnd || null;

    const safeOffset = Math.max(0, Math.min(offsetSeconds, Math.max(0, buffer.duration - 0.1)));
    const maxRemaining = Math.max(0.1, buffer.duration - safeOffset);
    const effectiveDuration = continuous
      ? maxRemaining
      : Math.min(durationSeconds > 0 ? durationSeconds : maxRemaining, maxRemaining);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.gainNode);

    this.gainNode.gain.setValueAtTime(this.isMuted ? 0 : this.globalVolume, ctx.currentTime);

    this.activeSourceNode = source;
    this.playbackStartCtxTime = ctx.currentTime;
    this.playbackOffsetSeconds = safeOffset;
    this.isPlaying = true;
    this.maskMediaSession();

    if (onProgress) {
      onProgress(safeOffset, continuous ? safeOffset / buffer.duration : 0);
    }

    source.start(0, safeOffset, effectiveDuration);

    const targetTotalDuration = continuous ? buffer.duration : durationSeconds;

    this.progressInterval = setInterval(() => {
      if (!this.isPlaying || !this.audioCtx) return;
      const elapsed = this.audioCtx.currentTime - this.playbackStartCtxTime;
      const currentPos = continuous ? safeOffset + elapsed : elapsed;
      const bounded = Math.min(targetTotalDuration, Math.max(0, currentPos));
      if (onProgress && targetTotalDuration > 0) {
        onProgress(bounded, Math.min(1, bounded / targetTotalDuration));
      }
    }, 40);

    this.clipTimeout = setTimeout(() => {
      this.finishClipPlayback();
    }, effectiveDuration * 1000 + 40);
  }

  private finishClipPlayback(): void {
    this.clearTimers();
    this.stopSourceNode();
    const callback = this.activeOnEndCallback;
    this.activeOnEndCallback = null;
    this.isPlaying = false;
    this.pausedAtSeconds = 0;

    if (callback) {
      try {
        callback();
      } catch {}
    }
  }

  /**
   * Şarkıyı sıfırlamadan duraklatır.
   */
  public pauseAudio(): void {
    if (this.isPlaying && this.audioCtx) {
      const elapsed = Math.max(0, this.audioCtx.currentTime - this.playbackStartCtxTime);
      this.pausedAtSeconds = this.playbackOffsetSeconds + elapsed;
    }
    this.clearTimers();
    this.stopSourceNode();
    this.isPlaying = false;
  }

  /**
   * Duraklatılan şarkıyı kaldığı saniyeden çalmaya devam ettirir.
   */
  public async resumeAudio(onProgress?: AudioProgressCallback): Promise<void> {
    if (!this.activeBuffer) {
      this.isPlaying = false;
      return;
    }

    const ctx = this.ensureAudioContext(false);
    if (!ctx) {
      this.isPlaying = false;
      return;
    }

    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {}
    }

    const startOffset =
      this.pausedAtSeconds > 0 && this.pausedAtSeconds < this.activeBuffer.duration - 0.2
        ? this.pausedAtSeconds
        : 0;

    this.startBufferPlayback(
      this.activeBuffer,
      startOffset,
      this.activeBuffer.duration - startOffset,
      true,
      undefined,
      onProgress
    );
  }

  /**
   * O an çalan sesi tamamen durdurur.
   */
  public stopCurrentAudio(): void {
    this.playSessionId++;
    this.clearTimers();
    this.stopSourceNode();
    this.activeOnEndCallback = null;
    this.isPlaying = false;
    this.pausedAtSeconds = 0;
    youtubePlayerService.stopClip();
  }

  private stopSourceNode(): void {
    if (this.activeSourceNode) {
      try {
        this.activeSourceNode.onended = null;
        this.activeSourceNode.stop();
        this.activeSourceNode.disconnect();
      } catch {}
      this.activeSourceNode = null;
    }
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
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  public setVolume(volume: number): void {
    this.globalVolume = Math.max(0, Math.min(1, volume));
    if (this.gainNode && this.audioCtx) {
      this.gainNode.gain.setValueAtTime(
        this.isMuted ? 0 : this.globalVolume,
        this.audioCtx.currentTime
      );
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
    if (this.gainNode && this.audioCtx) {
      this.gainNode.gain.setValueAtTime(
        this.isMuted ? 0 : this.globalVolume,
        this.audioCtx.currentTime
      );
    }
    return this.isMuted;
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  private notifyPlaybackError(videoId: string, errorCode: number): void {
    this.errorListeners.forEach((listener) => {
      try {
        listener(videoId, errorCode);
      } catch {}
    });
  }

  /**
   * Oynatma hatası dinleyicisi (Örn: ses akışı bulunamayan parçalarda otomatik geçiş için)
   */
  public onPlaybackError(listener: (videoId: string, errorCode: number) => void): () => void {
    this.errorListeners.add(listener);
    const unsubYt = youtubePlayerService.onPlaybackError(listener);
    return () => {
      this.errorListeners.delete(listener);
      unsubYt();
    };
  }
}

export const webAudioService = new WebAudioService();
