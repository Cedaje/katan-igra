const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const { Game, GameError } = require('./game');
const { timeoutTick } = require('./bot');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));
app.get('/health', (_req, res) => res.send('ok'));

const games = new Map(); // code -> Game

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
  game.emptySince = online.size ? null : (game.emptySince || Date.now());
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

io.on('connection', (socket) => {
  socket.data = {};
  const reply = (cb, payload) => typeof cb === 'function' && cb(payload);
  sendRooms(socket);

  socket.on('rooms', () => sendRooms(socket));

  socket.on('create', ({ name, token, settings } = {}, cb) => {
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
