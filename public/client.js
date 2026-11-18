/* global io */
const socket = io();
const $ = (id) => document.getElementById(id);

const RES = ['drvo', 'glina', 'vuna', 'zito', 'kamen'];
const RES_INFO = {
  drvo: { name: 'Drvo', ico: '🌲', color: '#4f9a46' },
  glina: { name: 'Glina', ico: '🧱', color: '#d0734a' },
  vuna: { name: 'Vuna', ico: '🐑', color: '#9ccc5f' },
  zito: { name: 'Žito', ico: '🌾', color: '#eac04f' },
  kamen: { name: 'Kamen', ico: '🪨', color: '#a3a9b3' },
};
const TERRAIN = {
  suma: { a: '#5aa851', b: '#2f6e2c', ico: '🌲' },
  gliniste: { a: '#e08a5c', b: '#a8502a', ico: '🧱' },
  pasnjak: { a: '#b4dc72', b: '#6ea23d', ico: '🐑' },
  polje: { a: '#f3d672', b: '#cf9f22', ico: '🌾' },
  planina: { a: '#b8bdc6', b: '#6e737d', ico: '⛰️' },
  pustinja: { a: '#efe0b4', b: '#cdb57d', ico: '🌵' },
};
const DEV_INFO = {
  vitez: { name: 'Vitez', ico: '⚔️', desc: 'Pomeri razbojnika i ukradi kartu.' },
  bod: { name: 'Poen', ico: '⭐', desc: '+1 poen (računa se sam).' },
  putevi: { name: 'Putevi', ico: '🛠️', desc: 'Sagradi 2 puta besplatno.' },
  obilje: { name: 'Obilje', ico: '✨', desc: 'Uzmi 2 sirovine iz banke.' },
  monopol: { name: 'Monopol', ico: '💰', desc: 'Uzmi svim igračima jednu sirovinu.' },
};
const COST = {
  road: { drvo: 1, glina: 1 },
  settlement: { drvo: 1, glina: 1, vuna: 1, zito: 1 },
  city: { zito: 2, kamen: 3 },
  dev: { vuna: 1, zito: 1, kamen: 1 },
};
const MAPS = [
  { id: 'base', name: 'Osnovna', sub: '2–4 igrača', max: 4 },
  { id: 'ext6', name: 'Proširenje', sub: '5–6 igrača', max: 6 },
  { id: 'ext8', name: 'Veliko proširenje', sub: '7–8 igrača', max: 8 },
];
const MAP_NAME = { base: 'Osnovna', ext6: 'Proširenje 5–6', ext8: 'Proširenje 7–8' };
const TIMERS = [0, 30, 60, 90, 120, 180, 240];
const AVATARS = ['🦊', '🐻', '🦉', '🐢', '🦁', '🐺', '🐙', '🦌'];

let S = null; // stanje sa servera
let clockOffset = 0;
let mode = null; // 'road' | 'settlement' | 'city' | null
let tradeOpen = false;
let tradeGive = {}, tradeGet = {};
let chatOpen = false, seenChat = 0;
let lastTick = 0;
let lastToastSteal = 0, lastDiceKey = '';

// ---------- identitet ----------
function token() {
  let t = localStorage.getItem('ot_token');
  if (!t) { t = Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem('ot_token', t); }
  return t;
}
$('nameInput').value = localStorage.getItem('ot_name') || '';
$('nameInput').oninput = () => localStorage.setItem('ot_name', $('nameInput').value.trim());
function myName() {
  const n = $('nameInput').value.trim();
  if (!n) { $('nameInput').focus(); toast('Prvo upiši svoje ime (gore levo).'); return null; }
  localStorage.setItem('ot_name', n);
  return n;
}

function toast(msg) {
  const t = $('toast');
  t.textContent = msg; t.classList.remove('hidden');
  clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.add('hidden'), 3200);
}
function act(type, data = {}) {
  socket.emit('action', { type, data }, (r) => { if (r && !r.ok) { toast(r.error); SFX.play('error'); } });
}
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const COLOR_ORDER = ['#e05a47', '#3b82c4', '#f2b134', '#4caf6a', '#9b5fc0', '#26b5b0', '#e07ab8', '#8a5a3c'];
const avatarOf = (p) => AVATARS[Math.max(0, COLOR_ORDER.indexOf(p.color)) % AVATARS.length];

// ---------- navigacija ----------
document.addEventListener('click', (e) => {
  const n = e.target.closest('[data-nav]'); if (!n) return;
  if (n.dataset.nav === 'rules') showRules();
  if (n.dataset.nav === 'rooms' && S && S.phase === 'lobby') toast('Prvo izađi iz sobe (✕ gore desno).');
});

function showPage(page) {
  $('shell').classList.toggle('hidden', page === 'game');
  $('game').classList.toggle('hidden', page !== 'game');
  $('rooms').classList.toggle('hidden', page !== 'rooms');
  $('lobby').classList.toggle('hidden', page !== 'lobby');
}

// ---------- lista soba ----------
function seatIcons(n, max) {
  let h = '';
  for (let i = 0; i < max; i++) h += `<svg class="seat" viewBox="0 0 13 18"><circle cx="6.5" cy="4" r="3.5" fill="${i < n ? '#fff' : '#ffffff55'}"/><path d="M1 18 V11 Q1 8 6.5 8 Q12 8 12 11 V18Z" fill="${i < n ? '#fff' : '#ffffff55'}"/></svg>`;
  return h;
}
socket.on('rooms', (rooms) => {
  const rows = $('roomRows');
  if (!rooms.length) { rows.innerHTML = '<div class="rt-empty">Trenutno nema otvorenih soba. Napravi svoju i pozovi prijatelje!</div>'; return; }
  rows.innerHTML = rooms.map((r) => `<div class="rt-row" data-room="${r.code}" title="Igrači: ${esc(r.names.join(', '))}">
    <span>${r.settings.map === 'base' ? 'Osnovni' : 'Prošireni'}</span><span>${MAP_NAME[r.settings.map]}</span>
    <span>${r.settings.timer ? r.settings.timer + 's' : 'bez'}</span><span class="seats">${seatIcons(r.players, r.settings.maxPlayers)}</span></div>`).join('');
});
$('roomRows').addEventListener('click', (e) => { const r = e.target.closest('[data-room]'); if (r) join(r.dataset.room); });

function enter(code) {
  const url = new URL(location.href); url.search = '?soba=' + code;
  history.replaceState(null, '', url);
}
$('createBtn').onclick = () => {
  const name = myName(); if (!name) return;
  socket.emit('create', { name, token: token() }, (r) => (r.ok ? enter(r.code) : ($('homeError').textContent = r.error)));
};
function join(code) {
  const name = myName(); if (!name) return;
  socket.emit('join', { code, name, token: token() }, (r) => (r.ok ? enter(r.code) : toast(r.error)));
}
$('joinBtn').onclick = () => {
  if (!myName()) return;
  modalExtra = () => `<h3>Uđi u sobu</h3><p>Upiši kod sobe koji ti je prijatelj poslao (4 slova).</p>
    <input id="codeInput" maxlength="4" placeholder="KOD"><div class="row" style="margin-top:12px"><button class="ob" data-joincode>Uđi</button><button class="ob gray" data-close>Otkaži</button></div>`;
  renderModal(); setTimeout(() => $('codeInput')?.focus(), 50);
};

// poziv preko linka i povratak posle osvezavanja
const inviteCode = (new URLSearchParams(location.search).get('soba') || '').toUpperCase();
socket.on('connect', () => {
  const code = (S && S.code) || inviteCode;
  if (!code) return;
  socket.emit('join', { code, token: token(), rejoinOnly: true }, (r) => {
    if (r.ok || S) return;
    if (localStorage.getItem('ot_name')) join(code);
    else { $('nameInput').focus(); toast(`Upiši ime i klikni sobu ${code} ili „Uđi u sobu“.`); }
  });
});
socket.on('kicked', () => { S = null; modalExtra = null; showPage('rooms'); renderModal(); history.replaceState(null, '', '/'); SFX.play('kick'); toast('Izbačen si iz sobe.'); });

