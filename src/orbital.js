// Stations spatiales et vaisseaux automatisés.
//
// Un site (une station dans l'espace, une base au sol) naît d'un noyau de station : ce qui est dans
// sa bulle (ou à moins de SITE_R blocs au sol) en fait partie.
//  - Noyau : nom, repère, vraie orbite autour de l'astre (voir flight.setOrbit).
//  - Générateur d'oxygène : une pièce fermée qui le touche devient respirable. Une pièce percée se
//    vide d'un coup (décompression : joueurs, objets et cartons partent vers la brèche).
//  - Générateur de gravité : la gravité à moins de GRAV_R blocs. Plus loin, on flotte.
//  - Panneau solaire : selon la distance à l'étoile (voir sunPower).
//  - Port d'amarrage : tuyau et câble à la fois. Un vaisseau amarré fait le plein dans le réseau de
//    liquide qui touche le port, et recharge ses batteries sur le réseau électrique.
//  - Entrepôt orbital : un coffre (tapis, bras, entonnoirs le servent comme les autres), où puisent
//    les vaisseaux amarrés et les lanceurs de cargo.
//  - Lanceur de cargo : envoie les piles des entrepôts vers ceux d'un autre site.
//  - Baie de drones : un coffre ; les drones de minage qu'on y range vont dans la ceinture
//    d'astéroïdes et y déposent ce qu'ils rapportent.
//
// Ordinateur de bord (sur un vaisseau) : une suite d'étapes, éventuellement en boucle. Un vaisseau
// en vol automatique n'a pas de physique : il est déplacé d'après le calcul, que quelqu'un soit là
// ou non, partout dans le système. Le saut déplace sa bulle ; il n'y a rien d'autre à simuler.
// Les coffres du vaisseau sont ses soutes. La radio (voir circuits.js) sert à attendre un signal,
// à en émettre un, ou à prévenir que les soutes sont pleines.
//
// Tout se décide chez l'hôte. Un invité envoie ses réglages (act) et reçoit l'état (snapshot).
import * as THREE from 'three';
import { NEIGHBORS, hexToWorld, worldToHex } from './hex.js?v=1.1.5-alpha-mwgq2wrb';
import { BLOCKS, ITEMS, SOLID, makeSlot, CANISTER, FUEL_CANISTER, CREATIVE_CANISTER, BATTERY_BLOCK, MINING_DRONE, VOLTITE_ORE } from './blocks.js?v=1.1.5-alpha-mwgq2wrb';
import { BODY, BODIES, LY, BELTS, LIGHTS, spanOf } from './system.js?v=1.1.5-alpha-mwgq2wrb';
import { zoneOfXZ, zoneBody, bodyZone, slotAt, SLOT, ZONE } from './spacegen.js?v=1.1.5-alpha-mwgq2wrb';
import { CS, DEEP } from './mesher.js?v=1.1.5-alpha-mwgq2wrb';
import { BATTERY_J } from './industry.js?v=1.1.5-alpha-mwgq2wrb';
import { BURN, SPACE_Y } from './rocket.js?v=1.1.5-alpha-mwgq2wrb';
import { ROCKET_EQ, LIQUID_OF_CAN } from './liquids.js?v=1.1.5-alpha-mwgq2wrb';
import { JUMP_START, de } from './spaceflight.js?v=1.1.5-alpha-mwgq2wrb';

const SITE_R = 96;            // (au sol : portée d'un noyau)
const ROOM_MAX = 4096;        // cases d'air au plus : au-delà, la pièce est ouverte
const GRAV_R = 16;
const SOLAR_W = 30;           // watts d'un panneau à la distance d'Hexa
const PORT_W = 100;           // recharge d'un vaisseau amarré
const FUEL_RATE = 1000;       // plein automatique (mB/s)
const USE = { oxy: 8, grav: 20, launch: 40, bay: 15 };
const RESTART_S = 30;          // (des générateurs à bord qui ont calé repartent avec 30 s de réserve)
const STANDOFF = 250;         // (on arrive d'aussi loin dans l'axe du port)
const ARRIVE = 60;
const JUMP_BURN = 30, V0 = 4000, DOUBLE = 1.5, VMAX = 3e7, VFAR = 2.5e11;
const CLIMB_MAX = 220, APPROACH_V = 60;
const TURN_RATE = 0.7;   // saut automatique : le nez du vaisseau tourne de 0,7 rad/s au plus (voir jumpStep)
const ALIGN = 0.97;      // ... il n'accélère que le nez bien dans la route
// Stratégies de combat (étapes sans fin, dans l'espace ; il faut une équipe : clé à molette sur une tourelle)
const FIGHT_STAND = 45;       // (au combat, dans la même bulle : on tourne à cette distance de l'ennemi)
const FIGHT_V = 35;           // ... à cette vitesse (blocs/s)
const CHASE_R = 2e5;          // chasser : un ennemi à moins de 200 000 blocs
const FLEE_R = 1500, FLEE_D = 6e4; // fuir : un ennemi à moins de 1 500 blocs -> un saut de 60 000 blocs à l'opposé
const GUARD_R = 2500;         // garder : un ennemi à moins de 2 500 blocs de l'endroit gardé
const PATROL_R = 3000, PATROL_SEEN = 2000; // patrouiller : des points à moins de 3 000 blocs ; un ennemi à 2 000 blocs : on l'attaque
const CARGO_V = 2e7;          // (vitesse d'une capsule, d'un drone : blocs/s)
const DRONE_TIME = 30, DRONE_LOAD = 4, DRONE_REACH = 3e10;
// ce que rapporte un drone : [objet, poids]
const ORES = [[60, 35], [30, 20], [83, 10], [85, 10], [640, 8], [642, 8], [VOLTITE_ORE, 7], [3973, 12]];
const ORE_SUM = ORES.reduce((n, o) => n + o[1], 0);

const key = (q, r, y) => q + ',' + r + ',' + y;
const parse = (k) => k.split(',').map(Number);
const stackMax = (id) => ITEMS[id]?.stack ?? 64;
const NEAR8 = [[0, 0, 1], ...NEIGHBORS.map(([q, r]) => [q, r, 0]), [0, 0, -1]];
const ID_Q = new THREE.Quaternion();
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();
const num = (v, d = 0) => (Number.isFinite(+v) ? +v : d);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dirVec = (d, out) => { const w = hexToWorld(d[0], d[1]); return out.set(w.x, d[2], w.z).normalize(); };
const fmt = (n) => Math.round(n).toLocaleString('fr-FR');
const hourOf = (t) => (6 + t * 24) % 24;       // (dayTime 0 : le lever du soleil, 6 h)
const timeOfHour = (h) => (((h - 6) / 24) % 1 + 1) % 1;

export const STEP_TYPES = {
  land: 'Se poser à un endroit', spot: "S'arrêter dans l'espace",
  takeoff: 'Décoller', orbit: 'Sauter vers un astre', dock: "S'amarrer à un site", corner: "Aller à un coin d'espace", home: 'Revenir au départ', load: 'Charger', unload: 'Décharger',
  chase: 'Chasser (une autre équipe)', flee: 'Fuir (une autre équipe)', guard: 'Garder cet endroit', patrol: 'Patrouiller autour d\'ici',
  refuel: 'Faire le plein', full: 'Attendre soutes pleines', wait: 'Attendre (secondes)', time: 'Attendre une heure', radio: 'Attendre un signal radio', emit: 'Émettre un signal radio',
};

export class Orbital {
  // g : { world, structs, rockets, flight, industry, containers, circuits, player, scene, toast, survival(), dayTime(), day(), held(), itemName(id), openPanel(), net, cartons }
  constructor(g) {
    this.g = g;
    this.reg = new Map();       // "q,r,y" -> { q, r, y, id, kind } : les blocs de ce module posés dans le monde
    this.welds = new Set();     // soudures de joint (voir doors.js) : cases du monde qui arrêtent l'air
    this.shipWelds = new Map(); // ... et celles des vaisseaux : id de l'objet -> cases locales
    this.joins = new Map();     // vaisseaux amarrés l'un à l'autre (voir shipDock) : id -> [cases venues de l'autre]
    this.joinCool = new Map();  // id -> instant (ms) avant lequel il ne s'amarre plus (on vient de le détacher)
    this.sites = new Map();     // clé du noyau -> site
    this.ships = new Map();     // id de l'objet -> programme et état
    this.charge = new Map();    // id de l'objet -> joules de ses batteries
    this.launch = new Map();    // clé d'un lanceur -> { to, item, t }
    this.bays = new Map();      // clé d'une baie -> { t }
    this.caps = [];             // capsules en route : { from, to, items, t }
    this.portW = new Map();     // port -> watts demandés
    this.dirty = true;
    this.loading = false;
    this.rooms = new Set();     // cases d'air (monde)
    this.shipAir = new Map();   // id de l'objet -> cases d'air (grille de l'objet)
    this.starved = new Set();   // vaisseaux dont les générateurs ont calé (batteries vides) : voir updateRooms
    this.prev = new Map();      // générateur -> sa pièce au dernier calcul
    this.breaches = [];
    this.near = { grav: [], shipGrav: [] };
    this.gravOn = false;
    this.clock = { room: 0, slow: 0, cap: 0, net: 0, info: 0 };
    this.panel = null;
    this.drones = null;
    this.netDirty = false;
  }
  get remote() { return this.g.net.isClient; }

  // ---------- Registre ----------
  clear() {
    this.reg.clear(); this.sites.clear(); this.ships.clear(); this.charge.clear(); this.starved.clear(); this.launch.clear(); this.bays.clear();
    this.caps = []; this.rooms.clear(); this.shipAir.clear(); this.prev.clear(); this.breaches = []; this.portW.clear();
    this.dirty = true;
    this.gravOn = false;
    if (this.drones) this.drones.visible = false;
  }
  scan(mods, CS, DEEP) {
    this.reg.clear();
    for (const [ck, m] of mods) {
      const [cq, cr] = ck.split(',').map(Number);
      for (const [i, id] of m) {
        if (!BLOCKS[id]?.orb) continue;
        const lq = i % CS, lr = Math.floor(i / CS) % CS, y = Math.floor(i / (CS * CS)) - DEEP, q = cq * CS + lq, r = cr * CS + lr;
        this.reg.set(key(q, r, y), { q, r, y, id, kind: BLOCKS[id].orb });
      }
    }
    this.dirty = true;
  }
  onBlock(q, r, y, id, old) {
    const was = BLOCKS[old]?.orb, now = BLOCKS[id]?.orb, k = key(q, r, y);
    if (!id && this.welds.size) this.welds.delete(k); // (bloc cassé : sa soudure part avec)
    if (!was && !now) return;
    if (now) this.reg.set(k, { q, r, y, id, kind: now }); else this.reg.delete(k);
    this.dirty = true;
    if (was === 'core' && now !== 'core') this.dropSite(k);
    if (now === 'core' && was !== 'core') this.newSite(k, q, r, y);
    if (was === 'launch' && now !== 'launch') this.launch.delete(k);
    if (was === 'bay' && now !== 'bay') this.bays.delete(k);
    if ((was === 'oxy' || was === 'grav') && !now) this.prev.delete(k);
  }
  cellXZ(q, r) { return hexToWorld(q, r); }
  newSite(k, q, r, y) {
    const { x, z } = this.cellXZ(q, r), zone = zoneOfXZ(x, z), space = zone < 0;
    const n = [...this.sites.values()].filter((s) => s.zone < 0 === space).length + 1;
    const site = { k, q, r, y, x, z, zone, bid: this.g.flight.idAt(x, z), name: (space ? 'Station ' : 'Base ') + n, orbit: space, ports: [], stores: [], launchers: [], bays: [], fresh: true };
    this.sites.set(k, site);
    this.netDirty = true;
  }
  dropSite(k) {
    const site = this.sites.get(k);
    if (!site) return;
    this.sites.delete(k);
    this.netDirty = true;
    if (site.zone < 0 && !this.remote) {
      const B = this.g.flight.spaces.get(site.bid);
      if (B) { B.siteName = null; this.g.flight.setOrbit(B, false); }
    }
  }
  siteOf(c) {
    const { x, z } = this.cellXZ(c.q, c.r), zone = zoneOfXZ(x, z);
    let best = null, bd = Infinity;
    if (zone < 0) {
      const id = this.g.flight.idAt(x, z);
      for (const s of this.sites.values()) if (s.bid === id) return s;
      return null;
    }
    for (const s of this.sites.values()) {
      if (s.zone !== zone) continue;
      const d = Math.hypot(s.x - x, s.z - z);
      if (d < SITE_R && d < bd) { bd = d; best = s; }
    }
    return best;
  }
  refresh() {
    if (!this.dirty) return;
    this.dirty = false;
    // (noyaux sans site : posés avant le chargement des noms)
    for (const [k, c] of this.reg) if (c.kind === 'core' && !this.sites.has(k)) this.newSite(k, c.q, c.r, c.y);
    for (const s of this.sites.values()) { s.ports = []; s.stores = []; s.launchers = []; s.bays = []; }
    for (const [k, c] of this.reg) {
      if (!['port', 'store', 'launch', 'bay'].includes(c.kind)) continue;
      const s = this.siteOf(c);
      if (!s) continue;
      (c.kind === 'port' ? s.ports : c.kind === 'store' ? s.stores : c.kind === 'launch' ? s.launchers : s.bays).push(k);
    }
  }
  // Une station : son nom, son orbite (dans la bulle)
  syncSiteBubble(site) {
    if (site.zone >= 0 || this.remote) return;
    const fl = this.g.flight, B = fl.bubbleAt(site.x, site.z);
    if (!B || B.rock) { if (B) B.siteName = site.name; return; }
    B.siteName = site.name;
    if (!B.anchored) fl.anchorAt(site.q, site.r);
    if (B.anchored) fl.setOrbit(B, site.orbit);
    fl.push(B);
  }

  // ---------- Énergie ----------
  // Watts demandés par un bloc de ce module (voir industry.usePower)
  useW(k, id) {
    const kind = BLOCKS[id].orb;
    if (kind === 'port') return this.portW.get(k) || 0;
    if (kind === 'launch') return this.launch.get(k)?.to ? USE.launch : 0;
    if (kind === 'bay') return USE.bay;
    return USE[kind] || 0;
  }
  powered(k) { return this.remote || this.g.industry.ratioAt(k) >= 0.5; }
  // Le soleil en ce point (watts d'un panneau) : au carré de la distance à l'étoile ; rien de la
  // nuit au sol ; près d'Érèbe, seule la lueur du disque d'accrétion
  sunPower(x, y, z) {
    const fl = this.g.flight;
    if (!fl.on) return 0;
    const zone = zoneOfXZ(x, z), st = fl.bp.star, A = _a;
    let night = 1;
    if (zone < 0) {
      const id = fl.idAt(x, z), B = id && (fl.spaces.get(id) || (id[0] === 'r' ? fl.bubbleAt(x, z) : null));
      if (!B) return 0;
      fl.toAbs(B, _b.set(x, y, z), A);
    } else {
      const p = fl.bp[zoneBody(zone).id];
      A.set(p.x, p.y, p.z);
      night = Math.max(0, Math.sin(this.g.dayTime() * Math.PI * 2));
    }
    // (toutes les étoiles éclairent, chacune selon son éclat : Hexa, PXT-A, PXT-C)
    const h = fl.bp.hexa, D0 = Math.hypot(h.x - st.x, h.y - st.y, h.z - st.z);
    let W = 0;
    for (const L of LIGHTS) {
      if (L.kind !== 'star') continue;
      const o = fl.bp[L.id], D = Math.max(1, Math.hypot(A.x - o.x, A.y - o.y, A.z - o.z));
      W += SOLAR_W * Math.min(4, (L.lum ?? 1) * (D0 / D) ** 2);
    }
    W = Math.min(SOLAR_W * 4, W);
    const e = fl.bp.erebe;
    if (e && Math.hypot(A.x - e.x, A.y - e.y, A.z - e.z) < 2e8) W = Math.max(W, 0.5); // (la lueur du disque d'accrétion)
    return W * night;
  }
  solarW(q, r, y) { const c = this.cellXZ(q, r); return Math.round(this.sunPower(c.x, y, c.z) * 10) / 10; }

