type PieceName = 'Coats' | 'Bibbers' | 'Vests';

export type ColumnMap = {
  name: number;
  section: number;
  coats: number;
  bibbers: number;
  vests: number;
  repairs: number;
};

export type SheetNumbers = Partial<Record<PieceName, string>>;

export type SheetRow = { line: number } & (
  | { kind: 'member'; name: string; numbers: SheetNumbers; repairs: string }
  | { kind: 'repair_shop'; pieceType: PieceName; number: string; color: string }
  | { kind: 'unassigned'; numbers: SheetNumbers }
  | { kind: 'invalid'; reason: string; raw: string[] }
);

const squash = (s: string) => s.replace(/\s+/g, '').toLowerCase();

const HEADERS: [keyof ColumnMap, string][] = [
  ['name', 'NAME'],
  ['section', 'Section'],
  ['coats', 'Coat #'],
  ['bibbers', 'BIBBER #'],
  ['vests', 'VESTS'],
  ['repairs', 'Repairs'],
];

export function findColumns(header: string[]): ColumnMap | { missing: string[] } {
  const normalized = header.map(squash);
  const map: Partial<ColumnMap> = {};
  const missing: string[] = [];
  for (const [key, label] of HEADERS) {
    const idx = normalized.indexOf(squash(label));
    if (idx === -1) missing.push(label);
    else map[key] = idx;
  }
  return missing.length ? { missing } : (map as ColumnMap);
}

/** Digits only, leading zeros stripped ('0' stays '0'); null when empty or not a number. */
export function normalizeNumber(raw: string): string | null {
  const t = raw.trim();
  if (!/^\d+$/.test(t)) return null;
  return t.replace(/^0+(?=\d)/, '');
}

export const MAX_NUMBER_LIST = 1000;

/**
 * Parses what staff type into the numbers box: a list ("104, 112 120"), a range
 * ("104 to 232 every 4", step defaults to 1, both ends included when they fall on the step),
 * or a mix separated by commas. Numbers are normalized and de-duplicated in order.
 */
export function parseNumberList(text: string): { numbers: string[]; error: string | null } {
  const out: string[] = [];
  const seen = new Set<string>();
  const fail = (error: string) => ({ numbers: [] as string[], error });
  const add = (n: string): string | null => {
    if (!seen.has(n)) {
      seen.add(n);
      out.push(n);
    }
    return out.length > MAX_NUMBER_LIST ? `That is more than ${MAX_NUMBER_LIST} numbers` : null;
  };

  for (const part of text.split(/[,;\n]+/).map((p) => p.trim()).filter(Boolean)) {
    const range = part.match(/^(\S+)\s+to\s+(\S+)(?:\s+every\s+(\S+))?$/i);
    if (range) {
      const start = normalizeNumber(range[1]);
      if (start === null) return fail(`"${range[1]}" isn't a number`);
      const end = normalizeNumber(range[2]);
      if (end === null) return fail(`"${range[2]}" isn't a number`);
      const stepText = range[3] ?? '1';
      const step = /^\d+$/.test(stepText) ? parseInt(stepText, 10) : 0;
      if (step < 1) return fail('every must be at least 1');
      const a = parseInt(start, 10);
      const b = parseInt(end, 10);
      if (a > b) return fail(`In "${part}" the start must not be after the end`);
      if (Math.floor((b - a) / step) + 1 > MAX_NUMBER_LIST) {
        return fail(`That range is more than ${MAX_NUMBER_LIST} numbers`);
      }
      for (let n = a; n <= b; n += step) {
        const err = add(String(n));
        if (err) return fail(err);
      }
      continue;
    }
    for (const token of part.split(/\s+/)) {
      const n = normalizeNumber(token);
      if (n === null) return fail(`"${token}" isn't a number`);
      const err = add(n);
      if (err) return fail(err);
    }
  }
  return { numbers: out, error: null };
}

const PIECE_COLUMNS: { type: PieceName; key: 'coats' | 'bibbers' | 'vests'; label: string }[] = [
  { type: 'Coats', key: 'coats', label: 'Coat #' },
  { type: 'Bibbers', key: 'bibbers', label: 'BIBBER #' },
  { type: 'Vests', key: 'vests', label: 'VESTS' },
];

/**
 * `cells` is the full parseCsv output including the header row, which is skipped.
 * `line` = index in `cells` + 1, so the header is line 1.
 */
export function classifyRows(cells: string[][], cols: ColumnMap): SheetRow[] {
  const out: SheetRow[] = [];
  for (let i = 1; i < cells.length; i++) {
    const raw = cells[i];
    const line = i + 1;
    if (raw.every((c) => c.trim() === '')) continue;
    const get = (idx: number) => (raw[idx] ?? '').trim();
    const invalid = (reason: string): SheetRow => ({ line, kind: 'invalid', reason, raw });

    const name = get(cols.name);
    const section = get(cols.section);
    const repairs = get(cols.repairs);

    // Numbers per piece column; a non-empty cell that isn't a number is invalid.
    const numbers: SheetNumbers = {};
    let bad: string | null = null;
    const present: { type: PieceName; number: string }[] = [];
    let filledCells = 0;
    for (const col of PIECE_COLUMNS) {
      const cell = get(cols[col.key]);
      if (cell === '') continue;
      filledCells++;
      const n = normalizeNumber(cell);
      if (n === null) {
        bad ??= `${col.label} "${cell}" isn't a number`;
      } else {
        numbers[col.type] = n;
        present.push({ type: col.type, number: n });
      }
    }

    const isAddison = /addison sew/i.test(section) || /addison sew/i.test(name);
    if (isAddison) {
      if (filledCells !== 1) {
        out.push(invalid('Addison Sew row needs exactly one piece number'));
      } else if (bad) {
        out.push(invalid(bad));
      } else if (repairs === '') {
        out.push(invalid('Addison Sew row needs a color in Repairs'));
      } else {
        out.push({ line, kind: 'repair_shop', pieceType: present[0].type, number: present[0].number, color: repairs });
      }
      continue;
    }

    if (bad) {
      out.push(invalid(bad));
    } else if (name.toLowerCase() === 'unassigned') {
      out.push({ line, kind: 'unassigned', numbers });
    } else if (name === '') {
      out.push(invalid('No name'));
    } else {
      out.push({ line, kind: 'member', name, numbers, repairs });
    }
  }
  return out;
}
