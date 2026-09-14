# Member View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a role-gated Member experience (Game day / Sizes / Inventory tabs) alongside the existing Staff experience, sharing a single `Flag` data store so a member's flagged uniform piece is visible in the Staff view.

**Architecture:** Two independent `createBottomTabNavigator` trees (`MainTabs` for Staff, new `MemberTabs` for Member) registered as sibling screens on the existing root `Stack.Navigator`, selected by the role chosen at Sign Up. A single React Context (`FlagsContext`), backed by `AsyncStorage`, holds the only data mutated at runtime (flags) and is read by both trees — everything else stays as plain static constants like the rest of the app.

**Tech Stack:** Expo SDK 57, React Native, TypeScript, `@react-navigation/native-stack` + `@react-navigation/bottom-tabs`, `@react-native-async-storage/async-storage` (new).

**Spec:** `docs/superpowers/specs/2026-09-14-member-view-design.md`

## Global Constraints

- No automated test suite exists in this project. Every task is verified with `npx tsc --noEmit`, `npx expo-doctor` (run with `$env:CI = "1"` in PowerShell, from `mobile-app/`), and a manual check in Expo Go — the same loop used for every prior feature in this app.
- New dependency `@react-native-async-storage/async-storage` must be installed via `npx expo install` (not plain `npm install`), so its version matches SDK 57.
- Reuse `constants/colors.ts` and `constants/fonts.ts` exactly as they exist today — no new colors or fonts.
- Square corners everywhere; the only circular elements are avatars (matches every existing screen).
- The fixed demo member for the entire Member view is `MY_MEMBER_NAME = 'Maya Chen'` (from `constants/myUniformData.ts`) — her existing dirty-Coats flag is intentionally reused so "My Inventory" shows a real flagged row from day one.
- Piece names throughout (`FLAGS`, `PIECES`, `MY_UNIFORM`) use the existing plural convention (`"Coats"`, `"Vests"`, etc.) — never singular.
- Out of scope (do not build): un-flagging/resolving, a real Catalogue browsing screen, a multi-game schedule, real photo upload, editing sizes from the Member view.

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `constants/flagsData.ts` | Create | `Flag`/`FlagStatus` types + seed `FLAGS` array (migrated from `membersData.ts`) |
| `constants/combosData.ts` | Create | `Combo` type + seed `COMBOS` array (extends the 5 Home-carousel combos with `components`, adds Combo 14) |
| `constants/gamesData.ts` | Create | `Game` type + seed `CURRENT_GAME` |
| `constants/myUniformData.ts` | Create | `MY_MEMBER_NAME`, `UniformSlot` type, seed `MY_UNIFORM` (Maya Chen's 6 pieces) |
| `context/FlagsContext.tsx` | Create | `FlagsProvider` + `useFlags()` — the only mutable, `AsyncStorage`-backed shared state in the app |
| `navigation/types.ts` | Modify | Add `MemberTabs`, `MemberAccount`, `FlagItem` to `RootStackParamList`; add `MemberTabParamList` |
| `constants/inventoryData.ts` | Modify | Remove `repairCount`/`dirtyCount` from `Piece` — now computed from `FLAGS` |
| `constants/membersData.ts` | Modify | Remove `item`/`UniformItem` — `Member` becomes `{ name, section }` only |
| `constants/homeData.ts` | Modify | `INVENTORY` preview now derives repair/dirty counts from `FLAGS` |
| `screens/InventoryScreen.tsx` | Modify | Compute per-piece counts from `useFlags()` instead of static fields |
| `components/PieceCard.tsx` | Modify | Accept `repairCount`/`dirtyCount` as props instead of reading them off `piece` |
| `screens/SectionsScreen.tsx` | Modify | Look up each member's flag via `useFlags()` instead of `member.item` |
| `components/MemberRow.tsx` | Modify | Accept an optional `flag` prop instead of reading `member.item` |
| `components/TabIcon.tsx` | Modify | Add `'gameday'`, `'sizes'`, `'memberInventory'` icon cases |
| `screens/SignUpScreen.tsx` | Modify | Route to `MemberTabs` or `MainTabs` based on role |
| `screens/MemberTabs.tsx` | Create | 3-tab navigator for the Member view |
| `screens/member/MemberAccountScreen.tsx` | Create | Read-only account info + Log Out, reached from Game Day's avatar |
| `screens/member/GameDayScreen.tsx` | Create | Pre-game/Halftime combo display |
| `screens/member/MySizesScreen.tsx` | Create | Read-only sizes grid |
| `screens/member/MyInventoryScreen.tsx` | Create | Member's 6 pieces with live flag status; navigates to `FlagItem` |
| `screens/member/FlagItemScreen.tsx` | Create | Dirty/Needs-repair form that writes via `useFlags()` |
| `App.tsx` | Modify | Wrap in `FlagsProvider`; register `MemberTabs`, `MemberAccount`, `FlagItem` |

---

### Task 1: Install AsyncStorage

**Files:**
- Modify: `mobile-app/package.json`, `mobile-app/package-lock.json` (via command, not manual edit)

**Interfaces:**
- Produces: the `@react-native-async-storage/async-storage` package, importable as `AsyncStorage` in Task 3.

- [ ] **Step 1: Install the dependency**

Run from `mobile-app/`:
```
npx expo install @react-native-async-storage/async-storage
```

- [ ] **Step 2: Verify**

Run:
```
$env:CI = "1"
npx expo-doctor
```
Expected: `21/21 checks passed. No issues detected!` (or the current total — no new failures).

Also run:
```
npx tsc --noEmit
```
Expected: no output (no errors).

- [ ] **Step 3: Commit**

```bash
git add mobile-app/package.json mobile-app/package-lock.json
git commit -m "Add @react-native-async-storage/async-storage dependency

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Seed data files (flags, combos, games, my uniform)

**Files:**
- Create: `mobile-app/constants/flagsData.ts`
- Create: `mobile-app/constants/combosData.ts`
- Create: `mobile-app/constants/gamesData.ts`
- Create: `mobile-app/constants/myUniformData.ts`

**Interfaces:**
- Produces: `Flag`, `FlagStatus`, `FLAGS` (from flagsData); `Combo`, `COMBOS` (from combosData); `Game`, `CURRENT_GAME` (from gamesData); `UniformSlot`, `MY_UNIFORM`, `MY_MEMBER_NAME` (from myUniformData). All four files are pure data with no dependencies on the rest of the app — nothing consumes them yet, so this task cannot break the build.

- [ ] **Step 1: Create `constants/flagsData.ts`**

```ts
export type FlagStatus = 'dirty' | 'repair';

export type Flag = {
  id: string;
  memberName: string;
  piece: string;
  color: string;
  size: string;
  status: FlagStatus;
  comment: string;
};

const flag = (
  memberName: string,
  piece: string,
  color: string,
  size: string,
  status: FlagStatus
): Flag => ({
  id: `${memberName}-${piece}`,
  memberName,
  piece,
  color,
  size,
  status,
  comment: '',
});

export const FLAGS: Flag[] = [
  flag('Maya Chen', 'Coats', 'Blue', '208', 'dirty'),
  flag('Owen Diaz', 'Coats', 'Purple', '160', 'dirty'),
  flag('Simone Reyes', 'Coats', 'Red', '132', 'repair'),
  flag('Delilah Osei', 'Coats', 'Candy', '148', 'repair'),
  flag('Marcus Vale', 'Coats', 'Blue', '176', 'repair'),
  flag('Theo Marsh', 'Vests', 'Red', '128', 'dirty'),
  flag('Ruth Okafor', 'Bibbers', 'Blue', '184', 'repair'),
  flag('Callum Doyle', 'Bibbers', 'White', '212', 'repair'),
  flag('Layla Fitzgerald', 'Pants', 'White', '204', 'dirty'),
  flag('Harper Voss', 'Ties', 'Red', 'One size', 'repair'),
  flag('Elena Marsh', 'Ties', 'Blue bows', 'One size', 'dirty'),
  flag('Wyatt Chambers', 'Belts', 'Red', 'One size', 'repair'),
];
```

This is the exact same 12 flagged items currently inline on `MEMBERS` in `constants/membersData.ts` — Task 4 removes them from there once this file exists.

- [ ] **Step 2: Create `constants/combosData.ts`**

```ts
export type Combo = {
  id: string;
  label: string;
  sub: string;
  components: string[];
};

export const COMBOS: Combo[] = [
  {
    id: 'combo-01',
    label: 'Combo 01',
    sub: 'Field — home',
    components: ['White hat', 'Red bowtie', 'Red vest', 'White bibbers', 'Spats', 'White gloves'],
  },
  {
    id: 'combo-02',
    label: 'Combo 02',
    sub: 'Field — away',
    components: ['White hat', 'Blue bowtie', 'Blue vest', 'White bibbers', 'Spats', 'White gloves'],
  },
  {
    id: 'combo-03',
    label: 'Combo 03',
    sub: 'Parade — formal',
    components: ['Shako', 'Plume', 'Coat', 'Bibbers', 'Gloves'],
  },
  {
    id: 'combo-04',
    label: 'Combo 04',
    sub: 'Parade — summer',
    components: ['Shako', 'Coat', 'Bibbers', 'Gloves'],
  },
  {
    id: 'combo-05',
    label: 'Combo 05',
    sub: 'Concert',
    components: ['Concert black', 'Bowtie'],
  },
  {
    id: 'combo-14',
    label: 'Combo 14',
    sub: 'Halftime formation',
    components: ['White hat', 'Blue bowtie', 'Blue vest', 'White bibbers', 'Spats', 'White gloves'],
  },
];
```

`combo-01` and `combo-14` have components matching the two Game Day mockup screenshots exactly. `combo-02` through `combo-05` (only ever shown as label/sub in Home's carousel today) get plausible invented components for type completeness.

- [ ] **Step 3: Create `constants/gamesData.ts`**

```ts
export type Game = {
  opponent: string;
  date: string;
  preGameComboId: string;
  halftimeComboId: string;
};

export const CURRENT_GAME: Game = {
  opponent: 'Lincoln High',
  date: 'Fri, Sep 18',
  preGameComboId: 'combo-01',
  halftimeComboId: 'combo-14',
};
```

- [ ] **Step 4: Create `constants/myUniformData.ts`**

```ts
export const MY_MEMBER_NAME = 'Maya Chen';

export type UniformSlot = {
  piece: string;
  color: string;
  size: string;
};

export const MY_UNIFORM: UniformSlot[] = [
  { piece: 'Coats', color: 'Blue', size: '208' },
  { piece: 'Vests', color: 'Candy', size: '204' },
  { piece: 'Bibbers', color: 'Blue', size: '212' },
  { piece: 'Pants', color: 'Blue', size: '208' },
  { piece: 'Ties', color: 'Blue', size: '—' },
  { piece: 'Belts', color: 'Blue', size: '—' },
];
```

Note `MY_MEMBER_NAME` matches `'Maya Chen'` exactly as used in `flagsData.ts`'s `FLAGS` — her `Coats` flag (Blue, 208, dirty) matches this `Coats` slot exactly, so "My Inventory" shows a real flagged row without any extra wiring.

- [ ] **Step 5: Verify**

Run:
```
npx tsc --noEmit
```
Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add mobile-app/constants/flagsData.ts mobile-app/constants/combosData.ts mobile-app/constants/gamesData.ts mobile-app/constants/myUniformData.ts
git commit -m "Add seed data for flags, combos, games, and the member's uniform

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: FlagsContext + wire into App.tsx

**Files:**
- Create: `mobile-app/context/FlagsContext.tsx`
- Modify: `mobile-app/App.tsx`

**Interfaces:**
- Consumes: `Flag`, `FlagStatus`, `FLAGS` from `constants/flagsData.ts` (Task 2); `AsyncStorage` from `@react-native-async-storage/async-storage` (Task 1).
- Produces: `FlagsProvider` (component) and `useFlags(): { flags: Flag[]; addFlag: (flag: Flag) => void; updateFlag: (id: string, status: FlagStatus, comment: string) => void }`, both exported from `context/FlagsContext.tsx`. Tasks 4, 6, 8 all consume `useFlags()`.

- [ ] **Step 1: Create `context/FlagsContext.tsx`**

```tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FLAGS, type Flag, type FlagStatus } from '../constants/flagsData';

