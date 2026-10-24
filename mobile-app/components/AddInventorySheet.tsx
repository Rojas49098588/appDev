import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../constants/colors';
import { fonts } from '../constants/fonts';

type Props = {
  visible: boolean;
  onClose: () => void;
  onImport: () => void;
  onNewType: () => void;
};

// The "+" menu on staff Inventory. Add color / Add number live on each piece card.
export default function AddInventorySheet({ visible, onClose, onImport, onNewType }: Props) {
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
    marginBottom: 12,
  },
  option: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.lineSoft },
  optionTitle: { fontFamily: fonts.bodySemiBold, fontSize: 16, color: colors.ink },
  optionSub: { fontFamily: fonts.body, fontSize: 13, color: colors.inkSoft, marginTop: 2 },
});
