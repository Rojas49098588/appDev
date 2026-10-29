import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../constants/colors';
import { fonts } from '../constants/fonts';

type Props = {
  options: [string, string];
  value: 0 | 1;
  onChange: (v: 0 | 1) => void;
};

// Two-option segmented control: bordered row, selected segment is ink with white text.
export default function SegmentTabs({ options, value, onChange }: Props) {
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

const styles = StyleSheet.create({
  row: { flexDirection: 'row', borderWidth: 1, borderColor: colors.ink },
  segment: { flex: 1, alignItems: 'center', paddingVertical: 9 },
  segmentOn: { backgroundColor: colors.ink },
  label: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: colors.ink },
  labelOn: { color: colors.white },
});
