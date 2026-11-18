// Automatski potezi kad igracu istekne vreme (koristi se i u testovima).
const { RES, COST, GameError } = require('./game');

const PIPS = { 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 8: 5, 9: 4, 10: 3, 11: 2, 12: 1 };
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const handSize = (h) => RES.reduce((s, r) => s + h[r], 0);

function vertexScore(g, v) {
  let s = 0; const seen = new Set();
  for (const h of g.board.vertices[v].hexes) {
    const hx = g.board.hexes[h];
    if (!hx.num) continue;
    s += PIPS[hx.num] + (seen.has(hx.res) ? 0 : 1);
    seen.add(hx.res);
  }
  if (g.board.vertices[v].port) s += 1;
  return s + Math.random();
}
const best = (list, score) => list.reduce((b, x) => (b === undefined || score(x) > score(b) ? x : b), undefined);

function discardChoice(g, pl) {
  const need = g.pendingDiscard[pl.id];
  const hand = { ...pl.hand }; const cards = {};
  for (let i = 0; i < need; i++) {
    const r = best(RES.filter((x) => hand[x] > 0), (x) => hand[x]);
    hand[r]--; cards[r] = (cards[r] || 0) + 1;
  }
  return cards;
}

// Vraca { pid, type, data } ili null. auto=true znaci da je isteklo vreme coveku.
function chooseAction(g, pid, auto = false) {
  const pl = g.p(pid);
  if (!pl) return null;
  if (g.phase !== 'setup' && g.phase !== 'play') return null;
  if (g.sub === 'discard') {
    if (g.pendingDiscard[pid]) return { pid, type: 'discard', data: { cards: discardChoice(g, pl) } };
    return null;
  }
  if (g.current().id !== pid) {
    if (!auto && g.trade && g.trade.from !== pid && !g.trade.accepted.includes(pid) && !g.trade.declined.includes(pid)) {
      const ok = g.canAfford(pl, g.trade.get) && Math.random() < 0.35;
      return { pid, type: 'respondTrade', data: { accept: ok } };
    }
    return null;
  }
  const L = g.viewFor(pid).legal;
  switch (g.sub) {
    case 'settlement': return { pid, type: 'placeSettlement', data: { v: best(L.settlements, (v) => vertexScore(g, v)) } };
    case 'road': case 'roadBuilding': return { pid, type: 'placeRoad', data: { e: pick(L.roads) } };
    case 'roll': return { pid, type: 'roll' };
    case 'robber': {
      const score = (h) => {
        let s = Math.random();
        for (const v of g.board.hexes[h].corners) {
          const b = g.buildings[v];
          if (b) s += (b.pid === pid ? -10 : (b.type === 'city' ? 2 : 1) * 3);
        }
        return s + (PIPS[g.board.hexes[h].num] || 0);
      };
      return { pid, type: 'moveRobber', data: { hex: best(L.robber, score) } };
    }
    case 'steal': return { pid, type: 'steal', data: { target: best(L.victims, (id) => handSize(g.p(id).hand)) } };
    case 'main': {
      if (auto) return { pid, type: 'endTurn' };
      if (g.trade && g.trade.from === pid) {
        if (g.trade.accepted.length) return { pid, type: 'confirmTrade', data: { with: g.trade.accepted[0] } };
        return { pid, type: 'cancelTrade' };
      }
      if (L.cities.length && g.canAfford(pl, COST.city)) return { pid, type: 'placeCity', data: { v: best(L.cities, (v) => vertexScore(g, v)) } };
      if (L.settlements.length && g.canAfford(pl, COST.settlement)) return { pid, type: 'placeSettlement', data: { v: best(L.settlements, (v) => vertexScore(g, v)) } };
      const playable = pl.dev.filter((d) => d.bought < g.turnNum && d.type !== 'bod');
      if (playable.length && !g.devPlayed) {
        const d = playable[0];
        if (d.type !== 'putevi' || (pl.left.road > 0 && L.roads.length)) {
          return { pid, type: 'playDev', data: { card: d.type, res: pick(RES), res2: pick(RES) } };
        }
      }
      if (g.devDeck.length && g.canAfford(pl, COST.dev) && Math.random() < 0.7) return { pid, type: 'buyDev' };
      if (L.roads.length && g.canAfford(pl, COST.road) && (L.settlements.length === 0 || Math.random() < 0.3) && pl.left.road > 0) {
        return { pid, type: 'placeRoad', data: { e: pick(L.roads) } };
      }
      // trgovina sa bankom kad ima viska
      const extra = RES.find((r) => pl.hand[r] >= g.tradeRate(pl, r) + 1);
      const need = RES.find((r) => pl.hand[r] === 0 && g.bank[r] > 0);
      if (extra && need && extra !== need) return { pid, type: 'bankTrade', data: { give: extra, get: need } };
      return { pid, type: 'endTurn' };
    }
  }
  return null;
}

// Izvrsi jedan korak za sve botove kojima treba. Vraca true ako je nesto uradjeno.
function botTick(g) {
  if (g.phase !== 'setup' && g.phase !== 'play') return false;
  for (const p of g.players) {
    if (!p.bot) continue;
    const a = chooseAction(g, p.id);
    if (!a) continue;
    try { g.action(a.pid, a.type, a.data); return true; } catch (e) {
      if (!(e instanceof GameError)) throw e;
      if (g.current().id === p.id && g.sub === 'main') { try { g.action(p.id, 'endTurn'); return true; } catch (_) { /* ignore */ } }
    }
  }
  return false;
}

// Kad istekne vreme: odigraj umesto igraca koji kasni.
function timeoutTick(g) {
  if (g.phase !== 'setup' && g.phase !== 'play') return false;
  // igrac koji je napustio igru igra se odmah automatski
  const quitTurn = g.current().quit || Object.keys(g.pendingDiscard || {}).some((id) => g.p(id).quit);
  if (!quitTurn && (!g.deadline || Date.now() < g.deadline)) return false;
  g.timerKey = null; // dozvoli novi rok ako se stanje ne promeni
  if (g.sub === 'discard') {
    for (const pid of Object.keys(g.pendingDiscard)) {
      if (Date.now() < (g.deadline || 0) && !g.p(pid).quit) continue;
      const a = chooseAction(g, pid, true);
      if (a) g.action(a.pid, a.type, a.data);
    }
    return true;
  }
  const cur = g.current();
  if (!cur.quit) g.addLog(`⏰ Isteklo je vreme za ${cur.name}.`);
  if (g.sub === 'roadBuilding') { g.action(cur.id, 'endTurn'); return true; }
  const a = chooseAction(g, cur.id, true);
  if (a) { try { g.action(a.pid, a.type, a.data); } catch (e) { if (!(e instanceof GameError)) throw e; g.touchTimer(); } }
  return true;
}

module.exports = { chooseAction, botTick, timeoutTick };