const STORAGE_KEY = 'formation.flags.v1';

type FlagsContextValue = {
  flags: Flag[];
  addFlag: (flag: Flag) => void;
  updateFlag: (id: string, status: FlagStatus, comment: string) => void;
};

const FlagsContext = createContext<FlagsContextValue | null>(null);

export function FlagsProvider({ children }: { children: ReactNode }) {
  const [flags, setFlags] = useState<Flag[]>(FLAGS);

  useEffect(() => {
    let isMounted = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (isMounted && saved) {
          setFlags(JSON.parse(saved) as Flag[]);
        }
      })
      .catch(() => {
        // No saved data yet, or storage unavailable — keep the seed FLAGS.
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const save = (next: Flag[]) => {
    setFlags(next);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {
      // Best-effort persistence — in-memory state is already up to date.
    });
  };

  const addFlag = (newFlag: Flag) => {
    save([...flags.filter((f) => f.id !== newFlag.id), newFlag]);
  };

  const updateFlag = (id: string, status: FlagStatus, comment: string) => {
    save(flags.map((f) => (f.id === id ? { ...f, status, comment } : f)));
  };

  return (
    <FlagsContext.Provider value={{ flags, addFlag, updateFlag }}>
      {children}
    </FlagsContext.Provider>
  );
}

export function useFlags(): FlagsContextValue {
  const context = useContext(FlagsContext);
  if (!context) {
    throw new Error('useFlags must be used within a FlagsProvider');
  }
  return context;
}
```

- [ ] **Step 2: Wrap the app in `FlagsProvider`**

In `mobile-app/App.tsx`, add the import:

```tsx
import { FlagsProvider } from './context/FlagsContext';
```

directly below the `import type { RootStackParamList } from './navigation/types';` line, and wrap the returned tree — change:

```tsx
  return (
    <SafeAreaProvider>
      <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
        <NavigationContainer>
```

to:

```tsx
  return (
    <SafeAreaProvider>
      <FlagsProvider>
        <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
          <NavigationContainer>
```

and change the closing tags at the end of the same `return` from:

```tsx
        </NavigationContainer>
      </View>
    </SafeAreaProvider>
  );
```

to:

```tsx
        </NavigationContainer>
        </View>
      </FlagsProvider>
    </SafeAreaProvider>
  );
```

(Re-indent the `View`/`NavigationContainer`/`Stack.Navigator` block one level deeper — indentation doesn't affect compilation, so this can be done as a mechanical find-and-replace of the two snippets above without retyping the whole file.)

- [ ] **Step 3: Verify**

Run:
```
npx tsc --noEmit
```
Expected: no output.

Run:
```
$env:CI = "1"
npx expo-doctor
```
Expected: all checks pass.

Manual check: run `npm start` in `mobile-app/`, open in Expo Go, confirm the app still loads to the Sign Up screen with no crash (nothing consumes `useFlags()` yet, so this is purely a "did I break app startup" check).

- [ ] **Step 4: Commit**

```bash
git add mobile-app/context/FlagsContext.tsx mobile-app/App.tsx
git commit -m "Add FlagsContext for shared, persisted flag state

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Refactor Inventory/Sections/Home to derive status from live flags

**Files:**
- Modify: `mobile-app/constants/inventoryData.ts`
- Modify: `mobile-app/constants/membersData.ts`
- Modify: `mobile-app/constants/homeData.ts`
- Modify: `mobile-app/screens/InventoryScreen.tsx`
- Modify: `mobile-app/components/PieceCard.tsx`
- Modify: `mobile-app/screens/SectionsScreen.tsx`
- Modify: `mobile-app/components/MemberRow.tsx`

**Interfaces:**
- Consumes: `useFlags()` from `context/FlagsContext.tsx` (Task 3); `Flag` type from `constants/flagsData.ts` (Task 2).
- Produces: `Piece` (no longer has `repairCount`/`dirtyCount`); `Member` (no longer has `item`) — both types are consumed by Tasks 6–8's screens only through `MEMBERS`/`PIECES`, which are unaffected in shape otherwise.

This task must land as one commit — splitting it would leave the app in a non-compiling state, since removing the two fields breaks four other files simultaneously.

- [ ] **Step 1: Remove `repairCount`/`dirtyCount` from `Piece`**

In `mobile-app/constants/inventoryData.ts`, change the `Piece` type from:

```ts
export type Piece = {
  name: string;
  colorsLabel: string;
  qty: number;
  repairCount: number;
  dirtyCount: number;
  retired?: boolean;
  breakdown: PieceBreakdown;
};
```

to:

```ts
export type Piece = {
  name: string;
  colorsLabel: string;
  qty: number;
  retired?: boolean;
  breakdown: PieceBreakdown;
};
```

Then replace the `PIECES` array with this (identical to the current one, minus the `repairCount`/`dirtyCount` line from each entry):

```ts
export const PIECES: Piece[] = [
  {
    name: 'Coats',
    colorsLabel: 'Blue, Red, Purple, Candy',
    qty: 58,
    breakdown: {
      type: 'graded',
      groups: [
        { color: 'Blue', sizes: sizeRange(104, 232, 8) },
        { color: 'Red', sizes: sizeRange(108, 220, 8) },
        { color: 'Purple', sizes: sizeRange(112, 216, 8) },
        { color: 'Candy', sizes: sizeRange(116, 204, 8) },
      ],
    },
  },
  {
    name: 'Vests',
    colorsLabel: 'Candy, Red',
    qty: 56,
    breakdown: {
      type: 'graded',
      groups: [
        { color: 'Candy', sizes: sizeRange(112, 216, 8) },
        { color: 'Red', sizes: sizeRange(116, 220, 8) },
      ],
    },
  },
  {
    name: 'Bibbers',
    colorsLabel: 'Blue, White',
    qty: 64,
    breakdown: {
      type: 'graded',
      groups: [
        { color: 'Blue', sizes: sizeRange(104, 352, 8) },
        { color: 'White', sizes: sizeRange(108, 324, 8) },
      ],
    },
  },
  {
    name: 'Pants',
    colorsLabel: 'Blue, White',
    qty: 60,
    breakdown: {
      type: 'graded',
      groups: [
        { color: 'Blue', sizes: sizeRange(104, 336, 8) },
        { color: 'White', sizes: sizeRange(108, 308, 8) },
      ],
    },
  },
  {
    name: 'Ties',
    colorsLabel: 'One size per style',
    qty: 138,
    breakdown: {
      type: 'style',
      rows: [
        { name: 'Blue', qty: 40 },
        { name: 'Red', qty: 36 },
        { name: 'Purple', qty: 18 },
        { name: 'Blue bows', qty: 24 },
        { name: 'Red bows', qty: 20 },
      ],
    },
  },
  {
    name: 'Belts',
    colorsLabel: 'Red, Blue',
    qty: 80,
    breakdown: {
      type: 'style',
      rows: [
        { name: 'Red', qty: 48 },
        { name: 'Blue', qty: 32 },
      ],
    },
  },
];
```

(`sizeRange`, `ColorGroup`, `StyleRow`, and `PieceBreakdown` above this in the file are unchanged.)

- [ ] **Step 2: Simplify `Member` in `membersData.ts`**

Replace the entire contents of `mobile-app/constants/membersData.ts` with:

```ts
export type Member = {
  name: string;
  section: string;
};

export const MEMBERS: Member[] = [
  { name: 'Maya Chen', section: 'Trumpet' },
  { name: 'Jordan Blake', section: 'Trumpet' },
  { name: 'Priya Nair', section: 'Trumpet' },
  { name: 'Owen Diaz', section: 'Baritone' },
  { name: 'Felix Marsh', section: 'Baritone' },
  { name: 'Ava Thornton', section: 'Piccolo' },
  { name: 'Simone Reyes', section: 'Piccolo' },
  { name: 'Noah Whitfield', section: 'Alto sax' },
  { name: 'Delilah Osei', section: 'Alto sax' },
  { name: 'Marcus Vale', section: 'Tenor & bari sax' },
  { name: 'Ines Calloway', section: 'Tenor & bari sax' },
  { name: 'Theo Marsh', section: 'Mellophone' },
  { name: 'Grace Kowalski', section: 'Mellophone' },
  { name: 'Ruth Okafor', section: 'Trombone' },
  { name: 'Callum Doyle', section: 'Trombone' },
  { name: 'Layla Fitzgerald', section: 'Tuba' },
  { name: 'Dominic Russo', section: 'Tuba' },
  { name: 'Harper Voss', section: 'Drumline' },
  { name: 'Elena Marsh', section: 'Drumline' },
  { name: 'Wyatt Chambers', section: 'Drumline' },
];
```

(The `UniformItem` type is gone — `Flag` in `flagsData.ts` replaces its role. Every name/section pair here is identical to what's already in the file; only the per-member `item` fields are removed.)

- [ ] **Step 3: Derive Home's inventory preview from `FLAGS`**

In `mobile-app/constants/homeData.ts`, change the top import and the `INVENTORY` export. Replace:

```ts
import { PIECES } from './inventoryData';
```

with:

```ts
import { PIECES } from './inventoryData';
import { FLAGS } from './flagsData';
```

and replace:

```ts
export const INVENTORY = PIECES.map((piece) => ({
  piece: piece.name,
  sizes: piece.colorsLabel,
  qty: piece.qty,
  condition:
    piece.repairCount > 0
      ? `Repair (${piece.repairCount})`
      : piece.dirtyCount > 0
        ? `Dirty (${piece.dirtyCount})`
        : 'Good',
  warn: piece.repairCount > 0 || piece.dirtyCount > 0,
}));
```

with:

```ts
export const INVENTORY = PIECES.map((piece) => {
  const pieceFlags = FLAGS.filter((f) => f.piece === piece.name);
  const repairCount = pieceFlags.filter((f) => f.status === 'repair').length;
  const dirtyCount = pieceFlags.filter((f) => f.status === 'dirty').length;
  return {
    piece: piece.name,
    sizes: piece.colorsLabel,
    qty: piece.qty,
    condition:
      repairCount > 0 ? `Repair (${repairCount})` : dirtyCount > 0 ? `Dirty (${dirtyCount})` : 'Good',
    warn: repairCount > 0 || dirtyCount > 0,
  };
});
```

(`STATS`, `SECTIONS`, and `CATALOGUE` in this file are unchanged.)

- [ ] **Step 4: Update `InventoryScreen.tsx` to compute counts from flags**

In `mobile-app/screens/InventoryScreen.tsx`, add an import:

```tsx
import { useFlags } from '../context/FlagsContext';
```

directly below `import { BackChevronIcon, PlusIcon, SearchIcon } from '../components/icons';`.

Inside `export default function InventoryScreen({ navigation }: Props) {`, add this line right after the two existing `useState` lines:

```tsx
  const { flags } = useFlags();
```

Add a new `useMemo` right after that (before the existing `toggleFilter` function):

```tsx
  const pieceCounts = useMemo(() => {
    const counts = new Map<string, { repairCount: number; dirtyCount: number }>();
    for (const piece of PIECES) {
      const pieceFlags = flags.filter((f) => f.piece === piece.name);
      counts.set(piece.name, {
        repairCount: pieceFlags.filter((f) => f.status === 'repair').length,
        dirtyCount: pieceFlags.filter((f) => f.status === 'dirty').length,
      });
    }
    return counts;
  }, [flags]);
```

Replace the existing `summary` useMemo:

```tsx
  const summary = useMemo(() => {
    const flaggedCount = PIECES.filter((p) => p.repairCount > 0 || p.dirtyCount > 0).length;
    const repairTotal = PIECES.reduce((sum, p) => sum + p.repairCount, 0);
    const dirtyTotal = PIECES.reduce((sum, p) => sum + p.dirtyCount, 0);
    return { flaggedCount, repairTotal, dirtyTotal };
  }, []);
```

with:

```tsx
  const summary = useMemo(() => {
    let flaggedCount = 0;
    let repairTotal = 0;
    let dirtyTotal = 0;
    for (const piece of PIECES) {
      const counts = pieceCounts.get(piece.name)!;
      if (counts.repairCount > 0 || counts.dirtyCount > 0) flaggedCount += 1;
      repairTotal += counts.repairCount;
      dirtyTotal += counts.dirtyCount;
    }
    return { flaggedCount, repairTotal, dirtyTotal };
  }, [pieceCounts]);
```

Replace the existing `visiblePieces` useMemo's filter body — change:

```tsx
      if (activeFilters.size === 0) return true;
      return (
        (activeFilters.has('good') &&
          piece.repairCount === 0 &&
          piece.dirtyCount === 0 &&
          !piece.retired) ||
        (activeFilters.has('repair') && piece.repairCount > 0) ||
        (activeFilters.has('dirty') && piece.dirtyCount > 0) ||
        (activeFilters.has('retired') && !!piece.retired)
      );
    });
  }, [searchText, activeFilters]);
```

to:

```tsx
      if (activeFilters.size === 0) return true;
      const counts = pieceCounts.get(piece.name)!;
      return (
        (activeFilters.has('good') && counts.repairCount === 0 && counts.dirtyCount === 0 && !piece.retired) ||
        (activeFilters.has('repair') && counts.repairCount > 0) ||
        (activeFilters.has('dirty') && counts.dirtyCount > 0) ||
        (activeFilters.has('retired') && !!piece.retired)
      );
    });
  }, [searchText, activeFilters, pieceCounts]);
```

Finally, replace the `PieceCard` render call — change:

```tsx
          {visiblePieces.map((piece) => (
            <PieceCard key={piece.name} piece={piece} onFlagPress={handleFlagPress} />
          ))}
```

to:

```tsx
          {visiblePieces.map((piece) => {
            const counts = pieceCounts.get(piece.name)!;
            return (
              <PieceCard
                key={piece.name}
                piece={piece}
                repairCount={counts.repairCount}
                dirtyCount={counts.dirtyCount}
                onFlagPress={handleFlagPress}
              />
            );
          })}
```

- [ ] **Step 5: Update `PieceCard.tsx` to accept counts as props**

In `mobile-app/components/PieceCard.tsx`, change the function signature from:

```tsx
export default function PieceCard({
  piece,
  onFlagPress,
}: {
  piece: Piece;
  onFlagPress: (piece: Piece, kind: 'repair' | 'dirty') => void;
}) {
```

to:

```tsx
export default function PieceCard({
  piece,
  repairCount,
  dirtyCount,
  onFlagPress,
}: {
  piece: Piece;
  repairCount: number;
  dirtyCount: number;
  onFlagPress: (piece: Piece, kind: 'repair' | 'dirty') => void;
}) {
```

Then replace every `piece.repairCount` with `repairCount` and every `piece.dirtyCount` with `dirtyCount` in the JSX below (there are 4 occurrences: the `{(piece.repairCount > 0 || piece.dirtyCount > 0) && (` condition, the `{piece.repairCount > 0 && (` condition and its `Repair · {piece.repairCount}` text, and the `{piece.dirtyCount > 0 && (` condition and its `Dirty · {piece.dirtyCount}` text). The rest of the file (breakdown rendering, styles) is unchanged.

- [ ] **Step 6: Update `SectionsScreen.tsx` to read flags instead of `member.item`**

In `mobile-app/screens/SectionsScreen.tsx`, add an import:

```tsx
import { useFlags } from '../context/FlagsContext';
```

directly below `import { BackChevronIcon, PlusIcon, SearchIcon } from '../components/icons';`.

Inside `export default function SectionsScreen({ navigation, route }: Props) {`, add after the three existing `useState` lines:

```tsx
  const { flags } = useFlags();
```

Replace the whole `filteredMembers` useMemo:

```tsx
  const filteredMembers = useMemo(() => {
    if (isFiltered) {
      return MEMBERS.filter(
        (member) => member.item?.piece === filterPiece && member.item?.status === filterStatus
      );
    }

    const query = searchText.trim().toLowerCase();
    return MEMBERS.filter((member) => {
      const matchesSearch =
        !query ||
        member.name.toLowerCase().includes(query) ||
        member.section.toLowerCase().includes(query);
      if (!matchesSearch) return false;

      const matchesSection = !sectionFilter || member.section === sectionFilter;
      if (!matchesSection) return false;

      if (statusFilters.size === 0) return true;
      return (
        (statusFilters.has('good') && !member.item) ||
        (statusFilters.has('repair') && member.item?.status === 'repair') ||
        (statusFilters.has('dirty') && member.item?.status === 'dirty')
      );
    });
  }, [isFiltered, filterPiece, filterStatus, searchText, sectionFilter, statusFilters]);
```

with:

```tsx
  const filteredMembers = useMemo(() => {
    if (isFiltered) {
      return MEMBERS.filter((member) => {
        const flag = flags.find((f) => f.memberName === member.name);
        return flag?.piece === filterPiece && flag?.status === filterStatus;
      });
    }

    const query = searchText.trim().toLowerCase();
    return MEMBERS.filter((member) => {
      const matchesSearch =
        !query ||
        member.name.toLowerCase().includes(query) ||
        member.section.toLowerCase().includes(query);
      if (!matchesSearch) return false;

      const matchesSection = !sectionFilter || member.section === sectionFilter;
      if (!matchesSection) return false;

      if (statusFilters.size === 0) return true;
      const flag = flags.find((f) => f.memberName === member.name);
      return (
        (statusFilters.has('good') && !flag) ||
        (statusFilters.has('repair') && flag?.status === 'repair') ||
        (statusFilters.has('dirty') && flag?.status === 'dirty')
      );
    });
  }, [isFiltered, filterPiece, filterStatus, searchText, sectionFilter, statusFilters, flags]);
```

Finally, replace the `MemberRow` render call — change:

```tsx
          {filteredMembers.map((member) => (
            <MemberRow key={member.name} member={member} onPress={handleRowPress} />
          ))}
```

to:

```tsx
          {filteredMembers.map((member) => (
            <MemberRow
              key={member.name}
              member={member}
              flag={flags.find((f) => f.memberName === member.name)}
              onPress={handleRowPress}
            />
          ))}
```

- [ ] **Step 7: Update `MemberRow.tsx` to accept a `flag` prop**

Replace the entire contents of `mobile-app/components/MemberRow.tsx` with:

```tsx
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../constants/colors';
import { fonts } from '../constants/fonts';
import type { Member } from '../constants/membersData';
import type { Flag } from '../constants/flagsData';
import { SmallChevronRightIcon } from './icons';

export default function MemberRow({
  member,
  flag,
  onPress,
}: {
  member: Member;
  flag?: Flag;
  onPress: () => void;
}) {
  const initials = member.name
    .split(' ')
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase();

  const itemColor = flag?.status === 'repair' ? colors.rust : colors.wash;

  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initials}</Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.name}>{member.name}</Text>
        <Text style={styles.section}>{member.section}</Text>
        {flag && (
          <View style={styles.itemRow}>
            <View style={[styles.dot, { backgroundColor: itemColor }]} />
            <Text style={[styles.itemText, { color: itemColor }]}>
              {flag.piece} — {flag.color} — {flag.size}
            </Text>
          </View>
        )}
      </View>
      <SmallChevronRightIcon color={colors.inkFaint} size={14} strokeWidth={1.8} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    padding: 13,
    marginBottom: 8,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: fonts.wordmark,
    fontSize: 13,
    color: colors.paper,
  },
  info: {
    flex: 1,
  },
  name: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13.5,
    color: colors.ink,
  },
  section: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.inkSoft,
    marginTop: 1,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 6,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 1,
    transform: [{ rotate: '45deg' }],
  },
  itemText: {
    fontFamily: fonts.body,
    fontSize: 11,
  },
});
```

- [ ] **Step 8: Verify**

Run:
```
npx tsc --noEmit
```
Expected: no output.

Run:
```
$env:CI = "1"
npx expo-doctor
```
Expected: all checks pass.

Manual check in Expo Go: sign up as Staff. Home's inventory preview, the Inventory tab's per-piece counts and summary line, and Sections' member filtering must all show **exactly the same numbers as before this task** (Coats: Repair·3/Dirty·2, etc.) — since `FLAGS` is a straight port of the old inline data, behavior should be unchanged; only the data source moved.

- [ ] **Step 9: Commit**

```bash
git add mobile-app/constants/inventoryData.ts mobile-app/constants/membersData.ts mobile-app/constants/homeData.ts mobile-app/screens/InventoryScreen.tsx mobile-app/components/PieceCard.tsx mobile-app/screens/SectionsScreen.tsx mobile-app/components/MemberRow.tsx
git commit -m "Derive Inventory/Sections/Home status from shared FlagsContext

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Role-gated navigation shell (MemberTabs with placeholders)

**Files:**
- Modify: `mobile-app/navigation/types.ts`
- Modify: `mobile-app/components/TabIcon.tsx`
- Create: `mobile-app/screens/MemberTabs.tsx`
- Modify: `mobile-app/screens/SignUpScreen.tsx`
- Modify: `mobile-app/App.tsx`

**Interfaces:**
- Consumes: `PlaceholderScreen` (existing, `screens/PlaceholderScreen.tsx`, takes `{ title: string }`).
- Produces: `MemberTabParamList` type (`{ GameDay: undefined; Sizes: undefined; Inventory: undefined }`); `MemberTabs` component, registered in `App.tsx` as route `"MemberTabs"` taking `UserParams`. Task 6 replaces the `GameDay` placeholder; Task 7 replaces `Sizes`; Task 8 replaces `Inventory`.

- [ ] **Step 1: Add navigation types**

In `mobile-app/navigation/types.ts`, change:

```ts
export type RootStackParamList = {
  SignUp: undefined;
  MainTabs: UserParams;
  Profile: UserParams;
};
```

to:

```ts
export type RootStackParamList = {
  SignUp: undefined;
  MainTabs: UserParams;
  MemberTabs: UserParams;
  Profile: UserParams;
};
```

and add this new type at the end of the file:

```ts

export type MemberTabParamList = {
  GameDay: undefined;
  Sizes: undefined;
  Inventory: undefined;
};
```

- [ ] **Step 2: Add three new tab icons**

In `mobile-app/components/TabIcon.tsx`, change the type:

```tsx
export type TabIconName = 'home' | 'sections' | 'catalogue' | 'inventory';
```

to:

```tsx
export type TabIconName =
  | 'home'
  | 'sections'
  | 'catalogue'
  | 'inventory'
  | 'gameday'
  | 'sizes'
  | 'memberInventory';
```

Then add three new `case`s to the `switch`, right before the closing `case 'inventory':` block stays as-is — insert these after it (before the function's closing `}`):

```tsx
    case 'gameday':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M6 4v16" {...common} />
          <Path d="M6 5h12l-3 3.5L18 12H6" {...common} />
        </Svg>
      );
    case 'sizes':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M5 6h14M5 12h14M5 18h9" {...common} />
        </Svg>
      );
    case 'memberInventory':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Rect x={4} y={5} width={16} height={14} {...common} />
          <Path d="M4 9h16" {...common} />
        </Svg>
      );
