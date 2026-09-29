import React from "react";
import type { FeedbackState } from "../../hooks/useGameRound";

interface AudioPlayerProps {
  duration: number;
  isPlaying: boolean;
  playbackSeconds: number;
  onTogglePlay: () => void;
  feedback: FeedbackState | null;
  isLoading?: boolean;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  duration,
  isPlaying,
  playbackSeconds,
  onTogglePlay,
  feedback,
  isLoading = false,
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
      {/* Oynat Butonu Sahne Ortasında, Süre Göstergesi Butonun Yanında */}
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
        }}
      >
        {/* Büyük Yuvarlak İndigo-Pembe Oynat Butonu (Tam Ortada) */}
        <button
          onClick={onTogglePlay}
          disabled={isLoading}
          style={{
            position: "relative",
            width: "6.5rem",
            height: "6.5rem",
            borderRadius: "9999px",
            background: isLoading
              ? "rgba(31, 41, 55, 0.85)"
              : "linear-gradient(135deg, #6366f1 0%, #ec4899 100%)",
            border: isLoading ? "2px solid rgba(99, 102, 241, 0.4)" : "none",
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

        {/* Canlı Süre Göstergesi (Start butonunu kaydırmadan bağımsız olarak sağında durur) */}
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
      </div>

      {/* Doğru/Yanlış Alert Kutusu */}
      {feedback && (
        <div
          style={{
            marginTop: "0.75rem",
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
