# NPL Matchup Lab

Download and extract the feature branch, then open `calculator.html` in a browser. The checked-in bundles, league data and sprites work from the extracted directory and on GitHub Pages. No installation is needed to use the calculator. Open **Matchup Lab** in Brice’s scouting dashboard to load his next scheduled match. Use `calculator.html?coach=coach_brice&opponent=coach_drake` for a particular opponent.

## Weekly updates

The site’s weekly refresh writes the current rosters and schedule to `window.NPL_LEAGUE` in `data/league.js`. Changes in the Google Sheet reach this calculator once the website snapshot is refreshed and published. There is no second roster list. Coach and Pokémon selection, regular/Mega switches and temporary builds exist only in browser memory. The next opponent comes from the earliest scheduled Season 2 match at or after the snapshot’s current week. An explicit opponent in the incoming URL takes precedence.

## Mechanics and scope

- The browser uses the Gen 9 engine in **@smogon/calc 0.12.0** with doubles fields, level 50, standard EVs, IVs and natures. The Showdown dex supplies possible abilities, Mega Stones, base forms and move suggestions. The build checks species types and stats against the calculator. Unverified forms produce an error.
- A drafted Mega opens in its evolved form with the required stone. Its regular form can hold another item. Mega Floette’s eligible regular form is Floette-Eternal. Aegislash can defend in either stance and attacks in Blade Forme. Weather and terrain describe the current field, including conditions set by abilities. Fresh entry Intimidate defaults on and can be toggled for a later turn.
- Compare Against Entire Roster uses the same attacker and field for every row. Each defending roster slot retains its own settings during the session. The table lists the assumptions, and selecting a row loads that exact build.
- OHKO odds count full-HP knockouts across the engine’s equally likely rolls. “KO within two uses” includes first-use KOs and counts all independent roll pairs under fixed conditions. Accuracy, end-of-turn effects, recovery and random secondary effects are excluded. Variable multi-hit moves use the engine’s assumed hit count. KO odds are withheld for multi-hit distributions, survival items/abilities or recognized changes between uses as appropriate. The simplified lab starts both Pokémon at full health.
- For a spread move with only one target left, doubles screen rules still apply. Expanding Force can change its target inside the engine. The adapter preserves its terrain boost while representing a single remaining target, with all rolls checked against the independent Showdown simulator.
- Paste one standard Showdown set under Advanced on either side. Nicknames, item, ability, gender, IVs, EVs, nature and the first damaging move load together. Explicitly supplied levels must equal 50. An invalid/off-roster import leaves the prior build intact. The league ignores an exported Tera Type.
- The full move menu supports hypothetical matchups and does not enforce learnset or team legality. Conditional moves that require unrepresented history or a target action report their limitation. Historical rosters, full-team imports, individual loan imports and an 8×8 matrix are deferred.

## Build and verify

From the repository root, use Node 22 or later.

```sh
npm ci
npm run build:lab
npm test
npx playwright-core install chromium
npm run test:browser
```

Alternatively set `CHROME_PATH` to an existing Chromium executable for the browser test. Rebuild after editing either application module, the build script or a pinned game-data dependency. Commit the generated assets with the source. Site visitors do not run a build.

The mechanics suite loads the shipped browser engine, compares its rolls with the upstream calculator’s Node interface and independently enumerates rolls in a Gen 9 doubles custom battle using **@pkmn/sim 0.11.0**. Scizor, both of Drake’s Fairy-types, Gyarados into Landorus-T, six newer Mega forms, doubles conditions, partial KO thresholds, invalid settings and every current roster slot are covered. The Chromium suite exercises the extracted site at 1366 px and 390 px, including scouting filters, next opponent, side swapping, roster comparisons, standings and match archive navigation.

## Files

| Path | Purpose |
|---|---|
| `calculator.html` | Static calculator page |
| `assets/lab/app.mjs`, `model.mjs`, `import.mjs`, `lab.css` | Interface, mechanics adapter and styling |
| `assets/lab/application.js`, `engine.js`, `forms.js` | Generated browser bundles and verified dex metadata |
| `assets/lab/licenses.txt` | Calculator, dex and Showdown notices |
| `assets/site.js`, `scouting.html` | Coach profile and scouting navigation |
| `tools/lab/build.cjs`, `test.cjs`, `browser-test.mjs` | Reproducible build, reference calculations and browser checks |
| `package.json`, `package-lock.json`, `.gitignore` | Pinned development dependencies and local install exclusion |
