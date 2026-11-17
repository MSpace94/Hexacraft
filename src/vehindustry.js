// L'industrie sur les objets collés (véhicules, vaisseaux) : les machines posées sur un objet
// marchent comme dans le monde, mais sans câbles. L'objet entier est un seul réseau :
//  - il produit avec ses dynamos (touchées par une chaudière allumée, à bord), ses éoliennes, ses
//    panneaux solaires (voir orbital.js, slow) ;
//  - il garde l'énergie dans ses batteries de stockage (la réserve du vaisseau, orbital.charge) ;
//  - ses machines (concasseur, laminoir, haut fourneau, foreuses) y puisent ; les chaudières
//    brûlent leur combustible quand il faut du courant.
// Les foreuses creusent le monde sous elles (ou devant, la foreuse horizontale), là où l'objet
// passe : un véhicule de mine. Ce qui sort des machines va dans les coffres de l'objet (ceux qui
// touchent la machine d'abord). Seul l'hôte d'une partie fait tourner les machines.
import * as THREE from 'three';
import { BLOCKS, AIR, isWater, isLava, BATTERY_BLOCK, BOILER, BOILER_ON, DYNAMO, WIND_TURBINE, FIREBRICK, BLAST_FURNACE, BLAST_FURNACE_ON, makeSlot, ITEMS, CRIMSONITE_PICKAXE } from './blocks.js?v=1.1.0-mwk9a96e';
import { NEIGHBORS, hexToWorld, worldToHex } from './hex.js?v=1.1.0-mwk9a96e';
import { FUEL } from './containers.js?v=1.1.0-mwk9a96e';
import { DYNAMO_W, BATTERY_J, USE_W, WORK_TIME, isIndustrial } from './industry.js?v=1.1.0-mwk9a96e';

const TICK = 0.25;
const SCAN = 3;               // s entre deux relevés des blocs d'un objet
const DRILL_T = 1.2;          // s par bloc creusé (la foreuse d'un véhicule va un peu plus vite)
const DRILL_REACH = 4;        // blocs sous la foreuse (le long de l'objet) qu'elle peut atteindre
const HDRILL_REACH_V = 6;     // devant la foreuse horizontale
const AROUND = [...NEIGHBORS.map(([q, r]) => [q, r, 0]), [0, 0, 1], [0, 0, -1]];
const key = (q, r, y) => q + ',' + r + ',' + y;
const parse = (k) => k.split(',').map(Number);
const stackMax = (id) => ITEMS[id]?.stack ?? 64;
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3();

export class VehicleIndustry {
  // g : { structs, containers, industry, orbital, world, dropOf(id, tool), isClient() }
  constructor(g) {
    this.g = g;
    this.clock = 0;
  }

  // Ce qu'il y a d'industriel à bord (gardé quelques secondes)
  info(s) {
    const now = performance.now();
    if (s.vin && s.vin.n === s.blocks.size && s.vin.t > now) return s.vin;
    const I = { n: s.blocks.size, t: now + SCAN * 1000, machines: [], boilers: [], dynamos: [], wind: [], bat: 0, chests: [], prod: 0, use: 0, ratio: 0, ...(s.vin ? { prod: s.vin.prod, use: s.vin.use, ratio: s.vin.ratio } : {}) };
    for (const [k, id] of s.blocks) {
      const B = BLOCKS[id];
      if (!B) continue;
      if (B.machine === 'boiler') I.boilers.push(k);
      else if (B.machine) I.machines.push(k);
      if (id === DYNAMO) I.dynamos.push(k);
      if (id === WIND_TURBINE) I.wind.push(k);
      if (id === BATTERY_BLOCK) I.bat++;
      if (B.container === 'chest') I.chests.push(k);
    }
    s.vin = I;
    return I;
  }
  has(s) { const I = this.info(s); return I.machines.length || I.boilers.length || I.dynamos.length || I.wind.length; }

