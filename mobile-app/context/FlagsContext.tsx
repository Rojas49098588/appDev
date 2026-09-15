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
import { FLAGS, type Flag, type FlagStatus } from '../constants/flagsData';

const STORAGE_KEY = 'formation.flags.v1';

type FlagsContextValue = {
  flags: Flag[];
  addFlag: (flag: Flag) => void;
  updateFlag: (id: string, status: FlagStatus, comment: string) => void;
};

const FlagsContext = createContext<FlagsContextValue | null>(null);

function isFlag(value: unknown): value is Flag {
  if (typeof value !== 'object' || value === null) return false;
  const f = value as Record<string, unknown>;
  return (
    typeof f.id === 'string' &&
    typeof f.memberName === 'string' &&
    typeof f.piece === 'string' &&
    typeof f.color === 'string' &&
    typeof f.size === 'string' &&
    (f.status === 'dirty' || f.status === 'repair') &&
    typeof f.comment === 'string'
  );
}

function parseFlags(saved: string): Flag[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(saved);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed) || !parsed.every(isFlag)) return null;
  return parsed;
}

export function FlagsProvider({ children }: { children: ReactNode }) {
  const [flags, setFlags] = useState<Flag[]>(FLAGS);

  useEffect(() => {
    let isMounted = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (!isMounted) return;
        const parsed = saved ? parseFlags(saved) : null;
        if (parsed) {
          setFlags(parsed);
        } else {
          AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(FLAGS)).catch(() => {
            // Best-effort — in-memory seed data is already correct either way.
          });
        }
      })
      .catch(() => {
        // No saved data yet, or storage unavailable — keep the seed FLAGS.
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const addFlag = useCallback(
    (newFlag: Flag) => {
      setFlags((current) => {
        const next = [...current.filter((f) => f.id !== newFlag.id), newFlag];
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {
          // Best-effort persistence — in-memory state is already up to date.
        });
        return next;
      });
    },
    []
  );

  const updateFlag = useCallback(
    (id: string, status: FlagStatus, comment: string) => {
      setFlags((current) => {
        const next = current.map((f) => (f.id === id ? { ...f, status, comment } : f));
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {
          // Best-effort persistence — in-memory state is already up to date.
        });
        return next;
      });
    },
    []
  );

  const value = useMemo(() => ({ flags, addFlag, updateFlag }), [flags, addFlag, updateFlag]);

  return <FlagsContext.Provider value={value}>{children}</FlagsContext.Provider>;
}

export function useFlags(): FlagsContextValue {
  const context = useContext(FlagsContext);
  if (!context) {
    throw new Error('useFlags must be used within a FlagsProvider');
  }
  return context;
}
