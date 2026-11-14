// Lumières « volumétriques » : faisceaux (pulsars, phares des trains) et rayonnement des étoiles.
// Ce ne sont pas des cônes pleins : un faisceau est une bande toujours tournée vers la caméra
// autour de son axe, dont l'éclat suit une gaussienne en travers (blanc au cœur, coloré au bord)
// et s'éteint doucement le long de l'axe. Vu de côté comme de trois quarts, on voit un rayon de
// lumière dans un milieu diffusant, sans arête. Une étoile : une sphère en shader (assombrie au
// bord, granulation en cellules hexagonales qui bouillonnent, taches), et un rayonnement autour
// (couronne collée au bord, halo en 1/r², jets de la couronne, aigrettes à six branches comme
// celles d'un objectif à diaphragme hexagonal).
import * as THREE from 'three';

const NOISE = `
float h1(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float n3(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h1(i), h1(i + vec3(1, 0, 0)), f.x), mix(h1(i + vec3(0, 1, 0)), h1(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(h1(i + vec3(0, 0, 1)), h1(i + vec3(1, 0, 1)), f.x), mix(h1(i + vec3(0, 1, 1)), h1(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}`;

// ---------- Faisceau ----------
// Le long de +Y depuis l'origine de l'objet. o : { length, r0 (rayon au départ), r1 (au bout),
// color (bord), core (cœur), opacity, fall (extinction le long : exposant), sharp (finesse en
// travers), gain (éclat), base (début de l'apparition le long : 0 = depuis rien), near (distance
// de la caméra sous laquelle la lumière s'efface : on est dedans) }
// Une vraie lumière volumétrique : un cône de « brume » éclairée (densité gaussienne autour de
// l'axe, qui s'étale en s'éloignant), traversé pixel par pixel par le rayon de la caméra (marche
// le long du rayon, dans le cône). Vu de côté : un rayon net, plus pâle au loin ; vu dans l'axe :
// un disque éblouissant ; de l'intérieur : la brume tout autour. Aucune arête, aucune bande.
// material.opacity reste réglable comme avant (les trains l'allument la nuit).
const BEAM_STEPS = 28;
export function makeBeam(o = {}) {
  const L = o.length ?? 10, r0 = o.r0 ?? 0.1, r1 = o.r1 ?? 1, sharp = o.sharp ?? 3;
  // l'enveloppe : là où la brume compte (au-delà, exp(-sharp q²) est négligeable)
  const k = Math.sqrt(9 / sharp) + 0.05, b0 = r0 * k, b1 = r1 * k, seg = 16;
  const geo = new THREE.CylinderGeometry(b1, b0, L, seg, 1, false).translate(0, L / 2, 0);
  const uniforms = {
    uLen: { value: L }, uR0: { value: r0 }, uR1: { value: r1 }, uB0: { value: b0 }, uB1: { value: b1 },
    uColor: { value: new THREE.Color(o.color ?? 0xfff1c4) }, uCore: { value: new THREE.Color(o.core ?? 0xffffff) },
    uOpacity: { value: o.opacity ?? 1 }, uFall: { value: o.fall ?? 1.6 }, uSharp: { value: sharp },
    uNear: { value: o.near ?? 0 }, uTime: { value: 0 }, uDust: { value: o.dust ?? 0.15 }, uGain: { value: o.gain ?? 1 },
    uBase: { value: o.base ?? -0.01 }, uCam: { value: new THREE.Vector3() }, uSc: { value: 1 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.BackSide, toneMapped: false, fog: false,
    vertexShader: `
varying vec3 vP;
void main() {
  vP = position;
  vec4 c = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  // (un long faisceau dépasse le fond de la caméra : on le garde, la lumière se calcule à part)
  c.z = min(c.z, c.w * 0.99999);
  gl_Position = c;
}`,
    fragmentShader: `
uniform vec3 uColor, uCore, uCam;
uniform float uOpacity, uFall, uSharp, uNear, uTime, uLen, uR0, uR1, uB0, uB1, uDust, uGain, uBase, uSc;
varying vec3 vP;
${NOISE}
// entrée du rayon (o + t d) dans le cône-enveloppe (rayon b0 en y = 0, b1 en y = uLen), avant tMax
float enter(vec3 o, vec3 d, float tMax) {
  float t0 = 0.0;
  // tranches en y
  if (abs(d.y) > 1e-6) {
    float ta = (0.0 - o.y) / d.y, tb = (uLen - o.y) / d.y;
    t0 = max(t0, min(ta, tb));
  } else if (o.y < 0.0 || o.y > uLen) return tMax;
  // cône : x² + z² = (b0 + s y)²
  float s = (uB1 - uB0) / uLen;
  float A = d.x * d.x + d.z * d.z - s * s * d.y * d.y;
  float Bb = o.x * d.x + o.z * d.z - s * d.y * (uB0 + s * o.y);
  float C = o.x * o.x + o.z * o.z - (uB0 + s * o.y) * (uB0 + s * o.y);
  if (C > 0.0 && abs(A) > 1e-9) {
    float D = Bb * Bb - A * C;
    if (D >= 0.0) {
      float sq = sqrt(D), u1 = (-Bb - sq) / A, u2 = (-Bb + sq) / A;
      float tc = min(u1, u2);
      if (tc < 0.0) tc = max(u1, u2);
      if (tc > 0.0) t0 = max(t0, tc);
    }
  }
  return min(t0, tMax);
}
void main() {
  vec3 o = uCam, d = vP - uCam;
  float tMax = length(d);
  d /= tMax;
  float t0 = enter(o, d, tMax);
  float span = tMax - t0;
  if (span <= 0.0) discard;
  float dt = span / float(${BEAM_STEPS});
  // (décalage au hasard par pixel : pas de stries)
  float j = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
  float glow = 0.0, core = 0.0;
  for (int i = 0; i < ${BEAM_STEPS}; i++) {
    float t = t0 + (float(i) + j) * dt;
    vec3 p = o + d * t;
    float y = p.y / uLen;
    if (y < 0.0 || y > 1.0) continue;
    float r = mix(uR0, uR1, y);
    float q2 = dot(p.xz, p.xz) / (r * r);
    float along = pow(max(0.0, 1.0 - y), uFall) * smoothstep(uBase, uBase + 0.03, y) * smoothstep(1.0, 0.8, y);
    // (poussières et volutes qui filent le long du faisceau)
    float ang = atan(p.z, p.x);
    float dust = 1.0 - uDust + uDust * 1.6 * n3(vec3(cos(ang) * 1.5, sin(ang) * 1.5, y * uLen / r * 0.35 - uTime * 0.8));
    float near = uNear > 0.0 ? smoothstep(uNear * 0.3, uNear, t * uSc) : 1.0;
    // (en s'étalant, la même lumière se répartit sur une section plus large : / r)
    float w = along * dust * near * dt / r;
    glow += exp(-uSharp * q2) * w;
    core += exp(-uSharp * 7.0 * q2) * w;
  }
  // (normalisé : vu de côté, l'éclat au cœur est celui de l'ancien faisceau)
  glow *= sqrt(uSharp / 3.14159);
  core *= sqrt(uSharp * 7.0 / 3.14159);
  vec3 col = uColor * glow * 0.55 + uCore * core * 0.9;
  col *= uOpacity * uGain;
  // (dans l'axe, l'éclat s'accumule : il sature en douceur, sans brûler)
  col = 1.0 - exp(-col * 1.2);
  gl_FragColor = vec4(col, 1.0);
}`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.castShadow = mesh.receiveShadow = false;
  // (à chaque dessin : material.opacity, et la caméra dans le repère du faisceau)
  const _m = new THREE.Matrix4(), _c = new THREE.Vector3();
  mesh.onBeforeRender = (renderer, scene, camera) => {
    uniforms.uOpacity.value = mat.opacity;
    _m.copy(mesh.matrixWorld).invert();
    uniforms.uCam.value.copy(_c.setFromMatrixPosition(camera.matrixWorld)).applyMatrix4(_m);
    uniforms.uSc.value = _c.setFromMatrixColumn(mesh.matrixWorld, 1).length();
  };
  mat.opacity = o.opacity ?? 1;
  mesh.userData.tick = (dt) => { uniforms.uTime.value += dt; };
  return mesh;
}

// ---------- Rayonnement d'une étoile (toujours face à la caméra) ----------
// Au rayon 1 de l'étoile. o : { size (rayon du rayonnement, en rayons de l'étoile), color (photosphère),
// corona, core, halo, spikes (force des aigrettes), streamers (jets), flash (l'axe d'un pulsar : uAxis) }
export function makeGlow(o = {}) {
  const uniforms = {
    uSize: { value: o.size ?? 20 }, uColor: { value: new THREE.Color(o.color ?? 0xfff1d0) },
    uCorona: { value: new THREE.Color(o.corona ?? 0xffb048) }, uCore: { value: new THREE.Color(o.core ?? 0xffffff) },
    uHalo: { value: o.halo ?? 1 }, uSpikes: { value: o.spikes ?? 0.5 }, uStream: { value: o.streamers ?? 1 },
    uTime: { value: 0 }, uAxis: { value: new THREE.Vector3(0, 1, 0) }, uFlash: { value: o.flash ? 1 : 0 },
    uOpacity: { value: 1 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false,
    vertexShader: `
uniform float uSize, uFlash;
uniform vec3 uAxis;
varying vec2 vUv;
varying float vFlash;
void main() {
  vec4 O = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  float sc = length((modelViewMatrix * vec4(1.0, 0.0, 0.0, 0.0)).xyz);
  vUv = position.xy * uSize;
  // (pulsar : quand un faisceau passe sur nous, l'étoile flashe)
  vec3 A = normalize((modelViewMatrix * vec4(uAxis, 0.0)).xyz);
  vFlash = uFlash * pow(abs(dot(A, normalize(-O.xyz))), 60.0);
  O.xy += vUv * sc;
  gl_Position = projectionMatrix * O;
}`,
    fragmentShader: `
uniform vec3 uColor, uCorona, uCore;
uniform float uSize, uHalo, uSpikes, uStream, uTime, uOpacity;
varying vec2 vUv;
varying float vFlash;
${NOISE}
void main() {
  float r = length(vUv), a = atan(vUv.y, vUv.x);
  float x = max(r - 1.0, 0.0);
  // couronne collée au bord, halo large (continus au bord du disque : dedans, ils s'effacent)
  float inner = r < 1.0 ? pow(r, 24.0) : exp(-x * 2.6);
  float halo = r < 1.0 ? pow(r, 12.0) : 1.0 / (1.0 + x * x * 0.55);
  // jets de la couronne : des rayons irréguliers qui bougent lentement
  float st = n3(vec3(cos(a) * 3.0, sin(a) * 3.0, uTime * 0.05)) * 0.6 + n3(vec3(cos(a) * 9.0, sin(a) * 9.0, uTime * 0.08 + 3.0)) * 0.4;
  float stream = pow(st, 2.5) * exp(-x * 1.1) * step(1.0, r);
  // aigrettes à six branches (diaphragme hexagonal) : fines, de plus en plus faibles
  float sp = pow(abs(cos(3.0 * a + 0.3)), 1200.0);
  float spikes = sp * uSpikes * 0.9 * exp(-x * 0.45) * smoothstep(1.0, 1.6, r);
  float I = inner * 0.55 + halo * 0.3 * uHalo + stream * 0.5 * uStream + spikes;
  I *= 1.0 + vFlash * 5.0;
  I *= 1.0 - smoothstep(uSize * 0.6, uSize, r);
  vec3 col = mix(uCore, uColor, smoothstep(0.9, 2.2, r));
  col = mix(col, uCorona, smoothstep(1.6, 7.0, r));
  col = mix(col, uCore, clamp(spikes * 0.6, 0.0, 0.8));
  gl_FragColor = vec4(col * I * uOpacity, 1.0);
}`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 2;
  mesh.userData.uniforms = uniforms;
  return mesh;
}

// ---------- Surface d'une étoile ----------
export function makeStarSurface(o = {}) {
  const uniforms = {
    uColor: { value: new THREE.Color(o.color ?? 0xfff1d0) }, uLimb: { value: new THREE.Color(o.corona ?? 0xffb048) },
    uTime: { value: 0 }, uCells: { value: o.cells ?? 14 }, uSpots: { value: o.spots ?? 1 }, uSeed: { value: o.seed ?? 0 },
    uFlat: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms, toneMapped: false, fog: false,
    // uFlat = 1 (le ciel, voir skyview.js) : la sphère est aplatie face à la caméra, à la profondeur
    // de son centre, comme son rayonnement (makeGlow). Sinon, une étoile qui paraît très grande,
    // vue près du bord de l'écran, est étirée par la perspective et déborde de son rayonnement.
    vertexShader: `
uniform float uFlat;
varying vec3 vN, vV, vP;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = -mv.xyz;
  if (uFlat > 0.5) {
    vec4 C = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    vV = vec3(0.0, 0.0, 1.0);
    mv.z = C.z;
  }
  vP = position;
  gl_Position = projectionMatrix * mv;
}`,
    fragmentShader: `
uniform vec3 uColor, uLimb;
uniform float uTime, uCells, uSpots, uSeed;
varying vec3 vN, vV, vP;
${NOISE}
// cellule hexagonale : (distance au bord 0..1, identifiant)
vec3 hexCell(vec2 p) {
  const vec2 s = vec2(1.0, 1.7320508);
  vec2 ha = s * 0.5;
  vec2 ia = floor(p / s), ib = floor((p - ha) / s);
  vec2 a = p - (ia + 0.5) * s, b = p - (ib + 0.5) * s - ha;
  bool A = dot(a, a) < dot(b, b);
  vec2 g = abs(A ? a : b);
  float e = max(dot(g, s * 0.5), g.x) * 2.0;
  vec2 id = A ? ia : ib + 0.5;
  return vec3(e, id);
}
float gran(vec2 p, float k) {
  vec3 c = hexCell(p);
  float h = fract(sin(dot(c.yz + k, vec2(12.9898, 78.233))) * 43758.5453);
  float boil = 0.5 + 0.5 * sin(uTime * (0.6 + h) + h * 6.2831);
  return (0.93 + 0.1 * boil) * (1.0 - 0.12 * smoothstep(0.72, 1.0, c.x));
}
void main() {
  vec3 n = normalize(vN), v = normalize(vV), P = normalize(vP);
  float mu = clamp(dot(n, v), 0.0, 1.0);
  // assombrissement centre-bord (loi d'Eddington, à peu près)
  float limb = 0.3 + 0.7 * pow(mu, 0.6);
  // granulation : cellules hexagonales, projetées sur les trois plans
  vec3 w = pow(abs(P), vec3(4.0)); w /= w.x + w.y + w.z;
  vec3 q = P * uCells;
  float g = gran(q.yz, 1.0) * w.x + gran(q.xz, 2.0) * w.y + gran(q.xy, 3.0) * w.z;
  // taches (plus sombres, avec pénombre) et facules (plus claires, près du bord)
  float sn = n3(P * 3.0 + uSeed) * 0.7 + n3(P * 7.0 + uSeed * 2.0) * 0.3;
  float spot = smoothstep(0.8, 0.85, sn) * uSpots, pen = smoothstep(0.75, 0.8, sn) * uSpots;
  float fac = smoothstep(0.6, 0.7, sn) * (1.0 - mu) * 0.35;
  // (au centre : presque blanc, éblouissant ; vers le bord : la couleur de l'étoile, puis celle de la couronne)
  vec3 col = mix(uLimb, uColor, smoothstep(0.0, 0.45, mu));
  col = mix(col, vec3(1.0), smoothstep(0.5, 1.0, mu) * 0.4);
  col *= limb * g * (1.0 - pen * 0.25 - spot * 0.4) * (1.0 + fac);
  gl_FragColor = vec4(col * 1.12, 1.0);
}`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 40), mat);
  mesh.userData.uniforms = uniforms;
  return mesh;
}