// ---------- prijem stanja ----------
// ---------- zvukovi prema dogadjajima iz dnevnika ----------
let seenLog = null, seenChatN = null;
function playEventSounds(prev) {
  const keys = S.log.map((l) => `${l.t}|${l.text}`);
  if (seenLog === null || !prev || prev.code !== S.code) { seenLog = new Set(keys); seenChatN = S.chat.length; return; }
  const fresh = S.log.filter((l, i) => !seenLog.has(keys[i]));
  keys.forEach((k) => seenLog.add(k));
  if (S.chat.length > seenChatN && S.chat[S.chat.length - 1].pid !== S.me) SFX.play('chat');
  seenChatN = S.chat.length;
  const myName = me()?.name;
  const DICE_MS = 900; // zvuk posle kockica ceka da se kockice zaustave
  let gains = 0, delay = 0;
  for (const l of fresh) {
    const t = l.text;
    if (t.startsWith('🎲')) { SFX.play('dice'); delay = DICE_MS; if (/bacio 7\./.test(t)) setTimeout(() => SFX.play('seven'), DICE_MS); }
    else if (t.startsWith('🛤️')) SFX.play('road');
    else if (t.startsWith('🏠')) SFX.play('settlement');
    else if (t.startsWith('🏰')) SFX.play('city');
    else if (t.startsWith('🃏')) SFX.play('devBuy');
    else if (t.startsWith('⚔️')) SFX.play('knight');
    else if (t.startsWith('✨') || t.startsWith('💰')) SFX.play('coins');
    else if (t.startsWith('🛠️')) SFX.play('devPlay');
    else if (t.startsWith('🦹')) SFX.play('robber');
    else if (t.includes('je ukrao kartu')) setTimeout(() => SFX.play('steal'), 250);
    else if (t.startsWith('🤝')) SFX.play('offer');
    else if (t.startsWith('✅')) SFX.play('tradeDone');
    else if (t.startsWith('🏦')) SFX.play('bank');
    else if (t.startsWith('🛣️') || t.startsWith('🛡️')) setTimeout(() => SFX.play('achieve'), 300);
    else if (t.startsWith('🏆')) setTimeout(() => SFX.play(S.winner === S.me ? 'win' : 'lose'), 400);
    else if (t.startsWith('➡️')) SFX.play(S.turn === S.me ? 'myTurn' : 'turn');
    else if (t.includes('je odbacio')) SFX.play('discard');
    else if (t.startsWith('🗳️')) SFX.play('vote');
    else if (t.startsWith('🥾')) SFX.play('kick');
    else if (t.startsWith('🚪') || t.startsWith('🛑')) SFX.play('leave');
    else if (myName && t.startsWith(myName + ' dobija')) gains += (t.match(/\d+/g) || []).reduce((a, n) => a + Number(n), 0) || t.split(',').length;
  }
  if (gains) setTimeout(() => SFX.play('gain', gains), delay);
  // postavljanje: kad je red na tebe
  if (S.phase === 'setup' && prev.turn !== S.turn && S.turn === S.me) SFX.play('myTurn');
}

socket.on('state', (state) => {
  const prev = S;
  S = state;
  playEventSounds(prev);
  clockOffset = S.now - Date.now();
  if (S.sub !== 'main' || S.turn !== S.me) { mode = null; }
  if (!(S.turn === S.me && S.sub === 'main')) tradeOpen = false;
  render();
});

const me = () => S.players.find((p) => p.id === S.me);
const pById = (id) => S.players.find((p) => p.id === id);
const myTurn = () => S.turn === S.me;
const canAfford = (cost) => RES.every((r) => S.hand[r] >= (cost[r] || 0));

function render() {
  if (!S) return showPage('rooms');
  if (S.phase === 'lobby') { showPage('lobby'); renderLobby(); renderChat(); renderModal(); return; }
  showPage('game');
  renderBoard(); renderDice(); renderHand(); renderStatus(); renderActions(); renderRecipes(); renderVote();
  renderPlayers(); renderBank(); renderOffers(); renderTradePanel(); renderLog(); renderChat(); renderModal();
}

// ---------- lobi ----------
function renderLobby() {
  const host = S.host === S.me;
  const st = S.settings;
  $('lobbyCode').textContent = S.code;
  $('lpCount').textContent = `${S.players.length}/${st.maxPlayers}`;
  const url = new URL(location.href); url.search = '?soba=' + S.code;
  $('inviteLink').value = url.toString();
  let h = S.players.map((p) => `<div class="lp-slot"><div class="avatar" style="background:${p.color}">${avatarOf(p)}</div>
    <div class="nm">${esc(p.name)}${p.id === S.me ? ' (ti)' : ''}<div class="sub">${p.id === S.host ? '👑 osnivač' : p.connected ? 'spreman' : 'van mreže'}</div></div>
    ${host && p.id !== S.me ? `<button class="kick" data-kick="${p.id}" title="Izbaci">✕</button>` : ''}</div>`).join('');
  for (let i = S.players.length; i < st.maxPlayers; i++) {
    h += `<div class="lp-slot empty"><span class="muted-light">Čeka se igrač…</span></div>`;
  }
  $('lobbyPlayers').innerHTML = h;

  $('mapTiles').innerHTML = MAPS.map((m) => `<button class="tile ${st.map === m.id ? 'sel' : ''}" data-map="${m.id}" ${host ? '' : 'disabled'}>
    <span class="ti">${'⬢'.repeat(m.max / 2)}</span>${m.name}<small>${m.sub}</small></button>`).join('');
  $('ruleTiles').innerHTML = `<button class="tile ${st.private ? 'sel' : ''}" data-private ${host ? '' : 'disabled'}><span class="ti">🕶️</span>Privatna igra<small>${st.private ? 'ne vidi se u listi' : 'vidi se u listi soba'}</small></button>
    <button class="tile ${st.hideBank ? 'sel' : ''}" data-hidebank ${host ? '' : 'disabled'}><span class="ti">🏦</span>Sakrij banku<small>${st.hideBank ? 'broj karata se ne vidi' : 'broj karata se vidi'}</small></button>`;
  const stepper = (key, label, value, canDec, canInc) => `<div class="adv-item"><b>${label}</b><div class="stepper">
    <button data-dec="${key}" ${host && canDec ? '' : 'disabled'}>‹</button><span>${value}</span><button data-inc="${key}" ${host && canInc ? '' : 'disabled'}>›</button></div></div>`;
  const ti = TIMERS.indexOf(st.timer);
  const mapMax = MAPS.find((m) => m.id === st.map).max;
  $('advSettings').innerHTML =
    stepper('timer', 'Tajmer poteza', st.timer ? `${st.timer}s` : 'Bez', ti > 0, ti < TIMERS.length - 1) +
    stepper('maxPlayers', 'Broj igrača', `${st.maxPlayers}/${mapMax}`, st.maxPlayers > Math.max(2, S.players.length), st.maxPlayers < mapMax) +
    stepper('vpToWin', 'Poeni za pobedu', st.vpToWin, st.vpToWin > 3, st.vpToWin < 20) +
    stepper('discardLimit', 'Limit karata (razbojnik)', st.discardLimit, st.discardLimit > 5, st.discardLimit < 20) +
    stepper('resCards', 'Karte sirovina (po vrsti)', st.resCards, st.resCards > 10, st.resCards < 50) +
    stepper('devCards', 'Razvojne karte (ukupno)', st.devCards, st.devCards > 10, st.devCards < 80);
  $('startBtn').classList.toggle('hidden', !host);
  $('startBtn').disabled = S.players.length < 2;
  $('lobbyWait').classList.toggle('hidden', host);
}
$('lobby').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b || b.disabled) return;
  const st = S.settings;
  if (b.dataset.map) act('settings', { map: b.dataset.map });
  else if (b.hasAttribute('data-private')) act('settings', { private: !st.private });
  else if (b.hasAttribute('data-hidebank')) act('settings', { hideBank: !st.hideBank });
  else if (b.dataset.kick) act('kick', { pid: b.dataset.kick });
  else if (b.dataset.inc || b.dataset.dec) {
    const key = b.dataset.inc || b.dataset.dec, d = b.dataset.inc ? 1 : -1;
    if (key === 'timer') act('settings', { timer: TIMERS[TIMERS.indexOf(st.timer) + d] });
    else act('settings', { [key]: st[key] + d });
  }
});
$('copyBtn').onclick = () => { $('inviteLink').select(); navigator.clipboard?.writeText($('inviteLink').value); toast('Link je kopiran. Pošalji ga prijateljima.'); };
$('startBtn').onclick = () => act('start');
function doLeave() { act('leave'); S = null; modalExtra = null; picker = null; tradeOpen = false; history.replaceState(null, '', '/'); showPage('rooms'); renderModal(); socket.emit('rooms'); }
$('leaveBtn').onclick = doLeave;

