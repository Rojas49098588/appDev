import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { colors } from '../../constants/colors';
import { fonts } from '../../constants/fonts';
import { useFlags } from '../../context/FlagsContext';
import type { FlagStatus } from '../../constants/flagsData';
import { MY_MEMBER_NAME } from '../../constants/myUniformData';

type Props = NativeStackScreenProps<RootStackParamList, 'FlagItem'>;

const DIRTY_ONLY_PIECES = ['White shirt'];

export default function FlagItemScreen({ navigation, route }: Props) {
  const { piece, color, size } = route.params;
  const { flags, addFlag, updateFlag } = useFlags();
  const existingFlag = flags.find(
    (f) => f.memberName === MY_MEMBER_NAME && f.piece === piece && f.color === color
  );
  const dirtyOnly = DIRTY_ONLY_PIECES.includes(piece);

  const [status, setStatus] = useState<FlagStatus>(existingFlag?.status ?? 'dirty');
  const [comment, setComment] = useState(existingFlag?.comment ?? '');

  const handleSubmit = () => {
    if (existingFlag) {
      updateFlag(existingFlag.id, status, comment);
    } else {
      addFlag({
        id: `${MY_MEMBER_NAME}-${piece}-${color}`,
        memberName: MY_MEMBER_NAME,
        piece,
        color,
        size,
        status,
        comment,
      });
    }
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flexOne}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <Pressable style={styles.headerSideButton} onPress={() => navigation.goBack()}>
              <Text style={styles.closeIcon}>✕</Text>
            </Pressable>
            <Text style={styles.pageTitle}>Flag item</Text>
            <View style={styles.headerSideButton} />
          </View>

          <View style={styles.pieceCard}>
            <Text style={styles.pieceName}>{piece}</Text>
            <Text style={styles.pieceSub}>
              {color} · {size}
            </Text>
          </View>

          {dirtyOnly ? (
            <Text style={styles.dirtyOnlyNote}>
              Only flag your white shirt as dirty if you've left it in the bin for washing.
            </Text>
          ) : (
            <>
              <Text style={styles.fieldLabel}>What's wrong with it?</Text>
              <View style={styles.segmented}>
                {(['dirty', 'repair'] as FlagStatus[]).map((option, index) => {
                  const active = status === option;
                  return (
                    <Pressable
                      key={option}
                      style={[
                        styles.segment,
                        active && styles.segmentActive,
                        index === 0 && styles.segmentBorderRight,
                      ]}
                      onPress={() => setStatus(option)}
                    >
                      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                        {option === 'dirty' ? 'Dirty' : 'Needs repair'}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}

          <Text style={styles.fieldLabel}>Comment</Text>
          <TextInput
            style={styles.commentInput}
            placeholder="Describe what's wrong — a staff member will see this."
            placeholderTextColor={colors.inkFaint}
            value={comment}
            onChangeText={setComment}
            multiline
          />
          <Text style={styles.hint}>A staff member will see this.</Text>
        </View>

        <View style={styles.footer}>
          <Pressable style={styles.submitButton} onPress={handleSubmit}>
            <Text style={styles.submitButtonText}>Submit flag</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  flexOne: { flex: 1 },
  content: { flex: 1, paddingTop: 16, paddingHorizontal: 18 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
  },
  headerSideButton: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  closeIcon: { fontSize: 18, color: colors.ink },
  pageTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fonts.wordmark,
    fontSize: 18,
    color: colors.ink,
  },
  pieceCard: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    padding: 14,
    marginBottom: 20,
  },
  pieceName: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.ink },
  pieceSub: { fontFamily: fonts.body, fontSize: 12, color: colors.inkSoft, marginTop: 2 },
  fieldLabel: { fontFamily: fonts.body, fontSize: 11.5, color: colors.inkSoft, marginBottom: 7 },
  dirtyOnlyNote: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.wash,
    backgroundColor: colors.washTint,
    padding: 12,
    marginBottom: 20,
  },
  segmented: { flexDirection: 'row', borderWidth: 1, borderColor: colors.ink, marginBottom: 20 },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    backgroundColor: colors.surface,
  },
  segmentBorderRight: { borderRightWidth: 1, borderRightColor: colors.ink },
  segmentActive: { backgroundColor: colors.wash },
  segmentText: { fontFamily: fonts.bodyMedium, fontSize: 13.5, color: colors.ink },
  segmentTextActive: { color: colors.paper },
  commentInput: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    padding: 13,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.ink,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 8,
  },
  hint: { fontFamily: fonts.body, fontSize: 11, color: colors.inkFaint },
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.surface,
    padding: 18,
  },
  submitButton: { backgroundColor: colors.wash, paddingVertical: 14, alignItems: 'center' },
  submitButtonText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.paper },
});
