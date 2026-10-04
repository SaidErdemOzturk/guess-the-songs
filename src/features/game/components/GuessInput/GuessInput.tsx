import React, { useEffect, useRef, useState } from 'react';
import { songService } from '@/services/api/songService';
import type { Song } from '@/types/song';

interface GuessInputProps {
  onGuess: (song: Song) => void;
  onSkip: () => void;
  skipLabel: string;
  disabled?: boolean;
  isLoading?: boolean;
}

export const GuessInput: React.FC<GuessInputProps> = ({
  onGuess,
  onSkip,
  skipLabel,
  disabled = false,
  isLoading = false,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Song[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const trimmed = searchTerm.trim();
    if (!trimmed) {
      setSearchResults([]);
      setIsDropdownOpen(false);
      return;
    }

    // Bütün çalma listelerinin yer aldığı havuzda anlık arama (150ms debounce)
    const timer = setTimeout(() => {
      songService.searchSongs(trimmed).then((results) => {
        setSearchResults(results);
        setIsDropdownOpen(true);
      });
    }, 150);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const handleSelectSong = (song: Song) => {
    setSearchTerm('');
    setIsDropdownOpen(false);
    onGuess(song);
  };

  const handleGuessSubmit = () => {
    if (disabled || isLoading || !searchTerm.trim()) return;

    if (searchResults.length > 0) {
      handleSelectSong(searchResults[0]);
    } else {
      // Doğrudan yazılan metinle tahmin gönderme fallback'i
      const customSong: Song = {
        id: Date.now(),
        title: searchTerm.trim(),
        artist: '',
        year: new Date().getFullYear(),
        genre: 'pop',
        region: 'tr',
        difficulty: 'easy',
        difficultyRank: 1,
        startSecond: 0,
        duration: 30,
        previewUrl: '',
      };
      handleSelectSong(customSong);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleGuessSubmit();
    }
  };

  const hasSearchText = Boolean(searchTerm.trim());

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        maxWidth: '38rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        position: 'relative',
        marginTop: '1.5rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', width: '100%' }}>
        {/* Arama Çubuğu */}
        <div style={{ position: 'relative', flex: 1 }}>
          <div
            style={{
              position: 'absolute',
              insetBlock: 0,
              left: 0,
              paddingLeft: '0.875rem',
              display: 'flex',
              alignItems: 'center',
              pointerEvents: 'none',
              color: '#818cf8',
            }}
          >
            <i className="fa-solid fa-magnifying-glass" style={{ fontSize: '0.8125rem' }} />
          </div>

          <input
            type="text"
            placeholder={
              isLoading
                ? 'Çalma listeleri yükleniyor, lütfen bekleyin...'
                : disabled
                  ? 'Tebrikler! Doğru bildin...'
                  : 'Şarkı veya sanatçı ara (bütün playlistlerde)...'
            }
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled || isLoading}
            style={{
              width: '100%',
              paddingLeft: '2.5rem',
              paddingRight: '1rem',
              paddingTop: '0.75rem',
              paddingBottom: '0.75rem',
              backgroundColor: disabled || isLoading ? 'rgba(17, 24, 39, 0.4)' : 'rgba(17, 24, 39, 0.9)',
              color: disabled || isLoading ? '#6b7280' : '#ffffff',
              borderRadius: '9999px',
              border: disabled || isLoading ? '1px solid rgba(255, 255, 255, 0.05)' : '1px solid rgba(255, 255, 255, 0.1)',
              fontSize: '0.875rem',
              outline: 'none',
              cursor: disabled || isLoading ? 'not-allowed' : 'text',
              opacity: disabled || isLoading ? 0.6 : 1,
              transition: 'all 150ms ease',
            }}
          />

          {/* Autocomplete Listesi */}
          {isDropdownOpen && !disabled && (
            <div
              style={{
                position: 'absolute',
                bottom: '100%',
                marginBottom: '0.5rem',
                left: 0,
                right: 0,
                backgroundColor: 'rgba(17, 24, 39, 0.95)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                borderRadius: '1rem',
                overflow: 'hidden',
                maxHeight: '14rem',
                overflowY: 'auto',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                zIndex: 30,
              }}
            >
              {searchResults.length === 0 ? (
                <div
                  style={{
                    padding: '0.75rem 1rem',
                    fontSize: '0.75rem',
                    color: '#6b7280',
                    fontStyle: 'italic',
                  }}
                >
                  Bütün playlistlerde "{searchTerm}" ile eşleşen parça bulunamadı. Enter'a basarak bu tahmini gönderebilirsiniz.
                </div>
              ) : (
                searchResults.map((song) => (
                  <div
                    key={song.id}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSelectSong(song);
                    }}
                    onClick={() => handleSelectSong(song)}
                    style={{
                      padding: '0.625rem 1rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '0.8125rem',
                      borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                      transition: 'background-color 150ms ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(99, 102, 241, 0.15)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <div>
                      <span style={{ color: '#ffffff', fontWeight: 600 }}>{song.title}</span>
                      <span
                        style={{
                          color: '#9ca3af',
                          fontSize: '0.75rem',
                          marginLeft: '0.375rem',
                        }}
                      >
                        · {song.artist}
                      </span>
                    </div>
                    <i
                      className="fa-solid fa-chevron-right"
                      style={{ fontSize: '10px', color: '#818cf8' }}
                    />
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Geç Butonu */}
        <button
          onClick={onSkip}
          disabled={disabled || isLoading}
          style={{
            padding: '0.75rem 1.25rem',
            borderRadius: '9999px',
            backgroundColor: disabled || isLoading ? 'rgba(31, 41, 55, 0.4)' : 'rgba(31, 41, 55, 0.85)',
            border: disabled || isLoading ? '1px solid rgba(255, 255, 255, 0.05)' : '1px solid rgba(255, 255, 255, 0.12)',
            color: disabled || isLoading ? '#6b7280' : '#ffffff',
            fontWeight: 600,
            fontSize: '0.8125rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.375rem',
            cursor: disabled || isLoading ? 'not-allowed' : 'pointer',
            opacity: disabled || isLoading ? 0.5 : 1,
            whiteSpace: 'nowrap',
            transition: 'all 150ms ease',
          }}
        >
          <i
            className="fa-solid fa-forward-step"
            style={{ color: disabled || isLoading ? '#6b7280' : '#818cf8', fontSize: '0.75rem' }}
          />
          <span>{skipLabel}</span>
        </button>
      </div>
    </div>
  );
};
