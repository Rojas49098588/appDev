# Games Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Staff plan football, basketball and volleyball games ahead as drafts and mark them ready. Members see only the next ready football game, plus the next day's ready basketball/volleyball games, on a two-tab Game day.

**Architecture:**
- **Database (Supabase):** the `games` table gains a sport, a status and game details.
- **Database rules:** a trigger keeps ready games complete, and RLS hides drafts and past games from members.
- **Supporting tables:** `polo_colors` holds the editable color list, and `game_signal` is a one-row table bumped on every games change, so members' screens refetch even when a game becomes invisible to them.
- **Shared logic:** pure functions in `lib/games.ts` decide what's shown, using band time (America/Chicago).
- **App wiring:** `GamesContext` replaces `GameContext`, and the staff screens and member Game day read from it.

**Tech Stack:** Expo SDK 58 / React Native 0.88, TypeScript, Supabase (Postgres, RLS, realtime), Node built-in test runner, `@react-native-community/datetimepicker` (new; installed with `npx expo install`).

**Spec:** `docs/superpowers/specs/2026-10-28-games-page-design.md`

## Global Constraints

- All work and testing happens against the **TEST** project only: `npm run db:apply:test`, `npm run test:rls`, `npm run start:test`. **Never run `npm run db:apply` (live)**, because the owner runs it.
- Commands run from `mobile-app/`. Unit tests: `npm test`. Type check: `npx tsc --noEmit`.
- `supabase/schema.sql` stays re-runnable: use `if not exists`, `drop ... if exists`, `create or replace`, and `on conflict do nothing`.
- RLS and security-definer functions are the only access control. A member must never be able to read a draft game, even with a direct query.
- "Today" is the date in **America/Chicago**, in both SQL and the app, whatever the phone's timezone.
- **Copy:**
  - Empty states: football "No upcoming game yet" / "Staff will post the next game's details here". BB/VB "No upcoming game yet" / "The next basketball or volleyball game will show here".
  - Blank instructions: "Instructions coming soon".
  - Combo in use: "Used by vs. {opponent}. Change that game first."
  - Delete confirmation: "Delete vs. {opponent} on {date}? This can't be undone."
- Use the existing style: `constants/colors.ts` and `constants/fonts.ts`, `TapeGutter`, `requireOnline`/`useConnection`, `successBuzz` haptics, and `friendlyError`. The layouts follow the approved mockups in `.superpowers/brainstorm/20853-1793222047/content/games-v1.html`, `games-v2.html` and `games-v3.html`; v2 and v3 win where they differ from v1.
- Commit on branch `games-page`, and end each commit message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **The date rolls over while the app is open:** at midnight Chicago time, the member's Game day moves to the next game without a restart (Task 4's tick plus `lib/games.ts` tests for `bandToday`).
2. **A phone set to a timezone other than Chicago:** at 11pm Pacific on game day, the game is still past in Chicago and must drop off. Tested in Task 3 with a fixed `Date`.
3. **Staff blank a required field on a posted game:** the database refuses the save, the app shows the message, and the form keeps what staff typed (Tasks 1 and 7).
4. **A posted game moved back to draft or deleted:** it disappears from a member's open screen through `game_signal` (Tasks 2 and 4, plus an RLS test that members can read `game_signal`).
5. **Drafts with no date:** they sort to the end of the queue and never crash the formatters (Task 3 tests).

---

### Task 1: Games schema, ready rule and member visibility

**Files:**
- Modify: `mobile-app/supabase/schema.sql` (the `games` table at about lines 119–131, the games policies at about lines 640–645, and a new section after them)
- Modify: `mobile-app/supabase/seed.sql`, `mobile-app/supabase/test-seed.sql`
- Test: `mobile-app/supabase/tests/rls.test.ts`

**Interfaces:**
- Produces:
  - **`public.games` columns:** `id`, `sport text not null default 'football'` (`'football'|'basketball'|'volleyball'`), `division text null` (`'mens'|'womens'`), `status text not null default 'draft'` (`'draft'|'ready'`), `opponent text not null default ''`, `game_date date null`, `kickoff_time time null`, `call_time time null`, `no_call_time boolean not null default false`, `polo_colors jsonb not null default '[]'` (array of `{"name": text, "swatch": "#RRGGBB"}`), `polo_note text not null default ''`, `group_number int null` (1–5), `pre_game_combo_id`, `halftime_combo_id`, `after_game_instructions`, `instructions_posted_by`, `instructions_updated_at`.
  - **Removed:** `is_current` and the index `games_one_current`.
  - **Function:** `public.band_today() returns date`, which is `(now() at time zone 'America/Chicago')::date`, `stable`.

