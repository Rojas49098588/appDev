import { test } from 'node:test';
import assert from 'node:assert/strict';
import { removeById, uniqueTopic, upsertById } from '../lib/realtime.ts';

test('upsertById appends new items and replaces existing ones in place', () => {
  const list = [{ id: 'a', v: 1 }, { id: 'b', v: 1 }];
  assert.deepEqual(upsertById(list, { id: 'c', v: 1 }), [...list, { id: 'c', v: 1 }]);
  assert.deepEqual(upsertById(list, { id: 'a', v: 2 }), [{ id: 'a', v: 2 }, { id: 'b', v: 1 }]);
  assert.deepEqual(list, [{ id: 'a', v: 1 }, { id: 'b', v: 1 }], 'input is not mutated');
});

test('removeById drops the matching item and ignores unknown ids', () => {
  assert.deepEqual(removeById([{ id: 'a' }, { id: 'b' }], 'a'), [{ id: 'b' }]);
  assert.deepEqual(removeById([{ id: 'a' }], 'zzz'), [{ id: 'a' }]);
});

test('uniqueTopic keeps the base and adds a per-call suffix', () => {
  assert.equal(uniqueTopic('flags:u1', 1700000000000, 0.5), 'flags:u1:1700000000000-i');
  const a = uniqueTopic('flags:u1');
  const b = uniqueTopic('flags:u1');
  assert.ok(a.startsWith('flags:u1:'));
  assert.notEqual(a, b, 'two calls in the same millisecond still differ');
});
