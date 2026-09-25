import type { ITunesSearchResponse, ITunesTrack } from '@/types/itunes';
import type { Song } from '@/types/song';

/**
 * Apple iTunes Search API Servisi
 * Spotify şarkıları için ISRC ve Akıllı Doğrulama / Filtreleme algoritması ile
 * yanlış cover/karaoke şarkıcılarını eleyerek %100 orijinal stüdyo kaydı önizleme seslerini temin eder.
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
  private getCacheKey(title: string, artist?: string, isrc?: string): string {
    if (isrc) return `isrc:::${isrc}`;
    return `${(artist || '').toLowerCase().trim()}:::${title.toLowerCase().trim()}`;
  }

  /**
   * Aday şarkıyı hedef başlık ve sanatçıya göre puanlar.
   * Cover, karaoke, tribute ve sahte sanatçı kayıtlarına ağır ceza puanı vererek eler.
   */
  private scoreCandidate(candidate: ITunesTrack, targetTitle: string, targetArtist: string): number {
    if (!candidate.previewUrl) return -999;

    let score = 0;
    const candArtist = (candidate.artistName || '').toLowerCase().trim();
    const candTitle = (candidate.trackName || '').toLowerCase().trim();
    const tgtArtist = (targetArtist || '').toLowerCase().trim();
    const tgtTitle = (targetTitle || '').toLowerCase().trim();

    // 1. Sahte / Cover / Karaoke Filtresi
    const spamWords = ['karaoke', 'tribute', 'cover version', 'in the style of', 'instrumental', 'backing track', 'akustik cover', 'cover'];
    for (const word of spamWords) {
      if ((candArtist.includes(word) || candTitle.includes(word)) && !tgtTitle.includes(word)) {
        score -= 200; // Ağır ceza
      }
    }

    // 2. Sanatçı Eşleşmesi (En yüksek öncelik)
    if (candArtist === tgtArtist) {
      score += 100; // Birebir aynı sanatçı
    } else if (candArtist.includes(tgtArtist) || tgtArtist.includes(candArtist)) {
      score += 70; // Düet veya ortak çalışma (Örn: Mert Demir & Mabel Matiz)
    } else {
      score -= 80; // Farklı sanatçı
    }

    // 3. Şarkı Başlığı Eşleşmesi
    if (candTitle === tgtTitle) {
      score += 80;
    } else if (candTitle.includes(tgtTitle) || tgtTitle.includes(candTitle)) {
      score += 40;
    } else {
      score -= 30;
    }

    return score;
  }

  /**
   * ISRC (Uluslararası Standart Kayıt Kodu) ile doğrudan stüdyo kaydı arar.
   * ISRC ile arama %100 orijinal parçayı garanti eder.
   */
  public async searchByISRC(isrc: string, country: string = 'TR'): Promise<ITunesTrack | null> {
    const url = `${this.baseUrl}?term=${encodeURIComponent(isrc)}&media=music&entity=song&limit=1&country=${country}`;
    try {
      const response = await fetch(url, { headers: { Accept: 'application/json' } });
      if (response.ok) {
        const data: ITunesSearchResponse = await response.json();
        if (data.results && data.results.length > 0 && data.results[0].previewUrl) {
          console.log(`🎯 [iTunes ISRC Eşleşti]: "${data.results[0].artistName} - ${data.results[0].trackName}" (${isrc})`);
          return data.results[0];
        }
      }
    } catch {
      // ISRC araması başarısız olursa normal aramaya geç
    }
    return null;
  }

  /**
   * iTunes Search API üzerinde şarkıyı akıllı filtreleme ve aday puanlamasıyla arar.
   */
  public async searchTrack(
    title: string,
    artist?: string,
    options?: { country?: string; limit?: number; isrc?: string }
  ): Promise<ITunesTrack | null> {
    // 1. Şarkının ISRC kodu varsa doğrudan ISRC ile ara
    if (options?.isrc) {
      const isrcResult = await this.searchByISRC(options.isrc, options.country || 'TR');
      if (isrcResult) return isrcResult;
    }

    const cleanTitle = this.cleanQueryString(title);
    const cleanArtist = artist ? this.cleanQueryString(artist) : '';
    const query = cleanArtist ? `${cleanArtist} ${cleanTitle}` : cleanTitle;

    if (!query) return null;

    const limit = options?.limit || 10; // Doğrulama için birden fazla aday çekilir
    const country = options?.country || 'TR';
    const url = `${this.baseUrl}?term=${encodeURIComponent(query)}&media=music&entity=song&limit=${limit}&country=${country}`;

    console.log(`🍏 [Apple iTunes API] Orijinal kayıt aranıyor: "${query}" (Bölge: ${country})`);

    try {
      const response = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!response.ok) return null;

      const data: ITunesSearchResponse = await response.json();

      if (data.results && data.results.length > 0) {
        // Adayları puanla ve filtrele
        const scoredCandidates = data.results
          .map((candidate) => ({
            candidate,
            score: this.scoreCandidate(candidate, cleanTitle, cleanArtist),
          }))
          .sort((a, b) => b.score - a.score);

        const best = scoredCandidates[0];

        // Eşik değeri: Sanatçı veya başlık uyuşmayan sahte cover kayıtları kabul etme
        if (best && best.score > 30) {
          console.log(
            `🍏 [Apple iTunes API] En iyi orijinal eşleşme (Skor: ${best.score}): "${best.candidate.artistName} - ${best.candidate.trackName}"`
          );
          return best.candidate;
        }
      }

      // Bulunamadıysa fallback olarak sadece parça adı ve sanatçı adı ayrı ayrı denenir
      if (cleanArtist) {
        const fallbackUrl = `${this.baseUrl}?term=${encodeURIComponent(`${cleanArtist} ${cleanTitle}`)}&media=music&entity=song&limit=5`;
        const fbRes = await fetch(fallbackUrl);
        if (fbRes.ok) {
          const fbData: ITunesSearchResponse = await fbRes.json();
          if (fbData.results && fbData.results.length > 0) {
            const fallbackBest = fbData.results
              .map((c) => ({ candidate: c, score: this.scoreCandidate(c, cleanTitle, cleanArtist) }))
              .sort((a, b) => b.score - a.score)[0];

            if (fallbackBest && fallbackBest.score > 20) {
              return fallbackBest.candidate;
            }
          }
        }
      }

      return null;
    } catch (error) {
      console.error('[iTunes API] Arama hatası:', error);
      return null;
    }
  }

  /**
   * Bir şarkının önizleme ses URL'sini döner (Önbellekli)
   */
  public async getPreviewUrl(title: string, artist?: string, isrc?: string, region?: string): Promise<string | null> {
    const cacheKey = this.getCacheKey(title, artist, isrc);
    if (this.previewCache.has(cacheKey)) {
      return this.previewCache.get(cacheKey) || null;
    }

    const country = region?.toLowerCase() === 'global' ? 'US' : 'TR';
    const track = await this.searchTrack(title, artist, { country, isrc });
    const previewUrl = track?.previewUrl || null;

    this.previewCache.set(cacheKey, previewUrl);
    return previewUrl;
  }

  /**
   * Song nesnesini iTunes verileriyle zenginleştirir.
   */
  public async enrichSongWithPreview(song: Song): Promise<Song> {
    if (song.previewUrl) {
      return song;
    }

    try {
      const country = song.region === 'global' ? 'US' : 'TR';
      const track = await this.searchTrack(song.title, song.artist, { country, isrc: song.isrc });
      if (track) {
        const enriched: Song = {
          ...song,
          previewUrl: track.previewUrl || song.previewUrl,
          coverUrl: song.coverUrl || track.artworkUrl100?.replace('100x100bb', '600x600bb') || track.artworkUrl100,
        };

        if (track.previewUrl) {
          const cacheKey = this.getCacheKey(song.title, song.artist, song.isrc);
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
   * ITunesTrack nesnesini Song modeline dönüştürür
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
   * iTunes üzerinde serbest metin araması yapar
   */
  public async searchTracks(query: string, limit: number = 10): Promise<Song[]> {
    if (!query.trim()) return [];

    const cleanQuery = this.cleanQueryString(query);
    const url = `${this.baseUrl}?term=${encodeURIComponent(cleanQuery)}&media=music&entity=song&limit=${limit}&country=TR`;

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
}

export const itunesService = new ITunesService();
