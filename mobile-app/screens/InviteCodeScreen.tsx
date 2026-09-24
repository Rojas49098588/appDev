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
import TapeGutter from '../components/TapeGutter';
import { BackChevronIcon } from '../components/icons';
import { useScrollToInput } from '../hooks/useScrollToInput';

type Props = NativeStackScreenProps<RootStackParamList, 'InviteCode'>;

// Placeholder invite code — meant to rotate yearly; not implemented this pass.
const INVITE_CODE = '4F2K9';

export default function InviteCodeScreen({ navigation }: Props) {
  const [code, setCode] = useState('');
  const { scrollRef, handleScroll, scrollToFocusedInput } = useScrollToInput();

  const handleContinue = () => {
    if (code.trim().toUpperCase() !== INVITE_CODE) {
      Alert.alert('Error', 'Incorrect invite code.');
      return;
    }
    navigation.navigate('SignUp');
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
              <Pressable style={styles.headerSideButton} onPress={() => navigation.goBack()}>
                <BackChevronIcon color={colors.ink} />
              </Pressable>
            </View>

            <Text style={styles.title}>Join Mustang Closet</Text>
            <Text style={styles.subtitle}>Enter the invite code from your band director.</Text>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Invite code</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Invite code"
                placeholderTextColor={colors.inkFaint}
                value={code}
                onChangeText={setCode}
                onFocus={scrollToFocusedInput}
                autoCapitalize="characters"
              />
            </View>

            <Pressable style={styles.submitButton} onPress={handleContinue}>
              <Text style={styles.submitButtonText}>Continue</Text>
            </Pressable>

            <Text style={styles.hint}>Don't have a code? Contact your band director.</Text>
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
  content: { padding: 18, paddingBottom: 28 },
  header: { flexDirection: 'row', marginBottom: 40 },
  headerSideButton: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  title: {
    fontFamily: fonts.wordmark,
    fontSize: 22,
    color: colors.ink,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 12.5,
    color: colors.inkSoft,
    textAlign: 'center',
    marginBottom: 28,
  },
  field: { marginBottom: 20 },
  fieldLabel: {
    fontFamily: fonts.body,
    fontSize: 11.5,
    color: colors.inkSoft,
    marginBottom: 7,
    textAlign: 'center',
  },
  textInput: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingVertical: 12,
    paddingHorizontal: 13,
    fontFamily: fonts.mono,
    fontSize: 16,
    color: colors.ink,
    textAlign: 'center',
    letterSpacing: 2,
  },
  submitButton: { backgroundColor: colors.ink, paddingVertical: 14, alignItems: 'center' },
  submitButtonText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.paper },
  hint: {
    fontFamily: fonts.body,
    fontSize: 11.5,
    color: colors.inkFaint,
    textAlign: 'center',
    marginTop: 16,
  },
});
