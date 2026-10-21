# PALLANGULI LEGENDS · பல்லாங்குழி

A browser version of Pallanguli, the traditional Tamil seed-and-pit (mancala-family) game. Mobile-first, works offline once loaded, no ads, no real money, no data collection. Presented by BALA HR.

Play: https://balachandarhr.github.io/pallanguli-legends/

- `js/engine.js` – pure rules engine (no DOM), shared by the UI, the AI and the tests
- `js/ai.js` – computer opponents, levels 1–5
- `js/app.js` – UI, canvas board, animation, sound, coins/progress (localStorage)
- `js/i18n.js`, `js/content.js` – English/Tamil text, rules, tutorial, history
- `tests/engine.test.js` – run with `node tests/engine.test.js`

Rules vary by family and region; the app offers selectable variants (Classic, Four-seed/Pasu, Six-seed, Multi-round) rather than claiming one authentic rulebook. Fonts: Noto Sans Tamil (SIL OFL, see fonts/OFL.txt).
