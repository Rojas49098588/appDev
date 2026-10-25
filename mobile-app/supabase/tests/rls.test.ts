// Security-rule tests. Runs against the Supabase project in supabase/.env.local:
//   npm run test:rls
// Creates throwaway users (rls-*@mustangcloset.test) and deletes them afterwards.
//
// Once real members are onboarded, point supabase/.env.local at a SEPARATE test
// project before running this: it creates and deletes users, uploads and
// removes storage files, and briefly changes the current game's combo slots
// (restoring them afterwards). Members on the live app would see those changes.
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name} in supabase/.env.local`);
  return value;
}

const url = required('SUPABASE_URL');
const anonKey = required('SUPABASE_ANON_KEY');
const serviceKey = required('SUPABASE_SERVICE_ROLE_KEY');
const inviteCode = required('INVITE_CODE');

const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, serviceKey, clientOptions);
const anon = createClient(url, anonKey, clientOptions);

const RUN = Date.now().toString(36);
const PASSWORD = 'TestPass123';
const SEED_COMBO_01 = '00000000-0000-4000-8000-000000000001';
const CURRENT_GAME = '00000000-0000-4000-8000-0000000000a1';

type Slots = { pre_game_combo_id: string | null; halftime_combo_id: string | null };

// The current game's combo slots, read via admin, so tests that change them
// can put back exactly what was there.
async function currentSlots(): Promise<Slots> {
  const { data, error } = await admin
    .from('games')
    .select('pre_game_combo_id, halftime_combo_id')
    .eq('id', CURRENT_GAME)
    .single();
  if (error) throw error;
  return data as Slots;
}

async function restoreSlots(prior: Slots): Promise<void> {
  const now = await currentSlots();
  if (now.pre_game_combo_id === prior.pre_game_combo_id && now.halftime_combo_id === prior.halftime_combo_id) return;
  const { error } = await admin.from('games').update(prior).eq('id', CURRENT_GAME);
  if (error) throw error;
}

type TestUser = { id: string; email: string };
const createdUserIds: string[] = [];

async function createUser(label: string): Promise<TestUser> {
  const email = `rls-${label}-${RUN}@mustangcloset.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { invite_code: inviteCode, first_name: label, last_name: 'Test', instrument: 'Trumpet' },
  });
  if (error) throw error;
  createdUserIds.push(data.user.id);
  return { id: data.user.id, email };
}

async function signIn(email: string): Promise<SupabaseClient> {
  const client = createClient(url, anonKey, clientOptions);
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw error;
  return client;
}

let member: TestUser;
let otherMember: TestUser;
let staff: TestUser;
let asMember: SupabaseClient;
let asStaff: SupabaseClient;

before(async () => {
  member = await createUser('member');
  otherMember = await createUser('other');
  staff = await createUser('staff');
  // Service-role updates bypass the role guard (auth.uid() is null), like the dashboard.
  const { error } = await admin.from('profiles').update({ role: 'Staff' }).eq('id', staff.id);
  if (error) throw error;
  const { error: flagError } = await admin.from('flags').insert({
    member_id: otherMember.id, piece: 'Vests', color: 'Red', size: '128', status: 'repair',
  });
  if (flagError) throw flagError;
  asMember = await signIn(member.email);
  asStaff = await signIn(staff.email);
});

after(async () => {
  // Flags outlive their member (member_id is set null), so remove test flags explicitly.
  if (createdUserIds.length > 0) await admin.from('flags').delete().in('member_id', createdUserIds);
  for (const id of createdUserIds) {
    await admin.auth.admin.deleteUser(id);
  }
});

describe('sign-up and invite code', () => {
  test('check_invite_code accepts the code with spaces and lowercase', async () => {
    const { data, error } = await anon.rpc('check_invite_code', { code: ` ${inviteCode.toLowerCase()} ` });
    assert.equal(error, null);
    assert.equal(data, true);
  });

  test('check_invite_code rejects a wrong code', async () => {
    const { data, error } = await anon.rpc('check_invite_code', { code: 'WRONG' });
    assert.equal(error, null);
    assert.equal(data, false);
  });

  test('sign-up with a wrong invite code creates no account', async () => {
    const email = `rls-wrongcode-${RUN}@mustangcloset.test`;
    const client = createClient(url, anonKey, clientOptions);
    const { data, error } = await client.auth.signUp({
      email, password: PASSWORD,
      options: { data: { invite_code: 'WRONG', first_name: 'X', last_name: 'Y', instrument: 'Tuba' } },
    });
    if (data.user) createdUserIds.push(data.user.id);
    assert.notEqual(error, null);
    const { data: profiles } = await admin.from('profiles').select('id').eq('email', email);
    assert.equal(profiles?.length ?? 0, 0);
  });

  test('sign-up with a lowercase code works and always creates a Member, even if Staff is requested', async () => {
    const email = `rls-signup-${RUN}@mustangcloset.test`;
    const client = createClient(url, anonKey, clientOptions);
    const { data, error } = await client.auth.signUp({
      email, password: PASSWORD,
      options: { data: { invite_code: ` ${inviteCode.toLowerCase()}`, role: 'Staff', first_name: 'New', last_name: 'Person', instrument: 'Tuba' } },
    });
    if (data.user) createdUserIds.push(data.user.id);
    assert.equal(error, null);
    const { data: profile } = await admin.from('profiles').select('role, first_name, instrument').eq('id', data.user!.id).single();
    assert.deepEqual(profile, { role: 'Member', first_name: 'New', instrument: 'Tuba' });
  });
});

describe('anonymous access', () => {
  test('anon (not signed in) reads of profiles, flags, combos, and games return nothing', async () => {
    const profiles = await anon.from('profiles').select('id');
    assert.equal(profiles.error, null);
    assert.equal(profiles.data?.length ?? 0, 0);
    const flags = await anon.from('flags').select('id');
    assert.equal(flags.error, null);
    assert.equal(flags.data?.length ?? 0, 0);
    const combos = await anon.from('combos').select('id');
    assert.equal(combos.error, null);
    assert.equal(combos.data?.length ?? 0, 0);
    const games = await anon.from('games').select('id');
    assert.equal(games.error, null);
    assert.equal(games.data?.length ?? 0, 0);
  });
});

