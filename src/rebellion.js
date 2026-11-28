// La rébellion des villageois (et, en créatif, leur croisade).
//
// Un village assez avancé (au moins 4 adultes, et une plateforme, un mur ou 6 maisons) qui en veut
// au joueur — l'avis moyen de ses adultes (voir villagetalk.js) très bas pendant une heure de jeu —
// complote : les villageois murmurent, refusent de commercer, et bâtissent en secret une fusée près
// du village. Puis, de nuit (ou quand le joueur est loin), tout le village y monte et quitte Hexa.
// En créatif, le joueur est un dieu : sa présence, ses vols, ses « miracles » (blocs posés dans le
// village) font monter la ferveur ; au bout du compte, ils partent aussi, mais pour une croisade :
// conquérir le royaume du dieu.
//
// La faction se cache sur une planète d'un autre système solaire (Pélagia, Vesper, PXT...). Elle
// se développe (simulée, même loin de tout joueur) : population, technologie, puis le chargeur de
// chunks (ses colonies vivent même sans personne), d'autres colonies sur d'autres astres, un
// chantier naval (chasseurs, vaisseaux habitats, cargos, croiseurs). Des transmissions
// interceptées tiennent le joueur au courant ; le puits du village abandonné lui dit où ils sont
// partis (un repère). Une colonie visitée apparaît pour de vrai : maisons d'acier, chargeur de
// chunks au centre (le casser : la colonie tombe), tourelles, gardes rebelles, un chasseur posé.
//
// Quelques heures de jeu après l'exode, la flotte attaque Hexa (là où est le joueur) :
//  - chasseur : petit et rapide, il tourne autour du joueur et tire ; dans l'espace, il le chasse
//    en saut (plus nerveux que tout autre vaisseau : s.boost) ;
//  - vaisseau habitat : chambres (lits), nourriture (coffres de pain), oxygène, des villageois à
//    bord ; il se pose près du joueur et débarque ses soldats ;
//  - cargo : il porte trois chasseurs sur son pont et les largue ;
//  - croiseur : énorme, deux hangars de trois chasseurs (ils en partent et y reviennent s'amarrer
//    pour se réparer), deux vaisseaux habitats amarrés sur ses flancs, des tourelles partout, un
//    bouclier. Le détruire (son poste de pilotage, ses réacteurs, ou une bonne part de sa coque)
//    met fin à la vague.
// Si le joueur s'enfuit en vaisseau, les chasseurs le poursuivent (voir orbital.js, chase).
// Fin : chaque vague repoussée coûte cher aux rebelles ; plus de colonie (chargeurs de chunks
// détruits) : la rébellion est écrasée. Trois vagues repoussées : ils demandent une trêve.
//
// Tout se décide chez l'hôte (ou en solo). Une heure de jeu = 75 s (un jour : 1 800 s), comptées
// même si l'heure est figée (/time).
import * as THREE from 'three';
import { hexToWorld, worldToHex } from './hex.js?v=1.1.0-mx09tneh';
import {
  BLOCKS, SOLID, CHUNK_LOADER, IRON_INGOT, VOLTITE, isChest, REBEL_TEAM, ALLY_TEAM, CHEST, BREAD, BULLET, MISSILE_AMMO, NEDROLYTIUM, POD, POD_TOP, makeSlot,
  TURRET_GUN, TURRET_MISSILE, TURRET_LASER, SHIELD_EMITTER, ACCUMULATOR, REACTOR, NOZZLE, ROCKET_TANK, COCKPIT,
  FLIGHT_COMPUTER, LANDING_LEG, OXYGEN_GEN,
} from './blocks.js?v=1.1.0-mx09tneh';
import { BODY, LANDABLE, spanOf } from './system.js?v=1.1.0-mx09tneh';
import { bodyZone, zoneOfXZ, zoneBody, ZONE } from './spacegen.js?v=1.1.0-mx09tneh';
import { SPACE_Y } from './rocket.js?v=1.1.0-mx09tneh';

export const TEAM = REBEL_TEAM.id;
const ALLY = ALLY_TEAM.id;         // les Pionniers : un village qui nous aime part coloniser, en ami
const LOVE = 40;                   // avis moyen au-dessus duquel un village rêve d'étoiles...
const LOVE_H = 2;                  // ... pendant 2 heures de jeu : il envoie des pionniers (une fois)
const HOUR_S = 75;                 // une heure de jeu (s)
// Une fusée (l'exode, les pionniers) : il faut un vrai village, d'au moins ROCKET_HOMES maisons et
// ROCKET_POP habitants (enfants compris) ; avant, la colère (ou l'adoration) attend
const ROCKET_HOMES = 7, ROCKET_POP = 40;
const WARP_CAP = 2.4e11; // (le saut des vaisseaux villageois : 240 G blocs/s au plus)
const MIN_ADULTS = 4;              // un village plus petit ne se rebelle pas
const HATE = -45;                  // avis moyen sous lequel le village complote
const CALM = -28;                  // ... au-dessus duquel il y renonce
const FERVOR_MAX = 160;            // créatif : ferveur qui déclenche la croisade
const PLOT_H = 1.5;                // heures de complot (la fusée se construit) avant l'exode
const ATTACK_H = 8;                // heures entre l'exode et la première attaque (voir /rebellion delai)
const BUILD_R = 200;               // une colonie apparaît quand le joueur est à moins de 200 blocs
const SHOT_DMG = 2;                // un tir de soldat rebelle : un cœur
const HULL = 246, STEEL = 245, RED = 740, GLASS = 40, DGLASS = 4089, LAMP = 95;
const HIDEOUTS = ['pelagia', 'vesper', 'pxt1', 'pxt2', 'pxt3', 'eldra', 'lunule'];
const OUTPOSTS = ['glacia', 'azura', 'brasia', 'ocra', 'lune', 'pxt2', 'pxt3', 'vesper', 'pelagia', 'eldra'];
const SYL = ['ka', 'ra', 'mo', 'va', 'do', 'ta', 'fe', 'no', 'sha', 'kra', 'lo', 'mi', 'zo', 've', 'dar'];
// Espion : planté dans un village fidèle (technologie SPY_TECH), il émet toutes les SPY_H heures de
// jeu (SPY_BEACON secondes d'étincelles au-dessus de sa tête), monte le village contre le joueur
// (SPY_OP par émission) et renseigne la flotte (un chasseur de plus par émission, SPY_MAX au plus)
// Raids : une faction cachée (technologie RAID_TECH) attaque un village fidèle toutes les RAID_H
// heures de jeu, si un village fidèle est près du joueur sur Hexa (sinon, elle réessaie plus tard)
const RAID_TECH = 40, RAID_H = 3, RAID_R = 220;
const SURRENDER_P = 0.5; // (un soldat rebelle à bout de forces se rend une fois sur deux)
const SPY_TECH = 20, SPY_H = 1.5, SPY_BEACON = 20, SPY_OP = 12, SPY_MAX = 4;
const TRUCE = 32, PEACE = 160, VOLT_V = 3; // (tribut : lingots de fer pour une trêve, pour la paix ; la voltite en vaut 3)
const KIND_NAME = { fighter: 'Chasseur', habitat: 'Vaisseau habitat', cargo: 'Cargo', cruiser: 'Croiseur', exodus: "Fusée de l'exode" };
// seuils de mort (part des blocs restants) ; et les blocs vitaux (au moins un de chaque sorte)
const DIE_AT = { fighter: 0.7, habitat: 0.6, cargo: 0.65, cruiser: 0.82, exodus: 0.5 };
const DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
const UP = new THREE.Vector3(0, 1, 0), ID_Q = new THREE.Quaternion();
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _q = new THREE.Quaternion();

const hd = (q, r) => (Math.abs(q) + Math.abs(r) + Math.abs(q + r)) / 2;
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (l) => l[Math.floor(Math.random() * l.length)];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const hash = (s) => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
function nameOf(seed, n = 3) { let s = '', h = hash(seed); for (let i = 0; i < n; i++) { s += SYL[h % SYL.length]; h = Math.floor(h / SYL.length) + 7 * i + 3; } return cap(s); }
function disk(R) { const out = []; for (let q = -R; q <= R; q++) for (let r = -R; r <= R; r++) if (hd(q, r) <= R) out.push([q, r]); return out; }
const ring = (R) => disk(R).filter(([q, r]) => hd(q, r) === R);

// ---------- Les plans des vaisseaux (grille locale : y = 0 en bas, le nez vers +Y) ----------
function Plan() {
  const m = new Map();
  const P = {
    put(q, r, y, id) { m.set(q + ',' + r + ',' + y, [q, r, y, id]); return P; },
    del(q, r, y) { m.delete(q + ',' + r + ',' + y); return P; },
    has(q, r, y) { return m.has(q + ',' + r + ',' + y); },
    stamp(list, dq, dr, dy) { for (const [q, r, y, id] of list) P.put(q + dq, r + dr, y + dy, id); return P; },
    list() { return [...m.values()]; },
  };
  return P;
}
// Chasseur : 4 tuyères, un réacteur armé, le poste de pilotage dans une bulle de verre noir, une
// tourelle à balles et une tourelle laser
function fighterPlan() {
  const P = Plan();
  for (const [q, r] of [[0, 0], [1, 0], [-1, 1], [0, -1]]) P.put(q, r, 0, NOZZLE);
  for (const d of [1, 3, 5]) { const [q, r] = DIRS[d]; P.put(2 * q, 2 * r, 0, HULL).put(2 * q, 2 * r, 1, HULL).put(2 * q, 2 * r, 2, RED); }
  P.put(0, 0, 1, REACTOR).put(1, -1, 1, NEDROLYTIUM).put(-1, 0, 1, ROCKET_TANK).put(0, 1, 1, ROCKET_TANK);
  for (const d of [0, 2, 4]) P.put(...DIRS[d], 1, HULL);
  P.put(0, 0, 2, COCKPIT);
  DIRS.forEach(([q, r], d) => P.put(q, r, 2, d % 2 ? RED : DGLASS).put(q, r, 3, HULL));
  P.put(0, 0, 3, FLIGHT_COMPUTER).put(0, 0, 4, TURRET_GUN).put(-1, 0, 4, TURRET_LASER);
  return P.list();
}
// Vaisseau habitat : trois ponts (vivres et oxygène ; six chambres ; la passerelle), 8 tuyères
function habitatPlan() {
  const P = Plan();
  DIRS.forEach(([q, r]) => P.put(3 * q, 3 * r, 0, LANDING_LEG));
  for (const [q, r] of [...disk(1), [2, -1]]) P.put(q, r, 0, NOZZLE);
  P.put(0, 0, 1, NEDROLYTIUM).put(1, 0, 1, REACTOR).put(-1, 0, 1, REACTOR);
  for (const [q, r] of disk(1)) if (!P.has(q, r, 1)) P.put(q, r, 1, ROCKET_TANK);
  for (const [q, r] of ring(2)) P.put(q, r, 1, STEEL);
  const R3 = ring(3);
  for (let y = 1; y <= 11; y++) R3.forEach(([q, r], i) => P.put(q, r, y, y === 10 ? RED : (y === 3 || y === 7) && i % 2 === 0 ? GLASS : y === 11 ? DGLASS : HULL));
  for (const y of [5, 9]) for (const [q, r] of disk(2)) P.put(q, r, y, STEEL);
  P.put(0, 0, 2, OXYGEN_GEN).put(0, 0, 4, LAMP).put(0, 0, 8, LAMP);
  for (const d of [0, 2, 4]) P.put(2 * DIRS[d][0], 2 * DIRS[d][1], 2, CHEST);
  DIRS.forEach(([q, r], d) => P.put(2 * q, 2 * r, 6, POD + ((d + 3) % 6)).put(2 * q, 2 * r, 7, POD_TOP + ((d + 3) % 6)));
  P.put(0, 0, 10, COCKPIT).put(1, 0, 10, FLIGHT_COMPUTER);
  for (const [q, r] of disk(3)) P.put(q, r, 12, HULL);
  P.put(0, 0, 13, TURRET_LASER).put(2, -2, 13, TURRET_GUN).put(-2, 2, 13, TURRET_GUN);
  return P.list();
}
// Cargo : un pont de rayon 5, la cabine au milieu, trois chasseurs arrimés autour (voir CARGO_BAYS)
const CARGO_BAYS = [[3, 0, 3], [0, -3, 3], [-3, 3, 3]];
function cargoPlan(full = 3) {
  const P = Plan();
  for (const [q, r] of [...disk(1), [2, -1]]) P.put(q, r, 0, NOZZLE);
  P.put(0, 0, 1, NEDROLYTIUM).put(1, 0, 1, REACTOR).put(-1, 0, 1, REACTOR);
  for (const [q, r] of disk(1)) if (!P.has(q, r, 1)) P.put(q, r, 1, ROCKET_TANK);
  for (const [q, r] of disk(5)) if (hd(q, r) > 1) P.put(q, r, 1, hd(q, r) === 5 ? HULL : STEEL);
  for (const [q, r] of disk(5)) P.put(q, r, 2, hd(q, r) === 5 ? RED : STEEL);
  for (const [q, r] of ring(1)) P.put(q, r, 3, DGLASS).put(q, r, 4, HULL);
  P.put(0, 0, 3, COCKPIT).put(0, 0, 4, FLIGHT_COMPUTER).put(0, 0, 5, TURRET_MISSILE);
  CARGO_BAYS.slice(0, full).forEach(([q, r, y]) => P.stamp(fighterPlan(), q, r, y));
  return P.list();
}
// Croiseur : rayon 6, 24 de haut. Deux hangars (trois chasseurs chacun), la passerelle (bouclier,
// accumulateurs, butin), des tourelles sur le toit et les flancs, deux habitats amarrés
const CRUISER_BAYS = [[3, 0, 2], [0, -3, 2], [-3, 3, 2], [3, -3, 9], [-3, 0, 9], [0, 3, 9]];
const CRUISER_DOCKS = [[10, 0, 6], [-10, 0, 6]];
function cruiserPlan(bays = 6, docks = 2) {
  const P = Plan();
  for (const [q, r] of disk(2)) P.put(q, r, 0, NOZZLE);
  P.put(0, 0, 1, NEDROLYTIUM);
  DIRS.forEach(([q, r], d) => P.put(q, r, 1, d === 2 || d === 5 ? ROCKET_TANK : REACTOR));
  for (const [q, r] of disk(6)) if (hd(q, r) > 1) P.put(q, r, 1, hd(q, r) === 2 ? ROCKET_TANK : hd(q, r) === 6 ? HULL : STEEL);
  const R6 = ring(6);
  // (les portes des hangars : les flancs entre les coins 1-2 et 4-5)
  const door = (q, r, y) => ((y >= 2 && y <= 6) || (y >= 9 && y <= 13)) && ((q > 0 && r < 0 && q + r < 0 && q < 6 && -r < 6) || (q < 0 && r > 0 && q + r > 0 && -q < 6 && r < 6));
  for (let y = 2; y <= 22; y++) R6.forEach(([q, r], i) => { if (!door(q, r, y)) P.put(q, r, y, y === 6 || y === 18 ? RED : y === 20 && i % 2 === 0 ? DGLASS : HULL); });
  for (const y of [8, 15]) for (const [q, r] of disk(5)) P.put(q, r, y, STEEL);
  for (const [q, r] of disk(5)) P.put(q, r, 22, STEEL);
  P.put(0, 0, 16, COCKPIT).put(1, 0, 16, FLIGHT_COMPUTER).put(-1, 0, 16, OXYGEN_GEN).put(0, 0, 17, SHIELD_EMITTER);
  for (const [q, r] of [[0, -1], [-1, 1], [1, -1]]) P.put(q, r, 16, ACCUMULATOR);
  for (const d of [0, 2, 4]) P.put(3 * DIRS[d][0], 3 * DIRS[d][1], 16, CHEST);
  for (const d of [1, 3, 5]) P.put(3 * DIRS[d][0], 3 * DIRS[d][1], 18, LAMP);
  for (const [q, r] of disk(6)) P.put(q, r, 23, hd(q, r) === 6 ? RED : HULL);
  P.put(0, 0, 24, TURRET_LASER).put(3, -3, 24, TURRET_LASER).put(-3, 3, 24, TURRET_LASER).put(3, 0, 24, TURRET_MISSILE).put(-3, 0, 24, TURRET_MISSILE).put(0, 3, 24, TURRET_GUN).put(0, -3, 24, TURRET_GUN);
  for (const d of [1, 2, 4, 5]) P.put(6 * DIRS[d][0], 6 * DIRS[d][1], 12, d % 2 ? TURRET_GUN : TURRET_MISSILE);
  CRUISER_BAYS.slice(0, bays).forEach(([q, r, y]) => P.stamp(fighterPlan(), q, r, y));
  CRUISER_DOCKS.slice(0, docks).forEach(([q, r, y]) => P.stamp(habitatPlan(), q, r, y));
  return P.list();
}
// Fusée de l'exode : 12 de haut, rayon 2, des hublots, tout le village à bord
function exodusPlan() {
  const P = Plan();
  DIRS.forEach(([q, r]) => P.put(2 * q, 2 * r, 0, LANDING_LEG));
  for (const [q, r] of [[0, 0], [1, 0], [-1, 1], [0, -1]]) P.put(q, r, 0, NOZZLE);
  P.put(0, 0, 1, REACTOR).put(1, -1, 1, NEDROLYTIUM).put(-1, 0, 1, ROCKET_TANK).put(0, 1, 1, ROCKET_TANK);
  for (const d of [0, 2, 4]) P.put(...DIRS[d], 1, STEEL);
  const R2 = ring(2);
  for (let y = 1; y <= 9; y++) R2.forEach(([q, r], i) => P.put(q, r, y, y === 8 ? RED : (y === 4 || y === 6) && i % 3 === 0 ? GLASS : HULL));
  P.put(0, 0, 3, FLIGHT_COMPUTER).put(0, 0, 5, COCKPIT);
  for (const [q, r] of disk(2)) P.put(q, r, 10, HULL);
  for (const [q, r] of disk(1)) P.put(q, r, 11, RED);
  P.put(0, 0, 12, HULL);
  return P.list();
}
const PLANS = { fighter: fighterPlan, habitat: habitatPlan, cargo: cargoPlan, cruiser: cruiserPlan, exodus: exodusPlan };
const keyOf = (q, r, y) => q + ',' + r + ',' + y;

