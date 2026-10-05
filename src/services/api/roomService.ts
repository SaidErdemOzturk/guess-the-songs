import { apiClient } from './client';
import { ENDPOINTS } from './endpoints';
import { env } from '@/config/env';
import { storage } from '@/utils/storage';
import { authService } from './authService';
import type { User } from '@/types/auth';
import type { CreateRoomRequest, Room, RoomParticipant, RoomSettings, RoomStatus } from '@/types/room';
import type { Song } from '@/types/song';

const ROOMS_STORAGE_KEY = 'gts_active_rooms';

export interface RoomWebSocketMessage<T = unknown> {
  type:
  | 'ROOM_STATE'
  | 'ROOM_UPDATED'
  | 'SCORE_UPDATED'
  | 'PARTICIPANT_JOINED'
  | 'PARTICIPANT_LEFT'
  | 'PARTICIPANT_KICKED'
  | 'STATUS_CHANGED'
  | 'SONG_CHANGED'
  | 'PONG';
  roomCode?: string;
  data?: T;
  timestamp?: string;
}

type RoomSubscriptionCallback = (room: Room) => void;
export type SongChangeCallback = (song: Song, round: number, endsAt?: string) => void;
type ParticipantKickedCallback = (targetUserId: string, updatedRoom?: Room | null) => void;

/**
 * Sunucudan gelen ISO veya UTC tarih stringlerini (+03:00 / UTC farklarını gözeterek)
 * milisaniye cinsinden doğru bir şekilde ayrıştırır.
 */
export function parseServerDateMs(dateStr: string | null | undefined): number | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const trimmed = dateStr.trim();
  if (!trimmed) return null;

  // Zaten Z veya saat dilimi ofseti (+HH:mm veya -HH:mm) içeriyorsa
  if (/Z|[+-]\d{2}:\d{2}$/i.test(trimmed)) {
    const ms = new Date(trimmed).getTime();
    return isNaN(ms) ? null : ms;
  }

  // .NET DateTime standart JSON çıktısı (Z olmadan UTC tarihi "2026-10-05T07:45:00")
  const withZ = trimmed.replace(' ', 'T') + 'Z';
  const msWithZ = new Date(withZ).getTime();
  if (!isNaN(msWithZ)) {
    const now = Date.now();
    const msLocal = new Date(trimmed).getTime();
    if (!isNaN(msLocal)) {
      if (Math.abs(msWithZ - now) < Math.abs(msLocal - now)) {
        return msWithZ;
      }
    }
    return msWithZ;
  }

  const ms = new Date(trimmed).getTime();
  return isNaN(ms) ? null : ms;
}

/**
 * Backend DataResult veya doğrudan data yanıtlarını normalize eden yardımcı
 */
function unwrapData<T>(response: unknown): T {
  if (response && typeof response === 'object' && 'data' in (response as Record<string, unknown>)) {
    return (response as { data: T }).data;
  }
  return response as T;
}

/**
 * Şarkı nesnesini frontend standart modeline normalize eder (PascalCase / camelCase / JSON string / tip uyumluluğu).
 * Backend (.NET API) veya WebSocket üzerinden gelebilecek farklı isimlendirmeleri (Title, Artist, YoutubeId vb.)
 * ve tipleri standart Song arayüzüne dönüştürür.
 */
export function normalizeSong(raw: any): Song | null {
  if (!raw) return null;

  // Backend veya depolamadan string olarak serialize edilmişse parse et
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      return null;
    }
  }

  if (typeof raw !== 'object' || raw === null) return null;

  const id = raw.id ?? raw.Id ?? raw.songId ?? raw.SongId;
  const youtubeId = raw.youtubeId ?? raw.YoutubeId ?? raw.youtube_id;
  const title = raw.title ?? raw.Title;
  const artist = raw.artist ?? raw.Artist;

  // Şarkıyı tanımlayacak temel bilgiler yoksa geçerli sayılmaz
  if (!id && !youtubeId && !title) return null;

  return {
    ...raw,
    id: id !== undefined && id !== null ? (typeof id === 'number' ? id : String(id)) : String(youtubeId || ''),
    title: String(title || ''),
    artist: String(artist || ''),
    youtubeId: youtubeId ? String(youtubeId) : (raw.youtubeId || ''),
    year: Number(raw.year ?? raw.Year ?? raw.releaseYear ?? raw.ReleaseYear ?? 2024),
    genre: raw.genre || raw.Genre || 'pop',
    region: raw.region || raw.Region || 'tr',
    difficulty: raw.difficulty || raw.Difficulty || 'easy',
    difficultyRank: Number(raw.difficultyRank ?? raw.DifficultyRank ?? 1),
    startSecond: Number(raw.startSecond ?? raw.StartSecond ?? 0),
    duration: Number(raw.duration ?? raw.Duration ?? 30),
    coverUrl:
      raw.coverUrl ||
      raw.CoverUrl ||
      raw.albumCoverUrl ||
      raw.AlbumCoverUrl ||
      (youtubeId ? `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg` : undefined),
    previewUrl: raw.previewUrl || raw.PreviewUrl || undefined,
    album: raw.album || raw.Album || undefined,
    spotifyId: raw.spotifyId || raw.SpotifyId || undefined,
  };
}

/**
 * İki şarkının aynı parça olup olmadığını güvenle karşılaştırır
 */
export function isSameSong(a: Song | null | undefined, b: Song | null | undefined): boolean {
  if (!a || !b) return false;
  if (a.id !== undefined && b.id !== undefined && String(a.id) === String(b.id)) return true;
  const aYt = String(a.youtubeId || '').trim();
  const bYt = String(b.youtubeId || '').trim();
  if (aYt && bYt && aYt === bYt) return true;
  return false;
}

/**
 * Backend RoomDetailDto / Room nesnesini frontend uyumlu standart Room modeline normalize eder
 */
