import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { fonts } from '../constants/fonts';
import { useTheme } from '../hooks/useTheme';

type Props = {
  label: string;
  onPress: () => void;
  // Inside a card (surface background): fill with paper so it stands apart.
  onSurface?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

// Small outlined button used everywhere the app used to have a text link.
// Looks compact at Standard size but always has at least a 44 × 44 tap area.
export default function OutlineButton({ label, onPress, onSurface, disabled, accessibilityLabel, style }: Props) {
  const { colors, button, highContrast } = useTheme();
  const fill = highContrast ? colors.white : onSurface ? colors.paper : colors.surface;
  const slop = Math.max(0, Math.ceil((44 - button.minHeight) / 2));

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={{ top: slop, bottom: slop, left: 4, right: 4 }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        styles.base,
        {
          minHeight: button.minHeight,
          paddingHorizontal: button.paddingHorizontal,
          borderWidth: button.borderWidth,
          borderRadius: button.borderRadius,
          borderColor: highContrast ? '#000000' : colors.ink,
          backgroundColor: fill,
        },
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      <Text style={[styles.label, { fontSize: button.fontSize, color: highContrast ? '#000000' : colors.ink }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignSelf: 'flex-start', alignItems: 'center', justifyContent: 'center', paddingVertical: 3 },
  label: { fontFamily: fonts.bodySemiBold, textAlign: 'center' },
  pressed: { opacity: 0.6 },
  disabled: { opacity: 0.45 },
});
