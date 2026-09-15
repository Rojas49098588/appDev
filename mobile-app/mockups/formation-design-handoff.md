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
3. **Members (full list)** — search bar, two independent multi-select filter rows (Section, Uniform status), member rows with optional flag indicator line, "Past members" link near the result count
4. **Members (filtered)** — same list, opened via a flag button tap, with an active-filter banner showing what it's filtered by and a clear (×) action
5. **Member profile** — Information card (height, weight, email, phone), Assigned uniform (per-piece condition + flag comment where relevant), Total pieces (compact sizing reference grid), Account section (Promote to Staff / Demote to Member, Archive account)
6. **Past members** — archived accounts only: search, a count, rows showing name, last-known section, and archive date. No bottom nav — it's a step outside the active roster, not a primary destination
7. **Archived profile** — same layout as an active Member profile, but with an "Archived — [date]" banner, muted avatar, frozen Information/Sizes, and the Account section swapped to a single "Reactivate" action
8. **Edit game day** — Pre-game and Halftime combo pickers, plus a free-text "After-game instructions" field; saving pushes both the combo assignments and the instructions to every member's Game day tab

**Auth flow**

9. **Login** — email/password, "New to Formation? Create an account" link
10. **Invite code** — gates entry to sign-up; single code field + Continue, rotates yearly (see Data model notes)
11. **Sign up** — first/last name, instrument wheel picker, Member/Staff role toggle (segmented control); selecting Staff reveals a second "Staff code" field that Member doesn't need; pinned submit footer

**Member view** — deliberately scoped down to just what a member needs; no access to Sections, Catalogue, or other members' data

12. **Game day** — Pre-game and Halftime sections, each with a photo preview and a "Components" chip list sourced from a Catalogue combo, plus a read-only "After-game instructions" card (staff-authored free text, with a "Posted by / Updated" line) — see Data model notes below
13. **My sizes** — read-only version of the Total pieces grid, with a note that only staff can change sizes
14. **My inventory** — pieces grouped by type (Coats, Vests, Bibbers, Pants, Ties, Belts); tap a group to expand and see every color variant the member holds for that type (e.g. Coats → Blue 208, Red 208, Purple 208, Candy 208), tap any individual item to flag it. A group with a flagged item inside shows a small count on its collapsed header so nothing gets missed unexpanded
15. **Flag item** — Dirty/Needs repair segmented toggle + comment box + submit footer; this is what writes the flag that shows up on the member's profile in the staff view

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

### Profile permissions: a member's own view vs. staff looking at that same member

These are **not the same screen with different data** — the edit permissions flip depending on who's looking:

| Section | Member viewing their own profile | Staff viewing that member's profile |
|---|---|---|
| Information (height, weight, email, phone) | **Editable** — self-reported, member keeps it current | Read-only |
| Sizes / assigned pieces | Read-only (member can flag a piece as Dirty/Needs repair + comment, but can't change the size or reassign a piece) | **Editable** — staff assign this based on an actual fitting |
| Account (role, archive status) | **Not shown at all** — a member should never see controls to change their own role or archive their own account | **Editable** — Promote to Staff / Demote to Member, Archive account |
| Name, section/instrument, flag records | Same on both — same underlying record, not a copy | Same on both |

The member-side "My profile" screen (where the member edits their own Information block) hasn't been mocked up yet — it doesn't exist as a separate screen currently, only as a read-only sub-section of the staff-side Member profile. Build it as its own screen: editable Information card, no Account section, sizes shown read-only (reuse the My Sizes layout).

## Data model notes

**Flags travel from member → staff.** When a member submits a flag (Dirty / Needs repair + comment) from their Inventory screen, that's not a separate member-only record — it's the *same* flag that appears on their profile in the staff view. One flag record per assigned piece (status + comment + who/when), read by both views, written only by the member who owns the piece (or by staff, for cases they catch themselves).

**A member owns one item per color variant of a piece type, not one item per type.** Maya holds four coats (Blue/Red/Purple/Candy — one per Catalogue color she might need for a combo), not just one. Size stays constant across colors for the same person (all four coats are 208), so the shape is closer to `assignedPieces: { pieceType, color, size, memberId }[]`, grouped by `pieceType` for display, rather than one row per piece type on the member record. Flags attach to a specific `(pieceType, color)` combination, not to the type as a whole — Maya's Blue coat can be dirty while her Red, Purple, and Candy coats stay Good.

**Catalogue combos are the single source of truth for game-day outfits.** Rather than each game having its own manually-uploaded photo and component list:
- Each catalogue combo (the ones in the Catalogue carousel/grid) stores its own photo and component list, once.
- Assigning a game's Pre-game or Halftime look is just picking a combo ID — nothing else about the outfit is duplicated per-game. Staff do this from the **Edit game day** screen (not yet in the earlier list — added below), which has a combo picker for Pre-game and Halftime that presumably opens the Catalogue to choose from.
- The member's Game Day screen just reads whatever that combo currently has. If staff later update a combo's photo or swap a component, every game referencing it (past and future) reflects the change automatically — no per-game re-entry.
- Suggested shape: a `games` table/collection with `preGameComboId` and `halftimeComboId` foreign keys into a `combos` table (which holds `photoUrl` and a `components` list), rather than storing photo/component data directly on the game record.

**After-game instructions are staff-authored free text, one per game, pushed to every member.** Written on the same Edit game day screen (a plain textarea below the two combo pickers), stored as a field on the `games` record (e.g. `afterGameInstructions: string`, plus who/when it was last edited for the "Posted by / Updated" line shown on the member side). It is not tied to a specific combo — it applies to the game as a whole, since it's about what to do with pieces afterward regardless of which combo was worn when. There's no per-member customization; every member assigned to that game sees the same text.

## Accounts, roles, and archiving

**Sign-up is gated by an invite code**, entered on its own screen before the sign-up form. The code is meant to rotate — plan on it changing at the start of each academic year (config value staff can update, not a hardcoded constant) rather than staying fixed indefinitely.

**Staff accounts need a second code.** On the sign-up form, selecting the Staff segment reveals an additional "Staff code" field that Member doesn't require. This is a lower bar than real access control — it stops casual mis-signups, not a determined bad actor — so treat it as a first pass, not the final security model. Same rotate-yearly logic likely applies here too.

**Roles change in place — accounts are not recreated each year.** A staff member's profile has a Role control (Promote to Staff / Demote to Member) so someone moving from member to staff (or the reverse) keeps their existing account, history, and flags rather than signing up again.

**Archiving replaces deleting.** When someone graduates or leaves, staff use "Archive account" instead of removing them:
- Archiving **revokes login** — the person can no longer sign in.
- The account moves out of the active roster (out of Home's member count, Members list, section counts) and into a separate **Past members** area.
- The archived profile keeps showing their info as of the moment they were archived — sizes, assigned pieces, contact info — not whatever those fields currently hold for the org.

**This last point has a real data-modeling implication, not just a UI one.** If "assigned pieces" is one live table keyed by piece ID, and someone's old coat gets reassigned to a new member next season, an archived profile that just queries "pieces assigned to this person" would break — either showing nothing (the assignment record changed owner) or, worse, silently updating if the piece record itself gets edited. **The fix is to snapshot the relevant fields into the archive record at the moment "Archive account" is pressed** — copy the current size/piece/contact values onto the archived record itself, rather than leaving the archived profile pointing at live, mutable data. Reactivating would presumably restore someone to active status but does *not* need to un-snapshot anything — their sizes may well be out of date by then anyway and would get re-fitted.
