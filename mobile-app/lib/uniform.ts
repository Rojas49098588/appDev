import type { UniformSizes } from './models.ts';

// The pieces each member is assigned a size for, in catalogue order.
// Ties and Belts are managed centrally, not per member.
export const UNIFORM_PIECES: { piece: string; key: keyof UniformSizes }[] = [
  { piece: 'Coats', key: 'coats' },
  { piece: 'Vests', key: 'vests' },
  { piece: 'Bibbers', key: 'bibbers' },
  { piece: 'Pants', key: 'pants' },
];

export const EMPTY_UNIFORM_SIZES: UniformSizes = { coats: '', vests: '', bibbers: '', pants: '' };

// Size assigned for a catalogue piece name; '' when unassigned or not a sized piece.
export function sizeFor(sizes: UniformSizes | undefined, piece: string): string {
  const entry = UNIFORM_PIECES.find((p) => p.piece === piece);
  return (sizes && entry && sizes[entry.key]) || '';
}

// Exact match; an unassigned size never matches.
export function matchesUniformSize(sizes: UniformSizes | undefined, piece: string, query: string): boolean {
  const size = sizeFor(sizes, piece);
  return size !== '' && size === query.trim();
}

export function digitsOnly(text: string): string {
  return text.replace(/\D/g, '');
}
