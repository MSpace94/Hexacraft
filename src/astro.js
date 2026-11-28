// Le ciel qui vit : ce qui change d'un jour à l'autre, d'une année à l'autre, dans l'espace.
// Tout se déduit de la graine du monde, du jour et de l'endroit : rien à sauvegarder, la même chose
// chez tous les joueurs (comme les supernovas, voir stellar.js).
//
//  - Les comètes : un noyau de glace sur une orbite très allongée. Loin de l'étoile, invisible ; en
//    s'approchant (moins de 3 UA), la glace se sublime : une chevelure, et deux queues toujours à
//    l'opposé de l'étoile (le vent stellaire) : la queue d'ions, droite et bleue, et la queue de
//    poussière, plus large, jaunâtre, courbée vers l'arrière de sa route. Plus elle est près de
//    l'étoile, plus elle est longue et brillante. Hexa en a deux : Ardane (3 ans et demi) et la
//    grande comète Ilvéra (76 ans).
//  - Les pluies d'étoiles filantes : la poussière laissée le long de l'orbite d'une comète. Celles
//    d'Hexa croisent son orbite : chaque année, à la même date, Hexa traverse la traînée (voir
//    weather.js). Plus forte les années où la comète vient de passer.
//  - Les étoiles variables : les céphéides (des étoiles blanches qui battent : leur éclat monte vite
//    et redescend lentement, en quelques jours à quelques semaines) et les supergéantes rouges
//    irrégulières (comme Bételgeuse : elles enflent et faiblissent sur des mois, parfois un grand
//    assombrissement, un nuage de poussière qu'elles rejettent).
//  - Les novae : dans un couple serré, une naine blanche arrache le gaz de sa compagne ; il s'entasse
//    sur sa surface jusqu'à exploser (une bombe thermonucléaire de la taille d'une planète) : pendant
//    quelques semaines, elle brille des dizaines de milliers de fois plus. Elle survit, et
//    recommence des dizaines d'années plus tard (une nova récurrente).
//  - Les éruptions stellaires : un sursaut de lumière à la surface de l'étoile (bien plus fort sur
//    une naine rouge, qui en a souvent) ; un jour et demi plus tard, le nuage de particules arrive :
//    une tempête. Les aurores s'allument sur les planètes qui ont de l'air ; dans l'espace, sans abri,
//    le rayonnement fait mal.
//  - Les impacts : un astéroïde frappe une planète ou une lune du système, rarement. Un éclair, puis
//    la lueur de la roche fondue, qui refroidit en quelques jours : visible de l'espace.
//  - La simulation de la galaxie (l'observatoire) : son évolution sur des millions d'années, calculée
//    à part, sans rien changer au monde.
// Ce qu'on voit d'une étoile lointaine est son passé : les variables et les novae suivent le retard
// de leur lumière, comme les supernovas.
import { GAL_STARS, GX, GY_, GZ, GTYPE, GSEED, GNAME, TYPES, NEBULAE, CENTER, systemDef } from './galaxie.js?v=1.1.0-mx09tneh';
import { lifeOf, LIGHT_DAYS } from './stellar.js?v=1.1.0-mx09tneh';

