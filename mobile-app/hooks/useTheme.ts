import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import { useSettings } from '../context/SettingsContext';
import { makeTheme, type Theme } from '../lib/theme';

export type { Theme };

// The current colors, text scale and layout flags. Changes as soon as a
// setting (or the phone's text size) changes.
export function useTheme(): Theme {
  const { settings } = useSettings();
  const { fontScale } = useWindowDimensions();
  return useMemo(() => makeTheme(settings, fontScale), [settings, fontScale]);
}

// Builds a screen's styles from the theme. `make` must be a module-level
// function (e.g. `function makeStyles(t: Theme) { return StyleSheet.create({...}) }`)
// so the styles are only rebuilt when the theme changes.
export function useThemedStyles<T>(make: (t: Theme) => T): T {
  const theme = useTheme();
  return useMemo(() => make(theme), [make, theme]);
}
