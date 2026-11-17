// La surcharge du saut, en vrai, dans l'espace du jeu (voir spaceflight.js) :
//  - des fissures lumineuses s'ouvrent dans l'espace autour de la fusée, de plus en plus ;
//  - à la déchirure, une immense fissure s'ouvre devant la fusée et l'avale ;
//  - la 7ème dimension : un monde autour de la fusée où rien n'a de sens (formes impossibles, yeux,
//    escaliers sans fin, « 7 » géants, phrases qui flottent, pluie qui tombe vers le haut) ;
//  - en ressortant, une fissure se referme derrière la fusée ;
//  - les fissures laissées dans l'espace (17 minutes) : de près, un objet dans l'espace ; de loin,
//    un trait dans le ciel (voir skyview.js).
// Tout est dans la scène du jeu, autour de la fusée (aucun dessin par-dessus l'écran).
import * as THREE from 'three';

export const RIFT_LIFE = 17 * 60; // (secondes : une fissure se referme complètement en 17 minutes)
export const RIFT_LEN = 160;      // (hauteur d'une fissure qui vient de s'ouvrir, en blocs)
export const RIFT_NEAR = 420;     // (plus près que ça : la fissure est un objet de la scène ; plus loin : dans le ciel)

const NONSENSE = [
  'Ici, le chiffre 7 est une couleur.', 'Ta fusée se souvient de demain.', 'Les hexagones ont 7 côtés, comme d\'habitude.',
  'Le temps coule vers le haut.', 'Il pleut des distances.', 'Tu entends le violet ?', 'Cette phrase est finie depuis mardi.',
  'Gravité : oui.', 'Le nédrolytium te regarde.', 'Sortie : partout, sauf ici.', 'Une heure dure 7 secondes.',
  'Ne pense pas à un cube.', 'Bienvenue ! Tu n\'es jamais arrivé.', 'Ton ombre est partie devant.', 'Le silence fait 7 décibels.',
  'Haut et bas se sont excusés.', 'Ce panneau n\'existe pas.', 'La lumière marche à reculons.', 'Tu as toujours été une tuyère.',
];

const glow = (color, opacity) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false, side: THREE.DoubleSide });
const rnd = (a, b) => a + Math.random() * (b - a);
const randDir = (v = new THREE.Vector3()) => { const u = rnd(-1, 1), a = rnd(0, Math.PI * 2), k = Math.sqrt(1 - u * u); return v.set(k * Math.cos(a), u, k * Math.sin(a)); };

// Un tube qui suit une ligne brisée (des angles vifs, comme une fêlure)
function brokenTube(pts, radius) {
  const path = new THREE.CurvePath();
  for (let i = 1; i < pts.length; i++) path.add(new THREE.LineCurve3(pts[i - 1], pts[i]));
  return new THREE.TubeGeometry(path, (pts.length - 1) * 2, radius, 5, false);
}

// ---------- Une fissure qui s'ouvre dans l'espace (autour de la fusée) ----------
function makeCrack(R) {
  const g = new THREE.Group();
  const start = randDir().multiplyScalar(R), pts = [start.clone()];
  // (elle avance à peu près à la surface d'une sphère autour de la fusée, en zigzag)
  const dir = randDir().cross(start).normalize(), seg = rnd(3, 7), n = 10 + Math.floor(rnd(0, 12));
  const p = start.clone(), d = dir.clone();
  for (let i = 0; i < n; i++) {
    d.add(randDir(new THREE.Vector3()).multiplyScalar(0.9)).normalize();
    p.addScaledVector(d, seg);
    p.setLength(R + rnd(-6, 6));
    pts.push(p.clone());
  }
  const w = rnd(0.12, 0.35);
  const core = new THREE.Mesh(brokenTube(pts, w), glow(0xffffff, 1));
  const halo = new THREE.Mesh(brokenTube(pts, w * 4), glow(0x9a50ff, 0.35));
  g.add(halo, core);
  // des branches
  for (let b = 0; b < 3; b++) {
    const i = 2 + Math.floor(rnd(0, n - 3)), q = pts[i].clone(), bd = randDir().cross(q).normalize(), bp = [q.clone()];
    for (let k = 0; k < 4; k++) { bd.add(randDir(new THREE.Vector3()).multiplyScalar(1.1)).normalize(); q.addScaledVector(bd, seg * 0.7); bp.push(q.clone()); }
    g.add(new THREE.Mesh(brokenTube(bp, w * 0.6), glow(0xe6d6ff, 0.9)));
  }
  return { g, grow: 0, speed: rnd(0.25, 0.7), life: 1 };
}
function growCrack(k) {
  // (on ne dessine que le début des tubes : la fêlure avance)
  k.g.traverse((m) => {
    if (!m.geometry?.index) return;
    const total = m.geometry.index.count, per = 5 * 6;
    m.geometry.setDrawRange(0, Math.max(per, Math.floor((total / per) * k.grow) * per));
  });
}

