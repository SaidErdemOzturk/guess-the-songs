import type { User } from './auth';
import type { EraFilter, GenreFilter, RegionFilter } from './song';

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
}

export interface Room {
  id: string;
  code: string; // Örn: GTS-7892
  name: string;
  hostId: string;
  hostName: string;
  participants: RoomParticipant[];
  maxParticipants: number;
  status: RoomStatus;
  settings?: RoomSettings;
  createdAt: string;
}

export interface CreateRoomRequest {
  name: string;
  maxParticipants?: number;
  settings?: RoomSettings;
}
