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
// zakljucani ukrasi se ne prihvataju, otkljucani da
assert.equal(P.filterLook('token-bbbb', { frame: 'zlato', title: 12 }).frame, undefined);
assert.equal(P.filterLook('token-aaaa', { frame: 'drvo', title: 1 }).frame, 'drvo');
assert.equal(P.filterLook('token-aaaa', { title: 1 }).title, 1);
const lb = P.leaderboard('token-aaaa');
assert.equal(lb[0].wins, 1); assert.ok(lb[0].me);
// admin: pretraga po imenu, otkljucaj sve, novi kod
const found = P.adminSearch('b');
assert.ok(found.some((r) => r.code === P.publicView('token-bbbb').code));
const oldCode = P.publicView('token-bbbb').code;
assert.ok(P.adminUpdate(oldCode, 'unlockAll').all);
assert.equal(P.publicView('token-bbbb').all, true);
assert.equal(P.filterLook('token-bbbb', { frame: 'zlato', title: 12 }).frame, 'zlato');
const nc = P.adminUpdate(oldCode, 'newCode').code;
assert.notEqual(nc, oldCode); assert.equal(P.claim(oldCode), null); assert.equal(P.claim(nc), 'token-bbbb');
assert.equal(P.adminUpdate(nc, 'lock').all, false);
assert.equal(P.adminUpdate('ZZZZ-ZZZZ', 'unlockAll'), null);
console.log('profili OK');
process.exit(0);
