// Cartons : les objets jetés (touche Jeter) tombent dans le monde rangés dans un carton
// hexagonal, plus ou moins gros selon ce qu'il contient (7 tailles, texture/entites/carton/).
// Ils tombent, glissent, flottent ; deux cartons qui se touchent se rassemblent en un plus gros.
// On les ramasse en les visant (touche de l'inventaire), ou tout seuls avec la collecte
// automatique (touche maintenue). Sauvegardés avec le monde.
// En multijoueur, l'hôte les simule et envoie leur état (state / applyState) ; un invité ne fait
// que les afficher, et demande à l'hôte de jeter (onSpawn) ou de ramasser (onTake) un carton.
import * as THREE from 'three';
import { worldToHex, hexToWorld, CORNERS, SIZE } from './hex.js?v=1.1.5-alpha-mvm2b95g';
import { SOLID, blockBox, inSolidPart, isWater } from './blocks.js?v=1.1.5-alpha-mvm2b95g';
import { RADIUS } from './player.js?v=1.1.5-alpha-mvm2b95g';
import { DEPTH } from './gen.js?v=1.1.5-alpha-mvm2b95g';

// Taille selon le nombre d'objets : jusqu'à 1, 4, 8, 16, 32, 64, plus
const TIERS = [1, 4, 8, 16, 32, 64, Infinity];
const WIDTH = [0.36, 0.42, 0.5, 0.58, 0.66, 0.8, 0.95]; // largeur (plat à plat), en blocs
const HEIGHT = 0.62;                                      // hauteur / largeur
const GRAVITY = 22, PULL = 3.2, GRAB = 0.9;
export const countOf = (items) => items.reduce((n, s) => n + s.n, 0);
const tierOf = (n) => TIERS.findIndex((m) => n <= m);
// Deux cartons ne se rassemblent que s'ils contiennent le même objet (et rien d'usé)
const sameKind = (a, b) => a.items.length === 1 && b.items.length === 1 && a.items[0].id === b.items[0].id && !a.items[0].w && !b.items[0].w;

// Range les objets : les mêmes (sans usure) ensemble
export function packItems(list) {
  const out = [];
  for (const s of list) {
    if (!s || !(s.n > 0)) continue;
    const same = !s.w && out.find((o) => o.id === s.id && !o.w);
    if (same) same.n += s.n; else out.push(s.w ? { id: s.id, n: s.n, w: s.w } : { id: s.id, n: s.n });
  }
  return out;
}

