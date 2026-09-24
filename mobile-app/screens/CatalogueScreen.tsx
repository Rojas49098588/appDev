import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MainTabParamList, RootStackParamList } from '../navigation/types';
import { colors } from '../constants/colors';
import { fonts } from '../constants/fonts';
import type { Combo } from '../constants/combosData';
import { useCombos } from '../context/CombosContext';
import { useGame } from '../context/GameContext';
import TapeGutter from '../components/TapeGutter';
import { ImagePlaceholderIcon, PlusIcon } from '../components/icons';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Catalogue'>,
  NativeStackScreenProps<RootStackParamList>
>;

export default function CatalogueScreen({ navigation }: Props) {
  const { combos } = useCombos();
  const { setCombo } = useGame();

  const handleComboPress = (combo: Combo) => {
    const message = combo.sub ? `${combo.sub} — set this combo for:` : 'Set this combo for:';
    Alert.alert(combo.label, message, [
      { text: 'Set for pregame', onPress: () => setCombo('preGame', combo.id) },
      { text: 'Set for halftime', onPress: () => setCombo('halftime', combo.id) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleAddPress = () => {
    navigation.navigate('AddCombo');
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.appBody}>
        <TapeGutter />

        <ScrollView style={styles.flexOne} contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <View style={styles.headerSideButton} />
            <Text style={styles.pageTitle}>Catalogue</Text>
            <View style={styles.headerSideButton} />
          </View>

          <View style={styles.grid}>
            {combos.map((combo) => (
              <Pressable key={combo.id} style={styles.tile} onPress={() => handleComboPress(combo)}>
                <View style={styles.tileImage}>
                  {combo.image ? (
                    <Image source={{ uri: combo.image }} style={styles.tileImageFill} />
                  ) : (
                    <ImagePlaceholderIcon color={colors.inkFaint} />
                  )}
                </View>
                <Text style={styles.tileLabel}>{combo.label}</Text>
                {combo.sub ? <Text style={styles.tileSub}>{combo.sub}</Text> : null}
              </Pressable>
            ))}

            <Pressable style={styles.tile} onPress={handleAddPress}>
              <View style={[styles.tileImage, styles.addTileImage]}>
                <PlusIcon color={colors.inkFaint} size={22} />
              </View>
              <Text style={styles.tileLabel}>Add combo</Text>
            </Pressable>
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
  },
  pageTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fonts.wordmark,
    fontSize: 18,
    color: colors.ink,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tile: {
    width: '31.5%',
  },
  tileImage: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  addTileImage: {
    borderStyle: 'dashed',
  },
  tileImageFill: {
    width: '100%',
    height: '100%',
  },
  tileLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11.5,
    color: colors.ink,
  },
  tileSub: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.inkSoft,
    marginTop: 2,
  },
});
