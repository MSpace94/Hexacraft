// Voies du train (façon Create) : un réseau de nœuds reliés par des tronçons, dessiné en vrai
// relief (traverses et rails), à l'échelle du train (3 blocs de large, voir trains.js).
//  - un nœud : un bloc « Rail de train », posé dans l'un des 3 axes de la grille (selon le regard) ;
//    trois ids, un par axe (456, 473, 474) ;
//  - deux nœuds voisins dans le même axe se relient tout seuls (ligne droite) ;
//  - un virage : on choisit un bout de voie (Maj + clic droit dessus avec un rail de train), puis on
//    clique là où la voie doit arriver : une grande courbe douce (Bézier) relie les deux, sur
//    plusieurs cases, et peut monter ou descendre (une pente douce) ;
//  - un aiguillage : un côté de nœud peut avoir deux tronçons (le tout droit et une branche) ;
//    clic droit sur le nœud : il bascule. Un panneau à côté de la voie montre la direction (vert :
//    tout droit, orange : la branche) ;
//  - une longue ligne (commande /voie) : un nœud toutes les 16 cases, reliés par de longues lignes
//    droites (très peu de données, même pour des milliers de cases) ;
//  - casser un nœud enlève aussi ses virages et ses longues lignes ;
//  - une pente : un bout de voie libre se relie tout seul au nœud suivant de son axe s'il est un
//    peu plus haut ou plus bas (2 à 16 cases plus loin, 1 bloc de dénivelé toutes les 4 cases au plus) ;
//  - une gare (bloc « Gare ») posée à côté de la voie : les trains en pilote automatique s'y
//    arrêtent (voir trains.js) ; elle a un nom (clic droit dessus pour le changer) ;
//  - un aiguillage touché par du courant (fil allumé, levier, source) passe sur la branche, et
//    revient tout droit quand le courant s'arrête ;
//  - butoir (bout de voie) et panneau de limitation de vitesse : des blocs dessinés en relief ici ;
//    le panneau (clic droit : changer la vitesse) limite les trains jusqu'au panneau suivant ;
//  - détecteur de train : sous la voie, il donne du courant au passage d'une voiture (trains.js) ;
//  - itinéraire : le chemin le plus court jusqu'à une gare (path), pour régler les aiguillages ;
//  - une ligne spatiale (tronçon 'x', voir layToSpace et addLine) : une seule ligne droite entre deux
//    astres, au-dessus du monde. Le train y file tout seul (voir trains.js), le ciel suit le voyage
//    (voir spaceflight.js). Elle fait des centaines de millions de cases : elle n'est pas inscrite
//    dans les chunks, seul le bout autour du joueur est dessiné (voir updateLongs).
// Les nœuds sont retrouvés dans les modifications du monde (world.mods : un rail de train est
// toujours posé par quelqu'un) ; virages, longues lignes et aiguillages sont gardés dans la sauvegarde.
// Dessin : par chunk, là où le terrain est chargé et, au-delà, jusqu'à la distance d'affichage
// (on voit les voies au loin, sur le terrain simplifié) ; libéré plus loin.
// Un rail posé ou cassé, un panneau changé ne refont pas tout le réseau : seuls les nœuds touchés
// et leurs voisins sont repris (applyPending), et seuls les chunks dont la voie a changé sont
// redessinés. Le réseau complet (rebuild) n'est refait qu'au chargement et après une longue ligne.
import * as THREE from 'three';
import { NEIGHBORS, hexToWorld, worldToHex } from './hex.js?v=1.1.5-alpha-mwgq2wrb';
import { CS, DEEP, H, Y_MIN, chunkKey } from './mesher.js?v=1.1.5-alpha-mwgq2wrb';
import { SOLID, BLOCKS, isStation, isProp, isDetector, STATION, BUFFER_STOP, SPEED_SIGN, RAIL_SIGNAL, POST } from './blocks.js?v=1.1.5-alpha-mwgq2wrb';

export const TRACK_IDS = [456, 473, 474];
export const isTrack = (id) => id === 456 || id === 473 || id === 474;
const AX = [0, 1, 2].map((a) => new THREE.Vector3(Math.cos((a * Math.PI) / 3), 0, Math.sin((a * Math.PI) / 3)));
export const TOP = 0.27;        // dessus des rails, au-dessus du bas de la case du nœud
const GAUGE = 1.12;             // rails à ±1,12 du milieu (sous les roues du train)
const KEEP_RIGHT = 3;           // itinéraire : la voie de gauche d'une double voie compte pour 4 fois sa longueur (voir path)
const SLEEPER_W = 3.0, SLEEPER_D = 0.28, SLEEPER_H = 0.12, SPACING = 0.6;
const RAIL_W = 0.16, RAIL_H = 0.15;
export const MIN_RADIUS = 5;    // rayon de courbure minimal d'un virage (le train est long)
export const MAX_LEN = 96;      // longueur maximale d'un virage posé à la main
const MAX_SLOPE = 0.5;          // pente maximale (montée / longueur)
const LINE_STEP = 16;           // longue ligne : un nœud toutes les 16 cases
export const MAX_LINE_SLOPE = 0.25; // /voie en pente : un bloc de dénivelé toutes les 4 cases au plus
const SIDES = [1, -1];
// /voie : matériau des ponts et des tunnels (tablier et parois, parapet)
export const LINE_MATS = {
  pierre: [28, 32], bois: [18, 18], brique: [740, 740], beton: [746, 746], ardoise: [745, 745],
  paves: [748, 748], diorite: [263, 263], fer: [62, 62],
};
// les 6 directions de la grille (vers chaque voisin), en vecteurs de longueur 1
const DIRV = NEIGHBORS.map(([q, r]) => { const w = hexToWorld(q, r); return new THREE.Vector3(w.x, 0, w.z).normalize(); });

// axe (0..2) le plus proche d'une direction horizontale, et le côté (+1 / -1) qui la suit
export function axisOf(dx, dz) {
  let best = 0, bd = -1, side = 1;
  for (let a = 0; a < 3; a++) {
    const d = dx * AX[a].x + dz * AX[a].z;
    if (Math.abs(d) > bd) { bd = Math.abs(d); best = a; side = d >= 0 ? 1 : -1; }
  }
  return { axis: best, side };
}
// côté (0..5, comme facingVariant) le plus proche de la direction (dx, dz)
function sideOf(dx, dz) {
  let best = 0, bd = -Infinity;
  for (let i = 0; i < 6; i++) { const d = dx * Math.cos((Math.PI / 3) * i) + dz * Math.sin((Math.PI / 3) * i); if (d > bd) { bd = d; best = i; } }
  return best;
}
const chunkOf = (x, z) => { const { q, r } = worldToHex(x, z); return Math.floor(q / CS) + ',' + Math.floor(r / CS); };

// ---------- Textures (16 x 16) ----------
function tex(seed, fn) {
  let s = seed;
  const r = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  const c = document.createElement('canvas');
  c.width = c.height = 16;
  const g = c.getContext('2d');
  fn((x, y, col, w = 1, h = 1) => { g.fillStyle = col; g.fillRect(x, y, w, h); }, r);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function materials() {
  const sleeper = tex(11, (p, r) => { // traverse : acier sombre, boulons aux deux bouts
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) p(x, y, ['#2c2f35', '#30333a', '#282b30'][(r() * 3) | 0]);
    p(0, 0, '#43474f', 16, 1); p(0, 15, '#1a1c20', 16, 1);
    for (const x of [2, 12]) { p(x, 6, '#5a5f68', 2, 2); p(x + 1, 7, '#1a1c20'); }
  });
  const rail = tex(12, (p, r) => { // rail : acier poli, reflet sur le dessus
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) p(x, y, ['#9aa3ad', '#a3acb6', '#929ba5'][(r() * 3) | 0]);
    p(0, 0, '#d9e0e8', 16, 3); p(0, 13, '#5d646d', 16, 3);
  });
  return {
    sleeper: new THREE.MeshLambertMaterial({ map: sleeper }),
    rail: new THREE.MeshLambertMaterial({ map: rail }),
    post: new THREE.MeshLambertMaterial({ color: 0x3a3e46 }),
    straight: new THREE.MeshBasicMaterial({ color: 0x4cd964 }), // (panneau d'aiguillage : tout droit)
    branch: new THREE.MeshBasicMaterial({ color: 0xff9a2e }),   // (la branche)
    stripes: new THREE.MeshLambertMaterial({ map: tex(13, (p) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) p(x, y, ((x + y) >> 2) & 1 ? '#f2f2ee' : '#c8261e'); }) }), // (butoir)
    // (signal : sa cible noire, sa plaque rayée blanc et noir, ses feux allumés ou éteints)
    target: new THREE.MeshLambertMaterial({ color: 0x18191c }),
    plate: new THREE.MeshLambertMaterial({ map: tex(14, (p) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) p(x, y, ((x + y) >> 2) & 1 ? '#f2f2ee' : '#1c1d20'); }) }),
    redOn: new THREE.MeshBasicMaterial({ color: 0xff3a26 }),
    redOff: new THREE.MeshLambertMaterial({ color: 0x3c1410 }),
    greenOn: new THREE.MeshBasicMaterial({ color: 0x3aff78 }),
    greenOff: new THREE.MeshLambertMaterial({ color: 0x10301a }),
  };
}

const SIGNAL_RANGE = 800; // (cases : un signal surveille au plus jusque-là)
export const SKY_Y = 500; // (hauteur d'une ligne spatiale)

// Morceau du tracé où tombe la distance u (dichotomie : un grand virage a des milliers de points)
function seg(len, u) {
  let i = 0, hi = len.length - 2;
  while (i < hi) { const mid = (i + hi + 1) >> 1; if (len[mid] < u) i = mid; else hi = mid - 1; }
  return i;
}

