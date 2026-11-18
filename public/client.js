/* global io */
const socket = io();
const $ = (id) => document.getElementById(id);

const RES = ['drvo', 'glina', 'vuna', 'zito', 'kamen'];
const RES_INFO = {
  drvo: { name: 'Drvo', ico: '🌲', color: '#3f7d3a' },
  glina: { name: 'Glina', ico: '🧱', color: '#c4683b' },
  vuna: { name: 'Vuna', ico: '🐑', color: '#7db24a' },
  zito: { name: 'Žito', ico: '🌾', color: '#d9ad2b' },
  kamen: { name: 'Kamen', ico: '🪨', color: '#7d828c' },
};
const TERRAIN = {
  suma: { fill: '#3f7d3a', ico: '🌲' },
  gliniste: { fill: '#c4683b', ico: '🧱' },
  pasnjak: { fill: '#8fc35b', ico: '🐑' },
  polje: { fill: '#e6c34a', ico: '🌾' },
  planina: { fill: '#8b8f99', ico: '⛰️' },
  pustinja: { fill: '#dcc99c', ico: '🏜️' },
};
const DEV_INFO = {
  vitez: { name: 'Vitez', ico: '⚔️', desc: 'Pomeri razbojnika i ukradi kartu.' },
  bod: { name: 'Bod pobede', ico: '⭐', desc: '+1 poen (računa se sam).' },
  putevi: { name: 'Graditelji puteva', ico: '🛠️', desc: 'Sagradi 2 puta besplatno.' },
  obilje: { name: 'Obilje', ico: '✨', desc: 'Uzmi 2 sirovine iz banke.' },
  monopol: { name: 'Monopol', ico: '💰', desc: 'Uzmi svim igračima jednu sirovinu.' },
};
const COST = {
  road: { drvo: 1, glina: 1 },
  settlement: { drvo: 1, glina: 1, vuna: 1, zito: 1 },
  city: { zito: 2, kamen: 3 },
  dev: { vuna: 1, zito: 1, kamen: 1 },
};
const DICE = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

let S = null; // stanje sa servera
let mode = null; // 'road' | 'settlement' | 'city' | null
let tab = 'log';
let seenChat = 0;
let tradeGive = {}, tradeGet = {};
let lastToastSteal = 0;

// ---------- identitet ----------
function token() {
  let t = localStorage.getItem('ot_token');
  if (!t) { t = Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem('ot_token', t); }
  return t;
}
$('nameInput').value = localStorage.getItem('ot_name') || '';
const saveName = () => { const n = $('nameInput').value.trim(); localStorage.setItem('ot_name', n); return n; };

function toast(msg) {
  const t = $('toast');
  t.textContent = msg; t.classList.remove('hidden');
  clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.add('hidden'), 3000);
}

function act(type, data = {}) {
  socket.emit('action', { type, data }, (r) => { if (r && !r.ok) toast(r.error); });
}

// ---------- ulazak u sobu ----------
const params = new URLSearchParams(location.search);
const inviteCode = (params.get('soba') || '').toUpperCase();
if (inviteCode) {
  $('joinInvite').classList.remove('hidden');
  $('homeButtons').classList.add('hidden');
  $('inviteCode').textContent = inviteCode;
}

function enter(code, created) {
  const url = new URL(location.href); url.searchParams.set('soba', code);
  history.replaceState(null, '', url);
  localStorage.setItem('ot_room', code);
}

function needName() {
  const n = saveName();
  if (!n) { $('homeError').textContent = 'Upiši svoje ime.'; return null; }
  return n;
}
$('createBtn').onclick = () => {
  const name = needName(); if (!name) return;
  socket.emit('create', { name, token: token() }, (r) => r.ok ? enter(r.code) : ($('homeError').textContent = r.error));
};
function join(code) {
  const name = needName(); if (!name) return;
  socket.emit('join', { code, name, token: token() }, (r) => r.ok ? enter(r.code) : ($('homeError').textContent = r.error));
}
$('joinBtn').onclick = () => join($('codeInput').value);
$('joinInviteBtn').onclick = () => join(inviteCode);

// automatski povratak posle osvezavanja stranice
socket.on('connect', () => {
  const code = inviteCode || (S && S.code);
  if (code && localStorage.getItem('ot_name')) {
    socket.emit('join', { code, name: localStorage.getItem('ot_name'), token: token(), rejoinOnly: true }, () => {});
  }
});

