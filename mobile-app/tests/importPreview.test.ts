import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPreview, matchName, toPayload, DEFAULT_COLORS } from '../lib/import/preview.ts';
import type { SheetRow } from '../lib/import/rows.ts';
import type { Account, InventoryPiece, PieceType } from '../lib/models.ts';

const acct = (
  id: string,
  firstName: string,
  lastName: string,
  numbers: Record<string, string> = {},
  archivedAt: string | null = null,
): Account =>
  ({ id, email: '', firstName, lastName, instrument: '', role: 'member', phone: '', shoeSize: '', height: '', weight: '', numbers, archivedAt }) as unknown as Account;
const type = (name: string, colors: string[]): PieceType => ({
  id: `t-${name}`,
  name,
  kind: 'numbered',
  colors,
  stock: {},
  sortOrder: 0,
  retired: false,
});
const piece = (pieceType: string, color: string, number: string, outForRepair = false): InventoryPiece => ({
  id: `${pieceType}-${color}-${number}`,
  pieceTypeId: `t-${pieceType}`,
  pieceType,
  color,
  number,
  outForRepair,
});
const member = (line: number, name: string, numbers: Record<string, string>, repairs = ''): SheetRow => ({
  line,
  kind: 'member',
  name,
  numbers,
  repairs,
});

const allTypes = [
  type('Coats', DEFAULT_COLORS.Coats),
  type('Bibbers', DEFAULT_COLORS.Bibbers),
  type('Vests', DEFAULT_COLORS.Vests),
];
const none: { memberName: string; pieceType: string }[] = [];

test('matchName: exact, reversed order, ambiguous, archived, missing', () => {
  const ann = acct('1', 'Ann', 'Lee');
  const dup1 = acct('2', 'Sam', 'Kim');
  const dup2 = acct('3', 'Sam', 'Kim');
  const old = acct('4', 'Old', 'Timer', {}, '2026-01-01');
  const all = [ann, dup1, dup2, old];
  assert.deepEqual(matchName('  lee   ANN ', all), { status: 'matched', account: ann });
  assert.deepEqual(matchName('Ann Lee', all), { status: 'matched', account: ann });
  assert.equal(matchName('Kim Sam', all).status, 'ambiguous');
  assert.deepEqual(matchName('Timer Old', all), { status: 'archived', account: old });
  assert.deepEqual(matchName('Nobody Here', all), { status: 'none' });
});

test('buildPreview creates missing types with default colors', () => {
  const plan = buildPreview(
    [member(2, 'Lee Ann', { Vests: '5' })],
    [acct('1', 'Ann', 'Lee')],
    [type('Coats', ['Blue'])],
    [],
    none,
  );
  assert.deepEqual(plan.typesToCreate, [{ name: 'Vests', colors: ['Candy', 'Red'] }]);
});

test('buildPreview adds every listed number once, skipping existing pieces', () => {
  const rows: SheetRow[] = [
    member(2, 'Lee Ann', { Coats: '10' }),
    { line: 3, kind: 'unassigned', numbers: { Coats: '10', Bibbers: '7' } },
    { line: 4, kind: 'repair_shop', pieceType: 'Coats', number: '11', color: 'Red' },
    member(5, 'Lee Ann', { Coats: '12' }),
  ];
  const plan = buildPreview(rows, [acct('1', 'Ann', 'Lee')], allTypes, [piece('Coats', 'Red', '12')], none);
  assert.deepEqual(plan.piecesToAdd, [
    { pieceType: 'Coats', number: '10' },
    { pieceType: 'Bibbers', number: '7' },
    { pieceType: 'Coats', number: '11' },
  ]);
});

test('buildPreview reports unmatched, ambiguous and archived names', () => {
  const accounts = [acct('2', 'Sam', 'Kim'), acct('3', 'Sam', 'Kim'), acct('4', 'Old', 'Timer', {}, '2026-01-01')];
  const rows = [
    member(2, 'Nobody Here', { Coats: '1' }),
    member(3, 'Kim Sam', { Coats: '2' }),
    member(4, 'Timer Old', { Coats: '3' }),
  ];
  const plan = buildPreview(rows, accounts, allTypes, [], none);
  assert.deepEqual(
    plan.problems.map((p) => p.message),
    [
      'Line 2: no app account for "Nobody Here"',
      'Line 3: "Kim Sam" matches more than one account',
      'Line 4: "Timer Old" is archived',
    ],
  );
  assert.deepEqual(plan.numbers, []);
  assert.equal(plan.piecesToAdd.length, 3);
});

