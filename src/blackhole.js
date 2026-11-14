// Un trou noir vu de l'espace ou depuis le sol (voir skyview.js) : ce n'est pas une image, chaque
// pixel suit son rayon de lumière dans la gravité du trou (équation des géodésiques de Schwarzschild).
//  - l'ombre (2,6 rayons de Schwarzschild) et l'anneau de photons viennent tout seuls : les rayons
//    qui passent trop près tombent, ceux qui frôlent la sphère de photons en font le tour ;
//  - le disque d'accrétion : on voit aussi le dessus de sa partie cachée derrière le trou, et le
//    dessous, courbés autour de l'ombre. Il tourne plus vite près du trou (Kepler). Le côté qui
//    vient vers nous est plus brillant et plus bleu (effet Doppler), l'intérieur est plus chaud ;
//  - tout ce qui est derrière (étoiles, planètes) est vraiment déformé : on recopie l'image déjà
//    dessinée et chaque rayon va y lire ce qu'il rencontre (mirages, anneau d'Einstein).
// L'unité du modèle est le rayon de l'horizon. Seuls les pixels couverts coûtent quelque chose.
import * as THREE from 'three';

const RB = 20; // (rayon de la sphère où les rayons sont suivis)

const VERT = `
varying vec3 vCam, vRay;
varying mat4 vClip;
void main() {
  vCam = (inverse(modelMatrix) * vec4(cameraPosition, 1.0)).xyz;
  vRay = position - vCam;
  vClip = projectionMatrix * viewMatrix * modelMatrix;
  vec4 c = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  c.z = 0.5 * c.w; // (ni le plan proche ni le plan lointain ne doivent le couper)
  gl_Position = c;
}`;

const FRAG = `
precision highp float;
uniform sampler2D tBg;
uniform vec2 uRes;
uniform float uTime, uShift, uTintK;
uniform vec3 uTint;
varying vec3 vCam, vRay;
varying mat4 vClip;
const float RB = ${RB.toFixed(1)}, RIN = 3.0, ROUT = 11.0;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
// (0 au centre d'un hexagone, 1 sur son bord : le disque aussi est fait d'hexagones)
float hexEdge(vec2 p) {
  const vec2 s = vec2(1.0, 1.7320508);
  vec2 a = mod(p, s) - s * 0.5, b = mod(p - s * 0.5, s) - s * 0.5;
  vec2 g = abs(dot(a, a) < dot(b, b) ? a : b);
  return max(dot(g, s * 0.5), g.x) * 2.0;
}
vec4 disk(vec3 q, vec3 dir) {
  float r = length(q.xz);
  if (r < RIN || r > ROUT) return vec4(0.0);
  float phi = atan(q.z, q.x) + uTime * 1.6 / pow(r, 1.5);
  vec2 c = vec2(cos(phi), sin(phi)) * r;
  float n = noise(c * 1.6) * 0.6 + noise(c * 4.3 + 7.0) * 0.4;
  float den = (0.4 + 0.8 * n) * (1.0 - 0.35 * smoothstep(0.7, 1.0, hexEdge(c * 2.2)));
  float edge = smoothstep(RIN, RIN + 0.7, r) * smoothstep(ROUT, ROUT - 4.5, r);
  float beta = min(0.7, sqrt(0.5 / (r - 1.0)));
  vec3 vel = normalize(vec3(q.z, 0.0, -q.x));
  float g = sqrt(max(0.05, 1.0 - 1.5 / r)) / (1.0 + beta * dot(vel, normalize(dir)));
  float T = pow(RIN / r, 0.75) * g;
  vec3 col = mix(vec3(1.0, 0.24, 0.04), vec3(1.0, 0.7, 0.36), smoothstep(0.2, 0.6, T));
  col = mix(col, vec3(0.96, 0.97, 1.0), smoothstep(0.6, 1.1, T));
  col = mix(col, vec3(0.6, 0.75, 1.0), smoothstep(1.1, 1.7, T));
  col = mix(col, uTint * (0.35 + 1.1 * dot(col, vec3(0.3, 0.5, 0.2))) + 0.25 * smoothstep(0.8, 1.6, T), uTintK); // (disque d'une autre couleur : voir disk)
  return vec4(col * den * g * g * g * (0.5 + 1.4 * T) * edge, min(0.95, edge * (0.35 + 0.6 * den)));
}
vec3 background(vec3 d) {
  vec3 w = normalize(d);
  vec4 c = vClip * vec4(w, 0.0);
  float s = fract(sin(dot(floor(w * 240.0), vec3(12.9898, 78.233, 37.719))) * 43758.5453);
  vec3 stars = vec3(smoothstep(0.9975, 1.0, s));
  if (c.w <= 0.0) return stars;
  vec2 uv = c.xy / c.w * 0.5 + 0.5;
  vec2 m = smoothstep(vec2(0.0), vec2(0.05), uv) * smoothstep(vec2(0.0), vec2(0.05), 1.0 - uv);
  return mix(stars, texture2D(tBg, uv).rgb, m.x * m.y);
}
void main() {
  vec3 p = vCam, d = normalize(vRay);
  float pp = dot(p, p), pd = dot(p, d), lim = RB * RB, fade = 1.0;
  vec3 h = cross(p, d);
  float b0 = length(h);
  if (pp > lim) {
    float disc = pd * pd - pp + lim;
    if (disc <= 0.0) discard;
    p += d * (-pd - sqrt(disc));
    fade = smoothstep(RB, RB * 0.72, b0);
  }
  float h2 = dot(h, h);
  vec3 col = vec3(0.0);
  float A = 0.0;
  bool fell = false;
  for (int i = 0; i < 120; i++) {
    float r = length(p);
    if (r < 1.02) { fell = true; break; }
    if (r > RB + 0.5 && dot(p, d) > 0.0) break;
    float dt = clamp((r - 1.0) * 0.45, 0.05, 2.4);
    d += -1.5 * h2 * p / pow(r * r, 2.5) * dt;
    vec3 n = p + d * dt;
    if (p.y * n.y < 0.0 && A < 0.97) {
      vec4 e = disk(mix(p, n, p.y / (p.y - n.y)), d);
      col += (1.0 - A) * e.rgb;
      A += (1.0 - A) * e.a;
    }
    p = n;
    if (i == 119) fell = true; // (un rayon qui tourne encore : la sphère de photons)
  }
  col = 1.0 - exp(-col * 1.5);
  if (!fell) {
    // (la lumière qui tombe vers un observateur proche du trou est décalée vers le bleu)
    vec3 bg = background(d) * vec3(1.0 - 0.5 * uShift, 1.0 - 0.15 * uShift, 1.0 + 0.7 * uShift);
    col += (1.0 - A) * bg;
  }
  if (fade < 1.0) col = mix(texture2D(tBg, gl_FragCoord.xy / uRes).rgb, col, fade);
  gl_FragColor = vec4(col, 1.0);
}`;

