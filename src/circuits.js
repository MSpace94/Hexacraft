// Circuits de voltite (comme la redstone de Minecraft).
//  - Sources : bloc de voltite (courant continu), torche d'énergie allumée.
//  - Fil de voltite (rouge) ou de voltite impure (bleu) : relie les cases voisines à la
//    même hauteur ou d'un bloc plus haut / plus bas (il monte et descend les marches), avec un fil de la même sorte seulement (on peut les poser côte à côte). Le courant y perd 1 par
//    case (15 au départ d'une source) ; un fil qui le reçoit s'allume.
//  - Ce qui touche une source ou un fil allumé est alimenté : la TNT s'allume, le bloc
//    physique s'allume (collé à un objet, il le fait avancer : voir structs.js).
//  - Répéteur : reçoit le courant par l'arrière (source, fil allumé, autre répéteur) et le
//    rend à pleine force par l'avant, REPEATER_DELAY plus tard ; jamais dans l'autre sens.
//  - Inverseur : pareil, mais à l'envers (courant à l'arrière : rien devant ; rien à
//    l'arrière : courant devant).
//  - Piston : alimenté, il sort sa tête (vers le haut, ou vers le bas) et pousse d'une case
//    les blocs devant lui (PISTON_PUSH au plus ; un bloc incassable, un coffre, un four ou un
//    autre piston sorti le bloquent). Sans courant, il rentre sa tête (sans tirer les blocs).
//  - Rail de train : un aiguillage alimenté passe sur la branche, sans courant il revient tout
//    droit (voir tracks.js).
// Les recalculs se font en lot une fois par image (une modification peut en entraîner
// d'autres : un fil qui s'allume, une torche qu'on éteint...).
import { NEIGHBORS } from './hex.js?v=1.1.5-alpha-mvm2b95g';
import { WORLD_HEIGHT, DEPTH } from './gen.js?v=1.1.5-alpha-mvm2b95g';
import { PHYSICS, PHYSICS_ON, LAMP, LAMP_ON, PROPELLER, PROPELLER_ON, isPropeller, STABILIZER, STABILIZER_ON, isStabilizer, isLamp, isWire, isWireOn, wireKind, wireState, isSource, isPhysics, isTnt, wireStep, isRepeater, isRepeaterOn, repeaterKind, repeaterIn, repeaterOut, repeaterState, isInverter,
  BLOCKS, AIR, SOLID, isPiston, isPistonHead, PISTON, PISTON_ON, PISTON_HEAD, PISTON_DOWN, PISTON_DOWN_ON, PISTON_DOWN_HEAD, PISTON_PUSH } from './blocks.js?v=1.1.5-alpha-mvm2b95g';

const MAX_POWER = 15;
const LIMIT = 4096; // fils au plus dans un même circuit
const REPEATER_DELAY = 100; // ms entre le courant reçu par un répéteur et sa sortie
const SIDES = NEIGHBORS.map(([q, r]) => [q, r, 0]);
const AROUND = [[0, 0, 1], [0, 0, -1], ...SIDES];
// une case modifiée peut couper ou créer une marche de fil : on regarde aussi en diagonale
const SEEDS = [[0, 0, 0], ...AROUND, ...NEIGHBORS.map(([q, r]) => [q, r, 1]), ...NEIGHBORS.map(([q, r]) => [q, r, -1])];
const key = (q, r, y) => q + ',' + r + ',' + y;
const parse = (k) => k.split(',').map(Number);

export class Circuits {
  constructor(world) {
    this.world = world;
    this.pending = new Set();   // cases modifiées depuis le dernier calcul
    this.levels = new Map();    // fil -> courant (1..15)
    this.busy = false;          // nos propres changements ne relancent pas de calcul
    this.onIgnite = null;       // une TNT reçoit du courant
    this.delays = new Map();    // répéteur -> { at (ms), on } : changement d'état à venir
    this.pistons = new Map();   // piston -> [q, r, y] : à faire bouger après le calcul
  }

  // Le répéteur (q, r, y) alimente-t-il la case voisine de son côté de sortie ?
  feeds(id, side) {
    return isRepeaterOn(id) && repeaterOut(id) === side;
  }

  // Un répéteur voisin (même hauteur) donne-t-il du courant à la case (q, r, y) ?
  // kind : seulement un répéteur de cette sorte (pour un fil), 0 : n'importe lequel
  fedByRepeater(q, r, y, kind = 0) {
    for (let i = 0; i < 6; i++) {
      const n = this.world.getBlock(q + NEIGHBORS[i][0], r + NEIGHBORS[i][1], y);
      if (this.feeds(n, (i + 3) % 6) && (!kind || repeaterKind(n) === kind)) return true;
    }
    return false;
  }

