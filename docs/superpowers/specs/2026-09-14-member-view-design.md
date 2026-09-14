# Member View — design spec

Status: approved, pending implementation plan
Source mockups: `mobile-app/mockups/memberView_gameDay1.png`, `memberView_gameDay2.png`, `memberView_mySizes.png`, `memberView_myInventory.png`, `flag_item_visual.png`
Source doc: `mobile-app/mockups/formation-design-handoff.md` ("Two views: staff vs. member", "Data model notes")

## Goal

Add a second, permission-scoped experience to the app: a **Member view** (Game day / Sizes / Inventory tabs) alongside the existing **Staff view** (Home / Sections / Catalogue / Inventory tabs), selected by the role chosen at Sign Up. A member can flag one of their own uniform pieces as Dirty or Needs Repair; that flag must be visible in the Staff view's Sections and Inventory screens.

## Non-goals (explicitly out of scope for this pass)

- Real accounts/login — Sign Up still just collects a name each time; no per-person persistence beyond the flags below.
- Un-flagging / resolving a flag back to "Good" (staff or member side).
- A real Catalogue browsing screen for staff (stays a placeholder — no mockup exists for it yet).
- A full game schedule (only one seed game).
- Real photo upload/storage (the placeholder-image box is the intended design, not a stand-in).
- Editing sizes from the Member view (explicitly staff-only per the design doc).

## Architecture

Two separate `createBottomTabNavigator` trees, both registered as screens on the existing root `Stack.Navigator` in `App.tsx`:

- `MainTabs` (existing) — Staff view, 4 tabs.
- `MemberTabs` (new) — Member view, 3 tabs: Game day, Sizes, Inventory.

`SignUpScreen`'s submit handler already branches on `role`; it now resets navigation to `MainTabs` for Staff or `MemberTabs` for Member (both via `navigation.reset`, same as today, just a different target route name). Because neither tree has a route into the other and they share no screen, a Member session cannot reach any Staff-only screen — this satisfies the design doc's isolation requirement without needing to restructure the root navigator further (e.g. no separate top-level conditional render is needed on top of this).

### Shared mutable state: `FlagsContext`

The only data that is written to at runtime (as opposed to static seed data read from `constants/`) is the set of flags. This needs to be visible from both navigator trees, so it's lifted into a React Context:

- `context/FlagsContext.tsx` exports a `FlagsProvider` component and a `useFlags()` hook.
- `FlagsProvider` wraps the app in `App.tsx` (inside `SafeAreaProvider`, outside `NavigationContainer`).
- Internal state: `flags: Flag[]`, initialized from `constants/flagsData.ts`'s seed array on first run.
- On mount, `FlagsProvider` asynchronously loads a saved JSON blob from `AsyncStorage` (key: `"formation.flags.v1"`); if present, it replaces the seed data. If absent (first launch), the seed data is used and immediately written to `AsyncStorage`.
- Every call to `addFlag` or `updateFlag` updates in-memory state and re-persists the full array to `AsyncStorage` (fire-and-forget; no loading spinner needed for a write this small).
- `useFlags()` returns `{ flags, addFlag, updateFlag }`.

New dependency: `@react-native-async-storage/async-storage`, installed via `npx expo install` for SDK 57 compatibility.

## Data model

```ts
// constants/flagsData.ts
export type FlagStatus = 'dirty' | 'repair';

export type Flag = {
  id: string;           // stable id, e.g. `${memberName}-${piece}` since one piece can only carry one open flag at a time (no un-flagging yet, so this is safe)
  memberName: string;   // matches a name in constants/membersData.ts
  piece: string;        // matches a Piece.name in constants/inventoryData.ts, e.g. "Coats"
  color: string;
  size: string;
  status: FlagStatus;
  comment: string;
};

export const FLAGS: Flag[] = [ /* the 12 flags currently inline on MEMBERS, migrated here */ ];
```

