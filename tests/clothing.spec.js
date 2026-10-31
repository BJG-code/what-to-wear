// Checks the rules that decide what to wear, without opening the page.
const { test, expect } = require('@playwright/test');
const { recommend, dressingTemperature } = require('../clothing.js');

// Daylight, cool, grey, calm and dry: nothing extra from the weather
const calm = { temperature: 10, cloudCover: 80, isDay: true, gusts: 20, rainChance: 0 };

// The kit for a dressing temperature, as a list of items
function wear(activity, dressingTemp, weather = {}) {
  const { items } = recommend({ activity, dressingTemp, weather: { ...calm, ...weather } });
  return items.map((i) => i.item);
}

// The items in one card: 'Upper body', 'Lower body' or 'Accessories'
function card(activity, dressingTemp, area, weather = {}) {
  const { items } = recommend({ activity, dressingTemp, weather: { ...calm, ...weather } });
  return items.filter((i) => i.area === area).map((i) => i.item);
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
    // 8 °C is the edge of shorts when running
    const kit = (feelsLike) => wear('running', dressing({ feelsLike }).total);
    expect(kit(7.6)).toContain('Shorts');
    expect(kit(7.4)).toContain('Tights');
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
  const upper = (t, weather) => card('running', t, 'Upper body', weather);
  const lower = (t) => card('running', t, 'Lower body');
  const accessories = (t, weather) => card('running', t, 'Accessories', weather);

  test('worked example: dressing for 8 °C → long sleeve, shorts, headband', () => {
    expect(recommend({ activity: 'running', dressingTemp: 8, weather: calm }).items).toEqual([
      { area: 'Upper body', item: 'Long sleeve' },
      { area: 'Lower body', item: 'Shorts' },
      { area: 'Accessories', item: 'Headband' },
    ]);
  });

  test('upper body: 16+ vest, 11 to 15 T-shirt, 6 to 10 long sleeve, 5 or below long sleeve + gilet', () => {
    expect(upper(25)).toEqual(['Vest']);
    expect(upper(16)).toEqual(['Vest']);
    expect(upper(15)).toEqual(['T-shirt']);
    expect(upper(11)).toEqual(['T-shirt']);
    expect(upper(10)).toEqual(['Long sleeve']);
    expect(upper(6)).toEqual(['Long sleeve']);
    expect(upper(5)).toEqual(['Long sleeve', 'Gilet']);
    expect(upper(-10)).toEqual(['Long sleeve', 'Gilet']);
  });

  test('gilet also when gusts are 40 km/h or more and dressing temp is below 12', () => {
    expect(upper(11, { gusts: 40 })).toEqual(['T-shirt', 'Gilet']);
    expect(upper(6, { gusts: 55 })).toEqual(['Long sleeve', 'Gilet']);
    expect(upper(11, { gusts: 39 })).toEqual(['T-shirt']);
    expect(upper(12, { gusts: 60 })).toEqual(['T-shirt']);
    // Already wearing a gilet: never two
    expect(upper(3, { gusts: 50 })).toEqual(['Long sleeve', 'Gilet']);
    // A gap in the forecast adds nothing
    expect(upper(10, { gusts: null })).toEqual(['Long sleeve']);
  });

  test('lower body: 8+ shorts, below 8 tights', () => {
    expect(lower(20)).toEqual(['Shorts']);
    expect(lower(8)).toEqual(['Shorts']);
    expect(lower(7)).toEqual(['Tights']);
    expect(lower(-5)).toEqual(['Tights']);
  });

  test('headband 4 to 8, hat below 4 instead', () => {
    expect(accessories(9)).toEqual([]);
    expect(accessories(8)).toEqual(['Headband']);
    expect(accessories(7)).toEqual(['Headband']);
    expect(accessories(4)).toEqual(['Headband', 'Gloves']);
    expect(accessories(3)).toEqual(['Hat', 'Gloves']);
    expect(accessories(-5)).toEqual(['Hat', 'Gloves']);
  });

  test('gloves below 7', () => {
    expect(accessories(7)).not.toContain('Gloves');
    expect(accessories(6)).toContain('Gloves');
  });

  test('rain: no kit change', () => {
    expect(wear('running', 10, { rainChance: 100 })).toEqual(wear('running', 10, { rainChance: 0 }));
    expect(wear('running', 10, { rainChance: 100 })).not.toContain('Waterproof jacket');
  });
});

