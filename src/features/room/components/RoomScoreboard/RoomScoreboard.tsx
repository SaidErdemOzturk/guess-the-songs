import React, { useState } from 'react';
import type { Room } from '@/types/room';
import { roomService } from '@/services/api/roomService';
import styles from './RoomScoreboard.module.css';

interface RoomScoreboardProps {
  room: Room;
  currentUserId?: string | null;
}

export const RoomScoreboard: React.FC<RoomScoreboardProps> = ({ room, currentUserId }) => {
  const [copyFeedback, setCopyFeedback] = useState(false);

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
                {p.lastPointsEarned !== undefined && p.lastPointsEarned > 0 && (
                  <span className={styles.lastEarnedBadge}>
                    +{p.lastPointsEarned} ({p.lastGuessDuration}s)
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Süreye Göre Puan Skalası Bilgi Kutusu */}
      <div className={styles.scoringRulesCard}>
        <div className={styles.scoringRulesTitle}>
          <span>⏱️</span>
          <span>Süreye Göre Puanlar</span>
        </div>
        <div className={styles.rulesGrid}>
          <div className={styles.ruleItem}>
            <span className={styles.ruleTime}>⚡ 0.1s</span>
            <span className={styles.rulePts}>1000 P</span>
          </div>
          <div className={styles.ruleItem}>
            <span className={styles.ruleTime}>🚀 0.5s</span>
            <span className={styles.rulePts}>800 P</span>
          </div>
          <div className={styles.ruleItem}>
            <span className={styles.ruleTime}>🎯 2.0s</span>
            <span className={styles.rulePts}>600 P</span>
          </div>
          <div className={styles.ruleItem}>
            <span className={styles.ruleTime}>⏳ 8.0s</span>
            <span className={styles.rulePts}>400 P</span>
          </div>
        </div>
      </div>

      {/* Davet Butonu */}
      <button type="button" className={styles.inviteBtn} onClick={handleCopyInvite}>
        <span>🔗</span>
        <span>{copyFeedback ? '✓ Link Kopyalandı!' : 'Arkadaşını Davet Et'}</span>
      </button>
    </aside>
  );
};
