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
import { CURRENT_GAME, type Game } from '../constants/gamesData';

const STORAGE_KEY = 'formation.game.v1';

export type ComboSlot = 'preGame' | 'halftime';

type GameContextValue = {
  game: Game;
  setCombo: (slot: ComboSlot, comboId: string) => void;
};

const GameContext = createContext<GameContextValue | null>(null);

function isGame(value: unknown): value is Game {
  if (typeof value !== 'object' || value === null) return false;
  const g = value as Record<string, unknown>;
  return (
    typeof g.opponent === 'string' &&
    typeof g.date === 'string' &&
    typeof g.preGameComboId === 'string' &&
    typeof g.halftimeComboId === 'string' &&
    typeof g.afterGameInstructions === 'string' &&
    typeof g.instructionsPostedBy === 'string' &&
    typeof g.instructionsUpdatedAt === 'string'
  );
}

function parseGame(saved: string): Game | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(saved);
  } catch {
    return null;
  }
  return isGame(parsed) ? parsed : null;
}

export function GameProvider({ children }: { children: ReactNode }) {
  const [game, setGame] = useState<Game>(CURRENT_GAME);

  useEffect(() => {
    let isMounted = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (!isMounted) return;
        const parsed = saved ? parseGame(saved) : null;
        if (parsed) {
          setGame(parsed);
        } else {
          AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(CURRENT_GAME)).catch(() => {
            // Best-effort — in-memory seed data is already correct either way.
          });
        }
      })
      .catch(() => {
        // No saved data yet, or storage unavailable — keep the seed game.
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const setCombo = useCallback((slot: ComboSlot, comboId: string) => {
    setGame((current) => {
      const next: Game = {
        ...current,
        preGameComboId: slot === 'preGame' ? comboId : current.preGameComboId,
        halftimeComboId: slot === 'halftime' ? comboId : current.halftimeComboId,
      };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {
        // Best-effort persistence — in-memory state is already up to date.
      });
      return next;
    });
  }, []);

  const value = useMemo(() => ({ game, setCombo }), [game, setCombo]);

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameContextValue {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
}
