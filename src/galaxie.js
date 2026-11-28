// La Voie lactée : 20 000 systèmes stellaires de plus que ceux faits à la main, et Sagittarius A*,
// le trou noir supermassif de son centre.
//
// Le catalogue est tiré une fois pour toutes (la même graine dans tous les mondes) au chargement :
// pour chaque système, rien qu'une place, un type d'étoile et un nom (quelques Mo, des millisecondes).
// Ses astres (étoile, compagne, planètes) ne sont fabriqués qu'à la demande, quand on s'en approche,
// qu'on le vise (touche N) ou qu'un monde en parle (voir system.materialize) : le jeu reste aussi
// léger qu'avec ses quelques dizaines de systèmes. Chacun a un monde où se poser (une planète
// rocheuse, sa zone de carte : GZ_MIN + son numéro, voir spacegen.js) et des géantes.
//
// Hexa n'est pas dans la Voie lactée : elle est dans la galaxie d'Andromède, dans un de ses deux bras,
// à 26 000 al de son centre (voir HEXA_AND, tout en bas). La Voie lactée, avec la Terre, est à 2,5
// millions d'années-lumière.
// Le tirage du catalogue est resté celui d'avant (la même graine, les mêmes étoiles, les mêmes
// mondes) : il se fait dans l'ancien repère, où Hexa était dans la Voie lactée, puis tout est déplacé
// d'un bloc (voir relocate, tout en bas). Ci-dessous, la géométrie de ce tirage :
// La géométrie (années-lumière, Hexa au centre, comme les positions de src/systemes/) :
//  - le plan de la galaxie est le plan horizontal du jeu (y : le pôle nord galactique), comme les
//    systèmes faits à la main, tous à hauteur 0 ;
//  - Sagittarius A* est à R0 = 26 673 al du Système solaire (sol.js : la Terre), la distance mesurée
//    (GRAVITY, 2019 : 8 178 parsecs), et le Soleil est 68 al au-dessus du plan (20,8 pc) ;
//  - sa direction, vue de la Terre, est celle où Hexa est elle aussi à R0 du centre : les deux
//    mondes d'origine sur le même cercle, la « zone habitable » de la galaxie ;
//  - quelques étoiles célèbres sont à leur vraie place vue de la Terre (longitude et latitude
//    galactiques, distance : des valeurs arrondies) ;
//  - les autres suivent la forme de la Voie lactée : un bulbe et une barre au centre, un disque
//    de 4 bras spiraux, plus dense vers le centre, et un amas serré autour de Sagittarius A*.
// Ce fichier ne dépend que des systèmes faits à la main : les threads de génération le lisent aussi.
import { SYSTEMES } from './systemes/index.js?v=1.1.0-mx09tneh';
import { STAR_TYPES, AU, RS, RE, GZ_MIN, AZ_MIN, XZ_MIN } from './customsys.js?v=1.1.0-mx09tneh';
import { GALAXIES } from './galaxies/index.js?v=1.1.0-mx09tneh';

// (les galaxies ajoutées, src/galaxies : leurs étoiles à la suite d'Andromède, voir customGalaxies)
export const XGAL_TYPES = ['spirale', 'barree', 'elliptique', 'lenticulaire', 'irreguliere'];
export const xgStars = (g) => Math.max(200, Math.min(100000, Math.round(+g.etoiles || 20000)));
const XDEFS = GALAXIES.filter((g) => g && g.actif !== false && /^[a-z0-9][a-z0-9-]*$/.test(g.id || ''));
const XG_TOTAL = XDEFS.reduce((a, g) => a + xgStars(g) + (g.trouNoir !== false ? 1 : 0), 0);

// (les 20 000 étoiles, puis, à leur suite, les proto-systèmes des nébuleuses : voir plus bas. Les
// étoiles gardent leur numéro, leur place et leur monde, quelle que soit la suite)
// (et, après eux, les 21 806 systèmes de la galaxie d'Andromède : voir plus bas, AND0)
export const GAL_STARS = 20000, GAL_MAX = 44000 + XG_TOTAL, PROTO_MAX = GAL_STARS + 1600;
export const AND_N = 21806;
export let AND0 = GAL_MAX; // (le numéro du premier système d'Andromède : juste après les proto-systèmes)
export const isAnd = (i) => i >= AND0 && i < AND0 + AND_N;
export let GAL_N = GAL_STARS;
export const R0 = 26673;            // al : du Soleil à Sagittarius A*
export const SUN_Z = 68;            // al : le Soleil au-dessus du plan de la galaxie
export const SGRA_ID = 'sgr-a';
export const gxId = (i) => 'gx' + i;
// 'gx123' ou 'gx123-b' -> 123 (sinon -1)
export function gxIndex(id) {
  if (typeof id !== 'string' || id.charCodeAt(0) !== 103 || id.charCodeAt(1) !== 120) return -1;
  const m = /^gx(\d{1,7})(?:-[a-z])?$/.exec(id);
  return m && +m[1] < GAL_N ? +m[1] : -1;
}

// ---------- Le hasard (toujours le même) ----------
function mulberry(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const gauss = (r) => { let u = 0; while (!u) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r()); };
const deg = (a) => (a * Math.PI) / 180;

// ---------- Le Système solaire, le centre, les axes de la galaxie ----------
const posLy = (P = {}) => {
  if (P.x !== undefined || P.z !== undefined) return { x: +P.x || 0, y: +P.y || 0, z: +P.z || 0 };
  const d = +P.distance || 0, a = deg(+P.direction || 0), e = deg(+P.hauteur || 0);
  return { x: Math.cos(a) * Math.cos(e) * d, y: Math.sin(e) * d, z: Math.sin(a) * Math.cos(e) * d };
};
// (le Soleil au tirage : à 17 201 al d'Hexa, l'ancienne place ; après, il est déplacé avec la Voie
// lactée, et src/systemes/sol.js donne sa vraie place)
const SOL0 = { distance: 17201, direction: 200 };
export const SOL = posLy(SOL0);
// (du Soleil vers Hexa, à plat ; le centre : à l'angle qui met Hexa à R0 de lui aussi)
const RH = Math.sqrt(R0 * R0 - SUN_Z * SUN_Z);
const toHexa = Math.atan2(-SOL.z, -SOL.x), dH = Math.hypot(SOL.x, SOL.z);
const ALPHA = dH > 0 && dH < 2 * RH ? Math.acos(dH / (2 * RH)) : 0;
const U = { x: Math.cos(toHexa + ALPHA), z: Math.sin(toHexa + ALPHA) }; // (du Soleil vers le centre, l = 0°)
export const CENTER = { x: SOL.x + U.x * RH, y: SOL.y - SUN_Z, z: SOL.z + U.z * RH };
// (le repère galactique vu de la Terre : X vers le centre, Y vers l = 90°, Z : le pôle nord)
const GY = { x: U.z, z: -U.x };
// longitude l, latitude b (degrés), distance (al) vues du Soleil -> position (al, Hexa au centre)
export function fromSol(l, b, d) {
  const L = deg(l), B = deg(b), c = Math.cos(B) * d;
  return { x: SOL.x + c * (Math.cos(L) * U.x + Math.sin(L) * GY.x), y: SOL.y + Math.sin(B) * d, z: SOL.z + c * (Math.cos(L) * U.z + Math.sin(L) * GY.z) };
}
// (le repère du centre : S du centre vers le Soleil, T à 90° dans le plan)
const S = { x: -U.x, z: -U.z }, T = { x: S.z, z: -S.x };
const fromCenter = (R, th, z) => ({ x: CENTER.x + R * (Math.cos(th) * S.x + Math.sin(th) * T.x), y: CENTER.y + z, z: CENTER.z + R * (Math.cos(th) * S.z + Math.sin(th) * T.z) });
export const ARM_NAMES = ['bras de Persée', 'bras du Sagittaire', "bras de l'Écu", 'bras de la Règle'];
// Où est un point dans la Voie lactée (al) : sa distance au centre, sa hauteur au-dessus du plan, le
// bras spiral le plus proche (et à quelle distance ; les bras : voir armTheta)
export function galaxyPlace(p) {
  const dx = p.x - CENTER.x, dz = p.z - CENTER.z, a = dx * S.x + dz * S.z, b = dx * T.x + dz * T.z, R = Math.hypot(a, b), th = Math.atan2(b, a);
  let arm = -1, ad = Infinity;
  if (R > 2500 && R < 62000) for (let k = 0; k < 4; k++) {
    let d = (th - armTheta(R, k)) % (2 * Math.PI);
    if (d > Math.PI) d -= 2 * Math.PI; else if (d < -Math.PI) d += 2 * Math.PI;
    if (Math.abs(d) * R < ad) { ad = Math.abs(d) * R; arm = k; }
  }
  return { R, h: p.y - CENTER.y, arm, armName: arm >= 0 ? ARM_NAMES[arm] : null, armDist: ad };
}

// ---------- Les types d'étoiles ----------
export const TYPES = ['naine-rouge', 'naine-orange', 'naine-jaune', 'blanche', 'naine-blanche', 'geante-rouge', 'geante-bleue', 'neutrons', 'pulsar', 'magnetar', 'trou-noir',
  'protoetoile', 'protoetoile-massive']; // (ces deux-là : seulement dans les nébuleuses, voir plus bas)
