import { test } from 'node:test';
import assert from 'node:assert/strict';
import { statusLook, submitLook } from '../lib/flagStatus.ts';

test('each status has one color, tint and icon', () => {
  assert.deepEqual(statusLook('repair'), {
    colorKey: 'rust', tintKey: 'rustTint', icon: 'wrench', label: 'Needs repair', action: 'Flag for repair',
  });
  assert.deepEqual(statusLook('dirty'), {
    colorKey: 'wash', tintKey: 'washTint', icon: 'drop', label: 'Dirty', action: 'Flag as dirty',
  });
  assert.deepEqual(statusLook('good'), {
    colorKey: 'good', tintKey: null, icon: 'check', label: 'Good', action: null,
  });
});

test('the flag button takes the picked status color and says what happens', () => {
  assert.deepEqual(submitLook('repair'), { colorKey: 'rust', label: 'Flag for repair', disabled: false });
  assert.deepEqual(submitLook('dirty'), { colorKey: 'wash', label: 'Flag as dirty', disabled: false });
});

test('with nothing picked the flag button is neutral and disabled', () => {
  assert.deepEqual(submitLook(null), { colorKey: 'inkSoft', label: 'Submit flag', disabled: true });
});
