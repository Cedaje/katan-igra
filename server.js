const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const { Game, GameError } = require('./game');
const { timeoutTick } = require('./bot');
const PROFILES = require('./profiles');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));
app.get('/health', (_req, res) => res.send('ok'));

// ---- admin strana: lozinka je u promenljivoj ADMIN_PASSWORD na serveru (nikad u kodu) ----
const crypto = require('crypto');
const adminFails = new Map(); // ip -> { n, until }
function adminOk(req) {
  const pass = process.env.ADMIN_PASSWORD;
  if (!pass || pass.length < 6) return 'off';
  const ip = req.ip || 'x', f = adminFails.get(ip) || { n: 0, until: 0 };
  if (f.until > Date.now()) return 'wait';
  const a = crypto.createHash('sha256').update(String(req.get('x-admin') || '')).digest();
  const b = crypto.createHash('sha256').update(pass).digest();
  if (crypto.timingSafeEqual(a, b)) { adminFails.delete(ip); return 'ok'; }
  f.n++; if (f.n >= 5) { f.until = Date.now() + 10 * 60 * 1000; f.n = 0; }
  adminFails.set(ip, f);
  return 'bad';
}
app.get('/admin', (_req, res) => res.sendFile(path.join(__dirname, 'admin.html')));
app.post('/admin/api', express.json({ limit: '2kb' }), (req, res) => {
  const ok = adminOk(req);
  if (ok === 'off') return res.status(403).json({ error: 'Admin strana nije uključena. Na serveru dodaj promenljivu ADMIN_PASSWORD (bar 6 znakova).' });
  if (ok === 'wait') return res.status(429).json({ error: 'Previše pogrešnih lozinki. Probaj ponovo za 10 minuta.' });
  if (ok === 'bad') return res.status(401).json({ error: 'Pogrešna lozinka.' });
  const { op, q, code, what, val, pid } = req.body || {};
  if (op === 'search') return res.json({ rows: PROFILES.adminSearch(q) });
  if (op === 'update') {
    const row = PROFILES.adminUpdate(code, what, val);
    if (row && what === 'ban') kickToken(PROFILES.claim(code));
    return row ? res.json({ row }) : res.status(404).json({ error: 'Profil nije nađen.' });
  }
  if (op === 'rooms') return res.json({ rooms: adminRooms() });
  if (op === 'kick' || op === 'close') {
    const game = games.get(String(code || ''));
    if (!game) return res.status(404).json({ error: 'Soba više ne postoji.' });
    if (op === 'kick') adminKick(game, Number(pid)); else adminClose(game);
    return res.json({ rooms: adminRooms() });
  }
  if (op === 'announce') { const a = PROFILES.setAnnounce(val); io.emit('announce', a); return res.json({ announce: a }); }
  if (op === 'getAnnounce') return res.json({ announce: PROFILES.getAnnounce() });
  res.status(400).json({ error: 'Nepoznata komanda.' });
});

const fs = require('fs');
const games = new Map(); // code -> Game

// ---------- cuvanje partija na disk (da prezive restart servera) ----------
const SAVE_FILE = process.env.SAVE_FILE || path.join(__dirname, 'data', 'games.json');
let dirty = false;
function saveGames() {
  if (!dirty) return;
  dirty = false;
  try {
    fs.mkdirSync(path.dirname(SAVE_FILE), { recursive: true });
    const list = [...games.values()].filter((g) => g.phase !== 'ended').map((g) => {
      const { botTimer, ...data } = g; // eslint-disable-line no-unused-vars
      return data;
    });
    fs.writeFileSync(SAVE_FILE + '.tmp', JSON.stringify(list));
    fs.renameSync(SAVE_FILE + '.tmp', SAVE_FILE);
  } catch (e) { console.error('cuvanje nije uspelo', e.message); }
}
function loadGames() {
  try {
    const list = JSON.parse(fs.readFileSync(SAVE_FILE, 'utf8'));
    for (const data of list) {
      const g = Object.assign(Object.create(Game.prototype), data);
      g.emptySince = Date.now();
      g.botTimer = null;
      for (const p of g.players) p.connected = false;
      games.set(g.code, g);
    }
    if (list.length) console.log(`Učitano ${list.length} sačuvanih partija.`);
  } catch (e) { if (e.code !== 'ENOENT') console.error('ucitavanje nije uspelo', e.message); }
}
loadGames();
setInterval(saveGames, 5000);
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => { dirty = true; saveGames(); PROFILES.save(); process.exit(0); });

