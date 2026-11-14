# Accessibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Mustang Closet usable at the largest accessibility text sizes, readable for everyone, clear about what's tappable and what each flag means, adjustable from a new Settings screen, and usable with a screen reader.

**Architecture:** Pure logic (palettes, contrast math, size steps, settings parsing, number bands, status looks, screen-reader phrases) lives in `lib/` with node tests. A `SettingsProvider` loads settings from AsyncStorage before the first screen; `useTheme()` combines them with the phone's text scale into a `Theme`, and every screen builds its styles with `useThemedStyles(makeStyles)` instead of a module-level `StyleSheet.create`, so High contrast and the Size slider update live.

**Tech Stack:** Expo SDK 58, React Native 0.88, React 19, TypeScript, AsyncStorage 2.2, react-native-svg; Node's built-in test runner (`npm test`, `tests/*.test.ts`, imports use `.ts` extensions).

**Spec:** `docs/superpowers/specs/2026-11-12-accessibility-design.md`

## Global Constraints

- Work in `C:\dev\App Dev` on branch `accessibility`. Commands run from `mobile-app/`.
- Check https://docs.expo.dev/versions/v58.0.0/ before using any Expo API (`mobile-app/AGENTS.md`).
- No new npm dependencies (the Size slider is built in-house; there is no slider package).
- No database or Supabase changes.
- Text colors meet **≥ 4.5 : 1** on `paper`, `surface` and `white` in the default palette.
- Standard outlined button: **28 pt tall, 12 pt semibold text, 1.25 pt `ink` border**, fill = background it sits on; tap area padded to **44 × 44** with `hitSlop`.
- Size steps: **Standard / Large / Larger / Largest = × 1.0 / 1.15 / 1.3 / 1.5**, on top of the phone's text size.
- Layouts switch to their large-text form when phone text scale × app step **≥ 1.35**.
- Settings key **`mustang.settings`**, never in `CACHE_KEYS` (logout wipes those). Defaults: Standard, High contrast off, **Expanded**.
- Flag statuses: Needs repair = `rust` + `WrenchIcon`; Dirty = `wash` + `DropIcon`; Good = `good` + `CheckIcon`.
- Staff Home block links ("See all ›", "View full ›", "View ›") stay solid dark buttons.
- Bottom tab labels: `maxFontSizeMultiplier={1.3}`.
- `npm test` passes and `npx expo export --platform all --output-dir <temp>` bundles after every task.

## Review Focus

1. **Settings can't be read** (first launch, AsyncStorage throws, or a saved value from an older version with missing or odd fields): the app still opens with defaults for whatever is unreadable. Pinned in Task 1 (`loadSettings` rejects → defaults; per-field fallback).
2. **Numbers that aren't in neat hundreds** (leading zeros like `'085'`, numbers under 100, unsorted input, a color with only a few numbers): banding sorts numerically, puts `'85'`/`'085'` under "1–99", and short lists stay one row. Pinned in Task 8.
3. **Nothing picked yet on the flag sheet:** the submit button is neutral and disabled, not rust or blue. Pinned in Task 7 (`statusLook(null)`).
4. **Settings changed while a screen is open:** colors and sizes update without leaving the screen. Pinned in Task 1 (`makeTheme` returns a new palette/font for new settings) and checked on device in Task 10.
5. **A number chip with no flag, or a piece out for repair:** the spoken phrase still makes sense ("Blue 103, unassigned", "Blue 104, out for repair"). Pinned in Task 9.

---

### Task 1: Theme and settings core (pure)

**Files:**
- Create: `mobile-app/lib/settings.ts`, `mobile-app/lib/theme.ts`
- Modify: `mobile-app/constants/colors.ts` (becomes `export const colors = DEFAULT_PALETTE;` re-exported from `lib/theme.ts`, so not-yet-migrated files get the darker grays now)
- Test: `mobile-app/tests/settings.test.ts`, `mobile-app/tests/theme.test.ts`

