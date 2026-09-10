import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { INSTRUMENTS } from '../constants/instruments';
import { colors } from '../constants/colors';
import { fonts } from '../constants/fonts';
import TapeGutter from '../components/TapeGutter';
import { BackChevronIcon } from '../components/icons';

type Props = NativeStackScreenProps<RootStackParamList, 'Profile'>;

type ProfileData = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  instrument: string;
  heightFeet: string;
  heightInches: string;
  weight: string;
};

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

export default function ProfileScreen({ navigation, route }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [profile, setProfile] = useState<ProfileData>({
    firstName: route.params.firstName,
    lastName: route.params.lastName,
    email: '',
    phone: '',
    instrument: route.params.instrument,
    heightFeet: '',
    heightInches: '',
    weight: '',
  });

  const updateField = (key: keyof ProfileData, value: string) => {
    setProfile((prev) => ({ ...prev, [key]: value }));
  };

  const handleLogOut = () => {
    navigation.reset({ index: 0, routes: [{ name: 'SignUp' }] });
  };

  const hasHeight = profile.heightFeet !== '' || profile.heightInches !== '';
  const initials = `${profile.firstName.charAt(0)}${profile.lastName.charAt(0)}`.toUpperCase();

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flexOne}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.appBody}>
          <TapeGutter />

          <ScrollView style={styles.flexOne} contentContainerStyle={styles.content}>
            <View style={styles.header}>
              <Pressable style={styles.headerSideButton} onPress={() => navigation.goBack()}>
                <BackChevronIcon color={colors.ink} />
              </Pressable>
              <Text style={styles.pageTitle}>User Profile</Text>
              <View style={styles.headerSideButton} />
            </View>

            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>

            <Text style={styles.roleBadge}>{route.params.role}</Text>

            {TEXT_FIELDS.slice(0, 2).map((field) => (
              <ProfileField
                key={field.key}
                label={field.label}
                value={profile[field.key]}
                editing={isEditing}
                onChangeText={(text) => updateField(field.key, text)}
              />
            ))}

            {TEXT_FIELDS.slice(2, 4).map((field) => (
              <ProfileField
                key={field.key}
                label={field.label}
                value={profile[field.key]}
                editing={isEditing}
                keyboardType={field.keyboardType}
                onChangeText={(text) => updateField(field.key, text)}
              />
            ))}

            <Text style={styles.label}>Instrument</Text>
            {isEditing ? (
              <View style={styles.pickerWrapper}>
                <Picker
                  selectedValue={profile.instrument}
                  onValueChange={(value) => updateField('instrument', value)}
                >
                  {INSTRUMENTS.map((option) => (
                    <Picker.Item key={option} label={option} value={option} />
                  ))}
                </Picker>
              </View>
            ) : (
              <Text style={styles.value}>{profile.instrument}</Text>
            )}

            <View style={styles.fieldWrapper}>
              <Text style={styles.label}>Height</Text>
              {isEditing ? (
                <View style={styles.heightRow}>
                  <TextInput
                    style={styles.heightInput}
                    value={profile.heightFeet}
                    onChangeText={(text) =>
                      updateField('heightFeet', digitsOnly(text).slice(0, 1))
                    }
                    keyboardType="number-pad"
                    maxLength={1}
                  />
                  <Text style={styles.heightUnit}>'</Text>
                  <TextInput
                    style={styles.heightInput}
                    value={profile.heightInches}
                    onChangeText={(text) =>
                      updateField('heightInches', digitsOnly(text).slice(0, 2))
                    }
                    keyboardType="number-pad"
                    maxLength={2}
                  />
                  <Text style={styles.heightUnit}>"</Text>
                </View>
              ) : (
                <Text style={styles.value}>
                  {hasHeight ? `${profile.heightFeet}' ${profile.heightInches}"` : ''}
                </Text>
              )}
            </View>

            <ProfileField
              label="Weight"
              value={profile.weight}
              editing={isEditing}
              keyboardType="number-pad"
              maxLength={3}
              onChangeText={(text) => updateField('weight', digitsOnly(text).slice(0, 3))}
            />

            <Pressable style={styles.actionButton} onPress={() => setIsEditing((prev) => !prev)}>
              <Text style={styles.actionButtonText}>{isEditing ? 'Update' : 'Edit'}</Text>
            </Pressable>

            <Pressable style={styles.logOutButton} onPress={handleLogOut}>
              <Text style={styles.logOutButtonText}>Log Out</Text>
            </Pressable>
          </ScrollView>
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
  maxLength,
  onChangeText,
}: {
  label: string;
  value: string;
  editing: boolean;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'number-pad';
  maxLength?: number;
  onChangeText: (text: string) => void;
}) {
  return (
    <View style={styles.fieldWrapper}>
      <Text style={styles.label}>{label}</Text>
      {editing ? (
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          maxLength={maxLength}
        />
      ) : (
        <Text style={styles.value}>{value}</Text>
      )}
    </View>
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
  headerSideButton: {
    width: 30,
    height: 30,
  },
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
  avatarText: {
    fontFamily: fonts.wordmark,
    fontSize: 36,
    color: colors.paper,
  },
  roleBadge: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    letterSpacing: 0.5,
    color: colors.ink,
    textTransform: 'uppercase',
    marginBottom: 20,
  },
  fieldWrapper: {
    width: '100%',
  },
  label: {
    fontFamily: fonts.body,
    fontSize: 11.5,
    color: colors.inkSoft,
    marginTop: 12,
    marginBottom: 6,
  },
  value: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.ink,
    minHeight: 20,
    width: '100%',
  },
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
    paddingVertical: 10,
    paddingHorizontal: 12,
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
  actionButton: {
    width: '100%',
    backgroundColor: colors.ink,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  actionButtonText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.paper,
  },
  logOutButton: {
    width: '100%',
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  logOutButtonText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.ink,
  },
});
