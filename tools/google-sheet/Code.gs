/**
 * EcoCity: Build to Last — live organiser sheet.
 * Paste into Extensions → Apps Script of a new Google Sheet, run setup() once, then
 * Deploy → New deployment → Web app (Execute as: Me, Who has access: Anyone).
 * Copy the web app URL into the game (Organiser → Game settings → Google Sheet link).
 *
 * The game calls this URL with GET parameters:
 *   action=check  team, roll            → { ok, taken, repeat }
 *   action=start  id, team, roll, phone, laptop, startedAt, repeat
 *   action=update id, status, level, year
 *   action=end    id, score, years, fate, pop, finishedAt, sdg (JSON)
 * KEY below must match the key in the game settings (stops random people writing rows).
 */
const KEY = 'ecocity-2026';
const LIVE = 'Live';
const BOARD = 'Leaderboard';
const COLS = ['Game ID', 'Team', 'Lead roll no.', 'Phone', 'Laptop', 'Status', 'Level', 'City year', 'Started', 'Finished', 'SDG score', 'Years lasted', 'Fate', 'Population', 'Repeat', 'SDG detail'];

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let live = ss.getSheetByName(LIVE) || ss.insertSheet(LIVE);
  live.clear();
  live.getRange(1, 1, 1, COLS.length).setValues([COLS]).setFontWeight('bold').setBackground('#1d4d74').setFontColor('#ffffff');
  live.setFrozenRows(1);
  live.setColumnWidths(1, COLS.length, 120);
  let board = ss.getSheetByName(BOARD) || ss.insertSheet(BOARD);
  board.clear();
  board.getRange('A1:G1').setValues([['Rank', 'Team', 'Lead roll no.', 'SDG score', 'Years lasted', 'Fate', 'Finished']]).setFontWeight('bold').setBackground('#2e9a43').setFontColor('#ffffff');
  board.setFrozenRows(1);
  // finished games only, best score first, ties broken by years lasted; repeats are listed but marked
  board.getRange('B2').setFormula('=IFERROR(SORT(FILTER({' + LIVE + '!B2:B&IF(' + LIVE + '!O2:O="yes"," (repeat)",""),' + LIVE + '!C2:C,' + LIVE + '!K2:K,' + LIVE + '!L2:L,' + LIVE + '!M2:M,' + LIVE + '!J2:J},' + LIVE + '!F2:F="Finished"),3,FALSE,4,FALSE),"No finished games yet")');
  board.getRange('A2').setFormula('=IF(B2="No finished games yet","",SEQUENCE(COUNTA(B2:B)))');
  board.setColumnWidths(1, 7, 140);
}

function doGet(e) {
  const p = (e && e.parameter) || {};
  let out;
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    out = handle(p);
  } catch (err) {
    out = { ok: false, error: String(err) };
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function norm(s) { return String(s || '').trim().toLowerCase(); }

function handle(p) {
  if (p.key !== KEY) return { ok: false, error: 'bad key' };
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(LIVE);
  if (!sh) return { ok: false, error: 'run setup() first' };
  const last = sh.getLastRow();
  const rows = last > 1 ? sh.getRange(2, 1, last - 1, COLS.length).getValues() : [];
  const findId = id => rows.findIndex(r => String(r[0]) === String(id));

  if (p.action === 'check') {
    const same = rows.filter(r => norm(r[1]) === norm(p.team));
    if (!same.length) return { ok: true, taken: false };
    // the same team (same lead roll number) may play again: it is marked as a repeat
    const sameTeam = same.every(r => norm(r[2]) === norm(p.roll));
    return { ok: true, taken: !sameTeam, repeat: sameTeam };
  }
  if (p.action === 'start') {
    if (findId(p.id) >= 0) return { ok: true, dup: true };
    sh.appendRow([p.id, p.team, p.roll, "'" + (p.phone || ''), p.laptop || '', 'Playing', 'Level 1', 0, p.startedAt || new Date().toISOString(), '', '', '', '', '', p.repeat === '1' ? 'yes' : '', '']);
    return { ok: true };
  }
  const k = findId(p.id);
  if (k < 0) return { ok: false, error: 'unknown game id' };
  const row = k + 2;
  if (p.action === 'update') {
    sh.getRange(row, 6, 1, 3).setValues([[p.status || 'Playing', p.level || '', +p.year || 0]]);
    return { ok: true };
  }
  if (p.action === 'end') {
    sh.getRange(row, 6, 1, 3).setValues([['Finished', 'Done', +p.years || 0]]);
    sh.getRange(row, 10, 1, 5).setValues([[p.finishedAt || new Date().toISOString(), +p.score || 0, +p.years || 0, p.fate || '', +p.pop || 0]]);
    sh.getRange(row, 16).setValue(p.sdg || '');
    return { ok: true };
  }
  return { ok: false, error: 'unknown action' };
}