$('copyBtn').onclick = () => { $('inviteLink').select(); navigator.clipboard?.writeText($('inviteLink').value); toast('Link je kopiran.'); };
$('startBtn').onclick = () => act('start');

// ---------- prijem stanja ----------
socket.on('state', (state) => {
  S = state;
  if (S.sub !== 'main' || S.turn !== S.me) mode = null;
  render();
});

function show(id) { for (const s of ['home', 'lobby', 'game']) $(s).classList.toggle('hidden', s !== id); }
const me = () => S.players.find((p) => p.id === S.me);
const pById = (id) => S.players.find((p) => p.id === id);
const myTurn = () => S.turn === S.me;
const canAfford = (cost) => RES.every((r) => S.hand[r] >= (cost[r] || 0));

function render() {
  if (S.phase === 'lobby') return renderLobby();
  show('game');
  renderStatus();
  renderBoard();
  renderHand();
  renderActions();
  renderPlayers();
  renderTrade();
  renderLog();
  renderModal();
}

function renderLobby() {
  show('lobby');
  $('lobbyCode').textContent = S.code;
  const url = new URL(location.href); url.search = '?soba=' + S.code;
  $('inviteLink').value = url.toString();
  $('lobbyPlayers').innerHTML = S.players.map((p) =>
    `<li><span class="dot" style="background:${p.color}"></span>${esc(p.name)}${p.id === S.host ? ' <span class="badge">osnivač</span>' : ''}${p.id === S.me ? ' (ti)' : ''}</li>`).join('');
  const host = S.host === S.me;
  $('startBtn').classList.toggle('hidden', !host);
  $('startBtn').disabled = S.players.length < 2;
  $('lobbyWait').classList.toggle('hidden', host);
}

function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

function renderStatus() {
  const cur = pById(S.turn);
  let txt = '';
  const who = myTurn() ? 'Ti' : cur.name;
  if (S.phase === 'ended') txt = `🏆 ${pById(S.winner).name} je pobedio!`;
  else if (S.sub === 'settlement') txt = myTurn() ? 'Postavi selo (klikni na označeno mesto)' : `${cur.name} postavlja selo…`;
  else if (S.sub === 'road') txt = myTurn() ? 'Postavi put pored sela' : `${cur.name} postavlja put…`;
  else if (S.sub === 'roll') txt = myTurn() ? 'Tvoj red: baci kockice' : `${cur.name} baca kockice…`;
  else if (S.sub === 'discard') txt = S.pendingDiscard[S.me] ? `Odbaci ${S.pendingDiscard[S.me]} karata` : 'Čeka se da igrači odbace karte…';
  else if (S.sub === 'robber') txt = myTurn() ? 'Pomeri razbojnika na novo polje' : `${cur.name} pomera razbojnika…`;
  else if (S.sub === 'steal') txt = myTurn() ? 'Izaberi od koga kradeš' : `${cur.name} bira od koga krade…`;
  else if (S.sub === 'roadBuilding') txt = myTurn() ? `Postavi besplatan put (${S.freeRoads} preostalo)` : `${cur.name} gradi puteve…`;
  else if (S.sub === 'main') txt = myTurn() ? (mode ? `Izaberi mesto: ${({ road: 'put', settlement: 'selo', city: 'grad' })[mode]} (Esc za otkaz)` : 'Tvoj red: gradi, trguj ili završi potez') : `Na potezu: ${who}`;
  $('status').innerHTML = `<span class="dot" style="background:${cur.color}"></span> ${esc(txt)}`;
  $('dice').innerHTML = S.dice ? S.dice.map((d) => `<div class="die">${DICE[d]}</div>`).join('') : '';
}

