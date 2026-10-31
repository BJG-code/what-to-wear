// Works out what to wear from the weather.
// Kept separate from the page so the rules can be tested on their own.
(function (root) {
  // Dressing temp = Feels like + Effort + Distance + Profile + Learned offset − Cycling chill

  // Harder efforts make more heat, so you can dress lighter
  const EFFORT_ADJUST = { easy: 0, medium: 2, hard: 4 };

  // Distance stands in for time: you warm up over the first 20 to 45 minutes, then it stops adding.
  // Under the first number +0, up to and including the second +1, over the second +2.
  const DISTANCE_BANDS = { running: [3, 7], cycling: [8, 20] };

  // From "Do you run hot or cold?": runs hot dresses you 2 °C lighter, runs cold 2 °C warmer
  const PROFILE_ADJUST = { hot: 2, neutral: 0, cold: -2 };

  // On the bike the wind from riding speed makes it feel 4 °C colder
  const CYCLING_CHILL = 4;

  // Rain chance (%) at which cycling adds a waterproof jacket. Running has no kit change for rain.
  const RAIN_LIKELY = 50;

  // Gusts (km/h) at which a run gets a gilet, when the dressing temp is below GILET_GUSTS_BELOW
  const GUSTY = 40;
  const GILET_GUSTS_BELOW = 12;

  // Sun cream: actual temperature (°C) at or above this, in daylight, and not overcast
  const SUN_CREAM_TEMP = 16;
  // Cloud cover (%) at or above which the sky counts as overcast (agreed 31 Oct 2026)
  const OVERCAST = 50;
  // Sunglasses: daylight and cloud cover (%) at or below this
  const SUNGLASSES_CLOUD = 30;

  function distanceAdjust(activity, distance) {
    const [short, long] = DISTANCE_BANDS[activity];
    if (distance < short) return 0;
    if (distance <= long) return 1;
    return 2;
  }

  // Works out the dressing temperature and each part of it, so the page can show how it was worked out.
  // learnedOffset comes from your feedback (see learnFrom), separate for running and cycling.
  function dressingTemperature({ activity, feelsLike, effort, distance, warmth, learnedOffset = 0 }) {
    const parts = {
      feelsLike,
      effort: EFFORT_ADJUST[effort],
      distance: distanceAdjust(activity, distance),
      profile: PROFILE_ADJUST[warmth],
      learned: learnedOffset,
      chill: activity === 'cycling' ? CYCLING_CHILL : 0,
    };
    const exact = parts.feelsLike + parts.effort + parts.distance + parts.profile + parts.learned - parts.chill;
    // Rounded to the nearest whole degree (halves round up), so the outfit always matches the number on screen.
    // "|| 0" turns −0 into 0.
    const total = Math.round(exact) || 0;
    return { ...parts, exact, total };
  }

  // Your rules of thumb: the dressing temperatures (°C) where each item starts.
  // These are the starting values; you can change them in Settings.
  const DEFAULT_RULES = {
    running: {
      vest: 16, // Vest from here up
      tshirt: 11, // T-shirt from here up to just below the vest
      longSleeve: 6, // Long sleeve from here up to just below the T-shirt; below it, long sleeve + gilet
      shorts: 8, // Shorts from here up; tights below
      headband: 8, // Headband from the hat's number up to here
      hat: 4, // Hat below this
      gloves: 7, // Gloves below this
    },
    cycling: {
      shortSleeve: 18, // Short sleeve from here up
      baseLayer: 13, // Short sleeve + base layer from here up to just below short sleeve
      longSleeve: 8, // Long sleeve + base layer from here up; below it, long sleeve + gilet
      shorts: 12, // Shorts from here up; tights below
      buff: 8, // Buff below this
      gloves: 10, // Gloves below this
    },
  };

  // Rules that have to stay in order, as [higher, lower, smallest gap]:
  // each top needs at least one degree of its own, and the headband can't end below where the hat starts
  const RULE_ORDER = {
    running: [['vest', 'tshirt', 1], ['tshirt', 'longSleeve', 1], ['headband', 'hat', 0]],
    cycling: [['shortSleeve', 'baseLayer', 1], ['baseLayer', 'longSleeve', 1]],
  };
  // Rules of thumb stay between these dressing temperatures (°C)
  const RULE_MIN = -20;
  const RULE_MAX = 40;

  // True when one activity's rules are all whole numbers, in range and in order
  function rulesMakeSense(activity, rules) {
    if (!rules || typeof rules !== 'object') return false;
    const keys = Object.keys(DEFAULT_RULES[activity]);
    if (!keys.every((k) => Number.isInteger(rules[k]) && rules[k] >= RULE_MIN && rules[k] <= RULE_MAX)) return false;
    return RULE_ORDER[activity].every(([high, low, gap]) => rules[high] - rules[low] >= gap);
  }

  // Your saved rules, or the starting ones for any activity whose saved rules are missing or don't make sense
  function checkRules(saved) {
    const rules = {};
    for (const activity of ['running', 'cycling']) {
      const mine = saved && saved[activity];
      rules[activity] = rulesMakeSense(activity, mine) ? { ...mine } : { ...DEFAULT_RULES[activity] };
    }
    return rules;
  }

  // Moves one rule up or down by step degrees. Returns the new rules, or null if that would
  // put the rules out of order or out of range (so the button can be greyed out).
  function changeRule(rules, activity, key, step) {
    const changed = { ...rules, [activity]: { ...rules[activity], [key]: rules[activity][key] + step } };
    return rulesMakeSense(activity, changed[activity]) ? changed : null;
  }

  // Running, from the dressing temperature (°C), the worst gusts of the session (km/h) and your rules
  function runningKit(t, gusts, r) {
    const upper = [];
    if (t >= r.vest) upper.push('Vest');
    else if (t >= r.tshirt) upper.push('T-shirt');
    else upper.push('Long sleeve');
    // Gilet below the long sleeve's number, or when it's gusty and below 12
    if (t < r.longSleeve || (gusts !== null && gusts >= GUSTY && t < GILET_GUSTS_BELOW)) upper.push('Gilet');

    const lower = [t >= r.shorts ? 'Shorts' : 'Tights'];

    const accessories = [];
    if (t < r.hat) accessories.push('Hat');
    else if (t <= r.headband) accessories.push('Headband');
    if (t < r.gloves) accessories.push('Gloves');
    return { upper, lower, accessories };
  }

  // Cycling, from the dressing temperature (°C, after cycling chill), the worst rain chance (%) and your rules
  function cyclingKit(t, rainChance, r) {
    let upper;
    if (t >= r.shortSleeve) upper = ['Short sleeve'];
    else if (t >= r.baseLayer) upper = ['Short sleeve', 'Base layer'];
    else if (t >= r.longSleeve) upper = ['Long sleeve', 'Base layer'];
    else upper = ['Long sleeve', 'Gilet'];
    // Waterproof whatever the temperature
    if (rainChance !== null && rainChance >= RAIN_LIKELY) upper.push('Waterproof jacket');

    const lower = [t >= r.shorts ? 'Shorts' : 'Tights'];

    const accessories = [];
    if (t < r.buff) accessories.push('Buff');
    if (t < r.gloves) accessories.push('Gloves');
    return { upper, lower, accessories };
  }

  // Sun cream and sunglasses, the same for both activities. Uses the actual temperature, not the dressing temp.
  function sunItems({ temperature, cloudCover, isDay }) {
    const items = [];
    if (!isDay || cloudCover === null || cloudCover === undefined) return items;
    if (temperature !== null && temperature !== undefined && temperature >= SUN_CREAM_TEMP && cloudCover < OVERCAST) {
      items.push('Sun cream');
    }
    if (cloudCover <= SUNGLASSES_CLOUD) items.push('Sunglasses');
    return items;
  }

  // dressingTemp: from dressingTemperature (°C)
  // weather: at the start hour { temperature (°C), cloudCover (%), isDay (true/false) },
  //   and the worst hour of the session { gusts (km/h), rainChance (%) }. A gap in the forecast is null.
  // rules: your rules of thumb (see DEFAULT_RULES); the starting ones if left out
  // Returns { items: [{ area, item }] }, grouped as Upper body, Lower body, Accessories
  function recommend({ activity, dressingTemp, weather, rules = DEFAULT_RULES }) {
    const t = dressingTemp;
    const gusts = weather.gusts ?? null;
    const rainChance = weather.rainChance ?? null;
    const kit = activity === 'cycling'
      ? cyclingKit(t, rainChance, rules.cycling)
      : runningKit(t, gusts, rules.running);
    kit.accessories.push(...sunItems(weather));

    const items = [];
    for (const [key, area] of [['upper', 'Upper body'], ['lower', 'Lower body'], ['accessories', 'Accessories']]) {
      for (const item of kit[key]) items.push({ area, item });
    }
    return { items };
  }

  // True when distance or effort has made the outfit lighter than the weather alone would:
  // you'll start a little chilly, but warm up as you go.
  // dressing: from dressingTemperature. weather and rules: as for recommend.
  function startsChilly({ activity, dressing, weather, rules = DEFAULT_RULES }) {
    if (dressing.effort + dressing.distance <= 0) return false;
    const without = Math.round(dressing.exact - dressing.effort - dressing.distance) || 0;
    const outfit = (t) => JSON.stringify(recommend({ activity, dressingTemp: t, weather, rules }).items);
    return outfit(without) !== outfit(dressing.total);
  }

  // Feedback: each rating moves the learned offset by half a degree, never past ±5 °C
  const RATING_STEP = 0.5;
  const OFFSET_LIMIT = 5;
  const RATING_CHANGE = { hot: RATING_STEP, perfect: 0, cold: -RATING_STEP };

  // The new learned offset after a rating: 'hot' (Too hot), 'perfect' or 'cold' (Too cold).
  // Too hot makes future outfits lighter (+0.5), too cold makes them warmer (−0.5).
  function learnFrom(offset, rating) {
    const moved = (Number(offset) || 0) + (RATING_CHANGE[rating] || 0);
    // Kept to the nearest half degree, so lots of ratings never add up to 1.4999…
    const capped = Math.min(OFFSET_LIMIT, Math.max(-OFFSET_LIMIT, Math.round(moved * 2) / 2));
    return capped || 0;
  }

  const api = {
    recommend, dressingTemperature, startsChilly, learnFrom, OFFSET_LIMIT,
    DEFAULT_RULES, checkRules, changeRule,
  };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.Clothing = api;
  }
})(this);
