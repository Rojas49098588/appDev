# Inventory in the Database Implementation Plan (Plan 2 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the uniform inventory from app code into Supabase, let any numbered piece type be assigned to members, and show every piece in staff Inventory as Assigned / Unassigned / Out for repair with filters and an "Every [type]" table.

**Architecture:** Two new tables, `piece_types` (name, kind, ordered colors, counted stock) and `pieces` (one row per numbered type + color + number, with `out_for_repair`), readable by all signed-in users and writable by staff. Member numbers move from four fixed `profiles` columns into one `profiles.numbers jsonb` map keyed by piece type name (`{"Coats":"185"}`), changed only through a staff-only `set_member_numbers()` that enforces one member per number. Assignment state is derived on the staff client from `pieces` + all accounts. A new `InventoryContext` follows the existing cached-list + realtime pattern, and every screen that read `constants/inventoryData.ts` or `uniformSizes` switches to it.

**Tech Stack:** Expo SDK 58 / React Native 0.88, TypeScript, Supabase (Postgres, RLS, Realtime), Node built-in test runner.

**Spec:** `docs/superpowers/specs/2026-10-23-flag-photos-and-piece-inventory-design.md`. This plan covers goals 4, 5, 6, 12, "How 'assigned' is worked out", and the member-inventory bullet of "Flags and pieces". **Plan 3** (spreadsheet import; add type / color / number screens, goals 7–10) comes next. Builds on Plan 1 (flag photos and history).

## Global Constraints

- Work on a new branch `inventory-database` created from `flag-photos-inventory` (Plan 1, not yet merged). Never commit to `master`.
- Read the versioned Expo docs before writing Expo code (`mobile-app/AGENTS.md`); SDK 58.
- Never run `npm audit fix --force`. No new dependencies.
- **Use the TEST Supabase project only.** After any schema change: `npm run db:apply:test`, then `npm run test:rls` (both read `supabase/.env.test.local`). Never run `npm run db:apply` (the live project) during this plan; the live project is updated once, at release, after the user approves a cleanup.
- After any schema change, `npm run test:rls` must pass. `npm test` must pass every task. `npx tsc --noEmit` must add no new errors beyond the 13 pre-existing ScrollView-ref errors (Tasks 3–4 may leave errors in screens until Task 5, as stated there).
- A piece is **piece type + color + number**. Each number exists in every color of its type; each number belongs to at most one active member; a member has the same number in every color.
- Assigned / Unassigned / Out for repair: Assigned when an active member's `numbers` has that type → number; Out for repair is per piece (one color) and overrides the display for that color only; otherwise Unassigned.
- One member per number is enforced by the database; a member number missing from inventory is allowed but warned about.
- Only staff change inventory, numbers, or out-for-repair. Members can read piece types (their My Inventory needs colors).
- Flags keep matching pieces by text (`piece` = type name, `color`, `size` = number), exactly as Plan 1 does; no foreign key from flags to pieces.
- **Inventory starts empty** (user decision: no fake data mixed with real). The placeholder list in `constants/inventoryData.ts` is deleted, not seeded; Plan 3's spreadsheet import is the first inventory data. Tests create their own throwaway piece types named with the `RUN` id and delete them afterwards. Every screen must handle zero piece types gracefully (empty state text, no crash).
- Sample combos live only in `supabase/test-seed.sql` (test project). `supabase/seed.sql` holds only the invite code and one placeholder current game (opponent 'TBD').
- All commands run from `mobile-app/`.

## Review Focus

1. **Staff give a member a number another member already has** → refused with a clear message naming the problem, nothing saved. (Task 2 RLS test `set_member_numbers refuses a number held by another active member`; Task 4 `friendlyError` test.)
2. **A member's number isn't in inventory (typo like 1530)** → saved, and a warning is shown on that member and in Inventory. (Task 3 test `unknownNumbers lists numbers with no matching piece`.)
3. **A member is archived** → their numbers are cleared and kept in the snapshot; their pieces show Unassigned; old archive snapshots (with `coat_size` keys) still display. (Task 2 archive RLS test; Task 3 test `rowToArchive reads old size keys and new numbers`.)
4. **Cached data from before this change** (old `uniformSizes` accounts, no inventory cache) → rejected and refetched, no crash. (Task 3 test `isAccount rejects pre-numbers cached accounts`.)
5. **A numbered type with no pieces yet, or no inventory at all** (the state right after this plan) → nothing crashes; member screens show only the white shirt; staff Inventory shows "No inventory yet — import your spreadsheet" style empty text. (Task 3 test `memberPieceTypes skips numbered types with no pieces`; Task 5/6 empty states checked on device.)

