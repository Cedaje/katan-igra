// Zvucni efekti. Svi zvukovi se prave u browseru (Web Audio), bez spoljnih fajlova.
const SFX = (() => {
  let ctx = null, master = null, musicBus = null;
  let theme = 'village'; // village (Osnovni, Kucice), sea (Podvodni svet) ili dino (Dino ostrvo)
  let muted = false;
  // podesavanja zvuka: jacina (0-100) i grupe zvukova koje mogu posebno da se iskljuce
  const opts = { volume: 70, fx: true, turn: true, alerts: true, chat: true, music: true, musicVol: 35 };
  try {
    muted = localStorage.getItem('ot_muted') === '1';
    Object.assign(opts, JSON.parse(localStorage.getItem('ot_sound') || '{}'));
  } catch (_) { /* nema storage */ }
  const GROUP = { myTurn: 'turn', tick: 'turn', warn: 'turn', turn: 'alerts', vote: 'alerts', offer: 'alerts', bell: 'alerts', win: 'alerts', winBells: 'alerts', winDrums: 'alerts', lose: 'alerts', chat: 'chat' };
  const gainFor = () => 0.8 * (opts.volume / 100);
  const musicGain = () => (opts.music && !muted ? 1.0 * (opts.musicVol / 100) * (opts.volume / 100) : 0);

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = gainFor();
      master.connect(ctx.destination);
      musicBus = ctx.createGain();
      musicBus.gain.value = musicGain();
      musicBus.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  // browser dozvoljava zvuk tek posle prvog klika ili tastera
  ['pointerdown', 'keydown'].forEach((ev) => window.addEventListener(ev, ensure, { once: false, passive: true }));

  function env(g, t, a, d, peak) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }
  function tone(freq, dur, { type = 'sine', vol = 0.3, at = 0, to = null, attack = 0.005, out = null } = {}) {
    const c = ensure(); if (!c || muted) return;
    const t = c.currentTime + at;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    env(g, t, attack, dur, vol);
    o.connect(g).connect(out || master);
    o.start(t); o.stop(t + attack + dur + 0.05);
  }
  let noiseBuf = null;
  function noise(dur, { vol = 0.3, at = 0, freq = 1200, q = 1, type = 'bandpass', to = null, out = null, attack = 0.003 } = {}) {
    const c = ensure(); if (!c || muted) return;
    if (!noiseBuf) {
      noiseBuf = c.createBuffer(1, c.sampleRate * 4, c.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const t = c.currentTime + at;
    const src = c.createBufferSource(); src.buffer = noiseBuf;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = c.createGain(); env(g, t, attack, dur, vol);
    src.connect(f).connect(g).connect(out || master);
    const len = Math.min(3.9, attack + dur + 0.05); src.start(t, Math.random() * (3.95 - len)); src.stop(t + attack + dur + 0.05);
  }
  // udarac cekica: metalni zvuk + kratak tup udarac
  const hammer = (at = 0, k = 1) => { tone(2400 * k, 0.06, { type: 'square', vol: 0.05, at }); tone(3170 * k, 0.05, { vol: 0.05, at }); tone(150, 0.1, { type: 'triangle', vol: 0.4, at, to: 90 }); noise(0.04, { vol: 0.25, at, freq: 3500, q: 1.5 }); };
  const bubble = (at = 0, out = null, vol = 0.12) => { const f = 300 + Math.random() * 500; tone(f, 0.08, { vol, at, to: f * 2.6, out }); };
  const knock = (at = 0, f = 170, vol = 0.45) => { tone(f, 0.12, { type: 'triangle', vol, at, to: f * 0.6 }); noise(0.05, { vol: vol * 0.5, at, freq: 900, q: 2 }); };
  const chime = (notes, step, at = 0, vol = 0.18, type = 'sine') => notes.forEach((n, i) => { tone(n, 0.45, { type, vol, at: at + i * step }); tone(n * 2, 0.3, { type: 'sine', vol: vol * 0.25, at: at + i * step }); });

  const sounds = {
    // kockice: zveckanje ~0.85s, isto koliko traje animacija
    dice() {
      const hits = [0, 0.07, 0.15, 0.22, 0.31, 0.39, 0.49, 0.58, 0.69, 0.8];
      hits.forEach((at, i) => noise(0.045, { vol: 0.35 - i * 0.015, at, freq: 2200 + Math.random() * 1500, q: 3 }));
      knock(0.8, 220, 0.35); knock(0.86, 200, 0.3);
    },
    // gradnja: udarci cekica
    road() { hammer(0); hammer(0.16, 0.8); },
    settlement() { hammer(0); hammer(0.15); hammer(0.3, 0.9); chime([523, 659], 0.09, 0.45); },
    city() { hammer(0); hammer(0.14); hammer(0.28); hammer(0.46, 1.1); chime([523, 659, 784, 1047], 0.09, 0.6, 0.2); },
    // karta stize u ruku
    card(i = 0) { noise(0.12, { vol: 0.16, freq: 2500, to: 5200, q: 0.9, at: i * 0.05 }); tone(1400, 0.05, { vol: 0.05, at: i * 0.05 + 0.1, type: 'triangle' }); },
    // zvono: stigla ponuda za razmenu
    bell() { [0, 0.02].forEach((d, i) => { tone(1318 * (i ? 2.76 : 1), 0.9, { vol: i ? 0.04 : 0.15, at: d }); }); tone(1760, 0.7, { vol: 0.1, at: 0.18 }); tone(1760 * 2.76, 0.5, { vol: 0.03, at: 0.18 }); },
    // upozorenje: moras da odbacis karte
    warn() { [0, 0.22, 0.44].forEach((at, i) => { tone(i % 2 ? 587 : 880, 0.16, { type: 'square', vol: 0.06, at }); }); },
    devBuy() { noise(0.22, { vol: 0.35, freq: 1500, to: 5000, q: 0.8, type: 'highpass' }); tone(880, 0.08, { vol: 0.08, at: 0.18 }); },
    devPlay() { noise(0.35, { vol: 0.3, freq: 400, to: 3000, q: 1 }); chime([784, 988, 1175], 0.07, 0.25, 0.14); },
    knight() { tone(440, 0.45, { type: 'square', vol: 0.08, to: 430 }); tone(660, 0.4, { type: 'square', vol: 0.06, at: 0.02 }); noise(0.15, { vol: 0.25, freq: 4000, q: 4 }); },
    coins() { [0, 0.07, 0.13, 0.2, 0.28].forEach((at, i) => tone(1800 + i * 220, 0.12, { vol: 0.1, at, type: 'triangle' })); },
    gain(n = 1) { for (let i = 0; i < Math.min(n, 5); i++) { tone(620 + i * 90, 0.09, { vol: 0.16, at: i * 0.09, to: 900 + i * 90 }); } },
    seven() { tone(110, 0.45, { type: 'sawtooth', vol: 0.12, to: 98 }); tone(82, 0.55, { type: 'sawtooth', vol: 0.13, at: 0.38, to: 70 }); noise(0.6, { vol: 0.08, freq: 200, q: 0.7, at: 0.3 }); },
    robber() {
      if (theme === 'dino') { // Reks: teški koraci pa rik
        [0, 0.28, 0.56].forEach((at) => { tone(70, 0.22, { type: 'sine', vol: 0.4, to: 40, at }); noise(0.12, { vol: 0.2, freq: 180, q: 0.8, at }); });
        tone(150, 0.9, { type: 'sawtooth', vol: 0.12, to: 75, at: 0.85 }); tone(113, 0.9, { type: 'sawtooth', vol: 0.1, to: 58, at: 0.85 });
        noise(0.95, { vol: 0.3, freq: 700, to: 250, q: 1.2, at: 0.85 });
        return;
      }
      if (theme === 'sea') { // ajkula: brzo kretanje kroz vodu i mehurici
        noise(0.7, { vol: 0.28, freq: 300, to: 1400, q: 0.7, type: 'lowpass', attack: 0.15 });
        tone(65, 0.6, { type: 'sawtooth', vol: 0.07, to: 48 });
        for (let i = 0; i < 6; i++) bubble(0.35 + i * 0.07 + Math.random() * 0.05);
        return;
      }
      // lopov: koraci na prstima pa podsmešljivo "he-he"
      [0, 0.16, 0.32, 0.48].forEach((at, i) => tone([392, 330, 294, 247][i], 0.07, { type: 'triangle', vol: 0.16, at }));
      [0.72, 0.9, 1.06].forEach((at) => { noise(0.07, { vol: 0.18, freq: 1300, q: 3, at }); tone(240, 0.07, { type: 'sawtooth', vol: 0.05, at, to: 200 }); });
    },
    steal() { noise(0.3, { vol: 0.25, freq: 3000, to: 600, q: 2 }); tone(700, 0.2, { vol: 0.08, to: 300, at: 0.05 }); },
    offer() { tone(988, 0.3, { vol: 0.14 }); tone(1319, 0.35, { vol: 0.12, at: 0.12 }); },
    tradeDone() { tone(1568, 0.5, { vol: 0.16 }); tone(1568 * 2, 0.35, { vol: 0.05 }); tone(2093, 0.6, { vol: 0.13, at: 0.1 }); },
    bank() { tone(1600, 0.12, { vol: 0.12, type: 'triangle' }); tone(2000, 0.15, { vol: 0.1, at: 0.08, type: 'triangle' }); },
    myTurn() { tone(784, 0.35, { vol: 0.2 }); tone(1047, 0.5, { vol: 0.2, at: 0.18 }); },
    turn() { tone(520, 0.1, { vol: 0.06 }); },
    discard() { noise(0.25, { vol: 0.25, freq: 2500, q: 0.6, type: 'highpass' }); noise(0.2, { vol: 0.18, freq: 1800, q: 0.6, type: 'highpass', at: 0.12 }); },
    achieve() { chime([523, 659, 784, 1047, 1319], 0.08, 0, 0.16, 'triangle'); },
    win() { chime([523, 523, 523, 659, 784, 659, 784, 1047], 0.17, 0, 0.18, 'triangle'); tone(262, 1.4, { vol: 0.08, at: 0.1, type: 'sine' }); },
    winBells() { [0, 0.25, 0.5, 0.75].forEach((at, i) => { tone([1047, 1319, 1568, 2093][i], 1.2, { vol: 0.14, at }); tone([1047, 1319, 1568, 2093][i] * 2.01, 0.8, { vol: 0.04, at }); }); },
    winDrums() { [0, 0.12, 0.24, 0.42, 0.54, 0.66, 0.9].forEach((at, i) => knock(at, i === 6 ? 90 : 120, i === 6 ? 0.7 : 0.5)); chime([523, 659, 784], 0.1, 1.05, 0.16, 'triangle'); },
    lose() { chime([523, 466, 415, 349], 0.2, 0, 0.14, 'triangle'); },
    chat() { tone(1200, 0.06, { vol: 0.08 }); tone(1500, 0.06, { vol: 0.07, at: 0.06 }); },
    error() { tone(160, 0.18, { type: 'square', vol: 0.06 }); },
    tick() { tone(1500, 0.04, { vol: 0.08, type: 'square' }); },
    vote() { tone(660, 0.15, { vol: 0.14, type: 'triangle' }); tone(660, 0.15, { vol: 0.14, type: 'triangle', at: 0.2 }); },
    kick() { tone(120, 0.35, { type: 'triangle', vol: 0.45, to: 50 }); noise(0.2, { vol: 0.2, freq: 250 }); },
    leave() { tone(500, 0.25, { vol: 0.12, to: 250 }); },
    click() { tone(900, 0.03, { vol: 0.06 }); },
    // Potapanje brodova
    shot() { noise(0.12, { vol: 0.2, freq: 900, to: 300, q: 0.8 }); },
    cannon() { tone(70, 0.35, { type: 'sine', vol: 0.4, to: 38 }); noise(0.25, { vol: 0.45, freq: 1400, to: 200, q: 0.6 }); noise(0.6, { vol: 0.12, freq: 300, q: 0.5, at: 0.05 }); },
    splash() { noise(0.14, { vol: 0.3, freq: 2600, q: 0.7, at: 0.32, type: 'highpass' }); noise(0.6, { vol: 0.3, freq: 1600, to: 400, q: 0.6, at: 0.36 }); [0.5, 0.62, 0.71].forEach((at, i) => tone(700 + i * 260, 0.07, { vol: 0.05, at, to: 1300 + i * 200, type: 'sine' })); },
    boom() { tone(95, 0.6, { type: 'sawtooth', vol: 0.18, to: 40, at: 0.3 }); noise(0.55, { vol: 0.5, freq: 700, to: 110, q: 0.7, at: 0.3 }); noise(0.9, { vol: 0.12, freq: 2500, q: 0.4, at: 0.45, type: 'highpass' }); },
    sunk() { tone(85, 0.9, { type: 'sawtooth', vol: 0.18, to: 32, at: 0.3 }); noise(1.0, { vol: 0.45, freq: 500, to: 70, q: 0.7, at: 0.3 }); tone(160, 1.4, { type: 'triangle', vol: 0.08, to: 60, at: 0.9 }); for (let i = 0; i < 7; i++) tone(500 + ((i * 137) % 400), 0.06, { vol: 0.05, at: 1.1 + i * 0.12, to: 900 + ((i * 211) % 500) }); },
    bombFall() { tone(1400, 0.7, { type: 'sine', vol: 0.07, to: 300 }); [0.75, 0.9, 1.02].forEach((at) => { tone(80, 0.5, { type: 'sawtooth', vol: 0.15, to: 35, at }); noise(0.45, { vol: 0.4, freq: 600, to: 100, q: 0.7, at }); }); },
    sonar() { [0, 0.55].forEach((at, i) => { tone(1180, 0.5, { vol: i ? 0.06 : 0.14, at }); tone(1180 * 1.5, 0.3, { vol: i ? 0.02 : 0.04, at }); }); },
    horn() { tone(146, 1.0, { type: 'sawtooth', vol: 0.09 }); tone(220, 1.0, { type: 'sawtooth', vol: 0.06 }); tone(146, 0.5, { type: 'sawtooth', vol: 0.08, at: 1.15 }); },
    ready() { tone(660, 0.12, { vol: 0.12, type: 'triangle' }); tone(990, 0.2, { vol: 0.12, type: 'triangle', at: 0.1 }); },
    anchor() { for (let i = 0; i < 6; i++) tone(300 + (i % 2) * 40, 0.05, { type: 'square', vol: 0.04, at: i * 0.07 }); tone(110, 0.3, { vol: 0.2, at: 0.45, to: 70 }); },
    place() { tone(180, 0.12, { vol: 0.25, to: 120 }); noise(0.08, { vol: 0.18, freq: 800, q: 1 }); },
    pickup() { tone(260, 0.1, { vol: 0.15, to: 420, type: 'triangle' }); },
    rotate() { noise(0.12, { vol: 0.15, freq: 1800, to: 3200, q: 2 }); },
    shuffle() { for (let i = 0; i < 5; i++) { tone(160 + i * 15, 0.08, { vol: 0.15, at: i * 0.07, to: 110 }); } },
  };

  // ---------- muzika u pozadini (pravi se u browseru, bez fajlova) ----------
  const PENTA = [0, 2, 4, 7, 9];
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const VILLAGE_CHORDS = [[48, 52, 55], [45, 48, 52], [41, 45, 48], [43, 47, 50]]; // C, Am, F, G
  const SEA_CHORDS = [[38, 45, 50, 53], [34, 41, 46, 50], [36, 43, 48, 52], [33, 40, 45, 48]];
  let musicOn = false, nextT = 0, step = 0, timer = null;
  function scheduleStep(t) {
    const out = musicBus;
    if (theme === 'sea') {
      // spori akordi, talasi i mehurici
      const bar = Math.floor(step / 8) % SEA_CHORDS.length;
      if (step % 8 === 0) {
        for (const m of SEA_CHORDS[bar]) tone(mtof(m), 4.2, { vol: 0.05, at: t - ctx.currentTime, attack: 1.4, out });
        noise(3.5, { vol: 0.05, freq: 380, q: 0.6, type: 'lowpass', at: t - ctx.currentTime, attack: 1.6, out });
      }
      if (Math.random() < 0.18) bubble(t - ctx.currentTime, out, 0.05);
      if (step % 4 === 2 && Math.random() < 0.5) { const m = SEA_CHORDS[bar][Math.floor(Math.random() * 4)] + 24; tone(mtof(m), 1.6, { vol: 0.035, at: t - ctx.currentTime, attack: 0.05, out }); }
      return 0.55;
    }
    if (theme === 'dino') {
      // dzungla: bubnjevi, marimba i poneka ptica
      const bar = Math.floor(step / 8) % VILLAGE_CHORDS.length, ch = VILLAGE_CHORDS[bar], at = t - ctx.currentTime;
      const drum = (f, v) => { tone(f, 0.14, { type: 'triangle', vol: v, at, to: f * 0.6, out }); noise(0.04, { vol: v * 0.3, at, freq: 700, q: 2, out }); };
      if (step % 4 === 0) drum(110, 0.14);
      if (step % 4 === 2) drum(165, 0.08);
      if (step % 8 === 0) tone(mtof(ch[0] - 12), 1.2, { vol: 0.06, at, attack: 0.08, out });
      if (Math.random() < 0.38) { const m = 69 + PENTA[Math.floor(Math.random() * 5)]; tone(mtof(m), 0.22, { type: 'sine', vol: 0.06, at, out }); tone(mtof(m) * 4, 0.08, { type: 'sine', vol: 0.012, at, out }); }
      if (Math.random() < 0.03) { tone(2400, 0.12, { vol: 0.02, at: at + 0.05, to: 3200, out }); tone(2600, 0.1, { vol: 0.02, at: at + 0.2, to: 3400, out }); }
      return 0.3;
    }
    // vesela seoska muzika: bas, akord i melodija od pet tonova
    const bar = Math.floor(step / 8) % VILLAGE_CHORDS.length, ch = VILLAGE_CHORDS[bar], at = t - ctx.currentTime;
    if (step % 4 === 0) tone(mtof(ch[0] - 12), 0.45, { type: 'triangle', vol: 0.11, at, out });
    if (step % 8 === 0) for (const m of ch) tone(mtof(m + 12), 1.6, { vol: 0.025, at, attack: 0.12, out });
    if (step % 2 === 1 && step % 8 !== 7) for (const m of ch) tone(mtof(m + 12), 0.12, { type: 'triangle', vol: 0.02, at, out });
    if (Math.random() < 0.42) { const m = 72 + PENTA[Math.floor(Math.random() * 5)] + (Math.random() < 0.3 ? 12 : 0); tone(mtof(m), 0.3, { type: 'triangle', vol: 0.05, at, out }); }
    return 0.31;
  }
  function tick() {
    if (!ctx || !musicOn) return;
    if (document.hidden || musicGain() === 0) { nextT = ctx.currentTime + 0.1; return; }
    while (nextT < ctx.currentTime + 0.35) { const len = scheduleStep(nextT); step++; nextT += len; }
  }
  function startMusic() {
    if (musicOn || !opts.music) return;
    const c = ensure(); if (!c || c.state !== 'running') return;
    musicOn = true; nextT = c.currentTime + 0.2; step = 0;
    timer = setInterval(tick, 120);
  }
  // muzika krece posle prvog klika (browser ne dozvoljava ranije)
  ['pointerdown', 'keydown'].forEach((ev) => window.addEventListener(ev, () => setTimeout(startMusic, 50), { passive: true }));

  return {
    setTheme(t) { theme = t === 'sea' || t === 'dino' ? t : 'village'; step = 0; },
    play(name, ...args) {
      if (muted || !opts[GROUP[name] || 'fx'] || !opts.volume) return;
      try { if (sounds[name]) sounds[name](...args); } catch (_) { /* zvuk nije bitan */ }
    },
    get opts() { return { ...opts }; },
    set(k, v) {
      opts[k] = v;
      try { localStorage.setItem('ot_sound', JSON.stringify(opts)); } catch (_) { /* */ }
      if (master) master.gain.value = gainFor();
      if (musicBus) musicBus.gain.value = musicGain();
      if (opts.music) startMusic();
    },
    setMuted(v) { if (muted !== !!v) this.toggle(); },
    get muted() { return muted; },
    toggle() { muted = !muted; try { localStorage.setItem('ot_muted', muted ? '1' : '0'); } catch (_) { /* */ } if (!muted) { ensure(); sounds.click(); startMusic(); } if (musicBus) musicBus.gain.value = musicGain(); return muted; },
  };
})();
