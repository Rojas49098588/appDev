import { test } from 'node:test';
import assert from 'node:assert/strict';
import { digitsOnly, matchesUniformSize, sizeFor, UNIFORM_PIECES } from '../lib/uniform.ts';

const sizes = { coats: '208', vests: '', bibbers: '212', pants: '208' };

test('UNIFORM_PIECES lists the four sized pieces in catalogue order', () => {
  assert.deepEqual(UNIFORM_PIECES.map((p) => p.piece), ['Coats', 'Vests', 'Bibbers', 'Pants']);
});

test('sizeFor looks up a piece by catalogue name', () => {
  assert.equal(sizeFor(sizes, 'Bibbers'), '212');
  assert.equal(sizeFor(sizes, 'Vests'), '');
  assert.equal(sizeFor(undefined, 'Coats'), '');
  assert.equal(sizeFor(sizes, 'Ties'), '');
});

test('matchesUniformSize is an exact match on the chosen piece', () => {
  assert.equal(matchesUniformSize(sizes, 'Coats', '208'), true);
  assert.equal(matchesUniformSize(sizes, 'Coats', ' 208 '), true);
  assert.equal(matchesUniformSize(sizes, 'Coats', '20'), false);
  assert.equal(matchesUniformSize(sizes, 'Bibbers', '208'), false);
});

test('an unassigned size or a member without sizes never matches', () => {
  assert.equal(matchesUniformSize(sizes, 'Vests', ''), false);
  assert.equal(matchesUniformSize(undefined, 'Coats', '208'), false);
});

test('digitsOnly strips everything but digits', () => {
  assert.equal(digitsOnly(' 2a0-8 '), '208');
  assert.equal(digitsOnly(''), '');
});
