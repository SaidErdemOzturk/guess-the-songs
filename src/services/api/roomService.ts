import { storage } from '@/utils/storage';
import type { User } from '@/types/auth';
import type { CreateRoomRequest, Room } from '@/types/room';

const ROOMS_STORAGE_KEY = 'gts_active_rooms';

export const roomService = {
  /**
   * Tüm odaları döner (Mock depolama)
   */
  getStoredRooms(): Record<string, Room> {
    return storage.get<Record<string, Room>>(ROOMS_STORAGE_KEY, {});
  },

  /**
   * Yeni bir oda kurar (Sadece token sahibi kullanıcılar kurabilir)
   */
  async createRoom(request: CreateRoomRequest, hostUser: User, token: string): Promise<Room> {
    if (!token) {
      throw new Error('Oda kurabilmek için giriş yapmış olmanız (token) gerekmektedir.');
    }

    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const roomCode = `GTS-${randomSuffix}`;

    const newRoom: Room = {
      id: `room_${Date.now()}`,
      code: roomCode,
      name: request.name.trim() || `${hostUser.name}'in Odası`,
      hostId: hostUser.id,
      hostName: hostUser.name,
      status: 'waiting',
      maxParticipants: request.maxParticipants || 8,
      settings: request.settings || {
        region: 'tr',
        genre: 'all',
        era: 'all',
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
    rooms[roomCode] = newRoom;
    storage.set(ROOMS_STORAGE_KEY, rooms);

    return newRoom;
  },

  /**
   * Oda koduna göre odayı bulur
   */
  async getRoomByCode(roomCode: string): Promise<Room | null> {
    const rooms = this.getStoredRooms();
    return rooms[roomCode.toUpperCase().trim()] || null;
  },

  /**
   * Davet linki veya kod ile odaya katılır (TOKEN ZORUNLUDUR!)
   */
  async joinRoom(roomCode: string, user: User, token: string): Promise<Room> {
    if (!token) {
      throw new Error('Odaya katılabilmek için giriş yapmalı (token sahibi) olmalısınız.');
    }

    const cleanCode = roomCode.toUpperCase().trim();
    const rooms = this.getStoredRooms();
    let targetRoom = rooms[cleanCode];

    // Eğer oda henüz hafızada yoksa otomatik mock oda oluştur (demo kolaylığı için)
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

    // Katılımcı zaten odada mı?
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
   * Oyuncunun kazandığı puanı ve hangi sürede bildiğini odaya kaydeder
   */
  updateParticipantScore(
    roomCode: string,
    userId: string,
    pointsEarned: number,
    duration: number
  ): Room | null {
    const cleanCode = roomCode.toUpperCase().trim();
    const rooms = this.getStoredRooms();
    const room = rooms[cleanCode];

    if (!room) return null;

    const participant = room.participants.find((p) => p.user.id === userId);
    if (participant) {
      participant.score = (participant.score || 0) + pointsEarned;
      participant.lastPointsEarned = pointsEarned;
      participant.lastGuessDuration = duration;
    }

    // Puan durumunu puana göre azalan sırada diz (Liderlik tablosu)
    room.participants.sort((a, b) => (b.score || 0) - (a.score || 0));

    rooms[cleanCode] = room;
    storage.set(ROOMS_STORAGE_KEY, rooms);

    return room;
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
