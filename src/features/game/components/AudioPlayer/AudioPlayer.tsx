import React from 'react';
import type { FeedbackState } from '../../hooks/useGameRound';

interface AudioPlayerProps {
  duration: number;
  isPlaying: boolean;
  playbackSeconds: number;
  onTogglePlay: () => void;
  feedback: FeedbackState | null;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  duration,
  isPlaying,
  playbackSeconds,
  onTogglePlay,
  feedback,
}) => {
  const displayTime = isPlaying
    ? `${playbackSeconds.toFixed(1)}s`
    : playbackSeconds > 0
      ? `${playbackSeconds.toFixed(1)}s`
      : `${duration}s`;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        margin: 'auto 0',
        padding: '0.5rem 0',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.75rem' }}>
        {/* Büyük Yuvarlak İndigo-Pembe Oynat Butonu */}
        <button
          onClick={onTogglePlay}
          style={{
            position: 'relative',
            width: '6.5rem',
            height: '6.5rem',
            borderRadius: '9999px',
            background: 'linear-gradient(135deg, #6366f1 0%, #ec4899 100%)',
            boxShadow: isPlaying
              ? '0 0 35px rgba(99, 102, 241, 0.7), 0 0 60px rgba(236, 72, 153, 0.4)'
              : '0 4px 20px rgba(99, 102, 241, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 200ms ease',
            transform: isPlaying ? 'scale(1.05)' : 'scale(1)',
          }}
        >
          {isPlaying && (
            <span
              className="pulse-effect"
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '9999px',
                background: 'linear-gradient(135deg, #6366f1, #ec4899)',
                pointerEvents: 'none',
              }}
            />
          )}
          <i
            className={`fa-solid ${isPlaying ? 'fa-pause' : 'fa-play'}`}
            style={{
              color: '#ffffff',
              fontSize: '1.75rem',
              marginLeft: isPlaying ? '0' : '0.25rem',
              transition: 'transform 200ms ease',
              position: 'relative',
              zIndex: 2,
            }}
          />
        </button>

        {/* Canlı Süre Göstergesi */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span
            className="font-mono-num"
            style={{
              fontSize: '2rem',
              fontWeight: 800,
              color: '#818cf8',
              letterSpacing: '-0.05em',
              filter: 'drop-shadow(0 0 10px rgba(99, 102, 241, 0.4))',
              minWidth: '5rem',
            }}
          >
            {displayTime}
          </span>
          {isPlaying && (
            <span
              className="font-mono-num"
              style={{
                fontSize: '11px',
                color: '#9ca3af',
                marginTop: '-2px',
              }}
            >
              / {duration}s
            </span>
          )}
        </div>
      </div>

      {/* Yönlendirme Metni */}
      <p
        className="font-mono-num"
        style={{
          fontSize: '0.8125rem',
          color: '#9ca3af',
          marginTop: '1.25rem',
          textAlign: 'center',
        }}
      >
        {isPlaying
          ? `Oynatılıyor: ${playbackSeconds.toFixed(1)} / ${duration}s`
          : `Hazır. İlk ${duration} saniyeyi dinlemek için oynat'a bas.`}
      </p>

      {/* Doğru/Yanlış Alert Kutusu */}
      {feedback && (
        <div
          style={{
            marginTop: '0.75rem',
            padding: '0.5rem 1rem',
            borderRadius: '0.75rem',
            fontSize: '0.8125rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            backgroundColor: feedback.isSuccess
              ? 'rgba(16, 185, 129, 0.2)'
              : 'rgba(239, 68, 68, 0.2)',
            color: feedback.isSuccess ? '#34d399' : '#f87171',
            border: feedback.isSuccess
              ? '1px solid rgba(16, 185, 129, 0.4)'
              : '1px solid rgba(239, 68, 68, 0.4)',
          }}
        >
          <i
            className={`fa-solid ${feedback.isSuccess ? 'fa-circle-check' : 'fa-circle-xmark'}`}
          />
          <span>{feedback.message}</span>
        </div>
      )}
    </div>
  );
};
