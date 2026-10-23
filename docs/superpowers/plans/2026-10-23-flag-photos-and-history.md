# Flag Photos and Piece History Implementation Plan (Plan 1 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Members can attach an optional photo to a flag; flags are kept as history instead of deleted; staff tap a size chip in Inventory to see that piece's full history, edit entries, and mark the piece good.

**Architecture:** The existing `flags` table becomes the history table: cleared flags stay as rows with `cleared_at` set, and at most one *open* flag per member/piece/color is enforced with a partial unique index. Writes that need rules go through small Postgres functions (`submit_flag`, `clear_flag`); staff edits use a staff update policy plus a guard trigger. Photos live in a new private `flag-photos` bucket under the member's id folder and are shown with signed URLs, following the combo-photo pattern. `FlagsContext` keeps exposing `flags` (open only) so existing screens are unaffected, and adds `history` (all).

**Tech Stack:** Expo SDK 58 / React Native 0.88, TypeScript, Supabase (Postgres, RLS, Storage, Realtime), `expo-image-picker` (already installed), Node built-in test runner.

**Spec:** `docs/superpowers/specs/2026-10-23-flag-photos-and-piece-inventory-design.md`. This plan covers goals 1, 2, 3, 11, the flag parts of "Flags and pieces", and Inventory option A tinting. A *piece* here is `piece + color + size` as stored on flags today, using the existing `constants/inventoryData.ts` catalogue. **Plan 2** (inventory in the database, per-type member numbers, Assigned/Unassigned, "Every [type]" table) and **Plan 3** (spreadsheet import, add type/color/number) come later.

## Global Constraints

- Work on branch `flag-photos-inventory`. Never commit to `master`.
- Read the versioned Expo docs before writing Expo code (`mobile-app/AGENTS.md`). The project is on SDK 58; check `https://docs.expo.dev/versions/v58.0.0/sdk/imagepicker/`.
- Never run `npm audit fix --force`. Use `npx expo install` for any Expo package.
- No new dependencies are needed for this plan.
- After any schema change: `npm run db:apply`, then `npm run test:rls` must pass. `npm test` and `npx tsc --noEmit` must pass at the end of every task.
- Photo is optional, one per flag. Submitting without one must behave exactly as today.
- Members never see other members' flags or photos.
- Never put the service-role key in app code.
- All commands run from `mobile-app/`.

## Review Focus

1. **Photo upload fails or the network drops mid-submit** → the flag is not half-saved; an uploaded file whose flag didn't save is removed; the member sees the existing "Couldn't save flag" alert. (Task 4 test: `submitFlag removes the uploaded photo when the flag save fails` via the pure `planPhotoChange` helper, plus manual check in Task 7.)
2. **Member re-flags a piece after staff cleared it** → a new open entry is created; the cleared one stays in history unchanged. (Task 1 RLS test: `re-flagging after a clear creates a new open flag and keeps the cleared one`.)
3. **A member tries to clear, edit staff fields of, or change a cleared flag** → refused. (Task 1 RLS tests: `member cannot clear a flag or set staff_note`, `member cannot edit a cleared flag`.)
4. **A member reads another member's photo by guessing the path** → refused. (Task 2 RLS test: `member cannot read another member's flag photo`.)
5. **Old cached flags (from before this change) load at startup** → app doesn't crash; cache is ignored and refetched. (Task 3 test: `isFlagList rejects pre-history cached flags`.)

---

### Task 1: Keep flags as history in the database

**Files:**
- Modify: `supabase/schema.sql` (flags table ~line 60, archive_member ~line 273, flags RLS ~line 435)
- Modify: `supabase/tests/rls.test.ts`

**Interfaces:**
- Produces (SQL, all `grant execute ... to authenticated`):
  - `flags` new columns: `photo_path text` (null), `member_name text not null default ''`, `staff_note text not null default ''`, `source text not null default 'member' check (source in ('member','import'))`, `cleared_at timestamptz`, `cleared_by uuid references profiles(id) on delete set null`, `cleared_by_name text`.
  - `member_id` becomes nullable with `on delete set null` (history survives profile deletion).
  - `submit_flag(p_piece text, p_color text, p_size text, p_status text, p_comment text, p_photo_path text) returns public.flags` — security invoker; inserts for `auth.uid()` or, if an open flag exists for (member, piece, color), updates its status/comment/size/photo_path. Uses `on conflict (member_id, piece, color) where cleared_at is null`.
  - `clear_flag(p_id uuid) returns void` — security definer, staff only (`42501` otherwise). Clears that flag and, when its size is not `'Unassigned'`, every other open flag with the same piece/color/size. Sets `cleared_at = now()`, `cleared_by = auth.uid()`, `cleared_by_name` from the staff profile.

- [ ] **Step 1: Write the failing RLS tests** (new `describe('flag history')`, and update existing tests)

Replace the existing tests `can flag their own piece, and flagging it again updates the same row` and `can mark a member's piece good by deleting its flag` and the flags assertion in the archiving test:

```ts
test('submit_flag creates one open flag; submitting again updates it', async () => {
  const args = { p_piece: 'Coats', p_color: 'Blue', p_size: '208', p_status: 'dirty', p_comment: '', p_photo_path: null };
  const first = await asMember.rpc('submit_flag', args);
  const second = await asMember.rpc('submit_flag', { ...args, p_status: 'repair', p_comment: 'torn' });
  assert.equal(first.error, null); assert.equal(second.error, null);
  assert.equal(second.data.id, first.data.id);
  assert.equal(second.data.member_name, 'member Test');
});
test('staff clear_flag keeps the row with who/when; re-flagging after a clear creates a new open flag and keeps the cleared one', async () => {
  // member flags Vests/Candy/144, staff clears, member flags again
  // expect: 2 rows for that piece; exactly one with cleared_at null; cleared row has cleared_by = staff.id and cleared_by_name = 'staff Test'
});
test('clear_flag clears every open flag on the same piece/color/size, but not Unassigned ones', async () => {
  // admin inserts open flags: member Coats/Red/300, otherMember Coats/Red/300, member Coats/Purple/Unassigned, otherMember Coats/Purple/Unassigned
  // staff clear_flag(member's Red/300) -> both Red/300 cleared
  // staff clear_flag(member's Purple/Unassigned) -> only that one cleared
});
test('member cannot clear a flag or set staff_note', async () => {
  // asMember.rpc('clear_flag', ...) -> error code 42501
  // asMember.from('flags').update({ staff_note: 'x' }).eq('id', ownOpenId) -> error, row unchanged
  // asMember.from('flags').update({ cleared_at: new Date().toISOString() }).eq('id', ownOpenId) -> error, row unchanged
});
test('member cannot edit a cleared flag', async () => {
  // update comment on own cleared flag -> 0 rows, unchanged
});
test('staff can edit color, status, comment and staff_note but not cleared_at directly', async () => {
  // asStaff update { color:'Red', status:'dirty', comment:'c', staff_note:'n' } -> 1 row
  // asStaff update { cleared_at: now } -> error
});
test('nobody can delete flags', async () => {
  // asStaff.from('flags').delete().eq('id', id).select('id') -> 0 rows
});
```

Archiving test: change `assert.equal(flags?.length, 0)` to `assert.equal(flags?.length, 1)` (flags are kept), keep the snapshot assertion, and rename the test to `archiving snapshots the member, keeps flags, clears sizes, and blocks login; restore lets them back in`.

Fill the commented test bodies with real calls following the file's existing style (`admin` to set up, assertions on `error`/`data`).

- [ ] **Step 2: Run to verify they fail**

Run: `npm run test:rls`
Expected: the new/changed tests FAIL (`submit_flag` not found, delete still succeeds, archive deletes flags).

- [ ] **Step 3: Implement in `supabase/schema.sql`**