// ---------- tabla ----------
const SC = 62; // velicina polja
function renderBoard() {
  const svg = $('board');
  const B = S.board;
  const V = B.vertices;
  const xs = [...V.map((v) => v.x), ...B.ports.map((p) => p.x)], ys = [...V.map((v) => v.y), ...B.ports.map((p) => p.y)];
  const pad = 0.6;
  const minX = Math.min(...xs) - pad, maxX = Math.max(...xs) + pad, minY = Math.min(...ys) - pad, maxY = Math.max(...ys) + pad;
  svg.setAttribute('viewBox', `${minX * SC} ${minY * SC} ${(maxX - minX) * SC} ${(maxY - minY) * SC}`);
  const L = (myTurn() && S.legal) || {};
  let h = '';

  // more oko ostrva
  const R = Math.max(maxX, -minX, maxY, -minY) * SC;
  h += `<circle cx="0" cy="0" r="${R * 0.93}" fill="#2a7a96" opacity=".35"/>`;

  // luke
  for (const p of B.ports) {
    const e = B.edges[p.edge];
    for (const v of [V[e.a], V[e.b]]) h += `<line x1="${p.x * SC}" y1="${p.y * SC}" x2="${v.x * SC}" y2="${v.y * SC}" stroke="#e8dcc2" stroke-width="4" stroke-dasharray="4 4"/>`;
    const label = p.type === '3:1' ? '?' : RES_INFO[p.type].ico;
    h += `<g><circle cx="${p.x * SC}" cy="${p.y * SC}" r="20" fill="#f6f1e7" stroke="#6b5a3e" stroke-width="2"/>
      <text x="${p.x * SC}" y="${p.y * SC - 2}" text-anchor="middle" font-size="${p.type === '3:1' ? 15 : 14}" font-weight="700">${label}</text>
      <text x="${p.x * SC}" y="${p.y * SC + 13}" text-anchor="middle" font-size="10" font-weight="700" fill="#6b5a3e">${p.type === '3:1' ? '3:1' : '2:1'}</text></g>`;
  }

  // polja
  for (const hx of B.hexes) {
    const pts = hx.corners.map((c) => `${V[c].x * SC},${V[c].y * SC}`).join(' ');
    const t = TERRAIN[hx.terrain];
    h += `<polygon points="${pts}" fill="${t.fill}" stroke="#f3e7c9" stroke-width="4" stroke-linejoin="round"/>`;
    h += `<text x="${hx.x * SC}" y="${hx.y * SC - 18}" text-anchor="middle" font-size="22" opacity=".9">${t.ico}</text>`;
    if (hx.num) {
      const hot = hx.num === 6 || hx.num === 8;
      const pips = 6 - Math.abs(7 - hx.num);
      h += `<circle cx="${hx.x * SC}" cy="${hx.y * SC + 10}" r="17" fill="#fbf6ea" stroke="#0003"/>`;
      h += `<text x="${hx.x * SC}" y="${hx.y * SC + 15}" text-anchor="middle" font-size="16" font-weight="800" fill="${hot ? '#c0392b' : '#2b2620'}">${hx.num}</text>`;
      h += `<text x="${hx.x * SC}" y="${hx.y * SC + 24}" text-anchor="middle" font-size="7" fill="${hot ? '#c0392b' : '#2b2620'}">${'●'.repeat(pips)}</text>`;
    }
    if (hx.id === B.robber) {
      h += `<g transform="translate(${hx.x * SC + 22},${hx.y * SC + 2})"><ellipse cx="0" cy="16" rx="11" ry="4" fill="#0005"/><path d="M-9 15 Q-10 -2 0 -4 Q10 -2 9 15 Z" fill="#2d2a35"/><circle cx="0" cy="-9" r="7" fill="#2d2a35"/></g>`;
    }
  }

  // putevi
  for (const [eid, pid] of Object.entries(S.roads)) {
    const e = B.edges[eid]; const a = V[e.a], b = V[e.b];
    const col = pById(pid).color;
    const sx = a.x + (b.x - a.x) * 0.15, sy = a.y + (b.y - a.y) * 0.15, ex = a.x + (b.x - a.x) * 0.85, ey = a.y + (b.y - a.y) * 0.85;
    h += `<line x1="${sx * SC}" y1="${sy * SC}" x2="${ex * SC}" y2="${ey * SC}" stroke="#222" stroke-width="11" stroke-linecap="round"/>`;
    h += `<line x1="${sx * SC}" y1="${sy * SC}" x2="${ex * SC}" y2="${ey * SC}" stroke="${col}" stroke-width="7" stroke-linecap="round"/>`;
  }

  // mesta za puteve
  const showRoads = L.roads && (S.sub === 'road' || S.sub === 'roadBuilding' || mode === 'road');
  if (showRoads) for (const eid of L.roads) {
    const e = B.edges[eid]; const a = V[e.a], b = V[e.b];
    const sx = a.x + (b.x - a.x) * 0.2, sy = a.y + (b.y - a.y) * 0.2, ex = a.x + (b.x - a.x) * 0.8, ey = a.y + (b.y - a.y) * 0.8;
    h += `<line class="road-spot" data-e="${eid}" x1="${sx * SC}" y1="${sy * SC}" x2="${ex * SC}" y2="${ey * SC}"/>`;
  }

  // gradjevine
  for (const [vid, b] of Object.entries(S.buildings)) {
    const v = V[vid]; const col = pById(b.pid).color;
    const x = v.x * SC, y = v.y * SC;
    if (b.type === 'settlement') h += `<path d="M${x - 10} ${y + 9} V${y - 2} L${x} ${y - 12} L${x + 10} ${y - 2} V${y + 9} Z" fill="${col}" stroke="#222" stroke-width="2.5" stroke-linejoin="round"/>`;
    else h += `<path d="M${x - 15} ${y + 11} V${y - 4} H${x - 4} V${y - 9} L${x + 4} ${y - 17} L${x + 12} ${y - 9} V${y + 11} Z" fill="${col}" stroke="#222" stroke-width="2.5" stroke-linejoin="round"/><rect x="${x - 10}" y="${y + 1}" width="5" height="5" fill="#222" opacity=".5"/>`;
    if (L.cities && mode === 'city' && L.cities.includes(Number(vid))) h += `<circle class="spot" data-v="${vid}" data-kind="city" cx="${x}" cy="${y}" r="16" fill-opacity=".3"/>`;
  }

  // mesta za sela
  const showSett = L.settlements && (S.sub === 'settlement' || mode === 'settlement');
  if (showSett) for (const vid of L.settlements) h += `<circle class="spot" data-v="${vid}" data-kind="settlement" cx="${V[vid].x * SC}" cy="${V[vid].y * SC}" r="10"/>`;

  // razbojnik
  if (L.robber && S.sub === 'robber') for (const hid of L.robber) {
    const hx = B.hexes[hid];
    const pts = hx.corners.map((c) => `${V[c].x * SC},${V[c].y * SC}`).join(' ');
    h += `<polygon class="hex-target" data-hex="${hid}" points="${pts}"/>`;
  }

  svg.innerHTML = h;
}