const W_DISK = [38, 20, 14, 8, 6, 4, 3, 2, 2, 0.7, 2.3];
const W_ARM = [32, 18, 14, 10, 5, 4, 9, 2, 2, 0.7, 3.3];   // (les bras : des étoiles jeunes, bleues)
const W_BULGE = [40, 26, 12, 3, 8, 8, 0.5, 1.5, 1, 0.3, 1.7]; // (le bulbe : de vieilles étoiles)
const pickW = (r, w) => { let s = 0; for (const x of w) s += x; let v = r() * s; for (let i = 0; i < w.length; i++) if ((v -= w[i]) < 0) return i; return 0; };

// ---------- Les noms ----------
const SYL = ['ka', 've', 'ri', 'tho', 'lun', 'sa', 'mi', 'dra', 'zen', 'or', 'el', 'ya', 'quo', 'ix', 'bel', 'nor', 'tes', 'va', 'ru', 'ae', 'xi', 'lo',
  'sy', 'phe', 'ran', 'kor', 'vel', 'zu', 'ta', 'ny', 'cal', 'ar', 'is', 'mon', 'dae', 'ster', 'rhi', 'gal', 'ope', 'tau', 'li', 'sha', 'oth', 'em', 'ur'];
const ROMAN = ['', '', ' II', ' III', ' IV', ' V', ' VI', ' VII', ' VIII', ' IX', ' X'];
function makeName(r) {
  const n = 2 + (r() < 0.35 ? 1 : 0);
  let s = '';
  for (let k = 0; k < n; k++) s += SYL[Math.floor(r() * SYL.length)];
  return s[0].toUpperCase() + s.slice(1);
}

// ---------- Quelques étoiles célèbres, à leur place vue de la Terre ----------
// [nom, type, longitude galactique (°), latitude (°), distance (al)] (valeurs arrondies)
const FAMOUS = [
  ['Proxima du Centaure', 'naine-rouge', 313.9, -1.9, 4.24], ['Alpha du Centaure', 'naine-jaune', 315.7, -0.7, 4.37],
  ['Étoile de Barnard', 'naine-rouge', 31.0, 14.1, 5.96], ['Wolf 359', 'naine-rouge', 244.1, 56.1, 7.9],
  ['Sirius', 'blanche', 227.2, -8.9, 8.6], ['Epsilon Eridani', 'naine-orange', 195.8, -48.1, 10.5],
  ['Tau Ceti', 'naine-jaune', 173.1, -73.4, 11.9], ['Altaïr', 'blanche', 47.7, -8.9, 16.7], ['Véga', 'blanche', 67.4, 19.2, 25],
  ['Aldébaran', 'geante-rouge', 181.0, -20.2, 65], ['Polaris', 'blanche', 123.3, 26.5, 433], ['Bételgeuse', 'geante-rouge', 199.8, -9.0, 550],
  ['Antarès', 'geante-rouge', 351.9, 15.1, 550], ['Rigel', 'geante-bleue', 209.2, -25.2, 860], ['Deneb', 'geante-bleue', 84.3, 2.0, 2600],
  ['Pulsar du Crabe', 'pulsar', 184.6, -5.8, 6500], ['Cygnus X-1', 'trou-noir', 71.3, 3.1, 7200],
];

// ---------- Le catalogue ----------
export const GX = new Float64Array(GAL_MAX), GY_ = new Float64Array(GAL_MAX), GZ = new Float64Array(GAL_MAX);
// (1 : un système du voisinage d'Hexa, tiré avec la Voie lactée mais resté près d'Hexa : il est dans
// Andromède, voir relocate)
export const HOME = new Uint8Array(GAL_MAX);
export const inAnd = (i) => isAnd(i) || HOME[i] === 1;
export const GTYPE = new Uint8Array(GAL_MAX), GSEED = new Uint32Array(GAL_MAX);
export const GNAME = new Array(GAL_MAX);
export const GFAMOUS = new Uint8Array(GAL_MAX);
// (une grille de 50 al : pour trouver vite les systèmes près d'un point)
export const CELL = 50;
const GRID = new Map();
const cellOf = (x, y, z) => Math.floor(x / CELL) + ',' + Math.floor(y / CELL) + ',' + Math.floor(z / CELL);
export function near(x, y, z, r, out = []) {
  out.length = 0;
  const k = Math.ceil(r / CELL), cx = Math.floor(x / CELL), cy = Math.floor(y / CELL), cz = Math.floor(z / CELL);
  for (let a = -k; a <= k; a++) for (let b = -k; b <= k; b++) for (let c = -k; c <= k; c++) {
    const L = GRID.get(cx + a + ',' + (cy + b) + ',' + (cz + c));
    if (L) for (const i of L) if ((GX[i] - x) ** 2 + (GY_[i] - y) ** 2 + (GZ[i] - z) ** 2 <= r * r) out.push(i);
  }
  return out;
}
(function build() {
  const r = mulberry(0x5a6a2026), _near = [];
  // (loin des systèmes faits à la main : Hexa et ses voisins, qui bougent un peu d'un monde à
  // l'autre, dans 60 al ; les autres à leur place ; Sagittarius A* et son amas)
  const keep = SYSTEMES.filter((s) => s && s.actif !== false && s.position).map((s) => [posLy(s.id === 'sol' ? SOL0 : s.position), 3]);
  keep.push([{ x: 0, y: 0, z: 0 }, 60], [CENTER, 40]);
  const names = new Set();
  let n = 0;
  const free = (p, gap = 3) => {
    for (const [q, d] of keep) if ((p.x - q.x) ** 2 + (p.y - q.y) ** 2 + (p.z - q.z) ** 2 < d * d) return false;
    return !near(p.x, p.y, p.z, gap, _near).length;
  };
  const put = (p, type, name, famous = 0) => {
    GX[n] = p.x; GY_[n] = p.y; GZ[n] = p.z; GTYPE[n] = type; GSEED[n] = (r() * 4294967296) >>> 0; GFAMOUS[n] = famous;
    let nm = name || makeName(r), k = 2;
    if (!name) while (names.has(nm)) nm = nm.replace(/ [IVX]+$/, '') + (ROMAN[k++] || ' ' + k);
    names.add(nm);
    GNAME[n] = nm;
    const c = cellOf(p.x, p.y, p.z);
    if (!GRID.has(c)) GRID.set(c, []);
    GRID.get(c).push(n);
    n++;
  };
  for (const [name, type, l, b, d] of FAMOUS) put(fromSol(l, b, d), TYPES.indexOf(type), name, 1);
  // (autour d'un point : dans une boule aplatie)
  const around = (o, rmin, rmax, h) => {
    const d = rmin + (rmax - rmin) * Math.cbrt(r()), a = r() * Math.PI * 2;
    return { x: o.x + Math.cos(a) * d, y: o.y + gauss(r) * h, z: o.z + Math.sin(a) * d };
  };
  const tries = (count, gen, w) => { for (let k = 0, t = 0; k < count && t < count * 30; t++) { const p = gen(); if (free(p)) { put(p, pickW(r, w)); k++; } } };
  tries(220, () => around(SOL, 6, 900, 250), W_DISK);          // (le voisinage du Soleil)
  tries(320, () => around({ x: 0, y: 0, z: 0 }, 70, 1600, 300), W_DISK); // (celui d'Hexa : à portée d'un premier saut)
  tries(140, () => around(CENTER, 45, 700, 260), W_BULGE);      // (l'amas du centre)
  // le bulbe et la barre (27° de la ligne Soleil-centre), puis le disque et ses 4 bras
  const BAR = deg(27), PITCH = deg(12), ARM0 = [0.3, 1.87, 3.44, 5.01];
  const left = () => GAL_STARS - n;
  const bulge = Math.round(left() * 0.12);
  tries(bulge, () => {
    const a = gauss(r) * 4500, b = gauss(r) * 1700, z = gauss(r) * 1300;
    const R = Math.hypot(a, b), th = Math.atan2(b, a) + BAR;
    return fromCenter(R, th, z);
  }, W_BULGE);
  for (let t = 0; n < GAL_STARS && t < GAL_STARS * 40; t++) {
    let R = -8500 * Math.log(Math.max(1e-9, r() * r()));
    if (R < 2500 || R > 62000) continue;
    const arm = r() < 0.7;
    let th;
    if (arm) th = ARM0[Math.floor(r() * 4)] + Math.log(R / 8000) / Math.tan(PITCH) + gauss(r) * 0.2 * Math.pow(8000 / R, 0.3);
    else th = r() * Math.PI * 2;
    const h = 900 * (1 + R / 40000), z = (r() < 0.5 ? -1 : 1) * -h * Math.log(Math.max(1e-9, r()));
    const p = fromCenter(R, th, z);
    if (free(p)) put(p, pickW(r, arm ? W_ARM : W_DISK));
  }
})();
// Le système le plus proche d'un point (al), à moins de r : son numéro, ou -1
const _q = [];
export function nearestTo(x, y, z, r) {
  let best = -1, bd = Infinity;
  for (const i of near(x, y, z, r, _q)) { const d = (GX[i] - x) ** 2 + (GY_[i] - y) ** 2 + (GZ[i] - z) ** 2; if (d < bd) { bd = d; best = i; } }
  return best;
}
// Un système par son nom (sans accents ni majuscules) ou son numéro (« gx123 », « HXC-123 ») : -1 sinon
const plain = (t) => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
let BYNAME = null;
export function findSystem(q) {
  const s = plain(q);
  let m = /^(?:gx|hxc-?)(\d{1,5})(?:-[a-z])?$/.exec(s);
  if (m && +m[1] < GAL_N) return +m[1];
  if (!BYNAME) { BYNAME = new Map(); for (let i = 0; i < GAL_N; i++) BYNAME.set(plain(GNAME[i]), i); }
  if (BYNAME.has(s)) return BYNAME.get(s);
  m = /^(.*?)\s+[b-z]$/.exec(s); // (une planète : « Kavelo b »)
  return m && BYNAME.has(m[1]) ? BYNAME.get(m[1]) : -1;
}

