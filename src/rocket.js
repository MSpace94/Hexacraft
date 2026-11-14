// Fusées : un objet collé (voir structs.js) qui a des tuyères devient une fusée.
//
//  - Réacteur au nédrolytium : il ne marche que s'il touche un bloc de nédrolytium de la fusée
//    (le cœur qui convertit l'énergie du carburant en poussée, voir lore.js). Chaque réacteur
//    armé alimente jusqu'à NOZZLES_PER tuyères et donne le couple des petits propulseurs de
//    contrôle (pour tourner la fusée).
//  - Tuyères : elles poussent vers le haut de la fusée (leur flamme sort par-dessous), au point
//    où elles sont : des tuyères décentrées font tourner la fusée.
//  - Réacteur classique : une tuyère un peu meilleure (voir thrust dans blocks.js), alimentée de la
//    même façon, qui brûle autant.
//  - Moteurs du lot « liquides » (voir blocks.js) : le réacteur chimique marche seul (pas besoin
//    du nédrolytium), mais brûle plus ; le réacteur plasma et la tuyère stellaire poussent bien plus
//    fort, alimentés par le réacteur comme les tuyères ; le propulseur ionique ne brûle rien : il
//    lui faut du courant (une source de voltite contre lui, dans la fusée), et il ne pousse presque
//    que dans le vide (l'air le gêne), doucement. Ils donnent aussi les petits propulseurs de contrôle.
//  - Réservoirs de fusée : 8 000 mB de carburant primaire, 20 000 l'avancé (remplis par les tuyaux quand ils
//    sont posés dans le monde, ou au bidon). Le carburant pèse : une fusée pleine est plus lourde,
//    elle s'allège en brûlant.
//  - Poste de pilotage : clic droit pour s'y asseoir. Z / S : plus ou moins de gaz, X : couper,
//    flèches : pencher la fusée (vers où l'on regarde), Q / D : la faire tourner sur elle-même,
//    R : retour automatique à la verticale (dans l'espace, R / F tenus : le nez vers l'avant, vers
//    l'arrière de la trajectoire). Maj : se lever.
//  - Pilotage assisté (comme un vaisseau d'Elite) : les commandes montent et retombent en douceur
//    (la fusée se met à tourner, puis s'arrête de tourner, sans à-coup), chaque axe a sa vitesse
//    de rotation (pencher : posé ; tourner sur soi : vif), dans la limite du couple des propulseurs
//    de contrôle (une grosse fusée tourne plus lentement). G : l'assistance de vol.
//      * Active : lâcher les commandes arrête la rotation ; dans l'espace, les propulseurs latéraux
//        annulent aussi la dérive de côté (la fusée va là où pointe son nez).
//      * Coupée : la physique pure. La rotation continue tant qu'on ne la contre pas, la fusée
//        glisse sur sa lancée : on peut pivoter pour freiner, ou filer en tournant.
//  - Air : il freine la fusée, de moins en moins en montant. Au-dessus de SPACE_Y, en montant,
//    on quitte le ciel : c'est l'espace (voir spaceflight.js). La fusée reste la même, on y marche.
import * as THREE from 'three';
import { NEIGHBORS, hexToWorld } from './hex.js?v=1.1.5-alpha-mwgq2wrb';
import { BLOCKS, REACTOR, COCKPIT, NEDROLYTIUM, isSource } from './blocks.js?v=1.1.5-alpha-mwgq2wrb';
import { H } from './mesher.js?v=1.1.5-alpha-mwgq2wrb';

