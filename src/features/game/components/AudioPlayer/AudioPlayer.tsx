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
          <span>Şarkı çalıyor · İstediğin an sonraki şarkıya geçebilirsin</span>
          <span
            className="font-mono-num"
            style={{
              color: isPlaying ? "#34d399" : "#9ca3af",
              fontWeight: 700,
              marginLeft: "0.25rem",
            }}
          >
            {playbackSeconds.toFixed(1)}s
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
            <button
              onClick={onNextSong}
              disabled={isLoading}
              id="btn-next-song"
              style={{
                position: "relative",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.625rem",
                padding: "0.875rem 2rem",
                borderRadius: "9999px",
                background: feedback?.isSuccess
                  ? "linear-gradient(135deg, #10b981 0%, #6366f1 100%)"
                  : "linear-gradient(135deg, #6366f1 0%, #ec4899 100%)",
                border: feedback?.isSuccess
                  ? "1px solid rgba(52, 211, 153, 0.5)"
                  : "1px solid rgba(236, 72, 153, 0.5)",
                boxShadow: feedback?.isSuccess
                  ? "0 0 25px rgba(16, 185, 129, 0.5), 0 4px 20px rgba(0, 0, 0, 0.4)"
                  : "0 0 25px rgba(99, 102, 241, 0.5), 0 4px 20px rgba(0, 0, 0, 0.4)",
                color: "#ffffff",
                fontSize: "1.0625rem",
                fontWeight: 700,
                letterSpacing: "0.01em",
                cursor: isLoading ? "wait" : "pointer",
                transition: "all 200ms cubic-bezier(0.4, 0, 0.2, 1)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "scale(1.04)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "scale(1)";
              }}
            >
              <i
                className="fa-solid fa-forward-step"
                style={{ fontSize: "1.125rem" }}
              />
              <span>{isLastStage ? "Oyunu Bitir" : "Sonraki Şarkıya Geç"}</span>
              <i
                className="fa-solid fa-arrow-right"
                style={{ fontSize: "0.875rem", opacity: 0.85 }}
              />
            </button>
          </div>
        ) : (
          /* Normal Oyun Deneme Durumu: Büyük Yuvarlak Oynat Butonu */
          <>
            <button
              onClick={onTogglePlay}
              disabled={isLoading}
              id="btn-play-audio"
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
