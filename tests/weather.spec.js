// Checks how the session's weather is picked out of the hourly forecast, without opening the page.
const { test, expect } = require('@playwright/test');
const { forSession, readings, notes, DAILY_FIELDS } = require('../weather.js');

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
      rainChance: 10, cloudCover: 80, isDay: true, humidity: 85, uvIndex: null,
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

test.describe('exact sunrise and sunset (C5)', () => {
  // Sat 14 Nov 2026: sunrise 07:17, sunset 16:10. Clear all morning; Open-Meteo's hourly daylight
  // says 07:00 is dark and 08:00 is light. The afternoon clouds over.
  const day = {
    hourly: {
      time: ['06:00', '07:00', '08:00', '09:00', '15:00', '16:00', '17:00', '18:00'].map((t) => `2026-11-14T${t}`),
      temperature_2m: [5, 5, 6, 7, 9, 8, 7, 6],
      apparent_temperature: [3, 3, 4, 5, 7, 6, 5, 4],
      cloud_cover: [0, 0, 0, 0, 90, 90, 90, 90],
      is_day: [0, 0, 1, 1, 1, 1, 0, 0],
    },
    daily: { time: ['2026-11-14'], sunrise: ['2026-11-14T07:17'], sunset: ['2026-11-14T16:10'] },
  };

  test('asks Open-Meteo for each day\'s sunrise and sunset', () => {
    expect(DAILY_FIELDS).toEqual(['sunrise', 'sunset']);
  });

  test('a 07:15 start is dark when the sun rises at 07:17', () => {
    const session = forSession(day, '2026-11-14T07:15', 60);
    expect(session.start.isDay).toBe(false);
    expect(readings(session.start).light).toBe('Dark');
    expect(session.sunrise).toBe('07:17');
    expect(notes(session, '07:15').map((n) => n.text)).toEqual(['Dark at 07:15, light from 07:17: take lights.']);
  });

  test('sunny if any hour of the session is sunny, even if it starts dark (the 14 Nov run)', () => {
    // 07:15 to 08:15: dark at the start, bright sun once the sun is up
    expect(forSession(day, '2026-11-14T07:15', 60).sunny).toBe(true);
    // A short one still counts: it finishes at 07:45, after sunrise
    expect(forSession(day, '2026-11-14T07:15', 30).sunny).toBe(true);
    // All before sunrise: clear but not sunny
    const early = forSession(day, '2026-11-14T06:00', 60);
    expect(early.sunny).toBe(false);
    expect(early.sunrise).toBeNull();
  });

  test('sunrise and sunset on the minute: light from sunrise, dark from sunset', () => {
    expect(forSession(day, '2026-11-14T07:17', 30).start.isDay).toBe(true);
    expect(forSession(day, '2026-11-14T07:16', 30).start.isDay).toBe(false);
    expect(forSession(day, '2026-11-14T16:09', 30).start.isDay).toBe(true);
    expect(forSession(day, '2026-11-14T16:10', 30).start.isDay).toBe(false);
  });

  test('getting dark during the session gives the exact sunset', () => {
    const session = forSession(day, '2026-11-14T15:30', 60);
    expect(session.start.isDay).toBe(true);
    expect(session.sunset).toBe('16:10');
    expect(notes(session, '15:30').map((n) => n.text)).toEqual(['Dark from 16:10 (sunset): take lights.']);
    // Cloudy all afternoon, so not sunny
    expect(session.sunny).toBe(false);
  });

  test('finishing before sunset: no lights', () => {
    const session = forSession(day, '2026-11-14T15:00', 60);
    expect(session.sunset).toBeNull();
    expect(notes(session, '15:00')).toEqual([]);
  });

  test('without sunrise and sunset, uses Open-Meteo\'s hourly daylight as before', () => {
    const { daily, ...hourlyOnly } = day;
    const session = forSession(hourlyOnly, '2026-11-14T07:15', 60);
    expect(session.start.isDay).toBe(false);
    expect(session.sunny).toBe(true);
    expect(session.sunrise).toBeNull();
    expect(notes(session, '07:15').map((n) => n.text)).toEqual(['Dark at 07:15: take lights.']);
  });
});

