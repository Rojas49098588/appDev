# Spreadsheet Import and Adding Inventory Implementation Plan (Plan 3 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Staff load the real inventory and member numbers from the Box spreadsheet (CSV) with a preview before anything is saved, and later add new piece types, colors, and single numbers in the app.

**Architecture:** The CSV is parsed and matched on the phone by pure, unit-tested functions in `lib/import/` (parse → classify rows → match names → build a preview with problems and conflicts). Staff resolve conflicts in the preview, then the app sends one payload to a staff-only `import_inventory(payload jsonb)` function that applies everything in a single transaction (all or nothing) and returns a summary. Adding a type / color / number uses three small staff-only functions. A trigger keeps `pieces` consistent with their type (numbered only, color in the type's colors), and numbers are normalized (no leading zeros) everywhere they are written. `InventoryContext` batches realtime piece events so a 1,000-row import doesn't rewrite the cache 1,000 times.

**Tech Stack:** Expo SDK 58 / React Native 0.88, TypeScript, Supabase, `expo-document-picker` (new, installed with `npx expo install`), `expo-file-system` (existing), Node built-in test runner.

**Spec:** `docs/superpowers/specs/2026-10-23-flag-photos-and-piece-inventory-design.md` — goals 7–10, "The spreadsheet (Box) and the import", and the user decisions recorded there (Addison Sew row format, Repairs notes on every coat color, merge never mirror). Builds on Plans 1–2 (already on `master`).

## Global Constraints

- Work on a new branch `inventory-import` from `master`. Never commit to `master`.
- **Database: TEST project only** (`npm run db:apply:test`, `npm run test:rls`). Never run `npm run db:apply` (live).
- New dependency allowed: `expo-document-picker` only, installed with `npx expo install expo-document-picker`; read `https://docs.expo.dev/versions/v58.0.0/sdk/document-picker/` first. No CSV library — the parser is ours. Never `npm audit fix --force`.
- `npm test` passes every task; `npx tsc --noEmit` adds no errors beyond the 13 pre-existing ScrollView-ref errors.
- CSV columns (header row, matched case-insensitively, extra spaces ignored): `NAME`, `Section`, `M/F`, `Coat #`, `BIBBER #`, `VESTS`, `Repairs`. Column → piece type: `Coat #` → `Coats`, `BIBBER #` → `Bibbers`, `VESTS` → `Vests`. `Section` and `M/F` are not imported.
- Default colors when the import creates a type: `Coats` = Blue, Red, Purple, Candy; `Vests` = Candy, Red; `Bibbers` = Blue, White. Type names must be exactly `Coats`, `Vests`, `Bibbers` (migrated numbers and old flags match on them).
- Row kinds: **member** (NAME is a person, `Last First`); **Addison Sew** (Section = `Addison Sew`, case-insensitive; the number is under exactly one piece column and the color is in `Repairs`) → that one piece is out for repair; **Unassigned** (NAME = `Unassigned`) → pieces the band owns that nobody has; blank rows are ignored.
- Every number listed creates a piece in **every color** of its type.
- Repairs text on a member row → one open repair history entry on **every color** of that member's coat number, `source = 'import'`, no member attached (`member_id` null) so only staff see it, `member_name` = the matched member's name. A note already imported for that member name + piece type is left alone on re-runs, even if the text changed.
- The import is a merge: it never deletes pieces and never clears numbers. When the sheet's number differs from the member's current number, staff pick "use sheet" or "keep app" per row. Unmatched names, ambiguous names, unreadable rows, and numbers that would give two active members the same type+number are listed and skipped.
- Numbers are digits; leading zeros are stripped (`'085'` → `'85'`, `'0'` stays `'0'`) wherever numbers are written: import, `set_member_numbers`, add-type, add-number.
- Only staff can import or add inventory.
- All commands run from `mobile-app/`.

## Review Focus

1. **A messy real export** (Excel/Sheets CSV with quoted fields containing commas, a UTF-8 BOM, CRLF line endings, trailing empty columns, blank rows, extra spaces) → parses correctly. (Task 1 tests `parseCsv handles quotes, BOM, CRLF and blank lines`, `findColumns tolerates case and spacing`.)
2. **The import fails halfway** (network drop, a duplicate number slipping past the preview, a DB error) → nothing is saved, staff see the error, and they can re-run. (Task 3 RLS test `import_inventory is all-or-nothing`.)
3. **Running the same import twice** → no duplicate pieces, numbers, or notes; the second preview shows nothing new to do. (Task 3 RLS test `re-running the same payload changes nothing`; Task 2 test `preview of an already-applied sheet has no changes`.)
4. **Names that don't match an account** (not signed up, spelling, two people with the same name, an archived member) → listed with the reason, skipped, never assigned to the wrong person. (Task 2 tests `matchName: exact, reversed order, ambiguous, archived, missing`.)
5. **Bulk import while other phones are open** → those phones stay responsive and end with the full inventory. (Task 4 test `batchByWindow coalesces bursts`; device check in Task 8.)

---

### Task 1: CSV parsing and row classification

**Files:**
- Create: `lib/import/csv.ts`, `lib/import/rows.ts`
- Test: `tests/importCsv.test.ts`
- Create: `tests/fixtures/sample-roster.csv` (fake names, ~12 rows covering every row kind, a quoted Repairs note with a comma, a blank row, an Addison Sew row, an Unassigned row, a typo number `18a`)

**Interfaces:**
- Produces:
  - `parseCsv(text: string): string[][]` — RFC 4180-style: quoted fields, `""` escapes, commas/newlines inside quotes, strips a leading BOM, accepts `\n` and `\r\n`, drops fully empty lines.
  - `type ColumnMap = { name: number; section: number; coats: number; bibbers: number; vests: number; repairs: number }` and `findColumns(header: string[]): ColumnMap | { missing: string[] }` — match header cells case-insensitively after trimming and collapsing spaces (`'Coat #'`, `'coat#'`, `' COAT  # '` all match).
  - `normalizeNumber(raw: string): string | null` — trim; `null` if empty; `null` if not all digits; strip leading zeros (`'0085'` → `'85'`, `'0'` → `'0'`). Also export it from `lib/uniform.ts`'s neighbor so screens can reuse it (re-export from `lib/import/rows.ts` is fine).
  - `type SheetRow = { line: number } & ({ kind: 'member'; name: string; numbers: Partial<Record<'Coats'|'Bibbers'|'Vests', string>>; repairs: string } | { kind: 'repair_shop'; pieceType: 'Coats'|'Bibbers'|'Vests'; number: string; color: string } | { kind: 'unassigned'; numbers: Partial<Record<'Coats'|'Bibbers'|'Vests', string>> } | { kind: 'invalid'; reason: string; raw: string[] })`
  - `classifyRows(cells: string[][], cols: ColumnMap): SheetRow[]` — `line` is the 1-based sheet line. Invalid reasons (exact text): `"Coat # \"18a\" isn't a number"` (per column label), `"Addison Sew row needs exactly one piece number"`, `"Addison Sew row needs a color in Repairs"`, `"No name"`.

- [ ] **Step 1: Write failing tests**

```ts
test('parseCsv handles quotes, BOM, CRLF and blank lines', () => {
  assert.deepEqual(parseCsv('﻿a,b\r\n"x, y","say ""hi"""\r\n\r\n1,2\n'), [['a','b'],['x, y','say "hi"'],['1','2']]);
});
test('findColumns tolerates case and spacing, reports missing', ...); // ' coat  # ' ok; missing VESTS -> { missing: ['VESTS'] }
test('normalizeNumber', ...);                                          // ' 085 '->'85', '0'->'0', ''->null, '18a'->null
test('classifyRows: member, Addison Sew, Unassigned, invalid, blank', ...); // uses tests/fixtures/sample-roster.csv
```

- [ ] **Step 2: Run, verify FAIL** — `npm test`.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — `npm test` → PASS.
- [ ] **Step 5: Commit** — `git commit -m "Parse and classify spreadsheet rows"`

---

### Task 2: Name matching and the import preview

**Files:**
- Create: `lib/import/preview.ts`
- Test: `tests/importPreview.test.ts`

**Interfaces:**
- Consumes: `SheetRow`, `normalizeNumber` (Task 1); `Account`, `PieceType`, `InventoryPiece` (models); `ownerIndex` (lib/inventory.ts).
- Produces:
  - `DEFAULT_COLORS: Record<'Coats'|'Bibbers'|'Vests', string[]>` (values from Global Constraints).
  - `matchName(name: string, accounts: Account[]): { status: 'matched'; account: Account } | { status: 'none' } | { status: 'ambiguous'; candidates: Account[] } | { status: 'archived'; account: Account }` — compare lowercased, trimmed, inner spaces collapsed; try `"{last} {first}"` then `"{first} {last}"`; any role matches (staff can hold numbers); archived accounts are only reported as `archived`, never matched.
  - `type ImportPlan = { typesToCreate: { name: string; colors: string[] }[]; piecesToAdd: { pieceType: string; number: string }[]; outForRepair: { pieceType: string; color: string; number: string }[]; numbers: NumberChange[]; notes: { memberName: string; pieceType: 'Coats'; number: string; text: string }[]; problems: { line: number; message: string }[] }`
  - `type NumberChange = { line: number; memberId: string; memberName: string; pieceType: string; sheet: string; current: string | null; choice: 'sheet' | 'app' }` — `choice` defaults to `'sheet'` when `current` is null or equal; when they differ it starts as `'sheet'` and the UI lets staff flip it. Equal values are omitted entirely (nothing to do).
  - `buildPreview(rows: SheetRow[], accounts: Account[], types: PieceType[], pieces: InventoryPiece[], existingImportNotes: { memberName: string; pieceType: string }[]): ImportPlan`
    - Types: a column type with no `piece_types` row → `typesToCreate` with `DEFAULT_COLORS`.
    - Pieces: every number from member, Unassigned and Addison Sew rows; skip ones already in `pieces`; de-duplicate.
    - Numbers: member rows only, matched accounts only; problems for none/ambiguous/archived (messages: `Line {n}: no app account for "{name}"`, `Line {n}: "{name}" matches more than one account`, `Line {n}: "{name}" is archived`).
    - Clashes: if a sheet number for a type would belong to two different matched members (two rows in the sheet, or the sheet vs another active account's current number), add a problem `Line {n}: {type} {number} is also {other name}'s` and skip that change.
    - Notes: non-empty Repairs on matched member rows with a Coat number, unless `existingImportNotes` already has that member name + `Coats`.
    - Out for repair: Addison Sew rows; color must be in the type's colors (existing type) or `DEFAULT_COLORS` (new type), else problem `Line {n}: {color} isn't a {type} color`.
  - `toPayload(plan: ImportPlan): ImportPayload` — drops `numbers` whose `choice` is `'app'`; shape matches Task 3.

- [ ] **Step 1: Write failing tests**

```ts
test('matchName: exact, reversed order, ambiguous, archived, missing', ...);
test('buildPreview creates missing types with default colors', ...);
test('buildPreview adds every listed number once, skipping existing pieces', ...);
test('buildPreview reports unmatched, ambiguous and archived names', ...);
test('buildPreview flags a number that would belong to two members', ...);
test('buildPreview: differing number defaults to sheet, equal number omitted', ...);
test('buildPreview skips notes already imported for that member', ...);
test('buildPreview rejects an Addison Sew color not in the type', ...);
test('preview of an already-applied sheet has no changes', ...);   // pieces/numbers/notes all present -> every list empty except problems
test('toPayload drops keep-app choices', ...);
```

- [ ] **Step 2: Run, verify FAIL** — `npm test`.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — `npm test` → PASS.
- [ ] **Step 5: Commit** — `git commit -m "Match names and build the import preview"`

---

### Task 3: Database functions for import and adding inventory

**Files:**
- Modify: `supabase/schema.sql`, `supabase/tests/rls.test.ts`

**Interfaces:**
- Produces (SQL; all `security definer`, `set search_path = public`, staff only → `42501`, `revoke all … from public, anon; grant execute … to authenticated`):
  - `normalize_number(t text) returns text` — immutable helper: trimmed digits with leading zeros stripped (`'0'` stays). Used by every writer below and by `set_member_numbers` (update it to normalize values before checking).
  - Trigger `pieces_check_type` (before insert/update on `pieces`): the type must be `numbered` and `new.color = any(colors)`, else `22023` `'{color} is not a {type} color'` / `'{type} is not a numbered type'`.
  - `import_inventory(payload jsonb) returns jsonb` — payload: `{ "typesToCreate": [{name, colors[]}], "piecesToAdd": [{pieceType, number}], "outForRepair": [{pieceType, color, number}], "numbers": [{memberId, pieceType, number}], "notes": [{memberName, pieceType, number, text}] }`. In one transaction: create missing types (`kind 'numbered'`, given colors, `sort_order` after existing); insert each piece × every color of its type (`on conflict do nothing`); set `out_for_repair = true` for listed pieces (creating them if missing); merge numbers into each member's `numbers` with the same uniqueness rule as `set_member_numbers` (refuse archived targets and clashes → raise, which rolls back everything); insert notes as open `repair` flags with `source 'import'`, `member_id null`, `member_name`, `piece`, `color` (each color of the type), `size` = number, `comment` = text — skipping any where an import flag with the same `member_name` + `piece` already exists. Returns `{ typesCreated, piecesAdded, markedOutForRepair, numbersSet, notesAdded }` counts. The flags insert trigger must allow these fields (it currently forces `source 'member'` for signed-in users): set a transaction-local `app.allow_import_flags` and honor it in the trigger.
  - `create_piece_type(p_name text, p_kind text, p_colors text[], p_numbers text[], p_stock jsonb) returns uuid` — name trimmed, unique (`23505` `'a piece type named {name} already exists'`); numbered: creates every number × color; counted: stores `p_stock` (non-negative integers per color, keys must be in `p_colors`).
  - `add_piece_color(p_type uuid, p_color text) returns int` — appends the color (refuse duplicate, case-insensitive), creates that color for every existing number of the type; returns pieces created.
  - `add_piece_number(p_type uuid, p_number text, p_colors text[]) returns int` — creates the number in the given colors (must be a subset of the type's colors); returns pieces created.

- [ ] **Step 1: Write failing RLS tests** (`describe('import and add inventory')`; every type created is named with `RUN` and deleted in `after`; members created with the existing helpers)

```ts
test('members cannot call import_inventory, create_piece_type, add_piece_color, add_piece_number', ...); // 42501 each
test('import_inventory creates types, pieces in every color, numbers, out-for-repair and notes', ...);
test('imported notes are hidden from the member and visible to staff', ...);   // member select sees none; staff sees member_name
test('re-running the same payload changes nothing', ...);                   // second call returns all-zero counts
test('import_inventory is all-or-nothing', ...);                            // payload with a clashing number -> error; no types/pieces/numbers/notes written
test('numbers are normalized: 085 stored as 85, and 085 clashes with 85', ...);
test('pieces must use a color of a numbered type', ...);                    // admin insert with bad color -> 22023
test('create_piece_type numbered and counted; duplicate name refused', ...);
test('add_piece_color fills every existing number', ...);
test('add_piece_number refuses colors not in the type', ...);
```

- [ ] **Step 2: Run, verify FAIL** — `npm run test:rls`.
- [ ] **Step 3: Implement** in `schema.sql` (re-runnable; `create or replace`, `drop trigger if exists`).
- [ ] **Step 4: Apply and run** — `npm run db:apply:test && npm run db:apply:test && npm run test:rls` → pass.
- [ ] **Step 5: Commit** — `git commit -m "Add import_inventory and add-inventory functions"`

---

### Task 4: Context actions and realtime batching

**Files:**
- Modify: `context/InventoryContext.tsx`, `lib/inventory.ts`, `tests/inventory.test.ts`, `lib/errors.ts`, `tests/errors.test.ts`

**Interfaces:**
- Consumes: Task 3 functions; `ImportPayload` (Task 2).
- Produces:
  - `useInventory()` gains: `importInventory(payload: ImportPayload): Promise<ImportSummary>`; `createPieceType(input: { name: string; kind: PieceKind; colors: string[]; numbers: string[]; stock: Record<string, number> }): Promise<string>`; `addPieceColor(typeId: string, color: string): Promise<number>`; `addPieceNumber(typeId: string, number: string, colors: string[]): Promise<number>`. Each calls its RPC, then `reload()` once.
  - `type ImportSummary = { typesCreated: number; piecesAdded: number; markedOutForRepair: number; numbersSet: number; notesAdded: number }` (in `lib/models.ts`).
  - `batchByWindow<T>(windowMs: number, flush: (items: T[]) => void): { push(item: T): void; cancel(): void }` in `lib/inventory.ts` — collects pushes and calls `flush` once per window. Realtime piece events go through it (window 300 ms) and are applied to the cache in one `commit`.
  - `friendlyError` passes through `22023` messages that end in `color` / `numbered type` / `archived`, and `23505` `a piece type named … already exists`.
  - Also export a fetch of existing import notes for the preview: `loadImportNotes(): Promise<{ memberName: string; pieceType: string }[]>` (staff select on `flags` where `source = 'import'`, columns `member_name, piece`).

- [ ] **Step 1: Failing tests** — `batchByWindow coalesces bursts` (fake timers via `node:test` mock timers: 5 pushes within the window → one flush with 5 items; a push after the window → second flush), plus the `friendlyError` pass-through tests.
- [ ] **Step 2: Run, verify FAIL** — `npm test`.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Verify** — `npm test` PASS; `npx tsc --noEmit` baseline only.
- [ ] **Step 5: Commit** — `git commit -m "Inventory actions and batched realtime updates"`

---

### Task 5: Import screen

**Files:**
- Create: `screens/ImportInventoryScreen.tsx`
- Modify: `navigation/types.ts` (route `ImportInventory: undefined`), `App.tsx`, `package.json` / `package-lock.json` (via `npx expo install expo-document-picker`)

**Interfaces:**
- Consumes: `parseCsv`, `findColumns`, `classifyRows` (Task 1); `buildPreview`, `toPayload`, `ImportPlan` (Task 2); `useInventory().importInventory`, `loadImportNotes` (Task 4); `useAuth().accounts`.

- [ ] **Step 1: Pick and read.** "Choose spreadsheet (.csv)" button → `DocumentPicker.getDocumentAsync({ type: ['text/csv', 'text/comma-separated-values', 'application/vnd.ms-excel', 'text/plain'], copyToCacheDirectory: true })`; read with `new File(uri).text()` (expo-file-system, as used elsewhere). A short help line: "In Box or Excel: File → Save as / Download → CSV." Missing columns → error naming them.
- [ ] **Step 2: Preview** (one scrolling screen, sections with counts, collapsed lists expandable): New piece types (name + colors); Pieces to add ("{n} numbers → {m} pieces"); Out for repair; Student numbers (each row "First Last — Coats 185", and for differences a two-option toggle "Sheet 185 / App 180", default Sheet); Repair notes ("{n} notes, staff only"); Problems (each `message`, amber). If nothing to do: "Everything in this sheet is already in the app."
- [ ] **Step 3: Confirm.** Button "Import" (disabled while saving or offline) → `requireOnline` → confirm `Alert` summarizing counts → `importInventory(toPayload(plan))` → result screen with the summary counts and the problems list kept visible; `successBuzz`. Errors → `Alert` with `friendlyError`; nothing is half-saved (the DB is all-or-nothing).
- [ ] **Step 4: Verify** — `npx tsc --noEmit` baseline only; `npm test` PASS; `npx expo-doctor` no new failures.
- [ ] **Step 5: Commit** — `git commit -m "Spreadsheet import screen with preview"`

---

### Task 6: Add piece type, color, and number screens

**Files:**
- Create: `screens/AddPieceTypeScreen.tsx`, `components/AddColorSheet.tsx`, `components/AddNumberSheet.tsx`, `components/AddInventorySheet.tsx`
- Modify: `screens/InventoryScreen.tsx` (`handleAddPress` ~146 opens `AddInventorySheet`), `components/PieceCard.tsx` (numbered cards: "Add color" and "Add number" links in the expanded area), `navigation/types.ts`, `App.tsx` (route `AddPieceType: undefined`)

**Interfaces:**
- Consumes: `useInventory()` actions (Task 4), `normalizeNumber` (Task 1).

- [ ] **Step 1: `AddInventorySheet`** (opened by "+"): "Import spreadsheet" → `ImportInventory`; "New piece type" → `AddPieceType`. (Add color / number live on each card.)
- [ ] **Step 2: `AddPieceTypeScreen`.** Name; kind toggle "Numbered (one per number)" / "Counted (ties, belts)"; colors as removable chips + "+ color" input. Numbered: numbers input accepting a list ("104, 112, 120") or a range ("104 to 232 every 4") that expands into chips the user can tap to remove; never assume even steps. Preview line "{n} numbers × {m} colors = {n×m} pieces". Counted: a quantity field per color. Save → `createPieceType`; errors via `friendlyError`; back on success.
- [ ] **Step 3: `AddColorSheet`** — one text field; preview "Adds {color} {type} in all {n} numbers"; save → `addPieceColor`.
- [ ] **Step 4: `AddNumberSheet`** — number field (normalized), color checkboxes all checked by default; save → `addPieceNumber`.
- [ ] **Step 5: Pure helper + test.** `parseNumberList(text: string): { numbers: string[]; error: string | null }` in `lib/import/rows.ts` handling lists, `a to b every s`, normalization, de-duplication, and errors ("\"12x\" isn't a number", "every must be at least 1"). Tests in `tests/importCsv.test.ts`.
- [ ] **Step 6: Verify** — `npm test` PASS; `npx tsc --noEmit` baseline only.
- [ ] **Step 7: Commit** — `git commit -m "Add piece type, color and number"`

---

### Task 7: Duplicate holders and test tooling

**Files:**
- Modify: `lib/inventory.ts`, `tests/inventory.test.ts`, `screens/InventoryScreen.tsx`
- Create: `supabase/scripts/seed-test-members.mjs`; Modify: `package.json` (scripts `test:members` and `start:test`), `.env.test.example` (new, app config for the test project; the real `.env.test.local` is git-ignored)

**Interfaces:**
- Produces:
  - `duplicateNumbers(accounts: Account[]): { pieceType: string; number: string; members: string[] }[]` — active accounts sharing a type+number (possible after the live migration). Inventory's warning line also lists these ("Coats 153 is assigned to 2 people") in the same Alert as unknown numbers.
  - `npm run test:members -- path/to/sample.csv` — reads a CSV, and for each member row creates (or keeps) a TEST-project account with that first/last name, email `test-{first}-{last}@mustangcloset.test`, password printed once, invite code metadata; uses `supabase/.env.test.local`; refuses to run if `SUPABASE_URL` equals the live URL in `supabase/.env.local`.
  - `npm run start:test` — starts Expo with the app pointed at the test project using `mobile-app/.env.test.local` (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`); implement as `node --env-file=.env.test.local node_modules/expo/bin/cli start --clear`, and confirm process env wins over `.env.local` for `EXPO_PUBLIC_*` in SDK 58 (check the docs; if it doesn't, use the documented way to select an env file). Document the result in the report.

- [ ] **Step 1: Failing test** `duplicateNumbers finds shared numbers among active accounts only`.
- [ ] **Step 2: Run, verify FAIL; implement; run PASS** — `npm test`.
- [ ] **Step 3: Tooling** — write the script and npm scripts; run `npm run test:members -- tests/fixtures/sample-roster.csv` against the test project and show its output (accounts created).
- [ ] **Step 4: Verify** — `npm test`, `npx tsc --noEmit` baseline.
- [ ] **Step 5: Commit** — `git commit -m "Show duplicate holders; test-member and test-app tooling"`

---

### Task 8: Docs and on-device check

**Files:**
- Modify: `../CLAUDE.md` (import, add-inventory functions, `pieces` trigger, number normalization, imported notes are staff-only via `member_id null`, `start:test` / `test:members`), `../HANDOFF.md` (release steps updated: the import is how live inventory gets created; how to export the Box sheet to CSV).

- [ ] **Step 1: Update docs.**
- [ ] **Step 2: Full checks** — `npm test`, `npx tsc --noEmit` (13 baseline), `npm run test:rls`, `npx expo-doctor` (known failures only).
- [ ] **Step 3: On-device checklist** (user, with `npm run start:test` against the TEST project; report as pending):
  1. Run `npm run test:members -- <your 5–10 row CSV>`; sign in as staff in Expo Go.
  2. Inventory "+" → Import spreadsheet → pick the CSV from Box → preview shows types, pieces, numbers, notes, problems as expected → Import → summary.
  3. Import the same file again → "Everything in this sheet is already in the app."
  4. Inventory shows assigned/unassigned/out-for-repair chips; "See every Coats" table is filled; an imported note shows on the piece history as "from spreadsheet".
  5. Sign in as a test member → My Inventory shows their pieces and numbers; the imported note is not visible to them.
  6. "+" → New piece type (Pants, two colors, a short range) → appears in Inventory; Add color to Coats → every number gets it; Add number → new chips.
  7. Plans 1–2 checklists (flags with photos, history, clearing, out-for-repair, number editor) on this data.
- [ ] **Step 4: Commit** — `git commit -m "Document import and adding inventory"`
