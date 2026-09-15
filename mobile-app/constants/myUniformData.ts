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
const MY_SIZES: Record<string, string> = {
  Coats: '208',
  Vests: '204',
  Bibbers: '212',
  Pants: '208',
  Ties: '—',
  Belts: '—',
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
