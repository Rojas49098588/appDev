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

// Realtime can drop events under a burst (an import writes ~1000 rows), and a dropped
// event is never replayed. A big batch is refetched instead of merged event by event.
export const BURST_RELOAD_THRESHOLD = 50;

export function shouldReloadForBatch(eventCount: number): boolean {
  return eventCount > BURST_RELOAD_THRESHOLD;
}

// Whether a channel status means events may have been missed: a failure, or a
// SUBSCRIBED after the first one (the channel reconnected).
export function channelStatusAction(
  status: string,
  subscribedBefore: boolean
): { reload: boolean; subscribedBefore: boolean } {
  if (status === 'SUBSCRIBED') return { reload: subscribedBefore, subscribedBefore: true };
  if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') return { reload: true, subscribedBefore };
  return { reload: false, subscribedBefore };
}

// Status callback for channel.subscribe(): logs failures so a dead subscription
// doesn't go unnoticed, and calls `onReload` when events may have been missed.
export function logChannelFailures(label: string, onReload?: () => void) {
  let subscribedBefore = false;
  return (status: string, error?: Error) => {
    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      console.warn(`Realtime ${label}: ${status}`, error);
    }
    const action = channelStatusAction(status, subscribedBefore);
    subscribedBefore = action.subscribedBefore;
    if (action.reload) onReload?.();
  };
}