describe('member permissions', () => {
  test('sees only their own profile', async () => {
    const { data, error } = await asMember.from('profiles').select('id');
    assert.equal(error, null);
    assert.deepEqual(data?.map((r) => r.id), [member.id]);
  });

  test('can read staff names through staff_directory', async () => {
    const { data, error } = await asMember.from('staff_directory').select('id, first_name');
    assert.equal(error, null);
    assert.ok(data?.some((r) => r.id === staff.id));
  });

  test('staff_directory never returns non-staff rows or extra columns', async () => {
    const { data, error } = await asMember.from('staff_directory').select('*');
    assert.equal(error, null);
    assert.ok(!data!.some((r) => r.id === member.id || r.id === otherMember.id));
    for (const row of data!) {
      assert.deepEqual(Object.keys(row).sort(), ['first_name', 'id', 'last_name']);
    }
  });

  test('cannot update or delete through staff_directory', async () => {
    const update = await asMember.from('staff_directory').update({ first_name: 'Hacked' }).eq('id', staff.id);
    assert.notEqual(update.error, null);
    const del = await asMember.from('staff_directory').delete().eq('id', staff.id);
    assert.notEqual(del.error, null);
    const { data } = await admin.from('profiles').select('first_name, role').eq('id', staff.id).single();
    assert.deepEqual(data, { first_name: 'staff', role: 'Staff' });
  });

  test('can edit their own phone', async () => {
    const { data, error } = await asMember.from('profiles').update({ phone: '2145550100' }).eq('id', member.id).select('id');
    assert.equal(error, null);
    assert.equal(data?.length, 1);
    const { data: row } = await admin.from('profiles').select('phone').eq('id', member.id).single();
    assert.equal(row?.phone, '2145550100');
  });

  test('cannot change their own role', async () => {
    const { error } = await asMember.from('profiles').update({ role: 'Staff' }).eq('id', member.id);
    assert.notEqual(error, null);
    const { data } = await admin.from('profiles').select('role').eq('id', member.id).single();
    assert.equal(data?.role, 'Member');
  });

  test('cannot edit their profile email directly', async () => {
    const { error } = await asMember.from('profiles').update({ email: 'hacker@example.com' }).eq('id', member.id);
    assert.notEqual(error, null);
    const { data } = await admin.from('profiles').select('email').eq('id', member.id).single();
    assert.equal(data?.email, member.email);
  });

  test("cannot edit someone else's profile", async () => {
    const { data } = await asMember.from('profiles').update({ phone: '1' }).eq('id', staff.id).select('id');
    assert.equal(data?.length ?? 0, 0);
    const { data: row } = await admin.from('profiles').select('phone').eq('id', staff.id).single();
    assert.notEqual(row?.phone, '1');
  });

  test('cannot insert or upsert a profile row (forging a profile or role)', async () => {
    // Uses the member's own (valid) id so the insert can only fail on the
    // security rules, not on the foreign key to auth.users.
    const insert = await asMember.from('profiles').insert({
      id: member.id, email: 'forged@example.com', first_name: 'Forged', last_name: 'User',
      instrument: 'Tuba', role: 'Staff',
    });
    assert.notEqual(insert.error, null);
    assert.equal(insert.error?.code, '42501', `expected a permission error, got ${insert.error?.code}: ${insert.error?.message}`);
    const { data: rows } = await admin.from('profiles').select('email, role').eq('id', member.id);
    assert.deepEqual(rows, [{ email: member.email, role: 'Member' }]);
    const upsert = await asMember.from('profiles').upsert(
      { id: member.id, email: member.email, first_name: 'Member', last_name: 'Test', instrument: 'Trumpet', role: 'Staff' },
      { onConflict: 'id' },
    );
    assert.notEqual(upsert.error, null);
    const { data: ownRow } = await admin.from('profiles').select('role').eq('id', member.id).single();
    assert.equal(ownRow?.role, 'Member');
  });

  test('cannot delete profiles, flags, games, or combos', async () => {
    const profileDel = await asMember.from('profiles').delete().eq('id', staff.id).select('id');
    assert.equal(profileDel.data?.length ?? 0, 0);
    const { data: staffStillThere } = await admin.from('profiles').select('id').eq('id', staff.id);
    assert.equal(staffStillThere?.length, 1);

    const flagDel = await asMember.from('flags').delete().eq('member_id', otherMember.id).select('id');
    assert.equal(flagDel.data?.length ?? 0, 0);
    const { data: flagStillThere } = await admin.from('flags').select('id').eq('member_id', otherMember.id);
    assert.ok((flagStillThere?.length ?? 0) > 0);

    const gameDel = await asMember.from('games').delete().eq('id', CURRENT_GAME).select('id');
    assert.equal(gameDel.data?.length ?? 0, 0);
    const { data: gameStillThere } = await admin.from('games').select('id').eq('id', CURRENT_GAME);
    assert.equal(gameStillThere?.length, 1);

    const comboDel = await asMember.from('combos').delete().eq('id', SEED_COMBO_01).select('id');
    assert.equal(comboDel.data?.length ?? 0, 0);
    const { data: comboStillThere } = await admin.from('combos').select('id').eq('id', SEED_COMBO_01);
    assert.equal(comboStillThere?.length, 1);
  });

  test('cannot update combos; cannot insert or delete games', async () => {
    const comboUpdate = await asMember.from('combos').update({ label: 'Hacked' }).eq('id', SEED_COMBO_01).select('id');
    assert.equal(comboUpdate.data?.length ?? 0, 0);
    const { data: comboRow } = await admin.from('combos').select('label').eq('id', SEED_COMBO_01).single();
    assert.notEqual(comboRow?.label, 'Hacked');

    const gameInsert = await asMember.from('games').insert({ opponent: 'Forged High', game_date: '2026-01-01' });
    assert.notEqual(gameInsert.error, null);

    const gameDel = await asMember.from('games').delete().eq('id', CURRENT_GAME).select('id');
    assert.equal(gameDel.data?.length ?? 0, 0);
    const { data: gameRow } = await admin.from('games').select('id, is_current').eq('id', CURRENT_GAME).single();
    assert.equal(gameRow?.is_current, true);
  });

  test('cannot read settings', async () => {
    const { data } = await asMember.from('settings').select('*');
    assert.equal(data?.length ?? 0, 0);
  });

  test('submit_flag creates one open flag; submitting again updates it', async () => {
    const args = { p_piece: 'Coats', p_color: 'Blue', p_size: '208', p_status: 'dirty', p_comment: '', p_photo_path: null };
    const first = await asMember.rpc('submit_flag', args);
    const second = await asMember.rpc('submit_flag', { ...args, p_status: 'repair', p_comment: 'torn' });
    assert.equal(first.error, null);
    assert.equal(second.error, null);
    assert.equal(second.data.id, first.data.id);
    assert.equal(second.data.member_name, 'member Test');
    const { data } = await admin.from('flags').select('status').eq('member_id', member.id).eq('piece', 'Coats');
    assert.deepEqual(data, [{ status: 'repair' }]);
  });

  test('cannot create a flag for someone else', async () => {
    const { error } = await asMember.from('flags').insert({
      member_id: otherMember.id, piece: 'Pants', color: 'White', size: '204', status: 'dirty',
    });
    assert.notEqual(error, null);
  });

  test("cannot see other members' flags", async () => {
    const { data, error } = await asMember.from('flags').select('member_id');
    assert.equal(error, null);
    assert.ok(data!.every((r) => r.member_id === member.id));
    assert.ok(!data!.some((r) => r.member_id === otherMember.id));
    const { data: ownFlags } = await admin.from('flags').select('id').eq('member_id', member.id);
    assert.equal(data!.length, ownFlags?.length ?? 0);
    if ((ownFlags?.length ?? 0) > 0) {
      assert.ok(data!.some((r) => r.member_id === member.id));
    }
  });

  test("cannot update another member's flag", async () => {
    const { data } = await asMember
      .from('flags')
      .update({ status: 'dirty' })
      .eq('member_id', otherMember.id)
      .eq('piece', 'Vests')
      .select('id');
    assert.equal(data?.length ?? 0, 0);
    const { data: row } = await admin.from('flags').select('status').eq('member_id', otherMember.id).eq('piece', 'Vests').single();
    assert.equal(row?.status, 'repair');
  });

  test('cannot add or delete combos', async () => {
    const insert = await asMember.from('combos').insert({ label: 'Nope' });
    assert.notEqual(insert.error, null);
    const del = await asMember.from('combos').delete().eq('id', SEED_COMBO_01).select('id');
    assert.equal(del.data?.length ?? 0, 0);
    const { data } = await admin.from('combos').select('id').eq('id', SEED_COMBO_01);
    assert.equal(data?.length, 1);
  });

  test('cannot change the current game', async () => {
    const prior = await currentSlots();
    try {
      const { data } = await asMember.from('games').update({ halftime_combo_id: SEED_COMBO_01 }).eq('id', CURRENT_GAME).select('id');
      assert.equal(data?.length ?? 0, 0);
      const after = await currentSlots();
      assert.equal(after.halftime_combo_id, prior.halftime_combo_id);
    } finally {
      await restoreSlots(prior);
    }
  });

  test('cannot call set_role', async () => {
    const { error } = await asMember.rpc('set_role', { target: member.id, new_role: 'Staff' });
    assert.notEqual(error, null);
  });

  test('cannot upload combo images', async () => {
    const path = `rls-${RUN}-member-upload.txt`;
    try {
      const { error } = await asMember.storage.from('combo-images').upload(path, new Blob(['x']), { contentType: 'text/plain' });
      assert.notEqual(error, null);
      const { data: listing, error: listError } = await admin.storage.from('combo-images').list('', { search: path });
      assert.equal(listError, null);
      assert.ok(!listing?.some((f) => f.name === path), 'no object was stored');
    } finally {
      await admin.storage.from('combo-images').remove([path]);
    }
  });

  test('cannot delete combo images', async () => {
    const path = `rls-${RUN}-protected.txt`;
    try {
      const uploaded = await asStaff.storage.from('combo-images').upload(path, new Blob(['x']), { contentType: 'text/plain' });
      assert.equal(uploaded.error, null);
      // Member's delete must fail outright, or at minimum be a no-op (RLS filters
      // the row out before the delete can match it) — either way, the file must
      // still be there afterward, which is the assertion that actually matters.
      await asMember.storage.from('combo-images').remove([path]);
      const { data: listing, error: listError } = await admin.storage.from('combo-images').list('', { search: path });
      assert.equal(listError, null);
      assert.ok(listing?.some((f) => f.name === path));
    } finally {
      await admin.storage.from('combo-images').remove([path]);
    }
  });

  test('email change on the login syncs to the profile', { skip: 'Needs custom SMTP: Supabase sends a verification email on email change and the built-in mailer refuses test addresses. Re-enable when SMTP is configured.' }, async () => {
    const newEmail = `rls-renamed-${RUN}@mustangcloset.test`;
    const client = await signIn(otherMember.email);
    const { error } = await client.auth.updateUser({ email: newEmail });
    assert.equal(error, null);
    const { data } = await admin.from('profiles').select('email').eq('id', otherMember.id).single();
    assert.equal(data?.email, newEmail, 'If this fails, turn off "Confirm email" / "Secure email change" in Supabase Auth settings');
  });
});

