import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { fonts } from '../constants/fonts';
import { useTheme, useThemedStyles, type Theme } from '../hooks/useTheme';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import { SIZE_STEP_NAMES } from '../lib/theme';
import type { SizeStep } from '../lib/settings';
import TapeGutter from '../components/TapeGutter';
import StepSlider from '../components/StepSlider';
import SegmentTabs from '../components/SegmentTabs';
import { BackChevronIcon } from '../components/icons';
import OutlineButton from '../components/OutlineButton';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

// Accessibility settings. Saved on this phone; changes apply right away.
export default function SettingsScreen({ navigation }: Props) {
  const theme = useTheme();
  const { colors } = theme;
  const styles = useThemedStyles(makeStyles);
  const { settings, updateSettings } = useSettings();
  const { account } = useAuth();
  const isStaff = account?.role === 'Staff';

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.appBody}>
        <TapeGutter />
        <ScrollView style={styles.flexOne} contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <Pressable
              style={styles.headerSideButton}
              onPress={() => navigation.goBack()}
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <BackChevronIcon color={colors.ink} />
            </Pressable>
            <Text style={styles.pageTitle} accessibilityRole="header">Settings</Text>
            <View style={styles.headerSideButton} />
          </View>

          <Text style={styles.section} accessibilityRole="header">TEXT AND BUTTONS</Text>
          <View style={styles.group}>
            <Text style={styles.itemTitle}>Size</Text>
            <Text style={styles.itemHint}>
              Makes text and buttons bigger in Mustang Closet. Adds to your phone's own text size.
            </Text>
            <View style={styles.sliderWrap}>
              <StepSlider
                label="Size"
                value={settings.sizeStep}
                steps={SIZE_STEP_NAMES}
                onChange={(v) => updateSettings({ sizeStep: v as SizeStep })}
              />
            </View>
            <View style={styles.preview} accessibilityLabel="Preview">
              <Text style={styles.previewText}>Preview: this is how text will look.</Text>
              <OutlineButton label="Sample button" onSurface onPress={() => {}} accessibilityLabel="Sample button preview" />
            </View>
          </View>

          <Text style={styles.section} accessibilityRole="header">READABILITY</Text>
          <View style={[styles.group, styles.switchRow]}>
            <View style={styles.flexOne}>
              <Text style={styles.itemTitle}>High contrast</Text>
              <Text style={styles.itemHint}>Darker text, white buttons, stronger borders.</Text>
            </View>
            <Switch
              value={settings.highContrast}
              onValueChange={(highContrast) => updateSettings({ highContrast })}
              accessibilityLabel="High contrast"
              trackColor={{ false: colors.line, true: colors.ink }}
            />
          </View>

          <Text style={styles.section} accessibilityRole="header">LAYOUT</Text>
          <View style={styles.group}>
            <Text style={styles.itemTitle}>{isStaff ? 'Inventory and Recount' : 'White shirt size and My Sizes'}</Text>
            <Text style={styles.itemHint}>Expanded gives more space; Condensed fits more on the screen.</Text>
            <View style={styles.segmentWrap}>
              <SegmentTabs
                options={['Expanded', 'Condensed']}
                value={settings.layout === 'expanded' ? 0 : 1}
                onChange={(v) => updateSettings({ layout: v === 0 ? 'expanded' : 'condensed' })}
              />
            </View>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.colors.paper },
    flexOne: { flex: 1 },
    appBody: { flex: 1, flexDirection: 'row' },
    content: { padding: 18, paddingBottom: 28 },
    header: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    headerSideButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    pageTitle: { flex: 1, textAlign: 'center', fontFamily: fonts.wordmark, fontSize: t.font(20), color: t.colors.ink },
    section: {
      fontFamily: fonts.bodySemiBold,
      fontSize: t.font(11),
      letterSpacing: 1,
      color: t.colors.inkSoft,
      marginTop: 18,
      marginBottom: 8,
    },
    group: { borderWidth: 1, borderColor: t.colors.line, backgroundColor: t.colors.surface, padding: 14 },
    switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    itemTitle: { fontFamily: fonts.bodySemiBold, fontSize: t.font(14), color: t.colors.ink },
    itemHint: { fontFamily: fonts.body, fontSize: t.font(12), color: t.colors.inkSoft, marginTop: 3 },
    sliderWrap: { marginTop: 10 },
    preview: { borderWidth: 1, borderStyle: 'dashed', borderColor: t.colors.inkFaint, padding: 10, marginTop: 12, gap: 8 },
    previewText: { fontFamily: fonts.body, fontSize: t.font(14), color: t.colors.ink },
    segmentWrap: { marginTop: 10 },
  });
}
