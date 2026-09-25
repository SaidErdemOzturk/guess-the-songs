import React from 'react';
import { ATTEMPT_DURATIONS } from '@/constants/game';

interface AttemptDotsProps {
  currentAttemptIndex: number;
}

export const AttemptDots: React.FC<AttemptDotsProps> = ({ currentAttemptIndex }) => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.5rem',
        paddingTop: '0.5rem',
      }}
    >
      {ATTEMPT_DURATIONS.map((_, idx) => {
        const isReached = idx <= currentAttemptIndex;
        return (
          <span
            key={idx}
            style={{
              width: '0.5rem',
              height: '0.5rem',
              borderRadius: '9999px',
              backgroundColor: isReached ? '#6366f1' : 'rgba(255, 255, 255, 0.15)',
              boxShadow: isReached ? '0 0 8px rgba(99, 102, 241, 0.6)' : 'none',
              transition: 'all 200ms ease',
            }}
          />
        );
      })}
    </div>
  );
};
