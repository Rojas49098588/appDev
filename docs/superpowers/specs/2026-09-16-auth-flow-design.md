# Auth flow (Login / Invite code / Sign up) — design spec

Status: approved, pending implementation plan
Source mockups: `mobile-app/mockups/loginScreen.png`, `inviteCodeScreen.png`, `newSignup.png`
Source doc: `mobile-app/mockups/formation-design-handoff.md` ("Screens included" → Auth flow, "Accounts, roles, and archiving")

## Goal

Replace the app's current single-screen entry point (Sign Up, with a modal-gated Staff access code) with a three-screen flow: **Login → Invite code → Sign up**, matching the new mockups. Make Login functionally real within this app's existing scope: a Sign Up now creates a locally-persisted account, Login checks credentials against it, and a successful Sign Up or Login persists the session so relaunching the app returns straight to the signed-in tabs instead of always restarting at square one (today's actual behavior, which this replaces).

## Non-goals (explicitly out of scope for this pass)

- A real backend or network auth — everything here is local-only (`AsyncStorage`), consistent with the rest of this app (no server exists anywhere in this codebase).
- Multi-account support — one saved account per device, matching the app's existing single hardcoded member identity (`MY_MEMBER_NAME`). A new Sign Up overwrites whatever account was saved before.
- Password security (hashing, strength rules, rate-limiting). The invite/staff code gates are explicitly documented as "a lower bar than real access control... a first pass, not the final security model" — the same framing applies here. Password is stored in plain text in local `AsyncStorage`, same trust boundary as the flags data already stored there.
- "Forgot password" or account recovery.
- An invite-code or staff-code *management* screen for staff to rotate the codes — both stay hardcoded constants, same pattern as today's `STAFF_ACCESS_CODE`.
- Email format validation or any required-field enforcement beyond what already exists on Sign Up today (the current form has no validation on name fields either — email/password follow the same lax convention).

## Architecture

### New `AuthContext`, mirroring the existing `FlagsContext` pattern

The only additional runtime-mutable state this feature needs — a saved account and the current session — is lifted into a React Context, following the exact shape `context/FlagsContext.tsx` already established (Context + `AsyncStorage` + a `use*` hook), so the two contexts read as one consistent pattern rather than two different ones.

`context/AuthContext.tsx` exports `AuthProvider` and `useAuth()`:

```ts
export type Account = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  instrument: string;
  role: Role;
};

type AuthContextValue = {
  session: UserParams | null; // null until a session is loaded/restored, or after Log Out
  isLoading: boolean;         // true until the initial AsyncStorage read completes
  signUp: (account: Account) => Promise<void>;
  logIn: (email: string, password: string) => Promise<Account | null>;
  logOut: () => Promise<void>;
};
```

- Storage keys: `"formation.account.v1"` (the one saved account, including credentials) and `"formation.session.v1"` (the current session, `UserParams` shape — no credentials).
- On mount, `AuthProvider` asynchronously loads both keys. Each parsed value runs through a runtime shape validator before being trusted (same defensive pattern `FlagsContext`'s `isFlag`/`parseFlags` already uses for its own AsyncStorage blob — a corrupted value is discarded, not trusted). `isLoading` flips to `false` once both reads (or failures) resolve.
- `signUp(account)`: writes `account` to `"formation.account.v1"`, derives a `UserParams` from it (drops `email`/`password`), writes that to `"formation.session.v1"`, and updates in-memory `session` — i.e. signing up also logs you in, same as today's behavior of going straight to the tabs after submitting.
- `logIn(email, password)`: reads the in-memory saved account; if `email.trim().toLowerCase() === savedAccount.email.trim().toLowerCase()` and `password === savedAccount.password` (exact match, no normalization), persists+sets the session and resolves with the `Account`; otherwise resolves `null` (no session change). Trim/lowercase only applies to email, not password.
- `logOut()`: clears `"formation.session.v1"` and sets `session` to `null`. The saved account is untouched, so a subsequent Login still works.
- AsyncStorage read/write failures: same treatment as `FlagsContext` — try/catch, swallow, `console.warn`, fall back to `null`/no-op. This is a prototype with no server of record to reconcile against.

### `App.tsx` boot sequence

`App.tsx` already gates rendering on `fontsLoaded`. This gate extends to also wait on `AuthContext`'s `isLoading`:

```tsx
if (!fontsLoaded || isLoading) {
  return null; // keeps the splash screen up
}
```

Once both are ready, the root `Stack.Navigator` mounts once, with its initial route and params chosen from the restored session:

```tsx
const initialRouteName = !session ? 'Login' : session.role === 'Staff' ? 'MainTabs' : 'MemberTabs';
```

`MainTabs` and `MemberTabs` screens already require `UserParams` route params; when mounting directly into one of them from a restored session, that screen's `initialParams` is set from `session`. This is the same `UserParams` shape already threaded through the app today — no new prop plumbing inside `MainTabs`/`MemberTabs`/the screens they render.

`AuthProvider` wraps the app the same place `FlagsProvider` already does (inside `SafeAreaProvider`, outside `NavigationContainer`), nested in either order relative to `FlagsProvider` since the two are independent.

### Sign Up submit flow

`SignUpScreen`'s inline Staff-code field replaces today's post-submit modal: the field is part of the form (visible only when Staff is selected, exactly matching the new mockup), and `handleSubmit` validates it inline before proceeding — no separate confirm step. On success, it calls `useAuth().signUp(account)` (built from the form fields) instead of directly navigating; the screen then reads the resulting `session` from context and resets navigation to `MainTabs`/`MemberTabs` with it, same `navigation.reset` call pattern used today.

### Log Out

Both `screens/member/MemberAccountScreen.tsx` and `screens/ProfileScreen.tsx` change their `handleLogOut` from resetting to `SignUp` to: call `useAuth().logOut()`, then `navigation.reset({ index: 0, routes: [{ name: 'Login' }] })`.

## Data model

No changes to `constants/` seed data. `Role` and `UserParams` (in `navigation/types.ts`) are unchanged and reused as-is for the session shape; `Account` (defined in `AuthContext`, not `navigation/types.ts`, since it's storage-only and never a route param) is `UserParams` plus `email`/`password`.

Hardcoded gate constants (same file/pattern as today's `STAFF_ACCESS_CODE` in `SignUpScreen.tsx`):

```ts
// screens/InviteCodeScreen.tsx
const INVITE_CODE = '4F2K9'; // from the mockup; rotates yearly per the design doc, not implemented this pass
```

`STAFF_ACCESS_CODE = '1234'` stays where it is, just checked inline in the form instead of in a modal handler.

## Navigation types

```ts
// navigation/types.ts
export type RootStackParamList = {
  Login: undefined;
  InviteCode: undefined;
  SignUp: undefined;
  MainTabs: UserParams;
  MemberTabs: UserParams;
  Profile: UserParams;
  MemberAccount: UserParams;
  FlagItem: { piece: string; color: string; size: string };
};
```

`Login` is the new initial route. `InviteCode` and `SignUp` are pushed (not reset), so their back chevrons work via `navigation.goBack()`/`navigation.canGoBack()`, same convention `SignUpScreen` already uses.

## Screens

All three reuse the existing design system (`constants/colors.ts`, `constants/fonts.ts`, `components/TapeGutter.tsx`, the segmented-control and footer-button patterns already established by `SignUpScreen`) — no new visual language, matching how every other screen in this app has been built off the same tokens.

- **`LoginScreen`** (new, `screens/LoginScreen.tsx`) — no back button (it's the stack root). Wordmark header ("Formation" / "Central High Band"), Email field, Password field with a "Show" link toggling `secureTextEntry`, a solid "Log in" button, a divider with "or", and "New to Formation? Create an account" (navigates to `InviteCode`). On submit, calls `logIn`; on failure shows `Alert.alert('Error', 'Incorrect email or password.')`, mirroring the existing wrong-access-code alert copy/pattern. On success, resets to `MainTabs`/`MemberTabs` per the returned account's role.
- **`InviteCodeScreen`** (new, `screens/InviteCodeScreen.tsx`) — back chevron to `Login`. "Join Formation" title, "Enter the invite code from your band director" subtitle, single code field, solid "Continue" button, static "Don't have a code? Contact your band director" hint (non-interactive — no support flow exists). On submit, checks against `INVITE_CODE`; wrong code shows the same `Alert.alert('Error', ...)` pattern; correct code navigates (push) to `SignUp`.
- **`SignUpScreen`** (modified) — gains **Email** and **Password** fields (placed above the existing First/Last name row; not present in the mockup screenshot, added because `Login` needs something to check credentials against). The Staff-access-code `Modal` is removed; a **Staff code** field appears inline directly below the Role segmented control when Staff is selected, matching the new mockup exactly. `handleSubmit` validates the Staff code inline (if applicable) and, on success, calls `signUp()` from `AuthContext` instead of navigating directly.

## Error handling / edge cases

- Wrong email/password on Login, or wrong invite code, or wrong staff code: all use the existing `Alert.alert('Error', ...)` pattern already established for the wrong Staff code today — no new UI pattern introduced.
- No saved account yet (fresh install, or after the account key fails to load) and the user taps Login: same "Incorrect email or password" alert — no special-cased "no account exists" message, since distinguishing the two would leak whether an account exists, and the design doc frames these gates as low-stakes rather than needing careful UX around that distinction.
- Empty email/password fields are allowed through to `signUp`/`logIn` (matching the existing lack of validation on name fields) — an account can be "created" and "logged into" with blank credentials; this is acceptable for a prototype with no real security model.
- `AsyncStorage` read/write failures: try/catch, swallow, `console.warn`, fall back to no session (same treatment `FlagsContext` already uses).
- A corrupted/malformed stored account or session blob (shape validation fails): treated as if absent — `session`/saved account stay `null`, user lands on `Login` and must sign up again.

## Testing / acceptance criteria

Manual, on-device (no automated test suite exists in this project):

1. Fresh install (or clear app storage) → app opens on **Login**, not Sign Up.
2. Tap "Create an account" → **Invite code** screen. Wrong code → error alert, stays on screen. Correct code (`4F2K9`) → **Sign up** screen.
3. Fill out Sign up (including Email/Password) as Member, submit → lands on Game Day (Member tabs), same as today's behavior.
4. Log out (avatar → Member Account → Log Out) → returns to **Login** (not Sign Up).
5. On Login, enter the same email/password → lands back on Game Day directly (no need to re-fill Sign Up).
6. On Login, enter a wrong password → error alert, stays on Login.
7. Force-close and reopen the app (not Fast Refresh) while still logged in → app opens directly to Game Day/Home (whichever role), skipping Login entirely — this is the actual new behavior this feature adds, distinct from every prior feature in this app which always restarted at Sign Up.
8. Log out, then sign up again as **Staff** with the correct Staff code entered inline (no modal appears) → lands on Home (Staff tabs). Force-close/reopen → returns to Home directly.
9. Log out again, sign up as Staff with the *wrong* staff code → inline error alert, stays on Sign Up, no account is created/overwritten.
10. `npx tsc --noEmit` and `npx expo-doctor` both clean, as with every prior change in this project.
