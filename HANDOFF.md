# Handoff — Formation app, post Member-View implementation

Written 2026-09-15. Read this before touching anything — it tells you what's actually done vs. what still needs a human/device.

## Where things stand

The "Member View" feature (spec: `docs/superpowers/specs/2026-09-14-member-view-design.md`, plan: `docs/superpowers/plans/2026-09-14-member-view.md`) is **fully implemented and committed to `master`**, current HEAD is `91ee495`. It was built via 8 sequential tasks, each independently implemented and code-reviewed clean, followed by a final whole-branch review (on the most capable model) that found 3 real cross-task issues, a fix round that addressed all 3, and a scoped re-review confirming the fixes with no new breakage. `npx tsc --noEmit` is clean and `npx expo-doctor` passes everything except one pre-existing, unrelated issue (see below).

**What this means for you:** don't re-derive the design — read the spec/plan above if you need the "why." Your job, if the user sends you here, is either (a) the on-device verification below, which no subagent in this process could perform, or (b) picking off one of the parked minor items, or (c) a genuinely new feature request, in which case treat this doc as background only.

## What the feature does

Sign up as **Staff** (access code `1234`) → existing 4-tab experience (Home/Sections/Catalogue/Inventory), unchanged in behavior. Sign up as **Member** → new 3-tab experience (Game day/Sizes/Inventory), scoped down to just that member's own data. A member can flag one of their own uniform pieces (Coats/Vests/Bibbers/Pants/Ties/Belts) as Dirty or Needs Repair with a comment; that flag is immediately visible in the Staff view's Sections and Inventory screens, via a shared `context/FlagsContext.tsx` (React Context + AsyncStorage) both experiences read from.