```

`Rect` is already imported at the top of this file (`import Svg, { Circle, Path, Rect } from 'react-native-svg';`), so no import change is needed.

- [ ] **Step 3: Create `screens/MemberTabs.tsx`**

```tsx
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StyleSheet, Text } from 'react-native';
import type { MemberTabParamList, RootStackParamList } from '../navigation/types';
import { colors } from '../constants/colors';
import { fonts } from '../constants/fonts';
import TabIcon, { type TabIconName } from '../components/TabIcon';
import PlaceholderScreen from './PlaceholderScreen';

type Props = NativeStackScreenProps<RootStackParamList, 'MemberTabs'>;

const Tab = createBottomTabNavigator<MemberTabParamList>();

const TAB_ICONS: Record<keyof MemberTabParamList, TabIconName> = {
  GameDay: 'gameday',
  Sizes: 'sizes',
  Inventory: 'memberInventory',
};

const TAB_LABELS: Record<keyof MemberTabParamList, string> = {
  GameDay: 'Game day',
  Sizes: 'Sizes',
  Inventory: 'Inventory',
};

export default function MemberTabs({}: Props) {
  return (
    <Tab.Navigator
      screenOptions={({ route: tabRoute }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.inkFaint,
        tabBarStyle: styles.tabBar,
        tabBarLabel: ({ color }) => (
          <Text style={[styles.tabLabel, { color }]}>
            {TAB_LABELS[tabRoute.name as keyof MemberTabParamList]}
          </Text>
        ),
        tabBarIcon: ({ color }) => (
          <TabIcon name={TAB_ICONS[tabRoute.name as keyof MemberTabParamList]} color={color} />
        ),
      })}
    >
      <Tab.Screen name="GameDay">{() => <PlaceholderScreen title="Game day" />}</Tab.Screen>
      <Tab.Screen name="Sizes">{() => <PlaceholderScreen title="Sizes" />}</Tab.Screen>
      <Tab.Screen name="Inventory">{() => <PlaceholderScreen title="Inventory" />}</Tab.Screen>
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.surface,
    borderTopColor: colors.line,
  },
  tabLabel: {
    fontFamily: fonts.body,
    fontSize: 9.5,
  },
});
```

Note the route names (`GameDay`) differ from their display labels (`"Game day"`) — that's why this file needs its own `TAB_LABELS` map, unlike `MainTabs.tsx` which uses `tabRoute.name` directly as the label (its route names happen to already be valid display text).

- [ ] **Step 4: Route Sign Up by role**

In `mobile-app/screens/SignUpScreen.tsx`, change the `goToHome` function from:

```tsx
  const goToHome = (confirmedRole: Role) => {
    navigation.reset({
      index: 0,
      routes: [
        { name: 'MainTabs', params: { firstName, lastName, instrument, role: confirmedRole } },
      ],
    });
  };
