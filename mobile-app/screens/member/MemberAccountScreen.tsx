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
import { Picker } from '@react-native-picker/picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { useAuth } from '../../context/AuthContext';
import { INSTRUMENTS } from '../../constants/instruments';
import { colors } from '../../constants/colors';
import { fonts } from '../../constants/fonts';
import { useScrollToInput } from '../../hooks/useScrollToInput';
import TapeGutter from '../../components/TapeGutter';
import KeyboardDoneBar from '../../components/KeyboardDoneBar';
import { BackChevronIcon } from '../../components/icons';

type Props = NativeStackScreenProps<RootStackParamList, 'MemberAccount'>;

const TEXT_FIELDS: {
  key: 'firstName' | 'lastName' | 'email' | 'phone';
  label: string;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
}[] = [
  { key: 'firstName', label: 'First Name' },
  { key: 'lastName', label: 'Last Name' },
  { key: 'email', label: 'Email', keyboardType: 'email-address' },
  { key: 'phone', label: 'Phone Number', keyboardType: 'phone-pad' },
];

const digitsOnly = (text: string) => text.replace(/[^0-9]/g, '');

const isPlausiblePhone = (value: string) => {
  const digits = value.replace(/\D/g, '');
  return digits.length === 10 || (digits.length === 11 && digits.startsWith('1'));
};

