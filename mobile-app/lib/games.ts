import type { Game, GameDraft, Sport } from './models.ts';

// Pure game-day logic. No React Native imports: this runs under Node tests.

const chicagoDay = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit',
});

// 'YYYY-MM-DD' in America/Chicago, whatever the phone's timezone.
// Built from formatToParts so it never depends on the locale's separator or digit shapes.
// If a runtime still returns non-ASCII digits we throw rather than send a bad date to the app.
export function bandToday(now: Date): string {
  const parts: Record<string, string> = {};
  for (const p of chicagoDay.formatToParts(now)) parts[p.type] = p.value;
  const out = `${parts.year}-${parts.month}-${parts.day}`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(out)) throw new Error(`bandToday: unexpected date format "${out}"`);
  return out;
}

export const isCourt = (sport: Sport): boolean => sport === 'basketball' || sport === 'volleyball';

export function missingFields(g: GameDraft): string[] {
  const court = isCourt(g.sport);
  const out: string[] = [];
  if (!g.opponent.trim()) out.push('Opposing university');
  if (!g.gameDate) out.push('Game date');
  if (!g.kickoffTime) out.push(court ? 'Start' : 'Kickoff');
  if (!g.noCallTime && !g.callTime) out.push('Call time');
  if (g.polo.length === 0) out.push('Polo');
  if (court) {
    if (!g.division) out.push("Men's / Women's");
    if (g.groupNumber === null) out.push('Group');
  } else {
    if (!g.preGameComboId) out.push('Pre-game combo');
    if (!g.halftimeComboId) out.push('Halftime combo');
  }
  return out;
}

// Dates and times compare as strings; null (no kickoff, no date) sorts last.
const cmp = (a: string | null, b: string | null): number => {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a < b ? -1 : 1;
};
const byDateThenTime = (a: Game, b: Game): number =>
  cmp(a.gameDate, b.gameDate) || cmp(a.kickoffTime, b.kickoffTime);

const upcoming = (g: Game, today: string): boolean => g.gameDate !== null && g.gameDate >= today;

export function shownFootball(games: Game[], today: string): Game | null {
  const list = games
    .filter((g) => g.sport === 'football' && g.status === 'ready' && upcoming(g, today))
    .sort(byDateThenTime);
  return list[0] ?? null;
}

export function shownCourt(games: Game[], today: string): Game[] {
  const ready = games.filter((g) => isCourt(g.sport) && g.status === 'ready' && upcoming(g, today));
  if (ready.length === 0) return [];
  const day = ready.map((g) => g.gameDate as string).sort()[0];
  return ready.filter((g) => g.gameDate === day).sort(byDateThenTime);
}

export function staffSections(
  games: Game[], tab: 'football' | 'court', today: string
): { upNext: Game[]; queue: Game[]; past: Game[] } {
  const tabGames = games.filter((g) => (tab === 'court' ? isCourt(g.sport) : g.sport === 'football'));
  let upNext: Game[];
  if (tab === 'court') {
    upNext = shownCourt(tabGames, today);
  } else {
    const shown = shownFootball(tabGames, today);
    upNext = shown ? [shown] : [];
  }
  const shownIds = new Set(upNext.map((g) => g.id));
  const queue = tabGames
    .filter((g) => !shownIds.has(g.id) && (g.gameDate === null || g.gameDate >= today))
    .sort(byDateThenTime);
  const past = tabGames
    .filter((g) => g.gameDate !== null && g.gameDate < today)
    .sort((a, b) => cmp(b.gameDate, a.gameDate) || cmp(b.kickoffTime, a.kickoffTime));
  return { upNext, queue, past };
}

export function comboInUse(games: Game[], comboId: string, today: string): Game | null {
  const list = games
    .filter((g) => g.status === 'ready' && upcoming(g, today) &&
      (g.preGameComboId === comboId || g.halftimeComboId === comboId))
    .sort(byDateThenTime);
  return list[0] ?? null;
}

export function comboShortcutTarget(games: Game[], today: string): Game | null {
  const shown = shownFootball(games, today);
  if (shown) return shown;
  const list = games.filter((g) => g.sport === 'football' && upcoming(g, today)).sort(byDateThenTime);
  return list[0] ?? null;
}

export function sportLabel(g: Pick<Game, 'sport' | 'division'>): string {
  if (g.sport === 'football') return 'Football';
  const noun = g.sport === 'volleyball' ? 'volleyball' : 'basketball';
  if (!g.division) return noun[0].toUpperCase() + noun.slice(1);
  return `${g.division === 'womens' ? "Women's" : "Men's"} ${noun}`;
}