  // ---------- Vaisseaux : ce qu'ils ont à bord ----------
  shipInfo(s) {
    if (s.orbI && s.orbN === s.list.length && s.orbT > performance.now()) return s.orbI;
    const I = { ports: [], oxy: [], grav: [], solar: 0, bat: 0, computer: false, holds: [] };
    for (const [k, id] of s.blocks) {
      const kind = BLOCKS[id]?.orb;
      if (kind === 'port') I.ports.push(parse(k));
      else if (kind === 'oxy') I.oxy.push(k);
      else if (kind === 'grav') I.grav.push(k);
      else if (kind === 'solar') I.solar++;
      else if (kind === 'computer') I.computer = true;
      if (id === BATTERY_BLOCK) I.bat++;
      if (BLOCKS[id]?.container === 'chest') I.holds.push(k);
    }
    s.orbI = I; s.orbN = s.list.length; s.orbT = performance.now() + 3000;
    return I;
  }
  apOf(s) {
    let ap = this.ships.get(s.id);
    if (!ap) { ap = { steps: [], i: 0, run: false, loop: false, ph: null, t: 0, msg: '', docked: null, dock: null, home: null, fullF: 0 }; this.ships.set(s.id, ap); }
    return ap;
  }
  hold(s, on) {
    s.orbHold = on;
    if (on) { s.sleeping = true; s.vel.set(0, 0, 0); s.ang.set(0, 0, 0); s.throttle = 0; s.firing = 0; s.warp = null; }
    else { s.orbGlide = false; s.firing = 0; this.g.structs.wake(s); }
  }
  // Déplace un vaisseau sans physique, et ceux qui sont à bord avec lui
  glide(s, to, quat = null) {
    const { flight: fl, player, structs, net } = this.g;
    const dq = quat ? _q2.copy(quat).multiply(_q3.copy(s.quat).invert()).clone() : null, from = s.pos.clone();
    const carry = (p) => { p.sub(from); if (dq) p.applyQuaternion(dq); p.add(to); };
    if (fl.aboard(player, s)) carry(player.pos);
    for (const p of net.proxies()) if (fl.aboard(p, s)) carry(p.pos);
    structs.teleport(s, to, quat);
    s.vel.set(0, 0, 0);
    s.orbGlide = true;
  }
  boxesOf(s) { return this.shipInfo(s).holds.map((k) => this.g.containers.atStruct(s, k)).filter(Boolean); }
  stockOf(site) { return site.stores.map((k) => { const [q, r, y] = parse(k); return this.g.containers.at(q, r, y); }).filter(Boolean); }
  full(boxes) { return boxes.length > 0 && !boxes.some((b) => b.slots.some((x) => !x || x.n < stackMax(x.id))); }
  // Déplace au plus max objets ; renvoie le nombre déplacé
  transfer(from, to, max, item = 0) {
    const ind = this.g.industry;
    let moved = 0;
    for (const a of from) for (let i = 0; i < a.slots.length && moved < max; i++) {
      const x = a.slots[i];
      if (!x || (item && x.id !== item)) continue;
      let n = Math.min(x.n, max - moved);
      const start = n;
      for (const b of to) { if (n <= 0) break; n = ind.insert(b, makeSlot(x.id, n, x.w)); }
      const put = start - n;
      if (put <= 0) continue;
      x.n -= put; moved += put;
      if (x.n <= 0) a.slots[i] = null;
    }
    return moved;
  }

  // ---------- Amarrage ----------
  portTaken(p, me) {
    for (const [id, ap] of this.ships) if (id !== me && (ap.docked?.port === p || ap.dock?.port === p)) return true;
    return false;
  }
  // Où se mettre sur ce site : le port, le côté, la position du vaisseau (dans le repère du site)
  pickDock(s, site, only = null, wish = null) {
    const { world } = this.g, I = this.shipInfo(s);
    if (!I.ports.length) return null;
    const core = this.cellXZ(site.q, site.r);
    for (const p of only ? [only] : site.ports) {
      if (this.portTaken(p, s.id)) continue;
      const [Q, R, Y] = parse(p), c = this.cellXZ(Q, R);
      const out = _a.set(c.x - core.x, Y - site.y, c.z - core.z), v = new THREE.Vector3();
      // (au sol, on se pose dessus ; dans l'espace, du côté opposé au noyau ; à la main, là où l'on est)
      const dirs = NEAR8.map((d, i) => ({ d, i, w: wish ? dirVec(d, v).dot(wish) : site.zone >= 0 ? (d[2] > 0 ? 2 : d[2] < 0 ? -2 : 0) : dirVec(d, v).dot(out) })).sort((a, b) => b.w - a.w);
      for (const { d, i } of dirs) {
        if (SOLID[world.getBlock(Q + d[0], R + d[1], Y + d[2])]) continue;
        // (le port du vaisseau : le plus proche du site, de ce côté)
        let sp = I.ports[0], best = Infinity;
        for (const e of I.ports) { const w = this.cellXZ(e[0], e[1]), pr = w.x * dirVec(d, v).x + e[2] * v.y + w.z * v.z; if (pr < best) { best = pr; sp = e; } }
        const dq = Q + d[0] - sp[0], dr = R + d[1] - sp[1], dy = Y + d[2] - sp[2];
        let ok = true;
        for (const [q, r, y, id] of s.list) if (SOLID[id] && SOLID[world.getBlock(q + dq, r + dr, y + dy)]) { ok = false; break; }
        if (!ok) continue;
        const w = this.cellXZ(dq, dr);
        return { site: site.k, port: p, dir: i, to: [w.x + s.com.x, dy + s.com.y, w.z + s.com.z] };
      }
    }
    return null;
  }
  undock(s, ap) {
    const d = ap.docked;
    if (!d) return;
    ap.out = dirVec(NEAR8[d.dir], _a).toArray();
    ap.docked = null;
  }
  finishDock(s, ap, D) {
    this.g.structs.teleport(s, _c.fromArray(D.to), ID_Q);
    s.vel.set(0, 0, 0);
    ap.docked = { site: D.site, port: D.port, dir: D.dir };
    ap.dock = null;
    this.g.structs.changed?.(s);
    this.netDirty = true;
  }
  services(s, ap, dt) {
    const { industry, rockets } = this.g, D = ap.docked, I = this.shipInfo(s);
    const [q, r, y] = parse(D.port);
    if (industry.fdirty) industry.rebuildFluids();
    const net = industry.fluidAt(q, r, y);
    // (tout carburant de fusée : 1 mB vaut ROCKET_EQ mB de carburant primaire, voir liquids.js)
    const eq = ROCKET_EQ[net?.f];
    if (eq && s.rocket?.cap) {
      const fuel = rockets.fuel(s), n = Math.min(FUEL_RATE * dt, net.n, (s.rocket.cap - fuel) / eq);
      if (n > 0) { industry.drain(net, n); rockets.setFuel(s, fuel + n * eq); }
    }
    const cap = I.bat * BATTERY_J, cur = this.charge.get(s.id) || 0;
    if (cur < cap) {
      this.portW.set(D.port, PORT_W);
      this.charge.set(s.id, Math.min(cap, cur + PORT_W * industry.ratioAt(D.port) * dt));
    } else this.portW.delete(D.port);
  }
  // À la main : un port du vaisseau qui arrive doucement contre un port du site s'y accroche
  capture(s, ap) {
    const { flight: fl, structs } = this.g, I = this.shipInfo(s);
    if (!I.ports.length || (ap.cool || 0) > 0 || s.vel.length() > 8) return;
    if (1 - Math.abs(s.quat.dot(ID_Q)) > 0.05) return; // (trop de travers)
    const id = fl.idAt(s.pos.x, s.pos.z), zone = zoneOfXZ(s.pos.x, s.pos.z);
    for (const site of this.sites.values()) {
      if (site.zone !== zone || (zone < 0 && site.bid !== id)) continue;
      for (const p of site.ports) {
        const [Q, R, Y] = parse(p), c = this.cellXZ(Q, R);
        for (const e of I.ports) {
          const w = this.cellXZ(e[0], e[1]);
          structs.toWorld(s, _b.set(w.x, e[2] + 0.5, w.z), _b);
          _c.set(c.x, Y + 0.5, c.z);
          if (_b.distanceTo(_c) > 2.6) continue;
          const D = this.pickDock(s, site, p, _b.clone().sub(_c).normalize());
          if (!D) continue;
          this.hold(s, true);
          this.finishDock(s, ap, D);
          this.g.toast('Amarré à ' + site.name + ' (gaz pour se détacher)');
          return;
        }
      }
    }
  }

