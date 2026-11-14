// La station Hexa-Zéro : le monde du tutoriel (type de monde 'tutorial', voir gen.js).
// Une station de formation en orbite autour de PXT-1, dans le système PXT : par les hublots, la
// planète et l'étoile PXT-A (voir tutoSky dans main.js). Dans le vrai jeu, la même station est
// là, en ruine (voir ruinBlock plus bas). Les salles se suivent d'ouest en est (vers +x), dans l'ordre
// des leçons (voir tutorial.js) :
//   cabine -> couloir (une caisse à sauter) -> serre (arbres) -> soute à échantillons
//   (un morceau d'astéroïde : pierre et charbon) -> couloir sombre (lampes grillées)
//   -> forge (coffre de secours) -> hangar (la navette)
// Avant le hangar, un couloir part vers le nord jusqu'à l'atelier : la deuxième partie de la
// formation (l'usine : courant, machines, tapis, une chaîne de production). En face, un couloir part
// vers le sud jusqu'au garage et sa piste d'essai : la voiture (chapitre 2, avec l'atelier)
// À l'est de l'atelier, la salle des énergies : un bassin d'eau, l'énergie verte (roue à aubes,
// éoliennes, câbles) et le carburant (pompe, tuyaux, réservoirs, raffinerie, bidon)
// Des portes vitrées (GATES) ferment la suite tant que la leçon d'avant n'est pas faite.
// Module sans DOM ni three.js : il sert aussi dans les threads de génération.
import { hexToWorld, worldToHex, NEIGHBORS } from './hex.js?v=1.1.5-alpha-mwgq2wrb';

export const Y0 = 64; // plancher de la station
const STEEL = 245, DARK = 246, OLD = 247, GLASS = 40, LAMP = 95, LAMP_DEAD = 94, WATER = 7;
// Le bassin de la salle des énergies : [dq, dr] par rapport à SPOTS.energy (de l'eau au niveau du
// plancher : la roue à aubes et la pompe s'y posent, au bord, voir tutorial.js)
export const POOL = [
  ...[-5, -4, -3, -2, -1].map((dq) => [dq, 1]),
  ...[-6, -5, -4, -3, -2, -1].map((dq) => [dq, 2]),
  ...[-6, -5, -4, -3, -2].map((dq) => [dq, 3]),
];
const GRASS = 1, DIRT = 2, STONE = 3, LOG = 5, LEAVES = 6, COAL_ORE = 30;
const TABLE = 31, CHEST = 54, WOOL = 194, WOOL_GREY = 195, SLAB = 33, GRAVITRON = 81, ENGINE = 67;

// Salles : boîtes en x / z (unités du monde), hauteur intérieure h
export const ROOMS = {
  cabin: { x0: -9, x1: -1, z0: -3.5, z1: 3.5, h: 4 },
  hall1: { x0: -1.5, x1: 16.5, z0: -1.8, z1: 1.8, h: 4 },
  serre: { x0: 16, x1: 34, z0: -9, z1: 9, h: 7, glassRoof: true },
  hall2: { x0: 33.5, x1: 42.5, z0: -1.8, z1: 1.8, h: 4 },
  mine: { x0: 42, x1: 60, z0: -8, z1: 8, h: 8 },
  hall3: { x0: 59.5, x1: 74.5, z0: -1.8, z1: 1.8, h: 4, dark: true },
  forge: { x0: 74, x1: 88, z0: -6, z1: 6, h: 5 },
  hall4: { x0: 87.5, x1: 94.5, z0: -1.8, z1: 1.8, h: 4 },
  hangar: { x0: 94, x1: 114, z0: -9, z1: 9, h: 9, glassRoof: true, glassEnd: true },
  hall5: { x0: 88.1, x1: 90.2, z0: 1.5, z1: 11.5, h: 4 },
  atelier: { x0: 76, x1: 98, z0: 11, z1: 25, h: 6, glassRoof: true },
  hall6: { x0: 88.1, x1: 90.2, z0: -11.5, z1: -1.5, h: 4 },
  garage: { x0: 72, x1: 112, z0: -33, z1: -11, h: 6, glassRoof: true },
  energie: { x0: 100, x1: 124, z0: 12, z1: 26, h: 7, glassRoof: true },
  hall7: { x0: 97.5, x1: 100.5, z0: 19.6, z1: 21.6, h: 4 },
};
// Portes vitrées : ouvertes par le tutoriel (voir tutorial.js). [couloir, axe, position]
const GATES = { mine: ['hall2', 'x', 38], dark: ['hall3', 'x', 62], hangar: ['hall4', 'x', 91], atelier: ['hall5', 'z', 6.06], garage: ['hall6', 'z', -6.06], energie: ['hall7', 'x', 99] };
// La ligne de production de l'atelier : une rangée de cases (z = LINE_Z) entre le coffre de
// minerai (x = LINE_X0) et le coffre de réception (x = LINE_X1), le sol marqué entre les deux
const LINE_Z = 17.32, LINE_X0 = 80, LINE_X1 = 91;
// La piste d'essai du garage : du cercle du départ (CAR_X0) au drapeau (CAR_X0 + 26), le long de z = CAR_Z
const CAR_X0 = 80, CAR_Z = -22.5;
// Points utiles au tutoriel (unités du monde)
export const SPOTS = {
  spawn: { x: -6.5, z: 0 },
  shuttle: { x: 106, z: 0 },
  chest: { x: 80, z: -4.3 },
  kit: { x: 86, z: 12.12 },             // (le coffre de matériel de l'atelier)
  ore: { x: LINE_X0, z: LINE_Z },       // (le coffre de minerai, au début de la ligne)
  reception: { x: LINE_X1, z: LINE_Z }, // (le coffre de réception, au bout)
  garageKit: { x: 86, z: -12.12 },      // (le coffre de matériel du garage)
  car: { x: CAR_X0, z: CAR_Z },         // (le cercle du départ de la piste : la voiture s'y construit)
  start2: { x: 87, z: 15 },             // (chapitre 2 : on commence dans l'atelier)
  energy: { x: 107.5, z: 18.19 },       // (salle des énergies : le départ des fantômes, au bord du bassin)
  energyKit: { x: 102, z: 24.25 },      // (le coffre de matériel de la salle des énergies)
  hangarEnd: 114, // (la grande baie vitrée du hangar, à l'est : elle s'ouvre pour la navette)
};

