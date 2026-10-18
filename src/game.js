(function () {
'use strict';
const E = window.Eco, B = E.B, W = E.WORLD;
const C = window.ECO_CONTENT;
const $ = id => document.getElementById(id);
const fmt = n => Math.round(n).toLocaleString('en-IN');
const money = k => E.fmtMoney(k);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const escapeHtml = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// event text: ChatGPT content (by id) over the engine's defaults
const EVENT_TEXT = {};
(window.ECO_CONTENT_OVERRIDE && window.ECO_CONTENT_OVERRIDE.events || []).forEach(ev => { if (ev && ev.id && E.EVENTS[ev.id]) EVENT_TEXT[ev.id] = ev; });
function eventDef(id) {
  const d = E.EVENTS[id], o = EVENT_TEXT[id];
  if (!o) return Object.assign({ id }, d);
  return Object.assign({ id }, d, { title: o.title || d.title, text: o.text || d.text, image: o.image, choices: (o.choices && o.choices.length ? o.choices : d.choices) });
}

/* =========================================================
   Settings + results store (Claude db when hosted there, local otherwise)
   ========================================================= */
// sheetUrl: the Google Apps Script web app (tools/google-sheet). Baked in at build time when known.
const DEFAULTS = { t1: 15, t2: 8, t3: 8, jump: 8, pauseSec: 90, finalPauseSec: 60, pin: '2026', sheetUrl: '', sheetKey: 'ecocity-2026', dayMin: 6 };
Object.assign(DEFAULTS, window.ECO_CONFIG || {});
let settings = Object.assign({}, DEFAULTS);
let db = null, dbReady = false;
const LS = {
  get(k, d) { try { const v = localStorage.getItem('ecocity2.' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('ecocity2.' + k, JSON.stringify(v)); } catch (e) {} },
  del(k) { try { localStorage.removeItem('ecocity2.' + k); } catch (e) {} },
};
Object.assign(settings, LS.get('settings', {}));

async function initDb() {
  try { if (!window.claude || !window.claude.use) throw 0; db = await window.claude.use('db'); } catch (e) { db = null; }
  dbReady = true;
  if (db) {
    try { const snap = await db.doc('config/settings').get(); if (snap.exists) { Object.assign(settings, snap.data()); LS.set('settings', settings); } } catch (e) {}
    const pending = LS.get('pending', []);
    if (pending.length) { const left = []; for (const r of pending) { try { await db.collection('results').doc(r.id).set(r); } catch (e) { left.push(r); } } LS.set('pending', left); }
  }
  applySettingsText(); updateDbStatus();
}
async function saveResult(rec) {
  const all = LS.get('results', []); all.push(rec); LS.set('results', all);
  if (db) { try { await db.collection('results').doc(rec.id).set(rec); return 'shared'; } catch (e) {} }
  const p = LS.get('pending', []); p.push(rec); LS.set('pending', p);
  return db ? 'pending' : 'local';
}
/* Live Google Sheet for the organisers. Every call is a GET (no CORS preflight); calls that fail
   wait in a queue on this laptop and are retried, in order, every 20 seconds. */
function sheetOn() { return /^https:\/\/script\.google(usercontent)?\.com\//.test(settings.sheetUrl || ''); }
async function sheetCall(params) {
  const q = new URLSearchParams(Object.assign({ key: settings.sheetKey || '' }, params));
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 9000);
  try {
    const r = await fetch(settings.sheetUrl + '?' + q.toString(), { signal: ctl.signal, redirect: 'follow' });
    const j = await r.json();
    if (!j.ok) throw new Error(j.error || 'sheet error');
    return j;
  } finally { clearTimeout(t); }
}
let flushing = false;
async function sheetFlush() {
  if (flushing || !sheetOn()) return;
  flushing = true;
  try {
    let q = LS.get('sheetq', []);
    while (q.length) {
      try { await sheetCall(q[0]); } catch (e) { if (/unknown game id|bad key/.test(e.message)) { /* drop a call the sheet can never accept */ } else break; }
      q.shift(); LS.set('sheetq', q);
    }
  } finally { flushing = false; updateDbStatus(); }
}
function sheetSend(params) { if (!sheetOn()) return; const q = LS.get('sheetq', []); q.push(params); LS.set('sheetq', q); sheetFlush(); }
setInterval(sheetFlush, 20000);
function laptopName() { let n = LS.get('laptop', ''); if (!n) { n = 'Laptop-' + Math.random().toString(36).slice(2, 6).toUpperCase(); LS.set('laptop', n); } return n; }

// Duplicate team names are rejected. The same team (same lead roll number) may play again; it is marked as a repeat.
async function teamNameCheck(name, roll) {
  const n = name.trim().toLowerCase(), rl = roll.trim().toLowerCase();
  const same = LS.get('teams', []).concat(LS.get('results', [])).filter(r => (r.team || '').trim().toLowerCase() === n);
  let res = { taken: same.some(r => (r.roll || '').trim().toLowerCase() !== rl), repeat: same.length > 0 };
  if (sheetOn()) {
    try { const j = await sheetCall({ action: 'check', team: name, roll }); res = { taken: !!j.taken, repeat: !!j.repeat || res.repeat }; }
    catch (e) { res.offline = true; }
  } else if (db) {
    try { const q = await db.collection('results').get(); q.docs.forEach(d => { const r = d.data(); if ((r.team || '').trim().toLowerCase() === n) { if ((r.roll || '').trim().toLowerCase() !== rl) res.taken = true; res.repeat = true; } }); } catch (e) {}
  }
  return res;
}

/* Forms: never rely on a real form submission (sandboxed frames may block it).
   Submit buttons become plain buttons; Enter in a field does the same thing. */
function onSubmit(form, fn) {
  const fake = { preventDefault() {} };
  let busy = false;
  const run = async () => { if (busy) return; busy = true; try { await fn(fake); } finally { busy = false; } };
  form.addEventListener('submit', e => { e.preventDefault(); run(); });
  form.querySelectorAll('button[type=submit]').forEach(b => { b.type = 'button'; b.addEventListener('click', run); });
  form.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); run(); } });
}
/* =========================================================
   Game state
   ========================================================= */
let S = null;
let ui = { tool: null, sel: null, selTile: -1, hover: -1, tab: 'agri', size: 1, path: 0, flows: null };

function persist() { if (S && !S.over) LS.set('game', { S }); }
function levelMinutes(l) { return +(l === 1 ? S.cfg.t1 : l === 2 ? S.cfg.t2 : S.cfg.t3); }

function newGame(team, roll, phone, repeat) {
  const seed = (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0;
  S = E.newGame(seed, team);
  S.roll = roll; S.phone = phone;
  S.cfg = { dayMin: settings.dayMin || 6, t1: settings.t1, t2: settings.t2, t3: settings.t3, jump: settings.jump, pauseSec: settings.pauseSec, finalPauseSec: settings.finalPauseSec };
  S.deadline = Date.now() + levelMinutes(1) * 60000;
  S.startedAt = new Date().toISOString();
  S.gameId = 'g' + seed.toString(36) + Date.now().toString(36);
  S.repeat = !!repeat;
  sheetSend({ action: 'start', id: S.gameId, team, roll, phone, laptop: laptopName(), startedAt: S.startedAt, repeat: repeat ? '1' : '' });
  ui.tool = null; ui.sel = null; ui.selTile = -1; ui.size = 1; ui.path = 0;
  const teams = LS.get('teams', []); teams.push({ team, roll, startedAt: S.startedAt }); LS.set('teams', teams);
  if (has3D) { R3.orbit(false); R3.load(S); R3.grid(false); R3.select(null); }
  setView('plan');
  persist();
  refresh(true);
  if (has3D) { R3.envNow(); layoutInsets(); R3.setLevel(1, false); R3.setDayLength(S.cfg.dayMin || settings.dayMin); R3.newDay(7); }
  startGuide();
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
  d.level = 3; d.money = 1e9; d.water = 60000; d.kids = 1200; d.adults = 2400; d.elders = 400; d.pop = 4000; d.pollution = 6;
  const put = (type, x, y) => { const i = E.idx(x, y); if (E.canPlace(d, type, i).ok) { E.build(d, type, i); return true; } return false; };
  for (let x = 0; x < W; x++) { put('road', x, 5); put('road', x, 10); }
  for (let y = 0; y < W; y++) { put('road', 4, y); put('road', 10, y); }
  const near = [];
  d.tiles.forEach((t, i) => { if (t.t === 'grass' && !t.b) { const adj = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => { const n = d.tiles[E.idx(Math.min(W - 1, Math.max(0, t.x + a)), Math.min(W - 1, Math.max(0, t.y + b)))]; return n.b && d.buildings[n.b].type === 'road'; }); near.push({ i, s: (adj ? 0 : 20) + Math.hypot(t.x - 7, t.y - 7) }); } });
  near.sort((a, b) => a.s - b.s);
  const plan = ['apartment', 'apartment', 'hospital', 'school', 'community', 'itPark', 'apartment', 'community', 'house', 'park', 'granary', 'waterPlant', 'community', 'house', 'recycling', 'park', 'house', 'battery', 'solar', 'solar', 'solar', 'wind', 'wind', 'wind', 'wind', 'foodFarm', 'foodFarm', 'foodFarm', 'foodFarm', 'cashFarm', 'foodFarm', 'forest', 'forest', 'forest', 'park', 'forest'];
  let k = 0;
  for (const type of plan) { while (k < near.length && !E.canPlace(d, type, near[k].i).ok) k++; if (k < near.length) { E.build(d, type, near[k].i); k++; } }
  [['coalPlant', 2], ['goldFactory', 1], ['nuclear', 2], ['mineralMine', 1]].forEach(([type, size]) => { for (let i = 0; i < d.tiles.length; i++) if (E.canPlace(d, type, i, { size }).ok) { E.build(d, type, i, { size }); break; } });
  d.tiles.forEach((t, i) => { if (t.t === 'river' && !t.b && t.y === 7) E.build(d, 'dam', i); });
  Object.values(d.buildings).forEach(b => { if (E.HOUSING.includes(b.type) && b.id.length % 2) { b.up.solar = true; } });
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
const MM_COL = { housing: '#e5534b', agri: '#e9c046', industry: '#8f98a3', energy: '#45c7e0', infra: '#44505a', services: '#c38cf0', green: '#2d8a3e', water: '#2f8fd0', empty: '#a9d68e', res: '#5b4a3a', used: '#2a2522' };
function catColor(bd) { const d = B[bd.type]; if (d.green) return MM_COL.green; if (bd.type === 'road') return MM_COL.infra; return MM_COL[d.cat] || MM_COL.infra; }
function renderMinimap() {
  const m = $('minimap'), g = m.getContext('2d'), s = m.width / W;
  g.fillStyle = '#0b1a24'; g.fillRect(0, 0, m.width, m.height);
  S.tiles.forEach(t => {
    const locked = !E.inLevel(S.level, t.x, t.y);
    const col = t.b ? catColor(S.buildings[t.b]) : t.t === 'river' ? MM_COL.water : t.t === 'grass' ? MM_COL.empty : (t.res > 0 ? MM_COL.res : MM_COL.used);
    g.globalAlpha = locked ? .25 : 1; g.fillStyle = col; g.fillRect(t.x * s + .5, t.y * s + .5, s - 1, s - 1);
  });
  g.globalAlpha = 1;
  // a warning mark on buildings that are closed for lack of workers (red) or have used up their resource (amber)
  g.font = 'bold ' + Math.round(s * 0.95) + 'px Lexend, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  Object.values(S.buildings).forEach(b => {
    const d = B[b.type]; if (!d.min) return;
    const bad = b._dead ? '#f2a33a' : !(b._eff > 0) ? '#ff4d3d' : null; if (!bad) return;
    const t = S.tiles[b.tiles[0]], cx = t.x * s + s / 2, cy = t.y * s + s / 2;
    g.fillStyle = bad; g.beginPath(); g.arc(cx, cy, s * 0.55, 0, 7); g.fill();
    g.fillStyle = '#fff'; g.fillText('!', cx, cy + 0.5);
  });
}
function buildLegend() {
  const items = [['Housing', 'housing'], ['Farms', 'agri'], ['Industry', 'industry'], ['Energy', 'energy'], ['Services', 'services'], ['Green', 'green'], ['Water', 'water'], ['Road', 'infra'], ['Resource', 'res'], ['Empty', 'empty']];
  $('legend').innerHTML = items.map(([n, k]) => '<span><i style="background:' + MM_COL[k] + '"></i>' + n + '</span>').join('') +
    '<span><i class="mmwarn">!</i>No workers</span><span><i class="mmwarn used">!</i>Used up</span>';
}

