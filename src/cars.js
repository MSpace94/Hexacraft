// Voitures : un objet collé posé sur des roues (voir blocks.js : WHEEL, CAR_SEAT, ROUTE_PILOT).
//  - Une roue roule vers l'avant de la voiture (frottement presque nul) et tient sur le côté
//    (frottement du caoutchouc) : la voiture va droit, et tourne quand les roues de devant
//    braquent (on n'invente pas de couple : ce sont les roues qui la font tourner).
//  - L'avant : celui du volant (le siège du conducteur), sinon celui du pilote de route. Sans l'un
//    ni l'autre, les roues roulent dans tous les sens (un chariot à roulettes qu'on pousse).
//  - Alimentées en voltite, les roues sont motrices : elles tirent la voiture jusqu'à leur vitesse,
//    dans la limite de leur adhérence. Levier analogique : la vitesse suit son cran. (une roue est
//    ronde : rien ne se pose dessus ; un levier posé sur la caisse, juste au-dessus d'une roue,
//    l'alimente à travers le bloc qui est entre eux)
//  - Au volant : Z / S accélérer, freiner puis reculer, Q / D tourner, Espace freiner. Personne au
//    volant : frein à main. Pilote de route : il conduit d'étape en étape (comme le gravitron).
//  - Une roue qui bute sur une marche d'un bloc la monte (le bord de la marche la pousse vers le
//    haut, comme une vraie roue qui roule sur une bordure).
import * as THREE from 'three';
import { NEIGHBORS, hexToWorld, worldToHex } from './hex.js?v=1.1.5-alpha-mwgq2wrb';
import { BLOCKS, SOLID, isWheel, isCarSeat, isRoutePilot, isWater } from './blocks.js?v=1.1.5-alpha-mwgq2wrb';

export const CAR_VMAX = 24;       // vitesse des roues à pleine puissance (blocs/s)
export const CAR_ACC = 7;         // accélération (blocs/s²) : de 0 à 24 en 3,5 s
export const CAR_BRAKE = 18;      // freinage (blocs/s²)
export const ROLL_MU = 0.025;     // résistance au roulement (roue libre)
export const CASTER_MU = 0.05;    // roues sans avant (roulettes) : frottement dans tous les sens
const STEER_MAX = 0.55;           // braquage des roues avant à l'arrêt (rad) ; moins en roulant vite
const STEER_FALL = 18;            // vitesse (blocs/s) où le braquage est divisé par deux
const STEER_RATE = 2.2;           // vitesse du volant (rad/s)
const REVERSE = 0.45;             // marche arrière : cette part de la vitesse
const AUTO_DECEL = 5;             // pilote de route : il freine pour s'arrêter pile à l'étape
const ARRIVE = 2.5;               // pilote de route : étape atteinte à cette distance
// Le pilote de route regarde devant lui : des « antennes » (angles par rapport à l'avant de la
// voiture), relevées toutes les SCAN_DT secondes, jusqu'à LOOK_MIN + vitesse × LOOK_V blocs
const RAYS = [-1.2, -0.9, -0.6, -0.3, 0, 0.3, 0.6, 0.9, 1.2];
const SCAN_DT = 0.12, LOOK_MIN = 5, LOOK_V = 0.7, LOOK_MAX = 16;
const _f = new THREE.Vector3(), _g = new THREE.Vector3(), _j = new THREE.Vector3(), _v = new THREE.Vector3();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// La voiture d'un objet (refaite quand ses blocs ou son courant changent, voir structs.updateMotor),
// ou null s'il n'a pas de roue. level(q, r, y) : la puissance reçue (0..15)
export function scanCar(s, level, old = null) {
  let wheels = 0, lv = 0, seat = null, pilot = null, face = null;
  for (const [k, id] of s.blocks) {
    if (isWheel(id)) {
      wheels++;
      const [q, r, y] = k.split(',').map(Number), up = s.blocks.get(q + ',' + r + ',' + (y + 1));
      lv = Math.max(lv, level(q, r, y), up && SOLID[up] && !isWheel(up) ? level(q, r, y + 1) : 0);
    }
    else if (isCarSeat(id)) { if (seat === null) { seat = k; face = BLOCKS[id].facing; } }
    else if (isRoutePilot(id)) { if (pilot === null) { pilot = k; if (seat === null) face = BLOCKS[id].facing; } }
  }
  if (!wheels) return null;
  let fwdL = null;
  if (face !== null) {
    const [dq, dr] = NEIGHBORS[(face + 3) % 6], d = hexToWorld(dq, dr);
    fwdL = new THREE.Vector3(d.x, 0, d.z).normalize();
  }
  return { wheels, lv, seat, pilot, fwdL, fwdW: new THREE.Vector3(), steer: old?.steer || 0, Vw: 0, grip: false, v: 0, jnS: 0, jnN: 0, jnAvg: old?.jnAvg || 0 };
}

