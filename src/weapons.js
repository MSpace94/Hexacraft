// Armes et boucliers (lot 5).
//  - Armes à main (objets « gun ») : pistolet, fusil, railgun (rayon instantané qui traverse les
//    êtres), arme à énergie (cellules), lance-flammes (bidons d'essence). Munitions : balle, balle en
//    uranium appauvri (plus forte, traverse), tige, cellule. Le tir, le viseur et le recul : main.js.
//  - Armes en blocs (blocs « weapon ») posées sur un objet collé : on tire depuis son poste de
//    pilotage (clic gauche), toutes ensemble vers le point visé. Leurs munitions sont dans les
//    chambres de chargement de l'objet ; le canon à bobine prend la charge des accumulateurs.
//    Canon automatique (balles), lance-roquettes, lance-missiles (à tête chercheuse),
//    lance-torpilles (sous l'eau), canon à bobine (perce les blocs), canon d'artillerie (obus),
//    canon Gustave (obus lourds... ou charge nucléaire, si le monde l'autorise).
//  - Boucliers : émetteur (une bulle autour de l'objet qui arrête les tirs, tant que les
//    accumulateurs ont de la charge ; posé dans le monde et alimenté : une bulle autour de lui),
//    déflecteur (abat les roquettes, missiles, torpilles et obus qui approchent), projecteur de
//    bouclier thermique (arrête le feu et l'énergie ; à grande vitesse, un bouclier orange devant
//    l'objet), générateur de bouclier stellaire (tout près, les explosions ne cassent rien).
//  - Tourelles (blocs « turret ») : sur un objet collé ou dans le monde, elles visent et tirent toutes
//    seules sur ce qui est d'une autre équipe (objets collés, joueurs qui ont choisi une équipe). Leur
//    tête (un petit canon qui tourne) est dessinée à part. L'équipe d'un objet, d'une tourelle posée :
//    à la clé à molette. Leurs tirs, et ceux des armes en blocs, abîment les objets touchés, bloc par bloc.
// L'hôte (ou le solo) simule les vrais tirs ; un client tire des « fantômes » (seulement à voir)
// et prévient l'hôte, qui tire pour de vrai (voir net.js : wp, wseat, wpfx).
import * as THREE from 'three';
import {
  BLOCKS, SOLID, AIR, blockBox, isWater, isTnt, CANISTER,
  BULLET, DU_BULLET, RAIL_ROD, ENERGY_CELL, ROCKET_AMMO, MISSILE_AMMO, TORPEDO_AMMO, HEAVY_SHELL, NUKE_CHARGE,
  TEAMS, teamOf,
} from './blocks.js?v=1.1.5-alpha-mwgq2wrb';
import { worldToHex, hexToWorld, NEIGHBORS } from './hex.js?v=1.1.5-alpha-mwgq2wrb';
import { CAN_OF } from './liquids.js?v=1.1.5-alpha-mwgq2wrb';
import { DEPTH } from './gen.js?v=1.1.5-alpha-mwgq2wrb';
import { playShot } from './sfx.js?v=1.1.5-alpha-mwgq2wrb';

const SHELL = 594; // obus (voir trains.js)
const RADIUS = 3.8; // rayon d'une TNT (voir tnt.js)
const boom = (power, level = 0, water = false) => ({ fuse: 0, radius: RADIUS * Math.cbrt(power), power, level, water });
export const NUKE_BOOM = { fuse: 0, radius: 56, power: 6000, level: 3 };

// Projectiles : vitesse au départ (blocs/s), gravité, durée de vie (s), explosion
const PROJ = {
  bullet: { speed: 190, g: 4, life: 1.5 },
  energy: { speed: 75, g: 0, life: 2.5, heat: true },
  flame: { speed: 15, g: -3, life: 0.6, heat: true },
  coil: { speed: 450, g: 0, life: 0.7, breaks: 4 },
  rocket: { speed: 50, g: 0, life: 5, boom: boom(2) },
  missile: { speed: 28, accel: 70, max: 90, g: 0, life: 8, boom: boom(5), homing: true },
  torpedo: { speed: 34, g: 0, life: 10, boom: boom(8, 0, true), torpedo: true },
  shell: { speed: 95, g: 14, life: 10, boom: boom(3) },
  heavy: { speed: 150, g: 12, life: 16, boom: boom(60, 1) },
  nuke: { speed: 150, g: 12, life: 16, boom: NUKE_BOOM },
};
export const PROJ_KINDS = Object.keys(PROJ).concat('rail');

// Armes à main. rate : secondes entre deux tirs ; auto : on tire en maintenant le clic ; shots :
// tirs par munition (une cellule, un bidon) ; empty : ce qui reste de la munition ; zoom : viseur
// (clic droit) ; kick : recul (radians)
export const GUNS = {
  pistol: { ammo: [DU_BULLET, BULLET], rate: 0.28, auto: false, proj: 'bullet', dmg: 5, spread: 0.008, kick: 0.035, zoom: 1.6 },
  rifle: { ammo: [DU_BULLET, BULLET], rate: 0.11, auto: true, proj: 'bullet', dmg: 6, spread: 0.014, kick: 0.02, zoom: 3 },
  rail: { ammo: [RAIL_ROD], rate: 1.3, auto: false, proj: 'rail', dmg: 30, spread: 0, kick: 0.1, zoom: 5 },
  energy: { ammo: [ENERGY_CELL], shots: 12, rate: 0.16, auto: true, proj: 'energy', dmg: 7, spread: 0.006, kick: 0.012, zoom: 2 },
  flame: { ammo: [CAN_OF.petrol], shots: 160, empty: CANISTER, rate: 0.05, auto: true, proj: 'flame', dmg: 1.5, spread: 0.08, kick: 0, zoom: 1 },
};
// Armes en blocs. charge : ce qu'un tir prend aux accumulateurs ; recoil : recul de l'objet
export const MOUNTS = {
  auto: { ammo: [DU_BULLET, BULLET], rate: 0.12, proj: 'bullet', dmg: 8, spread: 0.012 },
  rocket: { ammo: [ROCKET_AMMO], rate: 0.8, proj: 'rocket', spread: 0.01 },
  missile: { ammo: [MISSILE_AMMO], rate: 1.4, proj: 'missile' },
  torpedo: { ammo: [TORPEDO_AMMO], rate: 2, proj: 'torpedo' },
  coil: { ammo: [RAIL_ROD], rate: 0.9, proj: 'coil', dmg: 40, charge: 25, recoil: 600 },
  artillery: { ammo: [SHELL], rate: 2, proj: 'shell', spread: 0.004, recoil: 1500 },
  gustave: { ammo: [NUKE_CHARGE, HEAVY_SHELL], rate: 6, proj: 'heavy', recoil: 8000 },
};
// Tourelles. range : portée (blocs) ; charge : ce qu'un tir laser prend aux accumulateurs
export const TURRETS = {
  gun: { ammo: [DU_BULLET, BULLET], rate: 0.14, proj: 'bullet', dmg: 6, spread: 0.012, range: 90, speed: 190 },
  missile: { ammo: [MISSILE_AMMO], rate: 2.5, proj: 'missile', range: 220, speed: 60 },
  laser: { laser: true, charge: 8, rate: 0.45, dmg: 14, range: 160, speed: Infinity },
};
const TURN = 3.2;              // une tête de tourelle tourne de 3,2 rad/s
const RETARGET = 0.5;          // elle cherche sa cible deux fois par seconde
const AROUND = [...NEIGHBORS.map(([q, r]) => [q, r, 0]), [0, 0, 1], [0, 0, -1]]; // (les 8 voisins d'un bloc)
const AIM_OK = 0.12;           // elle tire quand elle vise à moins de 0,12 rad de la cible
const BLOCK_HP = 60;
const TACTIC_R = { chase: 300, flee: 90, guard: 70 }; // (stratégies des voitures : à quelle distance elles réagissent)
const CAR_STAND = 22;           // (une voiture qui chasse tourne à cette distance de sa cible)           // dégâts qu'il faut pour casser un bloc d'un objet collé
const WORLD_TURRET_R = 320;    // tourelles du monde : actives à moins de 320 blocs du joueur
const ACCU_MAX = 100, ACCU_RATE = 6;           // charge d'un accumulateur, et ce qu'il regagne par seconde
const WORLD_SHIELD = { emitter: 9, deflector: 18, stellar: 24 }; // portée des boucliers posés dans le monde
const WORLD_HP = 150, WORLD_REGEN = 10;         // émetteur posé : sa réserve, et ce qu'il regagne par seconde
const DEFLECT_COOL = 1.0;                        // un déflecteur abat un tir par seconde
const EXPLOSIVE = (k) => !!PROJ[k]?.boom;

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3(), _h = new THREE.Vector3();
const Z = new THREE.Vector3(0, 0, 1), UP = new THREE.Vector3(0, 1, 0);
const rr = (a, b) => a + Math.random() * (b - a);
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// Entrée d'un rayon (o, d unitaire) dans une sphère : distance, ou null
function raySphere(o, d, c, R) {
  const lx = c.x - o.x, ly = c.y - o.y, lz = c.z - o.z;
  const tc = lx * d.x + ly * d.y + lz * d.z, d2 = lx * lx + ly * ly + lz * lz - tc * tc;
  if (d2 > R * R) return null;
  const t = tc - Math.sqrt(R * R - d2);
  return t >= 0 ? t : null;
}

