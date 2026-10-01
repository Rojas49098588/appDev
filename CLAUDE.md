# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository state

The repository root contains standalone scratch files with no build system connecting them:

- `test.py` — standalone Python script, run directly with `python test.py`
- `test.java` — standalone Java file defining `public class test`; run with `javac test.java && java test`

## mobile-app/ (Expo React Native app)

`mobile-app/` is a separate Expo project (TypeScript, blank template) targeting Android and iOS. It runs on Expo SDK 57 (pinned to match the Expo Go app version available for testing on-device — see `mobile-app/AGENTS.md`, which points to versioned Expo docs that must be checked before writing Expo code, since the API surface has changed across versions).

Commands (run from `mobile-app/`):
- `npm start` — start the Expo dev server (Metro + QR code for Expo Go)
- `npm run android` — start with the Android target
- `npm run ios` — start with the iOS target (requires macOS to build; use Expo Go otherwise)
- `npm run web` — start the web target
- `npx expo-doctor` — validate the project setup
- `npm test` — unit tests for the pure `lib/` modules (Node's built-in test runner, `tests/*.test.ts`)
- `npm run test:rls` — security-rule tests against the Supabase project in `supabase/.env.local`
- `npm run db:apply` — apply `supabase/schema.sql` and `supabase/seed.sql` to that project

Entry point is `index.ts` → `App.tsx`. Config (app name, icons, platform-specific settings) lives in `app.json`.

### Data and backend

- Data (accounts, flags, combos and their photos, the current game) lives in Supabase. The schema is `mobile-app/supabase/schema.sql`; starting data is `mobile-app/supabase/seed.sql`.
- Row-level security (RLS) is the only access control: the app talks to Supabase directly with the anon key. After any schema change, `npm run test:rls` must pass.
- The contexts in `mobile-app/context/` render their `mustang.cache.*` AsyncStorage cache first, then fetch from Supabase and subscribe to Realtime. They refetch on reconnect and whenever the auth session is refreshed (`sessionVersion` in `AuthContext`), and skip fetching while there's no live session so the cache isn't overwritten with empty anon results.
- Secrets (service-role key, DB URL) live in `mobile-app/supabase/.env.local`; the app's config (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`) lives in `mobile-app/.env.local`. Both are git-ignored; templates are the matching `.env.example` files. Never put the service-role key in app code.
- Commands (from `mobile-app/`): `npm test` (pure `lib/` unit tests), `npm run test:rls` (security rules, live project), `npm run db:apply` (schema + seed).
- Email change is read-only in the app until custom SMTP is set up.
- Setup steps for a new Supabase project are in `HANDOFF.md` → Supabase setup.

### Combos and the Catalogue

- Tapping a tile on the staff Catalogue tab (`screens/CatalogueScreen.tsx`) opens `screens/ComboDetailScreen.tsx` (stack route `ComboDetail`, param `{ comboId }`): name + sub-label, enlarged photo, component chips, side-by-side "Set for pregame" / "Set for halftime" (via `useGame().setCombo`), and a Delete button.
- A combo currently assigned to pregame or halftime can't be deleted — member `GameDayScreen.tsx` looks combos up by id from `GameContext`, so deleting one in use would leave Game Day pointing at nothing.
