import { test } from 'node:test';
import assert from 'node:assert/strict';
import { accountUpdatesToProfile, profileToAccount, rowToCombo, rowToFlag, rowToGame } from '../lib/mappers.ts';
import type { ComboRow, FlagRow, GameRow, ProfileRow } from '../lib/rows.ts';

const profile: ProfileRow = {
  id: 'u1', email: 'maya@smu.edu', first_name: 'Maya', last_name: 'Chen', instrument: 'Trumpet',
  role: 'Member', phone: '', shoe_gender: null, shoe_size: '', height_feet: '5', height_inches: '6',
  weight: '130', created_at: '2026-09-29T00:00:00Z',
};

test('profileToAccount maps columns and defaults a missing shoe gender', () => {
  assert.deepEqual(profileToAccount(profile), {
    id: 'u1', email: 'maya@smu.edu', firstName: 'Maya', lastName: 'Chen', instrument: 'Trumpet',
    role: 'Member', phone: '', shoeSize: { gender: "Men's", size: '' },
    height: { feet: '5', inches: '6' }, weight: '130',
  });
});

test('accountUpdatesToProfile only includes provided fields and never email or role', () => {
  assert.deepEqual(
    accountUpdatesToProfile({
      firstName: ' Maya ', email: 'new@smu.edu',
      shoeSize: { gender: "Women's", size: '8' }, height: { feet: '5', inches: '7' },
    }),
    { first_name: 'Maya', shoe_gender: "Women's", shoe_size: '8', height_feet: '5', height_inches: '7' }
  );
  assert.deepEqual(accountUpdatesToProfile({}), {});
});

test('rowToFlag maps member_id to memberId', () => {
  const row: FlagRow = {
    id: 'f1', member_id: 'u1', piece: 'Coats', color: 'Blue', size: '208', status: 'dirty',
    comment: 'mud', created_at: '', updated_at: '',
  };
  assert.deepEqual(rowToFlag(row), {
    id: 'f1', memberId: 'u1', piece: 'Coats', color: 'Blue', size: '208', status: 'dirty', comment: 'mud',
  });
});

test('rowToCombo keeps the image path and attaches the signed URL when given', () => {
  const row: ComboRow = {
    id: 'c1', label: 'Combo 01', sub: '', components: ['White hat'], image_path: 'a.jpg',
    created_by: null, created_at: '',
  };
  assert.deepEqual(rowToCombo(row, 'https://signed/a.jpg'), {
    id: 'c1', label: 'Combo 01', sub: '', components: ['White hat'], imagePath: 'a.jpg', image: 'https://signed/a.jpg',
  });
  assert.equal(rowToCombo({ ...row, image_path: null }).imagePath, undefined);
});

test('rowToGame formats dates and passes through empty combo slots', () => {
  const row: GameRow = {
    id: 'g1', opponent: 'Lincoln High', game_date: '2026-09-18', pre_game_combo_id: null,
    halftime_combo_id: 'c14', after_game_instructions: 'Hang coats', instructions_posted_by: 's1',
    instructions_updated_at: '2026-09-15T12:00:00Z', is_current: true,
  };
  assert.deepEqual(rowToGame(row, 'Coach Reyes'), {
    id: 'g1', opponent: 'Lincoln High', date: 'Fri, Sep 18', preGameComboId: null, halftimeComboId: 'c14',
    afterGameInstructions: 'Hang coats', instructionsPostedBy: 'Coach Reyes', instructionsUpdatedAt: 'Sep 15',
  });
});
