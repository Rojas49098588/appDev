# Games page: design

Date: 2026-10-28. Status: approved by the owner on 2026-10-28.

## Why

Staff decide football uniform combos weeks ahead but have nowhere to keep them. Today the app has one "current game", seeded by SQL ("Lincoln High"). Staff can set its pregame and halftime combos from the Catalogue, and there is no way to create games. The band also plays basketball and volleyball games with 5 small groups. Those games need a group number and a polo, and members currently get that information outside the app.

The goal: staff plan games in advance, and members see only what's final for the next game. Members get no clutter and see nothing half-planned. This blocks the live release, because without it members would see a placeholder game.

## Goals

- Staff create, edit and delete games for **football**, **basketball** and **volleyball**.
- Each game moves through **Draft → Ready → (shown to members) → Past**.
- Members see a minimal Game day:
  - **Football tab:** the single next ready football game.
  - **BB / VB tab:** every ready basketball/volleyball game on the next game day.
- All staff have the same rights. Any staff member can create, edit, mark ready or delete any game.

## Non-goals

- No push notifications or reminders.
- No per-member group membership. Members know their group number, and everyone sees every BB/VB game because people swap and fill in.
- No season or calendar view for members, and no list of future games for members.
- No attendance tracking.

## Anti-goals (failure even if it "works")

- A member sees a draft or half-planned game, including by querying the database directly. RLS is the only access control in this app, so hiding drafts only in the UI is a failure.
- Last week's game stays on members' screens after it's been played.
- A volleyball game knocks the football game off Game day, or the other way round.

## What a game contains

| Field | Football | Basketball / Volleyball | Required to mark ready |
|---|---|---|---|
| Type | Football | Basketball or Volleyball | yes |
| Men's / Women's | — | yes | yes |
| Opposing university (e.g. "Notre Dame") | yes | yes | yes |
| Game date | yes | yes | yes |
| Kickoff / start time | yes ("Kickoff") | yes ("Start") | yes |
| Call time, or explicitly "No call time" | yes | yes | yes (a time, or the "no call time" box ticked) |
| Polo: one or more colors | yes | yes | yes, at least one |
| Polo note (e.g. "Brass and drumline in red, everyone else in blue") | yes | yes | no |
| Group number, 1–5 | — | yes | yes |
| Pregame combo (from Catalogue) | yes | — | yes |
| Halftime combo (from Catalogue) | yes | — | yes |
| After-game instructions | yes | — | no; decided after the game |

There is one polo per game day, worn for stadium rehearsal and parade. Several colors are allowed because the band has split before (half red, half blue). The note explains a split.

**Polo colors** are a staff-editable list, starting with **Blue** and **Red** ("Edit colors" on the edit screen). Staff can add colors later. A color has a name and a swatch color. *Builder's call:* how staff pick the swatch (a few presets is fine). How removing a color affects games that use it is in "Left to the builder".

## Statuses and what members see

- **Draft:** visible to staff only. Can be saved with any fields missing.
- **Ready:** every required field is filled in. Tapping "Mark ready" checks them. Missing fields turn red with "Required", a banner says how many are missing, and the game stays a draft.
- **Shown to members:** this is calculated, not stored.
  - **Football:** the earliest ready football game whose date is today or later.
  - **BB / VB:** all ready basketball/volleyball games on the earliest date (today or later) that has at least one ready BB/VB game, in start-time order. Example: Nov 8 has a women's basketball game and a volleyball game, so members see both cards.
- **Past:** the day after its date, a game stops being shown and the next one takes its place automatically. For football that's the Sunday. "Day" means band local time, America/Chicago.
- If the next game isn't ready, members see **"No upcoming game yet"** (football: "Staff will post the next game's details here"; BB/VB: "The next basketball or volleyball game will show here"). A game shows up as soon as staff mark it ready, if it's next in line.
- On a day with one ready game and one draft, members see only the ready one.
- Staff can edit a game members can already see. Members see the change right away (realtime, as combos do today).
- **Move back to draft** (owner-approved): any staff member can move a ready game, including one members can see now, back to draft. It disappears from members' screens until it's marked ready again.
- **Delete game** (owner-approved): any staff member can delete any game, for example a cancelled one. A confirmation step names the game, e.g. "Delete vs. Rice on Sat Nov 14? This can't be undone." Nothing is deleted until staff confirm.

## Screens (from the approved mockups, `.superpowers/brainstorm/*/content/games-v1..v3.html`)

**Staff Home:** gets a new "Games" block that opens the Games page.

