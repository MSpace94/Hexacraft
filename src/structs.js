// Objets collés (Super colle) : des blocs du monde assemblés en un vrai corps rigide
// (façon « Create Aeronautics »).
//
//  - Colle : clic droit sur des blocs (surlignés en vert). Maj + clic droit : assemble les
//    blocs collés qui se touchent (les rails et torches posés dessus viennent avec).
//    Maj + clic droit sur un objet : le repose dans le monde (calé sur la grille).
//  - Chaque bloc a sa masse (masse volumique réelle, voir blocks.js) : la masse totale,
//    le centre de gravité et l'inertie en découlent. Un objet déséquilibré bascule, un
//    objet poussé en hauteur se renverse, un objet frappé sur le côté tourne.
//  - Collisions par points (coins et centres des faces extérieures) contre le terrain et
//    contre les autres objets, résolues par impulsions (rebond, frottement de Coulomb :
//    un objet trop lourd ne glisse pas quand on le pousse).
//  - Eau : poussée d'Archimède bloc par bloc (le bois flotte, la pierre coule) ; l'air
//    enfermé dans une coque (bateau) compte aussi, donc une coque en pierre peut flotter.
//  - Joueurs : on marche dessus (l'objet nous emporte et nous fait tourner), notre poids
//    appuie dessus (un radeau penche quand on marche au bord), on pousse avec une force
//    limitée.
//  - Bloc physique : alimenté (il touche un bloc de voltite ou une torche d'énergie allumée
//    de l'objet), il fait avancer l'objet à la vitesse réglée à la clé à molette (x, y, z en
//    blocs par seconde), en annulant la gravité : à y = 0, l'objet vole à hauteur constante.
//  - Multijoueur : l'hôte simule ; les clients affichent (remote) et demandent les actions.
import * as THREE from 'three';
import { NEIGHBORS, CORNERS, EDGE_NORMALS, hexToWorld, worldToHex, circleHexOverlap, circleHexPush } from './hex.js?v=1.1.5-alpha-mvm2b95g';
import { sea, waveHeight, seaFactor } from './waves.js?v=1.1.5-alpha-mvm2b95g';
import { PROPELLER, PROPELLER_ON, isPropeller, STABILIZER, STABILIZER_ON, isStabilizer, LAMP, LAMP_ON, isLamp, wireStep, isRepeater, isRepeaterOn, repeaterKind, repeaterIn, repeaterOut, repeaterState, isInverter } from './blocks.js?v=1.1.5-alpha-mvm2b95g';
import { BLOCKS, AIR, SOLID, OPAQUE, SLAB, ATTACHED, PHYSICS, PHYSICS_ON, WIRE, WIRE_ON, GRAVITRON, isPhysics, isSource, isWire, isWireOn, wireKind, wireState, isWater, isTnt, hasParams, waterHeight, blockMass, blockGrip, BLOCK_VOLUME, WATER_DENSITY, blockOverlap, blockPush, inSolidPart, slabCombine, POD, POD_TOP, isPod } from './blocks.js?v=1.1.5-alpha-mvm2b95g';
import { buildStructArrays, H, Y_MIN } from './mesher.js?v=1.1.5-alpha-mvm2b95g';
import { sourceLight, SOURCE_REACH } from './light.js?v=1.1.5-alpha-mvm2b95g';
const WORLD_TOP = H; // (H est aussi le nom du pivot d'un rotor, plus bas)
import { geometryFrom } from './world.js?v=1.1.5-alpha-mvm2b95g';
import { RADIUS as P_RADIUS, HEIGHT as P_HEIGHT } from './player.js?v=1.1.5-alpha-mvm2b95g';
import { BODY_R as CART_R, BODY_H as CART_H } from './carts.js?v=1.1.5-alpha-mvm2b95g';
import { DEPTH } from './gen.js?v=1.1.5-alpha-mvm2b95g';

const CART_MASS = 200;        // Hexacart vide (kg) ; + le passager
const CART_GRIP = 0.5;        // frottement Hexacart / objet
// points de la cuve testés dans les blocs des objets : [dx, hauteur, dz]
const CART_POINTS = [[0, 0.03, 0], [0, CART_H - 0.02, 0]];
for (const h of [0.06, 0.32, CART_H - 0.04]) {
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    CART_POINTS.push([Math.cos(a) * CART_R * 0.95, h, Math.sin(a) * CART_R * 0.95]);
  }
}

const G = 30;                 // même gravité que le joueur
const H_STEP = 1 / 60;        // pas de simulation (plus petit si ça va vite)
const ITER = 8;               // passes du solveur de contacts
const ITER_IMPACT = 40;       // ... pendant un choc
const ITER_BUDGET = 6000;     // passes x contacts au plus, par pas
const MAX_STEPS = 10;         // sous-pas par pas fixe au plus
const FIXED_DT = 1 / 60;      // rythme fixe de la simulation
const MAX_FRAME_STEPS = 4;    // pas fixes rattrapés au plus par image (sinon ralenti)
const SLOP = 0.01;            // enfoncement toléré
const CORRECT = 0.4;          // part de l'enfoncement corrigée à chaque pas
const PLAYER_MASS = 75;
const PUSH_FORCE = 20000;     // force d'un joueur qui pousse (glisse ~3 t sur le sol)
const WATER_DRAG = 1.4;       // traînée de l'eau
const EXPLOSION = 3500;       // impulsion reçue par un bloc au cœur d'une explosion
const MAX_ANG = 25;
// Joueur contre un objet penché (voir collideTilted) : points du corps [dx, hauteur, dz, type]
// type 0 = pieds, 1 = corps, 2 = tête
const TILT_COS = 0.97;        // au-delà de ~14° de pente, l'objet est « penché »
const BODY_POINTS = [];
for (const [h, kind] of [[0.02, 0], [0.45, 1], [0.9, 1], [1.35, 1], [1.78, 2]]) {
  if (kind !== 1) BODY_POINTS.push([0, h, 0, kind]);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    BODY_POINTS.push([Math.cos(a) * P_RADIUS * 0.95, h, Math.sin(a) * P_RADIUS * 0.95, kind]);
  }
}
// pas du balayage des collisions joueur / objet (voir collidePlayer)
const SWEEP_STEP = 0.15;
const SEA_AWAKE = 0.12;          // hauteur des vagues (blocs) qui tient éveillé un objet en pleine mer
const REPEATER_PASSES = 8;       // recalculs au plus des fils d'un objet (répéteurs en chaîne)
const ATTACH_DROP = 6;
// Objet plus loin que la distance d'affichage (LOD compris) de tous les joueurs : déchargé
// (ni simulé, ni dessiné, son maillage libéré) ; rechargé en revenant à portée. UNLOAD_MARGIN
// en plus pour décharger : pas d'aller-retour incessant au bord de la zone.
const UNLOAD_MARGIN = 16;          // en l'air, on reste attaché à un objet jusqu'à ce nombre de blocs au-dessus de lui
const HOLD_SPEED = 9;         // main gravitationnelle : vitesse de rappel (par bloc d'écart)
const HOLD_MAX = 20;          // ... vitesse maximale
const HOLD_GRIP = 30;         // ... fermeté de la prise
const HOLD_SPIN = 4;          // ... fermeté de la rotation
const HOLD_TURN = 6;          // ... vitesse de rotation vers l'orientation voulue (par radian)
const HOLD_TURN_MAX = 7;      // ... vitesse de rotation maximale (radians par seconde)
const INSET = 0.96;           // points de contact rentrés de 4 % dans leur bloc
const SIDE_BIAS = 0.03;
const WARM = 0.85;
const REST_V = 0.25, REST_W = 0.15, REST_DAMP = 0.8; // amortissement au repos (voir step)            // part des impulsions du pas précédent reprise au départ
const MARGIN = 0.04;          // contacts anticipés : points à moins de 4 cm au-dessus d'un bloc       // à profondeur presque égale, on préfère s'appuyer dessus/dessous
const MAX_BLOCKS = 4096;
// Plafond : un objet qui monte au-delà (en blocs de hauteur) perd tout : ses blocs physiques
// s'éteignent et ses sources de voltite sont détruites (leviers baissés, torches d'énergie
// éteintes, blocs de voltite arrachés). Il retombe.
export const ALT_MAX = 500;
export const PHYS_DEFAULT = [4, 0, 0]; // réglage d'un bloc physique neuf (x, y, z en blocs/s)
// Gravitron : [x, y, z, mode] (coordonnées du monde visées ; mode 0 missile, 1 avion, 2 bateau)
export const GRAV_MISSILE = 0, GRAV_PLANE = 1, GRAV_BOAT = 2;
// Réglages d'un gravitron : [x, y, z, mode] (une destination), ou un parcours :
// [x0, y0, z0, mode, boucle (0 / 1), arrêt0 (s), x1, y1, z1, arrêt1, x2, ...]
export const ROUTE_MAX = 32; // étapes au plus
export function validGrav(p) {
  return Array.isArray(p) && p.every(Number.isFinite) && (p.length === 4 || (p.length >= 6 && p.length <= 6 + 4 * (ROUTE_MAX - 1) && (p.length - 6) % 4 === 0));
}
// Étapes du parcours d'un gravitron : [{ x, y, z, wait }] et loop
export function gravRoute(g) {
  const route = [{ x: g[0], y: g[1], z: g[2], wait: g.length >= 6 ? Math.max(0, g[5]) : 0 }];
  for (let i = 6; i + 3 < g.length; i += 4) route.push({ x: g[i], y: g[i + 1], z: g[i + 2], wait: Math.max(0, g[i + 3]) });
  return { route, loop: g.length >= 6 && g[4] === 1 };
}
const MOTOR_GAIN = 3;         // vitesse à laquelle l'objet rejoint la vitesse du moteur (par s)
const MOTOR_MAX = 30;         // vitesse maximale d'un moteur
// Hélice allumée : elle fait tourner ce qui est posé dessus (le rotor) autour de sa verticale,
// sans rien déplacer d'autre. Le rotor : les blocs collés au bloc juste au-dessus (sur cette
// couche, à moins de ROTOR_R cases de l'axe), détachés en objet à part ; ou l'objet collé posé
// dessus. Il est tenu sur l'axe (pivot) et tourne à ROTOR_SPEED rad/s ; éteinte, l'hélice le
// laisse ralentir puis s'arrêter (il reste en place).
const LIGHT_EVERY = 1;        // lumière des objets immobiles revue chaque seconde (torche posée...)
const ROTOR_SPEED = 45;       // ~430 tours par minute (rotor d'hélicoptère rapide)
const ROTOR_SPIN_UP = 1.5;    // vitesse à laquelle il rejoint sa vitesse (par seconde)...
const ROTOR_EASY_MASS = 6000; // ... pour un rotor de 6 t au plus (plus lourd : plus lent)
// Portance d'un rotor (sur un objet) : chaque pale (bloc du rotor) à la distance r de l'axe
// avance à ω·r et pousse l'air : L = ½ ρ Cl A (ω r)², selon l'axe de l'hélice. Toutes les
// matières portent autant ; ce qui compte, c'est le poids : un rotor et un engin en laine
// décollent, en pierre jamais. La portance faiblit en montant vite (l'air entre déjà dans le
// rotor) et en altitude (air moins dense). Le rotor pèse sur l'objet qui le porte.
const AIR_DENSITY = 1.2 * (G / 9.81); // air (kg/m³), compté pour la gravité du jeu (3 fois la vraie)
const AIR_SCALE = 120;        // l'air est 2,7 fois moins dense AIR_SCALE blocs plus haut (plafond)
const AIR_BASE = 64;          // ... qu'au niveau de la mer
const AIR_TOP = 30;           // et plus d'air du tout AIR_TOP blocs au-dessus du haut du monde
const BLADE_CL = 3;           // coefficient de portance d'une pale (bloc large et incliné : il
                              // brasse beaucoup d'air ; un rotor en planches porte son poids)
