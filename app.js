// Runs the page: finds your location, fetches the weather and shows what to wear.
(function () {
  const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast';
  const PLACES_URL = 'https://geocoding-api.open-meteo.com/v1/search';
  const STORAGE_KEY = 'what-to-wear';

  // Weather codes from Open-Meteo, in plain English
  const WEATHER_TEXT = {
    0: 'Clear sky', 1: 'Mostly clear', 2: 'Partly cloudy', 3: 'Overcast',
    45: 'Fog', 48: 'Freezing fog',
    51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle', 56: 'Freezing drizzle', 57: 'Freezing drizzle',
    61: 'Light rain', 63: 'Rain', 65: 'Heavy rain', 66: 'Freezing rain', 67: 'Freezing rain',
    71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 77: 'Snow grains',
    80: 'Light showers', 81: 'Showers', 82: 'Heavy showers', 85: 'Snow showers', 86: 'Heavy snow showers',
    95: 'Thunderstorm', 96: 'Thunderstorm with hail', 99: 'Thunderstorm with hail',
  };

  const el = (id) => document.getElementById(id);
  const state = { activity: 'running', preference: 'normal', location: null, weather: null };

  // Remember choices on this device. Wrapped in try/catch because private browsing can block storage.
  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
      if (saved.activity === 'running' || saved.activity === 'cycling') state.activity = saved.activity;
      if (['cold', 'normal', 'warm'].includes(saved.preference)) state.preference = saved.preference;
      if (saved.location && typeof saved.location.latitude === 'number') state.location = saved.location;
    } catch (e) { /* start with defaults */ }
  }

  function save() {
    try {
      // Only remember a place you searched for; your current location is looked up fresh each time
      const location = state.location && state.location.source === 'search' ? state.location : null;
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        activity: state.activity, preference: state.preference, location,
      }));
    } catch (e) { /* not remembered, but the page still works */ }
  }

  function setStatus(message) {
    el('status').textContent = message;
    el('status').hidden = !message;
  }

  function showSearch(show) {
    el('search').hidden = !show;
    el('change-location').setAttribute('aria-expanded', String(show));
    if (show) el('place').focus();
  }

  function useDeviceLocation() {
    if (!navigator.geolocation) {
      el('location-name').textContent = 'No location set';
      setStatus('Your browser can\'t share your location. Search for a town instead.');
      showSearch(true);
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
      () => {
        el('location-name').textContent = 'No location set';
        setStatus('We couldn\'t get your location. Search for a town instead.');
        showSearch(true);
      },
      { timeout: 10000, maximumAge: 10 * 60 * 1000 }
    );
  }

  function setLocation(location) {
    state.location = location;
    save();
    el('location-name').textContent = location.name;
    showSearch(false);
    fetchWeather();
  }

  async function fetchWeather() {
    const { latitude, longitude } = state.location;
    const params = new URLSearchParams({
      latitude, longitude,
      current: 'temperature_2m,apparent_temperature,weather_code,wind_speed_10m,is_day',
      hourly: 'precipitation_probability',
      forecast_hours: '3',
      wind_speed_unit: 'kmh',
      timezone: 'auto',
    });
    el('results').hidden = true;
    setStatus('Checking the weather…');
    try {
      const response = await fetch(`${WEATHER_URL}?${params}`);
      if (!response.ok) throw new Error(`Weather request failed: ${response.status}`);
      const data = await response.json();
      const rainChances = (data.hourly && data.hourly.precipitation_probability) || [];
      state.weather = {
        temperature: data.current.temperature_2m,
        feelsLike: data.current.apparent_temperature,
        windSpeed: data.current.wind_speed_10m,
        rainChance: Math.max(0, ...rainChances.filter((n) => typeof n === 'number')),
        isDay: data.current.is_day === 1,
        sunny: data.current.weather_code <= 1,
        description: WEATHER_TEXT[data.current.weather_code] || '',
      };
      setStatus('');
      render();
    } catch (e) {
      state.weather = null;
      setStatus('Couldn\'t get the weather right now. Check your connection and try again.');
    }
  }

  function render() {
    if (!state.weather) return;
    const w = state.weather;
    el('temperature').textContent = `${Math.round(w.temperature)}°C`;
    el('conditions').textContent = [
      w.description,
      `Feels like ${Math.round(w.feelsLike)}°C`,
      `Wind ${Math.round(w.windSpeed)} km/h`,
      `Rain chance ${Math.round(w.rainChance)}%`,
    ].filter(Boolean).join(' · ');

    const { items } = window.Clothing.recommend({
      activity: state.activity, preference: state.preference, weather: w,
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
    el('kit-heading').textContent = state.activity === 'cycling' ? 'Wear for your ride' : 'Wear for your run';
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
    for (const name of ['activity', 'preference']) {
      for (const input of document.querySelectorAll(`input[name="${name}"]`)) {
        input.checked = input.value === state[name];
        input.addEventListener('change', () => {
          state[name] = input.value;
          save();
          render();
        });
      }
    }

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
