// Provera novih opcija: fer kockice, prijateljski razbojnik, kontraponuda, cuvanje partije
const assert = require('assert');
const { Game } = require('../game');

function setup(settings = {}) {
  const g = new Game('F', { timer: 0, ...settings });
  const a = g.addPlayer('A', 'a'), b = g.addPlayer('B', 'b'), c = g.addPlayer('C', 'c');
  g.action(a.id, 'start');
  while (g.phase === 'setup') {
    const cur = g.current(); const L = g.viewFor(cur.id).legal;
    if (g.sub === 'settlement') g.action(cur.id, 'placeSettlement', { v: L.settlements[0] });
    else g.action(cur.id, 'placeRoad', { e: L.roads[0] });
  }
  return g;
}

// fer kockice: u 36 bacanja svaka kombinacija tacno jednom
{
  const g = new Game('D', { fairDice: true });
  const counts = {};
  for (let i = 0; i < 30; i++) { const [x, y] = g.rollDice(); counts[x + y] = (counts[x + y] || 0) + 1; }
  assert.ok((counts[7] || 0) <= 6, 'previse sedmica');
  console.log('fer kockice OK');
}

// prijateljski razbojnik: polja igraca sa <=2 poena su zabranjena
{
  const g = setup({ friendlyRobber: true });
  const pid = g.current().id;
  const allowed = g.robberHexes(pid);
  const all = g.board.hexes.filter((h) => h.id !== g.board.robber);
  assert.ok(allowed.length < all.length, 'nijedno polje nije zasticeno');
  for (const h of allowed) for (const v of g.board.hexes[h].corners) {
    const b = g.buildings[v]; if (b) assert.ok(b.pid === pid || g.publicVP(g.p(b.pid)) > 2);
  }
  console.log('prijateljski razbojnik OK');
}

// kontraponuda
{
  const g = setup();
  const cur = g.current(); const other = g.players.find((p) => p !== cur);
  cur.hand = { drvo: 2, glina: 0, vuna: 0, zito: 0, kamen: 0 };
  other.hand = { drvo: 0, glina: 0, vuna: 0, zito: 3, kamen: 0 };
  g.sub = 'main';
  g.action(cur.id, 'offerTrade', { give: { drvo: 1 }, get: { zito: 1 } });
  g.action(other.id, 'counterTrade', { give: { zito: 2 }, get: { drvo: 2 } });
  g.action(cur.id, 'confirmTrade', { with: other.id, counter: true });
  assert.equal(cur.hand.drvo, 0); assert.equal(cur.hand.zito, 2);
  assert.equal(other.hand.drvo, 2); assert.equal(other.hand.zito, 1);
  console.log('kontraponuda OK');
}

// predlog igracu na potezu bez njegove ponude (i pre bacanja kockica)
{
  const g = setup();
  const cur = g.current(); const other = g.players.find((p) => p !== cur);
  cur.hand = { drvo: 1, glina: 0, vuna: 0, zito: 0, kamen: 0 };
  other.hand = { drvo: 0, glina: 0, vuna: 2, zito: 0, kamen: 0 };
  g.sub = 'roll';
  g.action(other.id, 'counterTrade', { give: { vuna: 2 }, get: { drvo: 1 } });
  assert.ok(g.trade && g.trade.open);
  assert.throws(() => g.action(cur.id, 'confirmTrade', { with: other.id, counter: true })); // prvo baci kockice
  g.sub = 'main';
  g.action(cur.id, 'confirmTrade', { with: other.id, counter: true });
  assert.equal(cur.hand.vuna, 2); assert.equal(other.hand.drvo, 1);
  console.log('predlog bez ponude OK');
}

// trgovina samo sa igracem na potezu: igraci koji nisu na potezu ne mogu da menjaju medjusobno
{
  const g = setup();
  const cur = g.current(); const [b, c] = g.players.filter((p) => p !== cur);
  for (const p of g.players) p.hand = { drvo: 2, glina: 2, vuna: 2, zito: 2, kamen: 2 };
  g.sub = 'main';
  assert.throws(() => g.action(b.id, 'offerTrade', { give: { drvo: 1 }, get: { zito: 1 } }), /Nije tvoj red/);
  assert.throws(() => g.action(b.id, 'confirmTrade', { with: c.id }), /Nije tvoj red/);
  g.action(c.id, 'counterTrade', { give: { vuna: 1 }, get: { drvo: 1 } });
  assert.throws(() => g.action(b.id, 'confirmTrade', { with: c.id, counter: true }), /Nije tvoj red/);
  assert.equal(g.trade.from, cur.id); // predlog uvek ide igracu na potezu
  assert.throws(() => g.action(cur.id, 'confirmTrade', { with: cur.id, counter: true }));
  // zastarela ponuda prethodnog igraca ne moze da se prihvati ni kontrira u tudjem potezu
  g.trade = { id: 99, from: b.id, give: { drvo: 1 }, get: { zito: 1 }, accepted: [], declined: [], counters: {} };
  assert.throws(() => g.action(c.id, 'respondTrade', { accept: true }), /Nema aktivne/);
  g.action(c.id, 'counterTrade', { give: { vuna: 1 }, get: { drvo: 1 } });
  assert.equal(g.trade.from, cur.id);
  g.action(cur.id, 'confirmTrade', { with: c.id, counter: true });
  assert.equal(c.hand.drvo, 3); assert.equal(cur.hand.vuna, 3); assert.equal(b.hand.drvo, 2);
  console.log('trgovina samo sa igracem na potezu OK');
}

