import type { ReactNode } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../constants/colors';
import { fonts } from '../constants/fonts';
import {
  getWeatherSimulation, setWeatherSimulation, useGameWeather, type WeatherSimulation,
} from '../hooks/useGameWeather';
import { formatTime } from '../lib/format';
import { FORD_STADIUM, forecastChip, forecastDetails } from '../lib/weather';

type Props = { gameDate: string | null; kickoff: string | null; today: string };

const SIMULATION_LABELS: Record<WeatherSimulation, string> = {
  off: 'Real forecast',
  unavailable: 'Service unavailable',
  missingTemp: 'Temperature missing',
  nonsense: 'Nonsense values (999°)',
  badReply: 'Reply that isn\'t a forecast',
};

// Testing only: press and hold the card to force a problem.
function openSimulationMenu() {
  if (!__DEV__) return;
  Alert.alert('Weather testing', 'Force a problem to see how the card handles it. Development builds only.', [
    ...(Object.keys(SIMULATION_LABELS) as WeatherSimulation[]).map((key) => ({
      text: `${getWeatherSimulation() === key ? '✓ ' : ''}${SIMULATION_LABELS[key]}`,
      onPress: () => setWeatherSimulation(key),
    })),
    { text: 'Cancel', style: 'cancel' as const },
  ]);
}

// Member Game day: weather at kickoff, with a message for every way it can go wrong.
export function WeatherCard({ gameDate, kickoff, today }: Props) {
  const { weather, fetchedAt, isOnline, retry } = useGameWeather(gameDate, kickoff, today);
  if (!weather) return null;

  const simulating = __DEV__ && getWeatherSimulation() !== 'off';
  const wrap = (style: object[], children: ReactNode) => (
    <Pressable style={style} onLongPress={__DEV__ ? openSimulationMenu : undefined} delayLongPress={600}>
      {children}
      {simulating ? (
        <Text style={styles.simNote}>Testing: {SIMULATION_LABELS[getWeatherSimulation()]}</Text>
      ) : null}
    </Pressable>
  );

  const header = (
    <View style={styles.headRow}>
      <Text style={styles.label}>Weather at kickoff</Text>
      {weather.kind === 'ok' || weather.kind === 'incomplete' ? (
        <Text style={styles.label}>{FORD_STADIUM.name}</Text>
      ) : null}
    </View>
  );

  if (weather.kind === 'loading') {
    return wrap(
      [styles.card],
      <>
        {header}
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={colors.inkSoft} />
          <Text style={styles.sub}>Checking the forecast…</Text>
        </View>
      </>
    );
  }

  if (weather.kind === 'tooFar') {
    return wrap(
      [styles.card],
      <>
        {header}
        <Text style={styles.message}>Forecast available closer to game day</Text>
        <Text style={styles.sub}>Forecasts reach about 2 weeks ahead.</Text>
      </>
    );
  }

  if (weather.kind === 'unavailable') {
    return wrap(
      [styles.card, styles.cardError],
      <View accessibilityRole="alert">
        {header}
        <Text style={styles.messageStrong}>Weather unavailable right now</Text>
        <Text style={styles.sub}>
          {isOnline
            ? "Couldn't reach the forecast service. Everything else on this page is up to date."
            : "You're offline. The forecast will load when you're back online."}
        </Text>
        <Pressable style={styles.retry} onPress={retry} accessibilityRole="button">
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  const f = weather.forecast;
  const incomplete = weather.kind === 'incomplete';
  const details = forecastDetails(f);
  const stamp = fetchedAt === null ? null : formatTime(fetchedAt).replace(' ', '').toLowerCase();
  return wrap(
    [styles.card, incomplete ? styles.cardWarn : {}],
    <>
      {header}
      <View style={styles.row}>
        <Text style={[styles.icon, incomplete && styles.faint]}>{incomplete ? '🌡️' : f.icon}</Text>
        <Text style={[styles.temp, incomplete && styles.faint]}>
          {f.tempF === null ? '--°' : `${Math.round(f.tempF)}°`}
        </Text>
        <View style={styles.flexOne}>
          <Text style={styles.desc}>{incomplete ? 'Temperature not available' : f.description}</Text>
          {details ? <Text style={styles.sub}>{details}</Text> : null}
        </View>
      </View>
      {stamp ? (
        <Text style={[styles.stamp, !isOnline && styles.stampOffline]}>
          {isOnline ? `Updated ${stamp}` : `Offline · forecast from ${stamp}`}
        </Text>
      ) : null}
    </>
  );
}

// Staff Games list: a small chip, shown only when there's a forecast to show.
export function WeatherChip({ gameDate, kickoff, today }: Props) {
  const { weather } = useGameWeather(gameDate, kickoff, today);
  if (!weather || (weather.kind !== 'ok' && weather.kind !== 'incomplete')) return null;
  return (
    <View style={styles.chip}>
      <Text style={styles.chipText}>{forecastChip(weather.forecast)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    padding: 12,
    marginBottom: 10,
  },
  cardError: { borderColor: colors.rust, backgroundColor: colors.rustTint },
  cardWarn: { borderColor: colors.amber, backgroundColor: colors.amberTint },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  label: { fontFamily: fonts.body, fontSize: 10.5, color: colors.inkSoft, textTransform: 'uppercase', letterSpacing: 0.4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  icon: { fontSize: 26 },
  temp: { fontFamily: fonts.blockTitle, fontSize: 24, color: colors.ink },
  faint: { color: colors.inkFaint },
  flexOne: { flex: 1 },
  desc: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.ink },
  sub: { fontFamily: fonts.body, fontSize: 11.5, color: colors.inkSoft, marginTop: 2 },
  message: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.ink, marginTop: 2 },
  messageStrong: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.ink, marginTop: 2 },
  retry: { alignSelf: 'flex-start', backgroundColor: colors.ink, paddingVertical: 7, paddingHorizontal: 12, marginTop: 10 },
  retryText: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: colors.white },
  stamp: { fontFamily: fonts.body, fontSize: 10.5, color: colors.inkFaint, marginTop: 8 },
  stampOffline: { fontFamily: fonts.bodySemiBold, color: colors.amber },
  simNote: { fontFamily: fonts.mono, fontSize: 10, color: colors.wash, marginTop: 8 },
  chip: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    paddingVertical: 2,
    paddingHorizontal: 7,
    marginTop: 6,
  },
  chipText: { fontFamily: fonts.body, fontSize: 11, color: colors.ink },
});
