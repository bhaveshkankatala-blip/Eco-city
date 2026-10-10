# EcoCity v2: everything decided on 10 Oct 2026

The build checklist for the festival version (Technozion, 30 Oct; ready by 25 Oct). Source: the team's notebook pages and the planning conversation on 10 Oct. Status: ☐ to do · ☑ done.

## Order of work

1. **Gameplay** (now): sections A–F.
2. **Event setup**: section G.
3. **Looks** (last 2–3 days before the 25th): section H.
4. Playtest around 16 Oct; feature freeze 20 Oct; everything live by 25 Oct.

## A. People

- ☐ Start with **1,000 people** in three age groups: children 0–14, adults 15–59, elderly 60+ (about 300 / 600 / 100). Life expectancy about 70.
- ☐ Couples have **2–4 children**, decided by the city: plenty of food and water pushes toward 4; schools and hospitals pull toward 2 (demographic transition).
- ☐ Children eat but don't work; they become workers during the 50-year jump (Level 1's babies are Level 3's job-seekers).
- ☐ Growth is limited by **food, water and jobs**. A Level 1 city planned only for its first 1,000 stays about the same or shrinks by Level 2; a well-planned one reaches about 1.5–2× in the 5–10 year jump.
- ☐ Deaths depend on age and rise with hunger, thirst, **joblessness (poverty)**, **overcrowding (slums)** and pollution. **Hospitals** lower them, especially for the elderly.
- ☐ Too few homes → **slums** (more disease and pollution, lower scores). People don't leave.
- ☐ Too few jobs → more deaths (poverty) **and less money** for the city.
- ☐ **No migration.**
- ☐ Each person's water and energy use rises slowly as the city develops.
- ☐ Real-world reference shown on the info page: India's birth and death rates (SRS 2023: 18.4 and 6.4 per 1,000 a year).

## B. Land, factories and upgrades

- ☐ Coal, gold, uranium and natural-resource blocks are **scattered** (clusters with gaps, as in the notebook sketch).
- ☐ Clicking a resource block shows its **tonnes left, revenue and energy** per block.
- ☐ A factory covers **1 to 3 blocks**; the team **cycles through the possible shapes (path 1, 2, 3…)** before placing it, as in the sketch.
- ☐ Other buildings (e.g. farms) may be built on unused resource blocks.
- ☐ To mine a block that has a farm on it, the farm must be **demolished first**.
- ☐ **Factory upgrade** (Levels 2 and 3, costs money, **instant**): the factory grows onto one more free neighbouring block of its resource. Cheaper than demolishing and rebuilding bigger.
- ☐ **House upgrades** (Levels 2 and 3, cost money, instant): **rooftop solar** and **rainwater harvesting**. Any home, including the starting village.
- ☐ Upgrade screens styled after **Clash of Clans** (upgrade card: level → next level, cost, gains, upgrade animation).

## C. Rain and shocks

- ☐ Rain comes **only from the city**: more forest → more rain; more pollution → less. Rain feeds the river and reservoir, the crops and rainwater harvesting. Fixed drought years are removed; dry years come from low rain.
- ☐ Four shocks, **all included for every team, in a random order per team**: monsoon failure, heatwave, disease outbreak (worst in slums; hospitals help), fuel/price crash. Same severity for everyone.

## D. Time jumps and checkpoints

- ☐ Level 1 → 2 jump: 5–10 years (organiser setting), no pauses.
- ☐ Level 2 → 3 (50 years): **pauses every 10 years** (4 pauses). Each pause: an event with **2–3 choices**, every choice has a real cost; the team discusses and has **90 seconds** to decide (default choice if time runs out).
- ☐ Final run to **year 500** (the 1000-year option is removed): **5 major pauses**, about 60 seconds each.
- ☐ After every jump, a **"What happened"** card: births, deaths and their causes (hunger, thirst, poverty, slums, pollution, old age), resources used up, rainfall.
- ☐ No ministries or roles: friends discuss and build together.

## E. Screens (during play)

- ☐ **Plain numbers, no progress bars:** people (with children/adults/elderly), money, food, water, energy, jobs and workers, homes, pollution %.
- ☐ **Top bar: births and deaths per 1,000 people per year.**
- ☐ Numbers turn red **only when something is failing right now**; nothing warns about the future.
- ☐ **Removed:** the objectives checklist, the "SDG outlook" line, "heading to X%" hints.
- ☐ **News ticker** replaces the City Advisor: describes what's happening, never says what to build.
- ☐ **90-second guided start** in Level 1 (4 steps, skippable).
- ☐ **SDG information page** on the start screen and in How to Play: all 11 goals and how each is scored. No live SDG display during play; the **result screen keeps the SDG breakdown**.
- ☐ Money shown in lakh / crore.

## F. Pace and difficulty

- ☐ Each team should play **at least 30–40 minutes**, achieved by harder, more interesting gameplay (no lock on the Finish button).
- ☐ Default timers: Level 1 15 min, Level 2 8 min, Level 3 8 min; plus about 6 min of pauses in the 50-year jump and about 5 min in the final run (≈ 42 min). Still adjustable by organisers.
- ☐ Rebalance and test with simulated good / average / bad cities.

## G. Event setup and leaderboard

- ☐ Game hosted on **GitHub Pages** (no Claude login needed on the 6–8 game laptops). The Claude-hosted version stays as a backup.
- ☐ At start a team enters **team name, team lead's roll number, phone number**.
- ☐ A row appears immediately in a **live Google Sheet** (status "Playing"), updated with the score, years survived and fate at the end. A sorted leaderboard tab. **Only organisers** have access.
- ☐ **Duplicate team names are rejected** (the team is asked to choose another).
- ☐ Results are kept on the laptop and sent when the internet comes back.
- ☐ Google Form registrations and walk-ins are kept separate (organisers match them).
- ☐ Replays: **decide later** (for now allowed and marked "Repeat").
- ☐ Change the organiser PIN from the default.

## H. Looks (last 2–3 days)

- ☐ Professional free 3D models (Kenney city kits + Nature Kit, Car Kit) on Three.js.
- ☐ Sound: UI clicks, placement, upgrade chime, ambient birds and rain.
- ☐ Big waterfall at the front of the island.
- ☐ Visible slums and people walking.
- ☐ Gemini illustrations for event cards and endings; Gemini screenshot reviews.
- ☐ Island replay at the end of the game (if time allows).

## Open questions

- Replay policy (G).
- "Geological factors" for rain (notebook): treated as fixed terrain for now.
