import type { Account, InventoryPiece, PieceType } from '../models.ts';
import { ownerIndex } from '../inventory.ts';
import type { SheetRow } from './rows.ts';

export const DEFAULT_COLORS: Record<'Coats' | 'Bibbers' | 'Vests', string[]> = {
  Coats: ['Blue', 'Red', 'Purple', 'Candy'],
  Vests: ['Candy', 'Red'],
  Bibbers: ['Blue', 'White'],
};

export type MatchResult =
  | { status: 'matched'; account: Account }
  | { status: 'none' }
  | { status: 'ambiguous'; candidates: Account[] }
  | { status: 'archived'; account: Account };

export type NumberChange = {
  line: number;
  memberId: string;
  memberName: string;
  pieceType: string;
  sheet: string;
  current: string | null;
  choice: 'sheet' | 'app';
};

export type ImportPlan = {
  typesToCreate: { name: string; colors: string[] }[];
  piecesToAdd: { pieceType: string; number: string }[];
  outForRepair: { pieceType: string; color: string; number: string }[];
  numbers: NumberChange[];
  // `number` is the coat number after import with the default choices; toPayload re-resolves it
  // from `numbers` (staff may flip a choice) using memberId and `current`.
  notes: { memberId: string; memberName: string; pieceType: 'Coats'; number: string; current: string | null; text: string }[];
  problems: { line: number; message: string }[];
};

export type ImportPayload = {
  typesToCreate: { name: string; colors: string[] }[];
  piecesToAdd: { pieceType: string; number: string }[];
  outForRepair: { pieceType: string; color: string; number: string }[];
  numbers: { memberId: string; pieceType: string; number: string }[];
  notes: { memberName: string; pieceType: string; number: string; text: string }[];
};

const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();
const fullName = (a: Account) => `${a.firstName} ${a.lastName}`.trim();
const keyOf = (type: string, number: string) => `${type}|${number}`;

function nameKeys(a: Account): string[] {
  return [norm(`${a.lastName} ${a.firstName}`), norm(`${a.firstName} ${a.lastName}`)];
}

/** Sheet names are `Last First`; `First Last` also matches. Archived accounts are never matched. */
export function matchName(name: string, accounts: Account[]): MatchResult {
  const wanted = norm(name);
  const hits = accounts.filter((a) => nameKeys(a).includes(wanted));
  const active = hits.filter((a) => a.archivedAt === null);
  if (active.length === 1) return { status: 'matched', account: active[0] };
  if (active.length > 1) return { status: 'ambiguous', candidates: active };
  if (hits.length > 0) return { status: 'archived', account: hits[0] };
  return { status: 'none' };
}

