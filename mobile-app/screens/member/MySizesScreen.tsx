import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../constants/colors';
import { fonts } from '../../constants/fonts';
import { MY_UNIFORM, MY_WHITE_SHIRT } from '../../constants/myUniformData';
import { useAuth } from '../../context/AuthContext';
import TapeGutter from '../../components/TapeGutter';

const UNIFORM_CELLS = MY_UNIFORM.map((slot) => ({
  label: slot.piece,
  value: `${slot.variants.map((v) => v.color).join(', ')} · ${slot.size}`,
}));

export default function MySizesScreen() {
  const { account } = useAuth();
  const shoeSize = account?.shoeSize;

  const cells = [
    ...UNIFORM_CELLS,
    {
      label: 'Shoe size',
      value: shoeSize ? `${shoeSize.gender} · ${shoeSize.size || '—'}` : '—',
    },
    { label: MY_WHITE_SHIRT.piece, value: `${MY_WHITE_SHIRT.color} · ${MY_WHITE_SHIRT.size}` },
  ];

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.appBody}>
        <TapeGutter />
        <ScrollView style={styles.flexOne} contentContainerStyle={styles.content}>
          <Text style={styles.title}>My sizes</Text>
          <Text style={styles.subtitle}>Assigned sizes</Text>
          <View style={styles.grid}>
            {cells.map((cell, index) => (
              <View
                key={cell.label}
                style={[
                  styles.cell,
                  index % 2 === 0 && styles.cellBorderRight,
                  index < cells.length - 2 && styles.cellBorderBottom,
                ]}
              >
                <Text style={styles.cellLabel}>{cell.label}</Text>
                <Text style={styles.cellValue}>{cell.value}</Text>
              </View>
            ))}
          </View>
          <View style={styles.note}>
            <Text style={styles.noteText}>
              If any of these look wrong, let a uniform manager know — sizes can only be changed
              by staff.
            </Text>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  flexOne: { flex: 1 },
  appBody: { flex: 1, flexDirection: 'row' },
  content: { padding: 18, paddingBottom: 28 },
  title: { fontFamily: fonts.wordmark, fontSize: 24, color: colors.ink, marginBottom: 16 },
  subtitle: { fontFamily: fonts.blockTitle, fontSize: 15.5, color: colors.ink, marginBottom: 10 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: 20,
  },
  cell: {
    width: '50%',
    backgroundColor: colors.surface,
    padding: 14,
  },
  cellBorderRight: { borderRightWidth: 1, borderRightColor: colors.line },
  cellBorderBottom: { borderBottomWidth: 1, borderBottomColor: colors.line },
  cellLabel: { fontFamily: fonts.body, fontSize: 11.5, color: colors.inkSoft, marginBottom: 4 },
  cellValue: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.ink },
  note: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    padding: 14,
  },
  noteText: { fontFamily: fonts.body, fontSize: 12.5, color: colors.inkSoft, lineHeight: 18 },
});
