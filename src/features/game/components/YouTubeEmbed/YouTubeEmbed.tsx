import React, { useState } from 'react';
import styles from './YouTubeEmbed.module.css';

interface YouTubeEmbedProps {
  youtubeId: string;
  songTitle?: string;
  height?: number | string;
  width?: string | number;
  autoplay?: boolean;
}

export const YouTubeEmbed: React.FC<YouTubeEmbedProps> = ({
  youtubeId,
  songTitle = 'YouTube Müzik Videosu',
  autoplay = true,
}) => {
  const [isLoading, setIsLoading] = useState(true);

  if (!youtubeId) {
    return null;
  }

  // Temiz video ID ve embed URL
  const cleanId = youtubeId.trim();
  const embedUrl = `https://www.youtube.com/embed/${cleanId}?autoplay=${autoplay ? 1 : 0}&enablejsapi=1&rel=0&modestbranding=1&playsinline=1`;
  const watchUrl = `https://www.youtube.com/watch?v=${cleanId}`;

  return (
    <div className={styles.embedWrapper}>
      <div className={styles.embedHeader}>
        <div className={styles.brandBadge}>
          <i className="fa-brands fa-youtube" />
          <span>{songTitle}</span>
        </div>
        <a
          href={watchUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.youtubeLink}
          title="YouTube'da İzle"
        >
          <span>YouTube'da Aç</span>
          <i className="fa-solid fa-arrow-up-right-from-square" style={{ fontSize: '0.6875rem' }} />
        </a>
      </div>

      <div className={styles.iframeContainer}>
        {isLoading && (
          <div className={styles.loadingOverlay}>
            <i className="fa-solid fa-spinner fa-spin" style={{ color: '#ff0000', fontSize: '1.5rem' }} />
            <span>YouTube video oynatıcı hazırlanıyor...</span>
          </div>
        )}
        <iframe
          className={styles.iframe}
          src={embedUrl}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          loading="lazy"
          title={songTitle}
          onLoad={() => setIsLoading(false)}
        />
      </div>
    </div>
  );
};
