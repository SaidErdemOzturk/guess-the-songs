import React, { useState } from 'react';
import { useAuth } from '@/features/auth/context/AuthContext';
import { roomService } from '@/services/api/roomService';
import { extractPlaylistId } from '@/services/api/youtubeService';
import { Button, Input } from '@/components/ui';
import type { Room } from '@/types/room';

interface CreateRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRoomCreated: (room: Room) => void;
}

export const CreateRoomModal: React.FC<CreateRoomModalProps> = ({
  isOpen,
  onClose,
  onRoomCreated,
}) => {
  const { user, token } = useAuth();
  const [roomName, setRoomName] = useState('');
  const [guessTimeLimitMinutes, setGuessTimeLimitMinutes] = useState<number>(1);
  const [gameMode, setGameMode] = useState<'short' | 'long'>('short');
  const [songCount, setSongCount] = useState<number>(10);
  const [playlistSource, setPlaylistSource] = useState<'tr' | 'global' | 'custom'>('tr');
  const [customPlaylistUrl, setCustomPlaylistUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !token) {
      setError('Oda kurabilmek için giriş yapmış olmalısınız.');
      return;
    }

    let customPlaylistId: string | undefined = undefined;
    if (playlistSource === 'custom') {
      const cleaned = extractPlaylistId(customPlaylistUrl.trim());
      if (!cleaned) {
        setError('Lütfen geçerli bir YouTube çalma listesi linki veya ID girin.');
        return;
      }
      customPlaylistId = cleaned;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const effectiveSongCount = gameMode === 'long' ? Math.max(3, songCount) : 3;
      const room = await roomService.createRoom(
        {
          name: roomName.trim() || `${user.name}'in Odası`,
          guessTimeLimitMinutes: Math.max(1, guessTimeLimitMinutes),
          settings: {
            region: playlistSource === 'global' ? 'global' : 'tr',
            genre: 'all',
            era: 'all',
            guessTimeLimitMinutes: Math.max(1, guessTimeLimitMinutes),
            gameMode,
            songCount: effectiveSongCount,
            playlistId: customPlaylistId,
            playlistUrl: playlistSource === 'custom' ? customPlaylistUrl.trim() : undefined,
          },
        },
        user,
        token
      );
      onRoomCreated(room);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Oda kurulurken bir hata oluştu.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const presetMinutes = [1, 2, 3, 5];
  const presetSongCounts = [5, 10, 15, 20];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        style={{
          backgroundColor: '#111827',
          border: '1px solid rgba(99, 102, 241, 0.3)',
          borderRadius: '1.5rem',
          padding: '1.75rem',
          width: '100%',
          maxWidth: '26rem',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
          position: 'relative',
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            color: '#9ca3af',
            fontSize: '1.125rem',
            cursor: 'pointer',
          }}
        >
          <i className="fa-solid fa-xmark" />
        </button>

        <h3
          style={{
            fontSize: '1.25rem',
            fontWeight: 800,
            color: '#ffffff',
            marginBottom: '0.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <span>🎮</span> Yeni Müzik Odası Kur
        </h3>
        <p style={{ fontSize: '0.8125rem', color: '#9ca3af', marginBottom: '1.25rem' }}>
          Arkadaşlarınızı davet edin ve şarkıları ilk tahmin eden olmak için yarışın.
        </p>

        {error && (
          <div
            style={{
              padding: '0.5rem 0.75rem',
              backgroundColor: 'rgba(239, 68, 68, 0.2)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              borderRadius: 'var(--radius-sm)',
              color: '#f87171',
              fontSize: '0.75rem',
              marginBottom: '1rem',
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.125rem' }}>
          <Input
            label="Oda Adı"
            placeholder={`${user?.name || 'Müzik'} Odası`}
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
          />

          {/* Oyun Modu Seçimi */}
          <div>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: '#d1d5db',
                marginBottom: '0.5rem',
              }}
            >
              <span>🎯 Oyun Modu</span>
              <span style={{ color: '#818cf8', fontWeight: 700 }}>
                {gameMode === 'short' ? '3 Şarkı (Standart)' : `${songCount} Şarkı (Uzun Mod)`}
              </span>
            </label>

            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setGameMode('short')}
                style={{
                  flex: 1,
                  padding: '0.55rem 0.5rem',
                  borderRadius: '0.75rem',
                  fontSize: '0.75rem',
                  fontWeight: gameMode === 'short' ? 700 : 500,
                  backgroundColor: gameMode === 'short' ? 'rgba(99, 102, 241, 0.3)' : 'rgba(31, 41, 55, 0.7)',
                  border: gameMode === 'short' ? '1px solid #818cf8' : '1px solid rgba(255, 255, 255, 0.1)',
                  color: gameMode === 'short' ? '#ffffff' : '#9ca3af',
                  boxShadow: gameMode === 'short' ? '0 0 12px rgba(99, 102, 241, 0.35)' : 'none',
                  cursor: 'pointer',
                  transition: 'all 150ms ease',
                }}
              >
                ⚡ Standart (3 Şarkı)
              </button>
              <button
                type="button"
                onClick={() => setGameMode('long')}
                style={{
                  flex: 1,
                  padding: '0.55rem 0.5rem',
                  borderRadius: '0.75rem',
                  fontSize: '0.75rem',
                  fontWeight: gameMode === 'long' ? 700 : 500,
                  backgroundColor: gameMode === 'long' ? 'rgba(99, 102, 241, 0.3)' : 'rgba(31, 41, 55, 0.7)',
                  border: gameMode === 'long' ? '1px solid #818cf8' : '1px solid rgba(255, 255, 255, 0.1)',
                  color: gameMode === 'long' ? '#ffffff' : '#9ca3af',
                  boxShadow: gameMode === 'long' ? '0 0 12px rgba(99, 102, 241, 0.35)' : 'none',
                  cursor: 'pointer',
                  transition: 'all 150ms ease',
                }}
              >
                🎯 Uzun Mod
              </button>
            </div>

            {gameMode === 'long' && (
              <div
                style={{
                  padding: '0.625rem 0.75rem',
                  backgroundColor: 'rgba(99, 102, 241, 0.1)',
                  border: '1px solid rgba(99, 102, 241, 0.25)',
                  borderRadius: '0.75rem',
                  marginBottom: '0.5rem',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: '#e0e7ff',
                    marginBottom: '0.375rem',
                  }}
                >
                  <span>Şarkı Sayısı:</span>
                  <span style={{ color: '#a5b4fc', fontWeight: 700 }}>{songCount} Şarkı Sonra Biter</span>
                </div>
                <div style={{ display: 'flex', gap: '0.375rem' }}>
                  {presetSongCounts.map((count) => {
                    const isSelected = songCount === count;
                    return (
                      <button
                        key={count}
                        type="button"
                        onClick={() => setSongCount(count)}
                        style={{
                          flex: 1,
                          padding: '0.35rem 0.25rem',
                          borderRadius: '0.5rem',
                          fontSize: '0.75rem',
                          fontWeight: isSelected ? 700 : 500,
                          backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.4)' : 'rgba(17, 24, 39, 0.8)',
                          border: isSelected ? '1px solid #818cf8' : '1px solid rgba(255, 255, 255, 0.1)',
                          color: isSelected ? '#ffffff' : '#9ca3af',
                          cursor: 'pointer',
                          transition: 'all 150ms ease',
                        }}
                      >
                        {count}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: '#d1d5db',
                marginBottom: '0.5rem',
              }}
            >
              <span>⏱ Şarkıyı Bilme Süresi</span>
              <span style={{ color: '#818cf8', fontWeight: 700 }}>
                {guessTimeLimitMinutes} Dakika ({guessTimeLimitMinutes * 60} sn)
              </span>
            </label>

            {/* Hızlı Seçim Butonları */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.625rem' }}>
              {presetMinutes.map((mins) => {
                const isSelected = guessTimeLimitMinutes === mins;
                return (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setGuessTimeLimitMinutes(mins)}
                    style={{
                      flex: 1,
                      padding: '0.5rem',
                      borderRadius: '0.75rem',
                      fontSize: '0.8125rem',
                      fontWeight: isSelected ? 700 : 500,
                      backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.3)' : 'rgba(31, 41, 55, 0.7)',
                      border: isSelected ? '1px solid #818cf8' : '1px solid rgba(255, 255, 255, 0.1)',
                      color: isSelected ? '#ffffff' : '#9ca3af',
                      boxShadow: isSelected ? '0 0 12px rgba(99, 102, 241, 0.35)' : 'none',
                      cursor: 'pointer',
                      transition: 'all 150ms ease',
                    }}
                  >
                    {mins} Dk
                  </button>
                );
              })}
            </div>

            <p style={{ fontSize: '0.6875rem', color: '#6b7280', margin: 0 }}>
              Her şarkı için oyunculara tanınan süre. Süre dolduğunda seçim yapılmazsa otomatik olarak pes edilmiş sayılır.
            </p>
          </div>

          {/* Müzik Havuzu / Playlist Seçimi */}
          <div>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: '#d1d5db',
                marginBottom: '0.5rem',
              }}
            >
              <span>🎵 Müzik Listesi / Şarkı Havuzu</span>
            </label>

            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.625rem' }}>
              <button
                type="button"
                onClick={() => setPlaylistSource('tr')}
                style={{
                  flex: 1,
                  padding: '0.5rem',
                  borderRadius: '0.75rem',
                  fontSize: '0.75rem',
                  fontWeight: playlistSource === 'tr' ? 700 : 500,
                  backgroundColor: playlistSource === 'tr' ? 'rgba(99, 102, 241, 0.3)' : 'rgba(31, 41, 55, 0.7)',
                  border: playlistSource === 'tr' ? '1px solid #818cf8' : '1px solid rgba(255, 255, 255, 0.1)',
                  color: playlistSource === 'tr' ? '#ffffff' : '#9ca3af',
                  cursor: 'pointer',
                  transition: 'all 150ms ease',
                }}
              >
                🇹🇷 Türkiye
              </button>
              <button
                type="button"
                onClick={() => setPlaylistSource('global')}
                style={{
                  flex: 1,
                  padding: '0.5rem',
                  borderRadius: '0.75rem',
                  fontSize: '0.75rem',
                  fontWeight: playlistSource === 'global' ? 700 : 500,
                  backgroundColor: playlistSource === 'global' ? 'rgba(99, 102, 241, 0.3)' : 'rgba(31, 41, 55, 0.7)',
                  border: playlistSource === 'global' ? '1px solid #818cf8' : '1px solid rgba(255, 255, 255, 0.1)',
                  color: playlistSource === 'global' ? '#ffffff' : '#9ca3af',
                  cursor: 'pointer',
                  transition: 'all 150ms ease',
                }}
              >
                🌍 Global
              </button>
              <button
                type="button"
                onClick={() => setPlaylistSource('custom')}
                style={{
                  flex: 1,
                  padding: '0.5rem',
                  borderRadius: '0.75rem',
                  fontSize: '0.75rem',
                  fontWeight: playlistSource === 'custom' ? 700 : 500,
                  backgroundColor: playlistSource === 'custom' ? 'rgba(99, 102, 241, 0.3)' : 'rgba(31, 41, 55, 0.7)',
                  border: playlistSource === 'custom' ? '1px solid #818cf8' : '1px solid rgba(255, 255, 255, 0.1)',
                  color: playlistSource === 'custom' ? '#ffffff' : '#9ca3af',
                  cursor: 'pointer',
                  transition: 'all 150ms ease',
                }}
              >
                🔗 Özel Liste
              </button>
            </div>

            {playlistSource === 'custom' && (
              <div style={{ marginTop: '0.5rem' }}>
                <Input
                  placeholder="YouTube Playlist URL veya ID (örn: PL...)"
                  value={customPlaylistUrl}
                  onChange={(e) => setCustomPlaylistUrl(e.target.value)}
                />
                <p style={{ fontSize: '0.6875rem', color: '#818cf8', marginTop: '0.25rem', marginBottom: 0 }}>
                  ⚡ Tokensiz Invidious API ile taranır. Telif kısıtlamalı parçalar otomatik atlanır.
                </p>
              </div>
            )}
          </div>

          <Button type="submit" variant="primary" size="md" isLoading={isSubmitting} style={{ marginTop: '0.25rem' }}>
            Odayı Kur & Lobiye Geç
          </Button>
        </form>
      </div>
    </div>
  );
};
