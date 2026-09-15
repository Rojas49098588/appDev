# Handoff — Formation app, post Member-View implementation

Written 2026-09-15. Read this before touching anything — it tells you what's actually done vs. what still needs a human/device.

## Where things stand

The "Member View" feature (spec: `docs/superpowers/specs/2026-09-14-member-view-design.md`, plan: `docs/superpowers/plans/2026-09-14-member-view.md`) is **fully implemented and committed to `master`**, current HEAD is `91ee495`. It was built via 8 sequential tasks, each independently implemented and code-reviewed clean, followed by a final whole-branch review (on the most capable model) that found 3 real cross-task issues, a fix round that addressed all 3, and a scoped re-review confirming the fixes with no new breakage. `npx tsc --noEmit` is clean and `npx expo-doctor` passes everything except one pre-existing, unrelated issue (see below).

**What this means for you:** don't re-derive the design — read the spec/plan above if you need the "why." Your job, if the user sends you here, is either (a) the on-device verification below, which no subagent in this process could perform, or (b) picking off one of the parked minor items, or (c) a genuinely new feature request, in which case treat this doc as background only.

## What the feature does

Sign up as **Staff** (access code `1234`) → existing 4-tab experience (Home/Sections/Catalogue/Inventory), unchanged in behavior. Sign up as **Member** → new 3-tab experience (Game day/Sizes/Inventory), scoped down to just that member's own data. A member can flag one of their own uniform pieces (Coats/Vests/Bibbers/Pants/Ties/Belts) as Dirty or Needs Repair with a comment; that flag is immediately visible in the Staff view's Sections and Inventory screens, via a shared `context/FlagsContext.tsx` (React Context + AsyncStorage) both experiences read from.

The Member view's "current member" is hardcoded to **Maya Chen** (`MY_MEMBER_NAME` in `constants/myUniformData.ts`) regardless of what name is typed at sign-up — there's no real accounts system, so this is a deliberate, documented simplification (see spec's Non-goals).

## Required: on-device verification (nobody has done this yet)

Every task in this plan was verified via `tsc`/`expo-doctor` plus hand-traced logic, because subagents in this process cannot run `npm start`/Expo Go. **The controller (me) also has not personally run this on a device.** This is the single most important thing to do before considering this feature actually finished:

1. `cd mobile-app && npm start`, open in Expo Go.
2. Sign up as **Member** → confirm you land on Game Day (not the Staff Home tab).
3. Game Day: confirm it shows "vs. Lincoln High — Fri, Sep 18", a Pre-game section ("Combo 01 — Field — home") and Halftime section ("Combo 14 — Halftime formation"), each with 6 component chips.
4. Sizes tab: confirm a 2×3 grid of Maya Chen's 6 pieces (Coats Blue·208, Vests Candy·204, Bibbers Blue·212, Pants Blue·208, Ties Blue·—, Belts Blue·—) plus the advisory note.
5. Inventory tab: confirm **Coats** shows "Dirty" (pre-seeded) and the other 5 show "Good". Tap a "Good" piece (e.g. Vests) → Flag item → submit "Needs repair" with a comment → back on My Inventory, confirm it now shows "Repair" with your comment in a banner with an "Edit" link.
6. Tap the avatar (top-right on Game Day) → Account screen → confirm it shows the name/instrument you entered and "MEMBER" → Log Out → back to Sign Up.
7. Sign back up as **Staff** (code `1234`): open Sections, browse to Trumpet (Maya's section, no status filter) — confirm her row now shows **both** her Coats (dirty) and Vests (repair) lines, not just one. This is the exact bug the final review caught and the fix round addressed — if you only see one line, something regressed.
8. Open Inventory: confirm Vests now shows "Repair · 1" and the summary line reflects it.
9. Go back to Home (the Staff tab): confirm the Inventory preview card *also* shows Vests as flagged — this was Finding #2 from the final review (Home's preview used to be frozen at seed data; it's now supposed to be live).
10. Fully close and reopen the app (not just Fast Refresh) → confirm the Vests flag persisted (AsyncStorage).

If any of these don't match, that's a real bug that slipped past every review layer — treat it seriously, don't just patch around it blindly; re-read the relevant task in the plan first.

## Parked minor findings (real, not blocking, not yet fixed)

From the final whole-branch review — none of these were required to fix, but they're legitimate and worth picking off opportunistically:

1. **`context/FlagsContext.tsx:23`** — `JSON.parse(saved) as Flag[]` has no runtime shape validation. A corrupted/stale AsyncStorage blob would flow unchecked into every consumer.
2. **`context/FlagsContext.tsx`** — `addFlag`/`updateFlag` aren't `useCallback`'d and the context value object isn't `useMemo`'d, so every render creates new function/object identities. Harmless at this app's scale, but not idiomatic.
3. **`screens/member/GameDayScreen.tsx`** — two non-null assertions (`COMBOS.find(...)!`) on `CURRENT_GAME.preGameComboId`/`halftimeComboId`. If a future edit to `constants/gamesData.ts` ever references a combo id that doesn't exist in `constants/combosData.ts`, this throws and white-screens the member's landing tab. Consider a fallback or early return.
4. **`constants/combosData.ts` vs `constants/homeData.ts`'s `CATALOGUE`** — combo label/sub data is now duplicated across two files. `CATALOGUE` should probably become derived from `COMBOS` (e.g. `COMBOS.slice(0, 5).map(({label, sub}) => ({label, sub}))`).
5. **`constants/combosData.ts`** — `combo-02` through `combo-05`'s `components` arrays are invented filler (never rendered anywhere, since only Home's carousel uses those combos and it only reads label/sub). Harmless but could confuse a future reader into thinking they're real data.
6. **`components/TabIcon.tsx`** — the `'sizes'` icon case is byte-identical to the pre-existing `'inventory'` case (same SVG path). Intentional (they're never shown in the same tab bar) but worth a shared case if you're in this file anyway.
7. **`screens/member/FlagItemScreen.tsx`** — the copy "This will show up on your profile in the staff view" is only literally true for Maya Chen, since she's the only member the Member view can act as. Consider softening to "a staff member will see this" (the placeholder text already says this) to avoid over-promising.
8. **`screens/member/MyInventoryScreen.tsx`** — a flag with an empty comment shows no banner/no visible "this is editable" affordance beyond the row still being tappable. Worth a UX look against the original mockup (`mobile-app/mockups/memberView_myInventory.png`).

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
