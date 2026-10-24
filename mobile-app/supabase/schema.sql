-- Mustang Closet database schema.
-- Re-runnable and non-destructive: never drops tables or data.
-- Apply with: npm run db:apply

-- ---------- Tables ----------

create table if not exists public.settings (
  id int primary key default 1 check (id = 1),
  invite_code text not null
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  first_name text not null,
  last_name text not null,
  instrument text not null,
  role text not null default 'Member' check (role in ('Member', 'Staff')),
  phone text not null default '',
  shoe_gender text check (shoe_gender in ('Men''s', 'Women''s')),
  shoe_size text not null default '',
  height_feet text not null default '',
  height_inches text not null default '',
  weight text not null default '',
  created_at timestamptz not null default now()
);

-- Member numbers, keyed by piece_types.name ({"Coats":"185"}; no entry = not
-- assigned), and archive state. Added with `add column if not exists` so
-- db:apply can be re-run.
alter table public.profiles add column if not exists numbers jsonb not null default '{}'::jsonb;

-- One-time migration from the old fixed size columns. Runs only while they exist,
-- so re-running is a no-op; data is copied before the columns are dropped.
do $$
declare
  dup record;
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'profiles' and column_name = 'coat_size') then
    update public.profiles set numbers = numbers
      || case when btrim(coat_size) <> '' then jsonb_build_object('Coats', btrim(coat_size)) else '{}'::jsonb end
      || case when btrim(vest_size) <> '' then jsonb_build_object('Vests', btrim(vest_size)) else '{}'::jsonb end
      || case when btrim(bibber_size) <> '' then jsonb_build_object('Bibbers', btrim(bibber_size)) else '{}'::jsonb end
      || case when btrim(pant_size) <> '' then jsonb_build_object('Pants', btrim(pant_size)) else '{}'::jsonb end;
    -- Report (don't fail on) numbers shared by active members: set_member_numbers
    -- only checks new or changed numbers, so staff can still edit these members.
    for dup in
      select t.type, t.num, string_agg(btrim(p.first_name || ' ' || p.last_name), ', ' order by p.first_name) as names
      from public.profiles p
      cross join lateral (values ('Coats', btrim(p.coat_size)), ('Vests', btrim(p.vest_size)),
                                 ('Bibbers', btrim(p.bibber_size)), ('Pants', btrim(p.pant_size))) as t(type, num)
      where p.archived_at is null and t.num <> ''
      group by t.type, t.num
      having count(*) > 1
    loop
      raise notice 'duplicate % number % held by: %', dup.type, dup.num, dup.names;
    end loop;
    alter table public.profiles
      drop column coat_size, drop column vest_size, drop column bibber_size, drop column pant_size;
  end if;
end $$;
drop function if exists public.set_uniform_sizes(uuid, text, text, text, text);
alter table public.profiles add column if not exists archived_at timestamptz;

create table if not exists public.combos (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  sub text not null default '',
  components text[] not null default '{}',
  image_path text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  opponent text not null,
  game_date date not null,
  pre_game_combo_id uuid references public.combos(id) on delete set null,
  halftime_combo_id uuid references public.combos(id) on delete set null,
  after_game_instructions text not null default '',
  instructions_posted_by uuid references public.profiles(id) on delete set null,
  instructions_updated_at timestamptz,
  is_current boolean not null default false
);

create unique index if not exists games_one_current on public.games (is_current) where is_current;

create table if not exists public.flags (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles(id) on delete cascade,
  piece text not null,
  color text not null,
  size text not null,
  status text not null check (status in ('dirty', 'repair')),
  comment text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (member_id, piece, color)
);

-- Flags are kept as history: clearing a flag stamps cleared_*, never deletes.
alter table public.flags add column if not exists photo_path text;
alter table public.flags add column if not exists member_name text not null default '';
alter table public.flags add column if not exists staff_note text not null default '';
alter table public.flags add column if not exists source text not null default 'member';
alter table public.flags add column if not exists cleared_at timestamptz;
alter table public.flags add column if not exists cleared_by uuid references public.profiles(id) on delete set null;
alter table public.flags add column if not exists cleared_by_name text;

do $$
declare c record;
begin
  if not exists (select 1 from pg_constraint where conname = 'flags_source_check' and conrelid = 'public.flags'::regclass) then
    alter table public.flags add constraint flags_source_check check (source in ('member', 'import'));
  end if;
  -- Replace the old one-flag-per-piece unique constraint with a partial index (open flags only).
  for c in
    select conname from pg_constraint
    where conrelid = 'public.flags'::regclass and contype = 'u'
  loop
    execute format('alter table public.flags drop constraint %I', c.conname);
  end loop;
  -- History survives profile deletion: member_id nullable, on delete set null.
  for c in
    select conname from pg_constraint
    where conrelid = 'public.flags'::regclass and contype = 'f' and confrelid = 'public.profiles'::regclass
      and conkey = array[(select attnum from pg_attribute where attrelid = 'public.flags'::regclass and attname = 'member_id')]
  loop
    execute format('alter table public.flags drop constraint %I', c.conname);
  end loop;
end $$;
alter table public.flags alter column member_id drop not null;
alter table public.flags add constraint flags_member_id_fkey
  foreign key (member_id) references public.profiles(id) on delete set null;
create unique index if not exists flags_one_open_per_piece
  on public.flags (member_id, piece, color) where cleared_at is null;

-- Uniform inventory. Numbered types (Coats...) have one pieces row per physical piece;
-- counted types (Ties...) just track stock per color in piece_types.stock.
create table if not exists public.piece_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  kind text not null check (kind in ('numbered', 'counted')),
  colors text[] not null default '{}',
  stock jsonb not null default '{}'::jsonb,
  sort_order int not null default 0,
  retired boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.pieces (
  id uuid primary key default gen_random_uuid(),
  piece_type_id uuid not null references public.piece_types(id) on delete cascade,
  color text not null,
  number text not null check (number ~ '^[0-9]+$'),
  out_for_repair boolean not null default false,
  created_at timestamptz not null default now(),
  unique (piece_type_id, color, number)
);

-- Frozen copies of a member's info, written by archive_member().
create table if not exists public.member_archives (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles(id) on delete cascade,
  snapshot jsonb not null,
  archived_at timestamptz not null default now(),
  archived_by uuid references public.profiles(id) on delete set null,
  archived_by_name text not null default '',
  restored_at timestamptz,
  restored_by_name text
);

create index if not exists member_archives_member on public.member_archives (member_id, archived_at desc);

-- ---------- Helper functions ----------

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'Staff');
$$;

