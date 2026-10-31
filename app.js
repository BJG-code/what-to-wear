// Runs the page: finds your location, fetches the forecast and shows what to wear.
// There are three screens: "Getting to know you" (first launch only), "Plan a session" and "Your outfit".
(function () {
  const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast';
  const PLACES_URL = 'https://geocoding-api.open-meteo.com/v1/search';
  const STORAGE_KEY = 'what-to-wear';

  // Used when the phone can't or won't share its location
  const CENTRAL_LONDON = { name: 'Central London', latitude: 51.5074, longitude: -0.1278, source: 'london' };
  // Forecast days to ask for: today plus 5, and one more for a session that runs past midnight
  const FORECAST_DAYS = 7;

  const el = (id) => document.getElementById(id);
  const WARMTH = ['hot', 'neutral', 'cold'];
  // Minutes per km, used to pre-fill the duration: running about 6 min/km, cycling about 25 km/h
  const PACE = { running: 6, cycling: 60 / 25 };
  const DAYS_AHEAD = 5;
  // True once you've typed your own duration, so changing the distance doesn't overwrite it
  let durationTyped = false;
  // Your profile is null until you've filled in Getting to know you
  // session holds the day, start time, distance, duration and effort once "What should I wear?" is tapped
  const state = { activity: 'running', profile: null, location: null, weather: null, session: null };
  // A runs hot / cold choice saved by the old version of the app, used to pre-tick the new one
  let oldWarmth = null;
  // Counts forecast requests, so an old answer arriving late is ignored
  let weatherRequest = 0;

  // Remember choices on this device. Wrapped in try/catch because private browsing can block storage.
  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
      if (saved.activity === 'running' || saved.activity === 'cycling') state.activity = saved.activity;
      const p = saved.profile;
      if (p && typeof p.name === 'string' && p.name.trim() && WARMTH.includes(p.warmth)) {
        state.profile = { name: p.name.trim(), warmth: p.warmth };
      }
      oldWarmth = { warm: 'hot', normal: 'neutral', cold: 'cold' }[saved.preference] || null;
      if (saved.location && typeof saved.location.latitude === 'number') state.location = saved.location;
    } catch (e) { /* start with defaults */ }
  }

  function save() {
    try {
      // Only remember a place you searched for; your current location is looked up fresh each time
      const location = state.location && state.location.source === 'search' ? state.location : null;
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        activity: state.activity, profile: state.profile, location,
      }));
    } catch (e) { /* not remembered, but the page still works */ }
  }

  function setStatus(message) {
    el('status').textContent = message;
    el('status').hidden = !message;
  }

  // Messages about the weather show on the Your outfit screen
  function setWeatherStatus(message) {
    el('weather-status').textContent = message;
    el('weather-status').hidden = !message;
  }

  // Show one screen and hide the others, starting at the top of the page
  function showScreen(name) {
    el('profile-screen').hidden = name !== 'profile';
    el('logo').hidden = name === 'outfit';
    el('plan-screen').hidden = name !== 'plan';
    el('outfit-screen').hidden = name !== 'outfit';
    window.scrollTo(0, 0);
  }

  // The line at the top of Your outfit, e.g. "Wed 28 Oct · 07:00 · Easy 8 km run"
  function summaryText(session) {
    const day = session.start.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
    const effort = session.effort[0].toUpperCase() + session.effort.slice(1);
    const kind = session.activity === 'cycling' ? 'ride' : 'run';
    return [day.replace(',', ''), session.time, `${effort} ${session.distance} km ${kind}`].join(' · ');
  }

  // A day as "2026-10-28", in the phone's own time zone
  function dayValue(date) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  // Day picker: today and the next 5 days, nothing later. Keeps your choice if it's still there.
  function showDays() {
    const chosen = checkedValue('day');
    const today = new Date();
    if (el('days').dataset.today === dayValue(today)) return;
    el('days').dataset.today = dayValue(today);
    const labels = [];
    for (let i = 0; i <= DAYS_AHEAD; i++) {
      const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = 'day';
      input.value = dayValue(date);
      input.checked = input.value === chosen;
      const full = date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
      input.setAttribute('aria-label', i === 0 ? `Today, ${full}` : full);
      const span = document.createElement('span');
      const weekday = document.createElement('small');
      weekday.textContent = date.toLocaleDateString('en-GB', { weekday: 'short' });
      const number = document.createElement('strong');
      number.textContent = date.getDate();
      span.append(weekday, number);
      label.append(input, span);
      labels.push(label);
    }
    el('days').replaceChildren(...labels);
  }

  function checkedValue(name) {
    const input = document.querySelector(`input[name="${name}"]:checked`);
    return input ? input.value : null;
  }

  // A number above 0 and no bigger than max, or null if the box is empty or doesn't make sense
  function readNumber(input, max) {
    const n = parseFloat(input.value);
    return Number.isFinite(n) && n > 0 && n <= max ? n : null;
  }

  // Duration starts as distance × pace, until you type your own
  function fillDuration() {
    if (durationTyped) return;
    const km = readNumber(el('distance'), 500);
    el('duration').value = km ? Math.max(1, Math.round(km * PACE[state.activity])) : '';
  }

  // The − and + buttons beside the distance, 1 km at a time and never below 1 km
  function stepDistance(change) {
    const km = readNumber(el('distance'), 500) || 0;
    el('distance').value = Math.min(500, Math.max(1, Math.round((km + change) * 10) / 10));
    el('distance').dispatchEvent(new Event('input', { bubbles: true }));
  }

  // Each session input: how to read it, its error message, and where to go to fix it
  const FIELDS = [
    { name: 'day', error: 'day-error', read: () => checkedValue('day'),
      focus: () => document.querySelector('input[name="day"]') },
    { name: 'start time', error: 'time-error', read: () => el('start-time').value || null,
      input: 'start-time' },
    { name: 'distance', error: 'distance-error', read: () => readNumber(el('distance'), 500),
      input: 'distance' },
    { name: 'duration', error: 'duration-error', read: () => readNumber(el('duration'), 1440),
      input: 'duration' },
    { name: 'effort', error: 'effort-error', read: () => checkedValue('effort'),
      focus: () => document.querySelector('input[name="effort"]') },
  ];

  function showFieldError(field, show) {
    el(field.error).hidden = !show;
    if (field.input) {
      if (show) el(field.input).setAttribute('aria-invalid', 'true');
      else el(field.input).removeAttribute('aria-invalid');
    }
  }

  // Once you fix an input that was flagged, its message goes away
  function clearFixedErrors() {
    for (const field of FIELDS) {
      if (!el(field.error).hidden && field.read() !== null) showFieldError(field, false);
    }
    if (FIELDS.every((field) => el(field.error).hidden)) el('session-error').hidden = true;
  }

  // "a, b and c"
  function listWords(words) {
    return words.length < 2 ? words.join('') : `${words.slice(0, -1).join(', ')} and ${words.at(-1)}`;
  }

  // Reads every session input. Returns null, and says what's missing, if any aren't filled in.
  function readSession() {
    const missing = FIELDS.filter((field) => field.read() === null);
    for (const field of FIELDS) showFieldError(field, missing.includes(field));
    if (missing.length) {
      el('session-error').textContent = `Please add the ${listWords(missing.map((f) => f.name))} first.`;
      el('session-error').hidden = false;
      const first = missing[0];
      (first.input ? el(first.input) : first.focus()).focus();
      return null;
    }
    el('session-error').hidden = true;
    const [y, m, d] = checkedValue('day').split('-').map(Number);
    const time = el('start-time').value.slice(0, 5);
    const [hours, minutes] = time.split(':').map(Number);
    return {
      activity: state.activity,
      start: new Date(y, m - 1, d, hours, minutes),
      // The same start as text, e.g. "2026-10-28T07:00", to find in the forecast
      startText: `${checkedValue('day')}T${time}`,
      time,
      distance: Math.round(readNumber(el('distance'), 500) * 10) / 10,
      duration: Math.round(readNumber(el('duration'), 1440)),
      effort: checkedValue('effort'),
    };
  }

  // "Hello Bradley!" at the top of Plan a session
  function showGreeting() {
    el('greeting').textContent = state.profile ? `Hello ${state.profile.name}!` : '';
  }

  // Getting to know you: the name is needed; the other answers have a choice ticked already
  function saveProfile(event) {
    event.preventDefault();
    const name = el('name').value.trim();
    el('name-error').hidden = Boolean(name);
    el('name').setAttribute('aria-invalid', String(!name));
    if (!name) {
      el('name').focus();
      return;
    }
    const warmth = document.querySelector('input[name="warmth"]:checked').value;
    state.profile = { name, warmth };
    save();
    showGreeting();
    showScreen('plan');
  }

  function openOutfit() {
    showDays();
    const session = readSession();
    if (!session) return;
    state.session = session;
    el('summary').textContent = summaryText(session);
    // Adds a step to the browser history, so swiping back returns to Plan a session
    history.pushState({ screen: 'outfit' }, '');
    showScreen('outfit');
    el('back').focus();
    fetchWeather();
  }

  function showSearch(show) {
    el('search').hidden = !show;
    el('change-location').setAttribute('aria-expanded', String(show));
    if (show) el('place').focus();
  }

  // No location from the phone: use central London and say so. You can still pick a town with "Change".
  function useLondon() {
    setStatus('We couldn\'t get your location, so we\'re using central London. Tap Change to pick a town.');
    setLocation(CENTRAL_LONDON, { keepStatus: true });
  }

  function useDeviceLocation() {
    if (!navigator.geolocation) {
      useLondon();
      return;
    }
    el('location-name').textContent = 'Finding your location…';
    setStatus('');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          name: 'Your current location',
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          source: 'device',
        });
      },
      useLondon,
      { timeout: 10000, maximumAge: 10 * 60 * 1000 }
    );
  }

  function setLocation(location, { keepStatus = false } = {}) {
    state.location = location;
    save();
    el('location-name').textContent = location.name;
    if (!keepStatus) setStatus('');
    showSearch(false);
    // If Your outfit is waiting for a location, get its forecast now
    if (!el('outfit-screen').hidden) fetchWeather();
  }

  // One call to Open-Meteo for the hourly forecast, then picks out the hours of your session
  async function fetchWeather() {
    const session = state.session;
    el('results').hidden = true;
    el('place-note').hidden = true;
    state.weather = null;
    if (!session) return;
    if (!state.location) {
      setWeatherStatus('Finding your location…');
      return;
    }
    const request = ++weatherRequest;
    const { latitude, longitude } = state.location;
    const params = new URLSearchParams({
      latitude, longitude,
      hourly: window.Weather.HOURLY_FIELDS.join(','),
      wind_speed_unit: 'kmh',
      timezone: 'auto',
      forecast_days: String(FORECAST_DAYS),
    });
    setWeatherStatus('Checking the forecast…');
    let forecast;
    try {
      const response = await fetch(`${WEATHER_URL}?${params}`);
      if (!response.ok) throw new Error(`Weather request failed: ${response.status}`);
      const data = await response.json();
      if (request !== weatherRequest) return;
      forecast = window.Weather.forSession(data, session.startText, session.duration);
    } catch (e) {
      if (request !== weatherRequest) return;
      setWeatherStatus('Couldn\'t get the forecast right now. Check your connection and try again.');
      return;
    }
    if (!forecast) {
      setWeatherStatus('There\'s no forecast for that day and time yet. Try again later.');
      return;
    }
    state.weather = forecast;
    setWeatherStatus('');
    render();
  }

  function render() {
    if (!state.weather || !state.session) return;
    const w = state.weather;
    const shown = window.Weather.readings(w.start);
    el('reading-temperature').textContent = shown.temperature;
    el('reading-wind').textContent = shown.wind;
    el('reading-rain').textContent = shown.rain;
    el('reading-sky').textContent = shown.sky;
    el('reading-humidity').textContent = shown.humidity;
    el('reading-light').textContent = shown.light;
    el('place-note').textContent = state.location.source === 'london'
      ? 'Forecast for central London, as we couldn\'t get your location.'
      : `Forecast for ${state.location.source === 'search' ? state.location.name : 'where you are now'}.`;
    el('place-note').hidden = false;

    // Until the new outfit rules arrive, the rain chance is the worst hour of the session
    const weather = {
      feelsLike: w.start.feelsLike,
      windSpeed: w.start.windSpeed || 0,
      rainChance: w.worstRainChance || 0,
      isDay: w.start.isDay,
      sunny: w.start.cloudCover !== null && w.start.cloudCover <= window.Weather.SUNNY_CLOUD,
    };
    const { items } = window.Clothing.recommend({
      activity: state.session.activity, preference: state.profile ? state.profile.warmth : 'neutral', weather,
    });
    const list = el('kit');
    list.replaceChildren(...items.map(({ area, item }) => {
      const li = document.createElement('li');
      const label = document.createElement('span');
      label.className = 'area';
      label.textContent = area;
      const text = document.createElement('span');
      text.textContent = item;
      li.append(label, text);
      return li;
    }));
    el('results').hidden = false;
  }

  async function searchPlaces(query) {
    const list = el('places');
    list.replaceChildren();
    setStatus('Searching…');
    try {
      const params = new URLSearchParams({ name: query, count: '5', language: 'en', format: 'json' });
      const response = await fetch(`${PLACES_URL}?${params}`);
      if (!response.ok) throw new Error(`Place search failed: ${response.status}`);
      const data = await response.json();
      const places = data.results || [];
      if (!places.length) {
        setStatus(`No places found for "${query}". Check the spelling and try again.`);
        return;
      }
      setStatus('');
      list.replaceChildren(...places.map((place) => {
        const name = [place.name, place.admin1, place.country].filter(Boolean).join(', ');
        const li = document.createElement('li');
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = name;
        button.addEventListener('click', () => {
          list.replaceChildren();
          el('place').value = '';
          setLocation({ name, latitude: place.latitude, longitude: place.longitude, source: 'search' });
        });
        li.append(button);
        return li;
      }));
    } catch (e) {
      setStatus('Couldn\'t search for places right now. Check your connection and try again.');
    }
  }

  function init() {
    load();

    // Tick the saved choices, and update the list whenever they change
    for (const input of document.querySelectorAll('input[name="activity"]')) {
      input.checked = input.value === state.activity;
      input.addEventListener('change', () => {
        state.activity = input.value;
        save();
        fillDuration();
      });
    }

    // Getting to know you, pre-filled with anything already known
    const warmth = (state.profile && state.profile.warmth) || oldWarmth || 'neutral';
    for (const input of document.querySelectorAll('input[name="warmth"]')) {
      input.checked = input.value === warmth;
    }
    el('profile-screen').addEventListener('submit', saveProfile);
    // Until Settings exists, "Change your details" reopens Getting to know you with your answers filled in
    el('edit-profile').addEventListener('click', () => {
      el('name').value = state.profile ? state.profile.name : '';
      for (const input of document.querySelectorAll('input[name="warmth"]')) {
        input.checked = input.value === (state.profile ? state.profile.warmth : 'neutral');
      }
      showScreen('profile');
      el('name').focus();
    });
    el('name').addEventListener('input', () => {
      if (el('name').value.trim()) {
        el('name-error').hidden = true;
        el('name').removeAttribute('aria-invalid');
      }
    });
    showGreeting();

    // Plan a session inputs
    showDays();
    // If the app is left open past midnight, move the days along when you come back to it
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) showDays();
    });
    el('distance').addEventListener('input', fillDuration);
    el('distance-down').addEventListener('click', () => stepDistance(-1));
    el('distance-up').addEventListener('click', () => stepDistance(1));
    el('duration').addEventListener('input', () => {
      // Emptying the box hands the duration back to the distance next time it changes
      durationTyped = el('duration').value !== '';
    });
    el('plan-screen').addEventListener('input', clearFixedErrors);
    el('plan-screen').addEventListener('change', clearFixedErrors);

    el('what-to-wear').addEventListener('click', openOutfit);
    // The back arrow does the same as the browser's back, so both end up in the same place
    el('back').addEventListener('click', () => history.back());
    window.addEventListener('popstate', (event) => {
      showScreen(event.state && event.state.screen === 'outfit' ? 'outfit' : 'plan');
    });
    // Open on Getting to know you the first time, then always on Plan a session, even after a reload
    history.replaceState(null, '');
    showScreen(state.profile ? 'plan' : 'profile');

    el('change-location').addEventListener('click', () => showSearch(el('search').hidden));
    el('use-device').addEventListener('click', useDeviceLocation);
    el('search-form').addEventListener('submit', (event) => {
      event.preventDefault();
      const query = el('place').value.trim();
      if (query) searchPlaces(query);
    });

    if (state.location) {
      setLocation(state.location);
    } else {
      useDeviceLocation();
    }
  }

  init();
})();
