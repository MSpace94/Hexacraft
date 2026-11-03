// Industrie : réseau électrique, machines, tapis roulants, bras de transfert, foreuse, quais de
// chargement des trains, pollution et commandes des villages.
//
//  - Réseau : les blocs du réseau (sources, câbles, transformateurs, batteries, machines,
//    tapis, bras, quais) qui se touchent (6 côtés, dessus, dessous) forment un réseau. Ses
//    sources produisent des watts, ses machines en consomment ; une batterie garde le surplus
//    et le rend quand il manque. Sans assez de courant, tout tourne plus lentement.
//    Les câbles perdent du courant au-delà de CABLE_FREE câbles ; chaque transformateur en
//    porte TRANSFO_RANGE de plus sans perte.
//  - Sources : dynamo (40 W par chaudière allumée qui la touche), éolienne (plus haut et dans
//    la tempête, plus fort), roue à aubes (l'eau qui coule autour d'elle).
//  - Machines (inventaire comme le four, voir containers.js) : chaudière (brûle du
//    combustible), concasseur, laminoir, haut fourneau (combustible, entre deux briques
//    réfractaires), foreuse (creuse la colonne sous elle).
//  - Tapis (comme ceux du mod Create) : une bande tendue entre deux arbres de transmission
//    alignés (20 cases au plus, à plat ou en pente d'une marche par case), qui va du premier
//    arbre cliqué vers le second (un levier allumé contre une poulie inverse le sens). Il porte
//    plusieurs piles à la fois, qui glissent en continu à une case l'une de l'autre ; au bout,
//    elles passent sur le tapis suivant, entrent dans le coffre / four / machine / wagon, ou
//    tombent par terre (dans un carton). Un carton qui tombe dessus est emporté, le joueur aussi.
//    Les machines posent ce qu'elles produisent sur un tapis qui passe contre elles.
//  - Bras : prend derrière lui (coffre, sortie d'un four ou d'une machine, tapis, wagon) et pose
//    devant lui.
//  - Quais : un train arrêté à côté est chargé depuis les coffres voisins (ou déchargé dedans).
//  - Automatisation (comme le mod Create, à l'électricité) : entonnoirs (rangent dans un coffre ce
//    qui passe derrière eux) et extracteurs (sortent d'un coffre), filtrés par un objet ;
//    ventilateur (cuit ou lave ce qui est dans son souffle, selon ce qu'il a derrière lui) ;
//    presse et scie (au-dessus d'un tapis : arrêtent la pile qui passe et la transforment) ;
//    assembleur (fabrique tout seul l'objet choisi) ; répartiteur (renvoie ce qui y entre par ses
//    autres côtés, chacun son tour).
//  - Pollution : chaudières, hauts fourneaux et machines enfument les environs (filtres et
//    cheminées la réduisent) : feuilles salies, animaux qui fuient, villageois mécontents.
//  - Commandes : un village qui a une gare commande des produits, à livrer par train.
// Tout se calcule chez l'hôte (en ligne, les autres voient les blocs changer).
import * as THREE from 'three';
import { NEIGHBORS, hexToWorld, worldToHex, cellKey } from './hex.js?v=1.1.5-alpha-mw17vbxj';
import {
  BLOCKS, ITEMS, AIR, SOLID, makeSlot, isWater, IRON_ORE, PLATINUM_ORE, TUNGSTEN_ORE, FLUORITE_ORE, CRIMSONITE_ORE, VOLTITE_ORE, VOLTITE,
  IMPURE_VOLTITE_ORE, IMPURE_VOLTITE, GRAVEL, COAL, IRON_INGOT, STEEL, DARK_STEEL, IRON_BLOCK, RAIL, TRAIN_RAIL, CRIMSONITE_PICKAXE, isPowerBlock,
  BOILER, BOILER_ON, DYNAMO, WIND_TURBINE, WATER_WHEEL, CABLE, TRANSFORMER, BATTERY_BLOCK, CRUSHER, BLAST_FURNACE, BLAST_FURNACE_ON, FIREBRICK,
  ROLLING_MILL, DRILL, LOADER, UNLOADER, SMOKE_FILTER, FACTORY_CHIMNEY, CORRUGATED, isBelt, isArm,
  SHAFT, isShaft, conveyorId, LEVER_ON, OPAQUE, MAGMA, isLog, isLava,
} from './blocks.js?v=1.1.5-alpha-mw17vbxj';
import { SMELT, FUEL, CHEST_SLOTS } from './containers.js?v=1.1.5-alpha-mw17vbxj';
import { Y_MIN } from './world.js?v=1.1.5-alpha-mw17vbxj';

const TICK = 0.1;           // pas de calcul (secondes)
const AROUND = [...NEIGHBORS.map(([q, r]) => [q, r, 0]), [0, 0, 1], [0, 0, -1]];
const key = (q, r, y) => q + ',' + r + ',' + y;
const parse = (k) => k.split(',').map(Number);
const stackMax = (id) => ITEMS[id]?.stack ?? 64;

// ---------- Réglages ----------
export const DYNAMO_W = 40;          // par chaudière allumée qui touche la dynamo (3 au plus)
export const BATTERY_J = 60000;      // énergie d'une batterie (joules)
const BATTERY_W = 120;               // puissance d'une batterie (charge, décharge)
const CABLE_FREE = 64, TRANSFO_RANGE = 256;
// consommation des machines au travail (watts)
export const USE_W = { crusher: 20, mill: 30, drill: 40, belt: 1, arm: 3, dock: 5, funnel: 2, fan: 12, press: 10, saw: 10, assembler: 15, splitter: 1 };
export const WORK_TIME = { crusher: 4, mill: 5, blast: 4, drill: 2.5 };  // secondes par objet
const BELT_SPEED = 1.6;              // cases par seconde
const BELT_MAX = 20;                 // longueur d'un tapis (cases, poulies comprises)
const BELT_GAP = 1;                  // écart entre deux piles sur un tapis (cases)
const ARM_TIME = 0.8, ARM_TAKE = 16; // un mouvement de bras : temps, objets au plus
const DOCK_TIME = 0.5, DOCK_TAKE = 32;
const FUNNEL_TIME = 0.25, FUNNEL_TAKE = 16; // entonnoir, extracteur : un mouvement, objets au plus
const FAN_RANGE = 6, FAN_TIME = 1.5;          // souffle du ventilateur (cases), temps pour traiter une pile
const STATION_TIME = { press: 1.2, saw: 1 }; // presse, scie : secondes par pile
const ASSEMBLE_TIME = 2;                    // assembleur : secondes par objet fabriqué

// Ce que font les machines : entrée -> [sortie, nombre]
export const CRUSH = {
  [IRON_ORE]: [3850, 2], [PLATINUM_ORE]: [3851, 2], [TUNGSTEN_ORE]: [3852, 2], [FLUORITE_ORE]: [3853, 2], [CRIMSONITE_ORE]: [3854, 2],
  [VOLTITE_ORE]: [VOLTITE, 5], [IMPURE_VOLTITE_ORE]: [IMPURE_VOLTITE, 6], 30: [COAL, 3], 3: [28, 1], 28: [GRAVEL, 1], [GRAVEL]: [8, 1],
};
export const ROLL = { [IRON_INGOT]: [RAIL, 4], [STEEL]: [462, 3], 462: [CORRUGATED, 2], [DARK_STEEL]: [TRAIN_RAIL, 4], [IRON_BLOCK]: [462, 6] };
export const BLAST = { [IRON_ORE]: [STEEL, 6], [IRON_INGOT]: [STEEL, 6], 3850: [STEEL, 4], [STEEL]: [DARK_STEEL, 1] };
const RECIPES = { crusher: CRUSH, mill: ROLL, blast: BLAST };
// Lavage (ventilateur devant de l'eau) : entrée -> [sortie, nombre]
export const WASH = { [GRAVEL]: [3850, 1], 8: [603, 1] };
// (les poussières fondent au four : un lingot chacune)
Object.assign(SMELT, { 3850: IRON_INGOT, 3851: 130, 3852: 131, 3853: 644, 3854: 645 });

// Ce qu'une machine accepte dans son entrée / son combustible
// Les pièces d'un modèle (des dizaines de plaques) fondues en un maillage par matière : une
// éolienne, une roue à aubes ne coûtent que quelques dessins au lieu d'une quarantaine. Fait une
// fois par modèle (key), les géométries sont partagées par tous.
const baked = new Map();
function bake(group, key) {
  let parts = baked.get(key);
  if (!parts) {
    group.updateMatrixWorld(true);
    const inv = group.matrixWorld.clone().invert(), by = new Map();
    group.traverse((o) => {
      if (!o.isMesh) return;
      const g = o.geometry.clone().applyMatrix4(inv.clone().multiply(o.matrixWorld));
      if (!by.has(o.material)) by.set(o.material, []);
      by.get(o.material).push(g.index ? g.toNonIndexed() : g);
    });
    parts = [...by].map(([mat, list]) => {
      const pos = [], nor = [];
      for (const g of list) { pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array); }
      const out = new THREE.BufferGeometry();
      out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      out.computeBoundingSphere();
      return [out, mat];
    });
    baked.set(key, parts);
  }
  group.clear();
  for (const [g, mat] of parts) group.add(new THREE.Mesh(g, mat));
  return group;
}

// Rotor d'éolienne : un moyeu et trois pales, chacune une rangée de plaques hexagonales de plus en
// plus petites (le bout en rouge). Axe du rotor : z local
let rotorParts = null;
function rotorModel() {
  if (!rotorParts) {
    const plate = new THREE.CylinderGeometry(1, 1, 1, 6);
    plate.rotateX(Math.PI / 2); // (prisme couché : sa face hexagonale vers l'avant)
    rotorParts = {
      plate,
      white: new THREE.MeshLambertMaterial({ color: '#e9eaee' }),
      red: new THREE.MeshLambertMaterial({ color: '#c8392b' }),
      grey: new THREE.MeshLambertMaterial({ color: '#7a7f88' }),
    };
  }
  const P = rotorParts, root = new THREE.Group(), blades = new THREE.Group();
  const hex = (mat, r, len, x, y, z) => {
    const m = new THREE.Mesh(P.plate, mat);
    m.scale.set(r, r, len);
    m.position.set(x, y, z);
    return m;
  };
  blades.add(hex(P.grey, 0.11, 0.2, 0, 0, 0));
  for (let k = 0; k < 3; k++) {
    const blade = new THREE.Group();
    blade.rotation.z = (k * Math.PI * 2) / 3;
    // (plaques serrées : elles se chevauchent en une pale pleine, large au pied, fine au bout)
    for (let i = 0; i < 13; i++) {
      const f = i / 12, r = 0.1 - f * 0.065;
      blade.add(hex(i >= 11 ? P.red : P.white, r, 0.035, (1 - f) * 0.025, 0.14 + i * 0.062, 0));
    }
    blades.add(blade);
  }
  root.add(bake(blades, 'rotor'));
  blades.position.z = 0.28;
  root.add(hex(P.grey, 0.07, 0.22, 0, 0, 0.13)); // (l'axe, de la nacelle au moyeu)
  root.userData.blades = blades;
  return root;
}

// Roue à aubes : deux jantes de plaques hexagonales, des rayons, et des aubes (barres
// hexagonales d'une jante à l'autre). Axe de la roue : x local ; elle s'étend vers z local
function wheelModel() {
  rotorModel(); // (les pièces partagées)
  const P = rotorParts;
  P.wood ||= new THREE.MeshLambertMaterial({ color: '#8a5a32' });
  P.dark ||= new THREE.MeshLambertMaterial({ color: '#5e3c1f' });
  if (!P.bar) { P.bar = new THREE.CylinderGeometry(1, 1, 1, 6); P.bar.rotateZ(Math.PI / 2); } // (prisme couché le long de x)
  const root = new THREE.Group(), wheel = new THREE.Group();
  const part = (geo, mat, r, len, x, y, z) => {
    const m = new THREE.Mesh(geo, mat);
    m.scale.set(len, r, r);
    m.position.set(x, y, z);
    wheel.add(m);
  };
  const R = 0.5, N = 10;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
    // aube : une barre d'une jante à l'autre, un peu en dehors
    part(P.bar, P.wood, 0.075, 0.36, 0, ca * (R + 0.04), sa * (R + 0.04));
    // jantes : une plaque de chaque côté
    for (const x of [-0.16, 0.16]) part(P.bar, P.dark, 0.06, 0.04, x, ca * R, sa * R);
  }
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4, ca = Math.cos(a), sa = Math.sin(a);
    for (let j = 1; j < 6; j++) for (const x of [-0.16, 0.16]) part(P.bar, P.dark, 0.035, 0.04, x, ca * R * (j / 6), sa * R * (j / 6));
  }
  part(P.bar, P.grey, 0.07, 0.46, 0, 0, 0); // (l'axe)
  root.add(bake(wheel, 'wheel'));
  root.userData.blades = wheel;
  root.userData.wheel = true;
  return root;
}

