# Kurumsal Mimari & Klasörleme Rehberi (Guess The Songs)

Bu proje, React ve Vite üzerinde **Enterprise Feature-Driven (Modüler Özellik Tabanlı) + Shared Layer Architecture** prensipleriyle yapılandırılmıştır.

---

## 📁 Dizin Yapısı ve Sorumluluklar

```text
src/
├── app/                      # Uygulama seviyesi yapılandırmalar (Bootstrap katmanı)
│   ├── providers/            # Global context sağlayıcıları (Query, Auth, Theme)
│   ├── router/               # Sayfa yönlendirme ve guard mantığı
│   └── App.tsx               # Ana kök bileşen
│
├── assets/                   # Statik medya ve global stil sistemi
│   ├── icons/                # SVG veya ikon varlıkları
│   ├── images/               # Görseller
│   └── styles/               # CSS değişkenleri (Design tokens), reset ve tipografi
│
├── components/               # Tüm uygulamada paylaşılan ortak UI bileşenleri (Atomic Design)
│   ├── ui/                   # Button, Input, Card, Modal, Badge gibi temel atomlar
│   ├── feedback/             # LoadingSpinner, ErrorBoundary, Alert, Toast bildirimleri
│   └── layout/               # Header, Footer, Sidebar, PageContainer
│
├── config/                   # Tip güvenli çevre değişkenleri ve runtime ayarları (env.ts)
├── constants/                # Sabitler (route yolları, oyun kuralları, storage anahtarları)
│
├── features/                 # İş mantığı ve domain bazlı izole modüller (Feature-Driven)
│   ├── game/                 # Şarkı tahmin oyunu modülü
│   │   ├── components/       # Modüle özel bileşenler (AudioPlayer, GuessInput, ScoreBoard)
│   │   ├── hooks/            # Modüle özel iş akışları (useGameRound)
│   │   ├── services/         # Modüle özel API servisleri (gameApi.ts)
│   │   ├── types/            # Modüle özel TypeScript modelleri
│   │   └── index.ts          # Modülün dışarıya açılan kapısı (Public API)
│   └── leaderboard/          # Liderlik tablosu modülü
│
├── hooks/                    # Global, yeniden kullanılabilir hook'lar (useDebounce, useLocalStorage)
├── layouts/                  # Sayfa şablonları (MainLayout, GameLayout)
├── pages/                    # Route seviyesindeki sayfa bileşenleri (HomePage, GamePage, NotFoundPage)
├── services/                 # Global API istemcisi, HTTP interceptor'ları ve temel servisler
│   ├── api/                  # ApiClient, Endpoints, songService, artistService, gameService
│   ├── audio/                # WebAudioService (Web Audio API sentezleyici, ses/mute yöneticisi)
│   └── mock/                 # Backend hazır olmadığında çalışan yerel şarkı veritabanı (Graceful Fallback)
├── store/                    # Global state yönetimi (gameStore.ts)
├── types/                    # Global TypeScript arayüzleri ve domain modelleri (Song, GameStage, vb.)
└── utils/                    # Saf (pure) yardımcı fonksiyonlar (formatters, storage)
```

---

## 🏛 Mimari Kurallar ve Sınırlar (Rules of Architecture)

1. **Feature İzolasyonu (Encapsulation):**
   - Bir feature (`features/game`), diğer bir feature'ın alt klasörlerini doğrudan import edemez.
   - Eğer modüller arası paylaşım gerekiyorsa, modülün `index.ts` dosyası üzerinden veya `src/components/`, `src/services/` gibi ortak katmanlara taşınarak yapılmalıdır.

2. **Temiz Importlar (Path Aliases):**
   - Derin göreceli yollar (`../../../../components/ui/Button`) yasaktır.
   - Her zaman `@/` alias'ı kullanılmalıdır:
     ```ts
     import { Button } from '@/components/ui';
     import { useGameRound } from '@/features/game';
     import { ROUTES } from '@/constants/routes';
     ```

3. **Tip Güvenli Çevre Değişkenleri:**
   - `import.meta.env` bileşen veya servisler içinde doğrudan kullanılmaz.
   - Tüm değişkenler `@/config/env` üzerinden tip denetimi ve varsayılan değerlerle okunmalıdır.

4. **Bileşen Sorumlulukları:**
   - `components/ui/` altındaki bileşenler iş mantığı (business logic) içermez, salt UI atomlarıdır (Dumb/Presentational components).
   - `features/` bileşenleri domain ve iş mantığını yönetir (Smart/Container components).

5. **Global State vs Local State:**
   - Sadece tüm uygulamayı ilgilendiren veriler (kullanıcı oturumu, rekor skoru, tema) `store/` katmanında tutulmalıdır.
   - Bir tura veya oyuna özgü anlık veriler feature hook'larında (`useGameRound`) yerel state olarak yönetilmelidir.
