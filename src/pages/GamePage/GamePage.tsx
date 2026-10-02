import React, { useEffect } from "react";
import {
  AudioPlayer,
  GuessInput,
  StageControlBar,
  AttemptDots,
  SpotifyEmbed,
  useGameRound,
} from "@/features/game";
import { getAttemptSkipAdd, STAGES } from "@/constants/game";
import type { CreateGameSessionRequest } from "@/types/game";
import styles from "./GamePage.module.css";

interface GamePageProps {
  sessionParams: CreateGameSessionRequest;
  onBackToHome: () => void;
}

export const GamePage: React.FC<GamePageProps> = ({
  sessionParams,
  onBackToHome,
}) => {
  const {
    currentStageIndex,
    currentAttemptIndex,
    currentDuration,
    currentSong,
    isPlaying,
    playbackSeconds,
    playbackRatio,
    feedback,
    isGameOver,
    score,
    potentialPoints,
    lastEarnedPoints,
    isGuessLocked,
    isSongRevealed,
    isLoadingSong,
    startNewGame,
    togglePlay,
    advanceAttempt,
    submitGuess,
    goToNextSong,
  } = useGameRound();

  // Bileşen yüklendiğinde oyun başlatılır
  useEffect(() => {
    startNewGame(sessionParams);
  }, [sessionParams, startNewGame]);

  return (
    <div className={`${styles.gamePageContainer} ${styles.solo}`}>
      {/* Sol / Ana Oyun Bölümü */}
      <div className={styles.gameMainArea}>
        {/* Üst Kontrol & Aşama Barı */}
        <StageControlBar
          currentStageIndex={currentStageIndex}
          currentAttemptIndex={currentAttemptIndex}
          currentDuration={feedback?.isSuccess ? 8.0 : currentDuration}
          playbackSeconds={isSongRevealed ? 0 : playbackSeconds}
          playbackRatio={isSongRevealed ? 0 : playbackRatio}
          isPlaying={isSongRevealed ? false : isPlaying}
          isSolved={Boolean(feedback?.isSuccess)}
          isWrong={Boolean(feedback !== null && !feedback.isSuccess)}
          isSongRevealed={isSongRevealed}
          score={score}
          potentialPoints={potentialPoints}
          lastEarnedPoints={lastEarnedPoints}
          onBackHome={onBackToHome}
        />

        {/* Merkez: Oynat Butonu */}
        <AudioPlayer
          duration={feedback?.isSuccess ? 8.0 : currentDuration}
          isPlaying={isPlaying}
          playbackSeconds={playbackSeconds}
          onTogglePlay={togglePlay}
          feedback={feedback}
          isLoading={isLoadingSong}
          isSongRevealed={isSongRevealed}
          onNextSong={goToNextSong}
          isLastStage={currentStageIndex >= STAGES.length - 1}
        />

        {/* Şarkı Bildirildiğinde / Aşama Bittiğinde Spotify Embed Oynatıcı */}
        {currentSong?.spotifyId && isSongRevealed && (
          <div style={{ width: "100%", maxWidth: "580px", margin: "0.5rem auto" }}>
            <SpotifyEmbed spotifyId={currentSong.spotifyId} compact={true} />
          </div>
        )}

        {/* Alt Kısım: Arama & Tahmin Alanı */}
        <div
          style={{
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <GuessInput
            onGuess={submitGuess}
            onSkip={advanceAttempt}
            disabled={isGuessLocked || isLoadingSong}
            isLoading={isLoadingSong}
            skipLabel={
              getAttemptSkipAdd(currentAttemptIndex)
                ? `Geç ${getAttemptSkipAdd(currentAttemptIndex)}`
                : "Pes Et"
            }
          />
          <AttemptDots currentAttemptIndex={currentAttemptIndex} />
        </div>
      </div>

      {/* Oyun Bittiğinde Tebrik & Skor Kartı */}
      {isGameOver && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.8)",
            backdropFilter: "blur(12px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: "1rem",
          }}
        >
          <div
            style={{
              backgroundColor: "#111827",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              borderRadius: "1.5rem",
              padding: "2.25rem 2rem",
              maxWidth: "28rem",
              width: "100%",
              textAlign: "center",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.8)",
            }}
          >
            <div style={{ fontSize: "3.5rem", marginBottom: "0.5rem" }}>🏆</div>
            <h2
              style={{
                fontSize: "1.75rem",
                fontWeight: 800,
                color: "#ffffff",
                marginBottom: "0.5rem",
              }}
            >
              Oyun Tamamlandı!
            </h2>
            <p
              style={{
                color: "#9ca3af",
                fontSize: "0.875rem",
                marginBottom: "1.5rem",
                lineHeight: 1.5,
              }}
            >
              Tüm aşamaları tamamladın. Harika bir müzik kulağın var!
            </p>
            <div
              style={{
                backgroundColor: "rgba(99, 102, 241, 0.12)",
                border: "1px solid rgba(99, 102, 241, 0.3)",
                borderRadius: "1rem",
                padding: "1.25rem",
                marginBottom: "1.75rem",
              }}
            >
              <span
                style={{
                  fontSize: "0.75rem",
                  color: "#818cf8",
                  fontWeight: 700,
                  display: "block",
                  letterSpacing: "0.05em",
                }}
              >
                TOPLAM PUAN
              </span>
              <span
                className="font-mono-num"
                style={{
                  fontSize: "2.5rem",
                  fontWeight: 900,
                  color: "#ffffff",
                  letterSpacing: "-0.03em",
                }}
              >
                {score.toLocaleString()}
              </span>
            </div>
            <button
              onClick={onBackToHome}
              style={{
                width: "100%",
                padding: "0.875rem",
                borderRadius: "9999px",
                background: "linear-gradient(135deg, #6366f1 0%, #ec4899 100%)",
                border: "none",
                color: "#ffffff",
                fontWeight: 700,
                fontSize: "1rem",
                cursor: "pointer",
                boxShadow: "0 0 25px rgba(99, 102, 241, 0.5)",
                transition: "transform 150ms ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "scale(1.03)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "scale(1)";
              }}
            >
              Ana Sayfaya Dön
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
