// Saisons : printemps, été, automne, hiver, au fil des jours (une année de YEAR_DAYS jours de
// jeu). Tout vient de la date (numéro du jour et heure, les mêmes pour tous les joueurs en
// ligne) et de l'endroit : rien n'est sauvegardé, rien n'est remaillé.
//  - température : celle de la région (climat du générateur), l'écart de la saison (fort dans
//    les régions tempérées, nul au désert), l'altitude (plus froid en montagne) et la nuit ;
//  - feuillage (dans le shader du terrain) : vert tendre et arbres en fleurs au printemps, herbe
//    qui jaunit en été, feuilles jaunes, orange et rouges en automne, puis qui tombent ; arbres
//    nus en hiver. Chaque arbre a son rythme ; les régions chaudes restent vertes ;
//  - neige au sol : des couches de neige, quand il neige et gèle (voir snow.js) ;
//  - météo : la pluie tombe en neige quand il gèle, plus de pluie en automne, des orages l'été ;
//  - soleil plus bas en hiver (ombres plus longues), les cultures et les pousses poussent moins
//    vite dans le froid (pas du tout dehors quand il gèle, mais toujours sous un toit) ;
//  - feuilles mortes qui tombent des arbres en automne, autour du joueur.
// Coût : deux lectures de texture de plus par pixel du terrain (masque des feuillages, carte
// du climat), une carte du climat de 64 x 64 refaite peu à peu quand on s'éloigne.
import * as THREE from 'three';
import { worldToHex, hexToWorld } from './hex.js?v=1.1.5-alpha-mw17vbxj';
import { BIOME } from './gen.js?v=1.1.5-alpha-mw17vbxj';
import { DECIDUOUS_LEAVES } from './blocks.js?v=1.1.5-alpha-mw17vbxj';
import { ORIGIN, uOrigin } from './origin.js?v=1.1.5-alpha-mw17vbxj';

export const SEASON_DAYS = 21;               // jours par saison
export const YEAR_DAYS = SEASON_DAYS * 4;
export const SEASON_NAMES = ['Printemps', 'Été', 'Automne', 'Hiver'];
const START = 0.1;                           // un nouveau monde commence au milieu du printemps
const LAG = 0.06;                            // retard de la neige au sol sur le froid (part d'année)
// Carte du climat autour de la caméra : MAP x MAP points, SPAN blocs de côté
const MAP = 64, SPAN = 2048, REBUILD = 420;
// Écart de la saison selon le biome (1 : tempéré ; 0 : désert, volcan)
const AMP = { [BIOME.DESERT]: 0, [BIOME.VOLCANO]: 0, [BIOME.SNOWY]: 0.4, [BIOME.BIG_FOREST]: 0.9 };
const BIOME_TEMP = { [BIOME.DESERT]: 0.75, [BIOME.SNOWY]: -0.65, [BIOME.VOLCANO]: 0.5 };
// Feuilles des arbres à feuilles caduques (chêne, châtaignier, tilleul, bouleau : posées ou non)
const DECIDUOUS = new Set(DECIDUOUS_LEAVES);
const LEAVES_MAX = 360;
// Couleurs des feuilles d'automne (et de celles qui tombent)
const AUTUMN = [[0.85, 0.65, 0.15], [0.86, 0.42, 0.12], [0.7, 0.18, 0.1]];

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// Écart de température de la saison (phase p de l'année, 0 : début du printemps) : -1 au
// cœur de l'hiver (fin janvier), +1 au cœur de l'été (fin juillet)
// gâteaux chauffants : chaleur autour d'eux, réchauffement du monde (°C par jour de jeu, pour
// n gâteaux : WARM_DAY * √n), refroidissement sans eux, plafond
const HEAT_R = 7, HEAT_UP = 22, WARM_DAY = 0.15, COOL_DAY = 0.05, WARM_MAX = 10, POL_WARM = 0.1;
const anomaly = (p) => Math.cos(2 * Math.PI * (p - 0.35));

