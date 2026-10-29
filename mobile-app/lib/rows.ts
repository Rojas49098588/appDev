// Shapes of rows as Supabase returns them (snake_case, matching supabase/schema.sql).
import type { Division, GameStatus, PoloColor, Sport } from './models.ts';

export type ProfileRow = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  instrument: string;
  role: 'Member' | 'Staff';
  phone: string;
  shoe_gender: "Men's" | "Women's" | null;
  shoe_size: string;
  height_feet: string;
  height_inches: string;
  weight: string;
  numbers: Record<string, string>;
  archived_at: string | null;
  created_at: string;
};

// archive_member() builds the snapshot from the profile row plus open flags.
// New snapshots have `numbers`; older ones have the four *_size keys instead.
export type ArchiveSnapshot = Pick<
  ProfileRow,
  | 'email' | 'first_name' | 'last_name' | 'instrument' | 'phone' | 'shoe_gender' | 'shoe_size'
  | 'height_feet' | 'height_inches' | 'weight'
> & {
  numbers?: Record<string, string>;
  coat_size?: string;
  vest_size?: string;
  bibber_size?: string;
  pant_size?: string;
  flags: Pick<FlagRow, 'piece' | 'color' | 'size' | 'status' | 'comment'>[];
};

export type MemberArchiveRow = {
  id: string;
  member_id: string;
  snapshot: ArchiveSnapshot;
  archived_at: string;
  archived_by_name: string;
  restored_at: string | null;
  restored_by_name: string | null;
};

export type ComboRow = {
  id: string;
  label: string;
  sub: string;
  components: string[];
  image_path: string | null;
  created_by: string | null;
  created_at: string;
};

export type GameRow = {
  id: string;
  sport: Sport;
  division: Division | null;
  status: GameStatus;
  opponent: string;
  game_date: string | null;
  // Postgres `time` comes back as 'HH:MM:SS'.
  kickoff_time: string | null;
  call_time: string | null;
  no_call_time: boolean;
  polo_colors: PoloColor[];
  polo_note: string;
  group_number: number | null;
  pre_game_combo_id: string | null;
  halftime_combo_id: string | null;
  after_game_instructions: string;
  instructions_posted_by: string | null;
  instructions_updated_at: string | null;
};

export type PoloColorRow = {
  id: string;
  name: string;
  swatch: string;
  sort_order: number;
  created_at: string;
};

export type FlagRow = {
  id: string;
  member_id: string | null;
  piece: string;
  color: string;
  size: string;
  status: 'dirty' | 'repair';
  comment: string;
  created_at: string;
  updated_at: string;
  member_name: string;
  photo_path: string | null;
  staff_note: string;
  source: 'member' | 'import';
  cleared_at: string | null;
  cleared_by: string | null;
  cleared_by_name: string | null;
};

export type PieceTypeRow = {
  id: string;
  name: string;
  kind: 'numbered' | 'counted';
  colors: string[];
  stock: Record<string, number>;
  sort_order: number;
  retired: boolean;
  created_at: string;
};

export type PieceRow = {
  id: string;
  piece_type_id: string;
  color: string;
  number: string;
  out_for_repair: boolean;
  created_at: string;
};
