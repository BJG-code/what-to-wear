// Checks the rules that decide what to wear, without opening the page.
const { test, expect } = require('@playwright/test');
const { recommend, dressingTemperature } = require('../clothing.js');

const calm = { windSpeed: 5, rainChance: 0, isDay: true, sunny: false };

// The kit for a dressing temperature
function wear(activity, dressingTemp, extra = {}) {
  const { items } = recommend({ activity, dressingTemp, weather: { ...calm, ...extra.weather } });
  return items.map((i) => i.item);
}

// The dressing temperature for an easy, short session, neutral profile, unless told otherwise
function dressing(change = {}) {
  return dressingTemperature({
    activity: 'running', feelsLike: 10, effort: 'easy', distance: 2, warmth: 'neutral', ...change,
  });
}

test.describe('dressing temperature', () => {
  test('worked example: easy 8 km run, feels like 6 °C, neutral → 8 °C', () => {
    const d = dressing({ feelsLike: 6, distance: 8 });
    expect(d).toEqual({ feelsLike: 6, effort: 0, distance: 2, profile: 0, learned: 0, chill: 0, exact: 8, total: 8 });
  });

  test('effort: easy +0, medium +2, hard +4', () => {
    expect(dressing({ effort: 'easy' }).total).toBe(10);
    expect(dressing({ effort: 'medium' }).total).toBe(12);
    expect(dressing({ effort: 'hard' }).total).toBe(14);
  });

  test('running distance: under 3 km +0, 3 to 7 km +1, over 7 km +2', () => {
    const add = (distance) => dressing({ distance }).distance;
    expect(add(2.9)).toBe(0);
    expect(add(3)).toBe(1);
    expect(add(7)).toBe(1);
    expect(add(7.1)).toBe(2);
    expect(add(42)).toBe(2);
  });

  test('cycling distance: under 8 km +0, 8 to 20 km +1, over 20 km +2', () => {
    const add = (distance) => dressing({ activity: 'cycling', distance }).distance;
    expect(add(7.9)).toBe(0);
    expect(add(8)).toBe(1);
    expect(add(20)).toBe(1);
    expect(add(20.1)).toBe(2);
    expect(add(150)).toBe(2);
  });

  test('profile: runs hot +2, neutral 0, runs cold −2', () => {
    expect(dressing({ warmth: 'hot' }).total).toBe(12);
    expect(dressing({ warmth: 'neutral' }).total).toBe(10);
    expect(dressing({ warmth: 'cold' }).total).toBe(8);
  });

  test('learned offset is added, and starts at 0', () => {
    expect(dressing().learned).toBe(0);
    expect(dressing({ learnedOffset: 1.5 }).exact).toBe(11.5);
    expect(dressing({ learnedOffset: -2 }).total).toBe(8);
  });

  test('rounded to the nearest whole degree, halves round up', () => {
    expect(dressing({ feelsLike: 7.4 }).total).toBe(7);
    expect(dressing({ feelsLike: 7.5 }).total).toBe(8);
    expect(dressing({ feelsLike: 7.6 }).total).toBe(8);
    expect(dressing({ learnedOffset: 0.5 }).total).toBe(11);
    expect(dressing({ feelsLike: -3.4 }).total).toBe(-3);
    expect(dressing({ feelsLike: -3.6 }).total).toBe(-4);
    // Just below zero shows as 0, not −0
    expect(Object.is(dressing({ feelsLike: -0.4 }).total, 0)).toBe(true);
  });

  test('the outfit uses the rounded number, so 7.6 is dressed as 8', () => {
    // 8 °C is the edge of a long-sleeve top in today's running rules
    const kit = (feelsLike) => wear('running', dressing({ feelsLike }).total);
    expect(kit(7.6)).toContain('Long-sleeve top');
    expect(kit(7.4)).toContain('Long-sleeve thermal top');
  });

  test('cycling takes off 4 °C for chill, running takes off nothing', () => {
    expect(dressing({ activity: 'running' }).chill).toBe(0);
    const ride = dressing({ activity: 'cycling' });
    expect(ride.chill).toBe(4);
    expect(ride.total).toBe(6);
  });

  test('everything together: hard 25 km ride, feels like 5 °C, runs cold, learned +1', () => {
    // 5 + 4 + 2 − 2 + 1 − 4 = 6
    const d = dressing({
      activity: 'cycling', feelsLike: 5, effort: 'hard', distance: 25, warmth: 'cold', learnedOffset: 1,
    });
    expect(d.total).toBe(6);
  });
});

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

  test('cool day: long sleeves and tights', () => {
    expect(wear('cycling', 6)).toContain('Bib tights');
  });

  test('freezing day: winter kit with overshoes', () => {
    expect(wear('cycling', -2)).toContain('Thermal overshoes and warm socks');
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
    const { items } = recommend({ activity: 'running', dressingTemp: 10, weather: calm });
    expect(items.some((i) => i.area === 'Also')).toBe(false);
  });
});
