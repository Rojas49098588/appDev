# Supabase Backend — Design

**Date:** 2026-09-29
**Status:** Approved in conversation, pending written-spec review
**App:** Mustang Closet (`mobile-app/`, Expo SDK 57)

## Goal

Move the app's user-edited data from on-device AsyncStorage to a shared Supabase
backend, so every phone sees the same accounts, flags, combos and current game.

Today all data persists across app restarts, but only on the phone that wrote it:
a member's flag never reaches a staff phone, and an account only logs in on the
device it was created on. Passwords are also stored in plain text on-device.

**Scale target:** a class project demoed on a few phones, built so it can become
the real SMU Mustang Band tool later without a rewrite. That means real auth,
database-enforced security rules and ID-based relationships now; no admin
tooling or scaling work yet.

## Decisions

| Topic | Decision |
|---|---|
| Scope | Move only data users already edit in the app: accounts, flags, combos (with photos), current game. Inventory catalogue, member uniform assignments and `membersData.ts` stay in code. Tables are designed so inventory can be added later without changing existing rows. |
| Architecture | The app calls Supabase directly with `@supabase/supabase-js` from the existing contexts. Security is enforced by Postgres row-level security (RLS) plus two database functions. No custom server, no TanStack Query. |
| Invite code | Stored in the database and checked there at sign-up. |
| Freshness | Live updates (Supabase Realtime) on all four tables. |
| Offline | Show the last-synced copy (read-only) with an "Offline — showing data from HH:MM" banner. No offline writes. |
| Existing data | Fresh start. Seed combos and the current game are inserted once as ordinary rows. On-device test accounts, flags, custom combos, the built-in Staff account and the sample flags are discarded. The first Staff account is created by hand. |

## Data model

All tables live in the `public` schema. Timestamps are `timestamptz` defaulting to `now()`.

### `profiles` — one row per user

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | References `auth.users(id)`, on delete cascade |
| `email` | text, not null | Copied from auth at sign-up |
| `first_name`, `last_name` | text, not null | |
| `instrument` | text, not null | Section is derived in-app via `sectionForInstrument`, not stored |
| `role` | text, not null, default `'Member'` | Check: `'Member'` or `'Staff'` |
| `phone` | text, not null, default `''` | |
| `shoe_gender` | text, null | Check: `'Men''s'` or `'Women''s'` |
| `shoe_size` | text, not null, default `''` | |
| `height_feet`, `height_inches` | text, not null, default `''` | Text to match the app's existing `HeightValue` |
| `weight` | text, not null, default `''` | |
| `created_at` | timestamptz | |

Passwords are never stored here; Supabase Auth stores them hashed.

### `combos` — one row per combo

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK, default `gen_random_uuid()` | `seed.sql` inserts seed combos with fixed UUIDs so the seeded game can reference them |
| `label` | text, not null | |
| `sub` | text, not null, default `''` | Optional in the UI |
| `components` | text[], not null, default `'{}'` | |
| `image_path` | text, null | Object path in the `combo-images` bucket |
| `created_by` | uuid, null | References `profiles(id)`, on delete set null |
| `created_at` | timestamptz | |

Deleting a combo deletes the row (and the app deletes its image). The
`formation.combos.deleted.v1` workaround goes away.

### `games` — one row per game

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `opponent` | text, not null | |
| `game_date` | date, not null | App formats it for display (e.g. "Fri, Sep 18") |
| `pre_game_combo_id`, `halftime_combo_id` | uuid, null | References `combos(id)`, **on delete set null** |
| `after_game_instructions` | text, not null, default `''` | |
| `instructions_posted_by` | uuid, null | References `profiles(id)`, on delete set null |
| `instructions_updated_at` | timestamptz, null | |
| `is_current` | boolean, not null, default false | Partial unique index: at most one row where `is_current` |

When a slot's combo is deleted the slot becomes null and Game Day shows
"No combo set" for it. The app keeps its existing guard that refuses to delete
a combo currently set for pregame/halftime; `on delete set null` covers the
race where another phone changes the game at the same moment.

### `flags` — one row per flagged piece

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `member_id` | uuid, not null | References `profiles(id)`, on delete cascade |
| `piece`, `color`, `size` | text, not null | |
| `status` | text, not null | Check: `'dirty'` or `'repair'` |
| `comment` | text, not null, default `''` | |
| `created_at`, `updated_at` | timestamptz | `updated_at` maintained by trigger |