const key = (q, r, y) => q + ',' + r + ',' + y;
const inBox = (b, x, z) => x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1;
const rand = (a, b, c) => { const s = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453; return s - Math.floor(s); };

function build() {
  const blocks = new Map();
  const set = (q, r, y, id) => { if (id) blocks.set(key(q, r, y), id); else blocks.delete(key(q, r, y)); };
  const gates = { mine: [], dark: [], hangar: [], atelier: [], garage: [], energie: [] };
  const roomAt = (x, z) => { for (const [n, b] of Object.entries(ROOMS)) if (inBox(b, x, z)) return n; return null; };
  // toutes les cases de la zone
  const Z0 = -35, Z1 = 28, X1 = 127, lo = worldToHex(-12, Z0), hi = worldToHex(X1, Z1);
  const cells = [];
  for (let r = lo.r - 2; r <= hi.r + 2; r++) {
    for (let q = Math.floor(-12 - r / 2) - 2; q <= Math.ceil(X1 - r / 2) + 2; q++) {
      const { x, z } = hexToWorld(q, r);
      if (x < -12 || x > X1 || z < Z0 || z > Z1) continue;
      cells.push({ q, r, x, z, room: roomAt(x, z) });
    }
  }
  const byKey = new Map(cells.map((c) => [c.q + ',' + c.r, c]));
  for (const c of cells) {
    const { q, r, x, z } = c;
    if (c.room) {
      const b = ROOMS[c.room];
      // plancher (la serre : de la terre et de l'herbe au milieu), plafond
      const garden = c.room === 'serre' && Math.abs(x - 25) < 7.5 && Math.abs(z) < 6.5;
      set(q, r, Y0 - 1, DARK);
      const line = c.room === 'atelier' && Math.abs(z - LINE_Z) < 0.45 && x > LINE_X0 - 0.5 && x < LINE_X1 + 0.5;
      // (la piste du garage : ses bords, le cercle du départ, la ligne du drapeau)
      const track = c.room === 'garage' && (Math.abs(Math.abs(z - CAR_Z) - 5.5) < 0.45 && x > CAR_X0 - 4 && x < CAR_X0 + 30
        || Math.abs(Math.hypot(x - CAR_X0, z - CAR_Z) - 2.6) < 0.5 || Math.abs(x - CAR_X0 - 26) < 0.5 && Math.abs(z - CAR_Z) < 5);
      set(q, r, Y0, garden || line || track ? (garden ? GRASS : OLD) : (c.room.startsWith('hall') && Math.abs(c.room === 'hall5' || c.room === 'hall6' ? x - 89.2 : z) < 1 ? DARK : STEEL));
      // (la terre de la serre repose sur un fond en acier assombri, incassable comme la coque :
      // en creusant, on ne tombe pas dans le vide)
      if (garden) { set(q, r, Y0 - 1, DIRT); set(q, r, Y0 - 2, DARK); }
      const top = Y0 + b.h + 1;
      let roof = b.glassRoof && Math.abs(z) < Math.abs(b.z0) - 1.5 && x > b.x0 + 1.5 && x < b.x1 - 1.5 ? GLASS : DARK;
      // lampes du plafond (grillées dans le couloir sombre)
      const lampHere = c.room.startsWith('hall') ? Math.abs(z) < 0.5 && Math.round(x) % 5 === 0
        : (Math.round(x) % 5 === 0 && Math.round(z / 0.866) % 5 === 0);
      if (lampHere && roof !== GLASS) roof = b.dark ? LAMP_DEAD : LAMP;
      if (lampHere && b.glassRoof && roof === GLASS && Math.round(x) % 10 === 0) roof = LAMP;
      set(q, r, top, roof);
      // au-dessus du plafond, jusqu'à celui de la salle voisine la plus haute (sinon un trou
      // dans la marche entre un couloir bas et une grande salle)
      let maxH = b.h;
      for (const [dq, dr] of NEIGHBORS) { const n = byKey.get((q + dq) + ',' + (r + dr)); if (n?.room) maxH = Math.max(maxH, ROOMS[n.room].h); }
      for (let y = top + 1; y <= Y0 + maxH + 1; y++) set(q, r, y, y === Y0 + maxH + 1 ? OLD : STEEL);
      continue;
    }
    // mur : une case hors des salles qui touche une salle
    let h = 0, near = null;
    for (const [dq, dr] of NEIGHBORS) {
      const n = byKey.get((q + dq) + ',' + (r + dr));
      if (n?.room && ROOMS[n.room].h + 1 > h) { h = ROOMS[n.room].h + 1; near = n.room; }
    }
    if (!near) continue;
    const b = ROOMS[near];
    set(q, r, Y0 - 1, DARK);
    for (let y = Y0; y <= Y0 + h; y++) {
      let id = y === Y0 || y === Y0 + h ? DARK : STEEL;
      // hublots : bandes de verre dans les murs (vue sur l'espace)
      const mid = y >= Y0 + 2 && y <= Y0 + Math.min(3, h - 1);
      if (mid && near === 'cabin' && x < b.x0 && Math.abs(z) < 1.5) id = GLASS;
      if (mid && (near === 'hall1' && x > 9 && x < 15)) id = GLASS;
      if (mid && near === 'serre' && Math.abs(z) > 8 && Math.abs(x - 25) < 6) id = GLASS;
      if (near === 'hangar' && b.glassEnd && x > b.x1 && y > Y0 && y < Y0 + h) id = GLASS;
      if (near === 'hangar' && Math.abs(z) > 8.5 && y >= Y0 + 2 && y <= Y0 + 6 && Math.abs(x - 104) < 8) id = GLASS;
      if (y === Y0 + 1 && Math.round(x) % 4 === 0 && id === STEEL) id = OLD; // (plinthes)
      set(q, r, y, id);
    }
    set(q, r, Y0 + h + 1, OLD);
  }

  // ---- cabine : lit, bureau, lampe ----
  const at = (x, z) => worldToHex(x, z);
  const put = (x, z, y, id) => { const { q, r } = at(x, z); set(q, r, Y0 + y, id); };
  put(-8, -2.6, 1, WOOL); put(-7, -2.6, 1, WOOL); put(-8.5, -1.7, 1, WOOL_GREY); // lit
  put(-2.5, -2.6, 1, SLAB); put(-3.5, -2.6, 1, SLAB); // bureau
  // ---- couloir 1 : la caisse à sauter ----
  for (const c of cells) if (c.room === 'hall1' && Math.abs(c.x - 6.5) < 0.6) set(c.q, c.r, Y0 + 1, OLD);
  // ---- serre : arbres ----
  const trees = [[20.5, -3.5], [23.5, 3.5], [27.5, -3.5], [30, 3]];
  for (const [tx, tz] of trees) {
    const t = at(tx, tz), tw = hexToWorld(t.q, t.r);
    for (let y = 1; y <= 5; y++) set(t.q, t.r, Y0 + y, LOG);
    for (const c of cells) {
      const d = Math.hypot(c.x - tw.x, c.z - tw.z);
      for (let y = 4; y <= 7; y++) {
        const rad = y === 7 ? 1.1 : y === 4 ? 2.1 : 2.6;
        if (d < rad && !(d < 0.4 && y <= 5) && rand(c.q, c.r, y) > 0.12) set(c.q, c.r, Y0 + y, LEAVES);
      }
    }
  }
  // ---- soute : le morceau d'astéroïde (pierre, charbon), une table de craft ----
  for (const c of cells) {
    if (c.room !== 'mine') continue;
    for (let y = 1; y <= 7; y++) {
      const dx = (c.x - 51) / 5.5, dz = c.z / 4.6, dy = (y - 3.2) / 3.2;
      const bump = 0.18 * Math.sin(c.x * 1.7 + y) * Math.cos(c.z * 2.1);
      if (dx * dx + dz * dz + dy * dy < 1 + bump) set(c.q, c.r, Y0 + y, rand(c.q, c.r, y + 50) < 0.13 ? COAL_ORE : STONE);
    }
  }
  put(44.5, 6, 1, TABLE);
  // ---- forge : coffre de secours, établi, tables ----
  put(SPOTS.chest.x, SPOTS.chest.z, 1, CHEST);
  put(78, -4.3, 1, TABLE);
  put(84, -4.3, 1, SLAB); put(85, -4.3, 1, SLAB);
  // ---- atelier : le coffre de matériel, les deux coffres de la ligne de production ----
  put(SPOTS.kit.x, SPOTS.kit.z, 1, CHEST);
  put(SPOTS.ore.x, SPOTS.ore.z, 1, CHEST);
  put(SPOTS.reception.x, SPOTS.reception.z, 1, CHEST);
  // ---- garage : le coffre de matériel ----
  put(SPOTS.garageKit.x, SPOTS.garageKit.z, 1, CHEST);
  // ---- salle des énergies : le bassin (au niveau du plancher), le coffre de matériel ----
  const eo = at(SPOTS.energy.x, SPOTS.energy.z);
  for (const [dq, dr] of POOL) set(eo.q + dq, eo.r + dr, Y0, WATER);
  put(SPOTS.energyKit.x, SPOTS.energyKit.z, 1, CHEST);
  // ---- hangar : la navette (une capsule hexagonale, comme celles du HEXA-9) ----
  const s = at(SPOTS.shuttle.x, SPOTS.shuttle.z);
  const ring = [[0, 0], ...NEIGHBORS];
  for (const [dq, dr] of ring) set(s.q + dq, s.r + dr, Y0 + 1, DARK);
  // (porte ouverte vers l'ouest, deux blocs de haut : on monte dedans)
  for (const [dq, dr] of NEIGHBORS) {
    const w = hexToWorld(dq, dr);
    // (à l'arrière, de part et d'autre de la porte : les moteurs ; à l'avant, vers l'est et la
    // grande baie du hangar : le hublot du poste de pilotage)
    for (const y of [2, 3]) set(s.q + dq, s.r + dr, Y0 + y, w.x < -0.6 ? 0 : w.x < 0 ? (y === 2 ? ENGINE : STEEL) : y === 3 ? GLASS : STEEL);
  }
  set(s.q, s.r, Y0 + 5, GRAVITRON);
  for (const [dq, dr] of ring) set(s.q + dq, s.r + dr, Y0 + 4, dq === 0 && dr === 0 ? GLASS : STEEL);
  // ---- portes vitrées ----
  for (const c of cells) {
    for (const [g, [room, axis, at]] of Object.entries(GATES)) {
      if (c.room !== room || Math.abs(c[axis] - at) > (axis === 'x' ? 0.6 : 0.45)) continue;
      for (let y = 1; y <= ROOMS[c.room].h; y++) { set(c.q, c.r, Y0 + y, GLASS); gates[g].push([c.q, c.r, Y0 + y]); }
    }
  }
  // colonnes : les blocs de chaque colonne, du haut vers le bas
  const cols = new Map();
  for (const [k, id] of blocks) {
    const [q, r, y] = k.split(',').map(Number);
    const ck = q + ',' + r;
    if (!cols.has(ck)) cols.set(ck, []);
    cols.get(ck).push([y, id]);
  }
  for (const l of cols.values()) l.sort((a, b) => b[0] - a[0]);
  return { blocks, cols, gates };
}

