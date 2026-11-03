// Assembleur de chariot (comme celui du mod Create) : un bloc posé sous un rail. Un Hexacart
// passe (ou s'arrête) sur ce rail :
//  - l'assembleur alimenté (voltite) : les blocs au-dessus du chariot montent dessus et partent
//    avec lui (ceux collés ensemble à la super colle, sinon la pile juste au-dessus, CART_STACK
//    blocs au plus) ;
//  - l'assembleur sans courant : le chariot repose son chargement dans le monde, calé sur la grille.
// Le chargement est un objet collé « porté » (kinematic, comme le plateau d'un wagon plat : voir
// structs.js) : la physique ne le bouge pas, le chariot le place à chaque image, en tournant avec
// lui. Le joueur peut monter dessus, et y construire.
import * as THREE from 'three';
import { BLOCKS, isWater } from './blocks.js?v=1.1.5-alpha-mw17vbxj';
import { hexToWorld } from './hex.js?v=1.1.5-alpha-mw17vbxj';

const CART_STACK = 8;
const UP = new THREE.Vector3(0, 1, 0);

export class CartLoads {
  constructor(carts, structs, world, circuits) {
    this.carts = carts;
    this.structs = structs;
    this.world = world;
    this.circuits = circuits;
    this.tmp = new THREE.Vector3();
  }

  // (hôte, ou partie solo) : chargements et déchargements
  update() {
    for (const cart of this.carts.carts) {
      if (cart.load && !this.structs.list.includes(cart.load)) cart.load = null;
      const p = cart.rail;
      if (!p || cart.isTrain || !BLOCKS[this.world.getBlock(p.q, p.r, p.y - 1)]?.cartAsm) continue;
      const on = this.circuits.powered(p.q, p.r, p.y - 1);
      if (on && !cart.load) this.assemble(cart, p.q, p.r, p.y);
      else if (!on && cart.load) this.disassemble(cart, p.q, p.r);
    }
    // un chariot retiré : son chargement redevient un objet collé ordinaire (il tombe)
    for (const s of this.structs.list) if (s.cartLoad && !this.carts.carts.includes(s.carrier)) this.release(s);
  }

  assemble(cart, q, r, y) {
    const S = this.structs, w = this.world;
    let cells = S.gluedGroup(q, r, y + 1);
    if (!cells.length) {
      for (let k = 1; k <= CART_STACK; k++) {
        const id = w.getBlock(q, r, y + k), b = BLOCKS[id];
        if (!id || isWater(id) || !b || b.unbreakable || b.liquid || b.lava) break;
        cells.push([q, r, y + k]);
      }
    }
    if (!cells.length) return;
    const s = S.assemble(cells);
    if (!s) return;
    this.carry(cart, s, S.origin(s, new THREE.Vector3()).sub(cart.pos), 0);
  }

  carry(cart, s, off, rel) {
    s.kinematic = true;
    s.cartLoad = true;
    s.carrier = cart;
    s.sleeping = true;
    s.vel.set(0, 0, 0);
    s.ang.set(0, 0, 0);
    cart.load = s;
    cart.loadOff = off;
    cart.loadYaw = (cart.yaw ?? 0) - rel;
    this.placeOne(cart);
  }

  // (le chargement est d'abord replacé comme si le chariot était au milieu de la case de
  // l'assembleur : un chariot rapide ne le pose pas une case trop loin)
  disassemble(cart, q, r) {
    const s = cart.load, c = hexToWorld(q, r), was = cart.pos.clone();
    cart.pos.x = c.x;
    cart.pos.z = c.z;
    this.placeOne(cart);
    cart.pos.copy(was);
    s.kinematic = false;
    if (this.structs.disassemble(s)) { cart.load = null; return; }
    s.kinematic = true; // (pas la place : il reste sur le chariot)
  }

  release(s) {
    s.kinematic = false;
    s.cartLoad = false;
    s.carrier = null;
    this.structs.wake(s);
  }

  // Chaque image, après les chariots : chaque chargement suit le sien
  place() {
    for (const cart of this.carts.carts) if (cart.load) this.placeOne(cart);
  }
  placeOne(cart) {
    const s = cart.load, S = this.structs;
    if (!S.list.includes(s)) { cart.load = null; return; }
    (s.kinPrevPos ||= new THREE.Vector3()).copy(s.pos);
    (s.kinPrevQuat ||= new THREE.Quaternion()).copy(s.quat);
    s.quat.setFromAxisAngle(UP, (cart.yaw ?? 0) - cart.loadYaw);
    const o = this.tmp.copy(cart.loadOff).applyQuaternion(s.quat).add(cart.pos);
    s.pos.copy(s.com).applyQuaternion(s.quat).add(o);
    this.carts.velocity(cart, s.vel);
    s.ang.set(0, 0, 0);
    S.updateFrame(s);
  }

  // ---------- Sauvegarde (après celle des chariots : le rang du chariot dans la liste) ----------
  serialize() {
    const out = [];
    this.carts.carts.forEach((c, i) => {
      if (!c.load || !this.structs.list.includes(c.load)) return;
      out.push({ i, b: c.load.list, o: c.loadOff.toArray(), a: (c.yaw ?? 0) - c.loadYaw });
    });
    return out;
  }
  // (après carts.load et structs.load)
  load(list) {
    for (const d of Array.isArray(list) ? list : []) {
      const cart = this.carts.carts[d?.i];
      if (!cart || !Array.isArray(d.b) || !Array.isArray(d.o) || d.o.length !== 3 || !d.o.every(Number.isFinite)) continue;
      const blocks = d.b.filter((e) => Array.isArray(e) && e.length === 4 && e.every(Number.isInteger) && BLOCKS[e[3]]);
      if (!blocks.length) continue;
      const S = this.structs, s = S.create(++S.nextId, cart.pos.x, cart.pos.y, cart.pos.z, null, blocks);
      this.carry(cart, s, new THREE.Vector3().fromArray(d.o), Number.isFinite(d.a) ? d.a : 0);
    }
  }
}
