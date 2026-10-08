# Uniform Size Filter — Design

**Date:** 2026-10-07
**Status:** Approved in conversation, pending written-spec review
**App:** Mustang Closet (`mobile-app/`, Expo SDK 57)

## Goal

Let staff find which members are assigned a given uniform size: pick a piece
(Coats, Vests, Bibbers, Pants), type a number, and the Members list narrows to
the members assigned that size.

Today no per-member uniform sizes exist. `MY_SIZES` in
`constants/myUniformData.ts` is a hardcoded constant, so every member's My Sizes
screen shows the same values, and there is nothing for a filter to search. This
feature therefore also adds real, staff-assigned sizes stored in Supabase.

This reverses one decision in `2026-09-29-supabase-backend-design.md`, which kept
member uniform assignments in code.

## Decisions

| Topic | Decision |
|---|---|
| Storage | Four columns on `profiles` (Option A). Rejected: a separate `uniform_sizes` table — it would need its own context, cache, Realtime subscription and RLS for four fixed pieces. |
| Pieces | Coats, Vests, Bibbers, Pants. Ties and Belts stay staff-managed centrally (not per member); White shirt and shoe size are unchanged. |
| Who sets sizes | Staff only, on Member Profile. Members see their sizes read-only on My Sizes (the screen already says "sizes can only be changed by staff"). |
| Size per color | One size per piece, the same across colors (matches the existing comment in `myUniformData.ts`). The filter has no color input. |
| Size format | Digits only, or blank. Blank means "not assigned yet". No check against the catalogue's size ranges. |
| Filter location | Members tab (`SectionsScreen.tsx`), as a third filter group under Section and Status. |
| Matching | Exact string match on the size for the chosen piece. |

## Database (`supabase/schema.sql`)

### New columns on `profiles`

| Column | Type |
|---|---|
| `coat_size` | `text not null default ''` |
| `vest_size` | `text not null default ''` |
| `bibber_size` | `text not null default ''` |
| `pant_size` | `text not null default ''` |

Added with `alter table public.profiles add column if not exists ...` so
`npm run db:apply` is safe to re-run on the live project. Existing rows get `''`.

### Guard members out

Extend `guard_profile_update()`: if any of the four size columns changes and the
transaction setting `app.allow_size_change` is not `'on'`, raise
`'only staff can change uniform sizes'` (errcode `42501`). This mirrors the
existing role guard. Trusted callers (`auth.uid() is null`) still bypass it.

### `set_uniform_sizes(target uuid, coat text, vest text, bibber text, pant text) returns void`

`security definer`, `search_path = public`, like `set_role`:

1. Raise `42501` unless `public.is_staff()`.
2. Raise `22023` ('invalid size') unless every argument matches `^[0-9]*$`
   after trimming.
3. Set `app.allow_size_change` to `'on'` (transaction-local), update the four
   columns on `target`, raise `P0002` ('no such user') if no row matched, then
   set it back to `'off'`.

