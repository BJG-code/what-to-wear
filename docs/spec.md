# What to wear — v1.0 product spec

27 Oct 2026 · Bradley Gladden · updated 31 Oct 2026

**Changes since 27 Oct 2026** (agreed 31 Oct 2026)

- Day, start time, distance, effort and the new duration are all required before an outfit is shown. The outfit is always for the chosen day and time, never "right now".
- New **Duration** input after Distance, used to warn about weather changes during the session.
- Plan a session greets you by name: "Hello Bradley".
- Wind is shown in km/h, not mph. The 25 mph gust threshold becomes 40 km/h.
- Sun cream and sunglasses added to the Accessories card.
- Feedback is three buttons: Too hot / Perfect / Too cold. "Way off" is removed.
- Where the mockups disagree with this spec (mph, four feedback buttons, no greeting, no duration), this spec wins.

## Overview

What to wear tells a runner or cyclist exactly what to put on for a session up to 5 days ahead, based on the forecast where they are, and learns from how each outfit felt.

- **Problem:** London weather makes kit choice a guess. Too many layers and you overheat; too few and the first 20 minutes are miserable.
- **Objective:** one clear outfit recommendation in under 30 seconds, which gets more accurate the more you use it.
- **Audience:** v1.0 is a personal app for one user (me), running and cycling in London. Other runners and cyclists are a later possibility, not a v1.0 goal.
- **Learning goal:** build it with Claude as a first vibe-coding project, understanding each step well enough to explain it.

**Success for v1.0:** installed on my iPhone by Sun 22 Nov 2026, used before real runs and rides, and rated "Perfect" on most sessions after two weeks of feedback.

## Scope

v1.0 covers one person, two activities and manual inputs; anything needing accounts, other apps or paid services waits.

| In v1.0 | Later (v1.1+) |
| --- | --- |
| Running and cycling | Other activities (walking, hiking) |
| "Getting to know you" profile, saved on the phone | Login, accounts, syncing between devices |
| Location from the phone's GPS | Saved locations, route-based forecasts |
| Forecast from Open-Meteo, up to 5 days ahead | Met Office or Apple WeatherKit as a second source |
| Effort chosen manually: Hard / Medium / Easy | Heart rate and workouts from Apple Health, Strava or Garmin |
| Outfit from fixed rules, with short notes when they apply | AI-written summary from Claude (costs per use) |
| Feedback that tunes future recommendations | Reminders, widgets, Apple Watch |
| Home-screen web app on the iPhone, hosted free on GitHub Pages | Native Swift app (needs a personal Mac) |

## User flow and screens

Four quick inputs lead to the outfit; the rating after each session moves the learned offset that every later recommendation uses.

Flow: Profile (first launch only) → Activity (running or cycling) → Day and time (up to 5 days ahead) → Distance, duration and effort → Forecast (GPS + Open-Meteo) → Outfit (from the dressing temperature) → Rate it after the session → Learned offset updated → used in every future recommendation.

Screens in v1.0 (mockups in docs/mockups/):

| Screen | Mockup | Contents |
| --- | --- | --- |
| Getting to know you (first launch) | main.png | Logo + tagline, name, runs hot / neutral / runs cold, units, "Let's go" |
| Plan a session | plan.png | Logo + tagline and settings cog, "Hello Bradley" greeting, activity, day (today + 5), start time, distance, duration, effort, "What should I wear?" |
| Your outfit | outfit.png | Dressing temperature and its breakdown, six weather readings, three outfit cards, notes that apply, three feedback buttons |
| Settings | settings.png | Profile, learned offsets with Reset, rules of thumb (running / cycling tabs) |

## Inputs

The profile is set once on first launch and editable in Settings; the session inputs are asked every time, are all required, and take under 30 seconds.

**Profile ("Getting to know you")**

| Field | Options | Used for |
| --- | --- | --- |
| Name | Free text | Greeting: "Hello Bradley" at the top of Plan a session |
| Do you run hot or cold? | Runs hot / Neutral / Runs cold | Shifts every recommendation warmer or cooler |
| Your rules of thumb | Edit the starting thresholds (see Outfit rules) | Your own starting logic |
| Units | °C, km/h, km (default) | Display only |

**Each session**

| Field | Options | Rule |
| --- | --- | --- |
| Activity | Running / Cycling | Picks the clothing set and rules |
| Day | Today up to 5 days ahead | Later days are greyed out |
| Time | Hour picker | Forecast is read for that hour (e.g. 07:00 tomorrow, not the weather now) |
| Distance | km | Longer sessions dress lighter, as you warm up on the way (see Outfit rules) |
| Duration | Minutes, pre-filled from distance (running about 6 min/km, cycling about 25 km/h), editable | Sets the weather window: every forecast hour from start to finish is checked for changes (see Output). Does not change the dressing temperature |
| Effort | Hard (170+ bpm) / Medium (140–170) / Easy (110–140) | Harder effort means you dress lighter |

