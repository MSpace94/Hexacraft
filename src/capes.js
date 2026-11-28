// Capes (comme celles de Minecraft) : portées dans le dos, elles se soulèvent quand on marche.
// Une cape par niveau du compte, de 1 à 100 (on peut porter celles de son niveau et en dessous),
// la cape galaxie des administrateurs (un ciel étoilé qui défile), des capes de champion, des
// capes offertes et des capes de fêtes. Le dessin est une mosaïque d'hexagones, comme les icônes :
// chaque cape est d'abord dessinée sur un patron de 10 x 16 cases (sa taille en pixels de skin),
// puis pavée d'hexagones qui prennent chacun la couleur du patron en leur centre. Les textures
// ne sont pas enregistrées : elles sont faites au premier usage.
//
// Niveaux : 20 matières de 5 niveaux (bois, feuillage, pierre, fer, voltite, platine, fluorite,
// cramoisite, or, ambre, jade, saphir, améthyste, rubis, obsidienne, émeraude, opale, aurore,
// diamant, cosmos), et dans chaque matière : unie, bordée, à bandes, à emblème, puis tout à la
// fois. Le nombre de pastilles en bas donne le rang dans la matière (1 à 5).
//
// Fêtes : chaque cape de fête se porte pendant sa fête. Une fois « réclamée » (voir
// claimFeastCapes), elle reste débloquée toute l'année, comme une cape offerte.
import * as THREE from 'three';
import { characterStyle } from './character.js?v=1.1.0-mx09tneh';

export const MAX_CAPE_LEVEL = 100;
const TIERS = [
  ['Bois', '#7a5230', '#d0a868'],
  ['Feuillage', '#2f6e2a', '#9ad06a'],
  ['Pierre', '#5e5e64', '#c0c0c6'],
  ['Fer', '#8a9098', '#f0f3f6'],
  ['Voltite', '#981c1c', '#ff7a50'],
  ['Platine', '#4a6a82', '#d4ecf8'],
  ['Fluorite', '#1e8e84', '#b0fff0'],
  ['Cramoisite', '#6a1430', '#ff6a8a'],
  ['Or', '#b88412', '#fff2a8'],
  // niveaux 46 à 100
  ['Ambre', '#a8581a', '#ffc060'],
  ['Jade', '#1a7a4a', '#a0ffc8'],
  ['Saphir', '#1a3a9a', '#7ab0ff'],
  ['Améthyste', '#5a2a8a', '#e0a8ff'],
  ['Rubis', '#a0102a', '#ff8090'],
  ['Obsidienne', '#1a1620', '#8a6ad0'],
  ['Émeraude', '#0e6a3a', '#60ff9a'],
  ['Opale', '#6a8aa0', '#fff0ff'],
  ['Aurore', '#2a7a8a', '#ffa0e0'],
  ['Diamant', '#5ab0d0', '#ffffff'],
  ['Cosmos', '#3a2a7a', '#ffd060'],
];
const STEPS = ['unie', 'bordée', 'à bandes', 'à emblème', 'royale'];

// ---------- Fêtes de l'année ----------
const DAY = 864e5;
// Pâques (algorithme de Meeus)
const easter = (y) => {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25),
    g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4,
    l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451), n = h + l - 7 * m + 114;
  return new Date(y, Math.floor(n / 31) - 1, (n % 31) + 1);
};
// période : du jour (m, d) moins `before` jours au même jour plus `after` jours (passe le Nouvel An sans souci)
const around = (m, d, before = 0, after = 0) => (now) => [-1, 0, 1].some((k) => {
  const t = new Date(now.getFullYear() + k, m - 1, d).getTime();
  return now >= t - before * DAY && now < t + (after + 1) * DAY;
});
const aroundEaster = (before, after) => (now) => {
  const t = easter(now.getFullYear()).getTime();
  return now >= t - before * DAY && now < t + (after + 1) * DAY;
};
// [clé, nom, description, période]
const FETES = [
  ['nouvel_an', 'Nouvel An', "Nouvel An (feu d'artifice), du 31 décembre au 3 janvier", around(1, 1, 1, 2)],
  ['valentin', 'Valentin', 'Saint-Valentin (un grand cœur), du 11 au 15 février', around(2, 14, 3, 1)],
  ['avril', 'Poisson', '1er avril (le poisson), du 31 mars au 2 avril', around(4, 1, 1, 1)],
  ['paques', 'Pâques', 'Pâques (un œuf décoré), du vendredi au lundi de Pâques', aroundEaster(2, 1)],
  ['muguet', 'Muguet', 'Fête du Travail (un brin de muguet), du 30 avril au 2 mai', around(5, 1, 1, 1)],
  ['musique', 'Musique', 'Fête de la musique (des notes), du 20 au 22 juin', around(6, 21, 1, 1)],
  ['national', 'Tricolore', 'Fête nationale (le drapeau), du 12 au 15 juillet', around(7, 14, 2, 1)],
  ['halloween', 'Halloween', 'Halloween (une citrouille), du 25 octobre au 1er novembre', around(10, 31, 6, 1)],
  ['noel', 'Noël', 'Noël (un sapin enneigé), du 18 au 27 décembre', around(12, 25, 7, 2)],
];
export const feastOn = (c, now = new Date()) => !!c.feast && c.feast(now);

