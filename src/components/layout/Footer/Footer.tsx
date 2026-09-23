import React, { useState } from 'react';
import { webAudioService } from '@/services/audio/webAudioService';

export const Footer: React.FC = () => {
  const [volume, setVolumeState] = useState<number>(webAudioService.getVolume());
  const [isMuted, setIsMutedState] = useState<boolean>(webAudioService.getIsMuted());

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolumeState(val);
    webAudioService.setVolume(val);
    setIsMutedState(val === 0);
  };

  const handleMuteToggle = () => {
    const muted = webAudioService.toggleMute();
    setIsMutedState(muted);
  };

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
      {/* Ses Seviyesi Kontrol Kapsülü */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '0.375rem 1rem',
          backgroundColor: 'rgba(17, 24, 39, 0.85)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '9999px',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
        }}
      >
        <button
          onClick={handleMuteToggle}
          title={isMuted ? 'Sesi Aç' : 'Sessize Al'}
          style={{
            color: isMuted ? '#ef4444' : '#818cf8',
            fontSize: '0.75rem',
            cursor: 'pointer',
          }}
        >
          <i
            className={`fa-solid ${
              isMuted
                ? 'fa-volume-xmark'
                : volume > 0.5
                  ? 'fa-volume-high'
                  : 'fa-volume-low'
            }`}
          />
        </button>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={isMuted ? 0 : volume}
          onChange={handleVolumeChange}
          style={{ width: '6.5rem', cursor: 'pointer' }}
        />
      </div>

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
