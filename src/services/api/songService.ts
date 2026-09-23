import { MOCK_SONG_DATABASE } from '../mock/songDatabase';
import type { DifficultyLevel, Song, SongFilters, SongPoolStats } from '@/types/song';

/**
 * Kurumsal Şarkı Servisi (Song Service)
 * Tüm metotlar tip güvenli şekilde mock veritabanı üzerinden zengin filtreleme,
 * arama, zorluk seviyesi eşleştirme ve istatistik değerlerini döndürür.
 */
export const songService = {
  /**
   * Filtrelere göre (yıl, tür, bölge, zorluk, sanatçı, arama) şarkı listesi getirir
   */
  async getSongs(filters?: SongFilters): Promise<Song[]> {
    // API gecikmesi simülasyonu (UX gerçekçiliği için)
    await new Promise((resolve) => setTimeout(resolve, 50));

    let songs = [...MOCK_SONG_DATABASE];

    if (!filters) return songs;

    if (filters.region && filters.region !== 'all') {
      songs = songs.filter((s) => s.region === filters.region);
    }

    if (filters.genre && filters.genre !== 'all') {
      songs = songs.filter((s) => s.genre === filters.genre);
    }

    if (filters.difficulty) {
      songs = songs.filter((s) => s.difficulty === filters.difficulty);
    }

    if (filters.year) {
      songs = songs.filter((s) => s.year === filters.year);
    }

    if (filters.era && filters.era !== 'all') {
      songs = songs.filter((s) => {
        if (filters.era === '2020s') return s.year >= 2020;
        if (filters.era === '2010s') return s.year >= 2010 && s.year < 2020;
        if (filters.era === '2000s') return s.year >= 2000 && s.year < 2010;
        if (filters.era === '90s') return s.year >= 1990 && s.year < 2000;
        return true;
      });
    }

    if (filters.artist) {
      const artLower = filters.artist.toLowerCase();
      songs = songs.filter(
        (s) =>
          s.artist.toLowerCase() === artLower ||
          s.featuredArtists?.some((f) => f.toLowerCase() === artLower)
      );
    }

    if (filters.search) {
      const q = filters.search.toLowerCase().trim();
      songs = songs.filter(
        (s) => s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q)
      );
    }

    return songs;
  },

  /**
   * Şarkı ID'sine göre tekil şarkı getirir
   */
  async getSongById(id: number): Promise<Song | null> {
    const song = MOCK_SONG_DATABASE.find((s) => s.id === id);
    return song || null;
  },

  /**
   * Başlık, sanatçı ve alternatif isimlere göre anlık arama (Autocomplete)
   */
  async searchSongs(query: string): Promise<Song[]> {
    if (!query.trim()) return [];

    const q = query.toLowerCase().trim();
    return MOCK_SONG_DATABASE.filter(
      (song) => song.title.toLowerCase().includes(q) || song.artist.toLowerCase().includes(q)
    ).slice(0, 8); // İlk 8 sonuç
  },

  /**
   * Belirli zorluk seviyesine göre şarkıları filtreler
   */
  async getSongsByDifficulty(difficulty: DifficultyLevel): Promise<Song[]> {
    return MOCK_SONG_DATABASE.filter((s) => s.difficulty === difficulty);
  },

  /**
   * 5 Aşamalı oyun için zorluk sırasına göre (Aşama 1: Kolay -> Aşama 5: İmkansız)
   * dengeli ve dinamik bir oyun havuzu oluşturur.
   */
  async getRandomGamePool(filters?: SongFilters, count: number = 5): Promise<Song[]> {
    const baseSongs = await this.getSongs(filters);

    if (baseSongs.length < count) {
      // Filtre sonucu azsa tüm havuzdan tamamla
      return [...MOCK_SONG_DATABASE].sort(() => 0.5 - Math.random()).slice(0, count);
    }

    // 1'den 5'e kadar zorluk derecesine göre birer şarkı seç
    const pool: Song[] = [];
    const ranks: (1 | 2 | 3 | 4 | 5)[] = [1, 2, 3, 4, 5];

    ranks.forEach((rank) => {
      const candidates = baseSongs.filter((s) => s.difficultyRank === rank);
      if (candidates.length > 0) {
        const picked = candidates[Math.floor(Math.random() * candidates.length)];
        pool.push(picked);
      }
    });

    // Eksik kalan olursa rastgele doldur
    if (pool.length < count) {
      const remaining = baseSongs.filter((s) => !pool.some((p) => p.id === s.id));
      const needed = count - pool.length;
      pool.push(...remaining.sort(() => 0.5 - Math.random()).slice(0, needed));
    }

    return pool.slice(0, count);
  },

  /**
   * Havuz istatistiklerini (tür, zorluk ve toplam adet) döner
   */
  async getPoolStats(filters?: SongFilters): Promise<SongPoolStats> {
    const filtered = await this.getSongs(filters);

    const byGenre: Record<string, number> = {};
    const byDifficulty: Record<DifficultyLevel, number> = {
      easy: 0,
      medium: 0,
      hard: 0,
      expert: 0,
      impossible: 0,
    };

    filtered.forEach((s) => {
      byGenre[s.genre] = (byGenre[s.genre] || 0) + 1;
      if (s.difficulty in byDifficulty) {
        byDifficulty[s.difficulty]++;
      }
    });

    return {
      totalCount: MOCK_SONG_DATABASE.length,
      filteredCount: filtered.length,
      byGenre,
      byDifficulty,
    };
  },
};
