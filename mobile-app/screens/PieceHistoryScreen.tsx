import { useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors } from '../constants/colors';
import { fonts } from '../constants/fonts';
import type { Flag } from '../lib/models';
import { useFlags } from '../context/FlagsContext';
import { useInventory } from '../context/InventoryContext';
import { historyFor } from '../lib/flagHistory';
import { formatShortDate } from '../lib/format';
import { friendlyError } from '../lib/errors';
import { successBuzz } from '../lib/haptics';
import { OFFLINE_DIM, requireOnline, useConnection } from '../hooks/useConnection';
import TapeGutter from '../components/TapeGutter';
import PhotoViewer from '../components/PhotoViewer';
import EditFlagSheet from '../components/EditFlagSheet';
import { STATUS_LABELS } from '../components/FlagSheet';
import { BackChevronIcon, ImagePlaceholderIcon } from '../components/icons';

type Props = NativeStackScreenProps<RootStackParamList, 'PieceHistory'>;

export default function PieceHistoryScreen({ navigation, route }: Props) {
  const { piece, color, size } = route.params;
  const { history, clearFlag, editFlag } = useFlags();
  const { isOnline } = useConnection();
  const { pieceTypes } = useInventory();
  const [viewerUri, setViewerUri] = useState<string | null>(null);
  const [editing, setEditing] = useState<Flag | null>(null);

  const entries = historyFor(history, piece, color, size);
  const openEntry = entries.find((e) => e.clearedAt === null);

  // The type's colors; just this piece's color if the type is gone or has none.
  const typeColors = pieceTypes.find((t) => t.name === piece)?.colors ?? [];
  const colorOptions = typeColors.length > 0 ? typeColors : [color];

  const handleMarkGood = () => {
    if (!openEntry || !requireOnline(isOnline)) return;
    Alert.alert('Mark piece good', `Clear all open flags on ${color} ${piece} ${size}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Mark good',
        onPress: async () => {
          try {
            await clearFlag(openEntry.id);
            successBuzz();
          } catch (error) {
            Alert.alert("Couldn't mark piece good", friendlyError(error));
          }
        },
      },
    ]);
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
            <Text style={styles.pageTitle}>
              {color} {piece} {size}
            </Text>
            <View style={styles.headerSideButton} />
          </View>

          {openEntry && (
            <Pressable style={[styles.markGood, !isOnline && OFFLINE_DIM]} onPress={handleMarkGood}>
              <Text style={styles.markGoodText}>Mark piece good</Text>
            </Pressable>
          )}

          {entries.length === 0 ? (
            <Text style={styles.empty}>No flags on this piece yet.</Text>
          ) : (
            entries.map((entry) => {
              const isOpen = entry.clearedAt === null;
              const isRepair = entry.status === 'repair';
              return (
                <Pressable key={entry.id} style={styles.entry} onPress={() => setEditing(entry)}>
                  {entry.photoUrl ? (
                    <Pressable onPress={() => setViewerUri(entry.photoUrl ?? null)} accessibilityLabel="View photo">
                      <Image source={{ uri: entry.photoUrl }} style={styles.thumb} />
                    </Pressable>
                  ) : (
                    <View style={[styles.thumb, styles.noPhoto]}>
                      <ImagePlaceholderIcon color={colors.inkFaint} size={20} />
                      <Text style={styles.noPhotoText}>No photo</Text>
                    </View>
                  )}
                  <View style={styles.entryBody}>
                    <View style={styles.tagRow}>
                      <Text style={[styles.tag, isRepair ? styles.tagRepair : styles.tagDirty]}>
                        {STATUS_LABELS[entry.status]}
                      </Text>
                      <Text style={[styles.tag, isOpen ? styles.tagOpen : styles.tagCleared]}>
                        {isOpen ? 'Open' : 'Cleared'}
                      </Text>
                    </View>
                    {entry.comment ? <Text style={styles.comment}>{entry.comment}</Text> : null}
                    <Text style={styles.meta}>
                      {entry.memberName} · {formatShortDate(entry.createdAt)}
                    </Text>
                    {entry.clearedAt && (
                      <Text style={styles.meta}>
                        cleared by {entry.clearedByName} {formatShortDate(entry.clearedAt)}
                      </Text>
                    )}
                    {entry.staffNote ? <Text style={styles.staffNote}>Staff note: {entry.staffNote}</Text> : null}
                    {entry.source === 'import' && <Text style={styles.meta}>from spreadsheet</Text>}
                  </View>
                </Pressable>
              );
            })
          )}
        </ScrollView>
      </View>

      <EditFlagSheet
        flag={editing}
        colorOptions={colorOptions}
        onClose={() => setEditing(null)}
        onSave={editFlag}
      />
      <PhotoViewer uri={viewerUri} onClose={() => setViewerUri(null)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  flexOne: { flex: 1 },
  appBody: { flex: 1, flexDirection: 'row' },
  content: { flexGrow: 1, paddingTop: 16, paddingHorizontal: 18, paddingBottom: 28 },
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
  markGood: {
    backgroundColor: colors.ink,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 14,
  },
  markGoodText: { fontFamily: fonts.bodyMedium, fontSize: 13.5, color: colors.paper },
  empty: { fontFamily: fonts.body, fontSize: 12.5, color: colors.inkFaint },
  entry: {
    flexDirection: 'row',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    padding: 12,
    marginBottom: 8,
  },
  thumb: { width: 72, height: 72, backgroundColor: colors.paper },
  noPhoto: {
    borderWidth: 1,
    borderColor: colors.lineSoft,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  noPhotoText: { fontFamily: fonts.body, fontSize: 9.5, color: colors.inkFaint },
  entryBody: { flex: 1 },
  tagRow: { flexDirection: 'row', gap: 6, marginBottom: 4 },
  tag: {
    fontFamily: fonts.bodyMedium,
    fontSize: 10.5,
    borderWidth: 1,
    paddingVertical: 2,
    paddingHorizontal: 6,
    overflow: 'hidden',
  },
  tagRepair: { color: colors.rust, borderColor: colors.rust, backgroundColor: colors.rustTint },
  tagDirty: { color: colors.wash, borderColor: colors.wash, backgroundColor: colors.washTint },
  tagOpen: { color: colors.ink, borderColor: colors.ink },
  tagCleared: { color: colors.inkSoft, borderColor: colors.line },
  comment: { fontFamily: fonts.body, fontSize: 12.5, color: colors.ink, marginBottom: 2 },
  meta: { fontFamily: fonts.body, fontSize: 11, color: colors.inkSoft, marginTop: 1 },
  staffNote: { fontFamily: fonts.body, fontSize: 11.5, color: colors.ink, marginTop: 3, fontStyle: 'italic' },
});
