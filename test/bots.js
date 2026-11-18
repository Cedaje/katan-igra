// Automatske partije (bez ljudi), sa raznim podesavanjima i istekom vremena.
const assert = require('assert');
const { Game, RES, LAYOUTS, MAP_MAX } = require('../game');
const { botTick, timeoutTick } = require('../bot');

const GAMES = Number(process.argv[2] || 60);
let wins = 0;
for (let i = 0; i < GAMES; i++) {
  const map = ['base', 'ext6', 'ext8'][i % 3];
  const g = new Game('T' + i);
  const host = g.addPlayer('Covek', 'tok');
  g.action(host.id, 'settings', { map, timer: 60, vpToWin: 8 + (i % 5), discardLimit: 7 + (i % 3) });
  const n = 2 + (i % (MAP_MAX[map] - 1));
  for (let k = 1; k < n; k++) g.addPlayer('Igrac' + k, 't' + k);
  assert.equal(g.players.length, n);
  g.action(host.id, 'start');
  for (const p of g.players) p.bot = true; // u testu svi igraju automatski
  const lay = LAYOUTS[map];
  assert.equal(g.board.hexes.length, lay.rows.reduce((a, b) => a + b, 0));
  assert.ok(g.deadline > Date.now());
  let steps = 0;
  while (g.phase !== 'ended' && steps < 30000) {
    if (Math.random() < 0.03) { g.deadline = Date.now() - 1; timeoutTick(g); }
    else if (!botTick(g)) { g.deadline = Date.now() - 1; assert.ok(timeoutTick(g), 'zaglavljeno: ' + g.sub); }
    steps++;
    for (const r of RES) assert.equal(g.bank[r] + g.players.reduce((s, p) => s + p.hand[r], 0), lay.bank);
  }
  assert.equal(g.phase, 'ended', `partija ${i} nije zavrsena (${map}, ${n} igraca)`);
  assert.ok(g.totalVP(g.p(g.winner)) >= g.settings.vpToWin);
  wins++;
}
console.log(`Automatske partije: ${wins}/${GAMES} partija završeno. OK`);
