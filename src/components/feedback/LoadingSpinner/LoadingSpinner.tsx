import React from 'react';

export interface LoadingSpinnerProps {
  size?: number;
  color?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ size = 28, color = 'var(--color-brand-primary)' }) => {
  return (
    <div
      style={{
        width: size,
        height: size,
        border: `3px solid rgba(255, 255, 255, 0.1)`,
        borderTopColor: color,
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
        display: 'inline-block',
      }}
    >
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
