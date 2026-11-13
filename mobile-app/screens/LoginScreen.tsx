import { useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useTheme, useThemedStyles, type Theme } from '../hooks/useTheme';
import { fonts } from '../constants/fonts';
import { useAuth } from '../context/AuthContext';
import { friendlyError } from '../lib/errors';
import { useScrollToInput } from '../hooks/useScrollToInput';
import TapeGutter from '../components/TapeGutter';
import OutlineButton from '../components/OutlineButton';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { logIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { scrollRef, handleScroll, scrollToFocusedInput } = useScrollToInput();

  const handleLogin = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    let account;
    try {
      account = await logIn(email, password);
    } catch (error) {
      Alert.alert('Error', friendlyError(error));
      return;
    } finally {
      setIsSubmitting(false);
    }
    navigation.reset({
      index: 0,
      routes: [
        {
          name: account.role === 'Staff' ? 'MainTabs' : 'MemberTabs',
          params: {
            firstName: account.firstName,
            lastName: account.lastName,
            instrument: account.instrument,
            role: account.role,
          },
        },
      ],
    });
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flexOne}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.appBody}>
          <TapeGutter />
          <ScrollView
            ref={scrollRef}
            style={styles.flexOne}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            onScroll={handleScroll}
            scrollEventThrottle={16}
          >
            <View style={styles.header}>
              <Image
                source={require('../assets/band_M.jpg')}
                style={styles.bandImage}
                resizeMode="contain"
              />
              <Text style={styles.wordmark}>Mustang Closet</Text>
              <Text style={styles.wordmarkSub}>SMU Mustang Band</Text>
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Email</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Email"
                placeholderTextColor={colors.inkFaint}
                value={email}
                onChangeText={setEmail}
                onFocus={scrollToFocusedInput}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>

            <View style={styles.field}>
              <View style={styles.passwordLabelRow}>
                <Text style={styles.passwordFieldLabel}>Password</Text>
                <OutlineButton
                  label={showPassword ? 'Hide' : 'Show'}
                  accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                  onPress={() => setShowPassword((prev) => !prev)}
                />
              </View>
              <TextInput
                style={styles.textInput}
                placeholder="Password"
                placeholderTextColor={colors.inkFaint}
                value={password}
                onChangeText={setPassword}
                onFocus={scrollToFocusedInput}
                autoCapitalize="none"
                secureTextEntry={!showPassword}
              />
              <OutlineButton
                label="Forgot password?"
                style={styles.forgotRow}
                onPress={() => navigation.navigate('ForgotPassword', { email: email.trim() || undefined })}
              />
            </View>

            <Pressable
              style={[styles.submitButton, isSubmitting && styles.submitButtonBusy]}
              onPress={handleLogin}
              disabled={isSubmitting}
            >
              <Text style={styles.submitButtonText}>Log in</Text>
            </Pressable>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.createAccountRow}>
              <Text style={styles.createAccountText}>New to Mustang Closet?</Text>
              <OutlineButton
                label="Create an account"
                style={styles.createAccountButton}
                onPress={() => navigation.navigate('InviteCode')}
              />
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: t.colors.paper },
  flexOne: { flex: 1 },
  appBody: { flex: 1, flexDirection: 'row' },
  content: { padding: 18, paddingTop: 40, paddingBottom: 28 },
  header: { alignItems: 'center', marginBottom: 36 },
  bandImage: { width: 160, height: 133, marginBottom: 14 },
  wordmark: { fontFamily: fonts.wordmark, fontSize: t.font(26), color: t.colors.ink },
  wordmarkSub: { fontFamily: fonts.body, fontSize: t.font(12.5), color: t.colors.inkSoft, marginTop: 4 },
  field: { marginBottom: 20 },
  fieldLabel: { fontFamily: fonts.body, fontSize: t.font(11.5), color: t.colors.inkSoft, marginBottom: 7 },
  passwordLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 7,
  },
  passwordFieldLabel: { fontFamily: fonts.body, fontSize: t.font(11.5), color: t.colors.inkSoft },
  forgotRow: { alignSelf: 'flex-end', marginTop: 8 },
  textInput: {
    borderWidth: 1,
    borderColor: t.colors.line,
    backgroundColor: t.colors.surface,
    paddingVertical: 12,
    paddingHorizontal: 13,
    fontFamily: fonts.body,
    fontSize: t.font(14),
    color: t.colors.ink,
  },
  submitButton: { backgroundColor: t.colors.ink, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  submitButtonBusy: { opacity: 0.5 },
  submitButtonText: { fontFamily: fonts.bodyMedium, fontSize: t.font(14), color: t.colors.paper },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 24 },
  dividerLine: { flex: 1, height: 1, backgroundColor: t.colors.line },
  dividerText: { fontFamily: fonts.body, fontSize: t.font(11.5), color: t.colors.inkSoft, marginHorizontal: 12 },
  createAccountRow: { alignItems: 'center' },
  createAccountText: { fontFamily: fonts.body, fontSize: t.font(13), color: t.colors.inkSoft },
  createAccountButton: { alignSelf: 'center', marginTop: 8 },
});
}
