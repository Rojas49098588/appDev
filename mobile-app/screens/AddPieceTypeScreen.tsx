import { useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors } from '../constants/colors';
import { fonts } from '../constants/fonts';
import type { PieceKind } from '../lib/models';
import { parseNumberList } from '../lib/import/rows';
import { useInventory } from '../context/InventoryContext';
import { friendlyError } from '../lib/errors';
import { successBuzz } from '../lib/haptics';
import { OFFLINE_DIM, requireOnline, useConnection } from '../hooks/useConnection';
import TapeGutter from '../components/TapeGutter';
import { BackChevronIcon } from '../components/icons';

type Props = NativeStackScreenProps<RootStackParamList, 'AddPieceType'>;

const byValue = (a: string, b: string) => parseInt(a, 10) - parseInt(b, 10);

export default function AddPieceTypeScreen({ navigation }: Props) {
  const { createPieceType } = useInventory();
  const { isOnline } = useConnection();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<PieceKind>('numbered');
  const [pieceColors, setPieceColors] = useState<string[]>([]);
  const [colorText, setColorText] = useState('');
  const [numbers, setNumbers] = useState<string[]>([]);
  const [numberText, setNumberText] = useState('');
  const [stock, setStock] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const addColor = () => {
    const c = colorText.trim();
    if (!c) return;
    if (pieceColors.some((x) => x.toLowerCase() === c.toLowerCase())) {
      Alert.alert('Already added', `${c} is already in the list.`);
      return;
    }
    setPieceColors((cur) => [...cur, c]);
    setColorText('');
  };

  const removeColor = (c: string) => {
    setPieceColors((cur) => cur.filter((x) => x !== c));
    setStock((cur) => {
      const { [c]: _removed, ...rest } = cur;
      return rest;
    });
  };

  const addNumbers = () => {
    if (!numberText.trim()) return;
    const parsed = parseNumberList(numberText);
    if (parsed.error) {
      Alert.alert("Can't read those numbers", parsed.error);
      return;
    }
    setNumbers((cur) => [...new Set([...cur, ...parsed.numbers])].sort(byValue));
    setNumberText('');
  };

  const removeNumber = (n: string) => setNumbers((cur) => cur.filter((x) => x !== n));

  const stockFor = (c: string) => {
    const t = stock[c] ?? '';
    return /^\d+$/.test(t) ? parseInt(t, 10) : 0;
  };

  const handleSave = async () => {
    if (savingRef.current) return;
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert('Name needed', 'Give this piece type a name.');
      return;
    }
    if (pieceColors.length === 0) {
      Alert.alert('Colors needed', 'Add at least one color.');
      return;
    }
    if (kind === 'numbered' && numbers.length === 0) {
      Alert.alert('Numbers needed', 'Add at least one number.');
      return;
    }
    if (kind === 'counted') {
      const bad = pieceColors.find((c) => stock[c] && !/^\d+$/.test(stock[c]));
      if (bad) {
        Alert.alert('Check the quantities', `Quantity for ${bad} must be a whole number.`);
        return;
      }
    }
    if (!requireOnline(isOnline)) return;
    savingRef.current = true;
    setSaving(true);
    try {
      await createPieceType({
        name: trimmed,
        kind,
        colors: pieceColors,
        numbers: kind === 'numbered' ? numbers : [],
        stock: kind === 'counted' ? Object.fromEntries(pieceColors.map((c) => [c, stockFor(c)])) : {},
      });
      successBuzz();
      navigation.goBack();
    } catch (error) {
      Alert.alert("Couldn't add piece type", friendlyError(error));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const total = numbers.length * pieceColors.length;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.flexOne} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.appBody}>
          <TapeGutter />
          <View style={styles.contentColumn}>
            <ScrollView
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.header}>
                <Pressable style={styles.headerSideButton} onPress={() => navigation.goBack()}>
                  <BackChevronIcon color={colors.ink} />
                </Pressable>
                <Text style={styles.pageTitle}>New piece type</Text>
                <View style={styles.headerSideButton} />
              </View>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Name</Text>
                <TextInput
                  style={styles.textInput}
                  value={name}
                  onChangeText={setName}
                  placeholder="e.g. Hats"
                  placeholderTextColor={colors.inkFaint}
                  autoCapitalize="words"
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Kind</Text>
                <View style={styles.chipRow}>
                  {(
                    [
                      ['numbered', 'Numbered (one per number)'],
                      ['counted', 'Counted (ties, belts)'],
                    ] as [PieceKind, string][]
                  ).map(([value, label]) => {
                    const active = kind === value;
                    return (
                      <Pressable
                        key={value}
                        style={[styles.chip, active && styles.chipActive]}
                        onPress={() => setKind(value)}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: active }}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Colors</Text>
                <View style={styles.chipRow}>
                  {pieceColors.map((c) => (
                    <Pressable
                      key={c}
                      style={[styles.chip, styles.chipActive]}
                      onPress={() => removeColor(c)}
                      accessibilityLabel={`Remove ${c}`}
                    >
                      <Text style={[styles.chipText, styles.chipTextActive]}>{c} ✕</Text>
                    </Pressable>
                  ))}
                </View>
                <View style={styles.inputRow}>
                  <TextInput
                    style={[styles.textInput, styles.flexOne]}
                    value={colorText}
                    onChangeText={setColorText}
                    placeholder="+ color"
                    placeholderTextColor={colors.inkFaint}
                    autoCapitalize="words"
                    onSubmitEditing={addColor}
                  />
                  <Pressable style={styles.smallButton} onPress={addColor}>
                    <Text style={styles.smallButtonText}>Add</Text>
                  </Pressable>
                </View>
              </View>

              {kind === 'numbered' ? (
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Numbers</Text>
                  <View style={styles.inputRow}>
                    <TextInput
                      style={[styles.textInput, styles.flexOne]}
                      value={numberText}
                      onChangeText={setNumberText}
                      placeholder="104, 112, 120  or  104 to 232 every 4"
                      placeholderTextColor={colors.inkFaint}
                      autoCapitalize="none"
                      onSubmitEditing={addNumbers}
                    />
                    <Pressable style={styles.smallButton} onPress={addNumbers}>
                      <Text style={styles.smallButtonText}>Add</Text>
                    </Pressable>
                  </View>
                  <View style={[styles.chipRow, styles.numberChips]}>
                    {numbers.map((n) => (
                      <Pressable
                        key={n}
                        style={styles.chip}
                        onPress={() => removeNumber(n)}
                        accessibilityLabel={`Remove ${n}`}
                      >
                        <Text style={styles.chipText}>{n} ✕</Text>
                      </Pressable>
                    ))}
                  </View>
                  <Text style={styles.preview}>
                    {numbers.length} {numbers.length === 1 ? 'number' : 'numbers'} × {pieceColors.length}{' '}
                    {pieceColors.length === 1 ? 'color' : 'colors'} = {total} {total === 1 ? 'piece' : 'pieces'}
                  </Text>
                </View>
              ) : (
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Quantity per color</Text>
                  {pieceColors.length === 0 && <Text style={styles.preview}>Add a color first.</Text>}
                  {pieceColors.map((c) => (
                    <View key={c} style={styles.stockRow}>
                      <Text style={styles.stockName}>{c}</Text>
                      <TextInput
                        style={[styles.textInput, styles.stockInput]}
                        value={stock[c] ?? ''}
                        onChangeText={(t) => setStock((cur) => ({ ...cur, [c]: t }))}
                        placeholder="0"
                        placeholderTextColor={colors.inkFaint}
                        keyboardType="number-pad"
                      />
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>

            <View style={styles.footer}>
              <Pressable
                style={[styles.submitButton, saving && styles.submitButtonDisabled, !isOnline && OFFLINE_DIM]}
                onPress={handleSave}
                disabled={saving}
              >
                <Text style={styles.submitButtonText}>{saving ? 'Saving…' : 'Save piece type'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  flexOne: { flex: 1 },
  appBody: { flex: 1, flexDirection: 'row' },
  contentColumn: { flex: 1, flexDirection: 'column' },
  content: { paddingTop: 16, paddingHorizontal: 18, paddingBottom: 28 },
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
  field: { marginBottom: 22 },
  fieldLabel: { fontFamily: fonts.body, fontSize: 11.5, color: colors.inkSoft, marginBottom: 7 },
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
  inputRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  smallButton: {
    borderWidth: 1,
    borderColor: colors.ink,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallButtonText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.ink },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  numberChips: { marginTop: 10 },
  chip: { borderWidth: 1, borderColor: colors.line, paddingVertical: 7, paddingHorizontal: 12 },
  chipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontFamily: fonts.body, fontSize: 12, color: colors.inkSoft },
  chipTextActive: { color: colors.paper },
  preview: { fontFamily: fonts.body, fontSize: 12.5, color: colors.inkSoft, marginTop: 10 },
  stockRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  stockName: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.ink },
  stockInput: { width: 90, textAlign: 'right' },
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 10,
  },
  submitButton: { backgroundColor: colors.ink, paddingVertical: 14, alignItems: 'center' },
  submitButtonDisabled: { opacity: 0.6 },
  submitButtonText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.paper },
});
