# Formation — design handoff (for the Expo/React Native build)

These mockups were built as static HTML/CSS to work out the visual direction quickly. They are **not** meant to be copied into the app as-is — Expo/React Native has no DOM, no CSS files, and no web fonts loaded via `<link>`. This doc translates the design into tokens and patterns your React Native code can implement directly with `View` / `Text` / `StyleSheet` (or a styling lib like NativeWind, if you're using one).

Attach this file, the `.html` mockups, and ideally a screenshot of each (open the file, screenshot it) when you prompt Claude Code — screenshots let it see layout/spacing at a glance, this doc gives it exact values so it doesn't have to guess them from a picture.

## Concept

A tailor's tape measure doubling as a marching drill-chart yard line — a thin ruled gutter with tick marks runs down the left edge of every screen. It's the one distinctive visual device; everything else stays quiet and functional.

## Color tokens

```
paper      #E8E6E0   screen background
surface    #F6F5F1   card / row background
ink        #22201D   primary text, icons, active states
ink-soft   #6E6960   secondary text
ink-faint  #9A9488   tertiary text, inactive icons
line       #D2CDC2   hairline borders
line-soft  #DEDACF   lighter internal dividers
rust       #AC4A2E   "needs repair" flag color
rust-tint  #F1E1DA   repair flag background tint
wash       #3F6E82   "dirty / needs cleaning" flag color
wash-tint  #DDE6E7   dirty flag background tint
```

Rust and wash are the only accent colors, and both are reserved for meaning (flag states, active filter chips) — never used decoratively.

## Typography

| Role | Family | Notes |
|---|---|---|
| Wordmark, screen titles, section headers | **Space Grotesk** (weight 600) | |
| Body text, labels, member names | **IBM Plex Sans** (weights 400/500) | |
| Numbers: stats, sizes, quantities, tape ticks | **IBM Plex Mono** (weight 400/500) | tabular figures, used only where precision/measurement is the point |

For Expo: `@expo-google-fonts/space-grotesk`, `@expo-google-fonts/ibm-plex-sans`, `@expo-google-fonts/ibm-plex-mono`, loaded via `useFonts()`.

## Structural values

- Card / row border: `1px solid line`, no border-radius (square corners throughout — the one exception is avatars, which are circles)
- Card background: `surface` on `paper`
- Standard content padding: `16–18px` horizontal
- Bottom tab bar: icon + 9.5px label, active = `ink`, inactive = `ink-faint`. Staff view has 4 tabs (Home, Sections, Catalogue, Inventory); member view has 3 (Game day, Sizes, Inventory) — see "Two views" below

## Screens included

**Staff view**

1. **Home** — stat grid, Members-by-section 3×3 grid, Catalogue horizontal-scroll carousel, Inventory preview list
2. **Inventory** — search bar, multi-select status filter chips (Good / Needs repair / Dirty / Retired, each toggles independently), expandable piece cards with per-color size-chip strips, flag counts as tappable buttons (not inline per-size flags)
3. **Members (full list)** — search bar, two independent multi-select filter rows (Section, Uniform status), member rows with optional flag indicator line
4. **Members (filtered)** — same list, opened via a flag button tap, with an active-filter banner showing what it's filtered by and a clear (×) action
5. **Member profile** — Information card (height, weight, email, phone), Assigned uniform (per-piece condition + flag comment where relevant), Total pieces (compact sizing reference grid)
6. **Sign up** — first/last name, instrument wheel picker, Member/Staff role toggle (segmented control), pinned submit footer

**Member view** — deliberately scoped down to just what a member needs; no access to Sections, Catalogue, or other members' data

7. **Game day** — Pre-game and Halftime sections, each with a photo preview and a "Components" chip list, both sourced from a Catalogue combo (see Data model notes below)
8. **My sizes** — read-only version of the Total pieces grid, with a note that only staff can change sizes
9. **My inventory** — the member's own assigned pieces, tappable to flag one as Dirty or Needs repair
10. **Flag item** — Dirty/Needs repair segmented toggle + comment box + submit footer; this is what writes the flag that shows up on the member's profile in the staff view

## Key interaction patterns to rebuild

- **Multi-select filter chips**: each chip toggles independently (not radio-style); colored chips (repair/dirty) keep their color when active instead of turning solid black — implement as local state, e.g. `Set<string>` of active chip ids per row
- **Expand/collapse piece cards**: tap row → reveal breakdown below, chevron rotates 180°
- **Horizontal scroll strips**: size-chip runs and the catalogue carousel — `ScrollView horizontal showsHorizontalScrollIndicator={false}`
- **Flag buttons → navigation**: tapping "Repair · 3" or "Dirty · 2" navigates to the Members list pre-filtered to that piece + flag type (pass params via your navigator, e.g. `router.push('/members?piece=Coats&status=dirty')` if using expo-router)
- **Icons**: currently plain inline SVG paths (chevrons, search, filter funnel, mail, phone) — port directly with `react-native-svg`, or swap for an icon set like `lucide-react-native` using the same stroke-width/size proportions (thin, ~1.6–1.8px stroke, no fill)

## Not part of the mockup

The phone bezel, notch, and status bar in the HTML files were only there to preview the screens in a browser — skip all of that; your actual app provides the real device chrome.

## Two views: staff vs. member

Same design system, same component styles, two different permission scopes on one auth-gated app (the sign-up screen's Member/Staff toggle is what determines which one an account lands in):

- **Staff** can see everyone's profiles, the full inventory across all pieces/colors/sizes, and the catalogue.
- **Member** can only see their own sizes, their own assigned pieces (and flag/comment on them), and game-day outfit info. They cannot see other members, edit sizes, or edit the catalogue.

The two views should likely be separate navigator stacks (e.g. two route groups in expo-router) gated on the account's role, rather than one screen set with conditional rendering everywhere — cleaner to reason about and harder to accidentally leak staff-only data into the member bundle.

## Data model notes

**Flags travel from member → staff.** When a member submits a flag (Dirty / Needs repair + comment) from their Inventory screen, that's not a separate member-only record — it's the *same* flag that appears on their profile in the staff view. One flag record per assigned piece (status + comment + who/when), read by both views, written only by the member who owns the piece (or by staff, for cases they catch themselves).

**Catalogue combos are the single source of truth for game-day outfits.** Rather than each game having its own manually-uploaded photo and component list:
- Each catalogue combo (the ones in the Catalogue carousel/grid) stores its own photo and component list, once.
- Assigning a game's Pre-game or Halftime look is just picking a combo ID — nothing else about the outfit is duplicated per-game.
- The member's Game Day screen just reads whatever that combo currently has. If staff later update a combo's photo or swap a component, every game referencing it (past and future) reflects the change automatically — no per-game re-entry.
- Suggested shape: a `games` table/collection with `preGameComboId` and `halftimeComboId` foreign keys into a `combos` table (which holds `photoUrl` and a `components` list), rather than storing photo/component data directly on the game record.