// Un pas de la voiture : vitesse voulue des roues (Vw), adhérence (grip : motrices ou freinées ;
// sinon elles roulent libres), braquage
export function carStep(s, h, gravCar, world = null) {
  const C = s.car;
  // (l'appui moyen d'une roue posée, au pas d'avant)
  C.jnAvg = C.jnN ? C.jnS / C.jnN : 0;
  C.jnS = C.jnN = 0;
  if (!C.fwdL) return;
  C.fwdW.copy(C.fwdL).applyQuaternion(s.quat);
  const v = (C.v = s.vel.dot(C.fwdW)), vmax = (CAR_VMAX * C.lv) / 15;
  let want = 0, grip = false, steer = 0;
  const D = s.drive;
  if (D?.active) {
    steer = D.steer;
    if (D.brake) grip = true;
    else if (D.thr > 0) { if (v < -0.5) grip = true; else if (C.lv) { want = vmax * D.thr; grip = true; } }
    else if (D.thr < 0) { if (v > 0.5) grip = true; else if (C.lv) { want = -vmax * REVERSE * -D.thr; grip = true; } }
  } else if (s.pilot?.mode === gravCar) {
    const a = autoDrive(s, C, vmax, h, world);
    want = a.want; steer = a.steer; grip = a.brake || C.lv > 0;
  } else if (C.seat !== null) grip = true; // (personne au volant : frein à main)
  C.grip = grip;
  // (on accélère doucement, on freine fort : les roues visent un peu plus vite, ou moins vite, à chaque pas)
  const dv = want - v, rate = want && Math.sign(dv) === Math.sign(want) ? CAR_ACC : CAR_BRAKE;
  C.Vw = grip ? v + clamp(dv, -rate * h, rate * h) : 0;
  // (on braque moins quand on roule vite : sinon, à pleine vitesse, la voiture part en toupie)
  const target = steer * (STEER_MAX / (1 + Math.abs(v) / STEER_FALL));
  C.steer += clamp(target - C.steer, -STEER_RATE * h, STEER_RATE * h);
}

// Le sol sous la voiture (le plus haut bloc plein sous son centre) : la hauteur de référence des antennes
function groundUnder(world, x, y, z) {
  const { q, r } = worldToHex(x, z);
  for (let yy = Math.floor(y); yy > y - 8; yy--) if (SOLID[world.getBlock(q, r, yy)]) return yy;
  return Math.floor(y) - 1;
}
// Une case de la route est-elle praticable ? Les roues montent une marche d'un bloc : un mur, c'est
// deux blocs ou plus ; un trou de plus de 3 blocs ou de l'eau, c'est aussi un obstacle
function blockedAt(world, x, z, g) {
  const { q, r } = worldToHex(x, z);
  if (SOLID[world.getBlock(q, r, g + 2)] || SOLID[world.getBlock(q, r, g + 3)]) return true;
  if (SOLID[world.getBlock(q, r, g + 1)] && SOLID[world.getBlock(q, r, g + 2)]) return true;
  const top = SOLID[world.getBlock(q, r, g + 1)] ? g + 1 : SOLID[world.getBlock(q, r, g)] ? g : SOLID[world.getBlock(q, r, g - 1)] ? g - 1 : SOLID[world.getBlock(q, r, g - 2)] ? g - 2 : null;
  if (top === null) return true;                                   // (un trou)
  if (isWater(world.getBlock(q, r, top + 1))) return true;         // (de l'eau)
  return false;
}
// Les antennes : la distance libre (blocs) dans chaque direction de RAYS
function scanAhead(s, C, world, fx, fz) {
  const g = groundUnder(world, s.pos.x, s.pos.y, s.pos.z);
  const L = Math.min(LOOK_MAX, LOOK_MIN + Math.abs(C.v) * LOOK_V), r0 = Math.max(1, s.radius * 0.5), end = s.radius + L;
  const out = [];
  for (const da of RAYS) {
    const c = Math.cos(da), sn = Math.sin(da);
    // (tourné de da vers la droite : même sens que l'écart err de autoDrive)
    const dx = fx * c + fz * sn, dz = fz * c - fx * sn;
    // (l'antenne a la largeur de la voiture : son axe, et ses deux bords)
    const w = Math.min(1.6, Math.max(0.8, s.radius * 0.55)), px = -dz * w, pz = dx * w;
    let free = end;
    for (let d = r0; d <= end; d += 1) {
      const x = s.pos.x + dx * d, z = s.pos.z + dz * d;
      if (blockedAt(world, x, z, g) || blockedAt(world, x + px, z + pz, g) || blockedAt(world, x - px, z - pz, g)) { free = d; break; }
    }
    out.push(Math.max(0, free - s.radius));
  }
  return { free: out, L };
}

