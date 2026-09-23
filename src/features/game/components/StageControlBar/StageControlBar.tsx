import React from 'react';
import { STAGES } from '@/constants/game';

interface StageControlBarProps {
  currentStageIndex: number;
  currentAttemptIndex: number;
  currentDuration: number;
  playbackSeconds: number;
  playbackRatio: number;
  isPlaying: boolean;
  onBackHome: () => void;
}

// 5 Deneme Aşamalarının kümülatif süre dağılımı
const STAGE_SEGMENT_WIDTHS = [6, 14, 20, 25, 35];

export const StageControlBar: React.FC<StageControlBarProps> = ({
  currentStageIndex,
  currentAttemptIndex,
  currentDuration,
  playbackSeconds,
  playbackRatio,
  isPlaying,
  onBackHome,
}) => {
  const currentStage = STAGES[currentStageIndex] || STAGES[0];

  const unlockedPercent = STAGE_SEGMENT_WIDTHS.slice(0, currentAttemptIndex + 1).reduce(
    (acc, cur) => acc + cur,
    0
  );

  const cursorLeftPercent = isPlaying
    ? Math.min(unlockedPercent, Math.max(0, unlockedPercent * playbackRatio))
    : playbackSeconds > 0
      ? unlockedPercent * (playbackSeconds / currentDuration)
      : 0;

  return (
    <div
      style={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      {/* Sol Üst Mod Değiştir Butonu */}
      <div
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          marginBottom: '1rem',
        }}
      >
        <button
          onClick={onBackHome}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.375rem',
            padding: '0.375rem 0.75rem',
            borderRadius: '9999px',
            backgroundColor: 'rgba(17, 24, 39, 0.85)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            fontSize: '0.75rem',
            color: '#9ca3af',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'all 150ms ease',
          }}
        >
          <i className="fa-solid fa-chevron-left" style={{ fontSize: '10px' }} />
          <span>Modu değiştir</span>
        </button>
      </div>

      {/* Zorluk Düzeyi Hapları */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.375rem',
          padding: '0.25rem',
          backgroundColor: 'rgba(17, 24, 39, 0.85)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '9999px',
          marginBottom: '0.75rem',
        }}
      >
        {STAGES.map((s, idx) => {
          const isActive = idx === currentStageIndex;
          return (
            <span
              key={s.stage}
              style={{
                fontSize: '0.75rem',
                padding: isActive ? '0.25rem 0.875rem' : '0.25rem 0.75rem',
                borderRadius: '9999px',
                fontWeight: isActive ? 700 : 500,
                background: isActive
                  ? 'linear-gradient(135deg, #6366f1 0%, #ec4899 100%)'
                  : 'transparent',
                color: isActive ? '#ffffff' : '#6b7280',
                boxShadow: isActive ? '0 0 15px rgba(99, 102, 241, 0.4)' : 'none',
                transition: 'all 200ms ease',
              }}
            >
              {s.name}
            </span>
          );
        })}
      </div>

      {/* Aşama Durum Başlığı */}
      <div
        className="font-mono-num"
        style={{
          fontSize: '0.8125rem',
          color: '#9ca3af',
          marginBottom: '1.25rem',
        }}
      >
        Aşama <span style={{ color: '#ffffff', fontWeight: 700 }}>{currentStage.stage}</span> / 5 ·{' '}
        <span style={{ color: '#818cf8', fontWeight: 600 }}>{currentStage.name}</span>
      </div>

      {/* Bölümlendirilmiş Zaman Çizgisi ve Canlı Playhead İmleci */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '36rem',
          backgroundColor: '#111827',
          padding: '0.375rem',
          borderRadius: '9999px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          marginBottom: '2.5rem',
          boxShadow: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.4)',
        }}
      >
        {/* Canlı Saniye Gösteren İmleç (Playhead Cursor) */}
        {(isPlaying || playbackSeconds > 0) && (
          <div
            style={{
              position: 'absolute',
              top: '-4px',
              bottom: '-4px',
              left: `calc(0.375rem + (100% - 0.75rem) * ${cursorLeftPercent / 100})`,
              width: '4px',
              backgroundColor: '#ffffff',
              borderRadius: '9999px',
              boxShadow: '0 0 12px #6366f1, 0 0 24px #ec4899',
              transform: 'translateX(-50%)',
              pointerEvents: 'none',
              zIndex: 20,
              transition: isPlaying ? 'none' : 'left 150ms ease',
            }}
          >
            {/* İmleç Başlığı / Tooltip (Hangi saniyede olduğunu gösteren rozet) */}
            <div
              className="font-mono-num"
              style={{
                position: 'absolute',
                bottom: '100%',
                left: '50%',
                transform: 'translateX(-50%)',
                marginBottom: '8px',
                padding: '2px 8px',
                borderRadius: '9999px',
                background: 'linear-gradient(135deg, #4f46e5 0%, #ec4899 100%)',
                border: '1px solid #818cf8',
                color: '#ffffff',
                fontSize: '11px',
                fontWeight: 700,
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                boxShadow: '0 0 15px rgba(99, 102, 241, 0.5)',
              }}
            >
              <span>⏱</span>
              <span>{playbackSeconds.toFixed(1)}s</span>
            </div>

            {/* İmleç Ok İşareti */}
            <div
              style={{
                position: 'absolute',
                bottom: '100%',
                left: '50%',
                transform: 'translateX(-50%)',
                marginBottom: '3px',
                width: 0,
                height: 0,
                borderLeft: '4px solid transparent',
                borderRight: '4px solid transparent',
                borderTop: '5px solid #ec4899',
              }}
            />
          </div>
        )}

        {/* 5 Segmentli İlerleme Çubuğu */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
            width: '100%',
            height: '0.5rem',
            borderRadius: '9999px',
            overflow: 'hidden',
          }}
        >
          {STAGE_SEGMENT_WIDTHS.map((width, idx) => {
            const isFilled = idx <= currentAttemptIndex;
            return (
              <div
                key={idx}
                style={{
                  height: '100%',
                  width: `${width}%`,
                  background: isFilled
                    ? 'linear-gradient(90deg, #6366f1 0%, #ec4899 100%)'
                    : 'rgba(31, 41, 55, 0.8)',
                  borderRadius: '9999px',
                  transition: 'all 300ms cubic-bezier(0.4, 0, 0.2, 1)',
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};
