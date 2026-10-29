import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Image,
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
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors } from '../constants/colors';
import { fonts } from '../constants/fonts';
import { useGames } from '../context/GamesContext';
import { useCombos } from '../context/CombosContext';
import { useScrollToInput } from '../hooks/useScrollToInput';
import { OFFLINE_DIM, requireOnline, useConnection } from '../hooks/useConnection';
import { friendlyError } from '../lib/errors';
import { formatClock, formatGameDate } from '../lib/format';
import { isCourt, missingFields } from '../lib/games';
import { successBuzz } from '../lib/haptics';
import type { Division, GameDraft, GameStatus, Sport } from '../lib/models';
import TapeGutter from '../components/TapeGutter';
import KeyboardDoneBar from '../components/KeyboardDoneBar';
import ComboPickerSheet from '../components/ComboPickerSheet';
import { BackChevronIcon, CheckIcon } from '../components/icons';

type Props = NativeStackScreenProps<RootStackParamList, 'GameEdit'>;
type PickerKind = 'date' | 'kickoff' | 'call';
type ComboSlot = 'preGameComboId' | 'halftimeComboId';

const SPORTS: { value: Sport; label: string }[] = [
  { value: 'football', label: 'Football' },
  { value: 'basketball', label: 'Basketball' },
  { value: 'volleyball', label: 'Volleyball' },
];

const pad = (n: number) => String(n).padStart(2, '0');
// Local fields, never toISOString: that would shift the day for some timezones.
const toDateString = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toTimeString = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
function pickerValue(kind: PickerKind, draft: GameDraft): Date {
  const now = new Date();
  if (kind === 'date') {
    if (!draft.gameDate) return now;
    const [y, m, d] = draft.gameDate.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  const t = kind === 'kickoff' ? draft.kickoffTime : draft.callTime;
  if (!t) return now;
  const [h, min] = t.split(':').map(Number);
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, min);
}

const blankDraft = (sport: Sport): GameDraft => ({
  sport,
  division: null,
  opponent: '',
  gameDate: null,
  kickoffTime: null,
  callTime: null,
  noCallTime: false,
  polo: [],
  poloNote: '',
  groupNumber: null,
  preGameComboId: null,
  halftimeComboId: null,
  afterGameInstructions: '',
});

