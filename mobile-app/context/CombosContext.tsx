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
// Ids of seed combos the user deleted. Seed combos live in code, so they're
// hidden by id rather than removed.
const DELETED_SEEDS_KEY = 'formation.combos.deleted.v1';

type CombosContextValue = {
  combos: Combo[];
  addCombo: (combo: Combo) => Promise<void>;
  deleteCombo: (id: string) => Promise<void>;
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

function parseIds(saved: string): string[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(saved);
  } catch {
    return [];
  }
  return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
}

export function CombosProvider({ children }: { children: ReactNode }) {
  const [customCombos, setCustomCombos] = useState<Combo[]>([]);
  const customCombosRef = useRef<Combo[]>([]);
  const [deletedSeedIds, setDeletedSeedIds] = useState<string[]>([]);
  const deletedSeedIdsRef = useRef<string[]>([]);

  useEffect(() => {
    let isMounted = true;
    Promise.all([AsyncStorage.getItem(STORAGE_KEY), AsyncStorage.getItem(DELETED_SEEDS_KEY)])
      .then(([saved, savedDeleted]) => {
        if (!isMounted) return;
        if (saved) {
          const parsed = parseCombos(saved);
          customCombosRef.current = parsed;
          setCustomCombos(parsed);
        }
        if (savedDeleted) {
          const parsedDeleted = parseIds(savedDeleted);
          deletedSeedIdsRef.current = parsedDeleted;
          setDeletedSeedIds(parsedDeleted);
        }
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

  const deleteCombo = useCallback(async (id: string) => {
    const isSeed = SEED_COMBOS.some((combo) => combo.id === id);
    try {
      if (isSeed) {
        if (deletedSeedIdsRef.current.includes(id)) return;
        const next = [...deletedSeedIdsRef.current, id];
        deletedSeedIdsRef.current = next;
        setDeletedSeedIds(next);
        await AsyncStorage.setItem(DELETED_SEEDS_KEY, JSON.stringify(next));
      } else {
        const next = customCombosRef.current.filter((combo) => combo.id !== id);
        customCombosRef.current = next;
        setCustomCombos(next);
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      }
    } catch (error) {
      // Best-effort persistence — in-memory state is already up to date.
      console.warn('CombosContext: failed to persist combo deletion', error);
    }
  }, []);

  const combos = useMemo(
    () => [...SEED_COMBOS.filter((combo) => !deletedSeedIds.includes(combo.id)), ...customCombos],
    [customCombos, deletedSeedIds]
  );

  const value = useMemo(() => ({ combos, addCombo, deleteCombo }), [combos, addCombo, deleteCombo]);

  return <CombosContext.Provider value={value}>{children}</CombosContext.Provider>;
}

export function useCombos(): CombosContextValue {
  const context = useContext(CombosContext);
  if (!context) {
    throw new Error('useCombos must be used within a CombosProvider');
  }
  return context;
}
