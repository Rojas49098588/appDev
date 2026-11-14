// Accessibility settings, saved on the phone (not the account).

export type SizeStep = 0 | 1 | 2 | 3;
export type Layout = 'expanded' | 'condensed';
export type Settings = { sizeStep: SizeStep; highContrast: boolean; layout: Layout };

export const DEFAULT_SETTINGS: Settings = { sizeStep: 0, highContrast: false, layout: 'expanded' };

// Deliberately not a `mustang.cache.*` key: logout clears those, and settings must stay.
export const SETTINGS_KEY = 'mustang.settings';

// Each bad or missing field falls back on its own, so an older or damaged
// save never loses the fields that are still fine.
export function parseSettings(raw: string | null): Settings {
  let data: unknown;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = null;
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return { ...DEFAULT_SETTINGS };
  const d = data as Record<string, unknown>;
  return {
    sizeStep: d.sizeStep === 0 || d.sizeStep === 1 || d.sizeStep === 2 || d.sizeStep === 3
      ? d.sizeStep
      : DEFAULT_SETTINGS.sizeStep,
    highContrast: typeof d.highContrast === 'boolean' ? d.highContrast : DEFAULT_SETTINGS.highContrast,
    layout: d.layout === 'expanded' || d.layout === 'condensed' ? d.layout : DEFAULT_SETTINGS.layout,
  };
}

export function serializeSettings(settings: Settings): string {
  return JSON.stringify(settings);
}

// Never rejects: if storage can't be read, the app still opens with defaults.
export async function loadSettings(getItem: (key: string) => Promise<string | null>): Promise<Settings> {
  try {
    return parseSettings(await getItem(SETTINGS_KEY));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}
