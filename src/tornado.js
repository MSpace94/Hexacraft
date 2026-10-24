// Tornades (en hexagones, comme tout le jeu) : elles naissent dans les orages forts (voir
// climate.js : même endroit et même moment pour tous les joueurs), descendent du nuage,
// avancent quelques minutes puis remontent. Chacune est faite de prismes hexagonaux, comme
// les nuages : l'entonnoir (des anneaux de prismes qui tournent en spirale, du nuage
// jusqu'au sol ou à la mer), des débris qui tourbillonnent à sa base et un nuage de
// poussière (ou d'embruns) au sol ; plus un grondement. De près, elle aspire le joueur (et
// l'emporte en l'air) et les objets physiques.
// Seules les plus proches sont dessinées (MAX_SHOWN) ; chaque partie est un seul maillage
// « instancié » (un seul appel de dessin pour des centaines de prismes), mis à jour à chaque
// image.
import * as THREE from 'three';
import { CLOUD_Y } from './clouds.js?v=1.1.5-alpha-mvm2b95g';
import { worldToHex } from './hex.js?v=1.1.5-alpha-mvm2b95g';
import { tornadoSound } from './sound.js?v=1.1.5-alpha-mvm2b95g';

const SEE = 700;          // on voit les tornades jusqu'à cette distance (blocs)
const MAX_SHOWN = 3;
const HEAR = 320;         // on entend le grondement jusque-là
const BASE_R = 2.2, TOP_R = 22; // rayon de l'entonnoir au sol et sous le nuage
const LAYERS = 34;        // anneaux de l'entonnoir
const TWIST = 0.35;       // décalage (radians) d'un anneau au suivant : la spirale
const DEBRIS = 150, DUST = 36;
const PULL_R = 18;        // rayon où elle aspire (blocs, à pleine force)
const LIFT_TOP = 40;      // elle soulève jusqu'à LIFT_TOP blocs au-dessus du sol, puis relâche
// Vent de la tornade (tourbillon) : il tourne autour de l'entonnoir (plus vite près du bord du
// cœur), ramène vers l'orbite (le bord de l'entonnoir à cette hauteur) et monte jusqu'à
// LIFT_TOP blocs, où tout reste à tourner. Ce qu'il emporte prend sa vitesse peu à peu (prise
// au vent DRAG) : joueurs, animaux, objets tournent autour de la tornade, puis, au bout de
// CARRY s, s'échappent (à la vitesse où ils tournaient) et sont laissés FREE s.
const VT = 26;            // vitesse du vent tournant (blocs/s) au bord du cœur
const INFLOW = 12;        // vitesse d'aspiration vers l'orbite
const UPDRAFT = 15;       // vent montant, en plus de ce qui porte (compense la gravité)
const DRAG = 3;           // prise au vent (par seconde)
const CORE_PULL = 120;    // force centripète maximale (blocs/s²)
const GRAV = 30;          // gravité du jeu (le vent montant la compense : on flotte en haut)
const CARRY = 8, FREE = 5; // emporté CARRY s au plus, puis laissé FREE s
const MAX_UP = 15;        // vitesse de montée maximale du joueur
const ABOVE_WATER = 3;    // dessinée après l'eau (sinon l'eau, transparente, passe devant)

// Rayon de l'entonnoir à la hauteur relative h (0 : au sol, 1 : sous le nuage)
const radiusAt = (h) => BASE_R + (TOP_R - BASE_R) * h ** 2.3;
// Balancement (comme une corde, plus en bas qu'en haut) : décalage de l'anneau à la hauteur h
function swayAt(h, t, out) {
  const sw = (1 - h) * (1 - h);
  out[0] = (Math.sin(h * 5 + t * 0.9) * 6 + Math.sin(h * 11 - t * 1.7) * 1.5) * sw;
  out[1] = Math.cos(h * 4 + t * 0.7) * 5 * sw;
  return out;
}

