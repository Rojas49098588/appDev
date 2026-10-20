import { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MemberTabParamList, RootStackParamList } from '../../navigation/types';
import { colors } from '../../constants/colors';
import { fonts } from '../../constants/fonts';
import { MY_WHITE_SHIRT, UNASSIGNED_SIZE, uniformFor } from '../../constants/myUniformData';
import { useFlags } from '../../context/FlagsContext';
import type { Flag, FlagStatus } from '../../constants/flagsData';
import { useAuth } from '../../context/AuthContext';
import { friendlyError } from '../../lib/errors';
import { requireOnline, useConnection } from '../../hooks/useConnection';
import TapeGutter from '../../components/TapeGutter';
import Swatch from '../../components/Swatch';
import FlagSheet, { STATUS_LABELS, type FlagTarget } from '../../components/FlagSheet';
import { CheckIcon, FlagIcon } from '../../components/icons';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MemberTabParamList, 'Inventory'>,
  NativeStackScreenProps<RootStackParamList>
>;

type Group = { label: string; rows: FlagTarget[] };

type Toast = { message: string; undo?: () => Promise<void> };

// Singular names for the sheet title ("Flag Blue coat").
const ITEM_NAMES: Record<string, string> = {
  Coats: 'coat',
  Vests: 'vest',
  Bibbers: 'bibber',
  Pants: 'pants',
  [MY_WHITE_SHIRT.piece]: 'shirt',
};

const rowKey = (row: Pick<FlagTarget, 'piece' | 'color'>) => `${row.piece}-${row.color}`;

export default function MyInventoryScreen(_props: Props) {
  const { flags, addFlag, updateFlag } = useFlags();
  const { account } = useAuth();
  const { isOnline } = useConnection();
  // The database only sends a member their own flags; filtering by id keeps
  // this correct if a staff account ever opens the member view.
  const myFlags = flags.filter((f) => f.memberId === account?.id);
  const findFlag = (piece: string, color: string) =>
    myFlags.find((f) => f.piece === piece && f.color === color);

  const groups: Group[] = [
    ...uniformFor(account?.uniformSizes).map((group) => ({
      label: group.piece,
      rows: group.variants.map((variant) => ({
        piece: group.piece,
        color: variant.color,
        size: group.size,
        itemName: ITEM_NAMES[group.piece] ?? group.piece.toLowerCase(),
        dirtyOnly: false,
        flag: findFlag(group.piece, variant.color),
      })),
    })),
    {
      label: MY_WHITE_SHIRT.piece,
      rows: [
        {
          piece: MY_WHITE_SHIRT.piece,
          color: MY_WHITE_SHIRT.color,
          size: MY_WHITE_SHIRT.size,
          itemName: ITEM_NAMES[MY_WHITE_SHIRT.piece],
          dirtyOnly: true,
          flag: findFlag(MY_WHITE_SHIRT.piece, MY_WHITE_SHIRT.color),
        },
      ],
    },
  ];
  const totalCount = groups.reduce((sum, group) => sum + group.rows.length, 0);
  const flaggedCount = groups.reduce((sum, group) => sum + group.rows.filter((row) => row.flag).length, 0);

  const [filter, setFilter] = useState<'all' | 'flagged'>('all');
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [openKey, setOpenKey] = useState(0);
  const [highlight, setHighlight] = useState<{ key: string; n: number } | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);

  // Read live so the sheet sees a flag that arrives over Realtime while it's open.
  const activeRow = groups.flatMap((group) => group.rows).find((row) => rowKey(row) === activeKey) ?? null;

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  const openSheet = (row: FlagTarget) => {
    setOpenKey((n) => n + 1);
    setActiveKey(rowKey(row));
  };

  const submitFlag = async (status: FlagStatus, comment: string) => {
    if (!activeRow || !requireOnline(isOnline)) return;
    const row = activeRow;
    const previous = row.flag;
    try {
      if (previous) {
        await updateFlag(previous.id, status, comment);
      } else {
        await addFlag({ piece: row.piece, color: row.color, size: row.size || UNASSIGNED_SIZE, status, comment });
      }
    } catch (error) {
      Alert.alert("Couldn't save flag", friendlyError(error));
      return;
    }
    setActiveKey(null);
    setHighlight((current) => ({ key: rowKey(row), n: (current?.n ?? 0) + 1 }));
    setToast({
      message: `${row.color} ${row.itemName} flagged as ${STATUS_LABELS[status]}`,
      // Only staff can delete a flag, so a brand-new flag can't be undone
      // from the member side; an edit can be put back the way it was.
      undo: previous ? () => updateFlag(previous.id, previous.status, previous.comment) : undefined,
    });
  };

  const undo = async () => {
    if (!toast?.undo || !requireOnline(isOnline)) return;
    const restore = toast.undo;
    setToast(null);
    setHighlight(null);
    try {
      await restore();
    } catch (error) {
      Alert.alert("Couldn't undo", friendlyError(error));
    }
  };

  const visibleGroups = groups
    .map((group) => ({ ...group, rows: filter === 'all' ? group.rows : group.rows.filter((row) => row.flag) }))
    .filter((group) => group.rows.length > 0);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.appBody}>
        <TapeGutter />
        <View style={styles.flexOne}>
          <ScrollView style={styles.flexOne} contentContainerStyle={styles.content}>
            <Text style={styles.title}>My inventory</Text>
            <Text style={styles.subtitle}>Tap Flag on any piece to report it.</Text>

            <View style={styles.filters} accessibilityRole="radiogroup">
              <FilterPill label={`All · ${totalCount}`} active={filter === 'all'} onPress={() => setFilter('all')} />
              <FilterPill
                label={`Flagged · ${flaggedCount}`}
                active={filter === 'flagged'}
                onPress={() => setFilter('flagged')}
              />
            </View>

            {visibleGroups.length === 0 && (
              <Text style={styles.empty}>Nothing flagged. Everything you have is marked good.</Text>
            )}

            {visibleGroups.map((group) => (
              <View key={group.label} style={styles.group}>
                <Text style={styles.groupLabel}>
                  {group.label.toUpperCase()}
                  <Text style={styles.groupDot}> · </Text>
                  {group.rows.length}
                </Text>
                <View style={styles.rows}>
                  {group.rows.map((row) => (
                    <InventoryRow
                      key={rowKey(row)}
                      row={row}
                      highlightN={highlight?.key === rowKey(row) ? highlight.n : 0}
                      onFlag={() => openSheet(row)}
                    />
                  ))}
                </View>
              </View>
            ))}
          </ScrollView>

          {toast && (
            <View style={styles.toast} accessibilityLiveRegion="polite">
              <View style={styles.toastCheck}>
                <CheckIcon color={colors.white} />
              </View>
              <Text style={styles.toastText}>{toast.message}</Text>
              {toast.undo && (
                <Pressable style={styles.toastUndo} onPress={undo}>
                  <Text style={styles.toastUndoText}>Undo</Text>
                </Pressable>
              )}
            </View>
          )}
        </View>
      </View>

      <FlagSheet target={activeRow} openKey={openKey} onClose={() => setActiveKey(null)} onSubmit={submitFlag} />
    </SafeAreaView>
  );
}

