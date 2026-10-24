// Cordes : tendues entre deux points, chacun accroché à un bloc du monde ou à un objet collé.
// Une corde ne pousse jamais : elle empêche seulement ses deux bouts de s'éloigner de plus que
// sa longueur (elle retient un objet suspendu, remorque un objet derrière un autre...).
// La corde elle-même est une chaîne de points (intégration de Verlet) : elle pend, se pose sur
// les blocs du monde, on marche dessus (elle s'enfonce sous le poids), elle bloque et se fait
// pousser par les joueurs et les animaux. Chaque machine simule la forme de ses cordes (les
// bouts, eux, viennent de l'hôte).
// Un bout : { s : id de l'objet collé (ou null : le monde), p : point (repère de l'objet, ou
// monde), c : case du bloc où il est accroché [q, r, y] }. Le bloc disparaît : la corde lâche.
// L'hôte simule (dans le pas de physique des objets, voir structs.step) ; les clients
// reçoivent la liste des cordes (message 'ropes') et les dessinent.
import * as THREE from 'three';
import { AIR, SOLID, isWater } from './blocks.js?v=1.1.5-alpha-mvm2b95g';
import { worldToHex, hexToWorld, circleHexPush } from './hex.js?v=1.1.5-alpha-mvm2b95g';

export const ROPE_MAX = 32;   // longueur maximale d'une corde (blocs)
const SLACK = 1.05;           // une corde posée a 5 % de mou
const STIFF = 0.25;           // part de l'écart de longueur rattrapée à chaque pas
const MAX_BIAS = 6;           // ... au plus à cette vitesse (blocs/s)
const CHECK_EVERY = 0.5;      // secondes entre deux vérifications des blocs d'accroche
const RADIUS = 0.06;          // épaisseur (rayon) de la corde
const LINK = 0.4;             // longueur d'un maillon de la chaîne (blocs)
const GRAVITY = 25;
const DAMP = 0.97;            // la corde perd 3 % de sa vitesse à chaque pas (elle ne rebondit pas)
const MAX_MOVE = 0.25;        // un maillon ne bouge pas de plus de MAX_MOVE par pas (15 blocs/s)
const ITER = 24;              // passes de contraintes par pas (plus : corde moins élastique)
const STEP = 1 / 60;          // pas de simulation de la forme
const LOAD = 30;              // un maillon sous un joueur pèse LOAD fois plus (la corde s'enfonce)
const FOOT = 0.45;            // on se pose sur la corde si elle est à moins de FOOT sous les pieds...
const STEP_UP = 0.55;         // ... ou à moins de STEP_UP au-dessus (on la monte comme une marche)
const WIDE = 0.15;            // on tient sur la corde même un peu à côté (elle est fine)
const FRICTION = 0.6;         // maillon posé sur un bloc : il glisse peu

const cellKey = (c) => c[0] + ',' + c[1] + ',' + c[2];
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _n = new THREE.Vector3();
const _ra = new THREE.Vector3(), _rb = new THREE.Vector3(), _va = new THREE.Vector3(), _vb = new THREE.Vector3(), _J = new THREE.Vector3();

export class RopeSystem {
  constructor(scene, world, structs) {
    this.scene = scene;
    this.world = world;
    this.structs = structs;
    this.list = [];            // { id, a, b, len, mesh, pts (la chaîne : { p, o, load }), link, still, box }
    this.nextId = 0;
    this.checkClock = 0;
    this.onChange = null;      // multijoueur (hôte) : la liste a changé
    this.onBreak = null;       // (corde) : elle a lâché (son, objet rendu...)
    this.material = new THREE.MeshLambertMaterial({ color: 0x9a7448 });
    structs.ropes = this;
  }

  // Point du monde d'un bout (null : objet introuvable ou déchargé)
  point(end, out) {
    if (end.s === null) return out.fromArray(end.p);
    const s = this.structs.byId(end.s);
    if (!s || s.unloaded) return null;
    return this.structs.toWorld(s, _a.fromArray(end.p), out);
  }

