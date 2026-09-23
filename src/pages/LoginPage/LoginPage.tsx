import React, { useState } from 'react';
import { useAuth } from '@/features/auth/context/AuthContext';
import { Button, Card, Input } from '@/components/ui';

interface LoginPageProps {
  pendingInviteRoomCode?: string | null;
  onSuccessLogin: () => void;
  onContinueAsGuest: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  pendingInviteRoomCode,
  onSuccessLogin,
  onContinueAsGuest,
}) => {
  const { login, continueAsGuest, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Lütfen e-posta adresinizi girin.');
      return;
    }

    try {
      setError(null);
      await login({ email: email.trim(), password });
      onSuccessLogin();
    } catch {
      setError('Giriş yapılırken bir hata oluştu.');
    }
  };

  const handleQuickDemoLogin = async (demoEmail: string) => {
    setEmail(demoEmail);
    try {
      setError(null);
      await login({ email: demoEmail });
      onSuccessLogin();
    } catch {
      setError('Giriş yapılırken bir hata oluştu.');
    }
  };

  const handleGuest = () => {
    continueAsGuest();
    onContinueAsGuest();
  };

  return (
    <div
      style={{
        width: '100%',
        maxWidth: '28rem',
        margin: '1.5rem auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        zIndex: 10,
      }}
    >
      <Card style={{ width: '100%', padding: '2rem' }}>
        {/* Başlık */}
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🎧</div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f9fafb' }}>
            {pendingInviteRoomCode ? 'Odaya Katılmak İçin Giriş Yap' : 'Giriş Yap'}
          </h2>
          <p style={{ color: '#9ca3af', fontSize: '0.8125rem', marginTop: '0.25rem' }}>
            {pendingInviteRoomCode ? (
              <span style={{ color: '#818cf8', fontWeight: 600 }}>
                {pendingInviteRoomCode} kodlu odaya davet edildiniz.
              </span>
            ) : (
              'Oda kurmak ve arkadaşlarınızla yarışmak için hesabınıza giriş yapın.'
            )}
          </p>
        </div>

        {/* Hata Mesajı */}
        {error && (
          <div
            style={{
              padding: '0.5rem 0.75rem',
              backgroundColor: 'rgba(239, 68, 68, 0.2)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              borderRadius: 'var(--radius-sm)',
              color: '#f87171',
              fontSize: '0.75rem',
              marginBottom: '1rem',
            }}
          >
            {error}
          </div>
        )}

        {/* Giriş Formu */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <Input
            label="E-posta Adresi"
            type="email"
            placeholder="ornek@mail.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isLoading}
            required
          />

          <Input
            label="Şifre"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
          />

          <Button type="submit" variant="primary" size="md" isLoading={isLoading} style={{ width: '100%', marginTop: '0.5rem' }}>
            Giriş Yap & Devam Et
          </Button>
        </form>

        {/* Hızlı Demo Hesaplar */}
        <div style={{ marginTop: '1.25rem', textAlign: 'center' }}>
          <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>Hızlı Demo Giriş:</span>
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginTop: '0.5rem' }}>
            <button
              type="button"
              onClick={() => handleQuickDemoLogin('ahmet@muzik.com')}
              style={{
                fontSize: '0.75rem',
                padding: '0.25rem 0.6rem',
                borderRadius: '9999px',
                backgroundColor: 'rgba(99, 102, 241, 0.15)',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                color: '#a5b4fc',
                cursor: 'pointer',
              }}
            >
              Ahmet
            </button>
            <button
              type="button"
              onClick={() => handleQuickDemoLogin('zeynep@muzik.com')}
              style={{
                fontSize: '0.75rem',
                padding: '0.25rem 0.6rem',
                borderRadius: '9999px',
                backgroundColor: 'rgba(236, 72, 153, 0.15)',
                border: '1px solid rgba(236, 72, 153, 0.3)',
                color: '#f472b6',
                cursor: 'pointer',
              }}
            >
              Zeynep
            </button>
          </div>
        </div>

        {/* Ayırıcı */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            margin: '1.5rem 0',
            gap: '0.75rem',
          }}
        >
          <div style={{ flex: 1, height: '1px', backgroundColor: 'rgba(255, 255, 255, 0.1)' }} />
          <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>veya</span>
          <div style={{ flex: 1, height: '1px', backgroundColor: 'rgba(255, 255, 255, 0.1)' }} />
        </div>

        {/* Misafir Olarak Devam Et Butonu */}
        <Button
          type="button"
          variant="secondary"
          size="md"
          onClick={handleGuest}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
          }}
        >
          <span>👤</span>
          <span>Misafir Olarak Devam Et (Tek Başına Oyna)</span>
        </Button>
      </Card>
    </div>
  );
};
