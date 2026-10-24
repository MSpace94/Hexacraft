// La station Hexa-Zéro : le monde du tutoriel (type de monde 'tutorial', voir gen.js).
// Une station de formation qui dérive dans l'espace lointain, loin de toute étoile : rien
// d'autre que du vide autour. Les salles se suivent d'ouest en est (vers +x), dans l'ordre
// des leçons (voir tutorial.js) :
//   cabine -> couloir (une caisse à sauter) -> serre (arbres) -> soute à échantillons
//   (un morceau d'astéroïde : pierre et charbon) -> couloir sombre (lampes grillées)
//   -> forge (coffre de secours) -> hangar (la navette)
// Des portes vitrées (GATES) ferment la suite tant que la leçon d'avant n'est pas faite.
// Module sans DOM ni three.js : il sert aussi dans les threads de génération.
import { hexToWorld, worldToHex, NEIGHBORS } from './hex.js?v=1.1.5-alpha-mvm2b95g';

export const Y0 = 64; // plancher de la station
const STEEL = 245, DARK = 246, OLD = 247, GLASS = 40, LAMP = 95, LAMP_DEAD = 94;
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
};
// Portes vitrées (x de la porte) : ouvertes par le tutoriel (voir tutorial.js)
const GATE_X = { mine: 38, dark: 62, hangar: 91 };
// Points utiles au tutoriel (unités du monde)
export const SPOTS = {
  spawn: { x: -6.5, z: 0 },
  shuttle: { x: 106, z: 0 },
  chest: { x: 80, z: -4.3 },
  hangarEnd: 114, // (la grande baie vitrée du hangar, à l'est : elle s'ouvre pour la navette)
};

const key = (q, r, y) => q + ',' + r + ',' + y;
const inBox = (b, x, z) => x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1;
const rand = (a, b, c) => { const s = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453; return s - Math.floor(s); };

function build() {
  const blocks = new Map();
  const set = (q, r, y, id) => { if (id) blocks.set(key(q, r, y), id); else blocks.delete(key(q, r, y)); };
  const gates = { mine: [], dark: [], hangar: [] };
  const roomAt = (x, z) => { for (const [n, b] of Object.entries(ROOMS)) if (inBox(b, x, z)) return n; return null; };
  // toutes les cases de la zone
  const lo = worldToHex(-12, -11), hi = worldToHex(117, 11);
  const cells = [];
  for (let r = lo.r - 2; r <= hi.r + 2; r++) {
    for (let q = lo.q - 14; q <= hi.q + 14; q++) {
      const { x, z } = hexToWorld(q, r);
      if (x < -12 || x > 117 || Math.abs(z) > 11) continue;
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
      set(q, r, Y0, garden ? GRASS : (Math.abs(z) < 1 && c.room.startsWith('hall') ? DARK : STEEL));
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
    for (const [g, gx] of Object.entries(GATE_X)) {
      if (!c.room?.startsWith('hall') || Math.abs(c.x - gx) > 0.6) continue;
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
