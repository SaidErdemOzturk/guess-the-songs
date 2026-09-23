import { storage } from '@/utils/storage';
import type { AuthSession, LoginCredentials, User } from '@/types/auth';

const AUTH_STORAGE_KEY = 'gts_auth_session';

const INITIAL_SESSION: AuthSession = {
  user: null,
  token: null,
  isGuest: false,
};

export const authService = {
  /**
   * Kullanıcı girişi (Mock JWT token ve oturum üretir)
   */
  async login(credentials: LoginCredentials): Promise<AuthSession> {
    // API gecikmesi simülasyonu
    await new Promise((resolve) => setTimeout(resolve, 300));

    const emailName = credentials.email.split('@')[0] || 'Kullanıcı';
    const capitalizedName = emailName.charAt(0).toUpperCase() + emailName.slice(1);

    const user: User = {
      id: `usr_${Date.now()}`,
      name: capitalizedName,
      email: credentials.email,
      avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(capitalizedName)}`,
      createdAt: new Date().toISOString(),
    };

    const token = `mock_jwt_token_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const session: AuthSession = {
      user,
      token,
      isGuest: false,
    };

    storage.set(AUTH_STORAGE_KEY, session);
    return session;
  },

  /**
   * Misafir olarak devam et (Token üretilmez, tek kişilik oyun için isGuest: true)
   */
  continueAsGuest(): AuthSession {
    const session: AuthSession = {
      user: {
        id: `guest_${Date.now()}`,
        name: 'Misafir Oyuncu',
        email: 'misafir@oyuncu.local',
        createdAt: new Date().toISOString(),
      },
      token: null,
      isGuest: true,
    };

    storage.set(AUTH_STORAGE_KEY, session);
    return session;
  },

  /**
   * Çıkış yap
   */
  logout(): void {
    storage.remove(AUTH_STORAGE_KEY);
  },

  /**
   * Mevcut aktif oturumu döner
   */
  getSession(): AuthSession {
    return storage.get<AuthSession>(AUTH_STORAGE_KEY, INITIAL_SESSION);
  },

  /**
   * Aktif token'ı döner (Oda katılımında zorunludur)
   */
  getToken(): string | null {
    const session = this.getSession();
    return session.token;
  },

  /**
   * Kullanıcının token sahibi (giriş yapmış) olup olmadığını döner
   */
  isAuthenticated(): boolean {
    const session = this.getSession();
    return Boolean(session.token && !session.isGuest);
  },
};
