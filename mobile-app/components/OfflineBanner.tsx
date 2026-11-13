import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useThemedStyles, type Theme } from '../hooks/useTheme';
import { fonts } from '../constants/fonts';
import { useConnection } from '../hooks/useConnection';
import { useFlags } from '../context/FlagsContext';
import { useCombos } from '../context/CombosContext';
import { useGames } from '../context/GamesContext';
import { formatTime } from '../lib/format';

export default function OfflineBanner() {
  const styles = useThemedStyles(makeStyles);
  const { isOnline } = useConnection();
  const flags = useFlags();
  const combos = useCombos();
  const game = useGames();

  if (!isOnline) {
    const syncTimes = [flags.syncedAt, combos.syncedAt, game.syncedAt].filter((t): t is number => t !== null);
    const oldest = syncTimes.length > 0 ? Math.min(...syncTimes) : null;
    return (
      <View style={styles.banner}>
        <Text style={styles.text}>
          {oldest ? `Offline — showing data from ${formatTime(oldest)}` : 'Offline — no saved data yet'}
        </Text>
      </View>
    );
  }

  if (flags.error || combos.error || game.error) {
    const retry = () => {
      void flags.reload();
      void combos.reload();
      void game.reload();
    };
    return (
      <View style={[styles.banner, styles.errorBanner]}>
        <Text style={styles.text}>Can't reach server</Text>
        <Pressable onPress={retry} hitSlop={8}>
          <Text style={[styles.text, styles.retry]}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return null;
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
  banner: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 6,
    paddingHorizontal: 16,
    backgroundColor: t.colors.washTint,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: t.colors.line,
  },
  errorBanner: {
    backgroundColor: t.colors.rustTint,
  },
  text: {
    fontFamily: fonts.bodyMedium,
    fontSize: t.font(12),
    color: t.colors.ink,
  },
  retry: {
    textDecorationLine: 'underline',
  },
});
}
