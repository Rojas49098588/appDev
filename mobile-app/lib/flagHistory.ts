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

export type PhotoChange = { kind: 'keep' } | { kind: 'set'; localUri: string } | { kind: 'remove' };

// What to upload, save and delete for a flag's photo. Old files are only
// deleted after the flag saves; a freshly uploaded file is deleted if it fails.
// keep is a server decision (submit_flag's p_keep_photo), so savePath is null.
export function planPhotoChange(
  oldPath: string | null,
  change: PhotoChange,
  newPath: string
): { upload: boolean; keepPhoto: boolean; savePath: string | null; deleteAfterSave: string | null; deleteOnFailure: string | null } {
  if (change.kind === 'keep') return { upload: false, keepPhoto: true, savePath: null, deleteAfterSave: null, deleteOnFailure: null };
  if (change.kind === 'remove') return { upload: false, keepPhoto: false, savePath: null, deleteAfterSave: oldPath, deleteOnFailure: null };
  return { upload: true, keepPhoto: false, savePath: newPath, deleteAfterSave: oldPath, deleteOnFailure: newPath };
}
