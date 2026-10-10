# Design review request: EcoCity – Build to Last

You are acting as a senior UI/UX and visual designer for a city-building game. I'm the developer. I'll implement your recommendations myself, so I need **honest critique and an implementable, prioritized design spec**, not code. Attached are 12 screenshots of the current build and the source files.

## 1. What the game is

- A sustainability city-builder for a **college technology festival in India**. Teams of 3–5 students share **one organiser-provided laptop** (most are **1366×768**, some 1920×1080), play for about 45 minutes, then see their own result. Organisers see a leaderboard separately.
- **3 levels, each on a timer** (Level 1: 20–30 min, Level 2: 5–10 min, Level 3: 5–15 min). The land grows each level: 10×10 → 12×12 → 15×15 tiles.
  - **Level 1, "Foundations":** building is free; land, workers and water are limited. Factories must sit on their own deposit (coal factory on the 3-tile coal deposit, gold on gold, nuclear plant on the 4-tile uranium deposit, mines on natural-resource tiles). The money earned is banked for Level 2.
  - **Level 2, "Grow":** players spend Level 1 money on housing (individual houses, community housing, apartments), clean energy (solar, wind, dam on the river), roads/bridges, schools and water treatment.
  - **Level 3, "Plan for the future":** food storage, hospitals, energy storage, industrial park, pollution control, parks and forests.
- **Between levels, time jumps:** 5–10 years after Level 1 (fixed birth/death rates), 50 years after Level 2 (population growth now depends on how well the city was planned). After Level 3 the city runs on its own, with scheduled droughts, until it dies or reaches year 500/1000.
- **A city dies when:** its population reaches zero, food or water stays short for 8 years in a row, or pollution stays above 75% for 10 years in a row.
- **Score:** the average of 11 UN SDG sub-scores over every simulated year (SDGs 2, 3, 4, 6, 7, 8, 9, 11, 12, 13, 15). Ties are broken by years survived.

The core message the visuals must carry: **every decision has a cost the city pays later.** Coal runs out, pollution builds up, droughts come, and crowding kills.

## 2. Technical constraints (important – please design within these)

- **One self-contained HTML page** hosted as a sandboxed web artifact. There is no build step and no image files. Assets must be **drawn in code** (Canvas 2D or inline SVG) or embedded as data URIs.
  - External scripts may load only from cdnjs/jsdelivr/unpkg. Fonts may load only from Google Fonts.
  - Three.js would be allowed, but the team wants 2.5D isometric, and I'd rather not rewrite the renderer.
- **Current renderer:** Canvas 2D with isometric 2:1 tiles (64×32 px at zoom 1), drawn back to front by diagonal.
  - Every building is drawn procedurally from primitives: an extruded isometric box, a hip roof, a cylinder, a cone tree.
  - Animation runs on a `requestAnimationFrame` loop: river ripples, chimney smoke, wind-turbine blades and a glowing uranium deposit.
- **Current HUD:** plain HTML/CSS panels floating over the full-screen canvas, in a single dark theme.
  - Fonts: Fredoka (display) and Lexend (body).
  - Panels: top bar (brand, level card, countdown timer, objectives, Rules/Organiser buttons, green "Finish level" button), left "City Statistics" panel, right column (inspector / City Advisor / mini map), and a tabbed build bar at the bottom with cards showing a procedural building preview, price and effects.
- **Time jumps** currently open a modal over the blurred city: a big "Year N" counter, 4 stat tiles, a line chart (population, money, pollution, drought bands) and an event log.
- **Result screen:** a modal with an SDG ring score, fate ("still thriving" / "dead planet"), and 11 SDG bars in official SDG colours.
- It must stay readable for a group of 3–5 people crowded around one laptop screen, and use the mouse: click to build, drag to pan, scroll wheel to zoom.
- It must run smoothly on mid-range college laptops with integrated graphics.

## 3. Real game state available to the visuals (do not invent other metrics)

Per tile: `t` = grass | river | coal | gold | uranium | mineral; deposit `reserve`/`max` (depletes over time); the building on it.

Per building: `type`; workers assigned (min/max); `_eff` (0 = closed for lack of workers or a used-up deposit, otherwise 0.6–1.0 = running); `_road` (next to a road: +15% output).

City-wide (recomputed whenever something changes, and every simulated year):