function newCode() {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code;
  do code = Array.from({ length: 4 }, () => letters[Math.floor(Math.random() * letters.length)]).join('');
  while (games.has(code));
  return code;
}

const roomSockets = (code) => [...io.of('/').sockets.values()].filter((s) => s.data.code === code);

function roomList() {
  return [...games.values()]
    .filter((g) => g.phase === 'lobby' && !g.settings.private && g.players.length)
    .map((g) => ({ ...g.summary(), names: g.players.map((p) => p.name) }));
}
function sendRooms(target = io) { target.emit('rooms', roomList()); }

function broadcast(game) {
  const online = new Set(roomSockets(game.code).map((s) => s.data.pid));
  for (const p of game.players) p.connected = online.has(p.id);
  if (online.size && game.emptySince) { game.timerKey = null; game.touchTimer(); } // igra se nastavlja: novo vreme za potez
  game.emptySince = online.size ? null : (game.emptySince || Date.now());
  dirty = true;
  if (game.phase === 'ended') PROFILES.recordGame(game);
  for (const sock of roomSockets(game.code)) sock.emit('state', game.viewFor(sock.data.pid));
}

// Tajmer poteza
setInterval(() => {
  for (const g of games.values()) {
    if (g.emptySince) continue; // niko nije tu: igra je pauzirana
    if (g.vote && Date.now() > g.vote.until && g.resolveVote()) broadcast(g);
    try { if (timeoutTick(g)) broadcast(g); } catch (e) { console.error('timer', e); }
  }
}, 500);

// ---- admin: sobe ----
function adminRooms() {
  return [...games.values()].sort((a, b) => b.lastActivity - a.lastActivity).map((g) => ({
    code: g.code, phase: g.phase, map: g.settings.map, last: g.lastActivity,
    players: g.players.map((p) => ({ id: p.id, name: p.name, connected: !!p.connected, out: !!(p.quit || p.kicked) })),
  }));
}
function adminKick(game, pid) {
  const pl = game.p(pid); if (!pl) return;
  if (game.phase === 'lobby') { game.players = game.players.filter((p) => p.id !== pid); game.addLog(`${pl.name} je izbačen iz sobe.`); }
  else if (!pl.kicked) { pl.kicked = true; game.addLog(`🥾 ${pl.name} je izbačen iz igre.`); if (!pl.quit) game.quit(pl); }
  for (const s of roomSockets(game.code)) if (s.data.pid === pid) { s.emit('kicked'); s.leave(game.code); s.data = {}; }
  if (!game.players.length || game.players.every((p) => p.quit)) games.delete(game.code); else broadcast(game);
  sendRooms();
}
function adminClose(game) {
  for (const s of roomSockets(game.code)) { s.emit('kicked', { msg: 'Sobu je zatvorio administrator.' }); s.leave(game.code); s.data = {}; }
  games.delete(game.code); dirty = true;
  sendRooms();
}
// blokiran igrac izlazi iz svih soba u kojima je
function kickToken(token) {
  if (!token) return;
  for (const g of [...games.values()]) { const pl = g.players.find((p) => p.token === token); if (pl) adminKick(g, pl.id); }
}

// Posalji izbacene igrace nazad na listu soba
function kickOut(game) {
  for (const s of roomSockets(game.code)) {
    const p = game.p(s.data.pid);
    if (p && p.kicked) { s.emit('kicked'); s.leave(game.code); s.data = {}; }
  }
}

function leaveRoom(socket) {
  const game = games.get(socket.data.code);
  socket.leave(socket.data.code);
  socket.data = {};
  if (!game) return;
  if (!game.players.length || game.players.every((p) => p.quit)) games.delete(game.code);
  else broadcast(game);
  sendRooms();
}

