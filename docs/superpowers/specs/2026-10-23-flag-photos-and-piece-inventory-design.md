# Flag photos, piece history, and real inventory — design

_2026-10-23 · Mustang Closet (`mobile-app/`)_

## Why

Members flag uniform pieces as **dirty** or **needing repair** today with a status and a comment. Staff can't see how bad the problem is, and once a flag is cleared it is deleted, so nothing is remembered about a piece.

The band director (the user) wants three things:

1. **Triage from a photo.** A small stain can wait for the next wash; a blood stain needs washing now. A photo lets staff decide without seeing the piece.
2. **A record per piece.** Missing buttons and broken zippers should stay on the piece's record. When that piece goes to a new member and they report it, staff can say "we know, we're working on it" instead of treating it as new.
3. **A real inventory.** The app's inventory is placeholder data hard-coded in `constants/inventoryData.ts`. The real record is a spreadsheet in Box listing each member and their coat / bibber / vest numbers. Staff want to load that into the app and see every piece, who has it, and whether it's flagged.

## How pieces are identified (decided by the user)

- A piece is **piece type + color + number**, e.g. *Blue Coat 185*.
- The number (the "Coat #" in the spreadsheet) is a **piece number**, not a size on a regular scale. Real numbers are irregular (114, 128, 131, 153, 293…).
- **Each number exists in every color of that type.** Coat 185 means Blue 185, Red 185, Purple 185 and Candy 185.
- **Each number belongs to at most one member.** No two members ever share a coat number. A member has the same number in every color (Amy has every coat in 153).
- Pieces are never "checked out" day to day. Staff lay out uniforms per game. "Assigned" means the number belongs to a member for the season.
- The current `inventoryData.ts` size ranges (different sizes per color, even steps) are placeholder and must not shape the design.

## Goals

1. **Optional photo on a flag.** A member can attach one photo (camera or library) when flagging or editing a flag. Submitting without one works exactly as today.
2. **Flags are kept, not deleted.** When staff mark a piece good, the flag becomes a *cleared* history entry (who cleared it, when) instead of being deleted.
3. **Piece history.** Staff tap a piece in Inventory and see every flag on it, newest first, open and cleared: status, comment, photo (tap for full size), who sent it and when, who cleared it and when.
4. **Inventory shows every piece** with:
   - condition: good / needs repair / dirty (option "A" from the mockups: a size chip is tinted rust for repair or blue for dirty only while a flag is open),
   - assignment: **Assigned** (to a member), **Unassigned** (on the rack), or **Out for repair** (at the seamstress),
   - filters for both condition and assignment.
5. **"Every [piece type]" table.** Reached from each piece type card: one row per number, the member who has it (or Unassigned / Out for repair), and a cell per color showing flag state. Tabs: All / Assigned / Unassigned / Flagged. Tapping a cell opens that piece's history.
6. **Inventory lives in the database**, not app code, so staff changes appear for everyone without an app update.
7. **Spreadsheet import for first setup** (option "C"), reading the Box sheet's format (below).
8. **Add a new piece type later** (option "B"), e.g. Pants when they come into use: name, kind (numbered vs counted), colors, and a list of numbers (type a list, or fill a range then edit it; never assume even steps).
9. **Add a color to an existing type**, creating that color in every existing number of the type (new colorways are common).
10. **Add a single number** to an existing type (all colors checked by default), for one-off additions.
11. **Staff can edit history entries.** Today staff can only clear a flag (the database only lets them delete). Staff can now change an entry's color, status (repair/dirty) and comment, and add a staff note. Needed so staff can fix imported Repairs notes that were attached to every color.
12. **Any numbered piece type can be assigned to members.** New types are rare, but when one is introduced every member is fitted and given a number for it (decided by the user). So member numbers can't stay in the four fixed `profiles` columns (`coat_size`, `vest_size`, `bibber_size`, `pant_size`): they move to a per-member, per-type assignment the builder designs. Everything that reads or writes those columns moves with them: `set_uniform_sizes`, `guard_profile_update`, `archive_member` / `restore_member` and their snapshots, `lib/uniform.ts` and the Members-tab size filter, `MySizesScreen`, member `MyInventoryScreen`, and the staff profile editor. Existing values are migrated.

## Non-goals (for this feature)

