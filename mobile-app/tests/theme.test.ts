import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_PALETTE,
  HIGH_CONTRAST_PALETTE,
  TEXT_COLOR_KEYS,
  contrastRatio,
  isLargeText,
  makeTheme,
  outlineButtonMetrics,
} from '../lib/theme.ts';
import { DEFAULT_SETTINGS } from '../lib/settings.ts';

const round2 = (n: number) => Math.round(n * 100) / 100;

test('contrastRatio follows the WCAG formula', () => {
  assert.equal(round2(contrastRatio('#000000', '#FFFFFF')), 21);
  assert.equal(round2(contrastRatio('#22201D', '#E8E6E0')), 13.02);
});

test('every default text color is readable (≥ 4.5 : 1) on every background', () => {
  for (const key of TEXT_COLOR_KEYS) {
    for (const bg of ['paper', 'surface', 'white'] as const) {
      const ratio = contrastRatio(DEFAULT_PALETTE[key], DEFAULT_PALETTE[bg]);
      assert.ok(ratio >= 4.5, `${key} on ${bg} is ${ratio.toFixed(2)}`);
    }
  }
});

test('the gray hierarchy is kept: ink darker than inkSoft darker than inkFaint', () => {
  const on = (key: 'ink' | 'inkSoft' | 'inkFaint') => contrastRatio(DEFAULT_PALETTE[key], DEFAULT_PALETTE.paper);
  assert.ok(on('ink') > on('inkSoft'));
  assert.ok(on('inkSoft') > on('inkFaint'));
});

test('high contrast grays are nearly black (≥ 7 : 1)', () => {
  for (const key of ['inkSoft', 'inkFaint'] as const) {
    assert.ok(contrastRatio(HIGH_CONTRAST_PALETTE[key], HIGH_CONTRAST_PALETTE.paper) >= 7, key);
  }
});

test('large-text layouts start at 1.35 × (phone scale × app step)', () => {
  assert.equal(isLargeText(1, 0), false);
  assert.equal(isLargeText(1.2, 1), true);
  assert.equal(isLargeText(1.35, 0), true);
  assert.equal(isLargeText(1.3, 0), false);
});

test('outlined buttons: compact at Standard, regular at Large, bigger after', () => {
  assert.deepEqual(outlineButtonMetrics(0, false), {
    minHeight: 28, fontSize: 12, paddingHorizontal: 10, borderWidth: 1.25, borderRadius: 14,
  });
  assert.deepEqual(outlineButtonMetrics(1, false), {
    minHeight: 36, fontSize: 13.5, paddingHorizontal: 14, borderWidth: 1.5, borderRadius: 18,
  });
  assert.deepEqual(outlineButtonMetrics(3, false), {
    minHeight: 47, fontSize: 17.6, paddingHorizontal: 18, borderWidth: 1.5, borderRadius: 23.5,
  });
  assert.equal(outlineButtonMetrics(0, true).borderWidth, 2);
});

test('makeTheme scales fonts by the size step and picks the palette', () => {
  assert.equal(makeTheme({ ...DEFAULT_SETTINGS, sizeStep: 3 }, 1).font(12), 18);
  assert.equal(makeTheme(DEFAULT_SETTINGS, 1).colors, DEFAULT_PALETTE);
  assert.equal(makeTheme({ ...DEFAULT_SETTINGS, highContrast: true }, 1).colors, HIGH_CONTRAST_PALETTE);
  assert.equal(makeTheme(DEFAULT_SETTINGS, 1).expanded, true);
  assert.equal(makeTheme({ ...DEFAULT_SETTINGS, layout: 'condensed' }, 1).expanded, false);
});

test('new settings give a new theme, so open screens restyle', () => {
  const a = makeTheme(DEFAULT_SETTINGS, 1);
  const b = makeTheme({ ...DEFAULT_SETTINGS, highContrast: true }, 1);
  assert.notEqual(a.colors.inkSoft, b.colors.inkSoft);
  assert.equal(makeTheme(DEFAULT_SETTINGS, 1.4).isLarge, true);
});