test.describe('cycling', () => {
  const upper = (t, weather) => card('cycling', t, 'Upper body', weather);
  const lower = (t) => card('cycling', t, 'Lower body');
  const accessories = (t) => card('cycling', t, 'Accessories');

  test('upper body: 18+ short sleeve, 13 to 17 + base layer, 8 to 12 long sleeve + base layer, 7 or below long sleeve + gilet', () => {
    expect(upper(25)).toEqual(['Short sleeve']);
    expect(upper(18)).toEqual(['Short sleeve']);
    expect(upper(17)).toEqual(['Short sleeve', 'Base layer']);
    expect(upper(13)).toEqual(['Short sleeve', 'Base layer']);
    expect(upper(12)).toEqual(['Long sleeve', 'Base layer']);
    expect(upper(8)).toEqual(['Long sleeve', 'Base layer']);
    expect(upper(7)).toEqual(['Long sleeve', 'Gilet']);
    expect(upper(-5)).toEqual(['Long sleeve', 'Gilet']);
  });

  test('waterproof jacket when rain is 50% or more, whatever the temperature', () => {
    expect(upper(25, { rainChance: 50 })).toEqual(['Short sleeve', 'Waterproof jacket']);
    expect(upper(2, { rainChance: 90 })).toEqual(['Long sleeve', 'Gilet', 'Waterproof jacket']);
    expect(upper(25, { rainChance: 49 })).toEqual(['Short sleeve']);
    expect(upper(25, { rainChance: null })).toEqual(['Short sleeve']);
  });

  test('gusts don\'t add a gilet on the bike', () => {
    expect(upper(10, { gusts: 60 })).toEqual(['Long sleeve', 'Base layer']);
  });

  test('lower body: 12+ shorts, below 12 tights', () => {
    expect(lower(12)).toEqual(['Shorts']);
    expect(lower(11)).toEqual(['Tights']);
  });

  test('buff below 8, gloves below 10', () => {
    expect(accessories(10)).toEqual([]);
    expect(accessories(9)).toEqual(['Gloves']);
    expect(accessories(8)).toEqual(['Gloves']);
    expect(accessories(7)).toEqual(['Buff', 'Gloves']);
    expect(accessories(-5)).toEqual(['Buff', 'Gloves']);
  });
});

test.describe('sun cream and sunglasses, both activities', () => {
  const sun = (activity, weather) => card(activity, 20, 'Accessories', weather);

  for (const activity of ['running', 'cycling']) {
    test(`${activity}: sun cream at 16 °C or more, in daylight, not overcast (under 50% cloud)`, () => {
      expect(sun(activity, { temperature: 16, cloudCover: 49 })).toContain('Sun cream');
      expect(sun(activity, { temperature: 15.9, cloudCover: 0 })).not.toContain('Sun cream');
      expect(sun(activity, { temperature: 25, cloudCover: 50 })).not.toContain('Sun cream');
      expect(sun(activity, { temperature: 25, cloudCover: 0, isDay: false })).not.toContain('Sun cream');
    });

    test(`${activity}: sunglasses in daylight with 30% cloud or less`, () => {
      expect(sun(activity, { temperature: 5, cloudCover: 30 })).toContain('Sunglasses');
      expect(sun(activity, { cloudCover: 31 })).not.toContain('Sunglasses');
      expect(sun(activity, { cloudCover: 0, isDay: false })).not.toContain('Sunglasses');
    });
  }

  test('sun cream uses the actual temperature, not the dressing temperature', () => {
    // Dressing for 5 °C on a 20 °C day: still sun cream
    expect(card('cycling', 5, 'Accessories', { temperature: 20, cloudCover: 10 })).toContain('Sun cream');
    // Dressing for 20 °C on a 12 °C day: no sun cream
    expect(card('running', 20, 'Accessories', { temperature: 12, cloudCover: 10 })).not.toContain('Sun cream');
  });

  test('a gap in the cloud forecast adds neither', () => {
    expect(sun('running', { temperature: 25, cloudCover: null })).toEqual([]);
  });
});

test.describe('items no longer in the rules', () => {
  test('no packable jacket, wind jacket, overshoes, socks, warmers, mitts or reflective kit', () => {
    const everything = [];
    for (const activity of ['running', 'cycling']) {
      for (let t = -15; t <= 30; t++) {
        everything.push(...wear(activity, t, { rainChance: 35, gusts: 60, isDay: false }));
      }
    }
    const allowed = [
      'Vest', 'T-shirt', 'Long sleeve', 'Gilet', 'Short sleeve', 'Base layer', 'Waterproof jacket',
      'Shorts', 'Tights', 'Headband', 'Hat', 'Buff', 'Gloves', 'Sun cream', 'Sunglasses',
    ];
    expect([...new Set(everything)].filter((item) => !allowed.includes(item))).toEqual([]);
  });
});
