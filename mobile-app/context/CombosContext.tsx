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
import { COMBOS as SEED_COMBOS, type Combo } from '../constants/combosData';

const STORAGE_KEY = 'formation.combos.custom.v1';

type CombosContextValue = {
  combos: Combo[];
  addCombo: (combo: Combo) => Promise<void>;
};

const CombosContext = createContext<CombosContextValue | null>(null);

function isCombo(value: unknown): value is Combo {
  if (typeof value !== 'object' || value === null) return false;
  const c = value as Record<string, unknown>;
  return (
    typeof c.id === 'string' &&
    typeof c.label === 'string' &&
    typeof c.sub === 'string' &&
    (c.image === undefined || typeof c.image === 'string') &&
    (c.components === undefined ||
      (Array.isArray(c.components) && c.components.every((item) => typeof item === 'string')))
  );
}

function parseCombos(saved: string): Combo[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(saved);
  } catch {
    return [];
  }
  return Array.isArray(parsed) ? parsed.filter(isCombo) : [];
}

export function CombosProvider({ children }: { children: ReactNode }) {
  const [customCombos, setCustomCombos] = useState<Combo[]>([]);
  const customCombosRef = useRef<Combo[]>([]);

  useEffect(() => {
    let isMounted = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (!isMounted || !saved) return;
        const parsed = parseCombos(saved);
        customCombosRef.current = parsed;
        setCustomCombos(parsed);
      })
      .catch(() => {
        // No saved data yet, or storage unavailable — stay with the empty seed.
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const addCombo = useCallback(async (combo: Combo) => {
    const next = [...customCombosRef.current, combo];
    customCombosRef.current = next;
    setCustomCombos(next);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (error) {
      // Best-effort persistence — in-memory state is already up to date.
      console.warn('CombosContext: failed to persist new combo', error);
    }
  }, []);

  const combos = useMemo(() => [...SEED_COMBOS, ...customCombos], [customCombos]);

  const value = useMemo(() => ({ combos, addCombo }), [combos, addCombo]);

  return <CombosContext.Provider value={value}>{children}</CombosContext.Provider>;
}

export function useCombos(): CombosContextValue {
  const context = useContext(CombosContext);
  if (!context) {
    throw new Error('useCombos must be used within a CombosProvider');
  }
  return context;
}