  update(dt) {
    const { structs, isClient } = this.g;
    this.clock += dt;
    if (this.clock < TICK) return;
    dt = Math.min(0.5, this.clock);
    this.clock = 0;
    if (isClient()) return;
    for (const s of structs.list) {
      if (s.unloaded || !s.blocks.size) continue;
      const I = this.info(s);
      if (!I.machines.length && !I.boilers.length && !I.dynamos.length && !I.wind.length) continue;
      this.run(s, I, dt);
    }
  }

  get(s, q, r, y) { return s.blocks.get(key(q, r, y)) || AIR; }
  box(s, k) { return this.g.containers.atStruct(s, k); }
  // Change un bloc de l'objet (chaudière allumée, haut fourneau...) : le dessin suit
  swap(s, k, id) {
    if (s.blocks.get(k) === id) return;
    s.blocks.set(k, id);
    this.g.structs.refresh(s);
    this.g.structs.changed(s);
  }

  run(s, I, dt) {
    const { orbital } = this.g;
    const cap = I.bat * BATTERY_J;
    let J = Math.min(cap, orbital.charge.get(s.id) || 0);
    // ---- production ----
    let prod = 0;
    for (const k of I.dynamos) {
      const [q, r, y] = parse(k);
      let n = 0;
      for (const [a, b, c] of AROUND) if (this.get(s, q + a, r + b, y + c) === BOILER_ON) n++;
      prod += DYNAMO_W * Math.min(3, n);
    }
    for (const k of I.wind) prod += this.windW(s, k);
    // ---- demande : les machines qui ont du travail ----
    let use = 0;
    const work = [];
    for (const k of I.machines) {
      const id = s.blocks.get(k), kind = BLOCKS[id].machine, box = this.box(s, k);
      if (!box || kind === 'blast') continue;
      if (this.busy(s, k, id, kind, box)) { use += USE_W[kind] || 0; work.push([k, id, kind, box]); }
      else { box.cook = Math.max(0, box.cook - dt); box.active = 0; box.rate = 0; }
      box.burnMax = kind === 'drill' ? DRILL_T : WORK_TIME[kind];
    }
    // ---- chaudières : elles brûlent s'il faut du courant (et qu'une dynamo les touche) ----
    const want = use > prod || (cap > 0 && J < cap);
    for (const k of I.boilers) this.burner(s, k, 'boiler', want, dt);
    for (const k of I.machines) if (BLOCKS[s.blocks.get(k)]?.machine === 'blast') this.burner(s, k, 'blast', true, dt);
    // ---- bilan : le surplus charge les batteries, le manque y est pris ----
    let ratio;
    if (prod >= use) {
      ratio = use > 0 ? 1 : 0;
      J = Math.min(cap, J + (prod - use) * dt);
    } else {
      const draw = Math.min(J, (use - prod) * dt);
      J -= draw;
      ratio = use > 0 ? (prod + draw / dt) / use : 0;
    }
    if (cap > 0) orbital.charge.set(s.id, J);
    I.prod = prod; I.use = use; I.ratio = ratio;
    // ---- les machines travaillent ----
    for (const [k, id, kind, box] of work) {
      box.rate = ratio;
      box.active = ratio > 0 ? 1 : 0;
      box.cook += dt * ratio;
      const T = kind === 'drill' ? DRILL_T : WORK_TIME[kind];
      if (box.cook >= T) { box.cook = 0; if (kind === 'drill') this.dig(s, k, id, box); else this.g.industry.craft(kind, box); }
    }
    for (const k of I.machines) { const box = this.box(s, k); if (box?.output) this.eject(s, k, box); }
  }

