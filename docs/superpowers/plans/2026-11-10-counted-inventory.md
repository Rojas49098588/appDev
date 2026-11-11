# Counted Inventory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Counted piece types get per-line season totals and wash-day counts, staff see what's missing and recount from the Inventory screen, and members say whether they keep their own white shirt so those shirts aren't counted as missing.

**Architecture:** Lines live in a new `piece_types.lines` JSON column (`[{label,total,count}]`), written only by staff-only database functions. Members' white shirt size and keep choice are two new `profiles` columns. All math (expected, missing, kept-at-home, batch entry) is pure TypeScript in `lib/countedStock.ts`, unit-tested with `node --test`; screens only render it.

**Tech Stack:** Expo / React Native (TypeScript), Supabase (Postgres + RLS), `node --test` unit tests, `supabase/tests/rls.test.ts` against the TEST project.

**Spec:** `docs/superpowers/specs/2026-11-10-counted-inventory-design.md`

## Global Constraints

- All schema changes go in `mobile-app/supabase/schema.sql` and must be safe to re-run (`add column if not exists`, `create or replace`, guarded migrations).
- Apply to TEST only: `npm run db:apply:test`. Never run `npm run db:apply` (LIVE); the user does that after merge.
- Only staff change counts, season totals and lines (enforced in the database). Members change only their own `white_shirt_size` and `keeps_white_shirt`.
- Pure logic in `mobile-app/lib/`, imported with `.ts` extensions, tested in `mobile-app/tests/*.test.ts`.
- Keep the old `piece_types.stock` column (older installed app builds still read it); the app stops using it.
- White shirt type is found by name `'White shirt'` (exact, case-insensitive match).
- "Not answered" (`keeps_white_shirt` null) counts as leaving the shirt in the bin.
- Only active (`archivedAt === null`) accounts with role `'Member'` count toward kept-at-home and "haven't answered"; "keep" with no valid size counts as not answered.
- Expected = max(0, total − kept); missing = max(0, expected − count). No "extra" display.
- Saves are blocked offline with the existing `OFFLINE_ALERT` / `requireOnline`.
- Existing tests stay green: `npm test`, and `npm run test:rls` on TEST.

## Review Focus

1. A batch like `−20` on a line with 12 → must be rejected, not stored as a negative count. (Task 1 test `applyBatch rejects results below 0`.)
2. A season total edited with a label differing only in case/spaces (`" m"` vs `"M"`) → updates the existing line, never creates a duplicate. (Task 2 rls test `set_season_totals matches labels case-insensitively`.)
3. More members keep a size than the season total (kept 12, total 10) → expected 0 and missing 0, never negative. (Task 1 test `expected never goes below 0`.)
4. A member picked a size that isn't one of the White shirt lines (or the type doesn't exist) → counted as not answered, not as kept, and the app doesn't crash. (Task 1 test `keep with unknown size counts as not answered`; Task 7 renders the "choose your size" prompt.)
5. Cached inventory from the previous app version has no `lines` → the cache is rejected and refetched instead of crashing a card. (Task 3 test `isPieceTypeList rejects a type without lines`.)

---

### Task 1: Counted-stock logic (`lib/countedStock.ts`)

**Files:**
- Create: `mobile-app/lib/countedStock.ts`
- Test: `mobile-app/tests/countedStock.test.ts`

**Interfaces:**
- Consumes: `Account` from `lib/models.ts` (Task 3 adds `whiteShirtSize: string` and `keepsWhiteShirt: boolean | null`; until then the test builds plain objects matching `ShirtOwner`).
- Produces:
  - `export type CountLine = { label: string; total: number; count: number }`
  - `export type ShirtOwner = { role: 'Member' | 'Staff'; archivedAt: string | null; whiteShirtSize: string; keepsWhiteShirt: boolean | null }`
  - `export const WHITE_SHIRT = 'White shirt'`
  - `export function isWhiteShirt(name: string): boolean`
  - `export function keptAtHome(owners: ShirtOwner[], labels: string[]): { kept: Record<string, number>; unanswered: number }`
  - `export type LineStatus = CountLine & { kept: number; expected: number; missing: number }`
  - `export function lineStatuses(lines: CountLine[], kept?: Record<string, number>): LineStatus[]`
  - `export function cardSummary(statuses: LineStatus[]): { count: number; expected: number; missing: number }`
  - `export function applyBatch(current: number, text: string): number | null` (text like `+12`, `-3`, `−3` (Unicode minus), `12` (treated as +12); null when unreadable or result < 0)

- [ ] **Step 1: Write the failing tests** in `tests/countedStock.test.ts`:

