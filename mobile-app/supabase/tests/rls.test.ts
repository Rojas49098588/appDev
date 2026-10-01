// Security-rule tests. Runs against the real Supabase project:
//   npm run test:rls
// Creates throwaway users (rls-*@mustangcloset.test) and deletes them afterwards.
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
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
const SEED_COMBO_14 = '00000000-0000-4000-8000-000000000014';
const CURRENT_GAME = '00000000-0000-4000-8000-0000000000a1';

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
    const forgedId = randomUUID();
    const insert = await asMember.from('profiles').insert({
      id: forgedId, email: 'forged@example.com', first_name: 'Forged', last_name: 'User',
      instrument: 'Tuba', role: 'Staff',
    });
    assert.notEqual(insert.error, null);
    const { data: forgedRow } = await admin.from('profiles').select('id').eq('id', forgedId);
    assert.equal(forgedRow?.length ?? 0, 0);
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

  test('can flag their own piece, and flagging it again updates the same row', async () => {
    const flag = { member_id: member.id, piece: 'Coats', color: 'Blue', size: '208', status: 'dirty', comment: '' };
    const first = await asMember.from('flags').upsert(flag, { onConflict: 'member_id,piece,color' }).select().single();
    assert.equal(first.error, null);
    const second = await asMember
      .from('flags')
      .upsert({ ...flag, status: 'repair', comment: 'torn' }, { onConflict: 'member_id,piece,color' })
      .select()
      .single();
    assert.equal(second.error, null);
    assert.equal(second.data?.id, first.data?.id);
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
    const { data: before } = await admin.from('games').select('halftime_combo_id').eq('id', CURRENT_GAME).single();
    const { data } = await asMember.from('games').update({ halftime_combo_id: SEED_COMBO_01 }).eq('id', CURRENT_GAME).select('id');
    assert.equal(data?.length ?? 0, 0);
    const { data: after } = await admin.from('games').select('halftime_combo_id').eq('id', CURRENT_GAME).single();
    assert.equal(after?.halftime_combo_id, before?.halftime_combo_id);
  });

  test('cannot call set_role', async () => {
    const { error } = await asMember.rpc('set_role', { target: member.id, new_role: 'Staff' });
    assert.notEqual(error, null);
  });

  test('cannot upload combo images', async () => {
    const { error } = await asMember.storage.from('combo-images').upload(`rls-${RUN}.txt`, new Blob(['x']), { contentType: 'text/plain' });
    assert.notEqual(error, null);
  });

  test('cannot delete combo images', async () => {
    const path = `rls-${RUN}-protected.txt`;
    const uploaded = await asStaff.storage.from('combo-images').upload(path, new Blob(['x']), { contentType: 'text/plain' });
    assert.equal(uploaded.error, null);
    // Member's delete must fail outright, or at minimum be a no-op (RLS filters
    // the row out before the delete can match it) — either way, the file must
    // still be there afterward, which is the assertion that actually matters.
    await asMember.storage.from('combo-images').remove([path]);
    const { data: listing, error: listError } = await admin.storage.from('combo-images').list('', { search: path });
    assert.equal(listError, null);
    assert.ok(listing?.some((f) => f.name === path));
    await admin.storage.from('combo-images').remove([path]);
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
    const { data: combo } = await asStaff.from('combos').insert({ label: `Slot ${RUN}` }).select().single();
    const { data: before } = await admin.from('games').select('pre_game_combo_id').eq('id', CURRENT_GAME).single();
    await asStaff.from('games').update({ pre_game_combo_id: combo!.id }).eq('id', CURRENT_GAME);
    await asStaff.from('combos').delete().eq('id', combo!.id);
    const { data: game } = await admin.from('games').select('pre_game_combo_id').eq('id', CURRENT_GAME).single();
    assert.equal(game?.pre_game_combo_id, null);
    await admin.from('games').update({ pre_game_combo_id: before?.pre_game_combo_id ?? SEED_COMBO_01 }).eq('id', CURRENT_GAME);
  });

  test('can set the halftime combo', async () => {
    const { data, error } = await asStaff.from('games').update({ halftime_combo_id: SEED_COMBO_01 }).eq('id', CURRENT_GAME).select().single();
    assert.equal(error, null);
    assert.equal(data?.halftime_combo_id, SEED_COMBO_01);
    await admin.from('games').update({ halftime_combo_id: SEED_COMBO_14 }).eq('id', CURRENT_GAME);
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

  test('cannot change their own role', async () => {
    const { error } = await asStaff.rpc('set_role', { target: staff.id, new_role: 'Member' });
    assert.notEqual(error, null);
  });

  test('can upload and delete combo images', async () => {
    const path = `rls-${RUN}.txt`;
    const upload = await asStaff.storage.from('combo-images').upload(path, new Blob(['x']), { contentType: 'text/plain' });
    assert.equal(upload.error, null);
    const remove = await asStaff.storage.from('combo-images').remove([path]);
    assert.equal(remove.error, null);
  });
});
