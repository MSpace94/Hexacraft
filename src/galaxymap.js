// La carte de la galaxie (dans l'espace, à la place de la carte du monde) : la galaxie où l'on est, en
// 3D (Andromède, celle d'Hexa ; ou la Voie lactée, avec ses bras spiraux), son centre (M31* ou
// Sagittarius A*), les systèmes visités (et le chemin suivi d'un système à l'autre), et « tu es ici ».
// Faite pour savoir à peu près où l'on est : à quelle distance du centre, dans quel bras, au-dessus ou
// au-dessous du plan, et à quelle distance d'Hexa. Toutes les étoiles du catalogue y sont : l'autre
// galaxie, au loin, n'est qu'une tache.
// Souris : glisser pour tourner, clic droit (ou Maj) + glisser pour se déplacer, molette pour zoomer ;
// au doigt : un doigt pour tourner, deux pour zoomer. Un clic sur un nom : ce qu'on en sait ; un double
// clic : on va le voir.
// Son propre rendu WebGL, créé à l'ouverture et rendu à la fermeture (rien ne reste en mémoire), et
// une image seulement quand la vue change (et pour le « tu es ici » qui pulse, 20 fois par seconde).
import * as THREE from 'three';
import { GX, GY_, GZ, GTYPE, GNAME, GFAMOUS, GAL_N, TYPES, CENTER, NEBULAE, ARMFX, galaxyPlace, AND_CENTER, AND_FRAME, andromedaPlace } from './galaxie.js?v=1.1.0-mx09tneh';
import { STAR_TYPES } from './customsys.js?v=1.1.0-mx09tneh';

const fmt = (n) => Math.round(n).toLocaleString('fr-FR');
const ly = (d) => (d < 0.1 ? fmt(d * 63241) + ' UA' : d < 10 ? d.toLocaleString('fr-FR', { maximumFractionDigits: 2 }) + ' al' : fmt(d) + ' al');
const NEB_COL = { hii: '#ff6fa8', sombre: '#5a4030', reflexion: '#7fa8ff', planetaire: '#5fe0d0', reste: '#ffa060' };

const VERT = `
attribute vec3 color; attribute float size;
uniform float uScale, uMin, uMax, uFloor;
varying vec3 vC; varying float vA;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float s = size * uScale / max(-mv.z, 1e-3);
  vA = clamp(s / uMin, uFloor, 1.0); // (trop petit pour être vu : plus pâle, jusqu'à uFloor)
  gl_PointSize = clamp(s, uMin, uMax);
  vC = color;
}`;
const FRAG = `
uniform float uGain; varying vec3 vC; varying float vA;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  if (d > 1.0) discard;
  float a = 1.0 - d; a *= a;
  gl_FragColor = vec4(vC * a * vA * uGain, 1.0);
}`;
const pointsMat = (min, max, gain, floor = 0.08) => new THREE.ShaderMaterial({
  uniforms: { uScale: { value: 800 }, uMin: { value: min }, uMax: { value: max }, uGain: { value: gain }, uFloor: { value: floor } },
  vertexShader: VERT, fragmentShader: FRAG, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
});

