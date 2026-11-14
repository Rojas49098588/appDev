import { Pressable, StyleSheet, Text, View } from 'react-native';
import { fonts } from '../constants/fonts';
import { useThemedStyles, type Theme } from '../hooks/useTheme';

type Props = {
  value: number;
  steps: readonly string[];
  onChange: (value: number) => void;
  label: string;
};

// A stepped slider like Apple's Text Size: a track with one tappable stop per
// step, a small "A" and a big "A" at the ends. Screen readers swipe up/down
// to change it.
export default function StepSlider({ value, steps, onChange, label }: Props) {
  const styles = useThemedStyles(makeStyles);
  const last = steps.length - 1;
  const fill = `${(value / last) * 100}%` as const;

  return (
    <View>
      <View
        style={styles.row}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ text: steps[value] }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'increment' && value < last) onChange(value + 1);
          if (event.nativeEvent.actionName === 'decrement' && value > 0) onChange(value - 1);
        }}
      >
        <Text style={styles.smallA} importantForAccessibility="no">A</Text>
        <View style={styles.trackArea}>
          <View style={styles.track}>
            <View style={[styles.trackFill, { width: fill }]} />
          </View>
          <View style={styles.stops}>
            {steps.map((name, i) => (
              <Pressable
                key={name}
                style={styles.stopHit}
                onPress={() => onChange(i)}
                accessibilityRole="button"
                accessibilityLabel={name}
                importantForAccessibility="no"
                accessibilityElementsHidden
              >
                <View style={[styles.stop, i <= value && styles.stopOn, i === value && styles.knob]} />
              </Pressable>
            ))}
          </View>
        </View>
        <Text style={styles.bigA} importantForAccessibility="no">A</Text>
      </View>
      <View style={styles.names} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <Text style={styles.name}>{steps[0]}</Text>
        <Text style={styles.current}>{steps[value]}</Text>
        <Text style={styles.name}>{steps[last]}</Text>
      </View>
    </View>
  );
}

const KNOB = 24;

function makeStyles(t: Theme) {
  return StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
    smallA: { fontFamily: fonts.bodyMedium, fontSize: 13, color: t.colors.ink },
    bigA: { fontFamily: fonts.bodyMedium, fontSize: 22, color: t.colors.ink },
    trackArea: { flex: 1, height: 44, justifyContent: 'center' },
    track: { position: 'absolute', left: KNOB / 2, right: KNOB / 2, height: 4, borderRadius: 2, backgroundColor: t.colors.line, overflow: 'hidden' },
    trackFill: { height: 4, backgroundColor: t.colors.ink },
    stops: { flexDirection: 'row', justifyContent: 'space-between' },
    stopHit: { width: KNOB, height: 44, alignItems: 'center', justifyContent: 'center' },
    stop: { width: 10, height: 10, borderRadius: 5, backgroundColor: t.colors.line },
    stopOn: { backgroundColor: t.colors.ink },
    knob: {
      width: KNOB,
      height: KNOB,
      borderRadius: KNOB / 2,
      backgroundColor: t.colors.white,
      borderWidth: 2,
      borderColor: t.colors.ink,
    },
    names: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
    name: { fontFamily: fonts.body, fontSize: t.font(11), color: t.colors.inkSoft },
    current: { fontFamily: fonts.bodySemiBold, fontSize: t.font(12), color: t.colors.ink },
  });
}
