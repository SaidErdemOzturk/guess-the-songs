import type { Song } from '@/types/song';

/**
 * YouTube Video Eşleştirme ve Çözümleme Servisi
 * Şarkılar doğrudan YouTube playlist üzerinden çekildiği için
 * sabit eşleştirme haritası kullanılmaz, şarkının youtubeId'si döner.
 */
export function resolveYouTubeId(song: Song): string {
  return song.youtubeId || '';
}
