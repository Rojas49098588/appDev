-- Starting data. Re-runnable: existing rows are left alone, including an
-- invite code that was changed in the dashboard.

insert into public.settings (id, invite_code) values (1, '4F2K9')
on conflict (id) do nothing;
