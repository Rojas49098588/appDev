import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanResetCode, resetFormProblem } from '../lib/passwordReset.ts';

test('cleanResetCode keeps only digits', () => {
  assert.equal(cleanResetCode(' 123 456 '), '123456');
  assert.equal(cleanResetCode('12-34-56'), '123456');
  assert.equal(cleanResetCode(''), '');
});

test('a missing or malformed code is a problem', () => {
  assert.equal(resetFormProblem('', 'secret1', 'secret1'), 'Enter the code from the email.');
  assert.equal(resetFormProblem('12345', 'secret1', 'secret1'), "That doesn't look like the full code. Check the email and try again.");
  assert.equal(resetFormProblem('12345678901', 'secret1', 'secret1'), "That doesn't look like the full code. Check the email and try again.");
});

test('a missing or mismatched password is a problem', () => {
  assert.equal(resetFormProblem('123456', '', ''), 'Enter a new password.');
  assert.equal(resetFormProblem('123456', 'secret1', 'secret2'), 'Passwords do not match.');
});

test('once the code is accepted (null), only the passwords are checked', () => {
  assert.equal(resetFormProblem(null, 'secret1', 'secret1'), null);
  assert.equal(resetFormProblem(null, 'secret1', 'other'), 'Passwords do not match.');
  assert.equal(resetFormProblem(null, '', ''), 'Enter a new password.');
});

test('a complete form has no problem', () => {
  assert.equal(resetFormProblem('123456', 'secret1', 'secret1'), null);
  assert.equal(resetFormProblem('123 456', 'secret1', 'secret1'), null);
  // Supabase can be set to longer codes (up to 10 digits).
  assert.equal(resetFormProblem('12345678', 'secret1', 'secret1'), null);
});
