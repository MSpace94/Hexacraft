// La vie des étoiles de la Voie lactée (galaxie.js) : leur masse, leur âge, ce qu'elles deviendront ;
// et les supernovas, rares, qui arrivent d'elles-mêmes, que le joueur soit là ou non.
//
// L'échelle du temps est « presque réelle » : une étoile vit des millions ou des milliards d'années,
// on ne la voit donc pas vieillir. Le ciel montre l'univers tel qu'il est maintenant. Seules les
// étoiles massives (plus de 8 fois le Soleil) arrivées au bout (les géantes bleues, les
// supergéantes rouges) peuvent exploser pendant une partie, et c'est exceptionnel : en moyenne une
// fois tous les MEAN jours, quelque part parmi les 20 000 étoiles, le plus souvent à des milliers
// d'années-lumière.
// Tout se déduit de la graine du monde et du jour : rien à sauvegarder, la même chose chez tous les
// joueurs, et ce qui a explosé pendant qu'on n'était pas là a bel et bien explosé (son reste est là).
//
// Une supernova, jour après jour (des jours du calendrier du jeu) :
//  - les jours d'avant : l'étoile est instable, elle a des sursauts d'éclat (une étoile qui rejette
//    ses couches avant de mourir) ;
//  - jour 0 : son cœur de fer s'effondre en une étoile à neutrons ; l'onde de choc traverse l'étoile ;
//  - en un jour et demi, l'éclat monte jusqu'à un milliard de soleils (bleu-blanc, très chaud) ;
//  - puis le plateau, plus de trois semaines, en jaunissant ; puis la chute, et la longue traîne du
//    cobalt radioactif qui se désintègre (l'éclat divisé par 2,7 tous les 111 jours) ;
//  - les débris filent à 10 000 km/s (près de 6 UA par jour) : une coquille de gaz qui s'étend, le
//    reste de la supernova, autour du pulsar qui est né (voir nebulae.js). Elle traverse le système
//    en quelques jours ou semaines : l'onde de choc.
import { GAL_STARS, GX, GY_, GZ, GTYPE, GSEED, GNAME, GFAMOUS, TYPES, NEBULAE, SOL } from './galaxie.js?v=1.1.0-mx09tneh';
import { STAR_TYPES, RS } from './customsys.js?v=1.1.0-mx09tneh';
import { BODY, onBodiesAdded } from './system.js?v=1.1.0-mx09tneh';

export const MEAN = 100;          // jours : en moyenne, entre deux supernovas
const PRE = 8;                    // jours d'instabilité avant l'explosion
export const PEAK = 1e9;          // éclat au plus fort (en soleils)
export const SHOCK_AU = 5.8;      // UA par jour : la vitesse des débris (10 000 km/s)
const LY_AU = 63241;
const TAIL = 1500;                // jours : au-delà, l'éclat de la supernova ne compte plus
// La lumière met une année à faire une année-lumière : une vraie année, soit 17 532 jours de jeu (de
// 30 minutes). Ce qu'on voit d'une étoile est donc son passé : la date d'une supernova du calendrier
// (t0) est celle où sa lumière arrive sur Hexa ; elle a explosé bien avant (te), et chacun la voit
// quand sa lumière lui parvient, selon sa distance (voir update). Le saut va plus vite que la
// lumière : sauter vers une étoile, c'est remonter son histoire.
export const LIGHT_DAYS = 31557600 / 1800;

