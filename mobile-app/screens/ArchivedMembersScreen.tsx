import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors } from '../constants/colors';
import { fonts } from '../constants/fonts';
import { sectionForInstrument } from '../constants/instrumentSections';
import type { MemberArchive } from '../lib/models';
import type { MemberArchiveRow } from '../lib/rows';
import { rowToArchive } from '../lib/mappers';
import { friendlyError } from '../lib/errors';
import { formatShortDate } from '../lib/format';
import { supabase } from '../lib/supabase';
import { useConnection } from '../hooks/useConnection';
import TapeGutter from '../components/TapeGutter';
import { BackChevronIcon, SmallChevronRightIcon } from '../components/icons';

type Props = NativeStackScreenProps<RootStackParamList, 'ArchivedMembers'>;

// Snapshots are only read here, so they're fetched each time the screen is
// shown rather than cached and kept live like the contexts' data.
export default function ArchivedMembersScreen({ navigation }: Props) {
  const { isOnline } = useConnection();
  const [archives, setArchives] = useState<MemberArchive[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      if (!isOnline) return;
      (async () => {
        const { data, error: loadError } = await supabase
          .from('member_archives')
          .select('*')
          .order('archived_at', { ascending: false });
        if (!isActive) return;
        if (loadError) {
          setError(friendlyError(loadError));
          return;
        }
        setError(null);
        setArchives((data as MemberArchiveRow[]).map(rowToArchive));
      })();
      return () => {
        isActive = false;
      };
    }, [isOnline])
  );

  const renderBody = () => {
    if (!isOnline && archives === null) {
      return <Text style={styles.message}>Connect to view archived members.</Text>;
    }
    if (error) return <Text style={styles.message}>{error}</Text>;
    if (archives === null) return <ActivityIndicator color={colors.ink} style={styles.spinner} />;
    if (archives.length === 0) {
      return <Text style={styles.message}>No one has been archived yet.</Text>;
    }
    return archives.map((archive) => (
      <Pressable
        key={archive.id}
        style={styles.row}
        onPress={() => navigation.navigate('ArchivedMember', { archiveId: archive.id })}
      >
        <View style={styles.rowInfo}>
          <Text style={styles.rowName}>
            {archive.firstName} {archive.lastName}
          </Text>
          <Text style={styles.rowSub}>{sectionForInstrument(archive.instrument)}</Text>
          <Text style={styles.rowMeta}>
            Archived {formatShortDate(archive.archivedAt)}
            {archive.archivedByName ? ` by ${archive.archivedByName}` : ''}
          </Text>
          {archive.restoredAt && (
            <Text style={styles.rowRestored}>Restored {formatShortDate(archive.restoredAt)}</Text>
          )}
        </View>
        <SmallChevronRightIcon color={colors.inkFaint} size={14} strokeWidth={1.8} />
      </Pressable>
    ));
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.appBody}>
        <TapeGutter />
        <ScrollView style={styles.flexOne} contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <Pressable style={styles.headerSideButton} onPress={() => navigation.goBack()}>
              <BackChevronIcon color={colors.ink} />
            </Pressable>
            <Text style={styles.pageTitle}>Archived members</Text>
            <View style={styles.headerSideButton} />
          </View>
          {renderBody()}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  flexOne: { flex: 1 },
  appBody: { flex: 1, flexDirection: 'row' },
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
  message: { fontFamily: fonts.body, fontSize: 13, color: colors.inkSoft, textAlign: 'center', marginTop: 24 },
  spinner: { marginTop: 24 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    padding: 14,
    marginBottom: 8,
  },
  rowInfo: { flex: 1 },
  rowName: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.ink },
  rowSub: { fontFamily: fonts.body, fontSize: 12, color: colors.inkSoft, marginTop: 2 },
  rowMeta: { fontFamily: fonts.body, fontSize: 11.5, color: colors.inkFaint, marginTop: 4 },
  rowRestored: { fontFamily: fonts.bodyMedium, fontSize: 11.5, color: colors.ink, marginTop: 2 },
});
