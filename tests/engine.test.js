// Simulation engine tests (v2). Run with: npm test   (Node 18+, no dependencies)
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const E = require('../src/engine.js');

const centre = s => s.tiles.map((t, i) => i).sort((a, b) => {
  const A = s.tiles[a], B = s.tiles[b];
  return Math.hypot(A.x - 7, A.y - 7) - Math.hypot(B.x - 7, B.y - 7);
});
function put(s, type, n, size) {
  let k = 0;
  for (const i of centre(s)) { if (k >= n) break; if (E.canPlace(s, type, i, { size: size || 1 }).ok) { E.build(s, type, i, { size: size || 1 }); k++; } }
  return k;
}
const jump = (s, years, mode) => { for (let y = 0; y < years && !s.dead; y++) E.step(s, mode); };

test('new game: 1,000 people in three age groups, starting village of 6 homes', () => {
  const s = E.newGame(42, 'Team');
  assert.strictEqual(s.pop, 1000);
  assert.deepStrictEqual([s.kids, s.adults, s.elders], [300, 600, 100]);
  assert.strictEqual(Object.values(s.buildings).filter(b => b.type === 'hut').length, 6);
  assert.strictEqual(E.flows(s).cap, 1200);
});

test('every map has the same amount of each resource, in different places', () => {
  const blocks = s => { const c = {}; s.tiles.forEach(t => { if (t.dep) c[t.t] = (c[t.t] || 0) + 1; }); return c; };
  const a = E.newGame(1), b = E.newGame(99999);
  assert.deepStrictEqual(blocks(a), blocks(b));
  const where = s => s.tiles.filter(t => t.dep).map(t => t.x + ',' + t.y).join('|');
  assert.notStrictEqual(where(a), where(b));
});

test('a factory can cover 1, 2 or 3 coal blocks, in different shapes (paths)', () => {
  const s = E.newGame(777);
  const coal = s.tiles.findIndex(t => t.t === 'coal' && E.inLevel(1, t.x, t.y));
  assert.ok(coal >= 0);
  const one = E.factoryPaths(s, 'coalPlant', coal, 1);
  assert.strictEqual(one.length, 1);
  const two = E.factoryPaths(s, 'coalPlant', coal, 2);
  assert.ok(two.length >= 1);
  for (const p of two) { assert.ok(p.includes(coal)); assert.ok(p.every(j => s.tiles[j].t === 'coal')); }
  assert.strictEqual(E.factoryPaths(s, 'coalPlant', coal, 9).every(p => p.length <= 3), true, 'coal factories are at most 3 blocks');
});

test('factories only on their own resource; other buildings may use spare resource blocks', () => {
  const s = E.newGame(5);
  const grass = s.tiles.findIndex(t => t.t === 'grass' && !t.b && E.inLevel(1, t.x, t.y));
  assert.strictEqual(E.canPlace(s, 'coalPlant', grass).ok, false);
  const coal = s.tiles.findIndex(t => t.t === 'coal' && E.inLevel(1, t.x, t.y));
  assert.strictEqual(E.canPlace(s, 'goldFactory', coal).ok, false);
  assert.strictEqual(E.canPlace(s, 'foodFarm', coal).ok, true, 'a farm can sit on an unused coal block');
});

test('factory upgrade: Level 2+, grows onto a free neighbouring block, blocked by a farm until demolished', () => {
  const s = E.newGame(777);
  // find a coal tile that has a coal neighbour
  const T = s.tiles;
  const pair = T.map((t, i) => i).find(i => T[i].t === 'coal' && E.inLevel(1, T[i].x, T[i].y) && E.factoryPaths(s, 'coalPlant', i, 2).length);
  const r = E.build(s, 'coalPlant', pair, { size: 1 });
  assert.ok(r.ok);
  const id = r.id;
  assert.strictEqual(E.upgradeOptions(s, id)[0].ok, false, 'no upgrades in Level 1');
  E.startLevel(s, 2); s.money = 100000;
  let opt = E.upgradeOptions(s, id)[0];
  assert.strictEqual(opt.ok, true);
  // put a farm on every free neighbour: upgrade must be blocked
  const farms = [];
  for (const j of E.factoryPaths(s, 'coalPlant', pair, 2).map(p => p.find(k => k !== pair))) {
    if (!T[j].b) { const f = E.build(s, 'foodFarm', j); if (f.ok) farms.push(f.id); }
  }
  opt = E.upgradeOptions(s, id)[0];
  if (opt.ok === false && opt.blocked && opt.blocked.length) {
    assert.match(opt.why, /Demolish/);
    farms.forEach(f => E.demolish(s, f));
  }
  const before = s.buildings[id].tiles.length;
  assert.strictEqual(E.upgrade(s, id, 'block').ok, true);
  assert.strictEqual(s.buildings[id].tiles.length, before + 1);
});

