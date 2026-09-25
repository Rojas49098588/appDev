import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
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
import { colors } from '../constants/colors';
import { fonts } from '../constants/fonts';
import { MEMBERS } from '../constants/membersData';
import { SECTIONS } from '../constants/homeData';
import { sectionForInstrument } from '../constants/instrumentSections';
import TapeGutter from '../components/TapeGutter';
import MemberRow from '../components/MemberRow';
import { BackChevronIcon, SearchIcon } from '../components/icons';
import { useFlags } from '../context/FlagsContext';
import { useAuth } from '../context/AuthContext';
import { useScrollToInput } from '../hooks/useScrollToInput';

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
  name: string;
  section: string;
  email?: string;
  phone?: string;
  height?: { feet: string; inches: string };
  weight?: string;
  role?: Role;
};

export default function SectionsScreen({ navigation, route }: Props) {
  const [searchText, setSearchText] = useState('');
  const [sectionFilter, setSectionFilter] = useState<string | null>(route.params?.section ?? null);
  const [statusFilters, setStatusFilters] = useState<Set<StatusKey>>(new Set());
  const { flags } = useFlags();
  const { accounts } = useAuth();
  const { scrollRef, handleScroll, scrollToFocusedInput } = useScrollToInput();

  const filterPiece = route.params?.piece;
  const filterStatus = route.params?.status;
  const isFiltered = !!(filterPiece && filterStatus);

  useEffect(() => {
    setSearchText('');
    setStatusFilters(new Set());
    setSectionFilter(route.params?.section ?? null);
  }, [route.params?.section]);

  const roster = useMemo<RosterMember[]>(() => {
    const matchedEmails = new Set<string>();
    const fromRoster = MEMBERS.map((member) => {
      const match = accounts.find(
        (a) => `${a.firstName} ${a.lastName}`.trim().toLowerCase() === member.name.toLowerCase()
      );
      if (match) matchedEmails.add(match.email.toLowerCase());
      return {
        name: member.name,
        section: member.section,
        email: match?.email,
        phone: match?.phone,
        height: match?.height,
        weight: match?.weight,
        role: match?.role,
      };
    });

    const newSignUps = accounts
      .filter((a) => !matchedEmails.has(a.email.toLowerCase()))
      .map((a) => ({
        name: `${a.firstName} ${a.lastName}`,
        section: sectionForInstrument(a.instrument),
        email: a.email,
        phone: a.phone,
        height: a.height,
        weight: a.weight,
        role: a.role,
      }));

    return [...fromRoster, ...newSignUps];
  }, [accounts]);

  const handleSearchChange = (text: string) => {
    setSearchText(text);
    if (text.trim() !== '') {
      setSectionFilter(null);
      setStatusFilters(new Set());
    }
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
        flags.some(
          (f) => f.memberName === member.name && f.piece === filterPiece && f.status === filterStatus
        )
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

      if (statusFilters.size === 0) return true;
      const memberFlags = flags.filter((f) => f.memberName === member.name);
      return (
        (statusFilters.has('good') && memberFlags.length === 0) ||
        (statusFilters.has('repair') && memberFlags.some((f) => f.status === 'repair')) ||
        (statusFilters.has('dirty') && memberFlags.some((f) => f.status === 'dirty'))
      );
    });
  }, [roster, isFiltered, filterPiece, filterStatus, searchText, sectionFilter, statusFilters, flags]);

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
    return parts.length > 0 ? `${count} ${noun} — ${parts.join(' · ')}` : `${count} ${noun}`;
  }, [filteredMembers.length, isFiltered, filterPiece, filterStatus, sectionFilter, statusFilters]);

  const bannerColor = filterStatus === 'repair' ? colors.rust : colors.wash;
  const bannerTint = filterStatus === 'repair' ? colors.rustTint : colors.washTint;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.appBody}>
        <TapeGutter />

        <ScrollView
          ref={scrollRef}
          style={styles.flexOne}
          contentContainerStyle={styles.content}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          <View style={styles.header}>
            {isFiltered ? (
              <Pressable style={styles.headerSideButton} onPress={clearInventoryFilter}>
                <BackChevronIcon color={colors.ink} />
              </Pressable>
            ) : (
              <View style={styles.headerSideButton} />
            )}
            <Text style={styles.pageTitle}>Members</Text>
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
              <Pressable onPress={clearInventoryFilter}>
                <Text style={[styles.bannerClear, { color: bannerColor }]}>✕</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={styles.search}>
                <SearchIcon color={colors.inkFaint} />
                <TextInput
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
                  <Pressable
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
                      <Pressable
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
                  <Pressable
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
                      <Pressable
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
            </>
          )}

          <Text style={styles.resultCount}>{resultLabel}</Text>

          {filteredMembers.map((member) => {
            const memberFlags = flags.filter((f) => f.memberName === member.name);
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
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.paper,
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
    fontSize: 18,
    color: colors.ink,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingVertical: 9,
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.ink,
    padding: 0,
  },
  filterGroup: {
    marginBottom: 10,
  },
  filterGroupLabel: {
    fontFamily: fonts.body,
    fontSize: 10.5,
    color: colors.inkFaint,
    marginBottom: 6,
  },
  chipsContent: {
    flexDirection: 'row',
    gap: 7,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  chipActive: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  chipRepair: {
    borderColor: colors.rust,
  },
  chipRepairActive: {
    backgroundColor: colors.rust,
    borderColor: colors.rust,
  },
  chipDirty: {
    borderColor: colors.wash,
  },
  chipDirtyActive: {
    backgroundColor: colors.wash,
    borderColor: colors.wash,
  },
  chipText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.inkSoft,
  },
  chipTextRepair: {
    color: colors.rust,
  },
  chipTextDirty: {
    color: colors.wash,
  },
  chipTextActive: {
    color: colors.paper,
  },
  resultCount: {
    fontFamily: fonts.body,
    fontSize: 11.5,
    color: colors.inkSoft,
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
    fontSize: 12.5,
    flex: 1,
  },
  bannerBold: {
    fontFamily: fonts.bodySemiBold,
  },
  bannerClear: {
    fontSize: 14,
    marginLeft: 12,
  },
});
