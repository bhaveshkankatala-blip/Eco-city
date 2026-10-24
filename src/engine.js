/* EcoCity — Build to Last : simulation engine v2 (pure, no DOM)
   Population in three age groups, rain from the city, scattered deposits,
   factories on 1..N blocks with upgrades, house upgrades, events at checkpoints. */
(function (root) {
  'use strict';

  // Everything is 10x the v1 scale: 1,000 people at the start.
  const K = 10;

  // ---------- Building catalogue (values before the K scale) ----------
  // cost: ₹ thousands. Level 1 builds are free. wB = water to build, wR = water to run per year,
  // min/max = workers, energy = energy use/yr, gen = energy made/yr, econ = income/yr at full staff,
  // pol = pollution/yr, maint = upkeep/yr. perBlock: factory values are per resource block it covers.
  const BASE = {
    hut:        { name: 'Village Homes', cat: 'housing', lvl: 99, cost: 0, cap: 20, maint: 0.5, pol: 0.2, energy: 1,
                  desc: 'The original village. Houses 200 people.' },
    house:      { name: 'Individual Houses', cat: 'housing', lvl: 1, cost: 30, cap: 20, maint: 0.6, pol: 0.2, energy: 1,
                  desc: 'Low density: 200 people per block. Cheap, but uses a lot of land.' },
    community:  { name: 'Community Housing', cat: 'housing', lvl: 2, cost: 70, cap: 45, maint: 1.5, pol: 0.4, energy: 2,
                  desc: 'Row houses with shared spaces: 450 people per block.' },
    apartment:  { name: 'Apartments', cat: 'housing', lvl: 2, cost: 150, cap: 90, maint: 3, pol: 0.6, energy: 6,
                  desc: 'High density: 900 people per block. Needs more energy for lifts and pumps.' },

    foodFarm:   { name: 'Food Crops', cat: 'agri', lvl: 1, cost: 25, wB: 10, wR: 30, min: 4, max: 8, energy: 1, food: 40, econ: 5, pol: 0.5, maint: 1,
                  desc: 'Rice, wheat, pulses. Feeds up to 400 people a year in a normal monsoon.' },
    cashFarm:   { name: 'Cash Crops', cat: 'agri', lvl: 1, cost: 25, wB: 10, wR: 45, min: 4, max: 8, energy: 1, econ: 20, pol: 1, maint: 1,
                  desc: 'Cotton, sugarcane, spices. Earns money but feeds no one, and is thirsty.' },

    coalPlant:  { name: 'Coal Power Plant', cat: 'energy', lvl: 1, on: 'coal', perBlock: true, maxBlocks: 3, cost: 45, upCost: 30, wB: 20, wR: 17, min: 4, max: 8, gen: 40, econ: 12, pol: 7.5, maint: 1.7, use: 20,
                  desc: 'Mines coal and burns it for power. Covers 1–3 coal blocks; each block runs out.' },
    goldFactory:{ name: 'Gold Factory', cat: 'industry', lvl: 1, on: 'gold', perBlock: true, maxBlocks: 2, cost: 90, upCost: 55, wB: 30, wR: 40, min: 8, max: 15, energy: 15, econ: 65, pol: 8, maint: 4, use: 15,
                  desc: 'Mines and refines gold. Big income. Covers 1–2 gold blocks; gold runs out.' },
    nuclear:    { name: 'Nuclear Power Plant', cat: 'energy', lvl: 1, on: 'uranium', perBlock: true, maxBlocks: 4, cost: 100, upCost: 60, wB: 40, wR: 30, min: 5, max: 9, gen: 75, econ: 6, pol: 0.8, maint: 5, use: 1,
                  desc: 'Huge power with little smoke, but costly to run, very thirsty, and its waste lasts thousands of years (counts against Responsible Consumption). Uranium runs out. Covers 1–4 uranium blocks.' },
    mineralMine:{ name: 'Natural Resource Mine', cat: 'industry', lvl: 1, on: 'mineral', perBlock: true, maxBlocks: 2, cost: 60, upCost: 35, wB: 20, wR: 20, min: 6, max: 12, energy: 8, econ: 32, pol: 6, maint: 3, use: 1.5,
                  desc: 'Stone, iron and sand for building. Steady income. Covers 1–2 blocks; runs out slowly.' },

    road:       { name: 'Road / Bridge', cat: 'infra', lvl: 2, cost: 5, bridgeCost: 40, maint: 0.2,
                  desc: 'Buildings next to a road work 15% better. On the river it becomes a bridge.' },
    school:     { name: 'School', cat: 'infra', lvl: 2, cost: 80, min: 6, max: 10, energy: 4, edu: 150, maint: 5, pol: 0.2,
                  desc: 'Educates 1,500 people. Educated cities earn more and choose smaller families.' },
    waterPlant: { name: 'Water Treatment', cat: 'infra', lvl: 2, cost: 100, min: 4, max: 8, energy: 15, waterIn: 150, maint: 5, pol: 0,
                  desc: 'Cleans factory waste out of the river and recycles waste water: +1,500 water a year, whatever the rain.' },

    dam:        { name: 'Dam', cat: 'energy', lvl: 2, on: 'river', cost: 250, min: 6, max: 10, gen: 150, waterIn: 120, waterCap: 600, maint: 6, renew: true, firm: true, limit: 2,
                  desc: 'Built on the river. Energy, extra water and a bigger reservoir. Weak in dry years. Max 2.' },
    wind:       { name: 'Wind Mill', cat: 'energy', lvl: 2, cost: 60, min: 1, max: 2, gen: 35, maint: 2, renew: true,
                  desc: 'Clean energy. Output varies with the wind unless you add storage.' },
    solar:      { name: 'Solar Panels', cat: 'energy', lvl: 1, cost: 50, min: 1, max: 2, gen: 30, maint: 1.5, renew: true,
                  desc: 'Clean energy that never runs out. Output varies with sunlight (70%) unless you add energy storage.' },

    hospital:   { name: 'Hospital', cat: 'services', lvl: 2, cost: 150, min: 10, max: 20, energy: 10, health: 250, maint: 8,
                  desc: 'Cares for 2,500 people. Fewer deaths, longer lives, smaller families.' },
    granary:    { name: 'Food Storage', cat: 'agri', lvl: 2, cost: 80, min: 2, max: 4, energy: 2, foodCap: 300, maint: 2,
                  desc: 'Stores 3,000 food from good years for bad ones.' },
    battery:    { name: 'Energy Storage', cat: 'energy', lvl: 3, cost: 100, min: 1, max: 2, firmFor: 4, maint: 3,
                  desc: 'Battery bank. Makes up to 4 solar or wind blocks give full, steady power.' },
    itPark:     { name: 'Industrial Park', cat: 'industry', lvl: 3, cost: 200, min: 20, max: 40, energy: 20, econ: 90, pol: 4, maint: 8,
                  desc: 'Workshops and offices. Many jobs and good income without using up resources.' },
    recycling:  { name: 'Pollution Control', cat: 'services', lvl: 3, cost: 90, min: 4, max: 8, energy: 8, absorb: 12, econ: 4, maint: 4,
                  desc: 'Recycling and filters. Removes a lot of pollution every year.' },
    park:       { name: 'Park', cat: 'services', lvl: 3, cost: 20, absorb: 3, green: true, maint: 0.5,
                  desc: 'Green space. Absorbs pollution, counts as green cover, brings rain.' },
    forest:     { name: 'Forest Plantation', cat: 'services', lvl: 3, cost: 15, absorb: 4, green: true, maint: 0.2,
                  desc: 'Planted trees. Absorbs pollution and brings rain. Each new forest costs 20% more, and after 8 forests each one cleans half as much.' },
  };
  const SCALED = ['cost', 'upCost', 'bridgeCost', 'cap', 'maint', 'pol', 'energy', 'wB', 'wR', 'min', 'max', 'food', 'econ', 'gen', 'edu', 'waterIn', 'waterCap', 'health', 'foodCap', 'absorb'];
  const B = {};
  for (const [k, d] of Object.entries(BASE)) { B[k] = Object.assign({ id: k }, d); SCALED.forEach(f => { if (d[f] != null) B[k][f] = d[f] * K; }); }
  // solar, wind and batteries run themselves: one or two people for maintenance (real people, not scaled); a dam needs a small crew
  [['solar', 1, 2], ['wind', 1, 2], ['battery', 1, 2], ['dam', 4, 8]].forEach(([k, mn, mx]) => { B[k].min = mn; B[k].max = mx; });
  const HOUSING = ['hut', 'house', 'community', 'apartment'];
  // house upgrades, cost before scale
  const HOUSE_UP = {
    solar: { name: 'Rooftop Solar', cost: { hut: 20, house: 20, community: 40, apartment: 70 }, desc: 'Panels on every roof. Clean energy for the homes on this block.' },
    rwh:   { name: 'Rainwater Harvesting', cost: { hut: 15, house: 15, community: 30, apartment: 50 }, desc: 'Roof tanks collect rain into the reservoir. More rain, more water.' },
  };
  // thousand tonnes per deposit block
  const RES_PER_BLOCK = { coal: 600, gold: 900, uranium: 300, mineral: 120 };
  const UNIT = { coal: 'kt coal', gold: 't gold', uranium: 't uranium', mineral: 'kt stone & ore' };

  const SDGS = [
    { n: 1, key: 'poverty', name: 'No Poverty' },
    { n: 2, key: 'hunger', name: 'Zero Hunger' },
    { n: 3, key: 'health', name: 'Good Health' },
    { n: 4, key: 'edu', name: 'Quality Education' },
    { n: 6, key: 'water', name: 'Clean Water' },
    { n: 7, key: 'energy', name: 'Clean Energy' },
    { n: 8, key: 'work', name: 'Decent Work' },
    { n: 9, key: 'infra', name: 'Industry & Infrastructure' },
    { n: 11, key: 'cities', name: 'Sustainable Cities' },
    { n: 12, key: 'consume', name: 'Responsible Consumption' },
    { n: 13, key: 'climate', name: 'Climate Action' },
    { n: 15, key: 'land', name: 'Life on Land' },
    { n: 17, key: 'partner', name: 'Partnerships' },
  ];

  const WORLD = 15;
  const LEVELS = {
    1: { size: 10, off: 2, title: 'Foundations', sub: 'A village of 1,000 people and a ₹50 L budget. Farms are free (up to a limit); everything else costs money. Plan for the children who are coming.' },
    2: { size: 12, off: 1, title: 'Grow the City', sub: 'Spend what your city earned. Homes, clean energy, roads, schools, upgrades. The land has grown 1.5×.' },
    3: { size: 15, off: 0, title: 'Plan for the Future', sub: 'The children of Level 1 are adults now. Jobs, clean industry, forests and pollution control decide the next centuries.' },
  };
  // checkpoint pauses, in years from the start of each jump
  const PAUSES = { jump2: [7, 14, 21, 28, 35, 43], final: [20, 60, 110, 170, 240, 320] };
  // Level 1: a fixed budget; farms are free but capped; one small coal plant at most
  const L1_BUDGET = 5000;                       // ₹50 L
  const L1_CAPS = { solar: { n: 6 }, foodFarm: { n: 10 }, cashFarm: { n: 3 }, coalPlant: { n: 1, blocks: 2 }, nuclear: { n: 1, blocks: 2 }, goldFactory: { n: 1 }, mineralMine: { n: 1 } };
  const L1_FREE = { foodFarm: true, cashFarm: true };
  // buildings that need trained workers (schools make them): their output moves between 70% and 120%
  const SKILLED = { coalPlant: 1, nuclear: 1, dam: 1, goldFactory: 1, mineralMine: 1, itPark: 1, hospital: 1, waterPlant: 1, recycling: 1 };
  // score weights for the three rounds (what teams built in Level 1, 2 and 3)
  const ERA_W = { 1: 0.2, 2: 0.4, 3: 0.4 };
  const CAP_YEARS = 500;

  // ---------- RNG ----------
  function rng(seed) {
    let s = seed >>> 0 || 1;
    return function () { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  }
  const idx = (x, y) => y * WORLD + x;
  const inLevel = (lvl, x, y) => { const L = LEVELS[lvl]; return x >= L.off && y >= L.off && x < L.off + L.size && y < L.off + L.size; };
  const ringOf = (x, y) => inLevel(1, x, y) ? 1 : inLevel(2, x, y) ? 2 : 3;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  // ---------- Events (default text; content JSON may replace text, never the shock impact) ----------
  /* ---------- Checkpoint events ----------
     Decisions now shape crises later:
     - Neighbours remember. Helping a neighbour in trouble raises goodwill; refusing lowers it. In every
       crisis you can ask the neighbours for help, and what they send depends on that goodwill.
     - Past choices leave flags (sold forest, pumped groundwater, ran factories through a heatwave, ...)
       that make later crises worse, and the event screen says so.
     - How bad a crisis hits depends on the city you built (pollution, factories, forests, hospitals,
       slums, untreated river water, dams). */
  const SHOCKS = ['monsoon-failure', 'heatwave', 'disease-outbreak', 'fuel-price-crash'];
  const NEIGHBOUR = ['neighbour-water', 'neighbour-refugees', 'neighbour-food'];
  const ASK = { label: 'Ask the neighbours for help', detail: 'What they send depends on how you treated them when they needed help.', ask: true };
  const EVENTS = {
    'monsoon-failure': { title: 'The monsoon fails', text: 'The clouds came and went without rain. Wells are dropping and the fields are cracking.',
      impact: { rainPct10y: -40, waterPct: -35, foodStorePct: -20 }, impactYears: 3, help: { water: 5000, food: 1500 }, helpText: 'water tankers and grain',
      choices: [
        { label: 'Truck in water', need: { money: 400 }, detail: 'Buy water from far away. Expensive, but the taps keep running.', effects: { money: -400, water: 3000 }, news: 'Water tankers line the highway for weeks' },
        { label: 'Pump the groundwater', detail: 'Free water now from deep wells. Nobody knows how long the wells will last.', effects: { water: 4000 }, later: [{ key: 'rainPct10y', pct: -15, years: 30 }], flag: 'groundwater', news: 'Borewell rigs drill day and night' },
        { label: 'Ration water', idle: true, detail: 'Strict limits for everyone. Crops and people suffer, the budget does not.', effects: { foodPct10y: -15, deathsPct10y: 10 }, news: 'Two buckets a day: the new rule on every street' },
        ASK ] },
    'heatwave': { title: 'Heatwave', text: 'Forty-seven degrees for three weeks. Fans run day and night and the old are suffering.',
      impact: { deathsPct10y: 25, killPct: 1.5, waterPct: -15 }, impactYears: 3, help: { deathsPct10y: -15 }, helpText: 'doctors and cooling equipment',
      choices: [
        { label: 'Open cooling centres', protect: 0.6, detail: 'Air-cooled halls for the elderly. Costs money and power.', effects: { money: -300, energyPct10y: -10, deathsPct10y: -10 }, news: 'Cooling halls packed with grandparents and card games' },
        { label: 'Shut factories in the afternoon', protect: 0.4, detail: 'Less heat and smoke in the hottest hours. Less income for years.', effects: { incomePct10y: -20, deathsPct10y: -8 }, news: 'Sirens at noon: factories shut for the hottest hours' },
        { label: 'Keep the factories running', idle: true, detail: 'No cost now. Every running factory adds heat and smoke to the streets.', effects: { deathsPct10y: 10, pollution: 5 }, later: [{ key: 'deathsPct10y', pct: 5, years: 15 }], factoryHeat: true, flag: 'heatFactories', news: 'Chimneys smoke on through the heatwave' } ] },
    'disease-outbreak': { title: 'Disease outbreak', text: 'A fever is spreading fastest through the crowded lanes. Hospitals are filling up.',
      impact: { deathsPct10y: 30, killPct: 2, incomePct10y: -10 }, impactYears: 3, help: { deathsPct10y: -20 }, helpText: 'doctors and medicine',
      choices: [
        { label: 'Free treatment', protect: 0.6, detail: 'The city pays for every patient. Expensive, saves lives.', effects: { money: -500, deathsPct10y: -15 }, news: 'Queues at free clinics stretch around the block' },
        { label: 'Lockdown', protect: 0.5, detail: 'Close markets and factories for a while. Fewer deaths, much less income.', effects: { incomePct10y: -30, deathsPct10y: -12 }, news: 'Empty markets as the city stays home' },
        { label: 'Wait it out', idle: true, detail: 'No cost now. The fever runs its course.', effects: {}, news: 'Fever season: every family knows someone ill' },
        ASK ] },
    'fuel-price-crash': { title: 'Fuel and metal prices crash', text: 'World prices for coal and gold have collapsed. Mines and factories are earning far less.',
      impact: { incomePct10y: -30, money: -150 }, impactYears: 5, help: { incomePct10y: 20 }, helpText: 'a trade deal at fair prices',
      choices: [
        { label: 'Keep mines running', idle: true, detail: 'Keep every job. Income stays low for years.', effects: {}, news: 'Mines keep digging, for less and less' },
        { label: 'Retrain workers', detail: 'Pay to retrain miners for other work. Costs money, income recovers.', effects: { money: -350, incomePct10y: 15 }, news: 'Miners back in classrooms, learning new trades' },
        { label: 'Sell coal reserves', detail: 'Sell coal rights cheap for quick cash. Pollution from the buyers drifts in.', effects: { money: 400, pollution: 6 }, flag: 'coalDependent', news: 'Coal trucks roll out of town at bargain prices' } ] },
    'flood': { title: 'Flash flood', text: 'A cloudburst upstream. The river has burst its banks and fields are under water.',
      impact: { foodPct10y: -15, foodStorePct: -40, money: -150, killPct: 0.5, destroy: { types: ['foodFarm', 'cashFarm', 'hut', 'house'], pct: 12 } }, impactYears: 3, help: { food: 1500, money: 200 }, helpText: 'volunteers and grain',
      choices: [
        { label: 'Rebuild fast', detail: 'Emergency repairs. Costs money, food recovers quickly.', effects: { money: -300, foodPct10y: 12 }, news: 'Sandbags and shovels: the city digs out' },
        { label: 'Let fields recover', idle: true, detail: 'No spending. Harvests are poor for years.', effects: { foodPct10y: -10 }, news: 'Silt-covered fields lie empty' },
        ASK ] },
    // more crises (one or two per team, random)
    'cyclone': { title: 'Cyclone', text: 'A cyclone is two days away. Winds of 180 km/h will tear through fields, roofs and power lines.',
      impact: { foodPct10y: -20, deathsPct10y: 12, money: -200, killPct: 1, destroy: { types: ['solar', 'wind', 'hut', 'house', 'community', 'foodFarm', 'cashFarm'], pct: 15 } }, impactYears: 3, help: { money: 400, food: 1500 }, helpText: 'rescue teams, tarpaulins and grain',
      choices: [
        { label: 'Evacuate everyone', protect: 0.75, detail: 'Buses and shelters for the whole city. Expensive, saves lives.', effects: { money: -300, deathsPct10y: -10 }, news: 'Long lines of buses head inland' },
        { label: 'Shelter in place', idle: true, detail: 'No cost now. People ride it out at home.', effects: {}, news: 'Doors boarded up across the city' },
        ASK ] },
    'locusts': { title: 'Locust swarm', text: 'A swarm of locusts the size of a city is eating its way across the fields.',
      impact: { foodPct10y: -35, foodStorePct: -30 }, impactYears: 2, help: { food: 2500 }, helpText: 'grain from their stores',
      choices: [
        { label: 'Spray pesticides', detail: 'Kills the swarm fast. The poison runs into the river and the soil.', effects: { money: -150, foodPct10y: 20, pollution: 6 }, later: [{ key: 'deathsPct10y', pct: 4, years: 15 }], flag: 'pesticides', news: 'Crop dusters spray the fields white' },
        { label: 'Nets, traps and birds', detail: 'Slower and more expensive, but nothing is poisoned.', effects: { money: -300, foodPct10y: 12 }, news: 'Villagers drive the swarm into nets at dawn' },
        { label: 'Let it pass', idle: true, detail: 'No cost now. The harvest is lost.', effects: {}, news: 'Bare stalks where the wheat stood' },
        ASK ] },
    'chemical-leak': { title: 'Chemical leak', text: 'A factory tank has burst. Toxic waste is pouring into the river that the city drinks from.',
      impact: { deathsPct10y: 15, waterPct: -25, pollution: 8, killPct: 0.5 }, impactYears: 3,
      choices: [
        { label: 'Shut it down and clean up', protect: 0.6, detail: 'Close the factory for months and pay for the clean-up.', effects: { money: -350, incomePct10y: -10, deathsPct10y: -12 }, news: 'Clean-up crews in white suits line the riverbank' },
        { label: 'Fine the company', detail: 'They pay the city. The waste stays in the river for a while.', effects: { money: 200, pollution: 4 }, news: 'Factory fined; the river stays brown' },
        { label: 'Keep it quiet', idle: true, detail: 'No cost now. People drink the water and nobody knows why they fall ill.', effects: {}, later: [{ key: 'deathsPct10y', pct: 6, years: 15 }], flag: 'coverUp', news: 'Officials say the water is fine' } ] },
    'blackout': { title: 'The grid fails', text: 'On the hottest night of the year the power grid collapses. Hospitals, pumps and factories go dark.',
      impact: { incomePct10y: -20, deathsPct10y: 6, money: -150, killPct: 0.3 }, impactYears: 2, help: { incomePct10y: 15 }, helpText: 'power from their grid',
      choices: [
        { label: 'Rolling power cuts', idle: true, detail: 'Share the little power there is. Factories lose hours.', effects: { incomePct10y: -10 }, news: 'Four hours of power a day, by turns' },
        { label: 'Diesel generators', need: { money: 250 }, detail: 'Hire generators for every ward. Costs money and fills the air with smoke.', effects: { money: -250, pollution: 6 }, news: 'Generators roar on every street corner' },
        ASK ] },
    // neighbours in trouble: help now, or keep what you have
    'neighbour-water': { title: 'Neighbour needs water', text: 'A drought has hit the town downstream. Their wells are dry and they ask to share your reservoir.', neighbour: true,
      choices: [
        { label: 'Share water', need: { water: 2000 }, detail: 'Give them 2,000 water. Your reservoir drops now; trade with them grows.', effects: { water: -2000 }, later: [{ key: 'incomePct10y', pct: 6, years: 25 }], goodwill: 2, news: 'Tankers head downstream with your water' },
        { label: 'Sell it at a high price', need: { water: 2000 }, detail: 'They pay well, and they will not forget the price.', effects: { water: -2000, money: 300 }, later: [{ key: 'incomePct10y', pct: -5, years: 15 }], goodwill: -1, news: 'Neighbours pay dearly for your water' },
        { label: 'Refuse', detail: 'Keep every drop for your own people. They may stop trading with you.', effects: {}, later: [{ key: 'incomePct10y', pct: -10, years: 25 }], goodwill: -2, news: 'Neighbours turned away at the gates' } ] },
    'neighbour-refugees': { title: 'Families flee a flood', text: 'A flood has destroyed the neighbouring town. 150 families are at your border asking for shelter.', neighbour: true,
      choices: [
        { label: 'Take them in', detail: '150 more people to house and feed. Most are adults who can work.', effects: { people: 150 }, later: [{ key: 'incomePct10y', pct: 6, years: 25 }], goodwill: 3, news: 'Tents go up as the city welcomes flood families' },
        { label: 'Send supplies, not shelter', need: { food: 800, money: 200 }, detail: 'Send food and tents to their camp. Costs money and food.', effects: { money: -200, food: -800 }, later: [{ key: 'incomePct10y', pct: 3, years: 20 }], goodwill: 1, news: 'Supply trucks roll to the camp across the border' },
        { label: 'Close the border', detail: 'Nothing changes for your city now. They may stop trading with you.', effects: {}, later: [{ key: 'incomePct10y', pct: -10, years: 25 }], goodwill: -2, news: 'Border closed; families wait in the rain' } ] },
    'neighbour-food': { title: 'Famine next door', text: 'Pests destroyed the harvest in the next town. Children are going hungry and they ask for grain.', neighbour: true,
      choices: [
        { label: 'Send grain', need: { food: 1500 }, detail: 'Give 1,500 food from your stores.', effects: { food: -1500 }, later: [{ key: 'incomePct10y', pct: 6, years: 25 }], goodwill: 2, news: 'Grain carts head out at dawn' },
        { label: 'Sell grain at market price', need: { food: 1500 }, detail: 'Fair trade: they pay, you lose the food.', effects: { food: -1500, money: 150 }, goodwill: 0, news: 'Grain sold across the border' },
        { label: 'Refuse', detail: 'Your own people come first. They may stop trading with you.', effects: {}, later: [{ key: 'incomePct10y', pct: -10, years: 25 }], goodwill: -2, news: 'Granary doors stay shut' } ] },
    // choices now, consequences later
    'baby-boom': { title: 'Baby boom', text: 'Maternity wards are full. Every street has a new cradle.',
      choices: [
        { label: 'Celebrate', detail: 'Let it happen. Many more children to feed in the years ahead.', effects: { birthsPct10y: 35 }, news: 'Sweet shops sell out as the cradles fill' },
        { label: 'Family planning drive', detail: 'Free clinics and education. Costs money, slower growth.', effects: { money: -200, birthsPct10y: -15 }, news: 'Family health camps in every ward' } ] },
    'forest-fire': { title: 'Forest fire', text: 'Dry winds have carried a fire into the forest on the hills.',
      choices: [
        { label: 'Fight the fire', detail: 'Every hand on the fire line. Costs money, saves the forest.', effects: { money: -250, pollution: 3 }, news: 'Firefighters hold the line at the ridge' },
        { label: 'Let it burn out', detail: 'No cost now. Forest is lost and the air fills with smoke.', effects: { forestBlocks: -2, pollution: 10 }, flag: 'forestCut', news: 'Ash falls on the city for a week' } ] },
    'good-harvest': { title: 'Bumper harvest', text: 'Perfect weather. The granaries are overflowing.',
      choices: [
        { label: 'Store it', detail: 'Keep the extra food for bad years.', effects: { food: 2500 }, news: 'Granaries full to the roof' },
        { label: 'Sell it', detail: 'Sell the surplus for money now.', effects: { money: 350 }, news: 'Grain traders crowd the market' } ] },
    'factory-strike': { title: 'Factory strike', text: 'Workers want safer factories and cleaner air. The gates are shut.',
      choices: [
        { label: 'Meet their demands', detail: 'Pay for safety and filters. Costs money, cleaner air.', effects: { money: -300, pollution: -5 }, news: 'Strike ends with new filters on the chimneys' },
        { label: 'Refuse', detail: 'No cost now. The strike drags on, and the factories stay unsafe.', effects: { incomePct10y: -20 }, later: [{ key: 'deathsPct10y', pct: 4, years: 20 }], flag: 'unsafeFactories', news: 'Silent factories as the strike enters its third month' } ] },
    'new-technology': { title: 'New technology offer', text: 'A company offers cheaper, better solar and wind equipment, if you sign today.',
      choices: [
        { label: 'Sign the deal', detail: 'Pay now; clean energy output rises for years.', effects: { money: -350, energyPct10y: 20 }, news: 'New panels glint on rooftops across the city' },
        { label: 'Not now', detail: 'Keep the money.', effects: {}, news: 'City passes on the energy deal' } ] },
    'forest-land-offer': { title: 'Company wants forest land', text: 'A developer offers good money to clear the hill forest for a warehouse park.',
      choices: [
        { label: 'Sell the land', detail: 'Good money now. The hills lose their trees.', effects: { money: 500, forestBlocks: -2 }, later: [{ key: 'rainPct10y', pct: -8, years: 40 }], flag: 'forestCut', news: 'Bulldozers move into the old forest' },
        { label: 'Protect the forest', detail: 'Turn it down.', effects: {}, news: 'Forest stays standing after heated council debate' } ] },
    'college-demand': { title: 'Students want a college', text: 'Young people are leaving school with nowhere to go. They want a college in the city.',
      choices: [
        { label: 'Fund a college', detail: 'Costs money; smaller families and better jobs later.', effects: { money: -400, birthsPct10y: -10, incomePct10y: 10 }, news: 'Foundation stone laid for the city college' },
        { label: 'Maybe later', detail: 'Keep the money.', effects: {}, news: 'Students march, then go home' } ] },
    'more-coal': { title: 'New coal seam found', text: 'Surveyors have found more coal under your existing coal blocks.',
      choices: [
        { label: 'Mine it', detail: '+1,000 kt coal for your coal blocks. The city leans harder on coal.', effects: { coalTonnes: 1000, pollution: 4 }, flag: 'coalDependent', news: 'Coal rush: the mines hire again' },
        { label: 'Leave it underground', detail: 'Keep the air clean.', effects: {}, news: 'Coal seam sealed and left alone' } ] },
  };
  const NEWC = ['cyclone', 'locusts', 'chemical-leak', 'blackout'];
  const OTHERS = Object.keys(EVENTS).filter(k => !SHOCKS.includes(k) && !NEIGHBOUR.includes(k) && !NEWC.includes(k) && k !== 'flood');
  const FLAG_TEXT = { pesticides: 'you sprayed pesticides on the fields', coverUp: 'you kept the chemical leak quiet', groundwater: 'you pumped the groundwater', heatFactories: 'you kept the factories running through the heatwave', forestCut: 'the hill forest was lost', coalDependent: 'you bet on coal', unsafeFactories: 'you refused the factory workers' };
  const flagNote = (state, k) => { const y = state.flags && state.flags[k]; return y != null ? 'In year ' + y + ' ' + FLAG_TEXT[k] + '. ' : ''; };
  const runningFactories = state => Object.values(state.buildings).filter(b => ['coalPlant', 'goldFactory', 'mineralMine', 'itPark'].includes(b.type) && b._eff > 0).reduce((a, b) => a + (B[b.type].perBlock ? b.tiles.length : 1), 0);
  // How hard a crisis hits this city, and the reasons, shown on the event screen.
  function severity(state, id) {
    state.flags = state.flags || {};
    const f = flows(state), notes = [];
    let m = 1;
    const fac = runningFactories(state), P = state.pollution;
    if (id === 'heatwave') {
      const heat = 0.04 * fac + P / 120 - f.green * 0.6;
      m += heat;
      if (fac) notes.push(fac + ' running factory blocks and ' + Math.round(P) + '% pollution trap the heat.');
      if (f.green > 0.25) notes.push('Your green land keeps the streets cooler.');
      if (state.flags.groundwater != null) { m += 0.2; notes.push(flagNote(state, 'groundwater') + 'The wells are dry; there is little water to cool down.'); }
      if (state.flags.unsafeFactories != null) { m += 0.15; notes.push(flagNote(state, 'unsafeFactories') + 'Unsafe factories make the heat deadlier.'); }
    } else if (id === 'disease-outbreak') {
      const slums = Math.max(0, f.pop - f.cap) / Math.max(1, f.pop);
      m += 1.5 * slums + 0.8 * (f.riverDirty || 0) - 0.6 * f.healthCov;
      if (slums > 0.03) notes.push(Math.round(slums * 100) + '% of people live in crowded slums, where fever spreads fast.');
      if ((f.riverDirty || 0) > 0.2) notes.push('Untreated factory waste is in the river people drink from.');
      if (f.healthCov > 0.5) notes.push('Your hospitals are ready.'); else notes.push('There are not enough hospital beds.');
      if (state.flags.heatFactories != null) { m += 0.3; notes.push(flagNote(state, 'heatFactories') + 'Many people never recovered.'); }
      if (state.flags.pesticides != null) { m += 0.2; notes.push(flagNote(state, 'pesticides') + 'The poison is still in the water.'); }
      if (state.flags.coverUp != null) { m += 0.2; notes.push(flagNote(state, 'coverUp') + 'People still drink that water.'); }
    } else if (id === 'monsoon-failure') {
      m += 0.6 * (0.3 - f.green);
      if (f.green < 0.2) notes.push('With so little forest and open land, the clouds pass you by.');
      if (state.flags.forestCut != null) { m += 0.25; notes.push(flagNote(state, 'forestCut') + 'Bare hills hold no rain.'); }
    } else if (id === 'flood') {
      const dams = Object.values(state.buildings).filter(b => b.type === 'dam' && b._eff > 0).length;
      if (dams) { m -= 0.3 * dams; notes.push('Your dam holds back part of the flood.'); }
      if (state.flags.forestCut != null) { m += 0.6; notes.push(flagNote(state, 'forestCut') + 'With no trees on the hills, the water rushes straight down.'); }
    } else if (id === 'cyclone') {
      m += 0.3 - Math.min(0.5, f.forestShare * 4) - 0.3 * f.healthCov;
      if (f.forestShare < 0.04) notes.push('Few trees to break the wind.'); else notes.push('Your forests break the worst of the wind.');
      if (f.healthCov > 0.5) notes.push('Your hospitals can treat the injured.');
      const slums = Math.max(0, f.pop - f.cap) / Math.max(1, f.pop);
      if (slums > 0.03) { m += slums * 2; notes.push('People in slum shacks have no safe roof.'); }
    } else if (id === 'locusts') {
      const farms = Object.values(state.buildings).filter(b => b.type === 'foodFarm' || b.type === 'cashFarm');
      const cash = farms.filter(b => b.type === 'cashFarm').length / Math.max(1, farms.length);
      m += cash * 0.6 - (state.foodStore > f.foodDemand * 0.5 ? 0.3 : 0) - Math.min(0.3, f.forestShare * 3);
      if (cash > 0.3) notes.push(Math.round(cash * 100) + '% of your farms grow one cash crop: easy feeding for the swarm.');
      if (state.foodStore > f.foodDemand * 0.5) notes.push('Your stored food will carry people through.'); else notes.push('You have little food in storage.');
    } else if (id === 'chemical-leak') {
      const fac = runningFactories(state);
      m += 0.05 * fac + 0.8 * (f.riverDirty || 0) - 0.4;
      notes.push(fac + ' running factory blocks along your river.');
      if ((f.riverDirty || 0) > 0.2) notes.push('Your treatment plants cannot keep up with the waste.'); else notes.push('Your treatment plants clean most of the water.');
      if (state.flags.coverUp != null) { m += 0.3; notes.push(flagNote(state, 'coverUp') + 'Nobody believes the officials now.'); }
    } else if (id === 'blackout') {
      const firm = Object.values(state.buildings).some(b => (b.type === 'battery' || b.type === 'dam') && b._eff > 0);
      m += (f.energyR < 1 ? 0.5 : 0) - (firm ? 0.35 : 0) - Math.min(0.3, f.cleanShare * 0.3);
      if (f.energyR < 1) notes.push('Your city already uses more power than it makes.');
      if (firm) notes.push('Your batteries and dam keep some lights on.'); else notes.push('You have no storage or dam to fall back on.');
    } else if (id === 'fuel-price-crash') {
      const ext = f.econ ? f.econExtract / f.econ : 0;
      m += ext - 0.4;
      if (ext > 0.5) notes.push(Math.round(ext * 100) + '% of your income comes from mines and fuel.');
      else notes.push('Most of your income does not depend on mines.');
      if (state.flags.coalDependent != null) { m += 0.35; notes.push(flagNote(state, 'coalDependent') + 'Now coal is worth little.'); }
    }
    return { mul: clamp(m, 0.4, 2.2), notes };
  }
  // what happens if a team does not decide in time: the do-nothing choice
  // A choice the city cannot afford is shown but cannot be picked (no water to give, no grain in store).
  // A neighbour asking for something you do not have gets an honest answer instead.
  const CANNOT = { label: 'We have nothing to spare', detail: 'Tell them honestly. They understand, but nothing changes for either town.', effects: {}, goodwill: 0, cannot: true, news: 'The council explains it has nothing left to give' };
  function needWhy(state, need) {
    if (!need) return null;
    if (need.water && state.water < need.water) return 'You only have ' + Math.round(state.water).toLocaleString('en-IN') + ' water in the reservoir.';
    if (need.food && state.foodStore < need.food) return 'You only have ' + Math.round(state.foodStore).toLocaleString('en-IN') + ' food in store.';
    if (need.money && state.money < need.money) return 'Not enough money (needs ' + fmtMoney(need.money) + ').';
    return null;
  }
  function choicesFor(state, id) {
    const def = EVENTS[id];
    const list = def.choices.map(c => Object.assign({}, c, { disabled: needWhy(state, c.need) }));
    if (def.neighbour && list.filter(c => (c.goodwill || 0) > 0 && !c.disabled).length === 0) list.splice(list.length - 1, 0, Object.assign({}, CANNOT));
    return list;
  }
  function defaultChoice(id, state) {
    const ch = state ? choicesFor(state, id) : EVENTS[id].choices;
    const i = ch.findIndex(c => c.idle && !c.disabled); if (i >= 0) return i;
    for (let k = ch.length - 1; k >= 0; k--) if (!ch[k].ask && !ch[k].disabled) return k;
    return 0;
  }
  // Swap an event that makes no sense for this city (a coal seam with no coal plant, a strike with no
  // factories, a neighbour asking for water you do not have) for one that does.
  function eventMakesSense(state, id) {
    const bl = Object.values(state.buildings), has = t => bl.some(b => t.includes(b.type));
    if (id === 'more-coal') return has(['coalPlant']);
    if (id === 'factory-strike' || id === 'chemical-leak') return has(['coalPlant', 'goldFactory', 'mineralMine', 'itPark']);
    if (id === 'good-harvest' || id === 'locusts') return has(['foodFarm', 'cashFarm']);
    if (id === 'neighbour-water') return state.water >= 2000;
    if (id === 'neighbour-food') return state.foodStore >= 1500;
    if (id === 'new-technology') return has(['solar', 'wind']);
    return true;
  }
  // For the stop at schedule[slot]: if its event makes no sense now, use one that does, either an event
  // not scheduled yet or a later one in this team's schedule (the two swap places, so nothing repeats).
  function relevantEvent(state, id, slot) {
    if (eventMakesSense(state, id)) return id;
    const done = new Set((state.eventsDone || []).map(e => e.id));
    const sched = state.schedule || [];
    const pool = NEIGHBOUR.includes(id) ? NEIGHBOUR : NEWC.includes(id) ? NEWC.concat(OTHERS) : OTHERS.concat(NEWC);
    const ok = k => k !== id && !done.has(k) && eventMakesSense(state, k);
    const fresh = pool.find(k => ok(k) && !sched.includes(k));
    const pos = slot != null ? slot : sched.indexOf(id);
    if (fresh) { if (pos >= 0) sched[pos] = fresh; return fresh; }
    const later = pool.find(k => ok(k) && sched.indexOf(k) > pos);
    if (later && pos >= 0) { const j = sched.indexOf(later); sched[j] = id; sched[pos] = later; return later; }
    return id;   // nothing better: keep it (choices it cannot afford stay disabled)
  }
  function goodwillNote(state) {
    const g = state.goodwill || 0, h = state.helpLog || [];
    const last = h.length ? h[h.length - 1] : null;
    if (!last) return 'You have not been asked to help your neighbours yet.';
    return g >= 2 ? 'Neighbours remember: you helped them in year ' + last.year + '.' : g < 0 ? 'Neighbours remember: you turned them away in year ' + last.year + '.' : 'Your neighbours have mixed feelings about you.';
  }
  // The event as it should be shown now: severity notes, neighbour memory, choices.
  function eventView(state, id) {
    const def = EVENTS[id]; if (!def) return null;
    state.flags = state.flags || {}; state.helpLog = state.helpLog || [];
    const sev = def.impact ? severity(state, id) : { mul: 1, notes: [] };
    const notes = sev.notes.slice();
    const choices = choicesFor(state, id);
    if (def.impact && choices.some(c => c.ask)) notes.push(goodwillNote(state));
    return { id, title: def.title, text: def.text, notes, mul: sev.mul, shock: SHOCKS.includes(id) || id === 'flood' || NEWC.includes(id), neighbour: !!def.neighbour, choices, expect: def.impact ? describeImpact(scaleEff(def.impact, sev.mul), def.impactYears) : [] };
  }

  // ---------- Map generation ----------
  function newGame(seed, team) {
    const r = rng(seed);
    const tiles = [];
    for (let y = 0; y < WORLD; y++) for (let x = 0; x < WORLD; x++) tiles.push({ x, y, t: 'grass', dep: null, b: null, v: r(), res: 0, resMax: 0 });

    // river: top to bottom, meandering
    let rx = 3 + Math.floor(r() * 3);
    if (r() < 0.5) rx = WORLD - 1 - rx;
    for (let y = 0; y < WORLD; y++) {
      tiles[idx(rx, y)].t = 'river';
      const st = r();
      let nx = rx + (st < 0.3 ? -1 : st > 0.7 ? 1 : 0);
      nx = Math.max(2, Math.min(WORLD - 3, nx));
      if (nx !== rx && y < WORLD - 1) tiles[idx(nx, y)].t = 'river';
      rx = nx;
    }

    // scattered deposits: random connected blobs
    const deposits = {};
    let depN = 0;
    const isFree = (x, y) => x >= 0 && y >= 0 && x < WORLD && y < WORLD && tiles[idx(x, y)].t === 'grass';
    const nearDep = (x, y) => { for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) { const tx = x + ox, ty = y + oy; if (tx >= 0 && ty >= 0 && tx < WORLD && ty < WORLD && tiles[idx(tx, ty)].dep) return true; } return false; };
    function blob(type, size, ring) {
      for (let tries = 0; tries < 600; tries++) {
        const x = Math.floor(r() * WORLD), y = Math.floor(r() * WORLD);
        if (!isFree(x, y) || ringOf(x, y) !== ring || nearDep(x, y)) continue;
        const cells = [[x, y]];
        let guard = 0;
        while (cells.length < size && guard++ < 60) {
          const [bx, by] = cells[Math.floor(r() * cells.length)];
          const [dx, dy] = N4[Math.floor(r() * 4)];
          const nx = bx + dx, ny = by + dy;
          if (!isFree(nx, ny) || ringOf(nx, ny) !== ring || nearDep(nx, ny) || cells.some(c => c[0] === nx && c[1] === ny)) continue;
          cells.push([nx, ny]);
        }
        if (cells.length < size) continue;
        const id = 'd' + (++depN), per = RES_PER_BLOCK[type];
        deposits[id] = { id, type, tiles: cells.map(([cx, cy]) => idx(cx, cy)), reserve: per * cells.length, max: per * cells.length };
        for (const [cx, cy] of cells) { const t = tiles[idx(cx, cy)]; t.t = type; t.dep = id; t.res = per; t.resMax = per; }
        return true;
      }
      return false;
    }
    // same amounts for every team, random shapes and places
    const plan = {
      1: [['uranium', 4], ['coal', 4], ['coal', 3], ['gold', 2], ['mineral', 2], ['mineral', 1]],
      2: [['coal', 3], ['gold', 2], ['mineral', 2]],
      3: [['coal', 4], ['gold', 1], ['mineral', 2]],
    };
    for (const ring of [1, 2, 3]) for (const [type, n] of plan[ring]) blob(type, n, ring);

    // checkpoint events. Every team gets all four shocks and a flood, two neighbours asking for help
    // (each one before some of the shocks), and two choices whose effects show up later.
    const shuf = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const sh = shuf(SHOCKS), nb = shuf(NEIGHBOUR), ot = shuf(OTHERS);
    // the 50-year jump: neighbour, choice, shock, shock; the final run: neighbour, shock, choice, flood, shock
    const nc = shuf(NEWC);
    // the 50-year jump (6 stops): neighbour, choice, shock, new crisis, choice, shock
    // the final run (6 stops): neighbour, shock, new crisis, choice, flood, shock
    const schedule = [nb[0], ot[0], sh[0], nc[0], ot[1], sh[1], nb[1], sh[2], nc[1], ot[2], 'flood', sh[3]];

    const state = {
      v: 2, seed, team: team || '', level: 1, year: 0, phase: 'plan',
      tiles, deposits, buildings: {}, bid: 0,
      kids: 300 * 1, adults: 600, elders: 100, pop: 1000,
      money: L1_BUDGET, water: 800 * K, foodStore: 0, pollution: 12, rain: 1,
      mods: [], schedule, eventsDone: [], tally: null, goodwill: 0, helpLog: [], flags: {}, memory: [],
      history: [], log: [], sdgSum: null, sdgYears: 0, streak: { short: 0, pol: 0, debt: 0, dark: 0 }, trained: 0.6,
      dead: null, finalStart: null, jumpStart: null, debt: false,
    };
    resetTally(state);
    // starting village: 6 homes and a short lane
    const L = LEVELS[1];
    const cx = L.off + 4 + Math.floor(r() * 2), cy = L.off + 4 + Math.floor(r() * 2);
    const spots = [];
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) spots.push([cx + dx, cy + dy]);
    spots.sort((a, b) => (Math.abs(a[0] - cx) + Math.abs(a[1] - cy)) - (Math.abs(b[0] - cx) + Math.abs(b[1] - cy)));
    let homes = 0, lane = 0;
    for (const [x, y] of spots) {
      if (!inLevel(1, x, y) || tiles[idx(x, y)].t !== 'grass') continue;
      if (lane < 3 && x === cx) { addBuilding(state, 'road', [idx(x, y)], true); lane++; continue; }
      if (homes < 6 && Math.abs(x - cx) === 1) { addBuilding(state, 'hut', [idx(x, y)], true); homes++; }
    }
    for (const [x, y] of spots) {
      if (homes >= 6) break;
      if (!inLevel(1, x, y) || tiles[idx(x, y)].t !== 'grass' || tiles[idx(x, y)].b) continue;
      addBuilding(state, 'hut', [idx(x, y)], true); homes++;
    }
    return state;
  }

  function addBuilding(state, type, tiles, initial, workers) {
    const id = 'b' + (++state.bid);
    const d = B[type];
    const n = d.perBlock ? tiles.length : 1;
    const crew = workers != null && d.min ? clamp(Math.round(workers), d.min * n, d.max * n) : (d.max || 0) * n;
    state.buildings[id] = { id, type, tiles, workers: crew, built: state.year, initial: !!initial, up: {} };
    for (const i of tiles) state.tiles[i].b = id;
    return id;
  }
  function resetTally(state) {
    state.tally = { years: 0, born: 0, died: { hunger: 0, thirst: 0, poverty: 0, slums: 0, pollution: 0, old: 0, dark: 0 }, rainSum: 0, popStart: state.pop, agesStart: [state.kids, state.adults, state.elders], moneyStart: state.money, used: {}, events: [] };
  }

  // ---------- Placement ----------
  const isDepositType = t => t === 'coal' || t === 'gold' || t === 'uranium' || t === 'mineral';
  function blocksOf(b) { return B[b.type].perBlock ? b.tiles.length : 1; }
  function costOf(state, type, i, size) {
    const d = B[type];
    if (state.level === 1 && L1_FREE[type]) return 0;
    if (type === 'road' && state.tiles[i].t === 'river') return d.bridgeCost;
    // good land for new forest gets scarcer: each forest costs 20% more than the one before
    if (type === 'forest') return Math.round(d.cost * (1 + 0.2 * Object.values(state.buildings).filter(b => b.type === 'forest').length));
    return d.cost * (d.perBlock ? (size || 1) : 1);
  }
  // all connected shapes of `size` free blocks of the factory's resource that include tile i
  function factoryPaths(state, type, i, size) {
    const d = B[type], T = state.tiles;
    if (!d || !d.on || d.on === 'river') return [[i]];
    const ok = j => { const t = T[j]; return t.t === d.on && !t.b && inLevel(state.level, t.x, t.y); };
    if (!ok(i)) return [];
    size = clamp(size || 1, 1, d.maxBlocks);
    const seen = new Set(), out = [];
    (function grow(set) {
      const key = set.slice().sort((a, b) => a - b).join(',');
      if (seen.has(key)) return; seen.add(key);
      if (set.length === size) { out.push(set.slice()); return; }
      for (const j of set) {
        const t = T[j];
        for (const [dx, dy] of N4) {
          const x = t.x + dx, y = t.y + dy;
          if (x < 0 || y < 0 || x >= WORLD || y >= WORLD) continue;
          const k = idx(x, y);
          if (set.includes(k) || !ok(k)) continue;
          grow(set.concat([k]));
        }
      }
    })([i]);
    // stable order: by the tiles' positions
    out.sort((a, b) => a.slice().sort((p, q) => p - q).join(',') < b.slice().sort((p, q) => p - q).join(',') ? -1 : 1);
    return out;
  }
  function maxPathSize(state, type, i) {
    const d = B[type]; if (!d || !d.perBlock) return 1;
    let best = 0;
    for (let s = 1; s <= d.maxBlocks; s++) if (factoryPaths(state, type, i, s).length) best = s;
    return best;
  }
  function footprint(state, type, i, opt) {
    const d = B[type];
    if (d && d.perBlock) {
      const paths = factoryPaths(state, type, i, (opt && opt.size) || 1);
      if (!paths.length) return [i];
      return paths[((opt && opt.path) || 0) % paths.length];
    }
    return [i];
  }
  function canPlace(state, type, i, opt) {
    const d = B[type], t = state.tiles[i];
    if (!d || d.lvl > state.level) return { ok: false, why: 'Unlocks in Level ' + (d ? d.lvl : '?') };
    if (!inLevel(state.level, t.x, t.y)) return { ok: false, why: 'Outside your land' };
    if (t.b) return { ok: false, why: 'Already built here' };
    let fp = [i];
    if (d.on === 'river') {
      if (t.t !== 'river') return { ok: false, why: 'Dams go on the river' };
      const n = Object.values(state.buildings).filter(b => b.type === type).length;
      if (d.limit && n >= d.limit) return { ok: false, why: 'Only ' + d.limit + ' dams allowed' };
    } else if (d.on) {
      if (t.t !== d.on) return { ok: false, why: d.name + ' must be built on ' + labelFor(d.on) + ' blocks' };
      const size = (opt && opt.size) || 1;
      const paths = factoryPaths(state, type, i, size);
      if (!paths.length) return { ok: false, why: 'Not enough free ' + labelFor(d.on) + ' blocks next to each other for size ' + size };
      fp = paths[((opt && opt.path) || 0) % paths.length];
      if (t.res <= 0 && fp.every(j => state.tiles[j].res <= 0)) return { ok: false, why: 'These blocks are used up' };
    } else if (t.t === 'river' && type !== 'road') {
      return { ok: false, why: 'Cannot build on the river' };
    }
    if (state.level === 1 && L1_CAPS[type]) {
      const cap = L1_CAPS[type], have = Object.values(state.buildings).filter(b => b.type === type);
      if (have.length >= cap.n) return { ok: false, why: 'Level 1 limit: ' + cap.n + ' ' + d.name + (cap.n > 1 ? 's' : '') + '. More in Level 2.' };
      if (cap.blocks && fp.length > cap.blocks) return { ok: false, why: 'Level 1 limit: ' + cap.blocks + ' blocks for the ' + d.name + '.' };
    }
    const cost = costOf(state, type, i, fp.length);
    if (cost > state.money + 1e-9) return { ok: false, why: 'Not enough money (needs ' + fmtMoney(cost) + ')' };
    const wB = (d.wB || 0) * (d.perBlock ? fp.length : 1);
    if (wB > state.water) return { ok: false, why: 'Not enough water in the reservoir to build' };
    return { ok: true, fp, cost, wB };
  }
  function labelFor(t) { return { coal: 'coal', gold: 'gold', uranium: 'uranium', mineral: 'natural resource' }[t] || t; }
  function fmtMoney(k) {
    // k = ₹ thousands. 100k = 1 lakh, 10,000k = 1 crore
    const a = Math.abs(k), s = k < 0 ? '−' : '';
    if (a >= 10000) return s + '₹' + (a / 10000).toFixed(a >= 100000 ? 0 : 2).replace(/\.?0+$/, '') + ' Cr';
    if (a >= 100) return s + '₹' + (a / 100).toFixed(a >= 1000 ? 0 : 1).replace(/\.0$/, '') + ' L';
    return s + '₹' + Math.round(a) + 'k';
  }

  function build(state, type, i, opt) {
    const c = canPlace(state, type, i, opt);
    if (!c.ok) return c;
    state.money -= c.cost;
    state.water -= c.wB;
    const id = addBuilding(state, type, c.fp, false, opt && opt.workers);
    return { ok: true, id, cost: c.cost };
  }
  // the team sets how many people work in a building (between its minimum and maximum crew)
  function setWorkers(state, id, n) {
    const b = state.buildings[id]; if (!b) return null;
    const d = B[b.type]; if (!d.min) return null;
    const k = d.perBlock ? b.tiles.length : 1;
    b.workers = clamp(Math.round(n), d.min * k, d.max * k);
    return b.workers;
  }
  // during the years that pass, people who come of working age join understaffed buildings (food first)
  function autoAssign(state, f) {
    let spare = f.unemployed;
    if (spare <= 0) return 0;
    const prio = b => { const d = B[b.type]; return b.type === 'foodFarm' ? 0 : d.gen ? 1 : b.type === 'waterPlant' ? 2 : (b.type === 'hospital' || b.type === 'granary' || b.type === 'battery') ? 3 : b.type === 'school' ? 4 : 5; };
    const list = Object.values(state.buildings).filter(b => B[b.type].min && !b._dead).sort((a, b) => prio(a) - prio(b) || (+a.id.slice(1)) - (+b.id.slice(1)));
    let moved = 0;
    for (const b of list) {
      if (spare <= 0) break;
      const d = B[b.type], k = d.perBlock ? b.tiles.length : 1, mx = d.max * k;
      if (b.workers >= mx) continue;
      const add = Math.min(spare, mx - b.workers);
      b.workers += add; spare -= add; moved += add;
    }
    return moved;
  }
  function demolish(state, id) {
    const b = state.buildings[id];
    if (!b) return;
    for (const i of b.tiles) state.tiles[i].b = null;
    delete state.buildings[id];
  }

  // ---------- Upgrades ----------
  function upgradeOptions(state, id) {
    const b = state.buildings[id]; if (!b) return [];
    const d = B[b.type], out = [];
    const locked = state.level < 2 ? 'Upgrades unlock in Level 2' : null;
    if (d.perBlock) {
      const n = b.tiles.length;
      if (n >= d.maxBlocks) out.push({ kind: 'block', ok: false, why: 'Already at the largest size (' + d.maxBlocks + ' blocks)', level: n, max: d.maxBlocks });
      else {
        // free neighbouring blocks of the same resource, best reserve first
        const cand = [];
        b.tiles.forEach(j => { const t = state.tiles[j]; N4.forEach(([dx, dy]) => { const x = t.x + dx, y = t.y + dy; if (x < 0 || y < 0 || x >= WORLD || y >= WORLD) return; const k = idx(x, y), u = state.tiles[k]; if (u.t === d.on && !b.tiles.includes(k) && inLevel(state.level, u.x, u.y) && !cand.includes(k)) cand.push(k); }); });
        const free = cand.filter(k => !state.tiles[k].b).sort((p, q) => state.tiles[q].res - state.tiles[p].res);
        const blocked = cand.filter(k => state.tiles[k].b);
        // each extra block costs more than the last: 1.2x a new block's price, then 1.5x, then 1.8x
        const cost = Math.round(d.cost * (0.9 + 0.3 * n));
        let why = locked;
        if (!why && !free.length) why = blocked.length ? 'The next ' + labelFor(d.on) + ' block has a building on it. Demolish it first.' : 'No more ' + labelFor(d.on) + ' blocks next to this factory';
        if (!why && cost > state.money + 1e-9) why = 'Not enough money (needs ' + fmtMoney(cost) + ')';
        out.push({ kind: 'block', ok: !why, why, cost, tile: free[0], blocked, level: n, max: d.maxBlocks,
          gain: { gen: (d.gen || 0), econ: d.econ || 0, jobs: d.max || 0, minJobs: d.min || 0, pol: d.pol || 0, use: d.use || 0, water: d.wR || 0, energy: d.energy || 0 } });
      }
    }
    if (HOUSING.includes(b.type)) {
      for (const key of ['solar', 'rwh']) {
        const u = HOUSE_UP[key], cost = u.cost[b.type] * K;
        let why = locked;
        if (!why && b.up[key]) why = 'Already installed';
        if (!why && cost > state.money + 1e-9) why = 'Not enough money (needs ' + fmtMoney(cost) + ')';
        out.push({ kind: key, name: u.name, desc: u.desc, ok: !why, why, cost, done: !!b.up[key],
          gain: key === 'solar' ? { gen: Math.round(d.cap * 0.3) } : { water: Math.round(d.cap * 0.5) } });
      }
    }
    return out;
  }
  function upgrade(state, id, kind) {
    const opt = upgradeOptions(state, id).find(o => o.kind === kind);
    if (!opt || !opt.ok) return { ok: false, why: opt ? opt.why : 'Not available' };
    const b = state.buildings[id];
    state.money -= opt.cost;
    if (kind === 'block') {
      // the crew grows in the same proportion as the plant
      const n0 = b.tiles.length;
      b.tiles.push(opt.tile); state.tiles[opt.tile].b = id;
      b.workers = Math.round(b.workers * (n0 + 1) / n0);
      return { ok: true, tile: opt.tile, cost: opt.cost };
    }
    b.up[kind] = true;
    return { ok: true, cost: opt.cost };
  }

  // ---------- Yearly flows ----------
  function levelTiles(state) { return state.tiles.filter(t => inLevel(state.level, t.x, t.y)); }
  function modPct(state, key) { let p = 0; for (const m of state.mods) if (m.key === key && m.until > state.year) p += m.pct; return p; }
  function isDrought(state) { return (state.rain != null ? state.rain : 1) < 0.7; }
  function demandMul(state) { return Math.min(1.5, 1 + 0.004 * state.year); }

  function flows(state) {
    const T = state.tiles, land = levelTiles(state);
    const bl = Object.values(state.buildings);
    const pop = Math.max(0, state.pop);
    const adults = Math.max(0, state.adults);
    const workforce = Math.floor(adults * 0.8);
    const dm = demandMul(state);

    // green cover and rain (from the city only: forests up, pollution down)
    const emptyGrass = land.filter(t => (t.t === 'grass' || isDepositType(t.t)) && !t.b).length;
    const greenBlocks = bl.filter(b => B[b.type].green).length;
    // Life on Land: planted forest (parks count half), land left wild, and how much of the ground has been dug up
    const forestShare = land.length ? bl.reduce((a, b) => a + (b.type === 'forest' ? 1 : b.type === 'park' ? 0.5 : 0), 0) / land.length : 0;
    const wildShare = land.length ? land.filter(t => t.t === 'grass' && !t.b).length / land.length : 0;
    const depLand = land.filter(t => t.resMax > 0);
    const dugShare = depLand.length ? depLand.reduce((a, t) => a + (t.resMax - t.res) / t.resMax, 0) / depLand.length : 0;
    const green = land.length ? (emptyGrass * 0.5 + greenBlocks) / land.length : 0;
    const rain = clamp((0.5 + 1.4 * green) * (1 - 0.5 * state.pollution / 100) * (1 + modPct(state, 'rainPct10y') / 100), 0.2, 1.4);
    const drought = rain < 0.7;

    // roads
    const roadSet = new Set();
    bl.forEach(b => { if (b.type === 'road') b.tiles.forEach(i => roadSet.add(i)); });
    const nearRoad = b => b.tiles.some(i => { const t = T[i]; return N4.some(([dx, dy]) => { const x = t.x + dx, y = t.y + dy; return x >= 0 && y >= 0 && x < WORLD && y < WORLD && roadSet.has(idx(x, y)); }); });

    // staffing: power, food, water, health/storage, schools, everything else
    const prio = b => { const d = B[b.type]; return b.type === 'foodFarm' ? 0 : d.gen ? 1 : b.type === 'waterPlant' ? 2 : (b.type === 'hospital' || b.type === 'granary' || b.type === 'battery') ? 3 : b.type === 'school' ? 4 : 5; };
    const staffed = bl.filter(b => B[b.type].min).sort((a, b) => prio(a) - prio(b) || (+a.id.slice(1)) - (+b.id.slice(1)));
    let left = workforce, want = 0, jobs = 0, unstaffed = 0;
    // debt: buildings slow down at once; after 5 years in debt in a row the city cuts back hard (austerity)
    const debtYears = (state.streak && state.streak.debt) || 0, austerity = state.money < 0 && debtYears >= 5;
    const debtMul = state.money < 0 ? (austerity ? 0.75 : 0.9) : 1;
    // trained workers (from schools, one generation at a time): plants, factories and hospitals need them
    const trained = state.trained == null ? 0.6 : state.trained;
    const skill = clamp(0.7 + 0.5 * trained, 0.7, 1.2);
    bl.forEach(b => { b._road = nearRoad(b); b._live = blocksOf(b); if (!B[b.type].min) { b._eff = 1; b._w = 0; } });
    const live = [];
    staffed.forEach(b => {
      const d = B[b.type];
      if (d.perBlock) { b._live = b.tiles.filter(j => T[j].res > 0).length; b._dead = b._live === 0; } else b._dead = false;
      b._w = 0; b._eff = 0;
      if (b._dead) return;
      const n = d.perBlock ? b.tiles.length : 1, mn = d.min * n, mx = d.max * n;
      b._mn = mn; b._mx = clamp(b.workers, mn, mx); want += b._mx;
      live.push(b);
    });
    // pass 1: every building gets its minimum crew, in priority order (food, power, water, services, schools, the rest)
    const open = [];
    live.sort((a, b) => prio(a) - prio(b) || (+a.id.slice(1)) - (+b.id.slice(1)));
    live.forEach(b => {
      if (left < b._mn) { unstaffed++; return; }
      left -= b._mn; b._w = b._mn; open.push(b);
    });
    // pass 2: then up to the number of workers the team chose for it (b.workers)
    for (const b of open) { const add = Math.min(left, b._mx - b._w); b._w += add; left -= add; }
    // output is proportional to the crew: half the maximum crew = half the output
    open.forEach(b => { jobs += b._w; const mx = B[b.type].max * (B[b.type].perBlock ? b.tiles.length : 1); b._eff = (b._w / Math.max(1, mx)) * debtMul; });
    const unemployed = Math.max(0, workforce - jobs);
    // factory waste reaching the river: treatment plants take in 160 units of waste each
    const DIRTY = { coalPlant: 7.5, goldFactory: 8, mineralMine: 6, itPark: 4, cashFarm: 1, nuclear: 0.8 };
    let waste = 0, treat = 0;
    bl.forEach(b => { if (!(b._eff > 0)) return; if (DIRTY[b.type]) waste += DIRTY[b.type] * (B[b.type].perBlock ? b.tiles.length : 1) * b._eff; if (b.type === 'waterPlant') treat += 16 * b._eff; });
    const riverDirty = waste > 0 ? clamp((waste - treat) / waste, 0, 1) * Math.min(1, waste / 10) : 0;

    // energy
    let renewN = 0, batteries = 0;
    bl.forEach(b => { const d = B[b.type]; if (d.renew && !d.firm) renewN++; if (b.type === 'battery' && b._eff > 0) batteries += b._eff; });
    const firmShare = renewN ? Math.min(1, batteries * BASE.battery.firmFor / renewN) : 1;
    const ePct = 1 + modPct(state, 'energyPct10y') / 100;
    let gen = 0, genClean = 0, genNuke = 0, eUse = 0;
    bl.forEach(b => {
      const d = B[b.type];
      const n = d.perBlock ? b._live : 1;
      if (d.gen) {
        let g = d.gen * n * b._eff * ePct * (SKILLED[b.type] ? skill : 1);
        if (d.renew && !d.firm) g *= 0.7 + 0.3 * firmShare;
        if (b.type === 'dam') g *= Math.min(1, rain + 0.2);
        gen += g;
        if (d.renew) genClean += g;
        if (b.type === 'nuclear') genNuke += g;
      }
      if (b.up && b.up.solar) { const g = d.cap * 0.3 * ePct; gen += g; genClean += g; }
      if (d.energy && b._eff > 0) eUse += d.energy * (d.perBlock ? b.tiles.length : 1);
    });
    const eDemand = pop * 0.5 * dm + eUse;
    const energyR = eDemand > 0 ? gen / eDemand : 1;
    // a city short of power: factories, services and pumps slow down (no power = a quarter of the output)
    const eR = Math.min(1, energyR), powerMul = 0.25 + 0.75 * eR;
    // forests: the first 8 clean the air fully, every one after that only half as much
    let forestN = 0;

    // production
    const foodPct = 1 + modPct(state, 'foodPct10y') / 100, incPct = 1 + modPct(state, 'incomePct10y') / 100;
    let food = 0, econ = 0, waterIn = 0, waterUse = 0, emis = pop * 0.05, absorb = 0, cap = 0, edu = 0, health = 0, foodCap = 0, maint = 0, waterCap = 1000 * K;
    let econExtract = 0, rwhWater = 0;
    bl.forEach(b => {
      const d = B[b.type];
      const n = d.perBlock ? b._live : 1, nAll = d.perBlock ? b.tiles.length : 1;
      const roadMul = b._road && b.type !== 'road' ? 1.15 : 1;
      // power cuts hit factories and services hard, farms (irrigation pumps) less
      const pm = d.food || d.cat === 'agri' ? 0.7 + 0.3 * eR : powerMul;
      const eff = d.gen ? b._eff : b._eff * (d.min ? pm : 1) * (SKILLED[b.type] ? skill : 1);
      maint += (d.maint || 0) * nAll;
      if (d.cap) cap += d.cap;
      if (d.food) food += d.food * eff * roadMul * (0.5 + 0.5 * Math.min(1.2, rain)) * foodPct;
      if (d.econ) { const e = d.econ * n * eff * roadMul * incPct; econ += e; if (d.on) econExtract += e; }
      if (d.wR && b._eff > 0) waterUse += d.wR * nAll * 0.85;
      if (d.waterIn) waterIn += d.waterIn * eff;
      if (d.waterCap) waterCap += d.waterCap;
      if (d.pol && b._eff > 0) emis += d.pol * n * (d.min ? Math.max(0.5, eff) : 1);
      if (d.absorb) { let a = d.absorb * (d.min ? eff : 1); if (b.type === 'forest' && ++forestN > 8) a *= 0.5; absorb += a; }
      if (d.edu) edu += d.edu * eff;
      if (d.health) health += d.health * eff;
      if (d.foodCap) foodCap += d.foodCap * eff;
      if (b.up && b.up.rwh) { const w = d.cap * 0.5 * rain; waterIn += w; rwhWater += w; }
    });
    const river = land.filter(t => t.t === 'river').length;
    absorb += emptyGrass * 6;
    waterIn += (50 + river * 25) * K * rain * (0.6 + 0.4 * eR); // river water is pumped: less of it without power
    waterUse += pop * 0.85 * dm;
    const eduCov = pop ? Math.min(1, edu / pop) : 0;
    const healthCov = pop ? Math.min(1, health / pop) : 0;
    econ *= 1 + 0.25 * eduCov;
    // taxes from people in work, and surplus food sold at market
    const tax = jobs * 0.3 * (1 + 0.3 * eduCov) * incPct;
    const foodSales = Math.max(0, food - pop) * 0.12;
    econ += tax + foodSales;
    // debt costs interest: 4% of what the city owes, every year
    const interest = state.money < 0 ? -state.money * 0.04 : 0;
    const costs = maint + pop * 0.1 + unemployed * 0.08 + interest;
    const polTarget = Math.min(100, 100 * emis / (emis + 1.2 * absorb + 1));

    const structures = bl.filter(b => !['road', 'park', 'forest'].includes(b.type));
    const connected = structures.length ? structures.filter(b => b._road).length / structures.length : 0;

    return {
      greenBlocks, riverDirty, forestShare, wildShare, dugShare, pop, workforce, jobs, unemployed, employment: workforce ? Math.min(1, jobs / workforce) : 1, staffRatio: want ? Math.min(1, jobs / want) : 1, unstaffed,
      food, foodDemand: pop, water: waterIn, waterDemand: waterUse, waterCap, rwhWater,
      gen, eDemand, energyR, cleanShare: gen ? (genClean + 0.5 * genNuke) / gen : 0, nukeShare: gen ? genNuke / gen : 0,
      econ, costs, net: econ - costs, econExtract, tax, foodSales, interest, austerity, debtYears, trained, skill,
      cap, eduCov, healthCov, foodCap, emis, absorb, polTarget, connected, green, rain, drought,
      landUsed: land.filter(t => t.b).length, landTotal: land.length,
    };
  }

  // ---------- Population (one year) ----------
  function popYear(state, f, foodR, waterR, mode) {
    const kids = state.kids, adults = state.adults, elders = state.elders, pop = kids + adults + elders;
    // children per couple (2 to 4) depend on schools and hospitals, NOT on food: families keep
    // growing whether or not the city can feed them. If the food is not there, people starve.
    const tfr = 3.6 - 1.6 * clamp(0.55 * f.eduCov + 0.25 * f.healthCov, 0, 1);
    const bPct = 1 + modPct(state, 'birthsPct10y') / 100;
    const spread = mode === 'grow' ? 8 : 20;
    const births = adults * 0.5 * 0.55 * tfr / spread * bPct;
    // causes of death
    const h = Math.max(0, 1 - foodR), t = Math.max(0, 1 - waterR);
    const u = f.workforce ? f.unemployed / f.workforce : 0;
    const s = f.cap ? clamp(pop / f.cap - 1, 0, 1) : 1;
    const P = state.pollution, hc = f.healthCov;
    const dPct = 1 + modPct(state, 'deathsPct10y') / 100;
    const care = 1 - 0.4 * hc;
    const dark = 1 - Math.min(1, f.energyR == null ? 1 : f.energyR);
    const rates = (base, hw, pw, sw, polw, oldCare, dw) => ({
      hunger: hw * h, thirst: hw * t, poverty: pw * u * care, slums: sw * s * care, pollution: polw * P * care, old: base * oldCare, dark: dw * dark,
    });
    const R = {
      // starvation is the main killer when food runs short: weights are deaths per year per share unfed
      kids: rates(0.004, 0.8, 0.02, 0.04, 0.0003, care, 0.006),
      adults: rates(0.003, 0.6, 0.02, 0.03, 0.00015, care, 0.004),
      elders: rates(0.07, 1.0, 0.03, 0.03, 0.0003, 1 - 0.35 * hc, 0.015),
    };
    const died = { hunger: 0, thirst: 0, poverty: 0, slums: 0, pollution: 0, old: 0, dark: 0 };
    const deaths = {};
    for (const g of ['kids', 'adults', 'elders']) {
      const r = R[g]; let tot = 0; for (const k in r) tot += r[k];
      tot = Math.min(0.9, tot * dPct);
      const n = state[g] * tot; deaths[g] = n;
      const sum = Object.values(r).reduce((x, y) => x + y, 0) || 1;
      for (const k in r) died[k] += n * r[k] / sum;
    }
    const totalDeaths = deaths.kids + deaths.adults + deaths.elders;
    return { births, deaths, died, totalDeaths, tfr, per1000: { births: pop ? births / pop * 1000 : 0, deaths: pop ? totalDeaths / pop * 1000 : 0 } };
  }

  // ---------- One simulated year ----------
  // mode: 'grow' (Level 1→2: people change, no game over) or 'dyn' (game-over rules apply)
  function step(state, mode) {
    let f = flows(state);
    // people who came of working age join understaffed buildings automatically
    if (autoAssign(state, f) > 0) f = flows(state);
    state.rain = f.rain;
    state.money += f.net;
    state.debt = state.money < 0;
    // water
    const wAvail = state.water + f.water;
    const waterR = f.waterDemand ? Math.min(1.5, wAvail / f.waterDemand) : 1;
    state.water = Math.max(0, Math.min(f.waterCap, wAvail - f.waterDemand));
    // the monsoon refills part of the empty reservoir every year (less in a dry year)
    const refill = (f.waterCap - state.water) * 0.2 * Math.min(1, f.rain);
    state.water = Math.min(f.waterCap, state.water + refill);
    state.tally.refill = (state.tally.refill || 0) + refill;
    // food with storage
    let foodR;
    if (f.food >= f.foodDemand) {
      foodR = f.foodDemand ? f.food / f.foodDemand : 1;
      state.foodStore = Math.min(Math.max(f.foodCap, state.foodStore), state.foodStore + (f.food - f.foodDemand));
    } else {
      const need = f.foodDemand - f.food, draw = Math.min(need, state.foodStore);
      state.foodStore -= draw;
      foodR = (f.food + draw) / f.foodDemand;
    }
    if (state.foodStore > f.foodCap) state.foodStore = Math.max(f.foodCap, state.foodStore * 0.7); // unstored food spoils
    // resources: each covered block is mined
    Object.values(state.buildings).forEach(b => {
      const d = B[b.type];
      if (!d.perBlock || !(b._eff > 0)) return;
      const dep = state.deposits[state.tiles[b.tiles[0]].dep];
      b.tiles.forEach(j => {
        const t = state.tiles[j]; if (t.res <= 0) return;
        const used = Math.min(t.res, d.use * b._eff);
        t.res -= used; state.tally.used[t.t] = (state.tally.used[t.t] || 0) + used;
        if (t.res <= 0) state.log.push({ year: state.year + 1, text: 'A ' + labelFor(t.t) + ' block under the ' + d.name + ' ran out.' });
      });
      if (b.tiles.every(j => state.tiles[j].res <= 0)) state.log.push({ year: state.year + 1, text: d.name + ' closed: all its ' + labelFor(d.on) + ' is used up.' });
    });
    Object.values(state.deposits).forEach(dep => { dep.reserve = dep.tiles.reduce((s, j) => s + state.tiles[j].res, 0); });
    // pollution
    state.pollution = clamp(state.pollution + 0.15 * (f.polTarget - state.pollution), 0, 100);
    // people
    const p = popYear(state, f, foodR, waterR, mode);
    const toAdults = state.kids / 15, toElders = state.adults / 45;
    // the village teaches its own children until schools can be built (Level 1); after that only schools train them
    const teach = state.level === 1 ? Math.max(0.6, f.eduCov) : f.eduCov;
    if (state.adults + toAdults > 0) { const tr = state.trained == null ? 0.6 : state.trained; state.trained = clamp((tr * Math.max(0, state.adults - toElders) + teach * toAdults) / Math.max(1, state.adults - toElders + toAdults), 0, 1); }
    state.kids = Math.max(0, state.kids + p.births - p.deaths.kids - toAdults);
    state.adults = Math.max(0, state.adults + toAdults - p.deaths.adults - toElders);
    state.elders = Math.max(0, state.elders + toElders - p.deaths.elders);
    state.pop = state.kids + state.adults + state.elders;
    if (state.pop < 1) { state.pop = state.kids = state.adults = state.elders = 0; }
    const T = state.tally;
    T.years++; T.born += p.births; for (const k in p.died) T.died[k] += p.died[k]; T.rainSum += f.rain;

    // SDGs for this year
    const popBefore = Math.max(1, state.pop + p.totalDeaths);
    const s = sdgYear(state, f, foodR, waterR, p.totalDeaths / popBefore, p.died, popBefore);
    if (!state.sdgSum) state.sdgSum = Object.fromEntries(SDGS.map(x => [x.key, 0]));
    SDGS.forEach(x => state.sdgSum[x.key] = (state.sdgSum[x.key] || 0) + s[x.key]);
    state.sdgYears++;
    // each round (the years after Level 1, 2 and 3) is scored on its own
    const era = clamp(state.level || 1, 1, 3);
    if (!state.eras) state.eras = {};
    const ER = state.eras[era] || (state.eras[era] = { years: 0, sum: Object.fromEntries(SDGS.map(x => [x.key, 0])), lost: 0, popYears: 0, debtYears: 0, lossYears: 0 });
    SDGS.forEach(x => ER.sum[x.key] = (ER.sum[x.key] || 0) + s[x.key]);
    ER.years++; ER.popYears += popBefore;
    ER.lost += p.died.hunger + p.died.thirst + p.died.poverty + p.died.slums + (p.died.dark || 0); // deaths a better-planned city would have prevented: hunger, thirst, joblessness, slums, no power
    if (state.money < 0) ER.debtYears++;
    if (f.net < 0) ER.lossYears++;

    state.year++;
    const rec = { year: state.year, pop: Math.round(state.pop), kids: Math.round(state.kids), adults: Math.round(state.adults), elders: Math.round(state.elders),
      births: Math.round(p.births), deaths: Math.round(p.totalDeaths), money: Math.round(state.money), pollution: +state.pollution.toFixed(1),
      food: +foodR.toFixed(2), water: +waterR.toFixed(2), energy: +f.energyR.toFixed(2), rain: +f.rain.toFixed(2), drought: f.drought, sdg: +avg(s).toFixed(1) };
    state.history.push(rec);

    if (mode !== 'dyn' && state.pop < 5) state.dead = { year: state.year, why: 'population', text: 'Nobody was left: the city could not feed its people.' };
    state.streak.debt = state.money < 0 ? (state.streak.debt || 0) + 1 : 0;
    state.streak.dark = f.energyR < 0.5 ? (state.streak.dark || 0) + 1 : 0;
    if (mode === 'dyn') {
      const sd = state.streak.debt, sk = state.streak.dark;
      const fin = state.finalStart != null;
      if (sd === 5) state.log.push({ year: state.year, text: 'Five years in debt: schools, hospitals and factories cut back.' + (fin ? ' Fifteen more and the city goes bankrupt.' : ' In the final run, 20 years in debt ends a city.') });
      if (sd === 15 && fin) state.log.push({ year: state.year, text: 'Fifteen years in debt. Five more and the city is bankrupt.' });
      if (sk === 5) state.log.push({ year: state.year, text: 'Five years with less than half the power the city needs: people are dying in the dark.' + (fin ? ' Ten more and the lights go out for good.' : ' In the final run, 15 years like this ends a city.') });
      if (sk === 10 && fin) state.log.push({ year: state.year, text: 'Ten years of blackouts. Five more and the city cannot go on.' });
      const short = foodR < 0.9 || waterR < 0.9;
      state.streak.short = short ? state.streak.short + 1 : 0;
      state.streak.pol = state.pollution > 75 ? state.streak.pol + 1 : 0;
      if (state.pop < 5) state.dead = { year: state.year, why: 'population', text: 'The population collapsed to zero.' };
      else if (state.streak.short >= 8) state.dead = { year: state.year, why: 'famine', text: 'Food or water ran short for 8 years in a row.' };
      else if (state.streak.pol >= 10) state.dead = { year: state.year, why: 'pollution', text: 'Pollution stayed above 75% for 10 years in a row.' };
      // bankruptcy and blackouts end a city only in the final run; before that they warn, cost lives and points
      else if (state.finalStart != null && state.streak.debt >= 20) state.dead = { year: state.year, why: 'bankrupt', text: 'The city was in debt for 20 years in a row and went bankrupt.' };
      else if (state.finalStart != null && state.streak.dark >= 15) state.dead = { year: state.year, why: 'blackout', text: 'Less than half the power the city needs for 15 years in a row: the lights went out for good.' };
    }
    return rec;
  }

  function sdgYear(state, f, foodR, waterR, deathRate, died, popBefore) {
    const P = state.pollution;
    const pop = Math.max(1, f.pop);
    const dr = deathRate == null ? 0.012 : deathRate;
    const per = k => died && popBefore ? died[k] / popBefore : 0;
    const u = f.workforce ? f.unemployed / f.workforce : 0;
    const clean = Math.min(1, f.energyR) * f.cleanShare;
    return {
      // SDG 1: jobs for everyone who can work, a city that pays its way, no debt
      poverty: 100 * (0.6 * clamp(1 - 2 * u, 0, 1) + 0.4 * (f.net >= 0 ? 1 : 0.6 * clamp(1 + f.net / Math.max(1, f.costs), 0, 1))) * (state.money >= 0 ? 1 : 0.5),
      // nobody goes hungry, and nobody starves (2.5% starving in a year = 0)
      hunger: 100 * clamp((foodR - 0.8) / 0.2, 0, 1) * (1 - clamp(per('hunger') * 40, 0, 1)),
      health: 100 * (0.35 * f.healthCov + 0.2 * (1 - P / 100) + 0.45 * (1 - clamp((dr - 0.012) / 0.02, 0, 1))),
      edu: 100 * f.eduCov,
      water: 100 * Math.min(1, waterR) * (state.water > 0.15 * f.waterCap ? 1 : 0.85) * (1 - 0.35 * (f.riverDirty || 0)) * (1 - clamp(per('thirst') * 40, 0, 1)),
      // power for everyone, and how much of it is clean
      energy: 100 * Math.min(1, f.energyR) * (0.5 + 0.5 * f.cleanShare),
      work: 100 * Math.min(1, f.employment / 0.9) * (state.money >= 0 ? 1 : 0.8),
      infra: 100 * f.connected,
      // SDG 11, as the UN measures it: safe homes for everyone (11.1), streets that connect them (11.2)
      // and public green space (11.7): one park or forest block for every 500 people
      cities: 100 * (0.5 * Math.min(1, f.cap / pop) + 0.25 * f.connected + 0.25 * Math.min(1, (f.greenBlocks || 0) / Math.max(1, pop / 500))),
      // income that does not dig up the island, food kept for bad years, and no nuclear waste piling up
      consume: 100 * (1 - (f.econ ? f.econExtract / f.econ : 0) * 0.7) * (f.foodCap > 0 ? 1 : 0.85) * (f.econ > 0 ? 1 : 0.5) * (1 - 0.3 * (f.nukeShare || 0)),
      // clean air AND clean energy actually delivered (a city with no power gets half)
      climate: 100 * (1 - P / 100) * (0.5 + 0.5 * clean),
      partner: 100 * clamp(0.5 + (state.goodwill || 0) / 8, 0, 1),
      // natural land: planted forest, parks (half) or land simply left wild all count; a little real forest for wildlife
      land: 100 * (0.6 * Math.min(1, ((f.forestShare || 0) + 0.8 * (f.wildShare || 0)) / 0.3) + 0.2 * Math.min(1, (f.forestShare || 0) / 0.03) + 0.2 * (1 - f.dugShare)),
    };
  }
  function avg(o) { const v = Object.values(o); return v.reduce((a, b) => a + b, 0) / v.length; }

  // ---------- Live numbers for the planning screen (no time passes) ----------
  function supplyRatios(state, f) {
    return {
      foodR: f.foodDemand ? (f.food + state.foodStore) / f.foodDemand : 1,
      waterR: f.waterDemand ? (f.water + state.water * 0.1) / f.waterDemand : 1,
    };
  }
  function rates(state, f, mode) {
    f = f || flows(state);
    const r = supplyRatios(state, f);
    const p = popYear(state, f, r.foodR, r.waterR, mode || (state.level === 1 ? 'grow' : 'dyn'));
    return { births: p.births, deaths: p.totalDeaths, per1000: p.per1000, tfr: p.tfr, died: p.died };
  }
  function outlook(state) {
    const f = flows(state);
    const r = supplyRatios(state, f);
    const rt = rates(state, f);
    const s = sdgYear(state, f, r.foodR, r.waterR, rt.deaths / Math.max(1, state.pop));
    return { f, s, score: avg(s), rates: rt };
  }
  // what is going on, for the news ticker (never says what to build)
  function situations(state, f) {
    f = f || flows(state);
    const r = supplyRatios(state, f), out = [];
    if (r.foodR < 1) out.push('hungry');
    if (r.waterR < 1 || state.water < 0.1 * f.waterCap) out.push('thirsty');
    if (f.energyR < 1) out.push('no_power');
    if (f.workforce && f.unemployed / f.workforce > 0.15) out.push('jobless');
    if (f.cap && state.pop > f.cap) out.push('slums');
    if (state.pollution > 45) out.push('polluted');
    if (f.drought) out.push('drought');
    if (f.austerity) out.push('austerity'); else if (state.money < 0) out.push('broke'); else if (state.money > 3000 && f.net > 0) out.push('rich');
    if (state.level >= 2 && f.trained < 0.35) out.push('untrained');
    if (state.pop && state.kids / state.pop > 0.38) out.push('many_children');
    if (state.pop && state.elders / state.pop > 0.18) out.push('many_elderly');
    const coal = Object.values(state.buildings).filter(b => b.type === 'coalPlant');
    if (coal.length && coal.some(b => b.tiles.reduce((s, j) => s + state.tiles[j].res, 0) < 0.25 * RES_PER_BLOCK.coal * b.tiles.length)) out.push('coal_running_out');
    if (f.green > 0.35) out.push('green_city');
    if (!out.length || (out.length === 1 && out[0] === 'green_city')) out.push(state.pollution < 25 && f.healthCov > 0.5 ? 'healthy_city' : 'idle');
    return out;
  }

  // ---------- Checkpoint events ----------
  // The events of the 50-year jump are schedule[0..5]; the final run uses schedule[6..11].
  function pausesFor(state, phase) {
    const base = phase === 'final' ? state.finalStart : state.jumpStart;
    const list = phase === 'final' ? PAUSES.final : PAUSES.jump2;
    const off = phase === 'final' ? PAUSES.jump2.length : 0;
    return list.map((y, k) => ({ year: base + y, eventId: state.schedule[off + k], n: off + k }));
  }
  function applyEffects(state, eff, r, years) {
    const lost = [];
    if (!eff) return lost;
    r = r || rng((state.seed ^ state.year * 7919) >>> 0);
    for (const [k, v] of Object.entries(eff)) {
      if (k === 'money') state.money += v;
      else if (k === 'water') state.water = Math.max(0, state.water + v);
      else if (k === 'food') state.foodStore = Math.max(0, state.foodStore + v);
      else if (k === 'people') { const ad = Math.round(v * 0.7), kd = v - ad; state.adults += ad; state.kids += kd; state.pop = state.kids + state.adults + state.elders; }
      else if (k === 'pollution') state.pollution = clamp(state.pollution + v, 0, 100);
      else if (/Pct10y$/.test(k)) state.mods.push({ key: k, pct: v, until: state.year + (years || 10), added: state.year });
      else if (k === 'waterPct') state.water = Math.max(0, state.water * (1 + v / 100));
      else if (k === 'foodStorePct') state.foodStore = Math.max(0, state.foodStore * (1 + v / 100));
      else if (k === 'killPct') killNow(state, v);
      else if (k === 'destroy') {
        const exposed = Object.values(state.buildings).filter(b => v.types.includes(b.type));
        let n = Math.round(exposed.length * v.pct / 100);
        while (n-- > 0 && exposed.length) { const b = exposed.splice(Math.floor(r() * exposed.length), 1)[0]; lost.push(B[b.type].name); demolish(state, b.id); }
      }
      else if (k === 'forestBlocks') {
        if (v > 0) {
          const spots = levelTiles(state).filter(t => t.t === 'grass' && !t.b);
          for (let n = 0; n < v && spots.length; n++) { const t = spots.splice(Math.floor(r() * spots.length), 1)[0]; addBuilding(state, 'forest', [idx(t.x, t.y)], false); }
        } else {
          let left = -v;
          const greens = Object.values(state.buildings).filter(b => b.type === 'forest' || b.type === 'park');
          while (left > 0 && greens.length) { demolish(state, greens.splice(Math.floor(r() * greens.length), 1)[0].id); left--; }
          if (left > 0) state.pollution = clamp(state.pollution + 2 * left, 0, 100);
        }
      } else if (k === 'coalTonnes') {
        const coal = state.tiles.filter(t => t.t === 'coal');
        if (coal.length) coal.forEach(t => { t.res += v / coal.length; t.resMax = Math.max(t.resMax, t.res); });
      }
    }
    return lost;
  }
  // The shock's impact (scaled by how ready the city is) always applies; then the chosen response.
  // Returns the choice plus an outcome line for the screen and the "What happened" card.
  function scaleEff(eff, mul) {
    const o = {};
    for (const [k, v] of Object.entries(eff || {})) o[k] = typeof v === 'number' ? v * mul : k === 'destroy' ? Object.assign({}, v, { pct: v.pct * mul }) : v;
    return o;
  }
  const MOD_NAME = { foodPct10y: 'Food output', deathsPct10y: 'Death rate', incomePct10y: 'Income', rainPct10y: 'Rain', energyPct10y: 'Energy output', birthsPct10y: 'Births' };
  // plain words for what a crisis will do (shown before choosing)
  function describeImpact(eff, years) {
    const out = [];
    for (const [k, v] of Object.entries(eff)) {
      if (MOD_NAME[k]) out.push(MOD_NAME[k] + ' ' + (v > 0 ? '+' : '−') + Math.abs(Math.round(v)) + '% for ' + years + ' years');
      else if (k === 'killPct') out.push('about ' + v.toFixed(1) + '% of people at risk of dying now');
      else if (k === 'waterPct') out.push('reservoir ' + Math.round(v) + '%');
      else if (k === 'foodStorePct') out.push('stored food ' + Math.round(v) + '%');
      else if (k === 'money') out.push((v < 0 ? '−' : '+') + fmtMoney(Math.abs(Math.round(v))) + ' in damage');
      else if (k === 'pollution') out.push('pollution +' + Math.round(v));
      else if (k === 'destroy') out.push('about ' + Math.round(v.pct) + '% of exposed buildings damaged');
    }
    return out;
  }
  // people die now (more of the old and the young)
  function killNow(state, pct) {
    if (!(pct > 0) || state.pop <= 0) return 0;
    const w = { kids: 1.2, adults: 0.7, elders: 2.5 };
    const tot = state.kids * w.kids + state.adults * w.adults + state.elders * w.elders;
    const want = state.pop * pct / 100;
    let dead = 0;
    for (const g of ['kids', 'adults', 'elders']) { const n = Math.min(state[g], want * state[g] * w[g] / Math.max(1, tot)); state[g] -= n; dead += n; }
    state.pop = state.kids + state.adults + state.elders;
    return dead;
  }
  function resolveEvent(state, eventId, choiceIndex, content) {
    const def = EVENTS[eventId]; if (!def) return null;
    state.flags = state.flags || {}; state.memory = state.memory || []; state.helpLog = state.helpLog || []; state.goodwill = state.goodwill || 0; state.marks = state.marks || [];
    const c = content && content[eventId];
    const title = (c && c.title) || def.title;
    const view = eventView(state, eventId);
    const list = view.choices;
    let k = Math.max(0, Math.min(list.length - 1, choiceIndex | 0));
    if (list[k].disabled) k = defaultChoice(eventId, state);
    const choice = list[k];
    const label = (!choice.cannot && c && c.choices && c.choices[k] && c.choices[k].label) || choice.label;
    let outcome = '', news = choice.news, protect = choice.protect || 0;
    const before = { pop: state.pop, money: state.money, water: state.water, food: state.foodStore, pollution: state.pollution, n: Object.keys(state.buildings).length };
    let eff = Object.assign({}, choice.effects);
    if (choice.factoryHeat) { const fac = runningFactories(state); eff.deathsPct10y = (eff.deathsPct10y || 0) + Math.min(25, 3 * fac); }
    if (choice.ask) {
      const g = state.goodwill, last = state.helpLog[state.helpLog.length - 1];
      if (g >= 2) {
        eff = Object.assign({}, def.help); state.goodwill -= 1; protect = 0.5;
        outcome = 'The neighbours you helped' + (last ? ' in year ' + last.year : '') + ' send ' + def.helpText + '.';
      } else if (g >= 0) {
        eff = scaleEff(def.help, 0.4); protect = 0.2;
        outcome = 'The neighbours send a little ' + def.helpText + '. They are not sure they can count on you.';
      } else {
        eff = {};
        outcome = 'No help comes. The neighbours remember you turned them away' + (last ? ' in year ' + last.year : '') + '.';
      }
      news = outcome;
    }
    // the crisis itself (how hard depends on the city), then the response
    let died = 0, lost = [];
    if (def.impact) {
      const imp = scaleEff(def.impact, view.mul);
      if (imp.killPct) { died = killNow(state, imp.killPct * (1 - protect)); delete imp.killPct; }
      lost = applyEffects(state, imp, null, def.impactYears) || [];
    }
    applyEffects(state, eff);
    (choice.later || []).forEach(l => state.mods.push({ key: l.key, pct: l.pct, until: state.year + l.years, added: state.year }));
    if (choice.goodwill != null) {
      state.goodwill = clamp(state.goodwill + choice.goodwill, -4, 6);
      state.helpLog.push({ year: state.year, id: eventId, helped: choice.goodwill > 0 });
      outcome = choice.cannot ? 'The neighbours understand. Nothing changes.' : choice.goodwill > 0 ? 'The neighbours will remember this.' : choice.goodwill < 0 ? 'The neighbours will remember this too.' : '';
    }
    if (choice.flag) state.flags[choice.flag] = state.year;
    // what actually changed, for the screen, the chart and the "What happened" card
    const impact = {
      people: Math.round(state.pop - before.pop), money: Math.round(state.money - before.money), water: Math.round(state.water - before.water),
      food: Math.round(state.foodStore - before.food), pollution: +(state.pollution - before.pollution).toFixed(1), buildings: lost.length, lost,
      lasting: Object.entries(state.mods.filter(m => m.added === state.year).reduce((o, m) => { o[m.key] = (o[m.key] || 0) + m.pct; return o; }, {}))
        .filter(([key, v]) => MOD_NAME[key] && Math.round(v) !== 0).map(([key, v]) => MOD_NAME[key] + ' ' + (v > 0 ? '+' : '−') + Math.abs(Math.round(v)) + '%'),
    };
    if (state.tally && died) state.tally.died.crisis = (state.tally.died.crisis || 0) + died;
    state.marks.push({ year: state.year, title, shock: !!view.shock, people: impact.people });
    if (view.notes.length && def.impact) state.memory.push({ year: state.year, text: title + ': ' + (view.mul > 1.15 ? 'hit harder because of the city you built. ' : view.mul < 0.85 ? 'softened by the city you built. ' : '') + view.notes.filter(n => /year \d+/.test(n)).join(' ') });
    if (outcome) state.memory.push({ year: state.year, text: outcome });
    state.eventsDone.push({ id: eventId, choice: k, year: state.year });
    state.tally.events.push({ id: eventId, title, choice: label, news, outcome, severity: view.mul, impact });
    state.log.push({ year: state.year, text: title + ': ' + label + '.' + (outcome ? ' ' + outcome : '') });
    return Object.assign({}, choice, { label, news, outcome, severity: view.mul, impact, index: k });
  }

  // ---------- Level transitions ----------
  function advance(state, years, mode) {
    const recs = [];
    for (let i = 0; i < years && !state.dead; i++) recs.push(step(state, mode));
    return recs;
  }
  function startLevel(state, lvl) {
    state.level = lvl; state.phase = 'plan';
    state.log.push({ year: state.year, text: 'Level ' + lvl + ': the land grows to ' + LEVELS[lvl].size + '×' + LEVELS[lvl].size + '.' });
  }
  // Planned length of each round: set when the round starts (beginEra); missing years after a city dies score 0.
  function beginEra(state, era, years) {
    state.eraPlan = state.eraPlan || {}; state.eraPlan[era] = years;
    // the final run starts the debt and blackout clocks afresh: what you built in Level 3 gets its chance
    if (era === 3 && state.streak) { state.streak.debt = 0; state.streak.dark = 0; }
  }
  function eraReport(state, era, cap) {
    const ER = state.eras && state.eras[era];
    const plan = (state.eraPlan && state.eraPlan[era]) || (era === 3 ? (cap || CAP_YEARS) - (state.finalStart || state.year) : ER ? ER.years : 0);
    if (!ER || !ER.years) return { era, years: 0, plan, base: 0, sdg: null, lostPer1000: 0, penLives: 0, penMoney: 0, score: 0, reached: false };
    const sdg = {}; SDGS.forEach(x => sdg[x.key] = ER.sum[x.key] / ER.years);
    const coverage = plan ? Math.min(1, ER.years / plan) : 1;
    const base = avg(sdg) * coverage;
    const lostPer1000 = ER.lost / Math.max(1, ER.popYears) * 1000;   // preventable deaths per 1,000 people a year
    const penLives = Math.min(20, Math.max(0, lostPer1000 - 2) * 2);   // a little bad luck is free; above 2 per 1,000 a year it costs
    const penMoney = 25 * ER.debtYears / ER.years + 8 * ER.lossYears / ER.years;   // years in debt cost up to 25 points, losing money up to 8
    return { era, years: ER.years, plan, base, sdg, lostPer1000, penLives, penMoney, score: Math.max(0, base - penLives - penMoney), reached: true };
  }
  function result(state, cap) {
    const rounds = [1, 2, 3].map(e => eraReport(state, e, cap));
    let score = 0; rounds.forEach(r => score += ERA_W[r.era] * r.score);
    // the SDG breakdown shown to players: the same weights over the rounds the city reached
    const sdg = {};
    SDGS.forEach(x => { let v = 0; rounds.forEach(r => { v += ERA_W[r.era] * (r.sdg ? r.sdg[x.key] * Math.min(1, r.years / Math.max(1, r.plan)) : 0); }); sdg[x.key] = +v.toFixed(1); });
    return { score: +score.toFixed(1), sdg, rounds: rounds.map(r => Object.assign({}, r, { weight: ERA_W[r.era], base: +r.base.toFixed(1), score: +r.score.toFixed(1), penLives: +r.penLives.toFixed(1), penMoney: +r.penMoney.toFixed(1), lostPer1000: +r.lostPer1000.toFixed(1) })),
      years: state.year, alive: !state.dead, why: state.dead ? state.dead.why : null, whyText: state.dead ? state.dead.text : null, pop: Math.round(state.pop) };
  }

  const api = {
    SKILLED, K, B, BASE, HOUSING, HOUSE_UP, RES_PER_BLOCK, UNIT, SDGS, LEVELS, WORLD, PAUSES, CAP_YEARS, EVENTS, SHOCKS,
    idx, inLevel, newGame, canPlace, build, demolish, footprint, factoryPaths, maxPathSize, costOf, upgradeOptions, upgrade,
    flows, step, advance, startLevel, result, isDrought, labelFor, fmtMoney, outlook, rates, situations, resetTally,
    pausesFor, resolveEvent, applyEffects, blocksOf, eventView, severity, NEIGHBOUR, NEWC, defaultChoice, relevantEvent, eventMakesSense, choicesFor, setWorkers, autoAssign, beginEra, eraReport, ERA_W, L1_BUDGET, L1_CAPS, L1_FREE,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Eco = api;
})(typeof window !== 'undefined' ? window : globalThis);
