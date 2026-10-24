# EcoCity: game design

This is the team's final game plan (written on paper, Oct 2026) together with the values chosen for the web beta. The code is the source of truth for numbers: `src/engine.js` (`B`, `LEVELS`, `DROUGHTS`) and the settings defaults in `src/game.js`.

> **v7 rules** (override v6): debt costs 4% interest, cuts services after 5 years and bankrupts a city after 20 in the final run; under half the power for 15 years in the final run ends a city and power cuts kill; schools train the next generation (plants, factories and hospitals 70%–120%); forests cost 20% more each and halve after 8; nuclear counts half clean and its waste lowers SDG 12; solar unlocks in Level 1.
>
> **v6 numbers** (these override older values below): Level 1 budget ₹50 L; reservoir 10,000 with 20% of the empty space refilled by rain each year; round weights 20% / 40% / 40%; building output proportional to its crew; upgrade steps cost 1.2×, 1.5×, 1.8× a new block. See [AGENTS.md §0](../AGENTS.md#0-what-changed-in-v6-branch-v6).

## Format

- Teams of 3–5 share one organiser laptop. They enter a team name, play all three levels, and see only their own result. Organisers see the leaderboard on a PIN-protected panel.
- Ranking is by **SDG score** (the average of 11 SDG sub-scores over every simulated year). **Years survived** breaks ties.

## Levels

| | Land | Time (default, adjustable) | Theme |
|---|---|---|---|
| Level 1: Foundations | 10×10 | 25 min (plan: 20–30) | Building is **free**; land, workers and water are the limits. Money earned is banked for Level 2. |
| Level 2: Grow | 12×12 (≈1.5×) | 8 min (plan: 5–10) | Spend Level 1 money on housing, clean energy (dam, wind, solar), roads/bridges, schools, water treatment |
| Level 3: Plan for the future | 15×15 (≈1.5×) | 10 min (plan: 5–15) | Food and energy storage, hospitals, jobs (industrial park), pollution control, parks, forests |

**Between levels:**
- **Level 1 → 2:** 5–10 years (default 8) with a fixed birth rate (3%) and death rate (1%).
- **Level 2 → 3:** 50 years. Growth now depends on the city:
  - Food, water, homes and hospitals raise it.
  - Hunger, thirst, crowding, pollution and unemployment lower it.
  - Education lowers the birth rate.
- **After Level 3:** the city runs on its own until year 500 (or 1000, an organiser setting), or until it dies.

## Map

- The world is 15×15. Every game has the **same resources in random positions**:
  - 1 uranium deposit (4 blocks, 2×2)
  - 4 coal deposits (3 blocks in a line)
  - 4 gold blocks
  - 7 natural-resource blocks
  - spread across the three rings of land
- A river runs through the map.
- The city starts as a village of 6 homes with 100 people and a short lane.
- **Factories can only be built on their own deposit** and cover all of it: coal factory on coal, gold factory on gold, nuclear plant on uranium, mine on natural resources. Dams go on the river; roads on the river become bridges.

## Things that run out

At full output, coal lasts about 30 years, gold about 60, natural-resource mines about 80 and uranium about 300. Sun, wind, the river and farms are renewable.

## A city dies when

- the population falls to zero (below 5), or
- food or water is below 90% of need for **8 years in a row** (overpopulation / resource depletion), or
- pollution stays above **75% for 10 years in a row**.

## Droughts

These are the same for every team. They last 3 years and start at years 12, 70, 150, 260, 380, 520, 680, 850 after Level 3 is submitted. During a drought, rainfall and harvests fall by 40% and dams make 30% less power.

## Workers, energy, water

- **Workers:** 60% of the population works. Every staffed building has a minimum and a maximum number of workers: below the minimum it closes, and at the maximum it gives 100%. Staffing priority is power → food → water → health/storage → schools → everything else.
- **Energy:** a shortage slows every staffed building down to 50%. Solar and wind give 70% unless backed by energy storage (one storage block steadies 4 panels or turbines).
- **Water:** the river refills the reservoir every year. Buildings use water to construct and to run.
- **Roads:** a building next to a road gets +15% output.
- **Money:** income comes from factories, mines, farms and the industrial park, and school coverage raises it by up to 25%. It pays for upkeep and city services (₹0.1k per person per year). Debt cuts output by 15%.

## Buildings

Cost is in ₹ thousands. Level 1 builds are free.

| id | Name | Unlocks | Built on | Cost | Workers | Gives (per year, at full staff) | Uses |
|---|---|---|---|---|---|---|---|
| `house` | Individual Houses | 2 | grass | 30 | – | +20 homes | 1 energy, +0.2 pollution, ₹0.6k upkeep |
| `community` | Community Housing | 2 | grass | 70 | – | +45 homes | 2 energy, +0.4 pollution, ₹1.5k upkeep |
| `apartment` | Apartments | 2 | grass | 150 | – | +90 homes | 6 energy, +0.6 pollution, ₹3k upkeep |
| `foodFarm` | Food Crops | 1 | grass | 25 | 4–8 | +40 food, +₹5k | 30 water, 1 energy, +0.5 pollution, ₹1k upkeep |
| `cashFarm` | Cash Crops | 1 | grass | 25 | 4–8 | +₹20k | 45 water, 1 energy, +1 pollution, ₹1k upkeep |
| `coalPlant` | Coal Factory | 1 | coal | 120 | 12–24 | +120 energy, +₹35k | 50 water, +22 pollution, ₹5k upkeep |
| `goldFactory` | Gold Factory | 1 | gold | 90 | 8–15 | +₹65k | 40 water, 15 energy, +8 pollution, ₹4k upkeep |
| `nuclear` | Nuclear Power Plant | 1 | uranium | 400 | 20–35 | +300 energy, +₹25k | 120 water, +3 pollution, ₹12k upkeep |
| `mineralMine` | Natural Resource Mine | 1 | mineral | 60 | 6–12 | +₹32k | 20 water, 8 energy, +6 pollution, ₹3k upkeep |
| `road` | Road / Bridge | 2 | grass | 5 | – |  | ₹0.2k upkeep |
| `school` | School | 2 | grass | 80 | 6–10 | edu 150 | 4 energy, +0.2 pollution, ₹5k upkeep |
| `waterPlant` | Water Treatment | 2 | grass | 100 | 4–8 | +150 water | 15 energy, ₹5k upkeep |
| `dam` | Dam | 2 | river | 250 | 6–10 | +150 energy, +120 water | ₹6k upkeep |
| `wind` | Wind Mill | 2 | grass | 60 | 1–2 | +35 energy | ₹2k upkeep |
| `solar` | Solar Panels | 2 | grass | 50 | 1–2 | +30 energy | ₹1.5k upkeep |
| `hospital` | Hospital | 3 | grass | 150 | 10–20 | health 250 | 10 energy, ₹8k upkeep |
| `granary` | Food Storage | 3 | grass | 80 | 2–4 | stores 300 | 2 energy, ₹2k upkeep |
| `battery` | Energy Storage | 3 | grass | 100 | 1–2 |  | ₹3k upkeep |
| `itPark` | Industrial Park | 3 | grass | 200 | 20–40 | +₹90k | 20 energy, +4 pollution, ₹8k upkeep |
| `recycling` | Pollution Control | 3 | grass | 90 | 4–8 | +₹4k, −12 pollution | 8 energy, ₹4k upkeep |
| `park` | Park | 3 | grass | 20 | – | −3 pollution | ₹0.5k upkeep |
| `forest` | Forest Plantation | 3 | grass | 15 | – | −4 pollution | ₹0.2k upkeep |

## SDG scoring (each 0–100, averaged over every simulated year)

| SDG | Measured by |
|---|---|
| 2 Zero Hunger | food supply vs need |
| 3 Good Health | hospital coverage and low pollution |
| 4 Quality Education | school coverage |
| 6 Clean Water | water supply vs need, reservoir not near empty |
| 7 Clean Energy | energy supply vs need, and share from clean sources (nuclear counts 70%) |
| 8 Decent Work | employment (90% = full marks), no debt |
| 9 Industry & Infrastructure | share of buildings on a road |
| 11 Sustainable Cities | enough homes, green space, **and how long the city lasted** |
| 12 Responsible Consumption | income not dependent on finite mines, food storage built |
| 13 Climate Action | low pollution |
| 15 Life on Land | green cover (empty grass, parks, forests) |

## Original paper plan (summary)

- **Level 1 (no money):** apartments, communities and individual houses (land used, people housed, resources used). Agriculture: cash crops and food crops, one block each, with minimum and maximum workers, how many people they feed, and the economy they generate. Factories have parameters (coal: 3 blocks; gold: 1 block; nuclear: 4–5 blocks): water to build, water to run, employment (minimum and maximum workers), pollution, energy use and generation, and economy. The map has coal, gold, uranium and natural-resource mines, plus a water-level indicator.
- **Level 2:** land ×1.5. Energy sources (dam, windmills, solar panels) and development works (bridges, roads) paid with Level 1 money, plus city maintenance costs and educational institutes.
- **Level 3 (planning for the future):** land ×1.5. Population increase or decrease, food crisis, food and energy storage, famine and droughts, more employment, hospitals, pollution control.
- **Through all three levels** the players deal with the SDGs, and by the end they learn how to build a sustainable city and what sustainability really means.