  windW(s, k) {
    const [q, r, y] = parse(k), c = hexToWorld(q, r);
    const p = this.g.structs.toWorld(s, _a.set(c.x, y + 0.5, c.z), _b);
    const w = this.g.industry.windAt?.(p.x, p.z) || {};
    const base = 6 + Math.max(0, Math.min(24, (p.y - 64) * 0.6));
    // (le vent de la course aussi : un véhicule rapide fait tourner son éolienne)
    const speed = Math.min(20, s.vel ? Math.hypot(s.vel.x, s.vel.z) : 0);
    return Math.round(base * (1 + (w.storm || 0) * 1.5 + (w.rain || 0) * 0.3) + speed * 0.8);
  }

  busy(s, k, id, kind, box) {
    if (kind === 'drill') {
      if (box.output && box.output.n >= stackMax(box.output.id)) return false;
      return !!this.drillTarget(s, k, id);
    }
    return this.g.industry.busy(k, kind, box);
  }

  // Chaudière, haut fourneau d'un objet (voir industry.burner)
  burner(s, k, kind, want, dt) {
    const box = this.box(s, k);
    if (!box) return;
    const [q, r, y] = parse(k);
    if (kind === 'boiler') want = want && AROUND.some(([a, b, c]) => this.get(s, q + a, r + b, y + c) === DYNAMO);
    else {
      box.whole = this.get(s, q, r, y + 1) === FIREBRICK && this.get(s, q, r, y - 1) === FIREBRICK;
      want = box.whole && this.g.industry.busy(k, 'blast', box);
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
        if (box.cook >= WORK_TIME.blast) { box.cook = 0; this.g.industry.craft('blast', box); }
      } else box.cook = Math.max(0, box.cook - dt * 2);
    }
    const on = kind === 'boiler' ? BOILER_ON : BLAST_FURNACE_ON, off = kind === 'boiler' ? BOILER : BLAST_FURNACE;
    this.swap(s, k, lit ? on : off);
    if (lit && Math.random() < dt) {
      const c = hexToWorld(q, r), p = this.g.structs.toWorld(s, _a.set(c.x, y + 1.2, c.z), _b);
      this.g.industry.onSmoke?.(p.x, p.y, p.z, kind === 'blast' ? 1.3 : 1);
    }
  }

  // Le bloc du monde que la foreuse k attaque : le premier bloc solide le long de son axe (sous
  // elle, ou devant la foreuse horizontale), à portée ; null s'il n'y a rien (ou un bloc qu'elle
  // ne casse pas)
  drillTarget(s, k, id) {
    const { structs, world } = this.g, B = BLOCKS[id], [q, r, y] = parse(k), c = hexToWorld(q, r);
    const from = structs.toWorld(s, _a.set(c.x, y + 0.5, c.z), new THREE.Vector3());
    let dir, reach;
    if (B.hdrill) {
      const [dq, dr] = NEIGHBORS[(B.facing + 3) % 6], n = hexToWorld(q + dq, r + dr);
      dir = structs.toWorld(s, _b.set(n.x, y + 0.5, n.z), _d).sub(from).normalize().clone();
      reach = HDRILL_REACH_V;
    } else {
      dir = structs.toWorld(s, _b.set(c.x, y - 0.5, c.z), _d).sub(from).normalize().clone();
      reach = DRILL_REACH;
    }
    for (let t = 0.75; t <= reach + 0.5; t += 0.25) {
      const px = from.x + dir.x * t, py = from.y + dir.y * t, pz = from.z + dir.z * t;
      const h = worldToHex(px, pz), yy = Math.floor(py);
      if (this.own(s, _a.set(px, py, pz))) continue; // (un bloc de l'objet lui-même)
      const w = world.getBlock(h.q, h.r, yy);
      if (w === AIR || isWater(w) || isLava(w) || BLOCKS[w]?.liquid) continue;
      if (!BLOCKS[w] || BLOCKS[w].unbreakable || isIndustrial(w) || BLOCKS[w].container) return null;
      return [h.q, h.r, yy, w];
    }
    return null;
  }
  own(s, p) {
    const L = this.g.structs.toLocal(s, p, _b), h = worldToHex(L.x, L.z);
    return s.blocks.has(key(h.q, h.r, Math.floor(L.y)));
  }
  dig(s, k, id, box) {
    const T = this.drillTarget(s, k, id);
    if (!T) return;
    const [q, r, y, w] = T;
    const d = this.g.dropOf(w, CRIMSONITE_PICKAXE);
    this.g.world.setBlock(q, r, y, AIR);
    if (d) { if (box.output && box.output.id === d[0]) box.output.n += d[1]; else if (!box.output) box.output = makeSlot(d[0], d[1]); }
  }

  // Ce qui sort d'une machine : dans un coffre de l'objet (ceux qui la touchent d'abord)
  eject(s, k, box) {
    const I = this.info(s), [q, r, y] = parse(k), ind = this.g.industry;
    const near = AROUND.map(([a, b, c]) => key(q + a, r + b, y + c)).filter((n) => I.chests.includes(n));
    for (const c of [...near, ...I.chests.filter((n) => !near.includes(n))]) {
      if (!box.output) return;
      const left = ind.insert(this.box(s, c), box.output);
      if (left === box.output.n) continue;
      if (left) box.output.n = left; else box.output = null;
    }
  }

  // Ce qu'on lit en visant une machine, une dynamo, une éolienne d'un objet collé
  describe(s, k) {
    const id = s.blocks.get(k), B = BLOCKS[id];
    if (!B || !(B.machine || id === DYNAMO || id === WIND_TURBINE)) return null;
    const I = this.info(s), W = (x) => Math.round(x).toLocaleString('fr-FR') + ' W';
    const cap = I.bat * BATTERY_J, J = Math.min(cap, this.g.orbital.charge.get(s.id) || 0);
    const box = B.container ? this.box(s, k) : null, lines = [];
    if (id === DYNAMO) {
      const [q, r, y] = parse(k);
      const n = AROUND.filter(([a, b, c]) => this.get(s, q + a, r + b, y + c) === BOILER_ON).length;
      lines.push('Dynamo à vapeur : ' + W(DYNAMO_W * Math.min(3, n)) + (n ? '' : ' (pose une chaudière allumée contre elle, à bord)'));
    } else if (id === WIND_TURBINE) lines.push('Éolienne : ' + W(this.windW(s, k)) + ' (le vent, et la vitesse du véhicule)');
    else if (B.machine === 'boiler') lines.push(B.name + ' : ' + (box?.burn > 0 ? 'allumée' : 'éteinte') + ' · elle brûle son combustible quand une dynamo qui la touche doit produire');
    else if (B.machine === 'blast') lines.push(B.name + ' : ' + (box?.whole ? (box.burn > 0 ? 'allumé' : 'éteint') : 'il lui faut des briques réfractaires dessus et dessous'));
    else if (B.machine === 'drill') {
      const T = this.drillTarget(s, k, id);
      lines.push(B.name + ' : ' + (T ? (box?.active ? 'creuse ' : 'prête à creuser ') + (BLOCKS[T[3]]?.name || 'un bloc').toLowerCase() : 'rien à creuser à portée (' + (B.hdrill ? HDRILL_REACH_V + ' blocs devant elle' : DRILL_REACH + ' blocs sous elle') + ')') + ' · ' + W(USE_W.drill));
    } else lines.push(B.name + ' : ' + (box?.active ? 'au travail' : 'en attente') + ' · ' + W(USE_W[B.machine] || 0));
    lines.push('Réseau du véhicule : +' + W(I.prod) + ' produits · −' + W(I.use) + ' demandés' + (I.use ? ' · ' + Math.round(Math.min(1, I.ratio) * 100) + ' % du courant' : '') + (I.bat ? ' · batteries ' + Math.round((J / cap) * 100) + ' %' : ' · pas de batterie à bord'));
    if (B.machine && B.machine !== 'boiler' && !I.chests.length) lines.push('(pose un coffre à bord : ce qu\'elle produit y va)');
    return lines.join('\n');
  }
}