// ---------- Les mondes où se poser, selon leur température ----------
// (les blocs des planètes d'Hexa, voir system.js)
const STYLES = {
  hot: [
    { style: 'volcanic', dessus: 68, dessous: 3981, roche: 68, profond: 74, mer: { niveau: 50, liquide: 'lave' }, minerais: [[642, 0.012, 60], [60, 0.008, 50], [85, 0.004, 25]], ciel: '#3a1810' },
    { style: 'io', dessus: 3978, dessous: 70, roche: 68, profond: 73, minerais: [[61, 0.02, 60], [83, 0.006, 30]], ciel: '#2a2010' },
    { style: 'cinder', dessus: 4084, dessous: 4084, roche: 68, profond: 74, mer: { niveau: 52, liquide: 'lave' }, minerais: [[4087, 0.004, 30], [85, 0.006, 40]], ciel: '#40140a' },
  ],
  warm: [
    { style: 'desert', dessus: 626, dessous: 70, roche: 3980, profond: 71, minerais: [[61, 0.03, 90], [87, 0.02, 60], [3977, 0.01, 70]], ciel: '#c8a040' },
    { style: 'sandstone', dessus: 8, dessous: 627, roche: 627, profond: 3, minerais: [[60, 0.01, 50], [30, 0.012, 60]], ciel: '#d8b070' },
    { style: 'mars', dessus: 3971, dessous: 3979, roche: 3972, profond: 68, minerais: [[60, 0.012, 60], [640, 0.006, 40]], ciel: '#c88a5a' },
  ],
  cold: [
    { style: 'glacier', dessus: 37, dessous: 3973, roche: 3974, profond: 261, mer: { niveau: 56, liquide: 'eau glaciale' }, minerais: [[60, 0.01, 50], [83, 0.004, 30]], ciel: '#a8c8e8' },
    { style: 'redice', dessus: 37, dessous: 3973, roche: 3974, profond: 261, mer: { niveau: 56, liquide: 'eau glaciale' }, minerais: [[640, 0.01, 50]], ciel: '#d8a8a0' },
    { style: 'europa', dessus: 3973, dessous: 3973, roche: 3, profond: 68, mer: { niveau: 30, liquide: 'eau' }, minerais: [[60, 0.006, 40]], ciel: '#000000' },
    { style: 'frozenocean', dessus: 37, dessous: 3973, roche: 3974, profond: 3, minerais: [[83, 0.006, 40]], ciel: '#9ab8d8' },
  ],
  frozen: [
    { style: 'pluto', dessus: 3975, dessous: 3973, roche: 3974, profond: 3, minerais: [[85, 0.006, 40]], ciel: '#000000' },
    { style: 'moon', dessus: 3969, dessous: 3969, roche: 3970, profond: 68, minerais: [[60, 0.008, 40], [83, 0.004, 30]], ciel: '#000000' },
    { style: 'glacyon', dessus: 4083, dessous: 3975, roche: 3973, profond: 3, minerais: [[4095, 0.01, 40]], ciel: '#000000' },
    { style: 'lethe', dessus: 4094, dessous: 4094, roche: 68, profond: 74, minerais: [[85, 0.008, 30], [83, 0.006, 20]], ciel: '#000000' },
    { style: 'tessel', dessus: 4092, dessous: 4092, roche: 4093, profond: 3, minerais: [[4087, 0.005, 30]], ciel: '#000000' },
  ],
};
const PLANET_LETTERS = 'bcdefgh';

// Les biomes d'un monde tempéré (style « biomes », voir planetgen.land) : du pôle à l'équateur, du
// désert à la jungle, de la côte aux sommets. Ses arbres changent d'un monde à l'autre.
// (température : °C, selon la latitude et l'altitude ; humidité : 0 à 1 ; altitude : blocs au-dessus de la mer)
const TREES = [[5, 6], [256, 257], [97, 98], [152, 153], [4310, 4311], [4321, 4322], [4332, 4333], [4354, 4355]];
export function temperateBiomes(r) {
  const pick = (a) => a[Math.floor(r() * a.length)];
  const tree = (t, dens, h = [4, 7], crown = 2, gap = 5) => ({ densite: dens, tronc: t[0], feuilles: t[1], hauteur: h, couronne: crown, espacement: gap });
  const T1 = pick(TREES), T2 = pick(TREES), grass = [{ bloc: 196, densite: 0.12 }];
  return [
    { nom: 'Prairie', couleur: '#6a9a3a', dessus: 1, dessous: 2, plantes: grass },
    { nom: 'Steppe', couleur: '#a8a860', conditions: { temperature: [2, 26], humidite: [0.1, 0.38] }, dessus: 1, dessous: 2, plantes: [{ bloc: 4377, densite: 0.18 }] },
    { nom: 'Forêt tempérée', couleur: '#2e6a2a', conditions: { temperature: [4, 24], humidite: [0.5, 0.72] }, dessus: 1, dessous: 2, arbres: tree(T1, 0.4), plantes: grass },
    { nom: 'Forêt mixte', couleur: '#3a7a3a', conditions: { temperature: [8, 22], humidite: [0.56, 0.66] }, dessus: 1, dessous: 2, arbres: tree(T2, 0.45, [5, 8]) },
    { nom: "Forêt d'érables", couleur: '#b0402a', conditions: { temperature: [6, 16], humidite: [0.42, 0.52] }, dessus: 1, dessous: 2, arbres: tree([4310, 4311], 0.35) },
    { nom: 'Taïga', couleur: '#3a5a4a', conditions: { temperature: [-14, 4], humidite: [0.35, 1] }, dessus: 36, dessous: 2, arbres: tree([256, 39], 0.35, [5, 9], 1, 4) },
    { nom: 'Toundra', couleur: '#9aa890', conditions: { temperature: [-26, -8] }, dessus: 36, dessous: 2, plantes: [{ bloc: 4377, densite: 0.05 }, { bloc: 760, densite: 0.2 }] },
    { nom: 'Banquise et glaciers', couleur: '#f0f4f8', conditions: { temperature: [-200, -24] }, dessus: 37, dessous: 3973, epaisseur: 6 },
    { nom: 'Savane', couleur: '#c8b860', conditions: { temperature: [24, 200], humidite: [0.25, 0.48] }, dessus: 1, dessous: 2, arbres: tree([4343, 4344], 0.08, [4, 6], 2, 8), plantes: [{ bloc: 4377, densite: 0.3 }] },
    { nom: 'Désert', couleur: '#e0c878', conditions: { temperature: [22, 200], humidite: [0, 0.25] }, dessus: 8, dessous: 627, formations: [{ bloc: 38, densite: 0.25, hauteur: [2, 4], largeur: 0.5, espacement: 9 }] },
    { nom: 'Désert rouge', couleur: '#c86a3a', conditions: { temperature: [30, 200], humidite: [0, 0.16], altitude: [-999, 14] }, dessus: 4203, dessous: 4203 },
    { nom: 'Mesa', couleur: '#be6034', conditions: { temperature: [26, 200], humidite: [0, 0.3], altitude: [12, 40] }, dessus: 4203, dessous: 4205, epaisseur: 8,
      formations: [{ bloc: 4204, tete: 4206, densite: 0.15, hauteur: [4, 9], largeur: 2.5, espacement: 22 }] },
    { nom: 'Jungle', couleur: '#1e6a22', conditions: { temperature: [24, 200], humidite: [0.68, 1] }, dessus: 1, dessous: 2, arbres: tree([4365, 4366], 0.6, [7, 12], 3, 6), plantes: [{ bloc: 196, densite: 0.35 }] },
    { nom: 'Marais', couleur: '#4a5a34', conditions: { temperature: [6, 200], humidite: [0.72, 1], altitude: [-999, 4] }, dessus: 4189, dessous: 4189, arbres: tree([4365, 4366], 0.2, [4, 7]), plantes: [{ bloc: 196, densite: 0.3 }] },
    { nom: 'Bosquet de ginkgos', couleur: '#d8b028', conditions: { temperature: [10, 22], humidite: [0.6, 0.68] }, dessus: 1, dessous: 2, arbres: tree([4354, 4355], 0.3, [5, 8]) },
    { nom: 'Champignons géants', couleur: '#844aa0', conditions: { temperature: [8, 26], humidite: [0.78, 0.86], altitude: [3, 20] }, dessus: 3998, dessous: 2,
      formations: [{ bloc: 4196, tete: 4193, densite: 0.4, hauteur: [5, 10], largeur: 0.5, espacement: 9 }], plantes: [{ bloc: 611, densite: 0.04 }] },
    { nom: 'Falaises rocheuses', couleur: '#8a8a8a', conditions: { altitude: [24, 36] }, dessus: 3, dessous: 3, plantes: [{ bloc: 244, densite: 0.1 }] },
    { nom: 'Alpages', couleur: '#8ab070', conditions: { altitude: [18, 30], temperature: [0, 18] }, dessus: 1, dessous: 2, plantes: [{ bloc: 196, densite: 0.2 }] },
    { nom: 'Sommets enneigés', couleur: '#f0f4f8', conditions: { altitude: [36, 999] }, dessus: 37, dessous: 3, plantes: [{ bloc: 760, densite: 0.4 }] },
  ];
}

