(function () {
'use strict';
const E = window.Eco, B = E.B, W = E.WORLD;
const $ = id => document.getElementById(id);
const fmt = n => Math.round(n).toLocaleString('en-IN');
const money = n => (n < 0 ? '−₹' : '₹') + fmt(Math.abs(n)) + 'k';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* =========================================================
   Settings + shared results (db capability, local fallback)
   ========================================================= */
const DEFAULTS = { t1: 25, t2: 8, t3: 10, jump: 8, cap: 500, pin: '2026' };
let settings = Object.assign({}, DEFAULTS);
let db = null, dbReady = false;
const LS = {
  get(k, d) { try { const v = localStorage.getItem('ecocity.' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('ecocity.' + k, JSON.stringify(v)); } catch (e) {} },
  del(k) { try { localStorage.removeItem('ecocity.' + k); } catch (e) {} },
};
Object.assign(settings, LS.get('settings', {}));

async function initDb() {
  try {
    if (!window.claude || !window.claude.use) throw 0;
    db = await window.claude.use('db');
  } catch (e) { db = null; }
  dbReady = true;
  if (db) {
    try {
      const snap = await db.doc('config/settings').get();
      if (snap.exists) { Object.assign(settings, snap.data()); LS.set('settings', settings); }
    } catch (e) {}
    // flush any results saved offline earlier
    const pending = LS.get('pending', []);
    if (pending.length) {
      const left = [];
      for (const r of pending) { try { await db.collection('results').doc(r.id).set(r); } catch (e) { left.push(r); } }
      LS.set('pending', left);
    }
  }
  applySettingsText();
  updateDbStatus();
}
async function saveResult(rec) {
  const all = LS.get('results', []); all.push(rec); LS.set('results', all);
  if (db) {
    try { await db.collection('results').doc(rec.id).set(rec); return 'shared'; }
    catch (e) { const p = LS.get('pending', []); p.push(rec); LS.set('pending', p); return 'pending'; }
  }
  const p = LS.get('pending', []); p.push(rec); LS.set('pending', p);
  return 'local';
}

/* =========================================================
   Game state
   ========================================================= */
let S = null;               // engine state
let ui = { tool: null, sel: null, hover: -1, tab: 'agri' };

function persist() { if (S && !S.over) LS.set('game', { S, settingsUsed: S.cfg }); }
function levelMinutes(l) { return +(l === 1 ? S.cfg.t1 : l === 2 ? S.cfg.t2 : S.cfg.t3); }

function newGame(team) {
  const seed = (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0;
  S = E.newGame(seed, team);
  S.cfg = { t1: settings.t1, t2: settings.t2, t3: settings.t3, jump: settings.jump, cap: settings.cap };
  S.deadline = Date.now() + levelMinutes(1) * 60000;
  S.startedAt = new Date().toISOString();
  ui.tool = null; ui.sel = null;
  if (has3D) { R3.orbit(false); R3.load(S); R3.grid(false); R3.select(null); }
  setView('plan');
  persist();
  refresh(true);
  if (has3D) { R3.envNow(); layoutInsets(); R3.setLevel(1, false); }
}

/* =========================================================
   3D view glue
   ========================================================= */
const cv = $('map');
const has3D = window.R3 && R3.init(cv, $('tags'));
let viewMode = 'start';
function layoutInsets() {
  if (!has3D) return;
  const app = $('app').getBoundingClientRect(), vis = el => el && !el.hidden && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().width > 0;
  const top = $('top').getBoundingClientRect();
  let l = 0, r = 0, t = top.bottom - app.top, b = 0;
  if (viewMode === 'start') { const sh = $('startSheet').getBoundingClientRect(); l = sh.right - app.left; t = 0; }
  else if (viewMode === 'sim') { const sp = $('simSheet').getBoundingClientRect(); b = app.bottom - sp.top; }
  else {
    if (vis($('stats'))) l = $('stats').getBoundingClientRect().right - app.left;
    if (vis($('right'))) r = app.right - $('right').getBoundingClientRect().left;
    b = app.bottom - $('build').getBoundingClientRect().top;
  }
  R3.setInsets({ l, r, t, b });
}
function centerCam(instant) { if (!has3D || !S) return; layoutInsets(); R3.setLevel(S.level, instant); }
function setView(mode) { viewMode = mode; $('app').dataset.view = mode; requestAnimationFrame(() => { layoutInsets(); if (has3D && S && (mode === 'plan' || mode === 'sim')) { R3.setLevel(S.level, false); if (mode === 'sim') R3.zoom(0.8); } }); }
// a ready-made city that slowly turns behind the start screen
let demo = null;
function demoState() {
  const d = E.newGame(20261009, 'demo');
  d.level = 3; d.money = 1e9; d.water = 6000; d.pop = 4000; d.pollution = 6;
  const put = (type, x, y) => { const i = E.idx(x, y); if (E.canPlace(d, type, i).ok) { E.build(d, type, i); return true; } return false; };
  for (let x = 0; x < W; x++) { put('road', x, 5); put('road', x, 10); }
  for (let y = 0; y < W; y++) { put('road', 4, y); put('road', 10, y); }
  const near = [];
  d.tiles.forEach((t, i) => { if (t.t === 'grass' && !t.b) { const adj = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => { const n = d.tiles[E.idx(Math.min(W - 1, Math.max(0, t.x + a)), Math.min(W - 1, Math.max(0, t.y + b)))]; return n.b && d.buildings[n.b].type === 'road'; }); near.push({ i, s: (adj ? 0 : 20) + Math.hypot(t.x - 7, t.y - 7) }); } });
  near.sort((a, b) => a.s - b.s);
  const plan = ['apartment', 'apartment', 'hospital', 'school', 'community', 'itPark', 'apartment', 'community', 'house', 'park', 'granary', 'waterPlant', 'community', 'house', 'recycling', 'park', 'house', 'battery', 'solar', 'solar', 'solar', 'wind', 'wind', 'wind', 'wind', 'foodFarm', 'foodFarm', 'foodFarm', 'foodFarm', 'cashFarm', 'foodFarm', 'forest', 'forest', 'forest', 'park', 'forest'];
  let k = 0;
  for (const type of plan) { while (k < near.length && !E.canPlace(d, type, near[k].i).ok) k++; if (k < near.length) { E.build(d, type, near[k].i); k++; } }
  ['coalPlant', 'goldFactory', 'nuclear', 'mineralMine'].forEach(type => { for (let i = 0; i < d.tiles.length; i++) if (E.canPlace(d, type, i).ok) { E.build(d, type, i); break; } });
  d.tiles.forEach((t, i) => { if (t.t === 'river' && !t.b && t.y === 7) E.build(d, 'dam', i); });
  Object.values(d.buildings).forEach(b => { if (B[b.type].max) b.workers = B[b.type].max; });
  d._f = E.flows(d);
  return d;
}
function showDemo() {
  if (!has3D) return;
  if (!demo) demo = demoState();
  R3.load(demo); R3.sync(demo, demo._f, false); R3.envNow();
  setView('start');
  requestAnimationFrame(() => { layoutInsets(); R3.setLevel(3, true); R3.orbit(true); });
}

/* =========================================================
   Minimap
   ========================================================= */
const MM_COL = { housing: '#e5534b', agri: '#e9c046', industry: '#8f98a3', energy: '#45c7e0', infra: '#44505a', services: '#c38cf0', green: '#2d8a3e', water: '#2f8fd0', empty: '#a9d68e', res: '#5b4a3a' };
function catColor(bd) { const d = B[bd.type]; if (d.green) return MM_COL.green; if (bd.type === 'road') return MM_COL.infra; return MM_COL[d.cat] || MM_COL.infra; }
function renderMinimap() {
  const m = $('minimap'), g = m.getContext('2d'), s = m.width / W;
  g.fillStyle = '#0b1a24'; g.fillRect(0, 0, m.width, m.height);
  S.tiles.forEach(t => {
    const locked = !E.inLevel(S.level, t.x, t.y);
    let col = t.b ? catColor(S.buildings[t.b]) : t.t === 'river' ? MM_COL.water : t.t === 'grass' ? MM_COL.empty : MM_COL.res;
    g.globalAlpha = locked ? .25 : 1; g.fillStyle = col; g.fillRect(t.x * s + .5, t.y * s + .5, s - 1, s - 1);
  });
  g.globalAlpha = 1;
}
function buildLegend() {
  const items = [['Housing', 'housing'], ['Farms', 'agri'], ['Industry', 'industry'], ['Energy', 'energy'], ['Services', 'services'], ['Green', 'green'], ['Water', 'water'], ['Road', 'infra'], ['Deposit', 'res'], ['Empty', 'empty']];
  $('legend').innerHTML = items.map(([n, k]) => '<span><i style="background:' + MM_COL[k] + '"></i>' + n + '</span>').join('');
}

/* =========================================================
   Panels
   ========================================================= */
const ICON = {
  pop: '<svg viewBox="0 0 24 24" width="20" fill="#7cc7ff"><circle cx="9" cy="8" r="3.5"/><circle cx="17" cy="9" r="2.6" opacity=".75"/><path d="M2.5 20c.6-4 3.2-6 6.5-6s5.9 2 6.5 6z"/><path d="M14.5 14.6c2.8-.3 5.6 1.2 6.5 5.4h-4.3" opacity=".75"/></svg>',
  food: '<svg viewBox="0 0 24 24" width="20" fill="#62d36c"><path d="M20 3C10 3 4 9 4 17c0 1 .1 2 .3 3C6 13 11 9 17 7c-5 3-9 7-11 13h2c3-7 12-8 12-17z"/></svg>',
  water: '<svg viewBox="0 0 24 24" width="20" fill="#3fb5f2"><path d="M12 2s7 8 7 13a7 7 0 0 1-14 0c0-5 7-13 7-13z"/></svg>',
  energy: '<svg viewBox="0 0 24 24" width="20" fill="#ffd23f"><path d="M13 2L4 14h7l-1 8 9-12h-7z"/></svg>',
  jobs: '<svg viewBox="0 0 24 24" width="20" fill="#b48cf2"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" fill="none" stroke="#b48cf2" stroke-width="2"/></svg>',
  money: '<svg viewBox="0 0 24 24" width="20"><circle cx="12" cy="12" r="10" fill="#f5c544"/><text x="12" y="16.5" text-anchor="middle" font-size="13" font-weight="700" fill="#6b4b00">₹</text></svg>',
  land: '<svg viewBox="0 0 24 24" width="20" fill="#7fbf5a"><path d="M2 20l7-11 4 6 3-4 6 9z"/></svg>',
  green: '<svg viewBox="0 0 24 24" width="20" fill="#3aaf57"><path d="M12 2l6 9h-3l5 7H4l5-7H6z"/><rect x="11" y="18" width="2" height="4" fill="#7a5530"/></svg>',
  pol: '<svg viewBox="0 0 24 24" width="20" fill="#9aa3ad"><path d="M6 19a4 4 0 0 1-.6-8A6 6 0 0 1 17 9a4.5 4.5 0 0 1 1 9z"/></svg>',
  sdg: '<svg viewBox="0 0 24 24" width="20"><circle cx="12" cy="12" r="9" fill="none" stroke="#62d36c" stroke-width="3" stroke-dasharray="4 2"/></svg>',
};
function statRow(icon, k, v, pct, color, cls, note) {
  return '<div class="stat ' + (cls || '') + '"><div class="ic">' + ICON[icon] + '</div><div class="k">' + k + '</div><div class="v num">' + v + '</div>' +
    (pct != null ? '<div class="bar"><i style="width:' + clamp(pct, 0, 100) + '%;background:' + color + '"></i></div>' : '') + (note ? '<div class="note">' + note + '</div>' : '') + '</div>';
}
function renderStats() {
  const o = E.outlook(S), f = o.f; ui.flows = f; ui.outlook = o;
  const h = [];
  h.push(statRow('pop', 'Population', fmt(f.pop) + ' / ' + fmt(f.cap), f.cap ? 100 * f.pop / f.cap : 100, '#7cc7ff', f.pop > f.cap ? 'warn' : '', 'People / housing capacity'));
  h.push(statRow('food', 'Food', fmt(f.food) + ' / ' + fmt(f.foodDemand), 100 * f.food / Math.max(1, f.foodDemand), '#62d36c', f.food < f.foodDemand ? 'bad' : '', 'Grown per year / eaten' + (f.foodCap ? ' · stored ' + fmt(S.foodStore) + '/' + fmt(f.foodCap) : '')));
  h.push('<div class="stat ' + (f.water < f.waterDemand ? 'bad' : '') + '"><div class="ic">' + ICON.water + '</div><div class="k">Water</div><div class="v num">' + fmt(f.water) + ' / ' + fmt(f.waterDemand) + '</div><div class="bar"><i style="width:' + clamp(100 * f.water / Math.max(1, f.waterDemand), 0, 100) + '%;background:#3fb5f2"></i></div><div class="tank"><div class="box"><i style="height:' + clamp(100 * S.water / f.waterCap, 0, 100) + '%"></i></div>Reservoir ' + fmt(S.water) + ' / ' + fmt(f.waterCap) + '</div></div>');
  h.push(statRow('energy', 'Energy', fmt(f.gen) + ' / ' + fmt(f.eDemand), 100 * f.gen / Math.max(1, f.eDemand), '#ffd23f', f.gen < f.eDemand ? 'bad' : '', Math.round(f.cleanShare * 100) + '% clean' + (f.gen < f.eDemand ? ' · buildings run slower' : '')));
  h.push(statRow('jobs', 'Jobs', fmt(f.jobs) + ' / ' + fmt(f.workforce), 100 * f.jobs / Math.max(1, f.workforce), '#b48cf2', f.unstaffed ? 'bad' : f.employment < .7 ? 'warn' : '', f.unstaffed ? f.unstaffed + ' building' + (f.unstaffed > 1 ? 's' : '') + ' closed: not enough workers' : 'Workers employed / workforce'));
  if (S.level === 1) h.push(statRow('money', 'Earnings', (f.net >= 0 ? '+' : '') + money(f.net) + '/yr', null, null, f.net < 0 ? 'bad' : '', 'Building is free now. Earnings are saved for Level 2 (≈ ' + money(Math.max(0, f.net) * S.cfg.jump) + ').'));
  else h.push(statRow('money', 'Budget', money(S.money), null, null, S.money < 0 ? 'bad' : '', (f.net >= 0 ? '+' : '') + money(f.net) + ' per year after upkeep'));
  h.push(statRow('land', 'Land used', f.landUsed + ' / ' + f.landTotal + ' blocks', 100 * f.landUsed / f.landTotal, '#7fbf5a'));
  h.push(statRow('green', 'Green cover', Math.round(f.green * 100) + '%', f.green / .3 * 100, '#3aaf57', f.green < .2 ? 'warn' : ''));
  const polNow = S.pollution, trend = f.polTarget > polNow + 1 ? ' ↑ heading to ' + Math.round(f.polTarget) + '%' : f.polTarget < polNow - 1 ? ' ↓ heading to ' + Math.round(f.polTarget) + '%' : ' steady';
  h.push(statRow('pol', 'Pollution', Math.round(polNow) + '%', polNow, polNow > 60 ? '#ef5b4c' : '#9aa3ad', polNow > 60 || f.polTarget > 75 ? 'bad' : f.polTarget > 50 ? 'warn' : '', 'Safe limit 75%' + trend));
  h.push(statRow('sdg', 'SDG outlook', Math.round(o.score) + ' / 100', o.score, '#62d36c', o.score < 50 ? 'warn' : '', 'If the city stayed like this'));
  $('statList').innerHTML = h.join('');
}

function objectives() {
  const f = ui.flows, bl = Object.values(S.buildings), has = t => bl.some(b => b.type === t);
  if (S.level === 1) return [
    ['Grow enough food for everyone', f.food >= f.foodDemand],
    ['Use less water than the river gives', f.water >= f.waterDemand],
    ['Power the city', f.gen >= f.eDemand],
    ['Give jobs to 70% of workers', f.employment >= .7 && !f.unstaffed],
    ['Earn money for Level 2', f.net > 40],
  ];
  if (S.level === 2) return [
    ['Homes for everyone, with room to grow', f.cap >= f.pop * 1.25],
    ['40% of energy from clean sources', f.cleanShare >= .4 && f.gen >= f.eDemand],
    ['Connect half your buildings by road', f.connected >= .5],
    ['Build a school', has('school')],
    ['Food and water ready for more people', f.food >= f.foodDemand * 1.2 && f.water >= f.waterDemand * 1.1],
  ];
  return [
    ['Store food for droughts', f.foodCap >= f.foodDemand * .5],
    ['Hospital care for everyone', f.healthCov >= 1],
    ['Keep pollution under 40%', f.polTarget < 40],
    ['Energy that never runs out', f.gen >= f.eDemand && f.cleanShare >= .7],
    ['Jobs for 80% of workers', f.employment >= .8 && !f.unstaffed],
  ];
}
function renderObjectives() {
  $('objTitle').textContent = 'Objectives (Level ' + S.level + ')';
  $('objList').innerHTML = objectives().map(([t, ok]) => '<li class="' + (ok ? 'done' : '') + '"><i></i>' + t + '</li>').join('');
}

function advice() {
  const f = ui.flows, out = [];
  if (f.unstaffed) out.push(['bad', f.unstaffed + ' building' + (f.unstaffed > 1 ? 's are' : ' is') + ' closed for lack of workers. Remove something or lower staffing elsewhere.']);
  if (f.food < f.foodDemand) out.push(['bad', 'Food is short by ' + fmt(f.foodDemand - f.food) + ' a year. Build Food Crops.']);
  if (f.water < f.waterDemand) out.push(['bad', 'Water use is ' + fmt(f.waterDemand - f.water) + ' more than the river gives. The reservoir will drain.' + (S.level >= 2 ? ' A Dam or Water Treatment helps.' : '')]);
  if (f.gen < f.eDemand) out.push(['bad', 'Energy is short by ' + fmt(f.eDemand - f.gen) + '. Everything runs slower.' + (S.level === 1 ? ' Coal or nuclear can power the city.' : ' Solar, wind or a dam give clean power.')]);
  if (f.polTarget > 60) out.push(['warn', 'Pollution is heading to ' + Math.round(f.polTarget) + '%. Above 75% for 10 years kills the planet.']);
  if (S.level >= 2 && f.cap < f.pop * 1.1) out.push(['warn', 'Housing is almost full. Without homes the population cannot grow.']);
  if (S.level === 1 && f.net < 40) out.push(['warn', 'Earnings are low. Factories on gold, coal and natural resource deposits bring money for Level 2.']);
  if (f.employment < .6) out.push(['warn', 'Only ' + Math.round(f.employment * 100) + '% of workers have jobs.']);
  const extract = Object.values(S.buildings).filter(b => B[b.type].on && B[b.type].on !== 'river');
  if (S.level >= 2 && extract.length && f.econExtract > f.econ * .6) out.push(['warn', 'Most income comes from mines that will run out. Plan other income (cash crops, industrial park).']);
  if (!out.length) out.push(['', 'Your city is balanced right now. Think ahead: what happens when the population doubles, or the coal runs out?']);
  return out.slice(0, 4);
}
function renderAdvisor() {
  const a = advice();
  $('advList').innerHTML = a.map(([c, t]) => '<li class="' + c + '">' + t + '</li>').join('');
  $('advisor').classList.toggle('alert', a.some(x => x[0] === 'bad'));
  let ev = '';
  if (S.level === 3) ev = '<div class="event"><b>Drought warning</b><p>' + E.DROUGHTS[0] + ' years after you submit, a ' + E.DROUGHT_LEN + '-year drought will cut rainfall and harvests by 40%. More droughts follow over the centuries. Store food and water.</p></div>';
  else if (S.level === 2) ev = '<div class="event"><b>Coming up: 50 years</b><p>After this level the city runs for 50 years on its own. From now on, how you plan decides whether the population grows or shrinks.</p></div>';
  $('advEvent').innerHTML = ev;
}

function renderInspector() {
  const el = $('inspector');
  const bd = ui.sel && S.buildings[ui.sel];
  if (!bd) { el.hidden = true; return; }
  const d = B[bd.type], f = ui.flows;
  const rows = [];
  if (d.min) rows.push(['Status', bd._dead ? 'Deposit used up' : bd._eff > 0 ? 'Running at ' + Math.round(bd._eff * 100) + '%' : 'Closed: needs ' + d.min + ' workers']);
  if (d.on && d.on !== 'river') { const dep = S.deposits[S.tiles[bd.tiles[0]].dep]; rows.push(['Deposit left', Math.round(100 * dep.reserve / dep.max) + '% (~' + (d.use ? Math.round(dep.reserve / d.use) : '∞') + ' yrs)']); }
  if (d.cap) rows.push(['Houses', d.cap + ' people']);
  if (d.food) rows.push(['Food', '+' + d.food + ' at full staff']);
  if (d.gen) rows.push(['Energy', '+' + d.gen + ' at full staff']);
  if (d.energy) rows.push(['Uses energy', d.energy]);
  if (d.econ) rows.push(['Income', '+₹' + d.econ + 'k at full staff']);
  if (d.wR) rows.push(['Water to run', d.wR + ' / yr']);
  if (d.pol) rows.push(['Pollution', '+' + d.pol + ' / yr']);
  if (d.absorb) rows.push(['Cleans', d.absorb + ' pollution / yr']);
  if (d.maint) rows.push(['Upkeep', '₹' + d.maint + 'k / yr']);
  if (bd._road) rows.push(['Road bonus', '+15% output']);
  let staff = '';
  if (d.min && !bd.initial) staff = '<label for="wk" style="font-size:12px;color:var(--muted)">Workers: <b class="num" style="color:var(--text)" id="wkv">' + bd.workers + '</b> (min ' + d.min + ', max ' + d.max + ')</label><input id="wk" type="range" min="' + d.min + '" max="' + d.max + '" value="' + bd.workers + '">';
  el.innerHTML = '<h3>' + d.name + '</h3><p>' + d.desc + '</p><div class="kv">' + rows.map(r => '<span>' + r[0] + '</span><span class="num">' + r[1] + '</span>').join('') + '</div>' + staff +
    '<div class="row2"><button class="btn danger" id="demo">Demolish</button><button class="btn ghost" id="closeIns">Close</button></div>';
  el.hidden = false;
  const wk = $('wk');
  if (wk) wk.oninput = () => { bd.workers = +wk.value; $('wkv').textContent = wk.value; refresh(false, true); persist(); };
  $('closeIns').onclick = () => { ui.sel = null; refresh(); };
  $('demo').onclick = () => { E.demolish(S, bd.id); ui.sel = null; toast(d.name + ' demolished. Water and money spent are not returned.'); refresh(); persist(); };
}

/* build bar */
const TABS = [
  ['agri', 'Agriculture', ['foodFarm', 'cashFarm']],
  ['industry', 'Industry', ['coalPlant', 'goldFactory', 'mineralMine', 'nuclear', 'itPark']],
  ['housing', 'Housing', ['house', 'community', 'apartment']],
  ['energy', 'Energy', ['solar', 'wind', 'dam', 'battery']],
  ['infra', 'Development', ['road', 'school', 'waterPlant']],
  ['services', 'Future planning', ['granary', 'hospital', 'recycling', 'park', 'forest']],
  ['tools', 'Tools', ['inspect', 'demolish']],
];
const previews = {};
function chips(type) {
  const d = B[type], c = [];
  if (d.cap) c.push('<em>+' + d.cap + '</em> people');
  if (d.food) c.push('<em>+' + d.food + '</em> food');
  if (d.gen) c.push('<em>+' + d.gen + '</em> energy');
  if (d.econ) c.push('<em>+₹' + d.econ + 'k</em>/yr');
  if (d.waterIn) c.push('<em>+' + d.waterIn + '</em> water');
  if (d.wR) c.push('−' + d.wR + ' water');
  if (d.energy) c.push('−' + d.energy + ' energy');
  if (d.min) c.push(d.min + '–' + d.max + ' workers');
  if (d.pol) c.push('+' + d.pol + ' pollution');
  if (d.absorb) c.push('<em>−' + d.absorb + '</em> pollution');
  if (d.edu) c.push('teaches ' + d.edu);
  if (d.health) c.push('cares for ' + d.health);
  if (d.foodCap) c.push('stores ' + d.foodCap + ' food');
  if (d.firmFor) c.push('steadies 4 solar/wind');
  if (type === 'road') c.push('+15% to neighbours');
  return c.slice(0, 3).join(' · ');
}
function renderTabs() {
  $('tabs').innerHTML = TABS.map(([k, n]) => '<button role="tab" data-tab="' + k + '" aria-selected="' + (ui.tab === k) + '">' + n + '</button>').join('');
}
function renderCards() {
  const tab = TABS.find(t => t[0] === ui.tab);
  const html = [];
  tab[2].forEach(type => {
    if (type === 'inspect' || type === 'demolish') {
      html.push('<button class="card" data-type="' + type + '" aria-pressed="' + (ui.tool === type) + '"><div class="thumb tool">' + (type === 'inspect' ? '<svg viewBox="0 0 24 24" width="34" fill="none" stroke="currentColor" stroke-width="2"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21" stroke-linecap="round"/></svg>' : '<svg viewBox="0 0 24 24" width="34" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20h16M6 20V9l6-4 6 4v11" /><path d="M3 3l18 18" stroke="#ef5b4c" stroke-linecap="round"/></svg>') + '</div><div class="nm">' + (type === 'inspect' ? 'Inspect' : 'Demolish') + '</div><div class="ch">' + (type === 'inspect' ? 'Click a building to see how it is doing' : 'Remove a building. Nothing is refunded.') + '</div></button>');
      return;
    }
    const d = B[type], locked = d.lvl > S.level;
    const price = S.level === 1 ? 'Free now' : '₹' + d.cost + 'k';
    html.push('<button class="card' + (locked ? ' locked' : '') + '" data-type="' + type + '" data-lock="Level ' + d.lvl + '" aria-pressed="' + (ui.tool === type) + '" title="' + d.desc.replace(/"/g, '') + '"><span class="pv" data-pv="' + type + '"></span><div class="nm">' + d.name + '</div><div class="pr">' + (locked ? 'Unlocks in Level ' + d.lvl : price + (d.wB ? ' · ' + d.wB + '💧' : '')) + '</div><div class="ch">' + chips(type) + '</div></button>');
  });
  $('cards').innerHTML = html.join('');
  $('cards').querySelectorAll('[data-pv]').forEach(sp => { const t = sp.dataset.pv; if (previews[t] === undefined) previews[t] = has3D ? R3.thumb(t) : null; const im = document.createElement('img'); im.alt = ''; im.className = 'thumb'; if (previews[t]) im.src = previews[t]; sp.replaceWith(im); });
}

function renderTop() {
  const L = E.LEVELS[S.level];
  $('lvlBadge').textContent = S.level;
  $('lvlTitle').textContent = 'Level ' + S.level + ': ' + L.title;
  $('lvlSub').textContent = L.sub;
  $('clockY').textContent = 'City year ' + S.year;
  $('finishLabel').textContent = S.level < 3 ? 'Finish Level ' + S.level : 'Submit city';
  $('finishSub').textContent = S.level === 1 ? 'Then ' + S.cfg.jump + ' years pass' : S.level === 2 ? 'Then 50 years pass' : 'Run to year ' + S.cfg.cap;
}

function refresh(full, keepInspector) {
  if (!S) return;
  renderStats(); renderObjectives(); renderAdvisor(); if (!keepInspector) renderInspector(); renderMinimap(); renderTop();
  if (has3D) R3.sync(S, ui.flows, true);
  if (full) { renderTabs(); }
  if (!keepInspector) renderCards();
}

/* =========================================================
   Input
   ========================================================= */
let drag = null;
function setHover(i) {
  ui.hover = i;
  if (!has3D || !S || S.phase !== 'plan') return;
  const tool = ui.tool;
  if (i >= 0 && tool && tool !== 'inspect' && tool !== 'demolish') { const r = E.canPlace(S, tool, i); R3.hover(i, tool, r.ok, r.ok ? r.fp : E.footprint(S, tool, i)); }
  else R3.hover(i, tool, false, []);
}
cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); drag = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, btn: e.button, moved: false }; });
cv.addEventListener('pointermove', e => {
  const r = cv.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
  if (drag) {
    if (Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) > 6) drag.moved = true;
    if (drag.moved && has3D) {
      const dx = e.clientX - drag.lx, dy = e.clientY - drag.ly;
      if (drag.btn === 2 || e.shiftKey) R3.rotate(-dx * 0.006, dy * 0.004); else R3.pan(dx, dy);
    }
    drag.lx = e.clientX; drag.ly = e.clientY;
  }
  if (!S || !has3D) return;
  setHover(drag && drag.moved ? -1 : R3.pick(mx, my));
  showTip(e.clientX, e.clientY);
});
cv.addEventListener('pointerleave', () => { setHover(-1); $('tip').hidden = true; });
cv.addEventListener('pointerup', e => {
  const d = drag; drag = null;
  if (!d || d.moved || !S || S.phase !== 'plan' || !has3D) return;
  if (d.btn === 2) { ui.tool = null; R3.grid(false); setHover(-1); renderCards(); $('tip').hidden = true; return; }
  const r = cv.getBoundingClientRect(); const i = R3.pick(e.clientX - r.left, e.clientY - r.top);
  if (i < 0) return;
  clickTile(i);
});
cv.addEventListener('contextmenu', e => e.preventDefault());
cv.addEventListener('wheel', e => {
  e.preventDefault(); if (!has3D) return;
  const r = cv.getBoundingClientRect();
  R3.zoom(e.deltaY < 0 ? 0.88 : 1 / 0.88, e.clientX - r.left, e.clientY - r.top);
}, { passive: false });
window.addEventListener('keydown', e => {
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
  if (e.key === 'Escape') { ui.tool = null; ui.sel = null; if (has3D) { R3.grid(false); R3.select(null); } if (S) refresh(); }
  if (!has3D || viewMode !== 'plan') return;
  const k = e.key.toLowerCase();
  if (k === 'q') R3.rotateStep(-1); if (k === 'e') R3.rotateStep(1);
  if (k === 'w' || k === 'arrowup') R3.pan(0, 40); if (k === 's' || k === 'arrowdown') R3.pan(0, -40);
  if (k === 'a' || k === 'arrowleft') R3.pan(40, 0); if (k === 'd' || k === 'arrowright') R3.pan(-40, 0);
  if (k === '+' || k === '=') R3.zoom(0.85); if (k === '-') R3.zoom(1 / 0.85);
});
$('mapCtl').addEventListener('click', e => {
  const b = e.target.closest('[data-cam]'); if (!b || !has3D) return;
  const a = b.dataset.cam;
  if (a === 'l') R3.rotateStep(-1); if (a === 'r') R3.rotateStep(1); if (a === 'in') R3.zoom(0.8); if (a === 'out') R3.zoom(1.25); if (a === 'home') centerCam(false);
});

