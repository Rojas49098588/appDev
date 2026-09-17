import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MemberTabParamList, RootStackParamList } from '../../navigation/types';
import { colors } from '../../constants/colors';
import { fonts } from '../../constants/fonts';
import { MY_UNIFORM, MY_MEMBER_NAME, MY_WHITE_SHIRT, type UniformGroup } from '../../constants/myUniformData';
import { useFlags } from '../../context/FlagsContext';
import type { Flag } from '../../constants/flagsData';
import TapeGutter from '../../components/TapeGutter';
import { ChevronDownIcon, SmallChevronRightIcon } from '../../components/icons';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MemberTabParamList, 'Inventory'>,
  NativeStackScreenProps<RootStackParamList>
>;

export default function MyInventoryScreen({ navigation }: Props) {
  const { flags } = useFlags();

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.appBody}>
        <TapeGutter />
        <ScrollView style={styles.flexOne} contentContainerStyle={styles.content}>
          <Text style={styles.title}>My inventory</Text>
          <Text style={styles.subtitle}>Tap a piece type to see all your sizes. Tap any item to flag it.</Text>

          {MY_UNIFORM.map((group) => (
            <PieceGroup key={group.piece} group={group} flags={flags} navigation={navigation} />
          ))}

          <WhiteShirtRow flags={flags} navigation={navigation} />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

