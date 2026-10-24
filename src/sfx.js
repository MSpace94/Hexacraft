// Bruitages des actions (aucun fichier audio, sauf les pas réutilisés pour le bois, l'herbe, la
// terre et le métal) : casser et poser un bloc selon sa matière, coups de pioche, manger,
// ramasser, se faire mal, mourir, frapper un animal, les cris des animaux, plonger dans l'eau,
// ouvrir un coffre, fabriquer un objet, les clics des menus.
// Tous passent par le réglage « Effets » (voir sound.js).
import { channel, playStep } from './sound.js?v=1.1.5-alpha-mvm2b95g';

const rr = (a, b) => a + Math.random() * (b - a);

// Une enveloppe courte sur un gain : monte en `att`, s'éteint en `dec`
function burst(a, node, t, peak, att, dec) {
  node.gain.setValueAtTime(0.0001, t);
  node.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + att);
  node.gain.exponentialRampToValueAtTime(0.0001, t + att + dec);
}
// Bruit filtré (passe-bande) : la base des chocs, craquements, frottements
function noiseHit(ch, out, t, { f = 1200, q = 1, peak = 1, att = 0.003, dec = 0.12, type = 'bandpass', sweep = 0 }) {
  const a = ch.ctx, n = ch.noise(), flt = a.createBiquadFilter(), g = a.createGain();
  flt.type = type; flt.Q.value = q;
  flt.frequency.setValueAtTime(f, t);
  if (sweep) flt.frequency.exponentialRampToValueAtTime(Math.max(40, f * sweep), t + att + dec);
  n.connect(flt).connect(g).connect(out);
  burst(a, g, t, peak, att, dec);
  n.start(t, rr(0, 1.5));
  n.stop(t + att + dec + 0.05);
}
// Note courte (sinus, triangle...) avec glissando
function tone(ch, out, t, { f = 440, to = 0, type = 'sine', peak = 1, att = 0.005, dec = 0.15 }) {
  const a = ch.ctx, o = a.createOscillator(), g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + att + dec);
  o.connect(g).connect(out);
  burst(a, g, t, peak, att, dec);
  o.start(t);
  o.stop(t + att + dec + 0.05);
}
// (dist : distance du son en blocs ; le volume baisse avec elle, moitié à 16 blocs, silence à range)
const ready = (vol, dist = 0, range = 64) => {
  if (dist >= range) return null;
  if (dist > 0) vol *= (1 / (1 + (dist / 16) ** 1.4)) * (1 - dist / range);
  if (vol < 0.003) return null;
  const ch = channel('effects');
  if (!ch) return null;
  return { ch, out: ch.output(dist, vol).input, t: ch.ctx.currentTime + 0.005 };
};

// ---------- Blocs ----------
// matière (voir matterOf dans survival.js) -> son des pas réutilisé, et le timbre du choc
const STEP_OF = { dirt: 'terre', wood: 'bois', leaves: 'herbe', snow: 'terre', wool: 'herbe', rail: 'metal', instant: 'herbe' };
const KNOCK = {
  stone: { f: 1500, q: 1.2, dec: 0.09 }, hard: { f: 1900, q: 2, dec: 0.08 }, obsidian: { f: 1100, q: 1.5, dec: 0.1 },
  wood: { f: 700, q: 2.5, dec: 0.1 }, dirt: { f: 500, q: 0.8, dec: 0.08 }, snow: { f: 2500, q: 0.6, dec: 0.07 },
  leaves: { f: 3200, q: 0.5, dec: 0.12 }, glass: { f: 3500, q: 3, dec: 0.05 }, wool: { f: 400, q: 0.5, dec: 0.08 },
  rail: { f: 2600, q: 6, dec: 0.15 }, instant: { f: 2800, q: 0.5, dec: 0.06 },
};

// Un coup de pioche sur le bloc en train d'être cassé
export function playDig(matter) {
  const s = ready(0.45);
  if (!s) return;
  const k = KNOCK[matter] || KNOCK.dirt;
  noiseHit(s.ch, s.out, s.t, { ...k, f: k.f * rr(0.85, 1.15), peak: 0.9 });
  if (matter === 'wood') tone(s.ch, s.out, s.t, { f: rr(180, 230), to: 120, type: 'triangle', peak: 0.5, dec: 0.08 });
}