Unique on `(member_id, piece, color)`, matching today's one-flag-per-piece-color
rule. Replaces the name-based `Flag.id`. Future inventory work adds a nullable
`member_item_id` column; existing rows need no change.

### `settings` — private

| Column | Type | Notes |
|---|---|---|
| `id` | int, PK | Check `id = 1` (single row) |
| `invite_code` | text, not null | Seeded with `4F2K9`; changed in the Supabase dashboard |

RLS enabled with **no policies**: no client can read or write it.

### Storage bucket `combo-images`

Private bucket. Objects named `combo-<timestamp>-<random>.jpg`. The photo is
uploaded before the combo row exists, and combos have no update policy, so the
name can't be the combo's ID. The app displays images via
signed or authenticated URLs and relies on the image cache after first load.

## Security rules (RLS)

Helper: `is_staff()` — a `security definer` SQL function returning whether the
caller's profile has `role = 'Staff'`. All policies apply to the `authenticated`
role only; `anon` gets nothing.

| Table | Select | Insert | Update | Delete |
|---|---|---|---|---|
| `profiles` | own row; all rows if `is_staff()`. Members read staff **names only** through the `staff_directory` view (`id, first_name, last_name` of Staff profiles), so staff phone/weight stay private | none (created by trigger) | own row; `role`, `email` and `id` must be unchanged | none |
| `combos` | all | `is_staff()` | none (not editable in-app today) | `is_staff()` |
| `games` | all | none | `is_staff()` | none |
| `flags` | own rows; all if `is_staff()` | own `member_id` only | own rows only | none |
| `settings` | none | none | none | none |
| `storage.objects` in `combo-images` | all authenticated | `is_staff()` | none | `is_staff()` |

The "role unchanged" update rule is enforced with a `before update` trigger on
`profiles` that rejects any change to `role` unless the transaction-local setting
`app.allow_role_change` is `'on'`. Only `set_role` sets it (via
`set_config('app.allow_role_change', 'on', true)`). A trigger is needed because
RLS `with check` cannot compare old and new values.

### Database functions

1. **`set_role(target uuid, new_role text)`** — `security definer`. Raises if
   the caller is not Staff, if `target` is the caller (no self-demotion, so the
   last Staff account cannot lock everyone out), or if `new_role` is invalid.
2. **`check_invite_code(code text) returns boolean`** — `security definer`,
   callable by `anon`. Compares trimmed, uppercased input to `settings.invite_code`.
   Used by the Invite Code screen for early feedback only.
3. **Sign-up triggers on `auth.users`:**
   - `before insert`: reads `raw_user_meta_data->>'invite_code'`; if it does not
     match `settings.invite_code` (same normalization), raises, so the auth user
     is never created.
   - `after insert`: inserts the `profiles` row from metadata
     (`first_name`, `last_name`, `instrument`, `height_*`, `weight`, shoe fields)
     with `role` hard-coded to `'Member'`, ignoring any role in metadata.

## Auth flow

Screens and order are unchanged: Login → Invite code → Sign up.

- **Invite Code screen** calls `check_invite_code` via RPC instead of comparing
  against the hard-coded constant. The server re-checks at sign-up.
- **Sign up** calls `supabase.auth.signUp({ email, password, options: { data: { invite_code, ...profile fields } } })`.
  "Email already registered" comes back as a sign-up error. This replaces
  `accountExists()`, which is removed (members can no longer list every account).
- **Email confirmation is off** in the Supabase dashboard for the prototype.
  Turning it on is a dashboard switch when real members onboard.
- **Session persistence** uses supabase-js's built-in persistence with
  AsyncStorage as its storage adapter, so reopening the app still skips Login.
- **Change password** uses `supabase.auth.updateUser({ password })` after
  re-verifying the current password with `signInWithPassword`.
- **Promote/demote** calls `set_role`.
- **Config:** the project URL and anon key are read from `EXPO_PUBLIC_SUPABASE_URL`
  and `EXPO_PUBLIC_SUPABASE_ANON_KEY`. The anon key is public by design; the
  service-role key never ships in the app.

`AuthContext` keeps its public shape (`session`, `account`, `accounts`,
`isLoading`, `signUp`, `logIn`, `logOut`, `updateAccount`, `setAccountRole`,
`changePassword`) minus `accountExists`. `account.password` is dropped from the
`Account` type. `accounts` is the profiles list visible to the caller (all
profiles for Staff; used by `SectionsScreen`).

