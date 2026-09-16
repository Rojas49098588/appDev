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

## 2026-09-16 update: Login → Invite Code → Sign Up flow (commit — this update is itself the latest commit on `master` as of this writing; check `git log` for its hash)

Added a real authentication flow in front of the app: **Login → (Create an account) → Invite code → Sign Up**, backed by a new `context/AuthContext.tsx` that mirrors `FlagsContext`'s AsyncStorage pattern (persist-on-write, runtime-validated read-back on load). This is a genuine behavior change, not just a new screen: previously *every* feature in this app's history landed the user straight on Sign Up on launch, with no real accounts. Now a saved account + persisted session means the app remembers who's logged in — force-closing and reopening skips Login entirely and drops straight back into the signed-in tabs (Staff Home or Member Game Day, matching the account's role), and Log Out (from the avatar → Account screen) clears the session and returns to Login rather than Sign Up.

The invite-code step gates account creation behind a single shared code (`4F2K9`) before Sign Up is reachable at all; Sign Up itself still branches Staff (inline staff access code, no modal) vs. Member exactly as before, now with email/password captured and persisted as the account's credentials for future Logins.

This was scoped via the `superpowers:brainstorming` skill (architectural path — new context, new screens, new navigation states), spec at `docs/superpowers/specs/2026-09-16-auth-flow-design.md`, and implemented via `superpowers:subagent-driven-development` across 7 sequential tasks per the plan at `docs/superpowers/plans/2026-09-16-auth-flow.md`. Each task was independently implemented and reviewed clean; this final task is whole-project `tsc`/`expo-doctor` verification plus this handoff update — same pre-existing patch-version `expo-doctor` warning as always (see below), no new failures.

## Required: on-device verification (nobody has done this yet)

Every task in this plan was verified via `tsc`/`expo-doctor` plus hand-traced logic, because subagents in this process cannot run `npm start`/Expo Go. **The controller (me) also has not personally run this on a device.** This is the single most important thing to do before considering the new auth flow actually finished — it supersedes the old Member-View checklist that used to live here, which assumed the app opened straight to Sign Up:

1. Fresh install (or clear the app's storage/AsyncStorage) → app opens on **Login**, not Sign Up.
2. On Login, tap "Create an account" → lands on **Invite code**; entering a wrong code shows an error and stays on that screen; entering the correct code (`4F2K9`) advances to **Sign up**.
3. Fill out Sign up (including Email/Password) as **Member**, submit → lands on Game Day, same landing behavior as before this feature.
4. Log out (avatar → Member Account → Log Out) → returns to **Login**, not Sign Up.
5. On Login, enter that same email/password → lands back on Game Day directly, with no need to re-fill Sign Up.
6. On Login, enter a wrong password → error alert, stays on Login.
7. Force-close and reopen the app while still logged in → opens directly to the signed-in tabs, skipping Login entirely — this is the core new behavior this feature adds.
8. Log out, sign up again as **Staff** with the correct staff access code entered inline (no modal should appear) → lands on Home. Force-close/reopen → returns to Home directly (not Login, not Sign Up).
9. Log out, sign up as Staff with the *wrong* staff access code → inline error shown, stays on Sign Up, and the previously-saved account is not overwritten.

If any of these don't match, that's a real bug — treat it seriously, don't just patch around it blindly; re-read `docs/superpowers/specs/2026-09-16-auth-flow-design.md` and `context/AuthContext.tsx` first.

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
