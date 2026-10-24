import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { InventoryPiece, PieceType } from '../lib/models';
import type { PieceRow, PieceTypeRow } from '../lib/rows';
import { rowToPiece, rowToPieceType } from '../lib/mappers';
import { mapPiecesToTypes } from '../lib/inventory';
import { isPieceList, isPieceTypeList } from '../lib/validators';
import { logChannelFailures, removeById, uniqueTopic, upsertById } from '../lib/realtime';
import { CACHE_KEYS } from '../lib/cacheStorage';
import { friendlyError } from '../lib/errors';
import { hasSession, supabase } from '../lib/supabase';
import { useCachedList } from '../hooks/useCachedList';
import { useOnReconnect } from '../hooks/useConnection';
import { useAuth, useOnSessionChange } from './AuthContext';

type InventoryContextValue = {
  // Everyone signed in can read the inventory; only staff can change it (enforced by the database).
  pieceTypes: PieceType[];
  pieces: InventoryPiece[];
  syncedAt: number | null;
  error: string | null;
  reload: () => Promise<void>;
  setOutForRepair: (pieceId: string, value: boolean) => Promise<void>;
};

const InventoryContext = createContext<InventoryContextValue | null>(null);

function sortTypes(list: PieceType[]): PieceType[] {
  return list.slice().sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

function typeNames(types: PieceType[]): Map<string, string> {
  return new Map(types.map((t) => [t.id, t.name]));
}

export function InventoryProvider({ children }: { children: ReactNode }) {
  const { account, sessionVersion } = useAuth();
  const userId = account?.id ?? null;
  const role = account?.role ?? null;
  const types = useCachedList(CACHE_KEYS.pieceTypes, isPieceTypeList);
  const pieceList = useCachedList(CACHE_KEYS.pieces, isPieceList);
  const { itemsRef: typesRef, commit: commitTypes } = types;
  const { itemsRef: piecesRef, commit: commitPieces } = pieceList;
  const [error, setError] = useState<string | null>(null);
  const pieceTypes = useMemo(() => sortTypes(types.items), [types.items]);
  const syncedAt = types.syncedAt !== null && pieceList.syncedAt !== null
    ? Math.min(types.syncedAt, pieceList.syncedAt)
    : null;

  const reload = useCallback(async () => {
    try {
      // No live session: the queries would run as anon and return nothing, so keep the cache.
      if (!(await hasSession())) return;
      // Types first, then pieces, so a piece never outruns its type unless one was
      // added in between; that case is refetched once below.
      const fetchTypes = async () => {
        const result = await supabase.from('piece_types').select('*').order('sort_order');
        if (result.error) throw result.error;
        return (result.data as PieceTypeRow[]).map(rowToPieceType);
      };
      let nextTypes = await fetchTypes();
      const pieceResult = await supabase.from('pieces').select('*').order('created_at');
      if (pieceResult.error) throw pieceResult.error;
      const rows = pieceResult.data as PieceRow[];
      let mapped = mapPiecesToTypes(rows, nextTypes);
      if (mapped.unknownTypeIds.length > 0) {
        nextTypes = await fetchTypes();
        mapped = mapPiecesToTypes(rows, nextTypes);
      }
      const nextPieces = mapped.pieces;
      const unknownCount = mapped.unknownTypeIds.length;
      commitTypes(nextTypes);
      commitPieces(nextPieces);
      setError(unknownCount > 0 ? "Some inventory pieces couldn't be shown. Try again in a moment." : null);
    } catch (loadError) {
      setError(friendlyError(loadError));
    }
  }, [commitTypes, commitPieces]);

  useEffect(() => {
    if (!userId) {
      types.reset();
      pieceList.reset();
      setError(null);
      return;
    }
    void types.hydrate();
    void pieceList.hydrate();
    void reload();

    const typeChannel = supabase
      .channel(uniqueTopic(`piece_types:${userId}`))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'piece_types' }, (payload) => {
        if (payload.eventType === 'DELETE') {
          // Types are retired, not deleted; a delete means pieces may be gone too.
          const id = (payload.old as Partial<PieceTypeRow>).id;
          if (id) commitTypes(removeById(typesRef.current, id));
          void reload();
          return;
        }
        const type = rowToPieceType(payload.new as PieceTypeRow);
        const next = upsertById(typesRef.current, type);
        commitTypes(next);
        // A renamed type changes the name carried by its pieces.
        const names = typeNames(next);
        commitPieces(piecesRef.current.map((p) => ({ ...p, pieceType: names.get(p.pieceTypeId) ?? p.pieceType })));
      })
      .subscribe(logChannelFailures('piece_types'));

    const pieceChannel = supabase
      .channel(uniqueTopic(`pieces:${userId}`))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pieces' }, (payload) => {
        if (payload.eventType === 'DELETE') {
          const id = (payload.old as Partial<PieceRow>).id;
          if (id) commitPieces(removeById(piecesRef.current, id));
          return;
        }
        const row = payload.new as PieceRow;
        const name = typeNames(typesRef.current).get(row.piece_type_id);
        // Its type hasn't arrived yet: refetch rather than drop the piece.
        if (name === undefined) {
          void reload();
          return;
        }
        commitPieces(upsertById(piecesRef.current, rowToPiece(row, name)));
      })
      .subscribe(logChannelFailures('pieces'));

    return () => {
      supabase.removeChannel(typeChannel);
      supabase.removeChannel(pieceChannel);
    };
    // `types` / `pieceList` are new objects each render; their members used here are stable callbacks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, role, reload, commitTypes, commitPieces, typesRef, piecesRef, types.hydrate, types.reset, pieceList.hydrate, pieceList.reset]);

  useOnReconnect(() => {
    if (userId) void reload();
  });
  useOnSessionChange(sessionVersion, () => {
    if (userId) void reload();
  });

  // Staff only (enforced by the database).
  const setOutForRepair = useCallback(
    async (pieceId: string, value: boolean) => {
      const { data, error: saveError } = await supabase
        .from('pieces')
        .update({ out_for_repair: value })
        .eq('id', pieceId)
        .select()
        .maybeSingle();
      if (saveError) throw saveError;
      // RLS hides a refused update as "0 rows" rather than an error.
      if (!data) throw new Error("You don't have permission to do that.");
      const row = data as PieceRow;
      const name = typeNames(typesRef.current).get(row.piece_type_id);
      if (name === undefined) {
        await reload();
        return;
      }
      commitPieces(upsertById(piecesRef.current, rowToPiece(row, name)));
    },
    [commitPieces, piecesRef, typesRef, reload]
  );

  const value = useMemo(
    () => ({ pieceTypes, pieces: pieceList.items, syncedAt, error, reload, setOutForRepair }),
    [pieceTypes, pieceList.items, syncedAt, error, reload, setOutForRepair]
  );

  return <InventoryContext.Provider value={value}>{children}</InventoryContext.Provider>;
}

export function useInventory(): InventoryContextValue {
  const context = useContext(InventoryContext);
  if (!context) {
    throw new Error('useInventory must be used within an InventoryProvider');
  }
  return context;
}
