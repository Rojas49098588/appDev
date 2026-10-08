import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors } from '../constants/colors';
import { fonts } from '../constants/fonts';
import { sectionForInstrument } from '../constants/instrumentSections';
import { NO_SIZE } from '../constants/myUniformData';
import type { MemberArchive } from '../lib/models';
import type { MemberArchiveRow } from '../lib/rows';
import { rowToArchive } from '../lib/mappers';
import { friendlyError } from '../lib/errors';
import { formatShortDate } from '../lib/format';
import { UNIFORM_PIECES } from '../lib/uniform';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { OFFLINE_DIM, requireOnline, useConnection } from '../hooks/useConnection';
import TapeGutter from '../components/TapeGutter';
import { BackChevronIcon } from '../components/icons';

type Props = NativeStackScreenProps<RootStackParamList, 'ArchivedMember'>;

const NOT_PROVIDED = 'Not provided';

// Read-only view of one snapshot, as it was when the member was archived.
export default function ArchivedMemberScreen({ navigation, route }: Props) {
  const { archiveId } = route.params;
  const { restoreMember } = useAuth();
  const { isOnline } = useConnection();
  const [archive, setArchive] = useState<MemberArchive | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  useEffect(() => {
    let isActive = true;
    (async () => {
      const { data, error: loadError } = await supabase
        .from('member_archives')
        .select('*')
        .eq('id', archiveId)
        .single();
      if (!isActive) return;
      if (loadError) {
        setError(friendlyError(loadError));
        return;
      }
      setArchive(rowToArchive(data as MemberArchiveRow));
    })();
    return () => {
      isActive = false;
    };
  }, [archiveId]);

  const name = archive ? `${archive.firstName} ${archive.lastName}` : '';

  // restore_member stamps only the latest snapshot, and a member can't be
  // archived again until restored, so an unstamped snapshot means they're
  // still archived from this one.
  const canRestore = !!archive && archive.restoredAt === null;

  const handleRestorePress = () => {
    if (!archive || !requireOnline(isOnline)) return;
    Alert.alert(
      `Restore ${name}?`,
      'They can log in again with their old email and password. Their sizes stay unassigned until you set them.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          onPress: async () => {
            setIsRestoring(true);
            try {
              await restoreMember(archive.memberId);
              navigation.goBack();
            } catch (restoreError) {
              Alert.alert("Couldn't restore member", friendlyError(restoreError));
              setIsRestoring(false);
            }
          },
        },
      ]
    );
  };

  const renderSnapshot = (a: MemberArchive) => {
    const hasHeight = a.height.feet !== '' || a.height.inches !== '';
    const infoRows = [
      { label: 'Email', value: a.email || NOT_PROVIDED },
      { label: 'Instrument', value: a.instrument || NOT_PROVIDED },
      { label: 'Phone', value: a.phone || NOT_PROVIDED },
      { label: 'Shoe size', value: a.shoeSize.size ? `${a.shoeSize.gender} · ${a.shoeSize.size}` : NOT_PROVIDED },
      { label: 'Height', value: hasHeight ? `${a.height.feet}' ${a.height.inches}"` : NOT_PROVIDED },
      { label: 'Weight', value: a.weight ? `${a.weight}lbs` : NOT_PROVIDED },
    ];

    return (
      <>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.sectionBadge}>{sectionForInstrument(a.instrument)}</Text>
        <Text style={styles.meta}>
          Archived {formatShortDate(a.archivedAt)}
          {a.archivedByName ? ` by ${a.archivedByName}` : ''}
        </Text>
        {a.restoredAt && (
          <Text style={styles.meta}>
            Restored {formatShortDate(a.restoredAt)}
            {a.restoredByName ? ` by ${a.restoredByName}` : ''}
          </Text>
        )}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Information</Text>
          {infoRows.map((row) => (
            <View key={row.label} style={styles.infoRow}>
              <Text style={styles.infoLabel}>{row.label}</Text>
              <Text style={[styles.infoValue, row.value === NOT_PROVIDED && styles.infoValueMuted]}>
                {row.value}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Uniform sizes at archive</Text>
          {UNIFORM_PIECES.map(({ piece, key }) => (
            <View key={key} style={styles.infoRow}>
              <Text style={styles.infoLabel}>{piece}</Text>
              <Text style={[styles.infoValue, !a.uniformSizes[key] && styles.infoValueMuted]}>
                {a.uniformSizes[key] || NO_SIZE}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Open flags at archive</Text>
          {a.flags.length === 0 ? (
            <Text style={styles.infoValueMuted}>Nothing was flagged.</Text>
          ) : (
            a.flags.map((flag) => {
              const isRepair = flag.status === 'repair';
              return (
                <View key={`${flag.piece}-${flag.color}`} style={styles.flagRow}>
                  <Text style={styles.infoValue}>
                    {flag.piece} — {flag.color} — {flag.size}
                  </Text>
                  <Text style={[styles.flagStatus, { color: isRepair ? colors.rust : colors.wash }]}>
                    {isRepair ? 'Needs repair' : 'Dirty'}
                  </Text>
                  {flag.comment !== '' && <Text style={styles.flagComment}>{flag.comment}</Text>}
                </View>
              );
            })
          )}
        </View>

        {canRestore && (
          <Pressable
            style={[styles.restoreButton, (!isOnline || isRestoring) && OFFLINE_DIM]}
            onPress={handleRestorePress}
            disabled={isRestoring}
          >
            <Text style={styles.restoreButtonText}>{isRestoring ? 'Restoring…' : 'Restore member'}</Text>
          </Pressable>
        )}
      </>
    );
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
            <Text style={styles.pageTitle}>Archived Member</Text>
            <View style={styles.headerSideButton} />
          </View>
          {error ? (
            <Text style={styles.message}>{error}</Text>
          ) : archive ? (
            renderSnapshot(archive)
          ) : (
            <ActivityIndicator color={colors.ink} style={styles.spinner} />
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
  content: { paddingTop: 16, paddingHorizontal: 18, paddingBottom: 28 },
  header: {
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
  message: { fontFamily: fonts.body, fontSize: 13, color: colors.inkSoft, textAlign: 'center', marginTop: 24 },
  spinner: { marginTop: 24 },
  name: { fontFamily: fonts.bodySemiBold, fontSize: 18, color: colors.ink, textAlign: 'center' },
  sectionBadge: { fontFamily: fonts.body, fontSize: 12.5, color: colors.inkSoft, marginTop: 4, textAlign: 'center' },
  meta: { fontFamily: fonts.body, fontSize: 11.5, color: colors.inkFaint, marginTop: 6, textAlign: 'center' },
  card: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    padding: 16,
    marginTop: 14,
  },
  cardTitle: { fontFamily: fonts.blockTitle, fontSize: 14, color: colors.ink, marginBottom: 10 },
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
  infoValueMuted: { fontFamily: fonts.body, fontSize: 12.5, color: colors.inkFaint },
  flagRow: { paddingVertical: 9, borderTopWidth: 1, borderTopColor: colors.lineSoft },
  flagStatus: { fontFamily: fonts.body, fontSize: 11.5, marginTop: 2 },
  flagComment: { fontFamily: fonts.body, fontSize: 11.5, color: colors.inkSoft, marginTop: 3 },
  restoreButton: {
    backgroundColor: colors.ink,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  restoreButtonText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.paper },
});