  // Courant reçu par l'arrière d'un répéteur
  repeaterInput(q, r, y, id) {
    const s = repeaterIn(id), [dq, dr] = NEIGHBORS[s];
    const n = this.world.getBlock(q + dq, r + dr, y);
    return isSource(n) || isWireOn(n) || this.feeds(n, (s + 3) % 6);
  }

  // Un bloc du monde a changé : on recalculera autour
  onBlockSet(q, r, y) {
    if (!this.busy) this.pending.add(key(q, r, y));
  }

  update() {
    // répéteurs dont le délai est écoulé : ils changent d'état (ce qui relance un calcul)
    if (this.delays.size) {
      const now = performance.now();
      for (const [k, d] of this.delays) {
        if (now < d.at) continue;
        this.delays.delete(k);
        const [q, r, y] = parse(k), id = this.world.getBlock(q, r, y);
        if (isRepeater(id)) this.world.setBlock(q, r, y, repeaterState(id, d.on));
      }
    }
    if (!this.pending.size) return;
    const seeds = [...this.pending].map(parse);
    this.pending.clear();
    this.busy = true;
    const done = new Set(), touched = new Set();
    for (const [q, r, y] of seeds) {
      touched.add(key(q, r, y));
      for (const [dq, dr, dy] of SEEDS) {
        const k = key(q + dq, r + dr, y + dy);
        if (!done.has(k) && isWire(this.world.getBlock(q + dq, r + dr, y + dy))) this.solve(q + dq, r + dr, y + dy, done, touched);
      }
    }
    // ce qui touche un fil recalculé ou une case modifiée
    const checked = new Set();
    for (const k of touched) {
      const [q, r, y] = parse(k);
      for (const [dq, dr, dy] of [[0, 0, 0], ...AROUND]) {
        const kk = key(q + dq, r + dr, y + dy);
        if (checked.has(kk)) continue;
        checked.add(kk);
        this.checkConsumer(q + dq, r + dr, y + dy);
      }
    }
    this.busy = false;
    // pistons : ils bougent après le calcul (les blocs déplacés relancent un calcul à l'image
    // suivante, comme une modification du joueur)
    if (this.pistons.size) {
      const list = [...this.pistons.values()];
      this.pistons.clear();
      for (const [q, r, y] of list) this.movePiston(q, r, y);
    }
  }

  // Piston (q, r, y) : sort ou rentre sa tête selon le courant
  movePiston(q, r, y) {
    const w = this.world, id = w.getBlock(q, r, y), b = BLOCKS[id];
    if (!b?.piston) return;
    const dir = b.piston, on = this.powered(q, r, y);
    const head = dir > 0 ? PISTON_HEAD : PISTON_DOWN_HEAD;
    if (b.extended) {
      // il rentre (plus de courant, ou sa tête a été cassée)
      const h = w.getBlock(q, r, y + dir);
      if (on && h === head) return;
      if (h === head) w.setBlock(q, r, y + dir, AIR);
      w.setBlock(q, r, y, dir > 0 ? PISTON : PISTON_DOWN);
      return;
    }
    if (!on) return;
    // les blocs à pousser, jusqu'à une case libre (air, eau, plante, torche...)
    const col = [];
    let yy = y + dir;
    for (;;) {
      if (yy <= -DEPTH || yy >= WORLD_HEIGHT) return; // (le bord du monde)
      const n = w.getBlock(q, r, yy);
      if (!n || !SOLID[n]) break;
      const nb = BLOCKS[n];
      if (col.length >= PISTON_PUSH || nb.unbreakable || nb.container || isPistonHead(n) || (nb.piston && nb.extended)) return;
      col.push(n);
      yy += dir;
    }
    // on décale la colonne d'une case (en commençant par le bout), puis la tête sort
    for (let k = col.length - 1; k >= 0; k--) w.setBlock(q, r, y + dir * (k + 2), col[k]);
    w.setBlock(q, r, y + dir, head);
    w.setBlock(q, r, y, dir > 0 ? PISTON_ON : PISTON_DOWN_ON);
  }

