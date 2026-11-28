// La vie des autres mondes, autour du joueur (voir main.js ; l'option « Vie extraterrestre ») :
//  - dans les géantes gazeuses, entre ~0,3 et ~20 bars : des flotteurs, de grands sacs de gaz plus
//    chaud et plus léger que l'air autour (des montgolfières vivantes, comme l'imaginaient Sagan et
//    Salpeter pour Jupiter), chacun à l'altitude où il flotte, emportés par les vents ; et des
//    chasseurs, petits et rapides, qui les broutent (une chaîne alimentaire) ;
//  - dans les eaux profondes des autres planètes, là où la lumière n'arrive plus : des bancs de
//    poissons-lanternes (bioluminescents : leur propre lumière), et des baudroies et leur leurre ;
// Tout est instancié (une poignée d'appels de dessin) et recyclé autour du joueur. (Comme les animaux :
// les maillages sont posés sur ORIGIN, leurs instances comptées depuis lui, voir origin.js.)
import * as THREE from 'three';
import { isGiant, GH_UP, GH_POLY } from './atmo.js?v=1.1.0-mx09tneh';
import { isWater } from './blocks.js?v=1.1.0-mx09tneh';
import { worldToHex } from './hex.js?v=1.1.0-mx09tneh';
import { ORIGIN } from './origin.js?v=1.1.0-mx09tneh';

const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _v = new THREE.Vector3(), _w = new THREE.Vector3(), _c = new THREE.Color();
const UP = new THREE.Vector3(0, 1, 0);

