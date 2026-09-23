import React from 'react';
import { Badge, Card } from '@/components/ui';
import { formatScore } from '@/utils/formatters';

interface ScoreBoardProps {
  score: number;
  currentRound: number;
  totalRounds: number;
}

export const ScoreBoard: React.FC<ScoreBoardProps> = ({ score, currentRound, totalRounds }) => {
  return (
    <Card style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div>
        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', display: 'block' }}>
          Toplam Puan
        </span>
        <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-brand-primary)' }}>
          {formatScore(score)}
        </span>
      </div>

      <div style={{ textAlign: 'right' }}>
        <Badge variant="info">
          Tur {currentRound} / {totalRounds}
        </Badge>
      </div>
    </Card>
  );
};