// La description d'un système du catalogue, au format de src/systemes/ (voir customsys.js)
export function systemDef(i) {
  if (i >= GAL_STARS && i < AND0) return protoDef(i);
  const r = mulberry(GSEED[i]), type = TYPES[GTYPE[i]], ST = STAR_TYPES[type], id = gxId(i), name = GNAME[i];
  const and = inAnd(i), xg = xgalOf(i), GALN = and ? "de la galaxie d'Andromède" : xg ? 'de la galaxie ' + xg.nom : 'de la Voie lactée';
  const pick = (a) => a[Math.floor(r() * a.length)];
  const def = {
    id, nom: name, actif: true, galaxie: i,
    description: (i === AND0 ? "Le trou noir géant du cœur d'Andromède (140 millions de soleils, à 2,5 millions d'années-lumière). " : GFAMOUS[i] ? 'Une étoile connue depuis la Terre. ' : '') + `${ST.nom}, système HXC-${i} ${GALN}.`,
    position: { x: GX[i], y: GY_[i], z: GZ[i] },
    etoiles: [{ id, nom: name, type, taille: ST.taille * (0.8 + r() * 0.45), description: `${ST.nom} ${GALN} (HXC-${i}).` }],
    planetes: [],
  };
  const starR = def.etoiles[0].taille * RS;
  // une compagne (une étoile sur six, pas autour d'un trou noir)
  if (!ST.trou && r() < 0.17) {
    const ct = pick(['naine-rouge', 'naine-rouge', 'naine-orange', 'naine-blanche']);
    def.etoiles.push({ id: id + '-z', nom: name + ' B', type: ct, orbite: { distance: Math.round(60 + r() * 240), excentricite: Math.round(r() * 40) / 100 } });
  }
  // le monde où se poser : sa température d'abord (chaud, tiède, tempéré, froid, gelé), puis sa distance
  const L = Math.max(0.0005, ST.eclat);
  const want = pick([340, 300, 160, 110, 20, 15, -50, -80, -150, -200]) + (r() - 0.5) * 30;
  const minA = (3 * starR + 2 * RE) * 1.6 / AU;
  let a = Math.max(minA, (288 * L ** 0.25 / (want + 273)) ** 2);
  a = Math.round(a * 1000) / 1000;
  const temp = Math.round(288 * L ** 0.25 / Math.sqrt(a) - 273);
  const size = Math.round((0.35 + r() * 1.15) * 100) / 100;
  const P = { id: id + '-b', nom: name + ' b', type: 'rocheuse', distance: a, taille: size, zone: and ? AZ_MIN + i - AND0 : xg ? XZ_MIN + i - XG0 : GZ_MIN + i, temperature: temp,
    jour: Math.round((0.5 + r() * 2.5) * 10) / 10, inclinaison: Math.round(r() * 35) };
  if (temp > 15 && temp < 45 && r() < 0.7) {
    // tempéré : des continents, des mers, parfois de l'air
    const breath = r() < 0.55, sky = breath ? '#4a8ad8' : pick(['#8ab0c8', '#c8b090', '#a0c0a0']);
    P.atmosphere = { respirable: breath, ciel: sky, densite: Math.round((0.6 + r() * 0.8) * 10) / 10 };
    P.terrain = {
      style: 'biomes', base: 62, relief: Math.round(16 + r() * 18), humidite: Math.round((0.35 + r() * 0.35) * 100) / 100,
      ecartPoles: Math.round(36 + r() * 16), continents: Math.round(1400 + r() * 1200),
      montagnes: { force: Math.round((0.2 + r() * 0.35) * 100) / 100, taille: 1100, hauteur: Math.round(20 + r() * 22) },
      mer: { niveau: 48 + Math.floor(r() * 8), liquide: 'eau', plage: 'Sable', fond: 'Sable', gel: 'Glace', gelSous: -6 },
      minerais: [{ bloc: 60, frequence: 0.01, profondeurMax: 50 }, { bloc: 30, frequence: 0.012, profondeurMax: 60 }, { bloc: 4140, frequence: 0.006, profondeurMax: 40 }],
      biomes: temperateBiomes(r),
    };
  } else {
    const S2 = pick(STYLES[temp > 250 ? 'hot' : temp > 45 ? 'warm' : temp > -100 ? 'cold' : 'frozen']);
    P.terrain = { style: S2.style, dessus: S2.dessus, dessous: S2.dessous, roche: S2.roche, profond: S2.profond, relief: Math.round(10 + r() * 22),
      minerais: S2.minerais.map(([bloc, frequence, profondeurMax]) => ({ bloc, frequence, profondeurMax })) };
    if (S2.mer) P.terrain.mer = { ...S2.mer };
    if (S2.ciel !== '#000000') P.atmosphere = { respirable: false, ciel: S2.ciel, densite: Math.round((0.2 + r() * 1.2) * 10) / 10 };
  }
  def.planetes.push(P);
  // des géantes, plus loin (sans sol : on ne s'y pose pas)
  const giants = Math.floor(r() * 4);
  let d = a;
  for (let k = 0; k < giants; k++) {
    d = Math.round(d * (1.8 + r() * 1.6) * 100) / 100 + 0.3;
    const gas = r() < 0.6;
    const G = { id: id + '-' + PLANET_LETTERS[k + 1], nom: name + ' ' + PLANET_LETTERS[k + 1], type: gas ? 'geante-gazeuse' : 'geante-glace', distance: d,
      taille: Math.round((gas ? 6 + r() * 7 : 3 + r() * 2.5) * 10) / 10, inclinaison: Math.round(r() * 30) };
    if (r() < 0.6) G.bandes = gas ? pick([['#c98a4b', '#e2b884', '#a0623a', '#f0d6a8'], ['#b8a890', '#d8c8b0', '#988870'], ['#c87060', '#e8a890', '#a05040', '#f0c8b0'], ['#8aa0c8', '#b0c4e0', '#6a80a8']])
      : pick([['#8ac8d8', '#a8dce8', '#7ab8cc'], ['#5a8ad8', '#7aa8e8', '#4a70c0'], ['#a0d8c0', '#c0ecd8', '#80b8a0']]);
    if (r() < 0.3) G.anneaux = [{ de: 1.4 + r() * 0.3, a: 2 + r() * 0.6, opacite: Math.round((0.3 + r() * 0.5) * 100) / 100 }];
    def.planetes.push(G);
  }
  // Un couple serré (à peu près une compagne sur deux) : les deux étoiles tournent l'une autour de
  // l'autre, tout près, et les planètes autour des deux : deux soleils dans le ciel, deux ombres au
  // sol. (Son propre tirage, à part : les planètes et tout le reste du système restent les mêmes.)
  const Z = def.etoiles[1];
  if (Z && !ST.pulsar) {
    const r2 = mulberry((GSEED[i] ^ 0x2b1d5) >>> 0);
    const types = ['naine-jaune', 'naine-orange', 'naine-orange', 'naine-rouge', 'naine-blanche'].filter((t) => STAR_TYPES[t].eclat <= ST.eclat);
    const ct = types.length ? types[Math.floor(r2() * types.length)] : null;
    // (deux étoiles chauffent plus qu'une : les planètes sont plus loin, pour garder la même température)
    const far = ct ? Math.sqrt(1 + STAR_TYPES[ct].eclat / L) : 1, a2 = a * far;
    const sep = a2 / (3 + r2() * 2.5), touch = (starR + (ct ? STAR_TYPES[ct].taille : 0) * RS) * 3 / AU;
    if (ct && r2() < 0.5 && sep > touch) {
      Z.type = ct;
      Z.orbite = { distance: Math.round(sep * 1000) / 1000, excentricite: Math.round(r2() * 15) / 100, barycentre: true };
      for (const p of def.planetes) { p.autour = 'centre'; p.distance = Math.round(p.distance * far * 1000) / 1000; }
    }
  }
  return def;
}