// ---------- tabla ----------
const SC = 62;
const TOKEN_SCALE = { base: 1, ext6: 1.2, ext8: 1.3 };
function hexPoints(hx, V, scale = 1) {
  return hx.corners.map((c) => `${(hx.x + (V[c].x - hx.x) * scale) * SC},${(hx.y + (V[c].y - hx.y) * scale) * SC}`).join(' ');
}
function renderBoard() {
  const svg = $('board');
  const B = S.board, V = B.vertices;
  const xs = [...V.map((v) => v.x), ...B.ports.map((p) => p.x)], ys = [...V.map((v) => v.y), ...B.ports.map((p) => p.y)];
  const pad = 0.55;
  const minX = Math.min(...xs) - pad, maxX = Math.max(...xs) + pad, minY = Math.min(...ys) - pad, maxY = Math.max(...ys) + pad;
  svg.setAttribute('viewBox', `${minX * SC} ${minY * SC} ${(maxX - minX) * SC} ${(maxY - minY) * SC}`);
  const L = (myTurn() && S.legal) || {};
  let h = '<defs>';
  for (const [k, t] of Object.entries(TERRAIN)) h += `<radialGradient id="g-${k}" cx="50%" cy="40%" r="65%"><stop offset="0" stop-color="${t.a}"/><stop offset="1" stop-color="${t.b}"/></radialGradient>`;
  h += '</defs>';

  // plicak i pesak oko ostrva
  for (const hx of B.hexes) h += `<polygon points="${hexPoints(hx, V, 1.32)}" fill="#3f9fb8" opacity=".55" stroke="#3f9fb8" stroke-width="10" stroke-linejoin="round"/>`;
  for (const hx of B.hexes) h += `<polygon points="${hexPoints(hx, V, 1.14)}" fill="#ecd9a2" stroke="#ecd9a2" stroke-width="6" stroke-linejoin="round"/>`;

  // luke (molovi)
  for (const p of B.ports) {
    const e = B.edges[p.edge];
    for (const v of [V[e.a], V[e.b]]) {
      h += `<line x1="${p.x * SC}" y1="${p.y * SC}" x2="${v.x * SC}" y2="${v.y * SC}" stroke="#7a5532" stroke-width="7" stroke-linecap="round"/>`;
      h += `<line x1="${p.x * SC}" y1="${p.y * SC}" x2="${v.x * SC}" y2="${v.y * SC}" stroke="#a87a4c" stroke-width="3" stroke-dasharray="3 5"/>`;
    }
  }

  // polja
  for (const hx of B.hexes) {
    const t = TERRAIN[hx.terrain];
    h += `<polygon points="${hexPoints(hx, V, 0.96)}" fill="url(#g-${hx.terrain})" stroke="#fff6dc" stroke-width="3" stroke-linejoin="round"/>`;
    h += `<text x="${hx.x * SC}" y="${hx.y * SC - (hx.num ? 12 * (TOKEN_SCALE[B.layout] || 1) : -10)}" text-anchor="middle" font-size="${hx.num ? 26 : 34}">${t.ico}</text>`;
    if (hx.num) {
      const hot = hx.num === 6 || hx.num === 8;
      const pips = 6 - Math.abs(7 - hx.num);
      const col = hot ? '#c0392b' : '#2a241c';
      const k = TOKEN_SCALE[B.layout] || 1; // na vecim mapama brojevi su veci
      const cx = hx.x * SC, top = hx.y * SC - 4 * k, w = 36 * k;
      h += `<rect x="${cx - w / 2}" y="${top}" width="${w}" height="${w}" rx="${7 * k}" fill="#fffaf0" stroke="#0003" stroke-width="1.5"/>`;
      h += `<text x="${cx}" y="${top + 22 * k}" text-anchor="middle" font-size="${20 * k}" font-weight="900" fill="${col}">${hx.num}</text>`;
      const pr = 2.4 * k, gap = 6 * k;
      for (let i = 0; i < pips; i++) h += `<circle cx="${cx + (i - (pips - 1) / 2) * gap}" cy="${top + 29.5 * k}" r="${pr}" fill="${col}"/>`;
    }
  }

  // oznake luka
  for (const p of B.ports) {
    const x = p.x * SC, y = p.y * SC;
    const generic = p.type === '3:1';
    const bg = generic ? '#2f7fb5' : RES_INFO[p.type].color;
    h += `<g><rect x="${x - 20}" y="${y - 24}" width="40" height="46" rx="8" fill="#fffaf0" stroke="#7a5532" stroke-width="2"/>
      <rect x="${x - 17}" y="${y - 21}" width="34" height="24" rx="5" fill="${bg}"/>
      <text x="${x}" y="${y - 3}" text-anchor="middle" font-size="16" fill="#fff" font-weight="800">${generic ? '?' : RES_INFO[p.type].ico}</text>
      <text x="${x}" y="${y + 17}" text-anchor="middle" font-size="12" font-weight="800" fill="#2a241c">${generic ? '3:1' : '2:1'}</text></g>`;
  }

  // razbojnik
  const rb = B.hexes[B.robber];
  h += `<g transform="translate(${rb.x * SC + 26},${rb.y * SC + 4})"><ellipse cx="0" cy="18" rx="12" ry="4" fill="#0006"/>
    <path d="M-10 17 Q-12 -2 0 -5 Q12 -2 10 17 Z" fill="#3a3640" stroke="#111" stroke-width="1.5"/><circle cx="0" cy="-10" r="8" fill="#3a3640" stroke="#111" stroke-width="1.5"/></g>`;

  // putevi: spajaju se teme u teme; prvo sve ivice, pa boje, da se spojevi ne seku
  const roadLines = Object.entries(S.roads).map(([eid, pid]) => {
    const e = B.edges[eid]; const a = V[e.a], b = V[e.b];
    return { x1: a.x * SC, y1: a.y * SC, x2: b.x * SC, y2: b.y * SC, col: pById(pid).color };
  });
  for (const r of roadLines) h += `<line x1="${r.x1}" y1="${r.y1}" x2="${r.x2}" y2="${r.y2}" stroke="#1b1712" stroke-width="12" stroke-linecap="round"/>`;
  for (const r of roadLines) h += `<line x1="${r.x1}" y1="${r.y1}" x2="${r.x2}" y2="${r.y2}" stroke="${r.col}" stroke-width="7.5" stroke-linecap="round"/>`;
  // gradnja: kad imas sirovine i postoji mesto, mesta se sama oznace na tabli
  const mainNow = myTurn() && S.sub === 'main' && S.phase === 'play';
  const mm = me();
  const can = {
    road: mainNow && canAfford(COST.road) && mm.left.road > 0 && L.roads?.length > 0,
    settlement: mainNow && canAfford(COST.settlement) && mm.left.settlement > 0 && L.settlements?.length > 0,
    city: mainNow && canAfford(COST.city) && mm.left.city > 0 && L.cities?.length > 0,
  };
  const showRoads = L.roads && (S.sub === 'road' || S.sub === 'roadBuilding' || mode === 'road' || (!mode && !tradeOpen && can.road));
  if (showRoads) for (const eid of L.roads) {
    const e = B.edges[eid]; const a = V[e.a], b = V[e.b];
    const sx = a.x + (b.x - a.x) * 0.22, sy = a.y + (b.y - a.y) * 0.22, ex = a.x + (b.x - a.x) * 0.78, ey = a.y + (b.y - a.y) * 0.78;
    h += `<circle class="spot road-spot" data-e="${eid}" cx="${(sx + ex) / 2 * SC}" cy="${(sy + ey) / 2 * SC}" r="10"/>`;
  }

  // gradjevine
  for (const [vid, b] of Object.entries(S.buildings)) {
    const v = V[vid]; const col = pById(b.pid).color;
    const x = v.x * SC, y = v.y * SC;
    if (b.type === 'settlement') h += `<path d="M${x - 11} ${y + 10} V${y - 2} L${x} ${y - 13} L${x + 11} ${y - 2} V${y + 10} Z" fill="${col}" stroke="#1b1712" stroke-width="2.5" stroke-linejoin="round"/><path d="M${x - 11} ${y - 2} L${x} ${y - 13} L${x + 11} ${y - 2}" fill="none" stroke="#fff8" stroke-width="2"/>`;
    else h += `<path d="M${x - 16} ${y + 12} V${y - 4} H${x - 4} V${y - 9} L${x + 5} ${y - 18} L${x + 14} ${y - 9} V${y + 12} Z" fill="${col}" stroke="#1b1712" stroke-width="2.5" stroke-linejoin="round"/><rect x="${x - 11}" y="${y + 1}" width="5" height="6" fill="#1b1712" opacity=".55"/><rect x="${x + 3}" y="${y - 4}" width="5" height="6" fill="#1b1712" opacity=".55"/>`;
    if (L.cities && (mode === 'city' || (!mode && !tradeOpen && can.city)) && L.cities.includes(Number(vid))) h += `<circle class="spot" data-v="${vid}" data-kind="city" cx="${x}" cy="${y}" r="17" fill-opacity=".35"/>`;
  }
  const showSett = L.settlements && (S.sub === 'settlement' || mode === 'settlement' || (!mode && !tradeOpen && can.settlement));
  if (showSett) for (const vid of L.settlements) h += `<circle class="spot" data-v="${vid}" data-kind="settlement" cx="${V[vid].x * SC}" cy="${V[vid].y * SC}" r="10"/>`;
  const sum = S.dice ? S.dice[0] + S.dice[1] : 0;
  if (sum && sum !== 7 && S.phase === 'play' && S.sub !== 'roll') for (const hx of B.hexes) {
    if (hx.num === sum) h += `<polygon class="hex-hit ${hx.id === B.robber ? 'blocked' : ''}" points="${hexPoints(hx, V, 0.96)}"/>`;
  }
  if (L.robber && S.sub === 'robber') for (const hid of L.robber) h += `<polygon class="hex-target" data-hex="${hid}" points="${hexPoints(B.hexes[hid], V, 0.96)}"/>`;

  svg.innerHTML = h;
}
$('board').addEventListener('click', (ev) => {
  const t = ev.target;
  if (t.dataset.e !== undefined) { act('placeRoad', { e: t.dataset.e }); if (S.sub === 'main') mode = null; }
  else if (t.dataset.kind === 'settlement') { act('placeSettlement', { v: t.dataset.v }); mode = null; }
  else if (t.dataset.kind === 'city') { act('placeCity', { v: t.dataset.v }); mode = null; }
  else if (t.dataset.hex !== undefined) act('moveRobber', { hex: t.dataset.hex });
});
// Precice na tastaturi
const KEYS = { e: 'end', t: 'trade', p: 'road', s: 'settlement', g: 'city', k: 'dev' };
document.addEventListener('keydown', (e) => {
  if (e.target.matches('input, textarea, select') || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === 'Escape') { mode = null; tradeOpen = false; if (S) render(); return; }
  if (!S || (S.phase !== 'play' && S.phase !== 'setup')) return;
  if (e.code === 'Space') { e.preventDefault(); if (myTurn() && S.sub === 'roll') act('roll'); return; }
  const a = KEYS[e.key.toLowerCase()];
  if (a) { const b = document.querySelector(`#actions [data-a="${a}"]`); if (b && !b.disabled) b.click(); }
});

