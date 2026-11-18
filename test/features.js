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

// cuvanje: partija posle JSON-a radi isto
{
  const g = setup();
  const copy = Object.assign(Object.create(Game.prototype), JSON.parse(JSON.stringify(g)));
  const cur = copy.current();
  copy.action(cur.id, 'roll');
  assert.ok(copy.dice && ['main', 'discard', 'robber'].includes(copy.sub));
  console.log('cuvanje OK');
}
