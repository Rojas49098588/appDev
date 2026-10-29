import { useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors } from '../constants/colors';
import { fonts } from '../constants/fonts';
import { useGames } from '../context/GamesContext';
import { friendlyError } from '../lib/errors';
import { successBuzz } from '../lib/haptics';
import { OFFLINE_DIM, requireOnline, useConnection } from '../hooks/useConnection';
import TapeGutter from '../components/TapeGutter';
import { BackChevronIcon } from '../components/icons';

type Props = NativeStackScreenProps<RootStackParamList, 'PoloColors'>;

const PRESETS: { label: string; hex: string }[] = [
  { label: 'Blue', hex: '#2C5AA0' },
  { label: 'Red', hex: '#C0392B' },
  { label: 'White', hex: '#FFFFFF' },
  { label: 'Black', hex: '#22201D' },
  { label: 'Grey', hex: '#9AA3AD' },
  { label: 'Green', hex: '#2E7D4F' },
  { label: 'Gold', hex: '#E0B000' },
  { label: 'Purple', hex: '#6A3FA0' },
];

export default function PoloColorsScreen({ navigation }: Props) {
  const { poloColors, addPoloColor, removePoloColor } = useGames();
  const { isOnline } = useConnection();
  const [name, setName] = useState('');
  const [swatch, setSwatch] = useState(PRESETS[0].hex);
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);

  const handleAdd = async () => {
    if (savingRef.current) return;
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert('Name needed', 'Give this color a name.');
      return;
    }
    if (poloColors.some((c) => c.name.trim().toLowerCase() === trimmed.toLowerCase())) {
      Alert.alert('Already added', 'That color is already in the list.');
      return;
    }
    if (!requireOnline(isOnline)) return;
    savingRef.current = true;
    setIsSaving(true);
    try {
      await addPoloColor(trimmed, swatch);
      successBuzz();
      setName('');
      setSwatch(PRESETS[0].hex);
    } catch (error) {
      Alert.alert("Couldn't add color", friendlyError(error));
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  const confirmRemove = (id: string, colorName: string) => {
    Alert.alert(`Remove ${colorName}? Games that already use it keep it.`, undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          if (!requireOnline(isOnline)) return;
          try {
            await removePoloColor(id);
            successBuzz();
          } catch (error) {
            Alert.alert("Couldn't remove color", friendlyError(error));
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.appBody}>
        <TapeGutter />
        <ScrollView style={styles.flexOne} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Pressable style={styles.side} onPress={() => navigation.goBack()} accessibilityLabel="Back">
              <BackChevronIcon color={colors.ink} />
            </Pressable>
            <Text style={styles.title}>Polo colors</Text>
            <View style={styles.side} />
          </View>

          <View style={styles.field}>
            {poloColors.map((c) => (
              <View key={c.id} style={styles.row}>
                <View style={[styles.dot, { backgroundColor: c.swatch }]} />
                <Text style={styles.rowName}>{c.name}</Text>
                <Pressable
                  style={styles.removeButton}
                  onPress={() => confirmRemove(c.id, c.name)}
                  accessibilityLabel={`Remove ${c.name}`}
                >
                  <Text style={styles.removeText}>Remove</Text>
                </Pressable>
              </View>
            ))}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Add a color</Text>
            <TextInput
              style={styles.textInput}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Navy"
              placeholderTextColor={colors.inkFaint}
              autoCapitalize="words"
            />
            <View style={styles.swatchRow}>
              {PRESETS.map((p) => {
                const selected = swatch === p.hex;
                return (
                  <Pressable
                    key={p.hex}
                    onPress={() => setSwatch(p.hex)}
                    style={[styles.swatchRing, selected && styles.swatchRingSelected]}
                    accessibilityRole="radio"
                    accessibilityLabel={p.label}
                    accessibilityState={{ selected }}
                  >
                    <View style={[styles.swatchDot, { backgroundColor: p.hex }]} />
                  </Pressable>
                );
              })}
            </View>
            <Pressable
              style={[styles.submitButton, isSaving && styles.submitDisabled, !isOnline && OFFLINE_DIM]}
              onPress={handleAdd}
              disabled={isSaving}
            >
              <Text style={styles.submitText}>{isSaving ? 'Adding…' : 'Add color'}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  flexOne: { flex: 1 },
  appBody: { flex: 1, flexDirection: 'row' },
  content: { paddingTop: 16, paddingHorizontal: 18, paddingBottom: 28 },
  header: { flexDirection: 'row', alignItems: 'center', paddingBottom: 14 },
  side: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', fontFamily: fonts.wordmark, fontSize: 18, color: colors.ink },
  field: { marginBottom: 22 },
  label: { fontFamily: fonts.body, fontSize: 11.5, color: colors.inkSoft, marginBottom: 7 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  dot: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, borderColor: colors.line, marginRight: 12 },
  rowName: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.ink },
  removeButton: { paddingVertical: 6, paddingHorizontal: 8 },
  removeText: { fontFamily: fonts.body, fontSize: 12.5, color: colors.inkSoft },
  textInput: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingVertical: 12,
    paddingHorizontal: 13,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.ink,
  },
  swatchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14, marginBottom: 18 },
  swatchRing: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchRingSelected: { borderColor: colors.ink },
  swatchDot: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: colors.line },
  submitButton: { backgroundColor: colors.ink, paddingVertical: 14, alignItems: 'center' },
  submitDisabled: { opacity: 0.6 },
  submitText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.paper },
});
