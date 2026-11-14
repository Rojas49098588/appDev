import { Pressable, StyleSheet, Text, View } from 'react-native';
import { fonts } from '../constants/fonts';
import { useTheme, useThemedStyles, type Theme } from '../hooks/useTheme';
import { SmallChevronRightIcon } from './icons';

// The "Settings ›" row near the top of the staff Profile and member Account screens.
export default function SettingsRow({ onPress }: { onPress: () => void }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable
      style={styles.row}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Settings"
      accessibilityHint="Text size, contrast and layout"
    >
      <Text style={styles.title}>Settings</Text>
      <View style={styles.right}>
        <Text style={styles.hint}>Text size, contrast, view</Text>
        <SmallChevronRightIcon color={colors.inkSoft} />
      </View>
    </Pressable>
  );
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 6,
      minHeight: 48,
      borderWidth: 1,
      borderColor: t.colors.line,
      backgroundColor: t.colors.surface,
      paddingHorizontal: 14,
      paddingVertical: 10,
      marginBottom: 20,
    },
    title: { fontFamily: fonts.bodySemiBold, fontSize: t.font(14), color: t.colors.ink },
    right: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
    hint: { fontFamily: fonts.body, fontSize: t.font(12), color: t.colors.inkSoft, flexShrink: 1 },
  });
}