function clickTile(i) {
  const t = S.tiles[i];
  if (!ui.tool || ui.tool === 'inspect') { ui.sel = t.b && E.inLevel(S.level, t.x, t.y) ? t.b : null; if (has3D) R3.select(ui.sel); refresh(); return; }
  if (ui.tool === 'demolish') {
    if (t.b) { const bt = S.buildings[t.b].tiles.slice(); const n = B[S.buildings[t.b].type].name; E.demolish(S, t.b); ui.sel = null; if (has3D) R3.puff(bt); toast(n + ' demolished.'); refresh(); persist(); }
    return;
  }
  const r = E.build(S, ui.tool, i);
  if (!r.ok) { toast(r.why); return; }
  ui.sel = null;
  const placed = S.buildings[r.id];
  refresh(); persist();
  floatText(placed.tiles, effectLine(placed.type), r.cost ? '−₹' + r.cost + 'k' : '');
  setHover(i);
}
function effectLine(type) {
  const d = B[type], o = [];
  if (d.cap) o.push('+' + d.cap + ' homes'); if (d.food) o.push('+' + d.food + ' food'); if (d.gen) o.push('+' + d.gen + ' energy');
  if (d.econ) o.push('+₹' + d.econ + 'k/yr'); if (d.waterIn) o.push('+' + d.waterIn + ' water'); if (d.absorb) o.push('−' + d.absorb + ' pollution');
  if (d.edu) o.push('teaches ' + d.edu); if (d.health) o.push('cares for ' + d.health); if (d.foodCap) o.push('stores ' + d.foodCap + ' food');
  if (d.pol && d.pol >= 1) o.push('+' + d.pol + ' pollution');
  return o.slice(0, 3).join('  ');
}
function floatText(tiles, text, cost) {
  if (!has3D || !text) return;
  const p = R3.projectTiles(tiles, 1.0); if (!p) return;
  const el = document.createElement('div'); el.className = 'floaty';
  el.innerHTML = '<b>' + escapeHtml(text) + '</b>' + (cost ? '<span>' + cost + '</span>' : '');
  el.style.left = p.x + 'px'; el.style.top = p.y + 'px';
  $('tags').appendChild(el); setTimeout(() => el.remove(), 1900);
}
function showTip(px, py) {
  const tip = $('tip');
  if (ui.hover < 0 || !S) { tip.hidden = true; return; }
  const t = S.tiles[ui.hover];
  let text = '';
  if (!E.inLevel(S.level, t.x, t.y)) text = 'Future land: unlocks in a later level';
  else if (ui.tool && ui.tool !== 'inspect' && ui.tool !== 'demolish') { const r = E.canPlace(S, ui.tool, ui.hover); text = r.ok ? B[ui.tool].name + (r.cost ? ' · ₹' + r.cost + 'k' : '') + (B[ui.tool].wB ? ' · ' + B[ui.tool].wB + ' water' : '') : r.why; }
  else if (t.b) { const bd = S.buildings[t.b]; text = B[bd.type].name + (B[bd.type].min ? (bd._eff > 0 ? ' · running ' + Math.round(bd._eff * 100) + '%' : ' · closed') : ''); }
  else if (t.dep) { const d = S.deposits[t.dep]; text = { coal: 'Coal deposit (3 blocks)', gold: 'Gold deposit', uranium: 'Uranium deposit (4 blocks)', mineral: 'Natural resources' }[t.t] + ' · ' + Math.round(100 * d.reserve / d.max) + '% left'; }
  else if (t.t === 'river') text = 'River: water source. Dams and bridges go here.';
  if (!text) { tip.hidden = true; return; }
  tip.textContent = text; tip.hidden = false;
  const r = $('app').getBoundingClientRect();
  tip.style.left = Math.min(px - r.left + 14, r.width - 250) + 'px'; tip.style.top = (py - r.top + 16) + 'px';
}

