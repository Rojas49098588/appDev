import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
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
import TapeGutter from '../components/TapeGutter';
import InstrumentWheel from '../components/InstrumentWheel';

type Props = NativeStackScreenProps<RootStackParamList, 'SignUp'>;

// Placeholder staff access code — will be replaced by a real code later.
const STAFF_ACCESS_CODE = '1234';

export default function SignUpScreen({ navigation }: Props) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [instrument, setInstrument] = useState(INSTRUMENTS[0]);
  const [role, setRole] = useState<Role>('Member');
  const [showAccessCodeModal, setShowAccessCodeModal] = useState(false);
  const [accessCode, setAccessCode] = useState('');

  const goToHome = (confirmedRole: Role) => {
    navigation.reset({
      index: 0,
      routes: [
        { name: 'MainTabs', params: { firstName, lastName, instrument, role: confirmedRole } },
      ],
    });
  };

  const handleSubmit = () => {
    if (role === 'Staff') {
      setShowAccessCodeModal(true);
      return;
    }
    goToHome(role);
  };

  const handleAccessCodeCancel = () => {
    setShowAccessCodeModal(false);
    setAccessCode('');
  };

  const handleAccessCodeConfirm = () => {
    setShowAccessCodeModal(false);
    if (accessCode === STAFF_ACCESS_CODE) {
      setAccessCode('');
      goToHome('Staff');
    } else {
      setAccessCode('');
      Alert.alert('Error', 'Incorrect access code.');
    }
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
            </ScrollView>

            <View style={styles.footer}>
              <Pressable style={styles.submitButton} onPress={handleSubmit}>
                <Text style={styles.submitButtonText}>Create account</Text>
              </Pressable>
            </View>
          </View>
        </View>

        <Modal
          visible={showAccessCodeModal}
          transparent
          animationType="fade"
          onRequestClose={handleAccessCodeCancel}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Enter Access Code</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Access Code"
                placeholderTextColor={colors.inkFaint}
                value={accessCode}
                onChangeText={setAccessCode}
                keyboardType="number-pad"
                secureTextEntry
              />
              <View style={styles.modalButtonRow}>
                <Pressable style={styles.modalCancelButton} onPress={handleAccessCodeCancel}>
                  <Text style={styles.modalCancelButtonText}>Cancel</Text>
                </Pressable>
                <Pressable style={styles.modalConfirmButton} onPress={handleAccessCodeConfirm}>
                  <Text style={styles.modalConfirmButtonText}>Confirm</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(34, 32, 29, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContent: {
    width: '85%',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 20,
  },
  modalTitle: {
    fontFamily: fonts.blockTitle,
    fontSize: 18,
    color: colors.ink,
    marginBottom: 16,
    textAlign: 'center',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paper,
    paddingVertical: 12,
    paddingHorizontal: 13,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.ink,
    marginBottom: 16,
  },
  modalButtonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalCancelButtonText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.ink,
  },
  modalConfirmButton: {
    flex: 1,
    backgroundColor: colors.ink,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalConfirmButtonText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.paper,
  },
});