function PieceGroup({
  group,
  flags,
  navigation,
}: {
  group: UniformGroup;
  flags: Flag[];
  navigation: Props['navigation'];
}) {
  const [isOpen, setIsOpen] = useState(false);

  const groupFlags = flags.filter(
    (f) => f.memberName === MY_MEMBER_NAME && f.piece === group.piece
  );
  const repairCount = groupFlags.filter((f) => f.status === 'repair').length;
  const dirtyCount = groupFlags.filter((f) => f.status === 'dirty').length;

  return (
    <View style={styles.groupCard}>
      <Pressable style={styles.groupRow} onPress={() => setIsOpen((prev) => !prev)}>
        <View>
          <Text style={styles.pieceName}>{group.piece}</Text>
          <Text style={styles.pieceSub}>{group.variants.length} pieces</Text>
        </View>
        <View style={styles.groupRight}>
          {(repairCount > 0 || dirtyCount > 0) && (
            <View style={styles.statusTags}>
              {repairCount > 0 && (
                <View style={styles.flagBtnRepair}>
                  <Text style={styles.flagBtnTextRepair}>Repair · {repairCount}</Text>
                </View>
              )}
              {dirtyCount > 0 && (
                <View style={styles.flagBtnDirty}>
                  <Text style={styles.flagBtnTextDirty}>Dirty · {dirtyCount}</Text>
                </View>
              )}
            </View>
          )}
          <ChevronDownIcon color={colors.inkFaint} open={isOpen} />
        </View>
      </Pressable>

      {isOpen && (
        <View style={styles.breakdown}>
          {group.variants.map((variant, index) => {
            const flag = groupFlags.find((f) => f.color === variant.color);
            const isLast = index === group.variants.length - 1;
            const statusColor = flag
              ? flag.status === 'repair'
                ? colors.rust
                : colors.wash
              : colors.inkSoft;
            const statusLabel = flag ? (flag.status === 'repair' ? 'Repair' : 'Dirty') : 'Good';

            return (
              <View key={variant.color}>
                <Pressable
                  style={[styles.variantRow, isLast && !flag && styles.variantRowLast]}
                  onPress={() =>
                    navigation.navigate('FlagItem', {
                      piece: group.piece,
                      color: variant.color,
                      size: group.size,
                    })
                  }
                >
                  <View>
                    <Text style={styles.variantName}>{variant.color}</Text>
                    <Text style={styles.variantSub}>{group.size}</Text>
                  </View>
                  <View style={styles.rowRight}>
                    <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
                    <SmallChevronRightIcon color={colors.inkFaint} size={14} strokeWidth={1.8} />
                  </View>
                </Pressable>
                {flag && (
                  <View
                    style={[
                      styles.commentBanner,
                      { backgroundColor: flag.status === 'repair' ? colors.rustTint : colors.washTint },
                      isLast && styles.commentBannerLast,
                    ]}
                  >
                    <Text style={[styles.commentText, { color: statusColor }]}>
                      {flag.comment !== '' ? `You flagged this — ${flag.comment}` : 'You flagged this.'}
                    </Text>
                    <Pressable
                      onPress={() =>
                        navigation.navigate('FlagItem', {
                          piece: group.piece,
                          color: variant.color,
                          size: group.size,
                        })
                      }
                    >
                      <Text style={[styles.editLink, { color: statusColor }]}>Edit</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

function WhiteShirtRow({ flags, navigation }: { flags: Flag[]; navigation: Props['navigation'] }) {
  const flag = flags.find(
    (f) => f.memberName === MY_MEMBER_NAME && f.piece === MY_WHITE_SHIRT.piece
  );
  const statusColor = flag ? colors.wash : colors.inkSoft;
  const statusLabel = flag ? 'Dirty' : 'Good';

  const goToFlag = () =>
    navigation.navigate('FlagItem', {
      piece: MY_WHITE_SHIRT.piece,
      color: MY_WHITE_SHIRT.color,
      size: MY_WHITE_SHIRT.size,
    });

  return (
    <View style={styles.groupCard}>
      <Pressable style={[styles.variantRow, !flag && styles.variantRowLast]} onPress={goToFlag}>
        <View>
          <Text style={styles.pieceName}>{MY_WHITE_SHIRT.piece}</Text>
          <Text style={styles.pieceSub}>{MY_WHITE_SHIRT.color} · {MY_WHITE_SHIRT.size}</Text>
        </View>
        <View style={styles.rowRight}>
          <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
          <SmallChevronRightIcon color={colors.inkFaint} size={14} strokeWidth={1.8} />
        </View>
      </Pressable>
      {flag ? (
        <View style={[styles.commentBanner, styles.commentBannerLast, { backgroundColor: colors.washTint }]}>
          <Text style={[styles.commentText, { color: statusColor }]}>
            {flag.comment !== '' ? `You flagged this — ${flag.comment}` : 'You flagged this.'}
          </Text>
          <Pressable onPress={goToFlag}>
            <Text style={[styles.editLink, { color: statusColor }]}>Edit</Text>
          </Pressable>
        </View>
      ) : (
        <Text style={styles.whiteShirtHint}>
          Only flag your white shirt as dirty if you've left it in the bin for washing.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  flexOne: { flex: 1 },
  appBody: { flex: 1, flexDirection: 'row' },
  content: { padding: 18, paddingBottom: 28 },
  title: { fontFamily: fonts.wordmark, fontSize: 24, color: colors.ink, marginBottom: 8 },
  subtitle: { fontFamily: fonts.body, fontSize: 12.5, color: colors.inkSoft, marginBottom: 20 },
  groupCard: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    marginBottom: 12,
  },
  groupRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
  },
  pieceName: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.ink },
  pieceSub: { fontFamily: fonts.body, fontSize: 12, color: colors.inkSoft, marginTop: 2 },
  groupRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusTags: { flexDirection: 'row', gap: 6 },
  flagBtnRepair: {
    borderWidth: 1,
    borderColor: colors.rust,
    backgroundColor: colors.rustTint,
    paddingVertical: 3,
    paddingHorizontal: 7,
  },
  flagBtnTextRepair: { fontFamily: fonts.body, fontSize: 10.5, color: colors.rust },
  flagBtnDirty: {
    borderWidth: 1,
    borderColor: colors.wash,
    backgroundColor: colors.washTint,
    paddingVertical: 3,
    paddingHorizontal: 7,
  },
  flagBtnTextDirty: { fontFamily: fonts.body, fontSize: 10.5, color: colors.wash },
  breakdown: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  variantRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.lineSoft,
  },
  variantRowLast: { borderBottomWidth: 0 },
  variantName: { fontFamily: fonts.bodyMedium, fontSize: 13.5, color: colors.ink },
  variantSub: { fontFamily: fonts.body, fontSize: 11.5, color: colors.inkSoft, marginTop: 2 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusText: { fontFamily: fonts.bodyMedium, fontSize: 13 },
  commentBanner: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.lineSoft,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  commentBannerLast: { borderBottomWidth: 0 },
  whiteShirtHint: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.inkFaint,
    padding: 14,
    paddingTop: 0,
  },
  commentText: { flex: 1, fontFamily: fonts.body, fontSize: 12 },
  editLink: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    textDecorationLine: 'underline',
  },
});
