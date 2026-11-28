// Les nébuleuses et les étoiles qui naissent, dessinées dans le ciel (voir galaxie.js : le catalogue,
// skyview.js : le ciel).
//
// Une nébuleuse est un volume : on la traverse. Chacune est une sphère dont le shader suit le regard
// à travers elle (40 pas), en cumulant la lumière du gaz qui brille et en retirant celle que la
// poussière arrête. Le gaz et la poussière viennent d'un bruit 3D (une texture de 64³, calculée une
// fois) : déformé par lui-même pour faire des filaments, il n'est jamais le même d'une nébuleuse à
// l'autre (chacune a sa graine, son étirement, son orientation). Vue de loin, elle garde sa vraie
// taille apparente ; de l'intérieur, on la voit tout autour de soi.
// Les couleurs sont celles des vraies raies d'émission : le rouge de l'hydrogène (Hα, 656 nm), le
// bleu-vert de l'oxygène ionisé ([O III], 501 nm, au cœur le plus chaud), le bleu de la poussière qui
// diffuse la lumière d'une étoile. L'éclat reste doux : une nébuleuse est un objet pâle.
//
// Le disque d'une étoile qui naît (b.proto, voir customsys.js) : un anneau plat de gaz et de poussière,
// un peu évasé vers l'extérieur, éclairé par l'étoile (plus chaud et plus clair près d'elle), creusé
// d'anneaux vides là où grossissent les embryons de planètes, avec deux bras spiraux à peine marqués.
// Il tourne selon Kepler : chaque anneau à sa vitesse (vite près de l'étoile, lentement au bord ; le
// bord d'un grand disque met des milliers d'années à faire un tour). Les plus jeunes ont deux jets
// de matière qui partent des pôles, avec leurs nœuds lumineux (des objets de Herbig-Haro), et un
// cocon de gaz qui les enveloppe encore.
import * as THREE from 'three';
import { NEBULAE } from './galaxie.js?v=1.1.0-mx09tneh';
import { tiltOrbit } from './system.js?v=1.1.0-mx09tneh';

// ---------- Le bruit 3D ----------
// 64³, répétable sur ses bords. R : nuages (fbm) ; G : filaments (fbm « en crêtes ») ; B : un autre
// fbm (la poussière) ; A : du détail fin.
let NOISE = null;
export function noiseTexture() {
  if (NOISE) return NOISE;
  const S = 64, data = new Uint8Array(S * S * S * 4);
  const lattice = (p, seed) => {
    const L = new Float32Array(p * p * p);
    let a = seed >>> 0;
    for (let i = 0; i < L.length; i++) { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; L[i] = ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
    return L;
  };
  // (un bruit de valeurs de période p cases, lissé, lu en x, y, z de 0 à S)
  const make = (p, seed) => {
    const L = lattice(p, seed), k = p / S, out = new Float32Array(S * S * S);
    const sm = (t) => t * t * (3 - 2 * t);
    for (let z = 0; z < S; z++) for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const fx = x * k, fy = y * k, fz = z * k, x0 = Math.floor(fx), y0 = Math.floor(fy), z0 = Math.floor(fz);
      const tx = sm(fx - x0), ty = sm(fy - y0), tz = sm(fz - z0), x1 = (x0 + 1) % p, y1 = (y0 + 1) % p, z1 = (z0 + 1) % p;
      const g = (a, b, c) => L[(c * p + b) * p + a];
      const c00 = g(x0, y0, z0) + (g(x1, y0, z0) - g(x0, y0, z0)) * tx, c10 = g(x0, y1, z0) + (g(x1, y1, z0) - g(x0, y1, z0)) * tx;
      const c01 = g(x0, y0, z1) + (g(x1, y0, z1) - g(x0, y0, z1)) * tx, c11 = g(x0, y1, z1) + (g(x1, y1, z1) - g(x0, y1, z1)) * tx;
      const c0 = c00 + (c10 - c00) * ty, c1 = c01 + (c11 - c01) * ty;
      out[(z * S + y) * S + x] = c0 + (c1 - c0) * tz;
    }
    return out;
  };
  const oct = [[4, 0.5], [8, 0.25], [16, 0.13], [32, 0.07]];
  const fbm = (seed, ridged) => {
    const out = new Float32Array(S * S * S);
    let tot = 0;
    oct.forEach(([p, w], k) => {
      const n = make(p, seed + k * 977);
      for (let i = 0; i < out.length; i++) out[i] += (ridged ? 1 - Math.abs(n[i] * 2 - 1) : n[i]) * w;
      tot += w;
    });
    for (let i = 0; i < out.length; i++) out[i] /= tot;
    return out;
  };
  const R = fbm(11, false), G = fbm(23, true), B = fbm(37, false), A = make(32, 51);
  // (étalées sur toute la plage : plus de contraste)
  const stretch = (v) => {
    let lo = Infinity, hi = -Infinity;
    for (const x of v) { if (x < lo) lo = x; if (x > hi) hi = x; }
    return (x) => Math.round(((x - lo) / (hi - lo)) * 255);
  };
  const sR = stretch(R), sG = stretch(G), sB = stretch(B), sA = stretch(A);
  for (let i = 0; i < S * S * S; i++) { data[i * 4] = sR(R[i]); data[i * 4 + 1] = sG(G[i]); data[i * 4 + 2] = sB(B[i]); data[i * 4 + 3] = sA(A[i]); }
  NOISE = new THREE.Data3DTexture(data, S, S, S);
  NOISE.format = THREE.RGBAFormat;
  NOISE.minFilter = NOISE.magFilter = THREE.LinearFilter;
  NOISE.wrapS = NOISE.wrapT = NOISE.wrapR = THREE.RepeatWrapping;
  NOISE.unpackAlignment = 1;
  NOISE.needsUpdate = true;
  return NOISE;
}