// Prismes de l'entonnoir : pour chaque anneau, des prismes répartis sur le cercle (plus
// nombreux et plus gros en haut, où il est large)
function funnelLayout() {
  const cells = [];
  for (let i = 0; i < LAYERS; i++) {
    const h = (i + 0.5) / LAYERS, r = radiusAt(h), size = 0.9 + r * 0.2;
    const n = Math.max(5, Math.round((Math.PI * 2 * r) / (size * 1.45)));
    for (let j = 0; j < n; j++) {
      // gris plus sombre en bas (chargé de poussière), un peu de variété d'un prisme à l'autre
      const shade = 0.55 + 0.3 * h + (Math.random() - 0.5) * 0.12;
      cells.push({ h, a: (Math.PI * 2 * j) / n + i * TWIST, size: size * (0.85 + Math.random() * 0.3), shade });
    }
  }
  return cells;
}

export class Tornadoes {
  constructor(scene, world, clouds) {
    this.world = world;
    this.clouds = clouds;
    this.list = [];
    this.shown = new Map(); // id -> visuel
    this.pool = [];
    this.sound = null;
    this.prism = new THREE.CylinderGeometry(1, 1, 1, 6); // prisme hexagonal (rayon 1, hauteur 1)
    this.layout = funnelLayout();
    this.scene = scene;
    this.acc = new THREE.Vector3();
    this.tornT = 0;    // temps passé emporté (joueur local, voir carry)
    this.tornFree = 0; // échappé : laissé tranquille encore ce temps
    this.m = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.e = new THREE.Euler();
    this.p = new THREE.Vector3();
    this.s = new THREE.Vector3();
    this.sw = [0, 0];
  }

  // Un visuel (repris dans la réserve ou créé) : trois maillages instanciés
  visual() {
    if (this.pool.length) return this.pool.pop();
    const inst = (n, material) => {
      const m = new THREE.InstancedMesh(this.prism, material, n);
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.frustumCulled = false;
      m.renderOrder = ABOVE_WATER;
      return m;
    };
    const funnel = inst(this.layout.length, new THREE.MeshLambertMaterial({ color: 0xb4aea6, flatShading: true, transparent: true, opacity: 0.88 }));
    const c = new THREE.Color();
    this.layout.forEach((cell, i) => funnel.setColorAt(i, c.setScalar(cell.shade)));
    const debris = inst(DEBRIS, new THREE.MeshLambertMaterial({ color: 0x6a5a46, flatShading: true }));
    const dust = inst(DUST, new THREE.MeshLambertMaterial({ color: 0x9a9088, flatShading: true, transparent: true, opacity: 0.5, depthWrite: false }));
    const group = new THREE.Group();
    group.add(funnel, debris, dust);
    // débris et poussière : angle, rayon, hauteur, vitesse, taille, culbute
    const seed = (n) => Array.from({ length: n }, () => [Math.random() * 6.28, Math.random(), Math.random(), 0.6 + Math.random() * 0.8, Math.random(), Math.random() * 6.28]);
    return { group, funnel, debris, dust, d: seed(DEBRIS), u: seed(DUST), spin: Math.random() * 6.28, time: Math.random() * 100 };
  }

  // T : temps (jours) ; active : en jeu ; host : c'est nous qui simulons les objets
  update(dt, T, camera, active, player, structs, host, animals = null) {
    const cam = camera.position;
    this.list = active ? this.clouds.climate.tornadoesNear(cam.x, cam.z, T, SEE, this.list) : [];
    this.list.sort((a, b) => ((a.x - cam.x) ** 2 + (a.z - cam.z) ** 2) - ((b.x - cam.x) ** 2 + (b.z - cam.z) ** 2));
    const keep = new Set();
    let hear = 0;
    for (let n = 0; n < this.list.length && n < MAX_SHOWN; n++) {
      const t = this.list[n];
      keep.add(t.id);
      let v = this.shown.get(t.id);
      if (!v) { v = this.visual(); this.shown.set(t.id, v); this.scene.add(v.group); }
      this.draw(v, t, dt);
      const d = Math.hypot(t.x - cam.x, t.z - cam.z);
      hear = Math.max(hear, t.power * Math.max(0, 1 - d / HEAR) ** 1.5);
      this.pull(t, player, structs, host, dt, animals);
    }
    for (const [id, v] of this.shown) {
      if (keep.has(id)) continue;
      this.scene.remove(v.group);
      this.pool.push(v);
      this.shown.delete(id);
    }
    if (hear > 0.01 && !this.sound) this.sound = tornadoSound();
    this.sound?.setLevel(hear);
  }

