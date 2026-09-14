import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { colors } from '../../constants/colors';
import { fonts } from '../../constants/fonts';
import TapeGutter from '../../components/TapeGutter';
import { BackChevronIcon } from '../../components/icons';

type Props = NativeStackScreenProps<RootStackParamList, 'MemberAccount'>;

export default function MemberAccountScreen({ navigation, route }: Props) {
  const { firstName, lastName, instrument, role } = route.params;
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();

  const handleLogOut = () => {
    navigation.reset({ index: 0, routes: [{ name: 'SignUp' }] });
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.appBody}>
        <TapeGutter />
        <View style={styles.content}>
          <View style={styles.header}>
            <Pressable style={styles.headerSideButton} onPress={() => navigation.goBack()}>
              <BackChevronIcon color={colors.ink} />
            </Pressable>
            <Text style={styles.pageTitle}>Account</Text>
            <View style={styles.headerSideButton} />
          </View>

          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>

          <Text style={styles.roleBadge}>{role}</Text>

          <View style={styles.fieldWrapper}>
            <Text style={styles.label}>First Name</Text>
            <Text style={styles.value}>{firstName}</Text>
          </View>
          <View style={styles.fieldWrapper}>
            <Text style={styles.label}>Last Name</Text>
            <Text style={styles.value}>{lastName}</Text>
          </View>
          <View style={styles.fieldWrapper}>
            <Text style={styles.label}>Instrument</Text>
            <Text style={styles.value}>{instrument}</Text>
          </View>

          <Pressable style={styles.logOutButton} onPress={handleLogOut}>
            <Text style={styles.logOutButtonText}>Log Out</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  appBody: { flex: 1, flexDirection: 'row' },
  content: {
    flex: 1,
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
    marginBottom: 4,
  },
  avatarText: { fontFamily: fonts.wordmark, fontSize: 36, color: colors.paper },
  roleBadge: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    letterSpacing: 0.5,
    color: colors.ink,
    textTransform: 'uppercase',
    marginBottom: 20,
  },
  fieldWrapper: { width: '100%' },
  label: {
    fontFamily: fonts.body,
    fontSize: 11.5,
    color: colors.inkSoft,
    marginTop: 12,
    marginBottom: 6,
  },
  value: { fontFamily: fonts.body, fontSize: 14, color: colors.ink },
  logOutButton: {
    width: '100%',
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  logOutButtonText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.ink },
});
