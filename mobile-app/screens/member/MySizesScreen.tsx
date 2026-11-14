import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme, useThemedStyles, type Theme } from '../../hooks/useTheme';
import { fonts } from '../../constants/fonts';
import { MY_WHITE_SHIRT, NO_SIZE, uniformFor } from '../../constants/myUniformData';
import { useAuth } from '../../context/AuthContext';
import { useInventory } from '../../context/InventoryContext';
import TapeGutter from '../../components/TapeGutter';

export default function MySizesScreen() {
  const styles = useThemedStyles(makeStyles);
  const { expanded, isLarge } = useTheme();
  const asList = expanded || isLarge;
  const { account } = useAuth();
  const { pieceTypes, pieces } = useInventory();
  const shoeSize = account?.shoeSize;

  const cells = [
    ...uniformFor(pieceTypes, pieces, account?.numbers).map((slot) => ({
      label: slot.piece,
      value: `${slot.variants.map((v) => v.color).join(', ')} · ${slot.size || NO_SIZE}`,
    })),
    {
      label: 'Shoe size',
      value: shoeSize ? `${shoeSize.gender} · ${shoeSize.size || '—'}` : '—',
    },
    { label: MY_WHITE_SHIRT.piece, value: `${MY_WHITE_SHIRT.color} · ${account?.whiteShirtSize || '—'}` },
  ];

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.appBody}>
        <TapeGutter />
        <ScrollView style={styles.flexOne} contentContainerStyle={styles.content}>
          <Text style={styles.title} accessibilityRole="header">My sizes</Text>
          <Text style={styles.subtitle}>Assigned sizes</Text>
          {asList ? (
            <View style={styles.list}>
              {cells.map((cell) => (
                <View key={cell.label} style={styles.listRow} accessible accessibilityLabel={`${cell.label}: ${cell.value}`}>
                  <Text style={styles.listLabel}>{cell.label}</Text>
                  <Text style={styles.listValue}>{cell.value}</Text>
                </View>
              ))}
            </View>
          ) : (
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
          )}
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

function makeStyles(t: Theme) {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: t.colors.paper },
  flexOne: { flex: 1 },
  appBody: { flex: 1, flexDirection: 'row' },
  content: { padding: 18, paddingBottom: 28 },
  title: { fontFamily: fonts.wordmark, fontSize: t.font(24), color: t.colors.ink, marginBottom: 16 },
  subtitle: { fontFamily: fonts.blockTitle, fontSize: t.font(15.5), color: t.colors.ink, marginBottom: 10 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderWidth: 1,
    borderColor: t.colors.line,
    marginBottom: 20,
  },
  cell: {
    width: '50%',
    backgroundColor: t.colors.surface,
    padding: 14,
  },
  // Expanded / large text: one full-width rectangle per piece.
  list: { gap: 10, marginBottom: 20 },
  listRow: {
    flexDirection: t.isLarge ? 'column' : 'row',
    justifyContent: 'space-between',
    alignItems: t.isLarge ? 'flex-start' : 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: t.colors.line,
    backgroundColor: t.colors.surface,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  listLabel: { fontFamily: fonts.body, fontSize: t.font(14), color: t.colors.inkSoft, flexShrink: 1 },
  listValue: { fontFamily: fonts.bodySemiBold, fontSize: t.font(17), color: t.colors.ink },
  cellBorderRight: { borderRightWidth: 1, borderRightColor: t.colors.line },
  cellBorderBottom: { borderBottomWidth: 1, borderBottomColor: t.colors.line },
  cellLabel: { fontFamily: fonts.body, fontSize: t.font(11.5), color: t.colors.inkSoft, marginBottom: 4 },
  cellValue: { fontFamily: fonts.bodyMedium, fontSize: t.font(15), color: t.colors.ink },
  note: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: t.colors.line,
    backgroundColor: t.colors.surface,
    padding: 14,
  },
  noteText: { fontFamily: fonts.body, fontSize: t.font(12.5), color: t.colors.inkSoft, lineHeight: t.font(18) },
});
}
