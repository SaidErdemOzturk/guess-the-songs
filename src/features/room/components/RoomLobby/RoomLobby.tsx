import React, { useState } from 'react';
import { roomService } from '@/services/api/roomService';
import { useAuth } from '@/features/auth/context/AuthContext';
import { Badge, Button, Card } from '@/components/ui';
import type { Room } from '@/types/room';

interface RoomLobbyProps {
  room: Room;
  onStartGame: () => void;
  onLeaveRoom: () => void;
  onKickParticipant?: (targetUserId: string) => Promise<void>;
}

export const RoomLobby: React.FC<RoomLobbyProps> = ({
  room,
  onStartGame,
  onLeaveRoom,
  onKickParticipant,
}) => {
  const { user } = useAuth();
  const [copySuccess, setCopySuccess] = useState(false);
  const [kickingUserId, setKickingUserId] = useState<string | null>(null);
  const [kickError, setKickError] = useState<string | null>(null);
  const isHost = room.hostId === user?.id;

  const handleKick = async (targetUserId: string, targetUserName: string) => {
    if (!isHost || !user) return;
    const confirmed = window.confirm(`"${targetUserName}" adlı oyuncuyu odadan çıkarmak istediğinize emin misiniz?`);
    if (!confirmed) return;

    try {
      setKickingUserId(targetUserId);
      setKickError(null);
      if (onKickParticipant) {
        await onKickParticipant(targetUserId);
      } else {
        await roomService.kickParticipant(room.code, user.id, targetUserId);
      }
    } catch (err: any) {
      setKickError(err?.message || 'Oyuncu odadan çıkarılırken bir hata oluştu.');
    } finally {
      setKickingUserId(null);
    }
  };

  const handleInvite = async () => {
    const inviteLink = roomService.generateInviteLink(room.code);

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(inviteLink);
      } else {
        // Fallback
        const textarea = document.createElement('textarea');
        textarea.value = inviteLink;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 3000);
    } catch {
      alert(`Davet Linki: ${inviteLink}`);
    }
  };

  return (
    <div
      style={{
        width: '100%',
        maxWidth: '100%',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
        zIndex: 10,
      }}
    >
      <Card style={{ padding: '2rem' }}>
        {/* Oda Başlığı ve Kodu */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            paddingBottom: '1.25rem',
            marginBottom: '1.5rem',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f9fafb' }}>
                {room.name}
              </h2>
              <Badge variant="primary">Lobi</Badge>
            </div>
            <p style={{ color: '#9ca3af', fontSize: '0.8125rem', marginTop: '0.25rem' }}>
              Kurucu: <span style={{ color: '#818cf8', fontWeight: 600 }}>{room.hostName}</span>
            </p>
          </div>

          {/* Oda Kodu Rozeti */}
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '0.75rem', color: '#6b7280', display: 'block' }}>
              Oda Kodu
            </span>
            <span
              className="font-mono-num"
              style={{
                fontSize: '1.5rem',
                fontWeight: 800,
                color: '#ec4899',
                letterSpacing: '0.05em',
              }}
            >
              {room.code}
            </span>
          </div>
        </div>

        {/* Davet Et Butonu ve Link Alanı */}
        <div
          style={{
            padding: '1.25rem',
            backgroundColor: 'rgba(99, 102, 241, 0.1)',
            border: '1px solid rgba(99, 102, 241, 0.25)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            marginBottom: '1.5rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h4 style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#ffffff' }}>
                👥 Arkadaşlarını Odaya Davet Et
              </h4>
              <p style={{ fontSize: '0.75rem', color: '#a5b4fc', marginTop: '0.125rem' }}>
                Davet linkine basanlar giriş yaparak doğrudan bu odaya katılabilecek.
              </p>
            </div>

            {/* Davet Et Butonu */}
            <Button
              variant="primary"
              size="sm"
              onClick={handleInvite}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.375rem',
                boxShadow: '0 0 15px rgba(99, 102, 241, 0.5)',
              }}
            >
              <i className="fa-solid fa-link" style={{ fontSize: '0.75rem' }} />
              <span>{copySuccess ? '✓ Kopyalandı!' : 'Davet Et (Linki Kopyala)'}</span>
            </Button>
          </div>

          {copySuccess && (
            <div
              style={{
                fontSize: '0.75rem',
                color: '#34d399',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '0.375rem',
              }}
            >
              <i className="fa-solid fa-circle-check" />
              <span>Davet linki panoya kopyalandı! Arkadaşlarınızla paylaşabilirsiniz.</span>
            </div>
          )}
        </div>

        {/* Katılımcı Listesi */}
        <div style={{ marginBottom: '2rem' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '0.75rem',
            }}
          >
            <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: '#e2e8f0' }}>
              Oyuncular ({room.participants.length})
            </h4>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flexWrap: 'wrap' }}>
              <span
                style={{
                  fontSize: '0.75rem',
                  color: '#818cf8',
                  backgroundColor: 'rgba(99, 102, 241, 0.15)',
                  padding: '0.2rem 0.5rem',
                  borderRadius: '9999px',
                  fontWeight: 600,
                }}
              >
                ⏱ {room.guessTimeLimitMinutes || 1} Dk
              </span>
              <span
                style={{
                  fontSize: '0.75rem',
                  color: '#ec4899',
                  backgroundColor: 'rgba(236, 72, 153, 0.15)',
                  padding: '0.2rem 0.5rem',
                  borderRadius: '9999px',
                  fontWeight: 600,
                }}
              >
                🎯 {room.settings?.gameMode === 'long' ? `${room.settings?.songCount || 10} Şarkı (Uzun)` : '3 Şarkı (Standart)'}
              </span>
              <span
                style={{
                  fontSize: '0.75rem',
                  color: '#34d399',
                  backgroundColor: 'rgba(52, 211, 153, 0.15)',
                  padding: '0.2rem 0.5rem',
                  borderRadius: '9999px',
                  fontWeight: 600,
                }}
              >
                {room.settings?.playlistId ? '🔗 Özel Liste' : (room.settings?.region === 'global' ? '🌍 Global' : '🇹🇷 Türkiye')}
              </span>
            </div>
          </div>

          {kickError && (
            <div
              style={{
                padding: '0.5rem 0.75rem',
                backgroundColor: 'rgba(239, 68, 68, 0.2)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                borderRadius: 'var(--radius-sm)',
                color: '#f87171',
                fontSize: '0.8125rem',
                marginBottom: '0.75rem',
              }}
            >
              ⚠️ {kickError}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {room.participants.map((p, idx) => (
              <div
                key={p.user.id || idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'rgba(31, 41, 55, 0.6)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div
                    style={{
                      width: '2rem',
                      height: '2rem',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #6366f1, #ec4899)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.875rem',
                      fontWeight: 700,
                      color: '#ffffff',
                    }}
                  >
                    {p.user.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#ffffff' }}>
                      {p.user.name}
                    </span>
                    {p.user.id === user?.id && (
                      <span style={{ fontSize: '0.75rem', color: '#818cf8', marginLeft: '0.375rem' }}>
                        (Sen)
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {p.isHost ? (
                    <Badge variant="warning">👑 Oda Sahibi</Badge>
                  ) : (
                    <>
                      <Badge variant="success">✓ Katıldı</Badge>
                      {isHost && p.user.id !== user?.id && (
                        <button
                          type="button"
                          onClick={() => handleKick(p.user.id, p.user.name)}
                          disabled={kickingUserId === p.user.id}
                          title={`${p.user.name} kullanıcısını odadan at`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            padding: '0.25rem 0.55rem',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            borderRadius: 'var(--radius-sm)',
                            backgroundColor: 'rgba(239, 68, 68, 0.15)',
                            color: '#f87171',
                            border: '1px solid rgba(239, 68, 68, 0.35)',
                            cursor: kickingUserId === p.user.id ? 'not-allowed' : 'pointer',
                            opacity: kickingUserId === p.user.id ? 0.6 : 1,
                            transition: 'all 0.15s ease',
                          }}
                          onMouseEnter={(e) => {
                            if (kickingUserId !== p.user.id) {
                              e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.3)';
                              e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.6)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (kickingUserId !== p.user.id) {
                              e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.15)';
                              e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.35)';
                            }
                          }}
                        >
                          <i className="fa-solid fa-user-xmark" style={{ fontSize: '0.75rem' }} />
                          <span>{kickingUserId === p.user.id ? 'Atılıyor...' : 'Odadan At'}</span>
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Butonlar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
          <Button variant="secondary" onClick={onLeaveRoom}>
            Odadan Ayrıl
          </Button>

          {isHost ? (
            <Button variant="primary" size="lg" onClick={onStartGame} style={{ flex: 1 }}>
              🚀 Oyunu Başlat
            </Button>
          ) : (
            <div style={{ fontSize: '0.8125rem', color: '#9ca3af', alignSelf: 'center' }}>
              Oda sahibinin oyunu başlatması bekleniyor...
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};