const SHADER_HEAD = `
uniform sampler2D uSeasonMask, uClimateMap;
uniform float uPhase;
uniform vec4 uSeasonT;     // écart de la saison, le même avec du retard (neige), neige fraîche, nuit
uniform float uWarm;       // réchauffement climatique (°C, voir warming)
uniform vec4 uClimateArea; // origine (x, z) et côté de la carte du climat, niveau de la mer
uniform vec2 uOrigin;      // (motifs : la scène est près de l'origine flottante, voir origin.js)
uniform vec4 uSmog[8];     // pollution des usines (voir industry.js) : centre (x, z), rayon, force
varying vec3 vSWorld;
varying float vSUp;
float sHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
// bruit lisse (valeurs au hasard aux nœuds, interpolées) : des plaques aux bords arrondis
float sNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(sHash(i), sHash(i + vec2(1.0, 0.0)), f.x), mix(sHash(i + vec2(0.0, 1.0)), sHash(i + vec2(1.0, 1.0)), f.x), f.y);
}
void seasonColor(inout vec4 dc) {
  vec4 cl = texture2D(uClimateMap, clamp((vSWorld.xz - uClimateArea.xy) / uClimateArea.z + 0.5, 0.0, 1.0));
  float amp = cl.r;
  if (amp < 0.01) return;
  float mean = 12.0 + 14.0 * (cl.g * 2.0 - 1.0) - max(0.0, vSWorld.y - uClimateArea.w) * 0.22 + uWarm;
  float tNow = mean + amp * 13.0 * uSeasonT.x + uSeasonT.w;
  float tLag = mean + amp * 13.0 * uSeasonT.y;
  vec4 m = texture2D(uSeasonMask, vMapUv);
  float lum = dot(dc.rgb, vec3(0.3, 0.59, 0.11));
  vec2 pat = vSWorld.xz + uOrigin;
  float tree = sHash(floor(pat / 5.0));
  if (m.r > 0.5) {
    // (chaque arbre à son rythme ; en montagne, l'automne arrive plus tôt)
    float x = fract(uPhase + (tree - 0.5) * 0.05 + clamp((10.0 - mean) * 0.004, -0.03, 0.06));
    float leafK = amp * (1.0 - smoothstep(20.0, 27.0, mean));
    float fresh = 1.0 - smoothstep(0.04, 0.2, x);
    float dry = smoothstep(0.3, 0.45, x) * (1.0 - smoothstep(0.55, 0.62, x)) * smoothstep(8.0, 18.0, mean);
    if (m.g > 0.5) {
      float autumn = smoothstep(0.52, 0.63, x);
      float bare = x < 0.5 ? 1.0 - smoothstep(0.0, 0.035, x) : smoothstep(0.62, 0.74, x);
      float bloom = smoothstep(0.02, 0.06, x) * (1.0 - smoothstep(0.1, 0.15, x)) * step(0.55, tree);
      // (l'hiver, toutes les feuilles tombent : des brindilles d'un pixel faisaient un nuage de points)
      if (m.b < bare * leafK * 1.02) discard;
      vec3 c = mix(dc.rgb, vec3(0.42, 0.74, 0.2) * lum * 2.3, fresh * 0.45 * leafK);
      vec3 pal = m.b < 0.4 ? vec3(${AUTUMN[0].join(', ')}) : m.b < 0.75 ? vec3(${AUTUMN[1].join(', ')}) : vec3(${AUTUMN[2].join(', ')});
      c = mix(c, pal * lum * 2.6, autumn * leafK);
      c = mix(c, vec3(0.33, 0.25, 0.18) * lum * 2.2, bare * leafK);
      if (m.b > 0.86) c = mix(c, tree > 0.8 ? vec3(1.0, 0.98, 0.95) : vec3(1.0, 0.78, 0.88), bloom * leafK);
      dc.rgb = c;
    } else {
      float dormant = x < 0.5 ? 1.0 - smoothstep(0.0, 0.07, x) : smoothstep(0.6, 0.76, x);
      vec3 c = mix(dc.rgb, vec3(0.45, 0.76, 0.24) * lum * 2.2, fresh * 0.4 * leafK);
      c = mix(c, vec3(0.68, 0.66, 0.32) * lum * 2.3, dry * 0.55 * leafK);
      dc.rgb = mix(c, vec3(0.55, 0.49, 0.3) * lum * 2.3, dormant * 0.75 * amp);
    }
  }
  // fumée des usines : le feuillage alentour se salit, gris jaunâtre
  if (m.r > 0.5) {
    float smog = 0.0;
    for (int i = 0; i < 8; i++) {
      vec4 sm = uSmog[i];
      if (sm.w > 0.0) smog = max(smog, sm.w * (1.0 - smoothstep(sm.z * 0.5, sm.z, distance(vSWorld.xz, sm.xy))));
    }
    if (smog > 0.0) dc.rgb = mix(dc.rgb, vec3(0.5, 0.47, 0.36) * lum * 1.9, smog * 0.75);
  }
  // (la neige au sol : de vraies couches de neige, voir snow.js)
}
`;

