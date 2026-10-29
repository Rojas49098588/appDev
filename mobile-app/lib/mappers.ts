import type { Account, Combo, Flag, Game, GameDraft, InventoryPiece, MemberArchive, MemberNumbers, PieceType, PoloColorOption } from './models.ts';
import type { ArchiveSnapshot, ComboRow, FlagRow, GameRow, MemberArchiveRow, PieceRow, PieceTypeRow, PoloColorRow, ProfileRow } from './rows.ts';
import { formatShortDate } from './format.ts';

// Numbers and archive state only change through staff-only database functions.
export type AccountUpdates = Partial<Omit<Account, 'id' | 'role' | 'numbers' | 'archivedAt'>>;

export type ProfileUpdate = Partial<
  Pick<
    ProfileRow,
    'first_name' | 'last_name' | 'instrument' | 'phone' | 'shoe_gender' | 'shoe_size' | 'height_feet' | 'height_inches' | 'weight'
  >
>;

// Old snapshots (taken before numbers existed) hold four fixed size columns.
const OLD_SIZE_KEYS: [keyof ArchiveSnapshot, string][] = [
  ['coat_size', 'Coats'], ['vest_size', 'Vests'], ['bibber_size', 'Bibbers'], ['pant_size', 'Pants'],
];

function snapshotNumbers(s: ArchiveSnapshot): MemberNumbers {
  if (s.numbers) return { ...s.numbers };
  const out: MemberNumbers = {};
  for (const [key, name] of OLD_SIZE_KEYS) {
    const v = s[key];
    if (typeof v === 'string' && v !== '') out[name] = v;
  }
  return out;
}

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
    numbers: row.numbers ?? {},
    archivedAt: row.archived_at ?? null,
  };
}

export function rowToArchive(row: MemberArchiveRow): MemberArchive {
  const s: ArchiveSnapshot = row.snapshot;
  return {
    id: row.id,
    memberId: row.member_id,
    archivedAt: row.archived_at,
    archivedByName: row.archived_by_name,
    restoredAt: row.restored_at,
    restoredByName: row.restored_by_name,
    firstName: s.first_name,
    lastName: s.last_name,
    email: s.email,
    instrument: s.instrument,
    phone: s.phone,
    shoeSize: { gender: s.shoe_gender ?? "Men's", size: s.shoe_size },
    height: { feet: s.height_feet, inches: s.height_inches },
    weight: s.weight,
    numbers: snapshotNumbers(s),
    flags: (s.flags ?? []).map(({ piece, color, size, status, comment }) => ({ piece, color, size, status, comment })),
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

export function rowToFlag(row: FlagRow, photoUrl?: string): Flag {
  return {
    id: row.id,
    memberId: row.member_id,
    piece: row.piece,
    color: row.color,
    size: row.size,
    status: row.status,
    comment: row.comment,
    createdAt: row.created_at,
    memberName: row.member_name,
    photoPath: row.photo_path,
    ...(photoUrl ? { photoUrl } : {}),
    staffNote: row.staff_note,
    source: row.source,
    clearedAt: row.cleared_at,
    clearedByName: row.cleared_by_name,
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

const trimTime = (t: string | null): string | null => (t ? t.slice(0, 5) : null);

export function rowToGame(row: GameRow, postedByName: string): Game {
  return {
    id: row.id,
    sport: row.sport,
    division: row.division,
    status: row.status,
    opponent: row.opponent,
    gameDate: row.game_date,
    kickoffTime: trimTime(row.kickoff_time),
    callTime: trimTime(row.call_time),
    noCallTime: row.no_call_time,
    polo: row.polo_colors ?? [],
    poloNote: row.polo_note,
    groupNumber: row.group_number,
    preGameComboId: row.pre_game_combo_id,
    halftimeComboId: row.halftime_combo_id,
    afterGameInstructions: row.after_game_instructions,
    instructionsPostedBy: postedByName,
    instructionsUpdatedAt: formatShortDate(row.instructions_updated_at),
  };
}

export function gameDraftToRow(d: GameDraft): Partial<GameRow> {
  return {
    sport: d.sport,
    division: d.division,
    opponent: d.opponent.trim(),
    game_date: d.gameDate,
    kickoff_time: d.kickoffTime,
    call_time: d.callTime,
    no_call_time: d.noCallTime,
    polo_colors: d.polo,
    polo_note: d.poloNote,
    group_number: d.groupNumber,
    pre_game_combo_id: d.preGameComboId,
    halftime_combo_id: d.halftimeComboId,
    after_game_instructions: d.afterGameInstructions,
  };
}

export function rowToPoloColor(row: PoloColorRow): PoloColorOption {
  return { id: row.id, name: row.name, swatch: row.swatch, sortOrder: row.sort_order };
}

export function rowToPieceType(row: PieceTypeRow): PieceType {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    colors: row.colors,
    stock: row.stock,
    sortOrder: row.sort_order,
    retired: row.retired,
  };
}

export function rowToPiece(row: PieceRow, typeName: string): InventoryPiece {
  return {
    id: row.id,
    pieceTypeId: row.piece_type_id,
    pieceType: typeName,
    color: row.color,
    number: row.number,
    outForRepair: row.out_for_repair,
  };
}