// Pales du ventilateur (devant lui ; axe : z local)
const steelMat = () => new THREE.MeshLambertMaterial({ color: 0x9aa0a8 });
function fanModel() {
  const root = new THREE.Group(), blades = new THREE.Group(), mat = steelMat();
  for (let i = 0; i < 4; i++) {
    const arm = new THREE.Group(), b = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.1, 0.015), mat);
    b.position.x = 0.19;
    b.rotation.x = 0.45;
    arm.rotation.z = (i * Math.PI) / 2;
    arm.add(b);
    blades.add(arm);
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.06, 6), new THREE.MeshLambertMaterial({ color: 0x2a2d33 }));
  hub.rotation.x = Math.PI / 2;
  blades.add(hub);
  root.add(blades);
  root.userData.blades = blades;
  root.userData.fan = true;
  return root;
}
// Tête de la presse (sous elle, elle descend sur la pile) ; lame de la scie (verticale, dans le
// sens du tapis : axe z local)
function stationModel(kind) {
  const root = new THREE.Group(), part = new THREE.Group();
  if (kind === 'press') {
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.1, 6), new THREE.MeshLambertMaterial({ color: 0xb0b6be }));
    head.position.y = -0.05;
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.4, 6), new THREE.MeshLambertMaterial({ color: 0x5a5e66 }));
    rod.position.y = 0.2;
    part.add(head, rod);
  } else {
    const blade = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.02, 16), steelMat());
    blade.rotation.x = Math.PI / 2;
    const teeth = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.012, 8), new THREE.MeshLambertMaterial({ color: 0xe8eaec }));
    teeth.rotation.x = Math.PI / 2;
    part.add(blade, teeth);
  }
  root.add(part);
  root.userData.part = part;
  root.userData.station = kind;
  return root;
}

export function machineAccepts(kind, id, fuel) {
  if (fuel) return (kind === 'boiler' || kind === 'blast') && !!FUEL[id];
  return !!RECIPES[kind]?.[id];
}

// Commandes des villages : [objet, nombre, lingots de fer donnés]
const ORDERS = [[STEEL, 32, 12], [462, 16, 10], [TRAIN_RAIL, 32, 14], [CORRUGATED, 24, 10], [3850, 32, 8], [COAL, 48, 8], [RAIL, 48, 9], [DARK_STEEL, 16, 12]];
const ORDER_RANGE = 64;      // une gare à moins de 64 blocs du village
const ORDER_PAUSE = 120;     // secondes entre deux commandes d'un village

// Pollution : une valeur par carré de POL_CELL blocs
const POL_CELL = 16;
const POL_SRC = { boiler: 1, blast: 2, crusher: 0.4, mill: 0.4, drill: 0.6 };
const POL_WIND = 1.2;   // blocs par seconde (vent calme) : la fumée suit les nuages
const POL_SPREAD = 0.03; // part qui s'étale chez les voisines (par seconde)
const POL_SICK = 30;    // au-delà : les animaux tombent malades
const POL_BLIGHT = 25;  // au-delà : l'herbe, les fleurs et les feuilles meurent
// (cellKey : 24 bits signés pour chaque coordonnée)
const unCell = (k) => [((Math.floor(k / 16777216)) << 8) >> 8, ((k % 16777216) << 8) >> 8];

export class Industry {
  constructor(world, containers) {
    this.world = world;
    this.containers = containers;
    this.nodes = new Map();     // "q,r,y" -> id : tous les blocs industriels connus
    this.belts = new Map();     // tapis (clé de sa première case) -> voir syncBelts
    this.cellBelt = new Map();  // case d'un tapis -> son tapis
    this.beltsDirty = true;
    this.broken = [];           // [tapis, case cassée] : à défaire au prochain pas
    this.savedBelts = new Map(); // (sens et objets des tapis, lus dans la sauvegarde)
    this.timers = new Map();    // bras, quais -> secondes depuis leur dernier mouvement
    this.config = new Map();    // entonnoir, extracteur, bras -> filtre ; assembleur -> ce qu'il fabrique (ids)
    this.turn = new Map();      // répartiteur -> le côté par où sortira la prochaine pile
    this.fans = new Map();      // ventilateur -> { mode, n } (son dernier souffle)
    this.pressing = new Set();  // presses et scies qui tiennent une pile
    this.recipes = null;        // (voir main.js) les recettes de l'établi : l'assembleur, la scie
    this.nameOf = (id) => BLOCKS[id]?.name || ITEMS[id]?.name || '?';
    this.cartons = null;        // (voir cartons.js) : un carton posé sur un tapis est emporté
    this.onSpill = null;        // (pile, position, vitesse) : une pile tombe au bout d'un tapis
    this.modelOf = null;        // id -> modèle 3D (voir held.js) : les objets posés sur les tapis
    this.models = new Map();
    this.energy = new Map();    // batterie -> joules
    this.nets = [];             // réseaux (recalculés quand un bloc du réseau change)
    this.netOf = new Map();     // bloc -> réseau
    this.dirty = true;
    this.clock = 0;
    this.slow = 0;
    this.pollution = new Map(); // cellule -> valeur
    this.orders = new Map();    // village -> commande { item, n, reward, station, name, at }
    this.orderWait = new Map(); // village -> secondes avant la prochaine commande
    this.trains = null;         // (voir main.js) trains, gares, villages, animaux...
    this.tracks = null;
    this.colony = null;
    this.animals = null;
    this.windAt = () => ({ storm: 0, rain: 0 });
    this.onSmoke = null;        // (x, y, z, épaisseur) : fumée d'une cheminée
    this.onOrder = null;        // (texte) : une commande livrée, une nouvelle commande
    this.onComplain = null;     // (villageois) : il se plaint de la fumée
    this.pseudo = () => '';
    this.dropOf = null;         // ce que donne un bloc cassé (voir survival.js)
    this.group = new THREE.Group(); // bandes des tapis et leurs objets, rotors
    this.rotors = new Map();     // (clé -> rotor d'éolienne, voir animate)
    this.windDir = null;         // () => { x, y } : d'où souffle le vent (les nuages, voir weather.js)
    this.iconOf = null;         // id -> canvas (voir main.js)
    this.mats = new Map();
    this.smog = Array.from({ length: 8 }, () => new THREE.Vector4());
    // (en ligne, chez un invité : l'usine tourne chez l'hôte, on n'affiche que ce qu'il envoie)
    this.remote = false;
    this.uid = 0;               // (numéro des piles sur les tapis : l'invité les suit d'un envoi à l'autre)
    this.speeds = new Map();    // (invité) pales, têtes de machine -> [vitesse, au travail]
    this.snapT = 0;             // (invité) secondes depuis le dernier envoi de l'hôte
    this.remoteText = new Map(); // (invité) wattmètre : case -> { at, txt } (le texte vient de l'hôte)
  }

  // ---------- Registre ----------
  // Un bloc du monde a changé
  onBlock(q, r, y, id, old) {
    const k = key(q, r, y);
    if (isIndustrial(id)) this.nodes.set(k, id);
    else if (this.nodes.has(k)) this.nodes.delete(k);
    if (isPowerBlock(id) || isPowerBlock(old) || id === BOILER || id === BOILER_ON || old === BOILER || old === BOILER_ON) this.dirty = true;
    // une case de tapis cassée : tout le tapis se défait (voir unbuild)
    if (isBelt(old) && !isBelt(id)) {
      const B = this.cellBelt.get(k);
      if (B && !B.gone && !this.remote) { B.gone = true; this.broken.push([B, k]); }
    }
    if (isBelt(id) || isBelt(old)) this.beltsDirty = true;
    if (old === BATTERY_BLOCK && id !== BATTERY_BLOCK) this.energy.delete(k);
    if (!BLOCKS[id]?.filter && !BLOCKS[id]?.assembler) this.config.delete(k);
  }

  // Monde chargé : les blocs industriels posés par les joueurs (ils sont dans les modifications)
  scan(mods, CS, DEEP) {
    this.nodes.clear();
    for (const [ck, m] of mods) {
      const [cq, cr] = ck.split(',').map(Number);
      for (const [i, id] of m) {
        if (!isIndustrial(id)) continue;
        const lq = i % CS, lr = Math.floor(i / CS) % CS, y = Math.floor(i / (CS * CS)) - DEEP;
        this.nodes.set(key(cq * CS + lq, cr * CS + lr, y), id);
      }
    }
    this.dirty = true;
    this.beltsDirty = true;
  }

  clear() {
    for (const B of this.belts.values()) this.hideBelt(B);
    this.nodes.clear(); this.belts.clear(); this.cellBelt.clear(); this.energy.clear(); this.nets = []; this.netOf.clear();
    this.broken = []; this.savedBelts.clear(); this.timers.clear(); this.beltsDirty = true;
    this.config.clear(); this.turn.clear(); this.fans.clear(); this.pressing.clear(); this.speeds.clear(); this.remoteText.clear();
    this.pollution.clear(); this.orders.clear(); this.orderWait.clear(); this.dirty = true;
    for (const m of this.rotors.values()) this.group.remove(m);
    this.rotors.clear();
  }

  get(q, r, y) { return this.world.getBlock(q, r, y); }
  loaded(q, r) { return this.world.isLoaded(q, r); }

  // ---------- Réseaux ----------
  rebuild() {
    this.dirty = false;
    // (énergie des batteries : gardée par batterie, répartie à nouveau dans chaque réseau)
    this.nets = [];
    this.netOf.clear();
    for (const [k, id] of this.nodes) {
      if (!isPowerBlock(id) || this.netOf.has(k)) continue;
      const net = { members: [], gens: [], users: [], stores: [], cables: 0, transfos: 0, prod: 0, demand: 0, ratio: 0, stored: 0, cap: 0, flow: 0 };
      const stack = [k];
      this.netOf.set(k, net);
      while (stack.length) {
        const c = stack.pop(), cid = this.nodes.get(c);
        net.members.push(c);
        const P = BLOCKS[cid]?.power;
        if (P === 'gen') net.gens.push(c);
        else if (P === 'use') net.users.push(c);
        else if (P === 'store') net.stores.push(c);
        if (cid === CABLE) net.cables++;
        if (cid === TRANSFORMER) net.transfos++;
        const [q, r, y] = parse(c);
        for (const [dq, dr, dy] of AROUND) {
          const n = key(q + dq, r + dr, y + dy);
          if (this.netOf.has(n) || !isPowerBlock(this.nodes.get(n))) continue;
          this.netOf.set(n, net);
          stack.push(n);
        }
      }
      for (const s of net.stores) { if (!this.energy.has(s)) this.energy.set(s, 0); net.stored += this.energy.get(s); }
      net.cap = net.stores.length * BATTERY_J;
      this.nets.push(net);
    }
  }