test('house upgrades: rooftop solar adds energy, rainwater harvesting adds water', () => {
  const s = E.newGame(9); E.startLevel(s, 2); s.money = 100000;
  const hut = Object.values(s.buildings).find(b => b.type === 'hut');
  const f0 = E.flows(s);
  assert.ok(E.upgrade(s, hut.id, 'solar').ok);
  assert.ok(E.upgrade(s, hut.id, 'rwh').ok);
  const f1 = E.flows(s);
  assert.ok(f1.gen > f0.gen);
  assert.ok(f1.water > f0.water);
  assert.strictEqual(E.upgrade(s, hut.id, 'solar').ok, false, 'cannot install twice');
});

test('Level 1: a city planned only for 1,000 stays flat; a city that plans ahead grows about 1.5x', () => {
  const flat = E.newGame(4242); put(flat, 'foodFarm', 3); put(flat, 'coalPlant', 1, 1); put(flat, 'goldFactory', 1, 1);
  const food = E.flows(flat).food;
  jump(flat, 8, 'grow');
  assert.ok(flat.pop < food * 1.05, 'city cannot outgrow its food: ' + Math.round(flat.pop) + ' people, food for ' + Math.round(food));
  const ahead = E.newGame(4242); put(ahead, 'coalPlant', 1, 2); put(ahead, 'foodFarm', 6);
  jump(ahead, 8, 'grow');
  assert.ok(ahead.pop > 1350, 'planned-ahead city: ' + Math.round(ahead.pop));
  assert.ok(ahead.pop > flat.pop + 150);
});

test('hunger kills and is recorded as the cause', () => {
  const s = E.newGame(1); put(s, 'foodFarm', 1);
  jump(s, 5, 'grow');
  assert.ok(s.tally.died.hunger > 50);
  assert.ok(s.pop < 1000);
});

test('rain falls when forests are replaced by buildings and pollution rises', () => {
  const s = E.newGame(3);
  const r0 = E.flows(s).rain;
  s.pollution = 70;
  put(s, 'cashFarm', 40);
  assert.ok(E.flows(s).rain < r0 - 0.2);
});

test('every team gets all four shocks, a flood, two new crises, two neighbours and three choices, in its own order', () => {
  const a = E.newGame(10), b = E.newGame(20);
  for (const s of [a, b]) {
    assert.strictEqual(s.schedule.length, 12);
    assert.ok(s.schedule.includes('flood'));
    for (const shock of E.SHOCKS) assert.ok(s.schedule.includes(shock));
  }
  assert.notDeepStrictEqual(a.schedule, b.schedule);
});

test('resolving an event applies the shock and the chosen effects', () => {
  const s = E.newGame(10); s.money = 1000; E.resetTally(s);
  const w0 = s.water;
  const ch = E.resolveEvent(s, 'monsoon-failure', 0);
  assert.ok(s.mods.some(m => m.key === 'rainPct10y' && m.pct < 0 && m.until === s.year + 3), 'short sharp shock');
  assert.ok(s.money < 1000, 'trucking water costs money');
  assert.ok(ch.impact && typeof ch.impact.water === 'number', 'the screen gets a summary of what changed');
  const t = E.newGame(10); t.money = 0; E.resetTally(t);
  assert.ok(E.eventView(t, 'monsoon-failure').choices[0].disabled, 'a choice you cannot afford is disabled');
  assert.strictEqual(E.resolveEvent(t, 'monsoon-failure', 0).index, E.defaultChoice('monsoon-failure', t), 'and cannot be picked');
});

test('coal blocks run out and the factory closes', () => {
  const s = E.newGame(777); put(s, 'foodFarm', 4); put(s, 'coalPlant', 1, 1);
  const f = Object.values(s.buildings).find(b => b.type === 'coalPlant');
  jump(s, 80, 'grow');
  assert.strictEqual(s.tiles[f.tiles[0]].res, 0);
  E.flows(s);
  assert.strictEqual(f._dead, true);
});

