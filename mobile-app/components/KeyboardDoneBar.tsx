import { Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import { fonts } from '../constants/fonts';
import { useThemedStyles, type Theme } from '../hooks/useTheme';

// number-pad/decimal-pad keyboards show no return/done key on either platform,
// so there's otherwise no way to close them short of tapping outside the field.
export default function KeyboardDoneBar({ visible }: { visible: boolean }) {
  const styles = useThemedStyles(makeStyles);
  if (!visible) return null;

  return (
    <View style={styles.bar}>
      <Pressable accessibilityRole="button" style={styles.button} onPress={() => Keyboard.dismiss()}>
        <Text style={styles.buttonText}>Done</Text>
      </Pressable>
    </View>
  );
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
  bar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: t.colors.line,
    backgroundColor: t.colors.surface,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  button: {
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  buttonText: {
    fontFamily: fonts.bodyMedium,
    fontSize: t.font(13.5),
    color: t.colors.ink,
  },
});
}
