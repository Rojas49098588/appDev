import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { MainTabParamList } from '../navigation/types';
import { colors } from '../constants/colors';
import { fonts } from '../constants/fonts';
import { STATS, SECTIONS, CATALOGUE, INVENTORY } from '../constants/homeData';
import TapeGutter from '../components/TapeGutter';

type Props = BottomTabScreenProps<MainTabParamList, 'Home'> & {
  firstName: string;
  lastName: string;
  onAvatarPress: () => void;
};

export default function HomeScreen({ navigation, firstName, lastName, onAvatarPress }: Props) {
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.appBody}>
        <TapeGutter />
        <ScrollView style={styles.flexOne} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View>
            <Text style={styles.wordmark}>Formation</Text>
            <Text style={styles.wordmarkSub}>Central High Band</Text>
            <Text style={styles.seasonTag}>Fall 2026 season</Text>
          </View>
          <Pressable style={styles.avatar} onPress={onAvatarPress}>
            <Text style={styles.avatarText}>{initials}</Text>
          </Pressable>
        </View>

        <View style={styles.statsGrid}>
          {STATS.map((stat, index) => (
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
            <Text style={styles.blockLink}>See all</Text>
          </View>
          <View style={styles.sectionGrid}>
            {SECTIONS.map((section) => (
              <View key={section.name} style={styles.sectionCard}>
                <Text style={styles.sectionName}>{section.name}</Text>
                <Text style={styles.sectionCount}>{section.count}</Text>
                <View style={styles.fitBar}>
                  <View style={[styles.fitBarFill, { width: `${section.fitPercent}%` }]} />
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.block}>
          <View style={styles.blockHead}>
            <Text style={styles.blockTitle}>Catalogue</Text>
            <Text style={styles.blockLink}>View all 36</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.swatchScroll}>
            {CATALOGUE.map((combo) => (
              <View key={combo.label} style={styles.swatch}>
                <View style={styles.swatchArt}>
                  <View style={styles.garment}>
                    <View style={styles.garmentCoat} />
                    <View style={styles.garmentPants} />
                  </View>
                </View>
                <Text style={styles.swatchLabel}>{combo.label}</Text>
                <Text style={styles.swatchSub}>{combo.sub}</Text>
              </View>
            ))}
          </ScrollView>
        </View>

        <View style={styles.block}>
          <View style={styles.blockHead}>
            <Text style={styles.blockTitle}>Inventory</Text>
            <Pressable onPress={() => navigation.navigate('Inventory')}>
              <Text style={styles.blockLink}>View full</Text>
            </Pressable>
          </View>
          <View style={styles.invList}>
            {INVENTORY.map((item) => (
              <View key={item.piece} style={styles.invRow}>
                <View>
                  <Text style={styles.invPiece}>{item.piece}</Text>
                  <Text style={styles.invSizes}>{item.sizes}</Text>
                </View>
                <View style={styles.invRight}>
                  <Text style={styles.invQty}>{item.qty}</Text>
                  <View style={styles.condRow}>
                    <View style={[styles.dot, item.warn && styles.dotWarn]} />
                    <Text style={[styles.condText, item.warn && styles.condTextWarn]}>
                      {item.condition}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>
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
    padding: 18,
    paddingBottom: 28,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    marginBottom: 20,
  },
  wordmark: {
    fontFamily: fonts.wordmark,
    fontSize: 21,
    color: colors.ink,
  },
  wordmarkSub: {
    fontFamily: fonts.body,
    marginTop: 3,
    color: colors.inkSoft,
    fontSize: 11.5,
  },
  seasonTag: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.inkSoft,
    marginTop: 3,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: fonts.wordmark,
    color: colors.paper,
    fontSize: 14,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: 26,
  },
  statCell: {
    width: '50%',
    backgroundColor: colors.surface,
    padding: 14,
    paddingBottom: 15,
  },
  statCellBorderRight: {
    borderRightWidth: 1,
    borderRightColor: colors.line,
  },
  statCellBorderBottom: {
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  statNum: {
    fontFamily: fonts.monoMedium,
    fontSize: 24,
    color: colors.ink,
  },
  statNumFlag: {
    color: colors.rust,
  },
  statLabel: {
    fontFamily: fonts.body,
    marginTop: 2,
    fontSize: 11.5,
    color: colors.inkSoft,
  },
  block: {
    marginBottom: 28,
  },
  blockHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 13,
  },
  blockTitle: {
    fontFamily: fonts.blockTitle,
    fontSize: 15.5,
    color: colors.ink,
  },
  blockLink: {
    fontFamily: fonts.body,
    fontSize: 11.5,
    color: colors.inkSoft,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    paddingBottom: 1,
  },
  sectionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sectionCard: {
    width: '31.5%',
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    padding: 9,
    paddingTop: 9,
    paddingBottom: 10,
  },
  sectionName: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11.5,
    lineHeight: 14,
    minHeight: 28,
    color: colors.ink,
  },
  sectionCount: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.inkSoft,
    marginTop: 5,
  },
  fitBar: {
    marginTop: 7,
    height: 2.5,
    backgroundColor: colors.lineSoft,
  },
  fitBarFill: {
    height: '100%',
    backgroundColor: colors.ink,
  },
  swatchScroll: {
    marginHorizontal: -18,
    paddingHorizontal: 18,
  },
  swatch: {
    width: 108,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    padding: 12,
    paddingBottom: 10,
    marginRight: 10,
  },
  swatchArt: {
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  garment: {
    width: 28,
    height: 44,
  },
  garmentCoat: {
    position: 'absolute',
    top: 0,
    left: 3,
    width: 22,
    height: 24,
    backgroundColor: colors.ink,
    opacity: 0.86,
  },
  garmentPants: {
    position: 'absolute',
    bottom: 0,
    left: 7,
    width: 14,
    height: 22,
    backgroundColor: colors.inkSoft,
  },
  swatchLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11.5,
    color: colors.ink,
  },
  swatchSub: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.inkSoft,
    marginTop: 2,
  },
  invList: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  invRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: colors.lineSoft,
  },
  invPiece: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.ink,
  },
  invSizes: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.inkSoft,
    marginTop: 2,
  },
  invRight: {
    alignItems: 'flex-end',
  },
  invQty: {
    fontFamily: fonts.mono,
    fontSize: 13,
    color: colors.ink,
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
    backgroundColor: colors.ink,
  },
  dotWarn: {
    backgroundColor: colors.rust,
    borderRadius: 1,
    transform: [{ rotate: '45deg' }],
  },
  condText: {
    fontFamily: fonts.body,
    fontSize: 10.5,
    color: colors.ink,
  },
  condTextWarn: {
    color: colors.rust,
  },
});
