import { apiClient } from './client';
import { ENDPOINTS } from './endpoints';
import { storage } from '@/utils/storage';
import type {
  AuthSession,
  LoginCredentials,
  RegisterCredentials,
  ResetPasswordCredentials,
  User,
  AccessToken,
  AuthResult,
} from '@/types/auth';

const AUTH_STORAGE_KEY = 'gts_auth_session';

const INITIAL_SESSION: AuthSession = {
  user: null,
  token: null,
  isGuest: false,
};

/**
 * JWT payload'unu güvenli bir şekilde deşifre eden yardımcı fonksiyon
 */
function parseJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    console.warn('[authService] JWT payload parse edilemedi:', e);
    return null;
  }
}

/**
 * Token ve ek bilgilerden User nesnesi oluşturur
 */
function createUserFromToken(token: string, fallback?: { email?: string; name?: string }): User {
  const payload = parseJwtPayload(token);

  // ASP.NET Core ClaimTypes eşlemeleri
  const id =
    (payload?.['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'] as string) ||
    (payload?.['nameid'] as string) ||
    (payload?.['sub'] as string) ||
    `usr_${Date.now()}`;

  const email =
    (payload?.['email'] as string) ||
    (payload?.['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'] as string) ||
    fallback?.email ||
    '';

  const tokenName =
    (payload?.['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'] as string) ||
    (payload?.['unique_name'] as string) ||
    (payload?.['name'] as string);

  const fallbackName = fallback?.name || (email ? email.split('@')[0] : 'Kullanıcı');
  const name = tokenName?.trim() || fallbackName;
  const capitalizedName = name.charAt(0).toUpperCase() + name.slice(1);

  return {
    id: String(id),
    name: capitalizedName,
    email,
    avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(capitalizedName)}`,
    createdAt: new Date().toISOString(),
  };
}

export const authService = {
  /**
   * Kullanıcı girişi (Backend POST /api/auth/login)
   * guess-the-songs-backend AuthController.Login ile tam uyumludur.
   */
  async login(credentials: LoginCredentials): Promise<AuthSession> {
    try {
      const response = await apiClient.post<AuthResult<AccessToken> | AccessToken>(
        ENDPOINTS.AUTH.LOGIN,
        {
          email: credentials.email.trim(),
          password: credentials.password || '',
        }
      );

      // Backend SuccessDataResult<AccessToken> döner: { success, message, data: { token, expiration } }
      // ya da doğrudan AccessToken dönerse: { token, expiration }
      const token =
        (response as AuthResult<AccessToken>)?.data?.token ||
        (response as AccessToken)?.token;

      if (!token) {
        throw new Error('Giriş başarısız: Sunucudan erişim tokenı alınamadı.');
      }

      const user = createUserFromToken(token, {
        email: credentials.email.trim(),
      });

      const session: AuthSession = {
        user,
        token,
        isGuest: false,
      };

      storage.set(AUTH_STORAGE_KEY, session);
      return session;
    } catch (error: any) {
      // Backend kapalıysa ve hızlı demo hesabı deneniyorsa kullanıcıyı bloke etmemek için fallback
      const isConnectionError =
        error?.message?.includes('Failed to fetch') ||
        error?.message?.includes('NetworkError') ||
        error?.message?.includes('ECONNREFUSED');

      if (isConnectionError) {
        const isDemo = credentials.email.includes('@muzik.com') || !credentials.password;
        if (isDemo) {
          console.warn('[authService] Backend çevrimdışı, demo hesabı için mock oturum üretiliyor.');
          return this.createMockSession(credentials.email);
        }
        throw new Error(
          'Backend sunucusuna ulaşılamadı. Lütfen backend API servisinin çalıştığından emin olun (http://localhost:5216).'
        );
      }

      throw error;
    }
  },

  /**
   * Kullanıcı kaydı (Backend POST /api/auth/register)
   * guess-the-songs-backend AuthController.Register ile tam uyumludur.
   */
  async register(credentials: RegisterCredentials): Promise<AuthSession> {
    const fullName = `${credentials.firstName.trim()} ${credentials.lastName.trim()}`.trim();

    try {
      const response = await apiClient.post<AccessToken | AuthResult<AccessToken>>(
        ENDPOINTS.AUTH.REGISTER,
        {
          email: credentials.email.trim(),
          password: credentials.password,
          firstName: credentials.firstName.trim(),
          lastName: credentials.lastName.trim(),
        }
      );

      // Backend AuthController.Register Ok(result.Data) döner: { token, expiration }
      // ya da IDataResult formatında: { success, message, data: { token } }
      const token =
        (response as AccessToken)?.token ||
        (response as AuthResult<AccessToken>)?.data?.token;

      if (!token) {
        throw new Error('Kayıt başarısız: Sunucudan erişim tokenı alınamadı.');
      }

      const user = createUserFromToken(token, {
        email: credentials.email.trim(),
        name: fullName,
      });

      const session: AuthSession = {
        user,
        token,
        isGuest: false,
      };

      storage.set(AUTH_STORAGE_KEY, session);
      return session;
    } catch (error: any) {
      const isConnectionError =
        error?.message?.includes('Failed to fetch') ||
        error?.message?.includes('NetworkError') ||
        error?.message?.includes('ECONNREFUSED');

      if (isConnectionError) {
        throw new Error(
          'Backend sunucusuna ulaşılamadı. Lütfen backend API servisinin çalıştığından emin olun (http://localhost:5216).'
        );
      }

      throw error;
    }
  },

  /**
   * Şifre sıfırlama (Backend POST /api/auth/reset-password)
   */
  async resetPassword(credentials: ResetPasswordCredentials): Promise<string> {
    try {
      const response = await apiClient.post<{ success: boolean; message: string } | string>(
        ENDPOINTS.AUTH.RESET_PASSWORD,
        {
          email: credentials.email.trim(),
          newPassword: credentials.newPassword,
        }
      );

      const msg =
        typeof response === 'object' && response?.message
          ? response.message
          : typeof response === 'string'
          ? response
          : 'Şifreniz başarıyla güncellendi.';

      return msg;
    } catch (error: any) {
      const isConnectionError =
        error?.message?.includes('Failed to fetch') ||
        error?.message?.includes('NetworkError') ||
        error?.message?.includes('ECONNREFUSED');

      if (isConnectionError) {
        throw new Error(
          'Backend sunucusuna ulaşılamadı. Lütfen backend API servisinin çalıştığından emin olun (http://localhost:5216).'
        );
      }

      throw error;
    }
  },

  /**
   * Demo hesaplar için backend çevrimdışıyken çalışan mock oturum üretici
   */
  createMockSession(email: string): AuthSession {
    const emailName = email.split('@')[0] || 'Kullanıcı';
    const capitalizedName = emailName.charAt(0).toUpperCase() + emailName.slice(1);

    const user: User = {
      id: `usr_${Date.now()}`,
      name: capitalizedName,
      email,
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
