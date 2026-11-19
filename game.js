// Pravila igre "Ostrvo Trgovaca". Sva logika je ovde, server samo prosledjuje poteze.

const RES = ['drvo', 'glina', 'vuna', 'zito', 'kamen'];
const TERRAIN_RES = { suma: 'drvo', gliniste: 'glina', pasnjak: 'vuna', polje: 'zito', planina: 'kamen', pustinja: null };
const COST = {
  road: { drvo: 1, glina: 1 },
  settlement: { drvo: 1, glina: 1, vuna: 1, zito: 1 },
  city: { zito: 2, kamen: 3 },
  dev: { vuna: 1, zito: 1, kamen: 1 },
};
const COLORS = ['#e05a47', '#3b82c4', '#f2b134', '#4caf6a', '#9b5fc0', '#26b5b0', '#e07ab8', '#8a5a3c'];
const DEV_NAMES = { vitez: 'Vitez', bod: 'Bod pobede', putevi: 'Graditelji puteva', obilje: 'Obilje', monopol: 'Monopol' };
const RES_NAMES = { drvo: 'drvo', glina: 'glina', vuna: 'ovca', zito: 'žito', kamen: 'kamen' };

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const emptyHand = () => ({ drvo: 0, glina: 0, vuna: 0, zito: 0, kamen: 0 });
const handSize = (h) => RES.reduce((s, r) => s + h[r], 0);

// Velicina table prema broju igraca: osnovna (2-4), prosirenje (5-6) i veliko prosirenje (7-8)
const LAYOUTS = {
  base: {
    rows: [3, 4, 5, 4, 3],
    terrain: { suma: 4, gliniste: 3, pasnjak: 4, polje: 4, planina: 3, pustinja: 1 },
    numbers: [2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12],
    ports: ['3:1', 'vuna', '3:1', '3:1', 'glina', 'drvo', '3:1', 'zito', 'kamen'],
    bank: 19,
    dev: { vitez: 14, bod: 5, putevi: 2, obilje: 2, monopol: 2 },
  },
  ext6: {
    rows: [3, 4, 5, 6, 5, 4, 3],
    terrain: { suma: 6, gliniste: 5, pasnjak: 6, polje: 6, planina: 5, pustinja: 2 },
    numbers: [2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 5, 6, 6, 6, 8, 8, 8, 9, 9, 9, 10, 10, 10, 11, 11, 11, 12, 12],
    ports: ['3:1', 'vuna', '3:1', 'glina', 'drvo', '3:1', 'zito', '3:1', 'kamen', 'vuna', '3:1'],
    bank: 24,
    dev: { vitez: 20, bod: 5, putevi: 3, obilje: 3, monopol: 3 },
  },
  ext8: {
    rows: [4, 5, 6, 7, 6, 5, 4],
    terrain: { suma: 7, gliniste: 7, pasnjak: 7, polje: 7, planina: 7, pustinja: 2 },
    numbers: [2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6, 6, 8, 8, 8, 8, 9, 9, 9, 9, 10, 10, 10, 10, 11, 11, 11, 12, 12],
    ports: ['3:1', 'vuna', '3:1', 'glina', 'drvo', '3:1', 'zito', '3:1', 'kamen', 'drvo', '3:1', 'zito', '3:1'],
    bank: 30,
    dev: { vitez: 25, bod: 6, putevi: 4, obilje: 4, monopol: 4 },
  },
};
const MAP_MAX = { base: 4, ext6: 6, ext8: 8 };
const DEFAULT_SETTINGS = { map: 'base', maxPlayers: 4, timer: 90, vpToWin: 10, discardLimit: 7, private: false, hideBank: false, resCards: 19, devCards: 25, friendlyRobber: false, fairDice: false, sameRes: true, sameNum: true, pairedPlayers: false };

