/* global io */
const socket = io();
const $ = (id) => document.getElementById(id);

const RES = ['drvo', 'glina', 'vuna', 'zito', 'kamen'];
const RES_INFO = {
  drvo: { name: 'Drvo', ico: '🌲', color: '#4f9a46' },
  glina: { name: 'Glina', ico: '🧱', color: '#d0734a' },
  vuna: { name: 'Ovca', ico: '🐑', color: '#9ccc5f' },
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
  vitez: { name: 'Vitez', ico: '⚔️', desc: 'Pomeri lopova i ukradi kartu.' },
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
  { id: 'dva', name: 'Dva ostrva', sub: '2–4 igrača', max: 4, ico: '🏝️🏝️' },
  { id: 'zaliv', name: 'Zaliv', sub: '2–4 igrača', max: 4, ico: '🌙' },
  { id: 'arhipelag', name: 'Arhipelag', sub: '2–4 igrača', max: 4, ico: '🏝️🏝️🏝️' },
  { id: 'dugo', name: 'Dugačko ostrvo', sub: '2–4 igrača', max: 4, ico: '➖' },
];
const MAP_NAME = { base: 'Osnovna', ext6: 'Proširenje 5–6', ext8: 'Proširenje 7–8', dva: 'Dva ostrva', zaliv: 'Zaliv', arhipelag: 'Arhipelag', dugo: 'Dugačko ostrvo' };
const TIMERS = [0, 30, 60, 90, 120, 180, 240];
const AVATARS = ['🦊', '🐻', '🦉', '🐢', '🦁', '🐺', '🐙', '🦌', '🐸', '🐧', '🦄', '🐼', '🐯', '🦅', '🐳', '🐝', '🐵', '🐒', '🦍', '🐨', '🐰', '🐱', '🐶', '🐷', '🐮', '🐔', '🦖', '🐉', '🦈', '🦩', '🦜', '🐬', '🦒', '🦓', '🐘', '🦔', '🦦', '🦥', '🦀', '🐞', '🦋', '🐊', '🦘', '🐹'];

let S = null; // stanje sa servera
let clockOffset = 0;
let mode = null; // 'road' | 'settlement' | 'city' | null
let tradeOpen = false;
let counterMode = false; // kontraponuda na tudju ponudu
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
  if (S && S.spectator && type !== 'leave') return; // gledalac ne igra
  socket.emit('action', { type, data }, (r) => { if (r && !r.ok) { toast(r.error); SFX.play('error'); } });
}
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const COLOR_ORDER = ['#e05a47', '#3b82c4', '#f2b134', '#4caf6a', '#9b5fc0', '#26b5b0', '#e07ab8', '#8a5a3c'];
// licni ukrasi (isti spiskovi kao LOOKS u game.js)
const FRAMES = [['nema', 'Bez okvira'], ['zlato', 'Zlatni'], ['srebro', 'Srebrni'], ['drvo', 'Drveni'], ['cvece', 'Cvetni'], ['talasi', 'Talasi'], ['zvezde', 'Zvezde'], ['vatra', 'Vatra']];
const TITLES = ['', 'Početnik', 'Trgovac', 'Graditelj', 'Moreplovac', 'Kralj puteva', 'Vitez', 'Lopov u penziji', 'Majstor luka', 'Farmer', 'Rudar', 'Kapetan', 'Legenda ostrva', 'Mornar', 'Lovac na brodove', 'Sokolovo oko', 'Nepotopivi', 'Admiral'];
const DICE_STYLES = [['klasicne', 'Klasične'], ['crne', 'Crne'], ['crvene', 'Crvene'], ['zlatne', 'Zlatne'], ['drvene', 'Drvene'], ['plave', 'Plave'], ['roze', 'Roze'], ['zelene', 'Zelene']];
const WINS = [['konfete', '🎊 Konfete'], ['vatromet', '🎆 Vatromet'], ['zlatnici', '🪙 Zlatnici'], ['baloni', '🎈 Baloni']];
const WIN_SOUNDS = [['fanfara', '🎺 Fanfara'], ['zvona', '🔔 Zvona'], ['bubnjevi', '🥁 Bubnjevi']];
const EMOTES = ['👍', '😂', '😮', '😡', '😭', '🎉', '🤝', '😎', '🙏', '🤔', '🔥', '👋'];
const PHRASES = ['Dobar potez!', 'Ko ima drvo?', 'Ko ima glinu?', 'Ko ima žito?', 'Ko ima kamen?', 'Ko ima ovcu?', 'Hajde, brže!', 'Srećno!', 'GG'];
const frameCls = (p) => (p.frame && p.frame !== 'nema' ? 'fr-' + p.frame : '');
const avatarOf = (p) => AVATARS[(p.avatar ?? Math.max(0, COLOR_ORDER.indexOf(p.color))) % AVATARS.length];

// ---------- navigacija ----------
document.addEventListener('click', (e) => {
  const n = e.target.closest('[data-nav]'); if (!n) return;
  if (n.dataset.nav === 'rules') { if (!S && curKind === 'brodovi') BS.showRules(); else showRules(); }
  if (n.dataset.nav === 'home' || n.dataset.nav === 'hub') { if (S && S.phase === 'lobby') { if (n.dataset.nav === 'home') doLeave(); else toast('Prvo izađi iz sobe (✕ gore desno).'); } if (!S) showPage('hub'); }
  if (n.dataset.nav === 'rooms' && S && S.phase === 'lobby') toast('Prvo izađi iz sobe (✕ gore desno).');
  else if (n.dataset.nav === 'rooms' && !S) showPage('rooms');
  if (n.dataset.nav === 'top') {
    if (S && S.phase === 'lobby') toast('Prvo izađi iz sobe (✕ gore desno).');
    else if (!S) { topKind = null; showPage('top'); loadTop(); }
  }
  if (n.dataset.nav === 'settings' || n.dataset.nav === 'profile') {
    if (S && S.phase === 'lobby') toast('Prvo izađi iz sobe (✕ gore desno).');
    else if (!S) { if (n.dataset.nav === 'profile') { renderProfile(); syncProfile(() => { if (!$('profile').classList.contains('hidden')) renderProfile(); }); } else renderSettings(); showPage(n.dataset.nav); }
  }
});

let curPage = null;
function showPage(page) {
  curPage = page;
  $('shell').classList.toggle('hidden', page === 'game' || page === 'bsgame');
  $('game').classList.toggle('hidden', page !== 'game');
  $('bsgame').classList.toggle('hidden', page !== 'bsgame');
  $('hub').classList.toggle('hidden', page !== 'hub');
  // obavestenje admina se vidi i na izboru igre i na sobama
  const ann = $('announce');
  if (page === 'hub' && ann.parentNode !== $('hubAnn')) $('hubAnn').appendChild(ann);
  if (page === 'rooms' && ann.parentNode === $('hubAnn')) $('rooms').querySelector('.rooms-col').prepend(ann);
  $('rooms').classList.toggle('hidden', page !== 'rooms');
  $('lobby').classList.toggle('hidden', page !== 'lobby');
  $('settings').classList.toggle('hidden', page !== 'settings');
  $('profile').classList.toggle('hidden', page !== 'profile');
  $('top').classList.toggle('hidden', page !== 'top');
  document.querySelectorAll('.rail-btn[data-nav]').forEach((b) => b.classList.toggle('active', b.dataset.nav === (['settings', 'profile', 'top', 'hub'].includes(page) ? page : 'rooms')));
  applyThemeScope();
}
// Izgled (skin) i tamni rezim vaze samo za Ostrvo Trgovaca: sobe, lobi i igra. Ostale strane i igre imaju osnovni izgled.
function catanScope() { return curPage === 'game' || curPage === 'lobby' || (curPage === 'rooms' && curKind === 'ostrvo'); }
let themeKey = null;
function applyThemeScope() {
  if (typeof skin === 'undefined') return;
  const on = catanScope(), dark = skin === 'tamne' || skin === 'tamni';
  const key = `${on}|${skin}`;
  if (key === themeKey) return;
  themeKey = key;
  for (const k of Object.keys(SKINS)) document.body.classList.toggle('skin-' + k, on && k === skin);
  document.body.classList.toggle('dark-ui', on && dark);
  SFX.setTheme(on && skin === 'podvodni' ? 'sea' : 'village');
  $('skinNav').classList.toggle('hidden', !on || curPage === 'game');
}

// ---------- izbor igre (sve igre dele isti profil) ----------
const KIND_INFO = {
  ostrvo: { name: 'Ostrvo Trgovaca', ico: '⛵', nav: '🏝️' },
  brodovi: { name: 'Potapanje brodova', ico: '⚓', nav: '⚓' },
};
let curKind = 'ostrvo';
try { if (KIND_INFO[localStorage.getItem('ot_kind')]) curKind = localStorage.getItem('ot_kind'); } catch (_) { /* */ }
let allRooms = [];
function setKind(k) {
  if (!KIND_INFO[k]) return;
  curKind = k;
  try { localStorage.setItem('ot_kind', k); } catch (_) { /* */ }
  applyKind();
}
function applyKind() {
  const K = KIND_INFO[curKind], bs = curKind === 'brodovi';
  $('kindName').textContent = `${K.ico} ${K.name}`;
  $('roomsNavIco').textContent = K.nav;
  $('rtHead').innerHTML = bs ? '<span>Soba</span><span>Flota</span><span>Tabla</span><span>Tajmer</span><span>Igrači</span><span></span>'
    : '<span>Soba</span><span>Mod</span><span>Mapa</span><span>Tajmer</span><span>Igrači</span><span></span>';
  $('promoArtO').classList.toggle('hidden', bs);
  $('promoArtB').classList.toggle('hidden', !bs);
  $('promoH').textContent = bs ? 'Rasporedi. Gađaj. Potopi.' : 'Gradi. Trguj. Pobedi.';
  $('promoP').textContent = bs ? 'Napravi sobu, pošalji link prijatelju i odigrajte pomorsku bitku u browseru. Za 2 igrača.'
    : 'Napravi sobu, pošalji link prijateljima i igrajte zajedno u browseru. Od 2 do 8 igrača.';
  renderRooms();
  applyThemeScope();
}
$('hub').addEventListener('click', (e) => {
  const c = e.target.closest('[data-kind]'); if (!c) return;
  setKind(c.dataset.kind); showPage('rooms'); socket.emit('rooms');
});

// ---------- licna podesavanja (cuvaju se samo u ovom browseru) ----------
const PREFS = { anim: 'normal', confirmBuild: false, font: 'normal', color: null, avatar: null, frame: 'nema', title: 0, dice: 'klasicne', win: 'konfete', winSound: 'fanfara' };
try { Object.assign(PREFS, JSON.parse(localStorage.getItem('ot_prefs') || '{}')); } catch (_) { /* */ }
function setPref(k, v) { PREFS[k] = v; try { localStorage.setItem('ot_prefs', JSON.stringify(PREFS)); } catch (_) { /* */ } applyPrefs(); syncProfile(); }
// profil na serveru: statistika + kopija licnih podesavanja (za prenos na drugi uredjaj preko koda)
let profile = null;
function syncProfile(cb) {
  const prefs = { ...PREFS, name: localStorage.getItem('ot_name') || '' };
  socket.emit('profile', { token: token(), prefs }, (r) => { if (r && r.ok) { profile = r.profile; applyForcedName(); if (PREFS.frame !== 'nema' || PREFS.title) checkLocked(); if (cb) cb(); } });
}
function checkLocked() {
  if (!profile) return;
  const U = ACHIEVEMENTS.unlocked(profile.stats, profile.all, profile.grant, profile.gstats);
  if (!U.frames.has(PREFS.frame)) setPref('frame', 'nema');
  if (!U.titles.has(Number(PREFS.title))) setPref('title', 0);
}
// ime koje je postavio administrator ima prednost
function applyForcedName() {
  if (profile) { $('nameInput').disabled = !!profile.forcedName; $('nameInput').title = profile.forcedName ? 'Ime je postavio administrator igre.' : ''; }
  if (!profile || !profile.forcedName || localStorage.getItem('ot_name') === profile.forcedName) return;
  localStorage.setItem('ot_name', profile.forcedName); $('nameInput').value = profile.forcedName;
}
socket.on('connect', () => socket.emit('profile', { token: token() }, (r) => { if (r && r.ok) { profile = r.profile; applyForcedName(); checkLocked(); } }));
function applyPrefs() {
  document.body.classList.toggle('fs-small', PREFS.font === 'small');
  document.body.classList.toggle('fs-large', PREFS.font === 'large');
  document.body.classList.toggle('anim-off', PREFS.anim === 'off');
}
// trajanje animacije prema podesavanju: normalno, brzo ili bez animacija
const animMs = (ms) => (PREFS.anim === 'off' ? 0 : PREFS.anim === 'fast' ? Math.round(ms * 0.45) : ms);
applyPrefs();

// ---------- tabela najboljih ----------
let topRows = [], topSort = 'wins';
const TOP_SORTS = [['wins', 'Pobede'], ['pct', 'Procenat pobeda'], ['bestPoints', 'Najviše poena'], ['bestRoad', 'Najduži put'], ['games', 'Partije']];
const TOP_SORTS_BS = [['wins', 'Pobede'], ['pct', 'Procenat pobeda'], ['sunk', 'Potopljeni brodovi'], ['acc', 'Preciznost'], ['games', 'Bitke']];
let topKind = null;
function loadTop() {
  topKind = topKind || curKind;
  if (!(topKind === 'brodovi' ? TOP_SORTS_BS : TOP_SORTS).some(([k]) => k === topSort)) topSort = 'wins';
  $('topBody').innerHTML = '<p class="set-note">Učitavam…</p>';
  renderTopKinds();
  socket.emit('leaderboard', { token: token(), kind: topKind }, (r) => { if (r && r.ok) { topRows = r.rows; renderTop(); } });
}
function renderTopKinds() {
  let el = $('topKinds');
  if (!el) { el = document.createElement('div'); el.id = 'topKinds'; el.className = 'seg2 top-tabs top-kinds'; $('topTabs').before(el); }
  el.innerHTML = Object.entries(KIND_INFO).map(([k, K]) => `<button class="${topKind === k ? 'on' : ''}" data-topkind="${k}">${K.ico} ${K.name}</button>`).join('');
}
document.addEventListener('click', (e) => { const b = e.target.closest('[data-topkind]'); if (b) { topKind = b.dataset.topkind; loadTop(); } });
function renderTop() {
  if (topKind === 'brodovi') return renderTopBs();
  $('topTabs').innerHTML = TOP_SORTS.map(([k, l]) => `<button class="${topSort === k ? 'on' : ''}" data-topsort="${k}">${l}</button>`).join('');
  const rows = [...topRows].sort((a, b) => b[topSort] - a[topSort] || b.wins - a.wins || b.games - a.games);
  if (!rows.length) { $('topBody').innerHTML = '<div class="rt-empty">Još niko nije završio partiju. Odigraj prvu i budi na vrhu!</div>'; return; }
  const medal = (i) => ['🥇', '🥈', '🥉'][i] || `${i + 1}.`;
  $('topBody').innerHTML = `<div class="tt-head"><span>#</span><span>Igrač</span><span title="Pobede">🏆</span><span title="Odigrane partije">🎲</span><span title="Procenat pobeda">%</span><span title="Najviše poena u jednoj partiji">⭐</span><span title="Najduži put">🛤️</span></div>` +
    rows.map((r, i) => `<div class="tt-row ${r.me ? 'me' : ''} ${i < 3 ? 'top3' : ''}">
      <span class="tt-rank">${medal(i)}</span>
      <span class="tt-who"><span class="avatar ${frameCls(r)}" style="background:${r.color || '#888'}">${avatarOf(r)}</span><span><b><span class="nt">${esc(r.name)}</span>${r.me ? ' <small>(ti)</small>' : ''}</b>${r.title ? `<i class="ptitle">${TITLES[r.title]}</i>` : ''}</span></span>
      <span><b>${r.wins}</b></span><span>${r.games}</span><span>${r.pct}%</span><span>${r.bestPoints}</span><span>${r.bestRoad}</span></div>`).join('');
}
function renderTopBs() {
  $('topTabs').innerHTML = TOP_SORTS_BS.map(([k, l]) => `<button class="${topSort === k ? 'on' : ''}" data-topsort="${k}">${l}</button>`).join('');
  const rows = [...topRows].sort((a, b) => b[topSort] - a[topSort] || b.wins - a.wins || b.games - a.games);
  if (!rows.length) { $('topBody').innerHTML = '<div class="rt-empty">Još niko nije završio bitku. Odigraj prvu i budi na vrhu!</div>'; return; }
  const medal = (i) => ['🥇', '🥈', '🥉'][i] || `${i + 1}.`;
  $('topBody').innerHTML = `<div class="tt-head"><span>#</span><span>Igrač</span><span title="Pobede">🏆</span><span title="Odigrane bitke">⚓</span><span title="Procenat pobeda">%</span><span title="Potopljeni brodovi">🔥</span><span title="Preciznost gađanja">🎯</span></div>` +
    rows.map((r, i) => `<div class="tt-row ${r.me ? 'me' : ''} ${i < 3 ? 'top3' : ''}">
      <span class="tt-rank">${medal(i)}</span>
      <span class="tt-who"><span class="avatar ${frameCls(r)}" style="background:${r.color || '#888'}">${avatarOf(r)}</span><span><b><span class="nt">${esc(r.name)}</span>${r.me ? ' <small>(ti)</small>' : ''}</b>${r.title ? `<i class="ptitle">${TITLES[r.title]}</i>` : ''}</span></span>
      <span><b>${r.wins}</b></span><span>${r.games}</span><span>${r.pct}%</span><span>${r.sunk}</span><span>${r.acc}%</span></div>`).join('');
}
$('topTabs').addEventListener('click', (e) => { const b = e.target.closest('[data-topsort]'); if (b) { topSort = b.dataset.topsort; renderTop(); } });

