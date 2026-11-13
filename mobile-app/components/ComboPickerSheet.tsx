import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, useThemedStyles, type Theme } from '../hooks/useTheme';
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
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
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
        <Pressable accessibilityRole="button" style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close">
          <View style={styles.backdrop} />
        </Pressable>
        <View style={[styles.sheet, { paddingBottom: Math.max(24, insets.bottom + 12) }]}>
          <View style={styles.handle} />
          <Text style={styles.title} accessibilityRole="header">Choose a combo</Text>
          <ScrollView style={styles.list}>
            {combos.length === 0 && <Text style={styles.empty}>No combos yet.</Text>}
            {combos.map((c) => {
              const active = c.id === selectedId;
              return (
                <Pressable accessibilityState={{ selected: !!(active) }} accessibilityRole="button"
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

function makeStyles(t: Theme) {
  return StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { flex: 1, backgroundColor: t.colors.backdrop },
  sheet: {
    backgroundColor: t.colors.white,
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
    backgroundColor: t.colors.line,
    marginBottom: 16,
  },
  title: { fontFamily: fonts.wordmark, fontSize: t.font(20), color: t.colors.ink, marginBottom: 10 },
  list: { flexGrow: 0 },
  empty: { fontFamily: fonts.body, fontSize: t.font(13), color: t.colors.inkFaint, paddingVertical: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: t.colors.lineSoft,
  },
  rowActive: { backgroundColor: t.colors.washTint },
  thumb: { width: 44, height: 58, backgroundColor: t.colors.surface, borderWidth: 1, borderColor: t.colors.line },
  rowText: { flex: 1 },
  rowLabel: { fontFamily: fonts.bodyMedium, fontSize: t.font(14), color: t.colors.ink },
  rowSub: { fontFamily: fonts.body, fontSize: t.font(12), color: t.colors.inkSoft, marginTop: 2 },
});
}