// [id, nom, niveau requis (0 : aucun), réservée aux administrateurs]
export const CAPES = [
  { id: 'admin', name: 'Galaxie (admin)', desc: 'Cape galaxie, réservée aux administrateurs', level: 0, admin: true },
  ...Array.from({ length: MAX_CAPE_LEVEL }, (_, i) => {
    const t = TIERS[Math.floor(i / 5)], s = i % 5;
    // (name : court, pour le sélecteur de l'écran titre ; desc : en entier, au survol)
    return { id: 'n' + (i + 1), name: `${t[0]} ${i + 1}`, desc: `Cape ${t[0].toLowerCase()} ${STEPS[s]} (niveau ${i + 1})`, level: i + 1 };
  }),
  // capes de champion : le premier d'un classement (égalités comprises), tant qu'il le reste
  ...[['ach', 'Succès'], ['survival_now', 'Survie', 'Survie en cours'], ['survival_best', 'Record', 'Record de survie'], ['play_time', 'Temps', 'Temps de jeu'],
    ['rail_best', 'Rail', 'Plus grand réseau ferré'], ['placed', 'Posés', 'Blocs posés'], ['broken', 'Cassés', 'Blocs cassés'],
    ['train_m', 'Train', 'Distance en train'], ['walk_m', 'Marche', 'Distance à pied'], ['clans', 'Clan', 'Clans']]
    .map(([cat, short, full = short]) => ({ id: 'top_' + cat, name: 'N°1 ' + short, desc: `Cape du N°1 au classement « ${full} » (égalités comprises), tant qu'il le reste`, level: 0, top: cat })),
  // capes de fêtes : portables pendant la fête, puis gardées une fois réclamées (voir claimFeastCapes)
  ...FETES.map(([key, name, desc, feast]) => ({ id: 'fete_' + key, name, desc: 'Cape de fête : ' + desc, level: 0, feast })),
  // capes offertes (par un administrateur, voir supabase/capes.sql)
  { id: 'don_fondateur', name: 'Fondateur', desc: 'Cape offerte : Fondateur (le blason hexagonal de HexaCraft)', level: 0, gift: true },
  { id: 'don_amitie', name: 'Amitié', desc: 'Cape offerte : Amitié (une pluie de cœurs)', level: 0, gift: true },
  { id: 'don_etoile', name: 'Étoile', desc: "Cape offerte : Étoile (une étoile d'or dans la nuit)", level: 0, gift: true },
  { id: 'don_industry', name: 'Industry', desc: "Cape offerte : Industry (l'engrenage de la version 1.1 Industry)", level: 0, gift: true },
  // capes du carnet d'exploration (voir exploration.js) : gagnées en découvrant des biomes et des étoiles
  { id: 'carnet_explorateur', name: 'Explorateur', desc: "Cape du carnet : Explorateur (une boussole), 25 biomes d'autres planètes découverts", level: 0, journal: true },
  { id: 'carnet_cartographe', name: 'Cartographe', desc: 'Cape du carnet : Cartographe des mondes (une carte aux biomes), 75 biomes découverts', level: 0, journal: true },
  { id: 'carnet_naturaliste', name: 'Naturaliste', desc: "Cape du carnet : Naturaliste (une fleur de cristal), tous les biomes des autres planètes", level: 0, journal: true },
  { id: 'carnet_etoiles', name: "Chasseur d'étoiles", desc: "Cape du carnet : Chasseur d'étoiles (une constellation), 5 étoiles célèbres atteintes", level: 0, journal: true },
];
const BY_ID = new Map(CAPES.map((c) => [c.id, c]));
// (nom reçu en multijoueur : seulement une cape qui existe)
export const capeName = (s) => (typeof s === 'string' && BY_ID.has(s) ? s : '');
// Les capes qu'on peut porter : celles de son niveau et en dessous, celles qu'on nous a offertes ou
// qu'on a réclamées (owned), celles des classements où l'on est premier (tops), celles de la fête
// en cours ; un admin les a toutes
export const capesFor = (level, admin, owned = new Set(), tops = [], now = new Date()) => CAPES.filter((c) =>
  admin || owned.has(c.id) || (c.top ? tops.includes(c.top) : c.feast ? c.feast(now) : !c.admin && !c.gift && !c.journal && level >= c.level));