- [ ] **Step 1: Update the RLS tests first**
  - The tests no longer use a seeded current game. Remove `CURRENT_GAME`, `currentSlots` and `restoreSlots`.
  - In `before()`, create test games through `admin` and record their ids so `after()` deletes them. Fixtures:
    - a ready football game dated `band_today` + 3 days, fully filled in, with combos `SEED_COMBO_01` and `...0014`
    - a draft football game
    - a ready football game dated 3 days ago
  - Rewrite the existing game assertions (old lines ~243–276, ~340, ~435–448) against these fixtures, and add `describe('games', ...)` with:
    - `member reads ready upcoming games but not drafts or past games`: `asMember.from('games').select('id')` contains the ready upcoming id, and contains neither the draft id nor the past id.
    - `member cannot insert, update or delete games`: each returns an error or 0 rows, and admin re-reads show nothing changed.
    - `staff can insert, update and delete games`.
    - `ready requires every football field`:
      - Staff insert `{ sport: 'football', status: 'ready', opponent: 'Rice' }` and get an error whose message contains `required field`.
      - Inserting the same row with `status: 'draft'` succeeds.
    - `ready requires group and division for basketball/volleyball`:
      - A ready volleyball game with everything except `group_number` errors.
      - Adding `group_number: 3` succeeds.
      - Combos aren't needed for volleyball.
    - `no_call_time satisfies call time and clears it`: a ready game with `no_call_time: true, call_time: '06:30'` saves with `call_time` null.
    - `blanking a field on a ready game is refused`: staff update the ready fixture to `opponent: ''`, get an error, and the row is unchanged.
    - `instructions edits stamp the poster`: staff set `after_game_instructions: 'Hang coats'`; the row then has `instructions_posted_by = staff.id` and `instructions_updated_at` not null. Setting it to `''` clears both.
- [ ] **Step 2: Run `npm run test:rls`**. Expected: the new `games` tests FAIL (missing columns or policies).
- [ ] **Step 3: Implement the schema in `schema.sql`**
  - **Table definition:** update `create table if not exists public.games` to the column list above. For existing databases, add re-runnable `alter table ... add column if not exists` for each new column, with the same check constraints added through `do $$ ... if not exists (select from pg_constraint ...)` or `drop constraint if exists` then `add constraint`. Also `alter column game_date drop not null`, `drop index if exists games_one_current`, and `alter table public.games drop column if exists is_current`.
  - **Readiness trigger:** `public.games_check_ready()`, a BEFORE INSERT OR UPDATE trigger `games_check_ready`.
    - **It always normalizes the row:**
      - trims `opponent`
      - `no_call_time` → `call_time := null`
      - for football: `division := null`, `group_number := null`
      - for basketball/volleyball: both combo ids `null`, and `after_game_instructions := ''`
    - **When `status = 'ready'` and (`game_date is null` or `game_date >= band_today()`),** it raises with errcode `23514` and the message `Fill in every required field before marking this game ready.` if any of these is missing:
      - `opponent`
      - `game_date`
      - `kickoff_time`
      - call time (`call_time` set or `no_call_time` true)
      - polo (`jsonb_array_length(polo_colors) >= 1`)
      - football: both combo ids
      - basketball/volleyball: `division` and `group_number`

      Past ready games are exempt, so a combo delete that nulls a past game's slot (FK `on delete set null`) still works.
  - **Instructions stamp:** in the same trigger, or its own trigger, when `after_game_instructions` changes (or on insert, if non-blank): set `instructions_posted_by := auth.uid()` and `instructions_updated_at := now()`. If the new text is blank, set both to null.
  - **Policies:**
    - `games_select`: `using (public.is_staff() or (status = 'ready' and game_date >= public.band_today() and not public.is_archived()))`
    - `games_insert`: `with check (public.is_staff())`
    - `games_update`: unchanged
    - `games_delete`: `using (public.is_staff())`
