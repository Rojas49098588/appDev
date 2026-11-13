# Accessibility: large text, readable colors, clear buttons, and a Settings screen

## Why

The user wants Mustang Closet to work for all kinds of users, members and staff. Testing with
the phone's largest **accessibility** text sizes showed screens breaking: on staff Home the block
buttons and the initials circle get pushed off the screen. The user also finds some text too small,
the light gray text hard to read, and the underlined text links easy to forget because they look
like plain text. Separately, the member flag sheet colors "Needs repair" blue, which reads as "Dirty".

## Goals

1. Every screen, staff and member, stays usable at the phone's largest accessibility text sizes:
   nothing goes off the screen or gets cut off.
2. Default text colors meet the WCAG AA readability guideline (4.5 : 1) for everyone.
3. Every tappable text link looks like a button and is easy to tap.
4. Each flag status has one color and one icon, used everywhere, so meaning never relies on color alone.
5. A Settings screen with a text-and-button **Size** slider, a **High contrast** toggle, and (staff) an
   **Expanded / Condensed** layout choice for Inventory and Recount.
6. Every screen can be used with a screen reader (VoiceOver on iPhone, TalkBack on Android): every
   control is announced with a clear name, its kind, and its state.

## Non-goals

- Dark mode.
- A separate color-blind mode (goal 4 covers it: the rust/blue pair is already safe, and icons back up every color).
- Changing the Supabase schema or anything server-side. Settings never leave the phone.

## Anti-goals (a failure even if it works)

- At normal text size and default settings, the app looks noticeably different beyond the changes
  agreed here (darker grays, outlined buttons, flag color/icon fixes, Expanded inventory).
- A layout that still clips or pushes something off-screen at the largest accessibility size.
- Any status shown by color alone.
- Losing the user's settings on logout.

## Agreed with the user

### 1. Large text layouts (option A)

The switch happens only when text is large; at normal sizes layouts stay as they are. "Text size" here
means the phone's text size multiplied by the in-app Size slider (section 5).

- **Title with a button or link beside it** (staff Home blocks "Members by section", "Inventory",
  "Games", "Archived members"; Home header next to the initials circle; Game Day title next to the
  initials circle; Inventory card headers; Sections, Games and similar headers): the button **drops
  under** the title. Titles are never broken across lines next to a button. The user chose this over
  "button stays right, title wraps" so broken-up text doesn't confuse readers.
- **Grids** (Home section cards, 3 across; Home stats, 2 across; member My Sizes, 2 across) become a
  **single list**, one item per row.
- **Rows with text on the left and a value on the right** (Home inventory list: name + colors on the left,
  count + condition on the right): the right side moves under the left instead of being pushed off.
- **Small fixed-width number boxes** on member Account and staff Profile (shoe size, height ft/in,
  weight; today 56–70 pt wide) grow with the text.
- **Game Day's two fact boxes side by side** stack on top of each other.

Builder audit list from the code scan (2026-11-12): rows with `justifyContent: 'space-between'` whose
left text has no `flex: 1`/`flexShrink`, fixed `width`/`height` on anything holding text, and fixed
`%` grids. The screens most affected: `HomeScreen`, `GameDayScreen`, `MemberAccountScreen`,
`ProfileScreen`, `MySizesScreen`, `PieceCard`, `SectionsScreen`, `GamesScreen`, `RecountScreen`.
`MyInventoryScreen` and `FlagSheet` already use min-heights and flex and should need little.

### 2. Darker default colors (for everyone)

Measured contrast on the app background `paper #E8E6E0` (and `surface #F6F5F1`):

| Color | Used for | Today on paper | Target |
|---|---|---|---|
| `inkFaint #9A9488` | hints, placeholders, small notes (86 uses) | 2.42 | ≥ 4.5 |
| `inkSoft #6E6960` | labels, subtitles (117 uses) | 4.37 | ≥ 4.5 |
| `amber #A36618` | warnings, out-for-repair | 3.76 | ≥ 4.5 |
| `rust #AC4A2E`, `wash #3F6E82`, `good #397257` | flag statuses | 4.46 / 4.47 / 4.52 | ≥ 4.5 with margin |

