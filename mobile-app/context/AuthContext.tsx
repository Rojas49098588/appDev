import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Role, UserParams } from '../navigation/types';

const ACCOUNT_KEY = 'formation.account.v1';
const SESSION_KEY = 'formation.session.v1';

export type Account = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  instrument: string;
  role: Role;
};

type AuthContextValue = {
  session: UserParams | null;
  isLoading: boolean;
  signUp: (account: Account) => Promise<void>;
  logIn: (email: string, password: string) => Promise<Account | null>;
  logOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function isRole(value: unknown): value is Role {
  return value === 'Member' || value === 'Staff';
}

function isAccount(value: unknown): value is Account {
  if (typeof value !== 'object' || value === null) return false;
  const a = value as Record<string, unknown>;
  return (
    typeof a.email === 'string' &&
    typeof a.password === 'string' &&
    typeof a.firstName === 'string' &&
    typeof a.lastName === 'string' &&
    typeof a.instrument === 'string' &&
    isRole(a.role)
  );
}

function isSession(value: unknown): value is UserParams {
  if (typeof value !== 'object' || value === null) return false;
  const s = value as Record<string, unknown>;
  return (
    typeof s.firstName === 'string' &&
    typeof s.lastName === 'string' &&
    typeof s.instrument === 'string' &&
    isRole(s.role)
  );
}

function parseJson<T>(raw: string, isValid: (value: unknown) => value is T): T | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  return isValid(parsed) ? parsed : null;
}

function toSession(account: Account): UserParams {
  const { firstName, lastName, instrument, role } = account;
  return { firstName, lastName, instrument, role };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<Account | null>(null);
  const [session, setSession] = useState<UserParams | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    Promise.all([AsyncStorage.getItem(ACCOUNT_KEY), AsyncStorage.getItem(SESSION_KEY)])
      .then(([savedAccount, savedSession]) => {
        if (!isMounted) return;
        if (savedAccount) {
          const parsedAccount = parseJson(savedAccount, isAccount);
          // Only trust a saved session if its paired account also parsed
          // successfully — a session should never outlive a corrupted account,
          // since logIn requires an account to check credentials against.
          if (parsedAccount) {
            setAccount(parsedAccount);
            if (savedSession) {
              const parsedSession = parseJson(savedSession, isSession);
              if (parsedSession) setSession(parsedSession);
            }
          }
        }
      })
      .catch((error) => {
        // No saved data yet, or storage unavailable — stay logged out.
        console.warn('AuthContext: failed to read persisted account/session', error);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const signUp = useCallback(async (newAccount: Account) => {
    setAccount(newAccount);
    const newSession = toSession(newAccount);
    setSession(newSession);
    try {
      // Sequential, not Promise.all: a failure between these two writes must
      // never leave a session persisted without its account (see logIn's
      // account-required guard).
      await AsyncStorage.setItem(ACCOUNT_KEY, JSON.stringify(newAccount));
      await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(newSession));
    } catch (error) {
      // Best-effort persistence — in-memory state is already up to date.
      console.warn('AuthContext: failed to persist account/session during signUp', error);
    }
  }, []);

  const logIn = useCallback(
    async (email: string, password: string): Promise<Account | null> => {
      if (!account) return null;
      const emailMatches = email.trim().toLowerCase() === account.email.trim().toLowerCase();
      const passwordMatches = password === account.password;
      if (!emailMatches || !passwordMatches) return null;

      const newSession = toSession(account);
      setSession(newSession);
      try {
        await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(newSession));
      } catch (error) {
        // Best-effort persistence — in-memory state is already up to date.
        console.warn('AuthContext: failed to persist session during logIn', error);
      }
      return account;
    },
    [account]
  );

  const logOut = useCallback(async () => {
    setSession(null);
    try {
      await AsyncStorage.removeItem(SESSION_KEY);
    } catch (error) {
      // Best-effort — in-memory state is already up to date.
      console.warn('AuthContext: failed to clear persisted session during logOut', error);
    }
  }, []);

  const value = useMemo(
    () => ({ session, isLoading, signUp, logIn, logOut }),
    [session, isLoading, signUp, logIn, logOut]
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