// Le bloc se casse
export function playBreak(matter) {
  if (STEP_OF[matter]) playStep(STEP_OF[matter], 1.4);
  const s = ready(0.65);
  if (!s) return;
  const { ch, out, t } = s;
  if (matter === 'glass') {
    // verre : plusieurs éclats aigus, en cascade
    for (let i = 0; i < 7; i++) {
      tone(ch, out, t + i * rr(0.012, 0.03), { f: rr(2500, 6000), type: 'sine', peak: 0.35, dec: rr(0.08, 0.25) });
      noiseHit(ch, out, t + i * 0.02, { f: rr(4000, 8000), q: 4, peak: 0.4, dec: 0.06 });
    }
    return;
  }
  const k = KNOCK[matter] || KNOCK.dirt;
  // un craquement, puis les morceaux qui tombent
  noiseHit(ch, out, t, { ...k, peak: 1, dec: k.dec * 2, sweep: 0.4 });
  for (let i = 1; i < 4; i++) noiseHit(ch, out, t + i * rr(0.03, 0.06), { ...k, f: k.f * rr(0.6, 1.3), peak: 0.4, dec: k.dec });
  if (matter === 'stone' || matter === 'hard' || matter === 'obsidian') tone(ch, out, t, { f: 110, to: 60, peak: 0.5, dec: 0.15 });
}

// Un bloc est posé
export function playPlace(matter) {
  if (STEP_OF[matter]) { playStep(STEP_OF[matter], 1.2); return; }
  const s = ready(0.5);
  if (!s) return;
  const k = KNOCK[matter] || KNOCK.stone;
  noiseHit(s.ch, s.out, s.t, { ...k, f: k.f * 0.7, peak: 0.9, dec: k.dec * 1.3 });
  tone(s.ch, s.out, s.t, { f: 150, to: 80, peak: 0.45, dec: 0.08 });
}

// ---------- Le joueur ----------
// manger : trois croquées
export function playEat() {
  const s = ready(0.3);
  if (!s) return;
  for (let i = 0; i < 3; i++) {
    const t = s.t + i * 0.16 + rr(0, 0.03);
    noiseHit(s.ch, s.out, t, { f: rr(1400, 2600), q: 1.5, peak: 1, dec: 0.07 });
    noiseHit(s.ch, s.out, t + 0.03, { f: rr(600, 900), q: 1, peak: 0.6, dec: 0.05 });
  }
}
// un objet ramassé : petit « pop »
export function playPickup() {
  const s = ready(0.16);
  if (!s) return;
  tone(s.ch, s.out, s.t, { f: rr(700, 900), to: rr(1300, 1600), type: 'sine', peak: 1, att: 0.004, dec: 0.08 });
}
// se faire mal : un coup sourd et un souffle (la voix, en formants de « oh »)
export function playHurt() {
  const s = ready(0.35);
  if (!s) return;
  const { ch, out, t } = s;
  noiseHit(ch, out, t, { f: 300, q: 0.7, peak: 1, dec: 0.12, type: 'lowpass' });
  const a = ch.ctx, o = a.createOscillator(), g = a.createGain(), f1 = a.createBiquadFilter(), f2 = a.createBiquadFilter();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(rr(160, 190), t);
  o.frequency.exponentialRampToValueAtTime(110, t + 0.25);
  f1.type = 'bandpass'; f1.frequency.value = 500; f1.Q.value = 5;
  f2.type = 'bandpass'; f2.frequency.value = 900; f2.Q.value = 6;
  o.connect(f1).connect(g); o.connect(f2).connect(g);
  g.connect(out);
  burst(a, g, t, 0.9, 0.02, 0.22);
  o.start(t); o.stop(t + 0.3);
}
// mourir : un long souffle qui tombe
export function playDeath() {
  const s = ready(0.35);
  if (!s) return;
  noiseHit(s.ch, s.out, s.t, { f: 200, q: 0.6, peak: 1, dec: 0.4, type: 'lowpass' });
  tone(s.ch, s.out, s.t, { f: 180, to: 70, type: 'triangle', peak: 0.7, att: 0.03, dec: 0.9 });
}
// plonger dans l'eau (fort : on y tombe vite)
export function playSplash(strength = 1) {
  const s = ready(0.35 * Math.min(1.4, 0.4 + strength));
  if (!s) return;
  noiseHit(s.ch, s.out, s.t, { f: 1800, q: 0.5, peak: 1, att: 0.01, dec: 0.45, sweep: 0.25 });
  for (let i = 0; i < 6; i++) tone(s.ch, s.out, s.t + 0.05 + i * rr(0.03, 0.08), { f: rr(500, 1400), to: rr(1600, 2600), peak: 0.25, dec: 0.05 });
}
// un coup porté (épée, poing) qui touche
export function playHit(dist = 0) {
  const s = ready(0.4, dist);
  if (!s) return;
  noiseHit(s.ch, s.out, s.t, { f: 900, q: 0.8, peak: 1, dec: 0.08 });
  tone(s.ch, s.out, s.t, { f: 160, to: 70, peak: 0.8, dec: 0.1 });
}
// un coup dans le vide (le geste de l'épée)
export function playSwing() {
  const s = ready(0.12);
  if (!s) return;
  noiseHit(s.ch, s.out, s.t, { f: 600, q: 1.2, peak: 1, att: 0.03, dec: 0.12, sweep: 3 });
}

