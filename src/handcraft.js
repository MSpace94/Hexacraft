// Artisanat « à la main » : plus de fenêtre d'inventaire devant une table de craft, un four ou un
// coffre. La caméra se penche sur le bloc et on y pose les objets soi-même, en vrais modèles 3D
// (ceux de la main, voir held.js) :
//  table de craft : une grille 3x3 tracée sur le plateau, le résultat posé à côté (un clic le
//    fabrique) ;
//  four : ce qui cuit dans l'ouverture du dessus, le combustible dans le foyer devant, ce qui est
//    cuit sur le rebord ;
//  coffre : le couvercle s'ouvre, les objets se rangent dedans.
// Souris : gauche, prendre / poser la pile ; droit, poser un seul objet (glisser pour en semer un
// par case) ou prendre la moitié ; Maj + clic, ranger d'un coup. La pile prise est tenue au-dessus
// du bloc. Les objets du sac sont dans la bande du bas. Échap : on se relève ; Tab : la fenêtre
// classique.
// Le carnet (à gauche) : les recettes, celles qu'on peut faire d'abord. Survoler une recette montre
// où poser chaque objet (des fantômes sur la table) ; clic gauche : les poser ; Maj : tout fabriquer ;
// clic droit : garder le guide pendant qu'on pose soi-même (une case fausse rougit). Au four : ce
// qu'on peut cuire et avec quoi le chauffer.
// Toute la logique des cases reste celle de survival.js (click, takeResult, fillRecipe) : ici, on ne
// fait que montrer et viser.
import * as THREE from 'three';
import { EDGE_NORMALS, SIZE, hexToWorld } from './hex.js?v=1.1.0-mx09tneh';
import { craftResult, INV_SIZE, HOTBAR_SLOTS } from './survival.js?v=1.1.0-mx09tneh';
import { COOK_TIME, SMELT, FUEL } from './containers.js?v=1.1.0-mx09tneh';

const BLEND = 0.45; // (s) la caméra glisse vers le bloc, et en revient
const CHEST_TOP = 0.875; // (le coffre est un peu plus petit qu'un bloc, voir mesher.js)
const UP = new THREE.Vector3(0, 1, 0);
const ease = (t) => t * t * (3 - 2 * t);
const same = (a, b) => !!a && !!b && a.kind === b.kind && a.i === b.i;

// L'enveloppe convexe de points [x, z]
function convexHull(P) {
  const p = [...P].sort((a, b) => a[0] - b[0] || a[1] - b[1]), cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], hi = [];
  for (const q of p) { while (lo.length > 1 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 1e-9) lo.pop(); lo.push(q); }
  for (const q of p.reverse()) { while (hi.length > 1 && cr(hi[hi.length - 2], hi[hi.length - 1], q) <= 1e-9) hi.pop(); hi.push(q); }
  return lo.slice(0, -1).concat(hi.slice(0, -1));
}

// Libère un objet de la vue, sauf les modèles partagés (ceux de held.js, ou leurs fantômes)
function dispose(o) {
  if (o.userData.shared) return;
  for (const c of o.children) dispose(c);
  o.geometry?.dispose();
  if (o.material && !o.material.userData?.shared) o.material.dispose();
}

export class HandCraft {
  constructor({ scene, camera, canvas, survival, world, items, isStation, onClose }) {
    this.scene = scene; this.camera = camera; this.canvas = canvas; this.sv = survival; this.world = world;
    this.items = items; // (les modèles 3D des objets, voir held.js)
    this.isStation = isStation; // (id du bloc, sorte) → true s'il est toujours là
    this.onClose = onClose;
    this.visible = false; // (la caméra est (encore) tenue par la vue)
    this.active = false; // (la vue reçoit la souris)
    this.t = 0;
    this.group = new THREE.Group();
    this.group.visible = false;
    scene.add(this.group);
    this.zones = [];
    this.protos = new Map(); // id → modèle 3D (copié pour chaque case)
    this.ghostMats = new Map(); // matériau → sa version fantôme
    this.counts = new Map(); // n → texture
    this.ray = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.eye = new THREE.Vector3(); this.look = new THREE.Quaternion();
    this.guide = null; // (la recette gardée en guide)
    this.preview = null; // (la recette survolée dans le carnet)
    this.buildDom();
  }

