const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const { Game, GameError } = require('./game');

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

function broadcast(game) {
  for (const [, sock] of io.of('/').sockets) {
    if (sock.data.code === game.code) sock.emit('state', game.viewFor(sock.data.pid));
  }
}

function setConnected(game, pid) {
  const online = new Set();
  for (const [, s] of io.of('/').sockets) if (s.data.code === game.code) online.add(s.data.pid);
  for (const p of game.players) p.connected = online.has(p.id);
}

io.on('connection', (socket) => {
  const reply = (cb, payload) => typeof cb === 'function' && cb(payload);

  socket.on('create', ({ name, token } = {}, cb) => {
    const code = newCode();
    const game = new Game(code);
    games.set(code, game);
    const pl = game.addPlayer(name, token);
    socket.data = { code, pid: pl.id };
    socket.join(code);
    setConnected(game);
    reply(cb, { ok: true, code });
    broadcast(game);
  });

  socket.on('join', ({ code, name, token, rejoinOnly } = {}, cb) => {
    code = String(code || '').toUpperCase().trim();
    const game = games.get(code);
    if (!game) return reply(cb, { ok: false, error: 'Soba ne postoji. Proveri kod.' });
    let pl = token && game.players.find((p) => p.token === token);
    if (!pl && rejoinOnly) return reply(cb, { ok: false });
    if (!pl) {
      try { pl = game.addPlayer(name, token); } catch (e) { return reply(cb, { ok: false, error: e.message }); }
    }
    socket.data = { code, pid: pl.id };
    socket.join(code);
    setConnected(game);
    reply(cb, { ok: true, code });
    broadcast(game);
  });

  socket.on('action', ({ type, data } = {}, cb) => {
    const game = games.get(socket.data?.code);
    if (!game) return reply(cb, { ok: false, error: 'Nisi u sobi.' });
    try {
      game.action(socket.data.pid, type, data);
      reply(cb, { ok: true });
    } catch (e) {
      if (!(e instanceof GameError)) console.error(e);
      return reply(cb, { ok: false, error: e instanceof GameError ? e.message : 'Greška na serveru.' });
    }
    broadcast(game);
  });

  socket.on('disconnect', () => {
    const game = games.get(socket.data?.code);
    if (!game) return;
    setTimeout(() => { setConnected(game); broadcast(game); }, 0);
  });
});

// Brisanje starih soba (6 sati bez aktivnosti)
setInterval(() => {
  const now = Date.now();
  for (const [code, g] of games) if (now - g.lastActivity > 6 * 3600 * 1000) games.delete(code);
}, 10 * 60 * 1000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Ostrvo Trgovaca radi na http://localhost:${PORT}`));
