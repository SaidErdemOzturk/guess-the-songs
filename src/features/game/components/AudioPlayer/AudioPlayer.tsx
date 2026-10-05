import React from "react";
import type { FeedbackState } from "../../hooks/useGameRound";

interface AudioPlayerProps {
  duration: number;
  isPlaying: boolean;
  playbackSeconds: number;
  onTogglePlay: () => void;
  feedback: FeedbackState | null;
  isLoading?: boolean;
  isSongRevealed?: boolean;
  onNextSong?: () => void;
  isLastStage?: boolean;
  isRoomMode?: boolean;
  isHost?: boolean;
  canSkip?: boolean;
  skipWaitingReason?: string;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  duration,
  isPlaying,
  playbackSeconds,
  onTogglePlay,
  feedback,
  isLoading = false,
  isSongRevealed = false,
  onNextSong,
  isLastStage = false,
  isRoomMode = false,
  isHost = true,
  canSkip = true,
  skipWaitingReason,
}) => {
  const displayTime = isPlaying
    ? `${playbackSeconds.toFixed(1)}s`
    : playbackSeconds > 0
      ? `${playbackSeconds.toFixed(1)}s`
      : `${duration}s`;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        margin: "auto 0",
        padding: "0.5rem 0",
      }}
    >
      {/* Şarkı bilindiğinde / pes edildiğinde: Sürekli çalma durumu bilgilendirmesi */}
      {isSongRevealed && (
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            marginBottom: "0.75rem",
            padding: "0.35rem 0.875rem",
            borderRadius: "9999px",
            backgroundColor: "rgba(17, 24, 39, 0.75)",
            backdropFilter: "blur(8px)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            fontSize: "0.8125rem",
            color: "#c7d2fe",
          }}
        >
          <i
            className="fa-solid fa-compact-disc fa-spin"
            style={{
              color: isPlaying ? "#34d399" : "#9ca3af",
              fontSize: "0.9375rem",
              animationDuration: isPlaying ? "3s" : "0s",
            }}
          />
          <span>
            {isRoomMode
              ? isHost
                ? canSkip
                  ? "Tüm oyuncular tahminini tamamladı · Sonraki şarkıya geçebilirsin"
                  : "Diğer oyuncuların tahmini bekleniyor..."
                : "Şarkı çalıyor · Oda sahibinin sıradaki şarkıya geçmesi bekleniyor"
              : "Şarkı çalıyor · İstediğin an sonraki şarkıya geçebilirsin"}
          </span>
        </div>
      )}

      {/* Oynat Butonu Sahne Ortasında (veya Bilindiğinde/Pes Edildiğinde Sonraki Şarkıya Geç Butonu) */}
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
        }}
      >
        {isSongRevealed ? (
          /* Şarkı Bilindiğinde veya Pes Edildiğinde: "Sonraki Şarkıya Geç" Buton Grubu */
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.75rem",
              zIndex: 10,
            }}
          >
            {isRoomMode && !isHost ? (
              /* Oda Modunda Oda Sahibi Olmayan Kullanıcılar için Bekleme Rozeti */
              <div
                id="btn-waiting-host"
                style={{
                  position: "relative",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.625rem",
                  padding: "0.875rem 2rem",
                  borderRadius: "9999px",
                  background: "rgba(30, 41, 59, 0.85)",
                  border: "1px solid rgba(99, 102, 241, 0.35)",
                  boxShadow: "0 4px 20px rgba(0, 0, 0, 0.35)",
                  color: "#c7d2fe",
                  fontSize: "1rem",
                  fontWeight: 600,
                  letterSpacing: "0.01em",
                }}
              >
                <i
                  className="fa-solid fa-hourglass-half fa-spin"
                  style={{
                    color: "#818cf8",
                    fontSize: "1.125rem",
                    animationDuration: "3s",
                  }}
                />
                <span>
                  {skipWaitingReason ||
                    "Oda sahibinin sıradaki şarkıya geçmesi bekleniyor..."}
                </span>
              </div>
            ) : (
              /* Tek Oyunculu veya Oda Sahibi için Buton */
              <button
                onClick={onNextSong}
                disabled={isLoading || (isRoomMode && !canSkip)}
                id="btn-next-song"
                style={{
                  position: "relative",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.625rem",
                  padding: "0.875rem 2rem",
                  borderRadius: "9999px",
                  background:
                    isRoomMode && !canSkip
                      ? "rgba(55, 65, 81, 0.85)"
                      : feedback?.isSuccess
                        ? "linear-gradient(135deg, #10b981 0%, #6366f1 100%)"
                        : "linear-gradient(135deg, #6366f1 0%, #ec4899 100%)",
                  border:
                    isRoomMode && !canSkip
                      ? "1px solid rgba(156, 163, 175, 0.3)"
                      : feedback?.isSuccess
                        ? "1px solid rgba(52, 211, 153, 0.5)"
                        : "1px solid rgba(236, 72, 153, 0.5)",
                  boxShadow:
                    isRoomMode && !canSkip
                      ? "0 4px 15px rgba(0, 0, 0, 0.3)"
                      : feedback?.isSuccess
                        ? "0 0 25px rgba(16, 185, 129, 0.5), 0 4px 20px rgba(0, 0, 0, 0.4)"
                        : "0 0 25px rgba(99, 102, 241, 0.5), 0 4px 20px rgba(0, 0, 0, 0.4)",
                  color: isRoomMode && !canSkip ? "#9ca3af" : "#ffffff",
                  fontSize: "1.0625rem",
                  fontWeight: 700,
                  letterSpacing: "0.01em",
                  cursor:
                    isLoading || (isRoomMode && !canSkip)
                      ? "not-allowed"
                      : "pointer",
                  transition: "all 200ms cubic-bezier(0.4, 0, 0.2, 1)",
                  opacity: isRoomMode && !canSkip ? 0.8 : 1,
                }}
                onMouseEnter={(e) => {
                  if (!isRoomMode || canSkip) {
                    e.currentTarget.style.transform = "scale(1.04)";
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "scale(1)";
                }}
                title={
                  isRoomMode && !canSkip
                    ? skipWaitingReason || "Tüm oyuncuların tahmini bekleniyor"
                    : undefined
                }
              >
                <i
                  className={
                    isRoomMode && !canSkip
                      ? "fa-solid fa-spinner fa-spin"
                      : "fa-solid fa-forward-step"
                  }
                  style={{ fontSize: "1.125rem" }}
                />
                <span>
                  {isRoomMode && !canSkip
                    ? skipWaitingReason || "Oyuncuların tahmini bekleniyor..."
                    : isLastStage
                      ? "Oyunu Bitir"
                      : "Sonraki Şarkıya Geç"}
                </span>
                {(!isRoomMode || canSkip) && (
                  <i
                    className="fa-solid fa-arrow-right"
                    style={{ fontSize: "0.875rem", opacity: 0.85 }}
                  />
                )}
              </button>
            )}
          </div>
        ) : isRoomMode && !isHost && isLoading ? (
          <div
            id="btn-waiting-host-song"
            style={{
              position: "relative",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.625rem",
              padding: "0.875rem 2rem",
              borderRadius: "9999px",
              background: "rgba(30, 41, 59, 0.85)",
              border: "1px solid rgba(99, 102, 241, 0.35)",
              boxShadow: "0 4px 20px rgba(0, 0, 0, 0.35)",
              color: "#c7d2fe",
              fontSize: "1rem",
              fontWeight: 600,
            }}
          >
            <i
              className="fa-solid fa-spinner fa-spin"
              style={{ color: "#818cf8", fontSize: "1.125rem" }}
            />
            <span>Oda sahibinin şarkıyı başlatması bekleniyor...</span>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onTogglePlay();
              }}
              disabled={isLoading}
              id="btn-play-audio"
              aria-label={
                isLoading
                  ? "Şarkı hazırlanıyor..."
                  : isPlaying
                    ? "Şarkıyı Durdur"
                    : "Şarkıyı Çal"
              }
              title={
                isLoading ? "Şarkı hazırlanıyor, lütfen bekleyin..." : undefined
              }
              style={{
                position: "relative",
                width: "6.5rem",
                height: "6.5rem",
                borderRadius: "9999px",
                background: isLoading
                  ? "rgba(31, 41, 55, 0.85)"
                  : "linear-gradient(135deg, #6366f1 0%, #ec4899 100%)",
                border: isLoading
                  ? "2px solid rgba(99, 102, 241, 0.4)"
                  : "none",
                boxShadow: isLoading
                  ? "0 0 15px rgba(99, 102, 241, 0.2)"
                  : isPlaying
                    ? "0 0 35px rgba(99, 102, 241, 0.7), 0 0 60px rgba(236, 72, 153, 0.4)"
                    : "0 4px 20px rgba(99, 102, 241, 0.45)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: isLoading ? "wait" : "pointer",
                opacity: isLoading ? 0.75 : 1,
                transition: "all 200ms ease",
                transform: isPlaying ? "scale(1.05)" : "scale(1)",
              }}
            >
              {isPlaying && (
                <span
                  className="pulse-effect"
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: "9999px",
                    background: "linear-gradient(135deg, #6366f1, #ec4899)",
                    pointerEvents: "none",
                  }}
                />
              )}
              {isLoading ? (
                <i
                  className="fa-solid fa-spinner fa-spin"
                  style={{
                    color: "#818cf8",
                    fontSize: "1.75rem",
                    position: "relative",
                    zIndex: 2,
                  }}
                />
              ) : (
                <i
                  className={`fa-solid ${isPlaying ? "fa-pause" : "fa-play"}`}
                  style={{
                    color: "#ffffff",
                    fontSize: "1.75rem",
                    marginLeft: isPlaying ? "0" : "0.25rem",
                    transition: "transform 200ms ease",
                    position: "relative",
                    zIndex: 2,
                  }}
                />
              )}
            </button>

            {/* Canlı Süre Göstergesi (Normal deneme aşamasında butonun sağında durur) */}
            <div
              style={{
                position: "absolute",
                left: "calc(50% + 4.5rem)",
                display: "flex",
                alignItems: "center",
                pointerEvents: "none",
              }}
            >
              <span
                className="font-mono-num"
                style={{
                  fontSize: "2rem",
                  fontWeight: 800,
                  color: isLoading ? "#6b7280" : "#818cf8",
                  letterSpacing: "-0.05em",
                  filter: isLoading
                    ? "none"
                    : "drop-shadow(0 0 10px rgba(99, 102, 241, 0.4))",
                  minWidth: "4.5rem",
                  transition: "color 200ms ease",
                }}
              >
                {displayTime}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Doğru/Yanlış Alert Kutusu */}
      {feedback && (
        <div
          style={{
            marginTop: "0.875rem",
            padding: "0.5rem 1rem",
            borderRadius: "0.75rem",
            fontSize: "0.8125rem",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            backgroundColor: feedback.isSuccess
              ? "rgba(16, 185, 129, 0.2)"
              : "rgba(239, 68, 68, 0.2)",
            color: feedback.isSuccess ? "#34d399" : "#f87171",
            border: feedback.isSuccess
              ? "1px solid rgba(16, 185, 129, 0.4)"
              : "1px solid rgba(239, 68, 68, 0.4)",
          }}
        >
          <i
            className={`fa-solid ${feedback.isSuccess ? "fa-circle-check" : "fa-circle-xmark"}`}
          />
          <span>{feedback.message}</span>
        </div>
      )}
    </div>
  );
};
