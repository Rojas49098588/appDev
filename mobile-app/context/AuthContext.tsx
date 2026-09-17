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
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { HeightValue, Role, UserParams } from '../navigation/types';

const ACCOUNT_KEY = 'formation.account.v1';
const SESSION_KEY = 'formation.session.v1';
const DIRECTORY_KEY = 'formation.accounts.directory.v1';

export type ShoeSize = { gender: "Men's" | "Women's"; size: string };

export type Account = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  instrument: string;
  role: Role;
  phone: string;
  shoeSize: ShoeSize;
  height: HeightValue;
  weight: string;
};

type AuthContextValue = {
  session: UserParams | null;
  account: Account | null;
  members: Account[];
  isLoading: boolean;
  signUp: (account: Account) => Promise<void>;
  logIn: (email: string, password: string) => Promise<Account | null>;
  logOut: () => Promise<void>;
  updateAccount: (updates: Partial<Omit<Account, 'password'>>) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function isRole(value: unknown): value is Role {
  return value === 'Member' || value === 'Staff';
}

function isShoeSize(value: unknown): value is ShoeSize {
  if (typeof value !== 'object' || value === null) return false;
  const s = value as Record<string, unknown>;
  return (s.gender === "Men's" || s.gender === "Women's") && typeof s.size === 'string';
}

function isHeight(value: unknown): value is HeightValue {
  if (typeof value !== 'object' || value === null) return false;
  const h = value as Record<string, unknown>;
  return typeof h.feet === 'string' && typeof h.inches === 'string';
}

// Lenient by design: an account saved before height/weight existed (or with a
// corrupted optional field) should still load, just with those fields defaulted,
// rather than being rejected wholesale and silently logging the user out.
function normalizeAccount(value: unknown): Account | null {
  if (typeof value !== 'object' || value === null) return null;
  const a = value as Record<string, unknown>;
  if (
    typeof a.email !== 'string' ||
    typeof a.password !== 'string' ||
    typeof a.firstName !== 'string' ||
    typeof a.lastName !== 'string' ||
    typeof a.instrument !== 'string' ||
    !isRole(a.role) ||
    typeof a.phone !== 'string'
  ) {
    return null;
  }
  return {
    email: a.email,
    password: a.password,
    firstName: a.firstName,
    lastName: a.lastName,
    instrument: a.instrument,
    role: a.role,
    phone: a.phone,
    shoeSize: isShoeSize(a.shoeSize) ? a.shoeSize : { gender: "Men's", size: '' },
    height: isHeight(a.height) ? a.height : { feet: '', inches: '' },
    weight: typeof a.weight === 'string' ? a.weight : '',
  };
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

function parseDirectory(raw: string): Record<string, Account> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (typeof parsed !== 'object' || parsed === null) return {};
  const result: Record<string, Account> = {};
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    const normalized = normalizeAccount(value);
    if (normalized) result[key] = normalized;
  }
  return result;
}

function toSession(account: Account): UserParams {
  const { firstName, lastName, instrument, role } = account;
  return { firstName, lastName, instrument, role };
}

function directoryKeyFor(email: string): string {
  return email.trim().toLowerCase();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<Account | null>(null);
  const [session, setSession] = useState<UserParams | null>(null);
  const [directory, setDirectory] = useState<Record<string, Account>>({});
  const [isLoading, setIsLoading] = useState(true);

  // Mirrors `directory` synchronously so signUp/updateAccount/logIn can read
  // and persist the latest map without waiting on a state-update round trip.
  const directoryRef = useRef<Record<string, Account>>({});

  useEffect(() => {
    let isMounted = true;
    Promise.all([
      AsyncStorage.getItem(ACCOUNT_KEY),
      AsyncStorage.getItem(SESSION_KEY),
      AsyncStorage.getItem(DIRECTORY_KEY),
    ])
      .then(([savedAccount, savedSession, savedDirectory]) => {
        if (!isMounted) return;
        if (savedDirectory) {
          const parsedDirectory = parseDirectory(savedDirectory);
          directoryRef.current = parsedDirectory;
          setDirectory(parsedDirectory);
        }
        if (savedAccount) {
          const parsedAccount = normalizeAccount(JSON.parse(savedAccount));
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

    const nextDirectory = {
      ...directoryRef.current,
      [directoryKeyFor(newAccount.email)]: newAccount,
    };
    directoryRef.current = nextDirectory;
    setDirectory(nextDirectory);

    try {
      // Sequential, not Promise.all: a failure between these writes must
      // never leave a session persisted without its account (see logIn's
      // account-required guard).
      await AsyncStorage.setItem(ACCOUNT_KEY, JSON.stringify(newAccount));
      await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(newSession));
      await AsyncStorage.setItem(DIRECTORY_KEY, JSON.stringify(nextDirectory));
    } catch (error) {
      // Best-effort persistence — in-memory state is already up to date.
      console.warn('AuthContext: failed to persist account/session during signUp', error);
    }
  }, []);

  const logIn = useCallback(
    async (email: string, password: string): Promise<Account | null> => {
      const match = directoryRef.current[directoryKeyFor(email)];
      if (!match || match.password !== password) return null;

      const newSession = toSession(match);
      setAccount(match);
      setSession(newSession);
      try {
        await AsyncStorage.setItem(ACCOUNT_KEY, JSON.stringify(match));
        await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(newSession));
      } catch (error) {
        // Best-effort persistence — in-memory state is already up to date.
        console.warn('AuthContext: failed to persist session during logIn', error);
      }
      return match;
    },
    []
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

  const updateAccount = useCallback(
    async (updates: Partial<Omit<Account, 'password'>>) => {
      if (!account) return;
      const nextAccount = { ...account, ...updates };
      const nextSession = toSession(nextAccount);
      setAccount(nextAccount);
      setSession(nextSession);

      const nextDirectory = {
        ...directoryRef.current,
        [directoryKeyFor(nextAccount.email)]: nextAccount,
      };
      directoryRef.current = nextDirectory;
      setDirectory(nextDirectory);

      try {
        // Sequential, not Promise.all — same crash-consistency reason as signUp.
        await AsyncStorage.setItem(ACCOUNT_KEY, JSON.stringify(nextAccount));
        await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(nextSession));
        await AsyncStorage.setItem(DIRECTORY_KEY, JSON.stringify(nextDirectory));
      } catch (error) {
        // Best-effort persistence — in-memory state is already up to date.
        console.warn('AuthContext: failed to persist account/session during updateAccount', error);
      }
    },
    [account]
  );

  const members = useMemo(
    () => Object.values(directory).filter((entry) => entry.role === 'Member'),
    [directory]
  );

  const value = useMemo(
    () => ({ session, account, members, isLoading, signUp, logIn, logOut, updateAccount }),
    [session, account, members, isLoading, signUp, logIn, logOut, updateAccount]
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