let nameSync = null;
let profKind = null; // cija statistika se vidi u profilu
function renderProfile() {
  profKind = profKind || curKind;
  const nm = $('nameInput').value.trim();
  const col = PREFS.color || COLOR_ORDER[0];
  const av = AVATARS[PREFS.avatar ?? 0];
  const st = profile?.stats;
  const gs = profile?.gstats || {};
  const U = ACHIEVEMENTS.unlocked(st || {}, profile?.all, profile?.grant, gs);
  // sta otkljucava zakljucani okvir ili titulu
  const lockOf = (key, v) => {
    if (key === 'frame' && !U.frames.has(v)) return ACHIEVEMENTS.ACH.find((a) => a.frame === v);
    if (key === 'title' && !U.titles.has(Number(v))) return ACHIEVEMENTS.ACH.find((a) => a.title === Number(v));
    return null;
  };
  const opts = (key, list, cur, fmt) => `<div class="look-opts">${list.map(([v, l]) => {
    const lock = lockOf(key, v);
    return `<button class="${cur === v ? 'sel' : ''} ${lock ? 'locked' : ''}" data-look-k="${key}" data-look-v="${v}" ${lock ? `title="🔒 Otključava se dostignućem „${lock.name}“: ${lock.desc}"` : ''}>${fmt ? fmt(v) : ''}<span>${l}</span>${lock ? '<i>🔒</i>' : ''}</button>`;
  }).join('')}</div>`;
  const achDone = ACHIEVEMENTS.ACH.filter((a) => ACHIEVEMENTS.done(a, st, profile?.grant, gs)).length;
  const bs = gs.brodovi, bsPct = bs && bs.games ? Math.round((bs.wins / bs.games) * 100) : 0, bsAcc = bs && bs.shots ? Math.round((bs.hits / bs.shots) * 100) : 0;
  const pct = st && st.games ? Math.round((st.wins / st.games) * 100) : 0;
  const hrs = st ? Math.round(st.playMs / 360000) / 10 : 0;
  $('profBody').innerHTML = `
    <div class="set-card prof-card"><div class="prof-av ${PREFS.frame !== 'nema' ? 'fr-' + PREFS.frame : ''}" style="--pc:${col}">${av}</div><b class="prof-name" style="color:${col}">${esc(nm) || '…'}</b>${PREFS.title ? `<i class="prof-title">${TITLES[PREFS.title]}</i>` : ''}<small>Ovako te vide ostali igrači u sobi.</small></div>
    <div class="set-card"><h3>📊 Moja statistika</h3>
      <div class="seg2 stat-kinds">${Object.entries(KIND_INFO).map(([k, K]) => `<button class="${profKind === k ? 'on' : ''}" data-profkind="${k}">${K.ico} ${K.name}</button>`).join('')}</div>
      ${profKind === 'brodovi' ? (bs ? `<div class="stat-grid">
        <div><b>${bs.games}</b><small>Odigrane bitke</small></div><div><b>${bs.wins}</b><small>Pobede</small></div><div><b>${bsPct}%</b><small>Procenat pobeda</small></div>
        <div><b>${bs.sunk}</b><small>Potopljeni brodovi</small></div><div><b>${bsAcc}%</b><small>Preciznost</small></div><div><b>${bs.bestAcc}%</b><small>Najbolja preciznost</small></div>
        <div><b>${bs.flawless}</b><small>Pobede bez gubitka</small></div><div><b>${bs.bestStreak}</b><small>Najduži niz pobeda</small></div><div><b>${Math.round(bs.playMs / 360000) / 10}h</b><small>Vreme igranja</small></div></div>` : '<p class="set-note">Učitavam…</p>')
      : st ? `<div class="stat-grid">
        <div><b>${st.games}</b><small>Odigrane partije</small></div><div><b>${st.wins}</b><small>Pobede</small></div><div><b>${pct}%</b><small>Procenat pobeda</small></div>
        <div><b>${st.bestPoints}</b><small>Najviše poena</small></div><div><b>${st.bestRoad}</b><small>Najduži put</small></div><div><b>${st.knights}</b><small>Odigrani vitezovi</small></div>
        <div><b>${st.cities}</b><small>Sagrađeni gradovi</small></div><div><b>${st.trades}</b><small>Razmene</small></div><div><b>${hrs}h</b><small>Vreme igranja</small></div></div>` : '<p class="set-note">Učitavam…</p>'}
    </div>
    <div class="set-card ach-card"><h3>🎖️ Dostignuća <small>${achDone} / ${ACHIEVEMENTS.ACH.length}</small></h3>
      <div class="ach-list">${ACHIEVEMENTS.ACH.map((a) => {
        const ok = ACHIEVEMENTS.done(a, st, profile?.grant, gs), v = ok ? a.need : Math.min(a.need, ACHIEVEMENTS.value(a, st, gs));
        const prize = a.frame ? `okvir: ${FRAMES.find((f) => f[0] === a.frame)[1]}` : `titula: ${TITLES[a.title]}`;
        return `<div class="ach ${ok ? 'ok' : ''}" title="${a.desc}. Nagrada – ${prize}"><span class="ach-ico">${ok ? a.ico : '🔒'}</span><span class="ach-txt"><b>${a.name}${a.g ? ` <em class="ach-game">${KIND_INFO[a.g].ico} ${KIND_INFO[a.g].name}</em>` : ''}</b><small>${a.desc}</small><i class="ach-bar"><i style="width:${(v / a.need) * 100}%"></i></i></span><span class="ach-n">${v}/${a.need}</span></div>`;
      }).join('')}</div>
    </div>
    <div class="set-card"><h3>🔑 Kod profila</h3>
      <p class="set-note">Upiši ovaj kod na drugom računaru ili telefonu i tamo ćeš imati isti profil i statistiku. Ne deli ga sa drugima.</p>
      <div class="code-box"><code>${profile ? profile.code : '…'}</code><button class="ob" data-copycode title="Kopiraj kod profila">Kopiraj</button></div>
      <div class="code-box"><input id="claimCode" maxlength="9" placeholder="XXXX-XXXX"><button class="ob gray" data-claim title="Prebaci se na profil sa drugog uređaja">Učitaj profil</button></div>
      ${profile?.banned ? '<p class="set-note warn">⛔ Ovaj nalog je blokiran i ne može da ulazi u sobe.</p>' : ''}
      ${profile?.all ? '<p class="set-note">👑 Na ovom profilu su svi okviri i titule otključani.</p>' : ''}
      <div class="logout-row"><button class="ob red" data-logout title="Napusti ovaj profil na ovom uređaju i počni novi">🚪 Odjavi se</button><small>Pre odjave zapiši kod, jer bez njega ne možeš da se vratiš na ovaj profil.</small></div>
    </div>
    <div class="set-card"><h3>✏️ Ime</h3>
      <div class="set-row"><input id="setName" maxlength="16" placeholder="Upiši ime" value="${esc(nm)}" ${profile?.forcedName ? 'disabled' : ''}></div>
      ${profile?.forcedName ? '<p class="set-note">🔒 Ime je postavio administrator igre.</p>' : ''}
    </div>
    <div class="set-card"><h3>🎨 Omiljena boja</h3><p class="set-note">Dobijaš je kad uđeš u sobu, ako je niko drugi već nema.</p>
      <div class="set-colors">${COLOR_ORDER.map((c) => `<button class="swatch ${PREFS.color === c ? 'sel' : ''}" data-pcolor="${c}" style="background:${c}" title="Izaberi ovu boju"></button>`).join('')}<button class="swatch none ${PREFS.color ? '' : 'sel'}" data-pcolor="" title="Bez omiljene boje (dobijaš slobodnu)">✕</button></div>
    </div>
    <div class="set-card"><h3>🦊 Omiljeni lik</h3>
      <div class="set-avatars">${AVATARS.map((a, i) => `<button class="av ${PREFS.avatar === i ? 'sel' : ''}" data-pav="${i}" title="Izaberi ovog lika">${a}</button>`).join('')}</div>
    </div>
    <div class="set-card"><h3>🖼️ Okvir avatara</h3>
      ${opts('frame', FRAMES, PREFS.frame, (v) => `<span class="avatar ${v !== 'nema' ? 'fr-' + v : ''}" style="border-color:${v === 'nema' ? col : ''}">${av}</span>`)}
    </div>
    <div class="set-card"><h3>🏷️ Titula ispod imena</h3>
      ${opts('title', TITLES.map((t, i) => [String(i), t || 'Bez titule']), String(PREFS.title))}
    </div>
    <div class="set-card"><h3>🎲 Moje kockice</h3><p class="set-note">Svi vide tvoje kockice kad si ti na potezu.</p>
      ${opts('dice', DICE_STYLES, PREFS.dice, (v) => `<span class="dice dice-${v}">${dieHTML(5, 'mini')}</span>`)}
    </div>
    <div class="set-card"><h3>🏆 Kad pobedim</h3><p class="set-note">Proslava i zvuk koje svi vide i čuju kad ti pobediš.</p>
      <div class="set-sub">Proslava</div>
      ${opts('win', WINS, PREFS.win)}
      <div class="set-sub">Zvuk pobede</div>
      ${opts('winSound', WIN_SOUNDS, PREFS.winSound)}
      <button class="ob" data-wintest title="Pusti zvuk pobede">▶ Probaj zvuk</button>
    </div>`;
}
$('profBody').addEventListener('input', (e) => {
  if (e.target.id === 'setName') { $('nameInput').value = e.target.value; localStorage.setItem('ot_name', e.target.value.trim()); document.querySelector('.prof-name').textContent = e.target.value.trim() || '…'; clearTimeout(nameSync); nameSync = setTimeout(syncProfile, 800); }
});
$('profBody').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.lookK) {
    if (b.classList.contains('locked')) return toast(b.dataset.tip || b.title || 'Zaključano.');
    const k = b.dataset.lookK; setPref(k, k === 'title' ? Number(b.dataset.lookV) : b.dataset.lookV);
  }
  if (b.dataset.profkind) { profKind = b.dataset.profkind; renderProfile(); return; }
  if (b.hasAttribute('data-wintest')) { SFX.play({ zvona: 'winBells', bubnjevi: 'winDrums' }[PREFS.winSound] || 'win'); return; }
  if (b.hasAttribute('data-copycode') && profile) { navigator.clipboard?.writeText(profile.code); toast('Kod profila je kopiran.'); return; }
  if (b.hasAttribute('data-logout')) {
    if (b.dataset.sure !== '1') { b.dataset.sure = '1'; b.textContent = 'Sigurno? Klikni opet'; toast('Zapiši kod profila: ' + (profile ? profile.code : '')); return; }
    // novi prazan profil na ovom uredjaju; stari ostaje na serveru i vraca se kodom
    try { ['ot_token', 'ot_name', 'ot_prefs'].forEach((k) => localStorage.removeItem(k)); } catch (_) { /* */ }
    location.reload();
    return;
  }
  if (b.hasAttribute('data-claim')) {
    const code = $('claimCode').value.trim();
    socket.emit('claimProfile', { code }, (r) => {
      if (!r || !r.ok) return toast(r?.error || 'Greška na serveru.');
      // preuzmi profil: novi tajni token i podesavanja sa drugog uredjaja
      try {
        localStorage.setItem('ot_token', r.token);
        const pr = r.profile.prefs || {};
        if (pr.name) localStorage.setItem('ot_name', pr.name);
        delete pr.name;
        localStorage.setItem('ot_prefs', JSON.stringify({ ...PREFS, ...pr }));
      } catch (_) { /* */ }
      location.reload();
    });
    return;
  }
  if (b.dataset.pcolor !== undefined) setPref('color', b.dataset.pcolor || null);
  if (b.dataset.pav !== undefined) setPref('avatar', PREFS.avatar === Number(b.dataset.pav) ? null : Number(b.dataset.pav));
  renderProfile();
});

