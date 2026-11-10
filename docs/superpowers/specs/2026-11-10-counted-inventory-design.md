# Counted inventory: season totals, wash-day recounts, and kept-at-home shirts

## Why

Some uniform items are never assigned to one member: ties, bowties, spare polos, and the
white shirts that go into bins. Staff want to see how many of each are on hand, and to
notice when a count keeps dropping, which means items are going home and not coming back.
They then ask for returns in Slack.

Supplies are bought once, in bulk, before the season. That purchase is the yardstick:
nothing is bought mid-season, so the app compares counts to the season's supply and never
suggests what to order.

Nothing is recorded on game day. Staff lay items out in bulk and members grab what they
need. Counting happens on **wash days**, when shirts are washed, sorted by size and put
back in the bins. That's when staff update the counts.

## What exists today

- Piece types are either **numbered** (one row per physical piece, assigned to members,
  e.g. Coats) or **counted** (`piece_types.stock`, a `{color: number}` map, e.g. Ties).
- Counted stock is entered once, on New piece type. There is no way to change it later.
- Counted types are split only by color. There are no sizes.
- Members' white shirts are a placeholder: My Inventory and My Sizes show a hard-coded
  White · M for everyone (`constants/myUniformData.ts`, `MY_WHITE_SHIRT`). The app stores
  no real white shirt size. Code identifies the white shirt by the name `'White shirt'`
  (e.g. `DIRTY_ONLY_PIECES` in `FlagItemScreen`).

## Goals

1. Counted items can be split by **size, color, or both** (e.g. White shirt S/M/L/XL;
   Ties Black/Red/Gold; spare polos "Red · M").
2. Each line has a **season total** (the bulk purchase) and a **current count** (what's in
   the bins after the last wash day).
3. Staff see on the Inventory screen how many are **missing**, and which lines are short.
4. Staff can **recount** on wash day quickly, including adding a batch (`+12`) as they fold.
5. Members can say whether they **keep and wash their own white shirt**. Those shirts
   aren't counted as missing.

## Non-goals

- Recording who borrowed or took a specific item. Game day is grab-and-go.
- History of past counts or trends. The season total is the only comparison point (the
  user's choice).
- Suggesting purchases or reorder amounts.
- Sending messages. Slack stays the place for that.
- Members seeing stock counts.
- Removing or renaming lines once created (see "Left to the builder").

## Anti-goals (would make this a failure even if it works)

- Anything that needs someone to record something on game day.
- False "missing" alarms. Shirts members keep at home must not show as missing.
- Losing existing counted stock (e.g. ties already entered) when the data changes shape.

## Decisions

### Lines

A counted piece type has an ordered list of **lines**. Each line has:
- a **label**: free text like `M`, `Black` or `Red · M`, so one shape covers sizes, colors
  and both
- a **season total**: a whole number, 0 or more
- a **count**: a whole number, 0 or more

The piece type also records **when it was last counted** and **by whom**.

Existing counted types migrate with each color becoming a line, where count = season
total = the old stock number. Migration must be safe to re-run, like the rest of
`schema.sql`.

### The white shirt

- The white shirt is the counted piece type named **"White shirt"**. Its lines are sizes.
  This matches how the code already finds it. *(Claude's call.)*
- Each member has a **white shirt size** (one of that type's line labels, or not set) and a
  **keeps own shirt** choice: yes, no, or not answered.
- **Not answered counts as "leaves it in the bin".** *(Agreed with the user.)*
- **Kept at home** for a size = active (not archived) members with that size who answered
  yes.
- **Expected in bins** for a line = season total − kept at home, never below 0. For every
  other piece type, expected = season total.
- **Missing** for a line = expected − count, when that's above 0.
- Only active members with the **Member** role are counted, both for kept at home and for
  "haven't answered". A member who chose "keep" but hasn't set a size counts as not
  answered, because their shirt can't be placed in a size. *(Claude's call.)*

### Staff Inventory card (layout "A", chosen by the user)

Counted items keep their place in the Inventory list next to numbered items. Numbered
cards don't change.

- **Closed:** name, its line labels, `count / expected` summed over lines, and an amber
  **"N missing"** tag when any line is short, or a quiet **"all in"** tag otherwise.
- **Opened:** one row per line, e.g. `M   91 / 100 · 9 missing`, with short rows in amber.
  The number of rows doesn't matter (XS–3XL is fine), which is why the user picked this
  over a grid.
- **White shirt only:** a line such as "20 kept at home" (per size when opened), and
  "12 members haven't answered" when some haven't, so staff can nudge them in Slack.
- "Last counted Nov 2" and a **Recount** button.
- If count is above expected, no missing tag shows. *(Claude's call: showing "extra" isn't
  needed.)*

Mockups the user reviewed: A vs C1 (cards) and Recount option 2. They were throwaway HTML
files, not saved in the repo.

### Recount screen (option "2", chosen by the user)

- Opened from **Recount** on a card. Staff only.
- One row per line: label, "of {expected}" or "N missing" (updating live as numbers
  change), and the count box **pre-filled with the last count**.
- Each row: type the number, or tap **− / +**, or **add or remove a batch** (e.g. `+12`,
  `−3`), which is applied to the box. The batch option is the user's request: count what's
  already in the bin, then add each folded stack.
- A running total at the bottom: "296 of 310 · 14 missing".
- **Save count** writes every line at once and sets last counted (date and staff member).
  Blocked offline, like other edits.
- A **Change season totals** link opens the same list for editing season totals, and for
  adding a line (a new size or color).

### Member My Inventory: white shirt

- The white shirt row lets the member pick their **size** from the White shirt type's
  lines, and choose **"I keep and wash my own"** or **"I leave mine in the bin"**.
- Both can be changed anytime. Saving needs a connection.
- The real size replaces the placeholder `MY_WHITE_SHIRT` size everywhere members see it
  (My Inventory, My Sizes, and flags they raise on the white shirt).
- If no "White shirt" type exists yet, or no size is set, the row says so and offers to
  choose. *(Claude's call.)*

### New piece type (counted)

Counted types are created with lines (label + season total) instead of colors + stock. The
count starts equal to the season total. The form wording becomes "sizes or colors".
*(Claude's call, so new types use the same shape as migrated ones.)*

## Constraints

- Follow the repo's rules (`CLAUDE.md`, `COMMANDS.md`): schema changes go in
  `supabase/schema.sql` and must be safe to re-run. Apply to TEST first
  (`npm run db:apply:test`) and to LIVE (`npm run db:apply`) only after merging. The user
  runs LIVE.
- Only staff can change counts, season totals and lines. Enforce this in the database,
  with `supabase/tests/rls.test.ts` cases. Members may change only their own shirt size and
  keep choice.
- Pure logic (expected, missing, kept-at-home counts, batch math) goes in `lib/` with
  `node --test` unit tests, like `lib/pieceTypeForm.ts`.
- Existing behavior must keep working: inventory CSV import, numbered types, Add color /
  Add number, flags. The import only creates numbered types (`import_inventory` inserts no
  stock), so it shouldn't need changes.

## Left to the builder

- How lines are stored (a new table vs a JSON column), and the exact migration.
- Whether kept-at-home counts are computed in the app from profiles staff already load, or
  in the database.
- Realtime refresh details (InventoryContext already subscribes to inventory changes).
- Two staff saving recounts at the same time: last save wins is acceptable.
- Exact wording, spacing and the batch-entry control, within the chosen layouts.
- Removing or renaming lines is out of scope for now. If needed, staff can set a line's
  season total to 0.