// Pilote de route : vers l'étape (s.pilot.target), plus lentement dans les virages ; il s'arrête à
// l'étape (le parcours passe à la suivante, voir structs.followRoute). Il regarde devant lui
// (scanAhead) : un mur, un arbre, un trou ou de l'eau sur la route, il prend la direction libre la
// plus proche de son étape, et ralentit avant l'obstacle. Coincé quand même : il recule du côté le
// plus dégagé, puis repart
function autoDrive(s, C, vmax, h, world) {
  const P = s.pilot, a = s.auto, T = P.target;
  const dx = T.x - s.pos.x, dz = T.z - s.pos.z, D = Math.hypot(dx, dz);
  if (!C.lv || a.end || a.waitT > 0 || D < ARRIVE) return { want: 0, steer: 0, brake: true };
  const f = C.fwdW, fl = Math.hypot(f.x, f.z) || 1, fx = f.x / fl, fz = f.z / fl, hx = dx / D, hz = dz / D;
  const err = Math.atan2(hx * fz - hz * fx, hx * fx + hz * fz);
  // les antennes (pas à chaque pas : SCAN_DT)
  if (world && ((a.scanT = (a.scanT || 0) - h) <= 0 || !a.scan)) { a.scanT = SCAN_DT; a.scan = scanAhead(s, C, world, fx, fz); }
  const S = a.scan;
  if (a.rev > 0) { a.rev -= h; return { want: -vmax * REVERSE * 0.6, steer: a.revSteer ?? -Math.sign(err || 1), brake: false }; }
  let steerTo = err, ahead = Infinity;
  if (S) {
    // la direction voulue (l'étape), ramenée dans l'éventail des antennes
    const goal = clamp(err, RAYS[0], RAYS[RAYS.length - 1]);
    // (libre : jusqu'à l'étape, ou jusqu'au bout de l'antenne)
    const near = Math.max(1, Math.min(D - ARRIVE, S.L) - 0.5);
    const gi = RAYS.reduce((k, x, i) => (Math.abs(x - goal) < Math.abs(RAYS[k] - goal) ? i : k), 0);
    // la route vers l'étape est bouchée : on choisit un côté (le plus dégagé ; à égalité, celui de
    // l'étape) et l'on s'y tient tant qu'elle l'est (sinon il hésite devant un mur bien en face)
    if (S.free[gi] >= near) a.pick = 0;
    else if (!a.pick) {
      const L = S.free.slice(0, 4).reduce((x, y) => x + y, 0), R = S.free.slice(5).reduce((x, y) => x + y, 0);
      a.pick = Math.abs(L - R) > 2 ? (L > R ? -1 : 1) : Math.sign(err) || 1;
    }
    let best = -1, bestCost = Infinity;
    for (let i = 0; i < RAYS.length; i++) {
      const fr = S.free[i], ok = fr >= near;
      // (libre : le plus près de l'étape, du côté choisi ; sinon, le plus dégagé, avec une grosse pénalité)
      const wrong = a.pick && RAYS[i] && Math.sign(RAYS[i]) !== a.pick ? 3 : 0;
      const cost = Math.abs(RAYS[i] - goal) + wrong + (ok ? 0 : 10 + (S.L - fr));
      if (cost < bestCost) { bestCost = cost; best = i; }
    }
    // l'étape est-elle dans l'éventail et libre ? on y va tout droit ; sinon, l'antenne choisie
    steerTo = S.free[gi] >= near && Math.abs(err) <= RAYS[RAYS.length - 1] ? err : RAYS[best];
    // la place devant, dans la direction prise
    const k = RAYS.reduce((m, x, i) => (Math.abs(x - steerTo) < Math.abs(RAYS[m] - steerTo) ? i : m), 0);
    ahead = Math.min(S.free[k], S.free[RAYS.indexOf(0)] + (Math.abs(steerTo) > 0.45 ? 3 : 0));
    a.side = (S.free[0] + S.free[1] + S.free[2]) > (S.free[6] + S.free[7] + S.free[8]) ? -1 : 1; // (le côté le plus dégagé)
  }
  let want = Math.min(vmax, Math.sqrt(2 * AUTO_DECEL * Math.max(0, D - ARRIVE + 0.5)));
  want *= Math.max(0.3, Math.cos(steerTo));
  // (un obstacle devant : on freine pour s'arrêter avant lui ; droit devant, on ralentit tôt, pour
  // avoir la place de tourner)
  if (ahead < Infinity) want = Math.min(want, Math.max(1.5, Math.sqrt(2 * AUTO_DECEL * Math.max(0, ahead - 1))));
  if (S && S.free[RAYS.indexOf(0)] < S.L - 0.5) want = Math.min(want, Math.max(2.5, S.free[RAYS.indexOf(0)] * 0.55));
  // (bloqué : il ne roule plus alors qu'il voudrait)
  if (want > 1 && Math.abs(C.v) < 0.4) a.stuck = (a.stuck || 0) + h; else a.stuck = 0;
  if (a.stuck > 1.5) {
    // en marche arrière, braquer à gauche tourne le nez à droite : on braque à l'opposé du côté libre
    a.stuck = 0; a.rev = 1.8; a.revSteer = -(a.side ?? Math.sign(err || 1));
  }
  return { want, steer: clamp(steerTo * 2, -1, 1), brake: false };
}