// ---------- Les nébuleuses ----------
const TYPE_ID = { hii: 0, sombre: 1, reflexion: 2, planetaire: 3, reste: 4 };
const HA = new THREE.Color('#ff3a52'), OIII = new THREE.Color('#38d6c4'), SII = new THREE.Color('#c81e2e');
const BLUE = new THREE.Color('#5f88ff'), DUSTRIM = new THREE.Color('#7a3418'), WIND = new THREE.Color('#7ea4ff');
const NEB_VERT = /* glsl */ `
  varying vec3 vPos;
  varying vec3 vCam;
  void main() {
    vPos = position;
    vCam = (inverse(modelMatrix) * vec4(cameraPosition, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;
const NEB_FRAG = /* glsl */ `
  precision highp float;
  precision highp sampler3D;
  uniform sampler3D uNoise;
  uniform int uType;
  uniform vec3 uFlat;
  uniform vec3 uSeed;
  uniform float uBright, uFade, uWind;
  uniform vec3 uC1, uC2, uC3;
  varying vec3 vPos;
  varying vec3 vCam;
  void main() {
    vec3 ro = vCam / uFlat, rd = normalize((vPos - vCam) / uFlat);
    float b = dot(ro, rd), c = dot(ro, ro) - 1.0, h = b * b - c;
    if (h <= 0.0) discard;
    h = sqrt(h);
    float t0 = max(-b - h, 0.0), t1 = -b + h;
    if (t1 <= 0.0) discard;
    const int N = 40;
    float dt = (t1 - t0) / float(N);
    // (un départ décalé d'un pixel à l'autre : pas de bandes)
    float jit = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
    vec3 col = vec3(0.0);
    float T = 1.0;
    for (int i = 0; i < N; i++) {
      vec3 p = ro + rd * (t0 + (float(i) + jit) * dt);
      float r = length(p);
      if (r >= 1.0) continue;
      vec3 w = p * 0.55 + uSeed;
      vec3 warp = texture(uNoise, w * 0.6).rgb - 0.5;
      vec4 n = texture(uNoise, w + warp * 0.3);
      vec4 m = texture(uNoise, w * 2.1 + warp * 0.5 + 0.37);
      vec3 e = vec3(0.0);
      float a = 0.0;
      if (uType == 0) {
        // région H II : une coquille épaisse de gaz ionisé (ses étoiles ont vidé le centre), des
        // filaments, des bandes de poussière ; le cœur, plus chaud, tire vers le bleu-vert
        float shell = smoothstep(1.0, 0.55, r) * smoothstep(0.05, 0.45, r);
        float gas = shell * clamp(n.r * 1.25 + n.g * 0.85 + m.a * 0.25 - 0.95 + 0.3 * (1.0 - r), 0.0, 1.6);
        float dust = smoothstep(1.0, 0.35, r) * smoothstep(0.56, 0.76, m.b) * (0.6 + n.g);
        float ion = smoothstep(0.75, 0.15, r);
        e = mix(mix(uC1, uC3, m.r * 0.6), uC2, ion * 0.85) * gas * gas * 2.6;
        a = dust * 3.2 + gas * 0.25;
      } else if (uType == 1) {
        // nuage sombre : de la poussière froide, opaque ; ses bords, à peine rougis
        float d = smoothstep(1.0, 0.25, r) * clamp(n.r * 1.2 + n.g * 0.7 + m.a * 0.2 - 0.62, 0.0, 1.6);
        a = d * 7.0;
        e = uC1 * d * smoothstep(0.45, 0.95, r) * 0.06;
      } else if (uType == 2) {
        // par réflexion : de la poussière bleutée, éclairée par l'étoile du centre
        float d = smoothstep(1.0, 0.05, r) * clamp(n.r + n.g * 0.8 + m.a * 0.2 - 0.78, 0.0, 1.3);
        e = uC1 * d * (0.18 / (r * r + 0.05));
        a = d * 0.7;
      } else if (uType == 3) {
        // planétaire : une coquille (plus épaisse à l'équateur, elle s'ouvre aux pôles), le cœur bleu-vert,
        // un bord rouge, des nœuds
        float s = exp(-pow((r - 0.6) / 0.13, 2.0)) * (0.5 + 0.9 * n.g);
        float inner = smoothstep(0.62, 0.0, r) * 0.22 * (0.7 + 0.6 * n.r);
        float rim = exp(-pow((r - 0.8) / 0.07, 2.0)) * (0.25 + 1.3 * m.g);
        e = uC2 * (s * 1.5 + inner) + uC1 * rim * 1.5;
        a = s * 0.25;
      } else {
        // reste de supernova : une coquille de filaments fins, rouges et bleus ; autour d'un pulsar, au
        // centre, le vent de particules (bleuté)
        float f = pow(clamp(n.g * 1.3 - 0.28, 0.0, 1.0), 4.0) * (0.6 + m.g);
        float shell = exp(-pow((r - 0.86) / 0.11, 2.0));
        float fil = shell * f * 3.2 + exp(-pow((r - 0.85) / 0.25, 2.0)) * 0.05 * n.r;
        e = mix(uC1, uC2, smoothstep(0.35, 0.7, m.r)) * fil;
        e += uC3 * uWind * smoothstep(0.38, 0.0, r) * (0.3 + 0.7 * n.g) * 0.55;
      }
      col += T * e * uBright * dt;
      T *= exp(-a * dt);
      if (T < 0.02) break;
    }
    float alpha = (1.0 - T) * uFade;
    gl_FragColor = vec4(col * uFade, alpha);
  }`;

// La couche des nébuleuses du ciel : les plus grandes vues d'ici (au plus MAX), à leur place
export class NebulaLayer {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.renderOrder = -2;
    scene.add(this.group);
    this.pool = [];
    this.geo = new THREE.IcosahedronGeometry(1, 3);
    this.here = null;   // (la nébuleuse où l'on est : voir main.js)
    this._q = new THREE.Quaternion();
  }
  mesh(k) {
    let m = this.pool[k];
    if (m) return m;
    const mat = new THREE.ShaderMaterial({
      vertexShader: NEB_VERT, fragmentShader: NEB_FRAG, side: THREE.BackSide, transparent: true, depthWrite: false, depthTest: false, fog: false,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      uniforms: { uNoise: { value: noiseTexture() }, uType: { value: 0 }, uFlat: { value: new THREE.Vector3(1, 1, 1) }, uSeed: { value: new THREE.Vector3() },
        uBright: { value: 1 }, uFade: { value: 1 }, uWind: { value: 0 }, uC1: { value: new THREE.Color() }, uC2: { value: new THREE.Color() }, uC3: { value: new THREE.Color() } },
    });
    m = new THREE.Mesh(this.geo, mat);
    m.frustumCulled = false;
    this.group.add(m);
    return (this.pool[k] = m);
  }
  // at : l'observateur (al, compté depuis Hexa) ; q : l'orientation du ciel (celle des étoiles lointaines,
  // voir skyview.placeGalaxy) ; k : la part visible (1 dans l'espace ; la nuit, au sol, moins ; rien le jour)
  // D : la distance de la scène où sont posés les astres
  update(at, q, k, D) {
    this.group.quaternion.copy(q);
    const list = [];
    this.here = null;
    let hereR = Infinity;
    for (const N of NEBULAE) {
      const dx = N.x - at.x, dy = N.y - at.y, dz = N.z - at.z, d = Math.hypot(dx, dy, dz);
      if (d < N.R && N.R < hereR) { hereR = N.R; this.here = N; }
      const ang = N.R / Math.max(d, 1e-9);
      if (ang < 0.004) continue;
      list.push([ang, N, d, dx, dy, dz]);
    }
    list.sort((a, b) => b[0] - a[0]);
    const show = k > 0.01 ? list.slice(0, MAX) : [];
    // (les plus loin d'abord)
    show.sort((a, b) => b[2] - a[2]);
    show.forEach(([ang, N, d, dx, dy, dz], i) => {
      const m = this.mesh(i), u = m.material.uniforms, s = Math.min(D / Math.max(d, 1e-9), (0.75 * D) / N.R);
      m.visible = true;
      m.renderOrder = -2 + i * 0.001;
      m.position.set(dx * s, dy * s, dz * s);
      m.scale.setScalar(N.R * s);
      m.quaternion.fromArray(N.q);
      u.uType.value = TYPE_ID[N.type];
      u.uFlat.value.fromArray(N.flat);
      u.uSeed.value.set((N.seed % 97) / 97, (N.seed % 89) / 89, (N.seed % 83) / 83);
      const t = N.type;
      u.uC1.value.copy(t === 'reflexion' ? BLUE : t === 'sombre' ? DUSTRIM : HA);
      u.uC2.value.copy(t === 'reste' ? BLUE : OIII);
      u.uC3.value.copy(t === 'reste' ? WIND : SII);
      u.uWind.value = t === 'reste' && N.star >= 0 ? 1 : 0;
      u.uBright.value = N.bright * (t === 'planetaire' ? 1.4 : 1);
      // (de très loin, toute petite : elle s'efface, plutôt qu'un point qui scintille)
      u.uFade.value = k * Math.min(1, (ang - 0.004) / 0.02);
    });
    for (let i = show.length; i < this.pool.length; i++) this.pool[i].visible = false;
  }
}
const MAX = 10;

// ---------- Le disque d'une étoile qui naît ----------
const DISK_VERT = /* glsl */ `
  uniform float uLayer, uFlare;
  varying float vR;
  varying float vPhi;
  void main() {
    vec3 p = position;
    vR = length(p.xy);
    vPhi = atan(p.y, p.x);
    // (le disque s'évase vers l'extérieur : son épaisseur grandit avec la distance à l'étoile)
    vec3 q = vec3(p.x, uLayer * uFlare * pow(vR, 1.25), -p.y);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(q, 1.0);
  }`;
const DISK_FRAG = /* glsl */ `
  precision highp float;
  precision highp sampler3D;
  uniform sampler3D uNoise;
  uniform float uRin, uSpin, uK, uSpiral, uSeed, uLayerK;
  uniform vec4 uGaps;
  uniform vec4 uGapW;
  uniform vec3 uHot, uDust;
  varying float vR;
  varying float vPhi;
  void main() {
    float r = vR;
    // (Kepler : la vitesse angulaire en r^-1,5)
    float a = vPhi + mod(uSpin * pow(max(r, 0.004), -1.5), 6.2831853);
    vec3 nc = vec3(cos(a) * r, sin(a) * r, uSeed) * 3.0;
    float n = texture(uNoise, nc).r, n2 = texture(uNoise, nc * 3.1 + 0.4).a;
    float spiral = 0.5 + 0.5 * sin(2.0 * a + 8.0 * log(r + 0.01));
    // (les bords : le trou au centre, creusé par l'étoile ; le bord extérieur, qui s'efface)
    float e = min(0.3, (1.0 - uRin) * 0.3);
    float dens = smoothstep(uRin * 0.9, uRin + e, r) * smoothstep(1.0, 1.0 - e, r) * (0.5 + 0.5 * n) * (0.88 + 0.12 * n2) * (1.0 + uSpiral * (spiral - 0.5));
    for (int k = 0; k < 4; k++) if (uGapW[k] > 0.0) dens *= 1.0 - 0.93 * exp(-pow((r - uGaps[k]) / uGapW[k], 2.0));
    // (éclairé par l'étoile : plus chaud et plus clair près d'elle)
    vec3 c = mix(uHot, uDust, smoothstep(0.0, 0.3, r)) * (0.3 + 0.9 / (1.0 + r * 7.0));
    float al = clamp(dens * 0.9, 0.0, 1.0) * uK * uLayerK;
    gl_FragColor = vec4(c * al, al);
  }`;
const JET_FRAG = /* glsl */ `
  precision highp float;
  uniform float uK, uSeed;
  varying vec2 vUv;
  varying float vEdge;
  void main() {
    float y = vUv.y;
    // (des nœuds lumineux le long du jet : la matière qui heurte le gaz plus lent devant elle)
    float knots = 0.45 + 0.55 * pow(0.5 + 0.5 * sin(y * 38.0 + uSeed), 6.0);
    float k = uK * pow(1.0 - y, 1.3) * knots * pow(vEdge, 3.0);
    vec3 c = mix(vec3(0.75, 0.82, 1.0), vec3(1.0, 0.42, 0.58), smoothstep(0.15, 0.7, y));
    // (mélange additif de three.js : la couleur est multipliée par l'alpha)
    gl_FragColor = vec4(c, clamp(k, 0.0, 1.0));
  }`;
const JET_VERT = /* glsl */ `
  varying vec2 vUv;
  varying float vEdge;
  void main() {
    vUv = uv;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    // (de face au centre du jet, de biais sur ses bords : un faisceau flou, pas un tube)
    vEdge = abs(dot(normalize(normalMatrix * normal), normalize(-mv.xyz)));
    gl_Position = projectionMatrix * mv;
  }`;
const ENV_FRAG = /* glsl */ `
  precision highp float;
  uniform float uK;
  uniform vec3 uC;
  varying vec3 vPos;
  varying vec3 vCam;
  void main() {
    vec3 ro = vCam, rd = normalize(vPos - vCam);
    float b = dot(ro, rd), c = dot(ro, ro) - 1.0, h = b * b - c;
    if (h <= 0.0) discard;
    float t0 = max(-b - sqrt(h), 0.0), t1 = -b + sqrt(h);
    // (le cocon : plus épais au centre ; les jets y ont creusé deux cavités, le long de l'axe)
    vec3 mid = ro + rd * (t0 + t1) * 0.5;
    float cav = 1.0 - 0.75 * smoothstep(0.3, 0.9, abs(normalize(mid + 1e-5).y));
    float chord = (t1 - t0) * 0.5;
    float al = clamp(uK * chord * chord * cav * 0.85, 0.0, 0.92);
    gl_FragColor = vec4(uC * al * 0.35, al);
  }`;

const Y = new THREE.Vector3(0, 1, 0);
// Le modèle du disque (et des jets, du cocon) de l'astre b : rayon 1 = le bord du disque
export function makeProtoDisk(b) {
  const P = b.proto, g = new THREE.Group(), out = P.rout;
  const rin = Math.max(P.rin, b.R * 3) / out;
  const geo = new THREE.RingGeometry(Math.max(0.002, rin * 0.8), 1, 192, 64);
  const gaps = [0, 0, 0, 0], gw = [0, 0, 0, 0];
  P.gaps.forEach(([a, w], k) => { gaps[k] = a / out; gw[k] = Math.max(0.004, w / out); });
  const hot = new THREE.Color(b.color || '#ffd0a0').lerp(new THREE.Color('#fff4e0'), 0.4), dust = new THREE.Color(P.dust);
  const layers = P.phase === 'debris' ? [[0, 1]] : [[-1, 0.35], [0, 1], [1, 0.35]];
  const mats = [];
  for (const [layer, w] of layers) {
    const mat = new THREE.ShaderMaterial({
      vertexShader: DISK_VERT, fragmentShader: DISK_FRAG, side: THREE.DoubleSide, transparent: true, depthWrite: false, fog: false,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      uniforms: { uNoise: { value: noiseTexture() }, uLayer: { value: layer }, uFlare: { value: P.phase === 'debris' ? 0.01 : 0.07 }, uRin: { value: rin },
        uSpin: { value: 0 }, uK: { value: 1 }, uSpiral: { value: P.phase === 'disque' ? 0.3 : P.phase === 'jeune' ? 0.5 : 0 }, uSeed: { value: (P.seed % 50) / 50 },
        uLayerK: { value: w }, uGaps: { value: new THREE.Vector4(...gaps) }, uGapW: { value: new THREE.Vector4(...gw) }, uHot: { value: hot }, uDust: { value: dust } },
    });
    mats.push(mat);
    const m = new THREE.Mesh(geo, mat);
    m.frustumCulled = false;
    m.renderOrder = layer === 0 ? 1 : 0;
    g.add(m);
  }
  if (P.jets > 0) {
    // (deux cônes à peine ouverts, l'un vers le nord, l'autre vers le sud ; longs de 5 fois le disque)
    const jg = new THREE.CylinderGeometry(0.11, 0.01, 1, 24, 48, true).translate(0, 0.5, 0);
    const jm = new THREE.ShaderMaterial({ vertexShader: JET_VERT, fragmentShader: JET_FRAG, transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending, uniforms: { uK: { value: 0.7 * P.jets }, uSeed: { value: P.seed } } });
    for (const s of [1, -1]) {
      const j = new THREE.Mesh(jg, jm);
      j.scale.set(1, 5 * s, 1);
      j.frustumCulled = false;
      j.renderOrder = 2;
      g.add(j);
    }
  }
  if (P.env > 0) {
    const em = new THREE.ShaderMaterial({ vertexShader: NEB_VERT, fragmentShader: ENV_FRAG, side: THREE.BackSide, transparent: true, depthWrite: false, depthTest: false, fog: false,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      uniforms: { uK: { value: P.env }, uC: { value: new THREE.Color('#ff8a50') } } });
    const e = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 3), em);
    e.scale.setScalar(1.5);
    e.frustumCulled = false;
    e.renderOrder = 3;
    g.add(e);
  }
  // (le plan du disque : celui des orbites de ses embryons, voir galaxie.protoDef)
  const T = { incl: P.incl, node: P.node }, e1 = tiltOrbit(T, 0, 1, 0, {}), e2 = tiltOrbit(T, 0, 0, 1, {});
  const n = new THREE.Vector3().crossVectors(new THREE.Vector3(e2.x, e2.y, e2.z), new THREE.Vector3(e1.x, e1.y, e1.z)).normalize();
  g.userData.axis = new THREE.Quaternion().setFromUnitVectors(Y, n);
  g.userData.mats = mats;
  // (la taille, en rayons du disque, de tout ce qu'il faut voir : les jets dépassent)
  g.userData.extent = P.jets > 0 ? 5 : P.env > 0 ? 1.5 : 1;
  // un tour du bord du disque : en jours (Kepler, comme les planètes, voir customsys.js)
  g.userData.period = 120 * Math.sqrt((out / 6.6e7) ** 3 / (b.lum > 10 ? 3 : 0.8));
  return g;
}
