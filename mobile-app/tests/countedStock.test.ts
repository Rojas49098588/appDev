import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyBatch, cardSummary, isWhiteShirt, keptAtHome, lineStatuses, whiteShirtSizes, type ShirtOwner,
} from '../lib/countedStock.ts';
import type { PieceType } from '../lib/models.ts';

const owner = (o: Partial<ShirtOwner>): ShirtOwner =>
  ({ role: 'Member', archivedAt: null, whiteShirtSize: 'M', keepsWhiteShirt: true, ...o });

test('keptAtHome counts active members who keep, by size', () => {
  const r = keptAtHome(
    [owner({}), owner({ whiteShirtSize: 'L' }), owner({ keepsWhiteShirt: false }), owner({ keepsWhiteShirt: null })],
    ['S', 'M', 'L'],
  );
  assert.deepEqual(r, { kept: { S: 0, M: 1, L: 1 }, unanswered: 1 });
});

test('archived members and staff are ignored', () => {
  assert.deepEqual(keptAtHome([owner({ archivedAt: '2026-01-01' }), owner({ role: 'Staff' })], ['M']), {
    kept: { M: 0 },
    unanswered: 0,
  });
});

test('keep with unknown size counts as not answered', () => {
  assert.deepEqual(keptAtHome([owner({ whiteShirtSize: '' }), owner({ whiteShirtSize: 'XXL' })], ['M']), {
    kept: { M: 0 },
    unanswered: 2,
  });
});

test('size labels match case-insensitively', () => {
  assert.deepEqual(keptAtHome([owner({ whiteShirtSize: 'm' })], ['M']).kept, { M: 1 });
});

test('lineStatuses: expected = total - kept, missing = expected - count', () => {
  assert.deepEqual(lineStatuses([{ label: 'M', total: 100, count: 76 }], { M: 20 }), [
    { label: 'M', total: 100, count: 76, kept: 20, expected: 80, missing: 4 },
  ]);
});

test('expected never goes below 0 and missing never negative', () => {
  const [s] = lineStatuses([{ label: 'XL', total: 10, count: 3 }], { XL: 12 });
  assert.equal(s.expected, 0);
  assert.equal(s.missing, 0);
  assert.equal(lineStatuses([{ label: 'S', total: 100, count: 104 }])[0].missing, 0);
});

test('cardSummary sums lines', () => {
  const st = lineStatuses([
    { label: 'S', total: 100, count: 100 },
    { label: 'M', total: 100, count: 91 },
    { label: 'L', total: 100, count: 95 },
    { label: 'XL', total: 10, count: 10 },
  ]);
  assert.deepEqual(cardSummary(st), { count: 296, expected: 310, missing: 14 });
});

test('applyBatch adds and removes', () => {
  assert.equal(applyBatch(80, '+12'), 92);
  assert.equal(applyBatch(80, '12'), 92);
  assert.equal(applyBatch(80, '-3'), 77);
  assert.equal(applyBatch(80, '−3'), 77);
  assert.equal(applyBatch(80, ' + 5 '), 85);
});

test('applyBatch rejects results below 0 and unreadable text', () => {
  assert.equal(applyBatch(12, '-20'), null);
  assert.equal(applyBatch(5, 'x'), null);
  assert.equal(applyBatch(5, ''), null);
  assert.equal(applyBatch(5, '+1.5'), null);
});

test('whiteShirtSizes returns the White shirt lines, or [] without one', () => {
  const t = (name: string, labels: string[]) =>
    ({
      id: name, name, kind: 'counted', colors: labels, sortOrder: 0, retired: false,
      lines: labels.map((label) => ({ label, total: 10, count: 10 })), countedAt: null, countedByName: '',
    }) as PieceType;
  assert.deepEqual(whiteShirtSizes([t('Ties', ['Black']), t('White shirt', ['S', 'M', 'L', 'XL'])]), ['S', 'M', 'L', 'XL']);
  assert.deepEqual(whiteShirtSizes([t('Ties', ['Black'])]), []);
  assert.deepEqual(whiteShirtSizes([{ ...t('White shirt', ['S']), retired: true }]), []);
});

test('isWhiteShirt ignores case and spaces', () => {
  assert.equal(isWhiteShirt(' white SHIRT '), true);
  assert.equal(isWhiteShirt('Ties'), false);
});
