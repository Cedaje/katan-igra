// Profili igraca bez logina: svaki browser ima tajni token, a statistika se cuva na serveru pod tim tokenom.
// Kratak "kod profila" sluzi da se isti profil otvori na drugom uredjaju.
const fs = require('fs');
const path = require('path');

const FILE = process.env.PROFILE_FILE || path.join(__dirname, 'data', 'profiles.json');
let profiles = {}; // token -> { code, stats, prefs, updated }
let dirty = false;

try { profiles = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch (_) { profiles = {}; }

function save() {
  if (!dirty) return;
  dirty = false;
  try {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE + '.tmp', JSON.stringify(profiles));
    fs.renameSync(FILE + '.tmp', FILE);
  } catch (e) { console.error('profili nisu sacuvani', e.message); }
}
setInterval(save, 5000).unref();

const ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // bez slova koja lice na brojeve
function newCode() {
  for (;;) {
    let c = '';
    for (let i = 0; i < 8; i++) c += ABC[Math.floor(Math.random() * ABC.length)];
    c = c.slice(0, 4) + '-' + c.slice(4);
    if (!Object.values(profiles).some((p) => p.code === c)) return c;
  }
}
const emptyStats = () => ({ games: 0, wins: 0, points: 0, bestPoints: 0, bestRoad: 0, knights: 0, cities: 0, gained: 0, trades: 0, stolen: 0, bank: 0, streak: 0, bestStreak: 0, playMs: 0 });
const { unlocked } = require('./public/achievements');

const validToken = (t) => typeof t === 'string' && t.length >= 8 && t.length <= 64;

function get(token) {
  if (!validToken(token)) return null;
  if (!profiles[token]) { profiles[token] = { code: newCode(), stats: emptyStats(), prefs: {}, updated: Date.now() }; dirty = true; }
  const p = profiles[token];
  p.stats = { ...emptyStats(), ...p.stats };
  return p;
}

function publicView(token) {
  const p = get(token);
  return p ? { code: p.code, stats: p.stats, prefs: p.prefs, all: !!p.unlockAll, grant: p.grant || [], forcedName: p.forcedName || null, banned: !!p.banned } : null;
}

// licna podesavanja (ime, boja, lik, okvir...) da se prenesu na drugi uredjaj
function savePrefs(token, prefs) {
  const p = get(token); if (!p || !prefs || typeof prefs !== 'object') return;
  const json = JSON.stringify(prefs);
  if (json.length > 2000) return;
  p.prefs = JSON.parse(json); p.updated = Date.now(); dirty = true;
  if (p.forcedName) p.prefs.name = p.forcedName; // ime koje je postavio admin ostaje
}

// Nalog vlasnika igre: u kodu je samo otisak (hash) njegovog koda, ne i sam kod.
// Kad se taj kod prvi put upise (i posle brisanja podataka na serveru), nalog se napravi sa svim otkljucanim ukrasima.
const OWNER_HASH = '51524e7232c0fd54376eae6b9ad445bf7ceddc717932ae6180aa6cf64ce23b3b';
const isOwnerCode = (code) => require('crypto').createHash('sha256').update('ostrvo:' + code).digest('hex') === OWNER_HASH;

function claim(code) {
  code = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (code.length !== 8) return null;
  code = code.slice(0, 4) + '-' + code.slice(4);
  const e = Object.entries(profiles).find(([, p]) => p.code === code);
  if (e) return e[0];
  if (isOwnerCode(code)) {
    const t = 'own' + require('crypto').randomBytes(16).toString('hex');
    profiles[t] = { code, stats: emptyStats(), prefs: { name: 'Xu' }, unlockAll: true, updated: Date.now() };
    dirty = true;
    return t;
  }
  return null;
}

// posle zavrsene partije upisi rezultate svih igraca
function recordGame(game) {
  if (game.statsSaved || game.phase !== 'ended' || !game.winner) return;
  game.statsSaved = true;
  const dur = (game.endedAt || Date.now()) - (game.startedAt || Date.now());
  for (const pl of game.players) {
    const p = get(pl.token); if (!p) continue;
    const s = p.stats, st = game.stats?.players?.[pl.id] || {};
    const vp = game.totalVP(pl);
    s.games++;
    if (game.winner === pl.id) { s.wins++; s.streak++; s.bestStreak = Math.max(s.bestStreak, s.streak); } else s.streak = 0;
    s.stolen += st.stolen || 0;
    s.bank += st.bank || 0;
    s.points += vp;
    s.bestPoints = Math.max(s.bestPoints, vp);
    s.bestRoad = Math.max(s.bestRoad, game.roadLength(pl.id));
    s.knights += pl.knights;
    s.cities += 4 - pl.left.city;
    s.gained += st.gained || 0;
    s.trades += st.trades || 0;
    s.playMs += Math.max(0, dur);
    p.updated = Date.now();
  }
  dirty = true;
}

// ukrasi koje igrac jos nije otkljucao se ne prihvataju
function filterLook(token, data) {
  const p = get(token); if (!p || !data) return data;
  const u = unlocked(p.stats, p.unlockAll, p.grant), out = { ...data };
  if (out.frame !== undefined && !u.frames.has(out.frame)) delete out.frame;
  if (out.title !== undefined && !u.titles.has(Number(out.title))) delete out.title;
  return out;
}

