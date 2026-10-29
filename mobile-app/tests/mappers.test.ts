import { test } from 'node:test';
import assert from 'node:assert/strict';
import { accountUpdatesToProfile, profileToAccount, rowToArchive, rowToCombo, gameDraftToRow, rowToFlag, rowToGame, rowToPoloColor, rowToPiece, rowToPieceType } from '../lib/mappers.ts';
import type { GameDraft } from '../lib/models.ts';
import type { ComboRow, FlagRow, GameRow, MemberArchiveRow, PieceRow, PieceTypeRow, ProfileRow } from '../lib/rows.ts';

const profile: ProfileRow = {
  id: 'u1', email: 'maya@smu.edu', first_name: 'Maya', last_name: 'Chen', instrument: 'Trumpet',
  role: 'Member', phone: '', shoe_gender: null, shoe_size: '', height_feet: '5', height_inches: '6',
  weight: '130', numbers: { Coats: '208', Bibbers: '212' },
  archived_at: null, created_at: '2026-09-29T00:00:00Z',
};

test('profileToAccount maps columns and defaults a missing shoe gender', () => {
  assert.deepEqual(profileToAccount(profile), {
    id: 'u1', email: 'maya@smu.edu', firstName: 'Maya', lastName: 'Chen', instrument: 'Trumpet',
    role: 'Member', phone: '', shoeSize: { gender: "Men's", size: '' },
    height: { feet: '5', inches: '6' }, weight: '130',
    numbers: { Coats: '208', Bibbers: '212' }, archivedAt: null,
  });
  assert.equal(profileToAccount({ ...profile, archived_at: '2026-10-07T12:00:00Z' }).archivedAt, '2026-10-07T12:00:00Z');
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

test('accountUpdatesToProfile never writes numbers or archive state', () => {
  const updates = {
    weight: '140',
    numbers: { Coats: '1' },
    archivedAt: '2026-10-07T00:00:00Z',
  } as Parameters<typeof accountUpdatesToProfile>[0];
  assert.deepEqual(accountUpdatesToProfile(updates), { weight: '140' });
});

test('rowToArchive maps the snapshot, its sizes and its flags', () => {
  const row: MemberArchiveRow = {
    id: 'a1', member_id: 'u1', archived_at: '2026-10-07T12:00:00Z', archived_by_name: 'Coach Reyes',
    restored_at: null, restored_by_name: null,
    snapshot: {
      email: 'maya@smu.edu', first_name: 'Maya', last_name: 'Chen', instrument: 'Trumpet', phone: '2145550100',
      shoe_gender: null, shoe_size: '8', height_feet: '5', height_inches: '6', weight: '130',
      coat_size: '208', vest_size: '', bibber_size: '212', pant_size: '208',
      flags: [{ piece: 'Coats', color: 'Blue', size: '208', status: 'repair', comment: 'torn' }],
    },
  };
  assert.deepEqual(rowToArchive(row), {
    id: 'a1', memberId: 'u1', archivedAt: '2026-10-07T12:00:00Z', archivedByName: 'Coach Reyes',
    restoredAt: null, restoredByName: null,
    firstName: 'Maya', lastName: 'Chen', email: 'maya@smu.edu', instrument: 'Trumpet', phone: '2145550100',
    shoeSize: { gender: "Men's", size: '8' }, height: { feet: '5', inches: '6' }, weight: '130',
    numbers: { Coats: '208', Bibbers: '212', Pants: '208' },
    flags: [{ piece: 'Coats', color: 'Blue', size: '208', status: 'repair', comment: 'torn' }],
  });
});

test('rowToFlag maps history columns and the signed photo url', () => {
  const row: FlagRow = {
    id: 'f1', member_id: 'u1', piece: 'Coats', color: 'Blue', size: '104', status: 'repair',
    comment: 'button', created_at: '2026-10-21T10:00:00Z', updated_at: '2026-10-21T10:00:00Z',
    member_name: 'Jordan P', photo_path: 'u1/a.jpg', staff_note: '', source: 'member',
    cleared_at: null, cleared_by: null, cleared_by_name: null,
  };
  assert.deepEqual(rowToFlag(row, 'https://signed'), {
    id: 'f1', memberId: 'u1', piece: 'Coats', color: 'Blue', size: '104',
    status: 'repair', comment: 'button', createdAt: '2026-10-21T10:00:00Z', memberName: 'Jordan P',
    photoPath: 'u1/a.jpg', photoUrl: 'https://signed', staffNote: '', source: 'member', clearedAt: null, clearedByName: null,
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

test('rowToGame trims times and maps the new columns', () => {
  const row: GameRow = {
    id: 'g1', sport: 'football', division: null, status: 'ready', opponent: 'Lincoln High', game_date: '2026-09-18',
    kickoff_time: '11:00:00', call_time: null, no_call_time: true,
    polo_colors: [{ name: 'Red', swatch: '#C8102E' }], polo_note: 'Black pants', group_number: null,
    pre_game_combo_id: null, halftime_combo_id: 'c14', after_game_instructions: 'Hang coats',
    instructions_posted_by: 's1', instructions_updated_at: '2026-09-15T12:00:00Z',
  };
  assert.deepEqual(rowToGame(row, 'Coach Reyes'), {
    id: 'g1', sport: 'football', division: null, status: 'ready', opponent: 'Lincoln High', gameDate: '2026-09-18',
    kickoffTime: '11:00', callTime: null, noCallTime: true,
    polo: [{ name: 'Red', swatch: '#C8102E' }], poloNote: 'Black pants', groupNumber: null,
    preGameComboId: null, halftimeComboId: 'c14', afterGameInstructions: 'Hang coats',
    instructionsPostedBy: 'Coach Reyes', instructionsUpdatedAt: 'Sep 15',
  });
});

test('gameDraftToRow round-trips through rowToGame', () => {
  const draft: GameDraft = {
    sport: 'volleyball', division: 'womens', opponent: ' Tulane ', gameDate: '2026-10-30',
    kickoffTime: '18:30', callTime: '17:00', noCallTime: false, polo: [{ name: 'Blue', swatch: '#0033A0' }],
    poloNote: '', groupNumber: 3, preGameComboId: null, halftimeComboId: null, afterGameInstructions: '',
  };
  const row = gameDraftToRow(draft);
  assert.equal(row.opponent, 'Tulane');
  assert.deepEqual(row.polo_colors, [{ name: 'Blue', swatch: '#0033A0' }]);
  assert.equal(row.group_number, 3);
  const back = rowToGame({ id: 'g2', status: 'draft', instructions_posted_by: null, instructions_updated_at: null, ...row } as GameRow, '');
  assert.deepEqual({ ...back, opponent: 'Tulane' }, { ...draft, opponent: 'Tulane', id: 'g2', status: 'draft', instructionsPostedBy: '', instructionsUpdatedAt: '' });
});

test('rowToPoloColor maps columns', () => {
  assert.deepEqual(rowToPoloColor({ id: 'p1', name: 'Red', swatch: '#C8102E', sort_order: 2, created_at: 'x' }), {
    id: 'p1', name: 'Red', swatch: '#C8102E', sortOrder: 2,
  });
});

test('rowToArchive reads old size keys and new numbers', () => {
  const base = {
    id: 'a1', member_id: 'u1', archived_at: '2026-10-07T12:00:00Z', archived_by_name: 'C',
    restored_at: null, restored_by_name: null,
  };
  const common = {
    email: 'm@smu.edu', first_name: 'M', last_name: 'C', instrument: 'Tuba', phone: '',
    shoe_gender: null, shoe_size: '', height_feet: '', height_inches: '', weight: '', flags: [],
  };
  const old = rowToArchive({
    ...base, snapshot: { ...common, coat_size: '208', vest_size: '', bibber_size: '', pant_size: '' },
  } as unknown as MemberArchiveRow);
  assert.deepEqual(old.numbers, { Coats: '208' });
  const now = rowToArchive({
    ...base, snapshot: { ...common, numbers: { Coats: '185', Jackets: '12' } },
  } as unknown as MemberArchiveRow);
  assert.deepEqual(now.numbers, { Coats: '185', Jackets: '12' });
});

test('rowToPieceType and rowToPiece map columns', () => {
  const t: PieceTypeRow = {
    id: 't1', name: 'Coats', kind: 'numbered', colors: ['Blue', 'White'], stock: {},
    sort_order: 2, retired: false, created_at: '',
  };
  assert.deepEqual(rowToPieceType(t), {
    id: 't1', name: 'Coats', kind: 'numbered', colors: ['Blue', 'White'], stock: {}, sortOrder: 2, retired: false,
  });
  const p: PieceRow = { id: 'p1', piece_type_id: 't1', color: 'Blue', number: '104', out_for_repair: true, created_at: '' };
  assert.deepEqual(rowToPiece(p, 'Coats'), {
    id: 'p1', pieceTypeId: 't1', pieceType: 'Coats', color: 'Blue', number: '104', outForRepair: true,
  });
});
