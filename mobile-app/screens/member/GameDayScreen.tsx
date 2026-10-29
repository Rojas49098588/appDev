import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { MemberTabParamList } from '../../navigation/types';
import { colors } from '../../constants/colors';
import { fonts } from '../../constants/fonts';
import type { Combo } from '../../constants/combosData';
import { useCombos } from '../../context/CombosContext';
import { useGames } from '../../context/GamesContext';
import { shownCourt, shownFootball, sportLabel } from '../../lib/games';
import { formatClock, formatGameDate } from '../../lib/format';
import type { Game, PoloColor } from '../../lib/models';
import TapeGutter from '../../components/TapeGutter';
import SegmentTabs from '../../components/SegmentTabs';

type Props = BottomTabScreenProps<MemberTabParamList, 'GameDay'> & {
  firstName: string;
  lastName: string;
  onAvatarPress: () => void;
};

export default function GameDayScreen({ firstName, lastName, onAvatarPress }: Props) {
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  const { games, today } = useGames();
  const { combos } = useCombos();
  // Remembered for the session only (no storage).
  const [tab, setTab] = useState<0 | 1>(0);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.appBody}>
        <TapeGutter />
        <ScrollView style={styles.flexOne} contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Game day</Text>
            <Pressable style={styles.avatar} onPress={onAvatarPress}>
              <Text style={styles.avatarText}>{initials}</Text>
            </Pressable>
          </View>
          <View style={styles.tabs}>
            <SegmentTabs options={['Football', 'BB / VB']} value={tab} onChange={setTab} />
          </View>
          {tab === 0 ? (
            <FootballTab game={shownFootball(games, today)} combos={combos} />
          ) : (
            <CourtTab list={shownCourt(games, today)} />
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

function EmptyState({ title, sub }: { title: string; sub: string }) {
  return (
    <View style={styles.emptyBox}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySub}>{sub}</Text>
    </View>
  );
}

function PoloDots({ polo }: { polo: PoloColor[] }) {
  return (
    <View style={styles.poloRow}>
      {polo.map((p) => (
        <View key={`${p.name}-${p.swatch}`} style={styles.poloItem}>
          <View style={[styles.dot, { backgroundColor: p.swatch }]} />
          <Text style={styles.factValue}>{p.name}</Text>
        </View>
      ))}
    </View>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={[styles.factValue, styles.factMono]}>{value}</Text>
    </View>
  );
}

function FootballTab({ game, combos }: { game: Game | null; combos: Combo[] }) {
  if (!game) {
    return <EmptyState title="No upcoming game yet" sub="Staff will post the next game's details here" />;
  }
  const preGameCombo = game.preGameComboId ? combos.find((c) => c.id === game.preGameComboId) : undefined;
  const halftimeCombo = game.halftimeComboId ? combos.find((c) => c.id === game.halftimeComboId) : undefined;
  const hasInstructions = game.afterGameInstructions.trim().length > 0;

  return (
    <>
      <Text style={styles.gameLine}>
        vs. {game.opponent} — {game.gameDate ? formatGameDate(game.gameDate) : ''}
      </Text>
      <View style={styles.factsRow}>
        <Fact label="Call time" value={game.noCallTime ? 'None' : formatClock(game.callTime)} />
        <Fact label="Kickoff" value={formatClock(game.kickoffTime)} />
      </View>
      <View style={[styles.fact, styles.poloCard]}>
        <Text style={styles.factLabel}>Polo · rehearsal & parade</Text>
        <PoloDots polo={game.polo} />
        {game.poloNote.trim() ? <Text style={styles.poloNote}>{game.poloNote}</Text> : null}
      </View>

      {preGameCombo ? <ComboSection title="Pre-game" combo={preGameCombo} /> : <EmptySlot title="Pre-game" />}
      {halftimeCombo ? <ComboSection title="Halftime" combo={halftimeCombo} /> : <EmptySlot title="Halftime" />}

      <View style={styles.lastSection}>
        <Text style={styles.sectionTitle}>After-game instructions</Text>
        <View style={styles.instructionsCard}>
          {hasInstructions ? (
            <>
              <Text style={styles.instructionsText}>{game.afterGameInstructions}</Text>
              {game.instructionsPostedBy ? (
                <View style={styles.instructionsMeta}>
                  <Text style={styles.instructionsMetaText}>Posted by {game.instructionsPostedBy}</Text>
                </View>
              ) : null}
            </>
          ) : (
            <Text style={styles.comingSoon}>Instructions coming soon</Text>
          )}
        </View>
      </View>
    </>
  );
}

function CourtTab({ list }: { list: Game[] }) {
  if (list.length === 0) {
    return <EmptyState title="No upcoming game yet" sub="The next basketball or volleyball game will show here" />;
  }
  return (
    <>
      {list.map((g) => (
        <View key={g.id} style={styles.courtCard}>
          <Text style={styles.sportLabel}>{sportLabel(g).toUpperCase()}</Text>
          <Text style={styles.courtLine}>
            vs. {g.opponent} — {g.gameDate ? formatGameDate(g.gameDate) : ''}
          </Text>
          <View style={styles.groupBlock}>
            <View>
              <Text style={styles.groupK}>PLAYING</Text>
              <Text style={styles.groupWord}>Group</Text>
            </View>
            <Text style={styles.groupNum}>{g.groupNumber ?? '—'}</Text>
          </View>
          <View style={styles.factsRow}>
            <Fact label="Call time" value={g.noCallTime ? 'None' : formatClock(g.callTime)} />
            <Fact label="Start" value={formatClock(g.kickoffTime)} />
          </View>
          <View style={styles.fact}>
            <Text style={styles.factLabel}>Polo</Text>
            <PoloDots polo={g.polo} />
            {g.poloNote.trim() ? <Text style={styles.poloNote}>{g.poloNote}</Text> : null}
          </View>
          <Text style={styles.hint}>Not your group? Everyone can see this, so you can fill in or swap.</Text>
        </View>
      ))}
    </>
  );
}

function ComboSection({ title, combo }: { title: string; combo: Combo }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionSub}>
        {combo.sub ? `${combo.label} — ${combo.sub}` : combo.label}
      </Text>
      <View style={styles.photoBox}>
        {combo.image ? (
          <Image source={{ uri: combo.image }} style={styles.photoBoxImage} resizeMode="cover" />
        ) : (
          <Text style={styles.photoCaption}>From Catalogue — {combo.label}</Text>
        )}
      </View>
      <Text style={styles.componentsLabel}>Pieces</Text>
      <View style={styles.chipRow}>
        {(combo.components ?? []).map((component) => (
          <View key={component} style={styles.chip}>
            <Text style={styles.chipText}>{component}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function EmptySlot({ title }: { title: string }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionSub}>No combo set</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  flexOne: { flex: 1 },
  appBody: { flex: 1, flexDirection: 'row' },
  content: { padding: 18, paddingBottom: 28 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: { fontFamily: fonts.wordmark, fontSize: 24, color: colors.ink },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: fonts.wordmark, fontSize: 14, color: colors.paper },
  tabs: { marginTop: 8, marginBottom: 16 },
  gameLine: { fontFamily: fonts.body, fontSize: 13, color: colors.inkSoft, marginBottom: 14 },
  emptyBox: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    padding: 20,
    alignItems: 'center',
  },
  emptyTitle: { fontFamily: fonts.blockTitle, fontSize: 15, color: colors.ink, marginBottom: 4 },
  emptySub: { fontFamily: fonts.body, fontSize: 12.5, color: colors.inkSoft, textAlign: 'center' },
  factsRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  fact: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    padding: 12,
  },
  factLabel: {
    fontFamily: fonts.body,
    fontSize: 10.5,
    color: colors.inkFaint,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  factValue: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.ink },
  factMono: { fontFamily: fonts.monoMedium },
  poloCard: { flex: 0, marginBottom: 24 },
  poloRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  poloItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1, borderColor: colors.line },
  poloNote: { fontFamily: fonts.body, fontSize: 12, color: colors.inkSoft, marginTop: 8 },
  comingSoon: { fontFamily: fonts.body, fontSize: 13, color: colors.inkFaint, fontStyle: 'italic' },
  courtCard: { marginBottom: 28 },
  sportLabel: { fontFamily: fonts.bodySemiBold, fontSize: 11, letterSpacing: 1, color: colors.inkSoft },
  courtLine: { fontFamily: fonts.body, fontSize: 13, color: colors.inkSoft, marginTop: 2, marginBottom: 12 },
  groupBlock: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.ink,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  groupK: { fontFamily: fonts.body, fontSize: 10.5, letterSpacing: 1, color: colors.inkFaint },
  groupWord: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.white, marginTop: 2 },
  groupNum: { fontFamily: fonts.wordmark, fontSize: 44, color: colors.white },
  hint: { fontFamily: fonts.body, fontSize: 11.5, color: colors.inkFaint, marginTop: 10 },
  section: { marginBottom: 28 },
  lastSection: { marginBottom: 4 },
  sectionTitle: { fontFamily: fonts.blockTitle, fontSize: 17, color: colors.ink, marginBottom: 3 },
  sectionSub: { fontFamily: fonts.mono, fontSize: 11.5, color: colors.inkSoft, marginBottom: 12 },
  photoBox: {
    height: 220,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  photoCaption: { fontFamily: fonts.body, fontSize: 12, color: colors.inkFaint },
  photoBoxImage: { width: '100%', height: '100%' },
  componentsLabel: { fontFamily: fonts.body, fontSize: 11.5, color: colors.inkSoft, marginBottom: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  chipText: { fontFamily: fonts.body, fontSize: 12.5, color: colors.ink },
  instructionsCard: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    padding: 14,
  },
  instructionsText: { fontFamily: fonts.body, fontSize: 13, color: colors.ink, lineHeight: 19 },
  instructionsMeta: {
    borderTopWidth: 1,
    borderTopColor: colors.lineSoft,
    marginTop: 12,
    paddingTop: 10,
  },
  instructionsMetaText: { fontFamily: fonts.body, fontSize: 11, color: colors.inkFaint },
});