export class Rebellion {
  // g : { world, structs, animals, weapons, orbital, flight, rockets, fx, containers, tnt, player, net,
  //       creative(), alive(), pseudo(), toast(m), chat(m, kind), hurt(d, x, z, by), addWaypoint(x, z, n), explode(x, y, z, p) }
  constructor(g) {
    this.g = g;
    this.clear();
    this.hud = null;
  }
  clear() {
    this.on = true;
    this.delay = ATTACK_H;
    this.h = 0;                 // heures de jeu écoulées (notre horloge)
    this.mood = new Map();      // clé du village -> { g (heures de haine), f (ferveur), st (étape annoncée), plot }
    this.factions = [];
    this.ships = new Map();     // id de l'objet -> { kind, f, mode, t, n0, ... }
    this.clock = { mood: 0, sim: 0, check: 0, hud: 0 };
    this.nextId = 1;
    this.showHud(null);
  }
  get colony() { return this.g.animals.colony; }
  get talk() { return this.g.animals.talk; }
  me() { return this.g.pseudo(); }
  isRebel(s) { const sh = s && this.ships.get(s.id); return !!sh && !sh.ally; }
  allyOf(f) { return f?.motive === 'pioneer'; }
  hostile() { return this.factions.some((f) => f.ph === 'attack'); }

  // ---------- Ce que fait le joueur (voir main.js) ----------
  // les villageois qui voient la scène (à moins de R blocs) changent d'avis
  witnessed(x, z, R, d) {
    const name = this.me();
    for (const a of this.g.animals.list) if (!a.dead && a.vk && Math.hypot(a.pos.x - x, a.pos.z - z) < R) this.talk.change(a, name, d);
  }
  villageAt(x, z, pad = 6) {
    for (const V of this.colony.villages.values()) {
      if (V.rebel) continue;
      if (Math.hypot(V.x - x, V.z - z) < (V.wallR ? V.wallR * 0.866 : 34) + pad) return V;
    }
    return null;
  }
  onPlayerBreak(q, r, y) {
    if (!this.on || this.g.creative()) return;
    const c = hexToWorld(q, r), V = this.villageAt(c.x, c.z);
    if (V) this.witnessed(c.x, c.z, 20, -4);
  }
  onPlayerPlace(q, r, y) {
    if (!this.on || !this.g.creative()) return;
    const c = hexToWorld(q, r), V = this.villageAt(c.x, c.z);
    if (!V) return;
    const m = this.moodOf(V);
    if ((m.miracle = (m.miracle || 0) + 1) % 4 === 0) m.f += 2; // (un « miracle » : un bloc qui apparaît du ciel)
  }
  onChest(q, r, y) {
    if (!this.on || this.g.creative()) return;
    const c = hexToWorld(q, r), V = this.villageAt(c.x, c.z, 0);
    if (V) this.witnessed(c.x, c.z, 16, -6);
  }
  onBlast(x, z, R) {
    if (!this.on) return;
    const V = this.villageAt(x, z, R + 20);
    if (!V) return;
    if (this.g.creative()) { this.moodOf(V).f += 6; return; } // (la colère du dieu : on le craint, on l'adore)
    this.witnessed(x, z, 48, -15);
  }
  // Un villageois qui complote refuse de commercer
  refuses(a) {
    const f = a?.vk && this.factions.find((x) => x.vk === a.vk && x.ph === 'plot');
    return !!(f && !this.allyOf(f) && !this.g.creative()); // (les pionniers, eux, commercent)
  }
  // Le chargeur de chunks d'une colonie cassé (par n'importe quoi)
  onWorldSet(q, r, y, id, old) {
    if (old !== CHUNK_LOADER || id === CHUNK_LOADER) return;
    for (const f of this.factions) for (const C of f.colonies) {
      if (!C.alive || !C.loader || C.loader[0] !== q || C.loader[1] !== r || C.loader[2] !== y) continue;
      this.colonyFalls(f, C);
    }
  }

  // ---------- Pour les tourelles et le pilote automatique (voir weapons.js, orbital.js) ----------
  prey(sid = null) {
    const { player } = this.g;
    if (sid != null && this.ships.get(sid)?.mode === 'retreat') return []; // (en retraite : on ne tire plus)
    const out = this.g.alive() ? [{ local: true, pos: player.pos, vel: player.vel }] : [];
    for (const p of this.g.net.proxies?.() || []) out.push({ pid: p.pid, pos: p.pos, vel: p.vel }); // (les invités aussi)
    return out;
  }
  // les vaisseaux où sont les joueurs (que les chasseurs rebelles poursuivent)
  playerShips() {
    const { player, structs, flight } = this.g, out = [];
    if (player.pilot?.s) out.push(player.pilot.s);
    for (const s of structs.list) if (!this.ships.has(s.id) && !out.includes(s) && s.rocket && flight.aboard(player, s)) out.push(s);
    for (const p of this.g.net.proxies?.() || []) if (p.pilot?.s && !out.includes(p.pilot.s)) out.push(p.pilot.s);
    return out;
  }

  // Le radar de l'espace (voir spaceflight.js) : les vaisseaux en vol, rebelles ou pionniers
  radar() {
    const out = [];
    for (const [id, sh] of this.ships) {
      if (sh.ally && sh.mode === 'parked') continue;
      const s = this.g.structs.byId(id);
      if (!s) continue;
      out.push({ s, ally: !!sh.ally, label: (sh.ally ? 'Pionniers · ' : '') + (sh.kind === 'cruiser' && sh.name ? `Croiseur « ${sh.name} »` : KIND_NAME[sh.kind] || 'Vaisseau') });
    }
    return out;
  }

  // ---------- Chaque image ----------
  update(dt) {
    if (!this.on || this.g.net.isClient) return;
    this.h += dt / HOUR_S;
    if ((this.clock.mood -= dt) <= 0) { this.clock.mood = 1; this.moods(1); }
    if ((this.clock.trib = (this.clock.trib || 0) - dt) <= 0) { this.clock.trib = 2; this.tribute(); }
    if ((this.clock.spy = (this.clock.spy || 0) - dt) <= 0) { this.clock.spy = 0.5; this.spies(0.5); this.prisoners(); this.raids(0.5); }
    // (en ligne : le radar des invités, toutes les secondes tant qu'il y a des vaisseaux, puis une fois vide)
    if ((this.clock.rad = (this.clock.rad || 0) - dt) <= 0) {
      this.clock.rad = 1;
      const net = this.g.net;
      if (net.mode === 'host') {
        const l = this.radar().map(({ s, ally, label }) => [s.id, ally ? 1 : 0, label]);
        if (l.length || this.radSent) net.broadcastJoined({ t: 'rrad', l });
        this.radSent = l.length > 0;
      }
    }
    // (/villageois vitesse : les colonies cachées se développent aussi plus vite ; l'heure de l'attaque, elle, ne change pas)
    if ((this.clock.sim -= dt) <= 0) { this.clock.sim = 2; const k = this.g.animals.colony?.speed || 1; for (const f of [...this.factions]) this.simulate(f, 2 / HOUR_S * k); }
    if ((this.clock.check -= dt) <= 0) { this.clock.check = 0.5; this.checkShips(); this.visit(); }
    for (const f of this.factions) if (f.ph === 'plot') this.plotTick(f, dt);
    for (const [id, sh] of this.ships) {
      const s = this.g.structs.byId(id);
      if (!s) { this.ships.delete(id); continue; }
      this.fly(s, sh, dt);
    }
    if ((this.clock.hud -= dt) <= 0) { this.clock.hud = 0.5; this.renderHud(); }
  }