  add(a, b, len = null) {
    const pa = this.point(a, new THREE.Vector3()), pb = this.point(b, new THREE.Vector3());
    if (!pa || !pb) return null;
    const d = pa.distanceTo(pb);
    if (d > ROPE_MAX || d < 0.3) return null;
    const rope = { id: ++this.nextId, a, b, len: len ?? Math.min(ROPE_MAX * SLACK, d * SLACK + 0.2), mesh: null };
    this.list.push(rope);
    this.changed();
    return rope;
  }

  remove(rope, broke = false) {
    if (rope.mesh) { this.scene.remove(rope.mesh); rope.mesh.geometry.dispose(); }
    this.list = this.list.filter((r) => r !== rope);
    if (broke) this.onBreak?.(rope);
    this.changed();
  }

  // Cordes accrochées au bloc c (du monde si s = null, sinon de l'objet s)
  at(s, c) {
    const k = cellKey(c);
    return this.list.filter((r) => [r.a, r.b].some((e) => e.s === s && cellKey(e.c) === k));
  }

  changed() { this.onChange?.(); }

  clear() {
    for (const r of this.list) if (r.mesh) { this.scene.remove(r.mesh); r.mesh.geometry.dispose(); }
    this.list = [];
  }

  // ---------- Objets collés : ils changent, les bouts suivent ----------
  // Objet B collé à A (double colle) : ses bouts passent dans le repère de A
  rebase(B, A) {
    const w = new THREE.Vector3();
    for (const r of this.list) {
      for (const e of [r.a, r.b]) {
        if (e.s !== B.id) continue;
        this.structs.toWorld(B, _a.fromArray(e.p), w);
        const c = this.cellWorld(B, e.c);
        e.s = A.id;
        e.p = this.structs.toLocal(A, w, _a).toArray();
        const L = this.structs.toLocal(A, c, _b), h = worldToHex(L.x, L.z);
        e.c = [h.q, h.r, Math.floor(L.y)];
      }
    }
  }

  // Objet coupé en morceaux : un bout suit le morceau qui contient son bloc (même repère)
  split(s, part) {
    for (const r of this.list) for (const e of [r.a, r.b]) if (e.s === s.id && part.blocks.has(cellKey(e.c))) e.s = part.id;
  }

  // Objet disparu (reposé dans le monde) : ses bouts restent où ils sont, accrochés au monde
  gone(s) {
    for (const r of this.list) {
      for (const e of [r.a, r.b]) {
        if (e.s !== s.id) continue;
        const w = this.structs.toWorld(s, _a.fromArray(e.p), new THREE.Vector3());
        const c = this.cellWorld(s, e.c), h = worldToHex(c.x, c.z);
        e.s = null;
        e.p = w.toArray();
        e.c = [h.q, h.r, Math.floor(c.y)];
      }
    }
  }

  // Centre (monde) de la case c de l'objet s
  cellWorld(s, c) {
    const L = new THREE.Vector3(...this.structs.cellCenter(c));
    return this.structs.toWorld(s, L, L);
  }

  // ---------- Physique (hôte) ----------
  // Un pas de physique (h secondes) : chaque corde trop étirée tire ses deux bouts l'un vers
  // l'autre (impulsion sur la vitesse au point d'accroche, donc aussi sur la rotation)
  solve(h) {
    const S = this.structs;
    for (const r of this.list) {
      const sa = r.a.s === null ? null : S.byId(r.a.s), sb = r.b.s === null ? null : S.byId(r.b.s);
      if ((!sa && !sb) || sa?.unloaded || sb?.unloaded) continue;
      const pa = this.point(r.a, _ra.set(0, 0, 0)) && _ra, pb = this.point(r.b, _rb.set(0, 0, 0)) && _rb;
      if (!pa || !pb) continue;
      const d = pa.distanceTo(pb);
      if (d <= r.len || d < 1e-4) continue;
      _n.subVectors(pb, pa).divideScalar(d);
      const ra = sa ? pa.clone().sub(sa.pos) : null, rb = sb ? pb.clone().sub(sb.pos) : null;
      const va = sa ? S.velAt(sa, ra, _va) : _va.set(0, 0, 0);
      const vb = sb ? S.velAt(sb, rb, _vb) : _vb.set(0, 0, 0);
      const vrel = _b.subVectors(vb, va).dot(_n);     // > 0 : les bouts s'éloignent
      const bias = Math.min(MAX_BIAS, (d - r.len) * STIFF / h);
      if (vrel <= -bias) continue;
      const k = (sa ? S.invMassAt(sa, ra, _n) : 0) + (sb ? S.invMassAt(sb, rb, _n) : 0);
      if (k <= 0) continue;
      const lambda = (vrel + bias) / k;
      if (sa) { S.wake(sa); S.impulse(sa, _J.copy(_n).multiplyScalar(lambda), ra); }
      if (sb) { S.wake(sb); S.impulse(sb, _J.copy(_n).multiplyScalar(-lambda), rb); }
    }
  }

