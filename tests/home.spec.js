// Checks that the page looks and behaves the way it should.
// The weather and place-search services are replaced with sample answers,
// so the checks don't depend on today's real weather or an internet connection.
const { test, expect } = require('@playwright/test');

const LONDON = { latitude: 51.5, longitude: -0.12 };

const CENTRAL_LONDON = { latitude: '51.5074', longitude: '-0.1278' };

// A sample hourly forecast, like Open-Meteo's, covering every day the checks might pick.
// Every hour is cool, dry and cloudy (10°C, feels like 8°C), light from 07:00 to 17:00,
// unless change(time) returns different values for that hour, e.g. { precipitation_probability: 60 }.
function hourlyForecast(change = () => ({})) {
  const hourly = {
    time: [], temperature_2m: [], apparent_temperature: [], wind_speed_10m: [], wind_gusts_10m: [],
    precipitation_probability: [], cloud_cover: [], is_day: [], relative_humidity_2m: [],
  };
  const first = Date.UTC(2026, 9, 25);
  const last = Date.now() + 10 * 24 * 60 * 60 * 1000;
  for (let t = first; t < last; t += 60 * 60 * 1000) {
    const time = new Date(t).toISOString().slice(0, 16);
    const hour = new Date(t).getUTCHours();
    const values = {
      temperature_2m: 10.2,
      apparent_temperature: 8.1,
      wind_speed_10m: 12,
      wind_gusts_10m: 25,
      precipitation_probability: 10,
      cloud_cover: 80,
      is_day: hour >= 7 && hour <= 17 ? 1 : 0,
      relative_humidity_2m: 82,
      ...change(time),
    };
    hourly.time.push(time);
    for (const [field, value] of Object.entries(values)) hourly[field].push(value);
  }
  return { hourly };
}

const sampleWeather = hourlyForecast();

const samplePlaces = {
  results: [
    { name: 'Málaga', admin1: 'Andalusia', country: 'Spain', latitude: 36.72, longitude: -4.42 },
    { name: 'Malaga', admin1: 'Western Australia', country: 'Australia', latitude: -31.85, longitude: 115.89 },
  ],
};

async function mockServices(page, { weather = sampleWeather, places = samplePlaces } = {}) {
  const requests = [];
  await page.route('https://api.open-meteo.com/**', (route) => {
    requests.push(new URL(route.request().url()));
    return weather ? route.fulfill({ json: weather }) : route.fulfill({ status: 500, body: '' });
  });
  await page.route('https://geocoding-api.open-meteo.com/**', (route) => route.fulfill({ json: places }));
  return requests;
}

// Pretends Getting to know you was filled in earlier, so the page opens on Plan a session.
// Only fills it in when nothing is saved yet, so later saves survive a reload.
async function withProfile(page, profile = { name: 'Bradley', warmth: 'neutral' }) {
  await page.addInitScript((saved) => {
    if (!localStorage.getItem('what-to-wear')) {
      localStorage.setItem('what-to-wear', JSON.stringify({ profile: saved }));
    }
  }, profile);
}

// Fills in the session: today, 07:00, 8 km, Easy (unless told otherwise)
async function fillSession(page, { day, time = '07:00', distance = '8', duration, effort = 'Easy' } = {}) {
  if (day) await page.getByRole('radio', { name: day }).check({ force: true });
  else await page.locator('#days label').first().click();
  await page.getByLabel('Start time').fill(time);
  await page.getByRole('spinbutton', { name: 'Distance' }).fill(distance);
  if (duration) await page.getByRole('spinbutton', { name: 'Duration' }).fill(duration);
  await page.locator('.efforts').getByText(effort, { exact: true }).click();
}

// Fills in the session, then taps "What should I wear?" to go from Plan a session to Your outfit
async function openOutfit(page, session) {
  await fillSession(page, session);
  await page.getByRole('button', { name: 'What should I wear?' }).click();
  await expect(page.locator('#outfit-screen')).toBeVisible();
}