  // Un circuit (fils de la même sorte reliés, à plat ou par des marches) : courant de
  // chaque fil, allumé ou éteint
  solve(q0, r0, y0, done, touched) {
    const w = this.world, id0 = w.getBlock(q0, r0, y0);
    // fils reliés à (q, r, y)
    const links = (q, r, y) => {
      const at = (dq, dr, dy) => w.getBlock(q + dq, r + dr, y + dy), out = [];
      for (const [dq, dr] of NEIGHBORS) {
        const st = wireStep(at, id0, dq, dr);
        if (st !== null) out.push([q + dq, r + dr, y + st]);
      }
      return out;
    };
    const comp = [], stack = [[q0, r0, y0]], inComp = new Set([key(q0, r0, y0)]);
    done.add(key(q0, r0, y0));
    while (stack.length && comp.length < LIMIT) {
      const c = stack.pop();
      comp.push(c);
      for (const n of links(...c)) {
        const k = key(...n);
        if (inComp.has(k)) continue;
        inComp.add(k); done.add(k);
        stack.push(n);
      }
    }
    // courant au départ : 15 sur un fil qui touche une source
    const level = new Map(), buckets = Array.from({ length: MAX_POWER + 1 }, () => []);
    for (const [q, r, y] of comp) {
      if (AROUND.some(([dq, dr, dy]) => isSource(w.getBlock(q + dq, r + dr, y + dy))) || this.fedByRepeater(q, r, y, wireKind(id0))) {
        level.set(key(q, r, y), MAX_POWER);
        buckets[MAX_POWER].push([q, r, y]);
      }
    }
    // puis il baisse de 1 par case (du plus fort au plus faible)
    for (let p = MAX_POWER; p > 1; p--) {
      for (const c of buckets[p]) {
        if (level.get(key(...c)) !== p) continue;
        for (const n of links(...c)) {
          const k = key(...n);
          if (!inComp.has(k) || (level.get(k) || 0) >= p - 1) continue;
          level.set(k, p - 1);
          buckets[p - 1].push(n);
        }
      }
    }
    for (const [q, r, y] of comp) {
      const k = key(q, r, y), p = level.get(k) || 0;
      if (p) this.levels.set(k, p); else this.levels.delete(k);
      const id = w.getBlock(q, r, y), want = wireState(id, p > 0);
      if (id !== want) w.setBlock(q, r, y, want);
      touched.add(k);
    }
  }

  // La case (q, r, y) reçoit-elle du courant ? (une source ou un fil allumé la touche)
  powered(q, r, y) {
    for (const [dq, dr, dy] of AROUND) {
      const id = this.world.getBlock(q + dq, r + dr, y + dy);
      if (isSource(id) || isWireOn(id)) return true;
    }
    return this.fedByRepeater(q, r, y);
  }

  checkConsumer(q, r, y) {
    const id = this.world.getBlock(q, r, y);
    if (isPhysics(id)) {
      const want = this.powered(q, r, y) ? PHYSICS_ON : PHYSICS;
      if (want !== id) this.world.setBlock(q, r, y, want);
    } else if (isLamp(id)) {
      const want = this.powered(q, r, y) ? LAMP_ON : LAMP;
      if (want !== id) this.world.setBlock(q, r, y, want);
    } else if (isPropeller(id)) {
      const want = this.powered(q, r, y) ? PROPELLER_ON : PROPELLER;
      if (want !== id) this.world.setBlock(q, r, y, want);
    } else if (isStabilizer(id)) {
      const want = this.powered(q, r, y) ? STABILIZER_ON : STABILIZER;
      if (want !== id) this.world.setBlock(q, r, y, want);
    } else if (isRepeater(id)) {
      // l'arrière a changé : la sortie suivra après le délai (sauf si c'est déjà prévu)
      // (inverseur : il donne du courant quand il n'en reçoit pas)
      const want = this.repeaterInput(q, r, y, id) !== isInverter(id), k = key(q, r, y), d = this.delays.get(k);
      if (want === isRepeaterOn(id)) { if (d && d.on !== want) this.delays.delete(k); }
      else if (!d || d.on !== want) this.delays.set(k, { at: performance.now() + REPEATER_DELAY, on: want });
    } else if (BLOCKS[id]?.track !== undefined) {
      // rail de train : un aiguillage suit le courant (voir tracks.power)
      this.onTrackPower?.(q, r, y, this.powered(q, r, y));
    } else if (isTnt(id) && this.powered(q, r, y)) {
      this.onIgnite?.(q, r, y);
    } else if (isPiston(id)) {
      // (il bougera à la fin du calcul)
      const want = this.powered(q, r, y), b = BLOCKS[id];
      const headOk = !b.extended || isPistonHead(this.world.getBlock(q, r, y + b.piston));
      if (want !== !!b.extended || !headOk) this.pistons.set(key(q, r, y), [q, r, y]);
    } else if (isPistonHead(id)) {
      // tête sans son piston (il a été cassé) : elle disparaît
      const dir = BLOCKS[id].pistonHead, base = BLOCKS[this.world.getBlock(q, r, y - dir)];
      if (!(base?.piston === dir && base.extended)) this.world.setBlock(q, r, y, AIR);
    }
  }

  clear() {
    this.pending.clear();
    this.pistons.clear();
    this.delays.clear();
    this.levels.clear();
  }
}