---

### Task 1: Inventory tables and seed

**Files:**
- Modify: `supabase/schema.sql` (new section after the flags tables; add `piece_types`, `pieces` to the realtime publication loop)
- Modify: `supabase/seed.sql`
- Modify: `supabase/tests/rls.test.ts`

**Interfaces:**
- Produces (SQL):
  - `piece_types(id uuid pk default gen_random_uuid(), name text not null unique, kind text not null check (kind in ('numbered','counted')), colors text[] not null default '{}', stock jsonb not null default '{}'::jsonb, sort_order int not null default 0, retired boolean not null default false, created_at timestamptz not null default now())`. `stock` is only used for counted types: `{"Blue": 40}`.
  - `pieces(id uuid pk default gen_random_uuid(), piece_type_id uuid not null references piece_types(id) on delete cascade, color text not null, number text not null check (number ~ '^[0-9]+$'), out_for_repair boolean not null default false, created_at timestamptz not null default now(), unique (piece_type_id, color, number))`.
  - RLS: select for `authenticated` on both; insert/update/delete only `is_staff()`. Members and anon get nothing else.
  - **No seed data** for these tables (inventory starts empty).
  - Tests: in `before`, `admin` creates a throwaway numbered type `RLS Coats ${RUN}` with colors `['Blue','Red']` and pieces `Blue/101`, `Red/101`, and a counted type `RLS Ties ${RUN}` with stock `{"Blue": 3}`; `after` deletes both types (pieces cascade).

- [ ] **Step 1: Write failing RLS tests** (`describe('inventory')`)

```ts
test('members and staff can read piece types and pieces', async () => {
  // asMember: select piece_types where name = `RLS Coats ${RUN}` -> kind 'numbered', colors ['Blue','Red']
  // asMember: pieces for that type -> 2 rows
});
test('members cannot insert, update or delete piece types or pieces', ...);   // each -> error or 0 rows; verify via admin nothing changed
test('staff can mark a piece out for repair and back', ...);                  // asStaff update out_for_repair true -> 1 row; then false
test('anon reads nothing from piece_types or pieces', ...);
```

- [ ] **Step 2: Run, verify FAIL** — `npm run test:rls` (tables missing).

- [ ] **Step 3: Implement** the tables, policies (follow the `combos` policy style), and realtime publication entries.

- [ ] **Step 4: Apply and run** — `npm run db:apply:test && npm run db:apply:test && npm run test:rls` (applied twice to prove re-runnable) → all pass.

- [ ] **Step 5: Commit** — `git commit -m "Add piece_types and pieces tables"`

---

### Task 2: Member numbers on profiles

**Files:**
- Modify: `supabase/schema.sql` (profiles columns ~line 28-33, `guard_profile_update` ~217, `set_uniform_sizes` ~239, `archive_member` / `restore_member`)
- Modify: `supabase/tests/rls.test.ts` (`describe('uniform sizes')` → `describe('member numbers')`, archiving test)

**Interfaces:**
- Produces (SQL):
  - `profiles.numbers jsonb not null default '{}'::jsonb` — keys are `piece_types.name`, values digit strings.
  - One-time migration in a `do $$` block that runs only while `profiles.coat_size` exists: copy non-empty `coat_size/vest_size/bibber_size/pant_size` into `numbers` under `Coats/Vests/Bibbers/Pants`, then drop the four columns and `set_uniform_sizes`.
  - `set_member_numbers(target uuid, new_numbers jsonb) returns void` — security definer, staff only (`42501`). Trims values; drops empty values; every value must match `^[0-9]+$` (`22023` 'invalid number'); refuses (`23505`, message `'number <n> for <type> already belongs to <First Last>'`) if any other non-archived profile has the same type → number. Sets `app.allow_number_change` around the update. Keys not in `piece_types` are allowed (typo warning is client-side).
  - `guard_profile_update`: replace the four-column size check with `new.numbers is distinct from old.numbers` gated by `app.allow_number_change`.
  - `archive_member`: snapshot gets `'numbers', p.numbers` instead of the four size keys; it clears `numbers` to `'{}'` instead of the size columns.

- [ ] **Step 1: Write failing RLS tests** (rewrite the `uniform sizes` describe as `member numbers`)

