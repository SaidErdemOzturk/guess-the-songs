import type { User } from './auth';
import type { EraFilter, GenreFilter, RegionFilter, Song } from './song';

export interface RoomParticipant {
  user: User;
  isHost: boolean;
  isReady: boolean;
  score: number;
  lastPointsEarned?: number;
  lastGuessDuration?: number;
  joinedAt: string;
}

export type RoomStatus = 'waiting' | 'in_game' | 'finished';

export interface RoomSettings {
  region: RegionFilter;
  genre: GenreFilter;
  era: EraFilter;
  guessTimeLimitMinutes?: number;
}

export interface Room {
  id: string;
  code: string; // Örn: GTS-7892
  name: string;
  hostId: string;
  hostName: string;
  participants: RoomParticipant[];
  maxParticipants?: number;
  guessTimeLimitMinutes?: number;
  status: RoomStatus;
  settings?: RoomSettings;
  createdAt: string;
  currentSong?: Song | null;
  currentRound?: number;
  currentRoundStartedAt?: string;
}

export interface CreateRoomRequest {
  name: string;
  maxParticipants?: number;
  guessTimeLimitMinutes?: number;
  settings?: RoomSettings;
}
