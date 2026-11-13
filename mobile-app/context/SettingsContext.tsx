import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DEFAULT_SETTINGS,
  SETTINGS_KEY,
  loadSettings,
  serializeSettings,
  type Settings,
} from '../lib/settings';

type SettingsContextValue = {
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

// Loads the saved settings before anything renders, so the very first screen
// (Login included) already uses the right text size and contrast.
export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    let isMounted = true;
    loadSettings((key) => AsyncStorage.getItem(key)).then((loaded) => {
      if (isMounted) setSettings(loaded);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((current) => {
      const next = { ...(current ?? DEFAULT_SETTINGS), ...patch };
      AsyncStorage.setItem(SETTINGS_KEY, serializeSettings(next)).catch((error) =>
        console.warn('SettingsContext: failed to save settings', error)
      );
      return next;
    });
  }, []);

  const value = useMemo(
    () => (settings ? { settings, updateSettings } : null),
    [settings, updateSettings]
  );

  if (!value) return null;
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useSettings must be used within a SettingsProvider');
  return context;
}