// ---------- Les animaux ----------
// Voix d'animal : une source (dents de scie) dans deux formants, avec vibrato
function creature(dist, { f0, f1, to = 0, fA, fB, dur, vib = 0, vibRate = 6, vol = 0.25, rough = 0 }) {
  const s = ready(vol, dist);
  if (!s) return;
  const { ch, out, t } = s, a = ch.ctx;
  const o = a.createOscillator(), g = a.createGain(), A = a.createBiquadFilter(), B = a.createBiquadFilter();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(f0, t);
  if (f1) o.frequency.linearRampToValueAtTime(f1, t + dur * 0.4);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  if (vib) {
    const l = a.createOscillator(), lg = a.createGain();
    l.frequency.value = vibRate; lg.gain.value = vib;
    l.connect(lg).connect(o.frequency);
    l.start(t); l.stop(t + dur + 0.1);
  }
  A.type = 'bandpass'; A.frequency.value = fA; A.Q.value = 4;
  B.type = 'bandpass'; B.frequency.value = fB; B.Q.value = 5;
  o.connect(A).connect(g); o.connect(B).connect(g);
  g.connect(out);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(1, t + Math.min(0.08, dur * 0.2));
  g.gain.setValueAtTime(1, t + dur * 0.7);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.start(t); o.stop(t + dur + 0.05);
  if (rough) noiseHit(ch, out, t, { f: fA, q: 1, peak: rough, att: 0.05, dec: dur });
}
const VOICES = {
  sheep: () => ({ f0: rr(300, 360), f1: rr(320, 380), to: rr(260, 300), fA: 700, fB: 1800, dur: 0.7, vib: 18, vibRate: 11 }),
  pig: () => ({ f0: rr(180, 220), to: rr(120, 150), fA: 450, fB: 1300, dur: 0.22, rough: 0.6, vol: 0.3 }),
  cow: () => ({ f0: rr(110, 130), f1: rr(140, 160), to: rr(95, 110), fA: 400, fB: 800, dur: 1.2, vib: 3, vol: 0.3 }),
  chicken: () => ({ f0: rr(700, 900), to: rr(500, 600), fA: 1500, fB: 3000, dur: 0.15, vol: 0.18 }),
  zombie: () => ({ f0: rr(80, 100), f1: rr(110, 130), to: rr(70, 85), fA: 350, fB: 700, dur: rr(0.9, 1.4), vib: 6, vibRate: 4, rough: 0.5, vol: 0.32 }),
  skeleton: () => ({ f0: rr(500, 600), to: 400, fA: 1200, fB: 2600, dur: 0.2, rough: 0.8, vol: 0.2 }),
  wolf: () => ({ f0: rr(500, 560), f1: rr(700, 760), to: rr(420, 480), fA: 900, fB: 2200, dur: 1.1, vib: 8, vol: 0.2 }),
  rabbit: () => ({ f0: rr(1200, 1400), to: 900, fA: 2000, fB: 4000, dur: 0.08, vol: 0.1 }),
};
VOICES.hare = VOICES.rabbit;
VOICES.fox = () => ({ f0: rr(700, 800), f1: rr(900, 1000), to: rr(600, 650), fA: 1200, fB: 2600, dur: 0.25, vol: 0.16 });
export const hasVoice = (type) => !!VOICES[type];
export function playAnimal(type, dist = 0, hurt = false) {
  const v = VOICES[type];
  if (!v) return;
  const p = v();
  if (hurt) { p.f0 *= 1.25; if (p.f1) p.f1 *= 1.25; if (p.to) p.to *= 1.3; p.dur = Math.min(p.dur, 0.35); p.vol = (p.vol || 0.25) * 1.2; }
  creature(dist, p);
}