```ts
const owner = (o: Partial<ShirtOwner>): ShirtOwner =>
  ({ role: 'Member', archivedAt: null, whiteShirtSize: 'M', keepsWhiteShirt: true, ...o });

test('keptAtHome counts active members who keep, by size', () => {
  const r = keptAtHome([owner({}), owner({ whiteShirtSize: 'L' }), owner({ keepsWhiteShirt: false }),
    owner({ keepsWhiteShirt: null })], ['S', 'M', 'L']);
  assert.deepEqual(r, { kept: { S: 0, M: 1, L: 1 }, unanswered: 1 });
});
test('archived members and staff are ignored', () => {
  assert.deepEqual(keptAtHome([owner({ archivedAt: '2026-01-01' }), owner({ role: 'Staff' })], ['M']),
    { kept: { M: 0 }, unanswered: 0 });
});
test('keep with unknown size counts as not answered', () => {
  assert.deepEqual(keptAtHome([owner({ whiteShirtSize: '' }), owner({ whiteShirtSize: 'XXL' })], ['M']),
    { kept: { M: 0 }, unanswered: 2 });
});
test('size labels match case-insensitively', () => {
  assert.deepEqual(keptAtHome([owner({ whiteShirtSize: 'm' })], ['M']).kept, { M: 1 });
});
test('lineStatuses: expected = total - kept, missing = expected - count', () => {
  assert.deepEqual(lineStatuses([{ label: 'M', total: 100, count: 76 }], { M: 20 }),
    [{ label: 'M', total: 100, count: 76, kept: 20, expected: 80, missing: 4 }]);
});
test('expected never goes below 0 and missing never negative', () => {
  const [s] = lineStatuses([{ label: 'XL', total: 10, count: 3 }], { XL: 12 });
  assert.equal(s.expected, 0); assert.equal(s.missing, 0);
  assert.equal(lineStatuses([{ label: 'S', total: 100, count: 104 }])[0].missing, 0);
});
test('cardSummary sums lines', () => {
  const st = lineStatuses([{ label: 'S', total: 100, count: 100 }, { label: 'M', total: 100, count: 91 },
    { label: 'L', total: 100, count: 95 }, { label: 'XL', total: 10, count: 10 }]);
  assert.deepEqual(cardSummary(st), { count: 296, expected: 310, missing: 14 });
});
test('applyBatch adds and removes', () => {
  assert.equal(applyBatch(80, '+12'), 92); assert.equal(applyBatch(80, '12'), 92);
  assert.equal(applyBatch(80, '-3'), 77); assert.equal(applyBatch(80, '−3'), 77);
  assert.equal(applyBatch(80, ' + 5 '), 85);
});
test('applyBatch rejects results below 0 and unreadable text', () => {
  assert.equal(applyBatch(12, '-20'), null); assert.equal(applyBatch(5, 'x'), null);
  assert.equal(applyBatch(5, ''), null); assert.equal(applyBatch(5, '+1.5'), null);
});
test('isWhiteShirt ignores case and spaces', () => {
  assert.equal(isWhiteShirt(' white SHIRT '), true); assert.equal(isWhiteShirt('Ties'), false);
});
```

- [ ] **Step 2: Run** `node --test tests/countedStock.test.ts` (from `mobile-app/`). Expected: FAIL, cannot find module `../lib/countedStock.ts`.
- [ ] **Step 3: Implement** the Produces list in `lib/countedStock.ts`. Labels compare with `trim().toLowerCase()`; `kept` keys use the line labels as given. `lineStatuses` with no `kept` uses 0 for every line.
- [ ] **Step 4: Run** `node --test tests/countedStock.test.ts`. Expected: all pass. Then `npm test`: no failures.
- [ ] **Step 5: Commit** `git add lib/countedStock.ts tests/countedStock.test.ts && git commit -m "Counted stock: expected, missing, kept-at-home and batch math"`

---

### Task 2: Database: lines, recount, season totals, member shirt fields

**Files:**
- Modify: `mobile-app/supabase/schema.sql` (piece_types table ~L224, profiles ~L31, `create_piece_type` ~L1111, new functions after `add_piece_number` ~L1258)
- Test: `mobile-app/supabase/tests/rls.test.ts` (inside `describe('import and add inventory')` near L1311; member cases in `describe('member permissions')`)

