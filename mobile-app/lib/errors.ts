export const OFFLINE_MESSAGE = "Can't reach the server. Check your connection and try again.";

// Turns Supabase/network errors into messages suitable for an Alert.
export function friendlyError(error: unknown): string {
  const e = (typeof error === 'object' && error !== null ? error : {}) as Record<string, unknown>;
  const message = typeof e.message === 'string' ? e.message : '';
  const code = typeof e.code === 'string' ? e.code : '';
  const name = typeof e.name === 'string' ? e.name : '';

  if (name === 'AuthRetryableFetchError' || /network request failed|failed to fetch|fetch failed/i.test(message)) {
    return OFFLINE_MESSAGE;
  }
  if (/invalid login credentials/i.test(message)) return 'Incorrect email or password.';
  if (/already (been )?registered/i.test(message)) return 'An account with this email already exists.';
  if (/database error saving new user/i.test(message)) {
    return 'That invite code is no longer valid. Go back and enter the current code.';
  }
  if (code === '42501' || code === 'PGRST116' || /row-level security|permission denied/i.test(message)) {
    return "You don't have permission to do that.";
  }
  return message || 'Something went wrong. Please try again.';
}
