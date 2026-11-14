// L'espace, dans le jeu : pas de mode à part. Le joueur reste le joueur (main, inventaire, blocs),
// la fusée reste un objet physique (structs.js) sur lequel on marche, et tout le monde y va ensemble
// en multijoueur : les autres astres et le vide sont des zones de la même carte (voir spacegen.js).
//
// Une « bulle » est une case du vide posée quelque part dans le système. Son centre sur la carte
// correspond à la position c (par rapport à l'astre ref), ses axes sont tournés de Q, et elle
// avance à la vitesse v : elle est en chute libre autour de son astre, comme un ascenseur. Tout ce
// qui est dedans flotte donc naturellement : un joueur sorti d'une fusée en orbite reste à côté
// d'elle, sans rien calculer pour lui. Ce qui s'y déplace n'a de vitesse que par rapport à elle.
//  - Quitter un astre (au-dessus de SPACE_Y) : une nouvelle bulle naît juste au-dessus du point
//    de la sphère, axes alignés sur le sol, et on y continue à la même vitesse. Rien ne tourne.
//  - Tout seul dans une bulle vide, on reste au centre de la carte : c'est la bulle qui avance
//    (les grandes vitesses ne coûtent rien, et ne font jamais perdre de précision).
//  - Avec quelqu'un d'autre, ou s'il y a des blocs : on s'en va pour de vrai, puis, trop loin,
//    on continue dans une nouvelle bulle.
//  - Poser un bloc ancre la bulle : elle ne bouge plus par rapport à son astre (une station).
//  - S'approcher d'une bulle habitée, construite, ou d'un astéroïde : on y entre.
//  - Descendre vers un astre solide (sous ENTRY_ALT) : on arrive au-dessus du point visé, dans
//    sa zone.
//  - Saut nédrolytique : c'est la bulle qui file (voir stepWarp).
//
// Multijoueur : l'hôte simule les fusées (même celles pilotées par un invité, qui envoie ses
// commandes) et chacun se simule lui-même. Chaque bulle a un propriétaire (qui la fait avancer pour
// de bon) ; les autres la suivent. Rien à faire pour les blocs, coffres, etc. : même monde.
import * as THREE from 'three';
import { STAR, BODIES, BODY, LY, bodyPos, soiAt, spanOf, sunOf, sunNear, spinAngle, holeG, LIGHTS, systemOf, systemNear } from './system.js?v=1.1.5-alpha-mwgq2wrb';
import { worldToDir, dirToWorld } from './planetview.js?v=1.1.5-alpha-mwgq2wrb';
import { zoneOfXZ, zoneBody, bodyZone, ZONE, Z_VOID, Z_ROCK, slotOfQR, slotAt, rocksNear, rockSlot, rockOfQR, inBelt, RUIN } from './spacegen.js?v=1.1.5-alpha-mwgq2wrb';
import { SPACE_Y } from './rocket.js?v=1.1.5-alpha-mwgq2wrb';

const SQ3 = Math.sqrt(3) / 2;
const DAY = 1800;                  // durée d'un jour de jeu (s)
const GROUND_Y = 64;               // (le sol d'un astre, vu de l'espace : sa surface)
const ENTRY_ALT = SPACE_Y - GROUND_Y - 24; // altitude où l'on entre dans la zone d'un astre (en descendant)
const LINE_R = 64; // (descendu du train sur une ligne spatiale : plus loin que ça de la voie, on est dans l'espace)
const LINE_LOST = 500; // (bien plus loin d'un coup : une téléportation, on n'y est plus du tout)
const TRANSIT_MARGIN = 800; // (sur une ligne spatiale : à moins de ça d'un bout, on est encore au-dessus de l'astre)
const AVOID = [STAR, ...BODIES];
const CURVE_N = 256;        // (points du tracé d'une ligne spatiale)
const LAND_KEEP = 200;      // (à moins de ça d'un bout, tout le terrain est affiché ; au-delà, il se réduit jusqu'à TRANSIT_MARGIN)
const _ta = new THREE.Vector3(), _tb = new THREE.Vector3(), _tv = new THREE.Vector3(), _ts = new THREE.Vector3(), _tu = new THREE.Vector3(), _t1 = new THREE.Vector3(), _t2 = new THREE.Vector3(), _t3 = new THREE.Vector3();
const _tm = new THREE.Matrix4(), _tm2 = new THREE.Matrix4(), _tq = new THREE.Quaternion(), _tq2 = new THREE.Quaternion(), _tq3 = new THREE.Quaternion(), _tqa = new THREE.Quaternion(), _tqb = new THREE.Quaternion();
const TOWER_R = 16; // (blocs posés au-dessus du monde à moins de cette distance : on reste sur la carte, voir update)
const TOWER_LAND_R = 48; // (en revenant de l'espace : à cette distance d'une tour, on retrouve la carte)
const THIN_AIR = 100; // (la gravité baisse sur cette hauteur, pour s'annuler à SPACE_Y)
const ABSORB = 800, OUT = 1200;    // (blocs du centre d'une bulle : voir stepFree)
const SINK = -100;                 // (seul dans sa bulle : plus bas, on recentre, pour rester loin du bas de la carte)
const JOIN = 700, JOIN_SPEED = 1500, ROCK_PAD = 500; // (entrer dans une autre bulle, un astéroïde)
const G_K = 30;                    // gravité en blocs/s² à la surface (30 × gravity, comme dans le monde)
export const JUMP_START = 200;     // mB pour allumer le saut
const JUMP_BURN = 30, JUMP_V0 = 4000, JUMP_VMAX = 3e7, JUMP_DOUBLE = 1.5;
const INTER_VMAX = 2.5e11;           // (loin de tout astre, avec ou sans cible : voir stepWarp)
const HOLES = BODIES.filter((b) => b.kind === 'hole');
const TIME_MAX = 1e7;              // (près d'un trou noir : 1 / sqrt(1 - Rs / r), sans fin à l'horizon ; borné pour les calculs)
const FLY_V0 = 600, FLY_DOUBLE = 1; // (créatif : voler très vite, Ctrl tenu)
const ALL = [STAR, ...BODIES];
const NAMES = ALL.map((b) => b.id);
const AXIS_Z = new THREE.Vector3(0, 0, 1), AXIS_Y = new THREE.Vector3(0, 1, 0);
const clock = { day: 0, seed: '0' }; // (l'instant de cette image : l'orientation des planètes synchrones en dépend)
const _bq = new THREE.Quaternion(), _bq2 = new THREE.Quaternion();
// L'orientation d'un astre : son inclinaison, et sa rotation s'il montre toujours la même face
function bodyQ(b, out) {
  out.setFromAxisAngle(AXIS_Y, spinAngle(b, clock.day, clock.seed));
  return out.premultiply(_bq2.setFromAxisAngle(AXIS_Z, b.tilt || 0));
}
const ZERO = new THREE.Vector3();
// L'orbite de la station Hexa-Zéro en ruine autour de PXT-1 : la même pour tous (au jour 0, sur
// l'axe x ; circulaire, dans le plan de l'astre). Sa position par rapport au centre de PXT-1 au jour day
export function ruinOrbit() {
  const b = BODY[RUIN.ref], d = b.R * RUIN.dist;
  return { ax: [0, 1, 0], w: Math.sqrt(G_K * (b.gravity || 1) * b.R * b.R / (d * d * d)), d0: 0, c0: [d, 0, 0] };
}
export function ruinRel(day, out = new THREE.Vector3()) {
  const O = ruinOrbit();
  return out.fromArray(O.c0).applyAxisAngle(AXIS_Y, O.w * (day - O.d0) * DAY);
}
export const de = (n) => (/^[aeiouyhéèêâ]/i.test(n) ? 'd\'' : 'de ') + n; // (« d'Orgon », « de Cryos »)

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4();
const fmtD = (d) => (d >= LY * 0.01 ? (d / LY).toFixed(d >= LY ? 1 : 2) + ' années-lumière' : d >= 1e9 ? (d / 1e9).toFixed(2) + ' G blocs' : d >= 1e6 ? (d / 1e6).toFixed(d >= 1e8 ? 0 : 1) + ' M blocs' : d >= 1e4 ? Math.round(d / 1000) + ' k blocs' : Math.round(d) + ' blocs');
const fmtV = (v) => (v >= 1e9 ? (v / 1e9).toFixed(v >= 1e11 ? 0 : 1) + ' G b/s' : v >= 1e6 ? (v / 1e6).toFixed(1) + ' M b/s' : v >= 1e4 ? (v / 1000).toFixed(0) + ' k b/s' : v.toFixed(v < 100 ? 1 : 0) + ' b/s');

// Les axes du sol au point (x, z) d'un astre (x : vers l'est de sa carte, y : le haut, z : le sud)
function tangentQ(b, x, z, out = new THREE.Quaternion()) {
  const span = spanOf(b), lon = -(x / span) * Math.PI * 2, lat = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, (-z / (span * 0.5)) * Math.PI));
  const cl = Math.cos(lat), sl = Math.sin(lat), co = Math.cos(lon), so = Math.sin(lon);
  _m.set(so, cl * co, sl * co, 0, 0, sl, -cl, 0, -co, cl * so, sl * so, 0, 0, 0, 0, 1);
  out.setFromRotationMatrix(_m);
  return out.premultiply(bodyQ(b, _bq));
}

const fade = (b, y) => b.gravity * Math.max(0, Math.min(1, (SPACE_Y - y) / THIN_AIR));

export class SpaceFlight {
  // g : { player, structs, rockets, world, sky, net, camera, scene, survival(), day(), seed(), toast(), onZone() }
  constructor(g) {
    this.g = g;
    this.spaces = new Map(); // id -> bulle
    this.on = false;
    this.zone = 0;
    this.inVoid = false;
    this.bp = {};            // positions des astres (cette image)
    this.curves = new Map(); // (tracés des lignes spatiales, voir curveOf)
    for (const id of NAMES) this.bp[id] = { x: 0, y: 0, z: 0 };
    this.day = 0;
    this.liveIds = new Set();
    this.clock = { soi: 0, join: 0, push: 0, rocks: 0, panel: 0, rkh: 0 };
    this.warpFly = null;     // (créatif : le joueur file, Ctrl tenu)
    this.flyHeld = 0;
    this.target = null;      // repère (touche N)
    this.heat = 0;
    this.rocks = [];
    this.remoteHud = null;   // (invité aux commandes : ce que dit l'hôte)
    this.onId = 0;           // (invité : l'objet qui le porte, dit à l'hôte)
    g.world.onVoidBlock = (q, r) => this.anchorAt(q, r);
    this.dom = null;
    this.streaks = null;
  }

  get me() { const n = this.g.net; return n.active ? n.myPid ?? 0 : 0; }
  // Ce joueur est-il à bord de cet objet ? (assis, accroché, debout, ou qui flotte dedans : sans
  // gravité, on ne tient pas au sol ; il part avec l'objet comme s'il y marchait)
  aboard(p, s) {
    if (p.pilot?.s === s || p.attached === s || p.standingOn === s) return true;
    const r = s.radius + 2;
    return Math.abs(p.pos.x - s.pos.x) < r && Math.abs(p.pos.y - s.pos.y) < r && Math.abs(p.pos.z - s.pos.z) < r && p.pos.distanceToSquared(s.pos) < r * r;
  }

  // ---------- Une partie ----------
  // list : les bulles sauvegardées ; on : false dans le tutoriel (il n'y a que sa station)
  load(list, on = true) {
    this.spaces.clear();
    this.on = on;
    this.warpFly = null;
    this.target = null;
    this.remoteHud = null;
    this.rocks = [];
    for (const e of Array.isArray(list) ? list : []) { const B = this.receive(e); if (B) B.wv = null; }
    if (on) this.addRuin();
    this.relink = true; // (la partie reprend peut-être à pied à côté d'une ligne spatiale)
    this.syncZone(true);
  }
  reset() { this.on = false; this.hole = null; this.dilation = 1; this.inside = null; this.g.canvas.style.filter = ''; if (this.stretched) { this.g.canvas.style.transform = ''; this.stretched = false; } this.g.sky.fixedSun = this.g.sky.viewLocal = null; this.spaces.clear(); this.inVoid = false; this.zone = 0; this.transit = null; this.g.world.noTerrain = this.g.world.fastLine = false; this.curves.clear(); this.deck = false; this.setLand(1); this.showDom(false); }

