// Cinématique d'arrivée (à chaque fois qu'on rejoint un monde, ou /intro).
// On commence à bord du HEXA-7, un grand vaisseau d'exploration en blocs : on traverse la salle
// des machines, la soute, les quartiers de l'équipage jusqu'au cockpit, pendant qu'une géante
// de glace à anneaux défile derrière les hublots. Puis le système de l'étoile Hexa, vu de loin :
// l'étoile au centre, deux petites planètes, la ceinture d'astéroïdes intérieure (où se trouve
// la seule planète habitable), une géante gazeuse, la géante de glace et la ceinture
// extérieure. Le vaisseau entre dans la ceinture intérieure, esquive, se fait toucher (réacteur,
// aile arrachée...), part en vrille, est capturé par la planète habitable (le monde du jeu) et
// plonge dans son atmosphère. La cinématique s'arrête là : l'écrasement se joue ensuite pour de
// vrai dans le monde chargé, sur son vrai terrain (voir crash.js), puis on se réveille dans
// l'épave (voir wreckPlan et main.js).
// Chaque fois un peu différente : trajectoire, esquives, chocs (quand, d'où, quel côté),
// enchaînement des plans de caméra, angle de l'écrasement sont tirés au hasard.
// Tout est fait comme le jeu (la DA) : l'étoile et les planètes sont des hexagones géants (des
// blocs hexagonaux habillés des textures du jeu : le monde est un énorme bloc d'herbe avec ses
// arbres), les orbites sont hexagonales, les astéroïdes sont des blocs de pierre et de minerai,
// le vaisseau est une vraie structure de blocs. Étoiles, flammes, fumée, nuages : des hexagones.
//
// Les joueurs qui rejoignent une partie ont leur propre version (pod) : ils n'étaient pas à bord
// du HEXA-7. Le vaisseau de secours HEXA-9 a capté son signal de détresse mais ne peut pas
// traverser la ceinture : il largue une capsule, un seul passager. On attend dans la capsule,
// dans la soute ; compte à rebours, la porte est ouverte, la capsule part vers la planète,
// traverse la ceinture (un choc), plonge dans l'atmosphère... et la suite se joue dans le monde
// (voir playPod dans crash.js : elle s'écrase dans l'eau).
//
// Elle a sa propre scène et son propre canevas, posés par-dessus le jeu : le monde se charge
// derrière pendant ce temps. Clic, Échap, Espace ou Entrée : passer.
import * as THREE from 'three';
import { BLOCKS } from './blocks.js?v=1.1.5-alpha-mvm2b95g';
import { CORNERS, SIZE, NEIGHBORS, hexToWorld, worldToHex } from './hex.js?v=1.1.5-alpha-mvm2b95g';
import { playExplosion, playThunder, playAlarm } from './sound.js?v=1.1.5-alpha-mvm2b95g';
import { playMusic } from './music.js?v=1.1.5-alpha-mvm2b95g';

const WALK = 16;    // fin de la marche à bord
const TD = 53;      // (le vaisseau toucherait le sol : la trajectoire va jusque-là)
const END_SHIP = 50.2; // fondu au noir dans l'atmosphère : la suite se passe dans le monde
const LAUNCH = 5.2;   // (capsule) le largage, à la fin du compte à rebours
const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), UP = new THREE.Vector3(0, 1, 0);

// ---------- Le vaisseau : une structure de blocs, avec un intérieur ----------
// Fuselage (nez vers -z, ~41 blocs de long, 13 de large, ailes de 31) : coque en acier, ventre et
// cloisons en acier assombri, ailes et dérive en vieil acier, bande de voltite, verrière du cockpit et hublots en verre. Dedans, quatre pièces
// séparées par des cloisons avec une porte : le cockpit (le gravitron, des consoles, des
// sièges), les quartiers de l'équipage (lits en laine, coffres, table de craft, four), la soute
// (coffres, caisses, sacs), la salle des machines (cœur de voltite, stabilisateurs, blocs
// physiques). Lampes au plafond. Dehors : ailes en platine (lampes au bout), dérive, réacteurs.
const YC = 2; // (milieu de la coque, en hauteur ; le plancher est en y = 0)
const shipW = (z) => (z < -12 ? 6 * Math.sqrt(Math.max(0, 1 - ((-12 - z) / 9.6) ** 2)) : z <= 12 ? 6 : Math.max(0, 6 - (z - 12) * 0.36));
const shipB = (z) => 3.5 * (0.5 + (0.5 * shipW(z)) / 6);
const outerAt = (x, y, z) => { const W = shipW(z); return W > 0.3 && (x / W) ** 2 + ((y - YC) / shipB(z)) ** 2 <= 1; };
const innerAt = (x, y, z) => { const W = shipW(z) - 1.3, b = shipB(z) - 1.2; return W > 0.5 && b > 0.5 && (x / W) ** 2 + ((y - YC) / b) ** 2 <= 1; };
const BULKHEADS = [-12, -3, 7];

let shipCache = null;
function buildShip() {
  if (shipCache) return shipCache;
  const cells = new Map(), air = new Map();
  const key = (q, r, y) => q + ',' + r + ',' + y;
  for (let r = -25; r <= 25; r++) {
    const z = 0.866 * r;
    for (let q = Math.floor(-17 - r / 2); q <= Math.ceil(17 - r / 2); q++) {
      const x = q + r / 2, ax = Math.abs(x), W = shipW(z);
      for (let y = -2; y <= 11; y++) {
        let id = 0, part = 'hull';
        if (outerAt(x, y, z)) {
          const inn = innerAt(x, y, z);
          if (inn && y >= 1) {
            const bh = BULKHEADS.find((b) => Math.abs(z - b) < 0.44);
            if (bh !== undefined && !(ax < 1.6 && y <= 3)) id = 246; // cloison (et sa porte)
            else { air.set(key(q, r, y), [q, r, y]); continue; }
          } else if (inn && y === 0) id = z > 7 ? 246 : z < -12 ? 245 : 154; // plancher
          else if (y <= 0 && ax < W - 1.2) id = 246;                      // ventre plein
          else {
            id = 245;
            if (z < -12 && y >= 2) { id = 40; part = 'glass'; }                                     // verrière
            else if (z > 18.6) { id = 67; part = 'engine'; }                                         // réacteurs
            else if ((y === 2 || y === 3) && ax >= W - 1.7 && z > -2.5 && z < 6.5 && r % 3 !== 0) { id = 40; part = 'glass'; } // baies vitrées de la soute
            else if (y === 2 && ax >= W - 1.7) id = 63;                                              // bande de voltite
            else if (y <= 0) id = 246;
            if (id === 245 && ax < 0.6 && r % 4 === 0 && innerAt(x, y - 1, z) && y - 1 >= 1) id = 95; // lampes au plafond
          }
        } else if (y === 1 && ax > W && ax <= 15.5 && z >= -4 + (ax - 6) * 0.75 && z <= 9 - (ax - 6) * 0.2) {
          id = ax > 14.4 ? 95 : 247; part = x > 0 ? 'wing+' : 'wing-';                               // ailes
        } else if (ax < 0.6 && y >= 6 && y <= 11 && z >= 9 + (y - 6) * 1.3 && z <= 17.5) {
          id = y === 11 ? 95 : 247; part = 'fin';                                                      // dérive
        } else if (z > 20.1 && z < 22 && (y === 1 || y === 3) && ax < 2.2) { id = 67; part = 'engine'; } // tuyères
        if (id) cells.set(key(q, r, y), [q, r, y, id, part]);
      }
    }
  }
  // l'intérieur : (x, z) -> la case ; posé seulement dans le vide de l'intérieur
  const put = (x, z, y, id) => {
    const { q, r } = worldToHex(x, z), k = key(q, r, y);
    if (!air.has(k)) return;
    air.delete(k);
    cells.set(k, [q, r, y, id, 'inside']);
  };
  // cockpit : le gravitron (le pilote), des consoles, trois sièges
  put(0, -17.3, 1, 81); put(-1.5, -17.3, 1, 243); put(1.5, -17.3, 1, 243);
  put(-2.5, -16.4, 1, 246); put(2.5, -16.4, 1, 246);
  put(0, -15.6, 1, 33); put(-2, -15.6, 1, 33); put(2, -15.6, 1, 33);
  // quartiers : trois lits à gauche ; table de craft, coffres et four à droite ; une table
  for (const z of [-10.4, -9.5, -7.8, -6.9, -5.2, -4.3]) put(-3.6, z, 1, 194);
  put(3.6, -10.4, 1, 31); put(3.6, -9.5, 1, 54); put(3.6, -8.7, 1, 54); put(3.6, -6.9, 1, 42);
  put(2.2, -5.2, 1, 18); put(2.2, -5.2, 2, 33);
  // soute : coffres, caisses de planches, sacs en laine
  for (const z of [-1.3, -0.4, 0.4]) { put(-3.6, z, 1, 54); put(3.6, z, 1, 54); }
  for (const z of [2.2, 3, 3.9]) { put(-3.6, z, 1, 18); put(-3.6, z, 2, 18); put(3.6, z, 1, 18); }
  put(-3, 5.2, 1, 195); put(3, 5.2, 1, 195); put(3, 5.2, 2, 195);
  // salle des machines : le cœur de voltite, stabilisateurs, blocs physiques allumés
  for (let y = 1; y <= 3; y++) put(0, 12.5, y, 63);
  for (const s of [-2, 2]) { put(s, 11.3, 1, 242); put(s, 13.9, 1, 242); put(s, 12.5, 1, 67); put(s, 12.5, 2, 67); }
  shipCache = { blocks: [...cells.values()], air: [...air.values()] };
  return shipCache;
}
// Blocs [q, r, y, id, partie] (y = 0 : le plancher)
export function shipBlocks() { return buildShip().blocks; }

