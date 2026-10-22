/**
 * EcoCity: Build to Last — live organiser sheet (v6).
 * Paste into Extensions → Apps Script of a new Google Sheet, run setup() once, then
 * Deploy → New deployment → Web app (Execute as: Me, Who has access: Anyone).
 * Put the web app URL in src/config.json ("sheetUrl") so every device sends results here.
 *
 * The game calls this URL with GET parameters:
 *   action=check  team, phone           → { ok, taken, repeat }
 *   action=start  id, team, phone, laptop, startedAt, repeat
 *   action=update id, status, level, year
 *   action=end    id, score, r1, r2, r3, years, fate, pop, finishedAt, sdg (JSON)
 *   action=board                        → { ok, rows: [finished games, best first, no phone numbers] }
 * KEY below must match the key in the game settings (stops random people writing rows).
 */
const KEY = 'ecocity-2026';
const LIVE = 'Live';
const BOARD = 'Leaderboard';
const COLS = ['Game ID', 'Team', 'Lead phone', 'Laptop', 'Status', 'Level', 'City year', 'Started', 'Finished',
  'Final score', 'Round 1 (20%)', 'Round 2 (40%)', 'Round 3 (40%)', 'Years lasted', 'Fate', 'Population', 'Repeat', 'SDG detail'];
const C = {}; COLS.forEach((n, i) => { C[n] = i; }); // column index (0-based) by name

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const live = ss.getSheetByName(LIVE) || ss.insertSheet(LIVE);
  live.clear();
  live.getRange(1, 1, 1, COLS.length).setValues([COLS]).setFontWeight('bold').setBackground('#1d4d74').setFontColor('#ffffff');
  live.setFrozenRows(1);
  live.setColumnWidths(1, COLS.length, 120);
  const board = ss.getSheetByName(BOARD) || ss.insertSheet(BOARD);
  board.clear();
  board.getRange('A1:I1').setValues([['Rank', 'Team', 'Lead phone', 'Final score', 'Round 1', 'Round 2', 'Round 3', 'Years lasted', 'Fate']])
    .setFontWeight('bold').setBackground('#2e9a43').setFontColor('#ffffff');
  board.setFrozenRows(1);
  // finished games only, best score first, ties broken by years lasted; repeats are listed but marked
  const L = LIVE + '!';
  board.getRange('B2').setFormula('=IFERROR(SORT(FILTER({' + L + 'B2:B&IF(' + L + 'Q2:Q="yes"," (repeat)",""),' + L + 'C2:C,' + L + 'J2:J,' + L + 'K2:K,' + L + 'L2:L,' + L + 'M2:M,' + L + 'N2:N,' + L + 'O2:O},' + L + 'E2:E="Finished"),3,FALSE,7,FALSE),"No finished games yet")');
  board.getRange('A2').setFormula('=IF(B2="No finished games yet","",SEQUENCE(COUNTA(B2:B)))');
  board.setColumnWidths(1, 9, 130);
}

function doGet(e) {
  const p = (e && e.parameter) || {};
  let out;
  const lock = LockService.getScriptLock();
  try {
    if (p.action !== 'board') lock.waitLock(15000); // reading the board needs no lock
    out = handle(p);
  } catch (err) {
    out = { ok: false, error: String(err) };
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function norm(s) { return String(s || '').trim().toLowerCase(); }
function phone(s) { return String(s || '').replace(/\D/g, '').slice(-10); }
function num(v) { return v === '' || v == null || isNaN(+v) ? '' : +v; }

function handle(p) {
  if (p.key !== KEY) return { ok: false, error: 'bad key' };
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(LIVE);
  if (!sh) return { ok: false, error: 'run setup() first' };
  if (sh.getRange(1, 3).getValue() !== 'Lead phone') return { ok: false, error: 'old sheet layout: run setup() again' };
  const last = sh.getLastRow();
  const rows = last > 1 ? sh.getRange(2, 1, last - 1, COLS.length).getValues() : [];
  const findId = id => rows.findIndex(r => String(r[0]) === String(id));

  if (p.action === 'check') {
    const same = rows.filter(r => norm(r[C['Team']]) === norm(p.team));
    if (!same.length) return { ok: true, taken: false };
    // the same team (same lead phone number) may play again: it is marked as a repeat
    const sameTeam = same.every(r => phone(r[C['Lead phone']]) === phone(p.phone));
    return { ok: true, taken: !sameTeam, repeat: sameTeam };
  }
  if (p.action === 'board') {
    const out = rows.filter(r => r[C['Status']] === 'Finished').map(r => ({
      gameId: String(r[C['Game ID']]), team: String(r[C['Team']]), score: +r[C['Final score']] || 0,
      rounds: [num(r[C['Round 1 (20%)']]), num(r[C['Round 2 (40%)']]), num(r[C['Round 3 (40%)']])],
      years: +r[C['Years lasted']] || 0, alive: String(r[C['Fate']]) === 'Thriving', repeat: r[C['Repeat']] === 'yes',
      finishedAt: r[C['Finished']] ? String(r[C['Finished']]) : '' }));
    out.sort((a, b) => b.score - a.score || b.years - a.years);
    return { ok: true, rows: out };
  }
  if (p.action === 'start') {
    if (findId(p.id) >= 0) return { ok: true, dup: true };
    const row = COLS.map(() => '');
    row[C['Game ID']] = p.id; row[C['Team']] = p.team; row[C['Lead phone']] = "'" + phone(p.phone);
    row[C['Laptop']] = p.laptop || ''; row[C['Status']] = 'Playing'; row[C['Level']] = 'Level 1'; row[C['City year']] = 0;
    row[C['Started']] = p.startedAt || new Date().toISOString(); row[C['Repeat']] = p.repeat === '1' ? 'yes' : '';
    sh.appendRow(row);
    return { ok: true };
  }
  const k = findId(p.id);
  if (k < 0) return { ok: false, error: 'unknown game id' };
  const row = k + 2;
  const set = (name, v) => sh.getRange(row, C[name] + 1).setValue(v);
  if (p.action === 'update') {
    if (rows[k][C['Status']] === 'Finished') return { ok: true, late: true }; // a late update never reopens a finished game
    set('Status', p.status || 'Playing'); set('Level', p.level || ''); set('City year', +p.year || 0);
    return { ok: true };
  }
  if (p.action === 'end') {
    set('Status', 'Finished'); set('Level', 'Done'); set('City year', +p.years || 0);
    set('Finished', p.finishedAt || new Date().toISOString());
    set('Final score', +p.score || 0); set('Round 1 (20%)', num(p.r1)); set('Round 2 (40%)', num(p.r2)); set('Round 3 (40%)', num(p.r3));
    set('Years lasted', +p.years || 0); set('Fate', p.fate || ''); set('Population', +p.pop || 0); set('SDG detail', p.sdg || '');
    return { ok: true };
  }
  return { ok: false, error: 'unknown action' };
}
