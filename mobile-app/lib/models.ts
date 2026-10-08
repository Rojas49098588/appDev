import type { HeightValue, Role } from '../navigation/types';

export type ShoeSize = { gender: "Men's" | "Women's"; size: string };

// One size per piece, the same across colors. '' means not assigned yet.
export type UniformSizes = { coats: string; vests: string; bibbers: string; pants: string };

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
  uniformSizes: UniformSizes;
  // ISO timestamp; null while the account is active.
  archivedAt: string | null;
};

export type FlagStatus = 'dirty' | 'repair';

export type Flag = {
  id: string;
  memberId: string;
  piece: string;
  color: string;
  size: string;
  status: FlagStatus;
  comment: string;
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
  uniformSizes: UniformSizes;
  flags: ArchivedFlag[];
};
