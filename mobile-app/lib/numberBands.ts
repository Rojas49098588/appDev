// Splits a color's piece numbers into rows by hundreds for the Expanded
// Inventory view ("100–199", "200–299"…). Short lists stay one row.

export type NumberBand = { label: string; numbers: string[] };

const MIN_TO_SPLIT = 12;

export function bandNumbers(numbers: string[]): NumberBand[] {
  const sorted = [...numbers].sort((a, b) => Number(a) - Number(b));
  if (sorted.length < MIN_TO_SPLIT) return [{ label: '', numbers: sorted }];
  const bands = new Map<number, string[]>();
  for (const n of sorted) {
    const hundred = Math.floor(Number(n) / 100);
    bands.set(hundred, [...(bands.get(hundred) ?? []), n]);
  }
  return [...bands.entries()].map(([h, nums]) => ({
    label: h === 0 ? '1–99' : `${h * 100}–${h * 100 + 99}`,
    numbers: nums,
  }));
}
