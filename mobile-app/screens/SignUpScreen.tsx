import { useState } from 'react';
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
  type FocusEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { StatusBar } from 'expo-status-bar';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { INSTRUMENTS } from '../constants/instruments';
import { colors } from '../constants/colors';
import { fonts } from '../constants/fonts';
import { useAuth } from '../context/AuthContext';
import { useScrollToInput } from '../hooks/useScrollToInput';
import TapeGutter from '../components/TapeGutter';
import InstrumentWheel from '../components/InstrumentWheel';
import KeyboardDoneBar from '../components/KeyboardDoneBar';

type Props = NativeStackScreenProps<RootStackParamList, 'SignUp'>;

const isPlausibleEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

const digitsOnly = (text: string) => text.replace(/[^0-9]/g, '');

const isValidPassword = (value: string) =>
  value.length > 6 && /[A-Z]/.test(value) && /[0-9]/.test(value);

export default function SignUpScreen({ navigation }: Props) {
  const { signUp, accountExists } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [instrument, setInstrument] = useState(INSTRUMENTS[0]);
  const [heightFeet, setHeightFeet] = useState('');
  const [heightInches, setHeightInches] = useState('');
  const [weight, setWeight] = useState('');
  const [numericFocused, setNumericFocused] = useState(false);
  const { scrollRef, handleScroll, registerBottomInset, scrollToFocusedInput } = useScrollToInput();

  const focusNumericField = (event: FocusEvent) => {
    scrollToFocusedInput(event);
    setNumericFocused(true);
  };
  const blurNumericField = () => setNumericFocused(false);

  const handleSubmit = async () => {
    if (
      !email.trim() ||
      !password.trim() ||
      !confirmPassword.trim() ||
      !firstName.trim() ||
      !lastName.trim() ||
      !heightFeet.trim() ||
      !heightInches.trim() ||
      !weight.trim()
    ) {
      Alert.alert('Error', 'Please fill in all fields before continuing.');
      return;
    }

    if (!isPlausibleEmail(email)) {
      Alert.alert('Error', 'Please enter a valid email address.');
      return;
    }

    if (accountExists(email)) {
      Alert.alert('Account already exists', 'An account with this email already exists.');
      return;
    }

    if (!isValidPassword(password)) {
      Alert.alert(
        'Error',
        'Password must be longer than 6 characters and include a capital letter and a number.'
      );
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match.');
      return;
    }

    await signUp({
      email,
      password,
      firstName,
      lastName,
      instrument,
      role: 'Member',
      phone: '',
      shoeSize: { gender: "Men's", size: '' },
      height: { feet: heightFeet, inches: heightInches },
      weight,
    });

    const goToApp = () =>
      navigation.reset({
        index: 0,
        routes: [
          {
            name: 'MemberTabs',
            params: { firstName, lastName, instrument, role: 'Member' },
          },
        ],
      });

    Alert.alert('Account created', 'Please finish setting up your account under Profile.', [
      { text: 'OK', onPress: goToApp },
    ]);
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flexOne}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.appBody}>
          <TapeGutter />

          <View style={styles.contentColumn}>
            <ScrollView
              ref={scrollRef}
              style={styles.flexOne}
              contentContainerStyle={styles.content}
              onScroll={handleScroll}
              scrollEventThrottle={16}
            >
              <View style={styles.header}>
                {navigation.canGoBack() ? (
                  <Pressable style={styles.headerSideButton} onPress={() => navigation.goBack()}>
                    <Svg width={19} height={19} viewBox="0 0 24 24">
                      <Path
                        d="M15 5l-7 7 7 7"
                        stroke={colors.ink}
                        strokeWidth={1.8}
                        fill="none"
                      />
                    </Svg>
                  </Pressable>
                ) : (
                  <View style={styles.headerSideButton} />
                )}
                <Text style={styles.pageTitle}>Create account</Text>
                <View style={styles.headerSideButton} />
              </View>

              <Text style={styles.intro}>A few details before you join SMU Mustang Band.</Text>

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
                <Text style={styles.fieldLabel}>Height</Text>
                <View style={styles.heightRow}>
                  <TextInput
                    style={styles.heightInput}
                    placeholder="0"
                    placeholderTextColor={colors.inkFaint}
                    value={heightFeet}
                    onChangeText={(text) => setHeightFeet(digitsOnly(text).slice(0, 1))}
                    onFocus={focusNumericField}
                    onBlur={blurNumericField}
                    keyboardType="number-pad"
                    maxLength={1}
                  />
                  <Text style={styles.heightUnit}>'</Text>
                  <TextInput
                    style={styles.heightInput}
                    placeholder="0"
                    placeholderTextColor={colors.inkFaint}
                    value={heightInches}
                    onChangeText={(text) => setHeightInches(digitsOnly(text).slice(0, 2))}
                    onFocus={focusNumericField}
                    onBlur={blurNumericField}
                    keyboardType="number-pad"
                    maxLength={2}
                  />
                  <Text style={styles.heightUnit}>"</Text>
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Weight</Text>
                <View style={styles.weightRow}>
                  <TextInput
                    style={styles.weightInput}
                    placeholder="0"
                    placeholderTextColor={colors.inkFaint}
                    value={weight}
                    onChangeText={(text) => setWeight(digitsOnly(text).slice(0, 3))}
                    onFocus={focusNumericField}
                    onBlur={blurNumericField}
                    keyboardType="number-pad"
                    maxLength={3}
                  />
                  <Text style={styles.heightUnit}>lbs</Text>
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Password</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Password"
                  placeholderTextColor={colors.inkFaint}
                  value={password}
                  onChangeText={setPassword}
                  onFocus={scrollToFocusedInput}
                  autoCapitalize="none"
                  secureTextEntry
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Confirm password</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Confirm password"
                  placeholderTextColor={colors.inkFaint}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  onFocus={scrollToFocusedInput}
                  autoCapitalize="none"
                  secureTextEntry
                />
              </View>

              <View style={styles.nameRow}>
                <View style={[styles.field, styles.nameField]}>
                  <Text style={styles.fieldLabel}>First name</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="First name"
                    placeholderTextColor={colors.inkFaint}
                    value={firstName}
                    onChangeText={setFirstName}
                    onFocus={scrollToFocusedInput}
                  />
                </View>
                <View style={[styles.field, styles.nameField]}>
                  <Text style={styles.fieldLabel}>Last name</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Last name"
                    placeholderTextColor={colors.inkFaint}
                    value={lastName}
                    onChangeText={setLastName}
                    onFocus={scrollToFocusedInput}
                  />
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Instrument</Text>
                <InstrumentWheel options={INSTRUMENTS} value={instrument} onChange={setInstrument} />
              </View>
            </ScrollView>

            <View onLayout={registerBottomInset}>
              <KeyboardDoneBar visible={numericFocused} />

              <View style={styles.footer}>
                <Pressable style={styles.submitButton} onPress={handleSubmit}>
                  <Text style={styles.submitButtonText}>Create account</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>

        <StatusBar style="auto" />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  flexOne: {
    flex: 1,
  },
  appBody: {
    flex: 1,
    flexDirection: 'row',
  },
  contentColumn: {
    flex: 1,
    flexDirection: 'column',
  },
  content: {
    paddingTop: 16,
    paddingHorizontal: 18,
    paddingBottom: 28,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 6,
  },
  headerSideButton: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fonts.wordmark,
    fontSize: 18,
    color: colors.ink,
  },
  intro: {
    fontFamily: fonts.body,
    fontSize: 12.5,
    color: colors.inkSoft,
    marginTop: 2,
    marginBottom: 26,
  },
  field: {
    marginBottom: 22,
  },
  nameRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 22,
  },
  nameField: {
    flex: 1,
    marginBottom: 0,
  },
  fieldLabel: {
    fontFamily: fonts.body,
    fontSize: 11.5,
    color: colors.inkSoft,
    marginBottom: 7,
  },
  textInput: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingVertical: 12,
    paddingHorizontal: 13,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.ink,
  },
  heightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heightInput: {
    width: 56,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingVertical: 12,
    paddingHorizontal: 13,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.ink,
    textAlign: 'center',
  },
  heightUnit: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.ink,
  },
  weightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  weightInput: {
    width: 70,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingVertical: 12,
    paddingHorizontal: 13,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.ink,
    textAlign: 'center',
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 10,
  },
  submitButton: {
    backgroundColor: colors.ink,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitButtonText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.paper,
  },
});
