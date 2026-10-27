import { useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../constants/colors';
import { fonts } from '../constants/fonts';
import type { PieceType } from '../lib/models';
import { useInventory } from '../context/InventoryContext';
import { friendlyError } from '../lib/errors';
import { successBuzz } from '../lib/haptics';
import { OFFLINE_DIM, requireOnline, useConnection } from '../hooks/useConnection';

type Props = {
  piece: PieceType | null;
  // How many distinct numbers the new color will be added to.
  numberCount: number;
  onClose: () => void;
};

export default function AddColorSheet({ piece, numberCount, onClose }: Props) {
  // Keep showing the last type while the modal fades out.
  const last = useRef(piece);
  if (piece) last.current = piece;
  const shown = last.current;
  return (
    <Modal
      visible={piece !== null}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView style={styles.root} behavior="padding">
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close">
          <View style={styles.backdrop} />
        </Pressable>
        {shown && <Body key={shown.id} piece={shown} numberCount={numberCount} onClose={onClose} />}
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Body({
  piece,
  numberCount,
  onClose,
}: {
  piece: PieceType;
  numberCount: number;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { isOnline } = useConnection();
  const { addPieceColor } = useInventory();
  const [color, setColor] = useState('');
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const name = color.trim();

  const save = async () => {
    if (savingRef.current) return;
    if (!name) {
      Alert.alert('Add a color', 'Type the new color first.');
      return;
    }
    if (!requireOnline(isOnline)) return;
    savingRef.current = true;
    setSaving(true);
    try {
      await addPieceColor(piece.id, name);
      successBuzz();
      onClose();
    } catch (error) {
      Alert.alert("Couldn't add color", friendlyError(error));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <View style={[styles.sheet, { paddingBottom: Math.max(24, insets.bottom + 12) }]}>
      <View style={styles.handle} />
      <Text style={styles.title}>Add color to {piece.name}</Text>
      <TextInput
        style={styles.input}
        value={color}
        onChangeText={setColor}
        placeholder="Color (e.g. Gold)"
        placeholderTextColor={colors.inkFaint}
        autoCapitalize="words"
        autoFocus
      />
      {name !== '' && (
        <Text style={styles.preview}>
          Adds {name} {piece.name} in all {numberCount} {numberCount === 1 ? 'number' : 'numbers'}
        </Text>
      )}
      <Pressable
        style={[styles.submit, (!isOnline || saving) && OFFLINE_DIM]}
        disabled={saving}
        onPress={save}
      >
        <Text style={styles.submitText}>{saving ? 'Saving…' : 'Add color'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { flex: 1, backgroundColor: colors.backdrop },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.line,
    marginBottom: 16,
  },
  title: { fontFamily: fonts.wordmark, fontSize: 20, color: colors.ink },
  input: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.ink,
  },
  preview: { fontFamily: fonts.body, fontSize: 13, color: colors.inkSoft, marginTop: 10 },
  submit: {
    marginTop: 20,
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: colors.wash,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitText: { fontFamily: fonts.bodySemiBold, fontSize: 16, color: colors.white },
});
