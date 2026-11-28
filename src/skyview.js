// Les astres du système vus depuis le monde (voir system.js, planetview.js) : depuis le sol d'une
// planète (Hexa en grand dans le ciel de la Lune, Orgon qui remplit celui de Brasia), ou depuis
// un site dans l'espace (main.js, monde « space: »). Calculé à partir des vraies orbites : les
// phases et les éclipses viennent toutes seules.
//
//  - Au sol : les astres suivent la course du soleil dans le ciel (sky.js), décalés de leur vrai
//    écart à l'étoile (longitude et latitude, vues depuis la planète). Ils sont dessinés
//    4 fois plus grands que leur vraie taille apparente (l'étoile aussi, même sur Hexa : c'est son
//    soleil, et la Lune de Hexa sa lune) : de petits points la nuit, de grands disques pour les voisins proches.
//  - Éclipse : un astre passe devant l'étoile ; la part du disque cachée assombrit le jour.
//  - Dans l'espace : les vraies directions, la vraie taille, les astéroïdes proches ; les axes
//    sont ceux de la bulle où l'on est (voir spaceflight.js).
//  - Tout en haut du ciel d'une planète : elle-même, ronde, derrière le terrain.
// Les grands astres sont longs à calculer : c'est fait peu à peu (BUDGET ms par image), sans
// figer le jeu ; en attendant, une boule de leur couleur, puis la version moins détaillée.
// Ils sont dessinés juste après le ciel et avant le monde (voir frame dans main.js) : devant le
// ciel, derrière tout le reste. Chacun a sa vraie profondeur (sinon les flancs de ses colonnes
// passeraient devant le dessus des autres), remise à zéro entre deux astres : leurs tailles
// apparentes sont faites à la main, seul l'ordre du plus loin au plus proche compte.
import * as THREE from 'three';
import { riftTexture, RIFT_NEAR as RIFT_SCENE } from './dim7.js?v=1.1.0-mx09tneh';
import { STAR, BODIES, BODY, LY, bodyPos, sunOf, sunNear, spinAngle, setOrigin, systemOf, onBodiesAdded, originAbs, isMaterialized } from './system.js?v=1.1.0-mx09tneh';
import { GAL_N, GX, GY_, GZ, GTYPE, TYPES, ARMFX } from './galaxie.js?v=1.1.0-mx09tneh';
import { STAR_TYPES, RS } from './customsys.js?v=1.1.0-mx09tneh';
// (au-delà, une planète n'est plus visible du tout : ni point, ni repère ; les étoiles, elles, se voient
// de partout : ce sont les seules étoiles du ciel, chacune celle d'un vrai système où l'on peut aller)
const SEE_MAX = 30 * LY;
// au-delà, une étoile (ou un trou noir) n'est plus qu'un point du fond du ciel, plus ou moins brillant
// selon son éclat et sa distance (en deçà : son modèle, sa lueur, voir starLook)
const STAR_FAR = 0.5 * LY;
import { makePlanet, preparePlanet } from './planetview.js?v=1.1.0-mx09tneh';
import { makeBlackHole } from './blackhole.js?v=1.1.0-mx09tneh';
import { NebulaLayer, makeProtoDisk } from './nebulae.js?v=1.1.0-mx09tneh';
import { update as stellarUpdate, state as SN, typeNow, fluxAt, snColor, preBurst, onStarChanged, LIGHT_DAYS } from './stellar.js?v=1.1.0-mx09tneh';
import { cometsOf, cometPos, cometActivity, variableOf, variables, varFactor, novaScan, novaeAt, flareBoost, impactNear, impactFlash, impactGlow } from './astro.js?v=1.1.0-mx09tneh';