The Member view's "current member" is hardcoded to **Maya Chen** (`MY_MEMBER_NAME` in `constants/myUniformData.ts`) regardless of what name is typed at sign-up — there's no real accounts system, so this is a deliberate, documented simplification (see spec's Non-goals).

## 2026-09-15 update: after-game instructions + multi-color My Inventory (commit `1055be3`)

The user supplied an updated `mobile-app/mockups/formation-design-handoff.md` plus two new mockup screenshots (`gameday_instructions.png`, `memberView_myInventory_update.png`) and asked for the implementation to catch up. This was scoped and approved via the `superpowers:brainstorming` skill (bounded path — extends existing screens/patterns, no spec file). Two real changes landed:

1. **Game Day** now has a read-only "After-game instructions" card (staff-authored free text + "Posted by / Updated" line) rendered once at the end of the scroll, applying to the whole game rather than a specific combo. Backed by three new fields on `constants/gamesData.ts`'s `Game` type: `afterGameInstructions`, `instructionsPostedBy`, `instructionsUpdatedAt`. There's still no Staff-side "Edit game day" screen — this is read-only, seeded data only, matching how the rest of this app's Staff-authored content works today.
2. **My Inventory data model changed**: a member now owns **one item per color/style variant of a piece type**, not one item per type (Maya has 4 coats — Blue/Red/Purple/Candy — not 1). `constants/myUniformData.ts`'s `MY_UNIFORM` is now `UniformGroup[]` (`{ piece, size, variants: { color }[] }`), with variants derived from `constants/inventoryData.ts`'s `PIECES` so they can never drift from the Staff-side catalogue. `MyInventoryScreen.tsx` is now expand/collapse per piece type (reusing Staff Inventory's `PieceCard` dual repair/dirty-badge pattern on the collapsed header), and flagging happens per `(piece, color)` — which required changing `Flag.id` from `${memberName}-${piece}` to `${memberName}-${piece}-${color}` (the old scheme would've silently collided/overwritten if a member ever had two different colors of the same piece flagged). `MySizesScreen.tsx` was adapted to show a joined color list per piece type since "one color" is no longer a valid assumption.

`tsc`/`expo-doctor` re-verified clean (same pre-existing patch-version warning, see below). **Not yet verified on-device** — folded into the checklist below.

## Required: on-device verification (nobody has done this yet)

Every task in this plan was verified via `tsc`/`expo-doctor` plus hand-traced logic, because subagents in this process cannot run `npm start`/Expo Go. **The controller (me) also has not personally run this on a device.** This is the single most important thing to do before considering this feature actually finished:

1. `cd mobile-app && npm start`, open in Expo Go.
2. Sign up as **Member** → confirm you land on Game Day (not the Staff Home tab).
3. Game Day: confirm it shows "vs. Lincoln High — Fri, Sep 18", a Pre-game section ("Combo 01 — Field — home") and Halftime section ("Combo 14 — Halftime formation"), each with 6 component chips, and — below both — an "After-game instructions" card with the draped-pieces/bowties/white-shirt copy and "Posted by Coach Reyes" / "Updated Sep 15".
4. Sizes tab: confirm a 2×3 grid of Maya Chen's 6 piece types, each showing its joined color list + size (Coats "Blue, Red, Purple, Candy · 208", Vests "Candy, Red · 204", Bibbers "Blue, White · 212", Pants "Blue, White · 208", Ties "Blue, Red, Purple, Blue bows, Red bows · —", Belts "Red, Blue · —") plus the advisory note.
5. Inventory tab: confirm **Coats** is collapsed showing "4 pieces" and a "Dirty · 1" badge (pre-seeded on Blue); other piece types show no badge. Expand Coats → confirm Blue shows "Dirty" with an editable comment banner and Red/Purple/Candy show "Good". Tap Red → Flag item → submit "Needs repair" with a comment → back on My Inventory, confirm Coats' collapsed badge now reads "Repair · 1  Dirty · 1" and Red shows "Repair" with your comment in a banner with an "Edit" link.
6. Tap the avatar (top-right on Game Day) → Account screen → confirm it shows the name/instrument you entered and "MEMBER" → Log Out → back to Sign Up.
7. Sign back up as **Staff** (code `1234`): open Sections, browse to Trumpet (Maya's section, no status filter) — confirm her row now shows Coats (dirty), Coats (repair), and Vests (dirty, pre-seeded on Candy is not flagged — check whatever you actually flagged) as separate lines, not collapsed into one. This is the exact bug class the original final review caught (flags overwriting each other) — if you only see one Coats line after flagging a second color, something regressed on the `Flag.id` change.
8. Open Inventory: confirm Coats now shows both "Repair · 1" and "Dirty · 1" and the summary line reflects it.
9. Go back to Home (the Staff tab): confirm the Inventory preview card *also* shows Coats as flagged.
10. Fully close and reopen the app (not just Fast Refresh) → confirm both Coats flags persisted (AsyncStorage) and are still distinct (not merged into one).

If any of these don't match, that's a real bug — treat it seriously, don't just patch around it blindly; re-read the relevant section above first.

## Parked minor findings — all fixed 2026-09-15 (commit `e639344`)

From the final whole-branch review. All 8 were addressed in a follow-up pass; `tsc`/`expo-doctor` re-verified clean (same pre-existing patch-version warning as before, see below). Kept here for reference/history, not as an open TODO list:

1. **`context/FlagsContext.tsx`** — `JSON.parse(saved)` now runs through a runtime shape validator (`isFlag`/`parseFlags`) before being trusted; a corrupted/stale AsyncStorage blob falls back to seed data instead of flowing into consumers unchecked.
2. **`context/FlagsContext.tsx`** — `addFlag`/`updateFlag` are now `useCallback`'d (using functional `setFlags` updates, which also fixed a latent stale-closure bug) and the context value is `useMemo`'d.
3. **`screens/member/GameDayScreen.tsx`** — the two non-null assertions on `COMBOS.find(...)` are gone; each `ComboSection` now renders conditionally only if the combo is found, instead of throwing.
4. **`constants/homeData.ts`'s `CATALOGUE`** — now derived from `COMBOS` (`COMBOS.slice(0, 5).map(...)`) instead of duplicating label/sub data.
5. **`constants/combosData.ts`** — `components` is now optional on `Combo`; the invented filler for `combo-02`..`combo-05` (never rendered) was removed, keeping it only on `combo-01`/`combo-14` which Game Day actually renders.
6. **`components/TabIcon.tsx`** — the `'sizes'` case now shares the `'inventory'` case instead of duplicating the same SVG.
7. **`screens/member/FlagItemScreen.tsx`** — hint copy softened to "A staff member will see this."
8. **`screens/member/MyInventoryScreen.tsx`** — the flagged banner now always shows once a piece is flagged, even with an empty comment (falls back to "You flagged this.").

## Other known outstanding items (pre-existing, unrelated to this feature)

- **`expo-doctor` reports one persistent failure**: `expo`, `expo-font`, `expo-splash-screen`, `expo-updates` are all one patch version behind what SDK 57 currently wants. Harmless, but if you're in the area: `npx expo install --check` from `mobile-app/` (has come up multiple times across this project's history — SDK patch releases roll out faster than we've been updating).
- **Google Play Console submission is paused**, blocked on Android device verification (Play Console now requires signing in via the Play Store app on a physical Android device to create a developer account) — the user doesn't currently have one. An EAS preview `.apk` build already exists and works for direct-install testing; the AAB path for actual Play Store release is what's blocked. See earlier conversation history if resuming this.
- **Catalogue tab (Staff view)** is still a placeholder ("Coming soon") — no mockup exists for its own dedicated browsing screen yet, only the Home carousel preview and the combo data feeding Game Day.
- **Un-flagging/resolving a flag** back to "Good" was explicitly out of scope for this feature (see spec's Non-goals) — a real next feature if the user wants it.
- **Sections tab's "Add member" (+) button** and **Inventory's "Add piece" (+) button** are both placeholder alerts ("Coming soon") — no add-flow exists yet on either.
- **Member row taps** in Sections (Staff view) show a "Coming soon" alert — no member-detail/profile screen exists for Staff to view yet (also explicitly deferred, no mockup exists for it).

## Project conventions to follow

- No automated test suite exists anywhere in this project (by design/scale) — verification is always `npx tsc --noEmit` + `npx expo-doctor` (run with `$env:CI = "1"` first in PowerShell) + manual on-device checks in Expo Go, from `mobile-app/`.
- Design tokens live in `mobile-app/constants/colors.ts` and `mobile-app/constants/fonts.ts` — never introduce new colors/fonts, reuse what's there.
- Square corners everywhere; the only circles are avatars.
- All commits go straight to `master` (no branches/worktrees) — this has been the project's practice throughout, by explicit user preference.
- For anything sized like a new screen or bigger, use the `superpowers:brainstorming` skill first (classify spike/bounded/architectural) rather than jumping to code — this project's history shows the user wants a design/approval step before implementation, scaled to the size of the ask.
