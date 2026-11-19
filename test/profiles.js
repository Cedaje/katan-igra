// Profili: statistika se upisuje posle zavrsene partije, kod profila vraca isti token
const assert = require('assert');
const os = require('os'); const path = require('path');
process.env.PROFILE_FILE = path.join(os.tmpdir(), 'ot-profiles-test-' + process.pid + '.json');
const P = require('../profiles');
const { Game } = require('../game');
const g = new Game('P', { timer: 0 });
const a = g.addPlayer('A', 'token-aaaa'), b = g.addPlayer('B', 'token-bbbb');
g.phase = 'ended'; g.winner = a.id; g.startedAt = Date.now() - 60000; g.endedAt = Date.now();
P.recordGame(g); P.recordGame(g); // drugi put se ne racuna
const va = P.publicView('token-aaaa'), vb = P.publicView('token-bbbb');
assert.equal(va.stats.games, 1); assert.equal(va.stats.wins, 1); assert.equal(vb.stats.wins, 0);
assert.equal(P.claim(va.code.toLowerCase().replace('-', '')), 'token-aaaa');
assert.equal(P.claim('XXXX-XXXX'), null);
P.savePrefs('token-bbbb', { name: 'B', frame: 'zlato' });
assert.equal(P.publicView('token-bbbb').prefs.frame, 'zlato');
console.log('profili OK');
process.exit(0);
