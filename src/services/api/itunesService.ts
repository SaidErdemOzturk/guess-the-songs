import type { ITunesSearchResponse, ITunesTrack } from '@/types/itunes';
import type { Song } from '@/types/song';

/**
 * Apple iTunes Search API Servisi
 * Spotify API'nin 2024 sonrası önizleme sesi (preview_url) vermemesi durumunda,
 * şarkıların 30 saniyelik gerçek MP3/AAC önizleme seslerini ve kapak görsellerini
 * ücretsiz ve herhangi bir API anahtarı gerekmeden temin eder.
 */
class ITunesService {
  private readonly baseUrl = 'https://itunes.apple.com/search';
  private previewCache = new Map<string, string | null>();

  /**
   * Şarkı veya sanatçı adı içindeki arama kalitesini bozan gereksiz parantezleri ve ekleri temizler.
   */
  private cleanQueryString(text: string): string {
    return text
      .replace(/\(feat\..*?\)/gi, '')
      .replace(/\[feat\..*?\]/gi, '')
      .replace(/\(with.*?\)/gi, '')
      .replace(/\(remastered.*?\)/gi, '')
      .replace(/- remastered/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Cache anahtarını oluşturur
   */
  private getCacheKey(title: string, artist?: string): string {
    return `${(artist || '').toLowerCase().trim()}:::${title.toLowerCase().trim()}`;
  }

  /**
   * iTunes Search API üzerinde şarkı arar
   */
  public async searchTrack(
    title: string,
    artist?: string,
    options?: { country?: string; limit?: number }
  ): Promise<ITunesTrack | null> {
    const cleanTitle = this.cleanQueryString(title);
    const cleanArtist = artist ? this.cleanQueryString(artist) : '';
    const query = cleanArtist ? `${cleanArtist} ${cleanTitle}` : cleanTitle;

    if (!query) return null;

    const limit = options?.limit || 1;
    const countryParam = options?.country ? `&country=${options.country}` : '';
    const url = `${this.baseUrl}?term=${encodeURIComponent(query)}&media=music&entity=song&limit=${limit}${countryParam}`;

    console.log(`🍏 [Apple iTunes API] Şarkı aranıyor: "${query}"`);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        console.warn(`[iTunes API] İstek başarısız: HTTP ${response.status}`);
        return null;
      }

      const data: ITunesSearchResponse = await response.json();

      if (data.results && data.results.length > 0) {
        const found = data.results[0];
        console.log(`🍏 [Apple iTunes API] Başarıyla bulundu: "${found.artistName} - ${found.trackName}" | Önizleme Sesi:`, found.previewUrl);
        return found;
      }

      // Eğer sanatçı + parça ile bulunamadıysa ve sanatçı varsa, sadece parça adıyla dene
      if (cleanArtist && cleanTitle !== query) {
        console.log(`🍏 [Apple iTunes API] Parça adına göre tekrar deneniyor: "${cleanTitle}"`);
        const fallbackUrl = `${this.baseUrl}?term=${encodeURIComponent(cleanTitle)}&media=music&entity=song&limit=1${countryParam}`;
        const fallbackRes = await fetch(fallbackUrl);
        if (fallbackRes.ok) {
          const fallbackData: ITunesSearchResponse = await fallbackRes.json();
          if (fallbackData.results && fallbackData.results.length > 0) {
            const found = fallbackData.results[0];
            console.log(`🍏 [Apple iTunes API] Alternatif aramayla bulundu: "${found.artistName} - ${found.trackName}" | Önizleme Sesi:`, found.previewUrl);
            return found;
          }
        }
      }

      console.warn(`🍏 [Apple iTunes API] "${query}" için sonuç bulunamadı.`);
      return null;
    } catch (error) {
      console.error('[iTunes API] Arama sırasında hata oluştu:', error);
      return null;
    }
  }

