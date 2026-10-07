import { apiClient } from './client';
import { ENDPOINTS } from './endpoints';
import { roomService } from './roomService';
import { storage } from '@/utils/storage';
import type { ApiResponse } from '@/types/api';
import type { ChatMessage, SendMessageDto } from '@/types/chat';

const MESSAGES_STORAGE_PREFIX = 'gts_room_messages_';

/**
 * Backend ApiResponse sarmalayıcısından asıl veriyi çıkarır.
 */
function unwrapData<T>(response: ApiResponse<T> | T): T {
  if (response && typeof response === 'object' && 'data' in response && 'success' in response) {
    return (response as ApiResponse<T>).data;
  }
  return response as T;
}

/**
 * İki mesajın aynı olup olmadığını kontrol eder (id eşleşmesi veya aynı gönderici/içerik/zaman).
 */
export function isDuplicateChatMessage(existing: ChatMessage[], newMsg: ChatMessage): boolean {
  return existing.some((m) => {
    if (m.id && newMsg.id && m.id === newMsg.id) {
      return true;
    }
    if (
      String(m.userId) === String(newMsg.userId) &&
      m.message.trim() === newMsg.message.trim()
    ) {
      const timeDiff = Math.abs(new Date(m.timestamp).getTime() - new Date(newMsg.timestamp).getTime());
      if (timeDiff < 3000) {
        return true;
      }
    }
    return false;
  });
}

export const messageService = {
  /**
   * Yerel hafızadaki oda mesajlarını senkron şekilde döner (Anında UI gösterimi için).
   */
  getCachedMessages(roomCode: string): ChatMessage[] {
    const cleanCode = roomCode.toUpperCase().trim();
    return storage.get<ChatMessage[]>(`${MESSAGES_STORAGE_PREFIX}${cleanCode}`, []);
  },

  /**
   * Belirtilen odaya ait mesaj geçmişini MessagesController üzerinden çeker.
   * Örnek: GET /api/messages/getbyroom?roomCode=GTS-1234
   */
  async getMessages(roomCode: string): Promise<ChatMessage[]> {
    const cleanCode = roomCode.toUpperCase().trim();

    try {
      const response = await apiClient.get<ApiResponse<ChatMessage[]> | ChatMessage[]>(
        ENDPOINTS.MESSAGES.GET_BY_ROOM(cleanCode)
      );

      const messages = unwrapData<ChatMessage[]>(response) || [];
      storage.set(`${MESSAGES_STORAGE_PREFIX}${cleanCode}`, messages);
      return messages;
    } catch (err) {
      console.warn(`[messageService] Backend getMessages failed for ${cleanCode}, using local cache:`, err);
      return this.getCachedMessages(cleanCode);
    }
  },

  /**
   * Odaya yeni mesaj gönderir (MessagesController üzerinden).
   * Backend MessagesController mesajı kaydedip WebSocket ile tüm odaya tek seferde dağıtır.
   * Örnek: POST /api/messages/send
   */
  async sendMessage(dto: SendMessageDto): Promise<ChatMessage> {
    const cleanCode = dto.roomCode.toUpperCase().trim();

    try {
      // MessagesController POST endpoint'i
      const response = await apiClient.post<ApiResponse<ChatMessage> | ChatMessage>(
        ENDPOINTS.MESSAGES.SEND,
        {
          roomCode: cleanCode,
          userId: dto.userId,
          userName: dto.userName,
          userAvatarUrl: dto.userAvatarUrl,
          message: dto.message.trim(),
        }
      );

      const created = unwrapData<ChatMessage>(response);

      // Gönderilen mesajı yerel önbelleğe ekle (WebSocket broadcasti ile tekrar eklenmeyecek)
      this.appendMessageToCache(cleanCode, created);

      return created;
    } catch (err: any) {
      console.warn('[messageService] Backend sendMessage failed, falling back to local dispatch:', err);

      // Fallback: Backend erişilemezse yerel mesaj objesi oluştur ve dağıt
      const fallbackMessage: ChatMessage = {
        id: `local_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        roomCode: cleanCode,
        userId: dto.userId,
        userName: dto.userName || 'Oyuncu',
        userAvatarUrl: dto.userAvatarUrl,
        message: dto.message.trim(),
        isHost: false,
        timestamp: new Date().toISOString(),
      };

      this.appendMessageToCache(cleanCode, fallbackMessage);
      roomService.broadcastChatLocally(cleanCode, fallbackMessage);

      return fallbackMessage;
    }
  },

  /**
   * Oda kurucusunun sohbet geçmişini temizlemesini sağlar.
   * Örnek: DELETE /api/messages/clear?roomCode=GTS-1234&hostId=...
   */
  async clearMessages(roomCode: string, hostId: string): Promise<boolean> {
    const cleanCode = roomCode.toUpperCase().trim();

    try {
      await apiClient.delete(ENDPOINTS.MESSAGES.CLEAR(cleanCode, hostId));
      storage.set(`${MESSAGES_STORAGE_PREFIX}${cleanCode}`, []);
      return true;
    } catch (err) {
      console.warn(`[messageService] Failed to clear messages for ${cleanCode}:`, err);
      // Yerelde temizle
      storage.set(`${MESSAGES_STORAGE_PREFIX}${cleanCode}`, []);
      return false;
    }
  },

  /**
   * Canlı mesaj bildirimlerine abone olur (WebSocket & Çoklu sekme).
   */
  subscribeToMessages(roomCode: string, callback: (message: ChatMessage) => void): () => void {
    const cleanCode = roomCode.toUpperCase().trim();

    // Gelen mesajı yerel önbelleğe de kaydet
    return roomService.onChatMessage(cleanCode, (msg) => {
      this.appendMessageToCache(cleanCode, msg);
      callback(msg);
    });
  },

  /**
   * Mesajı önbelleğe ekler (mükerrer kayıt engelli) ve son 200 mesajı korur.
   */
  appendMessageToCache(roomCode: string, message: ChatMessage): void {
    const cleanCode = roomCode.toUpperCase().trim();
    const current = this.getCachedMessages(cleanCode);
    if (!isDuplicateChatMessage(current, message)) {
      const updated = [...current, message].slice(-200);
      storage.set(`${MESSAGES_STORAGE_PREFIX}${cleanCode}`, updated);
    }
  },
};
