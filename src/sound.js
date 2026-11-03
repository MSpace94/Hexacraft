// Sons fabriqués par le jeu (aucun fichier audio) : mèche de la TNT et explosion.
// Comme dans la réalité, un son lointain est :
//  - plus faible (le volume baisse avec la distance, jusqu'au silence),
//  - plus sourd (l'air étouffe d'abord les aigus : de loin on n'entend qu'un grondement),
//  - en retard (le son parcourt ~340 blocs par seconde).
let ctx = null;
let noise = null;
let master = null;
// Volumes réglés dans les options (0..1) : général, et par type de son. Chaque type a sa
// propre entrée (bus), puis son limiteur, puis son volume, puis le volume général.
// (Les volumes sont APRÈS les limiteurs : avant, baisser le volume d'un son fort ne faisait
// que relâcher le limiteur, et le son ne baissait presque pas tout de suite.)
//   effects : TNT (mèche, explosions) ; weather : pluie, tonnerre, tornades ;
//   ambiance : oiseaux, grillons, feu des torches ; music : la musique (voir music.js)
const volumes = { master: 1, effects: 1, weather: 1, ambiance: 1, music: 1 };
let bus = null, vol = null, masterGain = null;

// Règle le volume d'un type de son (ou 'master') : v de 0 à 1
export function setVolume(kind, v) {
  if (!(kind in volumes)) return;
  volumes[kind] = Math.max(0, Math.min(1, v));
  const node = kind === 'master' ? masterGain : vol?.[kind];
  if (!node) return;
  node.gain.cancelScheduledValues(ctx.currentTime);
  node.gain.setTargetAtTime(volumes[kind], ctx.currentTime, 0.015);
}

function audio() {
  if (!ctx) {
    try { ctx = new AudioContext(); } catch { return null; }
    // 2 s de bruit blanc réutilisées par tous les sons
    noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // limiteur par type : plusieurs explosions en même temps ne saturent jamais
    const limiter = (threshold, knee, ratio) => {
      const c = ctx.createDynamicsCompressor();
      c.threshold.value = threshold;
      c.knee.value = knee;
      c.ratio.value = ratio;
      c.attack.value = 0.003;
      c.release.value = 0.25;
      return c;
    };
    // dernier filet de sécurité (n'agit que tout près de la saturation)
    master = limiter(-3, 3, 20);
    master.connect(ctx.destination);
    masterGain = ctx.createGain();
    masterGain.gain.value = volumes.master;
    masterGain.connect(master);
    bus = {};
    vol = {};
    for (const kind of ['effects', 'weather', 'ambiance', 'music']) {
      bus[kind] = ctx.createGain();
      const lim = limiter(-14, 12, 8);
      vol[kind] = ctx.createGain();
      vol[kind].gain.value = volumes[kind];
      bus[kind].connect(lim);
      lim.connect(vol[kind]);
      vol[kind].connect(masterGain);
    }
  }
  if (ctx.state === 'suspended' && !document.hidden) ctx.resume().catch(() => {});
  return ctx;
}
// le navigateur n'autorise le son qu'après un clic ou une touche
for (const ev of ['pointerdown', 'keydown']) addEventListener(ev, () => audio(), { once: true });
// fenêtre réduite ou cachée : plus aucun son (le jeu ne met plus à jour les ambiances)
document.addEventListener('visibilitychange', () => {
  if (!ctx) return;
  if (document.hidden) ctx.suspend().catch(() => {});
  else ctx.resume().catch(() => {});
});

// Volume selon la distance : 1 tout près, 1/2 à `half` blocs, silence à `range` blocs
function volumeAt(dist, half, range) {
  const d = Math.max(0, dist);
  return (1 / (1 + (d / half) ** 1.4)) * Math.max(0, 1 - d / range);
}

// Sortie d'un son joué à `dist` blocs : volume + étouffement des aigus par la distance.
// kind : type de son (son réglage de volume). Renvoie { input (où brancher le son), air
// (filtre), level (volume) }.
function output(a, dist, vol, kind = 'effects') {
  const air = a.createBiquadFilter();
  air.type = 'lowpass';
  air.frequency.value = 300 + 9000 * Math.exp(-dist / 30);
  air.Q.value = 0.5;
  const g = a.createGain();
  g.gain.value = vol;
  g.connect(bus[kind]);
  air.connect(g);
  return { input: air, air, level: g };
}

