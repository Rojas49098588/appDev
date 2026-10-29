// Game-day weather from Open-Meteo (free, no API key). Pure: no React Native
// imports, so it runs under Node tests. The fetch itself lives in
// hooks/useGameWeather.ts.

export const FORD_STADIUM = { name: 'Ford Stadium', latitude: 32.8371, longitude: -96.7829 };

// Open-Meteo forecasts reach 16 days ahead (today + 15). Later dates are refused.
export const FORECAST_DAYS_AHEAD = 15;

export type Forecast = {
  // null when the response had no usable temperature.
  tempF: number | null;
  feelsLikeF: number | null;
  rainChance: number | null;
  windMph: number | null;
  description: string;
  icon: string;
};

export type WeatherState =
  | { kind: 'loading' }
  | { kind: 'ok'; forecast: Forecast }
  | { kind: 'incomplete'; forecast: Forecast } // reached the service, but no usable temperature
  | { kind: 'tooFar' }
  | { kind: 'unavailable' }; // no connection, service error, timeout or unreadable reply

// Whole days from today to the game, both 'YYYY-MM-DD'.
export function daysUntil(gameDate: string, today: string): number {
  const ms = Date.parse(`${gameDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

export function isForecastable(gameDate: string, today: string): boolean {
  const days = daysUntil(gameDate, today);
  return days >= 0 && days <= FORECAST_DAYS_AHEAD;
}

export function forecastUrl(gameDate: string): string {
  const params = new URLSearchParams({
    latitude: String(FORD_STADIUM.latitude),
    longitude: String(FORD_STADIUM.longitude),
    hourly: 'temperature_2m,apparent_temperature,precipitation_probability,weather_code,wind_speed_10m',
    temperature_unit: 'fahrenheit',
    wind_speed_unit: 'mph',
    timezone: 'America/Chicago',
    start_date: gameDate,
    end_date: gameDate,
  });
  return `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
}

// WMO weather codes, grouped the way people talk about weather.
export function describeCode(code: number | null): { description: string; icon: string } {
  if (code === null) return { description: 'Conditions unknown', icon: '🌡️' };
  if (code === 0) return { description: 'Clear', icon: '☀️' };
  if (code <= 2) return { description: 'Partly cloudy', icon: '⛅' };
  if (code === 3) return { description: 'Cloudy', icon: '☁️' };
  if (code === 45 || code === 48) return { description: 'Fog', icon: '🌫️' };
  if (code >= 51 && code <= 57) return { description: 'Drizzle', icon: '🌦️' };
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return { description: 'Rain likely', icon: '🌧️' };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { description: 'Snow', icon: '🌨️' };
  if (code >= 95) return { description: 'Thunderstorms', icon: '⛈️' };
  return { description: 'Conditions unknown', icon: '🌡️' };
}

// A finite number within [min, max], else null. Guards against missing values,
// strings and nonsense such as 999°.
function reading(value: unknown, min: number, max: number): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max ? value : null;
}

// The hour the forecast is read for: kickoff rounded down, or noon when unknown.
export function forecastHour(gameDate: string, kickoff: string | null): string {
  const hour = kickoff && /^\d{2}:\d{2}$/.test(kickoff) ? kickoff.slice(0, 2) : '12';
  return `${gameDate}T${hour}:00`;
}

// Turns an Open-Meteo reply into what the app shows. Never throws: anything
// unexpected becomes 'incomplete' (reached the service, no usable temperature)
// or 'unavailable' (no recognisable forecast at all).
export function parseForecast(json: unknown, gameDate: string, kickoff: string | null): WeatherState {
  const hourly = (json as { hourly?: Record<string, unknown> } | null)?.hourly;
  const times = hourly?.time;
  if (!hourly || !Array.isArray(times)) return { kind: 'unavailable' };
  const index = times.indexOf(forecastHour(gameDate, kickoff));
  const at = (key: string): unknown => {
    const values = hourly[key];
    return index >= 0 && Array.isArray(values) ? values[index] : undefined;
  };
  const code = reading(at('weather_code'), 0, 99);
  const forecast: Forecast = {
    tempF: reading(at('temperature_2m'), -60, 140),
    feelsLikeF: reading(at('apparent_temperature'), -80, 160),
    rainChance: reading(at('precipitation_probability'), 0, 100),
    windMph: reading(at('wind_speed_10m'), 0, 200),
    ...describeCode(code === null ? null : Math.round(code)),
  };
  return forecast.tempF === null ? { kind: 'incomplete', forecast } : { kind: 'ok', forecast };
}

// "Feels like 66° · Rain 10% · Wind 8 mph", leaving out what's missing.
export function forecastDetails(f: Forecast): string {
  const parts: string[] = [];
  if (f.feelsLikeF !== null && f.tempF !== null) parts.push(`Feels like ${Math.round(f.feelsLikeF)}°`);
  if (f.rainChance !== null) parts.push(`Rain ${Math.round(f.rainChance)}%`);
  if (f.windMph !== null) parts.push(`Wind ${Math.round(f.windMph)} mph`);
  return parts.join(' · ');
}

// Short form for the staff Games list chip: "⛅ 68° · Rain 10%".
export function forecastChip(f: Forecast): string {
  const temp = f.tempF === null ? '--°' : `${Math.round(f.tempF)}°`;
  return f.rainChance === null ? `${f.icon} ${temp}` : `${f.icon} ${temp} · Rain ${Math.round(f.rainChance)}%`;
}
