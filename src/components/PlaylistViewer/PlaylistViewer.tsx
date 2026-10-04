import React, { useState } from "react";
import {
  youtubeService,
  extractPlaylistId,
} from "@/services/api/youtubeService";
import { youtubePlayerService } from "@/services/audio/youtubePlayerService";
import { songService } from "@/services/api/songService";
import type { Song as AppSong } from "@/types/song";
import styles from "./PlaylistViewer.module.css";

export interface PlaylistSong {
  title: string;
  videoId: string;
  author: string;
  lengthSeconds: number;
}

interface PlaylistViewerProps {
  onClose?: () => void;
  onSongsImported?: (songs: PlaylistSong[]) => void;
}

export function PlaylistViewer({
  onClose,
  onSongsImported,
}: PlaylistViewerProps) {
  const [playlistId, setPlaylistId] = useState("");
  const [songs, setSongs] = useState<PlaylistSong[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [previewingVideoId, setPreviewingVideoId] = useState<string | null>(
    null,
  );
  const [importedSuccess, setImportedSuccess] = useState(false);

  const fetchPlaylist = async (targetId?: string) => {
    const rawId = (targetId || playlistId).trim();
    if (!rawId) return;

    setLoading(true);
    setError("");
    setImportedSuccess(false);

    // YouTube playlist ID'sini temizleme (URL girilirse sadece ID kısmını alma)
    let cleanId = rawId;
    if (rawId.includes("list=")) {
      cleanId = rawId.split("list=")[1].split("&")[0];
    } else {
      cleanId = extractPlaylistId(rawId);
    }

    try {
      // inv.nadeko.net veya yedek CORS açık public instance'lar
      const instances = [
        "https://inv.nadeko.net",
        "https://invidious.jing.rocks",
        "https://invidious.nerdvpn.de",
      ];

      let data: any = null;
      let lastErrMsg = "";

      for (const inst of instances) {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 7000);
          const response = await fetch(`${inst}/api/v1/playlists/${cleanId}`, {
            signal: controller.signal,
          });
          clearTimeout(timer);

          if (response.ok) {
            data = await response.json();
            break;
          }
        } catch (e: any) {
          lastErrMsg = e?.message || "İstek zaman aşımına uğradı";
        }
      }

      if (!data || !data.videos) {
        throw new Error(
          lastErrMsg || "Çalma listesi bulunamadı veya sunucu yanıt vermedi.",
        );
      }

      const fetchedSongs: PlaylistSong[] = (data.videos || []).map(
        (v: any) => ({
          title: v.title || "Bilinmeyen Parça",
          videoId: v.videoId,
          author: v.author || "Sanatçı",
          lengthSeconds: v.lengthSeconds || 0,
        }),
      );

      setSongs(fetchedSongs);
    } catch (err: any) {
      setError(err.message || "Veri çekilirken bir hata oluştu");
    } finally {
      setLoading(false);
    }
  };

  const handlePlayPreview = async (videoId: string) => {
    if (previewingVideoId === videoId) {
      youtubePlayerService.stopClip();
      setPreviewingVideoId(null);
      return;
    }

    try {
      setPreviewingVideoId(videoId);
      await youtubePlayerService.playClip(videoId, 0, 15);
    } catch {
      setPreviewingVideoId(null);
    }
  };

  const handleImportToGame = () => {
    if (songs.length === 0) return;

    const mappedToAppSongs: AppSong[] = songs.map((s, idx) => {
      let artist = s.author;
      let title = s.title;

      if (s.title.includes(" - ")) {
        const parts = s.title.split(" - ");
        artist = parts[0].trim();
        title = parts.slice(1).join(" - ").trim();
      }

      title = title
        .replace(
          /\s*[([].*?(official|video|klip|audio|lyrics|hd|4k|remaster|visualizer).*?[)\]]/gi,
          "",
        )
        .trim();
      title = title.replace(/\s*\|\s*.*$/i, "").trim();

      return {
        id: Date.now() + idx,
        title: title || s.title,
        artist: artist || s.author,
        year: 2024,
        genre: "pop",
        region: "tr",
        difficulty: "easy",
        difficultyRank: 1,
        startSecond: 0,
        duration: s.lengthSeconds || 30,
        coverUrl: `https://img.youtube.com/vi/${s.videoId}/hqdefault.jpg`,
        youtubeId: s.videoId,
      };
    });

    youtubeService.registerKnownSongs(mappedToAppSongs);
    songService.combinedPool = [
      ...mappedToAppSongs,
      ...songService.combinedPool,
    ];
    setImportedSuccess(true);
    onSongsImported?.(songs);
  };

  const formatDuration = (seconds: number) => {
    if (!seconds) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const quickSamples = [
    { label: "TR Pop", id: "PLDIoUOhQQPlVr3qepMVRsDe4T8vNQsvno" },
    { label: "Örnek Liste", id: "PLS9pu550w2vc" },
    { label: "Global Hits", id: "PLMC9KNkIncKtPzgY-5rmhvj7fax8fdxoj" },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.headerRow}>
        <div>
          <h2 className={styles.title}>
            <span className={styles.icon}>🎵</span> YouTube Çalma Listesi Çekici
            (Tokensiz)
          </h2>
          <p className={styles.subtitle}>
            Invidious REST API üzerinden doğrudan, API anahtarı gerekmeden
            YouTube çalma listesi verilerini çeker.
          </p>
        </div>
        {onClose && (
          <button className={styles.closeBtn} onClick={onClose} title="Kapat">
            <i className="fa-solid fa-xmark" />
          </button>
        )}
      </div>

      {/* Arama ve Giriş Alanı */}
      <div className={styles.inputGroup}>
        <input
          type="text"
          placeholder="Playlist ID veya URL (örn: PL... veya https://...)"
          value={playlistId}
          onChange={(e) => setPlaylistId(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && fetchPlaylist()}
          className={styles.input}
        />
        <button
          onClick={() => fetchPlaylist()}
          disabled={loading || !playlistId.trim()}
          className={styles.fetchBtn}
        >
          {loading ? (
            <>
              <i className="fa-solid fa-spinner fa-spin" /> Yükleniyor...
            </>
          ) : (
            <>
              <i className="fa-solid fa-cloud-arrow-down" /> Şarkıları Getir
            </>
          )}
        </button>
      </div>

      {/* Hızlı Örnekler */}
      <div className={styles.quickSamples}>
        <span className={styles.quickLabel}>Örnek Listeler:</span>
        {quickSamples.map((sample) => (
          <button
            key={sample.id}
            type="button"
            className={styles.sampleChip}
            onClick={() => {
              setPlaylistId(sample.id);
              fetchPlaylist(sample.id);
            }}
          >
            {sample.label}
          </button>
        ))}
      </div>

      {/* Hata Bildirimi */}
      {error && (
        <div className={styles.errorBox}>
          <i className="fa-solid fa-triangle-exclamation" /> {error}
        </div>
      )}

      {/* Başarı Bildirimi */}
      {importedSuccess && (
        <div className={styles.successBox}>
          <i className="fa-solid fa-circle-check" /> {songs.length} şarkı oyun
          havuzuna başarıyla aktarıldı!
        </div>
      )}

      {/* Liste Üst Bilgi ve Eylemler */}
      {songs.length > 0 && (
        <div className={styles.statsBar}>
          <span className={styles.songCountBadge}>
            <i className="fa-solid fa-music" /> {songs.length} Şarkı Bulundu
          </span>
          <button
            onClick={handleImportToGame}
            className={styles.importBtn}
            title="Şarkıları oyun ve tahmin havuzuna ekler"
          >
            <i className="fa-solid fa-plus-circle" /> Şarkıları Oyun Havuzuna
            Aktar
          </button>
        </div>
      )}

      {/* Şarkı Listesi */}
      <ul className={styles.songList}>
        {songs.map((song, index) => {
          const isCurrentPlaying = previewingVideoId === song.videoId;
          return (
            <li key={`${song.videoId}-${index}`} className={styles.songItem}>
              <div className={styles.thumbnailWrapper}>
                <img
                  src={`https://img.youtube.com/vi/${song.videoId}/hqdefault.jpg`}
                  alt={song.title}
                  className={styles.thumbnail}
                  loading="lazy"
                />
                <button
                  type="button"
                  className={`${styles.previewBtn} ${isCurrentPlaying ? styles.previewPlaying : ""}`}
                  onClick={() => handlePlayPreview(song.videoId)}
                  title={isCurrentPlaying ? "Durdur" : "Dinle / Önizle"}
                >
                  <i
                    className={`fa-solid ${isCurrentPlaying ? "fa-stop" : "fa-play"}`}
                  />
                </button>
              </div>

              <div className={styles.songInfo}>
                <strong className={styles.songTitle}>{song.title}</strong>
                <span className={styles.songAuthor}>— {song.author}</span>
                <div className={styles.songMeta}>
                  <span className={styles.duration}>
                    <i className="fa-regular fa-clock" />{" "}
                    {formatDuration(song.lengthSeconds)}
                  </span>
                  <a
                    href={`https://www.youtube.com/watch?v=${song.videoId}`}
                    target="_blank"
                    rel="noreferrer"
                    className={styles.youtubeLink}
                  >
                    <i className="fa-brands fa-youtube" /> Dinle (YouTube)
                  </a>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
