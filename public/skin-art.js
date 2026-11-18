// Crtezi za izgled "Kucice": 3D polja, putevi, razbojnik i karte. Sve je SVG, bez slika.
/* exported ART */
const ART = (() => {
  const shade = (hex, f) => {
    const n = parseInt(hex.slice(1), 16);
    const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f));
    return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
  };
  const P = (pts) => pts.map((p) => p.join(',')).join(' ');
  const g = (x, y, s, body) => `<g transform="translate(${x} ${y}) scale(${s})">${body}</g>`;
  const shadow = (rx = 7, ry = 2.4) => `<ellipse cx="0" cy="0.8" rx="${rx}" ry="${ry}" fill="#0000002e"/>`;

  // drvo: tri sloja kupe, leva strana svetlija
  function tree(x, y, s = 1, light = '#5fb85a', dark = '#2f7a35') {
    let b = shadow(7) + '<rect x="-1.5" y="-5" width="3" height="5.5" fill="#6b4226"/>';
    for (const [yb, w, hg] of [[-3, 8, 9], [-8, 6.6, 8], [-12.5, 5, 7]]) {
      b += `<polygon points="${P([[-w, yb], [0, yb - hg], [0, yb + 1.6]])}" fill="${light}"/><polygon points="${P([[0, yb + 1.6], [0, yb - hg], [w, yb]])}" fill="${dark}"/>`;
    }
    return g(x, y, s, b);
  }
  function sheep(x, y, s = 1) {
    let b = shadow(8, 2.2);
    for (const lx of [-4, -1.5, 2.5, 5]) b += `<rect x="${lx - 0.8}" y="-3" width="1.6" height="3.4" rx=".6" fill="#3a3530"/>`;
    for (const [cx, cy, r] of [[-3.5, -6, 3.8], [0.5, -7.5, 4.2], [4.5, -6, 3.8], [-1.5, -4, 3.6], [2.5, -4, 3.6]]) b += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#fbfaf4" stroke="#c9c4b4" stroke-width=".7"/>`;
    b += '<ellipse cx="-7.2" cy="-6.6" rx="2.6" ry="3.1" fill="#3a3530"/><ellipse cx="-8.6" cy="-8.6" rx="1.3" ry=".8" fill="#3a3530" transform="rotate(-30 -8.6 -8.6)"/><circle cx="-7.9" cy="-7" r=".55" fill="#fff"/>';
    return g(x, y, s, b);
  }
  function wheat(x, y, s = 1) {
    let b = shadow(6, 2);
    for (const [dx, tilt] of [[-3, -2], [0, 0.5], [3, 2.5]]) {
      b += `<line x1="${dx}" y1="0" x2="${dx + tilt}" y2="-13" stroke="#9a8a2a" stroke-width="1"/>`;
      for (let i = 0; i < 5; i++) {
        const t = 0.55 + i * 0.1, cx = dx + tilt * t, cy = -13 * t;
        b += `<ellipse cx="${cx - 1.2}" cy="${cy}" rx="1.1" ry="1.9" fill="#f0c24a" stroke="#b5821a" stroke-width=".4" transform="rotate(-25 ${cx - 1.2} ${cy})"/><ellipse cx="${cx + 1.2}" cy="${cy}" rx="1.1" ry="1.9" fill="#e2ad2f" stroke="#b5821a" stroke-width=".4" transform="rotate(25 ${cx + 1.2} ${cy})"/>`;
      }
      b += `<ellipse cx="${dx + tilt}" cy="-14" rx="1" ry="1.8" fill="#f0c24a" stroke="#b5821a" stroke-width=".4"/>`;
    }
    return g(x, y, s, b);
  }
  // naslagane cigle (izometrijska kocka sa linijama)
  function bricks(x, y, s = 1) {
    let b = shadow(9, 2.6);
    b += `<polygon points="${P([[0, -10], [8, -6], [0, -2], [-8, -6]])}" fill="#e8946a"/>`;
    b += `<polygon points="${P([[-8, -6], [0, -2], [0, 4], [-8, 0]])}" fill="#c4643a"/>`;
    b += `<polygon points="${P([[0, -2], [8, -6], [8, 0], [0, 4]])}" fill="#93441f"/>`;
    for (const k of [0.33, 0.66]) b += `<line x1="-8" y1="${-6 + 6 * k}" x2="0" y2="${-2 + 6 * k}" stroke="#f3c2a3" stroke-width=".6"/><line x1="0" y1="${-2 + 6 * k}" x2="8" y2="${-6 + 6 * k}" stroke="#d27b52" stroke-width=".6"/>`;
    b += `<line x1="-4" y1="-4" x2="-4" y2="-2" stroke="#f3c2a3" stroke-width=".6"/><line x1="-6" y1="-1" x2="-6" y2="1" stroke="#f3c2a3" stroke-width=".6"/><line x1="-2" y1="0" x2="-2" y2="2" stroke="#f3c2a3" stroke-width=".6"/>`;
    b += `<line x1="4" y1="-4" x2="4" y2="-2" stroke="#d27b52" stroke-width=".6"/><line x1="6" y1="-3" x2="6" y2="-1" stroke="#d27b52" stroke-width=".6"/><line x1="2" y1="-0" x2="2" y2="2" stroke="#d27b52" stroke-width=".6"/>`;
    b += `<polygon points="${P([[-8, -6], [0, -10], [8, -6], [0, -2]])}" fill="none" stroke="#7a3518" stroke-width=".5"/>`;
    return g(x, y, s, b);
  }
  function mountain(x, y, s = 1) {
    let b = shadow(11, 2.6);
    b += `<polygon points="${P([[-11, 0], [0, -16], [1.5, 1.5]])}" fill="#c9ced6"/><polygon points="${P([[1.5, 1.5], [0, -16], [10, 0]])}" fill="#7d838e"/>`;
    b += `<polygon points="${P([[-3.3, -11.2], [0, -16], [2.6, -12.2], [0.6, -11], [-1.2, -12.4]])}" fill="#fff"/>`;
    return g(x, y, s, b);
  }
  function rock(x, y, s = 1) {
    return g(x, y, s, shadow(6, 2) + `<polygon points="${P([[-6, 0], [-4, -5], [1, -7], [1, 1]])}" fill="#b9bec7"/><polygon points="${P([[1, 1], [1, -7], [5, -4], [6, 0]])}" fill="#7d838e"/>`);
  }
  function cactus(x, y, s = 1) {
    const b = shadow(5, 1.8) + '<rect x="-2" y="-14" width="4" height="14.5" rx="2" fill="#4f9a46"/><rect x="0" y="-14" width="2" height="14.5" rx="1" fill="#3a7a35"/>'
      + '<path d="M-2 -6 h-3 a1.5 1.5 0 0 1 -1.5 -1.5 v-4" stroke="#4f9a46" stroke-width="2.6" fill="none" stroke-linecap="round"/><path d="M2 -8 h2.6 a1.5 1.5 0 0 0 1.5 -1.5 v-3" stroke="#3a7a35" stroke-width="2.6" fill="none" stroke-linecap="round"/>';
    return g(x, y, s, b);
  }
  function dune(x, y, s = 1) {
    return g(x, y, s, '<path d="M-12 0 Q-4 -7 3 -2 Q7 -5 12 0 Z" fill="#e3cb8a"/><path d="M-4 -3.6 Q0 -4.6 3 -2 Q7 -5 12 0 H4 Z" fill="#d0b06a"/>');
  }
  function bush(x, y, s = 1) {
    return g(x, y, s, '<circle cx="-2.2" cy="-2" r="2.6" fill="#6aae4f"/><circle cx="1.8" cy="-2.6" r="2.8" fill="#4f8f3c"/>');
  }

  // raspored ukrasa na polju (oko broja u sredini)
  const SPOTS = [[-21, -24], [2, -35], [23, -22], [-37, 6], [37, 6], [-31, 31], [31, 31]];
  function terrain(type, cx, cy, k = 1) {
    const at = (i, fn, s) => fn(cx + SPOTS[i][0] * Math.max(1, k * 0.95), cy + SPOTS[i][1], s);
    const pick = (fn, s, idx = [0, 1, 2, 3, 4, 5, 6]) => idx.map((i) => at(i, fn, s)).join('');
    switch (type) {
      case 'suma': return pick(tree, 1.25, [0, 1, 2, 3, 4]) + at(5, tree, 1.05) + at(6, tree, 1.1);
      case 'pasnjak': return at(0, bush, 1.4) + at(1, sheep, 1.25) + at(2, bush, 1.3) + at(3, sheep, 1.1) + at(4, bush, 1.4) + at(5, bush, 1.2) + at(6, sheep, 1.05);
      case 'polje': return pick(wheat, 1.25);
      case 'gliniste': return at(0, bricks, 1.25) + at(1, bricks, 1.1) + at(2, bricks, 1.25) + at(3, rock, 1) + at(4, bricks, 1.1) + at(5, rock, .9) + at(6, rock, 1);
      case 'planina': return at(0, mountain, 1.35) + at(1, mountain, 1.5) + at(2, mountain, 1.3) + at(3, rock, 1.2) + at(4, mountain, 1.1) + at(5, rock, 1) + at(6, rock, 1.1);
      case 'pustinja': return dune(cx - 24, cy + 30, 1.6) + dune(cx + 26, cy - 22, 1.4) + cactus(cx - 6, cy + 4, 2) + cactus(cx + 24, cy + 26, 1.2) + rock(cx - 26, cy - 14, 1) + dune(cx + 4, cy + 44, 1.1);
      default: return '';
    }
  }

  // 3D polje: tamna ivica ispod, pa gornja strana
  function tile(points, pointsShift, top, side) {
    return { side: `<polygon points="${pointsShift}" fill="${side}" stroke="${side}" stroke-width="2" stroke-linejoin="round"/>`, top: `<polygon points="${points}" fill="${top}" stroke="#fff6dc" stroke-width="2.5" stroke-linejoin="round"/>` };
  }

  // 3D put: daska sa bocnom stranom i odsjajem
  function road(r) {
    const dx = r.x2 - r.x1, dy = r.y2 - r.y1;
    const sh = (f) => [r.x1 + dx * f, r.y1 + dy * f, r.x1 + dx * (1 - f), r.y1 + dy * (1 - f)];
    const ln = (c, w, oy, f = 0, extra = '') => { const [a, b, c2, d] = sh(f); return `<line x1="${a}" y1="${b + oy}" x2="${c2}" y2="${d + oy}" stroke="${c}" stroke-width="${w}" stroke-linecap="round" ${extra}/>`; };
    return {
      under: ln('#00000040', 12, 6) + ln('#1b1712', 13, 1.5),
      top: ln(shade(r.col, -0.4), 8.5, 3) + ln(r.col, 8.5, 0) + ln(shade(r.col, 0.45), 2.2, -2, 0.12, 'opacity=".9"')
        + [0.3, 0.5, 0.7].map((f) => { const x = r.x1 + dx * f, y = r.y1 + dy * f, l = Math.hypot(dx, dy), nx = -dy / l * 4, ny = dx / l * 4; return `<line x1="${x - nx}" y1="${y - ny}" x2="${x + nx}" y2="${y + ny}" stroke="${shade(r.col, -0.3)}" stroke-width="1"/>`; }).join(''),
    };
  }

  // razbojnik: covek sa kapuljacom na okruglom postolju
  function robber(x, y) {
    return `<g transform="translate(${x} ${y})">
      <ellipse cx="0" cy="22" rx="15" ry="5" fill="#00000055"/>
      <path d="M-13 15 v4 a13 4.5 0 0 0 26 0 v-4 Z" fill="#3b2c22"/><ellipse cx="0" cy="15" rx="13" ry="4.5" fill="#6b5240"/>
      <path d="M-10 15 Q-12 0 -5 -6 L0 -7 L0 17 Q-6 17 -10 15 Z" fill="#4a4458"/>
      <path d="M0 -7 L5 -6 Q12 0 10 15 Q6 17 0 17 Z" fill="#2c2836"/>
      <path d="M-3 -5 Q0 8 3 -5" fill="none" stroke="#1a1720" stroke-width="1.2"/>
      <path d="M-8 -9 Q-9 -22 0 -24 Q9 -22 8 -9 Q4 -5 0 -5 Q-4 -5 -8 -9 Z" fill="#3d3749"/>
      <path d="M0 -24 Q9 -22 8 -9 Q4 -5 0 -5 Z" fill="#2a2533"/>
      <ellipse cx="0" cy="-12.5" rx="5" ry="4.6" fill="#120f16"/>
      <circle cx="-2" cy="-12.5" r="1.2" fill="#ffd34a"/><circle cx="2" cy="-12.5" r="1.2" fill="#ffd34a"/>
      <path d="M6 2 L14 -4" stroke="#8a6a4a" stroke-width="2" stroke-linecap="round"/><circle cx="14.5" cy="-4.5" r="3.4" fill="#b98a55" stroke="#6b4c2c" stroke-width=".8"/>
    </g>`;
  }

  // slike za karte (viewBox -20 -26 40 34)
  const card = {
    drvo: () => tree(-9, 4, 1.3, '#6cc466', '#2f7a35') + tree(8, 6, 1.5, '#6cc466', '#2f7a35') + tree(0, -4, 1, '#6cc466', '#2f7a35'),
    glina: () => bricks(-7, 5, 1.2) + bricks(7, 5, 1.2) + bricks(0, -2, 1.2),
    vuna: () => sheep(1, 4, 2),
    zito: () => wheat(-7, 5, 1.6) + wheat(7, 5, 1.6) + wheat(0, 3, 1.8),
    kamen: () => mountain(-2, 5, 1.6) + rock(10, 6, 1.1) + rock(-12, 7, .9),
    vitez: () => `<path d="M-10 -20 L11 6" stroke="#d9dee6" stroke-width="3" stroke-linecap="round"/><path d="M-8 -12 L-2 -18" stroke="#8a5a3c" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M2 -16 L14 -12 Q14 0 4 6 Q-6 0 -6 -12 Z" fill="#c0392b" stroke="#7a1f16" stroke-width="1"/><path d="M4 -16 L14 -12 Q14 0 4 6 Z" fill="#9a2a1f"/>
      <path d="M4 -13 V2 M-1 -7 H9" stroke="#f3d672" stroke-width="2.2"/>`,
    bod: () => `<polygon points="0,-22 5,-11 17,-10 8,-2 11,10 0,4 -11,10 -8,-2 -17,-10 -5,-11" fill="#f6c945" stroke="#b5821a" stroke-width="1"/><polygon points="0,-22 5,-11 17,-10 8,-2 11,10 0,4" fill="#e3a92a"/><text x="0" y="1" text-anchor="middle" font-size="9" font-weight="900" fill="#7a5410">+1</text>`,
    putevi: () => `<polygon points="-16,-2 0,-10 4,-8 -12,0" fill="#c98b4f" stroke="#6b4226" stroke-width=".8"/><polygon points="-12,0 4,-8 4,-6 -12,2" fill="#8a5a30"/>
      <polygon points="-4,4 12,-4 16,-2 0,6" fill="#c98b4f" stroke="#6b4226" stroke-width=".8"/><polygon points="0,6 16,-2 16,0 0,8" fill="#8a5a30"/>
      <path d="M2 -12 L12 -22" stroke="#8a5a3c" stroke-width="2.4" stroke-linecap="round"/><rect x="7" y="-25" width="10" height="5" rx="1" fill="#7d838e" transform="rotate(-45 12 -22)"/>`,
    obilje: () => `<path d="M-14 -2 Q-12 10 0 10 Q12 10 14 -2 Z" fill="#c98b4f" stroke="#6b4226" stroke-width="1"/><path d="M-14 -2 H14" stroke="#6b4226" stroke-width="1.6"/>`
      + wheat(-6, -2, 1) + tree(6, -2, .9) + `<circle cx="-1" cy="-5" r="3" fill="#fbfaf4" stroke="#c9c4b4" stroke-width=".6"/><path d="M-10 4 Q0 7 10 4" stroke="#8a5a30" stroke-width=".8" fill="none"/>`,
    monopol: () => [[-8, 6], [-8, 2], [-8, -2], [6, 6], [6, 2], [6, -2], [6, -6], [-1, 8], [-1, 4]].map(([x, y]) => `<ellipse cx="${x}" cy="${y + 1.5}" rx="6" ry="2.6" fill="#b5821a"/><ellipse cx="${x}" cy="${y}" rx="6" ry="2.6" fill="#f6c945" stroke="#b5821a" stroke-width=".6"/>`).join('')
      + '<text x="-1" y="5.6" text-anchor="middle" font-size="4" font-weight="900" fill="#7a5410">$</text>',
  };
  const cardSVG = (k, attrs = 'class="art-svg"') => `<svg viewBox="-20 -26 40 36" ${attrs}>${card[k] ? card[k]() : ''}</svg>`;

  return { shade, terrain, tile, road, robber, cardSVG };
})();
