import React, { useState } from "react";
import {
  youtubeService,
  extractPlaylistId,
} from "@/services/api/youtubeService";
import { youtubePlayerService } from "@/services/audio/youtubePlayerService";
import { songService } from "@/services/api/songService";
import type { Song as AppSong } from "@/types/song";
import type { CreateGameSessionRequest } from "@/types/game";
import styles from "./PlaylistViewer.module.css";

export interface PlaylistSong {
  title: string;
  videoId: string;
  author: string;
  lengthSeconds: number;
}

export type GameModeOption = "short" | "long-10" | "long-all" | "custom";

interface PlaylistViewerProps {
  onClose?: () => void;
  onStartGame?: (params: CreateGameSessionRequest) => void;
}

export function PlaylistViewer({
  onClose,
  onStartGame,
}: PlaylistViewerProps) {
  const [playlistId, setPlaylistId] = useState("");
  const [songs, setSongs] = useState<PlaylistSong[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [previewingVideoId, setPreviewingVideoId] = useState<string | null>(null);

  // Oyun modu ve şarkı sayısı seçimi
  const [selectedModeOption, setSelectedModeOption] = useState<GameModeOption>("short");
  const [customSongCount, setCustomSongCount] = useState<number>(5);

  const mapToAppSongs = (rawSongs: PlaylistSong[]): AppSong[] => {
    return rawSongs.map((s, idx) => {
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
  };

  const getEffectiveSongCount = (): number => {
    if (songs.length === 0) return 0;
    switch (selectedModeOption) {
      case "short":
        return Math.min(3, songs.length);
      case "long-10":
        return Math.min(10, songs.length);
      case "long-all":
        return songs.length;
      case "custom":
        return Math.min(Math.max(1, customSongCount), songs.length);
    }
  };

  const fetchPlaylist = async (targetId?: string) => {
    const rawId = (targetId || playlistId).trim();
    if (!rawId) return;

    setLoading(true);
    setError("");

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

      // Yeni gelen listeyi otomatik olarak arama ve eşleşme havuzuna dahil et
      const mappedSongs = mapToAppSongs(fetchedSongs);
      songService.registerCustomPlaylistSongs(mappedSongs);

      // Özel şarkı sayısı için varsayılanı ayarla
      if (fetchedSongs.length > 0) {
        setCustomSongCount(Math.min(5, fetchedSongs.length));
      }
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
      await youtubePlayerService.playClip(videoId, 15, () => {
        setPreviewingVideoId(null);
      });
    } catch {
      setPreviewingVideoId(null);
    }
  };


  const handleStartGame = () => {
    if (songs.length === 0) return;

    const mappedSongs = mapToAppSongs(songs);
    // Arama havuzuna hem mevcut parçaların hem de bu listenin dahil olduğundan emin ol
    songService.registerCustomPlaylistSongs(mappedSongs);

    let cleanId = playlistId.trim();
    if (cleanId.includes("list=")) {
      cleanId = cleanId.split("list=")[1].split("&")[0];
    } else {
      cleanId = extractPlaylistId(cleanId);
    }

    const count = getEffectiveSongCount();
    const isShort = selectedModeOption === "short";

    const sessionParams: CreateGameSessionRequest = {
      region: "tr",
      genre: "all",
      era: "all",
      gameMode: isShort ? "short" : "long",
      songCount: count,
      playlistId: cleanId,
      customSongs: mappedSongs,
    };

    onStartGame?.(sessionParams);
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
          </h2>
          <p className={styles.subtitle}>
            Çalma listenizi getirin, parçaları tahmin havuzuna dahil edin ve doğrudan bu listeyle oyuna başlayın!
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


      {/* Şarkılar Çekildikten Sonra: Oyun Modu Seçimi ve Oyunu Başlat Paneli */}
      {songs.length > 0 && (
        <div className={styles.gameStartCard}>
          <div className={styles.gameStartHeader}>
            <div className={styles.gameStartTitle}>
              <i className="fa-solid fa-gamepad" />
              <span>Bu Liste İle Oyunu Başlat</span>
            </div>
            <span className={styles.gameStartBadge}>
              {songs.length} Şarkı Hazır
            </span>
          </div>

          <p className={styles.gameStartNotice}>
            <i className="fa-solid fa-circle-info" /> Oyundaki sorular yalnızca bu playlist içinden seçilir. Şarkı ararken hem oyunun mevcut kataloğu hem de bu liste birlikte aranır.
          </p>

          <div className={styles.modeSection}>
            <span className={styles.modeSectionLabel}>Oyun Modu:</span>
            <div className={styles.modeGrid}>
              <button
                type="button"
                className={`${styles.modeCard} ${selectedModeOption === "short" ? styles.modeCardActive : ""}`}
                onClick={() => setSelectedModeOption("short")}
              >
                <div className={styles.modeCardHeader}>
                  <i className="fa-solid fa-bolt" />
                  <span className={styles.modeCardTitle}>Standart</span>
                </div>
                <span className={styles.modeCardDesc}>3 Şarkı (Hızlı Mod)</span>
              </button>

              <button
                type="button"
                className={`${styles.modeCard} ${selectedModeOption === "long-10" ? styles.modeCardActive : ""}`}
                onClick={() => setSelectedModeOption("long-10")}
              >
                <div className={styles.modeCardHeader}>
                  <i className="fa-solid fa-fire" />
                  <span className={styles.modeCardTitle}>Uzun Mod</span>
                </div>
                <span className={styles.modeCardDesc}>10 Şarkı</span>
              </button>

              <button
                type="button"
                className={`${styles.modeCard} ${selectedModeOption === "long-all" ? styles.modeCardActive : ""}`}
                onClick={() => setSelectedModeOption("long-all")}
              >
                <div className={styles.modeCardHeader}>
                  <i className="fa-solid fa-layer-group" />
                  <span className={styles.modeCardTitle}>Tüm Liste</span>
                </div>
                <span className={styles.modeCardDesc}>{songs.length} Şarkının Tümü</span>
              </button>

              <button
                type="button"
                className={`${styles.modeCard} ${selectedModeOption === "custom" ? styles.modeCardActive : ""}`}
                onClick={() => setSelectedModeOption("custom")}
              >
                <div className={styles.modeCardHeader}>
                  <i className="fa-solid fa-sliders" />
                  <span className={styles.modeCardTitle}>Özel Adet</span>
                </div>
                <span className={styles.modeCardDesc}>{customSongCount} Şarkı</span>
              </button>
            </div>

            {selectedModeOption === "custom" && (
              <div className={styles.customSliderBox}>
                <div className={styles.customSliderRow}>
                  <span className={styles.sliderLabel}>Soru Sayısı:</span>
                  <input
                    type="range"
                    min="1"
                    max={Math.max(1, songs.length)}
                    value={customSongCount}
                    onChange={(e) => setCustomSongCount(Number(e.target.value))}
                    className={styles.rangeInput}
                  />
                  <span className={styles.sliderValue}>{customSongCount} Şarkı</span>
                </div>
              </div>
            )}
          </div>

          <div className={styles.gameStartActions}>
            <button
              type="button"
              className={styles.startGameBtn}
              onClick={handleStartGame}
            >
              <i className="fa-solid fa-play" />
              <span>Oyunu Başlat ({getEffectiveSongCount()} Şarkı)</span>
            </button>
          </div>
        </div>
      )}

      {/* Liste Üst Bilgi */}
      {songs.length > 0 && (
        <div className={styles.statsBar}>
          <span className={styles.songCountBadge}>
            <i className="fa-solid fa-music" /> {songs.length} Şarkı Bulundu
          </span>
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
