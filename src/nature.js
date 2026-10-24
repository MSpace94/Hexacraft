// La nature qui vit toute seule (hôte / solo) :
//  - Feuilles : sans tronc à moins de 4 feuilles (on cherche de proche en proche), les
//    feuilles d'un arbre disparaissent peu à peu. 8 % d'entre elles tombent au lieu de
//    disparaître, et deviennent une pousse là où elles touchent l'herbe ou la terre.
//  - Pousse : grandit en chêne au bout de quelques minutes, s'il y a la place.
//  - Herbe : gagne lentement la terre à découvert qui la touche.
// Pousses et herbe avancent par « ticks » au hasard : quelques colonnes de chaque chunk
// chargé sont visitées toutes les demi-secondes (comme dans Minecraft).
import * as THREE from 'three';
import { NEIGHBORS, hexToWorld } from './hex.js?v=1.1.5-alpha-mvm2b95g';
import { BIG_SAPLING } from './blocks.js?v=1.1.5-alpha-mvm2b95g';
import { BLOCKS, AIR, SOLID, SAPLING, SNOW_GRASS, SNOW_LEAVES, isNaturalLeaves, isWater, isLog, CHESTNUT_SAPLING, CHESTNUT_LOG, LINDEN_SAPLING, LINDEN_LOG, BIRCH_SAPLING, BIRCH_LOG, isCrop, WHEAT_RIPE, FARMLAND, FARMLAND_WET, isFarmland } from './blocks.js?v=1.1.5-alpha-mvm2b95g';
import { CS, H, idx } from './mesher.js?v=1.1.5-alpha-mvm2b95g';

const GRASS = 1, DIRT = 2, LOG = 5, LEAVES = 6;
const REACH = 4;            // distance (en feuilles) à laquelle un tronc retient une feuille
const FALL_CHANCE = 0.08;   // une feuille qui disparaît tombe et devient une pousse
const TICK = 0.5;           // secondes entre deux tours de ticks au hasard
const TICKS_PER_CHUNK = 4;  // colonnes visitées par chunk à chaque tour
const GRASS_CHANCE = 0.35;  // l'herbe gagne une case de terre visitée qui la touche
const GROW_CHANCE = 0.2;    // une pousse visitée grandit
// blé : chaque case est visitée toutes les 32 s environ ; 13 stades à franchir, ~10 minutes
const CROP_CHANCE = 0.65;
const SEEDS_PER_FRAME = 24; // changements traités par image (une explosion en fait beaucoup)
const AROUND = [[0, 0, 1], [0, 0, -1], ...NEIGHBORS.map(([q, r]) => [q, r, 0])];
const key = (q, r, y) => q + ',' + r + ',' + y;
const ground = (id) => id === GRASS || id === DIRT || id === SNOW_GRASS;

export class Nature {
  constructor(world, scene) {
    this.world = world;
    this.scene = scene;
    this.pending = [];        // cases où un tronc ou des feuilles ont disparu
    this.decay = new Map();   // feuille condamnée -> secondes avant de disparaître
    this.falling = [];        // feuilles qui tombent { sprite, q, r, y, vy, t }
    this.tickClock = 0;
    this.leafMat = null;
  }

  // Un bloc a changé : si c'était un tronc ou des feuilles, les feuilles voisines sont à
  // revérifier
  onBlockSet(q, r, y, id, old) {
    if (id === old || (old !== LOG && !isNaturalLeaves(old))) return;
    if (this.pending.length < 4000) this.pending.push([q, r, y]);
  }

  // La feuille (q, r, y) est-elle retenue par un tronc ? (de feuille en feuille, au plus REACH)
  supported(q0, r0, y0) {
    const w = this.world;
    const seen = new Set([key(q0, r0, y0)]);
    let front = [[q0, r0, y0]];
    for (let d = 0; d <= REACH && front.length; d++) {
      const next = [];
      for (const [q, r, y] of front) {
        for (const [dq, dr, dy] of AROUND) {
          const id = w.getBlock(q + dq, r + dr, y + dy);
          if (isLog(id)) return true;
          if (d === REACH || !isNaturalLeaves(id)) continue;
          const k = key(q + dq, r + dr, y + dy);
          if (seen.has(k)) continue;
          seen.add(k);
          next.push([q + dq, r + dr, y + dy]);
        }
      }
      front = next;
    }
    return false;
  }