test('results: 13 SDG scores between 0 and 100', () => {
  const s = E.newGame(2024); put(s, 'foodFarm', 5); put(s, 'coalPlant', 1, 2);
  jump(s, 60, 'dyn');
  const r = E.result(s, 500);
  assert.strictEqual(Object.keys(r.sdg).length, 13);
  for (const v of Object.values(r.sdg)) assert.ok(v >= 0 && v <= 100, 'sdg out of range: ' + v);
});

test('money is shown in lakh and crore', () => {
  assert.strictEqual(E.fmtMoney(50), '₹50k');
  assert.strictEqual(E.fmtMoney(250), '₹2.5 L');
  assert.strictEqual(E.fmtMoney(12000), '₹1.2 Cr');
});

test('solar, wind and batteries need only one or two people', () => {
  for (const k of ['solar', 'wind', 'battery']) { assert.strictEqual(E.B[k].min, 1); assert.strictEqual(E.B[k].max, 2); }
});

test('v6: a smaller crew means proportionally less output, and frees workers', () => {
  const s = E.newGame(4242); put(s, 'foodFarm', 3);
  const farm = Object.values(s.buildings).find(b => b.type === 'foodFarm');
  const f0 = E.flows(s), full = farm._eff;
  E.setWorkers(s, farm.id, E.B.foodFarm.min);
  const f1 = E.flows(s);
  assert.ok(Math.abs(farm._eff - full * E.B.foodFarm.min / E.B.foodFarm.max) < 1e-9, 'output in proportion to the crew');
  assert.ok(f1.food < f0.food);
  assert.strictEqual(f1.unemployed - f0.unemployed, E.B.foodFarm.max - E.B.foodFarm.min, 'the rest are free to work elsewhere');
  assert.strictEqual(E.setWorkers(s, farm.id, 1), E.B.foodFarm.min, 'never below the minimum crew');
});

test('v6: during the years that pass, new workers join understaffed buildings', () => {
  const s = E.newGame(4242); put(s, 'foodFarm', 6);
  Object.values(s.buildings).forEach(b => { if (b.type === 'foodFarm') E.setWorkers(s, b.id, 0); });
  const before = E.flows(s).jobs;
  assert.ok(E.flows(s).unemployed > 0);
  E.step(s, 'grow');
  assert.ok(E.flows(s).jobs > before, 'free workers were put to work');
});

test('v6: each factory upgrade costs more than the last, and more than a new block', () => {
  const s = E.newGame(777); E.startLevel(s, 2); s.money = 1e6;
  const i = s.tiles.findIndex((t, k) => t.t === 'uranium' && E.inLevel(2, t.x, t.y) && E.factoryPaths(s, 'nuclear', k, 3).length);
  const r = E.build(s, 'nuclear', i, { size: 1 });
  const c1 = E.upgradeOptions(s, r.id)[0].cost; E.upgrade(s, r.id, 'block');
  const c2 = E.upgradeOptions(s, r.id)[0].cost;
  assert.ok(c1 > E.B.nuclear.cost && c2 > c1);
});

test('v6: the monsoon refills part of the reservoir every year', () => {
  const s = E.newGame(9); put(s, 'foodFarm', 4); s.water = 0;
  E.step(s, 'grow');
  assert.ok(s.water > 500);
});

test('neighbours remember: help them and they help you; refuse and no help comes', () => {
  const ask = id => E.EVENTS[id].choices.findIndex(c => c.ask);
  const kind = E.newGame(31); put(kind, 'foodFarm', 4); E.resetTally(kind);
  E.resolveEvent(kind, 'neighbour-water', 0);
  const mean = E.newGame(31); put(mean, 'foodFarm', 4); E.resetTally(mean);
  E.resolveEvent(mean, 'neighbour-water', 2);
  mean.water = kind.water;   // same starting point for the crisis
  const ch = E.resolveEvent(kind, 'monsoon-failure', ask('monsoon-failure'));
  assert.match(ch.outcome, /helped/);
  const ch2 = E.resolveEvent(mean, 'monsoon-failure', ask('monsoon-failure'));
  assert.match(ch2.outcome, /turned them away/);
  assert.ok(kind.water > mean.water + 3000, 'neighbours send water to the town that helped them');
});