function renderSettings() {
  const o = SFX.opts;
  const sw = (key, on, label, tip) => `<div class="set-row" title="${tip}"><span>${label}</span><button class="sw ${on ? 'on' : ''}" data-sw="${key}"><i></i></button></div>`;
  const seg = (key, cur, list) => `<div class="seg2">${list.map(([v, l]) => `<button class="${cur === v ? 'on' : ''}" data-seg="${key}" data-v="${v}">${l}</button>`).join('')}</div>`;
  const fam = SKIN_FAMS.find((f) => f.light === skin || f.dark === skin);
  $('setBody').innerHTML = `
    <div class="set-card"><h3>🔊 Zvuk</h3>
      ${sw('sound', !SFX.muted, 'Zvuk uključen', 'Uključi ili isključi sve zvukove')}
      <div class="set-row" title="Jačina svih zvukova"><span>Jačina</span><input type="range" id="setVol" min="0" max="100" step="5" value="${o.volume}"><b id="setVolV">${o.volume}%</b></div>
      ${sw('fx', o.fx, 'Efekti igre', 'Kockice, gradnja, karte, trgovina, lopov…')}
      ${sw('turn', o.turn, 'Zvuk kad si na potezu', 'Zvono kad dođe tvoj red i otkucaji kad ističe vreme')}
      ${sw('alerts', o.alerts, 'Obaveštenja', 'Ponude za razmenu, glasanje, pobeda i poraz')}
      ${sw('chat', o.chat, 'Poruke u ćaskanju', 'Kratak zvuk kad neko napiše poruku')}
      ${sw('music', o.music, 'Muzika u pozadini', 'Tiha muzika: vesela seoska uz Osnovni i Kućice, mirna podvodna uz Podvodni svet')}
      <div class="set-row" title="Jačina muzike u pozadini"><span>Jačina muzike</span><input type="range" id="setMusVol" min="0" max="100" step="5" value="${o.musicVol}"><b id="setMusVolV">${o.musicVol}%</b></div>
      <button class="ob" data-sndtest title="Pusti probni zvuk">▶ Probaj zvuk</button>
    </div>
    <div class="set-card"><h3>🌍 Jezik</h3>
      ${seg('lang', I18N.lang, [['sr', '🇷🇸 Srpski'], ['en', '🇬🇧 English']])}
      <p class="set-note">Menja se samo kod tebe. Ostali igrači vide igru na svom jeziku.</p>
    </div>
    <div class="set-card"><h3>🔤 Prikaz</h3>
      <p class="set-note">Izgled table i tamni režim za Ostrvo Trgovaca biraš unutar te igre (🎨 Izgled).</p>
      <div class="set-row"><span>Veličina slova</span>${seg('font', PREFS.font, [['small', 'Mala'], ['normal', 'Srednja'], ['large', 'Velika']])}</div>
    </div>
    <div class="set-card"><h3>🎮 Igra</h3>
      <div class="set-row" title="Kockice koje se kotrljaju i karte koje lete do igrača"><span>Animacije</span>${seg('anim', PREFS.anim, [['normal', 'Normalno'], ['fast', 'Brzo'], ['off', 'Isključeno']])}</div>
      ${sw('confirmBuild', PREFS.confirmBuild, 'Potvrda pre gradnje', 'Pre nego što se sagradi put, selo ili grad pita te da potvrdiš, da ne sagradiš nešto slučajno')}
    </div>`;
}
$('setBody').addEventListener('input', (e) => {
  if (e.target.id === 'setVol') { SFX.set('volume', Number(e.target.value)); $('setVolV').textContent = e.target.value + '%'; }
  if (e.target.id === 'setMusVol') { SFX.set('musicVol', Number(e.target.value)); $('setMusVolV').textContent = e.target.value + '%'; }
});
$('setBody').addEventListener('change', (e) => { if (e.target.id === 'setVol') SFX.play('settlement'); });
$('setBody').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.sw) {
    const k = b.dataset.sw;
    if (k === 'sound') SFX.setMuted(!SFX.muted);
    else if (k === 'dark') { darkPref = !darkPref; try { localStorage.setItem('ot_dark', darkPref ? '1' : '0'); } catch (_) { /* */ } const f = SKIN_FAMS.find((x) => x.dark && (x.light === skin || x.dark === skin)); if (f) setSkin(darkPref ? f.dark : f.light); }
    else if (k === 'confirmBuild') setPref(k, !PREFS[k]);
    else SFX.set(k, !SFX.opts[k]);
  }
  if (b.dataset.seg === 'lang') I18N.setLang(b.dataset.v);
  else if (b.dataset.seg) setPref(b.dataset.seg, b.dataset.v);
  if (b.hasAttribute('data-sndtest')) { SFX.play('myTurn'); setTimeout(() => SFX.play('city'), 600); }
  if (b.hasAttribute('data-setskin')) return showSkinPicker();
  renderSettings();
});

// ---------- lista soba ----------
function seatIcons(n, max) {
  let h = '';
  for (let i = 0; i < max; i++) h += `<svg class="seat" viewBox="0 0 13 18"><circle cx="6.5" cy="4" r="3.5" fill="${i < n ? '#fff' : '#ffffff55'}"/><path d="M1 18 V11 Q1 8 6.5 8 Q12 8 12 11 V18Z" fill="${i < n ? '#fff' : '#ffffff55'}"/></svg>`;
  return h;
}
socket.on('rooms', (rooms) => { allRooms = rooms; renderRooms(); });
function renderRooms() {
  const rows = $('roomRows');
  for (const k of Object.keys(KIND_INFO)) {
    const n = allRooms.filter((r) => (r.kind || 'ostrvo') === k && !r.live && r.players < r.settings.maxPlayers).length;
    document.querySelectorAll(`[data-open="${k}"]`).forEach((el) => { el.textContent = n ? `🟢 ${n} ${n === 1 ? 'otvorena soba' : n < 5 ? 'otvorene sobe' : 'otvorenih soba'}` : ''; });
  }
  const rooms = allRooms.filter((r) => (r.kind || 'ostrvo') === curKind);
  if (!rooms.length) { rows.innerHTML = '<div class="rt-empty">Trenutno nema otvorenih soba. Napravi svoju i pozovi prijatelje!</div>'; return; }
  // prvo sobe koje cekaju igrace, pa igre koje traju (mogu da se gledaju)
  rooms.sort((a, b) => !!a.live - !!b.live);
  rows.innerHTML = rooms.map((r) => {
    const h = r.host || { name: r.names[0] || '?', color: '#888' };
    if (r.live) return liveRow(r, h);
    const full = r.players >= r.settings.maxPlayers;
    if (r.kind === 'brodovi') {
      return `<div class="rt-row ${full ? 'full' : 'open'}" data-room="${r.code}" title="Igrači: ${esc(r.names.join(', '))}">
    <span class="rt-host"><span class="rt-av" style="--pc:${h.color || '#888'}">${avatarOf(h)}</span><span class="rt-hn"><b>${esc(h.name)}</b><small><i class="rt-dot"></i>${full ? 'Popunjena' : 'Otvorena'}</small></span></span>
    <span>${r.settings.fleet === 'velika' ? 'Velika' : 'Klasična'}${r.settings.salvo ? ' · salva' : ''}${r.settings.special ? ' · 📡💣' : ''}</span><span>${r.settings.size || 10}×${r.settings.size || 10}</span>
    <span>${r.settings.timer ? r.settings.timer + 's' : 'bez'}</span><span class="seats">${seatIcons(r.players, r.settings.maxPlayers)}</span>
    <span class="rt-join">${full ? '' : 'Uđi ›'}</span></div>`;
    }
    return `<div class="rt-row ${full ? 'full' : 'open'}" data-room="${r.code}" title="Igrači: ${esc(r.names.join(', '))}">
    <span class="rt-host"><span class="rt-av" style="--pc:${h.color || '#888'}">${avatarOf(h)}</span><span class="rt-hn"><b>${esc(h.name)}</b><small><i class="rt-dot"></i>${full ? 'Popunjena' : 'Otvorena'}</small></span></span>
    <span>${r.settings.maxPlayers <= 4 && !['ext6', 'ext8'].includes(r.settings.map) ? 'Osnovni' : 'Prošireni'}</span><span>${MAP_NAME[r.settings.map]}</span>
    <span>${r.settings.timer ? r.settings.timer + 's' : 'bez'}</span><span class="seats">${seatIcons(r.players, r.settings.maxPlayers)}</span>
    <span class="rt-join">${full ? '' : 'Uđi ›'}</span></div>`;
  }).join('');
}
// igra koja vec traje: moze samo da se gleda
function liveRow(r, h) {
  const mode = r.kind === 'brodovi' ? `${r.settings.size || 10}×${r.settings.size || 10}` : MAP_NAME[r.settings.map];
  return `<div class="rt-row live" data-watch="${r.code}" title="Igra je u toku. Klikni da gledaš. Igrači: ${esc(r.names.join(', '))}">
    <span class="rt-host"><span class="rt-av" style="--pc:${h.color || '#888'}">${avatarOf(h)}</span><span class="rt-hn"><b>${esc(h.name)}</b><small><i class="rt-dot"></i>Igra u toku</small></span></span>
    <span>${esc(r.names.join(', '))}</span><span>${mode || ''}</span>
    <span>${r.watchers ? `👀 ${r.watchers}` : ''}</span><span class="seats">${seatIcons(r.players, r.players)}</span>
    <span class="rt-join">👀 Gledaj ›</span></div>`;
}
$('roomRows').addEventListener('click', (e) => {
  const w = e.target.closest('[data-watch]'); if (w) return watch(w.dataset.watch);
  const r = e.target.closest('[data-room]'); if (r) join(r.dataset.room);
});
// gledanje igre: bez mesta za stolom, vidi se samo ono sto je javno
let watching = null; // kod sobe koju gledas
function watch(code, quiet) {
  const name = $('nameInput').value.trim() || localStorage.getItem('ot_name') || 'Gost';
  socket.emit('spectate', { code, name, token: token() }, (r) => {
    if (!r || !r.ok) { watching = null; if (!quiet) toast((r && r.error) || 'Ne može da se gleda.'); if (S || BS.code()) { S = null; BS.reset(); render(); } return; }
    watching = r.code;
    const url = new URL(location.href); url.search = '?gledaj=' + r.code;
    history.replaceState(null, '', url);
  });
}

function enter(code) {
  setSavedRoom(code);
  const url = new URL(location.href); url.search = '?soba=' + code;
  history.replaceState(null, '', url);
}
$('createBtn').onclick = () => {
  const name = myName(); if (!name) return;
  socket.emit('create', { name, token: token(), kind: curKind }, (r) => (r.ok ? enter(r.code) : ($('homeError').textContent = r.error)));
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
function savedRoom() { try { return localStorage.getItem('ot_room') || ''; } catch (_) { return ''; } }
function setSavedRoom(code) { try { if (code) localStorage.setItem('ot_room', code); else localStorage.removeItem('ot_room'); } catch (_) { /* */ } }
// Povratak u igru: posle prekida interneta ili osvezavanja stranice igrac se vraca na svoje mesto
socket.on('disconnect', () => { if (S) $('netBar').classList.remove('hidden'); });
const watchInvite = (new URLSearchParams(location.search).get('gledaj') || '').toUpperCase();
socket.on('connect', () => {
  $('netBar').classList.add('hidden');
  if (watching || (watchInvite && !S && !BS.code())) return watch(watching || watchInvite, !watching);
  const code = (S && S.code) || BS.code() || inviteCode || savedRoom();
  if (!code) return;
  socket.emit('join', { code, token: token(), rejoinOnly: true }, (r) => {
    if (r.ok) { if (code !== inviteCode) enter(code); return; }
    if (S || BS.code()) { S = null; BS.reset(); render(); toast('Partija više ne postoji.'); setSavedRoom(''); return; }
    if (!inviteCode) { setSavedRoom(''); return; }
    if (localStorage.getItem('ot_name')) join(code);
    else { $('nameInput').focus(); toast(`Upiši ime i klikni sobu ${code} ili „Uđi u sobu“.`); }
  });
});
socket.on('kicked', (o) => { watching = null; setSavedRoom(''); S = null; BS.reset(); modalExtra = null; showPage('rooms'); renderModal(); history.replaceState(null, '', '/'); SFX.play('kick'); toast((o && o.msg) || 'Izbačen si iz sobe.'); });
// obavestenje od administratora: traka iznad liste soba (moze da se sakrije dok ne stigne novo)
let annAt = 0;
socket.on('announce', (a) => {
  const box = $('announce');
  if (!a || !a.text) { box.classList.add('hidden'); return; }
  annAt = a.at; $('annText').textContent = a.text;
  let seen = 0; try { seen = Number(localStorage.getItem('ot_ann_seen')) || 0; } catch (_) { /* */ }
  box.classList.toggle('hidden', seen === a.at);
  if (S && seen !== a.at) toast('📢 ' + a.text);
});
$('annClose').addEventListener('click', () => { $('announce').classList.add('hidden'); try { localStorage.setItem('ot_ann_seen', String(annAt)); } catch (_) { /* */ } });

// dok si u sobi, server se drzi budnim (besplatni hosting zaspi posle 15 minuta tisine)
setInterval(() => { if (S || BS.code()) fetch('/health').catch(() => {}); }, 4 * 60 * 1000);

// ---------- prijem stanja ----------
// ---------- zvukovi prema dogadjajima iz dnevnika ----------
let seenLog = null, seenChatN = null;
function playEventSounds(prev, next) {
  if (next) { const cur = S; S = next; try { return playEventSounds(prev); } finally { S = cur; } }
  const keys = S.log.map((l) => `${l.t}|${l.text}`);
  if (seenLog === null || !prev || prev.code !== S.code) { seenLog = new Set(keys); seenChatN = S.chat.length; return; }
  const fresh = S.log.filter((l, i) => !seenLog.has(keys[i]));
  keys.forEach((k) => seenLog.add(k));
  if (S.chat.length > seenChatN && S.chat[S.chat.length - 1].pid !== S.me) SFX.play('chat');
  seenChatN = S.chat.length;
  const myName = me()?.name;
  const DICE_MS = animMs(900); // zvuk posle kockica ceka da se kockice zaustave
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
    else if (t.startsWith('🤝')) SFX.play(t.includes('Pomoćni potez') ? 'turn' : myName && t.startsWith('🤝 ' + myName + ' ') ? 'offer' : 'bell');
    else if (t.startsWith('✅')) SFX.play('tradeDone');
    else if (t.startsWith('🏦')) SFX.play('bank');
    else if (t.startsWith('🛣️') || t.startsWith('🛡️')) setTimeout(() => SFX.play('achieve'), 300);
    else if (t.startsWith('🏆')) setTimeout(() => SFX.play({ zvona: 'winBells', bubnjevi: 'winDrums' }[pById(S.winner)?.winSound] || 'win'), 400);
    else if (t.startsWith('➡️')) SFX.play(S.turn === S.me ? 'myTurn' : 'turn');
    else if (t.includes('je odbacio')) SFX.play('discard');
    else if (t.startsWith('🗳️')) SFX.play('vote');
    else if (t.startsWith('🥾')) SFX.play('kick');
    else if (t.startsWith('🚪') || t.startsWith('🛑')) SFX.play('leave');
    else if (myName && t.startsWith(myName + ' dobija')) gains += (t.match(/\d+/g) || []).reduce((a, n) => a + Number(n), 0) || t.split(',').length;
  }
  if (gains) setTimeout(() => SFX.play('gain', gains), delay);
  // upozorenje: moras da odbacis karte
  if (S.sub === 'discard' && S.pendingDiscard?.[S.me] && !(prev.sub === 'discard' && prev.pendingDiscard?.[S.me])) setTimeout(() => SFX.play('warn'), DICE_MS + 200);
  // postavljanje: kad je red na tebe
  if (S.phase === 'setup' && prev.turn !== S.turn && S.turn === S.me) SFX.play('myTurn');
}