test.describe('with location allowed', () => {
  test.use({ geolocation: LONDON, permissions: ['geolocation'], timezoneId: 'Europe/London' });
  test.beforeEach(async ({ page }, testInfo) => {
    if (!testInfo.title.startsWith('first launch')) await withProfile(page);
  });

  test('page has the right title in the browser tab', async ({ page }) => {
    await mockServices(page);
    await page.goto('/');
    await expect(page).toHaveTitle('What to wear');
    await expect(page.getByRole('heading', { level: 1 })).toHaveAccessibleName('What to wear');
  });

  test('uses your current location and shows the six readings', async ({ page }) => {
    const requests = await mockServices(page);
    await page.goto('/');
    await expect(page.locator('#location-name')).toHaveText('Your current location');
    // The forecast is fetched once the session is planned, not before
    expect(requests).toHaveLength(0);
    await openOutfit(page);
    await expect(page.locator('.readings > div')).toHaveText([
      'Temp10°C', 'Wind km/h12 · gust 25', 'Rain10%', 'SkyCloudy', 'Humidity82%', 'LightDaylight',
    ]);
    await expect(page.locator('#place-note')).toHaveText('Forecast for where you are now.');
    expect(requests).toHaveLength(1);
    expect(requests[0].searchParams.get('latitude')).toBe('51.5');
    expect(requests[0].searchParams.get('longitude')).toBe('-0.12');
  });

  test('asks Open-Meteo for the hourly forecast with all eight measures, in km/h', async ({ page }) => {
    const requests = await mockServices(page);
    await page.goto('/');
    await openOutfit(page);
    await expect.poll(() => requests.length).toBe(1);
    const params = requests[0].searchParams;
    expect(params.get('hourly').split(',').sort()).toEqual([
      'apparent_temperature', 'cloud_cover', 'is_day', 'precipitation_probability',
      'relative_humidity_2m', 'temperature_2m', 'wind_gusts_10m', 'wind_speed_10m',
    ]);
    expect(params.get('current')).toBeNull();
    expect(params.get('wind_speed_unit')).toBe('kmh');
    expect(params.get('timezone')).toBe('auto');
    expect(params.get('forecast_days')).toBe('7');
  });

  test('reads the forecast for the chosen day and the hour nearest the start time', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-10-28T07:00:00Z'));
    // Only Friday at 18:00 is warm, sunny-but-dark and windy; everything else is the usual cool and cloudy
    await mockServices(page, {
      weather: hourlyForecast((time) => (time === '2026-10-30T18:00' ? {
        temperature_2m: 14.6, wind_speed_10m: 20.4, wind_gusts_10m: 41, precipitation_probability: 35,
        cloud_cover: 20, is_day: 0, relative_humidity_2m: 64,
      } : {})),
    });
    await page.goto('/');
    await openOutfit(page, { day: 'Friday 30 October', time: '17:45' });
    await expect(page.locator('.readings > div')).toHaveText([
      'Temp15°C', 'Wind km/h20 · gust 41', 'Rain35%', 'SkyClear', 'Humidity64%', 'LightDark',
    ]);

    // 17:29 is nearer 17:00, which is the usual weather
    await page.goBack();
    await page.getByLabel('Start time').fill('17:29');
    await page.getByRole('button', { name: 'What should I wear?' }).click();
    await expect(page.locator('#reading-temperature')).toHaveText('10°C');
    await expect(page.locator('#reading-light')).toHaveText('Daylight');
  });

  test('shows sunny skies when cloud cover is 30% or less in daylight', async ({ page }) => {
    await mockServices(page, { weather: hourlyForecast(() => ({ cloud_cover: 30 })) });
    await page.goto('/');
    await openOutfit(page);
    await expect(page.locator('#reading-sky')).toHaveText('Sunny');
  });

  test('rain during a ride uses the worst hour, from start to finish', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-10-28T06:00:00Z'));
    // Rain is likely at 08:00 only
    await mockServices(page, {
      weather: hourlyForecast((time) => (time === '2026-10-28T08:00' ? { precipitation_probability: 60 } : {})),
    });
    await page.goto('/');
    await page.getByText('Cycling').click();
    // 07:00 for 48 minutes ends nearest 08:00, so the rain counts
    await openOutfit(page, { duration: '48' });
    await expect(page.locator('#reading-rain')).toHaveText('10%');
    await expect(page.locator('#kit')).toContainText('Waterproof jacket');

    // 07:00 for 20 minutes is over well before 08:00
    await page.goBack();
    await page.getByRole('spinbutton', { name: 'Duration' }).fill('20');
    await page.getByRole('button', { name: 'What should I wear?' }).click();
    await expect(page.locator('#kit li').first()).toBeVisible();
    await expect(page.locator('#kit')).not.toContainText('Waterproof');
  });

  test('rain doesn\'t change the kit for a run', async ({ page }) => {
    await mockServices(page, { weather: hourlyForecast(() => ({ precipitation_probability: 90 })) });
    await page.goto('/');
    await openOutfit(page);
    await expect(page.locator('#kit li')).toHaveText(['Upper bodyLong sleeve', 'Lower bodyShorts']);
  });

  test('gusts during the run add a gilet', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-10-28T06:00:00Z'));
    // Gusty at 08:00 only; the 8 km run (48 minutes) ends nearest 08:00
    await mockServices(page, {
      weather: hourlyForecast((time) => (time === '2026-10-28T08:00' ? { wind_gusts_10m: 40 } : {})),
    });
    await page.goto('/');
    await openOutfit(page);
    await expect(page.locator('#kit li')).toHaveText(['Upper bodyLong sleeve', 'Upper bodyGilet', 'Lower bodyShorts']);
  });

  test('sunny, warm daytime: sun cream and sunglasses', async ({ page }) => {
    await mockServices(page, {
      weather: hourlyForecast(() => ({ temperature_2m: 20, apparent_temperature: 20, cloud_cover: 10 })),
    });
    await page.goto('/');
    await openOutfit(page, { time: '12:00' });
    await expect(page.locator('#kit')).toContainText('AccessoriesSun cream');
    await expect(page.locator('#kit')).toContainText('AccessoriesSunglasses');
  });

  test('says so plainly when the forecast doesn\'t cover the chosen time', async ({ page }) => {
    await mockServices(page, { weather: { hourly: { time: [] } } });
    await page.goto('/');
    await openOutfit(page);
    await expect(page.locator('#weather-status')).toHaveText(
      'There\'s no forecast for that day and time yet. Try again later.'
    );
    await expect(page.locator('#results')).toBeHidden();
  });

  test('shows the dressing temperature and how it was worked out', async ({ page }) => {
    await mockServices(page);
    await page.goto('/');
    // Easy 8 km run, feels like 8.1 °C, neutral: 8.1 + 0 + 2 + 0 + 0 = 10.1, shown as 10
    await openOutfit(page);
    await expect(page.locator('#dressing-temp')).toHaveText('10°C');
    await expect(page.getByText('Dressing for')).toBeVisible();
    await expect(page.locator('#dressing-parts li')).toHaveText([
      'Feels like 8°',
      '+2° for 8 km',
      'Easy +0° · Neutral +0°',
      'Learned +0°',
    ]);
  });

  test('cycling takes off 4 °C, and effort and distance add on', async ({ page }) => {
    await mockServices(page);
    await page.goto('/');
    await page.getByText('Cycling').click();
    // Hard 25 km ride: 8.1 + 4 + 2 + 0 + 0 − 4 = 10.1, shown as 10
    await openOutfit(page, { distance: '25', effort: 'Hard' });
    await expect(page.locator('#dressing-temp')).toHaveText('10°C');
    await expect(page.locator('#dressing-parts li')).toHaveText([
      'Feels like 8°',
      '+2° for 25 km',
      'Hard +4° · Neutral +0°',
      'Learned +0° · Bike chill −4°',
    ]);
  });

  test('below freezing shows a minus sign', async ({ page }) => {
    await mockServices(page, { weather: hourlyForecast(() => ({ apparent_temperature: -3.4 })) });
    await page.goto('/');
    // Easy 2 km run: −3.4 + 0 + 0 = −3.4, shown as −3
    await openOutfit(page, { distance: '2' });
    await expect(page.locator('#dressing-temp')).toHaveText('−3°C');
    await expect(page.locator('#dressing-parts li').first()).toHaveText('Feels like −3°');
  });

  test('shows running kit by default', async ({ page }) => {
    await mockServices(page);
    await page.goto('/');
    await openOutfit(page);
    await expect(page.getByRole('heading', { name: 'Your outfit' })).toBeVisible();
    await expect(page.locator('#summary')).toContainText('run');
    // Easy 8 km run, dressing for 10 °C
    await expect(page.locator('#kit li')).toHaveText([
      'Upper bodyLong sleeve',
      'Lower bodyShorts',
    ]);
  });

  test('switching to cycling changes the kit', async ({ page }) => {
    await mockServices(page);
    await page.goto('/');
    await page.getByText('Cycling').click();
    await openOutfit(page);
    await expect(page.locator('#summary')).toContainText('ride');
    // Easy 8 km ride, dressing for 5 °C after the bike chill
    await expect(page.locator('#kit li')).toHaveText([
      'Upper bodyLong sleeve',
      'Upper bodyGilet',
      'Lower bodyTights',
      'AccessoriesBuff',
      'AccessoriesGloves',
    ]);
  });

  test('remembers your choices next time', async ({ page }) => {
    await mockServices(page);
    await page.goto('/');
    await page.getByText('Cycling').click();
    await page.reload();
    await expect(page.getByRole('radio', { name: 'Cycling' })).toBeChecked();
    await expect(page.getByText('Hello Bradley!')).toBeVisible();
  });

  test('first launch: opens on Getting to know you', async ({ page }) => {
    await mockServices(page);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Getting to know you' })).toBeVisible();
    await expect(page.getByText('Three quick questions so every recommendation fits you.')).toBeVisible();
    await expect(page.getByRole('img', { name: 'What to wear' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Your name' })).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Neutral' })).toBeChecked();
    await expect(page.getByRole('radio', { name: 'Runs hot' })).not.toBeChecked();
    await expect(page.getByRole('radio', { name: 'Runs cold' })).not.toBeChecked();
    await expect(page.getByText('Runs hot dresses you 2 °C lighter; runs cold, 2 °C warmer.')).toBeVisible();
    await expect(page.locator('.units')).toHaveText(/Temperature\s*°C\s*Wind\s*km\/h\s*Distance\s*km/);
    await expect(page.locator('#plan-screen')).toBeHidden();
    await expect(page.locator('#outfit-screen')).toBeHidden();
  });

  test('first launch: "Let\'s go" needs a name', async ({ page }) => {
    await mockServices(page);
    await page.goto('/');
    await page.getByRole('textbox', { name: 'Your name' }).fill('   ');
    await page.getByRole('button', { name: 'Let\'s go' }).click();
    await expect(page.getByText('Please tell us your name.')).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Your name' })).toBeFocused();
    await expect(page.locator('#plan-screen')).toBeHidden();
  });

  test('first launch: "Let\'s go" says hello, and the profile survives closing the app', async ({ page }) => {
    await mockServices(page);
    await page.goto('/');
    await page.getByRole('textbox', { name: 'Your name' }).fill(' Bradley ');
    await page.getByText('Runs cold', { exact: true }).click();
    await page.getByRole('button', { name: 'Let\'s go' }).click();
    await expect(page.getByRole('heading', { name: 'Plan a session' })).toBeVisible();
    await expect(page.locator('#greeting')).toHaveText('Hello Bradley!');
    await expect(page.locator('#profile-screen')).toBeHidden();

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Plan a session' })).toBeVisible();
    await expect(page.locator('#greeting')).toHaveText('Hello Bradley!');
    await expect(page.locator('#profile-screen')).toBeHidden();
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('what-to-wear')).profile);
    expect(saved).toEqual({ name: 'Bradley', warmth: 'cold' });
  });

  test('first launch: the name box and buttons are big enough to tap', async ({ page }) => {
    await mockServices(page);
    await page.goto('/');
    for (const target of [
      page.getByRole('textbox', { name: 'Your name' }),
      page.getByRole('button', { name: 'Let\'s go' }),
      page.locator('input[value="hot"] + span'),
    ]) {
      const box = await target.boundingBox();
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(page.viewportSize().width);
  });

  test('first launch: the name box doesn\'t autocorrect your name', async ({ page }) => {
    await mockServices(page);
    await page.goto('/');
    const name = page.getByRole('textbox', { name: 'Your name' });
    await expect(name).toHaveAttribute('autocorrect', 'off');
    await expect(name).toHaveAttribute('spellcheck', 'false');
  });

  test('"Change your details" lets you fix your name and run hot or cold', async ({ page }) => {
    await mockServices(page);
    await page.goto('/');
    await expect(page.locator('#greeting')).toHaveText('Hello Bradley!');
    const change = page.getByRole('button', { name: 'Change your details' });
    expect((await change.boundingBox()).height).toBeGreaterThanOrEqual(44);
    await change.click();

    // Opens Getting to know you with your current answers filled in
    const name = page.getByRole('textbox', { name: 'Your name' });
    await expect(name).toHaveValue('Bradley');
    await expect(page.getByRole('radio', { name: 'Neutral' })).toBeChecked();

    await name.fill('Brad');
    await page.getByText('Runs hot', { exact: true }).click();
    await page.getByRole('button', { name: 'Let\'s go' }).click();
    await expect(page.locator('#greeting')).toHaveText('Hello Brad!');

    await page.reload();
    await expect(page.locator('#greeting')).toHaveText('Hello Brad!');
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('what-to-wear')).profile);
    expect(saved).toEqual({ name: 'Brad', warmth: 'hot' });
  });

  test('first launch: a choice saved by the old version is ticked for you', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('what-to-wear', JSON.stringify({ activity: 'running', preference: 'warm' }));
    });
    await mockServices(page);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Getting to know you' })).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Runs hot' })).toBeChecked();
  });

  test('can change to another place, and go back to your location', async ({ page }) => {
    const requests = await mockServices(page);
    await page.goto('/');

    await page.getByRole('button', { name: 'Change', exact: true }).click();
    await page.getByRole('searchbox', { name: 'Town or city' }).fill('Malaga');
    await page.getByRole('button', { name: 'Search' }).click();
    await page.getByRole('button', { name: 'Málaga, Andalusia, Spain' }).click();

    await expect(page.locator('#location-name')).toHaveText('Málaga, Andalusia, Spain');
    await openOutfit(page);
    await expect(page.locator('#place-note')).toHaveText('Forecast for Málaga, Andalusia, Spain.');
    expect(requests.at(-1).searchParams.get('latitude')).toBe('36.72');

    // The holiday location is remembered after closing the page
    await page.reload();
    await expect(page.locator('#location-name')).toHaveText('Málaga, Andalusia, Spain');

    await page.getByRole('button', { name: 'Change', exact: true }).click();
    await page.getByRole('button', { name: 'Use my current location' }).click();
    await expect(page.locator('#location-name')).toHaveText('Your current location');
    await openOutfit(page);
    await expect(page.locator('#place-note')).toHaveText('Forecast for where you are now.');
    expect(requests.at(-1).searchParams.get('latitude')).toBe('51.5');
  });

  test('tells you when a place can\'t be found', async ({ page }) => {
    await mockServices(page, { places: {} });
    await page.goto('/');
    await page.getByRole('button', { name: 'Change', exact: true }).click();
    await page.getByRole('searchbox', { name: 'Town or city' }).fill('Nowhereville');
    await page.getByRole('button', { name: 'Search' }).click();
    await expect(page.locator('#status')).toHaveText(
      'No places found for "Nowhereville". Check the spelling and try again.'
    );
  });

  test('tells you when the weather can\'t be fetched', async ({ page }) => {
    await mockServices(page, { weather: null });
    await page.goto('/');
    await openOutfit(page);
    await expect(page.locator('#weather-status')).toHaveText(
      'Couldn\'t get the forecast right now. Check your connection and try again.'
    );
    await expect(page.locator('#results')).toBeHidden();
  });

  test('shows the logo and tagline', async ({ page }) => {
    await mockServices(page);
    await page.goto('/');
    const logo = page.getByRole('img', { name: 'What to wear' });
    await expect(logo).toBeVisible();
    // The picture really loaded, not just an empty box
    await expect.poll(() => logo.evaluate((img) => img.complete && img.naturalWidth)).toBeGreaterThan(0);
    await expect(page.getByText('Whatever the weather, get it right')).toBeVisible();
  });

  test('colours match the design', async ({ page }) => {
    await mockServices(page);
    await page.goto('/');
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(14, 14, 18)'); // #0E0E12
    await expect(page.locator('body')).toHaveCSS('color', 'rgb(244, 244, 246)'); // text #F4F4F6
    await expect(page.locator('.tagline')).toHaveCSS('color', 'rgb(166, 166, 176)'); // secondary #A6A6B0
    const change = page.getByRole('button', { name: 'Change', exact: true });
    await expect(change).toHaveCSS('color', 'rgb(196, 167, 255)'); // accent text #C4A7FF
    await expect(page.locator('input[value="running"] + span')).toHaveCSS('background-color', 'rgb(124, 58, 237)'); // selected #7C3AED
    await change.click();
    const box = page.getByRole('searchbox', { name: 'Town or city' });
    await expect(box).toHaveCSS('background-color', 'rgb(24, 24, 29)'); // inputs #18181D
    await expect(box).toHaveCSS('border-top-color', 'rgb(38, 38, 45)'); // borders #26262D
  });

  test('uses Calibri first, with Carlito as the fallback', async ({ page }) => {
    await mockServices(page);
    await page.goto('/');
    const fonts = await page.locator('body').evaluate((el) => getComputedStyle(el).fontFamily);
    expect(fonts.replace(/"/g, '')).toBe('Calibri, Carlito, sans-serif');
  });

  test('Carlito font is loaded', async ({ page }) => {
    await mockServices(page);
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    const loaded = await page.evaluate(() => document.fonts.check('700 16px Carlito'));
    expect(loaded).toBe(true);
  });

  test('page does not scroll sideways', async ({ page }) => {
    await mockServices(page);
    await page.goto('/');
    let scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(page.viewportSize().width);
    await openOutfit(page);
    await expect(page.locator('#kit li').first()).toBeVisible();
    // A long wind reading still fits
    await expect(page.locator('#reading-wind')).toBeVisible();
    scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(page.viewportSize().width);
  });

  test('day picker: today and the next 5 days, nothing later', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-10-28T07:00:00Z'));
    await mockServices(page);
    await page.goto('/');
    await expect(page.getByText('Day · up to 5 days ahead')).toBeVisible();
    await expect(page.locator('#days label')).toHaveText(['Wed28', 'Thu29', 'Fri30', 'Sat31', 'Sun1', 'Mon2']);
    await expect(page.getByRole('radio', { name: 'Today, Wednesday 28 October' })).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Monday 2 November' })).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Tuesday 3 November' })).toHaveCount(0);
    // No day is chosen until you pick one
    await expect(page.locator('input[name="day"]:checked')).toHaveCount(0);
  });

  test('the day picker moves on when the app is reopened the next day', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-10-28T23:00:00Z') });
    await mockServices(page);
    await page.goto('/');
    await page.getByRole('radio', { name: 'Friday 30 October' }).check({ force: true });
    await page.clock.fastForward('02:00:00');
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await expect(page.locator('#days label').first()).toHaveText('Thu29');
    await expect(page.locator('#days label')).toHaveCount(6);
    // Your choice is kept
    await expect(page.getByRole('radio', { name: 'Friday 30 October' })).toBeChecked();
  });

  test('"What should I wear?" only works once every input is filled in', async ({ page }) => {
    await mockServices(page);
    await page.goto('/');
    const wear = page.getByRole('button', { name: 'What should I wear?' });
    await wear.click();
    await expect(page.locator('#plan-screen')).toBeVisible();
    await expect(page.locator('#outfit-screen')).toBeHidden();
    await expect(page.locator('#session-error')).toHaveText(
      'Please add the day, start time, distance, duration and effort first.'
    );
    await expect(page.getByText('Choose a day.')).toBeVisible();
    await expect(page.getByText('Choose a start time.')).toBeVisible();
    await expect(page.getByText('Enter a distance in km.')).toBeVisible();
    await expect(page.getByText('Enter how long it will take, in minutes.')).toBeVisible();
    await expect(page.getByText('Choose an effort.')).toBeVisible();

    // Each message goes as soon as that input is filled in
    await page.locator('#days label').nth(1).click();
    await expect(page.getByText('Choose a day.')).toBeHidden();
    await page.getByLabel('Start time').fill('06:30');
    await expect(page.getByText('Choose a start time.')).toBeHidden();
    await page.getByRole('spinbutton', { name: 'Distance' }).fill('10');
    await expect(page.getByText('Enter a distance in km.')).toBeHidden();
    await expect(page.getByText('Enter how long it will take, in minutes.')).toBeHidden();

    // Still missing the effort
    await wear.click();
    await expect(page.locator('#session-error')).toHaveText('Please add the effort first.');
    await expect(page.locator('#outfit-screen')).toBeHidden();

    await page.locator('.efforts').getByText('Hard', { exact: true }).click();
    await expect(page.locator('#session-error')).toBeHidden();
    await wear.click();
    await expect(page.locator('#outfit-screen')).toBeVisible();
    await expect(page.locator('#summary')).toContainText('06:30 · Hard 10 km run');
  });

  test('a missing input is pointed out first', async ({ page }) => {
    await mockServices(page);
    await page.goto('/');
    await fillSession(page);
    await page.getByLabel('Start time').fill('');
    await page.getByRole('button', { name: 'What should I wear?' }).click();
    await expect(page.locator('#session-error')).toHaveText('Please add the start time first.');
    await expect(page.getByLabel('Start time')).toBeFocused();
    await expect(page.getByLabel('Start time')).toHaveAttribute('aria-invalid', 'true');
  });

  test('distance and duration must make sense', async ({ page }) => {
    await mockServices(page);
    await page.goto('/');
    await fillSession(page, { distance: '0' });
    await page.getByRole('button', { name: 'What should I wear?' }).click();
    await expect(page.locator('#session-error')).toHaveText('Please add the distance and duration first.');
    await page.getByRole('spinbutton', { name: 'Distance' }).fill('5');
    await page.getByRole('spinbutton', { name: 'Duration' }).fill('0');
    await page.getByRole('button', { name: 'What should I wear?' }).click();
    await expect(page.locator('#session-error')).toHaveText('Please add the duration first.');
    await expect(page.locator('#outfit-screen')).toBeHidden();
  });

  test('duration is worked out from the distance: running about 6 min/km', async ({ page }) => {
    await mockServices(page);
    await page.goto('/');
    const duration = page.getByRole('spinbutton', { name: 'Duration' });
    await expect(duration).toHaveValue('');
    await page.getByRole('spinbutton', { name: 'Distance' }).fill('8');
    await expect(duration).toHaveValue('48');
    await page.getByRole('spinbutton', { name: 'Distance' }).fill('5.5');
    await expect(duration).toHaveValue('33');
    await expect(page.getByText('Worked out from the distance. Change it if you like.')).toBeVisible();
  });

  test('duration is worked out from the distance: cycling about 25 km/h', async ({ page }) => {
    await mockServices(page);
    await page.goto('/');
    await page.getByText('Cycling').click();
    const duration = page.getByRole('spinbutton', { name: 'Duration' });
    await page.getByRole('spinbutton', { name: 'Distance' }).fill('25');
    await expect(duration).toHaveValue('60');
    await page.getByRole('spinbutton', { name: 'Distance' }).fill('30');
    await expect(duration).toHaveValue('72');
    // Switching to running works it out again
    await page.getByText('Running').click();
    await expect(duration).toHaveValue('180');
  });

  test('a duration you type yourself is kept', async ({ page }) => {
    await mockServices(page);
    await page.goto('/');
    const distance = page.getByRole('spinbutton', { name: 'Distance' });
    const duration = page.getByRole('spinbutton', { name: 'Duration' });
    await distance.fill('8');
    await duration.fill('55');
    await distance.fill('10');
    await page.getByText('Cycling').click();
    await expect(duration).toHaveValue('55');
    await fillSession(page, { distance: '10' });
    await page.getByRole('button', { name: 'What should I wear?' }).click();
    await expect(page.locator('#outfit-screen')).toBeVisible();
    // Emptying it hands it back to the distance
    await page.goBack();
    await duration.fill('');
    await distance.fill('12');
    await expect(duration).toHaveValue('29');
  });

  test('the − and + buttons change the distance by 1 km, never below 1 km', async ({ page }) => {
    await mockServices(page);
    await page.goto('/');
    const distance = page.getByRole('spinbutton', { name: 'Distance' });
    const more = page.getByRole('button', { name: '1 km more' });
    const less = page.getByRole('button', { name: '1 km less' });
    await more.click();
    await expect(distance).toHaveValue('1');
    await more.click();
    await more.click();
    await expect(distance).toHaveValue('3');
    await expect(page.getByRole('spinbutton', { name: 'Duration' })).toHaveValue('18');
    await distance.fill('1.5');
    await less.click();
    await expect(distance).toHaveValue('1');
    await less.click();
    await expect(distance).toHaveValue('1');
  });

  test('effort shows Easy, Medium and Hard with their heart rates', async ({ page }) => {
    await mockServices(page);
    await page.goto('/');
    await expect(page.getByText('Effort · average heart rate')).toBeVisible();
    await expect(page.locator('.efforts label')).toHaveText([
      'Easy110–140 bpm', 'Medium140–170 bpm', 'Hard170+ bpm',
    ]);
    await expect(page.locator('input[name="effort"]:checked')).toHaveCount(0);
    await page.locator('.efforts').getByText('Medium', { exact: true }).click();
    await expect(page.getByRole('radio', { name: /Medium/ })).toBeChecked();
    await expect(page.locator('input[value="medium"] + span')).toHaveCSS('border-top-color', 'rgb(196, 167, 255)');
  });

  test('summary line for a ride on a later day', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-10-28T07:00:00Z'));
    await mockServices(page);
    await page.goto('/');
    await page.getByText('Cycling').click();
    await page.getByRole('radio', { name: 'Saturday 31 October' }).check({ force: true });
    await page.getByLabel('Start time').fill('17:45');
    await page.getByRole('spinbutton', { name: 'Distance' }).fill('42.5');
    await page.locator('.efforts').getByText('Medium', { exact: true }).click();
    await page.getByRole('button', { name: 'What should I wear?' }).click();
    await expect(page.locator('#summary')).toHaveText('Sat 31 Oct · 17:45 · Medium 42.5 km ride');
  });

  test('Plan a session inputs are big enough to tap and fit the screen', async ({ page }) => {
    await mockServices(page);
    await page.goto('/');
    for (const target of [
      page.locator('#days label span').first(),
      page.getByLabel('Start time'),
      page.getByRole('button', { name: '1 km less' }),
      page.getByRole('button', { name: '1 km more' }),
      page.locator('.stepper .unit-input'),
      page.locator('.duration .unit-input'),
      page.locator('.efforts span').first(),
    ]) {
      const box = await target.boundingBox();
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.width).toBeGreaterThanOrEqual(44);
    }
    await page.getByRole('spinbutton', { name: 'Distance' }).fill('123.5');
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(page.viewportSize().width);
  });

  test('opens on Plan a session, with the outfit hidden', async ({ page }) => {
    await mockServices(page);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Plan a session' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'What should I wear?' })).toBeVisible();
    await expect(page.locator('#outfit-screen')).toBeHidden();
  });

  test('"What should I wear?" opens Your outfit, with the summary line', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-10-28T07:00:00Z'));
    await mockServices(page);
    await page.goto('/');
    await openOutfit(page);
    await expect(page.locator('#plan-screen')).toBeHidden();
    await expect(page.locator('#summary')).toHaveText('Wed 28 Oct · 07:00 · Easy 8 km run');
    await expect(page.locator('#kit li').first()).toBeVisible();
  });

  test('the back arrow returns to Plan a session, keeping your choices', async ({ page }) => {
    await mockServices(page);
    await page.goto('/');
    await page.getByText('Cycling').click();
    await openOutfit(page);
    await page.getByRole('button', { name: 'Back to plan a session' }).click();
    await expect(page.locator('#plan-screen')).toBeVisible();
    await expect(page.locator('#outfit-screen')).toBeHidden();
    await expect(page.getByRole('radio', { name: 'Cycling' })).toBeChecked();
  });

  test('the phone\'s back gesture also returns to Plan a session', async ({ page }) => {
    await mockServices(page);
    await page.goto('/');
    await openOutfit(page);
    await page.goBack();
    await expect(page.locator('#plan-screen')).toBeVisible();
    await expect(page.locator('#outfit-screen')).toBeHidden();
  });

  test('buttons on both screens are big enough to tap', async ({ page }) => {
    await mockServices(page);
    await page.goto('/');
    const wear = await page.getByRole('button', { name: 'What should I wear?' }).boundingBox();
    expect(wear.height).toBeGreaterThanOrEqual(44);
    await openOutfit(page);
    const back = await page.getByRole('button', { name: 'Back to plan a session' }).boundingBox();
    expect(back.height).toBeGreaterThanOrEqual(44);
    expect(back.width).toBeGreaterThanOrEqual(44);
  });
});

