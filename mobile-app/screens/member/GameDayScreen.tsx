import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { MemberTabParamList } from '../../navigation/types';
import { colors } from '../../constants/colors';
import { fonts } from '../../constants/fonts';
import { CURRENT_GAME } from '../../constants/gamesData';
import { COMBOS, type Combo } from '../../constants/combosData';
import TapeGutter from '../../components/TapeGutter';

type Props = BottomTabScreenProps<MemberTabParamList, 'GameDay'> & {
  firstName: string;
  lastName: string;
  onAvatarPress: () => void;
};

export default function GameDayScreen({ firstName, lastName, onAvatarPress }: Props) {
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  const preGameCombo = COMBOS.find((c) => c.id === CURRENT_GAME.preGameComboId)!;
  const halftimeCombo = COMBOS.find((c) => c.id === CURRENT_GAME.halftimeComboId)!;

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
          <Text style={styles.gameLine}>
            vs. {CURRENT_GAME.opponent} — {CURRENT_GAME.date}
          </Text>

          <ComboSection title="Pre-game" combo={preGameCombo} />
          <ComboSection title="Halftime" combo={halftimeCombo} />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

function ComboSection({ title, combo }: { title: string; combo: Combo }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionSub}>
        {combo.label} — {combo.sub}
      </Text>
      <View style={styles.photoBox}>
        <Text style={styles.photoCaption}>From Catalogue — {combo.label}</Text>
      </View>
      <Text style={styles.componentsLabel}>Components</Text>
      <View style={styles.chipRow}>
        {combo.components.map((component) => (
          <View key={component} style={styles.chip}>
            <Text style={styles.chipText}>{component}</Text>
          </View>
        ))}
      </View>
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
  gameLine: { fontFamily: fonts.body, fontSize: 13, color: colors.inkSoft, marginBottom: 24 },
  section: { marginBottom: 28 },
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
});
