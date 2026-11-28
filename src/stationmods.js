// Modules de station : des pièces toutes faites qu'on pose d'un coup dans l'espace (objets « Module
// habitat », « Module serre »...). Pose libre : en main, un fantôme montre le module devant soi (bleu :
// la place est libre ; rouge : quelque chose gêne) ; R le tourne de 60° ; clic droit : il est construit.
// On relie ensuite ses modules par des couloirs (le module « Couloir » : un tube ouvert aux deux bouts,
// à mettre contre la porte d'un module).
//
// Chaque pièce est un prisme hexagonal fermé (étanche : une coque d'acier, ses hublots de verre, deux
// portes étanches). Son équipement est déjà branché : un bloc de batterie dans le mur, des panneaux
// solaires dehors contre lui, et dedans, contre lui aussi, le générateur d'oxygène et celui de gravité
// (le réseau électrique : des blocs qui se touchent, voir industry.js). Le premier module posé dans une
// bulle où il n'y a pas encore de station apporte son noyau de station (au milieu du plancher).
//
// Les blocs se posent par world.setBlock : le multijoueur, la station (orbital.js) et le réseau
// électrique les voient comme des blocs posés à la main.
import * as THREE from 'three';
import { NEIGHBORS, SIZE, hexToWorld } from './hex.js?v=1.1.0-mx09tneh';

export const MOD_HABITAT = 4600, MOD_SERRE = 4601, MOD_QUAI = 4602, MOD_OBSERVATOIRE = 4603, MOD_COULOIR = 4604;
export const SAT_CONSOLE = 4605;
const STEEL = 245, DARK = 246, GLASS = 40, LANTERN = 4596, CHEST = 54, TABLE = 31, FURNACE = 42;
const WATER = 7, FARMLAND = 455, WHEAT_CROP = 286;
const SEAL_DOOR = 4246, SEAL_DOOR_TOP = 4248;
const STATION_CORE = 3986, OXYGEN_GEN = 3987, GRAVITY_GEN = 3988, SOLAR_PANEL = 3989, DOCK_PORT = 3990, ORBITAL_STORE = 3991, BATTERY = 3807, TANK = 3955;

const dist = (q, r) => (Math.abs(q) + Math.abs(r) + Math.abs(q + r)) / 2;
const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k];
// (un sixième de tour : la direction k devient la direction k + 1)
const rot60 = ([q, r]) => [-r, q + r];
export function rotate(qr, n) { let p = qr; for (let i = 0; i < ((n % 6) + 6) % 6; i++) p = rot60(p); return p; }

// Un plan : Map 'q,r,y' -> id (0 : de l'air, la place doit être libre mais rien n'y est posé)
class Plan {
  constructor() { this.m = new Map(); }
  set(q, r, y, id) { this.m.set(q + ',' + r + ',' + y, [q, r, y, id]); }
  get(q, r, y) { return this.m.get(q + ',' + r + ',' + y)?.[3]; }
  list() { return [...this.m.values()]; }
}

// Une pièce : un prisme hexagonal de rayon R (la coque est à la distance R du centre), haut de h
// cases (de y = 1 à h ; plancher en 0, plafond en h + 1). o : { doors (côtés des portes), glass (murs
// vitrés), roof (bloc du plafond), power (côté du bloc d'énergie) }
function room(R, h, o = {}) {
  const P = new Plan();
  for (let q = -R; q <= R; q++) {
    for (let r = -R; r <= R; r++) {
      const d = dist(q, r);
      if (d > R) continue;
      P.set(q, r, 0, d === R ? STEEL : DARK);
      P.set(q, r, h + 1, o.roof ?? STEEL);
      for (let y = 1; y <= h; y++) {
        if (d < R) { P.set(q, r, y, 0); continue; }
        // (hublots : un mur sur deux, au milieu de la hauteur ; une serre : tout en verre au-dessus du bas)
        const win = o.glass ? y >= 2 : y >= 2 && y <= h - 1 && (((q * 7 + r * 3) % 2) + 2) % 2 === 0;
        P.set(q, r, y, win ? GLASS : STEEL);
      }
    }
  }
  for (const k of o.doors || []) {
    const [q, r] = add([0, 0], NEIGHBORS[k], R);
    P.set(q, r, 1, SEAL_DOOR);
    P.set(q, r, 2, SEAL_DOOR_TOP);
  }
  if (o.power !== undefined) power(P, R, o.power, o.grav !== false);
  // (de la lumière : sous le plafond, au centre et sur l'anneau 2)
  for (const [q, r] of [[0, 0], ...NEIGHBORS.filter((_, i) => i % 2 === 0).map((n) => add([0, 0], n, Math.min(2, R - 1)))]) if (!P.get(q, r, h)) P.set(q, r, h, LANTERN);
  return P;
}
// Le bloc d'énergie sur le côté k d'une pièce de rayon R : la batterie dans le mur (en bas), des
// panneaux solaires dehors contre elle (deux étages), et dedans le générateur d'oxygène (contre la
// batterie) et celui de gravité (dessus)
function power(P, R, k, grav = true) {
  const wall = add([0, 0], NEIGHBORS[k], R);
  P.set(wall[0], wall[1], 1, BATTERY);
  for (const n of NEIGHBORS) {
    const c = add(wall, n);
    if (dist(c[0], c[1]) !== R + 1) continue;
    P.set(c[0], c[1], 1, SOLAR_PANEL);
    P.set(c[0], c[1], 2, SOLAR_PANEL);
  }
  const inside = add([0, 0], NEIGHBORS[k], R - 1);
  P.set(inside[0], inside[1], 1, OXYGEN_GEN);
  if (grav) P.set(inside[0], inside[1], 2, GRAVITY_GEN);
}