```ts
test('a member cannot change their own numbers directly', ...);         // update { numbers: {Coats:'1'} } -> error, unchanged
test('a member cannot call set_member_numbers', ...);                   // -> 42501
test("staff can set a member's numbers, trimmed, empties dropped", ...); // {Coats:' 185 ', Vests:''} -> numbers = {Coats:'185'}
test('staff cannot set a non-numeric number', ...);                     // {Coats:'18a'} -> 22023
test('set_member_numbers refuses a number held by another active member', async () => {
  // staff sets member {Coats:'T<RUN digits>'}... use a numeric test value unlikely to be real, e.g. '9' + digits of Date.now() (max 12 chars)
  // staff sets otherMember same Coats number -> error code 23505, message includes 'already belongs to'
  // otherMember.numbers unchanged
});
test('a number held by an archived member can be reused', ...);        // archive a throwaway user holding X, then set X on member -> ok
```

Archiving test: assert the snapshot has `numbers` (not `coat_size`) and the profile's `numbers` is `{}` after archive.

- [ ] **Step 2: Run, verify FAIL** — `npm run test:rls`.
- [ ] **Step 3: Implement** in `schema.sql`. Keep everything re-runnable (`add column if not exists`, guarded `do $$` migration, `drop function if exists public.set_uniform_sizes(uuid, text, text, text, text)`). Update the `create table profiles` / `alter table` lines so a fresh install never creates the old size columns.
- [ ] **Step 4: Apply and run** — `npm run db:apply:test && npm run db:apply:test && npm run test:rls` → pass.
- [ ] **Step 5: Commit** — `git commit -m "Store member numbers in profiles.numbers; add set_member_numbers"`

---

### Task 3: Inventory and numbers in the app model

**Files:**
- Modify: `lib/models.ts`, `lib/rows.ts`, `lib/mappers.ts`, `lib/validators.ts`, `lib/uniform.ts`, `lib/cacheStorage.ts` (new cache keys)
- Create: `lib/inventory.ts`
- Test: `tests/mappers.test.ts`, `tests/uniform.test.ts`, create `tests/inventory.test.ts`