// ---------- Objets et menus ----------
// coffre : le couvercle qui grince, puis se pose
export function playChest(open = true) {
  const s = ready(0.28);
  if (!s) return;
  const { ch, out, t } = s;
  if (open) {
    tone(ch, out, t, { f: rr(300, 340), to: rr(420, 480), type: 'sawtooth', peak: 0.15, att: 0.05, dec: 0.25 });
    noiseHit(ch, out, t + 0.3, { f: 600, q: 2, peak: 0.6, dec: 0.08 });
  } else noiseHit(ch, out, t, { f: 500, q: 2, peak: 1, dec: 0.1 });
}
// un objet fabriqué : deux petits coups métalliques
export function playCraft() {
  const s = ready(0.22);
  if (!s) return;
  tone(s.ch, s.out, s.t, { f: 1800, type: 'triangle', peak: 0.7, dec: 0.12 });
  tone(s.ch, s.out, s.t + 0.09, { f: 2400, type: 'triangle', peak: 0.6, dec: 0.18 });
  noiseHit(s.ch, s.out, s.t, { f: 3000, q: 4, peak: 0.5, dec: 0.05 });
}
// clic dans un menu
export function playClick() {
  const s = ready(0.1);
  if (!s) return;
  tone(s.ch, s.out, s.t, { f: 1100, to: 900, type: 'triangle', peak: 1, att: 0.002, dec: 0.04 });
}

