import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors } from '../constants/colors';
import { fonts } from '../constants/fonts';
import { useAuth } from '../context/AuthContext';
import TapeGutter from '../components/TapeGutter';
import { BackChevronIcon } from '../components/icons';

type Props = NativeStackScreenProps<RootStackParamList, 'MemberProfile'>;

export default function MemberProfileScreen({ navigation, route }: Props) {
  const { name, section, email, phone, height, weight } = route.params;
  const { setAccountRole } = useAuth();
  const [role, setRole] = useState(route.params.role ?? 'Member');

  const initials = name
    .split(' ')
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase();

  const hasHeight = !!height && (height.feet !== '' || height.inches !== '');
  const heightDisplay = hasHeight ? `${height!.feet}' ${height!.inches}"` : 'Not provided';
  const weightDisplay = weight ? `${weight}lbs` : 'Not provided';

  const infoRows: { label: string; value: string }[] = [
    { label: 'Email', value: email || 'Not provided' },
    { label: 'Phone', value: phone || 'Not provided' },
    { label: 'Height', value: heightDisplay },
    { label: 'Weight', value: weightDisplay },
  ];

  const isRealAccount = !!email;
  const isStaff = role === 'Staff';

  const handleRoleChangePress = () => {
    const nextRole = isStaff ? 'Member' : 'Staff';
    Alert.alert(
      'Are you sure?',
      isStaff
        ? `Demote ${name} to Member? They'll see the Member view next time they sign in.`
        : `Promote ${name} to Staff? They'll see the Staff view next time they sign in.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isStaff ? 'Demote' : 'Promote',
          onPress: async () => {
            if (!email) return;
            await setAccountRole(email, nextRole);
            setRole(nextRole);
          },
        },
      ]
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
            <Text style={styles.pageTitle}>{isStaff ? 'Staff Profile' : 'Member Profile'}</Text>
            <View style={styles.headerSideButton} />
          </View>

          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>

          <Text style={styles.name}>{name}</Text>
          <Text style={styles.sectionBadge}>{section}</Text>
          <Text style={styles.roleBadge}>{role}</Text>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Information</Text>
            {infoRows.map((row) => (
              <View key={row.label} style={styles.infoRow}>
                <Text style={styles.infoLabel}>{row.label}</Text>
                <Text
                  style={[
                    styles.infoValue,
                    row.value === 'Not provided' && styles.infoValueMuted,
                  ]}
                >
                  {row.value}
                </Text>
              </View>
            ))}
          </View>

          <Pressable
            style={[styles.roleButton, !isRealAccount && styles.roleButtonDisabled]}
            onPress={isRealAccount ? handleRoleChangePress : undefined}
            disabled={!isRealAccount}
          >
            <Text
              style={[styles.roleButtonText, !isRealAccount && styles.roleButtonTextDisabled]}
            >
              {isStaff ? 'Demote to Member' : 'Promote to Staff'}
            </Text>
          </Pressable>
          {!isRealAccount && (
            <Text style={styles.roleButtonHint}>
              This member hasn't signed up yet, so there's no account to change.
            </Text>
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
  content: {
    alignItems: 'center',
    paddingTop: 16,
    paddingHorizontal: 18,
    paddingBottom: 28,
  },
  header: {
    width: '100%',
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
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: { fontFamily: fonts.wordmark, fontSize: 36, color: colors.paper },
  name: { fontFamily: fonts.bodySemiBold, fontSize: 18, color: colors.ink },
  sectionBadge: {
    fontFamily: fonts.body,
    fontSize: 12.5,
    color: colors.inkSoft,
    marginTop: 4,
  },
  roleBadge: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    letterSpacing: 0.5,
    color: colors.ink,
    textTransform: 'uppercase',
    marginTop: 8,
    marginBottom: 22,
  },
  card: {
    width: '100%',
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    padding: 16,
  },
  cardTitle: {
    fontFamily: fonts.blockTitle,
    fontSize: 14,
    color: colors.ink,
    marginBottom: 10,
  },
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
  infoValueMuted: { fontFamily: fonts.body, color: colors.inkFaint },
  roleButton: {
    width: '100%',
    backgroundColor: colors.ink,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  roleButtonDisabled: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  roleButtonText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.paper },
  roleButtonTextDisabled: { color: colors.inkFaint },
  roleButtonHint: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.inkFaint,
    marginTop: 8,
    textAlign: 'center',
  },
});
