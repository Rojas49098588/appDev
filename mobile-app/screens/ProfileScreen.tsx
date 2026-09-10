import { useCallback, useState } from 'react';
import {
  BackHandler,
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
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { INSTRUMENTS } from '../constants/instruments';

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

  // Log Out is the only way back to Sign Up — block the Android hardware back button too.
  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
      return () => subscription.remove();
    }, [])
  );

  const hasHeight = profile.heightFeet !== '' || profile.heightInches !== '';

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>User Profile</Text>

        <Ionicons name="person-circle" size={100} color="#ccc" style={styles.icon} />

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
                onChangeText={(text) => updateField('heightFeet', digitsOnly(text).slice(0, 1))}
                keyboardType="number-pad"
                maxLength={1}
              />
              <Text style={styles.heightUnit}>'</Text>
              <TextInput
                style={styles.heightInput}
                value={profile.heightInches}
                onChangeText={(text) => updateField('heightInches', digitsOnly(text).slice(0, 2))}
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

        <Pressable
          style={styles.actionButton}
          onPress={() => setIsEditing((prev) => !prev)}
        >
          <Text style={styles.actionButtonText}>{isEditing ? 'Update' : 'Edit'}</Text>
        </Pressable>

        <Pressable style={styles.logOutButton} onPress={handleLogOut}>
          <Text style={styles.logOutButtonText}>Log Out</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
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
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  icon: {
    marginBottom: 4,
  },
  roleBadge: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#007AFF',
    textTransform: 'uppercase',
    marginBottom: 20,
  },
  fieldWrapper: {
    width: '100%',
  },
  label: {
    fontSize: 14,
    color: '#888',
    marginTop: 12,
    marginBottom: 4,
  },
  value: {
    fontSize: 16,
    minHeight: 22,
    width: '100%',
  },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 16,
  },
  pickerWrapper: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
  },
  heightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heightInput: {
    width: 56,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 16,
    textAlign: 'center',
  },
  heightUnit: {
    fontSize: 16,
  },
  actionButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 32,
    marginTop: 24,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  logOutButton: {
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 32,
    marginTop: 12,
  },
  logOutButtonText: {
    color: '#FF3B30',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
