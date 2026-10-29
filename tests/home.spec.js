// Checks that the home page looks and behaves the way it should.
const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('page has the right title in the browser tab', async ({ page }) => {
  await expect(page).toHaveTitle('What to wear');
});

test('heading is visible with the right words', async ({ page }) => {
  const heading = page.getByRole('heading', { level: 1 });
  await expect(heading).toBeVisible();
  await expect(heading).toHaveText('What to wear: coming soon');
});

test('colours are purple text on a dark background', async ({ page }) => {
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(14, 14, 18)'); // #0E0E12
  await expect(page.getByRole('heading', { level: 1 })).toHaveCSS('color', 'rgb(124, 58, 237)'); // #7C3AED
});

test('Carlito font is loaded', async ({ page }) => {
  await page.evaluate(() => document.fonts.ready);
  const loaded = await page.evaluate(() => document.fonts.check('700 16px Carlito'));
  expect(loaded).toBe(true);
});

test('heading is centred on the screen', async ({ page }) => {
  const box = await page.getByRole('heading', { level: 1 }).boundingBox();
  const viewport = page.viewportSize();
  const middleX = box.x + box.width / 2;
  const middleY = box.y + box.height / 2;
  // Allow a few pixels of leeway
  expect(Math.abs(middleX - viewport.width / 2)).toBeLessThan(5);
  expect(Math.abs(middleY - viewport.height / 2)).toBeLessThan(5);
});

test('page does not scroll sideways', async ({ page }) => {
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(page.viewportSize().width);
});
