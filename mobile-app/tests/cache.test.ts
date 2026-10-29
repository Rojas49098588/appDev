import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCache, serializeCache } from '../lib/cache.ts';
import { isAccount, isComboList, isFlagList, isGameList } from '../lib/validators.ts';

test('serializeCache and parseCache round-trip valid data', () => {
  const flags = [{ id: 'f1', memberId: 'u1', piece: 'Coats', color: 'Blue', size: '208', status: 'dirty', comment: '', createdAt: '2026-10-01T00:00:00Z', memberName: 'Maya C', photoPath: null, staffNote: '', source: 'member', clearedAt: null, clearedByName: null }];
  assert.deepEqual(parseCache(serializeCache(flags, 123), isFlagList), { syncedAt: 123, data: flags });
});

test('parseCache rejects missing, corrupt, or wrongly shaped data', () => {
  assert.equal(parseCache(null, isFlagList), null);
  assert.equal(parseCache('{not json', isFlagList), null);
  assert.equal(parseCache(JSON.stringify({ data: [] }), isFlagList), null);
  assert.equal(parseCache(serializeCache([{ id: 'f1' }], 1), isFlagList), null);
});

test('isGameList accepts cached games and rejects the old shape', () => {
  const game = {
    id: 'g1', sport: 'football', division: null, status: 'ready', opponent: 'Rice', gameDate: null,
    kickoffTime: '11:00', callTime: null, noCallTime: true, polo: [{ name: 'Red', swatch: '#C8102E' }],
    poloNote: '', groupNumber: null, preGameComboId: null, halftimeComboId: null,
    afterGameInstructions: '', instructionsPostedBy: '', instructionsUpdatedAt: '',
  };
  assert.deepEqual(parseCache(serializeCache([game], 5), isGameList), { syncedAt: 5, data: [game] });
  assert.equal(parseCache(serializeCache([{ id: 'g1', opponent: 'Rice', date: 'Fri, Sep 18' }], 5), isGameList), null);
});

test('isComboList accepts combos with and without photos', () => {
  assert.equal(isComboList([{ id: 'c1', label: 'A', sub: '' }, { id: 'c2', label: 'B', sub: '', components: [], imagePath: 'x.jpg', image: 'u' }]), true);
  assert.equal(isComboList([{ id: 'c1', label: 'A', sub: '', components: [1] }]), false);
});

test('isAccount requires an id (old on-device accounts without one are rejected)', () => {
  const account = {
    id: 'u1', email: 'a@b.co', firstName: 'A', lastName: 'B', instrument: 'Tuba', role: 'Member', phone: '',
    shoeSize: { gender: "Men's", size: '' }, height: { feet: '', inches: '' }, weight: '',
    numbers: {}, archivedAt: null,
  };
  assert.equal(isAccount(account), true);
  const { id: _id, ...legacy } = account;
  assert.equal(isAccount(legacy), false);
});

test('isAccount rejects accounts cached before uniform sizes and archiving existed', () => {
  const account = {
    id: 'u1', email: 'a@b.co', firstName: 'A', lastName: 'B', instrument: 'Tuba', role: 'Member', phone: '',
    shoeSize: { gender: "Men's", size: '' }, height: { feet: '', inches: '' }, weight: '',
    numbers: { Coats: '208' }, archivedAt: '2026-10-07T00:00:00Z',
  };
  assert.equal(isAccount(account), true);
  const { numbers: _sizes, ...noSizes } = account;
  assert.equal(isAccount(noSizes), false);
  const { archivedAt: _archived, ...noArchive } = account;
  assert.equal(isAccount(noArchive), false);
  assert.equal(isAccount({ ...account, numbers: { Coats: 208 } }), false);
  assert.equal(isAccount({ ...noSizes, uniformSizes: { coats: '208', vests: '', bibbers: '', pants: '' } }), false);
});