**Interfaces:**
- Produces (Postgres):
  - `piece_types.lines jsonb not null default '[]'` — array of `{"label": text, "total": int, "count": int}`
  - `piece_types.counted_at timestamptz` (null until first recount), `piece_types.counted_by_name text not null default ''`
  - `profiles.white_shirt_size text not null default ''`, `profiles.keeps_white_shirt boolean` (nullable)
  - `create_piece_type(...)` unchanged signature; for `counted`, also sets `lines` from `p_colors` in order with `total = count = p_stock[color]` (0 when absent).
  - `recount_piece_type(p_type uuid, p_counts jsonb) returns void` — staff only (42501 otherwise); `p_counts` is `{label: int>=0}` and must contain exactly the type's labels (case-insensitive, trimmed) else 22023; sets each `count`, `counted_at = now()`, `counted_by_name` = caller's `first_name || ' ' || last_name`.
  - `set_season_totals(p_type uuid, p_totals jsonb) returns void` — staff only; `{label: int>=0}`; existing labels (case-insensitive, trimmed) get the new `total`; unknown labels are appended as new lines with `count = total`; duplicate labels within `p_totals` → 22023; keeps `colors` = labels in line order.
  - Migration: for `kind = 'counted'` rows whose `lines = '[]'` and `stock <> '{}'`, build lines from `colors` order using `stock` (total = count). Re-running changes nothing.
  - Both functions `security definer`, `set search_path = public`, `revoke all ... from public, anon`, `grant execute ... to authenticated`, raising only when the type is `counted`-kind (22023 for numbered).

- [ ] **Step 1: Write the failing rls tests:**
  - `create_piece_type counted builds lines` — create counted `{Black:300, Red:300}` → `typeRow(name).lines` deepEquals `[{label:'Black',total:300,count:300},{label:'Red',total:300,count:300}]`.
  - `recount_piece_type sets counts and who counted` — as staff `{Black:300, Red:287}` → lines counts 300/287, `counted_at` not null, `counted_by_name` non-empty. Missing label `{Black:1}` → `error.code === '22023'`. Negative `{Black:-1, Red:0}` → 22023. As member → 42501 and counts unchanged.
  - `set_season_totals updates and appends` — `{Red:320, Gold:50}` → Red total 320 (count unchanged), new line `{label:'Gold',total:50,count:50}` last, `colors` = `['Black','Red','Gold']`.
  - `set_season_totals matches labels case-insensitively` — `{' red ': 310}` → still 3 lines, Red total 310.
  - `members can set their own white shirt fields only` — member updates own `white_shirt_size:'M', keeps_white_shirt:true` → ok; member updating another profile's fields → no row changed.
- [ ] **Step 2: Run** `npm run test:rls` (TEST). Expected: the new tests FAIL (function/column does not exist); existing tests pass.
- [ ] **Step 3: Implement** the Produces list in `schema.sql`.
- [ ] **Step 4: Apply and check:** `npm run db:apply:test` then `npm run db:check:test` (expect no errors), then `npm run db:apply:test` again (re-run safe). Run `npm run test:rls`. Expected: all pass.
- [ ] **Step 5: Commit** `git add supabase/schema.sql supabase/tests/rls.test.ts && git commit -m "DB: counted lines with season totals, recount and member white shirt fields"`

---

### Task 3: App data layer

**Files:**
- Modify: `mobile-app/lib/models.ts` (`PieceType`, `Account`), `lib/rows.ts` (`PieceTypeRow`, `ProfileRow`), `lib/mappers.ts` (`rowToPieceType`, `profileToAccount`, `AccountUpdates`/`ProfileUpdate`/`accountUpdatesToProfile`), `lib/validators.ts` (`isPieceType`, `isAccount`), `lib/inventory.ts:104` (`pieceCount`), `context/InventoryContext.tsx`
- Test: `mobile-app/tests/mappers.test.ts`, `tests/inventory.test.ts`, `tests/cache.test.ts` (validators)

**Interfaces:**
- Consumes: Task 1 `CountLine`; Task 2 columns/functions.
- Produces:
  - `PieceType` gains `lines: CountLine[]; countedAt: string | null; countedByName: string` (keep `stock` field out of the model — remove it and its uses).
  - `Account` gains `whiteShirtSize: string; keepsWhiteShirt: boolean | null`; `AccountUpdates` therefore accepts both; `accountUpdatesToProfile` maps them to `white_shirt_size` / `keeps_white_shirt`.
  - `pieceCount(type, pieces)` for counted = sum of `lines[].count`.
  - `InventoryContextValue` gains `recountPieceType(typeId: string, counts: Record<string, number>): Promise<void>` and `setSeasonTotals(typeId: string, totals: Record<string, number>): Promise<void>` (call the Task 2 RPCs, then `reload()`, like `addPieceColor`). `createPieceType` input keeps `stock` (season totals) unchanged.

