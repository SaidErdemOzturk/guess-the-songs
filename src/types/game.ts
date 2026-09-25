import type { EraFilter, GenreFilter, RegionFilter, Song } from './song';

export interface GameStage {
  stage: number;
  name: string;
  duration: number; // saniye (örn: 0.1, 0.5, 2.0, 8.0)
  skipAdd: string; // "+0.4s", vb.
  widthPercent: string;
}

export type GameStatus = 'idle' | 'playing' | 'paused' | 'round_success' | 'round_failed' | 'game_over';

export interface CreateGameSessionRequest {
  region: RegionFilter;
  genre: GenreFilter;
  era: EraFilter;
  artist?: string;
}

export interface GameSession {
  sessionId: string;
  songs: Song[];
  currentStageIndex: number;
  currentAttemptIndex: number;
  score: number;
  status: GameStatus;
  startedAt: string;
}

export interface GuessRequest {
  sessionId?: string;
  songId: number;
  stageIndex: number;
  attemptIndex: number;
  duration: number; // Hangi sürede bilindiği (0.1, 0.5, 2.0, 8.0)
  guessedTitle: string;
  userId?: string;
  roomCode?: string;
}

export interface GuessResponse {
  isCorrect: boolean;
  correctSong?: Song;
  pointsEarned: number;
  totalScore: number;
  durationUsed: number;
  isStageCompleted: boolean;
  isGameOver: boolean;
  message: string;
}

export interface LeaderboardItem {
  id: string;
  rank: number;
  playerName: string;
  score: number;
  stagesCompleted: number;
  accuracy: number;
  playedAt: string;
}
