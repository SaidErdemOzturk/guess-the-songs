import React, { useState } from 'react';
import styles from './SpotifyEmbed.module.css';

interface SpotifyEmbedProps {
  spotifyId: string;
  height?: number;
  width?: string | number;
  title?: string;
  theme?: '0' | '1';
  compact?: boolean;
}

export const SpotifyEmbed: React.FC<SpotifyEmbedProps> = ({
  spotifyId,
  height,
  width = '100%',
  title = 'Spotify Embed Player',
  theme = '0',
  compact = true,
}) => {
  const [isLoading, setIsLoading] = useState(true);

  if (!spotifyId) {
    return null;
  }

  // spotify:track:id formatı temizlenir
  const cleanId = spotifyId.replace(/^spotify:track:/, '');
  const embedUrl = `https://open.spotify.com/embed/track/${cleanId}?utm_source=generator&theme=${theme}`;
  const spotifyTrackUrl = `https://open.spotify.com/track/${cleanId}`;
  const playerHeight = height ?? (compact ? 152 : 352);

  return (
    <div className={styles.embedWrapper}>
      <div className={styles.embedHeader}>
        <div className={styles.brandBadge}>
          <i className="fa-brands fa-spotify" />
          <span>Spotify Oynatıcı</span>
        </div>
        <a
          href={spotifyTrackUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.spotifyLink}
          title="Spotify'da Dinle"
        >
          <span>Spotify'da Aç</span>
          <i className="fa-solid fa-arrow-up-right-from-square" style={{ fontSize: '0.6875rem' }} />
        </a>
      </div>

      <div className={styles.iframeContainer} style={{ height: playerHeight }}>
        {isLoading && (
          <div className={styles.loadingOverlay}>
            <i className="fa-solid fa-spinner fa-spin" style={{ color: '#1db954', fontSize: '1.25rem' }} />
            <span>Spotify parçası yükleniyor...</span>
          </div>
        )}
        <iframe
          className={styles.iframe}
          src={embedUrl}
          width={width}
          height={playerHeight}
          frameBorder="0"
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"
          title={title}
          onLoad={() => setIsLoading(false)}
        />
      </div>
    </div>
  );
};