export class TrackSystem {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.nodes = new Map();    // "q,r,y" -> nœud
    this.edges = new Map();    // clé -> tronçon
    this.links = [];           // tronçons posés : { t: 'c' (virage) | 'l' (longue ligne), a, as, b, bs }
    this.switches = new Map(); // "clé du nœud/côté" -> tronçon choisi (0 : tout droit, 1 : la branche)
    this.buckets = new Map();  // chunk -> { q, r, pieces, nodes, group } (dessin)
    this.dirty = true;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.M = null;
    this.version = 0;          // (augmente à chaque reconstruction : les trains se recalent)
    this.stations = [];        // gares : { key, q, r, y, pos, name }
    this.names = new Map();    // "q,r,y" -> nom de la gare
    this.props = [];           // butoirs et panneaux : { key, q, r, y, kind, facing, pos, kmh }
    this.limits = new Map();   // "q,r,y" -> vitesse du panneau (km/h ; 0 : fin de limitation)
    this.detectors = [];       // détecteurs de train : { key, q, r, y, pos }
    // (chunks dont les modifications ont des voies, gares, panneaux ou détecteurs : le réseau
    // n'est cherché que là ; null : à trouver en parcourant toutes les modifications du monde)
    this.chunksWith = null;
    this.modsRef = null;
    this.pending = [];         // (cases changées depuis la dernière mise à jour : q, r, y à la suite)
    this.pendingLinks = [];    // (tronçons posés depuis la dernière mise à jour)
    this.adoptedQ = new Set(); // (chunks arrivés avec des rails de mine : à reprendre sans se presser)
    this.dirtyB = new Set();   // (chunks dont le dessin est peut-être à refaire)
    this.propBy = new Map();   // "q,r,y" -> butoir, panneau ou signal
    this.stBy = new Map();     // "q,r,y" -> gare
    this.detBy = new Map();    // "q,r,y" -> détecteur
    this.longs = new Set();    // (lignes spatiales : hors des chunks)
    this.longView = new Map(); // (ligne spatiale -> le bout dessiné autour du joueur)
    this.stamp = 0;            // (nearest : un tronçon inscrit dans plusieurs chunks n'est testé qu'une fois)
  }

  // un bloc a changé dans le monde (voir world.onAnySet dans main.js)
  onBlock(q, r, y, id, old) {
    const on = isTrack(id) || isStation(id) || isProp(id) || isDetector(id);
    if (on || isTrack(old) || isStation(old) || isProp(old) || isDetector(old)) {
      // (un rail qui change d'axe garde ses tronçons posés : le réseau complet s'en occupe, c'est rare)
      if (this.dirty || this.hold || (isTrack(id) && isTrack(old))) this.dirty = true;
      else this.pending.push(q, r, y);
    }
    if (this.chunksWith && on) this.chunksWith.add(chunkKey(Math.floor(q / CS), Math.floor(r / CS)));
  }
  // Des rails de mine abandonnée arrivent avec le chunk k (voir world.adoptRails) : ils seront
  // repris au plus 3 fois par seconde (on en découvre souvent en se déplaçant)
  adopted(k) {
    this.chunksWith?.add(k);
    this.adoptedQ.add(k);
  }
  clear() {
    this.chunksWith = null;
    this.links = [];
    this.switches.clear();
    this.names.clear();
    this.limits.clear();
    this.dirty = true;
    this.pending.length = 0;
    this.pendingLinks.length = 0;
    this.adoptedQ.clear();
  }
  serialize() {
    return { links: this.links.map((c) => ({ ...c })), switches: [...this.switches].filter(([, v]) => v), names: [...this.names], limits: [...this.limits] };
  }
  load(data) {
    const ok = (c) => c && typeof c.a === 'string' && typeof c.b === 'string' && Math.abs(c.as) === 1 && Math.abs(c.bs) === 1;
    // (anciennes sauvegardes : « curves », que des virages)
    this.links = [...(data?.links || []), ...(data?.curves || []).map((c) => ({ t: 'c', ...c }))].filter(ok).map((c) => ({ t: c.t === 'l' || c.t === 'x' ? c.t : 'c', a: c.a, as: c.as, b: c.b, bs: c.bs }));
    this.switches = new Map((Array.isArray(data?.switches) ? data.switches : []).filter((e) => Array.isArray(e) && typeof e[0] === 'string' && Number.isInteger(e[1])));
    this.names = new Map((Array.isArray(data?.names) ? data.names : []).filter((e) => Array.isArray(e) && typeof e[0] === 'string' && typeof e[1] === 'string').map(([k, n]) => [k, n.slice(0, 32)]));
    this.limits = new Map((Array.isArray(data?.limits) ? data.limits : []).filter((e) => Array.isArray(e) && typeof e[0] === 'string' && Number.isInteger(e[1]) && e[1] >= 0 && e[1] <= 400));
    this.chunksWith = null;
    this.dirty = true;
  }

  // ---------- Le réseau ----------
  scan() {
    const nodes = new Map();
    this.stations = [];
    this.props = [];
    this.detectors = [];
    this.propBy = new Map();
    this.stBy = new Map();
    this.detBy = new Map();
    // (seulement les chunks qui en ont : sans ça, chaque rail posé relisait tout ce qui a été
    // construit dans le monde)
    const mods = this.world.mods, full = !this.chunksWith || this.modsRef !== mods, found = new Set();
    for (const k of full ? mods.keys() : this.chunksWith) {
      const m = mods.get(k);
      if (!m) continue;
      let has = false;
      for (const id of m.values()) if (isTrack(id) || isStation(id) || isProp(id) || isDetector(id)) { has = true; break; }
      if (!has) continue;
      found.add(k);
      const [cq, cr] = k.split(',').map(Number);
      for (const [i, id] of m) {
        const st = isStation(id), pr = isProp(id), de = isDetector(id);
        if (!isTrack(id) && !st && !pr && !de) continue;
        const q = cq * CS + (i % CS), r = cr * CS + (Math.floor(i / CS) % CS), y = Math.floor(i / (CS * CS)) - DEEP;
        if (pr) this.addProp(q, r, y, id);
        else if (de) this.addDetector(q, r, y);
        else if (st) this.addStation(q, r, y);
        else { const n = this.newNode(q, r, y, id); nodes.set(n.key, n); }
      }
    }
    this.chunksWith = found;
    this.modsRef = mods;
    return nodes;
  }
  newNode(q, r, y, id) {
    const c = hexToWorld(q, r);
    return { key: q + ',' + r + ',' + y, q, r, y, axis: TRACK_IDS.indexOf(id), pos: new THREE.Vector3(c.x, y + TOP, c.z), sides: { 1: [], '-1': [] }, stub: { 1: null, '-1': null }, sw: false };
  }
  addProp(q, r, y, id) {
    const c = hexToWorld(q, r), key = q + ',' + r + ',' + y;
    const p = { key, q, r, y, pos: new THREE.Vector3(c.x, y, c.z), kind: BLOCKS[id].prop, facing: BLOCKS[id].facing || 0, att: null };
    this.props.push(p);
    this.propBy.set(key, p);
    return p;
  }
  addStation(q, r, y) {
    const c = hexToWorld(q, r), key = q + ',' + r + ',' + y;
    const st = { key, q, r, y, pos: new THREE.Vector3(c.x, y + 0.5, c.z), att: null };
    this.stations.push(st);
    this.stBy.set(key, st);
    return st;
  }
  addDetector(q, r, y) {
    const c = hexToWorld(q, r), key = q + ',' + r + ',' + y, d = { key, q, r, y, pos: new THREE.Vector3(c.x, y, c.z) };
    this.detectors.push(d);
    this.detBy.set(key, d);
  }
  // (un côté de nœud : au plus deux tronçons, dont un seul droit)
  room(n, s, straight) { const l = n.sides[s]; return l.length < 2 && !(straight && l.some((e) => !e.curve)); }
  has(n, s) { return n.sides[s].length > 0; }
  full(n, s) { return n.sides[s].length >= 2; }
  isSwitch(n) { return SIDES.some((s) => n.sides[s].length > 1); }
  rebuild() {
    this.dirty = false;
    this.pending.length = 0;
    this.pendingLinks.length = 0;
    this.adoptedQ.clear();
    this.rebuiltAt = performance.now();
    this.version++;
    this.oldEdges = this.edges; // (un tronçon qui n'a pas changé garde son tracé, voir link)
    this.longs.clear();
    this.nodes = this.scan();
    this.edges = new Map();
    // tronçons posés (ceux dont un bout a disparu s'en vont)
    this.links = this.links.filter((c) => {
      const a = this.nodes.get(c.a), b = this.nodes.get(c.b), straight = c.t !== 'c';
      if (!a || !b || a === b || !this.room(a, c.as, straight) || !this.room(b, c.bs, straight)) return false;
      this.link(a, c.as, b, c.bs, !straight, c.t);
      return true;
    });
    // lignes droites entre voisins du même axe, puis pentes
    for (const n of this.nodes.values()) this.autoStraight(n, 1);
    for (const n of this.nodes.values()) for (const s of SIDES) this.autoSlope(n, s);
    // (sur chaque côté : le tout droit d'abord, la branche ensuite)
    for (const n of this.nodes.values()) for (const s of SIDES) n.sides[s].sort((a, b) => a.curve - b.curve);
    this.oldEdges = null;
    const old = this.index();
    // gares : leur nom (« Gare 1 », « Gare 2 »... si on ne l'a pas changé) et leur point sur la voie
    const used = new Set(this.stations.map((st) => this.names.get(st.key)).filter(Boolean));
    for (const st of this.stations.sort((a, b) => (a.key < b.key ? -1 : 1))) { this.nameStation(st, used); this.attachStation(st); }
    for (const p of this.props) this.attachProp(p);
    this.sync(old);
  }
  // Ligne droite vers le voisin du même axe (côté s du nœud n)
  autoStraight(n, s) {
    const [dq, dr] = NEIGHBORS[s > 0 ? n.axis : n.axis + 3];
    const m = this.nodes.get((n.q + dq) + ',' + (n.r + dr) + ',' + n.y);
    if (!m || m.axis !== n.axis || !this.room(n, s, true) || !this.room(m, -s, true)) return;
    if (s > 0) this.link(n, 1, m, -1, false, 's'); else this.link(m, 1, n, -1, false, 's');
  }
  // Pente : un bout de voie libre et, plus loin dans son axe, un nœud un peu plus haut ou plus bas
  autoSlope(n, s) {
    if (!this.room(n, s, true)) return;
    const [dq, dr] = NEIGHBORS[s > 0 ? n.axis : n.axis + 3];
    for (let k = 1; k <= LINE_STEP; k++) {
      const q = n.q + dq * k, r = n.r + dr * k, pre = q + ',' + r + ',';
      let m = null;
      for (let dy = -3; dy <= 3 && !m; dy++) m = this.nodes.get(pre + (n.y + dy)) || null;
      if (!m) continue;
      // (trop raide, déjà relié, ou pas dans le même axe : rien)
      if (m.y !== n.y && Math.abs(m.y - n.y) * 4 <= k && m.axis === n.axis && this.room(m, -s, true)) {
        if (s > 0) this.link(n, 1, m, -1, false, 'p'); else this.link(m, 1, n, -1, false, 'p');
      }
      return;
    }
  }
  nameStation(st, used) {
    if (!this.names.has(st.key)) {
      let num = 1;
      while (used.has('Gare ' + num)) num++;
      this.names.set(st.key, 'Gare ' + num);
      used.add('Gare ' + num);
    }
    st.name = this.names.get(st.key);
  }
  // (son point sur la voie, le plus proche, à moins de 6 cases : les trains en pilote automatique s'y arrêtent)
  attachStation(st) {
    const h = this.nearest(st.pos.x, st.pos.y, st.pos.z, 1, 0, 6);
    if (!h) return;
    const u = h.rev ? h.e.L - h.s : h.s;
    (h.e.stops ||= []).push({ u, st });
    st.att = h.e;
  }
  // panneaux : leur vitesse (40 km/h si on ne l'a pas changée) et leur point sur la voie (à moins
  // de 5 cases) ; butoirs : tournés vers le bout de voie le plus proche
  attachProp(p) {
    const h = this.nearest(p.pos.x, p.pos.y + 0.3, p.pos.z, 1, 0, p.kind === 'buffer' ? 2.5 : 5);
    p.att = h ? h.e : null;
    if (p.kind === 'signal') {
      // (il commande les trains qui roulent vers sa face : p.rev, le sens du tronçon qu'ils suivent)
      p.red ??= false; p.e = null;
      if (!h) return;
      const u = h.rev ? h.e.L - h.s : h.s, d = this.dirAt({ e: h.e, s: u, rev: false }, new THREE.Vector3()), a = (Math.PI / 3) * p.facing;
      Object.assign(p, { e: h.e, u, rev: d.x * Math.cos(a) + d.z * Math.sin(a) >= 0 });
      (h.e.sigs ||= []).push({ u, sg: p });
    } else if (p.kind === 'sign') {
      p.kmh = this.limits.has(p.key) ? this.limits.get(p.key) : 40;
      p.along = null;
      if (h) { const u = h.rev ? h.e.L - h.s : h.s; (h.e.signs ||= []).push({ u, sg: p }); p.along = this.dirAt({ e: h.e, s: h.s, rev: h.rev }, new THREE.Vector3()); }
    } else {
      p.toward = null;
      if (!h) return;
      const at = this.pointAt(h, new THREE.Vector3());
      p.toward = new THREE.Vector3(at.x - p.pos.x, 0, at.z - p.pos.z);
      if (p.toward.lengthSq() < 0.01) p.toward = this.dirAt(h, new THREE.Vector3()).negate();
      p.toward.y = 0;
      p.toward.normalize();
    }
  }
  // (l'enlève de son tronçon ; à rattacher ensuite)
  detach(x) {
    const e = x.att;
    x.att = null;
    if (!e) return;
    if (x.kind === undefined) { if (e.stops) e.stops = e.stops.filter((o) => o.st !== x); }
    else if (x.kind === 'sign') { if (e.signs) e.signs = e.signs.filter((o) => o.sg !== x); }
    else if (x.kind === 'signal' && e.sigs) e.sigs = e.sigs.filter((o) => o.sg !== x);
  }

  // ---------- Mise à jour locale ----------
  // Ce qui a changé depuis la dernière fois (cases, tronçons posés) est repris ici, sans toucher au
  // reste : le coût dépend de ce qu'on a posé, pas de la taille du réseau.
  applyPending() {
    const now = performance.now();
    // (rails de mine : ceux de ce chunk que le réseau ne connaît pas encore)
    if (this.adoptedQ.size && now - (this.rebuiltAt || 0) > 330) {
      for (const k of this.adoptedQ) {
        const m = this.world.mods.get(k);
        if (!m) continue;
        const [cq, cr] = k.split(',').map(Number);
        for (const [i, id] of m) {
          if (!isTrack(id)) continue;
          const q = cq * CS + (i % CS), r = cr * CS + (Math.floor(i / CS) % CS), y = Math.floor(i / (CS * CS)) - DEEP;
          if (!this.nodes.has(q + ',' + r + ',' + y)) this.pending.push(q, r, y);
        }
      }
      this.adoptedQ.clear();
    }
    if (!this.pending.length && !this.pendingLinks.length) return;
    const list = this.pending, links = this.pendingLinks, count = list.length / 3;
    // (énormément de cases d'un coup : autant tout reprendre)
    if (count > 64 && count > this.nodes.size / 8) { this.rebuild(); return; }
    this.pending = [];
    this.pendingLinks = [];
    this.rebuiltAt = now;
    this.version++;
    const w = this.work = { T: new Set(), sides: new Set(), dropped: new Map(), added: [], again: new Set(), linksGone: false };
    for (let i = 0; i < list.length; i += 3) this.changeCell(list[i], list[i + 1], list[i + 2], w);
    for (const c of links) {
      const a = this.nodes.get(c.a), b = this.nodes.get(c.b);
      if (a) w.T.add(a);
      if (b) w.T.add(b);
    }
    // (les tronçons automatiques des nœuds touchés sont repris ; ceux qui ne changent pas sont
    // retrouvés tels quels dans link : leur dessin ne bouge pas)
    for (const n of [...w.T]) for (const s of SIDES) for (const e of [...n.sides[s]]) {
      if (e.t !== 's' && e.t !== 'p') continue;
      w.T.add(e.a === n && e.as === s ? e.b : e.a);
      this.dropEdge(e, w);
    }
    for (const c of links) {
      const a = this.nodes.get(c.a), b = this.nodes.get(c.b), straight = c.t !== 'c';
      if (!a || !b || a === b || !this.room(a, c.as, straight) || !this.room(b, c.bs, straight)) { this.links.splice(this.links.indexOf(c), 1); continue; }
      this.link(a, c.as, b, c.bs, !straight, c.t);
    }
    for (const n of w.T) for (const s of SIDES) this.autoStraight(n, s);
    for (const n of w.T) for (const s of SIDES) this.autoSlope(n, s);
    this.work = null;
    if (w.linksGone) this.links = this.links.filter((c) => this.nodes.has(c.a) && this.nodes.has(c.b));
    // le dessin : ce qui est parti, ce qui est nouveau
    for (const e of w.dropped.values()) {
      this.unplace(e);
      for (const o of e.stops || []) w.again.add(o.st);
      for (const o of e.signs || []) w.again.add(o.sg);
      for (const o of e.sigs || []) w.again.add(o.sg);
      for (const p of this.props) if (p.att === e) w.again.add(p);
    }
    for (const e of w.added) this.place(e, e.key);
    for (const n of w.sides) {
      for (const s of SIDES) n.sides[s].sort((a, b) => a.curve - b.curve);
      if (this.nodes.get(n.key) === n) this.dress(n);
    }
    // ce qui est posé à côté de la voie : à rattacher, si sa voie a changé
    for (const e of w.added) {
      let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
      for (const p of e.pts) { if (p.x < x0) x0 = p.x; if (p.x > x1) x1 = p.x; if (p.z < z0) z0 = p.z; if (p.z > z1) z1 = p.z; }
      const near = (x) => x.pos.x > x0 - 7 && x.pos.x < x1 + 7 && x.pos.z > z0 - 7 && x.pos.z < z1 + 7;
      for (const p of this.props) if (near(p)) w.again.add(p);
      for (const st of this.stations) if (near(st)) w.again.add(st);
    }
    for (const x of w.again) {
      this.detach(x);
      if (x.kind === undefined) { if (this.stBy.get(x.key) === x) this.attachStation(x); continue; }
      if (this.propBy.get(x.key) !== x) continue;
      this.attachProp(x);
      this.dirtyB.add(this.bucket(this.ckOf(x)));
    }
    // (les doubles voies sont à revoir, voir hand)
    if (w.added.length || w.dropped.size) for (const e of this.edges.values()) e.hand = undefined;
    this.flush();
  }
  // Une case a changé : le nœud, le panneau, la gare ou le détecteur qu'elle contient suit le monde
  changeCell(q, r, y, w) {
    const key = q + ',' + r + ',' + y, cq = Math.floor(q / CS), cr = Math.floor(r / CS);
    const id = this.world.mods.get(chunkKey(cq, cr))?.get(((y + DEEP) * CS + (r - cr * CS)) * CS + (q - cq * CS)) || 0;
    const n = this.nodes.get(key);
    if (n && !isTrack(id)) this.dropNode(n, w);
    else if (!n && isTrack(id)) {
      const m = this.newNode(q, r, y, id);
      this.nodes.set(key, m);
      w.T.add(m);
      w.sides.add(m);
      this.around(q, r, y, w.T);
    }
    let p = this.propBy.get(key);
    if (p && !(isProp(id) && BLOCKS[id].prop === p.kind && (BLOCKS[id].facing || 0) === p.facing)) {
      const b = this.bucket(this.ckOf(p));
      b.props = b.props.filter((o) => o !== p);
      this.dirtyB.add(b);
      this.detach(p);
      this.props.splice(this.props.indexOf(p), 1);
      this.propBy.delete(key);
      p = null;
    }
    if (!p && isProp(id)) {
      p = this.addProp(q, r, y, id);
      const b = this.bucket(this.ckOf(p));
      b.props.push(p);
      w.again.add(p);
    }
    let st = this.stBy.get(key);
    if (st && !isStation(id)) {
      this.detach(st);
      this.stations.splice(this.stations.indexOf(st), 1);
      this.stBy.delete(key);
    } else if (!st && isStation(id)) {
      st = this.addStation(q, r, y);
      this.nameStation(st, new Set(this.stations.map((o) => o.name).filter(Boolean)));
      w.again.add(st);
    }
    const d = this.detBy.get(key);
    if (d && !isDetector(id)) { this.detectors.splice(this.detectors.indexOf(d), 1); this.detBy.delete(key); }
    else if (!d && isDetector(id)) this.addDetector(q, r, y);
  }
  dropNode(n, w) {
    for (const s of SIDES) for (const e of [...n.sides[s]]) {
      const o = e.a === n && e.as === s ? e.b : e.a;
      w.T.add(o);
      if (e.t !== 's' && e.t !== 'p') w.linksGone = true;
      this.dropEdge(e, w);
      e.gone = true; // (ne reviendra pas : un de ses bouts n'est plus là)
    }
    for (const s of SIDES) if (n.stub[s]) { this.unplace(n.stub[s]); n.stub[s] = null; }
    if (n.sw) { const b = this.bucket(this.ckOf(n)); b.nodes = b.nodes.filter((o) => o !== n); this.dirtyB.add(b); }
    this.nodes.delete(n.key);
    w.T.delete(n);
    w.sides.delete(n);
    this.around(n.q, n.r, n.y, w.T);
  }
  dropEdge(e, w) {
    const la = e.a.sides[e.as], lb = e.b.sides[e.bs];
    la.splice(la.indexOf(e), 1);
    lb.splice(lb.indexOf(e), 1);
    this.edges.delete(e.key);
    w.dropped.set(e.key, e);
    w.sides.add(e.a);
    w.sides.add(e.b);
  }
  // Les nœuds qui voient la case (q, r, y) en regardant le long de leur axe (voir autoSlope)
  around(q, r, y, T) {
    for (let k = 0; k < 6; k++) {
      const [dq, dr] = NEIGHBORS[k], axis = k % 3;
      for (let i = 1; i <= LINE_STEP; i++) {
        const pre = (q + dq * i) + ',' + (r + dr * i) + ',';
        for (let dy = -3; dy <= 3; dy++) {
          const m = this.nodes.get(pre + (y + dy));
          if (m && m.axis === axis) T.add(m);
        }
      }
    }
  }
  // Vitesse d'un panneau (clic droit : la suivante) ; renvoie la nouvelle (km/h, 0 : fin)
  nextLimit(key) {
    const L = [20, 40, 60, 80, 100, 120, 160, 200, 0], cur = this.limits.has(key) ? this.limits.get(key) : 40;
    const v = L[(L.indexOf(cur) + 1) % L.length];
    this.setLimit(key, v);
    return v;
  }
  setLimit(key, v) {
    this.showLimit(key, v);
    this.onChange?.({ lim: [key, v] }); // (en ligne : juste ce panneau, pas tout le réseau)
  }
  // Seule la plaque du panneau change : ni le réseau ni le dessin de son chunk ne sont refaits
  showLimit(key, v) {
    this.limits.set(key, v);
    const p = this.propBy.get(key);
    if (!p || p.kind !== 'sign') return;
    p.kmh = v;
    if (p.plates) { const mat = this.signMat(v); for (const o of p.plates) o.material = mat; }
    const b = this.buckets.get(this.ckOf(p));
    if (b) b.sig = this.signature(b);
  }
  propAt(q, r, y) { this.update(); return this.propBy.get(q + ',' + r + ',' + y) || null; }
  // Nom d'une gare (clic droit dessus)
  rename(key, name) {
    if (!this.stBy.has(key)) return false;
    this.showName(key, name);
    this.onChange?.({ name: [key, name.slice(0, 32)] });
    return true;
  }
  showName(key, name) {
    this.names.set(key, name.slice(0, 32));
    const st = this.stBy.get(key);
    if (st) st.name = this.names.get(key);
  }
  // Ce que l'hôte vient de changer (voir net.js : un changement sans tout renvoyer)
  applyDelta(d) {
    const str = (x) => typeof x === 'string';
    if (Array.isArray(d.lim) && str(d.lim[0]) && Number.isInteger(d.lim[1]) && d.lim[1] >= 0 && d.lim[1] <= 400) this.showLimit(d.lim[0], d.lim[1]);
    if (Array.isArray(d.name) && str(d.name[0]) && str(d.name[1])) this.showName(d.name[0], d.name[1]);
    if (Array.isArray(d.sw) && str(d.sw[0]) && Number.isInteger(d.sw[1])) {
      const k = d.sw[0], n = this.nodes.get(k.slice(0, k.lastIndexOf('/')));
      this.switches.set(k, d.sw[1]);
      if (n) this.showSwitch(n);
    }
  }
  stationAt(q, r, y) { return this.stBy.get(q + ',' + r + ',' + y) || null; }
  // Tronçon de a (côté as) à b (côté bs) : ligne droite, ou courbe de Bézier tangente aux deux axes
  link(a, as, b, bs, curve, t) {
    const key = t + ':' + a.key + '/' + as + '>' + b.key + '/' + bs, w = this.work;
    // (repris tel quel pendant une mise à jour locale : même tronçon, même dessin)
    const back = w?.dropped.get(key);
    if (back && !back.gone && back.a === a && back.b === b) {
      w.dropped.delete(key);
      w.sides.add(a);
      w.sides.add(b);
      a.sides[as].push(back);
      b.sides[bs].push(back);
      this.edges.set(key, back);
      return back;
    }
    // (un tronçon qui n'a pas bougé garde son tracé : un virage en a des centaines de points)
    const ax = a.axis * 3 + b.axis, was = this.oldEdges?.get(key);
    const e = was && was.ax === ax ? { pts: was.pts, len: was.len, L: was.L, cells: was.cells, turn: was.turn }
      : this.shape(a.pos, AX[a.axis].clone().multiplyScalar(as), b.pos, AX[b.axis].clone().multiplyScalar(bs), curve);
    Object.assign(e, { a, as, b, bs, curve, t, ax, key });
    if (t === 'x') e.dir = e.pts[1].clone().sub(e.pts[0]).normalize();
    a.sides[as].push(e);
    b.sides[bs].push(e);
    this.edges.set(key, e);
    if (w) { w.added.push(e); w.sides.add(a); w.sides.add(b); }
    return e;
  }
  shape(p0, t0, p3, t3, curve) {
    let pts;
    if (!curve) pts = [p0.clone(), p3.clone()];
    else {
      const d = p0.distanceTo(p3), k = d * 0.42;
      const p1 = p0.clone().addScaledVector(t0, k), p2 = p3.clone().addScaledVector(t3, k);
      const n = Math.max(8, Math.ceil(d * 3));
      pts = [];
      for (let i = 0; i <= n; i++) {
        const t = i / n, u = 1 - t;
        pts.push(new THREE.Vector3()
          .addScaledVector(p0, u * u * u).addScaledVector(p1, 3 * u * u * t)
          .addScaledVector(p2, 3 * u * t * t).addScaledVector(p3, t * t * t));
      }
    }
    const len = [0];
    for (let i = 1; i < pts.length; i++) len.push(len[i - 1] + pts[i].distanceTo(pts[i - 1]));
    return { pts, len, L: len[len.length - 1] };
  }
  // Un virage possible de a (côté as) à une case (q, r, y), axe et côté donnés ? Renvoie un
  // message d'erreur, ou { len } (sa longueur)
  check(a, as, q, r, y, axis, bs, maxLen = MAX_LEN) {
    const c = hexToWorld(q, r), p3 = new THREE.Vector3(c.x, y + TOP, c.z);
    const e = this.shape(a.pos, AX[a.axis].clone().multiplyScalar(as), p3, AX[axis].clone().multiplyScalar(bs), true);
    if (e.L < 2) return 'Trop près : le virage doit faire au moins 2 cases';
    if (e.L > maxLen) return `Trop loin : un virage fait au plus ${maxLen} cases`;
    // rayon de courbure (dans le plan) et pente, point par point
    const t = new THREE.Vector3(), t2 = new THREE.Vector3();
    for (let i = 1; i + 1 < e.pts.length; i++) {
      t.subVectors(e.pts[i], e.pts[i - 1]); t2.subVectors(e.pts[i + 1], e.pts[i]);
      const ds = (t.length() + t2.length()) / 2;
      if (Math.abs(t2.y) / (Math.hypot(t2.x, t2.z) || 1e-6) > MAX_SLOPE) return 'Trop raide : la voie monte au plus d\'un bloc toutes les 2 cases';
      const ang = Math.abs(Math.atan2(t.x * t2.z - t.z * t2.x, t.x * t2.x + t.z * t2.z));
      if (ang > 1e-4 && ds / ang < MIN_RADIUS) return `Virage trop serré pour le train (rayon de ${MIN_RADIUS} cases au moins) : éloigne le point d'arrivée`;
    }
    return { len: e.L };
  }
  addCurve(a, as, bKey, bs) {
    const c = { t: 'c', a: a.key, as, b: bKey, bs };
    this.links.push(c);
    if (!this.dirty && !this.hold) this.pendingLinks.push(c);
    this.onChange?.(); // (en ligne : l'hôte envoie les tronçons aux invités)
  }

  // ---------- Aiguillages ----------
  swKey(n, s) { return n.key + '/' + s; }
  // tronçon choisi sur le côté s du nœud n
  chosen(n, s) {
    const l = n.sides[s];
    return l.length ? l[(this.switches.get(this.swKey(n, s)) || 0) % l.length] : null;
  }
  // (seule la lampe du panneau change de couleur : le dessin du chunk reste)
  showSwitch(n) {
    const s = SIDES.find((x) => n.sides[x].length > 1), c = s !== undefined && this.chosen(n, s);
    if (n.lamp && c) n.lamp.material = c.curve ? this.M.branch : this.M.straight;
    const b = this.buckets.get(this.ckOf(n));
    if (b) b.sig = this.signature(b);
  }
  // bascule l'aiguillage du nœud n ; renvoie 'tout droit' ou 'la branche' (ou null : pas d'aiguillage)
  toggle(n) {
    const s = SIDES.find((x) => n.sides[x].length > 1);
    if (s === undefined) return null;
    const k = this.swKey(n, s), v = ((this.switches.get(k) || 0) + 1) % n.sides[s].length;
    this.switches.set(k, v);
    this.showSwitch(n);
    this.onChange?.({ sw: [k, v] });
    return this.chosen(n, s).curve ? 'la branche' : 'tout droit';
  }

  // Le nœud (q, r, y) reçoit du courant (on) ou plus (voir circuits.js) : son aiguillage suit
  // (courant : la branche ; sans courant : tout droit)
  power(q, r, y, on) {
    this.update();
    const n = this.nodes.get(q + ',' + r + ',' + y);
    if (!n || !this.isSwitch(n)) return;
    const s = SIDES.find((x) => n.sides[x].length > 1), k = this.swKey(n, s);
    const want = on ? Math.max(0, n.sides[s].findIndex((e) => e.curve)) : 0;
    if ((this.switches.get(k) || 0) === want) return;
    this.switches.set(k, want);
    this.showSwitch(n);
    this.onChange?.({ sw: [k, want] });
    this.onSwitch?.(n, !!this.chosen(n, s).curve);
  }

  // Règle l'aiguillage du côté s du nœud n sur le tronçon i (itinéraire d'un train)
  setSwitch(n, s, i) {
    const k = this.swKey(n, s);
    if ((this.switches.get(k) || 0) === i) return;
    this.switches.set(k, i);
    this.showSwitch(n);
    this.onChange?.({ sw: [k, i] });
  }
  // Itinéraire : le chemin le plus court (sans faire demi-tour) de la position h jusqu'à la gare
  // goal. Renvoie les choix d'aiguillage à faire en route (Map « nœud/côté » -> tronçon), ou null
  // si la gare ne peut pas être atteinte dans ce sens
  // (avoid : tronçon et sens -> pénalité ; un train qui vient en face y est, ou va y passer :
  // le chemin prend l'autre voie s'il y en a une, sinon passe quand même)
  path(h, goal, avoid = null) {
    const id = (e, rev) => e.key + (rev ? '<' : '>');
    const has = (e) => e.stops?.some((p) => p.st.key === goal);
    const dist = new Map(), from = new Map(), heap = [];
    const push = (d, e, rev) => { heap.push([d, e, rev]); let i = heap.length - 1; while (i > 0) { const j = (i - 1) >> 1; if (heap[j][0] <= heap[i][0]) break; [heap[i], heap[j]] = [heap[j], heap[i]]; i = j; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[i], heap[m]] = [heap[m], heap[i]]; i = m; } } return top; };
    dist.set(id(h.e, h.rev), 0);
    push(0, h.e, h.rev);
    let found = null;
    for (let guard = 0; heap.length && guard < 200000; guard++) {
      const [d, e, rev] = pop();
      if (d > (dist.get(id(e, rev)) ?? Infinity)) continue;
      if (has(e)) { found = [e, rev]; break; }
      const n = rev ? e.a : e.b, side = rev ? e.as : e.bs;
      for (const x of n.sides[-side]) {
        const xr = !(x.a === n && x.as === -side), k = id(x, xr);
        // (on roule à droite : la voie de gauche d'une double voie coûte plus cher, voir hand)
        const h = this.hand(x), nd = d + x.L + (avoid?.get(k) || 0) + ((h > 0 && xr) || (h < 0 && !xr) ? x.L * KEEP_RIGHT + 30 : 0);
        if (nd < (dist.get(k) ?? Infinity)) { dist.set(k, nd); from.set(k, [e, rev, n, -side, x]); push(nd, x, xr); }
      }
    }
    if (!found) return null;
    const choices = new Map();
    for (let k = id(found[0], found[1]); from.has(k);) {
      const [e, rev, n, s, x] = from.get(k);
      if (n.sides[s].length > 1) choices.set(this.swKey(n, s), n.sides[s].indexOf(x));
      k = id(e, rev);
    }
    return choices;
  }

  // Côté du tronçon e dans une double voie (voies parallèles à 3..8 blocs) : 1 si l'autre voie est
  // à sa gauche quand on va de a vers b (on y roule donc à droite dans ce sens), -1 si elle est à
  // sa droite, 0 : voie seule (ou entre deux voies). Gardé sur le tronçon jusqu'à la reconstruction.
  hand(e) {
    if (e.hand !== undefined) return e.hand;
    if (e.t === 'x') return (e.hand = 0);
    if (this.handVer !== this.version) {
      // points de toutes les voies (tous les 2 blocs), rangés par zones de 8 x 8
      this.handVer = this.version;
      this.handGrid = new Map();
      const v = new THREE.Vector3();
      for (const x of this.edges.values()) {
        if (x.t === 'x') continue; // (ligne spatiale : des centaines de millions de cases, et rien à côté)
        for (let u = 0; u <= x.L; u += 2) {
          this.pointAt({ e: x, s: u, rev: false }, v);
          const k = Math.floor(v.x / 8) + ',' + Math.floor(v.z / 8);
          let l = this.handGrid.get(k);
          if (!l) this.handGrid.set(k, (l = []));
          l.push(x, v.x, v.y, v.z);
        }
      }
    }
    const p = new THREE.Vector3(), d = new THREE.Vector3();
    const near = (x, y, z) => {
      const l = this.handGrid.get(Math.floor(x / 8) + ',' + Math.floor(z / 8));
      if (l) for (let i = 0; i < l.length; i += 4) if (l[i] !== e && Math.abs(l[i + 2] - y) < 3 && Math.hypot(l[i + 1] - x, l[i + 3] - z) < 1.5) return true;
      return false;
    };
    let left = 0, right = 0;
    // (quelques points le long du tronçon : un seul ne suffit pas près des aiguillages)
    for (const f of [0.25, 0.5, 0.75]) {
      const h = { e, s: e.L * f, rev: false };
      this.pointAt(h, p); this.dirAt(h, d);
      for (let o = 3; o <= 8; o++) {
        if (near(p.x - d.z * o, p.y, p.z + d.x * o)) { right++; break; }
      }
      for (let o = 3; o <= 8; o++) {
        if (near(p.x + d.z * o, p.y, p.z - d.x * o)) { left++; break; }
      }
    }
    e.hand = left >= 2 && !right ? 1 : right >= 2 && !left ? -1 : 0;
    return e.hand;
  }

  // ---------- Parcours (pour les trains) ----------
  // Position sur la voie : { e (tronçon), s (distance parcourue depuis l'entrée), rev (on va de b vers a) }
  pointAt(h, out) {
    const { pts, len } = h.e, u = h.rev ? h.e.L - h.s : h.s;
    const i = seg(len, u);
    return out.copy(pts[i]).lerp(pts[i + 1], Math.max(0, Math.min(1, (u - len[i]) / ((len[i + 1] - len[i]) || 1))));
  }
  dirAt(h, out) {
    const { pts, len } = h.e, u = h.rev ? h.e.L - h.s : h.s;
    const i = seg(len, u);
    out.subVectors(pts[i + 1], pts[i]).normalize();
    return h.rev ? out.negate() : out;
  }
  // tronçon qui continue après le nœud n, quand on y entre par le côté side (pick : choisir
  // parmi plusieurs, sinon l'aiguillage décide)
  across(n, side, pick) {
    const l = n.sides[-side];
    if (!l.length) return null;
    const e = (l.length > 1 && pick?.(l)) || this.chosen(n, -side);
    return { e, rev: !(e.a === n && e.as === -side) };
  }
  // Avance de ds (négatif : recule). trail : clés des tronçons parcourus derrière (le train les a
  // pris : en reculant, on repasse par les mêmes branches). Renvoie la nouvelle position, end = vrai
  // si la voie s'arrête, back = nombre de nœuds repassés en reculant. choices (en avançant) : les aiguillages tels
  // que le train va les régler (son itinéraire, voir path), à la place de leur position du moment
  // (passed : y ajoute la clé de chaque tronçon quitté en avançant, ou pris en reculant)
  move(h, ds, trail = null, choices = null, passed = null) {
    let { e, s, rev } = h, back = 0;
    s += ds;
    // (un tronçon droit fait 1 case : on peut en traverser des milliers pour placer un long train)
    for (let guard = 0; ; guard++) {
      if (guard > 20000) return { e, s: Math.max(0, Math.min(e.L, s)), rev, end: true, back, guard: true };
      if (s > e.L) {
        const n = rev ? e.a : e.b, side = rev ? e.as : e.bs;
        const nx = this.across(n, side, choices && ((l) => l[choices.get(this.swKey(n, -side))]));
        if (!nx) return { e, s: e.L, rev, end: true, back };
        passed?.push(e.key);
        s -= e.L;
        ({ e, rev } = nx);
      } else if (s < 0) {
        const n = rev ? e.b : e.a, side = rev ? e.bs : e.as, k = trail?.[back];
        const nx = this.across(n, side, (l) => l.find((x) => x.key === k));
        if (!nx) return { e, s: 0, rev, end: true, back };
        // on arrive sur le tronçon précédent par son bout qui touche n : on le parcourt vers n
        ({ e, rev } = nx);
        passed?.push(e.key);
        rev = !rev;
        s += e.L;
        back++;
      } else break;
    }
    return { e, s, rev, end: false, back };
  }
  // En reculant depuis h par le chemin trail : la distance du premier aiguillage passé (une fois
  // derrière, on peut repartir sur une autre branche, ou un train d'en face peut nous contourner) ;
  // null avant max (skip : on passe les premiers, pour aller jusqu'au suivant ; out : y met le
  // nœud et le côté par où l'on repartira en avançant)
  switchBehind(h, trail, max, skip = 0, out = null) {
    let { e, rev } = h, acc = h.s, back = 0;
    while (acc <= max) {
      const n = rev ? e.b : e.a, side = rev ? e.bs : e.as;
      if ((n.sides[side].length > 1 || n.sides[-side].length > 1) && skip-- <= 0) { if (out) { out.n = n; out.side = side; } return acc; }
      const k = trail?.[back];
      const nx = this.across(n, side, (l) => l.find((x) => x.key === k));
      if (!nx) return null;
      e = nx.e; rev = !nx.rev; acc += e.L; back++;
    }
    return null;
  }
  // Ce qui attend le train devant la position h, à moins de maxDist cases : la prochaine gare
  // ({ dist, st } ; sauf skip, la gare qu'on vient de quitter), le prochain aiguillage qu'on prend
  // par la pointe ({ dist, node, branch }), le bout de la voie (dist ; endNode, endSide : le nœud du
  // bout et le côté par lequel on y arrive), ou null pour chacun
  // (opts : skip, la gare à ignorer ; want(gare), les gares à prendre en compte ; skipSign, le
  // panneau qu'on vient de passer ; sign : renvoie aussi le prochain panneau { dist, sg })
  ahead(h, maxDist, opts = null) {
    if (typeof opts === 'string' || opts === null) opts = { skip: opts };
    const { skip = null, want = null, skipSign = null } = opts;
    let { e, s, rev } = h, acc = 0;
    const out = { station: null, sw: null, end: null, sign: null, signal: null };
    for (let guard = 0; guard < 6000 && acc < maxDist; guard++) {
      if (!out.station && e.stops) {
        let best = null;
        for (const p of e.stops) {
          const at = rev ? e.L - p.u : p.u;
          if (at > s - 0.5 && p.st.key !== skip && (!want || want(p.st)) && (!best || at < best.at)) best = { at, st: p.st };
        }
        if (best) out.station = { dist: acc + best.at - s, st: best.st };
      }
      if (!out.sign && e.signs) {
        let best = null;
        for (const p of e.signs) {
          const at = rev ? e.L - p.u : p.u;
          if (at > s - 0.5 && p.sg.key !== skipSign && (!best || at < best.at)) best = { at, sg: p.sg };
        }
        if (best) out.sign = { dist: acc + best.at - s, sg: best.sg };
      }
      if (!out.signal && e.sigs) {
        // (le premier signal rouge tourné vers nous)
        let best = null;
        for (const p of e.sigs) {
          if (p.sg.rev !== rev || !p.sg.red) continue;
          const at = rev ? e.L - p.u : p.u;
          if (at > s - 0.5 && (!best || at < best.at)) best = { at, sg: p.sg };
        }
        if (best) out.signal = { dist: acc + best.at - s, sg: best.sg };
      }
      acc += e.L - s;
      const n = rev ? e.a : e.b, side = rev ? e.as : e.bs;
      if (!out.sw && n.sides[-side].length > 1) out.sw = { dist: acc, node: n, side: -side, branch: !!this.chosen(n, -side)?.curve };
      const nx = this.across(n, side);
      if (!nx) { out.end = acc; out.endNode = n; out.endSide = side; break; }
      ({ e, rev } = nx);
      s = 0;
    }
    return out;
  }
  // Position sur un nœud, tournée au plus près de la direction (dx, dz) ; null sans tronçon
  startAt(n, dx, dz) {
    const side = dx * AX[n.axis].x + dz * AX[n.axis].z >= 0 ? 1 : -1;
    const e = this.chosen(n, side);
    if (e) return { e, s: 0, rev: !(e.a === n && e.as === side) };
    const b = this.chosen(n, -side);
    if (!b) return null;
    // (pas de voie devant : au bout, tourné vers le bout)
    return { e: b, s: b.L, rev: b.a === n && b.as === -side };
  }
  // Point de voie le plus proche de (x, y, z), à moins de maxD (cases) : une position tournée
  // vers (dx, dz), ou null (pour poser un train entre deux nœuds d'une longue ligne)
  nearest(x, y, z, dx, dz, maxD = 1.6) {
    let best = null, bd = maxD;
    const test = (e) => {
      const P = e.pts, a0 = P[0], a1 = P[P.length - 1];
      if (Math.abs(a0.y - y) > 3 && Math.abs(a1.y - y) > 3) return;
      for (let i = 0; i + 1 < P.length; i++) {
        const a = P[i], b = P[i + 1], abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z;
        const t = Math.max(0, Math.min(1, ((x - a.x) * abx + (y - a.y) * aby + (z - a.z) * abz) / ((abx * abx + aby * aby + abz * abz) || 1)));
        const d = Math.hypot(a.x + abx * t - x, a.z + abz * t - z);
        if (d < bd) { bd = d; best = { e, u: e.len[i] + t * (e.len[i + 1] - e.len[i]), tx: abx, tz: abz }; }
      }
    };
    // (seulement les chunks autour du point : les tronçons y sont inscrits, voir place)
    const d = maxD + 1, stamp = ++this.stamp;
    const r0 = Math.floor(((z - d) * 2) / Math.sqrt(3) / CS), r1 = Math.floor(((z + d) * 2) / Math.sqrt(3) / CS);
    const q0 = Math.floor((x - d - (z + d) / Math.sqrt(3)) / CS), q1 = Math.floor((x + d - (z - d) / Math.sqrt(3)) / CS);
    for (let cr = r0; cr <= r1; cr++) for (let cq = q0; cq <= q1; cq++) {
      const b = this.buckets.get(chunkKey(cq, cr));
      if (b) for (const e of b.pieces) if (e.a && e.seen !== stamp) { e.seen = stamp; test(e); }
    }
    for (const e of this.longs) test(e);
    if (!best) return null;
    const rev = best.tx * dx + best.tz * dz < 0;
    return { e: best.e, s: rev ? best.e.L - best.u : best.u, rev };
  }

  // ---------- Dessin ----------
  // Chaque morceau de voie (tronçon, ou bout libre au-delà d'un nœud) est inscrit dans les chunks
  // qu'il traverse ; le dessin d'un chunk n'est construit que quand ce chunk est chargé.
  // (après un changement, seuls les chunks dont la voie a changé sont redessinés, tout de suite :
  // les autres gardent leur dessin, rien ne disparaît le temps de la reconstruction)
  bucket(k) {
    let b = this.buckets.get(k);
    if (!b) {
      const [cq, cr] = k.split(',').map(Number);
      this.buckets.set(k, (b = { k, q: cq * CS + (CS >> 1), r: cr * CS + (CS >> 1), pieces: new Set(), span: new Map(), nodes: [], props: [], group: null, sig: null }));
    }
    return b;
  }
  ckOf(x) { return (x.ck ||= chunkOf(x.pos.x, x.pos.z)); }
  // Les chunks que traverse un morceau de voie, et la portion du morceau dans chacun (gardés avec
  // lui : on ne les recalcule pas à chaque changement)
  cellsOf(piece) {
    if (piece.cells) return piece.cells;
    if (piece.t === 'x') return (piece.cells = []); // (une ligne spatiale : hors des chunks)
    const m = new Map(), { pts, len, L } = piece, p = new THREE.Vector3();
    // (un point tous les quarts de bloc : une voie qui ne fait que frôler le coin d'un chunk y est
    // quand même inscrite, sinon ce bout de voie n'était jamais dessiné : un trou dans les rails)
    const n = Math.max(1, Math.ceil(L / 0.25));
    let j = 0; // (u ne fait qu'avancer : on reprend où on en était)
    for (let i = 0; i <= n; i++) {
      const u = (i * L) / n;
      while (j < len.length - 2 && u > len[j + 1]) j++;
      p.copy(pts[j]).lerp(pts[j + 1], Math.max(0, Math.min(1, (u - len[j]) / ((len[j + 1] - len[j]) || 1))));
      const k = chunkOf(p.x, p.z), sp = m.get(k);
      if (sp) { if (u < sp[0]) sp[0] = u; if (u > sp[1]) sp[1] = u; } else m.set(k, [u, u]);
    }
    return (piece.cells = [...m]);
  }
  place(piece, id) {
    piece.id = id;
    if (piece.t === 'x') this.longs.add(piece);
    for (const [k, sp] of this.cellsOf(piece)) {
      const b = this.bucket(k);
      b.pieces.add(piece);
      // (la portion du morceau dans ce chunk : seule elle est dessinée, voir build)
      b.span.set(piece, sp);
      this.dirtyB.add(b);
    }
  }
  unplace(piece) {
    if (piece.t === 'x') this.longs.delete(piece);
    for (const [k] of this.cellsOf(piece)) {
      const b = this.buckets.get(k);
      if (!b) continue;
      b.pieces.delete(piece);
      b.span.delete(piece);
      this.dirtyB.add(b);
    }
  }
  // Ce qui se dessine autour d'un nœud : ses bouts de voie libres (un demi-tronçon au-delà), son
  // panneau s'il est un aiguillage
  dress(n) {
    for (const s of SIDES) {
      if (!n.sides[s].length && !n.stub[s]) { n.stub[s] = this.shape(n.pos, AX[n.axis], n.pos.clone().addScaledVector(AX[n.axis], s * 0.5), AX[n.axis], false); this.place(n.stub[s], 'b:' + n.key + '/' + s); }
      else if (n.sides[s].length && n.stub[s]) { this.unplace(n.stub[s]); n.stub[s] = null; }
    }
    const sw = this.isSwitch(n);
    if (sw === n.sw && !sw) return;
    const b = this.bucket(this.ckOf(n));
    if (sw !== n.sw) {
      n.sw = sw;
      if (sw) b.nodes.push(n); else b.nodes = b.nodes.filter((o) => o !== n);
    }
    this.dirtyB.add(b);
  }
  // Tout le réseau est rangé par chunks ; renvoie l'ancien rangement (voir sync)
  index() {
    this.M ||= materials();
    const old = this.buckets;
    this.buckets = new Map();
    for (const e of this.edges.values()) this.place(e, e.key);
    for (const n of this.nodes.values()) this.dress(n);
    for (const p of this.props) this.bucket(this.ckOf(p)).props.push(p);
    return old;
  }
  // (après le réseau complet : seuls les chunks dont la voie a changé sont redessinés, tout de suite)
  sync(old) {
    // signature de chaque chunk : ses morceaux et l'état de ses aiguillages
    for (const b of this.buckets.values()) b.sig = this.signature(b);
    for (const [k, b] of this.buckets) {
      const o = old.get(k);
      if (o?.group && o.sig === b.sig) { b.group = o.group; o.group = null; }
      else if (this.shown(b)) this.build(b);
    }
    for (const o of old.values()) this.unbuild(o);
    this.dirtyB.clear();
    this.visT = performance.now();
  }
  // (après une mise à jour locale : les chunks touchés seulement)
  flush() {
    for (const b of this.dirtyB) {
      if (!b.pieces.size && !b.nodes.length && !b.props.length) {
        this.unbuild(b);
        if (this.buckets.get(b.k) === b) this.buckets.delete(b.k);
        continue;
      }
      const sig = this.signature(b);
      if (sig === b.sig) continue;
      b.sig = sig;
      this.unbuild(b);
      if (this.shown(b)) this.build(b);
    }
    this.dirtyB.clear();
  }
  // Le chunk b est-il à dessiner ? (terrain chargé, ou à portée de vue : un chunk fait 16 cases,
  // on compte son rayon pour ne pas couper une voie au bord de la vue)
  shown(b) {
    if (this.world.isLoaded(b.q, b.r)) return true;
    const w = this.world, vx = w.viewX;
    if (vx === undefined) return false;
    b.x ??= hexToWorld(b.q, b.r).x;
    b.z ??= hexToWorld(b.q, b.r).z;
    return Math.hypot(b.x - vx, b.z - w.viewZ) <= (w.viewDist || 0) + CS;
  }
  signature(b) {
    const parts = [...b.pieces].map((x) => x.id).sort();
    for (const n of b.nodes) parts.push('s:' + n.key + '=' + SIDES.map((x) => this.switches.get(this.swKey(n, x)) || 0).join(','));
    for (const p of b.props) parts.push('p:' + p.key + p.kind + (p.kmh ?? '') + (p.toward ? p.toward.x.toFixed(2) + p.toward.z.toFixed(2) : '') + (p.along ? p.along.x.toFixed(2) + p.along.z.toFixed(2) : ''));
    return parts.join('|');
  }
  unbuild(b) {
    if (!b.group) return;
    b.group.traverse((c) => { if (c.geometry && !c.userData.shared) c.geometry.dispose(); });
    this.group.remove(b.group);
    b.group = null;
  }
  // Construit le dessin d'un chunk : ses traverses (maille instanciée), ses rails, ses panneaux
  build(b) {
    const mats = [], pos = [], nor = [], uv = [], idx = [];
    const tmp = new THREE.Vector3(), dir = new THREE.Vector3(), side = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), m = new THREE.Matrix4(), q = new THREE.Quaternion(), scl = new THREE.Vector3(1, 1, 1);
    const at = (e, u, p, d) => {
      const { pts, len } = e;
      const i = seg(len, u);
      p.copy(pts[i]).lerp(pts[i + 1], Math.max(0, Math.min(1, (u - len[i]) / ((len[i + 1] - len[i]) || 1))));
      d.subVectors(pts[i + 1], pts[i]).normalize();
    };
    // (b.k null : le bout dessiné d'une ligne spatiale, voir updateLongs)
    const mine = b.k === null ? () => true : (x, z) => chunkOf(x, z) === b.k;
    for (const e of b.pieces) {
      // seulement la portion du morceau qui passe dans ce chunk (un grand virage ou une longue
      // ligne traverse des dizaines de chunks : on ne refait pas tout son tracé pour chacun)
      const [s0, s1] = b.span.get(e) || [0, e.L], u0 = Math.max(0, s0 - 2.5), u1 = Math.min(e.L, s1 + 2.5);
      // (traverses également espacées, la première à une demi-distance du début)
      const n = Math.max(1, Math.round(e.L / SPACING));
      for (let k = Math.max(0, Math.floor((u0 * n) / e.L - 0.5)); k < n && ((k + 0.5) * e.L) / n <= u1; k++) {
        at(e, ((k + 0.5) * e.L) / n, tmp, dir);
        if (!mine(tmp.x, tmp.z)) continue;
        q.setFromAxisAngle(up, Math.atan2(-dir.z, dir.x));
        mats.push(m.compose(new THREE.Vector3(tmp.x, tmp.y - RAIL_H - SLEEPER_H / 2, tmp.z), q, scl).clone());
      }
      // deux rails : profil rectangulaire extrudé le long du tracé (les bouts de ce chunk)
      // (des morceaux de 2 blocs au plus, et un nouveau tous les 3° de virage : avant, un tous les
      // quarts de bloc partout, même en ligne droite, soit bien plus de triangles que nécessaire)
      if (e.turn === undefined) {
        e.turn = 0;
        for (let i = 2; i < e.pts.length; i++) {
          const ax = e.pts[i - 1].x - e.pts[i - 2].x, az = e.pts[i - 1].z - e.pts[i - 2].z, bx2 = e.pts[i].x - e.pts[i - 1].x, bz2 = e.pts[i].z - e.pts[i - 1].z;
          e.turn += Math.abs(Math.atan2(ax * bz2 - az * bx2, ax * bx2 + az * bz2));
        }
      }
      const steps = Math.max(1, Math.ceil(e.L / 2), Math.ceil(e.turn / 0.05));
      for (const off of [-GAUGE, GAUGE]) {
        let prev = null;
        for (let k = Math.max(0, Math.floor((u0 * steps) / e.L) - 1); k <= steps && (k - 1) * e.L / steps <= u1; k++) {
          const u = (k * e.L) / steps;
          at(e, u, tmp, dir);
          side.set(-dir.z, 0, dir.x).normalize();
          const c = tmp.clone().addScaledVector(side, off);
          const ring = [
            c.clone().addScaledVector(side, -RAIL_W / 2).setY(c.y - RAIL_H), c.clone().addScaledVector(side, -RAIL_W / 2),
            c.clone().addScaledVector(side, RAIL_W / 2), c.clone().addScaledVector(side, RAIL_W / 2).setY(c.y - RAIL_H),
          ];
          if (prev && mine(tmp.x, tmp.z)) {
            for (const [i0, i1, nrm] of [[0, 1, side.clone().negate()], [1, 2, up], [2, 3, side]]) {
              const base = pos.length / 3;
              for (const pp of [prev.ring[i0], prev.ring[i1], ring[i1], ring[i0]]) { pos.push(pp.x, pp.y, pp.z); nor.push(nrm.x, nrm.y, nrm.z); }
              uv.push(0, prev.u, 1, prev.u, 1, u, 0, u);
              idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
            }
          }
          prev = { ring, u };
        }
      }
    }
    // (le dessin est rangé par rapport à un point du chunk, le groupe placé là : en 32 bits, des
    // positions loin du centre du monde perdraient leur précision, voir origin.js)
    const bx = mats.length ? mats[0].elements[12] : pos.length ? pos[0] : b.nodes[0]?.pos.x ?? 0;
    const bz = mats.length ? mats[0].elements[14] : pos.length ? pos[2] : b.nodes[0]?.pos.z ?? 0;
    for (const mm of mats) { mm.elements[12] -= bx; mm.elements[14] -= bz; }
    for (let i = 0; i < pos.length; i += 3) { pos[i] -= bx; pos[i + 2] -= bz; }
    const g = new THREE.Group();
    g.position.set(bx, 0, bz);
    // (traverse : sans sa face du dessous, jamais vue ; des milliers sur une longue ligne)
    if (!this.sleeperGeo) {
      const box = new THREE.BoxGeometry(SLEEPER_D, SLEEPER_H, SLEEPER_W), idx = [...box.index.array];
      idx.splice(18, 6); // (faces : +x, -x, +y, -y, +z, -z ; 6 indices chacune)
      box.setIndex(idx);
      box.clearGroups();
      this.sleeperGeo = box;
    }
    if (mats.length) {
      const sl = new THREE.InstancedMesh(this.sleeperGeo, this.M.sleeper, mats.length);
      mats.forEach((mm, i) => sl.setMatrixAt(i, mm));
      sl.instanceMatrix.needsUpdate = true;
      sl.receiveShadow = true;
      sl.computeBoundingSphere();
      sl.userData.shared = true; // (sa forme est partagée : jamais libérée avec le chunk)
      sl.userData.based = true;
      g.add(sl);
    }
    if (pos.length) {
      const rg = new THREE.BufferGeometry();
      rg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      rg.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      rg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      rg.setIndex(idx);
      const rm = new THREE.Mesh(rg, this.M.rail);
      rm.userData.based = true;
      rm.receiveShadow = true;
      rm.castShadow = true;
      g.add(rm);
    }
    // panneaux d'aiguillage : un poteau à côté du nœud (du côté opposé à la branche, hors de son passage) et sa lampe
    this.postGeo ||= new THREE.BoxGeometry(0.18, 2.2, 0.18);
    this.lampGeo ||= new THREE.BoxGeometry(0.5, 0.5, 0.5);
    for (const n of b.nodes) {
      const s = SIDES.find((x) => n.sides[x].length > 1);
      if (s === undefined) continue;
      const br = n.sides[s].find((e) => e.curve) || n.sides[s][1];
      const far = br.a === n ? br.pts[Math.min(br.pts.length - 1, 4)] : br.pts[Math.max(0, br.pts.length - 5)];
      const lat = new THREE.Vector3(-AX[n.axis].z, 0, AX[n.axis].x);
      const sgn = Math.sign(lat.dot(far.clone().sub(n.pos))) || 1;
      const at2 = n.pos.clone().addScaledVector(lat, sgn * 2.3);
      const post = new THREE.Mesh(this.postGeo, this.M.post);
      post.position.set(at2.x, n.pos.y - TOP + 1.1, at2.z);
      post.userData.shared = true;
      post.castShadow = true;
      const lamp = new THREE.Mesh(this.lampGeo, this.chosen(n, s).curve ? this.M.branch : this.M.straight);
      lamp.position.set(at2.x, n.pos.y - TOP + 2.35, at2.z);
      lamp.userData.shared = true;
      n.lamp = lamp;
      g.add(post, lamp);
    }
    // butoirs et panneaux
    for (const p of b.props) g.add(p.kind === 'sign' ? this.signModel(p) : p.kind === 'signal' ? this.signalModel(p) : this.bufferModel(p));
    // (les traverses et les rails sont déjà rangés par rapport à (bx, bz))
    for (const o of g.children) if (!o.userData.based) { o.position.x -= bx; o.position.z -= bz; }
    b.group = g;
    this.group.add(g);
  }
  // Butoir : une poutre rayée rouge et blanc à la hauteur des tampons du train, deux tampons
  // tournés vers la voie, deux jambes de force
  bufferModel(p) {
    const M = this.M, g = new THREE.Group(), box = (w, h, d, m, x, y, z) => {
      const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      o.position.set(x, y, z);
      o.castShadow = true;
      o.userData.shared = false;
      g.add(o);
      return o;
    };
    box(0.35, 0.55, 3.1, M.stripes, 0, 1.45, 0);                 // poutre
    for (const s of [-1, 1]) {
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.5, 10).rotateZ(Math.PI / 2), M.post);
      t.position.set(0.4, 1.45, s * 0.95);
      g.add(t);
      box(0.08, 0.5, 0.5, M.post, 0.66, 1.45, s * 0.95);         // plateau du tampon
      box(0.3, 1.25, 0.3, M.post, -0.15, 0.62, s * 1.1);          // jambe
      const strut = box(0.22, 1.7, 0.22, M.post, -0.75, 0.85, s * 1.1); // jambe de force
      strut.rotation.z = -0.6;
    }
    box(1.6, 0.12, 3.1, M.post, -0.5, 0.06, 0);                   // semelle
    const dir = p.toward || new THREE.Vector3(1, 0, 0);
    g.rotation.y = Math.atan2(-dir.z, dir.x);
    g.position.set(p.pos.x, p.pos.y, p.pos.z);
    return g;
  }
  // Panneau de limitation : un poteau et une plaque hexagonale (bord rouge, la vitesse en km/h ;
  // fin de limitation : barrée), lisible des deux côtés de la voie
  signModel(p) {
    const M = this.M, g = new THREE.Group();
    // (formes partagées : un panneau de plus ne coûte presque rien)
    const G = this.signGeo ||= {
      post: new THREE.BoxGeometry(0.14, 3.3, 0.14), plate: new THREE.CircleGeometry(0.62, 6),
      rim: new THREE.CylinderGeometry(0.63, 0.63, 0.22, 6, 1, false, Math.PI / 6).rotateX(Math.PI / 2),
    };
    const post = new THREE.Mesh(G.post, M.post);
    post.position.set(0, 1.65, -0.03); // (derrière la plaque : il ne la traverse pas)
    post.castShadow = true;
    post.userData.shared = true;
    g.add(post);
    const mat = this.signMat(p.kmh);
    // (une plaque hexagonale de chaque côté du cerclage : lisible dans les deux sens)
    p.plates = [];
    for (const side of [0, 1]) {
      const plate = new THREE.Mesh(G.plate, mat);
      plate.position.set(0, 3.45, side ? -0.141 : 0.081);
      plate.rotation.y = side ? Math.PI : 0;
      plate.userData.shared = true;
      p.plates.push(plate);
      g.add(plate);
    }
    // cerclage : prisme hexagonal (tourné de 30° pour suivre les sommets de la plaque)
    const rim = new THREE.Mesh(G.rim, M.post);
    rim.position.set(0, 3.45, -0.03);
    rim.userData.shared = true;
    g.add(rim);
    const a = p.along || new THREE.Vector3(1, 0, 0);
    g.rotation.y = Math.atan2(-a.z, a.x) + Math.PI / 2; // (le disque face aux trains)
    g.position.set(p.pos.x, p.pos.y, p.pos.z);
    return g;
  }
  // La plaque d'une vitesse : dessinée une fois, gardée
  signMat(kmh) {
    this.signTex ||= new Map();
    let mat = this.signTex.get(kmh);
    if (mat) return mat;
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const x = c.getContext('2d');
    // (hexagones : sommets à 0°, 60°... comme la plaque, voir CircleGeometry à 6 côtés)
    const hex = (r, col) => { x.fillStyle = col; x.beginPath(); for (let i = 0; i < 6; i++) { const a = (i * Math.PI) / 3; x[i ? 'lineTo' : 'moveTo'](64 + Math.cos(a) * r, 64 + Math.sin(a) * r); } x.closePath(); x.fill(); };
    hex(64, '#d0302a');
    hex(kmh ? 49 : 61, '#f4f4f0');
    x.fillStyle = '#16171a';
    if (kmh) {
      x.font = 'bold ' + (kmh >= 100 ? 44 : 56) + 'px system-ui, sans-serif';
      x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText(String(kmh), 64, 68);
    } else {
      x.save(); x.translate(64, 64); x.rotate(-Math.PI / 4);
      for (const d of [-14, 0, 14]) x.fillRect(-50, d - 3, 100, 6);
      x.restore();
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    mat = new THREE.MeshLambertMaterial({ map: t, side: THREE.DoubleSide });
    this.signTex.set(kmh, mat);
    return mat;
  }

  // Signal : un mât (sa plaque rayée), une cible noire tournée vers les trains qui arrivent, deux
  // feux hexagonaux sous leurs visières (rouge en haut, vert en bas)
  signalModel(p) {
    const M = this.M, g = new THREE.Group();
    const G = this.sigGeo ||= {
      mast: new THREE.BoxGeometry(0.14, 3.4, 0.14), foot: new THREE.BoxGeometry(0.5, 0.1, 0.5), plate: new THREE.BoxGeometry(0.06, 0.55, 0.42),
      head: new THREE.BoxGeometry(0.28, 1.3, 0.62), back: new THREE.CylinderGeometry(0.62, 0.62, 0.05, 6).rotateZ(Math.PI / 2),
      lamp: new THREE.CylinderGeometry(0.19, 0.19, 0.06, 6).rotateZ(Math.PI / 2), hood: new THREE.CylinderGeometry(0.25, 0.25, 0.4, 6, 1, true, 0, Math.PI).rotateX(Math.PI / 2).rotateY(Math.PI / 2),
    };
    const add = (geo, mat, x, y, z, shadow = true) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.castShadow = shadow; o.userData.shared = true; g.add(o); return o; };
    add(G.foot, M.post, 0, 0.05, 0);
    add(G.mast, M.post, -0.08, 1.7, 0);
    add(G.plate, M.plate, 0.02, 1.4, 0, false);
    add(G.head, M.target, 0, 3.15, 0);
    add(G.back, M.post, -0.16, 3.15, 0, false).scale.set(1, 1.25, 1);
    const red = add(G.lamp, M.redOff, 0.16, 3.45, 0, false), green = add(G.lamp, M.greenOff, 0.16, 2.85, 0, false);
    add(G.hood, M.post, 0.18, 3.45, 0, false);
    add(G.hood, M.post, 0.18, 2.85, 0, false);
    p.lamps = [red, green];
    this.paintSignal(p);
    const a = (Math.PI / 3) * p.facing;
    g.rotation.y = Math.atan2(-Math.sin(a), Math.cos(a));
    g.position.set(p.pos.x, p.pos.y, p.pos.z);
    return g;
  }
  paintSignal(p) {
    if (!p.lamps) return;
    p.lamps[0].material = p.red ? this.M.redOn : this.M.redOff;
    p.lamps[1].material = p.red ? this.M.greenOff : this.M.greenOn;
  }
  // Rouge ou vert pour chaque signal : rouge si une voiture occupe la voie devant lui (dans le
  // sens qu'il commande) jusqu'au signal suivant dans le même sens (ou SIGNAL_RANGE cases), ou s'il
  // reçoit du courant. occ : tronçon -> [[u0, u1]...] (ce qu'occupent les trains, voir trains.js)
  updateSignals(occ) {
    for (const p of this.props) {
      if (p.kind !== 'signal') continue;
      let red = !!this.powered?.(p.q, p.r, p.y);
      if (!red && p.e) {
        let e = p.e, rev = p.rev, s = rev ? e.L - p.u : p.u, acc = 0;
        for (let guard = 0; guard < 4000 && acc < SIGNAL_RANGE; guard++) {
          // (jusqu'au prochain signal tourné dans le même sens sur ce tronçon)
          let stop = e.L, next = false;
          for (const o of e.sigs || []) {
            if (o.sg === p || o.sg.rev !== rev) continue;
            const at = rev ? e.L - o.u : o.u;
            if (at > s + 0.01 && at <= stop) { stop = at; next = true; }
          }
          // (un train qui arrive au signal sans l'avoir passé ne le fait pas passer au rouge)
          const lo = guard ? s : s + 0.3, u0 = rev ? e.L - stop : lo, u1 = rev ? e.L - lo : stop;
          if (occ.get(e)?.some(([a, b]) => b >= u0 && a <= u1)) { red = true; break; }
          if (next) break;
          acc += e.L - s;
          const n = rev ? e.a : e.b, nx = this.across(n, rev ? e.as : e.bs);
          if (!nx) break;
          ({ e, rev } = nx);
          s = 0;
        }
      }
      if (red !== p.red) { p.red = red; this.paintSignal(p); }
    }
  }

  update() {
    // (pendant qu'une longue voie se pose, le réseau n'est refait qu'à la fin)
    if (!this.hold) {
      if (this.dirty) this.rebuild();
      else if (this.pending.length || this.pendingLinks.length || this.adoptedQ.size) this.applyPending();
    }
    // le dessin suit le terrain chargé (4 fois par seconde, quelques chunks construits à la fois)
    const now = performance.now();
    if (now - (this.visT || 0) < 250) return;
    this.visT = now;
    // (quelques millisecondes par image au plus : pas d'à-coup quand un grand virage arrive)
    let more = false;
    for (const b of this.buckets.values()) {
      const loaded = this.shown(b);
      if (loaded && !b.group) { if (performance.now() - now < 3) this.build(b); else more = true; }
      else if (!loaded && b.group) this.unbuild(b);
    }
    if (more) this.visT = now - 250; // (il en reste : on continue à l'image suivante)
    this.updateLongs();
  }

  // ---------- Lignes spatiales ----------
  // Le bout dessiné autour de ce qu'on regarde (au plus 512 cases de chaque côté ; rien à pleine vitesse)
  updateLongs() {
    const w = this.world;
    for (const [e, b] of this.longView) if (!this.longs.has(e)) { this.unbuild(b); this.longView.delete(e); }
    if (!this.longs.size || w.viewX === undefined) return;
    const W = Math.min(512, (w.viewDist || 0) + 64);
    for (const e of this.longs) {
      const a = e.pts[0], d = e.dir;
      if (w.fastLine && this.longView.has(e)) continue; // (à grande vitesse : voir followLongs)
      const u = Math.max(0, Math.min(e.L, (w.viewX - a.x) * d.x + (w.viewZ - a.z) * d.z));
      const far = Math.hypot(a.x + d.x * u - w.viewX, a.z + d.z * u - w.viewZ) > W;
      const was = this.longView.get(e);
      if (far) { if (was) { this.unbuild(was); this.longView.delete(e); } continue; }
      if (was && !was.shifted && Math.abs(was.at - u) < W / 3) continue;
      if (was) this.unbuild(was);
      const b = { k: null, pieces: new Set([e]), span: new Map([[e, [Math.max(0, u - W), Math.min(e.L, u + W)]]]), nodes: [], props: [], group: null, at: u };
      this.build(b);
      this.longView.set(e, b);
    }
  }
  // À grande vitesse, le bout dessiné n'est pas refait : il avance avec le train, d'un nombre entier
  // de traverses, et ne se distingue pas du vrai
  followLongs(x, z) {
    for (const [e, b] of this.longView) {
      const a = e.pts[0], d = e.dir, u = (x - a.x) * d.x + (z - a.z) * d.z, gap = u - b.at;
      if (Math.abs(gap) < 32 || !b.group) continue;
      const step = e.L / Math.max(1, Math.round(e.L / SPACING)), k = Math.round(gap / step) * step;
      b.group.position.x += d.x * k;
      b.group.position.z += d.z * k;
      b.at += k;
      b.shifted = true;
    }
  }
  // Le point d'une ligne spatiale visé (aucun bloc n'y est inscrit) : { hit, prev, t } comme world.raycast
  aimLong(o, dir, reach) {
    if (Math.abs(dir.y) < 1e-4) return null;
    for (const e of this.longs) {
      const a = e.pts[0], d = e.dir, t = (a.y - o.y) / dir.y;
      if (t <= 0 || t > reach) continue;
      const x = o.x + dir.x * t, z = o.z + dir.z * t, u = (x - a.x) * d.x + (z - a.z) * d.z;
      if (u < 0 || u > e.L || Math.hypot(a.x + d.x * u - x, a.z + d.z * u - z) > 1.2) continue;
      const c = worldToHex(x, z), y = Math.floor(a.y);
      const back = worldToHex(x - dir.x * 1.2, z - dir.z * 1.2);
      const prev = back.q === c.q && back.r === c.r ? { q: c.q, r: c.r, y: y + 1 } : { q: back.q, r: back.r, y };
      return { hit: { q: c.q, r: c.r, y }, prev, t };
    }
    return null;
  }
  // Sur une ligne spatiale, à ce point ? { e, u (distance depuis e.a) } ou null
  longAt(p, near = 16) {
    for (const e of this.longs) {
      const a = e.pts[0], d = e.dir, u = (p.x - a.x) * d.x + (p.y - a.y) * d.y + (p.z - a.z) * d.z;
      if (u < 0 || u > e.L) continue;
      const off = Math.hypot(a.x + d.x * u - p.x, a.y + d.y * u - p.y, a.z + d.z * u - p.z);
      if (off < near) return { e, u, off };
    }
    return null;
  }
  // Une ligne spatiale entre deux bouts de voie, au-dessus du monde (à la main, voir main.js)
  addLine(a, as, bKey, bs) {
    const c = { t: 'x', a: a.key, as, b: bKey, bs };
    this.links.push(c);
    if (!this.dirty && !this.hold) this.pendingLinks.push(c);
    this.onChange?.();
  }
  // Toute une ligne spatiale : une rampe depuis (x, z), jusqu'à la hauteur SKY_Y, sur ses piles
  // jusqu'au sol ; la ligne elle-même ; une rampe qui redescend sur l'astre d'arrivée (to : { x,
  // zMax }, voir la commande /voie espace). Une gare et un butoir à chaque bout.
  layToSpace(x, z, y0, to) {
    if (y0 >= SKY_Y - 40) return { error: `Trop haut : la ligne passe à la hauteur ${SKY_Y}` };
    const dir = to.x > x ? 1 : -1, z2 = Math.max(-to.zMax, Math.min(to.zMax, z));
    const at = worldToHex(to.x, z2), g = Math.min(SKY_Y - 40, this.world.gen.surface(at.q, at.r).h + 1);
    const up = Math.ceil((SKY_Y - y0) / MAX_LINE_SLOPE) + 8, down = Math.ceil((SKY_Y - g) / MAX_LINE_SLOPE) + 8;
    const common = { stations: true, buffers: true, mat: 'beton' };
    const first = this.layLine(x, z, x + dir * up, z, y0, { ...common, y2: SKY_Y, open: 'end' });
    if (first.error) return first;
    const self = this, res = { first: null, second: null };
    let cur = first, part = 0;
    const job = {
      progress: 0, result: null,
      step(budget = 6) {
        if (!cur.step(budget)) { job.progress = (part + cur.progress) / 2; return false; }
        if (part === 0) {
          res.first = cur.result;
          part = 1;
          const second = self.layLine(to.x - dir * down, z2, to.x, z2, SKY_Y, { ...common, y2: g, open: 'start' });
          if (second.error) { job.result = { ...res.first, error: second.error }; job.progress = 1; return true; }
          job.a = first.plans[0];
          job.b = second.plans[0];
          cur = second;
          return false;
        }
        res.second = cur.result;
        const A = job.a, B = job.b, ka = A.end.q + ',' + A.end.r, kb = B.start.q + ',' + B.start.r;
        self.links.push({ t: 'x', a: ka + ',' + A.ys.get(ka), as: dir, b: kb + ',' + B.ys.get(kb), bs: -dir });
        self.dirty = true;
        self.onChange?.();
        const f = res.first, h = res.second;
        job.result = { ...f, y2: h.y2, rails: f.rails + h.rails, bridges: f.bridges + h.bridges, tunnels: f.tunnels + h.tunnels, stations: f.stations + h.stations, buffers: f.buffers + h.buffers, len: f.len + h.len, space: true };
        job.progress = 1;
        return true;
      },
    };
    return job;
  }

  // ---------- Tracer une ligne (commande /voie) ----------
  // Une voie de (ax, az) à (bx, bz), à la hauteur y, aussi longue qu'on veut, dans n'importe quelle
  // direction (un nœud toutes les 16 cases, reliés par de longues lignes droites) :
  //  - presque dans un axe de la grille : une ligne droite, et un grand virage en S si l'arrivée
  //    est un peu décalée ;
  //  - entre deux axes : une ligne droite dans le premier, un grand virage, une ligne droite dans
  //    l'autre (un « L » adouci) ;
  //  - plusieurs voies (opts.lanes, 1 à 4) : parallèles, à côté (à gauche du sens de la marche).
  // Options (opts, voir la commande /voie dans main.js) : mat (LINE_MATS), embank (un remblai de
  // gravier jusqu'au sol au lieu des ponts), lamps (un lampadaire toutes les n cases, à droite),
  // stations (une gare toutes les n cases, à droite ; true : aux deux bouts), buffers (un butoir
  // à chaque bout), kmh (un panneau de vitesse au départ de chaque voie).
  // Le passage est dégagé (3 cases de large, 5 de haut) et le vide sous la voie comblé de gravier.
  // Au-dessus d'un ravin, d'une vallée ou de l'eau (3 blocs de vide ou plus) : un pont (tablier de
  // pierre, parapets, une pile jusqu'au sol toutes les 8 cases) ; sous une montagne : un tunnel
  // (parois et voûte de pierre là où la roche manque).
  // Le travail se fait petit à petit (voir step) : les chunks ne sont pas chargés, seules leurs
  // modifications sont notées. Renvoie un chantier { step(ms) -> fini ?, progress, result } ou { error }
  // y : hauteur au départ ; opts.y2 : à l'arrivée (une pente régulière tout du long, MAX_LINE_SLOPE
  // au plus ; la voie passe à travers tout, la bedrock comprise)
  layLine(ax, az, bx, bz, y, opts = {}) {
    if (typeof opts === 'boolean') opts = { lanes: opts ? 2 : 1 };
    const lanes = Math.max(1, Math.min(4, opts.lanes || 1));
    const plans = [this.planLine(ax, az, bx, bz)];
    if (plans[0].error) return plans[0];
    // les autres voies : à côté, à environ 5 blocs (6 rangées de cases) l'une de l'autre, à gauche
    // du sens de la marche, au départ comme à l'arrivée
    const D = 3 * Math.sqrt(3), [d0, d1] = plans[0].dirs;
    for (let l = 1; l < lanes; l++) {
      const p = this.planLine(ax - d0.z * D * l, az + d0.x * D * l, bx - d1.z * D * l, bz + d1.x * D * l);
      if (p.error) return p;
      plans.push(p);
    }
    // hauteur de chaque nœud (arrondie), et de la voie entre deux nœuds (comme le train la suit)
    const y0 = y, y2 = opts.y2 ?? y;
    for (const pl of plans) {
      if (Math.abs(y2 - y0) > pl.total * MAX_LINE_SLOPE + 0.5) {
        return { error: `Trop raide : ${Math.abs(y2 - y0)} blocs de dénivelé sur ${Math.round(pl.total)} cases (${Math.ceil(1 / MAX_LINE_SLOPE)} cases par bloc au moins : il en faudrait ${Math.ceil(Math.abs(y2 - y0) / MAX_LINE_SLOPE)})` };
      }
      pl.ys = new Map();
      for (const n of pl.nodes) { n.y = Math.round(y0 + (y2 - y0) * (pl.total ? n.s / pl.total : 0)); pl.ys.set(n.q + ',' + n.r, n.y); }
      pl.nodes.sort((a, b) => a.s - b.s);
      pl.height = (s) => {
        const N = pl.nodes;
        if (s <= N[0].s) return N[0].y;
        for (let i = 1; i < N.length; i++) if (s <= N[i].s) { const a = N[i - 1], b = N[i]; return a.y + (b.y - a.y) * (b.s > a.s ? (s - a.s) / (b.s - a.s) : 1); }
        return N[N.length - 1].y;
      };
    }
    const W = this.world, done = new Set(), lowest = new Map();
    const [STONE, PARAPET] = LINE_MATS[opts.mat] || LINE_MATS.pierre, GRAVEL = 244;
    let count = 0, bridges = 0, tunnels = 0, lamps = 0, stations = 0, signals = 0;
    const solidAt = (q, r, yy) => SOLID[W.getBlock(q, r, yy)];
    // un objet au bord de la voie (lampadaire, gare, panneau) : à droite du point (x, z), dans la
    // direction (ux, uz), sur le sol (comblé de gravier s'il manque) ; null : pas la place
    const beside = (x, z, ux, uz, dist = 3.3, y = y0) => {
      const c = worldToHex(x + uz * dist, z - ux * dist);
      if (solidAt(c.q, c.r, y) && !solidAt(c.q, c.r, y + 1)) return null; // (un talus : rien)
      for (let yy = y; yy < y + 4; yy++) { const id = W.getBlock(c.q, c.r, yy); if (id && !isTrack(id)) W.setBlock(c.q, c.r, yy, 0); }
      if (!solidAt(c.q, c.r, y - 1)) {
        if (!solidAt(c.q, c.r, y - 2) && !solidAt(c.q, c.r, y - 3)) return null; // (au-dessus du vide : rien)
        W.setBlock(c.q, c.r, y - 1, GRAVEL);
      }
      return c;
    };
    const lamp = (x, z, ux, uz, y) => {
      const c = beside(x, z, ux, uz, 3.3, y);
      if (!c) return;
      for (let k = 0; k < 3; k++) W.setBlock(c.q, c.r, y + k, POST + 5); // (poteau en fer)
      W.setBlock(c.q, c.r, y + 3, 607);                                    // (un cristal lumineux dessus)
      lamps++;
    };
    // (signal : à droite de la voie, tourné vers les trains qui arrivent)
    const signal = (x, z, ux, uz, y) => {
      const c = beside(x, z, ux, uz, 3.3, y);
      if (!c) return;
      W.setBlock(c.q, c.r, y, RAIL_SIGNAL + sideOf(-ux, -uz));
      signals++;
    };
    const station = (x, z, ux, uz, y) => {
      const c = beside(x, z, ux, uz, 3.6, y);
      if (!c) return;
      // (le panneau tourné vers la voie)
      W.setBlock(c.q, c.r, y, STATION + sideOf(-uz, ux));
      stations++;
    };
    // (les parois et voûtes déjà posées ne comptent pas comme de la roche : sinon le tunnel
    // continuerait tout seul après la montagne)
    const ours = new Set(), wall = (q, r, yy) => { W.setBlock(q, r, yy, STONE); ours.add(q + ',' + r + ',' + yy); };
    const rock = (q, r, yy) => !ours.has(q + ',' + r + ',' + yy) && SOLID[W.getBlock(q, r, yy)];
    // (ye : hauteur de la voie en ce point ; dans une pente, le bloc qu'elle traverse est dégagé)
    const clearAround = (x, z, ye) => {
      const y = Math.floor(ye + 1e-6);
      const c = worldToHex(x, z);
      count++;
      // sous le milieu de la voie : un grand vide (pont) ? de la roche au-dessus (tunnel) ?
      // (on regarde à partir de 2 blocs sous la voie : celui juste dessous a pu être comblé par le
      // point d'avant)
      let depth = 0;
      while (depth < 64 && !SOLID[W.getBlock(c.q, c.r, y - 2 - depth)]) depth++;
      const bridge = depth >= 2, tunnel = !bridge && (rock(c.q, c.r, y + 5) || rock(c.q, c.r, y + 6));
      if (bridge) bridges++;
      if (tunnel) tunnels++;
      for (let dq = -3; dq <= 3; dq++) for (let dr = -3; dr <= 3; dr++) {
        const q = c.q + dq, r = c.r + dr, w = hexToWorld(q, r), d = Math.hypot(w.x - x, w.z - z);
        // (une case est dégagée à chaque hauteur où la voie passe : dans une pente, elle change)
        const qr = q + ',' + r, k = qr + ',' + y;
        if (d > 2.65 || done.has(k)) continue;
        if (d > 1.75) {
          // bord du passage (pas encore dégagé) : parapet du pont, parois du tunnel
          if (bridge && opts.embank) {
            for (let yy = y - 1; yy > y - 66 && !SOLID[W.getBlock(q, r, yy)]; yy--) W.setBlock(q, r, yy, STONE);
          } else if (bridge) {
            if (!SOLID[W.getBlock(q, r, y - 1)]) W.setBlock(q, r, y - 1, STONE);
            if (!W.getBlock(q, r, y)) W.setBlock(q, r, y, PARAPET);
          } else if (tunnel) {
            for (let yy = y; yy <= y + 5; yy++) if (!SOLID[W.getBlock(q, r, yy)]) wall(q, r, yy);
          }
          continue;
        }
        done.add(k);
        // (pas de gravier dans une case déjà dégagée plus bas : la voie y passe)
        const low = lowest.get(qr), freeUnder = low !== undefined && low <= y - 1;
        if (low === undefined || y < low) lowest.set(qr, y);
        for (let yy = y; yy < y + 5; yy++) { const id = W.getBlock(q, r, yy); if (id && !isTrack(id)) W.setBlock(q, r, yy, 0); }
        const under = W.getBlock(q, r, y - 1);
        if (bridge && opts.embank) {
          // un remblai : du gravier jusqu'au sol (ou au fond de l'eau), 64 blocs au plus
          for (let yy = y - 1; yy > y - 66 && !SOLID[W.getBlock(q, r, yy)]; yy--) W.setBlock(q, r, yy, d < 1.2 ? GRAVEL : STONE);
        } else if (bridge) { if (!SOLID[under]) W.setBlock(q, r, y - 1, d < 0.6 ? GRAVEL : STONE); }
        else if (!freeUnder && (!under || (under >= 7 && under <= 16))) W.setBlock(q, r, y - 1, GRAVEL);
        if (tunnel && !SOLID[W.getBlock(q, r, y + 5)]) wall(q, r, y + 5); // (la voûte)
      }
      // une pile du pont, jusqu'au sol (ou au fond de l'eau), toutes les 8 cases
      // (au-dessus du monde : moins souvent, mais une vraie tour, jusqu'en bas)
      if (bridge && !opts.embank && count % (y >= H ? 32 : 8) === 0) for (let yy = y - 2; yy > Y_MIN && (y >= H || yy > y - 66) && !SOLID[W.getBlock(c.q, c.r, yy)]; yy--) W.setBlock(c.q, c.r, yy, STONE);
    };
    // le travail : une liste de tâches (dégager autour d'un point, poser un nœud), faites par lots
    const total = plans.reduce((n, p) => n + p.points, 0);
    let pi = 0, gen = plans[0].walk(), doneCount = 0, rails = 0;
    // (le long de la voie : la distance parcourue depuis le départ de la voie en cours, et le point
    // d'avant, pour la direction)
    let run = 0, prev = null;
    const along = (v) => {
      if (!prev) { prev = v; return; }
      const dx = v.x - prev.x, dz = v.z - prev.z, L = Math.hypot(dx, dz);
      if (L < 0.5 || L > 6) { prev = v; return; } // (un saut : le virage est parcouru après les lignes droites)
      const before = run;
      run += L;
      const ux = dx / L, uz = dz / L, every = (n) => n > 0 && Math.floor(run / n) > Math.floor(before / n);
      // (sur la voie la plus à droite : les autres sont à sa gauche)
      if (pi === 0 && every(opts.lamps)) lamp(v.x, v.z, ux, uz, Math.round(v.y));
      if (pi === 0 && typeof opts.stations === 'number' && every(opts.stations)) station(v.x, v.z, ux, uz, Math.round(v.y));
      // (signaux : à droite de la première voie pour les trains qui partent, à gauche de la
      // dernière pour ceux qui reviennent ; décalés des lampadaires)
      if (opts.signals && run > 8 && every(opts.signals)) {
        if (pi === 0) signal(v.x + ux * 2, v.z + uz * 2, ux, uz, Math.round(v.y));
        if (pi === plans.length - 1 && plans.length > 1) signal(v.x + ux * 2, v.z + uz * 2, -ux, -uz, Math.round(v.y));
      }
      prev = v;
    };
    const self = this;
    this.hold = true;
    const job = {
      progress: 0, result: null, plans,
      step(budget = 6) {
        const t0 = performance.now();
        while (performance.now() - t0 < budget) {
          const it = gen.next();
          if (it.done) {
            if (++pi >= plans.length) return job.finish();
            gen = plans[pi].walk();
            run = 0; prev = null;
            continue;
          }
          const v = it.value;
          if (v.clear) { v.y = plans[pi].height(v.s); clearAround(v.x, v.z, v.y); along(v); }
          else { W.setBlock(v.q, v.r, plans[pi].ys.get(v.q + ',' + v.r), TRACK_IDS[v.axis]); rails++; }
          doneCount++;
          if (done.size > 400000) { done.clear(); ours.clear(); lowest.clear(); } // (une ligne immense : la mémoire des cases dégagées est vidée de temps en temps)
        }
        job.progress = Math.min(0.99, doneCount / Math.max(1, total));
        return false;
      },
      finish() {
        // les tronçons : longues lignes entre nœuds successifs, et les virages
        const withY = (pl, k) => k.replace(/,Y$/, (m, i) => ',' + pl.ys.get(k.slice(0, i)));
        for (const pl of plans) for (const c of pl.links) self.links.push({ ...c, a: withY(pl, c.a), b: withY(pl, c.b) });
        // aux bouts de chaque voie : butoirs, gares, panneau de vitesse
        let buffers = 0, signs = 0;
        plans.forEach((pl, l) => {
          for (const [e, k, end] of [[pl.start, (pl.start.k + 3) % 6, 'start'], [pl.end, pl.end.k, 'end']]) {
            if (opts.open === end) continue; // (ce bout-là continue, voir layToSpace)
            const [sq, sr] = NEIGHBORS[k], q = e.q + sq, r = e.r + sr, y = pl.ys.get(e.q + ',' + e.r);
            if (opts.buffers) {
              if (!SOLID[W.getBlock(q, r, y - 1)]) W.setBlock(q, r, y - 1, GRAVEL);
              W.setBlock(q, r, y, BUFFER_STOP + (k + 3) % 6);
              for (let yy = y + 1; yy < y + 4; yy++) if (W.getBlock(q, r, yy)) W.setBlock(q, r, yy, 0);
              buffers++;
            }
            // (gares aux deux bouts : sur la voie de droite seulement, la gare sert à toutes)
            if (opts.stations === true && l === 0) {
              const c = hexToWorld(e.q, e.r), u = DIRV[e.k];
              station(c.x, c.z, u.x, u.z, y);
            }
          }
          if (opts.kmh !== undefined) {
            const c = hexToWorld(pl.start.q, pl.start.r), u = DIRV[pl.start.k], y = pl.ys.get(pl.start.q + ',' + pl.start.r);
            const at = beside(c.x + u.x * 3, c.z + u.z * 3, u.x, u.z, 3.2, y);
            if (at) {
              W.setBlock(at.q, at.r, y, SPEED_SIGN + sideOf(-u.x, -u.z));
              self.setLimit(at.q + ',' + at.r + ',' + y, opts.kmh);
              signs++;
            }
          }
        });
        self.dirty = true;
        self.hold = false;
        self.onChange?.();
        job.progress = 1;
        job.result = { y0, y2, rails, bridges, tunnels, lamps, stations, buffers, signs, signals, lanes, curves: plans.reduce((n, p) => n + p.links.filter((c) => c.t === 'c').length, 0), len: Math.round(plans.reduce((n, p) => n + p.len, 0)) };
        return true;
      },
    };
    return job;
  }
  // Plan d'une voie (sans rien poser) : lignes droites et virages, un parcours walk() qui donne
  // une à une les tâches (dégager un point, poser un nœud), et dirs (sens au départ et à l'arrivée)
  planLine(ax, az, bx, bz) {
    const S = worldToHex(ax, az), Sp = hexToWorld(S.q, S.r);
    const dx = bx - Sp.x, dz = bz - Sp.z;
    if (Math.hypot(dx, dz) < 4) return { error: 'Les deux points sont trop proches (4 cases au moins)' };
    // les deux directions de la grille qui encadrent celle demandée (6 directions, tous les 60°)
    let ang = Math.atan2(dz, dx);
    if (ang < 0) ang += Math.PI * 2;
    const k1 = Math.floor(ang / (Math.PI / 3)) % 6, k2 = (k1 + 1) % 6;
    const v1 = DIRV[k1], v2 = DIRV[k2];
    // (le trajet en deux morceaux : a cases dans la direction k1, b dans la direction k2)
    const det = v1.x * v2.z - v1.z * v2.x;
    const a = (dx * v2.z - dz * v2.x) / det, b = (v1.x * dz - v1.z * dx) / det;
    // presque dans un axe : ligne droite (et S) ; sinon, le « L » adouci
    const s = this.planS(S, bx, bz, a >= b ? k1 : k2);
    if (!s.error) return s;
    return this.planL(S, bx, bz, k1, k2, a, b);
  }
  // Morceaux de voie : des lignes droites (runs : q, r, n cases, direction k) et des virages
  // (s : distance depuis le départ, en blocs ; l'ordre est ligne, virage, ligne...)
  pack(runs, curves, links, len) {
    const points = runs.reduce((n, r) => n + r.n + 1, 0) * 1.06 + curves.reduce((n, c) => n + c.pts.length, 0);
    const at = [];
    let s0 = 0;
    runs.forEach((run, i) => { at.push(s0); s0 += run.n + (curves[i] ? curves[i].L : 0); });
    const nodes = [];
    runs.forEach((run, i) => {
      const [sq, sr] = NEIGHBORS[run.k];
      for (let k = 0; k <= run.n; k++) if (k % LINE_STEP === 0 || k === run.n) nodes.push({ q: run.q + sq * k, r: run.r + sr * k, s: at[i] + k });
    });
    return {
      total: s0, nodes,
      links, len, points, dirs: [DIRV[runs[0].k], DIRV[runs[runs.length - 1].k]],
      // (les bouts : la case et la direction de la voie, vers l'avant)
      start: { q: runs[0].q, r: runs[0].r, k: runs[0].k },
      end: (() => { const e = runs[runs.length - 1], [sq, sr] = NEIGHBORS[e.k]; return { q: e.q + sq * e.n, r: e.r + sr * e.n, k: e.k }; })(),
      *walk() {
        for (const run of runs) {
          const [sq, sr] = NEIGHBORS[run.k];
          for (let k = 0; k <= run.n; k++) {
            const c = hexToWorld(run.q + sq * k, run.r + sr * k);
            yield { clear: true, x: c.x, z: c.z, s: at[runs.indexOf(run)] + k };
            if (k % LINE_STEP === 0 || k === run.n) yield { q: run.q + sq * k, r: run.r + sr * k, axis: run.k % 3 };
          }
        }
        for (let i = 0; i < curves.length; i++) {
          const cv = curves[i];
          for (let j = 0; j < cv.pts.length; j++) yield { clear: true, x: cv.pts[j].x, z: cv.pts[j].z, s: at[i] + runs[i].n + cv.len[j] };
        }
      },
    };
  }
  // une ligne droite de n cases depuis (q, r) dans la direction k : un nœud toutes les 16 cases
  // (et au bout), reliés par de longues lignes
  addRun(runs, links, q, r, n, k) {
    runs.push({ q, r, n, k });
    const [sq, sr] = NEIGHBORS[k], side = k < 3 ? 1 : -1, ks = [];
    for (let i = 0; i < n; i += LINE_STEP) ks.push(i);
    ks.push(n);
    const key = (i) => (q + sq * i) + ',' + (r + sr * i) + ',Y';
    for (let i = 1; i < ks.length; i++) links.push({ t: 'l', a: key(ks[i - 1]), as: side, b: key(ks[i]), bs: -side });
  }
  // Dans la direction k : ligne droite, et un grand S si l'arrivée est un peu décalée sur le côté
  planS(S, bx, bz, k) {
    const [sq, sr] = NEIGHBORS[k], side = k < 3 ? 1 : -1, axis = k % 3;
    const u = DIRV[k], w = new THREE.Vector3(-u.z, 0, u.x), Sp = hexToWorld(S.q, S.r);
    const along = (bx - Sp.x) * u.x + (bz - Sp.z) * u.z, lat = (bx - Sp.x) * w.x + (bz - Sp.z) * w.z;
    if (along < 4) return { error: 'trop court' };
    const runs = [], links = [];
    if (Math.abs(lat) < 0.75) {
      this.addRun(runs, links, S.q, S.r, Math.round(along), k);
      return this.pack(runs, [], links, Math.round(along));
    }
    for (let Ls = Math.max(14, Math.abs(lat) * 3.5); Ls <= Math.min(along - 2, 4000); Ls += Math.max(4, Ls * 0.1)) {
      const n1 = Math.max(0, Math.floor((along - Ls) / 2));
      const C1 = [S.q + sq * n1, S.r + sr * n1], P1 = hexToWorld(C1[0], C1[1]);
      const C2 = worldToHex(P1.x + u.x * Ls + w.x * lat, P1.z + u.z * Ls + w.z * lat), P2 = hexToWorld(C2.q, C2.r);
      const a = { key: 'p', axis, pos: new THREE.Vector3(P1.x, TOP, P1.z) };
      if (typeof this.check(a, side, C2.q, C2.r, 0, axis, -side, 6000) === 'string') continue;
      const n2 = Math.max(0, Math.round((bx - P2.x) * u.x + (bz - P2.z) * u.z));
      this.addRun(runs, links, S.q, S.r, n1, k);
      const cv = this.shape(new THREE.Vector3(P1.x, 0, P1.z), u, new THREE.Vector3(P2.x, 0, P2.z), u.clone().negate(), true);
      links.push({ t: 'c', a: C1.join(',') + ',Y', as: side, b: C2.q + ',' + C2.r + ',Y', bs: -side });
      this.addRun(runs, links, C2.q, C2.r, n2, k);
      return this.pack(runs, [cv], links, n1 + cv.L + n2);
    }
    return { error: 'trop décalé' };
  }
  // Entre deux directions voisines (k1 puis k2, à 60° l'une de l'autre) : ligne droite, grand
  // virage, ligne droite. a, b : longueurs dans chaque direction (le coin serait à a cases du départ)
  planL(S, bx, bz, k1, k2, a, b) {
    const [q1, r1] = NEIGHBORS[k1], v1 = DIRV[k1], v2 = DIRV[k2];
    const s1 = k1 < 3 ? 1 : -1, s2 = k2 < 3 ? 1 : -1;
    // m : le virage commence m cases avant le coin et finit m cases après (plus m est grand, plus il est doux)
    for (let m = 12; m <= Math.min(a, b) - 1; m += Math.max(4, m * 0.15)) {
      const n1 = Math.round(a - m);
      if (n1 < 0) continue;
      const C1 = [S.q + q1 * n1, S.r + r1 * n1], P1 = hexToWorld(C1[0], C1[1]);
      const C2 = worldToHex(P1.x + (v1.x + v2.x) * m, P1.z + (v1.z + v2.z) * m), P2 = hexToWorld(C2.q, C2.r);
      const node = { key: 'p', axis: k1 % 3, pos: new THREE.Vector3(P1.x, TOP, P1.z) };
      if (typeof this.check(node, s1, C2.q, C2.r, 0, k2 % 3, -s2, 8000) === 'string') continue;
      const n2 = Math.max(0, Math.round((bx - P2.x) * v2.x + (bz - P2.z) * v2.z));
      const runs = [], links = [];
      this.addRun(runs, links, S.q, S.r, n1, k1);
      const cv = this.shape(new THREE.Vector3(P1.x, 0, P1.z), v1, new THREE.Vector3(P2.x, 0, P2.z), v2.clone().negate(), true);
      links.push({ t: 'c', a: C1.join(',') + ',Y', as: s1, b: C2.q + ',' + C2.r + ',Y', bs: -s2 });
      this.addRun(runs, links, C2.q, C2.r, n2, k2);
      return this.pack(runs, [cv], links, n1 + cv.L + n2);
    }
    return { error: "Les points sont trop près l'un de l'autre pour tourner : éloigne-les, ou fais-le en plusieurs fois" };
  }
}