- [ ] **Step 1: Write failing tests:** `rowToPieceType` maps `lines`, `counted_at`, `counted_by_name`; `profileToAccount` maps `white_shirt_size`/`keeps_white_shirt` (null stays null); `accountUpdatesToProfile({ keepsWhiteShirt: false, whiteShirtSize: 'L' })` deepEquals `{ keeps_white_shirt: false, white_shirt_size: 'L' }`; `pieceCount` of a counted type with lines counts 300 and 287 → 587; **`isPieceTypeList rejects a type without lines`** (an object shaped like the old cached type with `stock` and no `lines` → false); `isAccount` rejects an account missing `keepsWhiteShirt`.
- [ ] **Step 2: Run** `npm test`. Expected: the new cases FAIL.
- [ ] **Step 3: Implement** the Produces list. Update every compile error the model change causes (`npx tsc --noEmit`), except UI that Tasks 4–7 replace — there, keep it compiling with the smallest change.
- [ ] **Step 4: Run** `npm test` (all pass) and `npx tsc --noEmit` (no errors beyond the 14 already on master).
- [ ] **Step 5: Commit** `git commit -am "Data layer: piece type lines and member white shirt fields"`

---

### Task 4: Staff Inventory card for counted types (layout A)

**Files:**
- Modify: `mobile-app/components/PieceCard.tsx` (counted branch: `rows` ~L56, header qty ~L70, opened body), `mobile-app/screens/InventoryScreen.tsx` (pass kept data + navigate to Recount)

**Interfaces:**
- Consumes: Task 1 `lineStatuses`, `cardSummary`, `keptAtHome`, `isWhiteShirt`; Task 3 `PieceType.lines/countedAt/countedByName`, `useAuth().accounts` (staff already load all accounts).
- Produces: `PieceCard` new optional props `kept?: Record<string, number>`, `unanswered?: number`, `onRecount?: () => void`. InventoryScreen computes `keptAtHome(accounts, labels)` only for the white shirt type and passes it.

Card content (exact copy from the spec):
- Closed: name; subtitle = line labels joined `', '`; right side `{count} / {expected}`; tag `{missing} missing` (amber, `colors.amber` on `colors.amberTint`) when missing > 0, else `all in` (`colors.wash` on `colors.washTint`).
- Opened: one row per line `{label}   {count} / {expected}` plus ` · {missing} missing` when short (amber); white shirt adds a row `{kept} kept at home` per line with kept > 0, and a line `{unanswered} members haven't answered` when > 0 (`1 member hasn't answered` for 1).
- Footer: `Last counted {formatShortDate(countedAt)}` (from `lib/format.ts`) (or `Not counted yet`) and a `Recount` button calling `onRecount`.
- Numbered cards unchanged.

- [ ] **Step 1:** Implement. (UI; logic is already covered by Task 1 tests.)
- [ ] **Step 2: Verify** `npx tsc --noEmit` (no new errors), `npm test` (pass). Run `npm run start:test`, sign in as `teststaff@mail.com`, open Inventory: a counted type shows the closed/opened content above.
- [ ] **Step 3: Commit** `git commit -am "Inventory: counted cards show missing against season totals"`

---

### Task 5: Recount and season-totals screen

**Files:**
- Create: `mobile-app/screens/RecountScreen.tsx`
- Modify: `mobile-app/navigation/types.ts` (add `Recount: { pieceTypeId: string; mode: 'count' | 'totals' }` to the stack param list next to `AddPieceType`), `mobile-app/App.tsx` (register the screen like `AddPieceType`), `screens/InventoryScreen.tsx` (`onRecount` → `navigate('Recount', { pieceTypeId, mode: 'count' })`)

**Interfaces:**
- Consumes: Task 1 `applyBatch`, `lineStatuses`, `cardSummary`, `keptAtHome`; Task 3 `recountPieceType`, `setSeasonTotals`; `OFFLINE_ALERT` via `requireOnline`; `friendlyError`.

