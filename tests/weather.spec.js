// Checks how the session's weather is picked out of the hourly forecast, without opening the page.
const { test, expect } = require('@playwright/test');
const { forSession, readings, notes } = require('../weather.js');

// A small forecast for one morning, 06:00 to 10:00, in the shape Open-Meteo sends
const forecast = {
  hourly: {
    time: ['2026-10-28T06:00', '2026-10-28T07:00', '2026-10-28T08:00', '2026-10-28T09:00', '2026-10-28T10:00'],
    temperature_2m: [7.4, 8.6, 9.5, 10.4, 11.2],
    apparent_temperature: [5.1, 6.2, 7.0, 8.3, 9.0],
    wind_speed_10m: [10, 12, 14, 16, 18],
    wind_gusts_10m: [20, 22, 45, 30, 50],
    precipitation_probability: [5, 10, 60, 20, 90],
    cloud_cover: [100, 80, 30, 31, 0],
    is_day: [0, 1, 1, 1, 1],
    relative_humidity_2m: [90, 85, 80, 75, 70],
  },
};

test.describe('picking the hours of the session', () => {
  test('uses the hour nearest the start time', () => {
    expect(forSession(forecast, '2026-10-28T07:00', 30).start.time).toBe('07:00');
    expect(forSession(forecast, '2026-10-28T07:29', 30).start.time).toBe('07:00');
    expect(forSession(forecast, '2026-10-28T07:30', 30).start.time).toBe('08:00');
    expect(forSession(forecast, '2026-10-28T06:31', 30).start.time).toBe('07:00');
  });

  test('reads every value for the start hour', () => {
    expect(forSession(forecast, '2026-10-28T07:00', 30).start).toEqual({
      time: '07:00', temperature: 8.6, feelsLike: 6.2, windSpeed: 12, gusts: 22,
      rainChance: 10, cloudCover: 80, isDay: true, humidity: 85,
    });
    expect(forSession(forecast, '2026-10-28T06:00', 30).start.isDay).toBe(false);
  });

  test('checks every hour from start to finish', () => {
    // 07:00 for 90 minutes ends at 08:30, nearest 09:00
    const session = forSession(forecast, '2026-10-28T07:00', 90);
    expect(session.hours.map((h) => h.time)).toEqual(['07:00', '08:00', '09:00']);
    // 07:00 for 29 minutes stays in the 07:00 hour
    expect(forSession(forecast, '2026-10-28T07:00', 29).hours.map((h) => h.time)).toEqual(['07:00']);
  });

  test('rain and gusts use the worst hour of the session', () => {
    const session = forSession(forecast, '2026-10-28T07:00', 90);
    expect(session.worstRainChance).toBe(60);
    expect(session.worstGusts).toBe(45);
    // A short session misses the 08:00 rain and gusts
    const short = forSession(forecast, '2026-10-28T07:00', 20);
    expect(short.worstRainChance).toBe(10);
    expect(short.worstGusts).toBe(22);
  });

  test('a session running past the end of the forecast uses the hours there are', () => {
    const session = forSession(forecast, '2026-10-28T09:00', 240);
    expect(session.hours.map((h) => h.time)).toEqual(['09:00', '10:00']);
    expect(session.worstRainChance).toBe(90);
  });

  test('works across midnight and on later days', () => {
    const late = {
      hourly: {
        time: ['2026-10-30T23:00', '2026-10-31T00:00', '2026-10-31T01:00'],
        temperature_2m: [5, 4, 3],
        apparent_temperature: [3, 2, 1],
        precipitation_probability: [0, 55, 0],
      },
    };
    const session = forSession(late, '2026-10-30T23:00', 60);
    expect(session.hours.map((h) => h.time)).toEqual(['23:00', '00:00']);
    expect(session.worstRainChance).toBe(55);
  });

  test('no forecast for the start time gives nothing, rather than a guess', () => {
    expect(forSession(forecast, '2026-10-29T07:00', 30)).toBeNull();
    expect(forSession(forecast, '2026-10-28T05:00', 30)).toBeNull();
    expect(forSession({}, '2026-10-28T07:00', 30)).toBeNull();
    expect(forSession(null, '2026-10-28T07:00', 30)).toBeNull();
    const noTemperature = { hourly: { ...forecast.hourly, apparent_temperature: [null, null, null, null, null] } };
    expect(forSession(noTemperature, '2026-10-28T07:00', 30)).toBeNull();
  });

  test('gaps in the rain or gusts are ignored', () => {
    const gaps = { hourly: { ...forecast.hourly, precipitation_probability: [null, null, null, null, null] } };
    const session = forSession(gaps, '2026-10-28T07:00', 90);
    expect(session.start.rainChance).toBeNull();
    expect(session.worstRainChance).toBeNull();
  });
});