// Kad padnu kockice: dok se kockice kotrljaju prikazuje se staro stanje (bez hajlajta i novih karata),
// a tek kad se zaustave prikazuje se rezultat i karte lete sa polja do igraca.
const DICE_ANIM_MS = 900;
let rollHold = null; // { state, prev } dok traje animacija
socket.on('state', (state) => {
  if (!state.spectator) watching = null;
  if (state.kind && state.kind !== 'ostrvo') { // druga igra (Potapanje brodova) ima svoj ekran
    if (S) { S = null; modalExtra = null; }
    if (KIND_INFO[state.kind] && curKind !== state.kind) setKind(state.kind);
    return BS.onState(state);
  }
  if (BS.code()) BS.reset(true);
  if (curKind !== 'ostrvo') setKind('ostrvo');
  if (rollHold) { rollHold.state = state; return; }
  const prev = S;
  const newRoll = prev && prev.code === state.code && state.dice && state.phase === 'play' && prev.phase === 'play'
    && `${state.turnNum}-${state.dice}` !== `${prev.turnNum}-${prev.dice}` && state.log.some((l) => l.text.startsWith('🎲') && !(seenLog && seenLog.has(`${l.t}|${l.text}`)));
  if (newRoll && animMs(DICE_ANIM_MS)) {
    playEventSounds(prev, state);
    rollHold = { state, prev };
    S = { ...prev, dice: state.dice, turnNum: state.turnNum, now: state.now, deadline: state.deadline, rolling: true };
    render();
    setTimeout(() => {
      const st = rollHold.state; rollHold = null;
      applyState(st, prev, true);
      flyCards(prev);
    }, animMs(DICE_ANIM_MS));
    return;
  }
  applyState(state, prev, false);
});
function applyState(state, prev, soundsDone) {
  S = state;
  if (!soundsDone) playEventSounds(prev);
  clockOffset = S.now - Date.now();
  if (S.sub !== 'main' || S.turn !== S.me) { mode = null; }
  if (!canPropose()) counterMode = false;
  if (!(S.turn === S.me && S.sub === 'main') && !counterMode) tradeOpen = false;
  render();
}

const me = () => S.players.find((p) => p.id === S.me);
const pById = (id) => S.players.find((p) => p.id === id);
const myTurn = () => S.turn === S.me;
const canAfford = (cost) => RES.every((r) => S.hand[r] >= (cost[r] || 0));

function render() {
  if (!S) return showPage(BS.code() ? 'bsgame' : 'rooms');
  if (S.phase === 'lobby') { showPage('lobby'); renderLobby(); renderChat(); renderModal(); return; }
  showPage('game');
  renderBoard(); renderDice(); renderHand(); renderStatus(); renderActions(); renderRecipes(); renderVote();
  renderPlayers(); renderBank(); renderOffers(); renderTradePanel(); renderLog(); renderChat(); renderModal(); renderEmotes();
}

// ---------- brze reakcije ----------
const shownEmotes = new Set();
function renderEmotes() {
  for (const x of S.emotes || []) {
    const key = `${x.pid}|${x.t}`;
    if (shownEmotes.has(key)) continue;
    shownEmotes.add(key);
    const target = document.querySelector(`.pp[data-pid="${x.pid}"] .avatar`);
    if (!target || !target.offsetParent) continue;
    const r = target.getBoundingClientRect();
    const el = document.createElement('div');
    el.className = 'emote-bubble'; el.textContent = EMOTES[x.e];
    el.style.left = r.left + r.width / 2 + 'px'; el.style.top = r.top + 'px';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2600);
    if (x.pid !== S.me) SFX.play('click');
  }
}
$('emoteBtn').onclick = (e) => { e.stopPropagation(); $('emotePop').classList.toggle('hidden'); };
$('emotePop').innerHTML = `<div class="em-row">${EMOTES.map((e, i) => `<button data-emote="${i}">${e}</button>`).join('')}</div>
  <div class="em-phr">${PHRASES.map((t) => `<button data-phrase="${esc(t)}">${t}</button>`).join('')}</div>`;
$('emotePop').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.emote !== undefined) act('emote', { e: Number(b.dataset.emote) });
  if (b.dataset.phrase) act('chat', { text: I18N.tr(b.dataset.phrase) });
  $('emotePop').classList.add('hidden');
});
document.addEventListener('click', (e) => { if (!e.target.closest('#emotePop')) $('emotePop').classList.add('hidden'); });

// ---------- lobi ----------
let lookSentFor = null;
function renderLobby() {
  const host = S.host === S.me;
  // omiljena boja i avatar iz podesavanja: postavi ih jednom kad udjes u sobu
  if (lookSentFor !== S.code && me()) {
    lookSentFor = S.code;
    const m = me(), data = {};
    if (PREFS.color && m.color !== PREFS.color && !S.players.some((p) => p.id !== S.me && p.color === PREFS.color)) data.color = PREFS.color;
    if (PREFS.avatar !== null && PREFS.avatar !== undefined && m.avatar !== PREFS.avatar) data.avatar = PREFS.avatar;
    for (const k of ['frame', 'title', 'dice', 'win', 'winSound']) if (PREFS[k] !== undefined && m[k] !== PREFS[k]) data[k] = PREFS[k];
    if (Object.keys(data).length) act('look', data);
  }
  const st = S.settings;
  $('lobbyCode').textContent = S.code;
  $('lpCount').textContent = `${S.players.length}/${st.maxPlayers}`;
  const url = new URL(location.href); url.search = '?soba=' + S.code;
  $('inviteLink').value = url.toString();
  let h = S.players.map((p) => `<div class="lp-slot"><div class="avatar ${frameCls(p)} ${p.id === S.me ? 'pickable' : ''}" ${p.id === S.me ? 'data-look title="Klikni da izabereš svoju boju i avatara"' : ''} style="background:${p.color}">${avatarOf(p)}</div>
    <div class="nm">${esc(p.name)}${p.id === S.me ? ' (ti)' : ''}<div class="sub">${p.id === S.host ? '👑 osnivač' : p.connected ? 'spreman' : 'van mreže'}${p.title ? ` · <i class="ptitle">${TITLES[p.title]}</i>` : ''}</div></div>
    ${host && p.id !== S.me ? `<button class="kick" data-kick="${p.id}" title="Izbaci ovog igrača iz sobe">✕</button>` : ''}</div>`).join('');
  for (let i = S.players.length; i < st.maxPlayers; i++) {
    h += `<div class="lp-slot empty"><span class="muted-light">Čeka se igrač…</span></div>`;
  }
  $('lobbyPlayers').innerHTML = h;

  $('mapTiles').innerHTML = MAPS.map((m) => `<button class="tile ${st.map === m.id ? 'sel' : ''}" data-map="${m.id}" ${host ? '' : 'disabled'} title="Tabla za ${m.sub}. Veća tabla ima više polja, luka i karata.">
    <span class="ti">${m.ico || '⬢'.repeat(m.max / 2)}</span>${m.name}<small>${m.sub}</small></button>`).join('');
  const rule = (key, ico, name, on, off, tip) => `<button class="tile ${st[key] ? 'sel' : ''}" data-rule="${key}" ${host ? '' : 'disabled'} title="${tip}"><span class="ti">${ico}</span>${name}<small>${st[key] ? on : off}</small></button>`;
  $('ruleTiles').innerHTML =
    rule('private', '🕶️', 'Privatna igra', 'ne vidi se u listi', 'vidi se u listi soba', 'Soba se ne prikazuje u listi otvorenih soba. Ulazi se samo preko linka ili koda.') +
    rule('hideBank', '🏦', 'Sakrij banku', 'broj karata se ne vidi', 'broj karata se vidi', 'Niko ne vidi koliko je karata ostalo u banci i u špilu razvojnih karata.') +
    rule('friendlyRobber', '🤝', 'Prijateljski lopov', 'štiti slabe igrače', 'isključeno', 'Lopov ne može da se stavi na polje igrača koji ima 2 poena ili manje. Pomaže novim igračima.') +
    rule('fairDice', '⚖️', 'Fer kockice', 'manje sreće', 'obične kockice', 'Svih 36 kombinacija kockica izlazi redom kao iz špila, pa se brojevi pojavljuju onoliko često koliko i treba. Manje zavisi od sreće.') +
    rule('sameRes', '🧩', 'Iste sirovine jedna do druge', 'mogu da se dodiruju', 'nikad se ne dodiruju', 'Uključeno: polja se raspoređuju potpuno nasumično, pa dve iste sirovine (npr. dve šume) mogu biti jedna pored druge. Isključeno: ista polja se nikad ne dodiruju.') +
    rule('sameNum', '🔢', 'Isti brojevi jedan do drugog', 'mogu da se dodiruju', 'nikad se ne dodiruju', 'Uključeno: isti brojevi (npr. dve devetke) mogu biti na susednim poljima. Isključeno: isti brojevi se nikad ne dodiruju. Šestica i osmica nikad nisu jedna pored druge.') +
    rule('pairedPlayers', '👥', 'Parovi igrača', 'pomoćni potez uključen', 'isključeno', 'Pravilo za proširenje (5–8 igrača). Posle svakog poteza sledeći igrač odmah igra pomoćni potez: ne baca kockice, trguje sa bankom, lukama i samo sa glavnim igračem, gradi, kupuje i igra razvojne karte. Zatim on postaje glavni igrač i baca kockice.');
  const TIPS = {
    timer: 'Koliko vremena igrač ima za potez. Kad istekne, igra sama baci kockice ili završi potez.',
    maxPlayers: 'Najveći broj igrača u ovoj sobi.',
    vpToWin: 'Koliko poena treba za pobedu.',
    discardLimit: 'Kad padne 7, svako ko ima više karata od ovog broja odbacuje polovinu.',
    resCards: 'Koliko karata svake sirovine ima u banci na početku.',
    devCards: 'Koliko razvojnih karata ima u špilu.',
  };
  const stepper = (key, label, value, canDec, canInc) => `<div class="adv-item" title="${TIPS[key]}"><b>${label}</b><div class="stepper">
    <button data-dec="${key}" ${host && canDec ? '' : 'disabled'}>‹</button><span>${value}</span><button data-inc="${key}" ${host && canInc ? '' : 'disabled'}>›</button></div></div>`;
  const ti = TIMERS.indexOf(st.timer);
  const mapMax = MAPS.find((m) => m.id === st.map).max;
  $('advSettings').innerHTML =
    stepper('timer', 'Tajmer poteza', st.timer ? `${st.timer}s` : 'Bez', ti > 0, ti < TIMERS.length - 1) +
    stepper('maxPlayers', 'Broj igrača', `${st.maxPlayers}/${mapMax}`, st.maxPlayers > Math.max(2, S.players.length), st.maxPlayers < mapMax) +
    stepper('vpToWin', 'Poeni za pobedu', st.vpToWin, st.vpToWin > 3, st.vpToWin < 20) +
    stepper('discardLimit', 'Limit karata (lopov)', st.discardLimit, st.discardLimit > 5, st.discardLimit < 20) +
    stepper('resCards', 'Karte sirovina (po vrsti)', st.resCards, st.resCards > 10, st.resCards < 50) +
    stepper('devCards', 'Razvojne karte (ukupno)', st.devCards, st.devCards > 10, st.devCards < 80);
  $('startBtn').classList.toggle('hidden', !host);
  $('startBtn').disabled = S.players.length < 2;
  $('lobbyWait').classList.toggle('hidden', host);
}
$('lobby').addEventListener('click', (e) => {
  if (e.target.closest('[data-look]')) return showLookPicker();
  const b = e.target.closest('button'); if (!b || b.disabled) return;
  const st = S.settings;
  if (b.dataset.map) act('settings', { map: b.dataset.map });
  else if (b.dataset.rule) act('settings', { [b.dataset.rule]: !st[b.dataset.rule] });
  else if (b.dataset.kick) act('kick', { pid: b.dataset.kick });
  else if (b.dataset.inc || b.dataset.dec) {
    const key = b.dataset.inc || b.dataset.dec, d = b.dataset.inc ? 1 : -1;
    if (key === 'timer') act('settings', { timer: TIMERS[TIMERS.indexOf(st.timer) + d] });
    else act('settings', { [key]: st[key] + d });
  }
});
$('copyBtn').onclick = () => { $('inviteLink').select(); navigator.clipboard?.writeText($('inviteLink').value); toast('Link je kopiran. Pošalji ga prijateljima.'); };
$('startBtn').onclick = () => act('start');
function doLeave() { if (S && S.spectator) watching = null; else setSavedRoom(''); act('leave'); S = null; modalExtra = null; picker = null; tradeOpen = false; history.replaceState(null, '', '/'); showPage('rooms'); renderModal(); socket.emit('rooms'); }
$('leaveBtn').onclick = doLeave;

// ---------- tabla ----------
const SC = 62;
const TOKEN_SCALE = { base: 1, ext6: 1.2, ext8: 1.3 };
function hexPoints(hx, V, scale = 1) {
  return hx.corners.map((c) => `${(hx.x + (V[c].x - hx.x) * scale) * SC},${(hx.y + (V[c].y - hx.y) * scale) * SC}`).join(' ');
}
// ---------- skinovi (izgled figura), svaki igrac bira za sebe ----------
const SKINS = {
  osnovni: { name: 'Osnovni', desc: 'Klasične figure, prvi izgled igre.' },
  podvodni: { name: 'Podvodni svet', desc: 'Morsko dno: alge, korali, meduze, školjke i kristali umesto običnih sirovina. Sela su školjke, gradovi velike spiralne školjke, putevi nizovi bisera, a lopov je ajkula.' },
  tamni: { name: 'Osnovni – tamno', desc: 'Osnovni ravni izgled u tamnim bojama: tamnija polja, paneli i pozadina.' },
  tamne: { name: 'Kućice – tamno', desc: 'Isto kao Kućice, ali u tamnim bojama, kao noću: tamnija polja i paneli, a prozori na kućama svetle.' },
  kucice: { name: 'Kućice', desc: '3D izgled: polja sa drvećem, ovcama, žitom, ciglama i planinama, 3D putevi, lopov sa kapuljačom, ilustrovane karte i kućice u boji igrača.' },
};
let skin = 'osnovni';
try { if (SKINS[localStorage.getItem('ot_skin')]) skin = localStorage.getItem('ot_skin'); } catch (_) { /* */ }
const BASE_RES = JSON.parse(JSON.stringify(RES_INFO)), BASE_TERRAIN = JSON.parse(JSON.stringify(TERRAIN));
const DARK = { ...ART, BOARD: { ring1: '#0e2230', ring2: '#4a4231', hexStroke: '#5b5547', token: '#efe6cf', tokenInk: '#1d1a14', hot: '#d8433a', side: -0.6 } };
const SKA = () => (skin === 'kucice' ? ART : skin === 'tamne' ? DARK : skin === 'podvodni' ? SEA : null);
function applySkin() {
  themeKey = null; applyThemeScope();
  for (const r of RES) Object.assign(RES_INFO[r], BASE_RES[r], skin === 'podvodni' ? SEA.RES[r] : {});
  for (const t of Object.keys(TERRAIN)) Object.assign(TERRAIN[t], BASE_TERRAIN[t], skin === 'podvodni' ? SEA.TERRAIN[t] : {});
  if (skin === 'tamne' || skin === 'tamni') for (const t of Object.keys(TERRAIN)) { TERRAIN[t].a = shade(BASE_TERRAIN[t].a, -0.32); TERRAIN[t].b = shade(BASE_TERRAIN[t].b, -0.42); }
  if (skin === 'tamne' || skin === 'tamni') for (const r of RES) RES_INFO[r].color = shade(BASE_RES[r].color, -0.25);
}
function setSkin(k) { skin = k; try { localStorage.setItem('ot_skin', k); } catch (_) { /* */ } applySkin(); }
applySkin();
// u podvodnom svetu i dnevnik koristi nova imena sirovina
function skinWords(text) {
  if (skin !== 'podvodni') return text;
  const map = { drvo: 'drvo', glina: 'glina', ovca: 'vuna', 'žito': 'zito', kamen: 'kamen' };
  return text.replace(/(?<!\p{L})(drvo|glina|ovca|žito|kamen)(?!\p{L})/giu, (w) => SEA.RES[map[w.toLowerCase()]].name.toLowerCase());
}