// La capsule de secours des joueurs qui rejoignent une partie (une trentaine de blocs, nez vers
// -z) : plancher en acier assombri, parois en acier, verrière à l'avant et hublot sur le toit, le
// gravitron au milieu, un réacteur à l'arrière, deux ailerons et un nez en vieil acier.
export function podBlocks() {
  const out = [], ring = [[0, 0], ...NEIGHBORS];
  for (const [q, r] of ring) out.push([q, r, 0, 246]);                                                   // plancher
  for (const [q, r] of NEIGHBORS) out.push([q, r, 1, hexToWorld(q, r).z < 0 ? 40 : 245]);                // parois, verrière devant
  out.push([0, 0, 1, 81]);                                                                                // le gravitron
  for (const [q, r] of ring) out.push([q, r, 2, q === 0 && r === 0 ? 40 : 245]);                         // toit (hublot au milieu)
  out.push([-1, 2, 1, 67], [-1, 2, 0, 246]);                                                               // réacteur
  out.push([2, 0, 1, 247], [-2, 0, 1, 247], [1, -2, 1, 247], [1, -2, 0, 246]);                             // ailerons, nez
  return out;
}

// ---------- L'épave, dans le monde ----------
// Le vaisseau tel qu'il a fini : couché un peu nez en bas, percé du côté de l'aile arrachée
// (side : 1 à droite, -1 à gauche ; on entre et sort par là), trous dans le toit, verre en
// partie brisé, réacteurs éteints, quelques lampes grillées. L'intérieur reste praticable.
// Renvoie (relatif à la case du vaisseau, y = 0 : le plancher) : { blocks: [[q, r, y, id]],
// air: [[q, r, y]] (l'intérieur), wing: [[q, r, y, id]] (l'aile arrachée, à disperser),
// inside: [q, r, y] (où l'on se réveille), chest: [q, r, y] (le coffre de secours) }
export function wreckPlan(side = 1, rnd = Math.random) {
  const { blocks: full, air: inAir } = buildShip();
  const tilt = (r) => Math.round(r * 0.866 * 0.05); // (le nez plus bas que la queue)
  const blocks = [], air = [], wing = [];
  for (const [q, r, y] of inAir) air.push([q, r, y + tilt(r)]);
  for (const [q, r, y, id, part] of full) {
    const { x, z } = hexToWorld(q, r), ty = y + tilt(r);
    if (part === (side > 0 ? 'wing+' : 'wing-')) { wing.push([q, r, y, id]); continue; }
    // la brèche, sous l'aile arrachée : dans la soute, côté aile
    if (part !== 'inside' && Math.sign(x) === side && Math.abs(x) > shipW(z) - 1.8 && z > -1.5 && z < 5 && y >= 1 && y <= 3) { air.push([q, r, ty]); continue; }
    let b = id;
    if (part === 'glass' && rnd() < 0.4) { air.push([q, r, ty]); continue; } // verre brisé
    if (part === 'hull' && y >= 4 && rnd() < 0.05) { air.push([q, r, ty]); continue; } // trous dans le toit
    if (b === 67) { if (part === 'engine' && rnd() < 0.25) continue; b = 66; } // réacteurs éteints
    if (b === 95 && part === 'hull' && rnd() < 0.3) b = 94;                     // lampes grillées
    if (b === 245 && rnd() < 0.3) b = 247;                                      // coque abîmée, brûlée
    blocks.push([q, r, ty, b]);
  }
  // on se réveille dans les quartiers, entre les lits et le coffre
  const w = worldToHex(0, -7.8), c = worldToHex(3.6, -8.7);
  return { blocks, air, wing, inside: [w.q, w.r, 1 + tilt(w.r)], chest: [c.q, c.r, 1 + tilt(c.r)] };
}

// ---------- Prisme hexagonal (un bloc du jeu, ou une planète) ----------
// Faces : 0 les côtés (la texture entière sur chacun), 1 le dessus, 2 le dessous
export function hexPrism(R, H) {
  const k = R / SIZE, C = CORNERS.map(([x, z]) => [x * k, z * k]);
  const faces = [[], [], []]; // [x, y, z, u, v] par sommet
  for (let i = 0; i < 6; i++) {
    const [x0, z0] = C[i], [x1, z1] = C[(i + 1) % 6];
    faces[0].push([x0, 0, z0, 0, 0], [x1, H, z1, 1, 1], [x1, 0, z1, 1, 0], [x0, 0, z0, 0, 0], [x0, H, z0, 0, 1], [x1, H, z1, 1, 1]);
    const uv = (x, z) => [0.5 + x / (2 * R), 0.5 - z / (2 * R)];
    faces[1].push([0, H, 0, ...uv(0, 0)], [x1, H, z1, ...uv(x1, z1)], [x0, H, z0, ...uv(x0, z0)]);
    faces[2].push([0, 0, 0, ...uv(0, 0)], [x0, 0, z0, ...uv(x0, z0)], [x1, 0, z1, ...uv(x1, z1)]);
  }
  const all = [...faces[0], ...faces[1], ...faces[2]];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(all.flatMap((v) => v.slice(0, 3)), 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(all.flatMap((v) => v.slice(3)), 2));
  g.addGroup(0, faces[0].length, 0);
  g.addGroup(faces[0].length, faces[1].length, 1);
  g.addGroup(faces[0].length + faces[1].length, faces[2].length, 2);
  g.computeVertexNormals();
  return g;
}

// Point à la distance r du centre sur une orbite hexagonale (coins aux angles 0°, 60°...),
// à l'angle deg (dans le plan du système)
const hexR = (a) => Math.cos(Math.PI / 6) / Math.cos((((a % (Math.PI / 3)) + Math.PI / 3) % (Math.PI / 3)) - Math.PI / 6);
const orbitPos = (r, deg) => { const a = (deg * Math.PI) / 180, k = r * hexR(a); return new THREE.Vector3(Math.cos(a) * k, 0, Math.sin(a) * k); };

// ---------- Particules hexagonales ----------
const PART_VERT = `
  attribute float size; attribute float alpha; attribute vec3 tint;
  uniform float uAtten; uniform float uMax;
  varying vec3 vC; varying float vA;
  void main() {
    vC = tint; vA = alpha;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = min(uMax, uAtten > 0.5 ? size * (300.0 / -mv.z) : size);
    gl_Position = projectionMatrix * mv;
  }`;
const PART_FRAG = `
  uniform float uFade;
  varying vec3 vC; varying float vA;
  void main() {
    vec2 p = abs(gl_PointCoord * 2.0 - 1.0);
    if (max(p.x * 0.866 + p.y * 0.5, p.y) > 1.0) discard; // (un hexagone)
    gl_FragColor = vec4(vC, vA * uFade);
  }`;
export class Particles {
  constructor(scene, max, additive) {
    this.max = max;
    this.list = [];
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 3); this.col = new Float32Array(max * 3);
    this.size = new Float32Array(max); this.alpha = new Float32Array(max);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('tint', new THREE.BufferAttribute(this.col, 3));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1));
    this.geo = g;
    this.uniforms = { uAtten: { value: 1 }, uFade: { value: 1 }, uMax: { value: 2048 } };
    this.points = new THREE.Points(g, new THREE.ShaderMaterial({
      vertexShader: PART_VERT, fragmentShader: PART_FRAG, uniforms: this.uniforms,
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    }));
    this.points.frustumCulled = false;
    scene.add(this.points);
  }
  // (drag : freinage par l'air, rise : poussée vers le haut, la fumée qui monte)
  spawn(p, v, life, color, size, grow = 0, drag = 0, rise = 0) {
    if (this.list.length >= this.max) this.list.shift();
    this.list.push({ p: p.clone(), v: v.clone(), life, t: 0, c: new THREE.Color(color), size, grow, drag, rise });
  }
  update(dt) {
    this.list = this.list.filter((q) => (q.t += dt) < q.life);
    this.list.forEach((q, i) => {
      if (q.drag) q.v.multiplyScalar(Math.exp(-q.drag * dt));
      if (q.rise) q.v.y += q.rise * dt;
      q.p.addScaledVector(q.v, dt);
      this.pos.set([q.p.x, q.p.y, q.p.z], i * 3);
      this.col.set([q.c.r, q.c.g, q.c.b], i * 3);
      this.size[i] = q.size + q.grow * q.t;
      const k = q.t / q.life;
      this.alpha[i] = Math.min(1, k * 12) * (1 - k);
    });
    this.geo.setDrawRange(0, this.list.length);
    for (const a of ['position', 'tint', 'size', 'alpha']) this.geo.attributes[a].needsUpdate = true;
  }
  // nuage figé (étoiles, ceintures, nuages) : alpha fixe pour chacun
  freeze(alpha) {
    this.update(0);
    this.list.forEach((q, i) => { this.alpha[i] = alpha(i); });
    this.geo.attributes.alpha.needsUpdate = true;
  }
}

// ---------- Interface (textes, voiles de couleur) ----------
function injectStyle() {
  if (document.getElementById('intro-style')) return;
  const st = document.createElement('style');
  st.id = 'intro-style';
  st.textContent = `
  #intro { position: fixed; inset: 0; z-index: 200; background: #000; overflow: hidden; cursor: pointer; user-select: none; font-family: 'Segoe UI', system-ui, sans-serif; }
  #intro canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
  #intro .veil { position: absolute; inset: 0; pointer-events: none; opacity: 0; }
  #intro .alarm { background: radial-gradient(ellipse at center, transparent 45%, rgba(255, 30, 20, 0.85) 100%); }
  #intro .fire { background: radial-gradient(ellipse at center, rgba(255, 140, 40, 0.12) 30%, rgba(255, 80, 10, 0.75) 100%); }
  #intro .flash { background: #fff; }
  #intro .black { background: #000; opacity: 1; }
  #intro .bars::before, #intro .bars::after { content: ''; position: absolute; left: 0; right: 0; height: 7vh; background: #000; }
  #intro .bars::before { top: 0; } #intro .bars::after { bottom: 0; }
  #intro .bars { opacity: 1; }
  #intro .lbl { position: absolute; transform: translate(-50%, 0); font-size: clamp(11px, 1.3vw, 15px); color: rgba(220, 228, 240, 0.8); text-shadow: 0 1px 4px #000; white-space: nowrap; pointer-events: none; opacity: 0; }
  #intro .lbl.home { color: #7dffa8; font-weight: 700; font-size: clamp(13px, 1.6vw, 19px); }
  #intro .caption { position: absolute; left: 50%; bottom: 10%; transform: translateX(-50%); width: min(880px, calc(100% - 32px)); text-align: center;
    color: #e8eef5; font-size: clamp(16px, 2.2vw, 25px); font-weight: 600; text-shadow: 0 2px 10px #000, 0 0 2px #000; line-height: 1.4; min-height: 2.8em; }
  #intro .caption.warn { color: #ffd34a; }
  #intro .caption.alert { color: #ff5a4a; letter-spacing: 1px; text-transform: uppercase; }
  #intro .caption.quiet { color: #9aa4b0; font-style: italic; font-weight: 500; }
  #intro .skip { position: absolute; top: calc(7vh + 10px); right: 18px; color: rgba(255, 255, 255, 0.5); font-size: 13px; }
  #intro .title { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px; opacity: 0; pointer-events: none; }
  #intro .title h1 { margin: 0; font-size: clamp(42px, 8vw, 96px); font-weight: 800; letter-spacing: 2px; color: #fff; text-shadow: 0 4px 24px rgba(60, 220, 255, 0.45), 0 2px 6px #000; }
  #intro .title h1 span { color: #5fd35f; }
  #intro .title p { margin: 0; color: #c8d2dc; font-size: clamp(16px, 2.4vw, 26px); font-weight: 600; }
  #intro .title small { color: #fff; font-size: 16px; font-weight: 600; animation: introBlink 1.4s ease-in-out infinite; }
  @keyframes introBlink { 50% { opacity: 0.35; } }`;
  document.head.appendChild(st);
}