const D = 200;       // distance (dans la scène) où sont posés les astres
const DOT = 0.004;   // rayon apparent (rad) sous lequel un astre n'est qu'un point lumineux
const ALL = [STAR, ...BODIES];
const BUDGET = 3;
const ROCKS = 48;
const ROUTES = 8;      // (lignes spatiales dessinées au plus)
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const STARS = ALL.filter((b) => b.kind === 'star');
// (un système de la Voie lactée fabriqué en s'en approchant : ses astres entrent dans les listes, et
// son étoile quitte la couche des 20 000 points, voir galaxyLayer)
const VIEWS = new Set();
onBodiesAdded((list) => {
  for (const b of list) { ALL.push(b); if (b.kind === 'star') STARS.push(b); }
  for (const v of VIEWS) v.bodiesAdded(list);
});
// Éclairs des sauts nédrolytiques (voir spaceflight.jumpFlashes) : visibles de loin, depuis le sol
const FLASH_MAX = 32;
const SAT_FAR = 5e5;  // (les satellites : vus à moins de 500 000 blocs)
const FLASH_NEAR = 3e6, FLASH_FAR = 3e7;
// Fissures de l'espace (laissées par la surcharge du saut, voir spaceflight.tear) : bien visibles de
// tout le système, plus rien au-delà de 1e11 blocs
const RIFT_MAX = 16, RIFT_NEAR = 2e8, RIFT_FAR = 1e11; // (pleine lumière jusqu'à 3 millions de blocs ; plus rien à 30 millions)
let glowTex = null;
function flashTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.55, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  glowTex = new THREE.CanvasTexture(c);
  glowTex.colorSpace = THREE.SRGBColorSpace;
  return glowTex;
}
// Une queue de comète : un ruban (4 coins) posé sur la sphère du ciel, de la tête (fine, brillante) au
// bout (large, pâle). Additif : elle s'ajoute au ciel.
function makeTail() {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12), 3));
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), 2));
  g.setIndex([0, 2, 1, 1, 2, 3]);
  const m = new THREE.ShaderMaterial({
    uniforms: { uC: { value: new THREE.Color() }, uK: { value: 0 }, uAir: AIR, uSkyGlow: SKYGLOW },
    vertexShader: 'varying vec2 vUv; varying vec3 vWp; void main() { vUv = uv; vWp = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: AIR_VERT.replace('varying vec3 vExt;', '') + `varying vec2 vUv; varying vec3 vWp; uniform vec3 uC; uniform float uK;
      void main() {
        float x = abs(vUv.x * 2.0 - 1.0), y = vUv.y;
        float a = pow(1.0 - y, 1.6) * (1.0 - smoothstep(0.15 + 0.6 * y, 1.0, x)) * smoothstep(0.0, 0.04, y + 0.02);
        gl_FragColor = vec4(uC * a * uK * airExt(vWp), 1.0);
      }`,
    transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, side: THREE.DoubleSide,
  });
  return new THREE.Mesh(g, m);
}
const _side = new THREE.Vector3(), _axis = new THREE.Vector3();
function setTail(m, H, T, wid, col, op) {
  const R = D * 0.975, p = m.geometry.getAttribute('position'), len = H.angleTo(T);
  _axis.copy(T).sub(H);
  _side.crossVectors(_axis, H).normalize();
  const w0 = R * Math.max(0.0015, len * wid * 0.12), w1 = R * Math.max(0.004, len * wid);
  p.setXYZ(0, H.x * R - _side.x * w0, H.y * R - _side.y * w0, H.z * R - _side.z * w0);
  p.setXYZ(1, H.x * R + _side.x * w0, H.y * R + _side.y * w0, H.z * R + _side.z * w0);
  p.setXYZ(2, T.x * R - _side.x * w1, T.y * R - _side.y * w1, T.z * R - _side.z * w1);
  p.setXYZ(3, T.x * R + _side.x * w1, T.y * R + _side.y * w1, T.z * R + _side.z * w1);
  p.needsUpdate = true;
  m.material.uniforms.uC.value.setRGB(col[0], col[1], col[2]);
  m.material.uniforms.uK.value = Math.min(1, op);
  m.visible = op > 0.01 && len > 0.002;
}
// La lueur d'un trou noir vu de loin : un halo chaud et la traînée de son disque d'accrétion (blanche :
// la couleur vient du matériau)
let holeTex = null;
function holeGlowTexture() {
  if (holeTex) return holeTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  let g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.08, 'rgba(255,255,255,0.85)');
  g.addColorStop(0.3, 'rgba(255,255,255,0.22)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 128, 128);
  // (le disque, presque vu par la tranche : une ellipse lumineuse très aplatie)
  x.save();
  x.translate(64, 64);
  x.scale(1, 0.12);
  g = x.createRadialGradient(0, 0, 0, 0, 0, 60);
  g.addColorStop(0, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.beginPath();
  x.arc(0, 0, 60, 0, Math.PI * 2);
  x.fill();
  x.restore();
  holeTex = new THREE.CanvasTexture(c);
  holeTex.colorSpace = THREE.SRGBColorSpace;
  return holeTex;
}
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// L'éclat d'une étoile vue d'ici : 1 à la distance d'Hexa à son étoile (un pulsar, minuscule, brille
// comme une vraie étoile : son rayonnement et ses jets)
const F0 = (STAR.R / BODY.hexa.orbit) ** 2;
// (vary : l'éclat du moment, 1 en moyenne : une étoile variable, une éruption, voir astro.js)
const relOf = (b, d) => (((b.pulsar ? STAR.R * 0.6 : b.R) / d) ** 2 / F0) * (b.vary ?? 1);
// la lumière qu'on en reçoit, telle que l'œil la perçoit (bien plus douce que la vraie loi en 1/d²)
const lightOf = (rel) => Math.min(1.5, Math.pow(rel, 0.3));

// ---------- L'air (au sol) ----------
// Vers l'horizon, la lumière traverse bien plus d'air (jusqu'à 30 fois plus) : les étoiles pâlissent et
// rougissent (l'air retient d'abord le bleu), puis disparaissent dans les derniers degrés. AIR : la
// quantité d'air (0 dans l'espace) ; SKYGLOW : le ciel éclairci par les lumières des villages (les
// étoiles faibles s'y perdent, surtout vers l'horizon). Partagés par tous les points et halos du ciel.
const AIR = { value: 0 }, SKYGLOW = { value: 0 };
const AIR_VERT = `
  uniform float uAir, uSkyGlow;
  varying vec3 vExt;
  vec3 airExt(vec3 wp) {
    if (uAir <= 0.0) return vec3(1.0);
    float y = normalize(wp - cameraPosition).y, yy = max(y, 0.0);
    float X = 1.0 / (yy + 0.035);
    return exp(-uAir * vec3(0.12, 0.17, 0.30) * max(X - 1.0, 0.0)) * (1.0 - uSkyGlow * exp(-yy * 4.0)) * smoothstep(-0.04, 0.0, y);
  }
`;
// (sprite : le centre du halo ; sinon chaque point)
function airify(mat, sprite = false) {
  if (mat.userData.air) return mat;
  mat.userData.air = true;
  const prev = mat.onBeforeCompile, key = mat.customProgramCacheKey?.() || '';
  mat.onBeforeCompile = (sh, r) => {
    prev?.(sh, r);
    sh.uniforms.uAir = AIR;
    sh.uniforms.uSkyGlow = SKYGLOW;
    sh.vertexShader = AIR_VERT + sh.vertexShader.replace('#include <fog_vertex>', `#include <fog_vertex>
  vExt = airExt((modelMatrix * vec4(${sprite ? 'vec3(0.0)' : 'position'}, 1.0)).xyz);`);
    sh.fragmentShader = 'varying vec3 vExt;\n' + sh.fragmentShader.replace('#include <fog_fragment>', '#include <fog_fragment>\n  gl_FragColor.rgb *= vExt;');
  };
  mat.customProgramCacheKey = () => key + '|air' + (sprite ? 's' : 'p');
  mat.needsUpdate = true;
  return mat;
}
const airSprite = (opts) => airify(new THREE.SpriteMaterial(opts), true);

// matériau d'un astre : pas de brouillard, dans la file des objets triés (voir update)
function farify(root) {
  root.traverse((m) => {
    if (!m.material) return;
    m.frustumCulled = false;
    for (const mat of [].concat(m.material)) {
      if (mat.userData.far) continue;
      mat.userData.far = true;
      mat.fog = false;
      mat.depthWrite = !mat.transparent; // (le sol oui ; pas les halos, les nuages, les anneaux)
      mat.transparent = true; // (tous dans la même file : dessinés du plus loin au plus proche)
      mat.needsUpdate = true;
    }
  });
}

// part du disque de rayon a cachée par un disque de rayon b dont le centre est à d (angles)
const relief = (alt, R) => Math.min(1, 0.1 + alt / (R * 0.3));

function overlap(a, b, d) {
  if (d >= a + b) return 0;
  if (d <= Math.abs(b - a)) return b >= a ? 1 : (b * b) / (a * a);
  const a2 = a * a, b2 = b * b;
  const k1 = Math.acos(Math.max(-1, Math.min(1, (d * d + a2 - b2) / (2 * d * a))));
  const k2 = Math.acos(Math.max(-1, Math.min(1, (d * d + b2 - a2) / (2 * d * b))));
  const area = a2 * k1 + b2 * k2 - 0.5 * Math.sqrt(Math.max(0, (-d + a + b) * (d + a - b) * (d - a + b) * (d + a + b)));
  return Math.min(1, area / (Math.PI * a2));
}

export class SystemView {
  // sample(b) : couleurs du terrain d'un astre (main.planetSample), seed : graine du monde
  constructor(sample) {
    this.sample = sample;
    this.scene = new THREE.Scene();
    this.light = new THREE.DirectionalLight(0xfff2dc, 2.2);
    this.scene.add(this.light, this.light.target, new THREE.AmbientLight(0x50586a, 0.15));
    // dans l'espace : la deuxième étoile la plus brillante (elle éclaire un peu, sans ombres)
    this.light2 = new THREE.DirectionalLight(0xffffff, 0);
    this.scene.add(this.light2, this.light2.target);
    this.lightK = 1;   // (force de la lumière de l'étoile, d'après sa distance : voir sky.siteUpdate)
    this.light2K = 0;
    this.lightColor = new THREE.Color(1, 1, 1);
    this.light2Color = new THREE.Color(1, 1, 1);
    this.glare = 0;    // (l'œil ébloui par l'étoile proche, de 0 à 1 : il s'y fait peu à peu)
    this._tA = 0;
    this.flareDir = new THREE.Vector3(); // (la direction de l'étoile qui éblouit, dans le monde : voir lensflare.js)
    this.flareColor = new THREE.Color();
    this.items = new Map(); // id -> { g (modèle), seed, detail, job, jobDetail }
    this.ball = new THREE.SphereGeometry(1, 20, 14);
    this.jobs = [];
    this._qi = new THREE.Quaternion();
    this._t = new THREE.Quaternion();
    this.dots = null;
    this.flashes = [];   // [{ x, y, z (absolu), size (fraction de D), k (éclat, 0 à 1), color }] : voir spaceflight.js
    this.flashSprites = [];
    this.rifts = [];     // [{ x, y, z (absolu), len (blocs), k (0 à 1 : elle se referme), rot }] : voir spaceflight.js
    this.riftSprites = [];
    // (un groupe dessiné après tous les astres : les modèles des astres sont des groupes triés entre eux)
    this.flashGroup = new THREE.Group();
    this.flashGroup.renderOrder = 9100;
    this.scene.add(this.flashGroup);
    this.on = false;
    this.eclipse = 0;
    this.seed = null;
    this._v = new THREE.Vector3();
    this._n = new THREE.Vector3();
    this._s = new THREE.Vector3();
    this._sunA = new THREE.Vector3();
    this._sunB = new THREE.Vector3();
    // (dans la file de dessin, avant chaque astre : on repart d'une profondeur vide)
    const blank = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3));
    const none = new THREE.MeshBasicMaterial({ transparent: true, colorWrite: false, depthWrite: false, fog: false });
    this._clear = () => {
      const c = new THREE.Mesh(blank, none);
      c.frustumCulled = false;
      c.onBeforeRender = (r) => { r.state.buffers.depth.setMask(true); r.clearDepth(); };
      this.scene.add(c);
      return c;
    };
    this.clears = [...ALL, null].map(this._clear);
    VIEWS.add(this);
    // (une étoile qui explose : son modèle est refait, voir stellar.js)
    onStarChanged((b) => {
      const it = this.items.get(b.id);
      if (it) { this.scene.remove(it.g); this.items.delete(b.id); this.jobs = this.jobs.filter((x) => x !== it); }
      this._lit = null;
    });
  }
  // des astres de plus (un système de la Voie lactée) : les listes et les couches de points grandissent
  bodiesAdded(list) {
    this._lit = null;
    for (let k = 0; k < list.length; k++) this.clears.push(this._clear());
    for (const p of [this.dots, ...(this.starDots || [])]) if (p) { this.scene.remove(p); p.geometry.dispose(); }
    this.dots = this.starDots = null;
    if (this.gal) this.gal.at = null;
  }

  // Les 20 000 étoiles de la Voie lactée (galaxie.js) qu'on n'a pas encore approchées : des points au
  // fond du ciel, à leur vraie place vue d'ici (recalculée quand on bouge : en saut, le ciel change),
  // plus ou moins brillants selon leur taille et leur distance. Vu d'un monde du disque, leur bande
  // fait le tour du ciel ; vers Sagittarius A*, le bulbe, plus dense.
  galaxyLayer() {
    if (this.gal) return this.gal;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(GAL_N * 3), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(GAL_N * 3), 3));
    const pts = (size) => {
      const p = new THREE.Points(g, airify(new THREE.PointsMaterial({ size, sizeAttenuation: false, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })));
      p.renderOrder = -3; // (tout au fond)
      farify(p);
      this.scene.add(p);
      return p;
    };
    // (les couleurs des types d'étoiles, et leur taille : leur éclat de loin)
    const col = TYPES.map((t) => new THREE.Color(STAR_TYPES[t].trou ? '#ffb070' : STAR_TYPES[t].couleur || '#ffffff'));
    const rad = TYPES.map((t) => (STAR_TYPES[t].pulsar ? STAR.R * 0.6 : STAR_TYPES[t].taille * RS));
    return (this.gal = { g, p: pts(1.6), col, rad, at: null });
  }
  placeGalaxy(O, o, surface, n, sx, sy, sz, sd) {
    const G = this.galaxyLayer(), A = originAbs(o.seed, this._ga ||= { x: 0, y: 0, z: 0 });
    // (l'observateur, compté depuis Hexa, en années-lumière)
    const x = (O.x + A.x) / LY, y = (O.y + A.y) / LY, z = (O.z + A.z) / LY;
    if (!G.at || Math.hypot(x - G.at.x, y - G.at.y, z - G.at.z) > 1e-3 || G.ver !== SN.version) {
      G.at = { x, y, z };
      G.ver = SN.version;
      const pa = G.g.getAttribute('position'), ca = G.g.getAttribute('color'), P = pa.array, C = ca.array;
      for (let i = 0; i < GAL_N; i++) {
        const dx = GX[i] - x, dy = GY_[i] - y, dz = GZ[i] - z, d = Math.hypot(dx, dy, dz) || 1, t = typeNow(i), j = i * 3;
        P[j] = (dx / d) * D; P[j + 1] = (dy / d) * D; P[j + 2] = (dz / d) * D;
        if (isMaterialized(i)) { C[j] = C[j + 1] = C[j + 2] = 0; continue; }
        const L = Math.log10(Math.max(1e-30, relOf({ R: G.rad[t] }, d * LY)));
        // (une autre galaxie, des millions d'années-lumière plus loin : ses étoiles, une à une invisibles,
        // font ensemble une tache pâle)
        const k = (d > 3e5 ? 0.0045 : 0.05 + 0.95 * smooth(-17.5, -9, L)) * (t === 10 ? 0.5 : 1), c = G.col[t];
        C[j] = (c.r * 0.45 + 0.55) * k; C[j + 1] = (c.g * 0.45 + 0.55) * k; C[j + 2] = (c.b * 0.45 + 0.55) * k;
      }
      pa.needsUpdate = ca.needsUpdate = true;
      (G.base ||= new Float32Array(C.length)).set(C);
      G.vt = -1;
    }
    // les étoiles variables (astro.js) : leur éclat, quatre fois par seconde (avec le retard de leur lumière)
    const nowT = performance.now();
    if (G.base && nowT - (G.vt ?? -1e9) > 250) {
      G.vt = nowT;
      const C = G.g.getAttribute('color').array, B = G.base, at = G.at;
      for (const i of variables()) {
        const j = i * 3;
        if (B[j] === 0 && B[j + 1] === 0) continue;
        const d = Math.hypot(GX[i] - at.x, GY_[i] - at.y, GZ[i] - at.z), f = Math.sqrt(Math.max(0.05, varFactor(variableOf(i), o.day - d * LIGHT_DAYS)));
        C[j] = B[j] * f; C[j + 1] = B[j + 1] * f; C[j + 2] = B[j + 2] * f;
      }
      G.g.getAttribute('color').needsUpdate = true;
    }
    // (au sol : le ciel tourne avec la course du soleil, comme les autres étoiles lointaines)
    const q = G.p.quaternion;
    if (surface && !o.local) {
      const e1 = this._v.set(sx / sd, sy / sd, sz / sd).clone(), e3 = new THREE.Vector3(0, 1, 0).addScaledVector(e1, -e1.y).normalize(), e2 = new THREE.Vector3().crossVectors(e3, e1);
      const f1 = o.sunPath(o.angle).clone().normalize(), f3 = n.clone().addScaledVector(f1, -n.dot(f1)).normalize(), f2 = new THREE.Vector3().crossVectors(f3, f1);
      const M = (this._gm ||= new THREE.Matrix4()).makeBasis(f1, f2, f3).multiply((this._gm2 ||= new THREE.Matrix4()).makeBasis(e1, e2, e3).transpose());
      q.setFromRotationMatrix(M);
    } else if (surface && o.local) q.copy(o.local);
    else q.identity();
    G.p.material.opacity = (1 - (o.daylight ?? 0) * 0.97) * (1 - 0.8 * this.glare);
    G.p.visible = G.p.material.opacity > 0.02;
    // les nébuleuses, avec le ciel lointain (pâles : de jour, on ne les voit pas)
    (this.neb ||= new NebulaLayer(this.scene)).update(G.at, q, (1 - Math.min(1, (o.daylight ?? 0) * 1.1)) * (1 - 0.7 * this.glare), D);
    this.placeArms(G.at, q, G.p.material.opacity);
    this.placeSupernovae(G.at, q, o.daylight ?? 0);
    this.placeNovae(G.at, q, o.daylight ?? 0, o.day);
  }

  // La couleur des bras (galaxie.ARMFX) : les amas d'étoiles bleues et les nuages roses d'hydrogène
  // ionisé, des lueurs douces, plus grosses et plus vives de près. Vus d'un monde du disque, ils
  // piquent la bande de la Voie lactée ; de loin, ils dessinent les bras.
  placeArms(at, q, opacity) {
    let A = this.arms;
    if (!A) {
      const mk = (size) => {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(ARMFX.n * 3), 3));
        g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(ARMFX.n * 3), 3));
        const p = new THREE.Points(g, airify(new THREE.PointsMaterial({ size, map: flashTexture(), sizeAttenuation: false, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })));
        p.renderOrder = -3;
        farify(p);
        this.scene.add(p);
        return p;
      };
      A = this.arms = { p: [mk(2.4), mk(4), mk(7)], at: null };
    }
    if (!A.at || A.at.x !== at.x || A.at.y !== at.y || A.at.z !== at.z) {
      A.at = { x: at.x, y: at.y, z: at.z };
      const n = [0, 0, 0], F = ARMFX;
      const P = A.p.map((p) => p.geometry.getAttribute('position').array), C = A.p.map((p) => p.geometry.getAttribute('color').array);
      for (let i = 0; i < F.n; i++) {
        const dx = F.X[i] - at.x, dy = F.Y[i] - at.y, dz = F.Z[i] - at.z, d = Math.hypot(dx, dy, dz);
        if (d < F.S[i] * 1.5) continue; // (dedans : on ne le voit pas comme une lueur)
        const ang = F.S[i] / d, lg = Math.log10(ang);
        const k = (F.K[i] ? 0.05 + 0.3 * smooth(-3, -1.3, lg) : 0.06 + 0.34 * smooth(-3, -1.3, lg)) / (1 + d / 6000);
        if (k < 0.03) continue;
        // (la taille du point : selon sa taille apparente)
        const L = lg > -1.6 ? 2 : lg > -2.4 ? 1 : 0, j = n[L]++ * 3;
        P[L][j] = (dx / d) * D; P[L][j + 1] = (dy / d) * D; P[L][j + 2] = (dz / d) * D;
        if (F.K[i]) { C[L][j] = 0.55 * k; C[L][j + 1] = 0.68 * k; C[L][j + 2] = 1 * k; }
        else { C[L][j] = 1 * k; C[L][j + 1] = 0.36 * k; C[L][j + 2] = 0.55 * k; }
      }
      A.p.forEach((p, L) => { const g = p.geometry; g.setDrawRange(0, n[L]); g.getAttribute('position').needsUpdate = g.getAttribute('color').needsUpdate = true; });
    }
    for (const p of A.p) { p.quaternion.copy(q); p.material.opacity = opacity * 0.7; p.visible = opacity > 0.02; }
  }

  // Les novae (astro.js) : une naine blanche qui explose à la surface, dans un couple serré. Un point
  // nouveau dans le ciel, quelques semaines (bleu-blanc, puis plus jaune en faiblissant)
  placeNovae(at, q, daylight, day) {
    novaScan(1200);
    let n = 0;
    const S = (this.novaSprites ||= []);
    this.novae = [];
    for (const a of novaeAt(day, at)) {
      const lg = Math.log10(Math.max(1e-30, a.f));
      const op = smooth(-17.5, -10, lg) * (1 - daylight * (1 - smooth(-7, -4, lg)));
      if (op < 0.02) continue;
      if (lg > -12.5) this.novae.push(a);
      let sp = S[n];
      if (!sp) {
        sp = new THREE.Sprite(airSprite({ map: flashTexture(), transparent: true, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, fog: false }));
        sp.frustumCulled = false;
        sp.renderOrder = -1;
        this.snGroup.add(sp);
        S[n] = sp;
      }
      const w = Math.min(1, a.te / 40);
      sp.material.color.setRGB(0.85 + 0.15 * w, 0.9 - 0.1 * w, 1 - 0.35 * w);
      sp.material.opacity = Math.min(1, op);
      sp.position.set(a.dx / a.d, a.dy / a.d, a.dz / a.d).multiplyScalar(D * 0.97);
      sp.scale.setScalar(D * Math.tan(0.005 + 0.02 * smooth(-12, -6, lg) + 0.2 * smooth(-5, 2, lg)) * 2);
      sp.visible = true;
      n++;
    }
    for (let i = n; i < S.length; i++) S[i].visible = false;
  }

  // Les supernovas (stellar.js) : une étoile nouvelle, à la place d'une étoile qui explose. Son éclat
  // suit celui de l'explosion (jusqu'à un milliard de soleils) : de loin, un point qui monte en quelques
  // heures puis s'efface en des mois ; assez près, visible en plein jour ; tout près, aveuglante.
  // Les jours d'avant, l'étoile instable a des sursauts.
  placeSupernovae(at, q, daylight) {
    if (!this.snGroup) { this.snGroup = new THREE.Group(); this.snGroup.renderOrder = -1; this.scene.add(this.snGroup); this.snSprites = []; }
    this.snGroup.quaternion.copy(q);
    let n = 0;
    const c = (this._snc ||= [1, 1, 1]);
    for (const a of SN.active) {
      const e = a.e, dx = e.x - at.x, dy = e.y - at.y, dz = e.z - at.z, d = Math.hypot(dx, dy, dz) || 1e-9;
      // (avant : rien que l'éclat en plus des sursauts de l'étoile)
      const L = a.pre ? STAR_TYPES[TYPES[GTYPE[e.i]]].eclat * (preBurst(a.dt, e.i) - 1) : a.L;
      const f = fluxAt({ e, L }, at), lg = Math.log10(Math.max(1e-30, f));
      let op = smooth(-13, -8, lg) * (1 - daylight * (1 - smooth(-6.5, -3.5, lg)));
      if (op < 0.01) continue;
      let sp = this.snSprites[n];
      if (!sp) {
        sp = new THREE.Sprite(airSprite({ map: flashTexture(), transparent: true, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, fog: false }));
        sp.frustumCulled = false;
        sp.renderOrder = -1;
        this.snGroup.add(sp);
        this.snSprites[n] = sp;
      }
      if (a.pre) c[0] = 1, c[1] = 0.75, c[2] = 0.55; else snColor(a.dt, c);
      sp.material.color.setRGB(c[0], c[1], c[2]);
      sp.material.opacity = Math.min(1, op);
      sp.position.set(dx / d, dy / d, dz / d).multiplyScalar(D * 0.97);
      const ang = 0.006 + 0.022 * smooth(-10, -5, lg) + 0.3 * smooth(-4, 3, lg);
      sp.scale.setScalar(D * Math.tan(Math.min(1.2, ang)) * 2);
      sp.visible = true;
      n++;
    }
    for (let i = n; i < this.snSprites.length; i++) this.snSprites[i].visible = false;
  }

  // Le disque (les jets, le cocon) d'une étoile qui naît : à sa vraie taille vue d'ici, tant qu'il en a une
  placeProto(b, dir, dist, surface, o, order) {
    let it = this.protos?.get(b.id);
    const P = b.proto, ext = P.rout;
    const ang = ext / Math.max(dist, 1);
    if (ang < 0.002) { if (it) it.visible = false; return; }
    if (!it) {
      it = makeProtoDisk(b);
      (this.protos ||= new Map()).set(b.id, it);
      this.scene.add(it);
    }
    const s = Math.min(D / dist, (0.6 * D) / (ext * it.userData.extent));
    it.visible = true;
    it.position.copy(dir).multiplyScalar(dist * s * 0.999);
    it.scale.setScalar(ext * s);
    it.quaternion.copy(it.userData.axis);
    if (surface) it.quaternion.premultiply(o.local || this.gal.p.quaternion);
    const k = Math.min(1, (ang - 0.002) / 0.01) * (surface ? 1 - Math.min(1, (o.daylight ?? 0) * 1.05) : 1);
    const spin = ((2 * Math.PI * o.day) / it.userData.period) % (2 * Math.PI * 1e4);
    for (const m of it.userData.mats) { m.uniforms.uK.value = k; m.uniforms.uSpin.value = spin; }
    it.traverse((m) => { if (m.material?.uniforms?.uK && !it.userData.mats.includes(m.material)) m.material.uniforms.uK.value = (m.material.userData.k0 ??= m.material.uniforms.uK.value) * k; });
    order.push([dist * 0.999, it]);
  }

  // Le modèle d'un astre (preparé peu à peu la première fois qu'il est assez grand pour être vu)
  // (detail : plus de cases pour un astre qui paraît grand)
  model(b, detail = 20) {
    let it = this.items.get(b.id);
    if (it?.seed !== this.seed) {
      if (it) this.scene.remove(it.g);
      it = { g: null, seed: this.seed, detail: 0, job: null, jobDetail: 0 };
      this.items.set(b.id, it);
      // (en attendant : une boule)
      const col = b.colors?.mid || b.bands?.[0] || b.color || '#888888';
      if (b.kind === 'hole') {
        it.g = makeBlackHole(b);
        farify(it.g);
        this.scene.add(it.g);
        return it.g;
      }
      it.g = new THREE.Group();
      it.g.add(new THREE.Mesh(this.ball, b.kind === 'star' ? new THREE.MeshBasicMaterial({ color: col }) : new THREE.MeshLambertMaterial({ color: col })));
      it.g.rotation.z = b.tilt || 0;
      farify(it.g);
      this.scene.add(it.g);
    }
    if (b.kind === 'hole') return it.g;
    if (b.kind === 'star') detail = 14;
    if (it.detail !== detail && it.jobDetail !== detail) {
      const opt = { lazySample: this.sample ? () => this.sample(b, this.seed) : null, detail, cacheKey: b.id + '|' + this.seed };
      it.jobDetail = detail;
      it.job = b.kind === 'star' ? null : preparePlanet(b, opt);
      if (!this.jobs.includes(it)) this.jobs.push(it);
      it.make = () => {
        const g = makePlanet(b, opt);
        // (une étoile : sa surface aplatie face à la caméra, comme son rayonnement, voir starfx.js)
        const fl = b.kind === 'star' && g.userData.surf?.userData?.uniforms?.uFlat; if (fl) fl.value = 1;
        farify(g);
        this.scene.remove(it.g);
        g.position.copy(it.g.position); g.scale.copy(it.g.scale); g.quaternion.copy(it.g.quaternion); g.visible = it.g.visible;
        this.scene.add(g);
        it.g = g;
        it.detail = detail;
      };
    }
    return it.g;
  }
  // Un peu de travail à chaque image
  work() {
    const it = this.jobs[0];
    if (!it) return;
    const end = performance.now() + BUDGET;
    while (performance.now() < end) {
      if (it.job && !it.job.next().done) continue;
      it.job = null;
      it.make();
      it.make = null;
      this.jobs.shift();
      return;
    }
  }

  // Les astéroïdes proches (dans une ceinture)
  rockLayer() {
    if (this.rockMesh) return this.rockMesh;
    const m = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }), ROCKS);
    m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(ROCKS * 3), 3);
    m.renderOrder = 9000;
    farify(m);
    this.scene.add(m);
    return (this.rockMesh = m);
  }
  placeRocks(list, O) {
    if (!list?.length && !this.rockMesh) return;
    const m = this.rockLayer(), v = this._v, mt = (this._mt ||= new THREE.Matrix4()), sc = (this._sc ||= new THREE.Vector3()), q0 = (this._q0 ||= new THREE.Quaternion()), c = (this._cc ||= new THREE.Color());
    let n = 0;
    for (const R of list || []) {
      if (n >= ROCKS) break;
      v.set(R.x - O.x, R.y - O.y, R.z - O.z);
      const d = v.length();
      if (d < 1) continue;
      const k = D / d;
      v.multiplyScalar(k);
      sc.set(R.rx * k, R.ry * k, R.rz * k);
      m.setMatrixAt(n, mt.compose(v, q0, sc));
      m.setColorAt(n, c.set(R.ice ? 0xc8dce8 : 0x8a8078));
      n++;
    }
    m.count = n;
    m.instanceMatrix.needsUpdate = true;
    m.instanceColor.needsUpdate = true;
  }

  // Les lignes spatiales (voir spaceflight.curveOf), de loin ; les astres passent devant
  placeRoutes(list, O) {
    if (!list?.length && !this.routes) return;
    if (!this.routes) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(ROUTES * 256 * 6), 3));
      const l = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x8fa3b8, transparent: true, opacity: 0.55, depthWrite: false, fog: false }));
      l.frustumCulled = false;
      l.renderOrder = -1;
      this.scene.add(l);
      this.routes = l;
    }
    const attr = this.routes.geometry.getAttribute('position'), arr = attr.array;
    const put = (P, k, n) => {
      const x = P[k] - O.x, y = P[k + 1] - O.y, z = P[k + 2] - O.z, d = Math.hypot(x, y, z), s = D / (d || 1);
      arr[n] = x * s; arr[n + 1] = y * s; arr[n + 2] = z * s;
      return d;
    };
    let n = 0;
    for (const c of (list || []).slice(0, ROUTES)) {
      for (let i = 0; i < 256; i++) {
        const a = put(c.pos, i * 3, n), b = put(c.pos, i * 3 + 3, n + 3);
        if (a > 4000 && b > 4000) n += 6; // (tout près : ce sont les vrais rails)
      }
    }
    this.routes.geometry.setDrawRange(0, n / 3);
    attr.needsUpdate = true;
  }

  // Les étoiles lointaines : deux couches de points (les plus brillantes, plus gros)
  starDotLayers() {
    if (this.starDots) return this.starDots;
    const n = ALL.length;
    this.starDots = [2, 3.2].map((size) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
      g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
      // (additif : une lueur qui s'ajoute au ciel ; de jour, elle s'y perd au lieu de faire un point sombre)
      const p = new THREE.Points(g, airify(new THREE.PointsMaterial({ size, sizeAttenuation: false, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })));
      p.renderOrder = -2; // (tout au fond : avant les astres)
      farify(p);
      this.scene.add(p);
      return p;
    });
    return this.starDots;
  }
  // L'éclat d'un point d'étoile, de 0 à 1 (L : log10 de son éclat, voir relOf ; même la plus lointaine
  // reste visible, faiblement)
  static starDotK(b, L) {
    const k = 0.22 + 0.78 * smooth(-16, -7.5, L);
    return b.kind === 'hole' ? k * 0.6 : k * (b.dim ?? 1) ** 0.5;
  }

  // Les points (astres lointains)
  dotLayer() {
    if (this.dots) return this.dots;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(ALL.length * 3), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(ALL.length * 3), 3));
    const p = new THREE.Points(g, airify(new THREE.PointsMaterial({ size: 2.6, sizeAttenuation: false, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }))); // (additif : voir starDotLayers)
    p.renderOrder = -1; // (avant les astres)
    farify(p);
    this.scene.add(p);
    return (this.dots = p);
  }

  // o : { seed, day (jours, avec la fraction), here (id de l'astre où l'on est) | at ({ x, y, z }
  //   absolu : dans l'espace), sunDir (au sol : direction du soleil de sky.js), angle, tilt,
  //   sunPath (angle, tilt) -> direction (au sol), daylight }
  // (moonInfo : la Lune de Hexa vue d'ici, { lit (part éclairée), waxing (croissante), y (hauteur) })
  // Rend la part de l'étoile cachée (éclipse), de 0 à 1.
  update(o) {
    this.on = true;
    this.work();
    AIR.value = o.here ? o.air ?? 1 : 0;
    SKYGLOW.value = o.here ? o.skyGlow ?? 0 : 0;
    if (o.seed !== this.seed) this.seed = o.seed;
    // (au sol : les positions se comptent depuis le centre du système de la planète, voir system.setOrigin)
    if (o.here && BODY[o.here]) setOrigin(systemOf(BODY[o.here]).id);
    const O = o.here ? bodyPos(o.here, o.day, o.seed) : o.at;
    const surface = !!o.here, K = surface ? 4 : 1;
    // l'astre qui éclaire cet endroit (l'étoile, ou le trou noir dans son système), vu d'ici
    let sun = surface ? sunOf(BODY[o.here]) : sunNear(O, o.day, o.seed);
    // dans l'espace : les deux étoiles les plus brillantes vues d'ici. La plus brillante éclaire et fait
    // les ombres, l'autre éclaire un peu ; entre deux étoiles, la lumière passe de l'une à l'autre
    // sans saut (près d'un trou noir : c'est lui, comme avant)
    let rel1 = 1, second = null;
    if (!surface) {
      const lit = (this._lit ||= STARS.map((b) => ({ b, P: { x: 0, y: 0, z: 0 }, rel: 0 })));
      for (const e of lit) { bodyPos(e.b.id, o.day, o.seed, e.P); e.rel = relOf(e.b, Math.max(1, Math.hypot(e.P.x - O.x, e.P.y - O.y, e.P.z - O.z))); }
      lit.sort((a, b) => b.rel - a.rel);
      if (sun.kind !== 'hole') { sun = lit[0].b; rel1 = lit[0].rel; second = lit[1] || null; } else second = lit[0];
    }
    const SP = bodyPos(sun.id, o.day, o.seed, this._sp ||= { x: 0, y: 0, z: 0 });
    const sx = SP.x - O.x, sy = SP.y - O.y, sz = SP.z - O.z, sd = Math.hypot(sx, sy, sz);
    const sLon = Math.atan2(sz, sx), sLat = Math.asin(sy / sd), sRad = Math.asin(Math.min(1, sun.R / sd));
    this.sunNow = sun; this.sunDistNow = sd; // (l'étoile d'ici et sa distance : les tempêtes, voir main.js)
    // au sol : le plan de la course du soleil
    let n = null;
    if (surface) {
      const a = o.sunPath(o.angle), b = o.sunPath(o.angle + Math.PI / 2);
      n = this._n.crossVectors(a, b).normalize();
      this.light.position.copy(o.sunDir);
    } else {
      // (sur une ligne spatiale, près d'un astre : encore son soleil à lui, voir spaceflight.js)
      this._sunA.set(sx / sd, sy / sd, sz / sd);
      if (o.sunK > 0) this._sunA.lerp(this._sunB.copy(o.sunLocal).applyQuaternion(o.frameQ), o.sunK).normalize();
      this.light.position.copy(this._sunA);
    }
    // l'œil s'habitue à l'éclat de l'étoile (quelques secondes) : C dans sky.siteUpdate, et les autres astres
    const now = performance.now(), dtA = Math.min(0.25, (now - (this._tA || now)) / 1000);
    this._tA = now;
    // (une supernova toute proche éblouit plus encore que l'étoile d'ici)
    const Ab = originAbs(o.seed, this._gb ||= { x: 0, y: 0, z: 0 }), at = (this.snAt ||= { x: 0, y: 0, z: 0 });
    at.x = (O.x + Ab.x) / LY; at.y = (O.y + Ab.y) / LY; at.z = (O.z + Ab.z) / LY;
    // (chaque supernova vue d'ici, avec le retard de sa lumière)
    stellarUpdate(o.seed, o.day, at);
    // (l'éclat du moment de chaque étoile proche : variable, éruption ; vu avec le retard de sa lumière)
    for (const b of STARS) {
      const v = b.gal !== undefined ? variableOf(b.gal) : null;
      const t = v ? o.day - Math.hypot(GX[b.gal] - at.x, GY_[b.gal] - at.y, GZ[b.gal] - at.z) * LIGHT_DAYS : o.day;
      b.vary = (v ? varFactor(v, t) : 1) * flareBoost(b, o.day);
    }
    let snF = 0;
    for (const a of SN.active) if (!a.pre) snF = Math.max(snF, fluxAt(a, at));
    this.snFlux = snF;
    const G = surface ? 0 : Math.max(sun.kind === 'hole' ? 0 : smooth(-4, 1, Math.log10(Math.max(1e-30, rel1))), smooth(-4, 1, Math.log10(Math.max(1e-30, snF))));
    this.glare += (G - this.glare) * (1 - Math.exp(-dtA * 1.2));
    this.lightK = surface || sun.kind === 'hole' ? 1 : lightOf(rel1);
    this.lightColor.set(sun.color || '#ffffff');
    this.light.color.set(surface ? 0xfff2dc : 0xffffff);
    if (!surface) this.light.color.lerp(this.lightColor, 0.35);
    if (second && second.b !== sun) {
      const P = second.P, d = Math.max(1, Math.hypot(P.x - O.x, P.y - O.y, P.z - O.z));
      this.light2.position.set((P.x - O.x) / d, (P.y - O.y) / d, (P.z - O.z) / d);
      this.light2K = lightOf(second.rel) * (second.b.dim ?? 1);
      this.light2Color.set(second.b.color || '#ffffff');
      this.light2.color.set(0xffffff).lerp(this.light2Color, 0.35);
    } else this.light2K = 0;
    this.light2.intensity = 2.2 * this.light2K;
    this.flareOn = false;
    this.light.target.position.set(0, 0, 0);
    // (dans une bulle : ses axes ; tout le reste s'y place)
    if (o.frameQ) this._qi.copy(o.frameQ).invert(); else this._qi.identity();
    this.scene.quaternion.copy(this._qi);
    this.placeRocks(surface ? null : o.rocks, O);
    this.placeRoutes(surface ? null : o.routes, O);
    this.placeGalaxy(O, o, surface, n, sx, sy, sz, sd);
    const dots = this.dotLayer(), dp = dots.geometry.getAttribute('position'), dc = dots.geometry.getAttribute('color');
    const SD = this.starDotLayers(), sdn = [0, 0];
    let nd = 0, ecl = 0;
    // (au sol, dans un système double : l'autre étoile du ciel, la plus brillante. sky.js lui donne sa
    // lumière et sa propre ombre ; k : son éclat sur celui du soleil d'ici)
    let s2k = 0, s2b = null;
    const s2 = (this._s2 ||= new THREE.Vector3()), sunRel = (sun.lum ?? 1) / (sd * sd), P2 = (this._P2 ||= { x: 0, y: 0, z: 0 });
    this.starEclipse = null;
    this.moonInfo = null;
    const order = [];
    if (this.holeGlows) for (const s of this.holeGlows.values()) s.visible = false;
    for (const b of ALL) {
      if (b.id === o.here) {
        // tout en haut du ciel : la planète, ronde, sous nos pieds
        if (!o.below) { this.hideModel(b.id); continue; }
        const dist = b.R + o.below.alt, g = this.model(b, 36), k = D / dist;
        g.visible = true;
        g.position.set(0, -dist * k, 0);
        g.scale.setScalar(b.R * k);
        g.quaternion.copy(this._t.copy(o.below.Q).invert());
        if (b.tilt) g.quaternion.multiply(this._t.setFromAxisAngle(this._s.set(0, 0, 1), b.tilt));
        if (b.locked) g.quaternion.multiply(this._t.setFromAxisAngle(Y_AXIS, spinAngle(b, o.day, o.seed)));
        g.userData.update?.(0.016, this._s.copy(this.light.position).normalize(), relief(o.below.alt, b.R));
        order.push([0, g]);
        continue;
      }
      if (o.hide && o.hide.has(b.id)) { this.hideModel(b.id); continue; }
      let dir, dist, ang;
      if (b === sun) {
        dist = sd; ang = sRad;
        dir = surface ? this._v.copy(o.sunDir) : this._v.copy(this._sunA);
      } else {
        const P = bodyPos(b.id, o.day, o.seed, this._p2 ||= { x: 0, y: 0, z: 0 });
        const vx = P.x - O.x, vy = P.y - O.y, vz = P.z - O.z;
        P2.x = vx; P2.y = vy; P2.z = vz;
        dist = Math.hypot(vx, vy, vz);
        const lamp = b.kind === 'star' || b.kind === 'hole';
        if (dist > SEE_MAX && !lamp) { this.hideModel(b.id); continue; }
        ang = Math.asin(Math.min(1, b.R / dist));
        if (surface && !o.local) {
          const lon = Math.atan2(vz, vx), lat = Math.asin(vy / dist);
          let dl = lon - sLon;
          dl = Math.atan2(Math.sin(dl), Math.cos(dl));
          const dlat = lat - sLat;
          dir = this._v.copy(o.sunPath(o.angle - dl)).multiplyScalar(Math.cos(dlat)).addScaledVector(n, Math.sin(dlat)).normalize();
          if (b.id === 'lune') {
            const c = Math.max(-1, Math.min(1, dir.dot(o.sunDir)));
            this.moonInfo = { lit: (1 - c) / 2, waxing: Math.sin(dl) > 0, y: dir.y };
          }
          // devant l'étoile ? (plus près qu'elle)
          if (dist < sd) ecl = Math.max(ecl, overlap(sRad, ang, Math.hypot(dl * Math.cos(sLat), dlat)));
        } else {
          dir = this._v.set(vx / dist, vy / dist, vz / dist);
          if (dist < sd) {
            const c = (vx * sx + vy * sy + vz * sz) / (dist * sd);
            ecl = Math.max(ecl, overlap(sRad, ang, Math.acos(Math.max(-1, Math.min(1, c)))));
          }
          if (o.local) dir.applyQuaternion(o.local); // (planète synchrone : les vraies directions)
        }
      }
      let asSun = b === sun;
      if (surface && b !== sun && b.kind === 'star') {
        let k = ((b.lum ?? 1) / (dist * dist) / Math.max(1e-300, sunRel)) * (b.dim ?? 1) * (b.vary ?? 1);
        // (derrière le soleil d'ici : la part de son disque cachée ne nous éclaire plus, une éclipse)
        if (dist > sd) {
          const sep = !o.local ? Math.acos(Math.max(-1, Math.min(1, dir.dot(o.sunDir)))) : Math.acos(Math.max(-1, Math.min(1, (P2.x * sx + P2.y * sy + P2.z * sz) / (dist * sd))));
          const hid = overlap(ang, sRad, sep);
          if (hid > 0) { k *= 1 - hid; if (hid > 0.2 && dir.y > 0) this.starEclipse = { b, hid }; } // (annoncée si on la voit : au-dessus de l'horizon)
        }
        if (k > s2k) { s2k = k; s2b = b; s2.copy(dir); }
        asSun = k > 0.02; // (assez proche : un deuxième soleil, pas une étoile du fond du ciel)
      }
      if (b.proto) this.placeProto(b, dir, dist, surface, o, order);
      // un trou noir : son modèle tant qu'il a une taille, puis sa lueur (même tout au fond du ciel)
      if (b.kind === 'hole') { this.placeHole(b, dir, dist, ang, surface, o, order); continue; }
      // une étoile lointaine : un point du fond du ciel
      if (b !== sun && (b.kind === 'star' || b.kind === 'hole') && dist > STAR_FAR) {
        this.hideModel(b.id);
        const L = Math.log10(Math.max(1e-30, relOf(b, dist)));
        const k = SystemView.starDotK(b, L) * (1 - (o.daylight ?? 0) * 0.95) * (1 - 0.75 * this.glare);
        if (k < 0.02) continue;
        const big = L > -11.5 ? 1 : 0, at = SD[big].geometry, i = sdn[big]++;
        at.getAttribute('position').setXYZ(i, dir.x * D, dir.y * D, dir.z * D);
        const c = (this._sc2 ||= new THREE.Color()).set(b.kind === 'hole' ? (b.disk || b.color || '#ffb070') : b.color || '#ffffff');
        // (de loin, la couleur se voit à peine : surtout du blanc, teinté)
        at.getAttribute('color').setXYZ(i, (c.r * 0.45 + 0.55) * k, (c.g * 0.45 + 0.55) * k, (c.b * 0.45 + 0.55) * k);
        continue;
      }
      // (un trou noir n'est pas agrandi autant : on le verrait de bien trop près)
      const r = Math.min(1.3, ang * (surface && b.kind === 'hole' ? 1.5 : K));
      if (r < DOT && b !== sun && b.kind !== 'star') {
        // un point : visible la nuit (ou quand l'air est rare)
        this.hideModel(b.id);
        const k = (1 - (o.daylight ?? 0) * 0.95) * Math.min(1, 0.35 + r / DOT) * (1 - 0.7 * this.glare);
        if (k < 0.02) continue;
        dp.setXYZ(nd, dir.x * D, dir.y * D, dir.z * D);
        const c = new THREE.Color(b.colors?.mid || b.color || '#ffffff');
        dc.setXYZ(nd, c.r * k + 0.15 * k, c.g * k + 0.15 * k, c.b * k + 0.15 * k);
        nd++;
        continue;
      }
      const g = this.model(b, r > 0.5 ? 36 : r > 0.12 ? 28 : 20);
      g.visible = true;
      g.quaternion.setFromAxisAngle(this._s.set(0, 0, 1), b.tilt || 0);
      if (b.locked) g.quaternion.multiply(this._t.setFromAxisAngle(Y_AXIS, spinAngle(b, o.day, o.seed)));
      if (surface && o.local) g.quaternion.premultiply(o.local);
      g.userData.setDist?.(dist / b.R);
      g.position.copy(dir).multiplyScalar(D);
      // (au sol : agrandi ; dans l'espace : à sa vraie taille, même tout près)
      g.scale.setScalar(surface ? D * Math.tan(Math.max(r, DOT)) : Math.max(b.R * (D / dist), D * DOT));
      g.userData.update?.(0.016, this._s.copy(this.light.position).normalize().applyQuaternion(this._qi), relief(dist - b.R, b.R));
      if (g.userData.glow) this.starLook(g, b, asSun, surface, dist, ang, o.daylight ?? 0);
      if (g.userData.beamLook) {
        // (pulsar : ses faisceaux à leur vraie taille, pas agrandis avec l'étoile ; trop petits pour
        // être vus de si loin, ils s'effacent : il ne reste que le flash quand ils passent sur nous)
        const real = (b.R * D) / dist, len = real * 420;
        g.userData.beamLook(Math.min(1, real / g.scale.x), Math.min(1, len / 6) * (surface ? 1 - (o.daylight ?? 0) * 0.9 : 1));
      }
      if (!surface && b === sun) { this.flareOn = true; this.flareDir.copy(dir).applyQuaternion(this._qi); this.flareColor.set(b.color || '#ffffff'); }
      order.push([dist, g]);
    }
    // les éclairs des sauts (et les vaisseaux en saut, des points qui filent)
    this.placeFlashes(O, this._dirOf = (vx, vy, vz, dist) => {
      if (surface && !o.local) {
        const lon = Math.atan2(vz, vx), lat = Math.asin(vy / dist);
        let dl = lon - sLon;
        dl = Math.atan2(Math.sin(dl), Math.cos(dl));
        return this._v.copy(o.sunPath(o.angle - dl)).multiplyScalar(Math.cos(lat - sLat)).addScaledVector(n, Math.sin(lat - sLat)).normalize();
      }
      const d = this._v.set(vx / dist, vy / dist, vz / dist);
      return surface && o.local ? d.applyQuaternion(o.local) : d;
    }, surface ? o.daylight ?? 0 : 0, K);
    this.placeRifts(O, this._dirOf, surface ? o.daylight ?? 0 : 0, K);
    this.placeComets(O, o, sun, this._dirOf, surface ? o.daylight ?? 0 : 0);
    this.placeImpacts(O, o, this._dirOf, surface ? o.daylight ?? 0 : 0);
    this.placeSats(surface ? null : O, o);
    // les plus loin d'abord (pas d'écriture de profondeur)
    order.sort((a, b) => b[0] - a[0]);
    order.forEach(([, g], i) => g.traverse((m) => { m.renderOrder = i * 4 + (m.renderOrder % 4 || 0); }));
    this.clears.forEach((c, i) => { c.visible = i <= order.length; c.renderOrder = i < order.length ? i * 4 - 0.5 : 8999.5; });
    dp.needsUpdate = dc.needsUpdate = true;
    dots.geometry.setDrawRange(0, nd);
    SD.forEach((p, i) => { const g = p.geometry; g.getAttribute('position').needsUpdate = g.getAttribute('color').needsUpdate = true; g.setDrawRange(0, sdn[i]); });
    // (éclipse : la lumière de l'étoile baisse aussi pour les astres)
    this.sun2 = s2b && s2k > 0.002 ? { b: s2b, k: s2k, dir: s2, color: s2b.color || '#ffffff' } : null;
    this.sunDim = sun.dim ?? 1;
    // (au sol, la nuit : l'œil s'habitue au noir, la lune et les planètes éclairées brillent)
    const night = surface ? 1 + 3 * (1 - Math.min(1, o.daylight ?? 1)) : 1;
    this.light.intensity = 2.2 * (1 - ecl) * this.sunDim * night * this.lightK;
    this.eclipse = ecl;
    return ecl;
  }

  // Une étoile vue d'ici (A) : de loin, un point net de sa couleur ; en approchant, il brille de plus
  // en plus, prend une lueur et des aigrettes ; tout près, son vrai rayonnement, puis sa surface.
  // Tout suit son éclat (sa taille et sa distance) : rien n'apparaît d'un coup.
  starLook(g, b, isSun, surface, dist, ang, daylight) {
    const glow = g.userData.glow, u = glow.userData.uniforms, surf = g.userData.surf;
    if (surface && isSun) { u.uSize.value = g.userData.glowSize; u.uOpacity.value = 1; surf.scale.setScalar(1); return; }
    const L = Math.log10(Math.max(1e-30, relOf(b, dist)));
    const th = Math.max(0.0035 + 0.05 * smooth(-10, -1, L), ang * g.userData.glowSize * smooth(-2.5, -0.5, L));
    u.uSize.value = Math.max(1.05, (D * Math.tan(Math.min(1.2, th))) / g.scale.x);
    let op = smooth(-13.5, -6, L);
    if (!isSun) op *= 1 - 0.75 * this.glare; // (C : ébloui par l'étoile proche, on voit moins les autres)
    if (surface) op *= 1 - daylight * 0.95;
    u.uOpacity.value = op;
    surf.scale.setScalar(Math.max(1e-3, smooth(-13.5, -8, L) * (surface ? 1 - daylight * 0.9 : 1)));
    g.visible = op > 0.003;
  }

  // Un trou noir vu d'ici. Son modèle (blackhole.js) à sa vraie taille apparente (au sol : agrandi
  // 1,5 fois), jamais grossi au-delà : grossi, il gardait la même taille de très près à très loin, et le
  // bord de sa sphère de rayons faisait un cercle autour de lui. Quand son disque n'a plus que quelques
  // pixels, il s'efface ; une lueur chaude prend le relais, avec la traînée de son disque : de plus en
  // plus petite et pâle au loin, mais toujours visible (c'est un repère, comme les étoiles).
  placeHole(b, dir, dist, ang, surface, o, order) {
    const day = o.daylight ?? 0;
    const a = surface ? Math.min(1.3, ang * 1.5) : ang; // (rayon apparent de l'horizon)
    // (rayon apparent du disque : 11 fois celui de l'horizon ; de 0,012 rad à 0,03 rad, 9 à 23 pixels)
    const mk = smooth(0.012, 0.03, a * 11);
    if (mk > 0) {
      const g = this.model(b);
      g.visible = true;
      g.quaternion.setFromAxisAngle(this._s.set(0, 0, 1), b.tilt || 0);
      if (surface && o.local) g.quaternion.premultiply(o.local);
      g.userData.setDist?.(dist / b.R);
      g.userData.setFade?.(mk);
      g.position.copy(dir).multiplyScalar(D);
      g.scale.setScalar(surface ? D * Math.tan(a) : b.R * (D / dist));
      g.userData.update?.(0.016);
      order.push([dist, g]);
    } else this.hideModel(b.id);
    // la lueur : x, l'éloignement (log10, en rayons de l'horizon)
    const x = Math.log10(Math.max(1, dist / b.R));
    const k = (1 - mk) * (0.45 + 0.55 * smooth(10, 3.5, x)) * (1 - day * 0.95) * (1 - 0.6 * this.glare);
    if (k < 0.02) return;
    this.holeGlows ||= new Map();
    let s = this.holeGlows.get(b.id);
    if (!s) {
      s = new THREE.Sprite(new THREE.SpriteMaterial({ map: holeGlowTexture(), color: b.disk || b.color || '#ffb070', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, fog: false }));
      s.renderOrder = -1; // (avec les points : avant les astres)
      farify(s);
      this.scene.add(s);
      this.holeGlows.set(b.id, s);
    }
    s.visible = true;
    s.position.copy(dir).multiplyScalar(D);
    // (taille : 0,055 rad tout près du relais, 0,016 rad au loin)
    s.scale.setScalar(D * Math.tan(0.016 + 0.039 * smooth(9.5, 3.5, x)) * 2);
    s.material.opacity = Math.min(1, k * 1.3);
    s.material.rotation = b.tilt || 0;
  }

  hideModel(id) {
    const it = this.items.get(id);
    if (it) it.g.visible = false;
  }

  // dirOf(vx, vy, vz, dist) : la direction dans ce ciel d'un point absolu (à vx, vy, vz d'ici)
  // (K : les astres sont grossis K fois au sol ; un éclair près d'un astre s'en écarte d'autant)
  placeFlashes(O, dirOf, daylight, K) {
    let n = 0;
    const k1 = f => (f.rx !== undefined ? K - 1 : 0);
    for (const f of this.flashes) {
      if (n >= FLASH_MAX) break;
      const e = k1(f), vx = f.x + (f.rx || 0) * e - O.x, vy = f.y + (f.ry || 0) * e - O.y, vz = f.z + (f.rz || 0) * e - O.z, dist = Math.hypot(vx, vy, vz);
      if (dist < 1 || dist > FLASH_FAR) continue;
      const far = dist < FLASH_NEAR ? 1 : 1 - Math.log(dist / FLASH_NEAR) / Math.log(FLASH_FAR / FLASH_NEAR);
      const k = f.k * far * (1 - daylight * 0.55);
      if (k < 0.02) continue;
      let sp = this.flashSprites[n];
      if (!sp) {
        sp = new THREE.Sprite(airSprite({ map: flashTexture(), color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, fog: false }));
        sp.frustumCulled = false;
        this.flashGroup.add(sp);
        this.flashSprites[n] = sp;
      }
      const dir = dirOf(vx, vy, vz, dist);
      sp.position.copy(dir).multiplyScalar(D * 0.97);
      sp.scale.setScalar(D * f.size * (0.6 + 0.4 * far));
      sp.material.color.set(f.color || '#e6dcff');
      sp.material.opacity = Math.min(1, k);
      sp.visible = true;
      n++;
    }
    for (let i = n; i < this.flashSprites.length; i++) this.flashSprites[i].visible = false;
  }

  // Les satellites de cartographie (this.sats, voir satellites.js), dans l'espace : un petit point qui
  // clignote, caché derrière sa planète ; seulement d'assez près (moins de SAT_FAR)
  placeSats(O, o) {
    const list = O && this.sats?.list.length ? this.sats.positions(bodyPos, o.day, o.seed) : [];
    const S = (this.satSprites ||= []), t = performance.now() / 1000;
    let n = 0;
    for (const s of list) {
      if (n >= 64) break;
      const vx = s.x - O.x, vy = s.y - O.y, vz = s.z - O.z, dist = Math.hypot(vx, vy, vz);
      if (dist < 2 || dist > SAT_FAR) continue;
      // (derrière la planète : caché)
      const b = BODY[this.sats.list.find((x) => x.id === s.id)?.b], C = b && bodyPos(b.id, o.day, o.seed, this._sc ||= { x: 0, y: 0, z: 0 });
      if (C) {
        const cx = C.x - O.x, cy = C.y - O.y, cz = C.z - O.z, tt = (cx * vx + cy * vy + cz * vz) / dist;
        if (tt > 0 && tt < dist && cx * cx + cy * cy + cz * cz - tt * tt < b.R * b.R) continue;
      }
      let sp = S[n];
      if (!sp) {
        sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: flashTexture(), color: 0xbfefff, transparent: true, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, fog: false }));
        sp.frustumCulled = false;
        sp.renderOrder = 9050;
        this.flashGroup.add(sp);
        S[n] = sp;
      }
      const far = 1 - Math.log(Math.max(1, dist / 2000)) / Math.log(SAT_FAR / 2000);
      sp.position.set(vx / dist, vy / dist, vz / dist).multiplyScalar(D * 0.96);
      sp.scale.setScalar(D * (0.012 + 0.01 * Math.max(0, far)));
      sp.material.opacity = Math.max(0.25, far) * (0.55 + 0.45 * Math.max(0, Math.sin(t * 5 + s.id * 1.7)));
      sp.visible = true;
      n++;
    }
    for (let i = n; i < S.length; i++) S[i].visible = false;
  }

  // Les fissures : une déchirure lumineuse, à sa vraie taille de près (jamais moins qu'un trait fin
  // de loin), qui rétrécit et pâlit en se refermant
  placeRifts(O, dirOf, daylight, K) {
    let n = 0;
    for (const f of this.rifts) {
      if (n >= RIFT_MAX) break;
      const e = f.rx !== undefined ? K - 1 : 0, vx = f.x + (f.rx || 0) * e - O.x, vy = f.y + (f.ry || 0) * e - O.y, vz = f.z + (f.rz || 0) * e - O.z, dist = Math.hypot(vx, vy, vz);
      if (dist < RIFT_SCENE || dist > RIFT_FAR) continue; // (tout près : un objet de la scène, voir dim7.js)
      const far = dist < RIFT_NEAR ? 1 : 1 - Math.log(dist / RIFT_NEAR) / Math.log(RIFT_FAR / RIFT_NEAR);
      const k = f.k * far * (1 - daylight * 0.5);
      if (k < 0.02) continue;
      let sp = this.riftSprites[n];
      if (!sp) {
        sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: riftTexture(), color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, fog: false }));
        sp.frustumCulled = false;
        sp.renderOrder = 9100;
        this.scene.add(sp);
        this.riftSprites[n] = sp;
      }
      const dir = dirOf(vx, vy, vz, dist), ang = Math.min(1.2, Math.max(0.03, (f.len * f.k) / dist));
      sp.position.copy(dir).multiplyScalar(D * 0.96);
      // (elle tremble un peu, et se rétrécit en largeur plus vite qu'en longueur)
      const h = D * ang * (0.97 + Math.random() * 0.06);
      sp.scale.set(h * 0.25 * (0.4 + 0.6 * f.k), h, 1);
      sp.material.rotation = f.rot;
      sp.material.opacity = Math.min(1, k * (0.85 + Math.random() * 0.15));
      sp.visible = true;
      n++;
    }
    for (let i = n; i < this.riftSprites.length; i++) this.riftSprites[i].visible = false;
  }

  // Les comètes du système d'ici (astro.js) : la chevelure (un point flou), la queue d'ions (droite,
  // bleue, à l'opposé de l'étoile) et la queue de poussière (plus large, jaunâtre, courbée vers
  // l'arrière de sa route). À leur vraie place et leur vraie taille apparente : de près, elles
  // traversent le ciel ; de loin, un petit trait.
  placeComets(O, o, sun, dirOf, daylight) {
    const list = sun.kind === 'star' ? cometsOf(systemOf(sun).id, o.seed, sun.lum ?? 1) : [];
    const S = (this.cometFx ||= []), C = bodyPos(sun.id, o.day, o.seed, this._cc ||= { x: 0, y: 0, z: 0 });
    let n = 0;
    this.comets = [];
    for (const c of list) {
      const p = cometPos(c, o.day, this._cp ||= { x: 0, y: 0, z: 0, r: 0 }), act = cometActivity(p.r);
      if (act < 0.02) continue;
      const q = cometPos(c, o.day + 0.5, this._cq ||= { x: 0, y: 0, z: 0, r: 0 });
      const hx = C.x + p.x - O.x, hy = C.y + p.y - O.y, hz = C.z + p.z - O.z, hd = Math.hypot(hx, hy, hz);
      if (hd < 1e5) continue;
      // (vue d'ici : plus loin, plus pâle ; la queue, en 1/r² de l'étoile)
      const dAU = hd / 6.6e7, k = Math.min(1, (act * 0.9) / Math.max(0.05, dAU) ** 1.2) * (1 - daylight * 0.97);
      if (k < 0.02) continue;
      this.comets.push({ c, dAU, r: p.r, k });
      let fx = S[n];
      if (!fx) {
        fx = { head: new THREE.Sprite(airSprite({ map: flashTexture(), transparent: true, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, fog: false })), ion: makeTail(), dust: makeTail() };
        for (const m of [fx.dust, fx.ion, fx.head]) { m.frustumCulled = false; m.renderOrder = -1; this.scene.add(m); }
        S[n] = fx;
      }
      const ux = p.x / (p.r * c.sc * 6.6e7), uy = p.y / (p.r * c.sc * 6.6e7), uz = p.z / (p.r * c.sc * 6.6e7); // (à l'opposé de l'étoile)
      let vx = q.x - p.x, vy = q.y - p.y, vz = q.z - p.z;
      const vl = Math.hypot(vx, vy, vz) || 1; vx /= vl; vy /= vl; vz /= vl;
      const H = (this._ch ||= new THREE.Vector3()).copy(dirOf(hx, hy, hz, hd));
      const L = Math.min(1.2, act) * 0.35 * 6.6e7 * (c.great ? 1.6 : 1);
      const put = (m, len, bend, wid, col, op) => {
        const tx = hx + (ux - vx * bend) * len, ty = hy + (uy - vy * bend) * len, tz = hz + (uz - vz * bend) * len, td = Math.hypot(tx, ty, tz);
        const T = (this._ct ||= new THREE.Vector3()).copy(dirOf(tx, ty, tz, td));
        // (jamais plus de 70° de ciel)
        const ang = H.angleTo(T);
        if (ang > 1.2) T.lerp(H, 1 - 1.2 / ang).normalize();
        setTail(m, H, T, wid, col, op);
      };
      put(fx.ion, L * 1.3, 0, 0.1, [0.55, 0.75, 1], k * 0.7);
      put(fx.dust, L, 0.45, 0.28, [1, 0.93, 0.78], k * 0.85);
      fx.head.position.copy(H).multiplyScalar(D * 0.975);
      fx.head.scale.setScalar(D * Math.min(0.05, 0.006 + (0.004 * act) / Math.max(0.05, dAU)));
      fx.head.material.color.setRGB(0.8, 0.95, 1);
      fx.head.material.opacity = Math.min(1, k * 1.3);
      fx.head.visible = true;
      n++;
    }
    for (let i = n; i < S.length; i++) S[i].head.visible = S[i].ion.visible = S[i].dust.visible = false;
  }

  // Les impacts d'astéroïdes (astro.js) sur les planètes et les lunes proches : l'éclair, puis la lueur
  // rouge de la roche fondue (quelques jours). Seulement du côté tourné vers nous.
  placeImpacts(O, o, dirOf, daylight) {
    const S = (this.impactSprites ||= []);
    let n = 0;
    this.impactSeen = null;
    for (const b of ALL) {
      if (n >= 8) break;
      if (b.kind === 'star' || b.kind === 'hole' || b.id === o.here || !b.R) continue;
      const I = impactNear(b, o.day, o.seed);
      if (!I) continue;
      const P = bodyPos(b.id, o.day, o.seed, this._ip ||= { x: 0, y: 0, z: 0 });
      const cl = Math.cos(I.lat), nx = cl * Math.cos(I.lon), ny = Math.sin(I.lat), nz = cl * Math.sin(I.lon);
      const vx = P.x + nx * b.R - O.x, vy = P.y + ny * b.R - O.y, vz = P.z + nz * b.R - O.z, dist = Math.hypot(vx, vy, vz);
      if (dist > 4e8 || nx * vx + ny * vy + nz * vz > 0) continue; // (trop loin, ou de l'autre côté)
      const fl = impactFlash(I.age), gl = impactGlow(I.age), far = Math.min(1, 3e6 / dist) ** 0.35;
      const k = Math.max(fl, gl * 0.7) * far * (1 - daylight * 0.8);
      if (k < 0.03) continue;
      if (fl > 0 || gl > 0.3) this.impactSeen = { b, I };
      let sp = S[n];
      if (!sp) {
        sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: flashTexture(), transparent: true, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, fog: false }));
        sp.frustumCulled = false;
        sp.renderOrder = 9050;
        this.flashGroup.add(sp);
        S[n] = sp;
      }
      const dir = dirOf(vx, vy, vz, dist);
      sp.position.copy(dir).multiplyScalar(D * 0.96);
      // (la vraie taille de la zone fondue, mais jamais moins qu'un point)
      const size = Math.max(0.006, Math.min(0.2, ((fl > 0 ? 900 : 260) * I.k) / dist * 50));
      sp.scale.setScalar(D * size);
      if (fl > gl * 0.7) sp.material.color.setRGB(1, 0.97, 0.9);
      else sp.material.color.setRGB(1, 0.35 + 0.3 * gl, 0.12 * gl);
      sp.material.opacity = Math.min(1, k);
      sp.visible = true;
      n++;
    }
    for (let i = n; i < S.length; i++) S[i].visible = false;
  }

  hide() { this.on = false; }

  render(renderer, camera) {
    if (!this.on) return;
    // (les astres sont autour de la caméra : sa position telle que la voit la carte graphique, près
    // de zéro, voir origin.js ; pas celle du monde, qui peut valoir des dizaines de milliards)
    this.scene.position.setFromMatrixPosition(camera.matrixWorld);
    const ac = renderer.autoClear;
    renderer.autoClear = false;
    renderer.render(this.scene, camera);
    renderer.autoClear = ac;
  }
}
