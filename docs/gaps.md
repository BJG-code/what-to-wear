# Gap list: current app vs spec

Every difference between the app as it is today and `docs/spec.md` (updated 31 Oct 2026). Tick each gap off when done.

## Build order

One session at a time, in this order. Each builds on the one before. Target: on the iPhone by Sun 22 Nov 2026, so about three or four sessions a week.

| Session | Builds | Gaps |
| --- | --- | --- |
| 1 | Logo and tagline, exact colours, font order | 5, 37, 39 |
| 2 | Split into "Plan a session" and "Your outfit" screens | 2, 3 |
| 3 | "Getting to know you" screen, "Hello Bradley", Runs hot / Neutral / Runs cold | 1, 6, 13 |
| 4 | Day, start time, distance, duration and effort inputs, and the "What should I wear?" button | 7, 8, 9, 10, 11, 12 |
| 5 | Forecast for the chosen day and time, six readings, central London fallback, decide on town search | 16, 17, 18, 20, 21 |
| 6 | Dressing temperature and its breakdown | 22, 23 |
| 7 | New running and cycling rules, gilet, waterproof, sun items, remove extra items | 24, 25, 26, 27, 28, 29 |
| 8 | Three outfit cards and the notes, including weather changes during the session | 19, 30, 31, 32 |
| 9 | Feedback buttons, learned offsets, saved ratings, ask only after the session | 33, 34, 35, 36 |
| 10 | Settings screen and cog, units, rules of thumb, Reset for the learned offsets | 4, 14, 15, 34 |
| 11 | Home-screen icon, bigger tap targets, update README and ROADMAP | 38, 40, 41 |

Gap 42 (rewriting the old automated checks) happens in every session, alongside the gap being fixed.

## Screens and flow

- [x] 1. No "Getting to know you" first-launch screen (name, runs hot/neutral/cold, units, "Let's go").
- [x] 2. No separate "Plan a session" screen; everything is on one page.
- [x] 3. No "Your outfit" result screen with a back arrow and summary line (e.g. "Wed 28 Oct · 07:00 · Easy 8 km run").
- [x] 4. No Settings screen or settings cog.
- [x] 5. The logo image and tagline aren't shown; the page uses a purple text heading instead.
- [x] 6. No "Hello Bradley" greeting.

## Session inputs

- [x] 7. No day picker (today + 5 days). The app only shows the weather right now, so it can't plan a 07:00 ride tomorrow.
- [x] 8. No start-time picker.
- [x] 9. No distance input (− / km / +).
- [x] 10. No duration input.
- [x] 11. No effort choice (Easy / Medium / Hard with heart-rate ranges).
- [x] 12. No "What should I wear?" button, and no check that every input is filled in.

## Profile

- [x] 13. Hot/cold choice says "Feel the cold / Feel normal / Run warm" and moves by 3 °C; should be "Runs hot / Neutral / Runs cold" moving by 2 °C.
- [x] 14. No units shown in the profile or Settings (km/h is already used, which is correct).
- [x] 15. Rules of thumb can't be viewed or edited. Done 31 Oct 2026: tap a row in Settings to move it 1 °C at a time; the rows stay in order.

## Weather

- [x] 16. Uses the current weather (plus the highest rain chance over the next 3 hours), not the hourly forecast for the chosen day, time and duration.
- [x] 17. Doesn't fetch gusts, humidity or cloud cover.
- [x] 18. Shows a one-line summary instead of the six readings (temp, wind + gust, rain, sky, humidity, light).
- [x] 19. No notes about weather changing during the session.
- [x] 20. If location is refused, it asks you to search for a town; the spec says use central London and say so.
- [x] 21. Town search and the remembered holiday location aren't in the spec (saved locations are a later idea). Decide: remove, or keep as an extra. Decided 31 Oct 2026: keep it, and added to the spec.

## Outfit rules

- [x] 22. No dressing temperature: effort, distance and learned offset are missing, and cycling takes off 2 °C instead of 4 °C.
- [x] 23. The dressing temperature and how it was worked out aren't shown.
- [x] 24. Running thresholds and items are different from the spec (vest 16+, T-shirt 11–15, long sleeve 6–10, long sleeve + gilet 5 or below; shorts 8+ else tights; headband 4–8; hat below 4; gloves below 7).
- [x] 25. Cycling thresholds and items are different from the spec (short sleeve 18+, + base layer 13–17, long sleeve + base layer 8–12, long sleeve + gilet 7 or below; shorts 12+ else tights; buff below 8; gloves below 10).
- [x] 26. Items not in the spec to remove: packable rain jacket at 30%, windproof jacket or gilet based on wind speed, overshoes, socks, arm and knee warmers, mitts, reflective kit.
- [x] 27. Sun rules differ: today "sunglasses and sun cream" appear together at 18 °C+ on clear days; should be sun cream at 16 °C+ (daylight, not overcast) and sunglasses separately when cloud cover is 30% or less.
- [x] 28. Missing the running gilet rule (gusts 40 km/h or more and dressing temp below 12).
- [x] 29. Running gets a waterproof when rain is 50%+; the spec says no kit change for rain when running (waterproof is cycling only).
- [x] 30. Kit is a head-to-toe list, not three cards (Upper body, Lower body, Accessories) with icons.

## Notes

