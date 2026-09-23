import React, { useEffect, useState } from 'react';
import { useAuth } from '../../features/auth/context/AuthContext';
import { roomService } from '../../services/api/roomService';
import type { Room } from '../../types/room';
import { RoomLobby } from '../../features/room/components/RoomLobby/RoomLobby';
import styles from './RoomPage.module.css';

interface RoomPageProps {
  roomCode: string;
  onLeaveRoom: () => void;
  onStartGame: (room: Room) => void;
}

export const RoomPage: React.FC<RoomPageProps> = ({
  roomCode,
  onLeaveRoom,
  onStartGame,
}) => {
  const { user, token, isAuthenticated } = useAuth();
  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchAndJoin = async () => {
      if (!isAuthenticated || !token || !user) {
        setError('Odaya katılmak için giriş yapmış olmalısınız.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        // Katılma isteği gönder (zaten odadaysa veya host ise de odayı döner)
        const joinedRoom = await roomService.joinRoom(roomCode, user, token);
        if (isMounted) {
          setRoom(joinedRoom);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err?.message || 'Odaya bağlanırken bir sorun oluştu.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchAndJoin();

    return () => {
      isMounted = false;
    };
  }, [roomCode, isAuthenticated, token, user]);

  const handleStartGame = () => {
    if (room) {
      onStartGame(room);
    }
  };

  const handleLeave = () => {
    // URL'den room parametresini temizle
    const url = new URL(window.location.href);
    url.searchParams.delete('room');
    window.history.replaceState({}, '', url.pathname);
    onLeaveRoom();
  };

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loader}></div>
        <h2>Oda Yükleniyor...</h2>
        <p>Oda bilgileri doğrulanıyor ve bağlantı kuruluyor.</p>
      </div>
    );
  }

  if (error || !room) {
    return (
      <div className={styles.errorContainer}>
        <div className={styles.errorIcon}>⚠️</div>
        <h2>Odaya Katılınamadı</h2>
        <p className={styles.errorMessage}>{error || 'Oda bulunamadı veya süresi doldu.'}</p>
        <button className={styles.primaryBtn} onClick={handleLeave}>
          Ana Menüye Dön
        </button>
      </div>
    );
  }

  return (
    <div className={styles.roomPageWrapper}>
      <RoomLobby
        room={room}
        onStartGame={handleStartGame}
        onLeaveRoom={handleLeave}
      />
    </div>
  );
};
