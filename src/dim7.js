// La surcharge du saut, en vrai, dans l'espace du jeu (voir spaceflight.js) :
//  - des fissures lumineuses s'ouvrent dans l'espace autour de la fusée, de plus en plus ;
//  - à la déchirure, une immense fissure s'ouvre devant la fusée et l'avale ;
//  - la 7ème dimension : un monde autour de la fusée où rien n'a de sens (formes impossibles, yeux,
//    escaliers sans fin, « 7 » géants, phrases qui flottent, pluie qui tombe vers le haut) ;
//  - en ressortant, une fissure se referme derrière la fusée ;
//  - les fissures laissées dans l'espace (17 minutes) : de près, un objet dans l'espace ; de loin,
//    un trait dans le ciel (voir skyview.js).
//  - un tunnel de la 7ème dimension (le moteur de 7ème dimension, voir tunnels.js) : un long couloir de
//    lumière violette et bleue qui file autour de la fusée, d'autant plus vite qu'elle va vite.
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

// ---------- Un tunnel de la 7ème dimension ----------
// Un couloir à six pans (TUN_R de rayon, TUN_LEN de long devant la fusée) qui serpente : loin devant, il
// tourne ; il se redresse en arrivant sur la fusée (bend : le même calcul ici et dans le shader). Ses
// parois : un treillis d'hexagones de lumière, de l'énergie qui coule, des cellules qui s'allument, une
// lueur blanche au fond. Derrière les parois, à travers leurs trous : le fond de la 7ème dimension. Des
// anneaux hexagonaux, des traînées et les bouches des autres tunnels de la Seed défilent.
const TUN_R = 45, TUN_LEN = 2400, TUN_BACK = 120, RIB_GAP = 70, RIB_N = 36, PORT_GAP = 520, PORT_N = 5, STREAK_N = 320;
// (les virages : quatre ondes ; ph : où en est chacune, calculé en double précision puis ramené à un
// tour, pour que rien ne se dégrade même après des heures de tunnel)
const BEND_F = [0.0023, 0.00071, 0.0019, 0.0009];
const bendPhases = (P, out) => { for (let k = 0; k < 4; k++) out[k] = (P * BEND_F[k]) % (Math.PI * 2); return out; };
function bend(z, ph, out) {
  const w = Math.min(1, Math.max(0, z / 1100)) ** 2;
  out.x = w * (Math.sin(z * 0.0023 + ph[0]) * 140 + Math.sin(z * 0.00071 + 1.3 + ph[1]) * 220);
  out.y = w * (Math.cos(z * 0.0019 + ph[2]) * 110 + Math.sin(z * 0.0009 + 0.4 + ph[3]) * 160);
  return out;
}
// (le défilement des motifs des parois : ramené à TUN_WRAP, un multiple de toutes leurs périodes)
const TUN_WRAP = 9000;
const TUN_NOISE = `
float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y); }
float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * vn(p); p *= 2.03; a *= 0.5; } return s; }`;
const TUN_VS = `uniform vec4 uPh; varying float vZ; varying float vA;
vec2 bend(float z) { float w = clamp(z / 1100.0, 0.0, 1.0); w *= w;
  return w * vec2(sin(z * 0.0023 + uPh.x) * 140.0 + sin(z * 0.00071 + 1.3 + uPh.y) * 220.0, cos(z * 0.0019 + uPh.z) * 110.0 + sin(z * 0.0009 + 0.4 + uPh.w) * 160.0); }
void main() { vec3 p = position; vZ = p.z; vA = atan(p.y, p.x); p.xy += bend(p.z); gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`;
const TUN_FS = `uniform float uT; uniform float uP; uniform float uWhite; uniform float uEnd; uniform float uV; uniform vec2 uN; varying float vZ; varying float vA;
${TUN_NOISE}
// (un bruit qui boucle tous les 1000 : son défilement uN est ramené à 1000 sans raccord)
float vnw(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  vec2 i0 = mod(i, 1000.0), i1 = mod(i + 1.0, 1000.0);
  return mix(mix(h21(i0), h21(vec2(i1.x, i0.y)), f.x), mix(h21(vec2(i0.x, i1.y)), h21(i1), f.x), f.y); }
float fbmw(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * vnw(p); p *= 2.0; a *= 0.5; } return s; }
float hexDist(vec2 p) { p = abs(p); return max(dot(p, normalize(vec2(1.0, 1.732))), p.x); }
void main() {
  float s = vZ + uP, a = vA / 6.2831853 + 0.5;
  // (le treillis d'hexagones : 24 autour, une rangée tous les 22,5 blocs le long ; s est ramené à TUN_WRAP)
  vec2 uv = vec2(a * 24.0, s * 1.7320508 / 22.5), r = vec2(1.0, 1.7320508), hh = r * 0.5;
  vec2 A = mod(uv, r) - hh, B = mod(uv - hh, r) - hh, g = dot(A, A) < dot(B, B) ? A : B;
  vec2 id = floor((uv - g) * vec2(2.0, 1.1547) + 0.5); // (le numéro de la case, entier : le même pour tous ses pixels)
  float edge = smoothstep(0.09, 0.0, 0.5 - hexDist(g));
  float flow = fbmw(vec2(a * 3.0 + fbmw(vec2(a * 6.0, vZ * 0.02 + uN.y - uT * 0.4)) * 2.0, vZ * 0.008 + uN.x + uT * 0.15));
  float pulse = pow(0.5 + 0.5 * sin(s * 6.2831853 / 45.0 - uT * 3.0 + h21(id) * 6.28), 8.0);
  float cell = step(0.94, h21(id + floor(uT * 2.0 + h21(id) * 7.0)));
  vec3 base = 0.5 + 0.5 * cos(6.2831 * (flow * 0.6 + uT * 0.03 + vec3(0.62, 0.72, 0.92)));
  vec3 col = base * (0.2 + 0.9 * flow * flow);
  col += vec3(0.6, 0.4, 1.0) * edge * (0.35 + pulse * 1.6);
  col += vec3(0.5, 0.95, 1.0) * cell * (0.5 + 0.5 * uV);
  float ring = pow(0.5 + 0.5 * cos(s * 6.2831 / 90.0), 40.0);
  col += vec3(1.0, 0.75, 1.0) * ring * 1.2;
  // (la profondeur : au fond, la lueur blanche du bout du tunnel, plus vive à l'approche de la sortie)
  float far = smoothstep(500.0, 2300.0, vZ);
  col = mix(col, vec3(0.95, 0.85, 1.0) * (1.0 + uEnd * 2.5), far * 0.9);
  col *= smoothstep(-${TUN_BACK}.0, 0.0, vZ) * 0.85 + 0.15;
  float alpha = clamp(0.3 + flow * 0.55 + edge * 0.6 + ring + far + cell, 0.0, 1.0);
  col = mix(col, vec3(1.0), uWhite);
  gl_FragColor = vec4(col, max(alpha, uWhite));
}`;
// (le fond, au-delà des parois : des nuées qui tournent, et des lignes d'un treillis géant)
const DEEP_VS = `varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const DEEP_FS = `uniform float uT; uniform float uWhite; varying vec3 vDir;
${TUN_NOISE}
void main() {
  vec3 d = normalize(vDir);
  float a = atan(d.y, d.x), b = d.z;
  float sw = fbm(vec2(a * 2.0 + b * 3.0 + uT * 0.05, b * 4.0 - uT * 0.08));
  float sw2 = fbm(vec2(a * 5.0 - uT * 0.1, b * 9.0 + sw * 3.0));
  vec3 col = mix(vec3(0.02, 0.0, 0.06), vec3(0.25, 0.05, 0.4), sw * sw) + vec3(0.05, 0.3, 0.45) * pow(sw2, 3.0);
  float grid = pow(max(abs(sin(a * 9.0 + uT * 0.07)), abs(sin(b * 14.0 - uT * 0.05))), 60.0);
  col += vec3(0.5, 0.3, 0.9) * grid * 0.35;
  gl_FragColor = vec4(mix(col, vec3(1.0), uWhite), 1.0);
}`;
const glowMat = (color, opacity = 1) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false, side: THREE.DoubleSide });
function buildTunnel(camPos, dir) {
  const root = new THREE.Group(), axis = new THREE.Group();
  root.add(axis);
  axis.lookAt(dir); // (+z : vers le nez de la fusée)
  const uni = { uT: { value: 0 }, uP: { value: 0 }, uWhite: { value: 1 }, uEnd: { value: 0 }, uV: { value: 0 }, uN: { value: new THREE.Vector2() }, uPh: { value: new THREE.Vector4() } };
  const deepMat = new THREE.ShaderMaterial({ vertexShader: DEEP_VS, fragmentShader: DEEP_FS, uniforms: { uT: uni.uT, uWhite: uni.uWhite }, side: THREE.BackSide, depthWrite: false, fog: false });
  const deep = new THREE.Mesh(new THREE.SphereGeometry(2900, 48, 24), deepMat);
  deep.renderOrder = -11; deep.frustumCulled = false;
  axis.add(deep);
  // le couloir
  const g = new THREE.CylinderGeometry(TUN_R, TUN_R, TUN_LEN + TUN_BACK, 6, 240, true);
  g.rotateX(Math.PI / 2);
  g.translate(0, 0, (TUN_LEN - TUN_BACK) / 2);
  const skyMat = new THREE.ShaderMaterial({ vertexShader: TUN_VS, fragmentShader: TUN_FS, uniforms: uni, side: THREE.BackSide, transparent: true, depthWrite: false, fog: false });
  const tube = new THREE.Mesh(g, skyMat);
  tube.renderOrder = -10; tube.frustumCulled = false;
  axis.add(tube);
  // les anneaux (des hexagones de lumière, alignés sur les pans)
  const ribs = [];
  const ribGeo = new THREE.TorusGeometry(TUN_R * 0.93, 0.7, 4, 6);
  for (let i = 0; i < RIB_N; i++) {
    const m = new THREE.Mesh(ribGeo, glowMat(new THREE.Color().setHSL(0.72 + (i % 5) * 0.04, 1, 0.65)));
    m.rotation.z = Math.PI / 6;
    m.frustumCulled = false;
    axis.add(m);
    ribs.push(m);
  }
  // les bouches des autres tunnels de la Seed, sur les parois (un trou noir cerclé de lumière)
  const ports = [];
  for (let i = 0; i < PORT_N; i++) {
    const p = new THREE.Group(), hue = Math.random();
    p.add(new THREE.Mesh(new THREE.CircleGeometry(11, 6), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.9, depthWrite: false, fog: false, side: THREE.DoubleSide })));
    const ring = new THREE.Mesh(new THREE.RingGeometry(11, 15, 6), glowMat(new THREE.Color().setHSL(hue, 1, 0.6)));
    ring.position.z = 0.1;
    p.add(ring);
    const halo = new THREE.Mesh(new THREE.RingGeometry(15, 26, 6), glowMat(new THREE.Color().setHSL(hue, 1, 0.5), 0.25));
    halo.position.z = 0.05;
    p.add(halo);
    p.userData = { face: Math.floor(Math.random() * 6), off: i * PORT_GAP + Math.random() * 200, ring, halo };
    p.children.forEach((m) => { m.frustumCulled = false; m.renderOrder = -9; });
    axis.add(p);
    ports.push(p);
  }
  // les traînées de lumière, le long des parois
  const pos = new Float32Array(STREAK_N * 6), col = new Float32Array(STREAK_N * 6), S = [];
  for (let i = 0; i < STREAK_N; i++) {
    const c = new THREE.Color().setHSL(rnd(0.5, 0.85), 1, rnd(0.55, 0.8));
    col.set([c.r * 0.2, c.g * 0.2, c.b * 0.2, c.r, c.g, c.b], i * 6);
    S.push({ a: rnd(0, Math.PI * 2), r: rnd(18, TUN_R * 0.85), z: rnd(-TUN_BACK, TUN_LEN), k: rnd(0.6, 1.4) });
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  sg.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const streaks = new THREE.LineSegments(sg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false }));
  streaks.frustumCulled = false;
  streaks.renderOrder = -9;
  axis.add(streaks);
  root.position.copy(camPos);
  return { root, axis, skyMat, things: [], tunnel: true, uni, ribs, ports, streaks, S, p: 0 };
}


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
        this.dim = c.tunnel !== null && c.tunnel !== undefined ? buildTunnel(c.camera.position, this.tearDir) : buildDim(c.camera.position);
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
    if (D.tunnel) { this.stepTunnel(dt, c); return; }
    // (la lumière de la 7ème dimension : toutes les couleurs, qui tournent)
    const h = (t * 0.15) % 1;
    this.tint = { key: (this._k ||= new THREE.Color()).setHSL(h, 0.9, 0.6), ki: 1.1, sky: (this._s ||= new THREE.Color()).setHSL((h + 0.33) % 1, 0.8, 0.55), ground: (this._g ||= new THREE.Color()).setHSL((h + 0.66) % 1, 0.8, 0.45), hi: 0.9 };
    this.fovBoost = 4 * Math.sin(t * 0.9);
    this.shake = 0;
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
  // Le tunnel défile (c.tunnel : la vitesse, de 0 à 1 ; c.left : les secondes avant la sortie)
  stepTunnel(dt, c) {
    const D = this.dim, t = this.t, v = Math.max(0, Math.min(1, c.tunnel || 0)), U = D.uni;
    U.uT.value = t; U.uV.value = v;
    U.uWhite.value = Math.max(0, 1 - this.pt / 1.2); // (on arrive dans un éclair blanc)
    U.uEnd.value = c.left !== undefined ? Math.max(0, 1 - c.left / 4) : 0; // (la sortie approche : le fond s'éclaire)
    D.p += dt * (25 + 1500 * v);
    const P = D.p, o = (this._b ||= { x: 0, y: 0 }), ph = bendPhases(P, (this._ph ||= [0, 0, 0, 0]));
    U.uP.value = P % TUN_WRAP;
    U.uN.value.set((P * 0.008) % 1000, (P * 0.02) % 1000);
    U.uPh.value.set(ph[0], ph[1], ph[2], ph[3]);
    // les anneaux
    for (let i = 0; i < D.ribs.length; i++) {
      const m = D.ribs[i], span = RIB_GAP * RIB_N, z = ((((i * RIB_GAP - P) % span) + span) % span) - TUN_BACK;
      bend(z, ph, o);
      m.position.set(o.x, o.y, z);
      m.material.opacity = (z < 0 ? Math.max(0, 1 + z / TUN_BACK) : 1) * (1 - Math.min(1, Math.max(0, (z - 900) / 1400))) * (0.55 + 0.45 * Math.sin(t * 4 + i));
    }
    // les bouches des autres tunnels
    for (const p of D.ports) {
      const u = p.userData, span = PORT_GAP * PORT_N, z = ((((u.off - P) % span) + span) % span) - TUN_BACK;
      if (z > span - TUN_BACK - 30) u.face = (u.face + 1 + Math.floor(Math.random() * 4)) % 6; // (elle repartira sur un autre pan)
      const ang = (u.face * Math.PI) / 3, rr = TUN_R * 0.866 - 0.5;
      bend(z, ph, o);
      p.position.set(o.x + Math.cos(ang) * rr, o.y + Math.sin(ang) * rr, z);
      p.lookAt(new THREE.Vector3(o.x, o.y, z).applyMatrix4(D.axis.matrixWorld));
      const f = (z < 0 ? Math.max(0, 1 + z / TUN_BACK) : 1) * (1 - Math.min(1, Math.max(0, (z - 700) / 900)));
      u.ring.material.opacity = f * (0.7 + 0.3 * Math.sin(t * 7));
      u.halo.material.opacity = f * 0.25;
      p.children[0].material.opacity = f * 0.9;
    }
    // les traînées : plus la fusée va vite, plus elles sont longues
    const pa = D.streaks.geometry.attributes.position, A = pa.array, len = 3 + 160 * v, sp = 30 + 2200 * v;
    for (let i = 0; i < D.S.length; i++) {
      const s = D.S[i];
      s.z -= dt * sp * s.k;
      if (s.z < -TUN_BACK) { s.z += TUN_LEN * 0.6 + TUN_BACK; s.a = rnd(0, Math.PI * 2); }
      const x = Math.cos(s.a) * s.r, y = Math.sin(s.a) * s.r, z2 = s.z + len * s.k;
      bend(s.z, ph, o); A[i * 6] = x + o.x; A[i * 6 + 1] = y + o.y; A[i * 6 + 2] = s.z;
      bend(z2, ph, o); A[i * 6 + 3] = x + o.x; A[i * 6 + 4] = y + o.y; A[i * 6 + 5] = z2;
    }
    pa.needsUpdate = true;
    D.streaks.material.opacity = 0.35 + 0.65 * v;
    // la lumière du tunnel sur la fusée (violet, bleu, rose, qui palpitent), la vue qui s'élargit, les secousses
    const pulse = 0.5 + 0.5 * Math.sin(t * 5 + Math.sin(t * 1.7) * 2);
    this.tint = { key: (this._k ||= new THREE.Color()).setHSL(0.74 + 0.08 * Math.sin(t * 0.8), 0.85, 0.62), ki: 0.8 + 0.6 * pulse, sky: (this._s ||= new THREE.Color()).setHSL(0.78, 0.8, 0.5), ground: (this._g ||= new THREE.Color()).setHSL(0.53, 0.9, 0.45), hi: 0.7 + 0.3 * pulse };
    this.fovBoost = 16 * v + 1.5 * Math.sin(t * 2.3) * v;
    this.shake = 0.05 * v + (U.uWhite.value > 0 ? 0.15 * U.uWhite.value : 0);
  }
  leave(c) {
    this.tint = null; this.fovBoost = 0; this.shake = 0;
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
    this.tint = null; this.fovBoost = 0; this.shake = 0;
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
