// Schématiques (comme celles du mod Create). L'objet schématique en main :
//  - clic gauche sur un bloc : premier coin d'une zone ; clic droit : le deuxième coin
//  - Maj + clic droit : le menu (enregistrer la zone, ou l'objet collé visé, sous un nom ;
//    choisir un plan, le tourner, le ranger ; supprimer un plan)
//  - un plan choisi : son fantôme suit le bloc visé, un clic droit le pose (une projection :
//    des blocs fantômes, sauvegardés avec le monde)
//  - clic droit sur un bloc fantôme : la projection se remplit avec les blocs de l'inventaire
//    (en créatif : tout de suite, sans rien prendre)
//  - clic gauche sur un bloc fantôme : la projection disparaît (sans la schématique en main :
//    3 clics gauches rapides)
// On peut aussi la remplir à la main : un bloc du bon type posé dans une case fantôme la remplit.
// La bibliothèque des plans est commune à tous les mondes (stockage local du jeu).
import * as THREE from 'three';
import { hexToWorld, worldToHex, SIZE } from './hex.js?v=1.1.5-alpha-mwgq2wrb';
import { BLOCKS, AIR, ATTACHED, isWater } from './blocks.js?v=1.1.5-alpha-mwgq2wrb';

const LIB_KEY = 'hexacraft.schematics';
const SCHEM_MAX = 8192; // blocs au plus dans un plan
const SEL_MAX = 64;            // côté de la zone au plus (en cases ou en blocs de haut)
const TRIPLE = 1.2;            // s : les 3 clics pour retirer une projection sans la schématique
const key = (q, r, y) => q + ',' + r + ',' + y;
// un sixième de tour (coordonnées axiales, autour de l'origine)
const rot60 = (q, r) => [-r, q + r];