  update(dt) {
    const w = this.world;
    // 1. feuilles à revérifier autour des changements
    for (let n = 0; n < SEEDS_PER_FRAME && this.pending.length; n++) {
      const [q0, r0, y0] = this.pending.pop();
      for (let dq = -REACH; dq <= REACH; dq++) {
        for (let dr = Math.max(-REACH, -dq - REACH); dr <= Math.min(REACH, -dq + REACH); dr++) {
          for (let dy = -REACH; dy <= REACH; dy++) {
            const q = q0 + dq, r = r0 + dr, y = y0 + dy, k = key(q, r, y);
            if (this.decay.has(k) || !isNaturalLeaves(w.getBlock(q, r, y))) continue;
            // chacune à son rythme : l'arbre se dégarnit peu à peu
            if (!this.supported(q, r, y)) this.decay.set(k, 1.5 + Math.random() * 12);
          }
        }
      }
    }
    // 2. feuilles qui disparaissent (ou tombent)
    for (const [k, t] of this.decay) {
      const left = t - dt;
      if (left > 0) { this.decay.set(k, left); continue; }
      this.decay.delete(k);
      const [q, r, y] = k.split(',').map(Number);
      const id = w.getBlock(q, r, y);
      if (!isNaturalLeaves(id) || this.supported(q, r, y)) continue;
      w.setBlock(q, r, y, AIR);
      if (Math.random() < FALL_CHANCE) this.drop(q, r, y, id);
    }
    // 3. feuilles qui tombent
    for (let i = this.falling.length - 1; i >= 0; i--) {
      const f = this.falling[i];
      f.t += dt;
      f.vy = Math.min(f.vy + 6 * dt, 3);   // tombe doucement (comme une feuille)
      f.y -= f.vy * dt;
      const c = hexToWorld(f.q, f.r);
      f.sprite.position.set(c.x + Math.sin(f.t * 2.5) * 0.25, f.y + 0.3, c.z + Math.cos(f.t * 1.9) * 0.2);
      f.sprite.material.rotation = Math.sin(f.t * 3) * 0.6;
      const below = w.getBlock(f.q, f.r, Math.floor(f.y));
      // (elle passe à travers les autres feuilles, qui tombent elles aussi)
      if (f.y > 0 && (below === AIR || isNaturalLeaves(below) || (!SOLID[below] && !isWater(below)))) continue;
      // posée : une pousse si elle tombe sur l'herbe ou la terre (et dans une case libre)
      this.scene.remove(f.sprite);
      this.falling.splice(i, 1);
      const yy = Math.floor(f.y) + 1;
      if (ground(below) && w.getBlock(f.q, f.r, yy) === AIR) w.setBlock(f.q, f.r, yy, SAPLING);
    }
    // 4. ticks au hasard : herbe et pousses
    this.tickClock += dt;
    if (this.tickClock >= TICK) {
      this.tickClock = 0;
      for (const c of w.chunks.values()) {
        for (let n = 0; n < TICKS_PER_CHUNK; n++) this.randomTick(c);
      }
    }
  }

  // Une feuille tombe de (q, r, y)
  drop(q, r, y, id) {
    if (!this.leafMat) {
      this.leafMat = {};
    }
    // (une feuille de la couleur de l'arbre : chêne, châtaignier, tilleul ou bouleau)
    const side = BLOCKS[id]?.side;
    const kind = side === 'chestnut_leaves' || side === 'linden_leaves' || side === 'birch_leaves' ? side : BLOCKS[LEAVES].side;
    if (!this.leafMat[kind]) {
      const tex = new THREE.CanvasTexture(this.world.atlas.tiles[kind]);
      tex.colorSpace = THREE.SRGBColorSpace;
      this.leafMat[kind] = new THREE.SpriteMaterial({ map: tex, alphaTest: 0.3 });
    }
    const sprite = new THREE.Sprite(this.leafMat[kind].clone());
    sprite.scale.setScalar(0.45);
    if (id === SNOW_LEAVES) sprite.material.color.setRGB(1.6, 1.7, 1.7);
    this.scene.add(sprite);
    this.falling.push({ sprite, q, r, y, vy: 0, t: Math.random() * 6 });
  }

  // Une colonne au hasard du chunk c : on regarde son bloc du dessus
  randomTick(c) {
    if (!c.data) return; // chunk pas encore reçu
    const lq = (Math.random() * CS) | 0, lr = (Math.random() * CS) | 0;
    let y = H - 1;
    while (y > 0 && !c.data[idx(lq, lr, y)]) y--;
    const id = c.data[idx(lq, lr, y)];
    const q = c.cq * CS + lq, r = c.cr * CS + lr;
    if (id === BIG_SAPLING) {
      if (Math.random() < GROW_CHANCE) this.growBig(q, r, y);
    } else if (id === CHESTNUT_SAPLING) {
      if (Math.random() < GROW_CHANCE) this.growChestnut(q, r, y);
    } else if (id === LINDEN_SAPLING) {
      if (Math.random() < GROW_CHANCE) this.growLinden(q, r, y);
    } else if (isCrop(id)) {
      // le blé et les pommes de terre poussent d'un stade (seulement sur la terre labourée ; deux
      // fois moins vite sur une terre sèche)
      const soil = this.world.getBlock(q, r, y - 1);
      if (isFarmland(soil)) this.hydrate(q, r, y - 1, soil);
      if (!BLOCKS[id].ripe && Math.random() < CROP_CHANCE * (soil === FARMLAND_WET ? 1 : 0.5) && isFarmland(soil)) this.world.setBlock(q, r, y, id + 1);
    } else if (isFarmland(id)) {
      this.hydrate(q, r, y, id);
    } else if (id === BIRCH_SAPLING) {
      if (Math.random() < GROW_CHANCE) this.growBirch(q, r, y);
    } else if (id === SAPLING) {
      // la pousse est posée sur le dessus : le bloc vu est elle
      if (Math.random() < GROW_CHANCE) this.grow(q, r, y);
    } else if (id === DIRT) {
      if (Math.random() < GRASS_CHANCE) this.spreadGrass(q, r, y);
    }
  }

