import type { GameStage } from '@/types/game';

export const STAGES: GameStage[] = [
  { name: 'Kolay', stage: 1, duration: 0.1, skipAdd: '+0.4s', widthPercent: '6%' },
  { name: 'Orta', stage: 2, duration: 0.5, skipAdd: '+0.5s', widthPercent: '20%' },
  { name: 'Zor', stage: 3, duration: 1.0, skipAdd: '+2.0s', widthPercent: '40%' },
  // Uzman ve İmkansız sonradan eklenecek:
  // { name: 'Uzman', stage: 4, duration: 3.0, skipAdd: '+4.0s', widthPercent: '65%' },
  // { name: 'İmkansız', stage: 5, duration: 7.0, skipAdd: '+8.0s', widthPercent: '100%' },
];

export const ATTEMPT_DURATIONS: number[] = [0.1, 0.5, 2.0, 8.0];

/**
 * Deneme indeksine göre bir sonraki denemeye geçildiğinde tam olarak kaç saniye ekleneceğini döner.
 */
export const getAttemptSkipAdd = (attemptIndex: number): string => {
  if (attemptIndex < ATTEMPT_DURATIONS.length - 1) {
    const current = ATTEMPT_DURATIONS[attemptIndex];
    const next = ATTEMPT_DURATIONS[attemptIndex + 1];
    const diff = Number((next - current).toFixed(1));
    return `+${diff}s`;
  }
  return '';
};

export const GAME_CONFIG = {
  TOTAL_STAGES: 3,
  MAX_ATTEMPTS: 4,
  BASE_POINTS_PER_STAGE: 1000,
  ATTEMPT_PENALTY: 150,
  STORAGE_KEYS: {
    HIGH_SCORE: 'gts_high_score',
    USER_SETTINGS: 'gts_user_settings',
    LAST_SESSION: 'gts_last_session',
  },
} as const;
