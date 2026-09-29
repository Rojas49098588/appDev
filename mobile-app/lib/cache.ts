export type Cached<T> = { syncedAt: number; data: T };

export function serializeCache<T>(data: T, syncedAt: number): string {
  return JSON.stringify({ syncedAt, data });
}

// Returns null for anything missing, unparseable or the wrong shape, so a
// corrupted cache is ignored rather than crashing the app.
export function parseCache<T>(raw: string | null, isValid: (v: unknown) => v is T): Cached<T> | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const { syncedAt, data } = parsed as Record<string, unknown>;
  if (typeof syncedAt !== 'number' || !isValid(data)) return null;
  return { syncedAt, data };
}
