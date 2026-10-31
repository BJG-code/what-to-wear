// Checks the rules that decide what to wear, without opening the page.
const { test, expect } = require('@playwright/test');
const { recommend } = require('../clothing.js');

const calm = { windSpeed: 5, rainChance: 0, isDay: true, sunny: false };

function wear(activity, feelsLike, extra = {}) {
  const { items } = recommend({
    activity,
    preference: extra.preference || 'normal',
    weather: { ...calm, feelsLike, ...extra.weather },
  });
  return items.map((i) => i.item);
}

test.describe('running', () => {
  test('warm day: shorts and a light top', () => {
    expect(wear('running', 20)).toEqual(['Vest or short-sleeve top', 'Shorts']);
  });

  test('cool day: long sleeves', () => {
    expect(wear('running', 10)).toEqual(['Long-sleeve top', 'Shorts or 3/4 tights']);
  });

  test('cold day: tights and gloves', () => {
    expect(wear('running', 5)).toEqual(['Long-sleeve thermal top', 'Running tights', 'Light gloves']);
  });

  test('freezing day: full winter kit', () => {
    expect(wear('running', -5)).toEqual([
      'Warm hat and neck warmer',
      'Thermal base layer and an insulated jacket',
      'Thermal tights',
      'Warm gloves',
      'Warm socks',
    ]);
  });
});

test.describe('cycling', () => {
  test('warm day: jersey and bib shorts', () => {
    expect(wear('cycling', 25)).toEqual(['Short-sleeve jersey', 'Bib shorts', 'Fingerless mitts']);
  });

  test('feels colder than running at the same temperature', () => {
    // 10°C running is long sleeves and shorts; on the bike it needs tights
    expect(wear('cycling', 10)).toContain('Bib tights');
  });

  test('freezing day: winter kit with overshoes', () => {
    expect(wear('cycling', -2)).toContain('Thermal overshoes and warm socks');
  });
});

test.describe('personal preference', () => {
  test('someone who feels the cold gets warmer kit', () => {
    expect(wear('running', 14)).toContain('Short-sleeve top');
    expect(wear('running', 14, { preference: 'cold' })).toContain('Long-sleeve top');
  });

  test('someone who runs warm gets lighter kit', () => {
    expect(wear('running', 6)).toContain('Running tights');
    expect(wear('running', 6, { preference: 'warm' })).toContain('Shorts or 3/4 tights');
  });
});

test.describe('extras', () => {
  test('likely rain: waterproof jacket', () => {
    expect(wear('running', 10, { weather: { rainChance: 70 } })).toContain('Waterproof jacket');
  });

  test('possible rain: packable jacket just in case', () => {
    expect(wear('running', 10, { weather: { rainChance: 35 } })).toContain('Packable rain jacket, just in case');
  });

  test('windy and dry: wind protection', () => {
    expect(wear('running', 10, { weather: { windSpeed: 35 } })).toContain('Windproof jacket');
    expect(wear('cycling', 10, { weather: { windSpeed: 28 } })).toContain('Windproof gilet');
  });

  test('dark: lights for cycling, something reflective for running', () => {
    expect(wear('cycling', 10, { weather: { isDay: false } })).toContain('Front and rear lights, and something reflective');
    expect(wear('running', 10, { weather: { isDay: false } })).toContain('Something reflective');
  });

  test('hot and sunny: sun protection', () => {
    expect(wear('running', 22, { weather: { sunny: true } })).toContain('Sunglasses and sun cream');
  });

  test('mild, dry, calm daytime: no extras', () => {
    const { items } = recommend({ activity: 'running', preference: 'normal', weather: { ...calm, feelsLike: 10 } });
    expect(items.some((i) => i.area === 'Also')).toBe(false);
  });
});
