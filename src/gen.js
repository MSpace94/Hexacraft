// Génération du monde à partir d'une graine.
//  - "flat"   : bedrock, 2 terre, herbe
//  - "tutorial" : le vide de l'espace, et la station du tutoriel (voir station.js)
//  - "normal" : depuis HexaCraft 0.7 (version 3 du générateur), un monde de continents
//    et de supercontinents séparés par des mers et des océans, avec des chaînes de
//    montagnes, des vallées, des rivières, des lacs et des biomes (plaines, forêts,
//    plages, rivières, lacs, mers, océans ; déserts et plaines enneigées selon le climat
//    depuis la version 5 ; volcans depuis la version 6). Les mondes plus anciens (versions 1 et 2)
//    gardent leur relief au bruit simplex d'origine.
// Tout est déterministe : la même graine donne toujours le même monde, ce qui permet
// de ne sauvegarder que les blocs modifiés par le joueur.
import { hexToWorld, worldToHex } from './hex.js?v=1.1.5-alpha-mvm2b95g';
import { RUINS } from './ruins.js?v=1.1.5-alpha-mvm2b95g';
import { stationBlock, stationColumn, SPOTS, Y0 as STATION_Y } from './station.js?v=1.1.5-alpha-mvm2b95g';

export const AIR = 0, GRASS = 1, DIRT = 2, STONE = 3, BEDROCK = 4, LOG = 5, LEAVES = 6, WATER = 7, SAND = 8, COAL = 30;
export const SNOW_GRASS = 36, SNOW = 37, CACTUS = 38, SNOW_LEAVES = 39;
export const CHESTNUT_LOG = 97, CHESTNUT_LEAVES = 98, LINDEN_LOG = 152, LINDEN_LEAVES = 153;
export const BIRCH_LOG = 256, BIRCH_LEAVES = 257, DIORITE = 261;
export const IRON_ORE = 60, VOLTITE_ORE = 61;
const PLATINUM_ORE = 83, TUNGSTEN_ORE = 85, IMPURE_VOLTITE_ORE = 87;
export const FLUORITE_ORE = 640, CRIMSONITE_ORE = 642;
// Mines abandonnées (voir mineIn) : rails de train (un id par axe de la voie, voir tracks.js),
// coffres, étais, lampes
const MINE_TRACKS = [456, 473, 474];
const PLANKS = 18, CHEST_ID = 54, LAMP_OFF = 94, GRAVEL_ID = 244;
// Grottes des Hexaliens (voir hexCaveIn) : sol de mousse, parois de roche à lichen, champignons lumineux
const MOSS_ID = 618, LICHEN_ID = 616, GLOW_FUNGUS = 611;
const HCAVE = 56; // une grotte au plus par zone de HCAVE x HCAVE cases
export const BASALT = 68, ASH = 69, SULFUR = 70, TUFF = 71, LAVA = 72, MAGMA = 73, OBSIDIAN = 74;
// Hauteur du monde (blocs). Depuis HexaCraft 0.8.6, le monde est surélevé (voir RAISED) ; les
// endroits déjà visités restent générés comme avant (86 de haut pour les mondes de la version 6
// du générateur, 64 avant), mais on peut y construire jusqu'en haut.
export const WORLD_HEIGHT = 156;
// Profondeurs (HexaCraft alpha 1.2) : le monde descend jusqu'en -DEPTH (bedrock tout au fond),
// avec des lacs de lave souterrains et les minerais rares (voir deepBlock). Les chunks créés
// avant gardent leur bedrock en 0, percée de brèches (voir breachAt) pour descendre.
export const DEPTH = 80;
export const DEEP_GEN = 12; // version du contenu des chunks sans bedrock en 0 (voir GEN_CONTENT)
// Monde plat : depuis les profondeurs, un nouveau monde plat (version FLAT_LOW du générateur) est
// posé tout en bas (bedrock en -DEPTH, 2 terre, herbe). Un ancien garde sa bedrock en 0 ; dessous,
// de l'air, un second monde plat tout en bas et des piliers de bedrock qui les relient.
export const FLAT_LOW = 7;
export const FLAT_LOW_Y = 3 - DEPTH; // hauteur de l'herbe d'un monde plat d'en bas
const V6_HEIGHT = 86, LEGACY_HEIGHT = 64;
export const SEA = 20; // niveau de la mer (mondes v1/v2) : l'eau remplit les creux jusqu'ici
export const SEA3 = 24; // niveau de la mer des mondes v3 (océans plus profonds)
export const SEA_HIGH = 64; // niveau de la mer du monde surélevé (HexaCraft 0.8.6)

// Biomes (mondes v3)
export const BIOME = { OCEAN: 0, SEA: 1, BEACH: 2, PLAINS: 3, FOREST: 4, MOUNTAIN: 5, RIVER: 6, LAKE: 7, DESERT: 8, SNOWY: 9, VOLCANO: 10, BIG_FOREST: 11, EURO_FOREST: 12 };
export const BIOME_NAMES = ['Océan', 'Mer', 'Plage', 'Plaines', 'Forêt', 'Montagnes', 'Rivière', 'Lac', 'Désert', 'Plaines enneigées', 'Volcan', 'Grande forêt', 'Forêt européenne'];
// couleurs des biomes sur la carte du monde
export const BIOME_COLORS = [
  [24, 52, 122], [44, 96, 176], [226, 212, 148], [128, 188, 84],
  [46, 118, 44], [136, 128, 118], [64, 140, 226], [72, 156, 232],
  [222, 198, 124], [226, 238, 244], [78, 58, 56], [26, 84, 32], [92, 128, 44],
];

// Version du générateur des nouveaux mondes :
//   3 = HexaCraft 0.7 (continents, biomes)
//   4 = HexaCraft 0.7 (amas de continents séparés par des méga-océans)
//   5 = HexaCraft 0.7 (climat : déserts, plaines enneigées, sommets enneigés)
//   6 = HexaCraft 0.7 (volcans, monde de 86 blocs de haut)
export const GEN_LATEST = 6;

// Colonne en cache : hauteur (bits 0-7), biome (bits 8-11), drapeaux (bits 12-13 :
// 1 = neige sur le sommet, 2 = lac de lave du cratère), eau glaciale (bit 14), mer basse
// (bit 15 : le pied de l'anneau de montagnes, voir ring)
const colH = (col) => col & 255;
const colBiome = (col) => (col >> 8) & 15;
const colSnow = (col) => (col >> 12) & 3;
const colIce = (col) => (col >> 14) & 1;
// drapeaux de terrain3 : neige / lave (1, 2), eau glaciale (4), mer basse (8)
const colFlags = (col) => colSnow(col) | (colIce(col) << 2) | (((col >> 15) & 1) << 3);
const LOW_SEA = 8;
const ICE_WATER = 200;
const TALL_GRASS = 196;
// herbe haute : part des cases d'herbe qui en portent une touffe, selon le biome (voir tuftAt)
const TUFT = { [BIOME.PLAINS]: 0.14, [BIOME.FOREST]: 0.07, [BIOME.BIG_FOREST]: 0.05, [BIOME.EURO_FOREST]: 0.07 };
// écart de température entre les régions (voir climate)
const TEMP_SPREAD = 1.1;

const smooth = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Version du contenu généré. Chaque chunk retient la version avec laquelle il a été
// créé, et sera toujours regénéré à l'identique : une mise à jour du jeu ne change
// que les chunks jamais visités.
//   1 = HexaCraft 0.2 (sans eau ni sable)
//   2 = HexaCraft 0.3 (lacs, mers, plages)
//   3 = HexaCraft 0.8 (ruines : une par zone de 2500 x 2500, voir ruinAt)
//   4 = HexaCraft 0.8.3 (minerais de platine, de tungstène et de voltite impure)
//   5 = HexaCraft 0.8.5 (grands chênes de la grande forêt)
//   6 = HexaCraft 0.8.5 (châtaigniers de la forêt européenne)
//   7 = HexaCraft 0.8.6 (monde surélevé : mer à 64, montagnes jusqu'à 148, voir RAISED)
//   8 = HexaCraft 0.8.6 (tilleuls de la forêt européenne)
//   9 = HexaCraft 0.9.1 (villages dans les plaines, voir villageInCell)
//  10 = HexaCraft 0.9.2 (herbe haute, générée avec le monde, voir tuftAt)
//  11 = HexaCraft 1.0 (bouleaux dans les forêts et les plaines, poches de diorite)
//  12 = HexaCraft alpha 1.2 (profondeurs : plus de bedrock en 0, minerais rangés par profondeur)
//  13 = HexaCraft alpha 1.2 (puits des mines abandonnées jusqu'à la surface, voir mineIn)
export const GEN_CONTENT = 13;
const MINE_SHAFT_GEN = 13;

// Monde surélevé (mondes v3 et plus, chunks créés depuis HexaCraft 0.8.6) : tout monte de 40
// blocs, les montagnes sont presque deux fois plus hautes et les océans plus profonds. Les
// endroits déjà visités d'un ancien monde ne changent pas, et le monde garde son ancienne
// hauteur jusqu'à OLD_REACH blocs autour d'eux (même génération qu'avant). Plus loin, un anneau
// de montagnes : le terrain monte jusqu'à une crête (RING_CREST blocs plus loin environ, vers
// 110-145 de haut), puis redescend vers le nouveau terrain (à RING_OUT blocs du pied). Côté
// ancien monde, l'eau reste au niveau de l'ancienne mer : l'ancien monde est au fond d'une
// immense cuvette.
export const RAISED = 7;
const OLD_REACH = 560;
const RING_CREST = 52, RING_OUT = 130;
const RING_FAR = OLD_REACH + RING_OUT; // au-delà : le nouveau terrain seul
const CS_ = 16;                         // taille d'un chunk (voir mesher.js)
const SIZE_R = Math.sqrt(3) / 2;        // z = SIZE_R * r (voir hex.js)
const ZONE = 8;                         // zones de 8 x 8 chunks (recherche des chunks proches)
// centre (x, z) du parallélogramme de cases [q0, q0 + n] x [r0, r0 + n]
const centerOf = (q0, r0, n) => { const q = q0 + n / 2, r = r0 + n / 2; return [q + r / 2, r * SIZE_R]; };
const MOUNTAIN_RAISED = 62;  // hauteur des chaînes de montagnes (34 avant)
const VOLCANO_RAISED = 1.7;  // volcans plus hauts d'autant

// Eau glaciale : seulement à moins de ICE_REACH blocs des plaines enneigées (cherché sur
// une grille de ICE_CELL blocs)
const ICE_REACH = 50, ICE_CELL = 8;
// Profondeurs : zones des brèches dans la bedrock (anciens chunks) et des lacs de lave
const BREACH = 24, LAKE = 44, PILLAR = 30;
// Mines abandonnées : au plus une par zone de MINE x MINE cases ; galeries aux étages MINE_LEVELS
// (sol de la galerie ; elle est creusée sur 6 de haut au-dessus), entre -30 et -80
const MINE = 160, MINE_M = 12, MINE_LEVELS = [-37, -55, -73];
// axes des voies (voir tracks.js : l'axe a suit le voisin NEIGHBORS[a]) : la coordonnée qui reste
// constante le long de la voie (perp) et celle qui avance (along)
const PERP = [(q, r) => r, (q, r) => q, (q, r) => q + r];
const ALONG = [(q, r) => q, (q, r) => r, (q, r) => r];
// case (q, r) de la voie d'axe a, de constante c, à la position t
const CELL_AT = [(c, t) => [t, c], (c, t) => [c, t], (c, t) => [c - t, t]];
const mod = (a, n) => ((a % n) + n) % n;
// directions des 6 voisins (q, r)
const DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
const TREE_MARGIN = 6; // portée des plus grands arbres autour de leur tronc

// Ruines : au plus une par zone de RUIN_CELL x RUIN_CELL cases, sur la terre ferme et sur un
// terrain assez plat. Posées à plat ; dessous, des fondations en pierre taillée comblent
// les creux ; dans leur emprise, le terrain plus haut que leur base est creusé.
const RUIN_CELL = 2500;
const RUIN_TRIES = 8;          // emplacements essayés dans la zone avant d'y renoncer
const RUIN_MAX_SLOPE = 3;      // écart de hauteur maximal du sol sous la ruine
const COBBLE = 28, MOSSY = 29;

const TREE_CELL = 6; // au plus un arbre par zone de 6x6 hexas

// Villages : au plus un par zone de VILLAGE_CELL x VILLAGE_CELL cases (VILLAGE_CHANCE des
// zones), au milieu des plaines : un puits au centre et des maisons hexagonales autour, posées
// à plat comme les ruines (fondations en pierre taillée). Seulement dans les endroits encore
// jamais visités (chunks de version 9 et plus).
const VILLAGE_CELL = 600, VILLAGE_CHANCE = 0.75, VILLAGE_MARGIN = 80;
const VILLAGE_HOUSES = 5, VILLAGE_TRIES = 14;
export const DIRS6 = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];

// Milieu du côté k d'un anneau hexagonal de rayon rad (entre les coins k et k + 1)
export const midCell = (rad, k) => [DIRS6[k][0] * rad + DIRS6[(k + 2) % 6][0] * Math.floor(rad / 2), DIRS6[k][1] * rad + DIRS6[(k + 2) % 6][1] * Math.floor(rad / 2)];
// Maison hexagonale de rayon rad : plancher, murs (piliers en bûches aux coins), porte au milieu
// du côté door (vers le centre du village), deux fenêtres, toit en dalles à deux étages, une
// torche. Blocs [dq, dr, dy, id], dy = 0 au ras du sol (comme les ruines).
export function houseBlocks(rad, wall, roof, door) {
  const out = [];
  const isCorner = (dq, dr) => { for (let k = 0; k < 6; k++) if (DIRS6[k][0] * rad === dq && DIRS6[k][1] * rad === dr) return true; return false; };
  const side = (dq, dr) => { for (let k = 0; k < 6; k++) { const [a, b] = midCell(rad, k); if (a === dq && b === dr) return k; } return -1; };
  for (let dq = -rad; dq <= rad; dq++) {
    for (let dr = -rad; dr <= rad; dr++) {
      const d = hexDist(dq, dr);
      if (d > rad) continue;
      out.push([dq, dr, 0, 18]);                        // plancher
      if (d === rad) {
        const k = side(dq, dr), pillar = isCorner(dq, dr);
        for (let dy = 1; dy <= 3; dy++) {
          if (k === door && dy <= 2) out.push([dq, dr, dy, 0]);           // porte
          else if ((k === (door + 2) % 6 || k === (door + 4) % 6) && dy === 2) out.push([dq, dr, dy, 40]); // fenêtres
          else out.push([dq, dr, dy, pillar ? 5 : wall]);
        }
        out.push([dq, dr, 4, roof]);
      } else {
        for (let dy = 1; dy <= 3; dy++) out.push([dq, dr, dy, 0]);
        out.push([dq, dr, 4, d === rad - 1 ? roof : wall]);
        if (d <= rad - 1) out.push([dq, dr, 5, roof]);
      }
    }
  }
  out.push([0, 0, 1, 23]); // torche au milieu
  return out;
}
// Puits : margelle de pierre taillée autour d'une source d'eau
const WELL = [[0, 0, 0, 7], ...DIRS6.flatMap(([a, b]) => [[a, b, 0, 28], [a, b, 1, 32]])];
const WALLS = [18, 18, 99, 154, 28];

// ---------- Aléatoire à partir d'une graine ----------
export function seedToInt(seed) {
  const s = String(seed);
  if (/^-?\d+$/.test(s)) return Number(BigInt.asIntN(32, BigInt(s)));
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^ (h >>> 16)) | 0;
}

export function mulberry32(a) {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- Bruit simplex 2D ----------
const GRAD = [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]];
const F2 = 0.5 * (Math.sqrt(3) - 1), G2 = (3 - Math.sqrt(3)) / 6;

