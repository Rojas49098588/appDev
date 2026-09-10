import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../constants/colors';
import { fonts } from '../constants/fonts';
import type { Member } from '../constants/membersData';
import { SmallChevronRightIcon } from './icons';

export default function MemberRow({ member, onPress }: { member: Member; onPress: () => void }) {
  const initials = member.name
    .split(' ')
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase();

  const itemColor = member.item?.status === 'repair' ? colors.rust : colors.wash;

  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initials}</Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.name}>{member.name}</Text>
        <Text style={styles.section}>{member.section}</Text>
        {member.item && (
          <View style={styles.itemRow}>
            <View style={[styles.dot, { backgroundColor: itemColor }]} />
            <Text style={[styles.itemText, { color: itemColor }]}>
              {member.item.piece} — {member.item.color} — {member.item.size}
            </Text>
          </View>
        )}
      </View>
      <SmallChevronRightIcon color={colors.inkFaint} size={14} strokeWidth={1.8} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    padding: 13,
    marginBottom: 8,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: fonts.wordmark,
    fontSize: 13,
    color: colors.paper,
  },
  info: {
    flex: 1,
  },
  name: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13.5,
    color: colors.ink,
  },
  section: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.inkSoft,
    marginTop: 1,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 6,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 1,
    transform: [{ rotate: '45deg' }],
  },
  itemText: {
    fontFamily: fonts.body,
    fontSize: 11,
  },
});
