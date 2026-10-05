import React from 'react';
import { STAGES } from '@/constants/game';
import type { GameStage } from '@/types/game';

interface StageControlBarProps {
  stages?: GameStage[];
  currentStageIndex: number;
  currentAttemptIndex: number;
  currentDuration: number;
  playbackSeconds: number;
  playbackRatio: number;
  isPlaying: boolean;
  isSolved?: boolean;
  isWrong?: boolean;
  isSongRevealed?: boolean;
  score?: number;
  potentialPoints?: number;
  lastEarnedPoints?: number | null;
  roundCountdownSeconds?: number;
  showChangeMode?: boolean;
  onBackHome?: () => void;
}

// 4 Deneme Aşamalarının süre dağılımı (0.5s, +1.5s = 2.0s, +6.0s = 8.0s, +7.0s = 15.0s)
const STAGE_SEGMENT_WIDTHS = [10, 20, 35, 35];

export const StageControlBar: React.FC<StageControlBarProps> = ({
  stages = STAGES,
  currentStageIndex,
  currentAttemptIndex,
  currentDuration,
  playbackSeconds,
  playbackRatio,
  isPlaying,
  isSolved = false,
  isWrong = false,
  isSongRevealed = false,
  score = 0,
  potentialPoints = 800,
  lastEarnedPoints = null,
  roundCountdownSeconds,
  showChangeMode = true,
  onBackHome,
}) => {
  const activeStages = stages && stages.length > 0 ? stages : STAGES;
  const currentStage = activeStages[currentStageIndex] || activeStages[0] || STAGES[0];

  const formatCountdown = (totalSec: number) => {
    const mins = Math.floor(Math.max(0, totalSec) / 60);
    const secs = Math.max(0, totalSec) % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const isFullBar = isSolved || (isWrong && (isSongRevealed || currentDuration >= 15.0));

  const unlockedPercent = isFullBar
    ? 100
    : STAGE_SEGMENT_WIDTHS.slice(0, currentAttemptIndex + 1).reduce(
        (acc, cur) => acc + cur,
        0
      );

  const effectiveDuration = isFullBar ? (isSolved ? 8.0 : 15.0) : currentDuration;

  const barColor = isSolved ? '#10b981' : isWrong ? '#ef4444' : '#a855f7';
  const barBorder = isSolved ? '#34d399' : isWrong ? '#f87171' : '#c084fc';
  const barGlow = isSolved
    ? 'rgba(16, 185, 129, 0.4)'
    : isWrong
      ? 'rgba(239, 68, 68, 0.4)'
      : 'rgba(168, 85, 247, 0.35)';

  const cursorLeftPercent = isPlaying
    ? Math.min(unlockedPercent, Math.max(0, unlockedPercent * playbackRatio))
    : playbackSeconds > 0
      ? Math.min(unlockedPercent, Math.max(0, unlockedPercent * (isFullBar ? Math.min(1, (playbackSeconds % 30) / 30) : playbackSeconds / effectiveDuration)))
      : 0;

  const showPlayhead = !isSongRevealed && (isPlaying || playbackSeconds > 0);

  return (
    <div
      style={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      {/* Üst Bar: Sol (Mod Değiştir) & Sağ (Süre, Aktif Puan ve Bilince Kazanılacak Puan) */}
      <div
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: showChangeMode ? 'space-between' : 'flex-end',
          flexWrap: 'wrap',
          gap: '0.75rem',
          marginBottom: '1rem',
        }}
      >
        {showChangeMode && onBackHome && (
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
        )}

        {/* Durum Rozetleri (Geri Sayım Sayacı, Aktif Puan & Bilince Kazanılacak Puan) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap' }}>
          {/* Şarkı Bilme Süresi Geri Sayım Rozeti */}
          {roundCountdownSeconds !== undefined && (
            <div
              id="badge-round-countdown"
              title="Şarkıyı bilmek için kalan süre. Süre dolarsa pes edilmiş sayılır."
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.375rem 0.875rem',
                borderRadius: '9999px',
                backgroundColor: 'rgba(17, 24, 39, 0.85)',
                backdropFilter: 'blur(8px)',
                border:
                  !isSongRevealed && roundCountdownSeconds <= 15
                    ? '1px solid rgba(239, 68, 68, 0.6)'
                    : '1px solid rgba(129, 140, 248, 0.35)',
                boxShadow:
                  !isSongRevealed && roundCountdownSeconds <= 15
                    ? '0 0 15px rgba(239, 68, 68, 0.35)'
                    : '0 0 12px rgba(99, 102, 241, 0.15)',
                fontSize: '0.75rem',
                transition: 'all 200ms ease',
              }}
            >
              <i
                className="fa-solid fa-stopwatch"
                style={{
                  color:
                    !isSongRevealed && roundCountdownSeconds <= 15
                      ? '#f87171'
                      : '#818cf8',
                  fontSize: '0.8125rem',
                  animation: !isSongRevealed && roundCountdownSeconds <= 15 ? 'pulse 1s infinite' : 'none',
                }}
              />
              <span style={{ color: '#9ca3af', fontWeight: 600 }}>Süre:</span>
              <span
                className="font-mono-num"
                style={{
                  color:
                    !isSongRevealed && roundCountdownSeconds <= 15
                      ? '#f87171'
                      : '#ffffff',
                  fontWeight: 800,
                  fontSize: '0.875rem',
                  letterSpacing: '-0.02em',
                }}
              >
                {formatCountdown(roundCountdownSeconds)}
              </span>
            </div>
          )}
          {/* Aktif Puan */}
          <div
            id="badge-active-score"
            title="Toplam Puan"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.375rem 0.875rem',
              borderRadius: '9999px',
              backgroundColor: 'rgba(17, 24, 39, 0.85)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(251, 191, 36, 0.35)',
              boxShadow: '0 0 15px rgba(245, 158, 11, 0.15)',
              fontSize: '0.75rem',
            }}
          >
            <i className="fa-solid fa-trophy" style={{ color: '#fbbf24', fontSize: '0.8125rem' }} />
            <span style={{ color: '#9ca3af', fontWeight: 600 }}>Puan:</span>
            <span
              className="font-mono-num"
              style={{
                color: '#fbbf24',
                fontWeight: 800,
                fontSize: '0.875rem',
                letterSpacing: '-0.02em',
              }}
            >
              {score.toLocaleString()}
            </span>
          </div>

          {/* Şarkıyı Bilince Kazanılacak Puan */}
          <div
            id="badge-potential-score"
            title={
              isSongRevealed
                ? isSolved
                  ? 'Bu şarkıdan kazanılan puan'
                  : 'Bu şarkıdan puan kazanılamadı'
                : 'Şarkıyı bu denemede bilirsen kazanacağın puan'
            }
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.375rem 0.875rem',
              borderRadius: '9999px',
              backgroundColor: 'rgba(17, 24, 39, 0.85)',
              backdropFilter: 'blur(8px)',
              border: isSongRevealed
                ? isSolved
                  ? '1px solid rgba(16, 185, 129, 0.5)'
                  : '1px solid rgba(239, 68, 68, 0.4)'
                : '1px solid rgba(99, 102, 241, 0.4)',
              boxShadow: isSongRevealed
                ? isSolved
                  ? '0 0 15px rgba(16, 185, 129, 0.25)'
                  : 'none'
                : '0 0 15px rgba(99, 102, 241, 0.2)',
              fontSize: '0.75rem',
              transition: 'all 200ms ease',
            }}
          >
            <i
              className={`fa-solid ${
                isSongRevealed
                  ? isSolved
                    ? 'fa-circle-check'
                    : 'fa-circle-xmark'
                  : 'fa-bolt'
              }`}
              style={{
                color: isSongRevealed
                  ? isSolved
                    ? '#34d399'
                    : '#f87171'
                  : '#818cf8',
                fontSize: '0.8125rem',
              }}
            />
            <span style={{ color: '#9ca3af', fontWeight: 600 }}>
              {isSongRevealed ? 'Kazanılan:' : 'Bilince:'}
            </span>
            <span
              className="font-mono-num"
              style={{
                color: isSongRevealed
                  ? isSolved
                    ? '#34d399'
                    : '#f87171'
                  : '#a5b4fc',
                fontWeight: 800,
                fontSize: '0.875rem',
                letterSpacing: '-0.02em',
              }}
            >
              {isSongRevealed
                ? isSolved
                  ? `+${lastEarnedPoints ?? potentialPoints}`
                  : '+0'
                : `+${potentialPoints}`}
            </span>
          </div>
        </div>
      </div>

      {/* Zorluk Düzeyi veya Şarkı İlerleme Hapları */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.375rem',
          padding: '0.25rem 0.5rem',
          backgroundColor: 'rgba(17, 24, 39, 0.85)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '9999px',
          marginBottom: '0.75rem',
          maxWidth: '100%',
          overflowX: 'auto',
        }}
      >
        {activeStages.length <= 5 ? (
          activeStages.map((s, idx) => {
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
          })
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.2rem 0.75rem' }}>
            <span style={{ fontSize: '0.75rem', color: '#c7d2fe', fontWeight: 700 }}>
              Şarkı {currentStageIndex + 1} / {activeStages.length}
            </span>
            <div
              style={{
                width: '7rem',
                height: '6px',
                borderRadius: '9999px',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${((currentStageIndex + 1) / activeStages.length) * 100}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #6366f1, #ec4899)',
                  borderRadius: '9999px',
                  transition: 'width 300ms ease',
                }}
              />
            </div>
          </div>
        )}
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
        Şarkı <span style={{ color: '#ffffff', fontWeight: 700 }}>{currentStageIndex + 1}</span> / {activeStages.length}
        {activeStages.length <= 5 && (
          <>
            {' '}· <span style={{ color: '#818cf8', fontWeight: 600 }}>{currentStage.name}</span>
          </>
        )}
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
        {/* Canlı Saniye Gösteren İmleç (Playhead Cursor) - Şarkı bilindiğinde veya geçildiğinde durdurulur */}
        {showPlayhead && (
          <div
            style={{
              position: 'absolute',
              top: '-4px',
              bottom: '-4px',
              left: `calc(0.375rem + (100% - 0.75rem) * ${cursorLeftPercent / 100})`,
              width: '4px',
              backgroundColor: '#ffffff',
              borderRadius: '9999px',
              boxShadow: `0 0 12px ${barColor}, 0 0 24px ${barColor}`,
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
                background: barColor,
                border: `1px solid ${barBorder}`,
                color: '#ffffff',
                fontSize: '11px',
                fontWeight: 700,
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                boxShadow: `0 0 15px ${barGlow}`,
              }}
            >
              <span>{isSolved ? '🎉' : isWrong ? '❌' : '⏱'}</span>
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
                borderTop: `5px solid ${barColor}`,
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
            const isFilled = isFullBar || idx <= currentAttemptIndex;
            return (
              <div
                key={idx}
                style={{
                  height: '100%',
                  width: `${width}%`,
                  background: isFilled ? barColor : 'rgba(31, 41, 55, 0.8)',
                  borderRadius: '9999px',
                  boxShadow: isFilled ? `0 0 10px ${barGlow}` : 'none',
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
