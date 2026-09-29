# Supabase Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace on-device AsyncStorage as the source of truth for accounts, flags, combos (with photos) and the current game with a shared Supabase backend, with live updates and a read-only offline mode.

**Architecture:** The app calls Supabase directly with `@supabase/supabase-js` from the four existing React contexts. Postgres row-level security plus two database functions enforce who can do what. Each context renders its AsyncStorage cache first, fetches from Supabase, subscribes to Realtime changes, and writes to the server before updating local state.

**Tech Stack:** Expo SDK 57 / React Native 0.86 / TypeScript, `@supabase/supabase-js` 2.x, Supabase Postgres + Auth + Storage + Realtime, `expo-network`, `expo-file-system` (existing), Node 24 built-in test runner (`node --test`, native TypeScript type stripping), `pg` (dev only, to apply SQL).

**Spec:** `docs/superpowers/specs/2026-09-29-supabase-backend-design.md`

## Global Constraints

- All paths below are relative to `mobile-app/` unless they start with `docs/`.
- Before writing Expo code, read the versioned docs at https://docs.expo.dev/versions/v57.0.0/ (required by `mobile-app/AGENTS.md`), specifically `expo-network` (`useNetworkState`) and `expo-file-system` (`File`). If an API below differs from those docs, follow the docs and note the difference in your report.
- Install Expo packages with `npx expo install <pkg>` (never plain `npm install`) so versions match SDK 57.
- The Supabase secret/service-role key and the database URL live only in `supabase/.env.local`. They must never appear in app code or in any file Metro bundles. The app only reads `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` from `.env.local`.
- Both `.env.local` files are git-ignored by the existing `.env*.local` rule. Never commit them.
- Invite code seed value: `4F2K9`. Normalization everywhere: trim + uppercase.
- Password rule stays `isValidPassword` (`constants/validation.ts`): longer than 6 characters, with a capital letter and a number.
- Cache keys: `mustang.cache.<name>.v1`. Legacy `formation.*` keys are deleted on launch.
- Files under `lib/` that tests import (`models`, `rows`, `format`, `mappers`, `validators`, `cache`, `realtime`, `errors`, `startup`) must not import `react-native`, AsyncStorage or Supabase, and must import sibling runtime modules **with** the `.ts` extension (Node runs them directly).
- Commit straight to `master` (project practice). End every commit message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- `npx tsc --noEmit` must pass after every task. `CI=1 npx expo-doctor` may show only the known pre-existing patch-version warning.

## Review Focus

1. **Offline launch after the access token expired** (the app was closed for more than an hour, then opened in a stadium with no signal). The user should stay signed in with cached data, not be sent to Login. Pinned by `startupAction` unit tests in Task 3 and used in Task 4.
2. **Flagging a piece that is already flagged** (for example from a second device, or a double tap) should update the one existing flag, not fail on the unique constraint. Pinned by the "upsert twice keeps one row" RLS test in Task 2, and `addFlag` uses upsert in Task 5.
3. **A combo is deleted while a game slot points to it.** The slot should become empty (Game Day shows "No combo set"), not break Game Day. Pinned by the "deleting a combo clears the game slot" RLS test in Task 2, and rendered in Task 7.
4. **Invite code typed as ` 4f2k9 `** (lowercase, spaces) should be accepted on both the Invite Code screen and at sign-up. Pinned by RLS tests in Task 2.
5. **A member changes their email on Member Account.** The next login with the new email should work, and staff should see the new email. Pinned by the "email change syncs to profile" RLS test in Task 2, and implemented in `updateAccount` in Task 4.

## File Map

| File | Status | Responsibility |
|---|---|---|
| `supabase/schema.sql` | new | Tables, RLS, functions, triggers, view, storage bucket, realtime publication (re-runnable, non-destructive) |
| `supabase/seed.sql` | new | Invite code, seed combos, current game |
| `supabase/scripts/run-sql.mjs` | new | Applies SQL files through `SUPABASE_DB_URL` |
| `supabase/tests/rls.test.ts` | new | Security rule tests against the real project |
| `supabase/.env.example` | new | Template for test/DB secrets |
| `.env.example` | new | Template for app config |
| `lib/supabase.ts` | new | The one Supabase client |
| `lib/models.ts` | new | App-side types: `Account`, `ShoeSize`, `Flag`, `FlagStatus`, `Combo`, `Game` |
| `lib/rows.ts` | new | Database row types |
| `lib/format.ts` | new | Date/time display helpers |
| `lib/mappers.ts` | new | Row ↔ model conversion |
| `lib/validators.ts` | new | Runtime shape checks for cached data |
| `lib/cache.ts` | new | Pure cache (de)serialization |
| `lib/cacheStorage.ts` | new | AsyncStorage read/write/clear for caches |
| `lib/realtime.ts` | new | `upsertById` / `removeById` list helpers |
| `lib/errors.ts` | new | `friendlyError` for alerts |
| `lib/startup.ts` | new | Pure decision for what to do with a stored session at launch |
| `hooks/useConnection.ts` | new | `useConnection`, `useOnReconnect`, `requireOnline`, `OFFLINE_DIM` |
| `hooks/useCachedList.ts` | new | Shared list state + cache for Flags/Combos |
| `components/OfflineBanner.tsx` | new | Offline / can't-reach-server banner above the tab bar |
| `tests/*.test.ts` | new | Unit tests for the pure `lib/` modules |
| `context/AuthContext.tsx` | rewrite | Supabase Auth + profiles |
| `context/FlagsContext.tsx` | rewrite | `flags` table |
| `context/CombosContext.tsx` | rewrite | `combos` table + `combo-images` bucket |
| `context/GameContext.tsx` | rewrite | `games` table |
| `constants/combosData.ts`, `constants/gamesData.ts`, `constants/flagsData.ts` | reduce | Type re-exports only (seed data moves to `seed.sql`) |
| `constants/myUniformData.ts` | modify | Remove `MY_MEMBER_NAME` |
| `navigation/types.ts` | modify | `SignUp: { inviteCode }`, `MemberProfileParams.id` |
| `App.tsx` | modify | Navigation ref; live role switch |
| Screens/components listed per task | modify | Await async context calls, show errors, disable edits offline |

---

### Task 1: Supabase project, tooling and client

**Files:**
- Create: `lib/supabase.ts`, `supabase/scripts/run-sql.mjs`, `supabase/.env.example`, `.env.example`
- Modify: `package.json`, `tsconfig.json`

**Interfaces:**
- Produces: `import { supabase } from '../lib/supabase'`, a `SupabaseClient` configured with AsyncStorage session persistence. npm scripts `test`, `test:rls`, `db:apply` and `db:check`.

- [ ] **Step 1: USER ACTION — create the Supabase project.** Stop and ask the user to do the following, then wait until they confirm:
  1. At https://supabase.com, create a free project (any name, e.g. `mustang-closet`). Save the database password.
  2. Go to **Authentication → Sign In / Providers → Email**, turn **Confirm email** OFF and save.
  3. Create `mobile-app/.env.local` with:
     ```
     EXPO_PUBLIC_SUPABASE_URL=<Project Settings → API → Project URL>
     EXPO_PUBLIC_SUPABASE_ANON_KEY=<Project Settings → API Keys → publishable key (or legacy "anon" key)>
     ```
  4. Create `mobile-app/supabase/.env.local` with:
     ```
     SUPABASE_URL=<same Project URL>
     SUPABASE_ANON_KEY=<same publishable/anon key>
     SUPABASE_SERVICE_ROLE_KEY=<API Keys → secret key (or legacy "service_role" key)>
     SUPABASE_DB_URL=<Connect button → "Session pooler" connection string, with the password filled in>
     INVITE_CODE=4F2K9
     ```

- [ ] **Step 2: Install dependencies**

Run (from `mobile-app/`):
```bash
npx expo install @supabase/supabase-js react-native-url-polyfill expo-network
npm install --save-dev pg
```
Expected: `package.json` gains `@supabase/supabase-js`, `react-native-url-polyfill` and `expo-network` in dependencies, and `pg` in devDependencies.

- [ ] **Step 3: Add npm scripts and TypeScript settings**

In `package.json` `"scripts"`, add (keep the existing four):
```json
    "test": "node --test \"tests/*.test.ts\"",
    "test:rls": "node --env-file=supabase/.env.local --test supabase/tests/rls.test.ts",
    "db:apply": "node --env-file=supabase/.env.local supabase/scripts/run-sql.mjs supabase/schema.sql supabase/seed.sql",
    "db:check": "node --env-file=supabase/.env.local supabase/scripts/run-sql.mjs --check"
```

Replace `tsconfig.json` with:
```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "allowImportingTsExtensions": true
  },
  "exclude": ["node_modules", "tests", "supabase"]
}
```
(`allowImportingTsExtensions` lets `lib/` files import each other with `.ts` so Node can run them in tests. `tests/` and `supabase/` run under Node, not React Native, so they're excluded from the app type check.)

- [ ] **Step 4: Create the env templates**

`.env.example`:
```
# Copy to .env.local and fill in from the Supabase dashboard (Project Settings → API).
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
```

`supabase/.env.example`:
```
# Copy to supabase/.env.local. NEVER commit the real file, and never put these in app code.
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
# Dashboard → Connect → Session pooler connection string, with the password filled in.
SUPABASE_DB_URL=
INVITE_CODE=4F2K9
```

- [ ] **Step 5: Create `supabase/scripts/run-sql.mjs`**

```js
// Applies SQL files to the Supabase database, or checks the connection with --check.
// Usage: node --env-file=supabase/.env.local supabase/scripts/run-sql.mjs <file.sql> [...]
import { readFile } from 'node:fs/promises';
import pg from 'pg';

const connectionString = process.env.SUPABASE_DB_URL;
if (!connectionString) {
  console.error('SUPABASE_DB_URL is missing. Copy supabase/.env.example to supabase/.env.local and fill it in.');
  process.exit(1);
}

const args = process.argv.slice(2);
const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  if (args[0] === '--check') {
    const { rows } = await client.query('select current_database() as db');
    console.log(`Connected to database "${rows[0].db}".`);
  } else {
    for (const file of args) {
      await client.query(await readFile(file, 'utf8'));
      console.log(`Applied ${file}`);
    }
  }
} finally {
  await client.end();
}
```

- [ ] **Step 6: Verify the database connection**

Run: `npm run db:check`
Expected: `Connected to database "postgres".` If it fails with a timeout or ENOTFOUND, the URL is probably the "Direct connection" string (IPv6-only). Ask the user for the **Session pooler** string instead.

- [ ] **Step 7: Create `lib/supabase.ts`**

```ts
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. Copy mobile-app/.env.example to .env.local and fill it in.'
  );
}

export const supabase = createClient(url, anonKey, {
  auth: {
    storage: AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

// Only refresh the session while the app is in the foreground, as Supabase
// recommends for React Native.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}
```

- [ ] **Step 8: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json tsconfig.json .env.example supabase/.env.example supabase/scripts/run-sql.mjs lib/supabase.ts
git status --short   # confirm neither .env.local file is staged
git commit -m "Add Supabase client, env templates and SQL tooling

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Database schema, security rules and RLS tests

**Files:**
- Create: `supabase/tests/rls.test.ts`, `supabase/schema.sql`, `supabase/seed.sql`

**Interfaces:**
- Consumes: `npm run db:apply` and `npm run test:rls` from Task 1.
- Produces (database): tables `profiles`, `combos`, `games`, `flags`, `settings`; view `staff_directory(id, first_name, last_name)`; RPCs `check_invite_code(code text) → boolean` and `set_role(target uuid, new_role text) → void`; bucket `combo-images`. Seed IDs: combo 01 = `00000000-0000-4000-8000-000000000001`, combo 02–05 = `...000000000002`–`...000000000005`, combo 14 = `00000000-0000-4000-8000-000000000014`, current game = `00000000-0000-4000-8000-0000000000a1`.

- [ ] **Step 1: Write the failing RLS test suite** — `supabase/tests/rls.test.ts`

```ts
// Security-rule tests. Runs against the real Supabase project:
//   npm run test:rls
// Creates throwaway users (rls-*@mustangcloset.test) and deletes them afterwards.
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name} in supabase/.env.local`);
  return value;
}

const url = required('SUPABASE_URL');
const anonKey = required('SUPABASE_ANON_KEY');
const serviceKey = required('SUPABASE_SERVICE_ROLE_KEY');
const inviteCode = required('INVITE_CODE');

const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, serviceKey, clientOptions);
const anon = createClient(url, anonKey, clientOptions);

const RUN = Date.now().toString(36);
const PASSWORD = 'TestPass123';
const SEED_COMBO_01 = '00000000-0000-4000-8000-000000000001';
const SEED_COMBO_14 = '00000000-0000-4000-8000-000000000014';
const CURRENT_GAME = '00000000-0000-4000-8000-0000000000a1';

type TestUser = { id: string; email: string };
const createdUserIds: string[] = [];