$('board').addEventListener('click', (ev) => {
  const t = ev.target;
  if (t.dataset.e !== undefined) { act('placeRoad', { e: t.dataset.e }); if (S.sub === 'main') mode = null; }
  else if (t.dataset.kind === 'settlement') { act('placeSettlement', { v: t.dataset.v }); mode = null; }
  else if (t.dataset.kind === 'city') { act('placeCity', { v: t.dataset.v }); mode = null; }
  else if (t.dataset.hex !== undefined) act('moveRobber', { hex: t.dataset.hex });
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && mode) { mode = null; render(); } });

// ---------- ruka i akcije ----------
function renderHand() {
  $('hand').innerHTML = RES.map((r) => `<div class="card ${S.hand[r] ? '' : 'zero'}" style="background:${RES_INFO[r].color}" title="${RES_INFO[r].name}"><span class="ico">${RES_INFO[r].ico}</span><span class="n">${S.hand[r]}</span></div>`).join('');
  const groups = {};
  for (const d of S.dev) { groups[d.type] ??= { n: 0, ready: 0 }; groups[d.type].n++; if (!d.fresh) groups[d.type].ready++; }
  $('devHand').innerHTML = Object.entries(groups).map(([type, g]) =>
    `<div class="card dev ${g.ready ? '' : 'fresh'}" data-dev="${type}" title="${DEV_INFO[type].name}: ${DEV_INFO[type].desc}${g.ready ? '' : ' (kupljena u ovom potezu)'}"><span class="ico">${DEV_INFO[type].ico}</span>${DEV_INFO[type].name}${g.n > 1 ? ` ×${g.n}` : ''}</div>`).join('');
}
$('devHand').addEventListener('click', (ev) => {
  const c = ev.target.closest('[data-dev]'); if (!c) return;
  const type = c.dataset.dev;
  if (type === 'bod') return toast('Bod pobede se računa automatski.');
  if (type === 'obilje') return openPicker('Obilje: izaberi 2 sirovine', 2, (sel) => act('playDev', { card: 'obilje', res: sel[0], res2: sel[1] }));
  if (type === 'monopol') return openPicker('Monopol: koju sirovinu uzimaš od svih?', 1, (sel) => act('playDev', { card: 'monopol', res: sel[0] }));
  act('playDev', { card: type });
});