// ---------- Le train (voir trains.js) ----------
// les roues passent d'un rail à l'autre : un double « tac-tac » métallique (plus vif quand ça va vite)
export function playClack(dist = 0, speed = 5) {
  const s = ready(0.22 * Math.min(1.3, 0.5 + speed / 15), dist, 56);
  if (!s) return;
  const gap = Math.max(0.05, 0.22 - speed * 0.008);
  for (const dt of [0, gap]) {
    noiseHit(s.ch, s.out, s.t + dt, { f: 2400, q: 3, peak: 1, dec: 0.05 });
    tone(s.ch, s.out, s.t + dt, { f: 180, to: 110, type: 'triangle', peak: 0.5, dec: 0.06 });
  }
}
// le sifflet du train (départ, arrivée en gare, touche H) : un accord aigu, un peu de souffle,
// qui monte en démarrant et vibre un peu
// kind : 'clear' (sifflet clair, par défaut), 'war' (grave et rauque : la vapeur camouflée) ;
// pitch : plus ou moins aigu (chaque train le sien)
export function playWhistle(dist = 0, kind = 'clear', pitch = 1) {
  const s = ready(0.22, dist, 140); // (un sifflet porte loin, mais pas à l'infini)
  if (!s) return;
  const war = kind === 'war';
  const a = s.ch.ctx, g = a.createGain(), bp = a.createBiquadFilter();
  bp.type = 'bandpass'; bp.frequency.value = (war ? 800 : 1400) * pitch; bp.Q.value = war ? 0.6 : 0.8;
  bp.connect(g).connect(s.out);
  g.gain.setValueAtTime(0.0001, s.t);
  g.gain.exponentialRampToValueAtTime(0.7, s.t + 0.08);
  g.gain.setValueAtTime(0.7, s.t + 0.9);
  g.gain.exponentialRampToValueAtTime(0.0001, s.t + 1.25);
  const vib = a.createOscillator(), vg = a.createGain();
  vib.frequency.value = 6; vg.gain.value = 6;
  vib.connect(vg);
  for (const f0 of war ? [392, 466, 587] : [784, 988, 1175]) {
    const f = f0 * pitch, o = a.createOscillator();
    o.type = war ? 'sawtooth' : 'triangle';
    o.frequency.setValueAtTime(f * 0.94, s.t);
    o.frequency.exponentialRampToValueAtTime(f, s.t + 0.12);
    vg.connect(o.frequency);
    o.connect(bp);
    o.start(s.t);
    o.stop(s.t + 1.3);
  }
  vib.start(s.t);
  vib.stop(s.t + 1.3);
  noiseHit(s.ch, s.out, s.t, { f: war ? 1500 : 2600, q: 0.7, peak: war ? 0.45 : 0.25, att: 0.05, dec: 1.0 }); // (la vapeur)
}
// le klaxon de la locomotive, selon son moteur : 'diesel' (deux tons graves un peu désaccordés,
// une trompe), 'elec' (deux tons clairs l'un après l'autre), 'fusion' (un son synthétique qui
// glisse) ; pitch : plus ou moins aigu (chaque train le sien)
export function playHorn(kind = 'diesel', pitch = 1) {
  const s = ready(0.3);
  if (!s) return;
  if (kind === 'elec') {
    for (const [f, dt] of [[587, 0], [740, 0.42]]) {
      tone(s.ch, s.out, s.t + dt, { f: f * pitch, type: 'triangle', peak: 0.55, att: 0.03, dec: 0.4 });
      tone(s.ch, s.out, s.t + dt, { f: f * pitch * 2, type: 'sine', peak: 0.12, att: 0.03, dec: 0.3 });
    }
    return;
  }
  if (kind === 'fusion') {
    tone(s.ch, s.out, s.t, { f: 330 * pitch, to: 880 * pitch, type: 'sine', peak: 0.5, att: 0.05, dec: 0.7 });
    tone(s.ch, s.out, s.t + 0.05, { f: 495 * pitch, to: 1320 * pitch, type: 'triangle', peak: 0.2, att: 0.05, dec: 0.65 });
    return;
  }
  const a = s.ch.ctx, g = a.createGain(), lp = a.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = 1800;
  lp.connect(g).connect(s.out);
  g.gain.setValueAtTime(0.0001, s.t);
  g.gain.exponentialRampToValueAtTime(0.6, s.t + 0.06);
  g.gain.setValueAtTime(0.6, s.t + 0.75);
  g.gain.exponentialRampToValueAtTime(0.0001, s.t + 1.1);
  for (const f of [233, 294, 296]) {
    const o = a.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = f * pitch;
    o.connect(lp);
    o.start(s.t);
    o.stop(s.t + 1.15);
  }
}

