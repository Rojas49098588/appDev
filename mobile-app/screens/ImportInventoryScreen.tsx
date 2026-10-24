import { useState } from 'react';
import type { ReactNode } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import type { RootStackParamList } from '../navigation/types';
import { colors } from '../constants/colors';
import { fonts } from '../constants/fonts';
import type { ImportSummary } from '../lib/models';
import { parseCsv } from '../lib/import/csv';
import { classifyRows, findColumns } from '../lib/import/rows';
import {
  buildPreview,
  countPiecesToAdd,
  isNothingToDo,
  toPayload,
  type ImportPlan,
  type NumberChange,
} from '../lib/import/preview';
import { loadImportNotes, useInventory } from '../context/InventoryContext';
import { useAuth } from '../context/AuthContext';
import { friendlyError } from '../lib/errors';
import { successBuzz } from '../lib/haptics';
import { OFFLINE_DIM, requireOnline, useConnection } from '../hooks/useConnection';
import TapeGutter from '../components/TapeGutter';
import { BackChevronIcon } from '../components/icons';

type Props = NativeStackScreenProps<RootStackParamList, 'ImportInventory'>;

const CSV_TYPES = ['text/csv', 'text/comma-separated-values', 'application/vnd.ms-excel', 'text/plain'];

function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

export default function ImportInventoryScreen({ navigation }: Props) {
  const { pieceTypes, pieces, importInventory } = useInventory();
  const { accounts } = useAuth();
  const { isOnline } = useConnection();
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [fileName, setFileName] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<ImportSummary | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggleSection = (key: string) => setExpanded((e) => ({ ...e, [key]: !e[key] }));

  const handlePick = async () => {
    try {
      const picked = await DocumentPicker.getDocumentAsync({ type: CSV_TYPES, copyToCacheDirectory: true });
      if (picked.canceled) return;
      const asset = picked.assets[0];
      setLoading(true);
      const text = await new File(asset.uri).text();
      const cells = parseCsv(text);
      const cols = findColumns(cells[0] ?? []);
      if ('missing' in cols) {
        Alert.alert(
          "This sheet can't be read",
          `Missing column${cols.missing.length === 1 ? '' : 's'}: ${cols.missing.join(', ')}`
        );
        return;
      }
      const rows = classifyRows(cells, cols);
      const notes = await loadImportNotes();
      setPlan(buildPreview(rows, accounts, pieceTypes, pieces, notes));
      setFileName(asset.name);
      setExpanded({});
    } catch (error) {
      Alert.alert("Couldn't read the spreadsheet", friendlyError(error));
    } finally {
      setLoading(false);
    }
  };

  const setChoice = (change: NumberChange, choice: 'sheet' | 'app') => {
    setPlan(
      (p) =>
        p && {
          ...p,
          numbers: p.numbers.map((n) =>
            n.memberId === change.memberId && n.pieceType === change.pieceType ? { ...n, choice } : n
          ),
        }
    );
  };

  const handleImport = () => {
    if (!plan || saving || !requireOnline(isOnline)) return;
    const payload = toPayload(plan);
    const lines = [
      payload.typesToCreate.length ? plural(payload.typesToCreate.length, 'new piece type') : null,
      payload.piecesToAdd.length
        ? `${plural(payload.piecesToAdd.length, 'number')} (${plural(countPiecesToAdd(plan, pieceTypes), 'piece')})`
        : null,
      payload.outForRepair.length ? `${plural(payload.outForRepair.length, 'piece')} out for repair` : null,
      payload.numbers.length ? `${plural(payload.numbers.length, 'student number')} set` : null,
      payload.notes.length ? plural(payload.notes.length, 'repair note') : null,
    ].filter(Boolean);
    Alert.alert('Import this sheet?', lines.join('\n'), [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Import',
        onPress: async () => {
          setSaving(true);
          try {
            const summary = await importInventory(payload);
            successBuzz();
            setResult(summary);
          } catch (error) {
            Alert.alert("Couldn't import", friendlyError(error));
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  };

  const renderProblems = (list: ImportPlan['problems']) =>
    list.length > 0 && (
      <View style={styles.problemBox}>
        <Text style={styles.problemTitle}>{plural(list.length, 'problem')} (skipped)</Text>
        {list.map((p, i) => (
          <Text key={`${p.line}-${i}`} style={styles.problemText}>
            {p.message}
          </Text>
        ))}
      </View>
    );

  const section = (key: string, title: string, count: number, body: ReactNode) => {
    if (count === 0) return null;
    const open = !!expanded[key];
    return (
      <View style={styles.section} key={key}>
        <Pressable style={styles.sectionHead} onPress={() => toggleSection(key)} accessibilityRole="button">
          <Text style={styles.sectionTitle}>{title}</Text>
          <Text style={styles.sectionCount}>
            {count} {open ? '▴' : '▾'}
          </Text>
        </Pressable>
        {open && <View style={styles.sectionBody}>{body}</View>}
      </View>
    );
  };

  const renderResult = (summary: ImportSummary, p: ImportPlan) => (
    <>
      <Text style={styles.heading}>Import complete</Text>
      <View style={styles.card}>
        <Text style={styles.line}>{plural(summary.typesCreated, 'piece type')} created</Text>
        <Text style={styles.line}>{plural(summary.piecesAdded, 'piece')} added</Text>
        <Text style={styles.line}>{plural(summary.markedOutForRepair, 'piece')} marked out for repair</Text>
        <Text style={styles.line}>{plural(summary.numbersSet, 'student number')} set</Text>
        <Text style={styles.line}>{plural(summary.notesAdded, 'repair note')} added</Text>
      </View>
      {renderProblems(p.problems)}
      <Pressable style={styles.primary} onPress={() => navigation.goBack()}>
        <Text style={styles.primaryText}>Done</Text>
      </Pressable>
    </>
  );

  const renderPreview = (p: ImportPlan) => {
    const nothing = isNothingToDo(p);
    return (
      <>
        <Text style={styles.heading}>{fileName}</Text>
        {nothing && <Text style={styles.empty}>Everything in this sheet is already in the app.</Text>}
        {section(
          'types',
          'New piece types',
          p.typesToCreate.length,
          p.typesToCreate.map((t) => (
            <Text key={t.name} style={styles.line}>
              {t.name} — {t.colors.join(', ')}
            </Text>
          ))
        )}
        {section(
          'pieces',
          'Pieces to add',
          p.piecesToAdd.length,
          <>
            <Text style={styles.line}>
              {plural(p.piecesToAdd.length, 'number')} → {plural(countPiecesToAdd(p, pieceTypes), 'piece')}
            </Text>
            {p.piecesToAdd.map((x) => (
              <Text key={`${x.pieceType}-${x.number}`} style={styles.lineSoft}>
                {x.pieceType} {x.number}
              </Text>
            ))}
          </>
        )}
        {section(
          'repair',
          'Out for repair',
          p.outForRepair.length,
          p.outForRepair.map((x) => (
            <Text key={`${x.pieceType}-${x.color}-${x.number}`} style={styles.line}>
              {x.color} {x.pieceType} {x.number}
            </Text>
          ))
        )}
        {section(
          'numbers',
          'Student numbers',
          p.numbers.length,
          p.numbers.map((n) => (
            <View key={`${n.memberId}-${n.pieceType}`} style={styles.numberRow}>
              <Text style={styles.line}>
                {n.memberName} — {n.pieceType} {n.sheet}
              </Text>
              {n.current !== null && n.current !== n.sheet && (
                <View style={styles.choiceRow}>
                  {(['sheet', 'app'] as const).map((c) => (
                    <Pressable
                      key={c}
                      style={[styles.choice, n.choice === c && styles.choiceOn]}
                      onPress={() => setChoice(n, c)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: n.choice === c }}
                    >
                      <Text style={[styles.choiceText, n.choice === c && styles.choiceTextOn]}>
                        {c === 'sheet' ? `Sheet ${n.sheet}` : `App ${n.current}`}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          ))
        )}
        {section(
          'notes',
          'Repair notes',
          p.notes.length,
          <Text style={styles.line}>{plural(p.notes.length, 'note')}, staff only</Text>
        )}
        {renderProblems(p.problems)}
        {!nothing && (
          <Pressable
            style={[styles.primary, (saving || !isOnline) && OFFLINE_DIM]}
            onPress={handleImport}
            disabled={saving || !isOnline}
          >
            {saving ? <ActivityIndicator color={colors.paper} /> : <Text style={styles.primaryText}>Import</Text>}
          </Pressable>
        )}
      </>
    );
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.appBody}>
        <TapeGutter />
        <ScrollView style={styles.flexOne} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Pressable style={styles.headerSideButton} onPress={() => navigation.goBack()} accessibilityLabel="Back">
              <BackChevronIcon color={colors.ink} />
            </Pressable>
            <Text style={styles.pageTitle}>Import spreadsheet</Text>
            <View style={styles.headerSideButton} />
          </View>

          {plan && result ? (
            renderResult(result, plan)
          ) : (
            <>
              <Pressable style={[styles.pick, loading && OFFLINE_DIM]} onPress={handlePick} disabled={loading}>
                {loading ? (
                  <ActivityIndicator color={colors.ink} />
                ) : (
                  <Text style={styles.pickText}>
                    {plan ? 'Choose a different spreadsheet' : 'Choose spreadsheet (.csv)'}
                  </Text>
                )}
              </Pressable>
              <Text style={styles.help}>In Box or Excel: File → Save as / Download → CSV.</Text>
              {plan && renderPreview(plan)}
            </>
          )}
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 14 },
  headerSideButton: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  pageTitle: { flex: 1, textAlign: 'center', fontFamily: fonts.wordmark, fontSize: 18, color: colors.ink },
  pick: {
    borderWidth: 1,
    borderColor: colors.ink,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  pickText: { fontFamily: fonts.bodyMedium, fontSize: 13.5, color: colors.ink },
  help: { fontFamily: fonts.body, fontSize: 11.5, color: colors.inkSoft, marginTop: 8, marginBottom: 14 },
  heading: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.ink, marginBottom: 10 },
  empty: { fontFamily: fonts.body, fontSize: 13, color: colors.inkSoft, marginBottom: 12 },
  section: { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, marginBottom: 8 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', padding: 12 },
  sectionTitle: { fontFamily: fonts.bodyMedium, fontSize: 13.5, color: colors.ink },
  sectionCount: { fontFamily: fonts.body, fontSize: 13, color: colors.inkSoft },
  sectionBody: { paddingHorizontal: 12, paddingBottom: 12, gap: 6 },
  card: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    padding: 12,
    gap: 6,
    marginBottom: 10,
  },
  line: { fontFamily: fonts.body, fontSize: 13, color: colors.ink },
  lineSoft: { fontFamily: fonts.body, fontSize: 12, color: colors.inkSoft },
  numberRow: { gap: 6 },
  choiceRow: { flexDirection: 'row', gap: 8 },
  choice: { borderWidth: 1, borderColor: colors.line, paddingVertical: 5, paddingHorizontal: 10 },
  choiceOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  choiceText: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.ink },
  choiceTextOn: { color: colors.paper },
  problemBox: {
    borderWidth: 1,
    borderColor: colors.amber,
    backgroundColor: colors.amberTint,
    padding: 12,
    gap: 4,
    marginBottom: 10,
  },
  problemTitle: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.amber },
  problemText: { fontFamily: fonts.body, fontSize: 12, color: colors.amber },
  primary: { backgroundColor: colors.ink, paddingVertical: 13, alignItems: 'center', marginTop: 6 },
  primaryText: { fontFamily: fonts.bodyMedium, fontSize: 13.5, color: colors.paper },
});