// ---------- Sagittarius A* ----------
// 4,3 millions de masses solaires ; son horizon : 17 rayons du Soleil (0,08 UA). Autour : l'étoile
// S2, sur son orbite réelle (16 ans, très allongée, à 120 UA du trou noir au plus près).
export const SGRA_DEF = {
  id: 'sgra', nom: 'Sagittarius A*', actif: true,
  description: 'Le trou noir supermassif du centre de la Voie lactée, à 26 673 années-lumière de la Terre.',
  position: { x: CENTER.x, y: CENTER.y, z: CENTER.z },
  etoiles: [
    { id: SGRA_ID, nom: 'Sagittarius A*', type: 'trou-noir', taille: 17, masse: 4.3e6, couleurDisque: '#ffb070',
      description: 'Le trou noir supermassif au cœur de la Voie lactée : 4,3 millions de fois la masse du Soleil.' },
    { id: 'sgr-s2', nom: 'S2', type: 'geante-bleue', taille: 4, masse: 14,
      orbite: { autour: SGRA_ID, distance: 1000, excentricite: 0.88, inclinaison: 134, noeud: 228, periode: 16 * 120 },
      description: 'Une étoile bleue qui frôle Sagittarius A* tous les 16 ans, à 7 600 km/s au plus près.' },
  ],
  planetes: [],
};

// ---------- Les nébuleuses ----------
// Des nuages de gaz et de poussière, à leur place dans la galaxie (années-lumière, comme les étoiles) :
//  - hii : une région H II, pouponnière d'étoiles. Le gaz (de l'hydrogène surtout) est ionisé par les
//    jeunes étoiles chaudes qu'il a fait naître : il brille en rouge (la raie Hα), en bleu-vert au
//    cœur, le plus chaud (l'oxygène ionisé, [O III]) ; des bandes de poussière le coupent ; ses étoiles
//    en ont creusé le centre. Elles suivent les bras spiraux, là où le gaz se tasse.
//  - sombre : un nuage moléculaire froid, opaque, qui cache les étoiles derrière lui. Les étoiles y
//    naissent aussi, encore enfouies.
//  - reflexion : de la poussière éclairée par une étoile brillante voisine : bleue (la lumière bleue
//    est la plus diffusée, comme le ciel).
//  - planetaire : la coquille rejetée par une étoile moyenne en fin de vie, autour de sa naine blanche.
//  - reste : le reste d'une supernova, une coquille de filaments en expansion, autour de l'étoile à
//    neutrons ou du pulsar qu'elle a laissé.
// Chacune : { id, name, type, x, y, z (al), R (al), flat ([a, b, c] : son étirement), q (son
// orientation : quaternion), seed, bright, star (l'étoile qu'elle entoure : numéro, ou -1), protos }.
// Le même catalogue dans tous les mondes. Rien n'y est simulé : tout se tire de sa graine.
export const NEBULAE = [];
export const NEB_TYPES = { hii: 'Région H II (pouponnière d\'étoiles)', sombre: 'Nuage moléculaire sombre', reflexion: 'Nébuleuse par réflexion', planetaire: 'Nébuleuse planétaire', reste: 'Reste de supernova' };
// les proto-systèmes (à la suite des étoiles) : leur nébuleuse, leur phase
export const GNEB = new Int16Array(GAL_MAX).fill(-1);
export const GPHASE = new Uint8Array(GAL_MAX);
export const PHASES = ['coeur', 'jeune', 'disque', 'debris'];
export const PHASE_NAMES = ['Cœur protostellaire (classe 0)', 'Protoétoile enfouie (classe I)', 'Disque protoplanétaire (classe II)', 'Disque de débris'];
const P_STAR = TYPES.indexOf('protoetoile'), P_MASSIVE = TYPES.indexOf('protoetoile-massive');
// (la nébuleuse où est un point (al), s'il est dans l'une d'elles : la plus serrée autour de lui)
export function nebulaAt(x, y, z) {
  let best = null, bd = Infinity;
  for (const N of NEBULAE) {
    const d = Math.hypot(N.x - x, N.y - y, N.z - z) / N.R;
    if (d < 1 && N.R < bd) { bd = N.R; best = N; }
  }
  return best;
}
(function nebulae() {
  const r = mulberry(0x6e6562), PITCH = deg(12), ARM0 = [0.3, 1.87, 3.44, 5.01];
  const quat = () => { // (une orientation au hasard)
    const u1 = r(), u2 = r() * Math.PI * 2, u3 = r() * Math.PI * 2, a = Math.sqrt(1 - u1), b = Math.sqrt(u1);
    return [a * Math.sin(u2), a * Math.cos(u2), b * Math.sin(u3), b * Math.cos(u3)];
  };
  const add = (type, name, p, R, more = {}) => {
    const N = { id: 'nb' + NEBULAE.length, name, type, x: p.x, y: p.y, z: p.z, R, seed: Math.floor(r() * 1000),
      flat: [1, 0.55 + r() * 0.45, 0.65 + r() * 0.35], q: quat(), bright: 0.8 + r() * 0.4, star: -1, protos: [], ...more };
    NEBULAE.push(N);
    return N;
  };
  // (le long d'un bras spiral, comme les étoiles jeunes)
  const inArm = () => {
    for (;;) {
      const R = -8500 * Math.log(Math.max(1e-9, r() * r()));
      if (R < 3000 || R > 50000) continue;
      const th = ARM0[Math.floor(r() * 4)] + Math.log(R / 8000) / Math.tan(PITCH) + gauss(r) * 0.12 * Math.pow(8000 / R, 0.3);
      return fromCenter(R, th, gauss(r) * 250);
    }
  };
  const logU = (a, b) => a * Math.pow(b / a, r());
  const starsOf = (types) => { const out = []; for (let i = 0; i < GAL_STARS; i++) if (types.includes(GTYPE[i])) out.push(i); return out; };
  const nearestOf = (types, lo, hi) => {
    let best = -1, bd = Infinity;
    for (let i = 0; i < GAL_STARS; i++) {
      if (!types.includes(GTYPE[i])) continue;
      const d = Math.hypot(GX[i], GY_[i], GZ[i]);
      if (d > lo && d < hi && d < bd) { bd = d; best = i; }
    }
    return best;
  };
  const at = (i) => ({ x: GX[i], y: GY_[i], z: GZ[i] });
  const WD = [4], NS = [7, 8, 9], BRIGHT = [3, 6];
  // les voisines d'Hexa : de quoi voir chaque genre de près
  const dirAt = (lon, lat, d) => ({ x: Math.cos(deg(lat)) * Math.cos(deg(lon)) * d, y: Math.sin(deg(lat)) * d, z: Math.cos(deg(lat)) * Math.sin(deg(lon)) * d });
  add('hii', 'Pouponnière de Vélane', dirAt(38, 9, 160), 14, { protos: 6, all: true, bright: 1 });
  add('sombre', 'Nuage de Brume-Noire', dirAt(212, -14, 95), 9, { protos: 2 });
  let i = nearestOf(WD, 60, 500);
  if (i >= 0) add('planetaire', 'Nébuleuse planétaire de ' + GNAME[i], at(i), 0.8, { star: i });
  i = nearestOf(NS, 80, 900);
  if (i >= 0) add('reste', 'Reste de la supernova de ' + GNAME[i], at(i), 18, { star: i });
  i = nearestOf(BRIGHT, 40, 600);
  if (i >= 0) add('reflexion', 'Voile bleu de ' + GNAME[i], at(i), 3, { star: i });
  // les célèbres, à leur place vue de la Terre (valeurs arrondies) : [nom, genre, l, b, distance, rayon (al), proto-systèmes]
  const FAMOUS_NEB = [
    ['Nébuleuse d\'Orion', 'hii', 209.0, -19.4, 1344, 12, 6], ['Nébuleuse de l\'Aigle', 'hii', 17.0, 0.8, 5700, 35, 4],
    ['Nébuleuse de la Lagune', 'hii', 6.0, -1.2, 4100, 50, 4], ['Nébuleuse de la Carène', 'hii', 287.6, -0.6, 7500, 115, 6],
    ['Nébuleuse de la Tête de Cheval', 'sombre', 206.9, -16.6, 1375, 3.5, 1], ['Sac à Charbon', 'sombre', 301.0, -1.0, 600, 30, 0],
    ['Nébuleuse des Pléiades', 'reflexion', 166.6, -23.5, 444, 8, 0], ['Nébuleuse de l\'Anneau', 'planetaire', 63.2, 14.0, 2570, 0.65, 0],
    ['Nébuleuse de l\'Hélice', 'planetaire', 36.2, -57.1, 650, 1.4, 0], ['Nébuleuse du Crabe', 'reste', 184.6, -5.8, 6500, 5.5, 0],
    ['Dentelles du Cygne', 'reste', 74.0, -8.6, 2400, 55, 0],
  ];
  for (const [name, type, l, b, d, R, np] of FAMOUS_NEB) {
    const N = add(type, name, fromSol(l, b, d), R, { protos: np, famous: true, bright: 1.1 });
    if (name === 'Nébuleuse du Crabe') { const k = GNAME.indexOf('Pulsar du Crabe'); if (k >= 0 && k < GAL_STARS) { N.star = k; N.x = GX[k]; N.y = GY_[k]; N.z = GZ[k]; } }
  }
  // les autres : les régions H II et les nuages sombres le long des bras ; les autres autour de leur étoile
  for (let k = 0; k < 240; k++) add('hii', 'Nébuleuse ' + makeName(r), inArm(), logU(10, 80), { protos: 2 + Math.floor(r() * 4) });
  for (let k = 0; k < 200; k++) add('sombre', 'Nuage sombre ' + makeName(r), inArm(), logU(4, 35), { protos: r() < 0.5 ? Math.floor(r() * 3) : 0 });
  const pickFrom = (list, n, f) => { for (let k = 0; k < n && list.length; k++) { const j = Math.floor(r() * list.length); f(list[j]); list.splice(j, 1); } };
  const taken = new Set(NEBULAE.map((N) => N.star));
  const free = (list) => list.filter((s) => !taken.has(s));
  pickFrom(free(starsOf(BRIGHT)), 90, (s) => add('reflexion', 'Voile bleu de ' + GNAME[s], at(s), logU(1.5, 6), { star: s }));
  pickFrom(free(starsOf(WD)), 160, (s) => add('planetaire', 'Nébuleuse planétaire de ' + GNAME[s], at(s), logU(0.3, 1.6), { star: s }));
  pickFrom(free(starsOf(NS)), 70, (s) => add('reste', 'Reste de la supernova de ' + GNAME[s], at(s), logU(6, 60), { star: s }));

  // ---------- Les proto-systèmes : des étoiles en train de naître, dans les nébuleuses ----------
  // (à la suite des étoiles du catalogue ; chacun a sa phase : voir protoDef)
  let n = GAL_STARS;
  const SHORT = /^(Pouponnière de |Nébuleuse de l'|Nébuleuse de la |Nébuleuse d'|Nébuleuse du |Nébuleuse des |Nébuleuse de |Nébuleuse |Nuage sombre |Nuage de |Sac à )/;
  for (let k = 0; k < NEBULAE.length; k++) {
    const N = NEBULAE[k], count = N.protos || 0;
    N.protos = [];
    const short = N.name.replace(SHORT, '');
    for (let j = 0; j < count && n < PROTO_MAX; j++) {
      // (dans le nuage ; dans une région H II, plutôt vers ses bords denses : ses étoiles ont vidé le centre)
      const a = r() * Math.PI * 2, u = r() * 2 - 1, s = Math.sqrt(1 - u * u), d = N.R * (N.type === 'hii' ? 0.35 + r() * 0.45 : r() * 0.6);
      GX[n] = N.x + Math.cos(a) * s * d; GY_[n] = N.y + u * d * 0.6; GZ[n] = N.z + Math.sin(a) * s * d;
      // (la phase : dans un nuage sombre, des étoiles encore enfouies ; la pouponnière voisine d'Hexa les montre toutes)
      const ph = N.all ? [0, 1, 2, 2, 3, 2][j % 6] : N.type === 'sombre' ? (r() < 0.55 ? 0 : 1) : pickW(r, [15, 25, 45, 15]);
      GTYPE[n] = r() < 0.15 && ph < 3 ? P_MASSIVE : P_STAR;
      GSEED[n] = (r() * 4294967296) >>> 0;
      GFAMOUS[n] = 0;
      GNAME[n] = short + ' P' + (j + 1);
      GNEB[n] = k;
      GPHASE[n] = ph;
      const c = cellOf(GX[n], GY_[n], GZ[n]);
      if (!GRID.has(c)) GRID.set(c, []);
      GRID.get(c).push(n);
      N.protos.push(n);
      n++;
    }
  }
  GAL_N = n;
})();