```

to:

```tsx
  const goToHome = (confirmedRole: Role) => {
    navigation.reset({
      index: 0,
      routes: [
        {
          name: confirmedRole === 'Staff' ? 'MainTabs' : 'MemberTabs',
          params: { firstName, lastName, instrument, role: confirmedRole },
        },
      ],
    });
  };
```

- [ ] **Step 5: Register `MemberTabs` in `App.tsx`**

Add the import below `import MainTabs from './screens/MainTabs';`:

```tsx
import MemberTabs from './screens/MemberTabs';
```

Add the screen registration below the existing `MainTabs` screen:

```tsx
            <Stack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
            <Stack.Screen name="MemberTabs" component={MemberTabs} options={{ headerShown: false }} />
```

- [ ] **Step 6: Verify**

Run:
```
npx tsc --noEmit
```
Expected: no output.

Run:
```
$env:CI = "1"
npx expo-doctor
```
Expected: all checks pass.

Manual check in Expo Go:
- Sign up with role **Member** → lands on a 3-tab bar labeled "Game day" / "Sizes" / "Inventory" with distinct icons, each showing a "Coming soon" placeholder.
- Sign up with role **Staff** (with the 1234 access code) → still lands on the unchanged 4-tab Staff `MainTabs` (regression check — this must be unaffected).

- [ ] **Step 7: Commit**

```bash
git add mobile-app/navigation/types.ts mobile-app/components/TabIcon.tsx mobile-app/screens/MemberTabs.tsx mobile-app/screens/SignUpScreen.tsx mobile-app/App.tsx
git commit -m "Add role-gated MemberTabs navigator shell

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Game Day screen + Member Account screen

