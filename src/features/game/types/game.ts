import type { Song } from '@/types/song';

export type GameStatus = 'idle' | 'playing' | 'round_success' | 'round_failed' | 'game_over';

export interface GameRound {
  currentRound: number;
  totalRounds: number;
  currentSong: Song | null;
  timeLeft: number;
  score: number;
  status: GameStatus;
}