export function normalizeRoom(data: unknown): Room | null {
  const raw = unwrapData<any>(data);
  const code = raw?.code || raw?.Code;
  if (!raw || typeof raw !== 'object' || !code) return null;

  const participants: RoomParticipant[] = (raw.participants || []).map((p: any) => {
    const user: User = p.user || {
      id: String(p.userId || p.id || `usr_${Date.now()}`),
      name: String(p.userName || p.name || 'Oyuncu'),
      email: String(p.userEmail || p.email || ''),
      avatarUrl:
        p.avatarUrl ||
        `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(p.userName || p.name || 'Oyuncu')}`,
      createdAt: p.joinedAt || new Date().toISOString(),
    };

    return {
      user,
      isHost: Boolean(p.isHost),
      isReady: Boolean(p.isReady),
      score: Number(p.score || 0),
      lastPointsEarned: p.lastPointsEarned ?? p.LastPointsEarned,
      lastGuessDuration: p.lastGuessDuration ?? p.LastGuessDuration,
      lastGuessedRound: p.lastGuessedRound ?? p.LastGuessedRound,
      lastGuessedSongId: p.lastGuessedSongId ?? p.LastGuessedSongId,
      joinedAt: p.joinedAt || new Date().toISOString(),
    };
  });

  const uniqueParticipantsMap = new Map<string, RoomParticipant>();
  for (const p of participants) {
    const key = String(p.user.id);
    if (!uniqueParticipantsMap.has(key)) {
      uniqueParticipantsMap.set(key, p);
    }
  }
  const uniqueParticipants = Array.from(uniqueParticipantsMap.values());

  const limitMinutes = Number(
    raw.guessTimeLimitMinutes ||
    raw.GuessTimeLimitMinutes ||
    raw.settings?.guessTimeLimitMinutes ||
    raw.Settings?.GuessTimeLimitMinutes ||
    1
  );

  const rawSettings = raw.settings || raw.Settings || {};
  const settings: RoomSettings = {
    region: rawSettings.region || rawSettings.Region || 'tr',
    genre: rawSettings.genre || rawSettings.Genre || 'all',
    era: rawSettings.era || rawSettings.Era || 'all',
    guessTimeLimitMinutes: Number(
      rawSettings.guessTimeLimitMinutes || rawSettings.GuessTimeLimitMinutes || limitMinutes
    ),
    gameMode: (rawSettings.gameMode || rawSettings.GameMode || 'short') as 'short' | 'long',
    songCount: Number(
      rawSettings.songCount ||
      rawSettings.SongCount ||
      ((rawSettings.gameMode || rawSettings.GameMode) === 'long' ? 10 : 3)
    ),
    playlistId: rawSettings.playlistId || rawSettings.PlaylistId || undefined,
    playlistUrl: rawSettings.playlistUrl || rawSettings.PlaylistUrl || undefined,
  };

  const rawSong = raw.currentSong || raw.CurrentSong;
  const currentSong = rawSong ? (normalizeSong(rawSong) || rawSong) : null;

  return {
    id: String(raw.id || raw.code || raw.Id || raw.Code),
    code: String(raw.code || raw.Code).toUpperCase().trim(),
    name: String(raw.name || raw.Name || `${raw.hostName || raw.HostName || 'Lobi'}'in Odası`),
    hostId: String(raw.hostId || raw.HostId || ''),
    hostName: String(raw.hostName || raw.HostName || ''),
    status: (raw.status || raw.Status || 'waiting') as RoomStatus,
    maxParticipants: Number(raw.maxParticipants || raw.MaxParticipants || 8),
    guessTimeLimitMinutes: limitMinutes,
    settings,
    createdAt: raw.createdAt || raw.CreatedAt || new Date().toISOString(),
    currentSong,
    currentRound: Number(raw.currentRound || raw.CurrentRound || 1),
    currentRoundStartedAt: raw.currentRoundStartedAt || raw.CurrentRoundStartedAt || raw.startedAt || raw.StartedAt,
    currentRoundEndsAt: raw.currentRoundEndsAt || raw.CurrentRoundEndsAt || raw.roundEndsAt || raw.RoundEndsAt || raw.endsAt || raw.EndsAt,
    participants: uniqueParticipants,
  };
}

/**
 * HTTP URL'sini WebSocket URL'sine dönüştürür (ws:// veya wss://)
 */
