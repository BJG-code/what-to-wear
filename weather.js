// Picks out the weather for your session from Open-Meteo's hourly forecast.
// Kept separate from the page so it can be tested on its own.
(function (root) {
  // What we ask Open-Meteo for, one value per hour
  const HOURLY_FIELDS = [
    'temperature_2m', 'apparent_temperature', 'wind_speed_10m', 'wind_gusts_10m',
    'precipitation_probability', 'cloud_cover', 'is_day', 'relative_humidity_2m',
  ];

  // Cloud cover (%) at or below which the sky counts as sunny (or clear at night)
  const SUNNY_CLOUD = 30;

  const HOUR = 60 * 60 * 1000;

  // Notes: rain chance (%) and gusts (km/h) worth a mention, and how much feels like (°C) must change
  const RAIN_NOTE = 50;
  const GUST_NOTE = 40;
  const FEELS_CHANGE = 3;

  // Turns "2026-10-28T07:00" into a number we can compare and add minutes to.
  // Both the forecast and your chosen time are clock times at the place, so time zones don't matter here.
  function clockTime(text) {
    const [day, time = '00:00'] = text.split('T');
    const [y, m, d] = day.split('-').map(Number);
    const [hours, minutes] = time.split(':').map(Number);
    return Date.UTC(y, m - 1, d, hours, minutes);
  }

  // A number, or null when the forecast has a gap
  const value = (n) => (typeof n === 'number' && Number.isFinite(n) ? n : null);

  // The biggest number in a list, ignoring gaps (null if they're all gaps)
  function worst(numbers) {
    const known = numbers.filter((n) => n !== null);
    return known.length ? Math.max(...known) : null;
  }

  // forecast: Open-Meteo's answer. start: "2026-10-28T07:00". duration: minutes.
  // Returns the hour nearest the start, every hour from start to finish, and the worst rain and gusts
  // in that time; or null if the forecast doesn't cover the start.
  function forSession(forecast, start, duration) {
    const h = forecast && forecast.hourly;
    if (!h || !Array.isArray(h.time)) return null;
    const times = h.time.map(clockTime);
    const startTime = clockTime(start);
    const nearestHour = (time) => Math.round(time / HOUR) * HOUR;

    const first = times.indexOf(nearestHour(startTime));
    if (first < 0) return null;
    let last = times.indexOf(nearestHour(startTime + duration * 60 * 1000));
    // A session running past the end of the forecast uses the hours there are
    if (last < 0) last = times.length - 1;

    const hours = [];
    for (let i = first; i <= last; i++) {
      hours.push({
        time: h.time[i].slice(11, 16),
        temperature: value(h.temperature_2m && h.temperature_2m[i]),
        feelsLike: value(h.apparent_temperature && h.apparent_temperature[i]),
        windSpeed: value(h.wind_speed_10m && h.wind_speed_10m[i]),
        gusts: value(h.wind_gusts_10m && h.wind_gusts_10m[i]),
        rainChance: value(h.precipitation_probability && h.precipitation_probability[i]),
        cloudCover: value(h.cloud_cover && h.cloud_cover[i]),
        isDay: h.is_day && h.is_day[i] === 1,
        humidity: value(h.relative_humidity_2m && h.relative_humidity_2m[i]),
      });
    }

    // Without the temperature at the start there's nothing to dress for
    const startHour = hours[0];
    if (startHour.temperature === null || startHour.feelsLike === null) return null;

    return {
      start: startHour,
      hours,
      worstRainChance: worst(hours.map((hour) => hour.rainChance)),
      worstGusts: worst(hours.map((hour) => hour.gusts)),
    };
  }

  // The six readings shown on Your outfit, as text. A gap in the forecast shows as "–".
  function readings(hour) {
    const round = (n, unit = '') => (n === null ? '–' : `${Math.round(n)}${unit}`);
    let sky = '–';
    if (hour.cloudCover !== null) {
      if (hour.cloudCover > SUNNY_CLOUD) sky = 'Cloudy';
      else sky = hour.isDay ? 'Sunny' : 'Clear';
    }
    return {
      temperature: round(hour.temperature, '°C'),
      wind: `${round(hour.windSpeed)} · gust ${round(hour.gusts)}`,
      rain: round(hour.rainChance, '%'),
      sky,
      humidity: round(hour.humidity, '%'),
      light: hour.isDay ? 'Daylight' : 'Dark',
    };
  }

  // Short notes about the weather, shown below the outfit only when they apply.
  // session: from forSession. startTime: your start time as text, e.g. "07:00".
  // Returns a list of { kind, text }, where kind is "rain", "wind", "dark" or "temperature".
  // Something true at the start is said plainly ("Rain likely."); something that starts later in
  // the session says when ("Rain likely from 08:00.").
  function notes(session, startTime) {
    const { start, hours } = session;
    const later = hours.slice(1);
    const list = [];

    // From the first hour that matches, or null if none do
    const firstLater = (matches) => {
      const hour = later.find(matches);
      return hour ? hour.time : null;
    };

    const rainy = (hour) => hour.rainChance !== null && hour.rainChance >= RAIN_NOTE;
    if (rainy(start)) list.push({ kind: 'rain', text: 'Rain likely.' });
    else if (firstLater(rainy)) list.push({ kind: 'rain', text: `Rain likely from ${firstLater(rainy)}.` });

    const gusty = (hour) => hour.gusts !== null && hour.gusts >= GUST_NOTE;
    if (gusty(start)) list.push({ kind: 'wind', text: 'Gusty.' });
    else if (firstLater(gusty)) list.push({ kind: 'wind', text: `Gusty from ${firstLater(gusty)}.` });

    const dark = (hour) => !hour.isDay;
    if (dark(start)) list.push({ kind: 'dark', text: `Dark at ${startTime}: take lights.` });
    else if (firstLater(dark)) list.push({ kind: 'dark', text: `Dark from ${firstLater(dark)}: take lights.` });

    // Feels like at the end compared with the start
    const end = hours[hours.length - 1];
    if (end.feelsLike !== null && start.feelsLike !== null) {
      const change = end.feelsLike - start.feelsLike;
      if (Math.abs(change) >= FEELS_CHANGE) {
        const word = change < 0 ? 'colder' : 'warmer';
        list.push({ kind: 'temperature', text: `About ${Math.round(Math.abs(change))}° ${word} by the end.` });
      }
    }
    return list;
  }

  const api = { HOURLY_FIELDS, SUNNY_CLOUD, forSession, readings, notes };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.Weather = api;
  }
})(this);
