// Les Hexaliens : de petites créatures de 1,5 bloc, dessinées à plat (en 2D, toujours tournées
// vers la caméra), qui vivent dans les grottes entre -20 et -10 (voir gen.js : hexCaveIn).
// Faits pour survivre sous terre, sans lumière : ils brillent d'eux-mêmes (on les voit dans le
// noir). Parfaitement inoffensifs : ils prennent le joueur pour l'un des leurs. Ils le saluent,
// le suivent un moment, sautent quand il saute ; frappés, ils sont étourdis, puis vexés.
// Chaque joueur voit les siens (ils naissent des grottes autour de lui : rien à sauvegarder ni
// à envoyer en multijoueur).
import * as THREE from 'three';
import { hexToWorld, worldToHex } from './hex.js?v=1.1.5-alpha-mvm2b95g';
import { SOLID } from './blocks.js?v=1.1.5-alpha-mvm2b95g';

// poses (une image chacune, texture/entites/hexalien)
const POSES = ['debout', 'marche', 'assis', 'sommeil', 'mange', 'salut', 'saut', 'joie', 'etourdi', 'fache'];
const TALL = 1.62;           // taille de l'image (le personnage y fait environ 1,5 bloc)
const FOOT = 0.06;           // marge sous ses pieds dans l'image (part de la hauteur)
const SPAWN_R = 56, DROP_R = 90, LOOK_EVERY = 1;
const WALK = 1.15, GRAVITY = 24, HOP = 6.2;
const GREET_R = 7, FOLLOW_MIN = 2.4, FOLLOW_MAX = 14;
const rnd = (a, b) => a + Math.random() * (b - a);

