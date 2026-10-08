import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AudioPlayer,
  GuessInput,
  StageControlBar,
  AttemptDots,
  YouTubeEmbed,
  useGameRound,
} from "@/features/game";
import { RoomScoreboard } from "@/features/room/components/RoomScoreboard/RoomScoreboard";
import { RoomGameOverModal } from "@/features/room/components/RoomGameOverModal/RoomGameOverModal";
import { RoomChat } from "@/features/room/components/RoomChat/RoomChat";
import { roomService } from "@/services/api/roomService";
import { authService } from "@/services/api/authService";
import { webAudioService } from "@/services/audio/webAudioService";
import { getAttemptSkipAdd, STAGES } from "@/constants/game";
import type { CreateGameSessionRequest } from "@/types/game";
import type { Room } from "@/types/room";
import styles from "./RoomGamePage.module.css";

interface RoomGamePageProps {
  sessionParams: CreateGameSessionRequest;
  roomCode: string;
  currentUserId?: string | null;
  initialRoom?: Room | null;
  onBackToHome: () => void;
  onBackToRoom?: () => void;
}

export const RoomGamePage: React.FC<RoomGamePageProps> = ({
  sessionParams,
  roomCode,
  currentUserId,
  initialRoom,
  onBackToHome,
  onBackToRoom,
}) => {
  const [room, setRoom] = useState<Room | null>(initialRoom || null);
  const hasGameStartedRef = useRef(false);
  const currentRoomCodeRef = useRef(roomCode);
  const isNavigatingBackRef = useRef(false);

  const [sidebarTab, setSidebarTab] = useState<"scoreboard" | "chat">(
    "scoreboard",
  );
  const [unreadChatCount, setUnreadChatCount] = useState<number>(0);
  const sidebarTabRef = useRef(sidebarTab);
  sidebarTabRef.current = sidebarTab;

  const effectiveUserId =
    currentUserId ||
    authService.getSession().user?.id ||
    (room?.participants && authService.getSession().user?.email
      ? room.participants.find(
          (p) => p.user.email === authService.getSession().user?.email,
        )?.user.id
      : undefined);

  useEffect(() => {
    if (currentRoomCodeRef.current !== roomCode) {
      currentRoomCodeRef.current = roomCode;
      hasGameStartedRef.current = false;
      isNavigatingBackRef.current = false;
    }
  }, [roomCode]);

  useEffect(() => {
    if (!roomCode) return;

    const cleanCode = roomCode.toUpperCase().trim();
    const stored = roomService.getStoredRooms()[cleanCode];
    if (stored && !room) {
      setRoom(stored);
    } else if (!room && !stored) {
      roomService.getRoomByCode(roomCode).then((updatedRoom) => {
        if (updatedRoom) {
          setRoom(updatedRoom);
        }
      });
    }

    const unsubscribe = roomService.subscribeToRoom(roomCode, (updatedRoom) => {
      setRoom(updatedRoom);
      if (updatedRoom.status === "waiting") {
        if (isNavigatingBackRef.current) return;
        isNavigatingBackRef.current = true;
        webAudioService.stopCurrentAudio();
        if (onBackToRoom) {
          onBackToRoom();
        } else {
          onBackToHome();
        }
      }
    });

    const unsubscribeKick = roomService.onParticipantKicked(
      roomCode,
      (targetUserId) => {
        if (currentUserId && String(targetUserId) === String(currentUserId)) {
          alert("Oda sahibi tarafından oyundan/odadan çıkarıldınız.");
          onBackToHome();
        }
      },
    );

    const unsubscribeChat = roomService.onChatMessage(roomCode, (newMsg) => {
      if (
        sidebarTabRef.current !== "chat" &&
        String(newMsg.userId) !== String(effectiveUserId)
      ) {
        setUnreadChatCount((prev) => prev + 1);
      }
    });

    return () => {
      unsubscribe();
      unsubscribeKick();
      unsubscribeChat();
    };
  }, [
    roomCode,
    currentUserId,
    effectiveUserId,
    onBackToHome,
    onBackToRoom,
    room,
  ]);

  const handleScoreUpdate = useCallback(() => {
    if (!roomCode) return;
    const cleanCode = roomCode.toUpperCase().trim();
    const stored = roomService.getStoredRooms()[cleanCode];
    if (stored) {
      setRoom({ ...stored });
    }
  }, [roomCode]);

  const roomGuessLimit =
    room?.guessTimeLimitMinutes ||
    room?.settings?.guessTimeLimitMinutes ||
    sessionParams.guessTimeLimitMinutes ||
    1;

  const isHost = Boolean(
    currentUserId &&
    ((room &&
      (String(room.hostId) === String(currentUserId) ||
        room.participants?.find(
          (p) => String(p.user.id) === String(currentUserId),
        )?.isHost)) ||
      (initialRoom &&
        (String(initialRoom.hostId) === String(currentUserId) ||
          initialRoom.participants?.find(
            (p) => String(p.user.id) === String(currentUserId),
          )?.isHost))),
  );

  const {
    currentStageIndex,
    currentAttemptIndex,
    currentDuration,
    currentSong,
    isPlaying,
    playbackSeconds,
    playbackRatio,
    feedback,
    isGameOver,
    score,
    potentialPoints,
    lastEarnedPoints,
    roundCountdownSeconds,
    isGuessLocked,
    isSongRevealed,
    isLoadingSong,
    stages,
    totalStages,
    startNewGame,
    togglePlay,
    advanceAttempt,
    submitGuess,
    goToNextSong,
  } = useGameRound({
    roomCode,
    userId: effectiveUserId,
    guessTimeLimitMinutes: roomGuessLimit,
    room,
    isHost,
    onScoreUpdate: handleScoreUpdate,
  });

  // Bileşen ilk yüklendiğinde yalnızca 1 kez oyun başlatılır (Sonsuz istek döngüsünü engeller)
  useEffect(() => {
    if (!hasGameStartedRef.current) {
      hasGameStartedRef.current = true;
      startNewGame(sessionParams);
    }
  }, [sessionParams, startNewGame]);

  // Oyun bittiğinde son skorları garantiye almak için odayı yenile
  useEffect(() => {
    if (isGameOver) {
      handleScoreUpdate();
    }
  }, [isGameOver, handleScoreUpdate]);

  const totalParticipants = room?.participants?.length || 0;
  const finishedParticipants =
    room?.participants?.filter(
      (p) => p.lastPointsEarned !== null && p.lastPointsEarned !== undefined,
    ).length || 0;

  const allParticipantsGuessed =
    totalParticipants > 0 && finishedParticipants >= totalParticipants;

  const canSkip = isHost && allParticipantsGuessed;

  const skipWaitingReason = !allParticipantsGuessed
    ? `Diğer oyuncular tahmin yapıyor... (${finishedParticipants}/${totalParticipants})`
    : !isHost
      ? "Oda sahibinin sıradaki şarkıya geçmesi bekleniyor..."
      : undefined;

  const handleKickParticipant = async (targetUserId: string) => {
    if (!roomCode || !currentUserId) return;
    const updated = await roomService.kickParticipant(
      roomCode,
      currentUserId,
      targetUserId,
    );
    setRoom({ ...updated });
  };

  // 'Modu değiştir' veya 'Odaya Dön' basıldığında oyunu bitirip tüm odayı lobiye döndür
  const handleBackToRoomOrChangeMode = useCallback(async () => {
    if (isNavigatingBackRef.current) return;
    isNavigatingBackRef.current = true;
    webAudioService.stopCurrentAudio();
    if (roomCode) {
      try {
        await roomService.changeRoomStatus(roomCode, "waiting");
      } catch (err) {
        console.warn(
          "[RoomGamePage] Failed to change room status to waiting:",
          err,
        );
      }
    }
    if (onBackToRoom) {
      onBackToRoom();
    } else {
      onBackToHome();
    }
  }, [roomCode, onBackToRoom, onBackToHome]);

  const handleNextSong = useCallback(async () => {
    setRoom((prev) =>
      prev
        ? {
            ...prev,
            currentRound: (prev.currentRound || 1) + 1,
            participants: prev.participants.map((p) => ({
              ...p,
              lastPointsEarned: undefined,
              lastGuessDuration: undefined,
              lastGuessedRound: undefined,
              lastGuessedSongId: undefined,
            })),
          }
        : null,
    );
    await goToNextSong();
  }, [goToNextSong]);

  return (
    <div className={styles.roomGameContainer}>
      {/* Sol / Ana Oyun Bölümü */}
      <div className={styles.gameMainArea}>
        {/* Üst Kontrol & Aşama Barı (Canlı Geri Sayım Rozeti ile) */}
        <StageControlBar
          stages={stages}
          currentStageIndex={currentStageIndex}
          currentAttemptIndex={currentAttemptIndex}
          currentDuration={feedback?.isSuccess ? 8.0 : currentDuration}
          playbackSeconds={isSongRevealed ? 0 : playbackSeconds}
          playbackRatio={isSongRevealed ? 0 : playbackRatio}
          isPlaying={isSongRevealed ? false : isPlaying}
          isSolved={Boolean(feedback?.isSuccess)}
          isWrong={Boolean(feedback !== null && !feedback.isSuccess)}
          isSongRevealed={isSongRevealed}
          score={score}
          potentialPoints={potentialPoints}
          lastEarnedPoints={lastEarnedPoints}
          roundCountdownSeconds={roundCountdownSeconds}
          showChangeMode={isHost}
          onBackHome={handleBackToRoomOrChangeMode}
        />

        {/* Merkez: Oynat / Sonraki Şarkı Butonu */}
        <AudioPlayer
          duration={feedback?.isSuccess ? 8.0 : currentDuration}
          isPlaying={isPlaying}
          playbackSeconds={playbackSeconds}
          onTogglePlay={togglePlay}
          feedback={feedback}
          isLoading={isLoadingSong || !currentSong}
          isSongRevealed={isSongRevealed}
          onNextSong={handleNextSong}
          isLastStage={currentStageIndex >= totalStages - 1}
          isRoomMode={true}
          isHost={isHost}
          canSkip={canSkip}
          skipWaitingReason={skipWaitingReason}
        />

        {/* Şarkı Bildirildiğinde YouTube Embed Oynatıcı */}
        {currentSong?.youtubeId && isSongRevealed && (
          <div
            style={{ width: "100%", maxWidth: "580px", margin: "0.5rem auto" }}
          >
            <YouTubeEmbed
              youtubeId={currentSong.youtubeId}
              songTitle={`${currentSong.artist} - ${currentSong.title}`}
            />
          </div>
        )}

        {/* Alt Kısım: Tahmin & Deneme Alanı */}
        <div
          style={{
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <GuessInput
            onGuess={submitGuess}
            onSkip={advanceAttempt}
            disabled={isGuessLocked || isLoadingSong || !currentSong}
            isLoading={isLoadingSong || !currentSong}
            skipLabel={
              getAttemptSkipAdd(currentAttemptIndex)
                ? `Geç ${getAttemptSkipAdd(currentAttemptIndex)}`
                : "Pes Et"
            }
          />
          <AttemptDots currentAttemptIndex={currentAttemptIndex} />
        </div>
      </div>

      {/* Sağ Yan Panel: Canlı Skor Tablosu ve Oda Sohbeti */}
      {room && (
        <div className={styles.sidebarArea}>
          <div className={styles.sidebarTabs}>
            <button
              type="button"
              className={`${styles.sidebarTabBtn} ${sidebarTab === "scoreboard" ? styles.sidebarTabBtnActive : ""}`}
              onClick={() => setSidebarTab("scoreboard")}
            >
              🏆 Skor Tablosu
            </button>
            <button
              type="button"
              className={`${styles.sidebarTabBtn} ${sidebarTab === "chat" ? styles.sidebarTabBtnActive : ""}`}
              onClick={() => {
                setSidebarTab("chat");
                setUnreadChatCount(0);
              }}
            >
              💬 Sohbet
              {unreadChatCount > 0 && sidebarTab !== "chat" && (
                <span className={styles.unreadBadge}>{unreadChatCount}</span>
              )}
            </button>
          </div>

          {sidebarTab === "scoreboard" ? (
            <RoomScoreboard
              room={room}
              currentUserId={effectiveUserId}
              onKickParticipant={handleKickParticipant}
              isCurrentUserGuessing={
                !isGuessLocked &&
                !feedback?.isSuccess &&
                !isSongRevealed &&
                !isGameOver
              }
              currentUserEarnedPoints={lastEarnedPoints}
            />
          ) : (
            <RoomChat
              roomCode={room.code}
              currentUserId={effectiveUserId || ""}
              currentUserName={authService.getSession().user?.name}
              currentUserAvatarUrl={authService.getSession().user?.avatarUrl}
              isHost={room.hostId === effectiveUserId}
              height="500px"
            />
          )}
        </div>
      )}

      {/* Oyun Bittiğinde Katılımcı Puan Tablosu ve Sonuç Ekranı */}
      {(isGameOver || room?.status === "finished") && room && (
        <RoomGameOverModal
          room={room}
          currentUserId={effectiveUserId}
          score={score}
          onBackToRoom={handleBackToRoomOrChangeMode}
          onBackToHome={onBackToHome}
        />
      )}
    </div>
  );
};
