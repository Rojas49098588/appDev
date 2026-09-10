import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { MainTabParamList } from '../navigation/types';
import { colors } from '../constants/colors';
import { fonts } from '../constants/fonts';
import { PIECES, type Piece } from '../constants/inventoryData';
import TapeGutter from '../components/TapeGutter';
import PieceCard from '../components/PieceCard';
import { BackChevronIcon, PlusIcon, SearchIcon } from '../components/icons';

type Props = BottomTabScreenProps<MainTabParamList, 'Inventory'>;

type FilterKey = 'good' | 'repair' | 'dirty' | 'retired';

const FILTER_CHIPS: { key: FilterKey; label: string }[] = [
  { key: 'good', label: 'Good' },
  { key: 'repair', label: 'Needs repair' },
  { key: 'dirty', label: 'Dirty' },
  { key: 'retired', label: 'Retired' },
];

export default function InventoryScreen({ navigation }: Props) {
  const [searchText, setSearchText] = useState('');
  const [activeFilters, setActiveFilters] = useState<Set<FilterKey>>(new Set());

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
    const flaggedCount = PIECES.filter((p) => p.repairCount > 0 || p.dirtyCount > 0).length;
    const repairTotal = PIECES.reduce((sum, p) => sum + p.repairCount, 0);
    const dirtyTotal = PIECES.reduce((sum, p) => sum + p.dirtyCount, 0);
    return { flaggedCount, repairTotal, dirtyTotal };
  }, []);

  const visiblePieces = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    return PIECES.filter((piece) => {
      const matchesSearch =
        !query ||
        piece.name.toLowerCase().includes(query) ||
        piece.colorsLabel.toLowerCase().includes(query);
      if (!matchesSearch) return false;

      if (activeFilters.size === 0) return true;
      return (
        (activeFilters.has('good') &&
          piece.repairCount === 0 &&
          piece.dirtyCount === 0 &&
          !piece.retired) ||
        (activeFilters.has('repair') && piece.repairCount > 0) ||
        (activeFilters.has('dirty') && piece.dirtyCount > 0) ||
        (activeFilters.has('retired') && !!piece.retired)
      );
    });
  }, [searchText, activeFilters]);

  const handleFlagPress = (piece: Piece, kind: 'repair' | 'dirty') => {
    Alert.alert('Coming soon', `Viewing ${kind} items for ${piece.name} isn't available yet.`);
  };

  const handleAddPress = () => {
    Alert.alert('Coming soon', 'Adding a new piece isn’t available yet.');
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.appBody}>
        <TapeGutter />

        <ScrollView style={styles.flexOne} contentContainerStyle={styles.content}>
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
            />
          </View>

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

          <Text style={styles.summaryLine}>
            <Text style={styles.summaryBold}>{summary.flaggedCount}</Text> piece types flagged —{' '}
            <Text style={styles.summaryBold}>{summary.repairTotal}</Text> need repair ·{' '}
            <Text style={styles.summaryBold}>{summary.dirtyTotal}</Text> need cleaning
          </Text>

          {visiblePieces.map((piece) => (
            <PieceCard key={piece.name} piece={piece} onFlagPress={handleFlagPress} />
          ))}
        </ScrollView>
      </View>
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
    marginBottom: 18,
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
  summaryLine: {
    fontFamily: fonts.body,
    fontSize: 11.5,
    color: colors.inkSoft,
    marginBottom: 12,
  },
  summaryBold: {
    fontFamily: fonts.bodyMedium,
    color: colors.ink,
  },
});