// Rasporedi stvari tako da nema "losih" suseda: nasumicno, pa popravljanje zamenama.
function arrange(items, nbrs, bad) {
  const arr = shuffle([...items]);
  const conflicts = () => { let c = 0; for (let i = 0; i < arr.length; i++) for (const j of nbrs[i]) if (j > i && bad(arr[i], arr[j])) c++; return c; };
  let cur = conflicts();
  for (let it = 0; it < 30000 && cur > 0; it++) {
    const hot = []; for (let i = 0; i < arr.length; i++) if (nbrs[i].some((j) => bad(arr[i], arr[j]))) hot.push(i);
    const i = hot[Math.floor(Math.random() * hot.length)], j = Math.floor(Math.random() * arr.length);
    [arr[i], arr[j]] = [arr[j], arr[i]];
    const next = conflicts();
    if (next <= cur || Math.random() < 0.02) cur = next; else [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// opts.sameRes / opts.sameNum: da li se ista polja / isti brojevi smeju dodirivati (podrazumevano da)
function buildBoard(layoutName = 'base', opts = {}) {
  const L = LAYOUTS[layoutName];
  const centers = [];
  L.rows.forEach((count, i) => {
    for (let c = 0; c < count; c++) centers.push([Math.sqrt(3) * (c - (count - 1) / 2), 1.5 * (i - (L.rows.length - 1) / 2)]);
  });
  const near = (a, b) => Math.abs(Math.hypot(a[0] - b[0], a[1] - b[1]) - Math.sqrt(3)) < 0.01;
  const nb = centers.map((c, i) => centers.map((d, j) => j).filter((j) => j !== i && near(c, centers[j])));
  const tList = Object.entries(L.terrain).flatMap(([t, n]) => Array(n).fill(t));
  const terrains = opts.sameRes === false ? arrange(tList, nb, (a, b) => a === b && a !== 'pustinja') : shuffle(tList);
  const hexes = centers.map(([x, y], id) => ({
    id, x, y, terrain: terrains[id], res: TERRAIN_RES[terrains[id]], num: null,
  }));

  // Brojevi: 6 i 8 nikad jedan pored drugog; po zelji ni isti brojevi
  const producing = hexes.filter((h) => h.terrain !== 'pustinja');
  const pIdx = new Map(producing.map((h, i) => [h.id, i]));
  const pnb = producing.map((h) => nb[h.id].filter((j) => pIdx.has(j)).map((j) => pIdx.get(j)));
  const isHot = (n) => n === 6 || n === 8;
  const nums = arrange(L.numbers, pnb, (a, b) => (isHot(a) && isHot(b)) || (opts.sameNum === false && a === b));
  producing.forEach((h, i) => { h.num = nums[i]; });

  const vertices = [], vIndex = new Map();
  const edges = [], eIndex = new Map();
  const getV = (x, y) => {
    const key = `${Math.round(x * 1000)},${Math.round(y * 1000)}`;
    if (!vIndex.has(key)) {
      vIndex.set(key, vertices.length);
      vertices.push({ id: vertices.length, x, y, hexes: [], adj: [], edges: [], port: null });
    }
    return vIndex.get(key);
  };
  for (const h of hexes) {
    const corners = [];
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 180) * (60 * i - 30);
      const v = getV(h.x + Math.cos(a), h.y + Math.sin(a));
      vertices[v].hexes.push(h.id);
      corners.push(v);
    }
    h.corners = corners;
    for (let i = 0; i < 6; i++) {
      const a = corners[i], b = corners[(i + 1) % 6];
      const key = a < b ? `${a}-${b}` : `${b}-${a}`;
      if (!eIndex.has(key)) {
        eIndex.set(key, edges.length);
        edges.push({ id: edges.length, a: Math.min(a, b), b: Math.max(a, b), hexes: [] });
        vertices[a].adj.push(b); vertices[b].adj.push(a);
        vertices[a].edges.push(edges.length - 1); vertices[b].edges.push(edges.length - 1);
      }
      edges[eIndex.get(key)].hexes.push(h.id);
    }
  }

  // Luke na obali
  const coast = edges.filter((e) => e.hexes.length === 1).map((e) => {
    const mx = (vertices[e.a].x + vertices[e.b].x) / 2, my = (vertices[e.a].y + vertices[e.b].y) / 2;
    return { e, mx, my, ang: Math.atan2(my, mx) };
  }).sort((p, q) => p.ang - q.ang);
  // Luke na nasumicnim mestima: izmedju dve luke uvek bar jedna ivica obale
  const portTypes = shuffle([...L.ports]);
  const np = portTypes.length;
  let chosen = null;
  for (let tries = 0; tries < 2000 && !chosen; tries++) {
    const idx = shuffle([...coast.keys()]).slice(0, np).sort((a, b) => a - b);
    const used = new Set();
    let ok = true;
    for (const i of idx) {
      const e = coast[i].e;
      if (used.has(e.a) || used.has(e.b)) { ok = false; break; }
      for (const v of [e.a, e.b]) { used.add(v); for (const w of vertices[v].adj) used.add(w); }
    }
    if (ok) chosen = idx;
  }
  if (!chosen) chosen = portTypes.map((_, i) => Math.floor((i * coast.length) / np));
  const ports = [];
  for (let i = 0; i < np; i++) {
    const c = coast[chosen[i]];
    const type = portTypes[i];
    vertices[c.e.a].port = type; vertices[c.e.b].port = type;
    const len = Math.hypot(c.mx, c.my);
    ports.push({ type, edge: c.e.id, x: c.mx + (c.mx / len) * 0.75, y: c.my + (c.my / len) * 0.75 });
  }

  const robber = hexes.find((h) => h.terrain === 'pustinja').id;
  return { layout: layoutName, hexes, vertices, edges, ports, robber };
}

const devTotal = (layoutName) => Object.values(LAYOUTS[layoutName].dev).reduce((a, b) => a + b, 0);

// Spil razvojnih karata; ako je zadat ukupan broj, raspodela ostaje ista kao u pravoj igri
function makeDevDeck(layoutName = 'base', total = null) {
  const base = LAYOUTS[layoutName].dev;
  const sum = devTotal(layoutName);
  total = total || sum;
  const counts = {};
  for (const [t, n] of Object.entries(base)) counts[t] = t === 'vitez' ? 0 : Math.round((n * total) / sum);
  counts.vitez = Math.max(0, total - Object.values(counts).reduce((a, b) => a + b, 0));
  return shuffle(Object.entries(counts).flatMap(([t, n]) => Array(n).fill(t)));
}

class GameError extends Error {}
const fail = (msg) => { throw new GameError(msg); };

class Game {
  constructor(code, settings = {}) {
    this.code = code;
    this.players = [];
    this.settings = { ...DEFAULT_SETTINGS };
    this.applySettings(settings);
    this.phase = 'lobby'; // lobby | setup | play | ended
    this.sub = null;
    this.deadline = null;
    this.timerKey = null;
    this.board = buildBoard(this.settings.map, this.settings);
    this.buildings = {}; // vertexId -> { pid, type: 'settlement'|'city' }
    this.roads = {}; // edgeId -> pid
    this.bank = { drvo: 19, glina: 19, vuna: 19, zito: 19, kamen: 19 };
    this.devDeck = makeDevDeck();
    this.turn = 0;
    this.turnNum = 0;
    this.dice = null;
    this.log = [];
    this.chat = [];
    this.trade = null;
    this.tradeSeq = 0;
    this.pendingDiscard = {};
    this.longestRoad = null;
    this.largestArmy = null;
    this.winner = null;
    this.helperOf = null; // "Parovi igraca": id glavnog igraca dok pomocni igra svoj deo poteza
    this.lastActivity = Date.now();
  }

  // ---------- pomocne ----------
  p(pid) { return this.players.find((x) => x.id === pid); }
  name(pid) { return this.p(pid)?.name ?? '?'; }
  current() { return this.players[this.turn]; }
  addLog(text) { this.log.push({ t: Date.now(), text }); if (this.log.length > 200) this.log.shift(); }

  hostId() {
    // osnivac ostaje isti i posle mesanja redosleda igraca; ako ode iz lobija, osnivac postaje sledeci
    if (!this.players.some((p) => p.id === this.hostPid)) this.hostPid = this.players[0]?.id;
    return this.hostPid;
  }

  applySettings(s) {
    const st = this.settings;
    if (s.map && MAP_MAX[s.map]) {
      st.map = s.map;
      if (s.maxPlayers === undefined) st.maxPlayers = MAP_MAX[s.map];
      if (s.resCards === undefined) st.resCards = LAYOUTS[s.map].bank;
      if (s.devCards === undefined) st.devCards = devTotal(s.map);
    }
    const num = (v, lo, hi) => Math.min(hi, Math.max(lo, Math.round(Number(v))));
    if (s.maxPlayers !== undefined) st.maxPlayers = num(s.maxPlayers, 2, MAP_MAX[st.map]);
    st.maxPlayers = Math.min(st.maxPlayers, MAP_MAX[st.map]);
    if (this.players) st.maxPlayers = Math.max(st.maxPlayers, this.players.length);
    if (s.timer !== undefined) st.timer = [0, 30, 60, 90, 120, 180, 240].includes(Number(s.timer)) ? Number(s.timer) : st.timer;
    if (s.vpToWin !== undefined) st.vpToWin = num(s.vpToWin, 3, 20);
    if (s.discardLimit !== undefined) st.discardLimit = num(s.discardLimit, 5, 20);
    if (s.private !== undefined) st.private = !!s.private;
    if (s.hideBank !== undefined) st.hideBank = !!s.hideBank;
    if (s.friendlyRobber !== undefined) st.friendlyRobber = !!s.friendlyRobber;
    if (s.fairDice !== undefined) st.fairDice = !!s.fairDice;
    if (s.sameRes !== undefined) st.sameRes = !!s.sameRes;
    if (s.sameNum !== undefined) st.sameNum = !!s.sameNum;
    if (s.pairedPlayers !== undefined) st.pairedPlayers = !!s.pairedPlayers;
    if (s.resCards !== undefined) st.resCards = num(s.resCards, 10, 50);
    if (s.devCards !== undefined) st.devCards = num(s.devCards, 10, 80);
  }

  setLook(pl, { color, avatar }) {
    if (this.phase !== 'lobby') fail('Boja i avatar se biraju u lobiju.');
    if (color !== undefined) {
      if (!COLORS.includes(color)) fail('Nepoznata boja.');
      if (this.players.some((p) => p.id !== pl.id && p.color === color)) fail('Tu boju već ima drugi igrač.');
      pl.color = color;
    }
    if (avatar !== undefined) pl.avatar = Math.max(0, Math.min(63, Math.floor(Number(avatar)) || 0));
  }

  updateSettings(pl, s) {
    if (this.phase !== 'lobby') fail('Igra je već počela.');
    if (this.hostId() !== pl.id) fail('Samo osnivač sobe menja podešavanja.');
    if (s.map && MAP_MAX[s.map] < this.players.length) fail('U sobi ima previše igrača za ovu mapu.');
    const oldMap = this.settings.map;
    this.applySettings(s);
    if (this.settings.map !== oldMap) this.board = buildBoard(this.settings.map, this.settings);
  }

  removePlayer(by, pid) {
    if (this.phase !== 'lobby') fail('Igra je već počela.');
    if (by.id !== pid && this.hostId() !== by.id) fail('Samo osnivač sobe može da izbaci igrača.');
    const i = this.players.findIndex((p) => p.id === pid);
    if (i < 0) fail('Nema tog igrača.');
    const [p] = this.players.splice(i, 1);
    this.addLog(`${p.name} je izašao iz sobe.`);
  }

  uniqueName(n) {
    const taken = new Set(this.players.map((p) => p.name));
    if (!taken.has(n)) return n;
    for (let i = 2; ; i++) if (!taken.has(`${n} ${i}`)) return `${n} ${i}`;
  }

  addPlayer(name, token) {
    if (this.phase !== 'lobby') fail('Igra je već počela.');
    if (this.players.length >= this.settings.maxPlayers) fail(`Soba je puna (${this.settings.maxPlayers} igrača).`);
    const used = new Set(this.players.map((p) => p.color));
    const pl = {
      id: 'p' + Math.random().toString(36).slice(2, 9),
      token,
      name: this.uniqueName(String(name || '').trim().slice(0, 16) || 'Igrač'),
      color: COLORS.find((c) => !used.has(c)),
      avatar: null,
      hand: emptyHand(),
      dev: [],
      knights: 0,
      left: { road: 15, settlement: 5, city: 4 },
      connected: true,
    };
    this.players.push(pl);
    this.addLog(`${pl.name} je ušao u sobu.`);
    return pl;
  }

  canAfford(pl, cost) { return RES.every((r) => pl.hand[r] >= (cost[r] || 0)); }
  pay(pl, cost) { for (const r of RES) { pl.hand[r] -= cost[r] || 0; this.bank[r] += cost[r] || 0; } }
  give(pl, r, n) { const k = Math.min(n, this.bank[r]); pl.hand[r] += k; this.bank[r] -= k; return k; }
  stat(pid, key, n = 1) {
    this.stats ??= { rolls: {}, players: {} };
    const s = (this.stats.players[pid] ??= { gained: 0, stolen: 0, lost: 0, discarded: 0, trades: 0, bank: 0, dev: 0 });
    s[key] += n;
  }

  // Fer kockice: 36 kombinacija se mesaju i vuku redom (kao spil), pa se ponovo mesaju
  rollDice() {
    if (!this.settings.fairDice) return [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)];
    if (!this.diceDeck || this.diceDeck.length < 6) {
      this.diceDeck = [];
      for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) this.diceDeck.push([a, b]);
      shuffle(this.diceDeck);
    }
    return this.diceDeck.pop();
  }

  vertexFreeForSettlement(v) {
    if (this.buildings[v]) return false;
    return !this.board.vertices[v].adj.some((a) => this.buildings[a]);
  }

  legalSettlements(pid) {
    const res = [];
    for (const v of this.board.vertices) {
      if (!this.vertexFreeForSettlement(v.id)) continue;
      if (this.phase === 'play' && !v.edges.some((e) => this.roads[e] === pid)) continue;
      res.push(v.id);
    }
    return res;
  }

  legalRoads(pid) {
    const res = [];
    if (this.phase === 'setup') {
      const v = this.lastSetupVertex;
      return this.board.vertices[v].edges.filter((e) => this.roads[e] === undefined);
    }
    for (const e of this.board.edges) {
      if (this.roads[e.id] !== undefined) continue;
      const ok = [e.a, e.b].some((v) => {
        const b = this.buildings[v];
        if (b && b.pid === pid) return true;
        if (b && b.pid !== pid) return false;
        return this.board.vertices[v].edges.some((x) => x !== e.id && this.roads[x] === pid);
      });
      if (ok) res.push(e.id);
    }
    return res;
  }

  legalCities(pid) {
    return Object.entries(this.buildings)
      .filter(([, b]) => b.pid === pid && b.type === 'settlement')
      .map(([v]) => Number(v));
  }

  roadLength(pid) {
    let best = 0;
    const V = this.board.vertices, E = this.board.edges;
    const walk = (v, used, len) => {
      if (len > best) best = len;
      const b = this.buildings[v];
      if (len > 0 && b && b.pid !== pid) return;
      for (const e of V[v].edges) {
        if (this.roads[e] !== pid || used.has(e)) continue;
        used.add(e);
        walk(E[e].a === v ? E[e].b : E[e].a, used, len + 1);
        used.delete(e);
      }
    };
    for (const [e, owner] of Object.entries(this.roads)) {
      if (owner !== pid) continue;
      walk(E[e].a, new Set(), 0);
      walk(E[e].b, new Set(), 0);
    }
    return best;
  }

  updateLongestRoad() {
    const lens = Object.fromEntries(this.players.map((p) => [p.id, this.roadLength(p.id)]));
    const max = Math.max(...Object.values(lens));
    const prev = this.longestRoad;
    if (max < 5) { this.longestRoad = null; }
    else {
      const top = this.players.filter((p) => lens[p.id] === max).map((p) => p.id);
      if (prev && top.includes(prev)) this.longestRoad = prev;
      else if (top.length === 1) this.longestRoad = top[0];
      else this.longestRoad = null;
    }
    if (this.longestRoad !== prev) {
      if (this.longestRoad) this.addLog(`🛣️ ${this.name(this.longestRoad)} sada ima najduži put (${max}).`);
      else if (prev) this.addLog('🛣️ Niko više nema najduži put.');
    }
  }

  publicVP(pl) {
    let vp = 0;
    for (const b of Object.values(this.buildings)) if (b.pid === pl.id) vp += b.type === 'city' ? 2 : 1;
    if (this.longestRoad === pl.id) vp += 2;
    if (this.largestArmy === pl.id) vp += 2;
    return vp;
  }
  totalVP(pl) { return this.publicVP(pl) + pl.dev.filter((d) => d.type === 'bod').length; }

  // Igrac napusta igru u toku: njegove figure ostaju, a potezi mu se automatski preskacu
  quit(pl) {
    if (pl.quit) return;
    pl.quit = true;
    this.addLog(`🚪 ${pl.name} je napustio igru.`);
    if (this.trade && this.trade.from === pl.id) this.trade = null;
    if (this.phase !== 'ended' && this.players.every((p) => p.quit)) { this.phase = 'ended'; this.sub = null; }
  }

  // ---------- glasanje za izbacivanje ----------
  voters(target) { return this.players.filter((p) => !p.quit && p.id !== target); }

  startVote(pl, target) {
    if (this.phase !== 'setup' && this.phase !== 'play') fail('Glasanje je moguće samo tokom igre.');
    if (pl.quit) fail('Napustio si igru.');
    const t = this.p(target);
    if (!t || t.kicked) fail('Nema tog igrača.');
    if (t.id === pl.id) fail('Ne možeš da glasaš protiv sebe.');
    if (this.vote) fail('Već traje jedno glasanje.');
    this.vote = { id: ++this.tradeSeq, target: t.id, by: pl.id, yes: [pl.id], no: [], until: Date.now() + 60000 };
    this.addLog(`🗳️ ${pl.name} predlaže da se izbaci ${t.name}. Glasajte!`);
    this.resolveVote();
  }

  castVote(pl, yes) {
    const v = this.vote;
    if (!v) fail('Nema glasanja.');
    if (pl.id === v.target || pl.quit) fail('Ti ne glasaš u ovom glasanju.');
    v.yes = v.yes.filter((x) => x !== pl.id);
    v.no = v.no.filter((x) => x !== pl.id);
    (yes ? v.yes : v.no).push(pl.id);
    this.resolveVote();
  }

  // Vecina igraca koji glasaju odlucuje; posle 60 sekundi glasanje propada
  resolveVote() {
    const v = this.vote;
    if (!v) return false;
    const n = this.voters(v.target).length;
    const t = this.p(v.target);
    if (v.yes.length > n / 2) {
      this.vote = null;
      t.kicked = true;
      this.addLog(`🥾 ${t.name} je izbačen iz igre (glasanje ${v.yes.length}/${n}).`);
      this.quit(t);
      this.lastKick = t.id;
      return true;
    }
    if (v.no.length >= n / 2 || Date.now() > v.until) {
      this.vote = null;
      this.addLog(`🗳️ Glasanje za izbacivanje ${t.name} nije prošlo.`);
      return true;
    }
    return false;
  }

  endGame(pl) {
    if (this.phase === 'lobby' || this.phase === 'ended') fail('Igra nije u toku.');
    if (this.hostId() !== pl.id) fail('Samo osnivač sobe može da prekine igru.');
    this.phase = 'ended';
    this.sub = null;
    this.trade = null;
    this.winner = null;
    this.endedBy = pl.id;
    this.addLog(`🛑 ${pl.name} je prekinuo igru.`);
  }

  checkWin() {
    const pl = this.current();
    if (this.phase === 'play' && this.totalVP(pl) >= this.settings.vpToWin) {
      this.phase = 'ended';
      this.sub = null;
      this.winner = pl.id;
      this.trade = null;
      this.addLog(`🏆 ${pl.name} je pobedio sa ${this.totalVP(pl)} poena!`);
    }
  }

  // ---------- akcije ----------
  action(pid, type, data = {}) {
    try { return this.doAction(pid, type, data); } finally { if (this.phase === 'ended' && !this.endedAt) this.endedAt = Date.now(); this.touchTimer(); }
  }

  doAction(pid, type, data = {}) {
    this.lastActivity = Date.now();
    const pl = this.p(pid);
    if (!pl) fail('Nisi u ovoj sobi.');
    if (type === 'chat') {
      const text = String(data.text || '').trim().slice(0, 300);
      if (text) { this.chat.push({ t: Date.now(), pid, name: pl.name, color: pl.color, text }); if (this.chat.length > 100) this.chat.shift(); }
      return;
    }
    if (type === 'start') return this.start(pl);
    if (type === 'settings') return this.updateSettings(pl, data || {});
    if (type === 'kick') return this.removePlayer(pl, data.pid);
    if (type === 'leave') return this.phase === 'lobby' ? this.removePlayer(pl, pl.id) : this.quit(pl);
    if (type === 'endGame') return this.endGame(pl);
    if (type === 'look') return this.setLook(pl, data);
    if (type === 'voteKick') return this.startVote(pl, data.pid);
    if (type === 'vote') return this.castVote(pl, !!data.yes);
    if (this.phase === 'ended') fail('Igra je završena.');
    if (this.phase === 'lobby') fail('Igra još nije počela.');

    // Akcije koje ne zahtevaju da je tvoj red
    if (type === 'discard') return this.discard(pl, data.cards || {});
    if (type === 'respondTrade') return this.respondTrade(pl, !!data.accept);
    if (type === 'counterTrade') return this.counterTrade(pl, data.give || {}, data.get || {});

    if (this.current().id !== pid) fail('Nije tvoj red.');
    const handler = {
      placeSettlement: () => this.placeSettlement(pl, Number(data.v)),
      placeRoad: () => this.placeRoad(pl, Number(data.e)),
      placeCity: () => this.placeCity(pl, Number(data.v)),
      roll: () => this.roll(pl),
      moveRobber: () => this.moveRobber(pl, Number(data.hex)),
      steal: () => this.steal(pl, data.target),
      buyDev: () => this.buyDev(pl),
      playDev: () => this.playDev(pl, data),
      bankTrade: () => this.bankTrade(pl, data.give, data.get),
      offerTrade: () => this.offerTrade(pl, data.give || {}, data.get || {}),
      confirmTrade: () => this.confirmTrade(pl, data.with, !!data.counter),
      cancelTrade: () => { // predlozi ostalih ostaju
        const c = this.trade?.counters;
        this.trade = c && Object.keys(c).length ? { id: ++this.tradeSeq, from: pl.id, give: {}, get: {}, accepted: [], declined: [], counters: c, open: true } : null;
      },
      endTurn: () => this.endTurn(pl),
    }[type];
    if (!handler) fail('Nepoznata akcija.');
    handler();
    this.checkWin();
  }

  start(pl) {
    if (this.phase !== 'lobby') fail('Igra je već počela.');
    if (this.hostId() !== pl.id) fail('Samo osnivač sobe može da pokrene igru.');
    if (this.players.length < 2) fail('Potrebna su bar 2 igrača.');
    shuffle(this.players);
    const n = this.players.length;
    const layout = this.settings.map;
    this.board = buildBoard(layout, this.settings);
    this.devDeck = makeDevDeck(layout, this.settings.devCards);
    const bankSize = this.settings.resCards;
    this.bank = Object.fromEntries(RES.map((r) => [r, bankSize]));
    this.setupOrder = [...Array(n).keys(), ...[...Array(n).keys()].reverse()];
    this.setupStep = 0;
    this.turn = this.setupOrder[0];
    this.phase = 'setup';
    this.startedAt = Date.now();
    this.sub = 'settlement';
    this.addLog(`Igra je počela! Redosled: ${this.players.map((p) => p.name).join(', ')}.`);
    this.addLog(`${this.current().name} postavlja prvo selo.`);
  }

  requireMain() {
    if (this.phase !== 'play' || this.sub !== 'main') fail(this.sub === 'roll' ? 'Prvo baci kockice.' : 'Sada to ne možeš.');
  }

  placeSettlement(pl, v) {
    if (!this.board.vertices[v]) fail('Pogrešno mesto.');
    if (this.phase === 'setup') {
      if (this.sub !== 'settlement') fail('Sada postavi put.');
    } else {
      this.requireMain();
      if (pl.left.settlement <= 0) fail('Nemaš više sela.');
      if (!this.canAfford(pl, COST.settlement)) fail('Nemaš dovoljno sirovina za selo.');
    }
    if (!this.legalSettlements(pl.id).includes(v)) fail('Tu ne možeš da gradiš selo.');
    if (this.phase === 'play') this.pay(pl, COST.settlement);
    this.buildings[v] = { pid: pl.id, type: 'settlement' };
    pl.left.settlement--;
    this.addLog(`🏠 ${pl.name} je sagradio selo.`);
    if (this.phase === 'setup') {
      if (this.setupStep >= this.players.length) {
        const got = [];
        for (const h of this.board.vertices[v].hexes) {
          const r = this.board.hexes[h].res;
          if (r && this.give(pl, r, 1)) got.push(RES_NAMES[r]);
        }
        if (got.length) this.addLog(`${pl.name} dobija: ${got.join(', ')}.`);
      }
      this.lastSetupVertex = v;
      this.sub = 'road';
    } else {
      this.updateLongestRoad();
    }
  }

  placeRoad(pl, e) {
    if (!this.board.edges[e]) fail('Pogrešno mesto.');
    if (this.phase === 'setup') {
      if (this.sub !== 'road') fail('Prvo postavi selo.');
    } else if (this.sub === 'roadBuilding') {
      // besplatan put iz karte
    } else {
      this.requireMain();
      if (!this.canAfford(pl, COST.road)) fail('Nemaš dovoljno sirovina za put.');
    }
    if (pl.left.road <= 0) fail('Nemaš više puteva.');
    if (!this.legalRoads(pl.id).includes(e)) fail('Tu ne možeš da gradiš put.');
    if (this.phase === 'play' && this.sub === 'main') this.pay(pl, COST.road);
    this.roads[e] = pl.id;
    pl.left.road--;
    this.addLog(`🛤️ ${pl.name} je sagradio put.`);
    if (this.phase === 'setup') {
      this.setupStep++;
      if (this.setupStep >= this.setupOrder.length) {
        this.phase = 'play';
        this.turn = 0;
        this.turnNum = 1;
        this.sub = 'roll';
        this.addLog(`Postavljanje završeno. ${this.current().name} je na potezu.`);
      } else {
        this.turn = this.setupOrder[this.setupStep];
        this.sub = 'settlement';
      }
      return;
    }
    if (this.sub === 'roadBuilding') {
      this.freeRoads--;
      if (this.freeRoads <= 0 || pl.left.road <= 0 || this.legalRoads(pl.id).length === 0) this.sub = 'main';
    }
    this.updateLongestRoad();
  }

  placeCity(pl, v) {
    this.requireMain();
    if (pl.left.city <= 0) fail('Nemaš više gradova.');
    if (!this.canAfford(pl, COST.city)) fail('Nemaš dovoljno sirovina za grad.');
    const b = this.buildings[v];
    if (!b || b.pid !== pl.id || b.type !== 'settlement') fail('Grad se gradi na tvom selu.');
    this.pay(pl, COST.city);
    b.type = 'city';
    pl.left.city--;
    pl.left.settlement++;
    this.addLog(`🏰 ${pl.name} je sagradio grad.`);
  }

  roll(pl) {
    if (this.phase !== 'play' || this.sub !== 'roll') fail('Sada ne možeš da baciš kockice.');
    const [d1, d2] = this.rollDice();
    this.dice = [d1, d2];
    const sum = d1 + d2;
    this.stats ??= { rolls: {}, players: {} };
    this.stats.rolls[sum] = (this.stats.rolls[sum] || 0) + 1;
    this.addLog(`🎲 ${pl.name} je bacio ${sum}.`);
    if (sum === 7) return this.startSeven();
    // Raspodela sirovina
    const want = {}; // res -> pid -> n
    for (const h of this.board.hexes) {
      if (h.num !== sum || h.id === this.board.robber) continue;
      for (const v of h.corners) {
        const b = this.buildings[v];
        if (!b) continue;
        want[h.res] ??= {};
        want[h.res][b.pid] = (want[h.res][b.pid] || 0) + (b.type === 'city' ? 2 : 1);
      }
    }
    const gains = {};
    for (const [r, byP] of Object.entries(want)) {
      const total = Object.values(byP).reduce((a, b) => a + b, 0);
      const ids = Object.keys(byP);
      if (total > this.bank[r] && ids.length > 1) { this.addLog(`Banka nema dovoljno: ${RES_NAMES[r]}.`); continue; }
      for (const id of ids) {
        const got = this.give(this.p(id), r, byP[id]);
        if (got) { (gains[id] ??= []).push(`${got} ${RES_NAMES[r]}`); this.stat(id, 'gained', got); }
      }
    }
    for (const [id, list] of Object.entries(gains)) this.addLog(`${this.name(id)} dobija: ${list.join(', ')}.`);
    this.sub = 'main';
  }

  startSeven() {
    this.afterRobber = 'main';
    this.pendingDiscard = {};
    for (const p of this.players) {
      const n = handSize(p.hand);
      if (n > this.settings.discardLimit) this.pendingDiscard[p.id] = Math.floor(n / 2);
    }
    if (Object.keys(this.pendingDiscard).length) {
      this.sub = 'discard';
      this.addLog(`Igrači sa više od ${this.settings.discardLimit} karata odbacuju polovinu.`);
    } else {
      this.sub = 'robber';
    }
  }

  discard(pl, cards) {
    if (this.sub !== 'discard') fail('Sada ne treba da odbacuješ.');
    const need = this.pendingDiscard[pl.id];
    if (!need) fail('Ti ne moraš da odbacuješ.');
    let sum = 0;
    for (const r of RES) {
      const n = Math.max(0, Math.floor(Number(cards[r]) || 0));
      if (n > pl.hand[r]) fail('Nemaš toliko karata.');
      sum += n;
    }
    if (sum !== need) fail(`Moraš da odbaciš tačno ${need}.`);
    for (const r of RES) { const n = Math.floor(Number(cards[r]) || 0); pl.hand[r] -= n; this.bank[r] += n; }
    delete this.pendingDiscard[pl.id];
    this.addLog(`${pl.name} je odbacio ${need} karata.`);
    this.stat(pl.id, 'discarded', need);
    if (!Object.keys(this.pendingDiscard).length) this.sub = 'robber';
  }

  moveRobber(pl, hex) {
    if (this.sub !== 'robber') fail('Sada ne pomeraš lopova.');
    if (!this.board.hexes[hex]) fail('Pogrešno polje.');
    if (hex === this.board.robber) fail('Lopov mora na drugo polje.');
    if (!this.robberHexes(pl.id).includes(hex)) fail('Prijateljski lopov: ne možeš na polje igrača sa 2 poena ili manje.');
    this.board.robber = hex;
    this.addLog(`🦹 ${pl.name} je pomerio lopova.`);
    const victims = this.robberVictims(pl.id);
    if (victims.length === 0) this.sub = this.afterRobber;
    else if (victims.length === 1) this.doSteal(pl, victims[0]);
    else this.sub = 'steal';
  }

  // Polja na koja lopov sme. Uz "prijateljskog lopova" ne sme kod igraca sa 2 poena ili manje.
  robberHexes(pid) {
    const all = this.board.hexes.map((h) => h.id).filter((h) => h !== this.board.robber);
    if (!this.settings.friendlyRobber) return all;
    const ok = all.filter((h) => !this.board.hexes[h].corners.some((v) => {
      const b = this.buildings[v];
      return b && b.pid !== pid && this.publicVP(this.p(b.pid)) <= 2;
    }));
    return ok.length ? ok : all;
  }

  robberVictims(pid) {
    const ids = new Set();
    for (const v of this.board.hexes[this.board.robber].corners) {
      const b = this.buildings[v];
      if (b && b.pid !== pid && handSize(this.p(b.pid).hand) > 0) ids.add(b.pid);
    }
    return [...ids];
  }

  steal(pl, target) {
    if (this.sub !== 'steal') fail('Sada ne možeš da kradeš.');
    if (!this.robberVictims(pl.id).includes(target)) fail('Od tog igrača ne možeš da kradeš.');
    this.doSteal(pl, target);
  }

  doSteal(pl, target) {
    const t = this.p(target);
    const pool = RES.flatMap((r) => Array(t.hand[r]).fill(r));
    const r = pool[Math.floor(Math.random() * pool.length)];
    t.hand[r]--; pl.hand[r]++;
    this.stat(pl.id, 'stolen'); this.stat(t.id, 'lost');
    this.addLog(`${pl.name} je ukrao kartu od ${t.name}.`);
    this.lastSteal = { thief: pl.id, victim: t.id, res: r, t: Date.now() };
    this.sub = this.afterRobber;
  }

  buyDev(pl) {
    this.requireMain();
    if (!this.devDeck.length) fail('Nema više razvojnih karata.');
    if (!this.canAfford(pl, COST.dev)) fail('Nemaš dovoljno sirovina za razvojnu kartu.');
    this.pay(pl, COST.dev);
    const type = this.devDeck.pop();
    this.stat(pl.id, 'dev');
    pl.dev.push({ type, bought: this.turnNum });
    this.addLog(`🃏 ${pl.name} je kupio razvojnu kartu.`);
  }

  playDev(pl, data) {
    const card = data.card;
    if (this.phase !== 'play') fail('Sada ne možeš.');
    if (card === 'bod') fail('Bod pobede se ne igra, automatski se računa.');
    if (this.devPlayed) fail('Možeš da odigraš samo jednu razvojnu kartu po potezu.');
    const allowed = card === 'vitez' ? ['roll', 'main'] : ['main'];
    if (!allowed.includes(this.sub)) fail(this.sub === 'roll' ? 'Pre bacanja možeš da odigraš samo viteza.' : 'Sada ne možeš da igraš kartu.');
    const idx = pl.dev.findIndex((d) => d.type === card && d.bought < this.turnNum);
    if (idx < 0) fail('Nemaš tu kartu (ili si je kupio u ovom potezu).');
    if (card === 'obilje') {
      const r1 = data.res, r2 = data.res2;
      if (!RES.includes(r1) || !RES.includes(r2)) fail('Izaberi dve sirovine.');
      const need = { [r1]: 0, [r2]: 0 }; need[r1]++; need[r2]++;
      if (Object.entries(need).some(([r, n]) => this.bank[r] < n)) fail('Banka nema te sirovine.');
      this.give(pl, r1, 1); this.give(pl, r2, 1);
      this.addLog(`✨ ${pl.name} je odigrao Obilje: ${RES_NAMES[r1]} i ${RES_NAMES[r2]}.`);
    } else if (card === 'monopol') {
      const r = data.res;
      if (!RES.includes(r)) fail('Izaberi sirovinu.');
      let total = 0;
      for (const o of this.players) if (o.id !== pl.id) { total += o.hand[r]; pl.hand[r] += o.hand[r]; o.hand[r] = 0; }
      this.addLog(`💰 ${pl.name} je odigrao Monopol i uzeo ${total} × ${RES_NAMES[r]}.`);
    } else if (card === 'putevi') {
      if (pl.left.road <= 0 || this.legalRoads(pl.id).length === 0) fail('Nemaš gde da gradiš puteve.');
      this.freeRoads = 2;
      this.sub = 'roadBuilding';
      this.addLog(`🛠️ ${pl.name} je odigrao Graditelje puteva.`);
    } else if (card === 'vitez') {
      pl.knights++;
      this.afterRobber = this.sub;
      this.sub = 'robber';
      this.addLog(`⚔️ ${pl.name} je odigrao Viteza.`);
      if (pl.knights >= 3 && this.largestArmy !== pl.id) {
        const holder = this.largestArmy ? this.p(this.largestArmy) : null;
        if (!holder || pl.knights > holder.knights) {
          this.largestArmy = pl.id;
          this.addLog(`🛡️ ${pl.name} sada ima najveću vojsku.`);
        }
      }
    } else fail('Nepoznata karta.');
    pl.dev.splice(idx, 1);
    this.devPlayed = true;
  }

  tradeRate(pl, r) {
    let rate = 4;
    for (const [v, b] of Object.entries(this.buildings)) {
      if (b.pid !== pl.id) continue;
      const port = this.board.vertices[v].port;
      if (port === r) rate = Math.min(rate, 2);
      else if (port === '3:1') rate = Math.min(rate, 3);
    }
    return rate;
  }

  bankTrade(pl, give, get) {
    this.requireMain();
    if (!RES.includes(give) || !RES.includes(get) || give === get) fail('Izaberi šta daješ i šta dobijaš.');
    const rate = this.tradeRate(pl, give);
    if (pl.hand[give] < rate) fail(`Za ovu razmenu treba ti ${rate} × ${RES_NAMES[give]}.`);
    if (this.bank[get] < 1) fail('Banka nema tu sirovinu.');
    pl.hand[give] -= rate; this.bank[give] += rate;
    this.give(pl, get, 1);
    this.stat(pl.id, 'bank');
    this.addLog(`🏦 ${pl.name} je razmenio ${rate} ${RES_NAMES[give]} za 1 ${RES_NAMES[get]} sa bankom.`);
  }

  cleanOffer(o) {
    const out = {};
    for (const r of RES) { const n = Math.max(0, Math.floor(Number(o[r]) || 0)); if (n) out[r] = n; }
    return out;
  }

  offerTrade(pl, give, get) {
    this.requireMain();
    give = this.cleanOffer(give); get = this.cleanOffer(get);
    if (!Object.keys(give).length || !Object.keys(get).length) fail('Izaberi šta daješ i šta tražiš.');
    if (!this.canAfford(pl, give)) fail('Nemaš te karte.');
    this.trade = { id: ++this.tradeSeq, from: pl.id, give, get, accepted: [], declined: [], counters: this.trade?.counters || {} };
    const fmt = (o) => Object.entries(o).map(([r, n]) => `${n} ${RES_NAMES[r]}`).join(', ');
    this.addLog(`🤝 ${pl.name} nudi ${fmt(give)} za ${fmt(get)}.`);
  }

  // Parovi igraca: u pomocnom potezu trguje se samo izmedju pomocnog i glavnog igraca
  requirePartner(id) {
    if (this.helperOf && id !== this.helperOf) fail(`U pomoćnom potezu trguje se samo sa glavnim igračem (${this.name(this.helperOf)}).`);
  }

  respondTrade(pl, accept) {
    const t = this.trade;
    if (!t || t.open) fail('Nema aktivne ponude.');
    this.requirePartner(pl.id);
    if (t.from === pl.id) fail('Ne možeš da odgovoriš na svoju ponudu.');
    t.accepted = t.accepted.filter((x) => x !== pl.id);
    t.declined = t.declined.filter((x) => x !== pl.id);
    if (accept) {
      if (!this.canAfford(pl, t.get)) fail('Nemaš karte koje se traže.');
      t.accepted.push(pl.id);
    } else t.declined.push(pl.id);
  }

  // Kontraponuda: igrac predlaze svoje uslove (give/get iz ugla onoga ko je ponudio)
  // Ostali igraci mogu da predloze razmenu igracu na potezu bilo kad tokom njegovog poteza,
  // i kad on nije nista ponudio (tada je trade.open = true, samo predlozi).
  counterTrade(pl, give, get) {
    if (this.phase !== 'play') fail('Sada ne možeš da trguješ.');
    if (this.current().id === pl.id) fail('Ti si na potezu: napravi svoju ponudu.');
    this.requirePartner(pl.id);
    if (!this.trade) this.trade = { id: ++this.tradeSeq, from: this.current().id, give: {}, get: {}, accepted: [], declined: [], counters: {}, open: true };
    const t = this.trade;
    if (t.from === pl.id) fail('Ne možeš da odgovoriš na svoju ponudu.');
    give = this.cleanOffer(give); get = this.cleanOffer(get); // give = sta ti dajes, get = sta trazis
    if (!Object.keys(give).length || !Object.keys(get).length) fail('Izaberi šta daješ i šta tražiš.');
    if (!this.canAfford(pl, give)) fail('Nemaš te karte.');
    t.counters ??= {};
    t.counters[pl.id] = { give: get, get: give }; // iz ugla igraca na potezu
    t.accepted = t.accepted.filter((x) => x !== pl.id);
    t.declined = t.declined.filter((x) => x !== pl.id);
    const fmt = (o) => Object.entries(o).map(([r, n]) => `${n} ${RES_NAMES[r]}`).join(', ');
    this.addLog(`🤝 ${pl.name} predlaže: daje ${fmt(give)} za ${fmt(get)}.`);
  }

  confirmTrade(pl, withId, counter = false) {
    this.requireMain();
    const t0 = this.trade;
    if (!t0 || t0.from !== pl.id) fail('Nema tvoje ponude.');
    this.requirePartner(withId);
    let t = t0;
    if (counter) {
      if (!t0.counters?.[withId]) fail('Taj igrač nije dao kontraponudu.');
      t = t0.counters[withId];
    } else if (!t0.accepted.includes(withId)) fail('Taj igrač nije prihvatio.');
    const o = this.p(withId);
    if (!this.canAfford(pl, t.give)) fail('Više nemaš te karte.');
    if (!this.canAfford(o, t.get)) fail(`${o.name} više nema te karte.`);
    for (const [r, n] of Object.entries(t.give)) { pl.hand[r] -= n; o.hand[r] += n; }
    for (const [r, n] of Object.entries(t.get)) { o.hand[r] -= n; pl.hand[r] += n; }
    this.addLog(`✅ ${pl.name} i ${o.name} su razmenili karte.`);
    this.stat(pl.id, 'trades'); this.stat(o.id, 'trades');
    this.trade = null;
  }

  endTurn(pl) {
    if (this.phase !== 'play') fail('Sada ne možeš.');
    if (this.sub === 'roadBuilding') this.sub = 'main';
    this.requireMain();
    this.trade = null;
    this.devPlayed = false;
    this.dice = null;
    this.turnNum++;
    if (this.settings.pairedPlayers && !this.helperOf) {
      // Parovi igraca: sledeci igrac odmah igra pomocni potez (bez kockica), pa postaje glavni
      this.helperOf = pl.id;
      this.turn = (this.turn + 1) % this.players.length;
      this.sub = 'main';
      this.addLog(`🤝 Pomoćni potez: ${this.current().name} (bez kockica, trguje samo sa glavnim igračem: ${pl.name}).`);
      return;
    }
    if (this.helperOf) this.helperOf = null; // pomocni igrac sada postaje glavni
    else this.turn = (this.turn + 1) % this.players.length;
    this.sub = 'roll';
    this.addLog(`➡️ Na potezu je ${this.current().name}.`);
  }

  // ---------- tajmer poteza ----------
  touchTimer() {
    if (!this.settings.timer || (this.phase !== 'setup' && this.phase !== 'play')) { this.deadline = null; this.timerKey = null; return; }
    const key = `${this.phase}|${this.turnNum}|${this.turn}|${this.sub}|${this.setupStep}`;
    if (key === this.timerKey) return;
    this.timerKey = key;
    // bacanje kockica, lopov i odbacivanje imaju krace vreme
    const short = ['roll', 'robber', 'steal', 'discard'].includes(this.sub);
    const secs = short ? Math.min(30, this.settings.timer) : this.settings.timer;
    this.deadline = Date.now() + secs * 1000;
  }

  // ---------- prikaz za jednog igraca ----------
  summary() {
    return {
      code: this.code, phase: this.phase, settings: this.settings,
      players: this.players.length,
      host: (() => { const h = this.p(this.hostId()); return h ? { name: h.name, color: h.color, avatar: h.avatar ?? null } : null; })(),
    };
  }

  viewFor(pid) {
    const me = this.p(pid);
    const isMyTurn = this.current()?.id === pid && (this.phase === 'setup' || this.phase === 'play');
    const legal = {};
    if (me && isMyTurn) {
      if (this.sub === 'settlement') legal.settlements = this.legalSettlements(pid);
      if (this.sub === 'road' || this.sub === 'roadBuilding') legal.roads = this.legalRoads(pid);
      if (this.sub === 'main') {
        legal.settlements = me.left.settlement > 0 ? this.legalSettlements(pid) : [];
        legal.roads = me.left.road > 0 ? this.legalRoads(pid) : [];
        legal.cities = me.left.city > 0 ? this.legalCities(pid) : [];
      }
      if (this.sub === 'robber') legal.robber = this.robberHexes(pid);
      if (this.sub === 'steal') legal.victims = this.robberVictims(pid);
    }
    const B = this.board;
    return {
      code: this.code,
      phase: this.phase,
      sub: this.sub,
      me: pid,
      host: this.hostId(),
      settings: this.settings,
      deadline: this.deadline,
      now: Date.now(),
      startedAt: this.startedAt || null,
      endedAt: this.endedAt || (this.phase === 'ended' ? Date.now() : null),
      turn: this.current()?.id,
      helperOf: this.helperOf || null,
      turnNum: this.turnNum,
      dice: this.dice,
      board: {
        layout: B.layout,
        hexes: B.hexes.map(({ id, x, y, terrain, num, corners }) => ({ id, x, y, terrain, num, corners })),
        vertices: B.vertices.map(({ id, x, y, port }) => ({ id, x, y, port })),
        edges: B.edges.map(({ id, a, b }) => ({ id, a, b })),
        ports: B.ports,
        robber: B.robber,
      },
      buildings: this.buildings,
      roads: this.roads,
      players: this.players.map((p) => ({
        id: p.id, name: p.name, color: p.color, avatar: p.avatar ?? null, connected: p.connected, quit: !!p.quit, kicked: !!p.kicked,
        cards: handSize(p.hand), devCards: p.dev.length, knights: p.knights,
        vp: this.phase === 'ended' || p.id === pid ? this.totalVP(p) : this.publicVP(p),
        roadLen: this.roadLength(p.id), left: p.left,
        longest: this.longestRoad === p.id, largest: this.largestArmy === p.id,
      })),
      hand: me ? me.hand : null,
      dev: me ? me.dev.map((d) => ({ type: d.type, fresh: d.bought >= this.turnNum })) : [],
      devPlayed: !!this.devPlayed,
      rates: me ? Object.fromEntries(RES.map((r) => [r, this.tradeRate(me, r)])) : null,
      bank: this.settings.hideBank && this.phase !== 'ended' ? null : this.bank,
      devLeft: this.settings.hideBank && this.phase !== 'ended' ? null : this.devDeck.length,
      devEmpty: this.devDeck.length === 0,
      pendingDiscard: this.pendingDiscard,
      freeRoads: this.freeRoads || 0,
      trade: this.trade,
      vote: this.vote ? { ...this.vote, voters: this.voters(this.vote.target).length } : null,
      lastSteal: this.lastSteal && (this.lastSteal.thief === pid || this.lastSteal.victim === pid) ? this.lastSteal : null,
      legal,
      winner: this.winner,
      stats: this.phase === 'ended' ? (this.stats || { rolls: {}, players: {} }) : null,
      colors: COLORS,
      endedBy: this.endedBy || null,
      log: this.log.slice(-60),
      chat: this.chat.slice(-60),
    };
  }
}

module.exports = { COLORS, makeDevDeck, Game, GameError, RES, COST, LAYOUTS, MAP_MAX, buildBoard, handSize };
