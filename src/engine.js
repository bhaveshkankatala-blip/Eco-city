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
    house:      { name: 'Individual Houses', cat: 'housing', lvl: 2, cost: 30, cap: 20, maint: 0.6, pol: 0.2, energy: 1,
                  desc: 'Low density: 200 people per block. Cheap, but uses a lot of land.' },
    community:  { name: 'Community Housing', cat: 'housing', lvl: 2, cost: 70, cap: 45, maint: 1.5, pol: 0.4, energy: 2,
                  desc: 'Row houses with shared spaces: 450 people per block.' },
    apartment:  { name: 'Apartments', cat: 'housing', lvl: 2, cost: 150, cap: 90, maint: 3, pol: 0.6, energy: 6,
                  desc: 'High density: 900 people per block. Needs more energy for lifts and pumps.' },

    foodFarm:   { name: 'Food Crops', cat: 'agri', lvl: 1, cost: 25, wB: 10, wR: 30, min: 4, max: 8, energy: 1, food: 40, econ: 5, pol: 0.5, maint: 1,
                  desc: 'Rice, wheat, pulses. Feeds up to 400 people a year in a normal monsoon.' },
    cashFarm:   { name: 'Cash Crops', cat: 'agri', lvl: 1, cost: 25, wB: 10, wR: 45, min: 4, max: 8, energy: 1, econ: 20, pol: 1, maint: 1,
                  desc: 'Cotton, sugarcane, spices. Earns money but feeds no one, and is thirsty.' },

    coalPlant:  { name: 'Coal Factory', cat: 'industry', lvl: 1, on: 'coal', perBlock: true, maxBlocks: 3, cost: 45, upCost: 30, wB: 20, wR: 17, min: 4, max: 8, gen: 40, econ: 12, pol: 7.5, maint: 1.7, use: 20,
                  desc: 'Mines coal and burns it for power. Covers 1–3 coal blocks; each block runs out.' },
    goldFactory:{ name: 'Gold Factory', cat: 'industry', lvl: 1, on: 'gold', perBlock: true, maxBlocks: 2, cost: 90, upCost: 55, wB: 30, wR: 40, min: 8, max: 15, energy: 15, econ: 65, pol: 8, maint: 4, use: 15,
                  desc: 'Mines and refines gold. Big income. Covers 1–2 gold blocks; gold runs out.' },
    nuclear:    { name: 'Nuclear Power Plant', cat: 'industry', lvl: 1, on: 'uranium', perBlock: true, maxBlocks: 4, cost: 100, upCost: 60, wB: 40, wR: 30, min: 5, max: 9, gen: 75, econ: 6, pol: 0.8, maint: 3, use: 1,
                  desc: 'Huge, fairly clean power that lasts centuries, but very thirsty. Covers 1–4 uranium blocks.' },
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
    solar:      { name: 'Solar Panels', cat: 'energy', lvl: 2, cost: 50, min: 1, max: 2, gen: 30, maint: 1.5, renew: true,
                  desc: 'Clean energy. Output varies with sunlight unless you add storage.' },

    hospital:   { name: 'Hospital', cat: 'services', lvl: 3, cost: 150, min: 10, max: 20, energy: 10, health: 250, maint: 8,
                  desc: 'Cares for 2,500 people. Fewer deaths, longer lives, smaller families.' },
    granary:    { name: 'Food Storage', cat: 'services', lvl: 3, cost: 80, min: 2, max: 4, energy: 2, foodCap: 300, maint: 2,
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
                  desc: 'Planted trees. Absorbs the most pollution and brings the most rain.' },
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
  ];

  const WORLD = 15;
  const LEVELS = {
    1: { size: 10, off: 2, title: 'Foundations', sub: 'A village of 1,000 people. Building is free, but land, workers and water are not. Plan for the children who are coming.' },
    2: { size: 12, off: 1, title: 'Grow the City', sub: 'Spend what your city earned. Homes, clean energy, roads, schools, upgrades. The land has grown 1.5×.' },
    3: { size: 15, off: 0, title: 'Plan for the Future', sub: 'The children of Level 1 are adults now. Storage, hospitals, jobs and pollution control decide the next centuries.' },
  };
  // checkpoint pauses, in years from the start of each jump
  const PAUSES = { jump2: [10, 20, 30, 40], final: [20, 60, 120, 200, 300] };
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
  const SHOCKS = ['monsoon-failure', 'heatwave', 'disease-outbreak', 'fuel-price-crash'];
  const EVENTS = {
    'monsoon-failure': { title: 'The monsoon fails', text: 'The clouds came and went without rain. Wells are dropping and the fields are cracking.',
      impact: { rainPct10y: -40 }, impactYears: 3,
      choices: [
        { label: 'Truck in water', detail: 'Buy water from far away. Expensive, but the taps keep running.', effects: { money: -400, water: 3000 }, news: 'Water tankers line the highway for weeks' },
        { label: 'Ration water', detail: 'Strict limits for everyone. Crops and people suffer, the budget does not.', effects: { foodPct10y: -15, deathsPct10y: 10 }, news: 'Two buckets a day: the new rule on every street' },
        { label: 'Plant forests', detail: 'Plant 3 forest blocks now for rain in later years. Costs money today.', effects: { money: -250, forestBlocks: 3 }, news: 'Volunteers plant saplings on the dry hills' } ] },
    'heatwave': { title: 'Heatwave', text: 'Forty-seven degrees for three weeks. Fans run day and night and the old are suffering.',
      impact: { deathsPct10y: 25 }, impactYears: 3,
      choices: [
        { label: 'Open cooling centres', detail: 'Air-cooled halls for the elderly. Costs money and power.', effects: { money: -300, energyPct10y: -10, deathsPct10y: -10 }, news: 'Cooling halls packed with grandparents and card games' },
        { label: 'Cut factory hours', detail: 'Factories pause in the afternoon. Fewer deaths, less income.', effects: { incomePct10y: -20, deathsPct10y: -8 }, news: 'Sirens at noon: factories shut for the hottest hours' },
        { label: 'Carry on', detail: 'Business as usual. No cost now; more deaths.', effects: { deathsPct10y: 10 }, news: 'The city sweats it out' } ] },
    'disease-outbreak': { title: 'Disease outbreak', text: 'A fever is spreading fastest through the crowded lanes. Hospitals are filling up.',
      impact: { deathsPct10y: 30 }, impactYears: 3,
      choices: [
        { label: 'Free treatment', detail: 'The city pays for every patient. Expensive, saves lives.', effects: { money: -500, deathsPct10y: -15 }, news: 'Queues at free clinics stretch around the block' },
        { label: 'Lockdown', detail: 'Close markets and factories for a while. Fewer deaths, much less income.', effects: { incomePct10y: -30, deathsPct10y: -12 }, news: 'Empty markets as the city stays home' },
        { label: 'Wait it out', detail: 'No cost now. The fever runs its course.', effects: {}, news: 'Fever season: every family knows someone ill' } ] },
    'fuel-price-crash': { title: 'Fuel and metal prices crash', text: 'World prices for coal and gold have collapsed. Mines and factories are earning far less.',
      impact: { incomePct10y: -30 }, impactYears: 5,
      choices: [
        { label: 'Keep mines running', detail: 'Keep every job. Income stays low for years.', effects: {}, news: 'Mines keep digging, for less and less' },
        { label: 'Retrain workers', detail: 'Pay to retrain miners for other work. Costs money, income recovers.', effects: { money: -350, incomePct10y: 15 }, news: 'Miners back in classrooms, learning new trades' },
        { label: 'Sell coal reserves', detail: 'Sell coal rights cheap for quick cash. Pollution from the buyers drifts in.', effects: { money: 400, pollution: 6 }, news: 'Coal trucks roll out of town at bargain prices' } ] },
    'baby-boom': { title: 'Baby boom', text: 'Maternity wards are full. Every street has a new cradle.',
      choices: [
        { label: 'Celebrate', detail: 'Let it happen. Many more children to feed in the years ahead.', effects: { birthsPct10y: 35 }, news: 'Sweet shops sell out as the cradles fill' },
        { label: 'Family planning drive', detail: 'Free clinics and education. Costs money, slower growth.', effects: { money: -200, birthsPct10y: -15 }, news: 'Family health camps in every ward' } ] },
    'flood': { title: 'Flash flood', text: 'A cloudburst upstream. The river has burst its banks and fields are under water.',
      choices: [
        { label: 'Rebuild fast', detail: 'Emergency repairs. Costs money, food recovers quickly.', effects: { money: -300, food: -1500 }, news: 'Sandbags and shovels: the city digs out' },
        { label: 'Let fields recover', detail: 'No spending. Harvests are poor for years.', effects: { foodPct10y: -20 }, news: 'Silt-covered fields lie empty' } ] },
    'forest-fire': { title: 'Forest fire', text: 'Dry winds have carried a fire into the forest on the hills.',
      choices: [
        { label: 'Fight the fire', detail: 'Every hand on the fire line. Costs money, saves the forest.', effects: { money: -250, pollution: 3 }, news: 'Firefighters hold the line at the ridge' },
        { label: 'Let it burn out', detail: 'No cost now. Two forest blocks are lost and the air fills with smoke.', effects: { forestBlocks: -2, pollution: 10 }, news: 'Ash falls on the city for a week' } ] },
    'good-harvest': { title: 'Bumper harvest', text: 'Perfect weather. The granaries are overflowing.',
      choices: [
        { label: 'Store it', detail: 'Keep the extra food for bad years.', effects: { food: 2500 }, news: 'Granaries full to the roof' },
        { label: 'Sell it', detail: 'Sell the surplus for money now.', effects: { money: 350 }, news: 'Grain traders crowd the market' } ] },
    'factory-strike': { title: 'Factory strike', text: 'Workers want safer factories and cleaner air. The gates are shut.',
      choices: [
        { label: 'Meet their demands', detail: 'Pay for safety and filters. Costs money, cleaner air.', effects: { money: -300, pollution: -5 }, news: 'Strike ends with new filters on the chimneys' },
        { label: 'Refuse', detail: 'No cost now. The strike drags on and income falls.', effects: { incomePct10y: -20 }, news: 'Silent factories as the strike enters its third month' } ] },
    'new-technology': { title: 'New technology offer', text: 'A company offers cheaper, better solar and wind equipment, if you sign today.',
      choices: [
        { label: 'Sign the deal', detail: 'Pay now; clean energy output rises for years.', effects: { money: -350, energyPct10y: 20 }, news: 'New panels glint on rooftops across the city' },
        { label: 'Not now', detail: 'Keep the money.', effects: {}, news: 'City passes on the energy deal' } ] },
    'forest-land-offer': { title: 'Company wants forest land', text: 'A developer offers good money to clear forest for a warehouse park.',
      choices: [
        { label: 'Sell the land', detail: 'Money now. Two forest blocks cleared; less rain later.', effects: { money: 500, forestBlocks: -2 }, news: 'Bulldozers move into the old forest' },
        { label: 'Protect the forest', detail: 'Turn it down.', effects: {}, news: 'Forest stays standing after heated council debate' } ] },
    'college-demand': { title: 'Students want a college', text: 'Young people are leaving school with nowhere to go. They want a college in the city.',
      choices: [
        { label: 'Fund a college', detail: 'Costs money; smaller families and better jobs later.', effects: { money: -400, birthsPct10y: -10, incomePct10y: 10 }, news: 'Foundation stone laid for the city college' },
        { label: 'Maybe later', detail: 'Keep the money.', effects: {}, news: 'Students march, then go home' } ] },
    'neighbour-water': { title: 'Neighbour needs water', text: 'A drought-hit town downstream asks to share your reservoir.',
      choices: [
        { label: 'Share water', detail: 'Give 2,000 water. They pay a little and remember it.', effects: { water: -2000, money: 150 }, news: 'Tankers head downstream with your water' },
        { label: 'Refuse', detail: 'Keep your water.', effects: {}, news: 'Neighbours turned away at the gates' } ] },
    'more-coal': { title: 'New coal seam found', text: 'Surveyors have found more coal under your existing coal blocks.',
      choices: [
        { label: 'Mine it', detail: '+1,000 kt coal for your coal blocks, and more smoke for years.', effects: { coalTonnes: 1000, pollution: 4 }, news: 'Coal rush: the mines hire again' },
        { label: 'Leave it underground', detail: 'Keep the air clean.', effects: {}, news: 'Coal seam sealed and left alone' } ] },
  };
  const OTHERS = Object.keys(EVENTS).filter(k => !SHOCKS.includes(k));

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

    // checkpoint events: all four shocks plus five others, in a random order per team
    const others = OTHERS.slice();
    for (let i = others.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [others[i], others[j]] = [others[j], others[i]]; }
    const schedule = SHOCKS.concat(others.slice(0, 5));
    for (let i = schedule.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [schedule[i], schedule[j]] = [schedule[j], schedule[i]]; }

    const state = {
      v: 2, seed, team: team || '', level: 1, year: 0, phase: 'plan',
      tiles, deposits, buildings: {}, bid: 0,
      kids: 300 * 1, adults: 600, elders: 100, pop: 1000,
      money: 0, water: 600 * K, foodStore: 0, pollution: 12, rain: 1,
      mods: [], schedule, eventsDone: [], tally: null,
      history: [], log: [], sdgSum: null, sdgYears: 0, streak: { short: 0, pol: 0 },
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

  function addBuilding(state, type, tiles, initial) {
    const id = 'b' + (++state.bid);
    const d = B[type];
    const n = d.perBlock ? tiles.length : 1;
    state.buildings[id] = { id, type, tiles, workers: (d.max || 0) * n, built: state.year, initial: !!initial, up: {} };
    for (const i of tiles) state.tiles[i].b = id;
    return id;
  }
  function resetTally(state) {
    state.tally = { years: 0, born: 0, died: { hunger: 0, thirst: 0, poverty: 0, slums: 0, pollution: 0, old: 0 }, rainSum: 0, popStart: state.pop, moneyStart: state.money, used: {}, events: [] };
  }

  // ---------- Placement ----------
  const isDepositType = t => t === 'coal' || t === 'gold' || t === 'uranium' || t === 'mineral';
  function blocksOf(b) { return B[b.type].perBlock ? b.tiles.length : 1; }
  function costOf(state, type, i, size) {
    if (state.level === 1) return 0;
    const d = B[type];
    if (type === 'road' && state.tiles[i].t === 'river') return d.bridgeCost;
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
    const id = addBuilding(state, type, c.fp);
    return { ok: true, id, cost: c.cost };
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
        const cost = d.upCost;
        let why = locked;
        if (!why && !free.length) why = blocked.length ? 'The next ' + labelFor(d.on) + ' block has a building on it. Demolish it first.' : 'No more ' + labelFor(d.on) + ' blocks next to this factory';
        if (!why && cost > state.money + 1e-9) why = 'Not enough money (needs ' + fmtMoney(cost) + ')';
        out.push({ kind: 'block', ok: !why, why, cost, tile: free[0], blocked, level: n, max: d.maxBlocks,
          gain: { gen: (d.gen || 0), econ: d.econ || 0, jobs: d.max || 0, pol: d.pol || 0 } });
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
      b.tiles.push(opt.tile); state.tiles[opt.tile].b = id;
      b.workers += B[b.type].max;
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
    // workers freed by a demolition wait (hold) until the player says where they go
    let left = Math.max(0, workforce - (state.hold || 0)), want = 0, jobs = 0, unstaffed = 0;
    const debtMul = state.debt ? 0.85 : 1;
    bl.forEach(b => { b._road = nearRoad(b); b._live = blocksOf(b); if (!B[b.type].min) { b._eff = 1; b._w = 0; } });
    const open = [], live = [];
    staffed.forEach(b => {
      const d = B[b.type];
      if (d.perBlock) { b._live = b.tiles.filter(j => T[j].res > 0).length; b._dead = b._live === 0; } else b._dead = false;
      b._w = 0; b._eff = 0;
      if (b._dead) return;
      const n = d.perBlock ? b.tiles.length : 1, mn = d.min * n, mx = d.max * n;
      b._mn = mn; b._mx = clamp(b.workers, mn, mx); want += b._mx;
      live.push(b);
    });
    // pass 0: buildings the player gave workers to are staffed first
    live.forEach(b => {
      if (!(b.pin > 0)) return;
      const w = clamp(b.pin, b._mn, b._mx);
      if (left < w) return;
      left -= w; b._w = w; b._pinned = true; open.push(b);
    });
    // pass 1: every other building gets its minimum, in priority order
    live.forEach(b => {
      if (b._w) return;
      b._pinned = false;
      if (left < b._mn) { unstaffed++; return; }
      left -= b._mn; b._w = b._mn; open.push(b);
    });
    open.sort((a, b) => prio(a) - prio(b) || (+a.id.slice(1)) - (+b.id.slice(1)));
    // pass 2: spare workers go to open buildings in priority order, up to each one's limit
    for (const b of open) { const add = Math.min(left, b._mx - b._w); b._w += add; left -= add; }
    open.forEach(b => { jobs += b._w; const mx = B[b.type].max * (B[b.type].perBlock ? b.tiles.length : 1); b._eff = (0.6 + 0.4 * (b._w - b._mn) / Math.max(1, mx - b._mn)) * debtMul; });
    const unemployed = Math.max(0, workforce - jobs);

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
        let g = d.gen * n * b._eff * ePct;
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
    const powerMul = 0.5 + 0.5 * Math.min(1, energyR);

    // production
    const foodPct = 1 + modPct(state, 'foodPct10y') / 100, incPct = 1 + modPct(state, 'incomePct10y') / 100;
    let food = 0, econ = 0, waterIn = 0, waterUse = 0, emis = pop * 0.05, absorb = 0, cap = 0, edu = 0, health = 0, foodCap = 0, maint = 0, waterCap = 800 * K;
    let econExtract = 0, rwhWater = 0;
    bl.forEach(b => {
      const d = B[b.type];
      const n = d.perBlock ? b._live : 1, nAll = d.perBlock ? b.tiles.length : 1;
      const roadMul = b._road && b.type !== 'road' ? 1.15 : 1;
      // power cuts hit factories and services hard, farms only a little
      const pm = d.food || d.cat === 'agri' ? 0.85 + 0.15 * Math.min(1, energyR) : powerMul;
      const eff = d.gen ? b._eff : b._eff * (d.min ? pm : 1);
      maint += (d.maint || 0) * nAll;
      if (d.cap) cap += d.cap;
      if (d.food) food += d.food * eff * roadMul * (0.5 + 0.5 * Math.min(1.2, rain)) * foodPct;
      if (d.econ) { const e = d.econ * n * eff * roadMul * incPct; econ += e; if (d.on) econExtract += e; }
      if (d.wR && b._eff > 0) waterUse += d.wR * nAll;
      if (d.waterIn) waterIn += d.waterIn * eff;
      if (d.waterCap) waterCap += d.waterCap;
      if (d.pol && b._eff > 0) emis += d.pol * n * (d.min ? Math.max(0.5, eff) : 1);
      if (d.absorb) absorb += d.absorb * (d.min ? eff : 1);
      if (d.edu) edu += d.edu * eff;
      if (d.health) health += d.health * eff;
      if (d.foodCap) foodCap += d.foodCap * eff;
      if (b.up && b.up.rwh) { const w = d.cap * 0.5 * rain; waterIn += w; rwhWater += w; }
    });
    const river = land.filter(t => t.t === 'river').length;
    absorb += emptyGrass * 6;
    waterIn += (50 + river * 25) * K * rain;
    waterUse += pop * 1.0 * dm;
    const eduCov = pop ? Math.min(1, edu / pop) : 0;
    const healthCov = pop ? Math.min(1, health / pop) : 0;
    econ *= 1 + 0.25 * eduCov;
    // taxes from people in work, and surplus food sold at market
    const tax = jobs * 0.3 * (1 + 0.3 * eduCov) * incPct;
    const foodSales = Math.max(0, food - pop) * 0.12;
    econ += tax + foodSales;
    const costs = maint + pop * 0.1 + unemployed * 0.08;
    const polTarget = Math.min(100, 100 * emis / (emis + 1.2 * absorb + 1));

    const structures = bl.filter(b => !['road', 'park', 'forest'].includes(b.type));
    const connected = structures.length ? structures.filter(b => b._road).length / structures.length : 0;

    return {
      pop, workforce, jobs, unemployed, employment: workforce ? Math.min(1, jobs / workforce) : 1, staffRatio: want ? Math.min(1, jobs / want) : 1, unstaffed,
      food, foodDemand: pop, water: waterIn, waterDemand: waterUse, waterCap, rwhWater,
      gen, eDemand, energyR, cleanShare: gen ? (genClean + 0.7 * genNuke) / gen : 0,
      econ, costs, net: econ - costs, econExtract, tax, foodSales,
      cap, eduCov, healthCov, foodCap, emis, absorb, polTarget, connected, green, rain, drought,
      landUsed: land.filter(t => t.b).length, landTotal: land.length,
    };
  }

  // ---------- Population (one year) ----------
  function popYear(state, f, foodR, waterR, mode) {
    const kids = state.kids, adults = state.adults, elders = state.elders, pop = kids + adults + elders;
    const a = clamp(Math.min(foodR, waterR), 0, 2);
    // children per couple: food and water push toward 4, schools and hospitals pull toward 2
    let tfr = 2 + 2 * clamp((a - 0.95) / 0.4, 0, 1);
    tfr -= (tfr - 2) * clamp(0.55 * f.eduCov + 0.25 * f.healthCov, 0, 0.9);
    const bPct = 1 + modPct(state, 'birthsPct10y') / 100;
    const spread = mode === 'grow' ? 8 : 20;
    const births = adults * 0.5 * 0.55 * tfr / spread * Math.pow(Math.min(1, a), 2) * bPct;
    // causes of death
    const h = Math.max(0, 1 - foodR), t = Math.max(0, 1 - waterR);
    const u = f.workforce ? f.unemployed / f.workforce : 0;
    const s = f.cap ? clamp(pop / f.cap - 1, 0, 1) : 1;
    const P = state.pollution, hc = f.healthCov;
    const dPct = 1 + modPct(state, 'deathsPct10y') / 100;
    const care = 1 - 0.4 * hc;
    const rates = (base, hw, pw, sw, polw, oldCare) => ({
      hunger: hw * h, thirst: hw * t, poverty: pw * u * care, slums: sw * s * care, pollution: polw * P * care, old: base * oldCare,
    });
    const R = {
      kids: rates(0.004, 0.45, 0.02, 0.04, 0.0003, care),
      adults: rates(0.003, 0.3, 0.02, 0.03, 0.00015, care),
      elders: rates(0.07, 0.6, 0.03, 0.03, 0.0003, 1 - 0.35 * hc),
    };
    const died = { hunger: 0, thirst: 0, poverty: 0, slums: 0, pollution: 0, old: 0 };
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
    const f = flows(state);
    state.rain = f.rain;
    state.money += f.net;
    state.debt = state.money < 0;
    // water
    const wAvail = state.water + f.water;
    const waterR = f.waterDemand ? Math.min(1.5, wAvail / f.waterDemand) : 1;
    state.water = Math.max(0, Math.min(f.waterCap, wAvail - f.waterDemand));
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
    state.kids = Math.max(0, state.kids + p.births - p.deaths.kids - toAdults);
    state.adults = Math.max(0, state.adults + toAdults - p.deaths.adults - toElders);
    state.elders = Math.max(0, state.elders + toElders - p.deaths.elders);
    state.pop = state.kids + state.adults + state.elders;
    if (state.pop < 1) { state.pop = state.kids = state.adults = state.elders = 0; }
    const T = state.tally;
    T.years++; T.born += p.births; for (const k in p.died) T.died[k] += p.died[k]; T.rainSum += f.rain;

    // SDGs for this year
    const s = sdgYear(state, f, foodR, waterR, p.totalDeaths / Math.max(1, state.pop + p.totalDeaths));
    if (!state.sdgSum) state.sdgSum = Object.fromEntries(SDGS.map(x => [x.key, 0]));
    SDGS.forEach(x => state.sdgSum[x.key] += s[x.key]);
    state.sdgYears++;

    state.year++;
    const rec = { year: state.year, pop: Math.round(state.pop), kids: Math.round(state.kids), adults: Math.round(state.adults), elders: Math.round(state.elders),
      births: Math.round(p.births), deaths: Math.round(p.totalDeaths), money: Math.round(state.money), pollution: +state.pollution.toFixed(1),
      food: +foodR.toFixed(2), water: +waterR.toFixed(2), energy: +f.energyR.toFixed(2), rain: +f.rain.toFixed(2), drought: f.drought, sdg: +avg(s).toFixed(1) };
    state.history.push(rec);

    if (mode === 'dyn') {
      const short = foodR < 0.9 || waterR < 0.9;
      state.streak.short = short ? state.streak.short + 1 : 0;
      state.streak.pol = state.pollution > 75 ? state.streak.pol + 1 : 0;
      if (state.pop < 5) state.dead = { year: state.year, why: 'population', text: 'The population collapsed to zero.' };
      else if (state.streak.short >= 8) state.dead = { year: state.year, why: 'famine', text: 'Food or water ran short for 8 years in a row.' };
      else if (state.streak.pol >= 10) state.dead = { year: state.year, why: 'pollution', text: 'Pollution stayed above 75% for 10 years in a row.' };
    }
    return rec;
  }

  function sdgYear(state, f, foodR, waterR, deathRate) {
    const P = state.pollution;
    const pop = Math.max(1, f.pop);
    // deaths above a natural ~1% a year count against health
    const dr = deathRate == null ? 0.012 : deathRate;
    return {
      hunger: 100 * clamp((foodR - 0.7) / 0.3, 0, 1),
      health: 100 * (0.35 * f.healthCov + 0.25 * (1 - P / 100) + 0.4 * (1 - clamp((dr - 0.012) / 0.03, 0, 1))),
      edu: 100 * f.eduCov,
      water: 100 * Math.min(1, waterR) * (state.water > 0.15 * f.waterCap ? 1 : 0.85),
      energy: 100 * (0.5 * Math.min(1, f.energyR) + 0.5 * f.cleanShare),
      work: 100 * Math.min(1, f.employment / 0.9) * (state.money >= 0 ? 1 : 0.8),
      infra: 100 * f.connected,
      cities: 100 * (0.6 * Math.min(1, f.cap / pop) + 0.4 * Math.min(1, f.green / 0.3)),
      consume: 100 * (1 - (f.econ ? f.econExtract / f.econ : 0) * 0.7) * (f.foodCap > 0 ? 1 : 0.85),
      climate: 100 * (1 - P / 100),
      land: 100 * Math.min(1, f.green / 0.3),
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
    if (state.money < 0) out.push('broke'); else if (state.money > 3000 && f.net > 0) out.push('rich');
    if (state.pop && state.kids / state.pop > 0.38) out.push('many_children');
    if (state.pop && state.elders / state.pop > 0.18) out.push('many_elderly');
    const coal = Object.values(state.buildings).filter(b => b.type === 'coalPlant');
    if (coal.length && coal.some(b => b.tiles.reduce((s, j) => s + state.tiles[j].res, 0) < 0.25 * RES_PER_BLOCK.coal * b.tiles.length)) out.push('coal_running_out');
    if (f.green > 0.35) out.push('green_city');
    if (!out.length || (out.length === 1 && out[0] === 'green_city')) out.push(state.pollution < 25 && f.healthCov > 0.5 ? 'healthy_city' : 'idle');
    return out;
  }

  // ---------- Checkpoint events ----------
  // The events of the 50-year jump are schedule[0..3]; the final run uses schedule[4..8].
  function pausesFor(state, phase) {
    const base = phase === 'final' ? state.finalStart : state.jumpStart;
    const list = phase === 'final' ? PAUSES.final : PAUSES.jump2;
    const off = phase === 'final' ? 4 : 0;
    return list.map((y, k) => ({ year: base + y, eventId: state.schedule[off + k], n: off + k }));
  }
  function applyEffects(state, eff, r, years) {
    if (!eff) return;
    r = r || rng((state.seed ^ state.year * 7919) >>> 0);
    for (const [k, v] of Object.entries(eff)) {
      if (k === 'money') state.money += v;
      else if (k === 'water') state.water = Math.max(0, state.water + v);
      else if (k === 'food') state.foodStore = Math.max(0, state.foodStore + v);
      else if (k === 'pollution') state.pollution = clamp(state.pollution + v, 0, 100);
      else if (/Pct10y$/.test(k)) state.mods.push({ key: k, pct: v, until: state.year + (years || 10) });
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
  }
  // the shock's own impact always applies; the choice adds its own effects
  function resolveEvent(state, eventId, choiceIndex, content) {
    const def = EVENTS[eventId]; if (!def) return null;
    const c = content && content[eventId];
    const choices = (c && c.choices) || def.choices;
    const choice = choices[Math.max(0, Math.min(choices.length - 1, choiceIndex | 0))];
    applyEffects(state, def.impact, null, def.impactYears);
    applyEffects(state, choice.effects);
    state.eventsDone.push({ id: eventId, choice: choiceIndex, year: state.year });
    state.tally.events.push({ id: eventId, title: (c && c.title) || def.title, choice: choice.label, news: choice.news });
    state.log.push({ year: state.year, text: ((c && c.title) || def.title) + ': ' + choice.label + '.' });
    return choice;
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
  function result(state, cap) {
    const n = Math.max(1, state.sdgYears);
    const sdg = {};
    SDGS.forEach(x => sdg[x.key] = +(state.sdgSum ? state.sdgSum[x.key] / n : 0).toFixed(1));
    const lasted = Math.min(1, state.year / (cap || CAP_YEARS));
    sdg.cities = +(0.7 * sdg.cities + 30 * lasted).toFixed(1);
    const score = +avg(sdg).toFixed(1);
    return { score, sdg, years: state.year, alive: !state.dead, why: state.dead ? state.dead.why : null, whyText: state.dead ? state.dead.text : null, pop: Math.round(state.pop) };
  }

  const api = {
    K, B, BASE, HOUSING, HOUSE_UP, RES_PER_BLOCK, UNIT, SDGS, LEVELS, WORLD, PAUSES, CAP_YEARS, EVENTS, SHOCKS,
    idx, inLevel, newGame, canPlace, build, demolish, footprint, factoryPaths, maxPathSize, costOf, upgradeOptions, upgrade,
    flows, step, advance, startLevel, result, isDrought, labelFor, fmtMoney, outlook, rates, situations, resetTally,
    pausesFor, resolveEvent, applyEffects, blocksOf,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Eco = api;
})(typeof window !== 'undefined' ? window : globalThis);
