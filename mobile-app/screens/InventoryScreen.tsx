import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MainTabParamList, RootStackParamList } from '../navigation/types';
import { colors } from '../constants/colors';
import { fonts } from '../constants/fonts';
import type { InventoryPiece, PieceType } from '../lib/models';
import TapeGutter from '../components/TapeGutter';
import PieceCard from '../components/PieceCard';
import AddInventorySheet from '../components/AddInventorySheet';
import AddColorSheet from '../components/AddColorSheet';
import AddNumberSheet from '../components/AddNumberSheet';
import { BackChevronIcon, PlusIcon, SearchIcon } from '../components/icons';
import { useFlags } from '../context/FlagsContext';
import { useInventory } from '../context/InventoryContext';
import { useAuth } from '../context/AuthContext';
import { chipState } from '../lib/flagHistory';
import { assignmentFor, ownerIndex, unknownNumbers } from '../lib/inventory';
import { useScrollToInput } from '../hooks/useScrollToInput';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Inventory'>,
  NativeStackScreenProps<RootStackParamList>
>;

type FilterKey = 'good' | 'repair' | 'dirty' | 'retired';

type AssignKey = 'all' | 'assigned' | 'unassigned' | 'out_for_repair';

const ASSIGN_CHIPS: { key: AssignKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'assigned', label: 'Assigned' },
  { key: 'unassigned', label: 'Unassigned' },
  { key: 'out_for_repair', label: 'Out for repair' },
];

const FILTER_CHIPS: { key: FilterKey; label: string }[] = [
  { key: 'good', label: 'Good' },
  { key: 'repair', label: 'Needs repair' },
  { key: 'dirty', label: 'Dirty' },
  { key: 'retired', label: 'Retired' },
];

