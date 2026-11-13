// Colors, text sizes and button sizes, from the accessibility settings.
import type { Settings, SizeStep } from './settings.ts';

export type Palette = {
  paper: string;
  surface: string;
  ink: string;
  inkSoft: string;
  inkFaint: string;
  line: string;
  lineSoft: string;
  rust: string;
  rustTint: string;
  wash: string;
  washTint: string;
  white: string;
  good: string;
  amber: string;
  amberTint: string;
  teal: string;
  tealDark: string;
  tealTint: string;
  backdrop: string;
  toast: string;
  mint: string;
};

// Every text color is at least 4.5 : 1 on paper, surface and white (WCAG AA).
export const DEFAULT_PALETTE: Palette = {
  paper: '#E8E6E0',
  surface: '#F6F5F1',
  ink: '#22201D',
  inkSoft: '#5C5850',
  inkFaint: '#6B665D',
  line: '#D2CDC2',
  lineSoft: '#DEDACF',
  rust: '#A0442A',
  rustTint: '#F1E1DA',
  wash: '#3A667A',
  washTint: '#DDE6E7',
  white: '#FFFFFF',
  good: '#346A50',
  amber: '#875411',
  amberTint: '#FFF5DF',
  teal: '#2E7A78',
  tealDark: '#245F5D',
  tealTint: '#EDF8F6',
  backdrop: 'rgba(30, 35, 40, 0.45)',
  toast: '#20282C',
  mint: '#9FE2C3',
};

// High contrast: grays nearly black, borders much stronger.
export const HIGH_CONTRAST_PALETTE: Palette = {
  ...DEFAULT_PALETTE,
  inkSoft: '#2B2925',
  inkFaint: '#3A3732',
  line: '#8F8778',
  lineSoft: '#A8A193',
};

export const TEXT_COLOR_KEYS = ['ink', 'inkSoft', 'inkFaint', 'rust', 'wash', 'good', 'amber', 'tealDark'] as const;

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// WCAG contrast ratio between two #RRGGBB colors (1 to 21).
export function contrastRatio(fg: string, bg: string): number {
  const a = luminance(fg);
  const b = luminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

export const SIZE_STEPS = [1, 1.15, 1.3, 1.5] as const;
export const SIZE_STEP_NAMES = ['Standard', 'Large', 'Larger', 'Largest'] as const;

// Layouts switch to their large-text form (buttons under titles, one-column
// grids) once the phone's text scale times the app's size step reaches this.
export const LARGE_TEXT_THRESHOLD = 1.35;

export function isLargeText(systemFontScale: number, step: SizeStep): boolean {
  return systemFontScale * SIZE_STEPS[step] >= LARGE_TEXT_THRESHOLD - 1e-9;
}

export type OutlineMetrics = {
  minHeight: number;
  fontSize: number;
  paddingHorizontal: number;
  borderWidth: number;
  borderRadius: number;
};

// Standard is the compact button; Large is the "regular" one; bigger steps
// grow from Large in proportion.
export function outlineButtonMetrics(step: SizeStep, highContrast: boolean): OutlineMetrics {
  const base =
    step === 0
      ? { minHeight: 28, fontSize: 12, paddingHorizontal: 10, borderWidth: 1.25 }
      : (() => {
          const k = SIZE_STEPS[step] / SIZE_STEPS[1];
          return {
            minHeight: Math.round(36 * k),
            fontSize: Math.round(13.5 * k * 10) / 10,
            paddingHorizontal: Math.round(14 * k),
            borderWidth: 1.5,
          };
        })();
  return {
    ...base,
    borderWidth: highContrast ? 2 : base.borderWidth,
    borderRadius: base.minHeight / 2,
  };
}

export type Theme = {
  colors: Palette;
  font: (size: number) => number;
  isLarge: boolean;
  highContrast: boolean;
  expanded: boolean;
  sizeStep: SizeStep;
  button: OutlineMetrics;
};

// The phone already scales text by its own setting; `font` adds the app's step on top.
export function makeTheme(settings: Settings, systemFontScale: number): Theme {
  const k = SIZE_STEPS[settings.sizeStep];
  return {
    colors: settings.highContrast ? HIGH_CONTRAST_PALETTE : DEFAULT_PALETTE,
    font: (size: number) => Math.round(size * k * 100) / 100,
    isLarge: isLargeText(systemFontScale, settings.sizeStep),
    highContrast: settings.highContrast,
    expanded: settings.layout === 'expanded',
    sizeStep: settings.sizeStep,
    button: outlineButtonMetrics(settings.sizeStep, settings.highContrast),
  };
}
