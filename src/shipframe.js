// La gravité d'un vaisseau : dans le champ d'un générateur de gravité à bord (voir orbital.js), le
// bas, c'est le plancher du vaisseau, quelle que soit sa position (penché, à l'envers, en saut).
// Le joueur y marche dans le repère du vaisseau : sa position, sa vitesse et son regard (yaw,
// pitch) sont comptés dans la grille de blocs du vaisseau, et la physique du joueur (player.js)
// tourne là, avec pour « monde » les blocs du vaisseau (et, sur un astre, le terrain autour). La
// caméra et le corps tournent avec le vaisseau. Quand le vaisseau bouge, tourne ou saute, le joueur
// est emporté sans glisser (voir structs.update et spaceflight.move).
import * as THREE from 'three';
import { hexToWorld, worldToHex } from './hex.js?v=1.1.5-alpha-mwgq2wrb';
import { EYE, SNEAK_DROP } from './player.js?v=1.1.5-alpha-mwgq2wrb';

const GRAV_R = 16;             // (la portée d'un générateur, comme dans orbital.js)
const OUT_R = GRAV_R + 1.5;    // (on en sort un peu plus loin : pas d'aller-retour au bord)
// Sur un astre, sa gravité à lui commande : le générateur du vaisseau ne fait que la remplacer tant
// que le plancher est à peu près à plat (posé, en vol tranquille). Vaisseau très penché ou sur le
// flanc : on tombe vers le sol de l'astre, comme tout le reste (pas de marche sur les murs)
const PLANET_IN = Math.cos((35 * Math.PI) / 180), PLANET_OUT = Math.cos((50 * Math.PI) / 180);
const key = (q, r, y) => q + ',' + r + ',' + y;
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler(0, 0, 0, 'YXZ');

export class ShipFrame {
  // g : { structs, orbital, world, flight, survival }
  constructor(g) {
    this.g = g;
    this.s = null;
    this.L = new THREE.Vector3();  // position dans le vaisseau (grille locale)
    this.v = new THREE.Vector3();  // vitesse dans le vaisseau
    const self = this;
    // le « monde » du joueur dans le repère du vaisseau : ses blocs ; sur un astre, le terrain en dessous
    this.proxy = {
      getBlock(q, r, y) {
        const s = self.s;
        const id = s?.blocks.get(key(q, r, y));
        if (id || !self.ground) return id || 0;
        const c = hexToWorld(q, r), w = self.g.structs.toWorld(s, _b.set(c.x, y + 0.5, c.z), _b), h = worldToHex(w.x, w.z);
        return self.g.world.getBlock(h.q, h.r, Math.floor(w.y));
      },
      inVoid: () => true,
      findSpawn: (...a) => self.g.world.findSpawn(...a),
    };
  }

  get on() { return !!this.s; }

  // Le générateur le plus proche qui tient le joueur : [vaisseau, distance] (orbital.near.shipGrav :
  // les générateurs alimentés des vaisseaux proches, en coordonnées du vaisseau)
  holder(p) {
    const { orbital, structs } = this.g;
    let best = null, bd = Infinity;
    for (const [s, gx, gy, gz] of orbital.near?.shipGrav || []) {
      if (!structs.list.includes(s)) continue;
      const L = structs.toLocal(s, _a.set(p.pos.x, p.pos.y + 0.9, p.pos.z), _a);
      const d = Math.hypot(L.x - gx, L.y - gy, L.z - gz);
      if (d < bd) { bd = d; best = s; }
    }
    return best ? [best, bd] : null;
  }

  // À chaque image, avant le déplacement du joueur : entrer dans le repère d'un vaisseau, ou en sortir
  check(p) {
    if (p.riding || p.pilot) { if (this.s) this.leave(p); return; }
    const h = this.holder(p), fl = this.g.flight;
    const planet = !!fl?.on && fl.zone >= 0 && fl.gravityAt(p.pos.x, p.pos.z, p.pos.y) > 0.05;
    const upY = (s) => _b.set(0, 1, 0).applyQuaternion(s.quat).y;
    if (this.s) {
      if (!this.g.structs.list.includes(this.s) || !h || h[0] !== this.s || h[1] > OUT_R || (planet && upY(this.s) < PLANET_OUT)) this.leave(p);
      else return;
    }
    if (h && h[1] <= GRAV_R && !(planet && upY(h[0]) < PLANET_IN)) this.enter(p, h[0]);
  }

