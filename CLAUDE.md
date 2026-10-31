# What to wear: project brief

Read this first in every session.

## What this is

A personal app for Bradley that says exactly what to wear for a run or bike ride in London, up to 5 days ahead, and learns from how each outfit felt. It is a web app added to the iPhone home screen, hosted free on GitHub Pages (https://bjg-code.github.io/what-to-wear/). It costs £0 to run: no accounts, no AI calls inside the app, and all personal data stays on the phone in the browser's local storage.

## Source of truth

- **`docs/spec.md` is the source of truth.** Read the parts that matter for today's feature before writing code.
- `docs/mockups/*.png` show the look and layout (main.png = Getting to know you, plan.png = Plan a session, outfit.png = Your outfit, settings.png = Settings). Where a mockup and the spec disagree, the spec wins.
- Where the current code and the spec disagree, the spec wins.
- If the spec is unclear or seems wrong, ask Bradley. Only change the spec when he agrees, and add the change to its "Changes since" list.
- `docs/gaps.md` is the to-do list: every difference between the app and the spec. Tick a gap off when it's done.

## Files

- `index.html`: the page and its styling
- `app.js`: location, weather and showing the results
- `clothing.js`: the outfit rules, kept separate so they can be tested on their own
- `tests/`: automated checks (Playwright)
- `assets/logo.png`: the logo
- `docs/`: spec, mockups, gap list

Plain HTML, CSS and JavaScript. No frameworks and no build step.

## Design rules

| Token | Value |
| --- | --- |
| Background | #0E0E12 |
| Cards and inputs | #18181D, borders #26262D |
| Text | #F4F4F6, secondary #A6A6B0 |
| Accent purple (buttons, selected) | #7C3AED, hover #6D28D9 |
| Accent text and icons on dark | #C4A7FF |
| Selected tint | #231B36 |
| Font | Calibri, falling back to Carlito (free Google Font, same shape) |
| Logo | `assets/logo.png`, with the tagline "Whatever the weather, get it right" |

Clean and minimal: sentence case, few borders, touch targets at least 44 px, designed for a 390 px wide phone, never scrolls sideways.

## Inputs

- **Profile** (first launch, editable in Settings): name (used for "Hello Bradley!"), Runs hot / Neutral / Runs cold, units °C · km/h · km.
- **Each session**, all required before "What should I wear?" works: activity (running or cycling), day (today up to 5 days ahead), start time, distance (km), duration (minutes, pre-filled from distance: running about 6 min/km, cycling about 25 km/h), effort (Easy 110–140 bpm / Medium 140–170 / Hard 170+).
- The outfit is always for the chosen day and start time, never "right now".

## Weather

One call to Open-Meteo's hourly forecast for the phone's GPS position (free, no key). Fields: `temperature_2m`, `apparent_temperature` (feels like, the main input), `wind_speed_10m`, `wind_gusts_10m` (in km/h), `precipitation_probability`, `cloud_cover`, `is_day`, `relative_humidity_2m`.

- Dressing temperature and readings use the hour nearest the start time.
- Every hour from start to finish (start + duration) is checked; rain and gust notes and the cycling waterproof use the worst hour.
- Location refused or unavailable: use central London and say so.
- Forecast won't load: say so plainly and show no outfit.

## Dressing temperature

**Dressing temp = Feels like + Effort + Distance + Profile + Learned offset − Cycling chill**

| Adjustment | Value |
| --- | --- |
| Effort | Easy +0 · Medium +2 · Hard +4 °C |
| Distance | Running: under 3 km +0 · 3 to 7 km +1 · over 7 km +2. Cycling: under 8 km +0 · 8 to 20 km +1 · over 20 km +2 (capped) |
| Profile | Runs hot +2 · Neutral 0 · Runs cold −2 °C |
| Learned offset | Starts at 0, moved by feedback, separate for running and cycling |
| Cycling chill | 4 °C when cycling, 0 when running |

Duration does not change the dressing temperature.

## Outfit rules

**Running** (dressing temp, °C)

| Item | Rule |
| --- | --- |
| Upper body | 16+ Vest · 11 to 15 T-shirt · 6 to 10 Long sleeve · 5 or below Long sleeve + Gilet |
| Gilet (extra) | Also when gusts are 40 km/h or more and dressing temp is below 12 |
| Lower body | 8+ Shorts · below 8 Tights |
| Headband | 4 to 8 |
| Hat | Below 4 (replaces headband) |
| Gloves | Below 7 |
| Rain | No kit change |

**Cycling** (dressing temp, °C, after cycling chill)

| Item | Rule |
| --- | --- |
| Upper body | 18+ Short sleeve · 13 to 17 Short sleeve + Base layer · 8 to 12 Long sleeve + Base layer · 7 or below Long sleeve + Gilet |
| Waterproof jacket (extra) | Rain chance 50% or more, whatever the temperature |
| Lower body | 12+ Shorts · below 12 Tights |
| Buff | Below 8 |
| Gloves | Below 10 |

**Both activities:** sun cream when the actual temperature is 16 °C or more, in daylight, and not overcast; sunglasses in daylight when cloud cover is 30% or less. Both go in the Accessories card.

**Worked example:** easy 8 km run, feels like 6 °C, neutral, no learned offset → 6 + 0 + 2 + 0 + 0 = 8 °C → long sleeve, shorts, headband.

The result shows the dressing temperature and its breakdown, six weather readings, and three cards: Upper body, Lower body, Accessories.

## Notes

Shown below the cards only when they apply:

- Rain 50% or more: "rain likely"
- Gusts 40 km/h or more: "gusty"
- Dark at the start time: "take lights"
- Distance or effort made the outfit lighter: "You'll start a little chilly, but you'll warm up as you go."
- Weather changes during the session, e.g. "Rain likely from 07:30", "About 4° colder by the end" (feels like changes by 3 °C or more), "Dark from 17:10: take lights"

## Feedback rules

| Button | Change to learned offset |
| --- | --- |
| Too hot | +0.5 °C (future outfits lighter) |
| Perfect | No change |
| Too cold | −0.5 °C (future outfits warmer) |

- Separate offsets for running and cycling, each capped at ±5 °C, each with a Reset to 0 in Settings.
- Settings shows it in plain words ("You run about 1.5 °C warmer than average").
- Every rating is saved with its forecast, effort, distance and duration.
- Feedback is asked on the result screen only after the session has finished (start + duration).

## How we work

- **One feature per session.** Follow the build order in `docs/gaps.md` and do the next session that isn't ticked off. Keep the change small and finish it.
- **Explain in plain English.** Bradley is not an engineer. Say what changed, why, and how to check it on the phone. Avoid jargon, or explain it in a few words when it can't be avoided.
- **Keep the automated checks passing.** Run `npm test` before every commit; the same checks run on every pull request (`.github/workflows/checks.yml`). Add or update tests for every rule you build, including the boundaries (e.g. 7 and 8 °C). Never skip, weaken or delete a test just to make it pass.
- Write short, plain-English comments in the code, matching the current style.
- Work on the session's branch with clear commit messages. Open a pull request only when asked.
- Bradley's routine for each feature is in `docs/routine.md`. At the end of a session, remind him of the next step in it (usually: ask to open the PR).