Behavior (option 2 from the spec):
- Title `Recount {name}` (mode count) or `Season totals: {name}` (mode totals). Hint: `Enter how many are in the bins now. Last counted {date}.`
- One row per line, box pre-filled with the current count (or total in totals mode), with `−` and `+` buttons (±1, never below 0) and a batch button that opens a small input; its value goes through `applyBatch`, and `null` shows `Alert.alert("Can't add that", 'Type a whole number like +12 or −3.')`.
- In count mode each row shows `of {expected}` or `{missing} missing` (amber), live; bottom line `{count} of {expected} · {missing} missing` from `cardSummary`.
- `Save count` / `Save totals` calls `recountPieceType` / `setSeasonTotals` with every line, then `navigation.goBack()`. Errors: `Alert.alert("Couldn't save", friendlyError(e))`. Double-tap guarded like `AddPieceTypeScreen` (`savingRef`).
- Count mode has a `Change season totals` link → `navigation.replace('Recount', { pieceTypeId, mode: 'totals' })`. Totals mode has `+ Add size or color` (label text input; duplicate label (case-insensitive) → `Alert.alert('Already added', ...)`).

- [ ] **Step 1:** Implement.
- [ ] **Step 2: Verify** `npx tsc --noEmit`, `npm test`. On TEST: Recount a counted type with `+12`, `−3`, −/+; Save; the card updates. Batch `−999` shows the alert. Offline Save shows `You're offline`. Change season totals adds a line; card shows it.
- [ ] **Step 3: Commit** `git add screens/RecountScreen.tsx && git commit -am "Recount screen with batch entry and season totals"`

---

### Task 6: New piece type wording for counted types

**Files:**
- Modify: `mobile-app/screens/AddPieceTypeScreen.tsx` (counted section ~L270–290 and the Colors label when kind is counted)

- [ ] **Step 1:** When kind is `counted`: the Colors field label reads `Sizes or colors`, placeholder `+ size or color`, the per-line quantity label reads `Season total`. Numbered wording unchanged. No logic change: `create_piece_type` (Task 2) turns colors + stock into lines.
- [ ] **Step 2: Verify** `npx tsc --noEmit`, `npm test` (incl. `tests/pieceTypeForm.test.ts` if present on this branch). On TEST: create counted `White shirt` with S 100, M 100, L 100, XL 10 → card shows `310 / 310`, `all in`.
- [ ] **Step 3: Commit** `git commit -am "New piece type: counted types take sizes or colors with season totals"`

---

### Task 7: Member white shirt size and keep choice

**Files:**
- Modify: `mobile-app/screens/member/MyInventoryScreen.tsx` (white shirt group ~L67–80), `mobile-app/screens/member/MySizesScreen.tsx:24`, `mobile-app/constants/myUniformData.ts:38` (`MY_WHITE_SHIRT` keeps `piece` and `color`; remove `size`)
- Test: `mobile-app/tests/countedStock.test.ts` (add `whiteShirtSizes`)

**Interfaces:**
- Consumes: Task 3 `Account.whiteShirtSize/keepsWhiteShirt`, `updateAccount`; `useInventory().pieceTypes`; Task 1 `isWhiteShirt`.
- Produces: `export function whiteShirtSizes(types: PieceType[]): string[]` in `lib/countedStock.ts` — labels of the White shirt type's lines, `[]` when there's none.

- [ ] **Step 1: Write failing test** `whiteShirtSizes returns the White shirt lines, or [] without one`.
- [ ] **Step 2: Run** `node --test tests/countedStock.test.ts` → FAIL; implement; → PASS.
- [ ] **Step 3: Implement UI.** On the white shirt row in My Inventory: a size picker (chips of `whiteShirtSizes`) and two choices `I keep and wash my own` / `I leave mine in the bin`, saved with `updateAccount({ whiteShirtSize })` / `updateAccount({ keepsWhiteShirt })`, guarded by `requireOnline`. No sizes available → text `Your white shirt sizes aren't set up yet.`; no size chosen → `Choose your size`. The flag row and My Sizes use `account.whiteShirtSize` (`—` when empty) instead of the placeholder `M`.
- [ ] **Step 4: Verify** `npx tsc --noEmit`, `npm test`. On TEST as `test-jane-doe@mustangcloset.test` / `mustangtest2026`: pick M and "keep"; as staff, the White shirt card shows `1 kept at home` on M and expected drops by 1.
- [ ] **Step 5: Commit** `git commit -am "My Inventory: white shirt size and keep-at-home choice"`

---

### Task 8: Final verification and docs

- [ ] **Step 1:** `npm test` — all pass; `npx tsc --noEmit` — no errors beyond master's 14; `npm run test:rls` — all pass on TEST.
- [ ] **Step 2:** Update `HANDOFF.md` with a short "Counted inventory" section (what it does, that `db:apply` on LIVE is needed after merge, and that staff should create the `White shirt` counted type with its sizes) and the counted-inventory line in `CLAUDE.md`'s data notes.
- [ ] **Step 3: Commit** `git commit -am "Docs: counted inventory handoff"`
