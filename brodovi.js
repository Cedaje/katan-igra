// Pravila igre "Potapanje brodova" za 2 igraca. Server samo prosledjuje poteze, sva logika je ovde.
const { GameError, COLORS, LOOKS } = require('./game');
const R = require('./public/brodovi-rules');

const fail = (msg) => { throw new GameError(msg); };
// timer = sekunde za jedno gadjanje (0 = bez), size = velicina table, salvo = gadjanja po potezu koliko ti je brodova ostalo,
// special = jednom po partiji radar (pokaze koliko polja broda ima u 3x3) i bomba (gadja 3x3)
const DEFAULTS = { fleet: 'klasicna', again: true, touch: false, size: 10, salvo: false, special: false, timer: 0, maxPlayers: 2, private: false };
const TIMERS = [0, 15, 30, 60];
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
    this.shotSeq = 0;
    this.deadline = null;
    this.log = [];
    this.chat = [];
    this.lastActivity = Date.now();
  }

  // ---------- pomocne ----------
  get n() { return this.settings.size || 10; }
  p(pid) { return this.players.find((x) => x.id === pid); }
  other(pid) { return this.players.find((x) => x.id !== pid); }
  addLog(text) { this.log.push({ t: Date.now(), text }); if (this.log.length > 200) this.log.shift(); }
  hostId() {
    if (!this.players.some((p) => p.id === this.hostPid)) this.hostPid = this.players[0]?.id;
    return this.hostPid;
  }

  applySettings(s) {
    const st = this.settings;
    if (s.fleet && R.FLEETS[s.fleet]) st.fleet = s.fleet;
    if (s.again !== undefined) st.again = !!s.again;
    if (s.touch !== undefined) st.touch = !!s.touch;
    if (s.salvo !== undefined) st.salvo = !!s.salvo;
    if (s.special !== undefined) st.special = !!s.special;
    if (s.size !== undefined && R.SIZES.includes(Number(s.size))) st.size = Number(s.size);
    if (s.timer !== undefined && TIMERS.includes(Number(s.timer))) st.timer = Number(s.timer);
  }

  // ---------- tajmer: kad istekne vreme, igra gadja nasumicno umesto igraca ----------
  touchTimer() {
    if (!this.settings.timer || this.phase !== 'battle') { this.deadline = null; this.timerKey = null; return; }
    const k = `${this.turn}|${this.shotSeq}`;
    if (k === this.timerKey) return;
    this.timerKey = k;
    this.deadline = Date.now() + this.settings.timer * 1000;
  }
  tick() {
    if (this.phase !== 'battle' || !this.deadline || Date.now() < this.deadline) return false;
    const pl = this.p(this.turn), foe = this.other(this.turn);
    const free = [];
    for (let y = 0; y < this.n; y++) for (let x = 0; x < this.n; x++) if (!foe.shots[key(x, y)]) free.push([x, y]);
    if (!free.length) return false;
    this.addLog(`⏰ ${pl.name}: isteklo vreme, igra gađa umesto njega.`);
    const [x, y] = free[Math.floor(Math.random() * free.length)];
    this.lastActivity = Date.now();
    this.fire(pl, x, y, 'shot');
    this.touchTimer();
    return true;
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
    this.deadline = null;
    for (const p of this.players) {
      p.ships = null; p.ready = false; p.rematch = false;
      p.shots = {}; // gadjanja protivnika po MOJOJ tabli: "x,y" -> 'miss' | 'hit' | 'auto'
      p.radars = []; // radar protivnika po mojoj tabli: { x, y, n }
      p.st = { shots: 0, hits: 0, sunk: 0 };
      p.radar = this.settings.special ? 1 : 0; // preostali specijalni hici
      p.bomb = this.settings.special ? 1 : 0;
    }
    this.addLog(`⚓ ${this.round > 1 ? 'Revanš! ' : ''}Rasporedite brodove.`);
  }

  place(pl, ships) {
    if (this.phase !== 'place') fail('Brodovi se raspoređuju pre bitke.');
    const res = R.validFleet(ships, this.settings.fleet, this.settings.touch, this.n);
    if (typeof res === 'string') fail(res);
    pl.ships = res.map((s) => ({ ...s, hits: 0 }));
    pl.ready = true;
    this.addLog(`✅ ${pl.name} je spreman.`);
    if (this.players.length === 2 && this.players.every((p) => p.ready)) {
      this.phase = 'battle';
      this.startedAt = Date.now();
      // u revansu prvi gadja onaj ko je izgubio, inace nasumicno
      const first = this.lastLoser && this.p(this.lastLoser) ? this.p(this.lastLoser) : this.players[Math.floor(Math.random() * 2)];
      this.addLog(`🔔 Bitka počinje! Prvi gađa ${first.name}.`);
      this.startTurn(first);
    }
  }

  // salva: u jednom potezu gadjas onoliko puta koliko ti je brodova jos na vodi
  afloat(pl) { return (pl.ships || []).filter((s) => s.hits < s.len).length; }
  startTurn(pl) {
    this.turn = pl.id;
    this.shotsLeft = this.settings.salvo ? Math.max(1, this.afloat(pl)) : 1;
  }

  unready(pl) {
    if (this.phase !== 'place') fail('Bitka je već počela.');
    pl.ready = false; pl.ships = null;
  }

  shipAt(pl, x, y) { return pl.ships.find((s) => R.cellsOf(s).some(([a, b]) => a === x && b === y)); }

  shoot(pl, x, y, kind = 'shot') {
    if (this.phase !== 'battle') fail('Bitka nije u toku.');
    if (this.turn !== pl.id) fail('Nije tvoj red.');
    x = Math.floor(Number(x)); y = Math.floor(Number(y));
    if (!R.inside(x, y, this.n)) fail('To polje nije na tabli.');
    const foe = this.other(pl.id);
    if (kind === 'radar' || kind === 'bomb') {
      if (!this.settings.special) fail('Specijalni hici nisu uključeni u ovoj sobi.');
      if (!(pl[kind] > 0)) fail(kind === 'radar' ? 'Radar si već iskoristio.' : 'Bombu si već iskoristio.');
      if (kind === 'bomb' && R.area3(x, y, this.n).every(([a, b]) => foe.shots[key(a, b)])) fail('Tu je sve već gađano.');
    } else {
      kind = 'shot';
      if (foe.shots[key(x, y)]) fail('Tu si već gađao.');
    }
    this.fire(pl, x, y, kind);
  }

  // gadjanje jednog polja; vraca true ako je pogodak
  hitCell(pl, foe, x, y, sunkList) {
    pl.st.shots++;
    const ship = this.shipAt(foe, x, y);
    if (!ship) { foe.shots[key(x, y)] = 'miss'; return false; }
    foe.shots[key(x, y)] = 'hit';
    pl.st.hits++;
    ship.hits++;
    if (ship.hits >= ship.len) {
      pl.st.sunk++;
      sunkList.push(ship);
      // oko potopljenog broda ne moze biti drugi brod: oznaci ta polja kao prazna
      if (!this.settings.touch) {
        for (const [cx, cy] of R.cellsOf(ship)) for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
          const k = key(cx + dx, cy + dy);
          if (R.inside(cx + dx, cy + dy, this.n) && !foe.shots[k]) foe.shots[k] = 'auto';
        }
      }
    }
    return true;
  }

  fire(pl, x, y, kind) {
    const foe = this.other(pl.id);
    const coord = R.coord(x, y);
    this.shotSeq++;
    let hit = false;
    const sunk = [];
    if (kind === 'radar') {
      pl.radar--;
      const n = R.area3(x, y, this.n).filter(([a, b]) => this.shipAt(foe, a, b)).length;
      foe.radars.push({ x, y, n });
      this.lastShot = { by: pl.id, x, y, kind, t: Date.now() };
      this.addLog(`📡 ${pl.name} skenira radarom oko ${coord}: ${n ? `${n} ${n === 1 ? 'polje' : n < 5 ? 'polja' : 'polja'} broda` : 'nema brodova'}.`);
    } else if (kind === 'bomb') {
      pl.bomb--;
      let hits = 0;
      for (const [a, b] of R.area3(x, y, this.n)) if (!foe.shots[key(a, b)]) { if (this.hitCell(pl, foe, a, b, sunk)) hits++; }
      hit = hits > 0;
      this.lastShot = { by: pl.id, x, y, kind, hit, t: Date.now() };
      this.addLog(`💣 ${pl.name} baca bombu na ${coord}: ${hits ? `${hits} ${hits === 1 ? 'pogodak' : 'pogotka'}` : 'sve promašeno'}${sunk.length ? `, potopljeno brodova: ${sunk.length}` : ''}!`);
    } else {
      hit = this.hitCell(pl, foe, x, y, sunk);
      this.lastShot = { by: pl.id, x, y, kind, hit, t: Date.now() };
      if (!hit) this.addLog(`🌊 ${pl.name} gađa ${coord}: promašaj.`);
      else if (sunk.length) this.addLog(`🔥 ${pl.name} gađa ${coord}: brod potopljen (${sunk[0].len} ${sunk[0].len === 1 ? 'polje' : 'polja'})!`);
      else this.addLog(`💥 ${pl.name} gađa ${coord}: pogodak!`);
    }
    if (sunk.length) this.lastShot.sunk = true;
    if (foe.ships.every((s) => s.hits >= s.len)) return this.finish(pl);
    // ko gadja dalje
    if (this.settings.salvo) {
      this.shotsLeft--;
      if (this.shotsLeft <= 0) this.startTurn(foe);
    } else if (!(hit && this.settings.again)) this.startTurn(foe);
  }

  finish(winner, forfeit = false) {
    this.phase = 'ended';
    this.winner = winner.id;
    this.forfeit = forfeit;
    this.turn = null;
    this.deadline = null;
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
    try { return this.doAction(pid, type, data); } finally { this.touchTimer(); }
  }

  doAction(pid, type, data = {}) {
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
      case 'shoot': return this.shoot(pl, data.x, data.y, data.kind);
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
      settings: { ...DEFAULTS, ...this.settings },
      round: this.round,
      now: Date.now(),
      deadline: this.deadline,
      startedAt: this.startedAt || null,
      endedAt: this.endedAt || null,
      turn: this.turn,
      shotsLeft: this.phase === 'battle' ? this.shotsLeft || 1 : 0,
      winner: this.winner,
      forfeit: !!this.forfeit,
      lastShot: this.lastShot || null,
      players: this.players.map((p) => ({
        id: p.id, name: p.name, color: p.color, avatar: p.avatar ?? null, frame: p.frame || 'nema', title: p.title || 0,
        win: p.win || 'konfete', winSound: p.winSound || 'fanfara',
        connected: p.connected, quit: !!p.quit, ready: !!p.ready, rematch: !!p.rematch,
        st: p.st || { shots: 0, hits: 0, sunk: 0 }, left: fleetLeft(p), radar: p.radar || 0, bomb: p.bomb || 0,
      })),
      myShips: me?.ships ? me.ships.map(({ x, y, len, dir, hits }) => ({ x, y, len, dir, sunk: hits >= len })) : null,
      myShots: me?.shots || {}, // gadjanja protivnika po mojoj tabli
      myRadars: me?.radars || [],
      foeShots: foe?.shots || {}, // moja gadjanja po protivnickoj tabli
      foeRadars: foe?.radars || [],
      foeShips: sunkShips(foe),
      emotes: (this.emotes || []).filter((x) => Date.now() - x.t < 5000),
      log: this.log.slice(-60),
      chat: this.chat.slice(-60),
    };
  }
}

module.exports = { BattleshipGame };