  // Terre labourée : humide s'il y a de l'eau à moins de 4 cases (à sa hauteur ou juste au-dessus),
  // sèche sinon
  hydrate(q, r, y, id) {
    let wet = false;
    for (let a = -4; a <= 4 && !wet; a++) {
      for (let b = Math.max(-4, -a - 4); b <= Math.min(4, -a + 4) && !wet; b++) {
        if (isWater(this.world.getBlock(q + a, r + b, y)) || isWater(this.world.getBlock(q + a, r + b, y + 1))) wet = true;
      }
    }
    const want = wet ? FARMLAND_WET : FARMLAND;
    if (want !== id) this.world.setBlock(q, r, y, want);
  }

  // Terre à découvert : l'herbe d'à côté (même hauteur, un cran plus haut ou plus bas) la gagne
  spreadGrass(q, r, y) {
    const w = this.world;
    const above = w.getBlock(q, r, y + 1);
    if (SOLID[above] || isWater(above)) return;
    for (const [dq, dr] of NEIGHBORS) {
      for (let dy = -1; dy <= 1; dy++) {
        const n = w.getBlock(q + dq, r + dr, y + dy);
        if (n === GRASS || n === SNOW_GRASS) { w.setBlock(q, r, y, n); return; }
      }
    }
  }

  // Pousse -> chêne (même forme que les arbres du monde), s'il y a la place
  grow(q, r, y) {
    const w = this.world, gen = w.gen;
    const soil = w.getBlock(q, r, y - 1);
    if (!ground(soil)) return;
    const trunk = 4 + Math.floor(Math.random() * 2);
    if (y + trunk + 2 >= H) return;
    for (let k = 1; k < trunk + 2; k++) if (w.getBlock(q, r, y + k) !== AIR) return;
    const tree = { q, r, base: y, top: y + trunk - 1 };
    const leaves = soil === SNOW_GRASS ? SNOW_LEAVES : LEAVES;
    for (let k = 0; k < trunk; k++) w.setBlock(q, r, y + k, LOG);
    for (let dy = -2; dy <= 1; dy++) {
      for (let dq = -2; dq <= 2; dq++) {
        for (let dr = Math.max(-2, -dq - 2); dr <= Math.min(2, -dq + 2); dr++) {
          const yy = tree.top + dy;
          if (w.getBlock(q + dq, r + dr, yy) === AIR && gen.leafAt(tree, q + dq, r + dr, yy)) w.setBlock(q + dq, r + dr, yy, leaves);
        }
      }
    }
  }

  // Pousse de grand chêne -> grand chêne (comme ceux de la grande forêt), s'il y a la place
  growBig(q, r, y) {
    const w = this.world, gen = w.gen;
    const soil = w.getBlock(q, r, y - 1);
    if (!ground(soil)) return;
    const leaves = soil === SNOW_GRASS ? SNOW_LEAVES : LEAVES;
    this.place(q, r, y, gen.bigOak(q, r, y, () => Math.random(), leaves), LOG);
  }

  // Pousse de châtaignier -> châtaignier (comme ceux de la forêt européenne), s'il y a la place
  growChestnut(q, r, y) {
    if (!ground(this.world.getBlock(q, r, y - 1))) return;
    this.place(q, r, y, this.world.gen.chestnut(q, r, y, () => Math.random()), CHESTNUT_LOG);
  }

  // Pousse de tilleul -> tilleul (comme ceux de la forêt européenne), s'il y a la place
  growLinden(q, r, y) {
    if (!ground(this.world.getBlock(q, r, y - 1))) return;
    this.place(q, r, y, this.world.gen.linden(q, r, y, () => Math.random()), LINDEN_LOG);
  }

  // Pousse de bouleau -> bouleau (comme ceux des forêts), s'il y a la place
  growBirch(q, r, y) {
    if (!ground(this.world.getBlock(q, r, y - 1))) return;
    this.place(q, r, y, this.world.gen.birch(q, r, y, () => Math.random()), BIRCH_LOG);
  }

  // Pose un grand arbre t (voir gen.bigOak) à la place de sa pousse, s'il y a la place
  place(q, r, y, t, log) {
    const w = this.world;
    if (t.top + 1 >= H) return;
    // le tronc doit avoir la place de monter
    for (let k = 1; k <= t.top - y - 3; k++) if (w.getBlock(q, r, y + k) !== AIR) return;
    w.setBlock(q, r, y, log);
    for (const [k, id] of t.cells) {
      const [a, b, yy] = k.split(',').map(Number);
      if (w.getBlock(a, b, yy) === AIR) w.setBlock(a, b, yy, id);
    }
  }

  clear() {
    this.pending.length = 0;
    this.decay.clear();
    for (const f of this.falling) this.scene.remove(f.sprite);
    this.falling.length = 0;
  }
}
