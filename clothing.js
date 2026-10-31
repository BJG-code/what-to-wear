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

  // Rain chance (%) at which to recommend a waterproof, or a light one just in case
  const RAIN_LIKELY = 50;
  const RAIN_POSSIBLE = 30;

  // Wind speed (km/h) at which to recommend wind protection
  const WINDY = { running: 30, cycling: 25 };

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
    const total = parts.feelsLike + parts.effort + parts.distance + parts.profile + parts.learned - parts.chill;
    return { ...parts, total };
  }

  function runningKit(t) {
    if (t >= 18) return { top: 'Vest or short-sleeve top', legs: 'Shorts' };
    if (t >= 13) return { top: 'Short-sleeve top', legs: 'Shorts' };
    if (t >= 8) return { top: 'Long-sleeve top', legs: 'Shorts or 3/4 tights' };
    if (t >= 3) return { top: 'Long-sleeve thermal top', legs: 'Running tights', hands: 'Light gloves' };
    if (t >= -2) {
      return {
        head: 'Hat or headband',
        top: 'Thermal base layer and a light jacket',
        legs: 'Running tights',
        hands: 'Gloves',
      };
    }
    return {
      head: 'Warm hat and neck warmer',
      top: 'Thermal base layer and an insulated jacket',
      legs: 'Thermal tights',
      hands: 'Warm gloves',
      feet: 'Warm socks',
    };
  }

  function cyclingKit(t) {
    if (t >= 20) return { top: 'Short-sleeve jersey', legs: 'Bib shorts', hands: 'Fingerless mitts' };
    if (t >= 15) return { top: 'Short-sleeve jersey and a base layer', legs: 'Bib shorts', hands: 'Fingerless mitts' };
    if (t >= 10) {
      return {
        top: 'Short-sleeve jersey with arm warmers',
        legs: 'Bib shorts with knee warmers',
        hands: 'Light full-finger gloves',
      };
    }
    if (t >= 5) {
      return {
        top: 'Long-sleeve thermal jersey and a base layer',
        legs: 'Bib tights',
        hands: 'Full-finger gloves',
      };
    }
    if (t >= 0) {
      return {
        head: 'Cap under your helmet',
        top: 'Thermal base layer and a winter jacket',
        legs: 'Thermal bib tights',
        hands: 'Winter gloves',
        feet: 'Thermal overshoes',
      };
    }
    return {
      head: 'Thermal cap under your helmet and a neck warmer',
      top: 'Thermal base layer and an insulated winter jacket',
      legs: 'Thermal bib tights',
      hands: 'Thick winter gloves',
      feet: 'Thermal overshoes and warm socks',
    };
  }

  // dressingTemp: from dressingTemperature (°C)
  // weather: { windSpeed (km/h), rainChance (%), isDay (true/false), sunny (true/false) }
  // Returns { items: [{ area, item }] } in head-to-toe order
  function recommend({ activity, dressingTemp, weather }) {
    const t = dressingTemp;
    const kit = activity === 'cycling' ? cyclingKit(t) : runningKit(t);
    const extras = [];

    if (weather.rainChance >= RAIN_LIKELY) {
      extras.push('Waterproof jacket');
    } else if (weather.rainChance >= RAIN_POSSIBLE) {
      extras.push('Packable rain jacket, just in case');
    } else if (weather.windSpeed >= WINDY[activity]) {
      extras.push(activity === 'cycling' ? 'Windproof gilet' : 'Windproof jacket');
    }

    if (!weather.isDay) {
      extras.push(activity === 'cycling' ? 'Front and rear lights, and something reflective' : 'Something reflective');
    } else if (weather.sunny && t >= 18) {
      extras.push('Sunglasses and sun cream');
    }

    const items = [];
    const areas = [['head', 'Head'], ['top', 'Top'], ['legs', 'Legs'], ['hands', 'Hands'], ['feet', 'Feet']];
    for (const [key, label] of areas) {
      if (kit[key]) items.push({ area: label, item: kit[key] });
    }
    for (const extra of extras) items.push({ area: 'Also', item: extra });

    return { items };
  }

  const api = { recommend, dressingTemperature };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.Clothing = api;
  }
})(this);
