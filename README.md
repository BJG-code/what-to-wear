# What to wear

Says exactly what to wear for a run or bike ride in London, up to 5 days ahead, and learns from how each outfit felt.

Live site: https://bjg-code.github.io/what-to-wear/

## How to use it

1. Open the site in Safari on the iPhone, tap **Share**, then **Add to Home Screen**. It gets its own icon and opens full screen.
2. The first time, fill in **Getting to know you**: your name, and whether you run hot, neutral or cold.
3. On **Plan a session**, choose running or cycling, the day (today up to 5 days ahead), start time, distance, duration and effort, then tap **What should I wear?**
4. **Your outfit** shows the dressing temperature and how it was worked out, six weather readings, the kit in three cards (Upper body, Lower body, Accessories) and any notes, such as "rain likely" or "take lights".
5. Once the session has finished, rate it **Too hot**, **Perfect** or **Too cold**. Each rating nudges future outfits by 0.5 °C, separately for running and cycling.
6. The cog opens **Settings**: your profile, the learned offsets with a Reset, and the rules of thumb.

It costs nothing to run: no accounts, no AI inside the app, and everything personal stays on the phone.

## More detail

- What the app should do: [docs/spec.md](docs/spec.md)
- What's been built, and in what order: [docs/gaps.md](docs/gaps.md)
- How each feature gets built: [docs/routine.md](docs/routine.md)
- Ideas for later: [ROADMAP.md](ROADMAP.md)

## Files

- `index.html`: the page and its styling
- `app.js`: location, weather and showing the results
- `weather.js`: picks the session's hours out of the forecast and turns them into the six readings
- `clothing.js`: the outfit rules
- `tests/`: automated checks, run on every pull request
- `assets/`: the logo and the home-screen icon

Weather data from [Open-Meteo](https://open-meteo.com/).
