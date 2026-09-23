import React, { useState } from 'react';
import { useAuth } from '@/features/auth/context/AuthContext';
import { roomService } from '@/services/api/roomService';
import { Button, Input } from '@/components/ui';
import type { Room } from '@/types/room';

interface CreateRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRoomCreated: (room: Room) => void;
}

export const CreateRoomModal: React.FC<CreateRoomModalProps> = ({
  isOpen,
  onClose,
  onRoomCreated,
}) => {
  const { user, token } = useAuth();
  const [roomName, setRoomName] = useState('');
  const [maxParticipants, setMaxParticipants] = useState<number>(8);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !token) {
      setError('Oda kurabilmek için giriş yapmış olmalısınız.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const room = await roomService.createRoom(
        {
          name: roomName.trim() || `${user.name}'in Odası`,
          maxParticipants,
        },
        user,
        token
      );
      onRoomCreated(room);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Oda kurulurken bir hata oluştu.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        style={{
          backgroundColor: '#111827',
          border: '1px solid rgba(99, 102, 241, 0.3)',
          borderRadius: '1.5rem',
          padding: '1.75rem',
          width: '100%',
          maxWidth: '26rem',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
          position: 'relative',
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            color: '#9ca3af',
            fontSize: '1.125rem',
            cursor: 'pointer',
          }}
        >
          <i className="fa-solid fa-xmark" />
        </button>

        <h3
          style={{
            fontSize: '1.25rem',
            fontWeight: 800,
            color: '#ffffff',
            marginBottom: '0.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <span>🎮</span> Yeni Müzik Odası Kur
        </h3>
        <p style={{ fontSize: '0.8125rem', color: '#9ca3af', marginBottom: '1.25rem' }}>
          Arkadaşlarınızı davet edin ve şarkıları ilk tahmin eden olmak için yarışın.
        </p>

        {error && (
          <div
            style={{
              padding: '0.5rem 0.75rem',
              backgroundColor: 'rgba(239, 68, 68, 0.2)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              borderRadius: 'var(--radius-sm)',
              color: '#f87171',
              fontSize: '0.75rem',
              marginBottom: '1rem',
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <Input
            label="Oda Adı"
            placeholder={`${user?.name || 'Müzik'} Odası`}
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
          />

          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.75rem',
                fontWeight: 500,
                color: '#9ca3af',
                marginBottom: '0.375rem',
              }}
            >
              Maksimum Oyuncu Sayısı: {maxParticipants}
            </label>
            <input
              type="range"
              min="2"
              max="16"
              step="1"
              value={maxParticipants}
              onChange={(e) => setMaxParticipants(parseInt(e.target.value, 10))}
              style={{ width: '100%', cursor: 'pointer' }}
            />
          </div>

          <Button type="submit" variant="primary" size="md" isLoading={isSubmitting} style={{ marginTop: '0.5rem' }}>
            Odayı Kur & Lobiye Geç
          </Button>
        </form>
      </div>
    </div>
  );
};
