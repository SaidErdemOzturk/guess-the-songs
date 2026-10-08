import { useCallback, useEffect, useRef, useState } from 'react';
import { ATTEMPT_DURATIONS, STAGES } from '@/constants/game';
import { calculatePointsByDuration, gameService } from '@/services/api/gameService';
import { authService } from '@/services/api/authService';
import { roomService, parseServerDateMs, isSameSong } from '@/services/api/roomService';
import { songService } from '@/services/api/songService';
import { youtubeService } from '@/services/api/youtubeService';
import { webAudioService } from '@/services/audio/webAudioService';
import { youtubePlayerService } from '@/services/audio/youtubePlayerService';
import type { CreateGameSessionRequest, GameMode, GameStage, GuessRequest, Song } from '@/types';
import type { Room } from '@/types/room';

export interface FeedbackState {
  isSuccess: boolean;
  message: string;
}

export interface UseGameRoundOptions {
  roomCode?: string | null;
  userId?: string | null;
  guessTimeLimitMinutes?: number;
  room?: Room | null;
  isHost?: boolean;
  onScoreUpdate?: (points: number, duration: number, totalScore: number) => void;
}

export function useGameRound(options?: UseGameRoundOptions) {
  const roomCode = options?.roomCode;
  const sessionUser = authService.getSession().user;
  const userId =
    options?.userId ||
    sessionUser?.id ||
    (options?.room?.participants && sessionUser?.email
      ? options.room.participants.find((p) => p.user.email === sessionUser.email)?.user.id
      : undefined);
  const guessTimeLimitMinutesOption = options?.guessTimeLimitMinutes;
  const roomOption = options?.room;
  const isHostOption = options?.isHost;
  const onScoreUpdate = options?.onScoreUpdate;

  const isHost = Boolean(
    !roomCode ||
    isHostOption ||
    (roomOption &&
      userId &&
      (String(roomOption.hostId) === String(userId) ||
        roomOption.participants?.find((p) => String(p.user.id) === String(userId))?.isHost))
  );

  const onScoreUpdateRef = useRef(onScoreUpdate);
  useEffect(() => {
    onScoreUpdateRef.current = onScoreUpdate;
  }, [onScoreUpdate]);

  const [currentRegion, setCurrentRegion] = useState<'tr' | 'global'>('tr');
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [currentAttemptIndex, setCurrentAttemptIndex] = useState(0);
  const [songsPool, setSongsPool] = useState<Song[]>([]);
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const currentSongRef = useRef<Song | null>(null);
  useEffect(() => {
    currentSongRef.current = currentSong;
  }, [currentSong]);

  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSeconds, setPlaybackSeconds] = useState(0);
  const [playbackRatio, setPlaybackRatio] = useState(0);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [isGameOver, setIsGameOver] = useState(false);
  const [selectedCustomArtist, setSelectedCustomArtist] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [lastEarnedPoints, setLastEarnedPoints] = useState<number | null>(null);
  const isRoomMode = Boolean(roomCode);
  const [guessTimeLimitMinutes, setGuessTimeLimitMinutes] = useState<number | undefined>(
    isRoomMode ? (guessTimeLimitMinutesOption || 1) : undefined
  );
  const [roundCountdownSeconds, setRoundCountdownSeconds] = useState<number | undefined>(
    isRoomMode ? ((guessTimeLimitMinutesOption || 1) * 60) : undefined
  );
  const [isGuessLocked, setIsGuessLocked] = useState(false);
  const [isLoadingSong, setIsLoadingSong] = useState(true);

  const [gameMode, setGameMode] = useState<GameMode>('short');
  const gameModeRef = useRef<GameMode>('short');
  useEffect(() => {
    gameModeRef.current = gameMode;
  }, [gameMode]);

  const [gameStages, setGameStages] = useState<GameStage[]>(STAGES);
  const usedSongIdsRef = useRef<Set<string | number>>(new Set());
  const customPlaylistSongsRef = useRef<Song[]>([]);
  const lastGuessedRoundRef = useRef<number | null>(null);
  const lastGuessedSongIdRef = useRef<string | number | null>(null);

  const isHandlingErrorRef = useRef(false);
  const consecutiveErrorCountRef = useRef(0);

  const resetTimerRef = useRef<number | null>(null);

  const clearResetTimer = useCallback(() => {
    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
  }, []);

  const currentStage: GameStage = gameStages[currentStageIndex] || gameStages[0] || STAGES[0];
  const activeDuration: number = isGuessLocked ? 8.0 : (ATTEMPT_DURATIONS[currentAttemptIndex] || 0.5);
  const isSongRevealed = isGuessLocked || (feedback !== null && feedback.message.includes('Doğru parça:'));

  const potentialPoints = calculatePointsByDuration(
    activeDuration,
    currentSong?.difficultyRank || 1
  );

  // Oda ayarlarından gelen süre sınırı güncellenirse senkronize et (Sadece oda modunda)
  useEffect(() => {
    if (!roomCode) {
      setGuessTimeLimitMinutes(undefined);
      setRoundCountdownSeconds(undefined);
      return;
    }

    if (guessTimeLimitMinutesOption && guessTimeLimitMinutesOption !== guessTimeLimitMinutes) {
      setGuessTimeLimitMinutes(guessTimeLimitMinutesOption);
    }
  }, [roomCode, guessTimeLimitMinutesOption, guessTimeLimitMinutes]);


  // Sıradaki veya yedek şarkıyı seçen ortak fonksiyon
  const pickNextSong = useCallback(
    async (stageIdx: number, excludeId?: string | number, explicitMode?: GameMode): Promise<Song | null> => {
      const activeMode = explicitMode || gameModeRef.current || gameMode;
      const customList = customPlaylistSongsRef.current;
      const excludeList = Array.from(usedSongIdsRef.current);
      if (excludeId) excludeList.push(excludeId);

      if (customList.length > 0) {
        // Özel playlist varsa BU playlist içerisinden şarkı gelsin
        const excludeSet = new Set(excludeList.map(String));
        const recentlyPlayedIds = songService.getRecentlyPlayedIds();

        // 1. Kademe: Hem bu oyunda çalınmamış hem de son oyunlarda çalınmamış olanlar
        let available = customList.filter((s) => {
          if (excludeSet.has(String(s.id))) return false;
          if (s.youtubeId && excludeSet.has(String(s.youtubeId))) return false;
          if (recentlyPlayedIds.has(String(s.id))) return false;
          if (s.youtubeId && recentlyPlayedIds.has(String(s.youtubeId))) return false;
          if (youtubePlayerService.isVideoUnplayable(s.youtubeId)) return false;
          return true;
        });

        // 2. Kademe: Eğer liste bittiyse sadece bu oyunda çalınmamış olanlar
        if (available.length === 0) {
          available = customList.filter((s) => {
            if (excludeSet.has(String(s.id))) return false;
            if (s.youtubeId && excludeSet.has(String(s.youtubeId))) return false;
            if (youtubePlayerService.isVideoUnplayable(s.youtubeId)) return false;
            return true;
          });
        }

        if (available.length > 0) {
          const randomIndex = Math.floor(Math.random() * available.length);
          const chosen = available[randomIndex];
          songService.markSongAsPlayed(chosen.id, chosen.youtubeId);
          return chosen;
        }

        // Tüm şarkılar kullanıldıysa en azından unplayable olmayan herhangi birini seç
        const playable = customList.filter(
          (s) =>
            (!excludeId || (s.id !== excludeId && s.youtubeId !== excludeId)) &&
            !youtubePlayerService.isVideoUnplayable(s.youtubeId)
        );
        if (playable.length > 0) {
          const chosen = playable[Math.floor(Math.random() * playable.length)];
          songService.markSongAsPlayed(chosen.id, chosen.youtubeId);
          return chosen;
        }
        return customList[0] || null;
      }

      // Özel playlist yoksa aktif olan varsayılan playlistten devam etsin
      if (activeMode === 'long') {
        return await songService.getRandomSongFromCombinedPool(currentRegion, excludeList);
      }

      // Kısa mod (Kolay -> Orta -> Zor): Aşama bazlı seçim yaparken de bu oyundaki ve önceki oyunlardaki şarkıları ele
      return await songService.getRandomSongForStage(currentRegion, stageIdx, excludeList);
    },
    [currentRegion, gameMode]
  );

  // Oda durumu değiştiğinde katılımcının tahmin durumunu, yetkili süresini ve oyun modunu senkronize et
  useEffect(() => {
    if (!roomCode || !roomOption) return;

    if (roomOption.settings) {
      const mode = roomOption.settings.gameMode || 'short';
      setGameMode(mode);
      if (mode === 'long') {
        const count = roomOption.settings.songCount || 10;
        setGameStages(
          Array.from({ length: count }, (_, i) => ({
            stage: i + 1,
            name: `Şarkı ${i + 1}`,
            duration: 0.5,
            skipAdd: '+1.5s',
            widthPercent: `${Math.round(100 / count)}%`,
          }))
        );
      } else {
        setGameStages(STAGES);
      }

      // Misafir oyuncu girdiğinde özel playlist şarkılarını arama havuzuna dahil etmek için yükle
      const customPlaylistId = roomOption.settings.playlistId;
      if (customPlaylistId && customPlaylistSongsRef.current.length === 0) {
        youtubeService
          .getPlaylistSongs(customPlaylistId, {
            limit: 100,
            region: roomOption.settings.region || 'tr',
          })
          .then((customSongs) => {
            if (customSongs.length > 0) {
              customPlaylistSongsRef.current = customSongs;
              songService.registerCustomPlaylistSongs(customSongs);
            }
          })
          .catch((err) => {
            console.warn('[GameRound] Özel playlist ön yükleme hatası:', err);
          });
      }
    }

    if (roomOption.currentRound && roomOption.currentRound > 1) {
      setCurrentStageIndex(Math.max(0, roomOption.currentRound - 1));
    }

    // Ortak şarkı odaya eklendiğinde veya değiştiğinde katılımcının şarkısını anında senkronize et
    if (roomOption.currentSong) {
      const incoming = roomOption.currentSong;
      const current = currentSongRef.current;
      if (!current || !isSameSong(current, incoming)) {
        clearResetTimer();
        webAudioService.stopCurrentAudio();
        setIsPlaying(false);
        setPlaybackSeconds(0);
        setPlaybackRatio(0);
        setIsGuessLocked(false);
        setFeedback(null);
        setLastEarnedPoints(null);
        lastGuessedSongIdRef.current = null;
        lastGuessedRoundRef.current = null;
        usedSongIdsRef.current.add(incoming.id);
        if (incoming.youtubeId) usedSongIdsRef.current.add(incoming.youtubeId);
        songService.markSongAsPlayed(incoming.id, incoming.youtubeId);
        currentSongRef.current = incoming;
        setCurrentSong(incoming);
        setSongsPool([incoming]);
        setIsLoadingSong(false);
        void webAudioService.preloadSong(incoming);
      }
    } else if (isHost && !currentSongRef.current && roomOption.status === 'in_game' && !isGameOver) {
      // Fail-safe: Oda sahibi oyunda ama şarkı henüz belirlenmemişse otomatik seçip odaya ayarla
      pickNextSong(currentStageIndex).then((song) => {
        if (song && !currentSongRef.current) {
          usedSongIdsRef.current.add(song.id);
          if (song.youtubeId) usedSongIdsRef.current.add(song.youtubeId);
          songService.markSongAsPlayed(song.id, song.youtubeId);
          currentSongRef.current = song;
          setCurrentSong(song);
          setSongsPool([song]);
          setIsLoadingSong(false);
          if (roomCode) {
            void roomService.setCurrentSong(roomCode, song, currentStageIndex + 1);
          }
          void webAudioService.preloadSong(song);
        }
      });
    }

    // Yetkili saat bazlı kalan süre hesaplama
    if (roomOption.currentRoundStartedAt && roomOption.status === 'in_game') {
      const remaining = roomService.getRemainingRoundSeconds(roomOption);
      setRoundCountdownSeconds(remaining);
    }

    // Kullanıcı bu raund için zaten tahmin yapmışsa (sayfa yenilense dahi) girişi kilitle
    if (userId && roomOption.participants) {
      const currentActiveRound = roomOption.currentRound || (currentStageIndex + 1);
      const participant = roomOption.participants.find((p) => String(p.user.id) === String(userId));
      if (participant) {
        if (participant.score !== undefined && participant.score > 0) {
          setScore((prev) => Math.max(prev, participant.score));
        }

        // YALNIZCA bu kullanıcı bu spesifik raund ve şarkı için tahmin yapmışsa girişi kilitle!
        const hasGuessedCurrent =
          (participant.lastPointsEarned !== null && participant.lastPointsEarned !== undefined) ||
          (participant.lastGuessedRound !== undefined && participant.lastGuessedRound === currentActiveRound) ||
          (currentSong && participant.lastGuessedSongId !== undefined && String(participant.lastGuessedSongId) === String(currentSong.id)) ||
          (lastGuessedRoundRef.current === currentActiveRound) ||
          (currentSong && String(lastGuessedSongIdRef.current) === String(currentSong.id));

        if (hasGuessedCurrent && participant.lastPointsEarned !== null && participant.lastPointsEarned !== undefined) {
          setIsGuessLocked(true);
          setLastEarnedPoints(participant.lastPointsEarned);
          setFeedback((prev) => {
            if (prev) return prev;
            return {
              isSuccess: participant.lastPointsEarned! > 0,
              message: participant.lastPointsEarned! > 0
                ? `Tebrikler! ${participant.lastPointsEarned} puan kazandın!`
                : `Bu şarkı için tahmin hakkını kullandın.`,
            };
          });
        }
      }
    }
  }, [roomOption, roomCode, userId, isHost, isGameOver, currentStageIndex, pickNextSong]);


  // Yeni oyun başlatma
  const startNewGame = useCallback(async (params: CreateGameSessionRequest) => {
    webAudioService.stopCurrentAudio();
    setIsPlaying(false);
    setPlaybackSeconds(0);
    setPlaybackRatio(0);
    setFeedback(null);
    setIsGameOver(false);
    setIsGuessLocked(false);
    setIsLoadingSong(true);
    setCurrentAttemptIndex(0);
    setScore(0);
    setLastEarnedPoints(null);

    const chosenRegion = params.region === 'global' ? 'global' : 'tr';
    setCurrentRegion(chosenRegion);

    usedSongIdsRef.current.clear();

    try {
      let roomObj: Room | null = roomOption || null;
      if (!roomObj && roomCode) {
        const cleanCode = roomCode.toUpperCase().trim();
        const stored = roomService.getStoredRooms()[cleanCode];
        if (stored) {
          roomObj = stored;
        } else {
          roomObj = await roomService.getRoomByCode(roomCode);
        }
      }

      const mode = roomObj?.settings?.gameMode || params.gameMode || 'short';
      setGameMode(mode);

      const maxCustomSongs = params.customSongs?.length;
      let targetSongCount = 3;
      if (mode === 'long') {
        targetSongCount = roomObj?.settings?.songCount || params.songCount || 10;
        if (maxCustomSongs && maxCustomSongs > 0) {
          targetSongCount = Math.min(targetSongCount, maxCustomSongs);
        }
      } else {
        if (maxCustomSongs && maxCustomSongs > 0 && maxCustomSongs < 3) {
          targetSongCount = maxCustomSongs;
        }
      }

      let activeStages: GameStage[] = STAGES;
      if (mode === 'long' || (maxCustomSongs && maxCustomSongs < 3)) {
        activeStages = Array.from({ length: targetSongCount }, (_, i) => ({
          stage: i + 1,
          name: `Şarkı ${i + 1}`,
          duration: 0.5,
          skipAdd: '+1.5s',
          widthPercent: `${Math.round(100 / targetSongCount)}%`,
        }));
      }
      setGameStages(activeStages);

      if (roomCode) {
        const timeLimit = params.guessTimeLimitMinutes || guessTimeLimitMinutesOption || roomObj?.guessTimeLimitMinutes || 1;
        setGuessTimeLimitMinutes(timeLimit);
        const remaining = roomService.getRemainingRoundSeconds(roomObj);
        setRoundCountdownSeconds(remaining > 0 ? remaining : timeLimit * 60);
      } else {
        setGuessTimeLimitMinutes(undefined);
        setRoundCountdownSeconds(undefined);
      }

      setSelectedCustomArtist(params.artist || null);

      if (roomObj?.currentRound && roomObj.currentRound > 0) {
        setCurrentStageIndex(Math.max(0, roomObj.currentRound - 1));
      } else {
        setCurrentStageIndex(0);
      }

      // 1. Sabit listemizin içeriği mutlaka yüklensin (Şarkı tahmini listesinde sabit liste her zaman bulunur)
      await songService.initializeGamePlaylists(chosenRegion);

      // 2. Özel playlist / şarkılar eklendiyse bu listeyi havuzlara dahil et ve aktif çalma listesi yap
      if (params.customSongs && params.customSongs.length > 0) {
        console.log(`🎶 [GameRound] Özel şarkı listesi aktarılıyor: ${params.customSongs.length} şarkı`);
        customPlaylistSongsRef.current = params.customSongs;
        songService.registerCustomPlaylistSongs(params.customSongs);
      } else {
        const customPlaylistId = roomObj?.settings?.playlistId || params.playlistId;
        if (customPlaylistId) {
          console.log(`🎶 [GameRound] Özel çalma listesi yükleniyor: ${customPlaylistId}`);
          try {
            const customSongs = await youtubeService.getPlaylistSongs(customPlaylistId, {
              limit: 100,
              region: chosenRegion,
            });

            if (customSongs.length > 0) {
              customPlaylistSongsRef.current = customSongs;
              songService.registerCustomPlaylistSongs(customSongs);
            } else {
              customPlaylistSongsRef.current = [];
            }
          } catch (err) {
            console.warn('⚠️ [GameRound] Özel playlist yüklenemedi:', err);
            customPlaylistSongsRef.current = [];
          }
        } else {
          customPlaylistSongsRef.current = [];
        }
      }

      // 3. İlk şarkıyı seç
      let initialSong: Song | null = null;
      if (roomObj?.currentSong && !youtubePlayerService.isVideoUnplayable(roomObj.currentSong.youtubeId)) {
        initialSong = roomObj.currentSong;
      }

      const sessionUser = authService.getSession().user;
      const effectiveUserId = userId || sessionUser?.id;

      const amIHost = Boolean(
        !roomCode ||
        isHostOption ||
        (roomObj && effectiveUserId && (
          String(roomObj.hostId) === String(effectiveUserId) ||
          roomObj.participants?.some((p) => String(p.user.id) === String(effectiveUserId) && p.isHost)
        )) ||
        (roomOption && effectiveUserId && (
          String(roomOption.hostId) === String(effectiveUserId) ||
          roomOption.participants?.some((p) => String(p.user.id) === String(effectiveUserId) && p.isHost)
        ))
      );

      // SADECE oda sahibi veya tek kişilik mod şarkı belirleyip setCurrentSong çağırabilir!
      // Oda sahibi yeni oyun başlattığında önceki oyunun eski şarkısını kullanmaz, her zaman sıfırdan yeni şarkı seçer
      if (!initialSong || amIHost) {
        if (!roomCode || amIHost) {
          initialSong = await pickNextSong(0, undefined, mode);
        }
      }

      if (roomCode && amIHost && initialSong) {
        currentSongRef.current = initialSong;
        const updated = await roomService.setCurrentSong(roomCode, initialSong, 1);
        if (updated) {
          const rem = roomService.getRemainingRoundSeconds(updated);
          const limit = params.guessTimeLimitMinutes || guessTimeLimitMinutesOption || updated.guessTimeLimitMinutes || 1;
          setRoundCountdownSeconds(rem > 0 ? rem : limit * 60);
        }
      }

      if (initialSong) {
        usedSongIdsRef.current.add(initialSong.id);
        if (initialSong.youtubeId) usedSongIdsRef.current.add(initialSong.youtubeId);
        songService.markSongAsPlayed(initialSong.id, initialSong.youtubeId);
        currentSongRef.current = initialSong;
        setSongsPool([initialSong]);
        setCurrentSong(initialSong);
        consecutiveErrorCountRef.current = 0;
        setIsLoadingSong(false);
      } else {
        setIsLoadingSong(true);
      }

      if (roomObj && userId) {
        const participant = roomObj.participants.find((p) => String(p.user.id) === String(userId));
        if (participant) {
          if (participant.score !== undefined && participant.score > 0) {
            setScore(participant.score);
          }
          const isGuessedThisRound =
            (participant.lastPointsEarned !== null && participant.lastPointsEarned !== undefined) ||
            (participant.lastGuessedRound !== undefined && participant.lastGuessedRound === (roomObj.currentRound || 1)) ||
            (initialSong && participant.lastGuessedSongId !== undefined && String(participant.lastGuessedSongId) === String(initialSong.id));

          if (isGuessedThisRound && participant.lastPointsEarned !== null && participant.lastPointsEarned !== undefined) {
            setIsGuessLocked(true);
            setLastEarnedPoints(participant.lastPointsEarned);
            setFeedback({
              isSuccess: participant.lastPointsEarned > 0,
              message: participant.lastPointsEarned > 0
                ? (initialSong ? `Tebrikler! ${participant.lastPointsEarned} puan kazandın! Doğru parça: ${initialSong.artist} - ${initialSong.title}` : `Tebrikler! ${participant.lastPointsEarned} puan kazandın!`)
                : (initialSong ? `Bu şarkı için tahmin hakkını kullandın. Doğru parça: ${initialSong.artist} - ${initialSong.title}` : `Bu şarkı için tahmin hakkını kullandın.`),
            });
          }
        }
      }

      await gameService.createSession(params);
      setIsLoadingSong(false);
      if (initialSong) {
        void webAudioService.preloadSong(initialSong);
      }
    } catch (err) {
      console.error('⚠️ [GameRound] Oyun başlatma hatası:', err);
    } finally {
      setIsLoadingSong(false);
    }
  }, [roomCode, guessTimeLimitMinutesOption, userId, isHost, pickNextSong]);


  // Ses klibi çalma / durdurma (anlık saniye imleci takipli)
  const togglePlay = useCallback(() => {
    if (!currentSong) return;

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
      lastGuessedRoundRef.current = currentStageIndex + 1;
      lastGuessedSongIdRef.current = currentSong.id;
      onScoreUpdateRef.current?.(0, activeDuration, score);

      const targetUserId = userId || authService.getSession().user?.id;
      if (roomCode && targetUserId) {
        roomService.updateParticipantScore(
          roomCode,
          targetUserId,
          0,
          activeDuration,
          currentStageIndex + 1,
          currentSong.id
        );
      }

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
    [isGuessLocked, currentSong, clearResetTimer, activeDuration, roomCode, userId, score, currentStageIndex]
  );

  // Şarkıyı bilme süresi yetkili geri sayımı (YALNIZCA ODA İÇERİSİNDEYSE çalışır)
  useEffect(() => {
    if (!roomCode || isGameOver) {
      return;
    }

    const checkTimer = () => {
      // Şarkı henüz hazır değilse, çalacak şarkı yoksa veya tahmin zaten kilitlenmişse süre bitimi tetikleme!
      if (!currentSong || isLoadingSong || isGuessLocked) {
        return;
      }

      const activeRoom = roomOption;
      if (activeRoom && activeRoom.currentRoundStartedAt && activeRoom.status === 'in_game') {
        const remaining = roomService.getRemainingRoundSeconds(activeRoom);
        setRoundCountdownSeconds(remaining);
        if (remaining <= 0) {
          handleGiveUp(true);
        }
      } else {
        setRoundCountdownSeconds((prev) => {
          if (prev === undefined) return undefined;
          if (prev <= 1) {
            handleGiveUp(true);
            return 0;
          }
          return prev - 1;
        });
      }
    };

    const intervalId = window.setInterval(checkTimer, 1000);

    return () => clearInterval(intervalId);
  }, [roomCode, isGameOver, isGuessLocked, isLoadingSong, currentSong, handleGiveUp, roomOption]);

  // Oda modunda senkronize ortak şarkıyı WebSocket üzerinden dinle
  useEffect(() => {
    if (!roomCode) return;

    const unsubscribe = roomService.onSongChanged(roomCode, async (syncSong, round, endsAt) => {
      const current = currentSongRef.current;
      if (current && isSameSong(current, syncSong)) {
        // Zaten bu şarkı ayarlanmış, mükerrer istek atmayı engelle
        return;
      }

      clearResetTimer();
      webAudioService.stopCurrentAudio();
      setIsPlaying(false);
      setPlaybackSeconds(0);
      setPlaybackRatio(0);
      setIsGuessLocked(false);
      setFeedback(null);
      setLastEarnedPoints(null);
      lastGuessedSongIdRef.current = null;
      lastGuessedRoundRef.current = null;
      consecutiveErrorCountRef.current = 0;
      usedSongIdsRef.current.add(syncSong.id);
      if (syncSong.youtubeId) usedSongIdsRef.current.add(syncSong.youtubeId);
      songService.markSongAsPlayed(syncSong.id, syncSong.youtubeId);
      setCurrentSong(syncSong);
      currentSongRef.current = syncSong;
      setCurrentStageIndex(Math.max(0, round - 1));
      setCurrentAttemptIndex(0);

      // Her şarkı değiştiğinde süre odayı oluştururken seçilen dakikaya göre yeniden başlar
      const limitSec = (guessTimeLimitMinutes || guessTimeLimitMinutesOption || 1) * 60;
      if (endsAt) {
        const endsAtMs = parseServerDateMs(endsAt);
        if (endsAtMs !== null) {
          const rem = Math.ceil((endsAtMs - Date.now()) / 1000);
          setRoundCountdownSeconds(rem > 0 ? rem : limitSec);
        } else {
          setRoundCountdownSeconds(limitSec);
        }
      } else {
        setRoundCountdownSeconds(limitSec);
      }

      setIsLoadingSong(false);
      void webAudioService.preloadSong(syncSong);
    });

    return () => {
      unsubscribe();
    };
  }, [roomCode, clearResetTimer, guessTimeLimitMinutes, guessTimeLimitMinutesOption]);

  // YouTube oynatma hatası (101/150 embed engeli veya 100 video silinmesi) durumunda
  // sessizlikte kalmamak için otomatik olarak sıradaki oynatılabilir şarkıya geçer
  useEffect(() => {
    const unsubscribe = webAudioService.onPlaybackError(async (failedVideoId, errorCode) => {
      // 1. Zaten bir hata işleniyorsa, oyun bittiyse veya şarkı çözüldüyse tetikleme
      if (isHandlingErrorRef.current || isGameOver || isSongRevealed) return;

      // 2. Bir odadaysak ve oda sahibi DEĞİLSEK asla tüm odanın şarkısını değiştirmeye kalkışma
      if (roomCode && !isHost) {
        console.warn(`[GameRound] Katılımcı oynatma hatası aldı (Video: ${failedVideoId}, Kod: ${errorCode}). Şarkı değişimi oda sahibine aittir.`);
        return;
      }

      // 3. Mevcut şarkı ile eşleşmiyorsa tetikleme
      const current = currentSongRef.current;
      if (!current) return;
      if (failedVideoId && current.youtubeId && current.youtubeId !== failedVideoId) return;

      // 4. Circuit Breaker: Üst üste 3 kez hata alındıysa döngüyü kır!
      if (consecutiveErrorCountRef.current >= 3) {
        console.warn(`🚨 [GameRound] Üst üste ${consecutiveErrorCountRef.current} kez video hatası alındı. Otomatik geçiş durduruldu.`);
        setFeedback({
          isSuccess: false,
          message: 'Bu parça YouTube üzerinden oynatılamadı. Lütfen "Şarkıyı Geç" butonu ile devam edin.',
        });
        setIsLoadingSong(false);
        return;
      }

      isHandlingErrorRef.current = true;
      consecutiveErrorCountRef.current += 1;

      console.warn(
        `🚨 [GameRound] "${current.artist} - ${current.title}" (ID: ${failedVideoId}) telif/embed engeline takıldı (Hata: ${errorCode}, Deneme: ${consecutiveErrorCountRef.current}). ` +
        `Alternatif şarkı aranıyor...`
      );

      clearResetTimer();
      webAudioService.stopCurrentAudio();
      setIsPlaying(false);
      setPlaybackSeconds(0);
      setPlaybackRatio(0);
      setIsLoadingSong(true);

      // Oynatıcı olaylarının oturması için kısa bekleme (rapid loop önleme)
      await new Promise((r) => setTimeout(r, 600));

      try {
        const replacementSong = await pickNextSong(
          currentStageIndex,
          current.youtubeId || current.id
        );

        if (replacementSong && (replacementSong.youtubeId !== current.youtubeId || replacementSong.title !== current.title)) {
          console.log(`✨ [GameRound] Yeni parça yüklendi: "${replacementSong.artist} - ${replacementSong.title}"`);
          usedSongIdsRef.current.add(replacementSong.id);
          if (replacementSong.youtubeId) usedSongIdsRef.current.add(replacementSong.youtubeId);
          songService.markSongAsPlayed(replacementSong.id, replacementSong.youtubeId);
          currentSongRef.current = replacementSong;
          setCurrentSong(replacementSong);
          setSongsPool([replacementSong]);

          if (roomCode) {
            await roomService.setCurrentSong(roomCode, replacementSong, currentStageIndex + 1);
          } else {
            await webAudioService.preloadSong(replacementSong);
          }
        }
      } catch (err) {
        console.error('Alternatif şarkı yüklenirken hata oluştu:', err);
      } finally {
        setIsLoadingSong(false);
        isHandlingErrorRef.current = false;
      }
    });

    return () => {
      unsubscribe();
    };
  }, [isGameOver, isSongRevealed, currentStageIndex, pickNextSong, roomCode, isHost, clearResetTimer]);

  // Sıradaki şarkıya geçme fonksiyonu (Kullanıcı dilediği an butona basarak geçer)
  const goToNextSong = useCallback(async () => {
    clearResetTimer();
    webAudioService.stopCurrentAudio();
    setIsPlaying(false);
    setPlaybackSeconds(0);
    setPlaybackRatio(0);
    setIsGuessLocked(false);
    setLastEarnedPoints(null);
    setFeedback(null);
    lastGuessedSongIdRef.current = null;
    lastGuessedRoundRef.current = null;
    const limitMinutes = guessTimeLimitMinutes || guessTimeLimitMinutesOption || 1;
    if (roomCode) {
      setRoundCountdownSeconds(limitMinutes * 60);
    } else {
      setRoundCountdownSeconds(undefined);
    }

    if (currentStageIndex < gameStages.length - 1) {
      const nextStage = currentStageIndex + 1;
      setIsLoadingSong(true);
      try {
        const nextSong = await pickNextSong(nextStage, currentSong?.id);

        if (nextSong) {
          usedSongIdsRef.current.add(nextSong.id);
          if (nextSong.youtubeId) usedSongIdsRef.current.add(nextSong.youtubeId);
          songService.markSongAsPlayed(nextSong.id, nextSong.youtubeId);
          currentSongRef.current = nextSong;
          setCurrentSong(nextSong);
          setCurrentStageIndex(nextStage);
          setCurrentAttemptIndex(0);
          setIsGuessLocked(false);
          setFeedback(null);
          setLastEarnedPoints(null);
          lastGuessedSongIdRef.current = null;
          lastGuessedRoundRef.current = null;

          if (roomCode) {
            // Şarkı değiştiğinde backend tarafına son saniye tekrardan setlenir
            const updated = await roomService.setCurrentSong(roomCode, nextSong, nextStage + 1);
            if (updated) {
              const rem = roomService.getRemainingRoundSeconds(updated);
              setRoundCountdownSeconds(rem > 0 ? rem : limitMinutes * 60);
            }
          }
          await webAudioService.preloadSong(nextSong);
        }
      } catch (err) {
        console.warn('⚠️ [GameRound] Sonraki şarkı yükleme hatası:', err);
      } finally {
        setIsLoadingSong(false);
        setIsGuessLocked(false);
        setFeedback(null);
        setLastEarnedPoints(null);
        lastGuessedSongIdRef.current = null;
        lastGuessedRoundRef.current = null;
      }
    } else {
      setIsGameOver(true);
      setFeedback({
        isSuccess: true,
        message: `Mükemmel! ${gameStages.length} şarkıyı da başarıyla tamamladın!`,
      });
      if (roomCode) {
        await roomService.changeRoomStatus(roomCode, 'finished');
      }
    }
  }, [clearResetTimer, currentStageIndex, currentSong?.id, gameStages.length, guessTimeLimitMinutes, guessTimeLimitMinutesOption, pickNextSong, roomCode]);

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
        userId: userId || undefined,
        roomCode: roomCode || undefined,
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
        lastGuessedRoundRef.current = currentStageIndex + 1;
        lastGuessedSongIdRef.current = currentSong.id;
        setScore((prev) => {
          const nextScore = prev + earned;
          onScoreUpdateRef.current?.(earned, activeDuration, nextScore);
          return nextScore;
        });

        // Oda aktifse oda katılımcısının skorunu da güncelle
        const targetUserId = userId || authService.getSession().user?.id;
        if (roomCode && targetUserId) {
          roomService.updateParticipantScore(
            roomCode,
            targetUserId,
            earned,
            activeDuration,
            currentStageIndex + 1,
            currentSong.id
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
      roomCode,
      userId,
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
    stages: gameStages,
    totalStages: gameStages.length,
    gameMode,
    startNewGame,
    togglePlay,
    advanceAttempt,
    submitGuess,
    goToNextSong,
  };
}
