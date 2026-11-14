import { useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView, StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, useThemedStyles, type Theme } from '../hooks/useTheme';
import { fonts } from '../constants/fonts';
import type { PieceType } from '../lib/models';
import { normalizeNumber } from '../lib/import/rows';
import { useInventory } from '../context/InventoryContext';
import { friendlyError } from '../lib/errors';
import { successBuzz } from '../lib/haptics';
import KeyboardDoneBar from './KeyboardDoneBar';
import { OFFLINE_DIM, requireOnline, useConnection } from '../hooks/useConnection';

type Props = { piece: PieceType | null; onClose: () => void };

export default function AddNumberSheet({ piece, onClose }: Props) {
  const styles = useThemedStyles(makeStyles);
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
        <Pressable accessibilityRole="button" style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close">
          <View style={styles.backdrop} />
        </Pressable>
        {shown && <Body key={shown.id} piece={shown} onClose={onClose} />}
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Body({ piece, onClose }: { piece: PieceType; onClose: () => void }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { isOnline } = useConnection();
  const { addPieceNumber } = useInventory();
  const [text, setText] = useState('');
  const [checked, setChecked] = useState<string[]>(piece.colors);
  const [saving, setSaving] = useState(false);
  const [numericFocused, setNumericFocused] = useState(false);
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
      <Text style={styles.title} accessibilityRole="header">Add number to {piece.name}</Text>
      {/* Scrolls so large text never pushes the controls off the screen. */}
      <ScrollView keyboardShouldPersistTaps="handled" style={styles.scroll}>
        <TextInput accessibilityLabel="Number"
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Number"
          placeholderTextColor={colors.inkFaint}
          keyboardType="number-pad"
          onFocus={() => setNumericFocused(true)}
          onBlur={() => setNumericFocused(false)}
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
        <KeyboardDoneBar visible={numericFocused} />
        <Pressable accessibilityRole="button"
          style={[styles.submit, (!isOnline || saving) && OFFLINE_DIM]}
          disabled={saving}
          onPress={save}
        >
          <Text style={styles.submitText}>{saving ? 'Saving…' : 'Add number'}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { flex: 1, backgroundColor: t.colors.backdrop },
  scroll: { flexGrow: 0 },
  sheet: {
    backgroundColor: t.colors.white,
    maxHeight: '90%',
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
    backgroundColor: t.colors.line,
    marginBottom: 16,
  },
  title: { fontFamily: fonts.wordmark, fontSize: t.font(20), color: t.colors.ink },
  input: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: t.colors.line,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontFamily: fonts.body,
    fontSize: t.font(16),
    color: t.colors.ink,
  },
  label: { fontFamily: fonts.bodySemiBold, fontSize: t.font(14), color: t.colors.ink, marginTop: 18 },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  choice: {
    borderWidth: 2,
    borderColor: t.colors.lineSoft,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: t.colors.white,
  },
  choiceOn: { borderColor: t.colors.teal, backgroundColor: t.colors.tealTint },
  choiceText: { fontFamily: fonts.bodySemiBold, fontSize: t.font(14), color: t.colors.inkSoft },
  choiceTextOn: { color: t.colors.tealDark },
  submit: {
    marginTop: 20,
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: t.colors.wash,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitText: { fontFamily: fonts.bodySemiBold, fontSize: t.font(16), color: t.colors.white },
});
}
