// Izgled "Podvodni svet 3D": isti svet kao Podvodni svet (alge, korali, meduze, skoljke, kristali,
// kucice, zamak u vodi i Kraba), ali sve je trodimenzionalno: senke, sjaj, debela polja. Sve je SVG.
/* exported SEA3 */
const SEA3 = (() => {
  const shade = (hex, f) => {
    const n = parseInt(hex.slice(1), 16);
    const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f));
    return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
  };
  const g = (x, y, s, body) => `<g transform="translate(${x} ${y}) scale(${s})">${body}</g>`;
  const shadow = (rx = 7, ry = 2.2) => `<ellipse cx="1.2" cy="1" rx="${rx}" ry="${ry}" fill="#00203a55"/>`;
  // zajednicki prelivi za "3D" senku: valjak (s leva na desno) i lopta (svetlo gore levo)
  const DEFS = `<defs>
    <linearGradient id="d3cyl" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity=".38"/><stop offset=".3" stop-color="#fff" stop-opacity=".0"/><stop offset=".42" stop-color="#fff" stop-opacity=".38"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".45"/></linearGradient>
    <radialGradient id="d3sph" cx=".35" cy=".3" r=".75"><stop offset="0" stop-color="#fff" stop-opacity=".75"/><stop offset=".25" stop-color="#fff" stop-opacity=".15"/><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".45"/></radialGradient>
    <linearGradient id="d3top" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset="1" stop-color="#000" stop-opacity=".25"/></linearGradient>
  </defs>`;
  const CYL = 'url(#d3cyl)', SPH = 'url(#d3sph)';

  // sirovine: ista imena kao u Podvodnom svetu, boje karata kao u obicnoj igri
  const RES = {
    drvo: { name: 'Alge', ico: '🌿' },
    glina: { name: 'Korali', ico: '🪸' },
    vuna: { name: 'Meduza', ico: '🪼' },
    zito: { name: 'Školjke', ico: '🐚' },
    kamen: { name: 'Kristal', ico: '💎' },
  };
  // svetlija, tirkizna laguna da se razlikuje od tamnog Podvodnog sveta
  const TERRAIN = {
    suma: { a: '#4fd1a5', b: '#11745a' },
    gliniste: { a: '#ffb3a1', b: '#c44f55' },
    pasnjak: { a: '#c7b2ff', b: '#6a4bc0' },
    polje: { a: '#fbe7b5', b: '#d3a45a' },
    planina: { a: '#8fdcf5', b: '#2b72a8' },
    pustinja: { a: '#f0dfb0', b: '#b69a62' },
  };
  const BOARD = { ring1: '#0e5d84', ring2: '#2a9cc0', hexStroke: '#e9fdff', token: '#fbfeff', tokenInk: '#0f2b45', hot: '#e0455a', side: -0.55, depth: 15, defs: DEFS };

  function kelp(x, y, s = 1) {
    let b = shadow(6, 2);
    for (const [dx, h, c, flip] of [[-3.5, 17, '#1fa37a', 1], [3.5, 15, '#16825f', -1], [0, 21, '#33c493', 1]]) {
      const d = `M${dx - 1.6} 0 C${dx - 1.6 - 4 * flip} ${-h * 0.35} ${dx + 4 * flip} ${-h * 0.65} ${dx} ${-h} C${dx + 5 * flip} ${-h * 0.62} ${dx - 2 * flip} ${-h * 0.32} ${dx + 1.6} 0 Z`;
      b += `<path d="${d}" fill="${c}" stroke="${shade(c, -0.45)}" stroke-width=".6"/><path d="${d}" fill="${CYL}"/>`;
    }
    b += '<circle cx="5" cy="-17" r="1.3" fill="#e6fbff" opacity=".5"/><circle cx="5" cy="-17" r="1.3" fill="url(#d3sph)"/>';
    return g(x, y, s, b);
  }
  function coral(x, y, s = 1, c = '#ff7f6e') {
    const br = 'M0 0 V-8 M0 -6 L-5 -11 M-5 -11 V-14 M-5 -11 L-8 -12 M0 -8 L4 -13 M4 -13 L3 -16 M4 -13 L7 -14';
    let b = shadow(7, 2.2);
    b += `<path d="${br}" stroke="${shade(c, -0.45)}" stroke-width="3.6" fill="none" stroke-linecap="round"/>`;
    b += `<path d="${br}" stroke="${c}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
    b += `<path d="${br}" stroke="#fff" stroke-opacity=".45" stroke-width=".8" fill="none" stroke-linecap="round" transform="translate(-.6 -.2)"/>`;
    for (const [cx, cy] of [[-5, -14], [-8, -12], [3, -16], [7, -14]]) b += `<circle cx="${cx}" cy="${cy}" r="1.7" fill="${shade(c, 0.25)}"/><circle cx="${cx}" cy="${cy}" r="1.7" fill="${SPH}"/>`;
    return g(x, y, s, b);
  }
  function jelly(x, y, s = 1) {
    let b = '<ellipse cx="1" cy="1" rx="5" ry="1.6" fill="#00203a40"/>';
    for (const dx of [-3.2, -1, 1.2, 3.4]) b += `<path d="M${dx} -8 q-1.5 3 0 5 t0 5" stroke="#cdb8ff" stroke-width="1" fill="none" opacity=".9"/>`;
    const dome = 'M-6 -8 Q-6 -16.5 0 -16.5 Q6 -16.5 6 -8 Q3 -6.8 0 -8 Q-3 -6.8 -6 -8 Z';
    b += `<path d="${dome}" fill="#b89cff" opacity=".92" stroke="#6d4fd0" stroke-width=".6"/><path d="${dome}" fill="${SPH}"/>`;
    b += '<path d="M-4 -8.6 Q0 -6.8 4 -8.6" stroke="#ede4ff" stroke-width=".6" fill="none"/>';
    return g(x, y, s, b);
  }
  function scallop(x, y, s = 1, c = '#f6d9a2') {
    let b = shadow(7, 2.2);
    const pts = [];
    for (let i = 0; i <= 8; i++) { const a = Math.PI * (1.08 + i * 0.105); pts.push([Math.cos(a) * 8, -3 + Math.sin(a) * 9]); }
    for (let i = 0; i < 8; i++) {
      const p1 = pts[i], p2 = pts[i + 1];
      b += `<path d="M0 0 L${p1[0].toFixed(1)} ${p1[1].toFixed(1)} L${p2[0].toFixed(1)} ${p2[1].toFixed(1)} Z" fill="${i % 2 ? shade(c, -0.18) : shade(c, 0.15)}" stroke="${shade(c, -0.4)}" stroke-width=".45"/>`;
    }
    b += `<path d="M0 0 L${pts.map((p) => p.map((v) => v.toFixed(1)).join(' ')).join(' L')} Z" fill="${SPH}"/>`;
    b += `<path d="M-2.6 0 L2.6 0 L1.7 -1.8 L-1.7 -1.8 Z" fill="${shade(c, -0.4)}"/>`;
    return g(x, y, s, b);
  }
  function crystal(x, y, s = 1) {
    let b = shadow(8, 2.4);
    for (const [dx, h, w] of [[-4.5, 10, 2.6], [4, 8, 2.4], [0, 15, 3.3]]) {
      b += `<polygon points="${dx - w},0 ${dx - w},${-h} ${dx},${-h + w * 0.5} ${dx},${w * 0.5}" fill="#9fe7ff"/>`;
      b += `<polygon points="${dx},${w * 0.5} ${dx},${-h + w * 0.5} ${dx + w},${-h} ${dx + w},0" fill="#2f8fc4"/>`;
      b += `<polygon points="${dx - w},${-h} ${dx},${-h - w * 1.6} ${dx},${-h + w * 0.5}" fill="#e2f9ff"/>`;
      b += `<polygon points="${dx},${-h + w * 0.5} ${dx},${-h - w * 1.6} ${dx + w},${-h}" fill="#5fb6e3"/>`;
      b += `<line x1="${dx - w * 0.55}" y1="${-h * 0.2}" x2="${dx - w * 0.55}" y2="${-h * 0.8}" stroke="#fff" stroke-opacity=".7" stroke-width=".6"/>`;
    }
    return g(x, y, s, b);
  }
  function rock(x, y, s = 1, c = '#6f8c9e') {
    return g(x, y, s, shadow(6.5, 2) + `<path d="M-6 0 Q-6 -6.5 0 -6.5 Q6 -6.5 6 0 Z" fill="${c}"/><path d="M-6 0 Q-6 -6.5 0 -6.5 Q6 -6.5 6 0 Z" fill="${SPH}"/>`);
  }
  function bubbles(x, y, s = 1) {
    const bub = (cx, cy, r) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#dff8ff" fill-opacity=".25" stroke="#f2fdff" stroke-width=".5"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="${SPH}"/>`;
    return g(x, y, s, bub(0, 0, 1.8) + bub(2.2, -4.2, 1.25) + bub(0.6, -7.4, 0.9));
  }
  function starfish(x, y, s = 1) {
    let pts = '';
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 2.4 : 6; pts += `${(Math.cos(a) * r).toFixed(1)},${(Math.sin(a) * r * 0.6).toFixed(1)} `; }
    return g(x, y, s, `<ellipse cx="1" cy="1.5" rx="6" ry="2.4" fill="#00203a40"/><polygon points="${pts}" fill="#ff9a4a" stroke="#b5561a" stroke-width=".6"/><polygon points="${pts}" fill="${SPH}"/>`);
  }
  function anchor(x, y, s = 1) {
    return g(x, y, s, shadow(8) + '<g stroke="#3a3128" stroke-width="2.8" fill="none" stroke-linecap="round"><path d="M0 -15 V0"/><path d="M-6 -4 Q0 4 6 -4"/><path d="M-3 -12 H3"/></g><g stroke="#7a6a58" stroke-width="1.2" fill="none" stroke-linecap="round"><path d="M-.6 -15 V-1"/><path d="M-6 -4.6 Q0 3 6 -4.6"/></g><circle cx="0" cy="-17" r="2" fill="none" stroke="#3a3128" stroke-width="1.8"/>');
  }

  const SPOTS = [[-22, -24], [22, -24], [-36, 8], [36, 8], [0, -36]];
  function terrain(type, cx, cy, k = 1) {
    const at = (i, fn, s, ...a) => fn(cx + SPOTS[i][0] * Math.max(1, k * 0.95), cy + SPOTS[i][1], s, ...a);
    switch (type) {
      case 'suma': return at(0, kelp, 1.15) + at(1, kelp, 1.2) + at(2, kelp, 1) + at(3, kelp, 1.05) + at(4, bubbles, 1.3);
      case 'gliniste': return at(0, coral, 1.15) + at(1, coral, 1.1, '#ffa48f') + at(2, coral, 1, '#ffa48f') + at(3, coral, 1);
      case 'pasnjak': return at(0, jelly, 1.15) + at(1, jelly, 1.25) + at(3, jelly, 1) + at(2, bubbles, 1.2);
      case 'polje': return at(0, scallop, 1.15) + at(1, scallop, 1.1) + at(2, scallop, 1) + at(3, scallop, 1.05);
      case 'planina': return at(0, crystal, 1.15) + at(1, crystal, 1.2) + at(2, rock, 1) + at(3, crystal, 1);
      case 'pustinja': return anchor(cx - 6, cy + 10, 1.7) + starfish(cx + 24, cy + 24, 1.4) + rock(cx - 28, cy + 24, 1.2, '#9a8a6a') + bubbles(cx + 20, cy - 20, 1.6);
      default: return '';
    }
  }

  // put: niz 3D bisera u boji igraca
  function road(r) {
    const n = 5, dx = r.x2 - r.x1, dy = r.y2 - r.y1;
    let under = `<line x1="${r.x1}" y1="${r.y1 + 3}" x2="${r.x2}" y2="${r.y2 + 3}" stroke="#00203a55" stroke-width="7" stroke-linecap="round"/><line x1="${r.x1}" y1="${r.y1}" x2="${r.x2}" y2="${r.y2}" stroke="#0a2a40" stroke-width="2.5"/>`, top = '';
    for (let i = 0; i < n; i++) {
      const f = 0.12 + i * (0.76 / (n - 1)), x = r.x1 + dx * f, y = r.y1 + dy * f;
      under += `<circle cx="${x}" cy="${y}" r="6.6" fill="#0a2a40"/>`;
      top += `<circle cx="${x}" cy="${y}" r="5.4" fill="${r.col}"/><circle cx="${x}" cy="${y}" r="5.4" fill="${SPH}"/>`;
    }
    return { under, top };
  }

  // valjak sa kupolom ili kupom: telo u boji igraca + senka preko
  const cylBody = (x, y, w, h, col, ol) => {
    const rx = w / 2, ry = w / 5.5;
    const d = `M${x - rx} ${y} V${y - h} A${rx} ${ry} 0 0 0 ${x + rx} ${y - h} V${y} A${rx} ${ry} 0 0 1 ${x - rx} ${y} Z`;
    return `<path d="${d}" fill="${col}" ${ol}/><path d="${d}" fill="${CYL}"/><ellipse cx="${x}" cy="${y - h}" rx="${rx}" ry="${ry}" fill="${shade(col, 0.25)}" ${ol}/>`;
  };
  function piece(type, x, y, col) {
    const d = shade(col, -0.35), l = shade(col, 0.4), ol = 'stroke="#082033" stroke-width="1.2" stroke-linejoin="round"';
    if (type === 'settlement') {
      // mala podvodna kucica: okrugla, sa kupolom i okruglim prozorom
      const dome = 'M-10.5 -2 A10.5 11 0 0 1 10.5 -2 A10.5 2.6 0 0 1 -10.5 -2 Z';
      return `<g class="piece" transform="translate(${x} ${y}) scale(1.45)">${DEFS}
      <ellipse cx="2" cy="11" rx="13" ry="3.4" fill="#00203a55"/>
      ${cylBody(0, 10, 19, 12, col, ol)}
      <path d="${dome}" fill="${d}" ${ol}/><path d="${dome}" fill="${SPH}"/>
      <path d="M0 -13 V-2.5 M-6 -10 Q-5 -6 -4.6 -2.4 M6 -10 Q5 -6 4.6 -2.4" stroke="${l}" stroke-width=".9" fill="none" opacity=".75"/>
      <path d="M-6.5 11.6 V5.5 Q-4.2 2.6 -1.9 5.5 V12.3 Z" fill="#3a2a1a" ${ol}/>
      <circle cx="4.6" cy="4.6" r="3" fill="#bff3ff" stroke="#082033" stroke-width="1.1"/><circle cx="4.6" cy="4.6" r="3" fill="${SPH}"/>
      <circle cx="10" cy="-14" r="1.5" fill="#dff8ff" fill-opacity=".3" stroke="#f2fdff" stroke-width=".5"/><circle cx="12" cy="-18.5" r="1" fill="#dff8ff" fill-opacity=".3" stroke="#f2fdff" stroke-width=".4"/>
    </g>`;
    }
    // zamak u vodi: dve okrugle kule sa krovovima, glavna kula sa zupcima, kapija i zastava
    const cone = (cx, cy, w) => `<path d="M${cx - w / 2 - 1.5} ${cy} L${cx} ${cy - 11} L${cx + w / 2 + 1.5} ${cy} A${w / 2 + 1.5} ${w / 5} 0 0 1 ${cx - w / 2 - 1.5} ${cy} Z" fill="${d}" ${ol}/><path d="M${cx - w / 2 - 1.5} ${cy} L${cx} ${cy - 11} L${cx + w / 2 + 1.5} ${cy} Z" fill="${CYL}"/>`;
    let crenel = '';
    for (let i = 0; i < 4; i++) crenel += `<rect x="${-11 + i * 6.3}" y="-24" width="3.6" height="4" fill="${l}" ${ol}/>`;
    return `<g class="piece" transform="translate(${x} ${y}) scale(1.12)">${DEFS}
      <ellipse cx="2" cy="15" rx="26" ry="6" fill="#00203a50"/>
      ${cylBody(-15, 13, 10, 20, col, ol)}${cone(-15, -7, 10)}
      ${cylBody(15, 13, 10, 20, col, ol)}${cone(15, -7, 10)}
      <path d="M-11 14 V-20 H11 V14 Z" fill="${col}" ${ol}/><path d="M-11 14 V-20 H11 V14 Z" fill="${CYL}"/>
      <path d="M-11 -20 L-8 -23 H14 L11 -20 Z" fill="${l}" ${ol}/>${crenel}
      <path d="M-4 14 V6 Q0 1 4 6 V14 Z" fill="#2a1d12" ${ol}/>
      <rect x="-1.3" y="-14" width="2.6" height="5.5" rx="1.2" fill="#2a1d12"/><rect x="-16.2" y="-1" width="2.4" height="4.5" rx="1.1" fill="#2a1d12"/><rect x="13.8" y="-1" width="2.4" height="4.5" rx="1.1" fill="#2a1d12"/>
      <path d="M1 -24 V-35" stroke="#3a2a1a" stroke-width="1.4"/><path d="M1 -35 Q6 -34 10 -32 Q6 -30 1 -30 Z" fill="${l}" stroke="#082033" stroke-width=".8"/>
      <path d="M-28 12 Q-23 9 -18 12 T-8 12 T2 12 T12 12 T22 12 T30 12 V18 Q2 23 -28 18 Z" fill="#59cde6" opacity=".82"/>
      <path d="M-28 12 Q-23 9 -18 12 T-8 12 T2 12 T12 12 T22 12 T30 12" stroke="#f2fdff" stroke-width="1.1" fill="none"/>
    </g>`;
  }

  // Kraba (umesto lopova)
  function robber(x, y) {
    const claw = 'M0 0 Q-8 -2 -6 -9 Q-2 -6 0 -7 Q-3 -11 1 -13 Q5 -7 0 0 Z';
    return `<g class="crab" transform="translate(${x + 12} ${y + 9}) scale(.98)">${DEFS}
      <ellipse cx="2" cy="11" rx="18" ry="4" fill="#00203a55"/>
      <g stroke="#8e2a17" stroke-width="2.3" stroke-linecap="round" fill="none">
        <path d="M-10 3 L-16 6 L-18 11"/><path d="M-11 0 L-18 1 L-21 6"/><path d="M-9 6 L-13 10 L-14 13"/>
        <path d="M10 3 L16 6 L18 11"/><path d="M11 0 L18 1 L21 6"/><path d="M9 6 L13 10 L14 13"/>
        <path d="M-8 -4 L-13 -10"/><path d="M8 -4 L13 -10"/>
      </g>
      <g transform="translate(-13 -10)"><path d="${claw}" fill="#ee5b3c" stroke="#6e1a0e" stroke-width="1"/><path d="${claw}" fill="${SPH}"/></g>
      <g transform="translate(13 -10) scale(-1 1)"><path d="${claw}" fill="#ee5b3c" stroke="#6e1a0e" stroke-width="1"/><path d="${claw}" fill="${SPH}"/></g>
      <ellipse cx="0" cy="1" rx="13.5" ry="9.5" fill="#ee5b3c" stroke="#6e1a0e" stroke-width="1.2"/><ellipse cx="0" cy="1" rx="13.5" ry="9.5" fill="${SPH}"/>
      <path d="M-4 -7 L-5 -13 M4 -7 L5 -13" stroke="#6e1a0e" stroke-width="1.5"/>
      <circle cx="-5" cy="-14" r="2.7" fill="#fff" stroke="#6e1a0e" stroke-width=".8"/><circle cx="5" cy="-14" r="2.7" fill="#fff" stroke="#6e1a0e" stroke-width=".8"/>
      <circle cx="-4.5" cy="-14" r="1.25" fill="#111"/><circle cx="5.5" cy="-14" r="1.25" fill="#111"/><circle cx="-5.6" cy="-15" r=".5" fill="#fff"/><circle cx="4.4" cy="-15" r=".5" fill="#fff"/>
      <path d="M-3.5 3.5 Q0 6.4 3.5 3.5" stroke="#6e1a0e" stroke-width="1" fill="none"/>
    </g>`;
  }

  const card = {
    drvo: () => kelp(-8, 7, 1.25) + kelp(6, 8, 1.4) + bubbles(13, -14, 1.3),
    glina: () => coral(-7, 7, 1.5) + coral(8, 7, 1.3, '#ffa48f'),
    vuna: () => jelly(-6, 6, 1.4) + jelly(7, 3, 1.1),
    zito: () => scallop(-7, 6, 1.3) + scallop(7, 7, 1.5),
    kamen: () => crystal(0, 7, 1.7) + rock(-12, 8, 0.9),
    vitez: () => '<g stroke="#e9c35a" stroke-width="2.4" fill="none" stroke-linecap="round"><path d="M0 10 V-16"/><path d="M-8 -18 V-10 Q0 -4 8 -10 V-18"/><path d="M0 -24 V-16"/></g><path d="M-9 -18 l1 -4 l1 4 Z M7 -18 l1 -4 l1 4 Z M-1 -24 l1 -3 l1 3 Z" fill="#e9c35a"/>',
    bod: () => '<path d="M-12 2 L-12 -12 L-6 -6 L0 -16 L6 -6 L12 -12 L12 2 Z" fill="#f2c94c" stroke="#a87b16" stroke-width="1"/><path d="M-12 2 L-12 -12 L-6 -6 L0 -16 L6 -6 L12 -12 L12 2 Z" fill="url(#d3top)"/><circle cx="0" cy="-3" r="3" fill="#fbf6ee"/><circle cx="0" cy="-3" r="3" fill="url(#d3sph)"/><text x="0" y="10" text-anchor="middle" font-size="7" font-weight="900" fill="#f2c94c">+1</text>',
    putevi: () => [-12, -6, 0, 6, 12].map((x, i) => `<circle cx="${x}" cy="${-4 + (i % 2 ? -3 : 3)}" r="4.2" fill="#cfe9f5"/><circle cx="${x}" cy="${-4 + (i % 2 ? -3 : 3)}" r="4.2" fill="url(#d3sph)"/>`).join(''),
    obilje: () => '<rect x="-12" y="-6" width="24" height="14" rx="2" fill="#8a5a30" stroke="#4a2f16" stroke-width="1"/><rect x="-12" y="-6" width="24" height="14" rx="2" fill="url(#d3cyl)"/><path d="M-12 -6 Q0 -18 12 -6 Z" fill="#a8703c" stroke="#4a2f16" stroke-width="1"/><rect x="-2" y="-4" width="4" height="5" fill="#e9c35a"/>'
      + '<circle cx="-6" cy="-9" r="2.4" fill="#fbf6ee"/><circle cx="5" cy="-10" r="2" fill="#a8ecff"/><circle cx="0" cy="-12" r="2.2" fill="#f2c94c"/>',
    monopol: () => '<path d="M0 -2 m0 -12 a12 12 0 1 1 -11 7 a8.5 8.5 0 1 1 8 -6 a5.5 5.5 0 1 1 -5 4 a3 3 0 1 1 3 -3" fill="none" stroke="#bff3ff" stroke-width="2.4" stroke-linecap="round"/>',
  };
  const cardSVG = (k, attrs = 'class="art-svg"') => `<svg viewBox="-20 -26 40 36" ${attrs}>${DEFS}${card[k] ? card[k]() : ''}</svg>`;

  return { RES, TERRAIN, BOARD, terrain, road, robber, piece, cardSVG };
})();
