// Izgled "Dino ostrvo": ostrvo iz praistorije, malo crtani izgled.
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
  const g = (x, y, s, body) => `<g transform="translate(${x} ${y}) scale(${s})">${body}</g>`;
  const INK = '#2a1a0c'; // crtana kontura
  const ol = (w = 0.9) => `stroke="${INK}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;
  const shadow = (rx = 7, ry = 2.2) => `<ellipse cx="1.2" cy="1" rx="${rx}" ry="${ry}" fill="#1a120640"/>`;
  const DEFS = `<defs>
    <radialGradient id="dnsph" cx=".35" cy=".3" r=".75"><stop offset="0" stop-color="#fff" stop-opacity=".6"/><stop offset=".3" stop-color="#fff" stop-opacity=".08"/><stop offset=".65" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".35"/></radialGradient>
    <linearGradient id="dncyl" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity=".3"/><stop offset=".35" stop-color="#fff" stop-opacity=".22"/><stop offset=".6" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".35"/></linearGradient>
    <linearGradient id="dnlava" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe36b"/><stop offset=".5" stop-color="#ff8a1e"/><stop offset="1" stop-color="#d23a12"/></linearGradient>
  </defs>`;
  const SPH = 'url(#dnsph)', CYL = 'url(#dncyl)';

  // sirovine: nova imena, boje karata ostaju kao u obicnoj igri
  const RES = {
    drvo: { name: 'Paprat', ico: '🌿' },
    glina: { name: 'Fosili', ico: '🦴' },
    vuna: { name: 'Jaja', ico: '🥚' },
    zito: { name: 'Voće', ico: '🍌' },
    kamen: { name: 'Obsidijan', ico: '🌋' },
  };
  const TERRAIN = {
    suma: { a: '#5fbf4a', b: '#1f6b2a' }, // dzungla
    gliniste: { a: '#e3a46c', b: '#94512b' }, // fosilna brda
    pasnjak: { a: '#bfe36a', b: '#6aa632' }, // dino pasnjak
    polje: { a: '#f6dc6a', b: '#c9962c' }, // vocnjak
    planina: { a: '#a7a39c', b: '#4d4843' }, // vulkan
    pustinja: { a: '#d9bd8a', b: '#8f7046' }, // blato sa tragovima
  };
  const BOARD = { ring1: '#13708a', ring2: '#e8cf8c', hexStroke: '#fff3c9', token: '#fff7df', tokenInk: '#2a1a0c', hot: '#d8362a', side: -0.5, depth: 14, defs: DEFS };

  // ---------- sitni crtezi ----------
  function palm(x, y, s = 1) {
    let b = shadow(8, 2.4);
    b += `<path d="M-1.2 0 Q-2.2 -9 0.6 -18 L2.4 -18 Q0.6 -9 1.4 0 Z" fill="#8a5a2b" ${ol(0.7)}/>`;
    for (const yy of [-4, -8, -12, -15.5]) b += `<path d="M-1.4 ${yy} L1.6 ${yy - 1}" stroke="${INK}" stroke-width=".5" opacity=".6"/>`;
    for (const [a, c] of [[-150, '#2f9a3a'], [-30, '#2f9a3a'], [-115, '#45b84a'], [-65, '#45b84a'], [-90, '#5fd05a']]) {
      b += `<path d="M1.5 -18 Q${(1.5 + Math.cos(a * Math.PI / 180) * 7).toFixed(1)} ${(-18 + Math.sin(a * Math.PI / 180) * 7 - 3).toFixed(1)} ${(1.5 + Math.cos(a * Math.PI / 180) * 11).toFixed(1)} ${(-18 + Math.sin(a * Math.PI / 180) * 11 + 4).toFixed(1)} Q${(1.5 + Math.cos(a * Math.PI / 180) * 5).toFixed(1)} ${(-18 + Math.sin(a * Math.PI / 180) * 5 + 1).toFixed(1)} 1.5 -18 Z" fill="${c}" ${ol(0.6)}/>`;
    }
    b += `<circle cx="0.5" cy="-17" r="1.4" fill="#7a4a1c" ${ol(0.4)}/><circle cx="2.6" cy="-16.6" r="1.3" fill="#7a4a1c" ${ol(0.4)}/>`;
    return g(x, y, s, b);
  }
  function fern(x, y, s = 1, c = '#3fae45') {
    let b = shadow(7, 2);
    for (const [a, len] of [[-160, 9], [-125, 11], [-90, 12], [-55, 11], [-20, 9]]) {
      const r = a * Math.PI / 180, ex = Math.cos(r) * len, ey = Math.sin(r) * len;
      b += `<path d="M0 0 Q${(ex * 0.4).toFixed(1)} ${(ey * 0.7 - 2).toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}" stroke="${shade(c, -0.35)}" stroke-width="1.1" fill="none"/>`;
      for (let i = 1; i <= 4; i++) {
        const f = i / 5, px = ex * f, py = ey * f - 1.5 * Math.sin(f * Math.PI);
        b += `<ellipse cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" rx="${(2.4 - f).toFixed(1)}" ry="1" fill="${i % 2 ? c : shade(c, 0.18)}" transform="rotate(${(a + 90).toFixed(0)} ${px.toFixed(1)} ${py.toFixed(1)})"/>`;
      }
    }
    return g(x, y, s, b);
  }
  function hillRock(x, y, s = 1, c = '#b8743f') {
    let b = shadow(9, 2.6);
    const d = 'M-9 0 Q-10 -7 -4 -9 Q0 -13 5 -9 Q10 -7 9 0 Z';
    b += `<path d="${d}" fill="${c}" ${ol(0.8)}/><path d="${d}" fill="${SPH}"/>`;
    b += `<path d="M-5 -4 Q-3 -6 -1 -4" stroke="${shade(c, -0.4)}" stroke-width=".7" fill="none"/>`;
    return g(x, y, s, b);
  }
  function bone(x, y, s = 1, rot = 0) {
    const end = (cx) => `<circle cx="${cx}" cy="-1.3" r="1.6" fill="#f6ecd2" ${ol(0.5)}/><circle cx="${cx}" cy="1.3" r="1.6" fill="#f6ecd2" ${ol(0.5)}/>`;
    return g(x, y, s, `<g transform="rotate(${rot})">${end(-6)}${end(6)}<rect x="-6" y="-1.1" width="12" height="2.2" fill="#f6ecd2"/><path d="M-6 -1.1 H6 M-6 1.1 H6" stroke="${INK}" stroke-width=".5"/></g>`);
  }
  function skull(x, y, s = 1) {
    let b = shadow(8, 2.2);
    const d = 'M-8 0 Q-9 -6 -4 -8 Q2 -10 7 -6 L9 -3 Q8 0 5 0 L4 -1.5 L3 0 L1.5 -1.5 L0 0 Z';
    b += `<path d="${d}" fill="#f3e6c4" ${ol(0.7)}/><path d="${d}" fill="${SPH}"/>`;
    b += `<circle cx="-2" cy="-5" r="1.9" fill="${INK}"/><circle cx="3.5" cy="-5.2" r="1" fill="${INK}"/>`;
    return g(x, y, s, b);
  }
  function pick(x, y, s = 1) {
    return g(x, y, s, `<path d="M-5 0 L4 -12" stroke="#8a5a2b" stroke-width="1.8" stroke-linecap="round"/><path d="M-1 -14 Q4 -14 8 -9 Q4 -12 -1 -11.5 Z" fill="#9aa3ab" ${ol(0.6)}/>`);
  }
  function egg(x, y, s = 1, c = '#f7efd9') {
    const d = 'M0 0 Q-4.2 0 -4.2 -5 Q-4 -11 0 -11 Q4 -11 4.2 -5 Q4.2 0 0 0 Z';
    return g(x, y, s, `<ellipse cx="0" cy="0" rx="4" ry="1.2" fill="#1a120640"/><path d="${d}" fill="${c}" ${ol(0.6)}/><path d="${d}" fill="${SPH}"/><circle cx="-1.5" cy="-7" r=".8" fill="#9fb86a"/><circle cx="1.6" cy="-4" r=".6" fill="#9fb86a"/>`);
  }
  function nest(x, y, s = 1) {
    let b = '<ellipse cx="0" cy="1" rx="10" ry="3" fill="#1a120640"/>';
    b += egg(-3.5, -1, 0.75) + egg(3.5, -1, 0.75, '#e9f3d0') + egg(0, -0.5, 0.85);
    b += `<path d="M-9.5 -1 Q0 5 9.5 -1 Q9 3 0 4 Q-9 3 -9.5 -1 Z" fill="#b08646" ${ol(0.6)}/>`;
    b += '<path d="M-7 1 L-3 2.4 M2 2.6 L6.5 1.2 M-1 3 L1.5 2" stroke="#6b4b1f" stroke-width=".6"/>';
    return g(x, y, s, b);
  }
  // mali biljojed sa dugim vratom (crtani)
  function longneck(x, y, s = 1, c = '#7cc0a8') {
    const d = shade(c, -0.3);
    let b = shadow(10, 2.4);
    b += `<path d="M-7 -1 V-6 M-3 -1 V-6 M3 -1 V-6 M7 -1 V-6" stroke="${d}" stroke-width="2.4" stroke-linecap="round"/>`;
    const body = 'M-10 -6 Q-12 -13 -3 -13 Q6 -14 9 -10 Q13 -11 14 -18 Q14 -24 11 -25 Q9 -26 8 -23 Q9 -17 7 -14 Q11 -5 4 -4 L-6 -4 Q-14 -3 -17 -1 Q-12 -6 -10 -6 Z';
    b += `<path d="${body}" fill="${c}" ${ol(0.7)}/><path d="${body}" fill="${SPH}" opacity=".7"/>`;
    b += `<path d="M7 -24 Q10 -28 14 -26 Q16 -24 13 -22.5 Q10 -22 8 -23 Z" fill="${c}" ${ol(0.7)}/>`;
    b += `<circle cx="12" cy="-25.2" r=".9" fill="${INK}"/><path d="M-4 -11 Q-1 -12 2 -11" stroke="${shade(c, 0.3)}" stroke-width="1" fill="none"/>`;
    return g(x, y, s, b);
  }
  function fence(x, y, s = 1) {
    let b = '';
    for (const px of [-10, -3.3, 3.3, 10]) b += `<rect x="${px - 0.9}" y="-8" width="1.8" height="8.5" fill="#9b6a37" ${ol(0.4)}/>`;
    b += `<path d="M-11 -6 H11 M-11 -2.6 H11" stroke="#b88550" stroke-width="1.5"/><path d="M-11 -6 H11 M-11 -2.6 H11" stroke="${INK}" stroke-width=".35" transform="translate(0 .8)"/>`;
    return g(x, y, s, b);
  }
  function fruitTree(x, y, s = 1) {
    let b = shadow(8, 2.4);
    b += `<path d="M-1 0 Q-1.6 -6 0 -11 L1.6 -11 Q1 -6 1 0 Z" fill="#8a5a2b" ${ol(0.6)}/>`;
    const crown = 'M-8 -10 Q-10 -17 -4 -19 Q0 -24 5 -19 Q11 -17 8.5 -10 Q4 -7 0 -8.5 Q-4 -7 -8 -10 Z';
    b += `<path d="${crown}" fill="#4bab3e" ${ol(0.7)}/><path d="${crown}" fill="${SPH}"/>`;
    for (const [fx, fy, fc] of [[-4.5, -13, '#ff7b39'], [3.5, -15.5, '#ffd23b'], [5, -11, '#ff7b39'], [-1, -17, '#ffd23b']]) b += `<circle cx="${fx}" cy="${fy}" r="1.7" fill="${fc}" ${ol(0.4)}/>`;
    return g(x, y, s, b);
  }
  function banana(x, y, s = 1) {
    let b = shadow(6, 2);
    for (const dx of [-2.2, 0.2, 2.6]) b += `<path d="M${dx - 1} -1 Q${dx - 5} -8 ${dx - 1} -14 Q${dx + 0.5} -13 ${dx - 1.2} -12 Q${dx - 2.5} -7 ${dx + 1} -1 Z" fill="#ffd93b" ${ol(0.55)}/>`;
    b += `<rect x="-2.6" y="-15.6" width="4.4" height="2.4" rx="1" fill="#6e8a2a" ${ol(0.4)}/>`;
    return g(x, y, s, b);
  }
  function grass(x, y, s = 1) {
    return g(x, y, s, '<path d="M-4 0 Q-5 -5 -6 -7 M-1.5 0 Q-1.5 -6 -2 -9 M1 0 Q2 -6 3.5 -8 M3.5 0 Q5 -4 7 -5" stroke="#b58d22" stroke-width="1.1" fill="none" stroke-linecap="round"/>');
  }
  function volcano(x, y, s = 1) {
    let b = shadow(15, 3.4);
    const cone = 'M-15 0 L-5 -20 Q0 -22 5 -20 L15 0 Q0 3 -15 0 Z';
    b += `<path d="${cone}" fill="#6d665e" ${ol(0.8)}/>`;
    b += '<path d="M0 -21.5 L5 -20 L15 0 Q8 1.8 2 1.6 Z" fill="#000" opacity=".22"/>';
    b += '<path d="M-5 -20 L-7.5 -15 L-12 -6 L-15 0 L-11 0 Z" fill="#fff" opacity=".12"/>';
    b += `<path d="M-5 -20 Q-3 -17 -2 -13 Q-1 -9 -3 -5 Q0 -9 1 -13 Q2 -17 1 -20 Z" fill="url(#dnlava)" ${ol(0.4)}/>`;
    b += `<path d="M3 -20 Q5 -15 6.5 -11 Q5.5 -15 5 -20 Z" fill="url(#dnlava)"/>`;
    b += `<ellipse cx="0" cy="-20.5" rx="5.2" ry="1.6" fill="#ff8a1e" ${ol(0.6)}/>`;
    b += '<circle cx="-2" cy="-26" r="3" fill="#cfcac3" opacity=".9"/><circle cx="2.5" cy="-29" r="3.8" fill="#e3dfd9" opacity=".9"/><circle cx="-1" cy="-33.5" r="3" fill="#f0ede8" opacity=".85"/>';
    return g(x, y, s, b);
  }
  function obsidian(x, y, s = 1) {
    let b = shadow(6, 2);
    b += `<polygon points="-5,0 -6,-5 -2,-9 3,-8 6,-3 5,0" fill="#2c2733" ${ol(0.6)}/>`;
    b += '<polygon points="-2,-9 3,-8 1,-4 -3,-5" fill="#6a5f80"/><polygon points="3,-8 6,-3 1,-4" fill="#3f3850"/><path d="M-4 -4 L-2 -7" stroke="#b9a8e0" stroke-width=".6"/>';
    return g(x, y, s, b);
  }
  function footprint(x, y, s = 1, rot = 0) {
    return g(x, y, s, `<g transform="rotate(${rot})" fill="#6e5330" opacity=".75"><ellipse cx="0" cy="0" rx="3.6" ry="4.2"/><path d="M-3 -3 L-6.5 -9 L-4.2 -9.5 L-1.2 -4 Z M-0.8 -4 L0 -11 L2 -11 L1.6 -4 Z M1.8 -3.5 L6 -8.5 L7.4 -7 L3.6 -2.5 Z"/></g>`);
  }
  function mudPuddle(x, y, s = 1) {
    return g(x, y, s, '<ellipse cx="0" cy="0" rx="9" ry="3" fill="#7a5c34" opacity=".55"/><ellipse cx="-2" cy="-.6" rx="3" ry=".8" fill="#fff" opacity=".25"/>');
  }

  const SPOTS = [[-22, -24], [22, -24], [-36, 8], [36, 8], [0, -36]];
  function terrain(type, cx, cy, k = 1) {
    const at = (i, fn, s, ...a) => fn(cx + SPOTS[i][0] * Math.max(1, k * 0.95), cy + SPOTS[i][1], s, ...a);
    switch (type) {
      case 'suma': return at(0, palm, 1.2) + at(4, fern, 1.1) + at(1, palm, 1.3) + at(2, fern, 1.15, '#2f9a3a') + at(3, palm, 1.05);
      case 'gliniste': return at(0, hillRock, 1.2) + at(1, hillRock, 1.05, '#c7864d') + at(2, skull, 1.05) + at(3, bone, 1.1, -20) + at(4, pick, 1.1) + bone(cx + 34, cy - 14, 0.9, 30);
      case 'pasnjak': return at(4, fence, 1.1) + at(0, longneck, 0.95) + at(1, nest, 1.1) + at(3, longneck, 0.75, '#e0a85a') + at(2, egg, 1.1);
      case 'polje': return at(0, fruitTree, 1.2) + at(1, fruitTree, 1.1) + at(4, grass, 1.2) + at(2, banana, 1.1) + at(3, grass, 1.3);
      case 'planina': return volcano(cx, cy - 18, 1.35) + at(2, obsidian, 1.1) + at(3, obsidian, 1.2);
      case 'pustinja': return mudPuddle(cx - 22, cy + 22, 1.4) + footprint(cx - 26, cy - 22, 1.4, -20) + footprint(cx - 6, cy - 34, 1.4, 10) + footprint(cx + 18, cy - 22, 1.4, 35)
        + bone(cx + 28, cy + 22, 1.2, 15) + skull(cx + 4, cy + 30, 1) + fern(cx - 38, cy + 6, 0.8, '#7a9a3a');
      default: return '';
    }
  }

  // put: drvena staza u boji igraca, sa daskama i stubicima
  function road(r) {
    const dx = r.x2 - r.x1, dy = r.y2 - r.y1, len = Math.hypot(dx, dy), nx = -dy / len, ny = dx / len;
    let under = `<line x1="${r.x1}" y1="${r.y1 + 3}" x2="${r.x2}" y2="${r.y2 + 3}" stroke="#1a120655" stroke-width="12" stroke-linecap="round"/>`
      + `<line x1="${r.x1}" y1="${r.y1}" x2="${r.x2}" y2="${r.y2}" stroke="${INK}" stroke-width="12" stroke-linecap="round"/>`;
    let top = `<line x1="${r.x1}" y1="${r.y1}" x2="${r.x2}" y2="${r.y2}" stroke="${r.col}" stroke-width="8.6" stroke-linecap="round"/>`;
    const n = 6;
    for (let i = 1; i < n; i++) {
      const f = i / n, x = r.x1 + dx * f, y = r.y1 + dy * f;
      top += `<line x1="${x + nx * 4.2}" y1="${y + ny * 4.2}" x2="${x - nx * 4.2}" y2="${y - ny * 4.2}" stroke="${shade(r.col, -0.45)}" stroke-width="1.1" opacity=".8"/>`;
    }
    top += `<line x1="${r.x1 + nx * 2}" y1="${r.y1 + ny * 2 - 1}" x2="${r.x2 + nx * 2}" y2="${r.y2 + ny * 2 - 1}" stroke="#fff" stroke-width="1.2" opacity=".28" stroke-linecap="round"/>`;
    for (const f of [0.25, 0.75]) {
      const x = r.x1 + dx * f, y = r.y1 + dy * f;
      top += `<circle cx="${x + nx * 5}" cy="${y + ny * 5}" r="1.9" fill="#8a5a2b" ${ol(0.6)}/><circle cx="${x - nx * 5}" cy="${y - ny * 5}" r="1.9" fill="#8a5a2b" ${ol(0.6)}/>`;
    }
    return { under, top };
  }

  function piece(type, x, y, col) {
    const d = shade(col, -0.32), l = shade(col, 0.35), o = ol(1.1);
    if (type === 'settlement') {
      // kamp: sator u boji igraca sa zastavicom, kraj njega vatra
      return `<g class="piece" transform="translate(${x} ${y}) scale(1.4)">${DEFS}
      <ellipse cx="1" cy="10.5" rx="15" ry="3.6" fill="#1a120655"/>
      <path d="M-12 10 L-2 -9 L2 -9 L12 10 Z" fill="${col}" ${o}/>
      <path d="M-2 -9 L-12 10 L-6 10 Z" fill="${l}" opacity=".55"/>
      <path d="M2 -9 L12 10 L5 10 Z" fill="${d}" opacity=".7"/>
      <path d="M0 -8 L-4.8 10 L4.8 10 Z" fill="#3a2410" ${ol(0.8)}/>
      <path d="M0 -8 L-2.4 10 L-4.8 10 Z" fill="${l}" ${ol(0.7)}/>
      <path d="M-12 10 L-2 -9 L2 -9 L12 10" fill="none" ${o}/>
      <path d="M0 -9 V-17" stroke="${INK}" stroke-width="1.1"/><path d="M0 -17 L6.5 -15 L0 -13 Z" fill="${l}" ${ol(0.6)}/>
      <g transform="translate(13 9)"><path d="M-3 0 L3 -1.2 M-3 -1.2 L3 0" stroke="#7a4a1c" stroke-width="1.4" stroke-linecap="round"/><path d="M0 -1 Q-2.6 -4 -0.6 -7.5 Q0 -5 1.2 -6.5 Q2.6 -3.5 0 -1 Z" fill="#ff9a2e" ${ol(0.5)}/><path d="M0 -1.6 Q-1 -3.4 0 -4.8 Q1 -3.4 0 -1.6 Z" fill="#ffe36b"/></g>
    </g>`;
    }
    // istrazivacka stanica: zgrada u boji igraca, staklena kupola, antena sa svetlom i mali modul sa strane
    let win = '';
    for (const wx of [-8.5, -2.5, 3.5]) win += `<rect x="${wx}" y="-4" width="4" height="4" rx=".8" fill="#bff1ff" ${ol(0.6)}/>`;
    return `<g class="piece" transform="translate(${x} ${y}) scale(1.2)">${DEFS}
      <ellipse cx="2" cy="14" rx="23" ry="5" fill="#1a120655"/>
      <path d="M8 14 V2 H20 V14 Z" fill="${d}" ${o}/><path d="M7 2 H21 L19 -1 H9 Z" fill="${l}" ${o}/>
      <rect x="11" y="5" width="6" height="3.6" rx=".8" fill="#bff1ff" ${ol(0.6)}/>
      <path d="M-13 14 V-8 H10 V14 Z" fill="${col}" ${o}/><path d="M-13 14 V-8 H10 V14 Z" fill="${CYL}"/>
      <path d="M-14.5 -8 H11.5 L9 -11 H-12 Z" fill="${l}" ${o}/>
      <path d="M-11 -6 H8" stroke="#fff" stroke-width="1" opacity=".35"/>
      ${win}
      <path d="M-3.5 14 V5 H2.5 V14 Z" fill="#3a2a1a" ${ol(0.8)}/><path d="M-0.5 5 V14" stroke="${INK}" stroke-width=".6"/>
      <path d="M-11 -11 A9 8.5 0 0 1 7 -11 Z" fill="#9fe2f2" fill-opacity=".9" ${o}/><path d="M-11 -11 A9 8.5 0 0 1 7 -11 Z" fill="${SPH}"/>
      <path d="M-2 -19.5 V-11 M-8 -16.5 Q-6 -13 -6 -11 M4 -16.5 Q2 -13 2 -11" stroke="#fff" stroke-width=".7" fill="none" opacity=".75"/>
      <path d="M15 -1 V-20" stroke="${INK}" stroke-width="1.4"/><path d="M12 -16 L15 -20 L18 -16 M13 -11 L15 -14 L17 -11" stroke="${INK}" stroke-width=".8" fill="none"/>
      <circle cx="15" cy="-21" r="1.8" fill="#ff4a3a" ${ol(0.6)}/><circle cx="15" cy="-21" r="4" fill="#ff4a3a" opacity=".22"/>
    </g>`;
  }

  // Reks (umesto lopova): crtani tiranosaurus
  function robber(x, y) {
    const c = '#6fae4a', dk = '#3f7a2a', o = ol(1);
    const body = 'M-14 8 Q-20 4 -24 -2 Q-16 0 -10 -2 Q-8 -12 0 -13 Q6 -13 8 -8 L9 -2 Q10 6 4 10 Z';
    const head = 'M2 -14 Q2 -24 11 -25 Q20 -25 21 -19 L21 -15 Q14 -14 9 -12 Q4 -10 2 -14 Z';
    return `<g class="rex" transform="translate(${x + 6} ${y + 6}) scale(1.08)">${DEFS}
      <ellipse cx="-2" cy="13" rx="19" ry="4" fill="#1a120660"/>
      <path d="M-6 6 L-8 13 L-3 13 L-2 7 Z" fill="${dk}" ${o}/>
      <path d="${body}" fill="${c}" ${o}/><path d="${body}" fill="${SPH}"/>
      <path d="M-4 -4 Q0 2 5 0 Q4 8 0 9 Q-5 8 -4 -4 Z" fill="#d6e8a0"/>
      <path d="M-2 -12 L-1 -15 L1 -12.5 L3 -15.5 L4 -12" fill="${dk}" ${ol(0.6)}/>
      <path d="M-10 -1 L-7 -4 L-6 -1 M-16 0 L-14 -3 L-12 0" fill="${dk}" stroke="none"/>
      <path d="M1 7 L0 13 L6 13 L5 6 Z" fill="${c}" ${o}/><path d="M0 13 L1 11.6 L2 13 L3 11.6 L4 13 L5 11.6 L6 13" stroke="${INK}" stroke-width=".6" fill="#f3ecd8"/>
      <path d="M6 -6 Q10 -5 10 -2 M7.5 -3.5 L10 -2 L8.8 -0.4" stroke="${INK}" stroke-width="1.2" fill="none" stroke-linecap="round"/>
      <path d="${head}" fill="${c}" ${o}/><path d="${head}" fill="${SPH}"/>
      <path d="M9 -12 Q15 -12.5 21 -15 Q21 -11 16 -10 Q11 -9.5 9 -12 Z" fill="${c}" ${o}/>
      <path d="M11 -14 L12 -12.3 L13.2 -14.2 L14.4 -12.6 L15.6 -14.6 L16.8 -13 L18 -15" stroke="${INK}" stroke-width=".5" fill="#fff"/>
      <circle cx="12" cy="-20" r="2.6" fill="#fff" ${ol(0.6)}/><circle cx="12.7" cy="-20" r="1.3" fill="${INK}"/><circle cx="12.2" cy="-20.7" r=".45" fill="#fff"/>
      <path d="M9.4 -23.4 L14.4 -22.4" stroke="${INK}" stroke-width="1.1" stroke-linecap="round"/>
      <circle cx="19" cy="-21" r=".7" fill="${INK}"/>
    </g>`;
  }

  const card = {
    drvo: () => fern(-6, 8, 1.45) + palm(8, 9, 1.15),
    glina: () => skull(-4, 6, 1.55) + bone(8, 8, 1, 25),
    vuna: () => nest(0, 7, 1.55),
    zito: () => banana(-6, 8, 1.3) + fruitTree(7, 9, 1.05),
    kamen: () => volcano(-4, 9, 0.85) + obsidian(10, 9, 1.1),
    vitez: () => `<path d="M-13 -2 Q-13 -6 -8 -7 Q-6 -16 0 -16 Q6 -16 8 -7 Q13 -6 13 -2 Q0 1 -13 -2 Z" fill="#d9b779" ${ol(0.8)}/><path d="M-8 -7 Q0 -4 8 -7 L8 -9 Q0 -6 -8 -9 Z" fill="#7a4a1c"/><path d="M-13 -2 Q-13 -6 -8 -7 Q-6 -16 0 -16 Q6 -16 8 -7 Q13 -6 13 -2 Q0 1 -13 -2 Z" fill="${SPH}"/>`,
    bod: () => `<path d="M-6 -16 Q-12 -6 -6 4 Q0 8 6 4 Q12 -6 6 -16 Z" fill="#f0a52a" ${ol(0.8)}/><path d="M-6 -16 Q-12 -6 -6 4 Q0 8 6 4 Q12 -6 6 -16 Z" fill="${SPH}"/><text x="0" y="-2" text-anchor="middle" font-size="9" font-weight="900" fill="#5a3208">+1</text>`,
    putevi: () => [-12, -4, 4, 12].map((xx) => `<rect x="${xx - 3}" y="-14" width="6" height="18" rx="1.5" fill="#b88550" ${ol(0.6)}/>`).join(''),
    obilje: () => `<path d="M-12 -4 H12 L9 8 H-9 Z" fill="#b08646" ${ol(0.8)}/><path d="M-11 0 H11 M-10 4 H10" stroke="#6b4b1f" stroke-width=".8"/>${egg(-5, -4, 0.8)}${banana(4, -3, 0.8)}<circle cx="0" cy="-6" r="2.4" fill="#ff7b39" ${ol(0.5)}/>`,
    monopol: () => `<path d="M-14 -16 L14 -16 M-14 -16 L-14 6 M14 -16 L14 6 M-14 -9 L14 -9 M-14 -2 L14 -2 M-14 5 L14 5 M-7 -16 V6 M0 -16 V6 M7 -16 V6" stroke="#e9e2cf" stroke-width="1.2"/>`,
  };
  const cardSVG = (k, attrs = 'class="art-svg"') => `<svg viewBox="-20 -26 40 36" ${attrs}>${DEFS}${card[k] ? card[k]() : ''}</svg>`;

  // reci u tekstu: lopov postaje Reks (uvek veliko slovo, jer je ime)
  const ROBBER = { words: { lopov: 'Reks', lopova: 'Reksa', lopovu: 'Reksu', lopovom: 'Reksom', lopove: 'Rekse' }, emoji: '🦖', name: true };

  return { RES, TERRAIN, BOARD, terrain, road, robber, piece, cardSVG, ROBBER };
})();