  enter(p, s) {
    const { structs } = this.g;
    structs.updateFrame(s);
    const qi = _q.copy(s.quat).invert();
    this.s = s;
    p.shipFrame = s;
    structs.toLocal(s, p.pos, this.L);
    // (la vitesse du joueur est déjà relative au vaisseau s'il y est attaché)
    _a.copy(p.vel);
    if (p.attached !== s) _a.sub(structs.velAt(s, _b.subVectors(p.pos, s.pos), _b));
    this.v.copy(_a).applyQuaternion(qi);
    // le regard, dans le repère du vaisseau
    const cp = Math.cos(p.pitch);
    _a.set(-Math.sin(p.yaw) * cp, Math.sin(p.pitch), -Math.cos(p.yaw) * cp).applyQuaternion(qi);
    p.pitch = Math.asin(Math.max(-1, Math.min(1, _a.y)));
    if (Math.abs(_a.y) < 0.999) p.yaw = Math.atan2(-_a.x, -_a.z);
    p.attached = s;
    p.fly = false;
  }

  leave(p) {
    const s = this.s, { structs } = this.g;
    this.s = null;
    p.shipFrame = null;
    if (!s) return;
    // le regard et la vitesse reviennent dans le monde (la vitesse : relative au vaisseau s'il nous porte encore)
    const cp = Math.cos(p.pitch);
    _a.set(-Math.sin(p.yaw) * cp, Math.sin(p.pitch), -Math.cos(p.yaw) * cp).applyQuaternion(s.quat);
    p.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, Math.asin(Math.max(-1, Math.min(1, _a.y)))));
    p.yaw = Math.atan2(-_a.x, -_a.z);
    if (structs.list.includes(s)) {
      p.vel.copy(this.v).applyQuaternion(s.quat).add(structs.velAt(s, _b.subVectors(p.pos, s.pos), _b));
    }
    p.attached = null;
    p.standingOn = null;
    p.model?.rotation.set(0, p.yaw, 0); // (le corps redevient droit)
  }

  // Le déplacement du joueur (au lieu de player.update) : dans le repère du vaisseau
  update(p, dt, input) {
    const s = this.s, { structs, flight, survival } = this.g;
    structs.updateFrame(s);
    structs.toLocal(s, p.pos, this.L);
    this.ground = flight ? flight.zone >= 0 : true;
    const wPos = p.pos, wVel = p.vel, wWorld = p.world, conv = p.conveyor;
    p.pos = this.L; p.vel = this.v; p.world = this.proxy; p.conveyor = null;
    const grav = p.gravity;
    p.gravity = 1;
    try { p.update(dt, input); } finally {
      p.gravity = grav;
      p.pos = wPos; p.vel = wVel; p.world = wWorld; p.conveyor = conv;
    }
    structs.toWorld(s, this.L, p.pos);
    // la vitesse du joueur, relative au vaisseau (il y est attaché : voir structs.worldVel)
    p.vel.copy(this.v).applyQuaternion(s.quat);
    p.attached = s;
    p.standingOn = p.onGround ? s : null;
    // (pas de chute comptée dans le monde : le vaisseau peut tourner sous nos pieds)
    const sv = survival?.();
    if (sv) sv.airTop = null;
    this.place(p);
  }

  // Le corps du joueur : debout sur le plancher du vaisseau
  place(p) {
    const s = this.s;
    if (!s || !p.model) return;
    p.model.position.copy(p.pos);
    p.model.quaternion.copy(s.quat).multiply(_q.setFromAxisAngle(_b.set(0, 1, 0), p.yaw));
  }

  // L'œil et la direction du regard, dans le monde
  look(p, eye, dir) {
    const s = this.s;
    const L = this.g.structs.toLocal(s, p.pos, _a);
    L.y += EYE - SNEAK_DROP * p.crouch;
    this.g.structs.toWorld(s, L, eye);
    const cp = Math.cos(p.pitch);
    dir.set(-Math.sin(p.yaw) * cp, Math.sin(p.pitch), -Math.cos(p.yaw) * cp).applyQuaternion(s.quat);
  }

  // L'orientation de la caméra : celle du vaisseau, puis le regard
  cameraQuat(p, out) {
    return out.copy(this.s.quat).multiply(_q.setFromEuler(_e.set(p.pitch, p.yaw, 0, 'YXZ')));
  }
}
