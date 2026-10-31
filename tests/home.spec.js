// Checks that the page looks and behaves the way it should.
// The weather and place-search services are replaced with sample answers,
// so the checks don't depend on today's real weather or an internet connection.
const { test, expect } = require('@playwright/test');

const LONDON = { latitude: 51.5, longitude: -0.12 };

// A cool, dry, calm morning: 10°C, feels like 8°C
const sampleWeather = {
  current: {
    temperature_2m: 10.2,
    apparent_temperature: 8.1,
    weather_code: 2,
    wind_speed_10m: 12,
    is_day: 1,
  },
  hourly: { precipitation_probability: [10, 15, 5] },
};

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

// Taps "What should I wear?" to go from Plan a session to Your outfit
async function openOutfit(page) {
  await page.getByRole('button', { name: 'What should I wear?' }).click();
  await expect(page.locator('#outfit-screen')).toBeVisible();
}

test.describe('with location allowed', () => {
  test.use({ geolocation: LONDON, permissions: ['geolocation'], timezoneId: 'Europe/London' });

  test('page has the right title in the browser tab', async ({ page }) => {
    await mockServices(page);
    await page.goto('/');
    await expect(page).toHaveTitle('What to wear');
    await expect(page.getByRole('heading', { level: 1 })).toHaveAccessibleName('What to wear');
  });

  test('uses your current location and shows the weather', async ({ page }) => {
    const requests = await mockServices(page);
    await page.goto('/');
    await expect(page.locator('#location-name')).toHaveText('Your current location');
    await openOutfit(page);
    await expect(page.locator('#temperature')).toHaveText('10°C');
    await expect(page.locator('#conditions')).toHaveText(
      'Partly cloudy · Feels like 8°C · Wind 12 km/h · Rain chance 15%'
    );
    expect(requests[0].searchParams.get('latitude')).toBe('51.5');
    expect(requests[0].searchParams.get('longitude')).toBe('-0.12');
  });

  test('shows running kit by default', async ({ page }) => {
    await mockServices(page);
    await page.goto('/');
    await openOutfit(page);
    await expect(page.getByRole('heading', { name: 'Your outfit' })).toBeVisible();
    await expect(page.locator('#summary')).toContainText('Run');
    await expect(page.locator('#kit li')).toHaveText([
      'TopLong-sleeve top',
      'LegsShorts or 3/4 tights',
    ]);
  });

  test('switching to cycling changes the kit', async ({ page }) => {
    await mockServices(page);
    await page.goto('/');
    await page.getByText('Cycling').click();
    await openOutfit(page);
    await expect(page.locator('#summary')).toContainText('Ride');
    await expect(page.locator('#kit')).toContainText('Bib tights');
  });

  test('saying you feel the cold gives warmer kit', async ({ page }) => {
    await mockServices(page);
    await page.goto('/');
    await openOutfit(page);
    await expect(page.locator('#kit')).toContainText('Shorts or 3/4 tights');
    await page.getByRole('button', { name: 'Back to plan a session' }).click();
    await page.getByText('Feel the cold').click();
    await openOutfit(page);
    await expect(page.locator('#kit')).toContainText('Running tights');
  });

  test('remembers your choices next time', async ({ page }) => {
    await mockServices(page);
    await page.goto('/');
    await page.getByText('Cycling').click();
    await page.getByText('Feel the cold').click();
    await page.reload();
    await expect(page.getByRole('radio', { name: 'Cycling' })).toBeChecked();
    await expect(page.getByRole('radio', { name: 'Feel the cold' })).toBeChecked();
  });

  test('can change to another place, and go back to your location', async ({ page }) => {
    const requests = await mockServices(page);
    await page.goto('/');
    await expect.poll(() => requests.length).toBe(1);

    await page.getByRole('button', { name: 'Change' }).click();
    await page.getByRole('searchbox', { name: 'Town or city' }).fill('Malaga');
    await page.getByRole('button', { name: 'Search' }).click();
    await page.getByRole('button', { name: 'Málaga, Andalusia, Spain' }).click();

    await expect(page.locator('#location-name')).toHaveText('Málaga, Andalusia, Spain');
    await expect.poll(() => requests.at(-1).searchParams.get('latitude')).toBe('36.72');

    // The holiday location is remembered after closing the page
    await page.reload();
    await expect(page.locator('#location-name')).toHaveText('Málaga, Andalusia, Spain');

    await page.getByRole('button', { name: 'Change' }).click();
    await page.getByRole('button', { name: 'Use my current location' }).click();
    await expect(page.locator('#location-name')).toHaveText('Your current location');
    await expect.poll(() => requests.at(-1).searchParams.get('latitude')).toBe('51.5');
  });

  test('tells you when a place can\'t be found', async ({ page }) => {
    await mockServices(page, { places: {} });
    await page.goto('/');
    await page.getByRole('button', { name: 'Change' }).click();
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
      'Couldn\'t get the weather right now. Check your connection and try again.'
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
    const change = page.getByRole('button', { name: 'Change' });
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
    scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
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
    await expect(page.locator('#summary')).toHaveText('Wed 28 Oct · 07:00 · Run');
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

test.describe('with location blocked', () => {
  test('asks you to search for a town instead', async ({ page }) => {
    await page.addInitScript(() => {
      navigator.geolocation.getCurrentPosition = (success, error) => error({ code: 1, message: 'denied' });
    });
    await mockServices(page);
    await page.goto('/');
    await expect(page.locator('#status')).toHaveText('We couldn\'t get your location. Search for a town instead.');
    await expect(page.getByRole('searchbox', { name: 'Town or city' })).toBeVisible();
  });
});
