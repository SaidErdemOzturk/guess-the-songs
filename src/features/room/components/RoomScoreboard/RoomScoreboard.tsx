import React, { useState } from 'react';
import type { Room } from '@/types/room';
import { roomService } from '@/services/api/roomService';
import styles from './RoomScoreboard.module.css';

interface RoomScoreboardProps {
  room: Room;
  currentUserId?: string | null;
  onKickParticipant?: (targetUserId: string) => Promise<void>;
  isCurrentUserGuessing?: boolean;
  currentUserEarnedPoints?: number | null;
}

export const RoomScoreboard: React.FC<RoomScoreboardProps> = ({
  room,
  currentUserId,
  onKickParticipant,
  isCurrentUserGuessing,
  currentUserEarnedPoints,
}) => {
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [kickingId, setKickingId] = useState<string | null>(null);
  const isHost = room.hostId === currentUserId;
  const isGameActive = room.status === 'in_game';

  const handleKick = async (targetUserId: string, targetUserName: string) => {
    if (!isHost || !currentUserId) return;
    const confirmed = window.confirm(`"${targetUserName}" adlı oyuncuyu oyundan/odadan çıkarmak istediğinize emin misiniz?`);
    if (!confirmed) return;

    try {
      setKickingId(targetUserId);
      if (onKickParticipant) {
        await onKickParticipant(targetUserId);
      } else {
        await roomService.kickParticipant(room.code, currentUserId, targetUserId);
      }
    } catch (err: any) {
      alert(err?.message || 'Oyuncu odadan çıkarılırken bir hata oluştu.');
    } finally {
      setKickingId(null);
    }
  };

  // Katılımcıları skora göre azalan şekilde sırala
  const sortedParticipants = [...room.participants].sort(
    (a, b) => (b.score || 0) - (a.score || 0)
  );

  const handleCopyInvite = async () => {
    const inviteLink = roomService.generateInviteLink(room.code);
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(inviteLink);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = inviteLink;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2500);
    } catch {
      alert(`Davet Linki: ${inviteLink}`);
    }
  };

  const getRankIndicator = (index: number) => {
    switch (index) {
      case 0:
        return <span className={`${styles.rankBadge} ${styles.rankFirst}`}>🥇 1</span>;
      case 1:
        return <span className={`${styles.rankBadge} ${styles.rankSecond}`}>🥈 2</span>;
      case 2:
        return <span className={`${styles.rankBadge} ${styles.rankThird}`}>🥉 3</span>;
      default:
        return <span className={styles.rankBadge}>#{index + 1}</span>;
    }
  };

  return (
    <aside className={styles.scoreboardWrapper}>
      {/* Başlık Alanı */}
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <span className={styles.trophyIcon}>🏆</span>
          <h3 className={styles.title}>Puan Durumu</h3>
        </div>
        <span className={styles.roomCodeBadge}>{room.code}</span>
      </div>

      {/* Katılımcı Sıralama Listesi */}
      <div className={styles.participantsList}>
        {sortedParticipants.map((p, index) => {
          const isCurrentUser = p.user.id === currentUserId;

          // Katılımcının bu raund tahmin yapıp yapmadığı durumu
          const isGuessing = isGameActive && (
            isCurrentUser
              ? Boolean(isCurrentUserGuessing)
              : (p.lastPointsEarned === undefined || p.lastPointsEarned === null)
          );

          // Raund sonu kazanılan puan
          const earnedPoints = isCurrentUser
            ? (currentUserEarnedPoints !== undefined && currentUserEarnedPoints !== null ? currentUserEarnedPoints : p.lastPointsEarned)
            : p.lastPointsEarned;

          const guessDuration = p.lastGuessDuration;

          return (
            <div
              key={p.user.id || index}
              className={`${styles.participantCard} ${isCurrentUser ? styles.isCurrentUser : ''}`}
            >
              <div className={styles.playerLeft}>
                {getRankIndicator(index)}
                <div className={styles.avatar}>
                  {p.user.name?.charAt(0).toUpperCase() || 'P'}
                </div>
                <div className={styles.nameContainer}>
                  <span className={styles.playerName} title={p.user.name}>
                    {p.user.name}
                  </span>
                  {isCurrentUser && <span className={styles.youLabel}>Sen</span>}
                </div>
              </div>

              <div className={styles.playerRight}>
                <span className={styles.scoreText}>{(p.score || 0).toLocaleString('tr-TR')} p</span>

                {/* Tahmin aşamasındaysa loading spinner, bittiyse kazanılan puan */}
                {isGameActive && (
                  <>
                    {isGuessing ? (
                      <div className={styles.guessingContainer}>
                        <div className={styles.guessingSpinner} />
                        <span className={styles.guessingText}>
                          {isCurrentUser ? 'Tahmin ediyorsun...' : 'Tahmin ediyor...'}
                        </span>
                      </div>
                    ) : earnedPoints !== undefined && earnedPoints !== null ? (
                      earnedPoints > 0 ? (
                        <span className={styles.earnedBadgeSuccess} title={`Bu şarkıda +${earnedPoints} puan kazandı`}>
                          +{earnedPoints} {guessDuration ? `(${guessDuration}s)` : ''}
                        </span>
                      ) : (
                        <span className={styles.earnedBadgeZero} title="Bu şarkıda puan kazanamadı">
                          +0 p {guessDuration ? `(${guessDuration}s)` : ''}
                        </span>
                      )
                    ) : null}
                  </>
                )}

                {/* Oyun aktif değilse (lobi/sonuç) son puan */}
                {!isGameActive && p.lastPointsEarned !== undefined && p.lastPointsEarned > 0 && (
                  <span className={styles.lastEarnedBadge}>
                    +{p.lastPointsEarned} ({p.lastGuessDuration}s)
                  </span>
                )}

                {isHost && !p.isHost && p.user.id !== currentUserId && (
                  <button
                    type="button"
                    title={`${p.user.name} kullanıcısını odadan at`}
                    disabled={kickingId === p.user.id}
                    onClick={() => handleKick(p.user.id, p.user.name)}
                    style={{
                      backgroundColor: 'rgba(239, 68, 68, 0.15)',
                      border: '1px solid rgba(239, 68, 68, 0.35)',
                      borderRadius: 'var(--radius-sm)',
                      color: '#f87171',
                      padding: '0.15rem 0.4rem',
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      cursor: kickingId === p.user.id ? 'not-allowed' : 'pointer',
                      marginTop: '0.2rem',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {kickingId === p.user.id ? '...' : '✕ At'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Davet Butonu */}
      <button type="button" className={styles.inviteBtn} onClick={handleCopyInvite}>
        <span>🔗</span>
        <span>{copyFeedback ? '✓ Link Kopyalandı!' : 'Arkadaşını Davet Et'}</span>
      </button>
    </aside>
  );
};
