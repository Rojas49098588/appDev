import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemedStyles, type Theme } from '../hooks/useTheme';
import { fonts } from '../constants/fonts';

type Props = {
  visible: boolean;
  onClose: () => void;
  onImport: () => void;
  onNewType: () => void;
};

// The "+" menu on staff Inventory. Add color / Add number live on each piece card.
export default function AddInventorySheet({ visible, onClose, onImport, onNewType }: Props) {
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
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close menu">
          <View style={styles.backdrop} />
        </Pressable>
        <View style={[styles.sheet, { paddingBottom: Math.max(24, insets.bottom + 12) }]}>
          <View style={styles.handle} />
          <Pressable style={styles.option} onPress={onImport}>
            <Text style={styles.optionTitle}>Import spreadsheet</Text>
            <Text style={styles.optionSub}>Add pieces, numbers and repairs from a CSV</Text>
          </Pressable>
          <Pressable style={styles.option} onPress={onNewType}>
            <Text style={styles.optionTitle}>New piece type</Text>
            <Text style={styles.optionSub}>Coats, ties, hats, anything new</Text>
          </Pressable>
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
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: t.colors.line,
    marginBottom: 12,
  },
  option: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: t.colors.lineSoft },
  optionTitle: { fontFamily: fonts.bodySemiBold, fontSize: t.font(16), color: t.colors.ink },
  optionSub: { fontFamily: fonts.body, fontSize: t.font(13), color: t.colors.inkSoft, marginTop: 2 },
});
}
