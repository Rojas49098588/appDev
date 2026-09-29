import { useCallback, useRef, useState } from 'react';
import { readCache, writeCache } from '../lib/cacheStorage';

// List state that mirrors itself into an AsyncStorage cache. `itemsRef` is
// always current, for use inside Realtime callbacks.
export function useCachedList<T extends { id: string }>(cacheKey: string, isValid: (v: unknown) => v is T[]) {
  const [items, setItems] = useState<T[]>([]);
  const [syncedAt, setSyncedAt] = useState<number | null>(null);
  const itemsRef = useRef<T[]>([]);
  // True once server data has arrived, so a slow cache read can't overwrite it.
  const hasServerData = useRef(false);

  const commit = useCallback(
    (next: T[]) => {
      hasServerData.current = true;
      itemsRef.current = next;
      setItems(next);
      const now = Date.now();
      setSyncedAt(now);
      writeCache(cacheKey, next, now).catch((error) => {
        console.warn(`useCachedList: failed to write ${cacheKey}`, error);
      });
    },
    [cacheKey]
  );

  const hydrate = useCallback(async () => {
    const cached = await readCache(cacheKey, isValid);
    if (cached && !hasServerData.current) {
      itemsRef.current = cached.data;
      setItems(cached.data);
      setSyncedAt(cached.syncedAt);
    }
  }, [cacheKey, isValid]);

  const reset = useCallback(() => {
    hasServerData.current = false;
    itemsRef.current = [];
    setItems([]);
    setSyncedAt(null);
  }, []);

  return { items, itemsRef, syncedAt, commit, hydrate, reset };
}
