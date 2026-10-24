// TNT : bloc qui s'allume (torche en main, torche d'énergie à côté, autre explosion), tombe,
// clignote puis explose : blocs détruits en sphère irrégulière, réaction en chaîne,
// joueurs / Hexacarts / objets collés projetés, flash, fumée, tremblement et son.
// Big TNT : 20 fois l'énergie d'une TNT (20 fois le volume détruit : rayon x 2,7), onde de
// choc et nuage en champignon comme un gros missile.
// TNT 200 : 200 fois l'énergie d'une TNT (rayon x 5,8), champignon deux fois plus grand.
// TNT 1000 : trou 5 fois plus gros que 1000 TNT (rayon x 17), énorme champignon. Une si
// grosse explosion détruit ses blocs en quelques secondes (du centre vers le bord) pour ne
// pas figer le jeu.
// En multijoueur, l'hôte simule les TNT ; les clients affichent leur état (remote).
import * as THREE from 'three';
import { NEIGHBORS, hexToWorld, worldToHex } from './hex.js?v=1.1.5-alpha-mvm2b95g';
import { BLOCKS, AIR, TNT, BIG_TNT, TNT_200, TNT_1000, ENERGY_TORCH, SOLID, isWater, isLava, isTnt } from './blocks.js?v=1.1.5-alpha-mvm2b95g';
const isLiquid = (id) => isWater(id) || isLava(id);
import { buildBlocksArrays, H } from './mesher.js?v=1.1.5-alpha-mvm2b95g';
import { geometryFrom } from './world.js?v=1.1.5-alpha-mvm2b95g';
import { playFuse, playExplosion } from './sound.js?v=1.1.5-alpha-mvm2b95g';
import { DEPTH } from './gen.js?v=1.1.5-alpha-mvm2b95g';

export const FUSE = 4;          // secondes avant l'explosion
export const RADIUS = 3.8;      // rayon de destruction (blocs)
// Réglages par sorte de TNT. power : énergie (1 = TNT) ; le rayon suit la racine cubique
// (20 fois l'énergie = 20 fois le volume de blocs détruits). level : 0 TNT, 1 Big TNT,
// 2 TNT 200, 3 TNT 1000 (taille des effets : flash, champignon, recul).
const KINDS = {
  [TNT]: { fuse: FUSE, radius: RADIUS, power: 1, level: 0 },
  [BIG_TNT]: { fuse: 6, radius: RADIUS * Math.cbrt(20), power: 20, level: 1 },
  [TNT_200]: { fuse: 8, radius: RADIUS * Math.cbrt(200), power: 200, level: 2 },
  [TNT_1000]: { fuse: 10, radius: RADIUS * Math.cbrt(5000), power: 1000, level: 3 },
};
const LEVELS = [TNT, BIG_TNT, TNT_200, TNT_1000];
const MUSHROOM = [0, 1, 2.2, 4];  // taille du champignon par niveau
const levelKind = (level) => KINDS[LEVELS[level] ?? TNT];
const kindOf = (block) => KINDS[block] || KINDS[TNT];
const G = 24;
const SMOKE = 48;               // bouffées de fumée recyclées (TNT normale)
const CLOUD = 520;              // particules du champignon (Big TNT)
const HUGE = 30;               // rayon au-delà duquel les blocs partent peu à peu
const BUDGET = 7;               // millisecondes de destruction par image

