// Runs the page: finds your location, fetches the forecast and shows what to wear.
// There are four screens: "Getting to know you" (first launch only), "Plan a session", "Your outfit" and "Settings".
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
  // How many recent outfits to keep, waiting to be rated, and for how long after they finish
  const KEEP_OUTFITS = 5;
  const RATE_WITHIN_DAYS = 3;
  const RATINGS = { hot: 'Too hot', perfect: 'Perfect', cold: 'Too cold' };
  // True once you've typed your own duration, so changing the distance doesn't overwrite it
  let durationTyped = false;
  // Your profile is null until you've filled in Getting to know you
  // session holds the day, start time, distance, duration and effort once "What should I wear?" is tapped
  // offsets: learned from your feedback, separate for running and cycling (°C)
  // ratings: every rating you've given, with its forecast, effort, distance and duration
  // outfits: recent outfits you haven't rated yet, so you can come back and rate them after the session
  // rules: your rules of thumb, the dressing temperatures where each item starts (changed in Settings)
  const state = {
    activity: 'running', profile: null, location: null, weather: null, session: null,
    offsets: { running: 0, cycling: 0 }, ratings: [], outfits: [],
    rules: window.Clothing.checkRules(null),
  };
  // Where the forecast on Your outfit is for, and the dressing temperature it gave
  let rated = null;
  // The session you've just rated, so Your outfit can say thanks
  let justRated = null;
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
      if (saved.offsets) {
        for (const activity of ['running', 'cycling']) {
          const n = saved.offsets[activity];
          if (typeof n === 'number' && Math.abs(n) <= window.Clothing.OFFSET_LIMIT) state.offsets[activity] = n;
        }
      }
      if (Array.isArray(saved.ratings)) state.ratings = saved.ratings;
      state.rules = window.Clothing.checkRules(saved.rules);
      if (Array.isArray(saved.outfits)) {
        // Forget outfits that finished too long ago to remember how they felt
        const tooOld = Date.now() - RATE_WITHIN_DAYS * 24 * 60 * 60 * 1000;
        state.outfits = saved.outfits.filter((o) => o && o.session && o.weather
          && finishTime(restoreSession(o.session)) > tooOld);
      }
    } catch (e) { /* start with defaults */ }
  }

  function save() {
    try {
      // Only remember a place you searched for; your current location is looked up fresh each time
      const location = state.location && state.location.source === 'search' ? state.location : null;
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        activity: state.activity, profile: state.profile, location,
        offsets: state.offsets, ratings: state.ratings, outfits: state.outfits, rules: state.rules,
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
    el('logo').hidden = name === 'outfit' || name === 'settings';
    el('open-settings').hidden = name !== 'plan';
    el('plan-screen').hidden = name !== 'plan';
    el('outfit-screen').hidden = name !== 'outfit';
    el('settings-screen').hidden = name !== 'settings';
    if (name === 'plan') showLastSession();
    window.scrollTo(0, 0);
  }

  // Each session is known by its activity and start, e.g. "running 2026-10-28T07:00"
  function sessionId(session) {
    return `${session.activity} ${session.startText}`;
  }

  // A session as saved on the phone: the start is kept as text, as dates don't save
  function savedSession(session) {
    const { start, ...rest } = session;
    return rest;
  }

  function restoreSession(saved) {
    const [day, time] = saved.startText.split('T');
    const [y, m, d] = day.split('-').map(Number);
    const [hours, minutes] = time.split(':').map(Number);
    return { ...saved, start: new Date(y, m - 1, d, hours, minutes) };
  }

  // When the session ends: start + duration
  function finishTime(session) {
    return new Date(session.start.getTime() + session.duration * 60 * 1000);
  }

  // "07:48" today, or "Thu 29 Oct, 07:48" on another day
  function whenText(date) {
    const pad = (n) => String(n).padStart(2, '0');
    const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
    if (dayValue(date) === dayValue(new Date())) return time;
    const day = date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
    return `${day.replace(',', '')}, ${time}`;
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
    // The learned offset at the time, so this outfit stays the same after you rate it
    session.learnedOffset = state.offsets[session.activity];
    goToOutfit(session);
    fetchWeather();
  }

  function goToOutfit(session) {
    state.session = session;
    justRated = null;
    el('summary').textContent = summaryText(session);
    // Adds a step to the browser history, so swiping back returns to Plan a session
    history.pushState({ screen: 'outfit' }, '');
    showScreen('outfit');
    el('back').focus();
  }

  // Your last finished session that hasn't been rated yet, if there is one
  function lastUnrated() {
    const now = Date.now();
    const finished = state.outfits
      .map((outfit) => ({ outfit, session: restoreSession(outfit.session) }))
      .filter(({ session }) => finishTime(session).getTime() <= now)
      .sort((a, b) => finishTime(b.session) - finishTime(a.session));
    return finished[0] || null;
  }

  // On Plan a session: asks how your last session went, once it has finished
  function showLastSession() {
    const last = lastUnrated();
    el('last-session').hidden = !last;
    if (!last) return;
    const kind = last.session.activity === 'cycling' ? 'ride' : 'run';
    el('last-session-text').textContent = `How did the outfit feel for your ${kind}? ${summaryText(last.session)}`;
  }

  // "Rate it" reopens Your outfit just as it was, with the forecast you dressed for
  function reopenLast() {
    const last = lastUnrated();
    if (!last) return;
    goToOutfit(last.session);
    ++weatherRequest;
    state.weather = last.outfit.weather;
    setWeatherStatus('');
    render(last.outfit.place);
  }

  // "Not now": stops asking about that session
  function forgetLast() {
    const last = lastUnrated();
    if (!last) return;
    state.outfits = state.outfits.filter((o) => o !== last.outfit);
    save();
    showLastSession();
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
    if (!el('outfit-screen').hidden && !state.weather) fetchWeather();
  }

  // One call to Open-Meteo for the hourly forecast, then picks out the hours of your session
  async function fetchWeather() {
    const session = state.session;
    el('results').hidden = true;
    el('place-note').hidden = true;
    el('feedback').hidden = true;
    state.weather = null;
    rated = null;
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
    render({ name: state.location.name, source: state.location.source });
  }

  // A temperature to the nearest whole degree, with a proper minus sign, e.g. "−3"
  function wholeDegrees(n) {
    const rounded = Math.round(n) || 0;
    return rounded < 0 ? `−${-rounded}` : String(rounded);
  }

  // An adjustment with its sign, e.g. "+2°", "−4°" or "+0.5°"
  function signed(n) {
    return `${n < 0 ? '−' : '+'}${Math.abs(n)}°`;
  }

  // How the dressing temperature was worked out, one line at a time, e.g.
  // "Feels like 6°", "+2° for 8 km", "Easy +0° · Neutral +0°", "Learned +0°"
  function breakdownLines(d, session) {
    const effort = session.effort[0].toUpperCase() + session.effort.slice(1);
    const profile = { hot: 'Runs hot', neutral: 'Neutral', cold: 'Runs cold' }[state.profile ? state.profile.warmth : 'neutral'];
    const last = [`Learned ${signed(d.learned)}`];
    if (d.chill) last.push(`Bike chill ${signed(-d.chill)}`);
    return [
      `Feels like ${wholeDegrees(d.feelsLike)}°`,
      `${signed(d.distance)} for ${session.distance} km`,
      `${effort} ${signed(d.effort)} · ${profile} ${signed(d.profile)}`,
      last.join(' · '),
    ];
  }

  // Small icons beside the notes: a raindrop, wind, a light bulb and a thermometer
  const NOTE_ICONS = {
    rain: '<path d="M12 3s-6 7-6 11a6 6 0 0 0 12 0c0-4-6-11-6-11z"/>',
    wind: '<path d="M3 9h11a3 3 0 1 0-3-3"/><path d="M3 15h15a3 3 0 1 1-3 3"/>',
    dark: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.9.7 1.5 1.6 1.5 2.6V17h4v-.5c0-1 .6-1.9 1.5-2.6A6 6 0 0 0 12 3z"/>',
    temperature: '<path d="M10 14V5a2 2 0 1 1 4 0v9a4 4 0 1 1-4 0z"/>',
  };

  function noteIcon(kind) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    for (const [name, v] of Object.entries({
      viewBox: '0 0 24 24', width: '22', height: '22', fill: 'none', stroke: 'currentColor',
      'stroke-width': '1.8', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true',
    })) svg.setAttribute(name, v);
    svg.innerHTML = NOTE_ICONS[kind];
    return svg;
  }

  // place: where the forecast is for, { name, source }
  function render(place) {
    if (!state.weather || !state.session) return;
    const w = state.weather;
    const shown = window.Weather.readings(w.start);
    el('reading-temperature').textContent = shown.temperature;
    el('reading-wind').textContent = shown.wind;
    el('reading-rain').textContent = shown.rain;
    el('reading-sky').textContent = shown.sky;
    el('reading-humidity').textContent = shown.humidity;
    el('reading-light').textContent = shown.light;
    el('place-note').textContent = place.source === 'london'
      ? 'Forecast for central London, as we couldn\'t get your location.'
      : `Forecast for ${place.source === 'search' ? place.name : 'where you are now'}.`;
    el('place-note').hidden = false;

    // The dressing temperature and how it was worked out
    const session = state.session;
    const dressing = window.Clothing.dressingTemperature({
      activity: session.activity,
      feelsLike: w.start.feelsLike,
      effort: session.effort,
      distance: session.distance,
      warmth: state.profile ? state.profile.warmth : 'neutral',
      learnedOffset: session.learnedOffset || 0,
    });
    el('dressing-temp').textContent = `${wholeDegrees(dressing.total)}°C`;
    el('dressing-parts').replaceChildren(...breakdownLines(dressing, session).map((line) => {
      const li = document.createElement('li');
      li.textContent = line;
      return li;
    }));

    // Temperature, cloud and daylight at the start; gusts and rain from the worst hour of the session
    const weather = {
      temperature: w.start.temperature,
      cloudCover: w.start.cloudCover,
      isDay: w.start.isDay,
      gusts: w.worstGusts,
      rainChance: w.worstRainChance,
    };
    const { items } = window.Clothing.recommend({
      activity: session.activity, dressingTemp: dressing.total, weather, rules: state.rules,
    });
    // One card each, e.g. "Long sleeve + Gilet"
    for (const [id, area] of [['kit-upper', 'Upper body'], ['kit-lower', 'Lower body'], ['kit-accessories', 'Accessories']]) {
      const names = items.filter((i) => i.area === area).map((i) => i.item);
      el(id).textContent = names.length ? names.join(' + ') : 'None needed';
    }

    // Notes, only the ones that apply
    const notes = [];
    if (window.Clothing.startsChilly({ activity: session.activity, dressing, weather, rules: state.rules })) {
      notes.push({ kind: 'temperature', text: 'You\'ll start a little chilly, but you\'ll warm up as you go.' });
    }
    notes.push(...window.Weather.notes(w, session.time));
    el('notes').replaceChildren(...notes.map(({ kind, text }) => {
      const li = document.createElement('li');
      li.append(noteIcon(kind), document.createTextNode(text));
      return li;
    }));
    el('notes').hidden = !notes.length;
    el('results').hidden = false;

    // Remember this outfit, so you can come back and rate it once the session has finished
    rated = { place, dressing };
    const id = sessionId(session);
    if (!state.ratings.some((r) => r.id === id)) {
      const outfit = { id, session: savedSession(session), weather: w, place };
      state.outfits = [outfit, ...state.outfits.filter((o) => o.id !== id)].slice(0, KEEP_OUTFITS);
      save();
    }
    showFeedback();
  }

  // "How did the outfit feel?" Only asked once the session has finished, and only once per session.
  function showFeedback() {
    const session = state.session;
    if (!session || !rated || el('results').hidden) return;
    el('feedback').hidden = false;
    const id = sessionId(session);
    const rating = state.ratings.find((r) => r.id === id);
    const finish = finishTime(session);
    const finished = finish.getTime() <= Date.now();
    el('feedback-buttons').hidden = Boolean(rating) || !finished;
    el('feedback-wait').hidden = Boolean(rating) || finished;
    el('feedback-wait').textContent = `You can rate it once you've finished, from ${whenText(finish)}.`;
    el('feedback-thanks').hidden = !rating;
    if (rating) el('feedback-thanks').textContent = thanksText(rating, justRated === id);
  }

  // What a rating did, in plain words
  function thanksText(rating, justNow) {
    if (!justNow) return `You rated this outfit ${RATINGS[rating.rating]}.`;
    const kind = rating.activity === 'cycling' ? 'rides' : 'runs';
    if (rating.rating === 'perfect') return `Thanks! Your ${kind} will keep dressing you the same way.`;
    if (rating.learnedAfter === rating.learnedBefore) {
      return `Thanks! That's saved, but your ${kind} are already as far as it goes (${signed(rating.learnedAfter)}).`;
    }
    const way = rating.rating === 'hot' ? 'lighter' : 'warmer';
    return `Thanks! Future ${kind} will dress you 0.5° ${way}.`;
  }

  // Too hot / Perfect / Too cold: moves the learned offset and saves the rating with its forecast
  function rate(rating) {
    const session = state.session;
    const id = sessionId(session);
    if (!rated || state.ratings.some((r) => r.id === id)) return;
    const before = state.offsets[session.activity];
    const after = window.Clothing.learnFrom(before, rating);
    state.offsets[session.activity] = after;
    state.ratings.push({
      id,
      rating,
      ratedAt: new Date().toISOString(),
      activity: session.activity,
      start: session.startText,
      distance: session.distance,
      duration: session.duration,
      effort: session.effort,
      warmth: state.profile ? state.profile.warmth : 'neutral',
      place: rated.place,
      dressingTemp: rated.dressing.total,
      rules: state.rules[session.activity],
      forecast: state.weather,
      learnedBefore: before,
      learnedAfter: after,
    });
    state.outfits = state.outfits.filter((o) => o.id !== id);
    save();
    justRated = id;
    showFeedback();
    el('feedback-thanks').focus();
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

  // ---- Settings ----

  const RULE_ACTIVITIES = ['running', 'cycling'];
  // The rule row that's open to change, e.g. { activity: 'running', row: 1 }, or null
  let openRule = null;

  // "16°C and above", "11 to 15°C", "5°C and below", "Below 4°C"
  const andAbove = (n) => `${wholeDegrees(n)}°C and above`;
  const andBelow = (n) => `${wholeDegrees(n)}°C and below`;
  const below = (n) => `Below ${wholeDegrees(n)}°C`;
  const fromTo = (low, high) => (low === high ? `${wholeDegrees(low)}°C` : `${wholeDegrees(low)} to ${wholeDegrees(high)}°C`);

  // Each row of the rules of thumb: the item, which rule it changes, and how it reads
  const RULE_ROWS = {
    running: [
      { item: 'Vest', key: 'vest', text: (r) => andAbove(r.vest) },
      { item: 'T-shirt', key: 'tshirt', text: (r) => fromTo(r.tshirt, r.vest - 1) },
      { item: 'Long sleeve', key: 'longSleeve', text: (r) => fromTo(r.longSleeve, r.tshirt - 1) },
      { item: 'Long sleeve + gilet', key: 'longSleeve', text: (r) => andBelow(r.longSleeve - 1) },
      { item: 'Shorts', key: 'shorts', text: (r) => andAbove(r.shorts) },
      { item: 'Headband', key: 'headband', text: (r) => fromTo(r.hat, r.headband) },
      { item: 'Hat', key: 'hat', text: (r) => below(r.hat) },
      { item: 'Gloves', key: 'gloves', text: (r) => below(r.gloves) },
    ],
    cycling: [
      { item: 'Short sleeve', key: 'shortSleeve', text: (r) => andAbove(r.shortSleeve) },
      { item: 'Short sleeve + base layer', key: 'baseLayer', text: (r) => fromTo(r.baseLayer, r.shortSleeve - 1) },
      { item: 'Long sleeve + base layer', key: 'longSleeve', text: (r) => fromTo(r.longSleeve, r.baseLayer - 1) },
      { item: 'Long sleeve + gilet', key: 'longSleeve', text: (r) => andBelow(r.longSleeve - 1) },
      { item: 'Shorts', key: 'shorts', text: (r) => andAbove(r.shorts) },
      { item: 'Buff', key: 'buff', text: (r) => below(r.buff) },
      { item: 'Gloves', key: 'gloves', text: (r) => below(r.gloves) },
    ],
  };

  // The cog on Plan a session opens Settings, as a step in the browser history so swiping back works
  function openSettings() {
    history.pushState({ screen: 'settings' }, '');
    showSettings();
    el('settings-heading').focus();
  }

  function showSettings() {
    el('settings-name').value = state.profile ? state.profile.name : '';
    el('settings-name-error').hidden = true;
    el('settings-name').removeAttribute('aria-invalid');
    for (const input of document.querySelectorAll('input[name="settings-warmth"]')) {
      input.checked = input.value === (state.profile ? state.profile.warmth : 'neutral');
    }
    openRule = null;
    showLearned();
    showRules();
    showScreen('settings');
  }

  // Name: saved as you type; an empty name isn't saved, and the old one comes back
  function nameTyped() {
    const name = el('settings-name').value.trim();
    if (!name || !state.profile) return;
    state.profile.name = name;
    el('settings-name-error').hidden = true;
    el('settings-name').removeAttribute('aria-invalid');
    save();
    showGreeting();
  }

  function nameDone() {
    if (el('settings-name').value.trim() || !state.profile) return;
    el('settings-name').value = state.profile.name;
    el('settings-name-error').hidden = false;
  }

  // A learned offset as e.g. "+1.5°C", "−0.5°C" or "0.0°C"
  function offsetText(n) {
    const sign = n > 0 ? '+' : n < 0 ? '−' : '';
    return `${sign}${Math.abs(n).toFixed(1)}°C`;
  }

  // What the app has learned, in plain words, with a Reset for each activity
  function showLearned() {
    el('learned').replaceChildren(...RULE_ACTIVITIES.map((activity) => {
      const offset = state.offsets[activity];
      const name = activity === 'cycling' ? 'Cycling' : 'Running';
      const verb = activity === 'cycling' ? 'ride' : 'run';
      const row = document.createElement('div');
      row.className = 'learned-row';
      const text = document.createElement('div');
      const title = document.createElement('strong');
      const value = document.createElement('span');
      value.className = 'offset';
      value.textContent = offsetText(offset);
      title.append(`${name} · `, value);
      const words = document.createElement('small');
      words.textContent = offset === 0
        ? 'No adjustment yet'
        : `You ${verb} about ${Math.abs(offset)} °C ${offset > 0 ? 'warmer' : 'cooler'} than average`;
      text.append(title, words);
      const reset = document.createElement('button');
      reset.type = 'button';
      reset.className = 'button';
      reset.textContent = 'Reset';
      reset.setAttribute('aria-label', `Reset ${activity} to 0`);
      reset.id = `reset-${activity}`;
      reset.addEventListener('click', () => {
        state.offsets[activity] = 0;
        save();
        showLearned();
        el(`reset-${activity}`).focus();
      });
      row.append(text, reset);
      return row;
    }));
  }

  // Your rules of thumb for the chosen tab, one row per item. Tapping a row shows its − and +.
  function showRules() {
    const activity = checkedValue('rules-activity') || 'running';
    const rules = state.rules[activity];
    el('rules').replaceChildren(...RULE_ROWS[activity].map((row, i) => {
      const li = document.createElement('li');
      const open = openRule && openRule.activity === activity && openRule.row === i;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'rule-button';
      button.id = `rule-${i}`;
      button.setAttribute('aria-expanded', String(Boolean(open)));
      const item = document.createElement('span');
      item.textContent = row.item;
      const value = document.createElement('span');
      value.textContent = row.text(rules);
      button.append(item, value);
      button.addEventListener('click', () => {
        openRule = open ? null : { activity, row: i };
        showRules();
        el(`rule-${i}`).focus();
      });
      li.append(button);
      if (open) li.append(ruleEditor(activity, row, i));
      return li;
    }));
    // Starting rules already? Then there's nothing to go back to
    const starting = window.Clothing.DEFAULT_RULES[activity];
    el('reset-rules').disabled = Object.keys(starting).every((k) => starting[k] === rules[k]);
  }

  // The − and + under an open rule: 1 °C at a time, greyed out where the rules would go out of order
  function ruleEditor(activity, row, i) {
    const editor = document.createElement('div');
    editor.className = 'rule-editor';
    editor.setAttribute('role', 'group');
    editor.setAttribute('aria-label', `Change ${row.item}`);
    for (const [step, sign, words, id] of [[-1, '−', 'colder', 'rule-down'], [1, '+', 'warmer', 'rule-up']]) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'step-button';
      button.id = id;
      button.textContent = sign;
      button.setAttribute('aria-label', `${row.item} 1° ${words}`);
      const changed = window.Clothing.changeRule(state.rules, activity, row.key, step);
      button.disabled = !changed;
      button.addEventListener('click', () => {
        if (!changed) return;
        state.rules = changed;
        save();
        showRules();
        // Keep your place: stay on the same button, or the row if that button is now greyed out
        const again = el(id);
        (again && !again.disabled ? again : el(`rule-${i}`)).focus();
      });
      editor.append(button);
    }
    return editor;
  }

  function initSettings() {
    el('open-settings').addEventListener('click', openSettings);
    el('settings-back').addEventListener('click', () => history.back());
    el('settings-name').addEventListener('input', nameTyped);
    el('settings-name').addEventListener('change', nameDone);
    for (const input of document.querySelectorAll('input[name="settings-warmth"]')) {
      input.addEventListener('change', () => {
        if (!state.profile) return;
        state.profile.warmth = input.value;
        save();
      });
    }
    for (const input of document.querySelectorAll('input[name="rules-activity"]')) {
      input.addEventListener('change', () => {
        openRule = null;
        showRules();
      });
    }
    el('reset-rules').addEventListener('click', () => {
      const activity = checkedValue('rules-activity') || 'running';
      state.rules = { ...state.rules, [activity]: { ...window.Clothing.DEFAULT_RULES[activity] } };
      openRule = null;
      save();
      showRules();
      el('rule-0').focus();
    });
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
    initSettings();
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
    // Coming back to the app also checks whether a session has finished and can be rated
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) return;
      showDays();
      showFeedback();
      if (!el('plan-screen').hidden) showLastSession();
    });
    // If Your outfit is left open, the feedback buttons appear once the session has finished
    setInterval(showFeedback, 30 * 1000);
    for (const [id, rating] of [['rate-hot', 'hot'], ['rate-perfect', 'perfect'], ['rate-cold', 'cold']]) {
      el(id).addEventListener('click', () => rate(rating));
    }
    el('rate-last').addEventListener('click', reopenLast);
    el('skip-last').addEventListener('click', forgetLast);
    el('distance').addEventListener('input', fillDuration);
    el('distance-down').addEventListener('click', () => stepDistance(-1));
    el('distance-up').addEventListener('click', () => stepDistance(1));
    el('duration').addEventListener('input', () => {
      // Emptying the box hands the duration back to the distance next time it changes
      durationTyped = el('duration').value !== '';
    });
    // Tapping anywhere in the distance or duration box (even on "km" or "min") puts the cursor in it
    for (const box of document.querySelectorAll('.unit-input')) {
      box.addEventListener('click', (event) => {
        if (event.target.tagName !== 'INPUT') box.querySelector('input').focus();
      });
    }
    el('plan-screen').addEventListener('input', clearFixedErrors);
    el('plan-screen').addEventListener('change', clearFixedErrors);

    el('what-to-wear').addEventListener('click', openOutfit);
    // The back arrow does the same as the browser's back, so both end up in the same place
    el('back').addEventListener('click', () => history.back());
    window.addEventListener('popstate', (event) => {
      const screen = event.state && event.state.screen;
      if (screen === 'settings') showSettings();
      else showScreen(screen === 'outfit' ? 'outfit' : 'plan');
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