function shade(hex, f) { // f<0 tamnije, f>0 svetlije
  const n = parseInt(hex.slice(1), 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f));
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
}
const pt = (p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`;
const poly = (pts, fill, extra = '') => `<polygon points="${pts.map(pt).join(' ')}" fill="${fill}" ${extra}/>`;
// izometrijska kuca: ugao napred dole je (ox, oy); wl/wr sirina leve/desne strane, h visina zida, rh visina krova
function isoHouse(ox, oy, wl, wr, h, rh, col, o = {}) {
  const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
  const B = [ox, oy], L = [ox - wl, oy - wl / 2], R = [ox + wr, oy - wr / 2], K = [ox + wr - wl, oy - (wl + wr) / 2];
  const up = (p, d = h) => [p[0], p[1] - d];
  const mid = [(L[0] + B[0]) / 2, (L[1] + B[1]) / 2];
  const A1 = up(mid, h + rh), A2 = add(A1, [wr, -wr / 2]);
  const ol = 'stroke="#1b1712" stroke-width="1.1" stroke-linejoin="round"';
  const roof = o.roof || '#3e4b5c';
  const face = (P0, P1, u1, u2, v1, v2) => { const f = (u, v) => [P0[0] + (P1[0] - P0[0]) * u, P0[1] + (P1[1] - P0[1]) * u - v * h]; return [f(u1, v1), f(u2, v1), f(u2, v2), f(u1, v2)]; };
  let s = poly([B, L, up(L), up(B)], shade(col, -0.22), ol) + poly([B, R, up(R), up(B)], col, ol);
  s += poly([up(L), up(B), A1], shade(col, -0.22), ol); // zabat
  // prozori i vrata
  const win = o.night ? '#3a3221' : '#e8f6ff', glass = o.night ? '#ffd36b' : '#7cc7ec';
  const floors = o.floors || 1;
  for (let f = 0; f < floors; f++) {
    const v1 = 0.22 + f / floors * 0.9 * (floors > 1 ? 1 : 0), v2 = v1 + 0.5 / floors;
    for (const [u1, u2] of o.door && f === 0 ? [[0.14, 0.38]] : [[0.14, 0.38], [0.6, 0.84]]) s += poly(face(B, R, u1, u2, v1, v2), win) + poly(face(B, R, u1 + 0.04, u2 - 0.04, v1 + 0.06, v2 - 0.06), glass);
    if (o.door && f === 0) s += poly(face(B, R, 0.6, 0.8, 0, 0.62), '#6b3f22');
    s += poly(face(B, L, 0.35, 0.65, v1, v2), win) + poly(face(B, L, 0.39, 0.61, v1 + 0.06, v2 - 0.06), glass);
  }
  s += poly([up(L), A1, A2, up(K)], shade(roof, 0.18), ol); // zadnja strana krova
  s += poly([up(B, h - 0.5), up(R, h - 0.5), add(A2, [0, 0]), A1], roof, ol); // prednja strana krova
  if (o.chimney) { const c = add(A2, [-wr * 0.35, wr * 0.35 / 2 + 1.5]); s += poly([c, add(c, [3, -1.5]), add(c, [3, -7.5]), add(c, [0, -6])], '#8a5a3c', ol); }
  return s;
}
function pieceSVG(type, x, y, col) {
  if (skin === 'podvodni') return SEA.piece(type, x, y, col);
  if (skin === 'kucice' || skin === 'tamne') {
    const n = skin === 'tamne';
    if (type === 'settlement') return `<g class="piece" transform="translate(${x} ${y}) scale(1.45)">${isoHouse(-1, 14.5, 10, 12, 9, 9, col, { door: true, night: n })}</g>`;
    return `<g class="piece" transform="translate(${x} ${y}) scale(1.3)">${isoHouse(-4.5, 16, 11, 15, 17, 10, col, { floors: 2, chimney: true, night: n })}${isoHouse(7.5, 23, 7, 8, 7, 6, col, { door: true, night: n, roof: shade(col, -0.45) })}</g>`;
  }
  // osnovni izgled: ravne 2D kucice i zgrade
  const ol = 'stroke="#1b1712" stroke-width="2" stroke-linejoin="round"';
  const d = shade(col, -0.3), w = '#fff6d8';
  if (type === 'settlement') {
    return `<g class="piece" transform="translate(${x} ${y}) scale(1.25) translate(${-x} ${-y})"><rect x="${x + 4}" y="${y - 13}" width="4" height="8" fill="${d}" ${ol}/>
      <rect x="${x - 9}" y="${y - 3}" width="18" height="14" fill="${col}" ${ol}/>
      <path d="M${x - 12} ${y - 2} L${x} ${y - 13} L${x + 12} ${y - 2} Z" fill="${d}" ${ol}/>
      <rect x="${x - 6}" y="${y + 2}" width="5" height="9" fill="#5a3a22"/>
      <rect x="${x + 2}" y="${y + 1}" width="5" height="5" fill="${w}" stroke="#1b1712" stroke-width="1"/></g>`;
  }
  let win = '';
  for (let r = 0; r < 4; r++) for (let c = 0; c < 2; c++) win += `<rect x="${x - 13 + c * 6}" y="${y - 13 + r * 6}" width="3.5" height="3.5" fill="${w}"/>`;
  for (let c = 0; c < 2; c++) win += `<rect x="${x + 2 + c * 6}" y="${y - 1}" width="3.5" height="3.5" fill="${w}"/><rect x="${x + 2 + c * 6}" y="${y + 5}" width="3.5" height="3.5" fill="${w}"/>`;
  return `<g class="piece" transform="translate(${x} ${y}) scale(1.2) translate(${-x} ${-y})"><rect x="${x - 16}" y="${y - 18}" width="16" height="30" fill="${col}" ${ol}/>
    <rect x="${x - 14}" y="${y - 21}" width="12" height="3" fill="${d}" ${ol}/>
    <rect x="${x}" y="${y - 5}" width="16" height="17" fill="${d}" ${ol}/>
    <rect x="${x - 1}" y="${y - 7}" width="18" height="3" fill="${col}" ${ol}/>${win}</g>`;
}
// porodice izgleda: svetla i tamna verzija su jedna kartica sa prekidacem
const SKIN_FAMS = [
  { name: 'Osnovni', light: 'osnovni', dark: 'tamni' },
  { name: 'Kućice', light: 'kucice', dark: 'tamne' },
  { name: 'Podvodni svet', light: 'podvodni' },
];
let darkPref = false;
try { darkPref = localStorage.getItem('ot_dark') === '1' || skin === 'tamni' || skin === 'tamne'; } catch (_) { /* */ }
function showSkinPicker() {
  const demo = (k) => { const prev = skin; skin = k; const c = (S && pById(S.me)?.color) || '#e07ab8'; const out = `<svg viewBox="-36 -36 92 66" width="150" height="94">${pieceSVG('settlement', -12, 0, c)}${pieceSVG('city', 22, -2, c)}</svg>`; skin = prev; return out; };
  modalExtra = () => `<div class="skin-head"><h3>🎨 Izgled igre</h3><button class="mode-tg ${darkPref ? 'on' : ''}" data-darkall title="Svetli ili tamni režim za sve izglede">☀️<i></i>🌙 <span>${darkPref ? 'Tamno' : 'Svetlo'}</span></button></div>
    <p class="muted">Menja se samo kod tebe, drugi igrači biraju svoj izgled.</p>
    <div class="pick">${SKIN_FAMS.map((f) => {
      const mine = skin === f.light || skin === f.dark;
      const dark = f.dark && darkPref;
      const k = dark ? f.dark : f.light;
      return `<div class="skin-fam ${mine ? 'sel' : ''} ${dark ? 'is-dark' : ''}"><button class="skin-opt" data-skin="${k}" title="${SKINS[k].desc}">${demo(k)}<b>${f.name}</b></button>
        </div>`;
    }).join('')}</div>
    <button class="ob" data-close>Gotovo</button>`;
  renderModal();
}

function renderBoard() {
  const svg = $('board');
  const B = S.board, V = B.vertices;
  const xs = [...V.map((v) => v.x), ...B.ports.map((p) => p.x)], ys = [...V.map((v) => v.y), ...B.ports.map((p) => p.y)];
  const pad = 0.55;
  const minX = Math.min(...xs) - pad, maxX = Math.max(...xs) + pad, minY = Math.min(...ys) - pad, maxY = Math.max(...ys) + pad;
  boardVB = [minX * SC, minY * SC, (maxX - minX) * SC, (maxY - minY) * SC];
  applyView();
  const L = (myTurn() && S.legal) || {};
  let h = '<defs>';
  for (const [k, t] of Object.entries(TERRAIN)) h += `<radialGradient id="g-${k}" cx="50%" cy="40%" r="65%"><stop offset="0" stop-color="${t.a}"/><stop offset="1" stop-color="${t.b}"/></radialGradient>`;
  h += '</defs>';

  const SK = SKA(), K3 = !!SK, BD = (SK && SK.BOARD) || (skin === 'tamni' ? DARK.BOARD : null);
  // plicak i pesak oko ostrva
  for (const hx of B.hexes) h += `<polygon points="${hexPoints(hx, V, 1.32)}" fill="${BD ? BD.ring1 : '#3f9fb8'}" opacity="${BD ? 0.9 : 0.55}" stroke="${BD ? BD.ring1 : '#3f9fb8'}" stroke-width="10" stroke-linejoin="round"/>`;
  for (const hx of B.hexes) h += `<polygon points="${hexPoints(hx, V, 1.14)}" fill="${BD ? BD.ring2 : '#ecd9a2'}" stroke="${BD ? BD.ring2 : '#ecd9a2'}" stroke-width="6" stroke-linejoin="round"/>`;

  // luke (molovi)
  for (const p of B.ports) {
    const e = B.edges[p.edge];
    for (const v of [V[e.a], V[e.b]]) {
      h += `<line x1="${p.x * SC}" y1="${p.y * SC}" x2="${v.x * SC}" y2="${v.y * SC}" stroke="#7a5532" stroke-width="7" stroke-linecap="round"/>`;
      h += `<line x1="${p.x * SC}" y1="${p.y * SC}" x2="${v.x * SC}" y2="${v.y * SC}" stroke="#a87a4c" stroke-width="3" stroke-dasharray="3 5"/>`;
    }
  }

  // polja
  if (K3) for (const hx of B.hexes) h += `<polygon points="${hexPoints(hx, V, 0.97).split(' ').map((q) => { const [a, b] = q.split(','); return `${a},${+b + 8}`; }).join(' ')}" fill="${shade(TERRAIN[hx.terrain].b, BD ? BD.side : -0.4)}" stroke="#00000030" stroke-width="2" stroke-linejoin="round"/>`;
  for (const hx of B.hexes) {
    const t = TERRAIN[hx.terrain];
    h += `<polygon points="${hexPoints(hx, V, 0.96)}" fill="url(#g-${hx.terrain})" stroke="${BD ? BD.hexStroke : '#fff6dc'}" stroke-width="${K3 ? 2 : 3}" stroke-linejoin="round"/>`;
    if (K3) h += SK.terrain(hx.terrain, hx.x * SC, hx.y * SC, TOKEN_SCALE[B.layout] || 1);
    else h += `<text x="${hx.x * SC}" y="${hx.y * SC - (hx.num ? 12 * (TOKEN_SCALE[B.layout] || 1) : -10)}" text-anchor="middle" font-size="${hx.num ? 26 : 34}">${t.ico}</text>`;
    if (hx.num) {
      const hot = hx.num === 6 || hx.num === 8;
      const pips = 6 - Math.abs(7 - hx.num);
      const col = hot ? (BD ? BD.hot : '#c0392b') : (BD ? BD.tokenInk : '#2a241c');
      const k = TOKEN_SCALE[B.layout] || 1; // na vecim mapama brojevi su veci
      const cx = hx.x * SC, top = hx.y * SC - 4 * k, w = 36 * k;
      h += `<rect x="${cx - w / 2}" y="${top}" width="${w}" height="${w}" rx="${7 * k}" fill="${BD ? BD.token : '#fffaf0'}" stroke="#0003" stroke-width="1.5"/>`;
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
      ${!generic && SK ? SK.cardSVG(p.type, `x="${x - 17}" y="${y - 21}" width="34" height="24"`) : `<text x="${x}" y="${y - 3}" text-anchor="middle" font-size="16" fill="#fff" font-weight="800">${generic ? '?' : RES_INFO[p.type].ico}</text>`}
      <text x="${x}" y="${y + 17}" text-anchor="middle" font-size="12" font-weight="800" fill="#2a241c">${generic ? '3:1' : '2:1'}</text></g>`;
  }

  // lopov
  const rb = B.hexes[B.robber];
  if (SK) h += SK.robber(rb.x * SC + 27, rb.y * SC - 4);
  else h += `<g transform="translate(${rb.x * SC + 26},${rb.y * SC + 4})"><ellipse cx="0" cy="18" rx="12" ry="4" fill="#0006"/>
    <path d="M-10 17 Q-12 -2 0 -5 Q12 -2 10 17 Z" fill="#3a3640" stroke="#111" stroke-width="1.5"/><circle cx="0" cy="-10" r="8" fill="#3a3640" stroke="#111" stroke-width="1.5"/></g>`;

  // putevi: spajaju se teme u teme; prvo sve ivice, pa boje, da se spojevi ne seku
  const roadLines = Object.entries(S.roads).map(([eid, pid]) => {
    const e = B.edges[eid]; const a = V[e.a], b = V[e.b];
    return { x1: a.x * SC, y1: a.y * SC, x2: b.x * SC, y2: b.y * SC, col: pById(pid).color };
  });
  if (SK) {
    const rr = roadLines.map(SK.road);
    for (const r of rr) h += r.under;
    for (const r of rr) h += r.top;
  } else {
    // osnovni: put sa ivicama i isprekidanom linijom po sredini
    for (const r of roadLines) h += `<line x1="${r.x1}" y1="${r.y1}" x2="${r.x2}" y2="${r.y2}" stroke="#1b1712" stroke-width="13" stroke-linecap="round"/>`;
    for (const r of roadLines) h += `<line x1="${r.x1}" y1="${r.y1}" x2="${r.x2}" y2="${r.y2}" stroke="${r.col}" stroke-width="9" stroke-linecap="round"/>`;
    for (const r of roadLines) {
      const len = Math.hypot(r.x2 - r.x1, r.y2 - r.y1), k = 7 / len;
      h += `<line x1="${r.x1 + (r.x2 - r.x1) * k}" y1="${r.y1 + (r.y2 - r.y1) * k}" x2="${r.x2 - (r.x2 - r.x1) * k}" y2="${r.y2 - (r.y2 - r.y1) * k}" stroke="#fffbea" stroke-width="1.6" stroke-dasharray="5 4" opacity=".9"/>`;
    }
  }
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
    h += pieceSVG(b.type, x, y, col);
    if (L.cities && (mode === 'city' || (!mode && !tradeOpen && can.city)) && L.cities.includes(Number(vid))) h += `<circle class="spot" data-v="${vid}" data-kind="city" cx="${x}" cy="${y}" r="17" fill-opacity=".35"/>`;
  }
  const showSett = L.settlements && (S.sub === 'settlement' || mode === 'settlement' || (!mode && !tradeOpen && can.settlement));
  if (showSett) for (const vid of L.settlements) h += `<circle class="spot" data-v="${vid}" data-kind="settlement" cx="${V[vid].x * SC}" cy="${V[vid].y * SC}" r="10"/>`;
  const sum = S.dice ? S.dice[0] + S.dice[1] : 0;
  if (sum && sum !== 7 && S.phase === 'play' && S.sub !== 'roll' && !S.rolling) for (const hx of B.hexes) {
    if (hx.num === sum) h += `<polygon class="hex-hit ${hx.id === B.robber ? 'blocked' : ''}" points="${hexPoints(hx, V, 0.96)}"/>`;
  }
  if (L.robber && S.sub === 'robber') for (const hid of L.robber) h += `<polygon class="hex-target" data-hex="${hid}" points="${hexPoints(B.hexes[hid], V, 0.96)}"/>`;

  svg.innerHTML = h;
}
// ---------- zumiranje i pomeranje mape ----------
let boardVB = null;
const view = { z: 1, x: 0, y: 0 };
function applyView() {
  if (!boardVB) return;
  const [bx, by, bw, bh] = boardVB;
  view.z = Math.min(3.5, Math.max(1, view.z));
  const w = bw / view.z, h = bh / view.z;
  const mx = (bw - w) / 2 + bw * 0.15, my = (bh - h) / 2 + bh * 0.15; // koliko sme da se pomeri
  view.x = Math.max(-mx, Math.min(mx, view.x)); view.y = Math.max(-my, Math.min(my, view.y));
  $('board').setAttribute('viewBox', `${bx + (bw - w) / 2 + view.x} ${by + (bh - h) / 2 + view.y} ${w} ${h}`);
  const zr = $('zoomReset'); if (zr) zr.textContent = Math.round(view.z * 100) + '%';
}
function svgPoint(cx, cy) { // tacka ekrana -> koordinate table
  const p = $('board').createSVGPoint(); p.x = cx; p.y = cy;
  return p.matrixTransform($('board').getScreenCTM().inverse());
}
function zoomAt(f, cx, cy) {
  const before = cx != null ? svgPoint(cx, cy) : null;
  view.z *= f; applyView();
  if (before) { const after = svgPoint(cx, cy); view.x += before.x - after.x; view.y += before.y - after.y; applyView(); }
}
$('board').addEventListener('wheel', (e) => { e.preventDefault(); zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX, e.clientY); }, { passive: false });
let drag = null, dragged = false;
const touches = new Map(); let pinch = null; // dva prsta na telefonu = zum
$('board').addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'touch') {
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touches.size === 2) { const [a, b] = [...touches.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) }; drag = null; dragged = true; return; }
  }
  if (e.button !== 0) return; drag = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y }; dragged = false;
});
window.addEventListener('pointermove', (e) => {
  if (touches.has(e.pointerId)) {
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && touches.size === 2) {
      const [a, b] = [...touches.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch.d > 0) zoomAt(d / pinch.d, (a.x + b.x) / 2, (a.y + b.y) / 2);
      pinch.d = d; return;
    }
  }
  if (!drag) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  if (!dragged && Math.hypot(dx, dy) < 6) return;
  dragged = true; $('board').classList.add('dragging');
  const ctm = $('board').getScreenCTM();
  view.x = drag.vx - dx / ctm.a; view.y = drag.vy - dy / ctm.d; applyView();
});
const endPointer = (e) => { touches.delete(e.pointerId); if (touches.size < 2) pinch = null; drag = null; $('board').classList.remove('dragging'); };
window.addEventListener('pointerup', endPointer);
window.addEventListener('pointercancel', endPointer);
// telefon: dnevnik, caskanje i banka su u panelu koji se otvara dugmetom
$('sideTab').onclick = () => $('game').classList.toggle('side-open');
$('sideClose').onclick = () => $('game').classList.remove('side-open');
// posle prevlacenja ne racuna se klik (da se slucajno ne sagradi nesto)
$('board').addEventListener('click', (e) => { if (dragged) { e.stopImmediatePropagation(); dragged = false; } }, true);
$('zoomIn').onclick = () => zoomAt(1.25);
$('zoomOut').onclick = () => zoomAt(1 / 1.25);
$('zoomReset').onclick = () => { view.z = 1; view.x = 0; view.y = 0; applyView(); };

