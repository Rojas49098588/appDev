import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MainTabParamList, RootStackParamList } from '../navigation/types';
import { useTheme, useThemedStyles, type Theme } from '../hooks/useTheme';
import { fonts } from '../constants/fonts';
import { SECTIONS } from '../constants/homeData';
import { sectionForInstrument } from '../constants/instrumentSections';
import { useAuth } from '../context/AuthContext';
import { useCombos } from '../context/CombosContext';
import { homeStats, sectionCounts } from '../lib/homeStats';
import { useFlags } from '../context/FlagsContext';
import { useInventory } from '../context/InventoryContext';
import { useGames } from '../context/GamesContext';
import { pieceCount } from '../lib/inventory';
import { shownFootball } from '../lib/games';
import { formatGameDate } from '../lib/format';
import TapeGutter from '../components/TapeGutter';

type Props = BottomTabScreenProps<MainTabParamList, 'Home'> & {
  firstName: string;
  lastName: string;
  onAvatarPress: () => void;
};

export default function HomeScreen({ navigation, firstName, lastName, onAvatarPress }: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  const { flags } = useFlags();
  const { pieceTypes, pieces } = useInventory();
  const { games, today } = useGames();
  const { accounts } = useAuth();
  const { combos } = useCombos();
  const sectionNames = useMemo(() => SECTIONS.map((s) => s.name), []);
  const stats = useMemo(
    () => homeStats(accounts, sectionNames, sectionForInstrument, combos.length, flags),
    [accounts, sectionNames, combos.length, flags]
  );
  const sections = useMemo(
    () => sectionCounts(accounts, sectionNames, sectionForInstrument),
    [accounts, sectionNames]
  );
  const nextFootball = shownFootball(games, today);
  const gamesNote = nextFootball
    ? `Next: vs. ${nextFootball.opponent}, ${nextFootball.gameDate ? formatGameDate(nextFootball.gameDate) : 'date TBD'}`
    : 'No football game posted';
  // Archived members is a root stack route, outside the tab navigator.
  const rootNavigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const inventoryPreview = useMemo(() => {
    return pieceTypes.filter((type) => !type.retired).map((piece) => {
      const pieceFlags = flags.filter((f) => f.piece === piece.name);
      const repairCount = pieceFlags.filter((f) => f.status === 'repair').length;
      const dirtyCount = pieceFlags.filter((f) => f.status === 'dirty').length;
      const kind: 'repair' | 'dirty' | 'good' =
        repairCount > 0 ? 'repair' : dirtyCount > 0 ? 'dirty' : 'good';
      return {
        piece: piece.name,
        sizes: piece.colors.join(', '),
        qty: pieceCount(piece, pieces),
        condition:
          repairCount > 0 ? `Repair (${repairCount})` : dirtyCount > 0 ? `Dirty (${dirtyCount})` : 'Good',
        kind,
      };
    });
  }, [flags, pieceTypes, pieces]);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.appBody}>
        <TapeGutter />
        <ScrollView style={styles.flexOne} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View>
            <Text style={styles.wordmark}>Mustang Closet</Text>
            <Text style={styles.wordmarkSub}>SMU Mustang Band</Text>
            <Text style={styles.seasonTag}>Fall 2026 season</Text>
          </View>
          <Pressable style={styles.avatar} onPress={onAvatarPress}>
            <Text style={styles.avatarText}>{initials}</Text>
          </Pressable>
        </View>

        <View style={styles.statsGrid}>
          {stats.map((stat, index) => (
            <View
              key={stat.label}
              style={[
                styles.statCell,
                index % 2 === 0 && styles.statCellBorderRight,
                index < 2 && styles.statCellBorderBottom,
              ]}
            >
              <Text style={[styles.statNum, stat.flag && styles.statNumFlag]}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.block}>
          <View style={styles.blockHead}>
            <Text style={styles.blockTitle}>Members by section</Text>
            <Pressable
              onPress={() =>
                navigation.navigate('Sections', { section: undefined, piece: undefined, status: undefined })
              }
            >
              <Text style={styles.blockLink}>See all ›</Text>
            </Pressable>
          </View>
          <View style={styles.sectionGrid}>
            {sections.map((section) => (
              <Pressable
                key={section.name}
                style={styles.sectionCard}
                onPress={() =>
                  navigation.navigate('Sections', {
                    section: section.name,
                    piece: undefined,
                    status: undefined,
                  })
                }
              >
                <Text style={styles.sectionName}>{section.name}</Text>
                <Text style={styles.sectionCount}>{section.count}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.block}>
          <View style={styles.blockHead}>
            <Text style={styles.blockTitle}>Inventory</Text>
            <Pressable onPress={() => navigation.navigate('Inventory')}>
              <Text style={styles.blockLink}>View full ›</Text>
            </Pressable>
          </View>
          {inventoryPreview.length === 0 && (
            <Text style={styles.blockNote}>No inventory yet. Import your spreadsheet to get started.</Text>
          )}
          <View style={styles.invList}>
            {inventoryPreview.map((item) => {
              const warnColor = item.kind === 'repair' ? colors.rust : colors.wash;
              return (
                <View key={item.piece} style={styles.invRow}>
                  <View>
                    <Text style={styles.invPiece}>{item.piece}</Text>
                    <Text style={styles.invSizes}>{item.sizes}</Text>
                  </View>
                  <View style={styles.invRight}>
                    <Text style={styles.invQty}>{item.qty}</Text>
                    <View style={styles.condRow}>
                      <View
                        style={[
                          styles.dot,
                          item.kind !== 'good' && styles.dotWarn,
                          item.kind !== 'good' && { backgroundColor: warnColor },
                        ]}
                      />
                      <Text
                        style={[
                          styles.condText,
                          item.kind !== 'good' && { color: warnColor },
                        ]}
                      >
                        {item.condition}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.block}>
          <View style={styles.blockHead}>
            <Text style={styles.blockTitle}>Games</Text>
            <Pressable onPress={() => rootNavigation.navigate('Games')}>
              <Text style={styles.blockLink}>View ›</Text>
            </Pressable>
          </View>
          <Text style={styles.blockNote}>{gamesNote}</Text>
        </View>

        <View style={styles.block}>
          <View style={styles.blockHead}>
            <Text style={styles.blockTitle}>Archived members</Text>
            <Pressable onPress={() => rootNavigation.navigate('ArchivedMembers')}>
              <Text style={styles.blockLink}>View ›</Text>
            </Pressable>
          </View>
          <Text style={styles.blockNote}>Snapshots of members who left, with the option to restore them.</Text>
        </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: t.colors.paper,
  },
  flexOne: {
    flex: 1,
  },
  appBody: {
    flex: 1,
    flexDirection: 'row',
  },
  content: {
    padding: 18,
    paddingBottom: 28,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: t.colors.line,
    marginBottom: 20,
  },
  wordmark: {
    fontFamily: fonts.wordmark,
    fontSize: t.font(21),
    color: t.colors.ink,
  },
  wordmarkSub: {
    fontFamily: fonts.body,
    marginTop: 3,
    color: t.colors.inkSoft,
    fontSize: t.font(11.5),
  },
  seasonTag: {
    fontFamily: fonts.body,
    fontSize: t.font(11),
    color: t.colors.inkSoft,
    marginTop: 3,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: t.colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: fonts.wordmark,
    color: t.colors.paper,
    fontSize: t.font(14),
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderWidth: 1,
    borderColor: t.colors.line,
    marginBottom: 26,
  },
  statCell: {
    width: '50%',
    backgroundColor: t.colors.surface,
    padding: 14,
    paddingBottom: 15,
  },
  statCellBorderRight: {
    borderRightWidth: 1,
    borderRightColor: t.colors.line,
  },
  statCellBorderBottom: {
    borderBottomWidth: 1,
    borderBottomColor: t.colors.line,
  },
  statNum: {
    fontFamily: fonts.monoMedium,
    fontSize: t.font(24),
    color: t.colors.ink,
  },
  statNumFlag: {
    color: t.colors.rust,
  },
  statLabel: {
    fontFamily: fonts.body,
    marginTop: 2,
    fontSize: t.font(11.5),
    color: t.colors.inkSoft,
  },
  block: {
    marginBottom: 28,
  },
  blockHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 13,
  },
  blockTitle: {
    fontFamily: fonts.blockTitle,
    fontSize: t.font(15.5),
    color: t.colors.ink,
  },
  blockNote: {
    fontFamily: fonts.body,
    fontSize: t.font(12),
    color: t.colors.inkSoft,
  },
  // Solid dark button so the block links are easy to spot.
  blockLink: {
    fontFamily: fonts.bodySemiBold,
    fontSize: t.font(12),
    color: t.colors.white,
    backgroundColor: t.colors.ink,
    paddingVertical: 6,
    paddingHorizontal: 11,
    overflow: 'hidden',
  },
  sectionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sectionCard: {
    width: '31.5%',
    borderWidth: 1,
    borderColor: t.colors.line,
    backgroundColor: t.colors.surface,
    padding: 9,
    paddingTop: 9,
    paddingBottom: 10,
  },
  sectionName: {
    fontFamily: fonts.bodyMedium,
    fontSize: t.font(11.5),
    lineHeight: t.font(14),
    minHeight: 28,
    color: t.colors.ink,
  },
  sectionCount: {
    fontFamily: fonts.mono,
    fontSize: t.font(10),
    color: t.colors.inkSoft,
    marginTop: 5,
  },
  invList: {
    borderTopWidth: 1,
    borderTopColor: t.colors.line,
  },
  invRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: t.colors.lineSoft,
  },
  invPiece: {
    fontFamily: fonts.bodyMedium,
    fontSize: t.font(13),
    color: t.colors.ink,
  },
  invSizes: {
    fontFamily: fonts.body,
    fontSize: t.font(11),
    color: t.colors.inkSoft,
    marginTop: 2,
  },
  invRight: {
    alignItems: 'flex-end',
  },
  invQty: {
    fontFamily: fonts.mono,
    fontSize: t.font(13),
    color: t.colors.ink,
  },
  condRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 3,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: t.colors.ink,
  },
  dotWarn: {
    borderRadius: 1,
    transform: [{ rotate: '45deg' }],
  },
  condText: {
    fontFamily: fonts.body,
    fontSize: t.font(10.5),
    color: t.colors.ink,
  },
});
}
