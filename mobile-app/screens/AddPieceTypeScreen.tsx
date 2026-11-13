import type { ComponentRef, Ref } from 'react';
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
import { useTheme, useThemedStyles, type Theme } from '../hooks/useTheme';
import { fonts } from '../constants/fonts';
import type { PieceKind } from '../lib/models';
import { addNumbers as mergeNumbers, saveProblem } from '../lib/pieceTypeForm';
import { useInventory } from '../context/InventoryContext';
import { friendlyError } from '../lib/errors';
import { successBuzz } from '../lib/haptics';
import { OFFLINE_DIM, useConnection } from '../hooks/useConnection';
import TapeGutter from '../components/TapeGutter';
import { BackChevronIcon } from '../components/icons';
import KeyboardDoneBar from '../components/KeyboardDoneBar';
import { useScrollToInput } from '../hooks/useScrollToInput';

type Props = NativeStackScreenProps<RootStackParamList, 'AddPieceType'>;

export default function AddPieceTypeScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { createPieceType } = useInventory();
  const { isOnline } = useConnection();
  const { scrollRef, handleScroll, registerBottomInset, scrollToFocusedInput } = useScrollToInput();
  const [numericFocused, setNumericFocused] = useState(false);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<PieceKind>('numbered');
  const [pieceColors, setPieceColors] = useState<string[]>([]);
  const [colorText, setColorText] = useState('');
  const [numbers, setNumbers] = useState<string[]>([]);
  const [numberText, setNumberText] = useState('');
  const [stock, setStock] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  // Returns the new color list, or null (after telling the user) when the text can't be added.
  const withColor = (text: string): string[] | null => {
    const c = text.trim();
    if (!c) return pieceColors;
    if (pieceColors.some((x) => x.toLowerCase() === c.toLowerCase())) {
      Alert.alert('Already added', `${c} is already in the list.`);
      return null;
    }
    return [...pieceColors, c];
  };

  const addColor = () => {
    const next = withColor(colorText);
    if (!next) return;
    setPieceColors(next);
    setColorText('');
  };

  const removeColor = (c: string) => {
    setPieceColors((cur) => cur.filter((x) => x !== c));
    setStock((cur) => {
      const { [c]: _removed, ...rest } = cur;
      return rest;
    });
  };

  // Returns the new number list, or null (after telling the user) when the text can't be read.
  const withNumbers = (text: string): string[] | null => {
    const result = mergeNumbers(numbers, text);
    if (result.error) {
      Alert.alert("Can't read those numbers", result.error);
      return null;
    }
    return result.numbers;
  };

  const addNumbers = () => {
    const next = withNumbers(numberText);
    if (!next) return;
    setNumbers(next);
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
    // Text typed but not committed with Add counts, and must be valid.
    const finalColors = withColor(colorText);
    if (!finalColors) return;
    const finalNumbers = kind === 'numbered' ? withNumbers(numberText) : numbers;
    if (!finalNumbers) return;
    if (kind === 'counted') {
      const bad = finalColors.find((c) => stock[c] && !/^\d+$/.test(stock[c]));
      if (bad) {
        Alert.alert('Check the season totals', `The season total for ${bad} must be a whole number.`);
        return;
      }
    }
    const problem = saveProblem({ name: trimmed, kind, colors: finalColors, numbers: finalNumbers, isOnline });
    if (problem) {
      Alert.alert(problem.title, problem.message);
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setPieceColors(finalColors);
    setColorText('');
    setNumbers(finalNumbers);
    setNumberText('');
    try {
      await createPieceType({
        name: trimmed,
        kind,
        colors: finalColors,
        numbers: kind === 'numbered' ? finalNumbers : [],
        stock: kind === 'counted' ? Object.fromEntries(finalColors.map((c) => [c, stockFor(c)])) : {},
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
              ref={scrollRef as unknown as Ref<ComponentRef<typeof ScrollView>>}
              onScroll={handleScroll}
              scrollEventThrottle={16}
              style={styles.flexOne}
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.header}>
                <Pressable accessibilityLabel="Back" accessibilityRole="button" style={styles.headerSideButton} onPress={() => navigation.goBack()}>
                  <BackChevronIcon color={colors.ink} />
                </Pressable>
                <Text style={styles.pageTitle} accessibilityRole="header">New piece type</Text>
                <View style={styles.headerSideButton} />
              </View>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Name</Text>
                <TextInput accessibilityLabel="e.g. Hats"
                  style={styles.textInput}
                  value={name}
                  onChangeText={setName}
                  placeholder="e.g. Hats"
                  placeholderTextColor={colors.inkFaint}
                  autoCapitalize="words"
                  onFocus={scrollToFocusedInput}
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
                <Text style={styles.fieldLabel}>{kind === 'counted' ? 'Sizes or colors' : 'Colors'}</Text>
                <View style={styles.chipRow}>
                  {pieceColors.map((c) => (
                    <Pressable accessibilityRole="button"
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
                  <TextInput accessibilityLabel="New color"
                    style={[styles.textInput, styles.flexOne]}
                    value={colorText}
                    onChangeText={setColorText}
                    placeholder={kind === 'counted' ? '+ size or color' : '+ color'}
                    placeholderTextColor={colors.inkFaint}
                    autoCapitalize="words"
                    onSubmitEditing={addColor}
                    onFocus={scrollToFocusedInput}
                  />
                  <Pressable accessibilityRole="button" style={styles.smallButton} onPress={addColor}>
                    <Text style={styles.smallButtonText}>Add</Text>
                  </Pressable>
                </View>
              </View>

              {kind === 'numbered' ? (
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Numbers</Text>
                  <View style={styles.inputRow}>
                    <TextInput accessibilityLabel="104, 112, 120  or  104 to 232 every 4"
                      style={[styles.textInput, styles.flexOne]}
                      value={numberText}
                      onChangeText={setNumberText}
                      placeholder="104, 112, 120  or  104 to 232 every 4"
                      placeholderTextColor={colors.inkFaint}
                      autoCapitalize="none"
                      onSubmitEditing={addNumbers}
                      onFocus={scrollToFocusedInput}
                    />
                    <Pressable accessibilityRole="button" style={styles.smallButton} onPress={addNumbers}>
                      <Text style={styles.smallButtonText}>Add</Text>
                    </Pressable>
                  </View>
                  <View style={[styles.chipRow, styles.numberChips]}>
                    {numbers.map((n) => (
                      <Pressable accessibilityRole="button"
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
                  <Text style={styles.fieldLabel}>Season total</Text>
                  {pieceColors.length === 0 && <Text style={styles.preview}>Add a size or color first.</Text>}
                  {pieceColors.map((c) => (
                    <View key={c} style={styles.stockRow}>
                      <Text style={styles.stockName}>{c}</Text>
                      <TextInput accessibilityLabel="0"
                        style={[styles.textInput, styles.stockInput]}
                        value={stock[c] ?? ''}
                        onChangeText={(t) => setStock((cur) => ({ ...cur, [c]: t }))}
                        placeholder="0"
                        placeholderTextColor={colors.inkFaint}
                        keyboardType="number-pad"
                        onFocus={(e) => {
                          scrollToFocusedInput(e);
                          setNumericFocused(true);
                        }}
                        onBlur={() => setNumericFocused(false)}
                      />
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>

            <View onLayout={registerBottomInset}>
            <KeyboardDoneBar visible={numericFocused} />
            <View style={styles.footer}>
              <Pressable accessibilityRole="button"
                style={[styles.submitButton, saving && styles.submitButtonDisabled, !isOnline && OFFLINE_DIM]}
                onPress={handleSave}
                disabled={saving}
              >
                <Text style={styles.submitButtonText}>{saving ? 'Saving…' : 'Save piece type'}</Text>
              </Pressable>
            </View>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: t.colors.paper },
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
    fontSize: t.font(18),
    color: t.colors.ink,
  },
  field: { marginBottom: 22 },
  fieldLabel: { fontFamily: fonts.body, fontSize: t.font(11.5), color: t.colors.inkSoft, marginBottom: 7 },
  textInput: {
    borderWidth: 1,
    borderColor: t.colors.line,
    backgroundColor: t.colors.surface,
    paddingVertical: 12,
    paddingHorizontal: 13,
    fontFamily: fonts.body,
    fontSize: t.font(14),
    color: t.colors.ink,
  },
  inputRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  smallButton: {
    borderWidth: 1,
    borderColor: t.colors.ink,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallButtonText: { fontFamily: fonts.bodyMedium, fontSize: t.font(13), color: t.colors.ink },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  numberChips: { marginTop: 10 },
  chip: { borderWidth: 1, borderColor: t.colors.line, paddingVertical: 7, paddingHorizontal: 12 },
  chipActive: { backgroundColor: t.colors.ink, borderColor: t.colors.ink },
  chipText: { fontFamily: fonts.body, fontSize: t.font(12), color: t.colors.inkSoft },
  chipTextActive: { color: t.colors.paper },
  preview: { fontFamily: fonts.body, fontSize: t.font(12.5), color: t.colors.inkSoft, marginTop: 10 },
  stockRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  stockName: { fontFamily: fonts.bodyMedium, fontSize: t.font(13), color: t.colors.ink },
  stockInput: { width: 90, textAlign: 'right' },
  footer: {
    borderTopWidth: 1,
    borderTopColor: t.colors.line,
    backgroundColor: t.colors.surface,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 10,
  },
  submitButton: { backgroundColor: t.colors.ink, paddingVertical: 14, alignItems: 'center' },
  submitButtonDisabled: { opacity: 0.6 },
  submitButtonText: { fontFamily: fonts.bodyMedium, fontSize: t.font(14), color: t.colors.paper },
});
}
