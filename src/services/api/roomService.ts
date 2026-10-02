import { apiClient } from './client';
import { ENDPOINTS } from './endpoints';
import { env } from '@/config/env';
import { storage } from '@/utils/storage';
import type { User } from '@/types/auth';
import type { CreateRoomRequest, Room, RoomParticipant, RoomStatus } from '@/types/room';
import type { Song } from '@/types/song';

const ROOMS_STORAGE_KEY = 'gts_active_rooms';

export interface RoomWebSocketMessage<T = unknown> {
  type:
    | 'ROOM_STATE'
    | 'ROOM_UPDATED'
    | 'SCORE_UPDATED'
    | 'PARTICIPANT_JOINED'
    | 'PARTICIPANT_LEFT'
    | 'STATUS_CHANGED'
    | 'SONG_CHANGED'
    | 'PONG';
  roomCode?: string;
  data?: T;
  timestamp?: string;
}

type RoomSubscriptionCallback = (room: Room) => void;
type SongChangeCallback = (song: Song, round: number) => void;

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

export const roomService = {
  /**
   * Yerel önbellekteki odaları döner (Fallback & Offline destek)
   */
  getStoredRooms(): Record<string, Room> {
    return storage.get<Record<string, Room>>(ROOMS_STORAGE_KEY, {});
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

    if (!activeWebSocket || currentConnectedCode !== cleanCode) {
      this.connectWebSocket(cleanCode);
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

    if (!activeWebSocket || currentConnectedCode !== cleanCode) {
      this.connectWebSocket(cleanCode);
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
      const wsUrl = buildWebSocketUrl(cleanCode, user?.id, user?.name);
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
            const songPayload = msg.data as { song: Song; round: number; startedAt?: string };
            if (songPayload?.song) {
              const rooms = this.getStoredRooms();
              const current = rooms[cleanCode];
              if (current) {
                current.currentSong = songPayload.song;
                current.currentRound = songPayload.round || current.currentRound || 1;
                current.currentRoundStartedAt = songPayload.startedAt || new Date().toISOString();
                rooms[cleanCode] = current;
                storage.set(ROOMS_STORAGE_KEY, rooms);

                const subscribers = roomSubscribers.get(cleanCode);
                if (subscribers) {
                  subscribers.forEach((cb) => cb(current));
                }
              }

              const songSubs = songSubscribers.get(cleanCode);
              if (songSubs) {
                songSubs.forEach((cb) => {
                  try {
                    cb(songPayload.song, songPayload.round || 1);
                  } catch (e) {
                    console.error('[roomService] Song subscriber callback error:', e);
                  }
                });
              }
            }
            return;
          }

          if (
            msg.type === 'ROOM_STATE' ||
            msg.type === 'ROOM_UPDATED' ||
            msg.type === 'SCORE_UPDATED' ||
            msg.type === 'PARTICIPANT_JOINED'
          ) {
            const updatedRoom = unwrapData<Room>(msg.data);
            if (updatedRoom && updatedRoom.code) {
              const rooms = this.getStoredRooms();
              rooms[cleanCode] = updatedRoom;
              storage.set(ROOMS_STORAGE_KEY, rooms);

              // Abone olan tüm bileşenlere canlı oda güncellemesi dağıt
              const subscribers = roomSubscribers.get(cleanCode);
              if (subscribers) {
                subscribers.forEach((cb) => {
                  try {
                    cb(updatedRoom);
                  } catch (e) {
                    console.error('[roomService] Subscriber callback error:', e);
                  }
                });
              }

              // Eğer odanın currentSong alanı güncellendiyse şarkı abonelerine de ilet
              if (updatedRoom.currentSong) {
                const songSubs = songSubscribers.get(cleanCode);
                if (songSubs) {
                  songSubs.forEach((cb) => cb(updatedRoom.currentSong!, updatedRoom.currentRound || 1));
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
      };

      return ws;
    } catch (err) {
      console.warn('[roomService] Failed to initialize WebSocket:', err);
      return null;
    }
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

    // 1. WebSocket üzerinden tüm odaya anında fırlat
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
            },
          })
        );
      } catch (wsErr) {
        console.warn('[roomService] Failed to send SET_SONG via WebSocket:', wsErr);
      }
    }

    // 2. REST API ile odaya şarkıyı kaydet ve senkronize et
    try {
      const response = await apiClient.post<Room | { success: boolean; data: Room }>(
        ENDPOINTS.ROOMS.SET_CURRENT_SONG,
        {
          roomCode: cleanCode,
          songId: song.id,
          songData: song,
          round,
        }
      );

      const updatedRoom = unwrapData<Room | null>(response);
      if (updatedRoom && updatedRoom.code) {
        const rooms = this.getStoredRooms();
        rooms[cleanCode] = updatedRoom;
        storage.set(ROOMS_STORAGE_KEY, rooms);
        return updatedRoom;
      }
    } catch (err) {
      console.warn('[roomService] Backend setCurrentSong failed, fallback to local storage:', err);
    }

    // Fallback: Yerel depoda şarkıyı güncelle
    const rooms = this.getStoredRooms();
    const room = rooms[cleanCode];
    if (room) {
      room.currentSong = song;
      room.currentRound = round;
      room.currentRoundStartedAt = new Date().toISOString();
      rooms[cleanCode] = room;
      storage.set(ROOMS_STORAGE_KEY, rooms);

      const subscribers = roomSubscribers.get(cleanCode);
      if (subscribers) {
        subscribers.forEach((cb) => cb(room));
      }

      const songSubs = songSubscribers.get(cleanCode);
      if (songSubs) {
        songSubs.forEach((cb) => cb(song, round));
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

      const createdRoom = unwrapData<Room>(response);
      if (createdRoom && createdRoom.code) {
        const rooms = this.getStoredRooms();
        rooms[createdRoom.code.toUpperCase()] = createdRoom;
        storage.set(ROOMS_STORAGE_KEY, rooms);

        // Odayı kurduktan sonra hemen WebSocket dinleyicisini bağla
        this.connectWebSocket(createdRoom.code, hostUser);

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

      const room = unwrapData<Room | null>(response);
      if (room && room.code) {
        const rooms = this.getStoredRooms();
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

      const joinedRoom = unwrapData<Room>(response);
      if (joinedRoom && joinedRoom.code) {
        const rooms = this.getStoredRooms();
        rooms[cleanCode] = joinedRoom;
        storage.set(ROOMS_STORAGE_KEY, rooms);

        // Katıldıktan sonra odaya ait WebSocket'i dinle
        this.connectWebSocket(cleanCode, user);

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
        isReady: false,
        score: 0,
        joinedAt: new Date().toISOString(),
      });
    }

    rooms[cleanCode] = targetRoom;
    storage.set(ROOMS_STORAGE_KEY, rooms);

    return targetRoom;
  },

  /**
   * Oyuncunun kazandığı puanı ve süreyi odaya aktarır (WebSocket öncelikli, REST fallback)
   */
  async updateParticipantScore(
    roomCode: string,
    userId: string,
    pointsEarned: number,
    duration: number
  ): Promise<Room | null> {
    const cleanCode = roomCode.toUpperCase().trim();

    // 1. Öncelik: Aktif WebSocket varsa sıfır gecikmeyle anında gönder!
    if (activeWebSocket && activeWebSocket.readyState === WebSocket.OPEN && currentConnectedCode === cleanCode) {
      try {
        activeWebSocket.send(
          JSON.stringify({
            type: 'UPDATE_SCORE',
            payload: {
              roomCode: cleanCode,
              userId,
              pointsEarned,
              duration,
            },
          })
        );
      } catch (wsErr) {
        console.warn('[roomService] Failed to send score via WebSocket, falling back to REST:', wsErr);
      }
    }

    // 2. REST API çağrısı ile veritabanını güncelle ve garantile
    const payload = {
      roomCode: cleanCode,
      userId,
      pointsEarned,
      duration,
    };

    try {
      const response = await apiClient.post<Room | { success: boolean; data: Room }>(
        ENDPOINTS.ROOMS.UPDATE_SCORE,
        payload
      );

      const updatedRoom = unwrapData<Room | null>(response);
      if (updatedRoom && updatedRoom.code) {
        const rooms = this.getStoredRooms();
        rooms[cleanCode] = updatedRoom;
        storage.set(ROOMS_STORAGE_KEY, rooms);
        return updatedRoom;
      }
    } catch (err) {
      console.warn(`[roomService] Backend updateParticipantScore failed, fallback to local:`, err);
    }

    // Fallback: Yerel depoda skor güncelle
    const rooms = this.getStoredRooms();
    const room = rooms[cleanCode];
    if (!room) return null;

    const participant = room.participants.find((p) => p.user.id === userId);
    if (participant) {
      participant.score = (participant.score || 0) + pointsEarned;
      participant.lastPointsEarned = pointsEarned;
      participant.lastGuessDuration = duration;
    }

    room.participants.sort((a, b) => (b.score || 0) - (a.score || 0));
    rooms[cleanCode] = room;
    storage.set(ROOMS_STORAGE_KEY, rooms);

    return room;
  },

  /**
   * Oda durumunu günceller (waiting, in_game, finished)
   */
  async changeRoomStatus(roomCode: string, status: RoomStatus): Promise<boolean> {
    const cleanCode = roomCode.toUpperCase().trim();

    if (activeWebSocket && activeWebSocket.readyState === WebSocket.OPEN && currentConnectedCode === cleanCode) {
      try {
        activeWebSocket.send(
          JSON.stringify({
            type: 'CHANGE_STATUS',
            payload: { roomCode: cleanCode, status },
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
      const room = await this.getRoomByCode(cleanCode);
      return room?.participants || [];
    }
  },

  /**
   * İnsanları davet edecek benzersiz bağlantı linki üretir
   */
  generateInviteLink(roomCode: string): string {
    const origin = window.location.origin;
    const pathname = window.location.pathname;
    return `${origin}${pathname}?room=${encodeURIComponent(roomCode)}`;
  },
};
