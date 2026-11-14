// Spoken labels for screen readers (VoiceOver / TalkBack).

export type ChipAssignment = 'assigned' | 'unassigned' | 'out_for_repair';

const ASSIGNMENT_WORDS: Record<ChipAssignment, string> = {
  assigned: 'assigned',
  unassigned: 'unassigned',
  out_for_repair: 'out for repair',
};

const FLAG_WORDS = { repair: 'needs repair', dirty: 'dirty' } as const;

// An Inventory number chip as one phrase: "Blue 104, assigned, needs repair".
export function chipLabel(
  color: string,
  number: string,
  assignment: ChipAssignment,
  flag: 'repair' | 'dirty' | null
): string {
  const parts = [`${color} ${number}`, ASSIGNMENT_WORDS[assignment]];
  if (flag) parts.push(FLAG_WORDS[flag]);
  return parts.join(', ');
}
