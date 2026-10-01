import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const isConfigured = !!url && !!anonKey;

// Set when the build is missing its Supabase settings (e.g. an EAS build
// without the EXPO_PUBLIC_* environment variables). App.tsx shows a message
// instead of the app, so nothing ever talks to the placeholder client below.
export const supabaseConfigError: string | null = isConfigured
  ? null
  : 'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY.';

// With missing config the client gets inert placeholder values (and never
// persists or refreshes a session), so importing this module can't crash.
export const supabase = createClient(
  isConfigured ? url! : 'https://missing-config.invalid',
  isConfigured ? anonKey! : 'missing-anon-key',
  {
    auth: {
      storage: AsyncStorage,
      persistSession: isConfigured,
      autoRefreshToken: isConfigured,
      detectSessionInUrl: false,
    },
  }
);

// True when there's a usable signed-in session. While auth-js is cooling down
// after a failed token refresh (e.g. just back online after a long time),
// there's none, and queries would silently run as anon and return nothing
// under RLS; callers skip fetching then, and refetch on TOKEN_REFRESHED.
export async function hasSession(): Promise<boolean> {
  const { data } = await supabase.auth.getSession();
  return !!data.session;
}

// Only refresh the session while the app is in the foreground, as Supabase
// recommends for React Native.
if (isConfigured && Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}
