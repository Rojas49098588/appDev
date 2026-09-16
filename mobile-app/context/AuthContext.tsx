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
          const parsed = parseJson(savedAccount, isAccount);
          if (parsed) setAccount(parsed);
        }
        if (savedSession) {
          const parsed = parseJson(savedSession, isSession);
          if (parsed) setSession(parsed);
        }
      })
      .catch(() => {
        // No saved data yet, or storage unavailable — stay logged out.
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
      await AsyncStorage.setItem(ACCOUNT_KEY, JSON.stringify(newAccount));
      await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(newSession));
    } catch {
      // Best-effort persistence — in-memory state is already up to date.
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
      } catch {
        // Best-effort persistence — in-memory state is already up to date.
      }
      return account;
    },
    [account]
  );

  const logOut = useCallback(async () => {
    setSession(null);
    try {
      await AsyncStorage.removeItem(SESSION_KEY);
    } catch {
      // Best-effort — in-memory state is already up to date.
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
