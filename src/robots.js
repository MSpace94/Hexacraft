// Robots : des aides que le joueur fabrique et règle (clic droit sur un robot). Chacun a un
// métier, une zone (un rayon autour d'un point) et un coffre où il range ce qu'il récolte et
// prend ce dont il a besoin :
//  - éleveur : nourrit les animaux de sa zone pour qu'ils se reproduisent, jusqu'au nombre voulu
//    par espèce ; il peut abattre le surplus (la viande, la laine au coffre)
//  - bûcheron : coupe les arbres de sa zone, replante une pousse, range le bois
//  - fermier : récolte les cultures mûres, les ressème, sème la terre labourée vide
//  - mineur : creuse sa zone de haut en bas jusqu'à la profondeur voulue
//  - transporteur : vide le coffre de départ dans le coffre d'arrivée
//  - bâtisseur : remplit les projections de schématique de sa zone (voir schematics.js) avec les
//    blocs de son coffre : une maison, une machine, un moteur planétaire...
//  - suivre : il suit le joueur ; en attente : il ne fait rien
// Il marche comme un villageois (chemins, voir colony.js : goCell, walk, act) ; là où on ne va
// pas à pied (un trou de mine, le haut d'une construction), ses petits propulseurs le portent
// (voir jetMove). En survie, il s'use : sa batterie se vide en travaillant (une demi-heure), il
// va se recharger tout seul à une station de recharge reliée au réseau électrique.
// Les robots sont des « animaux » (animals.js, SPECIES.robot) : dessinés, sauvegardés et vus des
// autres joueurs comme eux ; l'hôte d'une partie les fait travailler.
import { BLOCKS, ITEMS, AIR, SOLID, ATTACHED, isLog, isWater, isLava, isFarmland, WHEAT, SEEDS, POTATO, CARROT, TOMATO,
  WHEAT_CROP, WHEAT_RIPE, POTATO_CROP, POTATO_RIPE, CARROT_CROP, CARROT_RIPE, TOMATO_CROP, TOMATO_RIPE,
  SAPLING, CHESTNUT_SAPLING, LINDEN_SAPLING, BIRCH_LOG, BIRCH_SAPLING, ROBOT_DOCK } from './blocks.js?v=1.1.0-mwk9a96e';
import { WOODS } from './woods.js?v=1.1.0-mwk9a96e';
import { hexToWorld, worldToHex, NEIGHBORS } from './hex.js?v=1.1.0-mwk9a96e';
import { FOODS } from './animals.js?v=1.1.0-mwk9a96e';

// [clé, nom, ce qu'il fait]
export const ROBOT_JOBS = [
  ['idle', 'En attente', 'Il reste où il est, sans rien faire.'],
  ['follow', 'Suivre', 'Il te suit partout (et te rejoint s\'il est resté loin).'],
  ['rancher', 'Éleveur', 'Il nourrit les animaux de sa zone pour qu\'ils se reproduisent, jusqu\'au nombre voulu par espèce (la nourriture : dans son coffre). Il peut abattre le surplus : la viande et la laine vont au coffre.'],
  ['lumberjack', 'Bûcheron', 'Il coupe les arbres de sa zone, replante une pousse et range le bois au coffre.'],
  ['farmer', 'Fermier', 'Il récolte les cultures mûres de sa zone, les ressème et range la récolte au coffre. Il sème aussi la terre labourée vide (graines, pommes de terre, carottes, tomates du coffre).'],
  ['miner', 'Mineur', 'Il creuse sa zone de haut en bas, jusqu\'à la profondeur voulue, et range ce qu\'il trouve au coffre.'],
  ['hauler', 'Transporteur', 'Il vide le coffre de départ dans le coffre d\'arrivée.'],
  ['builder', 'Bâtisseur', 'Il construit les projections de schématique de sa zone (pose-en une avec la schématique) avec les blocs de son coffre. En créatif, sans rien prendre.'],
];
const JOB = Object.fromEntries(ROBOT_JOBS.map(([k, name, desc]) => [k, { name, desc }]));
const NEEDS_BOX = new Set(['rancher', 'lumberjack', 'farmer', 'miner', 'hauler', 'builder']);

const DRAIN = 1 / 1800;      // batterie : vide en une demi-heure de travail (survie)
const CHARGE = 1 / 40;       // pleine en 40 s à la station (réseau bien alimenté)
const LOW = 0.15;            // il part se recharger en dessous
const CARRY_MAX = 64;        // objets qu'il porte au plus avant d'aller au coffre
const SCAN_EVERY = 4;        // s entre deux recherches dans sa zone
const MAX_RAD = 24, MINE_RAD = 8, MAX_DEPTH = 64;
const JET_V = 4.5, JET_UP = 24;  // propulseurs : vitesse (blocs/s), hauteur au-dessus du départ au plus
const REACH = 5.5;           // il travaille un bloc à moins de REACH blocs
const ACT = { chop: 0.55, harvest: 0.5, sow: 0.4, dig: 0.6, build: 0.35, feed: 0.5, cull: 0.6, box: 0.5 };

