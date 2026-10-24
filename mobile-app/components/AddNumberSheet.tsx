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
import { normalizeNumber } from '../lib/import/rows';
import { useInventory } from '../context/InventoryContext';
import { friendlyError } from '../lib/errors';
import { successBuzz } from '../lib/haptics';
import { OFFLINE_DIM, requireOnline, useConnection } from '../hooks/useConnection';

type Props = { piece: PieceType | null; onClose: () => void };

export default function AddNumberSheet({ piece, onClose }: Props) {
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
        {shown && <Body key={shown.id} piece={shown} onClose={onClose} />}
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Body({ piece, onClose }: { piece: PieceType; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { isOnline } = useConnection();
  const { addPieceNumber } = useInventory();
  const [text, setText] = useState('');
  const [checked, setChecked] = useState<string[]>(piece.colors);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const toggle = (c: string) =>
    setChecked((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]));

  const save = async () => {
    if (savingRef.current) return;
    const number = normalizeNumber(text);
    if (number === null) {
      Alert.alert('Add a number', text.trim() ? `"${text.trim()}" isn't a number` : 'Type the new number first.');
      return;
    }
    if (checked.length === 0) {
      Alert.alert('Pick a color', 'Choose at least one color.');
      return;
    }
    if (!requireOnline(isOnline)) return;
    savingRef.current = true;
    setSaving(true);
    try {
      await addPieceNumber(piece.id, number, piece.colors.filter((c) => checked.includes(c)));
      successBuzz();
      onClose();
    } catch (error) {
      Alert.alert("Couldn't add number", friendlyError(error));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <View style={[styles.sheet, { paddingBottom: Math.max(24, insets.bottom + 12) }]}>
      <View style={styles.handle} />
      <Text style={styles.title}>Add number to {piece.name}</Text>
      <TextInput
        style={styles.input}
        value={text}
        onChangeText={setText}
        placeholder="Number"
        placeholderTextColor={colors.inkFaint}
        keyboardType="number-pad"
        autoFocus
      />
      <Text style={styles.label}>Colors</Text>
      <View style={styles.choiceRow}>
        {piece.colors.map((c) => {
          const on = checked.includes(c);
          return (
            <Pressable
              key={c}
              style={[styles.choice, on && styles.choiceOn]}
              onPress={() => toggle(c)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
            >
              <Text style={[styles.choiceText, on && styles.choiceTextOn]}>{c}</Text>
            </Pressable>
          );
        })}
      </View>
      <Pressable
        style={[styles.submit, (!isOnline || saving) && OFFLINE_DIM]}
        disabled={saving}
        onPress={save}
      >
        <Text style={styles.submitText}>{saving ? 'Saving…' : 'Add number'}</Text>
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
  label: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.ink, marginTop: 18 },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  choice: {
    borderWidth: 2,
    borderColor: colors.lineSoft,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: colors.white,
  },
  choiceOn: { borderColor: colors.teal, backgroundColor: colors.tealTint },
  choiceText: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.inkSoft },
  choiceTextOn: { color: colors.tealDark },
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
