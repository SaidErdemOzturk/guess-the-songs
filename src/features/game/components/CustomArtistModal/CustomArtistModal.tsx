import React, { useEffect, useState } from 'react';
import { artistService, type ArtistInfo } from '@/services/api/artistService';

interface CustomArtistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectArtist: (artist: string) => void;
}

export const CustomArtistModal: React.FC<CustomArtistModalProps> = ({
  isOpen,
  onClose,
  onSelectArtist,
}) => {
  const [artists, setArtists] = useState<ArtistInfo[]>([]);
  const [selectedArtist, setSelectedArtist] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      artistService.getArtists().then((list) => {
        setArtists(list);
        if (list.length > 0 && !selectedArtist) {
          setSelectedArtist(list[0].name);
        }
      });
    }
  }, [isOpen, selectedArtist]);

  if (!isOpen) return null;

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
          padding: '1.5rem',
          width: '100%',
          maxWidth: '28rem',
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
            fontSize: '1.125rem',
            fontWeight: 700,
            color: '#ffffff',
            marginBottom: '0.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <span style={{ color: '#ec4899' }}>✦</span> Özel Sanatçı Modu
        </h3>
        <p
          style={{
            fontSize: '0.75rem',
            color: '#9ca3af',
            marginBottom: '1rem',
          }}
        >
          Yalnızca belirli bir sanatçının en popüler parçalarından oluşan özel bir tur başlatın.
        </p>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            maxHeight: '12rem',
            overflowY: 'auto',
            paddingRight: '0.25rem',
            marginBottom: '1.25rem',
          }}
        >
          {artists.map((artist) => {
            const isChecked = selectedArtist === artist.name;
            return (
              <label
                key={artist.name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.75rem',
                  borderRadius: '0.75rem',
                  backgroundColor: isChecked ? 'rgba(99, 102, 241, 0.15)' : 'rgba(31, 41, 55, 0.5)',
                  border: isChecked
                    ? '1px solid #6366f1'
                    : '1px solid rgba(255, 255, 255, 0.08)',
                  cursor: 'pointer',
                  transition: 'background-color 150ms ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <input
                    type="radio"
                    name="custom_artist"
                    value={artist.name}
                    checked={isChecked}
                    onChange={() => setSelectedArtist(artist.name)}
                    style={{ accentColor: '#6366f1' }}
                  />
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#ffffff' }}>
                    {artist.name}
                  </span>
                </div>
                <span
                  className="font-mono-num"
                  style={{ fontSize: '10px', color: '#818cf8' }}
                >
                  {artist.songCount} parça
                </span>
              </label>
            );
          })}
        </div>

        <button
          onClick={() => {
            if (selectedArtist) {
              onSelectArtist(selectedArtist);
              onClose();
            }
          }}
          style={{
            width: '100%',
            padding: '0.65rem 0',
            borderRadius: '9999px',
            background: 'linear-gradient(135deg, #6366f1 0%, #ec4899 100%)',
            color: '#ffffff',
            fontWeight: 700,
            fontSize: '0.875rem',
            cursor: 'pointer',
            boxShadow: '0 4px 15px rgba(99, 102, 241, 0.4)',
            transition: 'all 150ms ease',
          }}
        >
          Seçilen Sanatçıyla Başla
        </button>
      </div>
    </div>
  );
};