// (celles qu'un administrateur peut offrir : toutes sauf la galaxie)
export const giftableCapes = () => CAPES.filter((c) => !c.admin);
export const capeInfo = (id) => BY_ID.get(id) || null;

// ---------- Les capes du carnet d'exploration (sur cet appareil, comme les capes de fêtes) ----------
const JOURNAL_KEY = 'hexacraft_carnet_capes';
export function journalCapes() {
  try { const l = JSON.parse(localStorage.getItem(JOURNAL_KEY) || '[]'); return Array.isArray(l) ? l.filter((id) => BY_ID.get(id)?.journal) : []; } catch { return []; }
}
// Gagnée : vrai si elle est nouvelle
export function grantJournalCape(id) {
  if (!BY_ID.get(id)?.journal) return false;
  const l = journalCapes();
  if (l.includes(id)) return false;
  l.push(id);
  try { localStorage.setItem(JOURNAL_KEY, JSON.stringify(l)); } catch { /* tant pis */ }
  return true;
}

// ---------- Déblocage définitif des capes de fêtes ----------
// Les ids des capes de fêtes dont la fête a lieu maintenant
export const feastCapesNow = (now = new Date()) => CAPES.filter((c) => feastOn(c, now)).map((c) => c.id);
const FEAST_KEY = 'hexacraft_fete_capes';
// À appeler au lancement du jeu : enregistre les capes de la fête en cours (sur cet appareil) et
// renvoie toutes les capes de fêtes déjà réclamées ; à fusionner avec `owned` avant capesFor :
//   const owned = new Set([...ownedFromServer, ...claimFeastCapes()]);
// (pour les garder sur le compte, enregistre aussi feastCapesNow() côté Supabase, comme un cadeau)
export function claimFeastCapes(now = new Date()) {
  let saved = [];
  try { saved = JSON.parse(localStorage.getItem(FEAST_KEY) || '[]'); } catch { saved = []; }
  const all = new Set(Array.isArray(saved) ? saved.filter((id) => BY_ID.get(id)?.feast) : []);
  const before = all.size;
  for (const id of feastCapesNow(now)) all.add(id);
  if (all.size !== before) { try { localStorage.setItem(FEAST_KEY, JSON.stringify([...all])); } catch { /* stockage indisponible */ } }
  return all;
}