- [ ] **Step 4: Update the seeds**
  - **`seed.sql`:** delete the "One current game is required" insert and its comment. Existing games become football drafts through the column default, so the live "Lincoln High" game is hidden from members.
  - **`test-seed.sql`:** add testers' sample games with fixed ids `00000000-0000-4000-8000-0000000000b1` to `...b4`, `on conflict (id) do nothing`, dates relative to `current_date`:
    - b1: ready football vs. Notre Dame, +10 days, kickoff 11:00, call 06:30, polo Blue, combos ...0001 / ...0014
    - b2: draft football vs. Rice, +17 days
    - b3: ready women's volleyball vs. Tulsa, +3 days, group 3, start 18:30, call 17:30, polo Red
    - b4: ready men's basketball vs. Houston, same day as b3, group 1, start 19:00, `no_call_time`, polo Blue

    The polo JSON uses the swatches from Task 2: Blue `#2C5AA0`, Red `#C0392B`.
- [ ] **Step 5: Run `npm run db:apply:test`, then `npm run test:rls`**. Expected: the schema applies cleanly twice in a row (run it twice to prove re-runnability), and all tests PASS.
- [ ] **Step 6: Commit** `feat(db): games sport/status/details, ready rule, member visibility`.

### Task 2: Polo colors, combo-in-use guard, game_signal

**Files:**
- Modify: `mobile-app/supabase/schema.sql`, `mobile-app/supabase/seed.sql`
- Test: `mobile-app/supabase/tests/rls.test.ts`

**Interfaces:**
- Consumes: `public.games` and `band_today()` from Task 1.
- Produces:
  - **`public.polo_colors`:** `id uuid pk default gen_random_uuid()`, `name text not null unique`, `swatch text not null` (check `~ '^#[0-9A-Fa-f]{6}$'`), `sort_order int not null default 0`, `created_at timestamptz default now()`.
  - **`public.game_signal`:** `id int primary key check (id = 1)`, `changed_at timestamptz not null default now()`. One row with id 1.
  - **Combo guard error message:** `Used by vs. {opponent}. Change that game first.`

- [ ] **Step 1: Add the failing tests**
  - `every signed-in user reads polo colors; only staff change them`:
    - a member select returns rows including `Blue` and `Red`
    - a member insert fails
    - staff insert, update and delete succeed (clean up afterwards)
  - `combo used by a ready upcoming game cannot be deleted`: staff (or admin) create a combo, put it on the Task 1 ready fixture's halftime, then a staff delete errors with a message equal to `Used by vs. {fixture opponent}. Change that game first.`, and the combo still exists.
  - `combo used only by a draft or past game can be deleted`: the delete succeeds and the game's slot becomes null.
  - `game changes bump game_signal`: read `changed_at` as a member, have staff update any game, read again, and the value is greater.
  - `members cannot write game_signal`.
- [ ] **Step 2: Run `npm run test:rls`**. Expected: the new tests FAIL.
- [ ] **Step 3: Implement**
  - **`polo_colors`:** the table plus RLS. Select for `authenticated`; insert, update and delete for `public.is_staff()`.
  - **`seed.sql`:** `insert into public.polo_colors (name, swatch, sort_order) values ('Blue', '#2C5AA0', 1), ('Red', '#C0392B', 2) on conflict (name) do nothing;`. These are real data, so they go to live too.
  - **`game_signal`:** the table, `insert ... values (1) on conflict do nothing` in `schema.sql`, and RLS select for `authenticated` with no write policies.
    - Add a security-definer function `public.bump_game_signal()` with a statement-level `after insert or update or delete on public.games for each statement` trigger, which runs `update public.game_signal set changed_at = now() where id = 1`.
    - Add `game_signal` and `polo_colors` to the realtime publication loop.
  - **Combo guard:** `public.combos_guard_in_use()`, BEFORE DELETE on `public.combos`. It raises errcode `23503` with the message above when a game has `status = 'ready' and game_date >= band_today()` and either combo id `= old.id`. If several games match, use the earliest by date.
- [ ] **Step 4: Run `npm run db:apply:test` twice, then `npm run test:rls`**. Expected: all PASS.
- [ ] **Step 5: Commit** `feat(db): polo colors, combo-in-use guard, game change signal`.