  // Sol sous la tornade : la terre, ou la surface de la mer (jamais le fond)
  groundAt(t) {
    const h = worldToHex(t.x, t.z);
    return this.world.gen.surface(h.q, h.r).h + 1;
  }

  // Place un prisme : centre (x, y, z), rayon, hauteur, rotation (autour de y, et culbute)
  put(mesh, i, x, y, z, r, hgt, ry, tilt = 0) {
    this.e.set(tilt, ry, tilt * 0.7);
    this.m.compose(this.p.set(x, y, z), this.q.setFromEuler(this.e), this.s.set(r, hgt, r));
    mesh.setMatrixAt(i, this.m);
  }

  draw(v, t, dt) {
    const ground = this.groundAt(t);
    t.ground = ground;
    const H = CLOUD_Y + 2 - ground, p = t.power;
    v.time += dt;
    v.spin -= dt * 1.6;
    v.group.position.set(t.x, 0, t.z);
    // elle descend du nuage en naissant, y remonte en s'éteignant : on ne montre que les
    // anneaux sous le nuage, jusqu'à la hauteur où elle est arrivée
    const reach = 1 - p * 0.98, wide = 0.6 + 0.4 * p;
    const F = v.funnel, cells = this.layout;
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i];
      if (c.h < reach) { this.put(F, i, 0, -9999, 0, 0, 0, 0); continue; }
      const y = ground + c.h * H, r = radiusAt(c.h) * wide, sw = swayAt(c.h, v.time, this.sw);
      // (en bas, ça tourne plus vite)
      const a = c.a + v.spin * (1.6 - c.h);
      this.put(F, i, Math.cos(a) * r + sw[0], y, Math.sin(a) * r + sw[1], c.size * wide, (H / LAYERS) * 1.25, -a);
    }
    F.instanceMatrix.needsUpdate = true;
    // débris (seulement quand elle touche le sol) : petits prismes qui tourbillonnent en
    // montant, puis retombent
    const show = Math.max(0, (p - 0.5) * 2);
    v.debris.visible = v.dust.visible = show > 0.02;
    if (!v.debris.visible) return;
    for (let i = 0; i < DEBRIS; i++) {
      const q = v.d[i], hy = q[2] * 24 * show;
      const r = BASE_R + 1.2 + q[1] * 8 + hy * 0.3;
      q[0] += dt * q[3] * 24 / r;  // plus vite près du centre
      q[2] += dt * q[3] * 0.16;    // ils montent...
      q[5] += dt * q[3] * 4;       // (en culbutant)
      if (q[2] > 1) { q[2] = 0; q[1] = Math.random(); } // ... puis retombent au sol
      const sw = swayAt(hy / H, v.time, this.sw), s = 0.18 + q[4] * 0.32;
      this.put(v.debris, i, Math.cos(q[0]) * r + sw[0], ground + 0.2 + hy, Math.sin(q[0]) * r + sw[1], s, s * 1.4, q[0], q[5]);
    }
    v.debris.instanceMatrix.needsUpdate = true;
    // nuage de poussière (ou d'embruns sur la mer) : gros prismes plats autour du pied
    for (let i = 0; i < DUST; i++) {
      const q = v.u[i], r = 4 + q[1] * 11;
      q[0] += dt * q[3] * 7 / r;
      const s = (1.4 + q[4] * 1.8) * show;
      this.put(v.dust, i, Math.cos(q[0]) * r, ground + 0.4 + q[2] * 2.2, Math.sin(q[0]) * r, s, s * 0.7, -q[0]);
    }
    v.dust.instanceMatrix.needsUpdate = true;
    v.dust.material.opacity = 0.5 * show;
  }

  // Accélération donnée par le vent au point (x, y, z) à un corps qui va à la vitesse vel
  // (scale : prise au vent, 1 par défaut), ou null trop loin
  force(t, x, y, z, vel, scale = 1) {
    const dx = x - t.x, dz = z - t.z, d = Math.hypot(dx, dz), R = PULL_R * t.power;
    if (d > R || R < 1) return null;
    if (t.ground === undefined) t.ground = this.groundAt(t);
    const top = t.ground + LIFT_TOP;
    const hgt = Math.min(1, Math.max(0, (y - t.ground) / LIFT_TOP));
    const rc = Math.max(2, Math.min(R * 0.4, radiusAt(hgt) * 0.6 * t.power + 1)); // orbite : près du bord de l'entonnoir
    const fade = Math.min(1, (1 - d / R) * 3);                 // (s'atténue au bord de la zone)
    const nx = dx / (d || 1), nz = dz / (d || 1);
    // tourbillon (cœur qui tourne comme un bloc, puis vent qui faiblit en s'éloignant)
    const vt = VT * t.power * (d < rc ? d / rc : Math.sqrt(rc / d));
    const vr = -INFLOW * Math.max(-1, Math.min(1, (d - rc) / rc)); // vers l'orbite
    const vy = GRAV / DRAG + UPDRAFT * Math.max(-1, Math.min(1, (top - y) / 12));
    // (il tourne dans le sens inverse des aiguilles d'une montre, comme au nord)
    const wx = nx * vr + nz * vt, wz = nz * vr - nx * vt;
    const k = DRAG * fade * scale;
    // dépression du cœur : elle retient ce qui tourne (force centripète v²/d), sinon tout
    // serait éjecté au premier tour
    const vtb = vel.x * nz - vel.z * nx;
    const ac = Math.min(CORE_PULL, (vtb * vtb) / Math.max(d, 1)) * fade * scale;
    return this.acc.set((wx - vel.x) * k - nx * ac, (vy - vel.y) * k, (wz - vel.z) * k - nz * ac);
  }

  // Emporté depuis assez longtemps ? (o : qui garde son minuteur ; il s'échappe, puis est laissé
  // tranquille FREE s)
  carry(o, inside, dt) {
    if (o.tornFree > 0) { o.tornFree -= dt; return false; }
    if (!inside) { o.tornT = Math.max(0, (o.tornT || 0) - dt); return false; }
    o.tornT = (o.tornT || 0) + dt;
    if (o.tornT > CARRY) { o.tornT = 0; o.tornFree = FREE; return false; }
    return true;
  }

  pull(t, player, structs, host, dt, animals = null) {
    if (player && !player.riding) {
      const f = this.force(t, player.pos.x, player.pos.y, player.pos.z, player.vel);
      if (this.carry(this, !!f, dt) && f) {
        player.vel.addScaledVector(f, dt);
        if (player.vel.y > MAX_UP) player.vel.y = MAX_UP;
        if (f.y > 0) player.onGround = false;
      }
    }
    if (!host) return;
    // animaux : aspirés et emportés comme le joueur (ils paniquent)
    for (const a of animals?.list || []) {
      if (!a.active || a.dead) continue;
      const f = this.force(t, a.pos.x, a.pos.y + 0.5, a.pos.z, a.vel);
      if (!this.carry(a, !!f, dt) || !f) continue;
      a.vel.addScaledVector(f, dt);
      if (a.vel.y > MAX_UP) a.vel.y = MAX_UP;
      if (f.y > 0) a.onGround = false;
      if (a.state !== 'panic') { a.state = 'panic'; a.timer = 3; a.target = null; }
    }
    for (const s of structs?.list || []) {
      if (s.unloaded) continue;
      // les très gros objets résistent un peu mieux (jusqu'à 40 % de moins)
      const f = this.force(t, s.pos.x, s.pos.y, s.pos.z, s.vel, 1 - 0.4 * Math.min(1, Math.max(0, (s.mass - 8000) / 40000)));
      if (!this.carry(s, !!f, dt) || !f) continue;
      // une vraie force (masse x accélération) appliquée au centre de gravité : la
      // simulation de l'objet s'en charge (contacts, frottement, rotation)
      structs.push(s, f.multiplyScalar(s.mass), s.pos, dt);
    }
  }

  clear() {
    for (const [, v] of this.shown) { this.scene.remove(v.group); this.pool.push(v); }
    this.shown.clear();
    this.list = [];
    this.sound?.setLevel(0);
  }
}
