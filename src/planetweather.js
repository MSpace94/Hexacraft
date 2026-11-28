// Météo des autres planètes (Hexa garde la sienne, voir weather.js). Chaque planète qui a de l'air
// a son genre de temps, selon son style, sa température et son atmosphère :
//  - tempête de poussière : les mondes secs (type Mars, déserts, grès, mondes de fer, Tessel) ; la
//    poussière de la couleur de leur sol file avec le vent, le ciel se voile
//  - pluie de soufre : les mondes brûlants à l'air épais (Soufra) ; des gouttes jaunes, un ciel ocre
//  - pluie de cendres : les mondes volcaniques ; des cendres qui tombent, un brouillard gris
//  - blizzard : les mondes glacés ; la neige file à l'horizontale, tout blanchit
//  - pluie : les autres (mondes tempérés, océans)
// Les tempêtes vont et viennent (quelques heures de jeu), les mêmes pour tous les joueurs : elles
// ne dépendent que de la planète et du temps. Les nuits, des aurores dansent dans le ciel des
// planètes qui ont de l'air ; leur couleur dépend de l'étoile (rouges sous une naine rouge, bleues
// sous une étoile bleue, vertes et violettes près d'un pulsar). Sans air : ni temps ni aurore.
import * as THREE from 'three';
import { sunOf } from './system.js?v=1.1.0-mx09tneh';

const GRAINS = 1600;      // poussière, cendres, neige
const DROPS = 1400;       // gouttes (pluie, soufre)
const BOX = 22;           // demi-côté de la boîte autour de la caméra (blocs)
const TOP = 18, BOTTOM = -10;
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const hashS = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
const h1 = (n, s) => { let h = Math.imul((n | 0) ^ s, 2654435761); h ^= h >>> 15; h = Math.imul(h, 2246822519); h ^= h >>> 13; return (h >>> 0) / 4294967296; };
// bruit de valeur en une dimension (0..1)
const vn = (t, s) => { const i = Math.floor(t), f = t - i, u = f * f * (3 - 2 * f); return h1(i, s) * (1 - u) + h1(i + 1, s) * u; };

export const STORM_NAMES = { poussiere: 'Tempête de poussière', soufre: 'Pluie de soufre', cendres: 'Pluie de cendres', blizzard: 'Blizzard', pluie: 'Averse' };

// Le temps d'une planète : { kind, color (poussière, cendres...), aurora: [bas, haut] | null, auroraP (part des nuits) }
export function climateOf(body) {
  if (!body || body.kind === 'home') return null;
  const A = body.atmo || {}, d = A.density || 0, T = body.temp ?? 0, st = body.gen?.style || '';
  if (d < 0.05) return null;
  let kind;
  if (T > 100 && d >= 0.5) kind = 'soufre';
  else if (['volcanic', 'cinder', 'io'].includes(st)) kind = 'cendres';
  else if (['mars', 'desert', 'sandstone', 'ironworld', 'tessel', 'voss', 'lethe'].includes(st) || (st === 'biomes' && T > 32)) kind = 'poussiere';
  else if (T < -15 || ['glacier', 'redice', 'frozenocean', 'europa', 'pluto', 'glacyon', 'perse'].includes(st)) kind = 'blizzard';
  else kind = 'pluie';
  const col = kind === 'poussiere' ? new THREE.Color(body.colors?.mid || A.horizon || '#c8935a').lerp(new THREE.Color(A.horizon || '#c8935a'), 0.35)
    : kind === 'soufre' ? new THREE.Color('#d8b030') : kind === 'cendres' ? new THREE.Color('#5e5a57') : kind === 'blizzard' ? new THREE.Color('#e8f0f8') : new THREE.Color('#9ab0c4');
  // aurores : la couleur de l'étoile
  const sun = sunOf(body);
  let aurora = ['#40ff80', '#a070ff'], p = 0.3;
  if (sun?.pulsar || sun?.kind === 'hole') { aurora = ['#60ff90', '#c070ff']; p = 0.75; }
  else if (sun?.color) {
    const c = new THREE.Color(sun.color);
    if (c.r > c.b * 1.6) aurora = ['#ff3a50', '#ff90c8'];
    else if (c.b > c.r * 1.05) aurora = ['#40a0ff', '#90ffff'];
  }
  if (T < -40) p += 0.15;
  if (body.aurora) p = 1;
  return { kind, color: col, aurora: aurora.map((x) => new THREE.Color(x)), auroraP: Math.min(1, p), seed: hashS(body.id) };
}