**Interfaces:**
- Produces:
  - `type PieceKind = 'numbered' | 'counted'`
  - `type PieceType = { id: string; name: string; kind: PieceKind; colors: string[]; stock: Record<string, number>; sortOrder: number; retired: boolean }`
  - `type InventoryPiece = { id: string; pieceTypeId: string; pieceType: string; color: string; number: string; outForRepair: boolean }` (`pieceType` is the type name, filled by the mapper from the types list)
  - `type MemberNumbers = Record<string, string>`; `Account.uniformSizes` is replaced by `Account.numbers: MemberNumbers`; `MemberArchive.uniformSizes` by `MemberArchive.numbers: MemberNumbers`. Remove `UniformSizes`.
  - `rowToPieceType(row: PieceTypeRow): PieceType`; `rowToPiece(row: PieceRow, typeName: string): InventoryPiece`
  - `rowToArchive` reads `snapshot.numbers` when present, else converts old `coat_size/vest_size/bibber_size/pant_size` to `{Coats, Vests, Bibbers, Pants}` (dropping empties).
  - Validators: `isPieceTypeList`, `isPieceList`; `isAccount` requires `numbers` (object of strings) and rejects the old `uniformSizes` shape.
  - `CACHE_KEYS.pieceTypes`, `CACHE_KEYS.pieces` following the existing `mustang.cache.*` naming.
  - `lib/uniform.ts`: `numberFor(numbers: MemberNumbers | undefined, pieceType: string): string` ('' when none) and `matchesNumber(numbers, pieceType, query): boolean` (exact, trimmed; '' never matches) replace `sizeFor` / `matchesUniformSize`; keep `digitsOnly`; remove `UNIFORM_PIECES` and `EMPTY_UNIFORM_SIZES`.
  - `lib/inventory.ts`:
    - `type Assignment = { state: 'assigned'; memberId: string; memberName: string } | { state: 'unassigned' } | { state: 'out_for_repair'; memberId: string | null; memberName: string | null }`
    - `ownerIndex(accounts: Account[]): Map<string, Account>` — key `${pieceType}|${number}`, active (`archivedAt === null`) Members only.
    - `assignmentFor(piece: InventoryPiece, owners: Map<string, Account>): Assignment`
    - `unknownNumbers(accounts: Account[], pieces: InventoryPiece[]): { memberId: string; memberName: string; pieceType: string; number: string }[]` — active members' numbers with no piece of that type and number.
    - `numberRows(type: PieceType, pieces: InventoryPiece[], owners: Map<string, Account>): { number: string; owner: Account | null; cells: Record<string, InventoryPiece | null> }[]` — one row per distinct number of that type, sorted numerically, a cell per `type.colors` entry (`null` when that color doesn't exist for that number).
    - `memberPieceTypes(types: PieceType[], pieces: InventoryPiece[]): PieceType[]` — non-retired, sorted by `sortOrder`; numbered types only if they have at least one piece; counted types always.
    - `pieceCount(type: PieceType, pieces: InventoryPiece[]): number` — numbered: piece rows; counted: sum of `stock`.

- [ ] **Step 1: Write failing tests**

```ts
test('rowToPieceType and rowToPiece map columns', ...);
test('rowToArchive reads old size keys and new numbers', () => {
  // snapshot with coat_size '208', vest_size '' -> numbers { Coats: '208' }
  // snapshot with numbers { Coats: '185', Jackets: '12' } -> same
});
test('isAccount rejects pre-numbers cached accounts', ...);               // object with uniformSizes, no numbers -> false
test('numberFor / matchesNumber', ...);                                   // ({Coats:'185'}, 'Coats', ' 185 ') true; ('', ...) false; missing type ''
test('assignmentFor: assigned, unassigned, out for repair keeps owner', ...);
test('ownerIndex ignores archived members and staff', ...);
test('unknownNumbers lists numbers with no matching piece', ...);         // member {Coats:'1530'} with no Coats 1530 -> listed; {Coats:'104'} with piece -> not
test('numberRows: one row per number, numeric order, null cells for missing colors', ...); // numbers '96','104' -> order 96,104
test('memberPieceTypes skips numbered types with no pieces and retired types', ...);
test('pieceCount: numbered counts pieces, counted sums stock', ...);
```

- [ ] **Step 2: Run, verify FAIL** — `npm test`.
- [ ] **Step 3: Implement.** Update existing fixtures in `tests/mappers.test.ts`, `tests/uniform.test.ts`, `tests/cache.test.ts` for `numbers`.
- [ ] **Step 4: Run** — `npm test` → PASS. `npx tsc --noEmit 2>&1 | grep -E "^(lib|tests)/"` → no output (screens/contexts are fixed in Tasks 4–5).
- [ ] **Step 5: Commit** — `git commit -m "Model piece types, pieces and member numbers"`

---

### Task 4: InventoryContext and member numbers in AuthContext

**Files:**
- Create: `context/InventoryContext.tsx`
- Modify: `context/AuthContext.tsx` (`setUniformSizes` ~350), `App.tsx` (provider), `lib/errors.ts`, `tests/errors.test.ts`

**Interfaces:**
- Consumes: Task 1 tables, Task 2 `set_member_numbers`, Task 3 types/mappers/validators.
- Produces:
  - `useInventory(): { pieceTypes: PieceType[]; pieces: InventoryPiece[]; syncedAt: number | null; error: string | null; reload(): Promise<void>; setOutForRepair(pieceId: string, value: boolean): Promise<void> }` — two cached lists (`CACHE_KEYS.pieceTypes`, `CACHE_KEYS.pieces`), realtime on both tables, refetch on reconnect / session change, same structure as `FlagsContext`. Types sorted by `sortOrder`. `setOutForRepair` throws "You don't have permission to do that." on a 0-row result.
  - `InventoryProvider` mounted in `App.tsx` inside `AuthProvider`, alongside the other providers.
  - `AuthContext`: `setMemberNumbers(id: string, numbers: MemberNumbers): Promise<void>` replaces `setUniformSizes` (calls `set_member_numbers`, updates `accounts` / `account` caches like today).
  - `friendlyError`: Postgres `23505` whose message contains `already belongs to` returns that message; the existing `flags_one_open_per_piece` mapping is narrowed to messages containing `flags_one_open_per_piece`. (Fixes the Plan 1 parked finding.)

- [ ] **Step 1: Write failing tests** in `tests/errors.test.ts`: `friendlyError passes through the number-taken message`; `friendlyError only maps flags_one_open_per_piece to the open-flag message`; `an unrelated 23505 is not called an open-flag conflict`.
- [ ] **Step 2: Run, verify FAIL** — `npm test`.
- [ ] **Step 3: Implement** `lib/errors.ts`, `InventoryContext`, the `AuthContext` change, and the provider. Screens still referencing `setUniformSizes` / `PIECES` are fixed in Task 5.
- [ ] **Step 4: Run** — `npm test` → PASS; `npx tsc --noEmit 2>&1 | grep -E "^(lib|tests|context)/|App.tsx"` → no output.
- [ ] **Step 5: Commit** — `git commit -m "Add InventoryContext and setMemberNumbers"`

---

### Task 5: Switch every screen to the database inventory

**Files:**
- Modify: `constants/myUniformData.ts` (`uniformFor` → `uniformFor(types: PieceType[], numbers: MemberNumbers | undefined)` using `memberPieceTypes`; keep `MY_WHITE_SHIRT`, `NO_SIZE`, `UNASSIGNED_SIZE`)
- Modify: `screens/member/MyInventoryScreen.tsx`, `screens/member/MySizesScreen.tsx`, `screens/member/FlagItemScreen.tsx` (unused route; compile only)
- Modify: `screens/MemberProfileScreen.tsx` (number editor ~242), `screens/SectionsScreen.tsx` (number filter ~358), `screens/ArchivedMemberScreen.tsx` (~128), `screens/HomeScreen.tsx` (~28), `screens/AddComboScreen.tsx` (~100, ~185), `screens/PieceHistoryScreen.tsx` (~34), `components/Swatch.tsx` (comment only)
- Modify (minimal, behavior unchanged): `screens/InventoryScreen.tsx`, `components/PieceCard.tsx` — swap `PIECES` / `Piece` for `useInventory().pieceTypes` / `PieceType` + that type's `pieces` (chips = that color's numbers), keeping today's look; Task 6 adds the assignment states
- Delete: `constants/inventoryData.ts` once nothing imports it (move `Piece`-type users to `PieceType`)

