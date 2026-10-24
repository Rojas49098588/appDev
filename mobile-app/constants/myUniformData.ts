import type { InventoryPiece, MemberNumbers, PieceKind, PieceType } from '../lib/models';
import { memberPieceTypes } from '../lib/inventory';
import { numberFor } from '../lib/uniform';

export type UniformVariant = {
  color: string;
};

export type UniformGroup = {
  piece: string;
  kind: PieceKind;
  size: string;
  variants: UniformVariant[];
};

// Shown when staff haven't assigned a size yet.
export const NO_SIZE = '—';
// Recorded on a flag for a piece with no assigned size.
export const UNASSIGNED_SIZE = 'Unassigned';

// One group per piece type a member sees (see memberPieceTypes): numbered types
// once they have pieces in inventory, counted types always. The member's number
// (shown to members as their "size") is the same across colors; staff assign it
// on the member's profile, and it's '' until they do. Counted types have no number.
export function uniformFor(
  types: PieceType[],
  pieces: InventoryPiece[],
  numbers: MemberNumbers | undefined
): UniformGroup[] {
  return memberPieceTypes(types, pieces).map((type) => ({
    piece: type.name,
    kind: type.kind,
    size: type.kind === 'numbered' ? numberFor(numbers, type.name) : '',
    variants: type.colors.map((color) => ({ color })),
  }));
}

// Not part of the staff inventory — a member-view-only field. Flaggable in
// My Inventory, but only as Dirty — see FlagItemScreen.
export const MY_WHITE_SHIRT = { piece: 'White shirt', color: 'White', size: 'M' };
