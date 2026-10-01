import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OFFLINE_MESSAGE, friendlyError } from '../lib/errors.ts';

test('network failures become the offline message', () => {
  assert.equal(friendlyError(new TypeError('Network request failed')), OFFLINE_MESSAGE);
  assert.equal(friendlyError({ name: 'AuthRetryableFetchError', message: 'x' }), OFFLINE_MESSAGE);
});

test('known Supabase errors get plain-language messages', () => {
  assert.equal(friendlyError({ message: 'Invalid login credentials' }), 'Incorrect email or password.');
  assert.equal(friendlyError({ message: 'User already registered' }), 'An account with this email already exists.');
  assert.equal(
    friendlyError({ message: 'Database error saving new user' }),
    'That invite code is no longer valid. Go back and enter the current code.'
  );
  assert.equal(friendlyError({ code: '42501', message: 'only staff can change roles' }), "You don't have permission to do that.");
  assert.equal(friendlyError({ message: 'new row violates row-level security policy' }), "You don't have permission to do that.");
});

test('unknown errors fall back to their message or a generic one', () => {
  assert.equal(friendlyError(new Error('Boom')), 'Boom');
  assert.equal(friendlyError(undefined), 'Something went wrong. Please try again.');
});

test('the account-created-but-not-loaded message passes through unchanged', () => {
  const message = "Your account was created, but we couldn't load it. Please log in.";
  assert.equal(friendlyError(new Error(message)), message);
});
