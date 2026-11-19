// Pravila igre "Potapanje brodova" za 2 igraca. Server samo prosledjuje poteze, sva logika je ovde.
const { GameError, COLORS, LOOKS } = require('./game');
const R = require('./public/brodovi-rules');

const fail = (msg) => { throw new GameError(msg); };
const DEFAULTS = { fleet: 'klasicna', again: true, touch: false, maxPlayers: 2, private: false };
const key = (x, y) => x + ',' + y;

class BattleshipGame {
  constructor(code, settings = {}) {
    this.kind = 'brodovi';
    this.code = code;
    this.players = [];
    this.settings = { ...DEFAULTS };
    this.applySettings(settings);
    this.phase = 'lobby'; // lobby | place | battle | ended
    this.turn = null; // id igraca koji gadja
    this.winner = null;
    this.round = 0;
    this.log = [];
    this.chat = [];
    this.lastActivity = Date.now();
  }

  // ---------- pomocne ----------
  p(pid) { return this.players.find((x) => x.id === pid); }
  other(pid) { return this.players.find((x) => x.id !== pid); }
  addLog(text) { this.log.push({ t: Date.now(), text }); if (this.log.length > 200) this.log.shift(); }
  hostId() {
    if (!this.players.some((p) => p.id === this.hostPid)) this.hostPid = this.players[0]?.id;
    return this.hostPid;
  }
  touchTimer() {} // ova igra nema tajmer poteza

  applySettings(s) {
    const st = this.settings;
    if (s.fleet && R.FLEETS[s.fleet]) st.fleet = s.fleet;
    if (s.again !== undefined) st.again = !!s.again;
    if (s.touch !== undefined) st.touch = !!s.touch;
  }

  uniqueName(n) {
    const taken = new Set(this.players.map((p) => p.name));
    if (!taken.has(n)) return n;
    for (let i = 2; ; i++) if (!taken.has(`${n} ${i}`)) return `${n} ${i}`;
  }

  addPlayer(name, token) {
    if (this.phase !== 'lobby') fail('Bitka je već počela.');
    if (this.players.length >= 2) fail('Soba je puna (2 igrača).');
    const used = new Set(this.players.map((p) => p.color));
    const pl = {
      id: 'p' + Math.random().toString(36).slice(2, 9),
      token,
      name: this.uniqueName(String(name || '').trim().slice(0, 16) || 'Igrač'),
      color: COLORS.find((c) => !used.has(c)),
      avatar: null,
      connected: true,
    };
    this.players.push(pl);
    this.addLog(`${pl.name} je ušao u sobu.`);
    return pl;
  }

  setLook(pl, { color, avatar, frame, title, win, winSound }) {
    for (const [k, v] of Object.entries({ frame, win, winSound })) if (v !== undefined && LOOKS[k].includes(v)) pl[k] = v;
    if (title !== undefined) pl.title = Math.max(0, Math.min(LOOKS.titles - 1, Math.floor(Number(title)) || 0));
    if (color !== undefined && COLORS.includes(color) && !this.players.some((p) => p.id !== pl.id && p.color === color)) pl.color = color;
    if (avatar !== undefined) pl.avatar = Math.max(0, Math.min(63, Math.floor(Number(avatar)) || 0));
  }

  // ---------- tok igre ----------
  start(pl) {
    if (this.phase !== 'lobby') fail('Bitka je već počela.');
    if (this.hostId() !== pl.id) fail('Samo osnivač sobe pokreće igru.');
    if (this.players.length < 2) fail('Čeka se drugi igrač.');
    this.newRound();
  }

  newRound() {
    this.phase = 'place';
    this.round++;
    this.turn = null;
    this.winner = null;
    this.forfeit = false;
    this.statsSaved = false;
    this.startedAt = null;
    this.endedAt = null;
    this.lastShot = null;
    for (const p of this.players) {
      p.ships = null; p.ready = false; p.rematch = false;
      p.shots = {}; // gadjanja protivnika po MOJOJ tabli: "x,y" -> 'miss' | 'hit' | 'auto'
      p.st = { shots: 0, hits: 0, sunk: 0 };
    }
    this.addLog(`⚓ ${this.round > 1 ? 'Revanš! ' : ''}Rasporedite brodove.`);
  }