/* =========================================================
   Panels: plain numbers, red only when something is failing now
   ========================================================= */
const ICON = {
  pop: '<svg viewBox="0 0 24 24" width="20" fill="#7cc7ff"><circle cx="9" cy="8" r="3.5"/><circle cx="17" cy="9" r="2.6" opacity=".75"/><path d="M2.5 20c.6-4 3.2-6 6.5-6s5.9 2 6.5 6z"/><path d="M14.5 14.6c2.8-.3 5.6 1.2 6.5 5.4h-4.3" opacity=".75"/></svg>',
  home: '<svg viewBox="0 0 24 24" width="20" fill="#f28b6b"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/></svg>',
  food: '<svg viewBox="0 0 24 24" width="20" fill="#62d36c"><path d="M20 3C10 3 4 9 4 17c0 1 .1 2 .3 3C6 13 11 9 17 7c-5 3-9 7-11 13h2c3-7 12-8 12-17z"/></svg>',
  water: '<svg viewBox="0 0 24 24" width="20" fill="#3fb5f2"><path d="M12 2s7 8 7 13a7 7 0 0 1-14 0c0-5 7-13 7-13z"/></svg>',
  energy: '<svg viewBox="0 0 24 24" width="20" fill="#ffd23f"><path d="M13 2L4 14h7l-1 8 9-12h-7z"/></svg>',
  jobs: '<svg viewBox="0 0 24 24" width="20" fill="#b48cf2"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" fill="none" stroke="#b48cf2" stroke-width="2"/></svg>',
  money: '<svg viewBox="0 0 24 24" width="20"><circle cx="12" cy="12" r="10" fill="#f5c544"/><text x="12" y="16.5" text-anchor="middle" font-size="13" font-weight="700" fill="#6b4b00">₹</text></svg>',
  pol: '<svg viewBox="0 0 24 24" width="20" fill="#9aa3ad"><path d="M6 19a4 4 0 0 1-.6-8A6 6 0 0 1 17 9a4.5 4.5 0 0 1 1 9z"/></svg>',
  rain: '<svg viewBox="0 0 24 24" width="20" fill="#8fd0ff"><path d="M6 14a4 4 0 0 1-.6-8A6 6 0 0 1 17 4a4.5 4.5 0 0 1 1 9H6z"/><path d="M8 17l-1 3M12 17l-1 3M16 17l-1 3" stroke="#8fd0ff" stroke-width="2" stroke-linecap="round"/></svg>',
};
function statRow(icon, k, v, sub, bad) {
  return '<div class="stat' + (bad ? ' bad' : '') + '"><div class="ic">' + ICON[icon] + '</div><div class="k">' + k + '</div><div class="v num">' + v + '</div>' + (sub ? '<div class="note">' + sub + '</div>' : '') + '</div>';
}
function renderStats() {
  const o = E.outlook(S), f = o.f, r = o.rates; ui.flows = f; ui.rates = r;
  const foodNow = f.food + S.foodStore, waterNow = f.water + S.water * 0.1;
  const h = [];
  h.push(statRow('pop', 'People', fmt(S.pop), 'All ages together'));
  h.push('<div class="ages"><div><b class="num">' + fmt(S.kids) + '</b><span>Children<br>0–14</span></div><div class="work"><b class="num">' + fmt(S.adults) + '</b><span>Working age<br>15–59 · ' + fmt(f.workforce) + ' can work</span></div><div><b class="num">' + fmt(S.elders) + '</b><span>Elderly<br>60+</span></div></div>');
  const homeless = Math.max(0, S.pop - f.cap);
  h.push(statRow('home', 'Homes', fmt(f.cap), homeless ? fmt(homeless) + ' people in slums' : 'Places to live', homeless > 0));
  h.push(statRow('food', 'Food', fmt(f.food) + ' / yr', 'Grown a year · eaten ' + fmt(f.foodDemand) + (f.foodCap ? ' · stored ' + fmt(S.foodStore) : ''), foodNow < f.foodDemand));
  const rv = has3D ? R3.river() : { waste: 0, left: 0 };
  h.push(statRow('water', 'Water', fmt(f.water) + ' / yr', 'Used ' + fmt(f.waterDemand) + ' a year' + (rv.waste > 0.5 ? (rv.left > 0.02 ? ' · river dirty: ' + Math.round(rv.left * 100) + '% of factory waste untreated' : ' · river clean: all factory waste treated') : ''), waterNow < f.waterDemand));
  const rp = f.waterCap ? clamp(S.water / f.waterCap, 0, 1) : 0, rLow = rp < 0.2;
  h.push('<div class="stat res' + (rLow ? ' bad' : '') + '" title="Water stored in the reservoir"><div class="ic">' + ICON.water + '</div><div class="k">Reservoir</div><div class="v num">' + Math.round(rp * 100) + '%</div>' +
    '<div class="tankbar' + (rLow ? ' low' : '') + '" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.round(rp * 100) + '"><i style="width:' + (rp * 100).toFixed(1) + '%"></i><span>' + fmt(S.water) + ' of ' + fmt(f.waterCap) + '</span></div></div>');
  h.push(statRow('energy', 'Energy', fmt(f.gen) + ' / yr', 'Used ' + fmt(f.eDemand) + ' · ' + Math.round(f.cleanShare * 100) + '% clean', f.gen < f.eDemand));
  h.push(statRow('jobs', 'Jobs', fmt(f.jobs), 'Workers ' + fmt(f.workforce) + ' · ' + fmt(f.unemployed) + ' without work' + (f.unstaffed ? ' · ' + f.unstaffed + ' building' + (f.unstaffed > 1 ? 's' : '') + ' closed' : ''), f.unstaffed > 0 || (f.workforce && f.unemployed / f.workforce > 0.15)));
  if (S.hold > 0 && S.phase === 'plan') h.push('<button class="holdchip" id="holdBtn">' + fmt(S.hold) + ' free workers waiting · Assign them</button>');
  h.push(statRow('money', S.level === 1 ? 'Budget left' : 'Money', money(S.money), (f.net >= 0 ? '+' : '') + money(f.net) + ' a year after upkeep' + (f.net < 0 ? ': losing money hurts SDG 1, No Poverty' : ''), S.money < 0 || f.net < 0));
  h.push(statRow('pol', 'Pollution', Math.round(S.pollution) + '%', 'Air quality', S.pollution > 75));
  h.push(statRow('rain', 'Rain', Math.round(f.rain * 100) + '%', f.drought ? 'Drought: well below normal' : 'Of a normal monsoon', f.drought));
  $('statList').innerHTML = h.join('');
  const hb = $('holdBtn'); if (hb) hb.onclick = () => openRealloc(0, null);
  // top bar: births and deaths
  $('pulseB').textContent = r.per1000.births.toFixed(0);
  $('pulseD').textContent = r.per1000.deaths.toFixed(0);
  $('pulseT').textContent = r.tfr.toFixed(1);
}

/* News ticker (never tells you what to build) */
let newsIdx = 0, newsTimer = 0, newsLast = '';
function pickNews() {
  if (!S) return '';
  if (S._lastNews && S._lastNews.until > Date.now()) return S._lastNews.text;
  const sit = E.situations(S, ui.flows);
  if (has3D) { const rv = R3.river(); if (rv.waste * rv.left > 6) sit.unshift('dirty_river'); }
  const pool = [];
  sit.forEach(k => (C.news[k] || []).forEach(t => pool.push(t)));
  if (!pool.length) (C.news.idle || ['Quiet day on the island']).forEach(t => pool.push(t));
  newsIdx = (newsIdx + 1) % pool.length;
  let t = pool[newsIdx];
  if (t === newsLast && pool.length > 1) t = pool[(newsIdx + 1) % pool.length];
  newsLast = t;
  return t;
}
function renderNews(force) {
  if (!S) return;
  const el = $('newsLine');
  if (!force && el.textContent) return;
  el.classList.remove('in'); void el.offsetWidth;
  el.textContent = pickNews(); el.classList.add('in');
  $('newsDate').textContent = 'Year ' + S.year;
}
setInterval(() => { if (S && viewMode === 'plan') renderNews(true); }, 7000);

/* Inspector: building, upgrades, or a resource block */
function blockInfo(t) {
  const type = t.t, per = E.RES_PER_BLOCK[type];
  const fac = { coal: 'coalPlant', gold: 'goldFactory', uranium: 'nuclear', mineral: 'mineralMine' }[type];
  const d = B[fac];
  const years = d.use ? Math.round(t.res / d.use) : 0;
  const rows = [['Left in this block', fmt(t.res) + ' ' + E.UNIT[type] + (t.res < per ? ' (of ' + fmt(per) + ')' : '')]];
  if (d.gen) rows.push(['Energy per block', '+' + fmt(d.gen) + ' / yr']);
  if (d.econ) rows.push(['Income per block', '+' + money(d.econ) + ' / yr']);
  rows.push(['Workers per block', d.min + '–' + d.max]);
  if (d.pol) rows.push(['Pollution per block', '+' + (d.pol >= 10 ? Math.round(d.pol) : d.pol.toFixed(1)) + ' / yr']);
  rows.push(['Lasts', t.res > 0 ? 'about ' + years + ' years at full output' : 'used up']);
  return { name: E.labelFor(type).replace(/^./, c => c.toUpperCase()) + ' block', desc: 'Build a ' + d.name + ' on this block to use it. It can cover up to ' + d.maxBlocks + ' connected ' + E.labelFor(type) + ' blocks.', rows };
}
function renderInspector() {
  const el = $('inspector');
  const bd = ui.sel && S.buildings[ui.sel];
  if (!bd && ui.selTile >= 0) {
    const t = S.tiles[ui.selTile];
    if (t.dep && !t.b) {
      const info = blockInfo(t);
      el.innerHTML = '<h3>' + info.name + '</h3><p>' + info.desc + '</p><div class="kv">' + info.rows.map(r => '<span>' + r[0] + '</span><span class="num">' + r[1] + '</span>').join('') + '</div><div class="row2"><button class="btn ghost" id="closeIns">Close</button></div>';
      el.hidden = false; $('closeIns').onclick = () => { ui.selTile = -1; refresh(); };
      return;
    }
  }
  if (!bd) { el.hidden = true; return; }
  const d = B[bd.type];
  const rows = [];
  const n = d.perBlock ? bd.tiles.length : 1;
  if (d.min) rows.push(['Status', bd._dead ? 'Used up' : bd._eff > 0 ? 'Running at ' + Math.round(bd._eff * 100) + '%' : 'Closed: not enough workers']);
  if (d.min) rows.push(['Workers', fmt(bd._w || 0) + ' (needs ' + fmt(d.min * n) + '–' + fmt(d.max * n) + ')']);
  if (d.cap) rows.push(['Homes', fmt(d.cap) + ' people']);
  if (d.food) rows.push(['Food', '+' + fmt(d.food) + ' / yr at full staff']);
  if (d.gen) rows.push(['Energy', '+' + fmt(d.gen * n) + ' / yr at full staff']);
  if (d.econ) rows.push(['Income', '+' + money(d.econ * n) + ' / yr at full staff']);
  if (d.wR) rows.push(['Water to run', fmt(d.wR * n) + ' / yr']);
  if (d.pol && d.pol >= 1) rows.push(['Pollution', '+' + fmt(d.pol * n) + ' / yr']);
  if (d.absorb) rows.push(['Cleans', fmt(d.absorb) + ' pollution / yr']);
  if (d.maint) rows.push(['Upkeep', money(d.maint * n) + ' / yr']);
  if (bd._road) rows.push(['Road bonus', '+15% output']);
  let blocks = '';
  if (d.perBlock) {
    blocks = '<div class="blocks">' + bd.tiles.map(j => { const t = S.tiles[j]; const pct = t.resMax ? t.res / t.resMax : 0; return '<div class="blk' + (t.res <= 0 ? ' empty' : '') + '"><i style="height:' + Math.round(pct * 100) + '%"></i><span>' + (t.res > 0 ? fmt(t.res) : 'empty') + '</span></div>'; }).join('') + '<small>' + E.UNIT[d.on] + ' left per block</small></div>';
  }
  let staff = '';
  if (d.min && !bd.initial) staff = '<label for="wk" class="wkl">Most workers allowed: <b class="num" id="wkv">' + fmt(bd.workers) + '</b></label><input id="wk" type="range" min="' + d.min * n + '" max="' + d.max * n + '" step="' + (d.max * n <= 20 ? 1 : E.K) + '" value="' + bd.workers + '">';
  // upgrade cards (Clash of Clans style)
  const ups = E.upgradeOptions(S, bd.id);
  const upHtml = ups.map(u => {
    if (u.kind === 'block') {
      const lvl = u.level, next = Math.min(u.max, lvl + 1);
      const g = u.gain || {};
      const gains = [g.gen ? '+' + fmt(g.gen) + ' energy' : '', g.econ ? '+' + money(g.econ) + '/yr' : '', g.jobs ? '+' + fmt(g.jobs) + ' jobs' : '', g.pol >= 1 ? '+' + fmt(g.pol) + ' pollution' : ''].filter(Boolean).join(' · ');
      return '<div class="upcard' + (u.ok ? '' : ' off') + '"><div class="uphead"><span class="lvl">Lv ' + lvl + '</span><svg viewBox="0 0 24 24" width="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg><span class="lvl next">' + (lvl >= u.max ? 'MAX' : 'Lv ' + next) + '</span><b>Expand onto the next ' + E.labelFor(d.on) + ' block</b></div>' +
        (lvl < u.max ? '<div class="upgain">' + gains + '</div>' : '') + (u.ok ? '<button class="btn upbtn" data-up="block">Upgrade · ' + money(u.cost) + '</button>' : '<div class="upwhy">' + escapeHtml(u.why || '') + '</div>') + '</div>';
    }
    const g = u.gain || {};
    return '<div class="upcard' + (u.ok ? '' : ' off') + (u.done ? ' done' : '') + '"><div class="uphead">' + (u.done ? '<span class="tick">✓</span>' : '') + '<b>' + u.name + '</b></div><div class="upgain">' + (g.gen ? '+' + fmt(g.gen) + ' clean energy / yr' : '+' + fmt(g.water) + ' water / yr in a normal monsoon') + '</div>' +
      (u.done ? '<div class="upwhy">Installed</div>' : u.ok ? '<button class="btn upbtn" data-up="' + u.kind + '">Install · ' + money(u.cost) + '</button>' : '<div class="upwhy">' + escapeHtml(u.why || '') + '</div>') + '</div>';
  }).join('');
  el.innerHTML = '<h3>' + d.name + (d.perBlock ? ' <small class="lv">Level ' + n + ' of ' + d.maxBlocks + '</small>' : '') + '</h3><p>' + d.desc + '</p><div class="kv">' + rows.map(r => '<span>' + r[0] + '</span><span class="num">' + r[1] + '</span>').join('') + '</div>' + blocks + staff +
    (upHtml ? '<div class="ups">' + upHtml + '</div>' : '') +
    '<div class="row2"><button class="btn danger" id="demo">Demolish</button><button class="btn ghost" id="closeIns">Close</button></div>';
  el.hidden = false;
  const wk = $('wk');
  if (wk) wk.oninput = () => { bd.workers = +wk.value; $('wkv').textContent = fmt(+wk.value); refresh(false, true); persist(); };
  $('closeIns').onclick = () => { ui.sel = null; if (has3D) R3.select(null); refresh(); };
  $('demo').onclick = () => { const bt = bd.tiles.slice(); const freed = bd._w || 0; E.demolish(S, bd.id); ui.sel = null; if (has3D) { R3.select(null); R3.puff(bt); } toast(d.name + ' demolished. Water and money spent are not returned.'); afterDemolish(freed, d.name); };
  el.querySelectorAll('[data-up]').forEach(b => b.onclick = () => {
    const kind = b.dataset.up, res = E.upgrade(S, bd.id, kind);
    if (!res.ok) { toast(res.why); return; }
    const card = b.closest('.upcard'); if (card) card.classList.add('flash');
    if (has3D) R3.puff(S.buildings[bd.id].tiles);
    floatText(S.buildings[bd.id].tiles, kind === 'block' ? 'Upgraded to level ' + S.buildings[bd.id].tiles.length : (kind === 'solar' ? 'Rooftop solar installed' : 'Rainwater harvesting installed'), '−' + money(res.cost));
    setTimeout(() => { refresh(); persist(); }, 380);
  });
}

/* Workers freed by a demolition wait for the player to place them */
function afterDemolish(freed, name) {
  if (freed > 0 && S.phase === 'plan') { S.hold = (S.hold || 0) + freed; refresh(); persist(); openRealloc(freed, name); }
  else { refresh(); persist(); }
}
let ra = null;
function openRealloc(freed, name) {
  E.flows(S); // current staffing (held workers excluded)
  const cands = Object.values(S.buildings).filter(b => B[b.type].min && !b._dead).map(b => {
    const d = B[b.type], n = d.perBlock ? b.tiles.length : 1;
    return { b, mn: d.min * n, mx: d.max * n, w: b._w || 0, add: 0, step: d.max * n <= 20 ? 1 : E.K };
  }).filter(c => c.w < c.mx).sort((a, b) => (a.w > 0) - (b.w > 0) || (a.w / a.mx) - (b.w / b.mx));
  ra = { pool: S.hold || 0, cands };
  $('raTitle').textContent = freed ? fmt(freed) + ' workers lost their jobs' : 'Free workers';
  $('raLead').textContent = (name ? 'They worked at the ' + name + ' you demolished. ' : '') + 'Choose which buildings they join. Buildings marked Closed need their minimum before they open. Anyone you do not place stays without work until you assign them.';
  renderRealloc();
  $('reallocScreen').hidden = false;
}
function renderRealloc() {
  $('raPool').textContent = fmt(ra.pool);
  $('raList').innerHTML = ra.cands.length ? ra.cands.map((c, k) => {
    const now = c.w + c.add, closed = now < c.mn;
    const canAdd = ra.pool > 0 && now < c.mx && (now >= c.mn || ra.pool >= c.mn - now);
    return '<div class="rarow' + (c.w === 0 ? ' closed' : '') + '" data-k="' + k + '"><div><b>' + B[c.b.type].name + '</b><small>' + (c.w === 0 ? 'Closed · needs ' + fmt(c.mn) + ' to open' : fmt(c.w) + ' working · room for ' + fmt(c.mx - c.w) + ' more') + (closed && c.add ? ' · still closed' : '') + '</small></div>' +
      '<button data-a="-" aria-label="Fewer"' + (c.add ? '' : ' disabled') + '>−</button><span class="add num">' + (c.add ? '+' + fmt(c.add) : '0') + '</span><button data-a="+" aria-label="More"' + (canAdd ? '' : ' disabled') + '>+</button></div>';
  }).join('') : '<p class="lead">Every building already has as many workers as it can take. These people will stay without work until you build something that needs them.</p>';
}
$('raList').addEventListener('click', e => {
  const btn = e.target.closest('[data-a]'), row = e.target.closest('[data-k]'); if (!row) return;
  const c = ra.cands[+row.dataset.k];
  if (has3D) R3.select(c.b.id);
  if (!btn) return;
  const now = c.w + c.add;
  if (btn.dataset.a === '+') { const want = now < c.mn ? c.mn - now : Math.min(c.step, c.mx - now); const g = Math.min(want, ra.pool); if (now + g < c.mn) return; c.add += g; ra.pool -= g; }
  else { const back = (c.w + c.add - c.step < c.mn) ? c.add : Math.min(c.step, c.add); c.add -= back; ra.pool += back; }
  renderRealloc();
});
function closeRealloc(auto) {
  if (!ra) return;
  if (auto) S.hold = 0;
  else {
    ra.cands.forEach(c => { if (c.add > 0) { c.b.pin = c.w + c.add; c.b.workers = Math.max(c.b.workers, c.b.pin); } });
    S.hold = ra.pool;
  }
  ra = null; $('reallocScreen').hidden = true; if (has3D) R3.select(null);
  refresh(); persist();
  toast(auto ? 'The city has given the free workers jobs where they were needed most.' : 'Workers placed.' + (S.hold ? ' ' + fmt(S.hold) + ' are still waiting for work.' : ''));
}
$('raDone').onclick = () => closeRealloc(false);
$('raAuto').onclick = () => closeRealloc(true);

/* Build bar */
// grouped by what each building does, not by the level it unlocks in
const TABS = [
  ['agri', 'Food', ['foodFarm', 'cashFarm', 'granary']],
  ['energy', 'Energy', ['coalPlant', 'nuclear', 'solar', 'wind', 'dam', 'battery']],
  ['industry', 'Industry & jobs', ['goldFactory', 'mineralMine', 'itPark']],
  ['housing', 'Housing', ['house', 'community', 'apartment']],
  ['services', 'Services', ['school', 'hospital', 'waterPlant', 'recycling']],
  ['infra', 'Roads', ['road']],
  ['green', 'Green', ['park', 'forest']],
  ['tools', 'Inspect & demolish', ['inspect', 'demolish']],
];
function l1Left(type) { const c = E.L1_CAPS[type]; if (!c || S.level !== 1) return null; return Math.max(0, c.n - Object.values(S.buildings).filter(b => b.type === type).length); }
function priceText(type) {
  const d = B[type], c = E.L1_CAPS[type], left = l1Left(type);
  const base = S.level === 1 && E.L1_FREE && type in { foodFarm: 1, cashFarm: 1 } ? 'Free' : money(d.cost) + (d.perBlock ? '/block' : '');
  return left == null ? base : base + ' · ' + left + ' left';
}
const previews = {};
function chips(type) {
  const d = B[type], c = [], pb = d.perBlock ? ' per block' : '';
  if (d.cap) c.push('<em>' + fmt(d.cap) + '</em> homes');
  if (d.food) c.push('<em>+' + fmt(d.food) + '</em> food');
  if (d.gen) c.push('<em>+' + fmt(d.gen) + '</em> energy' + pb);
  if (d.econ) c.push('<em>+' + money(d.econ) + '</em>/yr' + pb);
  if (d.waterIn) c.push('<em>+' + fmt(d.waterIn) + '</em> water');
  if (d.wR) c.push('−' + fmt(d.wR) + ' water');
  if (d.pol >= 1) c.push('+' + fmt(d.pol) + ' pollution');
  if (d.absorb) c.push('<em>−' + fmt(d.absorb) + '</em> pollution');
  if (d.edu) c.push('teaches ' + fmt(d.edu));
  if (d.health) c.push('cares for ' + fmt(d.health));
  if (d.foodCap) c.push('stores ' + fmt(d.foodCap) + ' food');
  if (d.firmFor) c.push('steadies 4 solar/wind');
  if (type === 'road') c.push('+15% to neighbours');
  // workers always first, so teams know who each building needs
  return (d.min ? '<b class="wk">' + fmt(d.min) + '–' + fmt(d.max) + ' workers</b>' : '<b class="wk">No workers needed</b>') + c.slice(0, 2).map(x => '<br>' + x).join('');
}
// full details of a card, shown in the strip above the cards (hover or selected)
function cardInfo(type) {
  if (type === 'inspect') return '<b>Inspect</b> Click any building to see its workers, output and upgrades, or a resource block to see what is left in it. Esc to stop.';
  if (type === 'demolish') return '<b>Demolish</b> Click a building to remove it. Money and water spent are not returned; its workers wait for you to place them.';
  const d = B[type], pb = d.perBlock ? ' per block' : '', c = [];
  c.push(d.min ? fmt(d.min) + '–' + fmt(d.max) + ' workers' + pb : 'no workers needed');
  if (d.cap) c.push(fmt(d.cap) + ' homes'); if (d.food) c.push('+' + fmt(d.food) + ' food/yr'); if (d.gen) c.push('+' + fmt(d.gen) + ' energy/yr' + pb);
  if (d.econ) c.push('+' + money(d.econ) + '/yr' + pb); if (d.waterIn) c.push('+' + fmt(d.waterIn) + ' water/yr'); if (d.wR) c.push('uses ' + fmt(d.wR) + ' water/yr');
  if (d.energy) c.push('uses ' + fmt(d.energy) + ' energy/yr'); if (d.pol >= 1) c.push('+' + fmt(d.pol) + ' pollution/yr' + pb); if (d.absorb) c.push('cleans ' + fmt(d.absorb) + ' pollution/yr');
  if (d.edu) c.push('teaches ' + fmt(d.edu)); if (d.health) c.push('cares for ' + fmt(d.health)); if (d.foodCap) c.push('stores ' + fmt(d.foodCap) + ' food');
  if (d.maint) c.push('upkeep ' + money(d.maint) + '/yr' + pb);
  const lock = d.lvl > S.level ? ' <span class="lk">Unlocks in Level ' + d.lvl + '</span>' : '';
  return '<b>' + d.name + '</b>' + lock + ' <span class="pr">' + priceText(type) + '</span> ' + escapeHtml(d.desc) + '<br><span class="facts">' + c.join(' · ') + '</span>';
}
function showCardInfo(type) {
  const el = $('cardInfo'); const t = type;
  if (!t || viewMode !== 'plan') { el.hidden = true; return; }
  el.innerHTML = cardInfo(t); el.hidden = false;
  // sit just above the tabs, whatever the screen height
  const app = $('app').getBoundingClientRect(), bt = $('tabs').getBoundingClientRect();
  el.style.bottom = Math.round(app.bottom - bt.top + 6) + 'px';
}
function renderTabs() { $('tabs').innerHTML = TABS.map(([k, n]) => '<button role="tab" data-tab="' + k + '" aria-selected="' + (ui.tab === k) + '">' + n + '</button>').join(''); }
function renderCards() {
  const tab = TABS.find(t => t[0] === ui.tab);
  const html = [];
  tab[2].forEach(type => {
    if (type === 'inspect' || type === 'demolish') {
      html.push('<button class="card tool' + type + '" data-type="' + type + '" aria-pressed="' + (ui.tool === type) + '"><div class="thumb tool">' + (type === 'inspect' ? '<svg viewBox="0 0 24 24" width="34" fill="none" stroke="currentColor" stroke-width="2"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21" stroke-linecap="round"/></svg>' : '<svg viewBox="0 0 24 24" width="34" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20h16M6 20V9l6-4 6 4v11" /><path d="M3 3l18 18" stroke="#ef5b4c" stroke-linecap="round"/></svg>') + '</div><div class="nm">' + (type === 'inspect' ? 'Inspect' : 'Demolish') + '</div><div class="ch">' + (type === 'inspect' ? 'Click a building: workers, output, upgrades' : 'Remove a building. Nothing is refunded.') + '</div></button>');
      return;
    }
    const d = B[type], locked = d.lvl > S.level;
    const price = priceText(type);
    html.push('<button class="card' + (locked ? ' locked' : '') + '" data-type="' + type + '" data-lock="Level ' + d.lvl + '" aria-pressed="' + (ui.tool === type) + '" title="' + d.desc.replace(/"/g, '') + '"><span class="pv" data-pv="' + type + '"></span><div class="nm">' + d.name + '</div><div class="pr">' + (locked ? 'Unlocks in Level ' + d.lvl : price) + '</div><div class="ch">' + chips(type) + '</div></button>');
  });
  $('cards').innerHTML = html.join('');
  showCardInfo(null);
  $('cards').querySelectorAll('[data-pv]').forEach(sp => { const t = sp.dataset.pv; if (previews[t] === undefined) previews[t] = has3D ? R3.thumb(t) : null; const im = document.createElement('img'); im.alt = ''; im.className = 'thumb'; if (previews[t]) im.src = previews[t]; sp.replaceWith(im); });
  renderPicker();
}
/* Factory size and path picker */
function renderPicker() {
  const el = $('fpick');
  const d = ui.tool && B[ui.tool];
  if (!d || !d.perBlock || viewMode !== 'plan') { el.hidden = true; return; }
  el.hidden = false;
  const i = ui.hover;
  const onRes = i >= 0 && S.tiles[i].t === d.on;
  const maxHere = onRes ? E.maxPathSize(S, ui.tool, i) : d.maxBlocks;
  const paths = onRes ? E.factoryPaths(S, ui.tool, i, ui.size) : [];
  $('fpSizes').innerHTML = Array.from({ length: d.maxBlocks }, (_, k) => k + 1).map(n => '<button data-size="' + n + '" aria-pressed="' + (ui.size === n) + '"' + (onRes && n > maxHere ? ' disabled' : '') + '>' + n + '</button>').join('');
  $('fpPath').textContent = onRes ? (paths.length ? 'Path ' + ((ui.path % paths.length) + 1) + ' of ' + paths.length : 'No room') : 'Point at a ' + E.labelFor(d.on) + ' block';
  $('fpNext').disabled = !(paths.length > 1);
  $('fpCost').textContent = money(d.cost * ui.size) + (S.level === 1 && E.L1_CAPS[ui.tool] && E.L1_CAPS[ui.tool].blocks ? ' · Level 1: max ' + E.L1_CAPS[ui.tool].blocks + ' blocks' : '');
}
$('fpSizes').addEventListener('click', e => { const b = e.target.closest('[data-size]'); if (!b) return; ui.size = +b.dataset.size; ui.path = 0; renderPicker(); setHover(ui.hover); });
$('fpNext').onclick = () => { ui.path++; renderPicker(); setHover(ui.hover); };

function renderTop() {
  const L = E.LEVELS[S.level];
  $('lvlBadge').textContent = S.level;
  $('lvlTitle').textContent = 'Level ' + S.level + ': ' + L.title;
  $('lvlSub').textContent = L.sub;
  $('clockY').textContent = 'City year ' + S.year;
  renderDayTime();
  $('finishLabel').textContent = S.level < 3 ? 'Finish Level ' + S.level : 'Submit city';
  $('finishSub').textContent = S.level === 1 ? 'Then ' + S.cfg.jump + ' years pass' : S.level === 2 ? 'Then 50 years pass' : 'Run to year ' + E.CAP_YEARS;
}

function refresh(full, keepInspector) {
  if (!S) return;
  renderStats(); if (!keepInspector) renderInspector(); renderMinimap(); renderTop(); renderNews(false);
  if (has3D) R3.sync(S, ui.flows, true);
  if (full) renderTabs();
  if (!keepInspector) renderCards();
}

/* =========================================================
   Input
   ========================================================= */
let drag = null;
const isBuildTool = t => t && t !== 'inspect' && t !== 'demolish';
function placeOpts() { return { size: ui.size, path: ui.path }; }
function setHover(i) {
  const changed = ui.hover !== i;
  ui.hover = i;
  if (!has3D || !S || S.phase !== 'plan') return;
  const tool = ui.tool;
  if (i >= 0 && isBuildTool(tool)) { const r = E.canPlace(S, tool, i, placeOpts()); R3.hover(i, tool, r.ok, r.ok ? r.fp : E.footprint(S, tool, i, placeOpts())); }
  else R3.hover(i, tool, false, []);
  if (changed && B[tool] && B[tool].perBlock) renderPicker();
}
cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); drag = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, btn: e.button, moved: false }; });
cv.addEventListener('pointermove', e => {
  const r = cv.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
  if (drag) {
    if (Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) > 6) drag.moved = true;
    if (drag.moved && has3D) { const dx = e.clientX - drag.lx, dy = e.clientY - drag.ly; if (drag.btn === 2 || e.shiftKey) R3.rotate(-dx * 0.006, dy * 0.004); else R3.pan(dx, dy); }
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
  if (d.btn === 2) { ui.tool = null; R3.grid(false); setHover(-1); renderCards(); markResources(); renderMode(); $('tip').hidden = true; return; }
  const r = cv.getBoundingClientRect(); const i = R3.pick(e.clientX - r.left, e.clientY - r.top);
  if (i < 0) return;
  clickTile(i);
});
cv.addEventListener('contextmenu', e => e.preventDefault());
cv.addEventListener('wheel', e => { e.preventDefault(); if (!has3D) return; const r = cv.getBoundingClientRect(); R3.zoom(e.deltaY < 0 ? 0.88 : 1 / 0.88, e.clientX - r.left, e.clientY - r.top); }, { passive: false });
window.addEventListener('keydown', e => {
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
  if (e.key === 'Escape' && ra) { closeRealloc(true); return; }
  if (e.key === 'Escape') { setTimeout(() => { markResources(); renderMode(); showCardInfo(null); }, 0); }
  if (e.key === 'Escape') { ui.tool = null; ui.sel = null; ui.selTile = -1; if (has3D) { R3.grid(false); R3.select(null); } if (S) refresh(); }
  if (!has3D || viewMode !== 'plan') return;
  const k = e.key.toLowerCase();
  if (B[ui.tool] && B[ui.tool].perBlock) {
    if (k === 'r' || k === 'tab') { e.preventDefault(); $('fpNext').click(); return; }
    if (k >= '1' && k <= '4' && +k <= B[ui.tool].maxBlocks) { ui.size = +k; ui.path = 0; renderPicker(); setHover(ui.hover); return; }
  }
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
  if (!ui.tool || ui.tool === 'inspect') {
    const inLand = E.inLevel(S.level, t.x, t.y);
    ui.sel = t.b && inLand ? t.b : null;
    ui.selTile = !t.b && t.dep ? i : -1;
    if (has3D) R3.select(ui.sel);
    refresh(); return;
  }
  if (ui.tool === 'demolish') {
    if (t.b) { const bt = S.buildings[t.b].tiles.slice(); const n = B[S.buildings[t.b].type].name; const freed = S.buildings[t.b]._w || 0; E.demolish(S, t.b); ui.sel = null; if (has3D) R3.puff(bt); toast(n + ' demolished.'); afterDemolish(freed, n); }
    return;
  }
  const r = E.build(S, ui.tool, i, placeOpts());
  if (!r.ok) { toast(r.why); return; }
  ui.sel = null; ui.path = 0;
  const placed = S.buildings[r.id];
  refresh(); persist();
  floatText(placed.tiles, effectLine(placed), r.cost ? '−' + money(r.cost) : '');
  markResources(); renderCards();
  setHover(i);
  guideEvent('built', placed.type);
}
function effectLine(b) {
  const d = B[b.type], o = [], n = d.perBlock ? b.tiles.length : 1;
  if (d.cap) o.push('+' + fmt(d.cap) + ' homes'); if (d.food) o.push('+' + fmt(d.food) + ' food'); if (d.gen) o.push('+' + fmt(d.gen * n) + ' energy');
  if (d.econ) o.push('+' + money(d.econ * n) + '/yr'); if (d.waterIn) o.push('+' + fmt(d.waterIn) + ' water'); if (d.absorb) o.push('−' + fmt(d.absorb) + ' pollution');
  if (d.edu) o.push('teaches ' + fmt(d.edu)); if (d.health) o.push('cares for ' + fmt(d.health)); if (d.foodCap) o.push('stores ' + fmt(d.foodCap) + ' food');
  if (d.pol && d.pol * n >= 10) o.push('+' + fmt(d.pol * n) + ' pollution');
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
  else if (isBuildTool(ui.tool)) { const r = E.canPlace(S, ui.tool, ui.hover, placeOpts()); text = r.ok ? B[ui.tool].name + (r.fp.length > 1 ? ' · ' + r.fp.length + ' blocks' : '') + (r.cost ? ' · ' + money(r.cost) : '') + (r.wB ? ' · ' + fmt(r.wB) + ' water' : '') : r.why; }
  else if (t.b) { const bd = S.buildings[t.b]; text = B[bd.type].name + (B[bd.type].min ? (bd._dead ? ' · used up' : bd._eff > 0 ? ' · running ' + Math.round(bd._eff * 100) + '%' : ' · closed: no workers') : ''); }
  else if (t.dep) text = E.labelFor(t.t).replace(/^./, c => c.toUpperCase()) + ' block · ' + fmt(t.res) + ' ' + E.UNIT[t.t] + ' left · click for details';
  else if (t.t === 'river') text = 'River: your water. Dams and bridges go here.';
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
  ui.size = 1; ui.path = 0;
  if (isBuildTool(ui.tool)) { ui.sel = null; ui.selTile = -1; if (has3D) R3.select(null); }
  if (has3D) R3.grid(isBuildTool(ui.tool));
  renderCards(); renderInspector(); setHover(ui.hover);
  markResources(); renderMode();
  guideEvent('tool', type);
});
$('cards').addEventListener('mouseover', e => { const c = e.target.closest('[data-type]'); if (c) showCardInfo(c.dataset.type); });
$('cards').addEventListener('mouseleave', () => showCardInfo(null));
// a factory tool marks every free block of its resource on your land with a red box
function markResources() {
  if (!has3D) return;
  const d = ui.tool && B[ui.tool];
  if (!d || !d.on || d.on === 'river') { R3.marks([]); return; }
  R3.marks(S.tiles.map((t, i) => i).filter(i => { const t = S.tiles[i]; return t.t === d.on && !t.b && t.res > 0 && E.inLevel(S.level, t.x, t.y); }));
}
// what the current tool does, in plain words, at the top of the map
function renderMode() {
  const el = $('modeBar'), t = ui.tool;
  if (!t || viewMode !== 'plan') { el.hidden = true; return; }
  const d = B[t];
  el.innerHTML = t === 'inspect' ? '<b>Inspect</b> Click any building to see its workers, output and upgrades. Click a resource block to see what is left. <kbd>Esc</kbd> to stop.'
    : t === 'demolish' ? '<b>Demolish</b> Click a building to remove it. Nothing is refunded. <kbd>Esc</kbd> to stop.'
    : '<b>Building: ' + d.name + '</b> ' + (d.on && d.on !== 'river' ? 'Click a ' + E.labelFor(d.on) + ' block (marked in red).' : d.on === 'river' ? 'Click a river block.' : 'Click an empty block on your land.') + ' Needs ' + (d.min ? fmt(d.min) + '–' + fmt(d.max) + ' workers' + (d.perBlock ? ' per block' : '') : 'no workers') + '. <kbd>Esc</kbd> or right-click to stop.';
  el.hidden = false;
}
$('minimap').addEventListener('click', e => { const r = e.target.getBoundingClientRect(), sc = r.width / W; if (has3D) R3.lookTile(Math.floor((e.clientX - r.left) / sc), Math.floor((e.clientY - r.top) / sc)); });

