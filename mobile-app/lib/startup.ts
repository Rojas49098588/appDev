export type StartupAction = 'use-cache-then-refresh' | 'load-profile' | 'use-cache-offline' | 'signed-out';

// What AuthContext should do at launch, given what supabase.auth.getSession()
// returned and what's in the account cache.
export function startupAction(input: {
  sessionUserId: string | null;
  sessionErrorIsNetwork: boolean;
  cachedAccountId: string | null;
}): StartupAction {
  const { sessionUserId, sessionErrorIsNetwork, cachedAccountId } = input;
  if (sessionUserId) {
    return cachedAccountId === sessionUserId ? 'use-cache-then-refresh' : 'load-profile';
  }
  // getSession() tries to refresh an expired token; offline that fails with a
  // network error even though the stored refresh token is still good.
  if (sessionErrorIsNetwork && cachedAccountId) return 'use-cache-offline';
  return 'signed-out';
}