  // ---------- Le programme ----------
  fail(ap, msg) {
    if (ap.msg !== msg) { ap.msg = msg; this.netDirty = true; }
    return false;
  }
  say(ap, msg) { if (ap.msg !== msg) { ap.msg = msg; this.netDirty = true; } }
  next(ap) {
    ap.i++; ap.ph = null; ap.t = 0; ap.T = 0; ap.c = 0;
    if (ap.i >= ap.steps.length) {
      if (ap.loop && ap.steps.length) ap.i = 0;
      else { ap.run = false; ap.msg = 'Programme terminé'; }
    }
    this.netDirty = true;
  }
  stepShip(s, ap, dt) {
    const st = ap.steps[ap.i];
    if (!st) { ap.run = false; return; }
    ap.t = (ap.t || 0) + dt;
    if (this['do_' + st.t](s, ap, dt, st)) this.next(ap);
  }
  checkEngine(s, ap) {
    const R = s.rocket;
    if (!R?.active?.length) return this.fail(ap, 'Moteurs non alimentés : il faut un réacteur au nédrolytium armé');
    if (this.g.rockets.fuel(s) < JUMP_START) return this.fail(ap, 'Réservoirs presque vides');
    return true;
  }
  do_takeoff(s, ap, dt) {
    const zone = zoneOfXZ(s.pos.x, s.pos.z);
    if (!ap.ph) {
      if (!ap.docked && zone < 0) return true;
      if (!this.checkEngine(s, ap)) return false;
      if (ap.docked) { this.undock(s, ap); this.hold(s, true); ap.ph = 'leave'; ap.t = 0; return false; }
      this.hold(s, true); ap.ph = 'climb'; ap.t = 0;
    }
    if (ap.ph === 'leave') { if (this.leave(s, ap, dt)) { ap.ph = zone >= 0 ? 'climb' : null; ap.t = 0; return zone < 0; } return false; }
    return this.climb(s, ap, dt);
  }
  leave(s, ap, dt) {
    this.say(ap, 'Largage');
    this.glide(s, s.pos.clone().addScaledVector(_c.fromArray(ap.out), 8 * dt));
    return ap.t > 2.5;
  }
  climb(s, ap, dt) {
    const { rockets, flight: fl } = this.g, zone = zoneOfXZ(s.pos.x, s.pos.z);
    this.say(ap, 'Décollage');
    s.firing = 1;
    rockets.setFuel(s, rockets.fuel(s) - BURN * (s.rocket.burn ?? s.rocket.active.length) * dt);
    this.glide(s, s.pos.clone().setY(s.pos.y + Math.min(CLIMB_MAX, 15 + 45 * ap.t) * dt));
    if (s.pos.y <= SPACE_Y) return false;
    s.firing = 0;
    const B = fl.ascend({ s, pos: s.pos, vel: s.vel }, zone);
    B.hold = true;
    ap.t = 0;
    return true;
  }
  do_orbit(s, ap, dt, st) { return this.travel(s, ap, dt, { body: st.body }); }
  do_dock(s, ap, dt, st) { return this.travel(s, ap, dt, { site: st.site }); }
  do_corner(s, ap, dt, st) { return this.travel(s, ap, dt, { corner: st.b }); }
  do_land(s, ap, dt, st) { return this.travel(s, ap, dt, { ground: st }); }
  do_spot(s, ap, dt, st) { return this.travel(s, ap, dt, { corner: st.b, spot: st.p }); }
  // ---------- Se poser (trajet simple) ----------
  // Le dessous du vaisseau, droit : sa distance sous le centre (s.pos)
  underside(s) {
    let lo = Infinity;
    for (const [, , y] of s.list) lo = Math.min(lo, y);
    return s.com.y - lo;
  }
  // La hauteur où poser le vaisseau (son centre) au-dessus de (x, z) : le plus haut bloc sous sa
  // coque (le terrain, le sol de la base, l'eau...)
  landY(s, x, z) {
    const { world } = this.g, seen = new Set();
    let top = -Infinity;
    for (const [q, r] of s.list) {
      const c = hexToWorld(q, r), h = worldToHex(x + c.x - s.com.x, z + c.z - s.com.z), k = h.q + ',' + h.r;
      if (seen.has(k)) continue;
      seen.add(k);
      const base = Math.max(0, world.surface(h.q, h.r).h);
      for (let y = Math.min(SPACE_Y - 40, base + 96); y >= base - 2; y--) {
        const id = world.getBlock(h.q, h.r, y);
        if (id && (SOLID[id] || BLOCKS[id]?.liquid || BLOCKS[id]?.lava)) { top = Math.max(top, y); break; }
      }
    }
    return (top === -Infinity ? 64 : top) + 1 + this.underside(s) + 0.05;
  }
  // Au-dessus du point d'arrivée : monter, aller au-dessus, descendre droit, se poser (vitesse nulle)
  landing(s, ap, dt, G) {
    const name = zoneBody(G.k)?.name || '?';
    if (!ap.land) ap.land = { y: this.landY(s, G.x, G.z), up: null };
    const L = ap.land;
    L.up ??= Math.min(SPACE_Y - 30, Math.max(s.pos.y, L.y + 30));
    const flat = Math.hypot(G.x - s.pos.x, G.z - s.pos.z);
    let to, v;
    if (flat > 0.3 && s.pos.y < L.up - 0.5) { this.say(ap, 'Décollage'); to = new THREE.Vector3(s.pos.x, L.up, s.pos.z); v = 30; }
    else if (flat > 0.3) { this.say(ap, "En route vers le point d'atterrissage"); to = new THREE.Vector3(G.x, L.up, G.z); v = Math.min(APPROACH_V, flat * 1.2 + 2); }
    else { this.say(ap, 'Atterrissage sur ' + name); to = new THREE.Vector3(G.x, L.y, G.z); v = Math.min(APPROACH_V, Math.abs(s.pos.y - L.y) * 0.9 + 1.5); }
    const d = s.pos.distanceTo(to), step = v * dt;
    if (d <= step + 0.02) {
      if (to.y !== L.y || flat > 0.3) { this.glide(s, to); return false; }
      this.g.structs.teleport(s, to, ID_Q);
      ap.land = null;
      this.hold(s, false);
      s.vel.set(0, 0, 0); s.ang.set(0, 0, 0); s.throttle = 0;
      this.g.structs.changed?.(s);
      this.say(ap, 'Posé sur ' + name);
      return true;
    }
    const k = step / d;
    this.glide(s, s.pos.clone().lerp(to, k), s.quat.clone().slerp(ID_Q, Math.min(1, k * 2 + dt)));
    return false;
  }
  // Les arrêts du trajet simple (« + Ici » : là où est le vaisseau ; « + Un astre » : son point d'arrivée)
  stopHere(s) {
    const { flight: fl } = this.g, zone = zoneOfXZ(s.pos.x, s.pos.z);
    if (zone >= 0) return { t: 'land', k: zone, x: Math.round(s.pos.x * 10) / 10, z: Math.round(s.pos.z * 10) / 10 };
    const B = fl.bubbleAt(s.pos.x, s.pos.z);
    if (!B || B.rock || fl.transit) return null;
    if (!B.anchored) { const h = worldToHex(s.pos.x, s.pos.z); fl.anchorAt(h.q, h.r); }
    return B.anchored ? { t: 'spot', b: B.id, p: s.pos.toArray().map((v) => Math.round(v * 10) / 10) } : null;
  }
  stopOn(id) {
    const b = BODY[id], k = id === 'hexa' ? 0 : bodyZone(id);
    return { t: 'land', k, x: k * ZONE + (b.locked ? spanOf(b) / 4 : 0), z: 0 };
  }
  // Le programme est-il un trajet simple ? (seulement des arrêts, et des attentes)
  isSimple(steps) { return steps.every((e) => e.t === 'land' || e.t === 'spot' || e.t === 'wait'); }
  // ---------- Les coins d'espace (bulles ancrées : voir spaceflight.js) ----------
  corners() { return [...this.g.flight.spaces.values()].filter((B) => B.anchored && !B.rock); }
  cornerName(id) {
    const B = this.g.flight.spaces.get(id);
    if (!B) return "(coin d'espace disparu)";
    return (B.siteName || "Coin d'espace " + B.ix + ',' + B.iz) + ' (près ' + de(BODY[B.ref]?.name || '?') + ')';
  }
  // Ce qu'il y a dans un coin d'espace (ses blocs, les objets collés qui y sont, sauf le vaisseau s) :
  // la boîte qui l'entoure, en coordonnées du monde de la bulle ; null s'il est vide
  // (from : la place du vaisseau ; near : le point de ce contenu le plus proche de lui, et la marge
  // à garder autour : 1 pour un bloc, son rayon pour un objet collé)
  cornerBox(O, s, from = null) {
    const { world, structs, flight: fl } = this.g, sl = slotAt(O.ix, O.iz), half = SLOT / 2;
    const min = new THREE.Vector3(Infinity, Infinity, Infinity), max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
    let near = null, nd = Infinity;
    const see = (x, y, z, pad) => {
      min.min(_a.set(x - pad, y - pad, z - pad)); max.max(_a.set(x + pad, y + pad, z + pad));
      if (!from) return;
      const d = Math.hypot(x - from.x, y - from.y, z - from.z) - pad;
      if (d < nd) { nd = d; near = { p: new THREE.Vector3(x, y, z), pad }; }
    };
    for (const [k, m] of world.mods) {
      if (!m.size) continue;
      const [cq, cr] = k.split(',').map(Number);
      if (Math.abs(cq * CS - sl.q0) > half || Math.abs(cr * CS - sl.r0) > half) continue;
      for (const [i, id] of m) {
        if (!id) continue;
        const lq = i % CS, lr = Math.floor(i / CS) % CS, y = Math.floor(i / (CS * CS)) - DEEP, w = hexToWorld(cq * CS + lq, cr * CS + lr);
        see(w.x, y + 0.5, w.z, 1);
      }
    }
    for (const o of structs.list) if (o !== s && fl.idAt(o.pos.x, o.pos.z) === O.id) see(o.pos.x, o.pos.y, o.pos.z, o.radius);
    return min.x <= max.x ? { c: min.clone().add(max).multiplyScalar(0.5), R: max.distanceTo(min) / 2, near } : null;
  }
  do_home(s, ap, dt) {
    if (!ap.home) return this.fail(ap, 'Pas de point de départ : lance le programme amarré, ou commence par « S\'amarrer »');
    return this.travel(s, ap, dt, { site: ap.home });
  }
  afterLeave(s, goal) {
    const { flight: fl } = this.g, zone = zoneOfXZ(s.pos.x, s.pos.z);
    if (goal.corner) return zone >= 0 ? 'climb' : fl.idAt(s.pos.x, s.pos.z) === goal.corner ? 'corner' : 'cruise';
    if (goal.ground) return zone === goal.ground.k && Math.hypot(goal.ground.x - s.pos.x, goal.ground.z - s.pos.z) < 3000 ? 'land' : zone >= 0 ? 'climb' : 'cruise';
    const site = goal.site && this.sites.get(goal.site);
    if (zone >= 0) return site?.zone === zone && Math.hypot(site.x - s.pos.x, site.z - s.pos.z) < 3000 ? 'approach' : 'climb';
    return site && site.zone < 0 && site.bid === fl.idAt(s.pos.x, s.pos.z) ? 'approach' : 'cruise';
  }
  needDock(s, ap, site) {
    if (ap.dock && this.sites.has(ap.dock.site) && ap.dock.site === site.k) return true;
    this.refresh();
    if (!site.ports.length) return this.fail(ap, site.name + " n'a pas de port d'amarrage");
    const D = this.pickDock(s, site);
    if (!D) return this.fail(ap, 'Attente d\'un port libre à ' + site.name);
    ap.dock = D;
    return true;
  }
  // Une étape de voyage : se détacher, monter, sauter, arriver. Vrai : on y est
  travel(s, ap, dt, goal) {
    const { flight: fl, rockets } = this.g, E = { s, pos: s.pos, vel: s.vel };
    const site = goal.site ? this.sites.get(goal.site) : null;
    if (goal.site && !site) return this.fail(ap, 'Ce site n\'existe plus');
    if (goal.body && !BODY[goal.body]) return this.fail(ap, 'Astre inconnu');
    const O = goal.corner ? fl.spaces.get(goal.corner) : null;
    if (goal.corner && (!O || !O.anchored)) return this.fail(ap, "Ce coin d'espace n'existe plus");
    if (!ap.ph) {
      ap.box = null; ap.to = null; ap.land = null;
      if (site && ap.docked?.site === site.k) return true;
      const G = goal.ground;
      if (G && zoneOfXZ(s.pos.x, s.pos.z) === G.k && Math.hypot(G.x - s.pos.x, G.z - s.pos.z) < 8 && s.vel.length() < 0.5) return true; // (déjà posé là)
      if (goal.spot && !ap.docked && s.pos.distanceTo(_c.fromArray(goal.spot)) < 3) return true;
      if (site && !this.shipInfo(s).ports.length) return this.fail(ap, "Il faut un port d'amarrage sur le vaisseau");
      if (!this.checkEngine(s, ap)) return false;
      this.hold(s, true);
      if (ap.docked) { this.undock(s, ap); ap.ph = 'leave'; ap.t = 0; return false; }
      ap.ph = this.afterLeave(s, goal); ap.t = 0;
    }
    if (ap.ph === 'leave') { if (this.leave(s, ap, dt)) { ap.ph = this.afterLeave(s, goal); ap.t = 0; } return false; }
    if (ap.ph === 'climb') { if (this.climb(s, ap, dt)) { ap.ph = this.afterLeave(s, goal); ap.t = 0; } return false; }
    if (ap.ph === 'land') return this.landing(s, ap, dt, goal.ground);
    if (ap.ph === 'corner') {
      // à côté de ce qu'il y a dans le coin d'espace, en ralentissant, et vitesse nulle à l'arrivée
      const name = this.cornerName(goal.corner);
      if (!ap.to && goal.spot) ap.to = goal.spot.slice();
      if (!ap.to) {
        const box = this.cornerBox(O, s, s.pos);
        if (!box) { this.hold(s, false); s.vel.set(0, 0, 0); s.ang.set(0, 0, 0); this.say(ap, 'Arrivé à ' + name); return true; }
        // (vers le point le plus proche de ce qu'il y a là, en s'arrêtant à quelques blocs de lui)
        const { p, pad } = box.near, dir = s.pos.clone().sub(p);
        if (dir.lengthSq() < 1e-6) dir.set(1, 0, 0);
        ap.to = p.clone().addScaledVector(dir.normalize(), pad + s.radius + 3).toArray();
      }
      this.say(ap, 'Approche de ' + name);
      const to = _c.fromArray(ap.to).clone(), d = s.pos.distanceTo(to), step = Math.min(APPROACH_V, d * 1.2 + 2) * dt;
      if (d <= step + 0.02) {
        this.g.structs.teleport(s, to, null);
        ap.to = null;
        this.hold(s, false);
        s.vel.set(0, 0, 0); s.ang.set(0, 0, 0); s.throttle = 0;
        this.g.structs.changed?.(s);
        this.say(ap, 'Arrivé à ' + name);
        return true;
      }
      this.glide(s, s.pos.clone().lerp(to, step / d));
      return false;
    }
    if (ap.ph === 'approach') {
      if (!this.needDock(s, ap, site)) return false;
      this.say(ap, 'Approche de ' + site.name);
      const to = _c.fromArray(ap.dock.to).clone(), d = s.pos.distanceTo(to), step = Math.min(APPROACH_V, d * 1.2 + 2) * dt;
      if (d <= step + 0.02) {
        this.finishDock(s, ap, ap.dock);
        this.say(ap, 'Amarré à ' + site.name);
        return true;
      }
      const k = step / d, q = s.quat.clone().slerp(ID_Q, Math.min(1, k * 1.5));
      this.glide(s, s.pos.clone().lerp(to, k), q);
      return false;
    }
    // ---- en saut ----
    let B = fl.bubbleAt(s.pos.x, s.pos.z);
    if (!B) return false;
    if (site && !this.needDock(s, ap, site)) return false;
    if (!ap.cruise) {
      if (!this.checkEngine(s, ap)) return false;
      fl.startWarp(E, B, V0, DOUBLE);
      B = fl.bubbleAt(s.pos.x, s.pos.z);
      rockets.setFuel(s, rockets.fuel(s) - JUMP_START);
      ap.cruise = true; ap.t = 0; ap.wt = 0;
    }
    const fuel = rockets.fuel(s) - JUMP_BURN * dt;
    if (fuel <= 0) { B.wv = null; s.firing = 0; return this.fail(ap, 'Panne sèche : plus de carburant'); }
    rockets.setFuel(s, fuel);
    const here = fl.toAbs(B, s.pos, new THREE.Vector3()), there = new THREE.Vector3();
    let name;
    if (O) {
      // (vers le milieu du coin d'espace, en s'arrêtant un peu avant : l'approche finit le trajet)
      const box = ap.box ||= (goal.spot ? { c: new THREE.Vector3().fromArray(goal.spot), R: 0 } : this.cornerBox(O, s)) || { c: new THREE.Vector3(O.ox, 100, O.oz), R: 0 };
      fl.toAbs(O, box.c, there);
      const back = there.clone().sub(here), dd = back.length();
      if (dd > 1) there.addScaledVector(back, -Math.min(dd, box.R + s.radius + 60) / dd); // (assez près pour voir ce qu'il y a là)
      name = this.cornerName(goal.corner);
    } else if (goal.ground) {
      fl.groundAbs(goal.ground.k, goal.ground.x, goal.ground.z, fl.entryAlt - 20, there);
      name = zoneBody(goal.ground.k)?.name || '?';
    } else if (site?.zone < 0) {
      const O = fl.bubbleAt(site.x, site.z), t = _c.fromArray(ap.dock.to).clone().addScaledVector(dirVec(NEAR8[ap.dock.dir], _b), STANDOFF);
      fl.toAbs(O, t, there);
      name = site.name;
    } else if (site) {
      fl.groundAbs(site.zone, site.x, site.z, fl.entryAlt - 20, there);
      name = site.name;
    } else {
      const b = BODY[goal.body], o = fl.bp[b.id];
      there.set(here.x - o.x, here.y - o.y, here.z - o.z).setLength(b.R * (b.kind === 'hole' ? 12 : 1) + Math.max(b.R * 0.4, 20000)).add(_b.set(o.x, o.y, o.z));
      name = b.name;
    }
    const d = there.distanceTo(here);
    this.say(ap, 'Saut vers ' + name);
    s.firing = 2; // (moteurs en mode saut : flammes violettes, voir rocket.js)
    if (d > ARRIVE && !this.jumpStep(s, ap, B, here, there, d, dt)) return false;
    // arrivé
    s.firing = 0;
    ap.cruise = false; ap.t = 0;
    B.wv = null; B.v.set(0, 0, 0); B.hold = true;
    fl.rebase(B, true);
    fl.push(B);
    if (O) {
      ap.box = null;
      if (O !== B) fl.enter(E, B, O);
      ap.ph = 'corner'; ap.to = null;
      return false;
    }
    if (site?.zone < 0) {
      const O = fl.bubbleAt(site.x, site.z);
      fl.enter(E, B, O);
      ap.ph = 'approach';
      return false;
    }
    if (site) { fl.arriveGround(E, B, site.zone, site.x, site.z); this.hold(s, true); ap.ph = 'approach'; return false; }
    if (goal.ground) { fl.arriveGround(E, B, goal.ground.k, goal.ground.x, goal.ground.z); this.hold(s, true); ap.ph = 'land'; ap.land = null; return false; }
    return true;
  }
  // Un pas de saut automatique, comme un vrai pilote : le vaisseau file nez en avant ; son nez
  // tourne peu à peu vers la route (TURN_RATE), et il n'accélère que bien aligné : les trajectoires
  // sont des courbes. Un astre sur le chemin : on vise le bord, du côté où passe la route, et l'on
  // en fait le tour (jamais à travers : on glisse sur sa sphère). Renvoie true à l'arrivée.
  jumpStep(s, ap, B, here, there, d, dt) {
    const fl = this.g.flight, want = there.clone().sub(here).divideScalar(d);
    const hard = [];
    let block = null, bt = Infinity, clear = Infinity;
    for (const b of Object.values(BODY)) { // (l'étoile comprise)
      const o = fl.bp[b.id];
      if (!o || !(b.R > 0)) continue;
      const C = new THREE.Vector3(o.x, o.y, o.z);
      let R = b.R * (b.kind === 'hole' ? 12 : b.kind === 'star' ? 1.5 : 1.08);
      const dThere = C.distanceTo(there), dHere = C.distanceTo(here);
      if (dThere < R * 1.2) R = Math.min(R, dThere * 0.97); // (l'astre où l'on arrive : juste sous le point d'arrivée)
      if (dHere < R) R = dHere * 0.99;                        // (déjà trop près : on ne le repousse pas, il s'éloigne)
      hard.push([C, R]);
      clear = Math.min(clear, dHere - R);
      // la route droite passe-t-elle à travers ? (le plus proche sur le chemin)
      const t = Math.max(0, Math.min(d, _b.copy(C).sub(here).dot(want)));
      const P = here.clone().addScaledVector(want, t);
      // (une marge de 10 % en chemin ; l'arrivée elle-même, juste au-dessus du sol, ne compte pas)
      if (P.distanceTo(C) < (t >= d - 1 ? R : R * 1.1) && t < bt) { bt = t; block = { C, R, P }; }
    }
    const aim = want.clone();
    if (block) {
      // (le point au bord de l'astre, du côté où la route passe : on le contourne par là)
      const u = block.P.clone().sub(block.C);
      if (u.lengthSq() < 1e-6) { u.crossVectors(_b.set(0, 1, 0), want); if (u.lengthSq() < 1e-6) u.set(1, 0, 0); }
      aim.copy(block.C).addScaledVector(u.normalize(), block.R * 1.35).sub(here);
      const dc = here.distanceTo(block.C);
      if (aim.length() < block.R * 0.3 || dc < block.R * 1.4) {
        // (déjà au bord : on en fait le tour, le long de sa surface, vers l'arrivée, à 1,3 rayon)
        const rh = here.clone().sub(block.C).divideScalar(dc), tg = want.clone().addScaledVector(rh, -want.dot(rh));
        if (tg.lengthSq() < 1e-6) { tg.crossVectors(rh, _b.set(0, 1, 0)); if (tg.lengthSq() < 1e-6) tg.set(1, 0, 0); }
        aim.copy(tg.normalize()).addScaledVector(rh, Math.max(-0.5, Math.min(0.5, (block.R * 1.3 - dc) / (block.R * 0.3))));
      }
      aim.normalize();
    }
    // le nez (le haut du vaisseau) tourne vers la visée, sans dépasser TURN_RATE
    const iq = B.Q.clone().invert();
    const noseL = new THREE.Vector3(0, 1, 0).applyQuaternion(s.quat), aimL = aim.clone().applyQuaternion(iq);
    const ang = noseL.angleTo(aimL);
    const rot = new THREE.Quaternion().setFromUnitVectors(noseL, aimL);
    const q = new THREE.Quaternion().slerp(rot, Math.min(1, (TURN_RATE * dt) / Math.max(ang, 1e-6))).multiply(s.quat).normalize();
    this.glide(s, s.pos.clone(), q);
    const nose = new THREE.Vector3(0, 1, 0).applyQuaternion(q).applyQuaternion(B.Q);
    // la vitesse : elle monte bien aligné (sinon elle retombe), freine en approchant de tout astre
    // et de l'arrivée, et suit l'alignement (on ne file pas de travers)
    const align = Math.max(0, nose.dot(aim));
    ap.wt = align > ALIGN ? (ap.wt || 0) + dt : Math.max(0, (ap.wt || 0) - 2 * dt);
    let v = Math.min(d > LY * 0.01 ? VFAR : VMAX, V0 * 2 ** (ap.wt / DOUBLE), 2 * d + 200, Math.max(V0, 2 * clear));
    v *= Math.max(0.03, align * align);
    const step = v * dt;
    if (step >= d - ARRIVE && align > 0.9) {
      B.c.add(_b.copy(there).sub(here));
      fl.rebase(B);
      return true;
    }
    const to = here.clone().addScaledVector(nose, step);
    for (const [C, R] of hard) { const r = to.distanceTo(C); if (r < R) to.sub(C).multiplyScalar(R / Math.max(r, 1e-6)).add(C); }
    B.wv = to.clone().sub(here).divideScalar(Math.max(dt, 1e-6));
    B.c.add(_b.copy(to).sub(here));
    fl.rebase(B);
    return to.distanceTo(there) <= ARRIVE;
  }
  // ---------- Stratégies de combat ----------
  // Les engins d'une autre équipe qui sont dans l'espace : [{ s, B (leur bulle), abs (position absolue) }]
  // (null : ce vaisseau n'a pas d'équipe)
  foes(s) {
    const W = this.g.weapons, fl = this.g.flight, team = W?.teamOfStruct(s);
    if (!team) return null;
    const out = [];
    for (const e of this.g.structs.list) {
      if (e === s || !e.list.length) continue; // (même loin du joueur, déchargé : on sait où il est)
      const t = W.teamOfStruct(e);
      if (!t || t === team) continue;
      const B = fl.bubbleAt(e.pos.x, e.pos.z);
      if (B) out.push({ s: e, B, abs: fl.toAbs(B, e.pos, new THREE.Vector3()) });
    }
    return out;
  }
  nearest(list, P) {
    let best = null, bd = Infinity;
    for (const f of list) { const d = f.abs.distanceTo(P); if (d < bd) { bd = d; best = f; } }
    return best ? { f: best, d: bd } : null;
  }
  // Être dans l'espace : se détacher, décoller. Renvoie la bulle, ou null (pas encore)
  spaceReady(s, ap, dt) {
    const fl = this.g.flight;
    if (ap.docked) { if (!this.checkEngine(s, ap)) return null; this.undock(s, ap); this.hold(s, true); ap.ph = 'leave'; ap.t = 0; return null; }
    if (ap.ph === 'leave') { if (this.leave(s, ap, dt)) { ap.ph = null; ap.t = 0; } return null; }
    const B = fl.bubbleAt(s.pos.x, s.pos.z);
    if (B) { if (ap.ph === 'climb') ap.ph = null; if (!s.orbHold) this.hold(s, true); return B; }
    if (ap.ph !== 'climb') { if (!this.checkEngine(s, ap)) return null; this.hold(s, true); ap.ph = 'climb'; ap.t = 0; }
    if (this.climb(s, ap, dt)) { ap.ph = null; ap.t = 0; }
    return null;
  }
  // (la position absolue d'un endroit retenu : par rapport à l'astre de sa bulle, qui bouge)
  keep(B, pos) { return { ref: B.ref, p: this.g.flight.toRel(B, pos, new THREE.Vector3()).toArray() }; }
  markAbs(m, out = new THREE.Vector3()) { const o = this.g.flight.bp[m.ref]; return out.fromArray(m.p).add(_b.set(o.x, o.y, o.z)); }
  // Sortie du saut (on s'arrête là)
  stopCruise(s, ap, B) {
    if (!ap.cruise) return;
    const fl = this.g.flight;
    s.firing = 0; ap.cruise = false;
    B.wv = null; B.v.set(0, 0, 0); B.hold = true;
    fl.rebase(B, true);
    fl.push(B);
  }
  // Aller en saut jusqu'au point absolu there (la bulle file) ; vrai à l'arrivée
  goAbs(s, ap, B, there, dt) {
    const fl = this.g.flight, rk = this.g.rockets;
    let here = fl.toAbs(B, s.pos, new THREE.Vector3());
    if (here.distanceTo(there) <= ARRIVE) { this.stopCruise(s, ap, B); return true; }
    if (!ap.cruise) {
      if (!this.checkEngine(s, ap)) return false;
      fl.startWarp({ s, pos: s.pos, vel: s.vel }, B, V0, DOUBLE);
      B = fl.bubbleAt(s.pos.x, s.pos.z);
      rk.setFuel(s, rk.fuel(s) - JUMP_START);
      ap.cruise = true; ap.wt = 0;
      here = fl.toAbs(B, s.pos, here);
    }
    const fuel = rk.fuel(s) - JUMP_BURN * dt;
    if (fuel <= 0) { this.stopCruise(s, ap, B); return this.fail(ap, 'Panne sèche : plus de carburant'); }
    rk.setFuel(s, fuel);
    s.firing = 2;
    if (this.jumpStep(s, ap, B, here, there, here.distanceTo(there), dt)) { this.stopCruise(s, ap, B); return true; }
    return false;
  }
  // Attaquer l'ennemi f : dans la même bulle, on tourne autour de lui à portée des tourelles ;
  // tout près (et lui arrêté) : on entre dans sa bulle ; plus loin, on le rattrape en saut (même s'il saute)
  fight(s, ap, B, f, here, dt) {
    const fl = this.g.flight;
    if (fl.idAt(f.s.pos.x, f.s.pos.z) === B.id) {
      this.stopCruise(s, ap, B);
      const off = s.pos.clone().sub(f.s.pos);
      if (off.lengthSq() < 1e-4) off.set(1, 0, 0);
      const d = off.length();
      off.divideScalar(d);
      const side = _c.crossVectors(off, _b.set(0, 1, 0));
      if (side.lengthSq() < 1e-4) side.set(1, 0, 0);
      const to = f.s.pos.clone().addScaledVector(off, FIGHT_STAND).addScaledVector(side.normalize(), FIGHT_STAND * 0.5);
      const dd = s.pos.distanceTo(to), step = Math.min(FIGHT_V * dt, dd);
      if (dd > 0.05) this.glide(s, s.pos.clone().lerp(to, step / dd));
      this.say(ap, 'Combat : ennemi à ' + Math.round(d) + ' blocs');
      return;
    }
    const d = here.distanceTo(f.abs);
    if (d < 600 && !f.B.wv) {
      this.stopCruise(s, ap, B);
      fl.join({ s, pos: s.pos, vel: s.vel }, B, f.B, here, f.B.v.clone(), true);
      return;
    }
    this.say(ap, 'Poursuite : ennemi à ' + fmt(d) + ' blocs');
    this.goAbs(s, ap, B, f.abs.clone().add(here.clone().sub(f.abs).setLength(250)), dt);
  }
  noTeam(ap) { return this.fail(ap, "Pas d'équipe : clé à molette sur une tourelle du vaisseau"); }
  do_chase(s, ap, dt) {
    const B = this.spaceReady(s, ap, dt);
    if (!B) return false;
    const L = this.foes(s);
    if (!L) return this.noTeam(ap);
    const here = this.g.flight.toAbs(B, s.pos, new THREE.Vector3()), n = this.nearest(L, here);
    if (n && n.d < CHASE_R) this.fight(s, ap, B, n.f, here, dt);
    else { this.stopCruise(s, ap, B); this.say(ap, 'Chasse : aucun ennemi en vue'); }
    return false;
  }
  do_flee(s, ap, dt) {
    const B = this.spaceReady(s, ap, dt);
    if (!B) return false;
    const L = this.foes(s);
    if (!L) return this.noTeam(ap);
    const fl = this.g.flight, here = fl.toAbs(B, s.pos, new THREE.Vector3());
    if (ap.fto) {
      this.say(ap, 'Fuite en saut');
      if (this.goAbs(s, ap, B, this.markAbs(ap.fto), dt)) ap.fto = null;
      return false;
    }
    const n = this.nearest(L, here);
    if (n && n.d < FLEE_R) {
      // (à l'opposé de l'ennemi, un peu de travers : on ne sait jamais où l'on va réapparaître)
      const dir = here.clone().sub(n.f.abs).normalize().add(_c.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(0.8)).normalize();
      const to = here.clone().addScaledVector(dir, FLEE_D);
      ap.fto = { ref: B.ref, p: to.sub(_b.set(fl.bp[B.ref].x, fl.bp[B.ref].y, fl.bp[B.ref].z)).toArray() };
    } else this.say(ap, n ? 'Aux aguets : ennemi à ' + fmt(n.d) + ' blocs' : 'Aux aguets : aucun ennemi');
    return false;
  }
  do_guard(s, ap, dt) {
    const B = this.spaceReady(s, ap, dt);
    if (!B) return false;
    const L = this.foes(s);
    if (!L) return this.noTeam(ap);
    const fl = this.g.flight, here = fl.toAbs(B, s.pos, new THREE.Vector3());
    ap.gh ||= this.keep(B, s.pos);
    const home = this.markAbs(ap.gh), n = this.nearest(L, home);
    if (n && n.d < GUARD_R) { this.fight(s, ap, B, n.f, here, dt); return false; }
    if (here.distanceTo(home) > ARRIVE * 1.5) { this.say(ap, 'Retour à son poste'); this.goAbs(s, ap, B, home, dt); }
    else { this.stopCruise(s, ap, B); this.say(ap, 'En garde'); }
    return false;
  }
  do_patrol(s, ap, dt) {
    const B = this.spaceReady(s, ap, dt);
    if (!B) return false;
    const L = this.foes(s);
    if (!L) return this.noTeam(ap);
    const fl = this.g.flight, here = fl.toAbs(B, s.pos, new THREE.Vector3());
    ap.gh ||= this.keep(B, s.pos);
    const n = this.nearest(L, here);
    if (n && n.d < PATROL_SEEN) { ap.pw = null; this.fight(s, ap, B, n.f, here, dt); return false; }
    if (!ap.pw) {
      const u = _c.set(Math.random() - 0.5, (Math.random() - 0.5) * 0.4, Math.random() - 0.5).normalize().multiplyScalar(PATROL_R * (0.4 + Math.random() * 0.6));
      ap.pw = { ref: ap.gh.ref, p: _b.fromArray(ap.gh.p).add(u).toArray(), wait: 0 };
    }
    if (ap.pw.wait > 0) { ap.pw.wait -= dt; this.say(ap, 'Patrouille : pause'); if (ap.pw.wait <= 0) ap.pw = null; return false; }
    this.say(ap, 'Patrouille');
    if (this.goAbs(s, ap, B, this.markAbs(ap.pw), dt)) ap.pw.wait = 4;
    return false;
  }
  needDocked(s, ap) { return ap.docked ? this.sites.get(ap.docked.site) : (this.fail(ap, 'Il faut être amarré'), null); }
  do_load(s, ap, dt, st) { return this.cargo(s, ap, dt, st, true); }
  do_unload(s, ap, dt, st) { return this.cargo(s, ap, dt, st, false); }
  cargo(s, ap, dt, st, load) {
    const site = this.needDocked(s, ap);
    if (!site) return false;
    this.refresh();
    const holds = this.boxesOf(s), stock = this.stockOf(site);
    if (!holds.length) return this.fail(ap, 'Pas de soute : pose un coffre sur le vaisseau');
    if (!stock.length) return this.fail(ap, site.name + " n'a pas d'entrepôt orbital");
    if ((ap.c = (ap.c || 0) - dt) > 0) return false;
    ap.c = 0.25;
    this.say(ap, (load ? 'Chargement à ' : 'Déchargement à ') + site.name);
    const moved = load ? this.transfer(stock, holds, 64, st.item) : this.transfer(holds, stock, 64, st.item);
    if (moved) { ap.idle = 0; return false; }
    if (load && st.full && !this.full(holds)) { this.say(ap, 'Attente de marchandise à ' + site.name); return false; }
    return true;
  }
  do_refuel(s, ap, dt) {
    if (!this.needDocked(s, ap)) return false;
    const { rockets } = this.g, R = s.rocket;
    if (!R?.cap) return true;
    this.say(ap, 'Plein de carburant');
    return rockets.fuel(s) >= R.cap - 0.5;
  }
  do_full(s, ap) {
    const b = this.boxesOf(s);
    if (!b.length) return this.fail(ap, 'Pas de soute : pose un coffre sur le vaisseau');
    this.say(ap, 'Attente : soutes pas encore pleines');
    return this.full(b);
  }
  do_wait(s, ap, dt, st) { this.say(ap, 'Attente : encore ' + Math.ceil(st.sec - ap.t) + ' s'); return ap.t >= st.sec; }
  do_time(s, ap, dt, st) {
    const now = this.g.day();
    if (!ap.T) { ap.T = Math.floor(now) + timeOfHour(st.h); if (ap.T <= now) ap.T += 1; }
    this.say(ap, 'Départ prévu à ' + Math.floor(st.h) + ' h');
    return now >= ap.T;
  }
  do_radio(s, ap, dt, st) { this.say(ap, 'Attente du signal radio : ' + this.g.itemName(st.f)); return this.g.circuits.freqOn(st.f); }
  do_emit(s, ap, dt, st) {
    this.tx(s, st.f, ap.t < st.sec);
    this.say(ap, 'Signal radio : ' + this.g.itemName(st.f));
    return ap.t >= st.sec;
  }
  // Émet (ou non) sur la fréquence f, au nom du vaisseau
  tx(s, f, on) {
    const { circuits } = this.g, k = 'ship:' + s.id + ':' + f, was = circuits.txOn.has(k);
    if (on === was) return;
    if (on) circuits.txOn.set(k, f); else circuits.txOn.delete(k);
    circuits.refreshFreq(f);
  }

