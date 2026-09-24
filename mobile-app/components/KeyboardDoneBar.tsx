import { Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../constants/colors';
import { fonts } from '../constants/fonts';

// number-pad/decimal-pad keyboards show no return/done key on either platform,
// so there's otherwise no way to close them short of tapping outside the field.
export default function KeyboardDoneBar({ visible }: { visible: boolean }) {
  if (!visible) return null;

  return (
    <View style={styles.bar}>
      <Pressable style={styles.button} onPress={() => Keyboard.dismiss()}>
        <Text style={styles.buttonText}>Done</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.surface,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  button: {
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  buttonText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13.5,
    color: colors.ink,
  },
});