const costTxt = (c) => Object.entries(c).map(([r, n]) => RES_INFO[r].ico.repeat(n)).join('');
function renderActions() {
  const m = me();
  const main = myTurn() && S.sub === 'main' && S.phase === 'play';
  let h = '';
  if (myTurn() && S.sub === 'roll') h += `<button class="primary" data-a="roll">🎲 Baci kockice</button>`;
  h += `<button data-a="road" ${main && canAfford(COST.road) && m.left.road ? '' : 'disabled'} class="${mode === 'road' ? 'active' : ''}">Put<small>${costTxt(COST.road)}</small></button>`;
  h += `<button data-a="settlement" ${main && canAfford(COST.settlement) && m.left.settlement ? '' : 'disabled'} class="${mode === 'settlement' ? 'active' : ''}">Selo<small>${costTxt(COST.settlement)}</small></button>`;
  h += `<button data-a="city" ${main && canAfford(COST.city) && m.left.city ? '' : 'disabled'} class="${mode === 'city' ? 'active' : ''}">Grad<small>${costTxt(COST.city)}</small></button>`;
  h += `<button data-a="dev" ${main && canAfford(COST.dev) && S.devLeft ? '' : 'disabled'}>Razvojna karta<small>${costTxt(COST.dev)} (${S.devLeft})</small></button>`;
  if (myTurn() && (S.sub === 'main' || S.sub === 'roadBuilding')) h += `<button class="primary" data-a="end">Završi potez</button>`;
  $('actions').innerHTML = h;
}
$('actions').addEventListener('click', (ev) => {
  const b = ev.target.closest('button'); if (!b || b.disabled) return;
  const a = b.dataset.a;
  if (a === 'roll') act('roll');
  else if (a === 'end') act('endTurn');
  else if (a === 'dev') act('buyDev');
  else { mode = mode === a ? null : a; render(); }
});

function renderPlayers() {
  $('players').innerHTML = S.players.map((p) => `
    <div class="pl ${p.id === S.turn ? 'turn' : ''}">
      <span class="dot" style="background:${p.color}"></span>
      <span class="nm">${esc(p.name)}${p.id === S.me ? ' (ti)' : ''} ${p.connected ? '' : '<span class="off">van mreže</span>'}</span>
      <span class="vp" title="Poeni">⭐ ${p.vp}</span>
      <div class="stats">
        <span title="Karte sirovina">🂠 ${p.cards}</span>
        <span title="Razvojne karte">🃏 ${p.devCards}</span>
        <span title="Odigrani vitezovi" ${p.largest ? 'class="badge"' : ''}>⚔️ ${p.knights}</span>
        <span title="Najduži put" ${p.longest ? 'class="badge"' : ''}>🛤️ ${p.roadLen}</span>
      </div>
    </div>`).join('');
}

