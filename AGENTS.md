# EcoCity: handbook for AI agents and developers

Read this before changing code. It is meant to save every agent (Claude, Gemini, ChatGPT or a human) from re-analysing the whole codebase.

- **Repository:** https://github.com/bhaveshkankatala-blip/Eco-city (branch `main`)
- **Live build:** a Claude artifact. `dist/index.html` is what gets published.
- **Game rules and numbers:** [docs/GAME_DESIGN.md](docs/GAME_DESIGN.md)

## 0. What changed in v6 (branch `v6`)

- **Workers:** `Eco.addBuilding(..., workers)` and `Eco.setWorkers(S, id, n)` set a building's crew (clamped to min–max per block). Output is proportional to the crew (`_eff = _w / max`). `Eco.autoAssign(S, flows)` gives unemployed adults to understaffed buildings; `step()` calls it every year. UI: crew dialog on placement (`askCrew`), workers panel (`openWorkers`), crew slider in the inspector.
- **Crises hit at once:** event `impact` can carry `killPct`, `waterPct`, `foodStorePct`, `money`, `destroy`. `resolveEvent` returns an `impact` summary and pushes `S.marks` (drawn as red/blue lines on the live graphs). Choices can have `need` (disabled when the city cannot afford them); `relevantEvent` swaps events that make no sense for the city.
- **Water:** reservoir 10,000, refilled by `0.2 × empty space × rain` every year; rain showers are drawn in `game.js` (`rainTick`, overlay canvas) and darken the sky (`R3.weather`).
- **Scoring:** round weights 20/40/40 (`ERA_W`), Level 1 budget ₹50 L, upgrade block cost `cost × (0.9 + 0.3 × blocks)`, SDG 11 = homes 50% + road access 25% + green blocks per 500 people 25%.
- **Login and results:** team name + lead phone only. Results go to the Google Sheet (`tools/google-sheet/Code.gs`, action `board` for the public leaderboard). Hosting: `netlify.toml`, `npm run build:site`, [docs/HOSTING.md](docs/HOSTING.md).
- **Input:** touchpad two-finger scroll pans, pinch zooms, mouse wheel zooms; the ⇅ map button flips directions (saved in `localStorage['eco-camflip']`).

## 1. Ground rules

1. **No dependencies and no build tools beyond Node.** The game must stay one self-contained HTML file. The artifact host only allows Google Fonts and a few script CDNs; everything else is blocked, so don't add images, fonts or libraries from other hosts. Draw assets in code.
2. **Run `npm test` before every commit.** For anything that touches the UI or 3D, also run the e2e playthrough (`npm run build:test && python tests/e2e/playthrough.py`).
3. **The artifact viewer ignores `alert()`, `confirm()` and `prompt()`.** Confirmations are built into the page (see `confirmBox` in `game.js`).
4. Keep the simulation (`engine.js`) free of DOM and rendering code, so it stays testable in Node and portable to Roblox (Luau).

## 2. Build and run

