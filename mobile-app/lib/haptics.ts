import * as Haptics from 'expo-haptics';

// One short buzz after a save goes through. Fire-and-forget: a device
// that can't buzz (or has haptics turned off) must never break a save.
export function successBuzz(): void {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}