// Pour les autres modules de sons (sfx.js, music.js) : le contexte, l'entrée d'un type de son,
// le bruit blanc partagé, la sortie selon la distance. null tant que le son n'est pas permis
export function channel(kind = 'effects') {
  const a = audio();
  return a ? { ctx: a, input: bus[kind], noise: () => noiseSource(a), output: (dist, v) => output(a, dist, v, kind) } : null;
}

function noiseSource(a, loop = false) {
  const src = a.createBufferSource();
  src.buffer = noise;
  src.loop = loop;
  // départ au hasard dans le bruit : deux sons ne sont jamais identiques
  src.loopStart = 0;
  src.loopEnd = noise.duration;
  return src;
}

// Mèche qui grésille doucement pendant `duration` secondes. Renvoie une commande :
// setDistance(d) à appeler à chaque image (la TNT bouge, le joueur aussi), stop().
const fuseVolume = (d) => volumeAt(d, 5, 28) * 0.12;
export function playFuse(dist, duration = 4) {
  const a = audio();
  if (!a) return null;
  const t = a.currentTime;
  const out = output(a, dist, fuseVolume(dist));
  const { level, air } = out;
  const src = noiseSource(a, true);
  const hp = a.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 2500;
  const band = a.createBiquadFilter();
  band.type = 'peaking';
  band.frequency.value = 4200;
  band.gain.value = 5;
  // petits crépitements : le volume ondule vite et irrégulièrement
  const g = a.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.7, t + 0.08);
  for (let x = t + 0.1; x < t + duration - 0.15; x += 0.05 + Math.random() * 0.07) {
    g.gain.linearRampToValueAtTime(0.45 + Math.random() * 0.55, x);
  }
  g.gain.linearRampToValueAtTime(0, t + duration);
  src.connect(hp).connect(band).connect(g).connect(air);
  src.start(t, Math.random() * 1.5);
  src.stop(t + duration + 0.05);
  return {
    setDistance(d) {
      const now = a.currentTime;
      level.gain.setTargetAtTime(fuseVolume(d), now, 0.05);
      air.frequency.setTargetAtTime(300 + 9000 * Math.exp(-d / 30), now, 0.05);
    },
    stop() { try { src.stop(); } catch { /* déjà arrêtée */ } },
    get volume() { return level.gain.value; },
  };
}

// Explosion : coup sourd grave, souffle, craquement (seulement de près) et longue traîne
// big : Big TNT (plus grave, bien plus long, entendu de beaucoup plus loin)
export function playExplosion(dist, big = false) {
  const a = audio();
  const vol = big ? volumeAt(dist, 45, 600) : volumeAt(dist, 12, 160) * 0.9;
  if (!a || vol <= 0.002) return;
  const t = a.currentTime + dist / 340;
  const out = output(a, dist, vol);
  const near = Math.max(0, 1 - dist / (big ? 60 : 25));
  const L = big ? 2.6 : 1; // durée

  // coup grave : sinus qui descend (75 -> 32 Hz, ou 50 -> 18 Hz pour la Big TNT)
  const osc = a.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(big ? 50 : 75, t);
  osc.frequency.exponentialRampToValueAtTime(big ? 18 : 32, t + 0.9 * L);
  const og = a.createGain();
  og.gain.setValueAtTime(0.0001, t);
  og.gain.exponentialRampToValueAtTime(0.9, t + 0.012);
  og.gain.exponentialRampToValueAtTime(0.0001, t + 1.3 * L);
  osc.connect(og).connect(out.input);
  osc.start(t);
  osc.stop(t + 1.4 * L);

  // bruit filtré : attaque rapide, puis s'éteint en `decay` s ; le filtre se referme
  const layer = (type, f0, f1, v, attack, decay) => {
    if (v <= 0.001) return;
    const src = noiseSource(a, true);
    const f = a.createBiquadFilter();
    f.type = type;
    f.Q.value = 0.7;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(f1, t + decay);
    const g = a.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    src.connect(f).connect(g).connect(out.input);
    src.start(t, Math.random() * 0.4);
    src.stop(t + decay + 0.05);
  };
  layer('lowpass', big ? 380 : 520, 70, 0.8, 0.01, 1.6 * L);    // souffle
  layer('bandpass', 1400, 500, 0.25 * near, 0.004, 0.18);        // craquement (de près seulement)
  layer('lowpass', big ? 120 : 160, 45, big ? 0.6 : 0.35, 0.25, 3.2 * L); // grondement qui traîne
  if (big) layer('lowpass', 90, 35, 0.4, 1.2, 9);                // roulement du champignon qui monte
}