## Context data flow

`AuthContext`, `FlagsContext`, `CombosContext` and `GameContext` share one pattern:

1. **Load:** read the cached copy from AsyncStorage and render it immediately,
   then fetch from Supabase and replace state and cache.
2. **Live:** subscribe to Realtime `postgres_changes` on the context's table and
   apply inserts/updates/deletes to state and cache. Realtime respects RLS, so
   members only receive their own flags.
3. **Write:** send the write to Supabase first; update state only after success.
   On failure, leave state unchanged and show an `Alert` with the reason.

Mutators keep their names and become `async` where they are not already
(`addFlag`, `updateFlag`, `setCombo`). Callers `await` them and handle errors.

Cache keys are new (`mustang.cache.<table>.v1`) and include a `syncedAt`
timestamp. Old `formation.*` keys are removed on first launch, along with the
temporary "Abby Rojas" purge code currently uncommitted in `AuthContext.tsx`.

Seed data files `combosData.ts` and `gamesData.ts` stop being runtime data
sources. The `Combo` and `Game` types remain (adjusted to the table columns).
`flagsData.ts` seed flags are removed.

## Offline behavior

- `hooks/useConnection.ts` tracks connectivity via `expo-network`.
- Offline: a banner reads "Offline — showing data from HH:MM" (oldest
  `syncedAt` among loaded caches). Editing controls are disabled: Flag item
  submit, Add combo, Delete combo, Set for pregame/halftime, profile Update,
  promote/demote, change password.
- On reconnect each context refetches and resubscribes; the banner clears.
- First launch offline with no cache: a "Can't reach server" message with a Retry button.

## Photos

Add Combo: upload the picked image to `combo-images/<new id>.jpg`, then insert
the combo row with `image_path`. If the upload fails, no row is inserted. If the
insert fails, the uploaded object is deleted. Delete Combo removes the row, then
the image object. The local `combo-images` directory copy in `AddComboScreen` is
no longer needed.

## Setup (done by the user, walked through in the plan)

1. Create a free Supabase project.
2. Put the URL and anon key in `mobile-app/.env.local` as the `EXPO_PUBLIC_*`
   variables above, and the test/DB secrets in `mobile-app/supabase/.env.local`
   (both git-ignored by the existing `.env*.local` rule).
3. Apply `supabase/schema.sql` (tables, RLS, functions, triggers, bucket) and
   `supabase/seed.sql` (invite code, seed combos, current game) with
   `npm run db:apply` (or paste them into the SQL editor).
4. Turn off email confirmation.
5. Create the first Staff account: sign up in the app, then set `role = 'Staff'`
   on that profile in the Table Editor.

## Testing

- **RLS test script** (`supabase/tests/rls.test.ts`, run with Node against the
  real project using two test accounts): as a Member, verify reading others'
  flags returns nothing, updating own `role` fails, inserting/deleting a combo
  fails, updating a game fails, reading `settings` returns nothing, calling
  `set_role` fails; sign-up with a wrong invite code fails. As Staff, verify
  reading all flags and profiles, adding/deleting a combo, setting a game combo
  and promoting another user succeed, and self-demotion fails.
- `npx tsc --noEmit` and `npx expo-doctor` pass (except the known pre-existing
  patch-version warning).
- **On-device checklist** (two phones, or phone + web):
  1. Member flags an item; it appears on the Staff phone within a few seconds without refreshing.
  2. Staff sets the halftime combo; Member's Game Day updates live.
  3. Staff adds a combo with a photo; it appears with the photo on the other device.
  4. Staff deletes the halftime combo; Game Day shows "No combo set".
  5. Airplane mode: cached data and the offline banner show; edit controls are disabled. Reconnect: banner clears, data refreshes.
  6. Wrong invite code is rejected on the Invite Code screen.
  7. Force-close and reopen while logged in: lands in the signed-in tabs.
  8. Promote a member to Staff; their app switches to the Staff experience after the change arrives.

## Out of scope (follow-ups)

1. **Staff resolve/clear flags** (next feature; needs one update/delete policy plus UI).
2. Forgot-password / reset email.
3. Inventory catalogue and member uniform assignments in the database.
4. Offline writes / sync queue.
5. Staff-side "Edit game day" (opponent, date, instructions) and season schedule.
6. Turning on email confirmation for production.
