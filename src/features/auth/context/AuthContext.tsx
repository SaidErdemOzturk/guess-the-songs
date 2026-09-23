import React, { createContext, useContext, useEffect, useState } from 'react';
import { authService } from '@/services/api/authService';
import type { AuthSession, LoginCredentials, User } from '@/types/auth';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isGuest: boolean;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  continueAsGuest: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<AuthSession>(() => authService.getSession());
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setSession(authService.getSession());
  }, []);

  const login = async (credentials: LoginCredentials) => {
    setIsLoading(true);
    try {
      const newSession = await authService.login(credentials);
      setSession(newSession);
    } finally {
      setIsLoading(false);
    }
  };

  const continueAsGuest = () => {
    const guestSession = authService.continueAsGuest();
    setSession(guestSession);
  };

  const logout = () => {
    authService.logout();
    setSession(authService.getSession());
  };

  const isAuthenticated = Boolean(session.token && !session.isGuest);

  return (
    <AuthContext.Provider
      value={{
        user: session.user,
        token: session.token,
        isGuest: session.isGuest,
        isAuthenticated,
        isLoading,
        login,
        continueAsGuest,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth, AuthProvider içerisinde kullanılmalıdır.');
  }
  return context;
};
