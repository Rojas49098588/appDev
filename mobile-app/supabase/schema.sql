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
alter table public.profiles add column if not exists archived_at timestamptz;

-- Piece and member numbers: trimmed digits, leading zeros stripped ('085' -> '85',
-- '000' -> '0'). Null for anything that isn't digits, so writers can refuse it.
create or replace function public.normalize_number(t text) returns text
language sql immutable set search_path = public as $$
  select case when btrim(t) ~ '^[0-9]+$' then coalesce(nullif(ltrim(btrim(t), '0'), ''), '0') end;
$$;

-- normalize_number, but raises for a missing or non-digit number.
create or replace function public.require_number(t text) returns text
language plpgsql immutable set search_path = public as $$
declare
  n text := public.normalize_number(t);
begin
  if n is null then
    raise exception 'invalid number' using errcode = '22023';
  end if;
  return n;
end;
$$;

-- One-time migration from the old fixed size columns. Runs only while they exist,
-- so re-running is a no-op; data is copied before the columns are dropped.
do $$
declare
  dup record;
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'profiles' and column_name = 'coat_size') then
    update public.profiles set numbers = numbers
      || case when btrim(coat_size) <> '' then jsonb_build_object('Coats', coalesce(public.normalize_number(coat_size), btrim(coat_size))) else '{}'::jsonb end
      || case when btrim(vest_size) <> '' then jsonb_build_object('Vests', coalesce(public.normalize_number(vest_size), btrim(vest_size))) else '{}'::jsonb end
      || case when btrim(bibber_size) <> '' then jsonb_build_object('Bibbers', coalesce(public.normalize_number(bibber_size), btrim(bibber_size))) else '{}'::jsonb end
      || case when btrim(pant_size) <> '' then jsonb_build_object('Pants', coalesce(public.normalize_number(pant_size), btrim(pant_size))) else '{}'::jsonb end;
    -- Report (don't fail on) numbers shared by active members: set_member_numbers
    -- only checks new or changed numbers, so staff can still edit these members.
    for dup in
      select t.type, t.num, string_agg(btrim(p.first_name || ' ' || p.last_name), ', ' order by p.first_name) as names
      from public.profiles p
      cross join lateral (values ('Coats', coalesce(public.normalize_number(p.coat_size), btrim(p.coat_size))),
                                 ('Vests', coalesce(public.normalize_number(p.vest_size), btrim(p.vest_size))),
                                 ('Bibbers', coalesce(public.normalize_number(p.bibber_size), btrim(p.bibber_size))),
                                 ('Pants', coalesce(public.normalize_number(p.pant_size), btrim(p.pant_size)))) as t(type, num)
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

-- Strips leading zeros from digit-only member numbers ('085' -> '85'); other values are
-- left alone. Re-runnable: rows already normalized are not touched. Runs on every
-- db:apply, where auth.uid() is null so guard_profile_update allows it. Returns rows changed.
create or replace function public.normalize_member_numbers() returns int
language plpgsql set search_path = public as $$
declare
  cnt int;
begin
  update public.profiles p
    set numbers = (select jsonb_object_agg(e.key, coalesce(public.normalize_number(e.value), e.value))
                   from jsonb_each_text(p.numbers) e)
    where exists (select 1 from jsonb_each_text(p.numbers) e
                  where public.normalize_number(e.value) is distinct from e.value
                    and public.normalize_number(e.value) is not null);
  get diagnostics cnt = row_count;
  return cnt;
end;
$$;
revoke all on function public.normalize_member_numbers() from public, anon, authenticated;
select public.normalize_member_numbers();

create table if not exists public.combos (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  sub text not null default '',
  components text[] not null default '{}',
  image_path text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Today for the band: the calendar date in Chicago, whatever the server's or the phone's timezone.
create or replace function public.band_today() returns date
language sql stable
set search_path = public
as $$ select (now() at time zone 'America/Chicago')::date $$;
grant execute on function public.band_today() to authenticated;

create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  sport text not null default 'football',
  division text,
  status text not null default 'draft',
  opponent text not null default '',
  game_date date,
  kickoff_time time,
  call_time time,
  no_call_time boolean not null default false,
  polo_colors jsonb not null default '[]',
  polo_note text not null default '',
  group_number int,
  pre_game_combo_id uuid references public.combos(id) on delete set null,
  halftime_combo_id uuid references public.combos(id) on delete set null,
  after_game_instructions text not null default '',
  instructions_posted_by uuid references public.profiles(id) on delete set null,
  instructions_updated_at timestamptz
);

-- Existing databases: bring the older games table up to the columns above.
alter table public.games add column if not exists sport text not null default 'football';
alter table public.games add column if not exists division text;
alter table public.games add column if not exists status text not null default 'draft';
alter table public.games add column if not exists kickoff_time time;
alter table public.games add column if not exists call_time time;
alter table public.games add column if not exists no_call_time boolean not null default false;
alter table public.games add column if not exists polo_colors jsonb not null default '[]';
alter table public.games add column if not exists polo_note text not null default '';
alter table public.games add column if not exists group_number int;
alter table public.games alter column game_date drop not null;
alter table public.games alter column opponent set default '';
drop index if exists public.games_one_current;
alter table public.games drop column if exists is_current;

alter table public.games drop constraint if exists games_sport_check;
alter table public.games add constraint games_sport_check check (sport in ('football', 'basketball', 'volleyball'));
alter table public.games drop constraint if exists games_division_check;
alter table public.games add constraint games_division_check check (division in ('mens', 'womens'));
alter table public.games drop constraint if exists games_status_check;
alter table public.games add constraint games_status_check check (status in ('draft', 'ready'));
alter table public.games drop constraint if exists games_group_number_check;
alter table public.games add constraint games_group_number_check check (group_number between 1 and 5);
alter table public.games drop constraint if exists games_polo_colors_check;
alter table public.games add constraint games_polo_colors_check check (jsonb_typeof(polo_colors) = 'array');

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

-- The one place member numbers are written (set_member_numbers, import_inventory).
-- cleaned: {type: normalized number}. merge = keep the member's other numbers.
-- Rule: one active member per type + number; only new or changed numbers are
-- checked, so a pre-existing duplicate never blocks editing the member's other
-- numbers. Returns how many numbers were new or changed.
create or replace function public.apply_member_numbers(target uuid, cleaned jsonb, merge boolean)
returns int
language plpgsql security definer set search_path = public as $$
declare
  current_numbers jsonb;
  final jsonb;
  kv record;
  holder text;
  changed int := 0;
begin
  if not public.is_staff() then
    raise exception 'only staff can change member numbers' using errcode = '42501';
  end if;

  -- Serialize number assignment so two concurrent calls can't both pass the
  -- uniqueness check below and hand out the same number.
  lock table public.profiles in share row exclusive mode;

  select numbers into current_numbers from public.profiles where id = target;
  if not found then
    raise exception 'no such user' using errcode = 'P0002';
  end if;
  final := case when merge then current_numbers || cleaned else cleaned end;

  for kv in
    select c.key, c.value from jsonb_each_text(cleaned) c
    where public.normalize_number(current_numbers ->> c.key) is distinct from c.value
  loop
    changed := changed + 1;
    select btrim(p.first_name || ' ' || p.last_name) into holder
      from public.profiles p
      where p.id <> target and p.archived_at is null
        and public.normalize_number(p.numbers ->> kv.key) = kv.value
      limit 1;
    if holder is not null then
      raise exception 'number % for % already belongs to %', kv.value, kv.key, holder using errcode = '23505';
    end if;
  end loop;

  if exists (select 1 from public.profiles where id = target and archived_at is not null) then
    raise exception 'this member is archived' using errcode = '22023';
  end if;

  if final is distinct from current_numbers then
    perform set_config('app.allow_number_change', 'on', true);
    update public.profiles set numbers = final where id = target;
    perform set_config('app.allow_number_change', 'off', true);
  end if;
  return changed;
end;
$$;
revoke all on function public.apply_member_numbers(uuid, jsonb, boolean) from public, anon, authenticated;

create or replace function public.set_member_numbers(target uuid, new_numbers jsonb)
returns void
language plpgsql security definer set search_path = public as $$
declare
  cleaned jsonb := '{}'::jsonb;
  kv record;
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
    if btrim(kv.value #>> '{}') = '' then
      continue;
    end if;
    cleaned := cleaned || jsonb_build_object(kv.key, public.require_number(kv.value #>> '{}'));
  end loop;

  perform public.apply_member_numbers(target, cleaned, false);
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
create policy games_select on public.games for select to authenticated
  using (public.is_staff() or (status = 'ready' and game_date >= public.band_today() and not public.is_archived()));
drop policy if exists games_insert on public.games;
create policy games_insert on public.games for insert to authenticated with check (public.is_staff());
drop policy if exists games_update on public.games;
create policy games_update on public.games for update to authenticated
  using (public.is_staff()) with check (public.is_staff());
drop policy if exists games_delete on public.games;
create policy games_delete on public.games for delete to authenticated using (public.is_staff());

-- Normalizes a game on every save, refuses "ready" when a required field is
-- missing, and stamps who last changed the after-game instructions. Past ready
-- games are exempt from the check so a combo delete (FK set null) still works.
create or replace function public.games_check_ready() returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.opponent := btrim(new.opponent);
  if new.no_call_time then
    new.call_time := null;
  end if;
  if new.sport = 'football' then
    new.division := null;
    new.group_number := null;
  else
    new.pre_game_combo_id := null;
    new.halftime_combo_id := null;
    new.after_game_instructions := '';
  end if;

  if new.status = 'ready' and (new.game_date is null or new.game_date >= public.band_today()) then
    if new.opponent = ''
       or new.game_date is null
       or new.kickoff_time is null
       or (new.call_time is null and not new.no_call_time)
       or jsonb_array_length(new.polo_colors) < 1
       or (new.sport = 'football' and (new.pre_game_combo_id is null or new.halftime_combo_id is null))
       or (new.sport <> 'football' and (new.division is null or new.group_number is null))
    then
      raise exception 'Fill in every required field before marking this game ready.' using errcode = '23514';
    end if;
  end if;

  if tg_op = 'INSERT' or new.after_game_instructions is distinct from old.after_game_instructions then
    if btrim(new.after_game_instructions) = '' then
      new.instructions_posted_by := null;
      new.instructions_updated_at := null;
    else
      new.instructions_posted_by := auth.uid();
      new.instructions_updated_at := now();
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.games_check_ready() from public, anon, authenticated;
drop trigger if exists games_check_ready on public.games;
create trigger games_check_ready
  before insert or update on public.games
  for each row execute function public.games_check_ready();

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
  -- import_inventory sets app.allow_import_flags (transaction-local) so its
  -- rows keep source 'import' and the sheet's member_name.
  if auth.uid() is not null then
    if coalesce(current_setting('app.allow_import_flags', true), '') <> 'on' then
      new.member_name := '';
      new.source := 'member';
    end if;
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

-- ---------- Inventory: piece checks, import and adding inventory (staff only) ----------

-- A piece belongs to a numbered type and uses one of its colors.
create or replace function public.pieces_check_type() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  t public.piece_types%rowtype;
begin
  select * into t from public.piece_types where id = new.piece_type_id;
  if not found then
    return new; -- the foreign key rejects it
  end if;
  if t.kind <> 'numbered' then
    raise exception '% is not a numbered type', t.name using errcode = '22023';
  end if;
  if not (new.color = any(t.colors)) then
    raise exception '% is not a % color', new.color, t.name using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists pieces_check_type on public.pieces;
create trigger pieces_check_type
  before insert or update of piece_type_id, color on public.pieces
  for each row execute function public.pieces_check_type();

-- Trimmed, non-blank entries of a text array, in order.
create or replace function public.clean_list(items text[]) returns text[]
language sql immutable set search_path = public as $$
  select coalesce(array_agg(btrim(x.item) order by x.i), '{}')
  from unnest(coalesce(items, '{}')) with ordinality as x(item, i)
  where btrim(x.item) <> '';
$$;

-- The piece type with exactly this name, or a 22023 error.
create or replace function public.piece_type_named(p_name text) returns public.piece_types
language plpgsql stable security definer set search_path = public as $$
declare
  t public.piece_types%rowtype;
begin
  select * into t from public.piece_types where name = btrim(coalesce(p_name, ''));
  if not found then
    raise exception 'no piece type named %', p_name using errcode = '22023';
  end if;
  return t;
end;
$$;
revoke all on function public.piece_type_named(text) from public, anon, authenticated;

-- Applies a spreadsheet import in one transaction (any error rolls it all back).
-- A merge: never deletes pieces or clears numbers; re-running the same payload
-- changes nothing. Payload shape: lib/import/preview.ts ImportPayload.
create or replace function public.import_inventory(payload jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  item jsonb;
  m record;
  t public.piece_types%rowtype;
  n text;
  v_name text;
  v_colors text[];
  cnt int;
  types_created int := 0;
  pieces_added int := 0;
  marked int := 0;
  numbers_set int := 0;
  notes_added int := 0;
begin
  if not public.is_staff() then
    raise exception 'only staff can import inventory' using errcode = '42501';
  end if;
  if payload is null or jsonb_typeof(payload) <> 'object' then
    raise exception 'invalid import' using errcode = '22023';
  end if;

  -- 1. Types first: the other lists may refer to them.
  for item in select * from jsonb_array_elements(coalesce(payload -> 'typesToCreate', '[]')) loop
    v_name := btrim(coalesce(item ->> 'name', ''));
    if v_name = '' then
      raise exception 'invalid import' using errcode = '22023';
    end if;
    if exists (select 1 from public.piece_types where name = v_name) then
      continue;
    end if;
    v_colors := public.clean_list(array(select jsonb_array_elements_text(coalesce(item -> 'colors', '[]'))));
    if cardinality(v_colors) = 0 then
      raise exception 'a numbered type needs at least one color' using errcode = '22023';
    end if;
    insert into public.piece_types (name, kind, colors, sort_order)
    values (v_name, 'numbered', v_colors, (select coalesce(max(sort_order), -1) + 1 from public.piece_types));
    types_created := types_created + 1;
  end loop;

  -- 2. Each number in every color of its type.
  for item in select * from jsonb_array_elements(coalesce(payload -> 'piecesToAdd', '[]')) loop
    t := public.piece_type_named(item ->> 'pieceType');
    n := public.require_number(item ->> 'number');
    insert into public.pieces (piece_type_id, color, number)
      select t.id, c, n from unnest(t.colors) as c
      on conflict (piece_type_id, color, number) do nothing;
    get diagnostics cnt = row_count;
    pieces_added := pieces_added + cnt;
  end loop;

  -- 3. Out for repair, creating the piece if it doesn't exist yet.
  for item in select * from jsonb_array_elements(coalesce(payload -> 'outForRepair', '[]')) loop
    t := public.piece_type_named(item ->> 'pieceType');
    n := public.require_number(item ->> 'number');
    insert into public.pieces (piece_type_id, color, number, out_for_repair)
      values (t.id, btrim(coalesce(item ->> 'color', '')), n, true)
      on conflict (piece_type_id, color, number) do update set out_for_repair = true
      where pieces.out_for_repair = false;
    get diagnostics cnt = row_count;
    marked := marked + cnt;
  end loop;

  -- 4. Numbers, merged into each member's numbers (same rule as set_member_numbers).
  for m in
    select e ->> 'memberId' as member_id,
           jsonb_object_agg(btrim(e ->> 'pieceType'), public.require_number(e ->> 'number')) as nums
    from jsonb_array_elements(coalesce(payload -> 'numbers', '[]')) as e
    group by e ->> 'memberId'
    order by e ->> 'memberId'
  loop
    numbers_set := numbers_set + public.apply_member_numbers(m.member_id::uuid, m.nums, true);
  end loop;

  -- 5. Notes: staff-only repair history (member_id null), one per color, once per name + piece.
  perform set_config('app.allow_import_flags', 'on', true);
  for item in select * from jsonb_array_elements(coalesce(payload -> 'notes', '[]')) loop
    t := public.piece_type_named(item ->> 'pieceType');
    n := public.require_number(item ->> 'number');
    v_name := btrim(coalesce(item ->> 'memberName', ''));
    if v_name = '' then
      raise exception 'invalid import' using errcode = '22023';
    end if;
    if exists (select 1 from public.flags
               where source = 'import' and member_name = v_name and piece = t.name) then
      continue;
    end if;
    insert into public.flags (member_id, member_name, piece, color, size, status, comment, source)
      select null, v_name, t.name, c, n, 'repair', coalesce(item ->> 'text', ''), 'import'
      from unnest(t.colors) as c;
    notes_added := notes_added + 1;
  end loop;
  perform set_config('app.allow_import_flags', 'off', true);

  return jsonb_build_object(
    'typesCreated', types_created, 'piecesAdded', pieces_added, 'markedOutForRepair', marked,
    'numbersSet', numbers_set, 'notesAdded', notes_added
  );
end;
$$;
revoke all on function public.import_inventory(jsonb) from public, anon;
grant execute on function public.import_inventory(jsonb) to authenticated;

-- New piece type. Numbered: every number x color becomes a piece. Counted:
-- p_stock is {color: whole number >= 0} for colors in p_colors.
create or replace function public.create_piece_type(
  p_name text, p_kind text, p_colors text[], p_numbers text[], p_stock jsonb
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_colors text[] := public.clean_list(p_colors);
  v_numbers text[];
  v_stock jsonb := '{}'::jsonb;
  dup text;
  kv record;
  new_id uuid;
begin
  if not public.is_staff() then
    raise exception 'only staff can add inventory' using errcode = '42501';
  end if;
  if v_name = '' then
    raise exception 'a piece type needs a name' using errcode = '22023';
  end if;
  if p_kind is null or p_kind not in ('numbered', 'counted') then
    raise exception 'invalid piece kind' using errcode = '22023';
  end if;
  select min(c) into dup from unnest(v_colors) as c group by lower(c) having count(*) > 1 limit 1;
  if dup is not null then
    raise exception '% is listed twice as a color', dup using errcode = '22023';
  end if;
  if exists (select 1 from public.piece_types where lower(name) = lower(v_name)) then
    raise exception 'a piece type named % already exists', v_name using errcode = '23505';
  end if;

  if p_kind = 'numbered' then
    if cardinality(v_colors) = 0 then
      raise exception 'a numbered type needs at least one color' using errcode = '22023';
    end if;
    select coalesce(array_agg(distinct public.require_number(x)), '{}') into v_numbers
      from unnest(public.clean_list(p_numbers)) as x;
  else
    if p_stock is not null and jsonb_typeof(p_stock) <> 'object' then
      raise exception 'invalid stock' using errcode = '22023';
    end if;
    for kv in select key, value from jsonb_each(coalesce(p_stock, '{}'::jsonb)) loop
      if not (kv.key = any(v_colors)) then
        raise exception '% is not a % color', kv.key, v_name using errcode = '22023';
      end if;
      if jsonb_typeof(kv.value) <> 'number' then
        raise exception 'stock must be a whole number, 0 or more' using errcode = '22023';
      end if;
      if (kv.value #>> '{}')::numeric < 0 or (kv.value #>> '{}')::numeric <> trunc((kv.value #>> '{}')::numeric) then
        raise exception 'stock must be a whole number, 0 or more' using errcode = '22023';
      end if;
      v_stock := v_stock || jsonb_build_object(kv.key, (kv.value #>> '{}')::int);
    end loop;
  end if;

  begin
    insert into public.piece_types (name, kind, colors, stock, sort_order)
    values (v_name, p_kind, v_colors, v_stock, (select coalesce(max(sort_order), -1) + 1 from public.piece_types))
    returning id into new_id;
  exception when unique_violation then
    raise exception 'a piece type named % already exists', v_name using errcode = '23505';
  end;

  if p_kind = 'numbered' then
    insert into public.pieces (piece_type_id, color, number)
      select new_id, c, x from unnest(v_colors) as c cross join unnest(v_numbers) as x;
  end if;
  return new_id;
end;
$$;
revoke all on function public.create_piece_type(text, text, text[], text[], jsonb) from public, anon;
grant execute on function public.create_piece_type(text, text, text[], text[], jsonb) to authenticated;

-- Adds a color to a type, and that color for every number the type already has.
-- Returns pieces created.
create or replace function public.add_piece_color(p_type uuid, p_color text) returns int
language plpgsql security definer set search_path = public as $$
declare
  t public.piece_types%rowtype;
  v_color text := btrim(coalesce(p_color, ''));
  cnt int := 0;
begin
  if not public.is_staff() then
    raise exception 'only staff can add inventory' using errcode = '42501';
  end if;
  if v_color = '' then
    raise exception 'a color needs a name' using errcode = '22023';
  end if;
  select * into t from public.piece_types where id = p_type for update;
  if not found then
    raise exception 'no such piece type' using errcode = 'P0002';
  end if;
  if exists (select 1 from unnest(t.colors) as c where lower(c) = lower(v_color)) then
    raise exception '% is already a % color', v_color, t.name using errcode = '22023';
  end if;

  update public.piece_types set colors = colors || v_color where id = p_type;
  if t.kind = 'numbered' then
    insert into public.pieces (piece_type_id, color, number)
      select distinct p_type, v_color, p.number from public.pieces p where p.piece_type_id = p_type
      on conflict (piece_type_id, color, number) do nothing;
    get diagnostics cnt = row_count;
  end if;
  return cnt;
end;
$$;
revoke all on function public.add_piece_color(uuid, text) from public, anon;
grant execute on function public.add_piece_color(uuid, text) to authenticated;

-- Adds one number to a numbered type in the given colors (all must be the type's).
-- Returns pieces created (colors that already have the number are skipped).
create or replace function public.add_piece_number(p_type uuid, p_number text, p_colors text[]) returns int
language plpgsql security definer set search_path = public as $$
declare
  t public.piece_types%rowtype;
  n text;
  v_colors text[] := public.clean_list(p_colors);
  c text;
  cnt int;
begin
  if not public.is_staff() then
    raise exception 'only staff can add inventory' using errcode = '42501';
  end if;
  select * into t from public.piece_types where id = p_type;
  if not found then
    raise exception 'no such piece type' using errcode = 'P0002';
  end if;
  if t.kind <> 'numbered' then
    raise exception '% is not a numbered type', t.name using errcode = '22023';
  end if;
  n := public.require_number(p_number);
  if cardinality(v_colors) = 0 then
    raise exception 'pick at least one color' using errcode = '22023';
  end if;
  foreach c in array v_colors loop
    if not (c = any(t.colors)) then
      raise exception '% is not a % color', c, t.name using errcode = '22023';
    end if;
  end loop;

  insert into public.pieces (piece_type_id, color, number)
    select distinct p_type, x, n from unnest(v_colors) as x
    on conflict (piece_type_id, color, number) do nothing;
  get diagnostics cnt = row_count;
  return cnt;
end;
$$;
revoke all on function public.add_piece_number(uuid, text, text[]) from public, anon;
grant execute on function public.add_piece_number(uuid, text, text[]) to authenticated;

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