**Interfaces:**
- Consumes: `useInventory()`, `setMemberNumbers`, `numberFor`, `matchesNumber`, `memberPieceTypes`, `unknownNumbers` (Tasks 3–4).

- [ ] **Step 1: Member screens.** My Inventory and My Sizes list `uniformFor(pieceTypes, account?.numbers)` (plus the white shirt as today). Label text "Size" stays "Size" on member screens (members think of it as their size).
- [ ] **Step 2: Staff number editor** (`MemberProfileScreen`): one numeric field per non-retired numbered type in `pieceTypes` order (not a fixed four), saved with `setMemberNumbers`. If any of this member's numbers is in `unknownNumbers`, show an amber note under that field: "No {type} {number} in inventory." Errors use `friendlyError` (so a taken number shows the database message).
- [ ] **Step 3: Members tab number filter** (`SectionsScreen`): the piece picker lists numbered types from `pieceTypes`; matching uses `matchesNumber`.
- [ ] **Step 4: Archived member** shows `numbers` for every key in the snapshot (sorted by current type order, unknown keys last).
- [ ] **Step 5: Home, Add Combo, Piece History** read types/colors from `useInventory()` instead of `PIECES`. Piece History's edit sheet colors come from the type's `colors`.
- [ ] **Step 6: Verify** — `npx tsc --noEmit` → only the 13 baseline errors; `npm test` → PASS; `grep -rn "inventoryData\|uniformSizes\|setUniformSizes\|UNIFORM_PIECES" App.tsx context lib screens components constants` → no output.
- [ ] **Step 7: Commit** — `git commit -m "Read inventory and member numbers from the database everywhere"`

---

### Task 6: Staff Inventory — assignment states and filters

**Files:**
- Modify: `screens/InventoryScreen.tsx`, `components/PieceCard.tsx`

**Interfaces:**
- Consumes: `useInventory()`, `useAuth().accounts`, `ownerIndex`, `assignmentFor`, `pieceCount`, `unknownNumbers`, `chipState` (Plan 1).
- Produces: `PieceCard` gains prop `assignmentFor: (piece: InventoryPiece) => Assignment` (Task 5 already gave it `type: PieceType`, `pieces: InventoryPiece[]`, `chipStateFor(color, number)`, `onSizePress(color, number)`).

