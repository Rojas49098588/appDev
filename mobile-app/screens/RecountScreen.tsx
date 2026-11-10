import { useMemo, useRef, useState } from 'react';
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
import { useInventory } from '../context/InventoryContext';
import { useAuth } from '../context/AuthContext';
import { applyBatch, cardSummary, isWhiteShirt, keptAtHome, lineStatuses } from '../lib/countedStock';
import { friendlyError } from '../lib/errors';
import { formatShortDate } from '../lib/format';
import { successBuzz } from '../lib/haptics';
import { OFFLINE_DIM, requireOnline, useConnection } from '../hooks/useConnection';
import TapeGutter from '../components/TapeGutter';
import { BackChevronIcon } from '../components/icons';

type Props = NativeStackScreenProps<RootStackParamList, 'Recount'>;

const whole = (text: string): number | null => (/^\d+$/.test(text.trim()) ? parseInt(text.trim(), 10) : null);

// Wash-day recount (mode 'count') or season totals (mode 'totals') for a counted piece type.
export default function RecountScreen({ navigation, route }: Props) {
  const { pieceTypeId, mode } = route.params;
  const { pieceTypes, recountPieceType, setSeasonTotals } = useInventory();
  const { accounts } = useAuth();
  const { isOnline } = useConnection();
  const piece = pieceTypes.find((t) => t.id === pieceTypeId);
  const counting = mode === 'count';

  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries((piece?.lines ?? []).map((l) => [l.label, String(counting ? l.count : l.total)]))
  );
  const [order, setOrder] = useState<string[]>(() => (piece?.lines ?? []).map((l) => l.label));
  const [batchFor, setBatchFor] = useState<string | null>(null);
  const [batchText, setBatchText] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const kept = useMemo(
    () => (piece && isWhiteShirt(piece.name) ? keptAtHome(accounts, order).kept : undefined),
    [piece, accounts, order]
  );

  if (!piece) {
    return (
      <SafeAreaView style={styles.screen}>
        <Text style={styles.empty}>This piece type no longer exists.</Text>
      </SafeAreaView>
    );
  }

  // Live preview: typed counts against the season totals.
  const statuses = lineStatuses(
    piece.lines.map((l) => ({ ...l, count: whole(values[l.label] ?? '') ?? 0 })),
    kept
  );
  const byLabel = new Map(statuses.map((s) => [s.label, s]));
  const summary = cardSummary(statuses);

  const setValue = (label: string, text: string) => setValues((cur) => ({ ...cur, [label]: text }));
  const step = (label: string, delta: number) => {
    const next = Math.max(0, (whole(values[label] ?? '') ?? 0) + delta);
    setValue(label, String(next));
  };
  const applyBatchTo = (label: string) => {
    const next = applyBatch(whole(values[label] ?? '') ?? 0, batchText);
    if (next === null) {
      Alert.alert("Can't add that", 'Type a whole number like +12 or −3.');
      return;
    }
    setValue(label, String(next));
    setBatchFor(null);
    setBatchText('');
  };

  const addLine = () => {
    const label = newLabel.trim();
    if (!label) return;
    if (order.some((l) => l.toLowerCase() === label.toLowerCase())) {
      Alert.alert('Already added', `${label} is already in the list.`);
      return;
    }
    setOrder((cur) => [...cur, label]);
    setValue(label, '0');
    setNewLabel('');
  };

  const handleSave = async () => {
    if (savingRef.current) return;
    const numbers: Record<string, number> = {};
    for (const label of order) {
      const n = whole(values[label] ?? '');
      if (n === null) {
        Alert.alert('Check the numbers', `${label} must be a whole number, 0 or more.`);
        return;
      }
      numbers[label] = n;
    }
    if (!requireOnline(isOnline)) return;
    savingRef.current = true;
    setSaving(true);
    try {
      if (counting) await recountPieceType(piece.id, numbers);
      else await setSeasonTotals(piece.id, numbers);
      successBuzz();
      navigation.goBack();
    } catch (error) {
      Alert.alert("Couldn't save", friendlyError(error));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.flexOne} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.appBody}>
          <TapeGutter />
          <View style={styles.contentColumn}>
            <ScrollView style={styles.flexOne} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
              <View style={styles.header}>
                <Pressable style={styles.headerSideButton} onPress={() => navigation.goBack()}>
                  <BackChevronIcon color={colors.ink} />
                </Pressable>
                <Text style={styles.pageTitle}>
                  {counting ? `Recount ${piece.name}` : `Season totals: ${piece.name}`}
                </Text>
                <View style={styles.headerSideButton} />
              </View>
              <Text style={styles.hint}>
                {counting
                  ? `Enter how many are in the bins now.${piece.countedAt ? ` Last counted ${formatShortDate(piece.countedAt)}.` : ''}`
                  : 'Enter how many the season started with. New sizes or colors start with that many in the bins.'}
              </Text>

              {order.map((label) => {
                const s = byLabel.get(label);
                return (
                  <View key={label} style={styles.row}>
                    <View style={styles.rowMain}>
                      <Text style={styles.label}>{label}</Text>
                      {counting && s && (
                        <Text style={[styles.of, s.missing > 0 && styles.ofMissing]}>
                          {s.missing > 0 ? `${s.missing} missing` : `of ${s.expected}`}
                        </Text>
                      )}
                      <View style={styles.stepper}>
                        <Pressable style={styles.stepBtn} onPress={() => step(label, -1)} accessibilityLabel={`One fewer ${label}`}>
                          <Text style={styles.stepText}>−</Text>
                        </Pressable>
                        <TextInput
                          style={styles.countInput}
                          value={values[label] ?? ''}
                          onChangeText={(t) => setValue(label, t)}
                          keyboardType="number-pad"
                          accessibilityLabel={`${label} ${counting ? 'count' : 'season total'}`}
                        />
                        <Pressable style={styles.stepBtn} onPress={() => step(label, 1)} accessibilityLabel={`One more ${label}`}>
                          <Text style={styles.stepText}>+</Text>
                        </Pressable>
                      </View>
                    </View>
                    {batchFor === label ? (
                      <View style={styles.batchRow}>
                        <TextInput
                          style={[styles.textInput, styles.flexOne]}
                          value={batchText}
                          onChangeText={setBatchText}
                          placeholder="+12 or −3"
                          placeholderTextColor={colors.inkFaint}
                          keyboardType="numbers-and-punctuation"
                          autoFocus
                          onSubmitEditing={() => applyBatchTo(label)}
                        />
                        <Pressable style={styles.smallButton} onPress={() => applyBatchTo(label)}>
                          <Text style={styles.smallButtonText}>Apply</Text>
                        </Pressable>
                      </View>
                    ) : (
                      <Pressable onPress={() => { setBatchFor(label); setBatchText(''); }}>
                        <Text style={styles.link}>Add or remove a batch</Text>
                      </Pressable>
                    )}
                  </View>
                );
              })}

              {counting ? (
                <>
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Total</Text>
                    <Text style={styles.totalValue}>
                      {summary.count} of {summary.expected}
                      {summary.missing > 0 ? ` · ${summary.missing} missing` : ''}
                    </Text>
                  </View>
                  <Pressable onPress={() => navigation.replace('Recount', { pieceTypeId, mode: 'totals' })}>
                    <Text style={[styles.link, styles.centered]}>Change season totals</Text>
                  </Pressable>
                </>
              ) : (
                <View style={styles.batchRow}>
                  <TextInput
                    style={[styles.textInput, styles.flexOne]}
                    value={newLabel}
                    onChangeText={setNewLabel}
                    placeholder="+ Add size or color"
                    placeholderTextColor={colors.inkFaint}
                    onSubmitEditing={addLine}
                  />
                  <Pressable style={styles.smallButton} onPress={addLine}>
                    <Text style={styles.smallButtonText}>Add</Text>
                  </Pressable>
                </View>
              )}
            </ScrollView>

            <View style={styles.footer}>
              <Pressable
                style={[styles.submitButton, saving && styles.submitButtonDisabled, !isOnline && OFFLINE_DIM]}
                onPress={handleSave}
                disabled={saving}
              >
                <Text style={styles.submitButtonText}>
                  {saving ? 'Saving…' : counting ? 'Save count' : 'Save totals'}
                </Text>
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 8 },
  headerSideButton: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  pageTitle: { flex: 1, textAlign: 'center', fontFamily: fonts.wordmark, fontSize: 18, color: colors.ink },
  hint: { fontFamily: fonts.body, fontSize: 12, color: colors.inkSoft, marginBottom: 14, textAlign: 'center' },
  empty: { fontFamily: fonts.body, fontSize: 13, color: colors.inkSoft, padding: 24 },
  row: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    padding: 12,
    marginBottom: 8,
  },
  rowMain: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  label: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.ink, minWidth: 40 },
  of: { flex: 1, fontFamily: fonts.body, fontSize: 12, color: colors.inkFaint },
  ofMissing: { color: colors.amber },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 'auto' },
  stepBtn: {
    width: 32,
    height: 32,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: { fontFamily: fonts.body, fontSize: 17, color: colors.inkSoft },
  countInput: {
    width: 64,
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: 6,
    paddingHorizontal: 8,
    textAlign: 'right',
    fontFamily: fonts.mono,
    fontSize: 15,
    color: colors.ink,
  },
  link: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.wash,
    textDecorationLine: 'underline',
    marginTop: 8,
  },
  centered: { textAlign: 'center', marginTop: 14 },
  batchRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  textInput: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.ink,
  },
  smallButton: {
    borderWidth: 1,
    borderColor: colors.ink,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallButtonText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.ink },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, paddingHorizontal: 4 },
  totalLabel: { fontFamily: fonts.body, fontSize: 13, color: colors.inkSoft },
  totalValue: { fontFamily: fonts.mono, fontSize: 13, color: colors.ink },
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
