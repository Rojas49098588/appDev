import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatGameDate, formatShortDate, formatTime } from '../lib/format.ts';

test('formatGameDate shows weekday, month and day without timezone drift', () => {
  assert.equal(formatGameDate('2026-09-18'), 'Fri, Sep 18');
  assert.equal(formatGameDate('2026-01-01'), 'Thu, Jan 1');
});

test('formatGameDate returns the input when it is not a date', () => {
  assert.equal(formatGameDate('soon'), 'soon');
});

test('formatShortDate shows month and day, or empty for null/invalid', () => {
  assert.equal(formatShortDate('2026-09-15T12:00:00Z'), 'Sep 15');
  assert.equal(formatShortDate(null), '');
  assert.equal(formatShortDate('nope'), '');
});

test('formatTime uses a 12-hour clock', () => {
  assert.equal(formatTime(new Date(2026, 8, 29, 18, 42).getTime()), '6:42 PM');
  assert.equal(formatTime(new Date(2026, 8, 29, 0, 5).getTime()), '12:05 AM');
  assert.equal(formatTime(new Date(2026, 8, 29, 12, 0).getTime()), '12:00 PM');
});