## Weather data

One free call to Open-Meteo's hourly forecast for the phone's GPS position returns all six measures; no sign-up or API key is needed.

| Measure | Open-Meteo hourly field | Shown as | Used for |
| --- | --- | --- | --- |
| Temperature | `temperature_2m` | °C | Shown |
| Feels like | `apparent_temperature` | °C | **Main input:** already includes wind and humidity |
| Gust / wind | `wind_speed_10m`, `wind_gusts_10m` | km/h | Gilet trigger, gusty note |
| Rain % | `precipitation_probability` | % | Note at 50% or more; cycling waterproof |
| Sun | `cloud_cover`, `is_day` | Sunny (cloud 30% or less) / cloudy / dark | Shown; dark adds a lights note; sun cream and sunglasses |
| Humidity | `relative_humidity_2m` | % | Shown |

- The app reads the hour nearest your chosen start time for the dressing temperature and the readings.
- It also reads every hour up to the end of the session (start + duration). Rain and gust notes, and the cycling waterproof, use the worst hour in that window.
- Wind is requested in km/h (`wind_speed_unit=kmh`).
- If GPS is refused or unavailable, it falls back to central London and says so.
- If the forecast can't load, it says so plainly and shows no outfit, rather than guessing.

Open-Meteo is free for non-commercial use; confirm field names against its docs at build time.

## Outfit rules

Every recommendation comes from one number, the dressing temperature, compared against the thresholds below. The thresholds are starting points; the feedback loop tunes them.

**Dressing temp = Feels like + Effort + Distance + Profile + Learned offset − Cycling chill**

| Adjustment | Value |
| --- | --- |
| Effort | Easy +0 °C · Medium +2 °C · Hard +4 °C |
| Distance (as a stand-in for time) | Running: under 3 km +0 · 3 to 7 km +1 · over 7 km +2 °C (capped). Cycling: under 8 km +0 · 8 to 20 km +1 · over 20 km +2 °C (capped) |
| Profile | Runs hot +2 °C · Neutral 0 · Runs cold −2 °C |
| Learned offset | Starts at 0, moved by feedback (see Feedback loop), separate for running and cycling |
| Cycling chill | 4 °C on the bike, to stand in for wind from riding speed; 0 for running |

**Dress for the middle of the session, not the start.** Working muscles release 70 to 100% of their energy as heat, and the body stores most of it in the first 15 to 20 minutes, before sweating and skin blood flow catch up. Core temperature then levels off at a new, higher steady state after 30 to 45 minutes. Two rules follow:

1. **Time matters up to about 45 minutes, then stops adding.** The distance bands roughly match 20 and 45 minutes (easy running pace about 6 min/km, cycling about 25 km/h), and are capped beyond that.
2. **Intensity matters more than duration.** A near-maximal effort roughly doubles the rise in core temperature of a moderate one (+0.8 °C against +0.4 °C), which is why Effort carries the bigger adjustment.

So the app will sometimes deliberately recommend kit that feels chilly at the start.

**Running** (dressing temp, °C)

| Item | Rule |
| --- | --- |
| Upper body | 16+ Vest · 11 to 15 T-shirt · 6 to 10 Long sleeve · 5 or below Long sleeve + Gilet |
| Gilet (extra) | Also added when gusts are 40 km/h or more and dressing temp is below 12 |
| Lower body | 8+ Shorts · below 8 Tights |
| Headband (warm ears) | 4 to 8 |
| Hat | Below 4 (replaces headband) |
| Gloves | Below 7 |
| Rain | No kit change; the rain chance shows in the weather readings |
| Sun cream | Temperature 16 °C or more, in daylight, and not overcast |
| Sunglasses | Daylight and cloud cover 30% or less |

**Cycling** (dressing temp, °C, after cycling chill)

| Item | Rule |
| --- | --- |
| Upper body | 18+ Short sleeve · 13 to 17 Short sleeve + Base layer · 8 to 12 Long sleeve + Base layer · 7 or below Long sleeve + Gilet |
| Waterproof jacket (extra) | Added when rain chance is 50% or more, whatever the temperature |
| Lower body | 12+ Shorts · below 12 Tights |
| Buff | Below 8 |
| Gloves | Below 10 |
| Sun cream | Temperature 16 °C or more, in daylight, and not overcast |
| Sunglasses | Daylight and cloud cover 30% or less |

Sun cream uses the actual temperature, not the dressing temperature. Both sun items go in the Accessories card.

**Worked example:** easy 8 km run, feels like 6 °C, neutral profile, no learned offset → 6 + 0 + 2 + 0 + 0 = 8 °C → long sleeve, shorts, headband.

## Output

The result screen shows the dressing temperature and how it was worked out, the six weather readings, and three outfit cards (Upper body, Lower body, Accessories). There is no separate written summary, so each fact appears once.

