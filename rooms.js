// Pravila za automatsko zatvaranje soba (sobe zive samo u memoriji servera;
// zatvaranje sobe ne brise nista iz baze: profili, statistika i rezultati ostaju).
const MIN = 60 * 1000;
const LIMITS = {
  emptyLobby: 1 * MIN, // soba u predvorju u kojoj nikog nema
  emptyGame: 5 * MIN, // partija u toku u kojoj nikog nema (vreme da se igraci vrate posle pada veze)
  emptyEnded: 1 * MIN, // zavrsena partija u kojoj nikog nema
  ended: 10 * MIN, // zavrsena partija se zatvara najkasnije ovoliko posle kraja
  idle: 3 * 60 * MIN, // bilo koja soba bez ikakve aktivnosti
};

// vraca razlog zatvaranja sobe ili null ako soba ostaje
function closeReason(g, now = Date.now()) {
  const nobody = !g.players.length || g.players.every((p) => p.quit || p.kicked);
  if (nobody) return 'empty';
  const emptyFor = g.emptySince ? now - g.emptySince : 0;
  if (g.phase === 'ended') {
    if (g.emptySince && emptyFor >= LIMITS.emptyEnded) return 'empty';
    if (g.endedAt && now - g.endedAt >= LIMITS.ended) return 'ended';
    return null;
  }
  if (g.emptySince && emptyFor >= (g.phase === 'lobby' ? LIMITS.emptyLobby : LIMITS.emptyGame)) return 'empty';
  if (now - g.lastActivity > LIMITS.idle) return 'idle';
  return null;
}

module.exports = { closeReason, LIMITS };
