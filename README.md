# What to wear

Says exactly what to wear for a run or bike ride in London, up to 5 days ahead, and learns from how each outfit felt.

Live site: https://bjg-code.github.io/what-to-wear/

## How to use it

A few friends are trying it out for two weeks. There's nothing to sign up for: just open the link.

1. **Add it to your home screen first.** The home-screen app keeps its own copy of your details, so set it up there rather than in the browser.
   - **iPhone:** open the link in Safari, tap **Share**, then **Add to Home Screen**.
   - **Android:** open the link in Chrome, tap the **⋮** menu, then **Add to Home screen** or **Install app**.

   It then gets its own icon and opens full screen, like an app.
2. The first time, fill in **Getting to know you**: your name, whether you run hot, neutral or cold, and your usual running pace and cycling speed.
3. On **Plan a session**, choose running or cycling, the day (today up to 5 days ahead), start time, distance, duration and effort, then tap **What should I wear?** Allow it to use your location for a local forecast, or search for a town; if it can't find you, it uses central London and says so.
4. **Your outfit** shows the dressing temperature and how it was worked out, six weather readings, the kit in three cards (Upper body, Lower body, Accessories) and any notes, such as "rain likely" or "take lights".
5. **Rate every session once it's finished**: open the outfit again and tap **Too hot**, **Perfect** or **Too cold**. Each rating nudges future outfits by 0.5 °C, separately for running and cycling, so it gets more accurate the more you use it.
6. The cog opens **Settings**: your profile and pace, what the app has learned (with a Reset), the rules of thumb, **Send my ratings**, and **About this app**.
7. **At the end of the two weeks**, tap **Send my ratings** in Settings and send the summary to whoever shared the link with you. It includes your hot or cold setting, pace and ratings, but not your name.

New versions arrive by themselves when you open the app.

## Your data

- Everything you enter stays on your phone. There's no account, and nothing is sent anywhere unless you tap **Send my ratings**.
- Deleting the home-screen app, or clearing the website's data in your browser settings, wipes it for good.
- The forecast comes from [Open-Meteo](https://open-meteo.com/), a free weather service, which is sent your location (or the town you searched for) and nothing else.
- It costs nothing to run: no accounts, no AI inside the app, no adverts.

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
- `manifest.webmanifest`: tells Android how to install the app
- `assets/`: the logo and the home-screen icons

Weather data from [Open-Meteo](https://open-meteo.com/).