  // Watts produits par une source
  genPower(q, r, y, id) {
    if (id === DYNAMO) {
      let n = 0;
      for (const [dq, dr, dy] of AROUND) if (this.get(q + dq, r + dr, y + dy) === BOILER_ON) n++;
      return DYNAMO_W * Math.min(3, n);
    }
    if (id === WIND_TURBINE) {
      // (plus haut : plus de vent ; la pluie, et surtout l'orage, le renforcent)
      const c = hexToWorld(q, r), w = this.windAt(c.x, c.z);
      const base = 6 + Math.max(0, Math.min(24, (y - 64) * 0.6));
      return Math.round(base * (1 + (w.storm || 0) * 1.5 + (w.rain || 0) * 0.3));
    }
    if (id === WATER_WHEEL) {
      // l'eau autour : 8 W par case d'eau qui coule, 2 W par eau dormante
      let w = 0;
      for (const [dq, dr, dy] of AROUND) {
        const n = this.get(q + dq, r + dr, y + dy);
        if (isWater(n)) w += n >= 9 && n <= 15 ? 8 : 2;
      }
      return Math.min(40, w);
    }
    return 0;
  }

  // Watts demandés par un consommateur (au travail)
  usePower(k, id) {
    const B = BLOCKS[id];
    if (B.belt) return USE_W.belt;
    if (B.arm) return USE_W.arm;
    if (B.dock) return USE_W.dock;
    if (B.funnel) return USE_W.funnel;
    if (B.fan) return USE_W.fan;
    if (B.station) return this.pressing.has(k) ? USE_W[B.station] : 0;
    if (B.assembler) return this.config.has(k) ? USE_W.assembler : 0;
    if (B.splitter) return USE_W.splitter;
    if (B.machine) {
      const box = this.boxAt(k);
      return box && this.busy(k, B.machine, box) ? USE_W[B.machine] : 0;
    }
    return 0;
  }

  power(dt) {
    for (const net of this.nets) {
      let prod = 0, demand = 0;
      for (const k of net.gens) { const [q, r, y] = parse(k); if (this.loaded(q, r)) prod += this.genPower(q, r, y, this.nodes.get(k)); }
      for (const k of net.users) { const [q, r] = parse(k), id = this.nodes.get(k); if (id && this.loaded(q, r)) demand += this.usePower(k, id); }
      // (trop de câbles : une partie du courant se perd en route)
      const reach = CABLE_FREE + TRANSFO_RANGE * net.transfos;
      net.eff = net.cables > reach ? reach / net.cables : 1;
      prod *= net.eff;
      net.prod = prod; net.demand = demand;
      const rate = BATTERY_W * net.stores.length;
      if (prod >= demand) {
        net.ratio = demand > 0 ? 1 : prod > 0 ? 1 : 0;
        const charge = Math.min(prod - demand, rate) * dt;
        net.flow = charge / dt;
        net.stored = Math.min(net.cap, net.stored + charge);
      } else {
        const draw = Math.min(demand - prod, rate, net.stored / dt);
        net.stored -= draw * dt;
        net.flow = -draw;
        net.ratio = demand > 0 ? (prod + draw) / demand : 0;
      }
      // (l'énergie, répartie entre les batteries du réseau)
      const each = net.stores.length ? net.stored / net.stores.length : 0;
      for (const s of net.stores) this.energy.set(s, each);
    }
  }

  ratioAt(k) { return this.netOf.get(k)?.ratio || 0; }

  // ---------- Inventaires ----------
  boxAt(k) { const [q, r, y] = parse(k); return this.containers.at(q, r, y); }

  // La machine a-t-elle du travail ?
  busy(k, kind, box) {
    if (kind === 'drill') return !box.done && (!box.output || box.output.n < stackMax(box.output.id));
    const rec = RECIPES[kind]?.[box.input?.id];
    if (!rec) return false;
    return !box.output || (box.output.id === rec[0] && box.output.n + rec[1] <= stackMax(rec[0]));
  }

  // Range la pile s dans le contenu c (coffre, four, machine) ; renvoie le nombre qui reste
  insert(c, s, kind = null) {
    if (!c || !s) return s ? s.n : 0;
    let n = s.n;
    const put = (field) => {
      const cur = c[field], max = stackMax(s.id);
      if (!cur) { const k = Math.min(max, n); c[field] = makeSlot(s.id, k, s.w); n -= k; }
      else if (cur.id === s.id) { const k = Math.min(max - cur.n, n); cur.n += k; n -= k; }
    };
    if (c.type === 'chest') {
      const max = stackMax(s.id);
      for (let i = 0; i < c.slots.length && n > 0; i++) { const t = c.slots[i]; if (t && t.id === s.id && t.n < max) { const k = Math.min(max - t.n, n); t.n += k; n -= k; } }
      for (let i = 0; i < c.slots.length && n > 0; i++) if (!c.slots[i]) { const k = Math.min(max, n); c.slots[i] = makeSlot(s.id, k, s.w); n -= k; }
    } else if (c.type === 'furnace') {
      if (SMELT[s.id] !== undefined) put('input');
      else if (FUEL[s.id]) put('fuel');
    } else if (c.type === 'machine') {
      if (machineAccepts(kind, s.id, false)) put('input');
      else if (machineAccepts(kind, s.id, true)) put('fuel');
    }
    return n;
  }

  // Ce qu'on peut prendre dans c (au plus max) : { id, n, w } retiré du contenu, ou null
  take(c, max) {
    if (!c) return null;
    const cut = (s) => { const n = Math.min(s.n, max); const out = makeSlot(s.id, n, s.w); s.n -= n; return [out, s.n <= 0]; };
    if (c.type === 'chest') {
      for (let i = 0; i < c.slots.length; i++) {
        if (!c.slots[i]) continue;
        const [out, gone] = cut(c.slots[i]);
        if (gone) c.slots[i] = null;
        return out;
      }
      return null;
    }
    if (!c.output) return null;
    const [out, gone] = cut(c.output);
    if (gone) c.output = null;
    return out;
  }

  // Le contenu d'un wagon arrêté (ou presque) tout près du point (x, z) à la hauteur y, ou null
  carBoxNear(x, y, z, R = 1.6) {
    // (les voitures de chaque train : sans fabriquer la liste de toutes les voitures à chaque appel)
    for (const t of this.trains?.trains || []) for (const c of t.cars) {
      if (!c.box || Math.abs(c.train?.v || 0) > 0.3) continue;
      if (Math.hypot(c.pos.x - x, c.pos.z - z) < R + 1.2 && Math.abs(c.pos.y - y) < 2.5) return c.box;
    }
    return null;
  }

  // Le contenu (coffre, four, machine, wagon) à la case (q, r, y), avec la sorte de machine
  holderAt(q, r, y) {
    const id = this.get(q, r, y), B = BLOCKS[id];
    if (B?.container) return { box: this.containers.at(q, r, y), kind: B.machine || null };
    if (!SOLID[id]) {
      const c = hexToWorld(q, r), box = this.carBoxNear(c.x, y, c.z);
      if (box) return { box, kind: null };
    }
    return null;
  }

  // ---------- Pas de calcul ----------
  update(dt) {
    this.clock += dt;
    if (this.clock < TICK) return;
    dt = Math.min(0.5, this.clock);
    this.clock = 0;
    // (d'abord les tapis cassés : défaire un tapis change des blocs du réseau)
    for (const [B, k] of this.broken.splice(0)) this.unbuild(B, k);
    if (this.beltsDirty) this.syncBelts();
    if (this.dirty) this.rebuild();
    this.power(dt);
    // (presses et scies arrêtent à nouveau leur pile à chaque pas)
    for (const B of this.belts.values()) for (const it of B.items) it.hold = false;
    this.pressing.clear();
    for (const [k, id] of this.nodes) {
      // (câbles, tapis, batteries, sources : rien à faire à chaque pas ; un réseau peut en compter
      // des milliers)
      const B = BLOCKS[id];
      if (!B.machine && !B.arm && !B.dock && !B.funnel && !B.fan && !B.station && !B.assembler) continue;
      const [q, r, y] = parse(k);
      if (!this.loaded(q, r)) continue;
      // (le bloc a changé sans qu'on le sache : on l'oublie)
      if (this.get(q, r, y) !== id) { this.nodes.delete(k); this.dirty = true; continue; }
      if (B.machine) this.machine(k, q, r, y, id, B.machine, dt);
      else if (B.arm) this.arm(k, q, r, y, id, dt);
      else if (B.dock) this.dock(k, q, r, y, id, dt);
      else if (B.funnel) this.funnel(k, q, r, y, id, dt);
      else if (B.fan) this.fan(k, q, r, y, id, dt);
      else if (B.station) this.station(k, q, r, y, id, dt);
      else if (B.assembler) this.assemble(k, q, r, y, id, dt);
    }
    for (const B of this.belts.values()) this.runBelt(B, dt);
    this.pickCartons();
    this.slow += dt;
    if (this.slow >= 1) { this.pollute(this.slow); this.deliveries(this.slow); this.slow = 0; }
    this.render();
  }

  // ---------- Machines ----------
  machine(k, q, r, y, id, kind, dt) {
    const box = this.containers.at(q, r, y);
    if (!box) return;
    if (kind === 'boiler' || kind === 'blast') this.burner(k, q, r, y, id, kind, box, dt);
    else {
      const ratio = this.ratioAt(k);
      box.rate = ratio;
      if (ratio > 0 && this.busy(k, kind, box)) {
        box.cook += dt * ratio;
        box.active = 1;
        if (box.cook >= WORK_TIME[kind]) { box.cook = 0; kind === 'drill' ? this.dig(q, r, y, box) : this.craft(kind, box); }
      } else { box.cook = Math.max(0, box.cook - dt); box.active = 0; }
      box.burnMax = WORK_TIME[kind];
    }
    if (box.output) this.eject(q, r, y, box, kind === 'drill');
  }

  craft(kind, box) {
    const rec = RECIPES[kind][box.input.id];
    if (!rec) return;
    if (box.output) box.output.n += rec[1]; else box.output = makeSlot(rec[0], rec[1]);
    if (--box.input.n <= 0) box.input = null;
  }

  // Chaudière, haut fourneau : brûlent leur combustible (la chaudière seulement si une dynamo la
  // touche et qu'il faut du courant ; le haut fourneau, s'il a de quoi faire de l'acier)
  burner(k, q, r, y, id, kind, box, dt) {
    let want;
    if (kind === 'boiler') {
      want = AROUND.some(([dq, dr, dy]) => {
        const n = key(q + dq, r + dr, y + dy);
        if (this.nodes.get(n) !== DYNAMO) return false;
        const net = this.netOf.get(n);
        return !net || net.demand > 0 || net.stored < net.cap;
      });
    } else {
      // (structure complète : des briques réfractaires dessus et dessous)
      box.whole = this.get(q, r, y + 1) === FIREBRICK && this.get(q, r, y - 1) === FIREBRICK;
      want = box.whole && this.busy(k, kind, box);
    }
    if (box.burn > 0) box.burn = Math.max(0, box.burn - dt);
    if (box.burn <= 0 && want && box.fuel && FUEL[box.fuel.id]) {
      box.burn = box.burnMax = FUEL[box.fuel.id];
      if (--box.fuel.n <= 0) box.fuel = null;
    }
    if (box.burn <= 0) box.burnMax = 0;
    const lit = box.burn > 0;
    box.active = lit ? 1 : 0;
    if (kind === 'blast') {
      if (lit && want) {
        box.cook += dt;
        if (box.cook >= WORK_TIME.blast) { box.cook = 0; this.craft('blast', box); }
      } else box.cook = Math.max(0, box.cook - dt * 2);
    }
    const on = kind === 'boiler' ? BOILER_ON : BLAST_FURNACE_ON, off = kind === 'boiler' ? BOILER : BLAST_FURNACE;
    const wantId = lit ? on : off;
    if (wantId !== id) { this.world.setBlock(q, r, y, wantId); this.nodes.set(k, wantId); this.dirty = true; }
    if (lit && Math.random() < dt * (kind === 'blast' ? 1.6 : 1)) this.onSmoke?.(...this.chimneyTop(q, r, y), kind === 'blast' ? 1.3 : 1);
  }

  // Où sort la fumée : le haut de la cheminée d'usine posée dessus, sinon le haut du bloc
  chimneyTop(q, r, y) {
    let yy = y + 1;
    while (yy < y + 12 && this.get(q, r, yy) === FACTORY_CHIMNEY) yy++;
    const c = hexToWorld(q, r);
    return [c.x, yy + 0.2, c.z];
  }

