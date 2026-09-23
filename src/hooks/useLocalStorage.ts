import { useEffect, useState } from 'react';
import { storage } from '@/utils/storage';

export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    return storage.get<T>(key, initialValue);
  });

  useEffect(() => {
    storage.set<T>(key, storedValue);
  }, [key, storedValue]);

  return [storedValue, setStoredValue];
}