export class CartonSystem {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.list = [];
    this.nextId = 1;
    this.geos = WIDTH.map((w) => prism(w, w * HEIGHT));
    const plain = new THREE.MeshLambertMaterial({ color: 0xc4955f });
    this.mats = WIDTH.map(() => [plain, plain, plain, plain, plain]);
    // chaque image : 5 carrés empilés (face avec le visage, côté, côté avec le nœud du scotch,
    // dessus avec la bande de scotch, dessous)
    WIDTH.forEach((_, i) => {
      const img = new Image();
      img.onload = () => {
        const th = img.height / 5;
        this.mats[i] = [0, 1, 2, 3, 4].map((k) => {
          const c = document.createElement('canvas');
          c.width = img.width;
          c.height = Math.round(th);
          const g = c.getContext('2d');
          g.drawImage(img, 0, k * th, img.width, th, 0, 0, c.width, c.height);
          fillHoles(g, c.width, c.height);
          const t = new THREE.CanvasTexture(c);
          t.magFilter = THREE.NearestFilter;
          t.colorSpace = THREE.SRGBColorSpace;
          return new THREE.MeshLambertMaterial({ map: t });
        });
        for (const c of this.list) if (c.tier === i) c.mesh.material = this.mats[i];
      };
      img.src = `texture/entites/carton/carton_${i + 1}.png`;
    });
  }

  // Un carton de plus. items : [{ id, n, w? }] ; vel : vitesse de départ ; delay : temps avant
  // que la collecte automatique ne le reprenne (celui qu'on vient de jeter)
  spawn(pos, items, vel = null, delay = 0) {
    items = packItems(items);
    if (!items.length) return null;
    const c = {
      id: this.nextId++, items, pos: pos.clone(), vel: vel ? vel.clone() : new THREE.Vector3(),
      yaw: Math.random() * Math.PI * 2, spin: (Math.random() - 0.5) * 6, delay, pop: 0, tier: -1, mesh: null, ground: false,
      tx: 0, tz: 0, tvx: 0, tvz: 0, // (inclinaison, qui se redresse au sol)
    };
    this.list.push(c);
    this.refresh(c);
    return c;
  }

  // Taille (et maillage) selon le contenu
  refresh(c) {
    const t = tierOf(countOf(c.items));
    if (t === c.tier) return;
    c.tier = t;
    c.w = WIDTH[t];
    c.h = WIDTH[t] * HEIGHT;
    if (!c.mesh) {
      c.mesh = new THREE.Mesh(this.geos[t], this.mats[t]);
      c.mesh.castShadow = true;
      this.scene.add(c.mesh);
    } else {
      c.mesh.geometry = this.geos[t];
      c.mesh.material = this.mats[t];
    }
    c.pop = 1; // (petit rebond quand il grossit)
  }

  remove(c) {
    this.scene.remove(c.mesh);
    this.list.splice(this.list.indexOf(c), 1);
  }

  clear() {
    for (const c of [...this.list]) this.remove(c);
  }

  // Le point (x, y, z) est-il dans la partie pleine d'un bloc ? (dalles : leur moitié, dalle
  // verticale comprise) ; solidTop : la hauteur du dessus de ce bloc, ou null
  solid(x, y, z) {
    return this.solidTop(x, y, z) !== null;
  }

  solidTop(x, y, z) {
    const { q, r } = worldToHex(x, z), ly = Math.floor(y);
    const id = this.world.getBlock(q, r, ly);
    if (!SOLID[id]) return null;
    const c = hexToWorld(q, r);
    return inSolidPart(id, x - c.x, y - ly, z - c.z) ? ly + blockBox(id)[1] : null;
  }

  // grab(c) : la collecte automatique a attrapé ce carton (renvoie ce qui reste dedans)
  update(dt, player, auto, grab) {
    if (this.remote) { this.updateRemote(dt, player, auto); return; }
    for (const c of [...this.list]) {
      if (!this.list.includes(c)) continue;
      const p = c.pos, v = c.vel;
      c.delay -= dt;
      const { q, r } = worldToHex(p.x, p.z);
      const wet = isWater(this.world.getBlock(q, r, Math.floor(p.y + c.h * 0.4)));
      // collecte automatique : il file vers le joueur
      const dx = player.pos.x - p.x, dy = player.pos.y + 0.6 - p.y, dz = player.pos.z - p.z;
      const dist = Math.hypot(dx, dy, dz);
      if (auto && c.delay <= 0 && dist < PULL) {
        if (dist < GRAB) {
          const left = grab(c);
          if (!left.length) { this.remove(c); continue; }
          c.items = left;
          this.refresh(c);
          c.delay = 2; // (inventaire plein : on le laisse un moment)
        } else {
          const k = 9 / Math.max(dist, 0.3);
          v.set(dx * k, dy * k + 1, dz * k);
        }
      }
      // pesanteur, eau (il flotte), frottements au sol
      if (wet) { v.multiplyScalar(Math.exp(-3 * dt)); v.y += 14 * dt; }
      else v.y -= GRAVITY * dt;
      if (c.ground) { const f = Math.exp(-9 * dt); v.x *= f; v.z *= f; }
      // le joueur le pousse en marchant dedans
      const pd = Math.hypot(dx, dz), touch = RADIUS + c.w * 0.45;
      if (!auto && pd < touch && pd > 1e-4 && player.pos.y < p.y + c.h && player.pos.y + 1.8 > p.y) {
        const k = (touch - pd) * 200 * dt / pd;
        v.x -= dx * k; v.z -= dz * k;
      }
      // déplacement, axe par axe (il bute contre les blocs, sur toute sa largeur)
      const rad = c.w * 0.45;
      const wall = (x, z) => this.solid(x, p.y + 0.05, z) || this.solid(x, p.y + c.h * 0.8, z);
      const impact = Math.hypot(v.x, v.z);
      const nx = p.x + v.x * dt;
      if (v.x && wall(nx + Math.sign(v.x) * rad, p.z)) { v.x *= -0.3; c.spin += (Math.random() - 0.5) * impact; } else p.x = nx;
      const nz = p.z + v.z * dt;
      if (v.z && wall(p.x, nz + Math.sign(v.z) * rad)) { v.z *= -0.3; c.spin += (Math.random() - 0.5) * impact; } else p.z = nz;
      const ny = p.y + v.y * dt;
      const wasGround = c.ground; // (au sol ou posé sur un carton à l'image d'avant)
      c.prevGround = wasGround;
      c.ground = false;
      const floor = v.y <= 0 ? this.solidTop(p.x, ny, p.z) : null;
      if (floor !== null) {
        p.y = floor;
        this.land(c, wasGround);
      } else if (v.y > 0 && this.solid(p.x, ny + c.h, p.z)) v.y = 0;
      else p.y = ny;
      if (p.y < -DEPTH - 30) { this.remove(c); continue; } // (tombé sous le monde)
      // en l'air il tourne sur lui-même et se penche ; au sol il se redresse en oscillant
      c.spin *= Math.exp(-(c.ground ? 6 : 0.5) * dt);
      c.yaw += c.spin * dt;
      if (c.ground || wasGround) {
        c.tvx += (-c.tx * 120 - c.tvx * 9) * dt; c.tvz += (-c.tz * 120 - c.tvz * 9) * dt;
      } else {
        c.tvx *= Math.exp(-0.6 * dt); c.tvz *= Math.exp(-0.6 * dt);
      }
      c.tx = Math.max(-0.6, Math.min(0.6, c.tx + c.tvx * dt));
      c.tz = Math.max(-0.6, Math.min(0.6, c.tz + c.tvz * dt));
    }
    // cartons entre eux : même objet, ils se rassemblent ; sinon ils se cognent et s'empilent
    for (let i = 0; i < this.list.length; i++) {
      for (let j = i + 1; j < this.list.length; j++) {
        const a = this.list[i], b = this.list[j];
        const ox = b.pos.x - a.pos.x, oz = b.pos.z - a.pos.z;
        const d = Math.hypot(ox, oz), reach = (a.w + b.w) * 0.45;
        if (d >= reach) continue;
        const up = Math.min(a.pos.y + a.h, b.pos.y + b.h) - Math.max(a.pos.y, b.pos.y); // chevauchement en hauteur
        if (up <= 0) continue;
        if (sameKind(a, b)) {
          const [big, small] = countOf(a.items) >= countOf(b.items) ? [a, b] : [b, a];
          big.items = packItems([...big.items, ...small.items]);
          big.delay = Math.max(big.delay, small.delay);
          this.remove(small);
          this.refresh(big);
          big.pop = Math.max(big.pop, 0.6);
          j = this.list.length; i = -1; // (la liste a changé : on recommence)
          break;
        }
        const side = reach - d;
        if (up < side && up < 0.35) {
          // l'un est au-dessus de l'autre : il se pose dessus
          const [top, low] = a.pos.y > b.pos.y ? [a, b] : [b, a];
          top.pos.y = low.pos.y + low.h;
          if (top.vel.y < 0) this.land(top, top.prevGround);
          top.ground = true;
          // (il glisse s'il dépasse trop du bord)
          const ex = top.pos.x - low.pos.x, ez = top.pos.z - low.pos.z, ed = Math.hypot(ex, ez);
          if (ed > low.w * 0.35) { top.vel.x += ex / ed * 4 * dt; top.vel.z += ez / ed * 4 * dt; }
          continue;
        }
        // côte à côte : on les écarte et ils échangent un peu d'élan
        const nx = d > 1e-4 ? ox / d : 1, nz = d > 1e-4 ? oz / d : 0;
        const ma = countOf(a.items) + 2, mb = countOf(b.items) + 2, sa = mb / (ma + mb), sb = ma / (ma + mb);
        this.shift(a, -nx * side * sa, -nz * side * sa);
        this.shift(b, nx * side * sb, nz * side * sb);
        const rel = (b.vel.x - a.vel.x) * nx + (b.vel.z - a.vel.z) * nz;
        if (rel < 0) {
          const imp = -rel * 1.3;
          a.vel.x -= nx * imp * sa; a.vel.z -= nz * imp * sa;
          b.vel.x += nx * imp * sb; b.vel.z += nz * imp * sb;
          a.spin += (Math.random() - 0.5) * imp * 2; b.spin += (Math.random() - 0.5) * imp * 2;
        }
      }
    }
    for (const c of this.list) {
      c.pop = Math.max(0, c.pop - dt * 3);
      const s = 1 + Math.sin(c.pop * Math.PI) * 0.18;
      c.mesh.position.copy(c.pos);
      c.mesh.rotation.set(c.tx, c.yaw, c.tz, 'XZY'); // (penché dans le repère du monde, puis tourné)
      c.mesh.scale.set(s, 2 - s, s);
    }
  }

  // Il touche le sol : rebond s'il tombe de haut, et il bascule un peu selon sa vitesse
  land(c, wasGround) {
    const v = c.vel;
    if (!wasGround) {
      c.tvx += v.z * 1.5 + (Math.random() - 0.5) * Math.min(4, -v.y);
      c.tvz -= v.x * 1.5 + (Math.random() - 0.5) * Math.min(4, -v.y);
    }
    v.y = v.y < -6 ? -v.y * 0.25 : 0;
    c.ground = true;
  }

  // Décale un carton (sans entrer dans un bloc)
  shift(c, x, z) {
    const r = c.w * 0.45, p = c.pos;
    const nx = p.x + x, nz = p.z + z;
    const free = (px, pz) => !this.solid(px + Math.sign(x || 1) * r * (x ? 1 : 0), p.y + 0.05, pz + Math.sign(z || 1) * r * (z ? 1 : 0));
    if (free(nx, nz)) { p.x = nx; p.z = nz; }
    else { c.vel.x *= 0.5; c.vel.z *= 0.5; }
  }

  // Carton visé : { carton, t } ou null
  raycast(o, d, reach) {
    let best = null;
    for (const c of this.list) {
      const R = c.w * 0.55;
      const lx = c.pos.x - o.x, ly = c.pos.y + c.h / 2 - o.y, lz = c.pos.z - o.z;
      const tc = lx * d.x + ly * d.y + lz * d.z;
      if (tc < 0) continue;
      const d2 = lx * lx + ly * ly + lz * lz - tc * tc;
      if (d2 > R * R) continue;
      const t = tc - Math.sqrt(R * R - d2);
      if (t <= reach && (!best || t < best.t)) best = { carton: c, t };
    }
    return best;
  }

  // ---------- En ligne ----------
  // État envoyé par l'hôte : [id, x, y, z, angle, contenu]
  state() {
    const r = (v) => Math.round(v * 100) / 100;
    return this.list.map((c) => [c.id, r(c.pos.x), r(c.pos.y), r(c.pos.z), r(c.yaw), c.items]);
  }
  // Invité : les cartons affichés suivent l'état reçu (ceux qui ont disparu s'en vont)
  applyState(list) {
    const seen = new Set();
    for (const e of list) {
      if (!Array.isArray(e) || e.length < 6 || !e.slice(0, 5).every(Number.isFinite) || !Array.isArray(e[5])) continue;
      const [id, x, y, z, yaw, raw] = e;
      const items = raw.filter((it) => it && Number.isInteger(it.id) && Number.isInteger(it.n) && it.n > 0).slice(0, 64);
      let c = this.list.find((o) => o.id === id);
      if (!c) {
        c = this.spawn(new THREE.Vector3(x, y, z), items);
        if (!c) continue;
        c.id = id;
        c.pop = 0;
      } else if (JSON.stringify(c.items) !== JSON.stringify(items)) { c.items = items; this.refresh(c); }
      (c.target ||= new THREE.Vector3()).set(x, y, z);
      c.tYaw = yaw;
      seen.add(id);
    }
    for (const c of [...this.list]) if (!seen.has(c.id)) this.remove(c);
  }
  updateRemote(dt, player, auto) {
    const k = 1 - Math.exp(-dt * 12);
    for (const c of this.list) {
      if (c.target) {
        if (c.pos.distanceToSquared(c.target) > 25) c.pos.copy(c.target); else c.pos.lerp(c.target, k);
        c.yaw += ((((c.tYaw - c.yaw) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI) * k;
      }
      c.mesh.position.copy(c.pos);
      c.mesh.rotation.set(0, c.yaw, 0);
      // collecte automatique : on demande à l'hôte (une fois par seconde au plus par carton)
      if (auto && player.pos.distanceTo(c.pos) < GRAB + 0.4 && !(c.asked > performance.now() - 1000)) {
        c.asked = performance.now();
        this.onTake?.(c);
      }
    }
  }
  byId(id) { return this.list.find((c) => c.id === id) || null; }

  serialize() {
    return this.list.map((c) => ({ x: +c.pos.x.toFixed(2), y: +c.pos.y.toFixed(2), z: +c.pos.z.toFixed(2), yaw: +c.yaw.toFixed(2), items: c.items }));
  }

  load(list) {
    this.clear();
    if (!Array.isArray(list)) return;
    for (const s of list.slice(0, 2000)) {
      if (![s?.x, s?.y, s?.z].every(Number.isFinite) || !Array.isArray(s.items)) continue;
      const items = s.items.filter((it) => it && Number.isInteger(it.id) && Number.isInteger(it.n) && it.n > 0);
      const c = this.spawn(new THREE.Vector3(s.x, s.y, s.z), items);
      if (c && Number.isFinite(s.yaw)) { c.yaw = s.yaw; c.spin = 0; c.pop = 0; }
    }
  }
}

// Les images ont des bords en dents de scie (pixels hexagonaux) : on bouche les trous
// transparents avec la couleur du voisin opaque, sinon le carton paraît troué aux arêtes
function fillHoles(g, w, h) {
  const d = g.getImageData(0, 0, w, h), px = d.data;
  for (let pass = 0; pass < 12; pass++) {
    const src = px.slice();
    let left = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        if (src[i + 3] >= 128) continue;
        let found = -1;
        for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
          const nx = x + ox, ny = y + oy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const j = (ny * w + nx) * 4;
          if (src[j + 3] >= 128) { found = j; break; }
        }
        if (found < 0) { left++; continue; }
        px[i] = src[found]; px[i + 1] = src[found + 1]; px[i + 2] = src[found + 2]; px[i + 3] = 255;
      }
    }
    if (!left) break;
  }
  g.putImageData(d, 0, 0);
}

