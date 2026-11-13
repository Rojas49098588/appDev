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
import { useTheme, useThemedStyles, type Theme } from '../hooks/useTheme';
import { fonts } from '../constants/fonts';
import { useInventory } from '../context/InventoryContext';
import { useAuth } from '../context/AuthContext';
import { cardSummary, isWhiteShirt, keptAtHome, lineStatuses, moveBatch, withNewLabels } from '../lib/countedStock';
import { friendlyError } from '../lib/errors';
import { formatShortDate } from '../lib/format';
import { successBuzz } from '../lib/haptics';
import { OFFLINE_DIM, requireOnline, useConnection } from '../hooks/useConnection';
import TapeGutter from '../components/TapeGutter';
import OutlineButton from '../components/OutlineButton';
import { BackChevronIcon } from '../components/icons';

type Props = NativeStackScreenProps<RootStackParamList, 'Recount'>;

const whole = (text: string): number | null => (/^\d+$/.test(text.trim()) ? parseInt(text.trim(), 10) : null);

// Wash-day recount (mode 'count') or season totals (mode 'totals') for a counted piece type.
export default function RecountScreen({ navigation, route }: Props) {
  const { colors, expanded } = useTheme();
  const styles = useThemedStyles(makeStyles);
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
  // Batch amount per size, applied with Add or Remove.
  const [batches, setBatches] = useState<Record<string, string>>({});
  const [newLabel, setNewLabel] = useState('');
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  // Sizes saved while this screen is open (e.g. by another staff member) show up too.
  const labels = withNewLabels(order, (piece?.lines ?? []).map((l) => l.label));
  const kept = useMemo(
    () => (counting && piece && isWhiteShirt(piece.name) ? keptAtHome(accounts, piece.lines.map((l) => l.label)).kept : undefined),
    [counting, piece, accounts]
  );

  if (!piece) {
    return (
      <SafeAreaView style={styles.screen}>
        <Text style={styles.empty}>This piece type no longer exists.</Text>
      </SafeAreaView>
    );
  }

  // What's in a box: what was typed, else the saved number (lines added while open).
  const saved = new Map(piece.lines.map((l) => [l.label, String(counting ? l.count : l.total)]));
  const valueOf = (label: string) => values[label] ?? saved.get(label) ?? '0';

  // Live preview: typed counts against the season totals.
  const statuses = lineStatuses(
    piece.lines.map((l) => ({ ...l, count: whole(valueOf(l.label)) ?? 0 })),
    kept
  );
  const byLabel = new Map(statuses.map((s) => [s.label, s]));
  const summary = cardSummary(statuses);

  const setValue = (label: string, text: string) => setValues((cur) => ({ ...cur, [label]: text }));
  const step = (label: string, delta: number) => {
    const next = Math.max(0, (whole(valueOf(label)) ?? 0) + delta);
    setValue(label, String(next));
  };
  const batchOf = (label: string) => batches[label] ?? '0';
  const setBatch = (label: string, text: string) => setBatches((cur) => ({ ...cur, [label]: text }));
  const stepBatch = (label: string, delta: number) =>
    setBatch(label, String(Math.max(0, (whole(batchOf(label)) ?? 0) + delta)));
  const applyBatchTo = (label: string, direction: 'add' | 'remove') => {
    const amount = whole(batchOf(label));
    if (amount === null) {
      Alert.alert('Check the batch', 'The batch must be a whole number, 0 or more.');
      return;
    }
    const next = moveBatch(whole(valueOf(label)) ?? 0, amount, direction);
    if (next === null) {
      Alert.alert("Can't remove that many", `There aren't ${amount} ${label} to remove.`);
      return;
    }
    setValue(label, String(next));
    setBatch(label, '0');
  };

  const addLine = () => {
    const label = newLabel.trim();
    if (!label) return;
    if (labels.some((l) => l.toLowerCase() === label.toLowerCase())) {
      Alert.alert('Already added', `${label} is already in the list.`);
      return;
    }
    setOrder((cur) => [...cur, label]);
    setValue(label, '0');
    setNewLabel('');
  };

  const handleSave = async () => {
    if (savingRef.current) return;
    const entries: { label: string; total: number }[] = [];
    for (const label of labels) {
      const n = whole(valueOf(label));
      if (n === null) {
        Alert.alert('Check the numbers', `${label} must be a whole number, 0 or more.`);
        return;
      }
      entries.push({ label, total: n });
    }
    if (!requireOnline(isOnline)) return;
    savingRef.current = true;
    setSaving(true);
    try {
      if (counting) await recountPieceType(piece.id, Object.fromEntries(entries.map((e) => [e.label, e.total])));
      else await setSeasonTotals(piece.id, entries);
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
                <Pressable accessibilityLabel="Back" accessibilityRole="button" style={styles.headerSideButton} onPress={() => navigation.goBack()}>
                  <BackChevronIcon color={colors.ink} />
                </Pressable>
                <Text style={styles.pageTitle} accessibilityRole="header">
                  {counting ? `Recount ${piece.name}` : `Season totals: ${piece.name}`}
                </Text>
                <View style={styles.headerSideButton} />
              </View>
              <Text style={styles.hint}>
                {counting
                  ? `Enter how many are in the bins now.${piece.countedAt ? ` Last counted ${formatShortDate(piece.countedAt)}.` : ''}`
                  : 'Enter how many the season started with. New sizes or colors start with that many in the bins.'}
              </Text>

              {labels.map((label) => {
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
                        <Pressable accessibilityRole="button" style={styles.stepBtn} onPress={() => step(label, -1)} accessibilityLabel={`One fewer ${label}`}>
                          <Text style={styles.stepText}>−</Text>
                        </Pressable>
                        <TextInput
                          style={styles.countInput}
                          value={valueOf(label)}
                          onChangeText={(t) => setValue(label, t)}
                          keyboardType="number-pad"
                          accessibilityLabel={`${label} ${counting ? 'count' : 'season total'}`}
                        />
                        <Pressable accessibilityRole="button" style={styles.stepBtn} onPress={() => step(label, 1)} accessibilityLabel={`One more ${label}`}>
                          <Text style={styles.stepText}>+</Text>
                        </Pressable>
                      </View>
                    </View>
                    <View style={styles.batchLine}>
                      <Text style={styles.batchLabel}>Batch</Text>
                      <Pressable accessibilityRole="button" style={styles.stepBtn} onPress={() => stepBatch(label, -1)} accessibilityLabel={`Smaller ${label} batch`}>
                        <Text style={styles.stepText}>−</Text>
                      </Pressable>
                      <TextInput
                        style={[styles.countInput, styles.batchInput]}
                        value={batchOf(label)}
                        onChangeText={(t) => setBatch(label, t)}
                        keyboardType="number-pad"
                        selectTextOnFocus
                        accessibilityLabel={`${label} batch`}
                      />
                      <Pressable accessibilityRole="button" style={styles.stepBtn} onPress={() => stepBatch(label, 1)} accessibilityLabel={`Bigger ${label} batch`}>
                        <Text style={styles.stepText}>+</Text>
                      </Pressable>
                      {!expanded && (
                        <>
                          <Pressable accessibilityRole="button" style={styles.batchAction} onPress={() => applyBatchTo(label, 'add')} accessibilityLabel={`Add batch to ${label}`}>
                            <Text style={styles.smallButtonText}>{expanded ? `Add ${batchOf(label)}` : 'Add'}</Text>
                          </Pressable>
                          <Pressable accessibilityRole="button" style={styles.batchAction} onPress={() => applyBatchTo(label, 'remove')} accessibilityLabel={`Remove batch from ${label}`}>
                            <Text style={styles.smallButtonText}>{expanded ? `Remove ${batchOf(label)}` : 'Remove'}</Text>
                          </Pressable>
                        </>
                      )}
                    </View>
                    {expanded && (
                      <View style={styles.batchButtons}>
                        <Pressable accessibilityRole="button" style={styles.batchAction} onPress={() => applyBatchTo(label, 'add')} accessibilityLabel={`Add batch to ${label}`}>
                          <Text style={styles.smallButtonText}>{expanded ? `Add ${batchOf(label)}` : 'Add'}</Text>
                        </Pressable>
                        <Pressable accessibilityRole="button" style={styles.batchAction} onPress={() => applyBatchTo(label, 'remove')} accessibilityLabel={`Remove batch from ${label}`}>
                          <Text style={styles.smallButtonText}>{expanded ? `Remove ${batchOf(label)}` : 'Remove'}</Text>
                        </Pressable>
                      </View>
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
                  <OutlineButton
                    label="Change season totals"
                    style={styles.centeredButton}
                    onPress={() => navigation.push('Recount', { pieceTypeId, mode: 'totals' })}
                  />
                </>
              ) : (
                <View style={styles.batchRow}>
                  <TextInput accessibilityLabel="+ Add size or color"
                    style={[styles.textInput, styles.flexOne]}
                    value={newLabel}
                    onChangeText={setNewLabel}
                    placeholder="+ Add size or color"
                    placeholderTextColor={colors.inkFaint}
                    onSubmitEditing={addLine}
                  />
                  <Pressable accessibilityRole="button" style={styles.smallButton} onPress={addLine}>
                    <Text style={styles.smallButtonText}>Add</Text>
                  </Pressable>
                </View>
              )}
            </ScrollView>

            <View style={styles.footer}>
              <Pressable accessibilityRole="button"
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

function makeStyles(t: Theme) {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: t.colors.paper },
  flexOne: { flex: 1 },
  appBody: { flex: 1, flexDirection: 'row' },
  contentColumn: { flex: 1, flexDirection: 'column' },
  content: { paddingTop: 16, paddingHorizontal: 18, paddingBottom: 28 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 8 },
  headerSideButton: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  pageTitle: { flex: 1, textAlign: 'center', fontFamily: fonts.wordmark, fontSize: t.font(18), color: t.colors.ink },
  hint: { fontFamily: fonts.body, fontSize: t.font(12), color: t.colors.inkSoft, marginBottom: 14, textAlign: 'center' },
  empty: { fontFamily: fonts.body, fontSize: t.font(13), color: t.colors.inkSoft, padding: 24 },
  row: {
    borderWidth: 1,
    borderColor: t.colors.line,
    backgroundColor: t.colors.surface,
    padding: t.expanded ? 16 : 12,
    marginBottom: t.expanded ? 16 : 8,
    borderRadius: t.expanded ? 10 : 0,
  },
  rowMain: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
  label: { fontFamily: t.expanded ? fonts.bodySemiBold : fonts.bodyMedium, fontSize: t.font(t.expanded ? 17 : 14), color: t.colors.ink, minWidth: 40 },
  of: { flex: 1, fontFamily: fonts.body, fontSize: t.font(12), color: t.colors.inkFaint },
  ofMissing: { color: t.colors.amber },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 'auto' },
  stepBtn: {
    width: t.expanded ? 40 : 32,
    height: t.expanded ? 40 : 32,
    borderWidth: 1,
    borderColor: t.colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: { fontFamily: fonts.body, fontSize: t.font(t.expanded ? 20 : 17), color: t.colors.inkSoft },
  countInput: {
    minWidth: t.expanded ? 70 : 64,
    borderWidth: 1,
    borderColor: t.colors.line,
    paddingVertical: t.expanded ? 9 : 6,
    paddingHorizontal: 8,
    textAlign: 'right',
    fontFamily: fonts.mono,
    fontSize: t.font(t.expanded ? 16 : 15),
    color: t.colors.ink,
  },
  centeredButton: { alignSelf: 'center', marginTop: 14 },
  batchRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  batchLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    marginTop: t.expanded ? 14 : 10,
    paddingTop: t.expanded ? 12 : 10,
    borderTopWidth: 1,
    borderTopColor: t.colors.lineSoft,
    borderStyle: 'dashed',
  },
  batchLabel: { flex: 1, fontFamily: fonts.body, fontSize: t.font(12), color: t.colors.inkSoft },
  batchInput: { width: t.expanded ? 56 : 48 },
  batchButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  batchAction: {
    borderWidth: 1,
    borderColor: t.colors.ink,
    paddingVertical: 7,
    paddingHorizontal: 9,
  },
  textInput: {
    borderWidth: 1,
    borderColor: t.colors.line,
    backgroundColor: t.colors.surface,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontFamily: fonts.body,
    fontSize: t.font(14),
    color: t.colors.ink,
  },
  smallButton: {
    borderWidth: 1,
    borderColor: t.colors.ink,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallButtonText: { fontFamily: fonts.bodyMedium, fontSize: t.font(13), color: t.colors.ink },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, paddingHorizontal: 4 },
  totalLabel: { fontFamily: fonts.body, fontSize: t.font(13), color: t.colors.inkSoft },
  totalValue: { fontFamily: fonts.mono, fontSize: t.font(13), color: t.colors.ink },
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
