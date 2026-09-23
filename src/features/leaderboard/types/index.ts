import type { BaseEntity } from '@/types/common';

export interface LeaderboardEntry extends BaseEntity {
  playerName: string;
  score: number;
  accuracy: number;
  playedAt: string;
}
