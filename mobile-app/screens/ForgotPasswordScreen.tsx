import { useEffect, useRef, useState } from 'react';
import {
  Alert,
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
import TapeGutter from '../components/TapeGutter';
import KeyboardDoneBar from '../components/KeyboardDoneBar';
import OutlineButton from '../components/OutlineButton';
import { BackChevronIcon } from '../components/icons';
import { useScrollToInput } from '../hooks/useScrollToInput';
import { useAuth } from '../context/AuthContext';
import { friendlyError } from '../lib/errors';
import { cleanResetCode, resetFormProblem } from '../lib/passwordReset';

type Props = NativeStackScreenProps<RootStackParamList, 'ForgotPassword'>;

// Step 1 asks for the email and sends a code. Step 2 takes the code and the
// new password, then signs them in.
export default function ForgotPasswordScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { sendPasswordResetCode, verifyPasswordResetCode, finishPasswordReset, cancelPasswordReset } = useAuth();
  const { scrollRef, handleScroll, registerBottomInset, scrollToFocusedInput } = useScrollToInput();

  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState(route.params?.email?.trim() ?? '');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [codeFocused, setCodeFocused] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  // The code was accepted (which signs them in) but no password is saved yet.
  // A retry after a rejected password skips the code; leaving signs them out.
  const verifiedRef = useRef(false);
  const finishedRef = useRef(false);
  useEffect(
    () => () => {
      if (verifiedRef.current && !finishedRef.current) void cancelPasswordReset();
    },
    [cancelPasswordReset]
  );

  const sendCode = async () => {
    if (isBusy) return;
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email.');
      return;
    }
    setIsBusy(true);
    try {
      await sendPasswordResetCode(email);
      setStep('code');
    } catch (error) {
      Alert.alert('Error', friendlyError(error));
    } finally {
      setIsBusy(false);
    }
  };

  const resendCode = async () => {
    if (isBusy) return;
    setIsBusy(true);
    try {
      await sendPasswordResetCode(email);
      Alert.alert('Code sent', 'Check your email for a new code. Only the newest code works.');
    } catch (error) {
      Alert.alert('Error', friendlyError(error));
    } finally {
      setIsBusy(false);
    }
  };

  const switchEmail = async () => {
    if (verifiedRef.current) {
      verifiedRef.current = false;
      await cancelPasswordReset();
    }
    setCode('');
    setStep('email');
  };

  const savePassword = async () => {
    if (isBusy) return;
    const problem = resetFormProblem(verifiedRef.current ? null : code, password, confirmPassword);
    if (problem) {
      Alert.alert('Error', problem);
      return;
    }
    setIsBusy(true);
    let account;
    try {
      if (!verifiedRef.current) {
        await verifyPasswordResetCode(email, cleanResetCode(code));
        verifiedRef.current = true;
      }
      account = await finishPasswordReset(password);
      finishedRef.current = true;
    } catch (error) {
      Alert.alert('Error', friendlyError(error));
      return;
    } finally {
      setIsBusy(false);
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
          <View style={styles.flexOne}>
            <ScrollView
              ref={scrollRef}
              style={styles.flexOne}
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps="handled"
              onScroll={handleScroll}
              scrollEventThrottle={16}
            >
              <View style={styles.header}>
                <Pressable style={styles.headerSideButton} onPress={() => navigation.goBack()}>
                  <BackChevronIcon color={colors.ink} />
                </Pressable>
              </View>

              <Text style={styles.title}>Reset your password</Text>

              {step === 'email' ? (
                <>
                  <Text style={styles.subtitle}>
                    Enter your account email and we'll send you a code.
                  </Text>

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
                      autoComplete="email"
                      keyboardType="email-address"
                    />
                  </View>

                  <Pressable
                    style={[styles.submitButton, isBusy && styles.submitButtonBusy]}
                    onPress={sendCode}
                    disabled={isBusy}
                  >
                    <Text style={styles.submitButtonText}>Send code</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Text style={styles.subtitle}>
                    If {email.trim()} has an account, we sent it a code. It can take a
                    minute to arrive, so check your spam folder too.
                  </Text>

                  <View style={styles.field}>
                    <Text style={styles.fieldLabel}>Code</Text>
                    <TextInput
                      style={[styles.textInput, styles.codeInput]}
                      placeholder="Code"
                      placeholderTextColor={colors.inkFaint}
                      value={code}
                      onChangeText={setCode}
                      onFocus={(event) => {
                        setCodeFocused(true);
                        scrollToFocusedInput(event);
                      }}
                      onBlur={() => setCodeFocused(false)}
                      keyboardType="number-pad"
                      textContentType="oneTimeCode"
                      autoComplete="one-time-code"
                      maxLength={12}
                    />
                  </View>

                  <View style={styles.field}>
                    <View style={styles.passwordLabelRow}>
                      <Text style={styles.passwordFieldLabel}>New password</Text>
                      <OutlineButton
                        label={showPassword ? 'Hide' : 'Show'}
                        accessibilityLabel={showPassword ? 'Hide passwords' : 'Show passwords'}
                        onPress={() => setShowPassword((prev) => !prev)}
                      />
                    </View>
                    <TextInput
                      style={styles.textInput}
                      placeholder="New password"
                      placeholderTextColor={colors.inkFaint}
                      value={password}
                      onChangeText={setPassword}
                      onFocus={scrollToFocusedInput}
                      autoCapitalize="none"
                      autoComplete="new-password"
                      textContentType="newPassword"
                      secureTextEntry={!showPassword}
                    />
                  </View>

                  <View style={styles.field}>
                    <Text style={styles.fieldLabel}>Confirm new password</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="Confirm new password"
                      placeholderTextColor={colors.inkFaint}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      onFocus={scrollToFocusedInput}
                      autoCapitalize="none"
                      autoComplete="new-password"
                      textContentType="newPassword"
                      secureTextEntry={!showPassword}
                    />
                  </View>

                  <Pressable
                    style={[styles.submitButton, isBusy && styles.submitButtonBusy]}
                    onPress={savePassword}
                    disabled={isBusy}
                  >
                    <Text style={styles.submitButtonText}>Save new password</Text>
                  </Pressable>

                  <View style={styles.linkRow}>
                    <OutlineButton label="Send a new code" onPress={resendCode} disabled={isBusy} />
                    <OutlineButton label="Use a different email" onPress={switchEmail} disabled={isBusy} />
                  </View>
                </>
              )}
            </ScrollView>
            <View onLayout={registerBottomInset}>
              <KeyboardDoneBar visible={codeFocused} />
            </View>
          </View>
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
  content: { padding: 18, paddingBottom: 28 },
  header: { flexDirection: 'row', marginBottom: 40 },
  headerSideButton: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  title: {
    fontFamily: fonts.wordmark,
    fontSize: t.font(22),
    color: t.colors.ink,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: t.font(12.5),
    color: t.colors.inkSoft,
    textAlign: 'center',
    marginBottom: 28,
  },
  field: { marginBottom: 20 },
  fieldLabel: { fontFamily: fonts.body, fontSize: t.font(11.5), color: t.colors.inkSoft, marginBottom: 7 },
  passwordLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 7,
  },
  passwordFieldLabel: { fontFamily: fonts.body, fontSize: t.font(11.5), color: t.colors.inkSoft },
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
  codeInput: { fontFamily: fonts.mono, fontSize: t.font(16), textAlign: 'center', letterSpacing: 4 },
  submitButton: { backgroundColor: t.colors.ink, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  submitButtonBusy: { opacity: 0.5 },
  submitButtonText: { fontFamily: fonts.bodyMedium, fontSize: t.font(14), color: t.colors.paper },
  linkRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10, marginTop: 18 },
});
}