Darken each to at least 4.5 : 1 on `paper` (the darker of the two backgrounds), keeping the warm hue.
The light gray must stay visibly lighter than `inkSoft` so the hierarchy remains. A unit test checks
every text color against `paper`, `surface` and `white`.

### 3. Text links become compact outlined buttons

Every tappable text link becomes a small outlined button (the user chose this after seeing full-screen
mockups):

- **Standard size ("compact"):** about 28 pt tall, 12 pt semibold text, 1.25 pt dark (`ink`) border,
  rounded ends, fill = the background it sits on (`surface` on paper, `paper` on cards), so it blends in.
  The **tap area is padded to 44 × 44 pt** (hitSlop) even though it looks smaller.
- **Bigger sizes** (Size slider above Standard): grow toward the "regular" look (36 pt tall, 13.5 pt text)
  and beyond.
- **High contrast:** white fill and a 2 pt black border.

Known links to convert: Login **Show/Hide**, **Forgot password?**, **Create an account**; Forgot password
**Show**, **Send a new code**, **Use a different email**; staff Inventory card **See every {type} ›**,
**+ Add color**, **+ Add number**, **Recount**; offline banner **Retry**; photo permission notice links;
Recount **Change season totals**; Game edit links. One shared component should render all of them.
The staff Home block links ("See all ›", "View full ›", "View ›") **stay solid dark buttons**: they were
made solid on purpose on 2026-10-28 (`290e9da`) and already read as buttons.

### 4. Flag statuses: one color + one icon everywhere

| Status | Color | Icon |
|---|---|---|
| Needs repair | rust | wrench |
| Dirty | wash (blue) | water drop |
| Good | good (green) | check |

- **Member flag sheet** (`components/FlagSheet.tsx`): today both options turn teal when picked and the
  submit button is always blue "Submit flag". Instead the picked option takes **its own** color (rust
  tint + rust border for Needs repair, blue tint + blue border for Dirty), and the submit button takes the
  picked status's color and says what happens: **"Flag for repair"** (wrench) or **"Flag as dirty"** (drop).
  Before a status is picked it stays disabled as today.
- **Member My Inventory** status line: Dirty is **amber** today; make it **blue** to match the rest of the
  app, and put the status icon before the text ("✓ Good", "🔧 Flagged · Needs repair", "💧 Flagged · Dirty",
  using the app's own icons, not emoji).
- Anywhere else a status shows (staff chips, Home inventory list, piece history), the icon or the words
  must accompany the color.

### 5. Settings screen

- **Getting there:** a **Settings ›** row near the top of the staff **Profile** screen and the member
  **Account** screen opens a new stack screen, **Settings** (option A; the user rejected putting the
  settings inline on Account).
- **Text and buttons → Size:** a slider like Apple's Text Size, labeled Standard … Largest, with a live
  preview (a sample line of text and a sample outlined button) under it. It scales **text and buttons
  together** inside the app and **adds to** the phone's own text size.
- **Readability → High contrast:** off by default. On: grays become nearly black, outlined buttons get a
  white fill and thicker black border, input boxes and card borders get stronger.
- **Layout → Inventory and Recount:** Expanded / Condensed segmented control, **Expanded by default**.

### 6. Expanded and Condensed (staff Inventory and Recount)

- **Condensed** = today's layout.
- **Expanded, Inventory card open** (`PieceCard` breakdown for numbered types): each color is its own
  boxed section with more space; its numbers are split into rows **by hundreds** ("100–199", "200–299", …,
  with a small label above each row), and each row scrolls sideways on its own; bigger number chips.
  Counted types get the extra spacing only.
- **Expanded, Recount:** more space between sizes; bigger − / + buttons and count boxes; the batch row on
  its own lines, with the buttons reading **"Add 12" / "Remove 12"** (the current batch number).

### 7. Screen readers (added 2026-11-12 at the user's request)

Today about 56 of ~167 `Pressable`s carry an `accessibilityLabel` or `accessibilityRole`. In this round:

- **Every tappable element** has `accessibilityRole` (`button`, `link`, `tab`, `switch`, `adjustable`…)
  and, where its visible text doesn't say what it does, an `accessibilityLabel`. Icon-only buttons (back
  chevrons, photo remove ×, − / + steppers, the initials circle) always get a label, e.g. "Back",
  "Remove photo", "Decrease Small count", "Your profile".
