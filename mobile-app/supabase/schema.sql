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

-- ---------- Helper functions ----------

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'Staff');
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

-- ---------- Profile guard: role only via set_role, email only via auth ----------

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
  using (id = auth.uid()) with check (id = auth.uid());

alter table public.combos enable row level security;
drop policy if exists combos_select on public.combos;
create policy combos_select on public.combos for select to authenticated using (true);
drop policy if exists combos_insert on public.combos;
create policy combos_insert on public.combos for insert to authenticated with check (public.is_staff());
drop policy if exists combos_delete on public.combos;
create policy combos_delete on public.combos for delete to authenticated using (public.is_staff());

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
  with check (member_id = auth.uid());
drop policy if exists flags_update_own on public.flags;
create policy flags_update_own on public.flags for update to authenticated
  using (member_id = auth.uid()) with check (member_id = auth.uid());

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

-- ---------- Realtime ----------

do $$
declare
  t text;
begin
  foreach t in array array['profiles', 'combos', 'games', 'flags'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end;
$$;
