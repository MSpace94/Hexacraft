// Vagues de la mer : quelques ondes qui avancent dans le sens du vent, à la vitesse des vraies
// vagues (les longues vont plus vite). Leur hauteur suit le temps qu'il fait (mer d'huile
// par beau temps, grosse houle sous la pluie, creux énormes dans la tempête) et elles ne
// se forment qu'en eau profonde (rien sur une rivière, elles s'aplatissent près des côtes).
//  - Pour éviter un motif qui se répète : la hauteur varie d'un endroit à l'autre (trains de
//    vagues qui avancent), et dans la tempête une mer croisée s'ajoute (houles venues
//    d'autres directions, plus courtes) : les vagues deviennent chaotiques.
//  - Sous une tornade : l'eau se soulève en bosse au centre, des vagues tournent en spirale
//    autour, avec beaucoup d'écume.
// La même formule sert au shader de l'eau (GLSL généré ci-dessous) et à la flottaison des
// objets (waveHeight) : ce qu'on voit est ce qui porte les bateaux. Aucun import.

// Ondes : [écart avec la direction du vent (radians), longueur d'onde (blocs), part de la hauteur]
const WAVES = [[0, 14, 1], [0.45, 9, 0.6], [-0.6, 6, 0.38], [1.1, 3.6, 0.2]];
// mer croisée de la tempête (pondérée par sea.chaos)
const CHAOS = [[2.1, 7.5, 0.55], [-1.85, 5.2, 0.45], [2.9, 10.5, 0.5], [-2.6, 3.9, 0.3]];
const SUM = WAVES.reduce((s, w) => s + w[2], 0) * 0.62; // (les crêtes s'additionnent rarement toutes)
const G = 9.8;
export const WAVE_CALM = 0.05, WAVE_STORM = 0.9; // hauteur (blocs) par beau temps / en tempête
export const SEA_DEPTH = [2, 8]; // profondeur (blocs) où les vagues commencent / sont entières
export const MAX_TORNADOES = 3;  // tornades qui agissent sur l'eau (les plus proches)
// Trains de vagues : variation lente de la hauteur (fréquences en x, z, t)
const GROUP = [[0.045, 0.031, -0.4], [-0.027, 0.052, 0.3]];
// Tornade sur l'eau : bosse (hauteur, rayon²), spirale (hauteur, longueur, portée)
const TOR_BUMP = 1.9, TOR_BUMP_R2 = 70, TOR_SWIRL = 0.65, TOR_SWIRL_K = 0.85, TOR_SWIRL_R = 22, TOR_REACH = 70;

// État partagé (mis à jour à chaque image par main.js) : temps, hauteur, direction du vent,
// mer croisée (0..1), tornades [{ x, z, p (force) }]
export const sea = { t: 0, amp: WAVE_CALM, dx: 1, dz: 0, chaos: 0, tor: [] };

// Ondes précalculées pour une direction de vent : [kx, kz, pulsation, hauteur relative, phase, mer croisée]
function waveSet(dx, dz) {
  const a0 = Math.atan2(dz, dx), mk = (list, chaos) => list.map(([da, L, part], i) => {
    const a = a0 + da, k = (Math.PI * 2) / L;
    return [Math.cos(a) * k, Math.sin(a) * k, Math.sqrt(G * k) * 0.8, part / SUM, i * 1.7 + (chaos ? 0.9 : 0), chaos];
  });
  return [...mk(WAVES, 0), ...mk(CHAOS, 1)];
}

let cache = { dx: NaN, dz: NaN, set: null };
// Hauteur des vagues (blocs, autour de 0) au point (x, z) en pleine mer
export function waveHeight(x, z) {
  if (cache.dx !== sea.dx || cache.dz !== sea.dz) cache = { dx: sea.dx, dz: sea.dz, set: waveSet(sea.dx, sea.dz) };
  let h = 0;
  for (const [kx, kz, w, part, ph, chaos] of cache.set) {
    if (chaos && sea.chaos < 0.01) continue;
    h += part * (chaos ? sea.chaos : 1) * Math.sin(kx * x + kz * z - w * sea.t + ph);
  }
  // (la mer croisée rend la mer plus désordonnée, pas deux fois plus haute)
  const m = (1 + (0.3 + 0.35 * sea.chaos) * Math.sin(GROUP[0][0] * x + GROUP[0][1] * z + GROUP[0][2] * sea.t) * Math.sin(GROUP[1][0] * x + GROUP[1][1] * z + GROUP[1][2] * sea.t)) / (1 + 0.55 * sea.chaos);
  return h * m * sea.amp + tornadoWater(x, z);
}