test('buildPreview flags a number that would belong to two members', () => {
  const accounts = [
    acct('1', 'Ann', 'Lee'),
    acct('2', 'Bob', 'Ray'),
    acct('3', 'Cy', 'Poe', { Coats: '30' }),
    acct('4', 'Di', 'Fox', { Coats: '40' }, '2026-01-01'),
  ];
  const rows = [member(2, 'Lee Ann', { Coats: '20' }), member(3, 'Ray Bob', { Coats: '20' })];
  const plan = buildPreview(rows, accounts, allTypes, [], none);
  assert.deepEqual(plan.numbers, []);
  assert.deepEqual(
    plan.problems.map((p) => p.message),
    ["Line 2: Coats 20 is also Bob Ray's", "Line 3: Coats 20 is also Ann Lee's"],
  );
  const vsExisting = buildPreview([member(2, 'Lee Ann', { Coats: '30' })], accounts, allTypes, [], none);
  assert.deepEqual(
    vsExisting.problems.map((p) => p.message),
    ["Line 2: Coats 30 is also Cy Poe's"],
  );
  assert.deepEqual(vsExisting.numbers, []);
  // An archived account's old number is not a clash.
  assert.equal(buildPreview([member(2, 'Lee Ann', { Coats: '40' })], accounts, allTypes, [], none).numbers.length, 1);
});

test('buildPreview: differing number defaults to sheet, equal number omitted', () => {
  const accounts = [acct('1', 'Ann', 'Lee', { Coats: '10', Vests: '3' }), acct('2', 'Bob', 'Ray')];
  const rows = [member(2, 'Lee Ann', { Coats: '11', Vests: '3' }), member(3, 'Ray Bob', { Coats: '12' })];
  const plan = buildPreview(rows, accounts, allTypes, [], none);
  assert.deepEqual(plan.numbers, [
    { line: 2, memberId: '1', memberName: 'Ann Lee', pieceType: 'Coats', sheet: '11', current: '10', choice: 'sheet' },
    { line: 3, memberId: '2', memberName: 'Bob Ray', pieceType: 'Coats', sheet: '12', current: null, choice: 'sheet' },
  ]);
});

test('buildPreview skips notes already imported for that member', () => {
  const accounts = [acct('1', 'Ann', 'Lee'), acct('2', 'Bob', 'Ray')];
  const rows = [
    member(2, 'Lee Ann', { Coats: '10' }, 'torn sleeve'),
    member(3, 'Lee Ann', { Coats: '10' }, 'torn sleeve again'),
    member(4, 'Ray Bob', { Coats: '11' }, 'missing button'),
  ];
  const first = buildPreview(rows, accounts, allTypes, [], none);
  assert.deepEqual(first.notes, [
    { memberId: '1', memberName: 'Ann Lee', pieceType: 'Coats', number: '10', current: null, text: 'torn sleeve' },
    { memberId: '2', memberName: 'Bob Ray', pieceType: 'Coats', number: '11', current: null, text: 'missing button' },
  ]);
  const again = buildPreview(rows, accounts, allTypes, [], [{ memberName: 'Ann Lee', pieceType: 'Coats' }]);
  assert.deepEqual(again.notes.map((n) => n.memberName), ['Bob Ray']);
});

test('buildPreview rejects an Addison Sew color not in the type', () => {
  const rows: SheetRow[] = [
    { line: 2, kind: 'repair_shop', pieceType: 'Vests', number: '5', color: 'Blue' },
    { line: 3, kind: 'repair_shop', pieceType: 'Vests', number: '6', color: 'red' },
    { line: 4, kind: 'repair_shop', pieceType: 'Vests', number: '7', color: 'Red' },
  ];
  const plan = buildPreview(rows, [], allTypes, [piece('Vests', 'Red', '7', true)], none);
  assert.deepEqual(plan.problems.map((p) => p.message), ["Line 2: Blue isn't a Vests color"]);
  assert.deepEqual(plan.outForRepair, [{ pieceType: 'Vests', color: 'Red', number: '6' }]);
});

test('preview of an already-applied sheet has no changes', () => {
  const accounts = [acct('1', 'Ann', 'Lee', { Coats: '10' })];
  const pieces = [
    ...DEFAULT_COLORS.Coats.flatMap((c) => [piece('Coats', c, '10'), piece('Coats', c, '11'), piece('Coats', c, '12')]),
    piece('Bibbers', 'Blue', '7'),
  ];
  pieces.find((p) => p.pieceType === 'Coats' && p.color === 'Red' && p.number === '12')!.outForRepair = true;
  const rows: SheetRow[] = [
    member(2, 'Lee Ann', { Coats: '10' }, 'torn'),
    { line: 3, kind: 'unassigned', numbers: { Coats: '11', Bibbers: '7' } },
    { line: 4, kind: 'repair_shop', pieceType: 'Coats', number: '12', color: 'Red' },
  ];
  const plan = buildPreview(rows, accounts, allTypes, pieces, [{ memberName: 'Ann Lee', pieceType: 'Coats' }]);
  assert.deepEqual(plan, { typesToCreate: [], piecesToAdd: [], outForRepair: [], numbers: [], notes: [], problems: [] });
});