  // ---------- Réglages (l'invité les envoie à l'hôte) ----------
  act(a) {
    if (this.remote) { this.g.net.csend({ t: 'orb', a }); return; }
    this.perform(a);
  }
  cleanSteps(list) {
    const out = [];
    for (const st of Array.isArray(list) ? list.slice(0, 64) : []) {
      if (!st || !STEP_TYPES[st.t]) continue;
      const e = { t: st.t };
      if (st.t === 'dock') e.site = String(st.site);
      if (st.t === 'land') { if (!Number.isInteger(st.k) || st.k < 0 || !zoneBody(st.k) || !Number.isFinite(st.x) || !Number.isFinite(st.z)) continue; e.k = st.k; e.x = st.x; e.z = st.z; }
      if (st.t === 'spot') { if (typeof st.b !== 'string' || !Array.isArray(st.p) || st.p.length !== 3 || !st.p.every(Number.isFinite)) continue; e.b = st.b.slice(0, 40); e.p = st.p.slice(); }
      if (st.t === 'corner') { if (typeof st.b !== 'string' || !st.b) continue; e.b = st.b.slice(0, 40); }
      if (st.t === 'orbit') { if (!BODY[st.body]) continue; e.body = st.body; }
      if (st.t === 'load' || st.t === 'unload') { e.item = Number.isInteger(st.item) ? st.item : 0; if (st.t === 'load') e.full = !!st.full; }
      if (st.t === 'wait' || st.t === 'emit') e.sec = clamp(num(st.sec, 5), 1, 3600);
      if (st.t === 'time') e.h = clamp(num(st.h, 8), 0, 23.99);
      if (st.t === 'radio' || st.t === 'emit') e.f = Number.isInteger(st.f) ? st.f : 0;
      out.push(e);
    }
    return out;
  }
  perform(a) {
    if (!a || typeof a !== 'object') return;
    this.netDirty = true;
    this.g.world.changed = true;
    if (a.op === 'name') {
      const site = this.sites.get(a.k);
      if (site && typeof a.v === 'string' && a.v.trim()) { site.name = a.v.trim().slice(0, 32); this.syncSiteBubble(site); }
    } else if (a.op === 'orbit') {
      const site = this.sites.get(a.k);
      if (site && site.zone < 0) { site.orbit = !!a.v; this.syncSiteBubble(site); }
    } else if (a.op === 'launch') {
      if (this.reg.get(a.k)?.kind === 'launch') this.launch.set(a.k, { to: typeof a.to === 'string' ? a.to : '', item: Number.isInteger(a.item) ? a.item : 0, t: 0 });
    } else if (a.op === 'prog' || a.op === 'run') {
      const s = this.g.structs.byId(a.id);
      if (!s || !this.shipInfo(s).computer) return;
      const ap = this.apOf(s);
      if (a.op === 'prog') { ap.steps = this.cleanSteps(a.steps); ap.loop = !!a.loop; ap.fullF = Number.isInteger(a.fullF) ? a.fullF : 0; ap.i = Math.min(ap.i, Math.max(0, ap.steps.length - 1)); return; }
      if (a.on) {
        if (!ap.steps.length) { ap.msg = 'Aucune étape'; return; }
        ap.run = true; ap.i = 0; ap.ph = null; ap.t = 0; ap.T = 0; ap.cruise = false; ap.msg = 'En route';
        ap.gh = ap.pw = ap.fto = null; // (stratégies : l'endroit gardé, le point de patrouille, la fuite)
        ap.home = ap.docked?.site || ap.steps.find((e) => e.t === 'dock')?.site || null;
      } else this.stop(s, ap);
    }
  }
  stop(s, ap) {
    ap.run = false; ap.ph = null; ap.cruise = false; ap.dock = null; ap.msg = 'Arrêté';
    const B = this.g.flight.bubbleAt(s.pos.x, s.pos.z);
    if (B?.wv) { B.wv = null; this.g.flight.rebase(B, true); }
    if (!ap.docked) this.hold(s, false);
  }

