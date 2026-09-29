import React, { useCallback, useEffect, useState } from "react";
import {
  AudioPlayer,
  GuessInput,
  StageControlBar,
  AttemptDots,
  SpotifyEmbed,
  useGameRound,
} from "@/features/game";
import { RoomScoreboard } from "@/features/room/components/RoomScoreboard/RoomScoreboard";
import { roomService } from "@/services/api/roomService";
import { getAttemptSkipAdd } from "@/constants/game";
import type { CreateGameSessionRequest } from "@/types/game";
import type { Room } from "@/types/room";
import styles from "./GamePage.module.css";

interface GamePageProps {
  sessionParams: CreateGameSessionRequest;
  onBackToHome: () => void;
  roomCode?: string | null;
  currentUserId?: string | null;
}

export const GamePage: React.FC<GamePageProps> = ({
  sessionParams,
  onBackToHome,
  roomCode,
  currentUserId,
}) => {
  const [room, setRoom] = useState<Room | null>(null);

  const refreshRoom = useCallback(() => {
    if (!roomCode) return;
    roomService.getRoomByCode(roomCode).then((updatedRoom) => {
      if (updatedRoom) {
        setRoom({ ...updatedRoom });
      }
    });
  }, [roomCode]);

  useEffect(() => {
    refreshRoom();
  }, [refreshRoom]);

  const handleScoreUpdate = useCallback(() => {
    refreshRoom();
  }, [refreshRoom]);

  const {
    currentStageIndex,
    currentAttemptIndex,
    currentDuration,
    currentSong,
    isPlaying,
    playbackSeconds,
    playbackRatio,
    feedback,
    isGuessLocked,
    isSongRevealed,
    isLoadingSong,
    startNewGame,
    togglePlay,
    advanceAttempt,
    submitGuess,
  } = useGameRound({
    roomCode,
    userId: currentUserId,
    onScoreUpdate: handleScoreUpdate,
  });

  // Bileşen yüklendiğinde bölge, tür ve dönem backend'e gönderilir
  useEffect(() => {
    startNewGame(sessionParams);
  }, [sessionParams, startNewGame]);

  const hasSidebar = Boolean(room);

  return (
    <div
      className={`${styles.gamePageContainer} ${
        hasSidebar ? styles.hasSidebar : styles.solo
      }`}
    >
      {/* Sol / Ana Oyun Bölümü */}
      <div className={styles.gameMainArea}>
        {/* Üst Kontrol & Aşama Barı (Canlı Saniye İmleci ile) */}
        <StageControlBar
          currentStageIndex={currentStageIndex}
          currentAttemptIndex={currentAttemptIndex}
          currentDuration={feedback?.isSuccess ? 8.0 : currentDuration}
          playbackSeconds={playbackSeconds}
          playbackRatio={playbackRatio}
          isPlaying={isPlaying}
          isSolved={Boolean(feedback?.isSuccess)}
          isWrong={Boolean(feedback !== null && !feedback.isSuccess)}
          onBackHome={onBackToHome}
        />

        {/* Merkez: Oynat Butonu & Canlı Süre Göstergesi */}
        <AudioPlayer
          duration={feedback?.isSuccess ? 8.0 : currentDuration}
          isPlaying={isPlaying}
          playbackSeconds={playbackSeconds}
          onTogglePlay={togglePlay}
          feedback={feedback}
          isLoading={isLoadingSong}
        />

        {/* Şarkı Bildirildiğinde / Aşama Bittiğinde Spotify Embed Oynatıcı */}
        {currentSong?.spotifyId && isSongRevealed && (
          <div style={{ width: "100%", maxWidth: "580px", margin: "0.5rem auto" }}>
            <SpotifyEmbed spotifyId={currentSong.spotifyId} compact={true} />
          </div>
        )}

        {/* Alt Kısım: Arama & Tahmin Alanı */}
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
            disabled={isGuessLocked || isLoadingSong}
            isLoading={isLoadingSong}
            skipLabel={
              getAttemptSkipAdd(currentAttemptIndex)
                ? `Geç ${getAttemptSkipAdd(currentAttemptIndex)}`
                : "Pes Et"
            }
          />
          <AttemptDots currentAttemptIndex={currentAttemptIndex} />
        </div>
      </div>

      {/* Sağ Yan Panel: Oda Puan Durumu (Scoreboard) */}
      {room && (
        <div className={styles.sidebarArea}>
          <RoomScoreboard room={room} currentUserId={currentUserId} />
        </div>
      )}
    </div>
  );
};