// ---------- Moteur du train, freins, annonces en gare ----------
// Bruit continu du moteur de la locomotive la plus proche (appelé à chaque image) : un grondement
// grave qui monte avec la vitesse et l'effort (thermique), ou un sifflement aigu (électrique) ;
// level 0 : silence. squeal : grincement des freins (0..1)
let eng = null;
export function engineSound(level, speed, effort, kind = 'fuel', squeal = 0) {
  const ch = channel('effects');
  if (!ch) return;
  const a = ch.ctx, t = a.currentTime;
  if (!eng) {
    if (level <= 0.001 && squeal <= 0.001) return;
    const out = a.createGain();
    out.gain.value = 0;
    out.connect(ch.input);
    const lp = a.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 420; lp.Q.value = 1.2;
    lp.connect(out);
    const o1 = a.createOscillator(), o2 = a.createOscillator(), o3 = a.createOscillator();
    o1.type = 'sawtooth'; o2.type = 'square'; o3.type = 'sine';
    const g1 = a.createGain(), g2 = a.createGain(), g3 = a.createGain();
    g1.gain.value = 0.6; g2.gain.value = 0.25; g3.gain.value = 0;
    o1.connect(g1).connect(lp); o2.connect(g2).connect(lp); o3.connect(g3).connect(out);
    for (const o of [o1, o2, o3]) o.start();
    // grincement : du bruit filtré très aigu
    const n = ch.noise();
    n.loop = true;
    const bp = a.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 3400; bp.Q.value = 9;
    const gs = a.createGain();
    gs.gain.value = 0;
    n.connect(bp).connect(gs).connect(ch.input);
    n.start();
    eng = { out, lp, o1, o2, o3, g1, g2, g3, gs };
  }
  // (vapeur : pas de moteur qui gronde, les bouffées font le bruit ; voir playChuff)
  if (kind === 'steam') level *= 0.15;
  const elec = kind === 'elec' || kind === 'none';
  const f = 34 + speed * 1.6 + effort * 18;
  eng.o1.frequency.setTargetAtTime(f, t, 0.15);
  eng.o2.frequency.setTargetAtTime(f * 0.5, t, 0.15);
  eng.o3.frequency.setTargetAtTime(elec ? 260 + speed * 22 : 0, t, 0.2);
  eng.lp.frequency.setTargetAtTime(elec ? 260 : 260 + effort * 500 + speed * 8, t, 0.2);
  eng.g1.gain.setTargetAtTime(elec ? 0.12 : 0.6, t, 0.3);
  eng.g3.gain.setTargetAtTime(elec ? 0.18 : 0, t, 0.3);
  eng.out.gain.setTargetAtTime(Math.max(0, level) * 0.28, t, 0.25);
  eng.gs.gain.setTargetAtTime(Math.max(0, squeal) * 0.12, t, 0.08);
}
// Coup de canon (wagon blindé) : un choc grave et un claquement, selon la distance
export function playCannon(dist = 0) {
  const ch = channel('effects');
  if (!ch || dist > 200) return;
  const a = ch.ctx, t = a.currentTime + dist / 340;
  const vol = Math.max(0, 1 - dist / 200) ** 1.3;
  if (vol < 0.01) return;
  noiseHit(ch, ch.input, t, { f: 180, q: 0.7, peak: 0.9 * vol, att: 0.004, dec: 0.7, type: 'lowpass', sweep: 0.4 });
  noiseHit(ch, ch.input, t, { f: 1600, q: 0.6, peak: 0.45 * vol, att: 0.002, dec: 0.18 });
  tone(ch, ch.input, t, { f: 70, to: 38, type: 'sine', peak: 0.7 * vol, att: 0.005, dec: 0.5 });
}
// Locomotive à vapeur : un « tchou » (souffle de vapeur filtré, court), selon la distance
export function playChuff(dist = 0, effort = 0) {
  const ch = channel('effects');
  if (!ch || dist > 70) return;
  const a = ch.ctx, t = a.currentTime;
  const vol = Math.max(0, 1 - dist / 70) ** 1.4 * (0.35 + effort * 0.45);
  if (vol < 0.01) return;
  const n = ch.noise();
  const bp = a.createBiquadFilter();
  bp.type = 'bandpass'; bp.frequency.value = 520 + Math.random() * 160 + effort * 300; bp.Q.value = 0.9;
  const g = a.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol * 0.5, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.22 + effort * 0.12);
  n.connect(bp).connect(g).connect(ch.input);
  n.start(t, Math.random());
  n.stop(t + 0.4);
}
// carillon d'annonce en gare (trois notes, comme dans les gares)
export function playChime(dist = 0) {
  const s = ready(0.28, dist);
  if (!s) return;
  [[659, 0], [523, 0.32], [784, 0.64]].forEach(([f, dt]) => {
    tone(s.ch, s.out, s.t + dt, { f, type: 'sine', peak: 0.8, att: 0.01, dec: 0.9 });
    tone(s.ch, s.out, s.t + dt, { f: f * 2, type: 'sine', peak: 0.15, att: 0.01, dec: 0.5 });
  });
}
// avertisseur (composant de la locomotive) : deux tons aigus de klaxon moderne
export function playHorn2(pitch = 1) {
  const s = ready(0.3);
  if (!s) return;
  for (const [f, dt] of [[440, 0], [554, 0], [440, 0.45], [554, 0.45]]) tone(s.ch, s.out, s.t + dt, { f: f * pitch, type: 'sawtooth', peak: 0.35, att: 0.02, dec: 0.38 });
}
