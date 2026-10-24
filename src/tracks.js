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
//  - itinéraire : le chemin le plus court jusqu'à une gare (path), pour régler les aiguillages.
// Les nœuds sont retrouvés dans les modifications du monde (world.mods : un rail de train est
// toujours posé par quelqu'un) ; virages, longues lignes et aiguillages sont gardés dans la sauvegarde.
// Dessin : par chunk, là où le terrain est chargé et, au-delà, jusqu'à la distance d'affichage
// (on voit les voies au loin, sur le terrain simplifié) ; libéré plus loin.
import * as THREE from 'three';
import { NEIGHBORS, hexToWorld, worldToHex } from './hex.js?v=1.1.5-alpha-mvm2b95g';
import { CS, DEEP } from './mesher.js?v=1.1.5-alpha-mvm2b95g';
import { SOLID, BLOCKS, isStation, isProp, isDetector } from './blocks.js?v=1.1.5-alpha-mvm2b95g';

export const TRACK_IDS = [456, 473, 474];
export const isTrack = (id) => id === 456 || id === 473 || id === 474;
const AX = [0, 1, 2].map((a) => new THREE.Vector3(Math.cos((a * Math.PI) / 3), 0, Math.sin((a * Math.PI) / 3)));
export const TOP = 0.27;        // dessus des rails, au-dessus du bas de la case du nœud
const GAUGE = 1.12;             // rails à ±1,12 du milieu (sous les roues du train)
const SLEEPER_W = 3.0, SLEEPER_D = 0.28, SLEEPER_H = 0.12, SPACING = 0.6;
const RAIL_W = 0.16, RAIL_H = 0.15;
export const MIN_RADIUS = 5;    // rayon de courbure minimal d'un virage (le train est long)
export const MAX_LEN = 96;      // longueur maximale d'un virage posé à la main
const MAX_SLOPE = 0.5;          // pente maximale (montée / longueur)
const LINE_STEP = 16;           // longue ligne : un nœud toutes les 16 cases
const SIDES = [1, -1];
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
  };
}

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
  }

  // un bloc a changé dans le monde (voir world.onAnySet dans main.js)
  onBlock(q, r, y, id, old) {
    if (isTrack(id) || isTrack(old) || isStation(id) || isStation(old) || isProp(id) || isProp(old) || isDetector(id) !== isDetector(old)) this.dirty = true;
  }
  clear() {
    this.links = [];
    this.switches.clear();
    this.names.clear();
    this.limits.clear();
    this.dirty = true;
  }
  serialize() {
    return { links: this.links.map((c) => ({ ...c })), switches: [...this.switches].filter(([, v]) => v), names: [...this.names], limits: [...this.limits] };
  }
  load(data) {
    const ok = (c) => c && typeof c.a === 'string' && typeof c.b === 'string' && Math.abs(c.as) === 1 && Math.abs(c.bs) === 1;
    // (anciennes sauvegardes : « curves », que des virages)
    this.links = [...(data?.links || []), ...(data?.curves || []).map((c) => ({ t: 'c', ...c }))].filter(ok).map((c) => ({ t: c.t === 'l' ? 'l' : 'c', a: c.a, as: c.as, b: c.b, bs: c.bs }));
    this.switches = new Map((Array.isArray(data?.switches) ? data.switches : []).filter((e) => Array.isArray(e) && typeof e[0] === 'string' && Number.isInteger(e[1])));
    this.names = new Map((Array.isArray(data?.names) ? data.names : []).filter((e) => Array.isArray(e) && typeof e[0] === 'string' && typeof e[1] === 'string').map(([k, n]) => [k, n.slice(0, 32)]));
    this.limits = new Map((Array.isArray(data?.limits) ? data.limits : []).filter((e) => Array.isArray(e) && typeof e[0] === 'string' && Number.isInteger(e[1]) && e[1] >= 0 && e[1] <= 400));
    this.dirty = true;
  }

  // ---------- Le réseau ----------
  scan() {
    const nodes = new Map();
    this.stations = [];
    this.props = [];
    this.detectors = [];
    for (const [k, m] of this.world.mods) {
      let has = false;
      for (const id of m.values()) if (isTrack(id) || isStation(id) || isProp(id) || isDetector(id)) { has = true; break; }
      if (!has) continue;
      const [cq, cr] = k.split(',').map(Number);
      for (const [i, id] of m) {
        const st = isStation(id), pr = isProp(id), de = isDetector(id);
        if (!isTrack(id) && !st && !pr && !de) continue;
        const q = cq * CS + (i % CS), r = cr * CS + (Math.floor(i / CS) % CS), y = Math.floor(i / (CS * CS)) - DEEP;
        if (pr || de) {
          const c = hexToWorld(q, r), key = q + ',' + r + ',' + y, pos = new THREE.Vector3(c.x, y, c.z);
          if (de) this.detectors.push({ key, q, r, y, pos });
          else this.props.push({ key, q, r, y, pos, kind: BLOCKS[id].prop, facing: BLOCKS[id].facing || 0 });
          continue;
        }
        if (st) { const c = hexToWorld(q, r), key = q + ',' + r + ',' + y; this.stations.push({ key, q, r, y, pos: new THREE.Vector3(c.x, y + 0.5, c.z) }); continue; }
        const c = hexToWorld(q, r), key = q + ',' + r + ',' + y;
        nodes.set(key, { key, q, r, y, axis: TRACK_IDS.indexOf(id), pos: new THREE.Vector3(c.x, y + TOP, c.z), sides: { 1: [], '-1': [] } });
      }
    }
    return nodes;
  }
  // (un côté de nœud : au plus deux tronçons, dont un seul droit)
  room(n, s, straight) { const l = n.sides[s]; return l.length < 2 && !(straight && l.some((e) => !e.curve)); }
  has(n, s) { return n.sides[s].length > 0; }
  full(n, s) { return n.sides[s].length >= 2; }
  isSwitch(n) { return SIDES.some((s) => n.sides[s].length > 1); }
  rebuild() {
    this.dirty = false;
    this.version++;
    this.nodes = this.scan();
    this.edges = new Map();
    // tronçons posés (ceux dont un bout a disparu s'en vont)
    this.links = this.links.filter((c) => {
      const a = this.nodes.get(c.a), b = this.nodes.get(c.b), straight = c.t === 'l';
      if (!a || !b || a === b || !this.room(a, c.as, straight) || !this.room(b, c.bs, straight)) return false;
      this.link(a, c.as, b, c.bs, !straight, c.t);
      return true;
    });
    // lignes droites entre voisins du même axe
    for (const n of this.nodes.values()) {
      const [dq, dr] = NEIGHBORS[n.axis];
      const m = this.nodes.get((n.q + dq) + ',' + (n.r + dr) + ',' + n.y);
      if (m && m.axis === n.axis && this.room(n, 1, true) && this.room(m, -1, true)) this.link(n, 1, m, -1, false, 's');
    }
    // pentes : un bout de voie libre et, plus loin dans son axe, un nœud un peu plus haut ou plus bas
    for (const n of this.nodes.values()) for (const s of SIDES) {
      if (!this.room(n, s, true)) continue;
      const [dq, dr] = NEIGHBORS[s > 0 ? n.axis : n.axis + 3];
      for (let k = 1; k <= LINE_STEP; k++) {
        const q = n.q + dq * k, r = n.r + dr * k;
        let m = null;
        for (let dy = -3; dy <= 3 && !m; dy++) m = this.nodes.get(q + ',' + r + ',' + (n.y + dy)) || null;
        if (!m) continue;
        // (trop raide, déjà relié, ou pas dans le même axe : rien)
        if (m.y !== n.y && Math.abs(m.y - n.y) * 4 <= k && m.axis === n.axis && this.room(m, -s, true)) {
          if (s > 0) this.link(n, 1, m, -1, false, 'p'); else this.link(m, 1, n, -1, false, 'p');
        }
        break;
      }
    }
    // (sur chaque côté : le tout droit d'abord, la branche ensuite)
    for (const n of this.nodes.values()) for (const s of SIDES) n.sides[s].sort((a, b) => a.curve - b.curve);
    // gares : leur nom (« Gare 1 », « Gare 2 »... si on ne l'a pas changé) et leur point sur la voie
    // (le plus proche, à moins de 6 cases) : les trains en pilote automatique s'y arrêtent
    const used = new Set(this.stations.map((st) => this.names.get(st.key)).filter(Boolean));
    let num = 1;
    for (const st of this.stations.sort((a, b) => (a.key < b.key ? -1 : 1))) {
      if (!this.names.has(st.key)) { while (used.has('Gare ' + num)) num++; this.names.set(st.key, 'Gare ' + num); used.add('Gare ' + num); }
      st.name = this.names.get(st.key);
      const h = this.nearest(st.pos.x, st.pos.y, st.pos.z, 1, 0, 6);
      if (!h) continue;
      const u = h.rev ? h.e.L - h.s : h.s;
      (h.e.stops ||= []).push({ u, st });
    }
    // panneaux : leur vitesse (40 km/h si on ne l'a pas changée) et leur point sur la voie (à
    // moins de 5 cases) ; butoirs : tournés vers le bout de voie le plus proche
    for (const p of this.props) {
      const h = this.nearest(p.pos.x, p.pos.y + 0.3, p.pos.z, 1, 0, p.kind === 'sign' ? 5 : 2.5);
      if (p.kind === 'sign') {
        p.kmh = this.limits.has(p.key) ? this.limits.get(p.key) : 40;
        if (h) { const u = h.rev ? h.e.L - h.s : h.s; (h.e.signs ||= []).push({ u, sg: p }); p.along = this.dirAt({ e: h.e, s: h.s, rev: h.rev }, new THREE.Vector3()); }
      } else if (h) {
        const at = this.pointAt(h, new THREE.Vector3());
        p.toward = new THREE.Vector3(at.x - p.pos.x, 0, at.z - p.pos.z);
        if (p.toward.lengthSq() < 0.01) p.toward = this.dirAt(h, new THREE.Vector3()).negate();
        p.toward.y = 0;
        p.toward.normalize();
      }
    }
    this.layout();
  }
  // Vitesse d'un panneau (clic droit : la suivante) ; renvoie la nouvelle (km/h, 0 : fin)
  nextLimit(key) {
    const L = [20, 40, 60, 80, 100, 120, 160, 200, 0], cur = this.limits.has(key) ? this.limits.get(key) : 40;
    const v = L[(L.indexOf(cur) + 1) % L.length];
    this.setLimit(key, v);
    return v;
  }
  setLimit(key, v) {
    this.limits.set(key, v);
    this.dirty = true;
    this.onChange?.();
  }
  propAt(q, r, y) { this.update(); return this.props.find((p) => p.q === q && p.r === r && p.y === y) || null; }
  // Nom d'une gare (clic droit dessus)
  rename(key, name) {
    if (!this.stations.some((st) => st.key === key)) return false;
    this.names.set(key, name.slice(0, 32));
    for (const st of this.stations) if (st.key === key) st.name = this.names.get(key);
    this.onChange?.();
    return true;
  }
  stationAt(q, r, y) { return this.stations.find((st) => st.q === q && st.r === r && st.y === y) || null; }
  // Tronçon de a (côté as) à b (côté bs) : ligne droite, ou courbe de Bézier tangente aux deux axes
  link(a, as, b, bs, curve, t) {
    const e = this.shape(a.pos, AX[a.axis].clone().multiplyScalar(as), b.pos, AX[b.axis].clone().multiplyScalar(bs), curve);
    Object.assign(e, { a, as, b, bs, curve, key: t + ':' + a.key + '/' + as + '>' + b.key + '/' + bs });
    a.sides[as].push(e);
    b.sides[bs].push(e);
    this.edges.set(e.key, e);
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
    this.links.push({ t: 'c', a: a.key, as, b: bKey, bs });
    this.dirty = true;
    this.onChange?.(); // (en ligne : l'hôte envoie les tronçons aux invités)
  }

  // ---------- Aiguillages ----------
  swKey(n, s) { return n.key + '/' + s; }
  // tronçon choisi sur le côté s du nœud n
  chosen(n, s) {
    const l = n.sides[s];
    return l.length ? l[(this.switches.get(this.swKey(n, s)) || 0) % l.length] : null;
  }
  // bascule l'aiguillage du nœud n ; renvoie 'tout droit' ou 'la branche' (ou null : pas d'aiguillage)
  toggle(n) {
    const s = SIDES.find((x) => n.sides[x].length > 1);
    if (s === undefined) return null;
    const k = this.swKey(n, s), v = ((this.switches.get(k) || 0) + 1) % n.sides[s].length;
    this.switches.set(k, v);
    // (seul le panneau change : on refait le dessin de son chunk)
    const b = this.buckets.get(chunkOf(n.pos.x, n.pos.z));
    if (b) { this.unbuild(b); b.sig = this.signature(b); if (this.world.isLoaded(b.q, b.r)) this.build(b); }
    this.onChange?.();
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
    const b = this.buckets.get(chunkOf(n.pos.x, n.pos.z));
    if (b) { this.unbuild(b); b.sig = this.signature(b); if (this.world.isLoaded(b.q, b.r)) this.build(b); }
    this.onChange?.();
    this.onSwitch?.(n, !!this.chosen(n, s).curve);
  }

  // Règle l'aiguillage du côté s du nœud n sur le tronçon i (itinéraire d'un train)
  setSwitch(n, s, i) {
    const k = this.swKey(n, s);
    if ((this.switches.get(k) || 0) === i) return;
    this.switches.set(k, i);
    const b = this.buckets.get(chunkOf(n.pos.x, n.pos.z));
    if (b) { this.unbuild(b); b.sig = this.signature(b); if (this.world.isLoaded(b.q, b.r)) this.build(b); }
    this.onChange?.();
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
        const xr = !(x.a === n && x.as === -side), k = id(x, xr), nd = d + x.L + (avoid?.get(k) || 0);
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
  move(h, ds, trail = null, choices = null) {
    let { e, s, rev } = h, back = 0;
    s += ds;
    // (un tronçon droit fait 1 case : on peut en traverser des milliers pour placer un long train)
    for (let guard = 0; ; guard++) {
      if (guard > 20000) return { e, s: Math.max(0, Math.min(e.L, s)), rev, end: true, back };
      if (s > e.L) {
        const n = rev ? e.a : e.b, side = rev ? e.as : e.bs;
        const nx = this.across(n, side, choices && ((l) => l[choices.get(this.swKey(n, -side))]));
        if (!nx) return { e, s: e.L, rev, end: true, back };
        s -= e.L;
        ({ e, rev } = nx);
      } else if (s < 0) {
        const n = rev ? e.b : e.a, side = rev ? e.bs : e.as, k = trail?.[back];
        const nx = this.across(n, side, (l) => l.find((x) => x.key === k));
        if (!nx) return { e, s: 0, rev, end: true, back };
        // on arrive sur le tronçon précédent par son bout qui touche n : on le parcourt vers n
        ({ e, rev } = nx);
        rev = !rev;
        s += e.L;
        back++;
      } else break;
    }
    return { e, s, rev, end: false, back };
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
    const out = { station: null, sw: null, end: null, sign: null };
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
    const p = new THREE.Vector3(x, y, z), ab = new THREE.Vector3(), ap = new THREE.Vector3();
    for (const e of this.edges.values()) {
      if (Math.abs(e.pts[0].y - y) > 3 && Math.abs(e.pts[e.pts.length - 1].y - y) > 3) continue;
      // (rapide : boîte autour du tronçon)
      const a0 = e.pts[0], a1 = e.pts[e.pts.length - 1];
      if (x < Math.min(a0.x, a1.x) - e.L - 2 || x > Math.max(a0.x, a1.x) + e.L + 2 || z < Math.min(a0.z, a1.z) - e.L - 2 || z > Math.max(a0.z, a1.z) + e.L + 2) continue;
      for (let i = 0; i + 1 < e.pts.length; i++) {
        const a = e.pts[i];
        ab.subVectors(e.pts[i + 1], a);
        const t = Math.max(0, Math.min(1, ap.subVectors(p, a).dot(ab) / (ab.lengthSq() || 1)));
        const q = a.clone().addScaledVector(ab, t), d = Math.hypot(q.x - x, q.z - z);
        if (d < bd) { bd = d; best = { e, u: e.len[i] + t * (e.len[i + 1] - e.len[i]), tx: ab.x, tz: ab.z }; }
      }
    }
    if (!best) return null;
    const rev = best.tx * dx + best.tz * dz < 0;
    return { e: best.e, s: rev ? best.e.L - best.u : best.u, rev };
  }

  // ---------- Dessin ----------
  // Chaque morceau de voie (tronçon, ou bout libre au-delà d'un nœud) est inscrit dans les chunks
  // qu'il traverse ; le dessin d'un chunk n'est construit que quand ce chunk est chargé.
  // (après un changement, seuls les chunks dont la voie a changé sont redessinés, tout de suite :
  // les autres gardent leur dessin, rien ne disparaît le temps de la reconstruction)
  layout() {
    this.M ||= materials();
    const old = this.buckets;
    this.buckets = new Map();
    const bucket = (k) => {
      let b = this.buckets.get(k);
      if (!b) {
        const [cq, cr] = k.split(',').map(Number);
        this.buckets.set(k, (b = { k, q: cq * CS + (CS >> 1), r: cr * CS + (CS >> 1), pieces: new Set(), span: new Map(), nodes: [], props: [], group: null }));
      }
      return b;
    };
    const add = (piece, id) => {
      piece.id = id;
      // (un point tous les quarts de bloc : une voie qui ne fait que frôler le coin d'un chunk y est
      // quand même inscrite, sinon ce bout de voie n'était jamais dessiné : un trou dans les rails)
      const n = Math.max(1, Math.ceil(piece.L / 0.25));
      const p = new THREE.Vector3();
      let j = 0; // (u ne fait qu'avancer : on reprend où on en était)
      for (let i = 0; i <= n; i++) {
        const u = (i * piece.L) / n, { pts, len } = piece;
        while (j < len.length - 2 && u > len[j + 1]) j++;
        p.copy(pts[j]).lerp(pts[j + 1], Math.max(0, Math.min(1, (u - len[j]) / ((len[j + 1] - len[j]) || 1))));
        const b = bucket(chunkOf(p.x, p.z));
        b.pieces.add(piece);
        // (la portion du morceau dans ce chunk : seule elle est dessinée, voir build)
        const sp = b.span.get(piece);
        if (sp) { sp[0] = Math.min(sp[0], u); sp[1] = Math.max(sp[1], u); } else b.span.set(piece, [u, u]);
      }
    };
    for (const e of this.edges.values()) add(e, e.key);
    for (const n of this.nodes.values()) {
      // bouts de voie libres : un demi-tronçon au-delà du nœud
      for (const s of SIDES) if (!n.sides[s].length) add(this.shape(n.pos, AX[n.axis], n.pos.clone().addScaledVector(AX[n.axis], s * 0.5), AX[n.axis], false), 'b:' + n.key + '/' + s);
      if (this.isSwitch(n)) bucket(chunkOf(n.pos.x, n.pos.z)).nodes.push(n);
    }
    for (const p of this.props) bucket(chunkOf(p.pos.x, p.pos.z)).props.push(p);
    // signature de chaque chunk : ses morceaux et l'état de ses aiguillages
    for (const b of this.buckets.values()) b.sig = this.signature(b);
    for (const [k, b] of this.buckets) {
      const o = old.get(k);
      if (o?.group && o.sig === b.sig) { b.group = o.group; o.group = null; }
      else if (this.shown(b)) this.build(b);
    }
    for (const o of old.values()) this.unbuild(o);
    this.visT = performance.now();
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
    const mine = (x, z) => chunkOf(x, z) === b.k;
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
      const steps = Math.max(1, Math.ceil(e.L / 0.25));
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
    const g = new THREE.Group();
    this.sleeperGeo ||= new THREE.BoxGeometry(SLEEPER_D, SLEEPER_H, SLEEPER_W);
    if (mats.length) {
      const sl = new THREE.InstancedMesh(this.sleeperGeo, this.M.sleeper, mats.length);
      mats.forEach((mm, i) => sl.setMatrixAt(i, mm));
      sl.instanceMatrix.needsUpdate = true;
      sl.receiveShadow = true;
      sl.computeBoundingSphere();
      sl.userData.shared = true; // (sa forme est partagée : jamais libérée avec le chunk)
      g.add(sl);
    }
    if (pos.length) {
      const rg = new THREE.BufferGeometry();
      rg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      rg.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      rg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      rg.setIndex(idx);
      const rm = new THREE.Mesh(rg, this.M.rail);
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
      g.add(post, lamp);
    }
    // butoirs et panneaux
    for (const p of b.props) g.add(p.kind === 'sign' ? this.signModel(p) : this.bufferModel(p));
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
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 3.3, 0.14), M.post);
    post.position.set(0, 1.65, -0.03); // (derrière la plaque : il ne la traverse pas)
    post.castShadow = true;
    g.add(post);
    this.signTex ||= new Map();
    let mat = this.signTex.get(p.kmh);
    if (!mat) {
      const c = document.createElement('canvas');
      c.width = c.height = 128;
      const x = c.getContext('2d');
      // (hexagones : sommets à 0°, 60°... comme la plaque, voir CircleGeometry à 6 côtés)
      const hex = (r, col) => { x.fillStyle = col; x.beginPath(); for (let i = 0; i < 6; i++) { const a = (i * Math.PI) / 3; x[i ? 'lineTo' : 'moveTo'](64 + Math.cos(a) * r, 64 + Math.sin(a) * r); } x.closePath(); x.fill(); };
      hex(64, '#d0302a');
      hex(p.kmh ? 49 : 61, '#f4f4f0');
      x.fillStyle = '#16171a';
      if (p.kmh) {
        x.font = `bold ${p.kmh >= 100 ? 44 : 56}px system-ui, sans-serif`;
        x.textAlign = 'center'; x.textBaseline = 'middle';
        x.fillText(String(p.kmh), 64, 68);
      } else {
        x.save(); x.translate(64, 64); x.rotate(-Math.PI / 4);
        for (const d of [-14, 0, 14]) x.fillRect(-50, d - 3, 100, 6);
        x.restore();
      }
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      mat = new THREE.MeshLambertMaterial({ map: t, side: THREE.DoubleSide });
      this.signTex.set(p.kmh, mat);
    }
    // (une plaque hexagonale de chaque côté du cerclage : lisible dans les deux sens)
    for (const side of [0, 1]) {
      const plate = new THREE.Mesh(new THREE.CircleGeometry(0.62, 6), mat);
      plate.position.set(0, 3.45, side ? -0.141 : 0.081);
      plate.rotation.y = side ? Math.PI : 0;
      g.add(plate);
    }
    // cerclage : prisme hexagonal (tourné de 30° pour suivre les sommets de la plaque)
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.63, 0.63, 0.22, 6, 1, false, Math.PI / 6).rotateX(Math.PI / 2), M.post);
    rim.position.set(0, 3.45, -0.03);
    g.add(rim);
    const a = p.along || new THREE.Vector3(1, 0, 0);
    g.rotation.y = Math.atan2(-a.z, a.x) + Math.PI / 2; // (le disque face aux trains)
    g.position.set(p.pos.x, p.pos.y, p.pos.z);
    return g;
  }

  update() {
    // (pendant qu'une longue voie se pose, le réseau n'est refait qu'à la fin)
    if (this.dirty && !this.hold) this.rebuild();
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
  }

  // ---------- Tracer une ligne (commande /voie) ----------
  // Une voie de (ax, az) à (bx, bz), à la hauteur y, aussi longue qu'on veut, dans n'importe quelle
  // direction (un nœud toutes les 16 cases, reliés par de longues lignes droites) :
  //  - presque dans un axe de la grille : une ligne droite, et un grand virage en S si l'arrivée
  //    est un peu décalée ;
  //  - entre deux axes : une ligne droite dans le premier, un grand virage, une ligne droite dans
  //    l'autre (un « L » adouci) ;
  //  - double : une deuxième voie parallèle, à côté.
  // Le passage est dégagé (3 cases de large, 5 de haut) et le vide sous la voie comblé de gravier.
  // Au-dessus d'un ravin, d'une vallée ou de l'eau (3 blocs de vide ou plus) : un pont (tablier de
  // pierre, parapets, une pile jusqu'au sol toutes les 8 cases) ; sous une montagne : un tunnel
  // (parois et voûte de pierre là où la roche manque).
  // Le travail se fait petit à petit (voir step) : les chunks ne sont pas chargés, seules leurs
  // modifications sont notées. Renvoie un chantier { step(ms) -> fini ?, progress, result } ou { error }
  layLine(ax, az, bx, bz, y, double = false) {
    const plans = [this.planLine(ax, az, bx, bz)];
    if (plans[0].error) return plans[0];
    if (double) {
      // à côté, à environ 5 blocs (6 rangées de cases), à gauche du sens de la marche, au départ
      // comme à l'arrivée
      const D = 3 * Math.sqrt(3), [d0, d1] = plans[0].dirs;
      const p2 = this.planLine(ax - d0.z * D, az + d0.x * D, bx - d1.z * D, bz + d1.x * D);
      if (p2.error) return p2;
      plans.push(p2);
    }
    const W = this.world, done = new Set();
    const STONE = 28, PARAPET = 32, GRAVEL = 244; // (pierre taillée, sa dalle, gravier)
    let count = 0, bridges = 0, tunnels = 0;
    // (les parois et voûtes déjà posées ne comptent pas comme de la roche : sinon le tunnel
    // continuerait tout seul après la montagne)
    const ours = new Set(), wall = (q, r, yy) => { W.setBlock(q, r, yy, STONE); ours.add(q + ',' + r + ',' + yy); };
    const rock = (q, r, yy) => !ours.has(q + ',' + r + ',' + yy) && SOLID[W.getBlock(q, r, yy)];
    const clearAround = (x, z) => {
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
        const k = q + ',' + r;
        if (d > 2.65 || done.has(k)) continue;
        if (d > 1.75) {
          // bord du passage (pas encore dégagé) : parapet du pont, parois du tunnel
          if (bridge) {
            if (!SOLID[W.getBlock(q, r, y - 1)]) W.setBlock(q, r, y - 1, STONE);
            if (!W.getBlock(q, r, y)) W.setBlock(q, r, y, PARAPET);
          } else if (tunnel) {
            for (let yy = y; yy <= y + 5; yy++) if (!SOLID[W.getBlock(q, r, yy)]) wall(q, r, yy);
          }
          continue;
        }
        done.add(k);
        for (let yy = y; yy < y + 5; yy++) { const id = W.getBlock(q, r, yy); if (id && !isTrack(id)) W.setBlock(q, r, yy, 0); }
        const under = W.getBlock(q, r, y - 1);
        if (bridge) { if (!SOLID[under]) W.setBlock(q, r, y - 1, d < 0.6 ? GRAVEL : STONE); }
        else if (!under || (under >= 7 && under <= 16)) W.setBlock(q, r, y - 1, GRAVEL);
        if (tunnel && !SOLID[W.getBlock(q, r, y + 5)]) wall(q, r, y + 5); // (la voûte)
      }
      // une pile du pont, jusqu'au sol (ou au fond de l'eau), toutes les 8 cases
      if (bridge && count % 8 === 0) for (let yy = y - 2; yy > y - 66 && !SOLID[W.getBlock(c.q, c.r, yy)]; yy--) W.setBlock(c.q, c.r, yy, STONE);
    };
    // le travail : une liste de tâches (dégager autour d'un point, poser un nœud), faites par lots
    const total = plans.reduce((n, p) => n + p.points, 0);
    let pi = 0, gen = plans[0].walk(), doneCount = 0, rails = 0;
    const self = this;
    this.hold = true;
    const job = {
      progress: 0, result: null,
      step(budget = 6) {
        const t0 = performance.now();
        while (performance.now() - t0 < budget) {
          const it = gen.next();
          if (it.done) {
            if (++pi >= plans.length) return job.finish();
            gen = plans[pi].walk();
            continue;
          }
          const v = it.value;
          if (v.clear) clearAround(v.x, v.z);
          else { W.setBlock(v.q, v.r, y, TRACK_IDS[v.axis]); rails++; }
          doneCount++;
          if (done.size > 400000) { done.clear(); ours.clear(); } // (une ligne immense : la mémoire des cases dégagées est vidée de temps en temps)
        }
        job.progress = Math.min(0.99, doneCount / Math.max(1, total));
        return false;
      },
      finish() {
        // les tronçons : longues lignes entre nœuds successifs, et les virages
        for (const pl of plans) for (const c of pl.links) self.links.push({ ...c, a: c.a.replace(/Y$/, y), b: c.b.replace(/Y$/, y) });
        self.dirty = true;
        self.hold = false;
        self.onChange?.();
        job.progress = 1;
        job.result = { rails, bridges, tunnels, curves: plans.reduce((n, p) => n + p.links.filter((c) => c.t === 'c').length, 0), len: Math.round(plans.reduce((n, p) => n + p.len, 0)) };
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
  pack(runs, curves, links, len) {
    const points = runs.reduce((n, r) => n + r.n + 1, 0) * 1.06 + curves.reduce((n, c) => n + c.pts.length, 0);
    return {
      links, len, points, dirs: [DIRV[runs[0].k], DIRV[runs[runs.length - 1].k]],
      *walk() {
        for (const run of runs) {
          const [sq, sr] = NEIGHBORS[run.k];
          for (let k = 0; k <= run.n; k++) {
            const c = hexToWorld(run.q + sq * k, run.r + sr * k);
            yield { clear: true, x: c.x, z: c.z };
            if (k % LINE_STEP === 0 || k === run.n) yield { q: run.q + sq * k, r: run.r + sr * k, axis: run.k % 3 };
          }
        }
        for (const cv of curves) for (const p of cv.pts) yield { clear: true, x: p.x, z: p.z };
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
