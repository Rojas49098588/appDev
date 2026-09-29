import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { useNetworkState } from 'expo-network';

export function useConnection(): { isOnline: boolean } {
  const state = useNetworkState();
  // isInternetReachable is undefined until the first check finishes; treat
  // "unknown" as online so launch isn't blocked.
  const isOnline = state.isInternetReachable ?? state.isConnected ?? true;
  return { isOnline };
}

// Calls `callback` each time the connection comes back (offline → online).
export function useOnReconnect(callback: () => void): void {
  const { isOnline } = useConnection();
  const wasOnline = useRef(isOnline);
  const latestCallback = useRef(callback);
  latestCallback.current = callback;

  useEffect(() => {
    if (isOnline && !wasOnline.current) latestCallback.current();
    wasOnline.current = isOnline;
  }, [isOnline]);
}

// Guard for edit actions: shows an alert and returns false when offline.
export function requireOnline(isOnline: boolean): boolean {
  if (!isOnline) {
    Alert.alert("You're offline", 'Connect to the internet to make changes.');
  }
  return isOnline;
}

// Style for edit controls while offline.
export const OFFLINE_DIM = { opacity: 0.4 } as const;