async function createUser(label: string): Promise<TestUser> {
  const email = `rls-${label}-${RUN}@mustangcloset.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { invite_code: inviteCode, first_name: label, last_name: 'Test', instrument: 'Trumpet' },
  });
  if (error) throw error;
  createdUserIds.push(data.user.id);
  return { id: data.user.id, email };
}

async function signIn(email: string): Promise<SupabaseClient> {
  const client = createClient(url, anonKey, clientOptions);
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw error;
  return client;
}

let member: TestUser;
let otherMember: TestUser;
let staff: TestUser;
let asMember: SupabaseClient;
let asStaff: SupabaseClient;

before(async () => {
  member = await createUser('member');
  otherMember = await createUser('other');
  staff = await createUser('staff');
  // Service-role updates bypass the role guard (auth.uid() is null), like the dashboard.
  const { error } = await admin.from('profiles').update({ role: 'Staff' }).eq('id', staff.id);
  if (error) throw error;
  const { error: flagError } = await admin.from('flags').insert({
    member_id: otherMember.id, piece: 'Vests', color: 'Red', size: '128', status: 'repair',
  });
  if (flagError) throw flagError;
  asMember = await signIn(member.email);
  asStaff = await signIn(staff.email);
});

after(async () => {
  for (const id of createdUserIds) {
    await admin.auth.admin.deleteUser(id);
  }
});

describe('sign-up and invite code', () => {
  test('check_invite_code accepts the code with spaces and lowercase', async () => {
    const { data, error } = await anon.rpc('check_invite_code', { code: ` ${inviteCode.toLowerCase()} ` });
    assert.equal(error, null);
    assert.equal(data, true);
  });

  test('check_invite_code rejects a wrong code', async () => {
    const { data, error } = await anon.rpc('check_invite_code', { code: 'WRONG' });
    assert.equal(error, null);
    assert.equal(data, false);
  });

  test('sign-up with a wrong invite code creates no account', async () => {
    const email = `rls-wrongcode-${RUN}@mustangcloset.test`;
    const client = createClient(url, anonKey, clientOptions);
    const { data, error } = await client.auth.signUp({
      email, password: PASSWORD,
      options: { data: { invite_code: 'WRONG', first_name: 'X', last_name: 'Y', instrument: 'Tuba' } },
    });
    if (data.user) createdUserIds.push(data.user.id);
    assert.notEqual(error, null);
    const { data: profiles } = await admin.from('profiles').select('id').eq('email', email);
    assert.equal(profiles?.length ?? 0, 0);
  });

  test('sign-up with a lowercase code works and always creates a Member, even if Staff is requested', async () => {
    const email = `rls-signup-${RUN}@mustangcloset.test`;
    const client = createClient(url, anonKey, clientOptions);
    const { data, error } = await client.auth.signUp({
      email, password: PASSWORD,
      options: { data: { invite_code: ` ${inviteCode.toLowerCase()}`, role: 'Staff', first_name: 'New', last_name: 'Person', instrument: 'Tuba' } },
    });
    if (data.user) createdUserIds.push(data.user.id);
    assert.equal(error, null);
    const { data: profile } = await admin.from('profiles').select('role, first_name, instrument').eq('id', data.user!.id).single();
    assert.deepEqual(profile, { role: 'Member', first_name: 'New', instrument: 'Tuba' });
  });
});

describe('member permissions', () => {
  test('sees only their own profile', async () => {
    const { data, error } = await asMember.from('profiles').select('id');
    assert.equal(error, null);
    assert.deepEqual(data?.map((r) => r.id), [member.id]);
  });

  test('can read staff names through staff_directory', async () => {
    const { data, error } = await asMember.from('staff_directory').select('id, first_name');
    assert.equal(error, null);
    assert.ok(data?.some((r) => r.id === staff.id));
  });

  test('can edit their own phone', async () => {
    const { error } = await asMember.from('profiles').update({ phone: '2145550100' }).eq('id', member.id);
    assert.equal(error, null);
  });

  test('cannot change their own role', async () => {
    const { error } = await asMember.from('profiles').update({ role: 'Staff' }).eq('id', member.id);
    assert.notEqual(error, null);
    const { data } = await admin.from('profiles').select('role').eq('id', member.id).single();
    assert.equal(data?.role, 'Member');
  });

  test('cannot edit their profile email directly', async () => {
    const { error } = await asMember.from('profiles').update({ email: 'hacker@example.com' }).eq('id', member.id);
    assert.notEqual(error, null);
  });

  test("cannot edit someone else's profile", async () => {
    const { data } = await asMember.from('profiles').update({ phone: '1' }).eq('id', staff.id).select('id');
    assert.equal(data?.length ?? 0, 0);
  });

  test('cannot read settings', async () => {
    const { data } = await asMember.from('settings').select('*');
    assert.equal(data?.length ?? 0, 0);
  });

  test('can flag their own piece, and flagging it again updates the same row', async () => {
    const flag = { member_id: member.id, piece: 'Coats', color: 'Blue', size: '208', status: 'dirty', comment: '' };
    const first = await asMember.from('flags').upsert(flag, { onConflict: 'member_id,piece,color' }).select().single();
    assert.equal(first.error, null);
    const second = await asMember
      .from('flags')
      .upsert({ ...flag, status: 'repair', comment: 'torn' }, { onConflict: 'member_id,piece,color' })
      .select()
      .single();
    assert.equal(second.error, null);
    assert.equal(second.data?.id, first.data?.id);
    const { data } = await admin.from('flags').select('status').eq('member_id', member.id).eq('piece', 'Coats');
    assert.deepEqual(data, [{ status: 'repair' }]);
  });

  test('cannot create a flag for someone else', async () => {
    const { error } = await asMember.from('flags').insert({
      member_id: otherMember.id, piece: 'Pants', color: 'White', size: '204', status: 'dirty',
    });
    assert.notEqual(error, null);
  });

  test("cannot see other members' flags", async () => {
    const { data, error } = await asMember.from('flags').select('member_id');
    assert.equal(error, null);
    assert.ok(data!.every((r) => r.member_id === member.id));
  });

  test('cannot add or delete combos', async () => {
    const insert = await asMember.from('combos').insert({ label: 'Nope' });
    assert.notEqual(insert.error, null);
    const del = await asMember.from('combos').delete().eq('id', SEED_COMBO_01).select('id');
    assert.equal(del.data?.length ?? 0, 0);
    const { data } = await admin.from('combos').select('id').eq('id', SEED_COMBO_01);
    assert.equal(data?.length, 1);
  });

  test('cannot change the current game', async () => {
    const { data } = await asMember.from('games').update({ halftime_combo_id: SEED_COMBO_01 }).eq('id', CURRENT_GAME).select('id');
    assert.equal(data?.length ?? 0, 0);
  });

  test('cannot call set_role', async () => {
    const { error } = await asMember.rpc('set_role', { target: member.id, new_role: 'Staff' });
    assert.notEqual(error, null);
  });

  test('cannot upload combo images', async () => {
    const { error } = await asMember.storage.from('combo-images').upload(`rls-${RUN}.txt`, new Blob(['x']), { contentType: 'text/plain' });
    assert.notEqual(error, null);
  });

  test('email change on the login syncs to the profile', async () => {
    const newEmail = `rls-renamed-${RUN}@mustangcloset.test`;
    const client = await signIn(otherMember.email);
    const { error } = await client.auth.updateUser({ email: newEmail });
    assert.equal(error, null);
    const { data } = await admin.from('profiles').select('email').eq('id', otherMember.id).single();
    assert.equal(data?.email, newEmail, 'If this fails, turn off "Confirm email" / "Secure email change" in Supabase Auth settings');
  });
});

describe('staff permissions', () => {
  test('sees every flag', async () => {
    const { data, error } = await asStaff.from('flags').select('member_id');
    assert.equal(error, null);
    assert.ok(data!.some((r) => r.member_id === otherMember.id));
  });

  test('sees every profile', async () => {
    const { data, error } = await asStaff.from('profiles').select('id');
    assert.equal(error, null);
    const ids = data!.map((r) => r.id);
    for (const id of [member.id, otherMember.id, staff.id]) assert.ok(ids.includes(id));
  });

  test('can add and delete a combo', async () => {
    const { data, error } = await asStaff.from('combos').insert({ label: `RLS ${RUN}`, created_by: staff.id }).select().single();
    assert.equal(error, null);
    const del = await asStaff.from('combos').delete().eq('id', data!.id).select('id');
    assert.equal(del.data?.length, 1);
  });

  test('deleting a combo clears the game slot that used it', async () => {
    const { data: combo } = await asStaff.from('combos').insert({ label: `Slot ${RUN}` }).select().single();
    const { data: before } = await admin.from('games').select('pre_game_combo_id').eq('id', CURRENT_GAME).single();
    await asStaff.from('games').update({ pre_game_combo_id: combo!.id }).eq('id', CURRENT_GAME);
    await asStaff.from('combos').delete().eq('id', combo!.id);
    const { data: game } = await admin.from('games').select('pre_game_combo_id').eq('id', CURRENT_GAME).single();
    assert.equal(game?.pre_game_combo_id, null);
    await admin.from('games').update({ pre_game_combo_id: before?.pre_game_combo_id ?? SEED_COMBO_01 }).eq('id', CURRENT_GAME);
  });

  test('can set the halftime combo', async () => {
    const { data, error } = await asStaff.from('games').update({ halftime_combo_id: SEED_COMBO_01 }).eq('id', CURRENT_GAME).select().single();
    assert.equal(error, null);
    assert.equal(data?.halftime_combo_id, SEED_COMBO_01);
    await admin.from('games').update({ halftime_combo_id: SEED_COMBO_14 }).eq('id', CURRENT_GAME);
  });

  test('can promote and demote another user', async () => {
    const promote = await asStaff.rpc('set_role', { target: member.id, new_role: 'Staff' });
    assert.equal(promote.error, null);
    const { data } = await admin.from('profiles').select('role').eq('id', member.id).single();
    assert.equal(data?.role, 'Staff');
    const demote = await asStaff.rpc('set_role', { target: member.id, new_role: 'Member' });
    assert.equal(demote.error, null);
  });

  test('cannot change their own role', async () => {
    const { error } = await asStaff.rpc('set_role', { target: staff.id, new_role: 'Member' });
    assert.notEqual(error, null);
  });

  test('can upload and delete combo images', async () => {
    const path = `rls-${RUN}.txt`;
    const upload = await asStaff.storage.from('combo-images').upload(path, new Blob(['x']), { contentType: 'text/plain' });
    assert.equal(upload.error, null);
    const remove = await asStaff.storage.from('combo-images').remove([path]);
    assert.equal(remove.error, null);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test:rls`
Expected: FAIL in `before` (for example `relation "public.profiles" does not exist`, or a failing `createUser`), since no schema exists yet.

- [ ] **Step 3: Write `supabase/schema.sql`**

```sql
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
create or replace view public.staff_directory as
  select id, first_name, last_name from public.profiles where role = 'Staff';
revoke all on public.staff_directory from anon, public;
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
```

- [ ] **Step 4: Write `supabase/seed.sql`**

```sql
-- Starting data. Re-runnable: existing rows are left alone
-- (except the invite code, which is reset to the seed value).

insert into public.settings (id, invite_code) values (1, '4F2K9')
on conflict (id) do update set invite_code = excluded.invite_code;

insert into public.combos (id, label, sub, components) values
  ('00000000-0000-4000-8000-000000000001', 'Combo 01', 'Field — home',
    array['White hat', 'Red bowtie', 'Red vest', 'White bibbers', 'Spats', 'White gloves']),
  ('00000000-0000-4000-8000-000000000002', 'Combo 02', 'Field — away', '{}'),
  ('00000000-0000-4000-8000-000000000003', 'Combo 03', 'Parade — formal', '{}'),
  ('00000000-0000-4000-8000-000000000004', 'Combo 04', 'Parade — summer', '{}'),
  ('00000000-0000-4000-8000-000000000005', 'Combo 05', 'Concert', '{}'),
  ('00000000-0000-4000-8000-000000000014', 'Combo 14', 'Halftime formation',
    array['White hat', 'Blue bowtie', 'Blue vest', 'White bibbers', 'Spats', 'White gloves'])
on conflict (id) do nothing;

insert into public.games (
  id, opponent, game_date, pre_game_combo_id, halftime_combo_id,
  after_game_instructions, instructions_updated_at, is_current
) values (
  '00000000-0000-4000-8000-0000000000a1',
  'Lincoln High',
  '2026-09-18',
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000014',
  'Leave all pieces draped over chairs to air out. Return bowties to the front table. Either take your white shirt home to wash, or leave it in the blue bin.',
  '2026-09-15T12:00:00Z',
  true
)
on conflict (id) do nothing;
```

- [ ] **Step 5: Apply schema and seed**

Run: `npm run db:apply`
Expected: `Applied supabase/schema.sql` then `Applied supabase/seed.sql`. Run it a second time. It must succeed again (proves it's re-runnable).

- [ ] **Step 6: Run the RLS suite to verify it passes**

Run: `npm run test:rls`
Expected: all tests PASS. If only "email change on the login syncs to the profile" fails, ask the user to turn off **Secure email change** in Authentication → Sign In / Providers → Email, then re-run. Don't weaken the test.

- [ ] **Step 7: Commit**

```bash
git add supabase/schema.sql supabase/seed.sql supabase/tests/rls.test.ts
git commit -m "Add Supabase schema, security rules, seed data and RLS tests

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Shared app-side helpers (pure logic, caches, connectivity)

**Files:**
- Create: `lib/models.ts`, `lib/rows.ts`, `lib/format.ts`, `lib/mappers.ts`, `lib/validators.ts`, `lib/cache.ts`, `lib/realtime.ts`, `lib/errors.ts`, `lib/startup.ts`, `lib/cacheStorage.ts`, `hooks/useConnection.ts`, `hooks/useCachedList.ts`
- Test: `tests/format.test.ts`, `tests/mappers.test.ts`, `tests/cache.test.ts`, `tests/realtime.test.ts`, `tests/errors.test.ts`, `tests/startup.test.ts`

**Interfaces:**
- Produces (exact names later tasks use):
  - `lib/models.ts`: types `ShoeSize`, `Account`, `FlagStatus`, `Flag`, `Combo`, `Game`
  - `lib/rows.ts`: types `ProfileRow`, `ComboRow`, `GameRow`, `FlagRow`
  - `lib/format.ts`: `formatGameDate(isoDate: string): string`, `formatShortDate(timestamp: string | null): string`, `formatTime(ms: number): string`
  - `lib/mappers.ts`: `profileToAccount(row: ProfileRow): Account`, type `AccountUpdates`, type `ProfileUpdate`, `accountUpdatesToProfile(updates: AccountUpdates): ProfileUpdate`, `rowToFlag(row: FlagRow): Flag`, `rowToCombo(row: ComboRow, imageUrl?: string): Combo`, `rowToGame(row: GameRow, postedByName: string): Game`
  - `lib/validators.ts`: `isAccount`, `isAccountList`, `isFlagList`, `isComboList`, `isGameOrNull`
  - `lib/cache.ts`: type `Cached<T>`, `serializeCache`, `parseCache`
  - `lib/cacheStorage.ts`: `CACHE_KEYS`, `readCache`, `writeCache`, `clearAllCaches`, `clearLegacyKeys`
  - `lib/realtime.ts`: `upsertById`, `removeById`
  - `lib/errors.ts`: `OFFLINE_MESSAGE`, `friendlyError(error: unknown): string`
  - `lib/startup.ts`: type `StartupAction`, `startupAction(input): StartupAction`
  - `hooks/useConnection.ts`: `useConnection(): { isOnline: boolean }`, `useOnReconnect(callback: () => void): void`, `requireOnline(isOnline: boolean): boolean`, `OFFLINE_DIM`
  - `hooks/useCachedList.ts`: `useCachedList<T extends { id: string }>(cacheKey, isValid)` → `{ items, itemsRef, syncedAt, commit, hydrate, reset }`

- [ ] **Step 1: Create the type-only modules** (no tests; they contain no logic)

`lib/models.ts`:
```ts
import type { HeightValue, Role } from '../navigation/types';

export type ShoeSize = { gender: "Men's" | "Women's"; size: string };

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
```

`lib/rows.ts`:
```ts
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
  created_at: string;
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
```

- [ ] **Step 2: Write the failing unit tests**

`tests/format.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatGameDate, formatShortDate, formatTime } from '../lib/format.ts';

test('formatGameDate shows weekday, month and day without timezone drift', () => {
  assert.equal(formatGameDate('2026-09-18'), 'Fri, Sep 18');
  assert.equal(formatGameDate('2026-01-01'), 'Thu, Jan 1');
});

test('formatGameDate returns the input when it is not a date', () => {
  assert.equal(formatGameDate('soon'), 'soon');
});

test('formatShortDate shows month and day, or empty for null/invalid', () => {
  assert.equal(formatShortDate('2026-09-15T12:00:00Z'), 'Sep 15');
  assert.equal(formatShortDate(null), '');
  assert.equal(formatShortDate('nope'), '');
});

test('formatTime uses a 12-hour clock', () => {
  assert.equal(formatTime(new Date(2026, 8, 29, 18, 42).getTime()), '6:42 PM');
  assert.equal(formatTime(new Date(2026, 8, 29, 0, 5).getTime()), '12:05 AM');
  assert.equal(formatTime(new Date(2026, 8, 29, 12, 0).getTime()), '12:00 PM');
});
```

`tests/mappers.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { accountUpdatesToProfile, profileToAccount, rowToCombo, rowToFlag, rowToGame } from '../lib/mappers.ts';
import type { ComboRow, FlagRow, GameRow, ProfileRow } from '../lib/rows.ts';

const profile: ProfileRow = {
  id: 'u1', email: 'maya@smu.edu', first_name: 'Maya', last_name: 'Chen', instrument: 'Trumpet',
  role: 'Member', phone: '', shoe_gender: null, shoe_size: '', height_feet: '5', height_inches: '6',
  weight: '130', created_at: '2026-09-29T00:00:00Z',
};

test('profileToAccount maps columns and defaults a missing shoe gender', () => {
  assert.deepEqual(profileToAccount(profile), {
    id: 'u1', email: 'maya@smu.edu', firstName: 'Maya', lastName: 'Chen', instrument: 'Trumpet',
    role: 'Member', phone: '', shoeSize: { gender: "Men's", size: '' },
    height: { feet: '5', inches: '6' }, weight: '130',
  });
});

test('accountUpdatesToProfile only includes provided fields and never email or role', () => {
  assert.deepEqual(
    accountUpdatesToProfile({
      firstName: ' Maya ', email: 'new@smu.edu',
      shoeSize: { gender: "Women's", size: '8' }, height: { feet: '5', inches: '7' },
    }),
    { first_name: 'Maya', shoe_gender: "Women's", shoe_size: '8', height_feet: '5', height_inches: '7' }
  );
  assert.deepEqual(accountUpdatesToProfile({}), {});
});

test('rowToFlag maps member_id to memberId', () => {
  const row: FlagRow = {
    id: 'f1', member_id: 'u1', piece: 'Coats', color: 'Blue', size: '208', status: 'dirty',
    comment: 'mud', created_at: '', updated_at: '',
  };
  assert.deepEqual(rowToFlag(row), {
    id: 'f1', memberId: 'u1', piece: 'Coats', color: 'Blue', size: '208', status: 'dirty', comment: 'mud',
  });
});

test('rowToCombo keeps the image path and attaches the signed URL when given', () => {
  const row: ComboRow = {
    id: 'c1', label: 'Combo 01', sub: '', components: ['White hat'], image_path: 'a.jpg',
    created_by: null, created_at: '',
  };
  assert.deepEqual(rowToCombo(row, 'https://signed/a.jpg'), {
    id: 'c1', label: 'Combo 01', sub: '', components: ['White hat'], imagePath: 'a.jpg', image: 'https://signed/a.jpg',
  });
  assert.equal(rowToCombo({ ...row, image_path: null }).imagePath, undefined);
});

test('rowToGame formats dates and passes through empty combo slots', () => {
  const row: GameRow = {
    id: 'g1', opponent: 'Lincoln High', game_date: '2026-09-18', pre_game_combo_id: null,
    halftime_combo_id: 'c14', after_game_instructions: 'Hang coats', instructions_posted_by: 's1',
    instructions_updated_at: '2026-09-15T12:00:00Z', is_current: true,
  };
  assert.deepEqual(rowToGame(row, 'Coach Reyes'), {
    id: 'g1', opponent: 'Lincoln High', date: 'Fri, Sep 18', preGameComboId: null, halftimeComboId: 'c14',
    afterGameInstructions: 'Hang coats', instructionsPostedBy: 'Coach Reyes', instructionsUpdatedAt: 'Sep 15',
  });
});
```

`tests/cache.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCache, serializeCache } from '../lib/cache.ts';
import { isAccount, isComboList, isFlagList, isGameOrNull } from '../lib/validators.ts';

