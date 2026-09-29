import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startupAction } from '../lib/startup.ts';

test('valid session with a matching cached account shows the cache, then refreshes', () => {
  assert.equal(startupAction({ sessionUserId: 'u1', sessionErrorIsNetwork: false, cachedAccountId: 'u1' }), 'use-cache-then-refresh');
});

test('valid session without a usable cache must load the profile first', () => {
  assert.equal(startupAction({ sessionUserId: 'u1', sessionErrorIsNetwork: false, cachedAccountId: null }), 'load-profile');
  assert.equal(startupAction({ sessionUserId: 'u1', sessionErrorIsNetwork: false, cachedAccountId: 'other' }), 'load-profile');
});

test('offline with an expired token keeps the cached account instead of logging out', () => {
  assert.equal(startupAction({ sessionUserId: null, sessionErrorIsNetwork: true, cachedAccountId: 'u1' }), 'use-cache-offline');
});

test('no session otherwise means signed out', () => {
  assert.equal(startupAction({ sessionUserId: null, sessionErrorIsNetwork: false, cachedAccountId: 'u1' }), 'signed-out');
  assert.equal(startupAction({ sessionUserId: null, sessionErrorIsNetwork: true, cachedAccountId: null }), 'signed-out');
});