// ---------- kockice ----------
const PIP_POS = { 1: [[50, 50]], 2: [[28, 28], [72, 72]], 3: [[26, 26], [50, 50], [74, 74]], 4: [[28, 28], [72, 28], [28, 72], [72, 72]], 5: [[26, 26], [74, 26], [50, 50], [26, 74], [74, 74]], 6: [[28, 24], [72, 24], [28, 50], [72, 50], [28, 76], [72, 76]] };
let diceRolling = false;
const dieHTML = (n, cls = '', style = '') => `<div class="die ${cls}" style="${style}">${n ? PIP_POS[n].map(([x, y]) => `<i style="left:${x}%;top:${y}%"></i>`).join('') : ''}</div>`;
function renderDice() {
  const d = S.dice;
  const key = d ? `${S.turnNum}-${d}` : '';
  $('dice').style.cursor = myTurn() && S.sub === 'roll' ? 'pointer' : '';
  if (key && key !== lastDiceKey && lastDiceKey !== '') {
    // nova bacanja: kockice se kotrljaju ~0.85s pa padnu na pravi broj
    lastDiceKey = key;
    diceRolling = true;
    const start = performance.now();
    const step = () => {
      const t = performance.now() - start;
      if (t < 850) {
        const r = () => 1 + Math.floor(Math.random() * 6);
        $('dice').innerHTML = [0, 1].map((i) => dieHTML(r(), 'tumble', `transform: translate(${(Math.random() - 0.5) * 30}px, ${-Math.abs(Math.sin(t / 110 + i)) * 40}px) rotate(${Math.random() * 360}deg) scale(${0.85 + Math.random() * 0.2})`)).join('');
        setTimeout(step, 70);
      } else {
        diceRolling = false;
        $('dice').innerHTML = d.map((n) => dieHTML(n, 'land')).join('');
      }
    };
    step();
    return;
  }
  if (lastDiceKey === '') lastDiceKey = key || '-';
  if (diceRolling) return;
  if (key) lastDiceKey = key;
  $('dice').innerHTML = d ? d.map((n) => dieHTML(n)).join('') : [6, 6].map((n) => dieHTML(n, 'idle')).join('');
}
$('dice').onclick = () => { if (myTurn() && S.sub === 'roll') act('roll'); };