  // ---------- À chaque image ----------
  update(dt) {
    if (!this.remote && (this.clock.sd = (this.clock.sd ?? 0) - dt) <= 0) { this.clock.sd = 0.25; this.shipDock(); }
    if (!this.g.flight.on) return;
    this.refresh();
    for (const site of this.sites.values()) if (site.fresh && site.zone !== undefined) { site.fresh = false; this.syncSiteBubble(site); }
    if (!this.remote) this.hostUpdate(dt);
    if ((this.clock.room -= dt) <= 0) { this.clock.room = 0.4; this.updateRooms(0.4); }
    this.updateBreaches(dt);
    this.updateGravity();
    this.drawDrones();
  }
  hostUpdate(dt) {
    const { structs, player, net, flight: fl } = this.g;
    const capture = (this.clock.cap -= dt) <= 0;
    if (capture) this.clock.cap = 0.2;
    for (const [id, ap] of this.ships) {
      const s = structs.byId(id);
      if (!s) { this.ships.delete(id); continue; }
      s.orbGlide = false;
      ap.cool = Math.max(0, (ap.cool || 0) - dt);
      if (ap.run) this.stepShip(s, ap, dt);
      if (ap.docked) {
        if (!this.sites.has(ap.docked.site) || !this.reg.has(ap.docked.port)) { this.portW.delete(ap.docked.port); ap.docked = null; ap.run = false; this.hold(s, false); continue; }
        if (!s.orbHold) this.hold(s, true);
        this.services(s, ap, dt);
        if (!ap.run && s.throttle > 0.05 && s.ctl?.active) {
          // (à la main : un peu de gaz, et on se détache)
          this.portW.delete(ap.docked.port);
          this.undock(s, ap);
          ap.cool = 4;
          this.hold(s, false);
          s.vel.fromArray(ap.out).multiplyScalar(3);
          this.g.toast('Détaché');
        }
      }
    }
    // les vaisseaux pilotés : un port qui touche un port
    if (capture) {
      for (const s of structs.list) {
        if (s.orbHold || !s.rocket || !this.shipInfo(s).ports.length) continue;
        if ((player.pilot?.s === s && !player.pilot.passenger) || net.proxies().some((p) => p.pilot?.s === s)) this.capture(s, this.apOf(s));
      }
      this.fullSignals();
    }
    if ((this.clock.slow -= dt) <= 0) { this.clock.slow = 1; this.slow(1); }
    for (let i = this.caps.length - 1; i >= 0; i--) {
      const c = this.caps[i];
      if ((c.t -= dt) > 0) continue;
      this.refresh();
      const site = this.sites.get(c.to) || this.sites.get(c.from);
      if (!site) { this.caps.splice(i, 1); continue; }
      c.items = c.items.map((x) => { let n = x.n; for (const b of this.stockOf(site)) { if (n <= 0) break; n = this.g.industry.insert(b, makeSlot(x.id, n, x.w)); } return n > 0 ? { ...x, n } : null; }).filter(Boolean);
      if (c.items.length) c.t = 5; else this.caps.splice(i, 1);
    }
    if (net.active && (this.clock.net -= dt) <= 0) {
      const flying = [...this.ships.values()].some((a) => a.run);
      if (this.netDirty || flying) { this.clock.net = 1; this.netDirty = false; net.broadcastJoined({ t: 'orbs', d: this.serialize() }); }
    }
  }
  fullSignals() {
    for (const [id, ap] of this.ships) {
      if (!ap.fullF) continue;
      const s = this.g.structs.byId(id);
      if (s) this.tx(s, ap.fullF, this.full(this.boxesOf(s)));
    }
  }
  slow(dt) {
    const { structs, containers, industry } = this.g;
    // panneaux sur les vaisseaux
    for (const s of structs.list) {
      const I = this.shipInfo(s);
      if (!I.solar || !I.bat) continue;
      this.charge.set(s.id, Math.min(I.bat * BATTERY_J, (this.charge.get(s.id) || 0) + this.sunPower(s.pos.x, s.pos.y, s.pos.z) * I.solar * dt));
    }
    // lanceurs de cargo
    for (const [k, c] of this.reg) {
      if (c.kind === 'launch') {
        const L = this.launch.get(k);
        if (!L?.to || (L.t = (L.t || 0) + dt) < 6 || !this.powered(k)) continue;
        L.t = 0;
        const from = this.siteOf(c), to = this.sites.get(L.to);
        if (!from || !to || to === from) continue;
        const items = this.pickCargo(this.stockOf(from), 64, L.item);
        if (!items.length) continue;
        this.caps.push({ from: from.k, to: to.k, items, t: Math.max(4, this.dist(from, to) / CARGO_V) });
        this.cargoSent = true; // (voir les tiers, progress.js)
        this.puff(c);
      } else if (c.kind === 'bay') {
        const B = this.bays.get(k) || { t: 0 };
        this.bays.set(k, B);
        const box = containers.at(c.q, c.r, c.y), n = box ? box.slots.reduce((a, x) => a + (x?.id === MINING_DRONE ? x.n : 0), 0) : 0;
        B.n = n;
        if (!n || !industry.ratioAt(k)) continue;
        const dd = this.beltDist(c);
        if (dd > DRONE_REACH) { B.far = true; continue; }
        B.far = false;
        this.dronesOut = true; // (des drones sont partis miner : voir les tiers, progress.js)
        B.T = DRONE_TIME + dd / CARGO_V;
        if ((B.t += dt) < B.T) continue;
        B.t = 0;
        for (let i = 0; i < n * DRONE_LOAD; i++) {
          let roll = Math.random() * ORE_SUM, id = ORES[0][0];
          for (const [o, w] of ORES) { roll -= w; if (roll <= 0) { id = o; break; } }
          industry.insert(box, makeSlot(id, 1));
        }
        this.g.world.changed = true;
      }
    }
  }
  pickCargo(boxes, max, item) {
    const out = [];
    for (const b of boxes) for (let i = 0; i < b.slots.length && max > 0; i++) {
      const x = b.slots[i];
      if (!x || (item && x.id !== item)) continue;
      const n = Math.min(x.n, max);
      out.push({ id: x.id, n, ...(x.w ? { w: x.w } : {}) });
      x.n -= n; max -= n;
      if (x.n <= 0) b.slots[i] = null;
    }
    return out;
  }
  absOf(c, out) {
    const fl = this.g.flight, { x, z } = this.cellXZ(c.q, c.r), zone = zoneOfXZ(x, z);
    if (zone >= 0) { const p = fl.bp[zoneBody(zone).id]; return out.set(p.x, p.y, p.z); }
    return fl.toAbs(fl.bubbleAt(x, z), _b.set(x, c.y, z), out);
  }
  dist(a, b) { return this.absOf(a, new THREE.Vector3()).distanceTo(this.absOf(b, new THREE.Vector3())); }
  // La distance à la ceinture d'astéroïdes la plus proche
  beltDist(c) {
    const fl = this.g.flight, A = this.absOf(c, new THREE.Vector3()), st = fl.bp.star, rad = Math.hypot(A.x - st.x, A.z - st.z);
    return Math.min(...BELTS.map(([a, b, h]) => Math.hypot(Math.max(a - rad, 0, rad - b), Math.max(0, Math.abs(A.y - st.y) - h))));
  }
  puff(c) {
    const { rockets, player } = this.g, { x, z } = this.cellXZ(c.q, c.r);
    if (!rockets.onSmoke || Math.hypot(player.pos.x - x, player.pos.z - z) > 200) return;
    for (let i = 0; i < 14; i++) rockets.onSmoke(new THREE.Vector3(x, c.y + 1.2, z), new THREE.Vector3((Math.random() - 0.5) * 6, 18 + Math.random() * 14, (Math.random() - 0.5) * 6), 1);
  }

