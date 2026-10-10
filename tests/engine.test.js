// Simulation engine tests. Run with: npm test   (Node 18+, no dependencies)
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const E = require('../src/engine.js');

// place up to n buildings of a type, nearest the centre first
function put(s, type, n) {
  const order = s.tiles.map((t, i) => i).sort((a, b) => {
    const A = s.tiles[a], B = s.tiles[b];
    return Math.hypot(A.x - 7, A.y - 7) - Math.hypot(B.x - 7, B.y - 7);
  });
  let k = 0;
  for (const i of order) { if (k >= n) break; if (E.canPlace(s, type, i).ok) { E.build(s, type, i); k++; } }
  return k;
}
function staffFarms(s) { Object.values(s.buildings).forEach(b => { if (b.type === 'foodFarm') b.workers = E.B.foodFarm.max; }); }

// play a whole game: level plans in, result out
function play(seed, L1, L2, L3, cap) {
  const s = E.newGame(seed, 'test');
  L1(s); staffFarms(s);
  E.advance(s, 8, 'fixed');
  E.startLevel(s, 2); L2(s); staffFarms(s);
  E.advance(s, 50, 'dyn');
  if (!s.dead) {
    E.startLevel(s, 3); L3(s); staffFarms(s);
    s.finalStart = s.year;
    while (!s.dead && s.year < cap) E.step(s, 'dyn');
  }
  return { s, r: E.result(s, cap) };
}
const GOOD = [
  s => { put(s, 'foodFarm', 4); put(s, 'coalPlant', 1); put(s, 'goldFactory', 1); put(s, 'mineralMine', 1); put(s, 'cashFarm', 1); },
  s => { put(s, 'solar', 3); put(s, 'dam', 1); put(s, 'apartment', 1); put(s, 'community', 2); put(s, 'school', 1); put(s, 'waterPlant', 1); put(s, 'foodFarm', 3); put(s, 'road', 6); },
  s => { put(s, 'battery', 1); put(s, 'granary', 2); put(s, 'hospital', 1); put(s, 'itPark', 1); put(s, 'forest', 8); put(s, 'foodFarm', 2); put(s, 'wind', 2); put(s, 'recycling', 1); put(s, 'waterPlant', 1); },
];
const BAD = [
  s => { put(s, 'coalPlant', 2); put(s, 'goldFactory', 2); put(s, 'mineralMine', 3); put(s, 'foodFarm', 2); },
  s => { put(s, 'apartment', 4); put(s, 'house', 5); },
  s => { put(s, 'apartment', 3); },
];

test('new game: 15x15 world, 100 people, starting village, level 1 is 10x10', () => {
  const s = E.newGame(42, 'Team');
  assert.strictEqual(s.tiles.length, 225);
  assert.strictEqual(s.pop, 100);
  assert.strictEqual(s.level, 1);
  assert.strictEqual(E.LEVELS[1].size, 10);
  assert.strictEqual(E.LEVELS[2].size, 12);
  assert.strictEqual(E.LEVELS[3].size, 15);
  const huts = Object.values(s.buildings).filter(b => b.type === 'hut').length;
  assert.strictEqual(huts, 6);
});

test('every map has the same resources, in random places', () => {
  const count = s => { const c = {}; Object.values(s.deposits).forEach(d => { c[d.type] = (c[d.type] || 0) + 1; }); return c; };
  const a = E.newGame(1), b = E.newGame(99999);
  assert.deepStrictEqual(count(a), count(b));
  const pos = s => Object.values(s.deposits).map(d => d.tiles.join(',')).sort().join('|');
  assert.notStrictEqual(pos(a), pos(b));
});

test('same seed gives the same map', () => {
  const a = E.newGame(777), b = E.newGame(777);
  assert.deepStrictEqual(a.tiles.map(t => t.t), b.tiles.map(t => t.t));
});

test('factories can only be built on their own deposit', () => {
  const s = E.newGame(5);
  const grass = s.tiles.findIndex(t => t.t === 'grass' && !t.b && E.inLevel(1, t.x, t.y));
  assert.strictEqual(E.canPlace(s, 'goldFactory', grass).ok, false);
  assert.strictEqual(E.canPlace(s, 'coalPlant', grass).ok, false);
  const coal = s.tiles.findIndex(t => t.t === 'coal' && E.inLevel(1, t.x, t.y));
  if (coal >= 0) {
    assert.strictEqual(E.canPlace(s, 'goldFactory', coal).ok, false);
    const r = E.canPlace(s, 'coalPlant', coal);
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.fp.length, 3, 'coal factory covers the whole 3-block deposit');
  }
  const ur = s.tiles.findIndex(t => t.t === 'uranium' && E.inLevel(1, t.x, t.y));
  if (ur >= 0) assert.strictEqual(E.canPlace(s, 'nuclear', ur).fp.length, 4, 'nuclear plant covers the 4-block uranium deposit');
});

test('level 1 is free; later levels cost money; locked buildings refuse', () => {
  const s = E.newGame(8);
  const g = s.tiles.findIndex(t => t.t === 'grass' && !t.b && E.inLevel(1, t.x, t.y));
  assert.strictEqual(E.canPlace(s, 'foodFarm', g).cost, 0);
  assert.strictEqual(E.canPlace(s, 'apartment', g).ok, false, 'apartments unlock in level 2');
  E.startLevel(s, 2);
  s.money = 0;
  assert.strictEqual(E.canPlace(s, 'apartment', g).ok, false, 'no money, no apartment');
  s.money = 1000;
  assert.strictEqual(E.canPlace(s, 'apartment', g).ok, true);
});

test('cannot build outside the current land', () => {
  const s = E.newGame(3);
  const outside = s.tiles.findIndex(t => t.t === 'grass' && !E.inLevel(1, t.x, t.y));
  assert.strictEqual(E.canPlace(s, 'foodFarm', outside).ok, false);
});

test('a well-planned city survives to the cap and outscores an unsustainable one', () => {
  const good = play(12345 + 4, ...GOOD, 500);
  const bad = play(12345 + 3, ...BAD, 500);
  assert.strictEqual(good.r.alive, true, 'good city should still be alive: ' + good.r.why);
  assert.strictEqual(good.r.years, 500);
  assert.strictEqual(bad.r.alive, false, 'bad city should die');
  assert.ok(good.r.score > bad.r.score + 10, 'good ' + good.r.score + ' vs bad ' + bad.r.score);
});

test('result has 11 SDG scores between 0 and 100', () => {
  const { r } = play(2024, ...GOOD, 200);
  assert.strictEqual(Object.keys(r.sdg).length, 11);
  for (const v of Object.values(r.sdg)) assert.ok(v >= 0 && v <= 100, 'sdg out of range: ' + v);
  assert.ok(r.score >= 0 && r.score <= 100);
});

test('deposits run out', () => {
  const s = E.newGame(12349);
  put(s, 'foodFarm', 4); put(s, 'coalPlant', 1); staffFarms(s);
  const coal = Object.values(s.deposits).find(d => d.type === 'coal' && s.tiles[d.tiles[0]].b);
  assert.ok(coal, 'a coal factory was built');
  E.advance(s, 120, 'fixed');
  assert.strictEqual(coal.reserve, 0);
});
