-- Starting data. Re-runnable: existing rows are left alone
-- (except the invite code, which is reset to the seed value).

insert into public.settings (id, invite_code) values (1, '4F2K9')
on conflict (id) do update set invite_code = excluded.invite_code;

insert into public.combos (id, label, sub, components) values
  ('00000000-0000-4000-8000-000000000001', 'Combo 01', 'Field — home',
    array['White hat', 'Red bowtie', 'Red vest', 'White bibbers', 'Spats', 'White gloves']),
  ('00000000-0000-4000-8000-000000000002', 'Combo 02', 'Field — away', '{}'),
  ('00000000-0000-4000-8000-000000000003', 'Combo 03', 'Parade — formal', '{}'),
  ('00000000-0000-4000-8000-000000000004', 'Combo 04', 'Parade — summer', '{}'),
  ('00000000-0000-4000-8000-000000000005', 'Combo 05', 'Concert', '{}'),
  ('00000000-0000-4000-8000-000000000014', 'Combo 14', 'Halftime formation',
    array['White hat', 'Blue bowtie', 'Blue vest', 'White bibbers', 'Spats', 'White gloves'])
on conflict (id) do nothing;

insert into public.games (
  id, opponent, game_date, pre_game_combo_id, halftime_combo_id,
  after_game_instructions, instructions_updated_at, is_current
) values (
  '00000000-0000-4000-8000-0000000000a1',
  'Lincoln High',
  '2026-09-18',
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000014',
  'Leave all pieces draped over chairs to air out. Return bowties to the front table. Either take your white shirt home to wash, or leave it in the blue bin.',
  '2026-09-15T12:00:00Z',
  true
)
on conflict (id) do nothing;