// L'altitude (au-dessus du niveau de 1 bar) où règne la pression P dans une géante (voir atmo.airOfBody)
export function altOfP(b, P) {
  const P1 = (b.atmo?.density || 3) / 3;
  return P <= P1 ? -GH_UP * Math.log(P / P1) : -GH_POLY * ((P / P1) ** (1 / 3.5) - 1);
}
export class XenoLife {
  // g : { scene, player, flight, world, sky, environ, discover(key, e), opt(), playing() }
  constructor(g) {
    this.g = g;
    this.mode = null; this.body = null; this.level = -1;
    const lambert = (o) => new THREE.MeshLambertMaterial(o);
    // flotteurs : une enveloppe (une sphère aplatie, translucide) et ses filaments
    const env = new THREE.SphereGeometry(1, 14, 9); env.scale(1, 0.72, 1);
    const fil = new THREE.CylinderGeometry(0.04, 0.01, 1, 4); fil.translate(0, -0.5, 0);
    this.floatM = new THREE.InstancedMesh(env, lambert({ color: 0xffffff, transparent: true, opacity: 0.62, emissive: 0x402010, depthWrite: false }), 40);
    this.filM = new THREE.InstancedMesh(fil, lambert({ color: 0xffffff, emissive: 0x301808 }), 40 * 6);
    // chasseurs : un fuseau
    const dart = new THREE.ConeGeometry(0.35, 2.2, 5); dart.rotateX(-Math.PI / 2);
    this.huntM = new THREE.InstancedMesh(dart, lambert({ color: 0x3a2a40, emissive: 0x200818 }), 12);
    // poissons-lanternes (ils luisent) et baudroies (un corps sombre, un leurre lumineux)
    const fish = new THREE.ConeGeometry(0.12, 0.55, 4); fish.rotateX(-Math.PI / 2);
    this.fishM = new THREE.InstancedMesh(fish, new THREE.MeshBasicMaterial({ color: 0xffffff }), 96);
    const angler = new THREE.SphereGeometry(0.6, 8, 6); angler.scale(1, 0.8, 1.3);
    this.angM = new THREE.InstancedMesh(angler, lambert({ color: 0x14161c }), 4);
    this.lureM = new THREE.InstancedMesh(new THREE.SphereGeometry(0.12, 6, 4), new THREE.MeshBasicMaterial({ color: 0x9affe0 }), 4);
    this.meshes = [this.floatM, this.filM, this.huntM, this.fishM, this.angM, this.lureM];
    for (const m of this.meshes) { m.count = 0; m.frustumCulled = false; m.visible = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); g.scene.add(m); }
    this.floaters = []; this.hunters = []; this.fish = []; this.anglers = [];
    this.seen = new Set(); this.clock = 0; this.t = 0;
  }
  clear() {
    this.floaters.length = this.hunters.length = this.fish.length = this.anglers.length = 0;
    for (const m of this.meshes) { m.count = 0; m.visible = false; }
  }
  // (une découverte pour le carnet : une fois par session suffit à ne pas le redemander)
  found(key, e) { if (this.seen.has(key)) return; this.seen.add(key); this.g.discover(key, e); }

  update(dt) {
    const g = this.g, A = g.environ._air, lvl = g.opt();
    this.t += dt;
    if (lvl !== this.level) { this.level = lvl; this.clear(); this.mode = null; }
    if (!lvl || !g.flight.on || !g.playing()) { if (this.mode) { this.clear(); this.mode = null; } return; }
    // où sommes-nous ? (revu 4 fois par seconde, comme l'air : voir environ.js)
    if ((this.clock -= dt) <= 0) {
      this.clock = 0.25;
      const b = A.body, P = A.P || 0;
      let mode = null;
      if (b && A.giant && P > 0.3 && P < 25) mode = 'giant';
      else if (b && b.kind !== 'home' && !A.giant && g.player.inWater && this.depth() >= 10) mode = 'abyss';
      if (mode !== this.mode || b !== this.body) { this.clear(); this.mode = mode; this.body = b; }
    }
    for (const m of this.meshes) m.position.copy(ORIGIN);
    if (this.mode === 'giant') this.giant(dt, A, lvl);
    else if (this.mode === 'abyss') this.abyss(dt, lvl);
  }
  // (les blocs d'eau au-dessus de la tête)
  depth() {
    const p = this.g.player.pos, h = worldToHex(p.x, p.z), y0 = Math.floor(p.y + 1.6);
    let n = 0;
    for (let y = y0; y < y0 + 40; y++) { if (isWater(this.g.world.getBlock(h.q, h.r, y))) n++; else break; }
    return n;
  }

  // ---------- Les géantes : flotteurs et chasseurs ----------
  giant(dt, A, lvl) {
    const b = this.body, P = this.g.player.pos, up = A.up, wind = _w.copy(A.vair);
    // (dans la bulle, l'air file à -B.v : on ne garde que les vents de la géante, au plus 200 blocs/s)
    if (wind.length() > 200) wind.setLength(200);
    const NF = lvl >= 2 ? 34 : 12, NH = lvl >= 2 ? 10 : 3, seed = hash(b.id);
    const spawn = (f, far) => {
      // (de préférence au vent du joueur : ils dérivent vers lui)
      const a = Math.random() * Math.PI * 2, d = far ? 260 + Math.random() * 200 : 40 + Math.random() * 380;
      const side = _v.set(Math.cos(a), 0, Math.sin(a));
      side.addScaledVector(up, -side.dot(up)).normalize();
      if (far && wind.lengthSq() > 1) side.lerp(_s.copy(wind).addScaledVector(up, -wind.dot(up)).normalize().negate(), 0.6).normalize();
      f.P = 0.5 * Math.exp(Math.random() * Math.log(16)); // (il flotte entre 0,5 et 8 bars)
      f.pos.copy(P).addScaledVector(side, d).addScaledVector(up, altOfP(b, f.P) - A.alt + (Math.random() - 0.5) * 20);
      f.vel.set(0, 0, 0); f.size = 5 + Math.random() * 8; f.food = 1; f.ph = Math.random() * 6;
    };
    while (this.floaters.length < NF) { const f = { pos: new THREE.Vector3(), vel: new THREE.Vector3() }; spawn(f, false); this.floaters.push(f); }
    while (this.hunters.length < NH) { const h = { pos: new THREE.Vector3(), vel: new THREE.Vector3(), fedT: 0, prey: null }; h.pos.copy(P).add(_v.set(Math.random() - 0.5, 0, Math.random() - 0.5).multiplyScalar(300)); this.hunters.push(h); }
    const col = new THREE.Color().setHSL(((seed % 360) / 360), 0.35, 0.62), col2 = new THREE.Color().setHSL((((seed >> 9) % 360) / 360), 0.5, 0.45);
    let i = 0, k = 0, near = Infinity;
    for (const f of this.floaters) {
      // (sa flottabilité : il monte s'il est plus bas que son altitude d'équilibre, descend sinon ; amorti)
      const alt = A.alt + _v.copy(f.pos).sub(P).dot(up), err = altOfP(b, f.P) - alt;
      f.vel.addScaledVector(up, (err * 0.02 - f.vel.dot(up) * 0.5) * dt);
      // (le vent l'emporte : il prend la vitesse de l'air peu à peu)
      const vh = _s.copy(wind).addScaledVector(up, -wind.dot(up));
      f.vel.lerp(_v.copy(vh).addScaledVector(up, f.vel.dot(up)), Math.min(1, dt * 0.3));
      f.pos.addScaledVector(f.vel, dt);
      f.food = Math.min(1, f.food + dt / 120); // (il se refait en ~2 min)
      const d = f.pos.distanceTo(P);
      if (d > 520) spawn(f, true);
      near = Math.min(near, d - f.size);
      const s = f.size * (0.6 + 0.4 * f.food) * (1 + 0.04 * Math.sin(this.t * 1.3 + f.ph)); // (il respire)
      _q.setFromUnitVectors(UP, up);
      this.floatM.setMatrixAt(i, _m.compose(_p.copy(f.pos).sub(ORIGIN), _q, _s.set(s, s, s)));
      this.floatM.setColorAt(i, _c.copy(col).lerp(col2, (f.P - 0.5) / 8));
      for (let j = 0; j < 6; j++) {
        const a = (j / 6) * Math.PI * 2 + f.ph, r = s * 0.45, L = s * (1.2 + 0.4 * Math.sin(this.t * 0.8 + j + f.ph));
        _p.set(Math.cos(a) * r, -s * 0.55, Math.sin(a) * r).applyQuaternion(_q).add(f.pos).sub(ORIGIN);
        this.filM.setMatrixAt(k, _m.compose(_p, _q, _s.set(1.5, L, 1.5)));
        this.filM.setColorAt(k++, col2);
      }
      i++;
    }
    this.floatM.count = i; this.filM.count = k;
    let nh = 0;
    for (const h of this.hunters) {
      // un chasseur : il fonce sur le flotteur le plus proche, le broute, puis repart rassasié
      if (!h.prey || h.prey.food < 0.3 || !this.floaters.includes(h.prey)) {
        h.prey = null;
        if (h.fedT <= 0) { let bd = 400; for (const f of this.floaters) { const d = f.pos.distanceTo(h.pos); if (d < bd && f.food > 0.5) { bd = d; h.prey = f; } } }
      }
      h.fedT -= dt;
      const goal = h.prey ? h.prey.pos : _v.copy(P).addScaledVector(up, Math.sin(this.t * 0.1 + nh) * 40);
      const dir = _s.copy(goal).sub(h.pos), dl = dir.length();
      h.vel.lerp(dir.multiplyScalar(Math.min(1, 1 / (dl || 1)) * (h.prey ? 38 : 14)).add(wind), Math.min(1, dt * 1.2));
      h.pos.addScaledVector(h.vel, dt);
      if (h.prey && dl < h.prey.size * 0.7 + 2) {
        h.prey.food -= 0.4; h.prey = null; h.fedT = 25;
        if (h.pos.distanceTo(P) < 120) this.found('ecologie:' + b.id + ':chasse', { k: 'eco', n: 'Les chasseurs ' + de(b.name) + ' broutent les flotteurs', b: b.id, h: 'chaîne alimentaire', t: "Les flotteurs vivent des molécules organiques de l'air ; les chasseurs vivent des flotteurs." });
      }
      if (h.pos.distanceTo(P) > 600) h.pos.copy(P).add(_v.set(Math.random() - 0.5, 0, Math.random() - 0.5).multiplyScalar(500));
      if (h.vel.lengthSq() > 0.01) _q.setFromUnitVectors(_v.set(0, 0, 1), _s.copy(h.vel).normalize());
      this.huntM.setMatrixAt(nh++, _m.compose(_p.copy(h.pos).sub(ORIGIN), _q, _s.set(1.4, 1.4, 1.4)));
    }
    this.huntM.count = nh;
    for (const m of [this.floatM, this.filM, this.huntM]) { m.visible = m.count > 0; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
    if (near < 60) this.found('faune:' + b.id + ':flotteur', { k: 'faune', n: 'Flotteur ' + de(b.name), b: b.id, h: 'géante gazeuse, entre 0,5 et 8 bars', t: "Un sac de gaz chaud, plus léger que l'hydrogène froid autour : il flotte à l'altitude où son poids égale la poussée d'Archimède, et dérive avec les vents." });
    if (this.hunters.some((h) => h.pos.distanceTo(P) < 50)) this.found('faune:' + b.id + ':chasseur', { k: 'faune', n: 'Chasseur ' + de(b.name), b: b.id, h: 'géante gazeuse', t: 'Petit, dense, rapide : il nage dans l\'air épais en battant des ailes, et broute les flotteurs.' });
  }

  // ---------- Les abysses : poissons-lanternes et baudroies ----------
  abyss(dt, lvl) {
    const { player, world } = this.g, P = player.pos, b = this.body, NS = lvl >= 2 ? 4 : 2, NF = lvl >= 2 ? 16 : 10;
    const wet = (x, y, z) => { const h = worldToHex(x, z); return isWater(world.getBlock(h.q, h.r, Math.floor(y))); };
    if (!this.fish.length) {
      for (let s = 0; s < NS; s++) {
        const c = new THREE.Vector3(P.x + (Math.random() - 0.5) * 30, P.y + (Math.random() - 0.5) * 8, P.z + (Math.random() - 0.5) * 30);
        const school = { c, goal: c.clone(), col: new THREE.Color().setHSL(0.45 + Math.random() * 0.25, 0.9, 0.6), list: [] };
        for (let i = 0; i < NF; i++) school.list.push({ pos: c.clone().add(_v.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(4)), vel: new THREE.Vector3((Math.random() - 0.5) * 2, 0, (Math.random() - 0.5) * 2), ph: Math.random() * 6 });
        this.fish.push(school);
      }
      for (let a = 0; a < (lvl >= 2 ? 2 : 1); a++) this.anglers.push({ pos: new THREE.Vector3(P.x + (Math.random() - 0.5) * 24, P.y - 3 - Math.random() * 4, P.z + (Math.random() - 0.5) * 24), yaw: Math.random() * 6 });
    }
    let n = 0, near = Infinity;
    for (const S of this.fish) {
      // (le banc : il va d'un point d'eau à un autre ; chacun suit le banc, sans heurter les voisins)
      if (S.c.distanceTo(S.goal) < 3 || Math.random() < dt * 0.05) {
        const t = _v.set(S.c.x + (Math.random() - 0.5) * 30, S.c.y + (Math.random() - 0.5) * 8, S.c.z + (Math.random() - 0.5) * 30);
        if (wet(t.x, t.y, t.z) && t.distanceTo(P) < 40) S.goal.copy(t); else S.goal.copy(P).add(_s.set((Math.random() - 0.5) * 16, -2, (Math.random() - 0.5) * 16));
      }
      S.c.lerp(S.goal, Math.min(1, dt * 0.25));
      for (const f of S.list) {
        const to = _s.copy(S.c).sub(f.pos);
        f.vel.addScaledVector(to, dt * 1.5).addScaledVector(_v.set(Math.sin(this.t * 2 + f.ph), 0, Math.cos(this.t * 1.7 + f.ph)), dt * 2);
        if (f.vel.length() > 3.5) f.vel.setLength(3.5);
        _p.copy(f.pos).addScaledVector(f.vel, dt);
        if (wet(_p.x, _p.y, _p.z)) f.pos.copy(_p); else f.vel.multiplyScalar(-0.5);
        near = Math.min(near, f.pos.distanceTo(P));
        _q.setFromUnitVectors(_v.set(0, 0, 1), _w.copy(f.vel).normalize());
        this.fishM.setMatrixAt(n, _m.compose(_p.copy(f.pos).sub(ORIGIN), _q, _s.set(1, 1, 1)));
        // (leur lumière clignote : elles se parlent ainsi dans le noir)
        this.fishM.setColorAt(n++, _c.copy(S.col).multiplyScalar(0.6 + 0.4 * Math.sin(this.t * 3 + f.ph)));
      }
    }
    this.fishM.count = n;
    let na = 0;
    for (const A of this.anglers) {
      A.yaw += dt * 0.15;
      _q.setFromAxisAngle(UP, A.yaw);
      this.angM.setMatrixAt(na, _m.compose(_w.copy(A.pos).sub(ORIGIN), _q, _s.set(1, 1, 1)));
      _p.set(0, 0.9 + 0.08 * Math.sin(this.t * 2), 0.9).applyQuaternion(_q).add(A.pos).sub(ORIGIN);
      this.lureM.setMatrixAt(na++, _m.compose(_p, _q, _s.set(1, 1, 1)));
      if (A.pos.distanceTo(P) < 10) this.found('faune:' + b.id + ':baudroie', { k: 'faune', n: 'Baudroie ' + de(b.name), b: b.id, h: 'les abysses', t: "Immobile dans le noir, elle agite un leurre lumineux (des bactéries qui luisent) : les poissons qui s'en approchent finissent dans sa gueule." });
    }
    this.angM.count = this.lureM.count = na;
    for (const m of [this.fishM, this.angM, this.lureM]) { m.visible = m.count > 0; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
    if (near < 8) this.found('faune:' + b.id + ':lanterne', { k: 'faune', n: 'Poissons-lanternes ' + de(b.name), b: b.id, h: 'les abysses (plus de 10 blocs d\'eau)', t: 'La lumière du jour ne descend pas si bas : ils font la leur (la bioluminescence), pour se trouver et tromper leurs prédateurs.' });
  }

}
const de = (n) => (/^[aeiouyhéèêàâîôûAEIOUYHÉÈÊ]/.test(n) ? "d'" : 'de ') + n;
