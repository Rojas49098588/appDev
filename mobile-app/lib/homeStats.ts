// Real counts for the staff Home screen. Pure: runs under Node tests.

export type StatsAccount = { role: 'Member' | 'Staff'; instrument: string; archivedAt: string | null };
export type StatsFlag = { status: 'dirty' | 'repair'; clearedAt: string | null };

export type HomeStat = { label: string; value: string; flag?: boolean };

// Active (not archived) members, per section name. Sections with no members are 0.
export function sectionCounts(
  accounts: StatsAccount[],
  sectionNames: string[],
  sectionOf: (instrument: string) => string,
): { name: string; count: number }[] {
  const counts = new Map(sectionNames.map((name) => [name, 0]));
  for (const a of accounts) {
    if (a.role !== 'Member' || a.archivedAt) continue;
    const section = sectionOf(a.instrument);
    if (counts.has(section)) counts.set(section, (counts.get(section) ?? 0) + 1);
  }
  return sectionNames.map((name) => ({ name, count: counts.get(name) ?? 0 }));
}

export function homeStats(
  accounts: StatsAccount[],
  sectionNames: string[],
  sectionOf: (instrument: string) => string,
  comboCount: number,
  flags: StatsFlag[],
): HomeStat[] {
  const perSection = sectionCounts(accounts, sectionNames, sectionOf);
  const members = perSection.reduce((sum, s) => sum + s.count, 0);
  const activeSections = perSection.filter((s) => s.count > 0).length;
  const repairs = flags.filter((f) => f.status === 'repair' && f.clearedAt === null).length;
  return [
    { label: members === 1 ? 'member' : 'members', value: String(members) },
    { label: activeSections === 1 ? 'section' : 'sections', value: String(activeSections) },
    { label: comboCount === 1 ? 'outfit combination' : 'outfit combinations', value: String(comboCount) },
    { label: repairs === 1 ? 'piece flagged for repair' : 'pieces flagged for repair', value: String(repairs), flag: true },
  ];
}
