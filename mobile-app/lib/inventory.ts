import type { Account, InventoryPiece, PieceType } from './models.ts';
import type { PieceRow } from './rows.ts';
import { rowToPiece } from './mappers.ts';

export type Assignment =
  | { state: 'assigned'; memberId: string; memberName: string }
  | { state: 'unassigned' }
  | { state: 'out_for_repair'; memberId: string | null; memberName: string | null };

const keyOf = (pieceType: string, number: string) => `${pieceType}|${number}`;
const fullName = (a: Account) => `${a.firstName} ${a.lastName}`.trim();
// Matches set_member_numbers: every non-archived profile (staff included) can hold a number.
const isActiveMember = (a: Account) => a.archivedAt === null;

// Who holds each `${pieceType}|${number}`: every non-archived account, any role.
export function ownerIndex(accounts: Account[]): Map<string, Account> {
  const owners = new Map<string, Account>();
  for (const account of accounts) {
    if (!isActiveMember(account)) continue;
    for (const [pieceType, number] of Object.entries(account.numbers)) {
      if (number !== '') owners.set(keyOf(pieceType, number), account);
    }
  }
  return owners;
}

export function assignmentFor(piece: InventoryPiece, owners: Map<string, Account>): Assignment {
  const owner = owners.get(keyOf(piece.pieceType, piece.number));
  if (piece.outForRepair) {
    return { state: 'out_for_repair', memberId: owner?.id ?? null, memberName: owner ? fullName(owner) : null };
  }
  return owner ? { state: 'assigned', memberId: owner.id, memberName: fullName(owner) } : { state: 'unassigned' };
}

// Non-archived accounts' numbers that have no piece of that type and number.
export function unknownNumbers(
  accounts: Account[],
  pieces: InventoryPiece[]
): { memberId: string; memberName: string; pieceType: string; number: string }[] {
  const existing = new Set(pieces.map((p) => keyOf(p.pieceType, p.number)));
  const out: { memberId: string; memberName: string; pieceType: string; number: string }[] = [];
  for (const account of accounts) {
    if (!isActiveMember(account)) continue;
    for (const [pieceType, number] of Object.entries(account.numbers)) {
      if (number !== '' && !existing.has(keyOf(pieceType, number))) {
        out.push({ memberId: account.id, memberName: fullName(account), pieceType, number });
      }
    }
  }
  return out;
}

// One row per distinct number of this type, numerically sorted, a cell per color.
export function numberRows(
  type: PieceType,
  pieces: InventoryPiece[],
  owners: Map<string, Account>
): { number: string; owner: Account | null; cells: Record<string, InventoryPiece | null> }[] {
  const byNumber = new Map<string, InventoryPiece[]>();
  for (const piece of pieces) {
    if (piece.pieceTypeId !== type.id) continue;
    const list = byNumber.get(piece.number);
    if (list) list.push(piece);
    else byNumber.set(piece.number, [piece]);
  }
  return [...byNumber.entries()]
    .sort((a, b) => parseInt(a[0], 10) - parseInt(b[0], 10))
    .map(([number, list]) => ({
      number,
      owner: owners.get(keyOf(type.name, number)) ?? null,
      cells: Object.fromEntries(type.colors.map((color) => [color, list.find((p) => p.color === color) ?? null])),
    }));
}

// Types members see on their own screens: non-retired numbered types that have at
// least one piece, by sortOrder. Counted types (ties, belts) are managed centrally, not per member.
export function memberPieceTypes(types: PieceType[], pieces: InventoryPiece[]): PieceType[] {
  const withPieces = new Set(pieces.map((p) => p.pieceTypeId));
  return types
    .filter((t) => !t.retired && t.kind === 'numbered' && withPieces.has(t.id))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function pieceCount(type: PieceType, pieces: InventoryPiece[]): number {
  if (type.kind === 'counted') return Object.values(type.stock).reduce((sum, n) => sum + n, 0);
  return pieces.filter((p) => p.pieceTypeId === type.id).length;
}

// Attaches each piece row's type name. Rows whose type isn't in `types` are
// reported in `unknownTypeIds` (never dropped silently) so the caller can refetch.
export function mapPiecesToTypes(
  rows: PieceRow[],
  types: PieceType[]
): { pieces: InventoryPiece[]; unknownTypeIds: string[] } {
  const names = new Map(types.map((t) => [t.id, t.name]));
  const pieces: InventoryPiece[] = [];
  const unknown = new Set<string>();
  for (const row of rows) {
    const name = names.get(row.piece_type_id);
    if (name === undefined) unknown.add(row.piece_type_id);
    else pieces.push(rowToPiece(row, name));
  }
  return { pieces, unknownTypeIds: [...unknown] };
}

// Pages through a table past Supabase's 1000-row response cap. `fetchPage(from, to)`
// returns the rows in [from, to]; a page shorter than `pageSize` is the last one.
export async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => Promise<T[]>,
  pageSize = 1000
): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const page = await fetchPage(from, from + pageSize - 1);
    all.push(...page);
    if (page.length < pageSize) return all;
  }
}

// Collects pushed items and hands them to `flush` once per window (the window opens on the
// first push). `cancel` drops anything still waiting, for cleanup.
export function batchByWindow<T>(
  windowMs: number,
  flush: (items: T[]) => void
): { push(item: T): void; cancel(): void } {
  let pending: T[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;
  return {
    push(item) {
      pending.push(item);
      if (timer !== null) return;
      timer = setTimeout(() => {
        const items = pending;
        pending = [];
        timer = null;
        flush(items);
      }, windowMs);
    },
    cancel() {
      if (timer !== null) clearTimeout(timer);
      timer = null;
      pending = [];
    },
  };
}