test.describe('real sunshine and UV (C6)', () => {
  // Sun 22 Nov 2026 in Dubai: sunrise 06:40. Thin high cloud, so Open-Meteo says 60% cloud all morning,
  // but the sun shines. Each hour's sunshine is for the hour before it, in seconds.
  const day = {
    hourly: {
      time: ['06:00', '07:00', '08:00', '09:00', '10:00', '11:00'].map((t) => `2026-11-22T${t}`),
      temperature_2m: [22, 23, 24, 26, 27, 28],
      apparent_temperature: [24, 25, 26, 27, 28, 29],
      cloud_cover: [60, 60, 60, 60, 60, 60],
      is_day: [0, 1, 1, 1, 1, 1],
      sunshine_duration: [0, 1200, 3600, 3600, 3600, 3600],
      uv_index: [0, 0.4, 1.6, 2.95, 4.5, 6],
    },
    daily: { time: ['2026-11-22'], sunrise: ['2026-11-22T06:40'], sunset: ['2026-11-22T17:30'] },
  };

  test('asks Open-Meteo for sunshine and the UV index', () => {
    expect(require('../weather.js').HOURLY_FIELDS).toEqual(expect.arrayContaining(['sunshine_duration', 'uv_index']));
  });

  test('sunny when any hour of the session has 30 minutes of sunshine or more, whatever the cloud cover says', () => {
    const session = forSession(day, '2026-11-22T07:20', 70);
    expect(readings(session.start).sky).toBe('Cloudy');
    expect(session.sunny).toBe(true);
  });

  test('sunshine counts for the hour before, so only the hours the session covers count', () => {
    // 06:00 to 06:50: only the 07:00 figure (06:00 to 07:00) counts, 20 minutes: not sunny
    expect(forSession(day, '2026-11-22T06:00', 50).sunny).toBe(false);
    // 06:00 to 07:00 exactly: the 08:00 figure (07:00 to 08:00) doesn't count
    expect(forSession(day, '2026-11-22T06:00', 60).sunny).toBe(false);
    // 06:00 to 07:01 reaches into 07:00 to 08:00, which is sunny
    expect(forSession(day, '2026-11-22T06:00', 61).sunny).toBe(true);
    // 30 minutes exactly is enough, 29:59 isn't
    const edge = (seconds) => ({ hourly: { ...day.hourly, sunshine_duration: [0, seconds, 0, 0, 0, 0] } });
    expect(forSession(edge(1800), '2026-11-22T06:00', 30).sunny).toBe(true);
    expect(forSession(edge(1799), '2026-11-22T06:00', 30).sunny).toBe(false);
  });

  test('without sunshine in the forecast, uses daylight and cloud cover as before', () => {
    const { sunshine_duration: gone, ...rest } = day.hourly;
    expect(forSession({ ...day, hourly: { ...rest } }, '2026-11-22T07:20', 70).sunny).toBe(false);
    const clear = { ...day, hourly: { ...rest, cloud_cover: [0, 0, 0, 0, 0, 0] } };
    expect(forSession(clear, '2026-11-22T07:20', 70).sunny).toBe(true);
  });

  test('the highest UV index during the session, for sun cream', () => {
    // 07:20 to 08:20 covers the 07:00 and 08:00 hours
    expect(forSession(day, '2026-11-22T07:20', 60).worstUv).toBe(1.6);
    expect(forSession(day, '2026-11-22T08:00', 60).worstUv).toBe(2.95);
    expect(forSession(day, '2026-11-22T09:00', 120).worstUv).toBe(6);
    const { uv_index: gone, ...rest } = day.hourly;
    expect(forSession({ ...day, hourly: rest }, '2026-11-22T09:00', 60).worstUv).toBeNull();
  });
});
