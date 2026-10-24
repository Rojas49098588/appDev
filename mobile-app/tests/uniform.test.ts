import { test } from 'node:test';
import assert from 'node:assert/strict';
import { digitsOnly, matchesNumber, numberFor } from '../lib/uniform.ts';

const numbers = { Coats: '185', Bibbers: '212' };

test('numberFor / matchesNumber', () => {
  assert.equal(numberFor(numbers, 'Bibbers'), '212');
  assert.equal(numberFor(numbers, 'Vests'), '');
  assert.equal(numberFor(undefined, 'Coats'), '');
  assert.equal(matchesNumber(numbers, 'Coats', ' 185 '), true);
  assert.equal(matchesNumber(numbers, 'Coats', '18'), false);
  assert.equal(matchesNumber(numbers, 'Bibbers', '185'), false);
  assert.equal(matchesNumber(numbers, 'Vests', ''), false);
  assert.equal(matchesNumber({ Coats: '' }, 'Coats', ''), false);
  assert.equal(matchesNumber(undefined, 'Coats', '185'), false);
});

test('digitsOnly strips everything but digits', () => {
  assert.equal(digitsOnly(' 2a0-8 '), '208');
  assert.equal(digitsOnly(''), '');
});
