/**
 * Kurumsal Tip Güvenli Çevre Değişkenleri Konfigürasyonu
 * import.meta.env doğrudan kullanılmak yerine bu katman üzerinden doğrulanarak tüketilir.
 * SSR, test ortamları ve Node çalıştırıcıları için güvenli fallback içerir.
 */

export interface AppConfig {
  appTitle: string;
  apiBaseUrl: string;
  env: 'development' | 'staging' | 'production' | 'test';
  audioPreviewDuration: number;
}

const metaEnv: Record<string, string | undefined> =
  typeof import.meta !== 'undefined' && (import.meta as any).env
    ? (import.meta as any).env
    : {};

export const env: AppConfig = {
  appTitle: metaEnv.VITE_APP_TITLE || 'Guess The Songs',
  apiBaseUrl: metaEnv.VITE_API_BASE_URL || 'https://api.example.com',
  env: (metaEnv.VITE_APP_ENV as AppConfig['env']) || 'development',
  audioPreviewDuration: Number(metaEnv.VITE_AUDIO_PREVIEW_DURATION) || 30,
};
