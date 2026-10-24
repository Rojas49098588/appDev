import type { HeightValue, Role } from '../navigation/types';

export type ShoeSize = { gender: "Men's" | "Women's"; size: string };

// Piece type name -> the member's number for it (digits). Missing/'' means none.
export type MemberNumbers = Record<string, string>;

export type PieceKind = 'numbered' | 'counted';

export type PieceType = {
  id: string;
  name: string;
  kind: PieceKind;
  colors: string[];
  stock: Record<string, number>;
  sortOrder: number;
  retired: boolean;
};

export type InventoryPiece = {
  id: string;
  pieceTypeId: string;
  // The type's name, filled by the mapper from the types list.
  pieceType: string;
  color: string;
  number: string;
  outForRepair: boolean;
};

export type Account = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  instrument: string;
  role: Role;
  phone: string;
  shoeSize: ShoeSize;
  height: HeightValue;
  weight: string;
  numbers: MemberNumbers;
  // ISO timestamp; null while the account is active.
  archivedAt: string | null;
};

export type FlagStatus = 'dirty' | 'repair';

export type Flag = {
  id: string;
  memberId: string | null;
  piece: string;
  color: string;
  size: string;
  status: FlagStatus;
  comment: string;
  createdAt: string;
  memberName: string;
  photoPath: string | null;
  // Signed URL for display only; never cached as a source of truth.
  photoUrl?: string;
  staffNote: string;
  source: 'member' | 'import';
  clearedAt: string | null;
  clearedByName: string | null;
};

export type Combo = {
  id: string;
  label: string;
  sub: string;
  // Drives the "Components" chips on the Member Game Day screen.
  components?: string[];
  // Path inside the combo-images bucket; needed to delete the photo.
  imagePath?: string;
  // Signed URL for displaying the photo (valid 7 days, refreshed on each load).
  image?: string;
};

export type Game = {
  id: string;
  opponent: string;
  // Display strings, e.g. "Fri, Sep 18" and "Sep 15"; '' when unknown.
  date: string;
  preGameComboId: string | null;
  halftimeComboId: string | null;
  afterGameInstructions: string;
  instructionsPostedBy: string;
  instructionsUpdatedAt: string;
};

export type ArchivedFlag = Pick<Flag, 'piece' | 'color' | 'size' | 'status' | 'comment'>;

// A frozen copy of a member's info, taken when staff archived them.
export type MemberArchive = {
  id: string;
  memberId: string;
  archivedAt: string;
  archivedByName: string;
  restoredAt: string | null;
  restoredByName: string | null;
  firstName: string;
  lastName: string;
  email: string;
  instrument: string;
  phone: string;
  shoeSize: ShoeSize;
  height: HeightValue;
  weight: string;
  numbers: MemberNumbers;
  flags: ArchivedFlag[];
};

export type ImportSummary = {
  typesCreated: number;
  piecesAdded: number;
  markedOutForRepair: number;
  numbersSet: number;
  notesAdded: number;
};