// ---------- trgovina ----------
function stepper(obj, r, max) {
  return `<div class="step"><button data-inc="${r}" data-o="${obj}">+</button><span>${(obj === 'give' ? tradeGive : tradeGet)[r] || 0}</span><button data-dec="${r}" data-o="${obj}">−</button></div>`;
}
function renderTrade() {
  const box = $('tradeBox');
  const t = S.trade;
  let h = '<h4>Trgovina</h4>';
  if (t && t.from !== S.me) {
    const from = pById(t.from);
    const fmt = (o) => Object.entries(o).map(([r, n]) => `${n}${RES_INFO[r].ico}`).join(' ');
    const mine = t.accepted.includes(S.me) ? 'prihvatio si' : t.declined.includes(S.me) ? 'odbio si' : '';
    h += `<div class="offer"><b>${esc(from.name)}</b> nudi ${fmt(t.give)} za ${fmt(t.get)}
      <div class="row"><button class="primary" data-tr="accept">Prihvati</button><button data-tr="decline">Odbij</button> <span class="muted">${mine}</span></div></div>`;
  }
  if (myTurn() && S.sub === 'main') {
    if (t && t.from === S.me) {
      const fmt = (o) => Object.entries(o).map(([r, n]) => `${n}${RES_INFO[r].ico}`).join(' ');
      h += `<div class="offer">Tvoja ponuda: ${fmt(t.give)} za ${fmt(t.get)}<div class="row">`;
      h += t.accepted.map((id) => `<button class="primary" data-with="${id}">Trguj sa ${esc(pById(id).name)}</button>`).join('') || '<span class="muted">Čeka se odgovor…</span>';
      if (t.declined.length) h += `<span class="muted">Odbili: ${t.declined.map((id) => esc(pById(id).name)).join(', ')}</span>`;
      h += `<button data-tr="cancel">Otkaži</button></div></div>`;
    } else {
      h += `<div class="trade-grid"><div></div>${RES.map((r) => `<div class="h">${RES_INFO[r].ico}</div>`).join('')}
        <div>Daješ</div>${RES.map((r) => stepper('give', r)).join('')}
        <div>Tražiš</div>${RES.map((r) => stepper('get', r)).join('')}</div>
        <div class="row" style="margin-top:8px"><button data-tr="offer" class="primary">Ponudi igračima</button><button data-tr="bank">Banka</button></div>
        <div class="muted" style="font-size:12px;margin-top:4px">Banka: ${RES.map((r) => `${RES_INFO[r].ico} ${S.rates[r]}:1`).join(' · ')}</div>`;
    }
  } else if (!t || t.from === S.me) {
    h += '<div class="muted">Trgovati možeš kad si na potezu, posle bacanja kockica.</div>';
  }
  box.innerHTML = h;
}
$('tradeBox').addEventListener('click', (ev) => {
  const b = ev.target.closest('button'); if (!b) return;
  if (b.dataset.inc) { const o = b.dataset.o === 'give' ? tradeGive : tradeGet; const r = b.dataset.inc; if (b.dataset.o === 'give' && (o[r] || 0) >= S.hand[r]) return; o[r] = (o[r] || 0) + 1; return renderTrade(); }
  if (b.dataset.dec) { const o = b.dataset.o === 'give' ? tradeGive : tradeGet; const r = b.dataset.dec; o[r] = Math.max(0, (o[r] || 0) - 1); return renderTrade(); }
  if (b.dataset.with) return act('confirmTrade', { with: b.dataset.with });
  const a = b.dataset.tr;
  if (a === 'accept') act('respondTrade', { accept: true });
  if (a === 'decline') act('respondTrade', { accept: false });
  if (a === 'cancel') act('cancelTrade');
  if (a === 'offer') { act('offerTrade', { give: tradeGive, get: tradeGet }); tradeGive = {}; tradeGet = {}; }
  if (a === 'bank') {
    const give = Object.keys(tradeGive).filter((r) => tradeGive[r]);
    const get = Object.keys(tradeGet).filter((r) => tradeGet[r]);
    if (give.length !== 1 || get.length !== 1) return toast(`Za banku: izaberi jednu sirovinu koju daješ i jednu koju dobijaš.`);
    act('bankTrade', { give: give[0], get: get[0] });
    tradeGive = {}; tradeGet = {};
  }
});

// ---------- dnevnik i caskanje ----------
function renderLog() {
  const log = $('log');
  const atBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 40;
  log.innerHTML = S.log.map((l) => `<div>${esc(l.text)}</div>`).join('');
  if (atBottom) log.scrollTop = log.scrollHeight;
  const chat = $('chat');
  chat.innerHTML = S.chat.map((c) => `<div><b style="color:${c.color}">${esc(c.name)}:</b> ${esc(c.text)}</div>`).join('');
  chat.scrollTop = chat.scrollHeight;
  if (tab === 'chat') seenChat = S.chat.length;
  const unread = S.chat.length - seenChat;
  $('chatBadge').textContent = unread > 0 ? unread : '';
  if (S.lastSteal && S.lastSteal.t > lastToastSteal) {
    lastToastSteal = S.lastSteal.t;
    const r = RES_INFO[S.lastSteal.res];
    toast(S.lastSteal.thief === S.me ? `Ukrao si: ${r.ico} ${r.name}` : `${pById(S.lastSteal.thief).name} ti je ukrao: ${r.ico} ${r.name}`);
  }
}
document.querySelectorAll('.tabs button').forEach((b) => b.onclick = () => {
  tab = b.dataset.tab;
  document.querySelectorAll('.tabs button').forEach((x) => x.classList.toggle('active', x === b));
  $('log').classList.toggle('hidden', tab !== 'log');
  $('chatWrap').classList.toggle('hidden', tab !== 'chat');
  if (S) renderLog();
});
$('chatForm').onsubmit = (e) => { e.preventDefault(); const t = $('chatInput').value.trim(); if (t) act('chat', { text: t }); $('chatInput').value = ''; };

