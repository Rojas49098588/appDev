import { useCallback, useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { SpaceGrotesk_600SemiBold } from '@expo-google-fonts/space-grotesk';
import {
  IBMPlexSans_400Regular,
  IBMPlexSans_500Medium,
  IBMPlexSans_600SemiBold,
} from '@expo-google-fonts/ibm-plex-sans';
import { IBMPlexMono_400Regular, IBMPlexMono_500Medium } from '@expo-google-fonts/ibm-plex-mono';
import LoginScreen from './screens/LoginScreen';
import InviteCodeScreen from './screens/InviteCodeScreen';
import SignUpScreen from './screens/SignUpScreen';
import MainTabs from './screens/MainTabs';
import MemberTabs from './screens/MemberTabs';
import MemberAccountScreen from './screens/member/MemberAccountScreen';
import FlagItemScreen from './screens/member/FlagItemScreen';
import ProfileScreen from './screens/ProfileScreen';
import MemberProfileScreen from './screens/MemberProfileScreen';
import AddComboScreen from './screens/AddComboScreen';
import ComboDetailScreen from './screens/ComboDetailScreen';
import type { RootStackParamList, Role } from './navigation/types';
import { FlagsProvider } from './context/FlagsContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { GameProvider } from './context/GameContext';
import { CombosProvider } from './context/CombosContext';
import { supabaseConfigError } from './lib/supabase';
import { colors } from './constants/colors';
import { fonts } from './constants/fonts';

SplashScreen.preventAutoHideAsync();

const Stack = createNativeStackNavigator<RootStackParamList>();

const navigationRef = createNavigationContainerRef<RootStackParamList>();

function AppNavigator({ onReady }: { onReady: () => void }) {
  const { session, isLoading } = useAuth();

  // When your role changes while the app is open (a staff member promoted or
  // demoted you), jump to the matching tabs. Login/logout already navigate
  // on their own; this only handles changes that arrive via Realtime.
  const previousRole = useRef<Role | null>(null);
  useEffect(() => {
    const role = session?.role ?? null;
    const previous = previousRole.current;
    previousRole.current = role;
    if (!navigationRef.isReady() || previous === role) return;
    if (previous && role && session) {
      navigationRef.reset({
        index: 0,
        routes: [{ name: role === 'Staff' ? 'MainTabs' : 'MemberTabs', params: session }],
      });
    } else if (previous && !role) {
      navigationRef.reset({ index: 0, routes: [{ name: 'Login' }] });
    }
  }, [session]);

  if (isLoading) {
    return null;
  }

  const initialRouteName = !session
    ? 'Login'
    : session.role === 'Staff'
      ? 'MainTabs'
      : 'MemberTabs';

  return (
    <View style={{ flex: 1 }} onLayout={onReady}>
      <NavigationContainer ref={navigationRef}>
        <Stack.Navigator initialRouteName={initialRouteName}>
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
          <Stack.Screen
            name="InviteCode"
            component={InviteCodeScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen name="SignUp" component={SignUpScreen} options={{ headerShown: false }} />
          <Stack.Screen
            name="MainTabs"
            component={MainTabs}
            options={{ headerShown: false }}
            initialParams={session && session.role === 'Staff' ? session : undefined}
          />
          <Stack.Screen
            name="MemberTabs"
            component={MemberTabs}
            options={{ headerShown: false }}
            initialParams={session && session.role === 'Member' ? session : undefined}
          />
          <Stack.Screen
            name="MemberAccount"
            component={MemberAccountScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="FlagItem"
            component={FlagItemScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen name="Profile" component={ProfileScreen} options={{ headerShown: false }} />
          <Stack.Screen
            name="MemberProfile"
            component={MemberProfileScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="AddCombo"
            component={AddComboScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="ComboDetail"
            component={ComboDetailScreen}
            options={{ headerShown: false }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </View>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    SpaceGrotesk_600SemiBold,
    IBMPlexSans_400Regular,
    IBMPlexSans_500Medium,
    IBMPlexSans_600SemiBold,
    IBMPlexMono_400Regular,
    IBMPlexMono_500Medium,
  });

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  // A build without its Supabase settings can't do anything useful; say so
  // instead of crashing. The providers below never mount, so nothing calls
  // Supabase.
  if (supabaseConfigError) {
    return (
      <View style={styles.configError} onLayout={onLayoutRootView}>
        <Text style={styles.configErrorText}>
          App is missing its Supabase settings. See HANDOFF.md → Supabase setup.
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <FlagsProvider>
          <GameProvider>
            <CombosProvider>
              <AppNavigator onReady={onLayoutRootView} />
            </CombosProvider>
          </GameProvider>
        </FlagsProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  configError: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: colors.paper,
  },
  configErrorText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 16,
    lineHeight: 24,
    color: colors.ink,
    textAlign: 'center',
  },
});
