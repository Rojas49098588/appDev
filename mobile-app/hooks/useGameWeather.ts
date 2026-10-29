import { useCallback, useEffect, useState } from 'react';
import { forecastUrl, isForecastable, parseForecast, type WeatherState } from '../lib/weather';
import { useConnection } from './useConnection';

const TIMEOUT_MS = 10_000;
const FRESH_MS = 30 * 60_000;

// One request per game date, shared by every screen, kept for 30 minutes.
// Failures aren't cached, so "Try again" really retries.
const cache = new Map<string, { at: number; json: unknown }>();
const inFlight = new Map<string, Promise<{ at: number; json: unknown }>>();

// ---- Testing-only switch (development builds started from the computer) ----
// Forces each problem on purpose so the error states can be shown reliably.
// __DEV__ is false in EAS updates and store builds, so members never see it.
export type WeatherSimulation = 'off' | 'unavailable' | 'missingTemp' | 'nonsense' | 'badReply';
let simulation: WeatherSimulation = 'off';
const simulationListeners = new Set<() => void>();
export function setWeatherSimulation(next: WeatherSimulation): void {
  if (!__DEV__) return;
  simulation = next;
  simulationListeners.forEach((listener) => listener());
}
export const getWeatherSimulation = (): WeatherSimulation => simulation;

function simulatedReply(gameDate: string, kickoff: string | null): unknown {
  const hour = `${gameDate}T${kickoff ? kickoff.slice(0, 2) : '12'}:00`;
  const hourly = (temp: unknown, rain: unknown, wind: unknown) => ({
    hourly: {
      time: [hour],
      temperature_2m: [temp],
      apparent_temperature: [temp],
      precipitation_probability: [rain],
      weather_code: [61],
      wind_speed_10m: [wind],
    },
  });
  if (simulation === 'missingTemp') return hourly(null, 40, 12);
  if (simulation === 'nonsense') return hourly(999, -5, 'fast');
  return '<html>Service error</html>'; // badReply: not a forecast at all
}
// ---------------------------------------------------------------------------

async function fetchDay(gameDate: string, force: boolean): Promise<{ at: number; json: unknown }> {
  const hit = cache.get(gameDate);
  if (!force && hit && Date.now() - hit.at < FRESH_MS) return hit;
  const pending = inFlight.get(gameDate);
  if (pending) return pending;
  const request = (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(forecastUrl(gameDate), { signal: controller.signal });
      if (!response.ok) throw new Error(`weather service answered ${response.status}`);
      const entry = { at: Date.now(), json: (await response.json()) as unknown };
      cache.set(gameDate, entry);
      return entry;
    } finally {
      clearTimeout(timer);
      inFlight.delete(gameDate);
    }
  })();
  inFlight.set(gameDate, request);
  return request;
}

export type GameWeather = {
  weather: WeatherState | null;
  // When the shown forecast was fetched (ms), for "forecast from 4:15pm".
  fetchedAt: number | null;
  isOnline: boolean;
  retry: () => void;
};

// Weather at kickoff for a football game, or null when there's nothing to show
// (no date, or the game is in the past). Never throws.
export function useGameWeather(gameDate: string | null, kickoff: string | null, today: string): GameWeather {
  const { isOnline } = useConnection();
  const [weather, setWeather] = useState<WeatherState | null>(null);
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [simVersion, setSimVersion] = useState(0);

  useEffect(() => {
    const listener = () => setSimVersion((n) => n + 1);
    simulationListeners.add(listener);
    return () => {
      simulationListeners.delete(listener);
    };
  }, []);

  useEffect(() => {
    setFetchedAt(null);
    if (!gameDate || gameDate < today) {
      setWeather(null);
      return;
    }
    if (!isForecastable(gameDate, today)) {
      setWeather({ kind: 'tooFar' });
      return;
    }
    if (__DEV__ && simulation !== 'off') {
      setWeather(simulation === 'unavailable' ? { kind: 'unavailable' } : parseForecast(simulatedReply(gameDate, kickoff), gameDate, kickoff));
      return;
    }
    // Offline: show a saved forecast if there is one (labelled as saved), else say so at once.
    const saved = cache.get(gameDate);
    if (!isOnline) {
      if (saved) {
        setWeather(parseForecast(saved.json, gameDate, kickoff));
        setFetchedAt(saved.at);
      } else {
        setWeather({ kind: 'unavailable' });
      }
      return;
    }
    let cancelled = false;
    setWeather({ kind: 'loading' });
    fetchDay(gameDate, attempt > 0)
      .then((entry) => {
        if (cancelled) return;
        setWeather(parseForecast(entry.json, gameDate, kickoff));
        setFetchedAt(entry.at);
      })
      .catch((error) => {
        console.warn('useGameWeather: forecast failed', error);
        if (!cancelled) setWeather({ kind: 'unavailable' });
      });
    return () => {
      cancelled = true;
    };
  }, [gameDate, kickoff, today, attempt, isOnline, simVersion]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { weather, fetchedAt, isOnline, retry };
}
