import { useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../constants/colors';
import { fonts } from '../constants/fonts';
import type { Flag, FlagStatus } from '../lib/models';
import type { FlagEdit } from '../context/FlagsContext';
import { friendlyError } from '../lib/errors';
import { successBuzz } from '../lib/haptics';
import { OFFLINE_DIM, requireOnline, useConnection } from '../hooks/useConnection';
import { CloseIcon } from './icons';
import { STATUS_LABELS } from './FlagSheet';

type Props = {
  flag: Flag | null;
  // Colors from the piece's catalogue entry.
  colorOptions: string[];
  onClose: () => void;
  onSave: (id: string, edit: FlagEdit) => Promise<void>;
};

export default function EditFlagSheet({ flag, colorOptions, onClose, onSave }: Props) {
  // Keep showing the last flag while the modal fades out.
  const last = useRef(flag);
  if (flag) last.current = flag;
  const shown = last.current;

  const slide = useRef(new Animated.Value(0)).current;
  const onShow = () => {
    slide.setValue(0);
    Animated.timing(slide, { toValue: 1, duration: 280, useNativeDriver: true }).start();
  };

  return (
    <Modal
      visible={flag !== null}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onShow={onShow}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView style={styles.root} behavior="padding">
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close edit sheet">
          <View style={styles.backdrop} />
        </Pressable>
        {shown && (
          <Animated.View
            style={{
              transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [400, 0] }) }],
            }}
          >
            <SheetBody
              key={shown.id}
              flag={shown}
              colorOptions={colorOptions}
              onClose={onClose}
              onSave={onSave}
            />
          </Animated.View>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

function SheetBody({
  flag,
  colorOptions,
  onClose,
  onSave,
}: {
  flag: Flag;
  colorOptions: string[];
  onClose: () => void;
  onSave: Props['onSave'];
}) {
  const insets = useSafeAreaInsets();
  const { isOnline } = useConnection();
  const [color, setColor] = useState(flag.color);
  const [status, setStatus] = useState<FlagStatus>(flag.status);
  const [comment, setComment] = useState(flag.comment);
  const [staffNote, setStaffNote] = useState(flag.staffNote);
  const [isSaving, setIsSaving] = useState(false);

  const colorChoices = colorOptions.includes(flag.color) ? colorOptions : [flag.color, ...colorOptions];

  const save = async () => {
    if (!requireOnline(isOnline)) return;
    setIsSaving(true);
    try {
      await onSave(flag.id, { color, status, comment, staffNote });
      successBuzz();
      onClose();
    } catch (error) {
      Alert.alert("Couldn't save changes", friendlyError(error));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Pressable
      style={[styles.sheet, { paddingBottom: Math.max(24, insets.bottom + 12) }]}
      onPress={Keyboard.dismiss}
      accessible={false}
    >
      <View style={styles.handle} />
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text style={styles.title}>Edit flag</Text>
          <Text style={styles.subtitle}>
            {flag.piece} · Size {flag.size}
          </Text>
        </View>
        <Pressable style={styles.closeButton} onPress={onClose} accessibilityLabel="Close">
          <CloseIcon color={colors.inkSoft} />
        </Pressable>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" style={styles.scroll}>
        <Text style={styles.label}>Color</Text>
        <View style={styles.choiceRow}>
          {colorChoices.map((c) => {
            const selected = c === color;
            return (
              <Pressable
                key={c}
                style={[styles.choice, selected && styles.choiceSelected]}
                onPress={() => setColor(c)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
              >
                <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{c}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.label}>Status</Text>
        <View style={styles.choiceRow}>
          {(['dirty', 'repair'] as FlagStatus[]).map((value) => {
            const selected = status === value;
            return (
              <Pressable
                key={value}
                style={[styles.choice, selected && styles.choiceSelected]}
                onPress={() => setStatus(value)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
              >
                <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>
                  {STATUS_LABELS[value]}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.label}>Comment</Text>
        <TextInput
          style={styles.input}
          value={comment}
          onChangeText={setComment}
          placeholder="Comment"
          placeholderTextColor={colors.inkFaint}
          multiline
        />
        <Text style={styles.label}>Staff note</Text>
        <TextInput
          style={styles.input}
          value={staffNote}
          onChangeText={setStaffNote}
          placeholder="Visible to staff only"
          placeholderTextColor={colors.inkFaint}
          multiline
        />
      </ScrollView>

      <Pressable
        style={[styles.submit, (!isOnline || isSaving) && OFFLINE_DIM]}
        disabled={isSaving}
        onPress={save}
      >
        <Text style={styles.submitText}>Save changes</Text>
      </Pressable>
    </Pressable>
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
    maxHeight: '90%',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.line,
    marginBottom: 20,
  },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  headerText: { flex: 1, paddingTop: 2 },
  title: { fontFamily: fonts.wordmark, fontSize: 20, color: colors.ink },
  subtitle: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.inkSoft, marginTop: 2 },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { flexGrow: 0 },
  label: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.ink, marginTop: 20 },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  choice: {
    borderWidth: 2,
    borderColor: colors.lineSoft,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: colors.white,
  },
  choiceSelected: { borderColor: colors.teal, backgroundColor: colors.tealTint },
  choiceText: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.inkSoft },
  choiceTextSelected: { color: colors.tealDark },
  input: {
    marginTop: 8,
    minHeight: 72,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    backgroundColor: colors.white,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.ink,
    textAlignVertical: 'top',
  },
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