const key = (q, r, y) => q + ',' + r + ',' + y;
const rnd = (a, b) => a + Math.random() * (b - a);
const hexDist = (dq, dr) => (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
const carried = (a) => { let n = 0; for (const k in a.carry || {}) n += a.carry[k]; return n; };
const addCarry = (a, id, n = 1) => { if (!id || n <= 0) return; a.carry ||= {}; a.carry[id] = (a.carry[id] || 0) + n; };
const hasCarry = (a, ids) => ids.find((id) => a.carry?.[id] > 0) || 0;
const takeCarry = (a, id, n = 1) => { if (!(a.carry?.[id] >= n)) return false; a.carry[id] -= n; if (!a.carry[id]) delete a.carry[id]; return true; };
const itemOf = (id) => BLOCKS[id]?.pick ?? id; // (un bloc tourné : l'objet qu'on ramasse)

// la pousse de chaque bois (pour replanter)
const SAPLING_OF = { 5: SAPLING, 97: CHESTNUT_SAPLING, 152: LINDEN_SAPLING, 256: 260, [BIRCH_LOG]: BIRCH_SAPLING };
for (const w of WOODS) SAPLING_OF[w.LOG] = w.SAPLING;
// cultures mûres : ce qu'elles donnent, la graine qu'on ressème, le premier stade
const CROPS = {
  [WHEAT_RIPE]: { base: WHEAT_CROP, seed: SEEDS, get: () => [[WHEAT, 1], [SEEDS, 1 + Math.floor(Math.random() * 2)]] },
  [POTATO_RIPE]: { base: POTATO_CROP, seed: POTATO, get: () => [[POTATO, 2 + Math.floor(Math.random() * 3)]] },
  [CARROT_RIPE]: { base: CARROT_CROP, seed: CARROT, get: () => [[CARROT, 2 + Math.floor(Math.random() * 3)]] },
  [TOMATO_RIPE]: { base: TOMATO_CROP, seed: TOMATO, get: () => [[TOMATO, 2 + Math.floor(Math.random() * 2)]] },
};
const SEED_CROP = { [SEEDS]: WHEAT_CROP, [POTATO]: POTATO_CROP, [CARROT]: CARROT_CROP, [TOMATO]: TOMATO_CROP };
const SEED_IDS = Object.keys(SEED_CROP).map(Number);

export function newBot(owner, q, r, y) {
  return { job: 'idle', name: '', home: [q, r, y], rad: 8, box: null, box2: null, e: 1, owner: owner || null, max: 6, cull: false, sow: true, depth: 8 };
}

export class Robots {
  constructor(animals) {
    this.A = animals;
    this.C = animals.colony;     // (chemins, marche, gestes : ceux des villageois)
    this.g = null;               // le jeu (voir main.js) : containers, industry, schem, survival(), toast, give, dropOf, openPanel...
    this.claims = new Map();     // case -> { id, until } : un robot à la fois sur un arbre, un bloc...
    this.linking = null;         // { a, which } : le prochain clic droit sur un coffre le lie au robot
    this.panel = null;
    this.clock = 0;
  }
  isRobot(a) { return a?.type === 'robot'; }
  get world() { return this.A.world; }
  get(q, r, y) { return this.world.getBlock(q, r, y); }
  survival() { return !!this.g?.survival?.()?.on; }

  // Un robot vient d'être posé : son réglage (zone autour de lui, en attente)
  init(a, owner) {
    const c = worldToHex(a.pos.x, a.pos.z);
    a.bot = newBot(owner, c.q, c.r, Math.floor(a.pos.y + 0.05));
    return a.bot;
  }

  // ---------- Sauvegarde ----------
  pack(b) {
    const o = { j: b.job, h: b.home, d: b.rad, e: Math.round(b.e * 1000) / 1000 };
    if (b.name) o.n = b.name;
    if (b.box) o.b = b.box;
    if (b.box2) o.b2 = b.box2;
    if (b.owner) o.o = b.owner;
    if (b.max !== 6) o.m = b.max;
    if (b.cull) o.c = 1;
    if (!b.sow) o.s = 0;
    if (b.depth !== 8) o.p = b.depth;
    return o;
  }
  unpack(o) {
    const cell = (v) => (Array.isArray(v) && v.length === 3 && v.every(Number.isInteger) ? v : null);
    const b = newBot(typeof o?.o === 'string' ? o.o.slice(0, 32) : null, 0, 0, 0);
    if (!o || typeof o !== 'object') return b;
    if (JOB[o.j]) b.job = o.j;
    if (typeof o.n === 'string') b.name = o.n.slice(0, 24);
    b.home = cell(o.h) || b.home;
    if (Number.isFinite(o.d)) b.rad = Math.max(2, Math.min(MAX_RAD, Math.round(o.d)));
    if (Number.isFinite(o.e)) b.e = Math.max(0, Math.min(1, o.e));
    b.box = cell(o.b);
    b.box2 = cell(o.b2);
    if (Number.isFinite(o.m)) b.max = Math.max(0, Math.min(50, Math.round(o.m)));
    b.cull = !!o.c;
    b.sow = o.s !== 0;
    if (Number.isFinite(o.p)) b.depth = Math.max(1, Math.min(MAX_DEPTH, Math.round(o.p)));
    return b;
  }

  // ---------- Cerveau ----------
  think(a, dt) {
    this.dtNow = dt;
    const b = a.bot || this.init(a, null);
    if (a.jet) return; // (en vol : voir jetMove)
    const surv = this.survival();
    if (surv && (a.state === 'walk' || a.state === 'work')) b.e = Math.max(0, b.e - DRAIN * dt);
    if (surv && b.e <= 0 && a.task?.kind !== 'charge') {
      a.state = 'idle'; a.target = null; a.task = null;
      b.msg = 'Batterie vide : porte-moi près d\'une station de recharge (ou ramasse-moi)';
      return;
    }
    if (b.job === 'follow' && !(surv && b.e < LOW && a.task?.kind === 'charge')) { a.task = null; this.follow(a, b); return; }
    if (a.task) { this.run(a, a.task, dt); return; }
    a.brainT = (a.brainT || 0) - dt;
    if (a.brainT > 0) return;
    a.brainT = rnd(0.6, 1.2);
    a.state = 'idle'; a.target = null;
    const t = this.decide(a, b, surv);
    if (!t) return;
    a.task = t;
    this.run(a, t, dt);
  }

  decide(a, b, surv) {
    // batterie faible : à la station la plus proche
    if (surv && b.e < LOW) {
      const d = this.nearDock(a);
      if (d) return { kind: 'charge', at: d };
      b.msg = 'Batterie faible, et aucune station de recharge près d\'ici';
    }
    if (b.job === 'idle') { b.msg = 'En attente'; return null; }
    // poches pleines (ou rien à faire avec ce qu'il porte) : au coffre
    const full = carried(a) >= CARRY_MAX;
    if (full || (b.job === 'hauler' && carried(a))) {
      const box = b.job === 'hauler' ? b.box2 : b.box;
      if (box && this.boxAt(box)) return { kind: 'deposit', at: box };
      b.msg = b.job === 'hauler' ? 'Lie-moi un coffre d\'arrivée' : 'Lie-moi un coffre : mes poches sont pleines';
      return null;
    }
    if (NEEDS_BOX.has(b.job) && b.job !== 'hauler' && (!b.box || !this.boxAt(b.box)) && b.job !== 'builder') b.msg = 'Pas de coffre lié : je garde tout dans mes poches';
    const t = this['task_' + b.job]?.(a, b, surv) || null;
    // rien à faire : il range ce qu'il porte avant d'attendre
    if (!t && carried(a) && b.box && this.boxAt(b.box) && b.job !== 'farmer' && b.job !== 'rancher') return { kind: 'deposit', at: b.box };
    return t;
  }

  // ---------- Exécution ----------
  run(a, t, dt) {
    const C = this.C;
    if (a.jet) return;
    if (t.wait) { const D = t.dest; C.goCell(a, t, D.q, D.r, D.y, D.reach, D.near); return; }
    if (t.goal && !C.walk(a, t, dt)) return;
    if (t.failed) {
      // pas de chemin à pied : les propulseurs, une fois par tâche
      if (!t.jetTried && t.dest) {
        t.jetTried = true;
        const spot = this.spotNear(t.dest);
        if (spot && this.startJet(a, spot)) { t.failed = false; t.goal = null; t.path = null; return; }
      }
      this.unclaim(t);
      a.bot.msg = 'Je n\'arrive pas à y aller';
      this.end(a, t, 3);
      return;
    }
    this['do_' + t.kind](a, t, dt);
  }
  end(a, t, rest = rnd(0.4, 1), keep = false) { if (!keep) this.unclaim(t); this.C.end(a, t, rest); }
  // Aller travailler la case (q, r, y) : à reach cases près ; vrai une fois sur place
  goNear(a, t, q, r, y, reach = 1, near = 2.5) {
    if (t.phase) return true;
    t.phase = 'go';
    this.C.goCell(a, t, q, r, y, reach, near);
    return false;
  }
  near(a, q, r, y, d = REACH) { const c = hexToWorld(q, r); return Math.hypot(c.x - a.pos.x, y + 0.5 - (a.pos.y + 1), c.z - a.pos.z) <= d; }
  claim(a, k, s = 120) { this.claims.set(k, { id: a.id, until: this.clock + s }); }
  claimed(a, k) { const c = this.claims.get(k); return c && c.id !== a.id && c.until > this.clock; }
  unclaim(t) { if (t?.ck) this.claims.delete(t.ck); }
  tick(dt) { this.clock += dt; }

  // ---------- Propulseurs ----------
  // Une case où se tenir près de la destination (là où il n'y a pas de chemin à pied)
  // (aside : pas sur la case elle-même, à côté)
  spotNear(D, aside = false) {
    const C = this.C, cells = [...(aside ? [] : [[D.q, D.r]]), ...NEIGHBORS.map(([a, b]) => [D.q + a, D.r + b])];
    for (const [q, r] of cells) for (const dy of [0, 1, -1, 2, -2, 3]) {
      const y = (D.y ?? 0) + dy;
      if (C.standable(q, r, y)) return [q, r, y];
    }
    return null;
  }
  // Vol : monter à une hauteur libre, aller au-dessus de la case, descendre (faux : pas de passage)
  startJet(a, [q, r, y]) {
    const to = hexToWorld(q, r), free = (x, yy, z) => { const h = worldToHex(x, z); return !SOLID[this.get(h.q, h.r, yy)] && !isLava(this.get(h.q, h.r, yy)); };
    const y0 = Math.floor(a.pos.y + 0.05);
    for (let H = Math.max(y0, y); H <= Math.max(y0, y) + JET_UP; H++) {
      let ok = true;
      // (le passage : la colonne au départ, la ligne en haut, la colonne à l'arrivée ; 2 blocs de haut)
      for (let yy = y0; yy <= H + 1 && ok; yy++) ok = free(a.pos.x, yy, a.pos.z);
      const n = Math.ceil(Math.hypot(to.x - a.pos.x, to.z - a.pos.z) / 0.3) + 1;
      for (let i = 0; i <= n && ok; i++) { const k = i / n, x = a.pos.x + (to.x - a.pos.x) * k, z = a.pos.z + (to.z - a.pos.z) * k; ok = free(x, H, z) && free(x, H + 1, z); }
      for (let yy = y; yy <= H + 1 && ok; yy++) ok = free(to.x, yy, to.z);
      if (!ok) continue;
      a.jet = { pts: [[a.pos.x, H + 0.02, a.pos.z], [to.x, H + 0.02, to.z], [to.x, y + 0.02, to.z]], i: 0 };
      a.target = null;
      a.state = 'walk';
      return true;
    }
    return false;
  }
  // (appelé à la place de la physique tant qu'il vole : voir animals.js, step)
  jetMove(a, dt) {
    const J = a.jet, p = J.pts[J.i];
    const dx = p[0] - a.pos.x, dy = p[1] - a.pos.y, dz = p[2] - a.pos.z, d = Math.hypot(dx, dy, dz), s = JET_V * dt;
    if (Math.hypot(dx, dz) > 0.05) a.yaw = Math.atan2(-dx, -dz);
    if (d <= s) {
      a.pos.set(p[0], p[1], p[2]);
      if (++J.i >= J.pts.length) { a.jet = null; a.vel.set(0, 0, 0); a.state = 'work'; a.onGround = true; }
    } else a.pos.set(a.pos.x + (dx / d) * s, a.pos.y + (dy / d) * s, a.pos.z + (dz / d) * s);
    a.vel.set(0, 0, 0);
    if (this.survival()) a.bot.e = Math.max(0, a.bot.e - DRAIN * 2 * dt); // (voler use deux fois plus)
  }

  // ---------- Suivre ----------
  follow(a, b) {
    const ps = this.A.players || [];
    // (son propriétaire, sinon le joueur le plus proche)
    let p = (b.owner && ps.find((o) => o.pseudo === b.owner)) || null, bd = p ? Math.hypot(p.pos.x - a.pos.x, p.pos.z - a.pos.z) : Infinity;
    if (!p) for (const o of ps) { const d = Math.hypot(o.pos.x - a.pos.x, o.pos.z - a.pos.z); if (d < bd) { bd = d; p = o; } }
    if (!p) { a.state = 'idle'; return; }
    b.msg = 'Je te suis';
    // trop loin (ou bien plus haut, plus bas) : il te rejoint d'un bond de propulseurs
    if (bd > 32 || Math.abs(p.pos.y - a.pos.y) > 8) {
      const c = worldToHex(p.pos.x - Math.sin(p.yaw || 0) * -1.5, p.pos.z - Math.cos(p.yaw || 0) * -1.5);
      const spot = this.spotNear({ q: c.q, r: c.r, y: Math.floor(p.pos.y + 0.05) });
      if (spot) { const w = hexToWorld(spot[0], spot[1]); a.pos.set(w.x, spot[2] + 0.02, w.z); a.vel.set(0, 0, 0); }
      return;
    }
    if (bd > 2.6) {
      // (il n'avance plus : un vide, un mur entre vous ; il te rejoint en volant)
      const F = (a.fol ||= { x: a.pos.x, z: a.pos.z, t: 0 });
      if (Math.hypot(a.pos.x - F.x, a.pos.z - F.z) > 0.5) { F.x = a.pos.x; F.z = a.pos.z; F.t = 0; }
      else if ((F.t += this.dtNow || 0) > 1.5) {
        F.t = 0;
        const c = worldToHex(p.pos.x, p.pos.z), spot = this.spotNear({ q: c.q, r: c.r, y: Math.floor(p.pos.y + 0.05) }, true);
        if (spot && this.startJet(a, spot)) return;
      }
      a.target = { x: p.pos.x, z: p.pos.z }; a.state = 'walk'; a.timer = 999; a.pace = bd > 7 ? 2 : 1.1;
    } else { a.state = 'idle'; a.target = null; a.pace = 1; a.fol = null; }
  }

  // ---------- Zone ----------
  // Les cases de sa zone (rayon rad autour de home), les plus proches de lui d'abord
  zoneCells(a, b, rad = b.rad) {
    const [hq, hr] = b.home, out = [];
    for (let dq = -rad; dq <= rad; dq++) for (let dr = -rad; dr <= rad; dr++) if (hexDist(dq, dr) <= rad) out.push([hq + dq, hr + dr]);
    const me = worldToHex(a.pos.x, a.pos.z);
    out.sort((u, v) => hexDist(u[0] - me.q, u[1] - me.r) - hexDist(v[0] - me.q, v[1] - me.r));
    return out;
  }
  inZone(b, x, y, z, rad = b.rad) {
    const c = worldToHex(x, z);
    return hexDist(c.q - b.home[0], c.r - b.home[1]) <= rad && Math.abs(y - b.home[2]) < 12;
  }
  // (recherche coûteuse : gardée SCAN_EVERY secondes)
  scan(a, k, fn) {
    const S = (a.scans ||= {}), s = S[k];
    if (s && this.clock - s.t < SCAN_EVERY) return s.v;
    const v = fn();
    S[k] = { t: this.clock, v };
    return v;
  }
  loaded(q, r) { return this.world.isLoaded?.(q, r) ?? true; }

  // ---------- Coffres ----------
  boxAt(p) { return p ? this.g?.containers?.at(p[0], p[1], p[2]) || null : null; }
  boxCount(p, ids) { const B = this.boxAt(p); let n = 0; if (B) for (const s of B.slots) if (s && !s.w && ids.includes(s.id)) n += s.n; return n; }
  // Va au coffre p et y prend jusqu'à n objets (ids : lesquels ; null : n'importe)
  do_fetch(a, t, dt) {
    const [q, r, y] = t.at;
    if (!this.goNear(a, t, q, r, y, 1, 2.5)) return;
    if (!this.C.act(a, t, dt, ACT.box, ...this.xz(t.at))) return;
    const B = this.boxAt(t.at);
    let n = t.n;
    if (B) for (let i = 0; i < B.slots.length && n > 0; i++) {
      const s = B.slots[i];
      if (!s || s.w || (t.ids && !t.ids.includes(s.id))) continue;
      const k = Math.min(n, s.n);
      addCarry(a, s.id, k);
      s.n -= k; n -= k;
      if (!s.n) B.slots[i] = null;
    }
    this.world.changed = true;
    this.end(a, t, 0.2);
  }
  do_deposit(a, t, dt) {
    const [q, r, y] = t.at;
    if (!this.goNear(a, t, q, r, y, 1, 2.5)) return;
    if (!this.C.act(a, t, dt, ACT.box, ...this.xz(t.at))) return;
    const B = this.boxAt(t.at);
    if (B) this.C.unload(a, [B]);
    if (carried(a)) a.bot.msg = 'Le coffre est plein';
    this.end(a, t, 0.3);
  }
  xz(p) { const c = hexToWorld(p[0], p[1]); return [c.x, c.z]; }
  // il lui faut des objets ids : dans ses poches, ou à prendre au coffre (sinon null)
  need(a, b, ids, n = 16) {
    if (hasCarry(a, ids)) return null;
    if (b.box && this.boxCount(b.box, ids) > 0) return { kind: 'fetch', at: b.box, ids, n };
    return false;
  }

  // ---------- Recharge ----------
  nearDock(a) {
    const I = this.g?.industry;
    if (!I) return null;
    let best = null, bd = 64;
    for (const [k, id] of I.nodes) {
      if (id !== ROBOT_DOCK) continue;
      const [q, r, y] = k.split(',').map(Number), c = hexToWorld(q, r), d = Math.hypot(c.x - a.pos.x, c.z - a.pos.z) + Math.abs(y - a.pos.y);
      if (d < bd) { bd = d; best = [q, r, y]; }
    }
    return best;
  }
  do_charge(a, t, dt) {
    const [q, r, y] = t.at, b = a.bot, k = key(q, r, y);
    if (this.get(q, r, y) !== ROBOT_DOCK) { this.end(a, t, 1); return; }
    if (!t.phase) { t.phase = 'go'; this.C.goCell(a, t, q, r, y + 1, 1, 2.2); return; }
    a.state = 'idle';
    const I = this.g.industry;
    I.charging.add(k);
    const ratio = I.ratioAt(k);
    b.e = Math.min(1, b.e + CHARGE * ratio * dt);
    b.msg = ratio > 0 ? 'Je me recharge : ' + Math.round(b.e * 100) + ' %' : 'La station de recharge n\'a pas de courant';
    t.idle = ratio > 0 ? 0 : (t.idle || 0) + dt;
    if (b.e >= 1 || t.idle > 20) this.end(a, t, 0.5);
  }

  // ---------- Bûcheron ----------
  task_lumberjack(a, b) {
    const trees = this.scan(a, 'trees', () => {
      const out = [];
      for (const [q, r] of this.zoneCells(a, b)) {
        if (!this.loaded(q, r)) continue;
        for (let y = b.home[2] - 6; y <= b.home[2] + 12; y++) {
          if (isLog(this.get(q, r, y)) && !isLog(this.get(q, r, y - 1)) && SOLID[this.get(q, r, y - 1)]) { if (this.C.isTree(q, r, y)) out.push([q, r, y]); break; }
        }
      }
      return out;
    });
    const at = trees.find((p) => isLog(this.get(...p)) && !this.claimed(a, key(...p)));
    if (!at) { b.msg = 'Pas d\'arbre dans ma zone'; return null; }
    const ck = key(...at);
    this.claim(a, ck);
    b.msg = 'Je coupe un arbre';
    return { kind: 'chop', at, ck };
  }
  do_chop(a, t, dt) {
    const [q, r, y] = t.at;
    if (!this.goNear(a, t, q, r, y, 2, 4)) return;
    if (!t.logs) {
      if (!isLog(this.get(q, r, y))) { this.end(a, t); return; }
      t.logs = this.C.treeLogs({ q, r, y });
      t.wood = t.logs.id;
    }
    if (!this.C.act(a, t, dt, ACT.chop, ...this.xz(t.at))) return;
    const L = t.logs.pop();
    if (L) {
      const id = this.get(...L);
      if (isLog(id)) { this.world.setBlock(...L, AIR); addCarry(a, itemOf(id)); }
      if (carried(a) < CARRY_MAX) return;
    }
    // l'arbre est à terre : une pousse à sa place
    const under = this.get(q, r, y - 1);
    if (this.get(q, r, y) === AIR && (under === 1 || under === 2)) this.world.setBlock(q, r, y, SAPLING_OF[t.wood] || SAPLING);
    a.scans && delete a.scans.trees;
    this.end(a, t);
  }

  // ---------- Fermier ----------
  task_farmer(a, b) {
    const spots = this.scan(a, 'farm', () => {
      const ripe = [], empty = [];
      for (const [q, r] of this.zoneCells(a, b)) {
        if (!this.loaded(q, r)) continue;
        for (let y = b.home[2] - 4; y <= b.home[2] + 6; y++) {
          const id = this.get(q, r, y);
          if (CROPS[id]) { ripe.push([q, r, y]); break; }
          if (isFarmland(id) && this.get(q, r, y + 1) === AIR) { empty.push([q, r, y + 1]); break; }
        }
      }
      return { ripe, empty };
    });
    const at = spots.ripe.find((p) => CROPS[this.get(...p)] && !this.claimed(a, key(...p)));
    if (at) { this.claim(a, key(...at), 30); b.msg = 'Je récolte'; return { kind: 'harvest', at, ck: key(...at) }; }
    if (b.sow) {
      const spot = spots.empty.find((p) => this.get(...p) === AIR && isFarmland(this.get(p[0], p[1], p[2] - 1)) && !this.claimed(a, key(...p)));
      if (spot) {
        const seed = hasCarry(a, SEED_IDS);
        if (seed) { this.claim(a, key(...spot), 30); b.msg = 'Je sème'; return { kind: 'sow', at: spot, seed, ck: key(...spot) }; }
        const f = this.need(a, b, SEED_IDS, 32);
        if (f) return f;
      }
    }
    // rien à récolter : il range sa récolte (en gardant ses graines)
    if (carried(a) - SEED_IDS.reduce((n, id) => n + (a.carry?.[id] || 0), 0) > 0 && b.box && this.boxAt(b.box)) return { kind: 'deposit', at: b.box };
    b.msg = 'Rien à récolter pour l\'instant';
    return null;
  }
  do_harvest(a, t, dt) {
    const [q, r, y] = t.at;
    if (!this.goNear(a, t, q, r, y, 1, 3)) return;
    if (!this.C.act(a, t, dt, ACT.harvest, ...this.xz(t.at))) return;
    const id = this.get(q, r, y), crop = CROPS[id];
    if (crop) {
      for (const [it, n] of crop.get()) addCarry(a, it, n);
      // (ressemée : une graine de la récolte)
      this.world.setBlock(q, r, y, takeCarry(a, crop.seed) ? crop.base : AIR);
    }
    this.end(a, t, 0.2);
  }
  do_sow(a, t, dt) {
    const [q, r, y] = t.at;
    if (!this.goNear(a, t, q, r, y, 1, 3)) return;
    if (!this.C.act(a, t, dt, ACT.sow, ...this.xz(t.at))) return;
    if (this.get(q, r, y) === AIR && isFarmland(this.get(q, r, y - 1)) && takeCarry(a, t.seed)) this.world.setBlock(q, r, y, SEED_CROP[t.seed]);
    this.end(a, t, 0.2);
  }

  // ---------- Éleveur ----------
  task_rancher(a, b) {
    const mine = this.A.list.filter((x) => !x.dead && FOODS[x.type] && this.inZone(b, x.pos.x, x.pos.y, x.pos.z));
    const by = {};
    for (const x of mine) (by[x.type] ||= []).push(x);
    const hungry = [];
    for (const [type, list] of Object.entries(by)) {
      // trop nombreux : il abat un adulte (si on le lui a permis)
      if (b.cull && list.length > b.max) {
        const v = list.find((x) => !x.baby && !this.claimed(a, 'A' + x.id));
        if (v) { this.claim(a, 'A' + v.id, 30); b.msg = 'J\'abats un animal en trop'; return { kind: 'cull', who: v, ck: 'A' + v.id }; }
      }
      if (list.length >= b.max) continue;
      // assez d'adultes prêts : on les nourrit (deux, pour un petit)
      const ready = list.filter((x) => !x.baby && !(x.loveT > 0) && !(x.breedCd > 0));
      if (ready.length + list.filter((x) => x.loveT > 0).length < 2) continue;
      const v = ready.find((x) => !this.claimed(a, 'A' + x.id));
      if (v) hungry.push(v);
    }
    for (const v of hungry) {
      const foods = FOODS[v.type], food = hasCarry(a, foods);
      if (food) { this.claim(a, 'A' + v.id, 20); b.msg = 'Je nourris les animaux'; return { kind: 'feed', who: v, food, ck: 'A' + v.id }; }
      const f = this.need(a, b, foods, 16);
      if (f) return f;
      b.msg = 'Il me faut de quoi nourrir les animaux (' + foods.map((id) => ITEMS[id]?.name || BLOCKS[id]?.name || id).join(', ') + ') dans mon coffre';
    }
    if (!hungry.length) b.msg = Object.keys(by).length ? 'Les animaux vont bien' : 'Pas d\'animaux dans ma zone';
    // ce qu'il a récolté (viande, laine) : au coffre
    const keep = new Set(Object.values(FOODS).flat());
    if (Object.keys(a.carry || {}).some((id) => !keep.has(+id)) && b.box && this.boxAt(b.box)) return { kind: 'deposit', at: b.box };
    return null;
  }
  // (l'animal bouge : on le rejoint là où il est)
  chase(a, t, who, reach = 2.2) {
    const d = Math.hypot(who.pos.x - a.pos.x, who.pos.z - a.pos.z);
    if (d <= reach && Math.abs(who.pos.y - a.pos.y) < 2) return true;
    if ((t.tries2 = (t.tries2 || 0) + 1) > 12) { this.end(a, t, 2); return false; }
    const c = worldToHex(who.pos.x, who.pos.z);
    this.C.goCell(a, t, c.q, c.r, Math.floor(who.pos.y + 0.1), 1, reach);
    return false;
  }
  do_feed(a, t, dt) {
    const v = t.who;
    if (!v || v.dead || !this.A.canEat(v, t.food)) { this.end(a, t); return; }
    if (!this.chase(a, t, v)) return;
    if (!this.C.act(a, t, dt, ACT.feed, v.pos.x, v.pos.z)) return;
    if (takeCarry(a, t.food)) { if (!this.A.feed(v, t.food)) addCarry(a, t.food); }
    this.end(a, t, 0.3);
  }
  do_cull(a, t, dt) {
    const v = t.who;
    if (!v || v.dead) { this.end(a, t); return; }
    if (!this.chase(a, t, v)) return;
    if (!this.C.act(a, t, dt, ACT.cull, v.pos.x, v.pos.z)) return;
    const drop = this.A.hit(v, 999, a.pos.x, a.pos.z);
    if (drop) addCarry(a, drop[0], drop[1]);
    if (v.meat) addCarry(a, v.meat[0], v.meat[1]);
    this.end(a, t, 0.5);
  }

  // ---------- Mineur ----------
  minable(id) {
    const B = BLOCKS[id];
    return !!id && !!SOLID[id] && !isWater(id) && !isLava(id) && !!B && !B.unbreakable && !B.container && !B.power && id !== ROBOT_DOCK;
  }
  task_miner(a, b) {
    const rad = Math.min(b.rad, MINE_RAD), top = b.home[2] + 6, bottom = b.home[2] - b.depth;
    const box = b.box ? key(...b.box) : '';
    // la couche la plus haute qui reste, le bloc le plus proche du robot
    const cells = this.zoneCells(a, b, rad);
    for (let y = top; y >= bottom; y--) {
      for (const [q, r] of cells) {
        if (!this.loaded(q, r)) continue;
        const k = key(q, r, y);
        if (k === box || !this.minable(this.get(q, r, y)) || this.claimed(a, k)) continue;
        // (pas la case sous un coffre, une station : ils tomberaient)
        if (this.get(q, r, y + 1) === ROBOT_DOCK || this.boxAt([q, r, y + 1])) continue;
        this.claim(a, k, 60);
        b.msg = 'Je creuse (' + (b.home[2] - y) + ' / ' + b.depth + ')';
        return { kind: 'dig', at: [q, r, y], ck: k };
      }
    }
    b.msg = 'Ma zone est creusée jusqu\'au fond (' + b.depth + ' blocs)';
    return null;
  }
  do_dig(a, t, dt) {
    const [q, r, y] = t.at;
    if (!t.phase) { t.phase = 'go'; this.C.goCell(a, t, q, r, y + 1, 2, REACH - 1); return; }
    if (!this.near(a, q, r, y)) {
      if (!t.jetTried) { t.jetTried = true; const s = this.spotNear({ q, r, y: y + 1 }); if (s && this.startJet(a, s)) return; }
      this.end(a, t, 0.5, true); return; // (hors de portée : il en prend un autre ; celui-ci reste réservé un moment)
    }
    if (!this.C.act(a, t, dt, ACT.dig, ...this.xz(t.at))) return;
    const id = this.get(q, r, y);
    if (this.minable(id)) {
      const drop = this.g?.dropOf?.(id) ?? [itemOf(id), 1];
      this.world.setBlock(q, r, y, AIR);
      if (drop) addCarry(a, drop[0], drop[1]);
    }
    this.end(a, t, 0.1);
  }

  // ---------- Transporteur ----------
  task_hauler(a, b) {
    if (!b.box || !this.boxAt(b.box)) { b.msg = 'Lie-moi un coffre de départ'; return null; }
    if (!b.box2 || !this.boxAt(b.box2)) { b.msg = 'Lie-moi un coffre d\'arrivée'; return null; }
    if (!this.boxAt(b.box).slots.some((s) => s && !s.w)) { b.msg = 'Le coffre de départ est vide'; return null; }
    b.msg = 'Je transporte';
    return { kind: 'fetch', at: b.box, ids: null, n: CARRY_MAX };
  }

  // ---------- Bâtisseur ----------
  task_builder(a, b, surv) {
    const S = this.g?.schem;
    if (!S?.projs.length) { b.msg = 'Pas de projection de schématique dans ma zone'; return null; }
    const todo = [];
    for (const p of S.projs) {
      if (!p.b.some(([q, r, y]) => this.inZone(b, hexToWorld(q, r).x, y, hexToWorld(q, r).z, b.rad + 2))) continue;
      for (const e of S.missing(p)) {
        const cur = this.get(e[0], e[1], e[2]);
        if ((cur === AIR || isWater(cur)) && this.loaded(e[0], e[1])) todo.push(e);
      }
    }
    if (!todo.length) { b.msg = 'Tout est construit'; return null; }
    // du bas vers le haut, ce qui se pose sur un bloc (rails, torches) après, au plus près
    const me = worldToHex(a.pos.x, a.pos.z);
    todo.sort((u, v) => (ATTACHED[u[3]] - ATTACHED[v[3]]) || u[2] - v[2] || hexDist(u[0] - me.q, u[1] - me.r) - hexDist(v[0] - me.q, v[1] - me.r));
    const lack = new Set();
    for (const e of todo) {
      const k = key(e[0], e[1], e[2]);
      if (this.claimed(a, k)) continue;
      // (le bloc posé ne doit rien soutenir dans le vide : sous lui, un bloc, ou une case de la projection déjà faite)
      const it = itemOf(e[3]);
      if (surv && !(a.carry?.[it] > 0)) {
        if (b.box && this.boxCount(b.box, [it]) > 0) return { kind: 'fetch', at: b.box, ids: [it], n: CARRY_MAX - carried(a) || 1 };
        lack.add(it);
        continue;
      }
      this.claim(a, k, 30);
      b.msg = 'Je construis (' + todo.length + ' bloc' + (todo.length > 1 ? 's' : '') + ' restant' + (todo.length > 1 ? 's' : '') + ')';
      return { kind: 'build', at: [e[0], e[1], e[2]], id: e[3], item: it, ck: k };
    }
    if (lack.size) b.msg = 'Il me manque dans mon coffre : ' + [...lack].slice(0, 4).map((id) => this.g?.itemName?.(id) || BLOCKS[id]?.name || id).join(', ');
    return null;
  }
  do_build(a, t, dt) {
    const [q, r, y] = t.at;
    if (!t.phase) { t.phase = 'go'; this.C.goCell(a, t, q, r, y, 3, REACH - 1); return; }
    if (!this.near(a, q, r, y)) {
      if (!t.jetTried) { t.jetTried = true; const s = this.spotNear({ q, r, y: y + 1 }) || this.spotNear({ q, r, y }); if (s && this.startJet(a, s)) return; }
      this.end(a, t, 0.5, true); return;
    }
    // debout dans la case à remplir (le haut d'une tour) : il se pousse à côté, d'un bond
    const occupies = (p, h) => { const c = worldToHex(p.pos.x, p.pos.z); return c.q === q && c.r === r && y >= Math.floor(p.pos.y + 0.05) && y <= Math.floor(p.pos.y + h); };
    if (occupies(a, 1.4)) {
      // (la case de ses pieds, de la place au-dessus : il monte d'un cran, comme un joueur qui fait un pilier)
      if (y === Math.floor(a.pos.y + 0.05) && !SOLID[this.get(q, r, y + 1)] && !SOLID[this.get(q, r, y + 2)]) {
        const c = hexToWorld(q, r);
        a.pos.set(c.x, y + 1.02, c.z); a.vel.set(0, 0, 0);
      }
    }
    if (occupies(a, 1.4)) {
      const s = (t.moved = (t.moved || 0) + 1) <= 2 && (this.spotNear({ q, r, y }, true) || this.spotNear({ q, r, y: y + 1 }, true));
      if (s && this.startJet(a, s)) { t.clock = undefined; return; }
      this.end(a, t, 0.5, true); return;
    }
    if (!this.C.act(a, t, dt, ACT.build, ...this.xz(t.at))) return;
    const cur = this.get(q, r, y);
    // (pas dans la case d'un joueur)
    const inside = (this.A.players || []).some((p) => occupies(p, 1.7));
    if ((cur === AIR || isWater(cur)) && !inside) {
      const surv = this.survival();
      if (!surv || takeCarry(a, t.item)) this.world.setBlock(q, r, y, t.id);
    }
    this.end(a, t, 0.05);
  }

  // ---------- Fenêtre de réglage (clic droit sur le robot) ----------
  open(a) {
    const g = this.g;
    if (!a.bot) { g.toast('Les robots se règlent chez l\'hôte de la partie'); return; }
    g.style();
    if (!document.getElementById('robot-style')) {
      const st = document.createElement('style');
      st.id = 'robot-style';
      st.textContent = '#orb-body .robot-jobs button.on { background: #2f6f3a; color: #fff; outline: 2px solid #7fe08a; } #orb-body input[type=range] { flex: 1; }';
      document.head.appendChild(st);
    }
    const b = a.bot, E = (tag, props = {}, ...kids) => {
      const e = document.createElement(tag);
      for (const [k, v] of Object.entries(props)) { if (k === 'on') for (const [ev, fn] of Object.entries(v)) e.addEventListener(ev, fn); else if (k in e) e[k] = v; else e.setAttribute(k, v); }
      for (const c of kids) e.append(c);
      return e;
    };
    const body = document.getElementById('orb-body');
    body.innerHTML = '';
    const redraw = () => this.open(a);
    body.append(E('h3', { textContent: (b.name || 'Robot') + ' · ' + JOB[b.job].name }));
    const status = E('div', { className: 'orb-s' });
    body.append(status);
    // nom
    const name = E('input', { type: 'text', value: b.name, maxLength: 24, placeholder: 'Nom du robot', spellcheck: false, on: { change: () => { b.name = name.value.trim().slice(0, 24); this.world.changed = true; } } });
    body.append(E('label', { className: 'orb-row', textContent: 'Nom' }, name));
    // métier
    const jobs = E('div', { className: 'orb-row robot-jobs' });
    for (const [k, nm] of ROBOT_JOBS) {
      jobs.append(E('button', { textContent: nm, className: k === b.job ? 'on' : '', title: JOB[k].desc, on: { click: () => {
        b.job = k; a.task && this.end(a, a.task, 0); a.task = null; a.scans = null; b.msg = '';
        if (k !== 'follow' && k !== 'idle') { const c = worldToHex(a.pos.x, a.pos.z); if (!b.home || hexDist(c.q - b.home[0], c.r - b.home[1]) > b.rad + 4) b.home = [c.q, c.r, Math.floor(a.pos.y + 0.05)]; }
        this.world.changed = true; redraw();
      } } }));
    }
    body.append(jobs);
    body.append(E('p', { className: 'orb-d', textContent: JOB[b.job].desc }));
    if (b.job !== 'idle' && b.job !== 'follow') {
      // zone
      const val = E('span', { textContent: ' ' + b.rad + ' cases' });
      const rad = E('input', { type: 'range', min: 2, max: MAX_RAD, value: b.rad, on: { input: () => { b.rad = +rad.value; val.textContent = ' ' + b.rad + ' cases'; a.scans = null; this.world.changed = true; } } });
      body.append(E('label', { className: 'orb-row', textContent: 'Rayon de la zone' + (b.job === 'miner' ? ' (le trou : ' + MINE_RAD + ' au plus)' : '') }, rad, val));
      body.append(E('div', { className: 'row' },
        E('button', { textContent: 'Centre de la zone : là où je suis', on: { click: () => { const p = g.playerPos(); const c = worldToHex(p.x, p.z); b.home = [c.q, c.r, Math.floor(p.y + 0.05)]; a.scans = null; this.world.changed = true; g.toast('Zone du robot : centrée sur toi'); redraw(); } } }),
        E('button', { textContent: 'Centre : le robot', on: { click: () => { const c = worldToHex(a.pos.x, a.pos.z); b.home = [c.q, c.r, Math.floor(a.pos.y + 0.05)]; a.scans = null; this.world.changed = true; redraw(); } } })));
      // coffres
      const boxTxt = (p) => (p ? (this.boxAt(p) ? 'lié (' + p.join(', ') + ')' : 'introuvable') : 'aucun');
      const linkBtn = (which, label) => E('button', { textContent: label, on: { click: () => { this.linking = { a, which }; g.closePanel(); g.toast('Clic droit sur un coffre pour le lier au robot (ailleurs : annulé)'); } } });
      body.append(E('p', { className: 'orb-d', textContent: (b.job === 'hauler' ? 'Coffre de départ : ' : 'Coffre : ') + boxTxt(b.box) + (b.job === 'hauler' ? ' · coffre d\'arrivée : ' + boxTxt(b.box2) : '') }));
      body.append(E('div', { className: 'row' }, linkBtn('box', b.job === 'hauler' ? 'Lier le coffre de départ' : 'Lier un coffre'), ...(b.job === 'hauler' ? [linkBtn('box2', 'Lier le coffre d\'arrivée')] : [])));
      // réglages du métier
      if (b.job === 'rancher') {
        const max = E('input', { type: 'number', min: 0, max: 50, value: b.max, on: { change: () => { b.max = Math.max(0, Math.min(50, Math.round(+max.value || 0))); this.world.changed = true; } } });
        const cull = E('input', { type: 'checkbox', checked: b.cull, on: { change: () => { b.cull = cull.checked; this.world.changed = true; } } });
        body.append(E('div', { className: 'orb-row' }, E('label', { textContent: 'Animaux par espèce au plus' }, max), E('label', { textContent: 'Abattre le surplus ' }, cull)));
      } else if (b.job === 'farmer') {
        const sow = E('input', { type: 'checkbox', checked: b.sow, on: { change: () => { b.sow = sow.checked; this.world.changed = true; } } });
        body.append(E('label', { className: 'orb-row', textContent: 'Semer la terre labourée vide ' }, sow));
      } else if (b.job === 'miner') {
        const dep = E('input', { type: 'number', min: 1, max: MAX_DEPTH, value: b.depth, on: { change: () => { b.depth = Math.max(1, Math.min(MAX_DEPTH, Math.round(+dep.value || 1))); this.world.changed = true; } } });
        body.append(E('label', { className: 'orb-row', textContent: 'Profondeur (blocs sous le centre de la zone)' }, dep));
      }
    }
    body.append(E('div', { className: 'row' },
      E('button', { textContent: 'Ramasser le robot', on: { click: () => { this.pickUp(a); g.closePanel(); } } }),
      E('button', { textContent: 'Fermer', on: { click: () => g.closePanel() } })));
    const upd = () => {
      const surv = this.survival(), n = carried(a);
      const t = (surv ? 'Batterie : ' + Math.round(b.e * 100) + ' %' : 'Batterie : illimitée (créatif)') + ' · ' + (b.msg || JOB[b.job].name) + (n ? ' · porte ' + n + ' objet' + (n > 1 ? 's' : '') : '');
      if (status.textContent !== t) status.textContent = t;
    };
    upd();
    clearInterval(this.timer);
    this.timer = setInterval(() => { if (!g.panelOpen() || !status.isConnected) { clearInterval(this.timer); return; } upd(); }, 300);
    g.openPanel();
  }
  // Clic droit après « Lier un coffre » : vrai si le clic est pris
  link(target) {
    const L = this.linking;
    if (!L) return false;
    this.linking = null;
    const h = target?.hit;
    if (!h || !this.boxAt([h.q, h.r, h.y])) { this.g.toast('Lien annulé : ce n\'est pas un coffre'); return true; }
    L.a.bot[L.which] = [h.q, h.r, h.y];
    L.a.scans = null;
    this.world.changed = true;
    this.g.toast('Coffre lié au robot');
    return true;
  }
  // Ramassé : le robot revient dans l'inventaire (et ce qu'il porte aussi), sa batterie est perdue
  pickUp(a) {
    const g = this.g;
    if (g.survival()?.on) {
      g.give(this.robotItem, 1);
      for (const [id, n] of Object.entries(a.carry || {})) g.give(+id, n);
    }
    a.carry = {};
    this.A.list.splice(this.A.list.indexOf(a), 1);
    this.world.changed = true;
  }
}
