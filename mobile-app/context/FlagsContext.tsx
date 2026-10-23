import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { File } from 'expo-file-system';
import type { Flag, FlagStatus } from '../lib/models';
import type { FlagRow } from '../lib/rows';
import { rowToFlag } from '../lib/mappers';
import { openFlags, planPhotoChange, type PhotoChange } from '../lib/flagHistory';
import { isFlagList } from '../lib/validators';
import { logChannelFailures, removeById, uniqueTopic, upsertById } from '../lib/realtime';
import { CACHE_KEYS } from '../lib/cacheStorage';
import { friendlyError } from '../lib/errors';
import { hasSession, supabase } from '../lib/supabase';
import { useCachedList } from '../hooks/useCachedList';
import { useOnReconnect } from '../hooks/useConnection';
import { useAuth, useOnSessionChange } from './AuthContext';

export type FlagInput = {
  piece: string;
  color: string;
  size: string;
  status: FlagStatus;
  comment: string;
  photo: PhotoChange;
};

export type FlagEdit = { color: string; status: FlagStatus; comment: string; staffNote: string };

type FlagsContextValue = {
  // Members only ever receive their own flags (enforced by the database); staff receive all.
  // `flags` is open flags only; `history` also includes cleared ones.
  flags: Flag[];
  history: Flag[];
  syncedAt: number | null;
  error: string | null;
  reload: () => Promise<void>;
  submitFlag: (input: FlagInput) => Promise<void>;
  clearFlag: (id: string) => Promise<void>;
  editFlag: (id: string, fields: FlagEdit) => Promise<void>;
};

const BUCKET = 'flag-photos';
const SIGNED_URL_SECONDS = 60 * 60 * 24 * 7;

const FlagsContext = createContext<FlagsContextValue | null>(null);

async function signedUrlsFor(rows: FlagRow[]): Promise<Map<string, string>> {
  const paths = rows.map((row) => row.photo_path).filter((path): path is string => !!path);
  if (paths.length === 0) return new Map();
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(paths, SIGNED_URL_SECONDS);
  if (error) throw error;
  const urls = new Map<string, string>();
  for (const entry of data) {
    if (entry.path && entry.signedUrl) urls.set(entry.path, entry.signedUrl);
  }
  return urls;
}

function toFlags(rows: FlagRow[], urls: Map<string, string>): Flag[] {
  return rows.map((row) => rowToFlag(row, row.photo_path ? urls.get(row.photo_path) : undefined));
}

export function FlagsProvider({ children }: { children: ReactNode }) {
  const { account, sessionVersion } = useAuth();
  const userId = account?.id ?? null;
  const role = account?.role ?? null;
  const { items: history, itemsRef, syncedAt, commit, hydrate, reset } = useCachedList(CACHE_KEYS.flags, isFlagList);
  const [error, setError] = useState<string | null>(null);
  const flags = useMemo(() => openFlags(history), [history]);

  const reload = useCallback(async () => {
    try {
      // No live session (e.g. auth-js cooling down after a failed refresh):
      // the query would run as anon and return nothing, so keep the cache.
      // useOnSessionChange refetches once the token is refreshed.
      if (!(await hasSession())) return;
      const { data, error: fetchError } = await supabase.from('flags').select('*').order('created_at');
      if (fetchError) throw fetchError;
      const rows = data as FlagRow[];
      const urls = await signedUrlsFor(rows).catch(() => new Map<string, string>());
      commit(toFlags(rows, urls));
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
        // Flags are no longer deleted, but stay harmless if one ever is.
        if (payload.eventType === 'DELETE') {
          const id = (payload.old as Partial<FlagRow>).id;
          if (id) commit(removeById(itemsRef.current, id));
          return;
        }
        const row = payload.new as FlagRow;
        signedUrlsFor([row])
          .then((urls) => commit(upsertById(itemsRef.current, toFlags([row], urls)[0])))
          .catch(() => commit(upsertById(itemsRef.current, rowToFlag(row))));
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

  const submitFlag = useCallback(
    async (input: FlagInput) => {
      if (!userId) throw new Error('Not signed in.');
      const existing = itemsRef.current.find(
        (f) => f.memberId === userId && f.piece === input.piece && f.color === input.color && f.clearedAt === null
      );
      const newPath = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
      const plan = planPhotoChange(existing?.photoPath ?? null, input.photo, newPath);
      if (plan.upload && input.photo.kind === 'set') {
        const body = await new File(input.photo.localUri).arrayBuffer();
        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(newPath, body, { contentType: 'image/jpeg', upsert: false });
        if (uploadError) throw uploadError;
      }
      const { data, error: saveError } = await supabase
        .rpc('submit_flag', {
          p_piece: input.piece,
          p_color: input.color,
          p_size: input.size,
          p_status: input.status,
          p_comment: input.comment,
          p_photo_path: plan.savePath,
          p_keep_photo: plan.keepPhoto,
        })
        .single();
      if (saveError) {
        if (plan.deleteOnFailure) {
          const { error: cleanupError } = await supabase.storage.from(BUCKET).remove([plan.deleteOnFailure]);
          if (cleanupError) console.warn('Could not remove orphaned flag photo', cleanupError);
        }
        throw saveError;
      }
      const row = data as FlagRow;
      // Only delete the old file if the save updated that same flag. If staff cleared it
      // and our cache was stale, the old file belongs to a cleared row's history.
      if (plan.deleteAfterSave && existing && row.id === existing.id) {
        const { error: removeError } = await supabase.storage.from(BUCKET).remove([plan.deleteAfterSave]);
        if (removeError) console.warn('Could not remove replaced flag photo', removeError);
      }
      commit(upsertById(itemsRef.current, toFlags([row], await signedUrlsFor([row]).catch(() => new Map()))[0]));
    },
    [userId, commit, itemsRef]
  );

  // Staff only (enforced by the database): clears this flag and any other open
  // flag on the same piece, so several rows can change.
  const clearFlag = useCallback(
    async (id: string) => {
      const { error: clearError } = await supabase.rpc('clear_flag', { p_id: id });
      if (clearError) throw clearError;
      await reload();
    },
    [reload]
  );

  // Staff only (enforced by the database).
  const editFlag = useCallback(
    async (id: string, fields: FlagEdit) => {
      const { data, error: saveError } = await supabase
        .from('flags')
        .update({
          color: fields.color,
          status: fields.status,
          comment: fields.comment,
          staff_note: fields.staffNote,
        })
        .eq('id', id)
        .select()
        .maybeSingle();
      if (saveError) throw saveError;
      // RLS hides a refused update as "0 rows" rather than an error.
      if (!data) throw new Error("You don't have permission to do that.");
      const row = data as FlagRow;
      commit(upsertById(itemsRef.current, toFlags([row], await signedUrlsFor([row]).catch(() => new Map()))[0]));
    },
    [commit, itemsRef]
  );

  const value = useMemo(
    () => ({ flags, history, syncedAt, error, reload, submitFlag, clearFlag, editFlag }),
    [flags, history, syncedAt, error, reload, submitFlag, clearFlag, editFlag]
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