  // Foreuse : creuse la case suivante sous elle (l'eau ne l'arrête pas, un bloc incassable si)
  dig(q, r, y, box) {
    for (let yy = y - 1 - (box.depth || 0); yy >= Y_MIN; yy--) {
      const id = this.get(q, r, yy);
      box.depth = y - 1 - yy;
      if (id === AIR || isWater(id) || BLOCKS[id]?.liquid || BLOCKS[id]?.lava) continue;
      if (BLOCKS[id]?.unbreakable || isIndustrial(id)) { box.done = true; return; }
      const d = this.dropOf?.(id, CRIMSONITE_PICKAXE); // (la mèche casse tout ce qu'une pioche casse)
      this.world.setBlock(q, r, yy, AIR);
      if (d) { if (box.output && box.output.id === d[0]) box.output.n += d[1]; else if (!box.output) box.output = makeSlot(d[0], d[1]); }
      box.depth++;
      return;
    }
    box.done = true;
  }

  // Une machine pose ce qu'elle a produit : sur un tapis qui part d'elle (la foreuse : aussi
  // dans un coffre ou un wagon à côté)
  eject(q, r, y, box, chests) {
    for (let i = 0; i < 6 && box.output; i++) {
      const [dq, dr] = NEIGHBORS[i], nq = q + dq, nr = r + dr, n = this.get(nq, nr, y);
      if (isBelt(n)) {
        const at = this.beltCell(nq, nr, y);
        // (pas sur le bout d'un tapis qui se vide dans la machine)
        if (!at || (at.i === this.outIndex(at.B) && this.outSide(at.B) === (i + 3) % 6)) continue;
        if (this.putOn(at.B, at.i + 0.5, box.output)) box.output = null;
      } else if (chests) {
        const h = this.holderAt(nq, nr, y);
        if (!h || h.kind) continue;
        const left = this.insert(h.box, box.output);
        if (left === box.output.n) continue;
        if (left) box.output.n = left; else box.output = null;
      }
    }
    if (chests && box.output) {
      const h = this.holderAt(q, r, y + 1);
      if (h && !h.kind) { const left = this.insert(h.box, box.output); if (left) box.output.n = left; else box.output = null; }
    }
  }

  // ---------- Tapis ----------
  // Un tapis : { key, q, r, y (sa première case), f (sens de la bande), sl (pente : 0, 1), n
  // (cases), cells, rev (il va de la fin vers le début), items: [{ s, item, v }] }. La position
  // s d'une pile va de 0.5 (le milieu de la première case) à n - 0.5 (le milieu de la dernière).
  // Les tapis se retrouvent à partir de leurs cases (les blocs du monde) ; la sauvegarde ne
  // garde que leur sens et leurs objets.
  syncBelts() {
    this.beltsDirty = false;
    const old = this.belts;
    this.belts = new Map();
    this.cellBelt.clear();
    for (const [k, id] of this.nodes) {
      const C = BLOCKS[id];
      if (!C?.belt || C.part !== 1) continue;
      const [q, r, y] = parse(k), [dq, dr] = NEIGHBORS[C.facing], cells = [k];
      let ok = false;
      for (let i = 1; i < BELT_MAX; i++) {
        const ck = key(q + dq * i, r + dr * i, y + C.slope * i), cid = this.nodes.get(ck);
        if (!BLOCKS[cid]?.belt || BLOCKS[cid].facing !== C.facing || BLOCKS[cid].slope !== C.slope) break;
        cells.push(ck);
        if (BLOCKS[cid].part === 2) { ok = true; break; }
        if (BLOCKS[cid].part !== 0) break;
      }
      if (!ok) continue;
      const prev = old.get(k), saved = this.savedBelts.get(k);
      this.savedBelts.delete(k);
      const B = prev && prev.n === cells.length ? prev : {
        key: k, q, r, y, f: C.facing, sl: C.slope, n: cells.length, cells,
        rev: !!saved?.rev, items: (saved?.items || []).map(([s, iid, n, w]) => ({ s, item: makeSlot(iid, n, w), v: 0 })), v: 0, mesh: null,
      };
      if (prev && B !== prev) this.hideBelt(prev);
      this.belts.set(k, B);
      for (const c of cells) this.cellBelt.set(c, B);
    }
    for (const [k, B] of old) if (this.belts.get(k) !== B) this.hideBelt(B);
  }

  // Tend un tapis entre les arbres a et b ({ q, r, y }) : null, ou ce qui ne va pas
  link(a, b) {
    if (!isShaft(this.get(a.q, a.r, a.y)) || !isShaft(this.get(b.q, b.r, b.y))) return 'Il faut un arbre de transmission à chaque bout';
    const dq = b.q - a.q, dr = b.r - a.r;
    let f = -1, m = 0;
    for (let i = 0; i < 6; i++) {
      const [x, z] = NEIGHBORS[i], k = x ? dq / x : dr / z;
      if (k > 0 && Number.isInteger(k) && x * k === dq && z * k === dr) { f = i; m = k; }
    }
    if (f < 0) return 'Les deux arbres doivent être alignés (en ligne droite, face à face)';
    if (m + 1 > BELT_MAX) return 'Tapis trop long : 20 cases au plus';
    const dy = b.y - a.y;
    if (dy && Math.abs(dy) !== m) return 'Pente impossible : une marche par case, ou à plat';
    // (en pente, la bande va vers le haut : elle part de l'arbre le plus bas)
    const down = dy < 0, s = down ? b : a, F = down ? (f + 3) % 6 : f, sl = dy ? 1 : 0, [fq, fr] = NEIGHBORS[F];
    for (let i = 1; i < m; i++) {
      const id = this.get(s.q + fq * i, s.r + fr * i, s.y + sl * i);
      if (id !== AIR && !isWater(id) && !BLOCKS[id]?.grass) return 'Quelque chose gêne le passage du tapis';
    }
    for (let i = 0; i <= m; i++) this.world.setBlock(s.q + fq * i, s.r + fr * i, s.y + sl * i, conveyorId(F, sl, i === 0 ? 1 : i === m ? 2 : 0));
    // (il va du premier arbre cliqué vers le second)
    this.savedBelts.set(key(s.q, s.r, s.y), { rev: down, items: [] });
    this.beltsDirty = true;
    return null;
  }

  // Une case du tapis B a été cassée (k) : ses poulies redeviennent des arbres, le reste
  // disparaît, ses objets reviennent au joueur
  unbuild(B, k) {
    this.hideBelt(B);
    this.belts.delete(B.key);
    for (const c of B.cells) this.cellBelt.delete(c);
    const [q, r, y] = parse(k);
    for (const it of B.items) this.onDrop?.(it.item, hexToWorld(q, r), y);
    B.cells.forEach((c, i) => {
      const [cq, cr, cy] = parse(c), end = i === 0 || i === B.n - 1;
      if (c === k) { if (end) this.onDrop?.({ id: SHAFT, n: 1 }, hexToWorld(cq, cr), cy); return; }
      if (isBelt(this.get(cq, cr, cy))) this.world.setBlock(cq, cr, cy, end ? SHAFT + (B.f % 3) : AIR);
    });
    this.beltsDirty = true;
  }

  // Le tapis à la case (q, r, y) : { B, i } (i : le rang de la case dans le tapis), ou null
  beltCell(q, r, y) {
    const k = key(q, r, y), B = this.cellBelt.get(k);
    return B ? { B, i: B.cells.indexOf(k) } : null;
  }

  // Sens de la bande : 1 du début vers la fin, -1 à l'envers (un levier allumé contre une
  // poulie inverse le sens choisi en le posant)
  dirOf(B) {
    let flip = false;
    for (const c of [B.cells[0], B.cells[B.n - 1]]) {
      const [q, r, y] = parse(c);
      if (AROUND.some(([dq, dr, dy]) => this.get(q + dq, r + dr, y + dy) === LEVER_ON)) { flip = true; break; }
    }
    return B.rev !== flip ? -1 : 1;
  }
  // La case par où les piles sortent, et le côté vers lequel elles sortent
  outIndex(B) { return (B.dir ?? 1) > 0 ? B.n - 1 : 0; }
  outSide(B) { return (B.dir ?? 1) > 0 ? B.f : (B.f + 3) % 6; }

  // Point de la bande à la position s (au-dessus de la bande)
  beltPoint(B, s, out = new THREE.Vector3()) {
    const c = hexToWorld(B.q, B.r), [dq, dr] = NEIGHBORS[B.f], d = hexToWorld(dq, dr), t = s - 0.5;
    return out.set(c.x + d.x * t, B.y + 0.5 + B.sl * Math.max(0, Math.min(B.n - 1, t)), c.z + d.z * t);
  }

  // Pose la pile st sur le tapis B à la position s (s'il y a la place) : vrai si posée
  putOn(B, s, st) {
    s = Math.max(0.5, Math.min(B.n - 0.5, s));
    if (!st || B.items.some((it) => Math.abs(it.s - s) < BELT_GAP * 0.9)) return false;
    B.items.push({ s, item: st, v: 0 });
    return true;
  }

  // La pile la plus proche de s (à moins de d) : son rang dans B.items, ou -1
  nearest(B, s, d = 0.75) {
    let best = -1, bd = d;
    B.items.forEach((it, i) => { const e = Math.abs(it.s - s); if (e <= bd) { bd = e; best = i; } });
    return best;
  }

  // Un pas du tapis : les piles avancent, sans se rattraper ; celle de tête sort au bout
  runBelt(B, dt) {
    const [q0, r0] = parse(B.cells[0]), [q1, r1] = parse(B.cells[B.n - 1]);
    if (!this.loaded(q0, r0) || !this.loaded(q1, r1)) { B.v = 0; return; }
    B.dir = this.dirOf(B);
    let ratio = 0;
    for (const c of B.cells) ratio = Math.max(ratio, this.ratioAt(c));
    B.v = BELT_SPEED * ratio * B.dir;
    if (!B.items.length) return;
    const dir = B.dir, end = dir > 0 ? B.n - 0.5 : 0.5;
    B.items.sort((a, b) => (b.s - a.s) * dir); // (la tête d'abord)
    let limit = end;
    for (let i = 0; i < B.items.length; i++) {
      const it = B.items[i], s0 = it.s;
      if (it.hold) { it.v = 0; limit = it.s - BELT_GAP * dir; continue; } // (sous une presse, une scie)
      it.s = dir > 0 ? Math.min(limit, it.s + B.v * dt) : Math.max(limit, it.s + B.v * dt);
      if (dir > 0 ? it.s < s0 : it.s > s0) it.s = s0; // (jamais en arrière)
      it.v = (it.s - s0) / dt;
      if (i === 0 && it.s === end && this.handOff(B, it)) { B.items.splice(i--, 1); continue; }
      limit = it.s - BELT_GAP * dir;
    }
  }

  // La pile de tête est au bout : sur le tapis d'après, dans le contenu d'en face, ou par terre
  handOff(B, it) {
    const oi = this.outIndex(B), side = this.outSide(B), [eq, er, ey] = parse(B.cells[oi]);
    const [dq, dr] = NEIGHBORS[side], nq = eq + dq, nr = er + dr;
    const left = this.deliver(nq, nr, ey, it.item, side, 0, B);
    if (left === 0) return true;
    if (left !== null) { it.item.n = left; return false; }
    if (SOLID[this.get(nq, nr, ey)]) return false;
    // (rien au bout : la pile est lancée par terre, dans un carton)
    const p = this.beltPoint(B, it.s), d = hexToWorld(dq, dr), v = Math.abs(B.v);
    p.x += d.x * 0.4; p.z += d.z * 0.4; p.y += 0.1;
    this.onSpill?.(it.item, p, new THREE.Vector3(d.x * (v + 0.5), 1.5, d.z * (v + 0.5)));
    return true;
  }

