// The six "New piece type" cases in docs/test-cases/add-piece-type.md, numbered the same way.
// The screen's rules live in lib/pieceTypeForm.ts so they can be tested without a phone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addNumbers, saveProblem } from '../lib/pieceTypeForm.ts';
import { friendlyError } from '../lib/errors.ts';

const coats = { name: 'Coats 2027', kind: 'numbered' as const, colors: ['Red'], isOnline: true };

test('case 1 (ordinary): a range is added and the piece type can be saved', () => {
  const added = addNumbers([], '104 to 120 every 4');
  assert.deepEqual(added, { numbers: ['104', '108', '112', '116', '120'], error: null });
  assert.equal(saveProblem({ ...coats, numbers: added.numbers }), null);
});

test('case 2 (boundary): two Adds reaching exactly 1000 numbers are allowed', () => {
  const first = addNumbers([], '1 to 500');
  const second = addNumbers(first.numbers, '501 to 1000');
  assert.equal(second.error, null);
  assert.equal(second.numbers.length, 1000);
  assert.equal(saveProblem({ ...coats, numbers: second.numbers }), null);
});

test('case 3 (boundary): adding a 1001st number is rejected and the list stays at 1000', () => {
  const full = addNumbers([], '1 to 1000').numbers;
  const over = addNumbers(full, '1001');
  assert.match(over.error ?? '', /more than 1000 numbers/);
  assert.deepEqual(over.numbers, full);
});

test('case 3 (related): re-adding a number already in a full list is fine', () => {
  const full = addNumbers([], '1 to 1000').numbers;
  assert.deepEqual(addNumbers(full, '500'), { numbers: full, error: null });
});

test('case 4 (failure): a bad entry adds nothing, not even its valid part', () => {
  const start = ['104', '108', '112', '116', '120'];
  assert.deepEqual(addNumbers(start, '1 to 3, x'), { numbers: start, error: '"x" isn\'t a number' });
});

test('case 5 (failure): saving offline is blocked with the offline message', () => {
  const numbers = addNumbers([], '104 to 120 every 4').numbers;
  assert.deepEqual(saveProblem({ ...coats, numbers, isOnline: false }), {
    title: "You're offline",
    message: 'Connect to the internet to make changes.',
  });
});

// The database refuses the duplicate (supabase/tests/rls.test.ts, "duplicate name refused");
// this checks the app shows that refusal to staff word for word.
test('case 6 (failure): the duplicate-name refusal is shown as-is', () => {
  const refusal = { code: '23505', message: 'a piece type named coats already exists' };
  assert.equal(friendlyError(refusal), 'a piece type named coats already exists');
});

test('numbers are kept in numeric order across Adds', () => {
  assert.deepEqual(addNumbers(['9', '120'], '104').numbers, ['9', '104', '120']);
});

test('save needs a name, a color and, for numbered types, a number', () => {
  assert.equal(saveProblem({ ...coats, name: '  ', numbers: ['1'] })?.title, 'Name needed');
  assert.equal(saveProblem({ ...coats, colors: [], numbers: ['1'] })?.title, 'Colors needed');
  assert.equal(saveProblem({ ...coats, numbers: [] })?.title, 'Numbers needed');
  assert.equal(saveProblem({ ...coats, kind: 'counted', numbers: [] }), null);
});

test('counted types ask for a size or color', () => {
  assert.deepEqual(saveProblem({ ...coats, kind: 'counted', colors: [], numbers: [] }), {
    title: 'Sizes or colors needed',
    message: 'Add at least one size or color.',
  });
});