### Task 3: Game model and pure game logic

**Files:**
- Modify: `mobile-app/lib/models.ts`, `mobile-app/lib/rows.ts`, `mobile-app/lib/mappers.ts`, `mobile-app/lib/validators.ts`, `mobile-app/lib/format.ts`
- Create: `mobile-app/lib/games.ts`
- Test: `mobile-app/tests/games.test.ts`, `mobile-app/tests/mappers.test.ts`, `mobile-app/tests/format.test.ts`

**Interfaces:**
- Produces, in `lib/models.ts` (replacing the old `Game`):
  ```ts
  export type Sport = 'football' | 'basketball' | 'volleyball';
  export type Division = 'mens' | 'womens';
  export type GameStatus = 'draft' | 'ready';
  export type PoloColor = { name: string; swatch: string };
  export type PoloColorOption = PoloColor & { id: string; sortOrder: number };
  export type Game = {
    id: string; sport: Sport; division: Division | null; status: GameStatus;
    opponent: string;
    gameDate: string | null;      // 'YYYY-MM-DD'
    kickoffTime: string | null;   // 'HH:MM' 24h
    callTime: string | null;      // 'HH:MM' 24h
    noCallTime: boolean;
    polo: PoloColor[]; poloNote: string; groupNumber: number | null;
    preGameComboId: string | null; halftimeComboId: string | null;
    afterGameInstructions: string;
    instructionsPostedBy: string;   // display name, '' if none
    instructionsUpdatedAt: string;  // display, e.g. 'Sep 15', '' if none
  };
  export type GameDraft = Omit<Game, 'id' | 'status' | 'instructionsPostedBy' | 'instructionsUpdatedAt'>;
  ```
- Produces, in `lib/rows.ts`: `GameRow` matching Task 1's columns (`kickoff_time`/`call_time` come back as `'HH:MM:SS'`), and `PoloColorRow`.
- Produces, in `lib/mappers.ts`:
  - `rowToGame(row: GameRow, postedByName: string): Game` (trims times to `HH:MM`)
  - `gameDraftToRow(d: GameDraft): Partial<GameRow>`
  - `rowToPoloColor(row: PoloColorRow): PoloColorOption`
- Produces, in `lib/validators.ts`: `isGameList(v): v is Game[]` (for the cache) and `isPoloColorList`. Remove `isGameOrNull`.
- Produces, in `lib/format.ts`: `formatClock(hhmm: string | null): string`. `'14:30'` → `'2:30pm'`, `'06:30'` → `'6:30am'`, `'12:00'` → `'12:00pm'`, `'00:15'` → `'12:15am'`, `null` → `''`.
- Produces, in `lib/games.ts`:
  - `bandToday(now: Date): string`: `'YYYY-MM-DD'` in America/Chicago, via `Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' })`.
  - `isCourt(sport: Sport): boolean`: true for basketball and volleyball.
  - `missingFields(g: GameDraft): string[]`, using labels in this order:
    - `'Opposing university'`
    - `'Game date'`
    - `'Kickoff'` (football) or `'Start'` (court)
    - `'Call time'`
    - `'Polo'`
    - court only: `"Men's / Women's"` and `'Group'`
    - football only: `'Pre-game combo'` and `'Halftime combo'`
  - `shownFootball(games: Game[], today: string): Game | null`: the earliest (by date, then kickoff) ready football game with `gameDate >= today`.
  - `shownCourt(games: Game[], today: string): Game[]`: all ready court games on the earliest `gameDate >= today` that has one, sorted by kickoff.
  - `staffSections(games: Game[], tab: 'football' | 'court', today: string): { upNext: Game[]; queue: Game[]; past: Game[] }`:
    - `upNext` is the shown games for that tab.
    - `queue` is the rest of the not-past games, by date then kickoff, with undated drafts last.
    - `past` is `gameDate < today`, newest first.
  - `comboInUse(games: Game[], comboId: string, today: string): Game | null`: the earliest ready, not-past game using the combo in either slot.
  - `comboShortcutTarget(games: Game[], today: string): Game | null`: `shownFootball`, otherwise the earliest not-past football game (any status) with a date.
  - `sportLabel(g: Pick<Game, 'sport' | 'division'>): string`:
    - `'Football'`
    - `"Women's volleyball"` and `"Men's basketball"`
    - court with null division: `'Volleyball'` / `'Basketball'`

