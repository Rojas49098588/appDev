# Formation — design handoff (for the Expo/React Native build)

These mockups were built as static HTML/CSS to work out the visual direction quickly. They are **not** meant to be copied into the app as-is — Expo/React Native has no DOM, no CSS files, and no web fonts loaded via `<link>`. This doc translates the design into tokens and patterns your React Native code can implement directly with `View` / `Text` / `StyleSheet` (or a styling lib like NativeWind, if you're using one).

Attach this file, the five `.html` mockups, and ideally a screenshot of each (open the file, screenshot it) when you prompt Claude Code — screenshots let it see layout/spacing at a glance, this doc gives it exact values so it doesn't have to guess them from a picture.

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
- Bottom tab bar: 4 tabs (Home, Sections, Catalogue, Inventory), icon + 9.5px label, active = `ink`, inactive = `ink-faint`

## Screens included

1. **Home** — stat grid, Members-by-section 3×3 grid, Catalogue horizontal-scroll carousel, Inventory preview list
2. **Inventory** — search bar, two-row multi-select filter chips (Section is on Members, not here — Inventory's row is just status: Good / Needs repair / Dirty / Retired), expandable piece cards with per-color size-chip strips, flag counts as tappable buttons (not inline per-size flags)
3. **Members (full list)** — search bar, two independent multi-select filter rows (Section, Uniform status), member rows with optional flag indicator line
4. **Members (filtered)** — same list, opened via a flag button tap, with an active-filter banner showing what it's filtered by and a clear (×) action
5. **Member profile** — Information card (height, weight, email, phone), Assigned uniform (per-piece condition + flag comment where relevant), Total pieces (compact sizing reference grid)

## Key interaction patterns to rebuild

- **Multi-select filter chips**: each chip toggles independently (not radio-style); colored chips (repair/dirty) keep their color when active instead of turning solid black — implement as local state, e.g. `Set<string>` of active chip ids per row
- **Expand/collapse piece cards**: tap row → reveal breakdown below, chevron rotates 180°
- **Horizontal scroll strips**: size-chip runs and the catalogue carousel — `ScrollView horizontal showsHorizontalScrollIndicator={false}`
- **Flag buttons → navigation**: tapping "Repair · 3" or "Dirty · 2" navigates to the Members list pre-filtered to that piece + flag type (pass params via your navigator, e.g. `router.push('/members?piece=Coats&status=dirty')` if using expo-router)
- **Icons**: currently plain inline SVG paths (chevrons, search, filter funnel, mail, phone) — port directly with `react-native-svg`, or swap for an icon set like `lucide-react-native` using the same stroke-width/size proportions (thin, ~1.6–1.8px stroke, no fill)

## Not part of the mockup

The phone bezel, notch, and status bar in the HTML files were only there to preview the screens in a browser — skip all of that; your actual app provides the real device chrome.