export const NOZZLE_F = 1.2e6;      // poussée d'une tuyère à plein gaz (N ; la gravité du jeu est 3 fois la vraie)
export const NOZZLES_PER = 4;       // tuyères alimentées par un réacteur
export const BURN = 30;             // mB de carburant par seconde et par tuyère, à plein gaz
export const FUEL_KG = 0.8;         // masse d'un mB de carburant (kg)
export const SPACE_Y = H + 300;     // au-delà (en montant) : l'espace
const RCS_TORQUE = 2.5e6;           // couple des propulseurs de contrôle, par réacteur (N·m)
const TILT_RATE = 0.75;             // pencher (tangage, lacet) : vitesse de rotation voulue (rad/s)
const ROLL_RATE = 1.3;              // tourner sur soi (roulis) : plus vif
const FA_OFF_ACC = 1.2;             // assistance coupée : accélération de rotation au plus (rad/s²)
const FA_OFF_MAX = 3;               // ... et rotation au plus (rad/s)
const AXIS_RAMP = 3.5;             // les commandes montent et retombent en ~0,3 s (en douceur)
const RCS_FORCE = 4e5;              // propulseurs latéraux (assistance de vol, dans l'espace), par réacteur (N)
const LEVEL_RATE = 1.2;             // retour à la verticale (rad/s par radian de pente)
const THROTTLE_RATE = 0.7;          // vitesse de la manette des gaz (par seconde)
const CD = 0.6;                     // coefficient de traînée
const AIR_RHO = 1.2 * (30 / 9.81);  // densité de l'air au niveau de la mer (comme structs.js)
const UP = new THREE.Vector3(0, 1, 0);
const key = (q, r, y) => q + ',' + r + ',' + y;
const AROUND = [[0, 0, 1], [0, 0, -1], ...NEIGHBORS.map(([q, r]) => [q, r, 0])];
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _m3 = new THREE.Matrix3();

// densité de l'air à l'altitude y (1 au niveau de la mer, rien dans l'espace)
export const airAt = (y, top = SPACE_Y) => (y >= top ? 0 : Math.exp(-(y - 64) / 120) * Math.min(1, (top - y) / 60));

