import { useCallback, useEffect, useState } from 'react';
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

  const currentStage: GameStage = STAGES[currentStageIndex] || STAGES[0];
  const currentDuration: number = ATTEMPT_DURATIONS[currentAttemptIndex] || 0.1;

  // Yeni oyun başlatma (İlk aşama olan 'Kolay' için ilgili bölgenin playlistini çeker)
  const startNewGame = useCallback(async (params: CreateGameSessionRequest) => {
    webAudioService.stopCurrentAudio();
    setIsPlaying(false);
    setPlaybackSeconds(0);
    setPlaybackRatio(0);
    setFeedback(null);
    setIsGameOver(false);
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

    await gameService.createSession(params);
  }, []);

  // Ses klibi çalma / durdurma (anlık saniye imleci takipli)
  const togglePlay = useCallback(() => {
    if (!currentSong) return;

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
        currentDuration,
        () => {
          setIsPlaying(false);
          setPlaybackSeconds(currentDuration);
          setPlaybackRatio(1);
          setTimeout(() => {
            setPlaybackSeconds(0);
            setPlaybackRatio(0);
          }, 800);
        },
        (sec, ratio) => {
          setPlaybackSeconds(sec);
          setPlaybackRatio(ratio);
        }
      );
    }
  }, [currentSong, currentDuration, isPlaying]);

  // Yanlış tahmin veya 'Geç' basıldığında denemeyi ilerletme
  const advanceAttempt = useCallback(() => {
    webAudioService.stopCurrentAudio();
    setIsPlaying(false);
    setPlaybackSeconds(0);
    setPlaybackRatio(0);

    if (currentAttemptIndex < ATTEMPT_DURATIONS.length - 1) {
      const nextAttempt = currentAttemptIndex + 1;
      setCurrentAttemptIndex(nextAttempt);
    } else {
      // Tüm denemeler bitti - Bu aşama başarısız
      if (currentSong) {
        setFeedback({
          isSuccess: false,
          message: `Bilemedin! Doğru parça: ${currentSong.artist} - ${currentSong.title}`,
        });
      }

      setTimeout(async () => {
        if (currentStageIndex < STAGES.length - 1) {
          const nextStage = currentStageIndex + 1;
          setCurrentStageIndex(nextStage);
          setCurrentAttemptIndex(0);
          setFeedback(null);

          // Zorluk değiştiğinde o zorluğun playlistinden şarkıyı çek
          const nextSong = await songService.getRandomSongForStage(currentRegion, nextStage);
          setCurrentSong(nextSong);
        } else {
          setIsGameOver(true);
          setFeedback({
            isSuccess: true,
            message: 'Oyun Bitti! Tüm aşamaları tamamladın.',
          });
        }
      }, 2500);
    }
  }, [currentAttemptIndex, currentRegion, currentSong, currentStageIndex]);

  // Tahmin onaylama — Service isteği çalışır ve hangi sürede bildiyse ona göre puan eklenir
  const submitGuess = useCallback(
    async (chosenSong: Song) => {
      if (!currentSong) return;

      webAudioService.stopCurrentAudio();
      setIsPlaying(false);
      setPlaybackSeconds(0);
      setPlaybackRatio(0);

      const request: GuessRequest = {
        songId: chosenSong.id,
        stageIndex: currentStageIndex,
        attemptIndex: currentAttemptIndex,
        duration: currentDuration,
        guessedTitle: chosenSong.title,
        userId: options?.userId || undefined,
        roomCode: options?.roomCode || undefined,
      };

      // Service isteği çalıştırılıyor
      const response = await gameService.submitGuess(request, currentSong, chosenSong.title);

      if (response.isCorrect) {
        // Doğru Tahmin! Süreye göre puan eklendi
        const earned = response.pointsEarned;
        setScore((prev) => {
          const nextScore = prev + earned;
          options?.onScoreUpdate?.(earned, currentDuration, nextScore);
          return nextScore;
        });

        // Oda aktifse oda katılımcısının skorunu da güncelle
        if (options?.roomCode && options?.userId) {
          roomService.updateParticipantScore(
            options.roomCode,
            options.userId,
            earned,
            currentDuration
          );
        }

        setFeedback({
          isSuccess: true,
          message: response.message,
        });

        setTimeout(async () => {
          if (currentStageIndex < STAGES.length - 1) {
            const nextStage = currentStageIndex + 1;
            setCurrentStageIndex(nextStage);
            setCurrentAttemptIndex(0);
            setFeedback(null);

            // Zorluk değiştiğinde o zorluğun playlistinden şarkıyı çek
            const nextSong = await songService.getRandomSongForStage(currentRegion, nextStage);
            setCurrentSong(nextSong);
          } else {
            setIsGameOver(true);
            setFeedback({
              isSuccess: true,
              message: `Mükemmel! ${STAGES.length} aşamayı da başarıyla tamamladın!`,
            });
          }
        }, 2200);
      } else {
        // Yanlış Tahmin
        setFeedback({
          isSuccess: false,
          message: `Yanlış: "${chosenSong.title}" değil. Süre açıldı!`,
        });
        advanceAttempt();
      }
    },
    [
      currentSong,
      currentAttemptIndex,
      currentDuration,
      currentStageIndex,
      currentRegion,
      options,
      advanceAttempt,
    ]
  );

  // Komponent unmount olduğunda sesi durdur
  useEffect(() => {
    return () => {
      webAudioService.stopCurrentAudio();
    };
  }, []);

  return {
    currentStageIndex,
    currentStage,
    currentAttemptIndex,
    currentDuration,
    currentSong,
    isPlaying,
    playbackSeconds,
    playbackRatio,
    feedback,
    isGameOver,
    score,
    selectedCustomArtist,
    startNewGame,
    togglePlay,
    advanceAttempt,
    submitGuess,
  };
}