describe('staff permissions', () => {
  test('sees every flag', async () => {
    const { data, error } = await asStaff.from('flags').select('member_id');
    assert.equal(error, null);
    assert.ok(data!.some((r) => r.member_id === otherMember.id));
  });

  test('nobody can delete flags', async () => {
    const { data: flag, error } = await admin
      .from('flags')
      .insert({ member_id: member.id, piece: 'Shakos', color: 'White', size: 'M', status: 'dirty' })
      .select('id')
      .single();
    if (error) throw error;
    const del = await asStaff.from('flags').delete().eq('id', flag.id).select('id');
    assert.equal(del.data?.length ?? 0, 0);
    const { data: still } = await admin.from('flags').select('id').eq('id', flag.id);
    assert.equal(still?.length, 1);
  });

  test('sees every profile', async () => {
    const { data, error } = await asStaff.from('profiles').select('id');
    assert.equal(error, null);
    const ids = data!.map((r) => r.id);
    for (const id of [member.id, otherMember.id, staff.id]) assert.ok(ids.includes(id));
  });

  test('can add and delete a combo', async () => {
    const { data, error } = await asStaff.from('combos').insert({ label: `RLS ${RUN}`, created_by: staff.id }).select().single();
    assert.equal(error, null);
    const del = await asStaff.from('combos').delete().eq('id', data!.id).select('id');
    assert.equal(del.data?.length, 1);
  });

  test('deleting a combo clears the game slot that used it', async () => {
    const prior = await currentSlots();
    let comboId: string | undefined;
    try {
      const { data: combo, error } = await asStaff.from('combos').insert({ label: `Slot ${RUN}` }).select().single();
      assert.equal(error, null);
      comboId = combo!.id;
      await asStaff.from('games').update({ pre_game_combo_id: comboId }).eq('id', CURRENT_GAME);
      await asStaff.from('combos').delete().eq('id', comboId);
      const { data: game } = await admin.from('games').select('pre_game_combo_id').eq('id', CURRENT_GAME).single();
      assert.equal(game?.pre_game_combo_id, null);
    } finally {
      await restoreSlots(prior);
      if (comboId) await admin.from('combos').delete().eq('id', comboId);
    }
  });

  test('can set the halftime combo', async () => {
    const prior = await currentSlots();
    try {
      const { data, error } = await asStaff.from('games').update({ halftime_combo_id: SEED_COMBO_01 }).eq('id', CURRENT_GAME).select().single();
      assert.equal(error, null);
      assert.equal(data?.halftime_combo_id, SEED_COMBO_01);
    } finally {
      await restoreSlots(prior);
    }
  });

  test('can promote and demote another user', async () => {
    const promote = await asStaff.rpc('set_role', { target: member.id, new_role: 'Staff' });
    assert.equal(promote.error, null);
    const { data } = await admin.from('profiles').select('role').eq('id', member.id).single();
    assert.equal(data?.role, 'Staff');
    const demote = await asStaff.rpc('set_role', { target: member.id, new_role: 'Member' });
    assert.equal(demote.error, null);
    const { data: final } = await admin.from('profiles').select('role').eq('id', member.id).single();
    assert.equal(final?.role, 'Member');
  });

  test('can edit their own profile (staff Profile screen)', async () => {
    try {
      const { data, error } = await asStaff
        .from('profiles')
        .update({ phone: '2145550123', height_feet: '6', height_inches: '1', weight: '180' })
        .eq('id', staff.id)
        .select('id');
      assert.equal(error, null);
      assert.equal(data?.length, 1);
      const { data: row } = await admin.from('profiles').select('phone, height_feet, height_inches, weight').eq('id', staff.id).single();
      assert.deepEqual(row, { phone: '2145550123', height_feet: '6', height_inches: '1', weight: '180' });
    } finally {
      await admin.from('profiles').update({ phone: '', height_feet: '', height_inches: '', weight: '' }).eq('id', staff.id);
    }
  });

  test('cannot change their own role', async () => {
    const { error } = await asStaff.rpc('set_role', { target: staff.id, new_role: 'Member' });
    assert.notEqual(error, null);
  });

  test('can upload and delete combo images', async () => {
    const path = `rls-${RUN}.txt`;
    try {
      const upload = await asStaff.storage.from('combo-images').upload(path, new Blob(['x']), { contentType: 'text/plain' });
      assert.equal(upload.error, null);
      const remove = await asStaff.storage.from('combo-images').remove([path]);
      assert.equal(remove.error, null);
    } finally {
      await admin.storage.from('combo-images').remove([path]);
    }
  });
});