// Parovi igraca: pomocni potez bez kockica, trgovina samo sa glavnim igracem
{
  const g = setup({ pairedPlayers: true });
  const [A, B, C] = [0, 1, 2].map((i) => g.players[(g.turn + i) % 3]);
  g.dice = null; g.action(A.id, 'roll'); if (g.sub !== 'main') { g.sub = 'main'; g.pendingDiscard = {}; }
  g.action(A.id, 'endTurn');
  assert.equal(g.current().id, B.id); assert.equal(g.sub, 'main'); assert.equal(g.helperOf, A.id);
  assert.throws(() => g.action(B.id, 'roll'), /kockice/);
  A.hand = { drvo: 0, glina: 0, vuna: 0, zito: 2, kamen: 0 };
  B.hand = { drvo: 4, glina: 0, vuna: 0, zito: 0, kamen: 0 };
  C.hand = { drvo: 0, glina: 0, vuna: 0, zito: 2, kamen: 0 };
  g.action(B.id, 'bankTrade', { give: 'drvo', get: 'kamen' }); // banka 4:1 sme
  B.hand.drvo = 2;
  g.action(B.id, 'offerTrade', { give: { drvo: 1 }, get: { zito: 1 } });
  assert.throws(() => g.action(C.id, 'respondTrade', { accept: true }), /samo sa/);
  assert.throws(() => g.action(C.id, 'counterTrade', { give: { zito: 1 }, get: { drvo: 1 } }), /samo sa/);
  g.action(A.id, 'respondTrade', { accept: true });
  g.action(B.id, 'confirmTrade', { with: A.id });
  assert.equal(B.hand.zito, 1); assert.equal(A.hand.drvo, 1);
  // razvojna karta kupljena ranije sme da se igra u pomocnom potezu
  B.dev.push({ type: 'monopol', bought: 0 });
  g.action(B.id, 'playDev', { card: 'monopol', res: 'zito' });
  assert.equal(B.hand.zito, 4);
  g.action(B.id, 'endTurn');
  assert.equal(g.current().id, B.id); assert.equal(g.sub, 'roll'); assert.equal(g.helperOf, null);
  assert.equal(g.viewFor(A.id).helperOf, null);
  console.log('parovi igraca OK');
}

// cuvanje: partija posle JSON-a radi isto
{
  const g = setup();
  const copy = Object.assign(Object.create(Game.prototype), JSON.parse(JSON.stringify(g)));
  const cur = copy.current();
  copy.action(cur.id, 'roll');
  assert.ok(copy.dice && ['main', 'discard', 'robber'].includes(copy.sub));
  console.log('cuvanje OK');
}

// banka: vise karata odjednom (8 za 2 kod 4:1, 6 za 2 kod 3:1, 4 za 2 kod 2:1)
{
  const g = setup();
  const A = g.current();
  g.dice = null; g.action(A.id, 'roll'); if (g.sub !== 'main') { g.sub = 'main'; g.pendingDiscard = {}; }
  g.tradeRate = (pl, r) => ({ drvo: 4, vuna: 3, zito: 2 }[r] || 4);
  A.hand = { drvo: 9, glina: 0, vuna: 6, zito: 4, kamen: 0 };
  g.action(A.id, 'bankTrade', { give: { drvo: 8 }, get: { kamen: 2 } });
  assert.equal(A.hand.drvo, 1); assert.equal(A.hand.kamen, 2);
  g.action(A.id, 'bankTrade', { give: { vuna: 6 }, get: { glina: 2 } });
  assert.equal(A.hand.vuna, 0); assert.equal(A.hand.glina, 2);
  g.action(A.id, 'bankTrade', { give: { zito: 4 }, get: { kamen: 1, glina: 1 } });
  assert.equal(A.hand.zito, 0); assert.equal(A.hand.kamen, 3); assert.equal(A.hand.glina, 3);
  A.hand.drvo = 9;
  assert.throws(() => g.action(A.id, 'bankTrade', { give: { drvo: 6 }, get: { kamen: 1 } }), /po 4/);
  assert.throws(() => g.action(A.id, 'bankTrade', { give: { drvo: 8 }, get: { kamen: 3 } }), /tražiš 3/);
  assert.throws(() => g.action(A.id, 'bankTrade', { give: { drvo: 12 }, get: { kamen: 3 } }), /Nemaš/);
  g.action(A.id, 'bankTrade', { give: 'drvo', get: 'kamen' }); // stari oblik: 4 za 1
  assert.equal(A.hand.drvo, 5); assert.equal(A.hand.kamen, 4);
  console.log('banka vise odjednom OK');
}