export class GalaxyMap {
  // wrap : la boîte où dessiner ; info : la ligne d'information sous la carte
  constructor(wrap, info) {
    this.wrap = wrap; this.info = info;
    this.r = null;
  }
  // d : { at (al, compté depuis Hexa), visited : [{ id, n, d, p }], here : le nom de l'endroit }
  open(d) {
    this.d = d;
    const W = this.wrap;
    this.r = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'low-power' });
    this.r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.r.setClearColor(0x02030a);
    this.r.domElement.className = 'gm-canvas';
    W.prepend(this.r.domElement);
    this.labels = document.createElement('div');
    this.labels.className = 'gm-labels';
    W.append(this.labels);
    this.cam = new THREE.PerspectiveCamera(55, 1, 0.05, 2e6);
    this.scene = new THREE.Scene();
    this.mats = [];
    this.build();
    // la vue : autour d'un point (focus), à une distance (dist), tournée (yaw) et penchée (pitch)
    this.focus = new THREE.Vector3(d.at.x, d.at.y, d.at.z);
    this.goal = { f: this.focus.clone(), dist: 9000 };
    this.dist = 60000; this.yaw = 0.6; this.pitch = 0.85; this.anim = true; // (on arrive de loin : la galaxie, puis on s'approche)
    this.sel = null;
    this.input();
    this.resize = () => this.fit();
    window.addEventListener('resize', this.resize);
    this.fit();
    this.dirty = true; this.t0 = performance.now(); this.lastPulse = 0;
    const loop = (t) => { if (!this.r) return; this.raf = requestAnimationFrame(loop); this.frame(t); };
    this.raf = requestAnimationFrame(loop);
    this.text();
  }
  close() {
    if (!this.r) return;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.resize);
    this.off?.();
    this.scene.traverse((o) => { o.geometry?.dispose(); });
    for (const m of this.mats) { m.map?.dispose(); m.dispose(); }
    this.r.dispose(); this.r.forceContextLoss(); this.r.domElement.remove();
    this.labels.remove();
    this.r = null; this.scene = null;
  }
  fit() {
    const w = this.wrap.clientWidth || 800, h = this.wrap.clientHeight || 500;
    this.r.setSize(w, h, false);
    this.cam.aspect = w / h; this.cam.updateProjectionMatrix();
    const k = (this.r.getPixelRatio() * h) / (2 * Math.tan((this.cam.fov * Math.PI) / 360));
    for (const m of this.mats) if (m.uniforms?.uScale) m.uniforms.uScale.value = k;
    this.dirty = true;
  }
  mat(m) { this.mats.push(m); return m; }
  build() {
    const S = this.scene, d = this.d;
    // (la galaxie où l'on est : la plus proche de ses deux centres)
    const and = this.and = dist(d.at, AND_CENTER) < dist(d.at, CENTER), GC = this.gc = and ? AND_CENTER : CENTER, Fr = AND_FRAME;
    // (dans le plan de la galaxie, autour de son centre : x, z -> point)
    const plane = (a, b) => (and ? { x: GC.x + a * Fr.A1.x + b * Fr.A2.x, y: GC.y + a * Fr.A1.y + b * Fr.A2.y, z: GC.z + a * Fr.A1.z + b * Fr.A2.z } : { x: GC.x + a, y: GC.y, z: GC.z + b });
    // (les systèmes visités : leur voisinage s'allume un peu, c'est la part de la galaxie qu'on connaît)
    const V = d.visited.filter((v) => v.p);
    const seen = (x, y, z) => { for (const v of V) if ((v.p.x - x) ** 2 + (v.p.y - y) ** 2 + (v.p.z - z) ** 2 < 250000) return true; return false; };
    // les étoiles de la Voie lactée (chacune est un système où aller)
    const col = TYPES.map((t) => new THREE.Color(STAR_TYPES[t]?.trou ? '#ffb070' : STAR_TYPES[t]?.couleur || '#ffffff'));
    const n = GAL_N, P = new Float32Array(n * 3), C = new Float32Array(n * 3), Z = new Float32Array(n);
    let k = 0;
    for (let i = 0; i < n; i++) {
      if (!GX[i] && !GY_[i] && !GZ[i]) continue;
      const c = col[GTYPE[i]] || col[2], near = V.length && seen(GX[i], GY_[i], GZ[i]), f = near ? 1 : 0.55;
      P[k * 3] = GX[i]; P[k * 3 + 1] = GY_[i]; P[k * 3 + 2] = GZ[i];
      C[k * 3] = c.r * f; C[k * 3 + 1] = c.g * f; C[k * 3 + 2] = c.b * f;
      Z[k] = near ? 3 : GFAMOUS[i] ? 2 : 1.2;
      k++;
    }
    const pts = (P, C, Z, n, m) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('color', new THREE.BufferAttribute(C, 3)); g.setAttribute('size', new THREE.BufferAttribute(Z, 1));
      g.setDrawRange(0, n);
      const p = new THREE.Points(g, this.mat(m));
      p.frustumCulled = false;
      S.add(p);
      return p;
    };
    pts(P, C, Z, k, pointsMat(2.2, 8, 1.3, 0.4));
    // la lueur des bras spiraux : les amas bleus et les nuages roses (voir ARMFX), et le bulbe
    const A = ARMFX, an = A.n, AP = new Float32Array(an * 3), AC = new Float32Array(an * 3), AZ = new Float32Array(an);
    const blue = new THREE.Color('#5d86ff'), pink = new THREE.Color('#ff5d9a');
    for (let i = 0; i < A.n; i++) {
      AP[i * 3] = A.X[i]; AP[i * 3 + 1] = A.Y[i]; AP[i * 3 + 2] = A.Z[i];
      const c = A.K[i] ? blue : pink;
      AC[i * 3] = c.r; AC[i * 3 + 1] = c.g; AC[i * 3 + 2] = c.b;
      AZ[i] = A.S[i] * 9;
    }
    pts(AP, AC, AZ, A.n, pointsMat(0.5, 260, 0.22));
    // (le bulbe : une lueur dorée au centre, les vieilles étoiles serrées)
    pts(new Float32Array([GC.x, GC.y, GC.z, GC.x, GC.y, GC.z]), new Float32Array([1, 0.72, 0.4, 1, 0.85, 0.6]), new Float32Array(and ? [16000, 5000] : [14000, 4000]), 2, pointsMat(2, 900, 0.5, 1));
    // les nébuleuses
    const nn = NEBULAE.length, NP = new Float32Array(nn * 3), NC = new Float32Array(nn * 3), NZ = new Float32Array(nn);
    NEBULAE.forEach((N, i) => {
      const c = new THREE.Color(NEB_COL[N.type] || '#ff80b0');
      NP[i * 3] = N.x; NP[i * 3 + 1] = N.y; NP[i * 3 + 2] = N.z;
      NC[i * 3] = c.r; NC[i * 3 + 1] = c.g; NC[i * 3 + 2] = c.b; NZ[i] = N.R * 2.2;
    });
    if (nn) pts(NP, NC, NZ, nn, pointsMat(1, 160, 0.35));
    // le plan de la galaxie : des cercles tous les 10 000 al autour du centre (pour lire la profondeur)
    const ring = this.mat(new THREE.LineBasicMaterial({ color: 0x3fd6ee, transparent: true, opacity: 0.13, depthWrite: false }));
    for (let R = 10000; R <= (and ? 100000 : 60000); R += 10000) {
      const g = new THREE.BufferGeometry(), q = [];
      for (let a = 0; a <= 128; a++) { const t = (a / 128) * Math.PI * 2, p = plane(Math.cos(t) * R, Math.sin(t) * R); q.push(p.x, p.y, p.z); }
      g.setAttribute('position', new THREE.Float32BufferAttribute(q, 3));
      S.add(new THREE.Line(g, ring));
    }
    // le chemin suivi : les systèmes visités, dans l'ordre
    if (V.length > 1) {
      const g = new THREE.BufferGeometry().setFromPoints([...V].sort((a, b) => a.d - b.d).map((v) => new THREE.Vector3(v.p.x, v.p.y, v.p.z)));
      S.add(new THREE.Line(g, this.mat(new THREE.LineBasicMaterial({ color: 0x7fe8ff, transparent: true, opacity: 0.55, depthWrite: false }))));
    }
    // les systèmes visités (en cyan), Hexa (en or)
    const vn = V.length, VP = new Float32Array(vn * 3), VC = new Float32Array(vn * 3), VZ = new Float32Array(vn);
    V.forEach((v, i) => { VP[i * 3] = v.p.x; VP[i * 3 + 1] = v.p.y; VP[i * 3 + 2] = v.p.z; const h = v.id === 'star'; VC[i * 3] = h ? 1 : 0.45; VC[i * 3 + 1] = h ? 0.85 : 0.95; VC[i * 3 + 2] = h ? 0.4 : 1; VZ[i] = 30; });
    if (vn) pts(VP, VC, VZ, vn, pointsMat(10, 18, 2.2, 1));
    // « tu es ici » : un anneau qui pulse, et sa ligne jusqu'au plan de la galaxie
    const ringTex = (() => {
      const c = document.createElement('canvas'); c.width = c.height = 64;
      const x = c.getContext('2d'); x.strokeStyle = '#ffffff'; x.lineWidth = 5; x.beginPath(); x.arc(32, 32, 26, 0, Math.PI * 2); x.stroke();
      x.fillStyle = '#ffffff'; x.beginPath(); x.arc(32, 32, 7, 0, Math.PI * 2); x.fill();
      return new THREE.CanvasTexture(c);
    })();
    const at = d.at;
    this.me = new THREE.Sprite(this.mat(new THREE.SpriteMaterial({ map: ringTex, color: 0xffd34a, sizeAttenuation: false, depthTest: false, transparent: true })));
    this.me.position.set(at.x, at.y, at.z);
    this.me.renderOrder = 10;
    S.add(this.me);
    // (le pied : le point du plan de la galaxie juste sous « tu es ici »)
    const hh = and ? (at.x - GC.x) * Fr.N.x + (at.y - GC.y) * Fr.N.y + (at.z - GC.z) * Fr.N.z : at.y - GC.y;
    const foot = and ? new THREE.Vector3(at.x - Fr.N.x * hh, at.y - Fr.N.y * hh, at.z - Fr.N.z * hh) : new THREE.Vector3(at.x, GC.y, at.z);
    const drop = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(at.x, at.y, at.z), foot]);
    S.add(new THREE.Line(drop, this.mat(new THREE.LineDashedMaterial({ color: 0xffd34a, dashSize: 200, gapSize: 140, transparent: true, opacity: 0.7, depthTest: false }))).computeLineDistances());
    // les noms (des étiquettes HTML, placées à chaque image)
    this.tags = [];
    const tag = (name, p, cls, info, always = false) => {
      const e = document.createElement('div'); e.className = 'gm-tag ' + cls; e.textContent = name;
      this.labels.append(e);
      this.tags.push({ e, p: new THREE.Vector3(p.x, p.y, p.z), info, always, name });
    };
    tag('Tu es ici', at, 'me', () => this.placeText(at), true);
    if (and) tag('M31* (le centre)', AND_CENTER, 'center', () => "M31*, le trou noir géant du cœur d'Andromède : 140 millions de soleils.", true);
    else tag('Sagittarius A* (le centre)', CENTER, 'center', () => 'Sagittarius A*, le trou noir du centre de la Voie lactée : 4 millions de soleils.', true);
    // (l'autre galaxie, au loin)
    if (and) tag('Voie lactée', CENTER, 'center', () => `La Voie lactée, la galaxie de la Terre : à ${ly(dist(at, CENTER))} d'ici.`, true);
    else tag("Galaxie d'Andromède (Hexa)", AND_CENTER, 'center', () => `La galaxie d'Andromède, celle d'Hexa : à ${ly(dist(at, AND_CENTER))} d'ici.`, true);
    for (const v of V) tag(v.n, v.p, v.id === 'star' ? 'home' : 'seen', () => `${v.n} : visité le jour ${v.d + 1}, à ${ly(dist(at, v.p))} d'ici.`, v.id === 'star');
    for (let i = 0; i < n; i++) if (GFAMOUS[i] && !V.some((v) => v.gal === i)) { const p = { x: GX[i], y: GY_[i], z: GZ[i] }; tag(GNAME[i], p, 'famous', () => `${GNAME[i]} (étoile célèbre) : à ${ly(dist(at, p))} d'ici. Pas encore visitée.`); }
    // (l'ordre d'importance : quand deux noms se chevauchent, le premier reste)
    const rank = { me: 0, center: 1, home: 2, seen: 3, famous: 4 };
    for (const t of this.tags) { t.rank = rank[t.e.classList[1]] ?? 5; t.w = t.name.length * 6.6 + 10; }
    this.tags.sort((a, b) => a.rank - b.rank);
  }
  // Où l'on est, en clair
  placeText(at) {
    const dh = Math.hypot(at.x, at.y, at.z);
    if (this.and) {
      const A = andromedaPlace(at);
      if (A.R > 130000) return `Hors de la galaxie d'Andromède : à ${ly(A.R)} de son centre, ${ly(dh)} d'Hexa.`;
      const zone = A.R < 5000 ? "dans le bulbe, le cœur d'Andromède" : A.ring ? "dans l'anneau de feu, là où naissent les étoiles bleues" : A.armDist < 1500 ? "dans un bras d'Andromède" : A.R > 90000 ? 'au bord du disque' : "dans le disque d'Andromède, entre ses deux bras";
      const up = Math.abs(A.h) < 150 ? 'dans son plan' : ly(Math.abs(A.h)) + (A.h > 0 ? ' au-dessus' : ' au-dessous') + ' de son plan';
      return `Tu es ${zone}, à ${ly(A.R)} de M31*, ${up}. ` + (dh < 1 ? 'Hexa est tout près.' : `Hexa est à ${ly(dh)}.`);
    }
    const G = galaxyPlace(at);
    if (G.R > 70000) return `Hors de la Voie lactée : à ${ly(G.R)} de son centre, ${ly(dh)} d'Hexa.`;
    const zone = G.R < 3000 ? 'dans le bulbe, le cœur de la galaxie' : G.armName && G.armDist < 1200 ? 'dans le ' + G.armName : G.armName ? 'entre deux bras (le plus proche : le ' + G.armName + ', à ' + ly(G.armDist) + ')' : G.R > 50000 ? 'au bord du disque' : 'dans le disque';
    const up = Math.abs(G.h) < 150 ? 'dans le plan de la galaxie' : ly(Math.abs(G.h)) + (G.h > 0 ? ' au-dessus' : ' au-dessous') + ' du plan';
    return `Tu es ${zone}, à ${ly(G.R)} du centre, ${up}. Hexa est à ${ly(dh)}.`;
  }
  text() {
    const d = this.d, s = this.sel;
    this.info.textContent = (s ? s.info() : this.placeText(d.at) + (d.here ? ' Système le plus proche : ' + d.here + '.' : '')) + ` · Systèmes visités : ${d.visited.length}`;
  }
  input() {
    const el = this.r.domElement, ptr = new Map();
    let drag = null, moved = 0, pinch = 0;
    const down = (e) => {
      el.setPointerCapture(e.pointerId);
      ptr.set(e.pointerId, { x: e.clientX, y: e.clientY });
      drag = { x: e.clientX, y: e.clientY, pan: e.button === 2 || e.shiftKey };
      moved = 0;
      if (ptr.size === 2) { const [a, b] = [...ptr.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); }
    };
    const move = (e) => {
      if (!ptr.has(e.pointerId)) return;
      ptr.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (ptr.size === 2) {
        const [a, b] = [...ptr.values()], p = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch) this.zoom(pinch / p);
        pinch = p; moved = 99; return;
      }
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      drag.x = e.clientX; drag.y = e.clientY; moved += Math.abs(dx) + Math.abs(dy);
      if (drag.pan) {
        // (on déplace le point visé dans le plan de l'écran)
        const k = (this.dist * 2 * Math.tan((this.cam.fov * Math.PI) / 360)) / (el.clientHeight || 500);
        const r = new THREE.Vector3().setFromMatrixColumn(this.cam.matrixWorld, 0), u = new THREE.Vector3().setFromMatrixColumn(this.cam.matrixWorld, 1);
        this.goal.f.addScaledVector(r, -dx * k).addScaledVector(u, dy * k);
        this.focus.copy(this.goal.f);
      } else {
        this.yaw -= dx * 0.006;
        this.pitch = Math.max(-1.55, Math.min(1.55, this.pitch + dy * 0.006));
      }
      this.dirty = true;
    };
    const up = (e) => {
      ptr.delete(e.pointerId);
      if (ptr.size < 2) pinch = 0;
      if (moved < 5 && drag) this.pick(e.clientX, e.clientY, false);
      drag = null;
    };
    const wheel = (e) => { e.preventDefault(); this.zoom(Math.exp(e.deltaY * 0.0012)); };
    const dbl = (e) => this.pick(e.clientX, e.clientY, true);
    const ctx = (e) => e.preventDefault();
    el.addEventListener('pointerdown', down); el.addEventListener('pointermove', move); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', wheel, { passive: false }); el.addEventListener('dblclick', dbl); el.addEventListener('contextmenu', ctx);
    this.off = () => { el.removeEventListener('wheel', wheel); };
  }
  zoom(f) { this.dist = this.goal.dist = Math.max(3, Math.min(400000, this.dist * f)); this.dirty = true; }
  // Aller voir : le point visé glisse vers p, à la distance dist
  go(p, dist = this.dist) { this.goal.f.set(p.x, p.y, p.z); this.goal.dist = dist; this.anim = true; this.dirty = true; }
  me_() { this.sel = null; this.text(); this.go(this.d.at, 2500); }
  all() { this.sel = null; this.text(); this.go(this.gc || CENTER, this.and ? 150000 : 85000); }
  hexa() { const t = this.tags.find((x) => x.e.classList.contains('home')); this.sel = t || null; this.text(); this.go({ x: 0, y: 0, z: 0 }, 1500); }
  pick(x, y, go) {
    const R = this.r.domElement.getBoundingClientRect();
    let best = null, bd = 18;
    for (const t of this.tags) {
      if (!t.on) continue;
      const d = Math.hypot(t.sx - (x - R.left), t.sy - (y - R.top));
      if (d < bd) { bd = d; best = t; }
    }
    this.sel = best;
    this.text();
    if (best && go) this.go(best.p, Math.min(this.dist, 800));
    this.dirty = true;
  }
  frame(t) {
    // (le glissement vers ce qu'on veut voir)
    if (this.anim) {
      this.focus.lerp(this.goal.f, 0.12);
      this.dist += (this.goal.dist - this.dist) * 0.12;
      if (this.focus.distanceTo(this.goal.f) < this.dist * 1e-3 && Math.abs(this.goal.dist - this.dist) < this.dist * 1e-3) this.anim = false;
      this.dirty = true;
    }
    // (le « tu es ici » pulse : 20 images par seconde suffisent quand rien d'autre ne bouge)
    if (!this.dirty && t - this.lastPulse < 50) return;
    this.lastPulse = t; this.dirty = false;
    const s = 0.045 + 0.012 * Math.sin((t - this.t0) / 260);
    this.me.scale.set(s, s, 1);
    const cp = Math.cos(this.pitch);
    this.cam.position.set(this.focus.x + Math.sin(this.yaw) * cp * this.dist, this.focus.y + Math.sin(this.pitch) * this.dist, this.focus.z + Math.cos(this.yaw) * cp * this.dist);
    this.cam.near = Math.max(0.05, this.dist * 0.001); this.cam.far = this.dist * 20 + 200000; this.cam.updateProjectionMatrix();
    this.cam.lookAt(this.focus);
    this.cam.updateMatrixWorld();
    this.r.render(this.scene, this.cam);
    // les noms : les toujours visibles, puis ceux assez proches pour qu'on s'y retrouve
    const W = this.r.domElement.clientWidth, H = this.r.domElement.clientHeight, v = new THREE.Vector3();
    const famousOn = this.dist < 4000, seenOn = this.dist < 30000, put = [];
    const free = (x, y, w) => put.every((b) => x + w < b.x || b.x + b.w < x || Math.abs(y - b.y) > 15);
    for (const tg of [...(this.sel ? [this.sel] : []), ...this.tags.filter((t) => t !== this.sel)]) {
      v.copy(tg.p).project(this.cam);
      const cls = tg.e.classList, want = tg.always || tg === this.sel || (cls.contains('seen') ? seenOn : famousOn);
      tg.sx = (v.x * 0.5 + 0.5) * W; tg.sy = (-v.y * 0.5 + 0.5) * H;
      const on = want && v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1 && free(tg.sx, tg.sy, tg.w);
      tg.on = want && v.z < 1; // (cliquable même si son nom est caché par un autre)
      if (!on) { if (tg.e.style.display !== 'none') tg.e.style.display = 'none'; continue; }
      put.push({ x: tg.sx, y: tg.sy, w: tg.w });
      tg.e.style.display = '';
      tg.e.style.transform = `translate(${tg.sx.toFixed(1)}px, ${tg.sy.toFixed(1)}px)`;
      cls.toggle('sel', tg === this.sel);
    }
  }
}
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