// Frottement d'un point de roue (contact c avec le sol), au centre de sa roue (c.rw). Le long de
// la roue (f), il rejoint la vitesse des roues (motrices, freinées) ou ne freine presque pas (roue
// libre) ; de côté (g), il tient comme un frottement ordinaire. Le tout dans la limite de
// l'adhérence (mu × appui). S : le moteur physique (velAt, invMassAt, impulse)
export function wheelFriction(S, c) {
  const C = c.a.car, n = c.n, r = c.rw;
  const vr = S.velAt(c.a, r, _v);
  vr.addScaledVector(n, -vr.dot(n));
  _f.copy(C.fwdW);
  if (c.front && C.steer) _f.applyAxisAngle(n, C.steer);
  _f.addScaledVector(n, -_f.dot(n));
  const fl = _f.length();
  if (fl < 1e-4) return;
  _f.divideScalar(fl);
  _g.crossVectors(n, _f);
  const kf = S.invMassAt(c.a, r, _f), kg = S.invMassAt(c.a, r, _g);
  const lim = c.mu * C.jnAvg, oldA = c.ja || 0, oldL = c.jl || 0;
  // (différentiel : chaque roue gagne le même écart de vitesse, à partir de la sienne ; dans un
  // virage, celles de devant roulent un peu plus vite que celles de derrière, sans se contrarier)
  if (c.tgt === undefined) c.tgt = vr.dot(_f) + C.Vw - C.v;
  let ja = oldA - (vr.dot(_f) - (C.grip ? c.tgt : 0)) / kf;
  let jl = oldL - vr.dot(_g) / kg;
  // (de côté d'abord : la roue tient sa trajectoire, et freine ou tire avec ce qui reste de
  // l'adhérence, comme un ABS ; sinon un coup de frein à pleine vitesse ferait partir la voiture en toupie)
  jl = clamp(jl, -lim, lim);
  const limA = Math.min(C.grip ? lim : ROLL_MU * C.jnAvg, Math.sqrt(Math.max(0, lim * lim - jl * jl)));
  ja = clamp(ja, -limA, limA);
  c.ja = ja;
  c.jl = jl;
  S.impulse(c.a, _j.copy(_f).multiplyScalar(ja - oldA).addScaledVector(_g, jl - oldL), r);
  c.jt.copy(_f).multiplyScalar(ja).addScaledVector(_g, jl);
}
