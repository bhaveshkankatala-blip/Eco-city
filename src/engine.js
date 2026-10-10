/* EcoCity — Build to Last : simulation engine (pure, no DOM) */
(function (root) {
  'use strict';

  // ---------- Building catalogue ----------
  // cost: rupees (thousands). Level 1 builds are free (cost shown from Level 2).
  // wB = water to build (from reserve), wR = water to run per year
  // min/max = workers, energy = energy use/yr, gen = energy generated/yr
  // econ = income/yr at full staff, pol = pollution emitted/yr, maint = upkeep/yr
  // on = resource tile type it must sit on (whole deposit), use = deposit units/yr
  const B = {
    hut:        { name: 'Village House', cat: 'housing', lvl: 99, cost: 0, cap: 20, maint: 0.5, pol: 0.2, energy: 1,
                  desc: 'Original village homes. Houses 20 people.' },
    house:      { name: 'Individual Houses', cat: 'housing', lvl: 2, cost: 30, cap: 20, maint: 0.6, pol: 0.2, energy: 1,
                  desc: 'Low density. 20 people per block. Cheap but uses lots of land.' },
    community:  { name: 'Community Housing', cat: 'housing', lvl: 2, cost: 70, cap: 45, maint: 1.5, pol: 0.4, energy: 2,
                  desc: 'Row houses with shared spaces. 45 people per block.' },
    apartment:  { name: 'Apartments', cat: 'housing', lvl: 2, cost: 150, cap: 90, maint: 3, pol: 0.6, energy: 6,
                  desc: 'High density. 90 people per block. Needs more energy (lifts, pumps).' },

    foodFarm:   { name: 'Food Crops', cat: 'agri', lvl: 1, cost: 25, wB: 10, wR: 30, min: 4, max: 8, energy: 1, food: 40, econ: 5, pol: 0.5, maint: 1,
                  desc: 'Rice, wheat, pulses. Feeds up to 40 people a year.' },
    cashFarm:   { name: 'Cash Crops', cat: 'agri', lvl: 1, cost: 25, wB: 10, wR: 45, min: 4, max: 8, energy: 1, econ: 20, pol: 1, maint: 1,
                  desc: 'Cotton, sugarcane, spices. Earns money but feeds no one and is thirsty.' },

    coalPlant:  { name: 'Coal Factory', cat: 'industry', lvl: 1, on: 'coal', cost: 120, wB: 60, wR: 50, min: 12, max: 24, gen: 120, econ: 35, pol: 22, maint: 5, use: 10,
                  desc: 'Mines coal and burns it for power. Covers the 3-block coal deposit. Coal runs out.' },
    goldFactory:{ name: 'Gold Factory', cat: 'industry', lvl: 1, on: 'gold', cost: 90, wB: 30, wR: 40, min: 8, max: 15, energy: 15, econ: 65, pol: 8, maint: 4, use: 10,
                  desc: 'Mines and refines gold. Big income. Gold runs out.' },
    nuclear:    { name: 'Nuclear Power Plant', cat: 'industry', lvl: 1, on: 'uranium', cost: 400, wB: 150, wR: 120, min: 20, max: 35, gen: 300, econ: 25, pol: 3, maint: 12, use: 1,
                  desc: 'Covers the 4-block uranium deposit. Huge clean-ish power, very thirsty, long lasting.' },
    mineralMine:{ name: 'Natural Resource Mine', cat: 'industry', lvl: 1, on: 'mineral', cost: 60, wB: 20, wR: 20, min: 6, max: 12, energy: 8, econ: 32, pol: 6, maint: 3, use: 1,
                  desc: 'Stone, iron and sand for building. Steady income. Runs out slowly.' },

    road:       { name: 'Road / Bridge', cat: 'infra', lvl: 2, cost: 5, bridgeCost: 40, maint: 0.2,
                  desc: 'Buildings next to a road work 15% better. On a river it becomes a bridge (₹40k).' },
    school:     { name: 'School', cat: 'infra', lvl: 2, cost: 80, min: 6, max: 10, energy: 4, edu: 150, maint: 5, pol: 0.2,
                  desc: 'Educates 150 people. Educated cities earn more and plan smaller families.' },
    waterPlant: { name: 'Water Treatment', cat: 'infra', lvl: 2, cost: 100, min: 4, max: 8, energy: 15, waterIn: 150, maint: 5, pol: 0,
                  desc: 'Recycles waste water: +150 water a year.' },

    dam:        { name: 'Dam', cat: 'energy', lvl: 2, on: 'river', cost: 250, min: 6, max: 10, gen: 150, waterIn: 120, waterCap: 600, maint: 6, renew: true, firm: true, limit: 2,
                  desc: 'Built on the river. +150 energy, +120 water/yr and a bigger reservoir. Max 2.' },
    wind:       { name: 'Wind Mill', cat: 'energy', lvl: 2, cost: 60, min: 1, max: 2, gen: 35, maint: 2, renew: true,
                  desc: '+35 clean energy. Output varies with the wind unless you add storage.' },
    solar:      { name: 'Solar Panels', cat: 'energy', lvl: 2, cost: 50, min: 1, max: 2, gen: 30, maint: 1.5, renew: true,
                  desc: '+30 clean energy. Output varies with sunlight unless you add storage.' },

    hospital:   { name: 'Hospital', cat: 'services', lvl: 3, cost: 150, min: 10, max: 20, energy: 10, health: 250, maint: 8,
                  desc: 'Cares for 250 people. Lowers the death rate and pollution sickness.' },
    granary:    { name: 'Food Storage', cat: 'services', lvl: 3, cost: 80, min: 2, max: 4, energy: 2, foodCap: 300, maint: 2,
                  desc: 'Stores 300 food from good years to survive famine and drought.' },
    battery:    { name: 'Energy Storage', cat: 'energy', lvl: 3, cost: 100, min: 1, max: 2, firmFor: 4, maint: 3,
                  desc: 'Battery bank. Makes up to 4 solar/wind blocks give full, steady power.' },
    itPark:     { name: 'Industrial Park', cat: 'industry', lvl: 3, cost: 200, min: 20, max: 40, energy: 20, econ: 90, pol: 4, maint: 8,
                  desc: 'Workshops and offices. Lots of jobs and income without using up resources.' },
    recycling:  { name: 'Pollution Control', cat: 'services', lvl: 3, cost: 90, min: 4, max: 8, energy: 8, absorb: 12, econ: 4, maint: 4,
                  desc: 'Recycling and filters. Removes 12 pollution a year.' },
    park:       { name: 'Park', cat: 'services', lvl: 3, cost: 20, absorb: 3, green: true, maint: 0.5,
                  desc: 'Green space. Absorbs pollution and counts as green cover.' },
    forest:     { name: 'Forest Plantation', cat: 'services', lvl: 3, cost: 15, absorb: 4, green: true, maint: 0.2,
                  desc: 'Planted trees. Absorbs the most pollution per block.' },
  };

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
    1: { size: 10, off: 2, title: 'Foundations', sub: 'Feed, power and employ your first 100 people using the land you were given. Building is free, but land, workers and water are limited.' },
    2: { size: 12, off: 1, title: 'Grow the City', sub: 'Spend the money your city earned on homes, clean energy, roads and schools. The land has grown 1.5×.' },
    3: { size: 15, off: 0, title: 'Plan for the Future', sub: 'Prepare for droughts, famine and a changing population. Add storage, hospitals, jobs and pollution control.' },
  };
  // drought years counted from the start of the final run (same for every team)
  const DROUGHTS = [12, 70, 150, 260, 380, 520, 680, 850];
  const DROUGHT_LEN = 3;

  // ---------- RNG ----------
  function rng(seed) {
    let s = seed >>> 0 || 1;
    return function () { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  }

  const idx = (x, y) => y * WORLD + x;
  const inLevel = (lvl, x, y) => { const L = LEVELS[lvl]; return x >= L.off && y >= L.off && x < L.off + L.size && y < L.off + L.size; };
  function ringOf(x, y) { return inLevel(1, x, y) ? 1 : inLevel(2, x, y) ? 2 : 3; }

  // ---------- Map generation ----------
  function newGame(seed, team) {
    const r = rng(seed);
    const tiles = [];
    for (let y = 0; y < WORLD; y++) for (let x = 0; x < WORLD; x++) tiles.push({ x, y, t: 'grass', dep: null, b: null, v: r() });

    // river: top to bottom, meandering, kept inside the Level 1 window on its first rows
    let rx = 3 + Math.floor(r() * 3);
    if (r() < 0.5) rx = WORLD - 1 - rx;
    for (let y = 0; y < WORLD; y++) {
      tiles[idx(rx, y)].t = 'river';
      const step = r();
      let nx = rx + (step < 0.3 ? -1 : step > 0.7 ? 1 : 0);
      nx = Math.max(2, Math.min(WORLD - 3, nx));
      if (nx !== rx && y < WORLD - 1) { tiles[idx(nx, y)].t = 'river'; }
      rx = nx;
    }

    const deposits = {};
    let depN = 0;
    const free = (x, y) => x >= 0 && y >= 0 && x < WORLD && y < WORLD && tiles[idx(x, y)].t === 'grass' && !tiles[idx(x, y)].reserved;
    function place(type, shape, ring, reserve) {
      for (let tries = 0; tries < 400; tries++) {
        const x = Math.floor(r() * WORLD), y = Math.floor(r() * WORLD);
        const cells = shape.map(([dx, dy]) => [x + dx, y + dy]);
        if (!cells.every(([cx, cy]) => free(cx, cy) && ringOf(cx, cy) === ring)) continue;
        // keep a 1-tile gap from other deposits
        let clash = false;
        for (const [cx, cy] of cells) for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
          const tx = cx + ox, ty = cy + oy;
          if (tx >= 0 && ty >= 0 && tx < WORLD && ty < WORLD && tiles[idx(tx, ty)].dep) clash = true;
        }
        if (clash) continue;
        const id = 'd' + (++depN);
        deposits[id] = { id, type, tiles: cells.map(([cx, cy]) => idx(cx, cy)), reserve, max: reserve };
        for (const [cx, cy] of cells) { const t = tiles[idx(cx, cy)]; t.t = type; t.dep = id; }
        return true;
      }
      return false;
    }
    const line3 = () => (r() < 0.5 ? [[0, 0], [1, 0], [2, 0]] : [[0, 0], [0, 1], [0, 2]]);
    const one = [[0, 0]], sq = [[0, 0], [1, 0], [0, 1], [1, 1]];
    // Same counts for everyone, random positions
    const plan = {
      1: [['uranium', sq, 300], ['coal', 0, 300], ['coal', 0, 300], ['gold', one, 600], ['gold', one, 600], ['mineral', one, 80], ['mineral', one, 80], ['mineral', one, 80]],
      2: [['coal', 0, 300], ['gold', one, 600], ['mineral', one, 80], ['mineral', one, 80]],
      3: [['coal', 0, 300], ['gold', one, 600], ['mineral', one, 80], ['mineral', one, 80]],
    };
    for (const ring of [1, 2, 3]) for (const [type, shape, res] of plan[ring]) place(type, shape || line3(), ring, res);

    const state = {
      seed, team: team || '', level: 1, year: 0, phase: 'plan',
      tiles, deposits, buildings: {}, bid: 0,
      pop: 100, money: 0, water: 600, foodStore: 0, pollution: 12,
      history: [], log: [], sdgSum: null, sdgYears: 0, streak: { short: 0, pol: 0 },
      dead: null, finalStart: null, debt: false,
    };
    // starting village: 6 homes + a short lane near the centre of Level 1
    const L = LEVELS[1];
    const cx = L.off + 4 + Math.floor(r() * 2), cy = L.off + 4 + Math.floor(r() * 2);
    const spots = [];
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) spots.push([cx + dx, cy + dy]);
    spots.sort((a, b) => (Math.abs(a[0] - cx) + Math.abs(a[1] - cy)) - (Math.abs(b[0] - cx) + Math.abs(b[1] - cy)));
    let homes = 0, lane = 0;
    for (const [x, y] of spots) {
      if (!inLevel(1, x, y) || tiles[idx(x, y)].t !== 'grass') continue;
      if (lane < 3 && (x === cx)) { addBuilding(state, 'road', [idx(x, y)], true); lane++; continue; }
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
    state.buildings[id] = { id, type, tiles, workers: d.min || 0, built: state.year, initial: !!initial };
    for (const i of tiles) state.tiles[i].b = id;
    return id;
  }

  // ---------- Placement rules ----------
  function costOf(state, type, i) {
    if (state.level === 1) return 0;
    const d = B[type];
    if (type === 'road' && state.tiles[i].t === 'river') return d.bridgeCost;
    return d.cost;
  }
  function footprint(state, type, i) {
    const d = B[type], t = state.tiles[i];
    if (d.on && d.on !== 'river') return t.dep && t.t === d.on ? state.deposits[t.dep].tiles.slice() : [i];
    return [i];
  }
  function canPlace(state, type, i) {
    const d = B[type], t = state.tiles[i];
    if (!d || d.lvl > state.level) return { ok: false, why: 'Unlocks in Level ' + d.lvl };
    if (!inLevel(state.level, t.x, t.y)) return { ok: false, why: 'Outside your land' };
    if (t.b) return { ok: false, why: 'Already built here' };
    if (d.on === 'river') {
      if (t.t !== 'river') return { ok: false, why: 'Dams go on the river' };
      const n = Object.values(state.buildings).filter(b => b.type === type).length;
      if (d.limit && n >= d.limit) return { ok: false, why: 'Only ' + d.limit + ' dams allowed' };
    } else if (d.on) {
      if (t.t !== d.on) return { ok: false, why: d.name + ' must be built on a ' + labelFor(d.on) + ' deposit' };
    } else if (type === 'road') {
      if (t.t !== 'grass' && t.t !== 'river') return { ok: false, why: 'Roads cannot cover resource deposits' };
    } else if (t.t !== 'grass') {
      return { ok: false, why: t.t === 'river' ? 'Cannot build on the river' : 'Keep resource deposits for their factory' };
    }
    const fp = footprint(state, type, i);
    if (fp.some(j => state.tiles[j].b)) return { ok: false, why: 'Deposit already in use' };
    const cost = costOf(state, type, i);
    if (cost > state.money + 1e-9) return { ok: false, why: 'Not enough money (needs ₹' + cost + 'k)' };
    if ((d.wB || 0) > state.water) return { ok: false, why: 'Not enough water in the reservoir to build' };
    return { ok: true, fp, cost };
  }
  function labelFor(t) { return { coal: 'coal', gold: 'gold', uranium: 'uranium', mineral: 'natural resource' }[t] || t; }

  function build(state, type, i) {
    const c = canPlace(state, type, i);
    if (!c.ok) return c;
    state.money -= c.cost;
    state.water -= B[type].wB || 0;
    const id = addBuilding(state, type, c.fp);
    return { ok: true, id };
  }
  function demolish(state, id) {
    const b = state.buildings[id];
    if (!b) return;
    for (const i of b.tiles) state.tiles[i].b = null;
    delete state.buildings[id];
  }

  // ---------- Yearly flows ----------
  function levelTiles(state) { return state.tiles.filter(t => inLevel(state.level, t.x, t.y)); }
  function isDrought(state) {
    if (state.finalStart == null) return false;
    const y = state.year - state.finalStart;
    return DROUGHTS.some(d => y >= d && y < d + DROUGHT_LEN);
  }

  function flows(state) {
    const T = state.tiles, land = levelTiles(state);
    const bl = Object.values(state.buildings);
    const pop = Math.max(0, state.pop);
    const workforce = Math.floor(pop * 0.6);
    const drought = isDrought(state);

    // roads
    const roadSet = new Set();
    bl.forEach(b => { if (b.type === 'road') b.tiles.forEach(i => roadSet.add(i)); });
    const nearRoad = b => b.tiles.some(i => {
      const t = T[i];
      return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
        const x = t.x + dx, y = t.y + dy;
        return x >= 0 && y >= 0 && x < WORLD && y < WORLD && roadSet.has(idx(x, y));
      });
    });

    // staffing
    // Workers are assigned in priority order: power, food, water, health/storage, schools, everything else.
    const prio = b => { const d = B[b.type]; return d.gen ? 0 : b.type === 'foodFarm' ? 1 : b.type === 'waterPlant' ? 2 : (b.type === 'hospital' || b.type === 'granary' || b.type === 'battery') ? 3 : b.type === 'school' ? 4 : 5; };
    const staffed = bl.filter(b => B[b.type].min).sort((a, b) => prio(a) - prio(b) || (+a.id.slice(1)) - (+b.id.slice(1)));
    let left = workforce, want = 0, jobs = 0, unstaffed = 0;
    const debtMul = state.debt ? 0.85 : 1;
    bl.forEach(b => { b._road = nearRoad(b); if (!B[b.type].min) { b._eff = 1; b._w = 0; } });
    staffed.forEach(b => {
      const d = B[b.type];
      const dep = d.on && d.on !== 'river' ? state.deposits[T[b.tiles[0]].dep] : null;
      b._dead = dep ? dep.reserve <= 0 : false;
      if (b._dead) { b._eff = 0; b._w = 0; return; }
      want += b.workers;
      const w = Math.min(b.workers, left);
      if (w < d.min) { b._eff = 0; b._w = 0; unstaffed++; return; }
      left -= w; jobs += w; b._w = w;
      b._eff = (0.6 + 0.4 * (w - d.min) / Math.max(1, d.max - d.min)) * debtMul;
    });
    const staffRatio = want ? Math.min(1, jobs / want) : 1;

    // energy
    let renewN = 0, batteries = 0;
    bl.forEach(b => { const d = B[b.type]; if (d.renew && !d.firm) renewN++; if (b.type === 'battery' && b._eff > 0) batteries += b._eff; });
    const firmShare = renewN ? Math.min(1, batteries * B.battery.firmFor / renewN) : 1;
    let gen = 0, genClean = 0, genNuke = 0, eUse = 0;
    bl.forEach(b => {
      const d = B[b.type];
      if (d.gen) {
        let g = d.gen * b._eff;
        if (d.renew && !d.firm) g *= 0.7 + 0.3 * firmShare;
        if (b.type === 'dam' && drought) g *= 0.7;
        gen += g;
        if (d.renew) genClean += g;
        if (b.type === 'nuclear') genNuke += g;
      }
      if (d.energy && b._eff > 0) eUse += d.energy;
    });
    const eDemand = pop * 0.5 + eUse;
    const energyR = eDemand > 0 ? gen / eDemand : 1;
    const powerMul = 0.5 + 0.5 * Math.min(1, energyR);

    // production
    let food = 0, econ = 0, waterIn = 0, waterUse = 0, emis = pop * 0.05, absorb = 0, cap = 0, edu = 0, health = 0, foodCap = 0, maint = 0, waterCap = 800;
    let econExtract = 0;
    bl.forEach(b => {
      const d = B[b.type];
      const roadMul = b._road && b.type !== 'road' ? 1.15 : 1;
      const eff = d.gen ? b._eff : b._eff * (d.min ? powerMul : 1);
      maint += d.maint || 0;
      if (d.cap) cap += d.cap;
      if (d.food) food += d.food * eff * roadMul * (drought ? 0.6 : 1);
      if (d.econ) { const e = d.econ * eff * roadMul; econ += e; if (d.on) econExtract += e; }
      if (d.wR && b._eff > 0) waterUse += d.wR;
      if (d.waterIn) waterIn += d.waterIn * eff;
      if (d.waterCap) waterCap += d.waterCap;
      if (d.pol && b._eff > 0) emis += d.pol * (d.min ? Math.max(0.5, eff) : 1);
      if (d.absorb) absorb += d.absorb * (d.min ? eff : 1);
      if (d.edu) edu += d.edu * eff;
      if (d.health) health += d.health * eff;
      if (d.foodCap) foodCap += d.foodCap * eff;
    });
    const river = land.filter(t => t.t === 'river').length;
    const emptyGrass = land.filter(t => t.t === 'grass' && !t.b).length;
    const greenBlocks = bl.filter(b => B[b.type].green).length;
    absorb += emptyGrass * 0.6;
    waterIn += (100 + river * 30) * (drought ? 0.6 : 1);
    waterUse += pop * 1.0;
    const eduCov = pop ? Math.min(1, edu / pop) : 0;
    const healthCov = pop ? Math.min(1, health / pop) : 0;
    econ *= 1 + 0.25 * eduCov;
    const costs = maint + pop * 0.1;
    const polTarget = Math.min(100, 100 * emis / (emis + 1.2 * absorb + 1));

    const structures = bl.filter(b => !['road', 'park', 'forest'].includes(b.type));
    const connected = structures.length ? structures.filter(b => b._road).length / structures.length : 0;
    const green = land.length ? (emptyGrass * 0.5 + greenBlocks) / land.length : 0;

    return {
      pop, workforce, jobs, employment: workforce ? Math.min(1, jobs / workforce) : 1, staffRatio, unstaffed,
      food, foodDemand: pop, water: waterIn, waterDemand: waterUse, waterCap,
      gen, eDemand, energyR, cleanShare: gen ? (genClean + 0.7 * genNuke) / gen : 0,
      econ, costs, net: econ - costs, econExtract,
      cap, eduCov, healthCov, foodCap, emis, absorb, polTarget, connected, green, drought,
      landUsed: land.filter(t => t.b).length, landTotal: land.length,
    };
  }

  // ---------- One simulated year ----------
  function step(state, mode) {
    const f = flows(state);
    const pop = state.pop;
    // money
    state.money += f.net;
    state.debt = state.money < 0;
    // water reservoir
    let wAvail = state.water + f.water;
    const waterR = f.waterDemand ? Math.min(1.2, wAvail / f.waterDemand) : 1;
    state.water = Math.max(0, Math.min(f.waterCap, wAvail - f.waterDemand));
    // food with storage
    let foodR;
    if (f.food >= f.foodDemand) {
      foodR = f.foodDemand ? f.food / f.foodDemand : 1;
      state.foodStore = Math.min(f.foodCap, state.foodStore + (f.food - f.foodDemand));
    } else {
      const need = f.foodDemand - f.food;
      const draw = Math.min(need, state.foodStore);
      state.foodStore -= draw;
      foodR = (f.food + draw) / f.foodDemand;
    }
    state.foodStore = Math.min(state.foodStore, f.foodCap);
    // deposits
    Object.values(state.buildings).forEach(b => {
      const d = B[b.type];
      if (d.on && d.on !== 'river' && b._eff > 0) {
        const dep = state.deposits[state.tiles[b.tiles[0]].dep];
        const before = dep.reserve;
        dep.reserve = Math.max(0, dep.reserve - d.use * b._eff);
        if (before > 0 && dep.reserve <= 0) state.log.push({ year: state.year + 1, text: d.name + ' closed: the ' + labelFor(dep.type) + ' deposit ran out.' });
      }
    });
    // pollution
    state.pollution += 0.15 * (f.polTarget - state.pollution);
    // population
    const fr = Math.min(1, foodR), wr = Math.min(1, waterR), er = Math.min(1, f.energyR);
    let birth, death, migrate = 0;
    if (mode === 'fixed') { birth = 0.03; death = 0.01; }
    else {
      const occ = f.cap ? pop / f.cap : 2;
      birth = 0.03 * Math.max(0, Math.min(1, (1 - occ) / 0.1)) * fr * wr * (1 - 0.25 * f.eduCov);
      death = 0.009 - 0.004 * f.healthCov + 0.12 * (1 - fr) + 0.12 * (1 - wr) + 0.005 * (1 - er)
        + 0.00025 * state.pollution * (1 - 0.6 * f.healthCov) + (occ > 1 ? 0.05 * (occ - 1) : 0);
      migrate = 0.04 * Math.max(0, 0.7 - f.employment);
    }
    state.pop = Math.max(0, pop * (1 + birth - death - migrate));
    if (state.pop < 1) state.pop = 0;

    // SDGs for this year
    const s = sdgYear(state, f, foodR, waterR);
    if (!state.sdgSum) state.sdgSum = Object.fromEntries(SDGS.map(x => [x.key, 0]));
    SDGS.forEach(x => state.sdgSum[x.key] += s[x.key]);
    state.sdgYears++;

    state.year++;
    const rec = { year: state.year, pop: Math.round(state.pop), money: Math.round(state.money), pollution: +state.pollution.toFixed(1), food: +foodR.toFixed(2), water: +waterR.toFixed(2), energy: +f.energyR.toFixed(2), drought: f.drought, sdg: +avg(s).toFixed(1) };
    state.history.push(rec);

    // death rules (only once the city is on its own)
    if (mode !== 'fixed') {
      const short = foodR < 0.9 || waterR < 0.9;
      state.streak.short = short ? state.streak.short + 1 : 0;
      state.streak.pol = state.pollution > 75 ? state.streak.pol + 1 : 0;
      if (state.pop < 5) state.dead = { year: state.year, why: 'The population collapsed to zero.' };
      else if (state.streak.short >= 8) state.dead = { year: state.year, why: 'Overpopulated: food and water ran out for 8 years in a row.' };
      else if (state.streak.pol >= 10) state.dead = { year: state.year, why: 'Pollution stayed above the safe limit for 10 years.' };
    }
    return rec;
  }

  function sdgYear(state, f, foodR, waterR) {
    const P = state.pollution;
    const pop = Math.max(1, f.pop);
    return {
      hunger: 100 * Math.min(1, foodR),
      health: 100 * (0.5 * f.healthCov + 0.5 * (1 - P / 100)),
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
  // Live SDG estimate for the planning screen (no time passes)
  function outlook(state) {
    const f = flows(state);
    const foodR = f.foodDemand ? (f.food + state.foodStore) / f.foodDemand : 1;
    const waterR = f.waterDemand ? (f.water + state.water * 0.1) / f.waterDemand : 1;
    const s = sdgYear(state, f, foodR, waterR);
    return { f, s, score: avg(s) };
  }
  function avg(o) { const v = Object.values(o); return v.reduce((a, b) => a + b, 0) / v.length; }

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
  // cap = year limit of the final run. SDG 11 (resilient cities) includes how long the city lasted.
  function result(state, cap) {
    const n = Math.max(1, state.sdgYears);
    const sdg = {};
    SDGS.forEach(x => sdg[x.key] = +(state.sdgSum ? state.sdgSum[x.key] / n : 0).toFixed(1));
    const lasted = Math.min(1, state.year / (cap || 500));
    sdg.cities = +(0.7 * sdg.cities + 30 * lasted).toFixed(1);
    const score = +avg(sdg).toFixed(1);
    return { score, sdg, years: state.year, alive: !state.dead, why: state.dead ? state.dead.why : null, pop: Math.round(state.pop) };
  }

  const api = { outlook, B, SDGS, LEVELS, WORLD, DROUGHTS, DROUGHT_LEN, idx, inLevel, newGame, canPlace, build, demolish, footprint, costOf, flows, step, advance, startLevel, result, isDrought, labelFor };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Eco = api;
})(typeof window !== 'undefined' ? window : globalThis);
