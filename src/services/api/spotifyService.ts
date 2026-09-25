import type {
  Song,
  DifficultyLevel,
  SpotifyTokenResponse,
  SpotifyTrack,
  SpotifySearchResponse,
} from '@/types';

/**
 * Popüler ve küratörlü Spotify Çalma Listesi ID'leri (Toplam 10 Adet)
 * 5 Zorluk Seviyesi (Kolay, Orta, Zor, Uzman, İmkansız) x 2 Bölge (Türkiye, Global)
 */
export const SPOTIFY_CURATED_PLAYLISTS = {
  // Türkiye Odaklı
  TR_KOLAY: '7m7P2Ff1nnmDfhkcQUTzc4',
  TR_ORTA: '48YuByPXep4Dvm7I3QV393',
  TR_ZOR: '4IvGwOxqWfK6W7YyhQh5uF',
  TR_UZMAN: '5r84aovZVSiLBxVJomSXy1',
  TR_IMKANSIZ: '5r84aovZVSiLBxVJomSXy1',

  // Global Odaklı
  GLOBAL_KOLAY: '2qJ9217FWBWkxWqcNOf6x0',
  GLOBAL_ORTA: '5B2QOYXXK7sOo9H7ebofHM',
  GLOBAL_ZOR: '4qbwsmUceMHcT7eowo4hZF',
  GLOBAL_UZMAN: '5r84aovZVSiLBxVJomSXy1',
  GLOBAL_IMKANSIZ: '5r84aovZVSiLBxVJomSXy1',
} as const;

/**
 * Bölgeye ve aşama/zorluk indeksine (0: Kolay, 1: Orta, 2: Zor, 3: Uzman, 4: İmkansız) göre
 * ilgili Spotify Playlist ID'sini döner.
 */
export function getPlaylistIdByStage(region: 'tr' | 'global' = 'tr', stageIndex: number = 0): string {
  const isTr = region === 'tr';
  const stage = Math.max(0, Math.min(4, stageIndex));

  if (isTr) {
    switch (stage) {
      case 0: return SPOTIFY_CURATED_PLAYLISTS.TR_KOLAY;
      case 1: return SPOTIFY_CURATED_PLAYLISTS.TR_ORTA;
      case 2: return SPOTIFY_CURATED_PLAYLISTS.TR_ZOR;
      case 3: return SPOTIFY_CURATED_PLAYLISTS.TR_UZMAN;
      case 4: return SPOTIFY_CURATED_PLAYLISTS.TR_IMKANSIZ;
    }
  } else {
    switch (stage) {
      case 0: return SPOTIFY_CURATED_PLAYLISTS.GLOBAL_KOLAY;
      case 1: return SPOTIFY_CURATED_PLAYLISTS.GLOBAL_ORTA;
      case 2: return SPOTIFY_CURATED_PLAYLISTS.GLOBAL_ZOR;
      case 3: return SPOTIFY_CURATED_PLAYLISTS.GLOBAL_UZMAN;
      case 4: return SPOTIFY_CURATED_PLAYLISTS.GLOBAL_IMKANSIZ;
    }
  }
  return SPOTIFY_CURATED_PLAYLISTS.TR_KOLAY;
}

