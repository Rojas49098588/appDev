import { PIECES } from './inventoryData';
import type { UniformSizes } from '../lib/models';
import { UNIFORM_PIECES } from '../lib/uniform';

export type UniformVariant = {
  color: string;
};

export type UniformGroup = {
  piece: string;
  size: string;
  variants: UniformVariant[];
};

function variantsFor(pieceName: string): UniformVariant[] {
  const piece = PIECES.find((p) => p.name === pieceName);
  if (!piece) return [];
  return piece.breakdown.type === 'graded'
    ? piece.breakdown.groups.map((group) => ({ color: group.color }))
    : piece.breakdown.rows.map((row) => ({ color: row.name }));
}

// Shown when staff haven't assigned a size yet.
export const NO_SIZE = '—';
// Recorded on a flag for a piece with no assigned size.
export const UNASSIGNED_SIZE = 'Unassigned';

// Sizes are constant across color variants for the same member; only the
// color/style options themselves come from the piece's catalogue breakdown.
// Staff assign sizes on the member's profile (Account.uniformSizes); size is
// '' until they do. Ties and Belts are staff-managed centrally, not
// tracked per-member — see MY_WHITE_SHIRT below and Account.shoeSize
// (context/AuthContext.tsx) for what replaced them in the member view.
export function uniformFor(sizes: UniformSizes | undefined): UniformGroup[] {
  return UNIFORM_PIECES.map(({ piece, key }) => ({
    piece,
    size: sizes?.[key] ?? '',
    variants: variantsFor(piece),
  }));
}

// Not part of the Staff catalogue (constants/inventoryData.ts) — a
// member-view-only field. Flaggable in My Inventory, but only as Dirty —
// see FlagItemScreen.
export const MY_WHITE_SHIRT = { piece: 'White shirt', color: 'White', size: 'M' };
