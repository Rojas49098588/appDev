import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseCsv } from '../lib/import/csv.ts';
import { findColumns, normalizeNumber, classifyRows, parseNumberList } from '../lib/import/rows.ts';

test('parseCsv handles quotes, BOM, CRLF and blank lines', () => {
  assert.deepEqual(
    parseCsv('\uFEFFa,b\r\n"x, y","say ""hi"""\r\n\r\n1,2\n'),
    [['a', 'b'], ['x, y', 'say "hi"'], ['1', '2']],
  );
  assert.deepEqual(parseCsv('a,"line1\nline2"\n'), [['a', 'line1\nline2']]);
  assert.deepEqual(parseCsv(',,\n'), [['', '', '']]);
  assert.deepEqual(parseCsv(''), []);
});

test('findColumns tolerates case and spacing, reports missing', () => {
  const ok = findColumns(['NAME', 'Section', 'M/F', ' coat  # ', 'bibber#', 'Vests', ' REPAIRS']);
  assert.deepEqual(ok, { name: 0, section: 1, coats: 3, bibbers: 4, vests: 5, repairs: 6 });
  assert.deepEqual(findColumns(['NAME', 'Section', 'Coat #', 'BIBBER #', 'Repairs']), { missing: ['VESTS'] });
});

test('normalizeNumber', () => {
  assert.equal(normalizeNumber(' 085 '), '85');
  assert.equal(normalizeNumber('0085'), '85');
  assert.equal(normalizeNumber('0'), '0');
  assert.equal(normalizeNumber('000'), '0');
  assert.equal(normalizeNumber(''), null);
  assert.equal(normalizeNumber('   '), null);
  assert.equal(normalizeNumber('18a'), null);
});

test('classifyRows: member, Addison Sew, Unassigned, invalid, blank', () => {
  const cells = parseCsv(readFileSync(new URL('./fixtures/sample-roster.csv', import.meta.url), 'utf8'));
  const cols = findColumns(cells[0]);
  assert.ok(!('missing' in cols));
  const rows = classifyRows(cells, cols as Exclude<typeof cols, { missing: string[] }>);
  // cells is the full parseCsv output; the header (line 1) is skipped
  assert.deepEqual(rows.map((r) => r.line), [2, 3, 5, 6, 7, 8, 9, 10, 11, 12]);
  assert.deepEqual(rows[0], { line: 2, kind: 'member', name: 'Doe Jane', numbers: { Coats: '185', Bibbers: '212' }, repairs: '' });
  assert.deepEqual(rows[1], { line: 3, kind: 'member', name: 'Roe Rick', numbers: { Coats: '85', Vests: '40' }, repairs: 'Zipper broken, needs fix' });
  assert.deepEqual(rows[2], { line: 5, kind: 'repair_shop', pieceType: 'Coats', number: '77', color: 'Blue' });
  assert.deepEqual(rows[3], { line: 6, kind: 'unassigned', numbers: { Coats: '300', Bibbers: '310', Vests: '50' } });
  assert.deepEqual(rows[4], { line: 7, kind: 'invalid', reason: 'Coat # "18a" isn\'t a number', raw: ['Poe Sam', 'Flute', 'M', '18a', '', '', ''] });
  assert.deepEqual(rows[5], { line: 8, kind: 'invalid', reason: 'No name', raw: ['', 'Brass', 'F', '100', '', '', ''] });
  assert.equal(rows[6].kind, 'invalid');
  assert.equal((rows[6] as { reason: string }).reason, 'Addison Sew row needs exactly one piece number');
  assert.equal((rows[7] as { reason: string }).reason, 'Addison Sew row needs a color in Repairs');
  assert.deepEqual(rows[8], { line: 11, kind: 'member', name: 'Lee Kim', numbers: { Bibbers: '0' }, repairs: '' });
  // Addison Sew in NAME also counts (R2)
  assert.deepEqual(rows[9], { line: 12, kind: 'repair_shop', pieceType: 'Bibbers', number: '55', color: 'Candy' });
});

test('parseNumberList handles lists, ranges, normalization and de-duplication', () => {
  assert.deepEqual(parseNumberList('104, 112, 120'), { numbers: ['104', '112', '120'], error: null });
  assert.deepEqual(parseNumberList('085, 85, 7 9'), { numbers: ['85', '7', '9'], error: null });
  assert.deepEqual(parseNumberList(''), { numbers: [], error: null });
  assert.deepEqual(parseNumberList('104 to 120 every 4'), {
    numbers: ['104', '108', '112', '116', '120'],
    error: null,
  });
  // end not on the step: stops at the last number that fits
  assert.deepEqual(parseNumberList('10 to 15 every 2'), { numbers: ['10', '12', '14'], error: null });
  assert.deepEqual(parseNumberList('3 to 5'), { numbers: ['3', '4', '5'], error: null });
  assert.deepEqual(parseNumberList('1 to 2, 2, 9'), { numbers: ['1', '2', '9'], error: null });
});

test('parseNumberList reports clear errors', () => {
  assert.deepEqual(parseNumberList('104, 12x'), { numbers: [], error: '"12x" isn\'t a number' });
  assert.equal(parseNumberList('1 to 9 every 0').error, 'every must be at least 1');
  assert.equal(parseNumberList('1 to 9 every x').error, 'every must be at least 1');
  assert.match(parseNumberList('9 to 1').error ?? '', /start.*end/i);
  assert.match(parseNumberList('1 to 5000').error ?? '', /1000/);
  assert.equal(parseNumberList('a to 5').error, '"a" isn\'t a number');
});
