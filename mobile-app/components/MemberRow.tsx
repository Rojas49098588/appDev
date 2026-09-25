import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../constants/colors';
import { fonts } from '../constants/fonts';
import type { Member } from '../constants/membersData';
import type { Flag } from '../constants/flagsData';
import type { Role } from '../navigation/types';
import { SmallChevronRightIcon } from './icons';

export default function MemberRow({
  member,
  role,
  flags = [],
  onPress,
}: {
  member: Member;
  role?: Role;
  flags?: Flag[];
  onPress: () => void;
}) {
  const initials = member.name
    .split(' ')
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase();

  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initials}</Text>
      </View>
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={styles.name}>{member.name}</Text>
          {role === 'Staff' && (
            <View style={styles.staffBadge}>
              <Text style={styles.staffBadgeText}>Staff</Text>
            </View>
          )}
        </View>
        <Text style={styles.section}>{member.section}</Text>
        {flags.map((flag) => {
          const itemColor = flag.status === 'repair' ? colors.rust : colors.wash;
          return (
            <View key={flag.id} style={styles.itemRow}>
              <View style={[styles.dot, { backgroundColor: itemColor }]} />
              <Text style={[styles.itemText, { color: itemColor }]}>
                {flag.piece} — {flag.color} — {flag.size}
              </Text>
            </View>
          );
        })}
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
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  name: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13.5,
    color: colors.ink,
  },
  staffBadge: {
    borderWidth: 1,
    borderColor: colors.ink,
    backgroundColor: colors.ink,
    paddingVertical: 1,
    paddingHorizontal: 6,
  },
  staffBadgeText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 9,
    letterSpacing: 0.4,
    color: colors.paper,
    textTransform: 'uppercase',
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