// ---------- Les modules ----------
// build() : le plan (centre en 0, 0, plancher en y = 0) ; R : son rayon (le fantôme est posé à R + 3
// devant soi) ; core : où mettre le noyau de station s'il en faut un
export const MODULES = {
  [MOD_HABITAT]: {
    name: 'Module habitat', R: 5, core: [0, 0, 0],
    desc: 'Une pièce étanche de 9 cases de large : oxygène, gravité, panneaux solaires, deux coffres, un établi, un four. Deux portes étanches.',
    build() {
      const P = room(5, 4, { doors: [0, 3], power: 1 });
      const at = (k, d) => add([0, 0], NEIGHBORS[k], d);
      const [a, b, c, e] = [at(4, 4), at(5, 4), at(2, 4), at(4, 3)];
      P.set(a[0], a[1], 1, CHEST); P.set(b[0], b[1], 1, CHEST);
      P.set(c[0], c[1], 1, TABLE); P.set(e[0], e[1], 1, FURNACE);
      return P;
    },
  },
  [MOD_SERRE]: {
    name: 'Module serre', R: 5, core: [0, 0, 0],
    desc: 'Une serre sous verre : un bassin, des terres labourées et du blé déjà semé, de l\'oxygène et de la gravité. Deux portes étanches.',
    build() {
      const P = room(5, 5, { doors: [0, 3], power: 1, glass: true, roof: GLASS });
      // (le bassin au centre, les cultures autour ; l'anneau 3-4 reste libre pour circuler)
      P.set(0, 0, 1, WATER);
      for (let q = -2; q <= 2; q++) for (let r = -2; r <= 2; r++) {
        const d = dist(q, r);
        if (d < 1 || d > 2) continue;
        P.set(q, r, 1, FARMLAND);
        P.set(q, r, 2, WHEAT_CROP);
      }
      return P;
    },
  },
  [MOD_QUAI]: {
    name: 'Module quai', R: 4, core: [0, 0, 0],
    desc: "Une plateforme d'amarrage ouverte : un port d'amarrage au bord, un réservoir de carburant contre lui, deux entrepôts orbitaux, un mât solaire.",
    build() {
      const P = new Plan(), R = 4;
      for (let q = -R; q <= R; q++) for (let r = -R; r <= R; r++) if (dist(q, r) <= R) P.set(q, r, 0, dist(q, r) === R ? STEEL : DARK);
      // (au-dessus du plateau : la place doit être libre, sur 3 cases)
      for (let q = -R; q <= R; q++) for (let r = -R; r <= R; r++) if (dist(q, r) <= R) for (let y = 1; y <= 3; y++) P.set(q, r, y, 0);
      // le port au bord (côté 0), le réservoir et la batterie contre lui, le mât solaire sur la batterie
      const port = add([0, 0], NEIGHBORS[0], R);
      P.set(port[0], port[1], 0, DOCK_PORT);
      // (le port est à un coin : ses deux voisins sur le bord du plateau, de part et d'autre)
      const side = NEIGHBORS.map((n) => add(port, n)).filter(([q, r]) => dist(q, r) === R);
      P.set(side[0][0], side[0][1], 0, TANK);
      P.set(side[1][0], side[1][1], 0, BATTERY);
      for (let y = 1; y <= 3; y++) P.set(side[1][0], side[1][1], y, SOLAR_PANEL);
      // les entrepôts, de l'autre côté du plateau ; des lanternes au bord
      const s1 = add([0, 0], NEIGHBORS[3], 2), s2 = add(s1, NEIGHBORS[2]);
      P.set(s1[0], s1[1], 1, ORBITAL_STORE); P.set(s2[0], s2[1], 1, ORBITAL_STORE);
      for (const k of [1, 2, 4, 5]) { const c = add([0, 0], NEIGHBORS[k], R); P.set(c[0], c[1], 1, LANTERN); }
      return P;
    },
  },
  [MOD_OBSERVATOIRE]: {
    name: 'Module observatoire', R: 3, core: [0, 0, 0],
    desc: 'Une petite pièce au toit et aux murs de verre pour regarder le ciel. La console de satellites, au milieu, suit tes satellites. Une porte étanche.',
    build() {
      const P = room(3, 4, { doors: [3], power: 1, glass: true, roof: GLASS });
      P.set(0, 0, 1, SAT_CONSOLE);
      P.set(0, 0, 4, 0); // (pas de lanterne au milieu : le ciel)
      return P;
    },
  },
  [MOD_COULOIR]: {
    name: 'Module couloir', R: 0, core: [3, 0, 0], corridor: true,
    desc: 'Un tube étanche de 7 cases, ouvert aux deux bouts : à poser contre la porte d\'un module pour en rejoindre un autre.',
    build() {
      const P = new Plan(), L = 7, axis = new Set();
      for (let i = 0; i < L; i++) axis.add(i + ',0');
      for (let i = 0; i < L; i++) {
        P.set(i, 0, 0, DARK);
        P.set(i, 0, 4, STEEL);
        for (let y = 1; y <= 3; y++) P.set(i, 0, y, y === 3 && i % 3 === 1 ? LANTERN : 0);
        for (const n of NEIGHBORS) {
          const [q, r] = add([i, 0], n);
          if (axis.has(q + ',' + r) || r === 0) continue; // (les bouts restent ouverts)
          P.set(q, r, 0, STEEL);
          P.set(q, r, 4, STEEL);
          for (let y = 1; y <= 3; y++) P.set(q, r, y, y === 2 && (q + r) % 2 === 0 ? GLASS : STEEL);
        }
      }
      return P;
    },
  },
};
export const isModule = (id) => !!MODULES[id];
const PLANS = new Map();
const planOf = (id) => { if (!PLANS.has(id)) PLANS.set(id, MODULES[id].build().list()); return PLANS.get(id); };

