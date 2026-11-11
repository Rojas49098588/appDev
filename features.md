# Features

Planned and completed features for this repository.

## Planned

### Password reset (for the next build)

_Added 2026-11-10._ Users who forget their password currently have no way to reset it in the app. Add a "Forgot password?" option on Login so they can set a new one.

**Note:** Supabase's built-in email sender only delivers to the project's own team and is heavily rate-limited, so reset emails to real members need custom SMTP set up first (the same blocker that keeps email change read-only).

**Email sender decision (2026-11-11):** for the testing phase, send through a **Gmail account with an app password** (free, no domain, about 500 emails a day). **If the app is ever officially released, switch to the paid domain route:** buy a domain and send through Resend (or a similar service) from an address on that domain, so emails come from the app's own name and are less likely to land in spam. Switching only changes the Supabase SMTP settings, not the app.

## Done

_None yet._
