import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  bandToday, comboInUse, comboShortcutTarget, isCourt, missingFields, shownCourt, shownFootball, sportLabel, staffSections,
} from '../lib/games.ts';
import type { Game, GameDraft } from '../lib/models.ts';

const base: Game = {
  id: 'g0', sport: 'football', division: null, status: 'ready', opponent: 'Rice',
  gameDate: '2026-11-14', kickoffTime: '11:00', callTime: '08:00', noCallTime: false,
  polo: [{ name: 'Red', swatch: '#C8102E' }], poloNote: '', groupNumber: null,
  preGameComboId: 'c1', halftimeComboId: 'c2', afterGameInstructions: '',
  instructionsPostedBy: '', instructionsUpdatedAt: '',
};
const g = (over: Partial<Game>): Game => ({ ...base, ...over });
const ids = (list: Game[]) => list.map((x) => x.id);

test('bandToday handles CDT (summer)', () => {
  assert.equal(bandToday(new Date('2026-07-04T04:30:00Z')), '2026-07-03');
  assert.equal(bandToday(new Date('2026-07-04T05:30:00Z')), '2026-07-04');
});

test('bandToday uses Chicago, not the device zone', () => {
  assert.equal(bandToday(new Date('2026-11-08T05:30:00Z')), '2026-11-07');
  assert.equal(bandToday(new Date('2026-11-08T06:30:00Z')), '2026-11-08');
});

test('isCourt and sportLabel', () => {
  assert.equal(isCourt('football'), false);
  assert.equal(isCourt('basketball'), true);
  assert.equal(isCourt('volleyball'), true);
  assert.equal(sportLabel({ sport: 'football', division: null }), 'Football');
  assert.equal(sportLabel({ sport: 'volleyball', division: 'womens' }), "Women's volleyball");
  assert.equal(sportLabel({ sport: 'basketball', division: 'mens' }), "Men's basketball");
  assert.equal(sportLabel({ sport: 'volleyball', division: null }), 'Volleyball');
  assert.equal(sportLabel({ sport: 'basketball', division: null }), 'Basketball');
});

test('shownFootball picks the earliest ready upcoming game and skips drafts and past games', () => {
  const games = [
    g({ id: 'a', gameDate: '2026-11-14' }),
    g({ id: 'b', gameDate: '2026-11-07', status: 'draft' }),
    g({ id: 'c', gameDate: '2026-10-31' }),
    g({ id: 'd', gameDate: '2026-11-21' }),
  ];
  assert.equal(shownFootball(games, '2026-11-01')?.id, 'a');
  assert.equal(shownFootball(games, '2026-11-14')?.id, 'a');
  assert.equal(shownFootball(games, '2026-11-15')?.id, 'd');
});

test('shownFootball returns null when the next game is a draft and nothing later is ready', () => {
  const games = [g({ id: 'a', gameDate: '2026-11-07', status: 'draft' }), g({ id: 'b', gameDate: '2026-10-01' })];
  assert.equal(shownFootball(games, '2026-11-01'), null);
});

test('shownCourt returns every ready court game on the next game day in start order', () => {
  const vb = g({ id: 'vb', sport: 'volleyball', division: 'womens', gameDate: '2026-11-08', kickoffTime: '18:30' });
  const wbb = g({ id: 'wbb', sport: 'basketball', division: 'womens', gameDate: '2026-11-08', kickoffTime: '14:00' });
  const bb = g({ id: 'bb', sport: 'basketball', division: 'mens', gameDate: '2026-11-10' });
  const draft = g({ id: 'dr', sport: 'volleyball', gameDate: '2026-11-08', status: 'draft', kickoffTime: '10:00' });
  assert.deepEqual(ids(shownCourt([vb, bb, draft, wbb], '2026-11-01')), ['wbb', 'vb']);
  assert.deepEqual(ids(shownCourt([vb, bb, draft, wbb], '2026-11-09')), ['bb']);
});