  place(pl, ships) {
    if (this.phase !== 'place') fail('Brodovi se raspoređuju pre bitke.');
    const res = R.validFleet(ships, this.settings.fleet, this.settings.touch);
    if (typeof res === 'string') fail(res);
    pl.ships = res.map((s) => ({ ...s, hits: 0 }));
    pl.ready = true;
    this.addLog(`✅ ${pl.name} je spreman.`);
    if (this.players.length === 2 && this.players.every((p) => p.ready)) {
      this.phase = 'battle';
      this.startedAt = Date.now();
      // u revansu prvi gadja onaj ko je izgubio, inace nasumicno
      const first = this.lastLoser && this.p(this.lastLoser) ? this.p(this.lastLoser) : this.players[Math.floor(Math.random() * 2)];
      this.turn = first.id;
      this.addLog(`🔔 Bitka počinje! Prvi gađa ${first.name}.`);
    }
  }

  unready(pl) {
    if (this.phase !== 'place') fail('Bitka je već počela.');
    pl.ready = false; pl.ships = null;
  }

  shipAt(pl, x, y) { return pl.ships.find((s) => R.cellsOf(s).some(([a, b]) => a === x && b === y)); }

  shoot(pl, x, y) {
    if (this.phase !== 'battle') fail('Bitka nije u toku.');
    if (this.turn !== pl.id) fail('Nije tvoj red.');
    x = Math.floor(Number(x)); y = Math.floor(Number(y));
    if (!R.inside(x, y)) fail('To polje nije na tabli.');
    const foe = this.other(pl.id);
    if (foe.shots[key(x, y)]) fail('Tu si već gađao.');
    pl.st.shots++;
    const coord = 'ABCDEFGHIJ'[x] + (y + 1);
    const ship = this.shipAt(foe, x, y);
    this.lastShot = { by: pl.id, x, y, hit: !!ship, t: Date.now() };
    if (!ship) {
      foe.shots[key(x, y)] = 'miss';
      this.addLog(`🌊 ${pl.name} gađa ${coord}: promašaj.`);
      this.turn = foe.id;
      return;
    }
    foe.shots[key(x, y)] = 'hit';
    pl.st.hits++;
    ship.hits++;
    if (ship.hits >= ship.len) {
      pl.st.sunk++;
      this.lastShot.sunk = true;
      this.addLog(`🔥 ${pl.name} gađa ${coord}: brod potopljen (${ship.len} ${ship.len === 1 ? 'polje' : 'polja'})!`);
      // oko potopljenog broda ne moze biti drugi brod: oznaci ta polja kao prazna
      if (!this.settings.touch) {
        for (const [cx, cy] of R.cellsOf(ship)) for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
          const k = key(cx + dx, cy + dy);
          if (R.inside(cx + dx, cy + dy) && !foe.shots[k]) foe.shots[k] = 'auto';
        }
      }
      if (foe.ships.every((s) => s.hits >= s.len)) return this.finish(pl);
    } else this.addLog(`💥 ${pl.name} gađa ${coord}: pogodak!`);
    if (!this.settings.again) this.turn = foe.id;
  }

  finish(winner, forfeit = false) {
    this.phase = 'ended';
    this.winner = winner.id;
    this.forfeit = forfeit;
    this.turn = null;
    this.endedAt = Date.now();
    const loser = this.other(winner.id);
    this.lastLoser = loser?.id || null;
    this.addLog(forfeit ? `🏆 ${winner.name} pobeđuje jer je protivnik napustio bitku.` : `🏆 ${winner.name} je potopio celu flotu i pobedio!`);
  }

  rematch(pl) {
    if (this.phase !== 'ended') fail('Bitka još traje.');
    if (this.players.length < 2 || this.players.some((p) => p.quit)) fail('Protivnik je otišao. Napravi novu sobu.');
    pl.rematch = true;
    this.addLog(`🔁 ${pl.name} želi revanš.`);
    if (this.players.every((p) => p.rematch)) this.newRound();
  }

  quit(pl) {
    if (pl.quit) return;
    pl.quit = true;
    this.addLog(`🚪 ${pl.name} je napustio bitku.`);
    const foe = this.other(pl.id);
    if ((this.phase === 'place' || this.phase === 'battle') && foe && !foe.quit) this.finish(foe, true);
    else if (this.phase !== 'ended') { this.phase = 'ended'; this.turn = null; }
  }

  removePlayer(by, pid) {
    if (this.phase !== 'lobby') fail('Bitka je već počela.');
    if (by.id !== pid && this.hostId() !== by.id) fail('Samo osnivač sobe može da izbaci igrača.');
    const i = this.players.findIndex((p) => p.id === pid);
    if (i < 0) fail('Nema tog igrača.');
    const [p] = this.players.splice(i, 1);
    this.addLog(`${p.name} je izašao iz sobe.`);
  }

  emote(pl, e) {
    const n = Math.floor(Number(e));
    if (!(n >= 0 && n < 12)) fail('Nepoznata reakcija.');
    this.emotes ??= [];
    const last = this.emotes.filter((x) => x.pid === pl.id).pop();
    if (last && Date.now() - last.t < 1200) return;
    this.emotes.push({ pid: pl.id, e: n, t: Date.now() });
    if (this.emotes.length > 20) this.emotes.shift();
  }

  action(pid, type, data = {}) {
    this.lastActivity = Date.now();
    const pl = this.p(pid);
    if (!pl) fail('Nisi u ovoj sobi.');
    data = data || {};
    switch (type) {
      case 'chat': {
        const text = String(data.text || '').trim().slice(0, 300);
        if (text) { this.chat.push({ t: Date.now(), pid, name: pl.name, color: pl.color, text }); if (this.chat.length > 100) this.chat.shift(); }
        return;
      }
      case 'look': return this.setLook(pl, data);
      case 'emote': return this.emote(pl, data.e);
      case 'settings':
        if (this.phase !== 'lobby') fail('Bitka je već počela.');
        if (this.hostId() !== pl.id) fail('Samo osnivač sobe menja podešavanja.');
        return this.applySettings(data);
      case 'start': return this.start(pl);
      case 'kick': return this.removePlayer(pl, data.pid);
      case 'leave': return this.phase === 'lobby' ? this.removePlayer(pl, pl.id) : this.quit(pl);
      case 'place': return this.place(pl, data.ships);
      case 'unready': return this.unready(pl);
      case 'shoot': return this.shoot(pl, data.x, data.y);
      case 'rematch': return this.rematch(pl);
      default: fail('Nepoznata akcija.');
    }
  }

  // ---------- prikaz ----------
  summary() {
    const h = this.p(this.hostId());
    return {
      kind: this.kind, code: this.code, phase: this.phase, settings: this.settings,
      players: this.players.length,
      host: h ? { name: h.name, color: h.color, avatar: h.avatar ?? null } : null,
    };
  }

  // moja tabla: svi moji brodovi; protivnicka: samo gadjanja i potopljeni brodovi (na kraju se otkrije sve)
  viewFor(pid) {
    const me = this.p(pid), foe = this.other(pid);
    const showAll = this.phase === 'ended';
    const sunkShips = (pl) => (pl?.ships || []).filter((s) => showAll || s.hits >= s.len).map(({ x, y, len, dir, hits }) => ({ x, y, len, dir, sunk: hits >= len }));
    const fleetLeft = (pl) => (pl?.ships ? pl.ships.filter((s) => s.hits < s.len).map((s) => s.len).sort((a, b) => b - a) : null);
    return {
      kind: this.kind,
      code: this.code,
      phase: this.phase,
      me: pid,
      host: this.hostId(),
      settings: this.settings,
      round: this.round,
      now: Date.now(),
      startedAt: this.startedAt || null,
      endedAt: this.endedAt || null,
      turn: this.turn,
      winner: this.winner,
      forfeit: !!this.forfeit,
      lastShot: this.lastShot || null,
      players: this.players.map((p) => ({
        id: p.id, name: p.name, color: p.color, avatar: p.avatar ?? null, frame: p.frame || 'nema', title: p.title || 0,
        win: p.win || 'konfete', winSound: p.winSound || 'fanfara',
        connected: p.connected, quit: !!p.quit, ready: !!p.ready, rematch: !!p.rematch,
        st: p.st || { shots: 0, hits: 0, sunk: 0 }, left: fleetLeft(p),
      })),
      myShips: me?.ships ? me.ships.map(({ x, y, len, dir, hits }) => ({ x, y, len, dir, sunk: hits >= len })) : null,
      myShots: me?.shots || {}, // gadjanja protivnika po mojoj tabli
      foeShots: foe?.shots || {}, // moja gadjanja po protivnickoj tabli
      foeShips: sunkShips(foe),
      emotes: (this.emotes || []).filter((x) => Date.now() - x.t < 5000),
      log: this.log.slice(-60),
      chat: this.chat.slice(-60),
    };
  }
}

module.exports = { BattleshipGame };
