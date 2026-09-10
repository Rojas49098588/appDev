import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../constants/colors';
import { fonts } from '../constants/fonts';

const TICKS: { label: string; top: `${number}%`; major: boolean }[] = [
  { label: '40', top: '2%', major: true },
  { label: '30', top: '24%', major: false },
  { label: '20', top: '46%', major: true },
  { label: '10', top: '68%', major: false },
  { label: '0', top: '90%', major: true },
];

export default function TapeGutter() {
  return (
    <View style={styles.tape}>
      {TICKS.map((tick) => (
        <View key={tick.label} style={[styles.tick, { top: tick.top }]}>
          <Text style={[styles.tickLabel, tick.major && styles.tickLabelMajor]}>{tick.label}</Text>
          <View style={[styles.mark, tick.major && styles.markMajor]} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  tape: {
    width: 26,
    borderRightWidth: 1,
    borderRightColor: colors.line,
  },
  tick: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 4,
  },
  tickLabel: {
    fontFamily: fonts.mono,
    fontSize: 8.5,
    color: colors.inkFaint,
  },
  tickLabelMajor: {
    color: colors.inkSoft,
  },
  mark: {
    width: 6,
    height: 1,
    backgroundColor: colors.inkFaint,
  },
  markMajor: {
    width: 10,
    backgroundColor: colors.inkSoft,
  },
});