- Add the columns with `alter table ... add column if not exists`.
- Drop `flags_member_id_piece_color_key`; create `flags_one_open_per_piece` unique index on `(member_id, piece, color) where cleared_at is null`.
- Swap the `member_id` FK to `on delete set null` and drop `not null`.
- Trigger `flags_fill_member_name` (before insert, function `security definer`): sets `member_name` from the member's profile (`first_name || ' ' || last_name`, trimmed). Backfill existing rows once: `update flags set member_name = … where member_name = ''` (existing flags become open history entries with no other change).
- Trigger `guard_flag_update` (before update): rejects (`42501`) any change to `member_id`, `member_name`, `source`, `created_at`, or `cleared_*` unless `current_setting('app.allow_flag_clear', true) = 'on'`. Rejects `staff_note` changes by non-staff. Follow the `guard_profile_update` / `app.allow_size_change` pattern.
- Policies: members' update policy adds `cleared_at is null` to `using`. Add `flags_update_staff` (staff, any row). Drop `flags_delete_staff`. Add `cleared_at is null` to members' insert check.
- `submit_flag` and `clear_flag` as in Interfaces. `clear_flag` sets `app.allow_flag_clear` on/off around its update.
- `archive_member`: remove `delete from public.flags where member_id = target;`. Keep the snapshot, but select only open flags (`and f.cleared_at is null`).

- [ ] **Step 4: Apply and run**

Run: `npm run db:apply && npm run test:rls`
Expected: all pass (the email-change test stays skipped).

- [ ] **Step 5: Commit**

```bash
git add supabase/schema.sql supabase/tests/rls.test.ts
git commit -m "Keep flags as history; add submit_flag and clear_flag"
```

---

### Task 2: Private bucket for flag photos

**Files:**
- Modify: `supabase/schema.sql` (after the combo-images storage block ~line 450)
- Modify: `supabase/tests/rls.test.ts`

**Interfaces:**
- Produces: private bucket `flag-photos`. Object path convention: `<member uuid>/<anything>.jpg`. Members insert/select/delete only in their own folder, and not while archived. Staff select and delete anything. Nobody updates.

- [ ] **Step 1: Write failing tests** (`describe('flag photos')`)

```ts
test('member can upload, read and delete a photo in their own folder', ...);           // path `${member.id}/t-${RUN}.jpg`
test("member cannot upload into another member's folder", ...);                        // `${otherMember.id}/x.jpg` -> error
test("member cannot read another member's flag photo", ...);                           // admin uploads to otherMember folder; asMember download -> error
test('staff can read and delete any flag photo', ...);
```

Use a tiny `new Uint8Array([0xff, 0xd8, 0xff])` body with `contentType: 'image/jpeg'`. Clean up with `admin` in `finally`.

- [ ] **Step 2: Run, verify FAIL** — `npm run test:rls` (bucket missing).

- [ ] **Step 3: Implement** bucket insert (`on conflict do nothing`) and policies `flag_photos_select / _insert / _delete` on `storage.objects`, using `(storage.foldername(name))[1] = auth.uid()::text` and `public.is_staff()` / `not public.is_archived()`.

- [ ] **Step 4: Apply and run** — `npm run db:apply && npm run test:rls` → all pass.

- [ ] **Step 5: Commit** — `git commit -m "Add private flag-photos bucket"`

---

### Task 3: Flag model, mapping, and history helpers

**Files:**
- Modify: `lib/models.ts`, `lib/rows.ts`, `lib/mappers.ts`, `lib/validators.ts`
- Create: `lib/flagHistory.ts`
- Test: `tests/mappers.test.ts`, create `tests/flagHistory.test.ts`, create or extend a validators test in `tests/flagHistory.test.ts`

**Interfaces:**
- Produces:
  - `Flag` gains: `createdAt: string`, `memberName: string`, `photoPath: string | null`, `photoUrl?: string` (signed, display only), `staffNote: string`, `source: 'member' | 'import'`, `clearedAt: string | null`, `clearedByName: string | null`. `memberId` becomes `string | null`.
  - `FlagRow` gains the matching snake_case columns.
  - `rowToFlag(row: FlagRow, photoUrl?: string): Flag`
  - In `lib/flagHistory.ts`:
    - `openFlags(flags: Flag[]): Flag[]` — `clearedAt === null`.
    - `historyFor(flags: Flag[], piece: string, color: string, size: string): Flag[]` — matching entries, newest `createdAt` first.
    - `chipState(flags: Flag[], piece: string, color: string, size: string): 'repair' | 'dirty' | null` — from open flags only; repair wins over dirty.