// Outil qui casse : un petit craquement sec, tout près
export function playToolBreak() {
  const a = audio();
  if (!a) return;
  const t = a.currentTime, out = output(a, 0, 0.5, 'effects');
  const src = noiseSource(a);
  const f = a.createBiquadFilter();
  f.type = 'bandpass'; f.Q.value = 1.2;
  f.frequency.setValueAtTime(2600, t);
  f.frequency.exponentialRampToValueAtTime(700, t + 0.18);
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(1, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
  src.connect(f).connect(g).connect(out.input);
  src.start(t, Math.random());
  src.stop(t + 0.25);
}

// Tonnerre : craquement sec si l'éclair est tout près, puis long grondement qui roule
// (le son arrive après l'éclair : ~340 blocs par seconde)
export function playThunder(dist) {
  const a = audio();
  const vol = volumeAt(dist, 60, 900) * 0.9;
  if (!a || vol <= 0.002) return;
  const t = a.currentTime + dist / 340;
  const out = output(a, dist * 0.5, vol, 'weather');
  const near = Math.max(0, 1 - dist / 70);
  const layer = (type, f0, f1, v, attack, decay, start = 0) => {
    if (v <= 0.001) return;
    const src = noiseSource(a, true);
    const f = a.createBiquadFilter();
    f.type = type;
    f.Q.value = 0.6;
    f.frequency.setValueAtTime(f0, t + start);
    f.frequency.exponentialRampToValueAtTime(f1, t + start + decay);
    const g = a.createGain();
    g.gain.setValueAtTime(0.0001, t + start);
    g.gain.exponentialRampToValueAtTime(v, t + start + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + start + decay);
    src.connect(f).connect(g).connect(out.input);
    src.start(t + start, Math.random() * 1.5);
    src.stop(t + start + decay + 0.05);
  };
  layer('highpass', 2500, 900, 0.5 * near, 0.003, 0.35);       // craquement
  layer('lowpass', 420, 60, 0.7, 0.05, 2.2);                    // coup
  layer('lowpass', 160, 40, 0.55, 0.6, 5.5, 0.3);              // grondement qui roule
  layer('lowpass', 110, 35, 0.35, 1.2, 4, 1.4);                // second roulement
}

// Grondement de tornade : un souffle grave (bruit filtré) dont la hauteur ondule, plus un
// sifflement de vent. setLevel(0..1) à chaque image.
export function tornadoSound() {
  const a = audio();
  if (!a) return null;
  const g = a.createGain();
  g.gain.value = 0;
  g.connect(bus.weather);
  const roar = noiseSource(a, true), lp = a.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 260;
  lp.Q.value = 1.2;
  // la hauteur du grondement ondule lentement (rafales)
  const lfo = a.createOscillator(), depth = a.createGain();
  lfo.frequency.value = 0.23;
  depth.gain.value = 120;
  lfo.connect(depth).connect(lp.frequency);
  roar.connect(lp).connect(g);
  const hiss = noiseSource(a, true), bp = a.createBiquadFilter(), hg = a.createGain();
  bp.type = 'bandpass';
  bp.frequency.value = 900;
  bp.Q.value = 0.8;
  hg.gain.value = 0.25;
  hiss.connect(bp).connect(hg).connect(g);
  roar.start(0, Math.random() * 1.5);
  hiss.start(0, Math.random() * 1.5);
  lfo.start();
  return {
    setLevel(v) { g.gain.setTargetAtTime(Math.max(0, Math.min(1, v)) * 0.9, a.currentTime, 0.5); },
  };
}

// Son enregistré joué en boucle (fichier de sons/), volume réglé à chaque image :
// setLevel(0..1). Le fichier est chargé au premier besoin ; le volume suit en douceur.
// kind : type de son ('ambiance' ou 'weather', pour son réglage de volume)
export function loopSample(url, gain = 1, kind = 'ambiance') {
  const a = audio();
  if (!a) return null;
  const g = a.createGain();
  g.gain.value = 0;
  g.connect(bus[kind] || bus.ambiance);
  let src = null, level = 0;
  fetch(url).then((r) => r.arrayBuffer()).then((data) => a.decodeAudioData(data)).then((buf) => {
    src = a.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.connect(g);
    src.start(0, Math.random() * buf.duration); // (départ au hasard dans l'enregistrement)
  }).catch(() => {});
  return {
    // now : tout de suite (sinon le volume glisse en douceur)
    setLevel(v, now = false) {
      v = Math.max(0, Math.min(1, v));
      if (Math.abs(v - level) < 0.002 && !now) return;
      level = v;
      g.gain.cancelScheduledValues(a.currentTime);
      if (now) g.gain.setValueAtTime(v * gain, a.currentTime);
      else g.gain.setTargetAtTime(v * gain, a.currentTime, 0.6);
    },
  };
}

// Voix des villageois : les enregistrements de sons/villageois/<clé>.m4a (une phrase par
// fichier, voir villagetalk.js). À la lecture, on coupe le silence du début et de la fin et
// on met tous les fichiers au même volume. Un enfant : le même fichier, plus aigu.
const voices = new Map(); // clé -> { buf, start, end, gain } (null : fichier absent)
export function loadVillagerVoices(keys) {
  const a = audio();
  if (!a) return;
  for (const k of keys) {
    if (voices.has(k)) continue;
    voices.set(k, null);
    fetch(`sons/villageois/${k}.m4a`).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject()))
      .then((data) => a.decodeAudioData(data)).then((buf) => voices.set(k, trimmed(buf))).catch(() => {});
  }
}
function trimmed(buf) {
  const d = buf.getChannelData(0);
  let peak = 0;
  for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i]));
  const loud = peak * 0.04;
  let i0 = 0, i1 = d.length - 1;
  while (i0 < i1 && Math.abs(d[i0]) < loud) i0++;
  while (i1 > i0 && Math.abs(d[i1]) < loud) i1--;
  const pad = buf.sampleRate * 0.03;
  return { buf, start: Math.max(0, i0 - pad) / buf.sampleRate, end: Math.min(d.length, i1 + pad * 2) / buf.sampleRate, gain: peak ? Math.min(8, 0.8 / peak) : 1 }; // (fichier très faible : on monte, sans trop amplifier le souffle)
}

