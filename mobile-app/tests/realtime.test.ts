import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BURST_RELOAD_THRESHOLD, channelStatusAction, removeById, shouldReloadForBatch, uniqueTopic, upsertById } from '../lib/realtime.ts';

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

test('shouldReloadForBatch reloads only for bursts above the threshold', () => {
  assert.equal(BURST_RELOAD_THRESHOLD, 50);
  assert.equal(shouldReloadForBatch(0), false);
  assert.equal(shouldReloadForBatch(50), false);
  assert.equal(shouldReloadForBatch(51), true);
});

test('channelStatusAction: first SUBSCRIBED is quiet, later ones and failures reload', () => {
  assert.deepEqual(channelStatusAction('SUBSCRIBED', false), { reload: false, subscribedBefore: true });
  assert.deepEqual(channelStatusAction('SUBSCRIBED', true), { reload: true, subscribedBefore: true });
  assert.deepEqual(channelStatusAction('CHANNEL_ERROR', false), { reload: true, subscribedBefore: false });
  assert.deepEqual(channelStatusAction('TIMED_OUT', true), { reload: true, subscribedBefore: true });
  assert.deepEqual(channelStatusAction('CLOSED', true), { reload: false, subscribedBefore: true });
});
