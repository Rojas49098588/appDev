import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { ImportSummary, InventoryPiece, PieceKind, PieceType } from '../lib/models';
import type { ImportPayload } from '../lib/import/preview';
import type { PieceRow, PieceTypeRow } from '../lib/rows';
import { rowToPiece, rowToPieceType } from '../lib/mappers';
import { batchByWindow, fetchAllPages, mapPiecesToTypes } from '../lib/inventory';
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
  // Staff only (enforced by the database); each reloads the inventory once when done.
  importInventory: (payload: ImportPayload) => Promise<ImportSummary>;
  createPieceType: (input: {
    name: string; kind: PieceKind; colors: string[]; numbers: string[]; stock: Record<string, number>;
  }) => Promise<string>;
  addPieceColor: (typeId: string, color: string) => Promise<number>;
  addPieceNumber: (typeId: string, number: string, colors: string[]) => Promise<number>;
};

const PIECE_BATCH_MS = 300;

// Notes the import already left on flags, so a preview can skip them (staff can read all flags).
export async function loadImportNotes(): Promise<{ memberName: string; pieceType: string }[]> {
  const rows = await fetchAllPages<{ member_name: string; piece: string }>(async (from, to) => {
    const result = await supabase.from('flags').select('member_name, piece')
      .eq('source', 'import').order('id').range(from, to);
    if (result.error) throw result.error;
    return result.data as { member_name: string; piece: string }[];
  });
  return rows.map((r) => ({ memberName: r.member_name, pieceType: r.piece }));
}

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
        // Paged (Supabase caps a response at 1000 rows); stable order so pages don't overlap.
        const typeRows = await fetchAllPages<PieceTypeRow>(async (from, to) => {
          const result = await supabase.from('piece_types').select('*')
            .order('created_at').order('id').range(from, to);
          if (result.error) throw result.error;
          return result.data as PieceTypeRow[];
        });
        return typeRows.map(rowToPieceType);
      };
      let nextTypes = await fetchTypes();
      const rows = await fetchAllPages<PieceRow>(async (from, to) => {
        const result = await supabase.from('pieces').select('*').order('created_at').order('id').range(from, to);
        if (result.error) throw result.error;
        return result.data as PieceRow[];
      });
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

    // Bursts (an import writes hundreds of pieces) are applied in one commit per window.
    const pieceBatch = batchByWindow<RealtimePostgresChangesPayload<PieceRow>>(PIECE_BATCH_MS, (events) => {
      const names = typeNames(typesRef.current);
      let next = piecesRef.current;
      let needsReload = false;
      for (const payload of events) {
        if (payload.eventType === 'DELETE') {
          const id = (payload.old as Partial<PieceRow>).id;
          if (id) next = removeById(next, id);
          continue;
        }
        const row = payload.new as PieceRow;
        const name = names.get(row.piece_type_id);
        // Its type hasn't arrived yet: refetch (once for the batch) rather than drop the piece.
        if (name === undefined) {
          needsReload = true;
          continue;
        }
        next = upsertById(next, rowToPiece(row, name));
      }
      if (next !== piecesRef.current) commitPieces(next);
      if (needsReload) void reload();
    });

    const pieceChannel = supabase
      .channel(uniqueTopic(`pieces:${userId}`))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pieces' }, (payload) => {
        pieceBatch.push(payload as RealtimePostgresChangesPayload<PieceRow>);
      })
      .subscribe(logChannelFailures('pieces'));

    return () => {
      pieceBatch.cancel();
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

  const importInventory = useCallback(
    async (payload: ImportPayload): Promise<ImportSummary> => {
      const { data, error: rpcError } = await supabase.rpc('import_inventory', { payload });
      if (rpcError) throw rpcError;
      await reload();
      return data as ImportSummary;
    },
    [reload]
  );

  const createPieceType = useCallback(
    async (input: {
      name: string; kind: PieceKind; colors: string[]; numbers: string[]; stock: Record<string, number>;
    }): Promise<string> => {
      const { data, error: rpcError } = await supabase.rpc('create_piece_type', {
        p_name: input.name, p_kind: input.kind, p_colors: input.colors, p_numbers: input.numbers, p_stock: input.stock,
      });
      if (rpcError) throw rpcError;
      await reload();
      return data as string;
    },
    [reload]
  );

  const addPieceColor = useCallback(
    async (typeId: string, color: string): Promise<number> => {
      const { data, error: rpcError } = await supabase.rpc('add_piece_color', { p_type: typeId, p_color: color });
      if (rpcError) throw rpcError;
      await reload();
      return data as number;
    },
    [reload]
  );

  const addPieceNumber = useCallback(
    async (typeId: string, number: string, colors: string[]): Promise<number> => {
      const { data, error: rpcError } = await supabase.rpc('add_piece_number', {
        p_type: typeId, p_number: number, p_colors: colors,
      });
      if (rpcError) throw rpcError;
      await reload();
      return data as number;
    },
    [reload]
  );

  const value = useMemo(
    () => ({
      pieceTypes, pieces: pieceList.items, syncedAt, error, reload, setOutForRepair,
      importInventory, createPieceType, addPieceColor, addPieceNumber,
    }),
    [pieceTypes, pieceList.items, syncedAt, error, reload, setOutForRepair,
      importInventory, createPieceType, addPieceColor, addPieceNumber]
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