// Les cases du module id posé en (q, r, y) (son centre, son plancher), tourné de rot sixièmes de tour.
// withCore : il apporte un noyau de station
export function moduleCells(id, q, r, y, rot, withCore) {
  const M = MODULES[id], core = M.core;
  return planOf(id).map(([dq, dr, dy, b]) => {
    const [rq, rr] = rotate([dq, dr], rot);
    const isCore = withCore && dq === core[0] && dr === core[1] && dy === core[2];
    return [q + rq, r + rr, y + dy, isCore ? STATION_CORE : b];
  });
}

// La place du module : devant soi (centre à R + 3 cases dans la direction du regard ; un couloir
// part à 2 cases), plancher sous ses pieds ; tourné vers où l'on regarde (+ rot, la touche R)
export function modulePose(id, feet, look, rot) {
  const M = MODULES[id];
  // (la direction de l'hexagone la plus proche du regard)
  let best = 0, bd = -Infinity;
  for (let k = 0; k < 6; k++) {
    const w = hexToWorld(NEIGHBORS[k][0], NEIGHBORS[k][1]), d = (w.x * look.x + w.z * look.z) / Math.hypot(w.x, w.z);
    if (d > bd) { bd = d; best = k; }
  }
  const lx = look.x, lz = look.z, n = Math.hypot(lx, lz) || 1, far = M.corridor ? 2 : M.R + 3;
  const cx = feet.x + (lx / n) * far, cz = feet.z + (lz / n) * far;
  return { cx, cz, y: Math.floor(feet.y + 0.01) - 1, rot: (best + rot) % 6 };
}

// Le fantôme : un prisme par bloc du module (bleu si la place est libre, rouge sinon)
export class ModuleGhost {
  constructor(scene) {
    const geo = new THREE.CylinderGeometry(SIZE * 0.98, SIZE * 0.98, 0.98, 6);
    this.mat = new THREE.MeshBasicMaterial({ color: 0x3cdcff, transparent: true, opacity: 0.3, depthWrite: false });
    this.mesh = new THREE.InstancedMesh(geo, this.mat, 1600);
    this.mesh.renderOrder = 5;
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    this.mesh.count = 0;
    scene.add(this.mesh);
    this.key = '';
    this._m = new THREE.Matrix4();
  }
  show(cells, ok, key) {
    this.mesh.visible = true;
    this.mat.color.set(ok ? 0x3cdcff : 0xff4a3a);
    if (key === this.key) return;
    this.key = key;
    let n = 0;
    // (le maillage à la place du module, ses prismes comptés depuis lui : loin du centre du monde,
    // des positions absolues seraient trop grandes pour la carte graphique, voir origin.js)
    const o = cells.length ? hexToWorld(cells[0][0], cells[0][1]) : { x: 0, z: 0 }, oy = cells.length ? cells[0][2] : 0;
    this.mesh.position.set(o.x, oy, o.z);
    this.mesh.updateMatrix();
    for (const [q, r, y, id] of cells) {
      if (!id || n >= 1600) continue;
      const w = hexToWorld(q, r);
      this.mesh.setMatrixAt(n++, this._m.makeTranslation(w.x - o.x, y + 0.5 - oy, w.z - o.z));
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
  hide() { this.mesh.visible = false; this.key = ''; }
}
