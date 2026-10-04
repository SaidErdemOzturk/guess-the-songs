import React, { useCallback, useEffect, useState } from 'react';
import {
  AudioPlayer,
  GuessInput,
  StageControlBar,
  AttemptDots,
  YouTubeEmbed,
  useGameRound,
} from '@/features/game';
import { RoomScoreboard } from '@/features/room/components/RoomScoreboard/RoomScoreboard';
import { RoomGameOverModal } from '@/features/room/components/RoomGameOverModal/RoomGameOverModal';
import { roomService } from '@/services/api/roomService';
import { getAttemptSkipAdd, STAGES } from '@/constants/game';
import type { CreateGameSessionRequest } from '@/types/game';
import type { Room } from '@/types/room';
import styles from './RoomGamePage.module.css';

interface RoomGamePageProps {
  sessionParams: CreateGameSessionRequest;
  roomCode: string;
  currentUserId?: string | null;
  onBackToHome: () => void;
}

export const RoomGamePage: React.FC<RoomGamePageProps> = ({
  sessionParams,
  roomCode,
  currentUserId,
  onBackToHome,
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
    if (!roomCode) return;
    const unsubscribe = roomService.subscribeToRoom(roomCode, (updatedRoom) => {
      setRoom({ ...updatedRoom });
    });
    return () => {
      unsubscribe();
    };
  }, [roomCode, refreshRoom]);

  const handleScoreUpdate = useCallback(() => {
    refreshRoom();
  }, [refreshRoom]);

  const roomGuessLimit =
    room?.guessTimeLimitMinutes ||
    room?.settings?.guessTimeLimitMinutes ||
    sessionParams.guessTimeLimitMinutes ||
    1;

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
    startNewGame,
    togglePlay,
    advanceAttempt,
    submitGuess,
    goToNextSong,
  } = useGameRound({
    roomCode,
    userId: currentUserId,
    guessTimeLimitMinutes: roomGuessLimit,
    onScoreUpdate: handleScoreUpdate,
  });

  // Bileşen yüklendiğinde oyun başlatılır
  useEffect(() => {
    startNewGame(sessionParams);
  }, [sessionParams, startNewGame]);

  // Oyun bittiğinde son skorları garantiye almak için odayı yenile
  useEffect(() => {
    if (isGameOver) {
      refreshRoom();
    }
  }, [isGameOver, refreshRoom]);

  return (
    <div className={styles.roomGameContainer}>
      {/* Sol / Ana Oyun Bölümü */}
      <div className={styles.gameMainArea}>
        {/* Üst Kontrol & Aşama Barı (Canlı Geri Sayım Rozeti ile) */}
        <StageControlBar
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
          onBackHome={onBackToHome}
        />

        {/* Merkez: Oynat / Sonraki Şarkı Butonu */}
        <AudioPlayer
          duration={feedback?.isSuccess ? 8.0 : currentDuration}
          isPlaying={isPlaying}
          playbackSeconds={playbackSeconds}
          onTogglePlay={togglePlay}
          feedback={feedback}
          isLoading={isLoadingSong}
          isSongRevealed={isSongRevealed}
          onNextSong={goToNextSong}
          isLastStage={currentStageIndex >= STAGES.length - 1}
        />

        {/* Şarkı Bildirildiğinde YouTube Embed Oynatıcı */}
        {currentSong?.youtubeId && isSongRevealed && (
          <div style={{ width: '100%', maxWidth: '580px', margin: '0.5rem auto' }}>
            <YouTubeEmbed
              youtubeId={currentSong.youtubeId}
              songTitle={`${currentSong.artist} - ${currentSong.title}`}
            />
          </div>
        )}

        {/* Alt Kısım: Tahmin & Deneme Alanı */}
        <div
          style={{
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
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
                : 'Pes Et'
            }
          />
          <AttemptDots currentAttemptIndex={currentAttemptIndex} />
        </div>
      </div>

      {/* Sağ Yan Panel: Canlı Skor Tablosu */}
      {room && (
        <div className={styles.sidebarArea}>
          <RoomScoreboard room={room} currentUserId={currentUserId} />
        </div>
      )}

      {/* Oyun Bittiğinde Katılımcı Puan Tablosu ve Sonuç Ekranı */}
      {isGameOver && room && (
        <RoomGameOverModal
          room={room}
          currentUserId={currentUserId}
          score={score}
          onBackToHome={onBackToHome}
        />
      )}
    </div>
  );
};