$('tabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (!b) return; ui.tab = b.dataset.tab; renderTabs(); renderCards(); });
$('cards').addEventListener('click', e => {
  const c = e.target.closest('[data-type]'); if (!c) return;
  const type = c.dataset.type;
  if (B[type] && B[type].lvl > S.level) { toast(B[type].name + ' unlocks in Level ' + B[type].lvl + '.'); return; }
  ui.tool = ui.tool === type ? null : type;
  if (ui.tool && ui.tool !== 'inspect') { ui.sel = null; if (has3D) R3.select(null); }
  if (has3D) R3.grid(!!ui.tool && ui.tool !== 'inspect');
  renderCards(); renderInspector(); setHover(ui.hover);
});
$('minimap').addEventListener('click', e => {
  const r = e.target.getBoundingClientRect(), sc = r.width / W;
  if (has3D) R3.lookTile(Math.floor((e.clientX - r.left) / sc), Math.floor((e.clientY - r.top) / sc));
});

let toastT = 0;
function toast(msg) { const t = $('toast'); t.textContent = msg; t.hidden = false; t.style.opacity = 1; clearTimeout(toastT); toastT = setTimeout(() => { t.style.opacity = 0; setTimeout(() => t.hidden = true, 300); }, 2600); }

/* =========================================================
   Level flow
   ========================================================= */
function tickClock() {
  if (!S || S.phase !== 'plan') return;
  const left = Math.max(0, S.deadline - Date.now());
  const m = Math.floor(left / 60000), s = Math.floor(left / 1000) % 60;
  $('clockT').textContent = String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  $('clock').classList.toggle('hurry', left < 60000);
  if (left <= 0) { closeAll(); toast('Time is up for Level ' + S.level + '.'); finishLevel(); }
}
setInterval(tickClock, 500);

function confirmBox(title, text, yes, onYes) {
  $('cfTitle').textContent = title; $('cfText').textContent = text; $('cfYes').textContent = yes;
  $('confirmScreen').hidden = false;
  $('cfYes').onclick = () => { $('confirmScreen').hidden = true; onYes(); };
  $('cfNo').onclick = () => { $('confirmScreen').hidden = true; };
}
function closeAll() { ['confirmScreen', 'rulesScreen', 'pinScreen'].forEach(id => $(id).hidden = true); }
$('finishBtn').onclick = () => {
  if (!S || S.phase !== 'plan') return;
  const msg = S.level === 1 ? 'Your city will run for ' + S.cfg.jump + ' years with fixed birth and death rates. The money it earns pays for Level 2.'
    : S.level === 2 ? 'Your city will run for 50 years. Population growth now depends on food, water, homes, jobs, health and pollution.'
    : 'Your city will run on its own until it collapses or reaches year ' + S.cfg.cap + '. You cannot build after this. Your result goes to the organisers.';
  confirmBox(S.level < 3 ? 'Finish Level ' + S.level + '?' : 'Submit your city?', msg, S.level < 3 ? 'Finish level' : 'Submit city', finishLevel);
};

function finishLevel() {
  if (S.phase !== 'plan') return;
  ui.tool = null; ui.sel = null;
  if (S.level === 1) runSim({ years: S.cfg.jump, mode: 'fixed', title: 'Level 1 → Level 2', lead: S.cfg.jump + ' years pass. Births 3% and deaths 1% a year (fixed).', next: () => goLevel(2) });
  else if (S.level === 2) runSim({ years: 50, mode: 'dyn', title: 'Level 2 → Level 3', lead: '50 years pass. Your planning now decides whether the population grows or shrinks.', next: () => goLevel(3) });
  else { S.finalStart = S.year; runSim({ years: S.cfg.cap - S.year, mode: 'dyn', final: true, title: 'The city runs on its own', lead: 'No more building. Droughts arrive. Will your city still stand at year ' + S.cfg.cap + '?', next: showResult }); }
}
function goLevel(l) {
  E.startLevel(S, l);
  S.deadline = Date.now() + levelMinutes(l) * 60000;
  ui.tab = l === 2 ? 'housing' : 'services';
  setView('plan'); if (has3D) R3.orbit(false);
  refresh(true); persist(); centerCam(false);
  toast('Level ' + l + ': the land has grown to ' + E.LEVELS[l].size + '×' + E.LEVELS[l].size + '.');
}

let simCtl = null;
function runSim(opt) {
  S.phase = 'sim'; persist();
  const startYear = S.year, startPop = S.pop, startMoney = S.money, logFrom = S.log.length;
  const hist0 = S.history.length;
  $('simTitle').textContent = opt.title; $('simLead').textContent = opt.lead;
  $('simNext').hidden = true; $('simSkip').hidden = false; $('simLog').innerHTML = '';
  $('simScreen').hidden = false; $('tip').hidden = true;
  if (has3D) { R3.grid(false); R3.select(null); R3.hover(-1, null, false, []); }
  setView('sim'); if (has3D) R3.orbit(true);
  let done = 0, fast = false, lastLogged = logFrom;
  const perFrame = () => fast ? 1e9 : opt.final ? 2 : opt.years > 20 ? 0.5 : 0.18;
  let acc = 0;
  simCtl = { skip: () => { fast = true; } };
  function frame() {
    acc += perFrame();
    while (acc >= 1 && done < opt.years && !S.dead) {
      acc -= 1;
      const before = S.history.length ? S.history[S.history.length - 1] : null;
      const rec = E.step(S, opt.mode); done++;
      if (rec.drought && !(before && before.drought)) S.log.push({ year: rec.year, text: 'Drought: rainfall and harvests fall by 40%.' });
      if (opt.final && done % 100 === 0 && !S.dead) S.log.push({ year: rec.year, text: 'Still standing with ' + fmt(rec.pop) + ' people.' });
    }
    drawSim(hist0, opt, startYear);
    if (has3D) R3.sync(S, E.flows(S), false);
    if (S.log.length > lastLogged) { $('simLog').innerHTML = S.log.slice(logFrom).slice(-40).reverse().map(l => '<div><b>Year ' + l.year + '</b>' + l.text + '</div>').join(''); lastLogged = S.log.length; }
    if (done < opt.years && !S.dead) { requestAnimationFrame(frame); return; }
    // finished
    if (S.dead) S.log.push({ year: S.dead.year, text: 'Declared a dead planet. ' + S.dead.why });
    $('simLog').innerHTML = S.log.slice(logFrom).slice(-40).reverse().map(l => '<div><b>Year ' + l.year + '</b>' + l.text + '</div>').join('');
    drawSim(hist0, opt, startYear);
    $('simSkip').hidden = true; $('simNext').hidden = false;
    $('simNext').textContent = S.dead || opt.final ? 'See result' : 'Start Level ' + (S.level + 1);
    if (has3D) R3.orbit(false);
    $('simNext').onclick = () => {
      $('simScreen').hidden = true;
      if (S.dead || opt.final) { if (!opt.final) S.finalStart = S.finalStart == null ? S.year : S.finalStart; showResult(); }
      else { S.phase = 'plan'; opt.next(); }
    };
    S.phase = S.dead || opt.final ? 'done' : 'between';
    persist();
  }
  requestAnimationFrame(frame);
  // stat tiles
  simStats = () => {
    const last = S.history[S.history.length - 1] || { pop: S.pop, money: S.money, pollution: S.pollution };
    $('simStats').innerHTML = [['Population', fmt(last.pop), last.pop >= startPop ? '#62d36c' : '#ef5b4c'], [S.level === 1 ? 'Money saved' : 'Budget', money(last.money), last.money >= startMoney ? '#f5c544' : '#ef5b4c'], ['Pollution', Math.round(last.pollution) + '%', last.pollution > 60 ? '#ef5b4c' : '#c08cf0'], ['SDG this year', (last.sdg != null ? Math.round(last.sdg) : '–') + '/100', '#62d36c']]
      .map(([k, v, c]) => '<div><small>' + k + '</small><b class="num" style="color:' + c + '">' + v + '</b></div>').join('');
  };
}
let simStats = () => {};
$('simSkip').onclick = () => simCtl && simCtl.skip();

function drawSim(h0, opt, y0) {
  const H = S.history.slice(Math.max(0, h0 - (opt.final ? 0 : 0)));
  $('simYear').textContent = 'Year ' + S.year;
  $('simSub').textContent = opt.final ? 'of ' + S.cfg.cap : '(from year ' + y0 + ')';
  simStats();
  const c = $('chart'), g = c.getContext('2d'), w = c.width, h = c.height, pad = 30;
  g.clearRect(0, 0, w, h);
  const all = S.history;
  if (!all.length) return;
  const x0 = all[0].year - 1, x1 = Math.max(opt.final ? S.cfg.cap : y0 + opt.years, all[all.length - 1].year);
  const X = yr => pad + (w - pad * 2) * (yr - x0) / Math.max(1, x1 - x0);
  // droughts
  g.fillStyle = 'rgba(242,163,58,.22)';
  all.forEach(r => { if (r.drought) g.fillRect(X(r.year - 1), pad, Math.max(2, X(r.year) - X(r.year - 1)), h - pad * 2); });
  // grid
  g.strokeStyle = 'rgba(150,205,225,.12)'; g.lineWidth = 2;
  for (let k = 0; k <= 4; k++) { const y = pad + (h - pad * 2) * k / 4; g.beginPath(); g.moveTo(pad, y); g.lineTo(w - pad, y); g.stroke(); }
  g.fillStyle = '#95b0b8'; g.font = '22px Lexend, sans-serif'; g.textAlign = 'left';
  g.fillText('Year ' + Math.round(x0 + 1), pad, h - 4); g.textAlign = 'right'; g.fillText('Year ' + x1, w - pad, h - 4);
  const series = [['pop', '#62d36c'], ['money', '#f5c544'], ['pollution', '#c08cf0']];
  series.forEach(([k, col]) => {
    let mx = k === 'pollution' ? 100 : Math.max(1, ...all.map(r => Math.abs(r[k])));
    const mn = k === 'money' ? Math.min(0, ...all.map(r => r[k])) : 0;
    const Y = v => h - pad - (h - pad * 2) * (v - mn) / Math.max(1, mx - mn);
    g.strokeStyle = col; g.lineWidth = 4; g.beginPath();
    all.forEach((r, i) => { const x = X(r.year), y = Y(r[k]); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke();
    const lr = all[all.length - 1]; g.fillStyle = col; g.beginPath(); g.arc(X(lr.year), Y(lr[k]), 7, 0, 7); g.fill();
  });
  if (!opt.final) { g.strokeStyle = 'rgba(255,255,255,.35)'; g.setLineDash([8, 8]); g.beginPath(); g.moveTo(X(y0), pad); g.lineTo(X(y0), h - pad); g.stroke(); g.setLineDash([]); }
}

/* =========================================================
   Result
   ========================================================= */
const SDG_COL = { 2: '#DDA63A', 3: '#4C9F38', 4: '#C5192D', 6: '#26BDE2', 7: '#FCC30B', 8: '#A21942', 9: '#FD6925', 11: '#FD9D24', 12: '#BF8B2E', 13: '#3F7E44', 15: '#56C02B' };
async function showResult() {
  S.phase = 'done';
  const r = E.result(S, S.cfg.cap);
  S.over = true;
  $('resTeam').textContent = S.team;
  const pct = r.score / 100, C = 2 * Math.PI * 58;
  $('resRing').innerHTML = '<circle cx="70" cy="70" r="58" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="14"/><circle cx="70" cy="70" r="58" fill="none" stroke="' + (r.score >= 70 ? '#62d36c' : r.score >= 55 ? '#f5c544' : '#ef5b4c') + '" stroke-width="14" stroke-linecap="round" stroke-dasharray="' + (C * pct) + ' ' + C + '" transform="rotate(-90 70 70)"/><text x="70" y="72" text-anchor="middle" fill="#e9f4f1" font-family="Fredoka, sans-serif" font-size="38" font-weight="700">' + r.score.toFixed(1) + '</text><text x="70" y="94" text-anchor="middle" fill="#95b0b8" font-size="12" font-family="Lexend, sans-serif">SDG score / 100</text>';
  $('resFate').className = 'fate ' + (r.alive ? 'ok' : 'dead');
  $('resFate').innerHTML = r.alive ? '<b>Your city was still thriving in year ' + r.years + '.</b> It reached the year limit with ' + fmt(r.pop) + ' people.' : '<b>Declared a dead planet in year ' + r.years + '.</b> ' + r.why;
  $('resStats').innerHTML = [['Years lasted', r.years + ' / ' + S.cfg.cap], ['Final population', fmt(r.pop)], ['Buildings', Object.keys(S.buildings).length]].map(([k, v]) => '<div><small>' + k + '</small><b class="num">' + v + '</b></div>').join('');
  $('resSdgs').innerHTML = E.SDGS.map(x => '<div class="sdg"><div class="n" style="background:' + SDG_COL[x.n] + '">' + x.n + '</div><div><div>' + x.name + '</div><div class="b"><i style="width:' + r.sdg[x.key] + '%;background:' + SDG_COL[x.n] + '"></i></div></div><div class="num" style="text-align:right">' + Math.round(r.sdg[x.key]) + '</div></div>').join('');
  setView('result'); if (has3D) R3.orbit(true);
  $('resultScreen').hidden = false;
  $('resSaved').textContent = 'Sending your result to the organisers…';
  const rec = { id: 'r' + S.seed + '-' + Date.now().toString(36), team: S.team, score: r.score, years: r.years, alive: r.alive, why: r.why || '', pop: r.pop, sdg: r.sdg, cap: S.cfg.cap, startedAt: S.startedAt, finishedAt: new Date().toISOString(), buildings: Object.keys(S.buildings).length };
  if (!S.saved) {
    S.saved = true;
    const how = await saveResult(rec);
    $('resSaved').textContent = how === 'shared' ? 'Your result has been sent to the organisers. Well done!' : 'Your result is saved on this laptop and will reach the organisers when it reconnects.';
  } else $('resSaved').textContent = 'Your result has been recorded.';
  LS.del('game');
}
$('resDone').onclick = () => { $('resultScreen').hidden = true; S = null; showStart(); };

/* =========================================================
   Start / rules / resume
   ========================================================= */
function applySettingsText() {
  $('capTxt').textContent = settings.cap;
  $('l1t').textContent = settings.t1 + ' min'; $('l2t').textContent = settings.t2 + ' min'; $('l3t').textContent = settings.t3 + ' min';
  document.querySelectorAll('.jy').forEach(e => e.textContent = settings.jump);
}
function showStart() {
  applySettingsText();
  $('startScreen').hidden = false; $('teamName').value = '';
  const saved = LS.get('game', null);
  const rb = $('resumeBox');
  if (saved && saved.S && !saved.S.over) {
    rb.hidden = false;
    rb.innerHTML = '<p class="lead" style="margin:0 0 6px">A game was interrupted on this laptop: <b style="color:var(--text)">' + escapeHtml(saved.S.team) + '</b>, Level ' + saved.S.level + '.</p><button class="btn" id="resumeBtn">Resume that game</button>';
    $('resumeBtn').onclick = () => resume(saved.S);
  } else rb.hidden = true;
  showDemo();
}
function resume(st) {
  S = st; $('startScreen').hidden = true;
  if (has3D) { R3.orbit(false); R3.load(S); }
  setView('plan');
  if (S.phase === 'sim' || S.phase === 'between') {
    // finish the interrupted time jump from where it stopped
    S.phase = 'plan';
    if (S.level === 1) { E.advance(S, S.cfg.jump - S.year, 'fixed'); goLevel(2); return; }
    if (S.level === 2) { E.advance(S, S.cfg.jump + 50 - S.year, 'dyn'); if (S.dead) { showResult(); return; } goLevel(3); return; }
    if (S.level === 3) { runSim({ years: S.cfg.cap - S.year, mode: 'dyn', final: true, title: 'The city runs on its own', lead: 'Resuming the final run.', next: showResult }); return; }
  }
  if (S.phase === 'done') { showResult(); return; }
  if (S.deadline < Date.now() + 60000) S.deadline = Date.now() + 2 * 60000;
  refresh(true); if (has3D) R3.envNow(); centerCam(false);
}
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
$('startForm').addEventListener('submit', e => {
  e.preventDefault();
  const name = $('teamName').value.trim();
  if (!name) return;
  LS.del('game');
  $('startScreen').hidden = true;
  newGame(name);
});
$('startRules').onclick = () => { $('rulesScreen').hidden = false; };
$('rulesBtn').onclick = () => { $('rulesScreen').hidden = false; };
$('rulesClose').onclick = () => { $('rulesScreen').hidden = true; };

/* =========================================================
   Organiser
   ========================================================= */
$('orgBtn').onclick = () => { $('pinIn').value = ''; $('pinErr').hidden = true; $('pinScreen').hidden = false; setTimeout(() => $('pinIn').focus(), 50); };
$('startOrg').onclick = () => $('orgBtn').onclick();
$('pinCancel').onclick = () => { $('pinScreen').hidden = true; };
$('pinForm').addEventListener('submit', e => {
  e.preventDefault();
  if ($('pinIn').value.trim() !== String(settings.pin)) { $('pinErr').hidden = false; return; }
  $('pinScreen').hidden = true; openOrg();
});
let lbUnsub = null, lbRows = [];
function openOrg() {
  $('orgScreen').hidden = false; seg('lb');
  $('sT1').value = settings.t1; $('sT2').value = settings.t2; $('sT3').value = settings.t3; $('sJump').value = settings.jump; $('sCap').value = settings.cap; $('sPin').value = settings.pin;
  $('gameInfo').textContent = S ? 'Current game: ' + S.team + ', Level ' + S.level + ', city year ' + S.year + '.' : 'No game in progress.';
  updateDbStatus();
  if (db && !lbUnsub) {
    lbUnsub = db.collection('results').onSnapshot(snap => { lbRows = snap.docs.map(d => Object.assign({ _id: d.id }, d.data())); renderLb(); }, () => { lbUnsub = null; lbRows = LS.get('results', []); renderLb(); });
  } else if (!db) { lbRows = LS.get('results', []); renderLb(); }
  else renderLb();
}
function updateDbStatus() {
  const el = $('dbStatus'); if (!el) return;
  el.textContent = !dbReady ? 'Connecting…' : db ? 'Live leaderboard: results from every laptop appear here as teams finish.' : 'Offline: showing results saved on this laptop only. Sign this laptop in to the club account to share results.';
}
function renderLb() {
  const rows = lbRows.slice().sort((a, b) => b.score - a.score || b.years - a.years);
  $('lbBody').innerHTML = rows.length ? rows.map((r, i) => '<tr class="' + (i === 0 ? 'top1' : '') + '"><td class="num">' + (i + 1) + '</td><td><b>' + escapeHtml(r.team) + '</b><div class="lead" style="font-size:11.5px;margin:2px 0 0">' + E.SDGS.map(x => x.n + ':' + Math.round((r.sdg || {})[x.key] || 0)).join(' · ') + '</div></td><td class="num"><b>' + (+r.score).toFixed(1) + '</b></td><td class="num">' + r.years + ' / ' + (r.cap || 500) + '</td><td><span class="chip ' + (r.alive ? 'ok' : 'dead') + '">' + (r.alive ? 'Thriving' : 'Dead planet') + '</span></td><td class="num">' + (r.finishedAt ? new Date(r.finishedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '') + '</td><td><button class="btn ghost" data-del="' + escapeHtml(r._id || r.id) + '" title="Remove a test entry">Remove</button></td></tr>').join('')
    : '<tr><td colspan="7" style="color:var(--muted);padding:18px 8px">No results yet. Each team\'s score appears here the moment they submit Level 3.</td></tr>';
}
$('lbBody').addEventListener('click', e => {
  const b = e.target.closest('[data-del]'); if (!b) return;
  const id = b.dataset.del;
  if (b.dataset.armed) {
    if (db) db.collection('results').doc(id).delete().catch(() => {});
    LS.set('results', LS.get('results', []).filter(r => r.id !== id));
    if (!db) { lbRows = LS.get('results', []); renderLb(); }
  } else { b.dataset.armed = '1'; b.textContent = 'Confirm remove'; b.classList.add('danger'); }
});
function seg(k) {
  [['lb', 'segLb', 'paneLb'], ['set', 'segSet', 'paneSet'], ['game', 'segGame', 'paneGame']].forEach(([n, s, p]) => { $(s).setAttribute('aria-selected', n === k); $(p).hidden = n !== k; });
}
$('segLb').onclick = () => seg('lb'); $('segSet').onclick = () => seg('set'); $('segGame').onclick = () => seg('game');
$('orgClose').onclick = () => { $('orgScreen').hidden = true; };
$('setForm').addEventListener('submit', async e => {
  e.preventDefault();
  const n = (id, lo, hi, d) => clamp(Math.round(+$(id).value || d), lo, hi);
  settings = { t1: n('sT1', 1, 60, 25), t2: n('sT2', 1, 60, 8), t3: n('sT3', 1, 60, 10), jump: n('sJump', 5, 10, 8), cap: +$('sCap').value === 1000 ? 1000 : 500, pin: ($('sPin').value.trim() || '2026').slice(0, 12) };
  LS.set('settings', settings); applySettingsText();
  let msg = 'Saved on this laptop.';
  if (db) { try { await db.doc('config/settings').set(settings); msg = 'Saved for every laptop. New games use these settings.'; } catch (err) { msg = 'Saved on this laptop only (could not reach the shared store).'; } }
  $('setMsg').textContent = msg;
});
$('resetGame').onclick = function () {
  if (!this.dataset.armed) { this.dataset.armed = '1'; this.textContent = 'Click again to confirm'; return; }
  delete this.dataset.armed; this.textContent = "End this team's game without saving";
  LS.del('game'); S = null; $('orgScreen').hidden = true; ['simScreen', 'resultScreen'].forEach(id => $(id).hidden = true); showStart();
};

/* =========================================================
   Boot
   ========================================================= */
function loop(t) {
  if (has3D) R3.frame(t);
  requestAnimationFrame(loop);
}
window.addEventListener('resize', () => { if (has3D) { R3.resize(); layoutInsets(); } });
if (!has3D) { const n = document.createElement('div'); n.className = 'no3d'; n.textContent = 'This browser cannot show the 3D city. Please use an up-to-date Chrome, Edge or Firefox.'; $('app').appendChild(n); }
buildLegend(); renderTabs();
showStart();
requestAnimationFrame(loop);
initDb();
/*TEST*/
// keep panels honest while the clock runs (flows don't change with time, but buildings toggle on/off with staffing)
})();