// Un villageois dit la phrase `key` (texte : sa transcription) à `dist` blocs
export function playVillagerVoice(key, text, dist, child = false) {
  const a = audio();
  const v = volumeAt(dist, 6, 32);
  if (!a || v < 0.005) return;
  const s = voices.get(key);
  if (!s) { synthVoice(a, text, dist, v * 0.35, child); return; }
  const out = output(a, dist, v * 0.9 * s.gain, 'effects');
  const src = a.createBufferSource();
  src.buffer = s.buf;
  // chaque villageois a sa voix : un peu plus grave ou aiguë (beaucoup plus pour un enfant)
  src.playbackRate.value = (child ? 1.35 : 1) * (0.94 + Math.random() * 0.12);
  src.connect(out.input);
  src.start(a.currentTime + 0.01, s.start, s.end - s.start);
}

// Voix synthétisée (si un fichier manque) : une syllabe par groupe de voyelles du texte, plus
// aiguë pour un enfant, qui monte à la fin d'une question et s'anime sur une exclamation
function synthVoice(a, text, dist, v, child) {
  const syl = text.toLowerCase().match(/[^aeiouyé]*[aeiouyé]+/g) || ['mm'];
  const ask = text.includes('?'), shout = text.includes('!');
  const out = output(a, dist, v, 'effects');
  const base = (child ? 290 : 150) * (0.92 + Math.random() * 0.16);
  let t = a.currentTime + 0.02;
  syl.slice(0, 6).forEach((s, i) => {
    const last = i === Math.min(syl.length, 6) - 1;
    const len = s.includes('mmm') ? 0.32 : 0.13 + Math.random() * 0.05;
    const f0 = base * (shout ? 1.18 : 1) * (1 + (Math.random() - 0.5) * 0.15);
    const osc = a.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.linearRampToValueAtTime(f0 * (last && ask ? 1.35 : last ? 0.85 : 1), t + len);
    // deux formants : donnent la couleur de la voyelle (a, o, i...)
    const vowel = { a: [800, 1200], o: [500, 900], u: [350, 800], i: [300, 2300], e: [450, 1900], y: [300, 2100], 'é': [400, 2000] }[s.replace(/[^aeiouyé]/g, '')[0]] || [600, 1100];
    const g = a.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(1, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    for (const f of vowel) {
      const bp = a.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = 6;
      osc.connect(bp).connect(g);
    }
    g.connect(out.input);
    osc.start(t);
    osc.stop(t + len + 0.02);
    t += len + 0.04;
  });
}

// Bip d'alarme (cockpit de la cinématique) : deux notes brèves
export function playAlarm() {
  const a = audio();
  if (!a) return;
  const out = output(a, 0, 0.16);
  [0, 0.16].forEach((d, i) => {
    const t = a.currentTime + d;
    const o = a.createOscillator();
    o.type = 'square';
    o.frequency.setValueAtTime(i ? 660 : 880, t);
    const g = a.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(1, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
    o.connect(g).connect(out.input);
    o.start(t);
    o.stop(t + 0.15);
  });
}

// Battement de cœur (le réveil après l'écrasement) : deux coups sourds
export function playHeartbeat(vol = 0.5) {
  const a = audio();
  if (!a) return;
  const out = output(a, 0, vol);
  [0, 0.28].forEach((d, i) => {
    const t = a.currentTime + d;
    const o = a.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(i ? 52 : 62, t);
    o.frequency.exponentialRampToValueAtTime(30, t + 0.18);
    const g = a.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(i ? 0.6 : 1, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    o.connect(g).connect(out.input);
    o.start(t);
    o.stop(t + 0.3);
  });
}

// Bruits de pas : les enregistrements de sons/pas/<sorte><n>.ogg (deux par sorte, joués au
// hasard, un peu plus graves ou aigus à chaque pas pour ne jamais sonner pareil).
// kind : 'herbe', 'terre', 'bois' ou 'metal' (voir STEP_OF dans main.js) ; vol : 0..1
const STEP_FILES = { herbe: 2, terre: 2, bois: 2, metal: 2 };
const steps = new Map(); // sorte -> [AudioBuffer]
let stepsLoading = false;
function loadSteps(a) {
  if (stepsLoading) return;
  stepsLoading = true;
  for (const [kind, n] of Object.entries(STEP_FILES)) {
    steps.set(kind, []);
    for (let i = 1; i <= n; i++) {
      fetch(`sons/pas/${kind}${i}.ogg`).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject()))
        .then((data) => a.decodeAudioData(data)).then((buf) => steps.get(kind).push(buf)).catch(() => {});
    }
  }
}
export function playStep(kind, vol = 1) {
  const a = audio();
  if (!a) return;
  loadSteps(a);
  const list = steps.get(kind);
  if (!list?.length) return;
  const out = output(a, 0, 0.45 * vol, 'effects');
  const src = a.createBufferSource();
  src.buffer = list[Math.floor(Math.random() * list.length)];
  src.playbackRate.value = 0.92 + Math.random() * 0.16;
  src.connect(out.input);
  src.start();
}

// ORA parle (tutoriel) : un petit bip de radio ; done : l'étape est réussie (deux notes montantes)
export function playBlip(done = false) {
  const a = audio();
  if (!a) return;
  const out = output(a, 0, done ? 0.12 : 0.07);
  (done ? [[0, 660], [0.09, 990]] : [[0, 1320]]).forEach(([d, f]) => {
    const t = a.currentTime + d;
    const o = a.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(f, t);
    const g = a.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(1, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (done ? 0.18 : 0.07));
    o.connect(g).connect(out.input);
    o.start(t);
    o.stop(t + 0.2);
  });
}

// Une porte de la station s'ouvre : un souffle pneumatique
export function playDoor() {
  const a = audio();
  if (!a) return;
  const out = output(a, 0, 0.35);
  const t = a.currentTime;
  const src = noiseSource(a);
  const bp = a.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = 0.8;
  bp.frequency.setValueAtTime(2400, t);
  bp.frequency.exponentialRampToValueAtTime(400, t + 0.7);
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(1, t + 0.04);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
  src.connect(bp).connect(g).connect(out.input);
  src.start(t);
  src.stop(t + 0.85);
}