function FilterPill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      style={[styles.pill, active ? styles.pillActive : styles.pillIdle]}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.pillText, { color: active ? colors.white : colors.inkSoft }]}>{label}</Text>
    </Pressable>
  );
}

function InventoryRow({ row, highlightN, onFlag }: { row: FlagTarget; highlightN: number; onFlag: () => void }) {
  const glow = useRef(new Animated.Value(0)).current;

  // Flash the row amber after a flag is saved, then fade back.
  useEffect(() => {
    if (highlightN === 0) {
      glow.setValue(0);
      return;
    }
    glow.setValue(1);
    const fade = Animated.timing(glow, { toValue: 0, delay: 1000, duration: 1000, useNativeDriver: false });
    fade.start();
    return () => fade.stop();
  }, [highlightN, glow]);

  const flag = row.flag;
  const statusColor = !flag ? colors.good : flag.status === 'repair' ? colors.rust : colors.amber;

  return (
    <Animated.View
      style={[
        styles.row,
        {
          backgroundColor: glow.interpolate({ inputRange: [0, 1], outputRange: [colors.white, colors.amberTint] }),
          borderColor: glow.interpolate({ inputRange: [0, 1], outputRange: [colors.lineSoft, colors.amber] }),
        },
      ]}
    >
      <Swatch color={row.color} />
      <View style={styles.flexOne}>
        <Text style={styles.rowLabel}>{row.color}</Text>
        <Text style={[styles.rowStatus, { color: statusColor }]}>
          {flag ? `Flagged · ${STATUS_LABELS[flag.status]}` : 'Good'}
        </Text>
      </View>
      <Pressable
        style={[styles.flagButton, flag ? styles.flagButtonEdit : styles.flagButtonIdle]}
        onPress={onFlag}
        accessibilityLabel={`${flag ? 'Edit flag for' : 'Flag'} ${row.color} ${row.piece.toLowerCase()}`}
      >
        <FlagIcon color={colors.wash} />
        <Text style={styles.flagButtonText}>{flag ? 'Edit' : 'Flag'}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  flexOne: { flex: 1 },
  appBody: { flex: 1, flexDirection: 'row' },
  content: { paddingHorizontal: 18, paddingTop: 22, paddingBottom: 96 },
  title: { fontFamily: fonts.wordmark, fontSize: 28, color: colors.ink },
  subtitle: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.inkSoft, marginTop: 6 },
  filters: { flexDirection: 'row', gap: 8, marginTop: 22 },
  pill: { minHeight: 44, borderRadius: 22, paddingHorizontal: 20, justifyContent: 'center' },
  pillActive: { backgroundColor: colors.wash },
  pillIdle: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.lineSoft },
  pillText: { fontFamily: fonts.bodySemiBold, fontSize: 14 },
  empty: { fontFamily: fonts.body, fontSize: 14, color: colors.inkSoft, marginTop: 28 },
  group: { marginTop: 28 },
  groupLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    letterSpacing: 1.8,
    color: colors.inkSoft,
    paddingHorizontal: 4,
    marginBottom: 10,
  },
  groupDot: { color: colors.inkFaint },
  rows: { gap: 8 },
  row: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  rowLabel: { fontFamily: fonts.bodySemiBold, fontSize: 16, color: colors.ink },
  rowStatus: { fontFamily: fonts.bodySemiBold, fontSize: 13, marginTop: 2 },
  flagButton: {
    minHeight: 44,
    minWidth: 76,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 16,
  },
  flagButtonIdle: { backgroundColor: colors.white, borderColor: colors.line },
  flagButtonEdit: { backgroundColor: colors.washTint, borderColor: colors.wash },
  flagButtonText: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.wash },
  toast: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 14,
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 12,
    backgroundColor: colors.toast,
    paddingHorizontal: 16,
    paddingVertical: 12,
    elevation: 6,
    shadowColor: '#151D21',
    shadowOpacity: 0.25,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 10 },
  },
  toastCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.good,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toastText: { flex: 1, fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.white },
  toastUndo: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  toastUndoText: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.mint },
});