| Command | What it does |
|---|---|
| `npm run build` | Inlines `engine.js + gl.js + world.js` at `/*ENGINE*/` and `game.js` at `/*GAME*/` in `src/index.html` → `dist/index.html` |
| `npm run build:test` | Same, plus replaces `/*TEST*/` in `game.js` with `window.__t = {S, E, refresh, finishLevel, ui, clickTile, setHover}` → `dist/test.html` |
| `npm start` | Build + serve `dist/` on http://localhost:8080 |
| `npm test` | `node --check` on all sources + `node --test` (tests/*.test.js) |
| `python tests/e2e/playthrough.py [w h]` | Full browser playthrough with screenshots (needs Playwright + Chromium) |

## 3. Architecture

```
src/index.html ── CSS + DOM skeleton (top bar, stats, right column, build bar, overlays)
   script 1: engine.js → window.Eco  (simulation; also module.exports for Node)
             gl.js     → window.GL3  (WebGL 2 engine: M4 math, Geo builder, Engine)
             world.js  → window.R3   (3D scene: reads Eco state, never mutates it)
   script 2: game.js   (IIFE: game flow, HUD, input, persistence, organiser panel)
```

Data flows one way: **game.js mutates state through `Eco` → calls `refresh()` → panels re-render and `R3.sync(S, flows)` updates the 3D scene.** `R3` reads state; it never changes the simulation.

## 4. Game state (`S`)

Created by `Eco.newGame(seed, team)`. It is a plain JSON object and is saved to `localStorage['ecocity.game']` after every action, so a crashed laptop can resume.

| Field | Meaning |
|---|---|
| `seed`, `team` | map seed (random per game), team name |
| `level` (1–3), `year`, `phase` | `phase`: `'plan'` building, `'sim'` time jump running, `'between'` jump done, `'done'` finished |
| `tiles[225]` | 15×15 world. `{x, y, t, dep, b, v}`: `t` = `grass\|river\|coal\|gold\|uranium\|mineral`, `dep` = deposit id, `b` = building id, `v` = random 0–1 for decoration |
| `deposits{id}` | `{type, tiles[], reserve, max}`: reserve falls each year a factory works it |
| `buildings{id}` | `{type, tiles[], workers, initial}` plus fields written by `flows()`: `_eff` (0 = closed, else 0.6–1 output), `_road`, `_dead` (deposit empty), `_w` |
| `pop`, `money` (₹ thousands), `water` (reservoir), `foodStore`, `pollution` (0–100) | city stocks |
| `history[]` | one record per simulated year: `{year, pop, money, pollution, food, water, energy, drought, sdg}` |
| `log[]` | event messages shown during time jumps |
| `sdgSum`, `sdgYears` | running SDG totals → `Eco.result()` averages them |
| `streak {short, pol}`, `dead {year, why}` | death-rule counters and the cause of death |
| `finalStart` | year the final run began (drives the drought schedule) |
| `cfg`, `deadline`, `startedAt`, `saved`, `over` | added by game.js: settings snapshot, timer end (ms), timestamps, save flags |

Levels: `Eco.LEVELS[n] = {size, off, title, sub}`. The playable land is the square `off .. off+size-1` inside the 15×15 world (10×10 → 12×12 → 15×15).

## 5. Simulation API (`engine.js`, `window.Eco`)

| Function | Notes |
|---|---|
| `newGame(seed, team)` | Map with river, deposits (same counts every game, random positions) and a starting village of 6 homes |
| `canPlace(S, type, i)` | `{ok, why}` or `{ok, fp, cost}`. All placement rules live here (level unlock, land, deposits, river, money, water) |
| `build(S, type, i)` / `demolish(S, id)` | `build` pays cost + construction water |
| `footprint(S, type, i)` | Tiles a building would cover (whole deposit for factories) |
| `flows(S)` | **Derived numbers for the current state. Not stored.** Staffing, energy, food, water, money, pollution target, coverage. Writes `_eff/_road/_dead` onto buildings |
| `outlook(S)` | `flows` + this-year SDG estimate (the HUD's "SDG outlook") |
| `step(S, mode)` | Simulates one year. `mode='fixed'` (Level 1→2: births 3%, deaths 1%) or `'dyn'` (planning-driven growth) |
| `advance(S, years, mode)` | Repeated `step` until dead |
| `startLevel(S, n)`, `result(S, cap)`, `isDrought(S)` | |
| `B` | Building catalogue (all balance numbers). `SDGS`, `LEVELS`, `DROUGHTS`, `WORLD` |

**Death rules** (only in `'dyn'` mode): population under 5; food or water below 90% of need for 8 years in a row; pollution above 75% for 10 years in a row.

**Workers:** 60% of the population works. Buildings are staffed in priority order: power → food → water → health and storage → schools → everything else. A building below its minimum staff is closed (`_eff = 0`).

## 6. 3D view API (`world.js`, `window.R3`)

`init(canvas, overlayEl)` · `load(S)` (rebuild the whole island for a new game) · `setLevel(n, instant)` (re-tint locked land, border, fit camera) · `sync(S, flows, animateNew)` (add or remove building meshes, roads, deposits, status, environment targets) · `envNow()` (skip environment easing) · `hover(i, tool, ok, fp)` · `select(id)` · `grid(on)` · `orbit(on)` · `pan/rotate/rotateStep/zoom/recenter/lookTile` · `pick(sx, sy)` → tile index · `project(x, y, z)` / `projectTiles(tiles, y)` → screen point · `puff(tiles)` · `thumb(type)` → PNG data URL for build cards · `setInsets({l, r, t, b})` (HUD panel sizes, so the camera centres the city in the free area) · `frame(t)` (call every animation frame) · `_dbg()` (debug snapshot).

**State-driven scenery** (`computeEnv` in world.js):

| Game value | What changes on screen |
|---|---|
| `S.pollution` (from 12% up to 80%) | Sky turns brown, haze thickens, smog sprites appear, grass and trees go yellow-grey, water turns murky, sunlight dims |
| Drought (`isDrought`) | Grass turns yellow, river level drops |
| `S.water / waterCap` | Water level in the river channel (empty reservoir = dry sandy bed) |
| `S.dead` | Everything greys out |
| `_eff == 0` / `_dead` | Building dims, smoke and rotors stop, icon badge shown (no workers / used up) |
| Deposit `reserve` | Ore rocks on unbuilt deposits thin out as they deplete |

Models: `MODELS[type](geo, fp, ctx)` in world.js builds each building from primitives (box, cylinder, cone, gable/hip roof, lathe). Tile = 1 unit; the ground is at y = 0. Multi-tile buildings get the footprint offsets.

## 7. UI (`game.js`, DOM ids in `src/index.html`)

- **Flow:** `showStart()`/`showDemo()` → `newGame(team)` → planning (`refresh()`, `clickTile(i)`) → `finishLevel()` → `runSim(opt)` → `goLevel(n)` → … → `showResult()` → `saveResult()`.
- **Views:** `#app[data-view]` is one of `start | plan | sim | result`. CSS hides panels per view. `setView()` also re-fits the camera via `layoutInsets()`.
- **Panels:**
  - `renderStats`, `renderObjectives` (`objectives()` lists the per-level goals), `renderAdvisor` (`advice()`), `renderInspector`, `renderCards` (tabs in `TABS`), `renderMinimap`, `renderTop`.
  - Time-jump dock: `#simScreen`; result: `#resultScreen`; organiser: `#pinScreen`, `#orgScreen`.
- **Persistence:** `LS` wraps `localStorage` (`ecocity.settings`, `ecocity.game`, `ecocity.results`, `ecocity.pending`). `initDb()` / `saveResult()` use the artifact `db` capability when available.

## 8. Entry points for automated gameplay testing

- **Pure simulation (fast, no browser):** `require('./src/engine.js')`. See `tests/engine.test.js` for helpers that place buildings and play a full game. Good for balance experiments and AI-vs-AI strategy testing.
- **Browser (test build):**
  - `window.__t.S` (live state), `__t.E`, `__t.refresh()`, `__t.finishLevel()`, `__t.clickTile(i)`, `__t.setHover(i)`.
  - `R3.projectTiles([i])` gives screen coordinates for real mouse clicks.
  - `tests/e2e/put.js` places buildings by plan.
- **Stable selectors:** `#teamName`, `#startForm`, `#tabs [data-tab=agri|industry|housing|energy|infra|services|tools]`, `#cards [data-type=<building>]`, `#finishBtn`, `#cfYes`, `#simSkip`, `#simNext`, `#resRing`, `#resDone`, `#mapCtl [data-cam=l|r|in|out|home]`, `#startOrg`, `#pinIn`, `#lbBody`.

## 9. Change with care (investigate first)

| Area | Why |
|---|---|
| Numbers in `B`, `flows()`, `step()`, `sdgYear()`, `result()` | Balanced together. A good test city scores ~78–81 and survives 500 years; a bad one dies in under 60 years with ~57. `npm test` guards this; re-run the balance after any change. |
| Results record shape (`saveResult` in game.js) and db paths `results/*`, `config/settings` | The organiser leaderboard reads them, and live data already exists in the hosted artifact. |
| `ecocity.game` save format | Resuming an interrupted game depends on it. |
| `/*ENGINE*/`, `/*GAME*/`, `/*TEST*/` placeholders | The build script relies on them. |
| Shader precision lines and the shadow sampler in gl.js | Some GPUs refuse to compile if vertex and fragment precision differ. |
| Projection shift in `camMatrices()` and `R3.pick()` | Clicking a tile depends on them matching. |
| `[hidden] { display:none !important }` in CSS | Without it, hidden overlays block clicks. |

## 10. Known issues and incomplete features

1. **Real-GPU performance is untested.** Testing so far used software WebGL (SwiftShader, ~0.4 s per frame). Check the frame rate on an actual festival laptop. Possible levers: `DPR` cap and the shadow map size (`SM`) in gl.js, terrain `STEP` and tree density in world.js.
2. **Organiser PIN default `2026` is in the public source.** Change it in the organiser panel; the value saved in the shared store overrides the default.
3. **The shared leaderboard only works in the Claude artifact**, on signed-in laptops. Opened anywhere else, results stay in that browser's localStorage.
4. **SDG 4 (Education) is 0 unless a school is built**, and SDG 9 (Infrastructure) tends to be low. This is intentional pressure, but worth a balance review.
5. The starting village homes can be demolished. There is no refund for any demolition.
6. The mini map does not rotate with the 3D camera.
7. There are no touch gestures (pinch or two-finger rotate); the game is mouse- and keyboard-first.
8. After a reload mid-level, the timer resumes with at least 2 minutes left.
9. There is no 2D fallback if WebGL 2 is unavailable; the page shows a message instead.
10. The 3D map is not keyboard-accessible for building; only camera keys work.
11. The Roblox version has not been started. `engine.js` is the part to port (Luau); world.js shows the look and the state → scenery mapping.
12. `R3._dbg()` is a debug helper left in on purpose.

## 11. History

- **v0.1** — 2D isometric canvas web beta (engine + HUD + organiser leaderboard).
- **v0.2** — 3D renderer written from scratch on WebGL 2. CDNs were unreachable from the build environment, and having no library also makes the game work offline. The floating island, state-driven environment, time jumps on the live map and placement preview were added in this version.
- **v0.3** — Repository set up: build/serve scripts, tests, docs.
