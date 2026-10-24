import type { Account, InventoryPiece, PieceType } from './models.ts';

export type Assignment =
  | { state: 'assigned'; memberId: string; memberName: string }
  | { state: 'unassigned' }
  | { state: 'out_for_repair'; memberId: string | null; memberName: string | null };

const keyOf = (pieceType: string, number: string) => `${pieceType}|${number}`;
const fullName = (a: Account) => `${a.firstName} ${a.lastName}`.trim();
const isActiveMember = (a: Account) => a.role === 'Member' && a.archivedAt === null;

// Who holds each `${pieceType}|${number}`: active members only (not staff, not archived).
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

// Active members' numbers that have no piece of that type and number.
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

// Types a member can have a number for / see: non-retired, by sortOrder; numbered ones only once they have pieces.
export function memberPieceTypes(types: PieceType[], pieces: InventoryPiece[]): PieceType[] {
  const withPieces = new Set(pieces.map((p) => p.pieceTypeId));
  return types
    .filter((t) => !t.retired && (t.kind === 'counted' || withPieces.has(t.id)))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function pieceCount(type: PieceType, pieces: InventoryPiece[]): number {
  if (type.kind === 'counted') return Object.values(type.stock).reduce((sum, n) => sum + n, 0);
  return pieces.filter((p) => p.pieceTypeId === type.id).length;
}
