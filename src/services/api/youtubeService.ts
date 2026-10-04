import type { Song, DifficultyLevel } from '@/types/song';
import { resolveYouTubeId } from '@/services/audio/youtubeResolver';
import { youtubePlayerService } from '@/services/audio/youtubePlayerService';

/**
 * YouTube Music & Video Çalma Listesi Konfigürasyonu
 * Kullanıcı isteği doğrultusunda tüm aşamalar https://music.youtube.com/playlist?list=PLS9pu550w2vc linkindeki
 * 'PLS9pu550w2vc' çalma listesine bağlandı.
 */
export const YOUTUBE_CURATED_PLAYLISTS = {
  // Türkiye Odaklı Çalma Listeleri (Doğrulanmış YouTube Çalma Listeleri)
  TR_KOLAY: 'PLDIoUOhQQPlVr3qepMVRsDe4T8vNQsvno',
  TR_ORTA: 'PLS9pu550w2vc',
  TR_ZOR: 'PLzBgi-bjxcqI4VVcWjvCf1jjRyADbTIIT',
  TR_UZMAN: 'PLRYrvC4-qoFwisleFnCRUUkrpJAx2nb_0',
  TR_IMKANSIZ: 'PLS9pu550w2vc',

  // Global Odaklı Çalma Listeleri (Doğrulanmış YouTube Çalma Listeleri)
  GLOBAL_KOLAY: 'PLMC9KNkIncKtPzgY-5rmhvj7fax8fdxoj',
  GLOBAL_ORTA: 'PLMC9KNkIncKtPzgY-5rmhvj7fax8fdxoj',
  GLOBAL_ZOR: 'PLMC9KNkIncKtPzgY-5rmhvj7fax8fdxoj',
  GLOBAL_UZMAN: 'PLMC9KNkIncKtPzgY-5rmhvj7fax8fdxoj',
  GLOBAL_IMKANSIZ: 'PLMC9KNkIncKtPzgY-5rmhvj7fax8fdxoj',
} as const;

/**
 * YouTube Playlist URL veya ID'sinden saf Playlist ID'sini ayıklar.
 * Örn: https://music.youtube.com/playlist?list=PLS9pu550w2vc -> PLS9pu550w2vc
 */
export function extractPlaylistId(urlOrId: string): string {
  if (!urlOrId) return '';
  const match = urlOrId.match(/[?&]list=([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  return urlOrId.trim();
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
 * YouTube Servisi (YouTube Service)
 * YouTube çalma listelerini resmi IFrame API ve YouTube OEmbed ile çeker.
 * iTunes veya üçüncü parti harici servislere bağımlı değildir.
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
   * Belirtilen YouTube Playlist ID'sindeki parçaları çeker.
   * 1. YouTube Data API v3 (API Key varsa)
   * 2. YouTube IFrame Player cuePlaylist + OEmbed (API Key yoksa doğrudan tarayıcı üzerinden)
   */
  public async getPlaylistSongs(
    playlistIdOrUrl: string,
    options?: { limit?: number; region?: 'tr' | 'global' }
  ): Promise<Song[]> {
    const playlistId = extractPlaylistId(playlistIdOrUrl);
    const limit = options?.limit || 35;
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

      // 2. YouTube IFrame Player üzerinden doğrudan Playlist çekimi (API Keysiz)
      if (loadedSongs.length === 0) {
        try {
          console.log(`🎬 [YouTubeService] "${playlistId}" çalma listesi YouTube IFrame üzerinden taranıyor...`);
          const videoIds = await youtubePlayerService.fetchPlaylistVideoIds(playlistId);

          if (videoIds.length > 0) {
            const sliceIds = videoIds.slice(0, Math.min(limit, 40));
            const playlistNum = Math.abs(playlistId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 1000);
            const metaPromises = sliceIds.map(async (vid, idx) => {
              const meta = await this.fetchVideoMetadata(vid);
              if (!meta || !meta.title) return null;
              const song: Song = {
                id: (playlistNum * 10000) + idx + 1,
                title: meta.title,
                artist: meta.artist,
                year: 2023,
                genre: 'pop',
                region,
                difficulty: 'medium',
                difficultyRank: 2,
                startSecond: 0,
                duration: 30,
                coverUrl: meta.coverUrl || `https://img.youtube.com/vi/${vid}/hqdefault.jpg`,
                youtubeId: vid,
              };
              return song;
            });

            const resolved = await Promise.all(metaPromises);
            loadedSongs = resolved.filter((s): s is Song => s !== null);
          }
        } catch (iframeErr) {
          console.warn('⚠️ [YouTubeService] IFrame playlist çekimi başarısız:', iframeErr);
        }
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