  serialize() {
    const out = [], { structs } = this.g;
    for (const B of this.spaces.values()) {
      if (B.rock || B.ruin) continue; // (un astéroïde, la ruine : recalculés d'après leur place)
      if (B.anchored || this.liveIds.has(B.id) || structs.list.some((s) => this.idAt(s.pos.x, s.pos.z) === B.id)) out.push({ ...this.pack(B), w: undefined });
    }
    return out;
  }
  pack(B) {
    return { i: B.ix, j: B.iz, ref: B.ref, c: B.c.toArray(), q: B.Q.toArray(), v: B.v.toArray(), a: B.anchored ? 1 : 0, o: B.owner ?? 0, ...(B.wv ? { w: B.wv.toArray() } : {}), ...(B.hold ? { h: 1 } : {}), ...(B.orb ? { orb: B.orb } : {}), ...(B.siteName ? { n: B.siteName } : {}) };
  }
  // Une bulle reçue (sauvegarde, réseau)
  receive(e) {
    if (!e || !Number.isInteger(e.i) || !Number.isInteger(e.j) || !BODY[e.ref]) return null;
    if (e.i === RUIN.ix && e.j === RUIN.iz) return null; // (la ruine : la même pour tous)
    const nums = (a, n) => Array.isArray(a) && a.length === n && a.every(Number.isFinite);
    if (!nums(e.c, 3) || !nums(e.q, 4) || !nums(e.v, 3)) return null;
    const id = e.i + ',' + e.j;
    let B = this.spaces.get(id);
    if (!B) { B = this.make(slotAt(e.i, e.j), e.ref); this.spaces.set(id, B); }
    B.ref = e.ref;
    B.c.fromArray(e.c); B.Q.fromArray(e.q).normalize(); B.v.fromArray(e.v);
    B.anchored = !!e.a;
    B.owner = Number.isInteger(e.o) ? e.o : 0;
    B.wv = nums(e.w, 3) ? new THREE.Vector3().fromArray(e.w) : null;
    B.hold = !!e.h;
    B.orb = e.orb && nums(e.orb.ax, 3) && nums(e.orb.c0, 3) && Number.isFinite(e.orb.w) && Number.isFinite(e.orb.d0) ? e.orb : null;
    B.siteName = typeof e.n === 'string' ? e.n.slice(0, 32) : null;
    return B;
  }
  // La station Hexa-Zéro en ruine (voir spacegen.js) : une bulle ancrée, jamais sauvegardée ni envoyée
  addRuin() {
    const B = this.make(slotAt(RUIN.ix, RUIN.iz), RUIN.ref);
    B.ruin = true;
    B.anchored = true;
    B.owner = 0;
    B.siteName = RUIN.name;
    B.orb = ruinOrbit();
    B.c.fromArray(B.orb.c0);
    this.spaces.set(B.id, B);
  }
  make(slot, ref) {
    return {
      id: slot.ix + ',' + slot.iz, ix: slot.ix, iz: slot.iz, ox: slot.q0 + slot.r0 / 2, oz: slot.r0 * SQ3, ref,
      c: new THREE.Vector3(), Q: new THREE.Quaternion(), v: new THREE.Vector3(), anchored: false, rock: false, owner: this.me, wv: null, hold: false,
    };
  }
  push(B) {
    if (B.rock || B.ruin) return;
    B.owner = this.me;
    this.g.net.sendSpace?.(this.pack(B));
  }

  // ---------- Où est-on ? ----------
  idAt(x, z) {
    const zone = zoneOfXZ(x, z);
    if (zone >= 0) return null;
    const r = z / SQ3, q = x - r / 2;
    if (zone === Z_VOID) { const s = slotOfQR(q, r); return s.ix + ',' + s.iz; }
    const R = rockOfQR(q, r);
    return R ? 'r' + R.u + ',' + R.v : null;
  }
  bubbleAt(x, z) {
    const zone = zoneOfXZ(x, z);
    if (zone >= 0) return null;
    const r = z / SQ3, q = x - r / 2;
    if (zone === Z_ROCK) {
      const R = rockOfQR(q, r);
      return R ? this.rockBubble(R) : null;
    }
    const s = slotOfQR(q, r), id = s.ix + ',' + s.iz;
    let B = this.spaces.get(id);
    if (!B) {
      // (pas encore reçue, ou une téléportation au hasard : fixe, loin de tout)
      B = this.make(s, 'star');
      B.c.set(3e9, 0, 0);
      B.anchored = true;
      this.spaces.set(id, B);
    }
    return B;
  }
  rockBubble(R) {
    const id = 'r' + R.u + ',' + R.v;
    let B = this.spaces.get(id);
    if (!B) {
      B = { id, rock: R, ox: R.q0 + R.r0 / 2, oz: R.r0 * SQ3, ref: 'star', c: new THREE.Vector3(R.x, R.y, R.z), Q: new THREE.Quaternion(), v: new THREE.Vector3(), anchored: true, owner: 0, wv: null, hold: false };
      this.spaces.set(id, B);
    }
    return B;
  }
  newBubble(ref, c, Q, v) {
    let s;
    do { s = slotAt(Math.floor(Math.random() * 4000), Math.floor(Math.random() * 4000)); } while (this.spaces.has(s.ix + ',' + s.iz));
    const B = this.make(s, ref);
    B.c.copy(c); B.Q.copy(Q); B.v.copy(v);
    this.spaces.set(B.id, B);
    this.push(B);
    return B;
  }
  // position par rapport à l'astre de la bulle
  toRel(B, p, out) { return out.set(p.x - B.ox, p.y, p.z - B.oz).applyQuaternion(B.Q).add(B.c); }
  toAbs(B, p, out) {
    const o = this.bp[B.ref];
    return this.toRel(B, p, out).add(_d.set(o.x, o.y, o.z));
  }
  bodyVel(id, out) {
    if (id === 'star') return out.set(0, 0, 0);
    const h = 2 / DAY, seed = this.g.seed(), a = bodyPos(id, this.day - h, seed, {}), b = bodyPos(id, this.day + h, seed, {});
    return out.set(b.x - a.x, b.y - a.y, b.z - a.z).divideScalar(4);
  }

  // ---------- La zone du joueur : le ciel, la gravité ----------
  syncZone(force = false) {
    if (!this.on) return;
    const { player, sky } = this.g, z = this.transit ? Z_VOID : zoneOfXZ(player.pos.x, player.pos.z);
    if (z === this.zone && !force) return;
    const was = this.zone;
    this.zone = z;
    this.inVoid = z < 0;
    const b = zoneBody(z);
    sky.planet = z > 0 ? b : null;
    sky.space = z < 0;
    sky.viewHere = z >= 0 ? b.id : null;
    if (z >= 0) { sky.viewAt = null; sky.viewBelow = null; sky.viewRocks = null; }
    player.gravity = z < 0 ? 0 : b.gravity;
    this.g.onZone?.();
    this.showDom(z < 0);
    if (!force) {
      if (z >= 0 && was !== z) this.g.toast(b.name);
    }
  }
  // Gravité (facteur) et plafond de l'air au point (x, z) : pour les objets (structs.js, rocket.js)
  // (la gravité baisse très haut au-dessus d'un astre, comme sur une vraie planète)
  gravityAt(x, z, y = 0) { const k = zoneOfXZ(x, z); return k < 0 ? 0 : fade(zoneBody(k), y); }
  airTopAt(x, z) { const k = zoneOfXZ(x, z); return k < 0 || !zoneBody(k).atmo?.density ? 0 : SPACE_Y; }
  isHome(x, z) { return zoneOfXZ(x, z) === 0; }

  // ---------- Déplacer quelque chose (et ce qu'il porte) ----------
  // dq : la rotation de son repère (d'une bulle à l'autre), sinon null
  move(E, to, dq, vel) {
    const { player, net, structs } = this.g;
    if (!E.s) {
      if (dq) this.turnLook(dq);
      this.g.carryFx?.(player.pos, to, dq, 40, _b.copy(vel).sub(dq ? _a.copy(E.vel).applyQuaternion(dq) : E.vel));
      player.pos.copy(to);
      if (vel !== E.vel) E.vel.copy(vel);
      this.g.survival().airTop = null;
      return;
    }
    const s = E.s, from = _a.copy(s.pos).clone();
    const carry = (p) => { p.sub(from); if (dq) p.applyQuaternion(dq); p.add(to); };
    if (this.rideS === s || this.aboard(player, s)) {
      if (dq && player.shipFrame !== s) this.turnLook(dq);
      carry(player.pos);
      if (player.attached !== s) player.vel.copy(vel); // (attaché : sa vitesse est comptée par rapport au vaisseau)
      this.g.survival().airTop = null;
    }
    for (const p of net.proxies()) if (this.aboard(p, s)) carry(p.pos);
    const quat = dq ? _q.copy(dq).multiply(s.quat).clone() : null;
    // (les flammes, les étincelles et la fumée de ses moteurs suivent le vaisseau)
    this.g.carryFx?.(from, to, dq, s.radius * 2 + 40, _b.copy(vel).sub(dq ? _c.copy(s.vel).applyQuaternion(dq) : s.vel));
    structs.teleport(s, to, quat);
    s.vel.copy(vel);
    if (dq) s.ang.applyQuaternion(dq);
    this.g.rockets?.placeFlames?.(s);
    net.sendTeleport?.(s, from, dq);
  }
  // (un invité : l'hôte a déplacé un objet)
  teleported(m) {
    const { structs, player } = this.g, s = structs.byId(m.id);
    if (!s) return;
    const from = new THREE.Vector3().fromArray(m.f), to = new THREE.Vector3().fromArray(m.to), dq = m.d ? new THREE.Quaternion().fromArray(m.d) : null;
    if (this.aboard(player, s)) {
      if (dq && player.shipFrame !== s) this.turnLook(dq);
      player.pos.sub(from); if (dq) player.pos.applyQuaternion(dq); player.pos.add(to);
      this.g.survival().airTop = null;
    }
    structs.teleport(s, to, new THREE.Quaternion().fromArray(m.q));
    const o = structs.origin(s, new THREE.Vector3());
    (s.tOrigin ||= new THREE.Vector3()).copy(o);
    (s.tQuat ||= new THREE.Quaternion()).copy(s.quat);
  }
  turnLook(dq) {
    const { player } = this.g, cp = Math.cos(player.pitch);
    _b.set(-Math.sin(player.yaw) * cp, Math.sin(player.pitch), -Math.cos(player.yaw) * cp).applyQuaternion(dq);
    player.pitch = Math.asin(Math.max(-1, Math.min(1, _b.y)));
    player.yaw = Math.atan2(-_b.x, -_b.z);
  }

  // ---------- Quitter un astre ----------
  ascend(E, k) {
    const b = zoneBody(k), x = E.pos.x - k * ZONE, z = E.pos.z;
    const Q = tangentQ(b, x, z);
    const c = worldToDir(x, z, spanOf(b), new THREE.Vector3()).applyQuaternion(bodyQ(b, _bq)).multiplyScalar(b.R + E.pos.y - GROUND_Y);
    const hold = !E.s && this.g.player.fly; // (créatif, en volant : rien ne nous fait retomber)
    const v = hold ? ZERO : E.vel.clone().applyQuaternion(Q);
    const B = this.newBubble(b.id, c, Q, v);
    B.hold = !!hold;
    this.move(E, new THREE.Vector3(B.ox, 0, B.oz), null, hold ? E.vel : ZERO);
    if (E.s) E.s.level = false;
    this.syncZone();
    return B;
  }