**Interfaces:**
- Produces (`lib/settings.ts`):
  - `type SizeStep = 0 | 1 | 2 | 3`; `type Layout = 'expanded' | 'condensed'`
  - `type Settings = { sizeStep: SizeStep; highContrast: boolean; layout: Layout }`
  - `DEFAULT_SETTINGS: Settings = { sizeStep: 0, highContrast: false, layout: 'expanded' }`
  - `SETTINGS_KEY = 'mustang.settings'`
  - `parseSettings(raw: string | null): Settings` (each bad or missing field falls back on its own)
  - `serializeSettings(s: Settings): string`
  - `loadSettings(getItem: (key: string) => Promise<string | null>): Promise<Settings>` (never rejects)
- Produces (`lib/theme.ts`):
  - `type Palette` = exactly today's keys of `colors` (`paper … mint`)
  - `DEFAULT_PALETTE`, `HIGH_CONTRAST_PALETTE: Palette`
  - `TEXT_COLOR_KEYS = ['ink','inkSoft','inkFaint','rust','wash','good','amber','tealDark'] as const`
  - `contrastRatio(fg: string, bg: string): number` (WCAG relative luminance)
  - `SIZE_STEPS = [1, 1.15, 1.3, 1.5] as const`; `SIZE_STEP_NAMES = ['Standard','Large','Larger','Largest'] as const`
  - `LARGE_TEXT_THRESHOLD = 1.35`; `isLargeText(systemFontScale: number, step: SizeStep): boolean`
  - `type OutlineMetrics = { minHeight: number; fontSize: number; paddingHorizontal: number; borderWidth: number; borderRadius: number }`
  - `outlineButtonMetrics(step: SizeStep, highContrast: boolean): OutlineMetrics`
  - `type Theme = { colors: Palette; font: (size: number) => number; isLarge: boolean; highContrast: boolean; expanded: boolean; sizeStep: SizeStep; button: OutlineMetrics }`
  - `makeTheme(settings: Settings, systemFontScale: number): Theme`

- [ ] **Step 1: Write the failing tests**

`tests/settings.test.ts`:
- `parseSettings(null)`, `parseSettings('not json')`, `parseSettings('[]')` each deep-equal `DEFAULT_SETTINGS`.
- `parseSettings('{"sizeStep":2,"highContrast":true}')` → `{ sizeStep: 2, highContrast: true, layout: 'expanded' }`.
- `parseSettings('{"sizeStep":5,"highContrast":"yes","layout":"tiny"}')` → `DEFAULT_SETTINGS`.
- round trip: `parseSettings(serializeSettings({ sizeStep: 3, highContrast: true, layout: 'condensed' }))` equals the input.
- `await loadSettings(() => Promise.reject(new Error('disk')))` deep-equals `DEFAULT_SETTINGS`; `await loadSettings(async () => '{"layout":"condensed"}')` has `layout: 'condensed'`.
- `SETTINGS_KEY.startsWith('mustang.cache.')` is `false`.