**Staff Games page:**
- Two tabs: **Football | BB / VB**. Each tab shows:
  - "Up next": what members see now, marked **Posted**. BB/VB can have several on one day.
  - "Queue": later games in date order, each marked **Ready** or **Draft**, with a one-line summary (date, kickoff, call time, combos or group, polo, and what's missing for drafts).
  - "Past": below the queue, dimmed.
- A **+ New game** button.
- Tapping a game opens the edit screen.

**Staff Edit / New game:**
- Type picker: Football / Basketball / Volleyball. Basketball and volleyball also ask Men's / Women's.
- The fields shown follow the type, as in the table above.
- Required fields have a red `*`.
- Call time has a "No call time for this game" checkbox.
- Polo uses multi-select chips, then an optional note.
- Football has pregame and halftime combo cards with "Change", which opens a Catalogue picker. Football also has an after-game instructions box.
- Basketball/volleyball has group 1–5 buttons.
- Buttons: **Save draft** and **Mark ready**. The status pill shows in the header.

**Member Game day:**
- Two tabs: **Football | BB / VB**.
- **Football** keeps today's look, with these additions:
  - At the top: the opponent and date, then call time and kickoff (call time shows "None" when ticked), then the polo colors with the note under them.
  - Then the pregame and halftime combos, each with its photo and pieces. These are the combo's existing components.
  - Then after-game instructions. When blank, this shows "Instructions coming soon".
- **BB / VB:** one card per game, showing:
  - the sport and Men's/Women's
  - opponent and day
  - a large **Group #**
  - call time and start time
  - polo and note
  - a small line: everyone can see this, so you can fill in or swap

## Constraints

- **Stack:** Expo SDK 58 / React Native 0.88, TypeScript, Supabase. RLS and security-definer RPCs are the only access control. Use the app's existing colors and fonts (`constants/colors.ts`, `constants/fonts.ts`), plus the existing realtime pattern (`lib/realtime.ts`, `context/GameContext.tsx`, `context/CombosContext.tsx`).
- **Database:**
  - The `games` table exists, with `opponent`, `game_date`, `pre_game_combo_id`, `halftime_combo_id`, `after_game_instructions`, `instructions_posted_by`, `instructions_updated_at`, `is_current`, and the unique index `games_one_current`.
  - Today `games_select` lets every signed-in user read every game, and there's no insert or delete policy.
  - Members must not be able to read drafts. Staff need insert, update and delete.
  - Schema changes go in `supabase/schema.sql` and must be re-runnable (the existing `if not exists` / `drop policy if exists` style). They're tested on TEST (`npm run db:apply:test`, `npm run test:rls`). **Live gets them only when the owner runs `npm run db:apply`.**
- **Existing data:**
  - The seeded "current game" (live: "Lincoln High") and `seed.sql`'s "one current game is required" insert are replaced by the new model. Live has that one game with no combos.
  - *Builder's call:* how it migrates. Turning it into a football draft is fine, and so is deleting it. It must not appear to members after the release.
- **Existing shortcut:** the Catalogue's combo popup ("Set for pregame" / "Set for halftime", `ComboDetailScreen.tsx`) targets the single current game. *Builder's call:* make it target the football game members currently see (or the next football game in the queue), or remove it in favor of the Games page. It must not silently edit a game staff can't see.
- **Combos:** deleting a combo sets game references to null (existing FK). **Owner decision: block the delete.** A combo used by a ready game, posted or queued, can't be deleted. The Catalogue tells staff which game uses it, e.g. "Used by vs. Rice. Change that game first." Enforce this in the database too, not only in the app. *Builder's call:* whether a combo used only by drafts or past games can be deleted (the reference just clears). Members must never see a ready game with a missing combo.
- **Tests:** RLS tests cover the following. Pure logic gets unit tests (Node test runner).
  - Members can't read drafts.
  - Members can't write games.
  - Staff can do everything.
  - "Ready" can't be set with missing fields. Enforce this in the database too, not only in the form.
  - Pure logic: which games are shown, the day-after rollover in America/Chicago, and required-field checks.

## Settled after the builder check (designer's calls)

- **Ready stays complete.** Saving a ready game is refused, by the database as well as the form, if it would leave a required field empty. Staff must move it back to draft first.
- **Dates and times:** the game date is a plain calendar date. Kickoff/start and call time are plain local wall-clock times (band time, America/Chicago) with no timezone. "Today" is always computed in America/Chicago, in both the database and the app, whatever the phone's timezone.
- **Cutoff:** a game is shown through the whole of its own date, i.e. `game_date >= today in Chicago`. It drops off at midnight Chicago time.
- **No uniqueness rules:** two games can share a date or a start time.
- **Realtime:** members' screens refetch on any `games` change. Realtime under RLS doesn't deliver "this row became invisible", so a game moved back to draft or deleted has to disappear via the refetch.
- **Polo color list:** one global list. Every signed-in user can read it, and only staff can change it. Games keep a copy of the color names (and swatches) they use, so removing a color from the list doesn't change existing games.
- **Tests:** `npm run test:rls` already creates staff and member users on TEST. Extend it.

## Left to the builder

- Exact data model: for example a `status` column or a `ready_at` timestamp, how to store polo colors and the color list, and whether to keep or drop `is_current`.
- How members' reads are limited:
  - a view/RPC that returns only the shown games, or
  - an RLS rule allowing ready games from today on.

  *Builder's call:* members may read **ready, not-past** games directly. Showing only the next one is then a UI rule, which is acceptable: those games are final and members could see them soon anyway. What's forbidden is reading drafts.
- Time pickers and date pickers. Use whatever the app already uses, or a standard Expo-compatible picker.
- Removing a polo color that games already use (keep the name on those games, or block).
- Offline/cached behavior. Follow `GameContext`'s current approach.

## Release note

This ships with the live release. Order:
1. Build and test on TEST.
2. The owner runs `npm run db:apply` on live.
3. Publish the `live` EAS Update (`--environment preview`).
4. Staff create the real games and combos.
5. Import the CSV, then invite members.