  // ---------- L'humeur des villages ----------
  moodOf(V) { let m = this.mood.get(V.key); if (!m) this.mood.set(V.key, m = { g: 0, f: 0, st: 0, plot: false }); return m; }
  adults(V) { return V.members.filter((a) => a.type === 'villager' && !a.dead); }
  evolved(V) {
    const n = this.adults(V).length;
    return n >= MIN_ADULTS && (!!V.pad || !!V.wallR || V.houses.length >= 6 || n >= 6 || !!V.colony);
  }
  // (de quoi construire une fusée : maisons et habitants)
  rocketNeeds(V) { return { homes: this.colony.homes(V).length, pop: V.members.filter((a) => !a.dead).length }; }
  canRocket(V) { const n = this.rocketNeeds(V); return n.homes >= ROCKET_HOMES && n.pop >= ROCKET_POP; }
  // Le complot (ou la croisade) commence si le village peut bâtir sa fusée ; sinon il attend
  // (un message, une fois) et commence dès qu'il en est capable (voir moods)
  tryPlot(V, motive) {
    const m = this.moodOf(V);
    if (this.canRocket(V)) { m.wait = false; return this.startPlot(V, motive); }
    if (!m.wait) {
      m.wait = true;
      const n = this.rocketNeeds(V);
      this.g.chat(motive === 'conquest'
        ? `${this.vName(V)} rêve de partir conquérir le royaume du Dieu, mais il lui faut une fusée : ${n.homes}/${ROCKET_HOMES} maisons, ${n.pop}/${ROCKET_POP} habitants.`
        : `${this.vName(V)} voudrait fuir Hexa, mais il lui faut une fusée : ${n.homes}/${ROCKET_HOMES} maisons, ${n.pop}/${ROCKET_POP} habitants. Il grandit, et sa colère attend...`, 'sys');
    }
    return null;
  }
  vName(V) { return V.rname ||= nameOf(V.key, 2 + (hash(V.key) % 2)); }
  moods(dt) {
    const { player } = this.g, god = this.g.creative(), name = this.me();
    for (const V of this.colony.villages.values()) {
      if (V.rebel || V.gone) continue;
      const m = this.moodOf(V);
      if (m.plot) continue;
      if (!this.evolved(V)) continue;
      // (prêt à partir mais pas de fusée : dès que le village en est capable, le complot commence)
      if (m.wait && m.st >= 3) { if (this.canRocket(V)) this.tryPlot(V, god ? 'conquest' : 'rebellion'); continue; }
      if (god) {
        const d = Math.hypot(player.pos.x - V.x, player.pos.z - V.z);
        if (d < 48 && zoneOfXZ(player.pos.x, player.pos.z) === zoneOfXZ(V.x, V.z)) m.f += dt * (player.fly ? 1.1 : 0.5);
        else m.f = Math.max(0, m.f - dt * 0.05);
        const st = m.f >= FERVOR_MAX ? 3 : m.f >= FERVOR_MAX * 0.6 ? 2 : m.f >= FERVOR_MAX * 0.25 ? 1 : 0;
        if (st > m.st) {
          m.st = st;
          const n = this.vName(V);
          if (st === 1) this.g.chat(`Les villageois de ${n} lèvent les yeux vers toi, émerveillés.`, 'sys');
          if (st === 2) { this.g.chat(`À ${n}, on s'agenouille sur ton passage : un culte est né. Les prêtres parlent d'un royaume à conquérir...`, 'sys'); this.shout(V, 'worship'); }
          if (st === 3) this.tryPlot(V, 'conquest');
        }
        continue;
      }
      const ad = this.adults(V);
      const avg = ad.reduce((s, a) => s + this.talk.opinion(a, name), 0) / Math.max(1, ad.length);
      if (avg <= HATE) m.g += dt / HOUR_S; else if (avg > CALM) m.g = Math.max(0, m.g - dt / HOUR_S);
      // (aimé longtemps : une fois, le village envoie des pionniers fonder une colonie amie)
      if (avg >= LOVE) m.l = (m.l || 0) + dt / HOUR_S; else m.l = Math.max(0, (m.l || 0) - dt / HOUR_S);
      if (m.l >= LOVE_H && !m.sent && ad.length >= 6 && this.canRocket(V)) { m.sent = true; this.startPlot(V, 'pioneer'); continue; }
      const st = m.g >= 1 ? 3 : avg <= HATE ? 2 : avg <= CALM ? 1 : 0;
      if (st > m.st) {
        m.st = st;
        const n = this.vName(V);
        if (st === 1) this.g.chat(`Les villageois de ${n} murmurent dans ton dos...`, 'sys');
        if (st === 2) { this.g.chat(`${n} gronde : on parle de toi comme d'un tyran. Fais-toi pardonner (cadeaux, commerce) avant qu'il ne soit trop tard.`, 'sys'); this.shout(V, 'tyrant'); }
        if (st === 3) this.tryPlot(V, 'rebellion');
      } else if (st < m.st && st <= 1) m.st = st;
    }
  }
  shout(V, k) { const ad = this.adults(V); for (let i = 0; i < Math.min(3, ad.length); i++) this.talk.later(pick(ad), k, rnd(0.2, 2)); }

  // ---------- Le complot : la fusée se construit en secret ----------
  startPlot(V, motive) {
    const m = this.moodOf(V);
    if (m.plot) return null;
    m.plot = true;
    const n = this.vName(V), leader = nameOf(V.key + 'chef', 2);
    const f = {
      id: this.nextId++, vk: V.key, home: [V.x, V.z], motive, ph: 'plot', t0: this.h, name: ({ conquest: 'Croisade de ', pioneer: 'Pionniers de ' }[motive] || 'Rébellion de ') + n, village: n, leader,
      pop: this.adults(V).length + V.members.filter((a) => a.type === 'villager_child').length, tech: 5, colonies: [], fleet: { fighter: 0, habitat: 0, cargo: 0, cruiser: 0 },
      wave: 0, repelled: 0, next: 0, said: {}, pad: null, built: 0, hide: null, clue: false,
    };
    // la place de la fusée : la plateforme du village, sinon un coin dégagé au bord du village
    const R = (V.wallR ? V.wallR * 0.866 : 24) + 8, a0 = hash(V.key) % 628 / 100;
    for (let i = 0; i < 12 && !f.pad; i++) {
      const ang = a0 + i * 0.52, c = worldToHex(V.x + Math.cos(ang) * R, V.z + Math.sin(ang) * R);
      if (!this.g.world.isLoaded?.(c.q, c.r)) continue;
      const h = this.g.world.surface(c.q, c.r).h;
      if (h > 0) f.pad = [c.q, c.r, h + 1];
    }
    if (V.pad && !f.pad) f.pad = [V.pad.q, V.pad.r, V.pad.y + 1];
    this.factions.push(f);
    this.g.world.changed = true;
    this.shout(V, { conquest: 'crusade', pioneer: 'pioneer' }[motive] || 'revolt');
    this.g.chat(motive === 'conquest'
      ? `Les prêtres de ${n} proclament : « Le Dieu nous a montré le ciel. Nous irons conquérir son royaume ! » Ils construisent quelque chose...`
      : motive === 'pioneer'
        ? `🌟 ${n} rêve des étoiles : grâce à toi, le village prospère, et ses pionniers construisent une fusée pour fonder une colonie. Ils te remercient !`
        : `${n} complote contre toi. Les villageois refusent de commercer, et l'on entend marteler la nuit...`, 'sys');
    return f;
  }
  plotTick(f, dt) {
    const V = this.colony.villages.get(f.vk);
    if (!V) { this.drop(f); return; }
    // (survie : pardonné à temps, le complot tombe à l'eau)
    if (f.motive === 'rebellion' && !this.g.creative() && !f.forced) { // (/rebellion complot : il tient)
      const ad = this.adults(V), name = this.me();
      const avg = ad.reduce((s, a) => s + this.talk.opinion(a, name), 0) / Math.max(1, ad.length);
      if (ad.length && avg > CALM) { this.g.chat(`Les villageois de ${f.village} renoncent à leur projet... pour l'instant.`, 'sys'); this.drop(f, true); return; }
    }
    // la fusée monte, bloc après bloc (seulement si l'endroit est chargé)
    const plan = exodusPlan(), T = (this.h - f.t0) / PLOT_H;
    if (f.pad && this.g.world.isLoaded?.(f.pad[0], f.pad[1])) {
      const want = Math.min(plan.length, Math.floor(plan.length * Math.min(1, T * 1.25)));
      while (f.built < want) {
        const [q, r, y, id] = plan[f.built++];
        const w = this.g.world, at = [f.pad[0] + q, f.pad[1] + r, f.pad[2] + y];
        if (!w.getBlock(...at) || !SOLID[w.getBlock(...at)]) w.setBlock(...at, id);
      }
    }
    if (T < 1) return;
    // l'exode : de nuit, ou le joueur loin (au bout d'une heure de plus : tant pis, ils partent)
    const { player } = this.g, far = Math.hypot(player.pos.x - V.x, player.pos.z - V.z) > 90 || zoneOfXZ(player.pos.x, player.pos.z) !== zoneOfXZ(V.x, V.z);
    const t = this.talk.time(), night = t > 0.52 && t < 0.95;
    if (night || far || T > 1 + 1 / PLOT_H) this.exodus(f, V);
  }
  drop(f, keep = false) {
    this.factions = this.factions.filter((x) => x !== f);
    const m = this.mood.get(f.vk);
    if (m) { m.plot = false; if (keep) { m.g = 0; m.st = 1; m.f = 0; } }
  }

  // ---------- L'exode ----------
  exodus(f, V) {
    const { animals, structs, world } = this.g;
    const ally = this.allyOf(f);
    let people = animals.list.filter((a) => a.vk === V.key && !a.dead && (a.type === 'villager' || a.type === 'villager_child'));
    // (les pionniers : la moitié des adultes seulement, le village reste)
    if (ally) { const ad = people.filter((a) => a.type === 'villager'); people = ad.sort((a, b) => hash(a.id + 'p') - hash(b.id + 'p')).slice(0, Math.max(3, Math.ceil(ad.length / 2))); }
    f.pop = Math.max(ally ? 0 : f.pop, people.length, 3);
    // tout le monde monte à bord (petits nuages là où ils étaient)
    for (const a of people) for (let i = 0; i < 4; i++) this.g.fx.puffs.spawn(a.pos.clone().add(_a.set(0, 1, 0)), _b.set(rnd(-1, 1), rnd(0.5, 2), rnd(-1, 1)), rnd(0.5, 1), '#d8d8d8', rnd(0.3, 0.6), 0.6, 2);
    const gone = new Set(people);
    animals.list = animals.list.filter((a) => !gone.has(a));
    if (ally) { V.members = V.members.filter((a) => !gone.has(a)); const m = this.moodOf(V); m.plot = false; m.sent = true; }
    else V.gone = true;
    // la fusée (posée en blocs pendant le complot) devient un objet et décolle
    if (f.pad && world.isLoaded?.(f.pad[0], f.pad[1])) {
      const plan = exodusPlan();
      for (const [q, r, y] of plan) { const at = [f.pad[0] + q, f.pad[1] + r, f.pad[2] + y]; if (BLOCKS[world.getBlock(...at)] && plan.some((e) => e[3] === world.getBlock(...at))) world.setBlock(...at, 0); }
      const o = hexToWorld(f.pad[0], f.pad[1]);
      const s = structs.create(++structs.nextId, o.x, f.pad[2], o.z, null, plan);
      if (s.rocket?.cap) this.g.rockets.setFuel(s, s.rocket.cap);
      this.g.weapons.setStructTeam(s, ally ? ALLY : TEAM);
      this.ships.set(s.id, { kind: 'exodus', f: f.id, mode: 'launch', t: 0, n0: s.list.length, ...(ally ? { ally: true } : {}) });
      structs.changed(s); // (en ligne : les invités voient la fusée)
      this.g.orbital.hold(s, true);
    }
    // la cachette : un astre d'un autre système
    const ids = HIDEOUTS.filter((id) => BODY[id] && LANDABLE.includes(BODY[id]) && bodyZone(id) > 0);
    const hide = ids.length ? ids[hash(V.key + 'cache') % ids.length] : null;
    f.ph = ally ? 'ally' : 'hidden'; f.t0 = this.h; f.next = this.h + this.delay; f.tech = 8;
    if (hide) this.newColony(f, hide, (ally ? 'Nouvelle-' + f.village : 'Bastion de ' + f.leader), f.pop);
    f.hide = hide;
    world.changed = true;
    const where = hide ? BODY[hide].name : 'un autre système';
    if (ally) {
      // (des amis : ils disent où ils vont, un repère est posé)
      f.clue = true;
      const C = f.colonies[0];
      if (C) this.g.addWaypoint(C.x, C.z, ('Pionniers ' + BODY[C.body].name).slice(0, 24));
      this.g.chat(`🚀 ${people.length} pionniers de ${f.village} s'envolent vers ${where} ! « Viens nous rendre visite, ami : un présent t'attendra. » (repère posé)`, 'sys');
      this.g.toast(`${f.name} : départ pour ${where}`);
      return;
    }
    this.g.chat(f.motive === 'conquest'
      ? `🚀 Les villageois de ${f.village} ont quitté Hexa en fusée, en chantant ton nom. Ils reviendront... pour conquérir ton royaume.`
      : `🚀 Les villageois de ${f.village} ont fui Hexa en fusée ! Ils ont juré de revenir te tuer.`, 'sys');
    this.g.toast(`${f.name} : exode vers ${where}`);
  }
  newColony(f, body, name, pop) {
    const b = BODY[body], k = bodyZone(body), span = spanOf(b), base = k * ZONE + (b.locked ? span / 4 : 0);
    const h = hash(f.id + body + f.colonies.length);
    const C = { body, name, x: Math.round(base + 600 + (h % 2400)), z: Math.round(((h >> 12) % 2400) - 1200), pop, alive: true, built: false, loader: null, vk: null };
    f.colonies.push(C);
    return C;
  }

