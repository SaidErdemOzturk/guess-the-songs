import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "../../features/auth/context/AuthContext";
import { roomService } from "../../services/api/roomService";
import type { Room } from "../../types/room";
import { RoomLobby } from "../../features/room/components/RoomLobby/RoomLobby";
import { RoomChat } from "../../features/room/components/RoomChat/RoomChat";
import styles from "./RoomPage.module.css";

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

  const isJoiningRef = useRef(false);

  useEffect(() => {
    let isMounted = true;

    const fetchOrJoinRoom = async () => {
      if (!isAuthenticated || !token || !user) {
        setError("Odaya katılmak için giriş yapmış olmalısınız.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const urlParams =
          typeof window !== "undefined"
            ? new URLSearchParams(window.location.search)
            : null;
        const isInvite = urlParams?.get("invite") === "true";

        let targetRoom: Room | null = null;

        if (isInvite) {
          if (isJoiningRef.current) return;
          isJoiningRef.current = true;

          // Davet linki ile gelindiyse (invite=true) odaya join isteği atılır
          targetRoom = await roomService.joinRoom(roomCode, user, token);

          // Başarılı katılım sonrası sayfa yenilendiğinde tekrar join atılmaması için invite parametresi temizlenir
          if (typeof window !== "undefined") {
            const url = new URL(window.location.href);
            url.searchParams.delete("invite");
            window.history.replaceState(
              {},
              "",
              `${url.pathname}?${url.searchParams.toString()}`,
            );
          }
        } else {
          // Aksi takdirde yerel depodaki odayı kontrol et, yoksa sunucudan çek
          const cleanCode = roomCode.toUpperCase().trim();
          const stored = roomService.getStoredRooms()[cleanCode];
          if (stored) {
            targetRoom = stored;
            roomService.connectWebSocket(cleanCode, user);
          } else {
            targetRoom = await roomService.getRoomByCode(roomCode);
          }
        }

        if (!targetRoom) {
          throw new Error("Oda bulunamadı veya süresi doldu.");
        }

        if (isMounted) {
          setRoom(targetRoom);
          if (isInvite && targetRoom.status === "in_game") {
            onStartGame(targetRoom);
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err?.message || "Odaya bağlanırken bir sorun oluştu.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchOrJoinRoom();

    // Canlı WebSocket ve oda aboneliği (Odaya biri katıldığında anında arayüze yansır)
    const unsubscribe = roomService.subscribeToRoom(roomCode, (updatedRoom) => {
      if (!isMounted) return;

      setRoom({ ...updatedRoom });

      // Oda sahibi oyunu başlattığında odadaki diğer tüm katılımcıların ekranı oyuna geçer
      if (updatedRoom.status === "in_game") {
        onStartGame(updatedRoom);
      }
    });

    // Doğrudan odadan atılma WebSocket bildirimi dinleyicisi
    const unsubscribeKick = roomService.onParticipantKicked(
      roomCode,
      (targetUserId) => {
        if (!isMounted) return;
        if (user && String(targetUserId) === String(user.id)) {
          alert("Oda sahibi tarafından odadan çıkarıldınız.");
          handleLeave();
        }
      },
    );

    return () => {
      isMounted = false;
      unsubscribe();
      unsubscribeKick();
    };
  }, [roomCode, isAuthenticated, token, user, onStartGame]);

  const handleStartGame = async () => {
    if (room) {
      const updated: Room = {
        ...room,
        status: "in_game",
      };
      setRoom(updated);
      // Backend ve tüm WebSocket abonelerine oyunun başladığını ('in_game') bildir
      await roomService.changeRoomStatus(room.code, "in_game");
      onStartGame(updated);
    }
  };

  const handleKickParticipant = async (targetUserId: string) => {
    if (!room || !user) return;
    const updated = await roomService.kickParticipant(
      room.code,
      user.id,
      targetUserId,
    );
    setRoom({ ...updated });
  };

  const handleLeave = () => {
    // URL'den room ve invite parametrelerini temizle
    const url = new URL(window.location.href);
    url.searchParams.delete("room");
    url.searchParams.delete("invite");
    window.history.replaceState({}, "", url.pathname);
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
        <p className={styles.errorMessage}>
          {error || "Oda bulunamadı veya süresi doldu."}
        </p>
        <button className={styles.primaryBtn} onClick={handleLeave}>
          Ana Menüye Dön
        </button>
      </div>
    );
  }

  return (
    <div className={styles.roomPageWrapper}>
      <div className={styles.roomLobbyArea}>
        <RoomLobby
          room={room}
          onStartGame={handleStartGame}
          onLeaveRoom={handleLeave}
          onKickParticipant={handleKickParticipant}
        />
      </div>
      <div className={styles.roomChatArea}>
        <RoomChat
          roomCode={room.code}
          currentUserId={user?.id || ''}
          currentUserName={user?.name}
          currentUserAvatarUrl={user?.avatarUrl}
          isHost={room.hostId === user?.id}
        />
      </div>
    </div>
  );
};