test('serializeCache and parseCache round-trip valid data', () => {
  const flags = [{ id: 'f1', memberId: 'u1', piece: 'Coats', color: 'Blue', size: '208', status: 'dirty', comment: '' }];
  assert.deepEqual(parseCache(serializeCache(flags, 123), isFlagList), { syncedAt: 123, data: flags });
});

test('parseCache rejects missing, corrupt, or wrongly shaped data', () => {
  assert.equal(parseCache(null, isFlagList), null);
  assert.equal(parseCache('{not json', isFlagList), null);
  assert.equal(parseCache(JSON.stringify({ data: [] }), isFlagList), null);
  assert.equal(parseCache(serializeCache([{ id: 'f1' }], 1), isFlagList), null);
});

test('isGameOrNull accepts a cached "no current game"', () => {
  assert.deepEqual(parseCache(serializeCache(null, 5), isGameOrNull), { syncedAt: 5, data: null });
});

test('isComboList accepts combos with and without photos', () => {
  assert.equal(isComboList([{ id: 'c1', label: 'A', sub: '' }, { id: 'c2', label: 'B', sub: '', components: [], imagePath: 'x.jpg', image: 'u' }]), true);
  assert.equal(isComboList([{ id: 'c1', label: 'A', sub: '', components: [1] }]), false);
});

test('isAccount requires an id (old on-device accounts without one are rejected)', () => {
  const account = {
    id: 'u1', email: 'a@b.co', firstName: 'A', lastName: 'B', instrument: 'Tuba', role: 'Member', phone: '',
    shoeSize: { gender: "Men's", size: '' }, height: { feet: '', inches: '' }, weight: '',
  };
  assert.equal(isAccount(account), true);
  const { id: _id, ...legacy } = account;
  assert.equal(isAccount(legacy), false);
});
```

`tests/realtime.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { removeById, upsertById } from '../lib/realtime.ts';

test('upsertById appends new items and replaces existing ones in place', () => {
  const list = [{ id: 'a', v: 1 }, { id: 'b', v: 1 }];
  assert.deepEqual(upsertById(list, { id: 'c', v: 1 }), [...list, { id: 'c', v: 1 }]);
  assert.deepEqual(upsertById(list, { id: 'a', v: 2 }), [{ id: 'a', v: 2 }, { id: 'b', v: 1 }]);
  assert.deepEqual(list, [{ id: 'a', v: 1 }, { id: 'b', v: 1 }], 'input is not mutated');
});

test('removeById drops the matching item and ignores unknown ids', () => {
  assert.deepEqual(removeById([{ id: 'a' }, { id: 'b' }], 'a'), [{ id: 'b' }]);
  assert.deepEqual(removeById([{ id: 'a' }], 'zzz'), [{ id: 'a' }]);
});
```

`tests/errors.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OFFLINE_MESSAGE, friendlyError } from '../lib/errors.ts';

test('network failures become the offline message', () => {
  assert.equal(friendlyError(new TypeError('Network request failed')), OFFLINE_MESSAGE);
  assert.equal(friendlyError({ name: 'AuthRetryableFetchError', message: 'x' }), OFFLINE_MESSAGE);
});

test('known Supabase errors get plain-language messages', () => {
  assert.equal(friendlyError({ message: 'Invalid login credentials' }), 'Incorrect email or password.');
  assert.equal(friendlyError({ message: 'User already registered' }), 'An account with this email already exists.');
  assert.equal(
    friendlyError({ message: 'Database error saving new user' }),
    'That invite code is no longer valid. Go back and enter the current code.'
  );
  assert.equal(friendlyError({ code: '42501', message: 'only staff can change roles' }), "You don't have permission to do that.");
  assert.equal(friendlyError({ message: 'new row violates row-level security policy' }), "You don't have permission to do that.");
});

test('unknown errors fall back to their message or a generic one', () => {
  assert.equal(friendlyError(new Error('Boom')), 'Boom');
  assert.equal(friendlyError(undefined), 'Something went wrong. Please try again.');
});
```

`tests/startup.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startupAction } from '../lib/startup.ts';

test('valid session with a matching cached account shows the cache, then refreshes', () => {
  assert.equal(startupAction({ sessionUserId: 'u1', sessionErrorIsNetwork: false, cachedAccountId: 'u1' }), 'use-cache-then-refresh');
});

test('valid session without a usable cache must load the profile first', () => {
  assert.equal(startupAction({ sessionUserId: 'u1', sessionErrorIsNetwork: false, cachedAccountId: null }), 'load-profile');
  assert.equal(startupAction({ sessionUserId: 'u1', sessionErrorIsNetwork: false, cachedAccountId: 'other' }), 'load-profile');
});

test('offline with an expired token keeps the cached account instead of logging out', () => {
  assert.equal(startupAction({ sessionUserId: null, sessionErrorIsNetwork: true, cachedAccountId: 'u1' }), 'use-cache-offline');
});

