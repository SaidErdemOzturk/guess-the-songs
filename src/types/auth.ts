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

export interface AuthSession {
  user: User | null;
  token: string | null;
  isGuest: boolean;
}
