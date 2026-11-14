// Les ambiances, fabriquées par le jeu (aucun enregistrement) : pluie, oiseaux, grillons, feu des
// torches. Chacune renvoie { setLevel(v de 0 à 1, now) }, comme un son en boucle : le volume suit en
// douceur (now : tout de suite). Les sons courts (gouttes, chants, stridulations, crépitements) sont
// programmés un peu à l'avance (AHEAD s), seulement quand on les entend.
import { channel } from './sound.js?v=1.1.5-alpha-mwgq2wrb';

const AHEAD = 0.3, TICK = 100;
const rr = (a, b) => a + Math.random() * (b - a);

// Le squelette commun : un volume général, un programmateur appelé tant que le son est audible
function ambience(kind, gain, build, events) {
  const ch = channel(kind);
  if (!ch) return null;
  const a = ch.ctx, out = a.createGain();
  out.gain.value = 0;
  out.connect(ch.input);
  const S = { a, out, noise: ch.noise, level: 0, until: a.currentTime };
  build?.(S);
  let timer = null;
  const tick = () => {
    if (S.level < 0.005) { clearInterval(timer); timer = null; return; }
    const end = a.currentTime + AHEAD;
    if (S.until < a.currentTime) S.until = a.currentTime;
    while (S.until < end) S.until = events(S, S.until);
  };
  return {
    setLevel(v, now = false) {
      v = Math.max(0, Math.min(1, v));
      if (Math.abs(v - S.level) < 0.002 && !now) return;
      S.level = v;
      out.gain.cancelScheduledValues(a.currentTime);
      if (now) out.gain.setValueAtTime(v * gain, a.currentTime);
      else out.gain.setTargetAtTime(v * gain, a.currentTime, 0.6);
      if (events && v >= 0.005 && !timer) { timer = setInterval(tick, TICK); tick(); }
    },
  };
}

// (un bruit court, filtré en bande autour de f, enveloppe en d s, au temps t)
function burst(S, t, f, q, d, g, pan = 0) {
  const { a } = S, src = S.noise(), bp = a.createBiquadFilter(), e = a.createGain();
  bp.type = 'bandpass';
  bp.frequency.value = f;
  bp.Q.value = q;
  e.gain.setValueAtTime(0, t);
  e.gain.linearRampToValueAtTime(g, t + Math.min(0.004, d * 0.2));
  e.gain.exponentialRampToValueAtTime(0.0001, t + d);
  src.connect(bp).connect(e);
  if (pan && a.createStereoPanner) { const p = a.createStereoPanner(); p.pan.value = pan; e.connect(p).connect(S.out); } else e.connect(S.out);
  src.start(t, Math.random() * 1.5);
  src.stop(t + d + 0.02);
}

// (une note sifflée : de f0 à f1 en d s)
function whistle(S, t, f0, f1, d, g, pan) {
  const { a } = S, o = a.createOscillator(), e = a.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f1, t + d);
  e.gain.setValueAtTime(0, t);
  e.gain.linearRampToValueAtTime(g, t + d * 0.25);
  e.gain.linearRampToValueAtTime(g * 0.7, t + d * 0.7);
  e.gain.linearRampToValueAtTime(0, t + d);
  o.connect(e);
  if (a.createStereoPanner) { const p = a.createStereoPanner(); p.pan.value = pan; e.connect(p).connect(S.out); } else e.connect(S.out);
  o.start(t);
  o.stop(t + d + 0.02);
}

// Pluie : un souffle continu (le rideau de pluie, plus un fond sourd qui ondule) et des gouttes
export function rainSound() {
  return ambience('weather', 0.9, (S) => {
    const { a } = S;
    const hiss = S.noise(), hp = a.createBiquadFilter(), lp = a.createBiquadFilter(), hg = a.createGain();
    hiss.loop = true;
    hp.type = 'highpass'; hp.frequency.value = 600;
    lp.type = 'lowpass'; lp.frequency.value = 6500;
    hg.gain.value = 0.22;
    hiss.connect(hp).connect(lp).connect(hg).connect(S.out);
    const body = S.noise(), blp = a.createBiquadFilter(), bg = a.createGain();
    body.loop = true;
    blp.type = 'lowpass'; blp.frequency.value = 700; blp.Q.value = 0.4;
    bg.gain.value = 0.35;
    body.connect(blp).connect(bg).connect(S.out);
    // (des rafales : le fond monte et descend lentement)
    const lfo = a.createOscillator(), depth = a.createGain();
    lfo.frequency.value = 0.11;
    depth.gain.value = 0.12;
    lfo.connect(depth).connect(bg.gain);
    hiss.start(0, Math.random() * 1.5);
    body.start(0, Math.random() * 1.5);
    lfo.start();
  }, (S, t) => {
    // gouttes sur les feuilles et le sol : plus nombreuses quand il pleut fort
    burst(S, t, rr(1800, 5500), rr(4, 9), rr(0.008, 0.025), rr(0.05, 0.16), rr(-0.8, 0.8));
    return t + rr(0.01, 0.06) / (0.3 + S.level);
  });
}