- **State is announced** with `accessibilityState`: selected filter pills and segments (`selected`),
  toggles (`checked`), disabled buttons (`disabled`), expanded/collapsed Inventory cards (`expanded`).
- **Number chips** in Inventory read as one phrase, e.g. "Blue 104, assigned, needs repair"
  (number, assignment, open flag), not just "104".
- **Color swatches** are read as their color name ("Candy"); purely decorative parts (`TapeGutter`,
  divider lines, status dots next to words) are hidden from the screen reader.
- **Screen titles and section titles** use `accessibilityRole="header"` so users can jump between them.
- **The Size slider** is `adjustable`: swiping up/down moves one step and announces "Size, Larger".
- **Status messages** that appear without a tap (the toast after flagging, "Code sent", import results)
  are announced (`AccessibilityInfo.announceForAccessibility`).
- **Reading order** follows the visual order; when a button drops under its title (section 1) it's read
  after the title.

### 8. Already done

- Candy swatch is now red-and-white stripes like Purple's blue-and-red (`b82006c`).

## My calls (the user can override)

- **Slider steps:** 4 steps, Standard / Large / Larger / Largest = × 1.0 / 1.15 / 1.3 / 1.5 on top of the
  phone's text size. Buttons reach the "regular" 36 pt look at Large.
- **Settings are saved on the phone**, not the account: stored in AsyncStorage under their own key,
  **not** in `CACHE_KEYS`, because `clearAllCaches()` wipes those on logout. They load before the first
  screen renders (Login included) so someone who needs big text can log in. On a new phone they're set again.
- **The Layout setting is shown to staff only**; members never see Inventory or Recount.
- **Bottom tab labels** don't grow past about 1.3 × (iPhone apps keep tab bars fixed; the icons carry
  meaning). Everything else grows.
- **When layouts switch** (section 1): when the combined text scale passes about 1.35 ×; tune on a device.
- **Settings has no Save button**: changes apply immediately.
- **Hundreds grouping** uses the number's hundred (1–99 shows as "1–99"); a color with fewer than ~12
  numbers stays a single row even in Expanded.

## Left to the builder

- How text scale and colors reach every screen. The app uses static `StyleSheet.create` with
  `colors.*` imported in ~40 files, so High contrast and the Size slider need a settings context plus a
  way for styles to react (for example a `useTheme()` hook returning colors and a scale function,
  styles built with `useMemo`). Pick one approach and apply it everywhere rather than mixing.
- Exact darker color values (section 2), within the targets.
- Icons: reuse the existing `WrenchIcon` and `DropIcon`; add a check icon in `components/icons.tsx`.

## Testing

- Unit tests (pure code in `lib/`): contrast of every text color against each background (default and
  High contrast palettes), settings load/save with bad or missing data falling back to defaults, the
  hundreds grouping, and the layout-switch threshold.
- `npm test` passes; `npx expo export` bundles for iOS and Android.
- Device check at the **largest accessibility text size** on iOS (and Android if available), with the
  Size slider at Standard and at Largest: every staff and member screen, nothing clipped or off-screen.
- Device check of High contrast, Expanded/Condensed, the flag sheet colors, and that settings survive
  logout and app restart.
- Screen reader walk-through with VoiceOver (and TalkBack if available), eyes off the screen: log in;
  member flags a piece with a note; member changes white shirt size; member opens Game Day; staff opens
  an Inventory card and a number's history; staff recounts a counted type; anyone changes each setting.
  Every control must be announced with a sensible name, kind and state.
- A small unit-testable helper builds the chip phrase ("Blue 104, assigned, needs repair"); test it.
