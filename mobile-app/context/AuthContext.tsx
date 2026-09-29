import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { isAuthRetryableFetchError } from '@supabase/supabase-js';
import type { Role, UserParams } from '../navigation/types';
import type { Account, ShoeSize } from '../lib/models';
import type { ProfileRow } from '../lib/rows';
import { accountUpdatesToProfile, profileToAccount, type AccountUpdates } from '../lib/mappers';
import { isAccount, isAccountList } from '../lib/validators';
import { removeById, upsertById } from '../lib/realtime';
import { CACHE_KEYS, clearAllCaches, clearLegacyKeys, readCache, writeCache } from '../lib/cacheStorage';
import { startupAction } from '../lib/startup';
import { supabase } from '../lib/supabase';
import { useOnReconnect } from '../hooks/useConnection';

export type { Account, ShoeSize };

export type SignUpInput = {
  email: string;
  password: string;
  inviteCode: string;
  firstName: string;
  lastName: string;
  instrument: string;
  height: { feet: string; inches: string };
  weight: string;
};

type AuthContextValue = {
  session: UserParams | null;
  account: Account | null;
  accounts: Account[];
  isLoading: boolean;
  checkInviteCode: (code: string) => Promise<boolean>;
  signUp: (input: SignUpInput) => Promise<Account>;
  logIn: (email: string, password: string) => Promise<Account>;
  logOut: () => Promise<void>;
  updateAccount: (updates: AccountUpdates) => Promise<void>;
  setAccountRole: (id: string, role: Role) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<boolean>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const normalizeEmail = (email: string) => email.trim().toLowerCase();

function toSession(account: Account): UserParams {
  const { firstName, lastName, instrument, role } = account;
  return { firstName, lastName, instrument, role };
}

function warn(what: string) {
  return (error: unknown) => console.warn(`AuthContext: ${what}`, error);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<Account | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // Mirrors for Realtime callbacks, which would otherwise see stale state.
  const accountRef = useRef<Account | null>(null);
  const accountsRef = useRef<Account[]>([]);

  const commitAccount = useCallback((next: Account) => {
    accountRef.current = next;
    setAccount(next);
    writeCache(CACHE_KEYS.account, next).catch(warn('failed to cache account'));
  }, []);

  const commitAccounts = useCallback((next: Account[]) => {
    accountsRef.current = next;
    setAccounts(next);
    writeCache(CACHE_KEYS.accounts, next).catch(warn('failed to cache accounts'));
  }, []);

  const clearLocalState = useCallback(async () => {
    accountRef.current = null;
    setAccount(null);
    accountsRef.current = [];
    setAccounts([]);
    await clearAllCaches().catch(warn('failed to clear caches'));
  }, []);

  const loadProfile = useCallback(
    async (userId: string): Promise<Account> => {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
      if (error) throw error;
      const next = profileToAccount(data as ProfileRow);
      commitAccount(next);
      return next;
    },
    [commitAccount]
  );

  const loadAccounts = useCallback(async () => {
    const { data, error } = await supabase.from('profiles').select('*').order('last_name');
    if (error) throw error;
    commitAccounts((data as ProfileRow[]).map(profileToAccount));
  }, [commitAccounts]);

  // Launch: show cached data immediately where possible, then refresh.
  useEffect(() => {
    let isMounted = true;
    (async () => {
      await clearLegacyKeys().catch(warn('failed to clear legacy keys'));
      const cachedAccount = await readCache(CACHE_KEYS.account, isAccount);
      const cachedAccounts = await readCache(CACHE_KEYS.accounts, isAccountList);
      const { data, error } = await supabase.auth.getSession();
      if (!isMounted) return;

      const sessionUserId = data.session?.user.id ?? null;
      const action = startupAction({
        sessionUserId,
        sessionErrorIsNetwork: !!error && isAuthRetryableFetchError(error),
        cachedAccountId: cachedAccount?.data.id ?? null,
      });

      const showCache = () => {
        accountRef.current = cachedAccount!.data;
        setAccount(cachedAccount!.data);
        if (cachedAccounts) {
          accountsRef.current = cachedAccounts.data;
          setAccounts(cachedAccounts.data);
        }
      };

      if (action === 'use-cache-then-refresh') {
        showCache();
        loadProfile(sessionUserId!).catch(warn('background profile refresh failed'));
      } else if (action === 'use-cache-offline') {
        showCache();
      } else if (action === 'load-profile') {
        try {
          await loadProfile(sessionUserId!);
        } catch (loadError) {
          // Signed in but no profile we can load (e.g. first launch offline):
          // fall back to Login rather than showing an app with no user.
          warn('could not load profile at launch')(loadError);
          await supabase.auth.signOut({ scope: 'local' }).catch(warn('signOut failed'));
          await clearLocalState();
        }
      } else {
        await clearLocalState();
      }
      if (isMounted) setIsLoading(false);
    })();
    return () => {
      isMounted = false;
    };
  }, [loadProfile, clearLocalState]);

  // Session ended elsewhere (e.g. refresh token revoked).
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        void clearLocalState();
      }
    });
    return () => data.subscription.unsubscribe();
  }, [clearLocalState]);

  const userId = account?.id ?? null;
  const role = account?.role ?? null;

  // Staff see everyone; members only ever see themselves.
  useEffect(() => {
    if (!userId) return;
    if (role !== 'Staff') {
      if (accountsRef.current.length > 0) commitAccounts([]);
      return;
    }
    loadAccounts().catch(warn('failed to load accounts'));
  }, [userId, role, loadAccounts, commitAccounts]);

  // Live profile changes: your own edits from another device, promotions,
  // and (for staff) everyone else's changes.
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`profiles:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, (payload) => {
        if (payload.eventType === 'DELETE') {
          const id = (payload.old as Partial<ProfileRow>).id;
          if (id) commitAccounts(removeById(accountsRef.current, id));
          return;
        }
        const changed = profileToAccount(payload.new as ProfileRow);
        if (changed.id === accountRef.current?.id) commitAccount(changed);
        if (accountRef.current?.role === 'Staff') commitAccounts(upsertById(accountsRef.current, changed));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, commitAccount, commitAccounts]);

  useOnReconnect(() => {
    const current = accountRef.current;
    if (!current) return;
    loadProfile(current.id).catch(warn('refresh on reconnect failed'));
    if (current.role === 'Staff') loadAccounts().catch(warn('accounts refresh on reconnect failed'));
  });

  const checkInviteCode = useCallback(async (code: string) => {
    const { data, error } = await supabase.rpc('check_invite_code', { code });
    if (error) throw error;
    return data === true;
  }, []);

  const signUp = useCallback(
    async (input: SignUpInput): Promise<Account> => {
      const { data, error } = await supabase.auth.signUp({
        email: normalizeEmail(input.email),
        password: input.password,
        options: {
          data: {
            invite_code: input.inviteCode,
            first_name: input.firstName.trim(),
            last_name: input.lastName.trim(),
            instrument: input.instrument,
            height_feet: input.height.feet,
            height_inches: input.height.inches,
            weight: input.weight,
          },
        },
      });
      if (error) throw error;
      if (!data.user || !data.session) {
        throw new Error('Sign-up did not start a session. Is "Confirm email" turned off in Supabase?');
      }
      return loadProfile(data.user.id);
    },
    [loadProfile]
  );

  const logIn = useCallback(
    async (email: string, password: string): Promise<Account> => {
      const { data, error } = await supabase.auth.signInWithPassword({ email: normalizeEmail(email), password });
      if (error) throw error;
      return loadProfile(data.user.id);
    },
    [loadProfile]
  );

  const logOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) warn('signOut failed')(error);
    await clearLocalState();
  }, [clearLocalState]);

  const updateAccount = useCallback(
    async (updates: AccountUpdates) => {
      const current = accountRef.current;
      if (!current) throw new Error('Not signed in.');
      if (updates.email !== undefined && normalizeEmail(updates.email) !== current.email) {
        const { error } = await supabase.auth.updateUser({ email: normalizeEmail(updates.email) });
        if (error) throw error;
      }
      const patch = accountUpdatesToProfile(updates);
      if (Object.keys(patch).length === 0) {
        await loadProfile(current.id);
        return;
      }
      const { data, error } = await supabase.from('profiles').update(patch).eq('id', current.id).select().single();
      if (error) throw error;
      commitAccount(profileToAccount(data as ProfileRow));
    },
    [commitAccount, loadProfile]
  );

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    const current = accountRef.current;
    if (!current) return false;
    // Supabase doesn't ask for the old password, so check it by signing in.
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: current.email,
      password: currentPassword,
    });
    if (verifyError) {
      if (/invalid login credentials/i.test(verifyError.message)) return false;
      throw verifyError;
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
    return true;
  }, []);

  const setAccountRole = useCallback(
    async (id: string, nextRole: Role) => {
      const { error } = await supabase.rpc('set_role', { target: id, new_role: nextRole });
      if (error) throw error;
      commitAccounts(accountsRef.current.map((a) => (a.id === id ? { ...a, role: nextRole } : a)));
    },
    [commitAccounts]
  );

  const session = useMemo(() => (account ? toSession(account) : null), [account]);

  const value = useMemo(
    () => ({
      session,
      account,
      accounts,
      isLoading,
      checkInviteCode,
      signUp,
      logIn,
      logOut,
      updateAccount,
      setAccountRole,
      changePassword,
    }),
    [session, account, accounts, isLoading, checkInviteCode, signUp, logIn, logOut, updateAccount, setAccountRole, changePassword]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