Short notes appear below the cards only when they apply: rain 50% or more ("rain likely"), gusts 40 km/h or more ("gusty"), or dark at the chosen time ("take lights"). When distance or effort has made the outfit lighter, a note says so: "You'll start a little chilly, but you'll warm up as you go."

Weather-change notes use the duration and appear only when something changes during the session, for example "Rain likely from 07:30", "About 4° colder by the end" (feels like changes by 3 °C or more), or "Dark from 17:10: take lights".

## Feedback loop

After each session you rate the outfit, and each rating nudges a learned offset by half a degree, so the app shifts towards you gradually rather than overreacting to one odd day.

| Rating | What it means | Change to learned offset |
| --- | --- | --- |
| Too hot | Overdressed | +0.5 °C (future outfits lighter) |
| Perfect | Outfit was right | No change |
| Too cold | Underdressed | −0.5 °C (future outfits warmer) |

- Separate offsets for running and cycling, since the two feel different.
- The offset is capped at ±5 °C, so one bad week can't wreck the rules.
- Settings shows the current offset in plain words ("You run about 1.5 °C warmer than average") with a reset button, and the line "Each rating moves this by 0.5 °C, up to ±5 °C."
- Every rating is saved with its forecast, effort, distance and duration, ready for smarter learning in v1.1.
- Feedback is asked on the result screen once the session has finished (start time + duration).

## Design

| Token | Value |
| --- | --- |
| Background | #0E0E12 |
| Card / input surface | #18181D, borders #26262D |
| Text | #F4F4F6, secondary #A6A6B0 |
| Accent (buttons, selected) | #7C3AED, hover #6D28D9 |
| Accent text / icons on dark | #C4A7FF |
| Selected tint | #231B36 |
| Font | Calibri, falling back to Carlito (free Google Font, same metrics) |
| Logo | assets/logo.png, with the tagline "Whatever the weather, get it right" |

Clean and minimal: sentence case, few borders, touch targets at least 44 px, phone width 390 px.

## Technical approach

A web app added to the iPhone's home screen, written by Claude Code in the cloud, stored on GitHub and hosted free on GitHub Pages, with everything personal kept on the phone and a running cost of £0.

| Part | Choice | Why |
| --- | --- | --- |
| Language and UI | HTML, CSS and JavaScript, one small web app | Runs in Safari on any iPhone; no Mac or Xcode needed |
| Code writing | Claude Code cloud sessions, from the Claude app | Writes, tests and commits the code; nothing installed on the work MacBook |
| Code storage | GitHub repository BJG-Code/what-to-wear | Save points to roll back to |
| Hosting | GitHub Pages (free) | Gives the app a web address; updates go live on each merge |
| On the iPhone | Safari, Add to Home Screen | Own icon, full screen, never expires |
| Location | Browser location permission | Phone's GPS |
| Weather | Open-Meteo, called from the browser | Free, no key |
| Storage | On the phone, in the browser's local storage | Profile, offsets and feedback log; no accounts |
| Font | Carlito (free, matches Calibri) | Same look on every device |

**Constraints**

- The work MacBook is used only for the Claude app; no developer tools are installed on it.
- A free GitHub account publishes Pages only from a public repository, so the code is public. It holds no personal data, which stays on the phone.
- Data saved on the phone lives in Safari's storage for that web address; removing the home-screen app or clearing website data wipes it.
- Forecasts are limited to 5 days ahead by design.
- No AI calls inside the app, so no usage costs.

## Acceptance criteria

v1.0 is done when every box below is ticked on my own iPhone.

- [ ] First launch shows "Getting to know you"; the profile survives closing and re-opening the app
- [ ] Day picker allows today plus up to 5 days and nothing later
- [ ] "What should I wear?" only works once day, time, distance, duration and effort are all set
- [ ] Plan a session greets me by name
- [ ] Forecast shown matches Open-Meteo for my location and chosen hour
- [ ] Running and cycling give different outfits for the same weather
- [ ] Each threshold in Outfit rules produces the item listed (checked at the boundaries, e.g. 7 and 8 °C)
- [ ] Notes appear only when they apply, for both activities, including weather changes during the session
- [ ] Each feedback rating moves the learned offset as specified, and Reset sets it to 0
- [ ] With location refused or no signal, the app explains itself instead of crashing
- [ ] Used before at least 3 runs and 2 rides, with feedback logged

## References

- [How core temperature affects training](https://dupontfitness.ca/post/how-core-temperature-affects-training), Dupont 24/7 Fitness, March 2026
- [How does exercise affect body temperature?](https://www.polar.com/en/guide/how-does-exercise-affect-body-temperature), Polar
- [Exercise, performance and temperature control](https://pubmed.ncbi.nlm.nih.gov/3883461/), Fortney and Vroman, Sports Medicine, 1985