// ---------- La galaxie d'Andromède (M31) ----------
// À 2,5 millions d'années-lumière, dans sa vraie direction vue de la Terre (longitude galactique 121,2°,
// latitude -21,6°). Une grande spirale, un peu plus grande que la Voie lactée (110 000 al de rayon ici) ;
// vue presque par la tranche (son disque est incliné de 77° sur la ligne de visée) : d'ici, une tache
// pâle et allongée, trois degrés de long (six fois la Lune). 21 806 systèmes :
//  - au centre, M31*, son trou noir géant (140 millions de soleils ; ici, un trou noir comme les autres) ;
//  - un gros bulbe de vieilles étoiles ;
//  - un disque à deux bras peu enroulés, et l'« anneau de feu », à 33 000 al du centre, où naissent
//    les étoiles bleues ;
//  - ses deux petites galaxies compagnes : M32 (elliptique, serrée, tout contre le disque) et M110.
// Son propre tirage, à la suite du reste : la Voie lactée ne change pas.
export const AND_CENTER = fromSol(121.17, -21.57, 2.5e6);
export const AND_FRAME = (() => {
  const c = AND_CENTER, d = Math.hypot(c.x - SOL.x, c.y - SOL.y, c.z - SOL.z);
  const n = { x: (c.x - SOL.x) / d, y: (c.y - SOL.y) / d, z: (c.z - SOL.z) / d };
  const cr = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
  const nm = (v) => { const l = Math.hypot(v.x, v.y, v.z); return { x: v.x / l, y: v.y / l, z: v.z / l }; };
  // (sur le ciel : vers le pôle nord galactique, et à 90° ; le grand axe de la tache, tourné de 55°)
  const up = nm({ x: -n.x * n.y, y: 1 - n.y * n.y, z: -n.z * n.y }), side = cr(n, up), ph = deg(55);
  const A1 = { x: up.x * Math.cos(ph) + side.x * Math.sin(ph), y: up.y * Math.cos(ph) + side.y * Math.sin(ph), z: up.z * Math.cos(ph) + side.z * Math.sin(ph) };
  const m = cr(n, A1), i = deg(77);
  // (l'axe du disque : à 77° de la ligne de visée)
  const N = nm({ x: n.x * Math.cos(i) + m.x * Math.sin(i), y: n.y * Math.cos(i) + m.y * Math.sin(i), z: n.z * Math.cos(i) + m.z * Math.sin(i) });
  return { A1, A2: cr(N, A1), N, m, n };
})();
(function andromeda() {
  const r = mulberry(0x3a31a2d5), F = AND_FRAME, C = AND_CENTER;
  const names = new Set();
  for (let i = 0; i < GAL_N; i++) names.add(GNAME[i]);
  let n = (AND0 = GAL_N);
  const end = AND0 + AND_N;
  const at = (R, th, h) => ({ x: C.x + R * Math.cos(th) * F.A1.x + R * Math.sin(th) * F.A2.x + h * F.N.x, y: C.y + R * Math.cos(th) * F.A1.y + R * Math.sin(th) * F.A2.y + h * F.N.y, z: C.z + R * Math.cos(th) * F.A1.z + R * Math.sin(th) * F.A2.z + h * F.N.z });
  const put = (p, type, name, famous = 0) => {
    GX[n] = p.x; GY_[n] = p.y; GZ[n] = p.z; GTYPE[n] = type; GSEED[n] = (r() * 4294967296) >>> 0; GFAMOUS[n] = famous;
    let nm = name || makeName(r), k = 2;
    if (!name) while (names.has(nm)) nm = nm.replace(/ ([IVX]+|\d+)$/, '') + (ROMAN[k++] || ' ' + k);
    names.add(nm);
    GNAME[n] = nm;
    const c = cellOf(p.x, p.y, p.z);
    if (!GRID.has(c)) GRID.set(c, []);
    GRID.get(c).push(n);
    n++;
  };
  put(C, TYPES.indexOf('trou-noir'), 'M31*', 1);
  // les deux compagnes (sur le ciel : M32 à 0,4° au sud du centre, M110 à 0,6° de l'autre côté)
  const sat = (count, off, s, flat) => {
    const o = { x: C.x + off[0] * F.m.x + off[1] * F.A1.x + off[2] * F.n.x, y: C.y + off[0] * F.m.y + off[1] * F.A1.y + off[2] * F.n.y, z: C.z + off[0] * F.m.z + off[1] * F.A1.z + off[2] * F.n.z };
    for (let k = 0; k < count; k++) {
      const a = gauss(r) * s, b = gauss(r) * s * flat, c = gauss(r) * s;
      put({ x: o.x + a * F.A1.x + b * F.m.x + c * F.n.x, y: o.y + a * F.A1.y + b * F.m.y + c * F.n.y, z: o.z + a * F.A1.z + b * F.m.z + c * F.n.z }, pickW(r, W_BULGE));
    }
  };
  sat(700, [-17000, 3000, -8000], 650, 0.8);    // M32
  sat(900, [21000, -15000, 12000], 1600, 0.6);  // M110 (NGC 205)
  // le bulbe
  const bulge = Math.round((end - n) * 0.24);
  for (let k = 0; k < bulge; k++) {
    const R = Math.abs(gauss(r)) * 3800 + 300, th = r() * Math.PI * 2, h = gauss(r) * 2200;
    put(at(R, th, h), pickW(r, W_BULGE));
  }
  // le disque, ses deux bras et l'anneau de feu
  const PITCH = deg(8);
  while (n < end) {
    const u = r();
    let R, th, w;
    if (u < 0.2) { R = 33000 + gauss(r) * 2600; th = r() * Math.PI * 2; w = W_ARM; }
    else {
      R = -17000 * Math.log(Math.max(1e-9, r()));
      if (R < 3500 || R > 110000) continue;
      if (u < 0.62) { th = (r() < 0.5 ? 0 : Math.PI) + Math.log(R / 12000) / Math.tan(PITCH) + gauss(r) * 0.18; w = W_ARM; }
      else { th = r() * Math.PI * 2; w = W_DISK; }
    }
    const h = gauss(r) * 700 * (1 + R / 50000);
    put(at(R, th, h), pickW(r, w));
  }
  GAL_N = n;
})();