test('football and court never affect each other', () => {
  const court = g({ id: 'ct', sport: 'basketball', division: 'mens', gameDate: '2026-11-02' });
  const fb = g({ id: 'fb', gameDate: '2026-11-14' });
  assert.equal(shownFootball([court, fb], '2026-11-01')?.id, 'fb');
  assert.deepEqual(ids(shownCourt([court, fb], '2026-11-01')), ['ct']);
});

const blankDraft = (over: Partial<GameDraft> = {}): GameDraft => ({
  sport: 'football', division: null, opponent: '', gameDate: null, kickoffTime: null, callTime: null,
  noCallTime: false, polo: [], poloNote: '', groupNumber: null, preGameComboId: null, halftimeComboId: null,
  afterGameInstructions: '', ...over,
});

test('missingFields lists what blocks ready', () => {
  assert.deepEqual(missingFields(blankDraft()), [
    'Opposing university', 'Game date', 'Kickoff', 'Call time', 'Polo', 'Pre-game combo', 'Halftime combo',
  ]);
  assert.ok(!missingFields(blankDraft({ noCallTime: true })).includes('Call time'));
  assert.deepEqual(missingFields(blankDraft({ sport: 'volleyball' })), [
    'Opposing university', 'Game date', 'Start', 'Call time', 'Polo', "Men's / Women's", 'Group',
  ]);
  const { id: _i, status: _s, instructionsPostedBy: _p, instructionsUpdatedAt: _u, ...complete } = base;
  assert.deepEqual(missingFields(complete), []);
});

test('staffSections puts undated drafts last and past games newest first', () => {
  const games = [
    g({ id: 'shown', gameDate: '2026-11-14' }),
    g({ id: 'undated', status: 'draft', gameDate: null, kickoffTime: null }),
    g({ id: 'later', gameDate: '2026-11-28', status: 'draft' }),
    g({ id: 'mid', gameDate: '2026-11-21' }),
    g({ id: 'old1', gameDate: '2026-10-03' }),
    g({ id: 'old2', gameDate: '2026-10-17' }),
    g({ id: 'court', sport: 'basketball', gameDate: '2026-11-20' }),
  ];
  const s = staffSections(games, 'football', '2026-11-01');
  assert.deepEqual(ids(s.upNext), ['shown']);
  assert.deepEqual(ids(s.queue), ['mid', 'later', 'undated']);
  assert.deepEqual(ids(s.past), ['old2', 'old1']);
  const c = staffSections(games, 'court', '2026-11-01');
  assert.deepEqual(ids(c.upNext), ['court']);
  assert.deepEqual(c.queue, []);
});

test('comboInUse ignores drafts and past games', () => {
  const games = [
    g({ id: 'past', gameDate: '2026-10-01', preGameComboId: 'x' }),
    g({ id: 'draft', gameDate: '2026-11-07', halftimeComboId: 'x', status: 'draft' }),
    g({ id: 'later', gameDate: '2026-11-21', halftimeComboId: 'x' }),
    g({ id: 'sooner', gameDate: '2026-11-14', preGameComboId: 'x' }),
  ];
  assert.equal(comboInUse(games, 'x', '2026-11-01')?.id, 'sooner');
  assert.equal(comboInUse(games, 'nope', '2026-11-01'), null);
});

test('comboShortcutTarget falls back to the next football draft', () => {
  const draft = g({ id: 'dr', status: 'draft', gameDate: '2026-11-07' });
  const undated = g({ id: 'u', status: 'draft', gameDate: null });
  const past = g({ id: 'p', gameDate: '2026-10-01' });
  const ready = g({ id: 'rd', gameDate: '2026-11-14' });
  assert.equal(comboShortcutTarget([undated, past, draft], '2026-11-01')?.id, 'dr');
  assert.equal(comboShortcutTarget([draft, ready], '2026-11-01')?.id, 'rd');
  assert.equal(comboShortcutTarget([undated, past], '2026-11-01'), null);
});
