import { songService } from '@/services/api/songService';
import type { Song } from '@/types/song';

export const gameApi = {
  async getRandomSongs(count: number = 5): Promise<Song[]> {
    return songService.getRandomGamePool(undefined, count);
  },
};
