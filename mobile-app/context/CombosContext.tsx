import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { File } from 'expo-file-system';
import type { Combo } from '../lib/models';
import type { ComboRow } from '../lib/rows';
import { rowToCombo } from '../lib/mappers';
import { isComboList } from '../lib/validators';
import { removeById, upsertById } from '../lib/realtime';
import { CACHE_KEYS } from '../lib/cacheStorage';
import { friendlyError } from '../lib/errors';
import { supabase } from '../lib/supabase';
import { useCachedList } from '../hooks/useCachedList';
import { useOnReconnect } from '../hooks/useConnection';
import { useAuth } from './AuthContext';

const BUCKET = 'combo-images';
// Photos are private; display URLs are signed and refreshed on every load.
const SIGNED_URL_SECONDS = 60 * 60 * 24 * 7;

export type NewComboInput = { label: string; sub: string; components: string[]; localImageUri: string };

type CombosContextValue = {
  combos: Combo[];
  syncedAt: number | null;
  error: string | null;
  reload: () => Promise<void>;
  addCombo: (input: NewComboInput) => Promise<void>;
  deleteCombo: (id: string) => Promise<void>;
};

const CombosContext = createContext<CombosContextValue | null>(null);

async function signedUrlsFor(rows: ComboRow[]): Promise<Map<string, string>> {
  const paths = rows.map((row) => row.image_path).filter((path): path is string => !!path);
  if (paths.length === 0) return new Map();
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(paths, SIGNED_URL_SECONDS);
  if (error) throw error;
  const urls = new Map<string, string>();
  for (const entry of data) {
    if (entry.path && entry.signedUrl) urls.set(entry.path, entry.signedUrl);
  }
  return urls;
}

function toCombos(rows: ComboRow[], urls: Map<string, string>): Combo[] {
  return rows.map((row) => rowToCombo(row, row.image_path ? urls.get(row.image_path) : undefined));
}

export function CombosProvider({ children }: { children: ReactNode }) {
  const { account } = useAuth();
  const userId = account?.id ?? null;
  const { items: combos, itemsRef, syncedAt, commit, hydrate, reset } = useCachedList(CACHE_KEYS.combos, isComboList);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('combos')
        .select('*')
        .order('created_at')
        .order('label');
      if (fetchError) throw fetchError;
      const rows = data as ComboRow[];
      commit(toCombos(rows, await signedUrlsFor(rows)));
      setError(null);
    } catch (loadError) {
      setError(friendlyError(loadError));
    }
  }, [commit]);

  useEffect(() => {
    if (!userId) {
      reset();
      setError(null);
      return;
    }
    void hydrate();
    void reload();
    const channel = supabase
      .channel(`combos:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'combos' }, (payload) => {
        if (payload.eventType === 'DELETE') {
          const id = (payload.old as Partial<ComboRow>).id;
          if (id) commit(removeById(itemsRef.current, id));
          return;
        }
        const row = payload.new as ComboRow;
        signedUrlsFor([row])
          .then((urls) => commit(upsertById(itemsRef.current, toCombos([row], urls)[0])))
          .catch(() => commit(upsertById(itemsRef.current, rowToCombo(row))));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, hydrate, reload, reset, commit, itemsRef]);

  useOnReconnect(() => {
    if (userId) void reload();
  });

  const addCombo = useCallback(
    async (input: NewComboInput) => {
      if (!userId) throw new Error('Not signed in.');
      // Upload the photo first; only create the combo if that worked.
      const path = `combo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
      const body = await new File(input.localImageUri).arrayBuffer();
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, body, { contentType: 'image/jpeg', upsert: false });
      if (uploadError) throw uploadError;

      const { data, error: insertError } = await supabase
        .from('combos')
        .insert({
          label: input.label,
          sub: input.sub,
          components: input.components,
          image_path: path,
          created_by: userId,
        })
        .select()
        .single();
      if (insertError) {
        await supabase.storage.from(BUCKET).remove([path]);
        throw insertError;
      }
      const row = data as ComboRow;
      commit(upsertById(itemsRef.current, toCombos([row], await signedUrlsFor([row]).catch(() => new Map()))[0]));
    },
    [userId, commit, itemsRef]
  );

  const deleteCombo = useCallback(
    async (id: string) => {
      const combo = itemsRef.current.find((c) => c.id === id);
      const { data, error: deleteError } = await supabase.from('combos').delete().eq('id', id).select('id');
      if (deleteError) throw deleteError;
      if (!data || data.length === 0) throw new Error("You don't have permission to do that.");
      commit(removeById(itemsRef.current, id));
      if (combo?.imagePath) {
        const { error: removeError } = await supabase.storage.from(BUCKET).remove([combo.imagePath]);
        if (removeError) console.warn('CombosContext: combo deleted but photo was not', removeError);
      }
    },
    [commit, itemsRef]
  );

  const value = useMemo(
    () => ({ combos, syncedAt, error, reload, addCombo, deleteCombo }),
    [combos, syncedAt, error, reload, addCombo, deleteCombo]
  );

  return <CombosContext.Provider value={value}>{children}</CombosContext.Provider>;
}

export function useCombos(): CombosContextValue {
  const context = useContext(CombosContext);
  if (!context) {
    throw new Error('useCombos must be used within a CombosProvider');
  }
  return context;
}
