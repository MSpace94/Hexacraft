// La musique du jeu, jouée note par note (aucun fichier audio) : des instruments synthétiques
// (nappes, piano doux, célesta, basse, cordes, percussions) qui jouent des morceaux écrits ici
// sous forme de grilles d'accords et de règles (mélodies tirées au hasard dans la gamme, mais
// toujours de la même façon pour un même morceau : une graine par morceau).
//  - au menu : un thème calme, en boucle ;
//  - dans les cinématiques : l'espace, le danger (alarmes, écrasement), l'espoir (le départ) ;
//  - en jeu : de temps en temps un morceau de jour, de nuit ou de grotte, puis du silence
//    (comme dans Minecraft : la musique vient et repart, elle ne tourne pas en continu) ;
//  - des petites fanfares : succès, niveau gagné, mort.
// Le volume passe par le réglage « Musique » des options (voir sound.js, type 'music').
import { channel } from './sound.js?v=1.1.5-alpha-mvm2b95g';

const LOOK = 0.25;   // on écrit les notes jusqu'à LOOK secondes en avance
const midi = (n) => 440 * 2 ** ((n - 69) / 12);

// Générateur pseudo-aléatoire à graine (mulberry32) : un morceau rejoue toujours pareil
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- La console : réverbération, compresseur doux ----------
let mix = null;
function console_() {
  const ch = channel('music');
  if (!ch) return null;
  if (mix && mix.ctx === ch.ctx) return mix;
  const a = ch.ctx;
  const glue = a.createDynamicsCompressor();
  glue.threshold.value = -18; glue.ratio.value = 3; glue.attack.value = 0.02; glue.release.value = 0.3;
  glue.connect(ch.input);
  // réverbération : une grande salle (réponse faite de bruit qui s'éteint, un peu différente
  // à gauche et à droite)
  const rev = a.createConvolver();
  const len = Math.floor(a.sampleRate * 3.6), ir = a.createBuffer(2, len, a.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = ir.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2.6;
  }
  rev.buffer = ir;
  const wet = a.createGain();
  wet.gain.value = 0.5;
  rev.connect(wet).connect(glue);
  mix = { ctx: a, glue, rev, noise: ch.noise };
  return mix;
}

// Une piste : son volume (pour les fondus), branchée sur la console (directe + réverbération)
function track(m, send = 0.35) {
  const g = m.ctx.createGain();
  g.connect(m.glue);
  const s = m.ctx.createGain();
  s.gain.value = send;
  g.connect(s).connect(m.rev);
  return g;
}