test('no session otherwise means signed out', () => {
  assert.equal(startupAction({ sessionUserId: null, sessionErrorIsNetwork: false, cachedAccountId: 'u1' }), 'signed-out');
  assert.equal(startupAction({ sessionUserId: null, sessionErrorIsNetwork: true, cachedAccountId: null }), 'signed-out');
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `lib/format.ts` and the other modules.

- [ ] **Step 4: Implement the pure modules**

`lib/format.ts`:
```ts
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// '2026-09-18' → 'Fri, Sep 18'. Computed in UTC so the day never shifts with
// the phone's timezone.
export function formatGameDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  if (!year || !month || !day) return isoDate;
  const date = new Date(Date.UTC(year, month - 1, day));
  return `${WEEKDAYS[date.getUTCDay()]}, ${MONTHS[month - 1]} ${day}`;
}

// Timestamp → 'Sep 15' in local time; '' when missing or invalid.
export function formatShortDate(timestamp: string | null): string {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';
  return `${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

// Epoch ms → '6:42 PM' in local time.
export function formatTime(ms: number): string {
  const date = new Date(ms);
  const hours = date.getHours();
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hour12}:${minutes} ${hours < 12 ? 'AM' : 'PM'}`;
}
```

`lib/mappers.ts`:
```ts
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
```

Note: `rowToCombo` sets `image: undefined` when there's no URL. `deepEqual` in the test compares against an object with `image` present, so the with-URL case matches. The no-photo case only checks `imagePath`.

`lib/validators.ts`:
```ts
import type { Account, Combo, Flag, Game } from './models.ts';

// Runtime shape checks for data read back from the on-device cache.

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const isString = (v: unknown): v is string => typeof v === 'string';
const isStringOrNull = (v: unknown): v is string | null => v === null || typeof v === 'string';
const isOptionalString = (v: unknown) => v === undefined || typeof v === 'string';

export function isAccount(v: unknown): v is Account {
  if (!isObject(v)) return false;
  const { shoeSize, height } = v;
  return (
    isString(v.id) && isString(v.email) && isString(v.firstName) && isString(v.lastName) &&
    isString(v.instrument) && (v.role === 'Member' || v.role === 'Staff') && isString(v.phone) &&
    isString(v.weight) &&
    isObject(shoeSize) && (shoeSize.gender === "Men's" || shoeSize.gender === "Women's") && isString(shoeSize.size) &&
    isObject(height) && isString(height.feet) && isString(height.inches)
  );
}

export const isAccountList = (v: unknown): v is Account[] => Array.isArray(v) && v.every(isAccount);

function isFlag(v: unknown): v is Flag {
  return (
    isObject(v) && isString(v.id) && isString(v.memberId) && isString(v.piece) && isString(v.color) &&
    isString(v.size) && (v.status === 'dirty' || v.status === 'repair') && isString(v.comment)
  );
}

export const isFlagList = (v: unknown): v is Flag[] => Array.isArray(v) && v.every(isFlag);

function isCombo(v: unknown): v is Combo {
  return (
    isObject(v) && isString(v.id) && isString(v.label) && isString(v.sub) &&
    (v.components === undefined || (Array.isArray(v.components) && v.components.every(isString))) &&
    isOptionalString(v.imagePath) && isOptionalString(v.image)
  );
}

export const isComboList = (v: unknown): v is Combo[] => Array.isArray(v) && v.every(isCombo);

function isGame(v: unknown): v is Game {
  return (
    isObject(v) && isString(v.id) && isString(v.opponent) && isString(v.date) &&
    isStringOrNull(v.preGameComboId) && isStringOrNull(v.halftimeComboId) &&
    isString(v.afterGameInstructions) && isString(v.instructionsPostedBy) && isString(v.instructionsUpdatedAt)
  );
}

export const isGameOrNull = (v: unknown): v is Game | null => v === null || isGame(v);
```

`lib/cache.ts`:
```ts
export type Cached<T> = { syncedAt: number; data: T };

export function serializeCache<T>(data: T, syncedAt: number): string {
  return JSON.stringify({ syncedAt, data });
}

// Returns null for anything missing, unparseable or the wrong shape, so a
// corrupted cache is ignored rather than crashing the app.
export function parseCache<T>(raw: string | null, isValid: (v: unknown) => v is T): Cached<T> | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const { syncedAt, data } = parsed as Record<string, unknown>;
  if (typeof syncedAt !== 'number' || !isValid(data)) return null;
  return { syncedAt, data };
}
```

`lib/realtime.ts`:
```ts
export function upsertById<T extends { id: string }>(list: T[], item: T): T[] {
  const index = list.findIndex((existing) => existing.id === item.id);
  if (index === -1) return [...list, item];
  const next = list.slice();
  next[index] = item;
  return next;
}

export function removeById<T extends { id: string }>(list: T[], id: string): T[] {
  return list.filter((item) => item.id !== id);
}
```

`lib/errors.ts`:
```ts
export const OFFLINE_MESSAGE = "Can't reach the server. Check your connection and try again.";

// Turns Supabase/network errors into messages suitable for an Alert.
export function friendlyError(error: unknown): string {
  const e = (typeof error === 'object' && error !== null ? error : {}) as Record<string, unknown>;
  const message = typeof e.message === 'string' ? e.message : '';
  const code = typeof e.code === 'string' ? e.code : '';
  const name = typeof e.name === 'string' ? e.name : '';

  if (name === 'AuthRetryableFetchError' || /network request failed|failed to fetch|fetch failed/i.test(message)) {
    return OFFLINE_MESSAGE;
  }
  if (/invalid login credentials/i.test(message)) return 'Incorrect email or password.';
  if (/already (been )?registered/i.test(message)) return 'An account with this email already exists.';
  if (/database error saving new user/i.test(message)) {
    return 'That invite code is no longer valid. Go back and enter the current code.';
  }
  if (code === '42501' || code === 'PGRST116' || /row-level security|permission denied/i.test(message)) {
    return "You don't have permission to do that.";
  }
  return message || 'Something went wrong. Please try again.';
}
```

`lib/startup.ts`:
```ts
export type StartupAction = 'use-cache-then-refresh' | 'load-profile' | 'use-cache-offline' | 'signed-out';

// What AuthContext should do at launch, given what supabase.auth.getSession()
// returned and what's in the account cache.
export function startupAction(input: {
  sessionUserId: string | null;
  sessionErrorIsNetwork: boolean;
  cachedAccountId: string | null;
}): StartupAction {
  const { sessionUserId, sessionErrorIsNetwork, cachedAccountId } = input;
  if (sessionUserId) {
    return cachedAccountId === sessionUserId ? 'use-cache-then-refresh' : 'load-profile';
  }
  // getSession() tries to refresh an expired token; offline that fails with a
  // network error even though the stored refresh token is still good.
  if (sessionErrorIsNetwork && cachedAccountId) return 'use-cache-offline';
  return 'signed-out';
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test`
Expected: all tests in `tests/` PASS.

- [ ] **Step 6: Implement the React Native-side helpers** (checked by `tsc`; exercised on-device in later tasks)

`lib/cacheStorage.ts`:
```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { parseCache, serializeCache, type Cached } from './cache.ts';

export const CACHE_KEYS = {
  account: 'mustang.cache.account.v1',
  accounts: 'mustang.cache.accounts.v1',
  flags: 'mustang.cache.flags.v1',
  combos: 'mustang.cache.combos.v1',
  game: 'mustang.cache.game.v1',
} as const;

// Pre-Supabase storage keys. Their data is discarded (fresh start).
const LEGACY_KEYS = [
  'formation.account.v1',
  'formation.session.v1',
  'formation.accounts.directory.v1',
  'formation.flags.v1',
  'formation.combos.custom.v1',
  'formation.combos.deleted.v1',
  'formation.game.v1',
];

export async function readCache<T>(key: string, isValid: (v: unknown) => v is T): Promise<Cached<T> | null> {
  try {
    return parseCache(await AsyncStorage.getItem(key), isValid);
  } catch (error) {
    console.warn(`cacheStorage: failed to read ${key}`, error);
    return null;
  }
}

export async function writeCache<T>(key: string, data: T, syncedAt: number = Date.now()): Promise<void> {
  await AsyncStorage.setItem(key, serializeCache(data, syncedAt));
}

export async function clearAllCaches(): Promise<void> {
  await AsyncStorage.multiRemove(Object.values(CACHE_KEYS));
}

export async function clearLegacyKeys(): Promise<void> {
  await AsyncStorage.multiRemove(LEGACY_KEYS);
}
```

`hooks/useConnection.ts` (check `useNetworkState` against the Expo v57 `expo-network` docs first):
```ts
import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { useNetworkState } from 'expo-network';

export function useConnection(): { isOnline: boolean } {
  const state = useNetworkState();
  // isInternetReachable is undefined until the first check finishes; treat
  // "unknown" as online so launch isn't blocked.
  const isOnline = state.isInternetReachable ?? state.isConnected ?? true;
  return { isOnline };
}

// Calls `callback` each time the connection comes back (offline → online).
export function useOnReconnect(callback: () => void): void {
  const { isOnline } = useConnection();
  const wasOnline = useRef(isOnline);
  const latestCallback = useRef(callback);
  latestCallback.current = callback;

  useEffect(() => {
    if (isOnline && !wasOnline.current) latestCallback.current();
    wasOnline.current = isOnline;
  }, [isOnline]);
}

// Guard for edit actions: shows an alert and returns false when offline.
export function requireOnline(isOnline: boolean): boolean {
  if (!isOnline) {
    Alert.alert("You're offline", 'Connect to the internet to make changes.');
  }
  return isOnline;
}

// Style for edit controls while offline.
export const OFFLINE_DIM = { opacity: 0.4 } as const;
```

`hooks/useCachedList.ts`:
```ts
import { useCallback, useRef, useState } from 'react';
import { readCache, writeCache } from '../lib/cacheStorage';

// List state that mirrors itself into an AsyncStorage cache. `itemsRef` is
// always current, for use inside Realtime callbacks.
export function useCachedList<T extends { id: string }>(cacheKey: string, isValid: (v: unknown) => v is T[]) {
  const [items, setItems] = useState<T[]>([]);
  const [syncedAt, setSyncedAt] = useState<number | null>(null);
  const itemsRef = useRef<T[]>([]);
  // True once server data has arrived, so a slow cache read can't overwrite it.
  const hasServerData = useRef(false);

  const commit = useCallback(
    (next: T[]) => {
      hasServerData.current = true;
      itemsRef.current = next;
      setItems(next);
      const now = Date.now();
      setSyncedAt(now);
      writeCache(cacheKey, next, now).catch((error) => {
        console.warn(`useCachedList: failed to write ${cacheKey}`, error);
      });
    },
    [cacheKey]
  );

  const hydrate = useCallback(async () => {
    const cached = await readCache(cacheKey, isValid);
    if (cached && !hasServerData.current) {
      itemsRef.current = cached.data;
      setItems(cached.data);
      setSyncedAt(cached.syncedAt);
    }
  }, [cacheKey, isValid]);

  const reset = useCallback(() => {
    hasServerData.current = false;
    itemsRef.current = [];
    setItems([]);
    setSyncedAt(null);
  }, []);

  return { items, itemsRef, syncedAt, commit, hydrate, reset };
}
```

- [ ] **Step 7: Type-check and re-run tests**

Run: `npx tsc --noEmit && npm test`
Expected: no type errors; all tests PASS.

- [ ] **Step 8: Commit**

```bash
git add lib hooks/useConnection.ts hooks/useCachedList.ts tests
git commit -m "Add shared helpers for Supabase data: mappers, caches, errors, connectivity

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Accounts on Supabase Auth

**Files:**
- Rewrite: `context/AuthContext.tsx` (this also discards the uncommitted "Abby Rojas" purge code in the working tree, which the fresh start makes unnecessary)
- Modify: `navigation/types.ts`, `App.tsx`, `screens/LoginScreen.tsx`, `screens/InviteCodeScreen.tsx`, `screens/SignUpScreen.tsx`, `components/ChangePasswordSection.tsx`, `screens/member/MemberAccountScreen.tsx`, `screens/MemberProfileScreen.tsx`, `screens/SectionsScreen.tsx`

**Interfaces:**
- Consumes: `supabase` (Task 1). From Task 3: `profileToAccount`, `accountUpdatesToProfile`, `AccountUpdates`, `isAccount`, `isAccountList`, `upsertById`, `removeById`, `CACHE_KEYS`, `readCache`, `writeCache`, `clearAllCaches`, `clearLegacyKeys`, `startupAction`, `useOnReconnect`, `friendlyError`.
- Produces: `useAuth()` returning:
  ```ts
  {
    session: UserParams | null;
    account: Account | null;          // Account now has `id`, no `password`
    accounts: Account[];              // all profiles for Staff, [] for Members
    isLoading: boolean;
    checkInviteCode: (code: string) => Promise<boolean>;
    signUp: (input: SignUpInput) => Promise<Account>;                  // throws on failure
    logIn: (email: string, password: string) => Promise<Account>;       // throws on failure
    logOut: () => Promise<void>;
    updateAccount: (updates: AccountUpdates) => Promise<void>;          // throws on failure
    setAccountRole: (id: string, role: Role) => Promise<void>;          // throws on failure
    changePassword: (current: string, next: string) => Promise<boolean>; // false = wrong current password
  }
  ```
  `accountExists` is removed. `export type { Account, ShoeSize }` stays available from `context/AuthContext`.
  `SignUpInput = { email; password; inviteCode; firstName; lastName; instrument; height: { feet; inches }; weight }` (all strings).

- [ ] **Step 1: Update navigation types** — in `navigation/types.ts`:
  - Change `SignUp: undefined;` to `SignUp: { inviteCode: string };`
  - Add `id?: string;` as the first field of `MemberProfileParams`.

- [ ] **Step 2: Rewrite `context/AuthContext.tsx`**

```tsx
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { isAuthRetryableFetchError } from '@supabase/supabase-js';
import type { Role, UserParams } from '../navigation/types';
import type { Account, ShoeSize } from '../lib/models';
import type { ProfileRow } from '../lib/rows';
import { accountUpdatesToProfile, profileToAccount, type AccountUpdates } from '../lib/mappers';
import { isAccount, isAccountList } from '../lib/validators';
import { removeById, upsertById } from '../lib/realtime';
import { CACHE_KEYS, clearAllCaches, clearLegacyKeys, readCache, writeCache } from '../lib/cacheStorage';
import { startupAction } from '../lib/startup';
import { supabase } from '../lib/supabase';
import { useOnReconnect } from '../hooks/useConnection';

export type { Account, ShoeSize };

export type SignUpInput = {
  email: string;
  password: string;
  inviteCode: string;
  firstName: string;
  lastName: string;
  instrument: string;
  height: { feet: string; inches: string };
  weight: string;
};

type AuthContextValue = {
  session: UserParams | null;
  account: Account | null;
  accounts: Account[];
  isLoading: boolean;
  checkInviteCode: (code: string) => Promise<boolean>;
  signUp: (input: SignUpInput) => Promise<Account>;
  logIn: (email: string, password: string) => Promise<Account>;
  logOut: () => Promise<void>;
  updateAccount: (updates: AccountUpdates) => Promise<void>;
  setAccountRole: (id: string, role: Role) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<boolean>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const normalizeEmail = (email: string) => email.trim().toLowerCase();

function toSession(account: Account): UserParams {
  const { firstName, lastName, instrument, role } = account;
  return { firstName, lastName, instrument, role };
}

function warn(what: string) {
  return (error: unknown) => console.warn(`AuthContext: ${what}`, error);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<Account | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // Mirrors for Realtime callbacks, which would otherwise see stale state.
  const accountRef = useRef<Account | null>(null);
  const accountsRef = useRef<Account[]>([]);

  const commitAccount = useCallback((next: Account) => {
    accountRef.current = next;
    setAccount(next);
    writeCache(CACHE_KEYS.account, next).catch(warn('failed to cache account'));
  }, []);

  const commitAccounts = useCallback((next: Account[]) => {
    accountsRef.current = next;
    setAccounts(next);
    writeCache(CACHE_KEYS.accounts, next).catch(warn('failed to cache accounts'));
  }, []);

  const clearLocalState = useCallback(async () => {
    accountRef.current = null;
    setAccount(null);
    accountsRef.current = [];
    setAccounts([]);
    await clearAllCaches().catch(warn('failed to clear caches'));
  }, []);

  const loadProfile = useCallback(
    async (userId: string): Promise<Account> => {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
      if (error) throw error;
      const next = profileToAccount(data as ProfileRow);
      commitAccount(next);
      return next;
    },
    [commitAccount]
  );

  const loadAccounts = useCallback(async () => {
    const { data, error } = await supabase.from('profiles').select('*').order('last_name');
    if (error) throw error;
    commitAccounts((data as ProfileRow[]).map(profileToAccount));
  }, [commitAccounts]);

  // Launch: show cached data immediately where possible, then refresh.
  useEffect(() => {
    let isMounted = true;
    (async () => {
      await clearLegacyKeys().catch(warn('failed to clear legacy keys'));
      const cachedAccount = await readCache(CACHE_KEYS.account, isAccount);
      const cachedAccounts = await readCache(CACHE_KEYS.accounts, isAccountList);
      const { data, error } = await supabase.auth.getSession();
      if (!isMounted) return;

      const sessionUserId = data.session?.user.id ?? null;
      const action = startupAction({
        sessionUserId,
        sessionErrorIsNetwork: !!error && isAuthRetryableFetchError(error),
        cachedAccountId: cachedAccount?.data.id ?? null,
      });

      const showCache = () => {
        accountRef.current = cachedAccount!.data;
        setAccount(cachedAccount!.data);
        if (cachedAccounts) {
          accountsRef.current = cachedAccounts.data;
          setAccounts(cachedAccounts.data);
        }
      };

      if (action === 'use-cache-then-refresh') {
        showCache();
        loadProfile(sessionUserId!).catch(warn('background profile refresh failed'));
      } else if (action === 'use-cache-offline') {
        showCache();
      } else if (action === 'load-profile') {
        try {
          await loadProfile(sessionUserId!);
        } catch (loadError) {
          // Signed in but no profile we can load (e.g. first launch offline):
          // fall back to Login rather than showing an app with no user.
          warn('could not load profile at launch')(loadError);
          await supabase.auth.signOut({ scope: 'local' }).catch(warn('signOut failed'));
          await clearLocalState();
        }
      } else {
        await clearLocalState();
      }
      if (isMounted) setIsLoading(false);
    })();
    return () => {
      isMounted = false;
    };
  }, [loadProfile, clearLocalState]);

  // Session ended elsewhere (e.g. refresh token revoked).
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        void clearLocalState();
      }
    });
    return () => data.subscription.unsubscribe();
  }, [clearLocalState]);

  const userId = account?.id ?? null;
  const role = account?.role ?? null;

  // Staff see everyone; members only ever see themselves.
  useEffect(() => {
    if (!userId) return;
    if (role !== 'Staff') {
      if (accountsRef.current.length > 0) commitAccounts([]);
      return;
    }
    loadAccounts().catch(warn('failed to load accounts'));
  }, [userId, role, loadAccounts, commitAccounts]);

  // Live profile changes: your own edits from another device, promotions,
  // and (for staff) everyone else's changes.
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`profiles:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, (payload) => {
        if (payload.eventType === 'DELETE') {
          const id = (payload.old as Partial<ProfileRow>).id;
          if (id) commitAccounts(removeById(accountsRef.current, id));
          return;
        }
        const changed = profileToAccount(payload.new as ProfileRow);
        if (changed.id === accountRef.current?.id) commitAccount(changed);
        if (accountRef.current?.role === 'Staff') commitAccounts(upsertById(accountsRef.current, changed));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, commitAccount, commitAccounts]);

  useOnReconnect(() => {
    const current = accountRef.current;
    if (!current) return;
    loadProfile(current.id).catch(warn('refresh on reconnect failed'));
    if (current.role === 'Staff') loadAccounts().catch(warn('accounts refresh on reconnect failed'));
  });

  const checkInviteCode = useCallback(async (code: string) => {
    const { data, error } = await supabase.rpc('check_invite_code', { code });
    if (error) throw error;
    return data === true;
  }, []);

  const signUp = useCallback(
    async (input: SignUpInput): Promise<Account> => {
      const { data, error } = await supabase.auth.signUp({
        email: normalizeEmail(input.email),
        password: input.password,
        options: {
          data: {
            invite_code: input.inviteCode,
            first_name: input.firstName.trim(),
            last_name: input.lastName.trim(),
            instrument: input.instrument,
            height_feet: input.height.feet,
            height_inches: input.height.inches,
            weight: input.weight,
          },
        },
      });
      if (error) throw error;
      if (!data.user || !data.session) {
        throw new Error('Sign-up did not start a session. Is "Confirm email" turned off in Supabase?');
      }
      return loadProfile(data.user.id);
    },
    [loadProfile]
  );

  const logIn = useCallback(
    async (email: string, password: string): Promise<Account> => {
      const { data, error } = await supabase.auth.signInWithPassword({ email: normalizeEmail(email), password });
      if (error) throw error;
      return loadProfile(data.user.id);
    },
    [loadProfile]
  );

  const logOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) warn('signOut failed')(error);
    await clearLocalState();
  }, [clearLocalState]);

  const updateAccount = useCallback(
    async (updates: AccountUpdates) => {
      const current = accountRef.current;
      if (!current) throw new Error('Not signed in.');
      if (updates.email !== undefined && normalizeEmail(updates.email) !== current.email) {
        const { error } = await supabase.auth.updateUser({ email: normalizeEmail(updates.email) });
        if (error) throw error;
      }
      const patch = accountUpdatesToProfile(updates);
      if (Object.keys(patch).length === 0) {
        await loadProfile(current.id);
        return;
      }
      const { data, error } = await supabase.from('profiles').update(patch).eq('id', current.id).select().single();
      if (error) throw error;
      commitAccount(profileToAccount(data as ProfileRow));
    },
    [commitAccount, loadProfile]
  );

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    const current = accountRef.current;
    if (!current) return false;
    // Supabase doesn't ask for the old password, so check it by signing in.
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: current.email,
      password: currentPassword,
    });
    if (verifyError) {
      if (/invalid login credentials/i.test(verifyError.message)) return false;
      throw verifyError;
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
    return true;
  }, []);

  const setAccountRole = useCallback(
    async (id: string, nextRole: Role) => {
      const { error } = await supabase.rpc('set_role', { target: id, new_role: nextRole });
      if (error) throw error;
      commitAccounts(accountsRef.current.map((a) => (a.id === id ? { ...a, role: nextRole } : a)));
    },
    [commitAccounts]
  );

  const session = useMemo(() => (account ? toSession(account) : null), [account]);

  const value = useMemo(
    () => ({
      session,
      account,
      accounts,
      isLoading,
      checkInviteCode,
      signUp,
      logIn,
      logOut,
      updateAccount,
      setAccountRole,
      changePassword,
    }),
    [session, account, accounts, isLoading, checkInviteCode, signUp, logIn, logOut, updateAccount, setAccountRole, changePassword]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
```