function buildWebSocketUrl(roomCode: string, userId?: string, userName?: string): string {
  const httpUrl = env.apiBaseUrl.replace(/\/+$/, '');
  const wsProto = httpUrl.startsWith('https') ? 'wss' : 'ws';
  const host = httpUrl.replace(/^https?:\/\//, '');
  const url = new URL(`${wsProto}://${host}/ws/room`);
  url.searchParams.append('code', roomCode.toUpperCase().trim());
  if (userId) url.searchParams.append('userId', userId);
  if (userName) url.searchParams.append('userName', userName);
  return url.toString();
}

let activeWebSocket: WebSocket | null = null;
let currentConnectedCode: string | null = null;
let pingIntervalId: any = null;
const roomSubscribers = new Map<string, Set<RoomSubscriptionCallback>>();
const songSubscribers = new Map<string, Set<SongChangeCallback>>();
const kickedSubscribers = new Map<string, Set<ParticipantKickedCallback>>();

// Çoklu sekme / yerel pencere senkronizasyonu için BroadcastChannel
const syncChannel =
  typeof window !== 'undefined' && 'BroadcastChannel' in window
    ? new BroadcastChannel('gts_room_sync_channel')
    : null;

if (syncChannel) {
  syncChannel.onmessage = (event) => {
    if (event.data?.type === 'ROOM_SYNC' && event.data?.room) {
      const room = event.data.room as Room;
      const cleanCode = room.code.toUpperCase().trim();
      const rooms = storage.get<Record<string, Room>>(ROOMS_STORAGE_KEY, {});
      rooms[cleanCode] = room;
      storage.set(ROOMS_STORAGE_KEY, rooms);

      const subscribers = roomSubscribers.get(cleanCode);
      if (subscribers) {
        subscribers.forEach((cb) => {
          try {
            cb(room);
          } catch (e) {
            console.error('[roomService] Channel sync callback error:', e);
          }
        });
      }
    }
  };
}

function broadcastRoomLocally(room: Room) {
  if (syncChannel) {
    try {
      syncChannel.postMessage({ type: 'ROOM_SYNC', room });
    } catch {
      // ignore
    }
  }
}

export const roomService = {
  /**
   * Yerel önbellekteki odaları döner (Fallback & Offline destek)
   */
  getStoredRooms(): Record<string, Room> {
    return storage.get<Record<string, Room>>(ROOMS_STORAGE_KEY, {});
  },

  /**
   * Canlı oda abonelerine güncellenmiş odayı dağıtır ve sekmeler arası senkronize eder
   */
  notifySubscribers(roomCode: string, room: Room): void {
    const cleanCode = roomCode.toUpperCase().trim();
    const subscribers = roomSubscribers.get(cleanCode);
    if (subscribers) {
      subscribers.forEach((cb) => {
        try {
          cb(room);
        } catch (e) {
          console.error('[roomService] Subscriber callback error:', e);
        }
      });
    }
    broadcastRoomLocally(room);
  },

  /**
   * Bir odaya ait canlı WebSocket güncellemelerine abone olur.
   */
  subscribeToRoom(roomCode: string, callback: RoomSubscriptionCallback): () => void {
    const cleanCode = roomCode.toUpperCase().trim();
    if (!roomSubscribers.has(cleanCode)) {
      roomSubscribers.set(cleanCode, new Set());
    }
    const set = roomSubscribers.get(cleanCode)!;
    set.add(callback);

    const currentUser = authService.getSession().user;
    if (!activeWebSocket || currentConnectedCode !== cleanCode) {
      this.connectWebSocket(cleanCode, currentUser);
    }

    return () => {
      set.delete(callback);
      if (set.size === 0) {
        roomSubscribers.delete(cleanCode);
        if (currentConnectedCode === cleanCode && !songSubscribers.has(cleanCode)) {
          this.disconnectWebSocket();
        }
      }
    };
  },

  /**
   * Odanın senkronize ortak şarkı değişimlerine abone olur.
   * Şarkı değiştiğinde odadaki tüm oyuncuların useGameRound oturumu aynı şarkıyı çalar.
   */
  onSongChanged(roomCode: string, callback: SongChangeCallback): () => void {
    const cleanCode = roomCode.toUpperCase().trim();
    if (!songSubscribers.has(cleanCode)) {
      songSubscribers.set(cleanCode, new Set());
    }
    const set = songSubscribers.get(cleanCode)!;
    set.add(callback);

    const currentUser = authService.getSession().user;
    if (!activeWebSocket || currentConnectedCode !== cleanCode) {
      this.connectWebSocket(cleanCode, currentUser);
    }

    return () => {
      set.delete(callback);
      if (set.size === 0) {
        songSubscribers.delete(cleanCode);
        if (currentConnectedCode === cleanCode && !roomSubscribers.has(cleanCode)) {
          this.disconnectWebSocket();
        }
      }
    };
  },

  /**
   * WebSocket bağlantısını kurar (/ws/room)
   */
  connectWebSocket(roomCode: string, user?: User | null): WebSocket | null {
    if (typeof window === 'undefined') return null;
    const cleanCode = roomCode.toUpperCase().trim();

    if (activeWebSocket && currentConnectedCode === cleanCode && activeWebSocket.readyState === WebSocket.OPEN) {
      return activeWebSocket;
    }

    this.disconnectWebSocket();

    try {
      const currentUser = user || authService.getSession().user;
      const wsUrl = buildWebSocketUrl(cleanCode, currentUser?.id, currentUser?.name);
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        activeWebSocket = ws;
        currentConnectedCode = cleanCode;

        // Düzenli heartbeat (30 saniyede bir ping)
        if (pingIntervalId) clearInterval(pingIntervalId);
        pingIntervalId = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'PING' }));
          }
        }, 30000);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as RoomWebSocketMessage<any>;

          // Ortak şarkı değişimi bildirimi
          if (msg.type === 'SONG_CHANGED') {
            const songPayload = msg.data as {
              song: Song;
              round: number;
              startedAt?: string;
              endsAt?: string;
              currentRoundStartedAt?: string;
              currentRoundEndsAt?: string;
              roundEndsAt?: string;
              guessTimeLimitMinutes?: number;
            };
            if (songPayload?.song) {
              const rooms = this.getStoredRooms();
              const current = rooms[cleanCode];
              const now = Date.now();
              const baseMinutes = Number(
                songPayload.guessTimeLimitMinutes ||
                current?.guessTimeLimitMinutes ||
                current?.settings?.guessTimeLimitMinutes ||
                1
              );
              const startedAt = songPayload.currentRoundStartedAt || songPayload.startedAt || new Date(now).toISOString();
              const endsAt = songPayload.currentRoundEndsAt || songPayload.roundEndsAt || songPayload.endsAt || new Date(now + baseMinutes * 60 * 1000).toISOString();

              if (current) {
                const normalizedSong = normalizeSong(songPayload.song) || songPayload.song;
                current.currentSong = normalizedSong;
                current.currentRound = songPayload.round || current.currentRound || 1;
                current.currentRoundStartedAt = startedAt;
                current.currentRoundEndsAt = endsAt;
                current.guessTimeLimitMinutes = baseMinutes;
                current.participants.forEach((p) => {
                  p.lastPointsEarned = undefined;
                  p.lastGuessDuration = undefined;
                  p.lastGuessedRound = undefined;
                  p.lastGuessedSongId = undefined;
                });
                rooms[cleanCode] = current;
                storage.set(ROOMS_STORAGE_KEY, rooms);
                broadcastRoomLocally(current);
                this.notifySubscribers(cleanCode, current);
              }

              const songSubs = songSubscribers.get(cleanCode);
              if (songSubs) {
                const normalizedSong = normalizeSong(songPayload.song) || songPayload.song;
                songSubs.forEach((cb) => {
                  try {
                    cb(normalizedSong, songPayload.round || 1, endsAt);
                  } catch (e) {
                    console.error('[roomService] Song subscriber callback error:', e);
                  }
                });
              }
            }
            return;
          }

          // Durum değişimi bildirimi (Oyun Başladı vb.)
          if (msg.type === 'STATUS_CHANGED') {
            const statusPayload = msg.data as {
              status?: string;
              currentRoundStartedAt?: string;
              currentRoundEndsAt?: string;
              guessTimeLimitMinutes?: number;
            } | string;
            const newStatus =
              typeof statusPayload === 'object' && statusPayload?.status
                ? statusPayload.status
                : String(statusPayload || 'in_game');

            const rooms = this.getStoredRooms();
            const current = rooms[cleanCode];
            if (current) {
              current.status = newStatus as RoomStatus;
              if (newStatus === 'in_game') {
                const now = Date.now();
                const baseMinutes = Number(
                  (typeof statusPayload === 'object' && statusPayload?.guessTimeLimitMinutes) ||
                  current.guessTimeLimitMinutes ||
                  current.settings?.guessTimeLimitMinutes ||
                  1
                );
                current.currentRoundStartedAt =
                  (typeof statusPayload === 'object' && statusPayload?.currentRoundStartedAt) ||
                  new Date(now).toISOString();
                current.currentRoundEndsAt =
                  (typeof statusPayload === 'object' && statusPayload?.currentRoundEndsAt) ||
                  new Date(now + baseMinutes * 60 * 1000).toISOString();
                current.currentRound = 1;
                current.participants.forEach((p) => {
                  p.lastPointsEarned = undefined;
                  p.lastGuessDuration = undefined;
                });
              } else if (newStatus === 'waiting' || newStatus === 'finished') {
                current.currentSong = null;
                current.currentRound = 1;
                current.currentRoundStartedAt = undefined;
                current.currentRoundEndsAt = undefined;
                current.participants.forEach((p) => {
                  p.lastPointsEarned = undefined;
                  p.lastGuessDuration = undefined;
                });
              }
              rooms[cleanCode] = current;
              storage.set(ROOMS_STORAGE_KEY, rooms);
              broadcastRoomLocally(current);
              this.notifySubscribers(cleanCode, current);
            }
            return;
          }

          if (msg.type === 'PARTICIPANT_LEFT') {
            const payload = msg.data as { userId?: string; targetUserId?: string; room?: any } | string;
            const targetId = typeof payload === 'object' ? (payload?.targetUserId || payload?.userId) : String(payload);
            const rooms = this.getStoredRooms();
            const current = rooms[cleanCode];
            if (current && targetId) {
              current.participants = current.participants.filter(
                (p) => String(p.user.id) !== String(targetId)
              );
              rooms[cleanCode] = current;
              storage.set(ROOMS_STORAGE_KEY, rooms);
              broadcastRoomLocally(current);
              this.notifySubscribers(cleanCode, current);
            } else if (typeof payload === 'object' && payload?.room) {
              const updatedRoom = normalizeRoom(payload.room);
              if (updatedRoom) {
                rooms[cleanCode] = updatedRoom;
                storage.set(ROOMS_STORAGE_KEY, rooms);
                broadcastRoomLocally(updatedRoom);
                this.notifySubscribers(cleanCode, updatedRoom);
              }
            }
            return;
          }

          if (msg.type === 'PARTICIPANT_KICKED') {
            const payload = msg.data as { targetUserId?: string; room?: any };
            const targetUserId = payload?.targetUserId;
            let updatedRoom: Room | null = null;

            if (payload?.room) {
              updatedRoom = normalizeRoom(payload.room);
              if (updatedRoom) {
                const rooms = this.getStoredRooms();
                rooms[cleanCode] = updatedRoom;
                storage.set(ROOMS_STORAGE_KEY, rooms);
                broadcastRoomLocally(updatedRoom);
                this.notifySubscribers(cleanCode, updatedRoom);
              }
            } else if (targetUserId) {
              const rooms = this.getStoredRooms();
              const current = rooms[cleanCode];
              if (current) {
                current.participants = current.participants.filter(
                  (p) => String(p.user.id) !== String(targetUserId)
                );
                rooms[cleanCode] = current;
                storage.set(ROOMS_STORAGE_KEY, rooms);
                broadcastRoomLocally(current);
                updatedRoom = current;
                this.notifySubscribers(cleanCode, current);
              }
            }

            const kickSubs = kickedSubscribers.get(cleanCode);
            if (kickSubs && targetUserId) {
              kickSubs.forEach((cb) => {
                try {
                  cb(targetUserId, updatedRoom);
                } catch (e) {
                  console.error('[roomService] Kicked subscriber callback error:', e);
                }
              });
            }
            return;
          }

          if (
            msg.type === 'ROOM_STATE' ||
            msg.type === 'ROOM_UPDATED' ||
            msg.type === 'SCORE_UPDATED' ||
            msg.type === 'PARTICIPANT_JOINED'
          ) {
            const updatedRoom = normalizeRoom(msg.data);
            if (updatedRoom && updatedRoom.code) {
              const rooms = this.getStoredRooms();
              const prevRoom = rooms[cleanCode];

              // Skor güncellemesinde veya oda güncellemesinde katılımcıların tahmin durumlarını koru
              if (prevRoom?.participants) {
                updatedRoom.participants = updatedRoom.participants.map((p) => {
                  const prevP = prevRoom.participants.find((ep) => String(ep.user.id) === String(p.user.id));
                  return {
                    ...p,
                    lastPointsEarned: p.lastPointsEarned !== undefined && p.lastPointsEarned !== null ? p.lastPointsEarned : prevP?.lastPointsEarned,
                    lastGuessDuration: p.lastGuessDuration !== undefined && p.lastGuessDuration !== null ? p.lastGuessDuration : prevP?.lastGuessDuration,
                    lastGuessedRound: p.lastGuessedRound ?? prevP?.lastGuessedRound,
                    lastGuessedSongId: p.lastGuessedSongId ?? prevP?.lastGuessedSongId,
                  };
                });
              }

              rooms[cleanCode] = updatedRoom;
              storage.set(ROOMS_STORAGE_KEY, rooms);

              // Abone olan tüm bileşenlere canlı oda güncellemesi dağıt
              this.notifySubscribers(cleanCode, updatedRoom);

              // Skor güncellemesinde şarkı değişmez! SADECE şarkı gerçekten değiştiğinde şarkı abonelerini çağır
              if (
                msg.type !== 'SCORE_UPDATED' &&
                updatedRoom.currentSong &&
                (!prevRoom?.currentSong || !isSameSong(prevRoom.currentSong, updatedRoom.currentSong))
              ) {
                const songSubs = songSubscribers.get(cleanCode);
                if (songSubs) {
                  songSubs.forEach((cb) => cb(updatedRoom.currentSong!, updatedRoom.currentRound || 1, updatedRoom.currentRoundEndsAt));
                }
              }
            }
          }
        } catch (err) {
          console.error('[roomService] Error parsing WebSocket message:', err);
        }
      };

      ws.onerror = (err) => {
        console.warn(`[roomService] WebSocket connection error (${cleanCode}):`, err);
      };

      ws.onclose = () => {
        if (activeWebSocket === ws) {
          activeWebSocket = null;
          currentConnectedCode = null;
        }
        if (pingIntervalId) {
          clearInterval(pingIntervalId);
          pingIntervalId = null;
        }

        // Eğer hala odaya abone olan bileşenler varsa 3 saniye sonra otomatik yeniden bağlan
        if (roomSubscribers.has(cleanCode) || songSubscribers.has(cleanCode)) {
          setTimeout(() => {
            if (!activeWebSocket && (roomSubscribers.has(cleanCode) || songSubscribers.has(cleanCode))) {
              console.log(`🔄 [roomService] WebSocket bağlantısı koptu, yeniden bağlanılıyor (${cleanCode})...`);
              this.connectWebSocket(cleanCode, currentUser);
            }
          }, 3000);
        }
      };

      return ws;
    } catch (err) {
      console.warn(`[roomService] WebSocket setup failed for room ${cleanCode}:`, err);
      return null;
    }
  },

  /**
   * Aktif WebSocket bağlantısının açık olup olmadığını kontrol eder
   */
  isWebSocketConnected(roomCode?: string): boolean {
    if (!activeWebSocket || activeWebSocket.readyState !== WebSocket.OPEN) return false;
    if (roomCode) return currentConnectedCode === roomCode.toUpperCase().trim();
    return true;
  },

  /**
   * Aktif WebSocket bağlantısını kapatır
   */
  disconnectWebSocket(): void {
    if (pingIntervalId) {
      clearInterval(pingIntervalId);
      pingIntervalId = null;
    }
    if (activeWebSocket) {
      try {
        activeWebSocket.close();
      } catch {
        // ignore
      }
      activeWebSocket = null;
      currentConnectedCode = null;
    }
  },

  /**
   * Odaya ait mevcut ortak şarkıyı ayarlar.
   * Bu metot WebSocket üzerinden odaya anında şarkıyı basar,
   * böylece odadaki HERKES aynı şarkıyı aynı turda dinler ve tahmin eder.
   */
  async setCurrentSong(roomCode: string, song: Song, round = 1): Promise<Room | null> {
    const cleanCode = roomCode.toUpperCase().trim();

    const rooms = this.getStoredRooms();
    const room = rooms[cleanCode];
    const baseMinutes = Number(room?.guessTimeLimitMinutes || room?.settings?.guessTimeLimitMinutes || 1);
    const now = Date.now();
    const currentRoundStartedAt = new Date(now).toISOString();
    const currentRoundEndsAt = new Date(now + baseMinutes * 60 * 1000).toISOString();

    // 1. WebSocket üzerinden tüm odaya anında son saniyeyi fırlat
    if (activeWebSocket && activeWebSocket.readyState === WebSocket.OPEN && currentConnectedCode === cleanCode) {
      try {
        activeWebSocket.send(
          JSON.stringify({
            type: 'SET_SONG',
            payload: {
              roomCode: cleanCode,
              song,
              songId: song.id,
              round,
              startedAt: currentRoundStartedAt,
              endsAt: currentRoundEndsAt,
              currentRoundStartedAt,
              currentRoundEndsAt,
              roundEndsAt: currentRoundEndsAt,
              CurrentRoundEndsAt: currentRoundEndsAt,
              CurrentRoundStartedAt: currentRoundStartedAt,
              guessTimeLimitMinutes: baseMinutes,
              GuessTimeLimitMinutes: baseMinutes,
            },
          })
        );
      } catch (wsErr) {
        console.warn('[roomService] Failed to send SET_SONG via WebSocket:', wsErr);
      }
    }

    // 2. REST API ile backend tarafına şarkıyı ve tahmin edilebilecek son saniyeyi kaydet
    try {
      const response = await apiClient.post<Room | { success: boolean; data: Room }>(
        ENDPOINTS.ROOMS.SET_CURRENT_SONG,
        {
          roomCode: cleanCode,
          songId: song.id,
          songData: song,
          round,
          startedAt: currentRoundStartedAt,
          endsAt: currentRoundEndsAt,
          currentRoundStartedAt,
          currentRoundEndsAt,
          roundEndsAt: currentRoundEndsAt,
          CurrentRoundEndsAt: currentRoundEndsAt,
          CurrentRoundStartedAt: currentRoundStartedAt,
          guessTimeLimitMinutes: baseMinutes,
          GuessTimeLimitMinutes: baseMinutes,
        }
      );

      const updatedRaw = unwrapData<Room | null>(response);
      const updatedRoom = updatedRaw ? normalizeRoom(updatedRaw) : null;
      const targetRoom = updatedRoom && updatedRoom.code ? updatedRoom : (room || null);
      if (targetRoom) {
        targetRoom.currentSong = song;
        targetRoom.currentRound = round;
        targetRoom.currentRoundStartedAt = currentRoundStartedAt;
        targetRoom.currentRoundEndsAt = currentRoundEndsAt;
        targetRoom.guessTimeLimitMinutes = baseMinutes;
        targetRoom.participants.forEach((p) => {
          p.lastPointsEarned = undefined;
          p.lastGuessDuration = undefined;
          p.lastGuessedRound = undefined;
          p.lastGuessedSongId = undefined;
        });
        rooms[cleanCode] = targetRoom;
        storage.set(ROOMS_STORAGE_KEY, rooms);
        broadcastRoomLocally(targetRoom);
        this.notifySubscribers(cleanCode, targetRoom);

        const songSubs = songSubscribers.get(cleanCode);
        if (songSubs) {
          songSubs.forEach((cb) => {
            try {
              cb(song, round, currentRoundEndsAt);
            } catch (e) {
              console.error('[roomService] Song subscriber callback error:', e);
            }
          });
        }

        return targetRoom;
      }
    } catch (err) {
      console.warn('[roomService] Backend setCurrentSong failed, fallback to local storage:', err);
    }

    // Fallback: Yerel depoda şarkıyı güncelle
    if (room) {
      room.currentSong = song;
      room.currentRound = round;
      room.currentRoundStartedAt = currentRoundStartedAt;
      room.currentRoundEndsAt = currentRoundEndsAt;
      room.guessTimeLimitMinutes = baseMinutes;
      room.participants.forEach((p) => {
        p.lastPointsEarned = undefined;
        p.lastGuessDuration = undefined;
        p.lastGuessedRound = undefined;
        p.lastGuessedSongId = undefined;
      });
      rooms[cleanCode] = room;
      storage.set(ROOMS_STORAGE_KEY, rooms);
      broadcastRoomLocally(room);
      this.notifySubscribers(cleanCode, room);

      const songSubs = songSubscribers.get(cleanCode);
      if (songSubs) {
        songSubs.forEach((cb) => cb(song, round, currentRoundEndsAt));
      }

      return room;
    }

    return null;
  },

  /**
   * Yeni bir oyun odası kurar (Backend POST /api/rooms/create)
   */
  async createRoom(request: CreateRoomRequest, hostUser: User, token: string): Promise<Room> {
    if (!token) {
      throw new Error('Oda kurabilmek için giriş yapmış olmanız (token) gerekmektedir.');
    }

    const payload = {
      name: request.name.trim() || `${hostUser.name}'in Odası`,
      hostId: hostUser.id,
      hostName: hostUser.name,
      hostEmail: hostUser.email,
      hostAvatarUrl: hostUser.avatarUrl,
      maxParticipants: request.maxParticipants || 8,
      guessTimeLimitMinutes: request.guessTimeLimitMinutes || 1,
      region: request.settings?.region || 'tr',
      genre: request.settings?.genre || 'all',
      era: request.settings?.era || 'all',
      gameMode: request.settings?.gameMode || 'short',
      songCount: request.settings?.songCount || (request.settings?.gameMode === 'long' ? 10 : 3),
      playlistId: request.settings?.playlistId,
      playlistUrl: request.settings?.playlistUrl,
    };

    try {
      const response = await apiClient.post<Room | { success: boolean; data: Room }>(
        ENDPOINTS.ROOMS.CREATE,
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const createdRoom = normalizeRoom(response);
      if (createdRoom && createdRoom.code) {
        const rooms = this.getStoredRooms();
        rooms[createdRoom.code.toUpperCase()] = createdRoom;
        storage.set(ROOMS_STORAGE_KEY, rooms);

        // Odayı kurduktan sonra hemen WebSocket dinleyicisini bağla
        this.connectWebSocket(createdRoom.code, hostUser);
        this.notifySubscribers(createdRoom.code, createdRoom);

        return createdRoom;
      }
    } catch (err) {
      console.warn('[roomService] Backend createRoom failed, falling back to local storage:', err);
    }

    // Fallback: Yerel oda oluştur
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const roomCode = `GTS-${randomSuffix}`;

    const fallbackRoom: Room = {
      id: `room_${Date.now()}`,
      code: roomCode,
      name: payload.name,
      hostId: hostUser.id,
      hostName: hostUser.name,
      status: 'waiting',
      maxParticipants: payload.maxParticipants,
      guessTimeLimitMinutes: payload.guessTimeLimitMinutes,
      settings: request.settings || {
        region: 'tr',
        genre: 'all',
        era: 'all',
        guessTimeLimitMinutes: payload.guessTimeLimitMinutes,
        gameMode: payload.gameMode,
        songCount: payload.songCount,
        playlistId: payload.playlistId,
        playlistUrl: payload.playlistUrl,
      },
      createdAt: new Date().toISOString(),
      participants: [
        {
          user: hostUser,
          isHost: true,
          isReady: true,
          score: 0,
          joinedAt: new Date().toISOString(),
        },
      ],
    };

    const rooms = this.getStoredRooms();
    rooms[roomCode] = fallbackRoom;
    storage.set(ROOMS_STORAGE_KEY, rooms);
    this.connectWebSocket(roomCode, hostUser);
    this.notifySubscribers(roomCode, fallbackRoom);

    return fallbackRoom;
  },

  /**
   * Oda koduna göre odayı ve katılımcılarını getirir (Backend GET /api/rooms/getbycode)
   */
  async getRoomByCode(roomCode: string): Promise<Room | null> {
    if (!roomCode) return null;
    const cleanCode = roomCode.toUpperCase().trim();

    try {
      const response = await apiClient.get<Room | { success: boolean; data: Room }>(
        ENDPOINTS.ROOMS.GET_BY_CODE,
        {
          params: { code: cleanCode },
        }
      );

      const room = normalizeRoom(response);
      if (room && room.code) {
        const rooms = this.getStoredRooms();
        const existing = rooms[cleanCode];
        if (existing) {
          if (existing.status && existing.status !== room.status) {
            room.status = existing.status;
          }
          if (existing.currentRound && (!room.currentRound || existing.currentRound > room.currentRound)) {
            room.currentRound = existing.currentRound;
            room.currentSong = existing.currentSong || room.currentSong;
          }
          if (existing.currentRoundEndsAt && !room.currentRoundEndsAt) {
            room.currentRoundEndsAt = existing.currentRoundEndsAt;
          }
          if (existing.currentRoundStartedAt && !room.currentRoundStartedAt) {
            room.currentRoundStartedAt = existing.currentRoundStartedAt;
          }

          // Katılımcıların bu raund için puan durumlarını senkronize et:
          // Hem backend'den dönen güncel puanları hem de henüz REST'e yansımamış yerel puanları koru!
          const activeRound = room.currentRound || existing.currentRound || 1;
          const activeSongId = room.currentSong?.id || existing.currentSong?.id;

          room.participants = room.participants.map((p) => {
            const existingP = existing.participants?.find((ep) => String(ep.user.id) === String(p.user.id));
            const bestScore = Math.max(p.score || 0, existingP?.score || 0);

            // Backend'den gelen veya yerelde kaydedilmiş en güncel puanı al
            const earned = p.lastPointsEarned !== undefined && p.lastPointsEarned !== null
              ? p.lastPointsEarned
              : existingP?.lastPointsEarned;
            const duration = p.lastGuessDuration !== undefined && p.lastGuessDuration !== null
              ? p.lastGuessDuration
              : existingP?.lastGuessDuration;

            return {
              ...p,
              score: bestScore,
              lastPointsEarned: earned,
              lastGuessDuration: duration,
              lastGuessedRound: existingP?.lastGuessedRound ?? (earned !== undefined && earned !== null ? activeRound : undefined),
              lastGuessedSongId: existingP?.lastGuessedSongId ?? (earned !== undefined && earned !== null ? activeSongId : undefined),
            };
          });
        }
        rooms[cleanCode] = room;
        storage.set(ROOMS_STORAGE_KEY, rooms);
        return room;
      }
    } catch (err) {
      console.warn(`[roomService] Backend getRoomByCode (${cleanCode}) failed, reading local:`, err);
    }

    const rooms = this.getStoredRooms();
    return rooms[cleanCode] || null;
  },

  /**
   * Davet linki veya kod ile odaya katılır (Backend POST /api/rooms/join)
   */
  async joinRoom(roomCode: string, user: User, token: string): Promise<Room> {
    if (!token) {
      throw new Error('Odaya katılabilmek için giriş yapmış olmalısınız.');
    }

    const cleanCode = roomCode.toUpperCase().trim();
    const payload = {
      roomCode: cleanCode,
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      avatarUrl: user.avatarUrl,
    };

    try {
      const response = await apiClient.post<Room | { success: boolean; data: Room }>(
        ENDPOINTS.ROOMS.JOIN,
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const joinedRoom = normalizeRoom(response);
      if (joinedRoom && joinedRoom.code) {
        const rooms = this.getStoredRooms();
        rooms[cleanCode] = joinedRoom;
        storage.set(ROOMS_STORAGE_KEY, rooms);

        // Katıldıktan sonra odaya ait WebSocket'i dinle
        this.connectWebSocket(cleanCode, user);
        this.notifySubscribers(cleanCode, joinedRoom);

        return joinedRoom;
      }
    } catch (err) {
      console.warn(`[roomService] Backend joinRoom (${cleanCode}) failed, fallback to local:`, err);
    }

    // Fallback: Yerel katılım
    const rooms = this.getStoredRooms();
    let targetRoom = rooms[cleanCode];

    if (!targetRoom) {
      targetRoom = {
        id: `room_${Date.now()}`,
        code: cleanCode,
        name: `${cleanCode} Müzik Odası`,
        hostId: 'host_demo',
        hostName: 'Oda Kurucusu',
        status: 'waiting',
        maxParticipants: 8,
        settings: {
          region: 'tr',
          genre: 'all',
          era: 'all',
        },
        createdAt: new Date().toISOString(),
        participants: [
          {
            user: {
              id: 'host_demo',
              name: 'Oda Kurucusu',
              email: 'host@example.com',
              avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=Host',
              createdAt: new Date().toISOString(),
            },
            isHost: true,
            isReady: true,
            score: 0,
            joinedAt: new Date().toISOString(),
          },
        ],
      };
    }

    const alreadyJoined = targetRoom.participants.some((p) => p.user.id === user.id);
    if (!alreadyJoined) {
      targetRoom.participants.push({
        user,
        isHost: false,
        isReady: true,
        score: 0,
        joinedAt: new Date().toISOString(),
      });
    }

    rooms[cleanCode] = targetRoom;
    storage.set(ROOMS_STORAGE_KEY, rooms);
    this.connectWebSocket(cleanCode, user);
    this.notifySubscribers(cleanCode, targetRoom);

    return targetRoom;
  },

  /**
   * Oyuncunun kazandığı puanı ve süreyi odaya aktarır (WebSocket öncelikli, REST fallback)
   */
  async updateParticipantScore(
    roomCode: string,
    userId: string,
    pointsEarned: number,
    duration: number,
    round?: number,
    songId?: string | number
  ): Promise<Room | null> {
    const cleanCode = roomCode.toUpperCase().trim();
    const rooms = this.getStoredRooms();
    const currentRoom = rooms[cleanCode];
    const sessionUser = authService.getSession().user;
    const effectiveUserId =
      userId ||
      sessionUser?.id ||
      (currentRoom?.participants && sessionUser?.email
        ? currentRoom.participants.find((p) => p.user.email === sessionUser.email)?.user.id
        : userId);
    const targetRound = round ?? currentRoom?.currentRound ?? 1;
    const targetSongId = songId ?? currentRoom?.currentSong?.id;

    // 1. Öncelik: Aktif WebSocket varsa sıfır gecikmeyle anında gönder!
    if (activeWebSocket && activeWebSocket.readyState === WebSocket.OPEN && currentConnectedCode === cleanCode) {
      try {
        activeWebSocket.send(
          JSON.stringify({
            type: 'UPDATE_SCORE',
            payload: {
              roomCode: cleanCode,
              userId: effectiveUserId,
              pointsEarned,
              duration,
              round: targetRound,
              songId: targetSongId,
            },
          })
        );
      } catch (wsErr) {
        console.warn('[roomService] Failed to send score via WebSocket, falling back to REST:', wsErr);
      }
    }

    // Yerel depoda HEMEN güncelle (REST cevabını beklemeden anında reaktif olmasını sağlar)
    if (currentRoom) {
      const p = currentRoom.participants.find((item) => String(item.user.id) === String(effectiveUserId));
      if (p) {
        p.score = (p.score || 0) + pointsEarned;
        p.lastPointsEarned = pointsEarned;
        p.lastGuessDuration = duration;
        p.lastGuessedRound = targetRound;
        p.lastGuessedSongId = targetSongId;
      }
      currentRoom.participants.sort((a, b) => (b.score || 0) - (a.score || 0));
      rooms[cleanCode] = currentRoom;
      storage.set(ROOMS_STORAGE_KEY, rooms);
      broadcastRoomLocally(currentRoom);
      this.notifySubscribers(cleanCode, currentRoom);
    }

    // 2. REST API çağrısı ile veritabanını güncelle ve garantile
    const payload = {
      roomCode: cleanCode,
      userId: effectiveUserId,
      pointsEarned,
      duration,
    };

    try {
      const response = await apiClient.post<Room | { success: boolean; data: Room }>(
        ENDPOINTS.ROOMS.UPDATE_SCORE,
        payload
      );

      const updatedRoom = normalizeRoom(response);
      if (updatedRoom && updatedRoom.code) {
        // updatedRoom katılımcılarında hem geçerli kullanıcının hem diğer katılımcıların round ve puan verilerini koru
        const currentData = rooms[cleanCode];
        updatedRoom.participants = updatedRoom.participants.map((p) => {
          const isTarget = String(p.user.id) === String(userId);
          const prevP = currentData?.participants?.find((ep) => String(ep.user.id) === String(p.user.id));
          return {
            ...p,
            lastPointsEarned: isTarget ? pointsEarned : (p.lastPointsEarned !== undefined && p.lastPointsEarned !== null ? p.lastPointsEarned : prevP?.lastPointsEarned),
            lastGuessDuration: isTarget ? duration : (p.lastGuessDuration !== undefined && p.lastGuessDuration !== null ? p.lastGuessDuration : prevP?.lastGuessDuration),
            lastGuessedRound: isTarget ? targetRound : (p.lastGuessedRound ?? prevP?.lastGuessedRound),
            lastGuessedSongId: isTarget ? targetSongId : (p.lastGuessedSongId ?? prevP?.lastGuessedSongId),
          };
        });
        rooms[cleanCode] = updatedRoom;
        storage.set(ROOMS_STORAGE_KEY, rooms);
        this.notifySubscribers(cleanCode, updatedRoom);
        return updatedRoom;
      }
    } catch (err) {
      console.warn(`[roomService] Backend updateParticipantScore failed, fallback to local:`, err);
    }

    return currentRoom || null;
  },

  /**
   * Odanın senkronize kalan süresini (saniye cinsinden) döner.
   * Odayı oluştururken seçilen dakikaya göre hesaplanan son saniye (currentRoundEndsAt) baz alınır.
   */
  getRemainingRoundSeconds(room: Room | null | undefined): number {
    if (!room) return 60;
    const baseMinutes = Number(
      room.guessTimeLimitMinutes ||
      room.settings?.guessTimeLimitMinutes ||
      1
    );
    const totalSeconds = Math.max(30, baseMinutes * 60);

    if (room.status !== 'in_game') {
      return totalSeconds;
    }

    // 1. Backend veya oda nesnesinde setlenmiş tahmin edilebilecek son saniye (currentRoundEndsAt)
    if (room.currentRoundEndsAt) {
      const endsAtMs = parseServerDateMs(room.currentRoundEndsAt);
      if (endsAtMs !== null) {
        const remaining = Math.ceil((endsAtMs - Date.now()) / 1000);
        // Kalan saniye pozitif ise döner
        if (remaining > 0) {
          return remaining;
        }
        // Eğer süre gerçekten bitmişse 0 döner
        if (remaining <= 0 && remaining > -totalSeconds * 2) {
          return 0;
        }
      }
    }

    // 2. Alternatif olarak başlangıç saati üzerinden kontrol
    if (room.currentRoundStartedAt) {
      const startedAtMs = parseServerDateMs(room.currentRoundStartedAt);
      if (startedAtMs !== null) {
        const elapsedSec = Math.floor((Date.now() - startedAtMs) / 1000);
        if (elapsedSec >= 0 && elapsedSec < totalSeconds) {
          return totalSeconds - elapsedSec;
        }
        if (elapsedSec >= totalSeconds && elapsedSec <= totalSeconds * 2) {
          return 0;
        }
      }
    }

    // İlk başlatmada veya henüz hesaplanırken varsayılan tam süreyi ver (anında sıfırlanmayı engeller)
    return totalSeconds;
  },

  /**
   * Oda durumunu günceller (waiting, in_game, finished)
   */
  async changeRoomStatus(roomCode: string, status: RoomStatus): Promise<boolean> {
    const cleanCode = roomCode.toUpperCase().trim();

    const rooms = this.getStoredRooms();
    const current = rooms[cleanCode];
    const now = Date.now();
    let currentRoundStartedAt: string | undefined;
    let currentRoundEndsAt: string | undefined;
    let limitMinutes = 1;

    if (current) {
      current.status = status;
      limitMinutes = Number(current.guessTimeLimitMinutes || current.settings?.guessTimeLimitMinutes || 1);
      if (status === 'in_game') {
        currentRoundStartedAt = new Date(now).toISOString();
        currentRoundEndsAt = new Date(now + limitMinutes * 60 * 1000).toISOString();
        current.currentRoundStartedAt = currentRoundStartedAt;
        current.currentRoundEndsAt = currentRoundEndsAt;
        current.currentRound = 1;
        current.participants.forEach((p) => {
          p.lastPointsEarned = undefined;
          p.lastGuessDuration = undefined;
        });
      } else if (status === 'waiting' || status === 'finished') {
        current.currentSong = null;
        current.currentRound = 1;
        current.currentRoundStartedAt = undefined;
        current.currentRoundEndsAt = undefined;
        current.participants.forEach((p) => {
          p.lastPointsEarned = undefined;
          p.lastGuessDuration = undefined;
        });
      }
      rooms[cleanCode] = current;
      storage.set(ROOMS_STORAGE_KEY, rooms);
      broadcastRoomLocally(current);
      this.notifySubscribers(cleanCode, current);
    }

    if (activeWebSocket && activeWebSocket.readyState === WebSocket.OPEN && currentConnectedCode === cleanCode) {
      try {
        activeWebSocket.send(
          JSON.stringify({
            type: 'CHANGE_STATUS',
            payload: {
              roomCode: cleanCode,
              status,
              currentRound: 1,
              currentRoundStartedAt,
              currentRoundEndsAt,
              roundEndsAt: currentRoundEndsAt,
              endsAt: currentRoundEndsAt,
              CurrentRoundEndsAt: currentRoundEndsAt,
              CurrentRoundStartedAt: currentRoundStartedAt,
              guessTimeLimitMinutes: limitMinutes,
              GuessTimeLimitMinutes: limitMinutes,
            },
          })
        );
      } catch {
        // ignore
      }
    }

    try {
      await apiClient.post(ENDPOINTS.ROOMS.CHANGE_STATUS, {
        roomCode: cleanCode,
        status,
        currentRound: 1,
        currentRoundStartedAt,
        currentRoundEndsAt,
        roundEndsAt: currentRoundEndsAt,
        endsAt: currentRoundEndsAt,
        CurrentRoundEndsAt: currentRoundEndsAt,
        CurrentRoundStartedAt: currentRoundStartedAt,
        guessTimeLimitMinutes: limitMinutes,
        GuessTimeLimitMinutes: limitMinutes,
      });
      return true;
    } catch (err) {
      console.warn(`[roomService] changeRoomStatus failed:`, err);
      return false;
    }
  },


  /**
   * Odanın anlık liderlik tablosunu getirir (Backend GET /api/rooms/leaderboard)
   */
  async getLeaderboard(roomCode: string): Promise<RoomParticipant[]> {
    const cleanCode = roomCode.toUpperCase().trim();
    try {
      const response = await apiClient.get<RoomParticipant[] | { success: boolean; data: RoomParticipant[] }>(
        ENDPOINTS.ROOMS.LEADERBOARD,
        { params: { code: cleanCode } }
      );
      return unwrapData<RoomParticipant[]>(response) || [];
    } catch (err) {
      console.warn(`[roomService] getLeaderboard failed:`, err);
      const rooms = this.getStoredRooms();
      return rooms[cleanCode]?.participants || [];
    }
  },

  /**
   * İnsanları davet edecek benzersiz bağlantı linki üretir (&invite=true parametresi ile)
   */
  generateInviteLink(roomCode: string): string {
    const origin = window.location.origin;
    const pathname = window.location.pathname;
    return `${origin}${pathname}?room=${encodeURIComponent(roomCode)}&invite=true`;
  },

  /**
   * Odadan atılma (Kick) olayına abone olur
   */
  onParticipantKicked(roomCode: string, callback: ParticipantKickedCallback): () => void {
    const cleanCode = roomCode.toUpperCase().trim();
    if (!kickedSubscribers.has(cleanCode)) {
      kickedSubscribers.set(cleanCode, new Set());
    }
    const set = kickedSubscribers.get(cleanCode)!;
    set.add(callback);

    const currentUser = authService.getSession().user;
    if (!activeWebSocket || currentConnectedCode !== cleanCode) {
      this.connectWebSocket(cleanCode, currentUser);
    }

    return () => {
      set.delete(callback);
      if (set.size === 0) {
        kickedSubscribers.delete(cleanCode);
      }
    };
  },

  /**
   * Oda sahibinin oyuncuyu odadan çıkarması (Kick)
   */
  async kickParticipant(roomCode: string, hostId: string, targetUserId: string): Promise<Room> {
    const cleanCode = roomCode.toUpperCase().trim();
    try {
      const response = await apiClient.post<any>(ENDPOINTS.ROOMS.KICK, {
        roomCode: cleanCode,
        hostId,
        targetUserId,
      });

      const normalized = normalizeRoom(response?.data || response);
      if (normalized) {
        const rooms = this.getStoredRooms();
        rooms[cleanCode] = normalized;
        storage.set(ROOMS_STORAGE_KEY, rooms);
        this.notifySubscribers(cleanCode, normalized);

        const kickSubs = kickedSubscribers.get(cleanCode);
        if (kickSubs) {
          kickSubs.forEach((cb) => {
            try {
              cb(targetUserId, normalized);
            } catch (e) {
              console.error('[roomService] Kicked subscriber error:', e);
            }
          });
        }

        return normalized;
      }
    } catch (err: any) {
      console.warn('[roomService] Backend kick failed, using fallback:', err);
      // Backend BadRequest mesajını veya hata mesajını fırlat
      if (err?.message && !err.message.includes('Network Error')) {
        throw err;
      }
    }

    // Yerel ve Offline Fallback
    const rooms = this.getStoredRooms();
    const room = rooms[cleanCode];
    if (room) {
      room.participants = room.participants.filter((p) => p.user.id !== targetUserId);
      rooms[cleanCode] = room;
      storage.set(ROOMS_STORAGE_KEY, rooms);
      this.notifySubscribers(cleanCode, room);

      const kickSubs = kickedSubscribers.get(cleanCode);
      if (kickSubs) {
        kickSubs.forEach((cb) => {
          try {
            cb(targetUserId, room);
          } catch (e) {
            console.error('[roomService] Local kick subscriber error:', e);
          }
        });
      }
      return room;
    }

    throw new Error('Oyuncu odadan çıkarılamadı.');
  },
};
