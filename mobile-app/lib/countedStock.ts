// Counted inventory (ties, spare polos, white shirts): season totals, wash-day counts,
// and shirts members keep at home. Pure functions so the screens only render results.
import type { PieceType } from './models.ts';

export type CountLine = { label: string; total: number; count: number };

export type ShirtOwner = {
  role: 'Member' | 'Staff';
  archivedAt: string | null;
  whiteShirtSize: string;
  keepsWhiteShirt: boolean | null;
};

export type LineStatus = CountLine & { kept: number; expected: number; missing: number };

export const WHITE_SHIRT = 'White shirt';

const key = (s: string) => s.trim().toLowerCase();

export function isWhiteShirt(name: string): boolean {
  return key(name) === key(WHITE_SHIRT);
}

/** The sizes members can pick: the active White shirt type's line labels, or [] without one. */
export function whiteShirtSizes(types: PieceType[]): string[] {
  const shirt = types.find((t) => !t.retired && t.kind === 'counted' && isWhiteShirt(t.name));
  return shirt ? shirt.lines.map((l) => l.label) : [];
}

/**
 * How many active members keep their own shirt, per size label, and how many haven't
 * answered. "Keep" with a size that isn't one of the labels can't be placed, so it counts
 * as not answered.
 */
export function keptAtHome(owners: ShirtOwner[], labels: string[]): { kept: Record<string, number>; unanswered: number } {
  const kept: Record<string, number> = Object.fromEntries(labels.map((l) => [l, 0]));
  const byKey = new Map(labels.map((l) => [key(l), l]));
  let unanswered = 0;
  for (const o of owners) {
    if (o.role !== 'Member' || o.archivedAt !== null) continue;
    if (o.keepsWhiteShirt === false) continue;
    const label = byKey.get(key(o.whiteShirtSize));
    if (o.keepsWhiteShirt === true && label !== undefined) kept[label] += 1;
    else unanswered += 1;
  }
  return { kept, unanswered };
}

export function lineStatuses(lines: CountLine[], kept: Record<string, number> = {}): LineStatus[] {
  return lines.map((line) => {
    const k = kept[line.label] ?? 0;
    const expected = Math.max(0, line.total - k);
    return { ...line, kept: k, expected, missing: Math.max(0, expected - line.count) };
  });
}

export function cardSummary(statuses: LineStatus[]): { count: number; expected: number; missing: number } {
  return statuses.reduce(
    (sum, s) => ({ count: sum.count + s.count, expected: sum.expected + s.expected, missing: sum.missing + s.missing }),
    { count: 0, expected: 0, missing: 0 },
  );
}

/** The labels a recount screen shows: its own order, plus saved labels it doesn't have yet. */
export function withNewLabels(order: string[], lineLabels: string[]): string[] {
  const have = new Set(order.map(key));
  return [...order, ...lineLabels.filter((l) => !have.has(key(l)))];
}

/** Adds a batch to a count or removes one from it; null if the count would go below 0. */
export function moveBatch(current: number, amount: number, direction: 'add' | 'remove'): number | null {
  const next = direction === 'add' ? current + amount : current - amount;
  return next < 0 ? null : next;
}
