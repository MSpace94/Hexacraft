// Les tunnels de la 7ème dimension (voir le moteur de 7ème dimension, spaceflight.toggleBreach).
//
// La Seed du monde décide de tout : où sont les tunnels, où ils mènent. Ils existent dans une couche
// de l'univers au-dessus de l'espace normal : on ne les voit pas, on ne les touche pas. Le moteur de
// 7ème dimension ne les crée pas : il déchire un moment la séparation, assez près d'une entrée, et la
// fusée passe dans le tunnel. Dedans, elle file à 25 années-lumière par seconde au plus, sur la vraie
// distance entre les deux bouts ; elle ressort à l'autre bout.
//
//  - un réseau dans chaque galaxie : des tunnels de 150 à 30 000 années-lumière, d'une étoile à une
//    autre (l'entrée flotte à moins d'une année-lumière de son étoile : on la trouve en sautant
//    jusqu'à l'étoile) ; l'un d'eux part d'une des étoiles les plus proches d'Hexa ;
//  - quelques grands tunnels intergalactiques, rares, du bord de la Voie lactée au bord d'Andromède.
// Les mêmes chez tous les joueurs d'un monde ; d'un monde à l'autre, tout change.
import { GAL_STARS, GX, GY_, GZ, GNAME, AND0, AND_N, CENTER, AND_CENTER, near, XGALS, galaxyName } from './galaxie.js?v=1.1.0-mx09tneh';

export const TUN_V = 25;          // (années-lumière par seconde, au plus, dans un tunnel)
export const TUN_RAMP = 10;       // (secondes pour y prendre toute sa vitesse)
export const OPEN_R = 1.5;        // (années-lumière : plus loin d'une entrée, la brèche ne trouve rien)
export const SENSE_R = 600;       // (années-lumière : le moteur sent une entrée jusque-là)
const N_GAL = 900, N_AND = 900, N_INTER = 4;