  // ---------- Interface (bande d'inventaire, carnet, curseur, bulle) ----------
  buildDom() {
    const layer = this.layer = document.createElement('div');
    layer.id = 'hc-layer';
    layer.hidden = true;
    layer.innerHTML = `<div id="hc-title"></div><div id="hc-hint"></div><div id="hc-tip" hidden></div>
      <div id="hc-book"><div class="hc-book-head">📖 Carnet</div><input id="hc-search" placeholder="Chercher…" spellcheck="false" autocomplete="off">
        <div class="hc-sub"></div><div class="hc-list"></div><div class="hc-book-help"></div></div>
      <div id="hc-inv"><div class="hc-bag"></div><div class="hc-hot"></div></div><div id="hc-cursor"></div>`;
    document.body.appendChild(layer);
    this.el = {
      title: layer.querySelector('#hc-title'), hint: layer.querySelector('#hc-hint'), tip: layer.querySelector('#hc-tip'),
      inv: layer.querySelector('#hc-inv'), cursor: layer.querySelector('#hc-cursor'),
      book: layer.querySelector('#hc-book'), search: layer.querySelector('#hc-search'), list: layer.querySelector('.hc-list'),
      sub: layer.querySelector('.hc-sub'), help: layer.querySelector('.hc-book-help'),
    };
    this.el.hint.innerHTML = '<b>Clic gauche</b> prendre / poser · <b>Clic droit</b> un seul (glisser pour semer) · <b>Maj</b> ranger · <b>Tab</b> fenêtre classique · <b>Échap</b> se relever';
    this.invEls = [];
    const bag = layer.querySelector('.hc-bag'), hot = layer.querySelector('.hc-hot');
    for (let i = 0; i < INV_SIZE; i++) {
      const el = document.createElement('div');
      el.className = 'slot';
      el.dataset.i = i;
      (i < HOTBAR_SLOTS ? hot : bag).appendChild(el);
      this.invEls.push(el);
    }
    this.sigInv = [];
    this.el.search.addEventListener('input', () => this.renderBook());
    // (la souris sur la vue elle-même : on vise le bloc ; sur la bande ou le carnet : leurs cases)
    const ref = (el) => el?.closest?.('#hc-inv .slot') ? { kind: 'inv', i: +el.closest('.slot').dataset.i } : null;
    const scene = (e) => e.target === layer;
    layer.addEventListener('contextmenu', (e) => e.preventDefault());
    layer.addEventListener('mousedown', (e) => {
      if (!this.active || e.target === this.el.search) return;
      if (e.target.closest('#hc-book')) return; // (le carnet a ses propres clics)
      e.preventDefault();
      document.activeElement?.blur?.();
      // (une même pression reçue deux fois : la pile serait prise puis reposée aussitôt)
      if (e.button === this.lastBtn && e.timeStamp - this.lastDown < 40) return;
      this.lastBtn = e.button; this.lastDown = e.timeStamp;
      const r = ref(e.target) || (scene(e) ? this.pick(e) : null);
      if (e.button === 2) { this.dragR = true; this.dragSeen = new Set(); }
      if (!r) return;
      if (e.button === 2) this.dragSeen.add(this.key(r));
      this.act(r, e.button, e.shiftKey);
    });
    addEventListener('mouseup', (e) => { if (e.button === 2) this.dragR = false; });
    layer.addEventListener('mousemove', (e) => {
      this.mx = e.clientX; this.my = e.clientY;
      this.overScene = scene(e);
      this.el.cursor.style.transform = `translate(${e.clientX - 22}px, ${e.clientY - 22}px)`;
      if (!this.active) return;
      if (e.target.closest('#hc-book')) return;
      const r = ref(e.target) || (this.overScene ? this.pick(e) : null);
      this.setHover(r, e);
      // (clic droit tenu : un objet dans chaque case survolée, comme on sème)
      if (this.dragR && r && r.kind !== 'res' && r.kind !== 'fout' && this.sv.cursor && !this.dragSeen.has(this.key(r))) {
        this.dragSeen.add(this.key(r));
        this.act(r, 2, false);
      }
    });
  }
  key(r) { return r.kind + (r.i ?? ''); }

  act(r, button, shift) {
    if (r.kind === 'res') { if (button === 0) this.sv.takeResult(shift); }
    else this.sv.click(r, button, shift);
    const z = this.zones.find((z) => same(z.ref, r));
    if (z) z.bump = 1; // (l'objet saute un peu quand on le pose)
    this.refresh(true);
  }

