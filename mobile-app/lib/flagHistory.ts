import type { Flag } from './models.ts';

export const openFlags = (flags: Flag[]): Flag[] => flags.filter((f) => f.clearedAt === null);

const matches = (f: Flag, piece: string, color: string, size: string) =>
  f.piece === piece && f.color === color && f.size === size;

// Every flag (open and cleared) for one piece, newest first.
export function historyFor(flags: Flag[], piece: string, color: string, size: string): Flag[] {
  return flags
    .filter((f) => matches(f, piece, color, size))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
}

// Chip for a piece from open flags only; repair wins over dirty.
export function chipState(flags: Flag[], piece: string, color: string, size: string): 'repair' | 'dirty' | null {
  const open = openFlags(flags).filter((f) => matches(f, piece, color, size));
  if (open.some((f) => f.status === 'repair')) return 'repair';
  if (open.some((f) => f.status === 'dirty')) return 'dirty';
  return null;
}
