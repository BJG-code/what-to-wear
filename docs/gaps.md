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
| 10 | Settings screen and cog, units, rules of thumb | 4, 14, 15 |
| 11 | Home-screen icon, bigger tap targets, update README and ROADMAP | 38, 40, 41 |

Gap 42 (rewriting the old automated checks) happens in every session, alongside the gap being fixed.

## Screens and flow

- [x] 1. No "Getting to know you" first-launch screen (name, runs hot/neutral/cold, units, "Let's go").
- [x] 2. No separate "Plan a session" screen; everything is on one page.
- [x] 3. No "Your outfit" result screen with a back arrow and summary line (e.g. "Wed 28 Oct · 07:00 · Easy 8 km run").
- [ ] 4. No Settings screen or settings cog.
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
- [ ] 14. No units shown in the profile or Settings (km/h is already used, which is correct).
- [ ] 15. Rules of thumb can't be viewed or edited.

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

- [ ] 33. No feedback buttons (Too hot / Perfect / Too cold).
- [ ] 34. No learned offsets (separate for running and cycling, ±0.5 °C a rating, capped at ±5 °C) and no Reset.
- [ ] 35. Ratings aren't saved with their forecast, effort, distance and duration.
- [ ] 36. No "only ask after the session has finished" logic.

## Design

- [x] 37. Colours are close but not exact: cards #18181F (should be #18181D), borders #2A2A35 (#26262D), text #ECECF1 (#F4F4F6), secondary text #9A9AA8 (#A6A6B0), accent text #A78BFA (#C4A7FF); hover #6D28D9 and selected tint #231B36 aren't used.
- [ ] 38. Some buttons are smaller than 44 px to tap (e.g. "Change", the choice buttons).
- [x] 39. Font order is Carlito then Calibri; the spec says Calibri first, Carlito as the fallback.

## Home screen and housekeeping

- [ ] 40. No home-screen icon, so "Add to Home Screen" won't show the app's own icon.
- [ ] 41. README and ROADMAP describe the old version and contradict the spec.
- [ ] 42. The automated checks test the old rules and layout; they'll be rewritten gap by gap as each one is fixed.

## Open questions

- [x] Thresholds are whole numbers (6 to 10, 5 or below), so 10.5 °C has no clear answer. Decided 31 Oct 2026: round the dressing temperature to the nearest whole degree (halves round up), and use that rounded number for the outfit. Added to the spec.
- [x] The spec said sun cream is "not overcast" without saying how cloudy that is. Decided 31 Oct 2026: 50% cloud cover or more counts as overcast. Added to the spec.