let toastT = 0;
function toast(msg) { const t = $('toast'); t.textContent = msg; t.hidden = false; t.style.opacity = 1; clearTimeout(toastT); toastT = setTimeout(() => { t.style.opacity = 0; setTimeout(() => t.hidden = true, 300); }, 2800); }

/* =========================================================
   Guided start (Level 1, skippable)
   ========================================================= */
let guide = null;
function startGuide() {
  if (!C.tutorial || !C.tutorial.length) return;
  guide = { step: 0 };
  showGuideStep();
}
function guideTarget(name) { return { 'build-bar': $('build'), map: $('map'), stats: $('stats'), finish: $('finishBtn') }[name] || $('build'); }
function showGuideStep() {
  const box = $('guide');
  document.querySelectorAll('.guide-hl').forEach(e => e.classList.remove('guide-hl'));
  if (!guide || guide.step >= C.tutorial.length) { box.hidden = true; guide = null; return; }
  const st = C.tutorial[guide.step];
  $('guideN').textContent = (guide.step + 1) + ' / ' + C.tutorial.length;
  $('guideT').textContent = st.title; $('guideX').textContent = st.text;
  $('guideNext').textContent = guide.step === C.tutorial.length - 1 ? 'Let\'s play' : 'Next';
  box.hidden = false;
  const tgt = guideTarget(st.target); if (tgt && st.target !== 'map') tgt.classList.add('guide-hl');
  box.dataset.at = st.target;
}
function guideEvent(kind, type) {
  if (!guide) return;
  if (guide.step === 0 && kind === 'tool' && type === 'foodFarm') { guide.step = 1; showGuideStep(); }
  else if (guide.step === 1 && kind === 'built') { guide.step = 2; showGuideStep(); }
}
$('guideNext').onclick = () => { if (!guide) return; guide.step++; showGuideStep(); };
$('guideSkip').onclick = () => { guide = null; showGuideStep(); };

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
function renderDayTime() {
  if (!has3D || !S) return;
  const d = R3.dayInfo(), el = $('dayTime');
  el.innerHTML = (d.night ? '<svg viewBox="0 0 24 24" width="14" fill="#c9d6ff"><path d="M20 15A8 8 0 0 1 9 4a8 8 0 1 0 11 11z"/></svg>' : '<svg viewBox="0 0 24 24" width="14" fill="#ffd23f"><circle cx="12" cy="12" r="5"/><g stroke="#ffd23f" stroke-width="2" stroke-linecap="round"><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></g></svg>') + '<span>' + d.label + ' · ' + d.text + '</span>';
}
setInterval(renderDayTime, 1000);