  // ---------- À chaque image ----------
  // bodies : joueurs et animaux { pos (pieds), vel, radius, height, move (on peut les déplacer :
  // joueur local, animaux chez l'hôte), ground() (posé sur la corde) }
  update(dt, host, bodies = []) {
    // l'hôte vérifie que les blocs d'accroche sont toujours là
    if (host) {
      this.checkClock -= dt;
      if (this.checkClock <= 0) {
        this.checkClock = CHECK_EVERY;
        for (const r of [...this.list]) if (!this.holds(r.a) || !this.holds(r.b)) this.remove(r, true);
      }
    }
    this.acc = Math.min((this.acc || 0) + dt, STEP * 4);
    const steps = Math.floor(this.acc / STEP);
    this.acc -= steps * STEP;
    for (const r of this.list) {
      const pa = this.point(r.a, new THREE.Vector3()), pb = this.point(r.b, new THREE.Vector3());
      if (!pa || !pb) { if (r.mesh) r.mesh.visible = false; continue; }
      if (!r.pts) this.initChain(r, pa, pb);
      for (let i = 0; i < steps; i++) this.simulate(r, pa, pb, bodies);
      this.draw(r);
    }
    // joueurs et animaux posés sur une corde (après la simulation : à la hauteur finale)
    if (steps) for (const b of bodies) if (b.move) this.support(b);
  }

