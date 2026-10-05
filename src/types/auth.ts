export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  createdAt: string;
}

export interface LoginCredentials {
  email: string;
  password?: string;
}

export interface RegisterCredentials {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface ResetPasswordCredentials {
  email: string;
  newPassword: string;
}

export interface AccessToken {
  token: string;
  expiration: string;
}

export interface AuthResult<T = AccessToken> {
  data: T;
  success: boolean;
  message?: string;
}

export interface AuthSession {
  user: User | null;
  token: string | null;
  isGuest: boolean;
}

