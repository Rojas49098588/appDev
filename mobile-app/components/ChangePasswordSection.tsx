import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View, type FocusEvent } from 'react-native';
import { colors } from '../constants/colors';
import { fonts } from '../constants/fonts';
import { isValidPassword } from '../constants/validation';
import { useAuth } from '../context/AuthContext';

export default function ChangePasswordSection({
  onFocusField,
}: {
  onFocusField?: (event: FocusEvent) => void;
}) {
  const { changePassword } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const reset = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleCancel = () => {
    reset();
    setIsOpen(false);
  };

  const handleSave = async () => {
    if (!currentPassword.trim() || !newPassword.trim() || !confirmPassword.trim()) {
      Alert.alert('Error', 'Please fill in all password fields.');
      return;
    }
    if (!isValidPassword(newPassword)) {
      Alert.alert(
        'Error',
        'New password must be longer than 6 characters and include a capital letter and a number.'
      );
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'New passwords do not match.');
      return;
    }

    const success = await changePassword(currentPassword, newPassword);
    if (!success) {
      Alert.alert('Error', 'Current password is incorrect.');
      return;
    }

    reset();
    setIsOpen(false);
    Alert.alert('Password updated', 'Your password has been changed successfully.');
  };

  if (!isOpen) {
    return (
      <Pressable style={styles.toggleButton} onPress={() => setIsOpen(true)}>
        <Text style={styles.toggleButtonText}>Change password</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.section}>
      <Text style={styles.label}>Current password</Text>
      <TextInput
        style={styles.input}
        value={currentPassword}
        onChangeText={setCurrentPassword}
        onFocus={onFocusField}
        autoCapitalize="none"
        secureTextEntry
      />
      <Text style={styles.label}>New password</Text>
      <TextInput
        style={styles.input}
        value={newPassword}
        onChangeText={setNewPassword}
        onFocus={onFocusField}
        autoCapitalize="none"
        secureTextEntry
      />
      <Text style={styles.label}>Confirm new password</Text>
      <TextInput
        style={styles.input}
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        onFocus={onFocusField}
        autoCapitalize="none"
        secureTextEntry
      />
      <Pressable style={styles.saveButton} onPress={handleSave}>
        <Text style={styles.saveButtonText}>Save password</Text>
      </Pressable>
      <Pressable style={styles.cancelButton} onPress={handleCancel}>
        <Text style={styles.cancelButtonText}>Cancel</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  toggleButton: {
    width: '100%',
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  toggleButtonText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.ink },
  section: {
    width: '100%',
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    padding: 14,
    marginTop: 10,
  },
  label: {
    fontFamily: fonts.body,
    fontSize: 11.5,
    color: colors.inkSoft,
    marginBottom: 6,
  },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paper,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.ink,
    marginBottom: 14,
  },
  saveButton: {
    width: '100%',
    backgroundColor: colors.ink,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveButtonText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.paper },
  cancelButton: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 12,
  },
  cancelButtonText: { fontFamily: fonts.body, fontSize: 12.5, color: colors.inkSoft },
});