- [ ] **Step 3: Live role switch in `App.tsx`**
  - Change the navigation import to `import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';` and add `useEffect, useRef` to the `react` import. Add `import type { Role } from './navigation/types';` (merge it with the existing `RootStackParamList` type import).
  - Above `function AppNavigator`, add `const navigationRef = createNavigationContainerRef<RootStackParamList>();`
  - At the top of `AppNavigator`, after `const { session, isLoading } = useAuth();`, add:
    ```tsx
    // When your role changes while the app is open (a staff member promoted or
    // demoted you), jump to the matching tabs. Login/logout already navigate
    // on their own; this only handles changes that arrive via Realtime.
    const previousRole = useRef<Role | null>(null);
    useEffect(() => {
      const role = session?.role ?? null;
      const previous = previousRole.current;
      previousRole.current = role;
      if (!navigationRef.isReady() || previous === role) return;
      if (previous && role && session) {
        navigationRef.reset({
          index: 0,
          routes: [{ name: role === 'Staff' ? 'MainTabs' : 'MemberTabs', params: session }],
        });
      } else if (previous && !role) {
        navigationRef.reset({ index: 0, routes: [{ name: 'Login' }] });
      }
    }, [session]);
    ```
    (Put this before the `if (isLoading) return null;` early return, so hooks always run in the same order.)
  - Change `<NavigationContainer>` to `<NavigationContainer ref={navigationRef}>`.

- [ ] **Step 4: Update `screens/LoginScreen.tsx`** — replace `handleLogin` with:
```tsx
  const handleLogin = async () => {
    let account;
    try {
      account = await logIn(email, password);
    } catch (error) {
      Alert.alert('Error', friendlyError(error));
      return;
    }
    navigation.reset({
      index: 0,
      routes: [
        {
          name: account.role === 'Staff' ? 'MainTabs' : 'MemberTabs',
          params: {
            firstName: account.firstName,
            lastName: account.lastName,
            instrument: account.instrument,
            role: account.role,
          },
        },
      ],
    });
  };
```
Add `import { friendlyError } from '../lib/errors';`.

- [ ] **Step 5: Update `screens/InviteCodeScreen.tsx`**
  - Delete the `INVITE_CODE` constant and its comment.
  - Add imports: `import { useAuth } from '../context/AuthContext';` and `import { friendlyError } from '../lib/errors';`.
  - Replace `handleContinue` with:
    ```tsx
      const { checkInviteCode } = useAuth();
      const [isChecking, setIsChecking] = useState(false);

      const handleContinue = async () => {
        const normalized = code.trim().toUpperCase();
        if (!normalized) {
          Alert.alert('Error', 'Please enter your invite code.');
          return;
        }
        setIsChecking(true);
        try {
          if (!(await checkInviteCode(normalized))) {
            Alert.alert('Error', 'Incorrect invite code.');
            return;
          }
          navigation.navigate('SignUp', { inviteCode: normalized });
        } catch (error) {
          Alert.alert('Error', friendlyError(error));
        } finally {
          setIsChecking(false);
        }
      };
    ```
  - On the Continue `Pressable` (the one with `onPress={handleContinue}`), add `disabled={isChecking}`.