function confirmBox(title, text, yes, onYes) {
  $('cfTitle').textContent = title; $('cfText').textContent = text; $('cfYes').textContent = yes;
  $('confirmScreen').hidden = false;
  $('cfYes').onclick = () => { $('confirmScreen').hidden = true; onYes(); };
  $('cfNo').onclick = () => { $('confirmScreen').hidden = true; };
}
function closeAll() { ['confirmScreen', 'rulesScreen', 'pinScreen', 'sdgScreen'].forEach(id => $(id).hidden = true); guide = null; showGuideStep(); }
$('finishBtn').onclick = () => {
  if (!S || S.phase !== 'plan') return;
  const msg = S.level === 1 ? S.cfg.jump + ' years will pass. Couples will have their children whether or not there is food for them; if there is not, people starve. Money left over and earned is saved for Level 2.'
    : S.level === 2 ? '50 years will pass, with a stop every 10 years for something your city must deal with. You cannot build during the jump.'
    : 'Your city will run on its own to year ' + E.CAP_YEARS + ', with a few big moments to decide. You cannot build after this. Your result goes to the organisers.';
  confirmBox(S.level < 3 ? 'Finish Level ' + S.level + '?' : 'Submit your city?', msg, S.level < 3 ? 'Finish level' : 'Submit city', finishLevel);
};
function finishLevel() {
  if (S.phase !== 'plan') return;
  if (ra) closeRealloc(true);
  S.hold = 0;
  sheetSend({ action: 'update', id: S.gameId, status: 'Playing', level: S.level < 3 ? 'Time jump after L' + S.level : 'Final run', year: S.year });
  ui.tool = null; ui.sel = null; ui.selTile = -1; guide = null; showGuideStep(); $('fpick').hidden = true;
  if (has3D) R3.marks([]); $('modeBar').hidden = true;
  E.beginEra(S, S.level, S.level === 1 ? S.cfg.jump : S.level === 2 ? 50 : E.CAP_YEARS - S.year);
  if (S.level === 1) runSim({ years: S.cfg.jump, mode: 'grow', title: 'Level 1 → Level 2', lead: S.cfg.jump + ' years pass. Couples start their families.', next: () => goLevel(2) });
  else if (S.level === 2) { S.jumpStart = S.year; runSim({ years: 50, mode: 'dyn', phase: 'jump2', title: 'Level 2 → Level 3', lead: '50 years pass, with six stops for crises and decisions.', next: () => goLevel(3) }); }
  else { S.finalStart = S.year; runSim({ years: E.CAP_YEARS - S.year, mode: 'dyn', phase: 'final', final: true, title: 'The city runs on its own', lead: 'No more building. Will your city still stand in year ' + E.CAP_YEARS + '?', next: showResult }); }
}
function goLevel(l) {
  E.startLevel(S, l);
  sheetSend({ action: 'update', id: S.gameId, status: 'Playing', level: 'Level ' + l, year: S.year });
  S.deadline = Date.now() + levelMinutes(l) * 60000;
  ui.tab = l === 2 ? 'housing' : 'services';
  setView('plan'); if (has3D) R3.orbit(false);
  refresh(true); persist(); centerCam(false);
  renderNews(true);
  toast('Level ' + l + ': the land has grown to ' + E.LEVELS[l].size + '×' + E.LEVELS[l].size + '.');
}