  // ---------- La faction cachée (simulée) ----------
  simulate(f, dh) {
    if (f.ph === 'plot' || f.ph === 'peace' || f.ph === 'crushed') return;
    if (f.ph === 'ally') { this.simAlly(f, dh); return; }
    const live = f.colonies.filter((C) => C.alive);
    if (!live.length) { if (f.ph !== 'attack') this.crushed(f); return; }
    const loader = f.tech >= 15;
    const work = live.reduce((n, C, i) => n + (i === 0 || loader ? 1 : 0), 0);
    f.pop += dh * (0.4 + f.pop * 0.05) * work;
    f.tech = Math.min(100, f.tech + dh * (7 + Math.min(30, f.pop) * 0.25) * Math.sqrt(work));
    const say = (k, msg) => { if (!f.said[k]) { f.said[k] = 1; this.g.chat('📡 Transmission rebelle interceptée : « ' + msg + ' »', 'sys'); } };
    this.plantSpy(f);
    if (f.ph === 'hidden') this.raid(f);
    if (f.tech >= 15) say('loader', `Le chargeur de chunks fonctionne ! Nos colonies vivront même quand personne n'y sera. — ${f.leader}`);
    if (f.tech >= 25 && f.colonies.length < 2) { const C = this.outpost(f); if (C) say('c2', `Colonie ${C.name} fondée sur ${BODY[C.body].name}.`); }
    if (f.tech >= 30) say('yard', 'Le chantier naval est prêt. Premiers chasseurs en construction.');
    if (f.tech >= 45 && f.colonies.length < 3) { const C = this.outpost(f); if (C) say('c3', `Troisième colonie : ${C.name}, sur ${BODY[C.body].name}. Rien ne nous arrêtera.`); }
    if (f.tech >= 55) say('hab', 'Les vaisseaux habitats et les cargos sortent du chantier : nos soldats sont prêts.');
    if (f.tech >= 70) say('cru', `Le croiseur est achevé. ${f.motive === 'conquest' ? 'Le royaume du Dieu sera à nous.' : 'Le tyran va payer.'}`);
    // le chantier naval (selon les colonies qui travaillent)
    if (f.tech >= 30) f.fleet.fighter += dh * 1.6 * work;
    if (f.tech >= 55) { f.fleet.habitat += dh * 0.35 * work; f.fleet.cargo += dh * 0.3 * work; }
    if (f.tech >= 70) f.fleet.cruiser += dh * 0.2 * work;
    // l'attaque
    if (f.ph === 'hidden' && this.h >= f.next) {
      // (la date est venue : le chantier pousse ce qui manque)
      f.fleet.fighter = Math.max(f.fleet.fighter, 4 + f.wave * 2); f.fleet.habitat = Math.max(f.fleet.habitat, 1);
      f.fleet.cargo = Math.max(f.fleet.cargo, 1); f.fleet.cruiser = Math.max(f.fleet.cruiser, 1); f.tech = Math.max(f.tech, 70);
      this.attack(f);
    }
  }
  // Les pionniers : ils grandissent, fondent une autre colonie, bâtissent une escorte de chasseurs
  // (renforts pendant une attaque rebelle, voir reinforce) ; jamais d'attaque contre le joueur
  simAlly(f, dh) {
    const live = f.colonies.filter((C) => C.alive);
    if (!live.length) return;
    const work = f.tech >= 15 ? live.length : 1;
    f.pop += dh * (0.3 + f.pop * 0.04) * work;
    f.tech = Math.min(100, f.tech + dh * (6 + Math.min(30, f.pop) * 0.2) * Math.sqrt(work));
    const say = (k, msg) => { if (!f.said[k]) { f.said[k] = 1; this.g.chat('📡 Message des pionniers : « ' + msg + ' »', 'sys'); } };
    if (f.tech >= 15) say('loader', `Notre chargeur de chunks tourne : la colonie vit même quand tu es loin. — ${f.leader}`);
    if (f.tech >= 30 && f.colonies.length < 2) { const C = this.outpost(f); if (C) say('c2', `Nous avons fondé ${C.name} sur ${BODY[C.body].name}. Merci pour tout, ami !`); }
    if (f.tech >= 40) say('yard', "Nos premiers chasseurs sont prêts. Si les rebelles t'attaquent, nous viendrons t'aider !");
    if (f.tech >= 40) f.fleet.fighter = Math.min(6, f.fleet.fighter + dh * 0.8 * work);
  }
  outpost(f) {
    const used = new Set(f.colonies.map((C) => C.body));
    const ids = OUTPOSTS.filter((id) => BODY[id] && LANDABLE.includes(BODY[id]) && bodyZone(id) > 0 && !used.has(id));
    if (!ids.length) return null;
    const id = ids[hash(f.id + 'o' + f.colonies.length) % ids.length];
    return this.newColony(f, id, nameOf(f.leader + f.colonies.length, 2) + '-' + (f.colonies.length + 1), 4);
  }
  colonyFalls(f, C) {
    if (this.allyOf(f)) { this.betrayed(f, C); return; }
    C.alive = false;
    f.pop = Math.max(0, f.pop - C.pop);
    f.tech = Math.max(0, f.tech - 12);
    this.g.chat(`💥 Chargeur de chunks détruit : la colonie ${C.name} (${BODY[C.body]?.name}) s'effondre. ${f.colonies.filter((x) => x.alive).length} colonie(s) rebelle(s) restante(s).`, 'sys');
    this.g.world.changed = true;
    if (!f.colonies.some((x) => x.alive) && f.ph !== 'attack') this.crushed(f);
  }
  // Le chargeur de chunks des pionniers cassé : trahis, ils deviennent une rébellion
  betrayed(f, C) {
    C.alive = false;
    f.motive = 'rebellion'; f.ph = 'hidden'; f.name = 'Rébellion de ' + f.village; f.next = this.h + this.delay * 0.5;
    f.fleet.fighter = Math.max(f.fleet.fighter, 2);
    for (const [id, sh] of this.ships) {
      if (sh.f !== f.id) continue;
      delete sh.ally;
      const s = this.g.structs.byId(id);
      if (s) this.g.weapons.setStructTeam(s, TEAM);
    }
    for (const k of C.turrets || []) this.g.weapons.setWorldTeam(k, TEAM);
    if (C.vk) for (const a of this.g.animals.list) if (a.vk === C.vk) this.talk.change(a, this.me(), -300);
    if (!f.colonies.some((x) => x.alive)) f.colonies.push({ ...C, name: 'Refuge de ' + f.leader, alive: true, built: false, loader: null, vk: null, turrets: [] });
    this.g.chat(`💔 Tu as détruit le chargeur de chunks de ${C.name} ! Trahis, les pionniers de ${f.village} jurent de se venger : ils sont maintenant la ${f.name}.`, 'sys');
    this.g.toast('Les pionniers se sentent trahis');
    this.g.world.changed = true;
  }
  crushed(f) {
    if (f.ph === 'crushed') return;
    f.ph = 'crushed';
    this.g.chat(`🏳 ${f.name} est écrasée : plus aucune colonie, plus de chantier naval. Hexa est sauvée !`, 'sys');
    this.g.toast('La rébellion est écrasée');
    this.g.onEnd?.('crushed', f);
  }

  // ---------- Les espions ----------
  // Une faction cachée plante un espion dans un village fidèle : un villageois comme les autres, sauf
  // quand il émet (des étincelles au-dessus de sa tête). Le frapper le démasque ; frapper un
  // innocent fâche le village, comme toujours.
  plantSpy(f) {
    if (f.spy || f.motive === 'pioneer' || f.tech < SPY_TECH || (f.spyAt && this.h < f.spyAt)) return;
    const near = [...this.colony.villages.values()].filter((V) => !V.rebel && !V.gone && !V.colony && this.evolved(V))
      .sort((a, b) => Math.hypot(a.x - f.home[0], a.z - f.home[1]) - Math.hypot(b.x - f.home[0], b.z - f.home[1]));
    for (const V of near) {
      const ad = this.adults(V).filter((a) => !a.spy && a.job !== 'guard' && a.job !== 'soldier');
      if (ad.length < 3) continue;
      const a = ad[Math.floor(Math.random() * ad.length)];
      a.spy = f.id;
      f.spy = { vk: V.key, t: 0, n: 0 };
      const god = f.motive === 'conquest';
      this.g.chat(`📡 Transmission rebelle interceptée : « ${god ? 'Notre prêcheur' : 'Notre agent'} est en place à ${this.vName(V)}. Personne ne se doute de rien. »`, 'sys');
      return;
    }
  }
  spyOf(f) { return f.spy && this.g.animals.list.find((a) => a.spy === f.id && !a.dead) || null; }
  spies(dt) {
    const { fx } = this.g;
    for (const f of this.factions) {
      if (!f.spy) continue;
      const a = this.spyOf(f), V = this.colony.villages.get(f.spy.vk);
      if (!a || !V || V.gone || V.rebel || (f.ph !== 'hidden' && f.ph !== 'attack')) {
        if (a) a.spy = null;
        f.spy = null; f.spyAt = this.h + 3; // (espion perdu : un autre, plus tard)
        continue;
      }
      if (a.beacon > 0) {
        a.beacon -= dt;
        if (a.active) fx?.sparkle?.(a.pos.x, a.pos.y + 2.3, a.pos.z);
      }
      f.spy.t += dt / HOUR_S;
      if (f.spy.t < SPY_H) continue;
      f.spy.t = 0; f.spy.n++;
      a.beacon = SPY_BEACON;
      f.intel = Math.min(SPY_MAX, (f.intel || 0) + 1);
      const name = this.me();
      for (const x of this.adults(V)) if (x !== a) this.talk.change(x, name, -SPY_OP);
      this.g.chat(`📡 Signal suspect capté à ${this.vName(V)} : quelqu'un renseigne la ${f.name} et monte le village contre toi. (des étincelles au-dessus de sa tête pendant ${SPY_BEACON} s)`, 'sys');
    }
  }
  // Le joueur frappe un espion : démasqué, il s'enfuit ; le village est reconnaissant
  unmask(a, by) {
    const f = this.factions.find((x) => x.id === a.spy);
    a.spy = null;
    if (!f) return;
    const V = this.colony.villages.get(f.spy?.vk), god = f.motive === 'conquest';
    f.spy = null; f.spyAt = this.h + 4; f.intel = 0;
    f.tech = Math.max(0, f.tech - 10);
    if (V) for (const x of this.adults(V)) if (x !== a) this.talk.change(x, by, 25);
    this.g.chat(`🕵 Démasqué ! ${god ? 'Le prêcheur de la croisade' : "L'espion de la"} ${god ? `(${f.name})` : f.name} s'enfuit${V ? ` de ${this.vName(V)}` : ''}. Les villageois te remercient ; la faction perd ses renseignements.`, 'sys');
    this.talk.say?.(a, 'revolt');
    a.dead = true; a.deadT = 1;
    this.g.fx?.poof?.(a.pos.x, a.pos.y + 1, a.pos.z);
  }

  // ---------- La guerre aux villages fidèles ----------
  // Un vaisseau habitat se pose au village et ses soldats s'en prennent aux villageois ; les gardes
  // se défendent, le joueur peut les aider. Village pillé (la moitié des adultes tués ou plus) : il
  // en veut au joueur de ne pas l'avoir protégé ; repoussé avec le joueur : il le remercie.
  raid(f, force = false) {
    if (f.raid || f.motive === 'pioneer' || (!force && (f.tech < RAID_TECH || this.h < (f.raidAt ?? 0)))) return null;
    const { player } = this.g;
    if (zoneOfXZ(player.pos.x, player.pos.z) !== 0) return null;
    const V = [...this.colony.villages.values()].filter((v) => !v.rebel && !v.gone && !v.colony && this.adults(v).length >= 3 && Math.hypot(v.x - player.pos.x, v.z - player.pos.z) < RAID_R)
      .sort((a, b) => Math.hypot(a.x - player.pos.x, a.z - player.pos.z) - Math.hypot(b.x - player.pos.x, b.z - player.pos.z))[0];
    if (!V) { f.raidAt = this.h + 0.5; return null; }
    f.raidAt = this.h + RAID_H;
    const a = Math.random() * Math.PI * 2, d = rnd(10, 16);
    const at = new THREE.Vector3(V.x + Math.cos(a) * 160, Math.min(SPACE_Y - 70, V.y + 120), V.z + Math.sin(a) * 160);
    const s = this.spawn('habitat', f, at, null, 'land', { raid: V.key, spot: [V.x + Math.cos(a) * d, V.z + Math.sin(a) * d] });
    f.raid = { vk: V.key, n0: this.adults(V).length, t: 0, ship: s.id };
    const god = f.motive === 'conquest';
    this.g.chat(`⚔ ${god ? 'Les Croisés' : 'La ' + f.name} ${god ? 'attaquent' : 'attaque'} le village de ${this.vName(V)}, qui t'est resté fidèle ! Un vaisseau habitat descend : défends-le.`, 'sys');
    this.g.toast(`⚔ Raid sur ${this.vName(V)} !`);
    this.g.onAlarm?.();
    return V;
  }
  raids(dt) {
    const { player } = this.g;
    for (const f of this.factions) {
      const R = f.raid;
      if (!R) continue;
      R.t += dt;
      const V = this.colony.villages.get(R.vk), sh = this.ships.get(R.ship);
      const left = this.g.animals.list.filter((a) => a.type === 'rebel' && !a.dead && a.rf === f.id && V && Math.hypot(a.pos.x - V.x, a.pos.z - V.z) < 80).length;
      const landing = sh && (sh.mode === 'land' || (sh.mode === 'landed' && sh.out > 0));
      if (V && !V.gone && (landing || left) && R.t < 240) continue;
      // fin du raid
      f.raid = null;
      if (sh && sh.mode === 'landed') { sh.mode = 'retreat'; sh.t = 0; }
      if (!V || V.gone) continue;
      const n = this.adults(V).length, lost = R.n0 - n, helped = Math.hypot(player.pos.x - V.x, player.pos.z - V.z) < 70;
      if (lost * 2 >= R.n0) {
        for (const x of this.adults(V)) this.talk.change(x, this.me(), -10);
        this.g.chat(`🔥 ${this.vName(V)} a été pillé : ${lost} villageois tués. Les survivants t'en veulent de ne pas les avoir protégés.`, 'sys');
      } else {
        if (helped) for (const x of this.adults(V)) { this.talk.change(x, this.me(), 15); if (Math.random() < 0.4) this.talk.later(x, 'thanks', rnd(0.3, 2)); }
        this.g.chat(`🛡 ${this.vName(V)} a repoussé le raid${lost ? ` (${lost} villageois tués)` : ''}.${helped ? ' Les villageois te remercient de les avoir défendus.' : ''}`, 'sys');
      }
    }
  }