describe('member numbers', () => {
  // Digits only, unlikely to be real: '9' / '8' + last 8 digits of the clock.
  const n1 = '9' + String(Date.now()).slice(-8);
  const n2 = '8' + String(Date.now()).slice(-8);

  // Service-role updates bypass the guard (auth.uid() is null).
  async function resetNumbers(...ids: string[]) {
    await admin.from('profiles').update({ numbers: {} }).in('id', ids);
  }

  test('a member cannot change their own numbers directly', async () => {
    try {
      const { error } = await asMember.from('profiles').update({ numbers: { Coats: '1' } }).eq('id', member.id);
      assert.notEqual(error, null);
      const { data } = await admin.from('profiles').select('numbers').eq('id', member.id).single();
      assert.deepEqual(data?.numbers, {});
    } finally {
      await resetNumbers(member.id);
    }
  });

  test('a member cannot call set_member_numbers', async () => {
    try {
      const self = await asMember.rpc('set_member_numbers', { target: member.id, new_numbers: { Coats: n1 } });
      assert.equal(self.error?.code, '42501');
      const other = await asMember.rpc('set_member_numbers', { target: otherMember.id, new_numbers: { Coats: n1 } });
      assert.equal(other.error?.code, '42501');
      const { data } = await admin.from('profiles').select('numbers').in('id', [member.id, otherMember.id]);
      assert.ok(data!.every((row) => Object.keys(row.numbers).length === 0));
    } finally {
      await resetNumbers(member.id, otherMember.id);
    }
  });

  test("staff can set a member's numbers, trimmed, empties dropped", async () => {
    try {
      const { error } = await asStaff.rpc('set_member_numbers', { target: member.id, new_numbers: { Coats: ` ${n1} `, Vests: '' } });
      assert.equal(error, null);
      const { data } = await admin.from('profiles').select('numbers').eq('id', member.id).single();
      assert.deepEqual(data?.numbers, { Coats: n1 });
    } finally {
      await resetNumbers(member.id);
    }
  });

  test('staff cannot set a non-numeric number', async () => {
    const { error } = await asStaff.rpc('set_member_numbers', { target: member.id, new_numbers: { Coats: '18a' } });
    assert.equal(error?.code, '22023');
    const { data } = await admin.from('profiles').select('numbers').eq('id', member.id).single();
    assert.deepEqual(data?.numbers, {});
  });

  test('set_member_numbers refuses a number held by another active member', async () => {
    try {
      const first = await asStaff.rpc('set_member_numbers', { target: member.id, new_numbers: { Coats: n1 } });
      assert.equal(first.error, null);
      const second = await asStaff.rpc('set_member_numbers', { target: otherMember.id, new_numbers: { Coats: n1 } });
      assert.equal(second.error?.code, '23505');
      assert.equal(second.error!.message, `number ${n1} for Coats already belongs to member Test`);
      const { data } = await admin.from('profiles').select('numbers').eq('id', otherMember.id).single();
      assert.deepEqual(data?.numbers, {});
      // The same number under a different type is fine, and so is re-saving your own.
      const diff = await asStaff.rpc('set_member_numbers', { target: otherMember.id, new_numbers: { Vests: n1 } });
      assert.equal(diff.error, null);
      const again = await asStaff.rpc('set_member_numbers', { target: member.id, new_numbers: { Coats: n1, Pants: n2 } });
      assert.equal(again.error, null);
    } finally {
      await resetNumbers(member.id, otherMember.id);
    }
  });

  test('an existing duplicate never blocks saving other numbers', async () => {
    const n3 = '7' + String(Date.now()).slice(-8);
    try {
      // Bypass the function to create a legacy duplicate.
      await admin.from('profiles').update({ numbers: { Coats: n1 } }).in('id', [member.id, otherMember.id]);
      const vests = await asStaff.rpc('set_member_numbers', { target: member.id, new_numbers: { Coats: n1, Vests: n2 } });
      assert.equal(vests.error, null);
      const same = await asStaff.rpc('set_member_numbers', { target: member.id, new_numbers: { Coats: n1, Vests: n2 } });
      assert.equal(same.error, null);
      await admin.from('profiles').update({ numbers: { Coats: n3 } }).eq('id', otherMember.id);
      const clash = await asStaff.rpc('set_member_numbers', { target: member.id, new_numbers: { Coats: n3 } });
      assert.equal(clash.error?.code, '23505');
      const { data } = await admin.from('profiles').select('numbers').eq('id', member.id).single();
      assert.deepEqual(data?.numbers, { Coats: n1, Vests: n2 });
    } finally {
      await resetNumbers(member.id, otherMember.id);
    }
  });

  test('a number held by an archived member can be reused', async () => {
    const leaver = await createUser('numleaver');
    try {
      const archive = await asStaff.rpc('archive_member', { target: leaver.id });
      assert.equal(archive.error, null);
      // archive_member clears numbers, so write one straight onto the archived profile.
      const write = await admin.from('profiles').update({ numbers: { Coats: n2 } }).eq('id', leaver.id);
      assert.equal(write.error, null);
      const { error } = await asStaff.rpc('set_member_numbers', { target: member.id, new_numbers: { Coats: n2 } });
      assert.equal(error, null);
    } finally {
      await resetNumbers(member.id);
    }
  });

  test('set_member_numbers refuses an archived member', async () => {
    const leaver = await createUser('numarch');
    const archive = await asStaff.rpc('archive_member', { target: leaver.id });
    assert.equal(archive.error, null);
    const { error } = await asStaff.rpc('set_member_numbers', { target: leaver.id, new_numbers: { Coats: n2 } });
    assert.equal(error?.code, '22023');
    assert.match(error!.message, /archived/);
    const { data } = await admin.from('profiles').select('numbers').eq('id', leaver.id).single();
    assert.deepEqual(data?.numbers, {});
  });
});

describe('archiving members', () => {
  test('members cannot archive, restore, or read or write snapshots', async () => {
    const archive = await asMember.rpc('archive_member', { target: otherMember.id });
    assert.notEqual(archive.error, null);
    const restore = await asMember.rpc('restore_member', { target: otherMember.id });
    assert.notEqual(restore.error, null);
    const { data: rows } = await asMember.from('member_archives').select('id');
    assert.equal(rows?.length ?? 0, 0);
    const insert = await asMember.from('member_archives').insert({ member_id: member.id, snapshot: {} });
    assert.notEqual(insert.error, null);
    const { data: profile } = await admin.from('profiles').select('archived_at').eq('id', otherMember.id).single();
    assert.equal(profile?.archived_at, null);
  });

  test('a member cannot set archived_at on their own profile', async () => {
    const { error } = await asMember.from('profiles').update({ archived_at: new Date().toISOString() }).eq('id', member.id);
    assert.notEqual(error, null);
    const { data } = await admin.from('profiles').select('archived_at').eq('id', member.id).single();
    assert.equal(data?.archived_at, null);
  });

  test('staff cannot archive themselves or another staff account', async () => {
    const self = await asStaff.rpc('archive_member', { target: staff.id });
    assert.notEqual(self.error, null);
    const otherStaff = await createUser('staff2');
    await admin.from('profiles').update({ role: 'Staff' }).eq('id', otherStaff.id);
    const other = await asStaff.rpc('archive_member', { target: otherStaff.id });
    assert.notEqual(other.error, null);
    const { data } = await admin.from('profiles').select('archived_at').in('id', [staff.id, otherStaff.id]);
    assert.ok(data!.every((row) => row.archived_at === null));
  });

  test('archiving snapshots the member, keeps flags, clears numbers, and blocks login; restore lets them back in', async () => {
    const leaver = await createUser('leaver');
    await admin.from('profiles').update({ numbers: { Coats: '208', Pants: '216' }, phone: '2145550199' }).eq('id', leaver.id);
    await admin.from('flags').insert({ member_id: leaver.id, piece: 'Coats', color: 'Blue', size: '208', status: 'repair', comment: 'torn' });
    const asLeaver = await signIn(leaver.email);

    const archive = await asStaff.rpc('archive_member', { target: leaver.id });
    assert.equal(archive.error, null);

    const { data: profile } = await admin
      .from('profiles').select('numbers, archived_at').eq('id', leaver.id).single();
    assert.deepEqual(
      { ...profile, archived_at: profile?.archived_at !== null },
      { numbers: {}, archived_at: true }
    );
    const { data: flags } = await admin.from('flags').select('id').eq('member_id', leaver.id);
    assert.equal(flags?.length, 1);

    const { data: snapshots } = await asStaff.from('member_archives').select('*').eq('member_id', leaver.id);
    assert.equal(snapshots?.length, 1);
    const snap = snapshots![0];
    assert.equal(snap.archived_by_name, 'staff Test');
    assert.equal(snap.restored_at, null);
    assert.deepEqual(snap.snapshot.numbers, { Coats: '208', Pants: '216' });
    assert.equal('coat_size' in snap.snapshot, false);
    assert.equal(snap.snapshot.phone, '2145550199');
    assert.deepEqual(snap.snapshot.flags, [{ piece: 'Coats', color: 'Blue', size: '208', status: 'repair', comment: 'torn' }]);

    // Password sign-in is refused.
    const blocked = createClient(url, anonKey, clientOptions);
    const { error: signInError } = await blocked.auth.signInWithPassword({ email: leaver.email, password: PASSWORD });
    assert.notEqual(signInError, null);
    assert.match(signInError!.message, /banned/i);

    // An access token issued before archiving can't write anything.
    const flagInsert = await asLeaver.from('flags').insert({ member_id: leaver.id, piece: 'Pants', color: 'Blue', size: '216', status: 'dirty' });
    assert.notEqual(flagInsert.error, null);
    const phoneUpdate = await asLeaver.from('profiles').update({ phone: '0000000000' }).eq('id', leaver.id).select('id');
    assert.equal(phoneUpdate.data?.length ?? 0, 0);
    const { data: phoneRow } = await admin.from('profiles').select('phone').eq('id', leaver.id).single();
    assert.equal(phoneRow?.phone, '2145550199');

    // Archiving twice is refused.
    const again = await asStaff.rpc('archive_member', { target: leaver.id });
    assert.notEqual(again.error, null);

    const restore = await asStaff.rpc('restore_member', { target: leaver.id });
    assert.equal(restore.error, null);
    const { data: restored } = await admin.from('profiles').select('archived_at, numbers').eq('id', leaver.id).single();
    assert.deepEqual(restored, { archived_at: null, numbers: {} });
    const { data: stamped } = await admin.from('member_archives').select('restored_at, restored_by_name').eq('member_id', leaver.id).single();
    assert.notEqual(stamped?.restored_at, null);
    assert.equal(stamped?.restored_by_name, 'staff Test');
    await signIn(leaver.email);

    // Restoring someone who isn't archived is refused.
    const restoreAgain = await asStaff.rpc('restore_member', { target: leaver.id });
    assert.notEqual(restoreAgain.error, null);
  });
});