let pendingBuild = null;
// uz podesavanje "Potvrda pre gradnje" prvo se pita igrac
function build(what, fn) {
  if (!PREFS.confirmBuild) return fn();
  pendingBuild = fn;
  const label = { road: '🛤️ put', settlement: '🏠 selo', city: '🏰 grad' }[what];
  modalExtra = () => `<h3>Sagradi ${label} ovde?</h3><div class="row"><button class="ob" data-bconfirm>✔ Sagradi</button><button class="ob gray" data-close>Otkaži</button></div>`;
  renderModal();
}
$('board').addEventListener('click', (ev) => {
  const t = ev.target;
  if (t.dataset.e !== undefined) build('road', () => { act('placeRoad', { e: t.dataset.e }); if (S.sub === 'main') mode = null; render(); });
  else if (t.dataset.kind === 'settlement') build('settlement', () => { act('placeSettlement', { v: t.dataset.v }); mode = null; render(); });
  else if (t.dataset.kind === 'city') build('city', () => { act('placeCity', { v: t.dataset.v }); mode = null; render(); });
  else if (t.dataset.hex !== undefined) act('moveRobber', { hex: t.dataset.hex });
});
// Precice na tastaturi
const KEYS = { e: 'end', t: 'trade', p: 'road', s: 'settlement', g: 'city', k: 'dev' };
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && modalExtra) { modalExtra = null; $('modalCard').innerHTML = ''; renderModal(); return; }
  if (e.target.matches('input, textarea, select') || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === 'Escape') { mode = null; tradeOpen = false; if (S) render(); return; }
  if (!S || (S.phase !== 'play' && S.phase !== 'setup')) return;
  if (e.key === '+' || e.key === '=') return zoomAt(1.25);
  if (e.key === '-') return zoomAt(1 / 1.25);
  if (e.key === '0') return $('zoomReset').click();
  if (e.code === 'Space') { e.preventDefault(); if (myTurn() && S.sub === 'roll') act('roll'); return; }
  const a = KEYS[e.key.toLowerCase()];
  if (a) { const b = document.querySelector(`#actions [data-a="${a}"]`); if (b && !b.disabled) b.click(); }
});