`tests/theme.test.ts`:
- `contrastRatio('#000000', '#FFFFFF')` ≈ 21 (to 2 decimals); `contrastRatio('#22201D', '#E8E6E0')` ≈ 13.02.
- for each key in `TEXT_COLOR_KEYS` and each of `paper`, `surface`, `white`: `contrastRatio(DEFAULT_PALETTE[key], DEFAULT_PALETTE[bg]) >= 4.5`.
- hierarchy kept: luminance order `inkFaint` lighter than `inkSoft` lighter than `ink` (compare `contrastRatio(x, paper)`: ink > inkSoft > inkFaint).
- `HIGH_CONTRAST_PALETTE.inkSoft` and `.inkFaint` are ≥ 7 : 1 on `paper`.
- `isLargeText(1, 0) === false`, `isLargeText(1.2, 1) === true` (1.38), `isLargeText(1.35, 0) === true`, `isLargeText(1.3, 0) === false`.
- `outlineButtonMetrics(0, false)` deep-equals `{ minHeight: 28, fontSize: 12, paddingHorizontal: 10, borderWidth: 1.25, borderRadius: 14 }`.
- `outlineButtonMetrics(1, false)` deep-equals `{ minHeight: 36, fontSize: 13.5, paddingHorizontal: 14, borderWidth: 1.5, borderRadius: 18 }`.
- `outlineButtonMetrics(3, false)` deep-equals `{ minHeight: 47, fontSize: 17.6, paddingHorizontal: 18, borderWidth: 1.5, borderRadius: 23.5 }` (step ≥ 1 scales the Large values by `SIZE_STEPS[step] / 1.15`; height and padding rounded to whole points, font to 1 decimal).
- `outlineButtonMetrics(0, true).borderWidth === 2`.
- `makeTheme({ ...DEFAULT_SETTINGS, sizeStep: 3 }, 1).font(12) === 18`; `makeTheme(DEFAULT_SETTINGS, 1).colors === DEFAULT_PALETTE`; with `highContrast: true` → `HIGH_CONTRAST_PALETTE`; `expanded` follows `layout`.

- [ ] **Step 2: Run** `npm test` — Expected: the two new files fail (modules not found).

- [ ] **Step 3: Implement `lib/settings.ts` and `lib/theme.ts`**

Darker default values are the builder's choice within the tests (keep each hue; spec §2). High contrast: `inkSoft`/`inkFaint` near-black, `line`/`lineSoft` noticeably darker (spec §5); all other keys as default. `lib/theme.ts` imports types from `./settings.ts`. Point `constants/colors.ts` at `DEFAULT_PALETTE`.

- [ ] **Step 4: Run** `npm test` — Expected: all pass.

- [ ] **Step 5: Commit** `git commit -m "Theme and settings core: darker default grays, high contrast palette, size steps"`

---

### Task 2: SettingsProvider, useTheme, app wiring

**Files:**
- Create: `mobile-app/context/SettingsContext.tsx`, `mobile-app/hooks/useTheme.ts`
- Modify: `mobile-app/App.tsx` (wrap everything inside `SafeAreaProvider` with `SettingsProvider`; splash stays up until settings and fonts are loaded)

**Interfaces:**
- Consumes: Task 1 `loadSettings`, `serializeSettings`, `SETTINGS_KEY`, `makeTheme`, `Settings`, `Theme`.
- Produces:
  - `SettingsProvider({ children })`: renders `null` until `loadSettings(AsyncStorage.getItem)` resolves.
  - `useSettings(): { settings: Settings; updateSettings: (patch: Partial<Settings>) => void }` — updates state immediately, then writes `serializeSettings` to `SETTINGS_KEY` (write errors logged with `console.warn`, never thrown).
  - `useTheme(): Theme` — `makeTheme(settings, useWindowDimensions().fontScale)`, memoized on those two.
  - `useThemedStyles<T>(make: (t: Theme) => T): T` — `useMemo(() => make(theme), [make, theme])`; `make` is a module-level function.

- [ ] **Step 1: Implement the three pieces above.** No new pure logic, so no new unit test.
- [ ] **Step 2: Verify** `npx tsc --noEmit` shows no errors in the new or changed files (the 14 existing `ScrollView` ref errors are known), `npm test` passes, `npx expo export --platform all --output-dir "$TEMP/a11y-export"` bundles.
- [ ] **Step 3: Commit** `git commit -m "SettingsProvider and useTheme: settings load before the first screen"`

---

### Task 3: Move member, auth and shared screens onto the theme

**Files (modify):** `components/` — ChangePasswordSection, EditFlagSheet, FlagSheet, InstrumentWheel, KeyboardDoneBar, OfflineBanner, PhotoPermissionNotice, PhotoViewer, SegmentTabs, Swatch, TapeGutter, WhiteShirtChoice; `screens/` — LoginScreen, InviteCodeScreen, SignUpScreen, ForgotPasswordScreen, MemberTabs; `screens/member/` — FlagItemScreen, GameDayScreen, MemberAccountScreen, MyInventoryScreen, MySizesScreen.

