import type { Account, Combo, Flag, Game } from './models.ts';
import type { ComboRow, FlagRow, GameRow, ProfileRow } from './rows.ts';
import { formatGameDate, formatShortDate } from './format.ts';

export type AccountUpdates = Partial<Omit<Account, 'id' | 'role'>>;

export type ProfileUpdate = Partial<
  Pick<
    ProfileRow,
    'first_name' | 'last_name' | 'instrument' | 'phone' | 'shoe_gender' | 'shoe_size' | 'height_feet' | 'height_inches' | 'weight'
  >
>;

export function profileToAccount(row: ProfileRow): Account {
  return {
    id: row.id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    instrument: row.instrument,
    role: row.role,
    phone: row.phone,
    shoeSize: { gender: row.shoe_gender ?? "Men's", size: row.shoe_size },
    height: { feet: row.height_feet, inches: row.height_inches },
    weight: row.weight,
  };
}

// Email is deliberately ignored: it changes through Supabase Auth, and a
// database trigger copies it onto the profile.
export function accountUpdatesToProfile(updates: AccountUpdates): ProfileUpdate {
  const patch: ProfileUpdate = {};
  if (updates.firstName !== undefined) patch.first_name = updates.firstName.trim();
  if (updates.lastName !== undefined) patch.last_name = updates.lastName.trim();
  if (updates.instrument !== undefined) patch.instrument = updates.instrument;
  if (updates.phone !== undefined) patch.phone = updates.phone.trim();
  if (updates.shoeSize !== undefined) {
    patch.shoe_gender = updates.shoeSize.gender;
    patch.shoe_size = updates.shoeSize.size;
  }
  if (updates.height !== undefined) {
    patch.height_feet = updates.height.feet;
    patch.height_inches = updates.height.inches;
  }
  if (updates.weight !== undefined) patch.weight = updates.weight;
  return patch;
}

export function rowToFlag(row: FlagRow): Flag {
  return {
    id: row.id,
    memberId: row.member_id,
    piece: row.piece,
    color: row.color,
    size: row.size,
    status: row.status,
    comment: row.comment,
  };
}

export function rowToCombo(row: ComboRow, imageUrl?: string): Combo {
  return {
    id: row.id,
    label: row.label,
    sub: row.sub,
    components: row.components,
    imagePath: row.image_path ?? undefined,
    image: imageUrl,
  };
}

export function rowToGame(row: GameRow, postedByName: string): Game {
  return {
    id: row.id,
    opponent: row.opponent,
    date: formatGameDate(row.game_date),
    preGameComboId: row.pre_game_combo_id,
    halftimeComboId: row.halftime_combo_id,
    afterGameInstructions: row.after_game_instructions,
    instructionsPostedBy: postedByName,
    instructionsUpdatedAt: formatShortDate(row.instructions_updated_at),
  };
}