// tabela najboljih: samo igraci sa bar jednom odigranom partijom
function leaderboard(myToken) {
  const rows = Object.entries(profiles).filter(([, p]) => p.stats && p.stats.games > 0 && !p.banned).map(([t, p]) => {
    const s = { ...emptyStats(), ...p.stats }, pr = p.prefs || {};
    return {
      me: t === myToken, name: String(pr.name || 'Igrač').slice(0, 16), color: pr.color || null, avatar: pr.avatar ?? null,
      frame: pr.frame || 'nema', title: pr.title || 0,
      games: s.games, wins: s.wins, pct: Math.round((s.wins / s.games) * 100), bestPoints: s.bestPoints, bestRoad: s.bestRoad, knights: s.knights,
    };
  });
  rows.sort((a, b) => b.wins - a.wins || b.pct - a.pct || b.games - a.games);
  rows.forEach((r, i) => { r.rank = i + 1; });
  return rows.slice(0, 100).concat(rows.slice(100).filter((r) => r.me));
}

// ---- admin (samo za vlasnika igre, preko /admin strane sa lozinkom) ----
const adminRow = (t, p) => ({ code: p.code, name: String((p.prefs && p.prefs.name) || '(bez imena)').slice(0, 16), avatar: p.prefs?.avatar ?? null,
  games: p.stats?.games || 0, wins: p.stats?.wins || 0, updated: p.updated || 0, all: !!p.unlockAll,
  banned: !!p.banned, forcedName: p.forcedName || null, grant: p.grant || [], stats: { ...emptyStats(), ...p.stats } });
const { ACH } = require('./public/achievements');
function adminSearch(q) {
  q = String(q || '').trim().toLowerCase();
  const qc = q.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return Object.entries(profiles)
    .filter(([, p]) => !q || String(p.prefs?.name || '').toLowerCase().includes(q) || (qc.length >= 4 && p.code.replace('-', '').includes(qc)))
    .sort((a, b) => (b[1].updated || 0) - (a[1].updated || 0))
    .slice(0, 50).map(([t, p]) => adminRow(t, p));
}
function adminUpdate(code, what, val) {
  const t = claim(code); if (!t) return null;
  const p = profiles[t];
  if (what === 'rename') {
    const n = String(val || '').trim().slice(0, 16);
    if (n) { p.forcedName = n; p.prefs = { ...p.prefs, name: n }; } else delete p.forcedName; // prazno = igrac opet bira ime sam
  } else if (what === 'ban') p.banned = true;
  else if (what === 'unban') delete p.banned;
  else if (what === 'resetStats') p.stats = emptyStats();
  else if (what === 'setStats') {
    if (!val || typeof val !== 'object') return null;
    const s = { ...emptyStats(), ...p.stats };
    for (const k of Object.keys(emptyStats())) if (val[k] !== undefined) s[k] = Math.max(0, Math.min(1e9, Math.floor(Number(val[k]) || 0)));
    if (s.wins > s.games) s.games = s.wins;
    p.stats = s;
  } else if (what === 'grant' || what === 'revoke') {
    if (!ACH.some((a) => a.id === val)) return null;
    const g = new Set(p.grant || []);
    if (what === 'grant') g.add(val); else g.delete(val);
    p.grant = [...g];
  }
  if (['rename', 'ban', 'unban', 'resetStats', 'setStats', 'grant', 'revoke'].includes(what)) { p.updated = Date.now(); dirty = true; return adminRow(t, p); }
  if (what === 'delete') { const row = adminRow(t, p); delete profiles[t]; dirty = true; return { ...row, deleted: true }; }
  if (what === 'unlockAll') p.unlockAll = true;
  else if (what === 'lock') delete p.unlockAll;
  else if (what === 'newCode') p.code = newCode(); // stari kod prestaje da radi
  else return null;
  p.updated = Date.now(); dirty = true;
  return adminRow(t, p);
}

// ime iz profila ako ga je admin zakljucao; blokirani igraci ne mogu u sobe
// (i zapamti ime kojim je igrac usao u sobu, da admin moze da ga nadje po imenu)
function nameFor(token, name) {
  const p = get(token); if (!p) return name;
  if (p.forcedName) return p.forcedName;
  const n = String(name || '').trim().slice(0, 16);
  if (n && p.prefs.name !== n) { p.prefs = { ...p.prefs, name: n }; p.updated = Date.now(); dirty = true; }
  return name;
}
const isBanned = (token) => !!(validToken(token) && profiles[token]?.banned);

// obavestenje za sve igrace na pocetnom ekranu
const ANN_FILE = path.join(path.dirname(FILE), 'announce.json');
let announce = null;
try { announce = JSON.parse(fs.readFileSync(ANN_FILE, 'utf8')); } catch (_) { announce = null; }
function setAnnounce(text) {
  text = String(text || '').trim().slice(0, 300);
  announce = text ? { text, at: Date.now() } : null;
  try { fs.mkdirSync(path.dirname(ANN_FILE), { recursive: true }); fs.writeFileSync(ANN_FILE, JSON.stringify(announce)); } catch (e) { console.error('obavestenje nije sacuvano', e.message); }
  return announce;
}
const getAnnounce = () => announce;

module.exports = { nameFor, isBanned, setAnnounce, getAnnounce, adminSearch, adminUpdate, filterLook, leaderboard, publicView, savePrefs, claim, recordGame, save };
