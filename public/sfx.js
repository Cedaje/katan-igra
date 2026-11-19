// Zvucni efekti. Svi zvukovi se prave u browseru (Web Audio), bez spoljnih fajlova.
const SFX = (() => {
  let ctx = null, master = null;
  let muted = false;
  // podesavanja zvuka: jacina (0-100) i grupe zvukova koje mogu posebno da se iskljuce
  const opts = { volume: 70, fx: true, turn: true, alerts: true, chat: true };
  try {
    muted = localStorage.getItem('ot_muted') === '1';
    Object.assign(opts, JSON.parse(localStorage.getItem('ot_sound') || '{}'));
  } catch (_) { /* nema storage */ }
  const GROUP = { myTurn: 'turn', tick: 'turn', turn: 'alerts', vote: 'alerts', offer: 'alerts', win: 'alerts', winBells: 'alerts', winDrums: 'alerts', lose: 'alerts', chat: 'chat' };
  const gainFor = () => 0.8 * (opts.volume / 100);

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = gainFor();
      master.connect(ctx.destination);
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
  function tone(freq, dur, { type = 'sine', vol = 0.3, at = 0, to = null, attack = 0.005 } = {}) {
    const c = ensure(); if (!c || muted) return;
    const t = c.currentTime + at;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    env(g, t, attack, dur, vol);
    o.connect(g).connect(master);
    o.start(t); o.stop(t + attack + dur + 0.05);
  }
  let noiseBuf = null;
  function noise(dur, { vol = 0.3, at = 0, freq = 1200, q = 1, type = 'bandpass', to = null } = {}) {
    const c = ensure(); if (!c || muted) return;
    if (!noiseBuf) {
      noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const t = c.currentTime + at;
    const src = c.createBufferSource(); src.buffer = noiseBuf;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = c.createGain(); env(g, t, 0.003, dur, vol);
    src.connect(f).connect(g).connect(master);
    src.start(t); src.stop(t + dur + 0.05);
  }
  const knock = (at = 0, f = 170, vol = 0.45) => { tone(f, 0.12, { type: 'triangle', vol, at, to: f * 0.6 }); noise(0.05, { vol: vol * 0.5, at, freq: 900, q: 2 }); };
  const chime = (notes, step, at = 0, vol = 0.18, type = 'sine') => notes.forEach((n, i) => { tone(n, 0.45, { type, vol, at: at + i * step }); tone(n * 2, 0.3, { type: 'sine', vol: vol * 0.25, at: at + i * step }); });

  const sounds = {
    // kockice: zveckanje ~0.85s, isto koliko traje animacija
    dice() {
      const hits = [0, 0.07, 0.15, 0.22, 0.31, 0.39, 0.49, 0.58, 0.69, 0.8];
      hits.forEach((at, i) => noise(0.045, { vol: 0.35 - i * 0.015, at, freq: 2200 + Math.random() * 1500, q: 3 }));
      knock(0.8, 220, 0.35); knock(0.86, 200, 0.3);
    },
    road() { knock(0, 190); knock(0.13, 150); },
    settlement() { knock(0, 160, 0.5); chime([523, 659], 0.09, 0.12); },
    city() { knock(0, 130, 0.55); knock(0.12, 130, 0.45); chime([523, 659, 784, 1047], 0.09, 0.22, 0.2); },
    devBuy() { noise(0.22, { vol: 0.35, freq: 1500, to: 5000, q: 0.8, type: 'highpass' }); tone(880, 0.08, { vol: 0.08, at: 0.18 }); },
    devPlay() { noise(0.35, { vol: 0.3, freq: 400, to: 3000, q: 1 }); chime([784, 988, 1175], 0.07, 0.25, 0.14); },
    knight() { tone(440, 0.45, { type: 'square', vol: 0.08, to: 430 }); tone(660, 0.4, { type: 'square', vol: 0.06, at: 0.02 }); noise(0.15, { vol: 0.25, freq: 4000, q: 4 }); },
    coins() { [0, 0.07, 0.13, 0.2, 0.28].forEach((at, i) => tone(1800 + i * 220, 0.12, { vol: 0.1, at, type: 'triangle' })); },
    gain(n = 1) { for (let i = 0; i < Math.min(n, 5); i++) { tone(620 + i * 90, 0.09, { vol: 0.16, at: i * 0.09, to: 900 + i * 90 }); } },
    seven() { tone(110, 0.45, { type: 'sawtooth', vol: 0.12, to: 98 }); tone(82, 0.55, { type: 'sawtooth', vol: 0.13, at: 0.38, to: 70 }); noise(0.6, { vol: 0.08, freq: 200, q: 0.7, at: 0.3 }); },
    robber() { tone(90, 0.3, { type: 'triangle', vol: 0.4, to: 55 }); noise(0.15, { vol: 0.2, freq: 300 }); },
    steal() { noise(0.3, { vol: 0.25, freq: 3000, to: 600, q: 2 }); tone(700, 0.2, { vol: 0.08, to: 300, at: 0.05 }); },
    offer() { tone(988, 0.3, { vol: 0.14 }); tone(1319, 0.35, { vol: 0.12, at: 0.12 }); },
    tradeDone() { [0, 0.06, 0.12].forEach((at) => tone(2100, 0.1, { vol: 0.09, at, type: 'triangle' })); chime([659, 880], 0.1, 0.18, 0.14); },
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
  };

  return {
    play(name, ...args) {
      if (muted || !opts[GROUP[name] || 'fx'] || !opts.volume) return;
      try { if (sounds[name]) sounds[name](...args); } catch (_) { /* zvuk nije bitan */ }
    },
    get opts() { return { ...opts }; },
    set(k, v) {
      opts[k] = v;
      try { localStorage.setItem('ot_sound', JSON.stringify(opts)); } catch (_) { /* */ }
      if (master) master.gain.value = gainFor();
    },
    setMuted(v) { if (muted !== !!v) this.toggle(); },
    get muted() { return muted; },
    toggle() { muted = !muted; try { localStorage.setItem('ot_muted', muted ? '1' : '0'); } catch (_) { /* */ } if (!muted) { ensure(); sounds.click(); } return muted; },
  };
})();