/* Time jumps, with checkpoint events */
let simCtl = null;
function runSim(opt) {
  S.phase = 'sim'; S.simOpt = { years: opt.years, mode: opt.mode, phase: opt.phase || null, final: !!opt.final, startYear: S.year, target: S.year + opt.years };
  E.resetTally(S); persist();
  const startYear = S.year, logFrom = S.log.length, hist0 = S.history.length;
  const pauses = opt.phase ? E.pausesFor(S, opt.phase).filter(p => p.year >= S.year && p.year < S.year + opt.years) : [];
  $('simTitle').textContent = opt.title; $('simLead').textContent = opt.lead;
  $('simNext').hidden = true; $('simSkip').hidden = false; $('simLog').innerHTML = '';
  $('simScreen').hidden = false; $('tip').hidden = true;
  if (has3D) { R3.grid(false); R3.select(null); R3.hover(-1, null, false, []); }
  setView('sim'); if (has3D) R3.orbit(true);
  let done = 0, fast = false, paused = false, lastLogged = logFrom, acc = 0;
  const perFrame = () => fast ? 1e9 : opt.final ? 1.4 : opt.years > 20 ? 0.32 : 0.12;
  simCtl = { skip: () => { fast = true; } };
  function frame() {
    if (paused) return;
    acc += perFrame();
    while (acc >= 1 && done < opt.years && !S.dead) {
      const p = pauses.find(p => p.year === S.year && !S.eventsDone.some(e => e.year === S.year && e.id === p.eventId));
      if (p) { paused = true; acc = 0; fast = false; showEvent(p, opt, () => { paused = false; requestAnimationFrame(frame); }); break; }
      acc -= 1;
      E.step(S, opt.mode); done++;
    }
    if (paused) { drawSim(opt, startYear); return; }
    drawSim(opt, startYear);
    if (has3D) R3.sync(S, E.flows(S), false);
    if (S.log.length > lastLogged) { $('simLog').innerHTML = S.log.slice(logFrom).slice(-40).reverse().map(l => '<div><b>Year ' + l.year + '</b>' + escapeHtml(l.text) + '</div>').join(''); lastLogged = S.log.length; }
    if (done < opt.years && !S.dead) { requestAnimationFrame(frame); return; }
    // finished
    if (S.dead) S.log.push({ year: S.dead.year, text: 'Declared a dead planet. ' + S.dead.text });
    $('simLog').innerHTML = S.log.slice(logFrom).slice(-40).reverse().map(l => '<div><b>Year ' + l.year + '</b>' + escapeHtml(l.text) + '</div>').join('');
    drawSim(opt, startYear);
    $('simSkip').hidden = true; $('simNext').hidden = false;
    $('simNext').textContent = 'What happened';
    if (has3D) R3.orbit(false);
    S.phase = 'between'; persist();
    $('simNext').onclick = () => { $('simScreen').hidden = true; showWhat(opt, startYear); };
  }
  requestAnimationFrame(frame);
}
$('simSkip').onclick = () => simCtl && simCtl.skip();

