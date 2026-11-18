// Simulacija: botovi igraju nasumicne poteze dok neko ne pobedi. Hvata greske u pravilima.
const assert = require('assert');
const { Game, GameError, RES, COST, LAYOUTS } = require('../game');

const pick = (a) => a[Math.floor(Math.random() * a.length)];

function totalCards(g) {
  const sum = {};
  for (const r of RES) sum[r] = g.bank[r] + g.players.reduce((s, p) => s + p.hand[r], 0);
  return sum;
}

function botStep(g) {
  // odbacivanje
  if (g.sub === 'discard') {
    for (const [pid, n] of Object.entries(g.pendingDiscard)) {
      const p = g.p(pid); const cards = {}; let left = n;
      for (const r of RES) { const k = Math.min(left, p.hand[r]); cards[r] = k; left -= k; }
      g.action(pid, 'discard', { cards });
    }
    return;
  }
  const pl = g.current(); const v = g.viewFor(pl.id); const L = v.legal;
  if (g.trade && g.trade.from !== pl.id) g.trade = null;
  switch (g.sub) {
    case 'settlement': return g.action(pl.id, 'placeSettlement', { v: pick(L.settlements) });
    case 'road': case 'roadBuilding': return g.action(pl.id, 'placeRoad', { e: pick(L.roads) });
    case 'roll': {
      const k = pl.dev.find((d) => d.type === 'vitez' && d.bought < g.turnNum);
      if (k && !g.devPlayed && Math.random() < 0.3) return g.action(pl.id, 'playDev', { card: 'vitez' });
      return g.action(pl.id, 'roll');
    }
    case 'robber': return g.action(pl.id, 'moveRobber', { hex: pick(L.robber) });
    case 'steal': return g.action(pl.id, 'steal', { target: pick(L.victims) });
    case 'main': {
      const opts = [];
      if (L.cities.length && g.canAfford(pl, COST.city)) opts.push(() => g.action(pl.id, 'placeCity', { v: pick(L.cities) }));
      if (L.settlements.length && g.canAfford(pl, COST.settlement)) opts.push(() => g.action(pl.id, 'placeSettlement', { v: pick(L.settlements) }));
      if (L.roads.length && g.canAfford(pl, COST.road) && Math.random() < 0.6) opts.push(() => g.action(pl.id, 'placeRoad', { e: pick(L.roads) }));
      if (g.devDeck.length && g.canAfford(pl, COST.dev)) opts.push(() => g.action(pl.id, 'buyDev'));
      const playable = pl.dev.filter((d) => d.bought < g.turnNum && d.type !== 'bod');
      if (playable.length && !g.devPlayed) {
        const d = pick(playable);
        opts.push(() => g.action(pl.id, 'playDev', { card: d.type, res: pick(RES), res2: pick(RES) }));
      }
      const rich = RES.find((r) => pl.hand[r] >= g.tradeRate(pl, r));
      if (rich) opts.push(() => g.action(pl.id, 'bankTrade', { give: rich, get: pick(RES.filter((r) => r !== rich)) }));
      const have = RES.find((r) => pl.hand[r] > 0);
      if (have) opts.push(() => {
        g.action(pl.id, 'offerTrade', { give: { [have]: 1 }, get: { [pick(RES)]: 1 } });
        for (const o of g.players) if (o.id !== pl.id) { try { g.action(o.id, 'respondTrade', { accept: true }); } catch (e) { if (!(e instanceof GameError)) throw e; } }
        if (g.trade.accepted.length) g.action(pl.id, 'confirmTrade', { with: g.trade.accepted[0] });
        else g.action(pl.id, 'cancelTrade');
      });
      if (opts.length && Math.random() < 0.85) {
        try { return pick(opts)(); } catch (e) { if (!(e instanceof GameError)) throw e; }
      }
      return g.action(pl.id, 'endTurn');
    }
  }
  throw new Error('Nepoznat korak ' + g.sub);
}

let wins = 0, turnsTotal = 0;
const GAMES = Number(process.argv[2] || 200);
for (let i = 0; i < GAMES; i++) {
  const n = 2 + (i % 7);
  const g = new Game('TEST', { map: n <= 4 ? 'base' : n <= 6 ? 'ext6' : 'ext8', timer: 0 });
  for (let k = 0; k < n; k++) g.addPlayer('Bot' + k, 't' + k);
  g.action(g.players[0].id, 'start');
  const lay = LAYOUTS[g.board.layout];
  assert.equal(g.board.hexes.length, lay.rows.reduce((a, b) => a + b, 0));
  if (n <= 4) { assert.equal(g.board.vertices.length, 54); assert.equal(g.board.edges.length, 72); }
  assert.equal(g.board.vertices.filter((v) => v.port).length, lay.ports.length * 2, 'luke dele teme');
  assert.ok(g.board.hexes.every((h) => h.terrain === 'pustinja' || h.num), 'polje bez broja');
  for (const a of g.board.hexes) for (const b of g.board.hexes) if (a !== b && [6, 8].includes(a.num) && [6, 8].includes(b.num)) assert.ok(Math.hypot(a.x - b.x, a.y - b.y) > 1.8, '6/8 susedi');
  let steps = 0;
  while (g.phase !== 'ended' && steps < 20000) {
    botStep(g); steps++;
    const t = totalCards(g);
    for (const r of RES) assert.equal(t[r], lay.bank, 'broj karata se promenio: ' + r);
    for (const p of g.players) for (const r of RES) assert.ok(p.hand[r] >= 0);
    if (steps % 50 === 0) for (const p of g.players) JSON.stringify(g.viewFor(p.id));
  }
  if (g.phase === 'ended') { wins++; turnsTotal += g.turnNum; }
}
console.log(`Odigrano ${GAMES} igara, završeno pobedom: ${wins}, prosečno poteza: ${(turnsTotal / Math.max(1, wins)).toFixed(0)}`);
assert.ok(wins > GAMES * 0.8, 'Premalo igara je završeno');
console.log('OK');
