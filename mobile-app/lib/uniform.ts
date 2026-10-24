import type { MemberNumbers } from './models.ts';

// Number assigned for a piece type name; '' when none.
export function numberFor(numbers: MemberNumbers | undefined, pieceType: string): string {
  return numbers?.[pieceType] ?? '';
}

// Exact match (query trimmed); an unassigned number never matches.
export function matchesNumber(numbers: MemberNumbers | undefined, pieceType: string, query: string): boolean {
  const number = numberFor(numbers, pieceType);
  return number !== '' && number === query.trim();
}

export function digitsOnly(text: string): string {
  return text.replace(/\D/g, '');
}
