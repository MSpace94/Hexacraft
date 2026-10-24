// Hexacarts : chariots en forme de cuve hexagonale, avec une physique réaliste.
//
// Sur les rails, le chariot avance le long de la voie (un seul degré de liberté) :
//  - gravité : il accélère dans les descentes et ralentit dans les montées
//  - frottement de roulement + résistance de l'air (augmente avec le carré de la vitesse)
//  - perte d'énergie dans les virages (plus le virage est serré, plus il freine)
//  - il déraille au bout de la voie ou si le rail suivant ne se raccorde pas
// Hors des rails, c'est un objet libre : il tombe, glisse sur le sol avec frottement, et
// se remet sur la voie s'il retombe sur un rail.
// On peut le pousser en marchant dedans, monter dedans (clic droit), et les chariots se
// percutent entre eux (choc presque élastique : ils échangent leur élan).
import * as THREE from 'three';
import { NEIGHBORS, hexToWorld, worldToHex } from './hex.js?v=1.1.5-alpha-mvm2b95g';
import { SOLID, OPAQUE, columnOverlap, columnPush, POWERED_RAIL, POWERED_RAIL_OFF, DIAMOND_RAIL, DIAMOND_RAIL_OFF, isRail } from './blocks.js?v=1.1.5-alpha-mvm2b95g';
import { railShape, railCurve, RAIL_H } from './rails.js?v=1.1.5-alpha-mvm2b95g';
import { DEPTH } from './gen.js?v=1.1.5-alpha-mvm2b95g';

const G = 24;             // gravité (blocs/s²)
const ROLL = 0.35;        // frottement de roulement (blocs/s²)
const AIR_DRAG = 0.012;   // résistance de l'air (× v²)
const BOOST = 14;         // accélération d'un rail de propulsion allumé (blocs/s²)
const BOOST_DIAMOND = 45; // booster en diamant : pousse bien plus fort (vitesse limite ~60 blocs/s)
const BRAKE = 20;         // freinage d'un rail de propulsion éteint (blocs/s²)
const WALL_GAP = 0.14;     // distance au bord où la cuve touche un bloc (0.5 - rayon du chariot)
const BOUNCE = 0.5;       // part de la vitesse conservée en rebondissant contre un bloc
const KICK = 2.5;         // départ d'un chariot arrêté contre un mur sur un rail allumé
// Pas de vitesse maximale : seuls les frottements (air surtout) limitent la vitesse.
const TURN_LOSS = 0.07;   // perte de vitesse sur un virage entier (× (1 - cos de l'angle))
export const BODY_R = 0.36; // rayon de collision du chariot (hors des rails, et contre les objets collés)
export const BODY_H = 0.62;
const CELLS = [[0, 0], ...NEIGHBORS];