**Interfaces:**
- Consumes: Task 2 `useTheme`, `useThemedStyles`, `Theme`.
- Pattern for every file: `const styles = StyleSheet.create({...})` at module level becomes `function makeStyles(t: Theme) { return StyleSheet.create({...}) }`; components call `const styles = useThemedStyles(makeStyles)`; every `colors.x` → `t.colors.x` (inline uses → `useTheme().colors.x`); every `fontSize: n` → `fontSize: t.font(n)` and `lineHeight: n` → `lineHeight: t.font(n)`. Layout values (padding, widths) are not scaled here. `MemberTabs` tab labels get `maxFontSizeMultiplier={1.3}`.

- [ ] **Step 1: Convert the files listed above.** Visual result at Standard + High contrast off must be identical to before apart from the darker grays.
- [ ] **Step 2: Verify** `grep -l "constants/colors" <listed files>` prints nothing; `npm test`; `npx expo export` bundles.
- [ ] **Step 3: Commit** `git commit -m "Member, auth and shared screens use the theme"`

---

### Task 4: Move staff screens onto the theme; guard test

**Files (modify):** `App.tsx`; `components/` — AddColorSheet, AddInventorySheet, AddNumberSheet, ComboPickerSheet, MemberRow, PieceCard; `screens/` — AddComboScreen, AddPieceTypeScreen, ArchivedMemberScreen, ArchivedMembersScreen, CatalogueScreen, ComboDetailScreen, GameEditScreen, GamesScreen, HomeScreen, ImportInventoryScreen, InventoryScreen, MainTabs, MemberProfileScreen, PieceHistoryScreen, PieceTableScreen, PoloColorsScreen, ProfileScreen, RecountScreen, SectionsScreen.
- Test: `mobile-app/tests/themeUsage.test.ts`

**Interfaces:** same pattern as Task 3. `MainTabs` labels get `maxFontSizeMultiplier={1.3}`.

- [ ] **Step 1: Write the failing guard test** `no screen or component imports constants/colors`: read every `.tsx` under `screens/` (recursively), `components/`, and `App.tsx` with `fs`; assert none contains `constants/colors`. (`spikes/` is exempt.)
- [ ] **Step 2: Run** `npm test` — Expected: FAIL listing the staff files.
- [ ] **Step 3: Convert the listed files** (pattern from Task 3).
- [ ] **Step 4: Run** `npm test` — PASS; `npx expo export` bundles.
- [ ] **Step 5: Commit** `git commit -m "Staff screens use the theme; guard against static colors"`

---

### Task 5: Settings screen and Size slider

**Files:**
- Create: `mobile-app/screens/SettingsScreen.tsx`, `mobile-app/components/StepSlider.tsx`
- Modify: `navigation/types.ts` (`Settings: undefined`), `App.tsx` (register, `headerShown: false`), `screens/ProfileScreen.tsx` and `screens/member/MemberAccountScreen.tsx` (a **"Settings ›"** row near the top, hint "Text size, contrast, view")