// Eau soulevée par les tornades proches (blocs)
export function tornadoWater(x, z) {
  let h = 0;
  for (const t of sea.tor) {
    const dx = x - t.x, dz = z - t.z, d2 = dx * dx + dz * dz;
    if (d2 > TOR_REACH * TOR_REACH) continue;
    const d = Math.sqrt(d2);
    h += t.p * (TOR_BUMP * Math.exp(-d2 / TOR_BUMP_R2) + TOR_SWIRL * Math.sin(d * TOR_SWIRL_K - Math.atan2(dz, dx) * 2 + sea.t * 5) * Math.exp(-d / TOR_SWIRL_R));
  }
  return h;
}

// Part des vagues selon la profondeur d'eau (0 : pas de vagues, 1 : pleine mer)
export function seaFactor(depth) {
  const t = Math.min(1, Math.max(0, (depth - SEA_DEPTH[0]) / (SEA_DEPTH[1] - SEA_DEPTH[0])));
  return t * t * (3 - 2 * t);
}

// GLSL : float seaWave(vec2 p, out vec2 grad) -> hauteur et pente des vagues (sans les
// tornades) ; float torWater(vec2 p) -> eau soulevée par les tornades ; float torNear(vec2 p)
// -> proximité d'une tornade (écume). Uniformes : uTime, uWaveAmp, uWaveDir, uChaos, uTor[]
const glslWave = ([da, L, part], i, chaos) => {
  const k = (Math.PI * 2) / L, w = Math.sqrt(G * k) * 0.8, amp = part / SUM;
  const a = `${amp.toFixed(5)}${chaos ? ' * uChaos' : ''}`;
  return `  {
    vec2 kv = vec2(cos(a0 + ${da.toFixed(4)}), sin(a0 + ${da.toFixed(4)})) * ${k.toFixed(5)};
    float ph = dot(kv, p) - ${w.toFixed(5)} * uTime + ${(i * 1.7 + (chaos ? 0.9 : 0)).toFixed(4)};
    h += ${a} * sin(ph);
    grad += kv * (${a} * cos(ph));
  }`;
};
export const WAVE_GLSL = /* glsl */ `
uniform float uWaveAmp;
uniform vec2 uWaveDir;
uniform float uChaos;
uniform vec3 uTor[${MAX_TORNADOES}];
float seaWave(vec2 p, out vec2 grad) {
  float a0 = atan(uWaveDir.y, uWaveDir.x);
  float h = 0.0;
  grad = vec2(0.0);
${WAVES.map((wv, i) => glslWave(wv, i, false)).join('\n')}
  if (uChaos > 0.01) {
${CHAOS.map((wv, i) => glslWave(wv, i, true)).join('\n')}
  }
  float m = 1.0 + (0.3 + 0.35 * uChaos) * sin(dot(p, vec2(${GROUP[0][0]}, ${GROUP[0][1]})) + ${GROUP[0][2].toFixed(2)} * uTime) * sin(dot(p, vec2(${GROUP[1][0]}, ${GROUP[1][1]})) + ${GROUP[1][2].toFixed(2)} * uTime);
  m /= 1.0 + 0.55 * uChaos;
  grad *= uWaveAmp * m;
  return h * uWaveAmp * m;
}
float torWater(vec2 p) {
  float h = 0.0;
  for (int i = 0; i < ${MAX_TORNADOES}; i++) {
    if (uTor[i].z <= 0.0) continue;
    vec2 d = p - uTor[i].xy;
    float d2 = dot(d, d);
    if (d2 > ${(TOR_REACH * TOR_REACH).toFixed(1)}) continue;
    float r = sqrt(d2);
    h += uTor[i].z * (${TOR_BUMP.toFixed(2)} * exp(-d2 / ${TOR_BUMP_R2.toFixed(1)}) + ${TOR_SWIRL.toFixed(2)} * sin(r * ${TOR_SWIRL_K.toFixed(3)} - atan(d.y, d.x) * 2.0 + uTime * 5.0) * exp(-r / ${TOR_SWIRL_R.toFixed(1)}));
  }
  return h;
}
float torNear(vec2 p) {
  float f = 0.0;
  for (int i = 0; i < ${MAX_TORNADOES}; i++) {
    if (uTor[i].z <= 0.0) continue;
    f = max(f, uTor[i].z * exp(-length(p - uTor[i].xy) / 20.0));
  }
  return f;
}
// écume sous une tornade : des bandes blanches qui tournent en spirale autour d'elle
float torFoam(vec2 p) {
  float f = 0.0;
  for (int i = 0; i < ${MAX_TORNADOES}; i++) {
    if (uTor[i].z <= 0.0) continue;
    vec2 d = p - uTor[i].xy;
    float r = length(d);
    float band = 0.5 + 0.5 * sin(r * ${TOR_SWIRL_K.toFixed(3)} - atan(d.y, d.x) * 2.0 + uTime * 5.0 + 1.2);
    f = max(f, uTor[i].z * (exp(-r / 6.0) + exp(-r / 18.0) * band * 0.8));
  }
  return min(f, 1.0);
}
float seaFactor(float depth) { return smoothstep(${SEA_DEPTH[0].toFixed(1)}, ${SEA_DEPTH[1].toFixed(1)}, depth); }
`;