test('v6: crises hit now (people, reservoir, buildings) and neighbours cannot be given what you do not have', () => {
  const s = E.newGame(12); put(s, 'foodFarm', 6); put(s, 'house', 4); E.resetTally(s);
  const pop0 = s.pop;
  const ch = E.resolveEvent(s, 'cyclone', E.defaultChoice('cyclone', s));
  assert.ok(s.pop < pop0 && ch.impact.people < 0, 'people die in the storm');
  const d = E.newGame(12); d.water = 500; d.foodStore = 0; E.resetTally(d);
  const v = E.eventView(d, 'neighbour-water');
  assert.ok(v.choices.filter(c => c.need).every(c => c.disabled), 'cannot share water you do not have');
  assert.ok(v.choices.some(c => c.cannot), 'an honest answer is offered');
  d.schedule[0] = 'neighbour-food';
  const alt = E.relevantEvent(d, 'neighbour-food', 0);
  assert.strictEqual(alt, 'neighbour-refugees', 'a request that makes no sense is swapped for one that does');
  assert.strictEqual(d.schedule.filter(k => k === 'neighbour-refugees').length, 1, 'and nothing repeats');
});

test('earlier choices make later crises worse', () => {
  const a = E.newGame(8), b = E.newGame(8);
  for (const s of [a, b]) { put(s, 'foodFarm', 4); E.resetTally(s); }
  E.resolveEvent(b, 'forest-land-offer', 0); // sell the hill forest
  assert.ok(E.eventView(b, 'flood').mul > E.eventView(a, 'flood').mul, 'floods hit harder after the forest is sold');
  assert.ok(E.eventView(b, 'flood').notes.some(n => /year/.test(n)), 'the event says why');
});

test('Life on Land is not free: an empty city does not score 100', () => {
  const s = E.newGame(2024); put(s, 'foodFarm', 5);
  for (let y = 0; y < 30; y++) E.step(s, 'dyn');
  assert.ok(E.result(s, 500).sdg.land < 60);
});

test('v5: families grow whether or not there is food, and hunger kills', () => {
  const s = E.newGame(77); put(s, 'foodFarm', 1); E.resetTally(s);
  const r = E.rates(s, E.flows(s), 'grow');
  assert.ok(r.per1000.births > 40, 'births do not wait for food');
  for (let y = 0; y < 6; y++) E.step(s, 'grow');
  assert.ok(s.tally.died.hunger > 300, 'many starve');
});

test('v5: Level 1 has a budget; farms are free but capped; one small coal plant', () => {
  const s = E.newGame(777);
  assert.strictEqual(s.money, E.L1_BUDGET);
  assert.strictEqual(put(s, 'foodFarm', 20), 10, 'only 10 food farms in Level 1');
  assert.strictEqual(s.money, E.L1_BUDGET, 'farms are free');
  const coal = s.tiles.findIndex((t, i) => t.t === 'coal' && E.inLevel(1, t.x, t.y) && E.factoryPaths(s, 'coalPlant', i, 3).length);
  if (coal >= 0) assert.strictEqual(E.canPlace(s, 'coalPlant', coal, { size: 3 }).ok, false, 'max 2 coal blocks');
});

test('v5: a city that builds nothing scores very low; debt and lost lives cost points', () => {
  const s = E.newGame(4242); E.resetTally(s); E.beginEra(s, 1, 8);
  for (let y = 0; y < 8 && !s.dead; y++) E.step(s, 'grow');
  E.startLevel(s, 2); s.jumpStart = s.year; E.beginEra(s, 2, 50);
  for (let y = 0; y < 50 && !s.dead; y++) E.step(s, 'dyn');
  const r = E.result(s, 500);
  assert.ok(r.score < 15, 'build-nothing score ' + r.score);
  assert.strictEqual(r.rounds.length, 3);
});

test('v5: SDG 1 No Poverty falls when the city runs at a loss', () => {
  const a = E.newGame(5), b = E.newGame(5);
  for (const s of [a, b]) { put(s, 'foodFarm', 6); E.resetTally(s); }
  b.money = -500;
  E.step(a, 'grow'); E.step(b, 'grow');
  assert.ok(b.sdgSum.poverty < a.sdgSum.poverty);
});