export default function GameEditScreen({ navigation, route }: Props) {
  const { gameId, sport: sportParam } = route.params ?? {};
  const { games, poloColors, createGame, updateGame, setStatus, deleteGame } = useGames();
  const { combos } = useCombos();
  const { isOnline } = useConnection();
  const { scrollRef, handleScroll, registerBottomInset, scrollToFocusedInput } = useScrollToInput();

  const game = gameId ? games.find((g) => g.id === gameId) : undefined;
  const status: GameStatus = game?.status ?? 'draft';
  const isExisting = gameId !== undefined;

  const [draft, setDraft] = useState<GameDraft>(() => {
    if (game) {
      const { id, status: _status, instructionsPostedBy, instructionsUpdatedAt, ...rest } = game;
      return rest;
    }
    return blankDraft(sportParam ?? 'football');
  });
  const [showErrors, setShowErrors] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);
  const leavingRef = useRef(false);
  const [picker, setPicker] = useState<PickerKind | null>(null);
  const [comboSlot, setComboSlot] = useState<ComboSlot | null>(null);
  const [instructionsFocused, setInstructionsFocused] = useState(false);

  // Deleted elsewhere while open: leave.
  useEffect(() => {
    if (isExisting && !game && !leavingRef.current) {
      leavingRef.current = true;
      navigation.goBack();
    }
  }, [isExisting, game, navigation]);

  const court = isCourt(draft.sport);
  const missing = missingFields(draft);
  const bad = (field: string) => showErrors && missing.includes(field);
  const startLabel = court ? 'Start' : 'Kickoff';
  const set = (patch: Partial<GameDraft>) => setDraft((d) => ({ ...d, ...patch }));

  const setSport = (sport: Sport) => {
    if (sport === draft.sport) return;
    if (isCourt(sport)) {
      set({ sport, preGameComboId: null, halftimeComboId: null, afterGameInstructions: '' });
    } else {
      set({ sport, division: null, groupNumber: null });
    }
  };

  const onPicked = (kind: PickerKind) => (event: DateTimePickerEvent, value?: Date) => {
    if (Platform.OS === 'android') setPicker(null);
    if (event.type !== 'set' || !value) return;
    if (kind === 'date') set({ gameDate: toDateString(value) });
    else if (kind === 'kickoff') set({ kickoffTime: toTimeString(value) });
    else set({ callTime: toTimeString(value) });
  };

  // Saved colors that were later removed from the palette still show, from the game's own copy.
  const poloOptions = [
    ...poloColors.map((p) => ({ name: p.name, swatch: p.swatch })),
    ...draft.polo.filter((s) => !poloColors.some((p) => p.name === s.name)),
  ];
  const togglePolo = (opt: { name: string; swatch: string }) => {
    const on = draft.polo.some((s) => s.name === opt.name);
    set({ polo: on ? draft.polo.filter((s) => s.name !== opt.name) : [...draft.polo, opt] });
  };

  const comboById = (id: string | null) => (id ? combos.find((c) => c.id === id) : undefined);

  // Runs a write with the offline check and the double-submit guard.
  const runWrite = async (failTitle: string, work: () => Promise<void>) => {
    if (savingRef.current) return;
    if (!requireOnline(isOnline)) return;
    savingRef.current = true;
    setIsSaving(true);
    try {
      await work();
      successBuzz();
      leavingRef.current = true;
      navigation.goBack();
    } catch (error) {
      // The form keeps what staff typed.
      Alert.alert(failTitle, friendlyError(error));
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  const save = (target: GameStatus) => {
    if (target === 'ready' && missing.length > 0) {
      setShowErrors(true);
      return;
    }
    setShowErrors(false);
    void runWrite("Couldn't save game", async () => {
      if (game) await updateGame(game.id, draft, target);
      else await createGame(draft, target);
    });
  };

  const moveToDraft = () => {
    if (!game) return;
    void runWrite("Couldn't move game back to draft", () => setStatus(game.id, 'draft'));
  };

  const confirmDelete = () => {
    if (!game) return;
    const date = game.gameDate ? formatGameDate(game.gameDate) : 'no date';
    Alert.alert('Delete game', `Delete vs. ${game.opponent} on ${date}? This can't be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => void runWrite("Couldn't delete game", () => deleteGame(game.id)),
      },
    ]);
  };

  const title = draft.opponent.trim() ? `vs. ${draft.opponent.trim()}` : 'New game';
  const pillStyle =
    status === 'ready'
      ? { bg: colors.washTint, fg: colors.wash, border: colors.wash }
      : { bg: colors.rustTint, fg: colors.rust, border: colors.rust };

  const label = (text: string, required = true) => (
    <Text style={styles.fieldLabel}>
      {text}
      {required && <Text style={styles.req}> *</Text>}
    </Text>
  );
  const errText = (field: string) => (bad(field) ? <Text style={styles.errText}>Required</Text> : null);

  const valueBox = (key: PickerKind, text: string | null, placeholder: string, err: boolean, disabled = false) => (
    <Pressable
      style={[styles.input, err && styles.inputErr, disabled && styles.inputDisabled]}
      disabled={disabled}
      onPress={() => setPicker(picker === key ? null : key)}
    >
      <Text style={text ? styles.inputText : styles.placeholder}>{text ?? placeholder}</Text>
    </Pressable>
  );

  const comboCard = (slot: ComboSlot, heading: string) => {
    const combo = comboById(draft[slot]);
    return (
      <View style={styles.field}>
        {label(heading)}
        <View style={[styles.comboCard, bad(heading) && styles.inputErr]}>
          {combo?.image ? (
            <Image source={{ uri: combo.image }} style={styles.comboThumb} />
          ) : (
            <View style={styles.comboThumb} />
          )}
          <View style={styles.flexOne}>
            <Text style={combo ? styles.inputText : styles.placeholder}>{combo ? combo.label : 'No combo chosen'}</Text>
            {combo && combo.sub !== '' && <Text style={styles.comboSub}>{combo.sub}</Text>}
          </View>
          <Pressable onPress={() => setComboSlot(slot)} hitSlop={8}>
            <Text style={styles.link}>{combo ? 'Change' : 'Choose'}</Text>
          </Pressable>
        </View>
        {errText(heading)}
      </View>
    );
  };

  const busy = isSaving || !isOnline;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.flexOne} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.appBody}>
          <TapeGutter />
          <View style={styles.contentColumn}>
            <ScrollView
              ref={scrollRef}
              style={styles.flexOne}
              contentContainerStyle={styles.content}
              onScroll={handleScroll}
              scrollEventThrottle={16}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.header}>
                <Pressable style={styles.headerSide} onPress={() => navigation.goBack()}>
                  <BackChevronIcon color={colors.ink} />
                </Pressable>
                <Text style={styles.pageTitle} numberOfLines={1}>
                  {title}
                </Text>
                <View style={[styles.pill, { backgroundColor: pillStyle.bg, borderColor: pillStyle.border }]}>
                  <Text style={[styles.pillText, { color: pillStyle.fg }]}>{status === 'ready' ? 'Ready' : 'Draft'}</Text>
                </View>
              </View>

              {showErrors && missing.length > 0 && (
                <View style={styles.banner}>
                  <Text style={styles.bannerText}>
                    Fill in {missing.length} more {missing.length === 1 ? 'field' : 'fields'} to mark this game ready.
                  </Text>
                </View>
              )}

              <View style={styles.field}>
                {label('Type')}
                <View style={styles.chipRow}>
                  {SPORTS.map((s) => (
                    <Pressable
                      key={s.value}
                      style={[styles.chip, draft.sport === s.value && styles.chipOn]}
                      onPress={() => setSport(s.value)}
                    >
                      <Text style={[styles.chipText, draft.sport === s.value && styles.chipTextOn]}>{s.label}</Text>
                    </Pressable>
                  ))}
                </View>
                {court && (
                  <View style={[styles.chipRow, styles.chipRowGap]}>
                    {([['mens', "Men's"], ['womens', "Women's"]] as [Division, string][]).map(([value, text]) => (
                      <Pressable
                        key={value}
                        style={[styles.chip, draft.division === value && styles.chipOn, bad("Men's / Women's") && styles.inputErr]}
                        onPress={() => set({ division: value })}
                      >
                        <Text style={[styles.chipText, draft.division === value && styles.chipTextOn]}>{text}</Text>
                      </Pressable>
                    ))}
                  </View>
                )}
                {court && errText("Men's / Women's")}
              </View>

              <View style={styles.field}>
                {label('Opposing university')}
                <TextInput
                  style={[styles.input, styles.inputText, bad('Opposing university') && styles.inputErr]}
                  value={draft.opponent}
                  onChangeText={(opponent) => set({ opponent })}
                  placeholder="e.g. Tulane"
                  placeholderTextColor={colors.inkFaint}
                  onFocus={scrollToFocusedInput}
                />
                {errText('Opposing university')}
              </View>

              <View style={styles.field}>
                {label('Game date')}
                {valueBox('date', draft.gameDate ? formatGameDate(draft.gameDate) : null, 'Choose a date', bad('Game date'))}
                {errText('Game date')}
              </View>

              <View style={styles.timeRow}>
                <View style={styles.flexOne}>
                  {label(startLabel)}
                  {valueBox('kickoff', draft.kickoffTime ? formatClock(draft.kickoffTime) : null, 'Choose a time', bad(startLabel))}
                  {errText(startLabel)}
                </View>
                <View style={styles.flexOne}>
                  {label('Call time')}
                  {valueBox(
                    'call',
                    draft.noCallTime ? null : draft.callTime ? formatClock(draft.callTime) : null,
                    draft.noCallTime ? 'None' : 'Choose a time',
                    bad('Call time'),
                    draft.noCallTime
                  )}
                  {errText('Call time')}
                </View>
              </View>
              <Pressable
                style={styles.checkRow}
                onPress={() => {
                  if (!draft.noCallTime && picker === 'call') setPicker(null);
                  set({ noCallTime: !draft.noCallTime, callTime: null });
                }}
              >
                <View style={[styles.checkbox, draft.noCallTime && styles.checkboxOn]}>
                  {draft.noCallTime && <CheckIcon color={colors.paper} size={12} />}
                </View>
                <Text style={styles.checkText}>No call time for this game</Text>
              </Pressable>

              {picker !== null && (
                <View style={styles.pickerWrap}>
                  <DateTimePicker
                    value={pickerValue(picker, draft)}
                    mode={picker === 'date' ? 'date' : 'time'}
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={onPicked(picker)}
                  />
                  {Platform.OS === 'ios' && (
                    <Pressable style={styles.pickerDone} onPress={() => setPicker(null)}>
                      <Text style={styles.link}>Done</Text>
                    </Pressable>
                  )}
                </View>
              )}

              <View style={styles.field}>
                <View style={styles.labelRow}>
                  {label('Polo')}
                  <Pressable onPress={() => navigation.navigate('PoloColors')} hitSlop={8}>
                    <Text style={styles.link}>Edit colors</Text>
                  </Pressable>
                </View>
                <View style={styles.chipRow}>
                  {poloOptions.map((opt) => {
                    const on = draft.polo.some((s) => s.name === opt.name);
                    return (
                      <Pressable
                        key={opt.name}
                        style={[styles.chip, styles.chipWithDot, on && styles.chipOn, bad('Polo') && styles.inputErr]}
                        onPress={() => togglePolo(opt)}
                      >
                        {on && <CheckIcon color={colors.paper} size={12} />}
                        <View style={[styles.dot, { backgroundColor: opt.swatch }]} />
                        <Text style={[styles.chipText, on && styles.chipTextOn]}>{opt.name}</Text>
                      </Pressable>
                    );
                  })}
                  {poloOptions.length === 0 && <Text style={styles.placeholder}>No polo colors yet.</Text>}
                </View>
                {errText('Polo')}
              </View>

              <View style={styles.field}>
                {label('Polo note (optional)', false)}
                <TextInput
                  style={[styles.input, styles.inputText]}
                  value={draft.poloNote}
                  onChangeText={(poloNote) => set({ poloNote })}
                  placeholder="e.g. Bring the long-sleeve"
                  placeholderTextColor={colors.inkFaint}
                  onFocus={scrollToFocusedInput}
                />
              </View>

              {!court && comboCard('preGameComboId', 'Pre-game combo')}
              {!court && comboCard('halftimeComboId', 'Halftime combo')}

              {court && (
                <View style={styles.field}>
                  {label('Group')}
                  <View style={styles.chipRow}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Pressable
                        key={n}
                        style={[styles.groupBtn, draft.groupNumber === n && styles.chipOn, bad('Group') && styles.inputErr]}
                        onPress={() => set({ groupNumber: n })}
                      >
                        <Text style={[styles.chipText, draft.groupNumber === n && styles.chipTextOn]}>{n}</Text>
                      </Pressable>
                    ))}
                  </View>
                  {errText('Group')}
                </View>
              )}

              {!court && (
                <View style={styles.field}>
                  {label('After-game instructions (optional)', false)}
                  <TextInput
                    style={[styles.input, styles.inputText, styles.multiline]}
                    value={draft.afterGameInstructions}
                    onChangeText={(afterGameInstructions) => set({ afterGameInstructions })}
                    placeholder="What members should do after the game"
                    placeholderTextColor={colors.inkFaint}
                    multiline
                    textAlignVertical="top"
                    onFocus={(e) => {
                      scrollToFocusedInput(e);
                      setInstructionsFocused(true);
                    }}
                    onBlur={() => setInstructionsFocused(false)}
                  />
                </View>
              )}

              {isExisting && (
                <Pressable style={styles.deleteBtn} onPress={confirmDelete} disabled={isSaving}>
                  <Text style={styles.deleteText}>Delete game</Text>
                </Pressable>
              )}
            </ScrollView>

            <View onLayout={registerBottomInset}>
              <KeyboardDoneBar visible={instructionsFocused} />
              <View style={styles.footer}>
                {status === 'ready' ? (
                  <>
                    <Pressable style={[styles.btn, busy && OFFLINE_DIM]} disabled={isSaving} onPress={moveToDraft}>
                      <Text style={styles.btnText}>Move back to draft</Text>
                    </Pressable>
                    <Pressable style={[styles.btn, styles.btnDark, busy && OFFLINE_DIM]} disabled={isSaving} onPress={() => save('ready')}>
                      <Text style={[styles.btnText, styles.btnTextDark]}>{isSaving ? 'Saving…' : 'Save'}</Text>
                    </Pressable>
                  </>
                ) : (
                  <>
                    <Pressable style={[styles.btn, busy && OFFLINE_DIM]} disabled={isSaving} onPress={() => save('draft')}>
                      <Text style={styles.btnText}>{isSaving ? 'Saving…' : 'Save draft'}</Text>
                    </Pressable>
                    <Pressable style={[styles.btn, styles.btnDark, busy && OFFLINE_DIM]} disabled={isSaving} onPress={() => save('ready')}>
                      <Text style={[styles.btnText, styles.btnTextDark]}>Mark ready</Text>
                    </Pressable>
                  </>
                )}
              </View>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>

      <ComboPickerSheet
        visible={comboSlot !== null}
        combos={combos}
        selectedId={comboSlot ? draft[comboSlot] : null}
        onPick={(id) => {
          if (comboSlot) set({ [comboSlot]: id } as Partial<GameDraft>);
          setComboSlot(null);
        }}
        onClose={() => setComboSlot(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  flexOne: { flex: 1 },
  appBody: { flex: 1, flexDirection: 'row' },
  contentColumn: { flex: 1, flexDirection: 'column' },
  content: { paddingTop: 16, paddingHorizontal: 18, paddingBottom: 28 },
  header: { flexDirection: 'row', alignItems: 'center', paddingBottom: 14, gap: 8 },
  headerSide: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  pageTitle: { flex: 1, textAlign: 'center', fontFamily: fonts.wordmark, fontSize: 18, color: colors.ink },
  pill: { borderWidth: 1, paddingHorizontal: 8, paddingVertical: 2 },
  pillText: { fontFamily: fonts.bodySemiBold, fontSize: 10.5 },
  banner: { backgroundColor: colors.rustTint, borderWidth: 1, borderColor: colors.rust, padding: 10, marginBottom: 14 },
  bannerText: { fontFamily: fonts.body, fontSize: 12, color: colors.rust },
  field: { marginBottom: 20 },
  fieldLabel: { fontFamily: fonts.body, fontSize: 11.5, color: colors.inkSoft, marginBottom: 7 },
  req: { color: colors.rust },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  link: { fontFamily: fonts.bodyMedium, fontSize: 12.5, color: colors.wash },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingVertical: 12,
    paddingHorizontal: 13,
  },
  inputText: { fontFamily: fonts.body, fontSize: 14, color: colors.ink },
  placeholder: { fontFamily: fonts.body, fontSize: 14, color: colors.inkFaint },
  inputErr: { borderColor: colors.rust, backgroundColor: colors.rustTint },
  inputDisabled: { opacity: 0.5 },
  errText: { fontFamily: fonts.body, fontSize: 11, color: colors.rust, marginTop: 4 },
  multiline: { minHeight: 90 },
  timeRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20 },
  checkbox: { width: 18, height: 18, borderWidth: 1, borderColor: colors.inkSoft, alignItems: 'center', justifyContent: 'center' },
  checkboxOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  checkText: { fontFamily: fonts.body, fontSize: 13, color: colors.ink },
  pickerWrap: { marginBottom: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  pickerDone: { alignSelf: 'flex-end', padding: 10 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chipRowGap: { marginTop: 8 },
  chip: { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, paddingVertical: 7, paddingHorizontal: 12 },
  chipWithDot: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chipOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontFamily: fonts.body, fontSize: 12, color: colors.inkSoft },
  chipTextOn: { color: colors.paper },
  dot: { width: 10, height: 10, borderRadius: 5, borderWidth: 1, borderColor: colors.line },
  groupBtn: {
    width: 48,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  comboCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    padding: 10,
  },
  comboThumb: { width: 40, height: 52, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line },
  comboSub: { fontFamily: fonts.body, fontSize: 12, color: colors.inkSoft, marginTop: 2 },
  deleteBtn: { borderWidth: 1, borderColor: colors.rust, paddingVertical: 13, alignItems: 'center', marginTop: 4 },
  deleteText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.rust },
  footer: {
    flexDirection: 'row',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 10,
  },
  btn: { flex: 1, borderWidth: 1, borderColor: colors.ink, paddingVertical: 14, alignItems: 'center' },
  btnDark: { backgroundColor: colors.ink },
  btnText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.ink },
  btnTextDark: { color: colors.paper },
});
