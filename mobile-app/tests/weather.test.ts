import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  describeCode, forecastChip, forecastDetails, forecastHour, forecastUrl, isForecastable, parseForecast,
} from '../lib/weather.ts';

const reply = (over: Record<string, unknown[]> = {}) => ({
  hourly: {
    time: ['2026-11-07T10:00', '2026-11-07T11:00', '2026-11-07T12:00'],
    temperature_2m: [64, 68.4, 70],
    apparent_temperature: [62, 66.2, 69],
    precipitation_probability: [5, 10, 20],
    weather_code: [1, 2, 3],
    wind_speed_10m: [6, 8.3, 9],
    ...over,
  },
});

test('reads the forecast for the kickoff hour', () => {
  const s = parseForecast(reply(), '2026-11-07', '11:30');
  assert.equal(s.kind, 'ok');
  if (s.kind !== 'ok') return;
  assert.equal(s.forecast.tempF, 68.4);
  assert.equal(s.forecast.description, 'Partly cloudy');
  assert.equal(forecastDetails(s.forecast), 'Feels like 66° · Rain 10% · Wind 8 mph');
  assert.equal(forecastChip(s.forecast), '⛅ 68° · Rain 10%');
});

test('uses noon when kickoff is unknown', () => {
  assert.equal(forecastHour('2026-11-07', null), '2026-11-07T12:00');
  const s = parseForecast(reply(), '2026-11-07', null);
  assert.equal(s.kind === 'ok' && s.forecast.tempF, 70);
});

test('missing temperature is incomplete, and keeps what else came back', () => {
  const s = parseForecast(reply({ temperature_2m: [64, null, 70] }), '2026-11-07', '11:00');
  assert.equal(s.kind, 'incomplete');
  if (s.kind !== 'incomplete') return;
  assert.equal(s.forecast.tempF, null);
  assert.equal(s.forecast.rainChance, 10);
  assert.equal(forecastDetails(s.forecast), 'Rain 10% · Wind 8 mph');
  assert.equal(forecastChip(s.forecast), '⛅ --° · Rain 10%');
});

test('nonsense values are treated as missing', () => {
  const s = parseForecast(
    reply({ temperature_2m: [0, 999, 0], precipitation_probability: [0, -5, 0], wind_speed_10m: [0, 'fast', 0] }),
    '2026-11-07', '11:00',
  );
  assert.equal(s.kind, 'incomplete');
  if (s.kind !== 'incomplete') return;
  assert.equal(s.forecast.rainChance, null);
  assert.equal(s.forecast.windMph, null);
});

test('kickoff hour missing from the reply is incomplete', () => {
  assert.equal(parseForecast(reply(), '2026-11-07', '19:00').kind, 'incomplete');
});

test('a reply with no forecast in it is unavailable, never a crash', () => {
  for (const bad of [null, undefined, 'oops', 42, {}, { hourly: {} }, { hourly: { time: 'x' } }, { error: true, reason: 'bad' }]) {
    assert.equal(parseForecast(bad, '2026-11-07', '11:00').kind, 'unavailable');
  }
});

test('only games from today to 15 days out get a forecast', () => {
  assert.equal(isForecastable('2026-10-29', '2026-10-29'), true);
  assert.equal(isForecastable('2026-11-13', '2026-10-29'), true);
  assert.equal(isForecastable('2026-11-14', '2026-10-29'), false);
  assert.equal(isForecastable('2026-10-28', '2026-10-29'), false);
});

test('weather codes map to plain descriptions', () => {
  assert.equal(describeCode(0).description, 'Clear');
  assert.equal(describeCode(63).description, 'Rain likely');
  assert.equal(describeCode(95).description, 'Thunderstorms');
  assert.equal(describeCode(null).description, 'Conditions unknown');
});

test('forecast URL asks Open-Meteo for Ford Stadium in Fahrenheit, Chicago time', () => {
  const url = new URL(forecastUrl('2026-11-07'));
  assert.equal(url.hostname, 'api.open-meteo.com');
  assert.equal(url.searchParams.get('start_date'), '2026-11-07');
  assert.equal(url.searchParams.get('temperature_unit'), 'fahrenheit');
  assert.equal(url.searchParams.get('timezone'), 'America/Chicago');
});
