# Test cases: adding a new piece type to the uniform inventory

## Background

Mustang Closet tracks the band's uniform inventory. Each uniform item, such as a coat or
bibber, belongs to a **piece type**, and each physical item has a **number** sewn into it
(for example, coat #104). Some piece types also come in **colors**.

When the band gets a new kind of uniform piece, a staff member adds it on the
**New piece type** screen (Inventory → add piece type). The form has:
- **Name**, for example "Coats 2027".
- **Kind**: "Numbered (one per number)" for items that each have their own number, or
  "Counted" for items like ties that are only counted.
- **Colors**: typed one at a time and added with an **Add** button.
- **Numbers**: typed into a box and added to the list with an **Add** button. Staff can type
  single numbers (`104, 112`) or a range (`104 to 120 every 4`, meaning 104, 108, 112, 116,
  120). Pressing Add more than once adds to the same list.
- **Save piece type**: sends everything to the database in one step.

The app creates one inventory item for every number in every color. For example, 5 numbers
in 2 colors makes 10 items.

## Rules the app should enforce

- A piece type may not have more than **1000 numbers**. This stops a typo (say `1 to 10000`
  instead of `1 to 100`) from filling the inventory with thousands of fake items.
- Unreadable input adds **nothing** and shows a message. The app never keeps part of an entry.
- Two piece types can't share a name, regardless of capitalization.
- Changes require an internet connection.

## Starting conditions for every case

A staff member is signed in and on **New piece type**. The form is empty and Kind is set to
**Numbered**.

---

### Case 1: Ordinary (normal use)
- **Also given:** the phone is online.
- **Action:** Name `Coats 2027`. Add color `Red`. In Numbers, type `104 to 120 every 4` and
  press Add. Press **Save piece type**.
- **Expected:** the list shows 104, 108, 112, 116, 120. Save is allowed: the piece type is
  created with those 5 numbers in Red (5 items).
- **Why:** counting from 104 by 4 reaches 120 exactly, and ranges include both ends. This is
  the everyday way staff use the form.

### Case 2: Boundary (exactly at the limit)
- **Also given:** online. Name and one color filled in.
- **Action:** add `1 to 500`, then add `501 to 1000`, then press Save.
- **Expected:** allowed. 1000 numbers are saved.
- **Why:** the limit is "no more than 1000", so exactly 1000 must be accepted. Testing right
  at the limit catches mistakes like using "less than" where it should be "less than or
  equal to".

### Case 3: Boundary (one past the limit)
- **Also given:** the Numbers list already holds 1 through 1000.
- **Action:** type `1001` and press Add.
- **Expected:** rejected with "That would make more than 1000 numbers in this piece type".
  The list stays at 1000.
- **Why:** a limit that only applies to each Add press can be bypassed by pressing Add
  again. The total is what affects the inventory, so the total is what should be limited.
- **History:** this case found a bug. The app checked each entry separately but not the
  running total, so 1001 was accepted. The test was written first, failed, and then the app
  was fixed to check the total.
- **Related case:** re-adding a number already in a full list (`500`) is allowed, because
  it doesn't increase the total.

### Case 4: Failure (bad input after good input)
- **Also given:** the Numbers list already holds 104, 108, 112, 116, 120.
- **Action:** type `1 to 3, x` and press Add.
- **Expected:** an alert "Can't read those numbers" with `"x" isn't a number`. The list
  still holds the same 5 numbers. 1, 2 and 3 are **not** added even though they were valid.
- **Why:** if the app kept the valid part, staff could think the whole entry worked and miss
  that something was skipped. Rejecting the whole entry makes them fix it.

### Case 5: Failure (no internet)
- **Also given:** the phone is offline. The form is filled in as in Case 1.
- **Action:** press **Save piece type**.
- **Expected:** an alert "You're offline: Connect to the internet to make changes." Nothing
  is saved.
- **Why:** inventory is shared by every staff member, so changes must go straight to the
  database. Saving offline could create conflicting copies.

### Case 6: Failure (duplicate name)
- **Also given:** online. A piece type named `Coats` already exists.
- **Action:** Name `coats` (lowercase). Fill in a color and numbers, then press Save.
- **Expected:** an alert "Couldn't add piece type" with "a piece type named coats already
  exists". Nothing new is saved.
- **Why:** two piece types that differ only by capitalization would confuse staff and split
  one kind of piece across two lists.

---

## How the cases are automated

The form's rules are in `mobile-app/lib/pieceTypeForm.ts`, which the screen uses. That way
they can be tested without a phone.

| Case | Automated test |
|------|----------------|
| 1–5 | `mobile-app/tests/pieceTypeForm.test.ts` (run with `npm test`) |
| 6 | The database refusal is tested in `mobile-app/supabase/tests/rls.test.ts` ("duplicate name refused", run with `npm run test:rls` against the TEST database). `tests/pieceTypeForm.test.ts` checks that the app shows that refusal to staff word for word. |

The tests check the rules the screen uses, not the screen itself. For example, they don't
check that the alert pops up or that the screen goes back after saving.
