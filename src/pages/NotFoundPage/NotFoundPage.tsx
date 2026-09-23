import React from 'react';
import { Button, Card } from '@/components/ui';

interface NotFoundPageProps {
  onBackToHome: () => void;
}

export const NotFoundPage: React.FC<NotFoundPageProps> = ({ onBackToHome }) => {
  return (
    <div style={{ maxWidth: '480px', margin: '4rem auto', textAlign: 'center' }}>
      <Card>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔍</div>
        <h2 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '0.5rem' }}>404</h2>
        <p style={{ color: 'var(--color-text-secondary)', marginBottom: '1.5rem' }}>
          Aradığınız sayfa bulunamadı.
        </p>
        <Button variant="primary" onClick={onBackToHome}>
          Ana Sayfaya Dön
        </Button>
      </Card>
    </div>
  );
};