  // Les cartons posés sur un tapis montent dessus (une seule sorte d'objet)
  pickCartons() {
    for (const c of this.cartons?.list || []) {
      if (!c.ground || c.items.length !== 1 || c.delay > 0) continue;
      const { q, r } = worldToHex(c.pos.x, c.pos.z), at = this.beltCell(q, r, Math.floor(c.pos.y - 0.02));
      if (!at) continue;
      const s0 = this.beltPoint(at.B, 0.5), d = hexToWorld(...NEIGHBORS[at.B.f]);
      const s = 0.5 + (c.pos.x - s0.x) * d.x + (c.pos.z - s0.z) * d.z;
      if (this.putOn(at.B, s, makeSlot(c.items[0].id, c.items[0].n, c.items[0].w))) this.cartons.remove(c);
    }
  }

  // Vitesse donnée par un tapis à ce qui se tient dessus en (pos) : { x, z, up } (up : il monte
  // une pente), ou null
  carry(pos) {
    const { q, r } = worldToHex(pos.x, pos.z);
    for (const y of [Math.floor(pos.y - 0.05), Math.floor(pos.y - 0.05) - 1]) {
      const at = this.beltCell(q, r, y);
      if (!at || !at.B.v || pos.y - y > 1.35) continue; // (en pente, la bande monte jusqu'en haut de la case)
      const d = hexToWorld(...NEIGHBORS[at.B.f]);
      return { x: d.x * at.B.v, z: d.z * at.B.v, up: at.B.sl === 1 && at.B.v > 0 };
    }
    return null;
  }

  // Joueur : pose la pile tenue sur le tapis (s'il y a la place), ou reprend la pile visée
  beltClick(q, r, y, held) {
    const at = this.beltCell(q, r, y);
    if (!at) return null;
    const s = at.i + 0.5, i = this.nearest(at.B, s);
    if (i >= 0) return { took: at.B.items.splice(i, 1)[0].item };
    if (!held || !this.putOn(at.B, s, held)) return null;
    return { put: true };
  }

  // ---------- Bras ----------
  timer(k, dt, every) {
    const t = (this.timers.get(k) || 0) + dt;
    if (t < every) { this.timers.set(k, t); return false; }
    this.timers.set(k, 0);
    return true;
  }

  arm(k, q, r, y, id, dt) {
    if (!this.timer(k, dt * this.ratioAt(k), ARM_TIME)) return;
    const back = BLOCKS[id].facing, front = (back + 3) % 6;
    const [bq, br] = NEIGHBORS[back], [fq, fr] = NEIGHBORS[front];
    // où poser : un coffre / four / machine / wagon, ou un tapis (s'il y a la place)
    const dst = this.holderAt(q + fq, r + fr, y), dstBelt = this.beltCell(q + fq, r + fr, y);
    const room = dstBelt && !dstBelt.B.items.some((it) => Math.abs(it.s - dstBelt.i - 0.5) < BELT_GAP * 0.9);
    if (!dst && !room) return;
    // d'où prendre : la pile du tapis qui passe derrière, un contenu
    // (filtre : seulement l'objet choisi)
    const sBelt = this.beltCell(q + bq, r + br, y);
    const si = sBelt ? sBelt.B.items.findIndex((it) => !it.hold && Math.abs(it.s - sBelt.i - 0.5) <= 0.6 && this.passes(k, it.item.id)) : -1;
    let s = null, giveBack = null;
    if (si >= 0) { const it = sBelt.B.items.splice(si, 1)[0]; s = it.item; giveBack = (x) => { it.item = x; sBelt.B.items.push(it); }; }
    else {
      const src = this.holderAt(q + bq, r + br, y);
      if (!src) return;
      // (ce que la machine d'en face accepte seulement)
      if (dst?.kind && src.box.type === 'chest') {
        const i = src.box.slots.findIndex((x) => x && this.passes(k, x.id) && (machineAccepts(dst.kind, x.id, false) || machineAccepts(dst.kind, x.id, true)));
        if (i < 0) return;
        const x = src.box.slots[i], n = Math.min(x.n, ARM_TAKE);
        s = makeSlot(x.id, n, x.w); x.n -= n; if (!x.n) src.box.slots[i] = null;
      } else s = this.takeFor(k, src.box, ARM_TAKE);
      giveBack = (x) => { this.insert(src.box, x); };
    }
    if (!s) return;
    if (dst) {
      const left = this.insert(dst.box, s, dst.kind);
      if (left) { s.n = left; giveBack(s); }
    } else dstBelt.B.items.push({ s: dstBelt.i + 0.5, item: s, v: 0 });
  }

  // ---------- Quais ----------
  dock(k, q, r, y, id, dt) {
    if (!this.timer(k, dt * this.ratioAt(k), DOCK_TIME)) return;
    const c = hexToWorld(q, r), car = this.carBoxNear(c.x, y, c.z, 2.2);
    if (!car) return;
    const chests = [];
    for (const [dq, dr, dy] of AROUND) {
      const n = this.get(q + dq, r + dr, y + dy);
      if (BLOCKS[n]?.container === 'chest') chests.push(this.containers.at(q + dq, r + dr, y + dy));
    }
    const load = BLOCKS[id].dock === 'load';
    for (const ch of chests) {
      const [from, to] = load ? [ch, car] : [car, ch];
      const s = this.take(from, DOCK_TAKE);
      if (!s) continue;
      const left = this.insert(to, s);
      if (left) { s.n = left; this.insert(from, s); }
      return;
    }
  }

  // ---------- Automatisation ----------
  // Donne la pile st à la case (q, r, y), où elle arrive en allant vers le côté side : sur un tapis
  // (celui de la case, ou celui juste en dessous), dans un entonnoir (par son arrière), un
  // répartiteur, un coffre / four / machine / wagon. Renvoie ce qui reste (0 : tout est passé),
  // ou null s'il n'y a rien pour la prendre. (self : le tapis d'où elle vient)
  deliver(q, r, y, st, side, depth = 0, self = null) {
    for (const dy of [0, -1]) {
      const at = this.beltCell(q, r, y + dy);
      if (!at || at.B === self) continue;
      // (pas sur le bout d'un tapis qui revient vers nous)
      if (at.i === this.outIndex(at.B) && this.outSide(at.B) === (side + 3) % 6) return st.n;
      return this.putOn(at.B, at.i + 0.5, st) ? 0 : st.n;
    }
    const k = key(q, r, y), B = BLOCKS[this.get(q, r, y)];
    if (B?.funnel === 'in') {
      // (un entonnoir ne prend que par son arrière, ce que son filtre laisse passer)
      if (side !== (B.facing + 3) % 6 || !this.ratioAt(k) || !this.passes(k, st.id)) return st.n;
      const [fq, fr] = NEIGHBORS[side], h = this.holderAt(q + fq, r + fr, y);
      return h ? this.insert(h.box, st, h.kind) : st.n;
    }
    if (B?.splitter) return depth < 4 && this.ratioAt(k) ? this.split(q, r, y, st, side, depth) : st.n;
    const h = this.holderAt(q, r, y);
    return h ? this.insert(h.box, st, h.kind) : null;
  }

  // Répartiteur : la pile ressort par un autre côté que celui d'où elle vient, chacun son tour
  split(q, r, y, st, side, depth) {
    const k = key(q, r, y), from = (side + 3) % 6, start = this.turn.get(k) || 0;
    for (let t = 0; t < 6; t++) {
      const j = (start + t) % 6;
      if (j === from) continue;
      const [dq, dr] = NEIGHBORS[j], left = this.deliver(q + dq, r + dr, y, st, j, depth + 1);
      if (left === null || left === st.n) continue;
      this.turn.set(k, (j + 1) % 6);
      return left;
    }
    return st.n;
  }

  passes(k, id) { const f = this.config.get(k); return !f || f === id; }

  // Prend dans le contenu c au plus max objets que le filtre de k laisse passer
  takeFor(k, c, max) {
    const f = this.config.get(k);
    if (!f) return this.take(c, max);
    if (!c) return null;
    if (c.type === 'chest') {
      const i = c.slots.findIndex((x) => x && x.id === f);
      if (i < 0) return null;
      const x = c.slots[i], n = Math.min(x.n, max), out = makeSlot(x.id, n, x.w);
      x.n -= n; if (x.n <= 0) c.slots[i] = null;
      return out;
    }
    return c.output?.id === f ? this.take(c, max) : null;
  }

  // Lance la pile st par terre au point p, vers (dq, dr) : sauf si un carton y est déjà
  drop(st, p, dq, dr) {
    if (!this.onSpill || this.cartons?.list.some((c) => Math.hypot(c.pos.x - p.x, c.pos.z - p.z) < 0.8 && Math.abs(c.pos.y - p.y) < 1.5)) return false;
    const d = hexToWorld(dq, dr);
    this.onSpill(st, p, new THREE.Vector3(d.x * 0.6, 0.8, d.z * 0.6));
    return true;
  }

  // Entonnoir : range dans le coffre devant lui ce qui passe derrière lui (tapis, cartons).
  // Extracteur : sort du coffre devant lui et pose derrière lui (tapis, coffre, ou par terre).
  funnel(k, q, r, y, id, dt) {
    if (!this.timer(k, dt * this.ratioAt(k), FUNNEL_TIME)) return;
    const back = BLOCKS[id].facing, front = (back + 3) % 6;
    const [bq, br] = NEIGHBORS[back], [fq, fr] = NEIGHBORS[front];
    if (BLOCKS[id].funnel === 'out') {
      const src = this.holderAt(q + fq, r + fr, y);
      if (!src) return;
      const st = this.takeFor(k, src.box, FUNNEL_TAKE);
      if (!st) return;
      let left = this.deliver(q + bq, r + br, y, st, back);
      if (left === null) {
        const c = hexToWorld(q + bq, r + br);
        left = SOLID[this.get(q + bq, r + br, y)] || !this.drop(st, new THREE.Vector3(c.x, y + 0.3, c.z), bq, br) ? st.n : 0;
      }
      if (left) { st.n = left; this.insert(src.box, st); }
      return;
    }
    const dst = this.holderAt(q + fq, r + fr, y);
    if (!dst) return;
    // la pile du tapis qui passe derrière lui (à sa hauteur, ou juste en dessous)
    const at = this.beltCell(q + bq, r + br, y) || this.beltCell(q + bq, r + br, y - 1);
    if (at) {
      const i = at.B.items.findIndex((it) => !it.hold && Math.abs(it.s - at.i - 0.5) < 0.6 && this.passes(k, it.item.id));
      if (i >= 0) {
        const it = at.B.items[i], left = this.insert(dst.box, it.item, dst.kind);
        if (!left) at.B.items.splice(i, 1); else it.item.n = left;
        return;
      }
    }
    // un carton posé derrière lui, ou contre lui
    for (const c of this.cartons?.list || []) {
      if (c.delay > 0) continue;
      const h = worldToHex(c.pos.x, c.pos.z);
      if (!((h.q === q + bq && h.r === r + br) || (h.q === q && h.r === r)) || c.pos.y < y - 1 || c.pos.y > y + 1.2) continue;
      let moved = false;
      for (const st of c.items) {
        if (!this.passes(k, st.id)) continue;
        const left = this.insert(dst.box, st, dst.kind);
        if (left !== st.n) moved = true;
        st.n = left;
      }
      if (!moved) continue;
      c.items = c.items.filter((st) => st.n > 0);
      if (c.items.length) this.cartons.refresh?.(c); else this.cartons.remove(c);
      return;
    }
  }

  // Le bloc chauffe-t-il ? (lave, magma, chaudière, haut fourneau ou four allumés)
  hot(id) { return !!(isLava(id) || id === MAGMA || id === BOILER_ON || id === BLAST_FURNACE_ON || (BLOCKS[id]?.container === 'furnace' && BLOCKS[id].light)); }