export class Schematics {
  // colorOf(id) : la couleur d'un bloc (fantômes)
  constructor(scene, world, colorOf) {
    this.scene = scene;
    this.world = world;
    this.colorOf = colorOf;
    this.lib = this.readLib();
    this.sel = [null, null];   // coins de la zone [q, r, y]
    this.plan = null;          // plan choisi (index dans la bibliothèque)
    this.rot = 0;              // sixièmes de tour
    this.projs = [];           // projections : { id, name, q, r, y, b: [[q, r, y, id]], mesh, dirty, lo, hi }
    this.cells = new Map();    // case fantôme -> [projection, bloc]
    this.nextId = 0;
    this.clicks = null;        // { p, n, t } : clics gauches rapides sur une projection
    this.geo = new THREE.CylinderGeometry(SIZE * 0.96, SIZE * 0.96, 0.96, 6);
    this.mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.35, depthWrite: false });
    this.preview = null;       // fantôme du plan choisi (suit le bloc visé)
    this.previewKey = '';
    this.box = new THREE.Box3Helper(new THREE.Box3(), 0xffd040);
    this.box.visible = false;
    scene.add(this.box);
    this.t = 0;
  }

  // ---------- Bibliothèque ----------
  readLib() {
    try {
      const l = JSON.parse(localStorage.getItem(LIB_KEY) || '[]');
      return Array.isArray(l) ? l.filter((p) => p && typeof p.name === 'string' && Array.isArray(p.b)) : [];
    } catch { return []; }
  }
  writeLib() {
    try { localStorage.setItem(LIB_KEY, JSON.stringify(this.lib)); return true; } catch { return false; }
  }
  // Ajoute un plan (blocs [q, r, y, id], ramenés au coin le plus bas) ; renvoie un message d'erreur
  // ou null
  addPlan(name, blocks) {
    blocks = blocks.filter(([, , , id]) => id && BLOCKS[id] && !isWater(id) && !BLOCKS[id].unbreakable);
    if (!blocks.length) return 'Rien à enregistrer : la zone est vide';
    if (blocks.length > SCHEM_MAX) return `Trop de blocs : ${SCHEM_MAX} au plus`;
    const mq = Math.min(...blocks.map((b) => b[0])), mr = Math.min(...blocks.map((b) => b[1])), my = Math.min(...blocks.map((b) => b[2]));
    const b = blocks.map(([q, r, y, id]) => [q - mq, r - mr, y - my, id]);
    const i = this.lib.findIndex((p) => p.name === name);
    if (i >= 0) this.lib[i] = { name, b }; else this.lib.push({ name, b });
    return this.writeLib() ? null : 'Erreur : le plan n\'a pas pu être enregistré';
  }
  deletePlan(i) {
    this.lib.splice(i, 1);
    if (this.plan === i) this.choose(null);
    else if (this.plan !== null && this.plan > i) this.plan--;
    this.writeLib();
  }
  choose(i) {
    this.plan = i;
    this.rot = 0;
    this.previewKey = '';
  }
  rotate() { this.rot = (this.rot + 1) % 6; this.previewKey = ''; }

  // Blocs du plan i, tourné de rot sixièmes de tour (ramenés au coin le plus bas)
  planBlocks(i = this.plan, rot = this.rot) {
    const p = this.lib[i];
    if (!p) return [];
    let b = p.b.filter((e) => Array.isArray(e) && e.length === 4 && e.every(Number.isInteger) && BLOCKS[e[3]]);
    for (let k = 0; k < rot; k++) b = b.map(([q, r, y, id]) => [...rot60(q, r), y, id]);
    const mq = Math.min(...b.map((e) => e[0])), mr = Math.min(...b.map((e) => e[1]));
    return b.map(([q, r, y, id]) => [q - mq, r - mr, y, id]);
  }

  // ---------- Zone ----------
  setCorner(k, h) {
    this.sel[k] = [h.q, h.r, h.y];
    this.showBox();
  }
  clearSel() { this.sel = [null, null]; this.box.visible = false; }
  selBounds() {
    const [a, b] = this.sel;
    if (!a || !b) return null;
    return { lo: a.map((v, i) => Math.min(v, b[i])), hi: a.map((v, i) => Math.max(v, b[i])) };
  }
  showBox() {
    const [a, b] = this.sel, s = this.selBounds() || (a || b) && { lo: a || b, hi: a || b };
    if (!s) { this.box.visible = false; return; }
    const box = this.box.box.makeEmpty(), v = new THREE.Vector3();
    for (const q of [s.lo[0], s.hi[0]]) for (const r of [s.lo[1], s.hi[1]]) {
      const c = hexToWorld(q, r);
      box.expandByPoint(v.set(c.x - SIZE, s.lo[2], c.z - SIZE));
      box.expandByPoint(v.set(c.x + SIZE, s.hi[2] + 1, c.z + SIZE));
    }
    this.box.visible = true;
  }
  // Blocs de la zone (null et un message si elle ne va pas)
  selBlocks() {
    const s = this.selBounds();
    if (!s) return { err: 'Choisis d\'abord les deux coins de la zone (clic gauche, clic droit)' };
    if (s.hi.some((v, i) => v - s.lo[i] >= SEL_MAX)) return { err: `Zone trop grande : ${SEL_MAX} blocs de côté au plus` };
    const out = [];
    for (let y = s.lo[2]; y <= s.hi[2]; y++) for (let r = s.lo[1]; r <= s.hi[1]; r++) for (let q = s.lo[0]; q <= s.hi[0]; q++) {
      const id = this.world.getBlock(q, r, y);
      if (id && !isWater(id)) out.push([q, r, y, id]);
      if (out.length > SCHEM_MAX) return { err: `Trop de blocs : ${SCHEM_MAX} au plus` };
    }
    return { blocks: out };
  }

  // ---------- Projections ----------
  // Pose le plan choisi avec son coin en (q, r, y)
  place(q, r, y) {
    const b = this.planBlocks();
    if (!b.length) return null;
    return this.addProj(this.lib[this.plan].name, q, r, y, b);
  }
  addProj(name, q, r, y, rel, id = ++this.nextId) {
    const p = { id, name, q, r, y, b: rel.map(([a, c, h, b]) => [q + a, r + c, y + h, b]), mesh: null, dirty: true };
    p.lo = [0, 1, 2].map((i) => Math.min(...p.b.map((e) => e[i])));
    p.hi = [0, 1, 2].map((i) => Math.max(...p.b.map((e) => e[i])));
    for (const e of p.b) this.cells.set(key(e[0], e[1], e[2]), [p, e[3]]);
    this.projs.push(p);
    this.nextId = Math.max(this.nextId, id);
    return p;
  }
  remove(p) {
    this.projs = this.projs.filter((o) => o !== p);
    for (const e of p.b) { const k = key(e[0], e[1], e[2]); if (this.cells.get(k)?.[0] === p) this.cells.delete(k); }
    if (p.mesh) { p.mesh.removeFromParent(); p.mesh.dispose(); }
  }
  clear() {
    for (const p of [...this.projs]) this.remove(p);
    this.nextId = 0;
    this.clearSel();
    this.clicks = null;
  }
  // Le bloc du monde est-il celui du plan ? (un bloc tourné compte : même objet ramassé)
  matches(cur, want) {
    return cur === want || (cur && (BLOCKS[cur]?.pick ?? cur) === (BLOCKS[want]?.pick ?? want) && BLOCKS[cur]?.base !== undefined);
  }
  missing(p) { return p.b.filter(([q, r, y, id]) => !this.matches(this.world.getBlock(q, r, y), id)); }

  // Un bloc du monde a changé : les projections qui couvrent la case seront redessinées
  onWorldSet(q, r, y) {
    for (const p of this.projs) {
      if (q >= p.lo[0] && q <= p.hi[0] && r >= p.lo[1] && r <= p.hi[1] && y >= p.lo[2] && y <= p.hi[2]) p.dirty = true;
    }
  }

  // Remplit les cases vides de la projection ; take(id) : prend le bloc dans l'inventaire (false :
  // il n'y en a pas). Renvoie { done, left, need: Map(id -> n manquants) }
  fill(p, take, blocked) {
    const todo = this.missing(p).filter(([q, r, y]) => {
      const cur = this.world.getBlock(q, r, y);
      return (cur === AIR || isWater(cur)) && !blocked(q, r, y);
    });
    // du bas vers le haut, ce qui se pose sur un bloc (rails, torches) après
    todo.sort((a, b) => (ATTACHED[a[3]] - ATTACHED[b[3]]) || a[2] - b[2]);
    let done = 0;
    const need = new Map();
    for (const [q, r, y, id] of todo) {
      if (!take(id)) { need.set(id, (need.get(id) || 0) + 1); continue; }
      if (this.world.setBlock(q, r, y, id)) done++;
    }
    p.dirty = true;
    return { done, left: this.missing(p).length, need };
  }

  // Case fantôme vide traversée par le rayon avant la distance max (le bloc visé) : { p, t }
  ghostAt(o, d, max) {
    if (!this.projs.length) return null;
    let last = '';
    for (let t = 0.05; t < max; t += 0.05) {
      const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t, h = worldToHex(x, z), yy = Math.floor(y);
      const k = key(h.q, h.r, yy);
      if (k === last) continue;
      last = k;
      const c = this.cells.get(k);
      if (c && this.world.getBlock(h.q, h.r, yy) === AIR) return { p: c[0], t, q: h.q, r: h.r, y: yy };
    }
    return null;
  }
  // Clic gauche (sans la schématique) sur la projection p : true au 3e clic rapide
  tripleClick(p) {
    const now = performance.now() / 1000, c = this.clicks;
    if (!c || c.p !== p || now - c.t > TRIPLE) { this.clicks = { p, n: 1, t: now }; return false; }
    c.n++;
    if (c.n < 3) return false;
    this.clicks = null;
    return true;
  }

  // ---------- Affichage ----------
  // Fantômes d'une liste de blocs [q, r, y, id] (les cases où show(q, r, y, id) est vrai),
  // autour de la case (q0, r0, y0)
  buildMesh(list, q0, r0, y0, show) {
    const shown = list.filter((e) => show(...e));
    const mesh = new THREE.InstancedMesh(this.geo, this.mat, Math.max(1, shown.length));
    mesh.count = shown.length;
    const o = hexToWorld(q0, r0), m = new THREE.Matrix4(), col = new THREE.Color();
    mesh.position.set(o.x, y0, o.z);
    shown.forEach(([q, r, y, id], i) => {
      const c = hexToWorld(q, r);
      m.makeTranslation(c.x - o.x, y - y0 + 0.5, c.z - o.z);
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, col.set(this.colorOf(id)));
    });
    mesh.frustumCulled = false;
    mesh.renderOrder = 5;
    this.scene.add(mesh);
    return mesh;
  }
  refresh(p) {
    if (p.mesh) { p.mesh.removeFromParent(); p.mesh.dispose(); }
    p.mesh = this.buildMesh(p.b, p.q, p.r, p.y, (q, r, y, id) => !this.matches(this.world.getBlock(q, r, y), id));
    p.dirty = false;
  }

  // Chaque image : at = case où poserait le plan choisi (ou null), holding : la schématique en main
  update(dt, at, holding) {
    this.t += dt;
    this.mat.opacity = 0.28 + 0.12 * Math.sin(this.t * 4);
    this.refreshT = (this.refreshT || 0) - dt;
    if (this.refreshT <= 0) {
      this.refreshT = 0.2;
      for (const p of this.projs) if (p.dirty) this.refresh(p);
    }
    this.box.visible = holding && !!(this.sel[0] || this.sel[1]);
    const want = holding && this.plan !== null && at ? this.plan + ':' + this.rot : '';
    if (want !== this.previewKey) {
      if (this.preview) { this.preview.removeFromParent(); this.preview.dispose(); this.preview = null; }
      this.previewKey = want;
      if (want) this.preview = this.buildMesh(this.planBlocks(), 0, 0, 0, () => true);
    }
    if (this.preview && at) {
      const c = hexToWorld(at.q, at.r);
      this.preview.position.set(c.x, at.y, c.z);
    }
  }

  // ---------- Sauvegarde (avec le monde) ----------
  serialize() {
    return this.projs.map((p) => ({ n: p.name, q: p.q, r: p.r, y: p.y, b: p.b.map(([q, r, y, id]) => [q - p.q, r - p.r, y - p.y, id]) }));
  }
  load(list) {
    this.clear();
    for (const d of Array.isArray(list) ? list : []) {
      if (![d?.q, d?.r, d?.y].every(Number.isInteger) || !Array.isArray(d.b)) continue;
      const b = d.b.filter((e) => Array.isArray(e) && e.length === 4 && e.every(Number.isInteger) && BLOCKS[e[3]]).slice(0, SCHEM_MAX);
      if (b.length) this.addProj(String(d.n || 'Plan').slice(0, 32), d.q, d.r, d.y, b);
    }
  }
}