// ---------- La grande fissure : un trou lumineux aux bords déchiquetés ----------
function tearShape(h, w) {
  const s = new THREE.Shape(), n = 22, L = [], Rr = [];
  for (let i = 0; i <= n; i++) {
    const y = -h / 2 + (h * i) / n, f = Math.sin((Math.PI * i) / n); // (pointue aux deux bouts)
    L.push([-w * f * rnd(0.55, 1.1), y]); Rr.push([w * f * rnd(0.55, 1.1), y]);
  }
  s.moveTo(L[0][0], L[0][1]);
  for (const [x, y] of L) s.lineTo(x, y);
  for (let i = Rr.length - 1; i >= 0; i--) s.lineTo(Rr[i][0], Rr[i][1]);
  return new THREE.ShapeGeometry(s);
}
function makeTear(h, w) {
  const g = new THREE.Group();
  const halo = new THREE.Mesh(tearShape(h * 1.15, w * 2.6), glow(0x7a30ff, 0.45));
  const mid = new THREE.Mesh(tearShape(h, w * 1.6), glow(0xc8a0ff, 0.7));
  const core = new THREE.Mesh(tearShape(h * 0.9, w), glow(0xffffff, 1));
  halo.position.z = -0.3; core.position.z = 0.3;
  g.add(halo, mid, core);
  return g;
}

// ---------- Le chiffre 7, en volume ----------
function sevenGeo(s) {
  const sh = new THREE.Shape();
  sh.moveTo(-0.5 * s, 0.6 * s); sh.lineTo(0.55 * s, 0.6 * s); sh.lineTo(0.55 * s, 0.42 * s);
  sh.lineTo(-0.05 * s, -0.6 * s); sh.lineTo(-0.3 * s, -0.6 * s); sh.lineTo(0.27 * s, 0.4 * s); sh.lineTo(-0.5 * s, 0.4 * s);
  return new THREE.ExtrudeGeometry(sh, { depth: 0.25 * s, bevelEnabled: false });
}
// (un texte qui flotte dans l'espace)
function textSprite(text) {
  const c = document.createElement('canvas'), x = c.getContext('2d');
  x.font = 'bold 44px sans-serif';
  const w = Math.ceil(x.measureText(text).width) + 40;
  c.width = w; c.height = 72;
  x.font = 'bold 44px sans-serif';
  x.textBaseline = 'middle';
  x.shadowColor = '#ff00d4'; x.shadowBlur = 14;
  x.fillStyle = '#ffffff';
  x.fillText(text, 20, 38);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, fog: false }));
  sp.scale.set((w / 72) * 3.2, 3.2, 1);
  return sp;
}

