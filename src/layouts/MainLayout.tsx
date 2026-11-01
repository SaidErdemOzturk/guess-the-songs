import React from "react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

interface MainLayoutProps {
  children: React.ReactNode;
  onNavigateHome?: () => void;
  onLoginClick?: () => void;
  onCreateRoomClick?: () => void;
  onPlaylistViewerClick?: () => void;
  maxWidth?: string;
  justifyContent?: "center" | "flex-start";
}

export const MainLayout: React.FC<MainLayoutProps> = ({
  children,
  onNavigateHome,
  onLoginClick,
  onCreateRoomClick,
  onPlaylistViewerClick,
  maxWidth = "42rem",
  justifyContent = "flex-start",
}) => {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100dvh",
        position: "relative",
        backgroundColor: "#0b0f19",
        color: "#f9fafb",
        isolation: "isolate",
      }}
    >
      {/* İndigo & Pembe Ambient Işık Efektleri (iOS Safari GPU dostu radial-gradient) */}
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          overflow: "hidden",
          zIndex: 0,
          transform: "translateZ(0)",
          background: [
            "radial-gradient(600px 420px at 50% 60px, rgba(99, 102, 241, 0.20) 0%, rgba(99, 102, 241, 0.06) 50%, rgba(99, 102, 241, 0) 100%)",
            "radial-gradient(550px 340px at 50% calc(100% - 80px), rgba(236, 72, 153, 0.14) 0%, rgba(236, 72, 153, 0.04) 50%, rgba(236, 72, 153, 0) 100%)",
          ].join(", "),
        }}
      />

      <Header
        onTitleClick={onNavigateHome}
        onLoginClick={onLoginClick}
        onCreateRoomClick={onCreateRoomClick}
        onPlaylistViewerClick={onPlaylistViewerClick}
      />

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent,
          width: "100%",
          maxWidth,
          margin: "0 auto",
          padding: justifyContent === "center" ? "0 1rem" : "1.5rem 1rem 3rem",
          position: "relative",
          zIndex: 1,
        }}
      >
        {children}
      </div>

      {/* <Footer /> */}
    </div>
  );
};
