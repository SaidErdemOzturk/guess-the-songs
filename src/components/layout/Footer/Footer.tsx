import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer
      style={{
        width: '100%',
        paddingBottom: '1.5rem',
        paddingTop: '0.75rem',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.75rem',
        zIndex: 10,
      }}
    >
      {/* Altbilgi Rozeti */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.375rem',
          fontSize: '11px',
          color: 'rgba(156, 163, 175, 0.6)',
        }}
      >
        <span
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: '#6366f1',
          }}
        />
        <span>Türkçe Müzik Kütüphanesi</span>
        <span style={{ margin: '0 0.25rem' }}>·</span>
        <span>Powered by Vite & React</span>
      </div>
    </footer>
  );
};