describe('flag history', () => {
  // A size no real inventory has, so clear_flag never touches a real member's flag.
  const TSIZE = 'T-' + RUN;
  async function adminFlag(memberId: string, piece: string, color: string, size: string) {
    const { data, error } = await admin
      .from('flags')
      .insert({ member_id: memberId, piece, color, size, status: 'dirty' })
      .select('id')
      .single();
    if (error) throw error;
    return data.id as string;
  }
  async function row(id: string) {
    const { data } = await admin.from('flags').select('*').eq('id', id).single();
    return data!;
  }

  test('staff clear_flag keeps the row with who/when; re-flagging after a clear creates a new open flag and keeps the cleared one', async () => {
    const args = { p_piece: 'Vests', p_color: 'Candy', p_size: TSIZE, p_status: 'dirty', p_comment: '', p_photo_path: null };
    const first = await asMember.rpc('submit_flag', args);
    assert.equal(first.error, null);
    const clear = await asStaff.rpc('clear_flag', { p_id: first.data.id });
    assert.equal(clear.error, null);
    const second = await asMember.rpc('submit_flag', args);
    assert.equal(second.error, null);
    assert.notEqual(second.data.id, first.data.id);

    const { data: rows } = await admin.from('flags').select('*').eq('member_id', member.id).eq('piece', 'Vests').eq('color', 'Candy');
    assert.equal(rows?.length, 2);
    assert.equal(rows!.filter((r) => r.cleared_at === null).length, 1);
    const cleared = rows!.find((r) => r.cleared_at !== null)!;
    assert.equal(cleared.id, first.data.id);
    assert.equal(cleared.cleared_by, staff.id);
    assert.equal(cleared.cleared_by_name, 'staff Test');
  });

  test('clear_flag clears every open flag on the same piece/color/size, but not Unassigned ones', async () => {
    const m1 = await adminFlag(member.id, 'Coats', 'Red', TSIZE);
    const m2 = await adminFlag(otherMember.id, 'Coats', 'Red', TSIZE);
    const u1 = await adminFlag(member.id, 'Coats', 'Purple', 'Unassigned');
    const u2 = await adminFlag(otherMember.id, 'Coats', 'Purple', 'Unassigned');

    const c1 = await asStaff.rpc('clear_flag', { p_id: m1 });
    assert.equal(c1.error, null);
    assert.notEqual((await row(m1)).cleared_at, null);
    assert.notEqual((await row(m2)).cleared_at, null);

    const c2 = await asStaff.rpc('clear_flag', { p_id: u1 });
    assert.equal(c2.error, null);
    assert.notEqual((await row(u1)).cleared_at, null);
    assert.equal((await row(u2)).cleared_at, null);
  });

  test('member cannot clear a flag or set staff_note', async () => {
    const id = await adminFlag(member.id, 'Bibbers', 'Blue', TSIZE);
    const clear = await asMember.rpc('clear_flag', { p_id: id });
    assert.equal(clear.error?.code, '42501');
    assert.equal((await row(id)).cleared_at, null);

    const note = await asMember.from('flags').update({ staff_note: 'x' }).eq('id', id).select('id');
    assert.notEqual(note.error, null);
    assert.equal((await row(id)).staff_note, '');

    const cl = await asMember.from('flags').update({ cleared_at: new Date().toISOString() }).eq('id', id).select('id');
    assert.notEqual(cl.error, null);
    assert.equal((await row(id)).cleared_at, null);
  });

  test('submit_flag keep_photo preserves the server photo_path on update', async () => {
    const base = { p_piece: 'Skirts', p_color: 'Blue', p_size: TSIZE, p_status: 'dirty', p_comment: '' };
    const first = await asMember.rpc('submit_flag', { ...base, p_photo_path: `${member.id}/keep-${RUN}.jpg` });
    assert.equal(first.error, null);
    const second = await asMember.rpc('submit_flag', { ...base, p_status: 'repair', p_photo_path: null, p_keep_photo: true });
    assert.equal(second.error, null);
    assert.equal(second.data.id, first.data.id);
    assert.equal(second.data.status, 'repair');
    assert.equal((await row(first.data.id)).photo_path, `${member.id}/keep-${RUN}.jpg`);
  });

  test('submit_flag keep_photo on a fresh insert stores null and leaves the cleared row alone', async () => {
    const base = { p_piece: 'Skirts', p_color: 'Red', p_size: TSIZE, p_status: 'dirty', p_comment: '' };
    const path = `${member.id}/cleared-${RUN}.jpg`;
    const first = await asMember.rpc('submit_flag', { ...base, p_photo_path: path });
    assert.equal(first.error, null);
    assert.equal((await asStaff.rpc('clear_flag', { p_id: first.data.id })).error, null);
    const second = await asMember.rpc('submit_flag', { ...base, p_photo_path: path, p_keep_photo: true });
    assert.equal(second.error, null);
    assert.notEqual(second.data.id, first.data.id);
    assert.equal(second.data.photo_path, null);
    assert.equal((await row(first.data.id)).photo_path, path);
  });

  test('member cannot edit a cleared flag', async () => {
    const id = await adminFlag(member.id, 'Pants', 'Red', TSIZE);
    const clear = await asStaff.rpc('clear_flag', { p_id: id });
    assert.equal(clear.error, null);
    const upd = await asMember.from('flags').update({ comment: 'sneaky' }).eq('id', id).select('id');
    assert.equal(upd.data?.length ?? 0, 0);
    assert.equal((await row(id)).comment, '');
  });

  test('staff can edit color, status, comment and staff_note but not cleared_at directly', async () => {
    const id = await adminFlag(member.id, 'Pants', 'Blue', TSIZE);
    const upd = await asStaff
      .from('flags')
      .update({ color: 'Red', status: 'dirty', comment: 'c', staff_note: 'n' })
      .eq('id', id)
      .select('id');
    assert.equal(upd.error, null);
    assert.equal(upd.data?.length, 1);
    const r = await row(id);
    assert.deepEqual([r.color, r.status, r.comment, r.staff_note], ['Red', 'dirty', 'c', 'n']);

    const cl = await asStaff.from('flags').update({ cleared_at: new Date().toISOString() }).eq('id', id).select('id');
    assert.notEqual(cl.error, null);
    assert.equal((await row(id)).cleared_at, null);
  });
});

describe('flag insert forgery', () => {
  test('a member inserting a flag cannot forge member_name, source, staff_note, cleared_by or created_at', async () => {
    const { data, error } = await asMember
      .from('flags')
      .insert({
        member_id: member.id, piece: 'Shakos', color: 'Forge', size: 'T-' + RUN, status: 'dirty',
        member_name: 'Someone Else', source: 'import', staff_note: 'x',
        cleared_by: staff.id, cleared_by_name: 'staff Test', created_at: '2001-01-01T00:00:00Z',
      })
      .select('*')
      .single();
    assert.equal(error, null);
    assert.equal(data!.member_name, 'member Test');
    assert.equal(data!.source, 'member');
    assert.equal(data!.staff_note, '');
    assert.equal(data!.cleared_by, null);
    assert.equal(data!.cleared_by_name, null);
    assert.equal(data!.cleared_at, null);
    assert.ok(new Date(data!.created_at).getFullYear() >= 2026);
  });
});

describe('flag photos', () => {
  const body = () => new Uint8Array([0xff, 0xd8, 0xff]);
  const opts = { contentType: 'image/jpeg' };
  const bucket = (c: SupabaseClient) => c.storage.from('flag-photos');

  test('member can upload, read and delete a photo in their own folder', async () => {
    const path = `${member.id}/t-${RUN}.jpg`;
    try {
      const up = await bucket(asMember).upload(path, body(), opts);
      assert.equal(up.error, null);
      const down = await bucket(asMember).download(path);
      assert.equal(down.error, null);
      const del = await bucket(asMember).remove([path]);
      assert.equal(del.error, null);
      const { data: listing } = await admin.storage.from('flag-photos').list(member.id, { search: `t-${RUN}.jpg` });
      assert.ok(!listing?.some((f) => f.name === `t-${RUN}.jpg`), 'object was deleted');
    } finally {
      await admin.storage.from('flag-photos').remove([path]);
    }
  });

  test("member cannot upload into another member's folder", async () => {
    const path = `${otherMember.id}/x-${RUN}.jpg`;
    try {
      const { error } = await bucket(asMember).upload(path, body(), opts);
      assert.notEqual(error, null);
    } finally {
      await admin.storage.from('flag-photos').remove([path]);
    }
  });

  test("member cannot read another member's flag photo", async () => {
    const path = `${otherMember.id}/r-${RUN}.jpg`;
    try {
      const up = await admin.storage.from('flag-photos').upload(path, body(), opts);
      assert.equal(up.error, null);
      const { error } = await bucket(asMember).download(path);
      assert.notEqual(error, null);
    } finally {
      await admin.storage.from('flag-photos').remove([path]);
    }
  });

  test('staff can read and delete any flag photo', async () => {
    const path = `${member.id}/s-${RUN}.jpg`;
    try {
      const up = await admin.storage.from('flag-photos').upload(path, body(), opts);
      assert.equal(up.error, null);
      const down = await bucket(asStaff).download(path);
      assert.equal(down.error, null);
      const del = await bucket(asStaff).remove([path]);
      assert.equal(del.error, null);
      const { data: listing } = await admin.storage.from('flag-photos').list(member.id, { search: `s-${RUN}.jpg` });
      assert.ok(!listing?.some((f) => f.name === `s-${RUN}.jpg`), 'object was deleted');
    } finally {
      await admin.storage.from('flag-photos').remove([path]);
    }
  });
});