  // ---------- Pour les stations et les vaisseaux automatisés (voir orbital.js) ----------
  get entryAlt() { return ENTRY_ALT; }
  // Un point au-dessus du sol d'un astre, dans le système
  groundAbs(k, x, z, alt, out) {
    const b = zoneBody(k), o = this.bp[b.id];
    return worldToDir(x - k * ZONE, z, spanOf(b), out).applyQuaternion(bodyQ(b, _bq)).multiplyScalar(b.R + alt).add(_d.set(o.x, o.y, o.z));
  }
  // Arrivé au-dessus du sol : on entre dans la zone de l'astre
  arriveGround(E, B, k, x, z) {
    const b = zoneBody(k), o = this.bp[b.id], rel = this.toAbs(B, E.pos, new THREE.Vector3()).sub(_d.set(o.x, o.y, o.z));
    this.descend(E, B, b, rel, rel.length() - b.R);
    E.vel.set(0, 0, 0);
  }
  // Entrer dans une autre bulle sans bouger de sa place dans le système
  enter(E, B, O) {
    const abs = this.toAbs(B, E.pos, new THREE.Vector3()), V = O.v.clone();
    const inside = E.s && this.aboard(this.g.player, E.s);
    this.join(E, B, O, abs, V, !inside);
    E.vel.set(0, 0, 0);
  }
  // Une bulle ancrée sur une vraie orbite circulaire autour de son astre
  setOrbit(B, on) {
    const b = BODY[B.ref], d = B.c.length();
    let w = 0;
    if (on && b && d > 1) w = b.kind === 'hole' ? Math.sqrt(holeG(b, d) / d) : Math.sqrt(G_K * (b.gravity || 0) * b.R * b.R / (d * d * d));
    if (!w) { if (B.orb) { B.orb = null; B.v.set(0, 0, 0); } return; }
    if (B.orb) return;
    const c = B.c.clone().normalize(), ax = AXIS_Y.clone().addScaledVector(c, -AXIS_Y.dot(c));
    if (ax.lengthSq() < 1e-6) ax.set(1, 0, 0);
    B.orb = { ax: ax.normalize().toArray(), w, d0: this.day, c0: B.c.toArray() };
  }
  stepOrbits() {
    for (const B of this.spaces.values()) {
      if (!B.orb) continue;
      const O = B.orb, ax = _c.fromArray(O.ax);
      B.c.fromArray(O.c0).applyAxisAngle(ax, O.w * (this.day - O.d0) * DAY);
      B.v.crossVectors(ax, B.c).multiplyScalar(O.w);
    }
  }

  // ---------- En train, sur une ligne spatiale ----------
  // La ligne est tracée sur la carte, d'une zone à l'autre, mais ce qu'on voit par la fenêtre est le
  // vrai voyage : la position dans le système va de l'astre de départ à celui d'arrivée, au prorata
  // de la distance parcourue sur la ligne (les astres bougent : ils sont au bon endroit à l'arrivée)
  stepTransit(dt) {
    const { player, tracks, world } = this.g;
    let h = null, land = 1;
    const was = this.transit, car = player.riding;
    this.frameN = (this.frameN | 0) + 1;
    this.stepDeck(!car && tracks.longs.size ? tracks.longAt(player.pos, 8) : null);
    if (tracks.longs.size) {
      // à bord ; ou à pied, descendu en route : on flotte le long de la voie, et le train nous attend
      if (car) h = tracks.longAt(car.pos);
      else if (was) h = tracks.longAt(player.pos, LINE_LOST);
      else if (this.relink) h = tracks.longAt(player.pos, LINE_R);
      this.relink = false;
      // (près d'un bout, on est encore au-dessus de l'astre : son terrain et ses nuages s'effacent
      // ou reviennent peu à peu, pour qu'il n'y ait pas de coupure avec le voyage)
      if (h) {
        const d = Math.min(h.u, h.e.L - h.u);
        land = d < TRANSIT_MARGIN ? Math.min(1, (TRANSIT_MARGIN - d) / (TRANSIT_MARGIN - LAND_KEEP)) : 0;
        if (d < TRANSIT_MARGIN) h = null;
      }
      // (trop loin de la voie : c'est l'espace, à l'endroit du système où l'on est)
      if (h && !car && h.off > LINE_R) { this.leaveLine(); this.setLand(1); return; }
    }
    this.setLand(land);
    if (!h) {
      if (was) { this.transit = null; world.noTerrain = world.fastLine = false; this.syncZone(); }
      return;
    }
    const e = h.e, za = zoneOfXZ(e.a.pos.x, e.a.pos.z), zb = zoneOfXZ(e.b.pos.x, e.b.pos.z);
    if (za < 0 || zb < 0) return;
    // (le sens : celui du mouvement ; en entrant, vers le bout le plus loin)
    const same = was && was.e === e, du = same && car ? h.u - was.u : 0, speed = Math.abs(du) / Math.max(dt, 1e-3);
    const ahead = du > 0 ? true : du < 0 ? false : same ? was.ahead : h.u < e.L / 2;
    // (un invité reçoit le train par à-coups : une image sans mouvement n'est pas forcément un arrêt)
    const coast = car && same && was.speed > 1 ? was.speed * Math.exp(-6 * dt) : 0;
    const T = this.transit = { e, u: h.u, ahead, speed: speed || (coast > 1 ? coast : 0), to: ahead ? zb : za, left: ahead ? e.L - h.u : h.u };
    const B = this.transitB ||= { ref: 'star', c: new THREE.Vector3(), Q: new THREE.Quaternion(), v: new THREE.Vector3(), wv: new THREE.Vector3(), ox: 0, oz: 0 };
    B.ox = player.pos.x;
    B.oz = player.pos.z;
    const curve = this.curveOf(e);
    if (!curve) return;
    this.curveAt(curve, e, h.u, B.c, B.Q, _tv);
    const ramp = (x) => { const k = Math.max(0, Math.min(1, (x - TRANSIT_MARGIN) / 40000)); return k * k * (3 - 2 * k); };
    // (près d'un astre : le soleil est encore à sa place dans le ciel de cet astre)
    T.sun = 1 - Math.min(ramp(h.u), ramp(e.L - h.u));
    // (à grande vitesse : les rails suivent le train au lieu d'être refaits, voir tracks.followLongs)
    world.fastLine = T.speed > 200;
    if (world.fastLine) tracks.followLongs(player.pos.x, player.pos.z);
    B.wv.copy(_tv).multiplyScalar((ahead ? 1 : -1) * T.speed);
    if (!was) { world.noTerrain = true; this.syncZone(); }
  }

