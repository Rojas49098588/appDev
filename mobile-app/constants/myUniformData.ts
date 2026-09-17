import { PIECES } from './inventoryData';

export const MY_MEMBER_NAME = 'Maya Chen';

export type UniformVariant = {
  color: string;
};

export type UniformGroup = {
  piece: string;
  size: string;
  variants: UniformVariant[];
};

// Sizes are constant across color variants for the same member; only the
// color/style options themselves come from the piece's catalogue breakdown.
// Ties and Belts are staff-managed centrally, not tracked per-member — see
// MY_SHOE_SIZE / MY_WHITE_SHIRT below for what replaced them in the member view.
const MY_SIZES: Record<string, string> = {
  Coats: '208',
  Vests: '204',
  Bibbers: '212',
  Pants: '208',
};

function variantsFor(pieceName: string): UniformVariant[] {
  const piece = PIECES.find((p) => p.name === pieceName);
  if (!piece) return [];
  return piece.breakdown.type === 'graded'
    ? piece.breakdown.groups.map((group) => ({ color: group.color }))
    : piece.breakdown.rows.map((row) => ({ color: row.name }));
}

export const MY_UNIFORM: UniformGroup[] = Object.entries(MY_SIZES).map(([piece, size]) => ({
  piece,
  size,
  variants: variantsFor(piece),
}));

// Not part of the Staff catalogue (constants/inventoryData.ts) — these are
// member-view-only fields, read-only in My Sizes, not staff-tracked stock.
export type ShoeSize = { gender: "Men's" | "Women's"; size: string };
export const MY_SHOE_SIZE: ShoeSize = { gender: "Men's", size: '10' };

// Flaggable in My Inventory, but only as Dirty — see FlagItemScreen.
export const MY_WHITE_SHIRT = { piece: 'White shirt', color: 'White', size: 'M' };
