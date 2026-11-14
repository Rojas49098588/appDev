import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../hooks/useTheme';

// A title with a button (or avatar) beside it. At large text sizes the button
// drops under the title instead of being pushed off the screen, and the
// title never gets squeezed into broken lines next to it.
export default function TitleRow({
  title,
  action,
  style,
  align = 'center',
}: {
  title: ReactNode;
  action?: ReactNode;
  style?: StyleProp<ViewStyle>;
  align?: 'center' | 'flex-start';
}) {
  const { isLarge } = useTheme();
  if (isLarge) {
    return (
      <View style={[style, styles.stack]}>
        {title}
        {action ? <View style={styles.actionBelow}>{action}</View> : null}
      </View>
    );
  }
  return (
    <View style={[styles.row, { alignItems: align }, style]}>
      <View style={styles.title}>{title}</View>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  title: { flex: 1, flexShrink: 1 },
  // Applied after the caller's style so a row layout there can't undo the stacking.
  stack: { flexDirection: 'column', alignItems: 'stretch', justifyContent: 'flex-start', gap: 8 },
  actionBelow: { alignSelf: 'flex-start' },
});