// ---------- Les instruments ----------
// (chacun : (m, out, f, t, dur, vel) ; f en Hz, t et dur en secondes, vel de 0 à 1)
function env(a, g, t, att, peak, dur, rel) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + att);
  g.gain.setValueAtTime(Math.max(0.0002, peak), t + Math.max(att, dur));
  g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(att, dur) + rel);
}
function osc(a, type, f, t, end, detune = 0) {
  const o = a.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  o.detune.value = detune;
  o.start(t);
  o.stop(end);
  return o;
}
const INSTR = {
  // nappe : deux triangles légèrement désaccordés et une sinusoïde à l'octave, filtre doux
  pad(m, out, f, t, dur, vel) {
    const a = m.ctx, end = t + dur + 2.6;
    const g = a.createGain(), lp = a.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 900 + 500 * vel; lp.Q.value = 0.4;
    lp.connect(g).connect(out);
    env(a, g, t, Math.min(1.6, dur * 0.4), 0.05 * vel, dur, 2.4);
    for (const [ty, k, dt] of [['triangle', 1, -7], ['triangle', 1, 7], ['sine', 2, 0]]) osc(a, ty, f * k, t, end, dt).connect(lp);
  },
  // piano doux : fondamentale + harmoniques qui s'éteignent plus vite (le marteau)
  keys(m, out, f, t, dur, vel) {
    const a = m.ctx, end = t + 3.2;
    const g = a.createGain();
    g.connect(out);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.11 * vel, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.03 * vel, t + 0.5);
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.min(3, 0.8 + dur * 1.5));
    osc(a, 'sine', f, t, end).connect(g);
    const h = a.createGain();
    h.gain.setValueAtTime(0.35, t);
    h.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    h.connect(g);
    osc(a, 'sine', f * 2, t, end).connect(h);
    osc(a, 'triangle', f * 3, t, t + 0.4).connect(h);
  },
  // célesta : petites cloches claires
  bell(m, out, f, t, dur, vel) {
    const a = m.ctx, end = t + 2.5;
    const g = a.createGain();
    g.connect(out);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.06 * vel, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);
    osc(a, 'sine', f * 2, t, end).connect(g);
    const h = a.createGain();
    h.gain.value = 0.3;
    h.connect(g);
    osc(a, 'sine', f * 5.4, t, t + 0.6).connect(h);
  },
  // corde pincée (arpèges) : triangle, filtre qui se ferme
  pluck(m, out, f, t, dur, vel) {
    const a = m.ctx, end = t + 1.2;
    const g = a.createGain(), lp = a.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(3200, t);
    lp.frequency.exponentialRampToValueAtTime(500, t + 0.5);
    lp.connect(g).connect(out);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.06 * vel, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    osc(a, 'triangle', f, t, end).connect(lp);
    osc(a, 'sawtooth', f, t, end, 4).connect(lp);
  },
  // basse ronde
  bass(m, out, f, t, dur, vel) {
    const a = m.ctx, end = t + dur + 0.5;
    const g = a.createGain(), lp = a.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 420;
    lp.connect(g).connect(out);
    env(a, g, t, 0.02, 0.16 * vel, dur * 0.8, 0.3);
    osc(a, 'sine', f, t, end).connect(lp);
    osc(a, 'triangle', f, t, end).connect(lp);
  },
  // cordes : scies filtrées, attaque lente, un peu de vibrato
  strings(m, out, f, t, dur, vel) {
    const a = m.ctx, end = t + dur + 1.5;
    const g = a.createGain(), lp = a.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 1500; lp.Q.value = 0.6;
    lp.connect(g).connect(out);
    env(a, g, t, Math.min(0.6, dur * 0.3), 0.035 * vel, dur, 1.2);
    const vib = a.createOscillator(), vg = a.createGain();
    vib.frequency.value = 5.2; vg.gain.value = 6;
    vib.connect(vg);
    vib.start(t); vib.stop(end);
    for (const dt of [-9, 0, 9]) { const o = osc(a, 'sawtooth', f, t, end, dt); vg.connect(o.detune); o.connect(lp); }
  },
  // mélodie (danger) : carrée filtrée, nette
  lead(m, out, f, t, dur, vel) {
    const a = m.ctx, end = t + dur + 0.4;
    const g = a.createGain(), lp = a.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 2200;
    lp.connect(g).connect(out);
    env(a, g, t, 0.01, 0.04 * vel, dur * 0.9, 0.25);
    osc(a, 'square', f, t, end).connect(lp);
    osc(a, 'sawtooth', f * 1.003, t, end).connect(lp);
  },
  kick(m, out, f, t, dur, vel) {
    const a = m.ctx;
    const g = a.createGain();
    g.connect(out);
    g.gain.setValueAtTime(0.5 * vel, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    const o = osc(a, 'sine', 140, t, t + 0.4);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    o.connect(g);
  },
  snare(m, out, f, t, dur, vel) {
    const a = m.ctx;
    const g = a.createGain(), bp = a.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = 0.7;
    bp.connect(g).connect(out);
    g.gain.setValueAtTime(0.22 * vel, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    const n = m.noise();
    n.connect(bp);
    n.start(t, Math.random() * 1.5);
    n.stop(t + 0.25);
  },
  hat(m, out, f, t, dur, vel) {
    const a = m.ctx;
    const g = a.createGain(), hp = a.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 7000;
    hp.connect(g).connect(out);
    g.gain.setValueAtTime(0.06 * vel, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    const n = m.noise();
    n.connect(hp);
    n.start(t, Math.random() * 1.5);
    n.stop(t + 0.06);
  },
  // grand coup sourd (timbale) : danger, fin d'un morceau
  boom(m, out, f, t, dur, vel) {
    const a = m.ctx;
    const g = a.createGain();
    g.connect(out);
    g.gain.setValueAtTime(0.45 * vel, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
    const o = osc(a, 'sine', 70, t, t + 1.7);
    o.frequency.exponentialRampToValueAtTime(36, t + 0.8);
    o.connect(g);
  },
};

// ---------- Les morceaux ----------
// Gammes (demi-tons depuis la tonique)
const SCALE = {
  major: [0, 2, 4, 5, 7, 9, 11], lydian: [0, 2, 4, 6, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10], phrygian: [0, 1, 3, 5, 7, 8, 10],
};
// note de la gamme : degré (0 = tonique, peut dépasser 7 ou être négatif), octave de base
const deg = (S, root, d) => root + S[((d % 7) + 7) % 7] + 12 * Math.floor(d / 7);
// accord sur le degré d : tierces empilées (n notes)
const chord = (S, root, d, n = 4) => Array.from({ length: n }, (_, i) => deg(S, root, d + 2 * i));

// Chaque morceau : tempo, gamme, tonique (midi), grille (un degré par mesure), nombre de mesures
// (0 : en boucle), et ce que joue chaque instrument à chaque double-croche (step, de 0 à 15 dans
// la mesure). play(n, f, dur, vel) joue une note sur un instrument de la piste.
const SONGS = {
  // Menu : rêveur, lydien, nappes et piano, une mélodie qui revient
  menu: {
    bpm: 76, scale: 'lydian', root: 50, prog: [0, 5, 3, 4, 0, 5, 1, 4], bars: 0, seed: 7, send: 0.45,
    step(c) {
      const { bar, s, ch, S, R, r } = c;
      if (s === 0) { for (const n of ch) c.play('pad', n + 12, c.bar1 * 0.98, 0.7); c.play('bass', ch[0] - 12, c.bar1 * 0.9, 0.6); }
      if (s % 2 === 0 && bar >= 2) c.play('pluck', ch[(s / 2) % 4] + 24, c.beat * 0.5, 0.35 + 0.15 * (s % 8 === 0));
      if (bar >= 4 && (s === 0 || s === 6 || s === 10) && r() < 0.75) c.play('keys', deg(S, R + 24, c.walk(3)), c.beat * 1.5, 0.7);
      if (bar % 8 === 7 && s === 12) c.play('bell', ch[2] + 24, c.beat, 0.6);
    },
  },
  // L'espace (début de la cinématique) : immense et calme
  space: {
    bpm: 64, scale: 'minor', root: 52, prog: [0, 0, 5, 5, 3, 3, 4, 4], bars: 0, seed: 11, send: 0.7,
    step(c) {
      const { s, ch, r } = c;
      if (s === 0 && c.bar % 2 === 0) { for (const n of ch.slice(0, 3)) c.play('pad', n + 12, c.bar1 * 1.95, 0.8); c.play('bass', ch[0] - 12, c.bar1 * 1.9, 0.5); }
      if (s % 3 === 0 && r() < 0.45) c.play('bell', ch[Math.floor(r() * 4)] + 24, c.beat, 0.5 + r() * 0.4);
    },
  },
  // Danger (alarmes, entrée dans l'atmosphère, écrasement) : rapide, tendu
  danger: {
    bpm: 138, scale: 'phrygian', root: 45, prog: [0, 0, 5, 6, 0, 0, 5, 4], bars: 0, seed: 3, send: 0.25,
    step(c) {
      const { s, ch, S, R, bar } = c;
      if (s % 2 === 0) c.play('bass', ch[0] - 12 + (s % 8 === 6 ? 12 : 0), c.beat * 0.45, 0.9);
      if (s % 4 === 0) c.play('kick', 0, 0, 1);
      if (s === 4 || s === 12) c.play('snare', 0, 0, 0.8);
      if (s % 2 === 1) c.play('hat', 0, 0, 0.6);
      if (s === 0) for (const n of ch.slice(0, 3)) c.play('strings', n + 12, c.bar1 * 0.95, 0.8);
      if (bar >= 2 && (s === 0 || s === 3 || s === 6 || s === 10 || s === 12)) c.play('lead', deg(S, R + 24, c.walk(2)), c.beat * 0.7, 0.6);
      if (bar % 4 === 3 && s === 14) c.play('boom', 0, 0, 1);
    },
  },
  // L'espoir (départ de la navette, réveil après l'écrasement) : qui monte, lumineux
  hope: {
    bpm: 92, scale: 'major', root: 55, prog: [0, 4, 5, 3, 0, 4, 3, 4, 5, 3, 0, 4], bars: 12, seed: 5, send: 0.4,
    step(c) {
      const { s, ch, S, R, bar } = c;
      if (s === 0) { for (const n of ch) c.play('strings', n + 12, c.bar1 * 0.97, 0.5 + bar * 0.04); c.play('bass', ch[0] - 12, c.bar1 * 0.9, 0.7); }
      if (bar >= 2 && s % 2 === 0) c.play('pluck', ch[(s / 2) % 4] + 24, c.beat * 0.5, 0.4);
      if (bar >= 4 && (s === 0 || s === 4 || s === 8 || s === 14)) c.play('keys', deg(S, R + 24, c.walk(2)), c.beat, 0.8);
      if (bar >= 6 && s % 8 === 0) c.play('kick', 0, 0, 0.5);
      if (bar >= 6 && s % 8 === 4) c.play('snare', 0, 0, 0.35);
      if (bar === 11 && s === 0) c.play('boom', 0, 0, 0.6);
    },
  },
  // Jour : piano tranquille sur des nappes (environ 2 minutes)
  day: {
    bpm: 70, scale: 'major', root: 48, prog: [0, 3, 5, 4, 0, 3, 1, 4, 5, 3, 0, 4, 3, 4, 0, 0], bars: 32, seed: 21, send: 0.45,
    step(c) {
      const { s, ch, S, R, bar, r } = c;
      if (s === 0) { for (const n of ch.slice(0, 3)) c.play('pad', n + 12, c.bar1 * 0.98, 0.5); c.play('bass', ch[0] - 12, c.bar1 * 0.8, 0.45); }
      if (s === 0 || s === 8) c.play('keys', ch[0] + 12, c.beat * 2, 0.45);
      if ((s === 4 || s === 12) && r() < 0.8) c.play('keys', ch[1 + Math.floor(r() * 3)] + 12, c.beat, 0.35);
      if (bar >= 2 && bar < 30 && (s % 4 === 2 || s === 0) && r() < 0.55) c.play('keys', deg(S, R + 24, c.walk(2)), c.beat * 1.2, 0.75);
    },
  },
  // Nuit : lent, mineur, des notes isolées (environ 1 min 40)
  night: {
    bpm: 58, scale: 'dorian', root: 45, prog: [0, 0, 3, 3, 5, 5, 4, 4, 0, 6, 3, 4], bars: 24, seed: 33, send: 0.6,
    step(c) {
      const { s, ch, S, R, r } = c;
      if (s === 0) { for (const n of ch.slice(0, 3)) c.play('pad', n + 12, c.bar1, 0.6); c.play('bass', ch[0] - 12, c.bar1 * 0.9, 0.4); }
      if (s % 4 === 0 && r() < 0.45) c.play('keys', deg(S, R + 24, c.walk(2)), c.beat * 2, 0.6);
      if (s === 10 && r() < 0.3) c.play('bell', ch[3] + 12, c.beat, 0.4);
    },
  },
  // Grotte : bourdon grave, notes étranges (environ 1 min 30)
  cave: {
    bpm: 52, scale: 'phrygian', root: 40, prog: [0, 0, 1, 0, 6, 0, 1, 1], bars: 20, seed: 44, send: 0.8,
    step(c) {
      const { s, ch, S, R, r } = c;
      if (s === 0 && c.bar % 2 === 0) { c.play('pad', ch[0], c.bar1 * 2, 0.9); c.play('pad', ch[0] + 7, c.bar1 * 2, 0.5); }
      if (s % 4 === 2 && r() < 0.3) c.play('bell', deg(S, R + 12, Math.floor(r() * 8)), c.beat, 0.35);
      if (s === 8 && r() < 0.25) c.play('keys', deg(S, R, Math.floor(r() * 5)), c.beat * 3, 0.5);
    },
  },
};

// ---------- Le lecteur ----------
class Song {
  constructor(m, name) {
    const d = SONGS[name];
    this.m = m; this.name = name; this.d = d;
    this.S = SCALE[d.scale];
    this.out = track(m, d.send);
    this.beat = 60 / d.bpm; this.bar1 = this.beat * 4; this.sixteenth = this.beat / 4;
    this.t0 = m.ctx.currentTime + 0.1;
    this.n = 0;              // prochaine double-croche à écrire
    this.r = rng(d.seed);
    this.mel = 0;            // (mélodie : degré courant, marche au hasard)
    this.ended = false;
  }
  // degré suivant de la mélodie : petits pas, revient vers le centre
  walk(spread) {
    const r = this.r();
    this.mel += r < 0.5 ? (r < 0.25 ? -1 : 1) : Math.round((this.r() * 2 - 1) * spread);
    if (this.mel > 6) this.mel -= 2;
    if (this.mel < -2) this.mel += 2;
    return this.mel;
  }
  // écrit les notes jusqu'à `until` (temps du contexte audio)
  pump(until) {
    const d = this.d;
    while (!this.ended) {
      const t = this.t0 + this.n * this.sixteenth;
      if (t > until) break;
      const bar = Math.floor(this.n / 16), s = this.n % 16;
      if (d.bars && bar >= d.bars) { this.ended = true; this.endAt = t + 3; break; }
      const deg0 = d.prog[bar % d.prog.length];
      const c = {
        bar, s, S: this.S, R: d.root, r: this.r, beat: this.beat, bar1: this.bar1,
        ch: chord(this.S, d.root, deg0),
        walk: (k) => this.walk(k),
        play: (ins, n, dur, vel) => INSTR[ins](this.m, this.out, midi(n), t, dur, vel),
      };
      d.step(c);
      this.n++;
    }
  }
  fade(to, secs) {
    const g = this.out.gain, now = this.m.ctx.currentTime;
    g.cancelScheduledValues(now);
    g.setValueAtTime(Math.max(0.0001, g.value), now);
    g.exponentialRampToValueAtTime(Math.max(0.0001, to), now + secs);
  }
  stop(secs = 2) {
    this.ended = true;
    this.fade(0.0001, secs);
    const out = this.out;
    setTimeout(() => out.disconnect(), (secs + 4) * 1000);
  }
}

let song = null, timer = 0;
function tick() {
  if (!song) return;
  const a = song.m.ctx;
  song.pump(a.currentTime + LOOK);
  if (song.ended && song.endAt && a.currentTime > song.endAt) { song.out.disconnect?.(); song = null; }
}

// Joue un morceau (fondu depuis celui en cours). Rien si c'est déjà lui
export function playMusic(name, fadeIn = 1.5) {
  if (song?.name === name && !song.ended) return;
  const m = console_();
  if (!m) { pendingName = name; return; }
  song?.stop(2.5);
  song = new Song(m, name);
  song.out.gain.value = 0.0001;
  song.fade(1, fadeIn);
  timer ||= setInterval(tick, 80);
  tick();
}
let pendingName = null; // (demandé avant que le son ne soit permis : joué au premier clic)
for (const ev of ['pointerdown', 'keydown']) addEventListener(ev, () => { if (pendingName) { const n = pendingName; pendingName = null; playMusic(n); } }, { once: false });

export function stopMusic(fade = 2.5) {
  pendingName = null;
  song?.stop(fade);
}
export const musicPlaying = () => (song && !song.ended ? song.name : null);

// ---------- Petites fanfares ----------
// (jouées par-dessus la musique, sur leur propre piste)
const STINGS = {
  // succès : arpège majeur qui monte, puis l'accord en cloches
  achievement: [['bell', 72, 0], ['bell', 76, 0.09], ['bell', 79, 0.18], ['bell', 84, 0.27], ['keys', 72, 0.27, 1.2], ['keys', 76, 0.27, 1.2], ['keys', 79, 0.27, 1.2]],
  // niveau gagné : petite fanfare de cuivres (cordes + pincé), deux temps
  levelup: [['pluck', 67, 0], ['pluck', 72, 0.12], ['pluck', 76, 0.24], ['strings', 79, 0.36, 0.9], ['strings', 84, 0.36, 0.9], ['strings', 76, 0.36, 0.9], ['bell', 91, 0.36], ['boom', 0, 0.36]],
  // mort : trois notes qui descendent, mineur
  death: [['strings', 64, 0, 0.7], ['strings', 60, 0.6, 0.7], ['strings', 57, 1.2, 1.6], ['pad', 45, 1.2, 2.5], ['boom', 0, 1.2]],
  // réveil (après l'écrasement) : une seule montée douce
  wake: [['pad', 55, 0, 3], ['pad', 62, 0, 3], ['bell', 79, 0.4], ['bell', 83, 0.9], ['bell', 86, 1.4]],
};
export function playSting(name) {
  const m = console_();
  if (!m || !STINGS[name]) return;
  const out = track(m, 0.4), t0 = m.ctx.currentTime + 0.03;
  out.gain.value = 1.3;
  for (const [ins, n, dt, dur = 0.5] of STINGS[name]) INSTR[ins](m, out, midi(n), t0 + dt, dur, 0.9);
  // (la musique en cours se fait discrète pendant la fanfare)
  if (song && !song.ended) { song.fade(0.35, 0.3); setTimeout(() => song && !song.ended && song.fade(1, 1.5), 2500); }
  setTimeout(() => out.disconnect(), 8000);
}

// ---------- En jeu : la musique vient de temps en temps ----------
// À appeler régulièrement (une fois par seconde) : where = { menu, cutscene, night, cave }
let quietUntil = 0, wasMenu = null;
export function musicDirector(where, now = performance.now() / 1000) {
  if (where.cutscene) { wasMenu = false; return; }
  if (where.menu) {
    if (wasMenu !== true) { wasMenu = true; playMusic('menu', 3); }
    return;
  }
  if (wasMenu !== false) {
    // on entre dans un monde : le thème du menu s'éteint, la première musique viendra bientôt
    wasMenu = false;
    if (musicPlaying() === 'menu') stopMusic(4);
    quietUntil = now + 25 + Math.random() * 35;
    return;
  }
  const cur = musicPlaying();
  if (cur && cur !== 'day' && cur !== 'night' && cur !== 'cave') return; // (une cinématique qui finit)
  if (cur) {
    // le moment a changé (on descend dans une grotte, la nuit tombe) : on laisse finir doucement
    const want = where.cave ? 'cave' : where.night ? 'night' : 'day';
    if (want !== cur && where.cave !== (cur === 'cave')) { stopMusic(6); quietUntil = now + 20; }
    return;
  }
  if (now < quietUntil) return;
  playMusic(where.cave ? 'cave' : where.night ? 'night' : 'day', 4);
  // après ce morceau : 2 à 5 minutes de silence
  const len = { day: 110, night: 100, cave: 92 }[musicPlaying()] || 100;
  quietUntil = now + len + 120 + Math.random() * 180;
}
