// Works out what to wear from the weather.
// Kept separate from the page so the rules can be tested on their own.
(function (root) {
  // How many degrees colder or warmer it feels to someone, based on their preference
  const PREFERENCE_ADJUST = { cold: -3, normal: 0, warm: 3 };

  // Cycling feels colder than running: you're moving faster and working less hard
  const ACTIVITY_ADJUST = { running: 0, cycling: -2 };

  // Rain chance (%) at which to recommend a waterproof, or a light one just in case
  const RAIN_LIKELY = 50;
  const RAIN_POSSIBLE = 30;

  // Wind speed (km/h) at which to recommend wind protection
  const WINDY = { running: 30, cycling: 25 };

  function effectiveTemperature({ feelsLike, activity, preference }) {
    return feelsLike + ACTIVITY_ADJUST[activity] + PREFERENCE_ADJUST[preference];
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

  // weather: { feelsLike (°C), windSpeed (km/h), rainChance (%), isDay (true/false), sunny (true/false) }
  // Returns { effectiveTemp, items: [{ area, item }] } in head-to-toe order
  function recommend({ activity, preference, weather }) {
    const t = effectiveTemperature({ feelsLike: weather.feelsLike, activity, preference });
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

    return { effectiveTemp: t, items };
  }

  const api = { recommend, effectiveTemperature };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.Clothing = api;
  }
})(this);
