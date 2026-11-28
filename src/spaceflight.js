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
import { STAR, BODIES, BODY, LY, bodyPos, setOrigin, originId, bodyDelta, soiAt, spanOf, sunOf, sunNear, spinAngle, holeG, LIGHTS, systemOf, systemNear, onBodiesAdded, originAbs, materialize, isMaterialized } from './system.js?v=1.1.0-mx09tneh';
import { GAL_N, GAL_STARS, GX, GY_, GZ, GNAME, near as galNear, gxId, nebulaAt } from './galaxie.js?v=1.1.0-mx09tneh';
import { nearestMouth, otherEnd, whereTo, crossTime, crossed, speedAt, fmtDur, fmtLy, OPEN_R, SENSE_R, TUN_V } from './tunnels.js?v=1.1.0-mx09tneh';
import { lifeText } from './stellar.js?v=1.1.0-mx09tneh';
import { variableText, novaText } from './astro.js?v=1.1.0-mx09tneh';
import { worldToDir, dirToWorld } from './planetview.js?v=1.1.0-mx09tneh';
import { zoneOfXZ, zoneBody, bodyZone, ZONE, Z_VOID, Z_ROCK, slotOfQR, slotAt, rocksNear, rockSlot, rockOfQR, inBelt, RUIN } from './spacegen.js?v=1.1.0-mx09tneh';
import { SPACE_Y } from './rocket.js?v=1.1.0-mx09tneh';
import { airOfBody, isGiant, aeroStep, HULL_P, KELVIN } from './atmo.js?v=1.1.0-mx09tneh';
import { suitP, suitSkin } from './environ.js?v=1.1.0-mx09tneh';
import { Dim7, RIFT_LIFE, RIFT_LEN, RIFT_NEAR } from './dim7.js?v=1.1.0-mx09tneh';

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
// Surcharge du saut (touche K pendant un saut) : 10 fois plus vite, 3 fois plus de carburant.
// L'espace-temps tient 5 minutes (OVER_SAFE, comptées sur tout le saut, même en coupant la
// surcharge entre-temps). Ensuite il se fissure autour de la fusée, et des fissures s'ouvrent droit
// devant elle : il faut tourner la fusée (son nez) avant d'y arriver (RIFT_WARN secondes, à plus de
// RIFT_CONE de la fissure). Une fissure prise de face : la fusée tombe dedans, la 7ème dimension.
// Elle en ressort quelques secondes plus tard (25 s au plus), n'importe où à moins de 500
// années-lumière, le plus souvent au milieu de nulle part ; là où elle est tombée, une fissure reste
// dans l'espace 17 minutes.
const OVER_K = 10, OVER_BURN = 3, OVER_SAFE = 300;
export const fmtBar = (P) => (P < 0.01 ? Math.round(P * 1e5) + ' Pa' : P < 10 ? P.toFixed(2).replace('.', ',') + ' bar' : Math.round(P).toLocaleString('fr-FR') + ' bars');
const fmtMin = (s) => Math.floor(s / 60) + ' min ' + String(Math.floor(s % 60)).padStart(2, '0') + ' s';
const RIFT_WARN = 2.6, RIFT_CONE = Math.cos(0.2), RIFT_AIM = 0.07; // (secondes pour l'esquiver ; ~11° à quitter ; elle s'ouvre à ~4° du nez)
const RIFT_GAP = [6, 2.2];           // (secondes entre deux fissures : au début, puis au plus serré, 4 minutes après)
const DIM_R = 500 * LY, DIM_VOID = 0.8, DIM_SHORT = 0.5;   // (rayon de sortie ; part au milieu de nulle part ; part des passages brefs)
const INTER_VMAX = 2.5e11;           // (loin de tout astre, avec ou sans cible : voir stepWarp ; une fusée : selon son meilleur réacteur, voir rocket.js)
const HOLES = BODIES.filter((b) => b.kind === 'hole');
// Le saut du joueur (touche J), en survie (voir jumpPlan) : la préparation (4 s + 0,06 s par tonne, 25 s au
// plus, plus longue dans un puits de gravité ou une nébuleuse), le carburant (pour charger la bulle :
// JUMP_START par tranche de 25 t ; pendant le saut : LY_COST mB par année-lumière et par tranche de 25 t), la portée
// d'une bulle (années-lumière : réacteur nédrolytium, renforcé, nédrolytium-voltite), puis le
// refroidissement du réacteur (secondes : COOL_BASE + COOL_LY par année-lumière parcourue)
const PREP_BASE = 4, PREP_T = 0.06, PREP_MAX = 25, LY_COST = 60, JUMP_RANGE = [25, 60, 200], COOL_BASE = 15, COOL_LY = 4, COOL_MAX = 240;
// Le moteur de 7ème dimension (touche I, voir tunnels.js) : la brèche met BREACH_T secondes à s'ouvrir,
// coûte BREACH_FUEL mB (en survie), se referme parfois avant de tenir (BREACH_FAIL : l'instabilité) ;
// ensuite, le moteur se stabilise BREACH_COOL secondes
const BREACH_T = 12, BREACH_FUEL = 4000, BREACH_FAIL = 0.15, BREACH_COOL = 90;
// La vitesse de la lumière (blocs/s : une année-lumière en un an). Les fusées n'y arrivent jamais : plus
// elles en approchent, moins leur poussée les accélère (la relativité restreinte) ; leur temps ralentit.
export const C_LIGHT = LY / 31557600;
const TIME_MAX = 1e7;              // (près d'un trou noir : 1 / sqrt(1 - Rs / r), sans fin à l'horizon ; borné pour les calculs)
const FLY_V0 = 600, FLY_DOUBLE = 1; // (créatif : voler très vite, Ctrl tenu)
const ALL = [STAR, ...BODIES];
const NAMES = ALL.map((b) => b.id);
// le système de chaque astre (son astre central), et sa profondeur sous lui (une lune : 2)
const SYS = new Map(ALL.map((b) => [b.id, systemOf(b)]));
const depthOf = (b) => { let n = 0, q = b; while (q !== SYS.get(b.id) && q.parent && BODY[q.parent]) { q = BODY[q.parent]; n++; } return n; };
const DEPTH = new Map(ALL.map((b) => [b.id, depthOf(b)]));
// (un système de la Voie lactée qu'on approche : ses astres entrent dans toutes les listes, voir
// system.materialize et galaxyNear)
const FLIGHTS = new Set();
onBodiesAdded((list) => {
  for (const b of list) { AVOID.push(b); ALL.push(b); NAMES.push(b.id); if (b.kind === 'hole') HOLES.push(b); SYS.set(b.id, systemOf(b)); }
  for (const b of list) DEPTH.set(b.id, depthOf(b));
  for (const F of FLIGHTS) F.bodiesAdded(list);
});
const GAL_NEAR = 1;      // (années-lumière : plus près, un système de la Voie lactée prend vie)
const GAL_AHEAD = 6;     // (en saut : les systèmes à moins de 6 secondes de route, pour ralentir à temps)
// la liste des repères (N) : une étoile est « visée » à moins de AIM du centre de l'écran (radians)
const AIM = 0.07;
const AXIS_Z = new THREE.Vector3(0, 0, 1), AXIS_Y = new THREE.Vector3(0, 1, 0);
const clock = { day: 0, seed: '0' }; // (l'instant de cette image : l'orientation des planètes synchrones en dépend)
const _bq = new THREE.Quaternion(), _bq2 = new THREE.Quaternion();
// L'orientation d'un astre : son inclinaison, et sa rotation s'il montre toujours la même face
function bodyQ(b, out) {
  out.setFromAxisAngle(AXIS_Y, spinAngle(b, clock.day, clock.seed));
  return out.premultiply(_bq2.setFromAxisAngle(AXIS_Z, b.tilt || 0));
}
const ZERO = new THREE.Vector3();
// (en arrivant au-dessus de la carte : la vitesse est gardée, bornée là où la carte ne suivrait plus, voir descend)
const ARRIVE_H = 150, ARRIVE_V = 150;
const AIR_TOP = 3000, GIANT_TOP = 6000; // (au-dessus, l'air ne compte plus : moins d'un millionième)
const _ar = new THREE.Vector3(), _aq = new THREE.Quaternion(), _ax = new THREE.Vector3(), _ae = new THREE.Vector3();
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
const SYNC_NEAR = 1500; // (synchro : la cible sort du saut, on en sort à moins de 1 500 blocs d'elle)
const RADAR_R = 60000; // (le radar voit les vaisseaux rebelles et pionniers jusque-là)
const MARK_MAX = 100 * LY; // (les repères à l'écran : astres, stations, coins d'espace ; plus loin, cachés, sauf le repère choisi)
const fmtD = (d) => (d >= LY * 0.01 ? (d / LY).toFixed(d >= LY ? 1 : 2) + ' années-lumière' : d >= 1e9 ? (d / 1e9).toFixed(2) + ' G blocs' : d >= 1e6 ? (d / 1e6).toFixed(d >= 1e8 ? 0 : 1) + ' M blocs' : d >= 1e4 ? Math.round(d / 1000) + ' k blocs' : Math.round(d) + ' blocs');
const fmtV = (v) => (v >= LY * 0.5 ? (v / LY).toFixed(1).replace('.', ',') + ' a.l./s' : v >= 1e9 ? (v / 1e9).toFixed(v >= 1e11 ? 0 : 1) + ' G b/s' : v >= 1e6 ? (v / 1e6).toFixed(1) + ' M b/s' : v >= 1e4 ? (v / 1000).toFixed(0) + ' k b/s' : v.toFixed(v < 100 ? 1 : 0) + ' b/s');

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
    // (l'air, voir airOf : réutilisés à chaque image)
    const mk = () => ({ rho: 0, P: 0, T: 270, vair: new THREE.Vector3(), up: new THREE.Vector3(), g: 0, giant: false, layer: null, body: null, alt: 0 });
    this.airTmp = mk(); this.airMe = mk(); this.airHere = mk();
    this.meAero = { vel: null, ang: new THREE.Vector3(), list: [0], mass: 90, radius: 1, quat: new THREE.Quaternion(), blocks: new Map(), rocket: null, aeroSt: null };
    this.g = g;
    this.spaces = new Map(); // id -> bulle
    this.on = false;
    this.zone = 0;
    this.inVoid = false;
    this.bp = {};            // positions des astres (cette image)
    this.curves = new Map(); // (tracés des lignes spatiales, voir curveOf)
    for (const id of NAMES) this.bp[id] = { x: 0, y: 0, z: 0 };
    FLIGHTS.add(this);
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
    this.rifts = [];         // les fissures de l'espace : [{ ref, c: [x, y, z], life (s), rot }]
    this.fx7 = null;         // (les fissures autour de la fusée, la 7ème dimension, les fissures de près : voir dim7.js)
    this.riftId = 0;
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
    this.repairOrbits();
    if (on) this.addRuin();
    this.relink = true; // (la partie reprend peut-être à pied à côté d'une ligne spatiale)
    this.syncZone(true);
  }
  reset() { this.on = false; this.hole = null; this.dilation = 1; this.inside = null; this.g.canvas.style.filter = ''; if (this.stretched) { this.g.canvas.style.transform = ''; this.stretched = false; } this.g.sky.fixedSun = this.g.sky.viewLocal = null; this.spaces.clear(); this.inVoid = false; this.zone = 0; this.transit = null; this.g.world.noTerrain = this.g.world.fastLine = false; this.curves.clear(); this.deck = false; this.setLand(1); this.showDom(false); this.rifts = []; this.fx7?.clear(); }

  serialize() {
    const out = [], { structs } = this.g;
    for (const B of this.spaces.values()) {
      if (B.rock || B.ruin) continue; // (un astéroïde, la ruine : recalculés d'après leur place)
      if (B.anchored || this.liveIds.has(B.id) || structs.list.some((s) => this.idAt(s.pos.x, s.pos.z) === B.id)) out.push({ ...this.pack(B), w: undefined });
    }
    return out;
  }
  pack(B) {
    return { i: B.ix, j: B.iz, ref: B.ref, c: B.c.toArray(), q: B.Q.toArray(), v: B.v.toArray(), a: B.anchored ? 1 : 0, o: B.owner ?? 0, ...(B.wv ? { w: B.wv.toArray() } : {}), ...(B.hold ? { h: 1 } : {}), ...(B.orb ? { orb: B.orb } : {}), ...(B.siteName ? { n: B.siteName } : {}), ...(B.dim7 ? { d7: B.dim7.tun ? { t: Math.round(B.dim7.t), s: Math.round(B.dim7.stay), L: B.dim7.tun.L, to: B.dim7.tun.to } : 1 } : {}), ...(B.over ? { ov: 1 } : {}), ...(B.ot ? { ot: Math.round(B.ot) } : {}), ...(B.rift ? { rf: B.rift } : {}) };
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
    // (dans la 7ème dimension : l'hôte sait quand elle en sort ; une partie rechargée en ressort vite)
    // (dans un tunnel : la traversée continue là où elle en était)
    const T7 = e.d7 && typeof e.d7 === 'object' && Number.isFinite(e.d7.t) && Number.isFinite(e.d7.s) && Number.isFinite(e.d7.L) ? e.d7 : null;
    if (T7) {
      const to = String(T7.to || '').slice(0, 90);
      if (!B.dim7?.tun) B.dim7 = { t: T7.t, stay: T7.s, msg: 'Sortie du tunnel près de ' + to, tun: { L: T7.L, to } };
      else if (Math.abs(B.dim7.t - T7.t) > 2) B.dim7.t = T7.t;
    } else B.dim7 = e.d7 ? B.dim7 || { t: 0, stay: this.g.net.isClient ? Infinity : 6, msg: null } : null;
    B.over = !!e.ov;
    B.ot = Number.isFinite(e.ot) ? e.ot : 0;
    B.rift = Array.isArray(e.rf) && e.rf.length === 4 && e.rf.every(Number.isFinite) ? e.rf : null;
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

  // Le point du sol sous p (dans une bulle du vide, au-dessus d'un astre où l'on peut se poser) :
  // { b (l'astre), k (sa zone), x, z (dans sa zone), alt (au-dessus de son sol) } ou null (le scanner)
  groundUnder(p) {
    const B = this.bubbleAt(p.x, p.z);
    if (!B || B.rock || B.dim7 || !B.ref || B.ref === 'star') return null;
    const b = BODY[B.ref];
    if (!b || !(b.gen || b.kind === 'home')) return null;
    const rel = this.toRel(B, p, new THREE.Vector3()), alt = rel.length() - b.R;
    const w = dirToWorld(rel.normalize().applyQuaternion(bodyQ(b, _bq).invert()), spanOf(b));
    const k = b.kind === 'home' ? 0 : bodyZone(b.id);
    return { b, k, x: w.x + k * ZONE, z: w.z, alt };
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
  // (réparation d'une ancienne erreur : une station ancrée en plein saut changeait d'astre de référence
  // sans que son orbite suive, et se retrouvait au cœur de l'étoile. Son orbite dit autour de quel
  // astre elle a été calculée : on la remet autour de lui, et ce qui l'avait suivie avec elle)
  repairOrbits() {
    for (const B of this.spaces.values()) {
      const O = B.orb;
      if (!O || B.ruin || !BODY[B.ref]) continue;
      const d = Math.hypot(...O.c0), wOf = (b) => (b.kind === 'hole' ? Math.sqrt(holeG(b, d) / d) : Math.sqrt(G_K * (b.gravity || 0) * b.R * b.R / (d * d * d)));
      const ok = (b) => b && Math.abs(wOf(b) - O.w) <= O.w * 1e-6;
      if (ok(BODY[B.ref])) continue;
      const right = BODIES.find((b) => ok(b));
      if (!right) continue;
      const was = B.ref, broken = B.c.clone();
      B.ref = right.id;
      for (const N of this.spaces.values()) {
        if (N === B || N.orb || N.rock || N.ref !== was || N.c.distanceTo(broken) > 30000) continue;
        N.ref = right.id; N.v.set(0, 0, 0); N.wv = null; N.hold = true; // (le vaisseau venu la rejoindre)
      }
    }
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
    // (l'air au-dessus de la carte a freiné ce qu'il a pu, voir atmo.js : on arrive à sa vitesse, bornée
    // là où le terrain ne se chargerait plus à temps. Parachutes, aérofreins, rétrofusées : à toi de freiner)
    const hv = Math.hypot(v.x, v.z), hk = hv > ARRIVE_H ? ARRIVE_H / hv : 1;
    v.set(v.x * hk, Math.max(-ARRIVE_V, Math.min(-2, v.y)), v.z * hk);
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
    if (B.dim7) return; // (dans la 7ème dimension : il n'y a ni haut, ni bas, ni rien)
    const w = E.s ? E.s.warp : this.warpFly;
    if (E.s && this.sync && !this.syncHolds(E)) this.syncOff('Synchro arrêtée');
    if (w) { this.stepWarp(E, B, w, dt); return; }
    if (E.s && this.sync) this.syncFree(E, B);
    if (this.hazards(E, B)) return;
    if (!E.s) this.playerAir(E, dt);
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
    if (B.ref !== 'star') return;
    const hx = this.bp.star, h = _b.set(abs.x - hx.x, abs.y - hx.y, abs.z - hx.z).clone(); // (depuis Hexa : la ceinture est comptée de là)
    if (!inBelt(h.x, h.y, h.z)) return;
    for (const R of rocksNear(h.x, h.y, h.z, 1, [])) {
      const d = Math.hypot(R.x - h.x, R.y - h.y, R.z - h.z);
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
  // K pendant un saut : la surcharge (ou son arrêt)
  toggleOvercharge(s) {
    if (this.g.net.isClient) { this.g.net.csend({ t: 'rkx', id: s.id }); return; }
    if (!s.warp) { this.g.toast('La surcharge ne marche que pendant un saut (J)'); return; }
    s.warp.over = !s.warp.over;
    const left = Math.max(0, OVER_SAFE - (s.warp.ot || 0));
    this.g.toast(s.warp.over ? (left > 0 ? 'SURCHARGE du saut : 10 fois plus vite. L\'espace-temps tient encore ' + fmtMin(left) + ', ensuite il se fissure (K pour l\'arrêter)' : 'SURCHARGE du saut : l\'espace-temps se fissure… tourne la fusée pour esquiver les fissures !') : 'Surcharge coupée : retour au saut normal');
  }
  // La déchirure : l'espace se fissure, la fusée tombe dans une fissure (la 7ème dimension), et en
  // ressortira n'importe où à moins de 500 années-lumière ; une fissure reste là où elle est tombée
  tear(E, B) {
    const seed = Math.random, P = (id) => this.bp[id], stars = LIGHTS.filter((b) => b.kind === 'star');
    const from = this.toAbs(B, E.pos, new THREE.Vector3());
    // la fissure laissée dans l'espace (gardée par rapport à son astre)
    this.addRift({ ref: B.ref, c: this.toRel(B, E.pos, new THREE.Vector3()).toArray(), life: RIFT_LIFE, rot: (seed() - 0.5) * 2.4 }, true);
    // où l'on ressortira
    const abs = new THREE.Vector3(), dir = () => { const u = seed() * 2 - 1, a = seed() * Math.PI * 2, k = Math.sqrt(1 - u * u); return _b.set(k * Math.cos(a), u, k * Math.sin(a)); };
    let where = null;
    if (seed() < DIM_VOID) {
      // au milieu de nulle part : à plus d'une demi-année-lumière de toute étoile
      for (let i = 0; i < 40 && !where; i++) {
        abs.copy(from).addScaledVector(dir(), DIM_R * Math.cbrt(seed()));
        if (LIGHTS.every((b) => { const o = P(b.id); return Math.hypot(o.x - abs.x, o.y - abs.y, o.z - abs.z) > LY * 0.5; })) where = 'void';
      }
    }
    if (!where) {
      // près d'un astre (pas trop près : sa gravité nous rattraperait), à moins de 500 années-lumière
      const list = ALL.filter((b) => { if (b.kind === 'hole') return false; const o = P(b.id); return Math.hypot(o.x - from.x, o.y - from.y, o.z - from.z) < DIM_R; });
      if (list.length) {
        const b = list[Math.floor(seed() * list.length)], o = P(b.id);
        abs.set(o.x, o.y, o.z).addScaledVector(dir(), this.safeOf(b, E) * (2 + seed() * 20));
        where = b;
      } else { abs.copy(from).addScaledVector(dir(), DIM_R * Math.cbrt(seed())); where = 'void'; }
    }
    const al = (d) => (d / LY).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' a.l.';
    let near = null, nd = Infinity;
    for (const b of stars) { const q = P(b.id), d = Math.hypot(q.x - abs.x, q.y - abs.y, q.z - abs.z); if (d < nd) { nd = d; near = b; } }
    const moved = al(Math.hypot(abs.x - from.x, abs.y - from.y, abs.z - from.z));
    const msg = where === 'void'
      ? 'Tu ressors de la 7ème dimension au milieu de nulle part, à ' + moved + ' de la fissure. L\'étoile la plus proche, ' + near.name + ', est à ' + al(nd)
      : 'Tu ressors de la 7ème dimension près ' + de(where.name) + ', à ' + moved + ' de la fissure';
    // la bulle passe de l'autre côté (et n'en bouge plus tant qu'elle est dans la 7ème dimension)
    if (E.s) { E.s.warp = null; E.s.throttle = 0; } else this.warpFly = null;
    B.wv = null; B.over = false; B.ot = 0; B.rift = null;
    const o = P(B.ref);
    B.c.set(abs.x - o.x, abs.y - o.y, abs.z - o.z);
    B.v.set(0, 0, 0);
    this.rebase(B, true);
    // (la moitié du temps on ne fait que passer ; sinon, on y reste bloqué jusqu'à 25 secondes)
    const stay = seed() < DIM_SHORT ? 5 + seed() * 4 : 15 + seed() * 10;
    B.dim7 = { t: 0, stay, msg };
    this.push(B);
    this.g.toast('L\'espace se fissure de partout… la fusée tombe dans une des fissures !');
  }
  // La sortie de la 7ème dimension (l'hôte)
  exitDim(B) {
    const msg = B.dim7?.msg, tun = B.dim7?.tun;
    B.dim7 = null;
    B.v.set(0, 0, 0);
    this.push(B);
    const mine = this.idAt(this.g.player.pos.x, this.g.player.pos.z) === B.id;
    if (msg && mine) this.g.toast(msg);
    // (au retour d'une déchirure, la fusée rapporte des éclats de 7ème dimension, collés à sa coque ;
    // pas d'un tunnel : la brèche du moteur est nette)
    if (mine && !tun) this.g.onShards?.(1 + Math.floor(Math.random() * 3));
    if (mine && tun) this.g.onTunnel?.(tun);
  }
  // ---------- Le moteur de 7ème dimension (touche I) ----------
  // Près d'une entrée de tunnel de la Seed (voir tunnels.js), il déchire la séparation : la brèche
  // s'ouvre en BREACH_T secondes (ou se referme : elle est instable), la fusée passe dans le tunnel
  toggleBreach(s) {
    if (this.g.net.isClient) { this.g.net.csend({ t: 'rk7', id: s.id }); return; }
    const { rockets, toast } = this.g, B = this.bubbleAt(s.pos.x, s.pos.z);
    if (!s.rocket?.d7) { toast(s.rocket?.d7n ? "Le moteur de 7ème dimension n'est pas alimenté : il faut au vaisseau un réacteur armé (contre du nédrolytium) ou un moteur qui marche seul (chimique, plasma)" : "Pas de moteur de 7ème dimension dans ce vaisseau : pose-le sur le vaisseau lui-même (Maj + clic droit sur un de ses blocs)"); return; }
    if (!B) { toast("La brèche ne s'ouvre que dans l'espace"); return; }
    if (B.dim7) { toast(B.dim7.tun ? "Dans le tunnel, on ne peut que filer jusqu'au bout" : 'Dans la 7ème dimension, les boutons ne font que des bruits de couleur'); return; }
    if (s.breach) { s.breach = null; toast("Ouverture de la brèche annulée : l'énergie chargée est perdue"); return; }
    if (s.warp || s.jumpPrep) { toast("Sors du saut d'abord : la bulle et la brèche ne tiennent pas ensemble"); return; }
    if (s.d7Cool > 0) { toast('Le moteur de 7ème dimension se stabilise encore ' + Math.ceil(s.d7Cool) + ' s'); return; }
    const L = this.absLy(this.toAbs(B, s.pos, new THREE.Vector3())), N = nearestMouth(this.g.seed(), L.x, L.y, L.z);
    if (!N) { toast(`Le moteur ne sent aucun tunnel de la Seed à moins de ${SENSE_R} années-lumière`); return; }
    if (N.d > OPEN_R) { toast(`Trop loin d'un tunnel pour l'atteindre : le moteur en sent un à ${N.d.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} années-lumière, près de l'étoile ${GNAME[N.m.i]} (saute jusqu'à elle)`); return; }
    const cost = this.g.survival().on && !rockets.infinite ? BREACH_FUEL : 0;
    if (cost && rockets.fuel(s) < cost) { toast('Pas assez de carburant pour déchirer la séparation : il en faut ' + cost.toLocaleString('fr-FR') + ' mB'); return; }
    if (cost) rockets.setFuel(s, rockets.fuel(s) - cost);
    s.breach = { t: 0, T: BREACH_T, m: N.m };
    toast(`Le moteur déchire la séparation… Tunnel vers ${whereTo(N.m)} : ${fmtLy(N.m.t.L)}, ${fmtDur(crossTime(N.m.t.L))} de traversée. Brèche dans ${BREACH_T} s · I pour annuler`);
  }
  // (l'hôte, à chaque image : la brèche qui s'ouvre, le moteur qui se stabilise)
  breachTick(s, dt) {
    if (s.d7Cool > 0) s.d7Cool = Math.max(0, s.d7Cool - dt);
    const Q = s.breach;
    if (!Q) return;
    const B = this.bubbleAt(s.pos.x, s.pos.z), mine = this.g.player.pilot?.s === s;
    if (!B || B.dim7 || s.warp || !this.occupied(s) || !s.rocket?.d7) { s.breach = null; return; }
    if ((Q.t += dt) < Q.T) return;
    s.breach = null;
    s.d7Cool = BREACH_COOL;
    if (Math.random() < BREACH_FAIL) { if (mine) this.g.toast('La brèche vacille… et se referme avant de se stabiliser. Le moteur doit se stabiliser ' + BREACH_COOL + ' s avant un nouvel essai'); return; }
    this.enterTunnel({ s, pos: s.pos, vel: s.vel }, B, Q.m);
  }
  // La fusée passe dans le tunnel : la bulle est déjà à l'autre bout (elle n'en bougera plus avant la
  // sortie) ; une fissure reste un moment là où la brèche s'est ouverte
  enterTunnel(E, B, m) {
    const o = otherEnd(m), L = m.t.L, id = gxId(o.i);
    materialize(o.i);
    if (!BODY[id] || !this.bp[id]) { this.g.toast('Le tunnel se dérobe : la brèche se referme'); return; }
    this.addRift({ ref: B.ref, c: this.toRel(B, E.pos, new THREE.Vector3()).toArray(), life: RIFT_LIFE / 4, rot: (Math.random() - 0.5) * 2.4 }, true);
    if (E.s) { E.s.warp = null; E.s.jumpPrep = null; E.s.throttle = 0; }
    B.wv = null; B.over = false; B.ot = 0; B.rift = null;
    // (la sortie : l'autre bouche, comptée depuis son étoile)
    B.ref = id;
    B.c.set((o.x - GX[o.i]) * LY, (o.y - GY_[o.i]) * LY, (o.z - GZ[o.i]) * LY);
    B.v.set(0, 0, 0);
    this.rebase(B, true);
    const to = whereTo(m);
    B.dim7 = { t: 0, stay: crossTime(L), msg: 'Sortie du tunnel près de ' + to, tun: { L, to } };
    this.push(B);
    if (this.g.player.pilot?.s === E.s) this.g.toast('La brèche tient ! La fusée entre dans un tunnel de la 7ème dimension');
  }
  // ---------- Les fissures de l'espace ----------
  // (send : l'hôte la fait savoir aux invités)
  addRift(r, send = false) {
    const nums = (v, n) => Array.isArray(v) && v.length === n && v.every(Number.isFinite);
    if (!r || !BODY[r.ref] || !nums(r.c, 3) || !Number.isFinite(r.life)) return;
    const R = { id: ++this.riftId, ref: r.ref, c: r.c.slice(), life: Math.max(0, Math.min(RIFT_LIFE, r.life)), rot: Number.isFinite(r.rot) ? r.rot : 0 };
    this.rifts.push(R);
    if (this.rifts.length > 32) this.rifts.shift();
    if (send && this.g.net.mode === 'host') this.g.net.broadcastJoined?.({ t: 'rift', r: R });
  }
  saveRifts() { return this.rifts.map((r) => ({ ref: r.ref, c: r.c.map((v) => Math.round(v * 10) / 10), life: Math.round(r.life), rot: Math.round(r.rot * 1000) / 1000 })); }
  loadRifts(list) {
    this.rifts = [];
    for (const r of Array.isArray(list) ? list : []) this.addRift(r);
  }
  // À chaque image : les fissures se referment doucement ; de loin, le ciel les montre ; de près,
  // ce sont des objets dans l'espace. Et pour qui est à bord d'une bulle en surcharge ou dans la
  // 7ème dimension : ce qui se passe autour de la fusée (voir dim7.js)
  riftsFx(dt) {
    const { player, camera, scene } = this.g, view = this.g.sky?.view;
    const B = this.inVoid && !this.transit ? this.bubbleAt(player.pos.x, player.pos.z) : null;
    const out = [], near = [];
    const Qi = B ? _q.copy(B.Q).invert().clone() : null, here = B ? this.bp[B.ref] : null;
    for (let i = this.rifts.length - 1; i >= 0; i--) {
      const r = this.rifts[i];
      r.life -= dt;
      if (r.life <= 0) { this.rifts.splice(i, 1); continue; }
      const o = this.bp[r.ref];
      if (!o) continue;
      // (elle se referme de plus en plus lentement : vite au début, puis un mince trait qui s'éteint)
      const k = Math.sqrt(r.life / RIFT_LIFE), b = BODY[r.ref], planet = b.kind !== 'star' && b.kind !== 'hole' && !b.fixed;
      // tout près de nous : dans la scène, à sa place (repère de la bulle -> scène)
      if (B && here) {
        const v = _t1.set(o.x + r.c[0] - here.x - B.c.x, o.y + r.c[1] - here.y - B.c.y, o.z + r.c[2] - here.z - B.c.z);
        if (v.length() < RIFT_NEAR) {
          const q = _tq.setFromEuler(new THREE.Euler(r.rot, r.rot * 1.7, r.rot * 0.6));
          near.push({ id: r.id, pos: v.clone().applyQuaternion(Qi).add(_t2.set(B.ox, 0, B.oz)), q: Qi.clone().multiply(q), k });
          continue;
        }
      }
      out.push({ x: o.x + r.c[0], y: o.y + r.c[1], z: o.z + r.c[2], ...(planet ? { rx: r.c[0], ry: r.c[1], rz: r.c[2] } : {}), len: RIFT_LEN, k, rot: r.rot });
    }
    if (view) view.rifts = out;
    const over = !!(B && B.over && !B.dim7), dim = !!(B && B.dim7);
    if (this.dom?.marks) this.dom.marks.style.visibility = dim ? 'hidden' : '';
    if (!this.fx7 && !over && !dim && !near.length) return;
    const fx = (this.fx7 ||= new Dim7(scene));
    fx.placeRifts(near);
    // (la fusée où l'on est : les fissures s'ouvrent autour d'elle, la grande devant son nez)
    const ship = player.pilot?.s || player.attached || player.standingOn || null;
    const center = ship?.group ? ship.group.position : camera.position;
    const nose = ship?.quat ? _t3.set(0, 1, 0).applyQuaternion(ship.quat) : camera.getWorldDirection(_t3);
    // (la fissure qui arrive : du repère de l'espace à celui de la scène)
    const rift = over && B.rift ? { dir: _t1.fromArray(B.rift).applyQuaternion(Qi).normalize().clone(), u: B.rift[3] } : null;
    fx.update(dt, { over, cracking: over && (B.ot || 0) >= OVER_SAFE, rift, dim, tunnel: dim && B.dim7.tun ? speedAt(B.dim7.t) / TUN_V : null, left: dim && B.dim7.tun ? B.dim7.stay - B.dim7.t : undefined, center, nose, camera });
  }
  // ---------- Le saut nédrolytique : préparer, payer, aller pas trop loin, laisser refroidir ----------
  // (seulement les sauts du joueur, touche J : les vaisseaux automatiques ont leurs propres règles,
  // voir orbital.js. En créatif : la préparation, plus courte, et rien d'autre.)
  // Ce qui gêne la bulle ici : la gravité (un puits de gravité courbe déjà l'espace-temps : la bulle
  // y coûte plus et met plus de temps à se former) ; le gaz et la poussière d'une nébuleuse (la bulle
  // les balaie). { k : coût ×k, why : texte }
  jumpEnv(E, B) {
    const p = this.toAbs(B, E.pos, new THREE.Vector3());
    let well = 0, wb = null;
    for (const b of ALL) {
      const o = this.bp[b.id], d = Math.max(1, Math.hypot(o.x - p.x, o.y - p.y, o.z - p.z)), x = Math.min(3, this.safeOf(b, E) / d);
      if (x > well) { well = x; wb = b; }
    }
    const kg = 1 + 0.5 * Math.max(0, well - 0.3);
    const L = this.absLy(p), N = nebulaAt(L.x, L.y, L.z), kn = N && (N.type === 'hii' || N.type === 'sombre') ? 1.5 : N ? 1.2 : 1;
    const why = [];
    if (kg > 1.05) why.push('puits de gravité ' + de(wb.name) + ' ×' + kg.toFixed(1).replace('.', ','));
    if (kn > 1) why.push('gaz de ' + N.name + ' ×' + kn.toFixed(1).replace('.', ','));
    return { k: kg * kn, kn, why: why.join(', ') };
  }
  // la portée d'un saut (années-lumière) : au-delà, la bulle ne tient plus (selon le réacteur)
  jumpRange(s) { const v = this.jumpTop(s); return v >= LY ? JUMP_RANGE[2] : v >= 7e11 ? JUMP_RANGE[1] : JUMP_RANGE[0]; }
  // ce que coûte la préparation (mB) et combien de temps elle prend (s), pour cette fusée, ici
  jumpPlan(s, E, B) {
    const t = Math.max(1, (s.mass || 20000) / 1000), env = this.jumpEnv(E, B), strict = this.g.survival().on;
    const T = Math.min(PREP_MAX, (PREP_BASE + PREP_T * t) * Math.sqrt(env.k)) * (strict ? 1 : 0.25);
    const cost = strict && !this.g.rockets.infinite ? Math.round(JUMP_START * Math.max(1, t / 25) * env.k) : 0;
    return { t, T, cost, env, strict };
  }
  toggleJump(s) {
    if (this.g.net.isClient) { this.g.net.csend({ t: 'rkj', id: s.id }); return; }
    const { rockets, toast } = this.g, B = this.bubbleAt(s.pos.x, s.pos.z);
    if (!B) { toast('Le saut ne marche que dans l\'espace'); return; }
    if (B.dim7) { toast('Dans la 7ème dimension, les boutons ne font que des bruits de couleur'); return; }
    if (s.warp) { this.endWarp({ s, pos: s.pos, vel: s.vel }, B, 'Sortie du saut'); return; }
    if (s.jumpPrep) { s.jumpPrep = null; toast('Préparation du saut annulée : le carburant déjà chargé est perdu'); return; }
    if (this.inside) { toast("Sous l'horizon, il n'y a plus de chemin vers l'extérieur"); return; }
    if (!s.rocket?.armed) { toast('Le réacteur n\'est pas armé : sans nédrolytium contre lui, il ne peut pas sauter'); return; }
    if (s.jumpCool > 0) { toast('Le réacteur refroidit encore ' + Math.ceil(s.jumpCool) + ' s : la bulle ne se formerait pas'); return; }
    const P = this.jumpPlan(s, { s, pos: s.pos, vel: s.vel }, B), fuel = rockets.fuel(s);
    if (P.strict && !rockets.infinite && fuel < P.cost + 50) { toast('Pas assez de carburant pour charger le saut : il en faut ' + P.cost.toLocaleString('fr-FR') + ' mB' + (P.env.why ? ' ici (' + P.env.why + ')' : '')); return; }
    s.jumpPrep = { t: 0, T: P.T, cost: P.cost, paid: 0, plan: P };
    toast('Le réacteur monte en puissance : saut dans ' + Math.ceil(P.T) + ' s' + (P.cost ? ', ' + P.cost.toLocaleString('fr-FR') + ' mB' : '') + (P.env.why ? ' (' + P.env.why + ')' : '') + ' · J pour annuler');
  }
  // (l'hôte) la préparation avance, le carburant se charge peu à peu ; le refroidissement après un saut
  jumpPrepTick(dt) {
    const { rockets, structs, toast } = this.g;
    for (const s of structs.list) {
      if (s.breach || s.d7Cool > 0) this.breachTick(s, dt);
      if (s.jumpCool > 0 && (s.jumpCool -= dt) <= 0) { s.jumpCool = 0; if (this.g.player.pilot?.s === s) toast('Le réacteur a refroidi : le saut est de nouveau possible'); }
      const J = s.jumpPrep;
      if (!J) continue;
      const B = this.bubbleAt(s.pos.x, s.pos.z);
      if (!B || B.dim7 || !this.occupied(s) || !s.rocket?.armed) { s.jumpPrep = null; continue; }
      J.t += dt;
      const want = J.cost * Math.min(1, J.t / J.T), pay = want - J.paid;
      if (pay > 0) {
        const f = rockets.fuel(s);
        if (f < pay) { s.jumpPrep = null; if (this.g.player.pilot?.s === s) toast('Plus assez de carburant : la préparation du saut s\'arrête'); continue; }
        rockets.setFuel(s, f - pay);
        J.paid = want;
      }
      if (J.t < J.T) continue;
      s.jumpPrep = null;
      const P = J.plan;
      s.warp = this.startWarp({ s, pos: s.pos, vel: s.vel }, B, JUMP_V0, JUMP_DOUBLE);
      Object.assign(s.warp, { manual: true, strict: P.strict, range: P.strict ? this.jumpRange(s) : Infinity, dist: 0, massT: Math.max(1, P.t / 25), kn: P.env.kn, envT: 1 });
      s.throttle = 0;
      toast('Saut nédrolytique ! ' + (P.strict ? 'Portée de la bulle : ' + this.jumpRange(s) + ' années-lumière' : 'Les moteurs passent en mode saut') + ' (J pour en sortir)');
    }
  }
  endWarp(E, B, why) {
    const w = E.s ? E.s.warp : this.warpFly;
    if (!w) return;
    // (après un saut du joueur : le réacteur refroidit, d'autant plus longtemps que le saut a été long)
    if (w.manual && w.strict && E.s) {
      E.s.jumpCool = Math.min(COOL_MAX, COOL_BASE + COOL_LY * (w.dist / LY) * (w.wasOver ? 2 : 1));
      why = (why || 'Sortie du saut') + ' (' + (w.dist / LY).toLocaleString('fr-FR', { maximumFractionDigits: 2 }) + ' a.l.) · le réacteur refroidit ' + Math.ceil(E.s.jumpCool) + ' s';
    }
    if (E.s) E.s.warp = null; else this.warpFly = null;
    B.wv = null;
    B.over = false; B.ot = 0; B.rift = null;
    this.rebase(B, true);
    // (on s'accroche à l'astre le plus proche, avec un peu d'élan vers l'avant)
    B.v.copy(this.warpDir(E, B, _a)).multiplyScalar(E.s ? 300 : 0);
    this.push(B);
    if (why) this.g.toast(why);
  }
  // Les fissures de la surcharge (l'hôte) : après OVER_SAFE secondes, une fissure s'ouvre droit
  // devant le nez ; dans RIFT_WARN secondes la fusée y est : si son nez la vise encore, elle tombe
  // dedans (true : la déchirure a eu lieu). Elles se suivent de plus en plus vite.
  overRifts(E, B, w, nose, dt) {
    w.ot = (w.ot || 0) + dt;
    B.ot = w.ot;
    if (w.ot < OVER_SAFE) { B.rift = null; return false; }
    if (!w.warned) { w.warned = true; this.g.toast('L\'espace-temps se fissure ! Des fissures vont s\'ouvrir devant toi : tourne la fusée pour les esquiver'); }
    if (!w.rift) {
      w.next = (w.next ?? 1.5) - dt;
      if (w.next > 0) { B.rift = null; return false; }
      // (un peu à côté du nez, dans un sens au hasard)
      const side = _c.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).cross(nose).normalize();
      w.rift = { d: nose.clone().addScaledVector(side, Math.tan(RIFT_AIM * Math.random())).normalize(), t: RIFT_WARN };
    }
    w.rift.t -= dt;
    B.rift = [...w.rift.d.toArray().map((x) => Math.round(x * 1e4) / 1e4), Math.round((1 - w.rift.t / RIFT_WARN) * 100) / 100];
    if (w.rift.t > 0) return false;
    const hit = nose.dot(w.rift.d) > RIFT_CONE;
    w.rift = null; B.rift = null;
    const k = Math.min(1, (w.ot - OVER_SAFE) / 240);
    w.next = (RIFT_GAP[0] + (RIFT_GAP[1] - RIFT_GAP[0]) * k) * (0.7 + Math.random() * 0.6);
    if (hit) { this.tear(E, B); return true; }
    w.dodged = (w.dodged || 0) + 1;
    this.g.toast('Fissure esquivée !' + (w.dodged > 1 ? ' (' + w.dodged + ')' : ''));
    return false;
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
      const fuel = Math.max(0, rockets.fuel(E.s) - JUMP_BURN * (w.over ? OVER_BURN : 1) * dt);
      rockets.setFuel(E.s, fuel);
      if (fuel <= 0) { this.endWarp(E, B, 'Plus de carburant : le saut s\'éteint'); return; }
    }
    const n = this.warpDir(E, B, new THREE.Vector3()), p = this.toAbs(B, E.pos, new THREE.Vector3()), nose = n.clone();
    // (la même règle, avec ou sans cible : plus l'astre le plus proche est loin, plus on peut aller
    // vite ; on ralentit tout seul en s'approchant de n'importe quel astre)
    let clear = Infinity;
    for (const b of ALL) {
      if (b === w.far) continue;
      const o = this.bp[b.id];
      clear = Math.min(clear, Math.hypot(o.x - p.x, o.y - p.y, o.z - p.z) - this.safeOf(b, E));
    }
    let vmax = Math.min(this.jumpTop(E.s), Math.max(JUMP_VMAX, 2 * clear));
    if (w.far) {
      const o = this.bp[w.far.id], d = n.set(o.x - p.x, o.y - p.y, o.z - p.z).length();
      n.divideScalar(d);
      vmax = Math.min(vmax, Math.max(JUMP_V0, 2 * (d - this.safeOf(w.far, E, true))));
    }
    // (synchro, touche Y : on suit la vitesse et la direction d'un vaisseau villageois en saut)
    const sy = E.s && this.sync ? this.syncWarp(B, p) : null;
    if (sy === 'stop') { this.endWarp(E, B, 'Synchro : sortie du saut avec ' + this.sync.label); return; }
    if (sy) n.copy(sy.n);
    // (surcharge : tout va 10 fois plus vite ; au bout de 5 minutes, l'espace-temps se fissure)
    B.over = !!w.over;
    if (w.over) w.wasOver = true;
    if (w.over) {
      vmax *= OVER_K;
      if (this.overRifts(E, B, w, nose, dt)) return;
    } else { w.rift = null; B.rift = null; }
    w.v = sy ? Math.min(vmax, sy.v) : Math.min(vmax, w.v0 * 2 ** (w.t / w.double) * (w.over ? OVER_K : 1));
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
    // (un saut du joueur, en survie : la bulle a une portée, et chaque année-lumière se paie)
    let spent = false;
    if (w.manual && w.strict) {
      const left = w.range * LY - w.dist;
      if (left <= step) { step = Math.max(0, left); hit = null; spent = true; }
      w.dist += step;
      if ((w.envT -= dt) <= 0) { w.envT = 1; const L = this.absLy(p), N = nebulaAt(L.x, L.y, L.z); w.kn = N && (N.type === 'hii' || N.type === 'sombre') ? 1.5 : N ? 1.2 : 1; }
      if (E.s && !rockets.infinite) {
        const f = rockets.fuel(E.s) - (step / LY) * LY_COST * w.massT * w.kn * (w.over ? 2 : 1);
        rockets.setFuel(E.s, Math.max(0, f));
        if (f <= 0) { B.c.addScaledVector(n, step); B.wv = n.multiplyScalar(w.v); this.rebase(B); this.endWarp(E, B, "Plus de carburant : la bulle s'effondre"); return; }
      }
      if (!w.warned80 && w.dist > 0.8 * w.range * LY) { w.warned80 = true; this.g.toast('La bulle faiblit : 80 % de sa portée (' + w.range + ' a.l.)'); }
    }
    B.c.addScaledVector(n, step);
    B.wv = n.multiplyScalar(w.v);
    // (le vaisseau a pu dériver dans sa bulle : on le ramène au centre)
    if (E.pos.y < SINK || Math.hypot(E.pos.x - B.ox, E.pos.y, E.pos.z - B.oz) > ABSORB) {
      B.c.add(_a.set(E.pos.x - B.ox, E.pos.y, E.pos.z - B.oz).applyQuaternion(B.Q));
      this.move(E, new THREE.Vector3(B.ox, 0, B.oz), null, E.vel);
    }
    this.rebase(B);
    if (spent) this.endWarp(E, B, 'La bulle ne tient plus : portée maximale du réacteur atteinte');
    else if (hit) this.endWarp(E, B, hit === w.far ? 'Arrivée : ' + hit.name : 'La gravité ' + de(hit.name) + ' casse le saut');
  }
  // ---------- Synchro (touche Y) : suivre un vaisseau villageois ----------
  // La fusée pilotée prend la vitesse et la direction du vaisseau villageois (rebelle ou pionnier)
  // le plus proche : en saut, elle saute avec lui (et sort du saut avec lui) ; hors saut, elle
  // garde la même vitesse que lui. Le joueur peut le suivre jusque chez lui...
  toggleSync(s) {
    const { toast } = this.g;
    if (this.g.net.isClient) { toast('La synchro n\'est disponible que pour l\'hôte de la partie'); return; }
    if (this.sync) { this.syncOff('Synchro arrêtée'); return; }
    const B = this.bubbleAt(s.pos.x, s.pos.z);
    if (!B) { toast('La synchro ne marche que dans l\'espace'); return; }
    const abs = this.toAbs(B, s.pos, new THREE.Vector3());
    let best = null, bd = Infinity;
    for (const r of this.g.rebelRadar?.() || []) {
      const TB = this.bubbleAt(r.s.pos.x, r.s.pos.z);
      if (!TB) continue;
      const d = this.toAbs(TB, r.s.pos, new THREE.Vector3()).distanceTo(abs);
      if (d < bd) { bd = d; best = r; }
    }
    if (!best) { toast('Aucun vaisseau villageois dans l\'espace à suivre'); return; }
    this.sync = { id: best.s.id, label: best.label, d: bd, tried: false, s };
    toast(`Synchro sur ${best.label} (${fmtD(bd)}) : ta fusée suit sa vitesse et sa direction, même en saut (Y pour arrêter)`);
  }
  syncOff(why) { if (!this.sync) return; this.sync = null; if (why) this.g.toast(why); }
  // (la synchro tient tant qu'on pilote la même fusée et que le vaisseau suivi existe)
  syncHolds(E) {
    const T = this.g.structs.byId(this.sync.id);
    return !!T && this.g.player.pilot?.s === E.s && this.sync.s === E.s;
  }
  syncTarget() {
    const T = this.g.structs.byId(this.sync.id), TB = T && this.bubbleAt(T.pos.x, T.pos.z);
    return TB ? { T, TB } : null;
  }
  // En saut : la direction et la vitesse de la cible, plus de quoi combler l'écart ; 'stop' : la
  // cible est sortie du saut et on est arrivé près d'elle
  syncWarp(B, p) {
    const t = this.syncTarget();
    if (!t) { this.syncOff('Synchro perdue : le vaisseau a disparu'); return null; }
    const rel = this.toAbs(t.TB, t.T.pos, new THREE.Vector3()).sub(p), d = rel.length();
    this.sync.d = d;
    if (!t.TB.wv) return d < SYNC_NEAR ? 'stop' : { n: rel.divideScalar(Math.max(d, 1e-6)), v: Math.max(JUMP_V0, 1.5 * d) };
    const want = t.TB.wv.clone().addScaledVector(rel, 0.8), v = want.length();
    return { n: want.divideScalar(Math.max(v, 1e-6)), v };
  }
  // Hors saut : la cible saute, on saute avec elle (si le réacteur le permet) ; sinon on garde sa vitesse
  syncFree(E, B) {
    const t = this.syncTarget();
    if (!t) { this.syncOff('Synchro perdue : le vaisseau a disparu'); return; }
    this.sync.d = this.toAbs(t.TB, t.T.pos, new THREE.Vector3()).distanceTo(this.toAbs(B, E.pos, new THREE.Vector3()));
    if (t.TB.wv) { if (!this.sync.tried) { this.sync.tried = true; this.toggleJump(E.s); } return; }
    this.sync.tried = false;
    if (t.TB === B) { E.vel.copy(t.T.vel); return; }
    if (this.isSolo(B, E) && !B.anchored) B.v.copy(t.TB.v);
  }
  // Vitesse de pointe du saut : selon le meilleur réacteur armé de la fusée (classique 250 G b/s,
  // renforcé 750 G b/s, nédrolytium-voltite une année-lumière par seconde) ; à pied : 250 G b/s
  jumpTop(s) { return s?.rocket?.jumpV || INTER_VMAX; }
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
      const o = this.bp[b.id];
      let rel = _a.set(p.x - o.x, p.y - o.y, p.z - o.z), d = rel.length(), alt = d - b.R;
      if (alt > b.R + 2000) continue;
      // (près d'un astre d'un autre système que celui d'ici, très loin d'ici : on recompte sans passer
      // par l'origine, pour rester précis au bloc près)
      if (systemOf(b).id !== originId()) {
        const k = bodyDelta(b.id, B.ref, this.day, this.g.seed());
        rel = this.toRel(B, E.pos, _a).add(_d.set(k.x, k.y, k.z));
        d = rel.length(); alt = d - b.R;
      }
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
      } else if (b.molten) {
        // (un embryon de planète encore en fusion : une mer de lave, rien ne s'y pose)
        if (alt < b.R * 0.01) { this.lost(E, B, b, rel, 'star'); return true; }
      } else if (alt < 0) {
        // une géante : on y plonge. La pression monte (voir atmo.js) : au double de ce que tient la coque
        // (ou la combinaison), écrasé ; tout au fond, le cœur de roche et de glace
        const P = airOfBody(b, alt, this.airTmp).P;
        if ((P > (E.s ? HULL_P : suitP(this.g.survival().head?.id)) * 2 && this.g.survival().on) || alt < -b.R * 0.2) { this.lost(E, B, b, rel, 'pressure'); return true; }
      }
    }
    return false;
  }

  // L'air autour d'un point (un objet, le joueur), voir atmo.js. out : { rho, P, T, vair, up, g, giant,
  // layer, body, alt } ; vair (la vitesse de l'air), up (le haut de l'astre) : dans le repère du point
  airOf(pos, out) {
    out.vair.set(0, 0, 0); out.up.set(0, 1, 0); out.body = null; out.alt = 0;
    const k = zoneOfXZ(pos.x, pos.z);
    if (k >= 0) {
      // sur la carte d'un astre : l'air s'arrête en haut de la carte (voir rocket.airAt)
      const b = zoneBody(k), top = this.airTopAt(pos.x, pos.z);
      airOfBody(b, pos.y - GROUND_Y, out);
      const f = top <= 0 || pos.y >= top ? 0 : Math.min(1, (top - pos.y) / 60);
      out.rho *= f; out.P *= f;
      out.g = G_K * (b.gravity || 1); out.body = b; out.alt = pos.y - GROUND_Y;
      return out;
    }
    const B = this.bubbleAt(pos.x, pos.z), b = B && !B.dim7 && BODY[B.ref];
    const none = () => { out.rho = 0; out.P = 0; out.T = 270; out.giant = false; out.layer = null; return out; };
    if (!b?.atmo?.density) return none();
    const rel = this.toRel(B, pos, _ar), d = rel.length(), alt = d - b.R, giant = isGiant(b);
    if (alt > (giant ? GIANT_TOP : AIR_TOP) || (!giant && !b.land)) return none();
    airOfBody(b, alt, out);
    out.body = b; out.alt = alt;
    const iq = _aq.copy(B.Q).invert();
    out.up.copy(rel).divideScalar(d).applyQuaternion(iq);
    out.g = G_K * (b.gravity || 0) * (b.R / d) ** 2;
    // l'air reste autour de l'astre : dans la bulle (qui file à B.v), il file à -B.v. Une géante a ses
    // vents : des courants-jets d'est en ouest, en bandes selon la latitude (comme sur Jupiter, ~150 m/s)
    out.vair.copy(B.v).negate();
    if (giant) {
      const ax = _ax.set(0, 1, 0).applyQuaternion(bodyQ(b, _bq)), r = _ae.copy(rel).divideScalar(d);
      const lat = Math.asin(Math.max(-1, Math.min(1, r.dot(ax)))), east = ax.cross(r);
      const el = east.length();
      if (el > 1e-6) out.vair.addScaledVector(east, (140 * Math.cos(lat * 7) * Math.min(1, out.P)) / el);
    }
    out.vair.applyQuaternion(iq);
    return out;
  }
  // L'air où est le joueur (pour l'écran, voir main.js) : les couches d'une géante qu'il traverse
  airStep() {
    const { player, toast } = this.g;
    const A = this.inVoid && !this.transit ? this.airOf(player.pos, this.airHere) : null;
    if (!A) this.airHere.giant = false, this.airHere.rho = 0;
    const L = A?.giant && A.P > 0.3 ? A.layer : null;
    if (L !== this.layerHere) {
      this.layerHere = L;
      const now = performance.now(), said = (this.layerSaid ||= new Map());
      if (L && !(now - (said.get(L.name) || -1e9) < 60000)) { said.set(L.name, now); toast(A.body.name + ' : ' + L.name + ' — ' + fmtBar(A.P) + ', ' + Math.round(A.T - KELVIN) + ' °C'); }
    }
    const SP = suitP(this.g.survival().head?.id), lim = player.pilot ? HULL_P : SP, over = A?.giant && A.P > lim;
    if (over && !this.creak) toast(player.pilot ? 'La coque craque : ' + fmtBar(A.P) + ' (elle en tient ' + HULL_P + ', écrasée au double). Remonte !' : 'La combinaison ne tient que ' + SP + ' bars : remonte !');
    this.creak = over;
  }
  // Le joueur seul dans l'air d'un astre (sans fusée) : traînée, échauffement (une combinaison spatiale
  // tient ~150 °C), pression (voir hazards)
  playerAir(E, dt) {
    const { player } = this.g, air = this.airOf(E.pos, this.airMe);
    if (air.rho <= 0 && !this.meAero.aeroSt) return;
    const P = this.meAero;
    P.vel = E.vel;
    if (player.fly) { P.aeroSt = null; return; } // (créatif, en vol : rien ne nous touche)
    aeroStep(P, dt, air, { noDamage: true });
    const S = P.aeroSt, sv = this.g.survival();
    if (!sv.on || sv.dead) return;
    // (trop chaud : on brûle ; trop de pression : on étouffe, écrasé, voir hazards pour la fin)
    const head = sv.head?.id, SK = suitSkin(head), SP = suitP(head), hot = S.skin > SK, crush = air.P > SP;
    this.hurtT = hot || crush ? (this.hurtT || 0) + dt : 0;
    if (this.hurtT > (hot ? Math.max(0.3, 2 - (S.skin - SK) / 200) : Math.max(0.3, 2.5 - (air.P - SP) / (SP / 3)))) {
      this.hurtT = 0; sv.damage(1);
      if (!this.hurtSaid) { this.hurtSaid = true; this.g.toast(hot ? 'La combinaison brûle : ' + Math.round(S.skin - KELVIN) + ' °C ! Il faut une fusée et un bouclier thermique' : 'La pression t\'écrase : ' + air.P.toFixed(1) + ' bars ! Remonte'); }
    }
    if (!hot && !crush) this.hurtSaid = false;
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
      const need = b.kind === 'hole' ? b.R * 2 : b.kind === 'star' ? b.R * 1.08 : b.molten ? b.R * 1.05 : b.R * 0.98;
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
      toast(cause === 'star' ? 'La fusée a brûlé dans ' + (b.molten ? 'la lave de ' : '') + b.name : 'La pression ' + de(b.name) + ' a écrasé la fusée');
      structs.remove(E.s);
      return;
    }
    toast(cause === 'star' ? 'Tu as brûlé dans ' + (b.molten ? 'la lave de ' : '') + b.name : 'La pression ' + de(b.name) + ' t\'a écrasé');
    survival().damage(9999);
  }

  // Poser un bloc dans une bulle : elle s'ancre (une station ne tombe pas)
  anchorAt(q, r) {
    if (this.transit) return; // (le long d'une ligne spatiale : pas une bulle)
    const x = q + r / 2, z = r * SQ3, B = this.bubbleAt(x, z);
    if (!B || B.anchored) return;
    // (en plein saut, la bulle file : elle ne s'ancre pas, ce qu'on y pose file avec elle)
    if (B.wv) { this.g.toast("En plein saut, rien ne s'ancre : sors du saut pour construire une station"); return; }
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
    if (B.orb) return; // (une station en orbite reste autour de son astre : voir stepOrbits)
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

  // Le système où l'on est : celui de l'astre de sa bulle (ou de la planète sous ses pieds)
  originHere() {
    const { player } = this.g;
    if (this.zone >= 0) return systemOf(zoneBody(this.zone)).id;
    const B = this.transit ? this.transitB : this.bubbleAt(player.pos.x, player.pos.z);
    return B && BODY[B.ref] ? systemOf(BODY[B.ref]).id : 'star';
  }
  update(dt) {
    if (!this.on) return;
    const { player, net, structs } = this.g, seed = this.g.seed();
    this.day = this.g.day();
    clock.day = this.day; clock.seed = seed;
    // (les positions se comptent depuis le centre du système où l'on est : précises au bloc près,
    // même à des milliers d'années-lumière d'Hexa ; voir system.setOrigin)
    setOrigin(this.originHere());
    for (const id of NAMES) bodyPos(id, this.day, seed, this.bp[id]);
    if (this.inVoid) this.galaxyNear(dt);
    this.stepOrbits();
    this.stepTransit(dt);
    // quelles bulles sont habitées ?
    this.liveIds.clear();
    const addLive = (p) => { const id = this.idAt(p.x, p.z); if (id) this.liveIds.add(id); };
    addLive(player.pos);
    for (const p of net.otherPlayers()) addLive(p.pos);
    // les bulles avancent : en chute libre autour de leur astre
    const me = this.me;
    for (const B of this.spaces.values()) if (B.dim7 && (B.dim7.t += dt) >= B.dim7.stay && !net.isClient) this.exitDim(B);
    for (const B of this.spaces.values()) {
      if (B.anchored || B.dim7 || !this.liveIds.has(B.id)) continue;
      if (B.wv) { if (B.owner !== me) B.c.addScaledVector(B.wv, dt); continue; }
      const b = BODY[B.ref], d = B.c.length(), hole = b.kind === 'hole';
      // (même en volant, on ne résiste plus sous la dernière orbite stable d'un trou noir)
      if (d > 1 && (!B.hold || (hole && d < b.R * 3))) {
        if (hole) this.fall(B, b, d, dt);
        else B.v.addScaledVector(_a.copy(B.c).divideScalar(-d), G_K * (b.gravity || 0) * (b.R / d) ** 2 * dt);
      }
      // (jamais la vitesse de la lumière : la relativité ; un trou noir a ses propres règles, voir fall)
      if (!hole && B.v.lengthSq() > (C_LIGHT * 0.999) ** 2) B.v.setLength(C_LIGHT * 0.999);
      B.c.addScaledVector(B.v, dt);
      this.rebase(B);
    }
    this.joinTime = (this.clock.join -= dt) <= 0;
    if (this.joinTime) this.clock.join = 0.25;
    this.airStep();
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
    if (!net.isClient) this.jumpPrepTick(dt);
    this.holeFx(dt);
    if (this.inside) this.insideHole(dt);
    this.jumpFlashes(dt);
    this.riftsFx(dt);
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
    // (les vaisseaux villageois en saut : un point rouge, bleu pour les pionniers)
    const vill = new Map();
    for (const r of this.g.rebelRadar?.() || []) { const SB = this.bubbleAt(r.s.pos.x, r.s.pos.z); if (SB) vill.set(SB.id, r.ally ? '#7ab8ff' : '#ff6a5a'); }
    for (const B of this.spaces.values()) {
      if (B.rock || B.ruin) continue;
      const on = !!B.wv, before = was.get(B.id) || false;
      if (on !== before) {
        was.set(B.id, on);
        // (gardé par rapport à son astre : l'éclair reste là où le saut a commencé)
        if (B.id !== mine) fx.push({ ref: B.ref, c: B.c.clone(), t: 0, life: on ? 1.8 : 1.2, size: on ? 0.16 : 0.11 });
      }
      if (on && B.id !== mine) live.push({ ...at(B.ref, B.c), size: vill.has(B.id) ? 0.045 : 0.035, k: 1, color: vill.get(B.id) || '#d9ccff' });
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
      if (h) net.sendTo(c.cid, { t: 'rkh', f: h.fuel, c: h.cap, h: h.throttle, v: h.v, vy: h.vy, g: !!s.warp, o: !!s.warp?.over });
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
    // la vitesse (relativité restreinte) : 1 / sqrt(1 - v² / c²). Hors du saut seulement : dans la bulle,
    // c'est l'espace qui bouge, le vaisseau y est immobile, son temps est celui des étoiles
    let gam = 1;
    if (this.inVoid && !this.transit && !fx) {
      const B = this.bubbleAt(player.pos.x, player.pos.z), c = player.pilot?.s || player.standingOn || null;
      if (B && !B.wv) { const v = Math.min(C_LIGHT * 0.99999, _b.copy(c ? c.vel : player.vel).applyQuaternion(B.Q).add(B.v).length()); gam = 1 / Math.sqrt(1 - (v / C_LIGHT) ** 2); }
    }
    this.velGamma = gam;
    this.dilation = net.active ? 1 : dil * gam;
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
      #sp-marks .m.rb i { background: #ff4a3a; }
      #sp-marks .m.rb span { color: #ff9a8a; font-weight: 600; }
      #sp-marks .m.rb.al i { background: #3a8ad8; }
      #sp-marks .m.rb.al span { color: #9acbff; }
      #sp-marks .m.rb.t i { background: #ffd060; }
      #sp-marks .m.rb.t span { color: #ffd060; }
      #sp-marks .m.rb.r span, #sp-marks .m.rb.r small { left: auto; right: 10px; text-align: right; }
      #sp-marks .m.rb.edge i { width: 14px; height: 14px; left: -8px; top: -8px; outline: 2px solid rgba(255, 255, 255, 0.5); }
      #sp-panel { position: fixed; right: 12px; top: 12px; max-width: 320px; padding: 8px 12px; border-radius: 8px; z-index: 6; pointer-events: none; color: #dce8f4; font: 12px/1.45 system-ui, sans-serif; background: rgba(19, 23, 27, 0.78); border-left: 3px solid #3fd6ee; border-radius: 0; clip-path: polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 14px 100%, 0 calc(100% - 14px)); }
      #sp-panel .d { color: #9ab4cc; }
      #sp-panel b { color: #fff; }
      #sp-heat { position: fixed; inset: 0; z-index: 5; pointer-events: none; opacity: 0; }
      #sp-flash { position: fixed; inset: 0; z-index: 7; pointer-events: none; opacity: 0; }
      #sp-pick { position: fixed; left: 50%; top: 50%; transform: translate(-50%, -50%); min-width: 300px; max-width: min(420px, calc(100vw - 32px)); padding: 8px 0; z-index: 8; pointer-events: none; color: #dce8f4; font: 13px/1.4 system-ui, sans-serif; background: rgba(19, 23, 27, 0.9); border-left: 3px solid #ffd060; clip-path: polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 14px 100%, 0 calc(100% - 14px)); }
      #sp-pick .h { padding: 0 12px 6px; color: #ffd060; font-weight: 600; }
      #sp-pick .r { display: flex; justify-content: space-between; gap: 12px; padding: 2px 12px 2px 8px; }
      #sp-pick .r small { color: #9ab4cc; white-space: nowrap; }
      #sp-pick .r.aim span { color: #ffe9a8; }
      #sp-pick .r.on { background: rgba(255, 208, 96, 0.2); }
      #sp-pick .r.on span { color: #fff; font-weight: 600; }
      #sp-pick .more { text-align: center; color: #9ab4cc; font-size: 10px; }
      #sp-pick .k { padding: 6px 12px 0; color: #9ab4cc; font-size: 11px; }
      @media (max-width: 600px) { #sp-panel { font-size: 11px; right: 6px; top: 6px; max-width: 200px; } }`;
      document.head.appendChild(st);
    }
    const add = (id) => { const e = document.createElement('div'); e.id = id; document.body.appendChild(e); return e; };
    const marks = add('sp-marks'), panel = add('sp-panel'), heat = add('sp-heat'), flash = add('sp-flash'), pick = add('sp-pick');
    marks.hidden = panel.hidden = pick.hidden = true;
    const els = {};
    for (const b of ALL) {
      const e = document.createElement('div');
      e.className = 'm';
      e.innerHTML = '<i></i><span></span><small></small>';
      e.children[1].textContent = b.name;
      marks.appendChild(e);
      els[b.id] = e;
    }
    this.dom = { marks, panel, heat, flash, pick, els, sites: new Map(), radar: new Map(), rp: new THREE.Vector3() };
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
    if (!on) { for (const el of this.dom.radar.values()) el.remove(); this.dom.radar.clear(); }
    this.fitPanel();
    if (!on) { this.dom.heat.style.opacity = '0'; this.closePick(); }
    if (this.streaks) this.streaks.visible = false;
  }
  // N : la liste des repères. Dedans : les astres du système où l'on est, et l'étoile qu'on vise au
  // centre de l'écran (n'importe quelle étoile du ciel : chacune est celle d'un vrai système, où le
  // saut J se guide tout seul). N ou Entrée : choisir ; flèches ou molette : se déplacer ; Retour
  // arrière ou Échap : fermer
  bodiesAdded(list) {
    for (const b of list) {
      this.bp[b.id] = bodyPos(b.id, this.day, this.g.seed(), { x: 0, y: 0, z: 0 });
      if (this.dom && !this.dom.els[b.id]) {
        const e = document.createElement('div');
        e.className = 'm';
        e.innerHTML = '<i></i><span></span><small></small>';
        e.children[1].textContent = b.name;
        e.style.display = 'none';
        this.dom.marks.appendChild(e);
        this.dom.els[b.id] = e;
      }
    }
  }
  // (la position d'ici, comptée depuis Hexa, en années-lumière)
  absLy(abs) {
    const A = originAbs(this.g.seed(), this._oa ||= { x: 0, y: 0, z: 0 });
    return { x: (abs.x + A.x) / LY, y: (abs.y + A.y) / LY, z: (abs.z + A.z) / LY };
  }
  // Les systèmes de la Voie lactée tout proches (à moins d'une année-lumière ; en saut, ceux qu'on
  // atteindra dans quelques secondes) : ils prennent vie, avec leurs astres, leurs orbites, leur monde
  galaxyNear(dt) {
    const { player } = this.g, B = this.transit ? this.transitB : this.bubbleAt(player.pos.x, player.pos.z);
    if (!B || !this.bp[B.ref]) return;
    const v = B.wv ? B.wv.length() : 0;
    if ((this.clock.gal = (this.clock.gal || 0) - dt) > 0 && v < 1e10) return;
    this.clock.gal = 0.5;
    const o = this.bp[B.ref], P = this.absLy({ x: o.x + B.c.x, y: o.y + B.c.y, z: o.z + B.c.z });
    const r = Math.max(GAL_NEAR, (v * GAL_AHEAD) / LY);
    for (const i of galNear(P.x, P.y, P.z, Math.min(r, 400), this._gn ||= [])) if (!isMaterialized(i)) materialize(i);
  }
  toggleTargets() {
    if (!this.inVoid) return;
    if (this.pick) { this.pickChoose(); return; }
    const { player, camera } = this.g, B = this.transit ? this.transitB : this.bubbleAt(player.pos.x, player.pos.z);
    if (!B) return;
    const abs = this.toAbs(B, camera.position, new THREE.Vector3()), fwd = camera.getWorldDirection(new THREE.Vector3()).applyQuaternion(B.Q);
    const here = systemNear(abs, this.day, this.g.seed()), dist = (b) => { const o = this.bp[b.id]; return Math.hypot(o.x - abs.x, o.y - abs.y, o.z - abs.z); };
    const items = [{ id: null, name: 'Aucun repère' }];
    let aim = null, best = AIM;
    for (const b of LIGHTS) {
      if (SYS.get(b.id) === here) continue;
      const o = this.bp[b.id], d = dist(b), c = ((o.x - abs.x) * fwd.x + (o.y - abs.y) * fwd.y + (o.z - abs.z) * fwd.z) / d;
      const a = Math.acos(Math.max(-1, Math.min(1, c)));
      if (a < best) { best = a; aim = b; }
    }
    // (et les 20 000 étoiles de la Voie lactée : celle qu'on vise prend vie, voir galaxyNear)
    const G = this.absLy(abs);
    let gi = -1;
    for (let i = 0; i < GAL_N; i++) {
      if (isMaterialized(i)) continue;
      const dx = GX[i] - G.x, dy = GY_[i] - G.y, dz = GZ[i] - G.z, d = Math.hypot(dx, dy, dz);
      const a = Math.acos(Math.max(-1, Math.min(1, (dx * fwd.x + dy * fwd.y + dz * fwd.z) / d)));
      if (a < best) { best = a; gi = i; }
    }
    if (gi >= 0) { materialize(gi); aim = BODY[gxId(gi)]; }
    if (aim) items.push({ id: aim.id, name: aim.name, aim: true, sys: SYS.get(aim.id).name, d: dist(aim) - aim.R });
    for (const b of ALL) if (SYS.get(b.id) === here) items.push({ id: b.id, name: b.name, depth: DEPTH.get(b.id), d: Math.max(0, dist(b) - b.R), kind: b.kind });
    const i = aim ? 1 : Math.max(0, items.findIndex((x) => x.id === this.target));
    this.pick = { items, i, sys: here.name };
    this.renderPick();
  }
  pickMove(n) {
    const P = this.pick;
    if (!P) return;
    P.i = (P.i + n + P.items.length) % P.items.length;
    this.renderPick();
  }
  pickChoose() {
    const P = this.pick;
    if (!P) return;
    const it = P.items[P.i];
    this.target = it.id;
    this.closePick();
    this.clock.panel = 0;
    this.g.toast(it.id ? 'Repère : ' + it.name + (it.aim ? ' (système ' + it.sys + ' : J pour y sauter)' : '') : 'Plus de repère');
  }
  closePick() {
    this.pick = null;
    if (this.dom?.pick) this.dom.pick.hidden = true;
  }
  // une touche pendant que la liste est ouverte (true : elle est prise ; Échap la ferme et ouvre
  // aussi le menu de pause, comme d'habitude)
  pickKey(code) {
    if (!this.pick) return false;
    if (code === 'ArrowUp' || code === 'KeyW') this.pickMove(-1);
    else if (code === 'ArrowDown' || code === 'KeyS') this.pickMove(1);
    else if (code === 'PageUp') this.pickMove(-8);
    else if (code === 'PageDown') this.pickMove(8);
    else if (code === 'Enter' || code === 'NumpadEnter' || code === 'KeyN') this.pickChoose();
    else if (code === 'Backspace') this.closePick();
    else if (code === 'Escape') { this.closePick(); return false; }
    else return false;
    return true;
  }
  renderPick() {
    this.buildDom();
    const P = this.pick, el = this.dom.pick;
    if (!P) { el.hidden = true; return; }
    const esc = (t) => String(t).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
    const icon = (it) => (it.aim ? '◎' : it.kind === 'star' ? '✦' : it.kind === 'hole' ? '●' : it.kind === 'gas' || it.kind === 'ice' ? '◍' : it.id ? '⬢' : '✕');
    // (une fenêtre de 14 lignes autour du choix)
    const from = Math.max(0, Math.min(P.i - 6, P.items.length - 14)), rows = P.items.slice(from, from + 14);
    el.innerHTML = '<div class="h">Repères · système ' + esc(P.sys) + '</div>'
      + (from > 0 ? '<div class="more">▲</div>' : '')
      + rows.map((it, k) => {
        const on = from + k === P.i, cur = it.id && it.id === this.target;
        const pad = it.depth ? ' style="padding-left:' + (8 + 14 * it.depth) + 'px"' : '';
        return '<div class="r' + (on ? ' on' : '') + (it.aim ? ' aim' : '') + '"' + pad + '><span>' + icon(it) + ' ' + esc(it.name) + (cur ? ' ·' : '') + '</span>'
          + (it.aim ? '<small>visée · ' + esc(it.sys) + ' · ' + fmtD(it.d) + '</small>' : it.d !== undefined ? '<small>' + fmtD(it.d) + '</small>' : '') + '</div>';
      }).join('')
      + (from + 14 < P.items.length ? '<div class="more">▼</div>' : '')
      + '<div class="k">↑ ↓ ou molette : choisir · N ou Entrée : valider · Retour arrière : fermer<br>Une autre étoile : vise-la au centre de l\'écran, puis N</div>';
    el.hidden = false;
  }
  // (une direction hors de l'écran : le point du bord de l'écran de ce côté-là, pour le radar)
  edge(dir, W, H) {
    const { camera } = this.g;
    _b.copy(dir).applyMatrix4(_m.copy(camera.matrixWorldInverse).setPosition(0, 0, 0));
    let x = _b.x, y = -_b.y;
    const n = Math.hypot(x, y);
    if (n < 1e-6) { x = 0; y = 1; } else { x /= n; y /= n; }
    const t = Math.min((W / 2 - 40) / Math.max(1e-6, Math.abs(x)), (H / 2 - 40) / Math.max(1e-6, Math.abs(y)));
    return [W / 2 + x * t, H / 2 + y * t];
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
    // (les astres du système où l'on est, et le repère ; de loin, ils se superposent : le plus gros
    // garde son repère. Des autres systèmes : rien que leurs étoiles dans le ciel, voir skyview.js)
    const marks = [], here = systemNear(abs, this.day, this.g.seed());
    for (const b of ALL) {
      const o = this.bp[b.id], d = Math.hypot(o.x - abs.x, o.y - abs.y, o.z - abs.z), alt = d - b.R;
      if (!near || alt < near.alt) near = { b, alt };
      if ((SYS.get(b.id) !== here || alt > MARK_MAX) && this.target !== b.id) { const el = this.dom.els[b.id]; if (el.style.display !== 'none') el.style.display = 'none'; continue; }
      marks.push({ b, o, d, alt, k: this.target === b.id ? Infinity : b.R / d * (b.kind === 'star' || b.kind === 'hole' ? 100 : b.kind === 'home' ? 10 : 1) });
    }
    marks.sort((x, y) => y.k - x.k);
    const shown = [];
    for (const { b, o, d, alt } of marks) {
      const el = this.dom.els[b.id];
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
      // (les coins d'espace construits et les stations : jusqu'à MARK_MAX, plus loin seulement s'ils sont le repère choisi)
      if (d > MARK_MAX && this.target !== O.id) continue;
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
    // radar : les vaisseaux rebelles (en rouge) et pionniers (en bleu) à moins de RADAR_R blocs,
    // même hors de l'écran ou derrière soi (leur repère se colle alors au bord, de leur côté)
    const radar = this.g.rebelRadar?.() || [], seenR = new Set();
    for (const { s, ally, label } of radar) {
      const SB = this.bubbleAt(s.pos.x, s.pos.z);
      if (!SB) continue;
      const p = this.toAbs(SB, s.pos, this.dom.rp), d = p.distanceTo(abs), warp = SB.wv ? SB.wv.length() : 0;
      if (d > RADAR_R && !warp) continue; // (en saut : vu de partout, comme le point qui file dans le ciel)
      seenR.add(s.id);
      let el = this.dom.radar.get(s.id);
      if (!el) {
        el = document.createElement('div');
        el.className = 'm rb' + (ally ? ' al' : '');
        el.innerHTML = '<i></i><span></span><small></small>';
        this.dom.marks.appendChild(el);
        this.dom.radar.set(s.id, el);
      }
      const dir = _c.copy(p).sub(abs).divideScalar(Math.max(d, 1e-6)).applyQuaternion(inv);
      let sc = this.project(dir, W, H);
      const out = !sc;
      if (out) sc = this.edge(dir, W, H);
      el.classList.toggle('edge', out);
      el.classList.toggle('r', sc[0] > W - 150); // (au bord droit : le nom à gauche du repère)
      el.classList.toggle('t', this.sync?.id === s.id); // (le vaisseau suivi en synchro)
      if (el.style.display === 'none') el.style.display = '';
      el.style.transform = `translate(${sc[0]}px, ${sc[1]}px)`;
      if (text) { el.children[1].textContent = label; el.children[2].textContent = fmtD(d) + (warp ? ' · en saut ' + fmtV(warp) : ''); }
    }
    for (const [id, el] of this.dom.radar) if (!seenR.has(id)) { el.remove(); this.dom.radar.delete(id); }
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
    if (B.dim7?.tun) {
      // (dans un tunnel : les instruments suivent la traversée)
      const D7 = B.dim7, done = Math.min(D7.tun.L, crossed(D7.t));
      const html = `<div><b style="color:#b08aff">Tunnel de la 7ème dimension</b></div><div>Vers ${D7.tun.to}</div><div>Vitesse ${speedAt(D7.t).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} années-lumière/s</div>`
        + `<div>${fmtLy(done)} sur ${fmtLy(D7.tun.L)}</div><div style="color:#b08aff">Sortie dans ${fmtDur(D7.stay - D7.t)}</div><div class="d">On ne peut pas en sortir avant le bout</div>`;
      if (html !== this.lastPanel) { this.dom.panel.innerHTML = html; this.lastPanel = html; this.fitPanel(); }
      return;
    }
    if (B.dim7) {
      // (dans la 7ème dimension, les instruments ne savent plus rien : ni où, ni à quelle vitesse)
      const t = Math.floor(performance.now() / 700) % 4, html = `<div><b style="color:#ff7ad9">7ème dimension</b></div><div>Vitesse ${['7', '−∞', 'violet', 'mardi'][t]}</div>`
        + `<div>${['? ? ?', 'Distance : oui', 'Position : partout', 'Altitude : dedans'][t]}</div><div class="d">Les instruments ne comprennent plus rien</div>`;
      if (html !== this.lastPanel) { this.dom.panel.innerHTML = html; this.lastPanel = html; this.fitPanel(); }
      return;
    }
    const warp = B.wv ? B.wv.length() : 0;
    const v = warp ||_a.copy(rel).applyQuaternion(B.Q).add(B.v).length();
    const ref = BODY[B.ref];
    const over = s?.warp?.over || (this.g.net.isClient && this.remoteHud?.o);
    // (surcharge : le temps qui reste avant les fissures, ou l'alerte d'une fissure droit devant)
    const overNote = !over ? '' : B.rift ? `<div style="color:#ff5ad0"><b>FISSURE DROIT DEVANT : tourne la fusée !</b> ${Math.max(0, Math.ceil((1 - B.rift[3]) * RIFT_WARN * 10) / 10).toFixed(1)} s</div>`
      : (B.ot || 0) < OVER_SAFE ? `<div style="color:#ff7ad9">Espace-temps stable encore ${fmtMin(OVER_SAFE - (B.ot || 0))}</div>` : '<div style="color:#ff7ad9">L\'espace-temps se fissure : esquive les fissures</div>';
    let html = `<div><b>${warp ? (over ? '<span style="color:#ff7ad9">Saut en SURCHARGE</span>' : 'Saut') : 'Dans l\'espace'}</b></div>${overNote}<div>Vitesse ${fmtV(v)}${B.ref !== 'star' && !warp ? ' <span class="d">(par rapport à ' + ref.name + ')</span>' : ''}</div>`
      + (near.alt < 0 && isGiant(near.b) ? `<div>${fmtD(-near.alt)} sous les nuages ${de(near.b.name)} · ${fmtBar(airOfBody(near.b, near.alt, this.airTmp).P)}</div>` : `<div>${fmtD(Math.max(0, near.alt))} au-dessus ${de(near.b.name)}</div>`)
      + `<div class="d">${B.siteName ? B.siteName : B.rock ? 'Sur un astéroïde' : B.anchored ? 'Coin d\'espace ancré' : B.ref === 'star' || ref.fixed ? (B.c.length() > 0.5 * LY ? 'Entre les étoiles' : 'Entre les planètes') : 'Dans l\'attraction ' + de(ref.name)}</div>`;
    // le saut : la charge de la bulle, la portée qui reste, le refroidissement ; et le temps
    if (s?.jumpPrep) { const J = s.jumpPrep; html += `<div style="color:#c48cff">Charge de la bulle : ${Math.round(Math.min(1, J.t / J.T) * 100)} % (${Math.max(0, Math.ceil(J.T - J.t))} s) · J pour annuler</div>`; }
    else if (s?.jumpCool > 0) html += `<div style="color:#8aa0c8">Réacteur en refroidissement : ${Math.ceil(s.jumpCool)} s</div>`;
    // le moteur de 7ème dimension : la brèche, ou le tunnel le plus proche (cherché chaque seconde)
    if (s?.breach) html += `<div style="color:#b08aff">Brèche : ${Math.round(Math.min(1, s.breach.t / s.breach.T) * 100)} % (${Math.max(0, Math.ceil(s.breach.T - s.breach.t))} s) · I pour annuler</div>`;
    else if (s?.rocket?.d7 && !warp) {
      const now = performance.now();
      if (!this._tun || now - this._tun.at > 1000) { const L = this.absLy(abs); this._tun = { at: now, n: nearestMouth(this.g.seed(), L.x, L.y, L.z) }; }
      const N = this._tun.n;
      html += !N ? `<div class="d">Aucun tunnel de la Seed à moins de ${SENSE_R} al</div>`
        : N.d <= OPEN_R ? `<div style="color:#b08aff">Tunnel à portée : vers ${whereTo(N.m)} (${fmtLy(N.m.t.L)}) · I pour ouvrir la brèche${s.d7Cool > 0 ? ' (dans ' + Math.ceil(s.d7Cool) + ' s)' : ''}</div>`
        : `<div style="color:#8a7ab8">Tunnel de la Seed à ${N.d.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} al, près de ${GNAME[N.m.i]}</div>`;
    }
    if (s?.warp?.manual && s.warp.strict) html += `<div style="color:#c48cff">Bulle : ${(s.warp.dist / LY).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} / ${s.warp.range} années-lumière</div>`;
    if (warp) html += "<div class='d'>Dans la bulle, c'est l'espace qui bouge : ton temps reste celui des étoiles</div>";
    else if (this.velGamma > 1.00001) html += `<div>${((v / C_LIGHT) * 100).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} % de la lumière · 1 s pour toi = ${this.velGamma.toFixed(this.velGamma < 1.01 ? 5 : 3).replace('.', ',')} s dehors</div>`;
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
      const info = T.kind === 'star' ? (T.gal !== undefined && T.id === 'gx' + T.gal && T.gal < GAL_STARS ? [lifeText(T.gal), variableText(T.gal), novaText(T.gal)].filter(Boolean).join(' ') : '') : T.kind === 'hole' ? 'Rien ne revient de l\'horizon' : T.land ? `${T.locked ? 'Air respirable au crépuscule seulement' : T.atmo?.breath ? 'Air respirable' : T.atmo?.density > 0.05 ? 'Air irrespirable' : 'Pas d\'air'} · gravité ×${T.gravity} · ${T.temp} °C` : 'Géante : pas de sol';
      html += `<div style="margin-top:6px"><b style="color:#ffd060">${T.name}</b> : ${fmtD(Math.max(0, d))}</div><div class="d">${T.desc || ''}</div><div class="d">${info}</div>`;
      if (systemOf(T) !== systemNear(abs, this.day, this.g.seed())) {
        html += `<div style="color:#ffd060">Autre système : le saut (J) s'y guide tout seul, environ ${(() => { const t = d / this.jumpTop(s); return t < 90 ? Math.max(1, Math.round(t)) + ' s' : t < 5400 ? Math.round(t / 60) + ' min' : t < 172800 ? Math.round(t / 3600) + ' h' : Math.round(t / 86400) + ' jours'; })()} (jusqu'à ${fmtV(this.jumpTop(s))})</div>`;
        // (en survie : en combien de sauts, et ce que ça coûtera, à peu près)
        if (s?.rocket?.armed && this.g.survival().on) {
          const ly = d / LY, R = this.jumpRange(s), n = Math.max(1, Math.ceil(ly / R)), t = Math.max(1, (s.mass || 20000) / 1000);
          const mb = this.g.rockets.infinite ? 0 : Math.round(ly * LY_COST * Math.max(1, t / 25) + n * JUMP_START * Math.max(1, t / 25));
          html += `<div style="color:#ffd060">${n > 1 ? n + ' sauts (portée ' + R + ' a.l. par saut)' : 'Un saut'}${mb ? ', environ ' + mb.toLocaleString('fr-FR') + ' mB de carburant (tu en as ' + Math.round(this.g.rockets.fuel(s)).toLocaleString('fr-FR') + ')' : ''}</div>`;
        }
      }
    }
    if (this.sync) html += `<div style="margin-top:6px;color:#ffd060"><b>Synchro</b> : ${this.sync.label}${this.sync.d != null ? ' · écart ' + fmtD(this.sync.d) : ''} (Y pour arrêter)</div>`;
    html += `<div class="d" style="margin-top:6px">${s ? 'Z / S : gaz · J : saut · K : surcharge du saut' + (s.rocket?.d7 ? ' · I : brèche (7ème dimension)' : '') + ' · R / F : nez vers l\'avant, l\'arrière · Maj : se lever' + ((this.g.rebelRadar?.() || []).length ? ' · Y : synchro sur un vaisseau villageois' : '') : player.fly ? 'Ctrl en avançant : filer · N : repères' : 'Z Q S D, Espace, Maj : se déplacer · N : repères'}</div>`;
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
