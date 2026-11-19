// Pravila rasporeda brodova za igru "Potapanje brodova". Isti fajl koriste server i browser.
(function (root) {
  const SIZES = [8, 10, 12]; // tabla 8x8, 10x10 ili 12x12
  const N = 10; // osnovna velicina table
  // flota zavisi od velicine table (da sve stane i kad se brodovi ne dodiruju)
  const FLEETS = {
    // klasicna na 10x10: 1 brod od 4 polja, 2 od 3, 3 od 2 i 4 od 1
    klasicna: { name: 'Klasična flota', sizes: { 8: [4, 3, 2, 2, 1, 1], 10: [4, 3, 3, 2, 2, 2, 1, 1, 1, 1], 12: [5, 4, 3, 3, 2, 2, 2, 1, 1, 1, 1] } },
    // velika na 10x10: 5 brodova, od 5 do 2 polja
    velika: { name: 'Velika flota', sizes: { 8: [4, 3, 3, 2], 10: [5, 4, 3, 3, 2], 12: [5, 5, 4, 3, 3, 2] } },
  };
  const SHIP_NAMES = { 5: 'Nosač', 4: 'Krstarica', 3: 'Razarač', 2: 'Patrolni čamac', 1: 'Podmornica' };
  const LETTERS = 'ABCDEFGHIJKL';
  const sizesOf = (fleet, n = N) => (FLEETS[fleet] || FLEETS.klasicna).sizes[n] || (FLEETS[fleet] || FLEETS.klasicna).sizes[N];
  const coord = (x, y) => LETTERS[x] + (y + 1);

  // brod: { x, y, len, dir: 'h' | 'v' } (x = kolona, y = red, od 0)
  function cellsOf(s) {
    const out = [];
    for (let i = 0; i < s.len; i++) out.push(s.dir === 'v' ? [s.x, s.y + i] : [s.x + i, s.y]);
    return out;
  }
  const inside = (x, y, n = N) => x >= 0 && y >= 0 && x < n && y < n;

  // da li novi brod moze da stane pored vec postavljenih (touch = brodovi smeju da se dodiruju)
  function fits(ships, s, touch, n = N) {
    const cells = cellsOf(s);
    if (!cells.every(([x, y]) => inside(x, y, n))) return false;
    const taken = new Set();
    for (const o of ships) for (const [x, y] of cellsOf(o)) {
      if (touch) taken.add(x + ',' + y);
      else for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) taken.add((x + dx) + ',' + (y + dy));
    }
    return cells.every(([x, y]) => !taken.has(x + ',' + y));
  }

  // cela flota: tacni brojevi brodova, sve na tabli, bez preklapanja (i bez dodirivanja)
  function validFleet(ships, fleet, touch, n = N) {
    if (!Array.isArray(ships) || ships.length > 20) return 'Rasporedi sve brodove.';
    const want = [...sizesOf(fleet, n)].sort((a, b) => b - a);
    const clean = [];
    for (const s of ships) {
      if (!s || typeof s !== 'object') return 'Neispravan brod.';
      const c = { x: Math.floor(Number(s.x)), y: Math.floor(Number(s.y)), len: Math.floor(Number(s.len)), dir: s.dir === 'v' ? 'v' : 'h' };
      if (![c.x, c.y, c.len].every(Number.isFinite) || c.len < 1 || c.len > 5) return 'Neispravan brod.';
      if (!fits(clean, c, touch, n)) return touch ? 'Brodovi ne smeju da se preklapaju niti da izlaze sa table.' : 'Brodovi ne smeju da se dodiruju (ni ćoškom) niti da izlaze sa table.';
      clean.push(c);
    }
    const have = clean.map((s) => s.len).sort((a, b) => b - a);
    if (have.join() !== want.join()) return 'Rasporedi tačno brodove iz flote.';
    return clean;
  }

  // nasumican raspored cele flote
  function randomFleet(fleet, touch, n = N) {
    for (let tries = 0; tries < 300; tries++) {
      const ships = [];
      let ok = true;
      for (const len of sizesOf(fleet, n)) {
        let placed = false;
        for (let k = 0; k < 300 && !placed; k++) {
          const s = { x: Math.floor(Math.random() * n), y: Math.floor(Math.random() * n), len, dir: Math.random() < 0.5 ? 'h' : 'v' };
          if (fits(ships, s, touch, n)) { ships.push(s); placed = true; }
        }
        if (!placed) { ok = false; break; }
      }
      if (ok) return ships;
    }
    return null;
  }

  // polja 3x3 oko centra (za radar i bombu), samo ona na tabli
  function area3(x, y, n = N) {
    const out = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (inside(x + dx, y + dy, n)) out.push([x + dx, y + dy]);
    return out;
  }

  const API = { N, SIZES, FLEETS, SHIP_NAMES, LETTERS, coord, sizesOf, cellsOf, inside, fits, validFleet, randomFleet, area3 };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.BS_RULES = API;
})(typeof window !== 'undefined' ? window : globalThis);
