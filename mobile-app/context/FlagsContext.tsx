import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FLAGS, type Flag, type FlagStatus } from '../constants/flagsData';

const STORAGE_KEY = 'formation.flags.v1';

type FlagsContextValue = {
  flags: Flag[];
  addFlag: (flag: Flag) => void;
  updateFlag: (id: string, status: FlagStatus, comment: string) => void;
};

const FlagsContext = createContext<FlagsContextValue | null>(null);

export function FlagsProvider({ children }: { children: ReactNode }) {
  const [flags, setFlags] = useState<Flag[]>(FLAGS);

  useEffect(() => {
    let isMounted = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (!isMounted) return;
        if (saved) {
          setFlags(JSON.parse(saved) as Flag[]);
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

  const save = (next: Flag[]) => {
    setFlags(next);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {
      // Best-effort persistence — in-memory state is already up to date.
    });
  };

  const addFlag = (newFlag: Flag) => {
    save([...flags.filter((f) => f.id !== newFlag.id), newFlag]);
  };

  const updateFlag = (id: string, status: FlagStatus, comment: string) => {
    save(flags.map((f) => (f.id === id ? { ...f, status, comment } : f)));
  };

  return (
    <FlagsContext.Provider value={{ flags, addFlag, updateFlag }}>
      {children}
    </FlagsContext.Provider>
  );
}

export function useFlags(): FlagsContextValue {
  const context = useContext(FlagsContext);
  if (!context) {
    throw new Error('useFlags must be used within a FlagsProvider');
  }
  return context;
}
