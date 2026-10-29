import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import type { Game, GameDraft, GameStatus, PoloColorOption } from '../lib/models';
import type { GameRow, PoloColorRow } from '../lib/rows';
import { gameDraftToRow, rowToGame, rowToPoloColor } from '../lib/mappers';
import { isGameList, isPoloColorList } from '../lib/validators';
import { bandToday } from '../lib/games';
import { CACHE_KEYS, readCache, writeCache } from '../lib/cacheStorage';
import { friendlyError } from '../lib/errors';
import { hasSession, supabase } from '../lib/supabase';
import { logChannelFailures, uniqueTopic } from '../lib/realtime';
import { useOnReconnect } from '../hooks/useConnection';
import { useAuth, useOnSessionChange } from './AuthContext';

export type ComboSlot = 'preGame' | 'halftime';

type GamesContextValue = {
  // Every game the signed-in user may read (RLS decides).
  games: Game[];
  poloColors: PoloColorOption[];
  // 'YYYY-MM-DD' in America/Chicago; refreshed every 60s and when the app becomes active.
  today: string;
  syncedAt: number | null;
  error: string | null;
  reload: () => Promise<void>;
  createGame: (d: GameDraft, status: GameStatus) => Promise<Game>;
  updateGame: (id: string, d: GameDraft, status: GameStatus) => Promise<Game>;
  setStatus: (id: string, status: GameStatus) => Promise<void>;
  deleteGame: (id: string) => Promise<void>;
  setGameCombo: (id: string, slot: ComboSlot, comboId: string) => Promise<void>;
  addPoloColor: (name: string, swatch: string) => Promise<void>;
  removePoloColor: (id: string) => Promise<void>;
};

const GamesContext = createContext<GamesContextValue | null>(null);

const NO_PERMISSION = "You don't have permission to do that.";

// Dated games first in date order; undated drafts last.
function sortGames(list: Game[]): Game[] {
  return [...list].sort((a, b) => {
    if (a.gameDate === b.gameDate) return 0;
    if (a.gameDate === null) return 1;
    if (b.gameDate === null) return -1;
    return a.gameDate < b.gameDate ? -1 : 1;
  });
}

const sortPolo = (list: PoloColorOption[]): PoloColorOption[] =>
  [...list].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));

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

