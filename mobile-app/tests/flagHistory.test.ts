import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chipState, historyFor, openFlags } from '../lib/flagHistory.ts';
import { isFlagList } from '../lib/validators.ts';
import type { Flag } from '../lib/models.ts';

const mk = (id: string, over: Partial<Flag> = {}): Flag => ({
  id, memberId: 'u1', piece: 'Coats', color: 'Blue', size: '104', status: 'dirty', comment: '',
  createdAt: '2026-10-01T00:00:00Z', memberName: 'Jordan P', photoPath: null, staffNote: '',
  source: 'member', clearedAt: null, clearedByName: null, ...over,
});

test('historyFor returns only that piece, newest first, open and cleared', () => {
  const flags = [
    mk('a', { createdAt: '2026-10-01T00:00:00Z' }),
    mk('b', { createdAt: '2026-10-03T00:00:00Z', clearedAt: '2026-10-04T00:00:00Z' }),
    mk('c', { createdAt: '2026-10-02T00:00:00Z' }),
    mk('d', { color: 'White' }),
  ];
  assert.deepEqual(historyFor(flags, 'Coats', 'Blue', '104').map((f) => f.id), ['b', 'c', 'a']);
});

test('chipState: repair beats dirty; cleared flags are ignored; null when none', () => {
  const cleared = '2026-10-05T00:00:00Z';
  assert.equal(chipState([], 'Coats', 'Blue', '104'), null);
  assert.equal(chipState([mk('a', { status: 'repair', clearedAt: cleared })], 'Coats', 'Blue', '104'), null);
  assert.equal(chipState([mk('a')], 'Coats', 'Blue', '104'), 'dirty');
  assert.equal(chipState([mk('a'), mk('b', { status: 'repair' })], 'Coats', 'Blue', '104'), 'repair');
  assert.equal(chipState([mk('a', { status: 'repair', clearedAt: cleared }), mk('b')], 'Coats', 'Blue', '104'), 'dirty');
});

test('openFlags drops cleared flags', () => {
  const flags = [mk('a'), mk('b', { clearedAt: '2026-10-05T00:00:00Z' })];
  assert.deepEqual(openFlags(flags).map((f) => f.id), ['a']);
});

test('isFlagList rejects pre-history cached flags', () => {
  assert.equal(isFlagList([{ id: 'f', memberId: 'u', piece: 'Coats', color: 'Blue', size: '1', status: 'dirty', comment: '' }]), false);
  assert.equal(isFlagList([mk('a'), mk('b', { memberId: null, photoPath: 'x.jpg', photoUrl: 'https://s' })]), true);
});
