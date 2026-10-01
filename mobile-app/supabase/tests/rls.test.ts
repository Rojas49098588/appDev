// Security-rule tests. Runs against the real Supabase project:
//   npm run test:rls
// Creates throwaway users (rls-*@mustangcloset.test) and deletes them afterwards.
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

  test('can edit their own phone', async () => {
    const { error } = await asMember.from('profiles').update({ phone: '2145550100' }).eq('id', member.id);
    assert.equal(error, null);
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
  });

  test("cannot edit someone else's profile", async () => {
    const { data } = await asMember.from('profiles').update({ phone: '1' }).eq('id', staff.id).select('id');
    assert.equal(data?.length ?? 0, 0);
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
    const { data } = await asMember.from('games').update({ halftime_combo_id: SEED_COMBO_01 }).eq('id', CURRENT_GAME).select('id');
    assert.equal(data?.length ?? 0, 0);
  });

  test('cannot call set_role', async () => {
    const { error } = await asMember.rpc('set_role', { target: member.id, new_role: 'Staff' });
    assert.notEqual(error, null);
  });

  test('cannot upload combo images', async () => {
    const { error } = await asMember.storage.from('combo-images').upload(`rls-${RUN}.txt`, new Blob(['x']), { contentType: 'text/plain' });
    assert.notEqual(error, null);
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
