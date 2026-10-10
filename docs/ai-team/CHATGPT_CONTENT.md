# Prompt for ChatGPT Go — all in-game writing

Paste everything below the line into ChatGPT. Ask it to give the final answer as a downloadable `ecocity-content.json` file (or a single JSON code block you can save under that name).

---

You are the writer for **EcoCity: Build to Last**, a 3D city-building game about sustainability, made by a college sustainability club in India for its tech festival (Technozion, 30 October). Teams of 2–5 friends share one laptop and plan a city on a floating island over about 40 minutes. Players are engineering students, mostly 18–22, playing in a noisy hall. Tone: warm, sharp, a little witty, never preachy, Indian-English, short sentences that can be read aloud in one breath.

## How the game works (do not change these rules)

- The city starts as a village of **1,000 people**: children (0–14), adults (15–59) and elderly (60+). Couples have 2–4 children depending on food, water, schools and hospitals. Deaths rise with hunger, thirst, joblessness, overcrowding (slums) and pollution; hospitals lower them.
- **Level 1 (Foundations, 10×10 land):** building is free; land, workers and water are limited. Farms, cash crops, and factories on resource deposits (coal, gold, uranium, natural-resource mines).
- **Level 2 (Grow, 12×12):** spend money on housing, solar, wind, dams, roads, bridges, schools, water treatment; upgrade factories and houses (rooftop solar, rainwater harvesting).
- **Level 3 (Plan for the future, 15×15):** food storage, hospitals, energy storage, industrial parks, pollution control, parks, forests.
- **Time jumps:** 5–10 years after Level 1; 50 years after Level 2 (the game pauses every 10 years for an event); after Level 3 the city runs on its own until year 500, pausing at major moments.
- **Rain** comes only from the city: more forest means more rain, more pollution means less.
- **A city dies** if its population reaches zero, food or water stays short for 8 years in a row, or pollution stays above 75% for 10 years in a row.
- **Score:** the average of 11 UN SDG scores (2, 3, 4, 6, 7, 8, 9, 11, 12, 13, 15) over all simulated years; ties broken by years survived.

## What to write

Return **one JSON object** with exactly these keys.

### 1. `events` — 14 dilemma events for the pauses during time jumps

Each event pauses the game. The team reads it aloud, argues, and picks one of 2–3 choices within 90 seconds. **Every choice must have a real cost; no choice is right for everyone.** Include all four "shocks" (monsoon failure, heatwave, disease outbreak, fuel/price crash) plus 10 others (e.g. baby boom, flood, forest fire, good harvest, factory strike, new technology offer, a company wants to buy forest land, students demand a college, a neighbouring town asks for water, a mining company finds more coal).

Each event:
```json
{
  "id": "monsoon-failure",
  "image": "event-monsoon-failure.png",
  "title": "The monsoon fails",            // max 30 characters
  "text": "…",                              // max 220 characters, what is happening, in the city's own terms
  "choices": [
    {
      "label": "Truck in water",            // max 24 characters (button text)
      "detail": "…",                        // max 90 characters: what this will do, including the cost
      "effects": { "money": -300, "water": 2000 },
      "news": "…"                           // max 90 characters: the headline after choosing this
    }
  ]
}
```

**Effects may only use these keys** (the game ignores anything else). Values are applied once, when chosen, unless the key says "for N years":

| Key | Meaning | Sensible range |
|---|---|---|
| `money` | ₹ thousands added (+) or spent (−) | −800 … +800 |
| `water` | water added to or taken from the reservoir | −3000 … +3000 |
| `food` | food added to or taken from storage | −3000 … +3000 |
| `pollution` | change in pollution % | −15 … +15 |
| `rainPct10y` | % change to rain for the next 10 years | −40 … +20 |
| `foodPct10y` | % change to farm output for the next 10 years | −40 … +30 |
| `energyPct10y` | % change to energy produced for the next 10 years | −30 … +30 |
| `incomePct10y` | % change to income for the next 10 years | −40 … +30 |
| `birthsPct10y` | % change to births for the next 10 years | −40 … +40 |
| `deathsPct10y` | % change to deaths for the next 10 years | −30 … +60 |
| `forestBlocks` | forest blocks planted (+) or cleared (−) | −4 … +4 |
| `coalTonnes` | coal added to the city's deposits | 0 … +2000 |

### 2. `news` — 80 news-ticker lines

Short headlines that scroll during planning. They describe what is happening and **never tell the player the fix** (say "Ration queues in the old market", not "Build more farms"). Group them by the situation the game detects:

`hungry`, `thirsty`, `no_power`, `jobless`, `slums`, `polluted`, `drought`, `rich`, `broke`, `healthy_city`, `many_children`, `many_elderly`, `coal_running_out`, `green_city`, `idle` (nothing special). About 5 lines per group, each at most 70 characters. Use a fictional local newspaper voice ("Island Times", "Neem Street gossip"), with Indian place and food references.

### 3. `tutorial` — the 90-second guided start (Level 1)

Exactly 4 steps. Each: `{ "title": max 28 chars, "text": max 140 chars, "target": one of "build-bar", "map", "stats", "finish" }`. Teach: pick a building from the bar; place food crops; place a factory on a resource block (choose its shape with the "next path" button); press Finish when ready. End with a line that the game will not tell them what to build after this.

### 4. `sdg` — the SDG information page

For each of the 11 SDGs (2 Zero Hunger, 3 Good Health, 4 Quality Education, 6 Clean Water, 7 Clean Energy, 8 Decent Work, 9 Industry & Infrastructure, 11 Sustainable Cities, 12 Responsible Consumption, 13 Climate Action, 15 Life on Land):
`{ "n": 2, "name": "Zero Hunger", "what": max 90 chars (what the goal means in real life), "inGame": max 110 chars (what in the city raises this score) }`.
Plus `"intro"`: max 260 characters explaining that the score is the average of these 11, measured every simulated year.

### 5. `whatHappened` — templates for the card after each time jump

Templates with placeholders in braces that the game fills: `{years}`, `{born}`, `{died}`, `{pop}`, `{diedHunger}`, `{diedThirst}`, `{diedPoverty}`, `{diedSlums}`, `{diedPollution}`, `{diedOldAge}`, `{rainPct}`, `{money}`.
Provide: `"headlineGrowth"`, `"headlineDecline"`, `"headlineStable"` (max 60 chars each), and a `"causes"` object with one sentence per death cause (max 80 chars each).

### 6. `endings`

`"thriving"` and `"dead"`: each `{ "title": max 40 chars, "text": max 240 chars }`, plus `"deathReasons"`: one line each for `"population"`, `"famine"` (food/water short 8 years), `"pollution"` (max 100 chars each).

### 7. `startScreen`

`"pitch"`: max 220 characters, the one-paragraph hook on the start screen. `"tagline"`: max 30 characters.

## Before you answer

Check: valid JSON; every character limit respected; every event has 2–3 choices; every choice has a real cost; only the allowed effect keys are used; no line tells the player exactly what to build.
