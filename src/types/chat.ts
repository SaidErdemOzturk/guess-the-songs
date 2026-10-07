/**
 * Oda İçi Sohbet ve Mesajlaşma Tipleri (MessagesController ile eşleşen DTO'lar)
 */

export interface ChatMessage {
  id: string;
  roomCode: string;
  userId: string;
  userName: string;
  userAvatarUrl?: string;
  message: string;
  isHost?: boolean;
  timestamp: string;
}

export interface SendMessageDto {
  roomCode: string;
  userId: string;
  userName?: string;
  userAvatarUrl?: string;
  message: string;
}
