import { MOCK_SONG_DATABASE } from '../mock/songDatabase';
import type { Song } from '@/types/song';

export interface ArtistInfo {
  name: string;
  songCount: number;
  genres: string[];
  sampleSongs: string[];
}

/**
 * Sanatçı Servisi (Artist Service)
 * Mock veritabanındaki sanatçı verilerini ve parçalarını döndürür.
 */
export const artistService = {
  /**
   * Tüm sanatçıların özet bilgilerini getirir
   */
  async getArtists(): Promise<ArtistInfo[]> {
    const artistMap: Record<
      string,
      { songCount: number; genres: Set<string>; sampleSongs: string[] }
    > = {};

    MOCK_SONG_DATABASE.forEach((song) => {
      if (!artistMap[song.artist]) {
        artistMap[song.artist] = {
          songCount: 0,
          genres: new Set(),
          sampleSongs: [],
        };
      }
      artistMap[song.artist].songCount++;
      artistMap[song.artist].genres.add(song.genre);
      if (artistMap[song.artist].sampleSongs.length < 3) {
        artistMap[song.artist].sampleSongs.push(song.title);
      }
    });

    return Object.entries(artistMap).map(([name, data]) => ({
      name,
      songCount: data.songCount,
      genres: Array.from(data.genres),
      sampleSongs: data.sampleSongs,
    }));
  },

  /**
   * Belirli bir sanatçının tüm şarkılarını getirir
   */
  async getArtistSongs(artistName: string): Promise<Song[]> {
    const lower = artistName.toLowerCase().trim();
    return MOCK_SONG_DATABASE.filter(
      (s) =>
        s.artist.toLowerCase() === lower ||
        s.featuredArtists?.some((f) => f.toLowerCase() === lower)
    );
  },
};