// Prisme hexagonal (largeur w plat à plat, hauteur h) posé sur sa base. Matériaux : 0 la face
// avec le visage, 1 un côté, 2 le côté au nœud de scotch, 3 le dessus, 4 le dessous.
function prism(w, h) {
  const C = CORNERS.map(([x, z]) => [x * w, z * w]), R = SIZE * w;
  const pos = [], uv = [], groups = [];
  const face = (verts, uvs, mat) => {
    groups.push([pos.length / 3, verts.length, mat]);
    for (const v of verts) pos.push(...v);
    for (const t of uvs) uv.push(...t);
  };
  for (let i = 0; i < 6; i++) {
    const [x0, z0] = C[i], [x1, z1] = C[(i + 1) % 6];
    const mat = i === 0 ? 0 : i === 3 ? 2 : 1;
    face([[x0, 0, z0], [x1, h, z1], [x1, 0, z1], [x0, 0, z0], [x0, h, z0], [x1, h, z1]],
      [[0, 0], [1, 1], [1, 0], [0, 0], [0, 1], [1, 1]], mat);
  }
  const cap = (x, z) => [0.5 + x / (2 * R), 0.5 - z / (2 * R)];
  const top = [], topUv = [], bot = [], botUv = [];
  for (let i = 0; i < 6; i++) {
    const [x0, z0] = C[i], [x1, z1] = C[(i + 1) % 6];
    top.push([0, h, 0], [x1, h, z1], [x0, h, z0]);
    topUv.push(cap(0, 0), cap(x1, z1), cap(x0, z0));
    bot.push([0, 0, 0], [x0, 0, z0], [x1, 0, z1]);
    botUv.push(cap(0, 0), cap(x0, z0), cap(x1, z1));
  }
  face(top, topUv, 3);
  face(bot, botUv, 4);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  for (const [start, count, mat] of groups) g.addGroup(start, count, mat);
  g.computeVertexNormals();
  return g;
}