// (les aurores d'une tempête stellaire, sur une planète sans autre temps : Hexa)
const HOME_AU = { aurora: [new THREE.Color('#40ff80'), new THREE.Color('#a070ff')] };
export class PlanetWeather {
  constructor(scene) {
    this.scene = scene;
    this.storm = 0;   // force de la tempête ici (0..1, lissée)
    this.haze = 0;    // brouillard (0..1)
    this.color = new THREE.Color();
    this.aurora = 0;
    this.kind = null;
    this.body = null;
    this.clim = null;
    this.onStorm = null; // (nom de la tempête, planète) : une tempête commence
    this.stormOn = false;
    this.last = new THREE.Vector3();
    this.density = 1;
    // grains : des points
    this.gp = new Float32Array(GRAINS * 3);
    this.gph = new Float32Array(GRAINS);
    for (let i = 0; i < GRAINS; i++) this.respawn(this.gp, i, true), (this.gph[i] = Math.random() * 6.28);
    const gg = new THREE.BufferGeometry();
    gg.setAttribute('position', new THREE.BufferAttribute(this.gp, 3));
    this.grains = new THREE.Points(gg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.14, transparent: true, opacity: 0.9, fog: true, depthWrite: false }));
    // gouttes : des traits
    this.dp = new Float32Array(DROPS * 3);
    for (let i = 0; i < DROPS; i++) this.respawn(this.dp, i, true);
    this.da = new Float32Array(DROPS * 6);
    const dg = new THREE.BufferGeometry();
    dg.setAttribute('position', new THREE.BufferAttribute(this.da, 3));
    this.drops = new THREE.LineSegments(dg, new THREE.LineBasicMaterial({ color: 0xaac4dc, transparent: true, opacity: 0.6, fog: true }));
    // aurores : un anneau de rideaux lumineux très haut autour de la caméra
    this.au = new THREE.Mesh(new THREE.CylinderGeometry(520, 520, 170, 128, 1, true), new THREE.ShaderMaterial({
      uniforms: { uT: { value: 0 }, uK: { value: 0 }, uC1: { value: new THREE.Color() }, uC2: { value: new THREE.Color() } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `varying vec2 vUv; uniform float uT, uK; uniform vec3 uC1, uC2;
        void main() {
          float a = vUv.x * 6.2831853;
          float w = sin(a * 5.0 + uT * 0.31) * 0.5 + sin(a * 13.0 - uT * 0.47) * 0.3 + sin(a * 29.0 + uT * 0.83) * 0.2;
          float band = smoothstep(0.15, 0.85, 0.5 + 0.5 * w);
          float rays = 0.55 + 0.45 * sin(a * 220.0 + uT * 1.7 + w * 4.0);
          float y = vUv.y;
          float fade = smoothstep(0.0, 0.3, y) * (1.0 - smoothstep(0.5, 1.0, y));
          gl_FragColor = vec4(mix(uC1, uC2, smoothstep(0.2, 0.9, y)), band * rays * fade * uK * 0.55);
        }`,
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false,
    }));
    for (const o of [this.grains, this.drops, this.au]) { o.frustumCulled = false; o.visible = false; scene.add(o); }
  }

  // Une particule au hasard dans la boîte (all : à n'importe quelle hauteur ; sinon en haut)
  respawn(p, i, all) {
    p[i * 3] = (Math.random() * 2 - 1) * BOX;
    p[i * 3 + 1] = all ? BOTTOM + Math.random() * (TOP - BOTTOM) : TOP - Math.random() * 3;
    p[i * 3 + 2] = (Math.random() * 2 - 1) * BOX;
  }

  // Force de la tempête sur cette planète au temps T (jours) : 0..1
  stormAt(T) {
    const c = this.clim;
    if (!c) return 0;
    const v = vn(T * 3.2, c.seed) * 0.65 + vn(T * 11, c.seed ^ 0x9e37) * 0.35;
    return smooth(0.56, 0.8, v);
  }
  // Aurore cette nuit (T : jours) : 0..1
  auroraAt(T) {
    const c = this.clim;
    if (!c) return 0;
    const night = Math.floor(T - 0.25);
    return h1(night, c.seed ^ 0x51ed) < c.auroraP ? 0.6 + 0.4 * vn(T * 20, c.seed ^ 0x77) : 0;
  }

  // body : la planète où l'on est (ou null) ; outside : la caméra sous le ciel ? daylight : 0 la nuit
  update(dt, T, camera, body, daylight, outside, weather) {
    if (body !== this.body) { this.body = body; this.clim = climateOf(body); this.storm = 0; this.stormOn = false; }
    const c = this.clim, cam = camera.position;
    const want = c ? this.stormAt(T) : 0;
    this.storm += (want - this.storm) * (1 - Math.exp(-dt * 0.4));
    if (c && !this.stormOn && want > 0.5) { this.stormOn = true; this.onStorm?.(STORM_NAMES[c.kind], body); }
    if (want < 0.2) this.stormOn = false;
    const s = this.storm, kind = c?.kind;
    // brouillard : poussière et blizzard l'épaississent le plus
    this.haze = c ? s * (kind === 'poussiere' ? 0.9 : kind === 'blizzard' ? 0.8 : kind === 'soufre' ? 0.6 : kind === 'cendres' ? 0.55 : 0.3) * (outside ? 1 : 0.35) : 0;
    if (c) this.color.copy(c.color);
    if (weather && this.haze > weather.haze) { weather.haze = this.haze; weather.hazeColor.copy(this.color); }
    // les particules, autour de la caméra
    const dx = cam.x - this.last.x, dy = cam.y - this.last.y, dz = cam.z - this.last.z;
    this.last.copy(cam);
    const far = Math.abs(dx) > BOX || Math.abs(dz) > BOX || Math.abs(dy) > 30;
    const grainsOn = !!c && outside && s > 0.03 && kind !== 'pluie' && kind !== 'soufre';
    const dropsOn = !!c && outside && s > 0.03 && (kind === 'pluie' || kind === 'soufre');
    this.grains.visible = grainsOn;
    this.drops.visible = dropsOn;
    // le vent : une direction propre à la planète, qui tourne lentement
    const wa = (c ? (c.seed % 628) / 100 : 0) + T * 0.7, wx = Math.cos(wa), wz = Math.sin(wa);
    if (grainsOn) {
      const n = Math.floor(GRAINS * Math.min(1, s * 1.2) * this.density), p = this.gp;
      const m = this.grains.material;
      m.color.copy(c.color);
      m.size = kind === 'blizzard' ? 0.16 : kind === 'cendres' ? 0.15 : 0.1;
      const sp = kind === 'poussiere' ? 10 + 14 * s : kind === 'blizzard' ? 8 + 12 * s : 1.2;
      const fall = kind === 'blizzard' ? 3 : kind === 'cendres' ? 1.1 : 0.2;
      for (let i = 0; i < GRAINS; i++) {
        if (i >= n) { p[i * 3 + 1] = -999; continue; }
        if (far || p[i * 3 + 1] === -999) this.respawn(p, i, true);
        const ph = (this.gph[i] += dt * 3);
        p[i * 3] += wx * sp * dt - dx; p[i * 3 + 2] += wz * sp * dt - dz;
        p[i * 3 + 1] += (Math.sin(ph) * 0.8 - fall) * dt - dy;
        // (la boîte suit la caméra : ce qui en sort revient de l'autre côté)
        if (p[i * 3] > BOX) p[i * 3] -= 2 * BOX; else if (p[i * 3] < -BOX) p[i * 3] += 2 * BOX;
        if (p[i * 3 + 2] > BOX) p[i * 3 + 2] -= 2 * BOX; else if (p[i * 3 + 2] < -BOX) p[i * 3 + 2] += 2 * BOX;
        if (p[i * 3 + 1] < BOTTOM) this.respawn(p, i, false); else if (p[i * 3 + 1] > TOP + 2) p[i * 3 + 1] = BOTTOM;
      }
      this.grains.geometry.setDrawRange(0, n);
      this.grains.geometry.attributes.position.needsUpdate = true;
      this.grains.position.copy(cam);
    }
    if (dropsOn) {
      const n = Math.floor(DROPS * Math.min(1, s * 1.2) * this.density), p = this.dp, a = this.da;
      this.drops.material.color.set(kind === 'soufre' ? 0xe0c040 : 0xaac4dc);
      const vy = kind === 'soufre' ? 18 : 24, slant = 3 + 6 * s, len = 0.03;
      for (let i = 0; i < n; i++) {
        if (far) this.respawn(p, i, true);
        p[i * 3] += wx * slant * dt - dx; p[i * 3 + 2] += wz * slant * dt - dz; p[i * 3 + 1] += -vy * dt - dy;
        if (p[i * 3] > BOX) p[i * 3] -= 2 * BOX; else if (p[i * 3] < -BOX) p[i * 3] += 2 * BOX;
        if (p[i * 3 + 2] > BOX) p[i * 3 + 2] -= 2 * BOX; else if (p[i * 3 + 2] < -BOX) p[i * 3 + 2] += 2 * BOX;
        if (p[i * 3 + 1] < BOTTOM) this.respawn(p, i, false);
        const o = i * 6;
        a[o] = p[i * 3]; a[o + 1] = p[i * 3 + 1]; a[o + 2] = p[i * 3 + 2];
        a[o + 3] = p[i * 3] - wx * slant * len; a[o + 4] = p[i * 3 + 1] + vy * len; a[o + 5] = p[i * 3 + 2] - wz * slant * len;
      }
      this.drops.geometry.setDrawRange(0, n * 2);
      this.drops.geometry.attributes.position.needsUpdate = true;
      this.drops.position.copy(cam);
    }
    // aurores : la nuit, dehors ou pas (on les voit par les fenêtres), moins sous la tempête
    // (stormAurora : une tempête stellaire, voir astro.js et main.js : les aurores s'allument aussi)
    const ac = c || HOME_AU, au = Math.max(c ? this.auroraAt(T) : 0, this.stormAurora || 0) * smooth(0.4, 0.1, daylight) * (1 - 0.7 * s);
    this.aurora += (au - this.aurora) * (1 - Math.exp(-dt * 0.5));
    this.au.visible = this.aurora > 0.01;
    if (this.au.visible) {
      const U = this.au.material.uniforms;
      U.uT.value = T * 1800 * 0.05;
      U.uK.value = this.aurora;
      U.uC1.value.copy(ac.aurora[0]); U.uC2.value.copy(ac.aurora[1]);
      this.au.position.set(cam.x, cam.y + 230, cam.z);
    }
  }

  // Le ciel sous la tempête : moins de soleil ; les aurores éclairent un peu la nuit
  applyToSky(sky) {
    if (this.storm > 0.01) {
      const k = this.storm * (this.clim?.kind === 'pluie' ? 0.35 : 0.5);
      sky.light.intensity *= 1 - k;
      sky.hemi.intensity *= 1 - k * 0.5;
    }
    if (this.aurora > 0.01 && this.clim) sky.hemi.intensity += this.aurora * 0.12;
  }

  clear() {
    this.storm = this.haze = this.aurora = 0;
    this.body = this.clim = null;
    this.grains.visible = this.drops.visible = this.au.visible = false;
  }
}