// ---------- prozori ----------
let picker = null; // { title, count, cb, sel }
function openPicker(title, count, cb) { picker = { title, count, cb, sel: [] }; renderModal(); }

let discardSel = {};
function renderModal() {
  const modal = $('modal'), card = $('modalCard');
  let h = null;
  if (S.phase === 'ended') {
    const ranking = [...S.players].sort((a, b) => b.vp - a.vp);
    h = `<h3>🏆 ${esc(pById(S.winner).name)} je pobedio!</h3>
      ${ranking.map((p) => `<div class="row"><span class="dot" style="background:${p.color}"></span>${esc(p.name)} <b style="margin-left:auto">${p.vp} poena</b></div>`).join('')}
      <p><button class="primary big" onclick="location.href='/'">Nova igra</button></p>`;
  } else if (S.sub === 'discard' && S.pendingDiscard[S.me]) {
    const need = S.pendingDiscard[S.me];
    const sum = RES.reduce((s, r) => s + (discardSel[r] || 0), 0);
    h = `<h3>Razbojnik! Odbaci ${need} karata</h3><p class="muted">Izabrano: ${sum} / ${need}</p>
      <div class="pick">${RES.map((r) => `<div class="step"><button data-dinc="${r}">+</button><span>${RES_INFO[r].ico} ${discardSel[r] || 0}/${S.hand[r]}</span><button data-ddec="${r}">−</button></div>`).join('')}</div>
      <button class="primary big" data-dconfirm ${sum === need ? '' : 'disabled'}>Odbaci</button>`;
  } else if (S.sub === 'steal' && myTurn()) {
    h = `<h3>Od koga kradeš?</h3><div class="pick">${S.legal.victims.map((id) => { const p = pById(id); return `<button data-steal="${id}"><span class="dot" style="background:${p.color}"></span> ${esc(p.name)} (${p.cards} karata)</button>`; }).join('')}</div>`;
  } else if (picker) {
    h = `<h3>${esc(picker.title)}</h3><div class="pick">${RES.map((r) => `<button data-pick="${r}" title="${RES_INFO[r].name}">${RES_INFO[r].ico}</button>`).join('')}</div>
      <p>Izabrano: ${picker.sel.map((r) => RES_INFO[r].ico).join(' ') || '—'}</p>
      <div class="row"><button class="primary" data-pconfirm ${picker.sel.length === picker.count ? '' : 'disabled'}>Potvrdi</button><button data-pcancel>Otkaži</button></div>`;
  }
  if (S.sub !== 'discard') discardSel = {};
  modal.classList.toggle('hidden', !h);
  if (h) card.innerHTML = h;
}
$('modalCard').addEventListener('click', (ev) => {
  const b = ev.target.closest('button'); if (!b) return;
  if (b.dataset.dinc) { const r = b.dataset.dinc; if ((discardSel[r] || 0) < S.hand[r]) discardSel[r] = (discardSel[r] || 0) + 1; return renderModal(); }
  if (b.dataset.ddec) { const r = b.dataset.ddec; discardSel[r] = Math.max(0, (discardSel[r] || 0) - 1); return renderModal(); }
  if (b.hasAttribute('data-dconfirm')) { act('discard', { cards: discardSel }); discardSel = {}; return; }
  if (b.dataset.steal) return act('steal', { target: b.dataset.steal });
  if (b.dataset.pick) { if (picker.sel.length < picker.count) picker.sel.push(b.dataset.pick); else picker.sel = [b.dataset.pick]; return renderModal(); }
  if (b.hasAttribute('data-pconfirm')) { const p = picker; picker = null; p.cb(p.sel); return renderModal(); }
  if (b.hasAttribute('data-pcancel')) { picker = null; return renderModal(); }
});