  // ---------- Air ----------
  flood(get, seeds, bound, prev) {
    const room = new Map(), open = new Set();
    let breach = null;
    for (const seed of seeds) {
      const sk = key(...seed);
      if (room.has(sk) || open.has(sk) || get(...seed)) continue;
      const comp = new Map([[sk, seed]]), stack = [seed];
      let leak = !!bound?.(...seed), first = null;
      while (stack.length && !leak) {
        const [q, r, y] = stack.pop();
        for (const [dq, dr, dy] of NEAR8) {
          const n = [q + dq, r + dr, y + dy], k = key(...n);
          if (comp.has(k) || get(...n)) continue;
          if (open.has(k) || comp.size >= ROOM_MAX || bound?.(...n)) { leak = true; if (!first && prev && !prev.has(k)) first = n; break; }
          comp.set(k, n);
          stack.push(n);
          if (!first && prev && !prev.has(k)) first = n;
        }
      }
      if (leak) { for (const k of comp.keys()) open.add(k); if (first && prev?.has(sk) && !breach) breach = first; }
      else for (const [k, v] of comp) room.set(k, v);
    }
    return { room, breach };
  }
  vacuum() {
    const { flight: fl } = this.g;
    return fl.inVoid || !zoneBody(fl.zone)?.atmo?.breath;
  }
  updateRooms(dt) {
    const { world, player, structs } = this.g;
    const rooms = new Set(), P = player.pos;
    this.near.grav = []; this.near.shipGrav = [];
    for (const [k, c] of this.reg) {
      if (c.kind !== 'oxy' && c.kind !== 'grav') continue;
      const w = this.cellXZ(c.q, c.r);
      if (Math.abs(w.x - P.x) > 96 || Math.abs(w.z - P.z) > 96) continue;
      const on = this.powered(k);
      if (c.kind === 'grav') { if (on) this.near.grav.push([w.x, c.y + 0.5, w.z]); continue; }
      if (!on) { this.prev.delete(k); continue; }
      // (un bloc plein, un champ holographique, une soudure de joint : l'air ne passe pas)
      const get = (q, r, y) => { const id = world.getBlock(q, r, y); return SOLID[id] === 1 || !!BLOCKS[id]?.seal || (this.welds.size > 0 && this.welds.has(key(q, r, y))); }, prev = this.prev.get(k);
      const { room, breach } = this.flood(get, NEAR8.map(([dq, dr, dy]) => [c.q + dq, c.r + dr, c.y + dy]), null, prev);
      for (const x of room.keys()) rooms.add(x);
      this.prev.set(k, new Set(room.keys()));
      if (breach && this.vacuum()) { const b = this.cellXZ(breach[0], breach[1]); this.addBreach(b.x, breach[2] + 0.5, b.z, prev); }
    }
    this.rooms = rooms;
    // à bord des vaisseaux (sur leurs batteries)
    this.shipAir.clear();
    for (const s of structs.list) {
      if (s.unloaded || s.pos.distanceToSquared(P) > (s.radius + 48) ** 2) continue;
      const I = this.shipInfo(s);
      if (!I.oxy.length && !I.grav.length) continue;
      const W = I.oxy.length * USE.oxy + I.grav.length * USE.grav, need = W * dt, cur = this.remote ? Infinity : this.charge.get(s.id) || 0;
      // (batteries vides : les générateurs calent, et ne repartent qu'avec quelques secondes de
      // réserve ; sinon, un panneau solaire trop faible les rallumait et les éteignait sans cesse :
      // la gravité du vaisseau clignotait, la vue basculait d'un repère à l'autre)
      if (this.starved.has(s.id)) {
        if (cur < W * RESTART_S) continue;
        this.starved.delete(s.id);
      }
      if (cur < need) {
        this.starved.add(s.id);
        if (s.pos.distanceToSquared(P) < (s.radius + 8) ** 2) this.g.toast(`Batteries vides : les générateurs du vaisseau calent (ils repartiront avec ${RESTART_S} s de réserve)`);
        continue;
      }
      if (!this.remote) this.charge.set(s.id, cur - need);
      for (const k of I.grav) {
        const [q, r, y] = parse(k), w = this.cellXZ(q, r);
        this.near.shipGrav.push([s, w.x, y + 0.5, w.z]);
      }
      if (!I.oxy.length) continue;
      let lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
      for (const [q, r, y] of s.list) { lo = [Math.min(lo[0], q), Math.min(lo[1], r), Math.min(lo[2], y)]; hi = [Math.max(hi[0], q), Math.max(hi[1], r), Math.max(hi[2], y)]; }
      const bound = (q, r, y) => q < lo[0] || r < lo[1] || y < lo[2] || q > hi[0] || r > hi[1] || y > hi[2];
      const WD = this.shipWelds.get(s.id);
      const get = (q, r, y) => { const id = s.blocks.get(key(q, r, y)) || 0; return SOLID[id] === 1 || !!BLOCKS[id]?.seal || !!WD?.has(key(q, r, y)); };
      const seeds = [];
      for (const k of I.oxy) { const [q, r, y] = parse(k); for (const [dq, dr, dy] of NEAR8) seeds.push([q + dq, r + dr, y + dy]); }
      const { room } = this.flood(get, seeds, bound, null);
      this.shipAir.set(s.id, new Set(room.keys()));
    }
  }
  addBreach(x, y, z, room) {
    this.breaches.push({ x, y, z, t: 4, room });
    this.g.toast('Décompression ! La pièce se vide');
  }
  headIn(p) {
    const head = p.pos.y + 1.5, h = worldToHex(p.pos.x, p.pos.z);
    if (this.rooms.has(key(h.q, h.r, Math.floor(head)))) return true;
    for (const [id, set] of this.shipAir) {
      const s = this.g.structs.byId(id);
      if (!s) continue;
      const L = this.g.structs.toLocal(s, _a.set(p.pos.x, head, p.pos.z), _a), c = worldToHex(L.x, L.z);
      if (set.has(key(c.q, c.r, Math.floor(L.y)))) return true;
    }
    return false;
  }
  breathable() { return this.headIn(this.g.player); }
  updateBreaches(dt) {
    if (!this.breaches.length) return;
    const { player, structs, cartons, rockets } = this.g;
    for (let i = this.breaches.length - 1; i >= 0; i--) {
      const b = this.breaches[i];
      if ((b.t -= dt) <= 0) { this.breaches.splice(i, 1); continue; }
      const at = _a.set(b.x, b.y, b.z).clone(), pull = (pos, vel, a) => {
        const v = _b.copy(at).sub(pos), d = v.length();
        if (d > 24 || d < 0.01) return false;
        vel.addScaledVector(v.divideScalar(d), a * dt);
        if (vel.length() > 28) vel.setLength(28);
        return true;
      };
      if (!player.pilot && !player.riding) pull(_c.copy(player.pos).setY(player.pos.y + 1), player.vel, 70);
      if (!this.remote) {
        for (const s of structs.list) if (!s.orbHold && !s.rocket && pull(s.pos, s.vel, 50)) structs.wake(s);
        for (const c of cartons?.list || []) pull(c.pos, c.vel, 60);
      }
      if (rockets.onSmoke && Math.random() < dt * 40) rockets.onSmoke(at.clone(), new THREE.Vector3((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6), 1);
    }
  }

  // ---------- Gravité ----------
  // (skip : un objet n'est pas attiré par ses propres générateurs : il tomberait tout seul, même
  // dans le vide ou sur la Lune)
  inGrav(x, y, z, skip = null) {
    for (const g of this.near.grav) if (Math.hypot(g[0] - x, g[1] - y, g[2] - z) <= GRAV_R) return true;
    for (const [s, gx, gy, gz] of this.near.shipGrav) {
      if (s === skip) continue;
      this.g.structs.toWorld(s, _c.set(gx, gy, gz), _c);
      if (Math.hypot(_c.x - x, _c.y - y, _c.z - z) <= GRAV_R) return true;
    }
    return false;
  }
  updateGravity() {
    const { player, flight: fl } = this.g, on = this.inGrav(player.pos.x, player.pos.y + 0.9, player.pos.z);
    if (on) { player.gravity = 1; this.gravOn = true; }
    else if (this.gravOn) { this.gravOn = false; if (fl.inVoid && !fl.deck) player.gravity = 0; }
  }
  // (les objets libres : voir structs.gravityOf dans main.js)
  gravFor(s) { return !s.rocket && !s.orbHold && this.inGrav(s.pos.x, s.pos.y, s.pos.z, s); }

  // ---------- Drones (de loin, on ne les voit que partir et revenir) ----------
  drawDrones() {
    const { player, scene } = this.g, P = player.pos;
    if (!this.drones) {
      const geo = new THREE.CylinderGeometry(0.35, 0.5, 0.5, 6), mat = new THREE.MeshLambertMaterial({ color: 0x9fb0c0, emissive: 0x204060 });
      this.drones = new THREE.InstancedMesh(geo, mat, 48);
      this.drones.frustumCulled = false;
      scene.add(this.drones);
    }
    let n = 0;
    const m = _m, now = performance.now() / 1000;
    for (const [k, B] of this.bays) {
      if (!B.n || !B.T || B.far) continue;
      const c = this.reg.get(k);
      if (!c) continue;
      const w = this.cellXZ(c.q, c.r);
      if (Math.abs(w.x - P.x) > 400 || Math.abs(w.z - P.z) > 400) continue;
      for (let i = 0; i < Math.min(8, B.n) && n < 48; i++) {
        const p = (((B.t + (now % 1)) / B.T) + i / Math.min(8, B.n)) % 1, e = p < 0.12 ? p / 0.12 : p > 0.88 ? (1 - p) / 0.12 : -1;
        if (e < 0) continue;
        const a = i * 2.4, d = 300 * e * e;
        m.makeTranslation(w.x + Math.cos(a) * d * 0.5, c.y + 1.4 + d, w.z + Math.sin(a) * d * 0.5);
        this.drones.setMatrixAt(n++, m);
      }
    }
    this.drones.count = n;
    this.drones.visible = n > 0;
    if (n) this.drones.instanceMatrix.needsUpdate = true;
  }

  // ---------- Sauvegarde, réseau ----------
  serialize() {
    return {
      sites: [...this.sites.values()].map((s) => [s.k, s.name, s.orbit ? 1 : 0]),
      ships: [...this.ships].filter(([, a]) => a.steps.length || a.docked || a.run).map(([id, a]) => [id, {
        steps: a.steps, i: a.i, run: a.run, loop: a.loop, ph: a.ph, t: a.t, T: a.T || 0, msg: a.msg, docked: a.docked, dock: a.dock, home: a.home, fullF: a.fullF, cruise: !!a.cruise, out: a.out || null,
      }]),
      charge: [...this.charge],
      launch: [...this.launch],
      bays: [...this.bays].map(([k, b]) => [k, b.t]),
      caps: this.caps,
      welds: [...this.welds],
      joins: [...this.joins].filter(([, l]) => l.length),
      shipWelds: [...this.shipWelds].filter(([, w]) => w.size).map(([id, w]) => [id, [...w]]),
    };
  }
  // (après les objets physiques et les bulles)
  load(d) {
    if (!d || typeof d !== 'object') { this.dirty = true; this.refresh(); return; }
    for (const e of Array.isArray(d.sites) ? d.sites : []) {
      const c = this.reg.get(e[0]);
      if (!c || c.kind !== 'core') continue;
      this.newSite(e[0], c.q, c.r, c.y);
      const s = this.sites.get(e[0]);
      s.name = String(e[1]).slice(0, 32);
      s.orbit = !!e[2];
    }
    this.dirty = true;
    this.refresh();
    for (const [id, a] of Array.isArray(d.ships) ? d.ships : []) {
      const s = this.g.structs.byId(id);
      if (!s || !a) continue;
      const ap = this.apOf(s);
      Object.assign(ap, a, { steps: this.cleanSteps(a.steps) });
      if (!this.remote && (ap.docked || ap.run)) this.hold(s, true);
    }
    this.charge = new Map((Array.isArray(d.charge) ? d.charge : []).filter((e) => Array.isArray(e) && Number.isFinite(e[1])));
    this.launch = new Map((Array.isArray(d.launch) ? d.launch : []).filter((e) => Array.isArray(e) && typeof e[0] === 'string' && e[1]));
    this.bays = new Map((Array.isArray(d.bays) ? d.bays : []).filter((e) => Array.isArray(e)).map(([k, t]) => [k, { t: num(t) }]));
    this.caps = (Array.isArray(d.caps) ? d.caps : []).filter((c) => c && Array.isArray(c.items));
    this.joins = new Map((Array.isArray(d.joins) ? d.joins : []).filter((e) => Array.isArray(e) && Number.isInteger(e[0]) && Array.isArray(e[1])).map(([id, l]) => [id, l.filter(Array.isArray).map((x) => x.filter((k) => typeof k === 'string'))]));
    this.welds = new Set((Array.isArray(d.welds) ? d.welds : []).filter((k) => typeof k === 'string'));
    this.shipWelds = new Map((Array.isArray(d.shipWelds) ? d.shipWelds : []).filter((e) => Array.isArray(e) && Number.isInteger(e[0]) && Array.isArray(e[1])).map(([id, w]) => [id, new Set(w.filter((k) => typeof k === 'string'))]));
    // (les bulles gardent déjà leur orbite ; il ne reste que leur nom)
    for (const s of this.sites.values()) {
      s.fresh = false;
      if (s.zone < 0 && !this.remote) { const B = this.g.flight.bubbleAt(s.x, s.z); if (B) B.siteName = s.name; }
    }
  }
  snapshot(d) { // (invité : l'état reçu de l'hôte)
    if (!d) return;
    for (const e of d.sites || []) { const s = this.sites.get(e[0]); if (s) { s.name = String(e[1]).slice(0, 32); s.orbit = !!e[2]; } }
    this.ships.clear();
    for (const [id, a] of d.ships || []) if (Number.isInteger(id) && a) this.ships.set(id, a);
    this.launch = new Map(d.launch || []);
    this.renderStatus();
  }

  // Soudure de joint (voir doors.js) : la case du monde (ou de l'objet s) arrête l'air, ou plus
  weld(k, s = null) {
    const set = s ? (this.shipWelds.get(s.id) || this.shipWelds.set(s.id, new Set()).get(s.id)) : this.welds;
    const on = !set.has(k);
    if (on) set.add(k); else set.delete(k);
    this.dirty = true;
    return on;
  }
  welded(k, s = null) { return s ? !!this.shipWelds.get(s.id)?.has(k) : this.welds.has(k); }

  // Amarrage entre vaisseaux : deux ports d'amarrage (sur deux objets collés) qui se touchent,
  // arrivés doucement et bien alignés : les deux vaisseaux n'en font plus qu'un (Double colle). Clic
  // droit sur l'un des deux ports : ils se séparent.
  shipDock() {
    const { structs } = this.g, now = performance.now();
    const ships = structs.list.filter((x) => !x.unloaded && !x.kinematic && !x.hinge && this.shipInfo(x).ports.length);
    if (ships.length < 2) return;
    const W = (x, e, out) => { const c = this.cellXZ(e[0], e[1]); return structs.toWorld(x, out.set(c.x, e[2] + 0.5, c.z), out); };
    for (const A of ships) {
      if (A.sleeping || (this.joinCool.get(A.id) || 0) > now) continue;
      for (const B of ships) {
        if (B === A || (this.joinCool.get(B.id) || 0) > now || A.pos.distanceTo(B.pos) > A.radius + B.radius + 2) continue;
        if (_a.subVectors(A.vel, B.vel).length() > 2.5 || 1 - Math.abs(A.quat.dot(B.quat)) > 0.02) continue;
        let touch = false;
        for (const ea of this.shipInfo(A).ports) {
          W(A, ea, _b);
          for (const eb of this.shipInfo(B).ports) if (W(B, eb, _c).distanceTo(_b) < 1.25) { touch = true; break; }
          if (touch) break;
        }
        if (!touch) continue;
        const before = new Set(A.blocks.keys()); // (les amarrages de B : oubliés, ses cases changent)
        const err = structs.merge(A, B);
        if (err) { this.joinCool.set(A.id, now + 2000); continue; }
        const added = [...A.blocks.keys()].filter((k) => !before.has(k));
        this.joins.set(A.id, [...(this.joins.get(A.id) || []), added]);
        this.joins.delete(B.id);
        A.orbI = null;
        this.g.toast('Vaisseaux amarrés : clic droit sur un port pour les séparer');
        return;
      }
    }
  }
  // Clic droit sur un port d'un vaisseau amarré à un autre : on les sépare
  undockShip(s, k) {
    const list = this.joins.get(s.id);
    if (!list?.length) return false;
    const [q, r, y] = parse(k), near = [k, ...NEAR8.map(([a, b, c]) => key(q + a, r + b, y + c))];
    const i = list.findIndex((keys) => keys.some((x) => near.includes(x)));
    if (i < 0) return false;
    const cells = list[i].filter((x) => s.blocks.has(x)).map(parse);
    list.splice(i, 1);
    if (!cells.length || cells.length >= s.blocks.size) return false;
    const n = this.g.structs.detach(s, cells);
    const dir = _a.subVectors(n.pos, s.pos);
    if (dir.lengthSq() < 1e-6) dir.set(0, 1, 0);
    dir.normalize();
    n.vel.addScaledVector(dir, 1.5);
    s.vel.addScaledVector(dir, -1.5 * Math.min(1, n.mass / s.mass));
    const until = performance.now() + 4000;
    this.joinCool.set(s.id, until); this.joinCool.set(n.id, until);
    s.orbI = null;
    this.g.structs.wake(s); this.g.structs.wake(n);
    this.g.toast('Vaisseaux séparés');
    return true;
  }

  // ---------- Clic droit ----------
  click(q, r, y, item) {
    const k = key(q, r, y), c = this.reg.get(k);
    if (!c || item === CANISTER || item === FUEL_CANISTER || item === CREATIVE_CANISTER || LIQUID_OF_CAN[item]) return false;
    const { toast, industry } = this.g;
    this.refresh();
    if (c.kind === 'core') { const s = this.sites.get(k); if (s) this.openCore(s); return true; }
    if (c.kind === 'launch') { this.openLauncher(k, c); return true; }
    if (c.kind === 'oxy') { const on = this.powered(k), n = this.prev.get(k)?.size || 0; toast(!on ? "Générateur d'oxygène : pas assez de courant (8 W)" : n ? `Pièce étanche : ${fmt(n)} cases d'air` : 'Pièce ouverte, ou plus de 4 096 cases : l\'air s\'échappe'); return true; }
    if (c.kind === 'grav') { toast(this.powered(k) ? `Gravité à moins de ${GRAV_R} blocs` : 'Générateur de gravité : pas assez de courant (20 W)'); return true; }
    if (c.kind === 'solar') { toast('Panneau solaire : ' + this.solarW(q, r, y) + ' W ici'); return true; }
    if (c.kind === 'port') {
      if (industry.fdirty) industry.rebuildFluids();
      const site = this.siteOf(c), n = industry.fluidAt(q, r, y);
      toast(!site ? "Port d'amarrage : pose un noyau de station à côté" : `${site.name} : port ${this.portTaken(k, -1) ? 'occupé' : 'libre'}, ${ROCKET_EQ[n?.f] ? fmt(n.n) + ' mB de carburant' : 'pas de carburant relié'}`);
      return true;
    }
    if (c.kind === 'computer') { toast("L'ordinateur de bord se pose sur un vaisseau collé (Super colle)"); return true; }
    return false;
  }
  clickStruct(s, k, item) {
    const kind = BLOCKS[s.blocks.get(k)]?.orb;
    if (!kind || BLOCKS[s.blocks.get(k)]?.container) return false;
    if (item === CANISTER || item === FUEL_CANISTER || item === CREATIVE_CANISTER || LIQUID_OF_CAN[item]) return false;
    const { toast } = this.g;
    if (kind === 'computer') { this.openComputer(s); return true; }
    if (kind === 'core') { this.openStructCore(s); return true; }
    const I = this.shipInfo(s), charge = Math.round((this.charge.get(s.id) || 0) / 1000);
    if (kind === 'oxy' || kind === 'grav') {
      const list = kind === 'oxy' ? 'd\'oxygène' : 'de gravité';
      toast(`Générateur ${list} : sur les batteries du vaisseau (${I.bat ? charge + ' kJ' : 'pose une batterie à bord'})`);
      return true;
    }
    if (kind === 'solar') { toast(`Panneau solaire : ${(Math.round(this.sunPower(s.pos.x, s.pos.y, s.pos.z) * 10) / 10)} W ici, batteries ${charge} kJ`); return true; }
    if (kind === 'port' && !this.remote && this.undockShip(s, k)) return true;
    if (kind === 'port') { const a = this.ships.get(s.id); toast(a?.docked ? 'Amarré à ' + (this.sites.get(a.docked.site)?.name || '?') : 'Port libre : approche-le doucement d\'un port de station'); return true; }
    return false;
  }

  // ---------- Ce qu'on lit en visant un bloc d'un objet collé (voir updateWatts dans main.js) ----------
  // L'énergie à bord : les batteries du vaisseau (une réserve commune), les panneaux qui la
  // remplissent, les générateurs qui y puisent
  power(s) {
    const I = this.shipInfo(s), cap = I.bat * BATTERY_J, J = Math.min(cap, this.charge.get(s.id) || 0);
    const sun = I.solar ? this.sunPower(s.pos.x, s.pos.y, s.pos.z) : 0;
    return { I, cap, J, sun, prod: sun * I.solar, use: I.oxy.length * USE.oxy + I.grav.length * USE.grav };
  }
  describeStruct(s, k) {
    const id = s.blocks.get(k), B = BLOCKS[id], kind = B?.orb;
    if (!B || (!kind && id !== BATTERY_BLOCK)) return null;
    const P = this.power(s), { I } = P, W = (x) => (Math.round(x * 10) / 10).toLocaleString('fr-FR') + ' W', kJ = (x) => Math.round(x / 1000).toLocaleString('fr-FR') + ' kJ';
    const pct = P.cap ? Math.round((P.J / P.cap) * 100) : 0, lines = [];
    const fed = I.bat && P.J > 0;
    if (id === BATTERY_BLOCK) lines.push((I.bat > 1 ? 'Batteries du vaisseau (' + I.bat + ')' : 'Batterie du vaisseau') + ' : ' + pct + ' % (' + kJ(P.J) + ' / ' + kJ(P.cap) + ')');
    else if (kind === 'solar') lines.push('Panneau solaire : ' + W(P.sun) + ' ici' + (I.solar > 1 ? ' (' + I.solar + ' panneaux : ' + W(P.prod) + ')' : '') + (I.bat ? '' : ' · pas de batterie à bord : rien n\'est gardé'));
    else if (kind === 'oxy' || kind === 'grav') lines.push(B.name + ' : ' + W(USE[kind]) + ' pris sur les batteries · ' + (!I.bat ? 'pose une batterie à bord' : fed ? 'en marche' : "batteries vides, à l'arrêt"));
    else if (kind === 'core') lines.push('Noyau de station : posé sur un objet collé, il ne fait pas de station (clic droit)');
    else if (kind === 'computer') { const a = this.ships.get(s.id); lines.push('Ordinateur de bord : ' + (a?.run ? 'en route' + (a.msg ? ' · ' + a.msg : '') : "à l'arrêt") + ' (clic droit : programme)'); }
    else if (kind === 'port') { const a = this.ships.get(s.id); lines.push("Port d'amarrage : " + (a?.docked ? 'amarré à ' + (this.sites.get(a.docked.site)?.name || '?') : 'libre')); }
    else if (kind === 'store' || kind === 'launch' || kind === 'bay') lines.push(B.name + " : ne marche que posé en bloc fixe, à côté d'un noyau de station");
    else return null;
    if (I.bat || I.solar || I.oxy.length || I.grav.length) {
      lines.push('Énergie à bord : ' + (I.bat ? pct + ' % des batteries' : 'aucune batterie') + ' · +' + W(P.prod) + ' du soleil · −' + W(P.use) + ' demandés');
      if (I.bat && P.use > P.prod && P.J > 0) { const t = P.J / (P.use - P.prod); lines.push('Autonomie : ' + (t > 5400 ? Math.round(t / 3600) + ' h' : Math.max(1, Math.round(t / 60)) + ' min')); }
    }
    return lines.join('\n');
  }
  // Un noyau de station sur un objet collé : un site (ports, entrepôts, lanceurs, drones) ne se
  // forme qu'autour d'un noyau posé dans le monde. On peut reposer l'objet d'un clic : la station
  // devient fixe et le noyau marche (dans l'espace, son coin de vide s'ancre)
  openStructCore(s) {
    const E = this.el.bind(this), b = this.body(), { I } = this.power(s);
    b.append(E('h3', { textContent: 'Noyau de station (objet collé)' }));
    b.append(E('p', { className: 'inv-hint', textContent: "Ce noyau fait partie d'un objet collé : il ne forme pas de station. Les ports, entrepôts, lanceurs et baies de drones ne se relient qu'à un noyau posé en bloc fixe." }));
    const info = E('div', { className: 'orb-s' });
    b.append(info);
    const repose = E('button', { textContent: 'Reposer en station fixe', on: { click: () => {
      if (!this.g.reposeStruct?.(s)) { this.g.toast("Pas assez de place pour reposer l'objet ici"); return; }
      this.g.closePanel();
      this.g.toast('Station posée : le noyau marche (clic droit dessus)');
    } } });
    b.append(E('div', { className: 'row' }, repose, E('button', { textContent: 'Fermer', on: { click: () => this.g.closePanel() } })));
    b.append(E('p', { className: 'orb-d', textContent: "Reposer : comme Maj + clic droit à la Super colle. Les blocs se calent sur la grille, là où l'objet se trouve." }));
    this.panel = {
      status: info,
      text: () => {
        const p = this.power(s), pct = p.cap ? Math.round((p.J / p.cap) * 100) : 0;
        return `${s.list.length} blocs · ${I.ports.length} port(s) · ${I.holds.length} coffre(s) · ${I.bat ? pct + ' % des batteries (' + I.bat + ')' : 'aucune batterie'} · ${I.solar} panneau(x) solaire(s) · ${I.oxy.length} générateur(s) d'oxygène · ${I.grav.length} de gravité`;
      },
    };
    this.renderStatus();
    this.g.openPanel();
  }

  // ---------- Fenêtres ----------
  style() {
    if (document.getElementById('orb-style')) return;
    const st = document.createElement('style');
    st.id = 'orb-style';
    st.textContent = `
    #scr-orb .inv { width: min(640px, 100%); max-height: 88vh; overflow-y: auto; }
    #orb-body h4 { margin: 12px 0 6px; font-size: 13px; letter-spacing: .08em; text-transform: uppercase; color: #3fd6ee; }
    #orb-body .orb-row { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin-bottom: 8px; color: #dfe7ec; font-weight: 600; font-size: 13px; }
    #orb-body select, #orb-body input[type=text], #orb-body input[type=number] { padding: 5px 8px; font: 600 13px 'Segoe UI', system-ui, sans-serif; color: #fff; background: #0b0e11; border: 1px solid #3a424a; }
    #orb-body input[type=number] { width: 70px; }
    #orb-body input[type=text] { flex: 1; min-width: 120px; }
    #orb-body button { flex: 0 0 auto; width: auto; min-width: 0; padding: 5px 10px; font-size: 13px; }
    #orb-body .row button { flex: 1; }
    #orb-body label { display: flex; flex-direction: row; justify-content: flex-start; align-items: center; gap: 6px; }
    #orb-body input[type=checkbox] { flex: 0 0 auto; width: auto; margin: 0; }
    #orb-body ol { margin: 0 0 8px; padding: 0; list-style: none; max-height: 34vh; overflow-y: auto; }
    #orb-body li { display: flex; gap: 6px; align-items: center; padding: 3px 0; color: #dfe7ec; font-weight: 600; font-size: 13px; }
    #orb-body li.cur { color: #7fe08a; }
    #orb-body li span { flex: 1; }
    #orb-body li button { padding: 2px 8px; }
    #orb-body .orb-s { padding: 6px 10px; margin-bottom: 8px; background: rgba(255, 255, 255, 0.04); border-left: 3px solid #3a424a; color: #dfe7ec; font-size: 13px; }
    #orb-body .orb-d { color: #8b949c; font-size: 12px; font-weight: 400; }
    #orb-body details > summary { cursor: pointer; color: #9fd8ff; font-weight: 700; font-size: 13px; margin: 12px 0 8px; }`;
    document.head.appendChild(st);
  }
  el(tag, props = {}, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === 'on') for (const [ev, fn] of Object.entries(v)) e.addEventListener(ev, fn);
      else if (k in e) e[k] = v; else e.setAttribute(k, v);
    }
    for (const c of kids) e.append(c);
    return e;
  }
  body() { this.style(); const b = document.getElementById('orb-body'); b.innerHTML = ''; return b; }
  closePanel() { this.panel = null; }
  // (ce qui change pendant qu'une fenêtre est ouverte)
  renderStatus() {
    const P = this.panel;
    if (!P?.status) return;
    const t = P.text();
    if (P.status.textContent !== t) P.status.textContent = t;
    P.tick?.();
  }
  tick(dt) { if (this.panel && (this.clock.info -= dt) <= 0) { this.clock.info = 0.3; this.renderStatus(); } }
  whereText(site) {
    if (site.zone >= 0) return 'Au sol, sur ' + zoneBody(site.zone).name;
    const B = this.g.flight.spaces.get(site.bid);
    return B?.rock ? 'Sur un astéroïde' : 'Autour de ' + (BODY[B?.ref]?.name || '?');
  }
  openCore(site) {
    const { el } = this, E = el.bind(this), b = this.body(), { industry, toast } = this.g;
    b.append(E('h3', { textContent: site.zone < 0 ? 'Station spatiale' : 'Base' }));
    const name = E('input', { type: 'text', value: site.name, maxLength: 32, spellcheck: false });
    b.append(E('div', { className: 'orb-row' }, 'Nom ', name, E('button', { textContent: 'Renommer', on: { click: () => { this.act({ op: 'name', k: site.k, v: name.value }); site.name = name.value.trim().slice(0, 32) || site.name; toast('« ' + site.name + ' »'); } } })));
    const info = E('div', { className: 'orb-s' });
    b.append(info);
    if (site.zone < 0 && !this.g.flight.spaces.get(site.bid)?.rock) {
      const cb = E('input', { type: 'checkbox', checked: site.orbit, on: { change: () => { this.act({ op: 'orbit', k: site.k, v: cb.checked }); site.orbit = cb.checked; } } });
      b.append(E('label', { className: 'orb-row' }, cb, ' Orbite stable (sinon : fixe au-dessus de l\'astre)'));
    }
    const list = E('div', { className: 'orb-d' });
    b.append(E('h4', { textContent: 'Vaisseaux' }), list);
    b.append(E('div', { className: 'row' }, E('button', { textContent: 'Fermer', on: { click: () => this.g.closePanel() } })));
    this.panel = {
      status: info,
      text: () => {
        this.refresh();
        const stock = this.stockOf(site), items = stock.reduce((n, c) => n + c.slots.reduce((a, x) => a + (x?.n || 0), 0), 0), free = site.ports.filter((p) => !this.portTaken(p, -1)).length;
        const net = industry.netOf.get(site.k), drones = site.bays.reduce((n, k) => n + (this.bays.get(k)?.n || 0), 0);
        return `${this.whereText(site)} · ${site.ports.length} port(s), ${free} libre(s) · ${site.stores.length} entrepôt(s), ${fmt(items)} objets · ${site.launchers.length} lanceur(s) · ${drones} drone(s)` + (net ? ` · ${Math.round(net.prod)} W produits, ${Math.round(net.demand)} W demandés` : ' · pas de courant relié au noyau');
      },
      tick: () => {
        const t = [...this.ships].map(([id, a]) => {
          const s = this.g.structs.byId(id);
          return s && (a.docked?.site === site.k || a.steps.some((e) => e.site === site.k)) ? `Vaisseau n° ${id} : ${a.docked?.site === site.k && !a.run ? 'amarré ici' : a.msg || (a.run ? 'en route' : 'à l\'arrêt')}` : null;
        }).filter(Boolean).join(' | ');
        const txt = t || 'Aucun vaisseau';
        if (list.textContent !== txt) list.textContent = txt;
      },
    };
    this.renderStatus();
    this.g.openPanel();
  }
  openLauncher(k, c) {
    const E = this.el.bind(this), b = this.body(), L = this.launch.get(k) || { to: '', item: 0 }, from = this.siteOf(c);
    b.append(E('h3', { textContent: 'Lanceur de cargo' }), E('p', { className: 'inv-hint', textContent: 'Toutes les 6 s (40 W), il envoie une pile prise dans les entrepôts de son site vers ceux du site choisi.' }));
    if (!from) b.append(E('div', { className: 'orb-s', textContent: 'Pose un noyau de station à côté : un lanceur fait partie d\'un site.' }));
    const sel = E('select', {}, E('option', { value: '', textContent: '(à l\'arrêt)' }));
    for (const s of this.sites.values()) if (s !== from) sel.append(E('option', { value: s.k, textContent: s.name }));
    sel.value = L.to;
    let item = L.item;
    const label = E('span', { textContent: item ? this.g.itemName(item) : 'tout' });
    const save = () => this.act({ op: 'launch', k, to: sel.value, item });
    sel.addEventListener('change', save);
    b.append(E('div', { className: 'orb-row' }, 'Destination ', sel));
    b.append(E('div', { className: 'orb-row' }, 'Filtre : ', label,
      E('button', { textContent: 'Objet en main', on: { click: () => { item = this.g.held() || 0; label.textContent = item ? this.g.itemName(item) : 'tout'; save(); } } }),
      E('button', { textContent: 'Tout envoyer', on: { click: () => { item = 0; label.textContent = 'tout'; save(); } } })));
    b.append(E('div', { className: 'row' }, E('button', { textContent: 'Fermer', on: { click: () => this.g.closePanel() } })));
    this.panel = {};
    this.g.openPanel();
  }
  stepText(st) {
    const name = (k) => this.sites.get(k)?.name || '(site disparu)', it = (id) => (id ? this.g.itemName(id) : '?');
    switch (st.t) {
      case 'dock': return "S'amarrer à " + name(st.site);
      case 'orbit': return 'Sauter vers ' + (BODY[st.body]?.name || '?');
      case 'corner': return 'Aller à ' + this.cornerName(st.b);
      case 'land': return 'Se poser sur ' + (zoneBody(st.k)?.name || '?') + ' (' + Math.round(st.x - st.k * ZONE) + ', ' + Math.round(st.z) + ')';
      case 'spot': return "S'arrêter dans l'espace : " + this.cornerName(st.b);
      case 'load': return 'Charger ' + (st.item ? it(st.item) : 'tout') + (st.full ? " jusqu'à soutes pleines" : '');
      case 'unload': return 'Décharger ' + (st.item ? it(st.item) : 'tout');
      case 'wait': return 'Attendre ' + st.sec + ' s';
      case 'time': return 'Attendre ' + Math.floor(st.h) + ' h';
      case 'radio': return 'Attendre le signal radio : ' + it(st.f);
      case 'emit': return 'Émettre le signal radio : ' + it(st.f) + ' (' + st.sec + ' s)';
      default: return STEP_TYPES[st.t];
    }
  }
  openComputer(s) {
    const E = this.el.bind(this), b = this.body(), ap = this.apOf(s), P = { steps: ap.steps.map((e) => ({ ...e })), loop: ap.loop, fullF: ap.fullF || 0 };
    this.refresh();
    const save = () => this.act({ op: 'prog', id: s.id, ...P });
    const sites = () => [...this.sites.values()], siteOpts = () => sites().map((x) => E('option', { value: x.k, textContent: x.name }));
    b.append(E('h3', { textContent: 'Ordinateur de bord' }));
    const status = E('div', { className: 'orb-s' });
    b.append(status);
    // ---- trajet simple : des arrêts (se poser à un endroit, ou s'arrêter dans l'espace), une attente à chacun ----
    const sol = E('ol'), stops = () => P.steps.filter((e) => e.t !== 'wait');
    const firstWait = P.steps.find((e) => e.t === 'wait')?.sec;
    const waitIn = E('input', { type: 'number', value: this.isSimple(P.steps) && firstWait !== undefined ? firstWait : P.steps.length && this.isSimple(P.steps) ? 0 : 10, min: 0, max: 3600, style: 'width:5em' });
    const rebuild = (list) => {
      const w = clamp(num(waitIn.value, 0), 0, 3600);
      P.steps = list.flatMap((st) => (w ? [st, { t: 'wait', sec: w }] : [st]));
      save(); redrawSimple(); redraw();
    };
    const redrawSimple = () => {
      sol.innerHTML = '';
      if (!this.isSimple(P.steps)) { sol.append(E('li', {}, E('span', { className: 'orb-d', textContent: 'Le programme actuel est en mode avancé (plus bas). Ajouter un arrêt ici le remplace par un trajet simple.' }))); return; }
      const list = stops(), A = this.ships.get(s.id) || ap;
      if (!list.length) sol.append(E('li', {}, E('span', { className: 'orb-d', textContent: 'Aucun arrêt. Pose le vaisseau là où il doit revenir (à côté de ta base) et clique « + Ici », puis ajoute un astre (la Lune...).' })));
      const cur = A.run ? P.steps.slice(0, A.i + 1).filter((e) => e.t !== 'wait').length - 1 : -1; // (en attente : l'arrêt où l'on est)
      list.forEach((st, i) => sol.append(E('li', { className: i === cur ? 'cur' : '' }, E('span', { textContent: (i + 1) + '. ' + this.stepText(st) }),
        E('button', { textContent: '✕', on: { click: () => rebuild(list.filter((_, j) => j !== i)) } }))));
    };
    const addStop = (st) => {
      if (!st) { this.g.toast("Impossible d'enregistrer cet endroit (astéroïde, ligne spatiale)"); return; }
      const base = this.isSimple(P.steps) ? stops() : [];
      if (!this.isSimple(P.steps)) this.g.toast('Le programme avancé a été remplacé par le trajet simple');
      if (!base.length && !P.steps.length) { P.loop = true; loop.checked = true; }
      rebuild([...base, st]);
    };
    const bodySel = E('select', {}, ...BODIES.filter((x) => x.land).map((x) => E('option', { value: x.id, textContent: x.name, selected: x.id === 'lune' })));
    waitIn.addEventListener('change', () => { if (this.isSimple(P.steps)) rebuild(stops()); });
    const loop = E('input', { type: 'checkbox', checked: P.loop, on: { change: () => { P.loop = loop.checked; save(); } } });
    b.append(E('h4', { textContent: 'Trajet simple' }), sol,
      E('div', { className: 'orb-row' },
        E('button', { textContent: '+ Ici', title: 'Là où est le vaisseau maintenant : il reviendra se poser exactement ici', on: { click: () => addStop(this.stopHere(s)) } }),
        E('button', { textContent: '+ Un astre', on: { click: () => addStop(this.stopOn(bodySel.value)) } }), bodySel),
      E('div', { className: 'orb-row' }, 'Attendre à chaque arrêt : ', waitIn, ' s'),
      E('label', { className: 'orb-row' }, loop, ' En boucle (recommencer à la fin)'));
    const adv = E('details', { open: P.steps.length > 0 && !this.isSimple(P.steps) }, E('summary', { textContent: 'Mode avancé (étapes, amarrage, cargo, radio)' }));
    const ol = E('ol');
    const redraw = () => {
      ol.innerHTML = '';
      if (!P.steps.length) ol.append(E('li', {}, E('span', { className: 'orb-d', textContent: 'Aucune étape. Ajoute-en, ou utilise la route cargo.' })));
      P.steps.forEach((st, i) => {
        const mv = (d) => { const j = i + d; if (j < 0 || j >= P.steps.length) return; [P.steps[i], P.steps[j]] = [P.steps[j], P.steps[i]]; save(); redraw(); };
        ol.append(E('li', { className: ap.run && ap.i === i ? 'cur' : '' }, E('span', { textContent: (i + 1) + '. ' + this.stepText(st) }),
          E('button', { textContent: '▲', on: { click: () => mv(-1) } }), E('button', { textContent: '▼', on: { click: () => mv(1) } }),
          E('button', { textContent: '✕', on: { click: () => { P.steps.splice(i, 1); save(); redraw(); redrawSimple(); } } })));
      });
    };
    adv.append(E('h4', { textContent: 'Étapes' }), ol);
    // ajouter une étape
    const type = E('select', {}, ...Object.entries(STEP_TYPES).filter(([k]) => k !== 'land' && k !== 'spot').map(([k, v]) => E('option', { value: k, textContent: v })));
    const arg = E('span', { style: 'display:contents' });
    let read = () => ({});
    const held = () => this.g.held() || 0, heldName = () => (held() ? this.g.itemName(held()) : 'rien en main');
    const setArg = () => {
      arg.innerHTML = '';
      const t = type.value;
      read = () => ({});
      if (t === 'dock') { const sel = E('select', {}, ...siteOpts()); arg.append(sel); read = () => ({ site: sel.value }); }
      if (t === 'corner') {
        const list = this.corners();
        const sel = E('select', {}, ...list.map((x) => E('option', { value: x.id, textContent: this.cornerName(x.id) })));
        arg.append(sel); read = () => ({ b: sel.value });
      }
      if (t === 'orbit') { const sel = E('select', {}, ...BODIES.map((x) => E('option', { value: x.id, textContent: x.name }))); arg.append(sel); read = () => ({ body: sel.value }); }
      if (t === 'load' || t === 'unload') {
        const only = E('input', { type: 'checkbox' }), lab = E('label', {}, only, ' seulement l\'objet en main');
        arg.append(lab);
        const full = E('input', { type: 'checkbox' });
        if (t === 'load') arg.append(E('label', {}, full, ' jusqu\'à plein'));
        read = () => ({ item: only.checked ? held() : 0, full: full.checked });
      }
      if (t === 'wait' || t === 'emit') { const n = E('input', { type: 'number', value: 10, min: 1, max: 3600 }); arg.append(n, ' s'); read = () => ({ sec: +n.value }); }
      if (t === 'time') { const n = E('input', { type: 'number', value: 8, min: 0, max: 23 }); arg.append(n, ' h'); read = () => ({ h: +n.value }); }
      if (t === 'radio' || t === 'emit') { arg.append(E('span', { className: 'orb-d', textContent: ' fréquence : objet en main au moment d\'ajouter' })); const r0 = read; read = () => ({ ...r0(), f: held() }); }
    };
    type.addEventListener('change', setArg);
    setArg();
    const add = E('button', { textContent: 'Ajouter', on: { click: () => {
      const st = { t: type.value, ...read() };
      if ((st.t === 'radio' || st.t === 'emit') && !st.f) { this.g.toast('Prends en main l\'objet qui sert de fréquence'); return; }
      if (st.t === 'dock' && !st.site) { this.g.toast('Aucun site : pose un noyau de station'); return; }
      if (st.t === 'corner' && !st.b) { this.g.toast("Aucun coin d'espace : ancre-en un en posant un bloc dans le vide"); return; }
      P.steps.push(st); save(); redraw(); redrawSimple();
    } } });
    adv.append(E('div', { className: 'orb-row' }, type, arg, add));
    // route cargo
    const a = E('select', {}, ...siteOpts()), c = E('select', {}, ...siteOpts()), when = E('select', {}, E('option', { value: 'full', textContent: 'quand les soutes sont pleines' }), E('option', { value: 'time', textContent: 'à heure fixe' }), E('option', { value: 'radio', textContent: 'sur signal radio (objet en main)' }));
    const hour = E('input', { type: 'number', value: 8, min: 0, max: 23 });
    adv.append(E('h4', { textContent: 'Route cargo' }), E('div', { className: 'orb-row' }, 'De ', a, ' à ', c), E('div', { className: 'orb-row' }, 'Départ ', when, hour, ' h',
      E('button', { textContent: 'Créer la route', on: { click: () => {
        if (!a.value || !c.value || a.value === c.value) { this.g.toast('Choisis deux sites différents'); return; }
        const steps = [{ t: 'dock', site: a.value }, { t: 'load', item: 0, full: when.value === 'full' }];
        if (when.value === 'time') steps.push({ t: 'time', h: +hour.value });
        if (when.value === 'radio') { if (!held()) { this.g.toast('Prends en main l\'objet qui sert de fréquence'); return; } steps.push({ t: 'radio', f: held() }); }
        steps.push({ t: 'dock', site: c.value }, { t: 'unload', item: 0 }, { t: 'refuel' });
        P.steps = steps; P.loop = true; loop.checked = true; save(); redraw(); redrawSimple();
      } } })));
    const fullL = E('span', { textContent: P.fullF ? this.g.itemName(P.fullF) : 'aucune' });
    adv.append(E('h4', { textContent: 'Réglages' }), E('div', { className: 'orb-row' }, 'Radio « soutes pleines » : ', fullL,
      E('button', { textContent: 'Objet en main', on: { click: () => { P.fullF = held(); fullL.textContent = P.fullF ? heldName() : 'aucune'; save(); } } }),
      E('button', { textContent: 'Aucune', on: { click: () => { P.fullF = 0; fullL.textContent = 'aucune'; save(); } } })));
    b.append(adv);
    const go = E('button', { textContent: ap.run ? 'Arrêter' : 'Lancer', on: { click: () => {
      const on = !this.ships.get(s.id)?.run;
      save();
      this.act({ op: 'run', id: s.id, on });
    } } });
    b.append(E('div', { className: 'row' }, go, E('button', { textContent: 'Fermer', on: { click: () => this.g.closePanel() } })));
    let lastI = -1;
    this.panel = {
      status,
      text: () => {
        const A = this.ships.get(s.id) || ap, fuel = this.g.rockets.fuel(s), cap = s.rocket?.cap || 0, I = this.shipInfo(s);
        return `${A.run ? 'En marche' : 'À l\'arrêt'}${A.msg ? ' · ' + A.msg : ''} · ${fmt(fuel)} / ${fmt(cap)} mB · ${I.holds.length} soute(s) · ${I.ports.length} port(s)` + (I.bat ? ` · ${Math.round((this.charge.get(s.id) || 0) / 1000)} kJ` : '');
      },
      tick: () => {
        const A = this.ships.get(s.id) || ap, label = A.run ? 'Arrêter' : 'Lancer';
        if (go.textContent !== label) go.textContent = label;
        if (A.i !== lastI) { lastI = A.i; ap.i = A.i; ap.run = A.run; redraw(); redrawSimple(); }
      },
    };
    redraw();
    redrawSimple();
    this.renderStatus();
    this.g.openPanel();
  }
}

const _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion(), _m = new THREE.Matrix4();
