// Izgled "Dino ostrvo": ostrvo iz praistorije, realisticniji izgled (senke, teksture, prirodne boje).
// Dzungla (paprat), fosilna brda (fosili), dino pasnjaci (jaja), vocnjaci (voce), vulkani (obsidijan),
// a pustinja je blato sa tragovima dinosaurusa. Sela su kampovi (satori), gradovi istrazivacke stanice,
// putevi drvene staze, a umesto lopova je Reks. Sve je SVG, nista nije preuzeto sa strane.
/* exported DINO */
const DINO = (() => {
  const shade = (hex, f) => {
    const n = parseInt(hex.slice(1), 16);
    const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f));
    return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
  };
  const f1 = (v) => (+v).toFixed(1);
  const g = (x, y, s, body) => `<g transform="translate(${f1(x)} ${f1(y)}) scale(${s})">${body}</g>`;
  // ponovljivi "slucajni" brojevi da se tabla ne menja pri svakom crtanju
  const rnd = (seed) => { let s = Math.abs(Math.floor(seed)) % 2147483647 || 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; };
  const soft = (rx, ry, o = 0.35) => `<ellipse cx="1.5" cy="1" rx="${rx}" ry="${ry}" fill="#0b0d05" opacity="${o * 0.8}"/>`;

  // tekstura polja se pravi jednom kao slika sestougla (crno sa promenljivom providnoscu), pa je crtanje brzo
  const HEX_R = 58.5, HEX_W = HEX_R * Math.sqrt(3), HEX_H = HEX_R * 2;
  const NOISE = (() => {
    try {
      const k = 1.2, w = Math.round(HEX_W * k), h = Math.round(HEX_H * k);
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      const cx = cv.getContext('2d'), img = cx.createImageData(w, h);
      const R = rnd(99), W = [...Array(8)].map(() => [0.02 + R() * 0.05, 0.02 + R() * 0.05, R() * 6]);
      const G = rnd(7);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        let v = 0; for (const [a, b, ph] of W) v += Math.sin(a * x + ph) * Math.cos(b * y - ph);
        const mott = Math.max(0, Math.min(1, 0.5 + v * 0.22)), grain = G();
        img.data[(y * w + x) * 4 + 3] = Math.round(255 * Math.min(1, mott * 0.75 + grain * grain * 0.45));
      }
      cx.putImageData(img, 0, 0);
      // samo unutar sestougla
      cx.globalCompositeOperation = 'destination-in'; cx.beginPath();
      for (let i = 0; i < 6; i++) { const a = (-90 + 60 * i) * Math.PI / 180; cx.lineTo(w / 2 + Math.cos(a) * HEX_R * k, h / 2 + Math.sin(a) * HEX_R * k); }
      cx.fill();
      return cv.toDataURL();
    } catch (_) { return ''; }
  })();
  const rg = (id, a, b, cx = '.35', cy = '.3') => `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r=".75"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></radialGradient>`;
  const lg = (id, stops, x2 = 0, y2 = 1) => `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops.map(([o, c, op = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${op}"/>`).join('')}</linearGradient>`;
  // zajednicke boje i filteri (tabla ih ima jednom; karte i figure ih nose sa sobom)
  const GDEFS = `
    <filter id="dnBlur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.4"/></filter>
    <filter id="dnSmoke" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.2"/></filter>
    <filter id="dnGlow" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="2.5"/></filter>
    <filter id="dnGrain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="3" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.6 1.15" result="a"/><feComposite in="a" in2="SourceGraphic" operator="in"/></filter>
    <filter id="dnMottle" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".07" numOctaves="3" seed="8" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.4 1.45" result="a"/><feComposite in="a" in2="SourceGraphic" operator="in"/></filter>
    ${rg('dnLeafA', '#7fb54a', '#1d4a17')}${rg('dnLeafB', '#9cc35a', '#2f5e1f')}${rg('dnLeafC', '#5e9a44', '#123a14')}
    ${rg('dnRock', '#c9b08a', '#5e4630')}${rg('dnRockG', '#a7a29a', '#3f3a34')}${rg('dnEgg', '#fffaf0', '#c9bb95', '.38', '.28')}
    ${rg('dnFruit', '#ffcf6a', '#c2521a')}${rg('dnDino', '#a7ad7a', '#4d5530')}${rg('dnDino2', '#c79a6a', '#6a4a2c')}
    ${lg('dnTrunk', [[0, '#5a3a1e'], [0.45, '#9a6a3a'], [1, '#3e2814']], 1, 0)}
    ${lg('dnCone', [[0, '#8f877c'], [0.45, '#625b52'], [1, '#2c2824']], 1, 0)}
    ${lg('dnLava', [[0, '#fff2a0'], [0.35, '#ffb02e'], [1, '#c8300e']])}
    ${lg('dnBone', [[0, '#f5ecd6'], [1, '#bfae88']])}
    ${lg('dnObs', [[0, '#5a5068'], [0.5, '#1d1a22'], [1, '#0c0a10']], 1, 1)}
  `;
  // tabla jos dobija teksturu (jednom za celu tablu)
  const DEFS = `<defs>${GDEFS}
    ${NOISE ? `<image id="dnHexTex" href="${NOISE}" x="${f1(-HEX_W / 2)}" y="${-HEX_R}" width="${f1(HEX_W)}" height="${HEX_H}" preserveAspectRatio="none"/>` : ''}
  </defs>`;
  const PDEFS = `<defs>
    <filter id="dnPShadow" x="-40%" y="-40%" width="180%" height="180%"><feDropShadow dx="1.6" dy="2.4" stdDeviation="1.6" flood-color="#0b0d05" flood-opacity=".55"/></filter>
    ${lg('dnGlass', [[0, '#e9fbff'], [0.5, '#8fd3e6'], [1, '#3c7f96']], 1, 1)}
    ${lg('dnMetal', [[0, '#e4e6e2'], [0.5, '#a9aca6'], [1, '#6c6f69']], 1, 0)}
    ${lg('dnSkin', [[0, '#55603a'], [0.55, '#7e8752'], [1, '#c8c08e']])}
    ${lg('dnSkinD', [[0, '#3e4628'], [1, '#6c7246']])}
    ${rg('dnFire', '#fff5a0', '#ff5a14', '.5', '.7')}
  </defs>`;

  // sirovine: nova imena, boje karata ostaju kao u obicnoj igri
  const RES = {
    drvo: { name: 'Paprat', ico: '🌿' },
    glina: { name: 'Fosili', ico: '🦴' },
    vuna: { name: 'Jaja', ico: '🥚' },
    zito: { name: 'Voće', ico: '🍌' },
    kamen: { name: 'Obsidijan', ico: '🌋' },
  };
  // prirodne, prigusene boje kao na slici ostrva
  const TERRAIN = {
    suma: { a: '#5a9a3a', b: '#22491a' }, // dzungla
    gliniste: { a: '#cdb08a', b: '#7d6246' }, // fosilna brda
    pasnjak: { a: '#a9c564', b: '#557f2b' }, // dino pasnjak
    polje: { a: '#d8c169', b: '#8c7a2c' }, // vocnjak / savana
    planina: { a: '#a49e95', b: '#4e4842' }, // vulkan
    pustinja: { a: '#d6bd8e', b: '#93754c' }, // blato sa tragovima
  };
  const BOARD = { ring1: '#0c5670', ring2: '#d6c08a', hexStroke: '#3b2c1a', token: '#f4ead0', tokenInk: '#2a1d10', hot: '#b8281c', side: -0.55, depth: 14, defs: DEFS };

  // ---------- biljke ----------
  function crown(x, y, s, grad, seed) {
    const R = rnd(seed); let b = soft(9, 3.5);
    const blobs = [[-5, -9, 6.5], [5, -10, 6.5], [0, -15, 7], [-2, -6, 6], [4, -5, 5.5]];
    for (const [bx, by, r] of blobs) b += `<circle cx="${f1(bx + R() * 2 - 1)}" cy="${f1(by + R() * 2 - 1)}" r="${f1(r)}" fill="url(#${grad})"/>`;
    for (let i = 0; i < 7; i++) b += `<circle cx="${f1(R() * 12 - 7)}" cy="${f1(-17 + R() * 10)}" r="${f1(1 + R() * 1.3)}" fill="#c8e08a" opacity=".35"/>`;
    return g(x, y, s, b);
  }
  function palm(x, y, s = 1, seed = 1) {
    const R = rnd(seed + 7); let b = soft(9, 3);
    const lean = R() * 4 - 2;
    b += `<path d="M-1.4 0 Q${f1(-1 + lean)} -10 ${f1(lean + 0.2)} -21 L${f1(lean + 2)} -21 Q${f1(1.2 + lean)} -10 1.4 0 Z" fill="url(#dnTrunk)"/>`;
    for (let yy = -3; yy > -20; yy -= 2.6) b += `<path d="M${f1(-1.3 + lean * (-yy / 21))} ${yy} l2.8 -0.9" stroke="#2f1f0e" stroke-width=".5" opacity=".7"/>`;
    const tx = lean + 1.1, ty = -21, leaf = ['', ''];
    let ribs = '';
    for (let i = 0; i < 7; i++) {
      const a = (-175 + i * 28 + R() * 10) * Math.PI / 180, len = 11 + R() * 3;
      const ex = tx + Math.cos(a) * len, ey = ty + Math.sin(a) * len * 0.55 + 5;
      const mx = tx + Math.cos(a) * len * 0.5, my = ty + Math.sin(a) * len * 0.5 - 3;
      ribs += `M${f1(tx)} ${f1(ty)} Q${f1(mx)} ${f1(my)} ${f1(ex)} ${f1(ey)}`;
      for (let k = 1; k < 6; k++) {
        const t = k / 6, px = (1 - t) * (1 - t) * tx + 2 * (1 - t) * t * mx + t * t * ex, py = (1 - t) * (1 - t) * ty + 2 * (1 - t) * t * my + t * t * ey;
        const ll = 3.2 * (1 - t * 0.5);
        leaf[i % 2] += `M${f1(px)} ${f1(py)} l${f1(Math.cos(a + 1.2) * ll)} ${f1(Math.sin(a + 1.2) * ll + 1.4)} M${f1(px)} ${f1(py)} l${f1(Math.cos(a - 1.2) * ll)} ${f1(Math.sin(a - 1.2) * ll + 1.4)}`;
      }
    }
    b += `<path d="${ribs}" stroke="#24461a" stroke-width="1.6" fill="none" stroke-linecap="round"/><path d="${leaf[0]}" stroke="#5c9a3a" stroke-width="1" stroke-linecap="round"/><path d="${leaf[1]}" stroke="#3f7a2c" stroke-width="1" stroke-linecap="round"/>`;
    b += `<circle cx="${f1(tx - 0.8)}" cy="${f1(ty + 1.2)}" r="1.3" fill="#5a3a18"/><circle cx="${f1(tx + 1)}" cy="${f1(ty + 1.4)}" r="1.2" fill="#4a2e12"/>`;
    return g(x, y, s, b);
  }
  function fern(x, y, s = 1, c = '#4e8f34') {
    let b = soft(7, 2.4, 0.3), rib = '';
    const lf = ['', ''];
    for (const [a, len] of [[-165, 9], [-135, 11], [-108, 12.5], [-80, 12.5], [-52, 11], [-20, 9]]) {
      const r = a * Math.PI / 180, ex = Math.cos(r) * len, ey = Math.sin(r) * len * 0.8;
      rib += `M0 0 Q${f1(ex * 0.45)} ${f1(ey * 0.75 - 2.5)} ${f1(ex)} ${f1(ey)}`;
      for (let i = 1; i <= 6; i++) {
        const t = i / 7, px = ex * t, py = ey * t - 2.2 * Math.sin(t * Math.PI), ll = 2.6 * (1 - t * 0.6);
        lf[i % 2] += `M${f1(px)} ${f1(py)} l${f1(Math.cos(r + 1.3) * ll)} ${f1(Math.sin(r + 1.3) * ll)} M${f1(px)} ${f1(py)} l${f1(Math.cos(r - 1.3) * ll)} ${f1(Math.sin(r - 1.3) * ll)}`;
      }
    }
    b += `<path d="${rib}" stroke="${shade(c, -0.4)}" stroke-width=".7" fill="none"/><path d="${lf[0]}" stroke="${shade(c, 0.2)}" stroke-width=".9" stroke-linecap="round"/><path d="${lf[1]}" stroke="${c}" stroke-width=".9" stroke-linecap="round"/>`;
    return g(x, y, s, b);
  }
  function grassTuft(x, y, s = 1, c = '#c9a83a', seed = 1) {
    const R = rnd(seed), d = ['', ''];
    for (let i = 0; i < 6; i++) { const dx = R() * 8 - 4, h = 5 + R() * 5, bend = R() * 4 - 2; d[i % 2] += `M${f1(dx)} 0 Q${f1(dx + bend * 0.4)} ${f1(-h * 0.6)} ${f1(dx + bend)} ${f1(-h)}`; }
    return g(x, y, s, `<path d="${d[0]}" stroke="${shade(c, -0.3)}" stroke-width=".8" fill="none" stroke-linecap="round"/><path d="${d[1]}" stroke="${c}" stroke-width=".8" fill="none" stroke-linecap="round"/>`);
  }
  function fruitTree(x, y, s = 1, seed = 1) {
    const R = rnd(seed + 3);
    let b = `<path d="M-1.3 0 Q-1.5 -6 -0.4 -11 L1.4 -11 Q1 -6 1.3 0 Z" fill="url(#dnTrunk)"/>`;
    b += crown(0, -4, 0.85, 'dnLeafB', seed).replace('<g ', '<g data-c="1" ');
    for (let i = 0; i < 6; i++) b += `<circle cx="${f1(R() * 11 - 5.5)}" cy="${f1(-10 - R() * 9)}" r="1.25" fill="url(#dnFruit)"/>`;
    return g(x, y, s, soft(8, 2.8) + b);
  }
  function banana(x, y, s = 1) {
    let b = soft(6, 2.2);
    b += '<path d="M0 0 Q-0.6 -6 0 -10" stroke="#5e6e2a" stroke-width="1.6" fill="none"/>';
    for (const [a, c] of [[-150, '#6f9a3a'], [-30, '#5e8a32'], [-110, '#86b04a'], [-70, '#7aa442']]) {
      const r = a * Math.PI / 180, ex = Math.cos(r) * 11, ey = -9 + Math.sin(r) * 8;
      b += `<path d="M0 -9 Q${f1(ex * 0.5 - 2)} ${f1(-9 + Math.sin(r) * 6 - 3)} ${f1(ex)} ${f1(ey)} Q${f1(ex * 0.5 + 2)} ${f1(-9 + Math.sin(r) * 3)} 0 -9 Z" fill="${c}"/><path d="M0 -9 L${f1(ex)} ${f1(ey)}" stroke="#3e5a1c" stroke-width=".4"/>`;
    }
    for (const dx of [-1.6, 0, 1.6]) b += `<path d="M${dx} -6 Q${dx - 2.4} -2.5 ${dx - 0.6} 0.4" stroke="#e8c53a" stroke-width="1.5" fill="none" stroke-linecap="round"/>`;
    return g(x, y, s, b);
  }

  // ---------- kamenje, kosti, vulkan ----------
  function rock(x, y, s = 1, grad = 'dnRock', seed = 1) {
    const R = rnd(seed + 11);
    const p = [[-9, 0], [-10, -5 - R() * 2], [-5, -10 - R() * 3], [2, -11 - R() * 2], [8, -7 - R() * 2], [10, 0]];
    let b = soft(10, 3);
    b += `<polygon points="${p.map((q) => q.map(f1).join(',')).join(' ')}" fill="url(#${grad})"/>`;
    b += `<polygon points="${f1(p[3][0])},${f1(p[3][1])} ${f1(p[4][0])},${f1(p[4][1])} 10,0 3,0" fill="#000" opacity=".22"/>`;
    b += `<polygon points="${f1(p[1][0])},${f1(p[1][1])} ${f1(p[2][0])},${f1(p[2][1])} ${f1(p[3][0])},${f1(p[3][1])} -2,-6" fill="#fff" opacity=".14"/>`;
    b += `<path d="M-3 -7 l2 3 l-1 3 M4 -6 l-1 3" stroke="#000" stroke-width=".45" opacity=".35" fill="none"/>`;
    return g(x, y, s, b);
  }
  function bone(x, y, s = 1, rot = 0) {
    const end = (cx) => `<circle cx="${cx}" cy="-1.2" r="1.5" fill="url(#dnBone)"/><circle cx="${cx}" cy="1.2" r="1.5" fill="url(#dnBone)"/>`;
    return g(x, y, s, `<g transform="rotate(${rot})"><rect x="-6" y="-.8" width="12" height="2.6" rx="1" fill="#000" opacity=".2"/>${end(-6)}${end(6)}<rect x="-6" y="-1" width="12" height="2" fill="url(#dnBone)"/></g>`);
  }
  // fosilni kostur u steni: kicma, rebra i lobanja
  function skeleton(x, y, s = 1) {
    let b = '<ellipse cx="0" cy="1" rx="20" ry="6" fill="#4a3420" opacity=".25"/>';
    b += '<path d="M-20 -2 Q-8 -8 4 -6 Q10 -5 13 -7" stroke="#d9ccaa" stroke-width="1.8" fill="none" stroke-linecap="round"/>';
    for (let i = 0; i < 6; i++) { const sx = -9 + i * 3; b += `<path d="M${sx} -6.5 Q${sx - 3} -1 ${sx - 1} 3" stroke="#e8dcc0" stroke-width="1.2" fill="none" stroke-linecap="round"/><path d="M${sx} -6.5 Q${sx - 3} -1 ${sx - 1} 3" stroke="#7a6a4a" stroke-width=".3" fill="none" transform="translate(.6 .4)"/>`; }
    b += '<path d="M12 -9 Q15 -13 21 -12 Q26 -11 26 -8 L24 -6 L22 -7.5 L20 -5.8 L18 -7.2 L16 -5.6 Q13 -5 12 -9 Z" fill="url(#dnBone)" stroke="#6e5e40" stroke-width=".4"/>';
    b += '<circle cx="17.5" cy="-10" r="1.3" fill="#3a2a18"/><circle cx="22" cy="-10.3" r=".7" fill="#3a2a18"/>';
    b += '<path d="M-20 -2 l-4 1.5" stroke="#d9ccaa" stroke-width="1.2" stroke-linecap="round"/>';
    return g(x, y, s, b);
  }
  function skull(x, y, s = 1) {
    const d = 'M-8 0 Q-9 -6 -4 -8 Q2 -10 7 -6 L9 -3 Q8 0 5 0 L4 -1.5 L3 0 L1.5 -1.5 L0 0 Z';
    return g(x, y, s, soft(8, 2.4, 0.3) + `<path d="${d}" fill="url(#dnBone)" stroke="#6e5e40" stroke-width=".45"/><circle cx="-2" cy="-5" r="1.8" fill="#3a2a18"/><circle cx="3.5" cy="-5.2" r=".9" fill="#3a2a18"/>`);
  }
  function egg(x, y, s = 1, c = 'url(#dnEgg)') {
    const d = 'M0 0 Q-4.2 0 -4.2 -5 Q-4 -11 0 -11 Q4 -11 4.2 -5 Q4.2 0 0 0 Z';
    return g(x, y, s, `<ellipse cx="0.8" cy="0" rx="4" ry="1.2" fill="#0b0d05" opacity=".35"/><path d="${d}" fill="${c}"/><circle cx="-1.5" cy="-7" r=".7" fill="#8a7a4a" opacity=".6"/><circle cx="1.6" cy="-4" r=".55" fill="#8a7a4a" opacity=".6"/><circle cx="-.6" cy="-3" r=".45" fill="#8a7a4a" opacity=".5"/>`);
  }
  function nest(x, y, s = 1) {
    let b = soft(11, 3.4);
    b += '<ellipse cx="0" cy="-1" rx="10" ry="3.6" fill="#4a3418"/>';
    b += egg(-3.6, -0.8, 0.72) + egg(3.6, -0.8, 0.72) + egg(0, -0.2, 0.82);
    b += '<path d="M-10 -1.5 Q0 5.5 10 -1.5 Q9.5 3.4 0 4.4 Q-9.5 3.4 -10 -1.5 Z" fill="#8a6a36"/>';
    for (let i = 0; i < 9; i++) b += `<path d="M${-9 + i * 2.2} ${f1(1 + Math.sin(i) * 1.3)} l3 -1.2" stroke="${i % 2 ? '#b8954e' : '#5a4220'}" stroke-width=".6"/>`;
    return g(x, y, s, b);
  }
  // biljojed dugog vrata
  function longneck(x, y, s = 1, grad = 'dnDino', flip = false) {
    let b = soft(13, 3);
    b += '<path d="M-7 -1 V-7 M6 -1 V-7" stroke="#3a3a22" stroke-width="2.6" stroke-linecap="round"/>';
    const body = 'M-10 -6 Q-12 -14 -2 -14.5 Q7 -15 9 -11 Q12 -12 13 -20 Q13.5 -26 11 -27.5 Q8.5 -28 8 -25 Q8.6 -18 7 -14.5 Q11 -5 3 -4.2 L-6 -4 Q-15 -3.4 -19 -1 Q-14 -6 -10 -6 Z';
    b += `<path d="${body}" fill="url(#${grad})" stroke="#2a2a14" stroke-width=".35"/>`;
    b += '<path d="M7.2 -26 Q10 -30 14 -28 Q15.6 -26 13 -24.6 Q10 -24 8 -25 Z" fill="url(#' + grad + ')" stroke="#2a2a14" stroke-width=".35"/>';
    b += '<circle cx="12" cy="-27" r=".6" fill="#111"/>';
    b += '<path d="M-1 -4.5 V1 M-4 -4.5 V1" stroke="#545a34" stroke-width="2.4" stroke-linecap="round"/>';
    b += '<path d="M-6 -12 Q0 -14 6 -12" stroke="#fff" stroke-width=".8" opacity=".2" fill="none"/>';
    return g(x, y, s, flip ? `<g transform="scale(-1 1)">${b}</g>` : b);
  }
  function fence(x, y, s = 1, w = 22) {
    let b = `<rect x="${-w / 2}" y="-.6" width="${w}" height="1.6" fill="#0b0d05" opacity=".2"/>`;
    b += `<path d="M${-w / 2} -6 H${w / 2} M${-w / 2} -2.8 H${w / 2}" stroke="#8a6034" stroke-width="1.3"/><path d="M${-w / 2} -5.4 H${w / 2} M${-w / 2} -2.2 H${w / 2}" stroke="#3e2a14" stroke-width=".4"/>`;
    for (let px = -w / 2; px <= w / 2 + 0.1; px += w / 3) b += `<rect x="${f1(px - 0.9)}" y="-8.4" width="1.8" height="8.6" fill="url(#dnTrunk)"/>`;
    return g(x, y, s, b);
  }
  function volcano(x, y, s = 1) {
    let b = '<ellipse cx="2" cy="1" rx="19" ry="4.5" fill="#0b0d05" opacity=".45" filter="url(#dnBlur)"/>';
    const cone = 'M-18 0 Q-10 -10 -5.5 -20 Q0 -22.5 5.5 -20 Q10 -10 18 0 Q0 3.4 -18 0 Z';
    b += `<path d="${cone}" fill="url(#dnCone)"/>`;
    for (const [sx, ex] of [[-4, -12], [-2, -6], [2, 5], [4, 12], [0, 0.5]]) b += `<path d="M${sx} -19.5 Q${(sx + ex) / 2 + 1} -10 ${ex} 0.5" stroke="#2a2622" stroke-width=".6" fill="none" opacity=".55"/>`;
    b += '<path d="M-5.2 -20 Q-3.4 -16 -2.4 -12 Q-1.6 -8 -3.6 -3.5 Q-.4 -7 .6 -12 Q1.4 -16.5 .6 -20.5 Z" fill="url(#dnLava)"/>';
    b += '<path d="M3.2 -20.2 Q5 -15 7.2 -10.5 Q5.8 -15.5 5.2 -20 Z" fill="url(#dnLava)"/>';
    b += '<ellipse cx="0" cy="-20.6" rx="6" ry="2" fill="#ff7a1a" filter="url(#dnGlow)"/><ellipse cx="0" cy="-20.6" rx="5.4" ry="1.5" fill="#ffd25a"/>';
    b += '<g filter="url(#dnSmoke)" opacity=".92"><circle cx="-2" cy="-27" r="4" fill="#8a8580"/><circle cx="3" cy="-31" r="5" fill="#b7b2ab"/><circle cx="-1" cy="-37" r="5.5" fill="#d8d4ce"/><circle cx="6" cy="-38" r="4" fill="#e9e6e1"/></g>';
    return g(x, y, s, b);
  }
  function obsidian(x, y, s = 1) {
    let b = soft(6.5, 2.2);
    b += '<polygon points="-6,0 -6.5,-5 -2.5,-9.5 3,-8.5 6.5,-3.5 5.5,0" fill="url(#dnObs)"/>';
    b += '<polygon points="-2.5,-9.5 3,-8.5 1,-4.5 -3,-5.2" fill="#8a7aa8" opacity=".55"/><path d="M-4.5 -4 L-2.4 -7.4" stroke="#e6dcff" stroke-width=".55" opacity=".8"/>';
    return g(x, y, s, b);
  }
  function footprint(x, y, s = 1, rot = 0) {
    const d = 'M0 4 Q-4 4 -3.6 -1 L-6.6 -9 L-4.4 -9.6 L-1.2 -4 L0 -11.4 L2.1 -11.4 L1.8 -4 L6.2 -8.6 L7.6 -7 L3.8 -1.6 Q4 4 0 4 Z';
    return g(x, y, s, `<g transform="rotate(${rot})"><path d="${d}" fill="#3e2c16" opacity=".55"/><path d="${d}" fill="#e2cc9a" opacity=".28" transform="translate(.8 .9)"/><path d="${d}" fill="#4a3518" opacity=".5" transform="scale(.82)"/></g>`);
  }
  function puddle(x, y, s = 1) {
    return g(x, y, s, '<ellipse cx="0" cy="0" rx="10" ry="3.4" fill="#4a3a26" opacity=".6"/><ellipse cx="0" cy="-.2" rx="8.4" ry="2.6" fill="#6f8a8a" opacity=".55"/><ellipse cx="-2.6" cy="-.8" rx="3" ry=".6" fill="#fff" opacity=".35"/>');
  }

  // tekstura polja: krupne mrlje i sitno zrno, samo unutar sestougla
  const TEX = { suma: ['#0e2a0c', 0.55, 0.22], gliniste: ['#3a2614', 0.32, 0.22], pasnjak: ['#2e4a14', 0.4, 0.2], polje: ['#5a4a14', 0.4, 0.22], planina: ['#1a1714', 0.38, 0.25], pustinja: ['#3a2a16', 0.35, 0.22] };
  function texture(type, cx, cy) {
    if (!NOISE) return '';
    const [, m] = TEX[type] || TEX.pustinja, rot = (Math.abs(Math.round(cx * 3 + cy * 5)) % 6) * 60;
    return `<use href="#dnHexTex" transform="translate(${f1(cx)} ${f1(cy)}) rotate(${rot})" opacity="${f1(Math.min(0.85, m * 1.6))}"/>`;
  }
  // tacke za ukrase: okolo broja, iza (gore) pa napred (dole)
  const RING = [[-26, -38], [0, -46], [26, -38], [-40, -16], [40, -16], [-14, -24], [14, -24], [-42, 10], [42, 10], [-30, 32], [30, 32], [-36, -32], [36, -32]];
  const sortY = (list) => list.sort((a, b) => a[1] - b[1]);
  function terrain(type, cx, cy, k = 1) {
    const sp = Math.max(1, k * 0.95), seed = Math.round(cx * 7 + cy * 13);
    const P = (dx, dy) => [cx + dx * sp, cy + dy];
    let h = texture(type, cx, cy);
    switch (type) {
      case 'suma': {
        const R = rnd(seed); const items = [];
        for (const [dx, dy] of RING) items.push([dx, dy, R()]);
        for (const [dx, dy, r] of sortY(items)) {
          const [x, y] = P(dx, dy + 8);
          if (r < 0.35) h += palm(x, y, 1.05 + r, seed + dx);
          else if (r < 0.55) h += fern(x, y, 1.15, r < 0.45 ? '#4e8f34' : '#3a7a2c');
          else h += crown(x, y, 1 + r * 0.35, ['dnLeafA', 'dnLeafB', 'dnLeafC'][Math.floor(r * 30) % 3], seed + dy);
        }
        return h;
      }
      case 'gliniste':
        return h + skeleton(...P(-4, -30), 1.05) + rock(...P(-36, -10), 1.25, 'dnRock', seed) + rock(...P(38, -8), 1.1, 'dnRock', seed + 1)
          + rock(...P(24, -40), 0.8, 'dnRock', seed + 2) + rock(...P(-38, 24), 0.9, 'dnRock', seed + 3) + skull(...P(36, 26), 0.95)
          + bone(...P(-22, 40), 0.9, -25) + bone(...P(22, 44), 0.8, 20) + grassTuft(...P(-26, -40), 1, '#6a7a34', seed);
      case 'pasnjak':
        return h + [...Array(9)].map((_, i) => grassTuft(...P([-34, -8, 18, -40, 40, -20, 20, -30, 34][i], [-30, -42, -36, 0, 2, 40, 42, 22, 24][i]), 1, '#7aa03a', seed + i)).join('')
          + fence(...P(-20, -26), 1, 24) + longneck(...P(18, -26), 0.95) + longneck(...P(-34, 8), 0.7, 'dnDino2', true) + nest(...P(36, 18), 1) + egg(...P(-28, 36), 0.9);
      case 'polje': {
        let r = h;
        for (let i = 0; i < 12; i++) r += grassTuft(...P([-40, -26, -10, 10, 26, 40, -44, 44, -34, 34, -16, 16][i], [-12, -40, -46, -46, -40, -12, 14, 14, 34, 34, 44, 44][i]), 1.2, '#d2b046', seed + i);
        return r + fruitTree(...P(-26, -28), 1.15, seed) + fruitTree(...P(26, -26), 1.05, seed + 1) + fruitTree(...P(0, -36), 0.9, seed + 2) + banana(...P(-38, 16), 1.05) + banana(...P(38, 18), 1);
      }
      case 'planina':
        return h + volcano(cx, cy - 16, 1.5) + obsidian(...P(-38, 12), 1.15) + obsidian(...P(38, 14), 1.25) + obsidian(...P(-24, 36), 0.85) + rock(...P(26, 38), 0.75, 'dnRockG', seed);
      case 'pustinja':
        return h + puddle(...P(-24, 26), 1.3) + footprint(...P(-24, -26), 1.5, -20) + footprint(...P(-4, -40), 1.5, 8) + footprint(...P(18, -26), 1.5, 30)
          + footprint(...P(34, -4), 1.4, 50) + bone(...P(30, 26), 1.15, 15) + skull(...P(6, 38), 0.9) + fern(...P(-40, 4), 0.75, '#6e7f34');
      default: return h;
    }
  }

  // put: drvena staza od dasaka u boji igraca, sa tamnim drvenim ivicama
  function road(r) {
    const dx = r.x2 - r.x1, dy = r.y2 - r.y1, len = Math.hypot(dx, dy), nx = -dy / len, ny = dx / len;
    const under = `<line x1="${r.x1 + 1.5}" y1="${r.y1 + 3}" x2="${r.x2 + 1.5}" y2="${r.y2 + 3}" stroke="#0b0d05" stroke-opacity=".45" stroke-width="12" stroke-linecap="round"/>`
      + `<line x1="${r.x1}" y1="${r.y1}" x2="${r.x2}" y2="${r.y2}" stroke="#3a2512" stroke-width="12" stroke-linecap="round"/>`;
    let top = `<line x1="${r.x1}" y1="${r.y1}" x2="${r.x2}" y2="${r.y2}" stroke="${r.col}" stroke-width="8.4" stroke-linecap="round"/>`;
    top += `<line x1="${r.x1 + nx * 2.4}" y1="${r.y1 + ny * 2.4}" x2="${r.x2 + nx * 2.4}" y2="${r.y2 + ny * 2.4}" stroke="#fff" stroke-width="1.6" opacity=".22" stroke-linecap="round"/>`;
    top += `<line x1="${r.x1 - nx * 2.6}" y1="${r.y1 - ny * 2.6}" x2="${r.x2 - nx * 2.6}" y2="${r.y2 - ny * 2.6}" stroke="#000" stroke-width="1.8" opacity=".18" stroke-linecap="round"/>`;
    const n = 7;
    for (let i = 1; i < n; i++) {
      const f = i / n, x = r.x1 + dx * f, y = r.y1 + dy * f;
      top += `<line x1="${x + nx * 4.2}" y1="${y + ny * 4.2}" x2="${x - nx * 4.2}" y2="${y - ny * 4.2}" stroke="${shade(r.col, -0.55)}" stroke-width=".9" opacity=".75"/>`;
    }
    return { under, top };
  }

  function piece(type, x, y, col) {
    const d = shade(col, -0.38), l = shade(col, 0.28), edge = 'stroke="#1a1208" stroke-width=".6" stroke-linejoin="round"';
    if (type === 'settlement') {
      // kamp: platneni sator u boji igraca, konopci, kocici i vatra
      return `<g class="piece" transform="translate(${x} ${y}) scale(1.4)">${PDEFS}<g filter="url(#dnPShadow)">
      <path d="M-12 10 L-2 -9 L2 -9 L12 10 Z" fill="${col}" ${edge}/>
      <path d="M-2 -9 L-12 10 L-7 10 Z" fill="${l}" opacity=".6"/>
      <path d="M2 -9 L12 10 L4 10 Z" fill="${d}" opacity=".75"/>
      <path d="M-1 -8 L-8 10 M1.5 -8 L7 10" stroke="#000" stroke-width=".35" opacity=".25"/>
      <path d="M0 -8 L-4.6 10 L4.6 10 Z" fill="#1e140a"/>
      <path d="M0 -8 L-2 10 L-4.6 10 Z" fill="${shade(col, -0.15)}" ${edge}/>
      <path d="M-2 -9 H2" stroke="#4a3018" stroke-width="1.4" stroke-linecap="round"/>
      <path d="M-2 -9 L-15 6 M2 -9 L15 6" stroke="#d9caa0" stroke-width=".45" opacity=".9"/>
      <path d="M-15 6 v2.4 M15 6 v2.4" stroke="#5a3a18" stroke-width="1"/>
      <path d="M0 -9 V-17" stroke="#3a2a18" stroke-width="1"/><path d="M0 -17 Q3.4 -16.2 6.6 -15.6 Q3.4 -14.4 0 -13.4 Z" fill="${col}" ${edge}/>
      </g>
      <g transform="translate(14 10)"><circle cx="0" cy="-2.5" r="5.5" fill="#ff8a2a" opacity=".35" filter="url(#dnPShadow)"/><path d="M-3.4 .4 L3.4 -1 M-3.4 -1 L3.4 .4" stroke="#4a2e12" stroke-width="1.4" stroke-linecap="round"/><path d="M0 -.8 Q-2.8 -4 -.6 -8 Q0 -5.5 1.3 -7 Q2.8 -3.6 0 -.8 Z" fill="url(#dnFire)"/></g>
    </g>`;
    }
    // istrazivacka stanica: zgrada u boji igraca, metalni krov, staklena kupola, antena i solarni panel
    let win = '';
    for (const wx of [-9, -3, 3]) win += `<rect x="${wx}" y="-4" width="4.4" height="4" rx=".5" fill="url(#dnGlass)" stroke="#1a1208" stroke-width=".4"/>`;
    let panel = '';
    for (const px of [-10.5, -4.5, 1.5, 7.5]) panel += `<path d="M${px} -7.6 V13.6" stroke="#000" stroke-width=".35" opacity=".25"/>`;
    return `<g class="piece" transform="translate(${x} ${y}) scale(1.2)">${PDEFS}<g filter="url(#dnPShadow)">
      <path d="M8 14 V2 H20 V14 Z" fill="${d}" ${edge}/><path d="M7 2 H21 L19.5 -.5 H8.5 Z" fill="url(#dnMetal)" ${edge}/>
      <rect x="10.5" y="5" width="7" height="3.6" rx=".5" fill="url(#dnGlass)" stroke="#1a1208" stroke-width=".4"/>
      <path d="M-13 14 V-8 H10 V14 Z" fill="${col}" ${edge}/>${panel}
      <path d="M-13 14 V-8 H-6 V14 Z" fill="#fff" opacity=".14"/><path d="M4 14 V-8 H10 V14 Z" fill="#000" opacity=".18"/>
      <path d="M-14.5 -8 H11.5 L9 -11 H-12 Z" fill="url(#dnMetal)" ${edge}/>
      ${win}
      <path d="M-3.6 14 V5 H2.6 V14 Z" fill="#2a2a26" ${edge}/><path d="M-.5 5 V14" stroke="#6a6a62" stroke-width=".5"/>
      <path d="M-13 14 H10" stroke="#3a3a34" stroke-width="1.6"/>
      <path d="M-11 -11 A9 8.5 0 0 1 7 -11 Z" fill="url(#dnGlass)" stroke="#1a1208" stroke-width=".6"/>
      <path d="M-2 -19.5 V-11 M-8 -16.5 Q-6 -13 -6 -11 M4 -16.5 Q2 -13 2 -11" stroke="#fff" stroke-width=".5" fill="none" opacity=".7"/>
      <path d="M-7.5 -16 Q-5 -18.4 -2 -19" stroke="#fff" stroke-width="1.2" fill="none" opacity=".8" stroke-linecap="round"/>
      <path d="M15 -1 V-21" stroke="#6c6f69" stroke-width="1.3"/><path d="M12.6 -17 L15 -21 L17.4 -17 M13.2 -11 L15 -14.5 L16.8 -11 M13.2 -11 L16.8 -17 M16.8 -11 L13.2 -17" stroke="#9a9d96" stroke-width=".55" fill="none"/>
      <circle cx="15" cy="-22" r="1.6" fill="#ff3a2a"/>
      <path d="M-16 14 L-19 6 L-11 6 L-8 14 Z" fill="#1e3550" stroke="#9aa" stroke-width=".4"/><path d="M-17.5 10 H-9.5 M-15 6 L-12 14" stroke="#7fb0d0" stroke-width=".35"/>
      </g><circle cx="15" cy="-22" r="4" fill="#ff3a2a" opacity=".3"/>
    </g>`;
  }

  // Reks (umesto lopova): tiranosaurus sa senkama i prugama
  function robber(x, y) {
    const e = 'stroke="#1a1608" stroke-width=".55" stroke-linejoin="round"';
    const body = 'M-32 -9 Q-18 -14 -8 -16.5 Q2 -19.5 8.5 -24 L13 -19 Q9.5 -12 8 -6 Q4 2 -4 1 Q-12 0 -18 -4 Q-25 -6.5 -32 -9 Z';
    const head = 'M6.5 -24.5 Q8.5 -31.5 17 -31.5 Q25.5 -30.8 28.5 -25.5 L28.5 -22.4 Q22 -21.6 15.6 -20.6 Q11 -19.4 9.6 -20.4 Q6 -21 6.5 -24.5 Z';
    const jaw = 'M9.6 -20 Q15 -19 27.6 -19.4 Q26.6 -15.6 19 -15.2 Q12.6 -15 10.4 -17.6 Z';
    return `<g class="rex" transform="translate(${x + 6} ${y + 6}) scale(1.02)">${PDEFS}
      <ellipse cx="-3" cy="12.5" rx="24" ry="4.2" fill="#0b0d05" opacity=".45" filter="url(#dnPShadow)"/>
      <path d="M-12 -6 Q-17 -1 -15 4 L-16 11.6 L-10.4 11.6 L-10.6 5 Q-7 0 -6 -6 Z" fill="url(#dnSkinD)" ${e}/>
      <path d="M-16.5 11.6 l-1.6 1 M-13.3 11.6 l0 1.4 M-10.6 11.6 l1.4 1" stroke="#1a1608" stroke-width=".8"/>
      <path d="${body}" fill="url(#dnSkin)" ${e}/>
      <path d="M-24 -9.4 Q-22 -12 -20 -9.6 M-16 -11.4 Q-13.6 -14.6 -11.2 -11.8 M-7 -13.6 Q-4.6 -17 -2 -14 M1.6 -16 Q3.8 -19.6 6 -17" stroke="#2e3418" stroke-width="1.1" fill="none" opacity=".75" stroke-linecap="round"/>
      <path d="M-14 -3.6 Q-4 1 6 -4.6" stroke="#e4dcae" stroke-width="2.2" fill="none" opacity=".45" stroke-linecap="round"/>
      <path d="M8 -11.4 Q11.6 -10.2 12 -7.6 M10 -9 L12.4 -7.6 L11.4 -6" stroke="#3a3a1c" stroke-width="1.1" fill="none" stroke-linecap="round"/>
      <path d="M-6 -11 Q3 -12 3 -3 Q2.4 2.4 -1 5 L0 11.6 L-6.4 11.6 L-5.4 4.6 Q-11 -1.6 -6 -11 Z" fill="url(#dnSkin)" ${e}/>
      <path d="M-6.8 11.6 l-1.4 1.1 M-3.4 11.6 v1.4 M-.2 11.6 l1.4 1" stroke="#1a1608" stroke-width=".8"/>
      <path d="${jaw}" fill="#6e7446" ${e}/>
      <path d="${head}" fill="url(#dnSkin)" ${e}/>
      <path d="M12 -20.6 L12.8 -19.2 L13.8 -20.8 L14.8 -19.3 L15.8 -21 L16.8 -19.4 L17.8 -21.1 L18.8 -19.6 L19.8 -21.3 L20.8 -19.8 L21.8 -21.5 L22.8 -20 L23.8 -21.7 L24.8 -20.1 L26 -21.8" stroke="#3a3420" stroke-width=".3" fill="#f2ead2"/>
      <path d="M8.4 -27.4 Q12.6 -30.6 18 -29.6" stroke="#2e3418" stroke-width=".9" fill="none" opacity=".6"/>
      <ellipse cx="15.6" cy="-26.4" rx="1.7" ry="1.3" fill="#e8b830"/><ellipse cx="15.9" cy="-26.4" rx=".6" ry="1.1" fill="#140e04"/>
      <path d="M13.2 -28.2 L18.2 -27.6" stroke="#1a1608" stroke-width="1" stroke-linecap="round"/>
      <circle cx="26.4" cy="-25.8" r=".6" fill="#1a1608"/>
    </g>`;
  }

  const card = {
    drvo: () => fern(-7, 9, 1.4) + palm(8, 10, 1.1, 3),
    glina: () => skull(-4, 6, 1.6) + bone(8, 8, 1, 25),
    vuna: () => nest(0, 7, 1.55),
    zito: () => banana(-7, 9, 1.3) + fruitTree(7, 10, 1.05, 4),
    kamen: () => volcano(-4, 10, 0.78) + obsidian(10, 9, 1.15),
    vitez: () => '<path d="M-13 -2 Q-13 -6 -8 -7 Q-6 -16 0 -16 Q6 -16 8 -7 Q13 -6 13 -2 Q0 1 -13 -2 Z" fill="#c9a86a"/><path d="M-8 -7 Q0 -4 8 -7 L8 -9 Q0 -6 -8 -9 Z" fill="#5a3a18"/><path d="M0 -16 Q6 -16 8 -7 Q13 -6 13 -2 Q4 -.4 2 -1 Z" fill="#000" opacity=".2"/>',
    bod: () => '<path d="M-6 -16 Q-12 -6 -6 4 Q0 8 6 4 Q12 -6 6 -16 Z" fill="#e0962a"/><path d="M-6 -16 Q-12 -6 -6 4 Q-3 6 -2 5 Q-8 -4 -3 -15 Z" fill="#fff" opacity=".25"/><text x="0" y="-2" text-anchor="middle" font-size="9" font-weight="900" fill="#4a2806">+1</text>',
    putevi: () => [-12, -4, 4, 12].map((xx) => `<rect x="${xx - 3}" y="-14" width="6" height="18" rx="1" fill="url(#dnTrunk)"/>`).join(''),
    obilje: () => `<path d="M-12 -4 H12 L9 8 H-9 Z" fill="#8a6a36"/><path d="M-11 0 H11 M-10 4 H10" stroke="#4a3418" stroke-width=".8"/>${egg(-5, -4, 0.8)}${banana(4, -2, 0.7)}<circle cx="0" cy="-6" r="2.4" fill="url(#dnFruit)"/>`,
    monopol: () => '<path d="M-14 -16 L14 -16 M-14 -16 L-14 6 M14 -16 L14 6 M-14 -9 L14 -9 M-14 -2 L14 -2 M-14 5 L14 5 M-7 -16 V6 M0 -16 V6 M7 -16 V6" stroke="#e9e2cf" stroke-width="1.2"/>',
  };
  const cardSVG = (k, attrs = 'class="art-svg"') => `<svg viewBox="-20 -26 40 36" ${attrs}><defs>${GDEFS}</defs>${card[k] ? card[k]() : ''}</svg>`;

  // reci u tekstu: lopov postaje Reks (uvek veliko slovo, jer je ime)
  const ROBBER = { words: { lopov: 'Reks', lopova: 'Reksa', lopovu: 'Reksu', lopovom: 'Reksom', lopove: 'Rekse' }, emoji: '🦖', name: true };

  return { RES, TERRAIN, BOARD, terrain, road, robber, piece, cardSVG, ROBBER };
})();
