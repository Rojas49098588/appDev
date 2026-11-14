import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, type FocusEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type {
  MainTabParamList,
  MemberProfileParams,
  RootStackParamList,
  Role,
} from '../navigation/types';
import { useTheme, useThemedStyles, type Theme } from '../hooks/useTheme';
import { fonts } from '../constants/fonts';
import { SECTIONS } from '../constants/homeData';
import { sectionForInstrument } from '../constants/instrumentSections';
import TapeGutter from '../components/TapeGutter';
import MemberRow from '../components/MemberRow';
import { BackChevronIcon, SearchIcon } from '../components/icons';
import { useFlags } from '../context/FlagsContext';
import { useAuth } from '../context/AuthContext';
import { useScrollToInput } from '../hooks/useScrollToInput';
import KeyboardDoneBar from '../components/KeyboardDoneBar';
import { useInventory } from '../context/InventoryContext';
import type { MemberNumbers } from '../lib/models';
import { digitsOnly, matchesNumber } from '../lib/uniform';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Sections'>,
  NativeStackScreenProps<RootStackParamList>
>;

type StatusKey = 'good' | 'repair' | 'dirty';

const STATUS_CHIPS: { key: StatusKey; label: string }[] = [
  { key: 'good', label: 'Good' },
  { key: 'repair', label: 'Needs repair' },
  { key: 'dirty', label: 'Dirty' },
];

type RosterMember = {
  id?: string;
  name: string;
  section: string;
  email?: string;
  phone?: string;
  height?: { feet: string; inches: string };
  weight?: string;
  role?: Role;
  numbers?: MemberNumbers;
};