function mulberry(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const hashStr = (s) => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

// ---------- La masse, l'âge ----------
// (masses en masses solaires ; chaque étoile a la sienne, tirée de sa graine)
const MASS = {
  'naine-rouge': [0.1, 0.5], 'naine-orange': [0.6, 0.85], 'naine-jaune': [0.85, 1.15], 'blanche': [1.4, 2.6],
  'naine-blanche': [0.5, 1.1], 'geante-rouge': [1, 3], 'geante-bleue': [9, 28], 'neutrons': [1.2, 2], 'pulsar': [1.2, 2],
  'magnetar': [1.3, 2.1], 'trou-noir': [5, 20], 'protoetoile': [0.3, 1.5], 'protoetoile-massive': [2, 8],
};
const SUPERGIANTS = new Set(['Bételgeuse', 'Antarès']);
const LIFE = new Map();
// { mass, age (années), stage : texte, fate : texte, sn : peut exploser pendant la partie }
export function lifeOf(i) {
  if (LIFE.has(i)) return LIFE.get(i);
  const type = TYPES[GTYPE[i]], r = mulberry(GSEED[i] ^ 0x51e11a), [m0, m1] = MASS[type] || [1, 1];
  let mass = m0 + (m1 - m0) * r() ** 1.6;
  const u = r(), v = r();
  // (une géante rouge sur huit est une supergéante : massive, au bout de sa vie)
  const superg = type === 'geante-rouge' && (SUPERGIANTS.has(GNAME[i]) || (!GFAMOUS[i] && u < 0.12));
  if (superg) mass = GNAME[i] === 'Bételgeuse' ? 18 : GNAME[i] === 'Antarès' ? 12 : 9 + v * 14;
  const tMS = 1e10 * mass ** -2.5; // (sa vie sur la séquence principale)
  let age, stage, fate, sn = false;
  switch (type) {
    case 'naine-rouge':
      age = 1e9 + v * 1.1e10;
      stage = 'Elle brûle lentement l\'hydrogène de son cœur.';
      fate = 'Elle brillera encore des milliers de milliards d\'années, bien plus que l\'âge de l\'univers.';
      break;
    case 'naine-orange': case 'naine-jaune': case 'blanche': {
      age = Math.min(1.3e10, tMS) * (0.05 + 0.85 * v);
      stage = `Sur la séquence principale : elle brûle l'hydrogène de son cœur (${Math.round((age / tMS) * 100)} % de cette vie).`;
      fate = `Dans ${dur(tMS - age)}, elle gonflera en géante rouge, puis finira en naine blanche.`;
      break;
    }
    case 'geante-rouge':
      if (superg) {
        age = tMS * 1.1;
        stage = 'Supergéante rouge : son cœur fusionne déjà des éléments de plus en plus lourds, jusqu\'au fer.';
        fate = 'Elle finira en supernova, puis en étoile à neutrons. Peut-être dans 100 000 ans, peut-être demain.';
        sn = true;
      } else {
        age = tMS * (1.02 + 0.08 * v);
        stage = 'Géante rouge : l\'hydrogène de son cœur est épuisé, elle a gonflé et brûle l\'hélium.';
        fate = `Dans ${dur(tMS * 0.1 * (0.2 + v))}, elle rejettera ses couches (une nébuleuse planétaire) et finira en naine blanche.`;
      }
      break;
    case 'geante-bleue':
      age = tMS * (0.5 + 0.5 * v);
      stage = `Géante bleue : énorme et brûlante, elle vit vite (${dur(tMS)} en tout).`;
      fate = v > 0.6 ? 'Elle arrive au bout : elle finira en supernova, puis en étoile à neutrons.' : `Dans ${dur(tMS - age)}, elle explosera en supernova.`;
      sn = v > 0.6;
      break;
    case 'naine-blanche':
      age = 1e8 + v * 9e9;
      stage = `Le cœur nu d'une étoile morte, qui refroidit depuis ${dur(age)}.`;
      fate = 'Elle refroidira pendant des milliards d\'années, jusqu\'à s\'éteindre.';
      break;
    case 'neutrons': case 'pulsar': case 'magnetar':
      age = 1e4 + v * 1e7;
      stage = `Le cœur effondré d'une étoile massive, explosée il y a ${dur(age)} : ${mass.toFixed(1).replace('.', ',')} soleils dans 20 km.`;
      fate = 'Elle tournera de plus en plus lentement.';
      break;
    case 'trou-noir':
      age = 1e6 + v * 5e9;
      stage = 'Ce qui reste d\'une étoile de plus de 25 soleils : son cœur s\'est effondré, rien n\'en ressort.';
      fate = 'Il ne changera presque plus.';
      break;
    default:
      age = 1e5 + v * 1e6;
      stage = 'Une étoile qui naît, encore entourée de gaz et de poussière.';
      fate = 'Dans quelques millions d\'années, elle sera sur la séquence principale.';
  }
  const L = { mass, age, stage, fate, sn };
  LIFE.set(i, L);
  return L;
}
// (une durée en années : « 3,2 milliards d'années »)
export function dur(y) {
  const f = (x) => x.toLocaleString('fr-FR', { maximumFractionDigits: x < 10 ? 1 : 0 });
  if (y >= 1e9) return f(y / 1e9) + ' milliard' + (y >= 2e9 ? 's' : '') + ' d\'années';
  if (y >= 1e6) return f(y / 1e6) + ' million' + (y >= 2e6 ? 's' : '') + ' d\'années';
  if (y >= 1e3) return f(Math.round(y / 1e3) * 1e3) + ' ans';
  return Math.max(1, Math.round(y)) + ' ans';
}

// ---------- Celles qui peuvent exploser ----------
// (loin des mondes d'origine et des systèmes faits à la main : à plus de 150 al d'Hexa et du Soleil)
let CAND = null;
function candidates() {
  if (CAND) return CAND;
  CAND = [];
  for (let i = 0; i < GAL_STARS; i++) {
    const t = TYPES[GTYPE[i]];
    if (t !== 'geante-bleue' && t !== 'geante-rouge') continue;
    if (!lifeOf(i).sn) continue;
    if (Math.hypot(GX[i], GY_[i], GZ[i]) < 150 || Math.hypot(GX[i] - SOL.x, GY_[i] - SOL.y, GZ[i] - SOL.z) < 150) continue;
    CAND.push(i);
  }
  return CAND;
}

// ---------- Le calendrier des supernovas d'un monde ----------
let SEED = null, EVENTS = [], RNG = null, TNEXT = 0, USED = new Set();
const BY = new Map();     // numéro d'étoile -> son explosion
function schedule(seed, upTo) {
  if (seed !== SEED) { SEED = seed; EVENTS = []; BY.clear(); USED = new Set(); RNG = mulberry(hashStr('supernova:' + seed)); TNEXT = 3 + -Math.log(1 - RNG()) * MEAN; }
  const C = candidates();
  while (TNEXT <= upTo && USED.size < C.length) {
    let i;
    do i = C[Math.floor(RNG() * C.length)]; while (USED.has(i));
    USED.add(i);
    const e = { i, t0: TNEXT, name: GNAME[i], x: GX[i], y: GY_[i], z: GZ[i], neb: null, dt: -Infinity };
    e.te = TNEXT - Math.hypot(e.x, e.y, e.z) * LIGHT_DAYS; // (la vraie date de l'explosion)
    EVENTS.push(e);
    BY.set(i, e);
    TNEXT += 2 + -Math.log(1 - RNG()) * MEAN;
  }
}

// L'éclat de la supernova (en soleils), dt jours après l'effondrement (avant : 0)
export function snLum(dt) {
  if (dt < 0) return 0;
  if (dt < 1.5) return PEAK * Math.max(0.002, (dt / 1.5) ** 2);
  if (dt < 25) return PEAK * (1 - 0.35 * (dt - 1.5) / 23.5);
  if (dt < 32) return PEAK * 0.65 * 10 ** (-1.2 * (dt - 25) / 7);
  return PEAK * 0.65 * 10 ** -1.2 * Math.exp(-(dt - 32) / 111);
}
// sa couleur : bleu-blanc au début (très chaude), puis jaune, puis rouge (la raie Hα de la traîne)
const C0 = [0.75, 0.85, 1], C1 = [1, 0.93, 0.75], C2 = [1, 0.55, 0.45];
export function snColor(dt, out = [1, 1, 1]) {
  const a = Math.min(1, Math.max(0, dt / 25)), b = Math.min(1, Math.max(0, (dt - 25) / 60));
  for (let k = 0; k < 3; k++) out[k] = (C0[k] + (C1[k] - C0[k]) * a) * (1 - b) + C2[k] * b;
  return out;
}
// les sursauts d'avant (un multiple de l'éclat de l'étoile, dt < 0)
export function preBurst(dt, i) {
  if (dt >= 0 || dt < -PRE) return 1;
  const k = 1 + dt / PRE; // (de 0 à 1 : de plus en plus forts)
  const w = Math.sin(dt * 9.1 + i) * Math.sin(dt * 3.7 + i * 0.3);
  return 1 + k * k * 25 * Math.max(0, w);
}
// le rayon du reste (al), dt jours après
export const shellLy = (dt) => Math.min(40, (Math.max(0, dt) * SHOCK_AU) / LY_AU);

// ---------- L'état du ciel, pour un monde, un jour et un endroit ----------
// at : l'observateur (al) : chaque explosion y est vue avec le retard de sa distance (dt : jours
// depuis que sa lumière est arrivée ici ; tout près de l'étoile, c'est son vrai âge)
// active : les supernovas à voir ou en préparation ([{ e, dt, L (soleils), pre }]) ;
// done : numéro d'étoile -> son explosion, pour celles qui ont déjà explosé ; version : change quand
// une étoile explose (le ciel recolore ses points)
export const state = { active: [], done: new Map(), version: 0, day: 0, seed: null, at: { x: 0, y: 0, z: 0 } };
const REMNANT = 'pulsar';
const CHANGE = [];
export function onStarChanged(fn) { CHANGE.push(fn); }
export function update(seed, day, at = null) {
  seed = String(seed);
  if (seed !== state.seed) {
    // (un autre monde : on oublie celui d'avant, ses étoiles redeviennent ce qu'elles étaient)
    for (const e of state.done.values()) restore(e.i);
    state.done.clear();
    for (let k = NEBULAE.length - 1; k >= 0; k--) if (NEBULAE[k].sn) NEBULAE.splice(k, 1);
    state.seed = seed;
    state.version++;
  }
  state.day = day;
  if (at) { state.at.x = at.x; state.at.y = at.y; state.at.z = at.z; }
  const A = state.at;
  // (loin d'Hexa, on peut voir des explosions dont la lumière n'arrivera sur Hexa que bien plus tard)
  schedule(seed, day + PRE + 1 + Math.hypot(A.x, A.y, A.z) * LIGHT_DAYS);
  state.active.length = 0;
  for (const e of EVENTS) {
    const dt = (e.dt = day - e.te - Math.hypot(e.x - A.x, e.y - A.y, e.z - A.z) * LIGHT_DAYS);
    if (dt >= 0 && !state.done.has(e.i)) { state.done.set(e.i, e); state.version++; explode(e); }
    if (dt < 0 && state.done.has(e.i)) { state.done.delete(e.i); restore(e.i); removeNeb(e); state.version++; } // (le temps recule : un jour réglé à la main)
    if (dt >= -PRE && dt < TAIL) state.active.push({ e, dt, L: dt < 0 ? 0 : snLum(dt), pre: dt < 0 });
    if (e.neb) e.neb.R = Math.max(1e-6, shellLy(dt));
  }
  return state;
}
// le type d'une étoile du catalogue maintenant (après sa supernova : un pulsar)
export const typeNow = (i) => (state.done.has(i) ? TYPES.indexOf(REMNANT) : GTYPE[i]);
export const exploded = (i) => state.done.get(i) || null;
export const eventOf = (i) => BY.get(i) || null;

// l'étoile devient un pulsar (si son système est déjà fabriqué ; sinon : à sa fabrication), et son
// reste, une nébuleuse qui grandit
function explode(e) {
  swap(e.i);
  if (!e.neb) {
    e.neb = { id: 'sn' + e.i, sn: true, name: 'Reste de la supernova de ' + e.name, type: 'reste', x: e.x, y: e.y, z: e.z, R: 1e-6,
      seed: (GSEED[e.i] ^ 0x5e) >>> 0, flat: [1, 0.92, 0.86], q: [0, 0, 0, 1], bright: 1.3, star: e.i, protos: [] };
  }
  if (!NEBULAE.includes(e.neb)) NEBULAE.push(e.neb);
}
function removeNeb(e) { const k = NEBULAE.indexOf(e.neb); if (k >= 0) NEBULAE.splice(k, 1); }
const FIELDS = ['R', 'color', 'corona', 'temp', 'lum', 'pulsar', 'beams', 'dim', 'gravity', 'desc'];
function swap(i) {
  const b = BODY['gx' + i];
  if (!b || b.snOrig) return;
  b.snOrig = {};
  for (const f of FIELDS) b.snOrig[f] = b[f];
  const T = STAR_TYPES[REMNANT];
  Object.assign(b, { R: T.taille * RS, color: T.couleur, corona: T.couronne, temp: T.temperature, lum: T.eclat, pulsar: true, beams: true, dim: T.lumiereAuSol,
    gravity: 80, desc: `Le pulsar né de la supernova de ${b.name} : son cœur effondré, qui tourne sur lui-même.` });
  for (const f of CHANGE) f(b);
}
function restore(i) {
  const b = BODY['gx' + i];
  if (!b?.snOrig) return;
  Object.assign(b, b.snOrig);
  delete b.snOrig;
  for (const f of CHANGE) f(b);
}
// (un système fabriqué après son explosion : son étoile est déjà un pulsar)
onBodiesAdded((list) => { for (const b of list) if (b.gal !== undefined && b.kind === 'star' && b.id === 'gx' + b.gal && state.done.has(b.gal)) swap(b.gal); });

// ---------- Ce qu'on en reçoit ----------
// L'éclat d'une supernova vu d'ici (en « soleils d'Hexa vus d'Hexa » : 1, c'est le plein jour)
// at : l'observateur, en al
export function fluxAt(a, at) {
  const d = Math.max(1e-9, Math.hypot(a.e.x - at.x, a.e.y - at.y, a.e.z - at.z)) * LY_AU;
  return a.L / (d * d);
}
// Le texte du panneau de visée pour une étoile du catalogue
export function lifeText(i) {
  const e = state.done.get(i);
  if (e) {
    const dt = e.dt;
    return `Sa lumière montre qu'elle a explosé en supernova il y a ${dt < 1 ? 'moins d\'un jour' : dur2(dt)} : il en reste un pulsar, et une coquille de gaz qui s'étend (${shellText(dt)}).`
      + ` ${lagText(e)}`;
  }
  const L = lifeOf(i), E = BY.get(i), pre = E && E.dt >= -PRE;
  return `${L.mass.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} fois la masse du Soleil, ${dur(L.age)}. ${L.stage} `
    + (pre ? '<span style="color:#ff9060">Elle est instable : des sursauts d\'éclat, son cœur va s\'effondrer d\'un jour à l\'autre.</span>' : L.fate);
}

// (des jours de jeu, lisibles : jours, puis années de jeu de 120 jours)
function dur2(d) {
  if (d < 240) return Math.floor(d) + ' jour' + (d >= 2 ? 's' : '');
  const y = d / 120;
  return y < 1e4 ? Math.round(y).toLocaleString('fr-FR') + ' ans' : dur(y);
}
function shellText(dt) {
  const ly = shellLy(dt);
  return ly < 0.1 ? Math.round(ly * LY_AU).toLocaleString('fr-FR') + ' UA' : ly.toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' années-lumière';
}
// le retard de sa lumière, vu d'ici
export function lagText(e) {
  const A = state.at, d = Math.hypot(e.x - A.x, e.y - A.y, e.z - A.z);
  if (d < 0.05) return '';
  return `(Sa lumière a mis ${d < 2 ? Math.round(d * 365) + ' jours' : Math.round(d).toLocaleString('fr-FR') + ' ans'} à arriver jusqu'ici : ce qu'on voit d'elle est son passé.)`;
}