const AU = 6.6e7;
const YEAR = 120;
const LY_AU = 63241;
const TAU = Math.PI * 2;
// (un nombre de 0 à 1, toujours le même pour les mêmes entrées)
export function hash3(a, b = 0, c = 0) {
  let h = (Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(c | 0, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
export function hashS(s) {
  let h = 2166136261;
  for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// (bruit doux, de 0 à 1)
function vn(t, s) {
  const i = Math.floor(t), f = t - i, u = f * f * (3 - 2 * f);
  return hash3(i, s) * (1 - u) + hash3(i + 1, s) * u;
}

// ---------- Les comètes ----------
// { name, a (UA), e, i, node, w (radians), P (jours), tp (un passage au plus près), sys }
// Hexa : deux comètes, dont l'orbite croise celle d'Hexa (à 1 UA) à son nœud ascendant : la date de
// leur pluie d'étoiles filantes. Les autres systèmes : une comète (deux autour des étoiles brillantes)
const HEXA_COMETS = [
  { name: 'Ardane', a: 2.3, e: 0.84, i: 0.21, node: 1.1, shower: 'les Ardanides' },
  { name: 'Ilvéra', a: 17.9, e: 0.967, i: 2.71, node: 4.3, shower: 'les Ilvérides', great: true },
];
const COMETS = new Map();
export function cometsOf(sysId, seed, lum = 1) {
  const key = sysId + '|' + seed;
  if (COMETS.has(key)) return COMETS.get(key);
  const s = hashS(seed + ':' + sysId), list = [];
  // (la lumière de l'étoile éloigne la zone où la glace se réveille : tout est compté en « UA d'Hexa »)
  const sc = Math.sqrt(Math.max(0.02, lum));
  if (sysId === 'star') {
    for (const [k, c] of HEXA_COMETS.entries()) {
      const P = YEAR * c.a ** 1.5;
      // (le nœud ascendant à 1 UA : r(ν) = 1 pour ν = -w)
      const cosv = (c.a * (1 - c.e * c.e) - 1) / c.e, v0 = Math.acos(Math.max(-1, Math.min(1, cosv)));
      list.push({ ...c, w: -v0, P, tp: hash3(s, k, 7) * P, sys: sysId, sc: 1, id: 'c' + k });
    }
  } else {
    const n = lum > 2 ? 2 : 1;
    for (let k = 0; k < n; k++) {
      const a = (2 + hash3(s, k, 1) * 14) * sc, e = 0.7 + hash3(s, k, 2) * 0.28, P = YEAR * a ** 1.5;
      list.push({ name: 'comète ' + 'ABCD'[k], a, e, i: hash3(s, k, 3) * Math.PI, node: hash3(s, k, 4) * TAU, w: hash3(s, k, 5) * TAU, P, tp: hash3(s, k, 6) * P, sys: sysId, sc, id: 'c' + k });
    }
  }
  COMETS.set(key, list);
  return list;
}
// La place d'une comète (blocs, autour de son étoile) au jour day ; r : sa distance à l'étoile (UA)
export function cometPos(c, day, out = { x: 0, y: 0, z: 0, r: 0 }) {
  const e = c.e, M = ((((TAU * (day - c.tp)) / c.P) % TAU) + TAU) % TAU;
  let E = e > 0.8 ? Math.PI : M; // (en partant de π : sûr, même pour les orbites très allongées)
  for (let n = 0; n < 14; n++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  const nu = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
  const r = c.a * (1 - e * Math.cos(E)), u = nu + c.w;
  const pu = r * Math.cos(u), pw = r * Math.sin(u), cn = Math.cos(c.node), sn = Math.sin(c.node);
  const wz = pw * Math.cos(c.i);
  out.x = (pu * cn - wz * sn) * AU;
  out.z = (pu * sn + wz * cn) * AU;
  out.y = pw * Math.sin(c.i) * AU;
  out.r = r / c.sc;
  return out;
}
// Son activité : 0 loin de l'étoile, de plus en plus près (la glace se sublime sous 3 UA)
export const cometActivity = (r) => smooth(3.2, 1.6, r) * Math.min(3, (1.2 / Math.max(0.15, r)) ** 2);

// ---------- Les pluies d'étoiles filantes d'Hexa ----------
// La force de la pluie au jour T (0 : rien ; 1 : le plus fort), et sa comète. hexaLon : la longitude
// d'Hexa sur son orbite, vue de l'étoile (radians)
export function cometShower(T, seed, hexaLon) {
  let best = 0, comet = null;
  for (const c of cometsOf('star', seed)) {
    let d = hexaLon - c.node;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    const days = (d / TAU) * YEAR;
    let s = Math.exp(-((days / 1.1) ** 2));
    if (s < 0.05) continue;
    // (plus forte quand la comète vient de passer : la poussière fraîche est encore serrée sur son orbite)
    const since = ((((T - c.tp) % c.P) + c.P) % c.P) / c.P;
    s *= 0.6 + 0.4 * Math.max(smooth(0.25, 0, since), smooth(0.9, 1, since));
    if (s > best) { best = s; comet = c; }
  }
  return { k: best, comet };
}

// ---------- Les étoiles variables (étoiles du catalogue) ----------
// null, ou { kind: 'cepheide' | 'irreguliere', P (jours), amp, s }
const VAR = new Map();
export function variableOf(i) {
  if (i === undefined || i < 0 || i >= GAL_STARS) return null;
  if (VAR.has(i)) return VAR.get(i);
  const t = TYPES[GTYPE[i]], h = hash3(GSEED[i], 0x5ca1e), h2 = hash3(GSEED[i], 0x77a1);
  let v = null;
  if (t === 'blanche' && h < 0.15) v = { kind: 'cepheide', P: 3 + 37 * h2 ** 1.5, amp: 0.35 + 0.25 * hash3(GSEED[i], 3), s: GSEED[i] };
  else if (t === 'geante-rouge' && (h < 0.6 || GNAME[i] === 'Bételgeuse' || GNAME[i] === 'Antarès')) v = { kind: 'irreguliere', P: 80 + 320 * h2, amp: 0.25 + 0.3 * hash3(GSEED[i], 4), s: GSEED[i] };
  VAR.set(i, v);
  return v;
}
let VLIST = null;
export function variables() {
  if (VLIST) return VLIST;
  VLIST = [];
  for (let i = 0; i < GAL_STARS; i++) if (variableOf(i)) VLIST.push(i);
  return VLIST;
}
// L'éclat d'une variable (1 : sa moyenne) au jour t, là où sa lumière arrive (t : déjà retardé)
export function varFactor(v, t) {
  if (!v) return 1;
  if (v.kind === 'cepheide') {
    // (dent de scie : monte en 15 % de la période, redescend lentement)
    const ph = (((t / v.P) % 1) + 1) % 1, f = ph < 0.15 ? ph / 0.15 : 1 - (ph - 0.15) / 0.85;
    return 1 + v.amp * (2 * f - 1);
  }
  // irrégulière : des pulsations lentes et inégales ; de temps en temps, un grand assombrissement
  const w = vn(t / v.P, v.s) * 0.7 + vn((t / v.P) * 3.1, v.s ^ 0x55) * 0.3;
  let f = 1 + v.amp * (2 * w - 1);
  const bin = Math.floor(t / 2400), b0 = hash3(bin, v.s, 9);
  if (b0 < 0.2) {
    const mid = (bin + 0.2 + hash3(bin, v.s, 10) * 0.6) * 2400, x = (t - mid) / 140;
    f *= 1 - 0.6 * Math.exp(-x * x);
  }
  return f;
}
export function variableText(i) {
  const v = variableOf(i);
  if (!v) return '';
  if (v.kind === 'cepheide') return `Étoile variable (céphéide) : elle bat, son éclat monte et redescend tous les ${Math.round(v.P)} jours.`;
  return 'Supergéante variable : elle enfle et faiblit sur des mois, parfois un grand assombrissement (un nuage de poussière qu\'elle rejette).';
}

// ---------- Les novae ----------
// Les couples serrés où la compagne est une naine blanche (voir galaxie.js) : cherchés peu à peu
// (une fois), sans figer le jeu. { i, P (jours), t0, L (éclat au plus fort, en soleils d'Hexa) }
let NOVA_SCAN = 0;
const NOVAE = [];
const NOVA_OF = new Map();
export function novaScan(n = 1500) {
  if (NOVA_SCAN >= GAL_STARS) return true;
  const end = Math.min(GAL_STARS, NOVA_SCAN + n);
  for (let i = NOVA_SCAN; i < end; i++) {
    const Z = systemDef(i)?.etoiles?.[1];
    if (Z?.orbite?.barycentre && Z.type === 'naine-blanche') {
      const s = GSEED[i], P = YEAR * (25 + 125 * hash3(s, 0xa0a)), N = { i, P, t0: hash3(s, 0xa0b) * P, L: 2e4 + 8e4 * hash3(s, 0xa0c), name: Z.nom || GNAME[i] + ' B' };
      NOVAE.push(N);
      NOVA_OF.set(i, N);
    }
  }
  NOVA_SCAN = end;
  return NOVA_SCAN >= GAL_STARS;
}
export const novaOf = (i) => NOVA_OF.get(i) || null;
// Son éclat (soleils d'Hexa) te jours après le début de l'explosion : une montée d'un jour, puis la
// lente décroissance (moitié en 8 jours environ)
export function novaL(N, te) {
  if (te < 0 || te > 120) return 0;
  return N.L * (te < 1 ? te * te : Math.exp(-(te - 1) / 11));
}
// Les novae visibles d'ici (at : al) au jour day : [{ N, te, L, f (flux) }]
const NACT = [];
export function novaeAt(day, at) {
  NACT.length = 0;
  for (const N of NOVAE) {
    const dx = GX[N.i] - at.x, dy = GY_[N.i] - at.y, dz = GZ[N.i] - at.z, d = Math.hypot(dx, dy, dz);
    const t = day - d * LIGHT_DAYS - N.t0, te = ((t % N.P) + N.P) % N.P;
    if (te > 120) continue;
    const L = novaL(N, te), dAU = Math.max(1e-6, d * LY_AU);
    // (k : le numéro de l'explosion)
    NACT.push({ N, te, L, f: L / (dAU * dAU), dx, dy, dz, d, k: Math.floor(t / N.P) });
  }
  return NACT;
}
export function novaText(i) {
  const N = NOVA_OF.get(i);
  return N ? `Nova récurrente : sa naine blanche arrache le gaz de sa compagne, qui s'entasse et explose tous les ${Math.round(N.P / YEAR)} ans environ.` : '';
}

// ---------- Les éruptions et les tempêtes stellaires ----------
// rate : la part des jours avec une grosse éruption (une naine rouge en a souvent, et de fortes)
const red = (b) => (b?.temp ?? 5800) < 3700 && b?.kind === 'star';
const flareRate = (b) => (b?.pulsar ? 0.08 : red(b) ? 0.35 : 0.07);
// L'éruption : un sursaut d'éclat, quelques dizaines de secondes (en jours de jeu ; 0 à 1)
export function flareAt(b, T) {
  if (!b || b.kind !== 'star') return 0;
  const s = hashS(b.id), day = Math.floor(T);
  let f = 0;
  for (let d = day - 1; d <= day; d++) {
    if (hash3(d, s, 1) >= flareRate(b)) continue;
    const t0 = d + hash3(d, s, 2), x = (T - t0) / 0.012;
    if (x > -0.3 && x < 6) f = Math.max(f, (x < 0 ? 1 + x / 0.3 : Math.exp(-x)) * (0.5 + 0.5 * hash3(d, s, 3)));
  }
  return f;
}
// Le sursaut d'éclat de l'étoile (1 : rien ; plus fort sur une naine rouge)
export const flareBoost = (b, T) => 1 + flareAt(b, T) * (red(b) ? 2.5 : 0.25);
// La tempête : le nuage de particules arrive 1,5 jour après l'éruption, et dure une demi-journée
// (0 à 1) ; s'éloigne de l'étoile (dAU : la distance, en UA d'Hexa) : moins forte
export function stormAt(b, T, dAU = 1) {
  if (!b || b.kind !== 'star') return 0;
  const s = hashS(b.id), day = Math.floor(T - 1.5);
  let k = 0;
  for (let d = day - 1; d <= day; d++) {
    if (hash3(d, s, 1) >= flareRate(b) || hash3(d, s, 3) < 0.5) continue; // (seules les plus grosses lancent un nuage)
    const t0 = d + hash3(d, s, 2) + 1.5, x = T - t0;
    if (x > 0 && x < 0.6) k = Math.max(k, smooth(0, 0.06, x) * smooth(0.6, 0.35, x) * (0.5 + 0.5 * hash3(d, s, 3)));
  }
  return k * Math.min(1.5, 1 / Math.max(0.3, dAU) ** 2) * (red(b) ? 1.3 : 1);
}

// ---------- Les impacts d'astéroïdes ----------
// Sur chaque planète ou lune : une chance sur sept tous les 60 jours. { t (jour), lat, lon, k (taille) }
const IMPACT_BIN = 60, IMPACT_P = 0.14;
export function impactNear(b, day, seed) {
  if (!b || b.kind === 'star' || b.kind === 'hole') return null;
  const s = hashS(seed + ':' + b.id + ':imp'), bin = Math.floor(day / IMPACT_BIN);
  for (let k = bin; k >= bin - 1; k--) {
    if (hash3(k, s, 1) >= IMPACT_P) continue;
    const t = (k + hash3(k, s, 2)) * IMPACT_BIN, age = day - t;
    if (age < 0 || age > 5) continue;
    return { t, age, lat: Math.asin(2 * hash3(k, s, 3) - 1), lon: hash3(k, s, 4) * TAU, k: 0.5 + 0.5 * hash3(k, s, 5), key: b.id + ':' + k };
  }
  return null;
}
// L'éclat de l'impact (0 à 1) : l'éclair, puis la roche fondue qui refroidit (rouge, en jours)
export const impactFlash = (age) => (age < 0.02 ? 1 - age / 0.02 : 0);
export const impactGlow = (age) => smooth(0, 0.01, age) * Math.exp(-age / 1.3);

// ---------- La simulation de la galaxie (l'observatoire) ----------
// Pour chaque étoile : sa place autour du centre (rayon, angle, hauteur) ; dans combien d'années elle
// finit sa vie ; ce qu'elle devient. Les étoiles tournent autour du centre (presque à la même vitesse
// partout : 230 km/s, donc celles du bord font le tour bien plus lentement) ; elles meurent quand
// leur temps est fini (une supernova pour les massives) ; de nouvelles naissent dans les nébuleuses.
const V_LY = 230 / 299792.458; // (al par an)
let SIM = null;
export function galaxySim() {
  if (SIM) return SIM;
  const n = GAL_STARS, R = new Float32Array(n), A = new Float32Array(n), END = new Float64Array(n), FATE = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const dx = GX[i] - CENTER.x, dz = GZ[i] - CENTER.z;
    R[i] = Math.max(50, Math.hypot(dx, dz)); A[i] = Math.atan2(dz, dx);
    const t = TYPES[GTYPE[i]], L = lifeOf(i), tMS = 1e10 * L.mass ** -2.5;
    let end = Infinity;
    if (t === 'naine-orange' || t === 'naine-jaune' || t === 'blanche' || t === 'geante-bleue') end = Math.max(1e4, tMS - L.age);
    else if (t === 'geante-rouge') end = L.sn ? 1e4 + hash3(GSEED[i], 0x51) * 2e5 : 2e5 + tMS * 0.05 * hash3(GSEED[i], 0x52);
    else if (t.startsWith('proto')) end = -1; // (elle finit de naître : rien ne change de loin)
    END[i] = end;
    FATE[i] = L.mass > 25 ? 3 : L.mass > 8 ? 2 : 1; // (1 : naine blanche ; 2 : étoile à neutrons ; 3 : trou noir)
  }
  // les étoiles à naître : dans les régions H II, de plus en plus au fil du temps
  const born = [];
  for (const N of NEBULAE) {
    if (N.type !== 'hii') continue;
    const k = Math.min(60, Math.round(N.R / 3));
    for (let j = 0; j < k; j++) {
      const h = hashS(N.name + j), u = hash3(h, 1), v = hash3(h, 2), w = hash3(h, 3);
      const x = N.x + (u - 0.5) * N.R * 1.4, z = N.z + (v - 0.5) * N.R * 1.4;
      born.push({ R: Math.hypot(x - CENTER.x, z - CENTER.z), A: Math.atan2(z - CENTER.z, x - CENTER.x), t: w * 2e8, hot: hash3(h, 4) < 0.15 });
    }
  }
  return (SIM = { n, R, A, END, FATE, born, V_LY });
}