export function makeBlackHole(body) {
  const g = new THREE.Group();
  g.userData.body = body;
  const size = new THREE.Vector2(), zero = new THREE.Vector2();
  let tex = new THREE.FramebufferTexture(2, 2);
  // (body.disk : la couleur du disque d'un trou noir ajouté, voir src/systemes ; sinon ses vraies couleurs)
  const uniforms = { tBg: { value: tex }, uRes: { value: new THREE.Vector2(2, 2) }, uTime: { value: 0 }, uShift: { value: 0 },
    uTint: { value: new THREE.Color(body.disk || '#ffffff') }, uTintK: { value: body.disk ? 1 : 0 } };
  const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms, side: THREE.BackSide, transparent: true, depthTest: false, depthWrite: false, blending: THREE.NoBlending, toneMapped: false });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(RB * 1.03, 40, 28), mat);
  // (au moment où il est dessiné : tout ce qui est plus loin que lui est déjà à l'écran)
  mesh.onBeforeRender = (r) => {
    r.getDrawingBufferSize(size);
    if (tex.image.width !== size.x || tex.image.height !== size.y) {
      tex.dispose();
      tex = new THREE.FramebufferTexture(size.x, size.y);
      tex.minFilter = tex.magFilter = THREE.LinearFilter;
      uniforms.tBg.value = tex;
      uniforms.uRes.value.copy(size);
    }
    r.copyFramebufferToTexture(zero, tex);
  };
  g.add(mesh);
  g.userData.update = (dt) => { uniforms.uTime.value += dt; };
  // (x : la distance de l'observateur, en rayons de l'horizon)
  g.userData.setDist = (x) => { uniforms.uShift.value = 1 - Math.sqrt(Math.max(0, 1 - 1 / Math.max(1, x))); };
  return g;
}
