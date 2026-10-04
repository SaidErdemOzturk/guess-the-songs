/**
 * Saniye cinsinden süreyi "mm:ss" formatına dönüştürür.
 */
export const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

/**
 * Sayıyı yerel biçimlendirme ile string'e dönüştürür (örn: 1.250).
 */
export const formatScore = (score: number): string => {
  return new Intl.NumberFormat('tr-TR').format(score);
};

/**
 * Şarkı adı ve tahmin karşılaştırmasını normalize eder.
 */
export const normalizeText = (text: string): string => {
  return cleanTurkishText(text);
};

/**
 * Türkçe ve özel karakterleri arama ve karşılaştırma için normalize eder.
 */
export const cleanTurkishText = (text: string): string => {
  if (!text) return '';
  return text
    .toLocaleLowerCase('tr-TR')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[.,/#!$%^&*;:{}=\-_`~()[\]|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