// PKCE Kriptografik Yardımcıları
function generateRandomString(length: number = 64): string {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const cryptoObj = typeof window !== 'undefined' ? (window.crypto || (window as any).msCrypto) : null;
  if (cryptoObj && cryptoObj.getRandomValues) {
    const values = cryptoObj.getRandomValues(new Uint8Array(length));
    return Array.from(values).map((x) => possible[x % possible.length]).join('');
  }
  let result = '';
  for (let i = 0; i < length; i++) {
    result += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return result;
}

/**
 * Saf JS SHA-256 algoritması (HTTP / non-secure context fallback'i için)
 */
function jsSha256(ascii: string): Uint8Array {
  function rightRotate(value: number, amount: number) {
    return (value >>> amount) | (value << (32 - amount));
  }

  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  const words: number[] = [];
  const asciiBitLength = ascii.length * 8;

  const hash: number[] = [];
  const k: number[] = [];
  let primeCounter = 0;

  const isPrime = (n: number) => {
    for (let factor = 2, max = Math.sqrt(n); factor <= max; factor++) {
      if (n % factor === 0) return false;
    }
    return true;
  };

  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (isPrime(candidate)) {
      if (primeCounter < 8) {
        hash[primeCounter] = (mathPow(candidate, 1 / 2) * maxWord) | 0;
      }
      k[primeCounter] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
      primeCounter++;
    }
  }

  ascii += '\x80';
  while ((ascii.length % 64) - 56) ascii += '\x00';
  for (let i = 0; i < ascii.length; i++) {
    const j = ascii.charCodeAt(i);
    words[i >> 2] |= j << ((3 - (i % 4)) * 8);
  }
  words[words.length] = (asciiBitLength / maxWord) | 0;
  words[words.length] = asciiBitLength | 0;

  for (let j = 0; j < words.length;) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash.slice(0);

    for (let i = 0; i < 64; i++) {
      const w15 = w[i - 15];
      const w2 = w[i - 2];

      const s0 = i >= 16 ? rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3) : 0;
      const s1 = i >= 16 ? rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10) : 0;

      if (i >= 16) {
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      }

      const a = hash[0];
      const e = hash[4];
      const temp1 =
        (hash[7] +
          (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) +
          ((e & hash[5]) ^ (~e & hash[6])) +
          k[i] +
          w[i]) |
        0;
      const temp2 =
        ((rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) +
          ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]))) |
        0;

      hash[7] = hash[6];
      hash[6] = hash[5];
      hash[5] = hash[4];
      hash[4] = (hash[3] + temp1) | 0;
      hash[3] = hash[2];
      hash[2] = hash[1];
      hash[1] = hash[0];
      hash[0] = (temp1 + temp2) | 0;
    }

    for (let i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }

  const result = new Uint8Array(32);
  for (let i = 0; i < 8; i++) {
    result[i * 4] = (hash[i] >>> 24) & 0xff;
    result[i * 4 + 1] = (hash[i] >>> 16) & 0xff;
    result[i * 4 + 2] = (hash[i] >>> 8) & 0xff;
    result[i * 4 + 3] = hash[i] & 0xff;
  }
  return result;
}

async function sha256(plain: string): Promise<ArrayBuffer> {
  // Eğer HTTPS veya güvenli bağlamda ise yerel Web Crypto API'yi kullan
  const cryptoObj = typeof window !== 'undefined' ? window.crypto : null;
  if (cryptoObj && cryptoObj.subtle && typeof cryptoObj.subtle.digest === 'function') {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(plain);
      return await cryptoObj.subtle.digest('SHA-256', data);
    } catch {
      // Hata durumunda JS fallback'e geç
    }
  }

  // Güvensiz HTTP bağlamlarında (subtle undefined olduğunda) saf JS fallback'i:
  const hashBytes = jsSha256(plain);
  return hashBytes.buffer as ArrayBuffer;
}