- [ ] **Step 1: Write failing tests in `tests/games.test.ts`**. Use `const g = (over: Partial<Game>) => ({ ...base, ...over })` with a complete ready football `base`.
  - `bandToday uses Chicago, not the device zone`: `bandToday(new Date('2026-11-08T05:30:00Z'))` is `'2026-11-07'` (11:30pm CST), and `new Date('2026-11-08T06:30:00Z')` gives `'2026-11-08'`.
  - `shownFootball picks the earliest ready upcoming game and skips drafts and past games`:
    - games: ready on `2026-11-14`, draft on `2026-11-07`, ready on `2026-10-31`, and ready on `2026-11-21`, with today `'2026-11-01'`
    - expected: the `2026-11-14` game
    - with today `'2026-11-14'`: still that game (it's shown all of game day)
    - with today `'2026-11-15'`: the `2026-11-21` game
  - `shownFootball returns null when the next game is a draft and nothing later is ready`.
  - `shownCourt returns every ready court game on the next game day in start order`:
    - games: VB on `2026-11-08` at 18:30, WBB on `2026-11-08` at 14:00, BB on `2026-11-10`, and a draft VB on `2026-11-08`
    - expected: `[WBB, VB]` (the draft is excluded)
  - `football and court never affect each other`: a ready court game earlier than the football game leaves `shownFootball` unchanged.
  - `missingFields lists what blocks ready`:
    - a blank football draft gives all seven football labels in order
    - `noCallTime: true` removes `'Call time'`
    - a court draft gives `"Men's / Women's"` and `'Group'`, and no combo labels
  - `staffSections puts undated drafts last and past games newest first`.
  - `comboInUse ignores drafts and past games`.
  - `comboShortcutTarget falls back to the next football draft`.
  - Mapper tests in `tests/mappers.test.ts`: `rowToGame` trims `'11:00:00'` to `'11:00'`, and `gameDraftToRow` round-trips.

  `formatClock` cases go in `tests/format.test.ts`.
- [ ] **Step 2: Run `npm test`**. Expected: FAIL (module or exports missing).
- [ ] **Step 3: Implement** the types and functions above. Sorting compares `'YYYY-MM-DD'` and `'HH:MM'` strings directly, with null kickoff last.
- [ ] **Step 4: Run `npm test`**. Expected: PASS. `npx tsc --noEmit` will still fail in the screens that use the old `Game`; Task 4 fixes them.
- [ ] **Step 5: Commit** `feat: game model and pure game-day logic`.

### Task 4: GamesContext and polo colors in the app

**Files:**
- Create: `mobile-app/context/GamesContext.tsx`
- Delete: `mobile-app/context/GameContext.tsx`
- Modify: `mobile-app/App.tsx` (provider), `mobile-app/components/OfflineBanner.tsx`, `mobile-app/lib/cacheStorage.ts` (keys)
- Temporarily modify: `mobile-app/screens/member/GameDayScreen.tsx` and `mobile-app/screens/ComboDetailScreen.tsx`, only enough to compile. Tasks 5 and 9 replace them.

**Interfaces:**
- Consumes: Task 3 types, mappers and `bandToday`.
- Produces: `useGames()` returning:
  ```ts
  {
    games: Game[];                 // all rows the user may read (RLS decides)
    poloColors: PoloColorOption[]; // sorted by sortOrder, name
    today: string;                 // bandToday(new Date()), refreshed every 60s and on AppState 'active'
    syncedAt: number | null; error: string | null; reload: () => Promise<void>;
    createGame: (d: GameDraft, status: GameStatus) => Promise<Game>;
    updateGame: (id: string, d: GameDraft, status: GameStatus) => Promise<Game>;
    setStatus: (id: string, status: GameStatus) => Promise<void>;
    deleteGame: (id: string) => Promise<void>;
    setGameCombo: (id: string, slot: 'preGame' | 'halftime', comboId: string) => Promise<void>;
    addPoloColor: (name: string, swatch: string) => Promise<void>;
    removePoloColor: (id: string) => Promise<void>;
  }
  ```
  - `GamesProvider` replaces `GameProvider` in `App.tsx`.
  - Cache keys: `CACHE_KEYS.games = 'mustang.cache.games.v2'` and `CACHE_KEYS.poloColors = 'mustang.cache.poloColors.v1'`. Add the old `'mustang.cache.game.v1'` to `LEGACY_KEYS`.

- [ ] **Step 1: Implement `GamesContext`, following `GameContext`'s current pattern.**
  - Reuse its hasSession guard, cache read before the first fetch, `useOnReconnect`, `useOnSessionChange` and `friendlyError` error state.
  - **Fetch:** `games` select `*` ordered by `game_date` (posted-by names come through `staff_directory`, as now, fetched once per distinct id), and `polo_colors` ordered by `sort_order, name`.
  - **Realtime:** subscribe to `postgres_changes` on `game_signal` and on `polo_colors`, and refetch on any event. Use `uniqueTopic` and `logChannelFailures`.
  - **Writes:** each write throws the Supabase error so screens can show `friendlyError`. Writes that return 0 rows throw "You don't have permission to do that.", as `deleteCombo` does.
- [ ] **Step 2: Update `OfflineBanner`, and make `GameDayScreen` and `ComboDetailScreen` compile.** As a stopgap, `GameDayScreen` renders `shownFootball(games, today)` in the existing layout, and `ComboDetailScreen` targets `comboShortcutTarget`.
- [ ] **Step 3: Run `npx tsc --noEmit` and `npm test`**. Expected: no type errors, and the tests PASS.
- [ ] **Step 4: Manual check.** `npm run start:test`, sign in as `test-staff@mustangcloset.test`, and check that the app loads with no red screen.
- [ ] **Step 5: Commit** `feat: GamesContext with game_signal refresh and polo colors`.

### Task 5: Member Game day with Football and BB / VB tabs

**Files:**
- Modify: `mobile-app/screens/member/GameDayScreen.tsx`
- Create: `mobile-app/components/SegmentTabs.tsx`, a two-option segmented control `({ options: [string, string], value: 0 | 1, onChange })` that Task 6 reuses.

**Interfaces:** consumes `useGames()`, `useCombos()`, `shownFootball`, `shownCourt`, `sportLabel` and `formatClock`.

- [ ] **Step 1: Implement the screen to match mockups v2 and v3, member screens.**
  - **Football tab:**
    - The line `vs. {opponent} — {formatGameDate(gameDate)}`.
    - A two-up facts row: Call time shows `formatClock` or `None` when `noCallTime`; Kickoff shows `formatClock`.
    - A Polo card labeled "Polo · rehearsal & parade". It shows each color as a dot plus name, then `poloNote` below when it isn't blank.
    - The existing Pre-game and Halftime combo sections: photo, then a "Pieces" chip list from `components`.
    - After-game instructions show the text and "Posted by", or `Instructions coming soon` in italic faint ink when blank.
  - **BB / VB tab:** one card per `shownCourt` game. Each card shows:
    - `sportLabel` as a small caps label
    - `vs. {opponent} — {date}`
    - a dark "Group" block with the large number
    - Call time and Start facts
    - Polo and note
    - the hint `Not your group? Everyone can see this, so you can fill in or swap.`
  - **Empty states:** per tab, the copy from Global Constraints.
  - The chosen tab is remembered only for the session (React state; no storage).
- [ ] **Step 2: Run `npx tsc --noEmit`**. Expected: clean.
- [ ] **Step 3: Manual check on TEST** as a member, e.g. `test-abigail-rojas@mustangcloset.test` with password `mustangtest2026`.
  - Football shows Notre Dame (b1).
  - BB / VB shows Tulsa and Houston on the same day, in start order, and Houston shows call time "None".
  - Rice (b2, draft) appears nowhere.
- [ ] **Step 4: Commit** `feat: member Game day football and BB/VB tabs`.

### Task 6: Staff Games list and Home entry

**Files:**
- Create: `mobile-app/screens/GamesScreen.tsx`
- Modify: `mobile-app/navigation/types.ts` (add `Games: undefined;`, `GameEdit: { gameId?: string; sport?: Sport };` and `PoloColors: undefined;` to `RootStackParamList`), `mobile-app/App.tsx` (register `Games`, `GameEdit` and `PoloColors` with `headerShown: false`; `GameEdit` and `PoloColors` point to the screens from Tasks 7–8, so create minimal placeholder files now if needed for compiling), and `mobile-app/screens/HomeScreen.tsx` (a new "Games" block above "Archived members", same block style)

**Interfaces:** consumes `useGames()`, `staffSections`, `SegmentTabs` and `missingFields`.

- [ ] **Step 1: Home block.**
  - Title "Games", link "View" → `Games`.
  - Note: the next posted football game as `Next: vs. {opponent}, {date}`, or `No football game posted`.
- [ ] **Step 2: `GamesScreen`, matching mockup v1 screen 1 and v3 screen 3.**
  - Back to Home, title "Games", and `SegmentTabs` with `['Football', 'BB / VB']`.
  - Three sections. Empty sections are hidden, except that "Up next" shows `Nothing posted. Mark a game ready to post it.`
    - **Up next:** marked Posted.
    - **Queue:** marked Ready or Draft.
    - **Past:** dimmed, marked Done.
  - **Each card shows:**
    - `vs. {opponent || 'Untitled game'}` and a status pill (Posted / Ready / Draft / Done, with colors as in the mockup)
    - a mono line: date · kickoff · call time (football) or date · Group N · polo names (court)
    - drafts: a line `Missing: {missingFields(...).join(', ')}`
    - court games: a `VB · W` style tag
  - Tapping a card → `GameEdit { gameId }`.
  - A "+ New game" floating button → `GameEdit { sport }`, where `sport` is `'football'` on the Football tab and `'basketball'` on BB / VB.
- [ ] **Step 3: Run `npx tsc --noEmit`, then a manual check as test-staff.**
  - Football: b1 is in Up next, b2 is in Queue with its Missing line.
  - BB / VB: b3 and b4 are both in Up next.
- [ ] **Step 4: Commit** `feat: staff Games list and Home block`.

### Task 7: Staff Edit / New game screen

**Files:**
- Create: `mobile-app/screens/GameEditScreen.tsx`, `mobile-app/components/ComboPickerSheet.tsx`
- Modify: `mobile-app/package.json` (via `npx expo install @react-native-community/datetimepicker`)

**Interfaces:**
- Consumes: `useGames()`, `useCombos()`, `missingFields`, `isCourt`, `formatClock` and `formatGameDate`.
- Produces: the `ComboPickerSheet` props `({ visible, combos, selectedId, onPick: (id: string) => void, onClose })`.

- [ ] **Step 1: Install the picker:** `npx expo install @react-native-community/datetimepicker`. Expected: `package.json` gains an SDK-58-compatible version.
- [ ] **Step 2: Build the form, matching mockup v2 screens 1–2 and v3 screen 4.**
  - Header: back, then the title (`vs. {opponent}` or `New game`) and the status pill.
  - Fields, in order:
    - Type chips: Football / Basketball / Volleyball, plus Men's / Women's chips for court.
    - Opposing university (`TextInput`).
    - Game date (date picker).
    - Kickoff/Start and Call time (time pickers, side by side), plus a "No call time for this game" checkbox that disables Call time.
    - Polo: multi-select chips from `poloColors`, with an "Edit colors" link → `PoloColors`.
    - Polo note, optional.
    - Football only: Pre-game and Halftime combo cards. "Change" opens `ComboPickerSheet`.
    - Court only: Group buttons 1–5.
    - Football only: After-game instructions (multiline).
  - Required labels have a red `*` (all except polo note and instructions).
  - Use `useScrollToInput` and `KeyboardDoneBar` as the other forms do.
  - Show a game's saved polo colors as selected even if they've since been removed from `poloColors`; render them from the game's own copy.
- [ ] **Step 3: Buttons and rules.**
  - **For drafts or new games:**
    - **Save draft:** `createGame`/`updateGame` with `'draft'`. No field checks.
    - **Mark ready:** if `missingFields` isn't empty, mark those fields red with `Required` and show the banner `Fill in {n} more field(s) to mark this game ready.` Nothing is saved. Otherwise save with `'ready'`.
  - **For ready games:**
    - **Save:** stays ready. If `missingFields` isn't empty, show the same red marking and don't save. The database refuses anyway; show `friendlyError` if it does.
    - **Move back to draft:** `setStatus(id, 'draft')`.
  - **For existing games:** a destructive **Delete game** at the bottom. `Alert.alert` with the confirm copy from Global Constraints (date via `formatGameDate`, or `no date`) and Cancel / Delete. After the delete, `goBack()`.
  - Every write is guarded with `requireOnline`, disables the buttons while saving (double-submit guard), calls `successBuzz()` on success, and goes back to `Games` after a save.
- [ ] **Step 4: Run `npx tsc --noEmit`, then a manual check on TEST as test-staff.**
  - Create a WVB game and save it as a draft; it appears in the BB / VB Queue.
  - Mark ready with no group: the field turns red and nothing is saved.
  - Add the group and mark ready: it's saved and shows as Ready or Posted.
  - Open b1, clear the opponent and Save: it's refused.
  - Move b1 to draft: a member's open Game day empties within a few seconds.
  - Delete a game: the confirmation appears, Cancel keeps it, and Delete removes it.
- [ ] **Step 5: Commit** `feat: staff edit/new game screen`.

### Task 8: Polo colors screen

**Files:**
- Create: `mobile-app/screens/PoloColorsScreen.tsx`

**Interfaces:** consumes `useGames().poloColors`, `addPoloColor` and `removePoloColor`.

- [ ] **Step 1: Implement.**
  - List the colors (dot + name) with a remove button. Remove asks `Remove {name}? Games that already use it keep it.` with Cancel / Remove.
  - Add: a name input plus a row of 8 preset swatches: `#2C5AA0` blue, `#C0392B` red, `#FFFFFF` white, `#22201D` black, `#9AA3AD` grey, `#2E7D4F` green, `#E0B000` gold, `#6A3FA0` purple. The first is selected by default.
  - Reject blank names, and names already in the list (case-insensitive) with `That color is already in the list.`
  - Uses `requireOnline` and `successBuzz`.
- [ ] **Step 2: Run `npx tsc --noEmit`, then a manual check.** Add "White" and see it appear in the Edit game polo chips. Remove it, and a game that used it still shows White.
- [ ] **Step 3: Commit** `feat: staff polo color list`.

### Task 9: Catalogue combo popup and delete block

**Files:**
- Modify: `mobile-app/screens/ComboDetailScreen.tsx`

**Interfaces:** consumes `useGames()` (`games`, `today`, `setGameCombo`), `comboShortcutTarget` and `comboInUse`.

- [ ] **Step 1: Retarget the shortcut.**
  - The "Set for pregame" / "Set for halftime" buttons act on `comboShortcutTarget(games, today)` and name it, e.g. `Set for pregame · vs. Notre Dame (Sat, Nov 7)`.
  - When there's no target, they're replaced by the note `No upcoming football game. Plan one in Games.`
  - The "in use" markers compare against that same target.
- [ ] **Step 2: Block deletes.**
  - Before confirming, `comboInUse(games, combo.id, today)`. If it finds a game, `Alert.alert("Can't delete combo", 'Used by vs. {opponent}. Change that game first.')` and stop.
  - If the database guard fires anyway (stale data), the existing catch shows its message through `friendlyError`.
  - Remove the old slot-based in-use check.
- [ ] **Step 3: Run `npx tsc --noEmit`, then a manual check.** Deleting Combo 14 (used by b1) is blocked with "Used by vs. Notre Dame…". Deleting Combo 05 still works.
- [ ] **Step 4: Commit** `feat: combo popup targets next football game; block deleting combos in use`.

### Task 10: Docs and release notes

**Files:**
- Modify: `HANDOFF.md`, `bugs.md` (only if a known issue is found), `CLAUDE.md` (where it mentions the single current game, if it does)

- [ ] **Step 1: Write a `HANDOFF.md` section "2026-10-28: Games page".**
  - What changed: statuses, tabs, polo colors, the combo delete block, and the removal of `is_current`.
  - Live release steps:
    1. The owner runs `npm run db:apply`. The old "Lincoln High" game becomes a hidden football draft, which staff can delete.
    2. Publish `npx eas update --branch live --environment preview`.
    3. Staff create real games and combos.
  - Testers: publish to the `testing` branch with `--environment development`.
- [ ] **Step 2: Run `npm test`, `npx tsc --noEmit` and `npm run test:rls`**. Expected: all PASS.
- [ ] **Step 3: Commit** `docs: games page handoff and release steps`.