// ---------- kockice ----------
const PIP_POS = { 1: [[50, 50]], 2: [[28, 28], [72, 72]], 3: [[26, 26], [50, 50], [74, 74]], 4: [[28, 28], [72, 28], [28, 72], [72, 72]], 5: [[26, 26], [74, 26], [50, 50], [26, 74], [74, 74]], 6: [[28, 24], [72, 24], [28, 50], [72, 50], [28, 76], [72, 76]] };
let diceRolling = false;
const dieHTML = (n, cls = '', style = '') => `<div class="die ${cls}" style="${style}">${n ? PIP_POS[n].map(([x, y]) => `<i style="left:${x}%;top:${y}%"></i>`).join('') : ''}</div>`;
// karte lete sa polja koje je dalo sirovinu do ruke (tvoje) ili do panela igraca
function flyCards(prev) {
  if (!S || !S.dice || S.phase !== 'play' || !animMs(900)) return;
  const sum = S.dice[0] + S.dice[1]; if (sum === 7) return;
  const B = S.board, svg = $('board'), ctm = svg.getScreenCTM(); if (!ctm) return;
  const gotMore = (pid) => { const a = prev.players.find((p) => p.id === pid), b = pById(pid); return a && b && b.cards > a.cards; };
  const flights = [];
  for (const hx of B.hexes) {
    if (hx.num !== sum || hx.id === B.robber || hx.terrain === 'pustinja') continue;
    const res = Object.entries({ suma: 'drvo', gliniste: 'glina', pasnjak: 'vuna', polje: 'zito', planina: 'kamen' }).find(([t]) => t === hx.terrain)?.[1];
    for (const c of hx.corners) {
      const b = S.buildings[c]; if (!b || !gotMore(b.pid)) continue;
      for (let k = 0; k < (b.type === 'city' ? 2 : 1); k++) flights.push({ hx, res, pid: b.pid });
    }
  }
  flights.forEach((f, i) => setTimeout(() => {
    const p = svg.createSVGPoint(); p.x = f.hx.x * SC; p.y = f.hx.y * SC;
    const from = p.matrixTransform(ctm);
    let target = f.pid === S.me ? (document.querySelector(`#hand .rcard[data-r="${f.res}"]`) || $('hand')) : document.querySelector(`.pp[data-pid="${f.pid}"] .avatar`);
    if (!target || !target.offsetParent) target = document.querySelector(`.pp[data-pid="${f.pid}"]`) || $('hand');
    const r = target.getBoundingClientRect(), to = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    const el = document.createElement('div');
    el.className = 'fly-card';
    if (i < 8) SFX.play('card', 0);
    el.innerHTML = rcard(f.res, null);
    el.style.left = from.x + 'px'; el.style.top = from.y + 'px';
    document.body.appendChild(el);
    const dx = to.x - from.x, dy = to.y - from.y;
    const anim = el.animate([
      { transform: 'translate(-50%,-50%) scale(.3)', opacity: 0 },
      { transform: 'translate(-50%,-80%) scale(1.15)', opacity: 1, offset: 0.2 },
      { transform: `translate(calc(-50% + ${dx * 0.5}px), calc(-50% + ${dy * 0.5 - 60}px)) scale(1)`, opacity: 1, offset: 0.6 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(${f.pid === S.me ? 0.9 : 0.45})`, opacity: 0.2 },
    ], { duration: animMs(900), easing: 'cubic-bezier(.4,0,.2,1)' });
    anim.onfinish = () => {
      el.remove();
      target.classList.remove('got'); void target.offsetWidth; target.classList.add('got');
    };
  }, i * animMs(140)));
}

function renderDice() {
  const d = S.dice;
  $('dice').className = 'dice dice-' + (pById(S.turn)?.dice || 'klasicne');
  const key = d ? `${S.turnNum}-${d}` : '';
  $('dice').style.cursor = myTurn() && S.sub === 'roll' ? 'pointer' : '';
  if (key && key !== lastDiceKey && lastDiceKey !== '') {
    // nova bacanja: kockice se kotrljaju ~0.85s pa padnu na pravi broj
    lastDiceKey = key;
    diceRolling = true;
    const start = performance.now();
    const step = () => {
      const t = performance.now() - start;
      if (t < animMs(850)) {
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
const RES_TIP = { drvo: 'iz šume', glina: 'iz gliništa', vuna: 'sa pašnjaka', zito: 'sa polja', kamen: 'iz planine' };
const rcard = (r, n, extra = '') => `<div class="rcard ${extra}" data-r="${r}" style="background-color:${RES_INFO[r].color};--c:${RES_INFO[r].color}" title="${RES_INFO[r].name} (${RES_TIP[r]})${extra.includes('click') ? ' – klikni za trgovinu' : ''}">${SKA() ? `<i class="art">${SKA().cardSVG(r)}</i><b class="lbl">${RES_INFO[r].name}</b>` : RES_INFO[r].ico}${n !== null ? `<span class="cnt">${n}</span>` : ''}</div>`;
function renderHand() {
  if (S.spectator) { $('hand').innerHTML = '<span class="spec-note">👀 Gledaš ovu igru. Karte igrača se ne vide.</span>'; return; }
  let h = RES.filter((r) => S.hand[r] > 0).map((r) => rcard(r, S.hand[r] - (tradeOpen ? tradeGive[r] || 0 : 0), tradeOpen ? 'click' : '')).join('');
  if (!h) h = '<span style="color:var(--muted)">Nemaš karte sirovina.</span>';
  else if (myTurn() && S.sub === 'main') h = h.replace(/class="rcard /g, 'class="rcard click ');
  const groups = {};
  for (const d of S.dev) { groups[d.type] ??= { n: 0, ready: 0 }; groups[d.type].n++; if (!d.fresh) groups[d.type].ready++; }
  const dev = Object.entries(groups).map(([type, g]) => `<div class="rcard dev ${g.ready ? '' : 'fresh'}" data-dev="${type}" title="${DEV_INFO[type].name}: ${DEV_INFO[type].desc}${g.ready ? '' : ' (kupljena u ovom potezu)'}">${SKA() ? `<i class="art">${SKA().cardSVG(type)}</i>` : DEV_INFO[type].ico}<small>${DEV_INFO[type].name}</small><span class="cnt">${g.n}</span></div>`).join('');
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
  if (!(myTurn() && S.sub === 'main') && !canPropose()) return toast('Trgovati možeš kad si na potezu, posle bacanja kockica.');
  tradeOpen = true; mode = null; tradeGive = {}; tradeGet = {};
  counterMode = !myTurn();
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
  else if (S.sub === 'robber') txt = myTurn() ? 'Pomeri lopova' : `${who} pomera lopova`;
  else if (S.sub === 'steal') txt = myTurn() ? 'Izaberi od koga kradeš' : `${who} krade kartu`;
  else if (S.sub === 'roadBuilding') txt = myTurn() ? `Postavi besplatan put (${S.freeRoads})` : `${who} gradi puteve`;
  else if (S.helperOf) txt = myTurn() ? (mode ? `Izaberi mesto (Esc za otkaz)` : '👥 Tvoj pomoćni potez') : `👥 Pomoćni potez: ${who}`;
  else txt = myTurn() ? (mode ? `Izaberi mesto (Esc za otkaz)` : 'Tvoj red') : `Na potezu: ${who}`;
  const st = $('status');
  st.className = 'status' + (click ? ' click' : '');
  st.title = S.helperOf && S.phase === 'play' ? `Pomoćni potez: bez kockica. Trgovina sa bankom, lukama i samo sa glavnim igračem (${pById(S.helperOf).name}). Može da se gradi i igraju razvojne karte.` : '';
  if (S.spectator) txt = '👀 ' + txt;
  st.innerHTML = `<div class="avatar" style="background:${cur.color};width:32px;height:32px;font-size:16px;border-width:2px">${avatarOf(cur)}</div><span>${esc(txt)}</span>`;
}
$('status').onclick = () => { if (S && myTurn() && S.sub === 'roll') act('roll'); };

function fmtDur(ms) {
  const sec = Math.max(0, Math.floor(ms / 1000)), h = Math.floor(sec / 3600), m = Math.floor(sec / 60) % 60, s2 = sec % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s2).padStart(2, '0')}` : `${String(m).padStart(2, '0')}:${String(s2).padStart(2, '0')}`;
}
setInterval(() => {
  if (!S || S.phase === 'lobby') return;
  if (S.startedAt) $('gameClock').textContent = '⏱ ' + fmtDur((S.endedAt || (Date.now() + clockOffset)) - S.startedAt);
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
  if (S.spectator) { $('actions').innerHTML = `<button class="act" data-a="stopwatch" title="Prestani da gledaš i vrati se na sobe">🚪<small>Izađi</small></button>`; return; }
  const main = myTurn() && S.sub === 'main' && S.phase === 'play';
  const L = S.legal || {};
  // dugme je ukljuceno samo ako imas sirovine I postoji mesto na tabli
  const why = (cost, left, spots, what) => !main ? '' : !canAfford(cost) ? 'Nemaš dovoljno sirovina' : left <= 0 ? `Nemaš više: ${what}` : spots === 0 ? `Nema slobodnog mesta za ${what}` : '';
  const b = (a, ico, label, enabled, cnt, extra = '', reason = '') => `<button class="act ${extra} ${mode === a || (a === 'trade' && tradeOpen) ? 'on' : ''}" data-a="${a}" ${enabled ? '' : 'disabled'} title="${reason || label}">${ico}<small>${label}</small>${cnt !== undefined ? `<span class="cnt">${cnt}</span>` : ''}</button>`;
  const rs = L.roads?.length ?? 0, ss = L.settlements?.length ?? 0, cs = L.cities?.length ?? 0;
  const D = {
    trade: 'Trgovina (T): razmeni karte sa igračima ili bankom. Možeš i da klikneš kartu u svojoj ruci.',
    dev: 'Razvojna karta (K): 🐑🌾🪨. Može biti vitez, poen, putevi, obilje ili monopol. Broj = karte u špilu.',
    road: 'Put (P): 🌲🧱. Gradi se pored svog sela ili puta. Broj = preostali putevi.',
    settlement: 'Selo (S): 🌲🧱🐑🌾, 1 poen. Mora biti na tvom putu, bar 2 ivice od drugog sela.',
    city: 'Grad (G): 🌾🌾🪨🪨🪨, 2 poena. Pravi se od tvog sela i daje duplo sirovina.',
    end: 'Kraj poteza (E): predaj red sledećem igraču.',
  };
  $('actions').innerHTML =
    b('trade', '🤝', 'Trgovina', main || canPropose(), undefined, '', main || !canPropose() ? D.trade : 'Predloži razmenu igraču koji je na potezu. Može bilo kad tokom njegovog poteza.') +
    b('dev', '🃏', 'Karta', main && canAfford(COST.dev) && !S.devEmpty, S.devLeft ?? '?', '', D.dev + (main && S.devEmpty ? ' Nema više karata.' : main && !canAfford(COST.dev) ? ' Nemaš dovoljno sirovina.' : '')) +
    b('road', '🛤️', 'Put', main && canAfford(COST.road) && m.left.road > 0 && rs > 0, m.left.road, '', D.road + (why(COST.road, m.left.road, rs, 'put') ? ' ' + why(COST.road, m.left.road, rs, 'put') + '.' : '')) +
    b('settlement', '🏠', 'Selo', main && canAfford(COST.settlement) && m.left.settlement > 0 && ss > 0, m.left.settlement, '', D.settlement + (why(COST.settlement, m.left.settlement, ss, 'selo') ? ' ' + why(COST.settlement, m.left.settlement, ss, 'selo') + '.' : '')) +
    b('city', '🏰', 'Grad', main && canAfford(COST.city) && m.left.city > 0 && cs > 0, m.left.city, '', D.city + (why(COST.city, m.left.city, cs, 'grad') ? ' ' + why(COST.city, m.left.city, cs, 'grad') + '.' : '')) +
    b('end', '⏩', 'Kraj poteza', myTurn() && (S.sub === 'main' || S.sub === 'roadBuilding'), undefined, 'end', D.end);
}

// ---------- recepti (cene gradnje) ----------
let recipesOpen = true;
try { const v = localStorage.getItem('ot_recipes'); recipesOpen = v ? v !== '0' : !matchMedia('(max-width: 760px)').matches; } catch (_) { /* */ }
function renderRecipes() {
  const rows = [
    ['🛤️', 'Put', COST.road, '0 poena'],
    ['🏠', 'Selo', COST.settlement, '1 poen'],
    ['🏰', 'Grad', COST.city, '2 poena'],
    ['🃏', 'Razvojna karta', COST.dev, '?'],
  ];
  const cards = (c) => Object.entries(c).flatMap(([r, n]) => Array(n).fill(r)).map((r) => `<span class="rc" style="background:${RES_INFO[r].color}" title="${RES_INFO[r].name}">${SKA() ? SKA().cardSVG(r, 'class="rc-svg"') : RES_INFO[r].ico}</span>`).join('');
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
    ${S.spectator ? '' : v.target === S.me ? '<span>Ti ne glasaš.</span>' : `<button class="ob ${voted === 'da' ? '' : 'gray'}" data-vote="1">Da, izbaci</button><button class="ob ${voted === 'ne' ? 'red' : 'gray'}" data-vote="0">Ne</button>`}`;
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
  if (a === 'stopwatch') return doLeave();
  if (a === 'end') act('endTurn');
  else if (a === 'dev') act('buyDev');
  else if (a === 'trade') { tradeOpen = !tradeOpen; counterMode = tradeOpen && !myTurn(); mode = null; tradeGive = {}; tradeGet = {}; render(); }
  else { mode = mode === a ? null : a; tradeOpen = false; render(); }
});

// ---------- igraci i banka ----------
function playerPanel(p, big = false) {
  return `<div class="pp ${p.id === S.turn ? 'turn' : ''} ${big ? 'big' : ''}" data-pid="${p.id}" style="--pc:${p.color}">
    <div class="who"><div class="avatar ${frameCls(p)}" style="background:${p.color}">${avatarOf(p)}</div><span class="vpb" title="Poeni">${p.vp}</span></div>
    <div><div class="pname"><i class="pdot"></i>${esc(p.name)}${p.title ? `<small class="ptitle">${TITLES[p.title]}</small>` : ''} ${S.helperOf && p.id === S.helperOf ? '<span class="pair-tag" title="Glavni igrač ovog kruga: jedini sa kim pomoćni igrač sme da trguje">glavni</span>' : S.helperOf && p.id === S.turn ? '<span class="pair-tag help" title="Igra pomoćni potez: bez kockica, trguje samo sa glavnim igračem">pomoćni</span>' : ''}${p.kicked ? '<span class="off">izbačen</span>' : p.quit ? '<span class="off">napustio</span>' : p.connected ? '' : '<span class="off">van mreže</span>'}${!big && !p.kicked && !S.vote && (S.phase === 'play' || S.phase === 'setup') && !S.spectator && !me().quit ? `<button class="vk" data-votekick="${p.id}" title="Glasanje za izbacivanje">🥾</button>` : ''}</div>
    <div class="stats">
      <span class="st" title="Karte sirovina"><span class="i">🂠</span>${p.cards}</span>
      <span class="st" title="Razvojne karte"><span class="i">🃏</span>${p.devCards}</span>
      <span class="st ${p.largest ? 'won' : ''}" title="Odigrani vitezovi${p.largest ? ' – najveća vojska (+2)' : ''}"><span class="i">⚔️</span>${p.knights}</span>
      <span class="st ${p.longest ? 'won' : ''}" title="Najduži put${p.longest ? ' (+2)' : ''}"><span class="i">🛤️</span>${p.roadLen}</span>
    </div></div></div>`;
}
function renderPlayers() {
  const others = S.players.filter((p) => p.id !== S.me);
  const w = S.watchers || [];
  $('players').classList.toggle('compact', S.players.length > 4);
  $('players').innerHTML = others.map((p) => playerPanel(p)).join('') +
    (w.length ? `<div class="watchers" title="Gledaju: ${esc(w.join(', '))}">👀 Gleda: ${w.length}</div>` : '');
  $('mePanel').innerHTML = S.spectator ? '' : playerPanel(me(), true);
  $('mePanel').classList.toggle('hidden', !!S.spectator);
}
function renderBank() {
  const hidden = !S.bank;
  $('bank').innerHTML = `<span class="lbl" title="Banka${hidden ? ' (sakrivena)' : ''}">🏦</span>` + RES.map((r) => rcard(r, hidden ? '?' : S.bank[r], 'small')).join('') +
    `<div class="rcard small dev" title="Razvojne karte u špilu">🃏<span class="cnt">${hidden ? '?' : S.devLeft}</span></div>`;
}

// ---------- trgovina ----------
const miniCards = (o) => `<span class="mini">${Object.entries(o).map(([r, n]) => rcard(r, n)).join('')}</span>`;
// ostali igraci mogu da predloze razmenu igracu na potezu u bilo kom trenutku njegovog poteza
// u pomocnom potezu (Parovi igraca) predlog moze da posalje samo glavni igrac
function canPropose() { return !!S && !S.spectator && S.phase === 'play' && S.turn !== S.me && !me()?.quit && !pById(S.turn)?.quit && (!S.helperOf || S.helperOf === S.me); }
function renderOffers() {
  const t = S.trade;
  const box = $('offers');
  if (!t || S.spectator || S.phase !== 'play' || (S.helperOf && t.from !== S.me && S.helperOf !== S.me)) { box.classList.add('hidden'); return; }
  const from = pById(t.from);
  let h = t.open ? '<div class="offer"><div class="offer-row"><b>📨 Predlozi za razmenu</b></div>' : `<div class="offer"><div class="offer-row"><b>${esc(from.name)}</b> daje ${miniCards(t.give)} za ${miniCards(t.get)}</div>`;
  if (t.open && t.from !== S.me) {
    const c = t.counters?.[S.me];
    if (!c) { box.classList.add('hidden'); return; }
    h += `<div class="offer-row" style="margin-top:6px">Tvoj predlog za ${esc(from.name)}: daješ ${miniCards(c.get)} za ${miniCards(c.give)}</div><div class="offer-row" style="color:var(--muted)">Čeka se da ${esc(from.name)} odluči…</div></div>`;
    box.innerHTML = h; box.classList.remove('big-offer'); box.classList.toggle('hidden', tradeOpen); return;
  }
  if (t.from === S.me) {
    h += '<div class="offer-row" style="margin-top:8px">';
    h += t.accepted.map((id) => `<button class="ob" data-with="${id}" title="Završi razmenu sa ovim igračem">✔ ${esc(pById(id).name)}</button>`).join('');
    if (!t.open && !t.accepted.length && !Object.keys(t.counters || {}).length) h += '<span style="color:var(--muted)">Čeka se odgovor…</span>';
    if (t.declined.length) h += `<span style="color:var(--muted)">Odbili: ${t.declined.map((id) => esc(pById(id).name)).join(', ')}</span>`;
    if (!t.open) h += '<button class="ob gray" data-tr="cancel" style="margin-left:auto" title="Povuci svoju ponudu">Povuci</button>';
    h += '</div>';
    for (const [id, c] of Object.entries(t.counters || {})) {
      h += `<div class="offer-row counter"><b>${esc(pById(id).name)}</b> predlaže: ti daješ ${miniCards(c.give)} za ${miniCards(c.get)}
        <button class="ob" data-with="${id}" data-counter="1" title="Prihvati ovu kontraponudu i odmah razmeni">✔ Prihvati</button></div>`;
    }
  } else {
    // ponuda koja stize meni: velika i jasna
    const answered = t.accepted.includes(S.me) || t.declined.includes(S.me) || t.counters?.[S.me];
    const mine = t.accepted.includes(S.me) ? '✔ Prihvatio si, čeka se da ' + esc(from.name) + ' potvrdi.' : t.declined.includes(S.me) ? '✕ Odbio si ovu ponudu.' : t.counters?.[S.me] ? '✎ Poslao si kontraponudu.' : '';
    const cards = (o) => Object.entries(o).map(([r, n]) => rcard(r, n)).join('');
    const enough = Object.entries(t.get).every(([r, n]) => (S.hand[r] || 0) >= n);
    h = `<div class="offer incoming" style="--pc:${from.color}">
      <div class="inc-head"><div class="avatar" style="background:${from.color}">${avatarOf(from)}</div><div><b style="color:${from.color}">${esc(from.name)}</b> ti nudi razmenu</div></div>
      <div class="inc-rows"><div class="inc-row"><span class="inc-lbl get">⬇ Dobijaš</span><div class="inc-cards">${cards(t.give)}</div></div>
      <div class="inc-row"><span class="inc-lbl give">⬆ Daješ</span><div class="inc-cards">${cards(t.get)}</div></div></div>
      ${enough ? '' : '<div class="inc-warn">Nemaš dovoljno karata za ovu razmenu.</div>'}
      ${answered ? `<div class="inc-state">${mine}</div>` : ''}
      <div class="inc-btns"><button class="ob big" data-tr="accept" ${enough ? '' : 'disabled'} title="Prihvati ponudu (igrač na potezu zatim potvrđuje)">✔ Prihvati</button><button class="ob big red" data-tr="decline" title="Odbij ponudu">✕ Odbij</button><button class="ob big gray" data-tr="counter" title="Predloži svoje uslove razmene">✎ Kontraponuda</button></div>`;
  }
  h += '</div>';
  box.innerHTML = h;
  box.classList.toggle('hidden', tradeOpen);
  box.classList.toggle('big-offer', t.from !== S.me || !!t.open);
}
// Banka: svaka sirovina koju daješ mora biti umnožak svog odnosa (4, 8, 12… za 4:1;
// 3, 6… za 3:1; 2, 4… za 2:1), a broj karata iz banke = zbir (dato / odnos).
function bankTradeValid() {
  const give = Object.keys(tradeGive), get = Object.keys(tradeGet);
  if (!give.length || !get.length || give.some((r) => tradeGet[r])) return false;
  let units = 0;
  for (const r of give) {
    const rate = S.rates && S.rates[r];
    if (!rate || tradeGive[r] % rate) return false;
    units += tradeGive[r] / rate;
  }
  const want = get.reduce((a, r) => a + tradeGet[r], 0);
  if (units !== want) return false;
  return !S.bank || get.every((r) => S.bank[r] >= tradeGet[r]);
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
      ${counterMode
        ? `<button class="tbig" data-tr="sendcounter" ${canOffer ? '' : 'disabled'} title="Pošalji predlog igraču na potezu">✎<small>Predloži</small></button>`
        : `<button class="tbig" data-tr="bank" ${bankTradeValid() ? '' : 'disabled'} title="Trguj sa bankom: za svaku kartu iz banke daješ broj karata koji piše na kartici gore (4:1, 3:1 ili 2:1), npr. 8 za 2 ili 6 za 2">🏦<small>Banka</small></button>
      <button class="tbig" data-tr="offer" ${canOffer ? '' : 'disabled'} title="${S.helperOf ? 'Pomoćni potez: ponuda ide samo glavnom igraču' : 'Pošalji ponudu svim igračima; ti biraš sa kim ćeš razmeniti'}">👥<small>${S.helperOf ? esc(pById(S.helperOf).name) : 'Igračima'}</small></button>`}
      <button class="tbig close" data-tr="close" title="Zatvori trgovinu (Esc)">✕</button>
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
  if (b.dataset.with) return act('confirmTrade', { with: b.dataset.with, counter: !!b.dataset.counter });
  const a = b.dataset.tr;
  if (a === 'accept') act('respondTrade', { accept: true });
  if (a === 'decline') act('respondTrade', { accept: false });
  if (a === 'cancel') act('cancelTrade');
  if (a === 'close') { tradeOpen = false; counterMode = false; render(); }
  if (a === 'counter') {
    counterMode = true; tradeOpen = true;
    tradeGive = { ...S.trade.get }; tradeGet = { ...S.trade.give };
    for (const r of Object.keys(tradeGive)) { tradeGive[r] = Math.min(tradeGive[r], S.hand[r]); if (!tradeGive[r]) delete tradeGive[r]; }
    return render();
  }
  if (a === 'sendcounter') { act('counterTrade', { give: tradeGive, get: tradeGet }); counterMode = false; tradeOpen = false; tradeGive = {}; tradeGet = {}; return render(); }
  if (a === 'offer') { act('offerTrade', { give: tradeGive, get: tradeGet }); tradeGive = {}; tradeGet = {}; tradeOpen = false; render(); }
  if (a === 'bank') {
    if (!bankTradeValid()) return toast('Za banku: daj sirovinu u paketima po odnosu sa kartice gore (npr. 8 za 2 kod 4:1) i traži toliko karata koliko paketa daješ.');
    act('bankTrade', { give: { ...tradeGive }, get: { ...tradeGet } });
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
  log.innerHTML = S.log.map((l) => `<div class="nt ${l.text.startsWith('➡️') ? 'grp' : ''}">${colorNames(I18N.tr(skinWords(l.text)))}</div>`).join('');
  if (atBottom) log.scrollTop = log.scrollHeight;
  if (S.lastSteal && S.lastSteal.t > lastToastSteal) {
    lastToastSteal = S.lastSteal.t;
    const r = RES_INFO[S.lastSteal.res];
    toast(S.lastSteal.thief === S.me ? `Ukrao si: ${r.ico} ${r.name}` : `${pById(S.lastSteal.thief).name} ti je ukrao: ${r.ico} ${r.name}`);
  }
}
function renderChat() {
  const html = S.chat.map((c) => `<div class="nt"><b style="color:${c.color};text-shadow:0 0 1px #0008">${esc(c.name)}:</b> ${esc(c.text)}</div>`).join('') || '<div style="opacity:.6">Još nema poruka.</div>';
  for (const el of [$('chat'), $('lobbyChat')]) { el.innerHTML = html; el.scrollTop = el.scrollHeight; }
  document.querySelectorAll('[data-chat]').forEach((f) => f.classList.toggle('hidden', !!S.spectator)); // gledalac samo cita
  if (chatOpen || S.phase === 'lobby') seenChat = S.chat.length;
  const unread = S.chat.length - seenChat;
  $('chatBadge').textContent = unread > 0 ? unread : '';
  $('sideBadge').textContent = unread > 0 ? unread : '';
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
  if (S.spectator) return doLeave();
  const host = S.host === S.me && S.phase !== 'ended';
  modalExtra = () => `<h3>🚪 Izlaz</h3><p>Ako napustiš igru, tvoje figure ostaju na tabli, a igra će umesto tebe završavati poteze. Možeš da se vratiš preko linka sobe.</p>
    <div class="row" style="flex-wrap:wrap"><button class="ob red" data-exit>Napusti igru</button>${host ? '<button class="ob red" data-endgame>Prekini igru za sve</button>' : ''}<button class="ob gray" data-close>Otkaži</button></div>
    <p style="font-size:13px;color:var(--muted)">U ćaskanju možeš da kucaš i /izlaz ili /kraj.</p>`;
  renderModal();
}
$('exitBtn').onclick = showExitMenu;
$('skinBtn').onclick = showSkinPicker;
$('skinNav').onclick = showSkinPicker;
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
  modalExtra = () => `<div class="rules"><button class="modal-x" data-close title="Zatvori pravila (Esc)">✕</button><h3>📖 Kako se igra</h3>
    <p>Cilj: prvi skupi dovoljno poena (obično 10).</p>
    <h4>Poeni</h4><ul><li>Selo 1 poen, grad 2 poena</li><li>Najduži put (bar 5 puteva) +2</li><li>Najveća vojska (bar 3 viteza) +2</li><li>Karta „Poen“ +1</li></ul>
    <h4>Tok poteza</h4><ul><li>Baci kockice: svako polje sa tim brojem daje sirovine selima (1) i gradovima (2) oko njega.</li><li>Trguj sa igračima ili bankom (4:1, a sa lukom 3:1 ili 2:1).</li><li>Gradi i završi potez.</li></ul>
    <h4>Cene</h4><ul><li>Put: 🌲🧱</li><li>Selo: 🌲🧱🐑🌾</li><li>Grad: 🌾🌾🪨🪨🪨</li><li>Razvojna karta: 🐑🌾🪨</li></ul>
    <h4>👥 Parovi igrača (opcija u podešavanjima)</h4><ul><li>Glavni igrač igra svoj potpuno normalan potez: baca kockice, trguje sa svima i gradi.</li><li>Odmah zatim sledeći igrač igra <b>pomoćni potez</b>: ne baca kockice, trguje sa bankom, preko svojih luka i <b>samo sa glavnim igračem</b>, gradi, kupuje i igra razvojne karte.</li><li>Kad pomoćni igrač završi, on postaje glavni igrač i baca kockice, a sledeći do njega postaje novi pomoćni igrač.</li></ul>
    <h4>Sedmica</h4><p>Ko ima više karata od limita odbacuje polovinu. Igrač na potezu pomera lopova (to polje ne daje sirovine) i krade jednu kartu.</p>
    <h4>Tasteri</h4><p><b>Space</b> baci kockice · <b>E</b> kraj poteza · <b>T</b> trgovina · <b>P</b> put · <b>S</b> selo · <b>G</b> grad · <b>K</b> razvojna karta · <b>Esc</b> otkaži · <b>+</b> / <b>−</b> zum mape · <b>0</b> cela mapa. Točkić miša zumira, a mapu pomeraš držanjem levog klika.</p>
    <h4>Izbacivanje</h4><p>Klikni 🥾 pored imena igrača da pokreneš glasanje. Ako se većina ostalih složi, igrač je izbačen.</p>
    <h4>Komande u ćaskanju</h4><p><b>/izlaz</b> napusti igru · <b>/kraj</b> osnivač prekida igru za sve</p>
    <h4>Postavljanje</h4><p>Svako postavlja selo i put, pa opet obrnutim redom. Drugo selo odmah daje sirovine.</p>
    <button class="ob" data-close>Zatvori</button></div>`;
  renderModal();
}
function statsHTML() {
  const st = S.stats; if (!st) return '';
  const rolls = st.rolls || {};
  const total = Object.values(rolls).reduce((a, b) => a + b, 0);
  const max = Math.max(1, ...Object.values(rolls));
  const expected = (n) => (6 - Math.abs(7 - n)) / 36 * total;
  const dur = S.startedAt && S.endedAt ? fmtDur(S.endedAt - S.startedAt) : '';
  let h = (dur ? `<p class="stat-dur">⏱ Igra je trajala <b>${dur}</b> · ${S.turnNum || 0} poteza</p>` : '') + `<h4 style="margin:14px 0 6px">🎲 Kockice (${total} bacanja)</h4><div class="hist">`;
  for (let n = 2; n <= 12; n++) {
    const c = rolls[n] || 0;
    h += `<div class="hcol" title="${n} je pao ${c} puta (očekivano oko ${expected(n).toFixed(1)})"><span class="hv">${c}</span><div class="hbar ${n === 7 ? 'seven' : ''}" style="height:${(c / max) * 70}px"></div><span class="hn">${n}</span></div>`;
  }
  h += '</div><h4 style="margin:14px 0 6px">📊 Igrači</h4><table class="stat-table"><tr><th></th><th title="Dobijene sirovine od kockica">🎲 Dobio</th><th title="Ukradene karte">🦹 Ukrao</th><th title="Karte koje su mu ukradene">😢 Izgubio</th><th title="Odbačene karte na 7">🗑️ Odbacio</th><th title="Razmene sa igračima">🤝</th><th title="Razmene sa bankom">🏦</th><th title="Kupljene razvojne karte">🃏</th></tr>';
  for (const p of S.players) {
    const x = (st.players || {})[p.id] || {};
    h += `<tr><td><b style="color:${p.color};text-shadow:0 0 1px #0008">${esc(p.name)}</b></td><td>${x.gained || 0}</td><td>${x.stolen || 0}</td><td>${x.lost || 0}</td><td>${x.discarded || 0}</td><td>${x.trades || 0}</td><td>${x.bank || 0}</td><td>${x.dev || 0}</td></tr>`;
  }
  return h + '</table>';
}

function showLookPicker() {
  const m = me();
  const taken = new Set(S.players.filter((p) => p.id !== S.me).map((p) => p.color));
  modalExtra = () => {
    const cur = me();
    return `<h3>🎨 Tvoja boja i avatar</h3>
    <div class="pick">${S.colors.map((c) => `<button class="swatch ${cur.color === c ? 'sel' : ''}" data-color="${c}" ${taken.has(c) ? 'disabled title="Ovu boju već ima drugi igrač"' : 'title="Izaberi ovu boju"'} style="background:${c}"></button>`).join('')}</div>
    <div class="pick">${AVATARS.map((a, i) => `<button class="av ${avatarOf(cur) === a ? 'sel' : ''}" data-avatar="${i}" title="Izaberi ovog avatara">${a}</button>`).join('')}</div>
    <button class="ob" data-close>Gotovo</button>`;
  };
  renderModal();
}

// pobednicka proslava koju je pobednik izabrao u Profilu
function celebration(w) {
  const kind = w?.win || 'konfete';
  const n = kind === 'vatromet' ? 10 : 28;
  return `<div class="confetti cel-${kind}">${Array.from({ length: n }, (_, i) => {
    const st = `left:${(i * 37) % 100}%;animation-delay:${(i % 7) * 0.25}s;animation-duration:${2.4 + (i % 5) * 0.4}s`;
    if (kind === 'zlatnici') return `<i style="${st}">🪙</i>`;
    if (kind === 'baloni') return `<i style="${st}">🎈</i>`;
    if (kind === 'vatromet') return `<i style="left:${8 + (i * 29) % 84}%;top:${10 + (i * 17) % 45}%;--c:${COLOR_ORDER[i % COLOR_ORDER.length]};animation-delay:${(i % 5) * 0.4}s"></i>`;
    return `<i style="${st};background:${COLOR_ORDER[i % COLOR_ORDER.length]}"></i>`;
  }).join('')}</div>`;
}

function renderModal() {
  const modal = $('modal'), card = $('modalCard');
  let h = null;
  if (S && S.phase === 'ended') {
    const ranking = [...S.players].sort((a, b) => b.vp - a.vp);
    const podium = [ranking[1], ranking[0], ranking[2]].map((p, k) => {
      if (!p) return '<div class="pod-col empty"></div>';
      const place = [2, 1, 3][k];
      return `<div class="pod-col p${place}" style="--pc:${p.color}">
        <div class="pod-who">${place === 1 && S.winner ? '<span class="crown">👑</span>' : ''}<div class="avatar ${frameCls(p)}" style="background:${p.color}">${avatarOf(p)}</div></div>
        <div class="pod-name">${esc(p.name)}</div>${p.title ? `<div class="ptitle">${TITLES[p.title]}</div>` : ''}<div class="pod-vp">${p.vp} poena</div>
        <div class="pod-block">${place}</div></div>`;
    }).join('');
    const rest = ranking.slice(3);
    const confetti = S.winner ? celebration(pById(S.winner)) : '';
    h = `${confetti}<h3 class="end-title">${S.winner ? `🏆 ${esc(pById(S.winner).name)} je pobedio!` : `🛑 Igra je prekinuta${S.endedBy ? ` (prekinuo ${esc(pById(S.endedBy).name)})` : ''}`}</h3>
      <div class="podium">${podium}</div>
      ${rest.length ? `<table class="rest-table">${rest.map((p, i) => `<tr style="--pc:${p.color}"><td><b>${i + 4}.</b></td><td><div class="avatar ${frameCls(p)}" style="background:${p.color}">${avatarOf(p)}</div></td><td class="rn">${esc(p.name)}</td><td title="Vitezovi">⚔️ ${p.knights}</td><td title="Najduži put">🛤️ ${p.roadLen}</td><td><b>${p.vp} poena</b></td></tr>`).join('')}</table>` : ''}
      ${statsHTML()}
      <p><button class="btn green" style="width:100%" data-backrooms>Nazad na sobe</button></p>`;
  } else if (S && S.phase !== 'lobby' && S.sub === 'discard' && S.pendingDiscard[S.me]) {
    const need = S.pendingDiscard[S.me];
    const sum = RES.reduce((s, r) => s + (discardSel[r] || 0), 0);
    h = `<h3>Lopov! Odbaci ${need} karata</h3><p>Izabrano: <b>${sum} / ${need}</b></p>
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
$('modal').addEventListener('click', (ev) => { if (ev.target.id === 'modal' && modalExtra) { modalExtra = null; $('modalCard').innerHTML = ''; renderModal(); } });
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
  if (b.hasAttribute('data-darkall')) {
    darkPref = !darkPref; try { localStorage.setItem('ot_dark', darkPref ? '1' : '0'); } catch (_) { /* */ }
    const f = SKIN_FAMS.find((x) => x.dark && (x.light === skin || x.dark === skin));
    if (f) setSkin(darkPref ? f.dark : f.light);
    $('modalCard').innerHTML = ''; renderModal(); if (S && S.phase !== 'lobby') render(); if (!S) renderSettings(); return;
  }
  if (b.dataset.skin) { setSkin(b.dataset.skin); $('modalCard').innerHTML = ''; renderModal(); if (S && S.phase !== 'lobby') render(); if (!S) renderSettings(); return; }
  if (b.dataset.color) { act('look', { color: b.dataset.color }); return; }
  if (b.dataset.avatar) { act('look', { avatar: Number(b.dataset.avatar) }); return; }
  if (b.hasAttribute('data-backrooms')) { setSavedRoom(''); try { sessionStorage.setItem('ot_rooms', '1'); } catch (_) { /* */ } location.href = '/'; return; }
  if (b.hasAttribute('data-exit')) { modalExtra = null; $('modalCard').innerHTML = ''; return doLeave(); }
  if (b.hasAttribute('data-endgame')) { modalExtra = null; $('modalCard').innerHTML = ''; renderModal(); return act('endGame'); }
  if (b.hasAttribute('data-bconfirm')) { const f = pendingBuild; pendingBuild = null; modalExtra = null; $('modalCard').innerHTML = ''; renderModal(); if (f) f(); return; }
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
applyKind();
(() => {
  let back = false; try { back = sessionStorage.getItem('ot_rooms') === '1'; sessionStorage.removeItem('ot_rooms'); } catch (_) { /* */ }
  showPage(back || inviteCode ? 'rooms' : 'hub');
})();

// ---------- opisi kad predjes misem (brzi, umesto obicnog title) ----------
(() => {
  const tip = $('tip');
  let cur = null;
  // na telefonu: opis se vidi kad zadrzis prst na opciji
  let touchAt = 0, hold = null;
  document.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch') return;
    touchAt = Date.now(); tip.classList.add('hidden'); cur = null; clearTimeout(hold);
    const el = e.target.closest('[title], [data-tip]'); if (!el) return;
    if (el.hasAttribute('title')) { el.dataset.tip = el.getAttribute('title'); el.removeAttribute('title'); }
    hold = setTimeout(() => {
      tip.textContent = el.dataset.tip; tip.classList.remove('hidden');
      const w = tip.offsetWidth, h = tip.offsetHeight;
      tip.style.left = Math.max(8, Math.min(innerWidth - w - 8, e.clientX - w / 2)) + 'px';
      tip.style.top = Math.max(8, e.clientY - h - 24) + 'px';
      setTimeout(() => tip.classList.add('hidden'), 3500);
    }, 450);
  }, true);
  for (const ev of ['pointerup', 'pointercancel', 'pointermove']) document.addEventListener(ev, (e) => { if (e.pointerType === 'touch' && (ev !== 'pointermove' || e.movementX || e.movementY)) clearTimeout(hold); }, true);
  document.addEventListener('mouseover', (e) => {
    if (Date.now() - touchAt < 1500) return; // dodir nije prelazak misem
    const el = e.target.closest('[title], [data-tip]');
    if (!el) { tip.classList.add('hidden'); cur = null; return; }
    if (el.hasAttribute('title')) { el.dataset.tip = el.getAttribute('title'); el.removeAttribute('title'); }
    if (!el.dataset.tip) return;
    cur = el;
    tip.textContent = el.dataset.tip;
    tip.classList.remove('hidden');
  });
  document.addEventListener('mousemove', (e) => {
    if (!cur) return;
    const w = tip.offsetWidth, h = tip.offsetHeight;
    let x = e.clientX + 14, y = e.clientY + 18;
    if (x + w > innerWidth - 8) x = e.clientX - w - 10;
    if (y + h > innerHeight - 8) y = e.clientY - h - 12;
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  });
  document.addEventListener('mouseout', (e) => { if (cur && !cur.contains(e.relatedTarget)) { tip.classList.add('hidden'); cur = null; } });
  document.addEventListener('mousedown', () => { tip.classList.add('hidden'); });
})();
