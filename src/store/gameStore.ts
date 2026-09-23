import { storage } from '@/utils/storage';
import { GAME_CONFIG } from '@/constants/game';

interface GameState {
  highScore: number;
  totalGamesPlayed: number;
}

class GameStore {
  private state: GameState;
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.state = {
      highScore: storage.get<number>(GAME_CONFIG.STORAGE_KEYS.HIGH_SCORE, 0),
      totalGamesPlayed: 0,
    };
  }

  public getState(): GameState {
    return this.state;
  }

  public updateHighScore(score: number): void {
    if (score > this.state.highScore) {
      this.state.highScore = score;
      storage.set(GAME_CONFIG.STORAGE_KEYS.HIGH_SCORE, score);
      this.notify();
    }
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach((listener) => listener());
  }
}

export const gameStore = new GameStore();
