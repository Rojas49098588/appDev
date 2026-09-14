import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MemberTabParamList, RootStackParamList } from '../../navigation/types';
import { colors } from '../../constants/colors';
import { fonts } from '../../constants/fonts';
import { MY_UNIFORM, MY_MEMBER_NAME } from '../../constants/myUniformData';
import { useFlags } from '../../context/FlagsContext';
import TapeGutter from '../../components/TapeGutter';
import { SmallChevronRightIcon } from '../../components/icons';

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
          <Text style={styles.subtitle}>Tap a piece to flag it as dirty or needing repair.</Text>

          {MY_UNIFORM.map((slot) => {
            const flag = flags.find(
              (f) => f.memberName === MY_MEMBER_NAME && f.piece === slot.piece
            );
            const statusColor = flag
              ? flag.status === 'repair'
                ? colors.rust
                : colors.wash
              : colors.inkSoft;
            const statusLabel = flag ? (flag.status === 'repair' ? 'Repair' : 'Dirty') : 'Good';

            return (
              <View key={slot.piece} style={styles.itemGroup}>
                <Pressable
                  style={styles.row}
                  onPress={() =>
                    navigation.navigate('FlagItem', {
                      piece: slot.piece,
                      color: slot.color,
                      size: slot.size,
                    })
                  }
                >
                  <View>
                    <Text style={styles.pieceName}>{slot.piece}</Text>
                    <Text style={styles.pieceSub}>
                      {slot.color} · {slot.size}
                    </Text>
                  </View>
                  <View style={styles.rowRight}>
                    <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
                    <SmallChevronRightIcon color={colors.inkFaint} size={14} strokeWidth={1.8} />
                  </View>
                </Pressable>
                {flag && flag.comment !== '' && (
                  <View style={styles.commentBanner}>
                    <Text style={styles.commentText}>You flagged this — {flag.comment}</Text>
                    <Pressable
                      onPress={() =>
                        navigation.navigate('FlagItem', {
                          piece: slot.piece,
                          color: slot.color,
                          size: slot.size,
                        })
                      }
                    >
                      <Text style={styles.editLink}>Edit</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  flexOne: { flex: 1 },
  appBody: { flex: 1, flexDirection: 'row' },
  content: { padding: 18, paddingBottom: 28 },
  title: { fontFamily: fonts.wordmark, fontSize: 24, color: colors.ink, marginBottom: 8 },
  subtitle: { fontFamily: fonts.body, fontSize: 12.5, color: colors.inkSoft, marginBottom: 20 },
  itemGroup: { marginBottom: 12 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    padding: 14,
  },
  pieceName: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.ink },
  pieceSub: { fontFamily: fonts.body, fontSize: 12, color: colors.inkSoft, marginTop: 2 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusText: { fontFamily: fonts.bodyMedium, fontSize: 13 },
  commentBanner: {
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: colors.line,
    backgroundColor: colors.washTint,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  commentText: { flex: 1, fontFamily: fonts.body, fontSize: 12, color: colors.wash },
  editLink: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.wash,
    textDecorationLine: 'underline',
  },
});