```ts
// constants/combosData.ts
export type Combo = {
  id: string;
  label: string;        // "Combo 01"
  sub: string;           // "Field — home"
  components: string[];  // ["White hat", "Red bowtie", ...]
};

export const COMBOS: Combo[] = [ /* existing 5 Home-carousel combos, extended with `components`, plus a 6th: Combo 14 */ ];
```

```ts
// constants/gamesData.ts
export type Game = {
  opponent: string;      // "Lincoln High"
  date: string;          // "Fri, Sep 18" — display string, not a real Date
  preGameComboId: string;
  halftimeComboId: string;
};

export const CURRENT_GAME: Game = { opponent: 'Lincoln High', date: 'Fri, Sep 18', preGameComboId: 'combo-01', halftimeComboId: 'combo-14' };
```

```ts
// constants/myUniformData.ts
export const MY_MEMBER_NAME = 'Maya Chen'; // the fixed demo member whose data the Member view shows

export type UniformSlot = { piece: string; color: string; size: string };

export const MY_UNIFORM: UniformSlot[] = [
  { piece: 'Coat', color: 'Blue', size: '208' },
  { piece: 'Vest', color: 'Candy', size: '204' },
  { piece: 'Bibbers', color: 'Blue', size: '212' },
  { piece: 'Pants', color: 'Blue', size: '208' },
  { piece: 'Tie', color: 'Blue', size: '—' },
  { piece: 'Belt', color: 'Blue', size: '—' },
];
```

Note: `MY_UNIFORM` piece names are singular ("Coat") while `constants/inventoryData.ts`'s `PIECES` and the migrated `FLAGS` use the plural category name ("Coats") already established by the Inventory screen. `MyInventoryScreen` must map singular → plural (or the seed data should just use the plural form consistently — **use the plural form** in `MY_UNIFORM` to match `FLAGS`/`PIECES` and avoid a translation layer). Maya Chen's existing flag (`piece: 'Coats', color: 'Blue', size: '208', status: 'dirty'`) then matches her `MY_UNIFORM` "Coats" slot exactly, which is what makes her flagged row show as "Dirty" on My Inventory.

### Refactor: Inventory's repair/dirty counts become computed, not stored

`Piece` in `constants/inventoryData.ts` currently has hardcoded `repairCount`/`dirtyCount` fields. These are removed; `InventoryScreen` instead computes, per piece, `flags.filter(f => f.piece === piece.name)` and derives counts/summary from that. This is what makes a flag submitted from the Member view actually show up in Staff's Inventory screen and summary line in real time. `PieceCard` and the summary-line `useMemo` in `InventoryScreen` are updated accordingly; the flag-button `onFlagPress` navigation to `Sections` is unchanged.

### Refactor: Sections' member list reads flags instead of `member.item`

`Member` in `constants/membersData.ts` becomes `{ name: string; section: string }` — the inline `item` field is removed. `SectionsScreen`'s status filtering and the `MemberRow` display look up `flags.find(f => f.memberName === member.name)` instead of reading `member.item` directly. Behavior (what's shown, how filtering works) is unchanged — only the data source moves.

## Navigation types

```ts
// navigation/types.ts additions
export type RootStackParamList = {
  SignUp: undefined;
  MainTabs: UserParams;
  MemberTabs: UserParams;
  Profile: UserParams;
  MemberAccount: UserParams;
  FlagItem: { piece: string; color: string; size: string };
};

export type MemberTabParamList = {
  GameDay: undefined;
  Sizes: undefined;
  Inventory: undefined;
};
```

`FlagItem` and `MemberAccount` are root-stack screens (pushed on top of `MemberTabs`), the same pattern `Profile` already uses on top of `MainTabs`.

## Screens

All under a new `screens/member/` folder, using the existing shared design system (`constants/colors.ts`, `constants/fonts.ts`, `components/TapeGutter.tsx`) — same visual language as the Staff screens, just a different tab set.