  // Chaîne de départ : une parabole de la bonne longueur entre les deux bouts
  initChain(r, pa, pb) {
    const n = Math.max(4, Math.min(100, Math.ceil(r.len / LINK)));
    const d = pa.distanceTo(pb);
    const sag = d < r.len ? Math.sqrt((3 * d * (r.len - d)) / 8) : 0;
    r.link = r.len / n;
    r.pts = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const p = new THREE.Vector3().lerpVectors(pa, pb, t);
      p.y -= sag * 4 * t * (1 - t);
      r.pts.push({ p, o: p.clone(), load: 0 });
    }
    r.still = 0;
  }

  // Un pas de la forme de la corde : Verlet, longueur des maillons, blocs, corps
  simulate(r, pa, pb, bodies) {
    const pts = r.pts, n = pts.length - 1, g = GRAVITY * STEP * STEP;
    let moved = 0;
    pts[0].p.copy(pa); pts[0].o.copy(pa);
    pts[n].p.copy(pb); pts[n].o.copy(pb);
    for (let i = 1; i < n; i++) {
      const q = pts[i], p = q.p;
      let vx = (p.x - q.o.x) * DAMP, vy = (p.y - q.o.y) * DAMP, vz = (p.z - q.o.z) * DAMP;
      const v = Math.sqrt(vx * vx + vy * vy + vz * vz);
      if (v > MAX_MOVE) { vx *= MAX_MOVE / v; vy *= MAX_MOVE / v; vz *= MAX_MOVE / v; }
      q.o.copy(p);
      p.x += vx; p.y += vy - g * (1 + q.load * 0.2); p.z += vz;
      q.load = 0;
    }
    // corps : ils écrasent la corde sous leurs pieds et l'écartent de leur passage (seulement
    // ceux qui sont près de la corde : boîte qui l'entoure)
    const box = r.box ||= new THREE.Box3();
    box.makeEmpty();
    for (const q of pts) box.expandByPoint(q.p);
    box.expandByScalar(1);
    for (const b of bodies) {
      if (b.pos.x < box.min.x || b.pos.x > box.max.x || b.pos.z < box.min.z || b.pos.z > box.max.z) continue;
      if (b.pos.y > box.max.y || b.pos.y + b.height < box.min.y) continue;
      this.pressBody(r, b);
    }
    for (let k = 0; k < ITER; k++) {
      // maillons : jamais plus longs que prévu (une corde ne s'étire pas, mais se plie)
      for (let i = 0; i < n; i++) {
        const A = pts[i], B = pts[i + 1];
        const dx = B.p.x - A.p.x, dy = B.p.y - A.p.y, dz = B.p.z - A.p.z;
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (d <= r.link || d < 1e-6) continue;
        const wa = i === 0 ? 0 : 1 / (1 + A.load * LOAD), wb = i + 1 === n ? 0 : 1 / (1 + B.load * LOAD);
        if (wa + wb === 0) continue;
        const f = (d - r.link) / d / (wa + wb);
        A.p.x += dx * f * wa; A.p.y += dy * f * wa; A.p.z += dz * f * wa;
        B.p.x -= dx * f * wb; B.p.y -= dy * f * wb; B.p.z -= dz * f * wb;
      }
      if (k % 4 === 3 || k === ITER - 1) for (let i = 1; i < n; i++) this.collideWorld(pts[i]);
    }
    for (let i = 1; i < n; i++) moved = Math.max(moved, pts[i].p.distanceToSquared(pts[i].o));
    r.still = moved < 1e-8 ? r.still + 1 : 0;
  }

  // Maillon dans un bloc du monde : posé dessus (s'il vient d'au-dessus), sinon poussé dehors
  collideWorld(q) {
    const p = q.p, h = worldToHex(p.x, p.z);
    const y = Math.floor(p.y - RADIUS);
    for (const yy of [y, Math.floor(p.y + RADIUS)]) {
      if (!SOLID[this.world.getBlock(h.q, h.r, yy)]) continue;
      const c = hexToWorld(h.q, h.r);
      if (q.o.y >= yy + 1 - 0.05 || p.y > yy + 0.75) {
        p.y = yy + 1 + RADIUS;
        // frottement : posé, il glisse peu
        p.x = q.o.x + (p.x - q.o.x) * (1 - FRICTION);
        p.z = q.o.z + (p.z - q.o.z) * (1 - FRICTION);
      } else {
        const push = circleHexPush(p.x - c.x, p.z - c.z, RADIUS);
        if (push) { p.x += push[0]; p.z += push[1]; } else p.y = yy + 1 + RADIUS;
      }
    }
  }

  // Un corps contre la corde : sous ses pieds, les maillons s'enfoncent avec lui (chargés) ;
  // à hauteur du corps, ils sont écartés de son passage
  pressBody(r, b) {
    const R = b.radius + RADIUS + WIDE, feet = b.pos.y;
    for (let i = 1; i < r.pts.length - 1; i++) {
      const p = r.pts[i].p;
      const dx = p.x - b.pos.x, dz = p.z - b.pos.z, d2 = dx * dx + dz * dz;
      if (d2 >= R * R) continue;
      const below = r.pts[i].o.y <= feet + 0.05;
      if (below && p.y > feet - RADIUS && p.y < feet + b.height) {
        // elle remonte sous ses pieds : elle ne le traverse pas (elle reste dessous)
        p.y = feet - RADIUS;
      } else if (p.y <= feet && p.y >= feet - FOOT && b.vel.y <= 0.5) {
        // sous les pieds : il porte le poids
        r.pts[i].load = 1;
        if (p.y > feet - RADIUS) p.y = feet - RADIUS;
      } else if (p.y > feet + STEP_UP && p.y < feet + b.height && d2 < (b.radius + RADIUS) ** 2) {
        const d = Math.sqrt(d2) || 1e-4, k = (R - d) / d;
        p.x += dx * k; p.z += dz * k;
      }
    }
  }

  // Après la simulation : le corps se pose sur la corde sous ses pieds, et une corde tendue en
  // travers de son passage le repousse
  support(b) {
    const R = b.radius + RADIUS + WIDE, R0 = b.radius + RADIUS, feet = b.pos.y;
    let top = -Infinity, px = 0, pz = 0;
    for (const r of this.list) {
      if (!r.pts || !r.box || !r.box.containsPoint(b.pos) && !r.box.containsPoint(_a.set(b.pos.x, b.pos.y + b.height, b.pos.z))) continue;
      for (const { p } of r.pts) {
        const dx = p.x - b.pos.x, dz = p.z - b.pos.z, d2 = dx * dx + dz * dz;
        if (d2 >= R * R) continue;
        const surface = p.y + RADIUS;
        if (surface <= feet + STEP_UP && surface >= feet - FOOT) { if (b.vel.y <= 0.5) top = Math.max(top, surface); } else if (p.y > feet + STEP_UP && p.y < feet + b.height && d2 < R0 * R0) {
          const d = Math.sqrt(d2) || 1e-4, k = (R0 - d) / d;
          px -= dx * k * 0.5; pz -= dz * k * 0.5;
        }
      }
    }
    if (top > -Infinity) {
      b.pos.y = top;
      if (b.vel.y < 0) b.vel.y = 0;
      b.ground?.();
    }
    if (px || pz) { b.pos.x += px; b.pos.z += pz; }
  }

  holds(e) {
    if (e.s === null) {
      const [q, r, y] = e.c;
      if (!this.world.isLoaded?.(q, r)) return true; // (pas chargé : on ne sait pas, on garde)
      const id = this.world.getBlock(q, r, y);
      return id !== AIR && !isWater(id);
    }
    const s = this.structs.byId(e.s);
    return !!s && s.blocks.has(cellKey(e.c));
  }

  // Tube qui suit la chaîne (refait seulement si elle a bougé)
  draw(r) {
    if (r.mesh && r.still > 2) { r.mesh.visible = true; return; }
    const pts = r.pts.map((q) => q.p.clone());
    const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), pts.length * 2, RADIUS, 5, false);
    if (r.mesh) { r.mesh.geometry.dispose(); r.mesh.geometry = geo; } else {
      r.mesh = new THREE.Mesh(geo, this.material);
      r.mesh.castShadow = true;
      r.mesh.frustumCulled = false;
      this.scene.add(r.mesh);
    }
    r.mesh.visible = true;
  }

  // ---------- Sauvegarde / réseau ----------
  serialize() {
    const round = (v) => Math.round(v * 1000) / 1000;
    const end = (e) => ({ s: e.s, p: e.p.map(round), c: e.c });
    return this.list.map((r) => ({ id: r.id, a: end(r.a), b: end(r.b), len: round(r.len) }));
  }

  // (une corde déjà là, même id et même longueur, garde sa forme : le client reçoit la liste
  // entière à chaque changement)
  load(list) {
    const old = new Map(this.list.map((r) => [r.id, r]));
    const next = [];
    for (const d of Array.isArray(list) ? list.slice(0, 2000) : []) {
      const a = cleanEnd(d?.a), b = cleanEnd(d?.b);
      if (!a || !b || !Number.isFinite(d.len) || d.len <= 0 || d.len > ROPE_MAX * SLACK + 1) continue;
      const id = Number.isInteger(d.id) ? d.id : ++this.nextId;
      const was = old.get(id);
      if (was && was.len === d.len) { old.delete(id); Object.assign(was, { a, b }); next.push(was); } else next.push({ id, a, b, len: d.len, mesh: null });
      this.nextId = Math.max(this.nextId, id);
    }
    for (const r of old.values()) if (r.mesh) { this.scene.remove(r.mesh); r.mesh.geometry.dispose(); }
    this.list = next;
  }
}

// Bout de corde reçu (sauvegarde, réseau) : vérifié, ou null
export function cleanEnd(e) {
  if (!e || typeof e !== 'object') return null;
  if (!(e.s === null || Number.isInteger(e.s))) return null;
  if (!Array.isArray(e.p) || e.p.length !== 3 || !e.p.every(Number.isFinite)) return null;
  if (!Array.isArray(e.c) || e.c.length !== 3 || !e.c.every(Number.isInteger)) return null;
  return { s: e.s, p: [...e.p], c: [...e.c] };
}