  tipAt(text, x, y) {
    const tip = this.el.tip;
    if (!text) { tip.hidden = true; return; }
    tip.hidden = false;
    tip.innerHTML = text;
    tip.style.transform = `translate(${x + 16}px, ${y + 18}px)`;
  }
  setHover(r, e) {
    this.hoverRef = r;
    this.sv.hover = r && r.kind !== 'res' ? r : null; // (touches 1..0 : échange avec la barre)
    const s = r ? (r.kind === 'res' ? craftResult(this.sv.gridIds(), this.sv.gridN) : this.sv.get(r)) : null;
    const label = r && (s ? this.esc(this.sv.ui.name(s.id)) + (s.n > 1 ? ' ×' + s.n : '') : this.zoneLabel(r));
    this.tipAt(label, e.clientX, e.clientY);
  }
  esc(t) { return String(t ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]); }
  zoneLabel(r) {
    return { fin: 'Ouverture : ce qui doit cuire', ffuel: 'Foyer : le combustible', fout: 'Rebord : ce qui est cuit', res: 'Le résultat' }[r.kind] || null;
  }

  // ---------- Ouverture / fermeture ----------
  // kind : 'table' | 'furnace' | 'chest' ; (q, r, y) : le bloc ; from : la position du joueur
  // opt : { s : l'objet physique qui porte le bloc (q, r, y : sa grille à lui ; from : le joueur dans
  // cette grille), pair : [q, r] de l'autre moitié d'un grand coffre, first : [q, r] du coffre qui tient
  // ses 30 premières cases, drawer : la commode (son tiroir s'ouvre), facing, title,
  // alive : () => le bloc est toujours là }
  open(kind, q, r, y, blockId, from, opt = {}) {
    this.clear();
    this.kind = kind; this.q = q; this.r = r; this.y = y; this.blockId = blockId;
    this.s = opt.s || null; this.alive = opt.alive || null;
    this.layout = kind !== 'chest' ? kind : opt.pair ? 'double' : opt.drawer ? 'drawer' : 'chest';
    this.guide = this.preview = null;
    const c = hexToWorld(q, r);
    // (le côté du bloc tourné vers le joueur : l'avant ; la commode : son avant à elle ; le grand
    // coffre : en travers de son axe, du côté du joueur)
    let F, A = null, mid = null;
    if (this.layout === 'double') {
      const o = hexToWorld(opt.pair[0], opt.pair[1]);
      mid = new THREE.Vector3((c.x + o.x) / 2, y + CHEST_TOP, (c.z + o.z) / 2);
      const own = opt.first[0] === q && opt.first[1] === r, f = own ? c : o, g = own ? o : c;
      A = new THREE.Vector3(g.x - f.x, 0, g.z - f.z).normalize(); // (des 30 premières cases vers les 30 autres)
      F = new THREE.Vector3(-A.z, 0, A.x);
      if (F.x * (from.x - mid.x) + F.z * (from.z - mid.z) < 0) F.negate();
    } else if (this.layout === 'drawer') {
      const e = EDGE_NORMALS[opt.facing || 0];
      F = new THREE.Vector3(e[0], 0, e[1]);
    } else {
      let best = 0, bd = -Infinity;
      const dx = from.x - c.x, dz = from.z - c.z;
      EDGE_NORMALS.forEach(([nx, nz], i) => { const d = nx * dx + nz * dz; if (d > bd) { bd = d; best = i; } });
      F = new THREE.Vector3(EDGE_NORMALS[best][0], 0, EDGE_NORMALS[best][1]);
    }
    this.F = F;
    const R = this.R = new THREE.Vector3(F.z, 0, -F.x); // (la droite du joueur qui regarde le bloc ; R, -F, haut : un repère direct)
    // (le tiroir de la commode : tiré vers l'avant, son fond à mi-hauteur)
    const DR = { d: 0.82, w: 0.5, l: 0.62, y: 0.56 };
    const top = this.top = mid || (this.layout === 'drawer' ? new THREE.Vector3(c.x, y + DR.y, c.z).addScaledVector(F, DR.d) : new THREE.Vector3(c.x, y + (kind === 'chest' ? CHEST_TOP : 1), c.z));
    const center = new THREE.Vector3(c.x, y + 0.5, c.z);
    let eye, at;
    if (kind === 'table') { eye = top.clone().addScaledVector(F, 0.5).addScaledVector(UP, 0.82); at = top.clone().addScaledVector(F, 0.02); }
    else if (this.layout === 'double') { eye = top.clone().addScaledVector(F, 0.62).addScaledVector(UP, 1.08); at = top.clone().addScaledVector(F, -0.02).addScaledVector(UP, -0.2); }
    else if (this.layout === 'drawer') { eye = top.clone().addScaledVector(F, 0.7).addScaledVector(UP, 1); at = top.clone().addScaledVector(F, -0.12).addScaledVector(UP, 0.05); }
    else if (kind === 'chest') { eye = top.clone().addScaledVector(F, 0.42).addScaledVector(UP, 0.78); at = top.clone().addScaledVector(F, -0.02).addScaledVector(UP, -0.2); }
    else { eye = center.clone().addScaledVector(F, 1.5).addScaledVector(UP, 0.8); at = center.clone().addScaledVector(F, 0.3).addScaledVector(UP, 0.1); }
    this.eyeL = eye;
    this.anchor = kind === 'furnace' ? center.clone().addScaledVector(F, 0.5) : top.clone();
    const m = new THREE.Matrix4().lookAt(eye, at, UP);
    this.lookL = new THREE.Quaternion().setFromRotationMatrix(m);
    // (le regard un peu plus bas que le bloc : il se montre au-dessus de la bande d'inventaire)
    this.lookL.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), kind === 'furnace' ? -0.22 : -0.27));
    // (les cases à plat sur le dessus, ou debout sur la face avant)
    const flat = (p, size, ref, opt = {}) => this.zone(p, new THREE.Matrix4().makeBasis(R, F.clone().negate(), UP), size, ref, opt);
    const front = (p, size, ref, opt = {}) => this.zone(p, new THREE.Matrix4().makeBasis(R, UP, F), size, ref, { ...opt, upright: true });
    const brown = () => new THREE.MeshLambertMaterial({ color: 0x8a5a2b }), dark = () => new THREE.MeshBasicMaterial({ color: 0x2a1a0c, side: THREE.DoubleSide });
    // (une plaque de contour P, des points [x, z] ; épaisseur h, ou à plat)
    const plate = (P, h) => {
      const S = new THREE.Shape(P.map(([x, z]) => new THREE.Vector2(x, -z)));
      return (h ? new THREE.ExtrudeGeometry(S, { depth: h, bevelEnabled: false }) : new THREE.ShapeGeometry(S)).rotateX(-Math.PI / 2);
    };
    if (kind === 'table') {
      for (let i = 0; i < 9; i++) {
        const col = i % 3, row = Math.floor(i / 3);
        // (rangée 0 : au fond, loin du joueur)
        flat(top.clone().addScaledVector(R, (col - 1) * 0.19).addScaledVector(F, (row - 1) * 0.19).addScaledVector(UP, 0.003), 0.165, { kind: 'grid', i }, { mark: true });
      }
      flat(top.clone().addScaledVector(R, 0.4).addScaledVector(F, 0.06).addScaledVector(UP, 0.003), 0.15, { kind: 'res' }, { mark: true, float: true, ring: true });
    } else if (kind === 'furnace') {
      flat(top.clone().addScaledVector(UP, 0.004), 0.3, { kind: 'fin' }, { mark: true, hole: true, sink: true });
      const face = center.clone().addScaledVector(F, 0.503);
      front(face.clone().addScaledVector(UP, -0.24), 0.26, { kind: 'ffuel' }, { mark: true, hole: true, fire: true });
      // (le rebord : une planchette qui dépasse de la face avant)
      // (une dalle hexagonale, aplatie vers l'avant)
      const sill = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.035, 6).rotateY(Math.PI / 6), new THREE.MeshLambertMaterial({ color: 0x6b6b6b }));
      sill.scale.z = 0.6;
      sill.position.copy(face).addScaledVector(UP, 0.08).addScaledVector(F, 0.1);
      sill.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(R, UP, F));
      this.group.add(sill);
      flat(face.clone().addScaledVector(UP, 0.1).addScaledVector(F, 0.1), 0.17, { kind: 'fout' }, { mark: true });
      // (la cuisson en cours : une barre sous le rebord)
      this.bar = this.barMesh(face.clone().addScaledVector(UP, 0.03).addScaledVector(F, 0.002));
    } else if (this.layout === 'drawer') {
      // Commode : le tiroir glisse hors de la façade ; les cases (5 x 6) sont dans le tiroir
      const slide = this.slide = new THREE.Group();
      this.group.add(slide);
      const box = new THREE.Group();
      box.position.copy(top);
      box.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(R, UP, F));
      const part = (w, h, l, x, y0, z, mat) => { const p = new THREE.Mesh(new THREE.BoxGeometry(w, h, l), mat); p.position.set(x, y0, z); box.add(p); };
      const wood = brown(), side = new THREE.MeshLambertMaterial({ color: 0x6e4524 });
      part(DR.w, 0.02, DR.l, 0, -0.012, 0, new THREE.MeshLambertMaterial({ color: 0x3a2412 }));
      part(0.025, 0.13, DR.l, -DR.w / 2, 0.055, 0, side); part(0.025, 0.13, DR.l, DR.w / 2, 0.055, 0, side);
      part(DR.w, 0.13, 0.025, 0, 0.055, -DR.l / 2, side);
      part(DR.w + 0.04, 0.2, 0.035, 0, 0.07, DR.l / 2, wood); // (la façade du tiroir)
      part(0.12, 0.03, 0.04, 0, 0.09, DR.l / 2 + 0.035, new THREE.MeshLambertMaterial({ color: 0xc9a227 })); // (la poignée)
      slide.add(box);
      this.into = slide;
      const n = this.sv.box.slots.length, cols = 5, rows = Math.ceil(n / cols), sp = 0.094;
      for (let i = 0; i < n; i++) {
        const col = i % cols, row = Math.floor(i / cols);
        flat(top.clone().addScaledVector(R, (col - (cols - 1) / 2) * sp).addScaledVector(F, (row - (rows - 1) / 2) * sp).addScaledVector(UP, 0.004), 0.086, { kind: 'box', i }, { mark: true });
      }
      this.into = null;
      this.anchor = top.clone().addScaledVector(UP, 0.1);
    } else if (this.layout === 'double') {
      // Grand coffre : l'octogone (les deux hexagones et l'entre-deux), le grand couvercle rabattu
      // vers le fond ; les 30 cases de chaque coffre de son côté
      const rr = SIZE * CHEST_TOP, pts = [];
      for (const h of [c, hexToWorld(opt.pair[0], opt.pair[1])]) for (let k = 0; k < 6; k++) { const a = (Math.PI / 3) * k - Math.PI / 6; pts.push([h.x + Math.cos(a) * rr - mid.x, h.z + Math.sin(a) * rr - mid.z]); }
      const hull = convexHull(pts);
      const inside = new THREE.Mesh(plate(hull.map(([x, z]) => [x * 0.95, z * 0.95])), dark());
      inside.position.copy(top).addScaledVector(UP, 0.002);
      this.group.add(inside);
      // (la charnière : le long flanc du fond)
      const back = Math.max(...hull.map(([x, z]) => -(x * F.x + z * F.z)));
      const hinge = new THREE.Group();
      hinge.position.copy(top).addScaledVector(F, -back);
      hinge.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(R, UP, F));
      const lid = new THREE.Mesh(plate(hull.map(([x, z]) => [x * R.x + z * R.z, x * F.x + z * F.z + back]), 0.05), brown());
      const pivot = new THREE.Group();
      pivot.add(lid);
      hinge.add(pivot);
      this.group.add(hinge);
      this.lid = pivot;
      const n = this.sv.box.slots.length, half = n / 2, cols = 6, rows = Math.ceil(half / cols), sp = 0.112;
      for (let i = 0; i < n; i++) {
        const j = i % half, col = (i < half ? 0 : cols) + (j % cols), row = Math.floor(j / cols);
        flat(top.clone().addScaledVector(A, (col - (2 * cols - 1) / 2) * sp).addScaledVector(F, (row - (rows - 1) / 2) * sp).addScaledVector(UP, 0.004), 0.1, { kind: 'box', i }, { mark: true });
      }
    } else {
      // (le couvercle ouvert, rabattu vers le fond)
      const lid = new THREE.Mesh(new THREE.CylinderGeometry(SIZE * CHEST_TOP, SIZE * CHEST_TOP, 0.05, 6), new THREE.MeshLambertMaterial({ color: 0x8a5a2b }));
      const hinge = new THREE.Group();
      hinge.position.copy(top).addScaledVector(F, -0.44 * CHEST_TOP);
      hinge.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(R, UP, F));
      lid.position.set(0, 0.03, 0.44 * CHEST_TOP);
      lid.rotation.y = Math.PI / 6;
      const pivot = new THREE.Group(); // (tourne autour de la charnière, l'axe R)
      pivot.add(lid);
      hinge.add(pivot);
      this.group.add(hinge);
      this.lid = pivot;
      // (le fond du coffre, un peu sombre, sous les objets)
      const inside = new THREE.Mesh(new THREE.CircleGeometry(SIZE * CHEST_TOP * 0.93, 6), dark());
      inside.position.copy(top).addScaledVector(UP, 0.002);
      inside.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(R, F.clone().negate(), UP));
      this.group.add(inside);
      const n = this.sv.box.slots.length, cols = 6, rows = Math.ceil(n / cols), sp = 0.112;
      for (let i = 0; i < n; i++) {
        const col = i % cols, row = Math.floor(i / cols);
        flat(top.clone().addScaledVector(R, (col - (cols - 1) / 2) * sp).addScaledVector(F, (row - (rows - 1) / 2) * sp).addScaledVector(UP, 0.004), 0.1, { kind: 'box', i }, { mark: true });
      }
    }
    // (la pile tenue : au-dessus du bloc, sous la souris)
    this.held = new THREE.Group();
    this.held.visible = false;
    this.group.add(this.held);
    this.heldSig = '';
    this.el.title.textContent = opt.title || (kind === 'table' ? 'Table de craft' : kind === 'chest' ? (this.layout === 'double' ? 'Grand coffre' : 'Coffre') : 'Four');
    this.layer.classList.toggle('chest', kind === 'chest');
    this.el.book.hidden = kind === 'chest';
    this.el.search.value = '';
    this.el.search.hidden = kind !== 'table';
    this.buildBook();
    this.group.visible = true;
    this.visible = true; this.active = true; this.closing = false;
    this.layer.hidden = false;
    document.body.classList.add('hc-open');
    this.lidT = 0;
    this.frame();
    this.refresh(true);
  }

  // La vue est posée dans la grille du bloc : celle du monde, ou celle de l'objet physique qui le porte
  // (il peut bouger, tourner, voler : la vue et la caméra le suivent)
  frame() {
    const s = this.s, g = this.group;
    if (s) { g.quaternion.copy(s.quat); g.position.copy(s.com).negate().applyQuaternion(s.quat).add(s.pos); }
    else { g.quaternion.identity(); g.position.set(0, 0, 0); }
    this.eye.copy(this.eyeL).applyQuaternion(g.quaternion).add(g.position);
    this.look.copy(g.quaternion).multiply(this.lookL);
  }

  // Fermeture (la caméra revient au joueur) ; le contenu, lui, est rangé par survival.closeScreen
  close() {
    if (!this.active) return;
    this.active = false; this.closing = true;
    this.layer.hidden = true;
    this.el.tip.hidden = true;
    this.sv.hover = null;
    this.dragR = false;
    this.guide = this.preview = null;
    if (this.held) this.held.visible = false;
    document.activeElement === this.el.search && this.el.search.blur();
    document.body.classList.remove('hc-open');
  }

  // On repasse à la fenêtre classique (Tab) : la vue s'en va tout de suite
  drop() { this.close(); this.t = 0; this.finish(); }

  finish() { this.visible = false; this.closing = false; this.group.visible = false; this.clear(); }

  clear() {
    for (const o of [...this.group.children]) { this.group.remove(o); dispose(o); }
    this.zones = []; this.bar = null; this.lid = null; this.slide = null; this.fire = null; this.held = null;
  }

  // ---------- Les modèles 3D ----------
  // Une copie du modèle de l'objet (géométrie et matériaux partagés avec held.js) ; ghost : en
  // fantôme (translucide)
  model(id, ghost = false) {
    let p = this.protos.get(id);
    if (!p) { p = this.items.model(id); this.protos.set(id, p); }
    const m = p.clone();
    m.userData.shared = true;
    m.userData.flat = p.userData.flat;
    if (ghost) m.traverse((x) => { if (x.material) x.material = this.ghostMat(x.material); });
    return m;
  }
  ghostMat(mat) {
    let g = this.ghostMats.get(mat);
    if (!g) {
      g = mat.clone();
      g.transparent = true; g.opacity = 0.42; g.depthWrite = false; g.alphaTest = 0;
      g.userData = { shared: true };
      this.ghostMats.set(mat, g);
    }
    return g;
  }

  // Un objet posé dans une case : un bloc debout sur sa base (une pile : plusieurs blocs l'un sur
  // l'autre), un objet plat couché (une pile : plusieurs, un peu décalés)
  placed(z, id, n, ghost = false) {
    const g = new THREE.Group();
    g.userData.shared = false;
    const proto = this.model(id, ghost), flat = proto.userData.flat;
    const k = flat ? z.size * 0.95 : z.size * 0.62;
    const layers = ghost ? 1 : flat ? Math.min(4, Math.ceil(n / 8)) : Math.min(3, Math.ceil(n / 16));
    // (chaque case tourne un peu ses objets : on les a posés à la main)
    const seed = (z.ref.i ?? 7) * 2.399 + id * 0.37;
    for (let l = 0; l < layers; l++) {
      const m = l ? this.model(id, ghost) : proto;
      m.scale.setScalar(k);
      if (flat) {
        // (couché sur le plateau, sa face vers le haut ; debout contre une face avant)
        m.position.set((l % 2 ? 1 : -1) * l * 0.006, -l * 0.005, 0.012 + l * 0.01);
        m.rotation.set(0, 0, Math.sin(seed + l) * 0.35);
      } else if (z.opt.upright) {
        m.position.set(0, -z.size * 0.1 + l * k, k * 0.3);
        m.rotation.set(0, Math.sin(seed + l) * 0.3, 0);
      } else {
        // (le bloc : son haut vers le haut de la case, posé dessus)
        m.rotation.set(Math.PI / 2, Math.sin(seed + l) * 0.5, 0);
        m.position.set(0, 0, k * 0.5 + l * k - (z.opt.sink ? k * 0.7 : 0));
      }
      g.add(m);
    }
    return g;
  }

  countTex(n) {
    let t = this.counts.get(n);
    if (!t) {
      const c = document.createElement('canvas');
      c.width = 64; c.height = 32;
      const x = c.getContext('2d');
      x.font = 'bold 26px sans-serif'; x.textAlign = 'right'; x.textBaseline = 'middle';
      x.lineWidth = 5; x.strokeStyle = '#000'; x.strokeText(n, 60, 17);
      x.fillStyle = '#fff'; x.fillText(n, 60, 17);
      t = new THREE.CanvasTexture(c);
      this.counts.set(n, t);
    }
    return t;
  }

  // ---------- Les cases ----------
  // (des hexagones, comme tout dans le jeu : pointe à droite et à gauche, côtés plats en haut et en
  // bas ; size : la largeur d'un côté plat à l'autre, à peu près celle de l'ancienne case carrée)
  hexGeo(size) { return new THREE.CircleGeometry(size * 0.58, 6); }
  zone(p, basis, size, ref, opt) {
    const g = new THREE.Group();
    g.position.copy(p);
    g.quaternion.setFromRotationMatrix(basis);
    // (le contour de la case, tracé sur le bloc)
    if (opt.mark) {
      const geo = opt.hole ? new THREE.CircleGeometry(size * 0.6, 6) : this.hexGeo(size);
      const mat = new THREE.MeshBasicMaterial({ color: opt.hole ? 0x080808 : 0x000000, transparent: true, opacity: opt.hole ? 0.85 : 0.18, depthWrite: false });
      const m = new THREE.Mesh(geo, mat);
      m.renderOrder = 1;
      g.add(m);
      {
        const edge = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: opt.ring ? 0xffe08a : opt.hole ? 0x3a3a3a : 0x2a1a0a, transparent: true, opacity: 0.55 }));
        edge.position.z = 0.0005;
        g.add(edge);
      }
    }
    if (opt.fire) {
      const fm = new THREE.Mesh(new THREE.CircleGeometry(size * 0.55, 6), new THREE.MeshBasicMaterial({ color: 0xff7a1a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
      fm.position.z = 0.001;
      g.add(fm);
      this.fire = fm;
    }
    // (la surbrillance de la case visée ; rouge : pas ce que demande le guide)
    const hl = new THREE.Mesh(this.hexGeo(size * 1.06), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }));
    hl.position.z = 0.0008;
    hl.renderOrder = 2;
    g.add(hl);
    // (ce que la souris peut viser : un peu plus grand que la case)
    const hit = new THREE.Mesh(this.hexGeo(size * 1.12), new THREE.MeshBasicMaterial({ visible: false }));
    g.add(hit);
    const items = new THREE.Group(), ghost = new THREE.Group();
    g.add(items, ghost);
    (this.into || this.group).add(g);
    const z = { ref, g, hl, hit, items, ghost, size, opt, sig: null, ghostSig: '', bad: false, bump: 0 };
    hit.userData.zone = z;
    this.zones.push(z);
    return z;
  }

  barMesh(p) {
    const g = new THREE.Group();
    g.position.copy(p);
    g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(this.R, UP, this.F));
    // (une barre aux bouts en pointe, comme les jauges du jeu)
    const pill = (w, h) => { const S = new THREE.Shape(); S.moveTo(-w / 2, 0); S.lineTo(-w / 2 + h / 2, h / 2); S.lineTo(w / 2 - h / 2, h / 2); S.lineTo(w / 2, 0); S.lineTo(w / 2 - h / 2, -h / 2); S.lineTo(-w / 2 + h / 2, -h / 2); S.closePath(); return new THREE.ShapeGeometry(S); };
    const bg = new THREE.Mesh(pill(0.3, 0.03), new THREE.MeshBasicMaterial({ color: 0x202020 }));
    const fg = new THREE.Mesh(pill(0.3, 0.03), new THREE.MeshBasicMaterial({ color: 0xffb040 }));
    fg.position.z = 0.001;
    g.add(bg, fg);
    this.group.add(g);
    return fg;
  }

  // Ce qui est posé dans une case : son modèle 3D (en pile s'il y en a plusieurs), et le nombre
  show(z, s) {
    const sig = s ? s.id + ':' + s.n : '';
    if (sig === z.sig) return;
    z.sig = sig;
    for (const o of [...z.items.children]) { z.items.remove(o); dispose(o); }
    if (!s) return;
    z.items.add(this.placed(z, s.id, s.n));
    if (s.n > 1) {
      const c = new THREE.Mesh(new THREE.PlaneGeometry(z.size * 0.7, z.size * 0.35), new THREE.MeshBasicMaterial({ map: this.countTex(s.n), transparent: true, depthTest: false }));
      c.position.set(z.size * 0.18, -z.size * 0.32, z.opt.upright ? z.size * 0.5 : 0.03);
      c.renderOrder = 5;
      z.items.add(c);
    }
  }

  // Le fantôme d'une case (ce que le guide y attend) ; bad : la case a autre chose (elle rougit)
  showGhost(z, id, bad) {
    z.bad = bad;
    const sig = id ? String(id) : '';
    if (sig === z.ghostSig) return;
    z.ghostSig = sig;
    for (const o of [...z.ghost.children]) { z.ghost.remove(o); dispose(o); }
    if (id) z.ghost.add(this.placed(z, id, 1, true));
  }

  // Met la vue à jour d'après le contenu des cases (seulement ce qui a changé)
  refresh(force = false) {
    if (!this.active) return;
    const sv = this.sv;
    for (const z of this.zones) {
      const s = z.ref.kind === 'res' ? craftResult(sv.gridIds(), sv.gridN) : sv.get(z.ref);
      this.show(z, s);
    }
    let inv = force;
    for (let i = 0; i < INV_SIZE; i++) {
      const s = sv.slots[i], sig = s ? s.id + ':' + s.n + ':' + (s.w || 0) : '';
      if (force || sig !== this.sigInv[i]) { this.sigInv[i] = sig; sv.fill(this.invEls[i], s, 40); inv = true; }
    }
    if (inv) this.renderBook();
    this.renderGuide();
    const cs = sv.cursor ? sv.cursor.id + ':' + sv.cursor.n : '';
    if (cs !== this.sigCur) {
      this.sigCur = cs;
      this.el.cursor.innerHTML = '';
      if (sv.cursor) { const h = document.createElement('div'); h.className = 'slot ghost'; sv.fill(h, sv.cursor, 44); this.el.cursor.appendChild(h); }
    }
    // (la pile tenue, en 3D au-dessus du bloc)
    if (this.held && cs !== this.heldSig) {
      this.heldSig = cs;
      for (const o of [...this.held.children]) { this.held.remove(o); dispose(o); }
      if (sv.cursor) {
        const m = this.model(sv.cursor.id);
        m.scale.setScalar(m.userData.flat ? 0.13 : 0.075);
        this.held.add(m);
      }
    }
  }

  // ---------- Le carnet ----------
  buildBook() {
    const list = this.el.list;
    list.innerHTML = '';
    this.entries = [];
    const sv = this.sv, add = (e, outId, n) => {
      const el = document.createElement('div');
      el.className = 'hc-rec';
      el.appendChild(sv.ui.icon(outId, 34));
      if (n > 1) { const b = document.createElement('b'); b.textContent = n; el.appendChild(b); }
      e.el = el;
      el.addEventListener('mouseenter', (ev) => { this.preview = e; this.tipAt(this.entryTip(e), ev.clientX, ev.clientY); this.renderGuide(); });
      el.addEventListener('mousemove', (ev) => this.tipAt(this.entryTip(e), ev.clientX, ev.clientY));
      el.addEventListener('mouseleave', () => { if (this.preview === e) this.preview = null; this.tipAt(null); this.renderGuide(); });
      el.addEventListener('mousedown', (ev) => { ev.preventDefault(); this.useEntry(e, ev.button, ev.shiftKey); });
      list.appendChild(el);
      this.entries.push(e);
    };
    if (this.kind === 'table') {
      this.el.sub.textContent = 'Survole : où poser · clic : poser · Maj : tout fabriquer · clic droit : garder le guide';
      for (const b of sv.book || []) add({ kind: 'craft', b, out: b.rec.out[0], name: sv.ui.name(b.rec.out[0]) }, b.rec.out[0], b.rec.out[1]);
    } else if (this.kind === 'furnace') {
      this.el.sub.textContent = 'Ce que tu peux cuire, et de quoi chauffer : clic pour le mettre au four';
    }
    this.renderBook();
  }

  // Au four : ce qu'on a de cuisable et de combustible (refait quand l'inventaire change)
  furnaceEntries() {
    const sv = this.sv, seen = new Set(), list = this.el.list;
    for (const e of this.entries) e.el.remove();
    this.entries = [];
    if (this.preview) { this.preview = null; this.tipAt(null); }
    const add = (e, icon) => {
      const el = document.createElement('div');
      el.className = 'hc-rec can' + (e.kind === 'fuel' ? ' fuel' : '');
      el.appendChild(sv.ui.icon(icon, 34));
      if (e.out !== undefined) { const o = sv.ui.icon(e.out, 18); o.className = 'mini'; el.appendChild(o); }
      e.el = el;
      el.addEventListener('mouseenter', (ev) => { this.preview = e; this.tipAt(this.entryTip(e), ev.clientX, ev.clientY); this.renderGuide(); });
      el.addEventListener('mouseleave', () => { if (this.preview === e) this.preview = null; this.tipAt(null); this.renderGuide(); });
      el.addEventListener('mousedown', (ev) => { ev.preventDefault(); this.useEntry(e, ev.button, ev.shiftKey); });
      list.appendChild(el);
      this.entries.push(e);
    };
    for (const s of sv.slots) if (s && SMELT[s.id] !== undefined && !seen.has('c' + s.id)) { seen.add('c' + s.id); add({ kind: 'smelt', id: s.id, out: SMELT[s.id] }, s.id); }
    for (const s of sv.slots) if (s && FUEL[s.id] && !seen.has('f' + s.id)) { seen.add('f' + s.id); add({ kind: 'fuel', id: s.id }, s.id); }
    this.el.help.textContent = this.entries.length ? '' : "Rien à cuire dans ton sac (minerais, sable, viande crue…) ni de quoi chauffer (charbon, bois…).";
  }

  renderBook() {
    if (!this.active || !this.entries) return;
    if (this.kind === 'furnace') { this.furnaceEntries(); return; }
    if (this.kind !== 'table') return;
    const q = this.el.search.value.trim().toLowerCase();
    let shown = 0;
    for (const e of this.entries) {
      const show = !q || e.b.search.includes(q);
      e.el.hidden = !show;
      if (!show) continue;
      shown++;
      const can = this.sv.canMake(e.b);
      e.el.classList.toggle('can', can);
      e.el.classList.toggle('pinned', this.guide === e);
      e.el.style.order = can ? 0 : 1;
    }
    this.el.help.textContent = shown ? '' : 'Aucune recette ne correspond.';
  }

  entryTip(e) {
    const sv = this.sv, n = (id) => this.esc(sv.ui.name(id));
    if (e.kind === 'fuel') return `<b>${n(e.id)}</b><br><small>Combustible : clic pour le mettre dans le foyer</small>`;
    if (e.kind === 'smelt') return `<b>${n(e.id)} → ${n(e.out)}</b><br><small>Clic : dans l'ouverture du four${sv.box?.fuel ? '' : ' (et un combustible dans le foyer)'}</small>`;
    const lines = [...e.b.need].map(([id, k]) => {
      const have = sv.countOf(id) + sv.grid.reduce((a, g) => a + (g?.id === id ? g.n : 0), 0);
      return `<span class="${have >= k ? 'ok' : 'ko'}">${k} × ${n(id)} <small>(${have})</small></span>`;
    });
    return `<b>${this.esc(e.name)}${e.b.rec.out[1] > 1 ? ' ×' + e.b.rec.out[1] : ''}</b><br>${lines.join('<br>')}`;
  }

  useEntry(e, button, shift) {
    const sv = this.sv;
    if (e.kind === 'craft') {
      if (button === 2) { this.guide = this.guide === e ? null : e; this.renderBook(); this.renderGuide(); return; }
      if (button !== 0) return;
      if (this.guide && this.guide !== e) { this.guide = null; this.renderBook(); }
      sv.fillRecipe(e.b, shift);
      for (const z of this.zones) if (z.ref.kind === 'grid') z.bump = 1;
    } else if (button === 0) {
      // (au four : la pile du sac dans l'ouverture, ou dans le foyer ; un combustible avec, s'il manque)
      this.moveIn(e.kind === 'fuel' ? 'ffuel' : 'fin', e.id);
      if (e.kind === 'smelt' && !sv.box?.fuel) { const f = this.fuelFor(e.id); if (f) this.moveIn('ffuel', f.id); }
    }
    this.refresh(true);
  }

  // Le combustible du sac pour cuire id (de préférence ce qui ne se cuit pas lui-même)
  fuelFor(id) {
    const s = this.sv.slots;
    return s.find((x) => x && FUEL[x.id] && SMELT[x.id] === undefined) || s.find((x) => x && FUEL[x.id] && x.id !== id) || null;
  }

  // Range dans une case du four (fin, ffuel) toutes les piles id du sac qui y tiennent
  moveIn(kind, id) {
    const sv = this.sv;
    for (let i = 0; i < INV_SIZE; i++) {
      const s = sv.slots[i];
      if (!s || s.id !== id) continue;
      const left = sv.putIn({ kind }, id, s.n, s.w);
      if (left === s.n) break;
      if (left) s.n = left; else sv.slots[i] = null;
    }
    const z = this.zones.find((z) => z.ref.kind === kind);
    if (z) z.bump = 1;
    sv.changed();
  }

  // Les fantômes : ce que demande la recette survolée (ou gardée en guide), case par case
  renderGuide() {
    const e = this.preview || this.guide, sv = this.sv;
    for (const z of this.zones) {
      let want = 0, bad = false;
      if (e?.kind === 'craft' && (z.ref.kind === 'grid' || z.ref.kind === 'res')) {
        const f = e.b.rec.forms[0];
        if (z.ref.kind === 'res') want = craftResult(sv.gridIds(), sv.gridN)?.id === e.out ? 0 : e.out;
        else {
          const r = Math.floor(z.ref.i / 3), c = z.ref.i % 3, id = f[r]?.[c] || 0, have = sv.grid[z.ref.i]?.id || 0;
          want = id && have !== id ? id : 0;
          bad = !!have && have !== id;
        }
      } else if (e?.kind === 'smelt') {
        if (z.ref.kind === 'fin' && sv.box?.input?.id !== e.id) want = e.id;
        if (z.ref.kind === 'fout' && !sv.box?.output) want = e.out;
        if (z.ref.kind === 'ffuel' && !sv.box?.fuel) want = this.fuelFor(e.id)?.id || 0;
      } else if (e?.kind === 'fuel' && z.ref.kind === 'ffuel' && sv.box?.fuel?.id !== e.id) want = e.id;
      this.showGhost(z, want, bad);
    }
  }

  pick(e) {
    const b = this.canvas.getBoundingClientRect();
    this.mouse.set(((e.clientX - b.left) / b.width) * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1);
    this.camera.updateMatrixWorld();
    this.ray.setFromCamera(this.mouse, this.camera);
    const hit = this.ray.intersectObjects(this.zones.map((z) => z.hit), false)[0];
    return hit ? hit.object.userData.zone.ref : null;
  }

  // ---------- À chaque image ----------
  update(dt) {
    if (!this.visible) return;
    this.t = Math.min(1, Math.max(0, this.t + (this.closing ? -dt : dt) / BLEND));
    if (this.closing && this.t <= 0) { this.finish(); return; }
    this.frame();
    if (this.active) {
      // le bloc a disparu (cassé, explosé) : on se relève
      if (this.alive ? !this.alive() : !this.isStation(this.world.getBlock(this.q, this.r, this.y), this.kind)) { this.onClose(); return; }
      this.refresh();
    }
    const time = performance.now() / 1000;
    for (const z of this.zones) {
      const hov = same(this.hoverRef, z.ref);
      z.hl.material.color.setHex(z.bad ? 0xff3030 : 0xffffff);
      z.hl.material.opacity += ((z.bad ? 0.35 : hov ? 0.22 : 0) - z.hl.material.opacity) * Math.min(1, dt * 14);
      z.bump = Math.max(0, z.bump - dt * 5);
      // (le résultat flotte au-dessus du plateau, en tournant doucement ; l'objet posé saute un peu)
      z.items.position.z = z.opt.float ? 0.05 + Math.sin(time * 2.2) * 0.012 : Math.sin(z.bump * Math.PI) * 0.03;
      if (z.opt.float) z.items.rotation.z = time * 0.9;
      // (le fantôme respire doucement)
      z.ghost.position.z = (z.opt.float ? 0.05 : 0) + Math.sin(time * 3) * 0.006;
      if (z.opt.float) z.ghost.rotation.z = time * 0.9;
    }
    const box = this.sv.box;
    if (this.fire && box) this.fire.material.opacity = box.burnMax ? 0.35 + 0.45 * (box.burn / box.burnMax) * (0.85 + 0.15 * Math.sin(time * 13)) : 0;
    if (this.bar && box) { const k = Math.max(0.001, Math.min(1, (box.cook || 0) / COOK_TIME)); this.bar.scale.x = k; this.bar.position.x = -0.15 * (1 - k); }
    if (this.slide) { this.lidT = Math.min(1, this.lidT + dt * 3); this.slide.position.copy(this.F).multiplyScalar(-(1 - ease(this.closing ? this.t : this.lidT)) * 0.7); }
    if (this.lid) { this.lidT = Math.min(1, this.lidT + dt * 3); this.lid.rotation.x = -ease(this.closing ? this.t : this.lidT) * 1.75; }
  }

  // La caméra : du regard du joueur vers le bloc (après la caméra du joueur, voir main.js)
  apply(camera) {
    if (!this.visible) return;
    const k = ease(this.t);
    camera.position.lerp(this.eye, k);
    camera.quaternion.slerp(this.look, k);
    this.placeHeld(camera);
  }

  // La pile tenue suit la souris, au-dessus du bloc (sur la bande ou le carnet : son icône). Après
  // la caméra de la vue, pour qu'elle soit bien sous la souris.
  placeHeld(camera) {
    if (!this.held) return;
    const on = this.active && !!this.sv.cursor && this.overScene && this.mx !== undefined;
    this.held.visible = on;
    this.el.cursor.style.visibility = on ? 'hidden' : '';
    if (!on) return;
    const b = this.canvas.getBoundingClientRect(), time = performance.now() / 1000;
    this.mouse.set(((this.mx - b.left) / b.width) * 2 - 1, -((this.my - b.top) / b.height) * 2 + 1);
    camera.updateMatrixWorld();
    this.ray.setFromCamera(this.mouse, camera);
    // (sur un plan face à la caméra, un peu avant le bloc ; la scène est décalée de -ORIGIN, voir origin.js)
    const off = this.scene.position;
    const n = camera.getWorldDirection(new THREE.Vector3()).negate();
    const o = this.ray.ray.origin, d = this.ray.ray.direction;
    const g = this.group, p0 = this.anchor.clone().applyQuaternion(g.quaternion).add(g.position).add(off).addScaledVector(n, 0.15);
    const t = p0.sub(o).dot(n) / d.dot(n);
    if (!Number.isFinite(t) || t <= 0) return;
    this.held.position.copy(o).addScaledVector(d, t).sub(off).sub(g.position).applyQuaternion(g.quaternion.clone().invert());
    this.held.position.y += Math.sin(time * 4) * 0.006;
    this.held.rotation.set(0.35, time * 0.8, 0);
  }
}
