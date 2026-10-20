import { StyleSheet, View } from 'react-native';
import { colors } from '../constants/colors';

// Uniform color names from constants/inventoryData.ts.
const SWATCHES: Record<string, string> = {
  Blue: '#346FA3',
  Red: '#A8483D',
  Purple: '#755C91',
  Candy: '#E9DDC8',
  White: '#F8F7F2',
  Black: '#282C30',
};

export default function Swatch({ color, large = false }: { color: string; large?: boolean }) {
  const size = large ? 44 : 28;
  return (
    <View
      style={[
        styles.swatch,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: SWATCHES[color] ?? colors.inkFaint },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  swatch: { borderWidth: 1, borderColor: 'rgba(30, 35, 40, 0.1)' },
});
