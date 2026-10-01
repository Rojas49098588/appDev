export function upsertById<T extends { id: string }>(list: T[], item: T): T[] {
  const index = list.findIndex((existing) => existing.id === item.id);
  if (index === -1) return [...list, item];
  const next = list.slice();
  next[index] = item;
  return next;
}

export function removeById<T extends { id: string }>(list: T[], id: string): T[] {
  return list.filter((item) => item.id !== id);
}

// supabase.channel(topic) hands back an existing channel with the same topic,
// even one still being removed (removeChannel is async). A fresh topic per
// subscription guarantees a new, live channel.
export function uniqueTopic(base: string, now: number = Date.now(), random: number = Math.random()): string {
  return `${base}:${now}-${random.toString(36).slice(2, 8)}`;
}

// Status callback for channel.subscribe(): logs failures so a dead
// subscription doesn't go unnoticed.
export function logChannelFailures(label: string) {
  return (status: string, error?: Error) => {
    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      console.warn(`Realtime ${label}: ${status}`, error);
    }
  };
}
