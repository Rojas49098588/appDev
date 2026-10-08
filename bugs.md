# Bugs

Tracked issues for this repository.

> **Reminder:** Every open bug has an `Opened` date. Anything open **more than 3 days** is overdue. Fix it, or write down why it's waiting. When a bug is fixed, move it to **Fixed** with the date and commit. Claude checks this list at the start of each session (see `CLAUDE.md`).

## Open

- **Supabase backend not yet verified on a device.** _Opened 2026-09-30._ Everything since the backend move has been checked with `tsc`, unit tests and RLS tests only. The on-device checklist (plan `docs/superpowers/plans/2026-09-29-supabase-backend.md`, Task 9 Step 3) is still pending.

## Fixed

### Member View (2026-09-14 to 09-15)

- **Sections showed only one flag per member.** Lookups used `flags.find(...)`, which broke once members could flag several pieces. Now uses `some`/`filter` and shows one line per flag. (`91ee495`)
- **Home inventory preview never updated.** It was a constant computed when the module loaded. Now derived from live `useFlags()` data. (`91ee495`)
- **Seed flags never saved on first launch.** `FlagsContext` had no "nothing saved yet" branch. Now writes the seed when storage is empty. (`91ee495`)
- **Corrupt saved data or a missing combo could crash the app.** Saved flags are now validated before use (falling back to the seed), and Game Day skips a combo it can't find instead of throwing. (`e639344`)
- **Stale closure in `addFlag`/`updateFlag`.** They could build on an old flag list. Now use functional state updates and `useCallback`. (`e639344`)
- **Flags for two colors of the same piece overwrote each other.** The flag ID was `member-piece`. It's now `member-piece-color`. (`1055be3`)

### Auth flow (2026-09-16 to 09-17)

- **Blank screen between the splash and the app.** The splash hid as soon as fonts loaded, before auth finished loading. It now hides only once the navigator has content. (`e06173b`)
- **Users could get locked out.** A damaged saved account next to a valid saved session opened the app signed in, but logging back in after logout was impossible. A session is now trusted only when its account also loads. (`3b25337`)
- **Flag banner always used the dirty color.** My Inventory's "You flagged this" banner is now rust for repair and wash for dirty. (`4364d04`)

### Keyboard, navigation and assets (2026-09-23)

- **Keyboard covered input fields.** `scrollResponderScrollNativeHandleToKeyboard` mixes ScrollView-relative and screen-absolute positions, so it falls short on any screen with a header. Replaced by `hooks/useScrollToInput.ts`, which measures both the field and the keyboard with `measureInWindow`. (`b143711`)
- **Number and phone keyboards couldn't be closed.** Added `components/KeyboardDoneBar.tsx`. (`b143711`)
- **Old Sections filters combined with new ones.** React Navigation merges params on a mounted tab. Every navigate to Sections now clears the filters it doesn't set. (`b143711`)
- **Logo images wouldn't bundle.** They were `.jpe`, which Metro doesn't recognize. Renamed to `.jpg`, and the icon was re-encoded as a real PNG because expo-doctor rejects a renamed JPEG. (`b143711`)
- **Dirty flags shown in rust on Home.** Home's inventory preview now uses wash for dirty. (`b143711`)

### Supabase backend (2026-09-29 to 09-30)

- **Supabase URL had `/rest/v1/` on the end** in both `.env.local` files. Removed.
- **Email-change RLS test failed.** Supabase's built-in mailer won't send to test addresses. Email is now read-only in Member Account, and the test is skipped with a note until custom SMTP is set up. (`d0eec07`)
- **Critical: members could rename or delete staff profiles** through `staff_directory`. Revoked write access, made the view non-updatable, and expanded RLS tests to 34. (`6a9c9d5`)
- **Cache wiped after reconnecting with an expired token.** Contexts fetched as anon and committed empty results. They now skip fetching without a session and reload when the token refreshes. (`f46848e`)
- **Realtime stopped after a role change.** `channel()` returned the old channel with the same topic while it was still closing. Each subscription now gets a unique topic. (`f46848e`)
- **Splash held about 25 seconds on an offline launch.** The cached account now renders immediately and the session is resolved in the background. (`f46848e`)
- **Login or Sign Up could half-succeed.** If auth worked but loading the profile failed, the app reported failure but stayed signed in. It now signs out locally and shows a clear message. (`f46848e`)
- **EAS build crashed when Supabase settings were missing.** It now shows a setup message instead. (`dc3a1be`)
- **Login and Sign Up could be submitted twice.** Buttons are disabled while a request is in flight. (`8709cb8`)
- **`db:apply` reset a changed invite code, and RLS tests changed the live game.** The seed now keeps the existing code, and tests restore the game's prior combo slots and clean up storage in `finally` blocks. (`1d8f034`)

### Uniform sizes and archiving (2026-10-07)

- **Archived members got "Database error querying schema" instead of "banned" at login.** Found by the new RLS test, which expected `signInWithPassword` to fail with a banned error. `archive_member()` set `auth.users.banned_until = 'infinity'`, and Supabase Auth can't parse an infinite timestamp, so every sign-in for that user failed with a generic schema error. Now bans for 100 years (what Supabase's own admin API does). (`0ee9b9f`)
- **Logout race after an offline launch.** _Opened 2026-09-30, fixed 2026-10-07._ Launch offline with an expired token, log out from the staff Profile, and log back in within about 25 seconds: the app signed you out again. Evidence: `supabase.auth.signOut()` first awaits `initializePromise` (auth-js `GoTrueClient.js`), which is still retrying the token refresh offline, but `ProfileScreen` called `logOut()` without awaiting it and jumped straight to Login, so the queued sign-out and the startup check finished after the new login and wiped it. `MemberAccountScreen` already awaited it. Fix: `await logOut()` before navigating. (`ed7d525`)
- **Staff Profile edits didn't save.** _Opened 2026-09-30, fixed 2026-10-07._ On the staff Profile screen, email, phone, height and weight always started blank, and Update changed nothing. Evidence: `ProfileScreen` built its form state from route params, which only carry name, instrument and role, and the Update button only toggled edit mode without calling `updateAccount`. `MemberAccountScreen` (the working member version) reads from `useAuth().account` and saves through `updateAccount`. Fix: same pattern, with the offline guard, phone validation and read-only email. Added an RLS test that staff can edit their own profile. (`ed7d525`)
- **Staff couldn't save a member's uniform sizes.** _Found and fixed 2026-10-07._ On Member Profile, typing sizes and tapping Save sizes looked fine, but the sizes were blank after reopening the profile. Evidence: the database had no sizes on any real profile, so the save never reached the server, while the `set_uniform_sizes` RLS tests passed. The `ScrollView` had no `keyboardShouldPersistTaps`, so with the number pad open the tap on Save only closed the keyboard (Login and Flag Item already set it). Fix: `keyboardShouldPersistTaps="handled"`. Verified on device: Member Account now has Coats 208, Bibbers 222. (`0ee9b9f`)
