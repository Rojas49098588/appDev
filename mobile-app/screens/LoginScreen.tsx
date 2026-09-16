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
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors } from '../constants/colors';
import { fonts } from '../constants/fonts';
import { useAuth } from '../context/AuthContext';
import TapeGutter from '../components/TapeGutter';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
  const { logIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    const account = await logIn(email, password);
    if (!account) {
      Alert.alert('Error', 'Incorrect email or password.');
      return;
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
            style={styles.flexOne}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.header}>
              <Text style={styles.wordmark}>Formation</Text>
              <Text style={styles.wordmarkSub}>Central High Band</Text>
            </View>

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
              <View style={styles.passwordLabelRow}>
                <Text style={styles.passwordFieldLabel}>Password</Text>
                <Pressable onPress={() => setShowPassword((prev) => !prev)}>
                  <Text style={styles.showLink}>{showPassword ? 'Hide' : 'Show'}</Text>
                </Pressable>
              </View>
              <TextInput
                style={styles.textInput}
                placeholder="Password"
                placeholderTextColor={colors.inkFaint}
                value={password}
                onChangeText={setPassword}
                autoCapitalize="none"
                secureTextEntry={!showPassword}
              />
            </View>

            <Pressable style={styles.submitButton} onPress={handleLogin}>
              <Text style={styles.submitButtonText}>Log in</Text>
            </Pressable>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <Pressable
              style={styles.createAccountRow}
              onPress={() => navigation.navigate('InviteCode')}
            >
              <Text style={styles.createAccountText}>
                New to Formation? <Text style={styles.createAccountLink}>Create an account</Text>
              </Text>
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  flexOne: { flex: 1 },
  appBody: { flex: 1, flexDirection: 'row' },
  content: { padding: 18, paddingTop: 72, paddingBottom: 28 },
  header: { alignItems: 'center', marginBottom: 36 },
  wordmark: { fontFamily: fonts.wordmark, fontSize: 26, color: colors.ink },
  wordmarkSub: { fontFamily: fonts.body, fontSize: 12.5, color: colors.inkSoft, marginTop: 4 },
  field: { marginBottom: 20 },
  fieldLabel: { fontFamily: fonts.body, fontSize: 11.5, color: colors.inkSoft, marginBottom: 7 },
  passwordLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 7,
  },
  passwordFieldLabel: { fontFamily: fonts.body, fontSize: 11.5, color: colors.inkSoft },
  showLink: {
    fontFamily: fonts.body,
    fontSize: 11.5,
    color: colors.inkSoft,
    textDecorationLine: 'underline',
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
  submitButton: { backgroundColor: colors.ink, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  submitButtonText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.paper },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 24 },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.line },
  dividerText: { fontFamily: fonts.body, fontSize: 11.5, color: colors.inkSoft, marginHorizontal: 12 },
  createAccountRow: { alignItems: 'center' },
  createAccountText: { fontFamily: fonts.body, fontSize: 13, color: colors.inkSoft },
  createAccountLink: {
    fontFamily: fonts.bodyMedium,
    color: colors.ink,
    textDecorationLine: 'underline',
  },
});
