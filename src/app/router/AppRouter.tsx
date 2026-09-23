import React, { useEffect, useState } from 'react';
import { MainLayout } from '@/layouts/MainLayout';
import { HomePage } from '@/pages/HomePage/HomePage';
import { GamePage } from '@/pages/GamePage/GamePage';
import { LoginPage } from '@/pages/LoginPage/LoginPage';
import { RoomPage } from '@/pages/RoomPage/RoomPage';
import { CreateRoomModal } from '@/features/room/components/CreateRoomModal/CreateRoomModal';
import { useAuth } from '@/features/auth/context/AuthContext';
import type { CreateGameSessionRequest } from '@/types/game';
import type { Room } from '@/types/room';

type ViewMode = 'home' | 'game' | 'login' | 'room';

export const AppRouter: React.FC = () => {
  const { isAuthenticated, token, user } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>('home');
  const [activeRoomCode, setActiveRoomCode] = useState<string | null>(null);
  const [pendingInviteCode, setPendingInviteCode] = useState<string | null>(null);
  const [isCreateRoomModalOpen, setIsCreateRoomModalOpen] = useState(false);

  const [sessionParams, setSessionParams] = useState<CreateGameSessionRequest>({
    region: 'tr',
    genre: 'all',
    era: 'all',
  });

  // Sayfa ilk yüklendiğinde URL'de ?room=... davet kodu var mı kontrol et
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');

    if (roomParam) {
      if (isAuthenticated && token) {
        // Kullanıcı zaten giriş yapmışsa doğrudan odaya geç
        setActiveRoomCode(roomParam.toUpperCase());
        setViewMode('room');
      } else {
        // Kullanıcı giriş yapmamışsa, odaya girmek için önce login sayfasına yönlendir
        setPendingInviteCode(roomParam.toUpperCase());
        setViewMode('login');
      }
    }
  }, [isAuthenticated, token]);

  const handleStartGame = (params: CreateGameSessionRequest) => {
    setSessionParams(params);
    setViewMode('game');
  };

  const handleBackToHome = () => {
    if (activeRoomCode) {
      const url = new URL(window.location.href);
      url.searchParams.delete('room');
      window.history.replaceState({}, '', url.pathname);
      setActiveRoomCode(null);
    }
    setViewMode('home');
  };

  const handleLoginSuccess = () => {
    if (pendingInviteCode) {
      const code = pendingInviteCode;
      setPendingInviteCode(null);
      setActiveRoomCode(code);
      setViewMode('room');
      const url = new URL(window.location.href);
      url.searchParams.set('room', code);
      window.history.replaceState({}, '', `${url.pathname}?${url.searchParams.toString()}`);
    } else {
      setViewMode('home');
    }
  };

  const handleContinueAsGuest = () => {
    setPendingInviteCode(null);
    setViewMode('home');
  };

  const handleOpenCreateRoom = () => {
    if (isAuthenticated) {
      setIsCreateRoomModalOpen(true);
    } else {
      setViewMode('login');
    }
  };

  const handleRoomCreated = (room: Room) => {
    setActiveRoomCode(room.code);
    setIsCreateRoomModalOpen(false);
    setViewMode('room');
    const url = new URL(window.location.href);
    url.searchParams.set('room', room.code);
    window.history.replaceState({}, '', `${url.pathname}?${url.searchParams.toString()}`);
  };

  const handleStartRoomGame = (room: Room) => {
    setSessionParams({
      region: room.settings?.region || 'tr',
      genre: room.settings?.genre || 'all',
      era: room.settings?.era || 'all',
    });
    setViewMode('game');
  };

  const getContentMaxWidth = () => {
    switch (viewMode) {
      case 'room':
        return '56rem';
      case 'login':
        return '34rem';
      case 'game':
        return activeRoomCode ? '68rem' : '42rem';
      case 'home':
      default:
        return '42rem';
    }
  };

  return (
    <MainLayout
      onNavigateHome={handleBackToHome}
      onLoginClick={() => setViewMode('login')}
      onCreateRoomClick={handleOpenCreateRoom}
      maxWidth={getContentMaxWidth()}
    >
      {viewMode === 'login' && (
        <LoginPage
          pendingInviteRoomCode={pendingInviteCode}
          onSuccessLogin={handleLoginSuccess}
          onContinueAsGuest={handleContinueAsGuest}
        />
      )}

      {viewMode === 'room' && activeRoomCode && (
        <RoomPage
          roomCode={activeRoomCode}
          onLeaveRoom={handleBackToHome}
          onStartGame={handleStartRoomGame}
        />
      )}

      {viewMode === 'home' && (
        <HomePage onStartGame={handleStartGame} />
      )}

      {viewMode === 'game' && (
        <GamePage
          sessionParams={sessionParams}
          onBackToHome={handleBackToHome}
          roomCode={activeRoomCode}
          currentUserId={user?.id}
        />
      )}

      {/* Oda Kurma Modalı */}
      <CreateRoomModal
        isOpen={isCreateRoomModalOpen}
        onClose={() => setIsCreateRoomModalOpen(false)}
        onRoomCreated={handleRoomCreated}
      />
    </MainLayout>
  );
};
