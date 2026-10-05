import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { webAudioService } from '@/services/audio/webAudioService';
import { getAttemptSkipAdd, STAGES } from '@/constants/game';
import type { CreateGameSessionRequest } from '@/types/game';
import type { Room } from '@/types/room';
import styles from './RoomGamePage.module.css';

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

  useEffect(() => {
    if (currentRoomCodeRef.current !== roomCode) {
      currentRoomCodeRef.current = roomCode;
      hasGameStartedRef.current = false;
    }
  }, [roomCode]);

  useEffect(() => {
    if (!roomCode) return;

    roomService.getRoomByCode(roomCode).then((updatedRoom) => {
      if (updatedRoom) {
        setRoom(updatedRoom);
      }
    });

    const unsubscribe = roomService.subscribeToRoom(roomCode, (updatedRoom) => {
      setRoom(updatedRoom);
      if (updatedRoom.status === 'waiting') {
        webAudioService.stopCurrentAudio();
        if (onBackToRoom) {
          onBackToRoom();
        } else {
          onBackToHome();
        }
      }
    });

    const unsubscribeKick = roomService.onParticipantKicked(roomCode, (targetUserId) => {
      if (currentUserId && String(targetUserId) === String(currentUserId)) {
        alert('Oda sahibi tarafından oyundan/odadan çıkarıldınız.');
        onBackToHome();
      }
    });

    return () => {
      unsubscribe();
      unsubscribeKick();
    };
  }, [roomCode, currentUserId, onBackToHome, onBackToRoom]);

  const handleScoreUpdate = useCallback(() => {
    if (!roomCode) return;
    roomService.getRoomByCode(roomCode).then((updatedRoom) => {
      if (updatedRoom) {
        setRoom(updatedRoom);
      }
    });
  }, [roomCode]);

  // Canlı skor ve oda durumunu senkronize tutmak için hafif periyodik yenileme (WebSocket gecikmelerine karşı fallback)
  useEffect(() => {
    if (!roomCode) return;
    const interval = setInterval(() => {
      roomService.getRoomByCode(roomCode).then((fresh) => {
        if (fresh) {
          setRoom(fresh);
          if (fresh.status === 'waiting') {
            webAudioService.stopCurrentAudio();
            if (onBackToRoom) {
              onBackToRoom();
            } else {
              onBackToHome();
            }
          }
        }
      });
    }, 2000);
    return () => clearInterval(interval);
  }, [roomCode, onBackToRoom, onBackToHome]);

  const roomGuessLimit =
    room?.guessTimeLimitMinutes ||
    room?.settings?.guessTimeLimitMinutes ||
    sessionParams.guessTimeLimitMinutes ||
    1;

  const isHost = Boolean(
    currentUserId &&
      ((room &&
        (String(room.hostId) === String(currentUserId) ||
          room.participants?.find((p) => String(p.user.id) === String(currentUserId))?.isHost)) ||
        (initialRoom &&
          (String(initialRoom.hostId) === String(currentUserId) ||
            initialRoom.participants?.find((p) => String(p.user.id) === String(currentUserId))?.isHost)))
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
    userId: currentUserId,
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
      (p) => p.lastPointsEarned !== null && p.lastPointsEarned !== undefined
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
    const updated = await roomService.kickParticipant(roomCode, currentUserId, targetUserId);
    setRoom({ ...updated });
  };

  // 'Modu değiştir' veya 'Odaya Dön' basıldığında oyunu bitirip tüm odayı lobiye döndür
  const handleBackToRoomOrChangeMode = useCallback(async () => {
    webAudioService.stopCurrentAudio();
    if (roomCode) {
      try {
        await roomService.changeRoomStatus(roomCode, 'waiting');
      } catch (err) {
        console.warn('[RoomGamePage] Failed to change room status to waiting:', err);
      }
    }
    if (onBackToRoom) {
      onBackToRoom();
    } else {
      onBackToHome();
    }
  }, [roomCode, onBackToRoom, onBackToHome]);

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
          onNextSong={goToNextSong}
          isLastStage={currentStageIndex >= totalStages - 1}
          isRoomMode={true}
          isHost={isHost}
          canSkip={canSkip}
          skipWaitingReason={skipWaitingReason}
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
            disabled={isGuessLocked || isLoadingSong || !currentSong}
            isLoading={isLoadingSong || !currentSong}
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
          <RoomScoreboard
            room={room}
            currentUserId={currentUserId}
            onKickParticipant={handleKickParticipant}
            isCurrentUserGuessing={!isGuessLocked && !feedback?.isSuccess && !isSongRevealed && !isGameOver}
            currentUserEarnedPoints={lastEarnedPoints}
          />
        </div>
      )}

      {/* Oyun Bittiğinde Katılımcı Puan Tablosu ve Sonuç Ekranı */}
      {(isGameOver || room?.status === 'finished') && room && (
        <RoomGameOverModal
          room={room}
          currentUserId={currentUserId}
          score={score}
          onBackToRoom={handleBackToRoomOrChangeMode}
          onBackToHome={onBackToHome}
        />
      )}
    </div>
  );
};
