import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors } from '../constants/colors';
import { fonts } from '../constants/fonts';
import { useFlags } from '../context/FlagsContext';
import { useInventory } from '../context/InventoryContext';
import { useAuth } from '../context/AuthContext';
import { chipState } from '../lib/flagHistory';
import { numberRows, ownerIndex } from '../lib/inventory';
import TapeGutter from '../components/TapeGutter';
import { BackChevronIcon } from '../components/icons';

type Props = NativeStackScreenProps<RootStackParamList, 'PieceTable'>;

type TabKey = 'all' | 'assigned' | 'unassigned' | 'flagged';

export default function PieceTableScreen({ navigation, route }: Props) {
  const { pieceTypeId } = route.params;
  const { pieceTypes, pieces } = useInventory();
  const { flags } = useFlags();
  const { accounts } = useAuth();
  const [tab, setTab] = useState<TabKey>('all');
  const type = pieceTypes.find((t) => t.id === pieceTypeId);
  const owners = useMemo(() => ownerIndex(accounts), [accounts]);

  const rows = useMemo(() => {
    if (!type) return [];
    return numberRows(type, pieces, owners).map((row) => ({
      ...row,
      flagged: Object.entries(row.cells).some(
        ([color, p]) => p !== null && chipState(flags, type.name, color, row.number) !== null
      ),
    }));
  }, [type, pieces, owners, flags]);

  const header = (
    <View style={styles.header}>
      <Pressable
        style={styles.headerSideButton}
        onPress={() => navigation.goBack()}
        accessibilityLabel="Back"
      >
        <BackChevronIcon color={colors.ink} />
      </Pressable>
      <Text style={styles.pageTitle}>{type ? `Every ${type.name}` : 'Every piece'}</Text>
      <View style={styles.headerSideButton} />
    </View>
  );

  if (!type) {
    return (
      <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
        <View style={styles.appBody}>
          <TapeGutter />
          <View style={styles.content}>
            {header}
            <Text style={styles.empty}>This piece type isn't in inventory anymore.</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'all', label: `All ${rows.length}` },
    { key: 'assigned', label: 'Assigned' },
    { key: 'unassigned', label: 'Unassigned' },
    { key: 'flagged', label: 'Flagged' },
  ];
  const shown = rows.filter((r) =>
    tab === 'all'
      ? true
      : tab === 'assigned'
        ? r.owner !== null
        : tab === 'unassigned'
          ? r.owner === null
          : r.flagged
  );

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.appBody}>
        <TapeGutter />
        <FlatList
          style={styles.flexOne}
          contentContainerStyle={styles.content}
          data={shown}
          keyExtractor={(r) => r.number}
          ListHeaderComponent={
            <View>
              {header}
              <View style={styles.tabs}>
                {tabs.map((t) => (
                  <Pressable
                    key={t.key}
                    style={[styles.tab, tab === t.key && styles.tabActive]}
                    onPress={() => setTab(t.key)}
                  >
                    <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
                  </Pressable>
                ))}
              </View>
              <View style={styles.row}>
                <Text style={[styles.numberCell, styles.colHead]}>No.</Text>
                <Text style={[styles.ownerCell, styles.colHead]}>Held by</Text>
                {type.colors.map((c) => (
                  <Text key={c} style={[styles.pieceCell, styles.colHead]} numberOfLines={1}>
                    {c.slice(0, 3)}
                  </Text>
                ))}
              </View>
            </View>
          }
          ListEmptyComponent={<Text style={styles.empty}>Nothing here.</Text>}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Text style={styles.numberCell}>{item.number}</Text>
              <Text style={[styles.ownerCell, !item.owner && styles.unassigned]} numberOfLines={1}>
                {item.owner ? `${item.owner.firstName} ${item.owner.lastName}`.trim() : 'Unassigned'}
              </Text>
              {type.colors.map((color) => {
                const p = item.cells[color];
                if (!p) {
                  return (
                    <Text key={color} style={[styles.pieceCell, styles.missing]}>
                      {'–'}
                    </Text>
                  );
                }
                const state = chipState(flags, type.name, color, item.number);
                const letter = state === 'repair' ? 'R' : state === 'dirty' ? 'D' : p.outForRepair ? 'O' : '';
                return (
                  <View key={color} style={styles.pieceCell}>
                    <Pressable
                      style={[
                        styles.box,
                        p.outForRepair && styles.boxOut,
                        state === 'repair' && styles.boxRepair,
                        state === 'dirty' && styles.boxDirty,
                      ]}
                      onPress={() =>
                        navigation.navigate('PieceHistory', { piece: type.name, color, size: item.number })
                      }
                      accessibilityLabel={`${color} ${item.number} history`}
                    >
                      <Text
                        style={[
                          styles.boxText,
                          !state && p.outForRepair && { color: colors.amber },
                          state === 'repair' && { color: colors.rust },
                          state === 'dirty' && { color: colors.wash },
                        ]}
                      >
                        {letter}
                      </Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          )}
          ListFooterComponent={
            <Text style={styles.legend}>
              Empty square = fine {'·'} R repair {'·'} D dirty {'·'} O out for repair {'·'}{' '}
              {'–'} no such piece
            </Text>
          }
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  flexOne: { flex: 1 },
  appBody: { flex: 1, flexDirection: 'row' },
  content: { flexGrow: 1, paddingTop: 16, paddingHorizontal: 18, paddingBottom: 28 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 14 },
  headerSideButton: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  pageTitle: { flex: 1, textAlign: 'center', fontFamily: fonts.wordmark, fontSize: 18, color: colors.ink },
  empty: { fontFamily: fonts.body, fontSize: 12.5, color: colors.inkFaint, paddingVertical: 12 },
  tabs: { flexDirection: 'row', gap: 6, marginBottom: 12, flexWrap: 'wrap' },
  tab: { borderWidth: 1, borderColor: colors.line, paddingVertical: 6, paddingHorizontal: 10 },
  tabActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  tabText: { fontFamily: fonts.bodyMedium, fontSize: 11.5, color: colors.inkSoft },
  tabTextActive: { color: colors.paper },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: colors.lineSoft,
  },
  colHead: { fontFamily: fonts.bodyMedium, fontSize: 10.5, color: colors.inkSoft },
  numberCell: { width: 44, fontFamily: fonts.mono, fontSize: 13, fontWeight: '700', color: colors.ink },
  ownerCell: { flex: 1, fontFamily: fonts.body, fontSize: 12.5, color: colors.ink },
  unassigned: { color: colors.inkFaint, fontStyle: 'italic' },
  pieceCell: { width: 40, alignItems: 'center', textAlign: 'center' },
  missing: { fontFamily: fonts.mono, fontSize: 12, color: colors.inkFaint },
  box: {
    width: 26,
    height: 26,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOut: { borderColor: colors.amber, backgroundColor: colors.amberTint },
  boxRepair: { borderColor: colors.rust, backgroundColor: colors.rustTint },
  boxDirty: { borderColor: colors.wash, backgroundColor: colors.washTint },
  boxText: { fontFamily: fonts.bodyMedium, fontSize: 11 },
  legend: { fontFamily: fonts.body, fontSize: 10.5, color: colors.inkSoft, marginTop: 12 },
});