**Interfaces:**
- Consumes: `useSettings`, `useTheme`, `SIZE_STEP_NAMES`. (`OutlineButton` arrives in Task 6; until then the preview's sample button is styled directly from `theme.button`, and Task 6 swaps it for `OutlineButton`.)
- Produces: `StepSlider({ value, steps, onChange, label }: { value: number; steps: readonly string[]; onChange: (v: number) => void; label: string })` — a track with one tappable stop per step, small "A" / large "A" at the ends, names under the ends; `accessibilityRole="adjustable"`, `accessibilityValue={{ text: steps[value] }}`, `accessibilityActions` increment/decrement.

Screen content (spec §5): sections **TEXT AND BUTTONS** (Size slider + hint "Makes text and buttons bigger in Mustang Closet. Adds to your phone's own text size." + live preview), **READABILITY** (High contrast `Switch`, hint "Darker text, white buttons, stronger borders."), **LAYOUT** (Expanded / Condensed using `SegmentTabs` or two pressables; hint for staff "Inventory and Recount", for members "White shirt size and My Sizes"). Changes apply immediately; no Save button. Back chevron like `InviteCodeScreen`.

- [ ] **Step 1: Build the screen, slider, route and the two "Settings ›" rows.**
- [ ] **Step 2: Verify** `npm test`; `npx expo export` bundles; on a phone (`npm run start:test`) each setting changes the screen behind it live and survives logout + app restart.
- [ ] **Step 3: Commit** `git commit -m "Settings screen: size slider, high contrast, expanded/condensed"`

---

### Task 6: Outlined buttons replace text links

**Files:**
- Create: `mobile-app/components/OutlineButton.tsx`
- Modify: SettingsScreen (preview button), LoginScreen (Show/Hide, Forgot password?, Create an account), ForgotPasswordScreen (Show/Hide, Send a new code, Use a different email), PieceCard (See every {type} ›, + Add color, + Add number, Recount), OfflineBanner (Retry), PhotoPermissionNotice (its links), RecountScreen (Change season totals, batch actions), GameEditScreen (Edit colors and other text links), and any other `textDecorationLine: 'underline'` or text-only `Pressable` found by `grep -rn "textDecorationLine: 'underline'" screens components`.

**Interfaces:**
- Consumes: `useTheme().button` (`OutlineMetrics`), `useTheme().colors`, `highContrast`.
- Produces: `OutlineButton({ label, onPress, onSurface, disabled, accessibilityLabel }: { label: string; onPress: () => void; onSurface?: boolean; disabled?: boolean; accessibilityLabel?: string })` — fill `white` in High contrast, else `paper` when `onSurface` (inside a card) and `surface` otherwise; border `ink` (black in High contrast); `hitSlop` so the tap area is at least 44 × 44; `accessibilityRole="button"`; label may wrap (no `numberOfLines`).

- [ ] **Step 1: Build `OutlineButton` and convert every link listed.** Staff Home block links stay as they are.
- [ ] **Step 2: Verify** `grep -rn "textDecorationLine: 'underline'" screens components` prints nothing; `npm test`; `npx expo export` bundles.
- [ ] **Step 3: Commit** `git commit -m "Text links become outlined buttons"`

---

### Task 7: Flag status colors and icons

**Files:**
- Create: `mobile-app/lib/flagStatus.ts`, `mobile-app/components/StatusLabel.tsx`
- Modify: `components/FlagSheet.tsx`, `screens/member/MyInventoryScreen.tsx`, `screens/HomeScreen.tsx` (inventory list condition), `components/PieceCard.tsx` (Repair · n / Dirty · n buttons get their icons; number chips with an open flag show a 10 pt wrench or drop after the number, so the tint isn't the only cue), `screens/PieceHistoryScreen.tsx` (status rows use `StatusLabel`)
- Test: `mobile-app/tests/flagStatus.test.ts`

**Interfaces:**
- Produces:
  - `type StatusKey = 'repair' | 'dirty' | 'good'`
  - `type StatusLook = { colorKey: 'rust' | 'wash' | 'good'; tintKey: 'rustTint' | 'washTint' | null; icon: 'wrench' | 'drop' | 'check'; label: string; action: string | null }`
  - `statusLook(status: StatusKey): StatusLook` — repair `{ rust, rustTint, wrench, 'Needs repair', 'Flag for repair' }`; dirty `{ wash, washTint, drop, 'Dirty', 'Flag as dirty' }`; good `{ good, null, check, 'Good', null }`
  - `submitLook(status: 'repair' | 'dirty' | null): { colorKey: 'rust' | 'wash' | 'inkSoft'; label: string; disabled: boolean }` — repair → `{ rust, 'Flag for repair', false }`; dirty → `{ wash, 'Flag as dirty', false }`; null → `{ inkSoft, 'Submit flag', true }`
  - `StatusLabel({ status, prefix }: { status: StatusKey; prefix?: string })` — icon + text in the status color (e.g. prefix "Flagged · ").

- [ ] **Step 1: Write the failing test** asserting the three `statusLook` values and the three `submitLook` values above exactly.
- [ ] **Step 2: Run** `npm test` — FAIL (module not found).
- [ ] **Step 3: Implement** `lib/flagStatus.ts` and `StatusLabel`; in `FlagSheet` the picked option uses its own `colorKey` border + `tintKey` fill (teal no longer used there) and the submit button uses `submitLook` with its icon and label; in My Inventory the status line is `<StatusLabel>` ("Good" / "Flagged · Needs repair" / "Flagged · Dirty") so Dirty is blue, not amber; Home inventory condition and PieceCard Repair/Dirty buttons show their icons.
- [ ] **Step 4: Run** `npm test` — PASS; `npx expo export` bundles.
- [ ] **Step 5: Commit** `git commit -m "One color and icon per flag status; flag button says what it does"`

---

### Task 8: Large-text layouts and Expanded / Condensed

**Files:**
- Create: `mobile-app/components/TitleRow.tsx`, `mobile-app/lib/numberBands.ts`
- Modify: HomeScreen, GameDayScreen, SectionsScreen, GamesScreen, InventoryScreen, PieceCard, MemberAccountScreen, ProfileScreen, MySizesScreen, RecountScreen, WhiteShirtChoice (plus any other header row found with title + action)
- Test: `mobile-app/tests/numberBands.test.ts`

**Interfaces:**
- Consumes: `useTheme().isLarge`, `useTheme().expanded`.
- Produces:
  - `TitleRow({ title, action }: { title: ReactNode; action?: ReactNode })` — side by side normally; when `isLarge`, `action` renders **under** the title, left-aligned.
  - `type NumberBand = { label: string; numbers: string[] }`
  - `bandNumbers(numbers: string[]): NumberBand[]` — sort by numeric value; group by `Math.floor(n / 100)`; label `"${h*100}–${h*100+99}"`, except hundred 0 → `"1–99"`; if fewer than 12 numbers in total, return one band with label `''`. Keeps each number's original text.

Large-text behavior (when `isLarge`, spec §1): `TitleRow` for staff Home blocks + header avatar, Game Day title + avatar, Inventory card headers, Sections, Games; Home section grid and stats grid and My Sizes grid become one item per row; Home inventory rows put count + condition under the name; Member Account / Profile number boxes use `minWidth` instead of `width`; Game Day fact boxes stack.

Expanded behavior (when `expanded`, spec §6): PieceCard numbered breakdown — each color a boxed section, one sideways-scrolling row per `bandNumbers` band with its label above, chips 13 pt with 8 × 10 padding; Recount — rows 16 pt padding and 16 pt apart, steppers 40 × 40, count box 70 wide, batch controls on their own lines with buttons "Add {n}" / "Remove {n}"; WhiteShirtChoice — size chips 12 × 16 padding, 14 pt text, 10 pt gaps; My Sizes — full-width rectangles, label left, size right, one per row. Condensed = today.

- [ ] **Step 1: Write the failing tests** for `bandNumbers`:
  - 11 numbers `['101'..'111']` → one band, label `''`.
  - `['205','101','085','150','099','201','102','103','104','105','106','107']` → bands `[{ label: '1–99', numbers: ['085','099'] }, { label: '100–199', numbers: ['101','102','103','104','105','106','107','150'] }, { label: '200–299', numbers: ['201','205'] }]`.
- [ ] **Step 2: Run** `npm test` — FAIL.
- [ ] **Step 3: Implement** `bandNumbers`, `TitleRow`, and the large-text and Expanded behaviors listed above.
- [ ] **Step 4: Run** `npm test` — PASS; `npx expo export` bundles.
- [ ] **Step 5: Device check** with `npm run start:test`: at the phone's largest accessibility text size, Size slider at Standard and at Largest, open every staff and member screen — nothing clipped or off-screen; toggle Expanded/Condensed on Inventory, Recount, white shirt and My Sizes.
- [ ] **Step 6: Commit** `git commit -m "Large-text layouts and the Expanded view"`

---

### Task 9: Screen readers

**Files:**
- Create: `mobile-app/lib/a11y.ts`
- Modify: every file under `screens/` and `components/` with a `Pressable`, `Switch` or `TextInput` that lacks a role/label (167 `Pressable`s found 2026-11-12, 56 with a label or role)
- Test: `mobile-app/tests/a11y.test.ts`

**Interfaces:**
- Produces: `chipLabel(color: string, number: string, assignment: 'assigned' | 'unassigned' | 'out_for_repair', flag: 'repair' | 'dirty' | null): string`

- [ ] **Step 1: Write the failing tests**
  - `chipLabel('Blue','104','assigned','repair') === 'Blue 104, assigned, needs repair'`
  - `chipLabel('Blue','103','unassigned',null) === 'Blue 103, unassigned'`
  - `chipLabel('Blue','104','out_for_repair',null) === 'Blue 104, out for repair'`
  - `chipLabel('Red','7','assigned','dirty') === 'Red 7, assigned, dirty'`
  - Guard test `every Pressable has an accessibilityRole`: for each `.tsx` in `screens/` and `components/`, find each `<Pressable` and read its opening tag by scanning forward while tracking `{}` depth, ending at the first `>` at depth 0; assert the tag text contains `accessibilityRole`.
- [ ] **Step 2: Run** `npm test` — FAIL.
- [ ] **Step 3: Implement** `chipLabel` and the screen-reader pass from spec §7: roles on every `Pressable`; labels on icon-only buttons ("Back", "Remove photo", "Decrease {size} count", "Increase {size} count", "Your profile"); `accessibilityState` for selected pills/segments, the High contrast switch, disabled buttons, and expanded/collapsed Inventory cards; Inventory chips use `chipLabel`; swatches labeled with their color name; `TapeGutter`, dividers and dots next to words hidden (`accessible={false}` / `importantForAccessibility="no-hide-descendants"`); screen and section titles `accessibilityRole="header"`; toast after flagging, "Code sent" and import results announced with `AccessibilityInfo.announceForAccessibility`.
- [ ] **Step 4: Run** `npm test` — PASS; `npx expo export` bundles.
- [ ] **Step 5: Commit** `git commit -m "Screen reader labels, roles and states throughout"`

---

### Task 10: Docs and final check

**Files:**
- Modify: `CLAUDE.md` (a bullet under Data and backend → or a new "Accessibility" subsection: theme pattern `useThemedStyles(makeStyles)`, never import `constants/colors` in screens; settings key and defaults; `isLarge` threshold; `OutlineButton`; `statusLook`; `bandNumbers`; `chipLabel`; screen-reader rules), `features.md` (move accessibility to **Done** with date), `HANDOFF.md` if it lists screens.

- [ ] **Step 1: Update the docs above.**
- [ ] **Step 2: Final verification:** `npm test` all pass; `npx expo export --platform all` bundles; `npx expo-doctor`.
- [ ] **Step 3: Device walk-through** (`npm run start:test`): High contrast on and off on every screen; settings survive logout and app restart and apply on Login; VoiceOver (TalkBack if available) eyes-off: log in, flag a piece with a note, change white shirt size, open Game Day, open an Inventory card and a number's history, recount a counted type, change each setting.
- [ ] **Step 4: Commit** `git commit -m "Docs: accessibility"`