describe('inventory', () => {
  const coatsName = `RLS Coats ${RUN}`;
  const tiesName = `RLS Ties ${RUN}`;
  let coatsId: string;
  let tiesId: string;
  let bluePieceId: string;

  before(async () => {
    const coats = await admin
      .from('piece_types')
      .insert({ name: coatsName, kind: 'numbered', colors: ['Blue', 'Red'] })
      .select('id')
      .single();
    assert.equal(coats.error, null);
    coatsId = coats.data!.id;
    const ties = await admin
      .from('piece_types')
      .insert({ name: tiesName, kind: 'counted', stock: { Blue: 3 } })
      .select('id')
      .single();
    assert.equal(ties.error, null);
    tiesId = ties.data!.id;
    const pieces = await admin
      .from('pieces')
      .insert([
        { piece_type_id: coatsId, color: 'Blue', number: '101' },
        { piece_type_id: coatsId, color: 'Red', number: '101' },
      ])
      .select('id, color');
    assert.equal(pieces.error, null);
    bluePieceId = pieces.data!.find((p) => p.color === 'Blue')!.id;
  });

  after(async () => {
    await admin.from('piece_types').delete().in('name', [coatsName, tiesName]);
  });

  test('members and staff can read piece types and pieces', async () => {
    for (const client of [asMember, asStaff]) {
      const types = await client.from('piece_types').select('kind, colors').eq('name', coatsName);
      assert.equal(types.error, null);
      assert.equal(types.data?.length, 1);
      assert.equal(types.data![0].kind, 'numbered');
      assert.deepEqual(types.data![0].colors, ['Blue', 'Red']);
      const pieces = await client.from('pieces').select('id').eq('piece_type_id', coatsId);
      assert.equal(pieces.error, null);
      assert.equal(pieces.data?.length, 2);
    }
  });

  test('members cannot insert, update or delete piece types or pieces', async () => {
    const insType = await asMember.from('piece_types').insert({ name: `RLS Bad ${RUN}`, kind: 'counted' }).select();
    assert.ok(insType.error || (insType.data?.length ?? 0) === 0);
    const insPiece = await asMember
      .from('pieces')
      .insert({ piece_type_id: coatsId, color: 'Blue', number: '202' })
      .select();
    assert.ok(insPiece.error || (insPiece.data?.length ?? 0) === 0);
    const updType = await asMember.from('piece_types').update({ retired: true }).eq('id', coatsId).select();
    assert.ok(updType.error || (updType.data?.length ?? 0) === 0);
    const updPiece = await asMember.from('pieces').update({ out_for_repair: true }).eq('id', bluePieceId).select();
    assert.ok(updPiece.error || (updPiece.data?.length ?? 0) === 0);
    const delPiece = await asMember.from('pieces').delete().eq('id', bluePieceId).select();
    assert.ok(delPiece.error || (delPiece.data?.length ?? 0) === 0);
    const delType = await asMember.from('piece_types').delete().eq('id', tiesId).select();
    assert.ok(delType.error || (delType.data?.length ?? 0) === 0);

    const types = await admin.from('piece_types').select('name, retired').in('name', [coatsName, tiesName, `RLS Bad ${RUN}`]);
    assert.equal(types.data?.length, 2);
    assert.ok(types.data!.every((t) => t.retired === false));
    const pieces = await admin.from('pieces').select('color, number, out_for_repair').eq('piece_type_id', coatsId);
    assert.equal(pieces.data?.length, 2);
    assert.ok(pieces.data!.every((p) => p.out_for_repair === false && p.number === '101'));
  });

  test('staff can mark a piece out for repair and back', async () => {
    const out = await asStaff.from('pieces').update({ out_for_repair: true }).eq('id', bluePieceId).select();
    assert.equal(out.error, null);
    assert.equal(out.data?.length, 1);
    assert.equal(out.data![0].out_for_repair, true);
    const back = await asStaff.from('pieces').update({ out_for_repair: false }).eq('id', bluePieceId).select();
    assert.equal(back.error, null);
    assert.equal(back.data?.length, 1);
    assert.equal(back.data![0].out_for_repair, false);
  });

  test('anon reads nothing from piece_types or pieces', async () => {
    const types = await anon.from('piece_types').select('id');
    assert.ok(types.error || (types.data?.length ?? 0) === 0);
    const pieces = await anon.from('pieces').select('id');
    assert.ok(pieces.error || (pieces.data?.length ?? 0) === 0);
  });
});