// ---------- Les galaxies ajoutées (src/galaxies, voir l'atelier) ----------
// Une galaxie : un centre (n'importe où, aucune limite de distance), un disque penché, et ses étoiles
// tirées selon sa forme. galaxyPoints sert aussi à l'atelier (l'aperçu d'un brouillon), sans rien
// ajouter au catalogue. put(x, y, z (al), type d'étoile, nom ou null)
export function galaxyCenter(g) { return posLy(g.position || {}); }
export function galaxyPoints(g, put) {
  const r = mulberry((+g.graine || 1) * 2654435761 + 0x9e37), C = galaxyCenter(g);
  const type = XGAL_TYPES.includes(g.type) ? g.type : 'spirale', Rd = Math.max(500, +g.rayon || 50000), N = xgStars(g);
  const thick = Math.max(10, +g.epaisseur || Rd * 0.02), bulge = Math.max(0, Math.min(0.8, g.bulbe ?? (type === 'elliptique' ? 1 : 0.2)));
  // le repère du disque : penché de inclinaison, vers orientation
  const i = deg(+g.inclinaison || 0), o = deg(+g.orientation || 0);
  const Nn = { x: Math.sin(i) * Math.cos(o), y: Math.cos(i), z: Math.sin(i) * Math.sin(o) };
  const ref = Math.abs(Nn.y) < 0.9 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
  const cr = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
  const nm = (v) => { const l = Math.hypot(v.x, v.y, v.z); return { x: v.x / l, y: v.y / l, z: v.z / l }; };
  const A1 = nm(cr(Nn, ref)), A2 = cr(Nn, A1);
  const at = (a, b, h) => ({ x: C.x + a * A1.x + b * A2.x + h * Nn.x, y: C.y + a * A1.y + b * A2.y + h * Nn.y, z: C.z + a * A1.z + b * A2.z + h * Nn.z });
  const polar = (R, th, h) => at(R * Math.cos(th), R * Math.sin(th), h);
  if (g.trouNoir !== false) put(C.x, C.y, C.z, TYPES.indexOf('trou-noir'), (g.nom || g.id) + '*');
  const out = (p, w) => put(p.x, p.y, p.z, pickW(r, w), null);
  const arms = Math.max(2, Math.min(8, Math.round(+g.bras || (type === 'barree' ? 2 : 4)))), pitch = deg(Math.max(3, Math.min(40, +g.enroulement || 12)));
  const scale = Rd / 3.2; // (le disque : exponentiel, sa longueur d'échelle)
  for (let k = 0; k < N; k++) {
    const u = r();
    if (type === 'elliptique') {
      // un ellipsoïde de vieilles étoiles, plus dense au centre (profil de Hernquist)
      const s = Rd * 0.35 * Math.sqrt(r()) / (1 - Math.sqrt(r()) * 0.98), th = r() * Math.PI * 2, ph = Math.acos(2 * r() - 1);
      out(at(s * Math.sin(ph) * Math.cos(th), s * Math.sin(ph) * Math.sin(th) * 0.8, s * Math.cos(ph) * 0.6), W_BULGE);
    } else if (u < bulge) {
      const R = Math.abs(gauss(r)) * Rd * 0.08, th = r() * Math.PI * 2;
      out(polar(R, th, gauss(r) * Rd * 0.05), W_BULGE);
    } else if (type === 'irreguliere') {
      // des nuages d'étoiles jeunes, posés au hasard (le même hasard : la graine)
      const c = Math.floor(r() * 7), cr2 = mulberry((+g.graine || 1) * 31 + c), cx = (cr2() - 0.5) * Rd * 1.4, cy = (cr2() - 0.5) * Rd * 1.4, cs = Rd * (0.1 + cr2() * 0.25);
      out(at(cx + gauss(r) * cs, cy + gauss(r) * cs, gauss(r) * thick * 2), W_ARM);
    } else if (type === 'barree' && u < bulge + 0.15) {
      const a = (r() * 2 - 1) * Rd * 0.3;
      out(at(a, gauss(r) * Rd * 0.04, gauss(r) * thick), W_BULGE);
    } else {
      const R = -scale * Math.log(Math.max(1e-9, r()));
      if (R > Rd * 1.3) { k--; continue; }
      const h = gauss(r) * thick * 0.5;
      if (type !== 'lenticulaire' && r() < 0.55) {
        const arm = Math.floor(r() * arms), th = (arm / arms) * Math.PI * 2 + Math.log(Math.max(R, Rd * 0.05) / (Rd * 0.2)) / Math.tan(pitch) + gauss(r) * 0.2;
        out(polar(R, th, h), W_ARM);
      } else out(polar(R, r() * Math.PI * 2, h), W_DISK);
    }
  }
}
// (au catalogue : chaque galaxie, son premier numéro et son nombre d'étoiles)
export const XGALS = [];
export let XG0 = GAL_N;
(function customGalaxies() {
  const names = new Set();
  let n = (XG0 = GAL_N);
  for (const g of XDEFS) {
    const r = mulberry((+g.graine || 1) * 7919 + 17), i0 = n;
    galaxyPoints(g, (x, y, z, type, name) => {
      if (n >= GAL_MAX) return;
      GX[n] = x; GY_[n] = y; GZ[n] = z; GTYPE[n] = type; GSEED[n] = (r() * 4294967296) >>> 0; GFAMOUS[n] = name ? 1 : 0;
      let nm = name || makeName(r), k = 2;
      if (!name) while (names.has(nm)) nm = nm.replace(/ ([IVX]+|\d+)$/, '') + (ROMAN[k++] || ' ' + k);
      names.add(nm); GNAME[n] = nm;
      const c = cellOf(x, y, z);
      if (!GRID.has(c)) GRID.set(c, []);
      GRID.get(c).push(n);
      n++;
    });
    XGALS.push({ id: g.id, nom: g.nom || g.id, def: g, i0, n: n - i0, center: galaxyCenter(g) });
  }
  GAL_N = n;
})();
// La galaxie d'un système du catalogue : null (la Voie lactée), 'and' (Andromède), ou une galaxie ajoutée
export const xgalOf = (i) => (i >= XG0 && i < GAL_N ? XGALS.find((G) => i >= G.i0 && i < G.i0 + G.n) || null : null);
export const galaxyName = (i) => (inAnd(i) ? "la galaxie d'Andromède" : xgalOf(i) ? 'la galaxie ' + xgalOf(i).nom : 'la Voie lactée');

// La description d'un proto-système (voir systemDef) : la protoétoile, son disque de gaz et de
// poussière (proto, voir customsys.js et nebulae.js), et ce qui deviendra ses planètes.
//  - coeur (classe 0) : l'étoile n'est encore qu'un cœur qui s'effondre, dans un épais cocon de gaz ;
//    deux jets de matière partent de ses pôles.
//  - jeune (classe I) : le cocon se dissipe, le disque grandit ; les jets faiblissent.
//  - disque (classe II, une T Tauri) : un grand disque visible, creusé d'anneaux vides là où des
//    embryons de planètes, encore en fusion, balaient la matière (comme HL Tauri).
//  - debris : le gaz est parti ; il reste une ceinture de poussière et de jeunes planètes.
function protoDef(i) {
  const r = mulberry(GSEED[i]), type = TYPES[GTYPE[i]], ST = STAR_TYPES[type], id = gxId(i), name = GNAME[i], ph = GPHASE[i];
  const N = NEBULAE[GNEB[i]], massive = type === 'protoetoile-massive';
  const incl = Math.round(r() * 160 - 80), node = Math.round(r() * 360);
  const P = { phase: PHASES[ph], graine: Math.floor(r() * 1000), inclinaison: incl, noeud: node };
  const embryos = [];
  if (ph === 0) Object.assign(P, { interieur: 0.3, exterieur: 40 + r() * 40, jets: 1, cocon: 1, poussiere: '#b05a2a' });
  else if (ph === 1) Object.assign(P, { interieur: 0.2, exterieur: 80 + r() * 70, jets: 0.65, cocon: 0.45, poussiere: '#c06a32', lacunes: r() < 0.4 ? [[20 + r() * 20, 3]] : [] });
  else if (ph === 2) {
    const out = 120 + r() * 180, gaps = [];
    let a = 4 + r() * 6;
    for (let k = 0, m = 2 + Math.floor(r() * 3); k < m && a < out * 0.8; k++) {
      gaps.push([Math.round(a * 10) / 10, Math.round(a * (0.06 + r() * 0.06) * 10) / 10]);
      embryos.push({ a, molten: true });
      a *= 1.9 + r() * 1.2;
    }
    Object.assign(P, { interieur: 0.1, exterieur: out, jets: 0.25, cocon: 0, poussiere: '#d0844a', lacunes: gaps });
  } else {
    const ring = 50 + r() * 90;
    Object.assign(P, { interieur: ring * 0.75, exterieur: ring * 1.15, jets: 0, cocon: 0, poussiere: '#b8a898' });
    let a = 0.5 + r() * 0.8;
    for (let k = 0, m = 2 + Math.floor(r() * 3); k < m && a < ring * 0.6; k++) { embryos.push({ a, molten: a < 1.5 }); a *= 2 + r() * 2.5; }
  }
  const where = N ? '« ' + N.name + ' »' : 'une nébuleuse';
  const def = {
    id, nom: name, actif: true, galaxie: i,
    description: `${PHASE_NAMES[ph]} dans ${where} : une étoile en train de naître.` + (massive ? ' Une étoile massive : elle vivra peu, et finira sans doute en supernova.' : ''),
    position: { x: GX[i], y: GY_[i], z: GZ[i] },
    etoiles: [{ id, nom: name, type, taille: ST.taille * (ph === 0 ? 1.4 : ph === 3 ? 0.6 : 1) * (0.85 + r() * 0.3), proto: P,
      description: `${ST.nom} — ${PHASE_NAMES[ph]}, dans ${where}.` }],
    planetes: [],
  };
  // (des embryons de planètes : on ne s'y pose pas ; ceux du disque sont encore en fusion)
  embryos.forEach((E, k) => {
    const L = 'cdefgh'[k];
    def.planetes.push({ id: id + '-' + L, nom: name + ' ' + L, type: 'naine', distance: Math.round(E.a * 100) / 100,
      taille: Math.round((0.12 + r() * 0.45) * 100) / 100, sansSol: true, enFusion: E.molten, inclinaisonOrbite: incl, noeudOrbite: node,
      couleurs: E.molten ? { bas: '#2a0806', milieu: '#8a2008', haut: '#ff5a18', sommet: '#ffd070', mer: '#ff4a10' }
        : { bas: '#3a3430', milieu: '#6a5a4c', haut: '#9a8a78', sommet: '#d8d0c8', mer: '#4a4038' },
      description: E.molten ? 'Un embryon de planète, encore en fusion : il grossit en balayant la poussière de son anneau.' : 'Une jeune planète, à peine refroidie.' });
  });
  return def;
}