- [x] 31. No notes section; rain, wind and dark become clothing items instead of notes ("rain likely", "gusty", "take lights").
- [x] 32. No "You'll start a little chilly, but you'll warm up as you go" note.

## Feedback

- [x] 33. No feedback buttons (Too hot / Perfect / Too cold).
- [x] 34. No learned offsets (separate for running and cycling, ±0.5 °C a rating, capped at ±5 °C) and no Reset. Offsets done 31 Oct 2026; Reset added in Settings 31 Oct 2026.
- [x] 35. Ratings aren't saved with their forecast, effort, distance and duration.
- [x] 36. No "only ask after the session has finished" logic.

## Design

- [x] 37. Colours are close but not exact: cards #18181F (should be #18181D), borders #2A2A35 (#26262D), text #ECECF1 (#F4F4F6), secondary text #9A9AA8 (#A6A6B0), accent text #A78BFA (#C4A7FF); hover #6D28D9 and selected tint #231B36 aren't used.
- [x] 38. Some buttons are smaller than 44 px to tap (e.g. "Change", the choice buttons). Done 31 Oct 2026: Change, Search, the town search box, "Use my current location" and the distance and duration boxes are now all at least 44 px.
- [x] 39. Font order is Carlito then Calibri; the spec says Calibri first, Carlito as the fallback.

## Home screen and housekeeping

- [x] 40. No home-screen icon, so "Add to Home Screen" won't show the app's own icon.
- [x] 41. README and ROADMAP describe the old version and contradict the spec.
- [x] 42. The automated checks test the old rules and layout; they'll be rewritten gap by gap as each one is fixed. Done 31 Oct 2026: rewritten across sessions 1 to 11.

## Change requests

- [x] C1. Running and cycling share one distance, so switching activity keeps the same number. Done 6 Nov 2026: each activity remembers its own last distance (first time: running 5 km, cycling 20 km).

- [x] C2. Duration was always estimated at 6 min/km for running and 25 km/h for cycling, whatever your own pace. Done 6 Nov 2026: "Your usual pace" is asked on Getting to know you and can be changed in Settings, and Plan a session estimates the duration from it and says so.

- [x] C3. People didn't understand how a rating changes the next outfit: one rating moves the dressing temperature only 0.5°, so the kit often stays the same, and "Learned −0.5°" in the breakdown read backwards (minus means warmer). Agreed 13 Nov 2026. Done 13 Nov 2026: the thank-you says what will happen and why the kit may not change yet, the breakdown says "From your ratings: 0.5° warmer / lighter / no change yet", and Settings has a short "How learning works" note. How learning works is unchanged. Follow-up 13 Nov 2026: "From your ratings" became "From your previous feedback", and the "What the app has learned" heading is easier to see.

## Bugs

- [x] B1. After a merge, the iPhone home-screen app kept showing the old version, because it reused its saved copies of weather.js, clothing.js and app.js. Done 6 Nov 2026: each release has a version number on its file links so the phone fetches fresh copies, Settings shows the version, and the automated checks fail if a change to the app forgets to update it.

- [x] B2. A new release could take about 10 minutes to reach the phone after merging. Done 6 Nov 2026: opening the app (or coming back to it) checks for a newer release and loads it straight away, but never while you're looking at an outfit or Settings. (Was C2; renamed B2 as a follow-up to B1.)

## Trial with a small group (agreed 7 Nov 2026)

Before inviting up to 10 friends (most likely about 5) to try the app through the shareable link. Details in the spec under "Trial with a small group". Build these in order, one per session, once v1.0 criterion 11 is ticked. Aim: all live and invites sent by Sun 22 Nov 2026.

| Session | Builds | Gaps |
| --- | --- | --- |
| 12 | "Send my ratings" in Settings | T1 |
| 13 | Install on Android, and a first-visit "add to home screen" hint | T2 |
| 14 | "About this app" in Settings, and README updated for trialists | T3 |

- [ ] T1. Trialists' ratings never leave their phones, so there's no way to learn from the trial. Add "Send my ratings" in Settings: opens the phone's share sheet with a plain-text summary (profile type, usual pace, learned offsets, and each rating with date, activity, forecast, effort, distance, duration and outfit); copies it instead if sharing isn't available. No name unless they add it, and no email address in the code.
- [ ] T2. Android can't install the app properly (it has only the iPhone icon), and someone opening the link in a browser isn't told how to add it to the home screen. Add the description file Android needs (name, icons, colours, opens full screen) and a closable first-visit hint with the Safari and Chrome steps, shown only in the browser, not from the home screen.
- [ ] T3. Nothing in the app says what it is, that it's a trial, or what happens to your data. Add "About this app" to Settings (data stays on the phone, deleting the app or clearing website data wipes it, forecast from Open-Meteo using your location, how to send feedback), and update the README's "How to use it" for trialists, including Android.

## Open questions

- [x] Thresholds are whole numbers (6 to 10, 5 or below), so 10.5 °C has no clear answer. Decided 31 Oct 2026: round the dressing temperature to the nearest whole degree (halves round up), and use that rounded number for the outfit. Added to the spec.
- [x] The spec said sun cream is "not overcast" without saying how cloudy that is. Decided 31 Oct 2026: 50% cloud cover or more counts as overcast. Added to the spec.