export class Rockets {
  constructor(scene, structs) {
    this.scene = scene;
    this.structs = structs;
    this.flames = new Map();   // objet -> groupe des flammes
    this.flameMat = new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
    this.coreMat = new THREE.MeshBasicMaterial({ color: 0xfff0c0, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
    // (en saut nédrolytique : les moteurs passent en mode saut, des flammes violettes)
    this.jumpMat = new THREE.MeshBasicMaterial({ color: 0xa040ff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
    this.jumpCoreMat = new THREE.MeshBasicMaterial({ color: 0xf0d0ff, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
    this.infinite = false;     // règle du monde : carburant des fusées infini (voir /worldrule dans main.js)
    // flamme : un cône hexagonal ouvert, la pointe vers le bas (longueur 1, réglée par l'échelle)
    this.flameGeo = new THREE.ConeGeometry(0.34, 1, 6, 1, true).rotateX(Math.PI).translate(0, -0.5, 0);
    this.coreGeo = new THREE.ConeGeometry(0.18, 1, 6, 1, true).rotateX(Math.PI).translate(0, -0.5, 0);
    this.onSmoke = null;       // (position, vitesse) : fumée des tuyères (voir main.js)
    this.airTopAt = () => SPACE_Y; // (plafond de l'air en (x, z) : 0 sans air, voir spaceflight.js)
    this.inSpace = () => false;    // (objet dans le vide ?)
    structs.rocketScan = (s) => this.scan(s);
    structs.rocketForce = (s, h) => this.force(s, h);
  }

  // Ce qui fait la fusée (à chaque changement de blocs, voir structs.refresh)
  scan(s) {
    const get = (q, r, y) => s.blocks.get(key(q, r, y)) || 0;
    const R = { nozzles: [], self: [], reactors: 0, armed: 0, tanks: [], cockpits: [], cap: 0 };
    for (const [k, id] of s.blocks) {
      const [q, r, y] = k.split(',').map(Number), B = BLOCKS[id];
      // [q, r, y, poussée, consommation, ionique] ; les moteurs autonomes à part (voir plus bas)
      if (B?.thrust && B.selfFed) {
        // (propulseur ionique : seulement avec du courant contre lui)
        if (!B.ion || AROUND.some(([dq, dr, dy]) => isSource(get(q + dq, r + dr, y + dy)))) R.self.push([q, r, y, B.thrust, B.burn ?? 1, !!B.ion]);
        R.nozzles.push([q, r, y, B.thrust, B.burn ?? 1, !!B.ion, true]);
      } else if (B?.thrust) R.nozzles.push([q, r, y, B.thrust, B.burn ?? 1, false]);
      else if (BLOCKS[id]?.rocketTank) { R.tanks.push(k); R.cap += BLOCKS[id].cap; }
      else if (id === COCKPIT) R.cockpits.push(k);
      else if (id === REACTOR) {
        R.reactors++;
        if (AROUND.some(([dq, dr, dy]) => get(q + dq, r + dr, y + dy) === NEDROLYTIUM)) R.armed++;
      }
    }
    if (!R.nozzles.length && !R.cockpits.length) { s.rocket = null; this.dropFlames(s); return; }
    // tuyères alimentées : les plus proches de l'axe d'abord (une fusée symétrique reste droite)
    const c = s.com;
    R.nozzles.sort((a, b) => dist2(a, c) - dist2(b, c));
    R.active = [...R.nozzles.filter((n) => !n[6]).slice(0, R.armed * NOZZLES_PER), ...R.self];
    // (consommation : en tuyères ; propulseurs de contrôle : un par réacteur armé, un pour les
    // moteurs autonomes)
    R.burn = R.active.reduce((a, n) => a + n[4], 0);
    R.rcs = R.armed + (R.self.length ? 1 : 0);
    R.ion = R.active.length > 0 && R.active.every((n) => n[5]);
    // point de poussée (grille locale) : la moyenne des moteurs alimentés, selon ce que chacun pousse
    R.at = new THREE.Vector3();
    R.thrust = 0;
    for (const [q, r, y, f] of R.active) { const w = hexToWorld(q, r); R.at.x += w.x * f; R.at.y += y * f; R.at.z += w.z * f; R.thrust += f; }
    if (R.thrust) R.at.divideScalar(R.thrust);
    // (sans carburant : seuls les propulseurs ioniques poussent)
    R.ionAt = new THREE.Vector3();
    R.ionThrust = 0;
    for (const [q, r, y, f, , ion] of R.active) if (ion) { const w = hexToWorld(q, r); R.ionAt.x += w.x * f; R.ionAt.y += y * f; R.ionAt.z += w.z * f; R.ionThrust += f; }
    if (R.ionThrust) R.ionAt.divideScalar(R.ionThrust);
    s.rocket = R;
    this.updateMass(s);
    this.dropFlames(s);
  }

  // Carburant : dans les réglages des réservoirs (clé locale -> [mB])
  fuel(s) {
    if (this.infinite && s.rocket?.cap) return s.rocket.cap; // (carburant infini : toujours plein)
    let n = 0;
    for (const k of s.rocket?.tanks || []) n += s.params.get(k)?.[0] || 0;
    return n;
  }
  setFuel(s, total) {
    const R = s.rocket;
    if (!R?.cap) return;
    if (this.infinite) { this.updateMass(s); return; } // (carburant infini : rien ne se vide)
    total = Math.max(0, Math.min(R.cap, total));
    for (const k of R.tanks) s.params.set(k, [(total * BLOCKS[s.blocks.get(k)].cap) / R.cap]);
    this.updateMass(s);
  }
  // ajoute n mB au réservoir k (bidon) ; renvoie ce qui a pu entrer
  fill(s, k, n) {
    const cur = s.params.get(k)?.[0] || 0, room = (BLOCKS[s.blocks.get(k)]?.cap || 0) - cur, add = Math.max(0, Math.min(room, n));
    if (add > 0) { s.params.set(k, [cur + add]); this.updateMass(s); }
    return add;
  }
  updateMass(s) {
    if (!s.dryMass) return;
    s.mass = s.dryMass + this.fuel(s) * FUEL_KG;
    s.invMass = 1 / s.mass;
  }

  // Pendant un pas de physique (voir structs.step) : poussée, carburant, pilotage, air
  force(s, h) {
    const R = s.rocket, st = this.structs;
    const fuel = this.fuel(s);
    // (plus de carburant : les propulseurs ioniques seuls, s'il y en a)
    const ionOnly = fuel <= 0 || R.ion, push = ionOnly ? R.ionThrust : R.thrust;
    // (en saut, les moteurs servent au saut : ils ne poussent pas, ne brûlent rien de plus, et
    // leurs flammes sont violettes : firing = 2, voir update)
    if (s.warp) s.throttle = 0;
    const thr = !s.warp && R.active.length && push > 0 ? Math.max(0, Math.min(1, s.throttle || 0)) : 0;
    s.firing = s.warp ? 2 : thr;
    const up = _a.copy(UP).applyQuaternion(s.quat);
    if (thr > 0) {
      // (l'ionique pousse dans le vide : l'air l'étouffe)
      const air = airAt(s.pos.y, this.airTopAt(s.pos.x, s.pos.z));
      const ionF = R.ionThrust * Math.max(0.05, 1 - air), F = NOZZLE_F * (ionOnly ? ionF : R.thrust - R.ionThrust + ionF) * thr * (1 + 0.5 * Math.min(2, s.accent || 0)); // (accentueur inertiel : voir structs.js)
      const at = st.toWorld(s, ionOnly ? R.ionAt : R.at, _b), r = at.sub(s.pos);
      st.impulse(s, _c.copy(up).multiplyScalar(F * h), r);
      if (!ionOnly) this.setFuel(s, fuel - BURN * R.burn * thr * h);
    }
    // propulseurs de contrôle (fusée pilotée, réacteur armé) : la rotation voulue, ou tenir le cap
    const C = s.ctl;
    if (C?.active && R.rcs) {
      const want = _b.set(0, 0, 0);
      if (C.tilt) want.add(C.tilt);
      if (C.roll) want.addScaledVector(up, C.roll * TILT_RATE);
      if (C.aim) {
        // (dans l'espace : le nez vers ce point)
        const ax = _c.crossVectors(up, C.aim), n = ax.length();
        if (n > 1e-5) want.addScaledVector(ax.divideScalar(n), LEVEL_RATE * Math.atan2(n, up.dot(C.aim)));
        else if (up.dot(C.aim) < 0) want.addScaledVector(_c.set(1, 0, 0).applyQuaternion(s.quat), LEVEL_RATE);
      }
      if (C.level) {
        const tilt = Math.acos(Math.max(-1, Math.min(1, up.y)));
        const ax = _c.crossVectors(up, UP);
        if (ax.lengthSq() > 1e-10) want.addScaledVector(ax.normalize(), LEVEL_RATE * tilt);
      }
      const max = R.rcs * RCS_TORQUE * h * (1 + 0.5 * Math.min(2, s.accent || 0));
      if (C.fa || C.aim || C.level) {
        // assistance de vol : la rotation rejoint celle voulue (rien de tenu : elle s'arrête)
        const dw = want.sub(s.ang);
        const L = _c.copy(dw).applyMatrix3(_m3.copy(s.Iw).invert()), l = L.length();
        if (l > max) dw.multiplyScalar(max / l);
        s.ang.add(dw);
      } else if (want.lengthSq() > 1e-8) {
        // coupée : les propulseurs poussent dans le sens voulu, et c'est tout (la rotation dure)
        const k = Math.min(1, want.length() / TILT_RATE);
        // (une petite fusée a des propulseurs bien plus forts que son inertie : l'accélération
        // de rotation est bornée, pour qu'on puisse la doser)
        const dw = _c.copy(want).normalize().multiplyScalar(max * k).applyMatrix3(s.Iw), cap = FA_OFF_ACC * k * h;
        if (dw.length() > cap) dw.setLength(cap);
        s.ang.add(dw);
        if (s.ang.length() > FA_OFF_MAX) s.ang.setLength(FA_OFF_MAX);
      }
      // dans l'espace, assistance active : la dérive de côté est annulée (le nez donne la route)
      if (C.drift) {
        const side = _c.copy(s.vel).addScaledVector(up, -s.vel.dot(up)), l = side.length();
        const dv = Math.min(l, (R.rcs * RCS_FORCE * h) / s.mass);
        if (l > 1e-6) s.vel.addScaledVector(side, -dv / l);
      }
    }
    // air : il freine, et amortit les rotations (ailettes, carénage)
    const rho = AIR_RHO * airAt(s.pos.y, this.airTopAt(s.pos.x, s.pos.z));
    if (rho > 0) {
      const v = s.vel.length(), A = Math.pow(s.list.length, 2 / 3) * 0.866;
      if (v > 0.01) s.vel.multiplyScalar(1 / (1 + (0.5 * rho * CD * A * v * h) / s.mass));
      s.ang.multiplyScalar(1 / (1 + rho * 0.05 * h));
    }
  }

  // ---------- Pilote ----------
  // Commandes du joueur (à chaque image) : input { up, down, cut, left, right, tiltF, tiltB,
  // tiltL, tiltR, level } ; yaw : où il regarde (pencher vers l'avant = vers là)
  // (dans l'espace : on penche vers où l'on regarde vraiment, le haut et le bas compris)
  control(s, input, yaw, dt, pitch = 0) {
    if (!s.rocket) return;
    // (en saut, les gaz sont bloqués : les moteurs sont déjà au saut)
    if (s.warp) s.throttle = 0;
    else {
      s.throttle = Math.max(0, Math.min(1, (s.throttle || 0) + ((input.up ? 1 : 0) - (input.down ? 1 : 0)) * THROTTLE_RATE * dt));
      if (input.cut) s.throttle = 0;
    }
    const space = this.inSpace(s);
    if (input.toggleLevel && !space) s.level = !s.level;
    const up = _a.copy(UP).applyQuaternion(s.quat);
    const cp = space ? Math.cos(pitch) : 1;
    const f = new THREE.Vector3(-Math.sin(yaw) * cp, space ? Math.sin(pitch) : 0, -Math.cos(yaw) * cp), rt = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    const tilt = new THREE.Vector3();
    if (input.toggleFA) s.fa = s.fa === false;
    const fa = s.fa !== false;
    // (les commandes : elles montent vers la touche tenue, et retombent, en douceur)
    const A = (s.axes ||= { f: 0, s: 0, r: 0 }), ease = (v, t) => v + Math.max(-AXIS_RAMP * dt, Math.min(AXIS_RAMP * dt, t - v));
    A.f = ease(A.f, (input.tiltF ? 1 : 0) - (input.tiltB ? 1 : 0));
    A.s = ease(A.s, (input.tiltR ? 1 : 0) - (input.tiltL ? 1 : 0));
    A.r = ease(A.r, (input.left ? 1 : 0) - (input.right ? 1 : 0));
    const fwd = A.f, side = A.s;
    // (l'avant et la droite du pilote, pris où il regarde, mais gardés dans le repère de la fusée
    // pendant une manœuvre : contrer une rotation pousse toujours exactement à l'opposé, même
    // fusée renversée ; repris quand rien ne bouge)
    const idle = !input.tiltF && !input.tiltB && !input.tiltL && !input.tiltR && !fwd && !side && s.ang.lengthSq() < 0.0025;
    if (!s.refF || idle) {
      const qi = new THREE.Quaternion().copy(s.quat).invert();
      s.refF = f.clone().applyQuaternion(qi);
      s.refR = rt.clone().applyQuaternion(qi);
    } else {
      f.copy(s.refF).applyQuaternion(s.quat);
      rt.copy(s.refR).applyQuaternion(s.quat);
    }
    // pencher vers f : tourner autour de up × f
    const axis = new THREE.Vector3();
    if (fwd && axis.crossVectors(up, f).lengthSq() > 1e-4) tilt.addScaledVector(axis.normalize(), fwd * TILT_RATE);
    if (side && axis.crossVectors(up, rt).lengthSq() > 1e-4) tilt.addScaledVector(axis.normalize(), side * TILT_RATE);
    const held = input.tiltF || input.tiltB || input.tiltL || input.tiltR;
    s.ctl = {
      active: true, tilt, roll: A.r * (ROLL_RATE / TILT_RATE), fa,
      level: !!s.level && !space && !held, aim: input.aim || null, drift: fa && space,
    };
    if (s.throttle > 0 || fwd || side || A.r || input.aim || (space && fa && s.vel.lengthSq() > 0.01)) this.structs.wake(s);
  }
  // (personne aux commandes : les gaz se coupent, on peut marcher dans la fusée)
  release(s) { if (s) { s.ctl = null; s.throttle = 0; s.firing = 0; } }

  // Où s'asseoir : sur le poste de pilotage k (pieds sur son dessus), dans le monde
  seat(s, k, out) {
    const [q, r, y] = k.split(',').map(Number), c = hexToWorld(q, r);
    return this.structs.toWorld(s, _a.set(c.x, y + 1, c.z), out);
  }

  // Ce qu'affiche le tableau de bord
  hud(s) {
    const R = s.rocket;
    if (!R) return null;
    const fuel = this.fuel(s), g = 30 * (this.structs.gravityOf ? this.structs.gravityOf(s) : this.structs.gravity);
    const twr = g > 0 ? (NOZZLE_F * R.thrust) / (s.mass * g) : Infinity;
    return {
      fuel, cap: R.cap, throttle: s.throttle || 0, twr, alt: s.pos.y, v: s.vel.length(), vy: s.vel.y,
      warp: !!s.warp, armed: R.armed, reactors: R.reactors, nozzles: R.nozzles.length, active: R.active.length, level: !!s.level, fa: s.fa !== false,
      tilt: Math.acos(Math.max(-1, Math.min(1, _a.copy(UP).applyQuaternion(s.quat).y))),
    };
  }

  // ---------- À chaque image : flammes, fumée ----------
  update(dt) {
    for (const s of this.structs.list) {
      if (!s.rocket) continue;
      // (firing : 0 à 1 les gaz ; 2 : mode saut, des flammes violettes pleines)
      const jump = (s.firing || 0) > 1.5, fire = jump ? 1 : s.firing || 0;
      let g = this.flames.get(s);
      if (fire > 0 && !g) g = this.makeFlames(s);
      if (!g) continue;
      g.visible = fire > 0;
      if (!fire) continue;
      if (g.userData.jump !== jump) {
        g.userData.jump = jump;
        for (const m of g.children) m.material = m.userData.core ? (jump ? this.jumpCoreMat : this.coreMat) : jump ? this.jumpMat : this.flameMat;
      }
      g.position.copy(s.group.position);
      g.quaternion.copy(s.group.quaternion);
      const len = 1.2 + fire * 4.5;
      for (const m of g.children) {
        const k = m.userData.core ? 0.6 : 1;
        m.scale.set(0.8 + fire * 0.4, len * k * (0.85 + Math.random() * 0.3), 0.8 + fire * 0.4);
      }
      // fumée : derrière les tuyères (plus il y a d'air, plus il y en a)
      if (this.onSmoke && !jump && Math.random() < dt * 30 * fire) {
        const n = s.rocket.active[Math.floor(Math.random() * s.rocket.active.length)];
        const w = hexToWorld(n[0], n[1]);
        const p = this.structs.toWorld(s, new THREE.Vector3(w.x, n[2] - len * 0.8, w.z), new THREE.Vector3());
        const down = new THREE.Vector3(0, -1, 0).applyQuaternion(s.quat).multiplyScalar(8 + Math.random() * 6).add(s.vel);
        this.onSmoke(p, down, airAt(p.y, this.airTopAt(p.x, p.z)));
      }
    }
  }

  // (l'objet vient d'être déplacé, après le placement des flammes de cette image : elles suivent tout de suite)
  placeFlames(s) {
    const g = this.flames.get(s);
    if (g) { g.position.copy(s.group.position); g.quaternion.copy(s.group.quaternion); }
  }

  makeFlames(s) {
    const g = new THREE.Group();
    for (const [q, r, y] of s.rocket.active) {
      const w = hexToWorld(q, r);
      const outer = new THREE.Mesh(this.flameGeo, this.flameMat), core = new THREE.Mesh(this.coreGeo, this.coreMat);
      core.userData.core = true;
      outer.position.set(w.x, y, w.z); core.position.set(w.x, y, w.z);
      g.add(outer, core);
    }
    this.scene.add(g);
    this.flames.set(s, g);
    return g;
  }
  dropFlames(s) {
    const g = this.flames.get(s);
    if (g) { this.scene.remove(g); this.flames.delete(s); }
  }
  // (objets supprimés : leurs flammes aussi)
  prune() {
    for (const s of [...this.flames.keys()]) if (!this.structs.list.includes(s)) this.dropFlames(s);
  }
}

function dist2([q, r, y], c) {
  const w = hexToWorld(q, r);
  return (w.x - c.x) ** 2 + (w.z - c.z) ** 2 + 0.01 * (y - c.y) ** 2;
}
