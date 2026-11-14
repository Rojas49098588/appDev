import type { ReactElement } from 'react';
import { StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';
import { fonts } from '../constants/fonts';
import { useTheme } from '../hooks/useTheme';
import { statusLook, type StatusKey, type StatusLook } from '../lib/flagStatus';
import { CheckIcon, DropIcon, WrenchIcon } from './icons';

export function StatusIcon({ icon, color, size = 14 }: { icon: StatusLook['icon']; color: string; size?: number }): ReactElement {
  if (icon === 'wrench') return <WrenchIcon color={color} size={size} />;
  if (icon === 'drop') return <DropIcon color={color} size={size} />;
  return <CheckIcon color={color} size={size} />;
}

// Icon + words in the status color, e.g. "🔧 Flagged · Needs repair".
export default function StatusLabel({
  status,
  prefix = '',
  textStyle,
}: {
  status: StatusKey;
  prefix?: string;
  textStyle?: StyleProp<TextStyle>;
}) {
  const { colors, font } = useTheme();
  const look = statusLook(status);
  const color = colors[look.colorKey];
  return (
    <View style={styles.row}>
      <StatusIcon icon={look.icon} color={color} size={Math.round(font(14))} />
      <Text style={[styles.text, { color, fontSize: font(13) }, textStyle]}>
        {prefix}
        {look.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1 },
  text: { fontFamily: fonts.bodySemiBold, flexShrink: 1 },
});