test.describe('the six readings', () => {
  const hour = (changes) => ({ ...forSession(forecast, '2026-10-28T07:00', 30).start, ...changes });

  test('shows temperature, wind and gust, rain, sky, humidity and light', () => {
    expect(readings(hour())).toEqual({
      temperature: '9°C', wind: '12 · gust 22', rain: '10%', sky: 'Cloudy', humidity: '85%', light: 'Daylight',
    });
  });

  test('sky is sunny at 30% cloud or less, cloudy above', () => {
    expect(readings(hour({ cloudCover: 30 })).sky).toBe('Sunny');
    expect(readings(hour({ cloudCover: 31 })).sky).toBe('Cloudy');
    expect(readings(hour({ cloudCover: 0 })).sky).toBe('Sunny');
  });

  test('at night the sky is clear rather than sunny, and the light is dark', () => {
    expect(readings(hour({ cloudCover: 10, isDay: false }))).toMatchObject({ sky: 'Clear', light: 'Dark' });
    expect(readings(hour({ cloudCover: 90, isDay: false }))).toMatchObject({ sky: 'Cloudy', light: 'Dark' });
  });

  test('numbers are rounded to whole ones', () => {
    expect(readings(hour({ temperature: -0.4, windSpeed: 7.5, gusts: 14.49 }))).toMatchObject({
      temperature: '0°C', wind: '8 · gust 14',
    });
  });

  test('a gap in the forecast shows as a dash', () => {
    expect(readings(hour({ gusts: null, humidity: null, cloudCover: null, rainChance: null }))).toMatchObject({
      wind: '12 · gust –', humidity: '–', sky: '–', rain: '–',
    });
  });
});

test.describe('notes about the weather', () => {
  // One session, built from a list of hours. Each hour is daylight, dry, calm and 8 °C feels like, unless changed.
  function session(changes) {
    const hours = changes.map((change, i) => ({
      time: `0${7 + i}:00`, temperature: 10, feelsLike: 8, windSpeed: 10, gusts: 20,
      rainChance: 10, cloudCover: 80, isDay: true, humidity: 80, ...change,
    }));
    return { start: hours[0], hours };
  }
  const texts = (hours, startTime = '07:00') => notes(session(hours), startTime).map((n) => n.text);

  test('nothing to say on a dry, calm, light, steady session', () => {
    expect(texts([{}, {}, {}])).toEqual([]);
  });

  test('rain likely at 50% or more, not 49%', () => {
    expect(texts([{ rainChance: 50 }])).toEqual(['Rain likely.']);
    expect(texts([{ rainChance: 49 }])).toEqual([]);
  });

  test('gusty at 40 km/h or more, not 39', () => {
    expect(texts([{ gusts: 40 }])).toEqual(['Gusty.']);
    expect(texts([{ gusts: 39 }])).toEqual([]);
  });

  test('dark at the start says take lights, with your start time', () => {
    expect(notes(session([{ isDay: false }]), '06:40')).toEqual([
      { kind: 'dark', text: 'Dark at 06:40: take lights.' },
    ]);
  });

  test('says when rain, gusts or dark start later in the session', () => {
    expect(texts([{}, { rainChance: 60 }, { rainChance: 80, gusts: 45, isDay: false }])).toEqual([
      'Rain likely from 08:00.', 'Gusty from 09:00.', 'Dark from 09:00: take lights.',
    ]);
  });

  test('already true at the start: said once, without a time', () => {
    expect(texts([{ rainChance: 60 }, { rainChance: 90 }])).toEqual(['Rain likely.']);
  });

  test('getting light during the session still needs lights at the start', () => {
    expect(texts([{ isDay: false }, {}])).toEqual(['Dark at 07:00: take lights.']);
  });

  test('feels like changing by 3 °C or more by the end', () => {
    expect(texts([{}, {}, { feelsLike: 4.2 }])).toEqual(['About 4° colder by the end.']);
    expect(texts([{}, { feelsLike: 2 }, { feelsLike: 11 }])).toEqual(['About 3° warmer by the end.']);
    // 2.9 °C isn't enough, and only the end counts, not a dip in the middle
    expect(texts([{}, {}, { feelsLike: 5.1 }])).toEqual([]);
    expect(texts([{}, { feelsLike: 0 }, {}])).toEqual([]);
  });

  test('gaps in the forecast are ignored', () => {
    expect(texts([{ rainChance: null, gusts: null }, { rainChance: null, gusts: null, feelsLike: null }])).toEqual([]);
  });
});
