/**
 * Guess The Songs REST API Endpoints Haritası
 * Kurumsal Backend entegrasyonu için yapılandırılmıştır.
 */

export const ENDPOINTS = {
  // Şarkı kataloğu endpoint'leri
  SONGS: {
    BASE: '/api/v1/songs',
    SEARCH: '/api/v1/songs/search',
    RANDOM_POOL: '/api/v1/songs/random-pool',
    BY_ID: (id: number) => `/api/v1/songs/${id}`,
    POOL_STATS: '/api/v1/songs/stats',
  },

  // Sanatçılar
  ARTISTS: {
    BASE: '/api/v1/artists',
    SONGS: (artistName: string) => `/api/v1/artists/${encodeURIComponent(artistName)}/songs`,
  },

  // Oyun oturumu ve tahmin akışı
  GAME: {
    CREATE_SESSION: '/api/v1/game/session',
    SUBMIT_GUESS: '/api/v1/game/guess',
    SKIP_ATTEMPT: '/api/v1/game/skip',
    STAGES: '/api/v1/game/stages',
    COMPLETE_SESSION: '/api/v1/game/complete',
  },

  // Liderlik tablosu
  LEADERBOARD: {
    TOP: '/api/v1/leaderboard',
    SUBMIT: '/api/v1/leaderboard/submit',
  },

  // Oda ve Çok Oyunculu Mod (RoomsController)
  ROOMS: {
    GET_ALL: '/api/rooms/getall',
    GET_BY_CODE: '/api/rooms/getbycode',
    CREATE: '/api/rooms/create',
    JOIN: '/api/rooms/join',
    UPDATE_SCORE: '/api/rooms/updatescore',
    CHANGE_STATUS: '/api/rooms/changestatus',
    LEADERBOARD: '/api/rooms/leaderboard',
    SET_CURRENT_SONG: '/api/rooms/setcurrentsong',
    GET_CURRENT_SONG: '/api/rooms/currentsong',
  },

  // Kimlik Doğrulama ve Kullanıcılar (AuthController & UsersController)
  AUTH: {
    LOGIN: '/api/auth/login',
    REGISTER: '/api/auth/register',
  },
  USERS: {
    GET_ALL: '/api/users/getall',
    GET_BY_ID: (id: number) => `/api/users/getuserbyid?id=${id}`,
    GET_BY_EMAIL: (email: string) => `/api/users/getuserdtobyemail?email=${encodeURIComponent(email)}`,
    GET_CLAIMS: (id: number) => `/api/users/getclaims?id=${id}`,
  },
} as const;

