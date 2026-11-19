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
  for (const p of [a, b]) g.action(p.id, 'place', { ships: R.randomFleet(g.settings.fleet, g.settings.touch) });
  assert.strictEqual(g.phase, 'battle');
  for (let n = 0; g.phase === 'battle' && n < 1000; n++) {
    const t = g.p(g.turn), foe = g.other(t.id);
    const free = [];
    for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) if (!foe.shots[x + ',' + y]) free.push([x, y]);
    const [x, y] = free[Math.floor(Math.random() * free.length)];
    g.action(t.id, 'shoot', { x, y });
  }
  assert.strictEqual(g.phase, 'ended');
  const w = g.p(g.winner);
  assert(g.other(w.id).ships.every((s) => s.hits >= s.len), 'pobednik je potopio sve');
  // pogresno gadjanje posle kraja
  assert.throws(() => g.action(w.id, 'shoot', { x: 0, y: 0 }));
  // protivnik ne vidi tudje brodove dok traje bitka
  return g;
}

for (let i = 0; i < 40; i++) play(i % 2 ? { fleet: 'velika', again: false, touch: true } : {});

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
console.log('Potapanje brodova: 40 bitaka odigrano, pravila OK');
