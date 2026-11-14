// Terrain des planètes où l'on se pose (voir system.js : leur gen). Même interface que le
// relief du monde d'origine (Terrain, gen.js), utilisée par Generator quand le type du monde est
// « planet:<id> » : dans le jeu comme dans les threads de génération.
//
// Le relief de chaque planète se fait en trois temps :
//  1. son style (gen.style) donne la hauteur et les blocs du dessus de chaque colonne : de
//     grandes formes déformées (pas de taches rondes), puis du détail à l'échelle du joueur ;
//  2. une passe commune (finish) met la roche à nu là où le sol tombe à pic : les falaises, les
//     parois de canyon et les flancs de montagne montrent les strates de la planète (STYLES),
//     qui ondulent un peu, au lieu d'une couche de sable collée à la verticale ;
//  3. ce qui pousse du sol (pil : rochers, cheminées de fée, orgues de basalte, pénitents de
//     glace, aiguilles de fer...), avec un bloc de tête (pcap) pour certains.
// Les matières se mélangent par petites touches (pick) au lieu de taches à bord net.
//
// Les styles :
//  - moon     : hautes terres cratérisées (rempart, pic central, éjecta et blocs autour), mers de
//               basalte aux rides de compression, tunnels de lave ;
//  - mars     : poussière ocre, champs de blocs, cratères aux fonds de sable sombre, canyon immense
//               aux parois stratifiées en gradins, volcan géant, calottes polaires en couches ;
//  - desert   : (Soufra) mers de dunes à face d'avalanche, plateaux de soufre stratifiés, canyons,
//               cuvettes de sel craquelé en polygones, champs de fumerolles et d'aiguilles de soufre ;
//  - sandstone: (PXT-1) désert de grès pâle : dunes, yardangs taillés par le vent, buttes en
//               gradins, cheminées de fée coiffées de roche dure, oueds de gravier, dômes de granite ;
//  - volcanic : (Magmara) plaines de basalte fendues de magma, volcans boucliers (lac de lave et
//               coulées rayonnantes), cônes de cendre, orgues de basalte, mer de lave ;
//  - ironworld: (PXT-3) monde de fer brûlant : plaines rouillées, vieilles coulées de basalte,
//               rifts de lave, crêtes d'hématite où le fer affleure, aiguilles de fer ;
//  - io       : (Brasia) plaines de soufre mouchetées, paterae (lac de lave, anneau sombre, auréole
//               de retombées claires), montagnes raides et stratifiées ;
//  - europa   : (Azura) croûte de glace rayée de doubles crêtes brunes, chaos de plaques basculées,
//               et l'océan dessous ;
//  - glacier  : (Glacia) inlandsis aux sastrugi (couches de neige sculptées par le vent), montagnes
//               où la roche perce la glace, champs de crevasses, banquise en plaques, icebergs ;
//  - redice   : (PXT-2) monde gelé sous la naine rouge : champs de pénitents de glace, pitons de
//               roche sombre, cryovolcans, mers prises par une glace fissurée ;
//  - pluto    : (Nox) plaine d'azote en cellules hexagonales, montagnes en blocs de glace, terrain
//               en lames, terres sombres de tholins cratérisées ;
//  - twilight : (Vesper) rotation synchrone : tout suit la hauteur de l'astre (lave, cendres,
//               crépuscule vivant, nuit glacée) ;
//  - frozenocean : (Pélagia) banquise sans fin sur un océan profond, crêtes de pression, icebergs
//               pris dans la glace, fissures d'eau libre, de rares îles de roche ;
//  - eldra    : (Pipiens) océans (62 %), continents aux lichens et mousses violet-noir, la
//               Cordillère d'Orvane, une mer intérieure aux tapis microbiens, des plaines de sel,
//               l'arc volcanique de la côte est et l'archipel (basalte noir), calottes polaires ;
//  - glacyon  : (Pipiens) plaines d'azote blanc-rose en cellules, montagnes de glace d'eau,
//               cryovolcans, dunes de tholins rouge-brun, un océan loin sous la glace.
//  - cinder   : (Ethan) rotation synchrone : océans de fer fondu face aux pulsars, plaines de scories
//               noires, croûte rouge-orange qui brille dans la nuit, geysers de métal ;
//  - voss     : (Ethan) plateaux de graphite en gradins, falaises de diamant brut, rivières de
//               carbure, lacs d'hydrocarbures (figés en verre noir), aiguilles de diamant ;
//  - halo     : (Ethan) océan peu profond aux récifs luminescents, îles au sol radiotrophe, forêts de
//               cristaux végétaux, plaines de verre noir (impacts), falaises d'aurore ;
//  - tessel   : (Ethan) dunes de sable de cristal, plateaux et aiguilles de quartz, canyons aux parois
//               de quartz et de sel, cuvettes de sel ;
//  - perse    : (Ethan) glace bleue fracturée sur un océan, failles lumineuses, cryovolcans géants ;
//  - lethe    : (Ethan) plaines de poussière noire cratérisées, crevasses profondes.
// Latitude : z (voir system.spanOf) ; les pôles sont au-delà de ±span/4 (calottes, froid).
// Grottes : des tunnels sinueux (2 bruits) dans la roche, sous la surface.
import { hexToWorld } from './hex.js?v=1.1.5-alpha-mwgq2wrb';
import { BODY, spanOf, sunElev } from './system.js?v=1.1.5-alpha-mwgq2wrb';

const AIR = 0, BEDROCK = 4;
const OBSIDIAN = 74, ICE = 3973, CRACKED_ICE = 3982, MOON_ROCK = 3970, LAYERED = 3980, SALT = 3977, SNOW = 37,
  GRASS = 1, DIRT = 2, STONE = 3, LOG = 5, LEAVES = 6, TUNDRA = 36, SAND = 8, ICE_WATER = 200,
  RED_ROCK = 3972, ASH = 69, ASH_ROCK = 3981, BASALT = 68, SULFUR = 70, IO_SULFUR = 3978, THOLIN = 3976, BLUE_ICE = 3974,
  WATER = 7, LAVA = 72, MAGMA = 73, OCHRE = 3971, PERMAFROST = 3979, NITROGEN = 3975, REGOLITH = 3969, DUNE = 626, SANDSTONE = 627,
  TUFF = 71, GRAVEL = 244, DIORITE = 261, SLATE = 745, CLAY = 603, CRACKED = 605, IRON_ORE = 60,
  LICHEN = 3997, MOSS = 3998, MAT_O = 3999, MAT_G = 4082, PINK = 4083, // (Pipiens : Eldra, Glacyon)
  SLAG = 4084, GLOW_CRUST = 4085, GRAPHITE = 4086, DIAMOND = 4087, CRYSTAL = 4088, BLACK_GLASS = 4089, REEF = 4090,
  RADIO = 4091, CSAND = 4092, QUARTZ = 4093, BLACK_DUST = 4094, GLOW_ICE = 4095; // (Ethan)
const SNOW_LAYER = 760; // (couche de neige : 760 + épaisseur - 1, voir blocks.js)

// Les strates de chaque style (lh : épaisseur d'une strate) : ce que montrent les falaises
const STYLES = {
  moon: { layers: [MOON_ROCK, MOON_ROCK, REGOLITH, MOON_ROCK, BASALT], lh: 2 },
  mars: { layers: [RED_ROCK, LAYERED, RED_ROCK, RED_ROCK, BASALT, LAYERED], lh: 2 },
  desert: { layers: [LAYERED, SULFUR, LAYERED, TUFF, LAYERED, SALT], lh: 2 },
  sandstone: { layers: [SANDSTONE, SANDSTONE, TUFF, SANDSTONE, CLAY, SANDSTONE, CRACKED], lh: 2 },
  volcanic: { layers: [BASALT, BASALT, ASH_ROCK, BASALT, TUFF], lh: 2 },
  ironworld: { layers: [RED_ROCK, RED_ROCK, BASALT, RED_ROCK, ASH_ROCK], lh: 2 },
  io: { layers: [BASALT, ASH_ROCK, BASALT, SULFUR, ASH_ROCK], lh: 2 },
  europa: { layers: [ICE, ICE, CRACKED_ICE], lh: 3 },
  glacier: { layers: [BLUE_ICE, ICE, BLUE_ICE, ICE], lh: 2 },
  redice: { layers: [BLUE_ICE, ICE, BLUE_ICE, CRACKED_ICE], lh: 2 },
  pluto: { layers: [BLUE_ICE, ICE, BLUE_ICE, THOLIN], lh: 2 },
  twilight: { layers: [STONE, STONE, SLATE, STONE, DIORITE], lh: 2 },
  frozenocean: { layers: [BLUE_ICE, ICE, BLUE_ICE, CRACKED_ICE], lh: 2 },
  eldra: { layers: [STONE, STONE, SLATE, STONE, DIORITE, STONE], lh: 2 },
  glacyon: { layers: [ICE, NITROGEN, ICE, BLUE_ICE, THOLIN], lh: 2 },
  cinder: { layers: [SLAG, BASALT, SLAG, IRON_ORE, OBSIDIAN], lh: 2 },
  voss: { layers: [GRAPHITE, GRAPHITE, DIAMOND, GRAPHITE, SLATE, GRAPHITE], lh: 2 },
  halo: { layers: [STONE, SLATE, STONE, DIORITE, STONE], lh: 2 },
  tessel: { layers: [QUARTZ, SALT, QUARTZ, QUARTZ, CSAND], lh: 2 },
  perse: { layers: [BLUE_ICE, ICE, BLUE_ICE, CRACKED_ICE], lh: 2 },
  lethe: { layers: [BASALT, SLATE, BASALT, BLACK_DUST], lh: 2 },
};
const ROCK_LAYERS = [DIORITE, SLATE, DIORITE, STONE, SLATE];
const DARK_LAYERS = [SLATE, BASALT, SLATE, SLATE];
const HOT_LAYERS = [BASALT, ASH_ROCK, BASALT];
const CAP_LAYERS = [ICE, PERMAFROST, ICE, SNOW, ICE];

// couleurs des blocs du dessus (vue de l'espace, voir colorAt)
const COLORS = {
  [REGOLITH]: '#77777a', [MOON_ROCK]: '#b4b2ae', [BASALT]: '#3e3e44', [OCHRE]: '#b46034', [RED_ROCK]: '#86402a', [ICE]: '#c8e6f4',
  [BLUE_ICE]: '#5a9ad0', [NITROGEN]: '#ece4d8', [THOLIN]: '#5a3424', [SALT]: '#ece8e0', [IO_SULFUR]: '#e4a82a', [SULFUR]: '#e0c818',
  [PERMAFROST]: '#927262', [LAYERED]: '#b8925a', [ASH_ROCK]: '#3e3a36', [CRACKED_ICE]: '#9a6a4e', [SNOW]: '#f2f6fa', [DUNE]: '#e0c070',
  [ASH]: '#8a8888', [OBSIDIAN]: '#24183a', [LAVA]: '#ff6a10', [WATER]: '#2a5a9a', 200: '#3a70a8', [MAGMA]: '#6a2a14', [SANDSTONE]: '#d0b07a',
  3: '#8a8a8a', 71: '#d0c8bc', 1: '#5c8a3a', 2: '#7a5a3a', 36: '#dfe8ee', 8: '#d8c890', [GRAVEL]: '#8c8680', [DIORITE]: '#b8b8b4',
  [SLATE]: '#4a4e56', [CLAY]: '#a8a0a0', [CRACKED]: '#9a7050', [IRON_ORE]: '#9a6a50', [LEAVES]: '#3a6a2a',
  [LICHEN]: '#2e2038', [MOSS]: '#45305a', [MAT_O]: '#d07a28', [MAT_G]: '#4a8a3a', [PINK]: '#f0dcd8',
  [SLAG]: '#1e1a18', [GLOW_CRUST]: '#c8401a', [GRAPHITE]: '#202024', [DIAMOND]: '#8ad8ff', [CRYSTAL]: '#5ad8e0', [BLACK_GLASS]: '#0c0c10',
  [REEF]: '#1880e0', [RADIO]: '#14282e', [CSAND]: '#e0dcec', [QUARTZ]: '#ddd2ec', [BLACK_DUST]: '#0c0c0d', [GLOW_ICE]: '#60b8ff',
};
for (let n = 0; n < 8; n++) COLORS[SNOW_LAYER + n] = '#f2f6fa';
const DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
const smooth = (a, b, t) => { const k = Math.max(0, Math.min(1, (t - a) / (b - a))); return k * k * (3 - 2 * k); };
const mix = (a, b, t) => a + (b - a) * t;

