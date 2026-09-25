export type RegionFilter = 'tr' | 'global';
export type GenreFilter = 'all' | 'pop' | 'rap' | 'rock' | 'electronic' | 'indie';
export type EraFilter = 'all' | '2020s' | '2010s' | '2000s' | '90s';
export type DifficultyLevel = 'easy' | 'medium' | 'hard' | 'expert' | 'impossible';

export interface Song {
  id: number;
  title: string;
  artist: string;
  featuredArtists?: string[];
  album?: string;
  year: number; // Çıkış yılı
  genre: 'pop' | 'rap' | 'rock' | 'electronic' | 'indie' | string; // Şarkı türü
  region: 'tr' | 'global'; // Bölge (Türkiye veya Global)
  difficulty: DifficultyLevel; // Zorluk derecesi (easy..impossible)
  difficultyRank: 1 | 2 | 3 | 4 | 5; // Kademeli zorluk derecesi
  startSecond: number; // Şarkının kesit başlangıç saniyesi
  duration: number; // Toplam süre (saniye)
  coverUrl?: string; // Albüm/şarkı kapağı görseli
  previewUrl?: string; // MP3 ses dosyası önizleme linki
  hints?: string[]; // Oyuncuya gösterilebilecek ipuçları
  playCount?: number; // Şarkı popülerlik / dinlenme skoru
}

export interface SongFilters {
  region?: RegionFilter;
  genre?: GenreFilter;
  era?: EraFilter;
  year?: number;
  difficulty?: DifficultyLevel;
  artist?: string;
  search?: string;
}

export interface SongPoolStats {
  totalCount: number;
  filteredCount: number;
  byGenre: Record<string, number>;
  byDifficulty: Record<DifficultyLevel, number>;
}