const BANNED = 'Tvoj nalog je blokirao administrator igre.';
io.on('connection', (socket) => {
  socket.data = {};
  const reply = (cb, payload) => typeof cb === 'function' && cb(payload);
  sendRooms(socket);
  if (PROFILES.getAnnounce()) socket.emit('announce', PROFILES.getAnnounce());

  socket.on('rooms', () => sendRooms(socket));

  // profil bez logina: token iz browsera je kljuc, kod profila prenosi profil na drugi uredjaj
  socket.on('profile', ({ token, prefs } = {}, cb) => {
    if (prefs) PROFILES.savePrefs(token, prefs);
    reply(cb, { ok: true, profile: PROFILES.publicView(token) });
  });
  socket.on('leaderboard', ({ token } = {}, cb) => reply(cb, { ok: true, rows: PROFILES.leaderboard(token) }));
  socket.on('claimProfile', ({ code } = {}, cb) => {
    const token = PROFILES.claim(code);
    reply(cb, token ? { ok: true, token, profile: PROFILES.publicView(token) } : { ok: false, error: 'Ne postoji profil sa tim kodom.' });
  });

  socket.on('create', ({ name, token, settings } = {}, cb) => {
    if (PROFILES.isBanned(token)) return reply(cb, { ok: false, error: BANNED });
    name = PROFILES.nameFor(token, name);
    const code = newCode();
    const game = new Game(code, settings || {});
    games.set(code, game);
    const pl = game.addPlayer(name, token);
    socket.data = { code, pid: pl.id };
    socket.join(code);
    reply(cb, { ok: true, code });
    broadcast(game);
    sendRooms();
  });

  socket.on('join', ({ code, name, token, rejoinOnly } = {}, cb) => {
    code = String(code || '').toUpperCase().trim();
    const game = games.get(code);
    if (!game) return reply(cb, { ok: false, error: 'Soba ne postoji. Proveri kod.' });
    if (PROFILES.isBanned(token)) return reply(cb, { ok: false, error: BANNED });
    name = PROFILES.nameFor(token, name);
    let pl = token && game.players.find((p) => p.token === token);
    if (!pl && rejoinOnly) return reply(cb, { ok: false });
    if (pl && pl.kicked) return reply(cb, { ok: false, error: 'Izbačen si iz ove igre glasanjem.' });
    if (pl && pl.quit) { pl.quit = false; game.addLog(`${pl.name} se vratio u igru.`); }
    if (!pl) {
      try { pl = game.addPlayer(name, token); } catch (e) { return reply(cb, { ok: false, error: e.message }); }
    }
    socket.data = { code, pid: pl.id };
    socket.join(code);
    reply(cb, { ok: true, code });
    broadcast(game);
    sendRooms();
  });

  socket.on('action', ({ type, data } = {}, cb) => {
    const game = games.get(socket.data.code);
    if (!game) return reply(cb, { ok: false, error: 'Nisi u sobi.' });
    try {
      if (type === 'look') data = PROFILES.filterLook(game.p(socket.data.pid)?.token, data);
      game.action(socket.data.pid, type, data);
      reply(cb, { ok: true });
    } catch (e) {
      if (!(e instanceof GameError)) console.error(e);
      return reply(cb, { ok: false, error: e instanceof GameError ? e.message : 'Greška na serveru.' });
    }
    if (type === 'leave') return leaveRoom(socket);
    if (type === 'kick' || type === 'vote' || type === 'voteKick') kickOut(game);
    if (type === 'kick') {
      for (const s of roomSockets(game.code)) if (!game.p(s.data.pid)) { s.emit('kicked'); s.leave(game.code); s.data = {}; }
    }
    broadcast(game);
    if (['settings', 'kick', 'start'].includes(type)) sendRooms();
  });

  socket.on('disconnect', () => {
    const game = games.get(socket.data.code);
    if (game) setTimeout(() => broadcast(game), 0);
  });
});

// Brisanje starih soba (3 sata bez aktivnosti)
setInterval(() => {
  const now = Date.now();
  for (const [code, g] of games) {
    if (now - g.lastActivity > 3 * 3600 * 1000 || (g.emptySince && now - g.emptySince > 30 * 60 * 1000)) games.delete(code);
  }
  sendRooms();
}, 60 * 1000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Ostrvo Trgovaca radi na http://localhost:${PORT}`));
