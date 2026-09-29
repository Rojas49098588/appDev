import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors } from '../constants/colors';
import { fonts } from '../constants/fonts';
import { useCombos } from '../context/CombosContext';
import { useGame, type ComboSlot } from '../context/GameContext';
import TapeGutter from '../components/TapeGutter';
import { BackChevronIcon, ImagePlaceholderIcon } from '../components/icons';

type Props = NativeStackScreenProps<RootStackParamList, 'ComboDetail'>;

const SLOT_LABELS: Record<ComboSlot, string> = { preGame: 'pregame', halftime: 'halftime' };

export default function ComboDetailScreen({ navigation, route }: Props) {
  const { combos, deleteCombo } = useCombos();
  const { game, setCombo } = useGame();
  const combo = combos.find((c) => c.id === route.params.comboId);

  if (!combo) {
    // Combo was deleted (or never existed) — nothing to show.
    return (
      <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
        <View style={styles.appBody}>
          <TapeGutter />
          <View style={styles.content}>
            <View style={styles.header}>
              <Pressable style={styles.headerSideButton} onPress={() => navigation.goBack()}>
                <BackChevronIcon color={colors.ink} />
              </Pressable>
              <Text style={styles.pageTitle}>Combo not found</Text>
              <View style={styles.headerSideButton} />
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const isPreGame = game.preGameComboId === combo.id;
  const isHalftime = game.halftimeComboId === combo.id;
  const components = combo.components ?? [];

  const handleDelete = () => {
    // Game Day looks combos up by id, so a combo in use can't be removed.
    const inUseSlot: ComboSlot | null = isPreGame ? 'preGame' : isHalftime ? 'halftime' : null;
    if (inUseSlot) {
      Alert.alert(
        'Error',
        `This combo is set for ${SLOT_LABELS[inUseSlot]}. Choose a different combo first.`
      );
      return;
    }
    Alert.alert('Delete combo', `Delete ${combo.label}? This can't be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteCombo(combo.id);
          navigation.goBack();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.appBody}>
        <TapeGutter />

        <ScrollView style={styles.flexOne} contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <Pressable style={styles.headerSideButton} onPress={() => navigation.goBack()}>
              <BackChevronIcon color={colors.ink} />
            </Pressable>
            <View style={styles.titleBlock}>
              <Text style={styles.comboTitle}>{combo.label}</Text>
              {combo.sub ? <Text style={styles.pageSub}>{combo.sub}</Text> : null}
            </View>
            <View style={styles.headerSideButton} />
          </View>

          <View style={styles.image}>
            {combo.image ? (
              <Image source={{ uri: combo.image }} style={styles.imageFill} resizeMode="cover" />
            ) : (
              <ImagePlaceholderIcon color={colors.inkFaint} size={40} />
            )}
          </View>

          <Text style={styles.sectionLabel}>Components</Text>
          {components.length > 0 ? (
            <View style={styles.chipRow}>
              {components.map((component) => (
                <View key={component} style={styles.chip}>
                  <Text style={styles.chipText}>{component}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>No components listed</Text>
          )}

          <View style={styles.slotButtonRow}>
            <Pressable
              style={[styles.slotButton, isPreGame && styles.slotButtonActive]}
              onPress={() => setCombo('preGame', combo.id)}
            >
              <Text style={[styles.slotButtonText, isPreGame && styles.slotButtonTextActive]}>
                {isPreGame ? 'Set for pregame ✓' : 'Set for pregame'}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.slotButton, isHalftime && styles.slotButtonActive]}
              onPress={() => setCombo('halftime', combo.id)}
            >
              <Text style={[styles.slotButtonText, isHalftime && styles.slotButtonTextActive]}>
                {isHalftime ? 'Set for halftime ✓' : 'Set for halftime'}
              </Text>
            </Pressable>
          </View>

          <Pressable style={styles.deleteButton} onPress={handleDelete}>
            <Text style={styles.deleteButtonText}>Delete</Text>
          </Pressable>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  flexOne: { flex: 1 },
  appBody: { flex: 1, flexDirection: 'row' },
  content: { flexGrow: 1, paddingTop: 16, paddingHorizontal: 18, paddingBottom: 28 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
  },
  headerSideButton: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  titleBlock: { flex: 1, alignItems: 'center' },
  pageTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fonts.wordmark,
    fontSize: 18,
    color: colors.ink,
  },
  comboTitle: { textAlign: 'center', fontFamily: fonts.wordmark, fontSize: 18, color: colors.ink },
  pageSub: { fontFamily: fonts.body, fontSize: 12, color: colors.inkSoft, marginTop: 2 },
  image: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  imageFill: { width: '100%', height: '100%' },
  sectionLabel: { fontFamily: fonts.body, fontSize: 11.5, color: colors.inkSoft, marginBottom: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  chipText: { fontFamily: fonts.body, fontSize: 12.5, color: colors.ink },
  emptyText: { fontFamily: fonts.body, fontSize: 12.5, color: colors.inkFaint },
  slotButtonRow: { flexDirection: 'row', gap: 8, marginTop: 24, marginBottom: 28 },
  slotButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.ink,
    paddingVertical: 13,
    alignItems: 'center',
  },
  slotButtonActive: { backgroundColor: colors.ink },
  slotButtonText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.ink },
  slotButtonTextActive: { color: colors.paper },
  deleteButton: {
    marginTop: 'auto',
    borderWidth: 1,
    borderColor: colors.rust,
    paddingVertical: 13,
    alignItems: 'center',
  },
  deleteButtonText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.rust },
});