function hashStr(s) { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function mulberry(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const dist = (i, j) => Math.hypot(GX[i] - GX[j], GY_[i] - GY_[j], GZ[i] - GZ[j]);

// Le réseau d'une Seed : { list: [tunnel], mouths: [bouche] }
// tunnel : { id, a, b (bouches), L (al), inter } ; bouche : { t (tunnel), i (étoile), x, y, z (al), end (0 ou 1) }
let SEED = null, NET = null;
export function network(seed) {
  if (NET && SEED === String(seed)) return NET;
  SEED = String(seed);
  const r = mulberry(hashStr('tunnels-7d:' + SEED)), list = [], mouths = [];
  const mouth = (t, i, end) => {
    // (l'entrée flotte autour de l'étoile, entre 0,2 et 1 année-lumière)
    const u = r() * 2 - 1, a = r() * Math.PI * 2, k = Math.sqrt(1 - u * u), d = 0.2 + r() * 0.8;
    const m = { t, i, end, x: GX[i] + k * Math.cos(a) * d, y: GY_[i] + u * d * 0.5, z: GZ[i] + k * Math.sin(a) * d };
    mouths.push(m);
    return m;
  };
  const add = (i, j, inter = false) => {
    if (i === j || i < 0 || j < 0) return;
    if (!inter && dist(i, j) > 300000) return; // (un petit tunnel ne relie jamais deux galaxies : le voisinage d'Hexa est dans Andromède)
    const t = { id: list.length, L: dist(i, j), inter };
    t.a = mouth(t, i, 0); t.b = mouth(t, j, 1);
    list.push(t);
  };
  // (une étoile au hasard d'une plage, puis, parmi 40 autres, celle dont la distance est la plus
  // proche de celle voulue : des tunnels de toutes longueurs, plus de courts que de longs)
  const pick = (lo, n) => lo + Math.floor(r() * n);
  const linkFrom = (i, lo, n) => {
    const want = 150 * (200 ** r());
    let best = -1, bd = Infinity;
    for (let k = 0; k < 40; k++) { const j = pick(lo, n), e = Math.abs(Math.log(dist(i, j) / want)); if (j !== i && e < bd) { bd = e; best = j; } }
    return best;
  };
  // celui d'Hexa : une des 5 étoiles les plus proches, vers une étoile lointaine d'Andromède (sa galaxie)
  let home = [];
  for (let R = 150; home.length < 5 && R < 3000; R *= 1.5) home = near(0, 0, 0, R, []).filter((i) => i < GAL_STARS);
  home = home.sort((a, b) => Math.hypot(GX[a], GY_[a], GZ[a]) - Math.hypot(GX[b], GY_[b], GZ[b])).slice(0, 5);
  if (home.length) {
    const i = home[Math.floor(r() * home.length)];
    let best = -1, bd = Infinity;
    for (let k = 0; k < 60; k++) { const j = pick(AND0, AND_N), e = Math.abs(dist(i, j) - 9000); if (e < bd) { bd = e; best = j; } }
    add(i, best);
  }
  for (let k = list.length; k < N_GAL; k++) { const i = pick(0, GAL_STARS); add(i, linkFrom(i, 0, GAL_STARS)); }
  for (let k = 0; k < N_AND; k++) { const i = pick(AND0, AND_N); add(i, linkFrom(i, AND0, AND_N)); }
  // les grands tunnels : du bord de la Voie lactée (à plus de 35 000 al de son centre) au bord d'Andromède
  const edge = (lo, n, C, R) => { for (let k = 0; k < 400; k++) { const i = pick(lo, n); if (Math.hypot(GX[i] - C.x, GY_[i] - C.y, GZ[i] - C.z) > R) return i; } return pick(lo, n); };
  for (let k = 0; k < N_INTER; k++) add(edge(0, GAL_STARS, CENTER, 35000), edge(AND0, AND_N, AND_CENTER, 45000), true);
  // les galaxies ajoutées (src/galaxies) : leurs propres tunnels, et quelques grands vers la Voie lactée
  for (const G of XGALS) {
    if (G.n < 2) continue;
    for (let k = 0, m = Math.min(900, Math.ceil(G.n / 25)); k < m; k++) { const i = pick(G.i0, G.n); add(i, linkFrom(i, G.i0, G.n)); }
    const R = (+G.def.rayon || 50000) * 0.7;
    for (let k = 0; k < N_INTER; k++) add(edge(0, GAL_STARS, CENTER, 35000), edge(G.i0, G.n, G.center, R), true);
  }
  return (NET = { list, mouths });
}

// L'entrée la plus proche d'un point (al), à moins de r : { m, d } ou null
export function nearestMouth(seed, x, y, z, r = SENSE_R) {
  let best = null, bd = r;
  for (const m of network(seed).mouths) {
    const dx = m.x - x;
    if (dx > bd || dx < -bd) continue;
    const d = Math.hypot(dx, m.y - y, m.z - z);
    if (d < bd) { bd = d; best = m; }
  }
  return best ? { m: best, d: bd } : null;
}
// L'autre bout d'un tunnel
export const otherEnd = (m) => (m.end ? m.t.a : m.t.b);
// Le temps de la traversée (s) : TUN_RAMP secondes pour prendre sa vitesse, puis TUN_V al/s
export const crossTime = (L) => (L <= TUN_V * TUN_RAMP / 2 ? Math.sqrt((2 * L * TUN_RAMP) / TUN_V) : TUN_RAMP + (L - (TUN_V * TUN_RAMP) / 2) / TUN_V);
// La distance parcourue (al) après t secondes, et la vitesse (al/s)
export const crossed = (t) => (t < TUN_RAMP ? (TUN_V * t * t) / (2 * TUN_RAMP) : (TUN_V * TUN_RAMP) / 2 + TUN_V * (t - TUN_RAMP));
export const speedAt = (t) => TUN_V * Math.min(1, t / TUN_RAMP);
// (où mène une bouche : le nom de l'étoile, et la galaxie si on en change)
export function whereTo(m) {
  const o = otherEnd(m), g = galaxyName(o.i), far = g !== galaxyName(m.i);
  return GNAME[o.i] + (far ? ', dans ' + g : '');
}
// (une durée lisible)
export function fmtDur(s) {
  s = Math.max(0, Math.round(s));
  if (s < 90) return s + ' s';
  if (s < 5400) return Math.floor(s / 60) + ' min ' + String(s % 60).padStart(2, '0') + ' s';
  return Math.floor(s / 3600) + ' h ' + String(Math.floor((s % 3600) / 60)).padStart(2, '0') + ' min';
}
// (une distance en années-lumière, lisible)
export const fmtLy = (d) => (d >= 1e6 ? (d / 1e6).toLocaleString('fr-FR', { maximumFractionDigits: 2 }) + " millions d'al" : Math.round(d).toLocaleString('fr-FR') + ' al');
