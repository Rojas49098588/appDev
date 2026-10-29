-- Starting data. Re-runnable: existing rows are left alone, including an
-- invite code that was changed in the dashboard.

insert into public.settings (id, invite_code) values (1, '4F2K9')
on conflict (id) do nothing;

insert into public.polo_colors (name, swatch, sort_order) values
  ('Blue', '#2C5AA0', 1),
  ('Red', '#C0392B', 2)
on conflict (name) do nothing;
