-- Sample data for the TEST project only (npm run db:apply:test).
-- Never applied to the live project. The RLS tests rely on combo ...0001.
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

-- Sample games for testers. Dates are relative to today (Chicago).
insert into public.games (id, sport, division, status, opponent, game_date, kickoff_time, call_time, no_call_time,
                          polo_colors, group_number, pre_game_combo_id, halftime_combo_id) values
  ('00000000-0000-4000-8000-0000000000b1', 'football', null, 'ready', 'Notre Dame', public.band_today() + 10, '11:00', '06:30', false,
    '[{"name": "Blue", "swatch": "#2C5AA0"}]', null,
    '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000014'),
  ('00000000-0000-4000-8000-0000000000b2', 'football', null, 'draft', 'Rice', public.band_today() + 17, null, null, false,
    '[]', null, null, null),
  ('00000000-0000-4000-8000-0000000000b3', 'volleyball', 'womens', 'ready', 'Tulsa', public.band_today() + 3, '18:30', '17:30', false,
    '[{"name": "Red", "swatch": "#C0392B"}]', 3, null, null),
  ('00000000-0000-4000-8000-0000000000b4', 'basketball', 'mens', 'ready', 'Houston', public.band_today() + 3, '19:00', null, true,
    '[{"name": "Blue", "swatch": "#2C5AA0"}]', 1, null, null)
on conflict (id) do nothing;
