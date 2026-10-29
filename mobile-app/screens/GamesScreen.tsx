import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors } from '../constants/colors';
import { fonts } from '../constants/fonts';
import { useGames } from '../context/GamesContext';
import type { Game } from '../lib/models';
import { isCourt, missingFields, staffSections } from '../lib/games';
import { formatClock, formatGameDate } from '../lib/format';
import TapeGutter from '../components/TapeGutter';
import SegmentTabs from '../components/SegmentTabs';
import { BackChevronIcon } from '../components/icons';

type Props = NativeStackScreenProps<RootStackParamList, 'Games'>;
type Pill = 'Posted' | 'Ready' | 'Draft' | 'Done';

const PILL_STYLES: Record<Pill, { bg: string; fg: string; border: string; dashed?: boolean }> = {
  Posted: { bg: colors.tealTint, fg: colors.tealDark, border: colors.teal },
  Ready: { bg: colors.washTint, fg: colors.wash, border: colors.wash },
  Draft: { bg: colors.rustTint, fg: colors.rust, border: colors.rust, dashed: true },
  Done: { bg: colors.lineSoft, fg: colors.inkSoft, border: colors.line },
};

// 'VB · W' / 'BB · M'
function courtTag(g: Game): string {
  const sport = g.sport === 'volleyball' ? 'VB' : 'BB';
  const div = g.division === 'womens' ? 'W' : g.division === 'mens' ? 'M' : '';
  return div ? `${sport} · ${div}` : sport;
}

function detailLine(g: Game): string {
  const date = g.gameDate ? formatGameDate(g.gameDate) : 'No date';
  const parts = [date];
  if (isCourt(g.sport)) {
    if (g.groupNumber !== null) parts.push(`Group ${g.groupNumber}`);
    const polo = g.polo.map((p) => p.name).join(', ');
    if (polo) parts.push(polo);
  } else {
    const kick = formatClock(g.kickoffTime);
    if (kick) parts.push(kick);
    const call = formatClock(g.callTime);
    if (call) parts.push(`call ${call}`);
  }
  return parts.join(' · ');
}

export default function GamesScreen({ navigation }: Props) {
  const { games, today } = useGames();
  const [tab, setTab] = useState<0 | 1>(0);
  const { upNext, queue, past } = staffSections(games, tab === 0 ? 'football' : 'court', today);

  const renderCard = (g: Game, pill: Pill, dim = false) => {
    const ps = PILL_STYLES[pill];
    const missing = pill === 'Draft' ? missingFields(g) : [];
    return (
      <Pressable
        key={g.id}
        style={[styles.card, dim && styles.cardDim]}
        onPress={() => navigation.navigate('GameEdit', { gameId: g.id })}
      >
        <View style={styles.cardTop}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            vs. {g.opponent || 'Untitled game'}
          </Text>
          {isCourt(g.sport) && (
            <View style={styles.tag}>
              <Text style={styles.tagText}>{courtTag(g)}</Text>
            </View>
          )}
          <View
            style={[
              styles.pill,
              { backgroundColor: ps.bg, borderColor: ps.border, borderStyle: ps.dashed ? 'dashed' : 'solid' },
            ]}
          >
            <Text style={[styles.pillText, { color: ps.fg }]}>{pill}</Text>
          </View>
        </View>
        <Text style={styles.cardMeta}>{detailLine(g)}</Text>
        {missing.length > 0 && <Text style={styles.missing}>Missing: {missing.join(', ')}</Text>}
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.appBody}>
        <TapeGutter />
        <View style={styles.flexOne}>
          <ScrollView style={styles.flexOne} contentContainerStyle={styles.content}>
            <View style={styles.header}>
              <Pressable style={styles.headerSideButton} onPress={() => navigation.goBack()}>
                <BackChevronIcon color={colors.ink} />
              </Pressable>
              <Text style={styles.pageTitle}>Games</Text>
              <View style={styles.headerSideButton} />
            </View>
            <SegmentTabs options={['Football', 'BB / VB']} value={tab} onChange={setTab} />

            <Text style={styles.sectionLabel}>Up next</Text>
            {upNext.length === 0 ? (
              <Text style={styles.empty}>Nothing posted. Mark a game ready to post it.</Text>
            ) : (
              upNext.map((g) => renderCard(g, 'Posted'))
            )}

            {queue.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>Queue</Text>
                {queue.map((g) => renderCard(g, g.status === 'ready' ? 'Ready' : 'Draft'))}
              </>
            )}

            {past.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>Past</Text>
                {past.map((g) => renderCard(g, 'Done', true))}
              </>
            )}
          </ScrollView>
          <Pressable
            style={styles.fab}
            onPress={() =>
              navigation.navigate('GameEdit', { sport: tab === 0 ? 'football' : 'basketball' })
            }
          >
            <Text style={styles.fabText}>+ New game</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  flexOne: { flex: 1 },
  appBody: { flex: 1, flexDirection: 'row' },
  content: { paddingTop: 16, paddingHorizontal: 18, paddingBottom: 90 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
  },
  headerSideButton: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  pageTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fonts.wordmark,
    fontSize: 18,
    color: colors.ink,
  },
  sectionLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.inkSoft,
    marginTop: 20,
    marginBottom: 8,
  },
  empty: { fontFamily: fonts.body, fontSize: 13, color: colors.inkSoft },
  card: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    padding: 14,
    marginBottom: 8,
  },
  cardDim: { opacity: 0.6 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.ink },
  tag: { borderWidth: 1, borderColor: colors.line, paddingHorizontal: 6, paddingVertical: 1 },
  tagText: { fontFamily: fonts.monoMedium, fontSize: 10, color: colors.inkSoft },
  pill: { borderWidth: 1, paddingHorizontal: 8, paddingVertical: 2 },
  pillText: { fontFamily: fonts.bodySemiBold, fontSize: 10.5 },
  cardMeta: { fontFamily: fonts.mono, fontSize: 11.5, color: colors.inkSoft, marginTop: 6 },
  missing: { fontFamily: fonts.body, fontSize: 12, color: colors.rust, marginTop: 6 },
  fab: {
    position: 'absolute',
    right: 18,
    bottom: 18,
    backgroundColor: colors.ink,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  fabText: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.white },
});
