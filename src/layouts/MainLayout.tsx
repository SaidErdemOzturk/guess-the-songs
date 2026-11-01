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
        minHeight: "100vh",
        position: "relative",
        backgroundColor: "#0b0f19",
        color: "#f9fafb",
      }}
    >
      {/* İndigo & Pembe Ambient Işık Efektleri */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          overflow: "hidden",
          zIndex: 0,
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "-140px",
            left: "50%",
            transform: "translateX(-50%)",
            width: "750px",
            height: "550px",
            backgroundColor: "rgba(99, 102, 241, 0.18)",
            borderRadius: "9999px",
            filter: "blur(140px)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "30px",
            left: "50%",
            transform: "translateX(-50%)",
            width: "650px",
            height: "380px",
            backgroundColor: "rgba(236, 72, 153, 0.12)",
            borderRadius: "9999px",
            filter: "blur(130px)",
          }}
        />
      </div>

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
        }}
      >
        {children}
      </div>

      {/* <Footer /> */}
    </div>
  );
};