**Files:**
- Create: `mobile-app/screens/member/GameDayScreen.tsx`
- Create: `mobile-app/screens/member/MemberAccountScreen.tsx`
- Modify: `mobile-app/navigation/types.ts`
- Modify: `mobile-app/screens/MemberTabs.tsx`
- Modify: `mobile-app/App.tsx`

**Interfaces:**
- Consumes: `CURRENT_GAME` from `constants/gamesData.ts`, `COMBOS`/`Combo` from `constants/combosData.ts` (Task 2); `TapeGutter` (existing, no props) and `BackChevronIcon` (existing, `{ color: string; size?: number }`).
- Produces: `GameDayScreen` — props `BottomTabScreenProps<MemberTabParamList, 'GameDay'> & { firstName: string; lastName: string; onAvatarPress: () => void }` (mirrors how `HomeScreen` is wired into `MainTabs.tsx` today). `MemberAccountScreen` — props `NativeStackScreenProps<RootStackParamList, 'MemberAccount'>`.

- [ ] **Step 1: Create `screens/member/GameDayScreen.tsx`**

```tsx
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { MemberTabParamList } from '../../navigation/types';
import { colors } from '../../constants/colors';
import { fonts } from '../../constants/fonts';
import { CURRENT_GAME } from '../../constants/gamesData';
import { COMBOS, type Combo } from '../../constants/combosData';
import TapeGutter from '../../components/TapeGutter';

type Props = BottomTabScreenProps<MemberTabParamList, 'GameDay'> & {
  firstName: string;
  lastName: string;
  onAvatarPress: () => void;
};

export default function GameDayScreen({ firstName, lastName, onAvatarPress }: Props) {
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  const preGameCombo = COMBOS.find((c) => c.id === CURRENT_GAME.preGameComboId)!;
  const halftimeCombo = COMBOS.find((c) => c.id === CURRENT_GAME.halftimeComboId)!;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.appBody}>
        <TapeGutter />
        <ScrollView style={styles.flexOne} contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Game day</Text>
            <Pressable style={styles.avatar} onPress={onAvatarPress}>
              <Text style={styles.avatarText}>{initials}</Text>
            </Pressable>
          </View>
          <Text style={styles.gameLine}>
            vs. {CURRENT_GAME.opponent} — {CURRENT_GAME.date}
          </Text>

          <ComboSection title="Pre-game" combo={preGameCombo} />
          <ComboSection title="Halftime" combo={halftimeCombo} />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

function ComboSection({ title, combo }: { title: string; combo: Combo }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionSub}>
        {combo.label} — {combo.sub}
      </Text>
      <View style={styles.photoBox}>
        <Text style={styles.photoCaption}>From Catalogue — {combo.label}</Text>
      </View>
      <Text style={styles.componentsLabel}>Components</Text>
      <View style={styles.chipRow}>
        {combo.components.map((component) => (
          <View key={component} style={styles.chip}>
            <Text style={styles.chipText}>{component}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  flexOne: { flex: 1 },
  appBody: { flex: 1, flexDirection: 'row' },
  content: { padding: 18, paddingBottom: 28 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: { fontFamily: fonts.wordmark, fontSize: 24, color: colors.ink },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: fonts.wordmark, fontSize: 14, color: colors.paper },
  gameLine: { fontFamily: fonts.body, fontSize: 13, color: colors.inkSoft, marginBottom: 24 },
  section: { marginBottom: 28 },
  sectionTitle: { fontFamily: fonts.blockTitle, fontSize: 17, color: colors.ink, marginBottom: 3 },
  sectionSub: { fontFamily: fonts.mono, fontSize: 11.5, color: colors.inkSoft, marginBottom: 12 },
  photoBox: {
    height: 220,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  photoCaption: { fontFamily: fonts.body, fontSize: 12, color: colors.inkFaint },
  componentsLabel: { fontFamily: fonts.body, fontSize: 11.5, color: colors.inkSoft, marginBottom: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  chipText: { fontFamily: fonts.body, fontSize: 12.5, color: colors.ink },
});
```

