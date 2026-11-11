export const OFFLINE_MESSAGE = "Can't reach the server. Check your connection and try again.";
// Shown when someone tries to change something while offline.
export const OFFLINE_ALERT = { title: "You're offline", message: 'Connect to the internet to make changes.' };
export const ARCHIVED_MESSAGE = 'This account has been archived. Talk to a uniform manager.';
export const RESET_CODE_INVALID_MESSAGE =
  'That code is wrong or has expired. Check the email, or tap "Send a new code".';
export const TOO_MANY_REQUESTS_MESSAGE = 'Too many tries. Wait a minute, then try again.';

// Turns Supabase/network errors into messages suitable for an Alert.
export function friendlyError(error: unknown): string {
  const e = (typeof error === 'object' && error !== null ? error : {}) as Record<string, unknown>;
  const message = typeof e.message === 'string' ? e.message : '';
  const code = typeof e.code === 'string' ? e.code : '';
  const name = typeof e.name === 'string' ? e.name : '';

  if (name === 'AuthRetryableFetchError' || /network request failed|failed to fetch|fetch failed/i.test(message)) {
    return OFFLINE_MESSAGE;
  }
  // Archiving bans the auth user, so Supabase refuses its sign-in.
  if (code === 'user_banned' || /user is banned/i.test(message)) return ARCHIVED_MESSAGE;
  if (/invalid login credentials/i.test(message)) return 'Incorrect email or password.';
  // Password reset: wrong/expired code, too many emails or tries, reusing the old password.
  if (code === 'otp_expired' || /token has expired or is invalid/i.test(message)) return RESET_CODE_INVALID_MESSAGE;
  if (/rate_limit|over_.*_limit/i.test(code) || /rate limit|only request this after/i.test(message)) {
    return TOO_MANY_REQUESTS_MESSAGE;
  }
  if (code === 'same_password' || /should be different from the old password/i.test(message)) {
    return 'Your new password must be different from your old one.';
  }
  if (/already (been )?registered/i.test(message)) return 'An account with this email already exists.';
  if (/database error saving new user/i.test(message)) {
    return 'That invite code is no longer valid. Go back and enter the current code.';
  }
  if (code === '42501' || code === 'PGRST116' || /row-level security|permission denied/i.test(message)) {
    return "You don't have permission to do that.";
  }
  if (code === '23505' && /already belongs to/i.test(message)) return message;
  if (code === '23505' && /flags_one_open_per_piece/.test(message)) {
    return 'This member already has an open flag on that color.';
  }
  if (code === '23505' && /polo_colors/.test(message)) return 'That color is already in the list.';
  return message || 'Something went wrong. Please try again.';
}