// ---------- La 7ème dimension ----------
const SKY_VS = `varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const SKY_FS = `uniform float uT; uniform float uWhite; varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  float a = atan(d.z, d.x), b = asin(clamp(d.y, -1.0, 1.0));
  float w = sin(a * 7.0 + uT * 0.7 + sin(b * 5.0 - uT) * 2.0) + sin(b * 9.0 - uT * 1.3 + cos(a * 3.0 + uT * 0.4) * 3.0);
  float h = fract(w * 0.18 + uT * 0.05 + b * 0.3);
  vec3 col = 0.5 + 0.5 * cos(6.2831 * (h + vec3(0.0, 0.33, 0.67)));
  // (des anneaux qui respirent, et des taches sombres qui glissent)
  float r = 0.5 + 0.5 * sin(length(d.xz) * 30.0 - uT * 3.0);
  col *= 0.55 + 0.45 * r;
  col = mix(col, vec3(1.0), uWhite);
  gl_FragColor = vec4(col, 1.0);
}`;

function buildDim(camPos) {
  const root = new THREE.Group();
  const things = [];
  // le ciel de la 7ème dimension (une sphère autour de la caméra, plus près que la limite de vue)
  const skyMat = new THREE.ShaderMaterial({ vertexShader: SKY_VS, fragmentShader: SKY_FS, uniforms: { uT: { value: 0 }, uWhite: { value: 1 } }, side: THREE.BackSide, depthWrite: false, fog: false });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(380, 48, 24), skyMat);
  sky.renderOrder = -10;
  sky.frustumCulled = false;
  root.add(sky);
  const normal = new THREE.MeshNormalMaterial({ flatShading: true });
  const place = (obj, rMin, rMax) => { obj.position.copy(randDir()).multiplyScalar(rnd(rMin, rMax)); root.add(obj); return obj; };
  const spin = () => new THREE.Vector3(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1));
  // prismes hexagonaux géants (qui changent de taille sans raison)
  for (let i = 0; i < 26; i++) {
    const m = place(new THREE.Mesh(new THREE.CylinderGeometry(rnd(3, 14), rnd(3, 14), rnd(6, 40), 6), Math.random() < 0.3 ? new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, fog: false }) : normal), 30, 220);
    things.push({ o: m, spin: spin(), pulse: rnd(0.3, 2), orbit: rnd(-0.08, 0.08), axis: randDir().clone(), hue: m.material.wireframe ? rnd(0, 1) : null });
  }
  // des « 7 » géants
  for (let i = 0; i < 7; i++) {
    const m = place(new THREE.Mesh(sevenGeo(rnd(12, 40)), normal), 45, 230);
    things.push({ o: m, spin: spin().multiplyScalar(0.6), pulse: 0, orbit: rnd(-0.05, 0.05), axis: randDir().clone() });
  }
  // nœuds impossibles
  for (let i = 0; i < 5; i++) {
    const m = place(new THREE.Mesh(new THREE.TorusKnotGeometry(rnd(6, 18), rnd(1.5, 4), 96, 8, 2 + Math.floor(rnd(0, 4)), 3 + Math.floor(rnd(0, 4))), normal), 70, 280);
    things.push({ o: m, spin: spin().multiplyScalar(0.8), pulse: rnd(0.5, 1.5), orbit: rnd(-0.06, 0.06), axis: randDir().clone() });
  }
  // un escalier qui tourne en rond (et monte toujours)
  for (let s = 0; s < 2; s++) {
    const st = new THREE.Group(), n = 24, R = rnd(16, 28);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, step = new THREE.Mesh(new THREE.BoxGeometry(6, 1.5, 4), normal);
      step.position.set(Math.cos(a) * R, Math.sin(a * 2) * 3 + i * 0.6 - n * 0.3, Math.sin(a) * R);
      step.rotation.y = -a;
      st.add(step);
    }
    place(st, 90, 240);
    things.push({ o: st, spin: new THREE.Vector3(0, rnd(0.2, 0.5), 0), pulse: 0, orbit: 0.02, axis: randDir().clone() });
  }
  // des yeux qui regardent la fusée
  for (let i = 0; i < 6; i++) {
    const eye = new THREE.Group(), r = rnd(4, 12);
    eye.add(new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false })));
    const iris = new THREE.Mesh(new THREE.CircleGeometry(r * 0.55, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL(Math.random(), 1, 0.5), fog: false }));
    iris.position.z = r * 1.001;
    const pupil = new THREE.Mesh(new THREE.CircleGeometry(r * 0.25, 20), new THREE.MeshBasicMaterial({ color: 0x000000, fog: false }));
    pupil.position.z = r * 1.003;
    eye.add(iris, pupil);
    place(eye, 50, 220);
    things.push({ o: eye, eye: true, orbit: rnd(-0.1, 0.1), axis: randDir().clone(), blink: rnd(2, 6) });
  }
  // des phrases qui flottent
  for (let i = 0; i < 12; i++) {
    const sp = place(textSprite(NONSENSE[Math.floor(Math.random() * NONSENSE.length)]), 25, 160);
    things.push({ o: sp, drift: randDir().clone().multiplyScalar(rnd(2, 8)), text: true });
  }
  // une pluie qui tombe vers le haut
  const N = 900, pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const v = randDir().multiplyScalar(rnd(10, 300));
    pos.set([v.x, v.y, v.z], i * 3);
    const c = new THREE.Color().setHSL(Math.random(), 1, 0.65);
    col.set([c.r, c.g, c.b], i * 3);
  }
  const rg = new THREE.BufferGeometry();
  rg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  rg.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const rain = new THREE.Points(rg, new THREE.PointsMaterial({ size: 1.4, vertexColors: true, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
  rain.frustumCulled = false;
  root.add(rain);
  root.position.copy(camPos);
  return { root, sky, skyMat, things, rain };
}

export class Dim7 {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();     // (autour de la fusée : les fissures, la grande fissure)
    scene.add(this.group);
    this.cracks = [];
    this.spawn = 0;
    this.ot = 0;
    this.phase = null;                  // null | 'fall' (la fusée tombe dans la fissure) | 'in' (7ème dimension) | 'out' (elle en ressort)
    this.pt = 0;
    this.tear = null;
    this.dim = null;
    this.t = 0;
    this.near = new Map();              // (fissures de l'espace, de près : id -> objet)
  }
  // c : { over, cracking (les 5 minutes de la surcharge sont passées), rift ({ dir, u } : la fissure qui
  // arrive droit devant, u de 0 à 1), dim, center (Vector3 : la fusée), nose (Vector3 : devant elle), camera }
  update(dt, c) {
    this.t += dt;
    const G = this.group;
    G.position.copy(c.center);
    // les fissures autour de la fusée, pendant la surcharge
    if (c.over && c.cracking && !this.phase) {
      this.ot += dt;
      this.spawn -= dt;
      if (this.spawn <= 0 && this.cracks.length < 40) {
        const k = makeCrack(rnd(14, 60));
        G.add(k.g);
        this.cracks.push(k);
        this.spawn = Math.max(0.15, 1.2 - this.ot * 0.06) * rnd(0.6, 1.4);
      }
    } else this.ot = 0;
    for (let i = this.cracks.length - 1; i >= 0; i--) {
      const k = this.cracks[i];
      k.grow = Math.min(1, k.grow + k.speed * dt * (1 + this.ot * 0.05));
      growCrack(k);
      if (!c.over || this.phase) k.life -= dt * 0.7;
      const f = Math.max(0, k.life) * (0.75 + Math.random() * 0.25);
      k.g.children.forEach((m, j) => { m.material.opacity = (j === 0 ? 0.35 : j === 1 ? 1 : 0.9) * f; });
      if (k.life <= 0) { this.dispose(k.g); this.cracks.splice(i, 1); }
    }
    // la fissure qui s'ouvre droit devant : elle grandit et approche (il faut l'esquiver)
    if (c.rift && !this.phase) {
      if (!this.incoming) { this.incoming = makeTear(60, 5); G.add(this.incoming); }
      const u = c.rift.u, I = this.incoming;
      I.position.copy(c.rift.dir).multiplyScalar(14 + 220 * (1 - u) ** 1.5);
      I.lookAt(c.center);
      I.rotation.z += 0.3 * u;
      I.scale.set(0.4 + u * 1.6, 0.5 + u * 1.2, 1);
      const f = 0.55 + 0.45 * Math.abs(Math.sin(this.t * (6 + u * 18)));
      I.children.forEach((m, j) => { m.material.opacity = (j === 0 ? 0.45 : j === 1 ? 0.7 : 1) * f; });
    } else if (this.incoming) { this.dispose(this.incoming); this.incoming = null; }
    // entrer dans la 7ème dimension : la grande fissure s'ouvre devant et avale la fusée
    if (c.dim && !this.phase) {
      this.phase = 'fall'; this.pt = 0;
      this.tear = makeTear(70, 6);
      this.tearDir = c.nose.clone().normalize();
      this.tear.lookAt(this.tearDir); // (face à la fusée)
      G.add(this.tear);
    }
    if (!c.dim && (this.phase === 'in' || this.phase === 'fall')) this.leave(c);
    if (this.phase === 'fall') {
      this.pt += dt;
      const u = Math.min(1, this.pt / 2.4);
      // (elle s'ouvre, grandit, et vient sur la fusée)
      this.tear.position.copy(this.tearDir).multiplyScalar(80 * (1 - u * u));
      this.tear.scale.set(0.2 + u * u * 9, 0.6 + u * 3, 1);
      this.tear.rotation.z += dt * 0.4;
      if (u >= 1) {
        this.dispose(this.tear); this.tear = null;
        this.dim = buildDim(c.camera.position);
        this.scene.add(this.dim.root);
        this.phase = 'in'; this.pt = 0;
      }
    }
    if (this.phase === 'in') this.stepDim(dt, c);
    // en ressortir : la fissure se referme derrière la fusée
    if (this.phase === 'out') {
      this.pt += dt;
      const u = Math.min(1, this.pt / 2.2);
      this.tear.scale.set(9 * (1 - u) ** 2 + 0.05, 3.6 * (1 - u) + 0.2, 1);
      this.tear.position.copy(this.tearDir).multiplyScalar(-6 - u * 40);
      this.tear.children.forEach((m) => { m.material.opacity *= 0.985; });
      if (u >= 1) { this.dispose(this.tear); this.tear = null; this.phase = null; }
    }
  }
  stepDim(dt, c) {
    const D = this.dim, t = this.t;
    this.pt += dt;
    D.root.position.copy(c.camera.position);
    D.skyMat.uniforms.uT.value = t;
    D.skyMat.uniforms.uWhite.value = Math.max(0, 1 - this.pt / 1.5); // (on arrive dans un éclair blanc)
    const cam = c.camera.position;
    for (const T of D.things) {
      const o = T.o;
      if (T.text) { o.position.addScaledVector(T.drift, dt); if (o.position.length() > 170) T.drift.negate(); continue; }
      if (T.orbit) o.position.applyAxisAngle(T.axis, T.orbit * dt);
      if (T.spin) { o.rotation.x += T.spin.x * dt; o.rotation.y += T.spin.y * dt; o.rotation.z += T.spin.z * dt; }
      if (T.pulse) { const s = 1 + 0.45 * Math.sin(t * T.pulse + o.id); o.scale.set(s, 1 / s, s * 0.8 + 0.2); }
      if (T.hue !== null && T.hue !== undefined) o.material.color.setHSL((T.hue + t * 0.2) % 1, 1, 0.6);
      if (T.eye) {
        // (il regarde la caméra, et cligne parfois)
        o.lookAt(cam);
        const b = (t % T.blink) < 0.15 ? 0.1 : 1;
        o.scale.set(1, b, 1);
      }
    }
    // la pluie monte
    const p = D.rain.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) { let y = p.getY(i) + dt * (6 + (i % 7) * 3); if (y > 300) y = -300; p.setY(i, y); }
    p.needsUpdate = true;
  }
  leave(c) {
    if (this.tear) { this.dispose(this.tear); this.tear = null; }
    if (this.dim) { this.dispose(this.dim.root); this.dim = null; }
    // (une fissure se referme derrière la fusée)
    this.tearDir = c.nose.clone().normalize();
    this.tear = makeTear(70, 6);
    this.tear.lookAt(this.tearDir);
    this.tear.scale.set(9, 3.6, 1);
    this.group.add(this.tear);
    this.phase = 'out'; this.pt = 0;
  }
  // Les fissures de l'espace, de près : list = [{ id, pos (Vector3, scène), q (Quaternion), k (0 à 1) }]
  placeRifts(list) {
    const seen = new Set();
    for (const r of list) {
      seen.add(r.id);
      let m = this.near.get(r.id);
      if (!m) {
        m = new THREE.Group();
        const tex = riftTexture();
        for (let i = 0; i < 2; i++) {
          // (deux plans croisés : on la voit de partout)
          const pl = new THREE.Mesh(new THREE.PlaneGeometry(RIFT_LEN * 0.25, RIFT_LEN), new THREE.MeshBasicMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false, side: THREE.DoubleSide }));
          pl.rotation.y = i * Math.PI / 2;
          m.add(pl);
        }
        // et son cœur : une déchirure lumineuse
        const tear = makeTear(RIFT_LEN * 0.8, RIFT_LEN * 0.04);
        m.add(tear);
        this.scene.add(m);
        this.near.set(r.id, m);
      }
      m.position.copy(r.pos);
      m.quaternion.copy(r.q);
      m.scale.set(0.3 + 0.7 * r.k, r.k, 0.3 + 0.7 * r.k);
      const f = r.k * (0.8 + Math.random() * 0.2);
      m.traverse((o) => { if (o.material) o.material.opacity = Math.min(1, f * (o.userData.base ??= o.material.opacity)); });
    }
    for (const [id, m] of this.near) if (!seen.has(id)) { this.dispose(m); this.near.delete(id); }
  }
  dispose(o) {
    o.parent?.remove(o);
    o.traverse((m) => { m.geometry?.dispose(); if (m.material && m.material.map !== riftTex) m.material.map?.dispose?.(); m.material?.dispose?.(); });
  }
  // (la partie s'arrête : on enlève tout)
  clear() {
    for (const k of this.cracks) this.dispose(k.g);
    this.cracks.length = 0;
    if (this.tear) this.dispose(this.tear);
    if (this.incoming) { this.dispose(this.incoming); this.incoming = null; }
    if (this.dim) this.dispose(this.dim.root);
    for (const m of this.near.values()) this.dispose(m);
    this.near.clear();
    this.tear = this.dim = this.phase = null;
  }
}

// La texture d'une fissure : une déchirure verticale, lumineuse, aux bords brisés
let riftTex = null;
export function riftTexture() {
  if (riftTex) return riftTex;
  const W = 128, H = 512, cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  let x = W / 2;
  const pts = [];
  for (let y = 8; y <= H - 8; y += 16) { x = Math.max(W * 0.3, Math.min(W * 0.7, x + (Math.random() - 0.5) * 26)); pts.push([x, y]); }
  c.globalCompositeOperation = 'lighter';
  c.lineCap = c.lineJoin = 'round';
  for (const [w, col] of [[44, 'rgba(110,40,255,0.18)'], [22, 'rgba(170,100,255,0.45)'], [9, 'rgba(225,200,255,0.85)'], [3, 'rgba(255,255,255,1)']]) {
    c.lineWidth = w; c.strokeStyle = col;
    c.beginPath();
    pts.forEach(([px, py], i) => (i ? c.lineTo(px, py) : c.moveTo(px, py)));
    c.stroke();
  }
  c.lineWidth = 2; c.strokeStyle = 'rgba(220,190,255,0.8)';
  for (let i = 2; i < pts.length - 2; i += 3) {
    let [bx, by] = pts[i], a = (Math.random() < 0.5 ? 0 : Math.PI) + (Math.random() - 0.5);
    c.beginPath(); c.moveTo(bx, by);
    for (let k = 0; k < 3; k++) { a += (Math.random() - 0.5); bx += Math.cos(a) * 10; by += Math.sin(a) * 10; c.lineTo(bx, by); }
    c.stroke();
  }
  c.globalCompositeOperation = 'destination-in';
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.12, 'rgba(0,0,0,1)'); g.addColorStop(0.88, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  riftTex = new THREE.CanvasTexture(cv);
  riftTex.colorSpace = THREE.SRGBColorSpace;
  return riftTex;
}
