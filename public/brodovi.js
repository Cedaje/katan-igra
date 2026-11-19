/* global BS_RULES, SFX */
// Ekran igre "Potapanje brodova". Koristi zajednicke stvari iz client.js (socket, profil, avatari, zvuk, prozor).
const BS = (() => {
  const R = BS_RULES;
  const CELL = 34, PAD = 24;
  const LET = R.LETTERS;
  const N = () => (G && G.settings.size) || 10; // velicina table
  let aimMode = 'shot'; // 'shot' | 'radar' | 'bomb'
  let aimHover = null;
  let G = null; // stanje sa servera
  let place = null; // lokalni raspored: { round, ships: [], sel: duzina|null, dir, hover: [x,y]|null }
  let lookSent = null;
  let seenLog = null, seenChat = 0, sideOpen = false;
  let endShown = null; // runda za koju je prikazan kraj (da se ne ponavlja animacija)
  let endHidden = false;

  const meP = () => G.players.find((p) => p.id === G.me);
  const foeP = () => G.players.find((p) => p.id !== G.me);
  const isHost = () => G.host === G.me;
  const send = (type, data = {}) => socket.emit('action', { type, data }, (r) => { if (r && !r.ok) { toast(r.error); SFX.play('error'); } });

  // ---------- prijem stanja ----------
  function onState(state) {
    const prev = G;
    G = state;
    if (!prev || prev.code !== G.code) { seenLog = null; endShown = null; lookSent = null; place = null; seenChat = 0; }
    sounds(prev);
    if (G.phase === 'place' && (!place || place.round !== G.round)) {
      place = { round: G.round, ships: [], sel: R.sizesOf(G.settings.fleet, N())[0], dir: 'h', hover: null };
    }
    if (G.phase !== 'ended') { endHidden = false; }
    if (G.turn !== G.me || (aimMode !== 'shot' && !(meP()?.[aimMode] > 0))) aimMode = 'shot';
    clockOff = G.now - Date.now();
    sendLook();
    showPage('bsgame');
    render();
  }

  // omiljena boja, lik, okvir i titula iz profila: posalji jednom kad udjes u sobu
  function sendLook() {
    const m = meP(); if (!m || lookSent === G.code) return;
    lookSent = G.code;
    const data = {};
    if (PREFS.color && m.color !== PREFS.color && !G.players.some((p) => p.id !== G.me && p.color === PREFS.color)) data.color = PREFS.color;
    if (PREFS.avatar !== null && PREFS.avatar !== undefined && m.avatar !== PREFS.avatar) data.avatar = PREFS.avatar;
    for (const k of ['frame', 'title', 'win', 'winSound']) if (PREFS[k] !== undefined && m[k] !== PREFS[k]) data[k] = PREFS[k];
    if (Object.keys(data).length) send('look', data);
  }

  function sounds(prev) {
    const keys = G.log.map((l) => `${l.t}|${l.text}`);
    if (seenLog === null || !prev || prev.code !== G.code) { seenLog = new Set(keys); return; }
    const fresh = G.log.filter((l, i) => !seenLog.has(keys[i]));
    keys.forEach((k) => seenLog.add(k));
    if (G.chat.length > (prev.chat || []).length && G.chat[G.chat.length - 1].pid !== G.me) SFX.play('chat');
    for (const l of fresh) {
      const t = l.text;
      if (t.startsWith('🌊')) { SFX.play('cannon'); SFX.play('splash'); }
      else if (t.startsWith('💥')) { SFX.play('cannon'); SFX.play('boom'); }
      else if (t.startsWith('🔥')) { SFX.play('cannon'); SFX.play('sunk'); }
      else if (t.startsWith('📡')) SFX.play('sonar');
      else if (t.startsWith('💣')) { SFX.play('bombFall'); if (t.includes('potopljeno')) setTimeout(() => SFX.play('sunk'), 500); }
      else if (t.startsWith('⏰')) SFX.play('warn');
      else if (t.startsWith('🔔')) SFX.play('horn');
      else if (t.startsWith('✅')) SFX.play('ready');
      else if (t.startsWith('⚓')) SFX.play('anchor');
      else if (t.startsWith('🚪')) SFX.play('leave');
      else if (t.startsWith('🔁')) SFX.play('vote');
      else if (t.startsWith('🏆')) {
        const w = G.players.find((p) => p.id === G.winner);
        setTimeout(() => SFX.play(G.winner === G.me ? ({ zvona: 'winBells', bubnjevi: 'winDrums' }[w?.winSound] || 'win') : 'lose'), 900);
      } else if (t.includes('je ušao u sobu') && prev.players.length < G.players.length) SFX.play('bell');
    }
    if (G.phase === 'battle' && prev.turn !== G.turn && G.turn === G.me && !fresh.some((l) => l.text.startsWith('🔥'))) setTimeout(() => SFX.play('myTurn'), 500);
  }

  // ---------- crtanje table ----------
  // brod: trup sa zaobljenom krmom i siljatim pramcem, paluba i topovi; boja igraca kao pruga
  function shipSVG(s, o = {}) {
    const L = s.len * CELL - 8, H = CELL - 12;
    const px = PAD + s.x * CELL, py = PAD + s.y * CELL;
    const tr = s.dir === 'v' ? `translate(${px + CELL - 6},${py + 4}) rotate(90)` : `translate(${px + 4},${py + 6})`;
    const bow = Math.min(H * 0.9, L * 0.35);
    const hull = `M ${H / 2},0 H ${L - bow} Q ${L},${H * 0.15} ${L},${H / 2} Q ${L},${H * 0.85} ${L - bow},${H} H ${H / 2} Q 0,${H} 0,${H / 2} Q 0,0 ${H / 2},0 Z`;
    let deck = '';
    if (s.len === 1) deck = `<rect x="${L * 0.32}" y="${H * 0.28}" width="${L * 0.3}" height="${H * 0.44}" rx="3" class="sh-tower"/>`;
    else {
      deck = `<rect x="${H * 0.45}" y="${H * 0.3}" width="${L - bow - H * 0.2}" height="${H * 0.4}" rx="3" class="sh-deck"/>`;
      for (let i = 0; i < s.len; i++) {
        const cx = (i + 0.5) * CELL - 4;
        if (i === s.len - 1) continue;
        deck += i === Math.floor((s.len - 1) / 2) ? `<rect x="${cx - 7}" y="${H * 0.18}" width="14" height="${H * 0.64}" rx="3" class="sh-tower"/>`
          : `<circle cx="${cx}" cy="${H / 2}" r="${H * 0.2}" class="sh-gun"/><rect x="${cx}" y="${H / 2 - 1.5}" width="${H * 0.45}" height="3" class="sh-gun"/>`;
      }
    }
    const stripe = o.color ? `<path d="M ${H * 0.3},${H - 2.5} H ${L - bow * 0.6}" stroke="${o.color}" stroke-width="3" stroke-linecap="round"/>` : '';
    return `<g class="ship ${o.cls || ''}" transform="${tr}"><path d="${hull}" class="sh-hull"/>${stripe}${deck}</g>`;
  }
  function radarSVG(r) {
    const n = N(), x0 = Math.max(0, r.x - 1), y0 = Math.max(0, r.y - 1), x1 = Math.min(n - 1, r.x + 1), y1 = Math.min(n - 1, r.y + 1);
    const X = PAD + x0 * CELL + 2, Y = PAD + y0 * CELL + 2, W = (x1 - x0 + 1) * CELL - 4, H = (y1 - y0 + 1) * CELL - 4;
    return `<g class="mk-radar"><rect x="${X}" y="${Y}" width="${W}" height="${H}" rx="6"/><circle cx="${X + W - 9}" cy="${Y + 9}" r="9"/><text x="${X + W - 9}" y="${Y + 13}">${r.n}</text></g>`;
  }
  function markSVG(x, y, v, last) {
    const cx = PAD + x * CELL + CELL / 2, cy = PAD + y * CELL + CELL / 2;
    let m = '';
    if (v === 'miss') m = `<g class="mk-miss"><circle cx="${cx}" cy="${cy}" r="9" class="ring"/><circle cx="${cx}" cy="${cy}" r="4"/></g>`;
    else if (v === 'auto') m = `<circle cx="${cx}" cy="${cy}" r="2.6" class="mk-auto"/>`;
    else if (v === 'hit') {
      const pts = [...Array(16)].map((_, i) => { const a = (Math.PI / 8) * i, r = i % 2 ? 6 : 13; return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`; }).join(' ');
      m = `<g class="mk-hit"><polygon points="${pts}"/><circle cx="${cx}" cy="${cy}" r="4.5" class="core"/></g>`;
    }
    return m + (last ? `<circle cx="${cx}" cy="${cy}" r="15" class="mk-last"/>` : '');
  }
  function boardSVG(o) {
    const n = N(), SIZE = PAD + n * CELL + 4;
    let h = `<rect x="${PAD}" y="${PAD}" width="${n * CELL}" height="${n * CELL}" rx="6" class="water"/>`;
    for (let i = 0; i < n; i++) {
      h += `<text x="${PAD + i * CELL + CELL / 2}" y="${PAD - 8}" class="lbl">${LET[i]}</text>`;
      h += `<text x="${PAD - 10}" y="${PAD + i * CELL + CELL / 2 + 5}" class="lbl">${i + 1}</text>`;
    }
    for (let i = 1; i < n; i++) h += `<line x1="${PAD + i * CELL}" y1="${PAD}" x2="${PAD + i * CELL}" y2="${PAD + n * CELL}" class="gl"/><line x1="${PAD}" y1="${PAD + i * CELL}" x2="${PAD + n * CELL}" y2="${PAD + i * CELL}" class="gl"/>`;
    for (const s of o.ships || []) h += shipSVG(s, { color: o.color, cls: (s.sunk ? 'sunk ' : '') + (s.cls || '') });
    if (o.ghost) h += shipSVG(o.ghost, { cls: o.ghost.ok ? 'ghost' : 'ghost bad' });
    const last = o.last;
    for (const [k, v] of Object.entries(o.shots || {})) { const [x, y] = k.split(',').map(Number); h += markSVG(x, y, v, last && last.kind === 'shot' && last.x === x && last.y === y); }
    for (const r of o.radars || []) h += radarSVG(r);
    if (last && last.kind && last.kind !== 'shot') h += `<rect x="${PAD + (last.x - 1) * CELL}" y="${PAD + (last.y - 1) * CELL}" width="${CELL * 3}" height="${CELL * 3}" rx="8" class="mk-area"/>`;
    if (o.area) h += `<rect x="${PAD + (o.area[0] - 1) * CELL + 1}" y="${PAD + (o.area[1] - 1) * CELL + 1}" width="${CELL * 3 - 2}" height="${CELL * 3 - 2}" rx="8" class="aim-area ${aimMode}"/>`;
    if (o.click) for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      if (o.aim && aimMode === 'shot' && o.shots[x + ',' + y]) continue;
      h += `<rect x="${PAD + x * CELL}" y="${PAD + y * CELL}" width="${CELL}" height="${CELL}" class="cell" data-x="${x}" data-y="${y}"><title>${LET[x]}${y + 1}</title></rect>`;
    }
    return `<svg viewBox="0 0 ${SIZE} ${SIZE}" class="bs-board ${o.aim ? 'aim' : ''} ${o.cls || ''}" data-board="${o.id}">${h}</svg>`;
  }

  // ---------- delovi ekrana ----------
  function pCard(p, side) {
    if (!p) return `<div class="bs-pc empty ${side}"><span class="avatar">?</span><span class="bs-pn"><b>Čeka se protivnik…</b><small>Pošalji link prijatelju</small></span></div>`;
    const turn = G.phase === 'battle' && G.turn === p.id;
    let sub = '';
    if (G.phase === 'lobby') sub = p.id === G.host ? 'Osnivač sobe' : 'U sobi';
    else if (G.phase === 'place') sub = p.ready ? '✅ Spreman' : '⚓ Raspoređuje brodove…';
    else if (G.phase === 'battle') sub = turn ? '🎯 Gađa' : 'Čeka';
    else if (G.phase === 'ended') sub = G.winner === p.id ? '🏆 Pobednik' : p.rematch ? '🔁 Želi revanš' : '';
    if (p.quit) sub = '🚪 Napustio';
    else if (!p.connected) sub += ' · 📡 nije povezan';
    const fleet = p.left ? `<span class="bs-fleet" title="Preostali brodovi">${p.left.map((n) => `<i style="width:${n * 9}px"></i>`).join('')}</span>` : '';
    return `<div class="bs-pc ${side} ${turn ? 'turn' : ''}" style="--pc:${p.color}">
      <span class="avatar ${frameCls(p)}" style="background:${p.color}">${avatarOf(p)}</span>
      <span class="bs-pn"><b>${esc(p.name)}${p.id === G.me ? ' <small>(ti)</small>' : ''}</b>${p.title ? `<i class="ptitle">${TITLES[p.title]}</i>` : ''}<small>${sub}</small>${G.phase === 'battle' || G.phase === 'ended' ? fleet : ''}</span></div>`;
  }

  // podesavanja sobe: jedan red po opciji, sa kratkim izborom (osnivac menja, drugi igrac samo vidi)
  const LOBBY_OPTS = [
    { k: 'fleet', label: '🚢 Flota', tip: 'Klasična: mnogo malih brodova (na 10×10: 4, 3, 3, 2, 2, 2, 1, 1, 1, 1). Velika: manje brodova, ali duži (5, 4, 3, 3, 2).', vals: [['klasicna', 'Klasična'], ['velika', 'Velika']] },
    { k: 'size', label: '🗺️ Tabla', tip: 'Veličina table. Na manjoj tabli bitka je kraća, na većoj duža. Broj brodova se prilagodi tabli.', vals: [[8, '8×8'], [10, '10×10'], [12, '12×12']] },
    { k: 'again', label: '🎯 Posle pogotka', tip: 'Gađaš opet: kad pogodiš, ostaješ na potezu dok ne promašiš. Menja se: posle svakog gađanja igra protivnik.', vals: [[true, 'Gađaš opet'], [false, 'Menja se']], off: (st) => st.salvo },
    { k: 'touch', label: '🧩 Brodovi se dodiruju', tip: 'Ne: između brodova mora biti prazno polje, a oko potopljenog broda se polja sama označe. Da: brodovi smeju da stoje jedan uz drugi.', vals: [[false, 'Ne'], [true, 'Da']] },
    { k: 'salvo', label: '💥 Salva', tip: 'U jednom potezu gađaš onoliko puta koliko ti je brodova ostalo na vodi. Što više brodova izgubiš, slabije pucaš.', vals: [[false, 'Ne'], [true, 'Da']] },
    { k: 'special', label: '📡 Radar i bomba', tip: 'Svaki igrač jednom po bitki može da upotrebi radar (pokaže koliko polja broda ima u kvadratu 3×3) i bombu (gađa ceo kvadrat 3×3). Troše jedno gađanje.', vals: [[false, 'Ne'], [true, 'Da']] },
    { k: 'timer', label: '⏱️ Vreme za gađanje', tip: 'Koliko sekundi imaš za jedno gađanje. Kad istekne, igra gađa nasumično umesto tebe.', vals: [[0, 'Bez'], [15, '15s'], [30, '30s'], [60, '60s']] },
  ];
  function lobbyHTML() {
    const st = G.settings, host = isHost();
    const url = new URL(location.href); url.search = '?soba=' + G.code;
    const rows = LOBBY_OPTS.map((o) => {
      const off = o.off && o.off(st);
      return `<div class="bs-set ${off ? 'off' : ''}" title="${o.tip}"><span class="bs-set-l">${o.label}${off ? ' <small>(ne važi uz salvu)</small>' : ''}</span>
        <div class="seg2">${o.vals.map(([v, l]) => `<button class="${st[o.k] === v ? 'on' : ''}" ${host && !off ? `data-bsset="${o.k}" data-v="${v}"` : 'disabled'}>${l}</button>`).join('')}</div></div>`;
    }).join('');
    const fleet = R.sizesOf(st.fleet, st.size);
    return `<div class="bs-lobby">
      <div class="bs-box bs-inv"><b>Pozovi prijatelja</b>
        <div class="invite"><input id="bsInvite" readonly value="${url.toString()}"><button class="btn green sm" data-bscopy title="Kopiraj link i pošalji ga prijatelju">Kopiraj</button></div></div>
      <div class="bs-box"><h3>⚙️ Podešavanja ${host ? '' : '<small>(menja osnivač sobe)</small>'}</h3>${rows}
        <p class="bs-note">Flota: ${fleet.length} brodova (${fleet.join(', ')}). Pređi mišem preko opcije za opis.</p></div>
      <div class="bs-start">${host ? `<button class="btn green" data-bsstart ${G.players.length < 2 ? 'disabled' : ''} title="Pokreni bitku (potrebna su 2 igrača)">Pokreni bitku</button>` : '<span class="muted-light">Čeka se da osnivač pokrene bitku…</span>'}
        ${G.players.length < 2 ? '<span class="muted-light">Čeka se drugi igrač…</span>' : ''}</div>
    </div>`;
  }

  // raspored brodova: izaberi brod, pa klikni na tablu (R ili desni klik okreće)
  function remaining() {
    const left = [...R.sizesOf(G.settings.fleet, N())];
    for (const s of place.ships) left.splice(left.indexOf(s.len), 1);
    return left;
  }
  function ghostAt(x, y) {
    if (!place.sel) return null;
    const g = { x, y, len: place.sel, dir: place.dir };
    // da brod ne ispadne sa table: pomeri ga unazad
    if (g.dir === 'h') g.x = Math.min(g.x, N() - g.len); else g.y = Math.min(g.y, N() - g.len);
    g.ok = R.fits(place.ships, g, G.settings.touch, N());
    return g;
  }
  function placeHTML() {
    const m = meP();
    if (m.ready) {
      return `<div class="bs-boards one"><div class="bs-bwrap"><h3>Tvoja flota</h3>${boardSVG({ id: 'mine', ships: G.myShips, color: m.color })}</div></div>
        <div class="bs-tools"><p class="bs-note">✅ Spreman si. ${foeP()?.ready ? '' : 'Čeka se da protivnik rasporedi brodove…'}</p>
        <button class="btn ghost sm" data-bsunready title="Vrati brodove i promeni raspored">✏️ Promeni raspored</button></div>`;
    }
    const left = remaining();
    if (place.sel && !left.includes(place.sel)) place.sel = left[0] || null;
    const ghost = place.hover ? ghostAt(...place.hover) : null;
    const dock = R.sizesOf(G.settings.fleet, N()).map((n, i, all) => {
      const used = all.slice(0, i).filter((v) => v === n).length < all.filter((v) => v === n).length - left.filter((v) => v === n).length;
      return { n, used };
    });
    const firstFree = (all, d) => all.find((x) => x.n === d.n && !x.used) === d;
    return `<div class="bs-boards one"><div class="bs-bwrap"><h3>Rasporedi svoju flotu</h3>${boardSVG({ id: 'place', ships: place.ships, color: m.color, ghost, click: true })}</div>
      <div class="bs-dock"><h3>Brodovi</h3><p class="bs-note">Izaberi brod, pa klikni na tablu. Klik na postavljen brod ga vraća. ${G.settings.touch ? '' : 'Brodovi ne smeju da se dodiruju.'}</p>
        <div class="bs-ships">${dock.map((d) => `<button class="bs-dship ${d.used ? 'used' : ''} ${!d.used && place.sel === d.n && firstFree(dock, d) ? 'sel' : ''}" ${d.used ? 'disabled' : `data-bssel="${d.n}"`} title="${R.SHIP_NAMES[d.n]} (${d.n} ${d.n === 1 ? 'polje' : 'polja'})">${'<i></i>'.repeat(d.n)}</button>`).join('')}</div>
        <div class="bs-dbtns">
          <button class="ob" data-bsrot title="Okreni brod (taster R ili desni klik)">↻ Okreni (${place.dir === 'h' ? 'vodoravno' : 'uspravno'})</button>
          <button class="ob" data-bsrand title="Rasporedi sve brodove nasumično">🎲 Nasumično</button>
          <button class="ob gray" data-bsclear title="Skloni sve brodove sa table">Očisti</button>
        </div>
        <button class="btn green" data-bsready ${left.length ? 'disabled' : ''} title="Potvrdi raspored">${left.length ? `Postavi još ${left.length}` : 'Spreman!'}</button>
      </div></div>`;
  }

  function battleHTML() {
    const m = meP(), f = foeP();
    const myTurn = G.phase === 'battle' && G.turn === G.me;
    const lastMine = G.lastShot && G.lastShot.by !== G.me ? G.lastShot : null;
    const lastFoe = G.lastShot && G.lastShot.by === G.me ? G.lastShot : null;
    const foeShips = (G.foeShips || []).map((s) => ({ ...s, cls: s.sunk ? '' : 'reveal' }));
    const special = G.settings.special && G.phase === 'battle' ? `<div class="bs-special">
        <button class="bs-sp ${aimMode === 'shot' ? 'on' : ''}" data-aim="shot" ${myTurn ? '' : 'disabled'} title="Običan hitac u jedno polje">🎯 Hitac</button>
        <button class="bs-sp ${aimMode === 'radar' ? 'on' : ''}" data-aim="radar" ${myTurn && m.radar ? '' : 'disabled'} title="Radar: pokaže koliko polja broda ima u kvadratu 3×3 (jednom po bitki)">📡 Radar <b>${m.radar}</b></button>
        <button class="bs-sp ${aimMode === 'bomb' ? 'on' : ''}" data-aim="bomb" ${myTurn && m.bomb ? '' : 'disabled'} title="Bomba: gađa ceo kvadrat 3×3 (jednom po bitki)">💣 Bomba <b>${m.bomb}</b></button></div>` : '';
    const area = myTurn && aimMode !== 'shot' && aimHover ? aimHover : null;
    return `<div class="bs-boards">
      <div class="bs-bwrap foe ${myTurn ? 'active' : ''}"><h3>🎯 More protivnika ${f ? `<small>${esc(f.name)}</small>` : ''}</h3>${boardSVG({ id: 'foe', ships: foeShips, color: f?.color, shots: G.foeShots, radars: G.foeRadars, last: lastFoe, click: myTurn, aim: myTurn, area })}${special}</div>
      <div class="bs-bwrap mine ${!myTurn && G.phase === 'battle' ? 'active' : ''}"><h3>🚢 Tvoja flota</h3>${boardSVG({ id: 'mine', ships: G.myShips || [], color: m.color, shots: G.myShots, radars: G.myRadars, last: lastMine })}</div>
    </div>`;
  }

  function statusText() {
    const f = foeP();
    if (G.phase === 'lobby') return G.players.length < 2 ? 'Pošalji link prijatelju i sačekaj da uđe u sobu.' : isHost() ? 'Protivnik je tu. Izaberi pravila i pokreni bitku!' : 'Protivnik je tu. Osnivač bira pravila.';
    if (G.phase === 'place') return meP().ready ? 'Čeka se protivnik…' : 'Rasporedi brodove tajno. Protivnik ih ne vidi.';
    if (G.phase === 'battle') {
      const salvo = G.settings.salvo && G.shotsLeft > 1 ? ` <span class="bs-salvo">💥 još ${G.shotsLeft} gađanja</span>` : '';
      const mode = G.turn === G.me && aimMode !== 'shot' ? (aimMode === 'radar' ? '📡 Izaberi centar kvadrata za radar.' : '💣 Izaberi centar kvadrata za bombu.') : null;
      return (G.turn === G.me ? (mode || '🎯 Tvoj red! Gađaj polje na protivničkoj tabli.') : `⏳ ${esc(f?.name || 'Protivnik')} gađa tvoju flotu…`) + salvo + '<span id="bsTimer" class="bs-timer"></span>';
    }
    if (G.phase === 'ended') return G.winner === G.me ? '🏆 Pobedio si!' : G.winner ? `${esc(G.players.find((p) => p.id === G.winner)?.name || '')} je pobedio.` : 'Bitka je završena.';
    return '';
  }

  function endHTML() {
    const w = G.players.find((p) => p.id === G.winner);
    const iWon = G.winner === G.me;
    const f = foeP();
    const row = (p) => {
      const acc = p.st.shots ? Math.round((p.st.hits / p.st.shots) * 100) : 0;
      return `<tr style="--pc:${p.color}"><td><span class="avatar ${frameCls(p)}" style="background:${p.color}">${avatarOf(p)}</span></td><td class="rn">${esc(p.name)}${p.id === G.winner ? ' 👑' : ''}</td><td>${p.st.shots}</td><td>${p.st.hits}</td><td>${acc}%</td><td>${p.st.sunk}</td></tr>`;
    };
    const canRematch = f && !f.quit && !meP().quit;
    return `${w ? celebration(w) : ''}<div class="bs-end-card">
      <h2>${iWon ? '🏆 Pobeda!' : w ? `⚓ ${esc(w.name)} je pobedio` : 'Bitka je završena'}</h2>
      <p>${G.forfeit ? 'Protivnik je napustio bitku.' : iWon ? 'Potopio si celu protivničku flotu.' : 'Tvoja flota je potopljena. Probaj revanš!'}</p>
      <table class="bs-stats"><tr><th></th><th></th><th title="Gađanja">🎯</th><th title="Pogoci">💥</th><th title="Preciznost">%</th><th title="Potopljeni brodovi">🔥</th></tr>${G.players.map(row).join('')}</table>
      <div class="bs-end-btns">
        ${canRematch ? `<button class="btn green" data-bsrematch ${meP().rematch ? 'disabled' : ''}>${meP().rematch ? '⏳ Čeka se protivnik…' : f.rematch ? '🔁 Prihvati revanš' : '🔁 Revanš'}</button>` : ''}
        <button class="btn bs-lookbtn" data-bslook title="Pogledaj table">👀 Pogledaj table</button>
        <button class="btn orange" data-bsback>Nazad na sobe</button>
      </div></div>`;
  }

  function renderSide() {
    const color = (t) => esc(t);
    $('bsLog').innerHTML = G.log.slice(-40).map((l) => `<div>${color(l.text)}</div>`).join('');
    $('bsLog').scrollTop = $('bsLog').scrollHeight;
    $('bsChat').innerHTML = G.chat.map((c) => `<div class="nt"><b style="color:${c.color};text-shadow:0 0 1px #0008">${esc(c.name)}:</b> ${esc(c.text)}</div>`).join('') || '<div style="opacity:.6">Još nema poruka.</div>';
    $('bsChat').scrollTop = $('bsChat').scrollHeight;
    if (sideOpen || !matchMedia('(max-width: 760px)').matches) seenChat = G.chat.length;
    const unread = G.chat.length - seenChat;
    $('bsBadge').textContent = unread > 0 ? unread : '';
  }

  // odbrojavanje vremena za gadjanje
  let clockOff = 0, lastTickSec = null;
  setInterval(() => {
    const el = $('bsTimer');
    if (!G || !el) return;
    if (!G.deadline || G.phase !== 'battle') { el.textContent = ''; return; }
    const sec = Math.max(0, Math.ceil((G.deadline - (Date.now() + clockOff)) / 1000));
    el.textContent = `⏱️ ${sec}s`;
    el.classList.toggle('low', sec <= 5);
    if (G.turn === G.me && sec <= 5 && sec > 0 && sec !== lastTickSec) SFX.play('tick');
    lastTickSec = sec;
  }, 250);

  function render() {
    if (!G) return;
    $('bsRoom').textContent = `Soba ${G.code}${G.round > 1 ? ` · runda ${G.round}` : ''}`;
    $('bsSound').textContent = SFX.muted ? '🔇' : '🔊';
    const m = meP(), f = foeP();
    $('bsPlayers').innerHTML = `${pCard(m, 'left')}<span class="bs-vs">VS</span>${pCard(f, 'right')}`;
    $('bsStatus').innerHTML = statusText();
    $('bsStatus').className = 'bs-status' + (G.phase === 'battle' && G.turn === G.me ? ' my' : '');
    let body = '';
    if (G.phase === 'lobby') body = lobbyHTML();
    else if (G.phase === 'place') body = placeHTML();
    else body = battleHTML() + (G.phase === 'ended' && endHidden ? '<div class="bs-tools"><button class="btn green sm" data-bsshowend>Rezultat</button></div>' : '');
    $('bsBody').innerHTML = body;
    renderSide();
    const end = $('bsEnd');
    if (G.phase === 'ended' && !endHidden) {
      const key = `${G.code}|${G.round}|${G.players.map((p) => p.rematch).join()}`;
      if (endShown !== key) { end.innerHTML = endHTML(); endShown = key; }
      end.classList.remove('hidden');
    } else { end.classList.add('hidden'); endShown = null; }
  }

  // ---------- klikovi ----------
  function onBoardClick(e) {
    const c = e.target.closest('[data-x]'); if (!c) return;
    const x = Number(c.dataset.x), y = Number(c.dataset.y);
    const b = c.closest('[data-board]').dataset.board;
    if (b === 'foe') { send('shoot', { x, y, kind: aimMode }); aimMode = 'shot'; aimHover = null; return; }
    if (b === 'place') {
      const hitShip = place.ships.find((s) => R.cellsOf(s).some(([a, bb]) => a === x && bb === y));
      if (hitShip) { place.ships = place.ships.filter((s) => s !== hitShip); place.sel = hitShip.len; place.dir = hitShip.dir; SFX.play('pickup'); render(); return; }
      const g = ghostAt(x, y);
      if (!g) return toast('Prvo izaberi brod sa desne strane.');
      if (!g.ok) { SFX.play('error'); return toast(G.settings.touch ? 'Tu brod ne može da stane.' : 'Tu brod ne može da stane: brodovi ne smeju da se dodiruju.'); }
      place.ships.push({ x: g.x, y: g.y, len: g.len, dir: g.dir });
      SFX.play('place');
      const left = remaining(); place.sel = left[0] || null;
      render();
    }
  }
  $('bsBody').addEventListener('click', (e) => {
    if (!G) return;
    const b = e.target.closest('button');
    if (!b) return onBoardClick(e);
    if (b.dataset.bsset) { const v = b.dataset.v; send('settings', { [b.dataset.bsset]: v === 'true' ? true : v === 'false' ? false : v }); return; }
    if (b.hasAttribute('data-bscopy')) { navigator.clipboard?.writeText($('bsInvite').value); toast('Link je kopiran. Pošalji ga prijatelju.'); return; }
    if (b.hasAttribute('data-bsstart')) return send('start');
    if (b.dataset.bssel) { place.sel = Number(b.dataset.bssel); render(); return; }
    if (b.hasAttribute('data-bsrot')) { place.dir = place.dir === 'h' ? 'v' : 'h'; SFX.play('rotate'); render(); return; }
    if (b.dataset.aim) { aimMode = aimMode === b.dataset.aim ? 'shot' : b.dataset.aim; SFX.play('click'); render(); return; }
    if (b.hasAttribute('data-bsrand')) { place.ships = R.randomFleet(G.settings.fleet, G.settings.touch, N()) || []; place.sel = null; SFX.play('shuffle'); render(); return; }
    if (b.hasAttribute('data-bsclear')) { place.ships = []; place.sel = R.sizesOf(G.settings.fleet, N())[0]; SFX.play('click'); render(); return; }
    if (b.hasAttribute('data-bsready')) return send('place', { ships: place.ships });
    if (b.hasAttribute('data-bsunready')) { place.ships = (G.myShips || []).map(({ x, y, len, dir }) => ({ x, y, len, dir })); place.sel = null; send('unready'); return; }
    if (b.hasAttribute('data-bsshowend')) { endHidden = false; render(); }
  });
  // pregled gde ce brod stati dok mis prelazi preko table
  $('bsBody').addEventListener('mouseover', (e) => {
    if (!G || G.phase !== 'place' || !place) return;
    const c = e.target.closest('[data-board="place"] [data-x]');
    const h = c ? [Number(c.dataset.x), Number(c.dataset.y)] : null;
    if (String(h) !== String(place.hover)) { place.hover = h; render(); }
  });
  $('bsBody').addEventListener('mouseover', (e) => {
    if (!G || G.phase !== 'battle' || aimMode === 'shot') return;
    const c = e.target.closest('[data-board="foe"] [data-x]');
    const h = c ? [Number(c.dataset.x), Number(c.dataset.y)] : null;
    if (String(h) !== String(aimHover)) { aimHover = h; render(); }
  });
  $('bsBody').addEventListener('contextmenu', (e) => {
    if (!G || G.phase !== 'place' || !e.target.closest('[data-board="place"]')) return;
    e.preventDefault(); place.dir = place.dir === 'h' ? 'v' : 'h'; SFX.play('rotate'); render();
  });
  document.addEventListener('keydown', (e) => {
    if (!G || $('bsgame').classList.contains('hidden') || e.target.matches('input, textarea')) return;
    if (e.key.toLowerCase() === 'r' && G.phase === 'place' && place) { place.dir = place.dir === 'h' ? 'v' : 'h'; SFX.play('rotate'); render(); }
    if (e.key === 'Escape' && aimMode !== 'shot') { aimMode = 'shot'; render(); }
  });
  $('bsEnd').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.hasAttribute('data-bsrematch')) send('rematch');
    if (b.hasAttribute('data-bslook')) { endHidden = true; render(); }
    if (b.hasAttribute('data-bsback')) leave();
  });
  $('bsChatForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const inp = e.target.querySelector('input'), t = inp.value.trim();
    inp.value = '';
    if (t) send('chat', { text: t });
  });
  $('bsSound').onclick = () => { SFX.toggle(); render(); };
  $('bsRules').onclick = () => showRules();
  $('bsSideBtn').onclick = () => { sideOpen = true; $('bsSide').classList.add('open'); if (G) { seenChat = G.chat.length; renderSide(); } };
  $('bsSideClose').onclick = () => { sideOpen = false; $('bsSide').classList.remove('open'); };
  $('bsExit').onclick = () => {
    if (!G) return;
    if (G.phase === 'place' || G.phase === 'battle') {
      modalExtra = () => `<h3>🚪 Napusti bitku?</h3><p>Ako sada izađeš, protivnik pobeđuje.</p>
        <div class="row"><button class="ob red" data-bsleave>Napusti</button><button class="ob gray" data-close>Ostani</button></div>`;
      renderModal();
      return;
    }
    leave();
  };
  $('modalCard').addEventListener('click', (e) => { if (e.target.closest('[data-bsleave]')) { modalExtra = null; $('modalCard').innerHTML = ''; renderModal(); leave(); } });

  function leave() {
    setSavedRoom('');
    send('leave');
    reset();
    history.replaceState(null, '', '/');
    socket.emit('rooms');
  }
  // izlaz iz igre (quiet = presli smo u drugu igru, ne menjaj stranu)
  function reset(quiet) {
    G = null; place = null; endShown = null;
    $('bsEnd').classList.add('hidden');
    if (!quiet) showPage('rooms');
  }

  function showRules() {
    modalExtra = () => `<div class="rules"><button class="modal-x" data-close title="Zatvori pravila (Esc)">✕</button><h3>📖 Potapanje brodova</h3>
      <p><b>Cilj:</b> prvi potopi sve protivničke brodove.</p>
      <p><b>1. Raspored.</b> Svaki igrač tajno rasporedi svoju flotu na tablu 10×10. Brodovi stoje vodoravno ili uspravno. U klasičnim pravilima brodovi ne smeju da se dodiruju, ni ćoškom.</p>
      <p><b>2. Bitka.</b> Igrači naizmenično gađaju po jedno polje na protivničkoj tabli. 🌊 znači promašaj, 💥 pogodak, a kad su pogođena sva polja broda, brod je 🔥 potopljen.</p>
      <p><b>Pogodak = gađaš opet:</b> ako je uključeno, posle pogotka ostaješ na potezu dok ne promašiš.</p>
      <p><b>Flote:</b> klasična ima 10 brodova (jedan od 4 polja, dva od 3, tri od 2 i četiri od 1), a velika 5 brodova (5, 4, 3, 3, 2).</p>
      <p><b>Prečice:</b> R ili desni klik okreće brod dok ga raspoređuješ.</p>
      <p>Statistika i dostignuća za ovu igru vode se posebno, a ime, avatar, okvir i titula su isti kao u ostalim igrama.</p></div>`;
    renderModal();
  }

  // ukras: more sa brodovima (izbor igre i strana sa sobama)
  function seaArt() {
    let h = '<defs><linearGradient id="bsArtW" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5fb7d6"/><stop offset="1" stop-color="#2a7fa3"/></linearGradient></defs>';
    h += '<rect x="10" y="10" width="200" height="130" rx="10" fill="url(#bsArtW)"/>';
    for (let i = 1; i < 10; i++) h += `<line x1="${10 + i * 20}" y1="10" x2="${10 + i * 20}" y2="140" stroke="#ffffff40"/>`;
    for (let i = 1; i < 7; i++) h += `<line x1="10" y1="${10 + i * 20}" x2="210" y2="${10 + i * 20}" stroke="#ffffff40"/>`;
    const ship = (x, y, len, col) => `<g transform="translate(${x},${y})"><path d="M8,0 H${len * 20 - 22} Q${len * 20 - 6},3 ${len * 20 - 6},8 Q${len * 20 - 6},13 ${len * 20 - 22},16 H8 Q0,16 0,8 Q0,0 8,0Z" fill="#8b98a5" stroke="#4b5560" stroke-width="1.5"/><rect x="9" y="5" width="${len * 20 - 30}" height="6" rx="2" fill="#c2ccd5"/><path d="M5,14 H${len * 20 - 16}" stroke="${col}" stroke-width="2.5" stroke-linecap="round"/></g>`;
    h += ship(33, 32, 4, '#e05a47') + ship(113, 92, 3, '#3b82c4') + ship(153, 32, 2, '#f2b134');
    const hit = (x, y) => `<g transform="translate(${x},${y})"><polygon points="${[...Array(16)].map((_, i) => { const a = (Math.PI / 8) * i, r = i % 2 ? 4 : 8; return `${r * Math.cos(a)},${r * Math.sin(a)}`; }).join(' ')}" fill="#ff7a2f" stroke="#ffd166" stroke-width="1.2"/></g>`;
    const miss = (x, y) => `<circle cx="${x}" cy="${y}" r="5" fill="none" stroke="#fff" stroke-width="2"/><circle cx="${x}" cy="${y}" r="2" fill="#fff"/>`;
    h += hit(60, 40) + hit(80, 40) + miss(40, 80) + miss(100, 60) + miss(180, 120) + hit(140, 100);
    return h;
  }
  for (const id of ['hubSea', 'promoSea']) if ($(id)) $(id).innerHTML = seaArt();

  return {
    onState,
    reset,
    showRules,
    code: () => (G ? G.code : null),
  };
})();

// ukras za Ostrvo na kartici izbora igre
(() => {
  const src = $('promoHex'), dst = $('hubHex');
  if (src && dst) dst.innerHTML = src.innerHTML;
})();
