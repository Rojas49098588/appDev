import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  assignmentFor, mapPiecesToTypes, memberPieceTypes, numberRows, ownerIndex, pieceCount, unknownNumbers,
} from '../lib/inventory.ts';
import type { Account, InventoryPiece, PieceType } from '../lib/models.ts';

const acct = (id: string, first: string, numbers: Record<string, string>, over: Partial<Account> = {}): Account => ({
  id, email: `${id}@smu.edu`, firstName: first, lastName: 'X', instrument: 'Tuba', role: 'Member', phone: '',
  shoeSize: { gender: "Men's", size: '' }, height: { feet: '', inches: '' }, weight: '', numbers, archivedAt: null,
  ...over,
});
const piece = (id: string, type: string, color: string, number: string, outForRepair = false): InventoryPiece => ({
  id, pieceTypeId: `t-${type}`, pieceType: type, color, number, outForRepair,
});
const type = (name: string, kind: 'numbered' | 'counted', over: Partial<PieceType> = {}): PieceType => ({
  id: `t-${name}`, name, kind, colors: ['Blue', 'White'], stock: {}, sortOrder: 0, retired: false, ...over,
});

const maya = acct('u1', 'Maya', { Coats: '104' });

test('ownerIndex ignores archived members and staff', () => {
  const owners = ownerIndex([
    maya,
    acct('u2', 'Old', { Coats: '96' }, { archivedAt: '2026-10-01T00:00:00Z' }),
    acct('s1', 'Staff', { Coats: '97' }, { role: 'Staff' }),
  ]);
  assert.deepEqual([...owners.keys()], ['Coats|104']);
  assert.equal(owners.get('Coats|104')?.id, 'u1');
});

test('assignmentFor: assigned, unassigned, out for repair keeps owner', () => {
  const owners = ownerIndex([maya]);
  assert.deepEqual(assignmentFor(piece('p1', 'Coats', 'Blue', '104'), owners),
    { state: 'assigned', memberId: 'u1', memberName: 'Maya X' });
  assert.deepEqual(assignmentFor(piece('p2', 'Coats', 'Blue', '96'), owners), { state: 'unassigned' });
  assert.deepEqual(assignmentFor(piece('p3', 'Coats', 'Blue', '104', true), owners),
    { state: 'out_for_repair', memberId: 'u1', memberName: 'Maya X' });
  assert.deepEqual(assignmentFor(piece('p4', 'Coats', 'Blue', '96', true), owners),
    { state: 'out_for_repair', memberId: null, memberName: null });
});

test('unknownNumbers lists numbers with no matching piece', () => {
  const accounts = [
    acct('u1', 'Maya', { Coats: '1530' }),
    acct('u2', 'Jo', { Coats: '104', Vests: '' }),
    acct('u3', 'Gone', { Coats: '999' }, { archivedAt: '2026-10-01T00:00:00Z' }),
  ];
  assert.deepEqual(unknownNumbers(accounts, [piece('p1', 'Coats', 'Blue', '104')]), [
    { memberId: 'u1', memberName: 'Maya X', pieceType: 'Coats', number: '1530' },
  ]);
});

test('numberRows: one row per number, numeric order, null cells for missing colors', () => {
  const pieces = [
    piece('a', 'Coats', 'Blue', '104'), piece('b', 'Coats', 'Blue', '96'), piece('c', 'Coats', 'White', '96'),
    piece('d', 'Vests', 'Blue', '5'),
  ];
  const rows = numberRows(type('Coats', 'numbered'), pieces, ownerIndex([maya]));
  assert.deepEqual(rows.map((r) => r.number), ['96', '104']);
  assert.equal(rows[0].owner, null);
  assert.equal(rows[1].owner?.id, 'u1');
  assert.equal(rows[0].cells.White?.id, 'c');
  assert.equal(rows[1].cells.White, null);
  assert.equal(rows[1].cells.Blue?.id, 'a');
});

test('memberPieceTypes: numbered types with pieces only (no counted, retired or empty types)', () => {
  const types = [
    type('Vests', 'numbered', { sortOrder: 3 }),
    type('Coats', 'numbered', { sortOrder: 2 }),
    type('Ties', 'counted', { sortOrder: 1, stock: { Blue: 5 } }),
    type('Old', 'counted', { retired: true }),
    type('Hats', 'numbered', { retired: true }),
    type('Gloves', 'numbered', { sortOrder: 0 }),
  ];
  const pieces = [piece('a', 'Coats', 'Blue', '1'), piece('b', 'Hats', 'Blue', '1'), piece('c', 'Vests', 'Blue', '2')];
  assert.deepEqual(memberPieceTypes(types, pieces).map((t) => t.name), ['Coats', 'Vests']);
});

test('pieceCount: numbered counts pieces, counted sums stock', () => {
  const pieces = [piece('a', 'Coats', 'Blue', '1'), piece('b', 'Coats', 'Blue', '2'), piece('c', 'Vests', 'Blue', '1')];
  assert.equal(pieceCount(type('Coats', 'numbered'), pieces), 2);
  assert.equal(pieceCount(type('Ties', 'counted', { stock: { Blue: 3, White: 4 } }), pieces), 7);
});

test('mapPiecesToTypes names pieces and reports pieces whose type is missing', () => {
  const types = [{ id: 't1', name: 'Coats', kind: 'numbered', colors: [], stock: {}, sortOrder: 0, retired: false }] as PieceType[];
  const row = (id: string, t: string) => ({ id, piece_type_id: t, color: 'Black', number: '1', out_for_repair: false, created_at: '' });
  const out = mapPiecesToTypes([row('a', 't1'), row('b', 't2'), row('c', 't2')], types);
  assert.deepEqual(out.pieces.map((p) => [p.id, p.pieceType]), [['a', 'Coats']]);
  assert.deepEqual(out.unknownTypeIds, ['t2']);
});
