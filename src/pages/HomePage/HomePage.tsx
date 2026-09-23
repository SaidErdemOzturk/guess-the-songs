import React, { useEffect, useState } from 'react';
import { CustomArtistModal } from '@/features/game';
import { songService } from '@/services/api/songService';
import type { CreateGameSessionRequest } from '@/types/game';
import type { EraFilter, GenreFilter, RegionFilter } from '@/types/song';

interface HomePageProps {
  onStartGame: (params: CreateGameSessionRequest) => void;
}

export const HomePage: React.FC<HomePageProps> = ({ onStartGame }) => {
  const [region, setRegion] = useState<RegionFilter>('tr');
  const [genre, setGenre] = useState<GenreFilter>('all');
  const [era, setEra] = useState<EraFilter>('all');
  const [poolCount, setPoolCount] = useState<number>(18136);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    songService.getPoolStats({ region, genre, era }).then((stats) => {
      setPoolCount(stats.filteredCount || 18136);
    });
  }, [region, genre, era]);

  // Kullanıcı "Başla"ya basınca bölge, tür ve dönem backend'e iletilmek üzere gönderilir
  const handleStart = () => {
    onStartGame({ region, genre, era });
  };

  const handleStartCustom = (artist: string) => {
    onStartGame({ region, genre, era, artist });
  };

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        maxWidth: '42rem',
        margin: '0 auto',
        padding: '0 1rem',
        textAlign: 'center',
        zIndex: 10,
      }}
    >
      <div style={{ marginTop: '0.5rem', marginBottom: '2rem' }}>
        <h2
          style={{
            fontSize: '1.25rem',
            fontWeight: 700,
            color: '#f9fafb',
            marginBottom: '0.625rem',
          }}
        >
          Ne oynuyorsun?
        </h2>
        <p
          className="font-mono-num"
          style={{
            fontSize: '0.8125rem',
            color: '#9ca3af',
            lineHeight: 1.6,
            maxWidth: '36rem',
            margin: '0 auto',
            fontWeight: 400,
          }}
        >
          5 aşama <span style={{ color: '#6366f1' }}>·</span> her aşama intromun{' '}
          <span style={{ color: '#818cf8', fontWeight: 600 }}>0.1s</span> ile başlar ve 5 denemede{' '}
          <span style={{ color: '#ec4899', fontWeight: 600 }}>15s</span>'ye kadar genişler{' '}
          <span style={{ color: '#6366f1' }}>·</span> zorlaşan şey süre değil şarkıdır
        </p>
      </div>

      {/* Dropdown Filtre Seçenekleri */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.75rem',
          marginBottom: '1.25rem',
          width: '100%',
        }}
      >
        {/* Bölge */}
        <div style={{ position: 'relative' }}>
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value as RegionFilter)}
            style={{
              backgroundColor: 'rgba(17, 24, 39, 0.85)',
              color: '#e2e8f0',
              fontSize: '0.8125rem',
              padding: '0.5rem 2rem 0.5rem 1rem',
              borderRadius: '9999px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(8px)',
              cursor: 'pointer',
              outline: 'none',
              appearance: 'none',
              fontWeight: 500,
            }}
          >
            <option value="tr">Tüm bölgeler (Türkiye Odaklı)</option>
            <option value="global">Global Hitler</option>
            <option value="all">Karışık Dünya</option>
          </select>
          <i
            className="fa-solid fa-chevron-down"
            style={{
              fontSize: '10px',
              color: '#818cf8',
              position: 'absolute',
              right: '0.75rem',
              top: '50%',
              transform: 'translateY(-50%)',
              pointerEvents: 'none',
            }}
          />
        </div>

        {/* Tür */}
        <div style={{ position: 'relative' }}>
          <select
            value={genre}
            onChange={(e) => setGenre(e.target.value as GenreFilter)}
            style={{
              backgroundColor: 'rgba(17, 24, 39, 0.85)',
              color: '#e2e8f0',
              fontSize: '0.8125rem',
              padding: '0.5rem 2rem 0.5rem 1rem',
              borderRadius: '9999px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(8px)',
              cursor: 'pointer',
              outline: 'none',
              appearance: 'none',
              fontWeight: 500,
            }}
          >
            <option value="all">Tüm türler</option>
            <option value="pop">Türkçe Pop & Rock</option>
            <option value="rap">Türkçe Rap / Hip-Hop</option>
            <option value="rock">Anadolu Rock & Klasikler</option>
          </select>
          <i
            className="fa-solid fa-chevron-down"
            style={{
              fontSize: '10px',
              color: '#818cf8',
              position: 'absolute',
              right: '0.75rem',
              top: '50%',
              transform: 'translateY(-50%)',
              pointerEvents: 'none',
            }}
          />
        </div>

        {/* Dönem */}
        <div style={{ position: 'relative' }}>
          <select
            value={era}
            onChange={(e) => setEra(e.target.value as EraFilter)}
            style={{
              backgroundColor: 'rgba(17, 24, 39, 0.85)',
              color: '#e2e8f0',
              fontSize: '0.8125rem',
              padding: '0.5rem 2rem 0.5rem 1rem',
              borderRadius: '9999px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(8px)',
              cursor: 'pointer',
              outline: 'none',
              appearance: 'none',
              fontWeight: 500,
            }}
          >
            <option value="all">Tüm dönemler</option>
            <option value="2020s">2020'ler (En Yeniler)</option>
            <option value="2010s">2010'lar</option>
            <option value="2000s">2000'ler & 90'lar</option>
          </select>
          <i
            className="fa-solid fa-chevron-down"
            style={{
              fontSize: '10px',
              color: '#818cf8',
              position: 'absolute',
              right: '0.75rem',
              top: '50%',
              transform: 'translateY(-50%)',
              pointerEvents: 'none',
            }}
          />
        </div>
      </div>

      {/* Havuzdaki Şarkı Sayısı Göstergesi */}
      <p
        className="font-mono-num"
        style={{
          fontSize: '0.75rem',
          color: '#6b7280',
          marginBottom: '2.25rem',
        }}
      >
        {poolCount.toLocaleString('tr-TR')} şarkı bu havuzda bulunuyor.
      </p>

      {/* Başla Butonu */}
      <button
        onClick={handleStart}
        style={{
          width: '7.5rem',
          height: '3.1rem',
          background: 'linear-gradient(135deg, #6366f1 0%, #ec4899 100%)',
          color: '#ffffff',
          fontWeight: 800,
          fontSize: '1rem',
          borderRadius: '9999px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: '0 4px 20px rgba(99, 102, 241, 0.45)',
          transition: 'all 200ms ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 6px 25px rgba(99, 102, 241, 0.6)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 4px 20px rgba(99, 102, 241, 0.45)';
        }}
      >
        Başla
      </button>

      {/* Özel Oyun Butonu */}
      <button
        onClick={() => setIsModalOpen(true)}
        style={{
          marginTop: '1.5rem',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.625rem 1.25rem',
          borderRadius: '9999px',
          backgroundColor: 'rgba(17, 24, 39, 0.85)',
          border: '1px solid rgba(99, 102, 241, 0.3)',
          color: '#a5b4fc',
          fontSize: '0.8125rem',
          fontWeight: 600,
          letterSpacing: '0.025em',
          cursor: 'pointer',
          transition: 'all 150ms ease',
        }}
      >
        <span style={{ color: '#ec4899', fontSize: '0.875rem' }}>✦</span>
        <span>Özel oyun — istediğin sanatçıyı çal</span>
      </button>

      {/* Özel Sanatçı Modalı */}
      <CustomArtistModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSelectArtist={handleStartCustom}
      />
    </div>
  );
};