  // Ventilateur : souffle devant lui (jusqu'au premier bloc plein). Derrière lui, ce qui chauffe
  // fait cuire ce qui est dans le souffle (comme au four), l'eau le lave ; les cartons sont poussés.
  fan(k, q, r, y, id, dt) {
    const ratio = this.ratioAt(k), back = BLOCKS[id].facing, front = (back + 3) % 6;
    const [bq, br] = NEIGHBORS[back], [fq, fr] = NEIGHBORS[front];
    const src = this.get(q + bq, r + br, y), mode = this.hot(src) ? 'smelt' : isWater(src) ? 'wash' : null;
    const cells = [];
    for (let i = 1; i <= FAN_RANGE && ratio > 0; i++) {
      const cq = q + fq * i, cr = r + fr * i;
      if (OPAQUE[this.get(cq, cr, y)]) break;
      cells.push([cq, cr]);
    }
    this.fans.set(k, { mode, n: cells.length });
    if (!cells.length) return;
    const table = (id2) => (mode === 'smelt' ? (SMELT[id2] !== undefined ? [SMELT[id2], 1] : null) : mode === 'wash' ? WASH[id2] : null);
    // (une pile traitée en entier d'un coup, au bout de FAN_TIME secondes dans le souffle)
    const cook = (o, st) => {
      const t = table(st.id);
      if (!t) { o.heat = 0; return null; }
      o.heat = (o.heat || 0) + dt * ratio;
      if (o.heat < FAN_TIME) return null;
      o.heat = 0;
      return makeSlot(t[0], Math.min(stackMax(t[0]), st.n * t[1]));
    };
    const inStream = new Set(cells.map(([cq, cr]) => cq + ',' + cr));
    for (const [cq, cr] of cells) {
      for (const dy of [0, -1]) {
        const at = this.beltCell(cq, cr, y + dy);
        if (!at || !mode) continue;
        for (const it of at.B.items) {
          if (Math.abs(it.s - at.i - 0.5) > 0.5) continue;
          const out = cook(it, it.item);
          if (out) it.item = out;
        }
      }
    }
    // les cartons dans le souffle : poussés, et traités (une seule sorte d'objet)
    const d = hexToWorld(fq, fr), L = Math.hypot(d.x, d.z);
    for (const c of this.cartons?.list || []) {
      const h = worldToHex(c.pos.x, c.pos.z);
      if (!inStream.has(h.q + ',' + h.r) || c.pos.y < y - 0.6 || c.pos.y > y + 1) continue;
      c.vel.x += (d.x / L) * 14 * dt * ratio;
      c.vel.z += (d.z / L) * 14 * dt * ratio;
      if (mode && c.items.length === 1) {
        const out = cook(c, c.items[0]);
        if (out) { c.items = [out]; this.cartons.refresh?.(c); }
      }
    }
  }

  // Ce que fait la scie : les bûches en planches (deux de plus qu'à l'établi)
  sawTable() {
    if (this.sawRecipes) return this.sawRecipes;
    const t = {};
    for (const rec of this.recipes || []) {
      if (rec.p.length !== 1 || rec.p[0].length !== 1) continue;
      const id = rec.k[rec.p[0]];
      if (isLog(id) && !t[id]) t[id] = [rec.out[0], rec.out[1] + 2];
    }
    if (this.recipes) this.sawRecipes = t;
    return t;
  }

  // Presse, scie : au-dessus d'un tapis, arrêtent la pile qui arrive sous elles et la transforment
  // (toute la pile d'un coup ; une fois transformée, elle repart)
  station(k, q, r, y, id, dt) {
    const at = this.beltCell(q, r, y - 1), ratio = this.ratioAt(k);
    if (!at || !ratio) { this.timers.delete(k); return; }
    const kind = BLOCKS[id].station, table = kind === 'press' ? ROLL : this.sawTable();
    const c = at.i + 0.5, dir = at.B.dir ?? 1;
    const it = at.B.items.find((x) => Math.abs(x.s - c) < 0.5 && table[x.item.id] && x.done !== k);
    if (!it) { this.timers.delete(k); return; }
    if ((c - it.s) * dir > 0.05) return; // (elle arrive)
    it.s = c; it.hold = true; it.v = 0;
    this.pressing.add(k);
    if (!this.timer(k, dt * ratio, STATION_TIME[kind])) return;
    const [out, m] = table[it.item.id], n = Math.min(it.item.n, Math.floor(stackMax(out) / m));
    // (ce qui ne tient pas dans une pile : reste derrière, pour le coup suivant)
    if (n < it.item.n && !this.putOn(at.B, c - BELT_GAP * dir, makeSlot(it.item.id, it.item.n - n, it.item.w))) return;
    it.item = makeSlot(out, n * m);
    it.done = k;
    it.hold = false;
    this.pressing.delete(k);
  }

  // La recette de l'établi qui fabrique id, ou null
  recipeFor(id) { return (this.recipes || []).find((rec) => rec.out?.[0] === id && rec.p && rec.k) || null; }

  // Assembleur : avec tout ce qu'il faut dans son coffre, fabrique l'objet choisi et le pose devant
  // lui (sur un tapis, dans un coffre, ou par terre)
  assemble(k, q, r, y, id, dt) {
    const want = this.config.get(k);
    if (!want || !this.timer(k, dt * this.ratioAt(k), ASSEMBLE_TIME)) return;
    const box = this.containers.at(q, r, y), rec = this.recipeFor(want);
    if (!box || box.type !== 'chest' || !rec) return;
    const need = new Map();
    for (const row of rec.p) for (const ch of row) if (rec.k[ch] !== undefined) need.set(rec.k[ch], (need.get(rec.k[ch]) || 0) + 1);
    const count = (iid) => box.slots.reduce((n, x) => n + (x && x.id === iid ? x.n : 0), 0);
    for (const [iid, n] of need) if (count(iid) < n) return;
    const front = (BLOCKS[id].facing + 3) % 6, [fq, fr] = NEIGHBORS[front];
    const out = makeSlot(rec.out[0], rec.out[1]);
    let left = this.deliver(q + fq, r + fr, y, out, front);
    if (left === null) {
      const c = hexToWorld(q + fq, r + fr);
      left = SOLID[this.get(q + fq, r + fr, y)] || !this.drop(out, new THREE.Vector3(c.x, y + 0.3, c.z), fq, fr) ? out.n : 0;
    }
    if (left === out.n) return; // (rien ne peut le prendre : il attend)
    for (const [iid, n0] of need) {
      let n = n0;
      for (let i = 0; i < box.slots.length && n > 0; i++) {
        const x = box.slots[i];
        if (!x || x.id !== iid) continue;
        const t = Math.min(n, x.n);
        x.n -= t; n -= t;
        if (x.n <= 0) box.slots[i] = null;
      }
    }
    if (left) { out.n = left; this.insert(box, out); }
  }

  // Joueur : clic droit avec l'objet held sur un entonnoir, un extracteur, un bras (son filtre ;
  // la main vide : plus de filtre) ou un assembleur (ce qu'il fabrique). Le message à afficher,
  // ou null (rien à régler : l'assembleur s'ouvre)
  configure(q, r, y, held) {
    const k = key(q, r, y), B = BLOCKS[this.get(q, r, y)];
    if (B?.assembler) {
      if (!held || !this.recipeFor(held)) return null;
      this.config.set(k, held);
      return 'Assembleur : il fabrique ' + this.nameOf(held) + ' (mets les ingrédients dans son coffre)';
    }
    if (!B?.filter) return null;
    if (!held) { this.config.delete(k); return B.name + ' : sans filtre, tout passe'; }
    this.config.set(k, held);
    return B.name + ' : seulement ' + this.nameOf(held);
  }

  // ---------- Pollution ----------
  pollute(dt) {
    const P = this.pollution;
    for (const [k, id] of this.nodes) {
      const B = BLOCKS[id], kind = B.machine;
      if (!kind || !POL_SRC[kind]) continue;
      const [q, r, y] = parse(k);
      if (!this.loaded(q, r)) continue;
      const box = this.containers.map.get(k);
      if (!box?.active) continue;
      // un filtre qui touche la machine : 4 fois moins ; une cheminée dessus : 2 fois moins
      let f = 1;
      for (const [dq, dr, dy] of AROUND) if (this.get(q + dq, r + dr, y + dy) === SMOKE_FILTER) { f *= 0.25; break; }
      if (this.get(q, r, y + 1) === FACTORY_CHIMNEY) f *= 0.5;
      const c = hexToWorld(q, r), ck = cellKey(Math.floor(c.x / POL_CELL), Math.floor(c.z / POL_CELL));
      P.set(ck, (P.get(ck) || 0) + POL_SRC[kind] * f * dt);
    }
    this.drift(dt);
    // elle se dissipe peu à peu (moitié en 3 minutes environ)
    for (const [k, v] of P) { const n = v * 0.996 ** dt - 0.01 * dt; if (n <= 0.05) P.delete(k); else P.set(k, n); }
    this.effects(dt);
    this.blight(dt);
  }