Staff may set their own sizes (unlike `set_role`, there's no self-escalation risk).
`revoke all ... from public, anon; grant execute ... to authenticated`.

Staff need this function because `profiles_update_own` only lets a user update
their own row. Existing read access is unchanged: members read their own profile,
staff read all, and `staff_directory` still exposes only id and names.

### RLS tests (`supabase/tests/rls.test.ts`)

- A member updating their own `coat_size` directly is rejected, and the admin
  client confirms the value is unchanged.
- A member calling `set_uniform_sizes` (on themselves or another member) is
  rejected, value unchanged.
- Staff calling `set_uniform_sizes` on a member succeeds and the admin client
  sees the new values.
- Staff passing a non-numeric size is rejected.
- A member can still update their own phone (the guard doesn't over-block).

Tests restore any sizes they change in `finally` blocks, like the existing tests.

## Data layer

- `lib/rows.ts`: add the four columns to `ProfileRow`.
- `lib/models.ts`: add `export type UniformSizes = { coats: string; vests: string; bibbers: string; pants: string }`
  and `uniformSizes: UniformSizes` on `Account`.
- `lib/mappers.ts`: `profileToAccount` fills `uniformSizes`. `AccountUpdates`
  excludes `uniformSizes` (it doesn't go through `updateAccount`), so
  `accountUpdatesToProfile` never writes size columns.
- `lib/validators.ts`: `isAccount` requires `uniformSizes` with four strings. A
  cache written before this change fails validation and is ignored once; the app
  then fetches fresh data, which is the existing cache-miss path.
- `context/AuthContext.tsx`: add `setUniformSizes(id, sizes)`. It trims the
  values, calls the `set_uniform_sizes` RPC, then updates `accounts` (and
  `account`, if staff edited themselves) with the same pattern `setAccountRole`
  uses. Realtime on `profiles` already pushes the change to other phones.
- Unit tests (`tests/mappers.test.ts`, plus a validator test): mapping fills
  `uniformSizes`; `accountUpdatesToProfile` never emits size columns; `isAccount`
  rejects an account without `uniformSizes`.

## Staff: assign sizes (`screens/MemberProfileScreen.tsx`)

- A "Uniform sizes" card, shown only for real accounts (`isRealAccount`), placed
  above the uncommitted "Flagged pieces" card. That work is left as is.
- Four labelled inputs (Coats, Vests, Bibbers, Pants), prefilled from the
  account. They use `keyboardType="number-pad"`, `KeyboardDoneBar`,
  `useScrollToInput`, and strip non-digits while typing.
- A Save button, disabled while saving or when nothing changed, dimmed and
  blocked offline with `requireOnline` / `OFFLINE_DIM`. On error it shows an
  `Alert` with `friendlyError`.
- The card reads the live account from `useAuth().accounts` by id, not from route
  params, so it shows the current values after a save or a Realtime update.

## Staff: filter by size (`screens/SectionsScreen.tsx`)

- `RosterMember` gains `uniformSizes?: UniformSizes`, filled from the matched
  account. Mock roster names without an account have none and never match.
- A new "Uniform size" filter group below Status contains single-select piece
  chips (Coats / Vests / Bibbers / Pants; tapping the selected chip deselects
  it) and one size input (`number-pad`, digits only, `KeyboardDoneBar`).
- The size filter is active only when a piece is selected **and** the size input
  is non-empty. Then it keeps only members whose size for that piece equals the
  input. It ANDs with the Section and Status filters.
- The result label adds `Coats · 208` to its parts, e.g.
  `2 members — Trumpet · Coats · 208`.
- Typing in the search box clears the size filter, as it already does for
  Section and Status. The `route.params.section` reset effect also clears it.
- In inventory drill-down mode (`isFiltered`) the filter groups are hidden as
  today, and the size filter does not apply.

## Member: My Sizes (`screens/member/MySizesScreen.tsx`)

- The Coats/Vests/Bibbers/Pants cells read `account.uniformSizes` instead of
  `MY_SIZES`, keeping the color list from the catalogue. A blank size shows `—`.
- `constants/myUniformData.ts` drops `MY_SIZES`. `MY_UNIFORM` becomes the
  piece/variant list without sizes, with a `sizeKey` (`coats` / `vests` /
  `bibbers` / `pants`) linking each piece to `UniformSizes`.

## Member: My Inventory (`screens/member/MyInventoryScreen.tsx`)

- The only other `MY_UNIFORM` consumer. It shows the size from
  `account.uniformSizes`, and the same size goes into the `FlagItem` route params.
- A piece with no assigned size shows `—` and can still be flagged. The flag's
  size is recorded as `Unassigned`, so staff see a readable value on the flag.

## Testing

1. `npm test` and `npx tsc --noEmit` pass.
2. `npm run db:apply`, then `npm run test:rls` passes.
3. On a device in Expo Go: as staff, set Coats 208 on a member. On the Members
   tab, choose Coats and type 208, and the member appears; type 216 and they
   don't. As that member, My Sizes and My Inventory show Coats 208, and a member
   with no sizes sees `—`.

## Out of scope

- Size ranges or validation against the catalogue.
- Per-color sizes.
- Members editing their own sizes.
- Filtering by more than one piece at once.