// Texture de la bulle : un pavage d'hexagones lumineux (bouclier)
function hexTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const x = c.getContext('2d');
  x.strokeStyle = '#ffffff'; x.lineWidth = 3;
  const R = 16, w = R * Math.sqrt(3);
  for (let row = -1; row < 12; row++) {
    for (let col = -1; col < 10; col++) {
      const cx = col * w + (row & 1 ? w / 2 : 0), cy = row * R * 1.5;
      x.beginPath();
      for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + (i * Math.PI) / 3; x.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); }
      x.closePath(); x.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(4, 2);
  return t;
}

export class Weapons {
  // g : le jeu (voir main.js) : scene, world, fx, structs, animals, hexaliens, containers,
  // circuits, tnt, et les rappels hurtAnimal, hurtPlayer, rayPlayers, explode, breakBlock,
  // nukesOn, ear (position de la caméra), remote (client en ligne)
  constructor(g) {
    this.g = g;
    this.list = [];            // projectiles en vol
    this.beams = [];           // rayons (railgun, déflecteur) qui s'effacent
    this.bubbles = [];         // bulles de bouclier qui s'effacent
    this.cool = new Map();     // "id de l'objet:case" -> instant (s) du prochain tir possible
    this.charge = new Map();   // id de l'objet -> charge de ses accumulateurs
    this.worldShields = new Map(); // "q,r,y" -> sorte de bouclier posé dans le monde
    this.worldHp = new Map();      // "q,r,y" -> réserve d'un émetteur posé
    this.defCool = new Map();      // déflecteur ("S<id>:case" ou "q,r,y") -> instant du prochain tir
    this.cache = new WeakMap();    // objet collé -> ce qu'il porte (armes, chambres, boucliers...)
    this.heat = new Map();         // id de l'objet -> bouclier thermique affiché
    this.teams = new Map();        // id de l'objet -> son équipe ('rouge', ...)
    this.tactics = new Map();      // id d'une voiture -> sa stratégie ('chase', 'flee', 'guard')
    this.worldTurrets = new Map(); // "q,r,y" -> { kind, team } (tourelles posées dans le monde)
    this.tur = new Map();          // tourelle ("S<id>:case" ou "W<case>") -> { dir, target, look, head }
    this.blockDmg = new Map();     // "id:case" -> dégâts reçus par ce bloc d'un objet collé
    this.clock = 0;
    const box = (x, y, z) => new THREE.BoxGeometry(x, y, z);
    const rod = (r, l) => new THREE.CylinderGeometry(r, r, l, 6).rotateX(Math.PI / 2);
    const mat = (c) => new THREE.MeshBasicMaterial({ color: c });
    this.models = {
      bullet: [box(0.05, 0.05, 1.4), mat(0xffe9a0)],
      energy: [new THREE.SphereGeometry(0.16, 6, 4), mat(0x7ff6ff)],
      coil: [box(0.07, 0.07, 3), mat(0xc8ecff)],
      rocket: [rod(0.12, 0.8), mat(0x9aa0a8)],
      missile: [rod(0.14, 1.2), mat(0xe8edf2)],
      torpedo: [rod(0.2, 1.6), mat(0x34405a)],
      shell: [rod(0.12, 0.5), mat(0x4a4e56)],
      heavy: [rod(0.3, 1.2), mat(0x3a3e46)],
      nuke: [rod(0.3, 1.2), mat(0xffd34d)],
    };
    const tex = hexTexture();
    this.bubbleGeo = new THREE.SphereGeometry(1, 24, 16);
    this.capGeo = new THREE.SphereGeometry(1, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2);
    this.bubbleMat = (color) => new THREE.MeshBasicMaterial({ color, map: tex, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    // la tête d'une tourelle : une coupole (couleur de l'équipe) et son canon, le long de +Z
    this.headGeo = {
      dome: new THREE.SphereGeometry(0.34, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      gun: new THREE.CylinderGeometry(0.07, 0.08, 0.9, 8).rotateX(Math.PI / 2).translate(0, 0.14, 0.45),
      twin: new THREE.BoxGeometry(0.34, 0.16, 0.7).translate(0, 0.16, 0.25),
      lens: new THREE.CylinderGeometry(0.11, 0.15, 0.55, 10).rotateX(Math.PI / 2).translate(0, 0.16, 0.3),
    };
    this.headMat = { dark: new THREE.MeshLambertMaterial({ color: 0x2e3238 }), red: new THREE.MeshBasicMaterial({ color: 0xff5a4a }) };
  }

  // ---------- Ce que porte un objet collé (recalculé quand ses blocs changent) ----------
  ship(s) {
    let c = this.cache.get(s);
    if (c && c.list === s.list) return c;
    c = { list: s.list, weapons: [], turrets: [], boxes: [], accus: 0, emit: 0, defl: [], thermal: 0, stellar: 0 };
    for (const [q, r, y, id] of s.list) {
      const B = BLOCKS[id];
      if (!B) continue;
      const k = q + ',' + r + ',' + y;
      if (B.weapon) c.weapons.push([q, r, y, B.weapon, k]);
      if (B.turret) c.turrets.push([q, r, y, B.turret, k]);
      if (B.ammoBox) c.boxes.push(k);
      if (B.accu) c.accus++;
      if (B.shield === 'emitter') c.emit++;
      else if (B.shield === 'deflector') c.defl.push([q, r, y, k]);
      else if (B.shield === 'thermal') c.thermal++;
      else if (B.shield === 'stellar') c.stellar++;
    }
    this.cache.set(s, c);
    return c;
  }
  // Centre d'une case de l'objet, dans le monde
  cellPos(s, q, r, y, out) {
    const c = hexToWorld(q, r);
    return this.g.structs.toWorld(s, out.set(c.x, y + 0.5, c.z), out);
  }

  // ---------- Bloc du monde ----------
  solidAt(p) {
    const { q, r } = worldToHex(p.x, p.z), y = Math.floor(p.y);
    const id = this.g.world.getBlock(q, r, y);
    if (!SOLID[id]) return false;
    const [lo, hi] = blockBox(id), fy = p.y - y;
    return fy >= lo && fy < hi;
  }
  waterAt(p) { const { q, r } = worldToHex(p.x, p.z); return isWater(this.g.world.getBlock(q, r, Math.floor(p.y))); }

  // Un bloc posé ou cassé dans le monde (les boucliers posés : voir worldShields)
  onWorldSet(q, r, y, id) {
    const k = q + ',' + r + ',' + y, sh = BLOCKS[id]?.shield, tu = BLOCKS[id]?.turret;
    if (tu) { const old = this.worldTurrets.get(k); this.worldTurrets.set(k, { kind: tu, team: old?.team ?? null }); }
    else if (this.worldTurrets.delete(k)) this.dropHead('W' + k);
    if (sh && WORLD_SHIELD[sh]) this.worldShields.set(k, sh);
    else if (this.worldShields.delete(k)) this.worldHp.delete(k);
  }
  // Boucliers du monde alimentés, de cette sorte : [[centre, clé]]
  *worldOn(kind) {
    for (const [k, sh] of this.worldShields) {
      if (sh !== kind) continue;
      const [q, r, y] = k.split(',').map(Number);
      if (this.g.world.getBlock(q, r, y) && BLOCKS[this.g.world.getBlock(q, r, y)]?.shield !== kind) { this.worldShields.delete(k); continue; }
      if (!this.g.circuits.powered(q, r, y)) continue;
      const c = hexToWorld(q, r);
      yield [_b.set(c.x, y + 0.5, c.z), k];
    }
  }

  // ---------- Tirer ----------
  // Lance un projectile. o : { pid (joueur), sid (objet collé qui tire), vel (vitesse du tireur),
  // dmg, pierce, ghost (seulement à voir) }
  spawn(kind, P, dir, o = {}) {
    const S = PROJ[kind];
    if (!S) return null;
    const p = {
      kind, P: P.clone(), v: dir.clone().normalize().multiplyScalar(S.speed), age: 0, life: S.life,
      dmg: o.dmg || 0, pierce: o.pierce || 0, breaks: S.breaks || 0, owner: { pid: o.pid ?? 0, sid: o.sid ?? null, team: o.team ?? null, turret: !!o.turret },
      ghost: !!o.ghost, hits: new Set(), target: null,
    };
    if (o.vel) p.v.addScaledVector(o.vel, kind === 'flame' ? 0.6 : 1);
    const m = this.models[kind];
    if (m) {
      p.mesh = new THREE.Mesh(m[0], m[1]);
      p.mesh.position.copy(P);
      p.mesh.quaternion.setFromUnitVectors(Z, _d.copy(p.v).normalize());
      this.g.scene.add(p.mesh);
    }
    if (S.homing && !p.ghost) p.target = o.target || this.findTarget(P, _d.copy(dir).normalize(), p.owner);
    this.list.push(p);
    return p;
  }

  // Un coup de feu (son, éclair à la bouche)
  muzzle(kind, P, dir) {
    const fx = this.g.fx;
    playShot(kind, this.g.ear().distanceTo(P));
    if (kind === 'flame') return;
    const col = kind === 'energy' || kind === 'rail' || kind === 'coil' ? '#9ff6ff' : '#ffd27a';
    for (let i = 0; i < 4; i++) fx.glow.spawn(P.clone(), V(dir.x * 3 + rr(-1, 1), dir.y * 3 + rr(-1, 1), dir.z * 3 + rr(-1, 1)), rr(0.06, 0.12), col, rr(0.08, 0.16), 0, 4);
    if (EXPLOSIVE(kind)) for (let i = 0; i < 8; i++) fx.puffs.spawn(P.clone(), V(rr(-1.5, 1.5), rr(0, 1.5), rr(-1.5, 1.5)), rr(0.5, 1), '#d8d8d8', rr(0.3, 0.6), 0.6, 2);
  }

  // Arme à main : un tir (gun : sorte, ammo : munition prise ; from, dir : la bouche, le regard)
  fireHand(gun, ammo, from, dir, o = {}) {
    const G = GUNS[gun];
    if (!G) return;
    const du = ammo === DU_BULLET;
    const d = _a.copy(dir);
    if (G.spread) d.add(V(rr(-1, 1), rr(-1, 1), rr(-1, 1)).multiplyScalar(G.spread)).normalize();
    const opt = { ...o, dmg: G.dmg * (du ? 1.8 : 1), pierce: du ? 2 : 0 };
    this.muzzle(G.proj, from, d);
    if (G.proj === 'rail') this.rail(from, d.clone(), opt);
    else this.spawn(G.proj, from, d, opt);
  }

  // Railgun : un rayon instantané, qui traverse les êtres jusqu'au premier bloc
  rail(from, dir, o) {
    const owner = { pid: o.pid ?? 0, sid: o.sid ?? null }, hits = new Set();
    let P = from.clone(), left = 160, end = null;
    for (let n = 0; n < 12 && left > 0; n++) {
      const h = this.trace(P, dir, left, owner, hits);
      if (!h) break;
      const at = P.clone().addScaledVector(dir, h.t);
      if (h.type === 'block' || h.type === 'struct') { end = at; if (!o.ghost) this.sparks(at, '#9ff6ff'); break; }
      if (!o.ghost) this.hurt(h, o.dmg, at, owner);
      hits.add(h.a || 'p' + h.pid);
      left -= h.t + 0.05;
      P = at.addScaledVector(dir, 0.05);
    }
    this.beam(from, end || from.clone().addScaledVector(dir, 160), 0x9ff6ff, 0.35);
  }

  // Client : un tir d'arme en bloc de l'hôte (à voir seulement)
  ghostShot(kind, P, dir, end = null) {
    if (kind === 'laser') { this.beam(P.clone(), end ? end.clone() : P.clone().addScaledVector(dir, 160), 0xff4a3a, 0.18); playShot('energy', this.g.ear().distanceTo(P)); return; }
    if (!PROJ[kind]) return;
    this.muzzle(kind, P, dir);
    this.spawn(kind, P, dir, { ghost: true });
  }

  // Armes en blocs de l'objet s : tout ce qui est prêt tire vers le point visé (eye, dir : le
  // regard du pilote). free : sans munitions (créatif). Renvoie un message si rien n'a tiré.
  fireSeat(s, eye, dir, pid = 0, free = false) {
    const c = this.ship(s);
    if (!c.weapons.length) return 'Aucune arme sur cet engin';
    const now = this.clock;
    // (le point visé : le premier obstacle droit devant, sinon à 120 blocs)
    const h = this.trace(eye, dir, 120, { pid, sid: s.id });
    const aim = eye.clone().addScaledVector(dir, h ? Math.max(8, h.t) : 120);
    let fired = 0, why = '';
    for (const [q, r, y, w, k] of c.weapons) {
      const M = MOUNTS[w], ck = s.id + ':' + k;
      if (!M || (this.cool.get(ck) || 0) > now) continue;
      if (M.charge && (this.charge.get(s.id) || 0) < M.charge) { why = c.accus ? 'Accumulateurs vides : attends qu\'ils se rechargent' : 'Il faut un accumulateur électrique pour le canon à bobine'; continue; }
      let ammo = this.takeAmmo(s, c, M.ammo, !free);
      if (!ammo && free) ammo = M.ammo.find((a) => a !== NUKE_CHARGE);
      if (!ammo) { why = c.boxes.length ? 'Plus de munitions dans les chambres de chargement' : 'Il faut une chambre de chargement (avec des munitions) sur l\'engin'; continue; }
      this.cool.set(ck, now + M.rate);
      if (M.charge) this.charge.set(s.id, (this.charge.get(s.id) || 0) - M.charge);
      const P = this.cellPos(s, q, r, y, new THREE.Vector3());
      const d = aim.clone().sub(P).normalize();
      if (M.spread) d.add(V(rr(-1, 1), rr(-1, 1), rr(-1, 1)).multiplyScalar(M.spread)).normalize();
      P.addScaledVector(d, 0.9);
      const kind = ammo === NUKE_CHARGE ? 'nuke' : M.proj;
      const du = ammo === DU_BULLET;
      this.muzzle(kind, P, d);
      this.spawn(kind, P, d, { pid, sid: s.id, team: this.teams.get(s.id) ?? null, vel: s.vel, dmg: (M.dmg || 0) * (du ? 1.8 : 1), pierce: du ? 2 : 0 });
      this.g.onFire?.(kind, P, d, null);
      if (M.recoil) { s.vel.addScaledVector(d, -M.recoil / Math.max(50, s.mass || 1000)); this.g.structs.wake(s); }
      fired++;
    }
    return fired ? '' : why || 'Pas encore rechargé';
  }

  // Munition prise dans les chambres de chargement de l'objet (dans l'ordre de la liste ; une charge
  // nucléaire, seulement si le monde l'autorise). take : la retirer
  takeAmmo(s, c, list, take = true) {
    const nukes = this.g.nukesOn();
    for (const id of list) {
      if (id === NUKE_CHARGE && !nukes) continue;
      for (const k of c.boxes) {
        const box = this.g.containers.atStruct(s, k);
        const slots = box?.slots || [];
        const i = slots.findIndex((x) => x?.id === id && x.n > 0);
        if (i < 0) continue;
        if (take && --slots[i].n <= 0) slots[i] = null;
        return id;
      }
    }
    return 0;
  }

  // Missile : la cible la plus proche du regard (animal, joueur, objet collé), dans un cône
  findTarget(P, dir, owner) {
    let best = null, bs = 0.97;
    const consider = (pos, t) => {
      _h.subVectors(pos, P);
      const d = _h.length();
      if (d < 3 || d > 220) return;
      const c = _h.dot(dir) / d;
      if (c > bs) { bs = c; best = t; }
    };
    for (const a of this.g.animals.list) if (!a.dead && a.active) consider(_a.set(a.pos.x, a.pos.y + 0.6, a.pos.z), { a });
    for (const s of this.g.structs.list) if (s.id !== owner.sid && !s.unloaded) consider(s.pos, { s });
    for (const rp of this.g.players?.() || []) if (rp.pid !== owner.pid) consider(_a.set(rp.pos.x, rp.pos.y + 1, rp.pos.z), { rp });
    return best;
  }
  targetPos(t, out) {
    if (t.a) return t.a.dead ? null : out.set(t.a.pos.x, t.a.pos.y + 0.6, t.a.pos.z);
    if (t.s) return this.g.structs.list.includes(t.s) ? out.copy(t.s.pos) : null;
    if (t.rp) return out.set(t.rp.pos.x, t.rp.pos.y + 1, t.rp.pos.z);
    return null;
  }

  // ---------- Ce que touche un segment [P, P + D·L] (D unitaire) ----------
  trace(P, D, L, owner, skip) {
    let best = null;
    const take = (t, h) => { if (t >= 0 && t <= L && (!best || t < best.t)) { h.t = t; best = h; } };
    for (let t = 0; ; t += 0.15) {
      const tt = Math.min(t, L);
      if (this.solidAt(_a.copy(P).addScaledVector(D, tt))) { take(tt, { type: 'block' }); break; }
      if (tt >= L) break;
    }
    const g = this.g, lim = () => (best ? best.t : L);
    const sh = g.structs.raycast(P, D, lim());
    if (sh && sh.struct.id !== owner.sid) take(sh.t, { type: 'struct', s: sh.struct, cell: sh.hit });
    const ah = g.animals.raycast(P, D, lim());
    if (ah && !skip?.has(ah.animal)) take(ah.t, { type: 'animal', a: ah.animal });
    const hx = g.hexaliens?.rayHit(P, D, lim());
    if (hx && !skip?.has(hx)) take(g.hexaliens.hitT, { type: 'hexalien', a: hx });
    const ph = g.rayPlayers?.(P, D, lim(), owner.pid);
    if (ph && !skip?.has('p' + ph.pid)) take(ph.t, { type: 'player', pid: ph.pid });
    // (une tourelle d'une autre équipe que le joueur : elle peut le toucher, même en solo)
    if (owner.turret) { const t = g.rayLocal?.(P, D, lim(), owner.team); if (t != null && !skip?.has('local')) take(t, { type: 'local' }); }
    return best;
  }

  // Dégâts à ce qui est touché (hôte / solo)
  hurt(h, dmg, at, owner) {
    if (h.type === 'animal') { this.g.hurtAnimal(h.a, dmg, at, owner.pid); this.g.fx.hit(at.x, at.y, at.z); }
    else if (h.type === 'hexalien') this.g.hexaliens.hit(h.a);
    else if (h.type === 'player') this.g.hurtPlayer(h.pid, dmg, owner.pid);
    else if (h.type === 'local') this.g.hurtLocal?.(dmg);
  }
  sparks(P, col = '#ffd27a', n = 6) {
    for (let i = 0; i < n; i++) this.g.fx.glow.spawn(P.clone(), V(rr(-3, 3), rr(0, 3), rr(-3, 3)), rr(0.1, 0.25), col, rr(0.05, 0.1), 0, 3);
  }

  // Le projectile p touche h (au point P) : renvoie true s'il s'arrête là
  impact(p, h, P, D) {
    const S = PROJ[p.kind];
    if (p.ghost) return h.type === 'block' || h.type === 'struct' || !p.pierce;
    if (S.boom) {
      if (p.kind === 'nuke' && !this.g.nukesOn()) { this.sparks(P, '#ffd34d', 12); return true; }
      this.g.explode(P.x, P.y - 0.5, P.z, S.boom);
      return true;
    }
    if (h.type === 'block') {
      const { q, r } = worldToHex(P.x + D.x * 0.05, P.z + D.z * 0.05), y = Math.floor(P.y + D.y * 0.05);
      const id = this.g.world.getBlock(q, r, y);
      if (p.kind === 'flame') { if (isTnt(id)) this.g.tnt.ignite(q, r, y, undefined, this.g.listener); return true; }
      if (p.breaks > 0 && id && !BLOCKS[id]?.unbreakable) { p.breaks--; this.g.breakBlock(q, r, y, id); this.sparks(P, '#c8ecff'); return false; }
      this.sparks(P);
      return true;
    }
    if (h.type === 'struct') {
      const id = h.s.blocks.get(h.cell.q + ',' + h.cell.r + ',' + h.cell.y);
      if (p.breaks > 0 && id && !BLOCKS[id]?.unbreakable && !this.g.structs.noDamage) { p.breaks--; this.g.structs.setBlock(h.s, h.cell.q, h.cell.r, h.cell.y, AIR); this.sparks(P, '#c8ecff'); return false; }
      // (les tirs des tourelles et des armes en blocs abîment l'objet touché ; pas celui de leur équipe)
      if (p.dmg > 0 && (p.owner.turret || p.owner.sid !== null) && !this.sameTeam(h.s, p.owner.team)) this.damageStruct(h.s, h.cell, p.dmg, P);
      this.sparks(P);
      return true;
    }
    this.hurt(h, p.dmg, P, p.owner);
    p.hits.add(h.a || (h.type === 'local' ? 'local' : 'p' + h.pid));
    return p.pierce-- <= 0;
  }

  // ---------- Équipes ----------
  teamOfStruct(s) { return this.teams.get(s.id) ?? null; }
  sameTeam(s, team) { const t = this.teams.get(s.id) ?? null; return !!team && t === team; }
  // L'équipe suivante (aucune, puis Rouge, Bleue, Verte, Jaune)
  nextTeam(t) { const ids = [null, ...TEAMS.map((x) => x.id)]; return ids[(ids.indexOf(t ?? null) + 1) % ids.length]; }
  setStructTeam(s, t) { if (t) this.teams.set(s.id, t); else this.teams.delete(s.id); }
  setWorldTeam(k, t) { const w = this.worldTurrets.get(k); if (w) w.team = t; }
  worldTeam(k) { return this.worldTurrets.get(k)?.team ?? null; }

  // Un bloc d'objet collé touché (dmg) : cassé au bout de BLOCK_HP
  damageStruct(s, cell, dmg, P) {
    const k = cell.q + ',' + cell.r + ',' + cell.y, id = s.blocks.get(k);
    if (!id || BLOCKS[id]?.unbreakable || this.g.structs.noDamage) return; // (/worldrule degatVehicule false)
    const key = s.id + ':' + k, d = (this.blockDmg.get(key) || 0) + dmg;
    if (d < BLOCK_HP) { this.blockDmg.set(key, d); return; }
    this.blockDmg.delete(key);
    this.g.structs.setBlock(s, cell.q, cell.r, cell.y, AIR);
    this.sparks(P, '#ffb060', 10);
    for (let i = 0; i < 5; i++) this.g.fx.puffs.spawn(P.clone(), V(rr(-1, 1), rr(0, 1.5), rr(-1, 1)), rr(0.4, 0.8), '#6a6a6a', rr(0.3, 0.6), 0.6, 2);
  }

  // ---------- Tourelles ----------
  // Toutes les tourelles à faire vivre : [{ key, s (objet ou null), q, r, y, kind, team, P (sa tête), up }]
  turretList() {
    const out = [], me = this.g.ear();
    for (const s of this.g.structs.list) {
      if (s.unloaded) continue;
      const c = this.ship(s);
      if (!c.turrets.length) continue;
      const team = this.teams.get(s.id) ?? null, up = new THREE.Vector3(0, 1, 0).applyQuaternion(s.quat);
      for (const [q, r, y, kind, k] of c.turrets) {
        const P = this.cellPos(s, q, r, y, new THREE.Vector3()).addScaledVector(up, 0.5);
        out.push({ key: 'S' + s.id + ':' + k, s, c, q, r, y, k, kind, team, P, up });
      }
    }
    for (const [k, w] of this.worldTurrets) {
      const [q, r, y] = k.split(',').map(Number), c = hexToWorld(q, r);
      if (Math.hypot(c.x - me.x, c.z - me.z) > WORLD_TURRET_R) continue;
      if (BLOCKS[this.g.world.getBlock(q, r, y)]?.turret !== w.kind) continue; // (pas encore chargée)
      out.push({ key: 'W' + k, s: null, q, r, y, k, kind: w.kind, team: w.team, P: new THREE.Vector3(c.x, y + 1, c.z), up: UP });
    }
    return out;
  }
  // Les cibles d'une équipe : objets collés et joueurs des autres équipes
  // ---------- Stratégies des voitures (pilote de route) ----------
  // chase : fonce sur l'ennemi le plus proche (300 blocs) et tourne à ~22 blocs de lui ;
  // flee : s'éloigne de tout ennemi à moins de 90 blocs ; guard : défend la première étape de son
  // parcours (un ennemi à moins de 70 blocs d'elle : il le chasse, puis il y revient).
  // Sans ennemi : le parcours normal. Vrai : la stratégie conduit (la cible du pilote est réglée).
  carTactic(s, dt) {
    const tac = this.tactics.get(s.id), team = this.teams.get(s.id), P = s.pilot, a = s.auto;
    if (!tac || !team || !P || !a) return false;
    a.tacT = (a.tacT || 0) - dt;
    if (a.tacT > 0) return !!a.tacOn;
    a.tacT = 0.4;
    const home = P.route[0], ref = tac === 'guard' ? home : s.pos;
    let foe = null, fd = Infinity;
    for (const e of this.enemies(team, s.id)) {
      if (Math.abs(e.pos.y - s.pos.y) > 60) continue;
      const d = Math.hypot(e.pos.x - ref.x, e.pos.z - ref.z);
      if (d < fd) { fd = d; foe = e; }
    }
    if (!foe || fd > TACTIC_R[tac]) {
      if (a.tacOn) { const w = P.route[Math.min(a.leg, P.route.length - 1)]; P.target.set(w.x, w.y, w.z); }
      a.tacOn = false;
      return false;
    }
    a.tacOn = true; a.end = false; a.waitT = 0;
    if (s.sleeping) this.g.structs.wake(s);
    const dx = s.pos.x - foe.pos.x, dz = s.pos.z - foe.pos.z, d = Math.hypot(dx, dz) || 1;
    if (tac === 'flee') P.target.set(s.pos.x + (dx / d) * 45, s.pos.y, s.pos.z + (dz / d) * 45);
    else P.target.set(foe.pos.x + (dx / d) * CAR_STAND, foe.pos.y, foe.pos.z + (dz / d) * CAR_STAND);
    return true;
  }
  setTactic(s, t) { if (TACTIC_R[t]) this.tactics.set(s.id, t); else this.tactics.delete(s.id); if (s.auto) s.auto.tacT = 0; }

  enemies(team, selfId) {
    const out = [];
    for (const s of this.g.structs.list) {
      if (s.unloaded || s.id === selfId || !s.list.length) continue;
      const t = this.teams.get(s.id);
      if (t && t !== team) out.push({ s, pos: s.pos, vel: s.vel, R: s.radius || 2 });
    }
    for (const p of this.g.teamPlayers?.() || []) if (p.team && p.team !== team) out.push({ p, pos: p.pos, vel: p.vel || null, R: 0.6, aimUp: 1 });
    return out;
  }
  // La cible la plus proche, à portée et en vue
  pickTarget(T, M) {
    let best = null, bd = M.range;
    const own = { pid: 0, sid: T.s?.id ?? null, turret: true, team: T.team };
    for (const e of this.enemies(T.team, T.s?.id)) {
      const at = _a.copy(e.pos); if (e.aimUp) at.y += e.aimUp;
      const d = at.distanceTo(T.P);
      if (d > bd || d < 1.5) continue;
      const dir = _b.copy(at).sub(T.P).divideScalar(d);
      const h = this.trace(T.P.clone().addScaledVector(dir, 0.6), dir, d, own);
      // (en vue : rien avant elle, ou c'est elle qu'on touche en premier)
      if (h && h.t < d - e.R - 0.8 && !(h.type === 'struct' && h.s === e.s) && !(h.type === 'local' && e.p?.local)) continue;
      best = e; bd = d;
    }
    return best;
  }
  // Une munition pour une tourelle du monde : dans un coffre (ou une chambre de chargement) qui la touche
  worldAmmo(T, list, take) {
    for (const [dq, dr, dy] of AROUND) {
      const box = this.g.containers.at(T.q + dq, T.r + dr, T.y + dy);
      const slots = box?.slots;
      if (!slots) continue;
      for (const id of list) {
        const i = slots.findIndex((x) => x?.id === id && x.n > 0);
        if (i < 0) continue;
        if (take && --slots[i].n <= 0) slots[i] = null;
        return id;
      }
    }
    return 0;
  }
  // Un tir de tourelle (hôte / solo), dans la direction dir
  turretFire(T, M, st, dir, free) {
    const now = this.clock, ck = 'T' + T.key;
    if ((this.cool.get(ck) || 0) > now) return;
    if (M.laser) {
      if (!free) {
        if (T.s) { if ((this.charge.get(T.s.id) || 0) < M.charge) return; this.charge.set(T.s.id, (this.charge.get(T.s.id) || 0) - M.charge); }
        else if (!this.g.circuits.powered(T.q, T.r, T.y)) return;
      }
      this.cool.set(ck, now + M.rate);
      const from = T.P.clone().addScaledVector(dir, 0.7), own = { pid: 0, sid: T.s?.id ?? null, turret: true, team: T.team };
      const h = this.trace(from, dir, M.range, own);
      const end = from.clone().addScaledVector(dir, h ? h.t : M.range);
      if (h?.type === 'struct') { if (!this.sameTeam(h.s, T.team)) this.damageStruct(h.s, h.cell, M.dmg, end); this.sparks(end, '#ff8a6a'); }
      else if (h && h.type !== 'block') this.hurt(h, M.dmg, end, own);
      else if (h) this.sparks(end, '#ff8a6a');
      this.beam(from, end, 0xff4a3a, 0.18);
      playShot('energy', this.g.ear().distanceTo(from));
      this.g.onFire?.('laser', from, dir, end);
      return;
    }
    let ammo = T.s ? this.takeAmmo(T.s, T.c, M.ammo, !free) : this.worldAmmo(T, M.ammo, !free);
    if (!ammo && free) ammo = M.ammo[M.ammo.length - 1];
    if (!ammo) { st.empty = true; return; }
    st.empty = false;
    this.cool.set(ck, now + M.rate);
    const d = dir.clone();
    if (M.spread) d.add(V(rr(-1, 1), rr(-1, 1), rr(-1, 1)).multiplyScalar(M.spread)).normalize();
    const P = T.P.clone().addScaledVector(d, 0.9), du = ammo === DU_BULLET;
    this.muzzle(M.proj, P, d);
    const tgt = st.target ? (st.target.s ? { s: st.target.s } : { rp: st.target.p }) : null;
    this.spawn(M.proj, P, d, { pid: 0, sid: T.s?.id ?? null, team: T.team, turret: true, vel: T.s?.vel, dmg: (M.dmg || 0) * (du ? 1.8 : 1), pierce: du ? 2 : 0, target: tgt });
    this.g.onFire?.(M.proj, P, d, null);
  }
  // La tête d'une tourelle (dessinée à part : elle tourne vers sa cible)
  headOf(T, st) {
    if (st.head && st.headTeam === T.team && st.headKind === T.kind) return st.head;
    if (st.head) this.g.scene.remove(st.head);
    const g = new THREE.Group(), col = teamOf(T.team)?.color || '#8a9098';
    g.add(new THREE.Mesh(this.headGeo.dome, new THREE.MeshLambertMaterial({ color: col })));
    if (T.kind === 'gun') { g.add(new THREE.Mesh(this.headGeo.gun, this.headMat.dark)); const b = new THREE.Mesh(this.headGeo.gun, this.headMat.dark); b.position.x = 0.13; g.add(b); g.children[1].position.x = -0.13; }
    else if (T.kind === 'missile') g.add(new THREE.Mesh(this.headGeo.twin, this.headMat.dark));
    else { g.add(new THREE.Mesh(this.headGeo.lens, this.headMat.dark)); const l = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), this.headMat.red); l.position.set(0, 0.16, 0.6); g.add(l); }
    this.g.scene.add(g);
    st.head = g; st.headTeam = T.team; st.headKind = T.kind;
    return g;
  }
  dropHead(key) {
    const st = this.tur.get(key);
    if (st?.head) { this.g.scene.remove(st.head); st.head.children[0].material.dispose(); }
    this.tur.delete(key);
  }
  updateTurrets(dt, host) {
    const seen = new Set(), free = this.g.freeAmmo?.() || false;
    for (const T of this.turretList()) {
      seen.add(T.key);
      const M = TURRETS[T.kind];
      let st = this.tur.get(T.key);
      if (!st) { st = { dir: new THREE.Vector3(0, 0, 1), retarget: Math.random() * RETARGET, target: null, idle: Math.random() * 6 }; this.tur.set(T.key, st); }
      let want = null;
      if (host && T.team) {
        // (la cible : revue deux fois par seconde ; perdue dès qu'elle sort de portée)
        if ((st.retarget -= dt) <= 0) { st.retarget = RETARGET; st.target = this.pickTarget(T, M); }
        const e = st.target;
        if (e && (e.s ? this.g.structs.list.includes(e.s) && !e.s.unloaded : true)) {
          const at = _h.copy(e.pos); if (e.aimUp) at.y += e.aimUp;
          const d = at.distanceTo(T.P);
          if (d > M.range * 1.1) st.target = null;
          else {
            // (on vise là où elle sera quand le tir arrivera)
            if (e.vel && Number.isFinite(M.speed)) at.addScaledVector(e.vel, Math.min(3, d / M.speed));
            want = at.sub(T.P).normalize();
          }
        } else st.target = null;
      }
      if (!want) {
        // (sans cible : la tête balaie lentement l'horizon)
        st.idle += dt * 0.4;
        want = _h.set(Math.sin(st.idle), 0.05, Math.cos(st.idle));
        if (T.s) want.applyQuaternion(T.s.quat);
        want.normalize();
      }
      // la tête tourne vers want, à TURN rad/s
      const ang = st.dir.angleTo(want);
      if (ang > 1e-4) {
        const k = Math.min(1, (TURN * dt) / ang);
        st.dir.lerp(want, k).normalize();
      }
      if (host && st.target && st.dir.angleTo(want) < AIM_OK) this.turretFire(T, M, st, st.dir, free);
      const g = this.headOf(T, st);
      g.position.copy(T.P);
      g.quaternion.setFromUnitVectors(Z, st.dir);
    }
    for (const k of [...this.tur.keys()]) if (!seen.has(k)) this.dropHead(k);
  }

  // ---------- Boucliers ----------
  // Le projectile p (direction D, sur L blocs) entre-t-il dans un bouclier ? (il y est arrêté)
  shieldCatch(p, D, L) {
    const S = PROJ[p.kind];
    for (const s of this.g.structs.list) {
      if (s.id === p.owner.sid || s.unloaded) continue;
      const c = this.ship(s);
      const heat = S.heat && c.thermal;
      if (!c.emit && !heat) continue;
      const R = (s.radius || 2) + 1.5;
      if (p.P.distanceToSquared(s.pos) < R * R) continue; // (tiré du dedans)
      const t = raySphere(p.P, D, s.pos, R);
      if (t === null || t > L) continue;
      if (!heat) {
        // (pas assez de charge pour l'arrêter : le tir passe)
        const ch = this.charge.get(s.id) || 0;
        const cost = (S.boom ? Math.min(1000, S.boom.power * 6) : p.dmg || 4) / c.emit;
        if (ch < cost) continue;
        this.charge.set(s.id, ch - cost);
      }
      this.flashBubble(s.pos, R, heat ? 0xff8a2a : 0x5ff0ff, p.P.clone().addScaledVector(D, t));
      return true;
    }
    for (const [C, k] of this.worldOn('emitter')) {
      const R = WORLD_SHIELD.emitter;
      if (p.P.distanceToSquared(C) < R * R) continue;
      const t = raySphere(p.P, D, C, R);
      if (t === null || t > L) continue;
      const hp = this.worldHp.get(k) ?? WORLD_HP, cost = S.boom ? Math.min(1000, S.boom.power * 6) : p.dmg || 4;
      if (hp < cost) continue;
      this.worldHp.set(k, hp - cost);
      this.flashBubble(C, R, 0x5ff0ff, p.P.clone().addScaledVector(D, t));
      return true;
    }
    return false;
  }
  // Une explosion en (x, y, z) est-elle sous un bouclier stellaire ? (rien n'y est cassé)
  protects(x, y, z) {
    const P = _h.set(x, y, z);
    for (const s of this.g.structs.list) if (!s.unloaded && this.ship(s).stellar && s.pos.distanceTo(P) < (s.radius || 2) + 8) return true;
    for (const [C] of this.worldOn('stellar')) if (C.distanceTo(P) < WORLD_SHIELD.stellar) return true;
    return false;
  }
  // Déflecteurs : ils abattent les tirs explosifs qui approchent (un par seconde chacun)
  deflect() {
    const now = this.clock;
    const shots = this.list.filter((p) => !p.ghost && EXPLOSIVE(p.kind));
    if (!shots.length) return;
    const tryShoot = (C, key, sid) => {
      if ((this.defCool.get(key) || 0) > now) return;
      for (const p of shots) {
        if (p.dead || p.owner.sid === sid || p.P.distanceTo(C) > WORLD_SHIELD.deflector) continue;
        p.dead = true;
        this.defCool.set(key, now + DEFLECT_COOL);
        this.beam(C.clone(), p.P.clone(), 0xff5a5a, 0.2);
        this.sparks(p.P, '#ff8a6a', 10);
        for (let i = 0; i < 6; i++) this.g.fx.puffs.spawn(p.P.clone(), V(rr(-1, 1), rr(0, 1), rr(-1, 1)), rr(0.5, 0.9), '#bdbdbd', rr(0.3, 0.5), 0.6, 2);
        return;
      }
    };
    for (const s of this.g.structs.list) {
      if (s.unloaded) continue;
      const c = this.ship(s);
      if (!c.defl.length || (this.charge.get(s.id) || 0) < 5) continue;
      for (const [q, r, y, k] of c.defl) {
        const before = this.defCool.get('S' + s.id + ':' + k) || 0;
        tryShoot(this.cellPos(s, q, r, y, new THREE.Vector3()), 'S' + s.id + ':' + k, s.id);
        if ((this.defCool.get('S' + s.id + ':' + k) || 0) !== before) this.charge.set(s.id, (this.charge.get(s.id) || 0) - 5);
      }
    }
    for (const [C, k] of this.worldOn('deflector')) tryShoot(C.clone(), k, null);
  }

  // ---------- Effets ----------
  beam(A, B, color, life) {
    const geo = new THREE.BufferGeometry().setFromPoints([A, B]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 1 }));
    this.g.scene.add(line);
    this.beams.push({ line, t: life, life });
  }
  flashBubble(C, R, color, at) {
    const m = new THREE.Mesh(this.bubbleGeo, this.bubbleMat(color));
    m.position.copy(C); m.scale.setScalar(R);
    this.g.scene.add(m);
    this.bubbles.push({ m, t: 0.6 });
    if (at) this.sparks(at, color === 0x5ff0ff ? '#9ff6ff' : '#ffb060', 8);
  }
  // Bouclier thermique : à grande vitesse, une coupole orange devant l'objet
  thermalCaps() {
    const seen = new Set();
    for (const s of this.g.structs.list) {
      if (s.unloaded || !this.ship(s).thermal) continue;
      const v = s.vel.length();
      if (v < 30) continue;
      seen.add(s.id);
      let m = this.heat.get(s.id);
      if (!m) { m = new THREE.Mesh(this.capGeo, this.bubbleMat(0xff8a2a)); this.g.scene.add(m); this.heat.set(s.id, m); }
      m.position.copy(s.pos);
      m.scale.setScalar((s.radius || 2) + 1.2);
      m.quaternion.setFromUnitVectors(UP, _d.copy(s.vel).normalize());
      m.material.opacity = Math.min(0.85, (v - 30) / 60 + 0.25);
    }
    for (const [id, m] of this.heat) if (!seen.has(id)) { this.g.scene.remove(m); m.material.dispose(); this.heat.delete(id); }
  }

  // ---------- Chaque image ----------
  update(dt) {
    this.clock += dt;
    const host = !this.g.remote();
    if (host) {
      // accumulateurs : ils se rechargent ; émetteurs posés : leur réserve revient
      for (const s of this.g.structs.list) {
        const c = this.ship(s);
        if (!c.accus) { this.charge.delete(s.id); continue; }
        this.charge.set(s.id, Math.min(c.accus * ACCU_MAX, (this.charge.get(s.id) ?? c.accus * ACCU_MAX) + c.accus * ACCU_RATE * dt));
      }
      for (const [k, hp] of this.worldHp) { if (hp + WORLD_REGEN * dt >= WORLD_HP) this.worldHp.delete(k); else this.worldHp.set(k, hp + WORLD_REGEN * dt); }
      this.deflect();
    }
    this.updateTurrets(dt, host);
    const bottom = -DEPTH - 30, fx = this.g.fx;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i], S = PROJ[p.kind];
      p.age += dt;
      if (S.torpedo) {
        // (dans l'eau, elle file à l'horizontale, à sa profondeur)
        if (this.waterAt(p.P) && Math.hypot(p.v.x, p.v.z) > 0.5) { p.v.y = 0; p.v.setLength(S.speed); }
        else p.v.y -= 20 * dt;
      } else p.v.y -= S.g * dt;
      if (S.accel) { const sp = p.v.length(); if (sp < S.max) p.v.multiplyScalar(Math.min(S.max, sp + S.accel * dt) / sp); }
      if (p.target && p.age > 0.25) {
        const T = this.targetPos(p.target, _h);
        if (T) {
          const want = T.sub(p.P).normalize(), sp = p.v.length(), cur = _d.copy(p.v).normalize();
          cur.lerp(want, Math.min(1, 3 * dt)).normalize();
          p.v.copy(cur).multiplyScalar(sp);
        }
      }
      const L = p.v.length() * dt;
      const D = _d.copy(p.v).normalize();
      let done = !!p.dead;
      if (!done && !p.ghost && this.shieldCatch(p, D, L)) done = true;
      if (!done) {
        const h = this.trace(p.P, D, L, p.owner, p.hits);
        if (h) {
          const at = _h.copy(p.P).addScaledVector(D, h.t);
          if (this.impact(p, h, at, D)) done = true;
          else p.P.copy(at).addScaledVector(D, 0.05);
        } else p.P.addScaledVector(D, L);
      }
      // traînées
      if (!done) {
        if (p.kind === 'flame') fx.glow.spawn(p.P.clone(), V(rr(-0.6, 0.6), rr(0, 1), rr(-0.6, 0.6)), rr(0.12, 0.25), Math.random() < 0.5 ? '#ff8a2a' : '#ffd34d', rr(0.18, 0.35) * (0.5 + p.age * 2), 0.8, 1);
        else if (p.kind === 'energy') fx.glow.spawn(p.P.clone(), V(0, 0, 0), 0.15, '#7ff6ff', 0.14, -0.5, 0);
        else if (S.boom && p.kind !== 'shell' && Math.random() < 0.8) fx.puffs.spawn(p.P.clone(), V(rr(-0.3, 0.3), rr(0, 0.5), rr(-0.3, 0.3)), rr(0.6, 1.2), this.waterAt(p.P) ? '#e8f4ff' : '#cfcfcf', rr(0.2, 0.35), 0.8, 1.5);
      }
      if (p.mesh) { p.mesh.position.copy(p.P); p.mesh.quaternion.setFromUnitVectors(Z, D); }
      if (!done && (p.age > p.life || p.P.y < bottom)) {
        done = true;
        // (une roquette, un missile en bout de course explosent en l'air)
        if (!p.ghost && (p.kind === 'rocket' || p.kind === 'missile') && p.P.y > bottom) this.g.explode(p.P.x, p.P.y - 0.5, p.P.z, S.boom);
      }
      if (done) { if (p.mesh) this.g.scene.remove(p.mesh); this.list.splice(i, 1); }
    }
    for (let i = this.beams.length - 1; i >= 0; i--) {
      const b = this.beams[i];
      b.t -= dt;
      b.line.material.opacity = Math.max(0, b.t / b.life);
      if (b.t <= 0) { this.g.scene.remove(b.line); b.line.geometry.dispose(); b.line.material.dispose(); this.beams.splice(i, 1); }
    }
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i];
      b.t -= dt;
      b.m.material.opacity = Math.max(0, b.t / 0.6) * 0.6;
      if (b.t <= 0) { this.g.scene.remove(b.m); b.m.material.dispose(); this.bubbles.splice(i, 1); }
    }
    this.thermalCaps();
  }

  // Charge des accumulateurs de l'objet (pour l'affichage), et son maximum
  chargeOf(s) { const c = this.ship(s); return [Math.round(this.charge.get(s.id) ?? c.accus * ACCU_MAX), c.accus * ACCU_MAX]; }

  // ---------- Sauvegarde ----------
  serialize() {
    return {
      ws: [...this.worldShields], ch: [...this.charge].map(([id, v]) => [id, Math.round(v)]),
      tm: [...this.teams], tc: [...this.tactics], wt: [...this.worldTurrets].map(([k, w]) => [k, w.kind, w.team]),
    };
  }
  load(d) {
    this.clear();
    const ok = (e) => Array.isArray(e) && e.length === 2;
    this.worldShields = new Map((Array.isArray(d?.ws) ? d.ws : []).filter((e) => ok(e) && typeof e[0] === 'string' && WORLD_SHIELD[e[1]]));
    this.charge = new Map((Array.isArray(d?.ch) ? d.ch : []).filter((e) => ok(e) && Number.isInteger(e[0]) && Number.isFinite(e[1])));
    this.teams = new Map((Array.isArray(d?.tm) ? d.tm : []).filter((e) => ok(e) && Number.isInteger(e[0]) && teamOf(e[1])));
    this.tactics = new Map((Array.isArray(d?.tc) ? d.tc : []).filter((e) => ok(e) && Number.isInteger(e[0]) && TACTIC_R[e[1]]));
    for (const e of Array.isArray(d?.wt) ? d.wt : []) if (Array.isArray(e) && typeof e[0] === 'string' && TURRETS[e[1]]) this.worldTurrets.set(e[0], { kind: e[1], team: teamOf(e[2]) ? e[2] : null });
  }
  // Vide tout (changement de monde)
  clear() {
    for (const p of this.list) if (p.mesh) this.g.scene.remove(p.mesh);
    for (const b of this.beams) this.g.scene.remove(b.line);
    for (const b of this.bubbles) this.g.scene.remove(b.m);
    for (const m of this.heat.values()) this.g.scene.remove(m);
    for (const k of [...this.tur.keys()]) this.dropHead(k);
    this.teams.clear(); this.tactics.clear(); this.worldTurrets.clear(); this.blockDmg.clear();
    this.list = []; this.beams = []; this.bubbles = []; this.heat.clear();
    this.cool.clear(); this.charge.clear(); this.worldShields.clear(); this.worldHp.clear(); this.defCool.clear();
  }
}