  // Le vent l'emporte (dans le sens des nuages, plus vite dans la tempête) et elle s'étale
  // un peu chez les voisines
  drift(dt) {
    const P = this.pollution;
    if (!P.size) return;
    const w = this.windDir?.() || { x: 0, y: 0 };
    let sp = 1;
    for (const [k] of P) { const [sx, sz] = unCell(k), f = this.windAt((sx + 0.5) * POL_CELL, (sz + 0.5) * POL_CELL); sp = 1 + (f.storm || 0) * 2 + (f.rain || 0) * 0.5; break; }
    const move = Math.min(0.6, POL_WIND * sp * dt / POL_CELL);
    const wl = Math.hypot(w.x, w.y) || 1, wx = w.x / wl, wz = w.y / wl;
    const ax = Math.abs(wx) / (Math.abs(wx) + Math.abs(wz) || 1);
    const spread = Math.min(0.2, POL_SPREAD * dt);
    const out = new Map();
    const add = (sx, sz, v) => { const k = cellKey(sx, sz); out.set(k, (out.get(k) || 0) + v); };
    for (const [k, v] of P) {
      const [sx, sz] = unCell(k);
      const m = v * move, e = v * spread;
      add(sx, sz, v - m - e);
      add(sx + Math.sign(wx), sz, m * ax);
      add(sx, sz + Math.sign(wz), m * (1 - ax));
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) add(sx + dx, sz + dz, e / 4);
    }
    P.clear();
    for (const [k, v] of out) if (v > 0.05) P.set(k, v);
  }

  // Pollution moyenne du monde (le climat se réchauffe avec elle, voir seasons.js)
  pollutionLoad() { let t = 0; for (const v of this.pollution.values()) t += v; return t; }

  // Pollution au point (x, z)
  pollutionAt(x, z) { return this.pollution.get(cellKey(Math.floor(x / POL_CELL), Math.floor(z / POL_CELL))) || 0; }

  effects(dt) {
    // les plus fortes : voile sur le feuillage (voir seasons.js, uSmog)
    const top = [...this.pollution].filter(([, v]) => v > 4).sort((a, b) => b[1] - a[1]).slice(0, 8);
    this.smog.forEach((s, i) => {
      const e = top[i];
      if (!e) { s.set(0, 0, 0, 0); return; }
      const [sx, sz] = unCell(e[0]);
      s.set((sx + 0.5) * POL_CELL, (sz + 0.5) * POL_CELL, POL_CELL * (1 + Math.min(1.5, e[1] / 60)), Math.min(1, e[1] / 50));
    });
    // animaux : ils fuient la fumée ; villageois : ils se plaignent (et t'en veulent un peu)
    this.complainT = (this.complainT || 0) + dt;
    const complain = this.complainT > 20;
    if (complain) this.complainT = 0;
    for (const a of this.animals?.list || []) {
      if (a.dead) continue;
      const v = this.pollutionAt(a.pos.x, a.pos.z);
      if (v < 12) continue;
      const villager = this.animals.talk?.isVillager(a);
      if (!villager && a.state !== 'panic') {
        // (vers la cellule voisine la moins enfumée)
        let best = null, bv = v;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const w = this.pollutionAt(a.pos.x + dx * POL_CELL, a.pos.z + dz * POL_CELL);
          if (w < bv) { bv = w; best = [dx, dz]; }
        }
        if (best) this.animals.flee?.(a, best[0], best[1], 4);
        // (très enfumés : ils toussent et s'affaiblissent)
        if (v > POL_SICK && Math.random() < dt * (v - POL_SICK) / 200) this.animals.hit?.(a, 1, a.pos.x, a.pos.z);
      } else if (villager && complain && v > 20) {
        this.animals.talk.change(a, this.pseudo(), -2);
        this.onComplain?.(a);
      }
    }
  }

  // La nature souffre là où la fumée est épaisse : l'herbe jaunit en terre, les
  // hautes herbes fanent, les feuilles des arbres tombent
  blight(dt) {
    this.blightT = (this.blightT || 0) + dt;
    if (this.blightT < 2) return;
    this.blightT = 0;
    for (const [k, v] of this.pollution) {
      if (v < POL_BLIGHT || Math.random() > (v - POL_BLIGHT) / 60) continue;
      const [sx, sz] = unCell(k);
      const { q, r } = worldToHex((sx + Math.random()) * POL_CELL, (sz + Math.random()) * POL_CELL);
      if (!this.loaded(q, r)) continue;
      const top = this.world.surface(q, r).h;
      for (let y = top + 1; y >= top - 6 && y > 0; y--) {
        const id = this.get(q, r, y), B = BLOCKS[id];
        if (!id) continue;
        if (id === 1) { this.world.setBlock(q, r, y, 2); break; }
        if (B?.grass) { this.world.setBlock(q, r, y, AIR); continue; }
        if (B?.leaves && !B.placed) { this.world.setBlock(q, r, y, AIR); continue; }
        if (OPAQUE[id]) break;
      }
    }
  }

  // ---------- Commandes des villages ----------
  deliveries(dt) {
    if (!this.colony || !this.tracks) return;
    for (const V of this.colony.villages.values()) {
      if (this.orders.has(V.key)) continue;
      const w = (this.orderWait.get(V.key) ?? 20) - dt;
      if (w > 0) { this.orderWait.set(V.key, w); continue; }
      const c = hexToWorld(V.q, V.r);
      let st = null, bd = ORDER_RANGE;
      for (const s of this.tracks.stations) { const d = Math.hypot(s.pos.x - c.x, s.pos.z - c.z); if (d < bd) { bd = d; st = s; } }
      if (!st) { this.orderWait.set(V.key, 60); continue; }
      const [item, n, reward] = ORDERS[Math.floor(Math.random() * ORDERS.length)];
      const o = { item, n, reward, station: st.key, stationName: st.name || 'la gare', village: V.key };
      this.orders.set(V.key, o);
      this.onOrder?.(o, false);
    }
    // un train arrêté à la gare d'une commande, avec ce qu'il faut dans ses wagons : livré
    for (const [vk, o] of this.orders) {
      const st = this.tracks.stations.find((s) => s.key === o.station);
      if (!st) { this.orders.delete(vk); continue; }
      for (const t of this.trains?.trains || []) {
        if (Math.abs(t.v) > 0.05) continue;
        const cars = t.cars.filter((c) => c.box && Math.hypot(c.pos.x - st.pos.x, c.pos.z - st.pos.z) < 30);
        if (!cars.length) continue;
        const have = cars.reduce((s, c) => s + c.box.slots.reduce((m, x) => m + (x?.id === o.item ? x.n : 0), 0), 0);
        if (have < o.n) continue;
        let need = o.n;
        for (const c of cars) for (let i = 0; i < CHEST_SLOTS && need > 0; i++) {
          const x = c.box.slots[i];
          if (x?.id !== o.item) continue;
          const k = Math.min(x.n, need);
          x.n -= k; need -= k;
          if (!x.n) c.box.slots[i] = null;
        }
        // la récompense : dans les wagons (ce qui ne rentre pas : au joueur, voir main.js)
        let left = o.reward;
        for (const c of cars) left = this.insert(c.box, { id: IRON_INGOT, n: left });
        this.orders.delete(vk);
        this.orderWait.set(vk, ORDER_PAUSE);
        this.onOrder?.(o, true, left);
        break;
      }
    }
  }

  // La commande d'un village (ou null)
  orderOf(vk) { return this.orders.get(vk) || null; }

  // Les batteries qui se touchent (côtés, dessus, dessous), à partir de (q, r, y) : leurs clés
  batteryPack(q, r, y) {
    const seen = new Set([key(q, r, y)]), todo = [[q, r, y]];
    while (todo.length && seen.size < 4096) {
      const [a, b, c] = todo.pop();
      for (const [dq, dr, dy] of [...NEIGHBORS.map(([x, z]) => [x, z, 0]), [0, 0, 1], [0, 0, -1]]) {
        const k = key(a + dq, b + dr, c + dy);
        if (seen.has(k) || this.get(a + dq, b + dr, c + dy) !== BATTERY_BLOCK) continue;
        seen.add(k);
        todo.push([a + dq, b + dr, c + dy]);
      }
    }
    return [...seen];
  }

  // ---------- Affichage : tapis et objets posés dessus ----------
  // (la bande qui défile : une bande par tapis, posée sur celle des blocs ; ses coordonnées de
  // texture glissent avec elle, voir animate)
  beltMesh(B) {
    if (!this.beltMat) {
      const tex = new THREE.TextureLoader().load('texture/blocs/industrie/conveyor.png');
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.magFilter = THREE.NearestFilter;
      tex.colorSpace = THREE.SRGBColorSpace;
      this.beltMat = new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide });
    }
    const a = this.beltPoint(B, 0.5), b = this.beltPoint(B, B.n - 0.5), d = hexToWorld(...NEIGHBORS[B.f]), W = 0.29, h = 0.006;
    const px = -d.z * W, pz = d.x * W;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([a.x - px, a.y + h, a.z - pz, b.x - px, b.y + h, b.z - pz, b.x + px, b.y + h, b.z + pz, a.x + px, a.y + h, a.z + pz], 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(8), 2));
    geo.setIndex([0, 2, 1, 0, 3, 2]);
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, this.beltMat);
    B.phase = 0;
    this.scrollBelt(B, 0);
    return m;
  }

  scrollBelt(B, dt) {
    B.phase = ((B.phase || 0) - B.v * dt) % 64;
    const uv = B.mesh?.geometry.attributes.uv;
    if (!uv) return;
    const L = B.n - 1, u = B.phase;
    uv.array.set([u, 0, u + L, 0, u + L, 1, u, 1]);
    uv.needsUpdate = true;
  }

  hideBelt(B) {
    if (B.mesh) { this.group.remove(B.mesh); B.mesh.geometry.dispose(); B.mesh = null; }
    for (const it of B.items) if (it.obj) { this.group.remove(it.obj); it.obj = null; }
  }

  // Modèle d'une pile posée sur un tapis (comme dans Create : les blocs en petit, les objets
  // couchés à plat ; une grosse pile en montre deux ou trois)
  itemModel(id, n) {
    const count = n >= 32 ? 3 : n > 1 ? 2 : 1, k = id + ':' + count;
    let p = this.models.get(k);
    if (!p) {
      p = new THREE.Group();
      const m = this.modelOf?.(id);
      for (let i = 0; m && i < count; i++) {
        const c = i ? m.clone() : m;
        if (m.userData.flat) {
          c.scale.setScalar(0.42);
          c.rotation.x = -Math.PI / 2;
          c.position.set((i - (count - 1) / 2) * 0.1, 0.02 + i * 0.025, (i % 2) * 0.06);
        } else {
          c.scale.setScalar(0.28);
          c.position.set(i === 1 ? 0.16 : 0, 0.14 + (i === 2 ? 0.28 : 0), i === 1 ? 0.05 : 0);
        }
        p.add(c);
      }
      if (!m) { const s = new THREE.Sprite(this.material(id)); s.scale.setScalar(0.42); s.position.y = 0.21; p.add(s); }
      this.models.set(k, p);
    }
    const o = p.clone();
    o.rotation.order = 'YXZ';
    o.userData.key = k;
    return o;
  }

  // Place les bandes et les objets des tapis (chaque pas : ceux qui apparaissent, qui partent)
  renderBelts() {
    const live = new Set();
    for (const B of this.belts.values()) {
      const [q, r] = parse(B.cells[0]);
      if (!this.loaded(q, r)) { this.hideBelt(B); continue; }
      if (!B.mesh) { B.mesh = this.beltMesh(B); this.group.add(B.mesh); }
      const d = hexToWorld(...NEIGHBORS[B.f]), yaw = Math.atan2(-d.z, d.x);
      for (const it of B.items) {
        const k = it.item.id + ':' + (it.item.n >= 32 ? 3 : it.item.n > 1 ? 2 : 1);
        if (it.obj?.userData.key !== k) {
          if (it.obj) this.group.remove(it.obj);
          it.obj = this.itemModel(it.item.id, it.item.n);
          it.obj.rotation.set(0, yaw, B.sl ? Math.PI / 4 : 0);
          this.group.add(it.obj);
        }
        live.add(it.obj);
      }
    }
    // (les piles parties : sorties au bout, reprises, passées sur un autre tapis)
    for (const o of [...this.group.children]) if (o.userData.key && !live.has(o)) this.group.remove(o);
    this.placeItems();
  }

  // Les piles glissent d'une image à l'autre entre deux pas (à leur vitesse du dernier pas)
  placeItems() {
    const since = this.remote ? Math.min(this.snapT, 0.35) : Math.min(this.clock, TICK);
    for (const B of this.belts.values()) {
      for (const it of B.items) {
        if (!it.obj) continue;
        this.beltPoint(B, Math.max(0.5, Math.min(B.n - 0.5, it.s + it.v * since)), it.obj.position);
        it.obj.position.y += 0.006;
      }
    }
  }

  render() {
    this.renderBelts();
    // éoliennes : un rotor par mât, qui tourne d'autant plus vite qu'elle produit
    const on = new Set();
    // (roues à aubes : leur roue plonge du côté de l'eau, et tourne avec le courant)
    // (ventilateurs : leurs pales ; presses, scies : leur tête, leur lame)
    for (const [k, id] of this.nodes) {
      const B = BLOCKS[id];
      if (id !== WIND_TURBINE && id !== WATER_WHEEL && !B?.fan && !B?.station) continue;
      const [q, r, y] = parse(k);
      if (!this.loaded(q, r)) continue;
      on.add(k);
      let m = this.rotors.get(k);
      if (m && m.userData.id !== id) { this.group.remove(m); m = null; }
      if (!m) {
        m = id === WIND_TURBINE ? rotorModel() : id === WATER_WHEEL ? wheelModel() : B.fan ? fanModel() : stationModel(B.station);
        m.userData.id = id;
        const c = hexToWorld(q, r);
        m.position.set(c.x, y + (id === WIND_TURBINE ? 0.9 : B.station ? 0 : 0.5), c.z);
        if (B.fan) {
          const d = hexToWorld(...NEIGHBORS[(B.facing + 3) % 6]), L = Math.hypot(d.x, d.z);
          m.position.x += (d.x / L) * 0.53; m.position.z += (d.z / L) * 0.53;
          m.rotation.y = Math.atan2(d.x, d.z);
        }
        this.group.add(m);
        this.rotors.set(k, m);
      }
      const S = this.remote ? this.speeds.get(k) : null; // (invité : la vitesse vue chez l'hôte)
      if (B.fan || B.station) {
        const ratio = this.ratioAt(k);
        m.userData.speed = S ? S[0] : B.fan ? ratio * 14 : ratio * 10;
        m.userData.busy = S ? !!S[1] : this.pressing.has(k);
        // (la scie : sa lame dans le sens du tapis en dessous)
        const at = B.station === 'saw' && this.beltCell(q, r, y - 1);
        if (at) { const d = hexToWorld(...NEIGHBORS[at.B.f]); m.rotation.y = Math.atan2(d.x, d.z) + Math.PI / 2; }
        continue;
      }
      const W = this.remote ? 0 : this.genPower(q, r, y, id);
      if (id === WIND_TURBINE) m.userData.speed = S ? S[0] : 0.6 + W * 0.12;
      else {
        m.userData.speed = S ? S[0] : W * 0.06;
        m.rotation.y = this.waterSide(q, r, y);
      }
    }
    for (const [k, m] of this.rotors) if (!on.has(k)) { this.group.remove(m); this.rotors.delete(k); }
  }

  // À chaque image : les pales tournent, la nacelle se tourne face au vent
  animate(dt) {
    for (const B of this.belts.values()) if (B.mesh) this.scrollBelt(B, dt);
    this.placeItems();
    if (!this.rotors.size) return;
    // (le rotor du côté d'où vient le vent)
    const w = this.windDir?.(), yaw = w && (w.x || w.y) ? Math.atan2(-w.x, -w.y) : 0;
    for (const m of this.rotors.values()) {
      if (m.userData.wheel) { m.userData.blades.rotation.x += dt * m.userData.speed; continue; }
      if (m.userData.fan) { m.userData.blades.rotation.z += dt * m.userData.speed; continue; }
      if (m.userData.station === 'saw') { m.userData.part.rotation.z += dt * m.userData.speed * (m.userData.busy ? 2 : 1); continue; }
      if (m.userData.station === 'press') {
        // (la tête descend sur la pile et remonte, tant qu'elle en tient une)
        const u = m.userData;
        u.phase = u.busy ? ((u.phase || 0) + dt / STATION_TIME.press) % 1 : Math.max(0, (u.phase || 0) - dt);
        u.part.position.y = -0.3 * (0.5 - 0.5 * Math.cos(u.phase * Math.PI * 2));
        continue;
      }
      m.rotation.y += Math.atan2(Math.sin(yaw - m.rotation.y), Math.cos(yaw - m.rotation.y)) * Math.min(1, dt * 0.5);
      m.userData.blades.rotation.z += dt * m.userData.speed;
    }
  }

  // Le côté de la roue à aubes où il y a le plus d'eau (qui coule d'abord) : l'angle de la roue
  waterSide(q, r, y) {
    let best = 0, bestW = 0;
    for (let i = 0; i < 6; i++) {
      const [dq, dr] = NEIGHBORS[i];
      let w = 0;
      for (const dy of [0, -1]) { const n = this.get(q + dq, r + dr, y + dy); if (isWater(n)) w += n >= 9 && n <= 15 ? 3 : 1; }
      if (w > bestW) { bestW = w; best = i; }
    }
    const a = hexToWorld(q, r), b = hexToWorld(q + NEIGHBORS[best][0], r + NEIGHBORS[best][1]);
    return Math.atan2(b.x - a.x, b.z - a.z);
  }

  material(id) {
    let m = this.mats.get(id);
    if (!m) {
      const cv = this.iconOf?.(id);
      const tex = cv ? new THREE.CanvasTexture(cv) : null;
      if (tex) tex.colorSpace = THREE.SRGBColorSpace;
      m = new THREE.SpriteMaterial({ map: tex, transparent: true, alphaTest: 0.3 });
      this.mats.set(id, m);
    }
    return m;
  }

  // ---------- Wattmètre : ce qu'on lit en visant un bloc ----------
  describe(q, r, y) {
    const k = key(q, r, y), id = this.get(q, r, y), B = BLOCKS[id];
    if (!B || !isIndustrial(id)) return null;
    const lines = [];
    const W = (x) => Math.round(x) + ' W';
    if (B.power === 'gen') lines.push(B.name + ' : ' + W(this.genPower(q, r, y, id)));
    else if (B.power === 'use') {
      const need = this.usePower(k, id);
      lines.push(B.name + ' : ' + (need ? W(need) + ', ' + Math.round(this.ratioAt(k) * 100) + ' % de sa vitesse' : 'au repos'));
    } else if (B.power === 'store') {
      // (des batteries collées n'en font qu'une : leurs réserves s'additionnent)
      const pack = this.batteryPack(q, r, y);
      const J = pack.reduce((n, p) => n + (this.energy.get(p) || 0), 0), cap = pack.length * BATTERY_J;
      lines.push((pack.length > 1 ? B.name + ' (' + pack.length + ' collées)' : B.name) + ' : ' + Math.round((J / cap) * 100) + ' % (' + Math.round(J) + ' / ' + cap + ' J)');
    }
    else if (B.machine === 'blast') {
      const box = this.containers.map.get(k);
      lines.push(box?.whole === false || !(this.get(q, r, y + 1) === FIREBRICK && this.get(q, r, y - 1) === FIREBRICK) ? 'Haut fourneau : il faut des briques réfractaires dessus et dessous' : 'Haut fourneau : prêt');
    }
    if (B.fan) {
      const f = this.fans.get(k);
      lines.push('Ventilateur : ' + (!f?.n ? 'rien dans son souffle' : f.mode === 'smelt' ? 'cuisson (' + f.n + ' cases)' : f.mode === 'wash' ? 'lavage (' + f.n + ' cases)' : 'il souffle (' + f.n + ' cases) ; derrière lui : lave, magma ou four allumé pour cuire, eau pour laver'));
    }
    if (B.filter) lines.push('Filtre : ' + (this.config.has(k) ? this.nameOf(this.config.get(k)) : 'aucun (clic droit avec un objet pour en choisir un)'));
    if (B.assembler) lines.push('Fabrique : ' + (this.config.has(k) ? this.nameOf(this.config.get(k)) : 'rien (clic droit avec l\'objet voulu en main)'));
    if (B.station === 'press' || B.station === 'saw') lines.push(B.station === 'press' ? 'Presse : au-dessus d\'un tapis, elle aplatit les lingots et les plaques' : 'Scie : au-dessus d\'un tapis, elle coupe les bûches en planches');
    if (B.machine === 'boiler') lines.push(id === BOILER_ON ? 'Chaudière allumée : elle fait tourner les dynamos qui la touchent' : 'Chaudière éteinte (il faut du combustible et une dynamo qui la touche)');
    const net = this.netOf.get(k);
    if (net) {
      lines.push('Réseau : ' + W(net.prod) + ' produits, ' + W(net.demand) + ' demandés');
      if (net.cap) lines.push('Batteries du réseau : ' + Math.round((net.stored / net.cap) * 100) + ' %');
      if (net.eff < 1) lines.push('Pertes : ' + Math.round((1 - net.eff) * 100) + ' % (trop de câbles : ajoute un transformateur)');
    } else if (B.power) lines.push('Relié à rien');
    const p = this.pollutionAt(hexToWorld(q, r).x, hexToWorld(q, r).z);
    if (p > 4) lines.push('Pollution ici : ' + (p > 40 ? 'forte' : p > 15 ? 'moyenne' : 'faible'));
    return lines.join('\n');
  }

  // ---------- En ligne ----------
  // (hôte) Ce que voient les invités : les tapis (sens, vitesse, piles), la vitesse des pales et
  // des têtes de machine, les filtres et ce que fabriquent les assembleurs
  state() {
    const r2 = (v) => Math.round(v * 100) / 100, b = [], m = [];
    for (const B of this.belts.values()) {
      if (!B.v && !B.items.length) continue;
      b.push([B.key, B.dir ?? 1, r2(B.v), B.items.map((it) => [(it.uid ??= ++this.uid), r2(it.s), r2(it.v), it.item.id, it.item.n])]);
    }
    for (const [k, o] of this.rotors) m.push([k, r2(o.userData.speed || 0), o.userData.busy ? 1 : 0]);
    return { b, m, c: [...this.config] };
  }

  // (invité) L'état envoyé par l'hôte (voir state)
  applyState(d) {
    if (!d || !Array.isArray(d.b)) return;
    if (this.beltsDirty) this.syncBelts();
    const seen = new Set();
    for (const e of d.b.slice(0, 4000)) {
      const B = Array.isArray(e) && typeof e[0] === 'string' ? this.belts.get(e[0]) : null;
      if (!B || !Array.isArray(e[3])) continue;
      seen.add(B);
      B.dir = e[1] < 0 ? -1 : 1;
      B.v = Number.isFinite(e[2]) ? e[2] : 0;
      // (les piles déjà là gardent leur modèle : elles glissent au lieu de réapparaître)
      const old = new Map(B.items.map((it) => [it.uid, it]));
      B.items = [];
      for (const x of e[3].slice(0, 64)) {
        if (!Array.isArray(x) || !(BLOCKS[x[3]] || ITEMS[x[3]]) || !(x[4] > 0) || !Number.isFinite(x[1])) continue;
        const it = old.get(x[0]) || { uid: x[0], obj: null };
        old.delete(x[0]);
        it.s = Math.max(0.5, Math.min(B.n - 0.5, x[1]));
        it.v = Number.isFinite(x[2]) ? x[2] : 0;
        it.item = makeSlot(x[3], Math.min(4096, x[4] | 0));
        B.items.push(it);
      }
    }
    for (const B of this.belts.values()) if (!seen.has(B)) { B.v = 0; B.items = []; }
    this.speeds = new Map((Array.isArray(d.m) ? d.m : []).filter((e) => Array.isArray(e) && typeof e[0] === 'string' && Number.isFinite(e[1])).map((e) => [e[0], [e[1], e[2] === 1]]));
    if (Array.isArray(d.c)) this.config = new Map(d.c.filter((e) => Array.isArray(e) && typeof e[0] === 'string' && (BLOCKS[e[1]] || ITEMS[e[1]])));
    this.snapT = 0;
    this.render();
  }

  // (invité) À chaque image : les tapis retrouvés à partir des blocs, les piles qui glissent
  remoteTick(dt) {
    this.snapT += dt;
    if (this.beltsDirty) { this.syncBelts(); this.renderBelts(); }
    this.animate(dt);
  }

  // (invité) Le wattmètre : le texte vient de l'hôte, redemandé deux fois par seconde (ask(q, r, y))
  remoteDescribe(q, r, y, ask) {
    if (!isIndustrial(this.get(q, r, y))) return null;
    const k = key(q, r, y), e = this.remoteText.get(k), now = performance.now();
    if ((!e || now - e.at > 500) && now - (this.askT || 0) > 200) {
      this.askT = now;
      if (this.remoteText.size > 200) this.remoteText.clear();
      this.remoteText.set(k, { at: now, txt: e?.txt ?? null });
      ask(q, r, y);
    }
    return e?.txt ?? null;
  }
  setRemoteText(k, txt) {
    const e = this.remoteText.get(k);
    if (e) e.txt = txt;
  }

  // ---------- Sauvegarde ----------
  serialize() {
    return {
      // (tapis : leur sens et leurs piles ; les tapis pas encore retrouvés gardent ce qu'on avait lu)
      conveyors: [...[...this.belts.values()].map((B) => ({ k: B.key, rev: B.rev, items: B.items.map((it) => [Math.round(it.s * 100) / 100, it.item.id, it.item.n, it.item.w || 0]) })),
        ...[...this.savedBelts].map(([k, v]) => ({ k, rev: v.rev, items: v.items }))],
      energy: [...this.energy].filter(([, e]) => e > 0).map(([k, e]) => [k, Math.round(e)]),
      pollution: [...this.pollution].map(([k, v]) => [k, Math.round(v * 10) / 10]),
      orders: [...this.orders.values()],
      config: [...this.config],
    };
  }

  load(d) {
    for (const B of this.belts.values()) this.hideBelt(B);
    this.belts.clear(); this.cellBelt.clear(); this.savedBelts.clear(); this.beltsDirty = true;
    this.energy.clear(); this.pollution.clear(); this.orders.clear(); this.orderWait.clear(); this.config.clear();
    if (!d) return;
    // (les anciens tapis d'une case, d.belts, sont inertes : leurs objets sont perdus)
    for (const b of d.conveyors || []) {
      if (typeof b?.k !== 'string') continue;
      this.savedBelts.set(b.k, { rev: !!b.rev, items: (b.items || []).filter(([s, id, n]) => Number.isFinite(s) && (BLOCKS[id] || ITEMS[id]) && n > 0) });
    }
    for (const [k, e] of d.energy || []) if (Number.isFinite(e)) this.energy.set(k, Math.min(BATTERY_J, e));
    for (const [k, v] of d.pollution || []) if (Number.isFinite(v)) this.pollution.set(k, v);
    for (const o of d.orders || []) if (o?.village && o.item && o.n > 0) this.orders.set(o.village, o);
    for (const [k, id] of d.config || []) if (typeof k === 'string' && (BLOCKS[id] || ITEMS[id])) this.config.set(k, id);
    this.dirty = true;
  }
}

// Le bloc est-il suivi par l'industrie ?
export const isIndustrial = (id) => {
  const B = BLOCKS[id];
  return !!B && (!!B.power || !!B.machine || id === SMOKE_FILTER || id === FACTORY_CHIMNEY);
};