  // ---------- Les prisonniers ----------
  // Un soldat rebelle à bout de forces peut se rendre (une chance sur deux) : il devient prisonnier
  // et suit le joueur. Mené dans un village fidèle, il avoue où se cachent les colonies de sa
  // faction (des repères), et le village le garde.
  surrender(a, by) {
    if (a.triedSurrender || Math.random() >= SURRENDER_P) { a.triedSurrender = true; return false; }
    const rf = a.rf;
    a.type = 'prisoner'; a.pf = rf ?? null; a.prey = null; a.state = 'idle'; a.target = null;
    this.talk.say?.(a, 'surrender');
    this.g.chat(`🏳 Un soldat rebelle se rend ! Il te suit : mène-le dans un village fidèle pour l'interroger.`, 'sys');
    return true;
  }
  prisoners() {
    const list = this.g.animals.list.filter((a) => a.type === 'prisoner' && !a.dead);
    if (!list.length) return;
    for (const a of list) {
      const V = [...this.colony.villages.values()].find((v) => !v.rebel && !v.gone && v.members.length && Math.hypot(v.x - a.pos.x, v.z - a.pos.z) < 22);
      if (!V) continue;
      const f = this.factions.find((x) => x.id === a.pf) || this.factions.find((x) => x.ph === 'hidden' || x.ph === 'attack');
      const live = f ? f.colonies.filter((C) => C.alive) : [];
      if (f && live.length) {
        for (const C of live) if (!this.g.waypoints?.().some((w) => Math.hypot(w.x - C.x, w.z - C.z) < 50)) this.g.addWaypoint(C.x, C.z, (C.name + ' ' + BODY[C.body].name).slice(0, 24));
        f.clue = true;
        this.g.chat(`🗝 Interrogé à ${this.vName(V)}, le prisonnier avoue : la ${f.name} se cache ${live.map((C) => `à ${C.name} (${BODY[C.body].name})`).join(', ')}. Repères ajoutés. Les villageois le gardent en prison.`, 'sys');
      } else this.g.chat(`🗝 Le prisonnier n'a plus rien à cacher : sa faction n'existe plus. Les villageois de ${this.vName(V)} le gardent.`, 'sys');
      for (const x of this.adults(V)) this.talk.change(x, this.me(), 8);
      a.dead = true; a.deadT = 1;
      this.g.fx?.poof?.(a.pos.x, a.pos.y + 1, a.pos.z);
    }
  }

  // ---------- Tribut et trêve ----------
  // Au puits du village abandonné, les rebelles laissent un coffre : le tribut (lingots de fer,
  // voltite) qu'on y dépose est emporté. TRUCE lingots : une trêve (l'attaque en cours se retire,
  // la suivante est repoussée), et le prix de la trêve suivante monte ; PEACE lingots en tout : la
  // paix pour de bon. En créatif, ce sont des offrandes au Dieu.
  tributeChest(f) {
    const { world } = this.g;
    if (f.trib || f.motive === 'pioneer') return;
    for (const [dx, dz] of [[3, 0], [-3, 0], [0, 3], [0, -3], [3, 3]]) {
      const h = worldToHex(f.home[0] + dx, f.home[1] + dz);
      if (!world.isLoaded?.(h.q, h.r)) continue;
      const y = world.surface(h.q, h.r).h + 1;
      if (SOLID[world.getBlock(h.q, h.r, y)]) continue;
      world.setBlock(h.q, h.r, y, CHEST);
      f.trib = [h.q, h.r, y]; f.paid ||= 0; f.truceAt ||= TRUCE;
      if (f.tribSaid) return; // (un coffre reposé : rien à redire)
      f.tribSaid = true;
      const god = f.motive === 'conquest';
      this.g.chat(god
        ? `Un coffre d'offrandes attend près du puits : « Ô Dieu, ${f.truceAt} lingots de fer et nous retarderons la croisade. ${PEACE} et nous renoncerons à ton royaume. » (la voltite vaut ${VOLT_V} lingots)`
        : `Un coffre attend près du puits : « Tyran, paie ${f.truceAt} lingots de fer et tu auras une trêve. ${PEACE} et nous ne reviendrons jamais. » (la voltite vaut ${VOLT_V} lingots)`, 'sys');
      return;
    }
  }
  tribute() {
    const { world, containers } = this.g;
    for (const f of this.factions) {
      if (!f.trib || (f.ph !== 'hidden' && f.ph !== 'attack')) continue;
      const [q, r, y] = f.trib;
      if (!world.isLoaded?.(q, r)) continue;
      if (!isChest(world.getBlock(q, r, y))) { f.trib = null; continue; } // (coffre cassé ou soufflé : il est reposé quand on revient au puits)
      const c = containers.at?.(q, r, y);
      if (!c?.slots) continue;
      let v = 0;
      c.slots.forEach((sl, i) => {
        if (!sl) return;
        const k = sl.id === IRON_INGOT ? 1 : sl.id === VOLTITE ? VOLT_V : 0;
        if (k) { v += k * sl.n; c.slots[i] = null; }
      });
      if (!v) continue;
      f.paid += v;
      const god = f.motive === 'conquest';
      if (f.paid >= PEACE) {
        for (const [, sh] of this.ships) if (sh.f === f.id && sh.mode !== 'parked' && sh.mode !== 'landed') sh.mode = 'retreat';
        f.spawned = false; f.ph = 'peace';
        this.g.chat(god ? `🕊 Les Croisés acceptent tes offrandes, ô Dieu : la ${f.name} renonce à ton royaume pour toujours.` : `🕊 ${f.leader} accepte ton tribut : la ${f.name} fait la paix et ne reviendra jamais.`, 'sys');
        this.g.onEnd?.('peace', f);
        continue;
      }
      if (f.paid >= f.truceAt) {
        if (f.ph === 'attack') { for (const [, sh] of this.ships) if (sh.f === f.id && sh.mode !== 'parked' && sh.mode !== 'landed') sh.mode = 'retreat'; f.spawned = false; f.ph = 'hidden'; }
        f.next = Math.max(f.next, this.h) + this.delay;
        f.truceAt += TRUCE;
        this.g.chat(`🤝 ${god ? 'Offrandes acceptées' : 'Tribut accepté'} : trêve avec la ${f.name}. Pas d'attaque avant ${Math.round(f.next - this.h)} h de jeu. (prochaine trêve : ${f.truceAt} lingots en tout, la paix : ${PEACE})`, 'sys');
        continue;
      }
      this.g.chat(`${god ? 'Offrande' : 'Tribut'} emporté : ${f.paid} / ${f.truceAt} lingots pour une trêve avec la ${f.name}.`, 'sys');
    }
  }

  // ---------- Le joueur trouve la piste, visite une colonie ----------
  visit() {
    const { player, world } = this.g, zone = zoneOfXZ(player.pos.x, player.pos.z);
    for (const f of this.factions) {
      // (le puits du village abandonné : un message gravé, et un repère)
      if (!f.clue && f.ph !== 'plot' && f.hide && Math.hypot(player.pos.x - f.home[0], player.pos.z - f.home[1]) < 26 && zone === zoneOfXZ(f.home[0], f.home[1])) {
        f.clue = true;
        const C = f.colonies[0];
        this.g.chat(`Gravé sur la margelle du puits : « Nous sommes partis pour ${BODY[f.hide].name}. ${f.motive === 'conquest' ? 'Nous reviendrons conquérir ton royaume, ô Dieu.' : 'Nous reviendrons, tyran.'} — ${f.leader} »`, 'sys');
        if (C) this.g.addWaypoint(C.x, C.z, ('Rebelles ' + BODY[C.body].name).slice(0, 24));
      }
      // (le coffre du tribut : posé dès que le coin du puits est chargé, reposé s'il a disparu)
      if (f.clue && !f.trib && (f.ph === 'hidden' || f.ph === 'attack') && Math.hypot(player.pos.x - f.home[0], player.pos.z - f.home[1]) < 40 && zone === zoneOfXZ(f.home[0], f.home[1])) this.tributeChest(f);
      for (const C of f.colonies) {
        if (!C.alive || C.built || zone !== bodyZone(C.body)) continue;
        const d = Math.hypot(player.pos.x - C.x, player.pos.z - C.z);
        if (d > BUILD_R) continue;
        let h = worldToHex(C.x, C.z);
        if (!world.isLoaded?.(h.q, h.r)) {
          // (le joueur est tout près mais ce coin n'est pas encore chargé : la colonie, qui n'existait
          // que sur le papier, se pose à un endroit chargé entre lui et l'emplacement prévu)
          if (d > 120) continue;
          const k = Math.min(1, 14 / Math.max(1, d)), x = player.pos.x + (C.x - player.pos.x) * k, z = player.pos.z + (C.z - player.pos.z) * k;
          const p = worldToHex(x, z);
          if (!world.isLoaded?.(p.q, p.r)) continue;
          C.x = Math.round(x); C.z = Math.round(z); h = p;
        }
        this.buildColony(f, C);
      }
      // (un chargeur de chunks cassé pendant qu'on était ailleurs : vérifié sur place)
      for (const C of f.colonies) if (C.alive && C.loader && world.isLoaded?.(C.loader[0], C.loader[1]) && world.getBlock(...C.loader) !== CHUNK_LOADER) this.colonyFalls(f, C);
    }
  }
  buildColony(f, C) {
    const { world, animals, weapons, containers } = this.g;
    const h = worldToHex(C.x, C.z), y = Math.max(1, world.surface(h.q, h.r).h + 1);
    const ally = this.allyOf(f);
    const res = this.colony.foundColony(h.q, h.r, y, ally ? 'pionniers' : 'rebelles');
    C.built = true;
    // (trop près d'un autre village : seulement la place, sans maisons)
    const V = res.V || { q: h.q, r: h.r, y: y - 1 };
    if (res.V) {
      V.rebel = f.id; V.rname = C.name;
      C.vk = V.key;
      // les colons ne nous aiment pas (les pionniers, eux, nous adorent)
      for (const a of animals.list) if (a.vk === V.key) this.talk.change(a, this.me(), ally ? 200 : -200);
    }
    // le chargeur de chunks au centre de la place, et un coffre de butin à côté
    C.loader = [V.q, V.r, V.y + 1];
    world.setBlock(...C.loader, CHUNK_LOADER);
    const box = [V.q + 1, V.r, V.y + 1];
    world.setBlock(...box, CHEST);
    const B = containers.at?.(...box);
    if (B) for (const [id, n] of [[NEDROLYTIUM, 4], [MISSILE_AMMO, 8], [BULLET, 64], [BREAD, 8]]) this.g.industry?.insert(B, makeSlot(id, n));
    // trois tourelles sur des piliers d'acier autour de la place
    DIRS.filter((_, i) => i % 2 === 0).forEach(([dq, dr], i) => {
      const q = V.q + dq * 8, r = V.r + dr * 8, top = Math.max(1, world.surface(q, r).h + 1);
      world.setBlock(q, r, top, STEEL); world.setBlock(q, r, top + 1, STEEL);
      world.setBlock(q, r, top + 2, [TURRET_GUN, TURRET_LASER, TURRET_MISSILE][i]);
      weapons.setWorldTeam(keyOf(q, r, top + 2), ally ? ALLY : TEAM);
      (C.turrets ||= []).push(keyOf(q, r, top + 2));
    });
    // les gardes rebelles (chez les pionniers : des colons armés, amis)
    const c = hexToWorld(V.q, V.r);
    for (let i = 0, n = Math.min(8, 3 + Math.floor(C.pop / 4)); i < n; i++) {
      const ang = (i / n) * Math.PI * 2, x = c.x + Math.cos(ang) * 6, z = c.z + Math.sin(ang) * 6;
      const a = ally ? animals.add('villager', x, V.y + 2, z) : this.soldier(x, V.y + 2, z, f);
      if (!a) continue;
      a.home = { x: c.x, z: c.z };
      if (ally) { a.job = 'soldier'; a.helmet = true; if (res.V) a.vk = V.key; this.talk.change(a, this.me(), 200); }
    }
    // un chasseur posé à côté (rebelle : il décolle quand on approche ; pionnier : il garde la colonie)
    if (f.fleet.fighter >= 1) {
      f.fleet.fighter--;
      const ang = hash(C.name) % 628 / 100, x = c.x + Math.cos(ang) * 26, z = c.z + Math.sin(ang) * 26;
      const p = worldToHex(x, z), gy = Math.max(1, world.surface(p.q, p.r).h + 1), o = hexToWorld(p.q, p.r);
      this.spawn('fighter', f, new THREE.Vector3(o.x, gy, o.z), null, 'parked', ally ? { ally: true } : {});
    }
    this.g.chat(ally
      ? `Bienvenue à ${C.name}, la colonie des ${f.name} ! Les colons t'accueillent en ami : commerce avec eux, et le coffre près du chargeur de chunks est pour toi.`
      : `Tu as trouvé ${C.name}, une colonie de la ${f.name}. Son chargeur de chunks rouge est au centre : détruis-le.`, 'sys');
    if (ally && res.V) for (const a of animals.list) if (a.vk === V.key && Math.random() < 0.5) this.talk.later(a, 'thanks', rnd(0.5, 3));
    world.changed = true;
  }
  soldier(x, y, z, f = null) {
    const a = this.g.animals.add('rebel', x, y, z);
    if (a) { a.job = Math.random() < 0.5 ? 'soldier' : 'soldier2'; a.helmet = true; a.rf = f?.id ?? null; }
    return a;
  }
  // Les dégâts des rebelles sur le joueur : lissés (au plus ~1,2 point par seconde, 5 d'un coup),
  // sinon une flotte entière le tuerait en une seconde
  // (who : un invité, chez l'hôte ; sinon soi-même)
  hit(dmg, at, who = null) {
    const now = performance.now() / 1000, buds = this.buds ||= new Map();
    const b = buds.get(who) || { v: 5, t: now };
    b.v = Math.min(5, b.v + (now - b.t) * 1.2);
    b.t = now;
    buds.set(who, b);
    const n = Math.floor(Math.min(b.v, Math.max(1, Math.round(dmg / 3))));
    if (n < 1) return;
    b.v -= n;
    if (who) this.g.net.mobHit?.(who, n, at.x, at.z, 'la flotte rebelle');
    else this.g.hurt(n, at.x, at.z, 'la flotte rebelle');
  }
  onPlayerDeath() {
    for (const f of this.factions) if (f.ph === 'attack') this.endWave(f, false);
  }
  // Un rebelle tire (voir animals.js, onShoot) : un rayon rouge ; il touche souvent
  shoot(a, prey, isPlayer) {
    const from = a.pos.clone().add(_a.set(0, 1.35, 0)), to = prey.pos.clone().add(_b.set(0, isPlayer ? 1.1 : 0.9, 0));
    if (!this.sight(from, to)) return;
    const hit = Math.random() < 0.65;
    if (!hit) to.add(_b.set(rnd(-1.5, 1.5), rnd(-0.5, 1), rnd(-1.5, 1.5)));
    this.g.weapons.beam(from, to, 0xff3a2a, 0.15);
    if (this.g.net.mode === 'host') this.g.net.broadcastJoined({ t: 'rbeam', a: from.toArray().map((v) => Math.round(v * 100) / 100), b: to.toArray().map((v) => Math.round(v * 100) / 100) }); // (les invités voient le tir)
    if (Math.random() < 0.08) this.talk.say(a, pick(['tyrant', 'revolt', 'freedom']));
    if (!hit) return;
    if (isPlayer) this.hit(SHOT_DMG * 3, a.pos, prey === this.g.player ? null : prey);
    else this.g.animals.hit(prey, 3, a.pos.x, a.pos.z);
  }
  sight(A, B) {
    const d = A.distanceTo(B), n = Math.ceil(d / 0.5), w = this.g.world;
    for (let i = 2; i < n - 1; i++) {
      const p = _a.copy(A).lerp(B, i / n), h = worldToHex(p.x, p.z);
      if (SOLID[w.getBlock(h.q, h.r, Math.floor(p.y))]) return false;
    }
    return true;
  }