- [ ] **Step 1: Write failing tests**

```ts
test('rowToFlag maps history columns and the signed photo url', () => {
  const row: FlagRow = { id: 'f1', member_id: 'u1', piece: 'Coats', color: 'Blue', size: '104', status: 'repair',
    comment: 'button', created_at: '2026-10-21T10:00:00Z', updated_at: '2026-10-21T10:00:00Z',
    member_name: 'Jordan P', photo_path: 'u1/a.jpg', staff_note: '', source: 'member',
    cleared_at: null, cleared_by: null, cleared_by_name: null };
  assert.deepEqual(rowToFlag(row, 'https://signed'), { id: 'f1', memberId: 'u1', piece: 'Coats', color: 'Blue', size: '104',
    status: 'repair', comment: 'button', createdAt: '2026-10-21T10:00:00Z', memberName: 'Jordan P',
    photoPath: 'u1/a.jpg', photoUrl: 'https://signed', staffNote: '', source: 'member', clearedAt: null, clearedByName: null });
});
test('historyFor returns only that piece, newest first, open and cleared', ...);   // 3 matching (one cleared) + 1 other color -> 3, ordered by createdAt desc
test('chipState: repair beats dirty; cleared flags are ignored; null when none', ...);
test('openFlags drops cleared flags', ...);
test('isFlagList rejects pre-history cached flags', () => {
  assert.equal(isFlagList([{ id: 'f', memberId: 'u', piece: 'Coats', color: 'Blue', size: '1', status: 'dirty', comment: '' }]), false);
});
```

- [ ] **Step 2: Run, verify FAIL** — `npm test`.

- [ ] **Step 3: Implement** the type changes, mapper, validator (require the new fields; `photoUrl` optional), and `lib/flagHistory.ts`. Fix the existing `rowToFlag` test fixture in `tests/mappers.test.ts` for the new fields.

- [ ] **Step 4: Run** — `npm test` → PASS. `npx tsc --noEmit` will show errors in context/screens; that's expected until Task 4, so only check `lib/` and `tests/` compile (`npx tsc --noEmit 2>&1 | grep -E "^(lib|tests)/"` → no output).

- [ ] **Step 5: Commit** — `git commit -m "Add flag history fields and helpers"`

---

### Task 4: FlagsContext — history, photos, clear and edit

**Files:**
- Modify: `context/FlagsContext.tsx`
- Modify: `lib/flagHistory.ts` (add `planPhotoChange`), `tests/flagHistory.test.ts`
- Modify callers: `screens/member/MyInventoryScreen.tsx:~100-125`, `screens/MemberProfileScreen.tsx:~160-180`, `screens/member/FlagItemScreen.tsx` (unused route; adapt to the new signature only)

**Interfaces:**
- Consumes: `submit_flag`, `clear_flag`, `flag-photos` bucket (Tasks 1–2); `Flag`, `rowToFlag`, `openFlags` (Task 3).
- Produces:
  - `type PhotoChange = { kind: 'keep' } | { kind: 'set'; localUri: string } | { kind: 'remove' }` (exported from `lib/flagHistory.ts`)
  - `planPhotoChange(oldPath: string | null, change: PhotoChange, newPath: string): { upload: boolean; savePath: string | null; deleteAfterSave: string | null; deleteOnFailure: string | null }`
  - `FlagsContextValue`:
    - `flags: Flag[]` — **open only** (existing callers unchanged)
    - `history: Flag[]` — all, including cleared
    - `submitFlag(input: { piece: string; color: string; size: string; status: FlagStatus; comment: string; photo: PhotoChange }): Promise<void>` — replaces `addFlag` and the member use of `updateFlag`
    - `clearFlag(id: string): Promise<void>` — now calls `clear_flag`
    - `editFlag(id: string, fields: { color: string; status: FlagStatus; comment: string; staffNote: string }): Promise<void>` — staff only
    - `addFlag` and `updateFlag` are removed.

- [ ] **Step 1: Write failing tests for `planPhotoChange`**

