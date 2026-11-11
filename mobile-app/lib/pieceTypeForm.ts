// Rules for the "New piece type" form, kept out of the screen so they can be tested.
import type { PieceKind } from './models.ts';
import { MAX_NUMBER_LIST, parseNumberList } from './import/rows.ts';
import { OFFLINE_ALERT } from './errors.ts';

export type FormProblem = { title: string; message: string };

const byValue = (a: string, b: string) => parseInt(a, 10) - parseInt(b, 10);

/**
 * Adds what staff typed to the numbers already in the list. On a problem the list comes
 * back unchanged with an error, so nothing from a bad entry is ever kept.
 */
export function addNumbers(current: string[], text: string): { numbers: string[]; error: string | null } {
  if (!text.trim()) return { numbers: current, error: null };
  const parsed = parseNumberList(text);
  if (parsed.error) return { numbers: current, error: parsed.error };
  const merged = [...new Set([...current, ...parsed.numbers])];
  // The limit is on the whole list, or pressing Add again would get around it.
  if (merged.length > MAX_NUMBER_LIST) {
    return { numbers: current, error: `That would make more than ${MAX_NUMBER_LIST} numbers in this piece type` };
  }
  return { numbers: merged.sort(byValue), error: null };
}

/** The first reason Save can't go ahead, or null when it can. */
export function saveProblem(form: {
  name: string;
  kind: PieceKind;
  colors: string[];
  numbers: string[];
  isOnline: boolean;
}): FormProblem | null {
  if (!form.name.trim()) return { title: 'Name needed', message: 'Give this piece type a name.' };
  if (form.colors.length === 0) {
    return form.kind === 'counted'
      ? { title: 'Sizes or colors needed', message: 'Add at least one size or color.' }
      : { title: 'Colors needed', message: 'Add at least one color.' };
  }
  if (form.kind === 'numbered' && form.numbers.length === 0) {
    return { title: 'Numbers needed', message: 'Add at least one number.' };
  }
  if (!form.isOnline) return OFFLINE_ALERT;
  return null;
}
