import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../constants/colors';
import { fonts } from '../constants/fonts';
import { useConnection } from '../hooks/useConnection';
import { useFlags } from '../context/FlagsContext';
import { useCombos } from '../context/CombosContext';
import { useGame } from '../context/GameContext';
import { formatTime } from '../lib/format';

export default function OfflineBanner() {
  const { isOnline } = useConnection();
  const flags = useFlags();
  const combos = useCombos();
  const game = useGame();

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

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 6,
    paddingHorizontal: 16,
    backgroundColor: colors.washTint,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  errorBanner: {
    backgroundColor: colors.rustTint,
  },
  text: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.ink,
  },
  retry: {
    textDecorationLine: 'underline',
  },
});