function makeSimplex(rand) {
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];

  return (xin, yin) => {
    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s), j = Math.floor(yin + s);
    const t = (i + j) * G2;
    const x0 = xin - (i - t), y0 = yin - (j - t);
    const i1 = x0 > y0 ? 1 : 0, j1 = x0 > y0 ? 0 : 1;
    const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
    const ii = i & 255, jj = j & 255;
    let n = 0;
    const corner = (x, y, g) => {
      const tt = 0.5 - x * x - y * y;
      if (tt < 0) return 0;
      const gr = GRAD[g & 7];
      return tt * tt * tt * tt * (gr[0] * x + gr[1] * y);
    };
    n += corner(x0, y0, perm[ii + perm[jj]]);
    n += corner(x1, y1, perm[ii + i1 + perm[jj + j1]]);
    n += corner(x2, y2, perm[ii + 1 + perm[jj + 1]]);
    return 70 * n; // environ [-1, 1]
  };
}

const hexDist = (dq, dr) => (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;

// Un relief : celui d'avant HexaCraft 0.8.6 (raised = false, inchangé), ou le monde surélevé
// (raised = true, avec parent : le Generator, pour l'anneau autour des endroits déjà visités).
class Terrain {
  // version : 1 = premiers mondes (relief avec micro-marches), 2 = relief lissé.
  // Un monde garde toujours sa version pour que ses modifications restent à leur place.
  constructor(type, seed, version, raised = false, parent = null) {
    this.type = type;
    this.version = version;
    this.seed = String(seed);
    this.raised = raised;
    this.parent = parent;
    this.H = raised ? WORLD_HEIGHT : version >= 6 ? V6_HEIGHT : LEGACY_HEIGHT;
    this.volcanoes = new Map(); // cellule -> volcan (ou null), voir volcanoAt
    this.ruins = new Map();     // zone -> ruine (ou null), voir ruinInCell
    this.villages = new Map();  // zone -> village (ou null), voir villageInCell
    this.coldCells = new Map(); // case de la grille de l'eau glaciale -> plaine enneigée ?
    this.seedInt = seedToInt(this.seed);
    const rand = mulberry32(this.seedInt);
    this.noiseA = makeSimplex(rand); // collines
    this.noiseB = makeSimplex(rand); // zones de montagnes
    this.noiseC = makeSimplex(rand); // détails
    this.heights = new Map();
    this.trees = new Map();
    this.v3 = type === 'normal' && version >= 3;
    this.sea = this.v3 ? (raised ? SEA_HIGH : SEA3) : SEA;
    if (this.v3) {
      // un bruit indépendant par rôle, tous tirés de la graine
      this.nWarpX = makeSimplex(rand);
      this.nWarpZ = makeSimplex(rand);
      this.nCont = makeSimplex(rand);   // continents
      this.nSuper = makeSimplex(rand);  // supercontinents (très grande échelle)
      this.nChain = makeSimplex(rand);  // tracé des chaînes de montagnes
      this.nChainOn = makeSimplex(rand); // où il y a des chaînes
      this.nPeak = makeSimplex(rand);   // pics et crêtes
      this.nHill = makeSimplex(rand);   // collines
      this.nRiver = makeSimplex(rand);  // rivières
      this.nLake = makeSimplex(rand);   // lacs
      this.nForest = makeSimplex(rand); // forêts / plaines
      this.nDetail = makeSimplex(rand); // petits détails
      this.nLone = makeSimplex(rand);   // continents isolés au milieu des méga-océans (v4)
      this.nTemp = makeSimplex(rand);   // climat (v5) : température
      this.nHumid = makeSimplex(rand);  // climat (v5) : humidité
      this.latPhase = this.hash(7, 7, 7); // où tombent l'équateur et les pôles
    }
    // version du contenu d'une colonne (celle du Generator : version de son chunk)
    this.versionAt = () => GEN_CONTENT;
  }

  // Niveau de la mer de la colonne (en cache)
  colSea(col) {
    return (col >> 15) & 1 ? SEA3 : this.sea;
  }

  clearCaches() {
    this.heights.clear();
    this.trees.clear();
    this.ruins.clear();
    this.villages.clear();
    this.coldCells.clear();
    this.coldNear?.clear();
  }

  // Nombre pseudo-aléatoire stable dans [0, 1) pour des entiers (a, b, c).
  hash(a, b, c = 0) {
    let h = this.seedInt ^ Math.imul(a, 374761393) ^ Math.imul(b, 668265263) ^ Math.imul(c, 2147483647);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h = Math.imul(h ^ (h >>> 16), 2246822519);
    return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
  }

  // ---------- Monde v3 : continents, montagnes, rivières, biomes ----------

  // Bruit fractal (plusieurs octaves), environ [-1, 1].
  fbm(noise, x, z, freq, oct) {
    let n = 0, amp = 1, norm = 0;
    for (let o = 0; o < oct; o++) {
      n += noise(x * freq, z * freq) * amp;
      norm += amp;
      amp *= 0.5;
      freq *= 2.03;
    }
    return n / norm;
  }

  // "Continentalité" au point (x, z) : > 0 sur les terres, < 0 en mer, très négatif au
  // large. Grands continents regroupés en supercontinents, séparés par des océans.
  continent(x, z) {
    // coordonnées tordues : côtes découpées, pas de formes rondes
    const wx = x + 330 * this.nWarpX(x * 0.0003, z * 0.0003);
    const wz = z + 330 * this.nWarpZ(x * 0.0003, z * 0.0003);
    if (this.version >= 4) {
      // Amas de continents (supercontinents) séparés par des méga-océans de milliers
      // de blocs, où ne surgissent que de rares continents isolés.
      const c = this.fbm(this.nCont, wx, wz, 1 / 3400, 7);
      const ax = x + 2500 * this.nWarpZ(x / 14000 + 40, z / 14000);
      const az = z + 2500 * this.nWarpX(x / 14000, z / 14000 + 40);
      // détail des côtes : sans lui, les bords des amas et les continents isolés
      // seraient des formes lisses et arrondies
      const rough = this.fbm(this.nDetail, wx + 7000, wz, 1 / 900, 4) * 0.7 + c * 0.3;
      const cluster = smooth(0.08, 0.32, this.fbm(this.nSuper, ax, az, 1 / 26000, 2) + rough * 0.12);
      const lone = smooth(0.6, 0.78, this.nLone(ax / 9000, az / 9000) + rough * 0.16) * (1 - cluster);
      // dans un amas : grands continents, mers intérieures et détroits
      const inCluster = c * 1.15 + 0.26;
      // continent isolé : une seule grande terre aux côtes découpées
      const alone = c * 0.45 + 0.3;
      const land = Math.max(cluster, lone);
      const v = cluster >= lone ? inCluster : alone;
      return v * land - 0.6 * (1 - land);
    }
    const c = this.fbm(this.nCont, wx, wz, 1 / 2400, 7);
    const s = this.nSuper(x / 9500, z / 9500); // blocs de continents / grands océans
    return c * 1.15 + s * 0.55 - 0.1;
  }

  // Colonne (q, r) : hauteur du sol (6 bits) + biome (<< 6), en cache.
  column(q, r) {
    const key = q * 100003 + r;
    let v = this.heights.get(key);
    if (v !== undefined) return v;
    const { x, z } = hexToWorld(q, r);
    const info = this.columnAt(x, z, q, r);
    v = info.h | (info.biome << 8) | ((info.snow | (info.lava << 1)) << 12) | ((info.ice ? 1 : 0) << 14) | ((info.low ? 1 : 0) << 15);
    if (this.heights.size > 200000) this.heights.clear();
    this.heights.set(key, v);
    return v;
  }

  // Climat (mondes v5) au point (x, z).
  //  - température : de grandes régions chaudes et froides aux formes irrégulières
  //    (bruit à grande échelle, tordu), avec une légère tendance selon la latitude ; les
  //    régions chaudes et froides sont séparées par des zones tempérées
  //  - sécheresse : l'intérieur des continents, loin de la mer, est plus sec que les côtes
  //   temp : environ -1 (froid) .. 1 (chaud), au niveau de la mer
  //   dry  : > 0 sec, < 0 humide
  climate(x, z, inland) {
    const wx = x + 1500 * this.nTemp(x / 12000 + 40, z / 12000);
    const wz = z + 1500 * this.nTemp(x / 12000, z / 12000 - 40);
    const regions = this.nTemp(wx / 11000, wz / 11000) + 0.12 * this.nTemp(wx / 3500 + 90, wz / 3500);
    const lat = Math.cos(2 * Math.PI * (z / 48000 + this.latPhase));
    const temp = TEMP_SPREAD * regions + 0.22 * lat + 0.04 * this.nDetail(x / 80, z / 80);
    const dry = -0.8 * this.nHumid(x / 2600, z / 2600) + 0.45 * inland - 0.2 + 0.06 * this.nDetail(x / 70 + 13, z / 70);
    return { temp, dry };
  }

  // Colonne au point (x, z) : { h, biome, cont, snow, lava, ice, low, sea }. Monde surélevé :
  // l'anneau de montagnes autour des endroits déjà visités (voir ring).
  columnAt(x, z, q, r, noIce = false) {
    const c = this.columnBase(x, z, noIce);
    if (!this.raised) return c;
    const d = this.parent.oldDist(x, z);
    return d < RING_FAR ? this.ring(x, z, q, r, Math.max(0, d - OLD_REACH), c, noIce) : c;
  }

  // Anneau de montagnes à la distance d (blocs) de son pied (OLD_REACH blocs des endroits déjà
  // visités : d = 0 sur l'ancien terrain). c : le nouveau terrain.
  ring(x, z, q, r, d, c, noIce) {
    if (q === undefined) ({ q, r } = worldToHex(x, z));
    const n1 = this.nPeak(x / 95 + 500, z / 95 - 300), n2 = this.nDetail(x / 30 + 200, z / 30);
    // sommets et cols le long de la crête (crêtes du bruit)
    const peaks = 1 - Math.abs(this.nPeak(x / 45 - 700, z / 45 + 120));
    const crestD = RING_CREST + 12 * n1;
    const crestH = Math.min(this.H - 8, SEA_HIGH + 54 + 22 * peaks * peaks + 8 * n1 + 4 * n2);
    const old = this.parent.old.column(q, r); // l'ancien terrain, au bord de la cuvette
    const oh = colH(old);
    let h, low, biome, base;
    if (d < crestD) {
      // versant intérieur : du bord de la cuvette jusqu'à la crête, de plus en plus raide ;
      // l'eau y reste au niveau de l'ancienne mer
      const t = d / crestD;
      h = oh + (crestH - oh) * t ** 1.4 + 8 * n2 * t * (1 - t);
      low = true; base = oh; biome = colBiome(old);
    } else {
      // versant extérieur : de la crête au nouveau terrain
      const u = Math.min(1, (d - crestD) / (RING_OUT - crestD));
      h = Math.max(c.h, crestH + (c.h - crestH) * smooth(0, 1, u) + 5 * n2 * (1 - u));
      low = false; base = c.h; biome = c.biome;
    }
    h = Math.max(4, Math.min(this.H - 8, Math.floor(h)));
    const sea = low ? SEA3 : SEA_HIGH;
    const water = biome <= BIOME.SEA || biome === BIOME.RIVER || biome === BIOME.LAKE;
    let snow = low ? colSnow(old) & 1 : c.snow, lava = low ? colSnow(old) >> 1 : c.lava;
    let ice = low ? colIce(old) === 1 : c.ice;
    if (h < sea) {
      if (!water) biome = BIOME.SEA;
    } else {
      ice = false;
      if (h - base > 4) { biome = BIOME.MOUNTAIN; lava = 0; }
      else if (water) biome = BIOME.BEACH;
      // il fait plus froid en altitude : sommets enneigés (limite des neiges comptée depuis
      // la nouvelle mer, des deux côtés de la crête)
      if (biome === BIOME.MOUNTAIN && this.version >= 5) {
        const { temp } = this.climate(x, z, smooth(0.02, 0.5, c.cont));
        snow = temp - Math.max(0, h - SEA_HIGH - 2) * 0.018 < -0.58 ? 1 : 0;
      }
    }
    if (noIce) ice = false;
    return { h, biome, cont: c.cont, snow, lava, ice, low, sea };
  }

  columnBase(x, z, noIce = false) {
    const SEA_ = this.sea;
    const cont = this.continent(x, z);
    const land = smooth(0, 0.06, cont);      // 0 en mer, 1 dès qu'on quitte la côte
    const inland = smooth(0.02, 0.5, cont);  // s'élève vers l'intérieur des terres

    // --- chaînes de montagnes : le long de lignes du bruit (crêtes), par endroits ---
    const cx = x + 140 * this.nDetail(x / 900, z / 900);
    const cz = z + 140 * this.nDetail(z / 900 + 50, x / 900);
    const ridge = 1 - Math.abs(this.nChain(cx / 1100, cz / 1100)); // 1 sur l'axe de la chaîne
    const chainOn = smooth(-0.25, 0.15, this.nChainOn(x / 4500, z / 4500));
    const chain = smooth(0.5, 0.96, ridge) * chainOn * smooth(0.03, 0.2, cont);
    // pics et crêtes secondaires, vallées entre eux
    const p1 = 1 - Math.abs(this.nPeak(x / 170, z / 170));
    const p2 = 1 - Math.abs(this.nPeak(x / 60 + 300, z / 60));
    const peaks = p1 * p1 * 0.75 + p2 * p2 * 0.25;
    const mountain = chain * (0.35 + 0.65 * peaks);

    // --- collines : plus douces dans les plaines ---
    const hills = this.fbm(this.nHill, x, z, 1 / 160, 3);
    const forestN = this.nForest(x / 420, z / 420) + 0.3 * this.nDetail(x / 70, z / 70);

    let h;
    if (cont > 0) {
      h = SEA_ + 1.5 + inland * 7 + (hills + 0.3) * (1.5 + 4.5 * inland) * land + mountain * (this.raised ? MOUNTAIN_RAISED : 34);
    } else {
      const d = -cont; // profondeur : plateau continental puis grands fonds
      h = SEA_ - 1 - 4 * smooth(0, 0.06, d) - (this.raised ? 30 : 13) * smooth(0.08, 0.35, d) + this.nDetail(x / 40, z / 40) * 1.2;
    }

    // --- rivières : suivent des lignes du bruit, creusent leur vallée jusqu'à la mer ---
    const rx = x + 90 * this.nDetail(x / 260 + 90, z / 260);
    const rz = z + 90 * this.nDetail(x / 260, z / 260 + 90);
    const rv = Math.abs(this.nRiver(rx / 1300, rz / 1300));
    const RIVER = 0.0075;
    let riverness = 0;
    if (cont > -0.02) {
      const valley = 0.03 + 0.09 * chain; // vallées plus larges et profondes en montagne
      if (rv < RIVER + valley) {
        const t = smooth(RIVER * 0.6, RIVER + valley, rv);
        const bed = SEA_ - 2 - 1.5 * (1 - Math.min(1, rv / RIVER));
        if (h > bed) h = bed + (h - bed) * (0.15 + 0.85 * t) - (t < 0.2 ? 1.5 : 0);
        riverness = 1 - smooth(RIVER, RIVER * 2.2, rv);
      }
    }

    // --- lacs : cuvettes dans les terres basses ---
    const lk = this.nLake(x / 380, z / 380) + 0.15 * this.nDetail(x / 55, z / 55);
    let lakeness = 0;
    if (lk > 0.63 && cont > 0.1 && chain < 0.3) {
      const s = smooth(0.63, 0.73, lk) * (1 - chain / 0.3);
      const bottom = SEA_ - 1.5 - 4 * smooth(0.7, 0.9, lk);
      if (h > bottom) h += (bottom - h) * s;
      lakeness = s;
    }

    h = Math.max(4, Math.min(this.H - 8, Math.floor(h)));

    // --- biome ---
    let biome;
    if (h < SEA_) {
      if (cont < -0.12) biome = BIOME.OCEAN;
      else if (cont < 0.015) biome = BIOME.SEA;
      else if (riverness > 0.2) biome = BIOME.RIVER;
      else if (lakeness > 0.2) biome = BIOME.LAKE;
      else biome = BIOME.SEA;
    } else if (h <= SEA_ + 1 && (cont < 0.08 || riverness > 0.05 || lakeness > 0.05)) biome = BIOME.BEACH;
    else if (h >= SEA_ + 17 || chain > 0.55) biome = BIOME.MOUNTAIN;
    else biome = forestN > 0.05 ? BIOME.FOREST : BIOME.PLAINS;

    // --- climat (v5) : il fait plus froid en altitude (environ -0,18 tous les 10 blocs) ---
    let snow = 0, ice = false;
    // eau des régions froides : glaciale
    // (seulement près des plaines enneigées : pas en plein océan)
    if (this.version >= 5 && h < SEA_ && !noIce && this.climate(x, z, inland).temp < -0.45) ice = this.nearColdLand(x, z);
    if (this.version >= 5 && h >= SEA_) {
      const { temp, dry } = this.climate(x, z, inland);
      const cold = temp - Math.max(0, h - SEA_ - 2) * 0.018 < -0.58;
      if (biome === BIOME.PLAINS || biome === BIOME.FOREST) {
        if (cold) biome = BIOME.SNOWY;
        else if (temp > 0.32 && dry > 0) biome = BIOME.DESERT; // chaud et loin de la mer
      } else if (biome === BIOME.MOUNTAIN && cold) snow = 1; // au-dessus de la limite des neiges
    }
    // --- volcans (v6) : certaines montagnes isolées sont des volcans ---
    let lava = 0;
    if (this.version >= 6) {
      const v = this.volcanoAt(x, z);
      if (v) {
        const t = Math.max(0, (v.d - v.crater) / (v.R - v.crater)); // 0 au bord du cratère, 1 au pied
        // pentes concaves, avec des ravines qui descendent du sommet
        const peak = SEA_ + Math.floor(v.rise * (this.raised ? VOLCANO_RAISED : 1));
        const cone = SEA_ + 2 + (peak - SEA_ - 2) * (1 - t) ** 1.7
          + 2.5 * this.nDetail(x / 22 + v.vx, z / 22) * (1 - t);
        if (cone > h) h = Math.floor(cone);
        if (v.d < v.crater) { h = peak - 7; lava = 1; } // cratère : lac de lave
        h = Math.min(this.H - 8, h);
        if (v.d < v.R * 0.78 && h >= SEA_ + 1) { biome = BIOME.VOLCANO; snow = 0; }
      }
    }
    // --- grande forêt : au cœur de certaines forêts, des chênes géants ---
    if (biome === BIOME.FOREST && this.version >= 5 && forestN > 0.3 && this.nForest(x / 1500 + 77, z / 1500 - 31) > 0.15) biome = BIOME.BIG_FOREST;
    // --- forêt européenne : d'autres forêts, de chênes et de châtaigniers ---
    else if (biome === BIOME.FOREST && this.version >= 5 && this.nForest(x / 1300 - 211, z / 1300 + 57) > 0.1) biome = BIOME.EURO_FOREST;
    return { h, biome, cont, snow, lava, ice, low: false, sea: SEA_ };
  }

  // Une plaine enneigée à moins de ICE_REACH blocs (environ, bord irrégulier) du point (x, z) ?
  nearColdLand(x, z) {
    const reach = ICE_REACH + 8 * this.nDetail(x / 45, z / 45);
    const ci = Math.floor(x / ICE_CELL), cj = Math.floor(z / ICE_CELL);
    // (les cases enneigées autour de la case (ci, cj), cherchées une fois pour ses 64 colonnes)
    const list = this.coldAround(ci, cj);
    for (let k = 0; k < list.length; k += 2) if ((list[k] - x) ** 2 + (list[k + 1] - z) ** 2 <= reach * reach) return true;
    return false;
  }
  // Centres (x, z, ...) des cases enneigées assez proches de la case (ci, cj) pour compter
  // (reach au plus : ICE_REACH + 8), en cache
  coldAround(ci, cj) {
    const k = ci * 100003 + cj;
    let out = (this.coldNear ||= new Map()).get(k);
    if (out) return out;
    out = [];
    const n = Math.ceil((ICE_REACH + 8) / ICE_CELL) + 1;
    for (let di = -n; di <= n; di++) {
      for (let dj = -n; dj <= n; dj++) if (this.coldLandCell(ci + di, cj + dj)) out.push((ci + di + 0.5) * ICE_CELL, (cj + dj + 0.5) * ICE_CELL);
    }
    if (this.coldNear.size > 20000) this.coldNear.clear();
    this.coldNear.set(k, out);
    return out;
  }

  // La case (i, j) de la grille ICE_CELL est-elle une plaine enneigée ? (en cache)
  coldLandCell(i, j) {
    const k = i * 100003 + j;
    let v = this.coldCells.get(k);
    if (v === undefined) {
      const info = this.columnAt((i + 0.5) * ICE_CELL, (j + 0.5) * ICE_CELL, undefined, undefined, true);
      v = info.biome === BIOME.SNOWY;
      if (this.coldCells.size > 300000) this.coldCells.clear();
      this.coldCells.set(k, v);
    }
    return v;
  }

  // Volcan qui couvre le point (x, z), ou null. Au plus un par cellule de 1600 blocs (une
  // cellule sur trois environ), toujours sur la terre ferme. { vx, vz, R, crater, peak, d }
  volcanoAt(x, z) {
    const CELL = 1600;
    const ci0 = Math.floor(x / CELL), cj0 = Math.floor(z / CELL);
    let best = null;
    for (let a = -1; a <= 1; a++) {
      for (let b = -1; b <= 1; b++) {
        const v = this.volcanoInCell(ci0 + a, cj0 + b);
        if (!v) continue;
        const d = Math.hypot(x - v.vx, z - v.vz);
        if (d < v.R && (!best || d / v.R < best.d / best.R)) best = { ...v, d };
      }
    }
    return best;
  }

  volcanoInCell(ci, cj) {
    const k = ci * 100003 + cj;
    if (this.volcanoes.has(k)) return this.volcanoes.get(k);
    let v = null;
    if (this.hash(ci, cj, 901) < 0.35) {
      const CELL = 1600;
      const vx = (ci + 0.2 + 0.6 * this.hash(ci, cj, 902)) * CELL;
      const vz = (cj + 0.2 + 0.6 * this.hash(ci, cj, 903)) * CELL;
      // seulement au milieu des terres (pas au bord de la mer)
      if (this.continent(vx, vz) > 0.1) {
        const R = 80 + 70 * this.hash(ci, cj, 904);
        v = { vx, vz, R, crater: R * 0.13, rise: 38 + Math.floor(12 * this.hash(ci, cj, 905)) };
      }
    }
    this.volcanoes.set(k, v);
    return v;
  }

  // Fait-il froid en (q, r) ? (plaines enneigées, sommets enneigés, eau glaciale : il y neige)
  isCold(q, r) {
    if (!this.v3) return false;
    const col = this.column(q, r);
    return colBiome(col) === BIOME.SNOWY || (colSnow(col) & 1) === 1 || colIce(col) === 1;
  }

  biomeAt(q, r) {
    if (!this.v3) return BIOME.PLAINS;
    return colBiome(this.column(q, r));
  }

  // Filons de charbon dans la pierre : un petit amas au plus par cellule de 4x4x4.
  coalAt(q, r, y) {
    const cq = Math.floor(q / 4), cr = Math.floor(r / 4), cy = Math.floor(y / 4);
    if (this.hash(cq, cr, cy * 7 + 11) > 0.3) return false;
    const oq = cq * 4 + 1 + Math.floor(this.hash(cq, cr, cy * 7 + 12) * 2);
    const or = cr * 4 + 1 + Math.floor(this.hash(cq, cr, cy * 7 + 13) * 2);
    const oy = cy * 4 + 1 + Math.floor(this.hash(cq, cr, cy * 7 + 14) * 2);
    const d = hexDist(q - oq, r - or) + Math.abs(y - oy);
    return d === 0 || (d === 1 && this.hash(q, r, y + 5000) < 0.6);
  }

  // Autres minerais : un petit filon au plus par cellule de 6x6x6, plus ou moins fréquent.
  // salt : distingue les minerais ; chance : part des cellules qui ont un filon.
  oreAt(q, r, y, salt, chance) {
    const cq = Math.floor(q / 6), cr = Math.floor(r / 6), cy = Math.floor(y / 6);
    if (this.hash(cq, cr, cy * 13 + salt) > chance) return false;
    const oq = cq * 6 + 1 + Math.floor(this.hash(cq, cr, cy * 13 + salt + 1) * 4);
    const or = cr * 6 + 1 + Math.floor(this.hash(cq, cr, cy * 13 + salt + 2) * 4);
    const oy = cy * 6 + 1 + Math.floor(this.hash(cq, cr, cy * 13 + salt + 3) * 4);
    const d = hexDist(q - oq, r - or) + Math.abs(y - oy);
    return d === 0 || (d === 1 && this.hash(q, r, y + salt * 31) < 0.5);
  }

  // ---------- Profondeurs (-DEPTH à -1) ----------
  // Brèche dans la bedrock en 0 d'un chunk créé avant les profondeurs : au plus une par zone de
  // BREACH x BREACH cases, de 2 à 4 cases de rayon, bords irréguliers (de la pierre à la place)
  breachAt(q, r) {
    if (this.type !== 'normal') return false;
    const ci = Math.floor(q / BREACH), cj = Math.floor(r / BREACH);
    if (this.hash(ci, cj, 1801) > 0.55) return false;
    const oq = ci * BREACH + 5 + Math.floor(this.hash(ci, cj, 1802) * (BREACH - 10));
    const or = cj * BREACH + 5 + Math.floor(this.hash(ci, cj, 1803) * (BREACH - 10));
    const R = 2 + Math.floor(this.hash(ci, cj, 1804) * 3);
    const d = hexDist(q - oq, r - or);
    return d < R || (d === R && this.hash(q, r, 1805) < 0.5);
  }

  // Pilier de bedrock sous un ancien monde plat (entre la bedrock en 0 et le monde plat d'en bas) :
  // au plus un par zone de PILLAR x PILLAR cases, de 1 à 3 cases de rayon, évasé en haut et en bas
  // (comme une stalactite qui rejoint une stalagmite), un peu tordu, aux bords irréguliers
  pillarAt(q, r, y) {
    const ci = Math.floor(q / PILLAR), cj = Math.floor(r / PILLAR);
    if (this.hash(ci, cj, 2001) > 0.6) return false;
    const R0 = 1.2 + this.hash(ci, cj, 2004) * 1.8;
    const e = Math.min(y - FLAT_LOW_Y, -y);           // distance au plafond ou au sol
    const R = R0 + Math.max(0, 1 - e / 12) * 4 + this.hash(q, r, y + 2006) * 0.8;
    const ph = this.hash(ci, cj, 2007) * 6.28;
    const oq = ci * PILLAR + 9 + Math.floor(this.hash(ci, cj, 2002) * (PILLAR - 18)) + Math.round(1.6 * Math.sin(y * 0.11 + ph));
    const or = cj * PILLAR + 9 + Math.floor(this.hash(ci, cj, 2003) * (PILLAR - 18)) + Math.round(1.6 * Math.cos(y * 0.09 + ph));
    return hexDist(q - oq, r - or) < R;
  }

  // ---------- Mines abandonnées ----------
  // Une ancienne compagnie a creusé un réseau ferré sous terre, puis l'a abandonné. Par zone de
  // MINE x MINE cases (3 fois sur 4) : 2 ou 3 étages de galeries droites (5 de large, 6 de haut,
  // le long des 3 axes de la voie du train), qui se croisent en salles ; un puits (escalier en
  // colimaçon) relie les étages, et la surface dans les endroits jamais visités avant. Dans les
  // galeries : une voie de rails de train (voir World.adoptRails), des trous dans la voie, des
  // éboulements, des étais de bois, des lampes éteintes et des coffres.
  mineIn(zi, zj) {
    const key = zi * 100003 + zj;
    if (this.mines?.has(key)) return this.mines.get(key);
    (this.mines ||= new Map());
    if (this.mines.size > 256) this.mines.clear();
    let mine = null;
    if (this.type === 'normal' && this.hash(zi, zj, 2101) < 0.75) {
      const H = (k) => this.hash(zi, zj, 2110 + k);
      const q0 = zi * MINE, r0 = zj * MINE;
      // le puits, vers le milieu de la zone
      const sq = q0 + 50 + Math.floor(H(0) * (MINE - 100)), sr = r0 + 50 + Math.floor(H(1) * (MINE - 100));
      const n = H(2) < 0.45 ? 3 : 2, skip = Math.floor(H(3) * 3);
      const levels = n === 3 ? MINE_LEVELS : MINE_LEVELS.filter((_, i) => i !== skip);
      const galleries = [], chambers = [], chests = [];
      // t possibles d'une voie (a, c) dans la zone (marge MINE_M)
      const span = (a, c) => {
        if (a === 0) return [q0 + MINE_M, q0 + MINE - MINE_M];
        if (a === 1) return [r0 + MINE_M, r0 + MINE - MINE_M];
        return [Math.max(r0 + MINE_M, c - (q0 + MINE - MINE_M)), Math.min(r0 + MINE - MINE_M, c - (q0 + MINE_M))];
      };
      let k = 10;
      levels.forEach((F, li) => {
        const ng = 2 + (H(k++) < 0.5 ? 1 : 0), a0 = Math.floor(H(k++) * 3);
        for (let g = 0; g < ng; g++) {
          const a = (a0 + g) % 3;
          let c;
          if (g === 0) c = PERP[a](sq, sr) + (H(k++) < 0.5 ? 5 : -5); // (la première passe à côté du puits)
          else {
            const [lo, hi] = a === 2 ? [q0 + r0 + 40, q0 + r0 + 2 * MINE - 40] : a === 0 ? [r0 + MINE_M, r0 + MINE - MINE_M] : [q0 + MINE_M, q0 + MINE - MINE_M];
            c = lo + Math.floor(H(k++) * (hi - lo));
          }
          let [t0, t1] = span(a, c);
          t0 += Math.floor(H(k++) * 25);
          t1 -= Math.floor(H(k++) * 25);
          if (g === 0) { const ts = ALONG[a](sq, sr); t0 = Math.min(t0, ts - 4); t1 = Math.max(t1, ts + 4); }
          if (t1 - t0 < 30) continue;
          // trous dans la voie (1 à 3 rails manquants) et éboulements
          const gaps = [], caves = [];
          for (let t = t0 + 6; t < t1 - 6; t += 9) if (this.hash(t, c, 2130 + a) < 0.16) gaps.push([t, t + Math.floor(this.hash(t, c, 2131) * 3)]);
          const nc = Math.floor(H(k++) * 3);
          for (let i = 0; i < nc; i++) caves.push({ t: t0 + 10 + Math.floor(H(k++) * (t1 - t0 - 20)), half: 2 + Math.floor(H(k++) * 3) });
          galleries.push({ a, c, t0, t1, F, gaps, caves, shaft: g === 0 });
          // coffre au bout de la galerie (contre la paroi)
          if (H(k++) < 0.6) { const [q, r] = CELL_AT[a](c + 2, t1); chests.push([q, r, F + 1]); }
        }
        // salles aux croisements des galeries de l'étage
        const lv = galleries.filter((g) => g.F === F);
        for (let i = 0; i < lv.length; i++) {
          for (let j = i + 1; j < lv.length; j++) {
            const A = lv[i], B = lv[j];
            if (A.a === B.a) continue;
            // la case où les deux voies se croisent
            let q, r;
            const P = (g) => g.c;
            const [x, y] = A.a < B.a ? [A, B] : [B, A];
            if (x.a === 0 && y.a === 1) { r = P(x); q = P(y); }
            else if (x.a === 0 && y.a === 2) { r = P(x); q = P(y) - r; }
            else { q = P(x); r = P(y) - q; }
            const ok = (g) => { const t = ALONG[g.a](q, r); return t >= g.t0 && t <= g.t1; };
            if (!ok(A) || !ok(B)) continue;
            chambers.push({ q, r, F });
            // un coffre contre le bord de la salle (pas sur une voie)
            if (H(k++) < 0.7) {
              const N6 = [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]], d = Math.floor(H(k++) * 6);
              const cq = q + N6[d][0] * 4 + N6[(d + 1) % 6][0], cr = r + N6[d][1] * 4 + N6[(d + 1) % 6][1];
              if (!lv.some((g) => Math.abs(PERP[g.a](cq, cr) - g.c) <= 1)) chests.push([cq, cr, F + 1]);
            }
          }
        }
        if (li === levels.length - 1 && !galleries.some((g) => g.shaft && g.F === F)) { /* (la galerie du puits n'a pas pu se faire) */ }
      });
      if (galleries.length) mine = { sq, sr, bottom: Math.min(...galleries.filter((g) => g.shaft).map((g) => g.F), -1), galleries, chambers, chests, shaftF: new Set(galleries.filter((g) => g.shaft).map((g) => g.F)) };
    }
    this.mines.set(key, mine);
    return mine;
  }

  // Ce qui touche la colonne (q, r) dans la mine de sa zone (puits, galeries, salles, coffres), ou
  // null : la plupart des colonnes ne sont dans aucune mine (rien à tester case par case)
  mineCol(q, r) {
    const m = this.mineIn(Math.floor(q / MINE), Math.floor(r / MINE));
    if (!m) return null;
    const shaft = hexDist(q - m.sq, r - m.sr) <= 3;
    const galleries = m.galleries.filter((g) => {
      const k = Math.abs(PERP[g.a](q, r) - g.c), t = ALONG[g.a](q, r);
      return (k <= 3 && t >= g.t0 && t <= g.t1) || (g.shaft && Math.abs(t - ALONG[g.a](m.sq, m.sr)) <= 1 && k <= 6);
    });
    const chambers = m.chambers.filter((ch) => hexDist(q - ch.q, r - ch.r) <= 5);
    const chests = m.chests.filter(([a, b]) => a === q && b === r);
    if (!shaft && !galleries.length && !chambers.length && !chests.length) return null;
    return { m, shaft, galleries, chambers, chests };
  }

  // Bloc d'une mine en (q, r, y), ou -1 (pas dans une mine : le terrain). y < 0 : les galeries, les
  // salles et le puits ; y >= 0 : le puits jusqu'à la surface (top : la surface de la colonne)
  mineBlock(q, r, y, top = 0, mc = this.mineCol(q, r)) {
    if (!mc) return -1;
    const m = mc.m;
    // puits : 5 de large, un escalier en colimaçon sur son bord (une marche par couche) ; à la
    // surface (top > 0 : le puits monte jusque-là), 3 poteaux autour de l'entrée
    const dq = q - m.sq, dr = r - m.sr, d = hexDist(dq, dr);
    if (d <= 3 && y > m.bottom) {
      const shaft = y < 0 || (top > 0 && y <= top);
      if (shaft && d <= 2) return d === 2 && this.mineStair(m, q, r, y) ? PLANKS : AIR;
      if (y > top && top > 0 && y <= top + 3 && d === 3 && ((dq === 3 && dr === 0) || (dq === -3 && dr === 3) || (dq === 0 && dr === -3))) return 5;
    }
    if (y >= 0) return -1;
    // passage du puits vers la galerie de chaque étage (à côté du puits)
    for (const g of mc.galleries) {
      if (y <= g.F || y > g.F + 6) continue;
      const k = PERP[g.a](q, r) - g.c, t = ALONG[g.a](q, r);
      if (g.shaft && Math.abs(t - ALONG[g.a](m.sq, m.sr)) <= 1 && y <= g.F + 4) {
        const ks = PERP[g.a](m.sq, m.sr) - g.c;
        if ((ks > 0 && k >= 2 && k <= ks) || (ks < 0 && k <= -2 && k >= ks)) return d === 2 && y > g.F + 1 && this.mineStair(m, q, r, y) ? PLANKS : AIR;
      }
    }
    for (const c of mc.chests) if (c[2] === y) return CHEST_ID;
    // salles aux croisements : 11 de large, 7 de haut
    for (const ch of mc.chambers) {
      if (y < ch.F || y > ch.F + 8) continue;
      const dd = hexDist(q - ch.q, r - ch.r);
      if (dd > 5) continue;
      if (y === ch.F) return dd <= 1 ? GRAVEL_ID : COBBLE;
      if (y === ch.F + 8) return dd <= 3 ? PLANKS : -1;
      if (dd === 5 && y >= ch.F + 6) return -1;
      // (la voie traverse la salle : elle est dans la galerie, plus bas)
      const g = m.galleries.find((gg) => gg.F === ch.F && PERP[gg.a](q, r) === gg.c);
      if (g && y === ch.F + 1) return this.railAt(g, ALONG[g.a](q, r)) ? MINE_TRACKS[g.a] : AIR;
      return AIR;
    }
    for (const g of mc.galleries) {
      if (y < g.F || y > g.F + 7) continue;
      const k = PERP[g.a](q, r) - g.c, t = ALONG[g.a](q, r), ak = Math.abs(k);
      if (t < g.t0 || t > g.t1 || ak > 3) continue;
      const frame = mod(t - g.t0, 10) === 0, frameOk = frame && this.hash(t, g.c, 2140) > 0.2; // (des étais manquent)
      if (ak === 3) {
        if (frameOk && y >= g.F + 1 && y <= g.F + 6) return 5;                            // poteau
        if (y === g.F + 4 && k > 0 && mod(t - g.t0, 20) === 5) return LAMP_OFF;            // lampe éteinte
        continue;
      }
      if (y === g.F + 7) { if (frameOk) return PLANKS; continue; }                         // poutre du plafond
      if (y === g.F) return ak <= 1 ? GRAVEL_ID : COBBLE;                                  // ballast
      if (ak === 2 && y === g.F + 6) continue;                                             // (voûte)
      for (const cv of g.caves) {
        const dt = Math.abs(t - cv.t);
        if (dt > cv.half) continue;
        const hgt = Math.round((1 - dt / (cv.half + 1)) * 6) - (ak === 2 ? 1 : 0);
        if (y <= g.F + hgt) return this.hash(q, r, y + 2150) < 0.65 ? GRAVEL_ID : COBBLE;
      }
      if (k === 0 && y === g.F + 1 && this.railAt(g, t)) return MINE_TRACKS[g.a];
      return AIR;
    }
    return -1;
  }
  // Surface de la colonne (q, r) si le puits d'une mine y débouche (à moins de 3 cases de son centre), ou 0 :
  // pas de puits ici, ou il reste fermé (sous la mer)
  shaftTop(q, r) {
    const m = this.mineIn(Math.floor(q / MINE), Math.floor(r / MINE));
    if (!m || hexDist(q - m.sq, r - m.sr) > 3) return 0;
    const col = this.column(m.sq, m.sr);
    if (colH(col) <= this.colSea(col) || colBiome(col) === BIOME.VOLCANO) return 0;
    return colH(this.column(q, r)); // (chaque colonne jusqu'à sa propre surface)
  }
  // Cases des voies des mines dans le chunk (cq, cr) : [q, r, y] (les rails y sont, sauf aux trous
  // et sous les éboulements : voir World.adoptRails)
  mineRails(cq, cr, CS) {
    const q0 = cq * CS, r0 = cr * CS, out = [];
    const m = this.mineIn(Math.floor(q0 / MINE), Math.floor(r0 / MINE));
    if (!m) return out;
    for (const g of m.galleries) {
      for (let t = g.t0; t <= g.t1; t++) {
        const [q, r] = CELL_AT[g.a](g.c, t);
        if (q >= q0 && q < q0 + CS && r >= r0 && r < r0 + CS) out.push([q, r, g.F + 1]);
      }
    }
    return out;
  }
  // (le passage vers le puits croise l'escalier : la marche reste)
  mineStair(m, q, r, y) {
    const w = hexToWorld(q - m.sq, r - m.sr);
    return mod(Math.round(Math.atan2(w.z, w.x) / (Math.PI / 6)), 12) === mod(y, 12);
  }
  // Y a-t-il un rail à la position t de la galerie g ? (sinon : un trou dans la voie)
  railAt(g, t) {
    for (const [a, b] of g.gaps) if (t >= a && t <= b) return false;
    return true;
  }
  // Coffre d'une mine abandonnée (pour le remplir à la première ouverture : voir main.js)
  isMineChest(q, r, y) {
    const m = this.mineIn(Math.floor(q / MINE), Math.floor(r / MINE));
    return !!m && m.chests.some(([a, b, c]) => a === q && b === r && c === y);
  }

  // ---------- Grottes des Hexaliens ----------
  // Petites cavernes entre -20 et -10, au plus une par zone de HCAVE x HCAVE cases (6 fois sur
  // 10) : une cuvette sous une voûte basse, tapissée de mousse, éclairée par des champignons
  // lumineux. Les Hexaliens y vivent (voir hexaliens.js). { q, r : centre, y : sol au centre,
  // R : rayon, h : hauteur de la voûte }
  hexCaveIn(ci, cj) {
    if (this.type !== 'normal' || this.hash(ci, cj, 2201) > 0.6) return null;
    const H = (k) => this.hash(ci, cj, 2202 + k);
    return {
      key: ci + ',' + cj,
      q: ci * HCAVE + 14 + Math.floor(H(0) * (HCAVE - 28)), r: cj * HCAVE + 14 + Math.floor(H(1) * (HCAVE - 28)),
      y: -20 + Math.floor(H(2) * 3), R: 6 + Math.floor(H(3) * 5), h: 5 + Math.floor(H(4) * 3),
    };
  }
  // Grottes dont le centre est à moins de R blocs du point (q, r)
  hexCavesNear(q, r, R) {
    const out = [];
    const c0 = Math.floor((q - R) / HCAVE), c1 = Math.floor((q + R) / HCAVE), d0 = Math.floor((r - R) / HCAVE), d1 = Math.floor((r + R) / HCAVE);
    for (let ci = c0; ci <= c1; ci++) for (let cj = d0; cj <= d1; cj++) {
      const c = this.hexCaveIn(ci, cj);
      if (c && hexDist(c.q - q, c.r - r) <= R) out.push(c);
    }
    return out;
  }
  // Bloc d'une grotte des Hexaliens en (q, r, y), ou -1 (pas dans une grotte)
  hexCaveBlock(q, r, y) {
    const c = this.hexCaveIn(Math.floor(q / HCAVE), Math.floor(r / HCAVE));
    if (!c) return -1;
    // (bord irrégulier : par petits groupes de cases)
    const k = (hexDist(q - c.q, r - c.r) / c.R) * (0.9 + this.hash(q >> 1, r >> 1, 2210) * 0.2);
    if (k >= 1) return -1;
    const floor = c.y + Math.round(k * k * 2.5);           // le sol remonte vers les bords
    const top = floor + Math.max(1, Math.round(c.h * Math.sqrt(1 - k * k)));
    if (y > floor && y <= top) return y === floor + 1 && this.hash(q, r, 2211) < 0.05 ? GLOW_FUNGUS : AIR;
    if (y === floor) return this.hash(q, r, 2212) < 0.85 ? MOSS_ID : LICHEN_ID;
    if (y === top + 1) return this.hash(q, r, 2213) < 0.07 ? GLOW_FUNGUS : LICHEN_ID;
    return -1;
  }

  // Lac de lave souterrain de la colonne (q, r), ou null : au plus un par zone de LAKE x LAKE
  // cases, entre -72 et -20, de 6 à 12 cases de rayon. Sous une voûte d'air : la lave (jusqu'à
  // 3 de profondeur), un fond de basalte et de magma, une rive de basalte.
  // { top : surface de la lave, depth : profondeur de lave (0 : rive), dome : hauteur de la voûte }
  lakeCol(q, r) {
    if (this.type !== 'normal') return null;
    const ci = Math.floor(q / LAKE), cj = Math.floor(r / LAKE);
    if (this.hash(ci, cj, 1901) > 0.5) return null;
    const oq = ci * LAKE + 14 + Math.floor(this.hash(ci, cj, 1902) * (LAKE - 28));
    const or = cj * LAKE + 14 + Math.floor(this.hash(ci, cj, 1903) * (LAKE - 28));
    const R = 6 + this.hash(ci, cj, 1904) * 6;
    // (bord irrégulier : par petits groupes de cases)
    const d = (hexDist(q - oq, r - or) / R) * (0.88 + this.hash(q >> 1, r >> 1, 1905) * 0.24);
    if (d >= 1) return null;
    const k = 1 - d * d;
    return { top: -72 + Math.floor(this.hash(ci, cj, 1906) * 52), depth: Math.round(3 * k), dome: Math.round(2 + 6 * k) };
  }

  // Bloc des profondeurs en (q, r, y), y de -DEPTH à -1 (lk : lac de la colonne, voir lakeCol)
  deepBlock(q, r, y, lk = this.lakeCol(q, r), mc = this.mineCol(q, r)) {
    if (this.type === 'tutorial') return AIR;
    if (this.type === 'flat') {
      // le monde plat d'en bas ; un ancien monde plat : de l'air, et ses piliers de bedrock
      if (y <= -DEPTH) return BEDROCK;
      if (y < FLAT_LOW_Y) return DIRT;
      if (y === FLAT_LOW_Y) return GRASS;
      return this.version < FLAT_LOW && this.pillarAt(q, r, y) ? BEDROCK : AIR;
    }
    if (this.type !== 'normal' || y <= -DEPTH) return BEDROCK;
    if (mc) { const mb = this.mineBlock(q, r, y, 0, mc); if (mb >= 0) return mb; }
    if (y >= -20 && y <= -8) { const hb = this.hexCaveBlock(q, r, y); if (hb >= 0) return hb; }
    // fond de bedrock irrégulier
    if (y === 1 - DEPTH && this.hash(q, r, 1907) < 0.55) return BEDROCK;
    if (y === 2 - DEPTH && this.hash(q, r, 1908) < 0.2) return BEDROCK;
    if (lk) {
      const t = lk.top;
      if (y > t && y <= t + lk.dome) return AIR;
      if (y <= t && y > t - lk.depth) return LAVA;
      if (y === t - lk.depth) return this.hash(q, r, y + 1909) < 0.3 ? MAGMA : BASALT;
    }
    // minerais : les plus rares d'abord (chacun dans sa tranche de profondeur)
    if (y <= -50 && this.oreAt(q, r, y, 1409, 0.024)) return CRIMSONITE_ORE;
    if (y <= -60 && this.oreAt(q, r, y, 1103, 0.07)) return TUNGSTEN_ORE;
    if (y <= -24 && y >= -54 && this.oreAt(q, r, y, 907, 0.12)) return PLATINUM_ORE;
    if (y <= -10 && y >= -30 && this.oreAt(q, r, y, 701, 0.16)) return VOLTITE_ORE;
    if (y >= -15 && this.oreAt(q, r, y, 1307, 0.14)) return FLUORITE_ORE;
    if (y >= -40 && this.oreAt(q, r, y, 401, 0.35)) return IRON_ORE;
    if (y >= -24 && this.coalAt(q, r, y)) return COAL;
    if (this.dioriteAt(q, r, y)) return DIORITE;
    return STONE;
  }

  // Colonne (q, r) des profondeurs d'un coup (monde normal) : out[y + DEPTH] pour y de -DEPTH à -1.
  // Exactement deepBlock case par case, mais les minerais sont cherchés par cellule (un filon
  // touche au plus 3 cases d'une colonne) au lieu d'être testés dans chaque case : bien plus rapide.
  deepColumn(q, r, lk, mc, out) {
    const free = this.deepFree || (this.deepFree = new Uint8Array(DEPTH)); // case encore de la pierre
    // grotte des Hexaliens : seulement si la colonne peut y être (bord irrégulier : x 0,9 au moins)
    const hc = this.hexCaveIn(Math.floor(q / HCAVE), Math.floor(r / HCAVE));
    const inCave = hc && hexDist(q - hc.q, r - hc.r) * 0.9 < hc.R;
    for (let y = -DEPTH; y < 0; y++) {
      let id = -1;
      if (y <= -DEPTH) id = BEDROCK;
      else {
        if (mc) { const mb = this.mineBlock(q, r, y, 0, mc); if (mb >= 0) id = mb; }
        if (id < 0 && inCave && y >= -20 && y <= -8) { const hb = this.hexCaveBlock(q, r, y); if (hb >= 0) id = hb; }
        if (id < 0) {
          if (y === 1 - DEPTH && this.hash(q, r, 1907) < 0.55) id = BEDROCK;
          else if (y === 2 - DEPTH && this.hash(q, r, 1908) < 0.2) id = BEDROCK;
        }
        if (id < 0 && lk) {
          const t = lk.top;
          if (y > t && y <= t + lk.dome) id = AIR;
          else if (y <= t && y > t - lk.depth) id = LAVA;
          else if (y === t - lk.depth) id = this.hash(q, r, y + 1909) < 0.3 ? MAGMA : BASALT;
        }
      }
      out[y + DEPTH] = id < 0 ? STONE : id;
      free[y + DEPTH] = id < 0 ? 1 : 0;
    }
    // minerais, dans l'ordre de deepBlock (le premier qui prend une case la garde)
    this.oreCells(q, r, 1 - DEPTH, -50, 1409, 0.024, CRIMSONITE_ORE, out, free);
    this.oreCells(q, r, 1 - DEPTH, -60, 1103, 0.07, TUNGSTEN_ORE, out, free);
    this.oreCells(q, r, -54, -24, 907, 0.12, PLATINUM_ORE, out, free);
    this.oreCells(q, r, -30, -10, 701, 0.16, VOLTITE_ORE, out, free);
    this.oreCells(q, r, -15, -1, 1307, 0.14, FLUORITE_ORE, out, free);
    this.oreCells(q, r, -40, -1, 401, 0.35, IRON_ORE, out, free);
    this.coalCells(q, r, -24, -1, out, free);
    this.dioriteCells(q, r, 1 - DEPTH, -1, out, free);
  }
  // Minerais de la colonne (q, r), cherchés par cellule (comme oreAt, coalAt, dioriteAt, mais un
  // filon touche au plus quelques cases de la colonne) : chacun ne prend qu'une case encore libre
  // (free) entre ylo et yhi ; out[y - base] (base : -DEPTH pour les profondeurs, 0 au-dessus)
  // Filons d'un minerai (cellules de 6 : voir oreAt)
  oreCells(q, r, ylo, yhi, salt, chance, id, out, free, base = -DEPTH) {
    if (ylo > yhi) return;
    const cq = Math.floor(q / 6), cr = Math.floor(r / 6);
    for (let cy = Math.floor(ylo / 6); cy <= Math.floor(yhi / 6); cy++) {
      if (this.hash(cq, cr, cy * 13 + salt) > chance) continue;
      const oq = cq * 6 + 1 + Math.floor(this.hash(cq, cr, cy * 13 + salt + 1) * 4);
      const or = cr * 6 + 1 + Math.floor(this.hash(cq, cr, cy * 13 + salt + 2) * 4);
      const oy = cy * 6 + 1 + Math.floor(this.hash(cq, cr, cy * 13 + salt + 3) * 4);
      const dh = hexDist(q - oq, r - or);
      if (dh > 1) continue;
      for (let y = oy - 1; y <= oy + 1; y++) {
        if (y < ylo || y > yhi || Math.floor(y / 6) !== cy || !free[y - base]) continue;
        const d = dh + Math.abs(y - oy);
        if (d === 0 || (d === 1 && this.hash(q, r, y + salt * 31) < 0.5)) { out[y - base] = id; free[y - base] = 0; }
      }
    }
  }
  // Charbon (cellules de 4 : voir coalAt)
  coalCells(q, r, ylo, yhi, out, free, base = -DEPTH) {
    if (ylo > yhi) return;
    const cq = Math.floor(q / 4), cr = Math.floor(r / 4);
    for (let cy = Math.floor(ylo / 4); cy <= Math.floor(yhi / 4); cy++) {
      if (this.hash(cq, cr, cy * 7 + 11) > 0.3) continue;
      const oq = cq * 4 + 1 + Math.floor(this.hash(cq, cr, cy * 7 + 12) * 2);
      const or = cr * 4 + 1 + Math.floor(this.hash(cq, cr, cy * 7 + 13) * 2);
      const oy = cy * 4 + 1 + Math.floor(this.hash(cq, cr, cy * 7 + 14) * 2);
      const dh = hexDist(q - oq, r - or);
      if (dh > 1) continue;
      for (let y = oy - 1; y <= oy + 1; y++) {
        if (y < ylo || y > yhi || Math.floor(y / 4) !== cy || !free[y - base]) continue;
        const d = dh + Math.abs(y - oy);
        if (d === 0 || (d === 1 && this.hash(q, r, y + 5000) < 0.6)) { out[y - base] = COAL; free[y - base] = 0; }
      }
    }
  }
  // Diorite (cellules de 10 : voir dioriteAt)
  dioriteCells(q, r, ylo, yhi, out, free, base = -DEPTH) {
    if (ylo > yhi) return;
    const cq = Math.floor(q / 10), cr = Math.floor(r / 10);
    for (let cy = Math.floor(ylo / 10); cy <= Math.floor(yhi / 10); cy++) {
      const k = cy * 17 + 1501;
      if (this.hash(cq, cr, k) > 0.35) continue;
      const oq = cq * 10 + 2 + Math.floor(this.hash(cq, cr, k + 1) * 6);
      const or = cr * 10 + 2 + Math.floor(this.hash(cq, cr, k + 2) * 6);
      const oy = cy * 10 + 2 + Math.floor(this.hash(cq, cr, k + 3) * 6);
      const R = 2 + Math.floor(this.hash(cq, cr, k + 4) * 2);
      const dh = hexDist(q - oq, r - or);
      if (dh > R) continue;
      for (let y = Math.max(cy * 10, ylo); y <= Math.min(cy * 10 + 9, yhi); y++) {
        if (!free[y - base]) continue;
        const d = dh + Math.abs(y - oy) * 1.3;
        if (d < R || (d < R + 1 && this.hash(q, r, y + 1506) < 0.5)) { out[y - base] = DIORITE; free[y - base] = 0; }
      }
    }
  }
  // Minerais au-dessus de 0 d'une colonne du terrain v3 (terrain3 sans ses minerais : bare),
  // exactement ceux de terrain3 dans le même ordre
  surfaceOres(q, r, h, out, free) {
    const hi = h - 4, v = this.versionAt(q, r);
    if (v >= DEEP_GEN) {
      this.oreCells(q, r, 0, Math.min(5, hi), 1307, 0.14, FLUORITE_ORE, out, free, 0);
      this.oreCells(q, r, 2, Math.min(33, hi), 1201, 0.2, IMPURE_VOLTITE_ORE, out, free, 0);
      this.oreCells(q, r, 0, Math.min(79, hi), 401, 0.5, IRON_ORE, out, free, 0);
      this.coalCells(q, r, 0, hi, out, free, 0);
      this.dioriteCells(q, r, 0, hi, out, free, 0);
      return;
    }
    if (v >= 4) this.oreCells(q, r, 2, Math.min(8, hi), 1103, 0.07, TUNGSTEN_ORE, out, free, 0);
    this.oreCells(q, r, 2, Math.min(13, hi), 701, 0.16, VOLTITE_ORE, out, free, 0);
    if (v >= 4) this.oreCells(q, r, 2, Math.min(21, hi), 907, 0.12, PLATINUM_ORE, out, free, 0);
    if (v >= 4) this.oreCells(q, r, 2, Math.min(33, hi), 1201, 0.2, IMPURE_VOLTITE_ORE, out, free, 0);
    this.oreCells(q, r, 2, Math.min(this.raised ? 79 : 45, hi), 401, 0.5, IRON_ORE, out, free, 0);
    this.coalCells(q, r, 2, hi, out, free, 0);
    if (v >= 11) this.dioriteCells(q, r, 2, hi, out, free, 0);
  }

  // Diorite : de grosses poches dans la pierre, au plus une par cellule de 10x10x10
  dioriteAt(q, r, y) {
    const cq = Math.floor(q / 10), cr = Math.floor(r / 10), cy = Math.floor(y / 10), k = cy * 17 + 1501;
    if (this.hash(cq, cr, k) > 0.35) return false;
    const oq = cq * 10 + 2 + Math.floor(this.hash(cq, cr, k + 1) * 6);
    const or = cr * 10 + 2 + Math.floor(this.hash(cq, cr, k + 2) * 6);
    const oy = cy * 10 + 2 + Math.floor(this.hash(cq, cr, k + 3) * 6);
    const R = 2 + Math.floor(this.hash(cq, cr, k + 4) * 2);
    const d = hexDist(q - oq, r - or) + Math.abs(y - oy) * 1.3;
    return d < R || (d < R + 1 && this.hash(q, r, y + 1506) < 0.5);
  }

  // Bloc du terrain v3 (sans les arbres) à la hauteur y d'une colonne (h, biome, neige).
  // snow : drapeaux de la colonne (1 = neige au sommet, 2 = lac de lave, 4 = eau glaciale)
  // (8 : mer basse, au pied de l'anneau de montagnes)
  // (bare : sans les minerais ; une case de pierre où il pourrait y en avoir rend -2, voir surfaceOres)
  terrain3(q, r, y, h, biome, snow = 0, bare = false) {
    const deep = this.versionAt(q, r) >= DEEP_GEN;
    if (y === 0 && !deep && !this.breachAt(q, r)) return BEDROCK;
    const sea = snow & LOW_SEA ? SEA3 : this.sea;
    if (y > h) return y <= sea ? (snow & 4 ? ICE_WATER : WATER) : AIR;
    const depth = h - y; // 0 = surface
    switch (biome) {
      case BIOME.OCEAN:
        // grands fonds : roche nue avec des bancs de sable
        if (h < sea - 9 && this.hash(q >> 2, r >> 2, 77) < 0.55) {
          if (depth === 0) return STONE;
          break;
        }
        if (depth <= 2) return SAND;
        break;
      case BIOME.SEA: case BIOME.BEACH: case BIOME.RIVER: case BIOME.LAKE:
        if (depth <= 2) return SAND;
        if (depth <= 3) return DIRT;
        break;
      case BIOME.MOUNTAIN:
        // roche à nu sur les hauteurs, un peu d'herbe plus bas ; enneigées au-dessus de la
        // limite des neiges
        if (h >= sea + 23 + Math.floor(this.hash(q, r, 91) * 4)) {
          if (snow & 1 && depth === 0) return SNOW;
          break;
        }
        if (depth === 0) return snow & 1 ? SNOW_GRASS : GRASS;
        if (depth <= 1) return DIRT;
        break;
      case BIOME.DESERT:
        if (depth <= 3) return SAND;
        break;
      case BIOME.VOLCANO: {
        if (snow & 2) {
          // cratère : la lave, du magma dessous, puis de l'obsidienne
          if (depth <= 1) return LAVA;
          if (depth <= 2) return MAGMA;
          if (depth <= 4) return OBSIDIAN;
          break;
        }
        if (depth > 5) break;
        if (depth <= 1) {
          if (h > sea + (this.raised ? 58 : 34) && this.nDetail(q * 0.11, r * 0.11) > 0.45) return SULFUR; // près du sommet
          if (this.nDetail(q * 0.07 + 40, r * 0.07) > 0.62) return MAGMA;                   // coulées
          if (depth === 0 && this.nDetail(q * 0.09 - 40, r * 0.09) > 0.15) return ASH;      // cendres
          if (h < sea + 12) return TUFF;                                                     // au pied
        }
        if (this.hash(q, r, y + 333) < 0.04) return OBSIDIAN;
        return BASALT;
      }
      case BIOME.SNOWY:
        if (depth === 0) return SNOW_GRASS;
        if (depth <= 3) return DIRT;
        break;
      default: // plaines, forêts
        if (depth === 0) return GRASS;
        if (depth <= 3) return DIRT;
    }
    if (bare) return -2;
    if (deep) {
      if (y < h - 3) {
        // (les minerais rares sont dans les profondeurs : voir deepBlock)
        if (y <= 5 && this.oreAt(q, r, y, 1307, 0.14)) return FLUORITE_ORE;
        if (y >= 2 && y < 34 && this.oreAt(q, r, y, 1201, 0.2)) return IMPURE_VOLTITE_ORE;
        if (y < 80 && this.oreAt(q, r, y, 401, 0.5)) return IRON_ORE;
        if (this.coalAt(q, r, y)) return COAL;
        if (this.dioriteAt(q, r, y)) return DIORITE;
      }
      return STONE;
    }
    if (y >= 2 && y < h - 3) {
      // tungstène et voltite tout au fond, platine un peu au-dessus, voltite impure et fer
      // jusqu'à mi-hauteur, charbon partout (les nouveaux seulement depuis la version 4)
      if (y < 9 && this.oreAt(q, r, y, 1103, 0.07) && this.versionAt(q, r) >= 4) return TUNGSTEN_ORE;
      if (y < 14 && this.oreAt(q, r, y, 701, 0.16)) return VOLTITE_ORE;
      if (y < 22 && this.oreAt(q, r, y, 907, 0.12) && this.versionAt(q, r) >= 4) return PLATINUM_ORE;
      if (y < 34 && this.oreAt(q, r, y, 1201, 0.2) && this.versionAt(q, r) >= 4) return IMPURE_VOLTITE_ORE;
      if (y < (this.raised ? 80 : 46) && this.oreAt(q, r, y, 401, 0.5)) return IRON_ORE;
      if (this.coalAt(q, r, y)) return COAL;
      if (this.dioriteAt(q, r, y) && this.versionAt(q, r) >= 11) return DIORITE;
    }
    return STONE;
  }

  // Arbre v3 de la zone (cq, cr) : la densité dépend du biome.
  treeInCell3(cq, cr) {
    const q = cq * TREE_CELL + Math.floor(this.hash(cq, cr, 2) * (TREE_CELL - 1));
    const r = cr * TREE_CELL + Math.floor(this.hash(cq, cr, 3) * (TREE_CELL - 1));
    const col = this.column(q, r);
    const h = colH(col), snow = colFlags(col), sea = this.colSea(col);
    let biome = colBiome(col);
    // grande forêt : ses grands chênes n'apparaissent que dans les endroits jamais visités
    // avant HexaCraft 0.8.5 (sinon : une forêt ordinaire)
    if (biome === BIOME.BIG_FOREST && this.versionAt(q, r) < 5) biome = BIOME.FOREST;
    // forêt européenne : ses châtaigniers n'apparaissent que dans les endroits jamais visités
    // avant leur arrivée (sinon : une forêt ordinaire)
    if (biome === BIOME.EURO_FOREST && this.versionAt(q, r) < 6) biome = BIOME.FOREST;
    if (biome === BIOME.EURO_FOREST && this.hash(cq, cr, 1) < 0.85) {
      // un peu moins de la moitié de châtaigniers, quelques grands chênes, des tilleuls (dans
      // les endroits jamais visités avant leur arrivée), le reste : des chênes
      const kind = this.hash(cq, cr, 7);
      // (toute sa couronne dans des chunks récents : rien ne change dans les endroits déjà visités)
      const linden = kind >= 0.55 && kind < 0.78 && [[-4, -4], [4, -4], [-4, 4], [4, 4]].every(([a, b]) => this.versionAt(q + a, r + b) >= 8);
      if (kind < 0.55 || linden) {
        if (this.terrain3(q, r, h, h, biome, snow) !== GRASS) return null;
        const rnd = (i) => this.hash(q, r, 3000 + i);
        const t = linden ? this.linden(q, r, h + 1, rnd)
          : kind < 0.45 ? this.chestnut(q, r, h + 1, rnd) : this.bigOak(q, r, h + 1, rnd, LEAVES);
        return t.top + 4 < this.H ? t : null;
      }
    }
    if (biome === BIOME.BIG_FOREST && this.hash(cq, cr, 1) < 0.9 && this.hash(cq, cr, 7) < 0.55) {
      if (this.terrain3(q, r, h, h, biome, snow) !== GRASS) return null;
      const t = this.bigOak(q, r, h + 1, (i) => this.hash(q, r, 2000 + i), LEAVES);
      return t.top + 4 < this.H ? t : null;
    }
    let chance = 0, extra = 0;
    if (biome === BIOME.FOREST) { chance = 0.9; extra = 2; }
    else if (biome === BIOME.BIG_FOREST) { chance = 0.9; extra = 3; }
    else if (biome === BIOME.EURO_FOREST) { chance = 0.85; extra = 3; }
    else if (biome === BIOME.PLAINS) chance = 0.05;
    else if (biome === BIOME.MOUNTAIN) chance = h < sea + 22 ? 0.3 : 0;
    else if (biome === BIOME.SNOWY) chance = 0.15; // quelques arbres isolés dans la neige
    if (this.hash(cq, cr, 1) >= chance) return null;
    const ground = this.terrain3(q, r, h, h, biome, snow);
    if (ground !== GRASS && ground !== SNOW_GRASS) return null;
    const trunk = 4 + Math.floor(this.hash(cq, cr, 4) * (2 + extra));
    if (h + trunk + 2 >= this.H) return null;
    // dans la neige (plaines enneigées, pentes au-dessus de la limite des neiges) : feuilles blanches
    const leaves = biome === BIOME.SNOWY || snow & 1 ? SNOW_LEAVES : LEAVES;
    // bouleaux : un arbre sur trois dans les forêts et les plaines (seulement dans les endroits
    // jamais visités avant leur arrivée, toute la couronne comprise)
    if ((biome === BIOME.FOREST || biome === BIOME.PLAINS) && leaves === LEAVES && this.hash(cq, cr, 9) < 0.33
      && [[-3, -3], [3, -3], [-3, 3], [3, 3]].every(([a, b]) => this.versionAt(q + a, r + b) >= 11)) {
      const t = this.birch(q, r, h + 1, (i) => this.hash(q, r, 4000 + i));
      return t.top + 4 < this.H ? t : null;
    }
    return { q, r, base: h + 1, top: h + trunk, leaves };
  }

  // Cactus du désert sur la colonne (q, r) : sa hauteur (0 = pas de cactus).
  // Herbe haute sur cette case d'herbe ? (par plaques : un hasard grossier, par zones de 6 x 6,
  // module la densité). Elle n'existe qu'à la génération : elle ne pousse pas toute seule.
  tuftAt(q, r, biome) {
    const p = TUFT[biome];
    if (!p || this.versionAt(q, r) < 10) return false;
    return this.hash(q, r, 4421) < p * (0.4 + 1.2 * this.hash(Math.floor(q / 6), Math.floor(r / 6), 4422));
  }

  cactusAt(q, r, biome) {
    if (biome !== BIOME.DESERT || this.hash(q, r, 555) > 0.012) return 0;
    return 1 + Math.floor(this.hash(q, r, 556) * 3);
  }

  // Point d'apparition v3 : on cherche en spirale une zone de plaine ou de forêt bien
  // à l'intérieur d'un continent, puis une case d'herbe libre.
  findSpawn3() {
    const STEP = this.version >= 4 ? 96 : 48; // les méga-océans peuvent être immenses
    let x = 0, z = 0, dx = STEP, dz = 0, len = 1, done = 0, turns = 0;
    for (let i = 0; i < 60000; i++) {
      const { q, r } = worldToHex(x, z);
      const info = this.columnAt(x, z);
      if (info.cont > 0.12 && (info.biome === BIOME.PLAINS || info.biome === BIOME.FOREST)) {
        const s = this.findSpawnNear(q, r, 30);
        if (s) return s;
      }
      x += dx; z += dz;
      if (++done === len) {
        done = 0;
        [dx, dz] = [-dz, dx];
        if (++turns % 2 === 0) len++;
      }
    }
    return null;
  }

  // Couche de la surface (le bloc d'herbe) de la colonne (q, r).
  height(q, r) {
    if (this.type === 'flat') return this.version >= FLAT_LOW ? FLAT_LOW_Y : 3;
    if (this.type === 'tutorial') return stationColumn(q, r)?.[0][0] ?? -1;
    if (this.v3) return colH(this.column(q, r));
    const key = q * 100003 + r;
    let h = this.heights.get(key);
    if (h !== undefined) return h;
    const { x, z } = hexToWorld(q, r);
    let n = 0, amp = 1, freq = 0.012, norm = 0;
    for (let o = 0; o < 4; o++) {
      n += this.noiseA(x * freq, z * freq) * amp;
      norm += amp;
      amp *= 0.5;
      freq *= 2;
    }
    n /= norm;
    const mountain = Math.max(0, this.noiseB(x * 0.004, z * 0.004) - 0.15) / 0.85; // 0..1
    const detail = this.version < 2 ? this.noiseC(x * 0.08, z * 0.08) * 0.6 : 0;
    h = Math.floor(22 + n * 7 + mountain * mountain * 26 + detail);
    h = Math.max(4, Math.min(this.H - 10, h));
    if (this.heights.size > 200000) this.heights.clear();
    this.heights.set(key, h);
    return h;
  }

  terrain(y, h, cv = GEN_CONTENT, q = 0, r = 0) {
    if (this.type === 'tutorial') return AIR;
    if (y === 0 && (this.type === 'flat' ? this.version < FLAT_LOW : this.type !== 'normal' || (cv < DEEP_GEN && !this.breachAt(q, r)))) return BEDROCK;
    const normal = this.type === 'normal' && cv >= 2; // eau et sable depuis la version 2
    if (y > h) return normal && y <= SEA ? WATER : AIR;
    if (this.type === 'normal' && y <= h - 4) return STONE;
    if (normal && h <= SEA + 1 && y >= h - 2) return SAND; // plages et fonds marins
    if (y === h) return GRASS;
    return DIRT;
  }

  // Arbre de la zone (cq, cr) ou null.
  treeInCell(cq, cr) {
    const key = cq * 100003 + cr;
    if (this.trees.has(key)) return this.trees.get(key);
    let tree = null;
    if (this.v3) {
      tree = this.treeInCell3(cq, cr);
      // pas d'arbre dans un village (ni juste à côté des maisons)
      if (tree && this.nearVillage(tree.q, tree.r, 4)) tree = null;
    } else if (this.type === 'normal' && this.hash(cq, cr, 1) < 0.45) {
      const q = cq * TREE_CELL + Math.floor(this.hash(cq, cr, 2) * (TREE_CELL - 2));
      const r = cr * TREE_CELL + Math.floor(this.hash(cq, cr, 3) * (TREE_CELL - 2));
      const h = this.height(q, r);
      const trunk = 4 + Math.floor(this.hash(cq, cr, 4) * 2);
      // pas d'arbres sur les sommets des montagnes, ni sur les plages ou dans l'eau
      const onBeach = this.versionAt(q, r) >= 2 && h <= SEA + 1;
      if (h < 38 && !onBeach && h + trunk + 2 < this.H) tree = { q, r, base: h + 1, top: h + trunk };
    }
    if (this.trees.size > 50000) this.trees.clear();
    this.trees.set(key, tree);
    return tree;
  }

  // Grand chêne au pied (q, r, base) : tronc épais (7 cases) en bas, branches, grande couronne.
  // rnd(i) : nombre au hasard dans [0, 1) (le même pour un même i : arbres du monde
  // toujours identiques). Renvoie { big, q, r, base, top, cells (Map "q,r,y" -> bloc),
  // cols (Map "q,r" -> plus haut bloc { y, id }) }.
  bigOak(q, r, base, rnd, leaves = LEAVES) {
    const cells = new Map();
    const put = (a, b, y, id) => { const k = a + ',' + b + ',' + y; if (id === LOG || !cells.has(k)) cells.set(k, id); };
    const H = 10 + Math.floor(rnd(0) * 4), top = base + H - 1;
    const thick = base + Math.floor(H * 0.45);
    for (let y = base; y <= top; y++) {
      put(q, r, y, LOG);
      if (y <= thick) for (const [dq, dr] of DIRS) put(q + dq, r + dr, y, LOG);
    }
    // feuillage en boule : couches de rayon R, R - 1... (bords un peu troués)
    const blob = (cq, cr, cy, R, up) => {
      for (let dy = -1; dy <= up; dy++) {
        const rr = R - Math.abs(dy);
        for (let dq = -rr; dq <= rr; dq++) {
          for (let dr = Math.max(-rr, -dq - rr); dr <= Math.min(rr, -dq + rr); dr++) {
            const d = hexDist(dq, dr);
            if (d === rr && rr > 0 && this.hash(cq + dq, cr + dr, cy + dy + 4321) > 0.6) continue;
            put(cq + dq, cr + dr, cy + dy, leaves);
          }
        }
      }
    };
    // branches : 3 ou 4, dans des directions différentes, qui montent en s'écartant
    const nb = 3 + Math.floor(rnd(1) * 2), d0 = Math.floor(rnd(2) * 6);
    for (let i = 0; i < nb; i++) {
      const [dq, dr] = DIRS[(d0 + i * 2 + (i >= 3 ? 1 : 0)) % 6];
      let bq = q, br = r, y = top - 2 - Math.floor(rnd(3 + i) * 3);
      const len = 2 + Math.floor(rnd(10 + i) * 2);
      for (let s = 1; s <= len; s++) {
        bq += dq; br += dr;
        if (s % 2 === 0) y++;
        put(bq, br, y, LOG);
      }
      blob(bq, br, y + 1, 2, 1);
    }
    blob(q, r, top + 1, 3, 2); // couronne
    const cols = new Map();
    for (const [k, id] of cells) {
      const [a, b, y] = k.split(',').map(Number), ck = a + ',' + b, c = cols.get(ck);
      if (!c || y > c.y) cols.set(ck, { y, id });
    }
    return { big: true, q, r, base, top: top + 3, cells, cols, leaves };
  }

  // Châtaignier au pied (q, r, base) : haut tronc droit, deux ou trois grosses branches qui
  // s'écartent, et une large couronne arrondie, plus aplatie que celle d'un chêne. Même forme
  // de résultat que bigOak (cells, cols) : il est dessiné, sauvegardé et coupé pareil.
  chestnut(q, r, base, rnd) {
    const cells = new Map();
    const put = (a, b, y, id) => { const k = a + ',' + b + ',' + y; if (id === CHESTNUT_LOG || !cells.has(k)) cells.set(k, id); };
    const H = 7 + Math.floor(rnd(0) * 3), top = base + H - 1;
    for (let y = base; y <= top; y++) put(q, r, y, CHESTNUT_LOG);
    // feuillage : couches empilées, la plus large au milieu (bords un peu troués)
    const crown = (cq, cr, cy, R, below, above) => {
      for (let dy = -below; dy <= above; dy++) {
        const rr = R - (dy > 0 ? dy : dy < -1 ? -dy - 1 : 0);
        for (let dq = -rr; dq <= rr; dq++) {
          for (let dr = Math.max(-rr, -dq - rr); dr <= Math.min(rr, -dq + rr); dr++) {
            if (hexDist(dq, dr) === rr && rr > 1 && this.hash(cq + dq, cr + dr, cy + dy + 8765) > 0.55) continue;
            put(cq + dq, cr + dr, cy + dy, CHESTNUT_LEAVES);
          }
        }
      }
    };
    // branches : du haut du tronc, en diagonale vers l'extérieur
    const nb = 2 + Math.floor(rnd(1) * 2), d0 = Math.floor(rnd(2) * 6);
    for (let i = 0; i < nb; i++) {
      const [dq, dr] = DIRS[(d0 + i * 2) % 6];
      let bq = q, br = r, y = top - 2 - Math.floor(rnd(3 + i) * 2);
      for (let s = 1; s <= 2; s++) { bq += dq; br += dr; y++; put(bq, br, y, CHESTNUT_LOG); }
      crown(bq, br, y + 1, 2, 1, 1);
    }
    crown(q, r, top + 1, 3, 2, 1); // couronne : large et arrondie
    const cols = new Map();
    for (const [k, id] of cells) {
      const [a, b, y] = k.split(',').map(Number), ck = a + ',' + b, c = cols.get(ck);
      if (!c || y > c.y) cols.set(ck, { y, id });
    }
    return { big: true, q, r, base, top: top + 2, cells, cols, leaves: CHESTNUT_LEAVES };
  }

  // Tilleul au pied (q, r, base) : haut tronc droit et couronne dense en forme de dôme, plus
  // haute que large (étroite en bas, la plus large aux deux tiers, arrondie en haut). Même
  // forme de résultat que bigOak (cells, cols).
  linden(q, r, base, rnd) {
    const cells = new Map();
    const put = (a, b, y, id) => { const k = a + ',' + b + ',' + y; if (id === LINDEN_LOG || !cells.has(k)) cells.set(k, id); };
    const H = 9 + Math.floor(rnd(0) * 3), top = base + H - 1;
    for (let y = base; y <= top; y++) put(q, r, y, LINDEN_LOG);
    // deux ou trois courtes branches dans la couronne
    const nb = 2 + Math.floor(rnd(1) * 2), d0 = Math.floor(rnd(2) * 6);
    for (let i = 0; i < nb; i++) {
      const [dq, dr] = DIRS[(d0 + i * 2) % 6];
      put(q + dq, r + dr, top - 3 + Math.floor(rnd(3 + i) * 3), LINDEN_LOG);
    }
    // couronne : de c0 (sous le haut du tronc) à c1 (au-dessus), rayon selon la hauteur
    const c0 = base + 3 + Math.floor(rnd(6) * 2), c1 = top + 2;
    for (let y = c0; y <= c1 + 1; y++) {
      const t = (y - c0) / (c1 - c0);
      const R = y > c1 ? 0 : Math.max(1, Math.round(3.4 * Math.sin(Math.PI * (0.18 + 0.74 * t))));
      for (let dq = -R; dq <= R; dq++) {
        for (let dr = Math.max(-R, -dq - R); dr <= Math.min(R, -dq + R); dr++) {
          // bords un peu troués (feuillage dense : peu de trous)
          if (hexDist(dq, dr) === R && R > 1 && this.hash(q + dq, r + dr, y + 6543) > 0.7) continue;
          put(q + dq, r + dr, y, LINDEN_LEAVES);
        }
      }
    }
    const cols = new Map();
    for (const [k, id] of cells) {
      const [a, b, y] = k.split(',').map(Number), ck = a + ',' + b, c = cols.get(ck);
      if (!c || y > c.y) cols.set(ck, { y, id });
    }
    return { big: true, q, r, base, top: c1 + 1, cells, cols, leaves: LINDEN_LEAVES };
  }

  // Bouleau au pied (q, r, base) : tronc blanc, mince et droit, petite couronne étroite et
  // haute (rayon 2 au plus). Même forme de résultat que bigOak (cells, cols).
  birch(q, r, base, rnd) {
    const cells = new Map();
    const put = (a, b, y, id) => { const k = a + ',' + b + ',' + y; if (id === BIRCH_LOG || !cells.has(k)) cells.set(k, id); };
    const H = 6 + Math.floor(rnd(0) * 3), top = base + H - 1;
    for (let y = base; y <= top; y++) put(q, r, y, BIRCH_LOG);
    const c0 = top - 3 - Math.floor(rnd(1) * 2);
    for (let y = c0; y <= top + 1; y++) {
      const R = y === c0 || y === top + 1 ? 1 : 2;
      for (let dq = -R; dq <= R; dq++) {
        for (let dr = Math.max(-R, -dq - R); dr <= Math.min(R, -dq + R); dr++) {
          if (hexDist(dq, dr) === R && R > 1 && this.hash(q + dq, r + dr, y + 7321) > 0.65) continue;
          put(q + dq, r + dr, y, BIRCH_LEAVES);
        }
      }
    }
    put(q, r, top + 2, BIRCH_LEAVES);
    const cols = new Map();
    for (const [k, id] of cells) {
      const [a, b, y] = k.split(',').map(Number), ck = a + ',' + b, c = cols.get(ck);
      if (!c || y > c.y) cols.set(ck, { y, id });
    }
    return { big: true, q, r, base, top: top + 2, cells, cols, leaves: BIRCH_LEAVES };
  }

  // Arbres dont le feuillage peut toucher la zone [qa..qb] x [ra..rb].
  treesNear(qa, qb, ra, rb) {
    const list = [], M = this.v3 ? TREE_MARGIN : 2;
    for (let cq = Math.floor((qa - M) / TREE_CELL); cq <= Math.floor((qb + M) / TREE_CELL); cq++) {
      for (let cr = Math.floor((ra - M) / TREE_CELL); cr <= Math.floor((rb + M) / TREE_CELL); cr++) {
        const t = this.treeInCell(cq, cr);
        if (t) list.push(t);
      }
    }
    return list;
  }

  leafAt(t, q, r, y) {
    if (t.big) return false; // (grands chênes : voir bigOak)
    const dq = q - t.q, dr = r - t.r;
    const d = hexDist(dq, dr);
    const dy = y - t.top;
    if (d === 0 && dy <= 0) return false; // c'est le tronc
    if (dy === -2 || dy === -1) return d <= 1 || (d === 2 && this.hash(q, r, y) > 0.25);
    if (dy === 0) return d <= 1;
    if (dy === 1) return d === 0 || (d === 1 && this.hash(q, r, y) > 0.45);
    return false;
  }

  // Bloc généré en (q, r, y), avant les modifications du joueur.
  block(q, r, y) {
    if (y < 0) return this.deepBlock(q, r, y);
    if (y >= this.H) return AIR;
    if (this.type === 'tutorial') return stationBlock(q, r, y);
    const ru = this.v3 && (this.ruinAt(q, r) || this.villageAt(q, r));
    if (ru) {
      const c = ru.cols.get(q + ',' + r);
      if (y >= ru.base && y <= ru.base + ru.top) return c.blocks[y - ru.base] || AIR;
      if (y > c.ground && y < ru.base) return this.hash(q, r, y + 977) < 0.3 ? MOSSY : COBBLE;
    }
    let t, tuft = false;
    if (this.v3 && this.versionAt(q, r) >= MINE_SHAFT_GEN) {
      const sh = this.shaftTop(q, r);
      if (sh > 0) { const mb = this.mineBlock(q, r, y, sh); if (mb >= 0) return mb; }
    }
    if (this.v3) {
      const col = this.column(q, r), h = colH(col), biome = colBiome(col);
      t = this.terrain3(q, r, y, h, biome, colFlags(col));
      if (t === AIR && y > h && y <= h + this.cactusAt(q, r, biome)) return CACTUS;
      tuft = t === AIR && y === h + 1 && this.tuftAt(q, r, biome) && this.terrain3(q, r, h, h, biome, colFlags(col)) === GRASS;
    } else t = this.terrain(y, this.height(q, r), this.versionAt(q, r), q, r);
    if (t !== AIR || this.type !== 'normal') return t;
    const trees = this.treesNear(q, q, r, r);
    for (const tr of trees) if (!tr.big && tr.q === q && tr.r === r && y >= tr.base && y <= tr.top) return LOG;
    const k = q + ',' + r + ',' + y;
    for (const tr of trees) if (tr.big && tr.cells.has(k)) return tr.cells.get(k);
    for (const tr of trees) if (this.leafAt(tr, q, r, y)) return tr.leaves || LEAVES;
    return tuft ? TALL_GRASS : AIR;
  }

  // Bloc visible le plus haut de la colonne (pour les chunks lointains simplifiés).
  // h/id : dessus de la colonne (peut être de l'eau) ; fh/fid : dernier bloc opaque dessous.
  surface(q, r) {
    if (this.type === 'tutorial') {
      const c = stationColumn(q, r);
      return c ? { h: c[0][0], id: c[0][1], fh: c[0][0], fid: c[0][1] } : { h: -DEPTH - 1, id: AIR, fh: -DEPTH - 1, fid: AIR };
    }
    const ru = this.v3 && (this.ruinAt(q, r) || this.villageAt(q, r));
    if (ru) {
      const c = ru.cols.get(q + ',' + r);
      for (let dy = ru.top; dy >= 0; dy--) {
        if (c.blocks[dy]) return { h: ru.base + dy, id: c.blocks[dy], fh: ru.base + dy, fid: c.blocks[dy] };
      }
    }
    const h = this.height(q, r);
    const cv = this.versionAt(q, r);
    const col = this.v3 ? this.column(q, r) : 0;
    const fid = this.v3 ? this.terrain3(q, r, h, h, colBiome(col), colFlags(col)) : this.terrain(h, h, cv);
    if (this.v3 && h < this.colSea(col)) return { h: this.colSea(col), id: colIce(col) ? ICE_WATER : WATER, fh: h, fid };
    if (!this.v3 && this.type === 'normal' && cv >= 2 && h < SEA) return { h: SEA, id: WATER, fh: h, fid };
    let top = h, id = fid;
    if (this.type === 'normal') {
      for (const t of this.treesNear(q, q, r, r)) {
        if (t.big) {
          const c = t.cols.get(q + ',' + r);
          if (c && c.y > top) { top = c.y; id = c.id; }
          continue;
        }
        for (let y = t.top + 1; y > top; y--) {
          if ((t.q === q && t.r === r && y <= t.top) || this.leafAt(t, q, r, y)) {
            top = y;
            id = t.q === q && t.r === r && y <= t.top ? LOG : t.leaves || LEAVES;
            break;
          }
        }
      }
    }
    return { h: top, id, fh: top, fid: id };
  }

  // Remplit un chunk (tableau indexé par idx(lq, lr, y)).
  // (noDeep : les profondeurs sont déjà remplies, voir Generator.fillChunk)
  fillChunk(data, q0, r0, CS, idx, noDeep = false) {
    // profondeurs (le vide de l'espace pour le tutoriel : rien à remplir)
    if (this.type !== 'tutorial' && !noDeep) {
      for (let lr = 0; lr < CS; lr++) {
        for (let lq = 0; lq < CS; lq++) {
          const q = q0 + lq, r = r0 + lr, lk = this.lakeCol(q, r), mc = this.type === 'normal' ? this.mineCol(q, r) : null;
          if (this.type === 'normal') {
            const col = this.deepCol || (this.deepCol = new Uint16Array(DEPTH));
            this.deepColumn(q, r, lk, mc, col);
            for (let y = -DEPTH; y < 0; y++) data[idx(lq, lr, y)] = col[y + DEPTH];
          } else for (let y = -DEPTH; y < 0; y++) data[idx(lq, lr, y)] = this.deepBlock(q, r, y, lk, mc);
        }
      }
    }
    if (this.type === 'tutorial') {
      for (let lr = 0; lr < CS; lr++) {
        for (let lq = 0; lq < CS; lq++) {
          const c = stationColumn(q0 + lq, r0 + lr);
          if (c) for (const [y, id] of c) data[idx(lq, lr, y)] = id;
        }
      }
      return;
    }
    const cv = this.versionAt(q0, r0);
    const tufts = []; // herbe haute (posée après les arbres, dans l'air seulement, comme block())
    for (let lr = 0; lr < CS; lr++) {
      for (let lq = 0; lq < CS; lq++) {
        if (this.v3) {
          const q = q0 + lq, r = r0 + lr;
          const col = this.column(q, r);
          const h = colH(col), biome = colBiome(col), snow = colFlags(col);
          const top = Math.max(h, this.colSea(col));
          // (la colonne sans ses minerais, puis les minerais cherchés par cellule : voir surfaceOres)
          const sc = this.surfCol || (this.surfCol = new Uint16Array(WORLD_HEIGHT)), free = this.surfFree || (this.surfFree = new Uint8Array(WORLD_HEIGHT));
          for (let y = 0; y <= top; y++) {
            const t = this.terrain3(q, r, y, h, biome, snow, true);
            if (t === -2) { sc[y] = STONE; free[y] = 1; } else { sc[y] = t; free[y] = 0; }
          }
          this.surfaceOres(q, r, h, sc, free);
          for (let y = 0; y <= top; y++) data[idx(lq, lr, y)] = sc[y];
          // puits d'une mine abandonnée (chunks récents, sur la terre ferme)
          if (cv >= MINE_SHAFT_GEN) {
            const sh = this.shaftTop(q, r);
            if (sh > 0) for (let y = 0; y <= sh + 3 && y < this.H; y++) { const mb = this.mineBlock(q, r, y, sh); if (mb >= 0) data[idx(lq, lr, y)] = mb; }
          }
          const cactus = this.cactusAt(q, r, biome);
          for (let y = h + 1; y <= h + cactus && y < this.H; y++) data[idx(lq, lr, y)] = CACTUS;
          if (data[idx(lq, lr, h)] === GRASS && h + 1 < this.H && this.tuftAt(q, r, biome)) tufts.push(idx(lq, lr, h + 1));
          continue;
        }
        const h = this.height(q0 + lq, r0 + lr);
        const top = this.type === 'normal' && cv >= 2 ? Math.max(h, SEA) : h;
        for (let y = 0; y <= top; y++) data[idx(lq, lr, y)] = this.terrain(y, h, cv, q0 + lq, r0 + lr);
      }
    }
    if (this.type !== 'normal') return;

    const inside = (q, r) => q >= q0 && q < q0 + CS && r >= r0 && r < r0 + CS;
    const trees = this.treesNear(q0, q0 + CS - 1, r0, r0 + CS - 1);
    for (const t of trees) {
      if (t.big || !inside(t.q, t.r)) continue;
      for (let y = t.base; y <= t.top; y++) data[idx(t.q - q0, t.r - r0, y)] = LOG;
    }
    // grands chênes (dans l'air seulement, comme block())
    for (const t of trees) {
      if (!t.big) continue;
      for (const [k, id] of t.cells) {
        const [q, r, y] = k.split(',').map(Number);
        if (!inside(q, r) || y >= this.H) continue;
        const i = idx(q - q0, r - r0, y);
        if (data[i] === AIR) data[i] = id;
      }
    }
    for (const t of trees) {
      for (let dy = -2; dy <= 1; dy++) {
        const y = t.top + dy;
        for (let dq = -2; dq <= 2; dq++) {
          for (let dr = Math.max(-2, -dq - 2); dr <= Math.min(2, -dq + 2); dr++) {
            const q = t.q + dq, r = t.r + dr;
            if (!inside(q, r)) continue;
            const i = idx(q - q0, r - r0, y);
            if (data[i] === AIR && this.leafAt(t, q, r, y)) data[i] = t.leaves || LEAVES;
          }
        }
      }
    }
    for (const i of tufts) if (data[i] === AIR) data[i] = TALL_GRASS;
    // ruines (même résultat que block(), case par case)
    if (!this.v3) return;
    const pieces = [...this.ruinsNear(q0, q0 + CS - 1, r0, r0 + CS - 1).filter((ru) => this.ruinActive(ru)),
      ...this.villagePiecesNear(q0, q0 + CS - 1, r0, r0 + CS - 1)];
    for (const ru of pieces) {
      for (const [k, c] of ru.cols) {
        const [q, r] = k.split(',').map(Number);
        if (!inside(q, r)) continue;
        for (let y = c.ground + 1; y <= ru.base + ru.top && y < this.H; y++) data[idx(q - q0, r - r0, y)] = this.block(q, r, y);
      }
    }
  }

  // ---------- Ruines ----------
  // Ruine de la zone (ci, cj), ou null. { base, top, cols: Map "q,r" -> { ground, blocks[dy] },
  // q0..q1 / r0..r1 : emprise }
  ruinInCell(ci, cj) {
    const k = ci * 100003 + cj;
    if (this.ruins.has(k)) return this.ruins.get(k);
    let found = null;
    const model = RUINS[Math.floor(this.hash(ci, cj, 1301) * RUINS.length)];
    for (let n = 0; n < RUIN_TRIES && !found; n++) {
      const aq = ci * RUIN_CELL + 100 + Math.floor(this.hash(ci, cj, 1310 + n) * (RUIN_CELL - 200));
      const ar = cj * RUIN_CELL + 100 + Math.floor(this.hash(ci, cj, 1330 + n) * (RUIN_CELL - 200));
      const rot = Math.floor(this.hash(ci, cj, 1350 + n) * 6);
      const cols = new Map();
      let lo = Infinity, hi = -Infinity, top = 0, ok = true;
      for (const [dq0, dr0, dy, id] of model.blocks) {
        let dq = dq0, dr = dr0;
        for (let i = 0; i < rot; i++) [dq, dr] = [-dr, dq + dr];
        const key = (aq + dq) + ',' + (ar + dr);
        let c = cols.get(key);
        if (!c) {
          const col = this.column(aq + dq, ar + dr), h = colH(col);
          // pas dans l'eau, ni sur un volcan
          if (h <= this.colSea(col) || colBiome(col) === BIOME.VOLCANO) { ok = false; break; }
          c = { ground: h, blocks: [] };
          cols.set(key, c);
          lo = Math.min(lo, h); hi = Math.max(hi, h);
        }
        c.blocks[dy] = id;
        top = Math.max(top, dy);
      }
      if (!ok || hi - lo > RUIN_MAX_SLOPE || hi + 1 + top >= this.H) continue;
      // posée sur le point le plus haut de son emprise (rien d'enterré)
      found = { base: hi + 1, top, cols };
      let q0 = Infinity, q1 = -Infinity, r0 = Infinity, r1 = -Infinity;
      for (const key of cols.keys()) {
        const [q, r] = key.split(',').map(Number);
        q0 = Math.min(q0, q); q1 = Math.max(q1, q); r0 = Math.min(r0, r); r1 = Math.max(r1, r);
      }
      Object.assign(found, { q0, q1, r0, r1 });
    }
    this.ruins.set(k, found);
    return found;
  }

  // Une ruine n'apparaît que dans les chunks créés depuis qu'elles existent (HexaCraft 0.8) :
  // les endroits déjà visités d'un monde ne changent pas
  ruinActive(ru) {
    for (const key of ru.cols.keys()) {
      const [q, r] = key.split(',').map(Number);
      if (this.versionAt(q, r) < 3) return false;
    }
    return true;
  }

  // Ruine dont l'emprise contient la colonne (q, r), ou null
  ruinAt(q, r) {
    const ru = this.ruinInCell(Math.floor(q / RUIN_CELL), Math.floor(r / RUIN_CELL));
    if (!ru || q < ru.q0 || q > ru.q1 || r < ru.r0 || r > ru.r1 || !ru.cols.has(q + ',' + r)) return null;
    return this.ruinActive(ru) ? ru : null;
  }

  // Ruines dont l'emprise touche le rectangle [qa, qb] x [ra, rb]
  ruinsNear(qa, qb, ra, rb) {
    const out = [];
    for (let ci = Math.floor(qa / RUIN_CELL); ci <= Math.floor(qb / RUIN_CELL); ci++) {
      for (let cj = Math.floor(ra / RUIN_CELL); cj <= Math.floor(rb / RUIN_CELL); cj++) {
        const ru = this.ruinInCell(ci, cj);
        if (ru && ru.q1 >= qa && ru.q0 <= qb && ru.r1 >= ra && ru.r0 <= rb) out.push(ru);
      }
    }
    return out;
  }

  // ---------- Villages ----------
  // Place la liste de blocs [dq, dr, dy, id] autour de (aq, ar) : { base, top, cols, q0..r1 }
  // (comme une ruine : posée sur le point le plus haut de son emprise), ou null si le terrain
  // ne va pas (eau, volcan, trop de pente)
  placePiece(list, aq, ar) {
    const cols = new Map();
    let lo = Infinity, hi = -Infinity, top = 0;
    for (const [dq, dr, dy, id] of list) {
      const key = (aq + dq) + ',' + (ar + dr);
      let c = cols.get(key);
      if (!c) {
        const col = this.column(aq + dq, ar + dr), h = colH(col);
        if (h <= this.colSea(col) || colBiome(col) === BIOME.VOLCANO) return null;
        c = { ground: h, blocks: [] };
        cols.set(key, c);
        lo = Math.min(lo, h); hi = Math.max(hi, h);
      }
      c.blocks[dy] = id;
      top = Math.max(top, dy);
    }
    if (hi - lo > RUIN_MAX_SLOPE || hi + 1 + top >= this.H) return null;
    let q0 = Infinity, q1 = -Infinity, r0 = Infinity, r1 = -Infinity;
    for (const key of cols.keys()) {
      const [q, r] = key.split(',').map(Number);
      q0 = Math.min(q0, q); q1 = Math.max(q1, q); r0 = Math.min(r0, r); r1 = Math.max(r1, r);
    }
    return { base: hi + 1, top, cols, q0, q1, r0, r1, q: aq, r: ar };
  }

  // Village de la zone (ci, cj), ou null : { key, q, r (centre), pieces, doors [[q, r, y]] }
  villageInCell(ci, cj) {
    const k = ci * 100003 + cj;
    if (this.villages.has(k)) return this.villages.get(k);
    let v = null;
    if (this.type === 'normal' && this.hash(ci, cj, 2201) < VILLAGE_CHANCE) {
      // centre : un endroit des plaines (quelques essais dans la zone)
      let cq = 0, cr = 0, well = null;
      for (let n = 0; n < 16 && !well; n++) {
        cq = ci * VILLAGE_CELL + VILLAGE_MARGIN + Math.floor(this.hash(ci, cj, 2211 + n * 7) * (VILLAGE_CELL - 2 * VILLAGE_MARGIN));
        cr = cj * VILLAGE_CELL + VILLAGE_MARGIN + Math.floor(this.hash(ci, cj, 2221 + n * 7) * (VILLAGE_CELL - 2 * VILLAGE_MARGIN));
        if (colBiome(this.column(cq, cr)) === BIOME.PLAINS) well = this.placePiece(WELL, cq, cr);
      }
      if (well) {
        v = { key: ci + ':' + cj, q: cq, r: cr, pieces: [well], doors: [], houses: [] };
        const centers = [[cq, cr, 1]];
        for (let n = 0; n < VILLAGE_TRIES && v.doors.length < VILLAGE_HOUSES; n++) {
          const big = v.doors.length === 0;
          const rad = big ? 3 : 2;
          const ang = this.hash(ci, cj, 2300 + n) * Math.PI * 2, dist = 9 + this.hash(ci, cj, 2340 + n) * 10;
          // décalage (x, z) du monde -> cases axiales
          const ox = Math.cos(ang) * dist, oz = Math.sin(ang) * dist;
          const dr = Math.round(oz / SIZE_R), dq = Math.round(ox - dr / 2);
          const aq = cq + dq, ar = cr + dr;
          if (centers.some(([q, r, rr]) => hexDist(aq - q, ar - r) < rad + rr + 3)) continue;
          if (colBiome(this.column(aq, ar)) !== BIOME.PLAINS) continue;
          // porte du côté du puits
          let door = 0, best = -Infinity;
          for (let d = 0; d < 6; d++) {
            const [a, b] = midCell(rad, d);
            const score = -((aq + a - cq) ** 2 + (ar + b - cr) ** 2 + (aq + a - cq) * (ar + b - cr));
            if (score > best) { best = score; door = d; }
          }
          const wall = WALLS[Math.floor(this.hash(ci, cj, 2380 + n) * WALLS.length)];
          const roof = this.hash(ci, cj, 2420 + n) < 0.6 ? 33 : 32;
          const piece = this.placePiece(houseBlocks(rad, wall, roof, door), aq, ar);
          if (!piece) continue;
          v.pieces.push(piece);
          centers.push([aq, ar, rad]);
          v.doors.push([aq, ar, piece.base + 1]); // (les habitants apparaissent dans la maison)
          v.houses.push({ q: aq, r: ar, y: piece.base, rad, door }); // (plancher en y, voir colony.js)
        }
        if (!v.doors.length) v = null;
      }
    }
    this.villages.set(k, v);
    return v;
  }

  // Une partie de village n'apparaît que dans les chunks créés depuis qu'ils existent
  pieceActive(p) {
    for (const key of p.cols.keys()) {
      const [q, r] = key.split(',').map(Number);
      if (this.versionAt(q, r) < 9) return false;
    }
    return true;
  }

  // Une partie de village (active) à moins de m cases de (q, r) ?
  nearVillage(q, r, m) {
    const v = this.villageInCell(Math.floor(q / VILLAGE_CELL), Math.floor(r / VILLAGE_CELL));
    if (!v) return false;
    return v.pieces.some((p) => q >= p.q0 - m && q <= p.q1 + m && r >= p.r0 - m && r <= p.r1 + m && this.pieceActive(p));
  }

  // Partie de village (puits, maison) dont l'emprise contient la colonne (q, r), ou null
  villageAt(q, r) {
    const v = this.villageInCell(Math.floor(q / VILLAGE_CELL), Math.floor(r / VILLAGE_CELL));
    if (!v) return null;
    for (const p of v.pieces) {
      if (q < p.q0 || q > p.q1 || r < p.r0 || r > p.r1 || !p.cols.has(q + ',' + r)) continue;
      return this.pieceActive(p) ? p : null;
    }
    return null;
  }

  // Parties de village (actives) dont l'emprise touche le rectangle [qa, qb] x [ra, rb]
  villagePiecesNear(qa, qb, ra, rb) {
    const out = [];
    for (let ci = Math.floor(qa / VILLAGE_CELL); ci <= Math.floor(qb / VILLAGE_CELL); ci++) {
      for (let cj = Math.floor(ra / VILLAGE_CELL); cj <= Math.floor(rb / VILLAGE_CELL); cj++) {
        const v = this.villageInCell(ci, cj);
        if (!v) continue;
        for (const p of v.pieces) if (p.q1 >= qa && p.q0 <= qb && p.r1 >= ra && p.r0 <= rb && this.pieceActive(p)) out.push(p);
      }
    }
    return out;
  }

  // Point d'apparition : une case d'herbe libre près de (0, 0).
  findSpawn() {
    if (this.type === 'tutorial') { const s = worldToHex(SPOTS.spawn.x, SPOTS.spawn.z); return { q: s.q, r: s.r, y: STATION_Y + 1 }; }
    if (this.v3) {
      const s = this.findSpawn3();
      if (s) return s;
    }
    return this.findSpawnNear(0, 0, 40) || { q: 0, r: 0, y: this.height(0, 0) + 1 };
  }

  findSpawnNear(q0, r0, radius) {
    for (let rad = 0; rad < radius; rad++) {
      for (let dq = -rad; dq <= rad; dq++) {
        for (let dr = -rad; dr <= rad; dr++) {
          if (hexDist(dq, dr) !== rad) continue;
          const q = q0 + dq, r = r0 + dr;
          const h = this.height(q, r);
          if (this.block(q, r, h) === GRASS && this.block(q, r, h + 1) === AIR && this.block(q, r, h + 2) === AIR) {
            return { q, r, y: h + 1 };
          }
        }
      }
    }
    return null;
  }
}

