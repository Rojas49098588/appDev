# Archive Members — Design

**Date:** 2026-10-07
**Status:** Approved in conversation
**App:** Mustang Closet (`mobile-app/`, Expo SDK 57)
**Depends on:** `2026-10-07-uniform-size-filter-design.md` (uniform size columns)

## Goal

Let staff archive a member who leaves the band. Archiving takes a snapshot of the
member's info, stops them logging in, and unassigns their uniform sizes. Staff
can restore an archived member later.

## Decisions

| Topic | Decision |
|---|---|
| Who can be archived | Members only. Demote staff first. Staff can't archive themselves. |
| Restore | Yes. Login works again with the same credentials. Sizes and flags stay empty. Snapshots stay as history. |
| Snapshot | A frozen copy: name, email, instrument, phone, shoe size, height, weight, uniform sizes, and open flags with comments. A new snapshot is written every time a member is archived. |
| Open flags | Copied into the snapshot, then deleted. Restoring doesn't bring them back. |
| Blocking login | `auth.users.banned_until = now() + 100 years` (Supabase Auth can't parse `'infinity'`) plus deleting the user's `auth.sessions` (kills refresh tokens). RLS also refuses member writes from an archived account during the ≤1 h an old access token still works. |
| Where staff archive | **Archive member** button on Member Profile (real Member accounts only), with a confirmation. Blocked offline. |
| Where staff see archives | A separate **Archived members** screen linked from staff Home. A read-only snapshot detail screen offers **Restore** while the member is still archived. |

## Database (`supabase/schema.sql`)

- `profiles.archived_at timestamptz` (null = active).
- `member_archives`: `id uuid pk`, `member_id uuid references profiles on delete cascade`,
  `snapshot jsonb not null`, `archived_at timestamptz default now()`,
  `archived_by uuid`, `archived_by_name text`, `restored_at timestamptz`,
  `restored_by_name text`. RLS: staff select only. No insert/update/delete policies;
  writes happen only inside the functions below.
- `archive_member(target uuid)`: `security definer`. Staff only; target must exist, be
  a Member, not be the caller, and not already be archived. In one transaction it
  inserts the snapshot, deletes the member's flags, clears the four size columns,
  sets `archived_at`, bans the auth user and deletes their sessions.
- `restore_member(target uuid)`: `security definer`. Staff only; target must be
  archived. Clears `archived_at` and `banned_until`, and stamps `restored_at` /
  `restored_by_name` on the latest snapshot.
- `guard_profile_update` blocks changes to `archived_at` outside these functions,
  using an `app.allow_archive_change` setting like the role guard.
- `is_archived()` helper. `profiles_update_own`, `flags_insert_own` and
  `flags_update_own` additionally require `not public.is_archived()`.

**Risk (checked 2026-10-07, cleared):** the functions run as `postgres`, which can
update `auth.users.banned_until` and delete from `auth.sessions`, so no Edge Function
is needed.

## App

- `Account.archivedAt: string | null`. The staff `accounts` list and the Members
  roster exclude archived accounts. The roster still matches mock names against
  archived accounts, so an archived member doesn't reappear as a mock row.
- `AuthContext`: if the signed-in user's own profile has `archivedAt` set (on load
  or via Realtime), sign out locally and alert "This account has been archived.
  Talk to a uniform manager." `friendlyError` maps Supabase's banned-user error to
  the same message. Adds `archiveMember(id)` and `restoreMember(id)`.
- `MemberProfileScreen`: an **Archive member** button with a confirmation explaining
  the effects. On success, go back to the Members list.
- `ArchivedMembersScreen` (new stack route `ArchivedMembers`): fetches
  `member_archives` newest first whenever it gains focus. Rows show name, section,
  "Archived <date> by <name>" and "Restored <date>" if restored. Offline shows
  "Connect to view archived members."
- `ArchivedMemberScreen` (new stack route `ArchivedMember`, param `{ archiveId }`):
  a read-only snapshot. **Restore** shows only if the member is still archived and
  this is their latest snapshot.
- Staff Home links to Archived members.

## Tests

- RLS: members can't call either function or read `member_archives`; staff can't
  archive staff or themselves; archiving creates the snapshot, clears flags and
  sizes, and blocks `signInWithPassword`; an archived member's old token can't
  write; restore lets them sign in again.
- Unit: snapshot row mapper and its validator; `profileToAccount` maps
  `archivedAt`; `friendlyError` maps the banned error.