export function buildPreview(
  rows: SheetRow[],
  accounts: Account[],
  types: PieceType[],
  pieces: InventoryPiece[],
  existingImportNotes: { memberName: string; pieceType: string }[],
): ImportPlan {
  const plan: ImportPlan = {
    typesToCreate: [],
    piecesToAdd: [],
    outForRepair: [],
    numbers: [],
    notes: [],
    problems: [],
  };
  const problem = (line: number, message: string) => plan.problems.push({ line, message });

  const typeByName = new Map(types.map((t) => [t.name, t]));
  const colorsFor = (type: string): string[] =>
    typeByName.get(type)?.colors ?? DEFAULT_COLORS[type as keyof typeof DEFAULT_COLORS] ?? [];

  // Types the sheet uses that the app doesn't have yet.
  const usedTypes: string[] = [];
  const noteType = (t: string) => {
    if (!usedTypes.includes(t)) usedTypes.push(t);
  };
  for (const row of rows) {
    if (row.kind === 'member' || row.kind === 'unassigned') {
      for (const t of Object.keys(row.numbers)) noteType(t);
    } else if (row.kind === 'repair_shop') {
      noteType(row.pieceType);
    }
  }
  for (const t of usedTypes) {
    if (!typeByName.has(t) && t in DEFAULT_COLORS) {
      plan.typesToCreate.push({ name: t, colors: [...colorsFor(t)] });
    }
  }

  // Pieces: only numbers with no piece of that type+number in any color.
  const existing = new Set(pieces.map((p) => keyOf(p.pieceType, p.number)));
  const addPiece = (pieceType: string, number: string) => {
    const k = keyOf(pieceType, number);
    if (existing.has(k)) return;
    existing.add(k);
    plan.piecesToAdd.push({ pieceType, number });
  };
  for (const row of rows) {
    if (row.kind === 'member' || row.kind === 'unassigned') {
      for (const [t, n] of Object.entries(row.numbers)) if (n) addPiece(t, n);
    } else if (row.kind === 'repair_shop') {
      addPiece(row.pieceType, row.number);
    }
  }

  // Out for repair.
  const seenRepair = new Set<string>();
  for (const row of rows) {
    if (row.kind !== 'repair_shop') continue;
    const color = colorsFor(row.pieceType).find((c) => norm(c) === norm(row.color));
    if (!color) {
      problem(row.line, `Line ${row.line}: ${row.color} isn't a ${row.pieceType} color`);
      continue;
    }
    const already = pieces.some(
      (p) => p.pieceType === row.pieceType && p.number === row.number && p.color === color && p.outForRepair,
    );
    const k = `${row.pieceType}|${color}|${row.number}`;
    if (already || seenRepair.has(k)) continue;
    seenRepair.add(k);
    plan.outForRepair.push({ pieceType: row.pieceType, color, number: row.number });
  }

  // Member rows: match names, then gather claimed numbers to detect clashes.
  type Claim = { line: number; account: Account; pieceType: string; number: string };
  const claims: Claim[] = [];
  const matchedRows: { row: Extract<SheetRow, { kind: 'member' }>; account: Account }[] = [];
  for (const row of rows) {
    if (row.kind === 'invalid') {
      problem(row.line, `Line ${row.line}: ${row.reason}`);
    } else if (row.kind === 'member') {
      const m = matchName(row.name, accounts);
      if (m.status === 'none') problem(row.line, `Line ${row.line}: no app account for "${row.name}"`);
      else if (m.status === 'ambiguous') problem(row.line, `Line ${row.line}: "${row.name}" matches more than one account`);
      else if (m.status === 'archived') problem(row.line, `Line ${row.line}: "${row.name}" is archived`);
      else {
        matchedRows.push({ row, account: m.account });
        for (const [t, n] of Object.entries(row.numbers)) {
          if (n) claims.push({ line: row.line, account: m.account, pieceType: t, number: n });
        }
      }
    }
  }

  const claimants = new Map<string, Map<string, Account>>();
  for (const c of claims) {
    const k = keyOf(c.pieceType, c.number);
    if (!claimants.has(k)) claimants.set(k, new Map());
    claimants.get(k)!.set(c.account.id, c.account);
  }
  const owners = ownerIndex(accounts);
  const handled = new Map<string, string>(); // memberId|type -> first number in the sheet (it wins)
  for (const c of claims) {
    const k = keyOf(c.pieceType, c.number);
    const name = fullName(c.account);
    const others = [...claimants.get(k)!.values()].filter((a) => a.id !== c.account.id);
    const owner = owners.get(k);
    const other = others[0] ?? (owner && owner.id !== c.account.id ? owner : undefined);
    if (other) {
      problem(c.line, `Line ${c.line}: ${c.pieceType} ${c.number} is also ${fullName(other)}'s`);
      continue;
    }
    const hk = `${c.account.id}|${c.pieceType}`;
    if (handled.has(hk)) {
      if (handled.get(hk) !== c.number) {
        problem(c.line, `Line ${c.line}: ${name} has two ${c.pieceType} numbers in the sheet`);
      }
      continue;
    }
    handled.set(hk, c.number);
    const current = c.account.numbers[c.pieceType] || null;
    if (current === c.number) continue;
    plan.numbers.push({
      line: c.line,
      memberId: c.account.id,
      memberName: name,
      pieceType: c.pieceType,
      sheet: c.number,
      current,
      choice: 'sheet',
    });
  }

  // Notes from Repairs text on member rows. The note goes on the coat number the member will
  // have after import: the sheet's if that change is applied, otherwise the current one.
  const noted = new Set(existingImportNotes.filter((n) => n.pieceType === 'Coats').map((n) => n.memberName));
  for (const { row, account } of matchedRows) {
    if (!row.repairs) continue;
    const memberName = fullName(account);
    if (noted.has(memberName)) continue;
    const current = account.numbers.Coats || null;
    const change = plan.numbers.find((n) => n.memberId === account.id && n.pieceType === 'Coats');
    const number = change ? change.sheet : current;
    if (!number) {
      problem(row.line, `Line ${row.line}: repairs note for "${memberName}" skipped (no coat number)`);
      continue;
    }
    noted.add(memberName);
    plan.notes.push({ memberId: account.id, memberName, pieceType: 'Coats', number, current, text: row.repairs });
  }

  plan.problems.sort((a, b) => a.line - b.line);
  return plan;
}

// A change with no current number has nothing to keep, so it always applies. The UI only offers
// the sheet/app toggle when current is non-null and differs from the sheet.
const applies = (n: NumberChange) => n.current === null || n.choice === 'sheet';

export function toPayload(plan: ImportPlan): ImportPayload {
  return {
    typesToCreate: plan.typesToCreate,
    piecesToAdd: plan.piecesToAdd,
    outForRepair: plan.outForRepair,
    numbers: plan.numbers
      .filter(applies)
      .map((n) => ({ memberId: n.memberId, pieceType: n.pieceType, number: n.sheet })),
    notes: plan.notes.flatMap((n) => {
      const change = plan.numbers.find((c) => c.memberId === n.memberId && c.pieceType === 'Coats');
      const number = change ? (applies(change) ? change.sheet : change.current) : n.current;
      return number ? [{ memberName: n.memberName, pieceType: n.pieceType, number, text: n.text }] : [];
    }),
  };
}

/** Pieces the plan will create: each number in every color of its type (new types use the plan's colors). */
export function countPiecesToAdd(plan: ImportPlan, types: PieceType[]): number {
  return plan.piecesToAdd.reduce((total, p) => {
    const colors =
      types.find((t) => t.name === p.pieceType)?.colors ??
      plan.typesToCreate.find((t) => t.name === p.pieceType)?.colors ??
      [];
    return total + colors.length;
  }, 0);
}

export function isNothingToDo(plan: ImportPlan): boolean {
  return (
    plan.typesToCreate.length === 0 &&
    plan.piecesToAdd.length === 0 &&
    plan.outForRepair.length === 0 &&
    plan.numbers.length === 0 &&
    plan.notes.length === 0
  );
}

/** Student numbers toPayload will write: brand-new ones vs ones replacing an existing number. */
export function countNumberChanges(plan: ImportPlan): { added: number; replaced: number } {
  const sent = plan.numbers.filter(applies);
  const added = sent.filter((n) => n.current === null).length;
  return { added, replaced: sent.length - added };
}
