import { useEffect, useMemo, useState } from 'react';
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
  type FocusEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors } from '../constants/colors';
import { fonts } from '../constants/fonts';
import { useAuth } from '../context/AuthContext';
import { useFlags } from '../context/FlagsContext';
import { useInventory } from '../context/InventoryContext';
import type { Flag, MemberNumbers } from '../lib/models';
import { friendlyError } from '../lib/errors';
import { digitsOnly, numberFor } from '../lib/uniform';
import { unknownNumbers } from '../lib/inventory';
import { OFFLINE_DIM, requireOnline, useConnection } from '../hooks/useConnection';
import { useScrollToInput } from '../hooks/useScrollToInput';
import TapeGutter from '../components/TapeGutter';
import KeyboardDoneBar from '../components/KeyboardDoneBar';
import { BackChevronIcon } from '../components/icons';
import { successBuzz } from '../lib/haptics';

type Props = NativeStackScreenProps<RootStackParamList, 'MemberProfile'>;

const EMPTY_NUMBERS: MemberNumbers = {};

// Compares numbers ignoring key order and cleared fields (saving drops those).
const numbersKey = (numbers: MemberNumbers) =>
  JSON.stringify(Object.entries(numbers).filter(([, v]) => v.trim() !== '').sort(([a], [b]) => a.localeCompare(b)));

