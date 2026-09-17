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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { StatusBar } from 'expo-status-bar';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList, Role } from '../navigation/types';
import { INSTRUMENTS } from '../constants/instruments';
import { colors } from '../constants/colors';
import { fonts } from '../constants/fonts';
import { useAuth } from '../context/AuthContext';
import TapeGutter from '../components/TapeGutter';
import InstrumentWheel from '../components/InstrumentWheel';

type Props = NativeStackScreenProps<RootStackParamList, 'SignUp'>;

// Placeholder staff access code — will be replaced by a real code later.
const STAFF_ACCESS_CODE = '1234';

const isPlausibleEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

const isPlausiblePhone = (value: string) => {
  const digits = value.replace(/\D/g, '');
  return digits.length === 10 || (digits.length === 11 && digits.startsWith('1'));
};

const isValidPassword = (value: string) =>
  value.length > 6 && /[A-Z]/.test(value) && /[0-9]/.test(value);

export default function SignUpScreen({ navigation }: Props) {
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [instrument, setInstrument] = useState(INSTRUMENTS[0]);
  const [role, setRole] = useState<Role>('Member');
  const [staffCode, setStaffCode] = useState('');

  const handleSubmit = async () => {
    if (
      !email.trim() ||
      !phone.trim() ||
      !password.trim() ||
      !confirmPassword.trim() ||
      !firstName.trim() ||
      !lastName.trim()
    ) {
      Alert.alert('Error', 'Please fill in all fields before continuing.');
      return;
    }

    if (!isPlausibleEmail(email)) {
      Alert.alert('Error', 'Please enter a valid email address.');
      return;
    }

    if (!isPlausiblePhone(phone)) {
      Alert.alert('Error', 'Please enter a valid phone number.');
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

    if (role === 'Staff' && staffCode !== STAFF_ACCESS_CODE) {
      Alert.alert('Error', 'Incorrect staff code.');
      return;
    }

    await signUp({
      email,
      password,
      firstName,
      lastName,
      instrument,
      role,
      phone,
      shoeSize: { gender: "Men's", size: '' },
    });
    navigation.reset({
      index: 0,
      routes: [
        {
          name: role === 'Staff' ? 'MainTabs' : 'MemberTabs',
          params: { firstName, lastName, instrument, role },
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

          <View style={styles.contentColumn}>
            <ScrollView style={styles.flexOne} contentContainerStyle={styles.content}>
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

              <Text style={styles.intro}>A few details before you join Central High Band.</Text>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Email</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Email"
                  placeholderTextColor={colors.inkFaint}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Phone number</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Phone number"
                  placeholderTextColor={colors.inkFaint}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Password</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Password"
                  placeholderTextColor={colors.inkFaint}
                  value={password}
                  onChangeText={setPassword}
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
                  />
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Instrument</Text>
                <InstrumentWheel options={INSTRUMENTS} value={instrument} onChange={setInstrument} />
              </View>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Role</Text>
                <View style={styles.segmented}>
                  {(['Member', 'Staff'] as Role[]).map((option, index) => {
                    const active = role === option;
                    return (
                      <Pressable
                        key={option}
                        style={[
                          styles.segment,
                          active && styles.segmentActive,
                          index === 0 && styles.segmentBorderRight,
                        ]}
                        onPress={() => setRole(option)}
                      >
                        <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                          {option}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {role === 'Staff' && (
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Staff code</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Staff code"
                    placeholderTextColor={colors.inkFaint}
                    value={staffCode}
                    onChangeText={setStaffCode}
                    keyboardType="number-pad"
                    secureTextEntry
                  />
                </View>
              )}
            </ScrollView>

            <View style={styles.footer}>
              <Pressable style={styles.submitButton} onPress={handleSubmit}>
                <Text style={styles.submitButtonText}>Create account</Text>
              </Pressable>
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
  segmented: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.ink,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    backgroundColor: colors.surface,
  },
  segmentBorderRight: {
    borderRightWidth: 1,
    borderRightColor: colors.ink,
  },
  segmentActive: {
    backgroundColor: colors.ink,
  },
  segmentText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13.5,
    color: colors.ink,
  },
  segmentTextActive: {
    color: colors.paper,
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
