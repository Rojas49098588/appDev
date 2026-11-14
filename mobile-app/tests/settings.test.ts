import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SETTINGS,
  SETTINGS_KEY,
  loadSettings,
  parseSettings,
  serializeSettings,
} from '../lib/settings.ts';

test('missing or unreadable settings fall back to the defaults', () => {
  assert.deepEqual(parseSettings(null), DEFAULT_SETTINGS);
  assert.deepEqual(parseSettings('not json'), DEFAULT_SETTINGS);
  assert.deepEqual(parseSettings('[]'), DEFAULT_SETTINGS);
});

test('the defaults are Standard size, high contrast off, Expanded', () => {
  assert.deepEqual(DEFAULT_SETTINGS, { sizeStep: 0, highContrast: false, layout: 'expanded' });
});

test('a missing field falls back on its own', () => {
  assert.deepEqual(parseSettings('{"sizeStep":2,"highContrast":true}'), {
    sizeStep: 2,
    highContrast: true,
    layout: 'expanded',
  });
});

test('bad field values fall back to the defaults', () => {
  assert.deepEqual(parseSettings('{"sizeStep":5,"highContrast":"yes","layout":"tiny"}'), DEFAULT_SETTINGS);
  assert.deepEqual(parseSettings('{"sizeStep":1.5}'), DEFAULT_SETTINGS);
});

test('settings survive a save and load', () => {
  const s = { sizeStep: 3, highContrast: true, layout: 'condensed' } as const;
  assert.deepEqual(parseSettings(serializeSettings(s)), s);
});

test('loadSettings never fails: a storage error gives the defaults', async () => {
  assert.deepEqual(await loadSettings(() => Promise.reject(new Error('disk'))), DEFAULT_SETTINGS);
  const loaded = await loadSettings(async () => '{"layout":"condensed"}');
  assert.equal(loaded.layout, 'condensed');
});

test('settings are not stored as a cache (logout clears mustang.cache.* keys)', () => {
  assert.equal(SETTINGS_KEY, 'mustang.settings');
  assert.equal(SETTINGS_KEY.startsWith('mustang.cache.'), false);
});
