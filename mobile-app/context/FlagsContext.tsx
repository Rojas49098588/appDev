import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Flag, FlagStatus } from '../lib/models';
import type { FlagRow } from '../lib/rows';
import { rowToFlag } from '../lib/mappers';
import { isFlagList } from '../lib/validators';
import { logChannelFailures, removeById, uniqueTopic, upsertById } from '../lib/realtime';
import { CACHE_KEYS } from '../lib/cacheStorage';
import { friendlyError } from '../lib/errors';
import { hasSession, supabase } from '../lib/supabase';
import { useCachedList } from '../hooks/useCachedList';
import { useOnReconnect } from '../hooks/useConnection';
import { useAuth, useOnSessionChange } from './AuthContext';

export type FlagInput = { piece: string; color: string; size: string; status: FlagStatus; comment: string };

type FlagsContextValue = {
  // Members only ever receive their own flags (enforced by the database); staff receive all.
  flags: Flag[];
  syncedAt: number | null;
  error: string | null;
  reload: () => Promise<void>;
  addFlag: (input: FlagInput) => Promise<void>;
  updateFlag: (id: string, status: FlagStatus, comment: string) => Promise<void>;
  clearFlag: (id: string) => Promise<void>;
};

const FlagsContext = createContext<FlagsContextValue | null>(null);

export function FlagsProvider({ children }: { children: ReactNode }) {
  const { account, sessionVersion } = useAuth();
  const userId = account?.id ?? null;
  const role = account?.role ?? null;
  const { items: flags, itemsRef, syncedAt, commit, hydrate, reset } = useCachedList(CACHE_KEYS.flags, isFlagList);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      // No live session (e.g. auth-js cooling down after a failed refresh):
      // the query would run as anon and return nothing, so keep the cache.
      // useOnSessionChange refetches once the token is refreshed.
      if (!(await hasSession())) return;
      const { data, error: fetchError } = await supabase.from('flags').select('*').order('created_at');
      if (fetchError) throw fetchError;
      commit((data as FlagRow[]).map(rowToFlag));
      setError(null);
    } catch (loadError) {
      setError(friendlyError(loadError));
    }
  }, [commit]);

  // Re-runs when the role changes, because a promotion changes which flags are visible.
  useEffect(() => {
    if (!userId) {
      reset();
      setError(null);
      return;
    }
    void hydrate();
    void reload();
    const channel = supabase
      .channel(uniqueTopic(`flags:${userId}`))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'flags' }, (payload) => {
        if (payload.eventType === 'DELETE') {
          const id = (payload.old as Partial<FlagRow>).id;
          if (id) commit(removeById(itemsRef.current, id));
          return;
        }
        commit(upsertById(itemsRef.current, rowToFlag(payload.new as FlagRow)));
      })
      .subscribe(logChannelFailures('flags'));
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, role, hydrate, reload, reset, commit, itemsRef]);

  useOnReconnect(() => {
    if (userId) void reload();
  });
  useOnSessionChange(sessionVersion, () => {
    if (userId) void reload();
  });

  const addFlag = useCallback(
    async (input: FlagInput) => {
      if (!userId) throw new Error('Not signed in.');
      // Upsert: if this piece/color is already flagged (e.g. from another
      // device), update that flag instead of failing on the unique rule.
      const { data, error: saveError } = await supabase
        .from('flags')
        .upsert({ member_id: userId, ...input }, { onConflict: 'member_id,piece,color' })
        .select()
        .single();
      if (saveError) throw saveError;
      commit(upsertById(itemsRef.current, rowToFlag(data as FlagRow)));
    },
    [userId, commit, itemsRef]
  );

  const updateFlag = useCallback(
    async (id: string, status: FlagStatus, comment: string) => {
      const { data, error: saveError } = await supabase
        .from('flags')
        .update({ status, comment })
        .eq('id', id)
        .select()
        .single();
      if (saveError) throw saveError;
      commit(upsertById(itemsRef.current, rowToFlag(data as FlagRow)));
    },
    [commit, itemsRef]
  );

  // Staff only (enforced by the database): marks the piece good again.
  const clearFlag = useCallback(
    async (id: string) => {
      const { data, error: deleteError } = await supabase.from('flags').delete().eq('id', id).select('id');
      if (deleteError) throw deleteError;
      // RLS hides a refused delete as "0 rows" rather than an error.
      if (!data || data.length === 0) throw new Error('This flag could not be cleared.');
      commit(removeById(itemsRef.current, id));
    },
    [commit, itemsRef]
  );

  const value = useMemo(
    () => ({ flags, syncedAt, error, reload, addFlag, updateFlag, clearFlag }),
    [flags, syncedAt, error, reload, addFlag, updateFlag, clearFlag]
  );

  return <FlagsContext.Provider value={value}>{children}</FlagsContext.Provider>;
}

export function useFlags(): FlagsContextValue {
  const context = useContext(FlagsContext);
  if (!context) {
    throw new Error('useFlags must be used within a FlagsProvider');
  }
  return context;
}