test('toPayload drops keep-app choices', () => {
  const accounts = [acct('1', 'Ann', 'Lee', { Coats: '10' }), acct('2', 'Bob', 'Ray', { Coats: '20' })];
  const plan = buildPreview(
    [member(2, 'Lee Ann', { Coats: '11' }), member(3, 'Ray Bob', { Coats: '21' })],
    accounts,
    allTypes,
    [],
    none,
  );
  plan.numbers[0].choice = 'app';
  const payload = toPayload(plan);
  assert.deepEqual(payload.numbers, [{ memberId: '2', pieceType: 'Coats', number: '21' }]);
  assert.deepEqual(payload.piecesToAdd, plan.piecesToAdd);
});

test('equal-then-different numbers for one member and type is reported, not dropped', () => {
  const accounts = [acct('1', 'Ann', 'Lee', { Coats: '10' })];
  const plan = buildPreview([member(2, 'Lee Ann', { Coats: '10' }), member(3, 'Lee Ann', { Coats: '11' })], accounts, allTypes, [], none);
  assert.deepEqual(plan.problems.map((p) => p.message), ['Line 3: Ann Lee has two Coats numbers in the sheet']);
  assert.deepEqual(plan.numbers, []);
});

test('a repairs note with no coat number is reported as a problem', () => {
  const accounts = [acct('1', 'Ann', 'Lee'), acct('2', 'Bob', 'Ray', { Coats: '20' })];
  const rows = [member(2, 'Lee Ann', { Vests: '4' }, 'torn'), member(3, 'Ray Bob', { Vests: '5' }, 'loose')];
  const plan = buildPreview(rows, accounts, allTypes, [], none);
  assert.deepEqual(plan.problems.map((p) => p.message), ['Line 2: repairs note for "Ann Lee" skipped (no coat number)']);
  // Bob has a current coat, so his note lands on it.
  assert.deepEqual(plan.notes, [{ memberId: '2', memberName: 'Bob Ray', pieceType: 'Coats', number: '20', current: '20', text: 'loose' }]);
});

test('note follows the coat number after import: keep-app uses the current number', () => {
  const accounts = [acct('1', 'Ann', 'Lee', { Coats: '10' })];
  const plan = buildPreview([member(2, 'Lee Ann', { Coats: '11' }, 'torn')], accounts, allTypes, [], none);
  assert.equal(plan.notes[0].number, '11');
  assert.equal(toPayload(plan).notes[0].number, '11');
  plan.numbers[0].choice = 'app';
  assert.equal(toPayload(plan).notes[0].number, '10');
  assert.equal('memberId' in toPayload(plan).notes[0], false);
});

test('a clash-skipped coat change puts the note on the current number', () => {
  const accounts = [acct('1', 'Ann', 'Lee', { Coats: '10' }), acct('3', 'Cy', 'Poe', { Coats: '30' })];
  const plan = buildPreview([member(2, 'Lee Ann', { Coats: '30' }, 'torn')], accounts, allTypes, [], none);
  assert.deepEqual(plan.numbers, []);
  assert.equal(plan.notes[0].number, '10');
  assert.equal(toPayload(plan).notes[0].number, '10');
});

test('problems are sorted by line', () => {
  const rows: SheetRow[] = [
    { line: 2, kind: 'repair_shop', pieceType: 'Vests', number: '5', color: 'Blue' },
    member(3, 'Nobody Here', {}),
    { line: 4, kind: 'invalid', reason: 'No name', raw: [] },
  ];
  const plan = buildPreview(rows, [], allTypes, [], none);
  assert.deepEqual(plan.problems.map((p) => p.line), [2, 3, 4]);
  const swapped = buildPreview([rows[1], rows[0]], [], allTypes, [], none);
  assert.deepEqual(swapped.problems.map((p) => p.line), [2, 3]);
});

test('an invalid row becomes a Line n problem', () => {
  const plan = buildPreview([{ line: 7, kind: 'invalid', reason: 'No name', raw: [] }], [], allTypes, [], none);
  assert.deepEqual(plan.problems, [{ line: 7, message: 'Line 7: No name' }]);
});

test('Addison Sew on a new type is validated against DEFAULT_COLORS', () => {
  const rows: SheetRow[] = [
    { line: 2, kind: 'repair_shop', pieceType: 'Bibbers', number: '3', color: 'White' },
    { line: 3, kind: 'repair_shop', pieceType: 'Bibbers', number: '4', color: 'Red' },
  ];
  const plan = buildPreview(rows, [], [], [], none);
  assert.deepEqual(plan.outForRepair, [{ pieceType: 'Bibbers', color: 'White', number: '3' }]);
  assert.deepEqual(plan.problems.map((p) => p.message), ["Line 3: Red isn't a Bibbers color"]);
});

test('toPayload carries typesToCreate and notes', () => {
  const accounts = [acct('1', 'Ann', 'Lee')];
  const plan = buildPreview([member(2, 'Lee Ann', { Vests: '5', Coats: '9' }, 'torn')], accounts, [], [], none);
  const payload = toPayload(plan);
  assert.deepEqual(payload.typesToCreate.map((t) => t.name), ['Vests', 'Coats']);
  assert.deepEqual(payload.notes, [{ memberName: 'Ann Lee', pieceType: 'Coats', number: '9', text: 'torn' }]);
});
