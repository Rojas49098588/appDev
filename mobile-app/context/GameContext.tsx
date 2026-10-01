import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Game } from '../lib/models';
import type { GameRow } from '../lib/rows';
import { rowToGame } from '../lib/mappers';
import { isGameOrNull } from '../lib/validators';
import { CACHE_KEYS, readCache, writeCache } from '../lib/cacheStorage';
import { friendlyError } from '../lib/errors';
import { hasSession, supabase } from '../lib/supabase';
import { logChannelFailures, uniqueTopic } from '../lib/realtime';
import { useOnReconnect } from '../hooks/useConnection';
import { useAuth, useOnSessionChange } from './AuthContext';

export type ComboSlot = 'preGame' | 'halftime';

type GameContextValue = {
  // null when no game is marked current.
  game: Game | null;
  syncedAt: number | null;
  error: string | null;
  reload: () => Promise<void>;
  setCombo: (slot: ComboSlot, comboId: string) => Promise<void>;
};

const GameContext = createContext<GameContextValue | null>(null);

async function postedByName(id: string | null): Promise<string> {
  if (!id) return '';
  const { data, error } = await supabase
    .from('staff_directory')
    .select('first_name, last_name')
    .eq('id', id)
    .maybeSingle();
  if (error || !data) return '';
  return `${data.first_name} ${data.last_name}`.trim();
}

export function GameProvider({ children }: { children: ReactNode }) {
  const { account, sessionVersion } = useAuth();
  const userId = account?.id ?? null;
  const [game, setGame] = useState<Game | null>(null);
  const [syncedAt, setSyncedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const gameRef = useRef<Game | null>(null);
  const hasServerData = useRef(false);

  const commit = useCallback((next: Game | null) => {
    hasServerData.current = true;
    gameRef.current = next;
    setGame(next);
    const now = Date.now();
    setSyncedAt(now);
    writeCache(CACHE_KEYS.game, next, now).catch((cacheError) => {
      console.warn('GameContext: failed to cache game', cacheError);
    });
  }, []);

  const reload = useCallback(async () => {
    try {
      // No live session (e.g. auth-js cooling down after a failed refresh):
      // the query would run as anon and return nothing, so keep the cache.
      // useOnSessionChange refetches once the token is refreshed.
      if (!(await hasSession())) return;
      const { data, error: fetchError } = await supabase.from('games').select('*').eq('is_current', true).maybeSingle();
      if (fetchError) throw fetchError;
      const row = data as GameRow | null;
      commit(row ? rowToGame(row, await postedByName(row.instructions_posted_by)) : null);
      setError(null);
    } catch (loadError) {
      setError(friendlyError(loadError));
    }
  }, [commit]);

  useEffect(() => {
    if (!userId) {
      hasServerData.current = false;
      gameRef.current = null;
      setGame(null);
      setSyncedAt(null);
      setError(null);
      return;
    }
    readCache(CACHE_KEYS.game, isGameOrNull).then((cached) => {
      if (cached && !hasServerData.current) {
        gameRef.current = cached.data;
        setGame(cached.data);
        setSyncedAt(cached.syncedAt);
      }
    });
    void reload();
    // Any change to games (including a slot cleared by a combo delete, or a
    // different game becoming current) just refetches the current game.
    const channel = supabase
      .channel(uniqueTopic(`games:${userId}`))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games' }, () => {
        void reload();
      })
      .subscribe(logChannelFailures('games'));
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, reload]);

  useOnReconnect(() => {
    if (userId) void reload();
  });
  useOnSessionChange(sessionVersion, () => {
    if (userId) void reload();
  });

  const setCombo = useCallback(
    async (slot: ComboSlot, comboId: string) => {
      const current = gameRef.current;
      if (!current) throw new Error('There is no current game to update.');
      const column = slot === 'preGame' ? 'pre_game_combo_id' : 'halftime_combo_id';
      const { data, error: saveError } = await supabase
        .from('games')
        .update({ [column]: comboId })
        .eq('id', current.id)
        .select()
        .single();
      if (saveError) throw saveError;
      commit(rowToGame(data as GameRow, current.instructionsPostedBy));
    },
    [commit]
  );

  const value = useMemo(
    () => ({ game, syncedAt, error, reload, setCombo }),
    [game, syncedAt, error, reload, setCombo]
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameContextValue {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
}