- [ ] **Step 6: Update `screens/SignUpScreen.tsx`**
  - Change the component signature to `export default function SignUpScreen({ navigation, route }: Props)`.
  - Change `const { signUp, accountExists } = useAuth();` to `const { signUp } = useAuth();`.
  - Delete the whole `if (accountExists(email)) { ... }` block.
  - Replace the `await signUp({ ... });` call with:
    ```tsx
        try {
          await signUp({
            email,
            password,
            inviteCode: route.params.inviteCode,
            firstName,
            lastName,
            instrument,
            height: { feet: heightFeet, inches: heightInches },
            weight,
          });
        } catch (error) {
          Alert.alert("Couldn't create account", friendlyError(error));
          return;
        }
    ```
  - Add `import { friendlyError } from '../lib/errors';`.

- [ ] **Step 7: Update `components/ChangePasswordSection.tsx`** — replace `const success = await changePassword(currentPassword, newPassword);` with:
```tsx
    let success: boolean;
    try {
      success = await changePassword(currentPassword, newPassword);
    } catch (error) {
      Alert.alert('Error', friendlyError(error));
      return;
    }
```
Add `import { friendlyError } from '../lib/errors';`.

- [ ] **Step 8: Update `screens/member/MemberAccountScreen.tsx`** — make `handleToggleEdit` async and await the save:
```tsx
  const handleToggleEdit = async () => {
    if (isEditing) {
      if (phone.trim() !== '' && !isPlausiblePhone(phone)) {
        Alert.alert('Error', 'Please enter a valid phone number.');
        return;
      }

      try {
        await updateAccount({
          firstName,
          lastName,
          email,
          phone,
          instrument,
          shoeSize: { gender: shoeGender, size: shoeSizeValue },
          height: { feet: heightFeet, inches: heightInches },
          weight,
        });
      } catch (error) {
        Alert.alert("Couldn't save changes", friendlyError(error));
        return;
      }
    }
    setIsEditing((prev) => !prev);
  };
```
Add `import { friendlyError } from '../../lib/errors';`. Make `handleLogOut` `async` and `await logOut()` before `navigation.reset(...)`.

- [ ] **Step 9: Update `screens/MemberProfileScreen.tsx`**
  - Change the destructure to `const { id, name, section, email, phone, height, weight } = route.params;` and `const { account, setAccountRole } = useAuth();`.
  - Replace `const isRealAccount = !!email;` with:
    ```tsx
      const isRealAccount = !!id;
      // Staff can't change their own role (the database refuses it too).
      const isSelf = !!id && id === account?.id;
      const canChangeRole = isRealAccount && !isSelf;
    ```
  - In the role `Pressable` and its `Text`, replace every `isRealAccount` with `canChangeRole` (style condition, `onPress`, `disabled`).
  - Replace the alert body and `onPress` in `handleRoleChangePress`:
    ```tsx
        isStaff
          ? `Demote ${name} to Member? Their app will switch to the Member view.`
          : `Promote ${name} to Staff? Their app will switch to the Staff view.`,
    ```
    ```tsx
              onPress: async () => {
                if (!id) return;
                try {
                  await setAccountRole(id, nextRole);
                  setRole(nextRole);
                } catch (error) {
                  Alert.alert("Couldn't change role", friendlyError(error));
                }
              },
    ```
  - Add `import { friendlyError } from '../lib/errors';`. Directly after the existing `{!isRealAccount && (...)}` note below the button, add a second note for your own profile, copying the existing note's element and style and changing only the text:
    ```tsx
              {isSelf && (
                <Text style={/* same style as the !isRealAccount note */}>You can't change your own role.</Text>
              )}
    ```

- [ ] **Step 10: Update `screens/SectionsScreen.tsx` to carry account ids**
  - Add `id?: string;` as the first field of `type RosterMember`.
  - In `roster`, add `id: match?.id,` to the `fromRoster` object and `id: a.id,` to the `newSignUps` object.
  - In `handleRowPress`, add `id: member.id,` to `params`.
  - (The flag filters in this file change in Task 5.)

- [ ] **Step 11: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors in any file this task touched. Fix those now. Errors in files that later tasks rewrite (flags, combos, game) are expected at this point. List them in your report and leave them.

- [ ] **Step 12: Manual check (Expo Go or web)**

Run `npm start` and check: wrong invite code rejected; sign-up with `4F2K9` lands on Member tabs; log out → Login; log in again works; wrong password shows "Incorrect email or password."; force-close/reopen stays signed in. If you can't run the app (for example as a subagent), say so in your report. The controller will run the full on-device checklist in Task 9.

- [ ] **Step 13: Commit**

```bash
git add context/AuthContext.tsx navigation/types.ts App.tsx screens/LoginScreen.tsx screens/InviteCodeScreen.tsx screens/SignUpScreen.tsx components/ChangePasswordSection.tsx screens/member/MemberAccountScreen.tsx screens/MemberProfileScreen.tsx screens/SectionsScreen.tsx
git commit -m "Move accounts to Supabase Auth with server-checked invite code and live role changes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Flags on Supabase

**Files:**
- Rewrite: `context/FlagsContext.tsx`
- Reduce: `constants/flagsData.ts`
- Modify: `constants/myUniformData.ts`, `screens/member/FlagItemScreen.tsx`, `screens/member/MyInventoryScreen.tsx`, `screens/SectionsScreen.tsx`

**Interfaces:**
- Consumes: `useAuth().account` (Task 4); `useCachedList`, `CACHE_KEYS.flags`, `isFlagList`, `rowToFlag`, `upsertById`, `removeById`, `friendlyError`, `useOnReconnect`, `useConnection`, `requireOnline`, `OFFLINE_DIM` (Task 3).
- Produces: `useFlags()` returning `{ flags: Flag[]; syncedAt: number | null; error: string | null; reload: () => Promise<void>; addFlag: (input: FlagInput) => Promise<void>; updateFlag: (id: string, status: FlagStatus, comment: string) => Promise<void> }`, where `FlagInput = { piece; color; size; status: FlagStatus; comment }`. `Flag` has `memberId` instead of `memberName`.

- [ ] **Step 1: Reduce `constants/flagsData.ts` to** (seed flags are dropped by the fresh start):
```ts
export type { Flag, FlagStatus } from '../lib/models';
```

- [ ] **Step 2: In `constants/myUniformData.ts`** delete the line `export const MY_MEMBER_NAME = 'Maya Chen';` (and the blank line after it).

- [ ] **Step 3: Rewrite `context/FlagsContext.tsx`**

```tsx
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Flag, FlagStatus } from '../lib/models';
import type { FlagRow } from '../lib/rows';
import { rowToFlag } from '../lib/mappers';
import { isFlagList } from '../lib/validators';
import { removeById, upsertById } from '../lib/realtime';
import { CACHE_KEYS } from '../lib/cacheStorage';
import { friendlyError } from '../lib/errors';
import { supabase } from '../lib/supabase';
import { useCachedList } from '../hooks/useCachedList';
import { useOnReconnect } from '../hooks/useConnection';
import { useAuth } from './AuthContext';

export type FlagInput = { piece: string; color: string; size: string; status: FlagStatus; comment: string };

type FlagsContextValue = {
  // Members only ever receive their own flags (enforced by the database); staff receive all.
  flags: Flag[];
  syncedAt: number | null;
  error: string | null;
  reload: () => Promise<void>;
  addFlag: (input: FlagInput) => Promise<void>;
  updateFlag: (id: string, status: FlagStatus, comment: string) => Promise<void>;
};

const FlagsContext = createContext<FlagsContextValue | null>(null);

