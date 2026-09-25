import { MOCK_SONG_DATABASE } from '../mock/songDatabase';
import { spotifyService, getPlaylistIdByStage } from './spotifyService';
import { itunesService } from './itunesService';
import type { DifficultyLevel, Song, SongFilters, SongPoolStats } from '@/types/song';

/**
 * Kurumsal Şarkı Servisi (Song Service)
 * Tüm metotlar tip güvenli şekilde mock veritabanı, Spotify ve iTunes Search API
 * entegrasyonuyla zenginleştirilmiş şarkı havuzunu ve önizleme seslerini sağlar.
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
    if (!song) return null;
    return await itunesService.enrichSongWithPreview(song);
  },

  /**
   * Başlık, sanatçı ve alternatif isimlere göre anlık arama (Autocomplete)
   * 1. Spotify API
   * 2. Apple iTunes Search API
   * 3. Mock Veritabanı
   */
  async searchSongs(query: string): Promise<Song[]> {
    if (!query.trim()) return [];

    // 1. Spotify API bilgileri tanımlıysa canlı arama yap
    if (spotifyService.hasCredentials()) {
      try {
        const spotifyResults = await spotifyService.searchTracks(query, 8);
        if (spotifyResults.length > 0) {
          return spotifyResults;
        }
      } catch (err) {
        console.warn('Spotify araması başarısız, iTunes servisine dönülüyor:', err);
      }
    }

    // 2. Apple iTunes Search API (ücretsiz ve sınırsız doğrudan arama)
    try {
      const itunesResults = await itunesService.searchTracks(query, 8);
      if (itunesResults.length > 0) {
        return itunesResults;
      }
    } catch (err) {
      console.warn('iTunes araması başarısız, yerel veritabanına dönülüyor:', err);
    }

    // 3. Yerel Mock Veritabanı
    const q = query.toLowerCase().trim();
    return MOCK_SONG_DATABASE.filter(
      (song) => song.title.toLowerCase().includes(q) || song.artist.toLowerCase().includes(q)
    ).slice(0, 8);
  },

  /**
   * Belirli zorluk seviyesine göre şarkıları filtreler
   */
  async getSongsByDifficulty(difficulty: DifficultyLevel): Promise<Song[]> {
    return MOCK_SONG_DATABASE.filter((s) => s.difficulty === difficulty);
  },

  /**
   * Bölge ve aşama/zorluk indeksine (0: Kolay, 1: Orta, 2: Zor, 3: Uzman, 4: İmkansız) göre
   * Spotify'dan ilgili playlisti çeker.
   */
  async getPlayList(region: 'tr' | 'global' = 'tr', stageIndex: number = 0): Promise<Song[]> {
    const playlistId = getPlaylistIdByStage(region, stageIndex);

    if (spotifyService.hasCredentials()) {
      try {
        const spotifySongs = await spotifyService.getPlaylistSongs(playlistId, {
          limit: 50,
          region,
        });

        if (spotifySongs.length > 0) {
          return spotifySongs;
        }
      } catch (err) {
        console.warn(`Spotify playlisti (${playlistId}) alınamadı, yerel veritabanına dönülüyor:`, err);
      }
    }

    // Mock veritabanı fallback: Zorluk derecesine göre mock şarkıları döner (Kolay, Orta, Zor)
    const difficultyMap: DifficultyLevel[] = ['easy', 'medium', 'hard'];
    const diff = difficultyMap[stageIndex] || 'easy';
    const mockSongs = MOCK_SONG_DATABASE.filter((s) => s.region === region && s.difficulty === diff);
    return mockSongs.length > 0 ? mockSongs : MOCK_SONG_DATABASE.filter((s) => s.difficulty === diff);
  },

  /**
   * İlgili aşama için o aşamanın playlistinden rastgele 1 şarkı seçer
   * ve Apple iTunes Search API ile 30 saniyelik gerçek MP3/AAC önizleme sesini bağlar.
   */
  async getRandomSongForStage(region: 'tr' | 'global' = 'tr', stageIndex: number = 0): Promise<Song> {
    const songs = await this.getPlayList(region, stageIndex);
    if (songs.length > 0) {
      const randomIndex = Math.floor(Math.random() * songs.length);
      const chosen = songs[randomIndex];
      console.log(`🎲 [Playlist'ten Rastgele Şarkı Seçildi] (${randomIndex + 1}/${songs.length}): "${chosen.artist} - ${chosen.title}"`);
      return await itunesService.enrichSongWithPreview(chosen);
    }
    const defaultSong = MOCK_SONG_DATABASE[0];
    console.log(`🎲 [Varsayılan Şarkı Seçildi]: "${defaultSong.artist} - ${defaultSong.title}"`);
    return await itunesService.enrichSongWithPreview(defaultSong);
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
