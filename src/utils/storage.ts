/**
 * Kurumsal Tip Güvenli LocalStorage Yöneticisi
 * In-memory fallback içerir (SSR, Node testleri veya gizli sekme erişim kısıtlamaları için)
 */

const memoryStore: Record<string, string> = {};

function isLocalStorageAvailable(): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  } catch {
    return false;
  }
}

export const storage = {
  get<T>(key: string, defaultValue: T): T {
    try {
      if (isLocalStorageAvailable()) {
        const item = window.localStorage.getItem(key);
        return item ? (JSON.parse(item) as T) : defaultValue;
      }
      const memItem = memoryStore[key];
      return memItem ? (JSON.parse(memItem) as T) : defaultValue;
    } catch (error) {
      console.warn(`[storage.get] Error reading key "${key}":`, error);
      return defaultValue;
    }
  },

  set<T>(key: string, value: T): void {
    try {
      const serialized = JSON.stringify(value);
      if (isLocalStorageAvailable()) {
        window.localStorage.setItem(key, serialized);
      } else {
        memoryStore[key] = serialized;
      }
    } catch (error) {
      console.warn(`[storage.set] Error saving key "${key}":`, error);
    }
  },

  remove(key: string): void {
    try {
      if (isLocalStorageAvailable()) {
        window.localStorage.removeItem(key);
      } else {
        delete memoryStore[key];
      }
    } catch (error) {
      console.warn(`[storage.remove] Error removing key "${key}":`, error);
    }
  },
};
