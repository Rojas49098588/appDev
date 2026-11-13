import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View, type FocusEvent } from 'react-native';
import { useThemedStyles, type Theme } from '../hooks/useTheme';
import { fonts } from '../constants/fonts';
import { isValidPassword } from '../constants/validation';
import { useAuth } from '../context/AuthContext';
import { friendlyError } from '../lib/errors';
import { OFFLINE_DIM, requireOnline, useConnection } from '../hooks/useConnection';
import { successBuzz } from '../lib/haptics';

export default function ChangePasswordSection({
  onFocusField,
}: {
  onFocusField?: (event: FocusEvent) => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const { changePassword } = useAuth();
  const { isOnline } = useConnection();
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
    if (!requireOnline(isOnline)) return;
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

    let success: boolean;
    try {
      success = await changePassword(currentPassword, newPassword);
    } catch (error) {
      Alert.alert('Error', friendlyError(error));
      return;
    }
    if (!success) {
      Alert.alert('Error', 'Current password is incorrect.');
      return;
    }

    successBuzz();
    reset();
    setIsOpen(false);
    Alert.alert('Password updated', 'Your password has been changed successfully.');
  };

  if (!isOpen) {
    return (
      <Pressable accessibilityRole="button" style={styles.toggleButton} onPress={() => setIsOpen(true)}>
        <Text style={styles.toggleButtonText}>Change password</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.section}>
      <Text style={styles.label}>Current password</Text>
      <TextInput accessibilityLabel="Current password"
        style={styles.input}
        value={currentPassword}
        onChangeText={setCurrentPassword}
        onFocus={onFocusField}
        autoCapitalize="none"
        secureTextEntry
      />
      <Text style={styles.label}>New password</Text>
      <TextInput accessibilityLabel="New password"
        style={styles.input}
        value={newPassword}
        onChangeText={setNewPassword}
        onFocus={onFocusField}
        autoCapitalize="none"
        secureTextEntry
      />
      <Text style={styles.label}>Confirm new password</Text>
      <TextInput accessibilityLabel="Confirm new password"
        style={styles.input}
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        onFocus={onFocusField}
        autoCapitalize="none"
        secureTextEntry
      />
      <Pressable accessibilityRole="button" style={[styles.saveButton, !isOnline && OFFLINE_DIM]} onPress={handleSave}>
        <Text style={styles.saveButtonText}>Save password</Text>
      </Pressable>
      <Pressable accessibilityRole="button" style={styles.cancelButton} onPress={handleCancel}>
        <Text style={styles.cancelButtonText}>Cancel</Text>
      </Pressable>
    </View>
  );
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
  toggleButton: {
    width: '100%',
    borderWidth: 1,
    borderColor: t.colors.line,
    backgroundColor: t.colors.surface,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  toggleButtonText: { fontFamily: fonts.bodyMedium, fontSize: t.font(14), color: t.colors.ink },
  section: {
    width: '100%',
    borderWidth: 1,
    borderColor: t.colors.line,
    backgroundColor: t.colors.surface,
    padding: 14,
    marginTop: 10,
  },
  label: {
    fontFamily: fonts.body,
    fontSize: t.font(11.5),
    color: t.colors.inkSoft,
    marginBottom: 6,
  },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: t.colors.line,
    backgroundColor: t.colors.paper,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontFamily: fonts.body,
    fontSize: t.font(14),
    color: t.colors.ink,
    marginBottom: 14,
  },
  saveButton: {
    width: '100%',
    backgroundColor: t.colors.ink,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveButtonText: { fontFamily: fonts.bodyMedium, fontSize: t.font(14), color: t.colors.paper },
  cancelButton: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 12,
  },
  cancelButtonText: { fontFamily: fonts.body, fontSize: t.font(12.5), color: t.colors.inkSoft },
});
}