export default function SectionsScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [searchText, setSearchText] = useState('');
  const [sectionFilter, setSectionFilter] = useState<string | null>(route.params?.section ?? null);
  const [statusFilters, setStatusFilters] = useState<Set<StatusKey>>(new Set());
  const { flags } = useFlags();
  const { accounts } = useAuth();
  const { pieceTypes } = useInventory();
  const numberedTypes = pieceTypes.filter((t) => t.kind === 'numbered' && !t.retired);
  // Uniform size filter: active once a piece is picked and a size typed.
  const [sizePiece, setSizePiece] = useState<string | null>(null);
  const [sizeQuery, setSizeQuery] = useState('');
  const isSizeFiltering = !!sizePiece && sizeQuery !== '';
  const [numericFocused, setNumericFocused] = useState(false);
  const { scrollRef, handleScroll, registerBottomInset, scrollToFocusedInput } = useScrollToInput();

  const filterPiece = route.params?.piece;
  const filterStatus = route.params?.status;
  const isFiltered = !!(filterPiece && filterStatus);

  useEffect(() => {
    setSearchText('');
    setStatusFilters(new Set());
    setSizePiece(null);
    setSizeQuery('');
    setSectionFilter(route.params?.section ?? null);
  }, [route.params?.section]);

  // Everyone with an account, except archived members.
  const roster = useMemo<RosterMember[]>(() => {
    return accounts
      .filter((a) => !a.archivedAt)
      .map((a) => ({
        id: a.id,
        name: `${a.firstName} ${a.lastName}`,
        section: sectionForInstrument(a.instrument),
        email: a.email,
        phone: a.phone,
        height: a.height,
        weight: a.weight,
        role: a.role,
        numbers: a.numbers,
      }));
  }, [accounts]);

  const flagsFor = (member: RosterMember) =>
    member.id ? flags.filter((f) => f.memberId === member.id) : [];

  const handleSearchChange = (text: string) => {
    setSearchText(text);
    if (text.trim() !== '') {
      setSectionFilter(null);
      setStatusFilters(new Set());
      setSizePiece(null);
      setSizeQuery('');
    }
  };

  const focusSizeInput = (event: FocusEvent) => {
    scrollToFocusedInput(event);
    setNumericFocused(true);
  };

  const toggleStatus = (key: StatusKey) => {
    setStatusFilters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const clearInventoryFilter = () => {
    navigation.setParams({ piece: undefined, status: undefined });
  };

  const handleRowPress = (member: RosterMember) => {
    const params: MemberProfileParams = {
      id: member.id,
      name: member.name,
      section: member.section,
      email: member.email,
      phone: member.phone,
      height: member.height,
      weight: member.weight,
      role: member.role,
    };
    navigation.navigate('MemberProfile', params);
  };

  const filteredMembers = useMemo(() => {
    if (isFiltered) {
      return roster.filter((member) =>
        flagsFor(member).some((f) => f.piece === filterPiece && f.status === filterStatus)
      );
    }

    const query = searchText.trim().toLowerCase();
    return roster.filter((member) => {
      const matchesSearch =
        !query ||
        member.name.toLowerCase().includes(query) ||
        member.section.toLowerCase().includes(query);
      if (!matchesSearch) return false;

      const matchesSection = !sectionFilter || member.section === sectionFilter;
      if (!matchesSection) return false;

      if (isSizeFiltering && !matchesNumber(member.numbers, sizePiece, sizeQuery)) return false;

      if (statusFilters.size === 0) return true;
      const memberFlags = flagsFor(member);
      return (
        (statusFilters.has('good') && memberFlags.length === 0) ||
        (statusFilters.has('repair') && memberFlags.some((f) => f.status === 'repair')) ||
        (statusFilters.has('dirty') && memberFlags.some((f) => f.status === 'dirty'))
      );
    });
  }, [roster, isFiltered, filterPiece, filterStatus, searchText, sectionFilter, statusFilters, isSizeFiltering, sizePiece, sizeQuery, flags]);

  const resultLabel = useMemo(() => {
    const count = filteredMembers.length;
    const noun = count === 1 ? 'member' : 'members';
    if (isFiltered) {
      const statusLabel = filterStatus === 'repair' ? 'Needs repair' : 'Dirty';
      return `${count} ${noun} — ${filterPiece} · ${statusLabel}`;
    }
    const parts: string[] = [];
    if (sectionFilter) parts.push(sectionFilter);
    if (statusFilters.size > 0) {
      parts.push(
        [...statusFilters]
          .map((key) => STATUS_CHIPS.find((chip) => chip.key === key)?.label ?? key)
          .join('/')
      );
    }
    if (isSizeFiltering) parts.push(`${sizePiece} ${sizeQuery}`);
    return parts.length > 0 ? `${count} ${noun} — ${parts.join(' · ')}` : `${count} ${noun}`;
  }, [filteredMembers.length, isFiltered, filterPiece, filterStatus, sectionFilter, statusFilters, isSizeFiltering, sizePiece, sizeQuery]);

  const bannerColor = filterStatus === 'repair' ? colors.rust : colors.wash;
  const bannerTint = filterStatus === 'repair' ? colors.rustTint : colors.washTint;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.appBody}>
        <TapeGutter />
        <View style={styles.flexOne}>
        <ScrollView
          ref={scrollRef}
          style={styles.flexOne}
          contentContainerStyle={styles.content}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          <View style={styles.header}>
            {isFiltered ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Clear filter" style={styles.headerSideButton} onPress={clearInventoryFilter}>
                <BackChevronIcon color={colors.ink} />
              </Pressable>
            ) : (
              <View style={styles.headerSideButton} />
            )}
            <Text style={styles.pageTitle} accessibilityRole="header">Members</Text>
            <View style={styles.headerSideButton} />
          </View>

          {isFiltered ? (
            <View style={[styles.banner, { borderColor: bannerColor, backgroundColor: bannerTint }]}>
              <Text style={[styles.bannerText, { color: bannerColor }]}>
                Filtered — <Text style={styles.bannerBold}>{filterPiece}</Text> ·{' '}
                <Text style={styles.bannerBold}>
                  {filterStatus === 'repair' ? 'Needs repair' : 'Dirty'}
                </Text>
              </Text>
              <Pressable accessibilityLabel="Clear filter" accessibilityRole="button" onPress={clearInventoryFilter}>
                <Text style={[styles.bannerClear, { color: bannerColor }]}>✕</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={styles.search}>
                <SearchIcon color={colors.inkFaint} />
                <TextInput accessibilityLabel="Search members"
                  style={styles.searchInput}
                  placeholder="Search members"
                  placeholderTextColor={colors.inkFaint}
                  value={searchText}
                  onChangeText={handleSearchChange}
                  onFocus={scrollToFocusedInput}
                />
              </View>

              <View style={styles.filterGroup}>
                <Text style={styles.filterGroupLabel}>Section</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chipsContent}
                >
                  <Pressable accessibilityState={{ selected: !!(!sectionFilter) }} accessibilityRole="button"
                    style={[styles.chip, !sectionFilter && styles.chipActive]}
                    onPress={() => setSectionFilter(null)}
                  >
                    <Text style={[styles.chipText, !sectionFilter && styles.chipTextActive]}>
                      All sections
                    </Text>
                  </Pressable>
                  {SECTIONS.map((section) => {
                    const active = sectionFilter === section.name;
                    return (
                      <Pressable accessibilityState={{ selected: !!(active) }} accessibilityRole="button"
                        key={section.name}
                        style={[styles.chip, active && styles.chipActive]}
                        onPress={() => setSectionFilter(section.name)}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>
                          {section.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              <View style={styles.filterGroup}>
                <Text style={styles.filterGroupLabel}>Uniform status</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chipsContent}
                >
                  <Pressable accessibilityState={{ selected: !!(statusFilters.size === 0) }} accessibilityRole="button"
                    style={[styles.chip, statusFilters.size === 0 && styles.chipActive]}
                    onPress={() => setStatusFilters(new Set())}
                  >
                    <Text
                      style={[styles.chipText, statusFilters.size === 0 && styles.chipTextActive]}
                    >
                      All members
                    </Text>
                  </Pressable>
                  {STATUS_CHIPS.map(({ key, label }) => {
                    const active = statusFilters.has(key);
                    const isRepair = key === 'repair';
                    const isDirty = key === 'dirty';
                    return (
                      <Pressable accessibilityState={{ selected: !!(active) }} accessibilityRole="button"
                        key={key}
                        style={[
                          styles.chip,
                          isRepair && styles.chipRepair,
                          isDirty && styles.chipDirty,
                          active && !isRepair && !isDirty && styles.chipActive,
                          active && isRepair && styles.chipRepairActive,
                          active && isDirty && styles.chipDirtyActive,
                        ]}
                        onPress={() => toggleStatus(key)}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            isRepair && styles.chipTextRepair,
                            isDirty && styles.chipTextDirty,
                            active && styles.chipTextActive,
                          ]}
                        >
                          {label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              <View style={styles.filterGroup}>
                <Text style={styles.filterGroupLabel}>Uniform size</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chipsContent}
                >
                  {numberedTypes.map(({ name: piece }) => {
                    const active = sizePiece === piece;
                    return (
                      <Pressable accessibilityState={{ selected: !!(active) }} accessibilityRole="button"
                        key={piece}
                        style={[styles.chip, active && styles.chipActive]}
                        onPress={() => setSizePiece(active ? null : piece)}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>{piece}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
                <View style={styles.sizeRow}>
                  <TextInput accessibilityLabel="Number"
                    style={[styles.sizeInput, !sizePiece && styles.sizeInputDisabled]}
                    placeholder={
                      sizePiece
                        ? `${sizePiece} size, e.g. 208`
                        : numberedTypes.length === 0
                          ? 'No numbered pieces in inventory yet.'
                          : 'Pick a piece, then enter a size'
                    }
                    placeholderTextColor={colors.inkFaint}
                    value={sizeQuery}
                    onChangeText={(text) => setSizeQuery(digitsOnly(text))}
                    onFocus={focusSizeInput}
                    onBlur={() => setNumericFocused(false)}
                    keyboardType="number-pad"
                    maxLength={4}
                    editable={!!sizePiece}
                  />
                  {(sizePiece || sizeQuery !== '') && (
                    <Pressable accessibilityRole="button"
                      style={styles.sizeClear}
                      onPress={() => {
                        setSizePiece(null);
                        setSizeQuery('');
                      }}
                    >
                      <Text style={styles.sizeClearText}>Clear</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            </>
          )}

          <Text style={styles.resultCount}>{resultLabel}</Text>

          {filteredMembers.map((member) => {
            const memberFlags = flagsFor(member);
            const displayFlags = isFiltered
              ? memberFlags.filter((f) => f.piece === filterPiece && f.status === filterStatus)
              : memberFlags;
            return (
              <MemberRow
                key={member.email ?? member.name}
                member={member}
                role={member.role}
                flags={displayFlags}
                onPress={() => handleRowPress(member)}
              />
            );
          })}
        </ScrollView>
        <View onLayout={registerBottomInset}>
          <KeyboardDoneBar visible={numericFocused} />
        </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: t.colors.paper,
  },
  flexOne: {
    flex: 1,
  },
  appBody: {
    flex: 1,
    flexDirection: 'row',
  },
  content: {
    paddingTop: 16,
    paddingHorizontal: 18,
    paddingBottom: 28,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
  },
  headerSideButton: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fonts.wordmark,
    fontSize: t.font(18),
    color: t.colors.ink,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: t.colors.line,
    backgroundColor: t.colors.surface,
    paddingVertical: 9,
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: t.font(13),
    color: t.colors.ink,
    padding: 0,
  },
  filterGroup: {
    marginBottom: 10,
  },
  sizeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 7,
  },
  sizeInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: t.colors.line,
    backgroundColor: t.colors.surface,
    paddingVertical: 7,
    paddingHorizontal: 10,
    fontFamily: fonts.body,
    fontSize: t.font(13),
    color: t.colors.ink,
  },
  sizeInputDisabled: {
    opacity: 0.6,
  },
  sizeClear: {
    paddingVertical: 7,
    paddingHorizontal: 6,
  },
  sizeClearText: {
    fontFamily: fonts.bodyMedium,
    fontSize: t.font(12),
    color: t.colors.inkSoft,
  },
  filterGroupLabel: {
    fontFamily: fonts.body,
    fontSize: t.font(10.5),
    color: t.colors.inkFaint,
    marginBottom: 6,
  },
  chipsContent: {
    flexDirection: 'row',
    gap: 7,
  },
  chip: {
    borderWidth: 1,
    borderColor: t.colors.line,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  chipActive: {
    backgroundColor: t.colors.ink,
    borderColor: t.colors.ink,
  },
  chipRepair: {
    borderColor: t.colors.rust,
  },
  chipRepairActive: {
    backgroundColor: t.colors.rust,
    borderColor: t.colors.rust,
  },
  chipDirty: {
    borderColor: t.colors.wash,
  },
  chipDirtyActive: {
    backgroundColor: t.colors.wash,
    borderColor: t.colors.wash,
  },
  chipText: {
    fontFamily: fonts.body,
    fontSize: t.font(12),
    color: t.colors.inkSoft,
  },
  chipTextRepair: {
    color: t.colors.rust,
  },
  chipTextDirty: {
    color: t.colors.wash,
  },
  chipTextActive: {
    color: t.colors.paper,
  },
  resultCount: {
    fontFamily: fonts.body,
    fontSize: t.font(11.5),
    color: t.colors.inkSoft,
    marginTop: 4,
    marginBottom: 12,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
  },
  bannerText: {
    fontFamily: fonts.body,
    fontSize: t.font(12.5),
    flex: 1,
  },
  bannerBold: {
    fontFamily: fonts.bodySemiBold,
  },
  bannerClear: {
    fontSize: t.font(14),
    marginLeft: 12,
  },
});
}
