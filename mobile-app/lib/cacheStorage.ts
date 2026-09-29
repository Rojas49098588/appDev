import AsyncStorage from '@react-native-async-storage/async-storage';
import { parseCache, serializeCache, type Cached } from './cache.ts';

export const CACHE_KEYS = {
  account: 'mustang.cache.account.v1',
  accounts: 'mustang.cache.accounts.v1',
  flags: 'mustang.cache.flags.v1',
  combos: 'mustang.cache.combos.v1',
  game: 'mustang.cache.game.v1',
} as const;

// Pre-Supabase storage keys. Their data is discarded (fresh start).
const LEGACY_KEYS = [
  'formation.account.v1',
  'formation.session.v1',
  'formation.accounts.directory.v1',
  'formation.flags.v1',
  'formation.combos.custom.v1',
  'formation.combos.deleted.v1',
  'formation.game.v1',
];

export async function readCache<T>(key: string, isValid: (v: unknown) => v is T): Promise<Cached<T> | null> {
  try {
    return parseCache(await AsyncStorage.getItem(key), isValid);
  } catch (error) {
    console.warn(`cacheStorage: failed to read ${key}`, error);
    return null;
  }
}

export async function writeCache<T>(key: string, data: T, syncedAt: number = Date.now()): Promise<void> {
  await AsyncStorage.setItem(key, serializeCache(data, syncedAt));
}

export async function clearAllCaches(): Promise<void> {
  await AsyncStorage.multiRemove(Object.values(CACHE_KEYS));
}

export async function clearLegacyKeys(): Promise<void> {
  await AsyncStorage.multiRemove(LEGACY_KEYS);
}
