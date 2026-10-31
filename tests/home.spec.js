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

test.describe('with location allowed', () => {
  test.use({ geolocation: LONDON, permissions: ['geolocation'] });

  test('page has the right title in the browser tab', async ({ page }) => {
    await mockServices(page);
    await page.goto('/');
    await expect(page).toHaveTitle('What to wear');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('What to wear');
  });

  test('uses your current location and shows the weather', async ({ page }) => {
    const requests = await mockServices(page);
    await page.goto('/');
    await expect(page.locator('#location-name')).toHaveText('Your current location');
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
    await expect(page.getByRole('heading', { name: 'Wear for your run' })).toBeVisible();
    await expect(page.locator('#kit li')).toHaveText([
      'TopLong-sleeve top',
      'LegsShorts or 3/4 tights',
    ]);
  });

  test('switching to cycling changes the kit', async ({ page }) => {
    await mockServices(page);
    await page.goto('/');
    await page.getByText('Cycling').click();
    await expect(page.getByRole('heading', { name: 'Wear for your ride' })).toBeVisible();
    await expect(page.locator('#kit')).toContainText('Bib tights');
  });

  test('saying you feel the cold gives warmer kit', async ({ page }) => {
    await mockServices(page);
    await page.goto('/');
    await expect(page.locator('#kit')).toContainText('Shorts or 3/4 tights');
    await page.getByText('Feel the cold').click();
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
    await expect(page.locator('#temperature')).toHaveText('10°C');

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
    await expect(page.locator('#status')).toHaveText(
      'Couldn\'t get the weather right now. Check your connection and try again.'
    );
    await expect(page.locator('#results')).toBeHidden();
  });

  test('colours are right', async ({ page }) => {
    await mockServices(page);
    await page.goto('/');
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(14, 14, 18)'); // #0E0E12
    await expect(page.getByRole('heading', { level: 1 })).toHaveCSS('color', 'rgb(124, 58, 237)'); // #7C3AED
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
    await expect(page.locator('#kit li').first()).toBeVisible();
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(page.viewportSize().width);
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
