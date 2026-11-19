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
  return p ? { code: p.code, stats: p.stats, prefs: p.prefs } : null;
}

// licna podesavanja (ime, boja, lik, okvir...) da se prenesu na drugi uredjaj
function savePrefs(token, prefs) {
  const p = get(token); if (!p || !prefs || typeof prefs !== 'object') return;
  const json = JSON.stringify(prefs);
  if (json.length > 2000) return;
  p.prefs = JSON.parse(json); p.updated = Date.now(); dirty = true;
}

function claim(code) {
  code = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (code.length !== 8) return null;
  code = code.slice(0, 4) + '-' + code.slice(4);
  const e = Object.entries(profiles).find(([, p]) => p.code === code);
  return e ? e[0] : null;
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
  const u = unlocked(p.stats), out = { ...data };
  if (out.frame !== undefined && !u.frames.has(out.frame)) delete out.frame;
  if (out.title !== undefined && !u.titles.has(Number(out.title))) delete out.title;
  return out;
}

// tabela najboljih: samo igraci sa bar jednom odigranom partijom
function leaderboard(myToken) {
  const rows = Object.entries(profiles).filter(([, p]) => p.stats && p.stats.games > 0).map(([t, p]) => {
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

module.exports = { filterLook, leaderboard, publicView, savePrefs, claim, recordGame, save };