const smooth = (a, b, t) => { const x = Math.max(0, Math.min(1, (t - a) / (b - a))); return x * x * (3 - 2 * x); };
const rand3 = (k) => new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(k);
const rr = (a, b) => a + Math.random() * (b - a);
const pick = (l) => l[Math.floor(Math.random() * l.length)];
const sgn = () => (Math.random() < 0.5 ? -1 : 1);

// Joue la cinématique. atlas : les textures du jeu (voir textures.js) ; isReady() : le monde
// est prêt (sinon, l'écran du réveil attend) ; onDone({ side }) : fin (sur un clic ou une
// touche : le jeu peut reprendre la souris ; side : le côté de l'aile arrachée, pour l'épave).
// (startAt : commencer plus loin, en secondes ; pod : la version des joueurs qui rejoignent)
export function playIntro({ atlas = null, isReady = () => true, onDone = () => {}, startAt = 0, pod = false } = {}) {
  injectStyle();
  const POD = !!pod;
  // les moments clés des deux versions
  const END = POD ? 23.2 : END_SHIP;
  const ENTRY = POD ? 19.4 : 48.4;   // entrée dans l'atmosphère
  const ALARM = POD ? 14 : 29.6;     // le radar s'affole
  const CALM = POD ? 16.5 : 44.5;    // le pilote reprend la main
  const EZ = POD ? 1 : 20;           // (réacteurs : à l'arrière de z = EZ)
  // musique : l'espace, puis le danger un peu avant que le radar ne s'affole
  let tense = startAt >= ALARM - 2;
  playMusic(tense ? 'danger' : 'space', 2);
  const root = document.createElement('div');
  root.id = 'intro';
  root.innerHTML = `<canvas></canvas><div class="lbl" data-k="star">Étoile Hexa</div><div class="lbl" data-k="belt">Ceinture d'astéroïdes</div><div class="lbl home" data-k="home">Seule planète habitable</div>
    <div class="veil fire"></div><div class="veil alarm"></div><div class="veil flash"></div><div class="veil bars"></div><div class="veil black"></div>
    <div class="caption"></div><div class="skip">Clic, Échap ou Espace : passer</div>
    <div class="title"><h1>Hexa<span>Craft</span></h1><p>Survivre. Explorer. Reconstruire.</p><small></small></div>`;
  document.body.appendChild(root);
  const $ = (s) => root.querySelector(s);
  const canvas = $('canvas'), caption = $('.caption'), alarm = $('.alarm'), fire = $('.fire'), flash = $('.flash'), black = $('.black'), title = $('.title'), prompt = $('.title small'), skipEl = $('.skip');
  const labels = [...root.querySelectorAll('.lbl')];

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  const scene = new THREE.Scene();
  const SPACE = new THREE.Color(0x02030a), SKY = new THREE.Color(0x86c4ee);
  scene.background = SPACE.clone();
  scene.fog = new THREE.Fog(SPACE.clone(), 1, 1e6);
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 30000);
  const resize = () => { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); };
  resize();
  addEventListener('resize', resize);

  // ---------- Matières : les textures du jeu ----------
  const texCache = new Map();
  const texOf = (img) => {
    const t = new THREE.CanvasTexture(img);
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    t.generateMipmaps = false;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  const tex = (name) => {
    if (!texCache.has(name)) texCache.set(name, atlas?.tiles?.[name] ? texOf(atlas.tiles[name]) : null);
    return texCache.get(name);
  };
  const mat = (name, glow = false, opts = {}) => {
    const t = tex(name), M = glow ? THREE.MeshBasicMaterial : THREE.MeshLambertMaterial;
    return t ? new M({ map: t, ...opts }) : new M({ color: 0x8a8a8a, ...opts });
  };
  const GLOW = new Set([95, 67, 72, 242]); // (lampe, bloc physique allumé, lave, stabilisateur : ils brillent)
  const matCache = new Map();
  const matsOf = (id) => {
    if (matCache.has(id)) return matCache.get(id);
    const b = BLOCKS[id], glow = GLOW.has(id);
    const o = id === 40 ? { transparent: true, opacity: 0.45, depthWrite: false } : b.leaves ? { alphaTest: 0.5 } : {};
    const m = [mat(b.side, glow, o), mat(b.top + '_cap', glow, o), mat(b.bottom + '_cap', glow, o)];
    matCache.set(id, m);
    return m;
  };
  const blockGeo = hexPrism(SIZE, 1);

  // ---------- Lumières ----------
  const ambient = new THREE.AmbientLight(0x6a7488, 0.55);
  scene.add(ambient);
  const starLight = new THREE.PointLight(0xfff0d0, 3.2, 0, 0); // (l'étoile éclaire tout le système)
  scene.add(starLight);
  // étoiles du fond (hexagones de 1 à 3 pixels ; elles suivent la caméra : infiniment loin)
  const stars = new Particles(scene, 3500, true);
  stars.uniforms.uAtten.value = 0;
  for (let i = 0; i < 3500; i++) stars.spawn(rand3(2).normalize().multiplyScalar(15000 + Math.random() * 6000), new THREE.Vector3(), 1e9, ['#ffffff', '#cfe0ff', '#ffe8c0', '#a0c8ff'][i % 4], 1 + Math.random() * 2.4);
  stars.freeze(() => 0.4 + Math.random() * 0.6);

  // ---------- Le système de l'étoile Hexa (tout en hexagones) ----------
  const planets = [];
  const planetOf = (R, H, mats, pos, tilt, spin) => {
    const m = new THREE.Mesh(hexPrism(R, H), mats);
    m.geometry.translate(0, -H / 2, 0); // (centré)
    const g = new THREE.Group();
    g.add(m);
    g.position.copy(pos);
    g.rotation.set(tilt, Math.random() * 6, tilt * 0.5);
    m.userData.spin = spin;
    scene.add(g);
    planets.push(m);
    return g;
  };
  const block3 = (top, side, bottom, glow = false) => [mat(side, glow), mat(top + '_cap', glow), mat(bottom + '_cap', glow)];
  // l'étoile : un hexagone de lave incandescent, et son halo (des hexagones toujours face à nous)
  planetOf(160, 110, block3('lava', 'lava', 'lava', true), new THREE.Vector3(), 0.2, 0.04);
  const halo = new THREE.Group();
  [[230, 0xfff2b0, 0.55], [330, 0xffc850, 0.25], [520, 0xff9a30, 0.1], [820, 0xff7a20, 0.04]].forEach(([r, c, o], i) => {
    const m = new THREE.Mesh(new THREE.CircleGeometry(r, 6), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    m.userData.spin = (i % 2 ? -1 : 1) * 0.03 * (i + 1);
    halo.add(m);
  });
  scene.add(halo);
  // les orbites (hexagonales) : planètes intérieures, monde habitable, géante gazeuse, géante de glace
  const ORB = { in1: 420, in2: 620, home: 1030, gas: 1650, ice: 2250 };
  const orbitMat = new THREE.LineBasicMaterial({ color: 0x8a9ac8, transparent: true, opacity: 0.3, fog: false });
  for (const r of Object.values(ORB)) {
    const pts = Array.from({ length: 6 }, (_, i) => new THREE.Vector3(Math.cos((i * Math.PI) / 3) * r, 0, Math.sin((i * Math.PI) / 3) * r));
    scene.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), orbitMat));
  }
  planetOf(44, 34, block3('sulfur', 'sulfur', 'sulfur'), orbitPos(ORB.in1, 168), 0.4, 0.3);   // petite planète jaune
  planetOf(34, 26, block3('magma', 'magma', 'magma'), orbitPos(ORB.in2, 8), 0.6, 0.25);        // petite planète rouge
  // la géante gazeuse : des bandes orange et crème (texture faite ici, en pixels comme le jeu)
  const bands = document.createElement('canvas');
  bands.width = bands.height = 16;
  const bg = bands.getContext('2d');
  const BAND = ['#c98a4b', '#e2b884', '#a0623a', '#f0d6a8', '#b8763f', '#d9a066', '#8a4f2c', '#ecd0a0'];
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    bg.fillStyle = BAND[Math.floor((y + (Math.random() < 0.1 ? 1 : 0)) / 2) % BAND.length];
    bg.fillRect(x, y, 1, 1);
  }
  bg.fillStyle = '#b5442c'; bg.fillRect(9, 9, 3, 2); // (la grande tache)
  const bandTex = texOf(bands);
  texCache.set('#bands', bandTex);
  const gasMat = new THREE.MeshLambertMaterial({ map: bandTex });
  planetOf(290, 200, [gasMat, gasMat, gasMat], orbitPos(ORB.gas, 186), 0.15, 0.06);
  // la géante de glace et ses anneaux hexagonaux
  const ICE = orbitPos(ORB.ice, -18);
  const ice = planetOf(170, 125, block3('ice_water', 'ice_water', 'ice_water'), ICE, 0.25, 0.08);
  [[225, 262, 0.55], [274, 298, 0.35], [308, 340, 0.25]].forEach(([a, b, o]) => {
    const ring = new THREE.Mesh(new THREE.RingGeometry(a, b, 6, 1), new THREE.MeshLambertMaterial({ color: 0xbfd8e4, transparent: true, opacity: o, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = Math.PI / 2;
    ice.add(ring);
  });
  // les deux ceintures d'astéroïdes, vues de loin : une poussière de petits hexagones
  const belt = (n, a, b, h) => {
    const p = new Particles(scene, n, false);
    p.uniforms.uMax.value = 6;
    for (let i = 0; i < n; i++) {
      const pos = orbitPos(rr(a, b), rr(0, 360));
      pos.y = (Math.random() + Math.random() - 1) * h;
      p.spawn(pos, new THREE.Vector3(), 1e9, pick(['#b8a48a', '#8f8274', '#d0bea0', '#7a7068', '#a89880']), rr(14, 30));
    }
    p.freeze(() => rr(0.5, 0.95));
    return p;
  };
  const belts = [belt(15000, 880, 1180, 50), belt(13000, 2560, 2900, 70)];
  // le monde du jeu : un énorme bloc d'herbe (avec ses arbres), dans la ceinture intérieure
  const HOME = orbitPos(ORB.home, 12), HOME_R = 120, HOME_H = 70;
  const home = planetOf(HOME_R, HOME_H, block3('grass_top', 'grass_side', 'dirt'), HOME, 0, 0);
  home.rotation.set(0, 0, 0);
  const TOP = HOME.y + HOME_H / 2;
  const GROUND = TOP + 1; // (le dessus de la face d'herbe)
  // le repère vert autour du monde habitable (vue d'ensemble)
  const marker = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 6 }, (_, i) => new THREE.Vector3(Math.cos((i * Math.PI) / 3) * 210, 0, Math.sin((i * Math.PI) / 3) * 210))),
    new THREE.LineBasicMaterial({ color: 0x5dff8a, transparent: true, opacity: 0, fog: false }));
  marker.position.copy(HOME);
  scene.add(marker);

  // ---------- Le vaisseau : ses blocs ----------
  const list = POD ? podBlocks().map(([q, r, y, id]) => [q, r, y, id, id === 40 ? 'glass' : id === 67 ? 'engine' : 'hull']) : shipBlocks();
  const ship = new THREE.Group();
  const byId = new Map();
  const blocks = list.map(([q, r, y, id, part]) => {
    const { x, z } = hexToWorld(q, r);
    if (!byId.has(id)) byId.set(id, []);
    const b = { id, part, local: new THREE.Vector3(x, y - 0.5, z), slot: byId.get(id).length, alive: true };
    byId.get(id).push(b);
    return b;
  });
  const shipMeshes = new Map();
  for (const [id, bl] of byId) {
    const m = new THREE.InstancedMesh(blockGeo, matsOf(id), bl.length);
    bl.forEach((b) => { m4.makeTranslation(b.local.x, b.local.y, b.local.z); m.setMatrixAt(b.slot, m4); });
    if (id === 40) m.renderOrder = 2;
    ship.add(m);
    shipMeshes.set(id, m);
  }
  // l'éclairage de bord (chaud), dans les pièces
  if (POD) { const l = new THREE.PointLight(0xbfe8ff, 0.8, 4, 1.2); l.position.set(0, 1.6, 0); ship.add(l); }
  else for (const z of [-15, -7, 1.5, 12]) { const l = new THREE.PointLight(0xffdcae, 1.6, 16, 1.2); l.position.set(0, 3.4, z); ship.add(l); }
  scene.add(ship);
  // (capsule) le vaisseau de secours HEXA-9 : le même modèle que le HEXA-7, intact, au-delà de
  // la ceinture ; la porte de sa soute est ouverte (côté droit, tournée vers la planète) et la
  // capsule y attend son largage
  let M = null, HX = null, MF = null, P0 = null, podQ0 = null, motherM = null;
  if (POD) {
    M = orbitPos(ORB.home + 340, 12).add(new THREE.Vector3(0, 170, 0));
    HX = new THREE.Vector3(HOME.x - M.x, 0, HOME.z - M.z).normalize();
    const mother = new THREE.Group(), mb = new Map();
    for (const [q, r, y, id, part] of shipBlocks()) {
      const { x, z } = hexToWorld(q, r);
      if (z > -1.5 && z < 5 && ((part !== 'inside' && x > shipW(z) - 1.8 && y >= 1 && y <= 3) || (part === 'inside' && x > 1.5))) continue; // la porte ouverte, la voie dégagée
      if (!mb.has(id)) mb.set(id, []);
      mb.get(id).push([x, y - 0.5, z]);
    }
    for (const [id, l] of mb) {
      const m = new THREE.InstancedMesh(blockGeo, matsOf(id), l.length);
      l.forEach(([x, y, z], i) => m.setMatrixAt(i, m4.makeTranslation(x, y, z)));
      if (id === 40) m.renderOrder = 2;
      mother.add(m);
    }
    for (const z of [-15, -7, 1.5, 12]) { const l = new THREE.PointLight(0xffdcae, 1.6, 16, 1.2); l.position.set(0, 3.4, z); mother.add(l); }
    mother.position.copy(M);
    mother.rotation.y = Math.atan2(-HX.z, HX.x); // (son côté droit vers la planète)
    scene.add(mother);
    mother.updateMatrixWorld();
    MF = new THREE.Vector3(0, 0, -1).applyQuaternion(mother.quaternion);
    motherM = mother.matrixWorld;
    P0 = new THREE.Vector3(0, 1, 2).applyMatrix4(mother.matrixWorld);
    podQ0 = mother.quaternion.clone().multiply(new THREE.Quaternion().setFromAxisAngle(UP, -Math.PI / 2)); // (le nez vers la porte)
  }
  const BOTTOM = Math.min(...blocks.map((b) => b.local.y)); // (le dessous du ventre)
  const engines = blocks.filter((b) => b.part === 'engine');
  const lamps = shipMeshes.get(95);
  const hide = (b) => {
    b.alive = false;
    const im = shipMeshes.get(b.id);
    im.setMatrixAt(b.slot, m4.makeScale(0, 0, 0));
    im.instanceMatrix.needsUpdate = true;
  };
  // blocs arrachés : ils gardent l'élan du vaisseau et s'éloignent en tournoyant
  const debris = [];
  const shipQ = new THREE.Quaternion();
  const throwBlock = (b, v, spin = 8) => {
    hide(b);
    const d = new THREE.Mesh(blockGeo, shipMeshes.get(b.id).material);
    d.position.copy(b.local).applyMatrix4(ship.matrixWorld);
    d.quaternion.copy(ship.getWorldQuaternion(shipQ));
    scene.add(d);
    debris.push({ m: d, v, w: rand3(spin), t: 0 });
  };
  const OUTSIDE = new Set(['hull', 'glass', 'engine', 'wing+', 'wing-', 'fin']);
  const tear = (side, n, near) => {
    const cand = blocks.filter((b) => b.alive && OUTSIDE.has(b.part) && Math.sign(b.local.x || 1) === side)
      .sort((a, b) => a.local.distanceTo(near) - b.local.distanceTo(near)).slice(0, n * 3);
    for (let k = 0; k < n && cand.length; k++) {
      const b = cand.splice(Math.floor(Math.random() * cand.length), 1)[0];
      throwBlock(b, vel.clone().multiplyScalar(rr(0.7, 0.95)).add(rand3(16)).addScaledVector(right, side * rr(5, 14)));
    }
  };
  // l'aile entière arrachée d'un bloc : elle part en tournant sur elle-même
  const wings = [];
  const tearWing = (side) => {
    const part = blocks.filter((b) => b.alive && b.part === (side > 0 ? 'wing+' : 'wing-'));
    if (!part.length) return;
    const g = new THREE.Group();
    const c = part.reduce((a, b) => a.add(b.local), new THREE.Vector3()).divideScalar(part.length);
    for (const b of part) {
      hide(b);
      const m = new THREE.Mesh(blockGeo, shipMeshes.get(b.id).material);
      m.position.copy(b.local).sub(c);
      g.add(m);
    }
    g.position.copy(c).applyMatrix4(ship.matrixWorld);
    g.quaternion.copy(ship.getWorldQuaternion(shipQ));
    scene.add(g);
    wings.push({ m: g, v: vel.clone().multiplyScalar(0.85).addScaledVector(right, side * 12).add(new THREE.Vector3(0, 5, 0)), w: new THREE.Vector3(rr(-1.5, 1.5), rr(-0.8, 0.8), side * rr(2.5, 4.5)) });
  };
  // points d'où sortent fumée et flammes (dans le repère du vaisseau)
  const wounds = [];

  // ---------- L'écrasement : où, dans quelle direction ----------
  const K5 = orbitPos(1062, -5).add(new THREE.Vector3(0, 105, 0)); // (dernier point dans la ceinture)
  const psi = rr(-0.3, 0.3);
  const dir0 = new THREE.Vector3(HOME.x - K5.x, 0, HOME.z - K5.z).normalize();
  const dir = dir0.clone().applyAxisAngle(UP, psi);                    // sens de la glissade
  const A = HOME.clone().addScaledVector(dir, -50); A.y = GROUND - BOTTOM + 0.1; // (où il toucherait)

  // ---------- Trajectoire : courbe lisse passant par des points (un peu au hasard) ----------
  const oI = ICE.clone().normalize(), pI = new THREE.Vector3(-oI.z, 0, oI.x);
  const j = (k) => rand3(k);
  const KEYS = POD ? [
    [0, P0.clone()],
    [LAUNCH, P0.clone()],
    [LAUNCH + 1.4, P0.clone().addScaledVector(HX, 14)],                                            // hors de la soute
    [9.5, P0.clone().addScaledVector(HX, 110).add(new THREE.Vector3(rr(-15, 15), -25, rr(-15, 15)))],
    [14, HOME.clone().addScaledVector(HX, -180).add(new THREE.Vector3(rr(-20, 20), 150, rr(-20, 20)))], // dans la ceinture
    [ENTRY, HOME.clone().addScaledVector(HX, -95).add(new THREE.Vector3(0, 105, 0))],
    [END, HOME.clone().addScaledVector(HX, -45).add(new THREE.Vector3(0, 60, 0))],
    [END + 2, HOME.clone().add(new THREE.Vector3(0, 45, 0))],
  ] : [
    [0, ICE.clone().addScaledVector(oI, 900).addScaledVector(pI, 400).add(new THREE.Vector3(0, 90, 0)).add(j(20))],
    [10, ICE.clone().addScaledVector(oI, 120).addScaledVector(pI, 390).add(new THREE.Vector3(0, 48, 0)).add(j(10))], // au ras des anneaux
    [16, ICE.clone().addScaledVector(oI, -280).addScaledVector(pI, 330).add(new THREE.Vector3(0, 70, 0)).add(j(20))],
    [23.5, null], // (milieu, calculé ci-dessous)
    [31, orbitPos(1090, -24).add(new THREE.Vector3(0, 95, 0)).add(j(10))],  // entrée dans la ceinture intérieure
    [36, orbitPos(1076, -14).add(new THREE.Vector3(0, 100, 0)).add(j(14))],
    [41, K5],
    [46.6, A.clone().addScaledVector(dir, -130).add(new THREE.Vector3(rr(-15, 15), 60, 0))], // capturé par la planète
    [51.2, A.clone().addScaledVector(dir, -55).add(new THREE.Vector3(0, 20, 0))],           // au ras des arbres
    [TD, A.clone()],
    [TD + 2, A.clone().addScaledVector(dir, 30)],
  ];
  if (!POD) KEYS[3][1] = KEYS[2][1].clone().lerp(KEYS[4][1], 0.5).add(new THREE.Vector3(rr(-60, 60), 60, rr(-60, 60)));
  const m0 = new THREE.Vector3(), m1 = new THREE.Vector3();
  const tangent = (i, out) => {
    const a = KEYS[Math.max(0, i - 1)], b = KEYS[Math.min(KEYS.length - 1, i + 1)];
    return out.subVectors(b[1], a[1]).divideScalar(b[0] - a[0]);
  };
  const pathAt = (t, out) => {
    let i = 0;
    while (i < KEYS.length - 2 && t > KEYS[i + 1][0]) i++;
    const [t0, p0] = KEYS[i], [t1, p1] = KEYS[i + 1], h = t1 - t0;
    const s = Math.max(0, Math.min(1, (t - t0) / h)), s2 = s * s, s3 = s2 * s;
    tangent(i, m0); tangent(i + 1, m1);
    return out.copy(p0).multiplyScalar(2 * s3 - 3 * s2 + 1).addScaledVector(m0, h * (s3 - 2 * s2 + s))
      .addScaledVector(p1, -2 * s3 + 3 * s2).addScaledVector(m1, h * (s3 - s2));
  };
  // esquives dans la ceinture (et un léger flottement tout le temps)
  const ph = Array.from({ length: 6 }, () => rr(0, 6.3)), fq = [rr(0.9, 1.4), rr(2.1, 2.9), rr(1.1, 1.8)];
  const lat = new THREE.Vector3(), fwdA = new THREE.Vector3(), pa = new THREE.Vector3(), pb = new THREE.Vector3();
  const evade = (t, out) => {
    const e = POD ? smooth(10.5, 11.5, t) * (1 - smooth(17, 18.5, t)) * 0.35 : smooth(32, 33.5, t) * (1 - smooth(43.5, 45.5, t));
    const calm = POD ? smooth(LAUNCH + 2, LAUNCH + 4, t) * 0.4 : (1 - smooth(46, 50, t)) * smooth(WALK - 1, WALK + 1, t) + 0.15;
    pathAt(t - 0.05, pa); pathAt(t + 0.05, pb);
    fwdA.subVectors(pb, pa).normalize();
    lat.crossVectors(fwdA, UP).normalize();
    const sx = (Math.sin(t * fq[0] + ph[0]) * 10 + Math.sin(t * fq[1] + ph[1]) * 3.5) * e + Math.sin(t * 0.37 + ph[3]) * 2.5 * calm;
    const sy = Math.sin(t * fq[2] + ph[2]) * 5 * e + Math.sin(t * 0.29 + ph[4]) * 1.6 * calm;
    return out.copy(lat).multiplyScalar(sx).add(new THREE.Vector3(0, sy, 0));
  };
  const ev = new THREE.Vector3();
  const basePos = (t, out) => pathAt(t, out).add(evade(Math.min(t, TD - 0.1), ev));

  // ---------- Astéroïdes (de près) : des blocs de pierre et de minerai, autour de la route ----------
  const AST_KINDS = [3, 28, 30, 60];
  const AST_N = POD ? 180 : 960;
  const astMeshes = AST_KINDS.map((id) => { const m = new THREE.InstancedMesh(blockGeo, matsOf(id), AST_N / 4); scene.add(m); return m; });
  const astData = [];
  const c0 = new THREE.Vector3(), c1 = new THREE.Vector3(), nrm = new THREE.Vector3(), bin = new THREE.Vector3();
  for (let i = 0; i < AST_N; i++) {
    const th = POD ? rr(13, 18) : rr(30.5, 43.5);
    basePos(th, c0); basePos(th + 0.1, c1);
    const f = c1.sub(c0).normalize();
    nrm.crossVectors(f, UP).normalize(); bin.crossVectors(nrm, f);
    const a = Math.random() * 6.3, d = POD ? (i < AST_N - 12 ? rr(30, 140) : rr(5, 8)) : i < AST_N - 24 ? rr(16, 130) : rr(9, 14); // (les derniers : des frôlements)
    const p = c0.clone().addScaledVector(nrm, Math.cos(a) * d).addScaledVector(bin, Math.sin(a) * d * 0.6).addScaledVector(f, rr(-20, 20));
    if (POD && p.distanceTo(M) < 60) p.addScaledVector(HX, 70); // (pas sur le HEXA-9)
    const big = !POD && Math.random() < 0.04, sc = big ? rr(14, 30) : 1.5 + Math.random() ** 2 * 8;
    astData.push({ k: i % 4, i: Math.floor(i / 4), p, r: new THREE.Euler(Math.random() * 6, Math.random() * 6, 0), w: rand3(big ? 0.3 : 2.4), s: new THREE.Vector3(sc * rr(0.7, 1.3), sc * rr(0.7, 1.2), sc * rr(0.7, 1.3)), v: rand3(4) });
  }

  // ---------- Les chocs (au hasard : quand, d'où, quel côté, quoi) ----------
  const nHits = POD ? 1 : Math.random() < 0.5 ? 3 : 4;
  const times = [];
  while (times.length < nHits) {
    const th = POD ? rr(14.6, 16) : rr(34.3, 43.3);
    if (times.every((x) => Math.abs(x - th) > 1.6)) times.push(th);
  }
  times.sort((a, b) => a - b);
  const wingAt = 1 + Math.floor(Math.random() * (nHits - 1));
  const engineSide = sgn(), wingSide = sgn();
  const hits = times.map((th, i) => {
    const kind = POD ? 'chunk' : i === 0 ? 'engine' : i === wingAt ? 'wing' : 'chunk';
    const s = kind === 'engine' ? engineSide : kind === 'wing' ? wingSide : sgn();
    const m = new THREE.Mesh(blockGeo, matsOf(pick(AST_KINDS)));
    m.scale.setScalar(POD ? rr(1.2, 1.8) : rr(4, 6.5));
    m.visible = false;
    scene.add(m);
    // (il arrive de côté et un peu de face : direction dans le repère du vaisseau)
    return { th, kind, s, m, from: new THREE.Vector3(s * rr(0.6, 1), rr(-0.5, 0.6), rr(-1, -0.3)).normalize(), done: false };
  });

  // ---------- Le monde vu d'en haut : des arbres et des nuages sur la face d'herbe ----------
  const inHex = (x, z, R) => [0, 60, 120].every((d) => { const a = (d * Math.PI) / 180; return Math.abs(x * Math.cos(a) + z * Math.sin(a)) <= (R * Math.sqrt(3)) / 2; });
  // arbres (tronc et feuillage en blocs du jeu) sur toute la face d'herbe
  const logs = [], leaves = [];
  const tree = (x, z, base, hgt) => {
    for (let y = 0; y < hgt; y++) logs.push([x, base + y, z]);
    const crown = [[0, 0], ...NEIGHBORS];
    for (let y = hgt - 2; y <= hgt; y++) {
      for (const [dq, dr] of crown) {
        if (y === hgt && (dq || dr) && Math.random() < 0.6) continue;
        if (!dq && !dr && y < hgt) continue;
        const w = hexToWorld(dq, dr);
        leaves.push([x + w.x, base + y, z + w.z]);
      }
    }
  };
  for (let n = 0; n < 340; n++) {
    const x = HOME.x + rr(-HOME_R, HOME_R), z = HOME.z + rr(-HOME_R, HOME_R);
    if (inHex(x - HOME.x, z - HOME.z, HOME_R - 3)) tree(x, z, TOP, Math.floor(rr(4, 6)));
  }
  const logMesh = new THREE.InstancedMesh(blockGeo, matsOf(5), logs.length);
  logs.forEach(([x, y, z], i) => logMesh.setMatrixAt(i, m4.makeTranslation(x, y, z)));
  const leafMesh = new THREE.InstancedMesh(blockGeo, matsOf(6), leaves.length);
  leaves.forEach(([x, y, z], i) => leafMesh.setMatrixAt(i, m4.makeTranslation(x, y, z)));
  scene.add(logMesh, leafMesh);
  // nuages : de gros hexagones blancs au-dessus de la face d'herbe (on les traverse en descendant)
  const clouds = new Particles(scene, 150, false);
  for (let n = 0; n < 150; n++) {
    let cx0 = 0, cz0 = 0;
    do { cx0 = rr(-HOME_R, HOME_R); cz0 = rr(-HOME_R, HOME_R); } while (!inHex(cx0, cz0, HOME_R - 10));
    const c = n < 110 ? new THREE.Vector3(HOME.x + cx0, TOP + rr(30, 50), HOME.z + cz0) : basePos(POD ? rr(19.5, 23) : rr(47, 51), new THREE.Vector3()).add(rand3(40));
    clouds.spawn(c, new THREE.Vector3(), 1e9, Math.random() < 0.5 ? '#ffffff' : '#e8eef4', n < 110 ? rr(30, 70) : POD ? rr(5, 12) : rr(14, 34));
  }
  clouds.freeze((i) => (i < 110 ? rr(0.25, 0.55) : rr(0.2, 0.4)));
  if (POD) clouds.uniforms.uMax.value = 90; // (la capsule passe tout près des nuages : pas d'écran blanc)

  const fireP = new Particles(scene, 2600, true);
  const smokeP = new Particles(scene, 2200, false);
  const trail = new Particles(scene, 400, true); // (la traînée du vaisseau, vue de très loin)
  trail.uniforms.uAtten.value = 0;

  // ---------- Sous-titres ----------
  const sideM = (s) => (s > 0 ? 'droit' : 'gauche'), sideF = (s) => (s > 0 ? 'droite' : 'gauche');
  const CAPS = POD ? [
    [0.8, 3.4, 'HEXA-9, vaisseau de secours. Signal de détresse du HEXA-7 capté il y a trois heures.'],
    [3.6, 5.6, 'Largage de la capsule : 3… 2… 1…', 'warn'],
    [6.2, 9.8, 'Le HEXA-7 s\'est écrasé là-bas. Le HEXA-9 ne peut pas traverser la ceinture d\'astéroïdes.'],
    [10.2, 13.8, pick(['Une capsule, un seul passager : toi. Mission : retrouver les survivants.', 'Une capsule, un seul passager : toi. Les survivants comptent sur cette capsule.'])],
    ...times.map((th) => [th + 0.2, th + 2.2, 'Impact ! La coque de la capsule est touchée.', 'alert']),
    [16.9, 19.2, 'Trop rapide pour la terre ferme… objectif : l\'eau !', 'warn'],
    [19.5, END, 'Entrée dans l\'atmosphère. Accroche-toi.', 'alert'],
  ] : [
    [1.4, 5.6, 'HEXA-7, journal de bord. An 3047.'],
    [6.4, 10.8, pick(['Cent quatorze jours depuis le départ. L\'équipage dort, les réserves baissent.', 'Quatre mois de voyage. Les réserves baissent, aucun monde habitable pour l\'instant.'])],
    [11.4, 15.8, 'Cap sur la ceinture intérieure : une planète y aurait de l\'eau et de l\'herbe.'],
    [16.8, 22, 'Le système de l\'étoile Hexa. Une seule planète habitable, au milieu des astéroïdes.'],
    [24, 28.6, 'Traversée de la ceinture d\'astéroïdes dans trente secondes. Boucliers… à vingt pour cent.'],
    [29.6, 32.8, 'Radar : plusieurs objets en approche… beaucoup d\'objets.', 'warn'],
    ...hits.map((h) => [h.th + 0.25, h.th + 2.6, h.kind === 'engine' ? `Collision ! Réacteur ${sideM(h.s)} hors service` : h.kind === 'wing' ? `Aile ${sideF(h.s)} arrachée !` : pick(['Coque percée !', 'Dépressurisation de la soute !', 'Nouvel impact !']), 'alert']),
    [44.8, 47.8, 'Pilote automatique hors ligne. Capturé par la gravité de la planète…'],
    [48, 50.2, 'Entrée dans l\'atmosphère. Préparez-vous à l\'impact.', 'alert'],
  ];
  const setCaption = (lines, t) => {
    const c = lines.find(([a, b]) => t >= a && t < b);
    if (!c) { caption.textContent = ''; return; }
    caption.textContent = c[2].slice(0, Math.floor((t - c[0]) * 42));
    caption.className = 'caption' + (c[3] ? ' ' + c[3] : '');
    caption.style.opacity = 1 - smooth(c[1] - 0.5, c[1], t);
  };

  // ---------- Le vaisseau, image par image ----------
  const P = new THREE.Vector3(), Pa = new THREE.Vector3(), Pb = new THREE.Vector3(), vel = new THREE.Vector3(), acc = new THREE.Vector3();
  const fwd = new THREE.Vector3(0, 0, -1), right = new THREE.Vector3(1, 0, 0), up2 = new THREE.Vector3(0, 1, 0), tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
  const knockP = new THREE.Vector3(), knockV = new THREE.Vector3();
  let bank = 0, roll = 0, rollV = 0, wobble = 0, damage = 0, shake = 0;
  const placeShip = (t, dt) => {
    if (POD && t < LAUNCH) {
      P.copy(P0); vel.set(0, 0, 0);
      ship.position.copy(P0);
      ship.quaternion.copy(podQ0);
      fwd.set(0, 0, -1).applyQuaternion(podQ0); right.crossVectors(fwd, UP).normalize(); up2.crossVectors(right, fwd);
      ship.updateMatrixWorld();
      return;
    }
    {
      const h = 0.05;
      basePos(t, P); basePos(t + h, Pb); basePos(t - h, Pa);
      vel.subVectors(Pb, Pa).divideScalar(2 * h);
      acc.copy(Pb).add(Pa).addScaledVector(P, -2).divideScalar(h * h);
      // ressort des chocs : le vaisseau est poussé, puis revient sur sa route
      knockV.addScaledVector(knockP, -5 * dt).multiplyScalar(Math.exp(-dt * 2));
      knockP.addScaledVector(knockV, dt);
      P.add(knockP);
      fwd.copy(vel).normalize();
      right.crossVectors(fwd, UP).normalize();
      up2.crossVectors(right, fwd);
      // il s'incline dans les virages (comme un avion), part en vrille après les chocs, puis le
      // pilote reprend à peu près la main
      const target = Math.max(-0.8, Math.min(0.8, -acc.dot(right) * 0.03));
      bank += (target - bank) * (1 - Math.exp(-dt * 2.5));
      rollV *= Math.exp(-dt * (t > CALM ? 1.4 : 0.35));
      roll += rollV * dt;
      ship.position.copy(P);
      ship.lookAt(tmp.copy(P).sub(vel));
      ship.rotateZ(bank + roll);
      ship.rotateX(Math.sin(t * 2.1 + ph[2]) * 0.1 * wobble + Math.sin(t * 5.3) * 0.025 * wobble);
      ship.rotateY(Math.sin(t * 1.7 + ph[4]) * 0.06 * wobble);
    }
    ship.updateMatrixWorld();
  };

  // ---------- Caméra : des plans variés (coupes franches), caméra à l'épaule ----------
  const cam = { p: new THREE.Vector3(), l: new THREE.Vector3(), fov: 60, hand: 0.2, near: 1, name: '' };
  const lookS = new THREE.Vector3();
  let lookInit = false;
  const local = (x, y, z, out) => out.set(x, y, z).applyMatrix4(ship.matrixWorld);
  // à bord : on marche de la salle des machines au cockpit (yeux à 1,6 bloc du plancher) ;
  // un coup d'œil par un hublot quand la géante de glace passe
  const EYE = 2.1;
  const WALK_PTS = [[0, 0, 17.2], [2.6, 0.5, 15.2], [4.8, 1, 11.6], [6.6, 0, 6.4], [9.5, 0.4, 1.5], [12.8, 0, -6.5], [15.2, 0, -13.2], [16, 0, -13.6]];
  let winSide = 1;
  const walkAt = (t, out) => {
    let i = 0;
    while (i < WALK_PTS.length - 2 && t > WALK_PTS[i + 1][0]) i++;
    const [t0, x0, z0] = WALK_PTS[i], [t1, x1, z1] = WALK_PTS[i + 1], u = smooth(t0, t1, t) * 0.5 + Math.max(0, Math.min(1, (t - t0) / (t1 - t0))) * 0.5;
    return out.set(x0 + (x1 - x0) * u, EYE, z0 + (z1 - z0) * u);
  };
  const lookPt = new THREE.Vector3(), walkP = new THREE.Vector3(), walkQ = new THREE.Vector3();
  const walk = () => ({ name: 'walk', f: (t) => {
    walkAt(t, walkP);
    walkAt(t + 0.05, walkQ);
    const moving = walkP.distanceTo(walkQ) > 0.01;
    const step = t * 7.2;
    // le regard : le cœur de voltite, le couloir, le hublot, puis la verrière
    const ahead = tmp2.set(walkP.x * 0.5, 1.9, walkP.z - 12);
    lookPt.set(0, 2.2, 12.5).lerp(ahead, smooth(1.5, 4, t));
    lookPt.lerp(tmp.set(winSide * 8, 3, walkP.z - 1.5), smooth(7.8, 9, t) * (1 - smooth(11.2, 12.4, t)));
    lookPt.lerp(tmp.set(0, 1.7, -40), smooth(13.4, 15.5, t));
    local(walkP.x + (moving ? Math.sin(step / 2) * 0.04 : 0), walkP.y + (moving ? Math.abs(Math.sin(step)) * 0.06 : 0), walkP.z, cam.p);
    local(lookPt.x, lookPt.y, lookPt.z, cam.l);
    cam.fov = 70; cam.hand = 0.015; cam.near = 0.1;
  } });
  // vue d'ensemble du système (comme une carte), le vaisseau n'est qu'un point qui laisse une traînée
  const wide = () => ({ name: 'wide', f: (t, k) => {
    const a = 0.1 - k * 0.012, d = 4500 - k * 60;
    cam.p.set(Math.sin(a) * d, 1550 - k * 20, Math.cos(a) * d);
    cam.l.set(0, -60, 0); cam.fov = 50; cam.hand = 0; cam.near = 20;
  } });
  const detail = () => ({ name: 'detail', f: (t, k) => {
    const u = smooth(0, 6, k);
    local(17 + u * 3, 4 + u * 5, 4 - u * 18, cam.p);
    local(0, 2, 6 - u * 4, cam.l);
    cam.fov = 50; cam.hand = 0.05; cam.near = 0.5;
  } });
  // caméra immobile dans l'espace, posée sur le passage : le vaisseau arrive, passe, s'en va
  const flyby = (tc, s, dist, h, ahead) => {
    let anchor = null;
    return { name: 'flyby', lag: true, f: () => {
      if (!anchor) {
        const c = basePos(tc, new THREE.Vector3()), f = basePos(tc + 0.05, new THREE.Vector3()).sub(c).normalize();
        anchor = c.addScaledVector(new THREE.Vector3().crossVectors(f, UP).normalize(), s * dist).add(new THREE.Vector3(0, h, 0)).addScaledVector(f, ahead);
      }
      cam.p.copy(anchor); cam.l.copy(P); cam.fov = 44; cam.hand = 0.12; cam.near = 1;
    } };
  };
  const orbit = (s) => ({ name: 'orbit', f: (t, k) => {
    const a = s * (0.35 + k * 0.12);
    cam.p.copy(P).addScaledVector(fwd, -Math.cos(a) * 48).addScaledVector(right, Math.sin(a) * 48).addScaledVector(UP, 14);
    cam.l.copy(P).addScaledVector(fwd, 16); cam.fov = 58; cam.hand = 0.1; cam.near = 1;
  } });
  // dans le cockpit, derrière les sièges : la verrière, et ce qui arrive en face
  const cockpit = () => ({ name: 'cockpit', f: () => {
    local(0.3, EYE + 0.2, -13.8, cam.p);
    local(0, 1.6, -60, cam.l);
    cam.fov = 72; cam.hand = 0.04; cam.near = 0.1;
  } });
  const chase = () => ({ name: 'chase', f: () => {
    cam.p.copy(P).addScaledVector(fwd, -40).addScaledVector(up2, 11);
    cam.l.copy(P).addScaledVector(fwd, 26); cam.fov = 62; cam.hand = 0.25; cam.near = 1;
  } });
  const track = (s) => ({ name: 'track', f: () => {
    cam.p.copy(P).addScaledVector(right, s * 30).addScaledVector(UP, 3).addScaledVector(fwd, -4);
    cam.l.copy(P).addScaledVector(fwd, 8); cam.fov = 55; cam.hand = 0.22; cam.near = 1;
  } });
  const reveal = () => {
    let anchor = null;
    return { name: 'reveal', lag: true, f: (t, k) => {
      if (!anchor) anchor = P.clone().addScaledVector(fwd, -80).addScaledVector(right, sgn() * 60).add(new THREE.Vector3(0, 35, 0));
      cam.p.copy(anchor); cam.l.copy(P); cam.fov = 58 - smooth(0, 4, k) * 22; cam.hand = 0.08; cam.near = 1;
    } };
  };
  const entry = () => ({ name: 'entry', f: () => {
    cam.p.copy(P).addScaledVector(fwd, -32).addScaledVector(up2, 9);
    cam.l.copy(P).addScaledVector(fwd, 40); cam.fov = 76; cam.hand = 0.3; cam.near = 1;
  } });
  // (capsule) dans la soute du HEXA-9, derrière la capsule : la porte ouverte, l'espace, la planète
  const podIn = () => ({ name: 'hold', f: (t, k) => {
    cam.p.set(-1.6, 3.5 - k * 0.05, 5.6).applyMatrix4(motherM);
    cam.l.set(8, 1, 1.4).applyMatrix4(motherM);
    cam.fov = 68; cam.hand = 0.02; cam.near = 0.1;
  } });
  // (capsule) sur son toit, juste derrière le hublot : ce qui arrive en face
  const podHood = () => ({ name: 'cockpit', f: () => {
    local(0, 3.1, 1.6, cam.p);
    local(0, 2, -20, cam.l);
    cam.fov = 74; cam.hand = 0.05; cam.near = 0.1;
  } });
  // (capsule) dehors, près de la porte de la soute : elle sort et file devant nous
  const hatch = () => {
    let anchor = null;
    return { name: 'hatch', lag: true, f: () => {
      if (!anchor) anchor = P0.clone().addScaledVector(HX, 24).addScaledVector(MF, -16).add(new THREE.Vector3(0, 6, 0));
      cam.p.copy(anchor); cam.l.copy(P); cam.fov = 55; cam.hand = 0.06; cam.near = 0.5;
    } };
  };
  // (capsule) derrière le HEXA-9 : elle s'éloigne vers la planète
  const behind = () => {
    let anchor = null;
    return { name: 'behind', lag: true, f: (t, k) => {
      if (!anchor) anchor = M.clone().addScaledVector(MF, 70).addScaledVector(HX, -10).add(new THREE.Vector3(0, 28, 0));
      cam.p.copy(anchor); cam.l.copy(P); cam.fov = 50 - smooth(0, 3.5, k) * 18; cam.hand = 0.05; cam.near = 1;
    } };
  };
  const podChase = () => ({ name: 'chase', f: () => {
    cam.p.copy(P).addScaledVector(fwd, -9).addScaledVector(up2, 2.5);
    cam.l.copy(P).addScaledVector(fwd, 8); cam.fov = 64; cam.hand = 0.15; cam.near = 0.3;
  } });
  const podEntry = () => ({ name: 'entry', f: () => {
    cam.p.copy(P).addScaledVector(fwd, -10).addScaledVector(up2, 3);
    cam.l.copy(P).addScaledVector(fwd, 25); cam.fov = 76; cam.hand = 0.3; cam.near = 0.3;
  } });
  // l'enchaînement : à bord, la carte, quelques plans posés, puis au hasard dans la ceinture
  const seq = POD ? [
    { a: 0, ...podIn() },
    { a: 4.6, ...hatch() },
    { a: 8.6, ...behind() },
    { a: 12, ...podChase() },
    { a: 14.2, ...podHood() },
    { a: 16.7, ...flyby(18, sgn(), rr(7, 10), rr(-1, 2), 4) },
    { a: ENTRY - 0.2, ...podEntry() },
  ] : [
    { a: 0, ...walk() },
    { a: WALK, ...wide() },
    { a: 22.3, ...detail() },
    { a: 26.3, ...orbit(sgn()) },
    { a: 29.3, ...cockpit() },
  ];
  let tt = 32.8, last0 = 'cockpit';
  while (!POD && tt < 44.5) {
    const d = rr(1.8, 3);
    const n = pick(['chase', 'cockpit', 'track', 'flyby'].filter((x) => x !== last0));
    seq.push({ a: tt, ...(n === 'chase' ? chase() : n === 'cockpit' ? cockpit() : n === 'track' ? track(sgn()) : flyby(tt + d * 0.65, sgn(), rr(22, 34), rr(-4, 8), 12)) });
    last0 = n;
    tt += d;
  }
  if (!POD) seq.push({ a: 44.5, ...reveal() }, { a: 47.8, ...entry() });
  let shot = -1;

  let t = startAt, last = performance.now(), raf = 0, ended = false, finished = false, entered = false, beeps = 0, count = 3;

  const keyHandler = (e) => {
    e.stopImmediatePropagation();
    if (['Escape', 'Space', 'Enter', 'NumpadEnter'].includes(e.code)) { e.preventDefault(); if (e.type === 'keydown') skip(); }
  };
  const skip = () => {
    if (finished) return;
    if (!ended) toEnd();
    if (isReady()) finish();
  };
  root.addEventListener('pointerdown', skip);
  addEventListener('keydown', keyHandler, true);
  addEventListener('keyup', keyHandler, true);

  const toEnd = () => {
    ended = true;
    caption.textContent = '';
    skipEl.style.display = 'none';
    alarm.style.opacity = fire.style.opacity = flash.style.opacity = 0;
    labels.forEach((l) => { l.style.opacity = 0; });
    black.style.opacity = 1;
  };
  const finish = () => {
    finished = true;
    cancelAnimationFrame(raf);
    removeEventListener('keydown', keyHandler, true);
    removeEventListener('keyup', keyHandler, true);
    removeEventListener('resize', resize);
    // (pas de fondu ici : le jeu fait le réveil, les yeux qui s'ouvrent)
    scene.traverse((o) => { o.geometry?.dispose(); if (o.material && !Array.isArray(o.material) && o.material.dispose) o.material.dispose(); });
    for (const ms of matCache.values()) ms.forEach((m) => m.dispose());
    for (const tx of texCache.values()) tx?.dispose();
    renderer.dispose();
    renderer.forceContextLoss?.();
    root.remove();
    onDone({ side: wingSide });
  };

  const hitFx = (h) => {
    h.done = true;
    h.m.visible = false;
    shake = 1.3;
    damage++;
    wobble = Math.min(1.6, wobble + 0.5);
    rollV += h.s * rr(1.4, 2.4);
    knockV.addScaledVector(right, -h.s * rr(14, 22) * (POD ? 0.35 : 1)).addScaledVector(up2, rr(-7, 7) * (POD ? 0.35 : 1));
    const at = POD ? local(h.s * 1.3, 1, 0, new THREE.Vector3()) : local(h.s * 6, 2, h.kind === 'engine' ? 18 : rr(-8, 8), new THREE.Vector3());
    if (POD) {
      const near = new THREE.Vector3(h.s, 1, 0);
      tear(h.s, 2, near);
      wounds.push({ p: near, fire: 0.6 });
    } else if (h.kind === 'engine') {
      const near = new THREE.Vector3(h.s * 1.5, 1.5, 19.5);
      for (const e of engines) if (e.alive && Math.sign(e.local.x) === h.s && Math.random() < 0.6) throwBlock(e, vel.clone().multiplyScalar(0.8).add(rand3(12)));
      tear(h.s, 8, near);
      wounds.push({ p: near.clone().add(new THREE.Vector3(0, 0.5, 1)), fire: 1 });
    } else if (h.kind === 'wing') {
      tearWing(h.s);
      tear(h.s, 6, new THREE.Vector3(h.s * 6, 1, 2));
      wounds.push({ p: new THREE.Vector3(h.s * 6.3, 1, 2), fire: 1 });
    } else {
      const near = new THREE.Vector3(h.s * 5, rr(1, 5), rr(-10, 10));
      tear(h.s, Math.floor(rr(8, 14)), near);
      wounds.push({ p: near, fire: 0.5 });
    }
    for (let i = 0; i < 110; i++) fireP.spawn(at, rand3(40).addScaledVector(vel, 0.8), rr(0.3, 0.9), ['#ffd060', '#ff8a30', '#ffffff'][i % 3], rr(1.5, 3.5), 0, 1.5);
    flash.style.opacity = 0.35;
    try { playExplosion(rr(6, 14), false); } catch { /* (son indisponible) */ }
  };

  const proj = new THREE.Vector3();
  const LBL_AT = { star: new THREE.Vector3(0, -260, 0), belt: orbitPos(1230, 125).add(new THREE.Vector3(0, -60, 0)), home: HOME.clone().add(new THREE.Vector3(0, -230, 0)) };
  const frame = () => {
    raf = requestAnimationFrame(frame);
    const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (ended) {
      // noir : on attend que le monde soit prêt, puis l'écrasement continue dedans
      if (isReady()) { finish(); return; }
      title.style.opacity = 0;
      caption.className = 'caption quiet';
      caption.style.opacity = 1;
      caption.textContent = 'Chargement du monde…';
      return;
    }
    t += dt;
    if (t >= END) { toEnd(); return; }

    placeShip(t, dt);
    if (t - dt < startAt + 0.001) { // (de quel côté passe la géante de glace, vers t = 10 s)
      const a = basePos(9.9, new THREE.Vector3()), b = basePos(10.1, new THREE.Vector3());
      winSide = Math.sign(tmp.subVectors(ICE, a).dot(tmp2.subVectors(b, a).cross(UP))) || 1;
    }

    // chocs : l'astéroïde arrive (il suit le vaisseau, dans son repère), puis l'impact
    for (const h of hits) {
      if (h.done) continue;
      const k = h.th - t;
      h.m.visible = k < 1.4;
      tmp.copy(h.from).applyQuaternion(ship.getWorldQuaternion(shipQ));
      h.m.position.copy(P).addScaledVector(tmp, Math.max(0, k) * 40 + (POD ? 2.5 : 8));
      h.m.rotation.x += dt * 2.3; h.m.rotation.y += dt * 1.4;
      if (k <= 0) hitFx(h);
    }
    flash.style.opacity = Math.max(0, Number(flash.style.opacity || 0) - dt * 2.5);
    for (const d of debris) {
      d.t += dt;
      d.v.multiplyScalar(Math.exp(-dt * 0.15));
      if (t > ENTRY) d.v.y -= 9 * dt; // (dans l'atmosphère, ils tombent)
      d.m.position.addScaledVector(d.v, dt);
      d.m.rotation.x += d.w.x * dt; d.m.rotation.y += d.w.y * dt; d.m.rotation.z += d.w.z * dt;
      if (d.t > 12) d.m.visible = false;
    }
    for (const w of wings) {
      w.m.position.addScaledVector(w.v, dt);
      w.m.rotation.x += w.w.x * dt; w.m.rotation.y += w.w.y * dt; w.m.rotation.z += w.w.z * dt;
      if (Math.random() < 0.5) smokeP.spawn(w.m.position, rand3(1), 1.6, '#4a4a4a', 2, 3);
    }
    // réacteurs : flamme bleue (celui qui est touché s'éteint ; tout s'éteint à l'entrée dans l'atmosphère)
    if (t < ENTRY && t > (POD ? LAUNCH : 0.2)) {
      const flick = Math.random();
      for (const e of engines) {
        if (!e.alive || e.local.z < EZ || (!POD && damage && Math.sign(e.local.x) === engineSide)) continue;
        if (damage >= 2 && flick < 0.25) continue; // (il tousse)
        if (Math.random() < 0.5) continue;
        const w = local(e.local.x, e.local.y + 0.5, e.local.z + 1, new THREE.Vector3());
        fireP.spawn(w, vel.clone().multiplyScalar(0.25).addScaledVector(fwd, POD ? -7 : -14).add(rand3(POD ? 0.6 : 1.5)), 0.4, '#7fe8ff', POD ? 0.9 : 1.6, POD ? 1 : 2);
      }
    }
    // la traînée, pour la vue d'ensemble
    if (cam.name === 'wide') trail.spawn(P, new THREE.Vector3(), 3.2, '#9ff4ff', 3.5);
    trail.update(dt);
    // les lampes clignotent une fois le vaisseau abîmé
    if (lamps) lamps.visible = !damage || Math.sin(t * 9) > -0.2;
    // blessures du vaisseau : fumée noire, flammes
    for (const w of wounds) {
      const p = local(w.p.x, w.p.y, w.p.z, new THREE.Vector3());
      for (let i = 0; i < 2; i++) {
        smokeP.spawn(p.clone().add(rand3(2)), vel.clone().multiplyScalar(0.55).add(rand3(2.5)), rr(1.6, 2.8), pick(['#2a2a2a', '#3a3a3a', '#555555']), rr(2, 3.5), 4, 0.6);
        if (Math.random() < w.fire) fireP.spawn(p.clone().add(rand3(1.2)), vel.clone().multiplyScalar(0.7).add(rand3(3)), rr(0.25, 0.5), pick(['#ff8a30', '#ffd060', '#ff5020']), rr(1.5, 2.6));
      }
    }
    // (capsule) compte à rebours : un bip par seconde, puis le largage (secousse, souffle)
    if (POD && count >= 0 && t >= LAUNCH - count) {
      if (count > 0) { try { playAlarm(); } catch { /* */ } } else {
        shake = 0.9;
        try { playExplosion(10, false); } catch { /* */ }
        for (let i = 0; i < 60; i++) fireP.spawn(local(0, 1, 2.5, tmp), rand3(6).addScaledVector(HX, -4), 0.6, pick(['#7fe8ff', '#ffffff', '#ffd060']), rr(0.8, 1.6));
      }
      count--;
    }
    if (!tense && t > ALARM - 2) { tense = true; playMusic('danger', 1.2); }
    // alarme : bips dès que le radar s'affole, plus forts dans le cockpit
    if (t > ALARM && t < TD && Math.floor(t / 0.9) > beeps) { beeps = Math.floor(t / 0.9); if (cam.name === 'cockpit' || damage) try { playAlarm(); } catch { /* */ } }
    // entrée dans l'atmosphère : il s'embrase, le ciel devient bleu, les étoiles disparaissent
    const sk = smooth(ENTRY, ENTRY + 3.6, t) * 0.5; // (on ne voit que le début : la suite, c'est dans le monde)
    scene.background.copy(SPACE).lerp(SKY, sk);
    scene.fog.color.copy(scene.background);
    scene.fog.near = sk > 0 ? 80 : 1;
    scene.fog.far = sk > 0 ? 30000 - sk * 29300 : 1e6;
    stars.uniforms.uFade.value = 1 - sk;
    for (const b of belts) b.uniforms.uFade.value = 1 - sk;
    halo.visible = sk < 0.95;
    ambient.intensity = 0.55 + sk * 1.1;
    if (t > ENTRY) {
      if (!entered) { entered = true; try { playThunder(25); } catch { /* */ } }
      const k = smooth(ENTRY, ENTRY + 1.6, t) * (1 - smooth(ENTRY + 3, ENTRY + 4.2, t));
      for (let i = 0; i < 10 * k; i++) {
        const nose = POD ? local(rr(-1, 1), rr(0, 2), -2.2, tmp) : local(rr(-5, 5), rr(-1, 4), -22 + rr(-1, 1), tmp);
        fireP.spawn(nose, fwd.clone().multiplyScalar(POD ? -18 : -40).add(rand3(POD ? 4 : 8)), 0.4, ['#ffb040', '#ff6020', '#fff0a0'][i % 3], POD ? rr(0.8, 1.6) : rr(1.6, 3.2), 2);
      }
      smokeP.spawn(P.clone().add(rand3(POD ? 2 : 6)), rand3(3), 3.5, '#2f2f2f', POD ? 2 : 4, 6);
      shake = Math.max(shake, 0.5 * k);
    }
    // fondus au noir : au début (on ouvre les yeux à bord), à la fin (on perd connaissance)
    black.style.opacity = Math.max(1 - smooth(0, 2.4, t), smooth(END - 1, END - 0.15, t), POD ? 0 : t < WALK ? smooth(WALK - 0.7, WALK, t) : 1 - smooth(WALK, WALK + 0.8, t));
    alarm.style.opacity = cam.name === 'cockpit' && t > ALARM && t < TD ? 0.25 + 0.25 * Math.sin(t * 7) : 0;

    // astéroïdes
    for (const a of astData) {
      a.p.addScaledVector(a.v, dt);
      a.r.x += a.w.x * dt; a.r.y += a.w.y * dt; a.r.z += a.w.z * dt;
      m4.compose(a.p, q4.setFromEuler(a.r), a.s);
      astMeshes[a.k].setMatrixAt(a.i, m4);
    }
    for (const m of astMeshes) { m.instanceMatrix.needsUpdate = true; m.visible = t < ENTRY + 1; } // (sous les nuages, plus d'astéroïdes)
    for (const p of planets) p.rotation.y += p.userData.spin * dt;
    fireP.update(dt);
    smokeP.update(dt);

    // caméra : le plan en cours (coupe franche quand il change), à l'épaule, secousses
    let i = 0;
    while (i + 1 < seq.length && t >= seq[i + 1].a) i++;
    if (i !== shot) { shot = i; lookInit = false; }
    const S = seq[i];
    S.f(t, t - S.a);
    cam.name = S.name;
    if (S.lag) {
      if (!lookInit) { lookS.copy(cam.l); lookInit = true; }
      lookS.lerp(cam.l, 1 - Math.exp(-dt * 5));
    } else lookS.copy(cam.l);
    shake = Math.max(0, shake - dt * 1.4);
    const hand = cam.hand + shake;
    camera.position.copy(cam.p).add(tmp.set(Math.sin(t * 1.3 + ph[0]) + Math.sin(t * 3.1) * 0.4, Math.sin(t * 1.7 + ph[1]) + Math.sin(t * 2.6) * 0.4, Math.sin(t * 1.1 + ph[2])).multiplyScalar(hand * 0.5));
    if (shake > 0) camera.position.add(rand3(shake * (cam.near < 0.5 ? 0.25 : 1.2)));
    camera.lookAt(lookS);
    camera.rotateZ(Math.sin(t * 0.9 + ph[3]) * 0.02 * (1 + hand * 3));
    if (camera.fov !== cam.fov || camera.near !== cam.near) { camera.fov = cam.fov; camera.near = cam.near; camera.updateProjectionMatrix(); }
    stars.points.position.copy(camera.position);
    halo.quaternion.copy(camera.quaternion);
    halo.children.forEach((m) => { m.rotation.z += m.userData.spin * dt; });
    // la vue d'ensemble : orbites bien visibles, repère vert et noms ; ailleurs, presque rien
    const wk = cam.name === 'wide' ? smooth(WALK + 0.8, WALK + 2.5, t) * (1 - smooth(21.6, 22.3, t)) : 0;
    orbitMat.opacity = 0.05 + wk * 0.3;
    marker.material.opacity = wk * 0.9;
    for (const l of labels) {
      proj.copy(LBL_AT[l.dataset.k]).project(camera);
      l.style.left = ((proj.x + 1) / 2) * 100 + '%';
      l.style.top = ((1 - proj.y) / 2) * 100 + '%';
      l.style.opacity = proj.z < 1 ? wk : 0;
    }

    fire.style.opacity = cam.name === 'entry' ? smooth(ENTRY - 0.4, ENTRY + 1, t) * 0.6 : 0;
    setCaption(CAPS, t);
    renderer.render(scene, camera);
  };
  frame();
  return { skip };
}