- [ ] **Step 2: Add `MemberAccount` to the navigation types**

In `mobile-app/navigation/types.ts`, change:

```ts
export type RootStackParamList = {
  SignUp: undefined;
  MainTabs: UserParams;
  MemberTabs: UserParams;
  Profile: UserParams;
};
```

to:

```ts
export type RootStackParamList = {
  SignUp: undefined;
  MainTabs: UserParams;
  MemberTabs: UserParams;
  Profile: UserParams;
  MemberAccount: UserParams;
};
```

- [ ] **Step 3: Create `screens/member/MemberAccountScreen.tsx`**

```tsx
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { colors } from '../../constants/colors';
import { fonts } from '../../constants/fonts';
import TapeGutter from '../../components/TapeGutter';
import { BackChevronIcon } from '../../components/icons';

type Props = NativeStackScreenProps<RootStackParamList, 'MemberAccount'>;

export default function MemberAccountScreen({ navigation, route }: Props) {
  const { firstName, lastName, instrument, role } = route.params;
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();

  const handleLogOut = () => {
    navigation.reset({ index: 0, routes: [{ name: 'SignUp' }] });
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.appBody}>
        <TapeGutter />
        <View style={styles.content}>
          <View style={styles.header}>
            <Pressable style={styles.headerSideButton} onPress={() => navigation.goBack()}>
              <BackChevronIcon color={colors.ink} />
            </Pressable>
            <Text style={styles.pageTitle}>Account</Text>
            <View style={styles.headerSideButton} />
          </View>

          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>

          <Text style={styles.roleBadge}>{role}</Text>

          <View style={styles.fieldWrapper}>
            <Text style={styles.label}>First Name</Text>
            <Text style={styles.value}>{firstName}</Text>
          </View>
          <View style={styles.fieldWrapper}>
            <Text style={styles.label}>Last Name</Text>
            <Text style={styles.value}>{lastName}</Text>
          </View>
          <View style={styles.fieldWrapper}>
            <Text style={styles.label}>Instrument</Text>
            <Text style={styles.value}>{instrument}</Text>
          </View>

          <Pressable style={styles.logOutButton} onPress={handleLogOut}>
            <Text style={styles.logOutButtonText}>Log Out</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  appBody: { flex: 1, flexDirection: 'row' },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 16,
    paddingHorizontal: 18,
    paddingBottom: 28,
  },
  header: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 6,
    marginBottom: 10,
  },
  headerSideButton: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  pageTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fonts.wordmark,
    fontSize: 18,
    color: colors.ink,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  avatarText: { fontFamily: fonts.wordmark, fontSize: 36, color: colors.paper },
  roleBadge: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    letterSpacing: 0.5,
    color: colors.ink,
    textTransform: 'uppercase',
    marginBottom: 20,
  },
  fieldWrapper: { width: '100%' },
  label: {
    fontFamily: fonts.body,
    fontSize: 11.5,
    color: colors.inkSoft,
    marginTop: 12,
    marginBottom: 6,
  },
  value: { fontFamily: fonts.body, fontSize: 14, color: colors.ink },
  logOutButton: {
    width: '100%',
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  logOutButtonText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.ink },
});
```

- [ ] **Step 4: Wire `GameDayScreen` into `MemberTabs.tsx`**

In `mobile-app/screens/MemberTabs.tsx`, add the import:

```tsx
import GameDayScreen from './member/GameDayScreen';
```

Change the function signature from:

```tsx
export default function MemberTabs({}: Props) {
```

to:

```tsx
export default function MemberTabs({ navigation, route }: Props) {
  const { firstName, lastName, instrument, role } = route.params;
```

Replace the `GameDay` tab screen:

```tsx
      <Tab.Screen name="GameDay">{() => <PlaceholderScreen title="Game day" />}</Tab.Screen>
```

with:

```tsx
      <Tab.Screen name="GameDay">
        {(tabProps) => (
          <GameDayScreen
            {...tabProps}
            firstName={firstName}
            lastName={lastName}
            onAvatarPress={() =>
              navigation.navigate('MemberAccount', { firstName, lastName, instrument, role })
            }
          />
        )}
      </Tab.Screen>
```

- [ ] **Step 5: Register `MemberAccount` in `App.tsx`**

Add the import below `import MemberTabs from './screens/MemberTabs';`:

```tsx
import MemberAccountScreen from './screens/member/MemberAccountScreen';
```

Add the screen registration below the `MemberTabs` line:

```tsx
            <Stack.Screen name="MemberAccount" component={MemberAccountScreen} options={{ headerShown: false }} />
```

- [ ] **Step 6: Verify**

Run:
```
npx tsc --noEmit
```
Expected: no output.

Manual check in Expo Go: sign up as Member. Game Day shows "vs. Lincoln High — Fri, Sep 18", a "Pre-game" section reading "Combo 01 — Field — home" with 6 component chips (White hat, Red bowtie, Red vest, White bibbers, Spats, White gloves), and a "Halftime" section reading "Combo 14 — Halftime formation" with its own 6 chips (same list but Blue bowtie/Blue vest). Tap the avatar → Account screen shows the entered name/instrument and "MEMBER"; tap Log Out → returns to Sign Up.

