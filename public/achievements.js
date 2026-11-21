// Dostignuca: svako otkljucava okvir avatara ili titulu. Isti fajl koriste server i browser.
(function (root) {
  const ACH = [
    { id: 'prvi', ico: '👣', name: 'Učlanjenje', desc: 'Odigraj prvu partiju', stat: 'games', need: 1, title: 1 },
    { id: 'pobeda1', ico: '🏅', name: 'Prvi mandat', desc: 'Pobedi u jednoj partiji', stat: 'wins', need: 1, frame: 'drvo' },
    { id: 'partije5', ico: '🌸', name: 'Redovan na sednicama', desc: 'Odigraj 5 partija', stat: 'games', need: 5, frame: 'cvece' },
    { id: 'trgovac', ico: '🤝', name: 'Biznismen sa tendera', desc: 'Napravi 25 razmena sa igračima', stat: 'trades', need: 25, title: 2 },
    { id: 'graditelj', ico: '🏰', name: 'Investitor bez dozvole', desc: 'Sagradi ukupno 10 gradova', stat: 'cities', need: 10, title: 3 },
    { id: 'partije10', ico: '⛵', name: 'Gastarbajter', desc: 'Odigraj 10 partija', stat: 'games', need: 10, title: 4 },
    { id: 'put', ico: '🛤️', name: 'Ministar saobraćaja', desc: 'Napravi put od 10 ili više u jednoj partiji', stat: 'bestRoad', need: 10, title: 5 },
    { id: 'vitez', ico: '⚔️', name: 'Obezbeđenje', desc: 'Odigraj ukupno 15 vitezova', stat: 'knights', need: 15, title: 6 },
    { id: 'lopov', ico: '🦹', name: 'Zastareo slučaj', desc: 'Ukradi ukupno 20 karata', stat: 'stolen', need: 20, title: 7 },
    { id: 'luke', ico: '⚓', name: 'Vlasnik splava', desc: 'Napravi 30 razmena sa bankom', stat: 'bank', need: 30, title: 8 },
    { id: 'farmer', ico: '🌾', name: 'Subvencionisani poljoprivrednik', desc: 'Dobij ukupno 150 sirovina od kockica', stat: 'gained', need: 150, title: 9 },
    { id: 'rudar', ico: '⛏️', name: 'Kopač litijuma', desc: 'Dobij ukupno 400 sirovina od kockica', stat: 'gained', need: 400, title: 10 },
    { id: 'pobede5', ico: '🥈', name: 'Preletač', desc: 'Pobedi u 5 partija', stat: 'wins', need: 5, frame: 'srebro' },
    { id: 'partije20', ico: '🌊', name: 'Panonski mornar', desc: 'Odigraj 20 partija', stat: 'games', need: 20, frame: 'talasi' },
    { id: 'poeni12', ico: '⭐', name: '105% glasova', desc: 'Osvoji 12 ili više poena u jednoj partiji', stat: 'bestPoints', need: 12, frame: 'zvezde' },
    { id: 'niz3', ico: '🔥', name: 'Vanredni izbori', desc: 'Pobedi 3 partije zaredom', stat: 'bestStreak', need: 3, frame: 'vatra' },
    { id: 'pobede10', ico: '🧭', name: 'Koordinator', desc: 'Pobedi u 10 partija', stat: 'wins', need: 10, title: 11 },
    { id: 'pobede15', ico: '🥇', name: 'Predsednik skupštine', desc: 'Pobedi u 15 partija', stat: 'wins', need: 15, frame: 'zlato' },
    { id: 'pobede25', ico: '👑', name: 'Doživotni predsednik', desc: 'Pobedi u 25 partija', stat: 'wins', need: 25, title: 12 },
    // Potapanje brodova (g = igra; statistika te igre je u gstats)
    { id: 'bs_prva', g: 'brodovi', ico: '⚓', name: 'Mornar', desc: 'Odigraj prvu pomorsku bitku', stat: 'games', need: 1, title: 13 },
    { id: 'bs_lovac', g: 'brodovi', ico: '🎯', name: 'Lovac na brodove', desc: 'Potopi ukupno 50 brodova', stat: 'sunk', need: 50, title: 14 },
    { id: 'bs_oko', g: 'brodovi', ico: '🦅', name: 'Sokolovo oko', desc: 'Pobedi sa bar 60% pogodaka', stat: 'bestAcc', need: 60, title: 15 },
    { id: 'bs_cisto', g: 'brodovi', ico: '🛡️', name: 'Nepotopivi', desc: 'Pobedi a da ti nijedan brod ne bude potopljen', stat: 'flawless', need: 1, title: 16 },
    { id: 'bs_admiral', g: 'brodovi', ico: '🎖️', name: 'Admiral', desc: 'Pobedi u 10 pomorskih bitaka', stat: 'wins', need: 10, title: 17 },
  ];
  const GAME_NAMES = { brodovi: 'Potapanje brodova' };
  // vrednost statistike za dostignuce (stats = Ostrvo Trgovaca, gstats = ostale igre)
  const value = (a, stats, gstats) => ((a.g ? gstats && gstats[a.g] : stats) || {})[a.stat] || 0;
  // grant = lista dostignuca koje je admin rucno dodelio
  const done = (a, stats, grant, gstats) => value(a, stats, gstats) >= a.need || !!(grant && grant.includes(a.id));
  // all = nalog kome je admin otkljucao sve ukrase
  function unlocked(stats, all, grant, gstats) {
    const frames = new Set(['nema']), titles = new Set([0]);
    for (const a of ACH) if (all || done(a, stats, grant, gstats)) { if (a.frame) frames.add(a.frame); if (a.title !== undefined) titles.add(a.title); }
    return { frames, titles };
  }
  const API = { ACH, GAME_NAMES, value, done, unlocked };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.ACHIEVEMENTS = API;
})(typeof window !== 'undefined' ? window : globalThis);
