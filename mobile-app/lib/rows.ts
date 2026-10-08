// Shapes of rows as Supabase returns them (snake_case, matching supabase/schema.sql).

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
  coat_size: string;
  vest_size: string;
  bibber_size: string;
  pant_size: string;
  archived_at: string | null;
  created_at: string;
};

// archive_member() builds the snapshot from the profile row plus open flags.
export type ArchiveSnapshot = Pick<
  ProfileRow,
  | 'email' | 'first_name' | 'last_name' | 'instrument' | 'phone' | 'shoe_gender' | 'shoe_size'
  | 'height_feet' | 'height_inches' | 'weight' | 'coat_size' | 'vest_size' | 'bibber_size' | 'pant_size'
> & {
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
  opponent: string;
  game_date: string;
  pre_game_combo_id: string | null;
  halftime_combo_id: string | null;
  after_game_instructions: string;
  instructions_posted_by: string | null;
  instructions_updated_at: string | null;
  is_current: boolean;
};

export type FlagRow = {
  id: string;
  member_id: string;
  piece: string;
  color: string;
  size: string;
  status: 'dirty' | 'repair';
  comment: string;
  created_at: string;
  updated_at: string;
};