test.describe('runs cold profile', () => {
  test.use({ geolocation: LONDON, permissions: ['geolocation'], timezoneId: 'Europe/London' });

  test('runs cold dresses you 2 °C warmer, and says so', async ({ page }) => {
    await withProfile(page, { name: 'Bradley', warmth: 'cold' });
    await mockServices(page);
    await page.goto('/');
    // Medium 5 km run: 8.1 + 2 + 1 − 2 = 9.1, shown as 9
    await openOutfit(page, { distance: '5', effort: 'Medium' });
    await expect(page.locator('#dressing-temp')).toHaveText('9°C');
    await expect(page.locator('#dressing-parts li')).toHaveText([
      'Feels like 8°',
      '+1° for 5 km',
      'Medium +2° · Runs cold −2°',
      'Learned +0°',
    ]);
  });
});

test.describe('with location blocked', () => {
  test.use({ timezoneId: 'Europe/London' });

  test('uses central London and says so', async ({ page }) => {
    await withProfile(page);
    await page.addInitScript(() => {
      navigator.geolocation.getCurrentPosition = (success, error) => error({ code: 1, message: 'denied' });
    });
    const requests = await mockServices(page);
    await page.goto('/');
    await expect(page.locator('#location-name')).toHaveText('Central London');
    await expect(page.locator('#status')).toHaveText(
      'We couldn\'t get your location, so we\'re using central London. Tap Change to pick a town.'
    );
    // You can still pick a town, but you don't have to
    await expect(page.getByRole('searchbox', { name: 'Town or city' })).toBeHidden();
    await expect(page.getByRole('button', { name: 'Change', exact: true })).toBeVisible();

    await openOutfit(page);
    await expect(page.locator('#place-note')).toHaveText(
      'Forecast for central London, as we couldn\'t get your location.'
    );
    await expect(page.locator('#reading-temperature')).toHaveText('10°C');
    expect(requests[0].searchParams.get('latitude')).toBe(CENTRAL_LONDON.latitude);
    expect(requests[0].searchParams.get('longitude')).toBe(CENTRAL_LONDON.longitude);
  });

  test('uses central London when the phone can\'t share a location at all', async ({ page }) => {
    await withProfile(page);
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'geolocation', { value: undefined });
    });
    await mockServices(page);
    await page.goto('/');
    await expect(page.locator('#location-name')).toHaveText('Central London');
    await openOutfit(page);
    await expect(page.locator('#place-note')).toHaveText(
      'Forecast for central London, as we couldn\'t get your location.'
    );
  });

  test('waits for your location before fetching the forecast', async ({ page }) => {
    await withProfile(page);
    // The phone takes its time to answer
    await page.addInitScript(() => {
      navigator.geolocation.getCurrentPosition = (success) => {
        window.answerLocation = () => success({ coords: { latitude: 51.5, longitude: -0.12 } });
      };
    });
    const requests = await mockServices(page);
    await page.goto('/');
    await openOutfit(page);
    await expect(page.locator('#weather-status')).toHaveText('Finding your location…');
    expect(requests).toHaveLength(0);
    await page.evaluate(() => window.answerLocation());
    await expect(page.locator('#reading-temperature')).toHaveText('10°C');
    expect(requests[0].searchParams.get('latitude')).toBe('51.5');
  });
});
