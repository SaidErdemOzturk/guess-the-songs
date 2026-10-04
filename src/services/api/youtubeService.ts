import type { Song, DifficultyLevel } from '@/types/song';
import { resolveYouTubeId } from '@/services/audio/youtubeResolver';

/**
 * YouTube Music & Video Çalma Listesi Konfigürasyonu
 * Kullanıcı isteği doğrultusunda tüm aşamalar https://music.youtube.com/playlist?list=PLS9pu550w2vc linkindeki
 * 'PLS9pu550w2vc' çalma listesine bağlandı.
 */
export const YOUTUBE_CURATED_PLAYLISTS = {
  // Türkiye Odaklı Çalma Listeleri (Doğrulanmış YouTube Çalma Listeleri)
  TR_KOLAY: 'PLLsaVfnObWeI',
  TR_ORTA: 'PLG9Xzac0lz5M',
  TR_ZOR: 'PLMMc0trqJIMY',
  TR_UZMAN: 'PLMMc0trqJIMY',
  TR_IMKANSIZ: 'PLMMc0trqJIMY',

  // Global Odaklı Çalma Listeleri (Doğrulanmış YouTube Çalma Listeleri)
  GLOBAL_KOLAY: 'PLC1E3ITcHyoE',
  GLOBAL_ORTA: 'PLKtVjsHG3BxY',
  GLOBAL_ZOR: 'PLK-hmgKheaMQ',
  GLOBAL_UZMAN: 'PLK-hmgKheaMQ',
  GLOBAL_IMKANSIZ: 'PLK-hmgKheaMQ',
} as const;

/**
 * YouTube Playlist URL veya ID'sinden saf Playlist ID'sini ayıklar.
 * Örn: https://music.youtube.com/playlist?list=PLS9pu550w2vc -> PLS9pu550w2vc
 */