let built = null;
const station = () => (built ||= build());

export const stationBlock = (q, r, y) => station().blocks.get(key(q, r, y)) || 0;
// blocs de la colonne (q, r) : [[y, id], ...] du haut vers le bas (ou undefined)
export const stationColumn = (q, r) => station().cols.get(q + ',' + r);
export const stationGates = () => station().gates;
// salle du point (x, z), ou null
export function roomAt(x, z) {
  for (const [n, b] of Object.entries(ROOMS)) if (inBox(b, x, z)) return n;
  return null;
}

// ---------- La station en ruine (le vrai jeu) ----------
// Dans le monde du joueur, Hexa-Zéro tourne toujours autour de PXT-1 (voir RUIN dans spacegen.js
// et spaceflight.js), mais elle est morte : de gros astéroïdes l'ont percée, et personne n'est venu
// la réparer. Les mêmes salles que le tutoriel, éventrées : coque trouée et calcinée autour des
// impacts (des morceaux d'astéroïde encore plantés dedans), hublots brisés, portes vitrées en
// miettes, lampes arrachées, serre morte. Rien de valeur : ni coffre, ni établi, ni charbon, ni
// navette. La coque (RUIN_HULL, RUIN_DARK) ne se casse pas : la ruine reste telle quelle.
const RUIN_HULL = 4096, RUIN_DARK = 4097, REGOLITH = 3969, MOON_ROCK = 3970, GRAVEL = 244;
// impacts : [x, y, z, rayon, rayon du morceau d'astéroïde resté planté (0 : il est reparti)]
const IMPACTS = [
  [25, Y0 + 8, -6, 4.6, 0],        // la serre, par le toit vitré
  [55, Y0 + 5, 8.5, 4.2, 1.8],     // la soute, mur nord
  [66, Y0 + 3, -2.5, 3.2, 0],      // le couloir sombre
  [103, Y0 + 8, 7, 6.2, 2.6],      // le hangar : un gros bloc encore planté
  [92, Y0 + 7, 24, 4.4, 0],        // l'atelier, par le toit
  [-8.5, Y0 + 3, -4, 2.6, 1.2],    // la cabine, coin sud-ouest
  [98, Y0 + 6, -26, 5.2, 2.2],     // le garage, par le toit
  [116, Y0 + 7, 22, 4.8, 1.6],     // la salle des énergies, par le toit
];
const SHUTTLE_R = 2.3; // (la navette est partie : plus rien autour de sa place)
let gateSet = null;
export function ruinBlock(q, r, y) {
  const { x, z } = hexToWorld(q, r);
  if (x < -14 || x > 130 || z < -37 || z > 30 || y < Y0 - 3 || y > Y0 + 14) return 0;
  const h = rand(q, r, y + 900);
  for (const [ix, iy, iz, rad, rock] of IMPACTS) {
    const d = Math.hypot(x - ix, (y + 0.5 - iy) * 1.1, z - iz);
    if (rock && d < rock + 0.35 * Math.sin(x * 2.1 + y * 1.3 + z * 1.7)) return h < 0.5 ? REGOLITH : h < 0.85 ? MOON_ROCK : GRAVEL;
    if (d < rad) return 0;
    if (d < rad + 1.6) {
      const id = stationBlock(q, r, y);
      if (!id || h < 0.4) return 0;
      if (id === STEEL || id === DARK || id === OLD) return RUIN_DARK; // (le bord du trou : calciné)
    }
  }
  const id = stationBlock(q, r, y);
  if (!id) return 0;
  if (y > Y0 && Math.hypot(x - SPOTS.shuttle.x, z - SPOTS.shuttle.z) < SHUTTLE_R) return 0;
  switch (id) {
    case STEEL: case OLD: return y > Y0 && y < Y0 + 9 && h < 0.025 ? 0 : RUIN_HULL; // (quelques trous d'éclats)
    case DARK: return RUIN_DARK;
    case LAMP: case LAMP_DEAD: return RUIN_DARK;
    case GLASS: {
      gateSet ||= new Set(Object.values(stationGates()).flat().map(([a, b, c]) => key(a, b, c)));
      if (gateSet.has(key(q, r, y))) return 0;
      return h < 0.55 ? 0 : GLASS;
    }
    case GRASS: return DIRT;                 // (la serre est morte)
    case LOG: case LEAVES: case TABLE: case CHEST: case WOOL: case WOOL_GREY: case GRAVITRON: case ENGINE: return 0;
    case COAL_ORE: return STONE;             // (le charbon a été pris)
    case WATER: return 0;                    // (le bassin est à sec)
    case SLAB: return h < 0.5 ? 0 : SLAB;
    default: return id;
  }
}
// Les limites de la ruine (unités du monde) : pour ne rien calculer ailleurs
export const RUIN_BOX = { x0: -14, x1: 130, z0: -37, z1: 30, y0: Y0 - 3, y1: Y0 + 14 };
