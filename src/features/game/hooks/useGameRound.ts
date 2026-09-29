import { useCallback, useEffect, useRef, useState } from 'react';
import { ATTEMPT_DURATIONS, STAGES } from '@/constants/game';
import { gameService } from '@/services/api/gameService';
import { roomService } from '@/services/api/roomService';
import { songService } from '@/services/api/songService';
import { webAudioService } from '@/services/audio/webAudioService';
import type { CreateGameSessionRequest, GameStage, GuessRequest, Song } from '@/types';

export interface FeedbackState {
  isSuccess: boolean;
  message: string;
}

export interface UseGameRoundOptions {
  roomCode?: string | null;
  userId?: string | null;
  onScoreUpdate?: (points: number, duration: number, totalScore: number) => void;
}

export function useGameRound(options?: UseGameRoundOptions) {
  const [currentRegion, setCurrentRegion] = useState<'tr' | 'global'>('tr');
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [currentAttemptIndex, setCurrentAttemptIndex] = useState(0);
  const [songsPool, setSongsPool] = useState<Song[]>([]);
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSeconds, setPlaybackSeconds] = useState(0);
  const [playbackRatio, setPlaybackRatio] = useState(0);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [isGameOver, setIsGameOver] = useState(false);
  const [selectedCustomArtist, setSelectedCustomArtist] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [isGuessLocked, setIsGuessLocked] = useState(false);
  const [isLoadingSong, setIsLoadingSong] = useState(true);

  const resetTimerRef = useRef<number | null>(null);

  const clearResetTimer = useCallback(() => {
    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
  }, []);

  const currentStage: GameStage = STAGES[currentStageIndex] || STAGES[0];
  const activeDuration: number = isGuessLocked ? 8.0 : (ATTEMPT_DURATIONS[currentAttemptIndex] || 0.5);

  // Yeni oyun başlatma (İlk aşama olan 'Kolay' için ilgili bölgenin playlistini çeker)
  const startNewGame = useCallback(async (params: CreateGameSessionRequest) => {
    webAudioService.stopCurrentAudio();
    setIsPlaying(false);
    setPlaybackSeconds(0);
    setPlaybackRatio(0);
    setFeedback(null);
    setIsGameOver(false);
    setIsGuessLocked(false);
    setIsLoadingSong(true);
    setCurrentStageIndex(0);
    setCurrentAttemptIndex(0);
    setScore(0);
    setSelectedCustomArtist(params.artist || null);

    const chosenRegion = params.region === 'global' ? 'global' : 'tr';
    setCurrentRegion(chosenRegion);

    // 1. Aşama (Kolay) playlistini çek ve parçayı başlat
    const initialSong = await songService.getRandomSongForStage(chosenRegion, 0);
    setSongsPool([initialSong]);
    setCurrentSong(initialSong);

    // Parça çalmaya tamamen hazır olana kadar bekle
    await webAudioService.preloadSong(initialSong);
    setIsLoadingSong(false);

    await gameService.createSession(params);
  }, []);

  // Ses klibi çalma / durdurma (anlık saniye imleci takipli)
  const togglePlay = useCallback(() => {
    if (!currentSong || isLoadingSong || isGuessLocked) return;

    clearResetTimer();
    if (feedback?.message === 'Yanlış tahmin!') {
      setFeedback(null);
    }

    if (isPlaying) {
      webAudioService.stopCurrentAudio();
      setIsPlaying(false);
      setPlaybackSeconds(0);
      setPlaybackRatio(0);
    } else {
      setIsPlaying(true);
      setPlaybackSeconds(0);
      setPlaybackRatio(0);

      webAudioService.playSongClip(
        currentSong,
        activeDuration,
        () => {
          setIsPlaying(false);
          setPlaybackSeconds(activeDuration);
          setPlaybackRatio(1);
          clearResetTimer();
          resetTimerRef.current = window.setTimeout(() => {
            setIsPlaying((current) => {
              if (!current) {
                setPlaybackSeconds(0);
                setPlaybackRatio(0);
              }
              return current;
            });
            resetTimerRef.current = null;
          }, 800);
        },
        (sec, ratio) => {
          setPlaybackSeconds(sec);
          setPlaybackRatio(ratio);
        }
      );
    }
  }, [currentSong, activeDuration, isPlaying, isLoadingSong, isGuessLocked, clearResetTimer, feedback]);

  // Yanlış tahmin veya 'Geç' basıldığında denemeyi ilerletme
  const advanceAttempt = useCallback(() => {
    if (isGuessLocked) return;

    clearResetTimer();
    webAudioService.stopCurrentAudio();
    setIsPlaying(false);
    setPlaybackSeconds(0);
    setPlaybackRatio(0);

    if (currentAttemptIndex < ATTEMPT_DURATIONS.length - 1) {
      const nextAttempt = currentAttemptIndex + 1;
      setCurrentAttemptIndex(nextAttempt);
    } else {
      // Tüm denemeler bitti / Pes Edildi - Bu aşama başarısız
      if (currentSong) {
        setIsGuessLocked(true);
        setFeedback({
          isSuccess: false,
          message: `Bilemedin! Doğru parça: ${currentSong.artist} - ${currentSong.title}`,
        });

        // Pes edince şarkı yine de 8 saniye boyunca çalsın!
        clearResetTimer();
        const REVEAL_PLAY_DURATION = 8.0;
        setIsPlaying(true);
        setPlaybackSeconds(0);
        setPlaybackRatio(0);

        webAudioService.playSongClip(
          currentSong,
          REVEAL_PLAY_DURATION,
          () => {
            setIsPlaying(false);
            setPlaybackSeconds(REVEAL_PLAY_DURATION);
            setPlaybackRatio(1);
          },
          (sec, ratio) => {
            setPlaybackSeconds(sec);
            setPlaybackRatio(ratio);
          }
        );

        setTimeout(async () => {
          webAudioService.stopCurrentAudio();
          setIsPlaying(false);
          setPlaybackSeconds(0);
          setPlaybackRatio(0);
          setIsGuessLocked(false);

          if (currentStageIndex < STAGES.length - 1) {
            const nextStage = currentStageIndex + 1;
            setCurrentStageIndex(nextStage);
            setCurrentAttemptIndex(0);
            setFeedback(null);

            setIsLoadingSong(true);
            // Zorluk değiştiğinde o zorluğun playlistinden şarkıyı çek
            const nextSong = await songService.getRandomSongForStage(currentRegion, nextStage);
            setCurrentSong(nextSong);
            await webAudioService.preloadSong(nextSong);
            setIsLoadingSong(false);
          } else {
            setIsGameOver(true);
            setFeedback({
              isSuccess: false,
              message: 'Oyun Bitti! Tüm aşamaları tamamladın.',
            });
          }
        }, 8500);
      }
    }
  }, [currentAttemptIndex, currentRegion, currentSong, currentStageIndex, isGuessLocked]);

  // Tahmin onaylama — Service isteği çalışır ve hangi sürede bildiyse ona göre puan eklenir
  const submitGuess = useCallback(
    async (chosenSong: Song) => {
      if (!currentSong || isGuessLocked) return;

      clearResetTimer();
      webAudioService.stopCurrentAudio();
      setIsPlaying(false);
      setPlaybackSeconds(0);
      setPlaybackRatio(0);

      const request: GuessRequest = {
        songId: chosenSong.id,
        stageIndex: currentStageIndex,
        attemptIndex: currentAttemptIndex,
        duration: activeDuration,
        guessedTitle: chosenSong.title,
        userId: options?.userId || undefined,
        roomCode: options?.roomCode || undefined,
      };

      console.log('🎯 [submitGuess]', {
        chosenTitle: chosenSong.title,
        actualSong: currentSong.title,
        stage: currentStageIndex,
        attempt: currentAttemptIndex,
        duration: activeDuration,
      });

      // Service isteği çalıştırılıyor
      const response = await gameService.submitGuess(request, currentSong, chosenSong.title);

      if (response.isCorrect) {
        // Doğru Tahmin: Girişleri ve butonları kilitle
        setIsGuessLocked(true);

        const earned = response.pointsEarned;
        setScore((prev) => {
          const nextScore = prev + earned;
          options?.onScoreUpdate?.(earned, activeDuration, nextScore);
          return nextScore;
        });

        // Oda aktifse oda katılımcısının skorunu da güncelle
        if (options?.roomCode && options?.userId) {
          roomService.updateParticipantScore(
            options.roomCode,
            options.userId,
            earned,
            activeDuration
          );
        }

        setFeedback({
          isSuccess: true,
          message: response.message,
        });

        // Şarkıyı bilince otomatik olarak tekrar başlasın ve 8 saniye boyunca çalsın!
        clearResetTimer();
        const VICTORY_PLAY_DURATION = 8.0;
        setIsPlaying(true);
        setPlaybackSeconds(0);
        setPlaybackRatio(0);

        webAudioService.playSongClip(
          currentSong,
          VICTORY_PLAY_DURATION,
          () => {
            setIsPlaying(false);
            setPlaybackSeconds(VICTORY_PLAY_DURATION);
            setPlaybackRatio(1);
          },
          (sec, ratio) => {
            setPlaybackSeconds(sec);
            setPlaybackRatio(ratio);
          }
        );

        // 8 saniye çalma tamamlandıktan sonra bir sonraki aşamaya geç
        setTimeout(async () => {
          webAudioService.stopCurrentAudio();
          setIsPlaying(false);
          setPlaybackSeconds(0);
          setPlaybackRatio(0);
          setIsGuessLocked(false);

          if (currentStageIndex < STAGES.length - 1) {
            const nextStage = currentStageIndex + 1;
            setCurrentStageIndex(nextStage);
            setCurrentAttemptIndex(0);
            setFeedback(null);

            setIsLoadingSong(true);
            // Zorluk değiştiğinde o zorluğun playlistinden şarkıyı çek
            const nextSong = await songService.getRandomSongForStage(currentRegion, nextStage);
            setCurrentSong(nextSong);
            await webAudioService.preloadSong(nextSong);
            setIsLoadingSong(false);
          } else {
            setIsGameOver(true);
            setFeedback({
              isSuccess: true,
              message: `Mükemmel! ${STAGES.length} aşamayı da başarıyla tamamladın!`,
            });
          }
        }, 8500);
      } else {
        // Yanlış Tahmin: Süre barı kırmızı olsun ve kullanıcıya bildirim verilsin
        if (currentAttemptIndex < ATTEMPT_DURATIONS.length - 1) {
          setFeedback({
            isSuccess: false,
            message: 'Yanlış tahmin!',
          });
          setTimeout(() => {
            setFeedback((prev) => (prev?.message === 'Yanlış tahmin!' ? null : prev));
          }, 1500);
        }
        advanceAttempt();
      }
    },
    [
      currentSong,
      isGuessLocked,
      currentAttemptIndex,
      activeDuration,
      currentStageIndex,
      currentRegion,
      options,
      advanceAttempt,
    ]
  );

  // Komponent unmount olduğunda sesi durdur ve zamanlayıcıları temizle
  useEffect(() => {
    return () => {
      clearResetTimer();
      webAudioService.stopCurrentAudio();
    };
  }, [clearResetTimer]);

  const isSongRevealed = isGuessLocked || (feedback !== null && feedback.message.includes('Doğru parça:'));

  return {
    currentStageIndex,
    currentStage,
    currentAttemptIndex,
    currentDuration: activeDuration,
    currentSong,
    isPlaying,
    isLoadingSong,
    playbackSeconds,
    playbackRatio,
    feedback,
    isGameOver,
    score,
    selectedCustomArtist,
    isGuessLocked,
    isSongRevealed,
    startNewGame,
    togglePlay,
    advanceAttempt,
    submitGuess,
  };
}