- [ ] **Step 7: Commit**

```bash
git add mobile-app/screens/member/GameDayScreen.tsx mobile-app/screens/member/MemberAccountScreen.tsx mobile-app/navigation/types.ts mobile-app/screens/MemberTabs.tsx mobile-app/App.tsx
git commit -m "Add Game Day and Member Account screens

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: My Sizes screen

**Files:**
- Create: `mobile-app/screens/member/MySizesScreen.tsx`
- Modify: `mobile-app/screens/MemberTabs.tsx`

**Interfaces:**
- Consumes: `MY_UNIFORM` from `constants/myUniformData.ts` (Task 2).
- Produces: `MySizesScreen` — no props.

- [ ] **Step 1: Create `screens/member/MySizesScreen.tsx`**

```tsx
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../constants/colors';
import { fonts } from '../../constants/fonts';
import { MY_UNIFORM } from '../../constants/myUniformData';
import TapeGutter from '../../components/TapeGutter';

export default function MySizesScreen() {
  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.appBody}>
        <TapeGutter />
        <ScrollView style={styles.flexOne} contentContainerStyle={styles.content}>
          <Text style={styles.title}>My sizes</Text>
          <Text style={styles.subtitle}>Assigned sizes</Text>
          <View style={styles.grid}>
            {MY_UNIFORM.map((slot, index) => (
              <View
                key={slot.piece}
                style={[
                  styles.cell,
                  index % 2 === 0 && styles.cellBorderRight,
                  index < MY_UNIFORM.length - 2 && styles.cellBorderBottom,
                ]}
              >
                <Text style={styles.cellLabel}>{slot.piece}</Text>
                <Text style={styles.cellValue}>
                  {slot.color} · {slot.size}
                </Text>
              </View>
            ))}
          </View>
          <View style={styles.note}>
            <Text style={styles.noteText}>
              If any of these look wrong, let a uniform manager know — sizes can only be changed
              by staff.
            </Text>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  flexOne: { flex: 1 },
  appBody: { flex: 1, flexDirection: 'row' },
  content: { padding: 18, paddingBottom: 28 },
  title: { fontFamily: fonts.wordmark, fontSize: 24, color: colors.ink, marginBottom: 16 },
  subtitle: { fontFamily: fonts.blockTitle, fontSize: 15.5, color: colors.ink, marginBottom: 10 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: 20,
  },
  cell: {
    width: '50%',
    backgroundColor: colors.surface,
    padding: 14,
  },
  cellBorderRight: { borderRightWidth: 1, borderRightColor: colors.line },
  cellBorderBottom: { borderBottomWidth: 1, borderBottomColor: colors.line },
  cellLabel: { fontFamily: fonts.body, fontSize: 11.5, color: colors.inkSoft, marginBottom: 4 },
  cellValue: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.ink },
  note: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    padding: 14,
  },
  noteText: { fontFamily: fonts.body, fontSize: 12.5, color: colors.inkSoft, lineHeight: 18 },
});
```

(With 6 slots in a 2-column grid, `index < MY_UNIFORM.length - 2` i.e. `index < 4` correctly puts a bottom border under the first two rows only, leaving the last row's bottom edge as the grid's own border.)

- [ ] **Step 2: Wire into `MemberTabs.tsx`**

Add the import:

```tsx
import MySizesScreen from './member/MySizesScreen';
```

Replace:

```tsx
      <Tab.Screen name="Sizes">{() => <PlaceholderScreen title="Sizes" />}</Tab.Screen>
```

with:

```tsx
      <Tab.Screen name="Sizes" component={MySizesScreen} />
```

- [ ] **Step 3: Verify**

Run:
```
npx tsc --noEmit
```
Expected: no output.

Manual check in Expo Go: Sizes tab shows a 2×3 grid — Coats Blue·208, Vests Candy·204, Bibbers Blue·212, Pants Blue·208, Ties Blue·—, Belts Blue·— — plus the advisory note below it.

- [ ] **Step 4: Commit**

```bash
git add mobile-app/screens/member/MySizesScreen.tsx mobile-app/screens/MemberTabs.tsx
git commit -m "Add My Sizes screen

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 8: Flag Item + My Inventory screens (full flow)

**Files:**
- Create: `mobile-app/screens/member/FlagItemScreen.tsx`
- Create: `mobile-app/screens/member/MyInventoryScreen.tsx`
- Modify: `mobile-app/navigation/types.ts`
- Modify: `mobile-app/screens/MemberTabs.tsx`
- Modify: `mobile-app/App.tsx`

**Interfaces:**
- Consumes: `useFlags()` (Task 3); `MY_UNIFORM`, `MY_MEMBER_NAME` (Task 2); `FlagStatus` type (Task 2).
- Produces: `FlagItemScreen` — props `NativeStackScreenProps<RootStackParamList, 'FlagItem'>`, route params `{ piece: string; color: string; size: string }`. `MyInventoryScreen` — props combining the `Inventory` tab screen props with the root stack's navigation (needed because it navigates to `FlagItem`, a root-stack screen, from inside the tab navigator).

- [ ] **Step 1: Add `FlagItem` to the navigation types**

In `mobile-app/navigation/types.ts`, change:

```ts
export type RootStackParamList = {
  SignUp: undefined;
  MainTabs: UserParams;
  MemberTabs: UserParams;
  Profile: UserParams;
  MemberAccount: UserParams;
};
```

to:

```ts
export type RootStackParamList = {
  SignUp: undefined;
  MainTabs: UserParams;
  MemberTabs: UserParams;
  Profile: UserParams;
  MemberAccount: UserParams;
  FlagItem: { piece: string; color: string; size: string };
};
```

- [ ] **Step 2: Create `screens/member/FlagItemScreen.tsx`**

```tsx
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { colors } from '../../constants/colors';
import { fonts } from '../../constants/fonts';
import { useFlags } from '../../context/FlagsContext';
import type { FlagStatus } from '../../constants/flagsData';
import { MY_MEMBER_NAME } from '../../constants/myUniformData';

type Props = NativeStackScreenProps<RootStackParamList, 'FlagItem'>;

export default function FlagItemScreen({ navigation, route }: Props) {
  const { piece, color, size } = route.params;
  const { flags, addFlag, updateFlag } = useFlags();
  const existingFlag = flags.find((f) => f.memberName === MY_MEMBER_NAME && f.piece === piece);

  const [status, setStatus] = useState<FlagStatus>(existingFlag?.status ?? 'dirty');
  const [comment, setComment] = useState(existingFlag?.comment ?? '');

  const handleSubmit = () => {
    if (existingFlag) {
      updateFlag(existingFlag.id, status, comment);
    } else {
      addFlag({
        id: `${MY_MEMBER_NAME}-${piece}`,
        memberName: MY_MEMBER_NAME,
        piece,
        color,
        size,
        status,
        comment,
      });
    }
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flexOne}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <Pressable style={styles.headerSideButton} onPress={() => navigation.goBack()}>
              <Text style={styles.closeIcon}>✕</Text>
            </Pressable>
            <Text style={styles.pageTitle}>Flag item</Text>
            <View style={styles.headerSideButton} />
          </View>

          <View style={styles.pieceCard}>
            <Text style={styles.pieceName}>{piece}</Text>
            <Text style={styles.pieceSub}>
              {color} · {size}
            </Text>
          </View>

          <Text style={styles.fieldLabel}>What's wrong with it?</Text>
          <View style={styles.segmented}>
            {(['dirty', 'repair'] as FlagStatus[]).map((option, index) => {
              const active = status === option;
              return (
                <Pressable
                  key={option}
                  style={[
                    styles.segment,
                    active && styles.segmentActive,
                    index === 0 && styles.segmentBorderRight,
                  ]}
                  onPress={() => setStatus(option)}
                >
                  <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                    {option === 'dirty' ? 'Dirty' : 'Needs repair'}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.fieldLabel}>Comment</Text>
          <TextInput
            style={styles.commentInput}
            placeholder="Describe what's wrong — a staff member will see this."
            placeholderTextColor={colors.inkFaint}
            value={comment}
            onChangeText={setComment}
            multiline
          />
          <Text style={styles.hint}>This will show up on your profile in the staff view.</Text>
        </View>

        <View style={styles.footer}>
          <Pressable style={styles.submitButton} onPress={handleSubmit}>
            <Text style={styles.submitButtonText}>Submit flag</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  flexOne: { flex: 1 },
  content: { flex: 1, paddingTop: 16, paddingHorizontal: 18 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
  },
  headerSideButton: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  closeIcon: { fontSize: 18, color: colors.ink },
  pageTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fonts.wordmark,
    fontSize: 18,
    color: colors.ink,
  },
  pieceCard: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    padding: 14,
    marginBottom: 20,
  },
  pieceName: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.ink },
  pieceSub: { fontFamily: fonts.body, fontSize: 12, color: colors.inkSoft, marginTop: 2 },
  fieldLabel: { fontFamily: fonts.body, fontSize: 11.5, color: colors.inkSoft, marginBottom: 7 },
  segmented: { flexDirection: 'row', borderWidth: 1, borderColor: colors.ink, marginBottom: 20 },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    backgroundColor: colors.surface,
  },
  segmentBorderRight: { borderRightWidth: 1, borderRightColor: colors.ink },
  segmentActive: { backgroundColor: colors.wash },
  segmentText: { fontFamily: fonts.bodyMedium, fontSize: 13.5, color: colors.ink },
  segmentTextActive: { color: colors.paper },
  commentInput: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    padding: 13,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.ink,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 8,
  },
  hint: { fontFamily: fonts.body, fontSize: 11, color: colors.inkFaint },
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.surface,
    padding: 18,
  },
  submitButton: { backgroundColor: colors.wash, paddingVertical: 14, alignItems: 'center' },
  submitButtonText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.paper },
});
```