// Générateur d'un monde : chaque chunk est généré par le relief de sa version (voir
// GEN_CONTENT) : celui d'avant HexaCraft 0.8.6 pour les chunks déjà créés avant, le monde
// surélevé pour les autres (mondes v3 et plus). Les chunks déjà visités voient le monde comme
// avant (leurs arbres, leurs ruines, leur eau ne changent pas).
export class Generator {
  // height : gardé pour compatibilité (la hauteur dépend de la version, voir Terrain)
  constructor(type = 'normal', seed = '0', height = WORLD_HEIGHT, version = 2) {
    this.type = type;
    this.version = version;
    this.seed = String(seed);
    this.old = new Terrain(type, seed, version);
    this.v3 = this.old.v3;
    this.hi = this.v3 ? new Terrain(type, seed, version, true, this) : null;
    this.sea = this.old.sea;
    this.H = WORLD_HEIGHT;
    // version du contenu d'une colonne (remplacée par le monde : version de son chunk)
    this.versionAt = () => GEN_CONTENT;
    const at = (q, r) => this.versionAt(q, r);
    this.old.versionAt = at;
    if (this.hi) this.hi.versionAt = at;
    this.oldSet = new Set();   // chunks d'avant le monde surélevé ("cq,cr")
    this.edges = [];           // ceux du bord (un voisin plus récent) : q0, r0 de leurs cases
    this.zoneCache = new Map(); // zone -> chunks du bord assez proches (q0, r0, ...)
    this.nearCache = new Map(); // chunk -> chunks du bord assez proches
    this.modeCache = new Map(); // chunk récent -> relief (ancien près des endroits visités)
  }