function drawSim(opt, y0) {
  $('simYear').textContent = 'Year ' + S.year;
  $('simSub').textContent = opt.final ? 'of ' + E.CAP_YEARS : '(from year ' + y0 + ')';
  const last = S.history[S.history.length - 1] || { pop: S.pop, money: S.money, pollution: S.pollution, births: 0, deaths: 0 };
  const per = n => last.pop ? (n / last.pop * 1000).toFixed(0) : '0';
  $('simStats').innerHTML = [['People', fmt(last.pop), '#7cc7ff'], ['Births / deaths', per(last.births) + ' / ' + per(last.deaths) + ' per 1,000', '#e9f4f1'], ['Money', money(last.money), last.money >= 0 ? '#f5c544' : '#ef5b4c'], ['Pollution', Math.round(last.pollution) + '%', last.pollution > 60 ? '#ef5b4c' : '#c08cf0']]
    .map(([k, v, c]) => '<div><small>' + k + '</small><b class="num" style="color:' + c + '">' + v + '</b></div>').join('');
  const c = $('chart'), g = c.getContext('2d'), w = c.width, h = c.height, pad = 30;
  g.clearRect(0, 0, w, h);
  const all = S.history;
  if (!all.length) return;
  const x0 = all[0].year - 1, x1 = Math.max(opt.final ? E.CAP_YEARS : y0 + opt.years, all[all.length - 1].year);
  const X = yr => pad + (w - pad * 2) * (yr - x0) / Math.max(1, x1 - x0);
  g.fillStyle = 'rgba(242,163,58,.22)';
  all.forEach(r => { if (r.drought) g.fillRect(X(r.year - 1), pad, Math.max(2, X(r.year) - X(r.year - 1)), h - pad * 2); });
  g.strokeStyle = 'rgba(150,205,225,.12)'; g.lineWidth = 2;
  for (let k = 0; k <= 4; k++) { const y = pad + (h - pad * 2) * k / 4; g.beginPath(); g.moveTo(pad, y); g.lineTo(w - pad, y); g.stroke(); }
  g.fillStyle = '#95b0b8'; g.font = '22px Lexend, sans-serif'; g.textAlign = 'left';
  g.fillText('Year ' + Math.round(x0 + 1), pad, h - 4); g.textAlign = 'right'; g.fillText('Year ' + x1, w - pad, h - 4);
  [['pop', '#62d36c'], ['money', '#f5c544'], ['pollution', '#c08cf0']].forEach(([k, col]) => {
    const mx = k === 'pollution' ? 100 : Math.max(1, ...all.map(r => Math.abs(r[k])));
    const mn = k === 'money' ? Math.min(0, ...all.map(r => r[k])) : 0;
    const Y = v => h - pad - (h - pad * 2) * (v - mn) / Math.max(1, mx - mn);
    g.strokeStyle = col; g.lineWidth = 4; g.beginPath();
    all.forEach((r, i) => { const x = X(r.year), y = Y(r[k]); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke();
    const lr = all[all.length - 1]; g.fillStyle = col; g.beginPath(); g.arc(X(lr.year), Y(lr[k]), 7, 0, 7); g.fill();
  });
  if (!opt.final) { g.strokeStyle = 'rgba(255,255,255,.35)'; g.setLineDash([8, 8]); g.beginPath(); g.moveTo(X(y0), pad); g.lineTo(X(y0), h - pad); g.stroke(); g.setLineDash([]); }
}

/* Event dilemma with a countdown */
const EV_ART = (() => {
  const cloud = '<path d="M30 70a18 18 0 0 1-2-36 26 26 0 0 1 50-6 20 20 0 0 1 6 40z" fill="#dfe9f1"/>';
  const sun = (c) => '<circle cx="60" cy="56" r="20" fill="' + c + '"/>' + Array.from({ length: 10 }, (_, k) => { const a = k * Math.PI / 5; return '<path d="M' + (60 + Math.cos(a) * 28) + ' ' + (56 + Math.sin(a) * 28) + 'L' + (60 + Math.cos(a) * 40) + ' ' + (56 + Math.sin(a) * 40) + '" stroke="' + c + '" stroke-width="6" stroke-linecap="round"/>'; }).join('');
  const drops = c => [30, 50, 70, 90].map((x, k) => '<path d="M' + x + ' ' + (82 + k % 2 * 6) + 'l-4 12" stroke="' + c + '" stroke-width="5" stroke-linecap="round"/>').join('');
  const A = {
    'monsoon-failure': '<path d="M14 100h92" stroke="#8a5a2b" stroke-width="6"/><path d="M24 100l10-10 8 6 10-12 12 14 8-8 10 10" stroke="#5b3a1c" stroke-width="4" fill="none"/>' + sun('#ffb43a'),
    'heatwave': sun('#ff7a2e') + '<path d="M20 98q10-8 20 0t20 0 20 0 20 0" stroke="#ffcf8a" stroke-width="5" fill="none"/>',
    'disease-outbreak': '<circle cx="60" cy="60" r="22" fill="#7ad36b"/>' + Array.from({ length: 8 }, (_, k) => { const a = k * Math.PI / 4; return '<circle cx="' + (60 + Math.cos(a) * 32) + '" cy="' + (60 + Math.sin(a) * 32) + '" r="6" fill="#7ad36b"/>'; }).join('') + '<circle cx="54" cy="55" r="5" fill="#2e6a26"/><circle cx="67" cy="66" r="4" fill="#2e6a26"/>',
    'fuel-price-crash': '<rect x="36" y="30" width="40" height="64" rx="6" fill="#e05a44"/><rect x="42" y="38" width="28" height="18" rx="3" fill="#ffe2d8"/><path d="M76 44h10v34a6 6 0 0 0 12 0V50l-8-8" stroke="#e05a44" stroke-width="5" fill="none"/><path d="M20 30l80 70" stroke="#fff" stroke-width="5"/><path d="M84 92l14 8-2-16" fill="#fff"/>',
    'baby-boom': '<circle cx="60" cy="48" r="20" fill="#ffd7b0"/><circle cx="53" cy="46" r="2.5" fill="#333"/><circle cx="67" cy="46" r="2.5" fill="#333"/><path d="M54 55q6 5 12 0" stroke="#333" stroke-width="2.5" fill="none"/><path d="M32 100q0-30 28-30t28 30z" fill="#8ec5ff"/>',
    'flood': '<rect x="40" y="38" width="40" height="34" fill="#f4e3c4"/><path d="M34 40l26-20 26 20z" fill="#c4553b"/>' + '<path d="M10 74q12-8 25 0t25 0 25 0 25 0v36H10z" fill="#3fa9e8"/>',
    'forest-fire': '<path d="M60 18c18 22 26 34 26 52a26 26 0 0 1-52 0c0-10 6-18 10-22 0 10 6 14 8 14-2-16 2-30 8-44z" fill="#ff7a2e"/><path d="M60 54c8 10 12 16 12 24a12 12 0 0 1-24 0c0-8 6-14 12-24z" fill="#ffd23f"/>',
    'good-harvest': '<path d="M60 100V40" stroke="#c9a33a" stroke-width="4"/>' + [30, 42, 54, 66].map(y => '<ellipse cx="52" cy="' + y + '" rx="7" ry="4" fill="#f2c94c" transform="rotate(-30 52 ' + y + ')"/><ellipse cx="68" cy="' + y + '" rx="7" ry="4" fill="#f2c94c" transform="rotate(30 68 ' + y + ')"/>').join(''),
    'factory-strike': '<rect x="22" y="56" width="76" height="40" fill="#9aa1a8"/><path d="M22 56l18-14v14l18-14v14l18-14v14" fill="#7d858d"/><rect x="80" y="26" width="10" height="34" fill="#c4483a"/><rect x="36" y="20" width="44" height="28" rx="4" fill="#fff" transform="rotate(-8 58 34)"/><path d="M44 30h28M44 38h20" stroke="#e05a44" stroke-width="4" transform="rotate(-8 58 34)"/>',
    'new-technology': '<circle cx="60" cy="50" r="22" fill="#ffe680"/><rect x="50" y="72" width="20" height="14" rx="3" fill="#9aa1a8"/><path d="M52 50l6 8 10-16" stroke="#c78a00" stroke-width="4" fill="none"/>',
    'forest-land-offer': '<path d="M40 30l18 30H22z M40 46l20 32H20z" fill="#3fa34d"/><rect x="37" y="78" width="6" height="14" fill="#7a5232"/><path d="M80 34l16 28H64z M80 50l18 30H62z" fill="#2e8a3e"/><rect x="77" y="80" width="6" height="12" fill="#7a5232"/>',
    'college-demand': '<path d="M60 26l40 18-40 18-40-18z" fill="#4f7fb0"/><path d="M36 54v18q24 14 48 0V54l-24 11z" fill="#2f5a87"/><path d="M96 46v26" stroke="#ffd23f" stroke-width="4"/>',
    'neighbour-water': '<path d="M60 22s26 30 26 48a26 26 0 0 1-52 0c0-18 26-48 26-48z" fill="#3fb5f2"/><path d="M48 70a12 12 0 0 0 12 12" stroke="#d6f1ff" stroke-width="4" fill="none"/>',
    'neighbour-refugees': '<path d="M14 92l26-44 26 44z" fill="#e9c46a"/><path d="M40 48v44" stroke="#8a5a2b" stroke-width="3"/><path d="M34 92l6-14 6 14z" fill="#5b3a1c"/><path d="M58 92l24-38 24 38z" fill="#f4a261"/><path d="M76 92l6-12 6 12z" fill="#5b3a1c"/><path d="M8 96h104" stroke="#6b8f4e" stroke-width="5" stroke-linecap="round"/>',
    'neighbour-food': '<path d="M36 44q24-12 48 0l6 46q-30 12-60 0z" fill="#d9b26f"/><path d="M40 44q20-8 40 0" stroke="#8a6a3f" stroke-width="4" fill="none"/><path d="M60 30v-12M52 32l-6-10M68 32l6-10" stroke="#e9c046" stroke-width="4" stroke-linecap="round"/><text x="60" y="78" text-anchor="middle" font-size="16" font-weight="700" fill="#6b4b20">GRAIN</text>',
    'cyclone': '<path d="M60 60m-8 0a8 8 0 1 0 16 0a8 8 0 1 0-16 0" fill="#dfe9f1"/><path d="M60 30c22 0 32 14 30 26M60 90c-22 0-32-14-30-26M30 50c2-14 16-22 30-20M90 70c-2 14-16 22-30 20" stroke="#9fc3dc" stroke-width="7" fill="none" stroke-linecap="round"/>',
    'locusts': '<g fill="#7a8b2e">' + [[40, 40], [70, 34], [55, 60], [84, 62], [36, 74], [66, 84]].map(([x, y]) => '<ellipse cx="' + x + '" cy="' + y + '" rx="11" ry="4" transform="rotate(-20 ' + x + ' ' + y + ')"/><path d="M' + (x - 4) + ' ' + y + 'l-6 7M' + (x + 2) + ' ' + y + 'l4 8" stroke="#5b6a1f" stroke-width="2"/>').join('') + '</g><path d="M14 104h92" stroke="#c9a33a" stroke-width="5"/>',
    'chemical-leak': '<rect x="30" y="28" width="40" height="54" rx="6" fill="#9aa1a8"/><path d="M38 40h24M38 50h24" stroke="#ffd23f" stroke-width="4"/><path d="M62 82c8 6 6 14 18 16s22-4 26 4" stroke="#7ad36b" stroke-width="8" fill="none" stroke-linecap="round"/><path d="M8 100q16-6 32 0t32 0 40 0" stroke="#3f7fae" stroke-width="5" fill="none"/>',
    'blackout': '<rect x="22" y="44" width="76" height="52" rx="4" fill="#2c3440"/><g fill="#11161d">' + [0, 1, 2, 3].map(k => '<rect x="' + (30 + k * 17) + '" y="54" width="10" height="12"/><rect x="' + (30 + k * 17) + '" y="74" width="10" height="12"/>').join('') + '</g><path d="M66 14L50 42h14l-8 24 22-32H64l8-20z" fill="#ffd23f"/><path d="M40 20l40 40" stroke="#ef5b4c" stroke-width="6" stroke-linecap="round"/>',
    'more-coal': '<path d="M20 96l20-34 18 18 14-24 28 40z" fill="#2c2a27"/><path d="M40 62l8 10M72 56l6 12" stroke="#55524c" stroke-width="4"/>',
  };
  return id => '<svg viewBox="0 0 120 120" width="150" height="150" aria-hidden="true">' + (A[id] || cloud + drops('#8fd0ff')) + '</svg>';
})();
let evTimer = 0;
function trustDots(g) { const n = Math.max(0, Math.min(5, Math.round((g + 4) / 2))); return '<span class="trust" title="How much your neighbours trust you">' + Array.from({ length: 5 }, (_, i) => '<i class="' + (i < n ? 'on' : '') + '"></i>').join('') + '</span>'; }
function showEvent(p, opt, resume) {
  const ov = EVENT_TEXT[p.eventId] || {};
  const v = E.eventView(S, p.eventId);
  const secs = opt.final ? S.cfg.finalPauseSec : S.cfg.pauseSec;
  const def = E.defaultChoice(p.eventId);
  $('evKind').textContent = (v.neighbour ? 'Neighbour asks for help' : v.shock ? 'Crisis' : 'Decision') + ' · Year ' + S.year;
  $('evTitle').textContent = ov.title || v.title;
  $('evText').textContent = ov.text || v.text;
  $('evArt').className = 'evart ev-' + p.eventId + (v.shock ? ' shock' : '');
  if (ov.image) { $('evArt').style.backgroundImage = 'url("art/' + ov.image + '")'; $('evArt').innerHTML = ''; } else { $('evArt').style.backgroundImage = ''; $('evArt').innerHTML = EV_ART(p.eventId); }
  // how hard this hits, and why (the city you built, choices you made earlier, what the neighbours remember)
  const sevTxt = !v.shock ? '' : v.mul >= 1.3 ? 'Hits your city hard' : v.mul >= 1.1 ? 'Hits your city harder than usual' : v.mul <= 0.75 ? 'Your city is well prepared' : v.mul <= 0.92 ? 'Your city is fairly prepared' : 'An ordinary blow';
  const sevCls = v.mul >= 1.1 ? 'bad' : v.mul <= 0.92 ? 'ok' : '';
  $('evNotes').innerHTML = (sevTxt ? '<div class="sev ' + sevCls + '">' + sevTxt + '</div>' : '') + (v.notes.length ? '<ul>' + v.notes.map(n => '<li>' + escapeHtml(n) + '</li>').join('') + '</ul>' : '') +
    ((v.neighbour || v.choices.some(c => c.ask)) ? '<div class="trustrow">Neighbours\' trust ' + trustDots(S.goodwill || 0) + '</div>' : '');
  $('evNotes').hidden = !$('evNotes').innerHTML;
  $('evChoices').innerHTML = v.choices.map((c, k) => '<button class="evc' + (c.ask ? ' ask' : '') + '" data-k="' + k + '"><b>' + escapeHtml(c.label) + '</b><span>' + escapeHtml(c.detail || '') + '</span></button>').join('');
  $('evDefault').textContent = 'Discuss with your team. If time runs out: ' + v.choices[def].label + '.';
  $('evOutcome').hidden = true; $('evChoices').hidden = false; $('evClock').style.visibility = '';
  $('eventScreen').hidden = false;
  if (has3D) R3.orbit(false);
  let left = secs;
  const tick = () => {
    $('evClock').textContent = Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0');
    $('evClock').classList.toggle('hurry', left <= 10);
    if (left <= 0) { choose(def, true); return; }
    left--; evTimer = setTimeout(tick, 1000);
  };
  const done = () => { clearTimeout(evTimer); $('eventScreen').hidden = true; persist(); if (has3D) R3.orbit(true); resume(); };
  const choose = (k, timeout) => {
    clearTimeout(evTimer);
    $('evChoices').querySelectorAll('button').forEach(b => b.disabled = true);
    const ch = E.resolveEvent(S, p.eventId, k, EVENT_TEXT);
    if (ch && ch.news) S._lastNews = { text: ch.news, until: Date.now() + 25000 };
    // show what the choice led to before the years roll on
    $('evChoices').hidden = true; $('evNotes').hidden = true;
    $('evOutcome').hidden = false;
    $('evClock').style.visibility = 'hidden';
    $('evOutTitle').textContent = (timeout ? 'Time ran out: ' : 'You chose: ') + (ch ? ch.label : '');
    $('evOutText').textContent = (ch && ch.outcome) ? ch.outcome : (ch && ch.news ? ch.news : '');
    $('evOutTrust').innerHTML = (E.EVENTS[p.eventId].neighbour || (ch && ch.ask)) ? 'Neighbours\' trust ' + trustDots(S.goodwill || 0) : '';
    $('evDefault').textContent = '';
    let n = 8; $('evGo').textContent = 'Continue (' + n + ')';
    const t2 = () => { n--; if (n <= 0) { done(); return; } $('evGo').textContent = 'Continue (' + n + ')'; evTimer = setTimeout(t2, 1000); };
    evTimer = setTimeout(t2, 1000);
    $('evGo').onclick = done;
  };
  $('evChoices').onclick = e => { const b = e.target.closest('[data-k]'); if (b) choose(+b.dataset.k, false); };
  tick();
}

/* "What happened" card after every jump */
function showWhat(opt, y0) {
  const T = S.tally, W2 = C.whatHappened;
  const popStart = T.popStart, popEnd = S.pop, ch = popEnd - popStart;
  const headline = Math.abs(ch) < popStart * 0.05 ? W2.headlineStable : ch > 0 ? W2.headlineGrowth : W2.headlineDecline;
  const died = Object.entries(T.died).map(([k, v]) => [k, Math.round(v)]).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const totalDied = died.reduce((s, [, v]) => s + v, 0) || 1;
  const rainAvg = T.years ? T.rainSum / T.years : 1;
  $('whTitle').textContent = headline;
  $('whSub').textContent = T.years + ' years: year ' + y0 + ' to ' + S.year + (S.dead ? ' · the city died' : '');
  $('whStats').innerHTML = [['People', fmt(popStart) + ' → ' + fmt(popEnd), ch >= 0 ? '#62d36c' : '#ef5b4c'], ['Born', fmt(T.born), '#7cc7ff'], ['Died', fmt(totalDied), '#ff9c90'], ['Rain', Math.round(rainAvg * 100) + '% of normal', rainAvg < 0.7 ? '#f2a33a' : '#8fd0ff'], ['Money', money(T.moneyStart) + ' → ' + money(S.money), S.money >= T.moneyStart ? '#f5c544' : '#ef5b4c']]
    .map(([k, v, c]) => '<div><small>' + k + '</small><b class="num" style="color:' + c + '">' + v + '</b></div>').join('');
  // the round's score so far, and how the age groups changed
  const rr = E.eraReport(S, S.level, E.CAP_YEARS);
  const ag = T.agesStart || [0, 0, 0];
  $('whRound').innerHTML = '<div class="rscore"><small>Round ' + S.level + ' score</small><b class="num">' + rr.score.toFixed(0) + '</b><span>SDGs ' + rr.base.toFixed(0) + (rr.penLives ? ' · −' + rr.penLives.toFixed(0) + ' for preventable deaths' : '') + (rr.penMoney ? ' · −' + rr.penMoney.toFixed(0) + ' for losses and debt' : '') + ' · counts ' + Math.round(E.ERA_W[S.level] * 100) + '% of your final score</span></div>' +
    '<div class="ages wh"><div><b class="num">' + fmt(ag[0]) + ' → ' + fmt(S.kids) + '</b><span>Children</span></div><div class="work"><b class="num">' + fmt(ag[1]) + ' → ' + fmt(S.adults) + '</b><span>Working age</span></div><div><b class="num">' + fmt(ag[2]) + ' → ' + fmt(S.elders) + '</b><span>Elderly</span></div></div>';
  $('whDeaths').innerHTML = died.length ? '<h4>Why people died</h4>' + died.map(([k, v]) => '<div class="why"><span>' + escapeHtml(W2.causes[k] || k) + '</span><div class="b"><i style="width:' + Math.round(v / totalDied * 100) + '%" class="c-' + k + '"></i></div><b class="num">' + fmt(v) + '</b></div>').join('') : '';
  const used = Object.entries(T.used || {}).filter(([, v]) => v > 0.5).map(([k, v]) => fmt(v) + ' ' + E.UNIT[k]);
  const evs = (T.events || []).map(e => '<li><b>' + escapeHtml(e.title) + '</b> — ' + escapeHtml(e.choice) + (e.outcome ? '<br><small>' + escapeHtml(e.outcome) + '</small>' : '') + '</li>').join('');
  const cons = (S.memory || []).filter(m => m.year >= y0 && m.year <= S.year && /year \d+|hit harder|softened/.test(m.text)).map(m => '<li><b>Year ' + m.year + '</b> ' + escapeHtml(m.text) + '</li>').join('');
  $('whMore').innerHTML = (used.length ? '<p><b>Dug up:</b> ' + used.join(', ') + '</p>' : '') + (evs ? '<h4>Your decisions</h4><ul>' + evs + '</ul>' : '') + (cons ? '<h4>Past choices catching up</h4><ul>' + cons + '</ul>' : '') + ((T.events || []).length ? '<p class="trustrow">Neighbours\' trust ' + trustDots(S.goodwill || 0) + '</p>' : '');
  $('whNext').textContent = S.dead || opt.final ? 'See your result' : 'Start Level ' + (S.level + 1);
  $('whatScreen').hidden = false;
  $('whNext').onclick = () => { $('whatScreen').hidden = true; if (S.dead || opt.final) showResult(); else { S.phase = 'plan'; opt.next(); } };
}

/* =========================================================
   Result
   ========================================================= */
const SDG_COL = { 1: '#E5243B', 17: '#19486A', 2: '#DDA63A', 3: '#4C9F38', 4: '#C5192D', 6: '#26BDE2', 7: '#FCC30B', 8: '#A21942', 9: '#FD6925', 11: '#FD9D24', 12: '#BF8B2E', 13: '#3F7E44', 15: '#56C02B' };
async function showResult() {
  S.phase = 'done';
  const r = E.result(S, E.CAP_YEARS);
  S._score = r.score;
  S.over = true;
  $('resTeam').textContent = S.team;
  const pct = r.score / 100, Cc = 2 * Math.PI * 58;
  $('resRing').innerHTML = '<circle cx="70" cy="70" r="58" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="14"/><circle cx="70" cy="70" r="58" fill="none" stroke="' + (r.score >= 75 ? '#62d36c' : r.score >= 60 ? '#f5c544' : '#ef5b4c') + '" stroke-width="14" stroke-linecap="round" stroke-dasharray="' + (Cc * pct) + ' ' + Cc + '" transform="rotate(-90 70 70)"/><text x="70" y="72" text-anchor="middle" fill="#e9f4f1" font-family="Fredoka, sans-serif" font-size="38" font-weight="700">' + r.score.toFixed(1) + '</text><text x="70" y="94" text-anchor="middle" fill="#95b0b8" font-size="12" font-family="Lexend, sans-serif">SDG score / 100</text>';
  const en = C.endings;
  $('resFate').className = 'fate ' + (r.alive ? 'ok' : 'dead');
  $('resFate').innerHTML = r.alive ? '<b>' + escapeHtml(en.thriving.title) + ' in year ' + r.years + '.</b> ' + escapeHtml(en.thriving.text) : '<b>' + escapeHtml(en.dead.title) + ' in year ' + r.years + '.</b> ' + escapeHtml((en.deathReasons && en.deathReasons[r.why]) || r.whyText || '') + ' ' + escapeHtml(en.dead.text);
  $('resStats').innerHTML = [['Years lasted', r.years + ' / ' + E.CAP_YEARS], ['Final population', fmt(r.pop)], ['Buildings', Object.keys(S.buildings).length]].map(([k, v]) => '<div><small>' + k + '</small><b class="num">' + v + '</b></div>').join('');
  $('resRounds').innerHTML = r.rounds.map(x => '<div class="round' + (x.reached ? '' : ' off') + '"><small>Round ' + x.era + ' · ' + Math.round(x.weight * 100) + '%</small><b class="num">' + x.score.toFixed(0) + '</b><span>' + (x.reached ? 'SDGs ' + x.base.toFixed(0) + (x.penLives ? '<br>−' + x.penLives.toFixed(0) + ' preventable deaths' : '') + (x.penMoney ? '<br>−' + x.penMoney.toFixed(0) + ' losses &amp; debt' : '') : 'The city did not live to see it') + '</span></div>').join('');
  $('resSdgs').innerHTML = E.SDGS.map(x => '<div class="sdg"><div class="n" style="background:' + SDG_COL[x.n] + '">' + x.n + '</div><div><div>' + x.name + '</div><div class="b"><i style="width:' + r.sdg[x.key] + '%;background:' + SDG_COL[x.n] + '"></i></div></div><div class="num" style="text-align:right">' + Math.round(r.sdg[x.key]) + '</div></div>').join('');
  setView('result'); if (has3D) R3.orbit(true);
  $('resultScreen').hidden = false;
  $('resSaved').textContent = 'Sending your result to the organisers…';
  const rec = { id: 'r' + S.seed + '-' + Date.now().toString(36), gameId: S.gameId, repeat: !!S.repeat, team: S.team, roll: S.roll || '', phone: S.phone || '', score: r.score, years: r.years, alive: r.alive, why: r.why || '', pop: r.pop, sdg: r.sdg, cap: E.CAP_YEARS, startedAt: S.startedAt, finishedAt: new Date().toISOString(), buildings: Object.keys(S.buildings).length };
  if (!S.saved) {
    S.saved = true;
    sheetSend({ action: 'end', id: S.gameId, score: r.score.toFixed(1), years: r.years, fate: r.alive ? 'Thriving' : 'Dead planet: ' + (r.whyText || r.why || ''), pop: Math.round(r.pop), finishedAt: rec.finishedAt, sdg: JSON.stringify(Object.fromEntries(Object.entries(r.sdg).map(([k, v]) => [k, Math.round(v)]))) });
    const how = await saveResult(rec);
    const queued = sheetOn() && LS.get('sheetq', []).length;
    $('resSaved').textContent = how === 'shared' || (sheetOn() && !queued) ? 'Your result has been sent to the organisers. Well done!' : 'Your result is saved on this laptop and will reach the organisers when it reconnects.';
  } else $('resSaved').textContent = 'Your result has been recorded.';
  LS.del('game');
}
$('resDone').onclick = () => { $('resultScreen').hidden = true; S = null; showStart(); };

/* =========================================================
   Start / rules / SDG page / resume
   ========================================================= */
function applySettingsText() {
  $('l1t').textContent = settings.t1 + ' min'; $('l2t').textContent = settings.t2 + ' min'; $('l3t').textContent = settings.t3 + ' min';
  document.querySelectorAll('.jy').forEach(e => e.textContent = settings.jump);
}
function showStart() {
  applySettingsText();
  $('pitch').textContent = C.startScreen.pitch;
  $('startScreen').hidden = false; $('teamName').value = ''; $('teamRoll').value = ''; $('teamPhone').value = ''; $('startErr').hidden = true;
  const saved = LS.get('game', null);
  const rb = $('resumeBox');
  if (saved && saved.S && saved.S.v === 2 && !saved.S.over) {
    rb.hidden = false;
    rb.innerHTML = '<p class="lead" style="margin:0 0 6px">A game was interrupted on this laptop: <b style="color:var(--text)">' + escapeHtml(saved.S.team) + '</b>, Level ' + saved.S.level + '.</p><button class="btn" id="resumeBtn" type="button">Resume that game</button>';
    $('resumeBtn').onclick = () => resume(saved.S);
  } else rb.hidden = true;
  showDemo();
}
function resume(st) {
  S = st; $('startScreen').hidden = true;
  if (has3D) { R3.orbit(false); R3.load(S); }
  setView('plan');
  if (S.phase === 'sim' || S.phase === 'between') {
    // finish the interrupted time jump quickly (events take their last, "carry on" choice)
    const o = S.simOpt || {};
    const pauses = o.phase ? E.pausesFor(S, o.phase) : [];
    while (o.target && S.year < o.target && !S.dead) {
      const p = pauses.find(p => p.year === S.year && !S.eventsDone.some(e => e.year === S.year));
      if (p) E.resolveEvent(S, p.eventId, E.defaultChoice(p.eventId), EVENT_TEXT);
      E.step(S, o.mode || 'dyn');
    }
    S.phase = 'plan';
    if (S.dead || o.final) { showResult(); return; }
    goLevel(S.level + 1); return;
  }
  if (S.phase === 'done') { showResult(); return; }
  if (S.deadline < Date.now() + 60000) S.deadline = Date.now() + 2 * 60000;
  refresh(true); if (has3D) R3.envNow(); centerCam(false);
}
onSubmit($('startForm'), async e => {
  e.preventDefault();
  const name = $('teamName').value.trim(), roll = $('teamRoll').value.trim(), phone = $('teamPhone').value.replace(/\D/g, '');
  const err = m => { $('startErr').textContent = m; $('startErr').hidden = false; };
  if (!name) return err('Enter a team name.');
  if (!roll) return err('Enter the team lead\'s roll number.');
  if (phone.length !== 10) return err('Enter a 10-digit phone number.');
  $('startGo').disabled = true; $('startGo').textContent = 'Checking…';
  const chk = await teamNameCheck(name, roll);
  $('startGo').disabled = false; $('startGo').textContent = 'Start Level 1';
  if (chk.taken) return err('"' + name + '" is already taken by another team. Please choose another team name.');
  LS.del('game');
  $('startScreen').hidden = true;
  newGame(name, roll, phone, chk.repeat);
  if (chk.repeat) toast('Welcome back, ' + name + '. This game is marked as a repeat.');
});
function renderSdgPage() {
  const s = C.sdg;
  $('sdgIntro').textContent = s.intro;
  $('sdgGrid').innerHTML = s.goals.map(g => '<div class="sdgcard"><div class="n" style="background:' + (SDG_COL[g.n] || '#555') + '">' + g.n + '</div><div><b>' + escapeHtml(g.name) + '</b><p>' + escapeHtml(g.what) + '</p><p class="ig"><span>In the game:</span> ' + escapeHtml(g.inGame) + '</p></div></div>').join('');
  $('sdgScreen').hidden = false;
}
$('startRules').onclick = () => { $('rulesScreen').hidden = false; };
$('startSdg').onclick = renderSdgPage;
$('rulesSdg').onclick = () => { $('rulesScreen').hidden = true; renderSdgPage(); };
$('sdgClose').onclick = () => { $('sdgScreen').hidden = true; };
$('rulesBtn').onclick = () => { $('rulesScreen').hidden = false; };
$('rulesClose').onclick = () => { $('rulesScreen').hidden = true; };

/* =========================================================
   Organiser
   ========================================================= */
$('orgBtn').onclick = () => { $('pinIn').value = ''; $('pinErr').hidden = true; $('pinScreen').hidden = false; setTimeout(() => $('pinIn').focus(), 50); };
$('startOrg').onclick = () => $('orgBtn').onclick();
$('pinCancel').onclick = () => { $('pinScreen').hidden = true; };
onSubmit($('pinForm'), e => {
  e.preventDefault();
  if ($('pinIn').value.trim() !== String(settings.pin)) { $('pinErr').hidden = false; return; }
  $('pinScreen').hidden = true; openOrg();
});
let lbUnsub = null, lbRows = [];
function openOrg() {
  $('orgScreen').hidden = false; seg('lb');
  $('sT1').value = settings.t1; $('sT2').value = settings.t2; $('sT3').value = settings.t3; $('sJump').value = settings.jump; $('sPause').value = settings.pauseSec; $('sDay').value = settings.dayMin || 6; $('sPin').value = settings.pin; $('sSheet').value = settings.sheetUrl || ''; $('sLaptop').value = laptopName();
  $('gameInfo').textContent = S ? 'Current game: ' + S.team + ', Level ' + S.level + ', city year ' + S.year + '.' : 'No game in progress.';
  updateDbStatus();
  if (db && !lbUnsub) lbUnsub = db.collection('results').onSnapshot(snap => { lbRows = snap.docs.map(d => Object.assign({ _id: d.id }, d.data())); renderLb(); }, () => { lbUnsub = null; lbRows = LS.get('results', []); renderLb(); });
  else if (!db) { lbRows = LS.get('results', []); renderLb(); }
  else renderLb();
}
function updateDbStatus() {
  const el = $('dbStatus'); if (!el) return;
  const q = LS.get('sheetq', []).length;
  el.textContent = !dbReady ? 'Connecting…' : (db ? 'Live leaderboard: results from every laptop appear here as teams finish.' : 'Showing results saved on this laptop.') +
    (sheetOn() ? ' Google Sheet: ' + (q ? q + ' update' + (q > 1 ? 's' : '') + ' waiting to send.' : 'connected, all sent.') : ' Google Sheet: not set up (Game settings).');
}
function renderLb() {
  const rows = lbRows.slice().sort((a, b) => b.score - a.score || b.years - a.years);
  $('lbBody').innerHTML = rows.length ? rows.map((r, i) => '<tr class="' + (i === 0 ? 'top1' : '') + '"><td class="num">' + (i + 1) + '</td><td><b>' + escapeHtml(r.team) + '</b><div class="lead" style="font-size:11.5px;margin:2px 0 0">' + escapeHtml(r.roll || '') + (r.phone ? ' · ' + escapeHtml(r.phone) : '') + '</div></td><td class="num"><b>' + (+r.score).toFixed(1) + '</b></td><td class="num">' + r.years + ' / ' + (r.cap || 500) + '</td><td><span class="chip ' + (r.alive ? 'ok' : 'dead') + '">' + (r.alive ? 'Thriving' : 'Dead planet') + '</span></td><td class="num">' + (r.finishedAt ? new Date(r.finishedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '') + '</td><td><button class="btn ghost" data-del="' + escapeHtml(r._id || r.id) + '" title="Remove a test entry">Remove</button></td></tr>').join('')
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
function seg(k) { [['lb', 'segLb', 'paneLb'], ['set', 'segSet', 'paneSet'], ['game', 'segGame', 'paneGame']].forEach(([n, s, p]) => { $(s).setAttribute('aria-selected', n === k); $(p).hidden = n !== k; }); }
$('segLb').onclick = () => seg('lb'); $('segSet').onclick = () => seg('set'); $('segGame').onclick = () => seg('game');
$('orgClose').onclick = () => { $('orgScreen').hidden = true; };
onSubmit($('setForm'), async e => {
  e.preventDefault();
  const n = (id, lo, hi, d) => clamp(Math.round(+$(id).value || d), lo, hi);
  settings = { t1: n('sT1', 1, 60, 15), t2: n('sT2', 1, 60, 8), t3: n('sT3', 1, 60, 8), jump: n('sJump', 5, 10, 8), pauseSec: n('sPause', 20, 180, 90), finalPauseSec: Math.round(n('sPause', 20, 180, 90) * 2 / 3), pin: ($('sPin').value.trim() || '2026').slice(0, 12), sheetUrl: $('sSheet').value.trim(), sheetKey: settings.sheetKey || DEFAULTS.sheetKey, dayMin: n('sDay', 2, 20, 6) };
  if ($('sLaptop').value.trim()) LS.set('laptop', $('sLaptop').value.trim().slice(0, 30));
  LS.set('settings', settings); applySettingsText(); sheetFlush();
  if (has3D) R3.setDayLength(settings.dayMin);
  if (settings.sheetUrl && !sheetOn()) { $('setMsg').textContent = 'That Google Sheet link does not look right: it should start with https://script.google.com/'; return; }
  let msg = 'Saved on this laptop.';
  if (db) { try { await db.doc('config/settings').set(settings); msg = 'Saved for every laptop. New games use these settings.'; } catch (err) { msg = 'Saved on this laptop only (could not reach the shared store).'; } }
  $('setMsg').textContent = msg;
});
$('resetGame').onclick = function () {
  if (!this.dataset.armed) { this.dataset.armed = '1'; this.textContent = 'Click again to confirm'; return; }
  delete this.dataset.armed; this.textContent = "End this team's game without saving";
  if (S && S.gameId) sheetSend({ action: 'update', id: S.gameId, status: 'Ended by organiser', level: 'Level ' + S.level, year: S.year });
  LS.del('game'); S = null; $('orgScreen').hidden = true; ['simScreen', 'resultScreen', 'eventScreen', 'whatScreen'].forEach(id => $(id).hidden = true); clearTimeout(evTimer); showStart();
};

/* =========================================================
   Beta review (only in the review build)
   ========================================================= */
const FB = { stars: '', diff: '', time: '' };
function pills(id, key, opts) {
  $(id).innerHTML = opts.map(o => '<button type="button" data-v="' + o + '" aria-pressed="' + (FB[key] === o) + '">' + o + '</button>').join('');
  $(id).onclick = e => { const b = e.target.closest('[data-v]'); if (!b) return; FB[key] = b.dataset.v; pills(id, key, opts); };
}
function openFeedback() {
  pills('fbStars', 'stars', ['1 ★', '2 ★', '3 ★', '4 ★', '5 ★']);
  pills('fbDiff', 'diff', ['Too easy', 'About right', 'Too hard']);
  pills('fbTime', 'time', ['Too short', 'About right', 'Too long']);
  $('fbMsg').textContent = ''; $('fbOut').hidden = true;
  $('fbScreen').hidden = false;
}
/* Errors: keep the game going, and remember what broke so the review can include it */
const ERRS = [];
function noteError(msg) {
  msg = String(msg || 'unknown error').slice(0, 240);
  if (ERRS.length < 6 && !ERRS.includes(msg)) ERRS.push(msg);
  try { localStorage.setItem('ecocity2.errors', JSON.stringify(ERRS)); } catch (e) {}
}
window.addEventListener('error', e => noteError((e.message || 'error') + (e.lineno ? ' @' + e.lineno + ':' + e.colno : '')));
window.addEventListener('unhandledrejection', e => noteError('promise: ' + (e.reason && (e.reason.stack || e.reason.message) || e.reason)));
cv.addEventListener('webglcontextlost', () => { noteError('graphics reset (WebGL context lost)'); toast('The graphics restarted. Your city is safe; the view will come back in a moment.'); });
function reviewText() {
  const where = S ? (S.over ? 'Finished: SDG score ' + (S._score != null ? S._score.toFixed(1) : '?') + ', city year ' + S.year : 'Stopped at Level ' + S.level + ', city year ' + S.year + ', ' + fmt(S.pop) + ' people') : 'Did not start a game';
  return ['EcoCity beta review' + ($('fbName').value.trim() ? ' from ' + $('fbName').value.trim() : ''),
    'Overall: ' + (FB.stars || '-') + ' | Difficulty: ' + (FB.diff || '-') + ' | Time: ' + (FB.time || '-'),
    'Best part: ' + ($('fbGood').value.trim() || '-'),
    'Confusing/annoying: ' + ($('fbBad').value.trim() || '-'),
    'One change: ' + ($('fbIdea').value.trim() || '-'),
    where,
    'Browser: ' + navigator.userAgent.replace(/^Mozilla\/5\.0 /, '').slice(0, 140) + ' | screen ' + innerWidth + 'x' + innerHeight + ' @' + (devicePixelRatio || 1),
    'Errors: ' + (ERRS.length ? ERRS.join(' || ') : 'none')].join('\n');
}
if (window.ECO_CONFIG && window.ECO_CONFIG.beta) {
  $('fbBtn').hidden = false; $('resFb').hidden = false;
  $('fbBtn').onclick = openFeedback; $('resFb').onclick = openFeedback;
  $('fbClose').onclick = () => { $('fbScreen').hidden = true; };
  onSubmit($('fbForm'), e => {
    e.preventDefault();
    const t = reviewText(), out = $('fbOut');
    out.value = t; out.hidden = false;
    const fallback = () => { out.focus(); out.select(); $('fbMsg').textContent = 'Press Ctrl+C to copy the selected text, then paste it in WhatsApp or email.'; };
    try { navigator.clipboard.writeText(t).then(() => { $('fbMsg').textContent = 'Copied. Paste it in WhatsApp or email to send it. Thank you!'; }, fallback); } catch (err) { fallback(); }
  });
}

/* =========================================================
   Boot
   ========================================================= */
function loop(t) { if (has3D) R3.frame(t); requestAnimationFrame(loop); }
window.addEventListener('resize', () => { if (has3D) { R3.resize(); layoutInsets(); } });
if (!has3D) { const n = document.createElement('div'); n.className = 'no3d'; n.textContent = 'This browser cannot show the 3D city. Please use an up-to-date Chrome, Edge or Firefox.'; $('app').appendChild(n); }
buildLegend(); renderTabs();
showStart();
requestAnimationFrame(loop);
initDb();
/*TEST*/
})();