  // ---------- Les vaisseaux ----------
  spawn(kind, f, at, quat = null, mode = 'arrive', extra = {}) {
    const { structs, weapons, orbital, rockets } = this.g;
    const list = PLANS[kind]();
    const s = structs.create(++structs.nextId, at.x, at.y, at.z, quat, list);
    weapons.setStructTeam(s, extra.ally ? ALLY : TEAM);
    if (s.rocket?.cap) rockets.setFuel(s, s.rocket.cap);
    const sh = { kind, f: f.id, mode, t: 0, n0: s.list.length, ang: Math.random() * Math.PI * 2, r: rnd(30, 52), h: rnd(16, 30), cd: rnd(4, 10), ...extra };
    if (kind === 'cruiser') { sh.bays = CRUISER_BAYS.map(() => 1); sh.docks = CRUISER_DOCKS.map(() => 1); sh.name = cap(nameOf(f.leader + 'cru' + f.wave, 3)); }
    if (kind === 'cargo') sh.bays = CARGO_BAYS.map(() => 1);
    if (kind === 'fighter') s.boost = 3;
    s.vcap = WARP_CAP;
    this.ships.set(s.id, sh);
    structs.changed(s); // (en ligne : les invités voient le vaisseau)
    orbital.hold(s, true);
    this.g.world.changed = true;
    return s;
  }
  // Un module (chasseur d'un hangar, habitat amarré) se détache du vaisseau porteur : ses blocs
  // quittent le porteur, et il devient un vaisseau à part, au même endroit
  detach(P, sh, kind, off) {
    const { structs } = this.g;
    const sub = PLANS[kind](), drop = new Set(sub.map(([q, r, y]) => keyOf(q + off[0], r + off[1], y + off[2])));
    const keep = P.list.filter(([q, r, y]) => !drop.has(keyOf(q, r, y)));
    if (keep.length === P.list.length) return null; // (le module a été détruit)
    const c = hexToWorld(off[0], off[1]), at = structs.toWorld(P, _a.set(c.x, off[2], c.z), new THREE.Vector3());
    structs.setBlocks(P, keep);
    structs.changed(P);
    sh.n0 = Math.max(keep.length, sh.n0 - sub.length);
    const f = this.factions.find((x) => x.id === sh.f);
    return f ? this.spawn(kind, f, at, P.quat, kind === 'fighter' ? 'swoop' : 'land', { from: P.id }) : null;
  }
  // Un chasseur abîmé revient s'amarrer dans un hangar libre du croiseur : il y est réparé
  redock(s, sh, P, ph, i) {
    const { structs } = this.g;
    this.ships.delete(s.id);
    structs.remove(s);
    this.redockNew(P, ph, i);
    this.g.toast('Un chasseur rebelle rentre au croiseur se réparer');
  }

  // Le pilote des vaisseaux rebelles (près du joueur, sur un astre : sans physique, comme orbital.js)
  fly(s, sh, dt) {
    const { player, orbital, flight } = this.g;
    sh.t += dt;
    const zone = zoneOfXZ(s.pos.x, s.pos.z);
    const P = player.pos, alive = this.g.alive(), pz = zoneOfXZ(P.x, P.z);
    if (sh.mode === 'space') {
      // (dans l'espace : le programme « chasser » d'orbital.js ; le joueur redescendu sur un astre,
      // le chasseur rentre au chantier au bout d'un moment)
      if (pz >= 0 && zone < 0) { if ((sh.idle = (sh.idle || 0) + dt) > 15) this.retire(s, sh); } else sh.idle = 0;
      return;
    }
    const f = this.factions.find((x) => x.id === sh.f);
    const go = (to, v, look = null) => {
      const d = s.pos.distanceTo(to);
      if (d < 0.02) return true;
      const step = Math.min(d, v * dt), next = s.pos.clone().lerp(to, step / d);
      // (penché vers où il va, le nez en haut)
      const vel = _a.copy(next).sub(s.pos).divideScalar(Math.max(dt, 1e-4)), sp = vel.length();
      let q = ID_Q;
      if (look || sp > 2) {
        const dir = (look || vel).clone().setY(0);
        if (dir.lengthSq() > 1e-4) { const ax = _b.crossVectors(UP, dir.normalize()); q = _q.setFromAxisAngle(ax.normalize(), Math.min(sh.kind === 'fighter' ? 0.5 : 0.12, sp / 80)); }
      }
      orbital.glide(s, next, s.quat.clone().slerp(q, Math.min(1, dt * 2)));
      s.firing = sp > 3 ? 1 : 0;
      return step >= d - 0.01;
    };
    if (sh.kind === 'exodus') {
      // décollage : de plus en plus vite, jusqu'à l'espace, puis le saut (il disparaît)
      s.firing = 1;
      orbital.glide(s, s.pos.clone().setY(s.pos.y + Math.min(80, 3 + 7 * sh.t) * dt));
      if (Math.random() < dt * 20) this.g.fx.puffs.spawn(s.pos.clone().add(_a.set(rnd(-2, 2), -6, rnd(-2, 2))), _b.set(rnd(-2, 2), -3, rnd(-2, 2)), rnd(1.5, 3), '#cfcfcf', rnd(1, 2), 1.5, 1);
      if (s.pos.y > SPACE_Y - 40) { this.ships.delete(s.id); this.g.structs.remove(s); }
      return;
    }
    // (le joueur est parti dans l'espace : les chasseurs le suivent, les autres l'attendent)
    if (pz < 0 && alive) {
      if (sh.kind === 'fighter' && sh.mode !== 'parked') this.toSpace(s, sh);
      else if (sh.kind !== 'cruiser') go(s.pos.clone().setY(Math.min(SPACE_Y - 60, s.pos.y + 1)), 4);
      return;
    }
    // loin du joueur (autre astre) : on ne bouge pas
    if (zone !== pz || !f) { if (sh.mode !== 'parked' && f?.ph !== 'attack') this.retire(s, sh); return; }
    const flat = Math.hypot(P.x - s.pos.x, P.z - s.pos.z);
    // retraite (vague finie, joueur mort) : on remonte et on disparaît
    const busy = f.ph === 'attack' || sh.guard || (sh.raid && f.raid?.ship === s.id) || (sh.ally && sh.mode !== 'parked' && this.hostile()); // (les renforts : tant que dure l'attaque)
    if (sh.mode === 'retreat' || (!alive && sh.mode !== 'parked') || (!busy && sh.mode !== 'parked' && sh.mode !== 'landed')) {
      if (sh.mode !== 'retreat') { sh.mode = 'retreat'; sh.t = 0; }
      if (go(s.pos.clone().add(_a.set(0, 200, 0)), Math.min(70, 10 + sh.t * 8)) || s.pos.y > SPACE_Y - 60) { this.ships.delete(s.id); this.g.structs.remove(s); }
      return;
    }
    const ground = (x, z) => { const h = worldToHex(x, z); return Math.max(this.g.world.surface(h.q, h.r).h, 0); };
    if (sh.mode === 'parked') {
      if (sh.ally) return; // (le chasseur des pionniers garde sa colonie)
      if (alive && flat < 110) { sh.mode = 'swoop'; sh.guard = true; sh.t = 0; this.g.chat('Un chasseur rebelle décolle !', 'sys'); }
      return;
    }
    if (sh.kind === 'fighter') {
      // un chasseur abîmé rentre au croiseur s'y réparer (s'il reste un hangar libre)
      const hp = s.list.length / sh.n0;
      if (hp < 0.85 && sh.mode !== 'home') {
        for (const [id, o] of this.ships) {
          if (o.kind !== 'cruiser' || o.f !== sh.f) continue;
          const i = o.bays.findIndex((b) => !b);
          if (i >= 0) { sh.mode = 'home'; sh.to = id; sh.bay = i; o.bays[i] = 2; break; }
        }
      }
      if (sh.mode === 'home') {
        const Pc = this.g.structs.byId(sh.to), o = this.ships.get(sh.to);
        if (!Pc || !o) { sh.mode = 'swoop'; return; }
        const off = CRUISER_BAYS[sh.bay], c = hexToWorld(off[0], off[1]);
        const dock = this.g.structs.toWorld(Pc, _a.set(c.x, off[2], c.z), new THREE.Vector3()).add(_b.copy(s.com).applyQuaternion(Pc.quat));
        if (go(dock, 30)) this.redock(s, sh, Pc, o, sh.bay);
        return;
      }
      // il tourne autour du joueur, au-dessus de lui, et ses tourelles tirent
      sh.ang += dt * (26 / sh.r) * (sh.f % 2 ? 1 : -1);
      if ((sh.cd -= dt) <= 0) { sh.cd = rnd(5, 11); sh.r = rnd(24, 55); sh.h = rnd(12, 32); }
      const to = new THREE.Vector3(P.x + Math.cos(sh.ang) * sh.r, 0, P.z + Math.sin(sh.ang) * sh.r);
      to.y = Math.max(P.y + sh.h, ground(to.x, to.z) + 10);
      go(to, sh.mode === 'arrive' ? 90 : 42);
      if (sh.mode === 'arrive' && s.pos.distanceTo(to) < 20) sh.mode = 'swoop';
      return;
    }
    if (sh.kind === 'habitat') {
      // il se pose près du joueur, et ses soldats débarquent
      if (sh.mode === 'land' || sh.mode === 'arrive') {
        if (!sh.spot) { const a = Math.random() * Math.PI * 2, d = rnd(26, 40); sh.spot = [P.x + Math.cos(a) * d, P.z + Math.sin(a) * d]; sh.ly = null; }
        const fl = Math.hypot(sh.spot[0] - s.pos.x, sh.spot[1] - s.pos.z);
        if (sh.ly == null || (fl < 40 && !sh.lyNear)) { sh.ly = orbital.landY(s, sh.spot[0], sh.spot[1]); sh.lyNear = fl < 40; }
        const ly = sh.ly, to = new THREE.Vector3(sh.spot[0], fl > 1 ? Math.max(ly + 25, Math.min(s.pos.y, ly + 60)) : ly, sh.spot[1]);
        if (go(to, fl > 1 ? 40 : Math.min(30, Math.abs(s.pos.y - ly) * 0.8 + 2)) && fl <= 1) {
          sh.mode = 'landed'; sh.t = 0; sh.out = Math.min(8, 4 + (f.wave || 0) * 2);
          this.g.chat('Un vaisseau habitat rebelle s\'est posé : des soldats débarquent !', 'sys');
        }
        return;
      }
      if (sh.mode === 'landed' && sh.out > 0 && sh.t > 1.2) {
        sh.t = 0; sh.out--;
        const a = Math.random() * Math.PI * 2, base = s.pos.y - this.g.orbital.underside(s);
        const r = this.soldier(s.pos.x + Math.cos(a) * 5, base + 0.2, s.pos.z + Math.sin(a) * 5, f);
        if (r) this.talk.say(r, pick(['revolt', 'tyrant', 'crusade']));
      }
      return;
    }
    if (sh.kind === 'cargo') {
      // il vient au-dessus du joueur et largue ses chasseurs, puis s'en va
      if (sh.mode === 'arrive' || sh.mode === 'land') {
        const to = new THREE.Vector3(P.x + Math.cos(sh.ang) * 55, 0, P.z + Math.sin(sh.ang) * 55);
        to.y = Math.max(P.y + 38, ground(to.x, to.z) + 24);
        if (go(to, 45)) { sh.mode = 'drop'; sh.t = 0; }
        return;
      }
      if (sh.mode === 'drop') {
        if (sh.t > 1.5) {
          sh.t = 0;
          const i = sh.bays.findIndex((b) => b);
          if (i < 0) { sh.mode = 'retreat'; return; }
          sh.bays[i] = 0;
          if (this.detach(s, sh, 'fighter', CARGO_BAYS[i])) this.g.toast('Le cargo largue un chasseur');
        }
        return;
      }
    }
    if (sh.kind === 'cruiser') {
      // le croiseur tient sa place au loin, au-dessus, tourne lentement ; il lance ses chasseurs
      // (deux à la fois au plus dehors) et détache ses habitats
      sh.ang += dt * 0.025;
      const to = new THREE.Vector3(P.x + Math.cos(sh.ang) * 95, 0, P.z + Math.sin(sh.ang) * 95);
      to.y = Math.max(P.y + 55, ground(to.x, to.z) + 45);
      go(to, sh.mode === 'arrive' ? 60 : 6, new THREE.Vector3(P.x - s.pos.x, 0, P.z - s.pos.z));
      if (sh.mode === 'arrive' && s.pos.distanceTo(to) < 30) { sh.mode = 'hold'; sh.t = 0; this.g.chat(`Le croiseur « ${sh.name} » est en position. Ses hangars s'ouvrent.`, 'sys'); }
      if (sh.mode !== 'hold') return;
      if ((sh.cd -= dt) <= 0) {
        sh.cd = 9;
        // (ses propres chasseurs : ceux des cargos et de l'arrivée ne comptent pas)
        const out = [...this.ships.values()].filter((o) => o.kind === 'fighter' && o.from === s.id && o.mode !== 'home').length;
        const i = sh.bays.findIndex((b) => b === 1);
        if (out < 2 && i >= 0) { sh.bays[i] = 0; this.detach(s, sh, 'fighter', CRUISER_BAYS[i]); }
        else if (i < 0 && f.fleet.fighter >= 1) { const j = sh.bays.findIndex((b) => b === 0); if (j >= 0) { f.fleet.fighter--; this.redockNew(s, sh, j); } }
        const d = sh.docks.findIndex((b) => b);
        if (d >= 0 && sh.t > 14 + d * 20) { sh.docks[d] = 0; if (this.detach(s, sh, 'habitat', CRUISER_DOCKS[d])) this.g.chat('Le croiseur largue un vaisseau habitat !', 'sys'); }
      }
    }
  }
  // (les réserves du chantier ravitaillent un hangar vide)
  redockNew(P, ph, j) {
    const off = CRUISER_BAYS[j], sub = fighterPlan().map(([q, r, y, id]) => [q + off[0], r + off[1], y + off[2], id]);
    this.g.structs.setBlocks(P, P.list.concat(sub));
    this.g.structs.changed(P);
    ph.bays[j] = 1;
    ph.n0 += sub.length;
  }
  // Un chasseur passe en mode spatial : le programme « chasser » d'orbital.js (il monte, puis
  // rattrape le vaisseau du joueur, même en saut)
  toSpace(s, sh) {
    sh.mode = 'space';
    const ap = this.g.orbital.apOf(s);
    Object.assign(ap, { steps: [{ t: 'chase' }], i: 0, run: true, loop: false, ph: null, t: 0, T: 0, cruise: false, msg: 'Chasse', gh: null, pw: null, fto: null, docked: null });
  }
  retire(s, sh) {
    // (vaisseau d'une vague passée, loin : rendu au chantier)
    const f = this.factions.find((x) => x.id === sh.f);
    if (f && f.fleet[sh.kind] !== undefined) f.fleet[sh.kind] += 1;
    this.ships.delete(s.id);
    this.g.structs.remove(s);
  }