export class PlanetTerrain {
  // deps : ce qui vient de gen.js (passé ici : gen.js importe ce fichier)
  constructor(body, seed, { makeSimplex, mulberry32, seedToInt, H, DEPTH }) {
    this.body = typeof body === 'string' ? BODY[body] : body;
    this.g = this.body.gen;
    this.style = this.g.style;
    this.cfg = this.style === 'biomes' ? { layers: this.g.layers, lh: this.g.lh } : STYLES[this.style] || {};
    this.lands = new Map();
    // (les arbres des biomes : une seule grille pour toute la planète, de la maille la plus fine)
    if (this.style === 'biomes') this.treeGap = Math.min(...this.g.biomes.map((b) => (b.tree ? b.tree.gap : 99)));
    this.H = H;
    this.DEPTH = DEPTH;
    this.span = spanOf(this.body);
    this.seedInt = seedToInt(String(seed) + ':' + this.body.id);
    const rand = mulberry32(this.seedInt);
    this.n = Array.from({ length: 12 }, () => makeSimplex(rand));
    this.sea = this.g.fluid ? this.g.sea : -999;
    this.v3 = false;
    this.cols = new Map();
    this.raws = new Map();
    this.versionAt = () => 14;
    // grands traits placés une fois (selon la graine) : le canyon et le volcan d'Ocra, la plaine
    // de Nox... pas trop loin de l'arrivée la plus probable (l'équateur)
    const a = rand() * Math.PI * 2;
    this.big = { x: Math.cos(a) * (900 + rand() * 900), z: Math.sin(a) * (500 + rand() * 500), r: 260 + rand() * 120 };
    this.canyonZ = (rand() - 0.5) * 1600;
    this.wind = rand() * Math.PI; // (direction du vent dominant : dunes, yardangs, sastrugi)
  }

  clearCaches() { this.cols.clear(); this.raws.clear(); this.lands.clear(); }