describe('import and add inventory', () => {
  // Every type this block creates is named with RUN, so it never touches real inventory.
  const createdTypeNames: string[] = [];
  const typeName = (label: string) => {
    const name = `RLS ${label} ${RUN}`;
    if (!createdTypeNames.includes(name)) createdTypeNames.push(name);
    return name;
  };

  async function typeRow(name: string) {
    const { data } = await admin.from('piece_types').select('*').eq('name', name).maybeSingle();
    return data;
  }
  async function piecesOf(name: string) {
    const type = await typeRow(name);
    if (!type) return [];
    const { data } = await admin
      .from('pieces')
      .select('color, number, out_for_repair')
      .eq('piece_type_id', type.id)
      .order('number')
      .order('color');
    return data ?? [];
  }
  async function resetNumbers() {
    await admin.from('profiles').update({ numbers: {} }).in('id', [member.id, otherMember.id]);
  }

  after(async () => {
    await resetNumbers();
    if (createdTypeNames.length > 0) {
      await admin.from('flags').delete().in('piece', createdTypeNames);
      await admin.from('piece_types').delete().in('name', createdTypeNames);
    }
  });

  test('members cannot call import_inventory, create_piece_type, add_piece_color, add_piece_number', async () => {
    const name = typeName('Denied');
    const payload = { typesToCreate: [{ name, colors: ['Blue'] }], piecesToAdd: [], outForRepair: [], numbers: [], notes: [] };
    const imp = await asMember.rpc('import_inventory', { payload });
    assert.equal(imp.error?.code, '42501');
    const create = await asMember.rpc('create_piece_type', {
      p_name: name, p_kind: 'numbered', p_colors: ['Blue'], p_numbers: ['1'], p_stock: {},
    });
    assert.equal(create.error?.code, '42501');
    assert.equal(await typeRow(name), null);

    const ownName = typeName('DeniedOwn');
    const own = await admin.from('piece_types').insert({ name: ownName, kind: 'numbered', colors: ['Blue'] }).select('id').single();
    assert.equal(own.error, null);
    const color = await asMember.rpc('add_piece_color', { p_type: own.data!.id, p_color: 'Red' });
    assert.equal(color.error?.code, '42501');
    const num = await asMember.rpc('add_piece_number', { p_type: own.data!.id, p_number: '5', p_colors: ['Blue'] });
    assert.equal(num.error?.code, '42501');
    assert.deepEqual((await typeRow(ownName))!.colors, ['Blue']);
    assert.deepEqual(await piecesOf(ownName), []);
  });

  // Shared by the import tests below (they run in order).
  const coats = typeName('ImpCoats');
  const vests = typeName('ImpVests');
  const fullPayload = () => ({
    typesToCreate: [
      { name: coats, colors: ['Blue', 'Red'] },
      { name: vests, colors: ['Candy'] },
    ],
    piecesToAdd: [
      { pieceType: coats, number: '101' },
      { pieceType: coats, number: '105' },
      { pieceType: vests, number: '7' },
    ],
    outForRepair: [
      { pieceType: coats, color: 'Red', number: '105' },
      { pieceType: coats, color: 'Blue', number: '109' }, // not in piecesToAdd: created
    ],
    numbers: [
      { memberId: member.id, pieceType: coats, number: '101' },
      { memberId: member.id, pieceType: vests, number: '7' },
    ],
    notes: [{ memberName: 'member Test', pieceType: coats, number: '101', text: 'loose button' }],
  });

  test('import_inventory creates types, pieces in every color, numbers, out-for-repair and notes', async () => {
    const { data, error } = await asStaff.rpc('import_inventory', { payload: fullPayload() });
    assert.equal(error, null);
    assert.deepEqual(data, { typesCreated: 2, piecesAdded: 5, markedOutForRepair: 2, numbersSet: 2, notesAdded: 1 });

    const coatsType = await typeRow(coats);
    assert.equal(coatsType!.kind, 'numbered');
    assert.deepEqual(coatsType!.colors, ['Blue', 'Red']);
    const vestsType = await typeRow(vests);
    assert.ok(vestsType!.sort_order > coatsType!.sort_order);

    assert.deepEqual(await piecesOf(coats), [
      { color: 'Blue', number: '101', out_for_repair: false },
      { color: 'Red', number: '101', out_for_repair: false },
      { color: 'Blue', number: '105', out_for_repair: false },
      { color: 'Red', number: '105', out_for_repair: true },
      { color: 'Blue', number: '109', out_for_repair: true },
    ]);
    assert.deepEqual(await piecesOf(vests), [{ color: 'Candy', number: '7', out_for_repair: false }]);

    const { data: profile } = await admin.from('profiles').select('numbers').eq('id', member.id).single();
    assert.equal(profile!.numbers[coats], '101');
    assert.equal(profile!.numbers[vests], '7');

    const { data: notes } = await admin
      .from('flags')
      .select('member_id, member_name, piece, color, size, status, comment, source, cleared_at')
      .eq('piece', coats)
      .order('color');
    assert.deepEqual(notes, [
      { member_id: null, member_name: 'member Test', piece: coats, color: 'Blue', size: '101', status: 'repair', comment: 'loose button', source: 'import', cleared_at: null },
      { member_id: null, member_name: 'member Test', piece: coats, color: 'Red', size: '101', status: 'repair', comment: 'loose button', source: 'import', cleared_at: null },
    ]);
  });

  test('imported notes are hidden from the member and visible to staff', async () => {
    const mine = await asMember.from('flags').select('id').eq('piece', coats);
    assert.equal(mine.error, null);
    assert.equal(mine.data?.length ?? 0, 0);
    const staffView = await asStaff.from('flags').select('member_name, source').eq('piece', coats);
    assert.equal(staffView.error, null);
    assert.equal(staffView.data?.length, 2);
    assert.ok(staffView.data!.every((f) => f.member_name === 'member Test' && f.source === 'import'));
  });

  test('re-running the same payload changes nothing', async () => {
    const payload = fullPayload();
    payload.notes[0].text = 'changed text'; // a note already imported for this name + piece is left alone
    const { data, error } = await asStaff.rpc('import_inventory', { payload });
    assert.equal(error, null);
    assert.deepEqual(data, { typesCreated: 0, piecesAdded: 0, markedOutForRepair: 0, numbersSet: 0, notesAdded: 0 });
    assert.equal((await piecesOf(coats)).length, 5);
    const { data: notes } = await admin.from('flags').select('comment').eq('piece', coats);
    assert.deepEqual(notes!.map((n) => n.comment), ['loose button', 'loose button']);
  });

  test('import_inventory is all-or-nothing', async () => {
    const shirts = typeName('ImpShirts');
    await resetNumbers();
    try {
      // otherMember holds Shirts 3; the payload hands Shirts 003 to member as well.
      const hold = await asStaff.rpc('set_member_numbers', { target: otherMember.id, new_numbers: { [shirts]: '3' } });
      assert.equal(hold.error, null);
      const payload = {
        typesToCreate: [{ name: shirts, colors: ['White'] }],
        piecesToAdd: [{ pieceType: shirts, number: '3' }],
        outForRepair: [{ pieceType: shirts, color: 'White', number: '4' }],
        numbers: [
          { memberId: member.id, pieceType: coats, number: '105' },
          { memberId: member.id, pieceType: shirts, number: '003' },
        ],
        notes: [{ memberName: 'member Test', pieceType: shirts, number: '3', text: 'stain' }],
      };
      const { error } = await asStaff.rpc('import_inventory', { payload });
      assert.equal(error?.code, '23505');
      assert.match(error!.message, /already belongs to other Test/);
      assert.equal(await typeRow(shirts), null);
      const { data: notes } = await admin.from('flags').select('id').eq('piece', shirts);
      assert.equal(notes?.length ?? 0, 0);
      const { data: profile } = await admin.from('profiles').select('numbers').eq('id', member.id).single();
      assert.deepEqual(profile!.numbers, {});
    } finally {
      await resetNumbers();
    }
  });

  test('import_inventory refuses an archived member', async () => {
    const leaver = await createUser('imparch');
    const archive = await asStaff.rpc('archive_member', { target: leaver.id });
    assert.equal(archive.error, null);
    const { error } = await asStaff.rpc('import_inventory', {
      payload: { typesToCreate: [], piecesToAdd: [], outForRepair: [], notes: [],
        numbers: [{ memberId: leaver.id, pieceType: coats, number: '113' }] },
    });
    assert.equal(error?.code, '22023');
    assert.match(error!.message, /archived/);
  });

  test('numbers are normalized: 085 stored as 85, and 085 clashes with 85', async () => {
    const pants = typeName('NormPants');
    await resetNumbers();
    try {
      const set = await asStaff.rpc('set_member_numbers', { target: member.id, new_numbers: { [pants]: ' 085 ' } });
      assert.equal(set.error, null);
      const { data: profile } = await admin.from('profiles').select('numbers').eq('id', member.id).single();
      assert.deepEqual(profile!.numbers, { [pants]: '85' });

      const clash = await asStaff.rpc('set_member_numbers', { target: otherMember.id, new_numbers: { [pants]: '85' } });
      assert.equal(clash.error?.code, '23505');
      const importClash = await asStaff.rpc('import_inventory', {
        payload: { typesToCreate: [], piecesToAdd: [], outForRepair: [], notes: [],
          numbers: [{ memberId: otherMember.id, pieceType: pants, number: '0085' }] },
      });
      assert.equal(importClash.error?.code, '23505');
      const badImport = await asStaff.rpc('import_inventory', {
        payload: { typesToCreate: [], piecesToAdd: [], outForRepair: [], notes: [],
          numbers: [{ memberId: otherMember.id, pieceType: pants, number: '8x' }] },
      });
      assert.equal(badImport.error?.code, '22023');
      const same = await asStaff.rpc('set_member_numbers', { target: member.id, new_numbers: { [pants]: '085' } });
      assert.equal(same.error, null);
      const zero = await asStaff.rpc('set_member_numbers', { target: otherMember.id, new_numbers: { [pants]: '000' } });
      assert.equal(zero.error, null);
      const { data: other } = await admin.from('profiles').select('numbers').eq('id', otherMember.id).single();
      assert.deepEqual(other!.numbers, { [pants]: '0' });

      const typeId = await asStaff.rpc('create_piece_type', {
        p_name: pants, p_kind: 'numbered', p_colors: ['Blue'], p_numbers: ['007', '7', '010'], p_stock: {},
      });
      assert.equal(typeId.error, null);
      const added = await asStaff.rpc('add_piece_number', { p_type: typeId.data, p_number: '0012', p_colors: ['Blue'] });
      assert.equal(added.error, null);
      assert.deepEqual((await piecesOf(pants)).map((p) => p.number).sort(), ['10', '12', '7']);
      const bad = await asStaff.rpc('add_piece_number', { p_type: typeId.data, p_number: '12a', p_colors: ['Blue'] });
      assert.equal(bad.error?.code, '22023');
    } finally {
      await resetNumbers();
    }
  });

  test('a legacy 085 holder: importing 85 for someone else is refused cleanly; 85 for the holder is not a change', async () => {
    const pants = typeName('LegacyPants');
    await resetNumbers();
    try {
      // Legacy value written directly (service role), as the old size columns left them.
      const seed = await admin.from('profiles').update({ numbers: { [pants]: '085' } }).eq('id', member.id);
      assert.equal(seed.error, null);
      const clash = await asStaff.rpc('import_inventory', {
        payload: { typesToCreate: [], piecesToAdd: [], outForRepair: [], notes: [],
          numbers: [{ memberId: otherMember.id, pieceType: pants, number: '85' }] },
      });
      assert.equal(clash.error?.code, '23505');
      assert.match(clash.error!.message, /already belongs to member Test/);
      const { data: other } = await admin.from('profiles').select('numbers').eq('id', otherMember.id).single();
      assert.deepEqual(other!.numbers, {});

      const same = await asStaff.rpc('import_inventory', {
        payload: { typesToCreate: [], piecesToAdd: [], outForRepair: [], notes: [],
          numbers: [{ memberId: member.id, pieceType: pants, number: '85' }] },
      });
      assert.equal(same.error, null);
      assert.equal(same.data.numbersSet, 0);
      const { data: mine } = await admin.from('profiles').select('numbers').eq('id', member.id).single();
      assert.deepEqual(mine!.numbers, { [pants]: '85' });
    } finally {
      await resetNumbers();
    }
  });

  test('normalize_member_numbers rewrites 085 to 85, leaves other values, and is re-runnable', async () => {
    const pants = typeName('NormRunPants');
    const vests = typeName('NormRunVests');
    await resetNumbers();
    try {
      const seed = await admin.from('profiles').update({ numbers: { [pants]: '085', [vests]: '0' } }).eq('id', member.id);
      assert.equal(seed.error, null);
      const notStaff = await asMember.rpc('normalize_member_numbers');
      assert.ok(notStaff.error, 'members cannot call it');
      const run = await admin.rpc('normalize_member_numbers');
      assert.equal(run.error, null);
      assert.ok(run.data >= 1);
      const { data: profile } = await admin.from('profiles').select('numbers').eq('id', member.id).single();
      assert.deepEqual(profile!.numbers, { [pants]: '85', [vests]: '0' });
      const again = await admin.rpc('normalize_member_numbers');
      assert.equal(again.error, null);
      assert.equal(again.data, 0);
    } finally {
      await resetNumbers();
    }
  });

  test('pieces must use a color of a numbered type', async () => {
    const coatsName = typeName('CheckCoats');
    const tiesName = typeName('CheckTies');
    const numbered = await admin.from('piece_types').insert({ name: coatsName, kind: 'numbered', colors: ['Blue'] }).select('id').single();
    assert.equal(numbered.error, null);
    const counted = await admin.from('piece_types').insert({ name: tiesName, kind: 'counted', colors: ['Blue'] }).select('id').single();
    assert.equal(counted.error, null);

    const badColor = await admin.from('pieces').insert({ piece_type_id: numbered.data!.id, color: 'Green', number: '1' });
    assert.equal(badColor.error?.code, '22023');
    assert.equal(badColor.error!.message, `Green is not a ${coatsName} color`);
    const badKind = await admin.from('pieces').insert({ piece_type_id: counted.data!.id, color: 'Blue', number: '1' });
    assert.equal(badKind.error?.code, '22023');
    assert.equal(badKind.error!.message, `${tiesName} is not a numbered type`);
    const ok = await admin.from('pieces').insert({ piece_type_id: numbered.data!.id, color: 'Blue', number: '1' }).select('id').single();
    assert.equal(ok.error, null);
    const recolor = await admin.from('pieces').update({ color: 'Green' }).eq('id', ok.data!.id);
    assert.equal(recolor.error?.code, '22023');
  });

  test('create_piece_type numbered and counted; duplicate name refused', async () => {
    const hats = typeName('Hats');
    const numbered = await asStaff.rpc('create_piece_type', {
      p_name: `  ${hats} `, p_kind: 'numbered', p_colors: ['Black', 'White'], p_numbers: ['1', '2', '3'], p_stock: null,
    });
    assert.equal(numbered.error, null);
    const hatsRow = await typeRow(hats);
    assert.equal(hatsRow!.id, numbered.data);
    assert.equal(hatsRow!.kind, 'numbered');
    assert.deepEqual(hatsRow!.colors, ['Black', 'White']);
    assert.equal((await piecesOf(hats)).length, 6);

    const belts = typeName('Belts');
    const counted = await asStaff.rpc('create_piece_type', {
      p_name: belts, p_kind: 'counted', p_colors: ['Black', 'Brown'], p_numbers: [], p_stock: { Black: 12, Brown: 0 },
    });
    assert.equal(counted.error, null);
    const beltsRow = await typeRow(belts);
    assert.equal(beltsRow!.kind, 'counted');
    assert.deepEqual(beltsRow!.stock, { Black: 12, Brown: 0 });
    assert.deepEqual(await piecesOf(belts), []);

    const dup = await asStaff.rpc('create_piece_type', {
      p_name: hats.toLowerCase(), p_kind: 'counted', p_colors: ['Black'], p_numbers: [], p_stock: {},
    });
    assert.equal(dup.error?.code, '23505');
    assert.equal(dup.error!.message, `a piece type named ${hats.toLowerCase()} already exists`);

    const sashes = typeName('Sashes');
    for (const stock of [{ Red: -1 }, { Red: 1.5 }, { Green: 1 }, { Red: 'x' }]) {
      const bad = await asStaff.rpc('create_piece_type', {
        p_name: sashes, p_kind: 'counted', p_colors: ['Red'], p_numbers: [], p_stock: stock,
      });
      assert.equal(bad.error?.code, '22023', JSON.stringify(stock));
    }
    const badNumber = await asStaff.rpc('create_piece_type', {
      p_name: sashes, p_kind: 'numbered', p_colors: ['Red'], p_numbers: ['1', 'x2'], p_stock: {},
    });
    assert.equal(badNumber.error?.code, '22023');
    assert.equal(await typeRow(sashes), null);
  });

  test('add_piece_color fills every existing number', async () => {
    const name = typeName('Gloves');
    const created = await asStaff.rpc('create_piece_type', {
      p_name: name, p_kind: 'numbered', p_colors: ['White'], p_numbers: ['4', '8', '12'], p_stock: {},
    });
    assert.equal(created.error, null);
    const added = await asStaff.rpc('add_piece_color', { p_type: created.data, p_color: ' Black ' });
    assert.equal(added.error, null);
    assert.equal(added.data, 3);
    assert.deepEqual((await typeRow(name))!.colors, ['White', 'Black']);
    const black = (await piecesOf(name)).filter((p) => p.color === 'Black').map((p) => p.number).sort();
    assert.deepEqual(black, ['12', '4', '8']);

    const dup = await asStaff.rpc('add_piece_color', { p_type: created.data, p_color: 'black' });
    assert.equal(dup.error?.code, '22023');
    assert.equal(dup.error!.message, `black is already a ${name} color`);
    assert.deepEqual((await typeRow(name))!.colors, ['White', 'Black']);
  });

  test('add_piece_number refuses colors not in the type', async () => {
    const name = typeName('Capes');
    const created = await asStaff.rpc('create_piece_type', {
      p_name: name, p_kind: 'numbered', p_colors: ['Blue', 'Gold', 'Red'], p_numbers: [], p_stock: {},
    });
    assert.equal(created.error, null);
    const bad = await asStaff.rpc('add_piece_number', { p_type: created.data, p_number: '20', p_colors: ['Blue', 'Green'] });
    assert.equal(bad.error?.code, '22023');
    assert.equal(bad.error!.message, `Green is not a ${name} color`);
    assert.deepEqual(await piecesOf(name), []);

    const ok = await asStaff.rpc('add_piece_number', { p_type: created.data, p_number: '20', p_colors: ['Blue', 'Red'] });
    assert.equal(ok.error, null);
    assert.equal(ok.data, 2);
    const again = await asStaff.rpc('add_piece_number', { p_type: created.data, p_number: '020', p_colors: ['Blue', 'Gold'] });
    assert.equal(again.error, null);
    assert.equal(again.data, 1);
    assert.deepEqual((await piecesOf(name)).map((p) => p.color), ['Blue', 'Gold', 'Red']);
  });
});
