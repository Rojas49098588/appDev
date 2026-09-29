import { test } from 'node:test';
import assert from 'node:assert/strict';
import { removeById, upsertById } from '../lib/realtime.ts';

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