export class Hexaliens {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.list = [];
    this.caves = new Map();   // grotte peuplée -> ses Hexaliens
    this.look = 0;
    this.mats = null;
    this.geo = new THREE.PlaneGeometry(TALL, TALL).translate(0, TALL * (0.5 - FOOT), 0);
  }

  // Images : réduites à 384 px (elles font 2000 px), une matière par pose
  loadMats() {
    if (this.mats) return;
    this.mats = {};
    for (const pose of POSES) {
      const mat = new THREE.MeshBasicMaterial({ transparent: true, alphaTest: 0.35, side: THREE.DoubleSide, depthWrite: true, fog: true });
      mat.color.setScalar(0.92);
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = c.height = 384;
        c.getContext('2d').drawImage(img, 0, 0, 384, 384);
        const t = new THREE.CanvasTexture(c);
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 4;
        mat.map = t;
        mat.needsUpdate = true;
      };
      img.src = 'texture/entites/hexalien/' + pose + '.webp';
      this.mats[pose] = mat;
    }
  }

  clear() {
    for (const a of this.list) this.scene.remove(a.mesh);
    this.list = [];
    this.caves.clear();
    this.pets = 0;
  }

  // Œuf d'Hexalien : il apparaît en (x, y, z) et vit autour (son « chez lui », à la place d'une
  // grotte) ; ceux-là sont gardés avec le monde (voir serialize)
  spawnAt(x, y, z) {
    this.loadMats();
    const { q, r } = worldToHex(x, z);
    const home = { key: 'oeuf' + (this.pets = (this.pets || 0) + 1), q, r, y: Math.floor(y) - 1, R: 7, egg: true };
    const mesh = new THREE.Mesh(this.geo, this.mats.debout);
    const at = new THREE.Vector3(x, y, z);
    mesh.position.copy(at);
    this.scene.add(mesh);
    const al = { cave: home, pos: at, vy: 0, ground: false, state: 'greet', t: 2.2, pose: 'salut', mesh, target: null, face: 1, phase: 0, greetT: 30, follow: 0 };
    this.list.push(al);
    return al;
  }
  serialize() {
    return this.list.filter((a) => a.cave.egg).map((a) => [+a.pos.x.toFixed(2), +a.pos.y.toFixed(2), +a.pos.z.toFixed(2), a.cave.q, a.cave.r, a.cave.y]);
  }
  load(list) {
    if (!Array.isArray(list)) return;
    for (const e of list.slice(0, 200)) {
      if (!Array.isArray(e) || !e.slice(0, 6).every(Number.isFinite)) continue;
      const a = this.spawnAt(e[0], e[1], e[2]);
      Object.assign(a.cave, { q: e[3], r: e[4], y: e[5] });
      this.set(a, 'idle', 'debout', Math.random() * 3);
      a.greetT = 0;
    }
  }

  // Sol sous le point (x, y, z) : le dessus du premier bloc plein en dessous (3 blocs au plus)
  ground(x, y, z) {
    const { q, r } = worldToHex(x, z);
    for (let yy = Math.floor(y + 0.5); yy >= Math.floor(y) - 3; yy--) if (SOLID[this.world.getBlock(q, r, yy)]) return yy + 1;
    return null;
  }
  // Peut-il se tenir en (x, z) à la hauteur y (2 cases libres au-dessus du sol) ?
  free(x, y, z) {
    const { q, r } = worldToHex(x, z), b = Math.floor(y + 0.05);
    return !SOLID[this.world.getBlock(q, r, b)] && !SOLID[this.world.getBlock(q, r, b + 1)];
  }

  spawnCave(c) {
    const group = [];
    const n = 3 + Math.floor(((c.q * 31 + c.r * 17) & 0xffff) % 4);
    for (let i = 0; i < n; i++) {
      // (une place libre sur le sol de la grotte, près du centre)
      let at = null;
      for (let k = 0; k < 12 && !at; k++) {
        const a = Math.random() * Math.PI * 2, d = Math.random() * c.R * 0.55;
        const w = hexToWorld(c.q, c.r), x = w.x + Math.cos(a) * d, z = w.z + Math.sin(a) * d;
        const g = this.ground(x, c.y + 3, z);
        if (g !== null && this.free(x, g, z)) at = new THREE.Vector3(x, g, z);
      }
      if (!at) continue;
      const mesh = new THREE.Mesh(this.geo, this.mats.debout);
      mesh.position.copy(at);
      this.scene.add(mesh);
      const al = { cave: c, pos: at, vy: 0, ground: true, state: 'idle', t: rnd(0.5, 3), pose: 'debout', mesh, target: null, face: 1, phase: Math.random() * 6, greetT: 0, follow: 0 };
      group.push(al);
      this.list.push(al);
    }
    this.caves.set(c.key, group);
  }

  // Nouvel état, pour un moment (pose : l'image)
  set(a, state, pose, t) { a.state = state; a.pose = pose; a.t = t; }

  // Un joueur le frappe : étourdi, puis vexé (jamais blessé, il ne se venge pas)
  hit(a) {
    this.set(a, 'dizzy', 'etourdi', 2.5);
    a.follow = 0;
    a.vy = 3;
    a.ground = false;
  }

  // Hexalien visé par le rayon (origine, direction normalisée, portée), ou null
  rayHit(o, d, reach) {
    let best = null, bt = reach;
    for (const a of this.list) {
      // (cylindre de 0,35 de rayon, de ses pieds à 1,5 au-dessus)
      const px = a.pos.x - o.x, pz = a.pos.z - o.z, hl = d.x * d.x + d.z * d.z;
      if (hl < 1e-6) continue;
      const t = (px * d.x + pz * d.z) / hl;
      if (t < 0 || t > bt) continue;
      const cx = o.x + d.x * t - a.pos.x, cz = o.z + d.z * t - a.pos.z, y = o.y + d.y * t;
      if (cx * cx + cz * cz < 0.35 * 0.35 && y >= a.pos.y && y <= a.pos.y + 1.5) { best = a; bt = t; }
    }
    this.hitT = bt; // (distance du coup : un bloc plus près le cache)
    return best;
  }

  // player : { pos, vel } ; cam : la caméra (ils lui font face)
  update(dt, player, cam) {
    // grottes autour du joueur : peuplées quand leur terrain est chargé, vidées au loin
    if ((this.look -= dt) <= 0) {
      this.look = LOOK_EVERY;
      const { q, r } = worldToHex(player.pos.x, player.pos.z);
      if (player.pos.y < 20 && this.world.gen.hexCavesNear) {
        for (const c of this.world.gen.hexCavesNear(q, r, SPAWN_R)) {
          if (this.caves.has(c.key) || !this.world.isLoaded(c.q, c.r)) continue;
          this.loadMats();
          this.spawnCave(c);
        }
      }
      for (const a of this.list) if (a.cave.egg) a.sleepy = Math.hypot(a.pos.x - player.pos.x, a.pos.z - player.pos.z) > DROP_R;
      for (const [k, group] of [...this.caves]) {
        const c = group[0]?.cave;
        if (c && Math.hypot(hexToWorld(c.q, c.r).x - player.pos.x, hexToWorld(c.q, c.r).z - player.pos.z) < DROP_R) continue;
        for (const a of group) { this.scene.remove(a.mesh); this.list.splice(this.list.indexOf(a), 1); }
        this.caves.delete(k);
      }
    }
    if (!this.list.length) return;
    const pp = player.pos, jumping = player.vel && player.vel.y > 3.5;
    for (const a of this.list) {
      if (a.sleepy) continue;
      this.think(a, dt, pp, jumping);
      this.move(a, dt);
      // face à la caméra (debout : il tourne seulement autour de la verticale) ; retourné selon
      // le côté où il va ; il sautille en marchant
      const m = a.mesh;
      m.position.copy(a.pos);
      a.phase += dt * 9;
      if (a.pose === 'marche' && a.ground) m.position.y += Math.abs(Math.sin(a.phase)) * 0.08;
      m.rotation.y = Math.atan2(cam.position.x - a.pos.x, cam.position.z - a.pos.z);
      if (a.dir) {
        // (vers la droite de l'écran : l'image telle quelle ; vers la gauche : retournée)
        const rx = Math.cos(m.rotation.y), rz = -Math.sin(m.rotation.y);
        const side = a.dir.x * rx + a.dir.z * rz;
        if (Math.abs(side) > 0.15) a.face = side > 0 ? 1 : -1;
      }
      m.scale.x = a.face;
      const mat = this.mats[a.pose];
      if (m.material !== mat) m.material = mat;
    }
  }

  // Ce qu'il fait (une machine à états)
  think(a, dt, pp, jumping) {
    a.t -= dt;
    a.greetT -= dt;
    const dx = pp.x - a.pos.x, dz = pp.z - a.pos.z, dist = Math.hypot(dx, dz), near = dist < GREET_R && Math.abs(pp.y - a.pos.y) < 3;
    if (a.state === 'dizzy') { if (a.t <= 0) this.set(a, 'sulk', 'fache', 1.6); return; }
    if (a.state === 'sulk') { a.dir = null; if (a.t <= 0) this.set(a, 'idle', 'debout', rnd(1, 2)); return; }
    // le joueur saute près de lui : il saute aussi (de joie)
    if (near && jumping && a.ground && a.state !== 'sleep' && a.state !== 'hop') { this.set(a, 'hop', 'saut', 1.2); a.vy = HOP; a.ground = false; return; }
    if (a.state === 'hop') { if (a.ground && a.t <= 0.6) { a.pose = 'joie'; } if (a.t <= 0) this.set(a, 'idle', 'debout', rnd(0.5, 1.5)); return; }
    // un des leurs arrive (le joueur) : il le salue, et parfois le suit un moment
    if (near && a.greetT <= 0 && a.state !== 'sleep' && a.state !== 'greet') {
      a.greetT = rnd(25, 50);
      this.set(a, 'greet', 'salut', 2.2);
      a.dir = new THREE.Vector3(dx, 0, dz).normalize();
      if (Math.random() < 0.45) a.follow = rnd(12, 25);
      return;
    }
    if (a.state === 'greet') { if (a.t <= 0) this.set(a, 'idle', 'debout', rnd(0.3, 1)); return; }
    // il suit le joueur (sans le coller ; il revient chez lui s'il s'éloigne trop)
    if (a.follow > 0) {
      a.follow -= dt;
      if (dist > FOLLOW_MAX || Math.abs(pp.y - a.pos.y) > 4) a.follow = 0;
      else if (dist > FOLLOW_MIN + 0.6) { a.state = 'walk'; a.pose = 'marche'; a.target = new THREE.Vector3(pp.x, a.pos.y, pp.z); return; }
      else if (a.state === 'walk') { this.set(a, 'idle', 'debout', rnd(1, 2)); a.dir = new THREE.Vector3(dx, 0, dz).normalize(); return; }
    }
    if (a.state === 'walk') {
      if (!a.target || Math.hypot(a.target.x - a.pos.x, a.target.z - a.pos.z) < 0.4 || a.t <= -8) this.set(a, 'idle', 'debout', rnd(1, 4));
      return;
    }
    if (a.t > 0) return;
    // au repos : il choisit autre chose à faire
    const k = Math.random();
    if (k < 0.45) {
      const c = a.cave, w = hexToWorld(c.q, c.r), an = Math.random() * Math.PI * 2, d = Math.random() * c.R * 0.6;
      a.target = new THREE.Vector3(w.x + Math.cos(an) * d, a.pos.y, w.z + Math.sin(an) * d);
      this.set(a, 'walk', 'marche', 0);
    } else if (k < 0.6) this.set(a, 'sit', 'assis', rnd(4, 10));
    else if (k < 0.7) this.set(a, 'sleep', 'sommeil', rnd(8, 18));
    else if (k < 0.8) this.set(a, 'eat', 'mange', rnd(3, 6));
    else if (k < 0.87) { this.set(a, 'hop', 'saut', 1.2); a.vy = HOP; a.ground = false; }
    else this.set(a, 'idle', 'debout', rnd(2, 5));
  }

  // Déplacement : il marche vers sa cible (s'arrête devant un mur, monte une marche), tombe
  move(a, dt) {
    if (a.state === 'walk' && a.target) {
      const dx = a.target.x - a.pos.x, dz = a.target.z - a.pos.z, l = Math.hypot(dx, dz);
      if (l > 0.05) {
        a.dir = new THREE.Vector3(dx / l, 0, dz / l);
        const step = Math.min(l, WALK * dt), nx = a.pos.x + a.dir.x * step, nz = a.pos.z + a.dir.z * step;
        if (this.free(nx, a.pos.y, nz)) { a.pos.x = nx; a.pos.z = nz; }
        else if (a.ground && this.free(nx, a.pos.y + 1, nz) && this.free(a.pos.x, a.pos.y + 1, a.pos.z)) { a.vy = HOP * 0.9; a.ground = false; }
        else { a.target = null; this.set(a, 'idle', 'debout', rnd(0.5, 2)); }
      }
    }
    // gravité
    const g = this.ground(a.pos.x, a.pos.y + Math.max(0, a.vy * dt), a.pos.z);
    a.vy -= GRAVITY * dt;
    a.pos.y += a.vy * dt;
    if (g !== null && a.pos.y <= g) { a.pos.y = g; a.vy = 0; a.ground = true; } else a.ground = false;
    if (a.pos.y < -100) a.pos.y = a.cave.y + 1; // (tombé : il revient chez lui)
  }
}