- [ ] **Step 1: Filters.** Keep the existing condition chips (All / Good / Needs repair / Dirty / Retired) under a small "Condition" label; add an "Assignment" row: All / Assigned / Unassigned / Out for repair. A numbered type card shows when any of its pieces matches both active filters; inside it, only matching chips render. Counted types show only under Assignment = All.
- [ ] **Step 2: Chips.** Assigned: solid `colors.ink` border on white. Unassigned: dashed `colors.inkFaint` border, transparent. Out for repair: `colors.amber` border on `colors.amberTint`. An open flag's tint (Plan 1, rust/wash) wins over all three for fill and text. Legend under the groups lists only the states present on that card.
- [ ] **Step 3: Counts.** Numbered card right side: `"{assigned} / {total} assigned"` (mono font, like today's qty); color group meta `"{assigned} of {n} assigned"`. Counted cards keep their quantity. Summary line adds `"· {n} unassigned"`.
- [ ] **Step 4: Typo warning.** If `unknownNumbers` is non-empty, an amber line above the cards: "{n} member numbers aren't in inventory" — tapping lists them in an `Alert` ("First Last — Coats 1530").
- [ ] **Step 5: Verify** — `npx tsc --noEmit` baseline only; `npm test` PASS. (The "See every {type}" link and `onSeeAll` prop are added in Task 7, not here.)
- [ ] **Step 6: Commit** — `git commit -m "Inventory shows assigned, unassigned and out-for-repair pieces"`

---

### Task 7: "Every [type]" table and out-for-repair toggle

**Files:**
- Create: `screens/PieceTableScreen.tsx`
- Modify: `navigation/types.ts`, `App.tsx`, `components/PieceCard.tsx` (add the "See every {type}" link + `onSeeAll` prop), `screens/InventoryScreen.tsx`, `screens/PieceHistoryScreen.tsx`

**Interfaces:**
- Consumes: `numberRows`, `assignmentFor`, `ownerIndex`, `chipState`, `useInventory().setOutForRepair`.
- Produces: route `PieceTable: { pieceTypeId: string }`.

- [ ] **Step 1: `PieceTableScreen`.** Header `"Every {type name}"` with back chevron. Tabs: All {n} / Assigned / Unassigned / Flagged (a row is Flagged if any of its cells has an open flag; Unassigned = no owner). Rows from `numberRows`: number (mono, bold), owner name or "Unassigned" (muted italic), one cell per color: empty square when the piece exists and is fine, rust "R" / wash "D" for open repair/dirty, amber "O" for out for repair, "–" when that color doesn't exist for the number. Tapping a cell with a piece → `PieceHistory { piece: type.name, color, size: number }`. Legend under the table. Use a `FlatList` (no ScrollView ref).
- [ ] **Step 2: Link it.** `PieceCard` "See every {type}" link (numbered types only) → `navigation.navigate('PieceTable', { pieceTypeId })`.
- [ ] **Step 3: Out-for-repair toggle** on `PieceHistoryScreen` (staff), shown only when the piece exists in `pieces`: a row under the header "Out for repair" with a `Switch`, calling `setOutForRepair`; errors → `Alert` with `friendlyError`; `requireOnline` first. Also show the current owner under the header: "With {First Last}" or "Unassigned".
- [ ] **Step 4: Verify** — `npx tsc --noEmit` baseline only; `npm test` PASS.
- [ ] **Step 5: Commit** — `git commit -m "Every-piece table and out-for-repair toggle"`

---

### Task 8: Docs and on-device check

**Files:**
- Modify: `../CLAUDE.md` (Data and backend: inventory tables, `profiles.numbers`, `set_member_numbers`, `InventoryContext`; remove the `set_uniform_sizes` / four-size-columns bullet; Archiving bullet: snapshot has `numbers`), `../features.md` only if it describes inventory or sizes.

- [ ] **Step 1: Update docs** as listed.
- [ ] **Step 2: Full checks** — `npm test`, `npx tsc --noEmit` (13 baseline only), `npm run test:rls`, `npx expo-doctor` (known pre-existing failures: patch-version warning, overridden SDK 57 `@expo/*` packages). Report exact output.
- [ ] **Step 3: On-device checklist** (user runs in Expo Go against the TEST project, after Plan 3 has imported some rows, since inventory starts empty; report as pending):
  1. Member: My Inventory and My Sizes show the same pieces and numbers as before.
  2. Staff: Members → a member → edit Coats number → save; giving a number another member has shows the "already belongs to" message.
  3. Staff: set a number not in inventory → amber note on the member and the warning line in Inventory.
  4. Staff Inventory: Assignment filter Unassigned shows only dashed chips; a flagged chip is still tinted.
  5. "See every Coats" → table rows, tabs, tap a cell → that piece's history.
  6. Toggle Out for repair on a piece → amber chip and "O" cell; toggle back.
  7. Archive a test member → their pieces become Unassigned; Archived member screen shows their numbers.
- [ ] **Step 4: Commit** — `git commit -m "Document inventory tables and member numbers"`
