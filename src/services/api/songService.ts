import { youtubeService, getPlaylistIdByStage } from './youtubeService';
import { resolveYouTubeId } from '@/services/audio/youtubeResolver';
import { youtubePlayerService } from '@/services/audio/youtubePlayerService';
import { cleanTurkishText } from '@/utils/formatters';
import type { DifficultyLevel, Song, SongFilters, SongPoolStats } from '@/types/song';

/**
 * Şarkı Servisi (Song Service)
 * Şarkı havuzu, aşama seçimi ve tahmin aramasını doğrudan YouTube çalma listeleri üzerinden yönetir.
 * Başla'ya basıldığında bütün aşama playlistleri çekilir;
 * kolay adımda kolay listeden random bir parça tahmin için seçilir;
 * arama yapıldığında ise bütün çalma listelerinin birleşik havuzunda anlık arama yapılır.
 */
export const songService = {
  // Aşama bazlı yüklenmiş şarkı listeleri (0: Kolay, 1: Orta, 2: Zor...)
  stagePlaylists: {} as Record<number, Song[]>,
  // Çekilen bütün çalma listelerinin birleşmiş hali (searchSongs bu havuzda arama yapar)
  combinedPool: [] as Song[],

  /**
   * Başla'ya basıldığı anda BÜTÜN aşama playlistlerini (Kolay, Orta, Zor) YouTube üzerinden çeker
   * ve arama havuzu için birleştirir.
   */
  async initializeGamePlaylists(region: 'tr' | 'global' = 'tr'): Promise<Song[]> {
    console.log(`🚀 [SongService] Bütün YouTube çalma listeleri (${region}) çekiliyor...`);
    try {
      const stageIndexes = [0, 1, 2]; // 0: Kolay, 1: Orta, 2: Zor
      const results = await Promise.all(
        stageIndexes.map((idx) => this.getPlayList(region, idx))
      );

      stageIndexes.forEach((idx, i) => {
        this.stagePlaylists[idx] = results[i] || [];
      });

      // Bütün playlistleri birleştir ve mükerrerleri ayıkla
      const allSongs = results.flat();
      const map = new Map<string, Song>();
      for (const song of allSongs) {
        const key = song.youtubeId || `${song.artist.toLowerCase()} - ${song.title.toLowerCase()}`;
        if (!map.has(key)) {
          map.set(key, song);
        }
      }
      this.combinedPool = Array.from(map.values());
      youtubeService.registerKnownSongs(this.combinedPool);

      console.log(
        `✅ [SongService] Bütün çalma listeleri çekildi: ` +
        `Kolay: ${this.stagePlaylists[0]?.length || 0}, ` +
        `Orta: ${this.stagePlaylists[1]?.length || 0}, ` +
        `Zor: ${this.stagePlaylists[2]?.length || 0} ` +
        `-> Toplam ${this.combinedPool.length} adet benzersiz parça arama havuzuna eklendi.`
      );
    } catch (err) {
      console.warn('⚠️ [SongService] initializeGamePlaylists hatası:', err);
    }
    return this.combinedPool;
  },

  /**
   * Filtrelere göre canlı şarkı listesi getirir
   */
  async getSongs(filters?: SongFilters): Promise<Song[]> {
    const query =
      filters?.search ||
      filters?.artist ||
      (filters?.genre && filters.genre !== 'all' ? filters.genre : (filters?.region === 'global' ? 'top hits' : 'türkçe pop'));

    try {
      return await youtubeService.searchTracks(query, 30);
    } catch {
      return [];
    }
  },

  /**
   * Şarkı ID'sine göre şarkıyı getirir
   */
  async getSongById(id: string | number): Promise<Song | null> {
    try {
      return await youtubeService.getTrack(String(id));
    } catch (err) {
      console.warn(`[songService] track ${id} alınamadı:`, err);
      return null;
    }
  },

  /**
   * Başlık, sanatçı veya arama metnine göre bütün çekilen çalma listelerinin
   * birleşmiş havuzunda (combinedPool) anlık arama (Autocomplete) yapar.
   */
  async searchSongs(query: string): Promise<Song[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    const sourcePool = this.combinedPool.length > 0
      ? this.combinedPool
      : Object.values(this.stagePlaylists).flat();

    const normalizedQuery = cleanTurkishText(trimmed);
    const queryWords = normalizedQuery.split(/\s+/).filter(Boolean);

    const matched = sourcePool.filter((song) => {
      const normTitle = cleanTurkishText(song.title);
      const normArtist = cleanTurkishText(song.artist);
      const combined = `${normArtist} ${normTitle}`;

      // Kullanıcının yazdığı her kelime ya parça adında ya da sanatçıda geçmeli
      return queryWords.every((word) => combined.includes(word));
    });

    return matched.slice(0, 15);
  },

  /**
   * Belirli zorluk seviyesine göre şarkıları filtreler
   */
  async getSongsByDifficulty(difficulty: DifficultyLevel): Promise<Song[]> {
    const diffMap: Record<DifficultyLevel, number> = {
      easy: 0,
      medium: 1,
      hard: 2,
      expert: 3,
      impossible: 4,
    };
    return this.getPlayList('tr', diffMap[difficulty] ?? 0);
  },

  /**
   * Bölge ve aşama indeksine göre doğrudan YouTube playlist'inden canlı şarkı listesi getirir.
   */
  async getPlayList(region: 'tr' | 'global' = 'tr', stageIndex: number = 0): Promise<Song[]> {
    const playlistId = getPlaylistIdByStage(region, stageIndex);

    try {
      const youtubeSongs = await youtubeService.getPlaylistSongs(playlistId, {
        limit: 50,
        region,
      });

      if (youtubeSongs.length > 0) {
        return youtubeSongs.map((s) => ({
          ...s,
          youtubeId: s.youtubeId || resolveYouTubeId(s),
        }));
      }
    } catch (err) {
      console.warn(`⚠️ [SongService] YouTube playlist (${playlistId}) çekilemedi:`, err);
    }

    return [];
  },

  /**
   * İlgili aşama için (örn. kolay adımda kolay adımdan) YouTube çalma listesinden random bir şarkı seçer.
   */
  async getRandomSongForStage(
    region: 'tr' | 'global' = 'tr',
    stageIndex: number = 0,
    excludeSongId?: number | string
  ): Promise<Song> {
    let songs = this.stagePlaylists[stageIndex];
    if (!songs || songs.length === 0) {
      songs = await this.getPlayList(region, stageIndex);
      if (songs.length > 0) {
        this.stagePlaylists[stageIndex] = songs;
      }
    }

    if (songs && songs.length > 0) {
      let pool = songs.filter((s) => {
        if (excludeSongId && (s.id === excludeSongId || s.youtubeId === excludeSongId)) return false;
        if (s.youtubeId && youtubePlayerService.isVideoUnplayable(s.youtubeId)) return false;
        return true;
      });

      if (pool.length === 0) {
        pool = songs.filter((s) => !s.youtubeId || !youtubePlayerService.isVideoUnplayable(s.youtubeId));
      }
      if (pool.length === 0) {
        pool = songs;
      }

      // İlgili aşamanın çalma listesinden rastgele (random) bir şarkı seç
      const randomIndex = Math.floor(Math.random() * pool.length);
      const chosen = { ...pool[randomIndex] };
      chosen.youtubeId = chosen.youtubeId || resolveYouTubeId(chosen);
      console.log(
        `🎲 [SongService] Aşama ${stageIndex} listesinden (${pool.length} parça) rastgele [indeks ${randomIndex}] seçildi: "${chosen.artist} - ${chosen.title}" (YouTube ID: ${chosen.youtubeId})`
      );
      return chosen;
    }

    // Playlist henüz yüklenmediyse bile birleşik havuzdan veya ilk aşamadan dene
    const fallbackPool = this.combinedPool.length > 0 ? this.combinedPool : (this.stagePlaylists[0] || []);
    if (fallbackPool.length > 0) {
      const idx = Math.floor(Math.random() * fallbackPool.length);
      return { ...fallbackPool[idx] };
    }

    // Son çare dinamik model
    return {
      id: Date.now(),
      title: 'YouTube Parçası Yükleniyor...',
      artist: 'YouTube',
      year: 2024,
      genre: 'pop',
      region,
      difficulty: 'easy',
      difficultyRank: 1,
      startSecond: 0,
      duration: 30,
      youtubeId: '',
    };
  },

  /**
   * Bütün aşama listelerini birleştirir ve bu birleşik havuzdan (combinedPool)
   * daha önce çalınmamış rastgele bir şarkı seçer.
   */
  async getRandomSongFromCombinedPool(
    region: 'tr' | 'global' = 'tr',
    excludeIds: (number | string)[] = []
  ): Promise<Song> {
    if (!this.combinedPool || this.combinedPool.length === 0) {
      await this.initializeGamePlaylists(region);
    }

    const excludeSet = new Set(excludeIds.map(String));

    let pool = this.combinedPool.filter((s) => {
      if (excludeSet.has(String(s.id))) return false;
      if (s.youtubeId && excludeSet.has(String(s.youtubeId))) return false;
      if (s.youtubeId && youtubePlayerService.isVideoUnplayable(s.youtubeId)) return false;
      return true;
    });

    if (pool.length === 0) {
      // Eğer havuz bittiyse (tüm şarkılar çalındıysa), sadece telif engeli olmayanlardan tekrar seç
      pool = this.combinedPool.filter((s) => !s.youtubeId || !youtubePlayerService.isVideoUnplayable(s.youtubeId));
    }
    if (pool.length === 0) {
      pool = this.combinedPool;
    }

    if (pool.length > 0) {
      const randomIndex = Math.floor(Math.random() * pool.length);
      const chosen = { ...pool[randomIndex] };
      chosen.youtubeId = chosen.youtubeId || resolveYouTubeId(chosen);
      console.log(
        `🎲 [SongService] Birleşik havuzdan (${pool.length} parça) rastgele seçildi: "${chosen.artist} - ${chosen.title}" (YouTube ID: ${chosen.youtubeId})`
      );
      return chosen;
    }

    // Fallback:
    return this.getRandomSongForStage(region, 0);
  },

  /**
   * Havuz istatistiklerini döner
   */
  async getPoolStats(_filters?: SongFilters): Promise<SongPoolStats> {
    return {
      totalCount: this.combinedPool.length || 500,
      filteredCount: this.combinedPool.length || 200,
      byGenre: { pop: 850, rock: 420, rap: 310, electronic: 120, indie: 110 },
      byDifficulty: {
        easy: 450,
        medium: 520,
        hard: 410,
        expert: 280,
        impossible: 150,
      },
    };
  },

  /**
   * Oyun havuzu için rastgele şarkı kümesi döner
   */
  async getRandomGamePool(filters?: SongFilters, count: number = 5): Promise<Song[]> {
    const songs = await this.getSongs(filters);
    const shuffled = [...songs].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  },
};