// ---------- ruka ----------
const rcard = (r, n, extra = '') => `<div class="rcard ${extra}" data-r="${r}" style="background-color:${RES_INFO[r].color}" title="${RES_INFO[r].name}">${RES_INFO[r].ico}${n !== null ? `<span class="cnt">${n}</span>` : ''}</div>`;
function renderHand() {
  let h = RES.filter((r) => S.hand[r] > 0).map((r) => rcard(r, S.hand[r] - (tradeOpen ? tradeGive[r] || 0 : 0), tradeOpen ? 'click' : '')).join('');
  if (!h) h = '<span style="color:var(--muted)">Nemaš karte sirovina.</span>';
  else if (myTurn() && S.sub === 'main') h = h.replace(/class="rcard /g, 'class="rcard click ');
  const groups = {};
  for (const d of S.dev) { groups[d.type] ??= { n: 0, ready: 0 }; groups[d.type].n++; if (!d.fresh) groups[d.type].ready++; }
  const dev = Object.entries(groups).map(([type, g]) => `<div class="rcard dev ${g.ready ? '' : 'fresh'}" data-dev="${type}" title="${DEV_INFO[type].name}: ${DEV_INFO[type].desc}${g.ready ? '' : ' (kupljena u ovom potezu)'}">${DEV_INFO[type].ico}<small>${DEV_INFO[type].name}</small><span class="cnt">${g.n}</span></div>`).join('');
  if (dev) h += '<span class="sep"></span>' + dev;
  $('hand').innerHTML = h;
}
$('hand').addEventListener('click', (ev) => {
  const c = ev.target.closest('[data-dev]');
  if (c) {
    const type = c.dataset.dev;
    if (type === 'bod') return toast('Poen se računa automatski.');
    if (type === 'obilje') return openPicker('Obilje: izaberi 2 sirovine iz banke', 2, (sel) => act('playDev', { card: 'obilje', res: sel[0], res2: sel[1] }));
    if (type === 'monopol') return openPicker('Monopol: koju sirovinu uzimaš od svih?', 1, (sel) => act('playDev', { card: 'monopol', res: sel[0] }));
    return act('playDev', { card: type });
  }
  const r = ev.target.closest('[data-r]');
  if (!r) return;
  if (!(myTurn() && S.sub === 'main')) return toast('Trgovati možeš kad si na potezu, posle bacanja kockica.');
  tradeOpen = true; mode = null; tradeGive = {}; tradeGet = {};
  tradeGive[r.dataset.r] = 1;
  render();
});

// ---------- status, tajmer i dugmad ----------
function renderStatus() {
  const cur = pById(S.turn);
  const who = cur.name;
  let txt;
  let click = false;
  if (S.phase === 'ended') txt = S.winner ? `🏆 ${pById(S.winner).name} je pobedio!` : '🛑 Igra je prekinuta';
  else if (S.sub === 'settlement') txt = myTurn() ? 'Postavi selo' : `${who} postavlja selo`;
  else if (S.sub === 'road') txt = myTurn() ? 'Postavi put' : `${who} postavlja put`;
  else if (S.sub === 'roll') { txt = myTurn() ? '🎲 Baci kockice' : `${who} baca kockice`; click = myTurn(); }
  else if (S.sub === 'discard') txt = S.pendingDiscard[S.me] ? `Odbaci ${S.pendingDiscard[S.me]} karata` : 'Čeka se odbacivanje';
  else if (S.sub === 'robber') txt = myTurn() ? 'Pomeri razbojnika' : `${who} pomera razbojnika`;
  else if (S.sub === 'steal') txt = myTurn() ? 'Izaberi od koga kradeš' : `${who} krade kartu`;
  else if (S.sub === 'roadBuilding') txt = myTurn() ? `Postavi besplatan put (${S.freeRoads})` : `${who} gradi puteve`;
  else txt = myTurn() ? (mode ? `Izaberi mesto (Esc za otkaz)` : 'Tvoj red') : `Na potezu: ${who}`;
  const st = $('status');
  st.className = 'status' + (click ? ' click' : '');
  st.innerHTML = `<div class="avatar" style="background:${cur.color};width:32px;height:32px;font-size:16px;border-width:2px">${avatarOf(cur)}</div><span>${esc(txt)}</span>`;
}
$('status').onclick = () => { if (S && myTurn() && S.sub === 'roll') act('roll'); };

setInterval(() => {
  if (!S || S.phase === 'lobby') return;
  const t = $('timer');
  if (!S.deadline || S.phase === 'ended') { t.textContent = S.settings.timer ? '--:--' : '∞'; t.classList.remove('low'); return; }
  const left = Math.max(0, Math.ceil((S.deadline - (Date.now() + clockOffset)) / 1000));
  t.textContent = `${String(Math.floor(left / 60)).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}`;
  t.classList.toggle('low', left <= 10);
  if (left <= 5 && left > 0 && left !== lastTick && myTurn()) { lastTick = left; SFX.play('tick'); }
  if (S.vote && $('voteLeft')) $('voteLeft').textContent = `${Math.max(0, Math.ceil((S.vote.until - (Date.now() + clockOffset)) / 1000))}s`;
}, 250);

function renderActions() {
  const m = me();
  const main = myTurn() && S.sub === 'main' && S.phase === 'play';
  const L = S.legal || {};
  // dugme je ukljuceno samo ako imas sirovine I postoji mesto na tabli
  const why = (cost, left, spots, what) => !main ? '' : !canAfford(cost) ? 'Nemaš dovoljno sirovina' : left <= 0 ? `Nemaš više: ${what}` : spots === 0 ? `Nema slobodnog mesta za ${what}` : '';
  const b = (a, ico, label, enabled, cnt, extra = '', reason = '') => `<button class="act ${extra} ${mode === a || (a === 'trade' && tradeOpen) ? 'on' : ''}" data-a="${a}" ${enabled ? '' : 'disabled'} title="${label}${reason ? ' – ' + reason : ''}">${ico}<small>${label}</small>${cnt !== undefined ? `<span class="cnt">${cnt}</span>` : ''}</button>`;
  const rs = L.roads?.length ?? 0, ss = L.settlements?.length ?? 0, cs = L.cities?.length ?? 0;
  $('actions').innerHTML =
    b('trade', '🤝', 'Trgovina', main) +
    b('dev', '🃏', 'Karta', main && canAfford(COST.dev) && !S.devEmpty, S.devLeft ?? '?', '', main && S.devEmpty ? 'Nema više karata' : '') +
    b('road', '🛤️', 'Put', main && canAfford(COST.road) && m.left.road > 0 && rs > 0, m.left.road, '', why(COST.road, m.left.road, rs, 'put')) +
    b('settlement', '🏠', 'Selo', main && canAfford(COST.settlement) && m.left.settlement > 0 && ss > 0, m.left.settlement, '', why(COST.settlement, m.left.settlement, ss, 'selo')) +
    b('city', '🏰', 'Grad', main && canAfford(COST.city) && m.left.city > 0 && cs > 0, m.left.city, '', why(COST.city, m.left.city, cs, 'grad')) +
    b('end', '⏩', 'Kraj poteza', myTurn() && (S.sub === 'main' || S.sub === 'roadBuilding'), undefined, 'end');
}

// ---------- recepti (cene gradnje) ----------
let recipesOpen = true;
try { recipesOpen = localStorage.getItem('ot_recipes') !== '0'; } catch (_) { /* */ }
function renderRecipes() {
  const rows = [
    ['🛤️', 'Put', COST.road, '0 poena'],
    ['🏠', 'Selo', COST.settlement, '1 poen'],
    ['🏰', 'Grad', COST.city, '2 poena'],
    ['🃏', 'Razvojna karta', COST.dev, '?'],
  ];
  const cards = (c) => Object.entries(c).flatMap(([r, n]) => Array(n).fill(r)).map((r) => `<span class="rc" style="background:${RES_INFO[r].color}" title="${RES_INFO[r].name}">${RES_INFO[r].ico}</span>`).join('');
  $('recipes').innerHTML = `<button class="rec-head" data-rec>📜 Recepti <span>${recipesOpen ? '▾' : '▸'}</span></button>` + (recipesOpen ? rows.map(([ico, name, cost, vp]) =>
    `<div class="rec-row ${S.hand && canAfford(cost) ? 'ok' : ''}"><span class="rn">${ico} ${name}</span><span class="rcs">${cards(cost)}</span><span class="rvp">${vp}</span></div>`).join('') : '');
}
$('recipes').addEventListener('click', (e) => { if (e.target.closest('[data-rec]')) { recipesOpen = !recipesOpen; try { localStorage.setItem('ot_recipes', recipesOpen ? '1' : '0'); } catch (_) { /* */ } renderRecipes(); } });

// ---------- glasanje za izbacivanje ----------
function renderVote() {
  const bar = $('voteBar'), v = S.vote;
  if (!v || (S.phase !== 'play' && S.phase !== 'setup')) { bar.classList.add('hidden'); return; }
  const t = pById(v.target), by = pById(v.by);
  const voted = v.yes.includes(S.me) ? 'da' : v.no.includes(S.me) ? 'ne' : null;
  const left = Math.max(0, Math.ceil((v.until - (Date.now() + clockOffset)) / 1000));
  bar.classList.remove('hidden');
  bar.innerHTML = `<span>🗳️ <b>${esc(by.name)}</b> predlaže da se izbaci <b style="color:${t.color}">${esc(t.name)}</b></span>
    <span class="vcount">✔ ${v.yes.length} · ✕ ${v.no.length} od ${v.voters} · <span id="voteLeft">${left}s</span></span>
    ${v.target === S.me ? '<span>Ti ne glasaš.</span>' : `<button class="ob ${voted === 'da' ? '' : 'gray'}" data-vote="1">Da, izbaci</button><button class="ob ${voted === 'ne' ? 'red' : 'gray'}" data-vote="0">Ne</button>`}`;
}
$('voteBar').addEventListener('click', (e) => { const b = e.target.closest('[data-vote]'); if (b) act('vote', { yes: b.dataset.vote === '1' }); });
$('players').addEventListener('click', (e) => {
  const b = e.target.closest('[data-votekick]'); if (!b) return;
  const p = pById(b.dataset.votekick);
  modalExtra = () => `<h3>🥾 Izbaci igrača ${esc(p.name)}?</h3><p>Pokrenućeš glasanje. Ako se većina ostalih igrača složi u roku od 60 sekundi, ${esc(p.name)} se izbacuje. Njegove figure ostaju na tabli, a potezi mu se preskaču.</p>
    <div class="row"><button class="ob red" data-startvote="${p.id}">Pokreni glasanje</button><button class="ob gray" data-close>Otkaži</button></div>`;
  renderModal();
});

$('actions').addEventListener('click', (ev) => {
  const b = ev.target.closest('button'); if (!b || b.disabled) return;
  const a = b.dataset.a;
  if (a === 'end') act('endTurn');
  else if (a === 'dev') act('buyDev');
  else if (a === 'trade') { tradeOpen = !tradeOpen; mode = null; tradeGive = {}; tradeGet = {}; render(); }
  else { mode = mode === a ? null : a; tradeOpen = false; render(); }
});

// ---------- igraci i banka ----------
function playerPanel(p, big = false) {
  return `<div class="pp ${p.id === S.turn ? 'turn' : ''} ${big ? 'big' : ''}">
    <div class="who"><div class="avatar" style="background:${p.color}">${avatarOf(p)}</div><span class="vpb" title="Poeni">${p.vp}</span></div>
    <div><div class="pname">${esc(p.name)} ${p.kicked ? '<span class="off">izbačen</span>' : p.quit ? '<span class="off">napustio</span>' : p.connected ? '' : '<span class="off">van mreže</span>'}${!big && !p.kicked && !S.vote && (S.phase === 'play' || S.phase === 'setup') && !me().quit ? `<button class="vk" data-votekick="${p.id}" title="Glasanje za izbacivanje">🥾</button>` : ''}</div>
    <div class="stats">
      <span class="st" title="Karte sirovina"><span class="i">🂠</span>${p.cards}</span>
      <span class="st" title="Razvojne karte"><span class="i">🃏</span>${p.devCards}</span>
      <span class="st ${p.largest ? 'won' : ''}" title="Odigrani vitezovi${p.largest ? ' – najveća vojska (+2)' : ''}"><span class="i">⚔️</span>${p.knights}</span>
      <span class="st ${p.longest ? 'won' : ''}" title="Najduži put${p.longest ? ' (+2)' : ''}"><span class="i">🛤️</span>${p.roadLen}</span>
    </div></div></div>`;
}
function renderPlayers() {
  const others = S.players.filter((p) => p.id !== S.me);
  $('players').classList.toggle('compact', S.players.length > 4);
  $('players').innerHTML = others.map((p) => playerPanel(p)).join('');
  $('mePanel').innerHTML = playerPanel(me(), true);
}
function renderBank() {
  const hidden = !S.bank;
  $('bank').innerHTML = `<span class="lbl" title="Banka${hidden ? ' (sakrivena)' : ''}">🏦</span>` + RES.map((r) => rcard(r, hidden ? '?' : S.bank[r], 'small')).join('') +
    `<div class="rcard small dev" title="Razvojne karte u špilu">🃏<span class="cnt">${hidden ? '?' : S.devLeft}</span></div>`;
}

// ---------- trgovina ----------
const miniCards = (o) => `<span class="mini">${Object.entries(o).map(([r, n]) => rcard(r, n)).join('')}</span>`;
function renderOffers() {
  const t = S.trade;
  const box = $('offers');
  if (!t || S.phase !== 'play') { box.classList.add('hidden'); return; }
  const from = pById(t.from);
  let h = `<div class="offer"><div class="offer-row"><b>${esc(from.name)}</b> daje ${miniCards(t.give)} za ${miniCards(t.get)}</div>`;
  if (t.from === S.me) {
    h += '<div class="offer-row" style="margin-top:8px">';
    h += t.accepted.map((id) => `<button class="ob" data-with="${id}">✔ ${esc(pById(id).name)}</button>`).join('');
    if (!t.accepted.length) h += '<span style="color:var(--muted)">Čeka se odgovor…</span>';
    if (t.declined.length) h += `<span style="color:var(--muted)">Odbili: ${t.declined.map((id) => esc(pById(id).name)).join(', ')}</span>`;
    h += '<button class="ob gray" data-tr="cancel" style="margin-left:auto">Povuci</button></div>';
  } else {
    const mine = t.accepted.includes(S.me) ? '✔ prihvatio si' : t.declined.includes(S.me) ? '✕ odbio si' : '';
    h += `<div class="offer-row" style="margin-top:8px"><button class="ob" data-tr="accept">Prihvati</button><button class="ob red" data-tr="decline">Odbij</button><span style="color:var(--muted)">${mine}</span></div>`;
  }
  h += '</div>';
  box.innerHTML = h;
  box.classList.toggle('hidden', tradeOpen);
}
function bankTradeValid() {
  const give = Object.keys(tradeGive), get = Object.keys(tradeGet);
  return give.length === 1 && get.length === 1 && tradeGet[get[0]] === 1 && tradeGive[give[0]] === S.rates[give[0]] && give[0] !== get[0];
}
function renderTradePanel() {
  const p = $('tradePanel');
  $('hand').classList.toggle('invisible', tradeOpen);
  if (!tradeOpen) { p.classList.add('hidden'); return; }
  p.classList.remove('hidden');
  const m = me();
  const getCards = RES.filter((r) => tradeGet[r]).map((r) => rcard(r, tradeGet[r], 'click')).join('') || '<span class="tp-hint">Klikni sirovinu gore koju želiš da dobiješ</span>';
  const giveCards = RES.filter((r) => tradeGive[r]).map((r) => rcard(r, tradeGive[r], 'click')).join('') || '<span class="tp-hint">Klikni svoju kartu dole koju daješ</span>';
  const handCards = RES.filter((r) => S.hand[r] - (tradeGive[r] || 0) > 0).map((r) => rcard(r, S.hand[r] - (tradeGive[r] || 0), 'click')).join('') || '<span class="tp-hint">Nema više karata</span>';
  const canOffer = Object.keys(tradeGive).length && Object.keys(tradeGet).length;
  p.innerHTML = `<div class="tp-main">
      <div class="tp-box" data-row="pickget">${RES.map((r) => `<div class="tp-pick">${rcard(r, null, 'click')}<span class="rate" title="Banka: daješ ${S.rates[r]} za 1">${S.rates[r]}:1</span></div>`).join('')}<span class="tp-bankico" title="Sirovine iz banke">🏦</span></div>
      <div class="tp-box tp-mid">
        <div class="tp-line"><span class="tp-ico" title="Dobijaš">👥<b class="down">⬇</b></span><div class="tp-cards" data-row="get">${getCards}</div></div>
        <div class="tp-line"><span class="tp-ico" title="Daješ"><span class="avatar" style="background:${m.color};width:34px;height:34px;font-size:16px;border-width:2px">${avatarOf(m)}</span><b class="up">⬆</b></span><div class="tp-cards" data-row="give">${giveCards}</div></div>
      </div>
      <div class="tp-box" data-row="hand">${handCards}</div>
    </div>
    <div class="tp-side">
      <button class="tbig" data-tr="bank" ${bankTradeValid() ? '' : 'disabled'} title="Trguj sa bankom">🏦<small>Banka</small></button>
      <button class="tbig" data-tr="offer" ${canOffer ? '' : 'disabled'} title="Ponudi igračima">👥<small>Igračima</small></button>
      <button class="tbig close" data-tr="close" title="Zatvori (Esc)">✕</button>
    </div>`;
}
function onTradeClick(ev) {
  const b = ev.target.closest('button');
  const card = ev.target.closest('[data-r]');
  const row = ev.target.closest('[data-row]');
  if (card && row) {
    const r = card.dataset.r;
    if (row.dataset.row === 'give') { tradeGive[r]--; if (!tradeGive[r]) delete tradeGive[r]; }
    if (row.dataset.row === 'get') { tradeGet[r]--; if (!tradeGet[r]) delete tradeGet[r]; }
    if (row.dataset.row === 'pickget') tradeGet[r] = (tradeGet[r] || 0) + 1;
    if (row.dataset.row === 'hand' && (tradeGive[r] || 0) < S.hand[r]) tradeGive[r] = (tradeGive[r] || 0) + 1;
    return render();
  }
  if (!b) return;
  if (b.dataset.with) return act('confirmTrade', { with: b.dataset.with });
  const a = b.dataset.tr;
  if (a === 'accept') act('respondTrade', { accept: true });
  if (a === 'decline') act('respondTrade', { accept: false });
  if (a === 'cancel') act('cancelTrade');
  if (a === 'close') { tradeOpen = false; render(); }
  if (a === 'offer') { act('offerTrade', { give: tradeGive, get: tradeGet }); tradeGive = {}; tradeGet = {}; tradeOpen = false; render(); }
  if (a === 'bank') {
    if (!bankTradeValid()) return toast('Za banku: daj jednu vrstu sirovine (broj piše na kartici gore) i traži 1 kartu.');
    act('bankTrade', { give: Object.keys(tradeGive)[0], get: Object.keys(tradeGet)[0] });
    tradeGive = {}; tradeGet = {}; tradeOpen = false;
  }
}
$('tradePanel').addEventListener('click', onTradeClick);
$('offers').addEventListener('click', onTradeClick);

// ---------- dnevnik i caskanje ----------
function colorNames(text) {
  // jedan prolaz kroz tekst, da se ime (npr. "a") ne bi menjalo unutar vec obojenog dela
  const names = [...S.players].sort((a, b) => b.name.length - a.name.length);
  if (!names.length) return esc(text);
  const re = new RegExp(names.map((p) => p.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g');
  let out = '', last = 0, m;
  while ((m = re.exec(text))) {
    if (!m[0]) { re.lastIndex++; continue; }
    const before = text[m.index - 1], after = text[m.index + m[0].length];
    const isWord = (c) => c && /[\p{L}\p{N}_]/u.test(c);
    if (isWord(before) || isWord(after)) continue; // samo cela rec
    const p = names.find((x) => x.name === m[0]);
    out += esc(text.slice(last, m.index)) + `<b style="color:${p.color};text-shadow:0 0 1px #0006">${esc(m[0])}</b>`;
    last = m.index + m[0].length;
  }
  return out + esc(text.slice(last));
}
function renderLog() {
  const log = $('log');
  const atBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 60;
  log.innerHTML = S.log.map((l) => `<div class="${l.text.startsWith('➡️') ? 'grp' : ''}">${colorNames(l.text)}</div>`).join('');
  if (atBottom) log.scrollTop = log.scrollHeight;
  if (S.lastSteal && S.lastSteal.t > lastToastSteal) {
    lastToastSteal = S.lastSteal.t;
    const r = RES_INFO[S.lastSteal.res];
    toast(S.lastSteal.thief === S.me ? `Ukrao si: ${r.ico} ${r.name}` : `${pById(S.lastSteal.thief).name} ti je ukrao: ${r.ico} ${r.name}`);
  }
}
function renderChat() {
  const html = S.chat.map((c) => `<div><b style="color:${c.color};text-shadow:0 0 1px #0008">${esc(c.name)}:</b> ${esc(c.text)}</div>`).join('') || '<div style="opacity:.6">Još nema poruka.</div>';
  for (const el of [$('chat'), $('lobbyChat')]) { el.innerHTML = html; el.scrollTop = el.scrollHeight; }
  if (chatOpen || S.phase === 'lobby') seenChat = S.chat.length;
  const unread = S.chat.length - seenChat;
  $('chatBadge').textContent = unread > 0 ? unread : '';
}
$('chatToggle').onclick = () => {
  chatOpen = !chatOpen;
  $('chatBody').classList.toggle('hidden', !chatOpen);
  $('chatToggle').querySelector('.chev').textContent = chatOpen ? '▾' : '▴';
  if (S) renderChat();
};
document.querySelectorAll('[data-chat]').forEach((f) => f.onsubmit = (e) => {
  e.preventDefault();
  const inp = f.querySelector('input'); const t = inp.value.trim();
  inp.value = '';
  if (!t) return;
  if (t.startsWith('/')) return chatCommand(t.slice(1).toLowerCase().split(/\s+/)[0]);
  act('chat', { text: t });
});
function chatCommand(cmd) {
  if (['izlaz', 'izadji', 'leave', 'quit'].includes(cmd)) return doLeave();
  if (['kraj', 'prekini', 'end'].includes(cmd)) {
    if (S.host !== S.me) return toast('Samo osnivač sobe može da prekine igru.');
    return act('endGame');
  }
  toast('Komande: /izlaz (napusti igru), /kraj (osnivač prekida igru za sve)');
}
function showExitMenu() {
  const host = S.host === S.me && S.phase !== 'ended';
  modalExtra = () => `<h3>🚪 Izlaz</h3><p>Ako napustiš igru, tvoje figure ostaju na tabli, a igra će umesto tebe završavati poteze. Možeš da se vratiš preko linka sobe.</p>
    <div class="row" style="flex-wrap:wrap"><button class="ob red" data-exit>Napusti igru</button>${host ? '<button class="ob red" data-endgame>Prekini igru za sve</button>' : ''}<button class="ob gray" data-close>Otkaži</button></div>
    <p style="font-size:13px;color:var(--muted)">U ćaskanju možeš da kucaš i /izlaz ili /kraj.</p>`;
  renderModal();
}
$('exitBtn').onclick = showExitMenu;
const soundIcon = () => { $('soundBtn').textContent = SFX.muted ? '🔇' : '🔊'; $('soundBtn').title = SFX.muted ? 'Uključi zvuk' : 'Isključi zvuk'; };
$('soundBtn').onclick = () => { SFX.toggle(); soundIcon(); };
soundIcon();
$('fsBtn').onclick = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.());

// ---------- prozori ----------
let picker = null;
let modalExtra = null;
function openPicker(title, count, cb) { picker = { title, count, cb, sel: [] }; renderModal(); }
let discardSel = {};
function showRules() {
  modalExtra = () => `<div class="rules"><h3>📖 Kako se igra</h3>
    <p>Cilj: prvi skupi dovoljno poena (obično 10).</p>
    <h4>Poeni</h4><ul><li>Selo 1 poen, grad 2 poena</li><li>Najduži put (bar 5 puteva) +2</li><li>Najveća vojska (bar 3 viteza) +2</li><li>Karta „Poen“ +1</li></ul>
    <h4>Tok poteza</h4><ul><li>Baci kockice: svako polje sa tim brojem daje sirovine selima (1) i gradovima (2) oko njega.</li><li>Trguj sa igračima ili bankom (4:1, a sa lukom 3:1 ili 2:1).</li><li>Gradi i završi potez.</li></ul>
    <h4>Cene</h4><ul><li>Put: 🌲🧱</li><li>Selo: 🌲🧱🐑🌾</li><li>Grad: 🌾🌾🪨🪨🪨</li><li>Razvojna karta: 🐑🌾🪨</li></ul>
    <h4>Sedmica</h4><p>Ko ima više karata od limita odbacuje polovinu. Igrač na potezu pomera razbojnika (to polje ne daje sirovine) i krade jednu kartu.</p>
    <h4>Tasteri</h4><p><b>Space</b> baci kockice · <b>E</b> kraj poteza · <b>T</b> trgovina · <b>P</b> put · <b>S</b> selo · <b>G</b> grad · <b>K</b> razvojna karta · <b>Esc</b> otkaži</p>
    <h4>Izbacivanje</h4><p>Klikni 🥾 pored imena igrača da pokreneš glasanje. Ako se većina ostalih složi, igrač je izbačen.</p>
    <h4>Komande u ćaskanju</h4><p><b>/izlaz</b> napusti igru · <b>/kraj</b> osnivač prekida igru za sve</p>
    <h4>Postavljanje</h4><p>Svako postavlja selo i put, pa opet obrnutim redom. Drugo selo odmah daje sirovine.</p>
    <button class="ob" data-close>Zatvori</button></div>`;
  renderModal();
}
function renderModal() {
  const modal = $('modal'), card = $('modalCard');
  let h = null;
  if (S && S.phase === 'ended') {
    const ranking = [...S.players].sort((a, b) => b.vp - a.vp);
    h = `<h3>${S.winner ? `🏆 ${esc(pById(S.winner).name)} je pobedio!` : `🛑 Igra je prekinuta${S.endedBy ? ` (prekinuo ${esc(pById(S.endedBy).name)})` : ''}`}</h3>
      ${ranking.map((p, i) => `<div class="row" style="padding:4px 0"><b>${i + 1}.</b><div class="avatar" style="background:${p.color};width:30px;height:30px;font-size:15px;border-width:2px">${avatarOf(p)}</div>${esc(p.name)} <b style="margin-left:auto">${p.vp} poena</b></div>`).join('')}
      <p><button class="btn green" style="width:100%" onclick="location.href='/'">Nazad na sobe</button></p>`;
  } else if (S && S.phase !== 'lobby' && S.sub === 'discard' && S.pendingDiscard[S.me]) {
    const need = S.pendingDiscard[S.me];
    const sum = RES.reduce((s, r) => s + (discardSel[r] || 0), 0);
    h = `<h3>Razbojnik! Odbaci ${need} karata</h3><p>Izabrano: <b>${sum} / ${need}</b></p>
      <div class="pick">${RES.filter((r) => S.hand[r]).map((r) => `<div class="step"><button data-dinc="${r}">+</button>${rcard(r, S.hand[r] - (discardSel[r] || 0))}<b>${discardSel[r] || 0}</b><button data-ddec="${r}">−</button></div>`).join('')}</div>
      <button class="btn green" style="width:100%" data-dconfirm ${sum === need ? '' : 'disabled'}>Odbaci</button>`;
  } else if (S && S.sub === 'steal' && myTurn() && S.legal.victims) {
    h = `<h3>Od koga kradeš?</h3><div class="pick">${S.legal.victims.map((id) => { const p = pById(id); return `<button class="ob" style="background:${p.color}" data-steal="${id}">${esc(p.name)} (${p.cards} karata)</button>`; }).join('')}</div>`;
  } else if (picker) {
    h = `<h3>${esc(picker.title)}</h3><div class="pick">${RES.map((r) => `<div data-pick="${r}" style="cursor:pointer">${rcard(r, null, 'click')}</div>`).join('')}</div>
      <p>Izabrano: ${picker.sel.map((r) => RES_INFO[r].ico).join(' ') || '—'}</p>
      <div class="row"><button class="ob" data-pconfirm ${picker.sel.length === picker.count ? '' : 'disabled'}>Potvrdi</button><button class="ob gray" data-pcancel>Otkaži</button></div>`;
  } else if (modalExtra) {
    h = modalExtra();
  }
  if (!S || S.sub !== 'discard') discardSel = {};
  modal.classList.toggle('hidden', !h);
  if (h && card.innerHTML !== h && !(modalExtra && card.querySelector('#codeInput'))) card.innerHTML = h;
}
$('modalCard').addEventListener('click', (ev) => {
  const pk = ev.target.closest('[data-pick]');
  if (pk) { if (picker.sel.length < picker.count) picker.sel.push(pk.dataset.pick); else picker.sel = [pk.dataset.pick]; return renderModal(); }
  const b = ev.target.closest('button'); if (!b) return;
  if (b.dataset.dinc) { const r = b.dataset.dinc; if ((discardSel[r] || 0) < S.hand[r]) discardSel[r] = (discardSel[r] || 0) + 1; return renderModal(); }
  if (b.dataset.ddec) { const r = b.dataset.ddec; discardSel[r] = Math.max(0, (discardSel[r] || 0) - 1); return renderModal(); }
  if (b.hasAttribute('data-dconfirm')) { act('discard', { cards: discardSel }); discardSel = {}; return; }
  if (b.dataset.steal) return act('steal', { target: b.dataset.steal });
  if (b.hasAttribute('data-pconfirm')) { const p = picker; picker = null; p.cb(p.sel); return renderModal(); }
  if (b.hasAttribute('data-pcancel')) { picker = null; return renderModal(); }
  if (b.dataset.startvote) { modalExtra = null; $('modalCard').innerHTML = ''; renderModal(); return act('voteKick', { pid: b.dataset.startvote }); }
  if (b.hasAttribute('data-exit')) { modalExtra = null; $('modalCard').innerHTML = ''; return doLeave(); }
  if (b.hasAttribute('data-endgame')) { modalExtra = null; $('modalCard').innerHTML = ''; renderModal(); return act('endGame'); }
  if (b.hasAttribute('data-close')) { modalExtra = null; $('modalCard').innerHTML = ''; return renderModal(); }
  if (b.hasAttribute('data-joincode')) { const c = $('codeInput').value.trim(); modalExtra = null; $('modalCard').innerHTML = ''; renderModal(); join(c); }
});
$('modalCard').addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.id === 'codeInput') $('modalCard').querySelector('[data-joincode]').click(); });

// ukras na pocetnoj strani
(() => {
  const t = ['suma', 'polje', 'pasnjak', 'gliniste', 'planina', 'polje', 'suma'];
  const pos = [[0, 0], [52, 0], [-52, 0], [26, 45], [-26, 45], [26, -45], [-26, -45]];
  $('promoHex').innerHTML = pos.map(([x, y], i) => {
    const pts = [...Array(6)].map((_, k) => { const a = Math.PI / 180 * (60 * k - 30); return `${x + 29 * Math.cos(a)},${y + 29 * Math.sin(a)}`; }).join(' ');
    return `<polygon points="${pts}" fill="${TERRAIN[t[i]].a}" stroke="#fff6dc" stroke-width="3"/><text x="${x}" y="${y + 8}" text-anchor="middle" font-size="22">${TERRAIN[t[i]].ico}</text>`;
  }).join('');
})();
render();
