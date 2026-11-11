import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../constants/colors';
import { fonts } from '../constants/fonts';

// Member's white shirt size and whether they keep and wash their own, so staff don't
// count kept shirts as missing from the bins.
export default function WhiteShirtChoice({
  sizes,
  size,
  keeps,
  onChangeSize,
  onChangeKeeps,
}: {
  sizes: string[];
  size: string;
  keeps: boolean | null;
  onChangeSize: (size: string) => void;
  onChangeKeeps: (keeps: boolean) => void;
}) {
  if (sizes.length === 0) {
    return <Text style={styles.note}>Your white shirt sizes aren't set up yet.</Text>;
  }
  const hasSize = sizes.some((s) => s.toLowerCase() === size.trim().toLowerCase());
  return (
    <View style={styles.box}>
      <Text style={styles.label}>{hasSize ? 'Your size' : 'Choose your size'}</Text>
      <View style={styles.chips} accessibilityRole="radiogroup">
        {sizes.map((s) => {
          const active = s.toLowerCase() === size.trim().toLowerCase();
          return (
            <Pressable
              key={s}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => !active && onChangeSize(s)}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{s}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={[styles.label, styles.spaced]}>Washing</Text>
      <View style={styles.choices} accessibilityRole="radiogroup">
        {([
          [true, 'I keep and wash my own'],
          [false, 'I leave mine in the bin'],
        ] as const).map(([value, text]) => {
          const active = keeps === value;
          return (
            <Pressable
              key={text}
              style={[styles.choice, active && styles.chipActive]}
              onPress={() => !active && onChangeKeeps(value)}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{text}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, padding: 12, marginTop: 8 },
  label: { fontFamily: fonts.body, fontSize: 11.5, color: colors.inkSoft, marginBottom: 7 },
  spaced: { marginTop: 12 },
  note: { fontFamily: fonts.body, fontSize: 12, color: colors.inkSoft, marginTop: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  choices: { gap: 7 },
  chip: { borderWidth: 1, borderColor: colors.line, paddingVertical: 7, paddingHorizontal: 12 },
  choice: { borderWidth: 1, borderColor: colors.line, paddingVertical: 9, paddingHorizontal: 12 },
  chipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontFamily: fonts.body, fontSize: 12.5, color: colors.inkSoft },
  chipTextActive: { color: colors.paper },
});
