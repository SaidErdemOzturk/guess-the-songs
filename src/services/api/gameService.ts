import { apiClient } from './client';
import { ENDPOINTS } from './endpoints';
import { songService } from './songService';
import { GAME_CONFIG, STAGES } from '@/constants/game';
import { normalizeText } from '@/utils/formatters';
import type {
  CreateGameSessionRequest,
  GameSession,
  GameStage,
  GuessRequest,
  GuessResponse,
  Song,
} from '@/types';

/**
 * Hangi sürede bildiğine göre puan hesaplama fonksiyonu:
 * - 0.1 saniye: 1000 Puan (Süper refleks)
 * - 0.5 saniye: 800 Puan
 * - 1.0 saniye: 600 Puan
 * - 3.0 saniye: 400 Puan
 * - 7.0 saniye+: 200 Puan
 */
export function calculatePointsByDuration(duration: number, difficultyRank = 1): number {
  let basePoints = 200;
  if (duration <= 0.15) {
    basePoints = 1000;
  } else if (duration <= 0.55) {
    basePoints = 800;
  } else if (duration <= 1.05) {
    basePoints = 600;
  } else if (duration <= 3.05) {
    basePoints = 400;
  } else {
    basePoints = 200;
  }

  // Şarkı zorluk derecesi çarpanı (1x - 1.4x)
  const multiplier = 1 + (difficultyRank - 1) * 0.1;
  return Math.round(basePoints * multiplier);
}

/**
 * Oyun Oturumu ve Kuralları Servisi (Game Service)
 */
export const gameService = {
  /**
   * Başla'ya basılınca bölgeyi, türü ve dönemi backend servisine gönderir
   * ve filtrelenmiş oyun şarkılarını içeren oturumu döndürür.
   */
  async createSession(params: CreateGameSessionRequest): Promise<GameSession> {
    try {
      // Backend API çağrısı: POST /api/v1/game/session { region, genre, era, artist }
      return await apiClient.post<GameSession>(ENDPOINTS.GAME.CREATE_SESSION, params);
    } catch {
      // Backend simülasyonu: Backend filtrelenmiş hazır mock şarkı listesini döner
      const backendFilteredSongs = await songService.getRandomGamePool(params, GAME_CONFIG.TOTAL_STAGES);

      return {
        sessionId: `session_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        songs: backendFilteredSongs,
        currentStageIndex: 0,
        currentAttemptIndex: 0,
        score: 0,
        status: 'playing',
        startedAt: new Date().toISOString(),
      };
    }
  },

  /**
   * Oyuncunun şarkı tahminini backend servisine doğrulatır.
   * Doğru bilinirse hangi sürede bildiyse o süreye göre puan ekler.
   */
  async submitGuess(
    request: GuessRequest,
    currentSong: Song,
    guessedTitle: string
  ): Promise<GuessResponse> {
    try {
      return await apiClient.post<GuessResponse>(ENDPOINTS.GAME.SUBMIT_GUESS, request);
    } catch {
      const normalizedGuess = normalizeText(guessedTitle);
      const normalizedActual = normalizeText(currentSong.title);
      const isCorrect = normalizedGuess === normalizedActual;

      let points = 0;
      if (isCorrect) {
        // Süreye göre puan hesaplama
        points = calculatePointsByDuration(request.duration, currentSong.difficultyRank);
      }

      const isStageCompleted = isCorrect || request.attemptIndex >= GAME_CONFIG.MAX_ATTEMPTS - 1;
      const isGameOver = isStageCompleted && request.stageIndex >= GAME_CONFIG.TOTAL_STAGES - 1;

      let message = 'Yanlış tahmin! Sonraki süre kesiti açıldı.';
      if (isCorrect) {
        message = `Tebrikler! ${request.duration}s içinde bildin (+${points} Puan) — ${currentSong.artist} - ${currentSong.title}`;
      } else if (request.attemptIndex >= GAME_CONFIG.MAX_ATTEMPTS - 1) {
        message = `Tüm denemeler tükendi! Doğru parça: ${currentSong.artist} - ${currentSong.title}`;
      }

      return {
        isCorrect,
        correctSong: isStageCompleted ? currentSong : undefined,
        pointsEarned: points,
        totalScore: points,
        durationUsed: request.duration,
        isStageCompleted,
        isGameOver,
        message,
      };
    }
  },

  /**
   * Oyun aşamalarının (Zorluk, Süre, Segment genişlikleri) konfigürasyonunu döner
   */
  async getStages(): Promise<GameStage[]> {
    return STAGES;
  },
};