// ---------- Modèle 3D ----------
// Texture façon minecart (64x32) : paroi 16x8x2 en (0,0), plaque de fond 20x16x2 en (0,10).
function buildCartGeometry() {
  const R = 0.46, Ri = 0.4, y0 = 0.08, y1 = 0.62;
  const pos = [], uv = [];
  const T = (px, py) => [px / 64, 1 - py / 32];
  const corner = (k, rad) => {
    const a = (Math.PI / 180) * (60 * k - 30);
    return [Math.cos(a) * rad, Math.sin(a) * rad];
  };
  const quad = (p, t) => {
    for (const i of [0, 1, 2, 0, 2, 3]) { pos.push(...p[i]); uv.push(...t[i]); }
  };
  for (let k = 0; k < 6; k++) {
    const [ax, az] = corner(k, R), [bx, bz] = corner(k + 1, R);
    const [ix, iz] = corner(k, Ri), [jx, jz] = corner(k + 1, Ri);
    // paroi extérieure, paroi intérieure, rebord
    quad([[ax, y0, az], [bx, y0, bz], [bx, y1, bz], [ax, y1, az]], [T(2, 10), T(18, 10), T(18, 2), T(2, 2)]);
    quad([[ix, y0, iz], [jx, y0, jz], [jx, y1, jz], [ix, y1, iz]], [T(20, 10), T(36, 10), T(36, 2), T(20, 2)]);
    quad([[ax, y1, az], [bx, y1, bz], [jx, y1, jz], [ix, y1, iz]], [T(2, 0), T(18, 0), T(18, 2), T(2, 2)]);
  }
  // fond (dessus et dessous), la plaque est inscrite dans la zone 20x16
  const floorUV = (x, z) => T(2 + (x / R + 1) * 10, 12 + (z / R + 1) * 8);
  for (const y of [y0, y0 + 0.02]) {
    for (let k = 0; k < 6; k++) {
      const [ax, az] = corner(k, R), [bx, bz] = corner(k + 1, R);
      for (const [x, z] of [[0, 0], [ax, az], [bx, bz]]) { pos.push(x, y, z); uv.push(...floorUV(x, z)); }
    }
  }
  // essieux sous le fond
  for (const s of [-0.22, 0.22]) {
    quad([[-0.4, 0.04, s - 0.04], [0.4, 0.04, s - 0.04], [0.4, 0.04, s + 0.04], [-0.4, 0.04, s + 0.04]], [T(4, 14), T(8, 14), T(8, 15), T(4, 15)]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

// ---------- Voie ----------
// Chemin d'un rail dans sa case, du bord "a" au bord "b" : le même tracé que celui
// dessiné (ligne droite ou arc de cercle), en points 3D avec leur abscisse cumulée.
export function railPath(world, q, r, y, entry) {
  const get = (a, b, c) => world.getBlock(a, b, c);
  const shape = railShape(get, q, r, y);
  let a = shape.a, b = shape.b;
  if (entry === b) [a, b] = [b, a];                // on entre par le bord "a"
  else if (entry >= 0 && entry !== a) return null;  // le rail ne se raccorde pas de ce côté
  const c = hexToWorld(q, r);
  const pts = railCurve(shape, c.x, c.z, y, a, b).map((p) => new THREE.Vector3(p[0], p[1], p[2]));
  const len = [0];
  for (let i = 1; i < pts.length; i++) len.push(len[i - 1] + pts[i].distanceTo(pts[i - 1]));
  const L = len[len.length - 1];
  // perte d'énergie du virage, répartie le long de la courbe
  const da = new THREE.Vector3().subVectors(pts[1], pts[0]).normalize();
  const db = new THREE.Vector3().subVectors(pts.at(-1), pts.at(-2)).normalize();
  const loss = TURN_LOSS * (1 - (da.x * db.x + da.z * db.z)) / L;
  return { q, r, y, a, b, shape, pts, len, L, loss, pa: pts[0], pb: pts.at(-1) };
}

// Rail suivant par le bord d du chemin (on sort de la case à la hauteur absolue edgeY), orienté
// depuis ce bord ; null si la voie ne continue pas (aussi pour les trains, voir trains.js)
export function nextRailOf(world, path, d, edgeY) {
  const [dq, dr] = NEIGHBORS[d];
  const nq = path.q + dq, nr = path.r + dr, back = (d + 3) % 6;
  for (const ly of [path.y + 1, path.y, path.y - 1]) {
    if (!isRail(world.getBlock(nq, nr, ly))) continue;
    const np = railPath(world, nq, nr, ly, back);
    if (np && Math.abs(np.pa.y - edgeY) < 0.2) return np;
  }
  return null;
}

// Segment du chemin contenant l'abscisse s
function segAt(path, s) {
  const { len } = path;
  let i = 0;
  while (i < len.length - 2 && s > len[i + 1]) i++;
  return i;
}

export class CartSystem {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.carts = [];
    this.nextId = 0;
    // remote = true : partie rejointe en multijoueur. L'hôte simule les chariots ;
    // ici on ne fait qu'afficher leur état reçu (voir applyState).
    this.remote = false;
    this.geometry = buildCartGeometry();
    this.material = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide });
    this.tmp = new THREE.Vector3();
  }

  async init() {
    const tex = await new THREE.TextureLoader().loadAsync('texture/entites/hexacart/hexacart_entity.png').catch(() => null);
    if (tex) {
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.NearestFilter;
      tex.colorSpace = THREE.SRGBColorSpace;
      this.material.map = tex;
      this.material.alphaTest = 0.5;
      this.material.needsUpdate = true;
    } else {
      this.material.color.set(0x777c80);
    }
  }

  get moving() {
    return this.carts.some((c) => Math.abs(c.v) > 0.02 || c.vel.lengthSq() > 0.0004);
  }

  // Pose un chariot sur le rail de la case (q, r, y).
  spawn(q, r, y, yaw = 0) {
    const cart = this.create(++this.nextId);
    const c = hexToWorld(q, r);
    cart.pos.set(c.x, y + RAIL_H, c.z);
    this.carts.push(cart);
    // orientation initiale : dans le sens du regard du joueur
    if (!this.attach(cart, q, r, y, -1, new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw)))) cart.rail = null;
    this.place(cart);
    return cart;
  }

  // Chariot vide (modèle ajouté à la scène)
  create(id) {
    const cart = { id, pos: new THREE.Vector3(), vel: new THREE.Vector3(), v: 0, s: 0, rail: null, rider: null, onGround: false };
    cart.mesh = new THREE.Mesh(this.geometry, this.material);
    cart.mesh.castShadow = true;
    this.scene.add(cart.mesh);
    return cart;
  }

  byId(id) {
    return this.carts.find((c) => c.id === id) || null;
  }

  remove(cart) {
    if (cart.rider) this.dismount(cart.rider);
    this.scene.remove(cart.mesh);
    this.carts = this.carts.filter((c) => c !== cart);
  }

  clear() {
    for (const c of [...this.carts]) this.remove(c);
  }

  // Met le chariot sur la voie de la case. entry = bord d'entrée (ou -1), dir = sens souhaité.
  attach(cart, q, r, y, entry, dir) {
    if (!isRail(this.world.getBlock(q, r, y))) return false;
    let path = railPath(this.world, q, r, y, entry);
    if (!path) return false;
    if (entry < 0 && dir) {
      // choisit le sens de parcours le plus proche de la direction donnée
      const forward = this.tmp.copy(path.pb).sub(path.pa);
      if (forward.dot(dir) < 0) path = railPath(this.world, q, r, y, path.b);
    }
    cart.rail = path;
    // position la plus proche sur la voie (à l'arrêt : l'appelant donne la vitesse)
    cart.s = this.closestS(path, cart.pos);
    cart.v = 0;
    cart.vel.set(0, 0, 0);
    return true;
  }

  closestS(path, p) {
    let best = 0, bestD = Infinity;
    const ab = new THREE.Vector3(), ap = new THREE.Vector3();
    for (let i = 0; i + 1 < path.pts.length; i++) {
      const a = path.pts[i];
      ab.subVectors(path.pts[i + 1], a);
      const t = Math.max(0, Math.min(1, ap.subVectors(p, a).dot(ab) / (ab.lengthSq() || 1)));
      const d = ap.copy(a).addScaledVector(ab, t).distanceToSquared(p);
      if (d < bestD) { bestD = d; best = path.len[i] + t * (path.len[i + 1] - path.len[i]); }
    }
    return best;
  }

  pointAt(path, s, out = new THREE.Vector3()) {
    const i = segAt(path, s), l0 = path.len[i], l1 = path.len[i + 1];
    return out.copy(path.pts[i]).lerp(path.pts[i + 1], Math.max(0, Math.min(1, (s - l0) / (l1 - l0 || 1))));
  }

  dirAt(path, s, out = new THREE.Vector3()) {
    const i = segAt(path, s);
    return out.subVectors(path.pts[i + 1], path.pts[i]).normalize();
  }

  // Rail suivant par le bord d (on sort de la case à la hauteur absolue edgeY)
  nextRail(path, d, edgeY) {
    return nextRailOf(this.world, path, d, edgeY);
  }

  // Le bord d de la case est-il fermé par un bloc solide (sans rail qui continue) ?
  blocked(path, d, edgeY) {
    if (this.nextRail(path, d, edgeY)) return false;
    const nq = path.q + NEIGHBORS[d][0], nr = path.r + NEIGHBORS[d][1], ly = Math.floor(edgeY + 0.01);
    return SOLID[this.world.getBlock(nq, nr, ly)] === 1 || SOLID[this.world.getBlock(nq, nr, ly + 1)] === 1 && edgeY + BODY_H > ly + 1;
  }

  derail(cart) {
    const d = this.dirAt(cart.rail, cart.s);
    cart.vel.copy(d).multiplyScalar(cart.v);
    // ne se remet pas tout de suite sur la case qu'il vient de quitter (les autres rails, si)
    cart.lastRail = cart.rail.q + ',' + cart.rail.r + ',' + cart.rail.y;
    cart.noRail = 0.3;
    cart.rail = null;
    cart.v = 0;
  }

  // ---------- Simulation ----------
  // others : les autres joueurs (multijoueur, côté hôte) — ils poussent les chariots, et
  // un passager distant a ses propres commandes (rider.input / rider.look)
  update(dt, player, input, look, others = []) {
    if (this.remote) this.updateRemote(dt, player);
    else this.simulate(dt, player, input, look, others);
  }

  simulate(dt, player, input, look, others) {
    let vmax = 0;
    for (const c of this.carts) vmax = Math.max(vmax, Math.abs(c.v), c.vel.length());
    const steps = Math.min(200, Math.max(1, Math.ceil(dt / 0.01), Math.ceil(dt * vmax / 0.15)));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      for (const cart of this.carts) {
        const own = cart.rider && cart.rider.input;
        if (cart.rail) this.stepRail(cart, h, own ? cart.rider.input : input, own ? cart.rider.look : look);
        else this.stepFree(cart, h);
      }
      this.collideCarts();
    }
    for (const cart of this.carts) {
      if (!cart.rider) for (const p of [player, ...others]) this.pushByPlayer(cart, p, dt);
      this.place(cart);
      if (cart.rider) {
        // le joueur est assis dans la cuve
        cart.rider.pos.set(cart.pos.x, cart.pos.y - 0.4, cart.pos.z);
        cart.rider.vel.copy(cart.rail ? this.dirAt(cart.rail, cart.s).multiplyScalar(cart.v) : cart.vel);
      }
    }
  }

  stepRail(cart, h, input, look) {
    let path = cart.rail;
    const id = this.world.getBlock(path.q, path.r, path.y);
    if (!isRail(id)) { this.derail(cart); return; } // rail cassé
    const d = this.dirAt(path, cart.s, this.tmp);
    let a = -G * d.y; // gravité le long de la voie
    // le passager peut pousser (Z) dans le sens de son regard
    if (cart.rider && input && input.forward && Math.abs(cart.v) < 8) {
      const push = Math.sign(d.x * look.x + d.z * look.z) || 1;
      a += 3 * push;
    }
    if (id === POWERED_RAIL || id === DIAMOND_RAIL) {
      const boost = id === DIAMOND_RAIL ? BOOST_DIAMOND : BOOST;
      // rail allumé : pousse dans le sens de la marche. En montée, il compense aussi la gravité
      // (comme dans Minecraft, une rampe de rails allumés fait monter le chariot).
      // À l'arrêt : sur une rampe, part vers le haut ; contre un mur, repart dans l'autre sens.
      const uphill = Math.sign(path.pb.y - path.pa.y); // sens (en s) de la montée, 0 si à plat
      if (Math.abs(cart.v) <= 0.05 && uphill) cart.v = KICK * uphill;
      if (Math.abs(cart.v) > 0.05) {
        a += boost * Math.sign(cart.v);
        if (cart.v * d.y > 0) a += G * d.y;
      } else {
        const wall = (e, ey) => OPAQUE[this.world.getBlock(path.q + NEIGHBORS[e][0], path.r + NEIGHBORS[e][1], Math.floor(ey + 0.01))];
        if (wall(path.b, path.pb.y)) cart.v = -KICK;
        else if (wall(path.a, path.pa.y)) cart.v = KICK;
      }
    }
    cart.v += a * h;
    // frottements (ne font jamais repartir en arrière) ; un rail éteint freine fort
    const f = (ROLL + AIR_DRAG * cart.v * cart.v + (id === POWERED_RAIL_OFF || id === DIAMOND_RAIL_OFF ? BRAKE : 0)) * h;
    cart.v = Math.abs(cart.v) <= f ? 0 : cart.v - Math.sign(cart.v) * f;

    const s0 = cart.s;
    cart.s += cart.v * h;
    // virage : perte d'énergie au fil de la courbe
    if (path.loss) cart.v *= 1 - path.loss * Math.abs(cart.s - s0);
    // bloc plein au bout de la voie : le chariot le percute et repart dans l'autre sens
    if (cart.v > 0 && cart.s > path.L - WALL_GAP && this.blocked(path, path.b, path.pb.y)) {
      cart.s = path.L - WALL_GAP;
      cart.v = -cart.v * BOUNCE;
    } else if (cart.v < 0 && cart.s < WALL_GAP && this.blocked(path, path.a, path.pa.y)) {
      cart.s = WALL_GAP;
      cart.v = -cart.v * BOUNCE;
    }
    // passage aux cases suivantes (ou déraillement)
    while (cart.s > path.L || cart.s < 0) {
      if (cart.s > path.L) {
        const next = this.nextRail(path, path.b, path.pb.y);
        if (!next) { cart.s = path.L; this.derail(cart); return; }
        cart.s -= path.L;
        path = cart.rail = next;
      } else {
        const next = this.nextRail(path, path.a, path.pa.y);
        if (!next) { cart.s = 0; this.derail(cart); return; }
        // on entre par son bord "a" en allant vers son bord "b" : le sens s'inverse
        cart.s = -cart.s;
        cart.v = -cart.v;
        path = cart.rail = next;
      }
    }
    this.pointAt(cart.rail, Math.min(cart.s, cart.rail.L), cart.pos);
  }

  // Collision d'un cylindre (rayon BODY_R) avec les blocs solides des couches y0..y1, comme le
  // joueur (dalles verticales : seulement leur moitié)
  touches(pos, y0, y1, radius) {
    const { q, r } = worldToHex(pos.x, pos.z), get = this.getter();
    for (const [dq, dr] of CELLS) {
      const c = hexToWorld(q + dq, r + dr);
      if (columnOverlap(get, q + dq, r + dr, y0, y1 + 1, pos.x - c.x, pos.z - c.z, radius)) return true;
    }
    return false;
  }

  getter() {
    return (this._get ||= (q, r, y) => this.world.getBlock(q, r, y));
  }

  stepFree(cart, h) {
    const p = cart.pos, v = cart.vel;
    v.y = Math.max(-40, v.y - G * h);
    // vertical
    p.y += v.y * h;
    cart.onGround = false;
    if (v.y < 0) {
      const layer = Math.floor(p.y);
      if (this.touches(p, layer, layer, BODY_R - 0.05)) { p.y = layer + 1; v.y = 0; cart.onGround = true; }
    } else {
      const layer = Math.floor(p.y + BODY_H);
      if (this.touches(p, layer, layer, BODY_R - 0.05)) { p.y = layer - BODY_H - 1e-3; v.y = 0; }
    }
    // horizontal, avec dégagement des murs (et arrêt contre eux)
    const ox = p.x, oz = p.z;
    p.x += v.x * h;
    p.z += v.z * h;
    const y0 = Math.floor(p.y + 1e-3), y1 = Math.floor(p.y + BODY_H);
    for (let it = 0; it < 6; it++) {
      const { q, r } = worldToHex(p.x, p.z);
      let moved = false;
      for (const [dq, dr] of CELLS) {
        const c = hexToWorld(q + dq, r + dr);
        const push = columnPush(this.getter(), q + dq, r + dr, y0, y1 + 1, p.x - c.x, p.z - c.z, BODY_R);
        if (push) { p.x += push[0]; p.z += push[1]; moved = true; }
      }
      if (!moved) break;
    }
    if (this.touches(p, y0, y1, BODY_R - 1e-3)) { p.x = ox; p.z = oz; v.x = 0; v.z = 0; }
    else if (Math.abs(p.x - ox - v.x * h) > 1e-4 || Math.abs(p.z - oz - v.z * h) > 1e-4) {
      // contre un mur : on garde seulement la partie du mouvement qui glisse
      v.x = (p.x - ox) / h; v.z = (p.z - oz) / h;
    }
    if (p.y < -DEPTH - 30) { this.remove(cart); return; }
    // retombe sur un rail : il se remet sur la voie
    const { q, r } = worldToHex(p.x, p.z);
    const ly = Math.floor(p.y + 0.05);
    const skip = cart.noRail > 0 && cart.lastRail === q + ',' + r + ',' + ly;
    if (cart.noRail > 0) cart.noRail -= h;
    if (!skip && isRail(this.world.getBlock(q, r, ly)) && p.y - ly < 0.7) {
      // copie de la vitesse : attach() remet cart.vel (= v) à zéro
      const speed = v.clone();
      if (this.attach(cart, q, r, ly, -1, speed.lengthSq() > 1e-6 ? speed.clone().normalize() : null)) {
        // on garde la vitesse dans l'axe de la voie ; la chute verticale est absorbée par l'impact
        cart.v = this.dirAt(cart.rail, cart.s).dot(speed);
        this.pointAt(cart.rail, cart.s, cart.pos);
        return;
      }
    }
    // frottement au sol (glisse), un peu d'air
    const k = cart.onGround ? Math.max(0, 1 - 5 * h) : 1 - 0.1 * h;
    v.x *= k; v.z *= k;
  }

  // Vitesse 3D d'un chariot
  velocity(cart, out = new THREE.Vector3()) {
    if (cart.rail) return this.dirAt(cart.rail, cart.s, out).multiplyScalar(cart.v);
    return out.copy(cart.vel);
  }

  // Chocs entre chariots (masses égales, restitution 0.8)
  collideCarts() {
    const n = new THREE.Vector3(), va = new THREE.Vector3(), vb = new THREE.Vector3();
    for (let i = 0; i < this.carts.length; i++) {
      for (let j = i + 1; j < this.carts.length; j++) {
        const A = this.carts[i], B = this.carts[j];
        n.subVectors(B.pos, A.pos);
        const dist = n.length();
        if (dist > 0.92 || dist < 1e-4) continue;
        n.divideScalar(dist);
        this.velocity(A, va);
        this.velocity(B, vb);
        const rel = va.clone().sub(vb).dot(n);
        if (rel <= 0) continue; // ils s'éloignent déjà
        const j2 = rel * 0.9; // (1 + e) / 2 avec e = 0.8
        va.addScaledVector(n, -j2);
        vb.addScaledVector(n, j2);
        for (const [C, v] of [[A, va], [B, vb]]) {
          if (C.rail) C.v = this.dirAt(C.rail, C.s).dot(v);
          else C.vel.copy(v);
        }
      }
    }
  }

  // Le joueur qui marche dans un chariot le pousse (et ne passe pas au travers)
  pushByPlayer(cart, player, dt) {
    if (player.riding) return;
    const dx = player.pos.x - cart.pos.x, dz = player.pos.z - cart.pos.z;
    const dist = Math.hypot(dx, dz);
    const minD = 0.26 + 0.44;
    if (dist >= minD || Math.abs(player.pos.y - cart.pos.y) > 0.9) return;
    const nx = dist > 1e-4 ? dx / dist : 1, nz = dist > 1e-4 ? dz / dist : 0;
    player.pos.x = cart.pos.x + nx * minD;
    player.pos.z = cart.pos.z + nz * minD;
    // élan transmis dans la direction de la poussée
    const along = -(player.vel.x * nx + player.vel.z * nz);
    if (along <= 0) return;
    const impulse = Math.min(along, 6) * 4 * dt;
    if (cart.rail) {
      const d = this.dirAt(cart.rail, cart.s);
      cart.v += -(d.x * nx + d.z * nz) * impulse;
    } else {
      cart.vel.x -= nx * impulse;
      cart.vel.z -= nz * impulse;
    }
  }

  // Place et oriente le modèle : il tourne avec la voie et s'incline dans les pentes
  place(cart) {
    cart.mesh.position.copy(cart.pos);
    const d = cart.rail ? this.dirAt(cart.rail, cart.s) : cart.vel.clone();
    const hl = Math.hypot(d.x, d.z);
    if (hl < 1e-4) return;
    const yaw = Math.atan2(-d.z, d.x);
    // la cuve est hexagonale (symétrique tous les 60°) : on tourne vers l'angle équivalent
    // le plus proche, en douceur, pour éviter les sauts
    const cur = cart.yaw ?? yaw;
    let target = yaw;
    while (target - cur > Math.PI / 6) target -= Math.PI / 3;
    while (target - cur < -Math.PI / 6) target += Math.PI / 3;
    cart.yaw = cur + (target - cur) * 0.35;
    const pitch = cart.rail ? Math.atan2(d.y, hl) : 0;
    // inclinaison autour de l'axe horizontal perpendiculaire au déplacement
    this.qYaw ||= new THREE.Quaternion();
    this.qTilt ||= new THREE.Quaternion();
    this.qYaw.setFromAxisAngle(this.up ||= new THREE.Vector3(0, 1, 0), cart.yaw);
    this.qTilt.setFromAxisAngle(this.tmp.set(-d.z / hl, 0, d.x / hl), pitch);
    cart.mesh.quaternion.multiplyQuaternions(this.qTilt, this.qYaw);
  }

  // ---------- Passager ----------
  mount(cart, player) {
    if (cart.rider) return;
    cart.rider = player;
    player.riding = cart;
    player.fly = false;
  }

  dismount(player) {
    const cart = player.riding;
    if (!cart) return;
    if (cart.isTrain) { cart.owner.dismount(player); return; } // (une voiture de train, voir trains.js)
    cart.rider = null;
    player.riding = null;
    player.vel.set(0, 0, 0);
    // descend sur une case libre à côté du chariot (sinon au-dessus)
    const { q, r } = worldToHex(cart.pos.x, cart.pos.z);
    const y = Math.floor(cart.pos.y + 0.1);
    for (const [dq, dr] of NEIGHBORS) {
      const nq = q + dq, nr = r + dr;
      if (!SOLID[this.world.getBlock(nq, nr, y)] && !SOLID[this.world.getBlock(nq, nr, y + 1)]) {
        const c = hexToWorld(nq, nr);
        player.pos.set(c.x, y, c.z);
        return;
      }
    }
    player.pos.set(cart.pos.x, y + 1, cart.pos.z);
  }

  // ---------- Visée ----------
  // Chariot touché par le rayon (sphère englobante), avec sa distance
  raycast(origin, dir, maxDist) {
    let best = null;
    for (const cart of this.carts) {
      if (cart.rider && cart.rider.firstPerson) continue;
      const cx = cart.pos.x - origin.x, cy = cart.pos.y + 0.35 - origin.y, cz = cart.pos.z - origin.z;
      const t = cx * dir.x + cy * dir.y + cz * dir.z;
      if (t < 0 || t > maxDist) continue;
      const d2 = cx * cx + cy * cy + cz * cz - t * t;
      if (d2 < 0.45 * 0.45 && (!best || t < best.t)) best = { cart, t };
    }
    return best;
  }

  // ---------- Multijoueur ----------
  // État envoyé par l'hôte : [id, x, y, z, qx, qy, qz, qw, passager (id joueur ou -1), vitesse]
  state(pidOf) {
    return this.carts.map((c) => {
      const q = c.mesh.quaternion;
      const r = (v) => Math.round(v * 1000) / 1000;
      return [c.id, r(c.pos.x), r(c.pos.y), r(c.pos.z), r(q.x), r(q.y), r(q.z), r(q.w),
        c.rider ? pidOf(c.rider) : -1, r(Math.abs(c.rail ? c.v : c.vel.length()))];
    });
  }

  // Côté client : met à jour les chariots affichés d'après l'état reçu
  applyState(list) {
    const seen = new Set();
    for (const e of list) {
      if (!Array.isArray(e) || e.length < 10) continue;
      const [id, x, y, z, qx, qy, qz, qw, rider, speed] = e;
      let cart = this.byId(id);
      if (!cart) {
        cart = this.create(id);
        cart.pos.set(x, y, z);
        cart.mesh.position.set(x, y, z);
        cart.mesh.quaternion.set(qx, qy, qz, qw);
        this.carts.push(cart);
      }
      cart.target ||= { pos: new THREE.Vector3(), quat: new THREE.Quaternion() };
      cart.target.pos.set(x, y, z);
      cart.target.quat.set(qx, qy, qz, qw).normalize();
      cart.riderPid = rider;
      cart.v = speed;
      seen.add(id);
    }
    for (const c of [...this.carts]) {
      if (seen.has(c.id)) continue;
      this.scene.remove(c.mesh);
      this.carts = this.carts.filter((x) => x !== c);
      if (c.rider) { c.rider.riding = null; c.rider = null; }
    }
  }

  // Côté client : les chariots glissent en douceur vers leur dernière position connue
  updateRemote(dt, player) {
    const k = 1 - Math.exp(-dt * 15);
    for (const cart of this.carts) {
      if (cart.target) {
        cart.pos.lerp(cart.target.pos, k);
        // grand écart (téléportation, chargement) : on saute directement
        if (cart.pos.distanceToSquared(cart.target.pos) > 16) cart.pos.copy(cart.target.pos);
        cart.mesh.quaternion.slerp(cart.target.quat, k);
      }
      cart.mesh.position.copy(cart.pos);
    }
    if (player.riding) {
      const cart = player.riding;
      player.pos.set(cart.pos.x, cart.pos.y - 0.4, cart.pos.z);
      player.vel.set(0, 0, 0);
    }
  }

  // ---------- Sauvegarde ----------
  serialize() {
    return this.carts.map((c) => {
      const v = this.velocity(c);
      return { x: c.pos.x, y: c.pos.y, z: c.pos.z, vx: v.x, vy: v.y, vz: v.z };
    });
  }

  load(list) {
    this.clear();
    for (const d of list || []) {
      if (![d.x, d.y, d.z].every(Number.isFinite)) continue;
      const { q, r } = worldToHex(d.x, d.z);
      const cart = this.spawn(q, r, Math.floor(d.y + 0.05));
      cart.pos.set(d.x, d.y, d.z);
      const v = new THREE.Vector3(+d.vx || 0, +d.vy || 0, +d.vz || 0);
      if (cart.rail) {
        cart.s = this.closestS(cart.rail, cart.pos);
        cart.v = this.dirAt(cart.rail, cart.s).dot(v);
      } else {
        cart.vel.copy(v);
      }
      this.place(cart);
    }
  }
}