  hash(a, b, c = 0) {
    let h = this.seedInt ^ Math.imul(a, 374761393) ^ Math.imul(b, 668265263) ^ Math.imul(c, 2147483647);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h = Math.imul(h ^ (h >>> 16), 2246822519);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  // ---------- Bruits ----------
  fbm(i, x, z, s, oct = 3) {
    const n = this.n[i];
    let v = 0, a = 1, f = 1 / s, t = 0;
    for (let o = 0; o < oct; o++) { v += n(x * f + o * 31.7, z * f - o * 17.3) * a; t += a; a *= 0.5; f *= 2.03; }
    return v / t;
  }
  ridged(i, x, z, s, oct = 3) {
    const n = this.n[i];
    let v = 0, a = 1, f = 1 / s, t = 0;
    for (let o = 0; o < oct; o++) { v += (1 - Math.abs(n(x * f + o * 11.1, z * f + o * 7.7))) ** 2 * a; t += a; a *= 0.5; f *= 2.1; }
    return v / t;
  }
  // (coordonnées déformées : les grandes formes perdent leur air de taches rondes)
  warp(x, z, s, a) {
    return [x + this.n[8](x / s, z / s) * a, z + this.n[9](x / s + 5.2, z / s - 1.3) * a];
  }
  // un mélange par petites touches : b avec la probabilité t
  pick(t, a, b, q, r, salt = 0) { return t <= 0 ? a : t >= 1 ? b : this.hash(q, r, 977 + salt) < t ? b : a; }
  // latitude : 0 à l'équateur, ±1 aux pôles (nord : z négatif)
  lat(z) { return Math.max(-1, Math.min(1, -z / (this.span / 4))); }
  // coordonnée le long du vent (u) et en travers (v)
  along(x, z, ang = this.wind) { const c = Math.cos(ang), s = Math.sin(ang); return [x * c + z * s, -x * s + z * c]; }

  // Les objets semés (une chance sur p par cellule de `cell` blocs) : cb(cx, cz, i, j) pour ceux
  // des 9 cellules autour
  near(x, z, cell, p, seed, cb) {
    const ci = Math.floor(x / cell), cj = Math.floor(z / cell);
    for (let i = ci - 1; i <= ci + 1; i++) {
      for (let j = cj - 1; j <= cj + 1; j++) {
        if (this.hash(i, j, seed) > p) continue;
        cb((i + 0.15 + this.hash(i, j, seed + 2) * 0.7) * cell, (j + 0.15 + this.hash(i, j, seed + 3) * 0.7) * cell, i, j);
      }
    }
  }
  // Des plaques irrégulières (cellules de Voronoï d'environ cell blocs) : [distance au bord
  // le plus proche (blocs), valeur 0..1 propre à la plaque]
  plates(x, z, cell, seed) {
    const ci = Math.floor(x / cell), cj = Math.floor(z / cell);
    let d1 = Infinity, d2 = Infinity, id = 0;
    for (let i = ci - 1; i <= ci + 1; i++) {
      for (let j = cj - 1; j <= cj + 1; j++) {
        const px = (i + this.hash(i, j, seed)) * cell, pz = (j + this.hash(i, j, seed + 1)) * cell;
        const d = Math.hypot(x - px, z - pz);
        if (d < d1) { d2 = d1; d1 = d; id = this.hash(i, j, seed + 2); } else if (d < d2) d2 = d;
      }
    }
    return [(d2 - d1) / 2, id];
  }
  // Un petit objet (rocher, aiguille) : sa hauteur ici (0 : rien), et la valeur 0..1 qui le
  // distingue (pour choisir sa matière)
  spot(x, z, cell, p, seed, rmin, rmax, hmin, hmax) {
    let best = 0, k = 0;
    this.near(x, z, cell, p, seed, (cx, cz, i, j) => {
      const R = rmin + this.hash(i, j, seed + 4) * (rmax - rmin), d = Math.hypot(x - cx, z - cz) / R;
      if (d >= 1) return;
      const h = Math.max(1, Math.round((hmin + this.hash(i, j, seed + 5) * (hmax - hmin)) * (1 - d * d * 0.6)));
      if (h > best) { best = h; k = this.hash(i, j, seed + 6); }
    });
    return [best, k];
  }
  // Une rangée de dunes (face au vent en pente douce, face d'avalanche raide) : 0..H
  dunes(x, z, lam, H, i) {
    const [u, v] = this.along(x, z);
    const ph = u / lam + this.fbm(i, x, z, lam * 5, 2) * 1.3 + this.n[i + 1](v / (lam * 2.5), 0.5) * 0.9;
    const t = ph - Math.floor(ph);
    const p = t < 0.8 ? t / 0.8 : (1 - t) / 0.2;
    return p * p * (3 - 2 * p) * H * (0.55 + 0.45 * this.fbm(i + 1, x, z, lam * 4, 2));
  }

  // Cratères (cellules de taille cell, une chance sur `p`) : creux, rempart, pic central pour les
  // grands. Renvoie [dh, rayon d'éjecta (0..1), fond (0..1)]
  craters(x, z, cell, p, maxR, seed, minR = 5) {
    const ci = Math.floor(x / cell), cj = Math.floor(z / cell);
    let dh = 0, ray = 0, floor = 0;
    for (let i = ci - 1; i <= ci + 1; i++) {
      for (let j = cj - 1; j <= cj + 1; j++) {
        if (this.hash(i, j, seed) > p) continue;
        const R = minR + this.hash(i, j, seed + 1) ** 2 * maxR;
        const cx = (i + 0.15 + this.hash(i, j, seed + 2) * 0.7) * cell, cz = (j + 0.15 + this.hash(i, j, seed + 3) * 0.7) * cell;
        // (un bord un peu irrégulier)
        const ang = Math.atan2(z - cz, x - cx);
        const d = Math.hypot(x - cx, z - cz) / (R * (1 + 0.08 * Math.sin(ang * 3 + i) + 0.05 * Math.sin(ang * 7 + j)));
        if (d < 1) {
          dh -= R * 0.32 * (1 - d * d);
          if (R > 22 && d < 0.22) dh += R * 0.22 * (1 - d / 0.22); // pic central
          if (d < 0.7) floor = Math.max(floor, 1 - d / 0.7);
        } else if (d < 1.6) dh += R * 0.11 * Math.cos(((d - 1) / 0.6) * (Math.PI / 2)) ** 2;
        // rayons d'éjecta clairs autour des cratères frais
        if (R > 14 && d > 1 && d < 4.5 && this.hash(i, j, seed + 4) < 0.5) {
          const k = Math.abs(Math.sin(ang * (5 + Math.floor(this.hash(i, j, seed + 5) * 6))));
          if (k > 0.93 - 0.05 * (4.5 - d)) ray = 1;
        }
        if (d > 0.9 && d < 1.5) ray = Math.max(ray, 0.4); // (blocs éjectés autour du rempart)
      }
    }
    return [dh, ray, floor];
  }
  // Un volcan bouclier, un cône : (1 - d)^k * H, avec un cratère au sommet (la hauteur ajoutée)
  cone(d, H, k, crater, depth) {
    if (d >= 1) return 0;
    let h = (1 - d) ** k * H;
    if (d < crater) h -= (1 - d / crater) ** 0.7 * depth;
    return h;
  }

  // ---------- Colonne : hauteur, blocs du dessus, liquides ----------
  // { h, top, sub, sd (épaisseur du sous-sol), rock, fl (niveau du liquide), fid, cap (bloc à la
  //   surface du liquide), pil, pid, pcap (colonne au-dessus du sol, et sa tête), sea2 [bas, haut]
  //   (océan sous la glace), caves (grottes permises), layers (strates, sinon celles du style),
  //   exposed (roche à nu), keep (pas de passe commune) }
  raw(q, r) {
    const k = q * 73856093 ^ r * 19349663;
    let c = this.raws.get(k);
    if (c && c.q === q && c.r === r) return c;
    const { x, z } = hexToWorld(q, r);
    c = this[this.style](x, z, q, r);
    c.q = q; c.r = r;
    c.h = Math.max(6, Math.min(this.H - 14, Math.round(c.h)));
    if (this.raws.size > 60000) this.raws.clear();
    this.raws.set(k, c);
    return c;
  }
  col(q, r) {
    const k = q * 73856093 ^ r * 19349663;
    let c = this.cols.get(k);
    if (c && c.q === q && c.r === r) return c;
    c = { ...this.raw(q, r) };
    this.finish(c, q, r);
    if (c.pil) c.pil = Math.min(c.pil, this.H - 2 - c.h);
    if (this.cols.size > 40000) this.cols.clear();
    this.cols.set(k, c);
    return c;
  }
  base(h, extra = {}) {
    const g = this.g;
    return { h, top: g.top, sub: g.sub, sd: 3, rock: g.rock, fl: this.sea, fid: g.fluid, cap: 0, pil: 0, pid: 0, pcap: 0, caves: true, ...extra };
  }
  // La passe commune : là où la colonne domine ses voisines de 3 blocs ou plus, la roche est à nu
  // (à 2, une fois sur deux : le bord s'effrite) ; les strates ondulent un peu.
  finish(c, q, r) {
    const { x, z } = hexToWorld(q, r);
    c.lo = Math.round(this.fbm(10, x, z, 160, 2) * 4);
    if (c.keep || c.fl > c.h) return;
    let drop = 0;
    for (const [dq, dr] of DIRS) drop = Math.max(drop, c.h - this.raw(q + dq, r + dr).h);
    if (drop >= 3 || (drop === 2 && this.hash(q, r, 31) < 0.5)) {
      c.exposed = true;
      if (c.pid >= SNOW_LAYER && c.pid < SNOW_LAYER + 8) c.pil = 0;
    }
  }
  layerAt(c, y) {
    const L = c.layers || this.cfg.layers;
    if (!L) return c.rock;
    const i = Math.floor((y + c.lo) / (this.cfg.lh || 2));
    return L[((i % L.length) + L.length) % L.length];
  }
  topOf(c) { return c.exposed ? this.layerAt(c, c.h) : c.top; }

  // ---------- La Lune ----------
  moon(x, z, q, r) {
    const g = this.g, [wx, wz] = this.warp(x, z, 700, 180);
    let h = g.base + this.fbm(0, wx, wz, 900) * g.amp * 0.7 + this.ridged(1, wx, wz, 380) * g.amp * 0.4 + this.fbm(2, x, z, 90) * 2.5;
    // mers : de grands bassins de lave figée, lisses et plus bas, ridés de crêtes de compression
    const m = smooth(0.15, 0.4, this.fbm(3, wx, wz, 2600, 2));
    const wr = this.ridged(5, x, z, 240, 2);
    h = mix(h, g.base - g.amp * 0.55 + this.fbm(4, x, z, 300) * 2 + (wr > 0.82 ? (wr - 0.82) / 0.18 * 3 : 0), m);
    // cratères de quatre tailles (moins sur les mers, plus jeunes)
    let ray = 0;
    for (const [cell, p, R, s, mn] of [[26, 0.45, 4, 7, 2], [60, 0.55, 10, 11, 5], [220, 0.5, 40, 21, 5], [900, 0.35, 140, 31, 5]]) {
      const [dh, rr] = this.craters(x, z, cell, m > 0.5 ? p * 0.4 : p, R, s, mn);
      h += dh; ray = Math.max(ray, rr);
    }
    const sea = m > 0.5;
    const top = ray === 1 ? MOON_ROCK : this.pick(smooth(0.35, 0.65, m), REGOLITH, BASALT, q, r);
    const c = this.base(h, { top, sub: sea ? BASALT : REGOLITH, sd: 4 });
    // des blocs éjectés autour des cratères, quelques rochers ailleurs
    const [bh, bk] = this.spot(x, z, 9, ray ? 0.6 : 0.07, 201, 0.8, 1.9, 1, ray ? 3 : 2);
    if (bh) { c.pil = bh; c.pid = sea || bk < 0.3 ? BASALT : MOON_ROCK; }
    // tunnels de lave sous les mers
    if (m > 0.4 && Math.abs(this.n[4](x / 160, z / 160)) < 0.035) c.tube = [Math.round(h) - 13, Math.round(h) - 7];
    return c;
  }

  // ---------- Ocra, la planète rouge ----------
  mars(x, z, q, r) {
    const g = this.g, la = this.lat(z), [wx, wz] = this.warp(x, z, 900, 260);
    let h = g.base + this.fbm(0, wx, wz, 1400) * g.amp * 0.6 + this.fbm(1, wx, wz, 260) * g.amp * 0.18 + this.fbm(2, x, z, 60) * 1.8;
    // le volcan géant : un bouclier très large, une caldeira au sommet
    const B = this.big, dv = Math.hypot(x - B.x, z - B.z) / B.r;
    h += this.cone(dv, 78, 1.6, 0.12, 14);
    // le canyon : une longue entaille sinueuse est-ouest, aux parois en gradins
    const cz = this.canyonZ + this.fbm(2, x, 0, 1800, 2) * 380 + this.fbm(3, x, z, 160, 2) * 18, w = 45 + this.fbm(3, x, 0, 900, 2) * 25;
    const dc = Math.abs(z - cz) / w;
    let canyon = 0;
    if (dc < 1.5) { canyon = Math.max(0, 1 - dc / 1.5); h -= Math.round(smooth(0, 0.8, canyon) * 46 / 6) * 6 + (canyon > 0.85 ? this.dunes(x, z, 22, 3, 4) : 0); }
    let ray = 0, floor = 0;
    for (const [cell, p, R, s] of [[70, 0.3, 9, 41], [180, 0.35, 28, 11], [700, 0.25, 90, 21]]) {
      const [dh, rr, ff] = this.craters(x, z, cell, p, R, s); h += dh * 0.8; ray = Math.max(ray, rr); floor = Math.max(floor, ff);
    }
    // sable sombre (basaltique) au fond des cratères et des creux, en dunes
    const dark = Math.max(floor * 0.9, smooth(-10, -16, h - g.base));
    if (dark > 0.3) h += this.dunes(x, z, 16, 2.5, 4) * dark;
    // champs de blocs : la roche rouge affleure en plaques
    const rocky = smooth(0.15, 0.4, this.fbm(5, x, z, 300, 2));
    let top = this.pick(rocky * 0.55, OCHRE, RED_ROCK, q, r);
    if (dark > 0.3) top = this.pick(smooth(0.3, 0.7, dark), top, BASALT, q, r, 1);
    const c = this.base(h, { top, sub: PERMAFROST, sd: 4 });
    const [bh, bk] = this.spot(x, z, 7, 0.08 + rocky * 0.35 + ray * 0.4, 211, 0.7, 1.8, 1, 2);
    if (bh && canyon < 0.85) { c.pil = bh; c.pid = bk < 0.25 ? BASALT : RED_ROCK; }
    // calottes polaires : des couches de glace et de poussière
    const cap = smooth(0.78, 0.86, Math.abs(la) + this.fbm(6, x, z, 400, 2) * 0.05);
    if (cap > 0.5) {
      c.h += cap * 6 + Math.round(this.ridged(7, x, z, 140, 2) * 6) * cap;
      c.top = this.pick(smooth(0.5, 0.9, cap), ICE, SNOW, q, r, 2); c.sub = ICE; c.layers = CAP_LAYERS; c.pil = 0;
    }
    return c;
  }

  // ---------- Soufra : le désert de soufre ----------
  desert(x, z, q, r) {
    const g = this.g, [wx, wz] = this.warp(x, z, 800, 240);
    let h = g.base + this.fbm(0, wx, wz, 1600) * g.amp * 0.4 + this.fbm(1, x, z, 90) * 1.5;
    // plateaux et buttes en gradins de 5 blocs
    const mesa = smooth(0.22, 0.3, this.fbm(1, wx, wz, 700));
    if (mesa > 0) h = mix(h, Math.floor((g.base + 14 + this.fbm(2, wx, wz, 900) * 22) / 5) * 5 + this.fbm(4, x, z, 40) * 1.2, mesa);
    // canyons : des vallées sinueuses creusées dans les plateaux
    const v = this.ridged(3, wx, wz, 1100, 2);
    if (v > 0.86) h -= Math.round((v - 0.86) / 0.14 * 30 / 3) * 3;
    // mers de dunes dans les plaines
    const sand = 1 - mesa;
    if (sand > 0.3) h += this.dunes(x, z, 38, 9, 5) * sand;
    // cuvettes de sel, craquelées en polygones
    const salt = h < g.base - 4 && mesa < 0.2;
    if (salt) h = Math.max(h, g.base - 10);
    let top = mesa > 0.5 ? this.pick(smooth(-0.2, 0.3, this.fbm(6, x, z, 70, 2)), LAYERED, SULFUR, q, r) : this.pick(smooth(0.3, 0.6, this.fbm(6, x, z, 120, 2)), DUNE, SAND, q, r);
    if (salt) top = Math.abs(this.n[7](x / 7, z / 7)) < 0.08 ? CRACKED : SALT;
    const c = this.base(h, { top, sub: mesa > 0.5 ? LAYERED : g.sub, sd: 4 });
    // champs de fumerolles : des aiguilles de soufre autour des évents
    const vents = smooth(0.35, 0.5, this.fbm(7, x, z, 600, 2));
    if (!salt && vents > 0) {
      const [ph, pk] = this.spot(x, z, 6, 0.55 * vents, 221, 0.6, 1.6, 2, 7);
      if (ph) { c.pil = ph; c.pid = SULFUR; c.pcap = pk < 0.4 ? IO_SULFUR : 0; }
      if (this.hash(q, r, 222) < vents * 0.5) c.top = this.pick(0.5, SULFUR, IO_SULFUR, q, r, 3);
    }
    return c;
  }

  // ---------- PXT-1 : le désert de grès ----------
  sandstone(x, z, q, r) {
    const g = this.g, [wx, wz] = this.warp(x, z, 900, 260);
    let h = g.base + this.fbm(0, wx, wz, 1500) * g.amp * 0.45 + this.fbm(1, x, z, 110) * 2;
    // buttes et plateaux en gradins de 4 blocs, au sommet de roche dure
    const mesa = smooth(0.24, 0.3, this.fbm(1, wx, wz, 650));
    if (mesa > 0) h = mix(h, Math.floor((g.base + 12 + this.fbm(2, wx, wz, 800) * 24) / 4) * 4, mesa);
    // les badlands au pied des buttes : ravines et cheminées de fée
    const bad = smooth(0.1, 0.24, this.fbm(1, wx, wz, 650)) * (1 - mesa);
    if (bad > 0) h -= this.ridged(4, x, z, 50, 2) * 7 * bad;
    // yardangs : des crêtes de grès allongées dans le sens du vent
    const yz = smooth(0.15, 0.35, this.fbm(5, x, z, 1200, 2)) * (1 - mesa) * (1 - bad);
    let yard = 0;
    if (yz > 0) {
      const [u, v] = this.along(x, z);
      const k = 1 - Math.abs(this.n[6](u / 260, v / 22));
      yard = smooth(0.55, 0.85, k) * 9 * yz;
      h += yard;
    }
    // oueds : des lits de rivière à sec, sinueux
    const [ox, oz] = this.warp(x, z, 300, 90);
    const wadi = Math.abs(this.n[7](ox / 700, oz / 700));
    const inWadi = wadi < 0.025 && mesa < 0.5;
    if (inWadi) h -= (1 - wadi / 0.025) * 4;
    // dunes (dans les plaines)
    const sand = (1 - mesa) * (1 - yz) * (1 - bad * 0.7);
    if (sand > 0.2 && !inWadi) h += this.dunes(x, z, 30, 6, 2) * sand;
    // dômes de granite (inselbergs), lisses et isolés
    let dome = 0;
    this.near(x, z, 900, 0.4, 231, (cx, cz, i, j) => {
      const R = 30 + this.hash(i, j, 232) * 40, d = Math.hypot(x - cx, z - cz) / R;
      if (d < 1) dome = Math.max(dome, Math.sqrt(1 - d * d) * (14 + this.hash(i, j, 233) * 18));
    });
    if (dome > 0) h = Math.max(h, g.base + this.fbm(0, wx, wz, 1500) * g.amp * 0.45 + dome);
    let top = this.pick(smooth(0.2, 0.55, this.fbm(3, x, z, 160, 2)), SAND, DUNE, q, r);
    if (yard > 2) top = SANDSTONE;
    if (sand < 0.6 && !inWadi) top = this.pick(0.35, top, GRAVEL, q, r, 1); // (pavement du désert)
    if (inWadi) top = this.pick(0.3, GRAVEL, SAND, q, r, 2);
    if (mesa > 0.5) top = this.pick(0.25, SANDSTONE, DIORITE, q, r, 3);
    const c = this.base(h, { top, sub: mesa > 0.5 || yard > 2 ? SANDSTONE : SAND, sd: 3 });
    if (dome > 0 && h >= g.base + dome - 0.5) { c.top = DIORITE; c.sub = DIORITE; c.layers = [DIORITE]; }
    // cheminées de fée : une colonne de grès coiffée d'un chapeau de roche dure
    if (bad > 0.2) {
      const [ph, pk] = this.spot(x, z, 8, 0.45 * bad, 241, 0.5, 1.3, 4, 10);
      if (ph) { c.pil = ph; c.pid = pk < 0.5 ? SANDSTONE : TUFF; c.pcap = DIORITE; }
    }
    return c;
  }

  // ---------- Magmara : le monde volcanique ----------
  volcanic(x, z, q, r) {
    const g = this.g, [wx, wz] = this.warp(x, z, 700, 200);
    let h = g.base + this.fbm(0, wx, wz, 1000) * g.amp * 0.45 + this.fbm(1, x, z, 180) * 3 + this.fbm(2, x, z, 40) * 1;
    // volcans boucliers : un par cellule de 700 blocs (souvent), un lac de lave au sommet et des
    // coulées qui en descendent
    let lake = 0, flow = 0;
    this.near(x, z, 700, 0.6, 51, (cx, cz, i, j) => {
      const R = 120 + this.hash(i, j, 52) * 220, H = 30 + this.hash(i, j, 53) * 40;
      const d = Math.hypot(x - cx, z - cz) / R;
      if (d >= 1) return;
      h += this.cone(d, H, 1.4, 0.09, 10);
      if (d < 0.09) lake = Math.max(lake, Math.round(g.base + H * 0.8));
      const ang = Math.atan2(z - cz, x - cx) + this.fbm(3, x, z, 90, 2) * 0.5;
      const k = Math.abs(Math.sin(ang * (3 + Math.floor(this.hash(i, j, 56) * 4)) + i));
      if (d > 0.1 && d < 0.85 && k > 0.985 - d * 0.02) flow = Math.max(flow, k > 0.993 - d * 0.02 ? 2 : 1);
    });
    // cônes de cendre : petits, raides, un cratère au sommet
    let cinder = 0;
    this.near(x, z, 260, 0.35, 57, (cx, cz, i, j) => {
      const R = 16 + this.hash(i, j, 58) * 18, d = Math.hypot(x - cx, z - cz) / R;
      const ch = this.cone(d, 9 + this.hash(i, j, 59) * 9, 1.1, 0.35, 5);
      if (ch > 0) { h += ch; cinder = 1; }
    });
    // fleuves de lave : de longs chenaux sinueux
    const riv = Math.abs(this.n[4](wx / 600, wz / 600));
    const c = this.base(h);
    const ash = smooth(0.2, 0.45, this.fbm(5, x, z, 400));
    c.top = this.pick(ash, BASALT, ASH, q, r);
    if (ash > 0.6) c.sub = ASH;
    if (cinder) { c.top = this.pick(0.4, ASH, TUFF, q, r, 1); c.sub = TUFF; }
    if (riv < 0.02 || flow === 2) { c.h = h - 2; c.fl = Math.round(h - 1); c.fid = LAVA; c.top = OBSIDIAN; c.keep = true; }
    else if (riv < 0.035 || flow === 1) c.top = OBSIDIAN;
    // les plaines se fendent : du magma au fond des fissures
    else if (Math.abs(this.n[6](x / 90, z / 90)) < 0.012) { c.h = h - 1; c.top = MAGMA; c.keep = true; }
    if (lake) { c.fl = Math.max(c.fl, Math.min(lake, Math.round(h) + 2)); c.fid = LAVA; }
    // orgues de basalte : sur les rivages et en terrasses, des colonnes de hauteurs inégales
    const organ = smooth(0.1, 0.3, this.fbm(7, x, z, 300, 2));
    if (organ > 0 && h > this.sea + 1 && h < this.sea + 16 && !c.keep) {
      c.h = Math.round(h + this.hash(q, r, 61) * 3 * organ + organ * 3);
      c.top = BASALT; c.sub = BASALT;
    }
    if (h < this.sea + 2 && h >= this.sea - 1) c.top = OBSIDIAN;
    return c;
  }

  // ---------- PXT-3 : le monde de fer ----------
  ironworld(x, z, q, r) {
    const g = this.g, [wx, wz] = this.warp(x, z, 800, 240);
    let h = g.base + this.fbm(0, wx, wz, 1100) * g.amp * 0.5 + this.fbm(1, x, z, 140) * 2.5;
    // crêtes d'hématite : des arêtes sombres où le fer affleure
    const ridge = this.ridged(2, wx, wz, 520, 3);
    if (ridge > 0.7) h += (ridge - 0.7) / 0.3 * 26;
    // vieilles coulées de basalte, un peu en relief, aux bords lobés
    const flow = smooth(0.18, 0.24, this.fbm(3, wx, wz, 480, 3));
    h += flow * 2;
    // rifts : de longues fissures où la lave remonte
    const [rx, rz] = this.warp(x, z, 400, 120);
    const rift = Math.abs(this.n[4](rx / 1100, rz / 1100));
    let top = this.pick(smooth(0, 0.5, this.fbm(5, x, z, 200, 2)), OCHRE, RED_ROCK, q, r);
    if (flow > 0.5) top = this.pick(0.15, BASALT, ASH_ROCK, q, r, 1);
    if (ridge > 0.78) top = this.pick(0.22, RED_ROCK, IRON_ORE, q, r, 2);
    const c = this.base(h, { top, sub: flow > 0.5 ? BASALT : RED_ROCK, sd: 3 });
    if (rift < 0.018) { c.h = h - 7 * (1 - rift / 0.018); c.fl = Math.round(h - 4); c.fid = LAVA; c.top = BASALT; c.keep = true; }
    else if (rift < 0.03) c.top = this.pick(0.5, OBSIDIAN, MAGMA, q, r, 3);
    // aiguilles de fer : de la roche rouge coiffée de minerai, sur les crêtes
    if (ridge > 0.6 && rift >= 0.03) {
      const [ph] = this.spot(x, z, 9, 0.4 * smooth(0.6, 0.8, ridge), 251, 0.5, 1.3, 3, 9);
      if (ph) { c.pil = ph; c.pid = RED_ROCK; c.pcap = IRON_ORE; }
    } else if (rift >= 0.03) {
      const [bh, bk] = this.spot(x, z, 8, 0.12, 252, 0.7, 1.6, 1, 2);
      if (bh) { c.pil = bh; c.pid = bk < 0.5 ? BASALT : RED_ROCK; }
    }
    if (h < this.sea + 2 && h >= this.sea - 1 && !c.keep) c.top = this.pick(0.5, OBSIDIAN, BASALT, q, r, 4);
    return c;
  }

  // ---------- Brasia (Io) ----------
  io(x, z, q, r) {
    const g = this.g, [wx, wz] = this.warp(x, z, 700, 200);
    let h = g.base + this.fbm(0, wx, wz, 900) * g.amp * 0.4 + this.fbm(1, x, z, 70) * 1.2;
    // montagnes isolées, très raides, et plateaux stratifiés
    const m = this.ridged(1, wx, wz, 1400, 3);
    if (m > 0.78) h += (m - 0.78) / 0.22 * 58;
    const pl = smooth(0.3, 0.34, this.fbm(5, wx, wz, 900, 2));
    if (pl > 0) h = mix(h, Math.floor((g.base + 10 + this.fbm(6, x, z, 500) * 8) / 3) * 3, pl);
    // puits de lave (paterae) : lac, anneau sombre, auréole de retombées claires
    const cell = 320, ci = Math.floor(x / cell), cj = Math.floor(z / cell);
    let pit = 0, halo = 0;
    for (let i = ci - 1; i <= ci + 1; i++) for (let j = cj - 1; j <= cj + 1; j++) {
      if (this.hash(i, j, 61) > 0.45) continue;
      const R = 18 + this.hash(i, j, 62) * 45;
      const px = (i + 0.5) * cell + (this.hash(i, j, 63) - 0.5) * cell * 0.6, pz = (j + 0.5) * cell + (this.hash(i, j, 64) - 0.5) * cell * 0.6;
      const ang = Math.atan2(z - pz, x - px), d = Math.hypot(x - px, z - pz) / (R * (1 + 0.15 * Math.sin(ang * 4 + i * 3)));
      if (d < 1) { h -= 7 * (1 - d * d); pit = Math.max(pit, d < 0.8 ? 2 : 1); }
      else if (d < 2.2) pit = Math.max(pit, 0.5);
      else if (d < 4.5) halo = Math.max(halo, Math.sin((d - 2.2) / 2.3 * Math.PI) * (0.6 + 0.4 * Math.abs(Math.sin(ang * 9 + j))));
    }
    // des taches jaunes, orange et sombres, aux bords fondus
    const t = this.fbm(2, x, z, 250) + this.fbm(3, x, z, 40) * 0.25;
    let top = t > 0.3 ? this.pick(smooth(0.3, 0.45, t), IO_SULFUR, SULFUR, q, r) : t < -0.3 ? this.pick(smooth(-0.3, -0.45, t), IO_SULFUR, ASH_ROCK, q, r) : IO_SULFUR;
    if (halo > 0.3) top = this.pick(halo, top, SULFUR, q, r, 1);
    const c = this.base(h, { top });
    if (pit === 2) { c.fl = Math.round(h) + 2; c.fid = LAVA; c.top = BASALT; }
    else if (pit === 1) c.top = BASALT;
    else if (pit === 0.5) c.top = this.pick(0.6, top, ASH_ROCK, q, r, 2);
    // éboulis au pied des montagnes
    if (m > 0.7 && m < 0.82 && pit === 0) {
      const [bh] = this.spot(x, z, 6, 0.4, 261, 0.6, 1.5, 1, 2);
      if (bh) { c.pil = bh; c.pid = BASALT; }
    }
    return c;
  }

  // ---------- Azura (Europe) ----------
  europa(x, z, q, r) {
    const g = this.g;
    let h = g.base + this.fbm(0, x, z, 1200) * g.amp + this.fbm(5, x, z, 80) * 0.8;
    let top = this.hash(q, r, 70) < 0.3 * smooth(0.2, 0.6, this.fbm(6, x, z, 300, 2)) ? CRACKED_ICE : ICE;
    // lineae : des doubles crêtes brunes de part et d'autre d'une fissure (trois familles)
    for (let i = 0; i < 3; i++) {
      const s = 900 + i * 400, d = Math.abs(this.n[1 + i](x / s + i * 13, z / s));
      if (d < 0.016) {
        top = d < 0.012 ? CRACKED_ICE : this.pick(0.5, top, CRACKED_ICE, q, r, i);
        h += d < 0.0025 ? -2 : d < 0.009 ? 3 : 1;
      }
    }
    // chaos : des plaques de glace basculées, séparées par des fissures
    const chaos = smooth(0.4, 0.5, this.fbm(4, x, z, 1500));
    if (chaos > 0) {
      const [ed, id] = this.plates(x, z, 13, 71), edge = ed < 0.9;
      const ang = id * Math.PI * 2, tilt = (id * 7.3 % 1 - 0.5) * 0.5;
      h += chaos * (edge ? -3 : (id - 0.4) * 9 + (x * Math.cos(ang) + z * Math.sin(ang)) % 13 / 13 * tilt * 10);
      top = edge ? CRACKED_ICE : id * 13.7 % 1 < 0.3 ? CRACKED_ICE : ICE;
    }
    const c = this.base(h, { top, sub: ICE, sd: 3, caves: false });
    // l'océan sous la glace : de 22 blocs sous la surface jusqu'au fond
    c.sea2 = [-40 + Math.round(this.fbm(5, x, z, 600) * 10), Math.round(h) - 22];
    c.fl = -999;
    return c;
  }

  // ---------- Glacia : glaciers et montagnes ----------
  glacier(x, z, q, r) {
    const g = this.g, [wx, wz] = this.warp(x, z, 600, 220);
    let h = g.base + this.fbm(0, wx, wz, 1300) * g.amp * 0.8 + this.fbm(1, x, z, 120) * 2;
    // montagnes : des chaînes déformées, des pics nets ; la roche perce la glace sur les flancs
    const zone = smooth(0.05, 0.35, this.fbm(2, wx, wz, 1800, 2));
    const m = this.ridged(3, wx, wz, 520, 4) * zone;
    const mount = smooth(0.42, 0.75, m);
    h += mount * mount * 62;
    // champs de crevasses au pied des montagnes : des entailles parallèles et profondes
    let crev = false;
    if (mount > 0.03 && mount < 0.3 && h > this.sea + 3) {
      const [u] = this.along(x, z, Math.atan2(this.n[4](x / 400, z / 400), 1) * 2);
      if (Math.abs(Math.sin(u / 5 + this.fbm(4, x, z, 60, 2) * 3)) > 0.97) { h -= 11; crev = true; }
    }
    const c = this.base(h, { top: SNOW, sub: ICE, sd: 5 });
    if (mount > 0.35) c.layers = ROCK_LAYERS;
    if (crev) { c.top = BLUE_ICE; c.caves = false; c.keep = true; }
    // la mer, prise par la banquise en plaques (de l'eau libre entre elles) ; des icebergs
    if (h < this.sea) {
      const [ed, id] = this.plates(x, z, 16, 81);
      const gap = ed < 0.8 + this.fbm(6, x, z, 30, 2) * 0.6 || id < 0.15;
      c.cap = gap ? 0 : ICE;
      this.near(x, z, 160, 0.3, 83, (cx, cz, i, j) => {
        const R = 6 + this.hash(i, j, 84) * 12, d = Math.hypot(x - cx, z - cz) / R;
        if (d < 1) { c.h = Math.max(c.h, this.sea + (1 - d * d) * (5 + this.hash(i, j, 85) * 14)); c.top = this.pick(0.5, SNOW, BLUE_ICE, q, r); c.sub = BLUE_ICE; }
      });
    } else if (mount < 0.2 && !crev) {
      // sastrugi : la neige sculptée par le vent en vaguelettes
      const [u] = this.along(x, z);
      const k = Math.sin(u / 3.4 + this.fbm(5, x, z, 40, 2) * 4);
      if (k > 0.35) { c.pil = 1; c.pid = SNOW_LAYER + Math.min(2, Math.floor((k - 0.35) / 0.65 * 3)); }
      else if (this.hash(q, r, 86) < 0.0007) { c.pil = 3 + Math.floor(this.hash(q, r, 87) * 6); c.pid = ICE; c.pcap = BLUE_ICE; } // (geysers gelés)
    }
    if (mount > 0.6 && h > g.base + 50) c.top = SNOW;
    return c;
  }

  // ---------- PXT-2 : le monde gelé de la naine rouge ----------
  redice(x, z, q, r) {
    const g = this.g, [wx, wz] = this.warp(x, z, 700, 240);
    let h = g.base + this.fbm(0, wx, wz, 1200) * g.amp * 0.7 + this.fbm(1, x, z, 90) * 1.5;
    // pitons de roche sombre, raides, qui percent la glace
    const peak = this.ridged(2, wx, wz, 700, 3);
    const rock = smooth(0.74, 0.9, peak);
    h += rock * 40;
    // cryovolcans : des cônes de glace, un lac d'eau glaciale au sommet
    let crater = 0;
    this.near(x, z, 900, 0.35, 91, (cx, cz, i, j) => {
      const R = 60 + this.hash(i, j, 92) * 60, H = 22 + this.hash(i, j, 93) * 20;
      const d = Math.hypot(x - cx, z - cz) / R;
      if (d >= 1) return;
      h += this.cone(d, H, 1.5, 0.14, 8);
      if (d < 0.14) crater = Math.round(g.base + H * 0.7);
    });
    let top = this.pick(smooth(0.25, 0.6, this.fbm(3, x, z, 260, 2)), SNOW, ICE, q, r);
    const c = this.base(h, { top, sub: ICE, sd: 4 });
    if (rock > 0.25) { c.layers = DARK_LAYERS; c.top = this.pick(0.5, SLATE, SNOW, q, r, 1); }
    if (crater) { c.fl = Math.min(crater, Math.round(h) + 3); c.fid = ICE_WATER; c.cap = BLUE_ICE; c.top = BLUE_ICE; }
    // la mer : prise par une glace fissurée
    if (h < this.sea) c.cap = Math.abs(this.n[4](x / 60, z / 60)) < 0.03 ? CRACKED_ICE : this.pick(0.3, ICE, BLUE_ICE, q, r, 2);
    // champs de pénitents : des lames de glace serrées, plus hautes au cœur du champ
    const pen = smooth(0.15, 0.4, this.fbm(5, wx, wz, 500, 2));
    if (pen > 0 && h >= this.sea && rock < 0.25 && !crater) {
      const [u] = this.along(x, z);
      if (this.hash(q, r, 94) < 0.35 + 0.3 * Math.abs(Math.sin(u / 2.5))) {
        c.pil = 1 + Math.floor(this.hash(q, r, 95) * (1 + 5 * pen));
        c.pid = this.hash(q, r, 96) < 0.4 ? BLUE_ICE : ICE;
        c.top = ICE;
      }
    } else if (h >= this.sea && rock < 0.25) {
      const [bh] = this.spot(x, z, 10, 0.08, 97, 0.7, 1.6, 1, 2);
      if (bh) { c.pil = bh; c.pid = SLATE; }
    }
    return c;
  }

  // ---------- Nox (Pluton) ----------
  pluto(x, z, q, r) {
    const g = this.g, la = this.lat(z), [wx, wz] = this.warp(x, z, 700, 220);
    let h = g.base + this.fbm(0, wx, wz, 1100) * g.amp * 0.6 + this.fbm(4, x, z, 90) * 1.5;
    // montagnes de glace d'eau, en gros blocs entassés
    const m = this.ridged(1, wx, wz, 700);
    if (m > 0.68) h += (m - 0.68) / 0.32 * 46 + (this.hash(Math.floor(x / 7), Math.floor(z / 7), 111) - 0.5) * 8 * smooth(0.7, 0.8, m);
    // terrain en lames (penitentes géants) dans les hautes terres
    const blade = smooth(0.3, 0.5, this.fbm(5, wx, wz, 1400, 2));
    if (blade > 0) { const [u] = this.along(x, z, 0.6); h += (1 - Math.abs(Math.sin(u / 6 + this.fbm(6, x, z, 80, 2) * 2))) ** 3 * 14 * blade; }
    // la grande plaine d'azote : lisse, découpée en cellules hexagonales (des sillons)
    const B = this.big, dp = Math.hypot((x - B.x) * 0.8, z - B.z) / (B.r * 3) + this.fbm(2, x, z, 800, 2) * 0.15;
    const plain = smooth(1, 0.85, dp);
    let top = this.pick(smooth(0.2, 0.5, m), g.top, ICE, q, r);
    if (plain > 0) {
      h = mix(h, g.base - 6, plain);
      if (plain > 0.6) {
        // cellules de convection : la distance au bord de l'hexagone le plus proche
        const s = 38, qq = (x * Math.sqrt(3) / 3 - z / 3) / s, rr = (z * 2 / 3) / s;
        let rq = Math.round(qq), rrr = Math.round(rr), rs = Math.round(-qq - rr);
        const dq = Math.abs(rq - qq), dr = Math.abs(rrr - rr), ds = Math.abs(rs + qq + rr);
        if (dq > dr && dq > ds) rq = -rrr - rs; else if (dr > ds) rrr = -rq - rs;
        const cx = s * Math.sqrt(3) * (rq + rrr / 2), cz = s * 1.5 * rrr;
        const ed = Math.hypot(x - cx, z - cz) / s;
        if (ed > 0.82) { h -= 2; top = this.pick(0.4, NITROGEN, THOLIN, q, r, 1); }
        h += (1 - ed) * 2;
      }
    }
    // tholins : les terres sombres de l'équateur (cratérisées)
    const dark = plain < 0.3 ? smooth(0.42, 0.3, Math.abs(la) - this.fbm(3, x, z, 900, 2) * 0.15) : 0;
    if (dark > 0) { const [dh] = this.craters(x, z, 260, 0.4, 40, 91); h += dh * dark; top = this.pick(dark, top, THOLIN, q, r, 2); }
    if (m > 0.78) top = BLUE_ICE;
    return this.base(h, { top, sub: plain > 0.5 ? NITROGEN : g.sub, sd: plain > 0.5 ? 6 : 3 });
  }

  // ---------- Vesper : le climat suit la hauteur de l'astre ----------
  // (e : hauteur de l'astre, un peu irrégulière ; le relief vient d'abord, sans les arbres)
  twiElev(x, z) { return sunElev(this.body, x, z) + this.fbm(0, x, z, 3000, 2) * 0.012; }
  twiH(x, z, e) {
    const g = this.g, heat = smooth(0.08, 0.22, e), frost = smooth(-0.08, -0.2, e);
    let h = g.base + this.fbm(1, x, z, 800) * g.amp * 0.7 + this.fbm(2, x, z, 170) * g.amp * 0.18 + this.fbm(7, x, z, 45) * 1.2;
    // face à l'astre, tout a fondu : le sol s'enfonce sous la lave, seules des îles dépassent
    h -= heat * 16;
    if (heat > 0.5) { const a = this.fbm(3, x, z, 500); if (a > 0.25) h += (a - 0.25) * 60; }
    // dans la nuit : des montagnes de glace
    if (frost > 0) { const m = this.ridged(4, x, z, 900); if (m > 0.6) h += ((m - 0.6) / 0.4) * 60 * frost; }
    // (entre les deux, le sol reste au-dessus de la mer : la lave et l'eau ne se touchent jamais)
    if (e > 0.06 && e < 0.13) h = Math.max(h, g.sea + 2);
    return h;
  }
  // L'arbre de la cellule (ci, cj) : { q, r, h } ou null
  twiTree(ci, cj) {
    const k = ci * 40503 + cj * 69427;
    let t = this.trees?.get(k);
    if (t !== undefined) return t;
    t = null;
    if (this.hash(ci, cj, 91) < 0.6) {
      const q = ci * 10 + 1 + Math.floor(this.hash(ci, cj, 92) * 8), r = cj * 10 + 1 + Math.floor(this.hash(ci, cj, 93) * 8);
      const { x, z } = hexToWorld(q, r), e = this.twiElev(x, z);
      if (e > -0.05 && e < 0.045) { const h = Math.round(this.twiH(x, z, e)); if (h > this.g.sea + 1) t = { q, r, h }; }
    }
    (this.trees ||= new Map()).size > 6000 && this.trees.clear();
    this.trees.set(k, t);
    return t;
  }
  twilight(x, z, q, r) {
    const g = this.g, e = this.twiElev(x, z), h = this.twiH(x, z, e);
    const c = this.base(h);
    if (e > 0.13) {
      // la lave en fusion
      c.fid = LAVA; c.sub = BASALT; c.rock = BASALT; c.caves = false; c.layers = HOT_LAYERS;
      c.top = this.hash(q, r, 94) < 0.12 ? MAGMA : this.fbm(5, x, z, 60, 2) > 0.2 ? OBSIDIAN : BASALT;
    } else if (e > 0.06) {
      // terres brûlées : cendre et fleuves de lave figés
      c.fl = -999; c.sub = ASH_ROCK; c.layers = HOT_LAYERS;
      c.top = this.pick(smooth(0.05, 0.25, this.fbm(5, x, z, 140, 2)), ASH_ROCK, ASH, q, r);
      if (Math.abs(this.n[6](x / 300, z / 300)) < 0.02) c.top = OBSIDIAN;
    } else if (e > -0.075) {
      // le crépuscule : de l'herbe, de l'eau, des arbres
      if (h <= g.sea + 1) { c.top = SAND; c.sub = SAND; }
      else if (e > 0.045) { c.top = this.pick(smooth(0.045, 0.06, e), GRASS, DUNE, q, r); c.sub = SAND; }
      else if (e < -0.05) {
        c.top = this.pick(smooth(-0.05, -0.065, e), GRASS, TUNDRA, q, r); c.sub = PERMAFROST;
        const [bh] = this.spot(x, z, 9, 0.12, 98, 0.6, 1.5, 1, 2);
        if (bh) { c.pil = bh; c.pid = this.hash(q, r, 99) < 0.5 ? STONE : DIORITE; }
      } else {
        const ci = Math.floor(q / 10), cj = Math.floor(r / 10);
        for (let i = ci - 1; i <= ci + 1 && !c.pil; i++) for (let j = cj - 1; j <= cj + 1; j++) {
          const t = this.twiTree(i, j);
          if (!t) continue;
          const dq = q - t.q, dr = r - t.r, d = (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
          if (d === 0) { c.pil = 5; c.pid = LOG; c.top = DIRT; c.can = [t.h + 6, t.h + 7]; c.keep = true; break; }
          if (d <= 2) { const low = d === 1 ? t.h + 3 : t.h + 4; c.can = c.can ? [Math.min(c.can[0], low), Math.max(c.can[1], d === 1 ? t.h + 6 : t.h + 5)] : [low, d === 1 ? t.h + 6 : t.h + 5]; }
        }
      }
    } else {
      // la nuit : neige, glace et mers prises
      c.sub = ICE; c.sd = 5;
      c.top = this.ridged(4, x, z, 900) > 0.72 ? BLUE_ICE : SNOW;
      c.fid = ICE_WATER;
      c.layers = this.ridged(4, x, z, 900) > 0.66 ? ROCK_LAYERS : [BLUE_ICE, ICE];
      if (h < this.sea) c.cap = ICE;
    }
    return c;
  }

  // ---------- Pélagia : l'océan gelé ----------
  frozenocean(x, z, q, r) {
    const g = this.g;
    let h = g.base + this.fbm(0, x, z, 1400) * g.amp * 0.5 + this.fbm(1, x, z, 120) * 1.2;
    let top = this.fbm(2, x, z, 500) > 0.05 ? SNOW : this.fbm(3, x, z, 220) > 0 ? ICE : BLUE_ICE;
    // crêtes de pression, là où les plaques de banquise se poussent : des blocs entassés
    const ridge = this.ridged(4, x, z, 420, 2);
    if (ridge > 0.84) { h += ((ridge - 0.84) / 0.16) * 9 + this.hash(q, r, 105) * 3; top = this.hash(q, r, 95) < 0.5 ? CRACKED_ICE : BLUE_ICE; }
    // icebergs prisonniers de la glace
    const cell = 300, ci = Math.floor(x / cell), cj = Math.floor(z / cell);
    let berg = 0;
    for (let i = ci - 1; i <= ci + 1; i++) for (let j = cj - 1; j <= cj + 1; j++) {
      if (this.hash(i, j, 96) > 0.35) continue;
      const R = 18 + this.hash(i, j, 97) * 42, H = 16 + this.hash(i, j, 98) * 52;
      const d = Math.hypot(x - (i + 0.2 + this.hash(i, j, 99) * 0.6) * cell, z - (j + 0.2 + this.hash(i, j, 100) * 0.6) * cell) / R;
      if (d < 1) berg = Math.max(berg, (1 - d) ** 0.7 * H * (0.75 + 0.25 * this.fbm(5, x, z, 14, 2)));
    }
    if (berg > 0) { h += berg; top = berg > 26 ? SNOW : BLUE_ICE; }
    // de rares îles de roche : les seuls endroits où creuser sans traverser l'océan
    const ic = 3600, ii = Math.floor(x / ic), ij = Math.floor(z / ic);
    let isle = 0;
    for (let i = ii - 1; i <= ii + 1; i++) for (let j = ij - 1; j <= ij + 1; j++) {
      if (this.hash(i, j, 101) > 0.3) continue;
      const R = 120 + this.hash(i, j, 102) * 220;
      const d = Math.hypot(x - (i + 0.25 + this.hash(i, j, 103) * 0.5) * ic, z - (j + 0.25 + this.hash(i, j, 104) * 0.5) * ic) / R + this.fbm(6, x, z, 90, 2) * 0.15;
      if (d < 1) isle = Math.max(isle, 1 - d);
    }
    if (isle > 0) {
      h += smooth(0, 0.5, isle) * 34;
      return this.base(h, { top: h > g.base + 18 ? SNOW : this.pick(0.3, ASH_ROCK, SLATE, q, r), sub: STONE, rock: STONE, sd: 4, caves: true, layers: DARK_LAYERS });
    }
    const c = this.base(h, { top, sub: ICE, sd: 7, caves: false });
    // l'océan : sous la croûte, jusqu'au fond
    c.sea2 = [-110 + Math.round(this.fbm(7, x, z, 900) * 28), Math.round(g.base) - 8];
    c.sfid = ICE_WATER;
    // fissures : de l'eau libre, noire, au fond d'une entaille dans la banquise
    if (berg === 0 && ridge < 0.7 && Math.abs(this.n[1](x / 340, z / 340)) < 0.007) { c.h = g.base - 4; c.fl = g.base - 2; c.fid = ICE_WATER; c.top = ICE; c.keep = true; }
    else if (top === SNOW && berg === 0 && ridge < 0.8) {
      // sastrugi
      const [u] = this.along(x, z);
      const k = Math.sin(u / 3.2 + this.fbm(5, x, z, 40, 2) * 4);
      if (k > 0.45) { c.pil = 1; c.pid = SNOW_LAYER + Math.min(2, Math.floor((k - 0.45) / 0.55 * 3)); }
    }
    return c;
  }

  // ---------- Eldra (Pipiens) : océans, continents, lichens violet-noir ----------
  // Les grands traits, placés une fois : la mer intérieure (sur un continent), l'archipel
  // volcanique (en pleine mer) et la Cordillère d'Orvane (une longue chaîne, ~20 000 blocs)
  eldraSetup() {
    const B = this.big, a = this.hash(1, 2, 500) * Math.PI * 2;
    return {
      inl: { x: B.x, z: B.z, r: B.r * 5 },
      arch: { x: B.x + Math.cos(a) * 9000, z: Math.max(-6000, Math.min(6000, Math.sin(a) * 5000)), r: 3200 },
      cordZ: B.z + (this.hash(1, 3, 501) < 0.5 ? -1 : 1) * (1500 + this.hash(1, 4, 502) * 1200), cordX: B.x + (this.hash(1, 5, 503) - 0.5) * 6000,
      volc: new Map(),
    };
  }
  // la terre (> 0) ou la mer (< 0)
  eldraCont(x, z) {
    const E = this.eld ||= this.eldraSetup(), [wx, wz] = this.warp(x, z, 9000, 4000);
    let c = this.fbm(0, wx, wz, 26000, 6) - 0.07 + 0.2 * Math.exp(-(x * x + z * z) / (2600 * 2600));
    const di = Math.hypot(x - E.inl.x, z - E.inl.z) / E.inl.r;
    c += 0.3 * smooth(1.8, 1.0, di); // (la mer intérieure est au milieu des terres)
    c -= 0.25 * smooth(1.2, 0.6, Math.hypot(x - E.arch.x, z - E.arch.z) / E.arch.r); // (l'archipel : en pleine mer)
    return c;
  }
  eldra(x, z, q, r) {
    const g = this.g, E = this.eld ||= this.eldraSetup(), la = this.lat(z), sea = g.sea, [wx, wz] = this.warp(x, z, 700, 200);
    let land = this.eldraCont(x, z);
    // la Cordillère d'Orvane : une chaîne étroite et très haute, des pics nets
    const lz = E.cordZ + this.fbm(3, x, 0, 5000, 2) * 2200, w = 650 + this.fbm(3, x, 40, 1600, 2) * 260;
    const dl = Math.abs(z - lz + this.fbm(4, x, z, 900, 2) * 160) / w, along = smooth(10500, 8500, Math.abs(x - E.cordX));
    const core = smooth(1, 0.12, dl) * along;
    const lift = Math.max(smooth(2.4, 0.9, dl) * along * 0.22, core * 0.4); // (les contreforts)
    if (lift > 0) land = Math.max(land, lift);
    let h = land > 0
      ? sea + 1 + Math.min(1, land / 0.3) ** 0.8 * 14 + this.fbm(1, wx, wz, 500) * 7 * smooth(0, 0.08, land)
      : Math.max(sea - 34, sea + 1 + land * 140) + this.fbm(2, x, z, 120) * 1.5;
    h += this.fbm(2, x, z, 70) * 1.2;
    const m = this.ridged(4, wx, wz, 380, 4);
    if (core > 0) h += core ** 1.2 * (22 + m * m * 66);
    // la mer intérieure : peu profonde, ses fonds et ses rives couverts de tapis microbiens
    const [ix, iz] = this.warp(x, z, 1400, 520), di = Math.hypot(ix - E.inl.x, iz - E.inl.z) / E.inl.r + this.fbm(5, x, z, 700, 3) * 0.4;
    const inl = core < 0.1 ? smooth(1, 0.8, di) : 0;
    if (inl > 0) h = mix(h, sea - 2 + this.fbm(6, x, z, 60, 2) * 1.6, inl);
    // les plaines de sel blanc, au cœur des terres
    const sp = this.fbm(7, wx, wz, 1500, 2), salt = land > 0.07 && core < 0.05 && di > 1.2 ? smooth(0.36, 0.44, sp) : 0;
    if (salt > 0) h = mix(h, sea + 4 + this.fbm(6, x, z, 200, 2) * 0.8, salt);
    // l'arc volcanique de la côte est, et les volcans de l'archipel : des cônes de basalte noir
    let volc = 0, crater = 0;
    const da = Math.hypot(x - E.arch.x, z - E.arch.z) / E.arch.r;
    this.near(x, z, 800, 0.6, 511, (cx, cz, i, j) => {
      const k = i * 92821 + j;
      let v = E.volc.get(k);
      if (v === undefined) {
        const c0 = this.eldraCont(cx, cz), east = c0 > -0.04 && c0 < 0.1 && this.eldraCont(cx + 450, cz) < c0 - 0.03;
        const arch = Math.hypot(cx - E.arch.x, cz - E.arch.z) < E.arch.r;
        v = east || arch ? { R: (arch ? 220 : 150) + this.hash(i, j, 512) * (arch ? 230 : 150), H: (arch ? 40 : 30) + this.hash(i, j, 513) * 30, arch } : null;
        if (E.volc.size > 4000) E.volc.clear();
        E.volc.set(k, v);
      }
      if (!v) return;
      const d = Math.hypot(x - cx, z - cz) / v.R;
      if (d >= 1) return;
      const base = v.arch ? sea - 14 : sea, top = base + this.cone(d, v.H, 1.5, 0.12, 9);
      if (top > h) { h = top; volc = Math.max(volc, 1 - d); }
      if (d < 0.12 && this.hash(i, j, 514) < 0.6) crater = Math.round(base + v.H * 0.72);
    });
    if (da < 1 && volc === 0 && land < 0) h = Math.min(h, sea - 6 - (1 - da) * 6);
    // ---- les blocs du dessus ----
    const wet = this.fbm(8, x, z, 900, 2), bare = this.fbm(9, x, z, 260, 2);
    let top = LICHEN, sub = DIRT, sd = 3, layers = null;
    if (h <= sea + 1 && inl < 0.3) { top = this.pick(smooth(-0.1, 0.25, wet), SAND, GRAVEL, q, r); sub = SAND; }
    else if (wet > 0.18 && h < sea + 22) top = this.pick(smooth(0.18, 0.32, wet), LICHEN, MOSS, q, r);
    if (bare > 0.32 || h > sea + 46) { top = this.pick(smooth(0.32, 0.5, bare) + (h > sea + 46 ? 1 : 0), top, STONE, q, r, 1); }
    if (inl > 0.05) { top = this.fbm(10, x, z, 45, 2) > 0 ? MAT_O : MAT_G; sub = CLAY; }
    if (salt > 0.5) { top = Math.abs(this.n[11](x / 7, z / 7)) < 0.07 ? CRACKED : SALT; sub = SALT; sd = 2; }
    if (volc > 0) { top = this.pick(smooth(0.0, 0.25, volc), top, this.hash(q, r, 515) < 0.15 ? ASH_ROCK : BASALT, q, r, 2); sub = BASALT; layers = HOT_LAYERS; }
    // (la côte est : des plages de basalte noir)
    if (h <= sea + 2 && land > -0.06 && volc === 0 && this.fbm(11, x, z, 3000, 2) > 0.15) { top = BASALT; sub = BASALT; }
    if (core > 0.3 && h > sea + 70) top = SNOW;
    const c = this.base(h, { top, sub, sd });
    if (layers) c.layers = layers;
    if (crater && h > crater - 6) { c.fl = Math.min(crater, Math.round(h) + 2); c.fid = LAVA; c.top = BASALT; }
    // les calottes polaires (les glaciers descendent vers 55° de latitude)
    const al = Math.abs(la) + this.fbm(6, x, z, 600, 2) * 0.06, cap = smooth(0.8, 0.88, al) + (al > 0.6 && this.fbm(7, x, z, 90, 2) > 0.25 ? 0.35 : 0); // (au-delà de 55° : des névés)
    if (cap > 0.3) {
      if (h < sea) c.cap = ICE;
      else { c.top = this.pick(smooth(0.3, 0.7, cap), c.top, SNOW, q, r, 3); if (cap > 0.8) { c.h += Math.round((cap - 0.8) * 30); c.sub = ICE; c.top = SNOW; c.layers = CAP_LAYERS; } }
    }
    // des rochers couverts de lichens
    if (c.h > sea + 1 && !inl && !salt && !volc && cap < 0.3) {
      const [bh] = this.spot(x, z, 9, 0.06, 516, 0.7, 1.7, 1, 2);
      if (bh) { c.pil = bh; c.pid = STONE; c.pcap = LICHEN; }
    }
    return c;
  }

  // ---------- Glacyon (Pipiens) : azote rose, glace d'eau, cryovolcans, dunes de tholins ----------
  glacyon(x, z, q, r) {
    const g = this.g, [wx, wz] = this.warp(x, z, 800, 260);
    let h = g.base + this.fbm(0, wx, wz, 1300) * g.amp * 0.55 + this.fbm(4, x, z, 90) * 1.4;
    // montagnes de glace d'eau (jusqu'à ~70 blocs)
    const m = this.ridged(1, wx, wz, 800, 4), mount = smooth(0.6, 0.95, m);
    h += mount * 70;
    // les plaines d'azote : lisses, blanc-rose, découpées en cellules
    const plain = mount < 0.1 ? smooth(0.04, 0.22, this.fbm(2, wx, wz, 7000, 4)) : 0;
    let top = this.pick(smooth(0.2, 0.5, m), g.top, ICE, q, r), sub = g.sub, sd = 3;
    if (plain > 0) {
      h = mix(h, g.base - 5 + this.fbm(3, x, z, 300, 2) * 0.8, plain);
      top = this.fbm(3, x, z, 160, 2) > 0.05 ? PINK : NITROGEN; sub = NITROGEN; sd = 6;
      if (plain > 0.6) {
        const s = 34, qq = (x * Math.sqrt(3) / 3 - z / 3) / s, rr = (z * 2 / 3) / s;
        let rq = Math.round(qq), rrr = Math.round(rr), rs = Math.round(-qq - rr);
        const dq = Math.abs(rq - qq), dr = Math.abs(rrr - rr), ds = Math.abs(rs + qq + rr);
        if (dq > dr && dq > ds) rq = -rrr - rs; else if (dr > ds) rrr = -rq - rs;
        const ed = Math.hypot(x - s * Math.sqrt(3) * (rq + rrr / 2), z - s * 1.5 * rrr) / s;
        if (ed > 0.84) { h -= 1; top = this.pick(0.5, NITROGEN, THOLIN, q, r, 1); }
      }
    }
    // dunes de tholins rouge-brun
    const dune = plain < 0.3 && mount < 0.15 ? smooth(0.12, 0.3, this.fbm(5, wx, wz, 5000, 4)) : 0;
    if (dune > 0) { h += this.dunes(x, z, 30, 7, 6) * dune; if (dune > 0.3) { top = this.pick(smooth(0.3, 0.6, dune), top, THOLIN, q, r, 2); sub = THOLIN; } }
    // cryovolcans (eau, ammoniac, méthane) : des cônes de glace, un lac gelé au sommet
    let crater = 0, cryo = 0;
    this.near(x, z, 1000, 0.35, 521, (cx, cz, i, j) => {
      const R = 70 + this.hash(i, j, 522) * 70, H = 24 + this.hash(i, j, 523) * 22, d = Math.hypot(x - cx, z - cz) / R;
      if (d >= 1) return;
      h += this.cone(d, H, 1.5, 0.14, 8); cryo = Math.max(cryo, 1 - d);
      if (d < 0.14) crater = Math.round(g.base + H * 0.68);
    });
    if (cryo > 0) { top = this.pick(smooth(0, 0.6, cryo), top, this.hash(q, r, 524) < 0.2 ? CRACKED_ICE : BLUE_ICE, q, r, 3); sub = ICE; }
    if (mount > 0.5) top = this.pick(0.4, ICE, BLUE_ICE, q, r, 4);
    const c = this.base(h, { top, sub, sd });
    if (mount > 0.2) c.layers = [BLUE_ICE, ICE, BLUE_ICE, ICE];
    if (crater) { c.fl = Math.min(crater, Math.round(h) + 3); c.fid = ICE; c.cap = CRACKED_ICE; c.top = BLUE_ICE; }
    // l'océan probable, très loin sous la glace
    c.sea2 = [-120 + Math.round(this.fbm(7, x, z, 900) * 20), -72];
    c.sfid = ICE_WATER;
    if (!plain && !dune && !cryo && mount < 0.2) {
      const [bh] = this.spot(x, z, 11, 0.05, 525, 0.7, 1.6, 1, 2);
      if (bh) { c.pil = bh; c.pid = ICE; }
    }
    return c;
  }

  // ---------- Blocs ----------
  // ---------- Ethan : Cinder, l'enfer métallique (rotation synchrone, comme Vesper) ----------
  cinder(x, z, q, r) {
    const g = this.g, e = this.twiElev(x, z), [wx, wz] = this.warp(x, z, 700, 200);
    const heat = smooth(0.05, 0.25, e);
    let h = g.base + this.fbm(1, wx, wz, 900) * g.amp * 0.6 + this.fbm(2, x, z, 150) * g.amp * 0.15 + this.fbm(7, x, z, 40) * 1.2;
    h -= heat * 18; // (face aux pulsars, le fer a fondu : une mer, et des îles)
    if (heat > 0.4) { const a = this.fbm(3, wx, wz, 420); if (a > 0.3) h += (a - 0.3) * 50; }
    const c = this.base(h, { sub: SLAG, sd: 3 });
    const crack = Math.abs(this.n[4](wx / 140, wz / 140)), crust = smooth(0.1, 0.35, this.fbm(5, x, z, 260, 2));
    if (e > 0.12) { c.top = this.pick(0.25, BASALT, OBSIDIAN, q, r); c.layers = HOT_LAYERS; c.caves = false; }
    else if (e > -0.15) {
      // les plaines de scories ; des fissures où la croûte rougeoie
      c.fl = -999;
      c.top = crack < 0.03 ? GLOW_CRUST : this.pick(crust * 0.35, SLAG, GLOW_CRUST, q, r, 1);
      if (crack < 0.012) { c.h = h - 2; c.top = GLOW_CRUST; }
    } else {
      // la nuit : les scories gelées, des plaques de croûte qui brillent encore dans le noir
      c.fl = -999;
      c.top = crack < 0.02 ? GLOW_CRUST : this.pick(smooth(0.3, 0.6, this.fbm(5, x, z, 300, 2)) * 0.3, SLAG, BASALT, q, r, 2);
    }
    // geysers de métal : des cheminées de scories coiffées de croûte brûlante
    if (e > -0.3 && c.fl <= c.h) {
      const [ph] = this.spot(x, z, 40, 0.18, 301, 0.6, 1.4, 3, 9);
      if (ph) { c.pil = ph; c.pid = SLAG; c.pcap = GLOW_CRUST; }
    }
    if (c.fl > h - 1 && c.fl > h && e > 0.12) c.top = this.pick(0.4, OBSIDIAN, GLOW_CRUST, q, r, 3);
    return c;
  }

  // ---------- Ethan : Voss, la planète-diamant ----------
  voss(x, z, q, r) {
    const g = this.g, [wx, wz] = this.warp(x, z, 900, 260);
    let h = g.base + this.fbm(0, wx, wz, 1300) * g.amp * 0.45 + this.fbm(1, x, z, 130) * 2;
    // plateaux de graphite en gradins (des marches de 6), aux falaises de diamant
    const pl = smooth(0.12, 0.2, this.fbm(2, wx, wz, 700, 3));
    if (pl > 0) h = mix(h, Math.floor((g.base + 14 + this.fbm(3, wx, wz, 500) * 26) / 6) * 6, pl);
    // rivières de carbure : de longs sillons sinueux
    const [rx, rz] = this.warp(x, z, 500, 160), riv = Math.abs(this.n[4](rx / 1600, rz / 1600));
    // lacs d'hydrocarbures (en cuvettes, figés en verre noir)
    const lake = smooth(0.3, 0.36, -this.fbm(5, wx, wz, 1100, 2));
    let top = this.pick(smooth(0.2, 0.5, this.fbm(6, x, z, 90, 2)) * 0.25, GRAPHITE, SLATE, q, r);
    if (lake > 0 && pl < 0.5) { h = mix(h, g.base - 6, lake); if (lake > 0.6) top = BLACK_GLASS; }
    const c = this.base(h, { top, sub: GRAPHITE, sd: 3 });
    if (riv < 0.014 && pl < 0.5 && lake < 0.6) { c.h = h - 3 - (1 - riv / 0.014) * 2; c.top = BASALT; c.keep = true; }
    if (lake > 0.6) { c.keep = true; c.caves = false; }
    // aiguilles et affleurements de diamant brut
    if (!c.keep) {
      const [ph, pk] = this.spot(x, z, 22, 0.22, 311, 0.6, 1.5, 2, 8);
      if (ph) { c.pil = ph; c.pid = pk < 0.6 ? GRAPHITE : DIAMOND; c.pcap = DIAMOND; }
      else if (this.hash(q, r, 312) < 0.01) c.top = DIAMOND;
    }
    return c;
  }

  // ---------- Ethan : Halo, le monde-oasis ----------
  halo(x, z, q, r) {
    const g = this.g, [wx, wz] = this.warp(x, z, 1200, 420);
    // un océan peu profond, des îles et des terres basses ; quelques chaînes (falaises d'aurore)
    const land = this.fbm(0, wx, wz, 2200, 3) + 0.08;
    let h = g.sea - 5 + land * 26 + this.fbm(1, x, z, 160) * 2.2;
    const m = this.ridged(2, wx, wz, 900, 3) * smooth(0.05, 0.25, land);
    if (m > 0.62) h += Math.floor(((m - 0.62) / 0.38) * 46 / 4) * 4; // (en gradins : des falaises)
    const c = this.base(h);
    if (h < this.sea) {
      // le fond : sable sombre, et les récifs bleu électrique là où l'eau est peu profonde
      c.top = this.sea - h <= 4 && this.fbm(3, x, z, 70, 2) > -0.05 ? REEF : this.pick(0.3, SAND, GRAVEL, q, r);
      c.sub = SAND;
      if (c.top === REEF && this.hash(q, r, 321) < 0.12) { c.pil = 1 + Math.floor(this.hash(q, r, 322) * Math.min(3, this.sea - h)); c.pid = REEF; }
      return c;
    }
    if (h <= this.sea + 1) { c.top = this.pick(0.3, SAND, BLACK_GLASS, q, r, 1); c.sub = SAND; return c; }
    // plaines de verre noir : d'anciens impacts de particules (cuvettes vitrifiées)
    const glass = smooth(0.25, 0.32, this.fbm(4, wx, wz, 800, 2));
    if (glass > 0) {
      const [dh] = this.craters(x, z, 120, 0.5, 26, 331);
      c.h = h + dh * glass; c.top = this.pick(glass, RADIO, BLACK_GLASS, q, r, 2); c.sub = OBSIDIAN;
      return c;
    }
    if (m > 0.62) { c.layers = [STONE, SLATE, STONE, QUARTZ, STONE]; return c; }
    // forêts de cristaux végétaux : des troncs de cristal, plus serrés au cœur des forêts
    const forest = smooth(0.0, 0.25, this.fbm(5, x, z, 600, 2));
    if (forest > 0) {
      const [ph] = this.spot(x, z, 4, 0.9 * forest, 341, 0.6, 1.4, 3, 9);
      if (ph) { c.pil = ph; c.pid = CRYSTAL; }
    } else if (this.hash(q, r, 342) < 0.004) { c.pil = 1; c.pid = CRYSTAL; }
    return c;
  }

  // ---------- Ethan : Tessel, le désert cristallin ----------
  tessel(x, z, q, r) {
    const g = this.g, [wx, wz] = this.warp(x, z, 900, 260);
    let h = g.base + this.fbm(0, wx, wz, 1500) * g.amp * 0.4 + this.fbm(1, x, z, 110) * 1.5;
    // plateaux de quartz en gradins
    const pl = smooth(0.25, 0.3, this.fbm(2, wx, wz, 900, 2));
    if (pl > 0) h = mix(h, Math.floor((g.base + 12 + this.fbm(3, x, z, 600) * 10) / 4) * 4, pl);
    // canyons de verre : de longues entailles aux parois de quartz et de sel
    const [cx, cz] = this.warp(x, z, 600, 200), cv = Math.abs(this.n[4](cx / 2400, cz / 2400));
    let canyon = 0;
    if (cv < 0.03) { canyon = 1 - cv / 0.03; h -= Math.round(smooth(0, 0.7, canyon) * 30 / 5) * 5; }
    const c = this.base(h, { sd: 4 });
    if (canyon > 0.85) { c.top = this.pick(0.5, SALT, CSAND, q, r); c.keep = false; return c; }
    if (pl > 0.5) { c.top = this.pick(0.3, QUARTZ, SALT, q, r, 1); c.sub = QUARTZ; return c; }
    // dunes de cristal ; des cuvettes de sel entre elles ; des aiguilles de quartz
    const dn = this.dunes(x, z, 30, 7, 5);
    c.h = h + dn;
    if (dn < 0.4 && this.fbm(6, x, z, 400, 2) > 0.3) c.top = SALT;
    const [ph] = this.spot(x, z, 30, 0.12, 351, 0.5, 1.2, 4, 12);
    if (ph && dn < 1) { c.pil = ph; c.pid = QUARTZ; }
    return c;
  }

  // ---------- Ethan : Perse, le monde océanique glacé (la croûte d'Azura, plus épaisse) ----------
  perse(x, z, q, r) {
    const c = this.europa(x, z, q, r);
    // la glace bleue fracturée ; les fissures laissent passer la lumière de l'océan
    c.top = c.top === CRACKED_ICE ? GLOW_ICE : this.pick(smooth(0, 0.6, this.fbm(7, x, z, 300, 2)) * 0.5, BLUE_ICE, ICE, q, r, 5);
    c.sub = BLUE_ICE;
    c.sea2 = [-60 + Math.round(this.fbm(5, x, z, 600) * 10), Math.round(c.h) - 34];
    // cryovolcans : de grands cônes de glace, une colonne d'eau gelée au sommet
    const d = Math.hypot(x - this.big.x, z - this.big.z) / (this.big.r * 0.5);
    let cone = this.cone(d, 40, 1.4, 0.1, 10);
    this.near(x, z, 700, 0.35, 361, (vx, vz, i, j) => {
      const R = 40 + this.hash(i, j, 362) * 60;
      cone = Math.max(cone, this.cone(Math.hypot(x - vx, z - vz) / R, 14 + this.hash(i, j, 363) * 18, 1.5, 0.12, 6));
    });
    if (cone > 0) { c.h += cone; c.top = cone > 6 ? ICE : c.top; c.sea2[1] = Math.min(c.sea2[1], Math.round(c.h) - 34); }
    if (cone > 0 && d < 0.04) { c.pil = 6; c.pid = ICE; c.pcap = GLOW_ICE; }
    return c;
  }

  // ---------- Ethan : Lethe, la planète fantôme ----------
  lethe(x, z, q, r) {
    const g = this.g, [wx, wz] = this.warp(x, z, 700, 200);
    let h = g.base + this.fbm(0, wx, wz, 1000) * g.amp * 0.6 + this.fbm(1, x, z, 100) * 1.5;
    let ray = 0;
    for (const [cell, p, R, s, mn] of [[60, 0.45, 10, 371, 5], [260, 0.45, 40, 375, 5], [1000, 0.3, 140, 379, 5]]) {
      const [dh, rr] = this.craters(x, z, cell, p, R, s, mn);
      h += dh; ray = Math.max(ray, rr);
    }
    const c = this.base(h, { top: ray === 1 ? SLATE : BLACK_DUST, sub: BLACK_DUST, sd: 4 });
    // crevasses profondes : de longues fissures, en réseau
    const [rx, rz] = this.warp(x, z, 300, 120), cr = Math.abs(this.n[5](rx / 900, rz / 900));
    if (cr < 0.012) { c.h = h - 28 * (1 - cr / 0.012) - 4; c.top = BASALT; c.keep = true; c.caves = false; }
    else if (cr < 0.02) c.top = this.pick(0.5, BLACK_DUST, BASALT, q, r, 1);
    else {
      const [bh] = this.spot(x, z, 10, ray ? 0.4 : 0.05, 381, 0.7, 1.6, 1, 2);
      if (bh) { c.pil = bh; c.pid = BASALT; }
    }
    return c;
  }

  // ---------- Les planètes ajoutées (src/systemes) : le style « biomes », tout en paramètres ----------
  // (voir src/customsys.js pour le sens de chaque paramètre, et src/systemes/_modele.js)
  // land : le relief et le climat d'une colonne, avant ce qui pousse dessus
  //   { h, T (°C), H (humidité 0..1), A (altitude au-dessus de la mer), lat (0..1), b (n° du biome), lava }
  land(q, r) {
    const key = q * 73856093 ^ r * 19349663;
    let L = this.lands.get(key);
    if (L && L.q === q && L.r === r) return L;
    const g = this.g, { x, z } = hexToWorld(q, r), S = g.scale;
    const [wx, wz] = this.warp(x, z, S * 0.4, S * 0.12);
    const cont = this.fbm(0, wx, wz, S, 4);
    let h = g.base + cont * g.amp + this.fbm(1, x, z, 90, 2) * 3 * g.rough + this.fbm(2, x, z, 24, 2) * 1.2 * g.rough;
    const ref = g.sea > -999 ? g.sea : g.base;
    // montagnes : des chaînes (bruit en crêtes), seulement sur la terre ferme
    const M = g.mountains;
    if (M.force > 0) {
      const m = this.ridged(3, wx, wz, M.taille, 4);
      h += smooth(1 - M.force * 0.75, 1, m) * M.hauteur * smooth(ref - 4, ref + 8, h);
    }
    // plateaux en gradins
    const PL = g.plateaus;
    if (PL.densite > 0) {
      const thr = 0.45 - PL.densite * 0.6, pl = smooth(thr, thr + 0.05, this.fbm(4, wx, wz, 800, 2));
      if (pl > 0) h = mix(h, Math.floor((h + PL.hauteur) / Math.max(1, PL.marches)) * Math.max(1, PL.marches), pl);
    }
    // canyons : de longues entailles (là où un bruit passe par zéro)
    const C = g.canyons;
    if (C.densite > 0) {
      const sc = 3000 / (0.5 + 2 * C.densite), [cx, cz] = this.warp(x, z, 600, 200), cv = Math.abs(this.n[5](cx / sc, cz / sc)), w = 0.025 * C.largeur;
      if (cv < w) h -= Math.round(smooth(0, 0.7, 1 - cv / w) * C.profondeur);
    }
    // cratères (des grands et des petits)
    const K = g.craters;
    if (K.densite > 0) {
      h += this.craters(x, z, K.taille * 3, K.densite, K.taille, 401)[0];
      h += this.craters(x, z, K.taille, K.densite * 0.8, K.taille / 3, 405, 3)[0];
    }
    // volcans : des cônes, un lac de lave au sommet
    const V = g.volcanoes;
    let lava = false;
    if (V.densite > 0) {
      let best = 0;
      this.near(x, z, V.taille * 6, V.densite, 501, (vx, vz, i, j) => {
        const R = V.taille * (0.6 + this.hash(i, j, 502) * 0.8), d = Math.hypot(x - vx, z - vz) / R;
        const ch = this.cone(d, V.hauteur * (0.6 + this.hash(i, j, 503) * 0.7), 1.6, 0.12, 8);
        if (ch > best) { best = ch; lava = !!V.lava && d < 0.1; }
      });
      h += best;
    }
    // le climat : plus froid aux pôles et en altitude ; une planète synchrone : selon la hauteur de son astre
    const lat = Math.abs(this.lat(z));
    let T = this.body.locked ? g.temp + g.poles * (sunElev(this.body, x, z) * 0.8 - 0.3) : g.temp + g.poles * (0.35 - lat);
    T += this.fbm(5, x, z, 1500, 2) * 6 - g.lapse * Math.max(0, h - ref);
    const H = g.wet + this.fbm(6, wx, wz, S * 0.8, 3) * 0.6;
    const A = h - ref;
    // le biome : celui dont les conditions conviennent (le dernier de la liste, s'il y en a plusieurs) ;
    // aux frontières, un peu de hasard mélange les deux par petites touches
    const jT = T + (this.hash(q, r, 601) - 0.5) * 3 + this.fbm(7, x, z, 30, 1) * 2;
    const jH = H + (this.hash(q, r, 602) - 0.5) * 0.06 + this.fbm(7, x + 500, z, 30, 1) * 0.04;
    const jA = A + (this.hash(q, r, 603) - 0.5) * 3;
    const out = (v, [lo, hi], s) => (v < lo ? (lo - v) / s : v > hi ? (v - hi) / s : 0);
    let b = 0, bm = Infinity;
    g.biomes.forEach((B, i) => {
      const miss = out(jT, B.T, 10) + out(jH, B.H, 0.2) + out(jA, B.A, 8) + out(lat, B.L, 0.1);
      if (miss <= bm) { bm = miss; b = i; }
    });
    L = { q, r, h, T, H, A, lat, b, lava };
    if (this.lands.size > 80000) this.lands.clear();
    this.lands.set(key, L);
    return L;
  }
  biomes(x, z, q, r) {
    const g = this.g, L = this.land(q, r), B = g.biomes[L.b];
    let h = L.h;
    if (B.dunes) h += this.dunes(x, z, g.dunes.longueur, g.dunes.hauteur * (g.dunes.force || 1), 10);
    const c = this.base(h, { top: B.top, sub: B.sub, sd: B.sd, bc: B.color, bi: L.b, caves: g.caves });
    // sous la mer : le fond ; la mer gèle en surface s'il fait assez froid
    if (h < this.sea) {
      c.top = c.sub = g.floor;
      c.bc = null;
      if (g.freeze && L.T < g.freezeT) c.cap = g.freeze;
      return c;
    }
    if (g.beach && this.sea > -999 && h <= this.sea + g.beachW) { c.top = c.sub = g.beach; c.bc = null; return c; }
    if (L.lava) { c.top = g.volcanoes.lava; c.bc = null; return c; }
    // les formations (rochers, aiguilles...) ; puis les arbres ; puis les plantes
    for (let i = 0; i < B.rocks.length && !c.pil; i++) {
      const f = B.rocks[i], [ph] = this.spot(x, z, f.gap, f.p, 700 + i * 10, f.w * 0.5, f.w * 1.2, f.h[0], f.h[1]);
      if (ph) { c.pil = ph; c.pid = f.id; c.pcap = f.cap; }
    }
    if (!c.pil && this.treeGap < 99) this.biomeTrees(x, z, q, r, c);
    if (!c.pil && !c.can) {
      for (let j = 0; j < B.plants.length; j++) if (this.hash(q, r, 800 + j) < B.plants[j].p) { c.pil = 1; c.pid = B.plants[j].id; break; }
    }
    return c;
  }
  // Les arbres : un tronc au centre, une couronne de feuilles autour (celle des voisins déborde ici)
  biomeTrees(x, z, q, r, c) {
    const g = this.g, cell = this.treeGap;
    this.near(x, z, cell, 1, 711, (cx, cz, i, j) => {
      const rr = Math.round(cz / (Math.sqrt(3) / 2)), qq = Math.round(cx - rr / 2);
      const Lc = this.land(qq, rr), T = g.biomes[Lc.b].tree;
      if (!T || this.hash(i, j, 712) >= T.density * (cell / T.gap) ** 2) return;
      if (Lc.h <= this.sea + (g.beach ? g.beachW : 0) || Lc.lava) return;
      const dq = q - qq, dr = r - rr, d = (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2, R = Math.min(T.crown, cell - 1);
      if (d > R) return;
      const hc = Math.round(Lc.h), th = Math.round(T.h[0] + this.hash(i, j, 713) * (T.h[1] - T.h[0]));
      if (d === 0) { c.pil = Math.max(1, th - (Math.round(c.h) - hc)); c.pid = T.log; }
      let y0 = hc + th - R + d, y1 = hc + th + 1 - (d === R && R > 0 ? 1 : 0);
      y0 = Math.max(y0, Math.round(c.h) + 1);
      if (y1 < y0) return;
      c.can = c.can ? [Math.min(c.can[0], y0), Math.max(c.can[1], y1)] : [y0, y1];
      c.cid = T.leaves;
    });
  }
  // (l'atelier : le nom du biome d'une colonne)
  biomeName(q, r) {
    if (this.style !== 'biomes') return null;
    const L = this.land(q, r);
    return L.h < this.sea ? 'Mer' : this.g.biomes[L.b].name;
  }

  column(q, r, y, c) {
    const g = this.g, h = c.h;
    if (y <= -this.DEPTH) return BEDROCK;
    if (y > h) {
      if (y <= c.fl) return y === c.fl && c.cap ? c.cap : c.fid;
      if (c.pil && y <= h + c.pil) return y === h + c.pil && c.pcap ? c.pcap : c.pid;
      return c.can && y >= c.can[0] && y <= c.can[1] ? c.cid || LEAVES : AIR;
    }
    // l'océan sous la glace (Azura)
    if (c.sea2 && y > c.sea2[0] && y <= c.sea2[1]) return c.sfid || WATER;
    // tunnels de lave (Lune)
    if (c.tube && y >= c.tube[0] && y <= c.tube[1]) return AIR;
    if (y === h) return c.fl > h ? (c.fid === LAVA ? (g.hot ? MAGMA : BASALT) : c.sub) : c.exposed ? this.layerAt(c, y) : c.top;
    if (!c.exposed && y >= h - c.sd) return c.sub;
    // grottes : des tunnels sinueux (deux bruits qui s'annulent ensemble)
    if (c.caves && y < h - 6 && y > h - 70 && y > -this.DEPTH + 6) {
      const a = this.n[6](x2(q, r) / 48 + y * 0.031, z2(q, r) / 48 - y * 0.027), b = this.n[7](x2(q, r) / 48 - y * 0.029, z2(q, r) / 48 + y * 0.033);
      if (a * a + b * b < 0.011) return AIR;
    }
    for (const [id, chance, ymax] of g.ores || []) if (y <= ymax && this.hash(q, r, y * 7 + id) < chance) return id;
    // les strates : sous le sol, sur une quarantaine de blocs (les falaises les montrent)
    if (y > h - 40 && y >= 0) return this.layerAt(c, y);
    return y >= 0 ? c.rock : g.deep;
  }

  block(q, r, y) {
    if (y < -this.DEPTH) return BEDROCK;
    if (y >= this.H) return AIR;
    return this.column(q, r, y, this.col(q, r));
  }

  height(q, r) { return this.col(q, r).h; }

  surface(q, r) {
    const c = this.col(q, r);
    if (c.fl > c.h) { const id = c.cap || c.fid; return { h: c.fl, id, fh: c.h, fid: this.column(q, r, c.h, c) }; }
    if (c.can) { const id = c.cid || LEAVES; return { h: c.can[1], id, fh: c.can[1], fid: id }; } // (vu de loin : la cime)
    if (c.pil) { const id = c.pcap || c.pid; return { h: c.h + c.pil, id, fh: c.h + c.pil, fid: id }; }
    const top = this.topOf(c);
    return { h: c.h, id: top, fh: c.h, fid: top };
  }

  // Couleur de la colonne vue de l'espace (voir main.planetSample) : { color, h (0..1), sea }
  colorAt(q, r) {
    const c = this.col(q, r);
    const wet = c.fl > c.h;
    const id = wet ? (c.cap || c.fid) : c.pil && !(c.pid >= SNOW_LAYER && c.pid < SNOW_LAYER + 8) ? c.pcap || c.pid : this.topOf(c);
    const k = Math.max(0, Math.min(1, (c.h - this.g.base + this.g.amp) / (this.g.amp * 3)));
    return { id, color: (c.bc && id === c.top ? c.bc : COLORS[id]) || c.bc || '#888888', k, sea: wet && id === WATER || id === 200, glow: wet && id === LAVA };
  }

  fillChunk(data, q0, r0, CS, idx, noDeep = false) {
    const lo = noDeep ? 0 : -this.DEPTH;
    for (let lr = 0; lr < CS; lr++) {
      for (let lq = 0; lq < CS; lq++) {
        const q = q0 + lq, r = r0 + lr, c = this.col(q, r);
        const hi = Math.min(this.H - 1, Math.max(c.h + (c.pil || 0), c.fl, c.can ? c.can[1] : 0));
        for (let y = lo; y <= hi; y++) {
          const b = this.column(q, r, y, c);
          if (b !== AIR) data[idx(lq, lr, y)] = b;
        }
      }
    }
  }

  // (carte du monde : le bloc du dessus d'une colonne de hauteur h)
  terrain(y, h) { return y > h ? (y <= this.sea ? this.g.fluid : AIR) : y === h ? this.g.top : this.g.sub; }
  biomeAt() { return 3; }
  isCold() { return !!this.g.cold; }
  isMineChest() { return false; }
  hexCavesNear() { return []; }
  hexCaveBlock() { return -1; }

  // Point d'apparition : la terre ferme la plus proche de (x0, z0) (blocs)
  findSpawn(x0 = 0, z0 = 0) {
    for (let rad = 0; rad < 600; rad += 4) {
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2, x = x0 + Math.cos(a) * rad, z = z0 + Math.sin(a) * rad;
        const rr = Math.round(z / (Math.sqrt(3) / 2)), q = Math.round(x - rr / 2);
        const c = this.col(q, rr);
        if (c.fl <= c.h && (!c.pil || c.pid >= SNOW_LAYER && c.pid < SNOW_LAYER + 8)) return { q, r: rr, y: c.h + 1 + (c.pil ? 1 : 0) };
      }
    }
    return { q: 0, r: 0, y: this.col(0, 0).h + 1 };
  }
}

// (centre d'une case, sans objet : pour les grottes)
const x2 = (q, r) => q + r / 2;
const z2 = (q, r) => r * (Math.sqrt(3) / 2);