export function extractPlaylistId(urlOrId: string): string {
  if (!urlOrId) return '';
  let cleanId = urlOrId.trim();
  if (cleanId.includes('list=')) {
    cleanId = cleanId.split('list=')[1].split('&')[0];
  }
  const match = cleanId.match(/[?&]list=([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  return cleanId;
}

/**
 * Bölgeye ve aşama indeksine göre ilgili YouTube Playlist ID'sini döner.
 */
export function getPlaylistIdByStage(region: 'tr' | 'global' = 'tr', stageIndex: number = 0): string {
  const stage = Math.max(0, Math.min(4, stageIndex));
  if (region === 'tr') {
    switch (stage) {
      case 0: return YOUTUBE_CURATED_PLAYLISTS.TR_KOLAY;
      case 1: return YOUTUBE_CURATED_PLAYLISTS.TR_ORTA;
      case 2: return YOUTUBE_CURATED_PLAYLISTS.TR_ZOR;
      case 3: return YOUTUBE_CURATED_PLAYLISTS.TR_UZMAN;
      case 4: return YOUTUBE_CURATED_PLAYLISTS.TR_IMKANSIZ;
    }
  } else {
    switch (stage) {
      case 0: return YOUTUBE_CURATED_PLAYLISTS.GLOBAL_KOLAY;
      case 1: return YOUTUBE_CURATED_PLAYLISTS.GLOBAL_ORTA;
      case 2: return YOUTUBE_CURATED_PLAYLISTS.GLOBAL_ZOR;
      case 3: return YOUTUBE_CURATED_PLAYLISTS.GLOBAL_UZMAN;
      case 4: return YOUTUBE_CURATED_PLAYLISTS.GLOBAL_IMKANSIZ;
    }
  }
  return YOUTUBE_CURATED_PLAYLISTS.TR_KOLAY;
}

/**
 * Invidious Playlist Şarkı Modeli
 */
export interface InvidiousPlaylistItem {
  title: string;
  videoId: string;
  author: string;
  lengthSeconds?: number;
  videoThumbnails?: Array<{ quality: string; url: string }>;
}

/**
 * YouTube Servisi (YouTube Service)
 * YouTube çalma listelerini tokensiz CORS-açık Invidious API (inv.nadeko.net vb.)
 * ve YouTube Data API / OEmbed üzerinden çeker.
 */
class YouTubeService {
  private apiKey: string = (import.meta as any).env?.VITE_YOUTUBE_API_KEY || '';
  private playlistCache = new Map<string, { songs: Song[]; timestamp: number }>();
  private readonly CACHE_TTL = 60 * 60 * 1000; // 1 saat
  private allKnownSongs: Song[] = [];

  public setApiKey(key: string): void {
    this.apiKey = key.trim();
    this.playlistCache.clear();
  }

  public hasApiKey(): boolean {
    return Boolean(this.apiKey);
  }

  private inFlightPlaylists = new Map<string, Promise<Song[]>>();

  /**
   * YouTube OEmbed servisi ile bir video ID'sinin başlık ve sanatçı bilgisini çeker.
   * CORS dostudur, API anahtarı istemez ve doğrudan YouTube tarafından sağlanır.
   */
  public async fetchVideoMetadata(videoId: string): Promise<{ title: string; artist: string; coverUrl: string } | null> {
    if (!videoId) return null;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);

    try {
      const res = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`, {
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (res.ok) {
        const data = await res.json();
        const fullTitle: string = data.title || '';
        const author: string = data.author_name || '';

        let artist = author;
        let title = fullTitle;

        if (fullTitle.includes(' - ')) {
          const parts = fullTitle.split(' - ');
          artist = parts[0].trim();
          title = parts.slice(1).join(' - ').trim();
        }

        // "(Official Video)", "[Official Audio]", "(Klip)", vb. takıları temizle
        title = title.replace(/\s*[([].*?(official|video|klip|audio|lyrics|hd|4k|remaster|visualizer).*?[)\]]/gi, '').trim();
        title = title.replace(/\s*\|\s*.*$/i, '').trim();

        return {
          title: title || fullTitle || 'Bilinmeyen Parça',
          artist: artist || author || 'Sanatçı',
          coverUrl: data.thumbnail_url || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
        };
      }
    } catch {
      clearTimeout(timer);
    }
    return null;
  }

  /**
   * Tokensiz Invidious REST API (inv.nadeko.net ve yedekleri) üzerinden doğrudan çalma listesini çeker.
   * Herhangi bir API key gerektirmez ve tarayıcıda CORS engeline takılmaz.
   */
  public async fetchPlaylistFromInvidious(
    playlistIdOrUrl: string,
    limit: number = 50,
    region: 'tr' | 'global' = 'tr'
  ): Promise<Song[]> {
    const cleanId = extractPlaylistId(playlistIdOrUrl);
    if (!cleanId) return [];

    const instances = [
      'https://inv.nadeko.net',
      'https://invidious.jing.rocks',
      'https://invidious.nerdvpn.de',
    ];

    for (const baseUrl of instances) {
      try {
        console.log(`📡 [YouTubeService] "${cleanId}" çalma listesi ${baseUrl} üzerinden çekiliyor...`);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6000);

        const response = await fetch(`${baseUrl}/api/v1/playlists/${cleanId}`, {
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!response.ok) continue;

        const data = await response.json();
        const videos = data.videos || [];
        if (!Array.isArray(videos) || videos.length === 0) continue;

        const playlistNum = Math.abs(cleanId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 1000);
        const sliced = videos.slice(0, limit);

        const mappedSongs: Song[] = sliced.map((item: any, idx: number) => {
          const rawTitle = (item.title || '').trim();
          const rawAuthor = (item.author || '').trim();

          let artist = rawAuthor;
          let title = rawTitle;

          if (rawTitle.includes(' - ')) {
            const parts = rawTitle.split(' - ');
            artist = parts[0].trim();
            title = parts.slice(1).join(' - ').trim();
          }

          // "(Official Video)", "[Official Audio]", "(Klip)" vb. takıları temizle
          title = title.replace(/\s*[([].*?(official|video|klip|audio|lyrics|hd|4k|remaster|visualizer).*?[)\]]/gi, '').trim();
          title = title.replace(/\s*\|\s*.*$/i, '').trim();

          let coverUrl = `https://img.youtube.com/vi/${item.videoId}/hqdefault.jpg`;
          if (Array.isArray(item.videoThumbnails) && item.videoThumbnails.length > 0) {
            const highThumb = item.videoThumbnails.find((t: any) => t.quality === 'high' || t.quality === 'maxres') || item.videoThumbnails[0];
            if (highThumb?.url) {
              coverUrl = highThumb.url.startsWith('http') ? highThumb.url : `${baseUrl}${highThumb.url}`;
            }
          }

          return {
            id: (playlistNum * 10000) + idx + 1,
            title: title || rawTitle || 'Bilinmeyen Parça',
            artist: artist || rawAuthor || 'Sanatçı',
            year: 2024,
            genre: 'pop',
            region,
            difficulty: 'easy' as DifficultyLevel,
            difficultyRank: 1,
            startSecond: 0,
            duration: item.lengthSeconds || 30,
            coverUrl,
            youtubeId: item.videoId,
          };
        });

        console.log(`✅ [YouTubeService] ${baseUrl} üzerinden ${mappedSongs.length} şarkı başarıyla yüklendi.`);
        return mappedSongs;
      } catch (err) {
        console.warn(`⚠️ [YouTubeService] ${baseUrl} üzerinden playlist çekme hatası:`, err);
      }
    }

    return [];
  }

  /**
   * Belirtilen YouTube Playlist ID veya URL'sindeki parçaları çeker.
   * 1. YouTube Data API v3 (Eğer API Key varsa)
   * 2. Tokensiz Invidious API (inv.nadeko.net vb.)
   */
  public async getPlaylistSongs(
    playlistIdOrUrl: string,
    options?: { limit?: number; region?: 'tr' | 'global' }
  ): Promise<Song[]> {
    const playlistId = extractPlaylistId(playlistIdOrUrl);
    if (!playlistId) return [];
    const limit = options?.limit || 50;
    const region = options?.region || 'tr';

    // Önbellek kontrolü
    const cached = this.playlistCache.get(playlistId);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.songs;
    }

    // Aynı playlist için zaten devam eden bir istek varsa onu bekle (Mükerrer istek engeli)
    if (this.inFlightPlaylists.has(playlistId)) {
      return this.inFlightPlaylists.get(playlistId)!;
    }

    const fetchPromise = (async (): Promise<Song[]> => {
      let loadedSongs: Song[] = [];

      // 1. YouTube Data API v3 (Eğer API key tanımlıysa)
      if (this.apiKey) {
        try {
          const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=${limit}&playlistId=${playlistId}&key=${this.apiKey}`;
          const res = await fetch(url);
          if (res.ok) {
            const data = await res.json();
            const playlistNum = Math.abs(playlistId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 1000);
            loadedSongs = (data.items || []).map((item: any, idx: number) => {
              const snippet = item.snippet;
              const fullTitle = snippet.title || '';
              const [parsedArtist, parsedTitle] = fullTitle.includes(' - ')
                ? fullTitle.split(' - ')
                : [snippet.videoOwnerChannelTitle || 'Sanatçı', fullTitle];

              return {
                id: (playlistNum * 10000) + idx + 1,
                title: (parsedTitle || fullTitle).trim(),
                artist: parsedArtist.trim(),
                year: snippet.publishedAt ? new Date(snippet.publishedAt).getFullYear() : 2023,
                genre: 'pop',
                region,
                difficulty: 'easy' as DifficultyLevel,
                difficultyRank: 1,
                startSecond: 0,
                duration: 30,
                coverUrl: snippet.thumbnails?.high?.url || snippet.thumbnails?.medium?.url || `https://img.youtube.com/vi/${snippet.resourceId?.videoId}/hqdefault.jpg`,
                youtubeId: snippet.resourceId?.videoId,
              };
            });
          }
        } catch (err) {
          console.warn('⚠️ [YouTubeService] YouTube Data API playlist çağrısı başarısız:', err);
        }
      }

      // 2. Tokensiz Invidious API üzerinden doğrudan Playlist çekimi (inv.nadeko.net vb.)
      if (loadedSongs.length === 0) {
        loadedSongs = await this.fetchPlaylistFromInvidious(playlistId, limit, region);
      }

      if (loadedSongs.length > 0) {
        this.playlistCache.set(playlistId, { songs: loadedSongs, timestamp: Date.now() });
        this.registerKnownSongs(loadedSongs);
        return loadedSongs;
      }

      return [];
    })();

    this.inFlightPlaylists.set(playlistId, fetchPromise);
    try {
      return await fetchPromise;
    } finally {
      this.inFlightPlaylists.delete(playlistId);
    }
  }

  /**
   * Bilinen şarkı havuzunu kaydeder (tahmin ve arama aramaları için)
   */
  public registerKnownSongs(songs: Song[]): void {
    const existingIds = new Set(this.allKnownSongs.map((s) => s.youtubeId || s.title));
    for (const song of songs) {
      const key = song.youtubeId || song.title;
      if (!existingIds.has(key)) {
        this.allKnownSongs.push(song);
        existingIds.add(key);
      }
    }
  }

  /**
   * Tahmin kutusu (Autocomplete) ve şarkı arama
   * Çekilen çalma listeleri ve bilinen şarkı kataloğu üzerinde arama yapar.
   */
  public async searchTracks(query: string, limit: number = 8): Promise<Song[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];
    const lower = trimmed.toLowerCase();

    // 1. YouTube Data API v3 (Eğer API key tanımlıysa)
    if (this.apiKey) {
      try {
        const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&videoCategoryId=10&maxResults=${limit}&key=${this.apiKey}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          return (data.items || []).map((item: any, idx: number) => {
            const snippet = item.snippet;
            const fullTitle = snippet.title || '';
            const [parsedArtist, parsedTitle] = fullTitle.includes(' - ')
              ? fullTitle.split(' - ')
              : [snippet.channelTitle || '', fullTitle];

            return {
              id: Date.now() + 2000 + idx,
              title: (parsedTitle || fullTitle).trim(),
              artist: (parsedArtist || '').trim(),
              year: snippet.publishedAt ? new Date(snippet.publishedAt).getFullYear() : 2024,
              genre: 'pop',
              region: 'tr',
              difficulty: 'easy',
              difficultyRank: 1,
              startSecond: 0,
              duration: 30,
              coverUrl: snippet.thumbnails?.high?.url || snippet.thumbnails?.medium?.url,
              youtubeId: item.id?.videoId,
            };
          });
        }
      } catch (err) {
        console.warn('⚠️ [YouTubeService] YouTube Search API hatası:', err);
      }
    }

    // 2. Yüklenen YouTube Çalma Listesi ve Bilinen Şarkılar üzerinde arama
    const matched = this.allKnownSongs.filter((song) => {
      const titleMatch = song.title.toLowerCase().includes(lower);
      const artistMatch = song.artist.toLowerCase().includes(lower);
      return titleMatch || artistMatch;
    });

    return matched.slice(0, limit);
  }

  /**
   * Video ID veya şarkı ID'sine göre şarkı detayını döner
   */
  public async getTrack(idOrVideoId: string): Promise<Song | null> {
    if (!idOrVideoId) return null;

    // Önce bilinen havuzda ara
    const found = this.allKnownSongs.find(
      (s) => s.youtubeId === idOrVideoId || String(s.id) === idOrVideoId
    );
    if (found) return found;

    // OEmbed ile çek
    const meta = await this.fetchVideoMetadata(idOrVideoId);
    if (meta) {
      return {
        id: Date.now(),
        title: meta.title,
        artist: meta.artist,
        year: 2023,
        genre: 'pop',
        region: 'tr',
        difficulty: 'easy',
        difficultyRank: 1,
        startSecond: 0,
        duration: 30,
        coverUrl: meta.coverUrl,
        youtubeId: idOrVideoId,
      };
    }

    return null;
  }
}

export const youtubeService = new YouTubeService();
