import { useCallback, useEffect, useRef, useState } from 'react';
import { ATTEMPT_DURATIONS, STAGES } from '@/constants/game';
import { calculatePointsByDuration, gameService } from '@/services/api/gameService';
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
  guessTimeLimitMinutes?: number;
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
  const [lastEarnedPoints, setLastEarnedPoints] = useState<number | null>(null);
  const isRoomMode = Boolean(options?.roomCode);
  const [guessTimeLimitMinutes, setGuessTimeLimitMinutes] = useState<number | undefined>(
    isRoomMode ? (options?.guessTimeLimitMinutes || 1) : undefined
  );
  const [roundCountdownSeconds, setRoundCountdownSeconds] = useState<number | undefined>(
    isRoomMode ? ((options?.guessTimeLimitMinutes || 1) * 60) : undefined
  );
  const [isGuessLocked, setIsGuessLocked] = useState(false);
  const [isLoadingSong, setIsLoadingSong] = useState(false);

  const resetTimerRef = useRef<number | null>(null);

  const clearResetTimer = useCallback(() => {
    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
  }, []);

  const currentStage: GameStage = STAGES[currentStageIndex] || STAGES[0];
  const activeDuration: number = isGuessLocked ? 8.0 : (ATTEMPT_DURATIONS[currentAttemptIndex] || 0.5);
  const isSongRevealed = isGuessLocked || (feedback !== null && feedback.message.includes('Doğru parça:'));

  const potentialPoints = calculatePointsByDuration(
    activeDuration,
    currentSong?.difficultyRank || 1
  );

  // Oda ayarlarından gelen süre sınırı güncellenirse senkronize et (Sadece oda modunda)
  useEffect(() => {
    if (!options?.roomCode) {
      setGuessTimeLimitMinutes(undefined);
      setRoundCountdownSeconds(undefined);
      return;
    }

    if (options.guessTimeLimitMinutes && options.guessTimeLimitMinutes !== guessTimeLimitMinutes) {
      setGuessTimeLimitMinutes(options.guessTimeLimitMinutes);
      setRoundCountdownSeconds(options.guessTimeLimitMinutes * 60);
    }
  }, [options?.roomCode, options?.guessTimeLimitMinutes, guessTimeLimitMinutes]);

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
    setLastEarnedPoints(null);

    if (options?.roomCode) {
      const timeLimit = params.guessTimeLimitMinutes || options?.guessTimeLimitMinutes || 1;
      setGuessTimeLimitMinutes(timeLimit);
      setRoundCountdownSeconds(timeLimit * 60);
    } else {
      setGuessTimeLimitMinutes(undefined);
      setRoundCountdownSeconds(undefined);
    }

    setSelectedCustomArtist(params.artist || null);

    const chosenRegion = params.region === 'global' ? 'global' : 'tr';
    setCurrentRegion(chosenRegion);

    try {
      // 1. Başla'ya basılınca BÜTÜN playlistler çekilir
      await songService.initializeGamePlaylists(chosenRegion);

      // 2. Kolay adımdaysa (Aşama 0), kolay adımdan random bir şarkı tahmin edilecek
      let initialSong: Song | null = null;
      if (options?.roomCode) {
        const room = await roomService.getRoomByCode(options.roomCode);
        if (room?.currentSong) {
          initialSong = room.currentSong;
        }
      }

      if (!initialSong) {
        initialSong = await songService.getRandomSongForStage(chosenRegion, 0);
        if (options?.roomCode) {
          // Odaya ortak şarkıyı bildir, herkes aynı şarkıyı dinlesin!
          roomService.setCurrentSong(options.roomCode, initialSong, 1);
        }
      }

      setSongsPool([initialSong]);
      setCurrentSong(initialSong);

      // Parçayı arka planda önceden yükle
      webAudioService.preloadSong(initialSong).catch(() => {});
      await gameService.createSession(params);
    } catch (err) {
      console.error('⚠️ [GameRound] Oyun başlatma hatası:', err);
    } finally {
      setIsLoadingSong(false);
    }
  }, [options]);

  // Ses klibi çalma / durdurma (anlık saniye imleci takipli)
  const togglePlay = useCallback(() => {
    if (!currentSong || isLoadingSong) return;

    // Şarkı çözülmüş veya pes edilmiş durumdayken duraklat / kaldığı yerden devam ettir (baştan başlamaz)
    if (isGuessLocked) {
      if (isPlaying) {
        webAudioService.pauseAudio();
        setIsPlaying(false);
      } else {
        setIsPlaying(true);
        webAudioService.resumeAudio((sec, ratio) => {
          setPlaybackSeconds(sec);
          setPlaybackRatio(ratio);
        });
      }
      return;
    }

    clearResetTimer();
    if (feedback?.message === 'Yanlış tahmin!') {
      setFeedback(null);
    }

    const isCurrentlyPlaying = isPlaying || webAudioService.getIsPlaying();

    if (isCurrentlyPlaying) {
      clearResetTimer();
      webAudioService.stopCurrentAudio();
      setIsPlaying(false);
      setPlaybackSeconds(0);
      setPlaybackRatio(0);
      return;
    }

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
  }, [currentSong, isLoadingSong, isGuessLocked, isPlaying, clearResetTimer, feedback, activeDuration]);

  // Pes etme / Süre bitimi işlemi
  const handleGiveUp = useCallback(
    (isTimeout = false) => {
      if (isGuessLocked || !currentSong) return;

      clearResetTimer();
      webAudioService.stopCurrentAudio();
      setIsPlaying(false);
      setPlaybackSeconds(0);
      setPlaybackRatio(0);

      setIsGuessLocked(true);
      setLastEarnedPoints(0);
      setFeedback({
        isSuccess: false,
        message: isTimeout
          ? `Süre doldu! Doğru parça: ${currentSong.artist} - ${currentSong.title}`
          : `Bilemedin! Doğru parça: ${currentSong.artist} - ${currentSong.title}`,
      });

      // Şarkı pes edildiğinde arka plan sesini kapat (YouTube iFrame videoyu açar)
      clearResetTimer();
      webAudioService.stopCurrentAudio();
      setIsPlaying(false);
      setPlaybackSeconds(0);
      setPlaybackRatio(0);
    },
    [isGuessLocked, currentSong, clearResetTimer]
  );

  // Şarkıyı bilme süresi geri sayımı (YALNIZCA ODA İÇERİSİNDEYSE çalışır)
  useEffect(() => {
    if (!options?.roomCode || isGuessLocked || isGameOver || isLoadingSong) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setRoundCountdownSeconds((prev) => {
        if (prev === undefined) return undefined;
        if (prev <= 1) {
          clearInterval(intervalId);
          handleGiveUp(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(intervalId);
  }, [options?.roomCode, isGuessLocked, isGameOver, isLoadingSong, handleGiveUp]);

  // Oda modunda senkronize ortak şarkıyı WebSocket üzerinden dinle
  useEffect(() => {
    if (!options?.roomCode) return;

    const unsubscribe = roomService.onSongChanged(options.roomCode, async (syncSong, round) => {
      if (!currentSong || currentSong.id !== syncSong.id) {
        clearResetTimer();
        webAudioService.stopCurrentAudio();
        setIsPlaying(false);
        setPlaybackSeconds(0);
        setPlaybackRatio(0);
        setIsGuessLocked(false);
        setFeedback(null);
        setLastEarnedPoints(null);
        setCurrentSong(syncSong);
        setCurrentStageIndex(Math.max(0, round - 1));
        setCurrentAttemptIndex(0);
        setIsLoadingSong(true);
        await webAudioService.preloadSong(syncSong);
        setIsLoadingSong(false);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [options?.roomCode, currentSong, clearResetTimer]);

  // YouTube oynatma hatası (101/150 embed engeli veya 100 video silinmesi) durumunda
  // sessizlikte kalmamak için otomatik olarak sıradaki oynatılabilir şarkıya geçer
  useEffect(() => {
    const unsubscribe = webAudioService.onPlaybackError(async (failedVideoId, errorCode) => {
      if (!currentSong || isGameOver || isSongRevealed) return;
      if (failedVideoId && currentSong.youtubeId && currentSong.youtubeId !== failedVideoId) return;

      console.warn(
        `🚨 [GameRound] "${currentSong.artist} - ${currentSong.title}" (ID: ${failedVideoId}) telif/embed engeline takıldı (Hata: ${errorCode}). ` +
        `Otomatik olarak yeni bir şarkı seçiliyor...`
      );

      clearResetTimer();
      webAudioService.stopCurrentAudio();
      setIsPlaying(false);
      setPlaybackSeconds(0);
      setPlaybackRatio(0);
      setIsLoadingSong(true);

      try {
        const replacementSong = await songService.getRandomSongForStage(
          currentRegion,
          currentStageIndex,
          currentSong.youtubeId || currentSong.id
        );

        if (replacementSong && (replacementSong.youtubeId !== currentSong.youtubeId || replacementSong.title !== currentSong.title)) {
          console.log(`✨ [GameRound] Yeni parça yüklendi: "${replacementSong.artist} - ${replacementSong.title}"`);
          setCurrentSong(replacementSong);
          setSongsPool([replacementSong]);

          if (options?.roomCode) {
            roomService.setCurrentSong(options.roomCode, replacementSong, currentStageIndex + 1);
          }

          await webAudioService.preloadSong(replacementSong);
        }
      } catch (err) {
        console.error('Alternatif şarkı yüklenirken hata oluştu:', err);
      } finally {
        setIsLoadingSong(false);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [currentSong, isGameOver, isSongRevealed, currentStageIndex, currentRegion, options?.roomCode, clearResetTimer]);

  // Sıradaki şarkıya geçme fonksiyonu (Kullanıcı dilediği an butona basarak geçer)
  const goToNextSong = useCallback(async () => {
    clearResetTimer();
    webAudioService.stopCurrentAudio();
    setIsPlaying(false);
    setPlaybackSeconds(0);
    setPlaybackRatio(0);
    setIsGuessLocked(false);
    setLastEarnedPoints(null);
    if (options?.roomCode && guessTimeLimitMinutes) {
      setRoundCountdownSeconds(guessTimeLimitMinutes * 60);
    } else {
      setRoundCountdownSeconds(undefined);
    }

    if (currentStageIndex < STAGES.length - 1) {
      const nextStage = currentStageIndex + 1;
      setCurrentStageIndex(nextStage);
      setCurrentAttemptIndex(0);
      setFeedback(null);

      setIsLoadingSong(true);
      try {
        // Zorluk değiştiğinde o zorluğun playlistinden şarkıyı çek (ilk şarkı hariç, rastgele) ve odaya bildir
        const nextSong = await songService.getRandomSongForStage(currentRegion, nextStage, currentSong?.id);
        setCurrentSong(nextSong);
        if (options?.roomCode) {
          roomService.setCurrentSong(options.roomCode, nextSong, nextStage + 1);
        }
        await webAudioService.preloadSong(nextSong).catch(() => {});
      } catch (err) {
        console.warn('⚠️ [GameRound] Sonraki şarkı yükleme hatası:', err);
      } finally {
        setIsLoadingSong(false);
      }
    } else {
      setIsGameOver(true);
      setFeedback({
        isSuccess: true,
        message: `Mükemmel! ${STAGES.length} aşamayı da başarıyla tamamladın!`,
      });
    }
  }, [clearResetTimer, currentRegion, currentStageIndex, currentSong?.id, guessTimeLimitMinutes, options?.roomCode]);

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
      handleGiveUp(false);
    }
  }, [currentAttemptIndex, isGuessLocked, clearResetTimer, handleGiveUp]);

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
        // Doğru Tahmin: Girişleri ve tahmin alanını kilitle
        setIsGuessLocked(true);

        const earned = response.pointsEarned;
        setLastEarnedPoints(earned);
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

        // Şarkı bilindiğinde arka plan sesini kapat (YouTube iFrame videoyu açar)
        clearResetTimer();
        webAudioService.stopCurrentAudio();
        setIsPlaying(false);
        setPlaybackSeconds(0);
        setPlaybackRatio(0);
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
      options,
      advanceAttempt,
      clearResetTimer,
    ]
  );

  // Komponent unmount olduğunda sesi durdur ve zamanlayıcıları temizle
  useEffect(() => {
    return () => {
      clearResetTimer();
      webAudioService.stopCurrentAudio();
    };
  }, [clearResetTimer]);

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
    potentialPoints,
    lastEarnedPoints,
    roundCountdownSeconds,
    guessTimeLimitMinutes,
    selectedCustomArtist,
    isGuessLocked,
    isSongRevealed,
    startNewGame,
    togglePlay,
    advanceAttempt,
    submitGuess,
    goToNextSong,
  };
}