export function FlagsProvider({ children }: { children: ReactNode }) {
  const { account } = useAuth();
  const userId = account?.id ?? null;
  const role = account?.role ?? null;
  const { items: flags, itemsRef, syncedAt, commit, hydrate, reset } = useCachedList(CACHE_KEYS.flags, isFlagList);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const { data, error: fetchError } = await supabase.from('flags').select('*').order('created_at');
      if (fetchError) throw fetchError;
      commit((data as FlagRow[]).map(rowToFlag));
      setError(null);
    } catch (loadError) {
      setError(friendlyError(loadError));
    }
  }, [commit]);

  // Re-runs when the role changes, because a promotion changes which flags are visible.
  useEffect(() => {
    if (!userId) {
      reset();
      setError(null);
      return;
    }
    void hydrate();
    void reload();
    const channel = supabase
      .channel(`flags:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'flags' }, (payload) => {
        if (payload.eventType === 'DELETE') {
          const id = (payload.old as Partial<FlagRow>).id;
          if (id) commit(removeById(itemsRef.current, id));
          return;
        }
        commit(upsertById(itemsRef.current, rowToFlag(payload.new as FlagRow)));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, role, hydrate, reload, reset, commit, itemsRef]);

  useOnReconnect(() => {
    if (userId) void reload();
  });

  const addFlag = useCallback(
    async (input: FlagInput) => {
      if (!userId) throw new Error('Not signed in.');
      // Upsert: if this piece/color is already flagged (e.g. from another
      // device), update that flag instead of failing on the unique rule.
      const { data, error: saveError } = await supabase
        .from('flags')
        .upsert({ member_id: userId, ...input }, { onConflict: 'member_id,piece,color' })
        .select()
        .single();
      if (saveError) throw saveError;
      commit(upsertById(itemsRef.current, rowToFlag(data as FlagRow)));
    },
    [userId, commit, itemsRef]
  );

  const updateFlag = useCallback(
    async (id: string, status: FlagStatus, comment: string) => {
      const { data, error: saveError } = await supabase
        .from('flags')
        .update({ status, comment })
        .eq('id', id)
        .select()
        .single();
      if (saveError) throw saveError;
      commit(upsertById(itemsRef.current, rowToFlag(data as FlagRow)));
    },
    [commit, itemsRef]
  );

  const value = useMemo(
    () => ({ flags, syncedAt, error, reload, addFlag, updateFlag }),
    [flags, syncedAt, error, reload, addFlag, updateFlag]
  );

  return <FlagsContext.Provider value={value}>{children}</FlagsContext.Provider>;
}

export function useFlags(): FlagsContextValue {
  const context = useContext(FlagsContext);
  if (!context) {
    throw new Error('useFlags must be used within a FlagsProvider');
  }
  return context;
}
```

- [ ] **Step 4: Update `screens/member/FlagItemScreen.tsx`**
  - Replace the `MY_MEMBER_NAME` import with:
    ```tsx
    import { Alert } from 'react-native';   // merge into the existing react-native import
    import { useAuth } from '../../context/AuthContext';
    import { friendlyError } from '../../lib/errors';
    import { OFFLINE_DIM, requireOnline, useConnection } from '../../hooks/useConnection';
    ```
  - Replace the `existingFlag` lookup and `handleSubmit` with:
    ```tsx
      const { account } = useAuth();
      const { isOnline } = useConnection();
      const existingFlag = flags.find(
        (f) => f.memberId === account?.id && f.piece === piece && f.color === color
      );
    ```
    (keep `dirtyOnly`, `status`, `comment`, `useScrollToInput` lines as they are) and:
    ```tsx
      const [isSaving, setIsSaving] = useState(false);

      const handleSubmit = async () => {
        if (!requireOnline(isOnline)) return;
        setIsSaving(true);
        try {
          if (existingFlag) {
            await updateFlag(existingFlag.id, status, comment);
          } else {
            await addFlag({ piece, color, size, status, comment });
          }
          navigation.goBack();
        } catch (error) {
          Alert.alert("Couldn't save flag", friendlyError(error));
        } finally {
          setIsSaving(false);
        }
      };
    ```
  - Change the submit button to:
    ```tsx
          <Pressable
            style={[styles.submitButton, (!isOnline || isSaving) && OFFLINE_DIM]}
            onPress={handleSubmit}
            disabled={isSaving}
          >
    ```

- [ ] **Step 5: Update `screens/member/MyInventoryScreen.tsx`**
  - Change the import to `import { MY_UNIFORM, MY_WHITE_SHIRT, type UniformGroup } from '../../constants/myUniformData';` and add `import { useAuth } from '../../context/AuthContext';`.
  - In `MyInventoryScreen`, after `const { flags } = useFlags();`, add:
    ```tsx
      const { account } = useAuth();
      // The database only sends a member their own flags; filtering by id keeps
      // this correct if a staff account ever opens the member view.
      const myFlags = flags.filter((f) => f.memberId === account?.id);
    ```
    and pass `flags={myFlags}` to both `PieceGroup` and `WhiteShirtRow`.
  - In `PieceGroup`, change the filter to `flags.filter((f) => f.piece === group.piece)`.
  - In `WhiteShirtRow`, change the find to `flags.find((f) => f.piece === MY_WHITE_SHIRT.piece)`.

- [ ] **Step 6: Update `screens/SectionsScreen.tsx` flag matching**
  - Inside the component, after `roster`, add:
    ```tsx
      const flagsFor = (member: RosterMember) =>
        member.id ? flags.filter((f) => f.memberId === member.id) : [];
    ```
  - In `filteredMembers`, replace
    `flags.some((f) => f.memberName === member.name && f.piece === filterPiece && f.status === filterStatus)`
    with
    `flagsFor(member).some((f) => f.piece === filterPiece && f.status === filterStatus)`,
    and `const memberFlags = flags.filter((f) => f.memberName === member.name);` with `const memberFlags = flagsFor(member);`.
  - In the render (around the old line 325), replace `const memberFlags = flags.filter((f) => f.memberName === member.name);` with `const memberFlags = flagsFor(member);`.
  - Declare `flagsFor` above `filteredMembers` so it's defined before use. `filteredMembers`' dependency list already includes `flags`, which is enough.

- [ ] **Step 7: Type-check and search for leftovers**

Run: `npx tsc --noEmit`
Expected: no errors in flag-related files. Remaining errors may only be in combo/game files (Task 6/7).
Use the Grep tool for `memberName|MY_MEMBER_NAME` in `screens`, `components`, `context` and `constants`. Expected: no matches.

- [ ] **Step 8: Commit**

```bash
git add context/FlagsContext.tsx constants/flagsData.ts constants/myUniformData.ts screens/member/FlagItemScreen.tsx screens/member/MyInventoryScreen.tsx screens/SectionsScreen.tsx
git commit -m "Move flags to Supabase, keyed by member account id with live updates

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Combos and combo photos on Supabase

**Files:**
- Rewrite: `context/CombosContext.tsx`
- Reduce: `constants/combosData.ts`
- Modify: `screens/AddComboScreen.tsx`, `screens/ComboDetailScreen.tsx` (delete only; slot buttons are Task 7)

**Interfaces:**
- Consumes: `useAuth().account`; `useCachedList`, `CACHE_KEYS.combos`, `isComboList`, `rowToCombo`, `upsertById`, `removeById`, `friendlyError`, `useOnReconnect`, `useConnection`, `requireOnline`, `OFFLINE_DIM`.
- Produces: `useCombos()` returning `{ combos: Combo[]; syncedAt: number | null; error: string | null; reload: () => Promise<void>; addCombo: (input: NewComboInput) => Promise<void>; deleteCombo: (id: string) => Promise<void> }`, where `NewComboInput = { label: string; sub: string; components: string[]; localImageUri: string }`. `combo.image` stays the display URL, so `CatalogueScreen` and `GameDayScreen` need no image changes.

- [ ] **Step 1: Reduce `constants/combosData.ts` to** (seed combos now live in `supabase/seed.sql`):
```ts
export type { Combo } from '../lib/models';
```

- [ ] **Step 2: Check the Expo v57 `expo-file-system` docs** for reading a local file's bytes with the `File` class (expected: `new File(uri).arrayBuffer()` or `.bytes()`). Use whichever the docs show in Step 3.

- [ ] **Step 3: Rewrite `context/CombosContext.tsx`**

```tsx
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { File } from 'expo-file-system';
import type { Combo } from '../lib/models';
import type { ComboRow } from '../lib/rows';
import { rowToCombo } from '../lib/mappers';
import { isComboList } from '../lib/validators';
import { removeById, upsertById } from '../lib/realtime';
import { CACHE_KEYS } from '../lib/cacheStorage';
import { friendlyError } from '../lib/errors';
import { supabase } from '../lib/supabase';
import { useCachedList } from '../hooks/useCachedList';
import { useOnReconnect } from '../hooks/useConnection';
import { useAuth } from './AuthContext';

const BUCKET = 'combo-images';
// Photos are private; display URLs are signed and refreshed on every load.
const SIGNED_URL_SECONDS = 60 * 60 * 24 * 7;

export type NewComboInput = { label: string; sub: string; components: string[]; localImageUri: string };

type CombosContextValue = {
  combos: Combo[];
  syncedAt: number | null;
  error: string | null;
  reload: () => Promise<void>;
  addCombo: (input: NewComboInput) => Promise<void>;
  deleteCombo: (id: string) => Promise<void>;
};

const CombosContext = createContext<CombosContextValue | null>(null);

async function signedUrlsFor(rows: ComboRow[]): Promise<Map<string, string>> {
  const paths = rows.map((row) => row.image_path).filter((path): path is string => !!path);
  if (paths.length === 0) return new Map();
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(paths, SIGNED_URL_SECONDS);
  if (error) throw error;
  const urls = new Map<string, string>();
  for (const entry of data) {
    if (entry.path && entry.signedUrl) urls.set(entry.path, entry.signedUrl);
  }
  return urls;
}

function toCombos(rows: ComboRow[], urls: Map<string, string>): Combo[] {
  return rows.map((row) => rowToCombo(row, row.image_path ? urls.get(row.image_path) : undefined));
}

export function CombosProvider({ children }: { children: ReactNode }) {
  const { account } = useAuth();
  const userId = account?.id ?? null;
  const { items: combos, itemsRef, syncedAt, commit, hydrate, reset } = useCachedList(CACHE_KEYS.combos, isComboList);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('combos')
        .select('*')
        .order('created_at')
        .order('label');
      if (fetchError) throw fetchError;
      const rows = data as ComboRow[];
      commit(toCombos(rows, await signedUrlsFor(rows)));
      setError(null);
    } catch (loadError) {
      setError(friendlyError(loadError));
    }
  }, [commit]);

  useEffect(() => {
    if (!userId) {
      reset();
      setError(null);
      return;
    }
    void hydrate();
    void reload();
    const channel = supabase
      .channel(`combos:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'combos' }, (payload) => {
        if (payload.eventType === 'DELETE') {
          const id = (payload.old as Partial<ComboRow>).id;
          if (id) commit(removeById(itemsRef.current, id));
          return;
        }
        const row = payload.new as ComboRow;
        signedUrlsFor([row])
          .then((urls) => commit(upsertById(itemsRef.current, toCombos([row], urls)[0])))
          .catch(() => commit(upsertById(itemsRef.current, rowToCombo(row))));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, hydrate, reload, reset, commit, itemsRef]);

  useOnReconnect(() => {
    if (userId) void reload();
  });

  const addCombo = useCallback(
    async (input: NewComboInput) => {
      if (!userId) throw new Error('Not signed in.');
      // Upload the photo first; only create the combo if that worked.
      const path = `combo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
      const body = await new File(input.localImageUri).arrayBuffer();
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, body, { contentType: 'image/jpeg', upsert: false });
      if (uploadError) throw uploadError;

      const { data, error: insertError } = await supabase
        .from('combos')
        .insert({
          label: input.label,
          sub: input.sub,
          components: input.components,
          image_path: path,
          created_by: userId,
        })
        .select()
        .single();
      if (insertError) {
        await supabase.storage.from(BUCKET).remove([path]);
        throw insertError;
      }
      const row = data as ComboRow;
      commit(upsertById(itemsRef.current, toCombos([row], await signedUrlsFor([row]).catch(() => new Map()))[0]));
    },
    [userId, commit, itemsRef]
  );

  const deleteCombo = useCallback(
    async (id: string) => {
      const combo = itemsRef.current.find((c) => c.id === id);
      const { data, error: deleteError } = await supabase.from('combos').delete().eq('id', id).select('id');
      if (deleteError) throw deleteError;
      if (!data || data.length === 0) throw new Error("You don't have permission to do that.");
      commit(removeById(itemsRef.current, id));
      if (combo?.imagePath) {
        const { error: removeError } = await supabase.storage.from(BUCKET).remove([combo.imagePath]);
        if (removeError) console.warn('CombosContext: combo deleted but photo was not', removeError);
      }
    },
    [commit, itemsRef]
  );

  const value = useMemo(
    () => ({ combos, syncedAt, error, reload, addCombo, deleteCombo }),
    [combos, syncedAt, error, reload, addCombo, deleteCombo]
  );

  return <CombosContext.Provider value={value}>{children}</CombosContext.Provider>;
}

export function useCombos(): CombosContextValue {
  const context = useContext(CombosContext);
  if (!context) {
    throw new Error('useCombos must be used within a CombosProvider');
  }
  return context;
}
```

- [ ] **Step 4: Update `screens/AddComboScreen.tsx`**
  - Delete the `persistPickedImage` function and change the file-system import. Remove `import { File, Directory, Paths } from 'expo-file-system';` entirely.
  - Add imports: `import { friendlyError } from '../lib/errors';` and `import { OFFLINE_DIM, requireOnline, useConnection } from '../hooks/useConnection';`. In the component, add `const { isOnline } = useConnection();`.
  - Replace the body of `handleSubmit` after the two validation `if`s with:
    ```tsx
        if (!requireOnline(isOnline)) return;
        setIsSaving(true);
        try {
          const components = PIECES.map((piece) => {
            const color = selectedColors[piece.name];
            return color ? `${color} ${piece.name}` : null;
          }).filter((component): component is string => component !== null);

          await addCombo({ label: label.trim(), sub: sub.trim(), components, localImageUri: imageUri });
          navigation.goBack();
        } catch (error) {
          Alert.alert("Couldn't save combo", friendlyError(error));
        } finally {
          setIsSaving(false);
        }
    ```
  - Change the save button style to `style={[styles.submitButton, isSaving && styles.submitButtonDisabled, !isOnline && OFFLINE_DIM]}`.

- [ ] **Step 5: Update delete in `screens/ComboDetailScreen.tsx`**
  - Add imports: `import { friendlyError } from '../lib/errors';` and `import { OFFLINE_DIM, requireOnline, useConnection } from '../hooks/useConnection';`. In the component, add `const { isOnline } = useConnection();` **above** the `if (!combo)` early return (hooks must not come after it).
  - In `handleDelete`, add `if (!requireOnline(isOnline)) return;` as the first line, and replace the destructive `onPress` with:
    ```tsx
            onPress: async () => {
              try {
                await deleteCombo(combo.id);
                navigation.goBack();
              } catch (error) {
                Alert.alert("Couldn't delete combo", friendlyError(error));
              }
            },
    ```
  - Change the delete button to `<Pressable style={[styles.deleteButton, !isOnline && OFFLINE_DIM]} onPress={handleDelete}>`.
  - Keep the existing "this combo is set for pregame/halftime, choose a different combo first" guard. The database's `on delete set null` covers the case where another phone changes the game at the same moment.

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors except in game-related code (`gamesData`, `GameContext`, `GameDayScreen`, `ComboDetailScreen` slot usage) that Task 7 rewrites.

- [ ] **Step 7: Commit**

```bash
git add context/CombosContext.tsx constants/combosData.ts screens/AddComboScreen.tsx screens/ComboDetailScreen.tsx
git commit -m "Move combos and combo photos to Supabase with live updates

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Current game on Supabase

**Files:**
- Rewrite: `context/GameContext.tsx`
- Reduce: `constants/gamesData.ts`
- Modify: `screens/member/GameDayScreen.tsx`, `screens/ComboDetailScreen.tsx` (slot buttons)

**Interfaces:**
- Consumes: `useAuth().account`; `readCache`, `writeCache`, `CACHE_KEYS.game`, `isGameOrNull`, `rowToGame`, `friendlyError`, `useOnReconnect`, `useConnection`, `requireOnline`, `OFFLINE_DIM`.
- Produces: `useGame()` returning `{ game: Game | null; syncedAt: number | null; error: string | null; reload: () => Promise<void>; setCombo: (slot: ComboSlot, comboId: string) => Promise<void> }`. `ComboSlot = 'preGame' | 'halftime'` is still exported.

- [ ] **Step 1: Reduce `constants/gamesData.ts` to**
```ts
export type { Game } from '../lib/models';
```

- [ ] **Step 2: Rewrite `context/GameContext.tsx`**