// ---------- La couleur des bras ----------
// Ce qui dessine les bras spiraux, vus de loin : les étoiles jeunes. Des amas d'étoiles bleues (les
// associations OB : des géantes bleues nées ensemble, qui ne vivent que quelques millions d'années) et
// les nuages de gaz qu'elles allument en rose (les régions H II : l'hydrogène ionisé, la raie Hα).
// Ce ne sont pas des systèmes où aller : une lueur, dessinée de loin (voir skyview.placeArms et
// observatory.js). Leur propre tirage : rien d'autre ne change.
// { n, X, Y, Z (al), K (0 : nuage rose, 1 : amas bleu), S (taille, al), R, TH (autour du centre), ARM }
export const ARM0 = [0.3, 1.87, 3.44, 5.01], ARM_PITCH = deg(12);
export const armTheta = (R, k) => ARM0[k] + Math.log(R / 8000) / Math.tan(ARM_PITCH);
export const ARMFX = (() => {
  const r = mulberry(0xa2f5c0de), n = 5600, F = { n, X: new Float32Array(n), Y: new Float32Array(n), Z: new Float32Array(n), K: new Uint8Array(n), S: new Float32Array(n), R: new Float32Array(n), TH: new Float32Array(n), H: new Float32Array(n) };
  for (let i = 0; i < n; i++) {
    const hii = i < 2200;
    let R, th, z, p;
    for (;;) {
      R = -8500 * Math.log(Math.max(1e-9, r() * r()));
      if (R < 3500 || R > 50000) continue;
      // (les nuages roses : un peu en avant du bras, là où le gaz se tasse en y entrant)
      th = armTheta(R, Math.floor(r() * 4)) + gauss(r) * 0.09 * Math.pow(8000 / R, 0.3) + (hii ? 0.03 : 0);
      z = gauss(r) * (hii ? 90 : 160);
      p = fromCenter(R, th, z);
      if (Math.hypot(p.x, p.y, p.z) > 400) break; // (pas tout contre Hexa)
    }
    F.X[i] = p.x; F.Y[i] = p.y; F.Z[i] = p.z; F.K[i] = hii ? 0 : 1; F.R[i] = R; F.TH[i] = th; F.H[i] = z;
    F.S[i] = hii ? 25 * Math.pow(10, r() * 1.0) : 40 + r() * 120;
  }
  return F;
})();
// (l'angle, autour du centre, d'un point vu dans le repère des bras : voir fromCenter)
export function centerFrame(x, z) {
  const dx = x - CENTER.x, dz = z - CENTER.z;
  return { R: Math.hypot(dx, dz), th: Math.atan2(dx * T.x + dz * T.z, dx * S.x + dz * S.z) };
}

// ---------- Hexa dans Andromède ----------
// Hexa est dans le premier bras d'Andromède (R : sa distance au centre, h : au-dessus du disque). Tout
// ce qui a été tiré dans l'ancien repère est déplacé d'un bloc pour qu'elle soit à l'origine : la Voie
// lactée (étoiles, nébuleuses, bras, Sagittarius A*, le Soleil) et Andromède. Le voisinage d'Hexa
// (à moins de LOCAL al : ses étoiles, ses nébuleuses et leurs proto-systèmes) reste où il est, et
// compte dans Andromède (HOME). Les galaxies ajoutées (src/galaxies) gardent leur place.
export const HEXA_AND = { R: 26000, h: 40 };
HEXA_AND.th = Math.log(HEXA_AND.R / 12000) / Math.tan(deg(8)); // (sur le bras : voir andromeda)
const LOCAL = 1700;
export const HEXA_SHIFT = { x: 0, y: 0, z: 0 }; // (ce qui a été soustrait aux positions du tirage)
(function relocate() {
  const Fr = AND_FRAME, C = AND_CENTER, { R, th, h } = HEXA_AND;
  const P = {
    x: C.x + R * Math.cos(th) * Fr.A1.x + R * Math.sin(th) * Fr.A2.x + h * Fr.N.x,
    y: C.y + R * Math.cos(th) * Fr.A1.y + R * Math.sin(th) * Fr.A2.y + h * Fr.N.y,
    z: C.z + R * Math.cos(th) * Fr.A1.z + R * Math.sin(th) * Fr.A2.z + h * Fr.N.z,
  };
  Object.assign(HEXA_SHIFT, P);
  const local = (x, y, z) => x * x + y * y + z * z < LOCAL * LOCAL;
  const nebLocal = NEBULAE.map((N) => local(N.x, N.y, N.z));
  const mv = (o, kx = 'x', ky = 'y', kz = 'z') => { o[kx] -= P.x; o[ky] -= P.y; o[kz] -= P.z; };
  for (let i = 0; i < XG0; i++) {
    if (i < AND0 && (GNEB[i] >= 0 ? nebLocal[GNEB[i]] : local(GX[i], GY_[i], GZ[i]))) { HOME[i] = 1; continue; }
    GX[i] -= P.x; GY_[i] -= P.y; GZ[i] -= P.z;
  }
  // (les étoiles d'Andromède tombées tout contre Hexa et ses voisins : repoussées à 200 al)
  for (let i = AND0; i < AND0 + AND_N; i++) {
    const d = Math.hypot(GX[i], GY_[i], GZ[i]);
    if (d >= 200) continue;
    const k = d > 1e-6 ? 200 / d : 0;
    if (k) { GX[i] *= k; GY_[i] *= k; GZ[i] *= k; } else GX[i] = 200;
  }
  NEBULAE.forEach((N, k) => { if (!nebLocal[k]) mv(N); });
  for (let i = 0; i < ARMFX.n; i++) { ARMFX.X[i] -= P.x; ARMFX.Y[i] -= P.y; ARMFX.Z[i] -= P.z; }
  mv(CENTER); mv(SOL); mv(AND_CENTER); mv(SGRA_DEF.position);
  GRID.clear();
  for (let i = 0; i < GAL_N; i++) {
    const c = cellOf(GX[i], GY_[i], GZ[i]);
    if (!GRID.has(c)) GRID.set(c, []);
    GRID.get(c).push(i);
  }
})();
// Où est un point (al) dans Andromède : sa distance au centre dans le plan du disque, sa hauteur
// au-dessus, et la région (le bulbe, un bras, l'anneau de feu, le bord)
export function andromedaPlace(p) {
  const F = AND_FRAME, dx = p.x - AND_CENTER.x, dy = p.y - AND_CENTER.y, dz = p.z - AND_CENTER.z;
  const a = dx * F.A1.x + dy * F.A1.y + dz * F.A1.z, b = dx * F.A2.x + dy * F.A2.y + dz * F.A2.z, hh = dx * F.N.x + dy * F.N.y + dz * F.N.z;
  const R = Math.hypot(a, b), th = Math.atan2(b, a);
  let armDist = Infinity;
  if (R > 3500) for (const k of [0, Math.PI]) {
    let d = (th - (k + Math.log(R / 12000) / Math.tan(deg(8)))) % (2 * Math.PI);
    if (d > Math.PI) d -= 2 * Math.PI; else if (d < -Math.PI) d += 2 * Math.PI;
    armDist = Math.min(armDist, Math.abs(d) * R);
  }
  return { R, h: hh, armDist, ring: Math.abs(R - 33000) < 3000 };
}