- [ ] **Step 3: Create `screens/member/MyInventoryScreen.tsx`**

```tsx
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MemberTabParamList, RootStackParamList } from '../../navigation/types';
import { colors } from '../../constants/colors';
import { fonts } from '../../constants/fonts';
import { MY_UNIFORM, MY_MEMBER_NAME } from '../../constants/myUniformData';
import { useFlags } from '../../context/FlagsContext';
import TapeGutter from '../../components/TapeGutter';
import { SmallChevronRightIcon } from '../../components/icons';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MemberTabParamList, 'Inventory'>,
  NativeStackScreenProps<RootStackParamList>
>;

export default function MyInventoryScreen({ navigation }: Props) {
  const { flags } = useFlags();

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.appBody}>
        <TapeGutter />
        <ScrollView style={styles.flexOne} contentContainerStyle={styles.content}>
          <Text style={styles.title}>My inventory</Text>
          <Text style={styles.subtitle}>Tap a piece to flag it as dirty or needing repair.</Text>

          {MY_UNIFORM.map((slot) => {
            const flag = flags.find(
              (f) => f.memberName === MY_MEMBER_NAME && f.piece === slot.piece
            );
            const statusColor = flag
              ? flag.status === 'repair'
                ? colors.rust
                : colors.wash
              : colors.inkSoft;
            const statusLabel = flag ? (flag.status === 'repair' ? 'Repair' : 'Dirty') : 'Good';

            return (
              <View key={slot.piece} style={styles.itemGroup}>
                <Pressable
                  style={styles.row}
                  onPress={() =>
                    navigation.navigate('FlagItem', {
                      piece: slot.piece,
                      color: slot.color,
                      size: slot.size,
                    })
                  }
                >
                  <View>
                    <Text style={styles.pieceName}>{slot.piece}</Text>
                    <Text style={styles.pieceSub}>
                      {slot.color} · {slot.size}
                    </Text>
                  </View>
                  <View style={styles.rowRight}>
                    <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
                    <SmallChevronRightIcon color={colors.inkFaint} size={14} strokeWidth={1.8} />
                  </View>
                </Pressable>
                {flag && flag.comment !== '' && (
                  <View style={styles.commentBanner}>
                    <Text style={styles.commentText}>You flagged this — {flag.comment}</Text>
                    <Pressable
                      onPress={() =>
                        navigation.navigate('FlagItem', {
                          piece: slot.piece,
                          color: slot.color,
                          size: slot.size,
                        })
                      }
                    >
                      <Text style={styles.editLink}>Edit</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  flexOne: { flex: 1 },
  appBody: { flex: 1, flexDirection: 'row' },
  content: { padding: 18, paddingBottom: 28 },
  title: { fontFamily: fonts.wordmark, fontSize: 24, color: colors.ink, marginBottom: 8 },
  subtitle: { fontFamily: fonts.body, fontSize: 12.5, color: colors.inkSoft, marginBottom: 20 },
  itemGroup: { marginBottom: 12 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    padding: 14,
  },
  pieceName: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.ink },
  pieceSub: { fontFamily: fonts.body, fontSize: 12, color: colors.inkSoft, marginTop: 2 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusText: { fontFamily: fonts.bodyMedium, fontSize: 13 },
  commentBanner: {
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: colors.line,
    backgroundColor: colors.washTint,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  commentText: { flex: 1, fontFamily: fonts.body, fontSize: 12, color: colors.wash },
  editLink: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.wash,
    textDecorationLine: 'underline',
  },
});
```

`MyInventoryScreen` uses `CompositeScreenProps` (rather than the render-prop-callback pattern `GameDayScreen` uses) because it needs to call `navigation.navigate('FlagItem', {...})` with different params from multiple places (each row, each "Edit" link) — a single callback prop can't parameterize that cleanly. React Navigation already resolves `'FlagItem'` at runtime by walking up to the parent stack navigator automatically; `CompositeScreenProps` only exists to make that call type-check.

- [ ] **Step 4: Wire both screens into `MemberTabs.tsx`**

Add the imports:

```tsx
import MyInventoryScreen from './member/MyInventoryScreen';
```

Replace:

```tsx
      <Tab.Screen name="Inventory">{() => <PlaceholderScreen title="Inventory" />}</Tab.Screen>
```

with:

```tsx
      <Tab.Screen name="Inventory" component={MyInventoryScreen} />
```

`PlaceholderScreen` is no longer imported by this file at this point — remove `import PlaceholderScreen from './PlaceholderScreen';` since all three tabs now use real screens.

- [ ] **Step 5: Register `FlagItem` in `App.tsx`**

Add the import below `import MemberAccountScreen from './screens/member/MemberAccountScreen';`:

```tsx
import FlagItemScreen from './screens/member/FlagItemScreen';
```

Add the screen registration below the `MemberAccount` line:

```tsx
            <Stack.Screen name="FlagItem" component={FlagItemScreen} options={{ headerShown: false }} />
```

- [ ] **Step 6: Verify — full acceptance pass**

Run:
```
npx tsc --noEmit
```
Expected: no output.

Run:
```
$env:CI = "1"
npx expo-doctor
```
Expected: all checks pass.

Manual check in Expo Go, following the spec's acceptance criteria exactly:
1. Sign up as Member → lands on Game Day.
2. Game Day shows the Lincoln High game with correct Pre-game/Halftime combos and component chips.
3. Sizes tab shows Maya Chen's 6 pieces read-only.
4. Inventory tab shows **Coats** as "Dirty" (pre-seeded) with its comment banner (empty comment, so no banner shows yet — that's expected since the seed `Flag`'s `comment` is `''`), and the other 5 pieces as "Good".
5. Tap a "Good" piece (e.g. Vests) → Flag item → submit "Needs repair" with a comment → back on My Inventory, that piece now shows "Repair" with the comment banner visible.
6. Log out (avatar → Account → Log Out), sign back up as **Staff** (access code `1234`): open Sections, filter to that member's section — the row now shows the newly-flagged item. Open Inventory — that piece's "Repair · N" count increased by one and the summary line reflects it.
7. Force-close and reopen the app (or fully reload in Expo Go — not just Fast Refresh) → the new flag is still there (confirms `AsyncStorage` persistence from Task 3).

- [ ] **Step 7: Commit**

```bash
git add mobile-app/screens/member/FlagItemScreen.tsx mobile-app/screens/member/MyInventoryScreen.tsx mobile-app/navigation/types.ts mobile-app/screens/MemberTabs.tsx mobile-app/App.tsx
git commit -m "Add Flag Item and My Inventory screens, completing the Member view

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```