// ---------- Dessin ----------
const hex = (s) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const shade = (c, k) => c.map((v) => Math.max(0, Math.min(255, v * k)));
const hash = (a, b, s = 0) => { let h = (a * 374761393 + b * 668265263 + s * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
// bruit doux (pour la nébuleuse)
function noise(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

// Patron d'une cape de niveau (x de 0 à 10, y de 0 à 16, le haut en y = 0) : la couleur en (x, y)
function levelPattern(level) {
  const i = level - 1, [, b, a] = TIERS[Math.floor(i / 5)], s = i % 5;
  const base = hex(b), acc = hex(a), dark = shade(base, 0.55);
  const legend = level === MAX_CAPE_LEVEL;
  return (x, y) => {
    let c = mix(shade(base, 1.08), shade(base, 0.82), y / 16); // (plus sombre vers le bas)
    const border = x < 1 || x > 9 || y > 15;
    if (s >= 1 && border) return legend ? hex('#1a1410') : acc;
    if (s >= 1 && (x < 1.6 || x > 8.4 || y > 14.4)) c = dark; // (liseré sombre sous la bordure)
    if ((s === 2 || s === 4) && (Math.abs(y - 3) < 0.6 || Math.abs(y - 11) < 0.6)) c = mix(c, acc, 0.85);
    if (s >= 3) {
      // emblème : un hexagone au milieu, cœur sombre (et une pointe de lumière pour la royale)
      const dx = Math.abs(x - 5), dy = Math.abs(y - 7.2), r = 2.5;
      const inHex = (k) => dx <= r * k * 0.866 && dy <= r * k - dx * 0.577;
      if (inHex(1)) c = inHex(0.62) ? (s === 4 ? mix(acc, [255, 255, 255], 0.35) : dark) : acc;
    }
    if (s === 4 && !border && y < 6 && Math.abs(x - 5) > 2.6 && (Math.floor(x + y) % 3 === 0)) c = mix(c, acc, 0.5); // chevrons
    // pastilles du rang (1 à 5) en bas
    if (y > 12.6 && y < 13.8) for (let k = 0; k <= s; k++) if (Math.abs(x - (5 - s * 0.8 + k * 1.6)) < 0.5) return legend ? hex('#1a1410') : acc;
    return c;
  };
}
// Galaxie : une nébuleuse violette et bleue, des étoiles ; le patron fait deux capes de haut (il
// défile en boucle, voir swingCape), et il se raccorde en haut et en bas
function galaxyPattern() {
  const H = 32;
  return (x, y) => {
    const t = y / H, ang = t * Math.PI * 2;
    // (bruit sur un cylindre en y : pas de couture quand le motif boucle)
    const n = (sx) => noise(x * 0.35 + sx, Math.cos(ang) * 3 + 10, 1) * 0.5 + noise(x * 0.7 + sx, Math.sin(ang) * 6 + 20, 2) * 0.3 + noise(x * 1.4, Math.cos(ang) * 10 + Math.sin(ang) * 4, 3) * 0.2;
    const neb = n(0), arm = n(7);
    let c = mix([8, 6, 26], [46, 18, 92], Math.min(1, neb * 1.3));
    c = mix(c, [40, 90, 200], Math.max(0, arm - 0.5) * 1.6);
    c = mix(c, [220, 90, 200], Math.max(0, neb - 0.68) * 2.2);
    const cx = Math.floor(x * 1.6), cy = Math.floor(y * 1.6), st = hash(cx, cy % Math.floor(H * 1.6), 9);
    if (st > 0.975) c = mix([255, 255, 255], [170, 220, 255], hash(cx, cy, 10));
    else if (st > 0.955) c = mix(c, [255, 240, 210], 0.6);
    return c;
  };
}

// ---------- Capes de champion, capes offertes et capes de fêtes ----------
// Un dessin en cases (10 x 16, '.' : le fond) avec sa palette, sur un fond en dégradé ; bordure
// d'or pour les champions, d'argent pour les capes offertes, propre à chaque fête (rim)
const ART = {
  // trophée d'or (succès)
  ach: { bg: ['#4a2488', '#1c0c3a'], pal: { Y: '#f2c230', y: '#fff3a0', D: '#8a5a10' }, rows: [
    '..........', '..........', '.YYYYYYYY.', '.YyYYYYYY.', '.YyYYYYYY.', '.YyYYYYYY.', '..YYYYYY..', '...YYYY...',
    '....YY....', '....YY....', '...YYYY...', '..DDDDDD..', '..DDDDDD..', '..........', '..........', '..........'] },
  // cœur qui bat (survie en cours)
  survival_now: { bg: ['#1f4a22', '#0c200e'], pal: { R: '#e02838', r: '#ff9aa0', G: '#7dff8a' }, rows: [
    '..........', '..........', '..........', '.RRR..RRR.', 'RRrRRRRRRR', 'RrRRRRRRRR', 'RRRRRRRRRR', '.RRRRRRRR.',
    '..RRRRRR..', '...RRRR...', '....RR....', '..........', '......G...', 'GGGG.G.GGG', '....G.....', '..........'] },
  // cœur d'or couronné (record de survie)
  survival_best: { bg: ['#5a1018', '#22060a'], pal: { Y: '#f2c230', y: '#fff3a0', C: '#e8e8f0' }, rows: [
    '..........', '.C.C..C.C.', '.CCCCCCCC.', '.CCCCCCCC.', '..........', '.YYY..YYY.', 'YYyYYYYYYY', 'YyYYYYYYYY',
    'YYYYYYYYYY', '.YYYYYYYY.', '..YYYYYY..', '...YYYY...', '....YY....', '..........', '..........', '..........'] },
  // sablier (temps de jeu)
  play_time: { bg: ['#1c3a6a', '#0a1830'], pal: { W: '#9a6a3a', G: '#bfe6ff', S: '#f0d070' }, rows: [
    '..........', '..........', '.WWWWWWWW.', '..G....G..', '..GSSSSG..', '...GSSG...', '....SS....', '....S.....',
    '...GS.G...', '..G....G..', '..G.SS.G..', '..GSSSSG..', '.WWWWWWWW.', '..........', '..........', '..........'] },
  // locomotive (distance en train)
  train_m: { bg: ['#3a4a5a', '#151c24'], pal: { L: '#c03028', C: '#28303a', w: '#9ad8ff', y: '#ffe08a', D: '#202020', O: '#3a3a3a', I: '#c8ccd2' }, rows: [
    '..........', '..........', '..CCCCCC..', '.CwwwwwwC.', '.CwwwwwwC.', '.CCCCCCCC.', '.LLLLLLLL.', '.LyLLLLyL.',
    '.LLLLLLLL.', '.DDDDDDDD.', '..O....O..', '..I....I..', '.I......I.', '.I......I.', 'I........I', '..........'] },
  // pioche sur des pierres en éclats (blocs cassés)
  broken: { bg: ['#34343c', '#121216'], pal: { P: '#d8dde4', H: '#8a5a30', S: '#8a8a90', s: '#c0c0c6' }, rows: [
    '..........', '..........', '..........', '..PPPPPP..', '.PP.HH.PP.', '.P..HH..P.', '....HH....', '....HH....',
    '....HH....', '....HH....', '..........', '.SS....SS.', 'SSs..S.sSS', '.S.SS.S...', '..S..S..S.', '..........'] },
  // traces de pas (distance à pied)
  walk_m: { bg: ['#a07a40', '#5a4020'], pal: { P: '#3a2810' }, rows: [
    '..........', '..PP......', '.PPP......', '.PPP......', '..P....PP.', '......PPP.', '......PPP.', '..PP...P..',
    '.PPP......', '.PPP......', '..P....PP.', '......PPP.', '......PPP.', '.......P..', '..........', '..........'] },
  // blason à la croix (clans)
  clans: { bg: ['#14504a', '#06201e'], pal: { M: '#d8dde4', R: '#c02830', B: '#1c3c8a' }, rows: [
    '..........', '..........', '.MMMMMMMM.', '.MBBRRBBM.', '.MBBRRBBM.', '.MRRRRRRM.', '.MRRRRRRM.', '.MBBRRBBM.',
    '..MBRRBM..', '..MBRRBM..', '...MRRM...', '....MM....', '..........', '..........', '..........', '..........'] },
};
// (les autres : dessinés par une fonction de (x, y) ; null : le fond)
const DRAW = {
  // boussole (Explorateur)
  carnet_explorateur: { bg: ['#2a5a3a', '#0e2416'], rim: '#c8a060', f: (x, y) => {
    const dx = x - 5, dy = y - 7.5, d = Math.hypot(dx, dy);
    if (d > 3.9 && d < 4.6) return hex('#e0c080');
    if (d < 3.9) {
      const a = Math.atan2(dy, dx), n = Math.abs(dx) < 0.9 - Math.abs(dy) * 0.25 && Math.abs(dy) < 3.4;
      if (n) return dy < 0 ? hex('#e04030') : hex('#f0f0f0');
      return Math.abs(Math.sin(a * 4)) < 0.12 && d > 2.8 ? hex('#c8a060') : hex('#1a3a24');
    }
    return null;
  } },
  // carte aux biomes (Cartographe)
  carnet_cartographe: { bg: ['#6a5030', '#2e2010'], rim: '#e0d0a0', f: (x, y) => {
    if (x < 1.4 || x > 8.6 || y < 2 || y > 13.5) return null;
    const v = Math.sin(x * 1.3 + Math.sin(y * 0.7) * 1.8) + Math.cos(y * 0.9 - x * 0.4);
    if (Math.abs(x - 5.6 - Math.sin(y * 0.8)) < 0.35) return hex('#3a7ac8');
    return hex(v > 1 ? '#b46034' : v > 0.2 ? '#5a9a3a' : v > -0.6 ? '#e0c070' : '#8ad8ff');
  } },
  // fleur de cristal (Naturaliste)
  carnet_naturaliste: { bg: ['#3a1a5a', '#120820'], rim: '#a0f0ff', f: (x, y) => {
    const dx = x - 5, dy = y - 6.5, d = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
    if (y > 9 && Math.abs(x - 5 - Math.sin(y) * 0.3) < 0.35) return hex('#5ad8a0');
    if (d < 1) return hex('#ffe0f4');
    if (d < 3.6 && Math.cos(a * 5) > 0.2 + d * 0.12) return hex(d < 2.2 ? '#a0f0ff' : '#5ab8ff');
    return null;
  } },
  // constellation (Chasseur d'étoiles)
  carnet_etoiles: { bg: ['#101a40', '#04060e'], rim: '#ffd060', f: (x, y) => {
    const S = [[2.2, 3], [4.6, 4.4], [6.8, 3.2], [7.6, 7], [5, 9.5], [3, 12.5], [7.2, 13]];
    for (const [sx, sy] of S) if (Math.hypot(x - sx, y - sy) < 0.6) return hex('#fff4c0');
    for (let i = 0; i + 1 < S.length; i++) {
      const [ax, ay] = S[i], [bx, by] = S[i + 1], t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2)));
      if (Math.hypot(x - ax - t * (bx - ax), y - ay - t * (by - ay)) < 0.18) return hex('#8aa0d8');
    }
    return hash(Math.floor(x * 1.5), Math.floor(y * 1.5), 9) > 0.95 ? hex('#c8d0ff') : null;
  } },
  // voie ferrée qui file tout du long (plus longue voie)
  rail_best: { bg: ['#6a645a', '#2e2a26'], f: (x, y) => (Math.abs(x - 3.2) < 0.45 || Math.abs(x - 6.8) < 0.45 ? hex('#c8ccd2') : (y % 3) < 1.1 && x > 1.4 && x < 8.6 ? hex('#7a4a22') : null) },
  // pyramide de blocs (blocs posés)
  placed: { bg: ['#3a78b0', '#183a5c'], f: (x, y) => {
    const row = Math.floor((y - 4) / 2), n = row + 1, x0 = 5 - n;
    if (row < 0 || row > 3 || x < x0 || x >= x0 + n * 2) return null;
    const k = Math.floor((x - x0) / 2) + row;
    return hex(['#5aa83a', '#9a9aa0', '#a8743a', '#b04a30'][k % 4]);
  } },
  // blason hexagonal (Fondateur)
  don_fondateur: { bg: ['#1a3a8a', '#0a1840'], f: (x, y) => {
    const dx = Math.abs(x - 5), dy = Math.abs(y - 7), hx = (r) => dx <= r * 0.866 && dy <= r - dx * 0.577;
    return hx(3.4) ? (hx(2.5) ? (hx(1.3) ? hex('#ffffff') : hex('#4aa8ff')) : hex('#ffffff')) : null;
  } },
  // pluie de cœurs (Amitié)
  don_amitie: { bg: ['#d84a8a', '#7a1a48'], f: (x, y) => {
    const cy = Math.floor(y / 4), ox = cy % 2 ? 2.5 : 0, lx = ((x + ox) % 5) - 2.5, ly = (y % 4) - 1.6;
    const heart = (lx * lx + (ly - Math.sqrt(Math.abs(lx)) * 0.9) ** 2) < 1.4;
    return heart ? hex('#ffe0ee') : null;
  } },
  // étoile d'or (Étoile)
  don_etoile: { bg: ['#101a48', '#04061a'], f: (x, y) => {
    const dx = x - 5, dy = y - 7, a = Math.atan2(dy, dx), r = Math.hypot(dx, dy);
    const edge = 1.5 + 1.9 * Math.pow(Math.abs(Math.cos(2.5 * (a + Math.PI / 2))), 3);
    if (r < edge) return r < 1 ? hex('#fff6c0') : hex('#f2c230');
    return hash(Math.floor(x * 1.5), Math.floor(y * 1.5), 4) > 0.95 ? hex('#ffffff') : null;
  } },
  // engrenage (Industry)
  don_industry: { bg: ['#d8701c', '#7a3408'], f: (x, y) => {
    const dx = x - 5, dy = y - 7, a = Math.atan2(dy, dx), r = Math.hypot(dx, dy);
    const tooth = Math.cos(a * 8) > 0.35 ? 3.6 : 2.9;
    if (r < 1.1) return null;
    return r < tooth ? (r < 1.7 ? hex('#5a5e66') : hex('#c8ccd2')) : null;
  } },

  // ---- fêtes (clé = id sans « fete_ ») ----
  // feu d'artifice (Nouvel An)
  nouvel_an: { bg: ['#0a1030', '#02040e'], rim: '#ffd040', f: (x, y) => {
    const b = (cx, cy, r0, r1, n, col) => { const dx = x - cx, dy = y - cy, r = Math.hypot(dx, dy); return r > r0 && r < r1 && Math.cos(Math.atan2(dy, dx) * n) > 0.55 ? hex(col) : null; };
    return (Math.hypot(x - 5, y - 6) < 0.9 ? hex('#ffffff') : null) || b(5, 6, 1.2, 4.2, 8, '#ffd040') || b(2.2, 12, 0.6, 2, 6, '#ff6aa8') || b(7.8, 12.2, 0.6, 2, 6, '#6ad8ff');
  } },
  // grand cœur (Saint-Valentin)
  valentin: { bg: ['#7a1a3a', '#2a0614'], rim: '#ffb0c0', f: (x, y) => {
    const X = (x - 5) / 3.3, Y = (7.8 - y) / 3.0;
    if ((X * X + Y * Y - 1) ** 3 - X * X * Y ** 3 >= 0) return null;
    return (x - 3.6) ** 2 + (y - 6) ** 2 < 0.6 ? hex('#ffb0c0') : hex('#ff3a5a');
  } },
  // poisson (1er avril)
  avril: { bg: ['#2a7ab0', '#0a2a50'], rim: '#ffb030', f: (x, y) => {
    if (Math.hypot(x - 3, y - 7.3) < 0.45) return hex('#101010');
    if (Math.abs(x - 5.6) < 0.35 && ((x - 4.6) / 3.2) ** 2 + ((y - 8) / 2) ** 2 < 1) return hex('#ff6a20');
    if (((x - 4.6) / 3.2) ** 2 + ((y - 8) / 2) ** 2 < 1) return hex('#ffb030');
    if (x > 7.3 && x < 9.2 && Math.abs(y - 8) < (x - 7.3) * 1.2 + 0.2) return hex('#ff8a20');
    return Math.abs(Math.hypot(x - 6, y - 4) - 0.7) < 0.25 || Math.abs(Math.hypot(x - 3.4, y - 3) - 0.5) < 0.22 ? hex('#bfe6ff') : null;
  } },
  // œuf décoré (Pâques)
  paques: { bg: ['#7ac86a', '#2f6a2a'], rim: '#ffe060', f: (x, y) => {
    const rx = 2.7 * (y < 8.2 ? 0.85 : 1);
    if (((x - 5) / rx) ** 2 + ((y - 8.2) / 3.7) ** 2 >= 1) return null;
    if (Math.abs(y - 7.6) < 0.5) return hex('#ffe060');
    if (Math.abs(y - 10) < 0.5 && Math.floor(x * 2) % 2 === 0) return hex('#ffffff');
    return hex('#c070e0');
  } },
  // brin de muguet (fête du Travail)
  muguet: { bg: ['#3a8a5a', '#1a4a30'], rim: '#ffffff', f: (x, y) => {
    for (const [cx, cy] of [[3.9, 5], [6.2, 6.4], [4, 7.8], [6.1, 9.2]]) if (Math.hypot(x - cx, y - cy) < 0.7) return hex('#ffffff');
    if (((x - 3.3) / 1.0) ** 2 + ((y - 12) / 2.4) ** 2 < 1 || ((x - 6.7) / 1.0) ** 2 + ((y - 12) / 2.4) ** 2 < 1) return hex('#3ab04a');
    return y > 3 && y < 14 && Math.abs(x - (5 + 0.6 * Math.sin(y * 0.5))) < 0.3 ? hex('#7ae08a') : null;
  } },
  // notes de musique (fête de la musique)
  musique: { bg: ['#3a1a7a', '#12062e'], rim: '#ffd040', f: (x, y) => {
    if (((x - 3) / 1.5) ** 2 + ((y - 11.5) / 1.0) ** 2 < 1 || ((x - 7.5) / 1.5) ** 2 + ((y - 10.5) / 1.0) ** 2 < 1) return hex('#ffffff');
    if ((Math.abs(x - 4.2) < 0.3 && y > 4.4 && y < 11.5) || (Math.abs(x - 8.7) < 0.3 && y > 3.6 && y < 10.5)) return hex('#ffffff');
    return x > 3.9 && x < 9 && y > 4.3 - (x - 3.9) * 0.15 && y < 5.5 - (x - 3.9) * 0.15 ? hex('#ffd040') : null;
  } },
  // drapeau qui ondule (fête nationale)
  national: { bg: ['#1c3c9a', '#1c3c9a'], rim: '#ffd040', f: (x, y) => {
    const w = Math.sin(y * 0.7) * 0.4;
    return x + w < 3.3 ? hex('#1c3c9a') : x + w < 6.7 ? hex('#f4f4f8') : hex('#d02830');
  } },
  // citrouille (Halloween)
  halloween: { bg: ['#2a1048', '#0a0418'], rim: '#f08018', f: (x, y) => {
    if (Math.abs(x - 5) < 0.4 && y > 4.3 && y < 5.4) return hex('#3a7a2a');
    if (((x - 5) / 3.6) ** 2 + ((y - 8.5) / 3.2) ** 2 >= 1) return null;
    const dx = Math.abs(x - 5);
    if ((dx > 0.9 && dx < 2.2 && y > 7 && y < 8.3) || (dx < 2.3 && y > 9.7 && y < 10.9)) return hex('#ffd040');
    return hex('#f08018');
  } },
  // sapin enneigé (Noël)
  noel: { bg: ['#0e2a4a', '#04101e'], rim: '#e04040', f: (x, y) => {
    const dx = Math.abs(x - 5);
    if (Math.abs(y - 1.6) < 0.7 && dx < 0.7) return hex('#ffe060');
    if (y >= 12 && y < 14 && dx < 0.8) return hex('#7a4a22');
    let tree = false;
    for (const [y0, y1, w] of [[2, 6, 1.8], [5, 9, 2.4], [8, 12, 3]]) if (y >= y0 && y < y1 && dx <= ((y - y0) / (y1 - y0)) * w + 0.5) tree = true;
    if (tree) return hash(Math.floor(x * 1.2), Math.floor(y * 1.2), 3) > 0.9 ? hex('#ff4040') : hex('#2f9a3a');
    return hash(Math.floor(x * 1.5), Math.floor(y * 1.5), 6) > 0.94 ? hex('#ffffff') : null;
  } },
};
function specialPattern(id) {
  const key = id.replace(/^(top|don|fete)_/, ''), art = ART[key], draw = DRAW[key] || DRAW[id];
  const def = art || draw, gift = id.startsWith('don_');
  const [b0, b1] = def.bg.map(hex), rim = hex(def.rim || (gift ? '#d8dde4' : '#f2c230'));
  return (x, y) => {
    if (x < 0.55 || x > 9.45 || y > 15.45) return rim; // (bordure : or, argent pour un cadeau, propre à une fête)
    let c = null;
    if (art) { const ch = art.rows[Math.min(15, Math.floor(y))]?.[Math.min(9, Math.floor(x))]; if (ch && ch !== '.') c = hex(art.pal[ch]); } else c = draw.f(x, y);
    return c || mix(b0, b1, y / 16);
  };
}