export default function MemberAccountScreen({ navigation, route }: Props) {
  const { account, updateAccount, logOut } = useAuth();
  const role = account?.role ?? route.params.role;

  const [isEditing, setIsEditing] = useState(false);
  const [firstName, setFirstName] = useState(account?.firstName ?? route.params.firstName);
  const [lastName, setLastName] = useState(account?.lastName ?? route.params.lastName);
  const [email, setEmail] = useState(account?.email ?? '');
  const [phone, setPhone] = useState(account?.phone ?? '');
  const [instrument, setInstrument] = useState(account?.instrument ?? route.params.instrument);
  const [shoeGender, setShoeGender] = useState<"Men's" | "Women's">(
    account?.shoeSize.gender ?? "Men's"
  );
  const [shoeSizeValue, setShoeSizeValue] = useState(account?.shoeSize.size ?? '');
  const [heightFeet, setHeightFeet] = useState(account?.height.feet ?? '');
  const [heightInches, setHeightInches] = useState(account?.height.inches ?? '');
  const [weight, setWeight] = useState(account?.weight ?? '');
  const [numericFocused, setNumericFocused] = useState(false);
  const { scrollRef, handleScroll, registerBottomInset, scrollToFocusedInput } = useScrollToInput();

  const focusNumericField = (event: FocusEvent) => {
    scrollToFocusedInput(event);
    setNumericFocused(true);
  };
  const blurNumericField = () => setNumericFocused(false);

  const fieldValues: Record<'firstName' | 'lastName' | 'email' | 'phone', string> = {
    firstName,
    lastName,
    email,
    phone,
  };
  const fieldSetters: Record<'firstName' | 'lastName' | 'email' | 'phone', (text: string) => void> = {
    firstName: setFirstName,
    lastName: setLastName,
    email: setEmail,
    phone: setPhone,
  };

  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  const hasHeight = heightFeet !== '' || heightInches !== '';

  const handleToggleEdit = () => {
    if (isEditing) {
      if (phone.trim() !== '' && !isPlausiblePhone(phone)) {
        Alert.alert('Error', 'Please enter a valid phone number.');
        return;
      }

      updateAccount({
        firstName,
        lastName,
        email,
        phone,
        instrument,
        shoeSize: { gender: shoeGender, size: shoeSizeValue },
        height: { feet: heightFeet, inches: heightInches },
        weight,
      });
    }
    setIsEditing((prev) => !prev);
  };

  const handleLogOut = () => {
    logOut();
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
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
            <Pressable style={styles.headerSideButton} onPress={() => navigation.goBack()}>
              <BackChevronIcon color={colors.ink} />
            </Pressable>
            <Text style={styles.pageTitle}>Account</Text>
            <View style={styles.headerSideButton} />
          </View>

          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>

          <Text style={styles.roleBadge}>{role}</Text>

          {TEXT_FIELDS.map((field) => {
            const isNumericKeyboard = field.keyboardType === 'phone-pad';
            return (
              <ProfileField
                key={field.key}
                label={field.label}
                value={fieldValues[field.key]}
                editing={isEditing}
                keyboardType={field.keyboardType}
                onChangeText={fieldSetters[field.key]}
                onFocus={isNumericKeyboard ? focusNumericField : scrollToFocusedInput}
                onBlur={isNumericKeyboard ? blurNumericField : undefined}
              />
            );
          })}

          <View style={styles.fieldWrapper}>
            <Text style={styles.label}>Instrument</Text>
            {isEditing ? (
              <View style={styles.pickerWrapper}>
                <Picker selectedValue={instrument} onValueChange={setInstrument}>
                  {INSTRUMENTS.map((option) => (
                    <Picker.Item key={option} label={option} value={option} />
                  ))}
                </Picker>
              </View>
            ) : (
              <Text style={styles.value}>{instrument}</Text>
            )}
          </View>

          <View style={styles.fieldWrapper}>
            <Text style={styles.label}>Shoe Size</Text>
            {isEditing ? (
              <View style={styles.shoeRow}>
                <View style={styles.segmented}>
                  {(["Men's", "Women's"] as const).map((option, index) => {
                    const active = shoeGender === option;
                    return (
                      <Pressable
                        key={option}
                        style={[
                          styles.segment,
                          active && styles.segmentActive,
                          index === 0 && styles.segmentBorderRight,
                        ]}
                        onPress={() => setShoeGender(option)}
                      >
                        <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                          {option}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <TextInput
                  style={styles.shoeSizeInput}
                  value={shoeSizeValue}
                  onChangeText={setShoeSizeValue}
                  onFocus={focusNumericField}
                  onBlur={blurNumericField}
                  placeholder="Size"
                  placeholderTextColor={colors.inkFaint}
                  keyboardType="number-pad"
                />
              </View>
            ) : (
              <Text style={styles.value}>
                {shoeSizeValue ? `${shoeGender} · ${shoeSizeValue}` : ''}
              </Text>
            )}
          </View>

          <View style={styles.fieldWrapper}>
            <Text style={styles.label}>Height</Text>
            {isEditing ? (
              <View style={styles.heightRow}>
                <TextInput
                  style={styles.heightInput}
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
                  value={heightInches}
                  onChangeText={(text) => setHeightInches(digitsOnly(text).slice(0, 2))}
                  onFocus={focusNumericField}
                  onBlur={blurNumericField}
                  keyboardType="number-pad"
                  maxLength={2}
                />
                <Text style={styles.heightUnit}>"</Text>
              </View>
            ) : (
              <Text style={styles.value}>{hasHeight ? `${heightFeet}' ${heightInches}"` : ''}</Text>
            )}
          </View>

          <View style={styles.fieldWrapper}>
            <Text style={styles.label}>Weight</Text>
            {isEditing ? (
              <View style={styles.weightRow}>
                <TextInput
                  style={styles.weightInput}
                  value={weight}
                  onChangeText={(text) => setWeight(digitsOnly(text).slice(0, 3))}
                  onFocus={focusNumericField}
                  onBlur={blurNumericField}
                  keyboardType="number-pad"
                  maxLength={3}
                />
                <Text style={styles.heightUnit}>lbs</Text>
              </View>
            ) : (
              <Text style={styles.value}>{weight ? `${weight}lbs` : ''}</Text>
            )}
          </View>

          <Pressable style={styles.actionButton} onPress={handleToggleEdit}>
            <Text style={styles.actionButtonText}>{isEditing ? 'Update' : 'Edit'}</Text>
          </Pressable>

          <Pressable style={styles.logOutButton} onPress={handleLogOut}>
            <Text style={styles.logOutButtonText}>Log Out</Text>
          </Pressable>
        </ScrollView>
        <View onLayout={registerBottomInset}>
          <KeyboardDoneBar visible={numericFocused} />
        </View>
        </View>
      </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function ProfileField({
  label,
  value,
  editing,
  keyboardType,
  onChangeText,
  onFocus,
  onBlur,
}: {
  label: string;
  value: string;
  editing: boolean;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
  onChangeText: (text: string) => void;
  onFocus?: (event: FocusEvent) => void;
  onBlur?: () => void;
}) {
  return (
    <View style={styles.fieldWrapper}>
      <Text style={styles.label}>{label}</Text>
      {editing ? (
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          onFocus={onFocus}
          onBlur={onBlur}
          keyboardType={keyboardType}
          autoCapitalize={keyboardType === 'email-address' ? 'none' : 'sentences'}
        />
      ) : (
        <Text style={styles.value}>{value}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  appBody: { flex: 1, flexDirection: 'row' },
  contentColumn: { flex: 1, flexDirection: 'column' },
  flexOne: { flex: 1 },
  content: {
    alignItems: 'center',
    paddingTop: 16,
    paddingHorizontal: 18,
    paddingBottom: 28,
  },
  header: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 6,
    marginBottom: 10,
  },
  headerSideButton: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  pageTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fonts.wordmark,
    fontSize: 18,
    color: colors.ink,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  avatarText: { fontFamily: fonts.wordmark, fontSize: 36, color: colors.paper },
  roleBadge: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    letterSpacing: 0.5,
    color: colors.ink,
    textTransform: 'uppercase',
    marginBottom: 20,
  },
  fieldWrapper: { width: '100%' },
  label: {
    fontFamily: fonts.body,
    fontSize: 11.5,
    color: colors.inkSoft,
    marginTop: 12,
    marginBottom: 6,
  },
  value: { fontFamily: fonts.body, fontSize: 14, color: colors.ink, minHeight: 20, width: '100%' },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.ink,
  },
  pickerWrapper: {
    width: '100%',
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  shoeRow: { width: '100%', flexDirection: 'row', gap: 8 },
  segmented: { flex: 1, flexDirection: 'row', borderWidth: 1, borderColor: colors.ink },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    backgroundColor: colors.surface,
  },
  segmentBorderRight: { borderRightWidth: 1, borderRightColor: colors.ink },
  segmentActive: { backgroundColor: colors.ink },
  segmentText: { fontFamily: fonts.bodyMedium, fontSize: 12.5, color: colors.ink },
  segmentTextActive: { color: colors.paper },
  shoeSizeInput: {
    width: 70,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.ink,
    textAlign: 'center',
  },
  heightRow: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 8 },
  heightInput: {
    width: 56,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.ink,
    textAlign: 'center',
  },
  heightUnit: { fontFamily: fonts.body, fontSize: 14, color: colors.ink },
  weightRow: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 8 },
  weightInput: {
    width: 70,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.ink,
    textAlign: 'center',
  },
  actionButton: {
    width: '100%',
    backgroundColor: colors.ink,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  actionButtonText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.paper },
  logOutButton: {
    width: '100%',
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  logOutButtonText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.ink },
});