create or replace function public.is_archived() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and archived_at is not null);
$$;

create or replace function public.normalize_code(code text) returns text
language sql immutable as $$
  select upper(btrim(coalesce(code, '')));
$$;

create or replace function public.check_invite_code(code text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.settings
    where public.normalize_code(invite_code) = public.normalize_code(code)
  );
$$;
revoke all on function public.check_invite_code(text) from public;
grant execute on function public.check_invite_code(text) to anon, authenticated;

-- ---------- Sign-up: invite code check + profile creation ----------

create or replace function public.enforce_invite_code() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.check_invite_code(new.raw_user_meta_data ->> 'invite_code') then
    raise exception 'invalid_invite_code';
  end if;
  new.raw_user_meta_data := new.raw_user_meta_data - 'invite_code';
  return new;
end;
$$;

drop trigger if exists on_auth_user_before_insert on auth.users;
create trigger on_auth_user_before_insert
  before insert on auth.users
  for each row execute function public.enforce_invite_code();

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  -- role is always 'Member' here, whatever the client sent.
  insert into public.profiles (
    id, email, first_name, last_name, instrument, role,
    height_feet, height_inches, weight, shoe_gender, shoe_size
  ) values (
    new.id,
    new.email,
    coalesce(meta ->> 'first_name', ''),
    coalesce(meta ->> 'last_name', ''),
    coalesce(meta ->> 'instrument', ''),
    'Member',
    coalesce(meta ->> 'height_feet', ''),
    coalesce(meta ->> 'height_inches', ''),
    coalesce(meta ->> 'weight', ''),
    case when meta ->> 'shoe_gender' in ('Men''s', 'Women''s') then meta ->> 'shoe_gender' end,
    coalesce(meta ->> 'shoe_size', '')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep profiles.email in step with the login email.
create or replace function public.sync_profile_email() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_updated on auth.users;
create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute function public.sync_profile_email();

-- ---------- Profile guard: role, numbers and archive state only via their functions; email only via auth ----------

create or replace function public.guard_profile_update() returns trigger
language plpgsql as $$
begin
  -- auth.uid() is null for the dashboard, the service role and auth's own
  -- triggers, which are trusted.
  if auth.uid() is null then
    return new;
  end if;
  if new.id is distinct from old.id then
    raise exception 'profile id cannot change' using errcode = '42501';
  end if;
  if new.email is distinct from old.email then
    raise exception 'change your email through your account settings' using errcode = '42501';
  end if;
  if new.role is distinct from old.role
     and coalesce(current_setting('app.allow_role_change', true), '') <> 'on' then
    raise exception 'only staff can change roles' using errcode = '42501';
  end if;
  if new.numbers is distinct from old.numbers
     and coalesce(current_setting('app.allow_number_change', true), '') <> 'on' then
    raise exception 'only staff can change member numbers' using errcode = '42501';
  end if;
  if new.archived_at is distinct from old.archived_at
     and coalesce(current_setting('app.allow_archive_change', true), '') <> 'on' then
    raise exception 'only staff can archive members' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_profile_update on public.profiles;
create trigger guard_profile_update
  before update on public.profiles
  for each row execute function public.guard_profile_update();

create or replace function public.set_role(target uuid, new_role text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then
    raise exception 'only staff can change roles' using errcode = '42501';
  end if;
  if target = auth.uid() then
    raise exception 'you cannot change your own role' using errcode = '42501';
  end if;
  if new_role not in ('Member', 'Staff') then
    raise exception 'invalid role' using errcode = '22023';
  end if;
  perform set_config('app.allow_role_change', 'on', true);
  update public.profiles set role = new_role where id = target;
  if not found then
    raise exception 'no such user' using errcode = 'P0002';
  end if;
  perform set_config('app.allow_role_change', 'off', true);
end;
$$;
revoke all on function public.set_role(uuid, text) from public, anon;
grant execute on function public.set_role(uuid, text) to authenticated;

-- ---------- Member numbers: staff only ----------

create or replace function public.set_member_numbers(target uuid, new_numbers jsonb)
returns void
language plpgsql security definer set search_path = public as $$
declare
  cleaned jsonb := '{}'::jsonb;
  kv record;
  val text;
  holder text;
begin
  if not public.is_staff() then
    raise exception 'only staff can change member numbers' using errcode = '42501';
  end if;
  if new_numbers is null or jsonb_typeof(new_numbers) <> 'object' then
    raise exception 'invalid number' using errcode = '22023';
  end if;
  for kv in select key, value from jsonb_each(new_numbers) loop
    if jsonb_typeof(kv.value) <> 'string' then
      raise exception 'invalid number' using errcode = '22023';
    end if;
    val := btrim(kv.value #>> '{}');
    if val = '' then
      continue;
    end if;
    if val !~ '^[0-9]+$' then
      raise exception 'invalid number' using errcode = '22023';
    end if;
    cleaned := cleaned || jsonb_build_object(kv.key, val);
  end loop;

  -- Serialize number assignment so two concurrent calls can't both pass the
  -- uniqueness check below and hand out the same number.
  lock table public.profiles in share row exclusive mode;

  -- Only new or changed numbers are checked, so a pre-existing duplicate never
  -- blocks editing the member's other numbers.
  for kv in
    select c.key, c.value from jsonb_each_text(cleaned) c
    where (select numbers ->> c.key from public.profiles where id = target) is distinct from c.value
  loop
    select btrim(p.first_name || ' ' || p.last_name) into holder
      from public.profiles p
      where p.id <> target and p.archived_at is null and p.numbers ->> kv.key = kv.value
      limit 1;
    if holder is not null then
      raise exception 'number % for % already belongs to %', kv.value, kv.key, holder using errcode = '23505';
    end if;
  end loop;

  perform set_config('app.allow_number_change', 'on', true);
  update public.profiles set numbers = cleaned where id = target;
  if not found then
    raise exception 'no such user' using errcode = 'P0002';
  end if;
  perform set_config('app.allow_number_change', 'off', true);
end;
$$;
revoke all on function public.set_member_numbers(uuid, jsonb) from public, anon;
grant execute on function public.set_member_numbers(uuid, jsonb) to authenticated;

-- ---------- Archive and restore members: staff only ----------

-- Snapshots the member (profile + open flags), keeps their flags, clears their numbers,
-- and blocks login: banned_until stops password sign-in and token refresh,
-- deleting sessions kills existing refresh tokens. RLS (is_archived) covers
-- the up-to-an-hour an already-issued access token still works.
create or replace function public.archive_member(target uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  p public.profiles%rowtype;
  staff_name text;
begin
  if not public.is_staff() then
    raise exception 'only staff can archive members' using errcode = '42501';
  end if;
  if target = auth.uid() then
    raise exception 'you cannot archive yourself' using errcode = '42501';
  end if;
  select * into p from public.profiles where id = target for update;
  if not found then
    raise exception 'no such user' using errcode = 'P0002';
  end if;
  if p.role <> 'Member' then
    raise exception 'only members can be archived; demote staff first' using errcode = '22023';
  end if;
  if p.archived_at is not null then
    raise exception 'this member is already archived' using errcode = '22023';
  end if;

  select btrim(first_name || ' ' || last_name) into staff_name from public.profiles where id = auth.uid();

  insert into public.member_archives (member_id, snapshot, archived_by, archived_by_name)
  values (
    target,
    jsonb_build_object(
      'email', p.email, 'first_name', p.first_name, 'last_name', p.last_name,
      'instrument', p.instrument, 'phone', p.phone, 'shoe_gender', p.shoe_gender,
      'shoe_size', p.shoe_size, 'height_feet', p.height_feet, 'height_inches', p.height_inches,
      'weight', p.weight, 'numbers', p.numbers,
      'flags', coalesce((
        select jsonb_agg(jsonb_build_object(
          'piece', f.piece, 'color', f.color, 'size', f.size, 'status', f.status, 'comment', f.comment
        ) order by f.piece, f.color)
        from public.flags f where f.member_id = target and f.cleared_at is null
      ), '[]'::jsonb)
    ),
    auth.uid(),
    coalesce(staff_name, '')
  );

  perform set_config('app.allow_number_change', 'on', true);
  perform set_config('app.allow_archive_change', 'on', true);
  update public.profiles
    set numbers = '{}'::jsonb, archived_at = now()
    where id = target;
  perform set_config('app.allow_number_change', 'off', true);
  perform set_config('app.allow_archive_change', 'off', true);

  -- A real date, not 'infinity': Supabase Auth can't parse infinity and
  -- fails every sign-in with a schema error instead of 'banned'.
  update auth.users set banned_until = now() + interval '100 years' where id = target;
  delete from auth.sessions where user_id = target;
end;
$$;
revoke all on function public.archive_member(uuid) from public, anon;
grant execute on function public.archive_member(uuid) to authenticated;

create or replace function public.restore_member(target uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  staff_name text;
begin
  if not public.is_staff() then
    raise exception 'only staff can restore members' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = target and archived_at is not null) then
    raise exception 'this member is not archived' using errcode = '22023';
  end if;

  select btrim(first_name || ' ' || last_name) into staff_name from public.profiles where id = auth.uid();

  perform set_config('app.allow_archive_change', 'on', true);
  update public.profiles set archived_at = null where id = target;
  perform set_config('app.allow_archive_change', 'off', true);

  update public.member_archives
    set restored_at = now(), restored_by_name = coalesce(staff_name, '')
    where id = (
      select id from public.member_archives
      where member_id = target and restored_at is null
      order by archived_at desc limit 1
    );

  update auth.users set banned_until = null where id = target;
end;
$$;
revoke all on function public.restore_member(uuid) from public, anon;
grant execute on function public.restore_member(uuid) to authenticated;

-- ---------- flags.updated_at ----------

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists flags_touch_updated_at on public.flags;
create trigger flags_touch_updated_at
  before update on public.flags
  for each row execute function public.touch_updated_at();

-- ---------- Staff names for members ("Posted by ...") ----------
-- Runs as the view owner, so members can see staff names without seeing
-- the rest of any staff profile. Intentional; Supabase's advisor will flag it.
-- `select distinct` (rather than a plain select) is deliberate: it makes the
-- view non-auto-updatable, so Postgres rejects INSERT/UPDATE/DELETE through
-- it outright, as defense in depth on top of the privilege revoke below.
create or replace view public.staff_directory as
  select distinct id, first_name, last_name from public.profiles where role = 'Staff';
-- Revoke from `public` alone does not strip the privileges Supabase grants
-- by default to `authenticated` on every new relation, so `authenticated`
-- must be named explicitly or members retain Supabase's default ALL grant
-- (including DELETE/UPDATE) on this view, bypassing profiles' RLS.
revoke all on public.staff_directory from public, anon, authenticated;
grant select on public.staff_directory to authenticated;

-- ---------- Row-level security ----------

alter table public.settings enable row level security;
revoke all on public.settings from anon, authenticated;

alter table public.profiles enable row level security;
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_staff());
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid() and not public.is_archived()) with check (id = auth.uid());

-- Staff read snapshots; only archive_member/restore_member write them.
alter table public.member_archives enable row level security;
revoke all on public.member_archives from public, anon, authenticated;
grant select on public.member_archives to authenticated;
drop policy if exists member_archives_select on public.member_archives;
create policy member_archives_select on public.member_archives for select to authenticated
  using (public.is_staff());

alter table public.combos enable row level security;
drop policy if exists combos_select on public.combos;
create policy combos_select on public.combos for select to authenticated using (true);
drop policy if exists combos_insert on public.combos;
create policy combos_insert on public.combos for insert to authenticated with check (public.is_staff());
drop policy if exists combos_delete on public.combos;
create policy combos_delete on public.combos for delete to authenticated using (public.is_staff());

alter table public.piece_types enable row level security;
drop policy if exists piece_types_select on public.piece_types;
create policy piece_types_select on public.piece_types for select to authenticated using (true);
drop policy if exists piece_types_insert on public.piece_types;
create policy piece_types_insert on public.piece_types for insert to authenticated with check (public.is_staff());
drop policy if exists piece_types_update on public.piece_types;
create policy piece_types_update on public.piece_types for update to authenticated
  using (public.is_staff()) with check (public.is_staff());
drop policy if exists piece_types_delete on public.piece_types;
create policy piece_types_delete on public.piece_types for delete to authenticated using (public.is_staff());

alter table public.pieces enable row level security;
drop policy if exists pieces_select on public.pieces;
create policy pieces_select on public.pieces for select to authenticated using (true);
drop policy if exists pieces_insert on public.pieces;
create policy pieces_insert on public.pieces for insert to authenticated with check (public.is_staff());
drop policy if exists pieces_update on public.pieces;
create policy pieces_update on public.pieces for update to authenticated
  using (public.is_staff()) with check (public.is_staff());
drop policy if exists pieces_delete on public.pieces;
create policy pieces_delete on public.pieces for delete to authenticated using (public.is_staff());

alter table public.games enable row level security;
drop policy if exists games_select on public.games;
create policy games_select on public.games for select to authenticated using (true);
drop policy if exists games_update on public.games;
create policy games_update on public.games for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

alter table public.flags enable row level security;
drop policy if exists flags_select on public.flags;
create policy flags_select on public.flags for select to authenticated
  using (member_id = auth.uid() or public.is_staff());
drop policy if exists flags_insert_own on public.flags;
create policy flags_insert_own on public.flags for insert to authenticated
  with check (member_id = auth.uid() and cleared_at is null and not public.is_archived());
drop policy if exists flags_update_own on public.flags;
create policy flags_update_own on public.flags for update to authenticated
  using (member_id = auth.uid() and cleared_at is null and not public.is_archived())
  with check (member_id = auth.uid());
drop policy if exists flags_update_staff on public.flags;
create policy flags_update_staff on public.flags for update to authenticated
  using (public.is_staff()) with check (public.is_staff());
-- No delete policy: flags are history. Staff clear them with clear_flag().
drop policy if exists flags_delete_staff on public.flags;

-- ---------- Flag history: name stamp, update guard, submit and clear ----------

create or replace function public.flags_fill_member_name() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Signed-in users (RLS inserts) cannot forge history fields; the service
  -- role and dashboard (auth.uid() is null) can, for imports and tests.
  if auth.uid() is not null then
    new.member_name := '';
    new.source := 'member';
    new.cleared_by := null;
    new.cleared_by_name := null;
    new.created_at := now();
    if not public.is_staff() then
      new.staff_note := '';
    end if;
  end if;
  if new.member_name = '' and new.member_id is not null then
    select btrim(first_name || ' ' || last_name) into new.member_name
      from public.profiles where id = new.member_id;
    new.member_name := coalesce(new.member_name, '');
  end if;
  return new;
end;
$$;

drop trigger if exists flags_fill_member_name on public.flags;
create trigger flags_fill_member_name
  before insert on public.flags
  for each row execute function public.flags_fill_member_name();

update public.flags f
  set member_name = btrim(p.first_name || ' ' || p.last_name)
  from public.profiles p
  where f.member_id = p.id and f.member_name = '';

create or replace function public.guard_flag_update() returns trigger
language plpgsql as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if (new.member_id, new.member_name, new.source, new.created_at,
      new.cleared_at, new.cleared_by, new.cleared_by_name)
     is distinct from
     (old.member_id, old.member_name, old.source, old.created_at,
      old.cleared_at, old.cleared_by, old.cleared_by_name)
     and coalesce(current_setting('app.allow_flag_clear', true), '') <> 'on' then
    raise exception 'flags can only be cleared through clear_flag' using errcode = '42501';
  end if;
  if new.staff_note is distinct from old.staff_note and not public.is_staff() then
    raise exception 'only staff can edit staff notes' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_flag_update on public.flags;
create trigger guard_flag_update
  before update on public.flags
  for each row execute function public.guard_flag_update();

-- Members flag a piece through this: one open flag per (member, piece, color).
-- p_keep_photo: "keep whatever photo the open flag has" is decided here, not by
-- the client's possibly stale cache. On update it keeps the open row's photo_path;
-- on insert (no open flag any more) it stores null. p_photo_path is ignored then.
drop function if exists public.submit_flag(text, text, text, text, text, text);
create or replace function public.submit_flag(
  p_piece text, p_color text, p_size text, p_status text, p_comment text, p_photo_path text,
  p_keep_photo boolean default false
) returns public.flags
language plpgsql security invoker set search_path = public as $$
declare
  result public.flags;
begin
  insert into public.flags (member_id, piece, color, size, status, comment, photo_path)
  values (auth.uid(), p_piece, p_color, p_size, p_status, coalesce(p_comment, ''),
          case when p_keep_photo then null else p_photo_path end)
  on conflict (member_id, piece, color) where cleared_at is null
  do update set status = excluded.status, comment = excluded.comment,
                size = excluded.size,
                photo_path = case when p_keep_photo then flags.photo_path else excluded.photo_path end
  returning * into result;
  return result;
end;
$$;
revoke all on function public.submit_flag(text, text, text, text, text, text, boolean) from public, anon;
grant execute on function public.submit_flag(text, text, text, text, text, text, boolean) to authenticated;

-- Staff clear a flag. Also clears other open flags on the same piece/color/size
-- (the same physical item), unless the size is still Unassigned.
create or replace function public.clear_flag(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  f public.flags%rowtype;
  staff_name text;
begin
  if not public.is_staff() then
    raise exception 'only staff can clear flags' using errcode = '42501';
  end if;
  select * into f from public.flags where id = p_id;
  if not found then
    raise exception 'no such flag' using errcode = 'P0002';
  end if;
  select btrim(first_name || ' ' || last_name) into staff_name from public.profiles where id = auth.uid();

  perform set_config('app.allow_flag_clear', 'on', true);
  update public.flags
    set cleared_at = now(), cleared_by = auth.uid(), cleared_by_name = coalesce(staff_name, '')
    where cleared_at is null
      and (id = p_id
           or (f.size <> 'Unassigned' and piece = f.piece and color = f.color and size = f.size));
  perform set_config('app.allow_flag_clear', 'off', true);
end;
$$;
revoke all on function public.clear_flag(uuid) from public, anon;
grant execute on function public.clear_flag(uuid) to authenticated;

-- ---------- Storage: combo photos ----------

insert into storage.buckets (id, name, public)
values ('combo-images', 'combo-images', false)
on conflict (id) do nothing;

drop policy if exists combo_images_select on storage.objects;
create policy combo_images_select on storage.objects for select to authenticated
  using (bucket_id = 'combo-images');
drop policy if exists combo_images_insert on storage.objects;
create policy combo_images_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'combo-images' and public.is_staff());
drop policy if exists combo_images_delete on storage.objects;
create policy combo_images_delete on storage.objects for delete to authenticated
  using (bucket_id = 'combo-images' and public.is_staff());

-- ---------- Storage: flag photos ----------
-- Private. Path convention: <member uuid>/<anything>.jpg. Members write and read
-- only their own folder (and not while archived); staff read and delete anything.
-- No update policy: photos are replaced, never edited.

insert into storage.buckets (id, name, public)
values ('flag-photos', 'flag-photos', false)
on conflict (id) do nothing;

drop policy if exists flag_photos_select on storage.objects;
create policy flag_photos_select on storage.objects for select to authenticated
  using (
    bucket_id = 'flag-photos'
    and (
      public.is_staff()
      or ((storage.foldername(name))[1] = auth.uid()::text and not public.is_archived())
    )
  );
drop policy if exists flag_photos_insert on storage.objects;
create policy flag_photos_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'flag-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
    and not public.is_archived()
  );
drop policy if exists flag_photos_delete on storage.objects;
create policy flag_photos_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'flag-photos'
    and (
      public.is_staff()
      or ((storage.foldername(name))[1] = auth.uid()::text and not public.is_archived())
    )
  );

-- ---------- Realtime ----------

do $$
declare
  t text;
begin
  foreach t in array array['profiles', 'combos', 'games', 'flags', 'piece_types', 'pieces'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end;
$$;
