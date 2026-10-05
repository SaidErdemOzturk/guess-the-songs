import React from "react";
import type { Room } from "@/types/room";

interface RoomGameOverModalProps {
  room: Room;
  currentUserId?: string | null;
  score: number;
  onBackToRoom: () => void;
  onBackToHome?: () => void;
}

export const RoomGameOverModal: React.FC<RoomGameOverModalProps> = ({
  room,
  currentUserId,
  score,
  onBackToRoom,
  onBackToHome,
}) => {
  const sortedParticipants = [...room.participants].sort(
    (a, b) => (b.score || 0) - (a.score || 0),
  );
  const winner = sortedParticipants[0];
  const isUserWinner = winner && winner.user.id === currentUserId;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        backdropFilter: "blur(12px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "1rem",
      }}
    >
      <div
        style={{
          backgroundColor: "#111827",
          border: "1px solid rgba(255, 255, 255, 0.15)",
          borderRadius: "1.5rem",
          padding: "2rem",
          maxWidth: "32rem",
          width: "100%",
          textAlign: "center",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.8)",
        }}
      >
        <div style={{ fontSize: "3.25rem", marginBottom: "0.25rem" }}>
          {isUserWinner ? "👑" : "🏆"}
        </div>
        <h2
          style={{
            fontSize: "1.75rem",
            fontWeight: 800,
            color: "#ffffff",
            marginBottom: "0.35rem",
          }}
        >
          {isUserWinner ? "Tebrikler, Kazandın!" : "Oyun Tamamlandı!"}
        </h2>
        <p
          style={{
            color: "#9ca3af",
            fontSize: "0.875rem",
            marginBottom: "1.25rem",
            lineHeight: 1.5,
          }}
        >
          {isUserWinner
            ? "Harika bir performans! Odayı 1. sırada tamamladın."
            : `${winner?.user.name || "Birinci"} odayı zirvede tamamladı!`}
        </p>

        {/* Tüm Kişilerin Puan Sıralaması */}
        {sortedParticipants.length > 0 && (
          <div
            style={{
              backgroundColor: "rgba(0, 0, 0, 0.35)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: "1rem",
              padding: "0.875rem",
              marginBottom: "1.25rem",
              textAlign: "left",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "0.75rem",
                paddingBottom: "0.5rem",
                borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
              }}
            >
              <span
                style={{
                  fontSize: "0.8125rem",
                  fontWeight: 700,
                  color: "#cbd5e1",
                }}
              >
                🏁 Oyuncu Sıralaması ve Puanlar
              </span>
              <span
                style={{
                  fontSize: "0.75rem",
                  color: "#818cf8",
                  fontWeight: 600,
                  backgroundColor: "rgba(99, 102, 241, 0.15)",
                  padding: "0.15rem 0.5rem",
                  borderRadius: "9999px",
                }}
              >
                Oda: {room.code}
              </span>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
                maxHeight: "190px",
                overflowY: "auto",
                paddingRight: "0.25rem",
              }}
            >
              {sortedParticipants.map((p, index) => {
                const isCurrentUser = p.user.id === currentUserId;
                const isFirst = index === 0;
                return (
                  <div
                    key={p.user.id || index}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "0.5rem 0.75rem",
                      borderRadius: "0.625rem",
                      backgroundColor: isFirst
                        ? "rgba(234, 179, 8, 0.12)"
                        : isCurrentUser
                          ? "rgba(99, 102, 241, 0.15)"
                          : "rgba(255, 255, 255, 0.03)",
                      border: isFirst
                        ? "1px solid rgba(234, 179, 8, 0.35)"
                        : isCurrentUser
                          ? "1px solid rgba(99, 102, 241, 0.3)"
                          : "1px solid rgba(255, 255, 255, 0.04)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "0.875rem",
                          fontWeight: 700,
                          width: "1.75rem",
                        }}
                      >
                        {index === 0
                          ? "🥇"
                          : index === 1
                            ? "🥈"
                            : index === 2
                              ? "🥉"
                              : `#${index + 1}`}
                      </span>
                      <div
                        style={{
                          width: "1.75rem",
                          height: "1.75rem",
                          borderRadius: "50%",
                          backgroundColor: isFirst ? "#eab308" : "#4f46e5",
                          color: "#ffffff",
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {p.user.name?.charAt(0).toUpperCase() || "P"}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.35rem",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "0.8125rem",
                            fontWeight: 600,
                            color: isFirst ? "#fef08a" : "#f1f5f9",
                          }}
                        >
                          {p.user.name}
                        </span>
                        {isCurrentUser && (
                          <span
                            style={{
                              fontSize: "0.625rem",
                              padding: "0.1rem 0.35rem",
                              borderRadius: "9999px",
                              backgroundColor: "rgba(99, 102, 241, 0.25)",
                              color: "#a5b4fc",
                              fontWeight: 700,
                            }}
                          >
                            Sen
                          </span>
                        )}
                      </div>
                    </div>

                    <span
                      className="font-mono-num"
                      style={{
                        fontSize: "0.9375rem",
                        fontWeight: 800,
                        color: isFirst ? "#facc15" : "#ffffff",
                      }}
                    >
                      {(p.score || 0).toLocaleString("tr-TR")} P
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <button
          onClick={onBackToRoom || onBackToHome}
          id="btn-back-to-room"
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
          <i className="fa-solid fa-door-open" style={{ marginRight: "0.5rem" }} />
          Odaya Dön
        </button>
      </div>
    </div>
  );
};