```tsx
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Game } from '../lib/models';
import type { GameRow } from '../lib/rows';
import { rowToGame } from '../lib/mappers';
import { isGameOrNull } from '../lib/validators';
import { CACHE_KEYS, readCache, writeCache } from '../lib/cacheStorage';
import { friendlyError } from '../lib/errors';
import { supabase } from '../lib/supabase';
import { useOnReconnect } from '../hooks/useConnection';
import { useAuth } from './AuthContext';

export type ComboSlot = 'preGame' | 'halftime';

type GameContextValue = {
  // null when no game is marked current.
  game: Game | null;
  syncedAt: number | null;
  error: string | null;
  reload: () => Promise<void>;
  setCombo: (slot: ComboSlot, comboId: string) => Promise<void>;
};

const GameContext = createContext<GameContextValue | null>(null);

async function postedByName(id: string | null): Promise<string> {
  if (!id) return '';
  const { data, error } = await supabase
    .from('staff_directory')
    .select('first_name, last_name')
    .eq('id', id)
    .maybeSingle();
  if (error || !data) return '';
  return `${data.first_name} ${data.last_name}`.trim();
}

export function GameProvider({ children }: { children: ReactNode }) {
  const { account } = useAuth();
  const userId = account?.id ?? null;
  const [game, setGame] = useState<Game | null>(null);
  const [syncedAt, setSyncedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const gameRef = useRef<Game | null>(null);
  const hasServerData = useRef(false);

  const commit = useCallback((next: Game | null) => {
    hasServerData.current = true;
    gameRef.current = next;
    setGame(next);
    const now = Date.now();
    setSyncedAt(now);
    writeCache(CACHE_KEYS.game, next, now).catch((cacheError) => {
      console.warn('GameContext: failed to cache game', cacheError);
    });
  }, []);

  const reload = useCallback(async () => {
    try {
      const { data, error: fetchError } = await supabase.from('games').select('*').eq('is_current', true).maybeSingle();
      if (fetchError) throw fetchError;
      const row = data as GameRow | null;
      commit(row ? rowToGame(row, await postedByName(row.instructions_posted_by)) : null);
      setError(null);
    } catch (loadError) {
      setError(friendlyError(loadError));
    }
  }, [commit]);

  useEffect(() => {
    if (!userId) {
      hasServerData.current = false;
      gameRef.current = null;
      setGame(null);
      setSyncedAt(null);
      setError(null);
      return;
    }
    readCache(CACHE_KEYS.game, isGameOrNull).then((cached) => {
      if (cached && !hasServerData.current) {
        gameRef.current = cached.data;
        setGame(cached.data);
        setSyncedAt(cached.syncedAt);
      }
    });
    void reload();
    // Any change to games (including a slot cleared by a combo delete, or a
    // different game becoming current) just refetches the current game.
    const channel = supabase
      .channel(`games:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games' }, () => {
        void reload();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, reload]);

  useOnReconnect(() => {
    if (userId) void reload();
  });

  const setCombo = useCallback(
    async (slot: ComboSlot, comboId: string) => {
      const current = gameRef.current;
      if (!current) throw new Error('There is no current game to update.');
      const column = slot === 'preGame' ? 'pre_game_combo_id' : 'halftime_combo_id';
      const { data, error: saveError } = await supabase
        .from('games')
        .update({ [column]: comboId })
        .eq('id', current.id)
        .select()
        .single();
      if (saveError) throw saveError;
      commit(rowToGame(data as GameRow, current.instructionsPostedBy));
    },
    [commit]
  );

  const value = useMemo(
    () => ({ game, syncedAt, error, reload, setCombo }),
    [game, syncedAt, error, reload, setCombo]
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameContextValue {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
}
```

- [ ] **Step 3: Update `screens/member/GameDayScreen.tsx`**
  - Replace the two combo lookups with:
    ```tsx
      const preGameCombo = game?.preGameComboId ? combos.find((c) => c.id === game.preGameComboId) : undefined;
      const halftimeCombo = game?.halftimeComboId ? combos.find((c) => c.id === game.halftimeComboId) : undefined;
    ```
  - Replace everything from `<Text style={styles.gameLine}>` through the end of the after-game `lastSection` `View` with:
    ```tsx
          <Text style={styles.gameLine}>
            {game ? `vs. ${game.opponent} — ${game.date}` : 'No game scheduled'}
          </Text>

          {game && (
            <>
              {preGameCombo ? (
                <ComboSection title="Pre-game" combo={preGameCombo} />
              ) : (
                <EmptySlot title="Pre-game" />
              )}
              {halftimeCombo ? (
                <ComboSection title="Halftime" combo={halftimeCombo} />
              ) : (
                <EmptySlot title="Halftime" />
              )}

              <View style={styles.lastSection}>
                <Text style={styles.sectionTitle}>After-game instructions</Text>
                <View style={styles.instructionsCard}>
                  <Text style={styles.instructionsText}>{game.afterGameInstructions}</Text>
                  <View style={styles.instructionsMeta}>
                    {game.instructionsPostedBy ? (
                      <Text style={styles.instructionsMetaText}>Posted by {game.instructionsPostedBy}</Text>
                    ) : null}
                    {game.instructionsUpdatedAt ? (
                      <Text style={styles.instructionsMetaText}>Updated {game.instructionsUpdatedAt}</Text>
                    ) : null}
                  </View>
                </View>
              </View>
            </>
          )}
    ```
  - Below `ComboSection`, add:
    ```tsx
    function EmptySlot({ title }: { title: string }) {
      return (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{title}</Text>
          <Text style={styles.sectionSub}>No combo set</Text>
        </View>
      );
    }
    ```

- [ ] **Step 4: Update slot buttons in `screens/ComboDetailScreen.tsx`**
  - Change `const isPreGame = game.preGameComboId === combo.id;` and `const isHalftime = game.halftimeComboId === combo.id;` to use `game?.`.
  - Add, below `handleDelete`:
    ```tsx
      const handleSetCombo = async (slot: ComboSlot) => {
        if (!requireOnline(isOnline)) return;
        try {
          await setCombo(slot, combo.id);
        } catch (error) {
          Alert.alert("Couldn't update game day", friendlyError(error));
        }
      };
    ```
  - Change the two slot `Pressable`s to `onPress={() => handleSetCombo('preGame')}` / `onPress={() => handleSetCombo('halftime')}`, and add `!isOnline && OFFLINE_DIM` to each style array.

- [ ] **Step 5: Type-check and full unit tests**

Run: `npx tsc --noEmit && npm test`
Expected: no type errors anywhere; all unit tests PASS.

- [ ] **Step 6: Commit**

```bash
git add context/GameContext.tsx constants/gamesData.ts screens/member/GameDayScreen.tsx screens/ComboDetailScreen.tsx
git commit -m "Move the current game to Supabase with live combo assignment

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Offline banner and offline edit controls

**Files:**
- Create: `components/OfflineBanner.tsx`
- Modify: `screens/MainTabs.tsx`, `screens/MemberTabs.tsx`, `screens/member/MemberAccountScreen.tsx`, `screens/MemberProfileScreen.tsx`, `components/ChangePasswordSection.tsx`

**Interfaces:**
- Consumes: `useConnection`, `requireOnline`, `OFFLINE_DIM` (Task 3); `syncedAt`, `error` and `reload` from `useFlags`, `useCombos` and `useGame`; `formatTime` (Task 3).
- Produces: `<OfflineBanner />`, rendered directly above the tab bar in both tab navigators.

- [ ] **Step 1: Create `components/OfflineBanner.tsx`**

```tsx
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../constants/colors';
import { fonts } from '../constants/fonts';
import { useConnection } from '../hooks/useConnection';
import { useFlags } from '../context/FlagsContext';
import { useCombos } from '../context/CombosContext';
import { useGame } from '../context/GameContext';
import { formatTime } from '../lib/format';

export default function OfflineBanner() {
  const { isOnline } = useConnection();
  const flags = useFlags();
  const combos = useCombos();
  const game = useGame();

  if (!isOnline) {
    const syncTimes = [flags.syncedAt, combos.syncedAt, game.syncedAt].filter((t): t is number => t !== null);
    const oldest = syncTimes.length > 0 ? Math.min(...syncTimes) : null;
    return (
      <View style={styles.banner}>
        <Text style={styles.text}>
          {oldest ? `Offline — showing data from ${formatTime(oldest)}` : 'Offline — no saved data yet'}
        </Text>
      </View>
    );
  }

  if (flags.error || combos.error || game.error) {
    const retry = () => {
      void flags.reload();
      void combos.reload();
      void game.reload();
    };
    return (
      <View style={[styles.banner, styles.errorBanner]}>
        <Text style={styles.text}>Can't reach server</Text>
        <Pressable onPress={retry} hitSlop={8}>
          <Text style={[styles.text, styles.retry]}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 6,
    paddingHorizontal: 16,
    backgroundColor: colors.washTint,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  errorBanner: {
    backgroundColor: colors.rustTint,
  },
  text: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.ink,
  },
  retry: {
    textDecorationLine: 'underline',
  },
});
```

- [ ] **Step 2: Put the banner above both tab bars**

In `screens/MainTabs.tsx` and `screens/MemberTabs.tsx`:
  - Change the bottom-tabs import to `import { BottomTabBar, createBottomTabNavigator } from '@react-navigation/bottom-tabs';`, add `View` to the `react-native` import, and add `import OfflineBanner from '../components/OfflineBanner';`.
  - Add this prop to `<Tab.Navigator`:
    ```tsx
      tabBar={(props) => (
        <View>
          <OfflineBanner />
          <BottomTabBar {...props} />
        </View>
      )}
    ```

- [ ] **Step 3: Disable the remaining edit controls offline**

  - `screens/member/MemberAccountScreen.tsx`: add `const { isOnline } = useConnection();` and the imports `OFFLINE_DIM, requireOnline, useConnection` from `'../../hooks/useConnection'`. At the top of the `if (isEditing) {` branch in `handleToggleEdit`, add `if (!requireOnline(isOnline)) return;`. Change the Edit/Update button to `style={[styles.actionButton, isEditing && !isOnline && OFFLINE_DIM]}`. Entering edit mode offline stays allowed; saving is blocked.
  - `screens/MemberProfileScreen.tsx`: add `const { isOnline } = useConnection();` (imports from `'../hooks/useConnection'`). Make `requireOnline(isOnline)` the first line of `handleRoleChangePress` (`if (!requireOnline(isOnline)) return;`), and add `canChangeRole && !isOnline && OFFLINE_DIM` to the role button's style array.
  - `components/ChangePasswordSection.tsx`: add `const { isOnline } = useConnection();` (imports from `'../hooks/useConnection'`). Make `if (!requireOnline(isOnline)) return;` the first line of `handleSave`, and change the save button to `style={[styles.saveButton, !isOnline && OFFLINE_DIM]}`.

- [ ] **Step 4: Type-check, tests, doctor**

Run: `npx tsc --noEmit && npm test && CI=1 npx expo-doctor`
Expected: no type errors; unit tests PASS; expo-doctor shows only the known pre-existing patch-version warning.

- [ ] **Step 5: Commit**

```bash
git add components/OfflineBanner.tsx screens/MainTabs.tsx screens/MemberTabs.tsx screens/member/MemberAccountScreen.tsx screens/MemberProfileScreen.tsx components/ChangePasswordSection.tsx
git commit -m "Add offline banner and block edits while offline

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: End-to-end verification and docs

**Files:**
- Modify: `CLAUDE.md` (the one in `App Dev/`), `HANDOFF.md` (in `App Dev/`)

- [ ] **Step 1: Full automated verification**

Run (from `mobile-app/`): `npx tsc --noEmit && npm test && npm run test:rls && CI=1 npx expo-doctor`
Expected: no type errors; all unit and RLS tests PASS; only the known expo-doctor warning.

- [ ] **Step 2: USER ACTION — create the first Staff account.** Ask the user to sign up in the app (invite code `4F2K9`), then run in the Supabase SQL editor:
```sql
update public.profiles set role = 'Staff' where email = '<their email>';
```
Their open app should switch to the Staff tabs within a few seconds (this checks the live role switch).

- [ ] **Step 3: USER ACTION — on-device checklist** (two devices, or a phone + `npm run web`). Record pass/fail for each:
  1. Member flags an item; it appears on the Staff device's Sections/Inventory within a few seconds, without refreshing.
  2. Staff sets the halftime combo; the Member's Game Day updates live.
  3. Staff adds a combo with a photo; it appears, with the photo, on the other device.
  4. In the SQL editor run `update public.games set pre_game_combo_id = null where is_current;`. Game Day shows "No combo set" for Pre-game. Then restore it: `update public.games set pre_game_combo_id = '00000000-0000-4000-8000-000000000001' where is_current;`
  5. Airplane mode: cached data shows with "Offline — showing data from HH:MM" above the tab bar; Flag item / Save combo / Set for pregame / Update / Promote / Change password each show the "You're offline" alert. Reconnect: the banner clears and data refreshes.
  6. A wrong invite code is rejected on the Invite Code screen.
  7. Force-close and reopen while logged in: lands in the signed-in tabs.
  8. Staff promotes a member from Member Profile; the member's open app switches to the Staff view.

If any item fails, use the `superpowers:systematic-debugging` skill before changing code.

- [ ] **Step 4: Update docs**
  - `App Dev/CLAUDE.md`: replace the "Combos and the Catalogue" paragraph about AsyncStorage/seed combos with a short "Data and backend" section. Data lives in Supabase (`mobile-app/supabase/schema.sql`), and security rules are the only access control, so `npm run test:rls` must pass after any schema change. Contexts render their AsyncStorage cache (`mustang.cache.*`) first, then fetch and subscribe to Realtime. Secrets live in `mobile-app/supabase/.env.local` and the app config in `mobile-app/.env.local`. List the commands `npm test`, `npm run test:rls`, `npm run db:apply`.
  - `App Dev/HANDOFF.md`: add a dated `## 2026-09-29 update: Supabase backend` section. Summarize what moved, the fresh start (old on-device data discarded), the manual setup steps from Task 1, the on-device checklist results from Step 3, and the follow-ups from the spec's "Out of scope" list (staff resolve flags first).

- [ ] **Step 5: Commit**

```bash
git add ../CLAUDE.md ../HANDOFF.md
git commit -m "Document the Supabase backend and record verification results

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