  // Terrain et nuages du lieu où l'on est : k = 1 tout est là, 0 il n'y a plus que l'astre vu de loin
  setLand(k) {
    const { world, sky, player } = this.g;
    if (k === 1 && (this.land ?? 1) === 1) return;
    this.land = sky.landK = k;
    world.clipLand(player.pos.x, player.pos.z, k >= 1 ? Infinity : k * world.viewDistance);
  }
  // Le tracé d'une ligne spatiale dans le système : une grande courbe qui quitte l'astre de départ
  // à l'horizontale, dans l'axe des rails, et se pose sur celui d'arrivée de la même façon ; elle
  // contourne les astres qu'elle croise. Refaite à chaque image (les astres bougent).
  curveOf(e) {
    const za = zoneOfXZ(e.a.pos.x, e.a.pos.z), zb = zoneOfXZ(e.b.pos.x, e.b.pos.z);
    if (za < 0 || zb < 0) return null;
    let c = this.curves.get(e);
    if (!c) this.curves.set(e, (c = { pos: new Float64Array((CURVE_N + 1) * 3), tan: new Float64Array((CURVE_N + 1) * 3), up: new Float64Array((CURVE_N + 1) * 3), len: new Float64Array(CURVE_N + 1), total: 0, frame: -1 }));
    if (c.frame === this.frameN) return c;
    c.frame = this.frameN;
    const ba = zoneBody(za), bb = zoneBody(zb), pa = this.bp[ba.id], pb = this.bp[bb.id], d = e.dir, m = TRANSIT_MARGIN;
    // (les deux bouts : là où l'on quitte la carte, exactement ; la hauteur du joueur est ajoutée ensuite, voir toRel)
    const xa = e.a.pos.x + d.x * m - za * ZONE, xb = e.b.pos.x - d.x * m - zb * ZONE, wa = e.a.pos.z + d.z * m, wb = e.b.pos.z - d.z * m;
    const ca = worldToDir(xa, wa, spanOf(ba), _ta).applyQuaternion(bodyQ(ba, _bq)).multiplyScalar(ba.R - GROUND_Y).add(_d.set(pa.x, pa.y, pa.z));
    const cb = worldToDir(xb, wb, spanOf(bb), _tb).applyQuaternion(bodyQ(bb, _bq)).multiplyScalar(bb.R - GROUND_Y).add(_d.set(pb.x, pb.y, pb.z));
    const Qa = tangentQ(ba, xa, wa, _tqa), Qb = tangentQ(bb, xb, wb, _tqb);
    const Ta = _t1.copy(d).applyQuaternion(Qa), Tb = _t2.copy(d).applyQuaternion(Qb), Ua = _t3.set(0, 1, 0).applyQuaternion(Qa), Ub = _tu.set(0, 1, 0).applyQuaternion(Qb);
    const hd = ca.distanceTo(cb) * 0.4, { pos, tan, up, len } = c;
    const p1x = ca.x + Ta.x * hd, p1y = ca.y + Ta.y * hd, p1z = ca.z + Ta.z * hd, p2x = cb.x - Tb.x * hd, p2y = cb.y - Tb.y * hd, p2z = cb.z - Tb.z * hd;
    len[0] = 0;
    for (let i = 0; i <= CURVE_N; i++) {
      // (des points plus serrés aux deux bouts, là où l'on voit la courbe de près)
      const s = Math.sin((i / CURVE_N) * Math.PI / 2) ** 2, r = 1 - s, A = r * r * r, B1 = 3 * r * r * s, B2 = 3 * r * s * s, C = s * s * s;
      let x = A * ca.x + B1 * p1x + B2 * p2x + C * cb.x, y = A * ca.y + B1 * p1y + B2 * p2y + C * cb.y, z = A * ca.z + B1 * p1z + B2 * p2z + C * cb.z;
      if (i > 0 && i < CURVE_N) for (const b of AVOID) {
        const o = this.bp[b.id], min = b === ba || b === bb ? b.R - GROUND_Y : b.R * 1.15, dx = x - o.x, dy = y - o.y, dz = z - o.z, q = dx * dx + dy * dy + dz * dz;
        if (q < min * min && q > 0) { const k = min / Math.sqrt(q); x = o.x + dx * k; y = o.y + dy * k; z = o.z + dz * k; }
      }
      const j = i * 3;
      pos[j] = x; pos[j + 1] = y; pos[j + 2] = z;
      if (i) len[i] = len[i - 1] + Math.hypot(x - pos[j - 3], y - pos[j - 2], z - pos[j - 1]);
    }
    const total = c.total = len[CURVE_N];
    // la direction ; le « haut » suivi d'un point à l'autre (sans vriller), puis le petit écart
    // qui reste avec le haut de l'arrivée, réparti tout du long
    let ux = Ua.x, uy = Ua.y, uz = Ua.z;
    for (let i = 0; i <= CURVE_N; i++) {
      const j = i * 3;
      let tx, ty, tz;
      if (i === 0) { tx = Ta.x; ty = Ta.y; tz = Ta.z; } else if (i === CURVE_N) { tx = Tb.x; ty = Tb.y; tz = Tb.z; } else {
        tx = pos[j + 3] - pos[j - 3]; ty = pos[j + 4] - pos[j - 2]; tz = pos[j + 5] - pos[j - 1];
        const l = Math.hypot(tx, ty, tz) || 1; tx /= l; ty /= l; tz /= l;
      }
      tan[j] = tx; tan[j + 1] = ty; tan[j + 2] = tz;
      const dt = ux * tx + uy * ty + uz * tz;
      ux -= tx * dt; uy -= ty * dt; uz -= tz * dt;
      const l = Math.hypot(ux, uy, uz) || 1; ux /= l; uy /= l; uz /= l;
      up[j] = ux; up[j + 1] = uy; up[j + 2] = uz;
    }
    const sx = uy * Tb.z - uz * Tb.y, sy = uz * Tb.x - ux * Tb.z, sz = ux * Tb.y - uy * Tb.x; // (droite, avec le haut du dernier point)
    const twist = Math.atan2(sx * Ub.x + sy * Ub.y + sz * Ub.z, ux * Ub.x + uy * Ub.y + uz * Ub.z);
    for (let i = 0; i <= CURVE_N; i++) {
      const j = i * 3, k = total ? len[i] / total : 0, a = twist * k * k * (3 - 2 * k), co = Math.cos(a), si = Math.sin(a);
      const tx = tan[j], ty = tan[j + 1], tz = tan[j + 2], vx = up[j], vy = up[j + 1], vz = up[j + 2];
      const wx = vy * tz - vz * ty, wy = vz * tx - vx * tz, wz = vx * ty - vy * tx;
      up[j] = vx * co + wx * si; up[j + 1] = vy * co + wy * si; up[j + 2] = vz * co + wz * si;
    }
    return c;
  }
  // Où l'on est sur le tracé, à la distance u sur la ligne : la vitesse est la même que sur la carte
  // aux deux bouts, et le trajet tient dans la longueur de la ligne
  curveAt(c, e, u, outP, outQ, outT) {
    const span = e.L - 2 * TRANSIT_MARGIN, x = Math.max(0, Math.min(span, u - TRANSIT_MARGIN)), P = c.total, W = Math.min(40000, span / 4), rate = (P - W) / (span - W);
    const S = (t) => t * t * t - t * t * t * t / 2;
    const a = x < W ? x + (rate - 1) * W * S(x / W) : x > span - W ? P - ((span - x) + (rate - 1) * W * S((span - x) / W)) : W + (rate - 1) * W / 2 + rate * (x - W);
    const { len, pos, tan, up } = c;
    let lo = 0, hi = CURVE_N;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (len[mid] <= a) lo = mid; else hi = mid; }
    const f = Math.max(0, Math.min(1, (a - len[lo]) / ((len[hi] - len[lo]) || 1))), i = lo * 3, j = hi * 3;
    outP.set(pos[i] + (pos[j] - pos[i]) * f, pos[i + 1] + (pos[j + 1] - pos[i + 1]) * f, pos[i + 2] + (pos[j + 2] - pos[i + 2]) * f);
    outT.set(tan[i] + (tan[j] - tan[i]) * f, tan[i + 1] + (tan[j + 1] - tan[i + 1]) * f, tan[i + 2] + (tan[j + 2] - tan[i + 2]) * f).normalize();
    const U = _tu.set(up[i] + (up[j] - up[i]) * f, up[i + 1] + (up[j + 1] - up[i + 1]) * f, up[i + 2] + (up[j + 2] - up[i + 2]) * f);
    U.addScaledVector(outT, -U.dot(outT)).normalize();
    const d = e.dir;
    _tm.makeBasis(outT, U, _ts.crossVectors(outT, U));
    _tm2.makeBasis(_t2.copy(d), _t3.set(0, 1, 0), _t1.set(-d.z, 0, d.x).normalize());
    outQ.setFromRotationMatrix(_tm).multiply(_tq2.setFromRotationMatrix(_tm2).invert());
  }
  // À pied sur une ligne spatiale : la voie porte, on y marche comme sur n'importe quels rails
  stepDeck(foot) {
    const { player } = this.g, a = foot?.e.pts[0], p = player.pos;
    let on = false;
    if (foot && !player.fly) {
      const d = foot.e.dir, lat = Math.hypot(p.x - a.x - d.x * foot.u, p.z - a.z - d.z * foot.u);
      on = lat < 1.7 && p.y > a.y - 1 && p.y < a.y + 4;
    }
    if (on) {
      player.gravity = 1;
      if (p.y < a.y && player.vel.y <= 0) { p.y = a.y; player.vel.y = 0; player.onGround = true; }
    } else if (this.deck && this.zone < 0) player.gravity = 0;
    this.deck = on;
  }
  // S'éloigner de la voie, à pied : on continue dans le vide, dans une nouvelle bulle
  leaveLine() {
    const { player, world } = this.g, T = this.transitB, hold = player.fly;
    const B = this.newBubble('star', this.toRel(T, player.pos, new THREE.Vector3()), T.Q, ZERO);
    B.hold = !!hold;
    this.transit = null;
    world.noTerrain = world.fastLine = false;
    this.move({ s: null, pos: player.pos, vel: player.vel }, new THREE.Vector3(B.ox, 0, B.oz), null, player.vel);
    this.syncZone();
  }

  // ---------- Se poser ----------
  descend(E, B, b, rel, alt) {
    const dirM = _a.copy(rel).normalize().applyQuaternion(bodyQ(b, _bq).invert()), w = dirToWorld(dirM, spanOf(b));
    const k = b.kind === 'home' ? 0 : bodyZone(b.id);
    const to = new THREE.Vector3(w.x + k * ZONE, GROUND_Y + alt, w.z);
    const Qt = tangentQ(b, w.x, w.z), inv = Qt.clone().invert();
    const dq = inv.clone().multiply(B.Q);
    const v = _b.copy(E.vel).applyQuaternion(B.Q).add(B.v).applyQuaternion(inv).clone();
    // (l'atmosphère a déjà freiné : on arrive à une vitesse où l'on peut encore se rattraper)
    const hv = Math.hypot(v.x, v.z), hk = hv > 60 ? 60 / hv : 1;
    v.set(v.x * hk, Math.max(-60, Math.min(-2, v.y)), v.z * hk);
    if (E.s) { E.s.level = true; E.s.throttle = 0; E.s.warp = null; }
    else { this.warpFly = null; if (this.g.player.fly) v.set(0, 0, 0); }
    // ce qui tombait avec nous, dans la même bulle, arrive avec nous au lieu de rester là-haut
    const { structs, net } = this.g, from = E.pos.clone();
    const along = net.isClient ? [] : structs.list.filter((s) => s !== E.s && this.idAt(s.pos.x, s.pos.z) === B.id && s.pos.distanceTo(from) < OUT);
    this.move(E, to, dq, v);
    for (const s of along) {
      const p = s.pos.clone().sub(from).applyQuaternion(dq).add(to);
      p.y = Math.max(p.y, to.y);
      s.level = true; s.throttle = 0; s.warp = null;
      this.move({ s, pos: s.pos, vel: s.vel }, p, dq, v);
    }
    if (!E.s) this.syncZone();
  }

  // ---------- Dans le vide ----------
  // À chaque image, pour le joueur (si ce n'est pas la fusée qui le porte) ou une fusée pilotée
  stepFree(E, B, dt) {
    const w = E.s ? E.s.warp : this.warpFly;
    if (w) { this.stepWarp(E, B, w, dt); return; }
    if (this.hazards(E, B)) return;
    const dist = Math.hypot(E.pos.x - B.ox, E.pos.y, E.pos.z - B.oz), speed = E.vel.length();
    const solo = this.isSolo(B, E);
    if (solo && !B.anchored) {
      if (dist > ABSORB || E.pos.y < SINK || (E.s && speed > 100)) {
        // seul ici : c'est la bulle qui avance, on reste au centre
        B.c.add(_a.set(E.pos.x - B.ox, E.pos.y, E.pos.z - B.oz).applyQuaternion(B.Q));
        if (E.s) { B.v.add(_a.copy(E.vel).applyQuaternion(B.Q)); this.move(E, _c.set(B.ox, 0, B.oz).clone(), null, ZERO); }
        else this.move(E, _c.set(B.ox, 0, B.oz).clone(), null, E.vel);
        this.push(B);
      }
    } else if (dist > OUT) {
      // on s'en va : une nouvelle bulle, à l'endroit où l'on est
      const c = this.toRel(B, E.pos, new THREE.Vector3()), v = _a.copy(E.vel).applyQuaternion(B.Q).add(B.v).clone();
      const N = this.newBubble(B.ref, c, B.Q, v);
      this.move(E, new THREE.Vector3(N.ox, 0, N.oz), null, ZERO);
      return;
    }
    // (de temps en temps : une bulle ou un astéroïde à portée ?)
    if (solo && !B.anchored && this.joinTime) this.tryJoin(E, B);
  }
  isSolo(B, E) {
    const { structs, player, net } = this.g;
    for (const s of structs.list) if (s !== E.s && this.idAt(s.pos.x, s.pos.z) === B.id) return false;
    if (E.s && !this.aboard(player, E.s) && this.idAt(player.pos.x, player.pos.z) === B.id) return false;
    for (const p of net.otherPlayers()) {
      if (this.idAt(p.pos.x, p.pos.z) !== B.id) continue;
      if (!E.s || !this.aboard(p, E.s)) return false;
    }
    return true;
  }
  tryJoin(E, B) {
    const abs = this.toAbs(B, E.pos, new THREE.Vector3()), V = _a.copy(E.vel).applyQuaternion(B.Q).add(B.v).clone();
    for (const O of this.spaces.values()) {
      if (O === B || O.rock || O.ref !== B.ref) continue;
      if (!O.anchored && !this.liveIds.has(O.id) && !this.g.structs.list.some((s) => this.idAt(s.pos.x, s.pos.z) === O.id)) continue;
      const po = this.bp[O.ref], d = Math.hypot(abs.x - po.x - O.c.x, abs.y - po.y - O.c.y, abs.z - po.z - O.c.z);
      if (d < JOIN && _b.copy(V).sub(O.v).length() < JOIN_SPEED) { this.join(E, B, O, abs, V); return; }
    }
    if (B.ref !== 'star' || !inBelt(abs.x, abs.y, abs.z)) return;
    for (const R of rocksNear(abs.x, abs.y, abs.z, 1, [])) {
      const d = Math.hypot(R.x - abs.x, R.y - abs.y, R.z - abs.z);
      if (d < R.ry + ROCK_PAD && V.length() < JOIN_SPEED) {
        const s = rockSlot(R.a, R.b, R.c, R.m), T = rockOfQR(s.q0, s.r0);
        if (T) this.join(E, B, this.rockBubble(T), abs, V);
        return;
      }
    }
  }
  join(E, B, O, abs, V, quiet = false) {
    const inv = O.Q.clone().invert(), po = this.bp[O.ref];
    const l = new THREE.Vector3(abs.x - po.x - O.c.x, abs.y - po.y - O.c.y, abs.z - po.z - O.c.z).applyQuaternion(inv);
    const v = V.clone().sub(O.v).applyQuaternion(inv);
    this.move(E, new THREE.Vector3(O.ox + l.x, l.y, O.oz + l.z), inv.multiply(B.Q), v);
    if (!quiet) this.flash('#02040a');
  }
  // ---------- Saut nédrolytique (ou vol très rapide en créatif) : la bulle file ----------
  // (seul dans sa bulle, sinon on en prend une pour soi)
  startWarp(E, B, v0, double) {
    if (!this.isSolo(B, E) || B.anchored) {
      const c = this.toRel(B, E.pos, new THREE.Vector3()), V = _a.copy(E.vel).applyQuaternion(B.Q).add(B.v).clone();
      B = this.newBubble(B.ref, c, B.Q, V);
      this.move(E, new THREE.Vector3(B.ox, 0, B.oz), null, ZERO);
    }
    return { t: 0, v: v0, v0, double };
  }
  toggleJump(s) {
    if (this.g.net.isClient) { this.g.net.csend({ t: 'rkj', id: s.id }); return; }
    const { rockets, toast } = this.g, B = this.bubbleAt(s.pos.x, s.pos.z);
    if (!B) { toast('Le saut ne marche que dans l\'espace'); return; }
    if (s.warp) { this.endWarp({ s, pos: s.pos, vel: s.vel }, B, 'Sortie du saut'); return; }
    if (this.inside) { toast("Sous l'horizon, il n'y a plus de chemin vers l'extérieur"); return; }
    if (!s.rocket?.armed) { toast('Le réacteur n\'est pas armé : sans nédrolytium contre lui, il ne peut pas sauter'); return; }
    const fuel = rockets.fuel(s);
    if (fuel < JUMP_START) { toast('Les réservoirs sont presque vides : le réacteur ne s\'allume pas'); return; }
    rockets.setFuel(s, fuel - JUMP_START);
    s.warp = this.startWarp({ s, pos: s.pos, vel: s.vel }, B, JUMP_V0, JUMP_DOUBLE);
    s.throttle = 0;
    toast('Saut nédrolytique ! Les moteurs passent en mode saut (J pour en sortir)');
  }
  endWarp(E, B, why) {
    const w = E.s ? E.s.warp : this.warpFly;
    if (!w) return;
    if (E.s) E.s.warp = null; else this.warpFly = null;
    B.wv = null;
    this.rebase(B, true);
    // (on s'accroche à l'astre le plus proche, avec un peu d'élan vers l'avant)
    B.v.copy(this.warpDir(E, B, _a)).multiplyScalar(E.s ? 300 : 0);
    this.push(B);
    if (why) this.g.toast(why);
  }
  warpDir(E, B, out) {
    if (E.s) return out.set(0, 1, 0).applyQuaternion(E.s.quat).applyQuaternion(B.Q);
    const { player } = this.g, cp = Math.cos(player.pitch);
    return out.set(-Math.sin(player.yaw) * cp, Math.sin(player.pitch), -Math.cos(player.yaw) * cp).applyQuaternion(B.Q);
  }
  stepWarp(E, B, w, dt) {
    const { rockets } = this.g;
    w.t += dt;
    // Vers un astre d'un autre système (le repère, touche N) : le saut se guide tout seul, et ne
    // connaît plus de limite de vitesse qu'en arrivant (il freine en approchant).
    if (w.far === undefined) {
      const T = this.target && BODY[this.target], A = this.toAbs(B, E.pos, new THREE.Vector3());
      w.far = T && systemOf(T) !== systemNear(A, this.day, this.g.seed()) ? T : null;
      if (w.far) this.g.toast('Saut interstellaire vers ' + w.far.name);
    }
    if (E.s) {
      const fuel = Math.max(0, rockets.fuel(E.s) - JUMP_BURN * dt);
      rockets.setFuel(E.s, fuel);
      if (fuel <= 0) { this.endWarp(E, B, 'Plus de carburant : le saut s\'éteint'); return; }
    }
    const n = this.warpDir(E, B, new THREE.Vector3()), p = this.toAbs(B, E.pos, new THREE.Vector3());
    // (la même règle, avec ou sans cible : plus l'astre le plus proche est loin, plus on peut aller
    // vite ; on ralentit tout seul en s'approchant de n'importe quel astre)
    let clear = Infinity;
    for (const b of ALL) {
      if (b === w.far) continue;
      const o = this.bp[b.id];
      clear = Math.min(clear, Math.hypot(o.x - p.x, o.y - p.y, o.z - p.z) - this.safeOf(b, E));
    }
    let vmax = Math.min(INTER_VMAX, Math.max(JUMP_VMAX, 2 * clear));
    if (w.far) {
      const o = this.bp[w.far.id], d = n.set(o.x - p.x, o.y - p.y, o.z - p.z).length();
      n.divideScalar(d);
      vmax = Math.min(vmax, Math.max(JUMP_V0, 2 * (d - this.safeOf(w.far, E, true))));
    }
    w.v = Math.min(vmax, w.v0 * 2 ** (w.t / w.double));
    // un astre droit devant, sur le chemin de cette image : sa gravité casse le saut à quelques
    // rayons de lui (on peut sauter en s'éloignant d'une planète, ou la frôler)
    let step = w.v * dt, hit = null;
    for (const b of ALL) {
      const o = this.bp[b.id], safe = this.safeOf(b, E, b === w.far);
      _a.set(o.x - p.x, o.y - p.y, o.z - p.z);
      const along = _a.dot(n);
      if (along <= 0 || along - safe > step) continue;
      const side = Math.sqrt(Math.max(0, _a.lengthSq() - along * along));
      if (side > safe) continue;
      const stop = Math.max(0, along - Math.sqrt(safe * safe - side * side));
      if (stop < step) { step = stop; hit = b; }
    }
    B.c.addScaledVector(n, step);
    B.wv = n.multiplyScalar(w.v);
    // (le vaisseau a pu dériver dans sa bulle : on le ramène au centre)
    if (E.pos.y < SINK || Math.hypot(E.pos.x - B.ox, E.pos.y, E.pos.z - B.oz) > ABSORB) {
      B.c.add(_a.set(E.pos.x - B.ox, E.pos.y, E.pos.z - B.oz).applyQuaternion(B.Q));
      this.move(E, new THREE.Vector3(B.ox, 0, B.oz), null, E.vel);
    }
    this.rebase(B);
    if (hit) this.endWarp(E, B, hit === w.far ? 'Arrivée : ' + hit.name : 'La gravité ' + de(hit.name) + ' casse le saut');
  }
  // La distance à laquelle un astre casse le saut (un trou noir : bien avant ; à pied en créatif, on peut aller le voir de plus près)
  // (en créatif, aucune sécurité : le saut ne s'arrête qu'à l'horizon, sauf si c'est la destination)
  safeOf(b, E, goal = false) {
    if (b.kind === 'hole' && !goal && !this.g.survival().on) return b.R;
    return b.R * (b.kind === 'hole' ? (E.s ? 12 : 3.5) : b.kind === 'star' ? 4 : 3) + 15000;
  }

  // ---------- Les astres qui comptent : se poser, s'écraser, brûler ----------
  hazards(E, B) {
    const p = this.toAbs(B, E.pos, _c).clone(), V = _a.copy(E.vel).applyQuaternion(B.Q).add(B.v).clone();
    for (const b of ALL) {
      const o = this.bp[b.id], rel = _a.set(p.x - o.x, p.y - o.y, p.z - o.z), d = rel.length(), alt = d - b.R;
      if (alt > b.R + 2000) continue;
      if (b.kind === 'hole') {
        if (this.g.survival().on) { if (d < b.R * 1.02) { this.lost(E, B, b, rel, 'hole'); return true; } continue; }
        // créatif : on passe l'horizon, et rien ne ressort. Au centre : la singularité
        if (d < b.R) {
          if (!E.s && !this.inside) { this.inside = b.id; this.g.toast('Horizon ' + de(b.name) + ' franchi : plus rien n\'en ressort, même la lumière'); }
          if (d < b.R * 0.05) { this.singularity(E, B, b); return true; }
        }
      } else if (b.kind === 'star') {
        if (alt < b.R * 0.05) { this.lost(E, B, b, rel, 'star'); return true; }
      } else if (b.land) {
        // (en arrivant près d'une tour qui monte jusqu'ici : on est au-dessus de la carte, à côté d'elle)
        if (alt >= ENTRY_ALT && alt < 200000 && B.ref === b.id && this.g.world.highs.size) {
          const dirM = _a.copy(rel).normalize().applyQuaternion(bodyQ(b, _bq).invert()), w = dirToWorld(dirM, spanOf(b));
          if (this.g.world.highNear(w.x + (b.kind === 'home' ? 0 : bodyZone(b.id)) * ZONE, GROUND_Y + alt, w.z, TOWER_LAND_R)) { this.descend(E, B, b, _b.set(p.x - o.x, p.y - o.y, p.z - o.z).clone(), alt); return true; }
          _a.set(p.x - o.x, p.y - o.y, p.z - o.z);
        }
        if (alt < ENTRY_ALT) {
          const vr = B.ref === b.id ? V.dot(rel) / d : -1;
          if (vr < 0) { this.descend(E, B, b, rel.clone(), alt); return true; }
        }
      } else if (alt < -b.R * 0.03) { this.lost(E, B, b, rel, 'pressure'); return true; }
    }
    return false;
  }
  // Créatif : la singularité d'un trou noir. La fusée y disparaît ; le joueur se réveille au-dessus d'Hexa
  singularity(E, B, b) {
    const { structs, toast } = this.g;
    if (E.s) { toast('La fusée a été broyée par la singularité ' + de(b.name)); structs.remove(E.s); return; }
    this.inside = null;
    this.g.canvas.style.filter = '';
    const msg = 'La singularité ' + de(b.name) + ' t\'a avalé... Tu te réveilles au-dessus d\'Hexa';
    toast(msg);
    setTimeout(() => toast(msg), 1600); // (après le nom de la planète, à l'arrivée)
    this.flash('#000');
    B.v.set(0, 0, 0);
    this.descend(E, B, BODY.hexa, new THREE.Vector3(0, 1, 0), ENTRY_ALT - 10);
  }
  // Sous l'horizon (créatif) : tout va vers le centre, il n'y a plus de chemin vers l'extérieur
  insideHole(dt) {
    const b = BODY[this.inside], { player, canvas } = this.g;
    const B = this.inVoid && !this.transit ? this.bubbleAt(player.pos.x, player.pos.z) : null;
    if (!b || !B || B.ref !== b.id || this.g.survival().on) { this.inside = null; canvas.style.filter = ''; return; }
    this.warpFly = null;
    B.hold = false; B.wv = null; B.anchored = false;
    const d = B.c.length();
    if (d > b.R * 0.999) B.c.setLength(b.R * 0.999);
    // (la chute jusqu'au centre : quelques secondes de noir de plus en plus profond)
    const out = B.v.dot(B.c) / Math.max(1, d);
    if (out > -b.R / 4) B.v.addScaledVector(B.c, (-b.R / 4 - out) / Math.max(1, d));
    if (B.v.length() > b.R / 4) B.v.setLength(b.R / 4);
    canvas.style.filter = 'brightness(' + Math.max(0.08, Math.min(1, d / b.R) ** 2).toFixed(3) + ') saturate(0.4) hue-rotate(-30deg)';
  }
  // L'étoile, le fond d'une géante : en créatif, rien ne casse ; on y est repoussé
  lost(E, B, b, rel, cause) {
    const { structs, survival, toast } = this.g;
    const creative = !survival().on;
    if (creative) {
      const need = b.kind === 'hole' ? b.R * 2 : b.kind === 'star' ? b.R * 1.08 : b.R * 0.98;
      if (cause === 'hole') toast('Horizon de ' + b.name + ' : en créatif, tu en es recraché. En survie, rien n\'en revient');
      B.ref = b.id;
      B.c.copy(rel).setLength(need);
      B.v.set(0, 0, 0);
      this.push(B);
      return;
    }
    if (cause === 'hole') {
      toast((E.s ? 'La fusée a' : 'Tu as') + ' franchi l\'horizon ' + de(b.name) + '. Rien n\'en revient');
      if (E.s) structs.remove(E.s); else survival().damage(9999);
      return;
    }
    if (E.s) {
      toast(cause === 'star' ? 'La fusée a brûlé dans ' + b.name : 'La pression ' + de(b.name) + ' a écrasé la fusée');
      structs.remove(E.s);
      return;
    }
    toast(cause === 'star' ? 'Tu as brûlé dans ' + b.name : 'La pression ' + de(b.name) + ' t\'a écrasé');
    survival().damage(9999);
  }

  // Poser un bloc dans une bulle : elle s'ancre (une station ne tombe pas)
  anchorAt(q, r) {
    if (this.transit) return; // (le long d'une ligne spatiale : pas une bulle)
    const x = q + r / 2, z = r * SQ3, B = this.bubbleAt(x, z);
    if (!B || B.anchored) return;
    const H = BODY[B.ref];
    if (H?.kind === 'hole' && B.c.length() < H.R * 6) { this.g.toast('Rien ne tient si près ' + de(H.name) + ' : ce bloc tombe avec toi'); return; }
    B.anchored = true;
    B.v.set(0, 0, 0);
    B.hold = false;
    B.wv = null;
    this.push(B);
    if (this.bubbleAt(this.g.player.pos.x, this.g.player.pos.z) === B) this.g.toast('Ancré ici : ce coin d\'espace ne bouge plus, il est gardé dans la partie');
  }

  // Changer d'astre de référence (on entre ou sort d'une sphère d'influence)
  rebase(B, now = false) {
    if (B.rock || (!now && (B.soiT = (B.soiT || 0) + 1) % 8)) return;
    const o = this.bp[B.ref], abs = _a.set(o.x + B.c.x, o.y + B.c.y, o.z + B.c.z), id = soiAt(abs, this.day, this.g.seed());
    if (id === B.ref) return;
    const n = this.bp[id];
    B.c.set(abs.x - n.x, abs.y - n.y, abs.z - n.z);
    B.v.add(this.bodyVel(B.ref, _b)).sub(this.bodyVel(id, _b));
    B.ref = id;
  }

  // ---------- À chaque image ----------
  // (l'hôte : les commandes des pilotes invités, avant la physique)
  hostPilots(dt) {
    const { net, rockets, structs } = this.g;
    for (const p of net.proxies()) {
      const P = p.pilot;
      if (!P) continue;
      if (!structs.list.includes(P.s)) { p.pilot = null; continue; }
      const b = P.b | 0;
      rockets.control(P.s, {
        up: b & 1, down: b & 2, left: b & 4, right: b & 8, cut: b & 16, tiltF: b & 32, tiltB: b & 64, tiltL: b & 128, tiltR: b & 256,
        aim: this.aimFor(P.s, b & 512 ? 1 : b & 1024 ? -1 : 0), toggleLevel: !!P.level, toggleFA: !!P.fa,
      }, P.yaw || 0, dt, P.pitch || 0);
      P.level = P.fa = false;
    }
  }
  // R / F dans l'espace : le nez vers l'avant ou l'arrière de la trajectoire
  aimFor(s, sign) {
    if (!sign) return null;
    const B = this.bubbleAt(s.pos.x, s.pos.z);
    if (!B) return null;
    const v = new THREE.Vector3().copy(B.v).applyQuaternion(_q.copy(B.Q).invert()).add(s.vel);
    if (v.lengthSq() < 1) return null;
    return v.normalize().multiplyScalar(sign);
  }

  update(dt) {
    if (!this.on) return;
    const { player, net, structs } = this.g, seed = this.g.seed();
    this.day = this.g.day();
    clock.day = this.day; clock.seed = seed;
    for (const id of NAMES) bodyPos(id, this.day, seed, this.bp[id]);
    this.stepOrbits();
    this.stepTransit(dt);
    // quelles bulles sont habitées ?
    this.liveIds.clear();
    const addLive = (p) => { const id = this.idAt(p.x, p.z); if (id) this.liveIds.add(id); };
    addLive(player.pos);
    for (const p of net.otherPlayers()) addLive(p.pos);
    // les bulles avancent : en chute libre autour de leur astre
    const me = this.me;
    for (const B of this.spaces.values()) {
      if (B.anchored || !this.liveIds.has(B.id)) continue;
      if (B.wv) { if (B.owner !== me) B.c.addScaledVector(B.wv, dt); continue; }
      const b = BODY[B.ref], d = B.c.length(), hole = b.kind === 'hole';
      // (même en volant, on ne résiste plus sous la dernière orbite stable d'un trou noir)
      if (d > 1 && (!B.hold || (hole && d < b.R * 3))) {
        if (hole) this.fall(B, b, d, dt);
        else B.v.addScaledVector(_a.copy(B.c).divideScalar(-d), G_K * (b.gravity || 0) * (b.R / d) ** 2 * dt);
      }
      B.c.addScaledVector(B.v, dt);
      this.rebase(B);
    }
    this.joinTime = (this.clock.join -= dt) <= 0;
    if (this.joinTime) this.clock.join = 0.25;
    this.syncZone();

    // ce qui porte le joueur s'occupe de lui (ce que simule l'hôte : voir plus bas)
    const carrier = player.pilot?.s || player.attached || player.standingOn || null;
    if (net.isClient) {
      // (l'hôte a besoin de savoir qui est à bord de quoi)
      const id = carrier ? carrier.id : 0;
      if (id !== this.onId) { this.onId = id; net.csend({ t: 'rkon', id }); }
    }
    const ship = !carrier && this.inVoid ? structs.list.find((s) => this.aboard(player, s)) : null, inside = !!ship;
    this.rideS = ship; // (celui-là compte comme à bord pour toute cette image, même tout au bord de sa coque)
    this.keepHold(carrier, dt);
    // (on flotte à bord : le vaisseau nous emmène, sinon il repartirait sans nous)
    if (ship && !player.riding && !this.transit) player.pos.addScaledVector(ship.vel, dt);
    if (!player.riding && !this.transit && !carrier && !inside && !this.g.survival().dead) {
      const E = { s: null, pos: player.pos, vel: player.vel };
      if (this.zone >= 0) {
        // (sur une tour ou près d'elle, on reste sur la carte : l'espace commence en s'en éloignant)
        if (player.pos.y > SPACE_Y && player.vel.y > -1 && !this.g.world.highNear(player.pos.x, player.pos.y, player.pos.z, TOWER_R)) this.ascend(E, this.zone);
      } else {
        const B = this.bubbleAt(player.pos.x, player.pos.z);
        if (B) {
          this.creativeWarp(E, B, dt);
          this.stepFree(E, B, dt);
        }
      }
    }
    // les objets qui portent quelqu'un (l'hôte s'en occupe, pour tout le monde)
    if (!net.isClient) {
      for (const s of structs.list) {
        if (s.orbHold || (s !== ship && !this.occupied(s))) continue;
        const k = zoneOfXZ(s.pos.x, s.pos.z), E = { s, pos: s.pos, vel: s.vel };
        if (k >= 0) { if (s.pos.y > SPACE_Y && s.vel.y > 0 && !this.g.world.highNear(s.pos.x, s.pos.y, s.pos.z, TOWER_R)) this.ascend(E, k); continue; }
        const B = this.bubbleAt(s.pos.x, s.pos.z);
        if (B) this.stepFree(E, B, dt);
      }
      this.pilotReports(dt);
    }
    // ce que je possède : les autres le suivent
    if ((this.clock.push -= dt) <= 0) {
      this.clock.push = 0.5;
      if (net.active) {
        if (net.isHost) for (const B of this.spaces.values()) if (!B.rock && !net.hasPid?.(B.owner)) B.owner = 0;
        for (const B of this.spaces.values()) if (!B.rock && !B.anchored && B.owner === me && this.liveIds.has(B.id)) this.g.net.sendSpace?.(this.pack(B));
      }
    }
    if (this.zone >= 0) {
      if (!this.deck) player.gravity = fade(zoneBody(this.zone), player.pos.y);
      if (player.pos.y > SPACE_Y && !this.deck && !player.riding) {
        if (!this.towerNote) { this.towerNote = true; this.g.toast('Plus de gravité ici. Éloigne-toi de la tour pour partir dans l\'espace'); }
      } else if (player.pos.y < SPACE_Y - 40) this.towerNote = false;
    }
    this.holeFx(dt);
    if (this.inside) this.insideHole(dt);
    this.jumpFlashes(dt);
    this.updateSky(dt);
    this.updateHud(dt);
  }
  // Les sauts vus de loin : une bulle qui part en saut (ou qui en sort) fait un éclair de lumière
  // (violet pâle, comme les flammes des moteurs en saut), visible depuis les planètes ; pendant le
  // saut, un petit point lumineux file dans le ciel. Pas celle où l'on est : on y est déjà.
  jumpFlashes(dt) {
    const view = this.g.sky?.view;
    if (!view) return;
    const fx = (this.jfx ||= []), was = (this.jwas ||= new Map()), mine = this.idAt(this.g.player.pos.x, this.g.player.pos.z);
    // (rx, ry, rz : l'écart à son astre, voir skyview.placeFlashes ; pas pour l'étoile)
    const at = (ref, c) => { const o = this.bp[ref]; return { x: o.x + c.x, y: o.y + c.y, z: o.z + c.z, ...(ref !== 'star' ? { rx: c.x, ry: c.y, rz: c.z } : {}) }; };
    const live = [];
    for (const B of this.spaces.values()) {
      if (B.rock || B.ruin) continue;
      const on = !!B.wv, before = was.get(B.id) || false;
      if (on !== before) {
        was.set(B.id, on);
        // (gardé par rapport à son astre : l'éclair reste là où le saut a commencé)
        if (B.id !== mine) fx.push({ ref: B.ref, c: B.c.clone(), t: 0, life: on ? 1.8 : 1.2, size: on ? 0.16 : 0.11 });
      }
      if (on && B.id !== mine) live.push({ ...at(B.ref, B.c), size: 0.035, k: 1, color: '#d9ccff' });
    }
    const out = [];
    for (let i = fx.length - 1; i >= 0; i--) {
      const f = fx[i];
      f.t += dt;
      if (f.t >= f.life) { fx.splice(i, 1); continue; }
      const u = f.t / f.life;
      // (il s'allume d'un coup, gonfle, puis s'éteint)
      const k = u < 0.05 ? 0.4 + 12 * u : (1 - u) ** 1.4;
      out.push({ ...at(f.ref, f.c), size: f.size * (0.5 + u), k, color: '#f1ebff' });
    }
    view.flashes = out.concat(live);
  }
  occupied(s) {
    const { player, net } = this.g;
    return this.aboard(player, s) || net.proxies().some((p) => this.aboard(p, s));
  }
  // Créatif, en volant : on reste où l'on est, même à côté de son vaisseau (mais on ne décide pas
  // pour les autres joueurs de la bulle). Aux commandes d'un vaisseau, c'est lui qui vole.
  keepHold(carrier, dt) {
    const { player, net } = this.g;
    if (!this.inVoid || this.transit || player.riding) return;
    const B = this.bubbleAt(player.pos.x, player.pos.z);
    if (!B || B.anchored || B.rock || B.wv) return;
    for (const p of net.otherPlayers()) if (this.idAt(p.pos.x, p.pos.z) === B.id) return;
    const hold = !carrier && !!player.fly;
    if (hold !== B.hold) { B.hold = hold; this.push(B); }
    if (hold) B.v.multiplyScalar(Math.exp(-2 * dt));
  }
  // La trajectoire retombe-t-elle sur l'astre ? null : non ; sinon le temps avant l'arrivée (s), -1 si on monte encore
  impact(B) {
    const b = BODY[B.ref];
    if (B.hold || B.anchored || B.rock || B.wv || !b?.land) return null;
    const r = B.c.length(), mu = G_K * b.gravity * b.R * b.R, E = B.v.lengthSq() / 2 - mu / r, vr = B.c.dot(B.v) / r;
    const h2 = _a.crossVectors(B.c, B.v).lengthSq(), e = Math.sqrt(Math.max(0, 1 + (2 * E * h2) / (mu * mu)));
    if (h2 / mu / (1 + e) > b.R + ENTRY_ALT || (E >= 0 && vr >= 0)) return null;
    return vr < 0 ? Math.max(0, r - b.R - ENTRY_ALT) / -vr : -1;
  }
  // Créatif, en volant : Ctrl tenu en avançant, on file (la vitesse double chaque seconde)
  creativeWarp(E, B, dt) {
    const { player, survival } = this.g, want = !survival().on && player.fly && player.sprint && !this.inside;
    this.flyHeld = want ? this.flyHeld + dt : 0;
    if (!this.warpFly && this.flyHeld > 0.5) this.warpFly = this.startWarp(E, B, FLY_V0, FLY_DOUBLE);
    if (this.warpFly && !want) this.endWarp(E, this.bubbleAt(player.pos.x, player.pos.z) || B);
  }
  // Ce qu'un pilote invité voit au tableau de bord
  pilotReports(dt) {
    const { net, rockets } = this.g;
    if (!net.isHost || (this.clock.rkh -= dt) > 0) return;
    this.clock.rkh = 0.2;
    for (const c of net.clients?.values() || []) {
      const s = c.proxy?.pilot?.s;
      if (!s) continue;
      const h = rockets.hud(s);
      if (h) net.sendTo(c.cid, { t: 'rkh', f: h.fuel, c: h.cap, h: h.throttle, v: h.v, vy: h.vy, g: !!s.warp });
    }
  }

  // ---------- Un trou noir ----------
  // La chute : sa gravité, le disque qui entraîne l'espace avec lui, et jamais plus vite que la lumière
  fall(B, b, d, dt) {
    const g = holeG(b, d);
    B.v.addScaledVector(_a.copy(B.c).divideScalar(-d), g * dt);
    _a.set(0, 1, 0).applyAxisAngle(AXIS_Z, b.tilt || 0).cross(B.c).divideScalar(d);
    B.v.addScaledVector(_a, g * (b.R / d) * 0.5 * dt);
    const c = b.c * 0.995;
    if (B.v.lengthSq() > c * c) B.v.setLength(c);
  }
  // Ce qu'il fait à qui s'approche : le temps, les marées, le disque
  holeFx(dt) {
    const { player, camera, net, structs, canvas, toast } = this.g, sv = this.g.survival();
    let fx = null;
    if (this.inVoid && !this.transit) {
      const B = this.bubbleAt(player.pos.x, player.pos.z);
      if (B) {
        const abs = this.toAbs(B, camera.position, new THREE.Vector3());
        for (const b of HOLES) {
          const o = this.bp[b.id], rel = new THREE.Vector3(abs.x - o.x, abs.y - o.y, abs.z - o.z), r = rel.length();
          if (r < b.soi) { fx = { b, r, x: r / b.R, rel }; break; }
        }
      }
    }
    this.hole = fx;
    const x = fx ? fx.x : Infinity;
    // le temps : 1 / sqrt(1 - Rs / r). Dehors, tout va plus vite (seul : les autres joueurs n'y sont pour rien)
    const dil = fx ? (x > 1 ? Math.min(TIME_MAX, 1 / Math.sqrt(1 - 1 / x)) : TIME_MAX) : 1;
    if (fx) fx.dil = dil;
    this.dilation = net.active ? 1 : dil;
    // l'étirement : à l'écran, le long de la direction du trou
    const t = Math.max(0, Math.min(1, (3.5 - x) / 2.48));
    if (t > 0) {
      _b.copy(fx.rel).negate().applyQuaternion(_q.copy(this.bubbleAt(player.pos.x, player.pos.z).Q).invert()).applyMatrix4(_m.copy(camera.matrixWorldInverse).setPosition(0, 0, 0));
      const a = Math.atan2(-_b.y, _b.x);
      canvas.style.transform = `scale(${1 + 0.2 * t}) rotate(${a}rad) scaleX(${1 + 0.6 * t * t}) rotate(${-a}rad)`;
      this.stretched = true;
    } else if (this.stretched) { canvas.style.transform = ''; this.stretched = false; }
    if (!fx) { this.tideT = 0; return; }
    // le disque d'accrétion : plat, très chaud
    const y = _a.copy(fx.rel).applyAxisAngle(AXIS_Z, -(fx.b.tilt || 0)).y / fx.b.R, rd = Math.hypot(_a.x, _a.z) / fx.b.R;
    fx.disk = Math.abs(y) < 0.5 && rd > 3 && rd < 11;
    if (!sv.on || sv.dead) { this.tideT = 0; return; }
    // les marées : le corps est plus attiré par les pieds que par la tête
    if (x < 2.2 || fx.disk) {
      if (x < 2.2 && !this.tideNote) { this.tideNote = true; toast('Spaghettification : les marées ' + de(fx.b.name) + ' te déchirent'); }
      this.tideT = (this.tideT || 0) + dt;
      if (this.tideT >= 0.5) { this.tideT = 0; sv.damage(fx.disk ? 3 : Math.ceil(1 + 5 * t)); }
    } else { this.tideT = 0; this.tideNote = false; }
    if (x < 1.5 && !net.isClient) {
      for (const s of [...structs.list]) if (this.occupied(s) && zoneOfXZ(s.pos.x, s.pos.z) < 0) { toast('Les marées ' + de(fx.b.name) + ' ont déchiré la fusée'); structs.remove(s); }
    }
  }

  // ---------- Le ciel ----------
  updateSky(dt) {
    const { player, sky, camera } = this.g;
    if (this.inVoid) {
      const B = this.transit ? this.transitB : this.bubbleAt(player.pos.x, player.pos.z);
      if (!B) return;
      sky.fixedSun = sky.viewLocal = null;
      const abs = this.toAbs(B, camera.position, _a);
      sky.viewAt = { x: abs.x, y: abs.y, z: abs.z };
      sky.viewQ = B.Q;
      sky.viewSunK = this.transit?.sun ?? 0;
      // (les lignes spatiales se voient d'un bout à l'autre)
      const routes = sky.viewRoutes ||= [];
      routes.length = 0;
      for (const e of this.g.tracks.longs) { const c = this.curveOf(e); if (c) routes.push(c); }
      if ((this.clock.rocks -= dt) <= 0) {
        this.clock.rocks = 0.5;
        sky.viewRocks = B.ref === 'star' || B.rock ? rocksNear(abs.x, abs.y, abs.z, 1, []).filter((R) => !B.rock || R.k !== B.rock.k) : null;
      }
    } else {
      // très haut : la planète sous nos pieds, ronde, derrière le terrain
      const y = player.pos.y, b = zoneBody(this.zone);
      sky.viewBelow = y > 120 && b ? { id: b.id, alt: Math.max(1, y - GROUND_Y), Q: tangentQ(b, player.pos.x - this.zone * ZONE, player.pos.z, sky.viewBelow?.Q) } : null;
      // planète synchrone : son astre reste à sa place dans le ciel, selon l'endroit où l'on est
      if (b?.locked) {
        const inv = tangentQ(b, player.pos.x - this.zone * ZONE, player.pos.z, sky.viewLocal || new THREE.Quaternion()).invert(), o = this.bp[b.id], s = this.bp[sunOf(b).id];
        sky.viewLocal = inv;
        (sky.fixedSun ||= new THREE.Vector3()).set(s.x - o.x, s.y - o.y, s.z - o.z).normalize().applyQuaternion(inv);
      } else sky.fixedSun = sky.viewLocal = null;
    }
  }

  // ---------- Tableau de bord, repères ----------
  flash(color) {
    const v = this.veil();
    v.style.transition = 'none';
    v.style.background = color;
    v.style.opacity = '1';
    requestAnimationFrame(() => requestAnimationFrame(() => { v.style.transition = 'opacity 0.7s'; v.style.opacity = '0'; }));
  }
  veil() {
    this.buildDom();
    return this.dom.flash;
  }
  buildDom() {
    if (this.dom) return;
    if (!document.getElementById('sp-style')) {
      const st = document.createElement('style');
      st.id = 'sp-style';
      st.textContent = `
      #sp-marks { position: fixed; inset: 0; pointer-events: none; overflow: hidden; z-index: 6; color: #dce8f4; font: 12px/1.3 system-ui, sans-serif; }
      #sp-marks .m { position: absolute; left: 0; top: 0; white-space: nowrap; will-change: transform; }
      #sp-marks .m i { position: absolute; left: -7px; top: -7px; width: 12px; height: 12px; clip-path: polygon(25% 0, 75% 0, 100% 50%, 75% 100%, 25% 100%, 0 50%); background: rgba(160, 210, 255, 0.55); }
      #sp-marks .m span { position: absolute; left: 10px; top: -10px; color: #e8f2ff; text-shadow: 0 1px 2px #000; }
      #sp-marks .m small { position: absolute; left: 10px; top: 5px; color: #9ab4cc; text-shadow: 0 1px 2px #000; }
      #sp-marks .m.t i { background: #ffd060; }
      #sp-marks .m.t span { color: #ffd060; font-weight: 600; }
      #sp-marks .m.site i { background: #8affb0; }
      #sp-marks .m.site span { color: #b8ffd0; }
      #sp-panel { position: fixed; right: 12px; top: 12px; max-width: 320px; padding: 8px 12px; border-radius: 8px; z-index: 6; pointer-events: none; color: #dce8f4; font: 12px/1.45 system-ui, sans-serif; background: rgba(19, 23, 27, 0.78); border-left: 3px solid #3fd6ee; border-radius: 0; clip-path: polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 14px 100%, 0 calc(100% - 14px)); }
      #sp-panel .d { color: #9ab4cc; }
      #sp-panel b { color: #fff; }
      #sp-heat { position: fixed; inset: 0; z-index: 5; pointer-events: none; opacity: 0; }
      #sp-flash { position: fixed; inset: 0; z-index: 7; pointer-events: none; opacity: 0; }
      @media (max-width: 600px) { #sp-panel { font-size: 11px; right: 6px; top: 6px; max-width: 200px; } }`;
      document.head.appendChild(st);
    }
    const add = (id) => { const e = document.createElement('div'); e.id = id; document.body.appendChild(e); return e; };
    const marks = add('sp-marks'), panel = add('sp-panel'), heat = add('sp-heat'), flash = add('sp-flash');
    marks.hidden = panel.hidden = true;
    const els = {};
    for (const b of ALL) {
      const e = document.createElement('div');
      e.className = 'm';
      e.innerHTML = '<i></i><span></span><small></small>';
      e.children[1].textContent = b.name;
      marks.appendChild(e);
      els[b.id] = e;
    }
    this.dom = { marks, panel, heat, flash, els, sites: new Map() };
  }
  // Les panneaux du haut à droite (objectifs, ORA, tutoriel) passent sous celui-ci
  fitPanel() {
    const p = this.dom?.panel;
    document.documentElement.style.setProperty('--sp-h', p && !p.hidden ? p.offsetHeight + 10 + 'px' : '0px');
  }
  showDom(on) {
    if (!on && !this.dom) return;
    this.buildDom();
    this.dom.marks.hidden = this.dom.panel.hidden = !on;
    this.fitPanel();
    if (!on) this.dom.heat.style.opacity = '0';
    if (this.streaks) this.streaks.visible = false;
  }
  // N : le repère suivant (ses infos s'affichent)
  nextTarget() {
    if (!this.inVoid) return;
    const list = BODIES.map((b) => b.id).concat('star'), i = list.indexOf(this.target) + 1;
    this.target = i >= list.length ? null : list[i];
    this.clock.panel = 0;
  }
  // (position à l'écran d'une direction de la bulle : x, y en pixels, ou null si derrière nous)
  project(dir, W, H) {
    const { camera } = this.g;
    _b.copy(dir).applyMatrix4(_m.copy(camera.matrixWorldInverse).setPosition(0, 0, 0));
    if (_b.z >= -0.001) return null;
    const P = camera.projectionMatrix.elements, nx = (P[0] * _b.x) / -_b.z, ny = (P[5] * _b.y) / -_b.z;
    if (Math.abs(nx) > 1.02 || Math.abs(ny) > 1.02) return null;
    return [(nx * 0.5 + 0.5) * W, (-ny * 0.5 + 0.5) * H];
  }
  updateHud(dt) {
    if (!this.inVoid || !this.dom) return;
    const { player, camera, net } = this.g, B = this.transit ? this.transitB : this.bubbleAt(player.pos.x, player.pos.z);
    if (!B) return;
    const abs = this.toAbs(B, camera.position, new THREE.Vector3()), inv = _q.copy(B.Q).invert().clone(), W = innerWidth, H = innerHeight;
    const text = (this.clock.panel -= dt) <= 0;
    if (text) this.clock.panel = 0.25;
    let near = null;
    // (tous les astres, à toute distance ; de loin, ils se superposent : le plus gros garde son repère)
    const marks = [];
    for (const b of ALL) {
      const o = this.bp[b.id], d = Math.hypot(o.x - abs.x, o.y - abs.y, o.z - abs.z), alt = d - b.R;
      if (!near || alt < near.alt) near = { b, alt };
      marks.push({ b, o, d, alt, k: this.target === b.id ? Infinity : b.R / d * (b.kind === 'star' || b.kind === 'hole' ? 100 : b.kind === 'home' ? 10 : 1) });
    }
    marks.sort((x, y) => y.k - x.k);
    const shown = [];
    for (const { b, o, d, alt } of marks) {
      const el = this.dom.els[b.id];
      // (plus de 30 années-lumière : invisible, sauf l'astre visé avec N, pour pouvoir y sauter)
      if (d > 30 * LY && this.target !== b.id) { if (el.style.display !== 'none') el.style.display = 'none'; continue; }
      let s = this.project(_c.set(o.x - abs.x, o.y - abs.y, o.z - abs.z).divideScalar(d).applyQuaternion(inv), W, H);
      if (s && this.target !== b.id && shown.some((p) => Math.abs(p[0] - s[0]) < 16 && Math.abs(p[1] - s[1]) < 16)) s = null;
      if (!s) { if (el.style.display !== 'none') el.style.display = 'none'; continue; }
      shown.push(s);
      if (el.style.display === 'none') el.style.display = '';
      el.style.transform = `translate(${s[0]}px, ${s[1]}px)`;
      if (text) {
        el.classList.toggle('t', this.target === b.id);
        el.children[2].textContent = fmtD(Math.max(0, alt));
      }
    }
    const seen = new Set();
    for (const O of this.spaces.values()) {
      if (O === B || O.rock || !O.anchored || !this.bp[O.ref]) continue;
      const po = this.bp[O.ref], d = Math.hypot(po.x + O.c.x - abs.x, po.y + O.c.y - abs.y, po.z + O.c.z - abs.z);
      // (les coins d'espace construits et les stations : à toute distance)
      seen.add(O.id);
      let el = this.dom.sites.get(O.id);
      if (!el) {
        el = document.createElement('div');
        el.className = 'm site';
        el.innerHTML = '<i></i><span>Coin d\'espace</span><small></small>';
        this.dom.marks.appendChild(el);
        this.dom.sites.set(O.id, el);
      }
      const s = this.project(_c.set(po.x + O.c.x - abs.x, po.y + O.c.y - abs.y, po.z + O.c.z - abs.z).divideScalar(d).applyQuaternion(inv), W, H);
      if (text) el.children[1].textContent = O.siteName || 'Coin d\'espace';
      el.style.display = s ? '' : 'none';
      if (s) { el.style.transform = `translate(${s[0]}px, ${s[1]}px)`; if (text) el.children[2].textContent = fmtD(d); }
    }
    for (const [id, el] of this.dom.sites) if (!seen.has(id)) { el.remove(); this.dom.sites.delete(id); }
    // chaleur de l'étoile, nuages d'une géante
    // (la plus proche des étoiles : Hexa, PXT-A, PXT-C)
    let sR = STAR.R, altS = Infinity;
    for (const L of LIGHTS) {
      if (L.kind !== 'star') continue;
      const st = this.bp[L.id], a = Math.hypot(abs.x - st.x, abs.y - st.y, abs.z - st.z) - L.R;
      if (a / L.R < altS / sR) { altS = a; sR = L.R; }
    }
    const gas = near && near.b.bands ? near.alt / near.b.R : 1;
    const hot = this.hole?.disk ? 0.75 : altS < sR * 0.4 ? Math.min(0.9, 1 - altS / (sR * 0.4)) : 0, deep = gas < 0.01 ? Math.min(0.95, -gas / 0.03 + 0.3) : 0;
    const heat = this.dom.heat;
    if (hot > 0) { heat.style.background = 'radial-gradient(ellipse at 50% 60%, rgba(255,190,90,.2), rgba(255,90,20,.85) 70%, #000 100%)'; heat.style.opacity = hot; }
    else if (deep > 0) { heat.style.background = 'radial-gradient(ellipse at 50% 50%, rgba(160,100,50,.5), rgba(40,20,10,.95) 80%)'; heat.style.opacity = deep; }
    else if (heat.style.opacity !== '0') heat.style.opacity = '0';
    this.drawStreaks(B, inv, dt);
    if (!text) return;
    const s = player.pilot?.s, rel = s && !net.isClient ? s.vel : s ? ZERO : player.vel;
    if (this.transit) {
      const T = this.transit, to = zoneBody(T.to), html = `<div><b>Ligne spatiale</b> vers ${to.name}</div><div>Vitesse ${fmtV(T.speed)}</div><div>Reste ${fmtD(T.left)}</div>`
        + `<div class="d">${!player.riding ? `Reste à moins de ${LINE_R} blocs de la voie, ou c'est le vide` : T.speed > 1 ? 'Recule pour freiner' : 'À l\'arrêt : avance pour repartir'}</div>`;
      if (html !== this.lastPanel) { this.dom.panel.innerHTML = html; this.lastPanel = html; this.fitPanel(); }
      return;
    }
    const warp = B.wv ? B.wv.length() : 0;
    const v = warp || _a.copy(rel).applyQuaternion(B.Q).add(B.v).length();
    const ref = BODY[B.ref];
    let html = `<div><b>${warp ? 'Saut' : 'Dans l\'espace'}</b></div><div>Vitesse ${fmtV(v)}${B.ref !== 'star' && !warp ? ' <span class="d">(par rapport à ' + ref.name + ')</span>' : ''}</div>`
      + `<div>${fmtD(Math.max(0, near.alt))} au-dessus ${de(near.b.name)}</div>`
      + `<div class="d">${B.siteName ? B.siteName : B.rock ? 'Sur un astéroïde' : B.anchored ? 'Coin d\'espace ancré' : B.ref === 'star' ? 'Entre les planètes' : 'Dans l\'attraction ' + de(ref.name)}</div>`;
    const fall = this.impact(B);
    if (fall !== null) {
      html += `<div style="color:#ff9060;margin-top:6px"><b>Pas en orbite</b> : retombée sur ${ref.name}${fall >= 0 ? ' dans ' + Math.ceil(fall) + ' s' : ''}</div>`;
      if (fall >= 0 && fall < 12 && !this.fallNote) { this.fallNote = true; this.g.toast('Attention : tu retombes sur ' + ref.name); }
    } else this.fallNote = false;
    if (this.hole && this.hole.x < 60) {
      const h = this.hole, c = h.b.c, esc = h.x > 1 ? Math.min(1, Math.sqrt(1 / h.x)) : 1;
      const zone = h.x < 1.5 ? 'Sous la sphère de photons : même la lumière y tombe' : h.x < 3 ? 'Sous la dernière orbite stable : plus aucune orbite possible' : h.x < 12 ? 'Attraction très forte' : '';
      html += `<div style="margin-top:6px"><b style="color:#ffb070">Horizon : ${fmtD(Math.max(0, h.r - h.b.R))}</b></div>`
        + `<div>Temps : 1 s pour toi = ${h.dil >= DAY ? (h.dil / DAY).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' jours' : h.dil >= 10 ? Math.round(h.dil).toLocaleString('fr-FR') + ' s' : h.dil.toFixed(2) + ' s'} dehors${h.x <= 1 ? ' (sous l\'horizon)' : ''}</div><div class="d">Vitesse de libération : ${fmtV(esc * c)} (${Math.round(esc * 100)} % de la lumière)</div>`
        + (zone ? `<div style="color:#ff9060">${zone}</div>` : '');
    }
    // le coin d'espace le plus proche (moins de 20 k blocs) : sa distance, et notre vitesse par rapport
    // à lui (une station en orbite file autour de son astre : arrêté par rapport à l'astre, on la
    // verrait passer sans pouvoir l'approcher)
    if (!warp) {
      let O = null, od = 20000;
      for (const X of this.spaces.values()) {
        if (X.rock || !X.anchored || !this.bp[X.ref]) continue;
        const po = this.bp[X.ref], d = X === B ? 0 : Math.hypot(po.x + X.c.x - abs.x, po.y + X.c.y - abs.y, po.z + X.c.z - abs.z);
        if (d < od) { od = d; O = X; }
      }
      if (O) {
        const vr = O === B ? rel.length() : _a.copy(rel).applyQuaternion(B.Q).add(B.v).add(this.bodyVel(B.ref, _b)).sub(O.v).sub(this.bodyVel(O.ref, _b)).length();
        const name = O.siteName || 'Coin d\'espace';
        html += `<div style="margin-top:6px"><b style="color:#9fe0ff">${name}</b>${O === B ? ' : ici' : ' : ' + fmtD(od)}</div>`
          + `<div${vr > 30 ? ' style="color:#ffb070"' : ''}>Vitesse par rapport à lui : ${fmtV(vr)}${vr > 30 ? ' (ajuste ta vitesse pour t\'y arrêter)' : ''}</div>`;
      }
    }
    if (this.target) {
      const T = BODY[this.target], o = this.bp[T.id], d = Math.hypot(o.x - abs.x, o.y - abs.y, o.z - abs.z) - T.R;
      const info = T.kind === 'star' ? '' : T.kind === 'hole' ? 'Rien ne revient de l\'horizon' : T.land ? `${T.locked ? 'Air respirable au crépuscule seulement' : T.atmo?.breath ? 'Air respirable' : T.atmo?.density > 0.05 ? 'Air irrespirable' : 'Pas d\'air'} · gravité ×${T.gravity} · ${T.temp} °C` : 'Géante : pas de sol';
      html += `<div style="margin-top:6px"><b style="color:#ffd060">${T.name}</b> : ${fmtD(Math.max(0, d))}</div><div class="d">${T.desc || ''}</div><div class="d">${info}</div>`;
      if (systemOf(T) !== systemNear(abs, this.day, this.g.seed())) html += `<div style="color:#ffd060">Autre système : le saut (J) s'y guide tout seul, environ ${Math.max(1, Math.round(d / INTER_VMAX / 60))} min</div>`;
    }
    html += `<div class="d" style="margin-top:6px">${s ? 'Z / S : gaz · J : saut · R / F : nez vers l\'avant, l\'arrière · Maj : se lever' : player.fly ? 'Ctrl en avançant : filer · N : repère' : 'Z Q S D, Espace, Maj : se déplacer · N : repère'}</div>`;
    if (html !== this.lastPanel) { this.dom.panel.innerHTML = html; this.lastPanel = html; this.fitPanel(); }
  }
  // Saut : des traînées de lumière le long de la route
  drawStreaks(B, inv, dt) {
    const { scene, camera } = this.g;
    // (elles n'apparaissent qu'à grande vitesse, peu à peu)
    const fast = B.wv ? Math.min(1, B.wv.length() / 40000) : 0;
    if (fast < 0.02) { if (this.streaks) this.streaks.visible = false; return; }
    if (!this.streaks) {
      const n = 220, p = new Float32Array(n * 6);
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, r = 5 + Math.random() * 60, y = Math.random() * 300 - 150, l = 10 + Math.random() * 40;
        p.set([Math.cos(a) * r, y, Math.sin(a) * r, Math.cos(a) * r, y + l, Math.sin(a) * r], i * 6);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(p, 3));
      const mat = new THREE.LineBasicMaterial({ color: 0xc8a8ff, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
      this.streaks = new THREE.Group();
      this.streakIn = new THREE.Group();
      for (const dy of [0, 300]) { const l = new THREE.LineSegments(g, mat); l.position.y = dy; l.frustumCulled = false; this.streakIn.add(l); }
      this.streaks.add(this.streakIn);
      scene.add(this.streaks);
    }
    this.streaks.visible = true;
    this.streakIn.children[0].material.opacity = 0.6 * fast;
    this.streaks.position.copy(camera.position);
    _a.copy(B.wv).normalize().applyQuaternion(inv);
    this.streaks.quaternion.setFromUnitVectors(_b.set(0, 1, 0), _a);
    const k = Math.min(1, Math.log2(1 + B.wv.length() / 2000) / 6);
    this.streakIn.position.y = (this.streakIn.position.y - dt * (300 + 1400 * k)) % 300;
  }
}