  /**
   * Bir şarkının önizleme ses URL'sini (30 saniyelik AAC/MP3) döner.
   * Önbellek mekanizması sayesinde aynı şarkı için tekrarlı istekleri engeller.
   */
  public async getPreviewUrl(title: string, artist?: string): Promise<string | null> {
    const cacheKey = this.getCacheKey(title, artist);
    if (this.previewCache.has(cacheKey)) {
      return this.previewCache.get(cacheKey) || null;
    }

    const track = await this.searchTrack(title, artist);
    const previewUrl = track?.previewUrl || null;

    this.previewCache.set(cacheKey, previewUrl);
    return previewUrl;
  }

  /**
   * Song nesnesini iTunes verileriyle zenginleştirir.
   * previewUrl yoksa iTunes'dan çeker; coverUrl yoksa albüm görselini de ekler.
   */
  public async enrichSongWithPreview(song: Song): Promise<Song> {
    if (song.previewUrl) {
      return song;
    }

    try {
      const track = await this.searchTrack(song.title, song.artist);
      if (track) {
        const enriched: Song = {
          ...song,
          previewUrl: track.previewUrl || song.previewUrl,
          coverUrl: song.coverUrl || track.artworkUrl100?.replace('100x100bb', '600x600bb') || track.artworkUrl100,
        };

        if (track.previewUrl) {
          const cacheKey = this.getCacheKey(song.title, song.artist);
          this.previewCache.set(cacheKey, track.previewUrl);
        }

        return enriched;
      }
    } catch (err) {
      console.warn(`[iTunes API] ${song.artist} - ${song.title} zenginleştirilemedi:`, err);
    }

    return song;
  }

  /**
   * ITunesTrack nesnesini uygulama Song modeline dönüştürür
   */
  public mapITunesTrackToSong(track: ITunesTrack, fallbackId: number = 1): Song {
    const releaseYear = track.releaseDate ? parseInt(track.releaseDate.substring(0, 4), 10) : 2024;
    const coverUrl = track.artworkUrl100
      ? track.artworkUrl100.replace('100x100bb', '600x600bb')
      : undefined;

    return {
      id: track.trackId || fallbackId,
      title: track.trackName,
      artist: track.artistName,
      album: track.collectionName,
      year: isNaN(releaseYear) ? 2024 : releaseYear,
      genre: (track.primaryGenreName?.toLowerCase() || 'pop') as any,
      region: track.country?.toLowerCase() === 'tur' || track.country?.toLowerCase() === 'tr' ? 'tr' : 'global',
      difficulty: 'medium',
      difficultyRank: 2,
      startSecond: 0,
      duration: 30,
      coverUrl,
      previewUrl: track.previewUrl,
    };
  }

  /**
   * iTunes Search API üzerinde serbest metin araması yapar ve Song listesi döner
   */
  public async searchTracks(query: string, limit: number = 10): Promise<Song[]> {
    if (!query.trim()) return [];

    const cleanQuery = this.cleanQueryString(query);
    const url = `${this.baseUrl}?term=${encodeURIComponent(cleanQuery)}&media=music&entity=song&limit=${limit}`;

    try {
      const response = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!response.ok) return [];

      const data: ITunesSearchResponse = await response.json();
      return (data.results || []).map((t, i) => this.mapITunesTrackToSong(t, i + 1));
    } catch (err) {
      console.error('[iTunes API] searchTracks hatası:', err);
      return [];
    }
  }

  /**
   * Çoklu şarkı listesini iTunes önizleme sesleriyle zenginleştirir
   */
  public async batchEnrichSongs(songs: Song[], limitToFirstN: number = 10): Promise<Song[]> {
    const targetSongs = songs.slice(0, limitToFirstN);
    const remainingSongs = songs.slice(limitToFirstN);

    const enrichedTargets = await Promise.all(
      targetSongs.map((song) => this.enrichSongWithPreview(song))
    );

    return [...enrichedTargets, ...remainingSongs];
  }
}

export const itunesService = new ITunesService();
