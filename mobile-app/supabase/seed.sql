-- Starting data. Re-runnable: existing rows are left alone, including an
-- invite code that was changed in the dashboard.

insert into public.settings (id, invite_code) values (1, '4F2K9')
on conflict (id) do nothing;

-- One current game is required: there is no screen to create games yet.
-- Staff pick its pregame/halftime combos in the app.
insert into public.games (id, opponent, game_date, is_current)
select '00000000-0000-4000-8000-0000000000a1', 'TBD', current_date, true
where not exists (select 1 from public.games where is_current)
on conflict (id) do nothing;
