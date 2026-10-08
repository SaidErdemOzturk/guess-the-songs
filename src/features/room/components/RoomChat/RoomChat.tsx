import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  messageService,
  isDuplicateChatMessage,
} from "@/services/api/messageService";
import type { ChatMessage } from "@/types/chat";
import styles from "./RoomChat.module.css";

interface RoomChatProps {
  roomCode: string;
  currentUserId: string;
  currentUserName?: string;
  currentUserAvatarUrl?: string;
  isHost?: boolean;
  height?: string | number;
  onUnreadCountChange?: (count: number) => void;
}

const QUICK_TAGS = [
  "👋 Selam",
  "🔥 Çok iyi!",
  "🎵 Biliyorum!",
  "🤔 Zor oldu",
  "⚡ Hızlı olun!",
];

export const RoomChat: React.FC<RoomChatProps> = ({
  roomCode,
  currentUserId,
  currentUserName = "Oyuncu",
  currentUserAvatarUrl,
  isHost = false,
  height,
  onUnreadCountChange,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    messageService.getCachedMessages(roomCode),
  );
  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [showScrollDown, setShowScrollDown] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isAutoScrollRef = useRef(true);

  const scrollToBottom = useCallback((smooth = true) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({
        behavior: smooth ? "smooth" : "auto",
      });
    }
  }, []);

  // Mesaj geçmişini çek ve canlı yayın aboneliğini başlat
  useEffect(() => {
    let isMounted = true;

    // 1. Backend'den mesaj geçmişini çek
    messageService.getMessages(roomCode).then((fetched) => {
      if (isMounted && fetched.length > 0) {
        setMessages((prev) => {
          // İki listeyi id'ye göre birleştir ve sırala
          const map = new Map<string, ChatMessage>();
          prev.forEach((m) => map.set(m.id, m));
          fetched.forEach((m) => map.set(m.id, m));
          const sorted = Array.from(map.values()).sort(
            (a, b) =>
              new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
          );
          return sorted;
        });
        setTimeout(() => scrollToBottom(false), 50);
      }
    });

    // 2. Canlı WebSocket ve sekme aboneliği
    const unsubscribe = messageService.subscribeToMessages(
      roomCode,
      (newMsg) => {
        if (!isMounted) return;

        setMessages((prev) => {
          if (isDuplicateChatMessage(prev, newMsg)) {
            return prev;
          }
          return [...prev, newMsg];
        });

        if (isAutoScrollRef.current) {
          setTimeout(() => scrollToBottom(true), 50);
        } else {
          setShowScrollDown(true);
        }
      },
    );

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [roomCode, scrollToBottom]);

  // Liste scroll durumunu takip et
  const handleScroll = () => {
    if (!listContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = listContainerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 60;
    isAutoScrollRef.current = isAtBottom;
    if (isAtBottom && showScrollDown) {
      setShowScrollDown(false);
    }
  };

  // Mesaj Gönderme
  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || isSending || !roomCode || !currentUserId) return;

    try {
      setIsSending(true);
      setInputText("");
      inputRef.current?.focus();

      const sent = await messageService.sendMessage({
        roomCode,
        userId: currentUserId,
        userName: currentUserName,
        userAvatarUrl: currentUserAvatarUrl,
        message: text,
      });

      setMessages((prev) => {
        if (isDuplicateChatMessage(prev, sent)) return prev;
        return [...prev, sent];
      });

      setShowScrollDown(false);
      isAutoScrollRef.current = true;
      setTimeout(() => scrollToBottom(true), 30);
    } catch (err) {
      console.error("[RoomChat] Failed to send message:", err);
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleClearChat = async () => {
    if (!isHost) return;
    const confirmed = window.confirm(
      "Odadaki tüm mesaj geçmişini temizlemek istediğinize emin misiniz?",
    );
    if (!confirmed) return;

    await messageService.clearMessages(roomCode, currentUserId);
    setMessages([]);
  };

  const formatTime = (isoString?: string) => {
    if (!isoString) return "";
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  };

  return (
    <div
      className={styles.chatContainer}
      style={
        height ? { height, maxHeight: height, minHeight: height } : undefined
      }
    >
      {/* Üst Başlık */}
      <div className={styles.chatHeader}>
        <div className={styles.headerTitleGroup}>
          <span className={styles.headerIcon}>💬</span>
          <h3 className={styles.headerTitle}>Oda Sohbeti</h3>
          <span className={styles.liveBadge}>
            <span className={styles.liveDot} />
            Canlı
          </span>
        </div>

        {isHost && messages.length > 0 && (
          <button
            type="button"
            className={styles.clearBtn}
            onClick={handleClearChat}
            title="Sohbet geçmişini temizle"
          >
            <i className="fa-solid fa-trash-can" />
            <span>Temizle</span>
          </button>
        )}
      </div>

      {/* Mesajlar Listesi */}
      <div
        className={styles.messagesList}
        ref={listContainerRef}
        onScroll={handleScroll}
      >
        {messages.length === 0 ? (
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon}>💭</span>
            <p className={styles.emptyText}>Henüz hiç mesaj gönderilmedi</p>
            <p className={styles.emptySubText}>
              Odadaki diğer oyuncularla sohbet etmek için ilk mesajı sen yaz!
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isOwn = String(msg.userId) === String(currentUserId);

            return (
              <div
                key={msg.id}
                className={`${styles.messageRow} ${
                  isOwn ? styles.messageRowOwn : styles.messageRowOther
                }`}
              >
                {/* Avatar */}
                <div className={styles.avatar}>
                  {msg.userAvatarUrl ? (
                    <img
                      src={msg.userAvatarUrl}
                      alt={msg.userName}
                      className={styles.avatarImg}
                    />
                  ) : (
                    <span>{(msg.userName || "P").charAt(0).toUpperCase()}</span>
                  )}
                </div>

                {/* Balon ve Meta */}
                <div className={styles.bubbleContainer}>
                  <div className={styles.messageMeta}>
                    <span className={styles.senderName}>
                      {isOwn ? "Sen" : msg.userName}
                    </span>
                    {msg.isHost && (
                      <span className={styles.senderHostBadge}>👑 Kurucu</span>
                    )}
                    <span className={styles.timestamp}>
                      {formatTime(msg.timestamp)}
                    </span>
                  </div>

                  <div
                    className={`${styles.messageBubble} ${
                      isOwn ? styles.bubbleOwn : styles.bubbleOther
                    }`}
                  >
                    {msg.message}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Aşağı Kaydır Butonu */}
      {showScrollDown && (
        <button
          type="button"
          className={styles.scrollDownBtn}
          onClick={() => {
            scrollToBottom(true);
            setShowScrollDown(false);
          }}
        >
          <span>↓ Yeni Mesaj</span>
        </button>
      )}

      {/* Hızlı İfade / Çerez Tepki Butonları */}
      <div className={styles.quickTags}>
        {QUICK_TAGS.map((tag) => (
          <button
            key={tag}
            type="button"
            className={styles.quickTagBtn}
            onClick={() => handleSendMessage(tag)}
            disabled={isSending}
          >
            {tag}
          </button>
        ))}
      </div>

      {/* Mesaj Yazma Formu */}
      <form
        className={styles.inputForm}
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
      >
        <input
          ref={inputRef}
          type="text"
          className={styles.textInput}
          placeholder="Mesajını yaz..."
          value={inputText}
          maxLength={300}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button
          type="submit"
          className={styles.sendBtn}
          disabled={!inputText.trim() || isSending}
          title="Gönder"
        >
          <i className="fa-solid fa-paper-plane" />
        </button>
      </form>
    </div>
  );
};