export class Seasons {
  constructor(scene, world, mask) {
    this.heaters = new Map(); // gâteau chauffant -> [x, y, z]
    this.warming = 0;
    this.world = world;
    this.T = 0;
    this.fresh = 0;          // neige tombée récemment (0..1), là où il gèle
    this.mapData = new Uint8Array(MAP * MAP * 4);
    this.map = new THREE.DataTexture(this.mapData, MAP, MAP, THREE.RGBAFormat);
    this.map.magFilter = this.map.minFilter = THREE.LinearFilter;
    this.map.needsUpdate = true;
    this.center = null;      // centre de la carte (x, z)
    this.job = null;         // carte en cours de calcul
    this.uniforms = {
      uSeasonMask: { value: mask }, uClimateMap: { value: this.map }, uPhase: { value: START },
      uSeasonT: { value: new THREE.Vector4() }, uWarm: { value: 0 }, uClimateArea: { value: new THREE.Vector4(0, 0, SPAN, 24) }, uOrigin,
      uSmog: { value: Array.from({ length: 8 }, () => new THREE.Vector4()) },
    };
    this.smog = null; // (taches de pollution dans le monde, voir setSmog)
    this.area = new THREE.Vector4(0, 0, SPAN, 24); // (la carte du climat, dans le monde ; le shader la reçoit près de l'origine)
    // feuilles mortes qui tombent
    const pos = new Float32Array(LEAVES_MAX * 3).fill(-1e5), col = new Float32Array(LEAVES_MAX * 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const c = document.createElement('canvas');
    c.width = c.height = 8;
    const cx = c.getContext('2d');
    cx.fillStyle = '#fff';
    cx.fillRect(1, 2, 6, 4);
    cx.fillRect(2, 1, 4, 6);
    const tex = new THREE.CanvasTexture(c);
    tex.magFilter = THREE.NearestFilter;
    this.leaves = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.24, map: tex, vertexColors: true, alphaTest: 0.5, fog: true }));
    this.leaves.frustumCulled = false;
    this.leaves.visible = false;
    scene.add(this.leaves);
    this.leafPos = pos;
    this.leafState = Array.from({ length: LEAVES_MAX }, () => ({ on: false, end: 0, t: 0, ph: 0, rest: 0 }));
    this.leafAcc = 0;
  }

  // ---------- Calendrier ----------
  // T : jours depuis le début du monde (numéro du jour + heure)
  phase(T = this.T) { return (((T / YEAR_DAYS + START) % 1) + 1) % 1; }
  season(T = this.T) { return Math.floor(this.phase(T) * 4) % 4; }
  // jour de la saison (1..SEASON_DAYS)
  dayOf(T = this.T) { return Math.floor((this.phase(T) * 4 % 1) * SEASON_DAYS) + 1; }
  // Jours à ajouter à T pour arriver au début de la saison s
  daysTo(s, T = this.T) {
    const d = ((s / 4 - this.phase(T)) % 1 + 1) % 1;
    return Math.ceil(d * YEAR_DAYS - 1e-6);
  }
  label(T = this.T) { return `${SEASON_NAMES[this.season(T)]}, jour ${this.dayOf(T)}/${SEASON_DAYS}`; }

  // ---------- Climat ----------
  // Température moyenne de la région (°C, au niveau de la mer) et écart de la saison (0..1)
  regionAt(q, r) {
    const gen = this.world.gen, biome = gen.biomeAt(q, r), g = gen.at ? gen.at(q, r) : gen;
    let temp = BIOME_TEMP[biome] ?? 0;
    if (g.v3 && g.version >= 5) {
      const { x, z } = hexToWorld(q, r);
      temp = g.climate(x, z, 0).temp;
    }
    return { amp: AMP[biome] ?? 1, temp, sea: g.sea ?? 24 };
  }
  // Température (°C) au point (x, y, z) maintenant (lue sur la carte du climat)
  // (under : sous terre, la chaleur de la Terre ; sans : l'air de la surface au-dessus)
  tempAt(x, y, z, under = true) {
    const u = this.area;
    const i = Math.max(0, Math.min(MAP - 1, Math.floor(((x - u.x) / u.z + 0.5) * MAP)));
    const j = Math.max(0, Math.min(MAP - 1, Math.floor(((z - u.y) / u.z + 0.5) * MAP)));
    const k = (j * MAP + i) * 4, amp = this.mapData[k] / 255, region = (this.mapData[k + 1] / 255) * 2 - 1;
    const mean = 12 + 14 * region - Math.max(0, y - u.w) * 0.22 + this.warming;
    let air = mean + amp * 13 * this.uniforms.uSeasonT.value.x + this.uniforms.uSeasonT.value.w;
    // gâteaux chauffants proches : jusqu'à HEAT_UP °C de plus, sur HEAT_R blocs
    for (const h of this.heaters.values()) {
      const d = Math.hypot(x - h[0], y - h[1], z - h[2]);
      if (d < HEAT_R) air += HEAT_UP * (1 - d / HEAT_R);
    }
    if (y >= 0 || !under) return air;
    // sous terre : la saison ne compte plus (14 °C), puis la chaleur de la Terre monte avec la
    // profondeur, bien plus vite dans l'abîme (sous -80 : environ 90 °C tout au fond)
    const g = Math.min(1, -y / 20), deep = 14 + -y * 0.3 + Math.max(0, -y - 80) * 0.75;
    return air * (1 - g) + deep * g;
  }
  // Vitesse de pousse des plantes à cette température (1 : normale)
  growth(t) { return Math.max(0, Math.min(1.25, (t - 3) / 12)); }

  // Carte du climat autour de (x, z) : calculée par rangées, au plus budget ms par image
  work(x, z, budget) {
    if (!this.job) {
      if (this.center && Math.hypot(x - this.center.x, z - this.center.z) < REBUILD) return;
      this.job = { x: Math.round(x / 64) * 64, z: Math.round(z / 64) * 64, row: 0, data: new Uint8Array(MAP * MAP * 4), sea: 24 };
      if (!this.center) budget = Infinity; // (la première fois : tout de suite)
    }
    const j = this.job, end = performance.now() + budget;
    while (j.row < MAP) {
      const wz = j.z + ((j.row + 0.5) / MAP - 0.5) * SPAN;
      for (let i = 0; i < MAP; i++) {
        const wx = j.x + ((i + 0.5) / MAP - 0.5) * SPAN, h = worldToHex(wx, wz), c = this.regionAt(h.q, h.r), k = (j.row * MAP + i) * 4;
        j.data[k] = Math.round(c.amp * 255);
        j.data[k + 1] = Math.round(Math.max(0, Math.min(1, (c.temp + 1) / 2)) * 255);
        j.data[k + 3] = 255;
        j.sea = c.sea;
      }
      j.row++;
      if (performance.now() > end) return;
    }
    this.mapData.set(j.data);
    this.map.needsUpdate = true;
    this.area.set(j.x, j.z, SPAN, j.sea);
    this.center = { x: j.x, z: j.z };
    this.job = null;
  }
  // ---------- Gâteaux chauffants (voir HEAT_CAKE dans blocks.js) ----------
  // Leurs positions (sauvegardées avec le monde) : chacun réchauffe l'air autour de lui, et tous
  // ensemble le climat du monde, peu à peu (warming, °C : plafonné à WARM_MAX) ; sans gâteau,
  // le climat se refroidit lentement.
  setHeater(q, r, y, on) {
    const k = q + ',' + r + ',' + y;
    if (!on) { this.heaters.delete(k); return; }
    const c = hexToWorld(q, r);
    this.heaters.set(k, [c.x, y + 0.25, c.z]);
  }
  saveHeat() { return { w: Math.round(this.warming * 1000) / 1000, h: [...this.heaters.keys()] }; }
  loadHeat(d) {
    this.heaters.clear();
    this.warming = Number.isFinite(d?.w) ? Math.max(0, Math.min(WARM_MAX, d.w)) : 0;
    for (const k of Array.isArray(d?.h) ? d.h : []) {
      const p = String(k).split(',').map(Number);
      if (p.length === 3 && p.every(Number.isInteger)) this.setHeater(p[0], p[1], p[2], true);
    }
  }
  updateWarming(T) {
    const dt = this.lastT === undefined ? 0 : Math.max(0, Math.min(1, T - this.lastT)); // (jours)
    this.lastT = T;
    // (la fumée des usines réchauffe aussi le climat : POL_WARM °C par jour pour 1000 de pollution)
    const n = this.heaters.size, smoke = Math.min(3, (this.polLoad?.() || 0) / 1000) * POL_WARM;
    const up = (n ? WARM_DAY * Math.sqrt(n) : 0) + smoke;
    this.warming = up ? Math.min(WARM_MAX, this.warming + dt * up) : Math.max(0, this.warming - dt * COOL_DAY);
    this.uniforms.uWarm.value = this.warming;
  }

  // Nouveau monde : la carte est à refaire
  reset() { this.center = null; this.job = null; this.fresh = 0; for (const s of this.leafState) s.on = false; this.leafPos.fill(-1e5); }

  // ---------- Chaque image ----------
  // T : jours (numéro du jour + heure) ; daylight : 0 la nuit, 1 le jour ; weather : la météo
  update(dt, T, camera, daylight, weather, active) {
    this.T = T;
    this.updateWarming(T);
    const cam = camera.position, p = this.phase(T);
    this.work(cam.x, cam.z, 1.5);
    const u = this.uniforms;
    // (pollution : près de l'origine, comme le reste de la scène)
    if (this.smog) this.smog.forEach((w, i) => u.uSmog.value[i].set(w.x - ORIGIN.x, w.y - ORIGIN.z, w.z, w.w));
    u.uPhase.value = p;
    u.uClimateArea.value.set(this.area.x - ORIGIN.x, this.area.y - ORIGIN.z, this.area.z, this.area.w);
    u.uSeasonT.value.set(anomaly(p), anomaly(p - LAG), this.fresh, (daylight - 0.6) * 6);
    // neige fraîche : elle tombe quand il neige et gèle ici, et fond quand il fait doux
    this.here = this.tempAt(cam.x, cam.y, cam.z);
    // (la neige fraîche dépend de l'air dehors, même quand on est sous terre)
    const t = this.tempAt(cam.x, cam.y, cam.z, false);
    if (weather.snow && weather.rain > 0.05 && t < 1.5) this.fresh = Math.min(1, this.fresh + dt * weather.rain / 90);
    else if (t > 1) this.fresh = Math.max(0, this.fresh - dt * (t - 0.5) / 400);
    // météo de la saison : plus de pluie en automne, des orages l'été, presque pas l'hiver
    const a = anomaly(p), autumn = Math.cos(2 * Math.PI * (p - 0.62));
    weather.rainScale = 1 + 0.25 * autumn - 0.1 * a;
    weather.stormScale = Math.max(0.15, 1 + 0.7 * a);
    weather.coldAt = (x, y, z) => this.tempAt(x, y, z) < 1;
    this.fallLeaves(dt, cam, p, active);
  }
  // Hauteur du soleil : plus bas l'hiver (inclinaison de sa course, voir sky.js)
  sunTilt() { return 0.3 - 0.28 * anomaly(this.phase()); }

  // ---------- Feuilles mortes ----------
  fallLeaves(dt, cam, p, active) {
    const x = (p + 1) % 1, rate = active ? smooth(0.55, 0.63, x) * (1 - smooth(0.72, 0.78, x)) : 0;
    const list = this.leafState, pos = this.leafPos;
    // (positions par rapport à un point proche, le maillage placé là : en 32 bits, loin du centre
    // du monde, elles perdraient leur précision ; on le déplace quand on s'en éloigne)
    const L = this.leaves.position, ax = Math.round(cam.x / 256) * 256, az = Math.round(cam.z / 256) * 256;
    if (Math.abs(cam.x - L.x) > 512 || Math.abs(cam.z - L.z) > 512) {
      for (let i = 0; i < LEAVES_MAX; i++) if (list[i].on) { pos[i * 3] += L.x - ax; pos[i * 3 + 2] += L.z - az; }
      L.set(ax, 0, az);
    }
    let live = 0;
    if (rate > 0) {
      this.leafAcc += dt * rate * 40;
      for (let n = 0; n < 6 && this.leafAcc >= 1; n++) {
        this.leafAcc -= 1;
        this.spawnLeaf(cam);
      }
      if (this.leafAcc > 6) this.leafAcc = 0;
    }
    for (let i = 0; i < LEAVES_MAX; i++) {
      const s = list[i];
      if (!s.on) continue;
      live++;
      const k = i * 3;
      if (pos[k + 1] > s.end) {
        // (elle tombe en tournoyant, le vent la pousse un peu)
        s.t += dt;
        pos[k] += Math.sin(s.t * 2.1 + s.ph) * 0.9 * dt + 0.25 * dt;
        pos[k + 1] -= (0.7 + 0.35 * Math.sin(s.t * 3.3 + s.ph)) * dt;
        pos[k + 2] += Math.cos(s.t * 1.7 + s.ph) * 0.9 * dt;
        if (pos[k + 1] <= s.end) pos[k + 1] = s.end + 0.03;
      } else if ((s.rest -= dt) <= 0) { s.on = false; pos[k + 1] = -1e5; }
    }
    this.leaves.visible = live > 0;
    if (live) this.leaves.geometry.attributes.position.needsUpdate = true;
  }
  spawnLeaf(cam) {
    const i = this.leafState.findIndex((s) => !s.on);
    if (i < 0) return;
    const a = Math.random() * Math.PI * 2, d = 3 + Math.random() * 22;
    const x = cam.x + Math.cos(a) * d, z = cam.z + Math.sin(a) * d, h = worldToHex(x, z), w = this.world;
    // (une feuille d'arbre à feuilles caduques avec de l'air dessous, dans la colonne)
    let y = Math.floor(cam.y) + 14, leaf = -1;
    for (const stop = y - 26; y > stop; y--) {
      const id = w.getBlock(h.q, h.r, y);
      if (DECIDUOUS.has(id)) { if (!w.getBlock(h.q, h.r, y - 1)) { leaf = y; break; } }
      else if (id && leaf < 0 && y < cam.y - 2) return;
    }
    if (leaf < 0 || this.tempAt(x, leaf, z) > 22) return;
    let g = leaf - 1;
    while (g > leaf - 30 && !w.getBlock(h.q, h.r, g)) g--;
    const s = this.leafState[i], k = i * 3, c = AUTUMN[Math.floor(Math.random() * 3)], col = this.leaves.geometry.attributes.color;
    s.on = true; s.end = g + 1; s.t = 0; s.ph = Math.random() * 6; s.rest = 4 + Math.random() * 4;
    this.leafPos[k] = x - this.leaves.position.x; this.leafPos[k + 1] = leaf - 0.05; this.leafPos[k + 2] = z - this.leaves.position.z;
    col.setXYZ(i, c[0] * 0.8, c[1] * 0.8, c[2] * 0.8);
    col.needsUpdate = true;
  }

  // ---------- Shader du terrain ----------
  // Ajoute les saisons à un matériau du terrain (onBeforeCompile, après celui de world.js : il
  // faut la lumière du ciel vLight, et la texture de l'atlas)
  // Taches de pollution (Vector4 : x, z du monde, rayon, force), tenues à jour par industry.js
  setSmog(list) { this.smog = list; }

  patch(sh) {
    Object.assign(sh.uniforms, this.uniforms);
    sh.vertexShader = 'varying vec3 vSWorld;\nvarying float vSUp;\n' + sh.vertexShader.replace('#include <project_vertex>',
      '#include <project_vertex>\n  vSWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;\n  vSUp = normalize(mat3(modelMatrix) * objectNormal).y;');
    sh.fragmentShader = sh.fragmentShader
      .replace('void main() {', SHADER_HEAD + 'void main() {')
      .replace('#include <color_fragment>', 'seasonColor(diffuseColor);\n#include <color_fragment>');
  }
}