function base64urlencode(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

const STORAGE_KEYS = {
  USER_ACCESS_TOKEN: 'spotify_user_access_token',
  USER_REFRESH_TOKEN: 'spotify_user_refresh_token',
  TOKEN_EXPIRES_AT: 'spotify_token_expires_at',
  CODE_VERIFIER: 'spotify_code_verifier',
};

class SpotifyService {
  private clientId: string = import.meta.env.VITE_SPOTIFY_CLIENT_ID || '';
  private clientSecret: string = import.meta.env.VITE_SPOTIFY_CLIENT_SECRET || '';
  private cachedClientToken: string | null = null;
  private clientTokenExpiresAt: number = 0;

  /**
   * Çalışma anında Client ID ve Secret tanımlamak / güncellemek için kullanılır
   */
  public setCredentials(clientId: string, clientSecret: string): void {
    this.clientId = clientId.trim();
    this.clientSecret = clientSecret.trim();
    this.cachedClientToken = null;
    this.clientTokenExpiresAt = 0;
  }

  public hasCredentials(): boolean {
    return Boolean(this.clientId);
  }

  /**
   * Kullanıcının Spotify ile oturum açıp açmadığını döner
   */
  public isUserLoggedIn(): boolean {
    const token = localStorage.getItem(STORAGE_KEYS.USER_ACCESS_TOKEN);
    const expiresAt = Number(localStorage.getItem(STORAGE_KEYS.TOKEN_EXPIRES_AT) || 0);
    const refreshToken = localStorage.getItem(STORAGE_KEYS.USER_REFRESH_TOKEN);
    return Boolean(token && (expiresAt > Date.now() || refreshToken));
  }

  /**
   * Dinamik Callback / Redirect URI döner.
   * Localhost ise 127.0.0.1'e çevirir; canlı alan adında ise https://guess.saiderdemozturk.com/callback kullanır.
   */
  public getRedirectUri(): string {
    if (typeof window === 'undefined') return '';
    const origin = window.location.hostname === 'localhost'
      ? window.location.origin.replace('localhost', '127.0.0.1')
      : window.location.origin;
    return `${origin}/callback`;
  }

  /**
   * Spotify PKCE akışı ile kullanıcıyı Spotify Giriş sayfasına yönlendirir.
   * Bu sayede kullanıcının kendi çalma listelerine erişim yetkisi (User Token) alınır.
   */
  public async loginWithSpotify(): Promise<void> {
    if (!this.clientId) {
      alert('VITE_SPOTIFY_CLIENT_ID .env dosyasında tanımlı değil!');
      return;
    }

    const codeVerifier = generateRandomString(64);
    localStorage.setItem(STORAGE_KEYS.CODE_VERIFIER, codeVerifier);

    const hashed = await sha256(codeVerifier);
    const codeChallenge = base64urlencode(hashed);

    const redirectUri = this.getRedirectUri();
    const scope = [
      'playlist-read-private',
      'playlist-read-collaborative',
      'user-read-private',
      'user-read-email',
    ].join(' ');

    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      scope,
      code_challenge_method: 'S256',
      code_challenge: codeChallenge,
      state: codeVerifier,
    });

    window.location.href = `https://accounts.spotify.com/authorize?${params.toString()}`;
  }

  /**
   * Sayfa yüklendiğinde URL'de Spotify'dan dönen ?code=... parametresi varsa
   * bunu yakalar ve PKCE ile Access Token + Refresh Token alır.
   */
  public async handleAuthCallback(): Promise<boolean> {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const error = params.get('error');

    if (error) {
      console.error('Spotify yetkilendirme hatası:', error);
      window.history.replaceState({}, document.title, '/');
      return false;
    }

    if (!code) return false;

    const stateVerifier = params.get('state');
    const localVerifier = localStorage.getItem(STORAGE_KEYS.CODE_VERIFIER);
    const codeVerifier = stateVerifier || localVerifier;

    if (!codeVerifier) {
      console.error('code_verifier bulunamadı.');
      return false;
    }

    try {
      const redirectUri = this.getRedirectUri();
      const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: this.clientId,
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
          code_verifier: codeVerifier,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Token takası başarısız (${response.status}): ${errText}`);
      }

      const data = await response.json();
      localStorage.setItem(STORAGE_KEYS.USER_ACCESS_TOKEN, data.access_token);
      if (data.refresh_token) {
        localStorage.setItem(STORAGE_KEYS.USER_REFRESH_TOKEN, data.refresh_token);
      }
      localStorage.setItem(STORAGE_KEYS.TOKEN_EXPIRES_AT, String(Date.now() + data.expires_in * 1000));
      localStorage.removeItem(STORAGE_KEYS.CODE_VERIFIER);

      console.log('✅ Spotify User Token başarıyla alındı!');
      window.history.replaceState({}, document.title, '/');
      window.location.href = '/';
      return true;
    } catch (err) {
      console.error('Spotify token alma hatası:', err);
      return false;
    }
  }

  /**
   * Kullanıcı token'ının süresi dolmuşsa refresh_token kullanarak otomatik yeniler
   */
  private async refreshUserToken(): Promise<string | null> {
    const refreshToken = localStorage.getItem(STORAGE_KEYS.USER_REFRESH_TOKEN);
    if (!refreshToken || !this.clientId) return null;

    try {
      const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: this.clientId,
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        }),
      });

      if (!response.ok) return null;

      const data = await response.json();
      localStorage.setItem(STORAGE_KEYS.USER_ACCESS_TOKEN, data.access_token);
      if (data.refresh_token) {
        localStorage.setItem(STORAGE_KEYS.USER_REFRESH_TOKEN, data.refresh_token);
      }
      localStorage.setItem(STORAGE_KEYS.TOKEN_EXPIRES_AT, String(Date.now() + data.expires_in * 1000));
      return data.access_token;
    } catch {
      return null;
    }
  }

  /**
   * Öncelikli olarak Kullanıcı Yetkili Token'ı (User Token) döner.
   * User Token yoksa ve Client Secret varsa Client Credentials token'ı döner.
   * Kullanıcı token'ı varsa 403 Forbidden hatası ASLA alınmaz!
   */
  public async getAccessToken(): Promise<string> {
    const now = Date.now();

    // 1. Önce User Token kontrol et (Çalma listelerine 403 vermeden erişen token budur)
    const userToken = localStorage.getItem(STORAGE_KEYS.USER_ACCESS_TOKEN);
    const userExpiresAt = Number(localStorage.getItem(STORAGE_KEYS.TOKEN_EXPIRES_AT) || 0);

    if (userToken && userExpiresAt > now + 60 * 1000) {
      return userToken;
    }

    // Süresi dolmuşsa yenilemeyi dene
    const refreshed = await this.refreshUserToken();
    if (refreshed) {
      return refreshed;
    }

    // 2. User Token yoksa Client Credentials Flow'u dene (Fallback)
    if (this.cachedClientToken && this.clientTokenExpiresAt > now + 60 * 1000) {
      return this.cachedClientToken;
    }

    if (this.clientId && this.clientSecret) {
      try {
        const credentials = btoa(`${this.clientId}:${this.clientSecret}`);
        const response = await fetch('https://accounts.spotify.com/api/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Basic ${credentials}`,
          },
          body: new URLSearchParams({
            grant_type: 'client_credentials',
          }),
        });

        if (response.ok) {
          const data: SpotifyTokenResponse = await response.json();
          this.cachedClientToken = data.access_token;
          this.clientTokenExpiresAt = now + data.expires_in * 1000;
          return this.cachedClientToken;
        }
      } catch {
        // Fallback başarısızsa devam et
      }
    }

    // Token yoksa otomatik Spotify girişini başlat
    this.loginWithSpotify();
    throw new Error('Spotify oturumu gerekiyor. Yönlendiriliyor...');
  }

  /**
   * Spotify Web API'ye yetkilendirilmiş istek atan yardımcı fonksiyon
   */
  private async request<T>(endpoint: string): Promise<T> {
    const userToken = localStorage.getItem(STORAGE_KEYS.USER_ACCESS_TOKEN);
    const token = await this.getAccessToken();
    const tokenType = (token === userToken) ? 'KULLANICI TOKENI (User OAuth)' : 'UYGULAMA TOKENI (Client Credentials)';

    console.log(`📡 [Spotify API İstek] Endpoint: ${endpoint} | Token Türü: ${tokenType}`);

    const response = await fetch(`https://api.spotify.com/v1${endpoint}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.status === 401) {
      console.warn('⚠️ [Spotify API] 401 Unauthorized - Token yenileniyor...');
      const refreshed = await this.refreshUserToken();
      if (refreshed) {
        const retryRes = await fetch(`https://api.spotify.com/v1${endpoint}`, {
          headers: { Authorization: `Bearer ${refreshed}` },
        });
        if (retryRes.ok) return retryRes.json() as Promise<T>;
      }
      this.loginWithSpotify();
      throw new Error('Spotify oturumu yenilenemedi, lütfen tekrar giriş yapın.');
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ [Spotify API Hatası ${response.status}]:`, errorText);

      // 403 hatasında token türü uyarısı
      if (response.status === 403) {
        console.error(
          `403 Forbidden Nedeni: Kullanılan token: "${tokenType}". ` +
          `Eğer Uygulama Tokeni ise Spotify çalma listelerine erişim vermez. ` +
          `Kullanıcı Tokeni ise Spotify Dashboard -> User Management altına Spotify e-posta adresinizin eklenmiş olması gerekir.`
        );
      }

      throw new Error(`Spotify API hatası (${response.status}): ${errorText}`);
    }

    return response.json() as Promise<T>;
  }

  /**
   * Spotify Çalma Listesindeki (Playlist) parçaları getirir ve Song formatına dönüştürür.
   * User Token ile çağrıldığı için 403 Forbidden hatası vermez.
   */
  public async getPlaylistSongs(
    playlistId: string,
    options?: { limit?: number; region?: 'tr' | 'global' }
  ): Promise<Song[]> {
    const limit = options?.limit || 50;
    const region = options?.region || 'tr';

    // Teşhis: Kullanıcı oturumunu kontrol et
    try {
      const me = await this.request<any>('/me');
      console.log(`👤 [Spotify Oturum Açan Kullanıcı]: ${me.display_name || ''} (${me.email || me.id})`);
    } catch (e) {
      console.error('❌ [/me İstek Hatası - User Management kontrol edin]:', e);
    }

    // /playlists/{id} çağrılır (tracks alt uç noktası yerine ana playlist uç noktası)
    const data = await this.request<any>(`/playlists/${playlistId}`);

    // Yeni Spotify formatı: data.items.items | Klasik format: data.tracks.items veya data.items
    const rawItems: any[] =
      data.items?.items ||
      data.tracks?.items ||
      (Array.isArray(data.items) ? data.items : []) ||
      [];

    console.log(`🎵 [Spotify Playlist] Toplam ${rawItems.length} parça alındı:`, data.name || playlistId);

    const songs: Song[] = [];

    rawItems.forEach((entry: any, index: number) => {
      // Yeni Spotify formatında 'item', klasik formatta 'track'
      const track = entry.item || entry.track || entry;
      if (track && track.name) {
        songs.push(this.mapSpotifyTrackToSong(track, index + 1, region));
      }
    });

    return songs.slice(0, limit);
  }

  /**
   * Spotify üzerinde parça veya sanatçı arar
   */
  public async searchTracks(query: string, limit: number = 10): Promise<Song[]> {
    if (!query.trim()) return [];

    const data = await this.request<SpotifySearchResponse>(
      `/search?q=${encodeURIComponent(query)}&type=track&limit=${limit}`
    );

    const items = data.tracks?.items || [];
    return items.map((track, index) => this.mapSpotifyTrackToSong(track, index + 1));
  }

  /**
   * Bir sanatçının en popüler parçalarını (Top Tracks) getirir
   */
  public async getArtistTopTracks(artistId: string, market: string = 'TR'): Promise<Song[]> {
    const data = await this.request<{ tracks: SpotifyTrack[] }>(
      `/artists/${artistId}/top-tracks?market=${market}`
    );

    const tracks = data.tracks || [];
    return tracks.map((track, index) => this.mapSpotifyTrackToSong(track, index + 1));
  }

  /**
   * Spotify oturumunu sonlandırır
   */
  public logout(): void {
    localStorage.removeItem(STORAGE_KEYS.USER_ACCESS_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.USER_REFRESH_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.TOKEN_EXPIRES_AT);
    this.cachedClientToken = null;
  }

  /**
   * Spotify Track nesnesini oyunumuzun Song modeline dönüştürür.
   * Gelen JSON'daki 'item' alanındaki tüm verileri (title, artist, album, cover, year vb.) eksiksiz eşler.
   */
  public mapSpotifyTrackToSong(
    track: any,
    fallbackId: number = 1,
    region: 'tr' | 'global' = 'tr'
  ): Song {
    const mainArtist = track.artists?.[0]?.name || 'Bilinmeyen Sanatçı';
    const featuredArtists = (track.artists || []).slice(1).map((a: any) => a.name);

    const releaseYear = track.album?.release_date
      ? parseInt(track.album.release_date.substring(0, 4), 10)
      : 2024;

    const popularity = typeof track.popularity === 'number' ? track.popularity : 50;

    let difficulty: DifficultyLevel = 'medium';
    let difficultyRank: 1 | 2 | 3 | 4 | 5 = 2;

    if (popularity >= 80) {
      difficulty = 'easy';
      difficultyRank = 1;
    } else if (popularity >= 65) {
      difficulty = 'medium';
      difficultyRank = 2;
    } else if (popularity >= 45) {
      difficulty = 'hard';
      difficultyRank = 3;
    } else if (popularity >= 25) {
      difficulty = 'expert';
      difficultyRank = 4;
    } else {
      difficulty = 'impossible';
      difficultyRank = 5;
    }

    // En iyi albüm görseli
    const coverUrl = track.album?.images?.[0]?.url || track.album?.images?.[1]?.url;

    // Şarkı ID: Spotify string ID'sini stabil bir numeric hash ID'ye dönüştürür
    const trackIdStr = String(track.id || `track_${fallbackId}`);
    const numericId = Math.abs(
      trackIdStr.split('').reduce((acc: number, char: string) => ((acc << 5) - acc + char.charCodeAt(0)) | 0, 0)
    ) || fallbackId;

    return {
      id: numericId,
      title: track.name,
      artist: mainArtist,
      featuredArtists: featuredArtists.length > 0 ? featuredArtists : undefined,
      album: track.album?.name,
      year: isNaN(releaseYear) ? 2024 : releaseYear,
      genre: 'pop',
      region,
      difficulty,
      difficultyRank,
      startSecond: 0,
      duration: 30, // 30 saniyelik standart kesit
      coverUrl,
      previewUrl: track.preview_url || undefined,
      isrc: track.external_ids?.isrc,
      playCount: popularity * 10000,
    };
  }
}

export const spotifyService = new SpotifyService();