- **`GameDayScreen`** — reads `CURRENT_GAME`, looks up `preGameComboId`/`halftimeComboId` in `COMBOS`. Renders "Pre-game" and "Halftime" sections, each: combo label/sub, a placeholder-image box captioned "From Catalogue — Combo {id}", and a wrapped chip row of `components`.
- **`MySizesScreen`** — renders `MY_UNIFORM` as a 2-column grid of piece/color/size cards (matching the mockup), plus the static advisory note ("sizes can only be changed by staff"). Fully read-only, no interaction beyond scrolling.
- **`MyInventoryScreen`** — renders `MY_UNIFORM` as a list; for each slot, looks up a matching flag via `useFlags()` and shows "Good" or the flag's status (colored per the existing rust/wash convention) with a chevron. If flagged, shows the comment inline with an "Edit" link. Tapping a row (flagged or not) navigates to `FlagItem` with that piece/color/size; the "Edit" link does the same (pre-filling existing status/comment).
- **`FlagItemScreen`** — header with an X (closes back to My Inventory) instead of a back chevron, matching the mockup. Shows the target piece/color/size, a Dirty/Needs-repair segmented toggle (reusing the same segmented-control pattern as Sign Up's Member/Staff toggle), a comment `TextInput`, and a pinned "Submit flag" footer button. On submit, calls `addFlag` (or `updateFlag` if one already exists for this piece — matched by `id`) and navigates back.
- **`MemberAccountScreen`** (not in the mockups; needed for Log Out) — reached by tapping the header avatar on Game Day. Shows the signed-up name/instrument/role as read-only text (no edit mode, unlike Staff's `ProfileScreen`) and a Log Out button identical in behavior to the Staff Profile's (resets to `SignUp`).

### `MemberTabs.tsx`

Mirrors the structure of `screens/MainTabs.tsx`: a `createBottomTabNavigator<MemberTabParamList>()` with `screenOptions` reusing the same tab bar styling. Tab icons are new (flag / list / inventory-window shapes) — no exact SVG source exists for these (unlike the staff icons, which came from the `.html` mockups), so they'll be hand-drawn with `react-native-svg` at implementation time, matching the established stroke-width/style convention (~1.6px stroke, no fill). The `GameDay` tab's screen is registered the same render-prop way `Home` is in `MainTabs.tsx`, so it can receive an `onAvatarPress` callback that navigates to `MemberAccount` via the parent stack navigator.

## Error handling / edge cases

- `AsyncStorage` read/write failures (rare on-device, but the API can reject): wrap in try/catch; on load failure, fall back to seed `FLAGS` silently (no user-facing error — this is a prototype with no server of record to reconcile against). On write failure, the in-memory state still updates so the current session behaves correctly; the failure is swallowed (logged via `console.warn`, nothing more) since there's no UI for storage errors elsewhere in the app either.
- Submitting a flag with an empty comment is allowed (comment is optional, matching how the mockup doesn't mark it required).
- A piece with no existing flag defaults to "Good" everywhere it's displayed.

## Testing / acceptance criteria

Manual, on-device (consistent with how every other feature in this app has been verified — there is no automated test suite):

1. Sign up as Member → land on Game Day (not Home/Staff tabs).
2. Game Day shows the Lincoln High game with correct Pre-game/Halftime combo photos-placeholder and component chips.
3. Sizes tab shows Maya Chen's 6 pieces read-only.
4. Inventory tab shows Coats as "Dirty" (pre-seeded) and the other 5 as "Good".
5. Tap a "Good" piece → Flag item → submit "Needs repair" with a comment → back on My Inventory, that piece now shows "Repair" with the comment.
6. Log out (via avatar → Member Account), sign back up as **Staff**, no access code needed to check: open Sections, filter to that member's section — the row now shows the newly-flagged item. Open Inventory — that piece's "Repair · N" count increased by one and the summary line reflects it.
7. Force-close and reopen the app (or reload in Expo Go) → the new flag is still there (AsyncStorage persistence).
8. `npx tsc --noEmit` and `npx expo-doctor` both clean, as with every prior change in this project.
