// Dostignuca: svako otkljucava okvir avatara ili titulu. Isti fajl koriste server i browser.
(function (root) {
  const ACH = [
    { id: 'prvi', ico: '👣', name: 'Prvi koraci', desc: 'Odigraj prvu partiju', stat: 'games', need: 1, title: 1 },
    { id: 'pobeda1', ico: '🏅', name: 'Prva pobeda', desc: 'Pobedi u jednoj partiji', stat: 'wins', need: 1, frame: 'drvo' },
    { id: 'partije5', ico: '🌸', name: 'Stalni gost', desc: 'Odigraj 5 partija', stat: 'games', need: 5, frame: 'cvece' },
    { id: 'trgovac', ico: '🤝', name: 'Trgovac', desc: 'Napravi 25 razmena sa igračima', stat: 'trades', need: 25, title: 2 },
    { id: 'graditelj', ico: '🏰', name: 'Graditelj', desc: 'Sagradi ukupno 10 gradova', stat: 'cities', need: 10, title: 3 },
    { id: 'partije10', ico: '⛵', name: 'Moreplovac', desc: 'Odigraj 10 partija', stat: 'games', need: 10, title: 4 },
    { id: 'put', ico: '🛤️', name: 'Kralj puteva', desc: 'Napravi put od 10 ili više u jednoj partiji', stat: 'bestRoad', need: 10, title: 5 },
    { id: 'vitez', ico: '⚔️', name: 'Vitez', desc: 'Odigraj ukupno 15 vitezova', stat: 'knights', need: 15, title: 6 },
    { id: 'lopov', ico: '🦹', name: 'Lopov u penziji', desc: 'Ukradi ukupno 20 karata', stat: 'stolen', need: 20, title: 7 },
    { id: 'luke', ico: '⚓', name: 'Majstor luka', desc: 'Napravi 30 razmena sa bankom', stat: 'bank', need: 30, title: 8 },
    { id: 'farmer', ico: '🌾', name: 'Farmer', desc: 'Dobij ukupno 150 sirovina od kockica', stat: 'gained', need: 150, title: 9 },
    { id: 'rudar', ico: '⛏️', name: 'Rudar', desc: 'Dobij ukupno 400 sirovina od kockica', stat: 'gained', need: 400, title: 10 },
    { id: 'pobede5', ico: '🥈', name: 'Iskusni igrač', desc: 'Pobedi u 5 partija', stat: 'wins', need: 5, frame: 'srebro' },
    { id: 'partije20', ico: '🌊', name: 'Stari mornar', desc: 'Odigraj 20 partija', stat: 'games', need: 20, frame: 'talasi' },
    { id: 'poeni12', ico: '⭐', name: 'Zvezda', desc: 'Osvoji 12 ili više poena u jednoj partiji', stat: 'bestPoints', need: 12, frame: 'zvezde' },
    { id: 'niz3', ico: '🔥', name: 'U naletu', desc: 'Pobedi 3 partije zaredom', stat: 'bestStreak', need: 3, frame: 'vatra' },
    { id: 'pobede10', ico: '🧭', name: 'Kapetan', desc: 'Pobedi u 10 partija', stat: 'wins', need: 10, title: 11 },
    { id: 'pobede15', ico: '🥇', name: 'Šampion', desc: 'Pobedi u 15 partija', stat: 'wins', need: 15, frame: 'zlato' },
    { id: 'pobede25', ico: '👑', name: 'Legenda ostrva', desc: 'Pobedi u 25 partija', stat: 'wins', need: 25, title: 12 },
  ];
  // grant = lista dostignuca koje je admin rucno dodelio
  const done = (a, stats, grant) => ((stats && stats[a.stat]) || 0) >= a.need || !!(grant && grant.includes(a.id));
  // all = nalog kome je admin otkljucao sve ukrase
  function unlocked(stats, all, grant) {
    const frames = new Set(['nema']), titles = new Set([0]);
    for (const a of ACH) if (all || done(a, stats, grant)) { if (a.frame) frames.add(a.frame); if (a.title !== undefined) titles.add(a.title); }
    return { frames, titles };
  }
  const API = { ACH, done, unlocked };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.ACHIEVEMENTS = API;
})(typeof window !== 'undefined' ? window : globalThis);