const RES = 16, HEX = 32 / 75; // (pixels de la texture par case du patron ; rayon d'un hexagone, en cases : 25 rangées doubles font 32 cases, la galaxie boucle sans couture)
function hexCenter(x, y, s) {
  const q = (Math.sqrt(3) / 3 * x - y / 3) / s, r = (2 / 3 * y) / s;
  let rx = Math.round(q), rz = Math.round(r); const ry = Math.round(-q - r);
  const dx = Math.abs(rx - q), dz = Math.abs(rz - r), dy = Math.abs(ry + q + r);
  if (dx > dy && dx > dz) rx = -ry - rz; else if (dy <= dz) rz = -rx - ry;
  return [s * Math.sqrt(3) * (rx + rz / 2), s * 1.5 * rz, rx * 131 + rz];
}
// Mosaïque d'hexagones d'un patron de w x h cases
function mosaic(pattern, w, h) {
  const c = document.createElement('canvas');
  c.width = w * RES; c.height = h * RES;
  const ctx = c.getContext('2d'), img = ctx.createImageData(c.width, c.height), d = img.data;
  for (let Y = 0; Y < c.height; Y++) for (let X = 0; X < c.width; X++) {
    const [cx, cy, id] = hexCenter((X + 0.5) / RES, (Y + 0.5) / RES, HEX);
    const col = shade(pattern(Math.min(w - 0.01, Math.max(0, cx)), ((cy % h) + h) % h), 0.88 + hash(id, 0, 5) * 0.2);
    const o = (Y * c.width + X) * 4;
    d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}
const textures = new Map();
function capeTexture(id) {
  if (textures.has(id)) return textures.get(id);
  const galaxy = id === 'admin';
  const tex = new THREE.CanvasTexture(galaxy ? mosaic(galaxyPattern(), 10, 32) : /^n\d+$/.test(id) ? mosaic(levelPattern(+id.slice(1)), 10, 16) : mosaic(specialPattern(id), 10, 16));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  if (galaxy) { tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(1, 0.5); }
  textures.set(id, tex);
  return tex;
}
// (l'image d'une cape, à plat : pour l'afficher dans une liste)
export const capeImage = (id) => (capeName(id) ? capeTexture(id).image : null);
const materials = new Map();
function capeMaterial(id) {
  if (materials.has(id)) return materials.get(id);
  const map = capeTexture(id);
  // (la galaxie brille un peu dans le noir)
  const m = id === 'admin'
    ? new THREE.MeshLambertMaterial({ map, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: 0.55 })
    : new THREE.MeshLambertMaterial({ map });
  materials.set(id, m);
  return m;
}

// ---------- Sur le personnage ----------
const PX = 1.8 / 32; // (comme character.js)
let geo = null;
// Met la cape id ('' : aucune) dans le dos du personnage (ses parties, voir buildCharacter) ;
// box : personnage en pavés (dos plat, plus près du centre)
export function setCape(parts, id, box = characterStyle() === 'box') {
  const body = parts?.body;
  if (!body) return;
  if (body.userData.cape) { body.remove(body.userData.cape); body.userData.cape = null; }
  if (!capeName(id)) return;
  // une plaque de 10 x 16 pixels, pendue par son bord du haut (le pivot), en haut du dos
  geo ||= new THREE.BoxGeometry(10 * PX, 16 * PX, 0.6 * PX).translate(0, -8 * PX, 0);
  const pivot = new THREE.Group();
  pivot.position.set(0, 12 * PX, (box ? 2.55 : 2.85) * PX);
  const mesh = new THREE.Mesh(geo, capeMaterial(id));
  mesh.castShadow = true;
  mesh.userData.skin = true; mesh.userData.body = true;
  pivot.add(mesh);
  body.add(pivot);
  body.userData.cape = pivot;
}
// Balancement : la cape se soulève avec la vitesse (blocs/s), et ondule un peu ; la galaxie défile
export function swingCape(parts, speed, dt = 0.016) {
  const cape = parts?.body?.userData.cape;
  if (!cape) return;
  const t = performance.now() / 1000;
  const want = 0.08 + Math.min(1, speed / 6) * 0.9 + Math.sin(t * (2 + speed)) * (0.03 + Math.min(speed, 6) * 0.012);
  cape.rotation.x += (-want - cape.rotation.x) * Math.min(1, dt * 6);
  const tex = textures.get('admin');
  if (tex) tex.offset.y = (t * 0.025) % 1;
}