  // Les chunks déjà créés avant le monde surélevé (chunkVer : clé chunk -> version). À appeler
  // dès que la liste est connue, avant de générer quoi que ce soit.
  setOldChunks(chunkVer) {
    this.oldSet.clear();
    this.zoneCache.clear();
    this.nearCache.clear();
    this.modeCache.clear();
    this.edges = [];
    for (const [k, v] of chunkVer) if (v < RAISED) this.oldSet.add(k);
    // la distance à la zone visitée est toujours celle d'un chunk du bord
    for (const k of this.oldSet) {
      const [cq, cr] = k.split(',').map(Number);
      const inner = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1]].every(([a, b]) => this.oldSet.has((cq + a) + ',' + (cr + b)));
      if (!inner) this.edges.push(cq * CS_ - 0.5, cr * CS_ - 0.5);
    }
    this.old.clearCaches();
    if (this.hi) this.hi.clearCaches();
  }

  get hasOld() {
    return this.oldSet.size > 0;
  }

  // Chunks du bord (q0, r0, ...) à moins de reach blocs du parallélogramme de cases
  // [q0, q0 + n] x [r0, r0 + n], pris dans la liste list
  edgesNear(list, q0, r0, n, reach) {
    const [cx, cz] = centerOf(q0, r0, n);
    const lim = reach + n * 0.8 + CS_ * 0.8; // + demi-diagonales (larges)
    const out = [];
    for (let i = 0; i < list.length; i += 2) {
      const [ex, ez] = centerOf(list[i], list[i + 1], CS_);
      if (Math.hypot(ex - cx, ez - cz) < lim) out.push(list[i], list[i + 1]);
    }
    return out;
  }

  // Distance (blocs) du point (x, z) aux chunks d'avant le monde surélevé (Infinity au-delà
  // de RING_FAR). Les chunks du bord proches sont cherchés une fois par zone, puis par chunk.
  oldDist(x, z) {
    if (!this.edges.length) return Infinity;
    const r = z / SIZE_R, q = x - r / 2; // coordonnées axiales (fractionnaires)
    const cq = Math.floor(q / CS_), cr = Math.floor(r / CS_);
    const key = cq + ',' + cr;
    let near = this.nearCache.get(key);
    if (!near) {
      const zq = Math.floor(cq / ZONE), zr = Math.floor(cr / ZONE), zk = zq + ',' + zr;
      let zone = this.zoneCache.get(zk);
      if (!zone) {
        zone = this.edgesNear(this.edges, zq * ZONE * CS_, zr * ZONE * CS_, ZONE * CS_, RING_FAR);
        if (this.zoneCache.size > 2048) this.zoneCache.clear();
        this.zoneCache.set(zk, zone);
      }
      near = zone.length ? this.edgesNear(zone, cq * CS_, cr * CS_, CS_, RING_FAR) : zone;
      if (this.nearCache.size > 4096) this.nearCache.clear();
      this.nearCache.set(key, near);
    }
    let best = Infinity;
    for (let i = 0; i < near.length; i += 2) {
      // distance au parallélogramme [q0, q0 + CS] x [r0, r0 + CS] (en blocs du monde)
      const dq = q - Math.max(near[i], Math.min(near[i] + CS_, q));
      const dr = r - Math.max(near[i + 1], Math.min(near[i + 1] + CS_, r));
      const d = Math.hypot(dq + dr / 2, dr * SIZE_R);
      if (d < best) best = d;
    }
    return best < RING_FAR ? best : Infinity;
  }

  // Relief qui génère la colonne (q, r) : chunk par chunk, l'ancien pour les chunks déjà visités
  // et ceux dont le centre est à moins de OLD_REACH blocs d'eux, sinon le monde surélevé
  at(q, r) {
    if (!this.hi || this.versionAt(q, r) < RAISED) return this.old;
    if (!this.edges.length) return this.hi;
    const cq = Math.floor(q / CS_), cr = Math.floor(r / CS_), key = cq + ',' + cr;
    let t = this.modeCache.get(key);
    if (!t) {
      const [x, z] = centerOf(cq * CS_, cr * CS_, CS_ - 1);
      t = this.oldDist(x, z) < OLD_REACH ? this.old : this.hi;
      if (this.modeCache.size > 8192) this.modeCache.clear();
      this.modeCache.set(key, t);
    }
    return t;
  }

  block(q, r, y) {
    if (y < -DEPTH) return BEDROCK;
    if (y >= WORLD_HEIGHT) return AIR;
    return this.at(q, r).block(q, r, y);
  }
  surface(q, r) { return this.at(q, r).surface(q, r); }
  height(q, r) { return this.at(q, r).height(q, r); }
  biomeAt(q, r) { return this.at(q, r).biomeAt(q, r); }
  isCold(q, r) { return this.at(q, r).isCold(q, r); }
  fillChunk(data, q0, r0, CS, idx) {
    // (monde du menu : les profondeurs ne sont que de la pierre, vite remplie, jamais vue)
    if (this.surfaceOnly && this.type !== 'tutorial') {
      data.fill(STONE, idx(0, 0, -DEPTH), idx(0, 0, 0));
      this.at(q0, r0).fillChunk(data, q0, r0, CS, idx, true);
      return;
    }
    this.at(q0, r0).fillChunk(data, q0, r0, CS, idx);
  }
  terrain(y, h, cv, q, r) { return this.old.terrain(y, h, cv, q, r); }

  // Villages (actifs) dont le centre est à moins de R blocs du point (x, z) :
  // [{ key, q, r, y (puits), doors, houses }] (chaque relief garde les siens, voir at)
  villagesNear(x, z, R) {
    if (!this.v3 || this.type !== 'normal') return [];
    const { q, r } = worldToHex(x, z), out = [], t = this.at(q, r);
    const ci0 = Math.floor(q / VILLAGE_CELL), cj0 = Math.floor(r / VILLAGE_CELL);
    for (let ci = ci0 - 1; ci <= ci0 + 1; ci++) {
      for (let cj = cj0 - 1; cj <= cj0 + 1; cj++) {
        const v = t.villageInCell(ci, cj);
        if (!v || !t.pieceActive(v.pieces[0])) continue;
        const c = hexToWorld(v.q, v.r);
        if (Math.hypot(c.x - x, c.z - z) > R) continue;
        out.push({ key: v.key, q: v.q, r: v.r, y: v.pieces[0].base, doors: v.doors.filter((_, i) => t.pieceActive(v.pieces[i + 1])), houses: v.houses.filter((_, i) => t.pieceActive(v.pieces[i + 1])) });
      }
    }
    return out;
  }
  hash(a, b, c) { return this.old.hash(a, b, c); }
  isMineChest(q, r, y) { return this.at(q, r).isMineChest(q, r, y); }
  mineRails(cq, cr, CS) { return this.old.mineRails(cq, cr, CS); }
  hexCavesNear(q, r, R) { return this.at(q, r).hexCavesNear(q, r, R); }
  hexCaveBlock(q, r, y) { return this.at(q, r).hexCaveBlock(q, r, y); }
  leafAt(t, q, r, y) { return this.old.leafAt(t, q, r, y); }
  bigOak(...a) { return this.old.bigOak(...a); }
  chestnut(...a) { return this.old.chestnut(...a); }
  linden(...a) { return this.old.linden(...a); }
  birch(...a) { return this.old.birch(...a); }

  // Colonne au point (x, z) (carte du monde) : { h, biome, snow, lava, ice, sea }
  columnAt(x, z) {
    const { q, r } = worldToHex(x, z);
    return this.at(q, r).columnAt(x, z, q, r);
  }

  // Point d'apparition. Un ancien monde garde le sien (dans un endroit déjà visité).
  findSpawn() {
    if (!this.hi) return this.old.findSpawn();
    if (!this.hasOld) return this.hi.findSpawn();
    const s = this.old.findSpawn();
    if (this.at(s.q, s.r) === this.old) return s;
    return this.hi.findSpawnNear(s.q, s.r, 40) || { q: s.q, r: s.r, y: this.hi.height(s.q, s.r) + 1 };
  }
}

export function randomSeed() {
  return String(Math.floor(Math.random() * 2 ** 31) - 2 ** 30);
}
