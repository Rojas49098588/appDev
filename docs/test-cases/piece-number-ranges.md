# Test cases: turning typed piece numbers into a list

## Behavior under test

On **Add piece type** (staff only), staff type the numbers for a new uniform piece into one
box, for example `104 to 120 every 4`. `parseNumberList` in `mobile-app/lib/import/rows.ts`
turns that text into the list of numbers the app creates.

This behavior matters because each number becomes an inventory item. If the list is wrong,
the inventory is wrong: numbers are missing, extra or duplicated, or a typo creates
thousands of items.

The rules the cases check:
- A range includes both ends when they fall on the step (`every`, default 1).
- One entry can produce at most **1000** numbers.
- Bad input creates **nothing** and shows a message instead of a partial list.

## Test cases

All cases start from the same condition: a staff member is signed in and on **Add piece
type**, with an empty numbers box.

| # | Kind | Input typed | Expected result |
|---|------|-------------|-----------------|
| 1 | Ordinary | `104 to 120 every 4` | 5 numbers: 104, 108, 112, 116, 120. No error. |
| 2 | Boundary (at the limit) | `1 to 1000` | 1000 numbers, 1 through 1000. No error. |
| 3 | Boundary (one past the limit) | `1 to 1001` | No numbers. Error: "That range is more than 1000 numbers". |
| 4 | Failure (reversed range) | `120 to 104` | No numbers. Error: `In "120 to 104" the start must not be after the end`. |
| 5 | Boundary (smallest range) | `7 to 7` | 1 number: 7. No error. |

### Why these results are correct

1. **Ordinary.** Start at 104 and add 4 until passing 120: 104, 108, 112, 116, 120. Both
   ends are included because 120 − 104 = 16 is a multiple of 4.
2. **At the limit.** 1 to 1000 inclusive is 1000 − 1 + 1 = 1000 numbers, exactly the
   maximum. The limit allows "up to 1000", so this must succeed.
3. **One past the limit.** 1 to 1001 is 1001 numbers, one over. The app rejects the whole
   entry instead of creating the first 1000, so staff never get a silently cut-off list.
   The count is checked before any numbers are generated.
4. **Reversed range.** A start after the end is almost always a typo. Returning an empty
   list with no error would look like success, so the app reports the mistake instead.
5. **Smallest range.** Start equals end. Because ranges include both ends, the result is
   one number, not zero.

## What the tests establish

- Cases 2 and 3 pin the limit to exactly 1000. An off-by-one mistake, such as using `<`
  instead of `<=` or forgetting the `+ 1` in the count, would fail one of them. The
  existing test only tried `1 to 5000`, which would pass even with that mistake.
- Cases 1 and 5 show that both ends are included and that the step is applied correctly.
- Cases 3 and 4 show that invalid input produces an error and an empty list, never a
  partial one.

The tests do **not** cover the screen itself, such as whether the error appears in red or
whether Save is disabled. They test the rule the screen relies on.

## Where the automated tests are

`mobile-app/tests/importCsv.test.ts`, test "parseNumberList: documented test cases (docs/test-cases)".
Run them with:

```
cd "C:\dev\App Dev\mobile-app"
npm test
```
