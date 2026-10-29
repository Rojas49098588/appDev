import { test } from 'node:test';
import assert from 'node:assert/strict';
import { homeStats, sectionCounts, type StatsAccount } from '../lib/homeStats.ts';

const SECTIONS = ['Trumpet', 'Tuba', 'Drumline'];
const sectionOf = (instrument: string) => instrument;
const member = (instrument: string, over: Partial<StatsAccount> = {}): StatsAccount => ({
  role: 'Member', instrument, archivedAt: null, ...over,
});

test('with no accounts every section is 0 and every stat is 0', () => {
  assert.deepEqual(sectionCounts([], SECTIONS, sectionOf).map((s) => s.count), [0, 0, 0]);
  assert.deepEqual(homeStats([], SECTIONS, sectionOf, 0, []).map((s) => s.value), ['0', '0', '0', '0']);
});

test('counts only active members, not staff or archived members', () => {
  const accounts = [
    member('Trumpet'),
    member('Trumpet'),
    member('Tuba', { archivedAt: '2026-10-01' }),
    member('Drumline', { role: 'Staff' }),
  ];
  assert.deepEqual(sectionCounts(accounts, SECTIONS, sectionOf), [
    { name: 'Trumpet', count: 2 },
    { name: 'Tuba', count: 0 },
    { name: 'Drumline', count: 0 },
  ]);
  const stats = homeStats(accounts, SECTIONS, sectionOf, 3, []);
  assert.equal(stats[0].value, '2');
  assert.equal(stats[1].value, '1');
  assert.equal(stats[1].label, 'section');
  assert.equal(stats[2].value, '3');
});

test('repair stat counts only open repair flags', () => {
  const stats = homeStats([], SECTIONS, sectionOf, 0, [
    { status: 'repair', clearedAt: null },
    { status: 'repair', clearedAt: '2026-10-20' },
    { status: 'dirty', clearedAt: null },
  ]);
  assert.equal(stats[3].value, '1');
  assert.equal(stats[3].label, 'piece flagged for repair');
  assert.equal(stats[3].flag, true);
});
