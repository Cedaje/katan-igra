// Provera pravila igre "Potapanje brodova": raspored, gadjanje, pobeda, revans, napustanje
const assert = require('assert');
const { BattleshipGame } = require('../brodovi');
const R = require('../public/brodovi-rules');

function play(settings) {
  const g = new BattleshipGame('TEST', settings);
  const a = g.addPlayer('A', 'tokenA12345'), b = g.addPlayer('B', 'tokenB12345');
  assert.throws(() => g.addPlayer('C', 'tokenC12345'), /puna/);
  assert.throws(() => g.action(b.id, 'start'), /osnivač/);
  g.action(a.id, 'start');
  assert.strictEqual(g.phase, 'place');
  for (const p of [a, b]) g.action(p.id, 'place', { ships: R.randomFleet(g.settings.fleet, g.settings.touch, g.n) });
  assert.strictEqual(g.phase, 'battle');
  for (let n = 0; g.phase === 'battle' && n < 1000; n++) {
    const t = g.p(g.turn), foe = g.other(t.id);
    const free = [];
    for (let y = 0; y < g.n; y++) for (let x = 0; x < g.n; x++) if (!foe.shots[x + ',' + y]) free.push([x, y]);
    const [x, y] = free[Math.floor(Math.random() * free.length)];
    // ponekad radar ili bomba (ako su ukljuceni i jos nisu potroseni)
    const kind = g.settings.special && Math.random() < 0.1 ? (t.radar ? 'radar' : t.bomb ? 'bomb' : 'shot') : 'shot';
    if (g.settings.salvo) assert(g.shotsLeft >= 1 && g.shotsLeft <= t.ships.filter((s) => s.hits < s.len).length);
    g.action(t.id, 'shoot', { x, y, kind });
  }
  assert.strictEqual(g.phase, 'ended');
  const w = g.p(g.winner);
  assert(g.other(w.id).ships.every((s) => s.hits >= s.len), 'pobednik je potopio sve');
  // pogresno gadjanje posle kraja
  assert.throws(() => g.action(w.id, 'shoot', { x: 0, y: 0 }));
  // protivnik ne vidi tudje brodove dok traje bitka
  return g;
}

const VARIANTS = [{}, { fleet: 'velika', again: false, touch: true }, { size: 8 }, { size: 12, fleet: 'velika' }, { salvo: true }, { special: true, size: 8 }, { salvo: true, special: true, size: 12, touch: true }];
for (let i = 0; i < 70; i++) play(VARIANTS[i % VARIANTS.length]);

// specijalni hici se mogu iskoristiti samo jednom; bez opcije ne rade
{
  const g = new BattleshipGame('T3', { special: true });
  const a = g.addPlayer('A', 'tokenA12345'), b = g.addPlayer('B', 'tokenB12345');
  g.action(a.id, 'start');
  for (const p of [a, b]) g.action(p.id, 'place', { ships: R.randomFleet('klasicna', false, 10) });
  const t = g.p(g.turn);
  g.action(t.id, 'shoot', { x: 5, y: 5, kind: 'radar' });
  assert.strictEqual(g.viewFor(t.id).foeRadars.length, 1);
  assert.strictEqual(t.radar, 0);
  if (g.turn === t.id) assert.throws(() => g.action(t.id, 'shoot', { x: 1, y: 1, kind: 'radar' }), /iskoristio/);
  const g2 = new BattleshipGame('T4', {});
  const c = g2.addPlayer('C', 'tokenC12345'), d = g2.addPlayer('D', 'tokenD12345');
  g2.action(c.id, 'start');
  for (const p of [c, d]) g2.action(p.id, 'place', { ships: R.randomFleet('klasicna', false, 10) });
  assert.throws(() => g2.action(g2.turn, 'shoot', { x: 1, y: 1, kind: 'bomb' }), /nisu uključeni/);
}
// tajmer: kad istekne vreme, igra gadja umesto igraca
{
  const g = new BattleshipGame('T5', { timer: 15 });
  const a = g.addPlayer('A', 'tokenA12345'), b = g.addPlayer('B', 'tokenB12345');
  g.action(a.id, 'start');
  for (const p of [a, b]) g.action(p.id, 'place', { ships: R.randomFleet('klasicna', false, 10) });
  assert(g.deadline > Date.now());
  g.deadline = Date.now() - 1;
  const before = g.shotSeq;
  assert(g.tick());
  assert.strictEqual(g.shotSeq, before + 1);
  assert(g.deadline > Date.now());
}

// los raspored se odbija
assert.strictEqual(typeof R.validFleet([{ x: 0, y: 0, len: 4, dir: 'h' }], 'klasicna', false), 'string');
assert.strictEqual(typeof R.validFleet([{ x: 0, y: 0, len: 4, dir: 'h' }, { x: 0, y: 1, len: 3, dir: 'h' }], 'velika', false), 'string');
for (let i = 0; i < 50; i++) assert(Array.isArray(R.validFleet(R.randomFleet('klasicna', false), 'klasicna', false)));

// tajnost: pre kraja protivnik vidi samo potopljene brodove
{
  const g = new BattleshipGame('T2', {});
  const a = g.addPlayer('A', 'tokenA12345'), b = g.addPlayer('B', 'tokenB12345');
  g.action(a.id, 'start');
  g.action(a.id, 'place', { ships: R.randomFleet('klasicna') });
  g.action(b.id, 'place', { ships: R.randomFleet('klasicna') });
  assert.strictEqual(g.viewFor(a.id).foeShips.length, 0);
  // revans i napustanje
  g.action(b.id, 'leave');
  assert.strictEqual(g.phase, 'ended');
  assert.strictEqual(g.winner, a.id);
  assert(g.forfeit);
  assert.throws(() => g.action(a.id, 'rematch'), /otišao/);
}
{
  const g = play({});
  for (const p of g.players) g.action(p.id, 'rematch');
  assert.strictEqual(g.phase, 'place');
  assert.strictEqual(g.round, 2);
}
console.log('Potapanje brodova: 70 bitaka odigrano, pravila OK');
