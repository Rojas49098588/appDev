import { useCallback, useEffect, useState } from 'react';
import { forecastUrl, isForecastable, parseForecast, type WeatherState } from '../lib/weather';

const TIMEOUT_MS = 10_000;
const FRESH_MS = 30 * 60_000;

// One request per game date, shared by every screen, kept for 30 minutes.
// Failures aren't cached, so "Try again" really retries.
const cache = new Map<string, { at: number; json: unknown }>();
const inFlight = new Map<string, Promise<unknown>>();

async function fetchDay(gameDate: string, force: boolean): Promise<unknown> {
  const hit = cache.get(gameDate);
  if (!force && hit && Date.now() - hit.at < FRESH_MS) return hit.json;
  const pending = inFlight.get(gameDate);
  if (pending) return pending;
  const request = (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(forecastUrl(gameDate), { signal: controller.signal });
      if (!response.ok) throw new Error(`weather service answered ${response.status}`);
      const json: unknown = await response.json();
      cache.set(gameDate, { at: Date.now(), json });
      return json;
    } finally {
      clearTimeout(timer);
      inFlight.delete(gameDate);
    }
  })();
  inFlight.set(gameDate, request);
  return request;
}

// Weather at kickoff for a football game, or null when there's nothing to show
// (no date, or the game is in the past). Never throws.
export function useGameWeather(
  gameDate: string | null,
  kickoff: string | null,
  today: string,
): { weather: WeatherState | null; retry: () => void } {
  const [weather, setWeather] = useState<WeatherState | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!gameDate || gameDate < today) {
      setWeather(null);
      return;
    }
    if (!isForecastable(gameDate, today)) {
      setWeather({ kind: 'tooFar' });
      return;
    }
    let cancelled = false;
    setWeather({ kind: 'loading' });
    fetchDay(gameDate, attempt > 0)
      .then((json) => {
        if (!cancelled) setWeather(parseForecast(json, gameDate, kickoff));
      })
      .catch((error) => {
        console.warn('useGameWeather: forecast failed', error);
        if (!cancelled) setWeather({ kind: 'unavailable' });
      });
    return () => {
      cancelled = true;
    };
  }, [gameDate, kickoff, today, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { weather, retry };
}