| Field | Meaning |
|---|---|
| `pop`, `cap` | population, housing capacity |
| `food`, `foodDemand`, `foodStore`, `foodCap` | food grown/eaten per year, stored food |
| `water`, `waterDemand`, `state.water`, `waterCap` | water in/out per year, reservoir level (the paper design calls this a "water level indicator") |
| `gen`, `eDemand`, `cleanShare` | energy generated/needed, share from clean sources |
| `jobs`, `workforce`, `employment`, `unstaffed` | employment, number of buildings closed for lack of workers |
| `money`, `net` | budget (₹ thousands), net income per year |
| `pollution` (0–100%), `polTarget` | current pollution and where it's heading |
| `green` | green-cover share |
| `connected` | share of buildings on a road |
| `eduCov`, `healthCov` | school/hospital coverage |
| `drought` | true during drought years in the final run |
| `year`, `level` | game year and current level |
| SDG sub-scores | 11 values, 0–100, every year |
| `dead` | `{year, why}` when the city has died |

Yearly history is stored too (pop, money, pollution, food/water/energy ratios, drought flag, SDG).

## 4. Problems I've already found (please confirm, reject or add to them)

1. **It looks like a board game, not a city.** The checkerboard grass has grid lines everywhere; buildings fill only about a third of a tile; roads are isolated tiles with an X mark and don't connect; deposits read as dirt patches; there's no lighting or shadow. Empty land dominates (41 of 225 tiles built in a typical Level 3).
2. **The environment ignores the simulation.** 5% and 70% pollution look identical. A full reservoir and an empty one look the same. Drought only tints the screen during the final run. Depleted mines look exactly like active ones. Closed buildings get a red "!" badge that reads as a software error.
3. **The most dramatic moment hides the city.** Time jumps (50 years! the coal running out! the population crashing!) happen in a modal over a blurred map.
4. **At 1366×768 the HUD crushes the map.** The build bar takes about 200 px (26% of the height), the stats panel gets cut off below "Green cover", and the level card, objectives and advisor all compete at the same visual weight. The mini map duplicates the map that's already fully visible.
5. **No feedback when acting.** Placing a building has no animation and no preview of its impact before the click (e.g. "+40 food, −30 water"), and no floating numbers after.
6. **The start screen is a generic modal** over a dimmed, empty HUD. It has no identity moment.
7. **Locked future land** is drawn as a dark, desaturated grid instead of something that invites expansion.

The original UI mockup (attached as `reference-mockup.png`) is the look the team wants: lush trees and forest, mountains and a waterfall, a river with banks, clouds around the island edge, a dense road network, warm light, and a game-style HUD with tabbed building cards. They want the HUD layout of that mockup, but the mechanics in this spec take priority over anything shown in it.

## 5. What I need from you

1. **Honest critique** of the attached screenshots, from the point of view of a professional game UI designer. What looks unfinished, generic or confusing? Rank the issues by how much they hurt first impressions and playability.
2. **One distinctive visual direction** for EcoCity, with a name and a 3–4 sentence description, that avoids generic "AI dashboard" looks: no glassmorphism, no purple gradients, no neon-on-black. Give a palette with hex values for terrain, water, buildings, UI surfaces, text and semantic colours (good/warning/critical), and say how it should shift as pollution rises.
3. **Specific recommendations**, component by component:
   - **City environment:** terrain and grass variation, river banks, scenery outside the playable area, how locked land should look, the island edge, lighting/shadow direction, building scale and silhouettes, road auto-tiling, and ambient life (cars, people, birds, clouds) – keep it feasible in Canvas 2D.
   - **HUD at 1366×768:** a layout with pixel sizes for each region, what is always visible and what appears only on interaction, and how the 8 key metrics should be shown.
   - **Menus and panels:** start screen, the level-transition / time-jump presentation, inspector, advisor, result screen.
   - **Typography:** keep or replace Fredoka/Lexend? Give a type scale.
   - **Animation and interaction:** placement, hover, selection, invalid placement, building closing, deposit running out, drought arriving, pollution crossing thresholds, city death.
4. **How the visuals communicate sustainability and consequences**, mapped to the real state fields in section 3. Example format: "`pollution` 0→100 drives sky haze opacity 0→0.45 and grass saturation 100%→55%". Give the mapping for every field you use. Don't invent metrics the game doesn't have.
5. **A prioritized implementation spec.** Number each item with: visual impact (H/M/L), effort (H/M/L), risk to existing gameplay (H/M/L), the component it touches, and concrete values (sizes, colours, durations, easing). Order by impact ÷ effort. Mark anything that needs new gameplay logic (e.g. "show people walking" needs nothing new; "show traffic jams" would need logic that doesn't exist) as **presentation-only** or **needs logic**.

Be concrete and opinionated. If something in my problem list is wrong or unimportant, say so.

## Attached

- `laptop-*.png` (1366×768) and `fhd-*.png` (1920×1080): start screen, empty Level 1, built Level 1, the time-jump modal, built Level 3, result screen.
- `reference-mockup.png`: the team's target look. Please attach this one yourself; it's the AI-generated mockup image you created earlier.
- `source/index.src.html` (HTML and CSS), `source/game.js` (renderer + UI), `source/engine.js` (simulation – read only, for reference).
