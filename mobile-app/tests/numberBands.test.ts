import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bandNumbers } from '../lib/numberBands.ts';

test('a short list stays one unlabeled row', () => {
  const numbers = Array.from({ length: 11 }, (_, i) => String(101 + i));
  assert.deepEqual(bandNumbers(numbers), [{ label: '', numbers }]);
});

test('numbers split into rows by hundreds, sorted, with leading zeros kept as typed', () => {
  assert.deepEqual(
    bandNumbers(['205', '101', '085', '150', '099', '201', '102', '103', '104', '105', '106', '107']),
    [
      { label: '1–99', numbers: ['085', '099'] },
      { label: '100–199', numbers: ['101', '102', '103', '104', '105', '106', '107', '150'] },
      { label: '200–299', numbers: ['201', '205'] },
    ]
  );
});

test('an empty list gives one empty row', () => {
  assert.deepEqual(bandNumbers([]), [{ label: '', numbers: [] }]);
});