const BLADE_AREA = 0.866;     // surface du dessus d'une case (m²)
const ROTOR_INFLOW = 0.1;     // montée à 0,1 × vitesse du bout des pales : plus de portance
// Stabilisateur (allumé, sur l'objet) : comme la centrale d'attitude d'un vrai engin, il
// mesure à chaque instant la pente et la rotation, et donne le couple qu'il faut pour que
// l'engin revienne à l'horizontale à vitesse douce (sans osciller) et cesse de tourner sur
// lui-même. Son couple est limité : un gros engin, ou un engin mal équilibré (rotor loin du
// centre de gravité), en demande plusieurs.
const STAB_TORQUE = 1500000;  // couple maximal d'un stabilisateur (N·m)
const STAB_RATE = 2;          // vitesse de redressement (rad/s par radian de pente)
const STAB_YAW = 3;           // freinage de la rotation sur lui-même (par seconde)
const ROTOR_R = 6;            // rayon maximal d'un rotor (cases)
const ROTOR_MAX = 96;         // blocs au plus dans un rotor
const hexDist = (dq, dr) => (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
const CELLS = [[0, 0], ...NEIGHBORS];
const AROUND = [[0, 0, 1], [0, 0, -1], ...NEIGHBORS.map(([q, r]) => [q, r, 0])];
const key = (q, r, y) => q + ',' + r + ',' + y;
// Hauteur occupée dans la case : bloc entier, dalle basse, dalle haute
const FULL = [0, 1], LOWER = [0, 0.5], UPPER = [0.5, 1];
const boxOf = (id) => SLAB[id] === 1 ? LOWER : SLAB[id] === 2 ? UPPER : FULL;
// Bloc solide du monde : sa hauteur occupée, ou null
const worldBox = (w) => (q, r, y) => { const id = w.getBlock(q, r, y); return SOLID[id] ? boxOf(id) : null; };
// Point à la hauteur fy (0..1) de la case : dedans ?
const inBox = (b, fy) => b !== null && fy >= b[0] && fy <= b[1];
// Voisins pleins pour faceOut, pour un bloc qui occupe [lo, hi] de la case (q, r, y) :
// au-dessus / au-dessous, le voisin doit toucher la face ; sur les côtés, la couvrir
const fullFn = (box, q, r, y, lo, hi) => (dq, dr, dy) => {
  const n = box(q + dq, r + dr, y + dy);
  if (!n) return false;
  return dy > 0 ? n[0] === 0 : dy < 0 ? n[1] === 1 : n[0] <= lo && n[1] >= hi;
};
const UP = new THREE.Vector3(0, 1, 0);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

// temporaires (jamais conservés d'un appel à l'autre)
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();
const _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion(), _q4 = new THREE.Quaternion(); // (rotors)
const _f = new THREE.Vector3(), _g = new THREE.Vector3(), _h = new THREE.Vector3(), _m3 = new THREE.Matrix3();
const _d = new THREE.Vector3(), _e = new THREE.Vector3(), _q = new THREE.Quaternion();
const _m = new THREE.Matrix4();

export class StructSystem {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.list = [];
    this.nextId = 0;
    this.remote = false;
    this.glued = new Set();       // cases du monde collées (pas encore assemblées)
    this.onChange = null;         // multijoueur (hôte) : objet créé / modifié / supprimé
    this.glueMesh = null;
    this.glueMaterial = new THREE.MeshBasicMaterial({
      color: 0x7dff5a, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    });
    this.contacts = [];
    this.holds = new Map();       // main gravitationnelle : qui tient quel objet (hôte / solo)
    this.worldParams = new Map(); // réglages des blocs physiques posés dans le monde ("q,r,y")
  }

  // ---------- Colle ----------
  toggleGlue(q, r, y) {
    const k = key(q, r, y);
    if (this.glued.has(k)) this.glued.delete(k);
    else {
      const id = this.world.getBlock(q, r, y);
      if (!id || isWater(id) || !BLOCKS[id] || BLOCKS[id].unbreakable) return false;
      this.glued.add(k);
    }
    this.renderGlue();
    return true;
  }

  clearGlue() {
    this.glued.clear();
    this.renderGlue();
  }

  // Surbrillance verte des blocs collés (un seul maillage, refait à chaque changement)
  renderGlue() {
    if (this.glueMesh) { this.scene.remove(this.glueMesh); this.glueMesh.geometry.dispose(); this.glueMesh = null; }
    if (!this.glued.size) return;
    const pos = [];
    for (const k of this.glued) {
      const [q, r, y] = k.split(',').map(Number);
      const id = this.world.getBlock(q, r, y);
      // contour aplati sur un rail, resserré autour d'une torche
      const s = BLOCKS[id]?.torch ? 0.25 : 1.02;
      const c = hexToWorld(q, r);
      const y0 = y - 0.01, y1 = y + (BLOCKS[id]?.rail ? 0.12 : BLOCKS[id]?.torch ? 0.65 : 1.01);
      for (let i = 0; i < 6; i++) {
        const [ax, az] = CORNERS[i], [bx, bz] = CORNERS[(i + 1) % 6];
        const A = [c.x + ax * s, c.z + az * s], B = [c.x + bx * s, c.z + bz * s];
        pos.push(A[0], y0, A[1], B[0], y0, B[1], B[0], y1, B[1], A[0], y0, A[1], B[0], y1, B[1], A[0], y1, A[1]);
        pos.push(c.x, y1, c.z, A[0], y1, A[1], B[0], y1, B[1]);
        pos.push(c.x, y0, c.z, B[0], y0, B[1], A[0], y0, A[1]);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    this.glueMesh = new THREE.Mesh(g, this.glueMaterial);
    this.scene.add(this.glueMesh);
  }

  // Blocs collés reliés à la case (q, r, y) (voisins sur les côtés, dessus, dessous)
  gluedGroup(q, r, y) {
    const start = key(q, r, y);
    if (!this.glued.has(start)) return [];
    const seen = new Set([start]), stack = [[q, r, y]], out = [];
    while (stack.length) {
      const [a, b, c] = stack.pop();
      out.push([a, b, c]);
      for (const [dq, dr, dy] of AROUND) {
        const k = key(a + dq, b + dr, c + dy);
        if (this.glued.has(k) && !seen.has(k)) { seen.add(k); stack.push([a + dq, b + dr, c + dy]); }
      }
    }
    return out;
  }

  // Stabilisateurs de l'objet s (s.stab allumés) : couple de redressement limité
  stabilize(s, h) {
    const up = _f.set(0, 1, 0).applyQuaternion(s.quat);
    const w = s.ang;
    // rotation voulue : vers la verticale (axe up × UP), proportionnelle à la pente
    const tilt = Math.acos(clamp(up.y, -1, 1));
    const want = _g.crossVectors(up, UP);
    if (want.lengthSq() > 1e-12) want.normalize().multiplyScalar(STAB_RATE * tilt); else want.set(0, 0, 0);
    // changement de vitesse de rotation : tout l'écart de travers, un peu de la rotation sur
    // lui-même
    const spin = w.dot(UP);
    const dw = want.sub(_h.copy(w).addScaledVector(UP, -spin));
    dw.addScaledVector(UP, -spin * Math.min(1, STAB_YAW * h));
    // couple nécessaire (inertie × accélération), limité par ce que donnent les stabilisateurs
    const I = _m3.copy(s.Iw).invert();
    const L = _h.copy(dw).applyMatrix3(I);       // impulsion angulaire nécessaire
    const max = s.stab * STAB_TORQUE * h;
    const l = L.length();
    if (l > max) dw.multiplyScalar(max / l);
    w.add(dw);
  }

  // ---------- Hélices : rotors ----------
  // Hélice (de l'objet base, ou du monde si base = null, case k) : son rotor, s'il existe
  rotorOf(base, k) {
    return this.list.find((s) => s.hinge && s.hinge.base === base && s.hinge.key === k) || null;
  }

  // Hélices allumées sans rotor : on le crée (blocs du dessus détachés, ou objet posé dessus)
  spinUp() {
    const queue = this.spinQueue;
    this.spinQueue = [];
    for (const [baseId, k] of queue) {
      const had = this.rotorOf(baseId, k);
      if (had) { this.wake(had); continue; } // (rallumée : il repart)
      const base = baseId === null ? null : this.byId(baseId);
      if (baseId !== null && !base) continue;
      const get = base ? (q, r, y) => base.blocks.get(key(q, r, y)) || 0 : (q, r, y) => this.world.getBlock(q, r, y);
      const [q0, r0, y0] = k.split(',').map(Number);
      if (get(q0, r0, y0) !== PROPELLER_ON) continue;
      // les blocs collés au bloc du dessus, sur sa couche, près de l'axe ; une pale plus proche
      // d'une autre hélice (même hauteur) est à elle (des rotors voisins ne se mélangent pas)
      const others = [];
      for (let dq = -2 * ROTOR_R; dq <= 2 * ROTOR_R; dq++) {
        for (let dr = -2 * ROTOR_R; dr <= 2 * ROTOR_R; dr++) {
          if ((dq || dr) && hexDist(dq, dr) <= 2 * ROTOR_R && isPropeller(get(q0 + dq, r0 + dr, y0))) others.push([q0 + dq, r0 + dr]);
        }
      }
      const mine = (q, r) => others.every(([a, b]) => hexDist(q - a, r - b) > hexDist(q - q0, r - r0));
      const cells = [], seen = new Set();
      const stack = [[q0, r0]];
      while (stack.length && cells.length < ROTOR_MAX) {
        const [q, r] = stack.pop(), kk = key(q, r, y0 + 1);
        if (seen.has(kk)) continue;
        seen.add(kk);
        const id = get(q, r, y0 + 1);
        if (!id || isWater(id) || isPropeller(id) || BLOCKS[id]?.unbreakable || hexDist(q - q0, r - r0) > ROTOR_R || !mine(q, r)) continue;
        cells.push([q, r, y0 + 1]);
        for (const [dq, dr] of NEIGHBORS) stack.push([q + dq, r + dr]);
      }
      let rotor = null;
      if (cells.length) {
        // (et ce qui est posé dessus : rails, torches)
        rotor = base ? this.detach(base, cells) : this.assemble(cells);
      } else {
        // rien au-dessus dans le même objet : un autre objet collé posé sur l'hélice ?
        const c = hexToWorld(q0, r0), top = new THREE.Vector3(c.x, y0 + 1.2, c.z);
        if (base) this.toWorld(base, top, top);
        const found = this.solidAt(top.x, top.y, top.z);
        if (found && found !== base && !found.hinge) rotor = found;
      }
      if (!rotor) continue;
      const c = hexToWorld(q0, r0), P = new THREE.Vector3(c.x, y0 + 1, c.z);
      if (base) this.toWorld(base, P, P);
      const baseQ = base ? base.quat : new THREE.Quaternion();
      rotor.hinge = {
        base: baseId, key: k, phi: 0, w: 0,
        L: this.toLocal(rotor, P, new THREE.Vector3()).toArray(),
        q0: baseQ.clone().invert().multiply(rotor.quat).toArray(),
      };
      this.wake(rotor);
      this.changed(rotor);
    }
  }

  // Détache ces cases (locales) de l'objet s : un nouvel objet, au même endroit
  detach(s, cells) {
    const origin = this.origin(s, new THREE.Vector3());
    const part = [];
    for (const [q, r, y] of cells) {
      const kk = key(q, r, y);
      part.push([q, r, y, s.blocks.get(kk)]);
      s.blocks.delete(kk);
      const above = key(q, r, y + 1);
      if (ATTACHED[s.blocks.get(above)]) { part.push([q, r, y + 1, s.blocks.get(above)]); s.blocks.delete(above); }
    }
    const n = this.create(++this.nextId, origin.x, origin.y, origin.z, s.quat, part);
    for (const [q, r, y, id] of part) {
      const p = s.params.get(key(q, r, y));
      if (p) { n.params.set(key(q, r, y), p); s.params.delete(key(q, r, y)); }
      if (BLOCKS[id]?.container) this.onMoveBox?.('S' + s.id + ':' + key(q, r, y), 'S' + n.id + ':' + key(q, r, y));
    }
    this.ropes?.split(s, n);
    this.updateMotor(n);
    n.vel.copy(s.vel);
    n.ang.copy(s.ang);
    this.changed(n);
    this.afterEdit(s);
    return n;
  }

  // Un pas du rotor : il tourne autour de l'axe de son hélice, tenu sur le pivot. Hélice
  // disparue (ou son support) : il est lâché, libre.
  turnRotor(s, h) {
    const H = s.hinge;
    const base = H.base === null ? null : this.byId(H.base);
    const [q0, r0, y0] = H.key.split(',').map(Number);
    // (déchargé, ou hélice du monde dans un chunk pas chargé : il reste figé tel quel)
    if (s.unloaded || base?.unloaded || (!base && H.base === null && this.world.isLoaded?.(q0, r0) === false)) return;
    const id = base ? base.blocks.get(H.key) : this.world.getBlock(q0, r0, y0);
    if ((H.base !== null && !base) || !isPropeller(id)) { s.hinge = null; this.wake(s); return; }
    const want = id === PROPELLER_ON ? ROTOR_SPEED : 0;
    H.w += (want - H.w) * Math.min(1, ROTOR_SPIN_UP * Math.min(1, ROTOR_EASY_MASS / s.mass) * h);
    if (Math.abs(H.w) < 0.01 && !want) H.w = 0;
    H.phi = (H.phi + H.w * h) % (Math.PI * 2);
    const baseQ = base ? base.quat : _q2.identity();
    const axis = _c.set(0, 1, 0).applyQuaternion(baseQ);
    s.quat.copy(baseQ).multiply(_q3.setFromAxisAngle(UP, H.phi)).multiply(_q4.fromArray(H.q0)).normalize();
    const c = hexToWorld(q0, r0), P = _d.set(c.x, y0 + 1, c.z);
    if (base) this.toWorld(base, P, P);
    s.pos.copy(P).sub(_e.fromArray(H.L).sub(s.com).applyQuaternion(s.quat));
    if (base) this.velAt(base, _a.subVectors(P, base.pos), s.vel); else s.vel.set(0, 0, 0);
    s.ang.copy(base ? base.ang : _a.set(0, 0, 0)).addScaledVector(axis, H.w);
    this.updateFrame(s);
    if (H.w || (base && !base.sleeping)) s.sleeping = false;
    if (base && (H.w || !base.sleeping)) this.rotorLift(s, base, axis.clone(), P.clone(), H, h);
  }

  // Portance du rotor s (et son poids) sur l'objet qui le porte, au pivot P
  rotorLift(s, base, axis, P, H, h) {
    // Σ r² des pales (distance à l'axe, repère du rotor), recalculée si ses blocs changent
    if (H.n !== s.blocks.size) {
      let r2 = 0, rmax = 0;
      for (const [q, r, , id] of s.list) {
        if (!SOLID[id]) continue;
        const c = hexToWorld(q, r), d2 = (c.x - H.L[0]) ** 2 + (c.z - H.L[2]) ** 2;
        r2 += d2;
        rmax = Math.max(rmax, Math.sqrt(d2));
      }
      H.n = s.blocks.size; H.r2 = r2; H.rmax = rmax;
    }
    const rho = AIR_DENSITY * Math.exp(-(P.y - AIR_BASE) / AIR_SCALE) * clamp((WORLD_TOP + AIR_TOP - P.y) / AIR_TOP, 0, 1);
    let lift = 0.5 * rho * BLADE_CL * BLADE_AREA * H.w * H.w * H.r2;
    const climb = base.vel.dot(axis), inflow = ROTOR_INFLOW * Math.abs(H.w) * H.rmax;
    if (inflow > 0) lift *= clamp(1 - climb / inflow, 0, 1.3);
    H.lift = lift;
    // portance au pivot (selon l'axe : elle ne fait pas basculer) ; poids du rotor au centre de
    // gravité (rotor et objet ne font qu'un engin : posé au-dessus, il le ferait chavirer)
    this.push(base, axis.multiplyScalar(lift), P, h);
    this.push(base, _f.set(0, -s.mass * G, 0), base.pos.clone(), h);
  }

  // Double colle : l'objet B est collé à l'objet A, ils n'en font plus qu'un. Les blocs de B
  // sont recalés sur la grille de A (au plus près) ; il faut qu'ils touchent A sans rentrer
  // dedans. La quantité de mouvement est gardée. Renvoie null, ou la raison d'un refus.
  merge(A, B) {
    if (!A || !B) return 'Objet introuvable';
    if (A === B) return 'Choisis un deuxième objet, différent du premier';
    if (A.blocks.size + B.blocks.size > MAX_BLOCKS) return 'L\'objet serait trop gros';
    const L = new THREE.Vector3(), W = new THREE.Vector3();
    const moved = [], taken = new Set(A.blocks.keys());
    let touch = false;
    for (const [k, id] of B.blocks) {
      const [q, r, y] = k.split(',').map(Number);
      const c = hexToWorld(q, r);
      this.toLocal(A, this.toWorld(B, L.set(c.x, y + 0.5, c.z), W), L);
      const h = worldToHex(L.x, L.z), yy = Math.floor(L.y), kk = key(h.q, h.r, yy);
      if (taken.has(kk)) return 'Les deux objets se rentrent dedans : écarte-les un peu (ou tourne l\'un d\'eux)';
      taken.add(kk);
      moved.push([k, kk, id]);
      touch ||= AROUND.some(([dq, dr, dy]) => A.blocks.has(key(h.q + dq, h.r + dr, yy + dy)));
    }
    if (!touch) return 'Les deux objets doivent se toucher';
    const M = A.mass + B.mass;
    const vel = A.vel.clone().multiplyScalar(A.mass).addScaledVector(B.vel, B.mass).divideScalar(M);
    const ang = A.ang.clone().multiplyScalar(A.mass).addScaledVector(B.ang, B.mass).divideScalar(M);
    for (const [k, kk, id] of moved) {
      A.blocks.set(kk, id);
      const p = B.params.get(k);
      if (p) A.params.set(kk, p);
      // coffres et fours : leur contenu suit
      if (BLOCKS[id]?.container) this.onMoveBox?.('S' + B.id + ':' + k, 'S' + A.id + ':' + kk);
    }
    this.ropes?.rebase(B, A); // (ses cordes passent à A)
    this.remove(B);
    A.vel.copy(vel);
    A.ang.copy(ang);
    this.refresh(A);
    this.wake(A);
    this.changed(A);
    return null;
  }

  // Transforme ces cases du monde en objet physique. Renvoie l'objet (ou null).
  assemble(cells) {
    const w = this.world;
    const blocks = [], seen = new Set();
    const add = (q, r, y) => {
      const k = key(q, r, y);
      if (seen.has(k) || blocks.length >= MAX_BLOCKS) return;
      const id = w.getBlock(q, r, y);
      if (!id || isWater(id) || !BLOCKS[id] || BLOCKS[id].unbreakable) return;
      seen.add(k);
      blocks.push([q, r, y, id]);
    };
    for (const [q, r, y] of cells) add(q, r, y);
    // les rails et torches posés sur un bloc collé partent avec lui
    for (const [q, r, y, id] of [...blocks]) if (SOLID[id] && ATTACHED[w.getBlock(q, r, y + 1)]) add(q, r, y + 1);
    for (const [q, r, y] of cells) this.glued.delete(key(q, r, y));
    this.renderGlue();
    if (!blocks.length) return null;
    const [q0, r0, y0] = blocks[0];
    const o = hexToWorld(q0, r0);
    const s = this.create(++this.nextId, o.x, y0, o.z, null, blocks.map(([q, r, y, id]) => [q - q0, r - r0, y - y0, id]));
    // les réglages des blocs physiques partent avec l'objet
    for (const [q, r, y, id] of blocks) {
      const p = hasParams(id) && this.worldParams.get(key(q, r, y));
      if (p) { s.params.set(key(q - q0, r - r0, y - y0), p); this.worldParams.delete(key(q, r, y)); }
    }
    this.updateMotor(s);
    // coffres et fours : leur contenu part avec l'objet
    for (const [q, r, y, id] of blocks) {
      if (BLOCKS[id]?.container) this.onMoveBox?.(key(q, r, y), 'S' + s.id + ':' + key(q - q0, r - r0, y - y0));
    }
    // d'abord les rails et torches, puis du haut vers le bas
    blocks.sort((a, b) => (ATTACHED[b[3]] - ATTACHED[a[3]]) || b[2] - a[2]);
    for (const [q, r, y] of blocks) w.setBlock(q, r, y, AIR);
    this.wake(s);
    this.changed(s);
    return s;
  }

  // Repose l'objet dans le monde, calé sur la grille (rotation arrondie au 60° le plus
  // proche). Renversé, chaque bloc va dans la case la plus proche (les rails et torches
  // tombent). false s'il n'y a pas la place.
  disassemble(s) {
    const w = this.world;
    const up = _a.copy(UP).applyQuaternion(s.quat);
    if (up.y < 0.9) return this.disassembleTilted(s);
    const ax = _b.set(1, 0, 0).applyQuaternion(s.quat);
    const yaw = Math.round(Math.atan2(-ax.z, ax.x) / (Math.PI / 3)) * (Math.PI / 3);
    const snap = new THREE.Quaternion().setFromAxisAngle(UP, yaw);
    const center = (q, r, y) => {
      const c = hexToWorld(q, r);
      return new THREE.Vector3(c.x, y + 0.5, c.z).sub(s.com).applyQuaternion(snap).add(s.pos);
    };
    // le premier bloc se cale sur la case la plus proche ; les autres suivent exactement
    const [q0, r0, y0] = s.list[0];
    const c0 = center(q0, r0, y0);
    const h0 = worldToHex(c0.x, c0.z), w0 = hexToWorld(h0.q, h0.r);
    const shift = new THREE.Vector3(w0.x - c0.x, Math.round(c0.y - 0.5) - (c0.y - 0.5), w0.z - c0.z);
    const out = [], params = [];
    for (const [q, r, y, id] of s.list) {
      const c = center(q, r, y).add(shift);
      const h = worldToHex(c.x, c.z), yy = Math.round(c.y - 0.5);
      if (yy < Y_MIN || yy >= H) return false;
      const cur = w.getBlock(h.q, h.r, yy);
      if (cur !== AIR && !isWater(cur)) return false;
      out.push([h.q, h.r, yy, id]);
      const p = s.params.get(key(q, r, y));
      if (p) params.push([key(h.q, h.r, yy), p]);
      if (BLOCKS[id]?.container) params.push([null, 'S' + s.id + ':' + key(q, r, y), key(h.q, h.r, yy)]);
    }
    this.remove(s);
    for (const [k, p, to] of params) {
      if (k === null) this.onMoveBox?.(p, to); // contenu d'un coffre / four : de nouveau dans le monde
      else this.worldParams.set(k, p);
    }
    // blocs pleins du bas vers le haut, puis ce qui se pose dessus
    out.sort((a, b) => (ATTACHED[a[3]] - ATTACHED[b[3]]) || a[2] - b[2]);
    for (const [q, r, y, id] of out) w.setBlock(q, r, y, id);
    return true;
  }

  disassembleTilted(s) {
    const w = this.world, out = [], used = new Set(), p = new THREE.Vector3();
    for (const [q, r, y, id] of s.list) {
      if (ATTACHED[id]) continue;
      const c = hexToWorld(q, r);
      this.toWorld(s, _b.set(c.x, y + 0.5, c.z), p);
      const h = worldToHex(p.x, p.z), yy = Math.floor(p.y);
      const k = key(h.q, h.r, yy);
      if (used.has(k) || yy < Y_MIN || yy >= H) return false;
      const cur = w.getBlock(h.q, h.r, yy);
      if (cur !== AIR && !isWater(cur)) return false;
      used.add(k);
      out.push([h.q, h.r, yy, id]);
      const p = s.params.get(key(q, r, y));
      if (p) this.worldParams.set(k, p);
      if (BLOCKS[id]?.container) this.onMoveBox?.('S' + s.id + ':' + key(q, r, y), k);
    }
    this.remove(s);
    out.sort((a, b) => a[2] - b[2]);
    for (const [q, r, y, id] of out) w.setBlock(q, r, y, id);
    return true;
  }

  // ---------- Objets ----------
  // (x, y, z) : position dans le monde de l'origine de la grille locale ; quat : rotation
  create(id, x, y, z, quat, list) {
    const s = {
      id, blocks: new Map(), list: [],
      pos: new THREE.Vector3(x, y, z), quat: quat ? quat.clone() : new THREE.Quaternion(),
      com: new THREE.Vector3(), vel: new THREE.Vector3(), ang: new THREE.Vector3(),
      pv: new THREE.Vector3(), pw: new THREE.Vector3(),
      prevPos: new THREE.Vector3(x, y, z), prevQuat: new THREE.Quaternion(),
      rot: new THREE.Matrix3(), rotT: new THREE.Matrix3(), IbInv: new THREE.Matrix3(), Iw: new THREE.Matrix3(),
      mass: 1, invMass: 1, radius: 1, pts: [], buoy: [], solid: new Set(), lights: [],
      group: new THREE.Group(), warm: new Map(), sleeping: true, still: 0, inWater: false, moved: false,
      params: new Map(), motor: null, // blocs physiques : réglages (clé locale -> [x, y, z]) et poussée
    };
    this.scene.add(s.group);
    this.setBlocks(s, list);
    s.prevPos.copy(s.pos);
    s.prevQuat.copy(s.quat);
    this.list.push(s);
    return s;
  }

  byId(id) { return this.list.find((s) => s.id === id) || null; }

  setBlocks(s, list) {
    s.blocks.clear();
    for (const [q, r, y, id] of list) s.blocks.set(key(q, r, y), id);
    this.refresh(s);
  }

  // Recalcule masse, centre de gravité, inertie, points de contact, flotteurs et maillage.
  // Les blocs restent à leur place dans le monde (l'origine de la grille ne bouge pas).
  refresh(s) {
    this.updateMotor(s);
    const origin = this.origin(s, new THREE.Vector3());
    const oldPos = s.pos.clone();
    s.list = [...s.blocks].map(([k, id]) => { const [q, r, y] = k.split(',').map(Number); return [q, r, y, id]; });
    s.solid = new Set(s.list.filter(([, , , id]) => SOLID[id]).map(([q, r, y]) => key(q, r, y)));
    // dalles : la moitié de la case seulement (collisions)
    s.half = new Map(s.list.filter(([, , , id]) => SLAB[id]).map(([q, r, y, id]) => [key(q, r, y), boxOf(id)]));
    s.box = (q, r, y) => { const k = key(q, r, y); return s.solid.has(k) ? (s.half.get(k) || FULL) : null; };

    // masse et centre de gravité
    let M = 0;
    const com = new THREE.Vector3();
    const centers = s.list.map(([q, r, y, id]) => {
      const c = hexToWorld(q, r), m = blockMass(id);
      // les objets fins ont leur masse près du bas de la case
      const cy = SLAB[id] === 1 ? y + 0.25 : SLAB[id] === 2 ? y + 0.75 : SOLID[id] ? y + 0.5 : y + 0.15;
      M += m;
      com.x += c.x * m; com.y += cy * m; com.z += c.z * m;
      return [c.x, cy, c.z, m];
    });
    com.divideScalar(M || 1);
    s.com.copy(com);
    s.mass = Math.max(0.1, M);
    s.invMass = 1 / s.mass;

    // inertie (chaque bloc : point massif + inertie propre d'un prisme hexagonal)
    const I = [0, 0, 0, 0, 0, 0]; // xx, yy, zz, xy, xz, yz
    let rad = 0;
    for (const [x, y, z, m] of centers) {
      const rx = x - com.x, ry = y - com.y, rz = z - com.z;
      I[0] += m * (ry * ry + rz * rz + 0.152); I[1] += m * (rx * rx + rz * rz + 0.139); I[2] += m * (rx * rx + ry * ry + 0.152);
      I[3] -= m * rx * ry; I[4] -= m * rx * rz; I[5] -= m * ry * rz;
      rad = Math.max(rad, Math.hypot(rx, ry, rz));
    }
    s.IbInv.set(I[0], I[3], I[4], I[3], I[1], I[5], I[4], I[5], I[2]).invert();
    s.radius = rad + 1;

    this.buildPoints(s);
    this.buildFloaters(s);

    // la grille reste où elle était ; la vitesse est celle du nouveau centre de gravité
    s.pos.copy(com).applyQuaternion(s.quat).add(origin);
    _a.subVectors(s.pos, oldPos);
    s.vel.add(_b.crossVectors(s.ang, _a));
    // le centre de gravité a changé : la position lissée entre deux pas repart d'ici
    s.physPos = s.lastPos = null;
    this.updateFrame(s);
    this.buildMesh(s);
  }

  // Courant dans l'objet, comme dans le monde (voir circuits.js) : les fils de voltite posés
  // sur l'objet le portent depuis ses sources (bloc de voltite, torche d'énergie allumée),
  // en perdant 1 par fil. Les blocs physiques qui touchent une source ou un fil allumé
  // s'allument ; la vitesse du moteur est la somme de leurs réglages. Les répéteurs aussi
  // (sans délai sur un objet) : on recalcule les fils tant qu'un répéteur change d'état.
  updateMotor(s) {
    s.motor = null;
    s.stab = 0;
    const get = (q, r, y) => s.blocks.get(key(q, r, y)) || 0;
    // un répéteur voisin (même hauteur) alimente-t-il (q, r, y) ? (kind : pour un fil)
    const fed = (q, r, y, kind = 0) => NEIGHBORS.some(([dq, dr], i) => {
      const n = get(q + dq, r + dr, y);
      return isRepeaterOn(n) && repeaterOut(n) === (i + 3) % 6 && (!kind || repeaterKind(n) === kind);
    });
    const powered = (q, r, y) => AROUND.some(([dq, dr, dy]) => { const n = get(q + dq, r + dr, y + dy); return isSource(n) || isWireOn(n); }) || fed(q, r, y);
    for (let pass = 0; pass < REPEATER_PASSES; pass++) {
      this.solveWires(s, get, fed);
      let changed = false;
      for (const [k, id] of s.blocks) {
        if (!isRepeater(id)) continue;
        const [q, r, y] = k.split(',').map(Number), side = repeaterIn(id), [dq, dr] = NEIGHBORS[side];
        const n = get(q + dq, r + dr, y);
        const fedIn = isSource(n) || isWireOn(n) || (isRepeaterOn(n) && repeaterOut(n) === (side + 3) % 6);
        const on = fedIn !== isInverter(id); // (inverseur : à l'envers)
        const want = repeaterState(id, on);
        if (want !== id) { s.blocks.set(k, want); changed = true; }
      }
      if (!changed) break;
    }
    for (const [k, id] of s.blocks) {
      if (!isPhysics(id)) continue;
      const [q, r, y] = k.split(',').map(Number);
      const on = powered(q, r, y) && !(s.pos.y > ALT_MAX); // (trop haut : éteint, voir cutPower)
      const want = on ? PHYSICS_ON : PHYSICS;
      if (want !== id) s.blocks.set(k, want); // (le maillage est refait juste après)
      if (!on) continue;
      const p = s.params.get(k) || PHYS_DEFAULT;
      (s.motor ||= new THREE.Vector3()).add(_a.set(p[0], p[1], p[2]));
    }
    if (s.motor) {
      if (s.motor.length() > MOTOR_MAX) s.motor.setLength(MOTOR_MAX);
      this.wake(s);
    }
    // hélices : elles tournent (et soulèvent l'objet) quand elles reçoivent du courant
    for (const [k, id] of s.blocks) {
      if (!isPropeller(id)) continue;
      const on = powered(...k.split(',').map(Number));
      if (on !== (id === PROPELLER_ON)) s.blocks.set(k, on ? PROPELLER_ON : PROPELLER);
      if (on) (this.spinQueue ||= []).push([s.id, k]); // (rotor créé au prochain pas, voir spinUp)
    }
    // stabilisateurs : allumés par le courant de l'objet
    for (const [k, id] of s.blocks) {
      if (!isStabilizer(id)) continue;
      const on = powered(...k.split(',').map(Number));
      if (on !== (id === STABILIZER_ON)) s.blocks.set(k, on ? STABILIZER_ON : STABILIZER);
      if (on) s.stab++;
    }
    if (s.stab) this.wake(s);
    // lampes : allumées par le courant de l'objet
    for (const [k, id] of s.blocks) {
      if (!isLamp(id)) continue;
      const on = powered(...k.split(',').map(Number));
      if (on !== (id === LAMP_ON)) s.blocks.set(k, on ? LAMP_ON : LAMP);
    }
    // TNT qui reçoit du courant : elle s'allume (après le pas de physique, voir update)
    for (const [k, id] of s.blocks) {
      if (isTnt(id) && powered(...k.split(',').map(Number))) (s.fuses ||= new Set()).add(k);
    }
    this.updatePilot(s);
  }

  // L'objet a dépassé le plafond (ALT_MAX) : ses sources de voltite sont coupées ou détruites,
  // et ses blocs physiques restent éteints tant qu'il est au-dessus (même ceux qu'un inverseur
  // alimenterait). Prévient le jeu (onPowerCut) la première fois.
  cutPower(s) {
    let cut = 0;
    for (const [k, id] of [...s.blocks]) {
      if (id === 80) { s.blocks.set(k, 79); cut++; }          // levier baissé
      else if (id === 24) { s.blocks.set(k, 25); cut++; }     // torche d'énergie éteinte
      else if (isSource(id)) { s.blocks.delete(k); cut++; }   // bloc de voltite arraché
    }
    const motor = !!s.motor;
    if (!cut && !motor) return;
    if (cut && !s.blocks.size) { this.remove(s); return; } // (il n'était fait que de voltite)
    this.refresh(s);
    this.changed(s);
    if (!s.powerCut) { s.powerCut = true; this.onPowerCut?.(s); }
  }

  // Courant dans les fils de l'objet : 15 à côté d'une source ou devant un répéteur
  // allumé de la même sorte, puis 1 de moins par fil
  solveWires(s, get, fed) {
    const level = new Map(), queue = [];
    for (const [k, id] of s.blocks) {
      if (!isWire(id)) continue;
      const [q, r, y] = k.split(',').map(Number);
      if (AROUND.some(([dq, dr, dy]) => isSource(get(q + dq, r + dr, y + dy))) || fed(q, r, y, wireKind(id))) { level.set(k, 15); queue.push(k); }
    }
    for (let i = 0; i < queue.length; i++) {
      const k = queue[i], p = level.get(k);
      if (p <= 1) continue;
      const [q, r, y] = k.split(',').map(Number);
      // fils reliés à plat ou par une marche (voir wireStep)
      const at = (dq, dr, dy) => s.blocks.get(key(q + dq, r + dr, y + dy)) || 0;
      for (const [dq, dr] of NEIGHBORS) {
        const st = wireStep(at, s.blocks.get(k), dq, dr);
        if (st === null) continue;
        const n = key(q + dq, r + dr, y + st);
        if ((level.get(n) || 0) >= p - 1) continue;
        level.set(n, p - 1);
        queue.push(n);
      }
    }
    for (const [k, id] of s.blocks) {
      if (!isWire(id)) continue;
      const want = wireState(id, !!level.get(k));
      if (want !== id) s.blocks.set(k, want);
    }
  }

  updatePilot(s) {
    // Gravitron : il pilote les blocs physiques allumés. Leur vitesse réglée ne compte plus
    // que pour sa valeur (la somme donne la vitesse maximale), la direction vient du pilote.
    s.pilot = null;
    if (s.motor) {
      for (const [k, id] of s.blocks) {
        if (id !== GRAVITRON) continue;
        const g = s.params.get(k);
        if (!g) break; // gravitron pas encore réglé
        let cap = 0;
        for (const [pk, pid] of s.blocks) if (pid === PHYSICS_ON) cap += Math.hypot(...(s.params.get(pk) || PHYS_DEFAULT));
        const sig = g.join(',');
        if (s.auto?.sig !== sig) s.auto = { sig, phase: 'start', t: 0, leg: 0, waitT: 0 };
        const { route, loop } = gravRoute(g), w = route[Math.min(s.auto.leg, route.length - 1)];
        s.pilot = { target: new THREE.Vector3(w.x, w.y, w.z), route, loop, mode: g[3] | 0, cap: Math.max(2, Math.min(MOTOR_MAX, cap)) };
        break;
      }
    }
  }

  // Vitesse voulue par le gravitron (ou null : moteur coupé, l'objet retombe)
  pilotVel(s, out) {
    const P = s.pilot, a = s.auto, T = P.target, pos = s.pos, cap = P.cap;
    const dx = T.x - pos.x, dz = T.z - pos.z, D = Math.hypot(dx, dz);
    const hx = D > 1e-3 ? dx / D : 0, hz = D > 1e-3 ? dz / D : 0;
    if (a.phase === 'done') return null;
    if (a.phase === 'start') { a.y0 = pos.y; a.D0 = D; a.phase = P.mode === GRAV_MISSILE ? 'climb' : 'go'; }
    if (P.mode === GRAV_MISSILE) {
      // monte en cloche, puis fonce sur la cible
      const apex = Math.min(H + 60, Math.max(a.y0, T.y) + Math.max(15, a.D0 * 0.45));
      if (a.phase === 'climb') {
        if (pos.y >= apex || D < 2) { a.phase = 'dive'; a.t = 0; }
        else return out.set(hx * cap * 0.35, cap * 0.8, hz * cap * 0.35);
      }
      return out.set(dx, T.y - pos.y, dz).normalize().multiplyScalar(cap);
    }
    if (P.mode === GRAV_PLANE) {
      // monte à son altitude de croisière, vole droit, puis descend en pente douce
      const cruise = Math.min(H + 30, Math.max(a.y0, T.y) + 12);
      const alt = T.y + Math.min(cruise - T.y, D * 0.35);
      const vy = Math.max(-cap * 0.5, Math.min(cap * 0.5, (alt - pos.y) * 1.5));
      // trop bas (il grimpe encore) : il avance moins vite pour ne pas heurter le relief
      const climb = alt - pos.y > 6 ? 0.4 : 1;
      const vh = Math.min(cap, D * 0.8) * climb;
      if (D < 0.4 && Math.abs(T.y - pos.y) < 0.4) return out.set(0, 0, 0); // arrivé : il reste là
      return out.set(hx * vh, vy, hz * vh);
    }
    // Bateau : seulement dans l'eau, et il s'arrête avant la rive
    if (!s.inWater || D < 0.6) return out.set(0, 0, 0);
    const probe = Math.max(1.5, s.radius - 0.5); // (un peu devant sa coque)
    const h = worldToHex(pos.x + hx * probe, pos.z + hz * probe), y = Math.floor(pos.y);
    const wet = [y + 1, y, y - 1].some((yy) => isWater(this.world.getBlock(h.q, h.r, yy)));
    a.shore = !wet; // (arrêté par la rive : pour un parcours, l'étape est atteinte)
    const v = wet ? Math.min(cap, D * 0.8) : 0;
    return out.set(hx * v, 0, hz * v);
  }

  // Parcours du gravitron (avion, bateau) : arrivé à une étape, il y reste le temps réglé, puis
  // repart vers la suivante ; à la fin, il recommence (boucle) ou reste à la dernière
  followRoute(s, dt) {
    const P = s.pilot, a = s.auto;
    if (a.end) return;
    if (a.waitT > 0) {
      a.waitT -= dt;
      if (a.waitT <= 0) this.nextLeg(s);
      return;
    }
    const T = P.target, D = Math.hypot(T.x - s.pos.x, T.z - s.pos.z);
    const there = P.mode === GRAV_BOAT
      ? D < 1.5 || (a.shore && Math.hypot(s.vel.x, s.vel.z) < 0.3)
      : D < 1 && Math.abs(T.y - s.pos.y) < 1;
    if (!there) return;
    const wait = P.route[a.leg].wait;
    if (wait > 0) a.waitT = wait; else this.nextLeg(s);
  }
  nextLeg(s) {
    const P = s.pilot, a = s.auto;
    a.waitT = 0;
    a.leg++;
    if (a.leg >= P.route.length) {
      if (!P.loop) { a.leg = P.route.length - 1; a.end = true; return; }
      a.leg = 0;
    }
    const w = P.route[a.leg];
    P.target.set(w.x, w.y, w.z);
    a.phase = 'start'; // (l'avion recalcule son altitude de croisière)
    a.shore = false;
  }

  // Allume la TNT (clé locale k) de l'objet : elle s'en détache et garde sa vitesse
  igniteTnt(s, k, fuse = null) {
    const id = s.blocks.get(k);
    if (!isTnt(id)) return false;
    const [q, r, y] = k.split(',').map(Number);
    const c = hexToWorld(q, r), w = this.toWorld(s, _b.set(c.x, y + 0.5, c.z), new THREE.Vector3());
    const vel = this.velAt(s, _c.subVectors(w, s.pos), new THREE.Vector3());
    s.fuses?.delete(k);
    this.setBlock(s, q, r, y, AIR);
    if (this.onTnt) this.onTnt(w.x, w.y - 0.5, w.z, vel, id, fuse);
    return true;
  }

  // Réglage du bloc physique de l'objet (clé locale "q,r,y")
  setParams(s, k, p) {
    s.params.set(k, p);
    this.updateMotor(s);
    this.wake(s);
  }

  // Points de contact : coins et centres des faces extérieures des blocs solides.
  // Les coins et milieux des côtés sont un peu rentrés dans leur bloc : un point posé
  // pile sur le bord d'une case ne serait ni dedans ni dehors (contact mal orienté).
  buildPoints(s) {
    const pts = new Map();
    // (les dalles ne comptent pas : à côté d'elles, la face reste en partie à l'air)
    const has = (q, r, y) => s.box(q, r, y) === FULL;
    const add = (x, y, z, grip) => {
      const k = Math.round(x * 1000) + ',' + Math.round(y * 1000) + ',' + Math.round(z * 1000);
      if (!pts.has(k)) pts.set(k, [x - s.com.x, y - s.com.y, z - s.com.z, grip]);
    };
    for (const [q, r, y, id] of s.list) {
      if (!SOLID[id]) continue;
      const c = hexToWorld(q, r), grip = blockGrip(id);
      const [lo, hi] = boxOf(id), slab = !!SLAB[id];
      for (let k = 0; k < 6; k++) {
        // coin partagé par cette case et les voisins k et k-1. Inutile si la couche du dessous
        // ou du dessus est pleine autour de lui : il est alors au milieu d'une face plate
        // (les centres des faces suffisent) ou à l'intérieur de l'objet.
        const [n1q, n1r] = NEIGHBORS[k], [n2q, n2r] = NEIGHBORS[(k + 5) % 6];
        const ring = (yy) => has(q, r, yy) && has(q + n1q, r + n1r, yy) && has(q + n2q, r + n2r, yy);
        for (const h of [y + lo, y + hi]) {
          const inner = !slab && (ring(h - 1) || ring(h));
          if (!inner) add(c.x + CORNERS[k][0] * INSET, h, c.z + CORNERS[k][1] * INSET, grip);
        }
        // milieu du côté k s'il est à l'air
        if (slab || !has(q + NEIGHBORS[k][0], r + NEIGHBORS[k][1], y)) {
          add(c.x + EDGE_NORMALS[k][0] * 0.5 * INSET, y + (lo + hi) / 2, c.z + EDGE_NORMALS[k][1] * 0.5 * INSET, grip);
        }
      }
      if (hi < 1 || !has(q, r, y + 1)) add(c.x, y + hi, c.z, grip);
      if (lo > 0 || !has(q, r, y - 1)) add(c.x, y + lo, c.z, grip);
    }
    s.pts = [...pts.values()];
    s.warm = new Map();
  }

  // Flotteurs : chaque bloc plein, plus l'air enfermé dans une coque (case vide entourée
  // sur les côtés par l'objet, avec un fond sous elle)
  buildFloaters(s) {
    const f = [];
    for (const [q, r, y, id] of s.list) {
      if (!SOLID[id]) continue;
      const c = hexToWorld(q, r);
      f.push([c.x - s.com.x, y + 0.5 - s.com.y, c.z - s.com.z]);
    }
    if (s.solid.size >= 5 && s.solid.size <= 6000) {
      let q0 = Infinity, q1 = -Infinity, r0 = Infinity, r1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const k of s.solid) {
        const [q, r, y] = k.split(',').map(Number);
        q0 = Math.min(q0, q); q1 = Math.max(q1, q); r0 = Math.min(r0, r); r1 = Math.max(r1, r); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      }
      if ((q1 - q0 + 3) * (r1 - r0 + 3) <= 20000) {
        const floor = new Map(); // (q, r) -> plus bas bloc de la colonne
        for (const k of s.solid) {
          const [q, r, y] = k.split(',').map(Number);
          const kk = q + ',' + r;
          floor.set(kk, Math.min(floor.get(kk) ?? Infinity, y));
        }
        for (let y = y0 + 1; y <= y1; y++) {
          // remplissage depuis l'extérieur de la boîte : ce qui n'est pas atteint est enfermé
          const out = new Set(), stack = [];
          for (let q = q0 - 1; q <= q1 + 1; q++) for (const r of [r0 - 1, r1 + 1]) stack.push([q, r]);
          for (let r = r0 - 1; r <= r1 + 1; r++) for (const q of [q0 - 1, q1 + 1]) stack.push([q, r]);
          while (stack.length) {
            const [q, r] = stack.pop();
            const kk = q + ',' + r;
            if (out.has(kk) || q < q0 - 1 || q > q1 + 1 || r < r0 - 1 || r > r1 + 1 || s.solid.has(key(q, r, y))) continue;
            out.add(kk);
            for (const [dq, dr] of NEIGHBORS) stack.push([q + dq, r + dr]);
          }
          for (let q = q0; q <= q1; q++) {
            for (let r = r0; r <= r1; r++) {
              if (out.has(q + ',' + r) || s.solid.has(key(q, r, y)) || !((floor.get(q + ',' + r) ?? Infinity) < y)) continue;
              const c = hexToWorld(q, r);
              f.push([c.x - s.com.x, y + 0.5 - s.com.y, c.z - s.com.z]);
            }
          }
        }
      }
    }
    s.buoy = f;
  }

  buildMesh(s) {
    for (const m of [...s.group.children]) { s.group.remove(m); m.geometry.dispose(); }
    s.lights = [];
    if (!s.list.length || s.unloaded) return;
    const a = buildStructArrays(s.list, this.world.uvTable);
    const w = this.world;
    if (a.opaque) {
      const m = new THREE.Mesh(withLight(geometryFrom(a.opaque)), w.material);
      m.castShadow = true;
      m.receiveShadow = true;
      s.group.add(m);
    }
    if (a.rails) {
      const m = new THREE.Mesh(withLight(geometryFrom(a.rails)), w.railMaterial);
      m.receiveShadow = true;
      s.group.add(m);
    }
    if (a.glow) s.group.add(new THREE.Mesh(geometryFrom(a.glow), w.glowMaterial));
    for (let i = 0; i < a.lights.length; i += 4) s.lights.push(a.lights.slice(i, i + 4));
    this.placeMesh(s);
    s.lightKey = null; // (lumière à recalculer, voir relight)
    this.relight(s);
  }

  // ---------- Lumière des objets ----------
  // Le terrain a sa lumière propagée (light.js) ; un objet bouge : sa lumière est calculée ici,
  // sommet par sommet, depuis les sources proches (torches, lampes, lave... du monde et des
  // objets, sans les murs) et le ciel (colonnes au-dessus de lui ouvertes ou non). Refaite
  // quand il a bougé, et de temps en temps (une torche a pu être posée).
  relight(s) {
    const meshes = s.group.children.filter((m) => m.geometry.attributes.light);
    if (!meshes.length) return;
    const R = s.radius + SOURCE_REACH;
    const sources = (this.lightSources?.(s.pos.x, s.pos.z, R) || []).filter((l) => (l.x - s.pos.x) ** 2 + (l.y - s.pos.y) ** 2 + (l.z - s.pos.z) ** 2 < R * R);
    const sky = this.skyAt(s);
    // rien n'a changé (même place, mêmes sources) : on garde
    const key = sources.map((l) => l.x.toFixed(1) + ',' + l.y.toFixed(1) + ',' + l.z.toFixed(1) + l.kind).join('|') + '#' + sky.toFixed(2) + '#' +
      (sources.length ? s.pos.x.toFixed(1) + ',' + s.pos.y.toFixed(1) + ',' + s.pos.z.toFixed(1) + ',' + s.quat.x.toFixed(2) + s.quat.y.toFixed(2) + s.quat.z.toFixed(2) : '');
    if (key === s.lightKey) return;
    s.lightKey = key;
    s.group.updateMatrixWorld(true);
    const p = new THREE.Vector3(), n = new THREE.Vector3(), rgb = [0, 0, 0];
    for (const m of meshes) {
      const pos = m.geometry.attributes.position, nor = m.geometry.attributes.normal, L = m.geometry.attributes.light;
      const arr = L.array;
      for (let i = 0; i < pos.count; i++) {
        rgb[0] = rgb[1] = rgb[2] = 0;
        if (sources.length) {
          p.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
          n.fromBufferAttribute(nor, i).applyQuaternion(s.quat);
          for (const l of sources) {
            const dx = l.x - p.x, dy = l.y - p.y, dz = l.z - p.z, d = Math.sqrt(dx * dx + dy * dy + dz * dz);
            // (plus forte sur les faces tournées vers la source, comme sur le terrain)
            const face = d > 0.05 ? Math.max(0, (dx * n.x + dy * n.y + dz * n.z) / d) * 0.55 + 0.45 : 1;
            sourceLight(l.kind, d, face, rgb);
          }
        }
        arr[i * 4] = Math.min(2, rgb[0]); arr[i * 4 + 1] = Math.min(2, rgb[1]); arr[i * 4 + 2] = Math.min(2, rgb[2]); arr[i * 4 + 3] = sky;
      }
      L.needsUpdate = true;
    }
  }

  // Ciel au-dessus de l'objet : part des colonnes ouvertes (rien d'opaque au-dessus) autour de
  // lui (centre et 6 points sur son bord), de 0,03 (sous terre) à 1 (à l'air libre)
  skyAt(s) {
    const w = this.world, top = Math.floor(s.pos.y + s.radius);
    if (top >= H) return 1;
    let open = 0, n = 0;
    const R = Math.max(0, s.radius - 1);
    for (let k = -1; k < 6; k++) {
      const x = s.pos.x + (k < 0 ? 0 : Math.cos(k * Math.PI / 3) * R), z = s.pos.z + (k < 0 ? 0 : Math.sin(k * Math.PI / 3) * R);
      const h = worldToHex(x, z);
      n++;
      let y = Math.max(0, top);
      while (y < H && !OPAQUE[w.getBlock(h.q, h.r, y)]) y++;
      if (y >= H) open++;
    }
    return 0.03 + 0.97 * (open / n);
  }

  placeMesh(s) {
    s.group.quaternion.copy(s.quat);
    this.origin(s, s.group.position);
  }

  remove(s) {
    this.ropes?.gone(s); // (les cordes accrochées restent où elles sont, dans le monde)
    this.wakeAround(s);
    for (const [k, h] of this.holds) if (h.s === s) this.holds.delete(k);
    this.disposeStruct(s);
    if (this.onChange) this.onChange(s, true);
  }

  disposeStruct(s) {
    for (const m of s.group.children) m.geometry.dispose();
    this.scene.remove(s.group);
    this.list = this.list.filter((x) => x !== s);
  }

  clear() {
    for (const s of [...this.list]) this.disposeStruct(s);
    this.list = [];
    this.holds.clear();
    this.clearGlue();
  }

  changed(s) { if (this.onChange) this.onChange(s, false); }
  // (un objet porté par un train, voir trains.js : jamais réveillé, la physique ne le bouge pas ;
  // il sert d'appui fixe aux autres, et le train le place lui-même à chaque image)
  wake(s) {
    if (s.kinematic) return;
    if (s.unloaded) { s.wakeOnLoad = true; return; } // (il reprendra en se rechargeant)
    s.sleeping = false; s.still = 0;
  }

  // Décharge les objets trop loin de tous les joueurs, recharge ceux revenus à portée.
  // Un objet déchargé reste dans la liste (il est sauvegardé), figé avec sa vitesse : il
  // repart comme il était. (Le terrain hors des chunks chargés vient du générateur : il
  // retrouve le même sol en revenant.)
  updateLoaded(players, view) {
    if (!view) return;
    for (const s of this.list) {
      let d = Infinity;
      for (const p of players) if (p?.pos) d = Math.min(d, Math.hypot(s.pos.x - p.pos.x, s.pos.z - p.pos.z));
      const reach = view + s.radius;
      if (!s.unloaded && d > reach + UNLOAD_MARGIN) {
        s.unloaded = true;
        s.wakeOnLoad = !s.sleeping;
        s.sleeping = true;
        s.physPos = s.lastPos = null;
        for (const m of [...s.group.children]) { s.group.remove(m); m.geometry.dispose(); }
        s.lights = [];
        s.group.visible = false;
      } else if (s.unloaded && d < reach) {
        s.unloaded = false;
        s.group.visible = true;
        this.buildMesh(s);
        if (s.wakeOnLoad) this.wake(s);
        s.wakeOnLoad = false;
      }
    }
  }

  // Nombre d'objets chargés (affichage de débogage)
  get loadedCount() { return this.list.filter((s) => !s.unloaded).length; }
  // réveille les objets qui touchent peut-être celui-ci (ce qui était posé dessus tombe)
  wakeAround(s) {
    for (const o of this.list) {
      if (o !== s && o.sleeping && o.pos.distanceToSquared(s.pos) < (o.radius + s.radius + 0.5) ** 2) this.wake(o);
    }
  }

  // Pose / retire un bloc de l'objet (coordonnées locales). id = AIR pour casser.
  setBlock(s, q, r, y, id) {
    const k = key(q, r, y);
    if (id === AIR) {
      if (!s.blocks.has(k)) return false;
      const was = BLOCKS[s.blocks.get(k)];
      s.blocks.delete(k);
      // (lit de villageois : l'autre moitié s'en va avec)
      if (was?.pod !== undefined) {
        const other = key(q, r, was.podTop ? y - 1 : y + 1);
        if (isPod(s.blocks.get(other))) s.blocks.delete(other);
      }
      // un rail ou une torche posé dessus tombe avec
      const above = key(q, r, y + 1);
      if (ATTACHED[s.blocks.get(above)]) s.blocks.delete(above);
    } else {
      const cur = s.blocks.get(k);
      // (une dalle posée dans la moitié vide d'une dalle : les deux se complètent)
      if (cur && SLAB[cur] && SLAB[id] && !BLOCKS[cur].unbreakable) {
        const both = slabCombine(cur, id);
        if (!both) return false;
        s.blocks.set(k, both);
        this.wake(s);
        this.afterEdit(s);
        return true;
      }
      if (s.blocks.has(k) || !BLOCKS[id] || isWater(id) || s.blocks.size >= MAX_BLOCKS) return false;
      if (ATTACHED[id] && !s.solid.has(key(q, r, y - 1))) return false;
      // (lit de villageois : le haut vient avec le bas, s'il y a la place)
      if (BLOCKS[id].pod !== undefined) {
        if (BLOCKS[id].podTop || s.blocks.has(key(q, r, y + 1))) return false;
        s.blocks.set(key(q, r, y + 1), POD_TOP + BLOCKS[id].pod);
      }
      s.blocks.set(k, id);
    }
    this.wake(s);
    this.afterEdit(s);
    return true;
  }

  // Après une modification : objet vide supprimé, morceaux séparés = objets séparés
  afterEdit(s) {
    this.wakeAround(s);
    // un rail ou une torche sans support se détache
    for (const [k, id] of [...s.blocks]) {
      if (!ATTACHED[id]) continue;
      const [q, r, y] = k.split(',').map(Number);
      if (!SOLID[s.blocks.get(key(q, r, y - 1))]) s.blocks.delete(k);
    }
    if (!s.blocks.size) { this.remove(s); return; }
    const parts = this.split(s);
    if (parts.length <= 1) { this.refresh(s); this.changed(s); return; }
    // le plus gros morceau garde l'objet, les autres deviennent de nouveaux objets (porté par un
    // train : le morceau qui contient le plateau du wagon le garde, toujours)
    parts.sort((a, b) => b.length - a.length);
    if (s.kinematic) parts.sort((a, b) => b.some(([, , , id]) => BLOCKS[id]?.deck) - a.some(([, , , id]) => BLOCKS[id]?.deck));
    const origin = this.origin(s, new THREE.Vector3());
    const pos0 = s.pos.clone(), vel0 = s.vel.clone(), ang0 = s.ang.clone();
    s.blocks.clear();
    for (const [q, r, y, id] of parts[0]) s.blocks.set(key(q, r, y), id);
    this.refresh(s);
    this.changed(s);
    for (const part of parts.slice(1)) {
      const n = this.create(++this.nextId, origin.x, origin.y, origin.z, s.quat, part);
      for (const [q, r, y, id] of part) {
        const p = s.params.get(key(q, r, y));
        if (p) n.params.set(key(q, r, y), p);
        // morceau détaché : ses coffres et fours le suivent
        if (BLOCKS[id]?.container) this.onMoveBox?.('S' + s.id + ':' + key(q, r, y), 'S' + n.id + ':' + key(q, r, y));
      }
      this.ropes?.split(s, n);
      this.updateMotor(n);
      n.ang.copy(ang0);
      n.vel.copy(vel0).add(_a.crossVectors(ang0, _b.subVectors(n.pos, pos0)));
      this.wake(n);
      this.changed(n);
    }
  }

  split(s) {
    const left = new Map(s.blocks), parts = [];
    while (left.size) {
      const [k0] = left.keys();
      const stack = [k0.split(',').map(Number)], part = [];
      const id0 = left.get(k0);
      left.delete(k0);
      part.push([...stack[0], id0]);
      while (stack.length) {
        const [q, r, y] = stack.pop();
        for (const [dq, dr, dy] of AROUND) {
          const k = key(q + dq, r + dr, y + dy);
          if (!left.has(k)) continue;
          const id = left.get(k);
          left.delete(k);
          part.push([q + dq, r + dr, y + dy, id]);
          stack.push([q + dq, r + dr, y + dy]);
        }
      }
      parts.push(part);
    }
    return parts;
  }

  // ---------- Repères ----------
  // Origine de la grille locale dans le monde
  origin(s, out) {
    return out.copy(s.com).applyQuaternion(s.quat).negate().add(s.pos);
  }

  // Centre de la case [q, r, y] de la grille locale [x, y, z]
  cellCenter([q, r, y]) {
    const c = hexToWorld(q, r);
    return [c.x, y + 0.5, c.z];
  }

  // Point de la grille locale -> monde
  toWorld(s, local, out) {
    return out.copy(local).sub(s.com).applyQuaternion(s.quat).add(s.pos);
  }

  // Point du monde -> grille locale
  toLocal(s, world, out, pos = s.pos, quat = s.quat) {
    return out.copy(world).sub(pos).applyQuaternion(_q.copy(quat).invert()).add(s.com);
  }

  updateFrame(s) {
    s.rot.setFromMatrix4(_m.makeRotationFromQuaternion(s.quat));
    s.rotT.copy(s.rot).transpose();
    s.Iw.copy(s.rot).multiply(s.IbInv).multiply(s.rotT);
  }

  // Vitesse du point situé à r (monde, relatif au centre de gravité)
  // Objet dont un bloc plein occupe le point (x, y, z) du monde (ou null) ; vel reçoit la
  // vitesse de l'objet en ce point (TNT posée dessus, voir tnt.js)
  solidAt(x, y, z, vel = null) {
    const P = _d.set(x, y, z);
    for (const s of this.list) {
      if (s.pos.distanceToSquared(P) > (s.radius + 1) ** 2) continue;
      const L = this.toLocal(s, P, _e);
      const h = worldToHex(L.x, L.z), yy = Math.floor(L.y);
      if (!inBox(s.box(h.q, h.r, yy), L.y - yy)) continue;
      if (!this.inPart(s, h.q, h.r, yy, L)) continue;
      if (vel) this.velAt(s, _c.subVectors(P, s.pos), vel);
      return s;
    }
    return null;
  }

  velAt(s, r, out) {
    return out.crossVectors(s.ang, r).add(s.vel);
  }

  // Impulsion J (monde) appliquée au point r (relatif au centre de gravité)
  impulse(s, J, r) {
    if (s.isCart) {
      // Hexacart : pas de rotation ; sur un rail, il ne bouge que le long de la voie
      if (s.railT) s.vel.addScaledVector(s.railT, s.railT.dot(J) * s.invMass);
      else s.vel.addScaledVector(J, s.invMass);
      return;
    }
    s.vel.addScaledVector(J, s.invMass);
    s.ang.add(_e.crossVectors(r, J).applyMatrix3(s.Iw));
  }

  // Inverse de la masse en translation dans la direction n (sur un rail : seulement le
  // long de la voie ; de côté, c'est le rail qui encaisse)
  linInv(s, n) {
    return s.isCart && s.railT ? s.invMass * s.railT.dot(n) ** 2 : s.invMass;
  }

  // Inverse de la masse vue par le point r dans la direction n
  invMassAt(s, r, n) {
    if (s.isCart) return this.linInv(s, n);
    _e.crossVectors(r, n).applyMatrix3(s.Iw);
    _d.crossVectors(_e, r);
    return s.invMass + n.dot(_d);
  }

  // Force appliquée pendant dt au point p (monde) : réveille l'objet
  push(s, force, p, dt) {
    this.wake(s);
    _c.subVectors(p, s.pos);
    this.impulse(s, _a.copy(force).multiplyScalar(dt), _c);
  }

  // ---------- Physique ----------
  update(dt, ctx) {
    this.updateLoaded([ctx.player, ...(ctx.others || [])], ctx.view);
    for (const s of this.list) {
      // (porté par un train : sa position d'avant est celle d'avant le déplacement du train)
      if (s.kinematic && s.kinPrevPos) { s.prevPos.copy(s.kinPrevPos); s.prevQuat.copy(s.kinPrevQuat); continue; }
      s.prevPos.copy(s.pos); s.prevQuat.copy(s.quat);
    }
    if (this.remote) {
      const k = 1 - Math.exp(-dt * 15);
      const o = new THREE.Vector3();
      for (const s of this.list) {
        if (!s.tOrigin) continue;
        this.origin(s, o);
        if (o.distanceToSquared(s.tOrigin) > 25) o.copy(s.tOrigin); else o.lerp(s.tOrigin, k);
        s.quat.slerp(s.tQuat, k);
        s.pos.copy(s.com).applyQuaternion(s.quat).add(o);
        this.updateFrame(s);
      }
    } else {
      // les joueurs distants poussent aussi (hôte)
      for (const p of ctx.others || []) this.pushBy(p, dt);
      // Physique à rythme fixe (60 pas/s), quel que soit le nombre d'images par seconde :
      // à 240 i/s elle ne coûte pas 4 fois plus et se comporte pareil. Entre deux pas,
      // l'affichage (et les collisions du joueur) suivent une position lissée.
      for (const s of this.list) if (s.physPos && !s.kinematic) { s.pos.copy(s.physPos); s.quat.copy(s.physQuat); }
      this.acc = Math.min((this.acc || 0) + dt, FIXED_DT * MAX_FRAME_STEPS);
      while (this.acc >= FIXED_DT) {
        this.acc -= FIXED_DT;
        this.fixedStep(FIXED_DT);
      }
      const a = this.acc / FIXED_DT;
      for (const s of this.list) {
        (s.physPos ||= new THREE.Vector3()).copy(s.pos);
        (s.physQuat ||= new THREE.Quaternion()).copy(s.quat);
        if (s.lastPos && !s.sleeping) {
          s.pos.lerpVectors(s.lastPos, s.physPos, a);
          s.quat.slerpQuaternions(s.lastQuat, s.physQuat, a);
        }
      }
    }
    // trop haut : plus d'énergie (voir ALT_MAX)
    if (!this.remote) for (const s of this.list) if (!s.sleeping && s.pos.y > ALT_MAX) this.cutPower(s);
    this.lightClock = (this.lightClock || 0) - dt;
    const relightAll = this.lightClock <= 0;
    if (relightAll) this.lightClock = LIGHT_EVERY;
    for (const s of this.list) {
      this.placeMesh(s);
      s.moved = s.pos.distanceToSquared(s.prevPos) > 1e-10 || 1 - Math.abs(s.quat.dot(s.prevQuat)) > 1e-10;
      if (s.unloaded) continue;
      // (un objet qui bouge : 8 fois par seconde au plus, il est vite dans la lumière)
      s.lightT = (s.lightT || 0) - dt;
      if (relightAll || (s.moved && s.lightT <= 0)) { s.lightT = 0.125; this.relight(s); }
    }
    // le joueur attaché à un objet (monté dessus, voir collidePlayer) est emporté avec lui
    // et tourne avec lui ; sa vitesse à lui est comptée par rapport à l'objet
    const p = ctx.player;
    const s = p?.attached;
    if (s && this.list.includes(s) && !p.riding && s.moved) {
      const L = this.toLocal(s, p.pos, new THREE.Vector3(), s.prevPos, s.prevQuat);
      this.toWorld(s, L, p.pos);
      const a0 = _a.set(1, 0, 0).applyQuaternion(s.prevQuat), a1 = _b.set(1, 0, 0).applyQuaternion(s.quat);
      let d = Math.atan2(-a1.z, a1.x) - Math.atan2(-a0.z, a0.x);
      d = ((d + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      if (Math.abs(d) < 0.5) p.yaw += d;
    }
  }

  // Un pas fixe de la simulation (voir update)
  fixedStep(dt) {
    if (this.spinQueue?.length) this.spinUp();
    for (const s of this.list) {
      (s.lastPos ||= new THREE.Vector3()).copy(s.pos);
      (s.lastQuat ||= new THREE.Quaternion()).copy(s.quat);
    }
    this.wakeByCarts();
    for (const s of this.list) if (s.sleeping && (s.motor || s.stab && (1 - Math.abs(_e.set(0, 1, 0).applyQuaternion(s.quat).y)) > 0.01 || (s.onSea && sea.amp > SEA_AWAKE))) this.wake(s);
    const awake = this.list.filter((s) => !s.sleeping);
    if (!awake.length) return;
    let speed = 0;
    for (const s of awake) speed = Math.max(speed, s.vel.length() + s.ang.length() * s.radius);
    const steps = Math.min(MAX_STEPS, Math.max(Math.ceil(dt / H_STEP), Math.ceil(dt * speed / 0.25)));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) this.step(h);
    for (const s of [...this.list]) {
      if (s.pilot && s.pilot.route.length > 1 && s.pilot.mode !== GRAV_MISSILE) this.followRoute(s, dt);
      // missile : arrivé sur la cible (ou arrêté net par un obstacle), sa TNT explose
      const a = s.auto;
      if (s.pilot?.mode === GRAV_MISSILE && a?.phase === 'dive') {
        a.t += dt;
        const near = s.pos.distanceTo(s.pilot.target) < 2.5;
        if (s.vel.length() < s.pilot.cap * 0.3 && a.t > 0.6) a.stuck = (a.stuck || 0) + dt; else a.stuck = 0;
        if (near || a.stuck > 0.15) {
          a.phase = 'done';
          for (const [k, id] of [...s.blocks]) if (isTnt(id)) (s.fuses ||= new Set()).add(k);
          s.boom = true; // (TNT : explosion immédiate)
        }
      }
      if (s.fuses?.size) {
        const fuse = s.boom ? 0.05 : null;
        s.boom = false;
        for (const k of [...s.fuses]) { if (!this.list.includes(s)) break; this.igniteTnt(s, k, fuse); }
        s.fuses.clear();
      }
      if (s.sleeping || !this.list.includes(s)) continue;
      if (s.pos.y < -DEPTH - 40) { this.remove(s); continue; }
      // au repos assez longtemps : il s'endort (plus aucun calcul)
      // (sur une mer agitée, il ne s'endort pas : les vagues le bercent)
      if (s.vel.lengthSq() < 0.01 && s.ang.lengthSq() < 0.01 && !this.isHeld(s) && !s.motor && !s.hinge?.w && !(s.onSea && sea.amp > SEA_AWAKE)) s.still += dt; else s.still = 0;
      if (s.still > 0.6) {
        s.vel.set(0, 0, 0); s.ang.set(0, 0, 0);
        s.sleeping = true;
        this.changed(s); // position de repos transmise
      }
    }
  }

  step(h) {
    this.h = h;
    const awake = this.list.filter((s) => !s.sleeping);
    const cartBodies = this.cartBodies();
    // forces : gravité, poussée d'Archimède, traînée de l'eau
    for (const s of awake) {
      this.updateFrame(s);
      const m = s.pilot ? this.pilotVel(s, this._pv ||= new THREE.Vector3()) : s.motor;
      if (m) {
        // moteur : la gravité est compensée, la vitesse rejoint celle réglée (ou voulue par le
        // gravitron), et la rotation parasite s'amortit (l'objet garde son cap). Le bateau,
        // lui, reste soumis à la gravité : il flotte.
        const k = Math.min(1, MOTOR_GAIN * h);
        s.vel.x += (m.x - s.vel.x) * k;
        if (s.pilot?.mode === GRAV_BOAT) s.vel.y -= G * h;
        else s.vel.y += (m.y - s.vel.y) * k;
        s.vel.z += (m.z - s.vel.z) * k;
        s.ang.multiplyScalar(1 - k);
      } else s.vel.y -= G * h;
      this.water(s, h);
      if (s.stab) this.stabilize(s, h);
    }
    this.applyHolds(h);
    // cordes : un bout trop loin de l'autre est retenu (voir ropes.js)
    this.ropes?.solve(h);
    // contacts
    const cs = this.contacts;
    cs.length = 0;
    for (const s of awake) if (!s.hinge) this.worldContacts(s, cs); // (un rotor suit son pivot : pas de contacts)
    // Hexacarts contre objets collés
    for (const cb of cartBodies) for (const s of cb.near) this.cartContacts(cb, s, cs);
    for (let i = 0; i < this.list.length; i++) {
      for (let j = i + 1; j < this.list.length; j++) {
        const A = this.list[i], B = this.list[j];
        if (A.sleeping && B.sleeping) continue;
        if (A.hinge?.base === B.id || B.hinge?.base === A.id || (A.hinge && B.hinge)) continue; // (rotor et son support, deux rotors)
        if (A.pos.distanceToSquared(B.pos) > (A.radius + B.radius) ** 2) continue;
        const n0 = cs.length;
        this.pairContacts(A, B, cs);
        // dans l'autre sens, seulement les contacts d'une autre orientation (arêtes,
        // coins) : deux faces à plat compteraient double et la pile se mettrait à glisser
        const n1 = cs.length;
        this.pairContacts(B, A, cs);
        if (n1 > n0) {
          let k = n1;
          for (let i = n1; i < cs.length; i++) {
            let dup = false;
            for (let j = n0; j < n1 && !dup; j++) dup = cs[j].n.dot(cs[i].n) < -0.95;
            if (!dup) cs[k++] = cs[i];
          }
          cs.length = k;
        }
        if (cs.length > n0) {
          // un objet endormi ne se réveille que si l'autre arrive vraiment dessus ;
          // sinon il sert d'appui fixe (une pile au repos peut s'endormir)
          const S = A.sleeping ? A : B.sleeping ? B : null;
          const other = S === A ? B : A;
          if (S && (other.vel.lengthSq() > 0.25 || other.ang.lengthSq() > 0.25)) { this.wake(S); this.updateFrame(S); }
          else if (S) {
            for (let i = n0; i < cs.length; i++) {
              const c = cs[i];
              if (c.a === S) { c.a = c.b; c.ra = c.rb; c.n.negate(); c.ck = null; }
              c.b = null;
            }
          }
        }
      }
    }
    // préparation : masse effective, rebond
    let iters = ITER;
    for (const c of cs) {
      let k = this.invMassAt(c.a, c.ra, c.n);
      if (c.b) k += this.invMassAt(c.b, c.rb, c.n);
      c.kn = 1 / k;
      const vn = this.relVel(c, _a).dot(c.n);
      // contact anticipé (d < 0) : il peut encore se rapprocher de l'écart pendant ce pas.
      // Pas de rebond : des blocs qui se heurtent ne rebondissent (presque) pas.
      c.bias = c.d < 0 ? c.d / h : 0;
      // choc : bien plus de passes, pour que tous les points encaissent ensemble
      if (vn < -1.5 && !this.isHeld(c.a) && !(c.b && this.isHeld(c.b))) iters = ITER_IMPACT;
      c.push = CORRECT * Math.max(0, c.d - SLOP) / h;
      // on repart des impulsions du pas précédent (même point, même contact) : les appuis
      // se répartissent bien entre tous les points au lieu de tout faire porter au premier
      const warm = c.ck && c.a.warm.get(c.ck);
      if (warm) {
        c.jn = warm[0] * WARM;
        c.jt.set(warm[1], warm[2], warm[3]).multiplyScalar(WARM);
        c.jt.addScaledVector(c.n, -c.jt.dot(c.n));
        this.apply(c, _b.copy(c.n).multiplyScalar(c.jn).add(c.jt));
      }
    }
    // vitesses : contact (jamais attractif) + frottement de Coulomb
    // budget : beaucoup de contacts = moins de passes (pas de ralentissement)
    iters = Math.max(4, Math.min(iters, Math.floor(ITER_BUDGET / Math.max(1, cs.length))));
    for (let it = 0; it < iters; it++) {
      // un passage dans un sens, le suivant dans l'autre (pas de côté favorisé)
      for (let ci = 0; ci < cs.length; ci++) {
        const c = cs[it & 1 ? cs.length - 1 - ci : ci];
        const vr = this.relVel(c, _a);
        const vn = vr.dot(c.n);
        const old = c.jn;
        c.jn = Math.max(0, old + (c.bias - vn) * c.kn);
        const dj = c.jn - old;
        if (dj) this.apply(c, _b.copy(c.n).multiplyScalar(dj));
        // frottement : impulsion tangentielle cumulée, limitée à mu * impulsion normale
        this.relVel(c, vr);
        vr.addScaledVector(c.n, -vr.dot(c.n));
        const vt = vr.length();
        if (vt < 1e-6) continue;
        const t = _c.copy(vr).divideScalar(vt);
        let k = this.invMassAt(c.a, c.ra, t);
        if (c.b) k += this.invMassAt(c.b, c.rb, t);
        const prev = _d.copy(c.jt);
        c.jt.addScaledVector(t, -vt / k);
        const lim = c.mu * c.jn, l = c.jt.length();
        if (l > lim) c.jt.multiplyScalar(lim / l);
        this.apply(c, prev.subVectors(c.jt, prev));
      }
    }
    for (const s of this.list) if (!s.sleeping) { s.warm = new Map(); s.resting = false; }
    for (const c of cs) {
      if (c.ck) c.a.warm.set(c.ck, [c.jn, c.jt.x, c.jt.y, c.jt.z]);
      if (c.jn > 0) { c.a.resting = true; if (c.b) c.b.resting = true; }
    }
    // appui presque immobile : les petits tremblements du calcul sont amortis (sinon une
    // pile finirait par glisser toute seule) ; un vrai basculement va bien plus vite
    for (const s of this.list) {
      if (s.sleeping || !s.resting || s.inWater || this.isHeld(s)) continue;
      if (s.vel.lengthSq() < REST_V * REST_V && s.ang.lengthSq() < REST_W * REST_W) {
        s.vel.multiplyScalar(REST_DAMP);
        s.ang.multiplyScalar(REST_DAMP);
      }
    }
    // enfoncement : l'objet est ressorti par un simple déplacement (sans le faire tourner :
    // corriger aussi la rotation ferait pencher les piles petit à petit). Vitesses
    // « fantômes » : cette correction ne rajoute pas d'énergie.
    for (let it = 0; it < 4; it++) {
      for (let ci = 0; ci < cs.length; ci++) {
        const c = cs[it & 1 ? cs.length - 1 - ci : ci];
        if (c.d <= 0) continue;
        let vn = c.a.pv.dot(c.n), k = this.linInv(c.a, c.n);
        if (c.b) { vn -= c.b.pv.dot(c.n); k += this.linInv(c.b, c.n); }
        if (k <= 0) continue;
        const old = c.jp || 0;
        c.jp = Math.max(0, old + (c.push - vn) / k);
        const dj = c.jp - old;
        if (!dj) continue;
        this.pseudoPush(c.a, c.n, dj);
        if (c.b) this.pseudoPush(c.b, c.n, -dj);
      }
    }
    // les Hexacarts touchés reprennent leur nouvelle vitesse
    for (const cb of cartBodies) this.writeCart(cb, h);
    // intégration
    for (const s of this.list) {
      if (s.sleeping) continue;
      if (s.ang.lengthSq() > MAX_ANG * MAX_ANG) s.ang.setLength(MAX_ANG);
      s.pos.addScaledVector(s.vel, h).addScaledVector(s.pv, h);
      const w = _a.copy(s.ang).add(s.pw);
      const wl = w.length();
      if (wl > 1e-9) {
        _q.setFromAxisAngle(w.divideScalar(wl), wl * h);
        s.quat.premultiply(_q).normalize();
      }
      s.pv.set(0, 0, 0);
      s.pw.set(0, 0, 0);
    }
    for (const s of this.list) if (s.hinge) this.turnRotor(s, h);
  }

  relVel(c, out) {
    this.velAt(c.a, c.ra, out);
    if (c.b) out.sub(this.velAt(c.b, c.rb, _e));
    return out;
  }

  apply(c, J) {
    this.impulse(c.a, J, c.ra);
    if (c.b) this.impulse(c.b, J.negate(), c.rb), J.negate();
  }

  // Contacts des points de l'objet avec les blocs solides du monde
  worldContacts(s, out) {
    const w = this.world, p = _a, r = new THREE.Vector3(), mv = new THREE.Vector3(), box = worldBox(w);
    s.inGround = false;
    for (let i = 0; i < s.pts.length; i++) {
      const [x, y, z, grip] = s.pts[i];
      p.set(x, y, z).applyMatrix3(s.rot).add(s.pos);
      const hx = worldToHex(p.x, p.z), yy = Math.floor(p.y);
      const id = w.getBlock(hx.q, hx.r, yy), b = box(hx.q, hx.r, yy);
      if (!inBox(b, p.y - yy)) {
        // juste au-dessus d'un bloc (ou d'une dalle basse) : contact anticipé (le point peut
        // encore descendre de l'écart, pas plus) — une pile posée ne bascule pas d'avant en arrière
        const low = b && b[1] < 1 && p.y - yy > b[1];
        const gap = low ? p.y - yy - b[1] : p.y - yy;
        if (gap < MARGIN && (low || box(hx.q, hx.r, yy - 1)?.[1] === 1)) {
          out.push({
            a: s, b: null, n: new THREE.Vector3(0, 1, 0), d: -gap, mu: Math.sqrt(grip * blockGrip(low ? id : w.getBlock(hx.q, hx.r, yy - 1))),
            ra: new THREE.Vector3(p.x - s.pos.x, p.y - s.pos.y, p.z - s.pos.z), jn: 0, jt: new THREE.Vector3(), ck: 'w' + i,
          });
        }
        continue;
      }
      const c = hexToWorld(hx.q, hx.r);
      // déplacement du point pendant ce pas : pour savoir par quelle face il est entré
      this.velAt(s, r.subVectors(p, s.pos), mv).multiplyScalar(this.h);
      const res = this.faceOut(p.x - c.x, p.y - yy, p.z - c.z, fullFn(box, hx.q, hx.r, yy, b[0], b[1]), mv, b[0], b[1]);
      out.push({
        a: s, b: null, n: res.n, d: res.d, mu: Math.sqrt(grip * blockGrip(id)),
        ra: new THREE.Vector3(p.x - s.pos.x, p.y - s.pos.y, p.z - s.pos.z), jn: 0, jt: new THREE.Vector3(), ck: 'w' + i,
      });
    }
  }

  // Points de A qui entrent dans les blocs solides de B
  pairContacts(A, B, out) {
    const p = _a, L = _b, ra = new THREE.Vector3(), rb = new THREE.Vector3(), mv = new THREE.Vector3(), vb = new THREE.Vector3();
    const qi = new THREE.Quaternion().copy(B.quat).invert();
    for (let i = 0; i < A.pts.length; i++) {
      const [x, y, z, grip] = A.pts[i];
      p.set(x, y, z).applyMatrix3(A.rot).add(A.pos);
      if (p.distanceToSquared(B.pos) > B.radius * B.radius) continue;
      L.copy(p).sub(B.pos).applyQuaternion(qi).add(B.com);
      const hx = worldToHex(L.x, L.z), yy = Math.floor(L.y), b = B.box(hx.q, hx.r, yy), fy = L.y - yy;
      if (!inBox(b, fy)) {
        // juste au-dessus (ou au-dessous) d'un bloc de B : contact anticipé
        // (dalle : sa face libre est dans la même case)
        const k = key(hx.q, hx.r, yy), below = key(hx.q, hx.r, yy - 1), above = key(hx.q, hx.r, yy + 1);
        let up = fy, down = 1 - fy, kb = below, ka = above;
        let side = up < MARGIN && B.box(hx.q, hx.r, yy - 1)?.[1] === 1 ? 1 : down < MARGIN && B.box(hx.q, hx.r, yy + 1)?.[0] === 0 ? -1 : 0;
        if (b && fy > b[1] && fy - b[1] < MARGIN) { side = 1; up = fy - b[1]; kb = k; }
        else if (b && fy < b[0] && b[0] - fy < MARGIN) { side = -1; down = b[0] - fy; ka = k; }
        if (side) {
          out.push({
            a: A, b: B, n: new THREE.Vector3(0, side, 0).applyQuaternion(B.quat), d: -(side > 0 ? up : down),
            mu: Math.sqrt(grip * blockGrip(B.blocks.get(side > 0 ? kb : ka))),
            ra: new THREE.Vector3().subVectors(p, A.pos), rb: new THREE.Vector3().subVectors(p, B.pos),
            jn: 0, jt: new THREE.Vector3(), ck: B.id + ':' + i,
          });
        }
        continue;
      }
      const c = hexToWorld(hx.q, hx.r);
      // déplacement relatif du point pendant ce pas, dans le repère de B
      this.velAt(A, ra.subVectors(p, A.pos), mv).sub(this.velAt(B, rb.subVectors(p, B.pos), vb));
      mv.applyQuaternion(qi).multiplyScalar(this.h);
      const res = this.faceOut(L.x - c.x, L.y - yy, L.z - c.z, fullFn(B.box, hx.q, hx.r, yy, b[0], b[1]), mv, b[0], b[1]);
      res.n.applyQuaternion(B.quat);
      out.push({
        a: A, b: B, n: res.n, d: res.d, mu: Math.sqrt(grip * blockGrip(B.blocks.get(key(hx.q, hx.r, yy)))),
        ra: new THREE.Vector3().subVectors(p, A.pos), rb: new THREE.Vector3().subVectors(p, B.pos),
        jn: 0, jt: new THREE.Vector3(), ck: B.id + ':' + i,
      });
    }
  }

  // Point (dx, dy, dz) à l'intérieur d'une case (relatif au centre du bas) : par quelle face
  // libre le faire sortir ? full(dq, dr, dy) : la case voisine est-elle pleine ?
  // mv : déplacement du point pendant le dernier pas. S'il vient d'entrer, on le ressort par
  // la face qu'il a traversée (un coin qui s'enfonce en tombant ressort par le haut, pas
  // par le côté) ; sinon par la face la plus proche. lo, hi : hauteur occupée (dalles).
  faceOut(dx, dy, dz, full, mv, lo = 0, hi = 1) {
    const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
    const topFree = hi < 1 || !full(0, 0, 1), bottomFree = lo > 0 || !full(0, 0, -1);
    if (mv) {
      const px = dx - mv.x, py = dy - mv.y, pz = dz - mv.z;
      if (py >= hi - 1e-3 && topFree) return { n: V3(0, 1, 0), d: Math.max(0, hi - dy) };
      if (py <= lo + 1e-3 && bottomFree) return { n: V3(0, -1, 0), d: Math.max(0, dy - lo) };
      for (let i = 0; i < 6; i++) {
        const [ex, ez] = EDGE_NORMALS[i];
        if (px * ex + pz * ez >= 0.5 - 1e-3 && !full(NEIGHBORS[i][0], NEIGHBORS[i][1], 0)) {
          return { n: V3(ex, 0, ez), d: Math.max(0, 0.5 - (dx * ex + dz * ez)) };
        }
      }
    }
    let best = Infinity, n = null;
    if (topFree && hi - dy < best) { best = hi - dy; n = [0, 1, 0]; }
    if (bottomFree && dy - lo < best) { best = dy - lo; n = [0, -1, 0]; }
    for (let i = 0; i < 6; i++) {
      const [ex, ez] = EDGE_NORMALS[i];
      const d = 0.5 - (dx * ex + dz * ez);
      if (d + SIDE_BIAS < best && !full(NEIGHBORS[i][0], NEIGHBORS[i][1], 0)) { best = d + SIDE_BIAS; n = [ex, 0, ez]; }
    }
    if (n && n[1] === 0) best -= SIDE_BIAS;
    if (!n) { best = hi - dy; n = [0, 1, 0]; } // enfoui : on remonte
    return { n: new THREE.Vector3(n[0], n[1], n[2]), d: Math.max(0, best) };
  }

  // Eau : poussée d'Archimède et traînée, bloc par bloc (d'où le roulis et le tangage).
  // En pleine mer, la surface suit les vagues (waves.js, comme à l'écran) : l'objet monte et
  // descend avec elles, et tangue.
  water(s, h) {
    const w = this.world, p = _c, r = new THREE.Vector3(), v = new THREE.Vector3(), J = new THREE.Vector3();
    s.inWater = false;
    s.onSea = false;
    const level = (q, rr, y) => {
      if (!isWater(w.getBlock(q, rr, y))) return null;
      let top = y;
      while (top < y + 3 && isWater(w.getBlock(q, rr, top + 1))) top++;
      const surf = isWater(w.getBlock(q, rr, top + 1)) ? top + 1 : top + waterHeight(w.getBlock(q, rr, top));
      if (sea.amp < 0.01) return surf;
      // vagues : seulement en eau profonde (même profondeur comptée que pour l'affichage)
      let depth = 0;
      while (depth < 12 && isWater(w.getBlock(q, rr, top - depth))) depth++;
      const k = seaFactor(depth);
      if (k > 0.3) s.onSea = true;
      return k > 0 ? surf + waveHeight(p.x, p.z) * k : surf;
    };
    for (const [x, y, z] of s.buoy) {
      r.set(x, y, z).applyMatrix3(s.rot);
      p.copy(r).add(s.pos);
      const bottom = p.y - 0.5, yb = Math.floor(bottom);
      const hx = worldToHex(p.x, p.z);
      let f = 0;
      const l0 = level(hx.q, hx.r, yb);
      if (l0 !== null) f = clamp(l0 - bottom, 0, 1);
      else {
        const l1 = level(hx.q, hx.r, yb + 1);
        if (l1 !== null) f = clamp(Math.min(l1, bottom + 1) - (yb + 1), 0, 1);
      }
      if (f <= 0) continue;
      s.inWater = true;
      const displaced = WATER_DENSITY * BLOCK_VOLUME * f;
      // Archimède
      J.set(0, displaced * G * h, 0);
      // traînée : freine le mouvement de ce bloc dans l'eau
      this.velAt(s, r, v);
      J.addScaledVector(v, -displaced * WATER_DRAG * h);
      this.impulse(s, J, r);
    }
  }

  // Un bloc du monde a changé : les objets tout proches se réveillent (sol cassé, eau...)
  onWorldSet(q, r, y) {
    if (!this.remote && this.world.getBlock(q, r, y) === PROPELLER_ON) (this.spinQueue ||= []).push([null, key(q, r, y)]);
    const c = hexToWorld(q, r);
    for (const s of this.list) {
      if (!s.sleeping) continue;
      const d2 = (c.x - s.pos.x) ** 2 + (y + 0.5 - s.pos.y) ** 2 + (c.z - s.pos.z) ** 2;
      if (d2 < (s.radius + 1.5) ** 2) this.wake(s);
    }
  }

  // ---------- Hexacarts ----------
  // Chaque Hexacart proche d'un objet entre dans le solveur comme un corps léger (sans
  // rotation). Sur un rail, il ne bouge que le long de la voie : de côté, le rail encaisse.
  // Un Hexacart lancé pousse un objet léger ; il s'arrête contre un objet lourd ; un objet
  // posé dans (ou sur) un Hexacart est emporté avec lui (frottement).
  cartNear(cart, s) {
    const dy = cart.pos.y + CART_H / 2 - s.pos.y;
    return (cart.pos.x - s.pos.x) ** 2 + dy * dy + (cart.pos.z - s.pos.z) ** 2 < (s.radius + 1.2) ** 2;
  }

  // Un Hexacart qui roule réveille les objets qu'il va toucher
  wakeByCarts() {
    if (!this.carts) return;
    const v = new THREE.Vector3();
    for (const cart of this.carts.carts) {
      if (this.carts.velocity(cart, v).lengthSq() < 0.0025) continue;
      for (const s of this.list) if (s.sleeping && this.cartNear(cart, s)) { this.wake(s); this.updateFrame(s); }
    }
  }

  cartBodies() {
    if (!this.carts) return [];
    const out = [];
    for (const cart of this.carts.carts) {
      const near = this.list.filter((s) => !s.sleeping && this.cartNear(cart, s));
      if (!near.length) continue;
      out.push({
        isCart: true, cart, near,
        railT: cart.rail ? this.carts.dirAt(cart.rail, cart.s, new THREE.Vector3()) : null,
        vel: this.carts.velocity(cart, new THREE.Vector3()),
        pos: new THREE.Vector3(cart.pos.x, cart.pos.y + CART_H / 2, cart.pos.z),
        ang: new THREE.Vector3(), pv: new THREE.Vector3(), pw: new THREE.Vector3(),
        invMass: 1 / (CART_MASS + (cart.rider ? PLAYER_MASS : 0)), warm: new Map(),
      });
    }
    return out;
  }

  cartContacts(cb, s, cs) {
    const cart = cb.cart;
    const qi = new THREE.Quaternion().copy(s.quat).invert();
    const p = new THREE.Vector3(), L = new THREE.Vector3(), mv = new THREE.Vector3(), vs = new THREE.Vector3(), r = new THREE.Vector3();
    // points de la cuve entrés dans un bloc de l'objet
    for (const [dx, h, dz] of CART_POINTS) {
      p.set(cart.pos.x + dx, cart.pos.y + h, cart.pos.z + dz);
      if (p.distanceToSquared(s.pos) > (s.radius + 0.5) ** 2) continue;
      this.toLocal(s, p, L);
      const hx = worldToHex(L.x, L.z), yy = Math.floor(L.y), b = s.box(hx.q, hx.r, yy);
      if (!inBox(b, L.y - yy)) continue;
      const c = hexToWorld(hx.q, hx.r);
      this.velAt(s, r.subVectors(p, s.pos), vs);
      mv.subVectors(cb.vel, vs).applyQuaternion(qi).multiplyScalar(this.h);
      const res = this.faceOut(L.x - c.x, L.y - yy, L.z - c.z, fullFn(s.box, hx.q, hx.r, yy, b[0], b[1]), mv, b[0], b[1]);
      res.n.applyQuaternion(s.quat);
      cs.push({
        a: cb, b: s, n: res.n, d: res.d, mu: CART_GRIP,
        ra: new THREE.Vector3().subVectors(p, cb.pos), rb: new THREE.Vector3().subVectors(p, s.pos), jn: 0, jt: new THREE.Vector3(), ck: null,
      });
    }
    // points de l'objet entrés dans la cuve (cylindre)
    for (const [x, y, z] of s.pts) {
      p.set(x, y, z).applyMatrix3(s.rot).add(s.pos);
      const dy = p.y - cart.pos.y;
      if (dy <= 0 || dy >= CART_H) continue;
      const dx = p.x - cart.pos.x, dz = p.z - cart.pos.z, hd = Math.hypot(dx, dz);
      if (hd >= CART_R) continue;
      const top = CART_H - dy, side = CART_R - hd;
      let n, d;
      if (top <= dy && top <= side) { n = new THREE.Vector3(0, 1, 0); d = top; }
      else if (dy <= side) { n = new THREE.Vector3(0, -1, 0); d = dy; }
      else { n = new THREE.Vector3(dx / (hd || 1), 0, dz / (hd || 1)); d = side; }
      cs.push({
        a: s, b: cb, n, d, mu: CART_GRIP,
        ra: new THREE.Vector3().subVectors(p, s.pos), rb: new THREE.Vector3().subVectors(p, cb.pos), jn: 0, jt: new THREE.Vector3(), ck: null,
      });
    }
  }

  // L'Hexacart reprend sa vitesse (et se dégage) après le solveur
  writeCart(cb, h) {
    const cart = cb.cart;
    if (!this.carts.carts.includes(cart)) return;
    if (cart.rail && cb.railT) {
      cart.v = cb.railT.dot(cb.vel);
      cart.s += cb.railT.dot(cb.pv) * h;
    } else if (!cart.rail) {
      cart.vel.copy(cb.vel);
      cart.pos.addScaledVector(cb.pv, h);
    }
    cb.vel.copy(this.carts.velocity(cart, new THREE.Vector3()));
    cb.pv.set(0, 0, 0);
  }

  // Pseudo-vitesse de dégagement (translation seulement)
  pseudoPush(s, n, dj) {
    if (s.isCart && s.railT) s.pv.addScaledVector(s.railT, s.railT.dot(n) * dj * s.invMass);
    else s.pv.addScaledVector(n, dj * s.invMass);
  }

  // ---------- Main gravitationnelle ----------
  // L'objet est tenu par un point : ce point file vers la cible (devant le joueur) à une
  // vitesse qui ne dépend pas du poids. Le terrain et les autres objets l'arrêtent quand
  // même. Il garde l'orientation voulue (celle qu'il avait, puis tournée avec holdTurn) :
  // il ne tourne pas comme une toupie.
  // key : qui tient (0 = joueur de l'hôte, sinon numéro de connexion d'un client).
  hold(key, s, worldPoint, target) {
    for (const [k, h] of this.holds) if (h.s === s && k !== key) this.holds.delete(k); // on le lui prend
    this.updateFrame(s);
    this.holds.set(key, {
      s, local: this.toLocal(s, worldPoint, new THREE.Vector3()), target: new THREE.Vector3().copy(target ?? worldPoint),
      turn: s.quat.clone(), // orientation voulue (voir holdTurn)
    });
    this.wake(s);
  }

  // Fait tourner l'objet tenu : angle (radians) autour de l'axe (dans le monde). Sans axe,
  // l'objet est redressé (son haut revient vers le haut).
  holdTurn(key, axis, angle) {
    const h = this.holds.get(key);
    if (!h) return;
    if (axis) h.turn.premultiply(_q.setFromAxisAngle(axis, angle)).normalize();
    else {
      const up = _a.copy(UP).applyQuaternion(h.turn);
      h.turn.premultiply(_q.setFromUnitVectors(up, UP)).normalize();
    }
    this.wake(h.s);
  }

  holdTarget(key, target) {
    const h = this.holds.get(key);
    if (!h) return;
    h.target.copy(target);
    this.wake(h.s);
  }

  // Lâche l'objet ; vel : vitesse donnée en le lançant (la même quel que soit le poids)
  drop(key, vel) {
    const h = this.holds.get(key);
    if (!h) return;
    this.holds.delete(key);
    if (vel) h.s.vel.copy(vel);
    this.wake(h.s);
  }

  held(key) { return this.holds.get(key)?.s ?? null; }
  isHeld(s) { for (const h of this.holds.values()) if (h.s === s) return true; return false; }

  // Point tenu, dans le monde (pour dessiner le rayon)
  holdPoint(key, out) {
    const h = this.holds.get(key);
    return h ? this.toWorld(h.s, h.local, out) : null;
  }

  applyHolds(h) {
    const P = new THREE.Vector3(), r = new THREE.Vector3(), v = new THREE.Vector3(), want = new THREE.Vector3();
    const E = new THREE.Quaternion(), Qi = new THREE.Quaternion();
    const k = 1 - Math.exp(-h * HOLD_GRIP);
    for (const [key, hd] of this.holds) {
      const s = hd.s;
      if (!this.list.includes(s)) { this.holds.delete(key); continue; }
      if (s.sleeping) { this.wake(s); this.updateFrame(s); }
      s.vel.y += G * h; // la gravité ne compte plus
      this.toWorld(s, hd.local, P);
      want.subVectors(hd.target, P).multiplyScalar(HOLD_SPEED);
      if (want.lengthSq() > HOLD_MAX * HOLD_MAX) want.setLength(HOLD_MAX);
      // vitesse du point tenu -> vitesse voulue (on corrige le centre, pas la masse)
      this.velAt(s, r.subVectors(P, s.pos), v);
      s.vel.addScaledVector(want.sub(v), k);
      // rotation : l'objet tourne vers l'orientation voulue (par le chemin le plus court)
      const e = E.copy(hd.turn).multiply(Qi.copy(s.quat).invert());
      if (e.w < 0) e.set(-e.x, -e.y, -e.z, -e.w);
      const sin = Math.hypot(e.x, e.y, e.z);
      const angle = 2 * Math.atan2(sin, e.w);
      if (sin > 1e-6) want.set(e.x, e.y, e.z).multiplyScalar(Math.min(angle * HOLD_TURN, HOLD_TURN_MAX) / sin);
      else want.set(0, 0, 0);
      s.ang.lerp(want, 1 - Math.exp(-h * HOLD_SPIN * 3));
    }
  }

  // ---------- Joueurs ----------
  // Cases solides de l'objet qui touchent le cylindre du joueur (L : pieds, repère local) :
  // [x, y, z, bas, haut] (bas et haut : hauteur occupée, pour les dalles)
  touching(s, L) {
    const out = [];
    const h = worldToHex(L.x, L.z);
    const y0 = Math.floor(L.y + 1e-4), y1 = Math.floor(L.y + P_HEIGHT - 1e-4);
    for (const [dq, dr] of CELLS) {
      const q = h.q + dq, r = h.r + dr;
      const c = hexToWorld(q, r);
      if (!circleHexOverlap(L.x - c.x, L.z - c.z, P_RADIUS)) continue;
      for (let y = y0; y <= y1; y++) {
        const b = s.box(q, r, y);
        if (!b || !(y + b[0] < L.y + P_HEIGHT - 1e-4 && y + b[1] > L.y + 1e-4)) continue;
        const id = s.blocks.get(key(q, r, y));
        if (!blockOverlap(id, L.x - c.x, L.z - c.z, P_RADIUS, L.y - y, L.y + P_HEIGHT - y)) continue;
        out.push([c.x, y + b[0], c.z, y + b[0], y + b[1], id, y]);
      }
    }
    return out.sort((a, b) => a[1] - b[1]);
  }

  near(s, p) {
    return s.pos.distanceToSquared(p.pos) < (s.radius + 2.5) ** 2;
  }

  // Un animal ou un villageois (a : pos, vel, onGround ; rayon, hauteur) contre les objets
  // physiques, sans les pousser : il se pose dessus (une marche d'un demi-bloc se monte), ne les
  // traverse pas. Renvoie l'objet sur lequel il se tient (il est emporté avec, voir animals.js),
  // ou null. Un objet penché : dans son repère (on se pose sur ses blocs penchés, ils repoussent
  // de biais) ; à l'envers (plus de 60°), on le laisse.
  collideMob(a, radius, height) {
    let on = null;
    const L = _f, up = _g;
    a.bumpStruct = false; // (buté contre un bloc d'objet qu'on peut gravir d'un saut)
    for (const s of this.list) {
      if (s.pos.distanceToSquared(a.pos) > (s.radius + 2) ** 2) continue;
      if (up.copy(UP).applyQuaternion(s.quat).y < 0.5) continue;
      this.toLocal(s, a.pos, L);
      let hit = false;
      // dessous : le plus haut dessus de bloc entre les pieds - 0,6 et les pieds + 0,55
      if (a.vel.y <= 0.01) {
        let top = null;
        const h = worldToHex(L.x, L.z);
        for (const [dq, dr] of CELLS) {
          const q = h.q + dq, r = h.r + dr, c = hexToWorld(q, r);
          if (!circleHexOverlap(L.x - c.x, L.z - c.z, radius - 0.05)) continue;
          for (let y = Math.floor(L.y - 0.6); y <= Math.floor(L.y + 0.55); y++) {
            const b = s.box(q, r, y);
            if (!b || !blockOverlap(s.blocks.get(key(q, r, y)), L.x - c.x, L.z - c.z, radius - 0.05)) continue;
            const t = y + b[1];
            if (t >= L.y - 0.6 && t <= L.y + 0.55 && (top === null || t > top)) top = t;
          }
        }
        if (top !== null) { L.y = top; hit = true; on = s; }
      }
      // côtés : il ressort des blocs qu'il touche entre ses pieds et sa tête
      for (let it = 0; it < 3; it++) {
        let pushed = false;
        const h = worldToHex(L.x, L.z);
        for (const [dq, dr] of CELLS) {
          const q = h.q + dq, r = h.r + dr, c = hexToWorld(q, r);
          for (let y = Math.floor(L.y + 0.05); y < L.y + height; y++) {
            const b = s.box(q, r, y);
            if (!b || y + b[1] <= L.y + 0.05 || y + b[0] >= L.y + height) continue;
            const p = blockPush(s.blocks.get(key(q, r, y)), L.x - c.x, L.z - c.z, radius);
            if (!p && SLAB[s.blocks.get(key(q, r, y))] === 3) continue; // (à côté d'une dalle verticale : le bloc au-dessus peut toucher)
            if (p) {
              L.x += p[0]; L.z += p[1]; pushed = hit = true;
              // (un bloc d'un peu plus d'une marche, rien au-dessus : il peut sauter dessus)
              const rise = y + b[1] - L.y;
              if (rise > 0.5 && rise <= 1.3 && !s.box(q, r, y + 1) && !s.box(q, r, y + 2)) a.bumpStruct = true;
            }
            break;
          }
        }
        if (!pushed) break;
      }
      if (!hit) continue;
      this.toWorld(s, L, a.pos);
      if (on === s) { a.vel.y = 0; a.onGround = true; }
    }
    return on;
  }

  // Le joueur local : se pose dessus, se cogne la tête, ne traverse pas, pousse, pèse.
  // Monté sur un objet, le joueur s'y attache : sa position suit l'objet (voir update) et
  // sa vitesse (p.vel) est comptée par rapport à lui (il ne glisse pas quand l'objet bouge
  // ou tourne). Il s'en détache en le quittant (posé ailleurs, ou plus au-dessus de lui) et
  // retrouve alors une vitesse dans le monde (la sienne plus celle de l'objet).
  collidePlayer(p, dt) {
    p.standingOn = null;
    if (p.riding) { p.attached = null; return; }
    const L = new THREE.Vector3(), lv = new THREE.Vector3(), vs = new THREE.Vector3(), up = new THREE.Vector3();
    const qi = new THREE.Quaternion(), Ls = new THREE.Vector3(), d = new THREE.Vector3(), wu = new THREE.Vector3();
    // position du joueur dans chaque objet proche à l'image précédente (repère de l'objet)
    const last = (p.structLocal ||= new Map());
    for (const s of this.list) {
      if (!this.near(s, p)) { last.delete(s.id); continue; }
      this.updateFrame(s);
      this.toLocal(s, p.pos, L);
      qi.copy(s.quat).invert();
      up.copy(UP).applyQuaternion(s.quat);
      // Balayage : à grande vitesse (joueur ou objet), le joueur peut avancer de plus d'un
      // demi-bloc par image et finir au fond d'un bloc (ou au-delà), puis ressortir du mauvais
      // côté. On refait donc le chemin parcouru depuis l'image précédente, par petits pas,
      // et on s'arrête au premier contact. (Grand saut : téléportation, on ne balaie pas.)
      const prev = last.get(s.id);
      if (prev) {
        d.subVectors(L, prev);
        const len = d.length();
        if (len > SWEEP_STEP && len < 12) {
          const n = Math.ceil(len / SWEEP_STEP);
          for (let i = 1; i < n; i++) {
            Ls.copy(prev).addScaledVector(d, i / n);
            if (!this.touching(s, Ls).length) continue;
            L.copy(Ls);
            this.toWorld(s, L, p.pos);
            break;
          }
        }
      }
      // objet penché : collision par points autour du corps (le cylindre du joueur ne peut
      // plus être compté dans le repère de l'objet, qui n'est plus vertical)
      if (up.y < TILT_COS) {
        this.collideTilted(s, p, dt, p.attached === s);
        if (p.standingOn === s && !this.remote) this.push(s, _b.set(0, -PLAYER_MASS * G, 0), p.pos, dt);
        last.set(s.id, this.toLocal(s, p.pos, new THREE.Vector3()));
        continue;
      }
      // vitesse du joueur par rapport à l'objet, dans le repère de l'objet (déjà relative
      // s'il y est attaché)
      if (p.attached === s) vs.set(0, 0, 0); else this.velAt(s, _a.subVectors(p.pos, s.pos), vs);
      lv.subVectors(p.vel, vs).applyQuaternion(qi);
      let touched = false;
      for (let it = 0; it < 4; it++) {
        let moved = false;
        for (const [cx, by, cz, , top, bid, cy] of this.touching(s, L)) {
          const pod = BLOCKS[bid]?.pod !== undefined, roof = pod && BLOCKS[bid].podTop && !blockPush(bid, L.x - cx, L.z - cz, P_RADIUS, 0, 0.5);
          if (roof && lv.y > 0 && L.y + P_HEIGHT - cy < 1) {
            // (dans un lit : la tête touche le toit)
            L.y = cy + 0.88 - P_HEIGHT - 1e-3;
            lv.y = 0;
          } else if (top - L.y < 0.55 && lv.y <= 0.5 && (!pod || BLOCKS[bid].podTop) && up.y > 0.55 && (top % 1 !== 0 || s.box(...this.cellOf(cx, cz), top)?.[0] !== 0)) {
            // sur le dessus : on se pose (petites marches franchies d'office). On remonte à la
            // verticale du monde (la gravité fait descendre tout droit) : sur un objet un peu
            // penché, remonter selon sa verticale à lui ferait glisser vers le bas de la pente.
            wu.copy(UP).applyQuaternion(qi);
            L.addScaledVector(wu, (top - L.y) / wu.y);
            L.y = top;
            // (la chute s'arrête : on retire la vitesse vers le bas du monde, pas seulement
            // celle vers le bas de l'objet, sinon le reste fait glisser le long de la pente)
            const fall = lv.dot(wu);
            if (fall < 0) lv.addScaledVector(wu, -fall);
            lv.y = Math.max(0, lv.y);
            p.onGround = true;
            p.fly = false;
            p.standingOn = s;
          } else if (L.y + P_HEIGHT - by < 0.35 && lv.y > 0) {
            L.y = by - P_HEIGHT - 1e-3;
            lv.y = 0;
          } else {
            const push = blockPush(bid, L.x - cx, L.z - cz, P_RADIUS, L.y - cy, L.y + P_HEIGHT - cy);
            if (!push) continue;
            L.x += push[0];
            L.z += push[1];
            const pl = Math.hypot(push[0], push[1]) || 1;
            const nx = push[0] / pl, nz = push[1] / pl;
            const into = -(lv.x * nx + lv.z * nz);
            if (!this.remote && into > 0.05) this.pushAt(s, L, nx, nz, by, this.worldVel(p), dt);
          }
          moved = touched = true;
          break;
        }
        if (!moved) break;
      }
      if (touched) {
        this.toWorld(s, L, p.pos);
        p.vel.copy(lv.applyQuaternion(s.quat)).add(vs);
      }
      last.set(s.id, L.clone());
      // le poids du joueur appuie sur l'objet (sauf s'il dort posé sur le sol)
      if (p.standingOn === s && !this.remote && (!s.sleeping || s.inWater)) {
        this.push(s, _b.set(0, -PLAYER_MASS * G, 0), p.pos, dt);
      }
    }
    this.updateAttach(p);
  }

  // Vitesse du joueur dans le monde (p.vel est relative à l'objet auquel il est attaché)
  worldVel(p, out = new THREE.Vector3()) {
    out.copy(p.vel);
    const s = p.attached;
    if (s && this.list.includes(s)) out.add(this.velAt(s, _c.subVectors(p.pos, s.pos), new THREE.Vector3()));
    return out;
  }

  // Attache ou détache le joueur (après les collisions de l'image)
  updateAttach(p) {
    const a = p.attached;
    if (a && !this.list.includes(a)) p.attached = null; // objet disparu (reposé, détruit)
    else if (a && p.standingOn !== a && (p.onGround || p.standingOn || !this.above(a, p))) {
      // il l'a quitté : retour dans le monde, avec la vitesse de l'objet en plus
      this.worldVel(p, p.vel);
      p.attached = null;
    }
    const s = p.standingOn;
    if (s && p.attached !== s) {
      // il monte dessus : sa vitesse devient relative à l'objet
      p.vel.sub(this.velAt(s, _c.subVectors(p.pos, s.pos), new THREE.Vector3()));
      p.attached = s;
    }
  }

  // Le joueur (en l'air) est-il encore au-dessus de l'objet ? (un saut ne le détache pas)
  above(s, p) {
    const L = this.toLocal(s, p.pos, new THREE.Vector3());
    const h = worldToHex(L.x, L.z), y = Math.floor(L.y);
    for (let k = 0; k <= ATTACH_DROP; k++) if (s.blocks.has(key(h.q, h.r, y - k))) return true;
    return false;
  }

  cellOf(x, z) { const h = worldToHex(x, z); return [h.q, h.r]; }

  // Joueur contre un objet penché. Des points autour du corps (pieds, corps, tête) sont
  // testés dans les blocs de l'objet ; chaque point entré dans un bloc ressort par la face
  // qu'il a traversée : dessus = on s'y pose, dessous = on se cogne la tête, sinon on bute.
  collideTilted(s, p, dt, rel = false) {
    const qi = new THREE.Quaternion().copy(s.quat).invert();
    const sp = new THREE.Vector3(), L = new THREE.Vector3(), mv = new THREE.Vector3();
    const vs = new THREE.Vector3(), r = new THREE.Vector3(), pv = new THREE.Vector3();
    for (let pass = 0; pass < 3; pass++) {
      let moved = false;
      for (const [dx, h, dz, kind] of BODY_POINTS) {
        sp.set(p.pos.x + dx, p.pos.y + h, p.pos.z + dz);
        this.toLocal(s, sp, L);
        const hx = worldToHex(L.x, L.z), yy = Math.floor(L.y), b = s.box(hx.q, hx.r, yy);
        if (!inBox(b, L.y - yy) || !this.inPart(s, hx.q, hx.r, yy, L)) continue;
        const c = hexToWorld(hx.q, hx.r);
        if (rel) vs.set(0, 0, 0); else this.velAt(s, r.subVectors(sp, s.pos), vs);
        mv.subVectors(p.vel, vs).applyQuaternion(qi).multiplyScalar(dt);
        const res = this.faceOut(L.x - c.x, L.y - yy, L.z - c.z, fullFn(s.box, hx.q, hx.r, yy, b[0], b[1]), mv, b[0], b[1]);
        const vk = BLOCKS[s.blocks.get(key(hx.q, hx.r, yy))]?.vslab;
        if (vk !== undefined) {
          const ex = Math.cos((Math.PI / 3) * vk), ez = Math.sin((Math.PI / 3) * vk);
          const cut = (L.x - c.x) * ex + (L.z - c.z) * ez;
          if (cut < res.d) { res.n.set(-ex, 0, -ez); res.d = cut; }
        }
        const n = res.n.applyQuaternion(s.quat);
        if (kind === 0 && n.y > 0.55) {
          // pieds sur une face assez plate : on se pose (on remonte tout droit)
          p.pos.y += Math.min(0.6, res.d / n.y) + 1e-3;
          if (p.vel.y < vs.y) p.vel.y = vs.y;
          p.onGround = true;
          p.fly = false;
          p.standingOn = s;
        } else if (kind === 2 && n.y < -0.55) {
          p.pos.addScaledVector(n, res.d + 1e-3);
          if (p.vel.y > vs.y) p.vel.y = vs.y;
        } else {
          // on bute (mur ou pente trop raide) : sortie à l'horizontale (jamais vers le bas,
          // ce qui enfoncerait le joueur dans le sol)
          pv.copy(p.vel);
          const nh = Math.hypot(n.x, n.z);
          if (nh < 0.3) {
            if (n.y > 0 && h < 0.6) { p.pos.y += Math.min(0.6, res.d) + 1e-3; if (p.vel.y < vs.y) p.vel.y = vs.y; }
            else continue;
          } else {
            const push = Math.min(0.3, res.d / nh) + 1e-3;
            p.pos.x += (n.x / nh) * push;
            p.pos.z += (n.z / nh) * push;
            if (!this.remote) this.pushPoint(s, sp.clone(), new THREE.Vector3(-n.x / nh, 0, -n.z / nh), rel ? this.worldVel(p) : pv, dt);
          }
        }
        moved = true;
        break;
      }
      if (!moved) break;
    }
  }

  // Le joueur pousse l'objet au point pt, dans la direction dir (horizontale)
  pushPoint(s, pt, dir, pvel, dt) {
    this.updateFrame(s);
    const r = new THREE.Vector3().subVectors(pt, s.pos);
    const into = pvel.dot(dir) - this.velAt(s, r, new THREE.Vector3()).dot(dir);
    if (into <= 0.05) return;
    const k = this.invMassAt(s, r, dir);
    const J = Math.min(PUSH_FORCE * dt, into / k);
    this.push(s, dir.multiplyScalar(J / dt), pt, dt);
  }

  // Le joueur pousse l'objet : force horizontale au niveau de sa poitrine
  pushAt(s, L, nx, nz, by, pvel, dt) {
    // mains à hauteur de hanche / poitrine
    const chest = clamp(L.y + 0.9, by + 0.05, by + 0.8);
    const pt = this.toWorld(s, _c.set(L.x - nx * P_RADIUS, chest, L.z - nz * P_RADIUS), new THREE.Vector3());
    const dir = new THREE.Vector3(-nx, 0, -nz).applyQuaternion(s.quat);
    dir.y = 0;
    if (dir.lengthSq() < 1e-6) return;
    dir.normalize();
    // force limitée, et jamais plus que ce qu'il faut pour que ce point aille à la vitesse
    // du joueur (un objet léger ne s'envole pas)
    this.pushPoint(s, pt, dir, pvel, dt);
  }

  // Joueur distant (hôte) : il ne bouge pas ici, mais il pousse l'objet et pèse dessus
  pushBy(p, dt) {
    if (p.riding || !p.pos) return;
    const L = new THREE.Vector3(), lv = new THREE.Vector3();
    for (const s of this.list) {
      if (!this.near(s, p)) continue;
      this.updateFrame(s);
      this.toLocal(s, p.pos, L);
      lv.copy(p.vel || _a.set(0, 0, 0)).sub(this.velAt(s, _b.subVectors(p.pos, s.pos), _c)).applyQuaternion(_q.copy(s.quat).invert());
      for (const [cx, by, cz, , , bid, cy] of this.touching(s, L)) {
        if (by + 1 - L.y < 0.55) {
          if (!s.sleeping || s.inWater) this.push(s, _b.set(0, -PLAYER_MASS * G, 0), p.pos, dt);
          break;
        }
        const push = blockPush(bid, L.x - cx, L.z - cz, P_RADIUS, L.y - cy, L.y + P_HEIGHT - cy);
        if (!push) continue;
        const pl = Math.hypot(push[0], push[1]) || 1;
        const nx = push[0] / pl, nz = push[1] / pl;
        const into = -(lv.x * nx + lv.z * nz);
        if (into > 0.05 && p.vel) this.pushAt(s, L, nx, nz, by, p.vel, dt);
        break;
      }
    }
  }

  // ---------- Visée ----------
  raycast(origin, dir, maxDist) {
    let best = null;
    const o = new THREE.Vector3(), d = new THREE.Vector3(), qi = new THREE.Quaternion();
    for (const s of this.list) {
      // l'objet est-il à portée du rayon ?
      _a.subVectors(s.pos, origin);
      const tc = clamp(_a.dot(dir), 0, maxDist);
      if (_b.copy(dir).multiplyScalar(tc).sub(_a).length() > s.radius + 0.5) continue;
      qi.copy(s.quat).invert();
      this.toLocal(s, origin, o);
      d.copy(dir).applyQuaternion(qi);
      let prev = null, last = '', slabKey = '', slabPrev = null;
      for (let t = 0; t <= maxDist; t += 0.02) {
        if (best && t >= best.t) break;
        const lx = o.x + d.x * t, ly = o.y + d.y * t, lz = o.z + d.z * t;
        const h = worldToHex(lx, lz), y = Math.floor(ly);
        const k = key(h.q, h.r, y);
        if (k === last) continue;
        const id = s.blocks.get(k);
        if (id) {
          // rail : fin, fil : au ras du sol, torche : étroite, dalle : moitié de case (on
          // reteste à chaque pas)
          const c = hexToWorld(h.q, h.r);
          const thin = BLOCKS[id].rail ? ly - y > 0.12 : isWire(id) ? ly - y > 0.1 : BLOCKS[id].repeater ? ly - y > 0.3 : BLOCKS[id].torch ? Math.hypot(lx - c.x, lz - c.z) > 0.12 || ly - y > 0.65
            : SLAB[id] ? !inSolidPart(id, lx - c.x, ly - y, lz - c.z) : false;
          if (!thin) {
            const into = SLAB[id] && k === slabKey;
            best = { struct: s, hit: { q: h.q, r: h.r, y }, prev: into ? slabPrev : prev, into, t };
            break;
          }
          if (SLAB[id]) {
            if (k !== slabKey) { slabKey = k; slabPrev = prev; }
            prev = { q: h.q, r: h.r, y };
          }
          continue;
        }
        last = k;
        prev = { q: h.q, r: h.r, y };
      }
    }
    return best;
  }

  // Place le contour de visée sur une case de l'objet (position et rotation)
  placeOutline(outline, s, q, r, y) {
    const c = hexToWorld(q, r);
    const id = s.blocks.get(key(q, r, y)), [lo, hi] = boxOf(id);
    this.toWorld(s, _a.set(c.x, y + lo, c.z), outline.position);
    outline.quaternion.copy(s.quat);
    if (BLOCKS[id]?.torch) outline.scale.set(0.2, 0.65, 0.2);
    else outline.scale.set(1, BLOCKS[id]?.rail ? 0.12 : isWire(id) ? 0.06 : BLOCKS[id]?.repeater ? 0.33 : hi - lo, 1);
  }

  // Le point local L est-il dans la partie pleine du bloc (q, r, y) ? (dalle verticale : sa moitié)
  inPart(s, q, r, y, L) {
    const id = s.blocks.get(key(q, r, y));
    if (SLAB[id] !== 3) return true;
    const c = hexToWorld(q, r);
    return inSolidPart(id, L.x - c.x, L.y - y, L.z - c.z);
  }

  // Le joueur occupe-t-il cette case locale ? (on ne pose pas de bloc dans quelqu'un)
  occupies(s, q, r, y, p) {
    const L = this.toLocal(s, p.pos, new THREE.Vector3());
    if (L.y >= y + 1 || L.y + P_HEIGHT <= y) return false;
    const c = hexToWorld(q, r);
    return circleHexOverlap(L.x - c.x, L.z - c.z, P_RADIUS - 0.01);
  }

  // Torches posées sur les objets (pour les lumières du jeu)
  lightsNear(x, z, radius = 48) {
    const out = [];
    for (const s of this.list) {
      if (!s.lights.length || (s.pos.x - x) ** 2 + (s.pos.z - z) ** 2 > (radius + s.radius) ** 2) continue;
      for (const [lx, ly, lz, kind] of s.lights) {
        const w = this.toWorld(s, _a.set(lx, ly, lz), new THREE.Vector3());
        out.push({ x: w.x, y: w.y, z: w.z, kind, d2: (w.x - x) ** 2 + (w.z - z) ** 2, struct: s, local: [lx, ly, lz] });
      }
    }
    return out;
  }

  // Position actuelle d'une lumière d'objet (il bouge entre deux tris)
  lightPos(src, out) {
    if (!this.list.includes(src.struct)) return out.set(src.x, src.y, src.z);
    return this.toWorld(src.struct, _a.set(...src.local), out);
  }

  // ---------- Explosions ----------
  // strength : force du souffle (1 = TNT, environ 3 pour la Big TNT)
  explode(x, y, z, R, strength = 1) {
    const center = new THREE.Vector3(x, y, z), w = new THREE.Vector3(), dir = new THREE.Vector3(), r = new THREE.Vector3();
    for (const s of [...this.list]) {
      if (s.pos.distanceTo(center) > s.radius + R * 2) continue;
      this.updateFrame(s);
      let hit = false, pushed = false;
      for (const [q, rr, ly, id] of s.list) {
        const c = hexToWorld(q, rr);
        this.toWorld(s, _b.set(c.x, ly + 0.5, c.z), w);
        const d = w.distanceTo(center);
        // blocs arrachés dans le rayon
        if (d < R * (0.6 + Math.random() * 0.4) && !BLOCKS[id]?.unbreakable) {
          // une TNT de l'objet s'allume (réaction en chaîne), les autres blocs sont arrachés
          if (isTnt(id) && this.onTnt) this.onTnt(w.x, w.y - 0.5, w.z, this.velAt(s, _c.subVectors(w, s.pos), new THREE.Vector3()), id, 0.5 + Math.random());
          s.blocks.delete(key(q, rr, ly)); hit = true; continue;
        }
        // souffle : chaque bloc reçoit sa part, là où il est (l'objet part en tournant)
        const f = Math.max(0, 1 - d / (R * 2)) * EXPLOSION * strength;
        if (f <= 0) continue;
        dir.subVectors(w, center);
        if (dir.lengthSq() < 1e-6) dir.set(0, 1, 0);
        dir.normalize().multiplyScalar(f);
        dir.y += f * 0.3;
        this.impulse(s, dir, r.subVectors(w, s.pos));
        pushed = true;
      }
      if (hit || pushed) this.wake(s);
      if (hit) this.afterEdit(s);
    }
  }

  // ---------- Sauvegarde / réseau ----------
  // x, y, z : origine de la grille locale ; q : rotation
  serialize() {
    const o = new THREE.Vector3();
    // (les plateaux des wagons plats sont sauvegardés avec leur train, voir trains.js)
    return this.list.filter((s) => !s.kinematic).map((s) => {
      this.origin(s, o);
      return {
        id: s.id, x: o.x, y: o.y, z: o.z, q: s.quat.toArray(),
        vx: s.vel.x, vy: s.vel.y, vz: s.vel.z, w: s.ang.toArray(), b: s.list,
        p: s.params.size ? [...s.params] : undefined,
        hg: s.hinge ? { ...s.hinge } : undefined, // (rotor d'une hélice)
      };
    });
  }

  load(list) {
    this.clear();
    for (const d of list || []) {
      if (![d.x, d.y, d.z].every(Number.isFinite) || !Array.isArray(d.b)) continue;
      const blocks = d.b.filter((e) => Array.isArray(e) && e.length === 4 && e.every(Number.isInteger) && BLOCKS[e[3]]);
      if (!blocks.length) continue;
      const s = this.create(Number.isInteger(d.id) ? d.id : ++this.nextId, d.x, d.y, d.z, quatFrom(d.q), blocks);
      s.vel.set(+d.vx || 0, +d.vy || 0, +d.vz || 0);
      for (const e of Array.isArray(d.p) ? d.p : []) {
        if (Array.isArray(e) && typeof e[0] === 'string' && Array.isArray(e[1]) && ((e[1].length === 3 && e[1].every(Number.isFinite)) || validGrav(e[1]))) s.params.set(e[0], e[1]);
      }
      this.updateMotor(s);
      if (Array.isArray(d.w) && d.w.every(Number.isFinite)) s.ang.fromArray(d.w);
      this.wake(s);
      this.nextId = Math.max(this.nextId, s.id);
      const H = d.hg;
      if (H && (H.base === null || Number.isInteger(H.base)) && typeof H.key === 'string' && Array.isArray(H.L) && H.L.length === 3 && H.L.every(Number.isFinite)
        && Array.isArray(H.q0) && H.q0.length === 4 && H.q0.every(Number.isFinite)) {
        s.hinge = { base: H.base, key: H.key, L: H.L, q0: H.q0, phi: +H.phi || 0, w: +H.w || 0 };
      }
    }
  }

  // positions (20 fois par seconde) : [id, x, y, z, qx, qy, qz, qw] (origine de la grille)
  positions() {
    const r = (v) => Math.round(v * 1000) / 1000, rq = (v) => Math.round(v * 10000) / 10000;
    const o = new THREE.Vector3();
    return this.list.filter((s) => s.moved || !s.sleeping).map((s) => {
      this.origin(s, o);
      return [s.id, r(o.x), r(o.y), r(o.z), rq(s.quat.x), rq(s.quat.y), rq(s.quat.z), rq(s.quat.w)];
    });
  }

  // Client : définition complète d'un objet (ou suppression)
  applyDef(d) {
    let s = this.byId(d.id);
    if (d.del) { if (s) this.disposeStruct(s); return; }
    const blocks = (d.b || []).filter((e) => Array.isArray(e) && e.length === 4 && BLOCKS[e[3]]);
    const q = quatFrom(d.q);
    if (!s) s = this.create(d.id, d.x, d.y, d.z, q, blocks);
    else this.setBlocks(s, blocks);
    (s.tOrigin ||= new THREE.Vector3()).set(d.x, d.y, d.z);
    (s.tQuat ||= new THREE.Quaternion()).copy(q);
  }

  applyPositions(list) {
    for (const [id, x, y, z, qx, qy, qz, qw] of list) {
      const s = this.byId(id);
      if (!s || ![x, y, z].every(Number.isFinite)) continue;
      (s.tOrigin ||= new THREE.Vector3()).set(x, y, z);
      (s.tQuat ||= new THREE.Quaternion()).copy(quatFrom([qx, qy, qz, qw]));
    }
  }

  def(s) {
    const r = (v) => Math.round(v * 1000) / 1000;
    const o = this.origin(s, new THREE.Vector3());
    return { id: s.id, x: r(o.x), y: r(o.y), z: r(o.z), q: s.quat.toArray(), b: s.list };
  }
}

function quatFrom(a) {
  const q = new THREE.Quaternion();
  if (Array.isArray(a) && a.length === 4 && a.every(Number.isFinite)) q.fromArray(a).normalize();
  return q;
}

// Géométrie d'objet avec un attribut de lumière (rgb des sources, a = ciel ; voir relight)
function withLight(g) {
  const n = g.attributes.position.count, a = new Float32Array(n * 4);
  for (let i = 3; i < a.length; i += 4) a[i] = 1;
  g.setAttribute('light', new THREE.BufferAttribute(a, 4));
  return g;
}
