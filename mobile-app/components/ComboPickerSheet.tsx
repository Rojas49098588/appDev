import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../constants/colors';
import { fonts } from '../constants/fonts';
import type { Combo } from '../lib/models';
import { CheckIcon } from './icons';

type Props = {
  visible: boolean;
  combos: Combo[];
  selectedId: string | null;
  onPick: (id: string) => void;
  onClose: () => void;
};

export default function ComboPickerSheet({ visible, combos, selectedId, onPick, onClose }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close">
          <View style={styles.backdrop} />
        </Pressable>
        <View style={[styles.sheet, { paddingBottom: Math.max(24, insets.bottom + 12) }]}>
          <View style={styles.handle} />
          <Text style={styles.title}>Choose a combo</Text>
          <ScrollView style={styles.list}>
            {combos.length === 0 && <Text style={styles.empty}>No combos yet.</Text>}
            {combos.map((c) => {
              const active = c.id === selectedId;
              return (
                <Pressable
                  key={c.id}
                  style={[styles.row, active && styles.rowActive]}
                  onPress={() => onPick(c.id)}
                >
                  {c.image ? (
                    <Image source={{ uri: c.image }} style={styles.thumb} />
                  ) : (
                    <View style={styles.thumb} />
                  )}
                  <View style={styles.rowText}>
                    <Text style={styles.rowLabel}>{c.label}</Text>
                    {c.sub !== '' && <Text style={styles.rowSub}>{c.sub}</Text>}
                  </View>
                  {active && <CheckIcon color={colors.wash} />}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
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
    maxHeight: '75%',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.line,
    marginBottom: 16,
  },
  title: { fontFamily: fonts.wordmark, fontSize: 20, color: colors.ink, marginBottom: 10 },
  list: { flexGrow: 0 },
  empty: { fontFamily: fonts.body, fontSize: 13, color: colors.inkFaint, paddingVertical: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.lineSoft,
  },
  rowActive: { backgroundColor: colors.washTint },
  thumb: { width: 44, height: 58, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  rowText: { flex: 1 },
  rowLabel: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.ink },
  rowSub: { fontFamily: fonts.body, fontSize: 12, color: colors.inkSoft, marginTop: 2 },
});
