import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useThemedStyles, type Theme } from '../hooks/useTheme';
import { fonts } from '../constants/fonts';

type Props = {
  options: [string, string];
  value: 0 | 1;
  onChange: (v: 0 | 1) => void;
};

// Two-option segmented control: bordered row, selected segment is ink with white text.
export default function SegmentTabs({ options, value, onChange }: Props) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.row}>
      {options.map((label, i) => {
        const selected = value === i;
        return (
          <Pressable
            key={label}
            style={[styles.segment, selected && styles.segmentOn]}
            onPress={() => onChange(i as 0 | 1)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
          >
            <Text style={[styles.label, selected && styles.labelOn]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
  row: { flexDirection: 'row', borderWidth: 1, borderColor: t.colors.ink },
  segment: { flex: 1, alignItems: 'center', paddingVertical: 9 },
  segmentOn: { backgroundColor: t.colors.ink },
  label: { fontFamily: fonts.bodySemiBold, fontSize: t.font(12), color: t.colors.ink },
  labelOn: { color: t.colors.white },
});
}