// Oiseaux : quelques chanteurs, chacun sa hauteur et sa façon de chanter (des phrases de notes
// glissées, ou des trilles), à des moments au hasard
const BIRDS = [
  { f: 3200, n: [3, 6], d: [0.06, 0.12], up: true, pan: -0.5 },
  { f: 4300, n: [6, 12], d: [0.025, 0.04], trill: true, pan: 0.6 },
  { f: 2400, n: [2, 4], d: [0.12, 0.22], pan: 0.1 },
  { f: 5200, n: [2, 3], d: [0.04, 0.07], up: true, pan: -0.2 },
];
export function birdsSound() {
  return ambience('ambiance', 0.5, null, (S, t) => {
    const B = BIRDS[Math.floor(Math.random() * BIRDS.length)], n = Math.round(rr(B.n[0], B.n[1]));
    const base = B.f * rr(0.92, 1.08), loud = rr(0.04, 0.12);
    let u = t;
    for (let i = 0; i < n; i++) {
      const d = rr(B.d[0], B.d[1]), f0 = base * (B.trill ? (i % 2 ? 1.12 : 1) : rr(0.85, 1.15));
      const f1 = f0 * (B.trill ? 1.05 : B.up ? rr(1.15, 1.5) : rr(0.6, 0.85));
      whistle(S, u, f0, f1, d, loud * (B.trill ? 0.7 : 1), B.pan + rr(-0.15, 0.15));
      u += d + (B.trill ? 0.008 : rr(0.03, 0.09));
    }
    return u + rr(0.6, 3.2); // (le prochain chanteur)
  });
}

// Grillons : trois, chacun sa note et son rythme (trois coups d'archet très rapides, puis un silence)
export function cricketsSound() {
  const crickets = [0, 1, 2].map((i) => ({ f: rr(4300, 4900), period: rr(0.45, 0.8), pan: (i - 1) * 0.6, next: 0 }));
  return ambience('ambiance', 0.45, null, (S, t) => {
    const c = crickets.reduce((x, y) => (y.next < x.next ? y : x));
    const at = Math.max(t, c.next);
    for (let k = 0; k < 3; k++) {
      const { a } = S, o = a.createOscillator(), e = a.createGain(), s = at + k * 0.045;
      o.frequency.value = c.f;
      e.gain.setValueAtTime(0, s);
      e.gain.linearRampToValueAtTime(0.07, s + 0.006);
      e.gain.linearRampToValueAtTime(0, s + 0.028);
      o.connect(e);
      if (a.createStereoPanner) { const p = a.createStereoPanner(); p.pan.value = c.pan; e.connect(p).connect(S.out); } else e.connect(S.out);
      o.start(s);
      o.stop(s + 0.04);
    }
    c.next = at + c.period * rr(0.9, 1.1);
    return Math.min(...crickets.map((x) => x.next)) - 0.001;
  });
}

// Feu des torches : un souffle sourd qui ondule, et des crépitements (de temps en temps, un « pop »)
export function fireSound() {
  return ambience('ambiance', 0.7, (S) => {
    const { a } = S, roar = S.noise(), lp = a.createBiquadFilter(), g = a.createGain();
    roar.loop = true;
    lp.type = 'lowpass'; lp.frequency.value = 420; lp.Q.value = 0.7;
    g.gain.value = 0.3;
    const lfo = a.createOscillator(), depth = a.createGain();
    lfo.frequency.value = 0.7;
    depth.gain.value = 0.1;
    lfo.connect(depth).connect(g.gain);
    roar.connect(lp).connect(g).connect(S.out);
    roar.start(0, Math.random() * 1.5);
    lfo.start();
  }, (S, t) => {
    const pop = Math.random() < 0.08;
    burst(S, t, pop ? rr(700, 1400) : rr(1800, 4500), pop ? 2 : rr(3, 7), pop ? rr(0.03, 0.06) : rr(0.004, 0.014), pop ? 0.35 : rr(0.06, 0.22), rr(-0.3, 0.3));
    // (les crépitements viennent par petites grappes)
    return t + (Math.random() < 0.35 ? rr(0.015, 0.05) : rr(0.08, 0.4));
  });
}