```ts
test('keep: no upload, saves old path, deletes nothing', ...);            // ('u/a.jpg', keep, 'u/b.jpg') -> {upload:false, savePath:'u/a.jpg', deleteAfterSave:null, deleteOnFailure:null}
test('set replaces: uploads new, deletes old after save, deletes new on failure', ...);
test('set with no old photo', ...);                                       // deleteAfterSave null
test('remove: saves null and deletes old after save', ...);
test('submitFlag removes the uploaded photo when the flag save fails', ...); // set -> deleteOnFailure === newPath
```

- [ ] **Step 2: Run, verify FAIL** — `npm test`.

- [ ] **Step 3: Implement**

- `planPhotoChange` in `lib/flagHistory.ts`.
- In `FlagsContext`: keep all rows in the cached list; derive `flags = openFlags(all)` and `history = all` with `useMemo`. On `reload`, batch-sign photo paths (`createSignedUrls`, 7 days, same as `CombosContext.signedUrlsFor`) and pass each url to `rowToFlag`. On realtime insert/update, sign that one row's path if present (fall back to no url on error, like combos). Drop the DELETE branch's assumption that deletes happen (keep it harmless).
- `submitFlag`: new path `${userId}/${Date.now()}-${random}.jpg`; upload with `new File(localUri).arrayBuffer()` and `contentType: 'image/jpeg'` as in `CombosContext.addCombo`; call `rpc('submit_flag', …)`; on failure remove `deleteOnFailure` and rethrow; on success remove `deleteAfterSave` (log, don't throw, if that remove fails).
- `clearFlag`: `rpc('clear_flag', { p_id })`, then `reload()` (several rows may change).
- `editFlag`: `update({ color, status, comment, staff_note })` `.eq('id', id).select().single()`; RLS refusal shows as 0 rows → throw `"You don't have permission to do that."`.
- Update `MyInventoryScreen.submitFlag` to call `submitFlag({ ..., photo })` (photo comes from Task 5; pass `{ kind: 'keep' }` for now). Its undo restores status/comment via `submitFlag` with `photo: { kind: 'keep' }`.

- [ ] **Step 4: Verify** — `npm test` → PASS; `npx tsc --noEmit` → no errors.

- [ ] **Step 5: Commit** — `git commit -m "FlagsContext: history, photos, clear and edit"`

---

### Task 5: Optional photo on the member flag sheet

**Files:**
- Modify: `components/FlagSheet.tsx`, `screens/member/MyInventoryScreen.tsx`

**Interfaces:**
- Consumes: `PhotoChange` (Task 4), `submitFlag` (Task 4).
- Produces: `FlagSheet` prop `onSubmit: (status: FlagStatus, comment: string, photo: PhotoChange) => Promise<void>`.

- [ ] **Step 1: Implement the photo slot** under the note field, labeled `Add a photo` + `(optional)` in the same style as the note label. States:
  - none: dashed tile "Add photo" → an action choice "Take photo" / "Choose from library" / "Cancel" (`Alert.alert` with buttons is fine).
  - picked or existing (`target.flag?.photoUrl`): thumbnail with an ✕ to remove.
  - Use `expo-image-picker` exactly as `screens/AddComboScreen.tsx` does for permissions, with `mediaTypes: ['images']`, `allowsEditing: false`, `quality: 0.5` to keep uploads small. Permission denied → `Alert` explaining how to allow it in Settings; the flag can still be submitted.
  - Submit passes `{kind:'keep'}` if untouched, `{kind:'set', localUri}` if picked, `{kind:'remove'}` if an existing photo was removed.
  - White shirt (dirty-only) gets the slot too.
- [ ] **Step 2: Wire** `MyInventoryScreen.submitFlag(status, comment, photo)` through to `submitFlag`.
- [ ] **Step 3: Verify** — `npx tsc --noEmit` clean; `npm test` passes.
- [ ] **Step 4: Commit** — `git commit -m "Optional photo on the flag sheet"`

---

### Task 6: Piece history screen and tappable Inventory chips

**Files:**
- Create: `screens/PieceHistoryScreen.tsx`, `components/PhotoViewer.tsx`, `components/EditFlagSheet.tsx`
- Modify: `navigation/types.ts`, `App.tsx` (register route next to `ComboDetail`), `components/PieceCard.tsx`, `screens/InventoryScreen.tsx`

**Interfaces:**
- Consumes: `history`, `clearFlag`, `editFlag` (Task 4); `historyFor`, `chipState` (Task 3).
- Produces: route `PieceHistory: { piece: string; color: string; size: string }` in `RootStackParamList`. `PieceCard` new prop `onSizePress: (color: string, size: string) => void` and `chipStateFor: (color: string, size: string) => 'repair' | 'dirty' | null`.

- [ ] **Step 1: Inventory chips.** In `PieceCard`'s graded breakdown, each size chip becomes a `Pressable` calling `onSizePress(group.color, size)`. Tint by `chipStateFor`: repair → `colors.rust` border/text on `colors.rustTint`; dirty → `colors.wash` on `colors.washTint`. Add a one-line legend under the groups (repair / dirty) only when the card has any tinted chip. `InventoryScreen` passes `chipStateFor = (c, s) => chipState(flags, piece.name, c, s)` and navigates to `PieceHistory`. Style rows (Ties, Belts) are unchanged.
- [ ] **Step 2: `PieceHistoryScreen`.** Header `"{color} {piece} {size}"` with back chevron (match `ComboDetailScreen`). List `historyFor(history, …)`: each entry shows photo thumbnail (or a "no photo" tile), status tag (Repair/Dirty), Open/Cleared tag, comment, `"{memberName} · {date}"` (use `lib/format.ts` short date), `"cleared by {clearedByName} {date}"` when cleared, `staffNote` when present, and `"from spreadsheet"` when `source === 'import'`. Empty state: "No flags on this piece yet." If any entry is open, show a **Mark piece good** button → confirm alert → `clearFlag(openEntry.id)` (one call clears all open flags on the piece). Tapping an entry opens `EditFlagSheet`; tapping a thumbnail opens `PhotoViewer`.
- [ ] **Step 3: `PhotoViewer`.** Full-screen `Modal` with the image `resizeMode="contain"`, dark backdrop, close button.
- [ ] **Step 4: `EditFlagSheet`.** Bottom sheet (reuse `FlagSheet`'s look): color choice from that piece's catalogue colors (`PIECES` in `constants/inventoryData.ts`), status, comment, "Staff note". Save → `editFlag`. Errors → `Alert` with `friendlyError`.
- [ ] **Step 5: Verify** — `npx tsc --noEmit` clean; `npm test` passes.
- [ ] **Step 6: Commit** — `git commit -m "Piece history screen and tappable Inventory sizes"`

---

### Task 7: Docs and on-device check

**Files:**
- Modify: `../CLAUDE.md` (Data and backend section), `../features.md` if it lists flag behavior, `../bugs.md` only if something breaks.

- [ ] **Step 1: Update `CLAUDE.md`**: flags are history (cleared via `clear_flag`, never deleted; one open flag per member/piece/color); members submit through `submit_flag`; photos in private `flag-photos` bucket under `<member id>/`; `FlagsContext.flags` is open-only, `history` is everything; `archive_member` keeps flags.
- [ ] **Step 2: Full checks** — `npm test`, `npx tsc --noEmit`, `npm run test:rls`, `npx expo-doctor` (only the known pre-existing warning allowed).
- [ ] **Step 3: On-device check in Expo Go** (ask the user to run it; report results honestly):
  1. Member flags a piece with no photo → works as before.
  2. Member flags with camera photo, and with library photo → thumbnail shows; re-open shows it; remove works.
  3. Turn on airplane mode mid-submit → alert, no half-saved flag.
  4. Staff: Inventory → expand Coats → flagged size is tinted → tap → history shows photo; tap photo → full size.
  5. Staff edits color/note → saved. Mark piece good → entry shows Cleared with name; chip un-tints; member's My Inventory shows the piece as good.
  6. Member flags the same piece again → new open entry; the cleared one still listed.
- [ ] **Step 4: Commit** — `git commit -m "Document flag history and photos"`