export default function InventoryScreen({ navigation }: Props) {
  const [searchText, setSearchText] = useState('');
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [colorTarget, setColorTarget] = useState<PieceType | null>(null);
  const [numberTarget, setNumberTarget] = useState<PieceType | null>(null);
  const [activeFilters, setActiveFilters] = useState<Set<FilterKey>>(new Set());
  const { flags } = useFlags();
  const { pieceTypes, pieces, syncedAt, error: inventoryError } = useInventory();
  const { accounts } = useAuth();
  const [assignFilter, setAssignFilter] = useState<AssignKey>('all');
  const owners = useMemo(() => ownerIndex(accounts), [accounts]);
  const unknown = useMemo(() => unknownNumbers(accounts, pieces), [accounts, pieces]);
  const unassignedTotal = useMemo(
    () => pieces.filter((p) => assignmentFor(p, owners).state === 'unassigned').length,
    [pieces, owners]
  );
  const { scrollRef, handleScroll, scrollToFocusedInput } = useScrollToInput();

  const pieceCounts = useMemo(() => {
    const counts = new Map<string, { repairCount: number; dirtyCount: number }>();
    for (const piece of pieceTypes) {
      const pieceFlags = flags.filter((f) => f.piece === piece.name);
      counts.set(piece.name, {
        repairCount: pieceFlags.filter((f) => f.status === 'repair').length,
        dirtyCount: pieceFlags.filter((f) => f.status === 'dirty').length,
      });
    }
    return counts;
  }, [flags, pieceTypes]);

  const toggleFilter = (key: FilterKey) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const summary = useMemo(() => {
    let flaggedCount = 0;
    let repairTotal = 0;
    let dirtyTotal = 0;
    for (const piece of pieceTypes) {
      const counts = pieceCounts.get(piece.name)!;
      if (counts.repairCount > 0 || counts.dirtyCount > 0) flaggedCount += 1;
      repairTotal += counts.repairCount;
      dirtyTotal += counts.dirtyCount;
    }
    return { flaggedCount, repairTotal, dirtyTotal };
  }, [pieceCounts]);

  // Numbered types filter per piece; counted types only show under Assignment = All.
  const pieceMatches = (type: PieceType, piece: InventoryPiece) => {
    if (assignFilter !== 'all' && assignmentFor(piece, owners).state !== assignFilter) return false;
    if (activeFilters.size === 0) return true;
    const state = chipState(flags, type.name, piece.color, piece.number);
    return (
      (activeFilters.has('good') && state === null && !type.retired) ||
      (activeFilters.has('repair') && state === 'repair') ||
      (activeFilters.has('dirty') && state === 'dirty') ||
      (activeFilters.has('retired') && type.retired)
    );
  };

  const visiblePieces = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    return pieceTypes.filter((piece) => {
      const matchesSearch =
        !query ||
        piece.name.toLowerCase().includes(query) ||
        piece.colors.some((color) => color.toLowerCase().includes(query));
      if (!matchesSearch) return false;

      if (piece.kind === 'numbered') {
        if (assignFilter === 'all' && activeFilters.size === 0) return true;
        return pieces.some((p) => p.pieceTypeId === piece.id && pieceMatches(piece, p));
      }
      if (assignFilter !== 'all') return false;
      if (activeFilters.size === 0) return true;
      const counts = pieceCounts.get(piece.name)!;
      return (
        (activeFilters.has('good') && counts.repairCount === 0 && counts.dirtyCount === 0 && !piece.retired) ||
        (activeFilters.has('repair') && counts.repairCount > 0) ||
        (activeFilters.has('dirty') && counts.dirtyCount > 0) ||
        (activeFilters.has('retired') && piece.retired)
      );
    });
    // pieceMatches closes over assignFilter, activeFilters, owners and flags, all listed here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchText, activeFilters, assignFilter, pieceCounts, pieceTypes, pieces, owners, flags]);

  const showUnknown = () =>
    Alert.alert(
      'Not in inventory',
      unknown.map((u) => `${u.memberName} — ${u.pieceType} ${u.number}`).join('\n')
    );

  const handleFlagPress = (piece: PieceType, kind: 'repair' | 'dirty') => {
    navigation.navigate('Sections', { piece: piece.name, status: kind, section: undefined });
  };

  // Staff only: this screen is mounted by MainTabs, which only staff reach (members get MemberTabs).
  const handleAddPress = () => setAddMenuOpen(true);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.appBody}>
        <TapeGutter />

        <ScrollView
          ref={scrollRef}
          style={styles.flexOne}
          contentContainerStyle={styles.content}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          <View style={styles.header}>
            {navigation.canGoBack() ? (
              <Pressable style={styles.headerSideButton} onPress={() => navigation.goBack()}>
                <BackChevronIcon color={colors.ink} />
              </Pressable>
            ) : (
              <View style={styles.headerSideButton} />
            )}
            <Text style={styles.pageTitle}>Inventory</Text>
            <Pressable style={styles.addButton} onPress={handleAddPress}>
              <PlusIcon color={colors.paper} />
            </Pressable>
          </View>

          <View style={styles.search}>
            <SearchIcon color={colors.inkFaint} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search pieces"
              placeholderTextColor={colors.inkFaint}
              value={searchText}
              onChangeText={setSearchText}
              onFocus={scrollToFocusedInput}
            />
          </View>

          <Text style={styles.filterLabel}>Condition</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipsScroll}
            contentContainerStyle={styles.chipsContent}
          >
            <Pressable
              style={[styles.chip, activeFilters.size === 0 && styles.chipActive]}
              onPress={() => setActiveFilters(new Set())}
            >
              <Text
                style={[styles.chipText, activeFilters.size === 0 && styles.chipTextActive]}
              >
                All pieces
              </Text>
            </Pressable>
            {FILTER_CHIPS.map(({ key, label }) => {
              const active = activeFilters.has(key);
              const isRepair = key === 'repair';
              const isDirty = key === 'dirty';
              return (
                <Pressable
                  key={key}
                  style={[
                    styles.chip,
                    isRepair && styles.chipRepair,
                    isDirty && styles.chipDirty,
                    active && !isRepair && !isDirty && styles.chipActive,
                    active && isRepair && styles.chipRepairActive,
                    active && isDirty && styles.chipDirtyActive,
                  ]}
                  onPress={() => toggleFilter(key)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      isRepair && styles.chipTextRepair,
                      isDirty && styles.chipTextDirty,
                      active && styles.chipTextActive,
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Text style={styles.filterLabel}>Assignment</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipsScroll}
            contentContainerStyle={styles.chipsContent}
          >
            {ASSIGN_CHIPS.map(({ key, label }) => {
              const active = assignFilter === key;
              return (
                <Pressable
                  key={key}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setAssignFilter(key)}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Text style={styles.summaryLine}>
            <Text style={styles.summaryBold}>{summary.flaggedCount}</Text> piece types flagged —{' '}
            <Text style={styles.summaryBold}>{summary.repairTotal}</Text> need repair ·{' '}
            <Text style={styles.summaryBold}>{summary.dirtyTotal}</Text> need cleaning ·{' '}
            <Text style={styles.summaryBold}>{unassignedTotal}</Text> unassigned
          </Text>

          {pieces.length > 0 && unknown.length > 0 && (
            <Pressable onPress={showUnknown}>
              <Text style={styles.unknownWarning}>
                {unknown.length} member {unknown.length === 1 ? 'number isn\u2019t' : 'numbers aren\u2019t'} in inventory
              </Text>
            </Pressable>
          )}

          {inventoryError !== null && <Text style={styles.empty}>{inventoryError}</Text>}
          {pieceTypes.length === 0 && inventoryError === null && syncedAt === null && (
            <Text style={styles.empty}>Loading inventory…</Text>
          )}
          {pieceTypes.length === 0 && inventoryError === null && syncedAt !== null && (
            <Text style={styles.empty}>No inventory yet. Import your spreadsheet to get started.</Text>
          )}

          {visiblePieces.map((piece) => {
            const counts = pieceCounts.get(piece.name)!;
            return (
              <PieceCard
                key={piece.id}
                piece={piece}
                pieces={pieces.filter((p) => p.pieceTypeId === piece.id)}
                repairCount={counts.repairCount}
                dirtyCount={counts.dirtyCount}
                onFlagPress={handleFlagPress}
                onAddColor={() => setColorTarget(piece)}
                onAddNumber={() => setNumberTarget(piece)}
                onSeeAll={() => navigation.navigate('PieceTable', { pieceTypeId: piece.id })}
                onSizePress={(color, size) =>
                  navigation.navigate('PieceHistory', { piece: piece.name, color, size })
                }
                chipStateFor={(c, s) => chipState(flags, piece.name, c, s)}
                assignmentFor={(p) => assignmentFor(p, owners)}
                matches={(p) => pieceMatches(piece, p)}
              />
            );
          })}
        </ScrollView>
      </View>
      <AddInventorySheet
        visible={addMenuOpen}
        onClose={() => setAddMenuOpen(false)}
        onImport={() => {
          setAddMenuOpen(false);
          navigation.navigate('ImportInventory');
        }}
        onNewType={() => {
          setAddMenuOpen(false);
          navigation.navigate('AddPieceType');
        }}
      />
      <AddColorSheet
        piece={colorTarget}
        numberCount={
          colorTarget
            ? new Set(pieces.filter((p) => p.pieceTypeId === colorTarget.id).map((p) => p.number)).size
            : 0
        }
        onClose={() => setColorTarget(null)}
      />
      <AddNumberSheet piece={numberTarget} onClose={() => setNumberTarget(null)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  flexOne: {
    flex: 1,
  },
  appBody: {
    flex: 1,
    flexDirection: 'row',
  },
  content: {
    paddingTop: 16,
    paddingHorizontal: 18,
    paddingBottom: 28,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
  },
  headerSideButton: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fonts.wordmark,
    fontSize: 18,
    color: colors.ink,
  },
  addButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingVertical: 9,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.ink,
    padding: 0,
  },
  chipsScroll: {
    marginHorizontal: -18,
    marginBottom: 10,
  },
  chipsContent: {
    flexDirection: 'row',
    gap: 7,
    paddingHorizontal: 18,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  chipActive: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  chipRepair: {
    borderColor: colors.rust,
  },
  chipRepairActive: {
    backgroundColor: colors.rust,
    borderColor: colors.rust,
  },
  chipDirty: {
    borderColor: colors.wash,
  },
  chipDirtyActive: {
    backgroundColor: colors.wash,
    borderColor: colors.wash,
  },
  chipText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.inkSoft,
  },
  chipTextRepair: {
    color: colors.rust,
  },
  chipTextDirty: {
    color: colors.wash,
  },
  chipTextActive: {
    color: colors.paper,
  },
  filterLabel: {
    fontFamily: fonts.body,
    fontSize: 10.5,
    color: colors.inkFaint,
    marginBottom: 5,
  },
  unknownWarning: {
    fontFamily: fonts.body,
    fontSize: 11.5,
    color: colors.amber,
    marginBottom: 10,
  },
  summaryLine: {
    fontFamily: fonts.body,
    fontSize: 11.5,
    color: colors.inkSoft,
    marginBottom: 12,
  },
  empty: {
    fontFamily: fonts.body,
    fontSize: 12.5,
    color: colors.inkFaint,
  },
  summaryBold: {
    fontFamily: fonts.bodyMedium,
    color: colors.ink,
  },
});