- **Seasons.** How a season starts/ends and how ensemble season codes are generated is **to be decided** by the user. For now history is kept indefinitely. Build so a season boundary can be added later (every history entry has timestamps; nothing assumes "all time").
- Day-to-day check-in/check-out of pieces.
- Assigning pieces to members from the Inventory screen. Assignment keeps going through the staff profile editor (backed by the reworked assignment storage, goal 12) and the import.
- Pants in the first import. There is no pants column; pants are added later with goal 8.
- More than one photo per flag.
- Staff flagging pieces themselves. Only members flag, as today.

## Anti-goals (a failure even if it "works")

- Flagging gets slower or more confusing for members who don't want to add a photo.
- History is lost or changed when a member is archived, renamed, or deleted.
- Members can see other members' flags or photos.
- The import silently changes or drops data. Staff must see exactly what will happen and confirm before anything is saved.

## The spreadsheet (Box) and the import

Columns, as exported to CSV: `NAME, Section, M/F, Coat #, BIBBER #, VESTS, Repairs`. About 122 member rows.

Row kinds:

| NAME cell | Meaning |
|---|---|
| `Last First` (e.g. `Rojas Abigail`) | A member. Their Coat / Bibber / Vest numbers are assigned to them. |
| `Addison Sew` (e.g. `293 · Addison Sew`) | That piece is **out for repair** at the seamstress. Today these rows don't say which type or color; the user will find out and update the sheet before importing. Format (Claude's call): the number goes under the right column (`Coat #`, `BIBBER #` or `VESTS`) and the color goes in the `Repairs` cell (e.g. `Red`). The import marks only that one piece (Red Coat 293) out for repair. A row missing its type or color is listed in the preview and skipped. |
| `Unassigned` | A piece the band owns that nobody has. The user will add these rows before importing (the sheet doesn't list them today). |

Import behavior:

- Staff pick a `.csv` file. On a phone, Box appears in the system file picker.
- The app parses every row and shows a **preview before saving**:
  - members matched to app accounts (match `Last First` against `profiles.last_name` + `first_name`, case- and space-insensitive),
  - member rows with **no matching account** (not signed up yet, or a spelling difference), listed for staff to fix or skip,
  - rows that can't be read (non-numeric number, empty row) with the reason,
  - conflicts: the same number on two rows, or a number that differs from what the member's profile already has.
- On confirm:
  - creates the inventory pieces (each number × every color of that type),
  - sets each matched member's coat / bibber / vest numbers (through the same rule as `set_uniform_sizes`, which stays staff-only),
  - marks Addison Sew pieces as out for repair,
  - turns non-empty **Repairs** text on a member row into an open *repair* history entry on **every color** of that member's coat number (decided by the user: assign to all, staff fix it later using staff editing, goal 11). Imported entries are labeled "from spreadsheet", have no sending member, and are shown to staff only.
- `Section` and `M/F` are not imported. Section already comes from the member's instrument.
- **The import is a merge, never a mirror** (Claude's call). It only adds and updates; it never deletes pieces or clears a member's numbers because they're missing from the sheet. When the sheet and a member's existing number disagree, the preview shows both and staff pick "use sheet" or "keep app" per row. After first setup the app is the record of truth.
- The import can be run again (e.g. after fixing names). Running it twice must not duplicate pieces, numbers, or imported Repairs entries: a Repairs note already imported for that member and piece type is left alone, even if its text changed in the sheet.

Initial colors per type for the import come from the current catalogue (Coats: Blue, Red, Purple, Candy; Vests: Candy, Red; Bibbers: Blue, White) unless the user says otherwise. Staff can add colors after.

## How "assigned" is worked out

- A piece is **Assigned** when an active (non-archived) member's profile has that number for that piece type. Every color of that number is assigned to them.
- **Out for repair** is set on **one piece** (type + color + number, e.g. Red Coat 293), from the import or a toggle on the piece's history screen. It overrides Assigned/Unassigned for that color only; the number's other colors keep their normal state. The "Every [type]" table shows it in that color's cell. A piece can be out for repair and still belong to a member.
- **One member per number is enforced** (Claude's call): the database refuses to give a number of a type to a second active member, and the profile editor shows a clear error. A number missing from inventory is allowed but warned about.
- Otherwise it is **Unassigned**.
- When staff change a member's number, the old number becomes unassigned and the new one assigned. Archiving a member clears their numbers, so their pieces become unassigned.
- If a member's profile number isn't in the inventory (typo), show a warning on the member and in Inventory rather than ignoring it.

## Flags and pieces (Claude's calls)

- A flag records the member who sent it **and** the piece it's about. When the piece exists in inventory it links to it. When it doesn't (White shirt, a member with no number yet saved as `Unassigned`, a typo'd number) the flag keeps today's free-text piece/color/size and simply doesn't show in any piece's history.
- A piece can have several open flags (e.g. it was reassigned while a repair was open, and the new holder flags it too). Each is its own history entry; staff see all of them.
- **"Mark good" acts on the piece**: it clears every open flag on that piece at once, recording who cleared it and when.
- Members never see other members' flags. The "we know, we're working on it" reply comes from staff, who can see the earlier entry.
- **Existing flags are carried into history** as open entries, linked to a piece where one matches, and free-text otherwise.
- Member `MyInventoryScreen` reads pieces and colors from the database inventory, not `constants/inventoryData.ts`. A type with no pieces yet (Pants, until added) doesn't appear for members.

## Who can do what

- **Members:** flag their own pieces with an optional photo; see their own flags and photos (open and cleared). No access to inventory management or other members' history.
- **Staff:** see all flags, photos, history and inventory; clear flags; edit history entries (color, status, comment, staff note); import; add piece types, colors and numbers; mark pieces out for repair / back.
- Enforced with RLS as today; `npm run test:rls` must cover the new tables and the photo bucket.

## Existing code to build on

- **Photos:** `expo-image-picker` is installed and already used for combo photos (`screens/AddComboScreen.tsx`, upload in `context/CombosContext.tsx` to the private `combo-images` bucket with signed URLs). Flag photos follow the same pattern in their own private bucket, readable by the flag's member and by staff.
- **Flag sheet:** `screens/member/FlagItemScreen.tsx` (status, comment, submit). The photo slot goes under the comment and is clearly labeled optional. Flags are currently unique per `(member_id, piece, color)` and upserted; with history, a cleared flag no longer blocks a new one on the same piece.
- **Clearing:** `FlagsContext.clearFlag` deletes the row today; it becomes "mark cleared".
- **Archiving:** `archive_member()` deletes the member's flags. It must keep them in history instead (snapshot still taken as today). History entries must keep the member's name even if the profile is later deleted (store a name snapshot; don't rely on `on delete cascade`).
- **Inventory UI:** `screens/InventoryScreen.tsx` and `components/PieceCard.tsx` (expanding card with color groups and size chips; the chips become tappable). The current "Repair · n / Dirty · n" tags that link to the Members list stay.
- **Counted pieces** (Ties, Belts: color + quantity, not numbered) keep working as today and are added with the "counted" kind in goal 8. They don't get per-piece history or assignment.
- `White shirt` is dirty-only on the member side; leave that behavior alone.

## Decided by the user

- Photo is optional, one per flag.
- History is viewed by tapping a piece in Inventory.
- Inventory option A (tint only open flags), plus Assigned / Unassigned filter and the "every piece" table.
- Inventory moves into the app as part of this feature.
- First setup by spreadsheet import (C); new piece types later by B; pants added later with B.
- Unassigned pieces are added to the spreadsheet as `Unassigned` rows before import.
- Seasons: to be decided later.
- Addison Sew rows: the user will find each piece's type and color and update the sheet before importing.
- Repairs notes: attach to every color of the member's coat; staff fix later.
- New piece types are rare, but every member gets fitted and numbered for one.

## Calls made by Claude (user should check)

- Members see their own cleared flags and photos too, not just open ones. Imported "from spreadsheet" notes are staff-only.
- "Out for repair" is a third assignment state, set per piece (one color), based on the Addison Sew rows.
- Addison Sew row format: number under the right column, color in the Repairs cell.
- "Add color to existing type" and "add single number" exist alongside B.
- Staff can edit history entries (added because staff can only clear flags today).
- The import is a merge: it never deletes or un-assigns; staff pick sheet vs app on disagreements.
- Unmatched names and bad rows are listed in the preview and skipped unless fixed.
- One member per number is enforced by the database; unknown numbers only warn.
- "Mark good" clears every open flag on that piece.
- Existing flags carry into history.
- History has no time limit until seasons are designed.
- The word "Assigned" rather than "Checked out".

## Left to the builder

- Table and column design, bucket name and storage paths, RLS policies.
- Photo compression (keep uploads small; picker `quality` or resizing).
- CSV parsing approach and file-picker library (check the versioned Expo docs per `mobile-app/AGENTS.md`).
- Exact screen layouts, following the mockups in `.superpowers/brainstorm/` and the app's existing styles.
- How cached/realtime data for the new tables fits the existing context pattern.

## Open questions

None blocking. Seasons (start/end, ensemble season codes) are deferred by the user and are a separate design.
