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
  // learnedOffset comes from your feedback (0 until feedback is built).
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

  // Running, from the dressing temperature (°C) and the worst gusts of the session (km/h)
  function runningKit(t, gusts) {
    const upper = [];
    if (t >= 16) upper.push('Vest');
    else if (t >= 11) upper.push('T-shirt');
    else upper.push('Long sleeve');
    // Gilet at 5 or below, or when it's gusty and below 12
    if (t <= 5 || (gusts !== null && gusts >= GUSTY && t < GILET_GUSTS_BELOW)) upper.push('Gilet');

    const lower = [t >= 8 ? 'Shorts' : 'Tights'];

    const accessories = [];
    if (t < 4) accessories.push('Hat');
    else if (t <= 8) accessories.push('Headband');
    if (t < 7) accessories.push('Gloves');
    return { upper, lower, accessories };
  }

  // Cycling, from the dressing temperature (°C, after cycling chill) and the worst rain chance (%)
  function cyclingKit(t, rainChance) {
    let upper;
    if (t >= 18) upper = ['Short sleeve'];
    else if (t >= 13) upper = ['Short sleeve', 'Base layer'];
    else if (t >= 8) upper = ['Long sleeve', 'Base layer'];
    else upper = ['Long sleeve', 'Gilet'];
    // Waterproof whatever the temperature
    if (rainChance !== null && rainChance >= RAIN_LIKELY) upper.push('Waterproof jacket');

    const lower = [t >= 12 ? 'Shorts' : 'Tights'];

    const accessories = [];
    if (t < 8) accessories.push('Buff');
    if (t < 10) accessories.push('Gloves');
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
  // Returns { items: [{ area, item }] }, grouped as Upper body, Lower body, Accessories
  function recommend({ activity, dressingTemp, weather }) {
    const t = dressingTemp;
    const gusts = weather.gusts ?? null;
    const rainChance = weather.rainChance ?? null;
    const kit = activity === 'cycling' ? cyclingKit(t, rainChance) : runningKit(t, gusts);
    kit.accessories.push(...sunItems(weather));

    const items = [];
    for (const [key, area] of [['upper', 'Upper body'], ['lower', 'Lower body'], ['accessories', 'Accessories']]) {
      for (const item of kit[key]) items.push({ area, item });
    }
    return { items };
  }

  const api = { recommend, dressingTemperature };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.Clothing = api;
  }
})(this);
