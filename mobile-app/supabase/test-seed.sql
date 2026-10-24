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