export default function MemberProfileScreen({ navigation, route }: Props) {
  const { id, name, section, email, phone, height, weight } = route.params;
  const { account, accounts, setAccountRole, setMemberNumbers, archiveMember } = useAuth();
  const { pieceTypes, pieces, syncedAt, error: inventoryError } = useInventory();
  const { isOnline } = useConnection();
  const [role, setRole] = useState(route.params.role ?? 'Member');
  const { flags, clearFlag } = useFlags();
  const [clearingId, setClearingId] = useState<string | null>(null);
  const memberFlags = id ? flags.filter((f) => f.memberId === id) : [];

  // Read sizes from the live account, not route params, so a save or a
  // Realtime update from another phone shows up here.
  // The draft starts from every saved key (including retired types), so saving
  // only changes the fields shown here.
  const savedSizes = accounts.find((a) => a.id === id)?.numbers ?? EMPTY_NUMBERS;
  const savedSizesKey = JSON.stringify(savedSizes);
  const [sizes, setSizes] = useState<MemberNumbers>(savedSizes);
  const [isSavingSizes, setIsSavingSizes] = useState(false);
  // Shown after a save until the sizes are edited again.
  const [justSavedSizes, setJustSavedSizes] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const sizesChanged = numbersKey(sizes) !== numbersKey(savedSizes);
  useEffect(() => {
    setSizes(JSON.parse(savedSizesKey) as MemberNumbers);
  }, [savedSizesKey]);

  // One field per non-retired numbered type, plus any number the member already holds
  // for a name with no type yet (migrated numbers stay visible and editable before the import).
  const numberFields = useMemo(() => {
    const names = pieceTypes.filter((t) => t.kind === 'numbered' && !t.retired).map((t) => t.name);
    const extra = Object.keys(savedSizes).filter((key) => !names.includes(key) && savedSizes[key] !== '');
    return [...names, ...extra];
  }, [pieceTypes, savedSizes]);
  // Saved numbers that have no matching piece in inventory, by type name.
  const missingNumbers = new Map(
    unknownNumbers(accounts, pieces)
      .filter((u) => u.memberId === id)
      .map((u) => [u.pieceType, u.number])
  );

  const [numericFocused, setNumericFocused] = useState(false);
  const { scrollRef, handleScroll, registerBottomInset, scrollToFocusedInput } = useScrollToInput();
  const focusNumericField = (event: FocusEvent) => {
    scrollToFocusedInput(event);
    setNumericFocused(true);
  };

  const initials = name
    .split(' ')
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase();

  const hasHeight = !!height && (height.feet !== '' || height.inches !== '');
  const heightDisplay = hasHeight ? `${height!.feet}' ${height!.inches}"` : 'Not provided';
  const weightDisplay = weight ? `${weight}lbs` : 'Not provided';

  const infoRows: { label: string; value: string }[] = [
    { label: 'Email', value: email || 'Not provided' },
    { label: 'Phone', value: phone || 'Not provided' },
    { label: 'Height', value: heightDisplay },
    { label: 'Weight', value: weightDisplay },
  ];

  const isRealAccount = !!id;
  // Staff can't change their own role (the database refuses it too).
  const isSelf = !!id && id === account?.id;
  const canChangeRole = isRealAccount && !isSelf;
  const isStaff = role === 'Staff';
  // Only members can be archived (the database refuses staff and yourself too).
  const canArchive = isRealAccount && !isSelf && !isStaff;

  const handleSaveSizesPress = async () => {
    if (!id || !requireOnline(isOnline)) return;
    setIsSavingSizes(true);
    try {
      await setMemberNumbers(id, sizes);
      successBuzz();
      setJustSavedSizes(true);
    } catch (error) {
      Alert.alert("Couldn't save sizes", friendlyError(error));
    } finally {
      setIsSavingSizes(false);
    }
  };

  const handleArchivePress = () => {
    if (!requireOnline(isOnline)) return;
    Alert.alert(
      `Archive ${name}?`,
      'A snapshot of their info, sizes and flags is saved under Archived members. ' +
        "They won't be able to log in, their sizes are unassigned. Their open flags stay on the pieces until staff mark them good. " +
        'You can restore them later.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          style: 'destructive',
          onPress: async () => {
            if (!id) return;
            setIsArchiving(true);
            try {
              await archiveMember(id);
              successBuzz();
              navigation.goBack();
            } catch (error) {
              Alert.alert("Couldn't archive member", friendlyError(error));
              setIsArchiving(false);
            }
          },
        },
      ]
    );
  };

  const handleRoleChangePress = () => {
    if (!requireOnline(isOnline)) return;
    const nextRole = isStaff ? 'Member' : 'Staff';
    Alert.alert(
      'Are you sure?',
      isStaff
        ? `Demote ${name} to Member? Their app will switch to the Member view.`
        : `Promote ${name} to Staff? Their app will switch to the Staff view.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isStaff ? 'Demote' : 'Promote',
          onPress: async () => {
            if (!id) return;
            try {
              await setAccountRole(id, nextRole);
              successBuzz();
              setRole(nextRole);
            } catch (error) {
              Alert.alert("Couldn't change role", friendlyError(error));
            }
          },
        },
      ]
    );
  };

  const handleMarkGoodPress = (flag: Flag) => {
    if (!requireOnline(isOnline)) return;
    Alert.alert(
      'Mark as good?',
      `${flag.piece} (${flag.color}, ${flag.size}) will no longer be flagged as ${
        flag.status === 'repair' ? 'needing repair' : 'dirty'
      }. ` +
        "This clears every open flag on that piece, including other members' flags, since it is the same physical piece.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark good',
          onPress: async () => {
            setClearingId(flag.id);
            try {
              await clearFlag(flag.id);
              successBuzz();
            } catch (error) {
              Alert.alert("Couldn't update flag", friendlyError(error));
            } finally {
              setClearingId(null);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flexOne}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
      <View style={styles.appBody}>
        <TapeGutter />
        <View style={styles.flexOne}>
        <ScrollView
          ref={scrollRef}
          style={styles.flexOne}
          contentContainerStyle={styles.content}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          // Without this, tapping Save sizes while the number pad is open only
          // closes the keyboard and the save never runs.
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Pressable style={styles.headerSideButton} onPress={() => navigation.goBack()}>
              <BackChevronIcon color={colors.ink} />
            </Pressable>
            <Text style={styles.pageTitle}>{isStaff ? 'Staff Profile' : 'Member Profile'}</Text>
            <View style={styles.headerSideButton} />
          </View>

          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>

          <Text style={styles.name}>{name}</Text>
          <Text style={styles.sectionBadge}>{section}</Text>
          <Text style={styles.roleBadge}>{role}</Text>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Information</Text>
            {infoRows.map((row) => (
              <View key={row.label} style={styles.infoRow}>
                <Text style={styles.infoLabel}>{row.label}</Text>
                <Text
                  style={[
                    styles.infoValue,
                    row.value === 'Not provided' && styles.infoValueMuted,
                  ]}
                >
                  {row.value}
                </Text>
              </View>
            ))}
          </View>

          {isRealAccount && (
            <View style={[styles.card, styles.sizesCard]}>
              <Text style={styles.cardTitle}>Uniform sizes</Text>
              {inventoryError !== null && <Text style={styles.noFlags}>{inventoryError}</Text>}
              {numberFields.length === 0 && inventoryError === null && syncedAt !== null && (
                <Text style={styles.noFlags}>No numbered pieces in inventory yet.</Text>
              )}
              <View style={styles.sizesGrid}>
                {numberFields.map((typeName) => {
                  const value = numberFor(sizes, typeName);
                  const missing = missingNumbers.get(typeName);
                  return (
                    <View key={typeName} style={styles.sizeField}>
                      <Text style={styles.sizeLabel}>{typeName}</Text>
                      <TextInput
                        style={styles.sizeInput}
                        value={value}
                        onChangeText={(text) => {
                          setSizes((prev) => ({ ...prev, [typeName]: digitsOnly(text) }));
                          setJustSavedSizes(false);
                        }}
                        onFocus={focusNumericField}
                        onBlur={() => setNumericFocused(false)}
                        placeholder="—"
                        placeholderTextColor={colors.inkFaint}
                        keyboardType="number-pad"
                        maxLength={4}
                      />
                      {missing !== undefined && missing === value && (
                        <Text style={styles.missingNumberText}>
                          No {typeName} {missing} in inventory.
                        </Text>
                      )}
                    </View>
                  );
                })}
              </View>
              {numberFields.length > 0 && (
                <Pressable
                  style={[
                    styles.saveSizesButton,
                    (!sizesChanged || isSavingSizes) && styles.saveSizesButtonDisabled,
                    sizesChanged && !isOnline && OFFLINE_DIM,
                  ]}
                  onPress={handleSaveSizesPress}
                  disabled={!sizesChanged || isSavingSizes}
                >
                  <Text style={[styles.saveSizesButtonText, !sizesChanged && styles.roleButtonTextDisabled]}>
                    {isSavingSizes ? 'Saving…' : 'Save sizes'}
                  </Text>
                </Pressable>
              )}
              {justSavedSizes && !sizesChanged && <Text style={styles.savedSizesText}>Sizes saved.</Text>}
            </View>
          )}

          {isRealAccount && (
            <View style={[styles.card, styles.flagsCard]}>
              <Text style={styles.cardTitle}>Flagged pieces</Text>
              {memberFlags.length === 0 ? (
                <Text style={styles.noFlags}>Nothing flagged. Every piece is good.</Text>
              ) : (
                memberFlags.map((flag) => {
                  const isRepair = flag.status === 'repair';
                  const statusColor = isRepair ? colors.rust : colors.wash;
                  const isClearing = clearingId === flag.id;
                  return (
                    <View key={flag.id} style={styles.flagRow}>
                      <View style={styles.flagInfo}>
                        <Text style={styles.flagPiece}>
                          {flag.piece} — {flag.color} — {flag.size}
                        </Text>
                        <Text style={[styles.flagStatus, { color: statusColor }]}>
                          {isRepair ? 'Needs repair' : 'Dirty'}
                        </Text>
                        {flag.comment !== '' && <Text style={styles.flagComment}>{flag.comment}</Text>}
                      </View>
                      <Pressable
                        style={[styles.markGoodButton, (!isOnline || isClearing) && OFFLINE_DIM]}
                        onPress={() => handleMarkGoodPress(flag)}
                        disabled={isClearing}
                      >
                        <Text style={styles.markGoodButtonText}>Mark good</Text>
                      </Pressable>
                    </View>
                  );
                })
              )}
            </View>
          )}

          <Pressable
            style={[
              styles.roleButton,
              !canChangeRole && styles.roleButtonDisabled,
              canChangeRole && !isOnline && OFFLINE_DIM,
            ]}
            onPress={canChangeRole ? handleRoleChangePress : undefined}
            disabled={!canChangeRole}
          >
            <Text
              style={[styles.roleButtonText, !canChangeRole && styles.roleButtonTextDisabled]}
            >
              {isStaff ? 'Demote to Member' : 'Promote to Staff'}
            </Text>
          </Pressable>
          {!isRealAccount && (
            <Text style={styles.roleButtonHint}>
              This member hasn't signed up yet, so there's no account to change.
            </Text>
          )}
          {isSelf && (
            <Text style={styles.roleButtonHint}>You can't change your own role.</Text>
          )}

          {canArchive && (
            <Pressable
              style={[styles.archiveButton, (!isOnline || isArchiving) && OFFLINE_DIM]}
              onPress={handleArchivePress}
              disabled={isArchiving}
            >
              <Text style={styles.archiveButtonText}>{isArchiving ? 'Archiving…' : 'Archive member'}</Text>
            </Pressable>
          )}
          {isRealAccount && !isSelf && isStaff && (
            <Text style={styles.roleButtonHint}>Demote staff to Member before archiving.</Text>
          )}
        </ScrollView>
        <View onLayout={registerBottomInset}>
          <KeyboardDoneBar visible={numericFocused} />
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
  content: {
    alignItems: 'center',
    paddingTop: 16,
    paddingHorizontal: 18,
    paddingBottom: 28,
  },
  header: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 6,
    marginBottom: 10,
  },
  headerSideButton: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  pageTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fonts.wordmark,
    fontSize: 18,
    color: colors.ink,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: { fontFamily: fonts.wordmark, fontSize: 36, color: colors.paper },
  name: { fontFamily: fonts.bodySemiBold, fontSize: 18, color: colors.ink },
  sectionBadge: {
    fontFamily: fonts.body,
    fontSize: 12.5,
    color: colors.inkSoft,
    marginTop: 4,
  },
  roleBadge: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    letterSpacing: 0.5,
    color: colors.ink,
    textTransform: 'uppercase',
    marginTop: 8,
    marginBottom: 22,
  },
  card: {
    width: '100%',
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    padding: 16,
  },
  cardTitle: {
    fontFamily: fonts.blockTitle,
    fontSize: 14,
    color: colors.ink,
    marginBottom: 10,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: colors.lineSoft,
  },
  infoLabel: { fontFamily: fonts.body, fontSize: 12.5, color: colors.inkSoft },
  infoValue: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.ink },
  infoValueMuted: { fontFamily: fonts.body, color: colors.inkFaint },
  flagsCard: { marginTop: 12 },
  noFlags: { fontFamily: fonts.body, fontSize: 12.5, color: colors.inkFaint },
  flagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.lineSoft,
  },
  flagInfo: { flex: 1 },
  flagPiece: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.ink },
  flagStatus: { fontFamily: fonts.body, fontSize: 11.5, marginTop: 2 },
  flagComment: { fontFamily: fonts.body, fontSize: 11.5, color: colors.inkSoft, marginTop: 3 },
  markGoodButton: {
    borderWidth: 1,
    borderColor: colors.ink,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  markGoodButtonText: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.ink },
  sizesCard: { marginTop: 12 },
  sizesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  sizeField: { width: '47%' },
  sizeLabel: { fontFamily: fonts.body, fontSize: 11.5, color: colors.inkSoft, marginBottom: 5 },
  sizeInput: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paper,
    paddingVertical: 8,
    paddingHorizontal: 10,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.ink,
  },
  missingNumberText: { fontFamily: fonts.body, fontSize: 11.5, color: colors.amber, marginTop: 4 },
  saveSizesButton: {
    borderWidth: 1,
    borderColor: colors.ink,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 14,
  },
  saveSizesButtonDisabled: { borderColor: colors.line },
  saveSizesButtonText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.ink },
  savedSizesText: {
    fontFamily: fonts.body,
    fontSize: 11.5,
    color: colors.inkSoft,
    textAlign: 'center',
    marginTop: 8,
  },
  archiveButton: {
    width: '100%',
    borderWidth: 1,
    borderColor: colors.rust,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  archiveButtonText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.rust },
  roleButton: {
    width: '100%',
    backgroundColor: colors.ink,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  roleButtonDisabled: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  roleButtonText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.paper },
  roleButtonTextDisabled: { color: colors.inkFaint },
  roleButtonHint: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.inkFaint,
    marginTop: 8,
    textAlign: 'center',
  },
});