export function GamesProvider({ children }: { children: ReactNode }) {
  const { account, sessionVersion } = useAuth();
  const userId = account?.id ?? null;
  const [games, setGames] = useState<Game[]>([]);
  const [poloColors, setPoloColors] = useState<PoloColorOption[]>([]);
  const [today, setToday] = useState(() => bandToday(new Date()));
  const [syncedAt, setSyncedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const gamesRef = useRef<Game[]>([]);
  const poloRef = useRef<PoloColorOption[]>([]);
  const hasServerData = useRef(false);

  const commitGames = useCallback((next: Game[]) => {
    hasServerData.current = true;
    gamesRef.current = next;
    setGames(next);
    const now = Date.now();
    setSyncedAt(now);
    writeCache(CACHE_KEYS.games, next, now).catch((cacheError) => {
      console.warn('GamesContext: failed to cache games', cacheError);
    });
  }, []);

  const commitPolo = useCallback((next: PoloColorOption[]) => {
    poloRef.current = next;
    setPoloColors(next);
    writeCache(CACHE_KEYS.poloColors, next).catch((cacheError) => {
      console.warn('GamesContext: failed to cache polo colors', cacheError);
    });
  }, []);

  const reload = useCallback(async () => {
    try {
      // No live session: the query would run as anon and return nothing, so
      // keep the cache. useOnSessionChange refetches once the token refreshes.
      if (!(await hasSession())) return;
      const [gamesResult, poloResult] = await Promise.all([
        supabase.from('games').select('*').order('game_date', { ascending: true }),
        supabase.from('polo_colors').select('*').order('sort_order', { ascending: true }).order('name', { ascending: true }),
      ]);
      if (gamesResult.error) throw gamesResult.error;
      if (poloResult.error) throw poloResult.error;
      const rows = (gamesResult.data ?? []) as GameRow[];
      // Posted-by names come through staff_directory, once per distinct id.
      const ids = [...new Set(rows.map((r) => r.instructions_posted_by).filter((id): id is string => !!id))];
      const names = new Map(await Promise.all(ids.map(async (id) => [id, await postedByName(id)] as const)));
      commitGames(
        sortGames(rows.map((row) => rowToGame(row, row.instructions_posted_by ? names.get(row.instructions_posted_by) ?? '' : '')))
      );
      commitPolo(sortPolo(((poloResult.data ?? []) as PoloColorRow[]).map(rowToPoloColor)));
      setError(null);
    } catch (loadError) {
      setError(friendlyError(loadError));
    }
  }, [commitGames, commitPolo]);

  useEffect(() => {
    if (!userId) {
      hasServerData.current = false;
      gamesRef.current = [];
      poloRef.current = [];
      setGames([]);
      setPoloColors([]);
      setSyncedAt(null);
      setError(null);
      return;
    }
    readCache(CACHE_KEYS.games, isGameList).then((cached) => {
      if (cached && !hasServerData.current) {
        gamesRef.current = cached.data;
        setGames(cached.data);
        setSyncedAt(cached.syncedAt);
      }
    });
    readCache(CACHE_KEYS.poloColors, isPoloColorList).then((cached) => {
      if (cached && !hasServerData.current) {
        poloRef.current = cached.data;
        setPoloColors(cached.data);
      }
    });
    void reload();
    // game_signal is bumped on every games insert/update/delete, including
    // ones RLS hides from this user (a game moved back to draft), so it is the
    // reliable trigger. polo_colors changes arrive on their own.
    const channel = supabase
      .channel(uniqueTopic(`games:${userId}`))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_signal' }, () => {
        void reload();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'polo_colors' }, () => {
        void reload();
      })
      .subscribe(logChannelFailures('games'));
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, reload]);

  // Keep "today" current so a member's Game day rolls over at Chicago midnight.
  useEffect(() => {
    const tick = () => setToday(bandToday(new Date()));
    const interval = setInterval(tick, 60_000);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') tick();
    });
    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, []);

  useOnReconnect(() => {
    if (userId) void reload();
  });
  useOnSessionChange(sessionVersion, () => {
    if (userId) void reload();
  });

  const applyRow = useCallback(
    async (row: GameRow): Promise<Game> => {
      const existing = gamesRef.current.find((g) => g.id === row.id);
      const name = existing?.instructionsPostedBy || (await postedByName(row.instructions_posted_by));
      const game = rowToGame(row, name);
      const rest = gamesRef.current.filter((g) => g.id !== row.id);
      commitGames(sortGames([...rest, game]));
      return game;
    },
    [commitGames]
  );

  const createGame = useCallback(
    async (d: GameDraft, status: GameStatus) => {
      const { data, error: saveError } = await supabase
        .from('games')
        .insert({ ...gameDraftToRow(d), status })
        .select()
        .single();
      if (saveError) throw saveError;
      return applyRow(data as GameRow);
    },
    [applyRow]
  );

  const updateGame = useCallback(
    async (id: string, d: GameDraft, status: GameStatus) => {
      const { data, error: saveError } = await supabase
        .from('games')
        .update({ ...gameDraftToRow(d), status })
        .eq('id', id)
        .select();
      if (saveError) throw saveError;
      if (!data || data.length === 0) throw new Error(NO_PERMISSION);
      return applyRow(data[0] as GameRow);
    },
    [applyRow]
  );

  const setStatus = useCallback(
    async (id: string, status: GameStatus) => {
      const { data, error: saveError } = await supabase.from('games').update({ status }).eq('id', id).select();
      if (saveError) throw saveError;
      if (!data || data.length === 0) throw new Error(NO_PERMISSION);
      await applyRow(data[0] as GameRow);
    },
    [applyRow]
  );

  const deleteGame = useCallback(
    async (id: string) => {
      const { data, error: deleteError } = await supabase.from('games').delete().eq('id', id).select('id');
      if (deleteError) throw deleteError;
      if (!data || data.length === 0) throw new Error(NO_PERMISSION);
      commitGames(gamesRef.current.filter((g) => g.id !== id));
    },
    [commitGames]
  );

  const setGameCombo = useCallback(
    async (id: string, slot: ComboSlot, comboId: string) => {
      const column = slot === 'preGame' ? 'pre_game_combo_id' : 'halftime_combo_id';
      const { data, error: saveError } = await supabase
        .from('games')
        .update({ [column]: comboId })
        .eq('id', id)
        .select();
      if (saveError) throw saveError;
      if (!data || data.length === 0) throw new Error(NO_PERMISSION);
      await applyRow(data[0] as GameRow);
    },
    [applyRow]
  );

  const addPoloColor = useCallback(
    async (name: string, swatch: string) => {
      const nextOrder = poloRef.current.reduce((max, p) => Math.max(max, p.sortOrder), 0) + 1;
      const { data, error: saveError } = await supabase
        .from('polo_colors')
        .insert({ name: name.trim(), swatch, sort_order: nextOrder })
        .select()
        .single();
      if (saveError) throw saveError;
      commitPolo(sortPolo([...poloRef.current, rowToPoloColor(data as PoloColorRow)]));
    },
    [commitPolo]
  );

  const removePoloColor = useCallback(
    async (id: string) => {
      const { data, error: deleteError } = await supabase.from('polo_colors').delete().eq('id', id).select('id');
      if (deleteError) throw deleteError;
      if (!data || data.length === 0) throw new Error(NO_PERMISSION);
      commitPolo(poloRef.current.filter((p) => p.id !== id));
    },
    [commitPolo]
  );

  const value = useMemo(
    () => ({
      games, poloColors, today, syncedAt, error, reload,
      createGame, updateGame, setStatus, deleteGame, setGameCombo, addPoloColor, removePoloColor,
    }),
    [games, poloColors, today, syncedAt, error, reload,
      createGame, updateGame, setStatus, deleteGame, setGameCombo, addPoloColor, removePoloColor]
  );

  return <GamesContext.Provider value={value}>{children}</GamesContext.Provider>;
}

export function useGames(): GamesContextValue {
  const context = useContext(GamesContext);
  if (!context) {
    throw new Error('useGames must be used within a GamesProvider');
  }
  return context;
}