  // ---------- L'attaque ----------
  attack(f) {
    f.ph = 'attack'; f.wave++; f.t0 = this.h; f.spawned = false;
    const w = f.wave;
    this.g.chat(f.motive === 'conquest'
      ? `⚔ La ${f.name} revient conquérir le royaume du Dieu ! Une flotte entre dans l'atmosphère (vague ${w}).`
      : `⚠ ALERTE : la flotte de la ${f.name} attaque Hexa ! Ils veulent ta peau (vague ${w}).`, 'sys');
    this.g.toast('⚠ Attaque rebelle !');
    this.g.onAlarm?.();
    if (f.intel) { f.fleet.fighter += f.intel; this.g.chat(`📡 Renseignés par leur espion, les rebelles savent où frapper : ${f.intel} chasseur(s) de plus.`, 'sys'); f.intel = 0; }
    this.arrive(f);
    this.reinforce();
  }
  // Les pionniers amis envoient leurs chasseurs aider le joueur (sur un astre, là où il est)
  reinforce() {
    const { player } = this.g, P = player.pos;
    if (zoneOfXZ(P.x, P.z) < 0 || !this.g.alive()) return;
    for (const a of this.factions) {
      if (a.ph !== 'ally' || !a.colonies.some((C) => C.alive)) continue;
      const n = Math.min(3, Math.floor(a.fleet.fighter));
      if (n < 1) continue;
      const from = Math.random() * Math.PI * 2;
      for (let i = 0; i < n; i++) {
        a.fleet.fighter--;
        const ang = from + rnd(-0.4, 0.4);
        this.spawn('fighter', a, new THREE.Vector3(P.x + Math.cos(ang) * 130, Math.min(SPACE_Y - 70, P.y + 100), P.z + Math.sin(ang) * 130), null, 'arrive', { ally: true });
      }
      this.g.chat(`🛡 Les ${a.name} t'envoient ${n} chasseur${n > 1 ? 's' : ''} en renfort !`, 'sys');
    }
  }
  // La flotte arrive là où est le joueur : sur un astre, en vrai ; dans l'espace, des chasseurs
  arrive(f) {
    const { player, flight } = this.g, P = player.pos, zone = zoneOfXZ(P.x, P.z);
    if (!this.g.alive()) return;
    if (zone < 0) {
      if (f.huntT && this.h - f.huntT < 0.5) return;
      f.huntT = this.h;
      const B = flight.bubbleAt(P.x, P.z);
      if (!B) return;
      const n = Math.min(3 + f.wave, Math.max(2, Math.floor(f.fleet.fighter)));
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2, at = new THREE.Vector3(P.x + Math.cos(a) * 260, P.y + rnd(-30, 30), P.z + Math.sin(a) * 260);
        f.fleet.fighter = Math.max(0, f.fleet.fighter - 1);
        const s = this.spawn('fighter', f, at, null, 'space');
        this.toSpace(s, this.ships.get(s.id));
      }
      this.g.chat(`Des chasseurs rebelles sortent du saut près de toi (${n}) ! Ils te traquent.`, 'sys');
      return;
    }
    if (f.spawned) return;
    f.spawned = true;
    const from = Math.random() * Math.PI * 2;
    const at = (d, h, spread = 0.6) => { const a = from + rnd(-spread, spread); return new THREE.Vector3(P.x + Math.cos(a) * d, Math.min(SPACE_Y - 70, P.y + h), P.z + Math.sin(a) * d); };
    if (f.fleet.cruiser >= 1) { f.fleet.cruiser--; this.spawn('cruiser', f, at(150, 150, 0.1)); }
    const nf = Math.min(4 + f.wave, Math.floor(f.fleet.fighter));
    for (let i = 0; i < nf; i++) { f.fleet.fighter--; this.spawn('fighter', f, at(140, 110), null, 'arrive'); }
    if (f.fleet.habitat >= 1) { f.fleet.habitat--; this.spawn('habitat', f, at(140, 120), null, 'land'); }
    if (f.fleet.cargo >= 1) { f.fleet.cargo--; this.spawn('cargo', f, at(150, 130), null, 'arrive'); }
  }
  // Les vaisseaux : morts (trop abîmés, poste de pilotage perdu), fin de la vague
  checkShips() {
    const { structs, weapons } = this.g;
    for (const [id, sh] of [...this.ships]) {
      const s = structs.byId(id);
      if (!s) { this.ships.delete(id); continue; }
      if (sh.kind === 'exodus') continue;
      let cock = false, reactor = false;
      for (const [, , , b] of s.list) { if (b === COCKPIT) cock = true; else if (b === REACTOR) reactor = true; if (cock && reactor) break; }
      if (s.list.length / sh.n0 >= DIE_AT[sh.kind] && cock && reactor) continue;
      this.ships.delete(id);
      weapons.setStructTeam(s, null);
      if (this.g.orbital.ships.has(id)) this.g.orbital.stop(s, this.g.orbital.ships.get(id));
      this.g.orbital.hold(s, false);
      s.boost = 0;
      this.g.explode(s.pos.x, s.pos.y, s.pos.z, sh.kind === 'cruiser' ? 60 : sh.kind === 'fighter' ? 4 : 15);
      const f = this.factions.find((x) => x.id === sh.f);
      this.g.chat(`💥 ${KIND_NAME[sh.kind]}${sh.name ? ' « ' + sh.name + ' »' : ''} ${sh.ally ? 'des pionniers abattu...' : 'rebelle abattu !'}`, 'sys');
      if (sh.kind === 'cruiser') this.loot(s);
      if (f && sh.kind === 'cruiser' && f.ph === 'attack') this.endWave(f, true);
    }
    for (const f of this.factions) {
      if (f.ph !== 'attack') continue;
      if (!f.spawned) this.arrive(f);
      const mine = [...this.ships.values()].filter((o) => o.f === f.id && o.kind !== 'exodus');
      const soldiers = this.g.animals.list.some((a) => a.type === 'rebel' && !a.dead && a.active);
      const dead = !this.g.alive();
      if (dead) { if (!f.deadT) f.deadT = this.h; else if (this.h - f.deadT > 0.15) this.endWave(f, false); continue; }
      f.deadT = 0;
      if (f.spawned && !mine.some((o) => o.mode !== 'parked' && o.mode !== 'landed') && !soldiers && this.h - f.t0 > 0.1) this.endWave(f, true);
      // (au bout de 4 heures, la flotte se retire)
      else if (this.h - f.t0 > 4) this.endWave(f, false);
    }
  }
  // Le butin du croiseur : ses coffres se remplissent
  loot(s) {
    for (const [k, id] of s.blocks) {
      if (id !== CHEST) continue;
      const B = this.g.containers.atStruct?.(s, k);
      if (B) for (const [it, n] of [[NEDROLYTIUM, 6], [MISSILE_AMMO, 8], [BULLET, 64], [HULL, 64], [BREAD, 12]]) this.g.industry?.insert(B, makeSlot(it, n));
    }
  }
  endWave(f, won) {
    if (f.ph !== 'attack') return;
    for (const [, sh] of this.ships) if (sh.f === f.id && sh.mode !== 'parked' && sh.mode !== 'landed') sh.mode = 'retreat';
    f.spawned = false;
    if (won) {
      f.repelled++;
      f.tech = Math.max(20, f.tech - 15);
      f.pop = Math.max(2, f.pop * 0.8);
      if (!f.colonies.some((C) => C.alive)) { this.crushed(f); return; }
      if (f.repelled >= 3) {
        f.ph = 'peace';
        this.g.chat(`🕊 Épuisée par trois défaites, la ${f.name} demande une trêve. ${f.leader} jure de ne plus attaquer Hexa.`, 'sys');
        this.g.onEnd?.('peace', f);
        return;
      }
      this.g.chat(`Vague repoussée ! La ${f.name} se replie sur ${f.colonies.filter((C) => C.alive).map((C) => BODY[C.body]?.name).join(', ')}. Détruis ses chargeurs de chunks pour en finir.`, 'sys');
    } else {
      this.g.chat(f.motive === 'conquest' ? `Les Croisés se retirent, persuadés d'avoir conquis un morceau du royaume du Dieu.` : `Les rebelles se retirent, victorieux... pour cette fois.`, 'sys');
    }
    f.ph = 'hidden';
    f.next = this.h + this.delay * 0.75;
  }

  // ---------- Commande /rebellion ----------
  command(args) {
    const sub = (args[0] || '').toLowerCase(), out = [];
    const say = (t, k = 'sys') => out.push({ text: t, kind: k });
    if (!sub || sub === 'etat' || sub === 'état' || sub === 'status') {
      say(`Rébellions : ${this.on ? 'activées' : 'désactivées'} ; première attaque ${this.delay} h de jeu après l'exode (une heure = 75 s).`);
      for (const V of this.colony.villages.values()) {
        if (V.rebel || V.gone || !this.evolved(V)) continue;
        const m = this.moodOf(V), ad = this.adults(V), name = this.me();
        const avg = ad.reduce((s, a) => s + this.talk.opinion(a, name), 0) / Math.max(1, ad.length);
        say(`  ${this.vName(V)} (${ad.length} adultes) : ${this.g.creative() ? 'ferveur ' + Math.round(m.f / FERVOR_MAX * 100) + ' %' : 'avis ' + Math.round(avg) + (m.g > 0 ? ', haine ' + Math.round(m.g * 100) + ' %' : '')}${m.plot ? ' — complote' : ''}`);
        { const n = this.rocketNeeds(V); say(`    fusée : ${n.homes}/${ROCKET_HOMES} maisons, ${n.pop}/${ROCKET_POP} habitants${this.canRocket(V) ? ' (de quoi partir)' : ''}${this.moodOf(V).wait ? ', attend sa fusée pour partir' : ''}`); }
      }
      for (const f of this.factions) {
        const PH = { plot: f.motive === 'pioneer' ? 'préparent leur départ' : 'complot', hidden: 'cachée', attack: 'à l\'attaque', peace: 'en trêve', crushed: 'écrasée', ally: 'alliée' };
        say(`  ${f.name} (${PH[f.ph]}) : ${Math.round(f.pop)} habitants, technologie ${Math.round(f.tech)} %, vague ${f.wave}${f.ph === 'hidden' ? ', attaque dans ' + Math.max(0, f.next - this.h).toFixed(1) + ' h' : ''}`);
        if (f.raid) { const V = this.colony.villages.get(f.raid.vk); say(`    raid en cours sur ${V ? this.vName(V) : '?'}`); }
        if (f.spy) { const V = this.colony.villages.get(f.spy.vk); say(`    espion : à ${V ? this.vName(V) : '?'} (${f.spy.n} émission(s), ${f.intel || 0} chasseur(s) de plus à la prochaine attaque)`); }
        if (f.trib) say(`    tribut : ${f.paid || 0} lingots versés (trêve à ${f.truceAt}, paix à ${PEACE}) — coffre au puits (q ${f.trib[0]}, r ${f.trib[1]})`);
        say(`    flotte : ${Math.floor(f.fleet.fighter)} chasseurs, ${Math.floor(f.fleet.habitat)} habitats, ${Math.floor(f.fleet.cargo)} cargos, ${Math.floor(f.fleet.cruiser)} croiseurs`);
        for (const C of f.colonies) say(`    ${C.alive ? '●' : '✕'} ${C.name} sur ${BODY[C.body]?.name} (x ${C.x}, z ${C.z})${C.built ? ', visitée' : ''}`);
      }
      return out;
    }
    if (sub === 'on' || sub === 'off') { this.on = sub === 'on'; if (!this.on) this.hudOut(null); say(`Rébellions ${this.on ? 'activées' : 'désactivées'} dans ce monde`); this.g.world.changed = true; return out; }
    if (sub === 'delai' || sub === 'délai') {
      const h = Number(args[1]);
      if (!(h >= 0.2 && h <= 200)) { say('/rebellion delai <heures> (0,2 à 200)', 'err'); return out; }
      this.delay = h; for (const f of this.factions) if (f.ph === 'hidden') f.next = Math.min(f.next, this.h + h);
      say(`Attaque ${h} h de jeu après l'exode`); return out;
    }
    if (sub === 'complot' || sub === 'force') {
      const { player } = this.g;
      let best = null, bd = Infinity;
      for (const V of this.colony.villages.values()) { if (V.rebel || V.gone || this.moodOf(V).plot) continue; const d = Math.hypot(V.x - player.pos.x, V.z - player.pos.z); if (d < bd) { bd = d; best = V; } }
      if (!best) { say('Aucun village à proximité', 'err'); return out; }
      const f = this.startPlot(best, this.g.creative() ? 'conquest' : 'rebellion');
      if (f) f.forced = true;
      if (f && args[1] === 'maintenant') { f.t0 = this.h - PLOT_H * 1.01; }
      say(`${best.rname || this.vName(best)} complote (à ${Math.round(bd)} blocs)`);
      if (!this.canRocket(best)) { const n = this.rocketNeeds(best); say(`(forcé : en jeu normal, il faudrait ${ROCKET_HOMES} maisons et ${ROCKET_POP} habitants pour la fusée ; ce village en a ${n.homes} et ${n.pop})`); }
      return out;
    }
    if (sub === 'pionniers' || sub === 'pioneers') {
      const { player } = this.g;
      let best = null, bd = Infinity;
      for (const V of this.colony.villages.values()) { if (V.rebel || V.gone || this.moodOf(V).plot) continue; const d = Math.hypot(V.x - player.pos.x, V.z - player.pos.z); if (d < bd) { bd = d; best = V; } }
      if (!best) { say('Aucun village à proximité', 'err'); return out; }
      const f = this.startPlot(best, 'pioneer');
      if (f) { f.forced = true; this.moodOf(best).sent = true; }
      if (f && args[1] === 'maintenant') { f.t0 = this.h - PLOT_H * 1.01; }
      say(`${best.rname || this.vName(best)} prépare un départ de pionniers (à ${Math.round(bd)} blocs)`);
      return out;
    }
    if (sub === 'exode') {
      const f = this.factions.find((x) => x.ph === 'plot');
      if (!f) { say('Aucun complot en cours (/rebellion complot)', 'err'); return out; }
      const V = this.colony.villages.get(f.vk);
      if (V) this.exodus(f, V);
      return out;
    }
    if (sub === 'attaque' || sub === 'attack') {
      const f = this.factions.find((x) => x.ph === 'hidden');
      if (!f) { say('Aucune faction cachée prête (exode d\'abord)', 'err'); return out; }
      f.next = this.h;
      this.simulate(f, 0);
      return out;
    }
    if (sub === 'avance') {
      const h = Number(args[1]) || 4;
      for (const f of this.factions) if (f.ph === 'hidden' || f.ph === 'ally') { this.simulate(f, h); } // (les pionniers aussi)
      this.h += h;
      say(`La rébellion avance de ${h} h`);
      return out;
    }
    if (sub === 'fin' || sub === 'stop') {
      for (const [id] of this.ships) { const s = this.g.structs.byId(id); if (s) this.g.structs.remove(s); }
      this.ships.clear();
      this.g.animals.list = this.g.animals.list.filter((a) => a.type !== 'rebel');
      this.factions = []; this.mood.clear(); this.hudOut(null);
      say('Plus aucune rébellion dans ce monde');
      return out;
    }
    say('/rebellion [etat | on | off | delai <h> | complot [maintenant] | pionniers [maintenant] | exode | attaque | avance <h> | fin]');
    return out;
  }

  // ---------- Bandeau de l'attaque (en haut de l'écran) ----------
  renderHud() {
    const f = this.factions.find((x) => x.ph === 'attack');
    if (!f) { this.hudOut(null); return; }
    let cru = null;
    const n = { fighter: 0, habitat: 0, cargo: 0 };
    for (const [id, sh] of this.ships) {
      if (sh.f !== f.id) continue;
      if (sh.kind === 'cruiser') { const s = this.g.structs.byId(id); if (s) cru = { name: sh.name, hp: Math.max(0, (s.list.length / sh.n0 - DIE_AT.cruiser) / (1 - DIE_AT.cruiser)) }; }
      else if (n[sh.kind] !== undefined && sh.mode !== 'retreat') n[sh.kind]++;
    }
    const sold = this.g.animals.list.filter((a) => a.type === 'rebel' && !a.dead).length;
    const allies = [...this.ships.values()].filter((o) => o.ally && o.mode !== 'parked' && o.mode !== 'retreat').length;
    this.hudOut({ title: f.name + ' — vague ' + f.wave, cru, line: `${n.fighter} chasseurs · ${n.habitat} habitats · ${n.cargo} cargos · ${sold} soldats${allies ? ' · 🛡 ' + allies + ' alliés' : ''}` });
  }
  // (hôte : le bandeau est aussi envoyé aux invités, quand il change, et toutes les 5 s pour les nouveaux venus)
  hudOut(d) {
    this.showHud(d);
    const net = this.g.net;
    if (net.mode !== 'host') return;
    const k = JSON.stringify(d);
    if (k === this.hudSent && ((this.hudN = (this.hudN || 0) + 1) % 10)) return;
    this.hudSent = k;
    net.broadcastJoined({ t: 'rhud', d });
  }
  showHud(d) {
    if (typeof document === 'undefined') return;
    if (!d || typeof d !== 'object') { if (this.hud) this.hud.style.display = 'none'; return; }
    const esc = (t) => String(t ?? '').slice(0, 120).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]); // (reçu de l'hôte)
    if (!this.hud) {
      const e = this.hud = document.createElement('div');
      e.id = 'rebel-hud';
      e.style.cssText = 'position:fixed;top:54px;left:50%;transform:translateX(-50%);z-index:30;pointer-events:none;min-width:320px;max-width:90vw;padding:6px 12px;border-radius:6px;background:rgba(30,6,8,0.72);border:1px solid #b3242c;color:#ffd8d4;font:13px/1.35 sans-serif;text-align:center;text-shadow:0 1px 2px #000';
      document.body.appendChild(e);
    }
    const hp = Math.max(0, Math.min(1, Number(d.cru?.hp) || 0));
    const bar = d.cru ? `<div style="margin:4px 0 2px">Croiseur « ${esc(d.cru.name)} »</div><div style="height:7px;background:#3a1012;border-radius:4px;overflow:hidden"><div style="height:100%;width:${Math.round(hp * 100)}%;background:#e0303a"></div></div>` : '';
    this.hud.innerHTML = `<b style="color:#ff6a5a">⚠ ${esc(d.title)}</b>${bar}<div style="opacity:.85;margin-top:3px">${esc(d.line)}</div>`;
    this.hud.style.display = '';
  }

  // ---------- Sauvegarde ----------
  serialize() {
    return {
      on: this.on, delay: this.delay, h: Math.round(this.h * 1000) / 1000, nextId: this.nextId,
      mood: [...this.mood].map(([k, m]) => [k, Math.round(m.g * 1000) / 1000, Math.round(m.f * 10) / 10, m.st, m.plot ? 1 : 0, Math.round((m.l || 0) * 1000) / 1000, m.sent ? 1 : 0, m.wait ? 1 : 0]),
      factions: this.factions,
      ships: [...this.ships],
      gone: [...this.colony.villages.values()].filter((V) => V.gone).map((V) => V.key),
      rebel: [...this.colony.villages.values()].filter((V) => V.rebel).map((V) => [V.key, V.rebel, V.rname || '']),
    };
  }
  load(d) {
    this.clear();
    if (!d || typeof d !== 'object') return;
    this.on = d.on !== false;
    this.delay = Number.isFinite(d.delay) ? d.delay : ATTACK_H;
    this.h = Number.isFinite(d.h) ? d.h : 0;
    this.nextId = Number.isInteger(d.nextId) ? d.nextId : 1;
    for (const e of Array.isArray(d.mood) ? d.mood : []) if (Array.isArray(e) && typeof e[0] === 'string') this.mood.set(e[0], { g: +e[1] || 0, f: +e[2] || 0, st: +e[3] || 0, plot: !!e[4], l: +e[5] || 0, sent: !!e[6], wait: !!e[7] });
    this.factions = (Array.isArray(d.factions) ? d.factions : []).filter((f) => f && Number.isInteger(f.id) && Array.isArray(f.colonies) && f.fleet);
    for (const [id, sh] of Array.isArray(d.ships) ? d.ships : []) {
      const s = this.g.structs.byId(id);
      if (!s || !sh || !PLANS[sh.kind]) continue;
      this.ships.set(id, sh);
      this.g.weapons.setStructTeam(s, sh.ally ? ALLY : TEAM);
      if (sh.kind === 'fighter') s.boost = 3;
      s.vcap = WARP_CAP;
      if (sh.mode !== 'space') this.g.orbital.hold(s, true);
    }
    for (const k of Array.isArray(d.gone) ? d.gone : []) { const V = this.colony.villages.get(k); if (V) V.gone = true; }
    for (const [k, id, n] of Array.isArray(d.rebel) ? d.rebel : []) { const V = this.colony.villages.get(k); if (V) { V.rebel = id; if (n) V.rname = n; } }
  }
}
