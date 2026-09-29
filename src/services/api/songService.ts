import { spotifyService, getPlaylistIdByStage } from './spotifyService';
import type { DifficultyLevel, Song, SongFilters, SongPoolStats } from '@/types/song';

/**
 * Kurumsal Şarkı Servisi (Song Service)
 * Spotify Web API (Playlists, Search, Tracks) üzerinden şarkı havuzunu ve önizleme seslerini sağlar.
 */
export const songService = {
  /**
   * Filtrelere göre canlı şarkı listesi getirir
   */
  async getSongs(filters?: SongFilters): Promise<Song[]> {
    const query =
      filters?.search ||
      filters?.artist ||
      (filters?.genre && filters.genre !== 'all' ? filters.genre : (filters?.region === 'global' ? 'top hits' : 'türkçe pop'));

    try {
      return await spotifyService.searchTracks(query, 30);
    } catch {
      return [];
    }
  },

  /**
   * Şarkı ID'sine göre Spotify https://api.spotify.com/v1/tracks/{id} endpoint'inden şarkıyı getirir
   */
  async getSongById(id: string | number): Promise<Song | null> {
    try {
      return await spotifyService.getTrack(String(id));
    } catch (err) {
      console.warn(`[songService] Spotify track ${id} alınamadı:`, err);
      return null;
    }
  },

  /**
   * Başlık, sanatçı veya arama metnine göre Spotify üzerinde anlık arama (Autocomplete)
   */
  async searchSongs(query: string): Promise<Song[]> {
    if (!query.trim()) return [];

    try {
      return await spotifyService.searchTracks(query, 8);
    } catch (err) {
      console.warn('[songService] Spotify arama başarısız:', err);
      return [];
    }
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
   * Bölge ve aşama indeksine göre Spotify playlist'inden canlı şarkı listesi getirir.
   */
  async getPlayList(region: 'tr' | 'global' = 'tr', stageIndex: number = 0): Promise<Song[]> {
    const playlistId = getPlaylistIdByStage(region, stageIndex);

    try {
      const spotifySongs = await spotifyService.getPlaylistSongs(playlistId, {
        limit: 50,
        region,
      });

      if (spotifySongs.length > 0) {
        return spotifySongs;
      }
    } catch (err) {
      console.warn(`[songService] Spotify playlisti (${playlistId}) alınamadı:`, err);
    }

    // Fallback olarak arama ile canlı şarkılar çekilir
    const fallbackQuery = region === 'global' ? 'top hits' : 'türkçe pop';
    return await spotifyService.searchTracks(fallbackQuery, 20);
  },

  /**
   * İlgili aşama için o aşamanın Spotify playlistinden rastgele 1 şarkı seçer.
   * Playlist doğrudan tam Song modelini içerdiğinden ekstra /tracks/{id} isteğine gerek yoktur.
   */
  async getRandomSongForStage(region: 'tr' | 'global' = 'tr', stageIndex: number = 0): Promise<Song> {
    const songs = await this.getPlayList(region, stageIndex);
    if (songs.length > 0) {
      const randomIndex = Math.floor(Math.random() * songs.length);
      const chosen = songs[randomIndex];
      console.log(`🎵 [Spotify Playlist] Şarkı seçildi: "${chosen.artist} - ${chosen.title}" (ID: ${chosen.spotifyId})`);
      return chosen;
    }

    // Yedek liste: Playlist çekilemezse doğrudan hazır popüler parçalardan biri kullanılır
    const FALLBACK_SONGS: Song[] = [
      {
        id: 1,
        spotifyId: '7qiZfU4dY1lWllzX7mPBI3',
        title: 'Shape of You',
        artist: 'Ed Sheeran',
        year: 2017,
        genre: 'pop',
        region: 'global',
        difficulty: 'easy',
        difficultyRank: 1,
        startSecond: 0,
        duration: 30,
      },
      {
        id: 2,
        spotifyId: '0VjIjW4GlUZAMYd2vXMi3b',
        title: 'Blinding Lights',
        artist: 'The Weeknd',
        year: 2019,
        genre: 'pop',
        region: 'global',
        difficulty: 'easy',
        difficultyRank: 1,
        startSecond: 0,
        duration: 30,
      },
      {
        id: 3,
        spotifyId: '3KkXRQHbMCARz0aVfEt68P',
        title: 'Sunflower',
        artist: 'Post Malone',
        year: 2018,
        genre: 'pop',
        region: 'global',
        difficulty: 'easy',
        difficultyRank: 1,
        startSecond: 0,
        duration: 30,
      },
    ];
    return FALLBACK_SONGS[Math.floor(Math.random() * FALLBACK_SONGS.length)];
  },


  /**
   * Havuz istatistiklerini (tür, zorluk ve toplam adet) döner
   */
  async getPoolStats(filters?: SongFilters): Promise<SongPoolStats> {
    return {
      totalCount: 50000,
      filteredCount: 18136,
      byGenre: { pop: 8500, rock: 4200, rap: 3100, electronic: 1200, indie: 1136 },
      byDifficulty: {
        easy: 4500,
        medium: 5200,
        hard: 4100,
        expert: 2800,
        impossible: 1536,
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


