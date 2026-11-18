// Izgled "Podvodni svet": morsko dno, alge, korali, meduze, skoljke, kristali, biseri. Sve je SVG.
/* exported SEA */
const SEA = (() => {
  const shade = (hex, f) => {
    const n = parseInt(hex.slice(1), 16);
    const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f));
    return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
  };
  const g = (x, y, s, body) => `<g transform="translate(${x} ${y}) scale(${s})">${body}</g>`;
  const shadow = (rx = 7, ry = 2.2) => `<ellipse cx="0" cy="0.8" rx="${rx}" ry="${ry}" fill="#00000030"/>`;

  // sirovine u ovom svetu
  const RES = {
    drvo: { name: 'Alge', ico: '🌿', color: '#2fa58a' },
    glina: { name: 'Korali', ico: '🪸', color: '#ef7d72' },
    vuna: { name: 'Meduze', ico: '🪼', color: '#9a7fdc' },
    zito: { name: 'Školjke', ico: '🐚', color: '#e6c27a' },
    kamen: { name: 'Kristali', ico: '💎', color: '#4fa9d6' },
  };
  const TERRAIN = {
    suma: { a: '#38b394', b: '#14604f' },
    gliniste: { a: '#f39a8a', b: '#a8434a' },
    pasnjak: { a: '#ab90e6', b: '#56399a' },
    polje: { a: '#f1dca6', b: '#bf9550' },
    planina: { a: '#69c0e0', b: '#22598a' },
    pustinja: { a: '#b9a77f', b: '#6c5c40' },
  };
  const BOARD = { ring1: '#06223f', ring2: '#123d5e', hexStroke: '#bff3ff', token: '#eefbff', tokenInk: '#0f2b45', hot: '#e0455a', side: -0.5 };

  function kelp(x, y, s = 1) {
    let b = shadow(5);
    for (const [dx, h, c] of [[-2.5, 15, '#2a9b7c'], [1.5, 18, '#3fc29a'], [4, 12, '#23826a']]) {
      b += `<path d="M${dx} 0 C${dx - 3} ${-h * 0.3} ${dx + 3} ${-h * 0.6} ${dx} ${-h}" stroke="${c}" stroke-width="1.8" fill="none" stroke-linecap="round"/>`;
      for (let i = 1; i < 4; i++) { const yy = -h * i / 4, side = i % 2 ? -1 : 1; b += `<ellipse cx="${dx + side * 2}" cy="${yy}" rx="2.3" ry="1" fill="${c}" transform="rotate(${side * -30} ${dx + side * 2} ${yy})"/>`; }
    }
    return g(x, y, s, b);
  }
  function coral(x, y, s = 1, c = '#ff8a78') {
    const d = shade(c, -0.25);
    let b = shadow(6);
    b += `<path d="M0 0 V-8 M0 -6 L-5 -11 M-5 -11 V-14 M-5 -11 L-8 -12 M0 -8 L4 -13 M4 -13 L3 -16 M4 -13 L7 -14" stroke="${d}" stroke-width="2.8" fill="none" stroke-linecap="round"/>`;
    b += `<path d="M0 0 V-8 M0 -6 L-5 -11 M-5 -11 V-14 M-5 -11 L-8 -12 M0 -8 L4 -13 M4 -13 L3 -16 M4 -13 L7 -14" stroke="${c}" stroke-width="1.6" fill="none" stroke-linecap="round"/>`;
    return g(x, y, s, b);
  }
  function jelly(x, y, s = 1) {
    let b = '';
    for (const dx of [-3, -1, 1, 3]) b += `<path d="M${dx} -8 q-1.2 3 0 5 t0 5" stroke="#d9c8ff" stroke-width=".8" fill="none" opacity=".85"/>`;
    b += '<path d="M-5.5 -8 Q-5.5 -15 0 -15 Q5.5 -15 5.5 -8 Q2.75 -7 0 -8 Q-2.75 -7 -5.5 -8 Z" fill="#c7b2ff" opacity=".9" stroke="#8d6fe0" stroke-width=".6"/><ellipse cx="-2" cy="-12.5" rx="1.4" ry=".8" fill="#fff" opacity=".7"/>';
    return g(x, y, s, b);
  }
  function scallop(x, y, s = 1, c = '#f6d9a2', line = '#c49a52') {
    let b = shadow(6);
    const pts = [];
    for (let i = 0; i <= 8; i++) { const a = Math.PI * (1.08 + i * 0.105); pts.push([Math.cos(a) * 8, -3 + Math.sin(a) * 9]); }
    b += `<path d="M0 0 L${pts.map((p) => p.map((v) => v.toFixed(1)).join(' ')).join(' L')} Z" fill="${c}" stroke="${line}" stroke-width=".7" stroke-linejoin="round"/>`;
    for (const p of pts.slice(1, -1)) b += `<line x1="0" y1="0" x2="${p[0].toFixed(1)}" y2="${p[1].toFixed(1)}" stroke="${line}" stroke-width=".5"/>`;
    b += `<path d="M-2.4 0 L2.4 0 L1.6 -1.6 L-1.6 -1.6 Z" fill="${line}"/>`;
    return g(x, y, s, b);
  }
  function crystal(x, y, s = 1) {
    let b = shadow(7);
    for (const [dx, h, w] of [[-4, 10, 2.6], [3.5, 8, 2.4], [0, 15, 3.2]]) {
      b += `<polygon points="${dx - w},0 ${dx - w},${-h} ${dx},${-h - w * 1.2} ${dx},0" fill="#a8ecff"/><polygon points="${dx},0 ${dx},${-h - w * 1.2} ${dx + w},${-h} ${dx + w},0" fill="#3a9fd0"/>`;
    }
    return g(x, y, s, b);
  }
  function bubbles(x, y, s = 1) {
    return g(x, y, s, '<circle cx="0" cy="0" r="1.6" fill="none" stroke="#e6fbff" stroke-width=".6" opacity=".8"/><circle cx="2" cy="-4" r="1.1" fill="none" stroke="#e6fbff" stroke-width=".5" opacity=".7"/><circle cx="0.6" cy="-7" r=".8" fill="none" stroke="#e6fbff" stroke-width=".5" opacity=".6"/>');
  }
  function anchor(x, y, s = 1) {
    return g(x, y, s, shadow(7) + '<g stroke="#4a3f33" stroke-width="2" fill="none" stroke-linecap="round"><path d="M0 -15 V0"/><path d="M-6 -4 Q0 4 6 -4"/><path d="M-3 -12 H3"/></g><circle cx="0" cy="-17" r="2" fill="none" stroke="#4a3f33" stroke-width="1.6"/>');
  }
  function rock(x, y, s = 1) {
    return g(x, y, s, shadow(6) + '<path d="M-6 0 Q-6 -6 0 -6 Q6 -6 6 0 Z" fill="#5e7a8c"/><path d="M0 -6 Q6 -6 6 0 H0 Z" fill="#455d6d"/>');
  }

  const SPOTS = [[-22, -24], [22, -24], [-36, 8], [36, 8], [0, -36]];
  function terrain(type, cx, cy, k = 1) {
    const at = (i, fn, s, ...a) => fn(cx + SPOTS[i][0] * Math.max(1, k * 0.95), cy + SPOTS[i][1], s, ...a);
    switch (type) {
      case 'suma': return at(0, kelp, 1.15) + at(1, kelp, 1.2) + at(2, kelp, 1) + at(3, kelp, 1.05) + at(4, bubbles, 1.3);
      case 'gliniste': return at(0, coral, 1.15) + at(1, coral, 1.1, '#ffb0a0') + at(2, coral, 1, '#ffb0a0') + at(3, coral, 1);
      case 'pasnjak': return at(0, jelly, 1.1) + at(1, jelly, 1.2) + at(3, jelly, 0.95) + at(2, bubbles, 1.2);
      case 'polje': return at(0, scallop, 1.15) + at(1, scallop, 1.1) + at(2, scallop, 1) + at(3, scallop, 1.05);
      case 'planina': return at(0, crystal, 1.15) + at(1, crystal, 1.2) + at(2, rock, 1) + at(3, crystal, 1);
      case 'pustinja': return anchor(cx - 6, cy + 10, 1.7) + rock(cx + 26, cy + 24, 1.3) + bubbles(cx + 20, cy - 20, 1.6) + bubbles(cx - 26, cy - 18, 1.2);
      default: return '';
    }
  }

  // put: niz bisera u boji igraca
  function road(r) {
    const n = 5, dx = r.x2 - r.x1, dy = r.y2 - r.y1;
    let under = `<line x1="${r.x1}" y1="${r.y1}" x2="${r.x2}" y2="${r.y2}" stroke="#061a2e" stroke-width="3"/>`, top = '';
    for (let i = 0; i < n; i++) {
      const f = 0.12 + i * (0.76 / (n - 1)), x = r.x1 + dx * f, y = r.y1 + dy * f;
      under += `<circle cx="${x}" cy="${y}" r="6.3" fill="#061a2e"/>`;
      top += `<circle cx="${x}" cy="${y}" r="5" fill="${r.col}"/><circle cx="${x + 1}" cy="${y + 1}" r="3.6" fill="${shade(r.col, -0.25)}" opacity=".6"/><circle cx="${x - 1.6}" cy="${y - 1.7}" r="1.5" fill="#fff" opacity=".85"/>`;
    }
    return { under, top };
  }

  // selo: skoljka; grad: velika spiralna skoljka sa biserom
  function piece(type, x, y, col) {
    const d = shade(col, -0.4), l = shade(col, 0.35);
    if (type === 'settlement') {
      return `<g transform="translate(${x} ${y + 9}) scale(1.35)">${scallop(0, 0, 1.25, col, '#061a2e')}<path d="M-6 -9 Q-3 -13 0 -14" stroke="${l}" stroke-width="1.2" fill="none" stroke-linecap="round"/></g>`;
    }
    // grad: veliki biser u boji igraca, u otvorenoj skoljci
    return `<g transform="translate(${x} ${y})">
      <ellipse cx="0" cy="16" rx="19" ry="4.5" fill="#00000045"/>
      <path d="M-19 4 Q-20 -14 0 -19 Q20 -14 19 4 Q10 -2 0 -2 Q-10 -2 -19 4 Z" fill="#e9e1d3" stroke="#061a2e" stroke-width="1.6"/>
      <path d="M-14 0 Q-12 -11 0 -14 M14 0 Q12 -11 0 -14 M-6 -2 Q-4 -10 0 -14 M6 -2 Q4 -10 0 -14" stroke="#bdb2a0" stroke-width=".9" fill="none"/>
      <path d="M-20 4 Q-10 18 0 17 Q10 18 20 4 Q10 9 0 9 Q-10 9 -20 4 Z" fill="#d8cfbe" stroke="#061a2e" stroke-width="1.6"/>
      <circle cx="0" cy="2" r="11.5" fill="${col}" stroke="#061a2e" stroke-width="1.8"/>
      <circle cx="2.5" cy="4.5" r="8.5" fill="${d}" opacity=".45"/>
      <circle cx="-3.5" cy="-2.5" r="4" fill="#fff" opacity=".7"/><circle cx="-4.5" cy="-3.5" r="1.8" fill="#fff"/>
      <circle cx="5" cy="8" r="2.5" fill="${l}" opacity=".5"/>
    </g>`;
  }

  // razbojnik: ajkula, iznad broja na polju (x, y dolaze kao kod obicnog razbojnika)
  function robber(x, y) {
    return `<g transform="translate(${x - 27} ${y - 24}) scale(1.45)">
      <defs><linearGradient id="shk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4f6f88"/><stop offset=".55" stop-color="#7f9db3"/><stop offset=".56" stop-color="#eef5f8"/><stop offset="1" stop-color="#d6e3ea"/></linearGradient></defs>
      <ellipse cx="0" cy="17" rx="17" ry="3" fill="#00000040"/>
      <path d="M-15 1 Q-21 -9 -25 -10 Q-23 -2 -24 7 Q-20 4 -15 3 Z" fill="#46637a" stroke="#14283a" stroke-width="1"/>
      <path d="M-2 -6 Q1 -17 7 -19 Q6 -12 8 -5 Z" fill="#46637a" stroke="#14283a" stroke-width="1"/>
      <path d="M-17 2 Q-8 -8 6 -7 Q17 -6 22 1 Q20 6 13 8 Q2 11 -8 8 Q-14 6 -17 2 Z" fill="url(#shk)" stroke="#14283a" stroke-width="1.1"/>
      <path d="M0 7 Q3 13 -2 15 Q-1 10 -4 8 Z" fill="#46637a" stroke="#14283a" stroke-width=".9"/>
      <path d="M8 -2 q-1 3 0 5 M10 -2.5 q-1 3 0 5 M12 -3 q-1 3 0 5" stroke="#2e4a60" stroke-width=".6" fill="none"/>
      <circle cx="15.5" cy="-2" r="1.6" fill="#0d1a24"/><circle cx="16" cy="-2.5" r=".55" fill="#fff"/>
      <path d="M13 4.2 Q17.5 5.6 21 2.2" stroke="#14283a" stroke-width=".8" fill="none"/>
      <path d="M14 4.6 l.8 1.2 l.7 -1.1 l.8 1.1 l.7 -1.2 l.7 1 l.6 -1.2" stroke="#fff" stroke-width=".6" fill="none"/>
      <path d="M-10 -3 Q0 -7.5 10 -5.5" stroke="#9fbdd1" stroke-width="1" fill="none" opacity=".7"/>
      <circle cx="24" cy="-6" r="1.4" fill="none" stroke="#e6fbff" stroke-width=".5"/><circle cx="26.5" cy="-10" r=".9" fill="none" stroke="#e6fbff" stroke-width=".45"/>
    </g>`;
  }

  const card = {
    drvo: () => kelp(-8, 6, 1.4) + kelp(6, 7, 1.6) + bubbles(13, -14, 1.3),
    glina: () => coral(-7, 7, 1.5) + coral(8, 7, 1.3, '#ffb0a0'),
    vuna: () => jelly(-6, 6, 1.4) + jelly(7, 3, 1.1),
    zito: () => scallop(-7, 6, 1.3) + scallop(7, 7, 1.5),
    kamen: () => crystal(0, 7, 1.7) + rock(-12, 8, .9),
    vitez: () => '<g stroke="#e9c35a" stroke-width="2.4" fill="none" stroke-linecap="round"><path d="M0 10 V-16"/><path d="M-8 -18 V-10 Q0 -4 8 -10 V-18"/><path d="M0 -24 V-16"/></g><path d="M-9 -18 l1 -4 l1 4 Z M7 -18 l1 -4 l1 4 Z M-1 -24 l1 -3 l1 3 Z" fill="#e9c35a"/>',
    bod: () => '<path d="M-12 2 L-12 -12 L-6 -6 L0 -16 L6 -6 L12 -12 L12 2 Z" fill="#f2c94c" stroke="#a87b16" stroke-width="1"/><circle cx="0" cy="-3" r="3" fill="#fbf6ee"/><text x="0" y="10" text-anchor="middle" font-size="7" font-weight="900" fill="#f2c94c">+1</text>',
    putevi: () => [-12, -6, 0, 6, 12].map((x, i) => `<circle cx="${x}" cy="${-4 + (i % 2 ? -3 : 3)}" r="4" fill="#cfe9f5" stroke="#4fa9d6" stroke-width="1"/><circle cx="${x - 1.2}" cy="${-5.2 + (i % 2 ? -3 : 3)}" r="1.2" fill="#fff"/>`).join(''),
    obilje: () => '<rect x="-12" y="-6" width="24" height="14" rx="2" fill="#8a5a30" stroke="#4a2f16" stroke-width="1"/><path d="M-12 -6 Q0 -18 12 -6 Z" fill="#a8703c" stroke="#4a2f16" stroke-width="1"/><rect x="-2" y="-4" width="4" height="5" fill="#e9c35a"/>'
      + '<circle cx="-6" cy="-9" r="2.4" fill="#fbf6ee"/><circle cx="5" cy="-10" r="2" fill="#a8ecff"/><circle cx="0" cy="-12" r="2.2" fill="#f2c94c"/>',
    monopol: () => '<path d="M0 -2 m0 -12 a12 12 0 1 1 -11 7 a8.5 8.5 0 1 1 8 -6 a5.5 5.5 0 1 1 -5 4 a3 3 0 1 1 3 -3" fill="none" stroke="#bff3ff" stroke-width="2.2" stroke-linecap="round"/>',
  };
  const cardSVG = (k, attrs = 'class="art-svg"') => `<svg viewBox="-20 -26 40 36" ${attrs}>${card[k] ? card[k]() : ''}</svg>`;

  return { RES, TERRAIN, BOARD, terrain, road, robber, piece, cardSVG };
})();