// Texture ronde et douce pour la fumée
function puffTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 31);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class TntSystem {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.list = [];       // TNT allumées : { id, pos, vel, fuse, block, mesh }
    this.nextId = 0;
    this.remote = false;  // client en multijoueur : l'hôte simule
    this.shake = 0;       // tremblement de caméra (lu par main.js)
    this.onBoom = null;    // explosion vue par le joueur local (dégâts en survie)
    this.onExplode = null; // multijoueur : explosion à annoncer aux clients
    this.onPush = null;   // objets collés à projeter (voir structs.js)
    this.geometries = {};

    // flash de l'explosion : une lumière toujours présente (éteinte le reste du temps)
    this.flash = new THREE.PointLight(0xffd29a, 0, 18, 1.4);
    scene.add(this.flash);
    this.flashT = 0;
    this.flashMax = 0.35;
    this.flashPower = 60;

    this.puffTex = puffTexture();
    this.smoke = Array.from({ length: SMOKE }, () => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.puffTex, transparent: true, depthWrite: false, color: 0x777777 }));
      s.visible = false;
      s.userData = { vel: new THREE.Vector3(), life: 0, max: 1, size: 1, fire: false };
      scene.add(s);
      return s;
    });
    this.nextSmoke = 0;
    this.clouds = [];     // champignons en cours (Big TNT)
    this.cloudPool = null;
    this.nextCloud = 0;
    this.blast = [];      // destructions en cours : { list: [[q, r, y], ...], i }
  }

  // Modèle 3D de la TNT (prisme hexagonal, centré pour pouvoir gonfler)
  model(block) {
    if (!this.geometries[block]) {
      const arrays = buildBlocksArrays([[0, 0, 0, block]], this.world.uvTable);
      this.geometries[block] = geometryFrom(arrays);
      this.geometries[block].translate(0, -0.5, 0);
    }
    const mat = this.world.material.clone();
    mat.emissive = new THREE.Color(0xffffff);
    mat.emissiveIntensity = 0;
    const mesh = new THREE.Mesh(this.geometries[block], mat);
    mesh.castShadow = true;
    this.scene.add(mesh);
    return mesh;
  }

  add(id, x, y, z, fuse, block = TNT) {
    const t = { id, pos: new THREE.Vector3(x, y, z), vel: new THREE.Vector3(), fuse, block, mesh: this.model(block) };
    this.list.push(t);
    return t;
  }

  removeEntity(t) {
    t.sound?.stop();
    this.scene.remove(t.mesh);
    t.mesh.material.dispose();
    this.list = this.list.filter((x) => x !== t);
  }

  clear() {
    for (const t of [...this.list]) this.removeEntity(t);
    for (const s of this.smoke) s.visible = false;
    for (const s of this.cloudPool || []) s.visible = false;
    this.clouds = [];
    this.blast = [];
    if (this.wave) this.wave.visible = false;
    this.flash.intensity = 0;
    this.shake = 0;
  }

  // TNT allumée hors du monde (arrachée d'un objet physique) : (x, y, z) = bas du bloc,
  // vel = vitesse de l'objet à cet endroit
  launch(x, y, z, vel, block, fuse = null, listener = null) {
    if (this.remote || !isTnt(block)) return;
    const f = fuse ?? kindOf(block).fuse;
    const t = this.add(++this.nextId, x, y, z, f, block);
    if (vel) t.vel.copy(vel);
    if (listener) t.sound = playFuse(listener.distanceTo(t.pos), f);
  }

  // Allume la TNT (ou la Big TNT) de la case (q, r, y)
  ignite(q, r, y, fuse = null, listener = null) {
    if (this.remote) return;
    const block = this.world.getBlock(q, r, y);
    if (!isTnt(block)) return;
    const f = fuse ?? kindOf(block).fuse;
    this.world.setBlock(q, r, y, AIR);
    const c = hexToWorld(q, r);
    const t = this.add(++this.nextId, c.x, y, c.z, f, block);
    // petit saut, comme dans Minecraft
    const a = Math.random() * Math.PI * 2;
    t.vel.set(Math.cos(a) * 0.6, 4, Math.sin(a) * 0.6);
    if (listener) t.sound = playFuse(listener.distanceTo(t.pos), f);
  }

  // Un bloc vient de changer : une torche d'énergie allumée à côté d'une TNT l'allume
  onBlockSet(q, r, y, id, listener) {
    if (this.remote) return;
    const around = [[0, 0, 1], [0, 0, -1], ...NEIGHBORS.map(([dq, dr]) => [dq, dr, 0])];
    if (id === ENERGY_TORCH) {
      for (const [dq, dr, dy] of around) {
        if (isTnt(this.world.getBlock(q + dq, r + dr, y + dy))) this.ignite(q + dq, r + dr, y + dy, null, listener);
      }
    } else if (isTnt(id)) {
      for (const [dq, dr, dy] of around) {
        if (this.world.getBlock(q + dq, r + dr, y + dy) === ENERGY_TORCH) { this.ignite(q, r, y, null, listener); return; }
      }
    }
  }

  // ---------- Simulation (hôte / solo) ----------
  update(dt, ctx) {
    // le grésillement de la mèche suit la distance (la TNT bouge, le joueur aussi)
    if (ctx.listener) for (const t of this.list) t.sound?.setDistance(ctx.listener.distanceTo(t.pos));
    if (!this.remote) {
      this.eatBlast();
      for (const t of [...this.list]) {
        this.step(t, dt);
        t.fuse -= dt;
        if (t.fuse <= 0) {
          this.removeEntity(t);
          this.explode(t.pos.x, t.pos.y, t.pos.z, ctx, t.block);
        }
      }
    } else {
      // client : on glisse vers la position reçue
      const k = 1 - Math.exp(-dt * 15);
      for (const t of this.list) {
        if (t.target) t.pos.lerp(t.target, k);
        t.fuse -= dt;
      }
    }
    for (const t of this.list) this.place(t);
    this.effects(dt, ctx);
  }

  step(t, dt) {
    const w = this.world, p = t.pos, v = t.vel;
    // objets physiques (voir structs.js) : la TNT s'y cogne et se pose dessus, comme sur le
    // terrain ; posée sur un objet qui bouge, elle part avec lui
    const S = this.structs, sv = this._sv ||= new THREE.Vector3();
    const onStruct = (x, y, z) => S?.solidAt(x, y, z, sv) ?? null;
    v.y = Math.max(-40, v.y - G * dt);
    // horizontal : bloqué par les blocs pleins
    const nx = p.x + v.x * dt, nz = p.z + v.z * dt;
    const h = worldToHex(nx, nz);
    if (SOLID[w.getBlock(h.q, h.r, Math.floor(p.y + 0.01))]) { v.x = 0; v.z = 0; }
    else if (onStruct(nx, p.y + 0.3, nz)) { v.x = sv.x; v.z = sv.z; p.x += sv.x * dt; p.z += sv.z * dt; }
    else { p.x = nx; p.z = nz; }
    // vertical : se pose sur le sol
    const c = worldToHex(p.x, p.z);
    const ny = p.y + v.y * dt;
    if (v.y < 0 && SOLID[w.getBlock(c.q, c.r, Math.floor(ny))]) {
      p.y = Math.floor(ny) + 1;
      v.y = 0;
      v.x *= 0.5; v.z *= 0.5;
    } else if (v.y > 0 && SOLID[w.getBlock(c.q, c.r, Math.floor(ny + 1))]) {
      v.y = 0;
    } else if (v.y <= 0 && onStruct(p.x, ny, p.z)) {
      // posée sur un objet : elle suit sa vitesse (frottement : l'horizontale le rejoint vite)
      v.y = sv.y;
      v.x += (sv.x - v.x) * Math.min(1, dt * 8);
      v.z += (sv.z - v.z) * Math.min(1, dt * 8);
      p.y += sv.y * dt;
    } else if (v.y > 0 && onStruct(p.x, ny + 1, p.z)) {
      v.y = Math.min(v.y, sv.y);
    } else {
      p.y = ny;
    }
    if (p.y < -DEPTH - 30) { t.fuse = 0; }
  }

  // Clignote en blanc, de plus en plus vite, et gonfle juste avant d'exploser
  place(t) {
    t.mesh.position.set(t.pos.x, t.pos.y + 0.5, t.pos.z);
    const blink = Math.floor(t.fuse * (t.fuse < 1 ? 8 : 4)) % 2 === 0;
    t.mesh.material.emissiveIntensity = blink ? 0.75 : 0;
    const swell = t.fuse < 0.35 ? 1 + (0.35 - t.fuse) * (0.6 + 0.6 * kindOf(t.block).level) : 1;
    t.mesh.scale.setScalar(swell);
  }

  // ---------- Explosion ----------
  // ctx : { player, carts, listener } — côté client, seulement les effets et le recul
  explode(x, y, z, ctx, block = TNT) {
    const w = this.world;
    const kind = kindOf(block);
    const big = kind.level;
    const cy = y + 0.5;
    const hc = worldToHex(x, z);
    const inWater = isWater(w.getBlock(hc.q, hc.r, Math.floor(cy)));
    if (!this.remote && !inWater && kind.radius > HUGE) {
      this.hugeBlast(hc, x, cy, z, kind.radius, ctx.listener);
      this.pushThings(x, cy, z, ctx, kind);
      if (this.onExplode) this.onExplode(x, y, z, big);
    } else if (!this.remote && !inWater) {
      const R = kind.radius, span = Math.ceil(R) + 1;
      const remove = [], chain = [];
      for (let dq = -span; dq <= span; dq++) {
        for (let dr = -span; dr <= span; dr++) {
          const q = hc.q + dq, r = hc.r + dr;
          const c = hexToWorld(q, r);
          const dxz = Math.hypot(c.x - x, c.z - z);
          if (dxz > R + 0.5) continue;
          for (let yy = Math.floor(cy - R); yy <= Math.ceil(cy + R); yy++) {
            const d = Math.hypot(dxz, yy + 0.5 - cy);
            if (d > R) continue;
            // bord irrégulier : plus on s'éloigne, moins le bloc a de chances de partir
            if (d > R * 0.6 && Math.random() > 0.15 + 0.85 * (R - d) / (R * 0.4)) continue;
            const id = w.getBlock(q, r, yy);
            if (!id || isLiquid(id) || BLOCKS[id]?.unbreakable) continue;
            if (isTnt(id)) chain.push([q, r, yy]);
            else remove.push([q, r, yy]);
          }
        }
      }
      // du haut vers le bas : les rails et torches posés dessus partent avec leur bloc
      remove.sort((a, b) => b[2] - a[2]);
      for (const [q, r, yy] of remove) w.setBlock(q, r, yy, AIR);
      for (const [q, r, yy] of chain) this.ignite(q, r, yy, 0.5 + Math.random() * 1.0, ctx.listener);
      this.pushThings(x, cy, z, ctx, kind);
      if (this.onExplode) this.onExplode(x, y, z, big); // multijoueur : l'hôte prévient les clients
    }
    this.boomEffects(x, cy, z, ctx, big);
  }

  // Énorme explosion : les cases sont rangées par anneaux (1 bloc d'épaisseur) autour du
  // centre, puis détruites peu à peu, du centre vers le bord (voir eatBlast)
  hugeBlast(hc, x, cy, z, R, listener) {
    const span = Math.ceil(R) + 1, rings = Array.from({ length: span + 1 }, () => []);
    const y0 = Math.max(0, Math.floor(cy - R)), y1 = Math.min(H - 1, Math.ceil(cy + R));
    for (let dq = -span; dq <= span; dq++) {
      for (let dr = -span; dr <= span; dr++) {
        const q = hc.q + dq, r = hc.r + dr;
        const c = hexToWorld(q, r);
        const dxz = Math.hypot(c.x - x, c.z - z);
        if (dxz > R + 0.5) continue;
        for (let yy = y0; yy <= y1; yy++) {
          const d = Math.hypot(dxz, yy + 0.5 - cy);
          if (d > R) continue;
          if (d > R * 0.6 && Math.random() > 0.15 + 0.85 * (R - d) / (R * 0.4)) continue;
          rings[Math.floor(d)].push(q, r, yy);
        }
      }
    }
    this.blast.push({ rings, ring: 0, i: 0, R, listener });
  }

  // Continue les énormes explosions, sans dépasser BUDGET ms par image. Au cœur, les cases
  // sont vidées sans prévenir les voisines (elles partent toutes) : bien plus rapide.
  eatBlast() {
    if (!this.blast.length) return;
    const w = this.world, end = performance.now() + BUDGET;
    while (this.blast.length && performance.now() < end) {
      const b = this.blast[0];
      const list = b.rings[b.ring], quiet = b.ring < b.R - 2;
      for (let n = 0; n < 300 && b.i < list.length; n++, b.i += 3) {
        const q = list[b.i], r = list[b.i + 1], y = list[b.i + 2];
        const id = w.getBlock(q, r, y);
        if (!id || isLiquid(id) || BLOCKS[id]?.unbreakable) continue;
        if (isTnt(id)) this.ignite(q, r, y, 0.5 + Math.random(), b.listener);
        else {
          w.setBlock(q, r, y, AIR, quiet);
          // (sans prévenir les voisines... sauf l'eau et la lave qui touchent le trou : elles
          // doivent y couler)
          if (quiet && (isLiquid(w.getBlock(q, r, y + 1)) || NEIGHBORS.some(([dq, dr]) => isLiquid(w.getBlock(q + dq, r + dr, y))))) w.wakeWater(q, r, y);
        }
      }
      if (b.i >= list.length) {
        b.ring++; b.i = 0;
        if (b.ring >= b.rings.length) this.blast.shift();
      }
    }
  }

  // Projette les Hexacarts, les autres TNT et les objets collés (hôte / solo)
  pushThings(x, y, z, ctx, kind = KINDS[TNT]) {
    const R2 = kind.radius * 2, dir = new THREE.Vector3();
    const boost = Math.sqrt(kind.power) * 0.55 + 0.45; // Big TNT : ~3 fois plus fort
    const force = (p) => {
      dir.set(p.x - x, p.y - y, p.z - z);
      const d = dir.length();
      if (d > R2) return 0;
      if (d > 1e-3) dir.divideScalar(d); else dir.set(0, 1, 0);
      return (1 - d / R2) * boost;
    };
    for (const cart of ctx.carts?.carts || []) {
      const f = force(cart.pos) * 22;
      if (!f) continue;
      if (cart.rail) {
        // assez fort : le chariot déraille et vole
        if (f > 10) { ctx.carts.derail(cart); cart.vel.addScaledVector(dir, f); cart.vel.y += f * 0.3; }
        else cart.v += ctx.carts.dirAt(cart.rail, cart.s).dot(dir) * f;
      } else {
        cart.vel.addScaledVector(dir, f);
        cart.vel.y += f * 0.3;
      }
    }
    for (const t of this.list) {
      const f = force(t.pos) * 10;
      if (f) { t.vel.addScaledVector(dir, f); t.vel.y += f * 0.4; }
    }
    if (this.onPush) this.onPush(x, y, z, kind.radius, boost);
  }

  // Flash, fumée, tremblement, son et recul du joueur local (tout le monde).
  // big : niveau de l'explosion (0 TNT, 1 Big TNT, 2 TNT 200, 3 TNT 1000)
  boomEffects(x, y, z, ctx, big = 0) {
    big = Number(big) || 0;
    const player = ctx.player;
    const center = new THREE.Vector3(x, y, z);
    const R = levelKind(big).radius;
    if (this.onBoom) this.onBoom(center, R, big); // dégâts au joueur local (mode survie)
    this.flash.position.copy(center);
    this.flash.distance = [18, 120, 260, 600][big];
    this.flashPower = [60, 900, 3000, 12000][big];
    this.flashMax = this.flashT = [0.35, 1.4, 2.2, 3.5][big];
    this.flash.intensity = this.flashPower;
    for (let i = 0; i < 22; i++) this.puff(center, i < 8);
    if (big) this.mushroom(center, MUSHROOM[big]);
    if (player) {
      const pc = new THREE.Vector3(player.pos.x, player.pos.y + 0.9, player.pos.z);
      const d = pc.distanceTo(center);
      const shakeReach = [24, 160, 360, 800][big], shakeMax = [0.6, 2.2, 3.2, 4.5][big];
      this.shake = Math.max(this.shake, Math.max(0, 1 - d / shakeReach) * shakeMax);
      playExplosion(d, big);
      // recul (le joueur dans un Hexacarts part avec le chariot, chez l'hôte)
      const R2 = R * 2;
      if (d < R2 && !player.riding) {
        const f = (1 - d / R2) * [16, 42, 70, 110][big];
        const dir = pc.sub(center).normalize();
        player.vel.addScaledVector(dir, f);
        player.vel.y += f * 0.35;
        player.onGround = false;
      }
    }
  }

  puff(center, fire) {
    const s = this.smoke[this.nextSmoke];
    this.nextSmoke = (this.nextSmoke + 1) % SMOKE;
    const u = s.userData;
    s.position.copy(center).add(new THREE.Vector3((Math.random() - 0.5) * 2, (Math.random() - 0.3) * 1.5, (Math.random() - 0.5) * 2));
    u.vel.set((Math.random() - 0.5) * 5, 1.5 + Math.random() * 3, (Math.random() - 0.5) * 5);
    u.fire = fire;
    u.max = u.life = fire ? 0.35 + Math.random() * 0.2 : 1.2 + Math.random() * 1.2;
    u.size = fire ? 1.6 + Math.random() : 1.2 + Math.random() * 1.4;
    s.visible = true;
  }

  // ---------- Champignon de la Big TNT ----------
  // Boule de feu, onde de choc au sol, anneau de poussière, puis une colonne de fumée qui
  // monte et s'ouvre en chapeau (le chapeau rougeoie d'abord, puis devient gris foncé).
  // scale : taille du champignon (1 Big TNT, 2,2 TNT 200, 4 TNT 1000)
  mushroom(center, scale = 1) {
    if (!this.cloudPool) {
      this.cloudPool = Array.from({ length: CLOUD }, () => {
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.puffTex, transparent: true, depthWrite: false, fog: false }));
        s.visible = false;
        s.userData = { vel: new THREE.Vector3(), life: 0, max: 1, size: 1, grow: 1, type: 'stem', drag: 1, rise: 0 };
        this.scene.add(s);
        return s;
      });
      // onde de choc : anneau plat qui s'élargit très vite
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 64), new THREE.MeshBasicMaterial({
        color: 0xffe0b0, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      }));
      ring.rotation.x = -Math.PI / 2;
      ring.visible = false;
      this.scene.add(ring);
      this.wave = ring;
    }
    this.clouds.push({ c: center.clone(), t: 0, stem: 0, cap: 0, scale });
    this.wave.position.set(center.x, center.y - 0.3, center.z);
    this.wave.userData.t = 0;
    this.wave.userData.scale = scale;
    this.wave.visible = true;
    // boule de feu
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * Math.PI * 2, e = Math.random() * 0.9, sp = (3 + Math.random() * 7) * scale;
      this.cloudPart('fire', center, [Math.cos(a) * Math.cos(e) * sp, Math.sin(e) * sp + 4 * scale, Math.sin(a) * Math.cos(e) * sp],
        1.2 + Math.random() * 0.8, (4 + Math.random() * 4) * scale, 2.4, 1.6);
    }
    // anneau de poussière qui court au ras du sol
    for (let i = 0; i < 44; i++) {
      const a = (i / 44) * Math.PI * 2 + Math.random() * 0.1, sp = (16 + Math.random() * 10) * scale;
      this.cloudPart('dust', center, [Math.cos(a) * sp, 0.6 + Math.random(), Math.sin(a) * sp],
        4 + Math.random() * 2.5, (3 + Math.random() * 2) * scale, 2.2, 1.2);
    }
  }

  cloudPart(type, center, vel, life, size, grow, drag, offset = null) {
    const s = this.cloudPool[this.nextCloud];
    this.nextCloud = (this.nextCloud + 1) % CLOUD;
    const u = s.userData;
    s.position.copy(center);
    if (offset) s.position.add(offset);
    u.vel.set(vel[0], vel[1], vel[2]);
    u.type = type;
    u.max = u.life = life;
    u.size = size;
    u.grow = grow;
    u.drag = drag;
    s.visible = true;
  }

  updateClouds(dt) {
    for (const cl of this.clouds) {
      const k = cl.scale, H = 30 * k; // hauteur du chapeau
      cl.t += dt;
      // colonne : de la fumée part du sol et monte, pendant 3 s
      if (cl.t < 3) {
        cl.stem += dt * 40;
        for (; cl.stem >= 1; cl.stem--) {
          const a = Math.random() * Math.PI * 2, r = (1 + Math.random() * 1.6) * k;
          // répartie sur toute la hauteur déjà atteinte, montée lente : la colonne reste
          const h = Math.random() * Math.min(H - 3, (4 + cl.t * 10) * k);
          this.cloudPart('stem', cl.c, [Math.cos(a) * 0.6, (2 + Math.random() * 2.5) * k, Math.sin(a) * 0.6],
            10 + Math.random() * 3, (3.5 + Math.random() * 2) * k, 0.9, 0.9, new THREE.Vector3(Math.cos(a) * r, h, Math.sin(a) * r));
        }
      }
      // chapeau : au sommet, la fumée s'ouvre en anneau qui roule vers l'extérieur
      if (cl.t > 0.9 && cl.t < 3.6) {
        cl.cap += dt * 45;
        for (; cl.cap >= 1; cl.cap--) {
          const a = Math.random() * Math.PI * 2, sp = (4 + Math.random() * 6) * k;
          const top = new THREE.Vector3(Math.cos(a) * 2 * k, Math.min(H, (10 + cl.t * 7) * k) + (Math.random() - 0.5) * 3 * k, Math.sin(a) * 2 * k);
          this.cloudPart('cap', cl.c, [Math.cos(a) * sp, (1.5 + Math.random() * 2.5) * k, Math.sin(a) * sp],
            13 + Math.random() * 4, (8 + Math.random() * 4) * k, 1.2, 0.55, top);
        }
      }
    }
    this.clouds = this.clouds.filter((cl) => cl.t < 4);
    // onde de choc
    const wv = this.wave;
    if (wv?.visible) {
      wv.userData.t += dt;
      const k = wv.userData.t / 1.3;
      if (k >= 1) wv.visible = false;
      else {
        const r = 2 + (1 - (1 - k) ** 2) * 60 * (wv.userData.scale || 1);
        wv.scale.set(r, r, 1);
        wv.material.opacity = (1 - k) * 0.8;
      }
    }
    for (const s of this.cloudPool || []) {
      if (!s.visible) continue;
      const u = s.userData;
      u.life -= dt;
      if (u.life <= 0) { s.visible = false; continue; }
      const k = u.life / u.max, age = u.max - u.life;
      s.position.addScaledVector(u.vel, dt);
      u.vel.multiplyScalar(Math.max(0, 1 - dt * u.drag));
      if (u.type === 'cap') u.vel.y -= dt * 0.9 * (1 - k);  // les bords du chapeau retombent un peu
      if (u.type === 'stem' || u.type === 'fire') u.vel.y += dt * 1.5;
      const size = u.size * (1 + (1 - k) * u.grow);
      s.scale.set(size, size, 1);
      const c = s.material.color;
      if (u.type === 'fire') {
        c.setRGB(1, 0.45 + 0.5 * k, 0.12 * k);
        s.material.opacity = Math.min(1, k * 1.6);
      } else if (u.type === 'cap') {
        // rougeoie au début, puis fumée sombre
        const glow = Math.max(0, 1 - age / 2.2);
        c.setRGB(0.1 + 0.9 * glow, 0.09 + 0.3 * glow, 0.08 + 0.02 * glow);
        s.material.opacity = Math.min(0.95, k * 2.2);
      } else if (u.type === 'stem') {
        const glow = Math.max(0, 1 - age / 1.2);
        c.setRGB(0.12 + 0.8 * glow, 0.1 + 0.25 * glow, 0.09);
        s.material.opacity = Math.min(0.9, k * 2);
      } else {
        c.setRGB(0.3, 0.24, 0.17);
        s.material.opacity = Math.min(0.75, k * 1.5);
      }
    }
  }

  effects(dt) {
    if (this.flashT > 0) {
      this.flashT -= dt;
      this.flash.intensity = Math.max(0, this.flashT / this.flashMax) * this.flashPower;
    }
    this.shake = Math.max(0, this.shake - dt * 1.4);
    for (const s of this.smoke) {
      if (!s.visible) continue;
      const u = s.userData;
      u.life -= dt;
      if (u.life <= 0) { s.visible = false; continue; }
      const k = u.life / u.max;
      s.position.addScaledVector(u.vel, dt);
      u.vel.multiplyScalar(Math.max(0, 1 - dt * 2.2));
      u.vel.y += dt * 0.8; // la fumée monte
      const size = u.size * (u.fire ? 1 + (1 - k) * 1.5 : 1 + (1 - k) * 2.2);
      s.scale.set(size, size, 1);
      if (u.fire) s.material.color.setRGB(1, 0.55 + 0.4 * k, 0.2 * k);
      else s.material.color.setScalar(0.35 + 0.25 * k);
      s.material.opacity = u.fire ? k : Math.min(1, k * 1.5) * 0.7;
    }
    if (this.cloudPool) this.updateClouds(dt);
  }

  // Une TNT bouge encore (ombres à recalculer ; la fumée ne fait pas d'ombre)
  get busy() { return this.list.length > 0 || this.blast.length > 0; }

  // ---------- Multijoueur ----------
  state() {
    const r = (v) => Math.round(v * 1000) / 1000;
    return this.list.map((t) => [t.id, r(t.pos.x), r(t.pos.y), r(t.pos.z), r(t.fuse), kindOf(t.block).level]);
  }

  applyState(list, listener) {
    const seen = new Set();
    for (const e of list) {
      if (!Array.isArray(e) || e.length < 5) continue;
      const [id, x, y, z, fuse, big] = e;
      let t = this.list.find((o) => o.id === id);
      if (!t) {
        t = this.add(id, x, y, z, fuse, LEVELS[big] ?? TNT);
        if (listener) t.sound = playFuse(listener.distanceTo(t.pos), fuse);
      }
      (t.target ||= new THREE.Vector3()).set(x, y, z);
      t.fuse = fuse;
      seen.add(id);
    }
    for (const t of [...this.list]) if (!seen.has(t.id)) this.removeEntity(t);
  }
}
