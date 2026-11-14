// Météo : pluie (neige là où il fait froid) sous les nuages, et orages avec éclairs.
// Le temps qu'il fait dépend de l'endroit (climat régional, voir climate.js) : il pleut
// sous les perturbations qui traversent le monde avec le vent, sous un nuage seulement ;
// l'orage gronde là où le climat le dit, et on voit ou entend les éclairs d'un orage
// voisin même s'il ne pleut pas ici. Tout dépend de la graine et du temps : le même temps
// pour tous les joueurs d'une partie (les éclairs, eux, tombent au hasard chez chacun).
// Les gouttes (ou flocons) tombent autour de la caméra et s'arrêtent sur le premier bloc
// de leur colonne : pas de pluie sous un toit.
// Les temps des nouveaux biomes (voir biomes.js) :
//  - tempête de sable : dans le désert et la mesa, là où il pleuvrait s'il n'était pas si sec ;
//    du sable qui file avec le vent, un brouillard orangé
//  - cendres : près des volcans et des caldeiras, des cendres qui tombent sans cesse (plus fort
//    quand il pleut), un brouillard gris
//  - pluie diluvienne : les plus fortes pluies d'orage, et la pluie dans la jungle toxique : deux
//    fois plus de gouttes, plus rapides, le ciel plus sombre
//  - pluie d'astéroïdes : certaines nuits (les mêmes pour tous les joueurs d'un monde), des étoiles
//    filantes ; de temps en temps, un météore tombe et creuse un cratère (voir onImpact dans main.js)
import * as THREE from 'three';
import { worldToHex, hexToWorld, cellKey } from './hex.js?v=1.1.5-alpha-mwgq2wrb';
import { CLOUD_Y } from './clouds.js?v=1.1.5-alpha-mwgq2wrb';
import { playThunder } from './sound.js?v=1.1.5-alpha-mwgq2wrb';
import { rainSound, birdsSound, cricketsSound } from './ambience.js?v=1.1.5-alpha-mwgq2wrb';
import { isWater } from './blocks.js?v=1.1.5-alpha-mwgq2wrb';
import { BIOME } from './gen.js?v=1.1.5-alpha-mwgq2wrb';

const smoothstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
import { CS, H, idx, chunkKey, Y_MIN } from './mesher.js?v=1.1.5-alpha-mwgq2wrb';

// (sons d'ambiance : fabriqués par le jeu, voir ambience.js)
// biomes tempérés où l'on entend les oiseaux : plage, plaines, forêt, rivière, lac, grande
// forêt, forêt européenne
const TEMPERATE = new Set([2, 3, 4, 6, 7, 11, 12, 14, 15, 17]); // (et jungle toxique, champignons géants, montagnes flottantes)

const RADIUS = 22;        // zone de pluie autour de la caméra (blocs)
const TOP = 26;           // les gouttes partent jusqu'à TOP blocs au-dessus de la caméra
const DROPS = 1400;       // gouttes de pluie
const DROPS_MAX = 2800;   // ... pluie diluvienne : jusqu'au double
const DUST = 1100;        // grains de sable ou cendres
const DUST_R = 16;        // ... autour de la caméra (blocs)
const METEORS = 24;       // étoiles filantes à la fois, au plus
const SHOWER = 0.08;      // part des nuits avec une pluie d'astéroïdes
const IMPACT_EVERY = [50, 130]; // secondes entre deux météores qui touchent le sol
const FLAKES = 900;       // flocons de neige
const RAIN_SPEED = 26, SNOW_SPEED = 2.6;
const RAIN_LEN = 0.7;     // longueur d'une goutte
const STORM_LOOK = 2;     // durée (s) entre deux recherches d'orage aux alentours
const BOLT_CLOSE = 0.12; // part des éclairs qui tombent près du joueur
const STORM_NEAR = 110;   // ... à cette distance (blocs)
const TOP_CACHE = 2;      // durée (s) de la hauteur retenue de chaque colonne
const BOLT_POINTS = 40;

// Flocon : un petit hexagone blanc
function hexFlake() {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.beginPath();
  for (let k = 0; k < 6; k++) {
    const a = Math.PI / 3 * k + Math.PI / 6;
    g.lineTo(16 + Math.cos(a) * 14, 16 + Math.sin(a) * 14);
  }
  g.fill();
  return new THREE.CanvasTexture(c);
}

export class Weather {
  constructor(scene, world, clouds) {
    this.world = world;
    this.clouds = clouds;
    this.rain = 0;        // force de la pluie ici (0..1)
    this.storm = 0;       // orage (0..1)
    this.snow = false;    // il neige au lieu de pleuvoir
    this.flash = 0;       // éclair : lumière en plus (0..1)
    this.local = 0;       // un nuage au-dessus de nous ? (lissé)
    this.nextBolt = 8;
    this.nearStorm = 0;   // orage le plus fort aux alentours (0..1)
    this.stormLook = 0;
    this.here = {};       // temps ici (voir climate.js)
    this.tmp = {};
    this.tops = new Map(); // colonne -> { y, t } (premier bloc sous le ciel)
    this.clock = 0;
    this.density = 1;     // part des gouttes / flocons dessinés (qualité graphique)
    // saisons (voir seasons.js) : pluie et orages plus ou moins fréquents, neige quand il gèle
    this.rainScale = 1;
    this.stormScale = 1;
    this.coldAt = null;

    // pluie : des traits
    this.dropPos = new Float32Array(DROPS_MAX * 3);
    this.dropVel = new Float32Array(DROPS_MAX);
    this.dropEnd = new Float32Array(DROPS_MAX);
    const rg = new THREE.BufferGeometry();
    this.rainArr = new Float32Array(DROPS_MAX * 6);
    rg.setAttribute('position', new THREE.BufferAttribute(this.rainArr, 3));
    this.rainLines = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: 0xaac4dc, transparent: true, opacity: 0.55, fog: true }));
    this.rainLines.frustumCulled = false;
    this.rainLines.visible = false;
    scene.add(this.rainLines);
    // neige : des points
    this.flakePos = new Float32Array(FLAKES * 3);
    this.flakeEnd = new Float32Array(FLAKES);
    this.flakePhase = new Float32Array(FLAKES);
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(this.flakePos, 3));
    this.flakes = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.18, map: hexFlake(), alphaTest: 0.5, transparent: true, opacity: 0.95, fog: true }));
    this.flakes.frustumCulled = false;
    this.flakes.visible = false;
    scene.add(this.flakes);
    this.started = false;

    // tempête de sable, cendres : des grains autour de la caméra
    this.dustPos = new Float32Array(DUST * 3);
    this.dustPhase = new Float32Array(DUST);
    const dg = new THREE.BufferGeometry();
    dg.setAttribute('position', new THREE.BufferAttribute(this.dustPos, 3));
    this.dust = new THREE.Points(dg, new THREE.PointsMaterial({ color: 0xc8935a, size: 0.12, map: hexFlake(), alphaTest: 0.5, transparent: true, opacity: 0.9, fog: true }));
    this.dust.frustumCulled = false;
    this.dust.visible = false;
    scene.add(this.dust);
    this.dustOn = false;
    this.sand = 0; this.ash = 0; this.deluge = 0; // (0..1, lissés)
    this.haze = 0; this.hazeColor = new THREE.Color(); // brouillard de ces temps (voir main.js)
    this.outside = true; // la caméra sous le ciel ?
    this.wet = {};
    // pluie d'astéroïdes : étoiles filantes (des traits), météore qui tombe (une boule de feu)
    this.metArr = new Float32Array(METEORS * 6);
    const mg = new THREE.BufferGeometry();
    mg.setAttribute('position', new THREE.BufferAttribute(this.metArr, 3));
    this.metLines = new THREE.LineSegments(mg, new THREE.LineBasicMaterial({ color: 0xfff1c8, transparent: true, opacity: 0.9, fog: false, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.metLines.frustumCulled = false;
    this.metLines.visible = false;
    scene.add(this.metLines);
    this.meteors = [];
    this.nextMeteor = 1;
    this.nextImpact = IMPACT_EVERY[0];
    this.shower = false;
    this.fall = null;
    this.fallBall = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1, 1), new THREE.MeshBasicMaterial({ color: 0xffa040, fog: false }));
    this.fallBall.visible = false;
    scene.add(this.fallBall);

    // éclair : une ligne brisée du nuage jusqu'au sol, en ruban tourné vers la caméra (un
    // cœur blanc et un halo bleuté plus large)
    this.boltArr = new Float32Array(BOLT_POINTS * 3);
    const ribbon = (width, color, opacity) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array((BOLT_POINTS - 1) * 18), 3));
      const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false, fog: false }));
      m.frustumCulled = false;
      m.width = width;
      return m;
    };
    this.bolt = new THREE.Group();
    this.bolt.add(ribbon(2.2, 0x9fb8ff, 0.3), ribbon(0.45, 0xf8faff, 1));
    this.bolt.visible = false;
    this.boltTime = 0;
    scene.add(this.bolt);

    this.sound = null;
  }

  // Premier bloc rencontré en descendant du ciel dans la colonne (q, r) (en cache)
  groundAt(x, z, fromY) {
    const h = worldToHex(x, z), k = cellKey(h.q, h.r);
    const c = this.tops.get(k);
    if (c && this.clock - c.t < TOP_CACHE && c.from >= fromY) return c.y;
    let y = Math.floor(fromY);
    const stop = Math.max(Y_MIN, y - 60);
    // (lecture directe dans le chunk : getBlock refait la recherche du chunk à chaque bloc)
    const cq = Math.floor(h.q / CS), cr = Math.floor(h.r / CS);
    const data = this.world.chunks.get(chunkKey(cq, cr))?.data;
    if (data) {
      const lq = h.q - cq * CS, lr = h.r - cr * CS, step = CS * CS;
      if (y >= H) y = H - 1;
      let i = idx(lq, lr, y);
      while (y > stop && !data[i]) { y--; i -= step; }
    } else while (y > stop && !this.world.getBlock(h.q, h.r, y)) y--;
    const top = y + 1;
    this.tops.set(k, { y: top, t: this.clock, from: fromY });
    if (this.tops.size > 6000) this.tops.clear();
    return top;
  }

  // Nouvelle goutte / nouveau flocon au hasard autour de (cx, cz), quelque part sous TOP
  spawn(pos, i, end, cam, anyHeight) {
    const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * RADIUS;
    const x = cam.x + Math.cos(a) * d, z = cam.z + Math.sin(a) * d;
    const sky = Math.min(cam.y + TOP, CLOUD_Y);
    const y = anyHeight ? cam.y - 8 + Math.random() * (TOP + 8) : sky - Math.random() * 3;
    pos[i * 3] = x - this.ax; pos[i * 3 + 1] = Math.min(y, sky); pos[i * 3 + 2] = z - this.az;
    end[i] = this.groundAt(x, z, sky);
  }

  // Désert (sol sec : il y pleut rarement, voir climate.js) ?
  dryAt(x, z) {
    const h = worldToHex(x, z);
    return this.world.gen.biomeAt(h.q, h.r) === BIOME.DESERT ? 1 : 0;
  }

  // Temps au point (x, z) du monde au temps T : { cover, rain, storm }
  forecast(x, z, T, out = {}) {
    return this.clouds.climate.at(x, z, T, this.dryAt(x, z), out);
  }

  // days : numéro du jour, t : heure ; active : en jeu (pas sur l'écran titre) ;
  // daylight : 0 la nuit, 1 en plein jour
  update(dt, days, t, camera, active, daylight = 1) {
    this.clock += dt;
    const cam = camera.position;
    const T = days + t;
    let rain = 0, storm = 0;
    if (active) {
      const f = this.forecast(cam.x, cam.z, T, this.here);
      // sous un nuage seulement (on sort de la pluie en sortant de dessous)
      const over = this.clouds.covered(cam.x, cam.z, T) ? 1 : 0;
      this.local += (over - this.local) * (1 - Math.exp(-dt * 0.8));
      rain = Math.min(1, f.rain * this.local * this.rainScale);
      storm = Math.min(1, f.storm * this.local * this.stormScale);
    }
    const k = 1 - Math.exp(-dt * 0.5);
    this.rain += (rain - this.rain) * k;
    this.storm += (storm - this.storm) * k;
    const h = worldToHex(cam.x, cam.z);
    this.snow = active && (this.world.gen.isCold(h.q, h.r) || !!this.coldAt?.(cam.x, cam.y, cam.z));
    this.updateNewWeather(dt, cam, active, T, h, rain, storm);

    this.updateDrops(dt, cam);
    this.updateDust(dt, cam);
    this.updateBolt(dt, cam, active, T);
    this.updateMeteors(dt, cam, active, T, daylight);
    // pluie qui tombe (pas la neige, silencieuse) : bruit de pluie, plus fort sous l'orage (et le déluge)
    const level = this.snow ? 0 : Math.min(1, this.rain * (0.55 + 0.45 * this.storm) * (1 + 0.4 * this.deluge));
    if (level > 0.01 && !this.sound) this.sound = rainSound();
    this.sound?.setLevel(level);
    // oiseaux le jour, grillons la nuit : en surface (le ciel au-dessus de la tête), dans un
    // biome tempéré, pas sous la pluie ni sous l'eau
    let birds = 0, crickets = 0;
    if (active && TEMPERATE.has(this.world.gen.biomeAt(h.q, h.r)) && !isWater(this.world.getBlock(h.q, h.r, Math.floor(cam.y)))) {
      const open = this.groundAt(cam.x, cam.z, cam.y + 30) <= cam.y + 1;
      if (open) {
        birds = Math.min(1, Math.max(0, (daylight - 0.25) / 0.4)) * (1 - this.rain);
        crickets = Math.min(1, Math.max(0, (0.35 - daylight) / 0.3)) * (1 - this.rain);
      }
    }
    if (birds > 0.01 && !this.birds) this.birds = birdsSound();
    this.birds?.setLevel(birds);
    if (crickets > 0.01 && !this.crickets) this.crickets = cricketsSound();
    this.crickets?.setLevel(crickets);
  }

  // Gouttes, flocons et éclair : rangés par rapport à un point proche (ax, az), leurs maillages
  // placés là. En 32 bits, des positions loin du centre du monde perdraient leur précision (voir
  // origin.js) ; on déplace ce point quand on s'en éloigne
  anchor(cam) {
    const ax = Math.round(cam.x / 128) * 128, az = Math.round(cam.z / 128) * 128;
    if (this.ax !== undefined && Math.abs(cam.x - this.ax) < 256 && Math.abs(cam.z - this.az) < 256) return;
    const dx = (this.ax ?? ax) - ax, dz = (this.az ?? az) - az;
    for (const p of [this.dropPos, this.flakePos, this.dustPos]) for (let i = 0; i < p.length; i += 3) { p[i] += dx; p[i + 2] += dz; }
    this.ax = ax; this.az = az;
    for (const o of [this.rainLines, this.flakes, this.bolt, this.dust, this.metLines]) o.position.set(ax, 0, az);
    this.bolt.visible = false;
  }
  updateDrops(dt, cam) {
    this.anchor(cam);
    const lx = cam.x - this.ax, lz = cam.z - this.az;
    const n = this.rain;
    const showRain = n > 0.02 && !this.snow, showSnow = n > 0.02 && this.snow;
    this.rainLines.visible = showRain;
    this.flakes.visible = showSnow;
    if (!showRain && !showSnow) { this.started = false; return; }
    const first = !this.started;
    this.started = true;
    if (showRain) {
      const count = Math.min(DROPS_MAX, Math.floor(DROPS * n * this.density * (1 + this.deluge))), p = this.dropPos, arr = this.rainArr;
      // un peu de vent : les gouttes penchent
      const gust = 3 + 11 * this.storm * (0.75 + 0.25 * Math.sin(this.clock * 1.7)); // (tempête : rafales)
      const wx = this.clouds.wind.x * gust, wz = this.clouds.wind.y * gust;
      for (let i = 0; i < DROPS_MAX; i++) {
        if (i >= count) { this.dropVel[i] = 0; continue; } // (pas dessinée : voir setDrawRange)
        if (first || this.dropVel[i] === 0) { this.spawn(p, i, this.dropEnd, cam, true); this.dropVel[i] = RAIN_SPEED * (0.85 + Math.random() * 0.3) * (1 + 0.35 * this.deluge); }
        p[i * 3] += wx * dt; p[i * 3 + 2] += wz * dt;
        p[i * 3 + 1] -= this.dropVel[i] * dt;
        const dx = p[i * 3] - lx, dz = p[i * 3 + 2] - lz;
        if (p[i * 3 + 1] < this.dropEnd[i] || dx * dx + dz * dz > RADIUS * RADIUS * 1.2) this.spawn(p, i, this.dropEnd, cam, false);
        const o = i * 6, L = RAIN_LEN / RAIN_SPEED;
        arr[o] = p[i * 3]; arr[o + 1] = p[i * 3 + 1]; arr[o + 2] = p[i * 3 + 2];
        arr[o + 3] = p[i * 3] - wx * L; arr[o + 4] = p[i * 3 + 1] + RAIN_LEN; arr[o + 5] = p[i * 3 + 2] - wz * L;
      }
      this.rainLines.geometry.setDrawRange(0, count * 2);
      this.rainLines.geometry.attributes.position.needsUpdate = true;
      this.rainLines.material.opacity = Math.min(0.85, 0.3 + 0.3 * n + 0.2 * this.deluge);
    } else {
      const count = Math.floor(FLAKES * n * this.density), p = this.flakePos;
      for (let i = 0; i < FLAKES; i++) {
        if (i >= count) { p[i * 3 + 1] = -999; continue; }
        if (first || p[i * 3 + 1] === -999) { this.spawn(p, i, this.flakeEnd, cam, true); this.flakePhase[i] = Math.random() * 6.28; }
        // les flocons descendent lentement en se balançant
        const ph = (this.flakePhase[i] += dt * 1.3);
        p[i * 3] += (Math.sin(ph) * 0.6 + this.clouds.wind.x * 0.8) * dt;
        p[i * 3 + 2] += (Math.cos(ph * 0.8) * 0.6 + this.clouds.wind.y * 0.8) * dt;
        p[i * 3 + 1] -= SNOW_SPEED * dt;
        const dx = p[i * 3] - lx, dz = p[i * 3 + 2] - lz;
        if (p[i * 3 + 1] < this.flakeEnd[i] || dx * dx + dz * dz > RADIUS * RADIUS * 1.2) this.spawn(p, i, this.flakeEnd, cam, false);
      }
      this.flakes.geometry.setDrawRange(0, count);
      this.flakes.geometry.attributes.position.needsUpdate = true;
    }
  }

  // Éclairs pendant l'orage : de temps en temps, quelque part autour, avec le tonnerre
  updateBolt(dt, cam, active, T) {
    this.flash = Math.max(0, this.flash - dt * 3.5);
    if (this.boltTime > 0) {
      this.boltTime -= dt;
      // il clignote deux fois
      this.bolt.visible = this.boltTime > 0 && (this.boltTime > 0.22 || (this.boltTime < 0.16 && this.boltTime > 0.08));
    } else this.bolt.visible = false;
    if (!active) { this.nearStorm = 0; return; }
    // orage aux alentours ? (quelques points autour, de temps en temps)
    this.stormLook -= dt;
    if (this.stormLook <= 0) {
      this.stormLook = STORM_LOOK;
      let m = this.here.storm || 0;
      for (let k = 0; k < 8; k++) {
        const ang = Math.PI / 4 * k;
        m = Math.max(m, this.forecast(cam.x + Math.cos(ang) * STORM_NEAR, cam.z + Math.sin(ang) * STORM_NEAR, T, this.tmp).storm);
      }
      this.nearStorm = m;
    }
    if (this.nearStorm < 0.25) return;
    this.nextBolt -= dt;
    if (this.nextBolt > 0) return;
    // un point au hasard : l'éclair n'y tombe que s'il y a de l'orage là-bas (pas de
    // neige : il n'y a pas d'orage dans le froid)
    // (de temps en temps, tout près du joueur : on n'est pas à l'abri dehors sous l'orage)
    const close = Math.random() < BOLT_CLOSE;
    const a = Math.random() * Math.PI * 2, d = close ? 3 + Math.random() * 14 : 30 + Math.random() * 140;
    const x = cam.x + Math.cos(a) * d, z = cam.z + Math.sin(a) * d;
    const h = worldToHex(x, z), c = hexToWorld(h.q, h.r);
    const st = this.forecast(x, z, T, this.tmp).storm;
    if (st < 0.3 || Math.random() > st || this.world.gen.isCold(h.q, h.r)) { this.nextBolt = 0.7; return; }
    this.nextBolt = 4 + Math.random() * 14 / this.nearStorm;
    // elle tombe sur le plus haut bloc (un arbre, une maison, un paratonnerre...)
    const ground = this.topAt(h.q, h.r);
    // ligne brisée : chaque point s'écarte un peu au hasard
    const N = this.boltArr.length / 3;
    let px = c.x, pz = c.z;
    for (let i = 0; i < N; i++) {
      const f = i / (N - 1);
      if (i > 0 && i < N - 1) { px += (Math.random() - 0.5) * 2.2; pz += (Math.random() - 0.5) * 2.2; }
      this.boltArr[i * 3] = (i === N - 1 ? c.x + (px - c.x) * 0.3 : px) - this.ax;
      this.boltArr[i * 3 + 1] = CLOUD_Y + (ground - CLOUD_Y) * f;
      this.boltArr[i * 3 + 2] = (i === N - 1 ? c.z + (pz - c.z) * 0.3 : pz) - this.az;
    }
    this.buildBolt(cam);
    this.boltTime = 0.3;
    this.flash = 1;
    playThunder(Math.hypot(x - cam.x, z - cam.z));
    this.onStrike?.(h.q, h.r, ground, c.x, c.z);
  }

  // Dessus du plus haut bloc de la colonne (q, r) (chunk pas chargé : le sol du générateur)
  topAt(q, r) {
    const cq = Math.floor(q / CS), cr = Math.floor(r / CS);
    if (!this.world.chunks.get(chunkKey(cq, cr))?.data) return this.world.gen.surface(q, r).h + 1;
    for (let y = H - 1; y > Y_MIN; y--) if (this.world.getBlock(q, r, y)) return y + 1;
    return 0;
  }

  // Rubans de l'éclair : chaque tronçon, élargi de côté (face à la caméra)
  buildBolt(cam) {
    const p = this.boltArr, N = BOLT_POINTS;
    for (const m of this.bolt.children) {
      const a = m.geometry.attributes.position.array, w = m.width / 2;
      for (let i = 0; i < N - 1; i++) {
        const x0 = p[i * 3], y0 = p[i * 3 + 1], z0 = p[i * 3 + 2], x1 = p[i * 3 + 3], y1 = p[i * 3 + 4], z1 = p[i * 3 + 5];
        // côté : perpendiculaire au tronçon et à la direction de la caméra
        const vx = (x0 + x1) / 2 - (cam.x - this.ax), vz = (z0 + z1) / 2 - (cam.z - this.az), vl = Math.hypot(vx, vz) || 1;
        const sx = (-vz / vl) * w, sz = (vx / vl) * w;
        const o = i * 18;
        a.set([x0 - sx, y0, z0 - sz, x1 - sx, y1, z1 - sz, x1 + sx, y1, z1 + sz, x0 - sx, y0, z0 - sz, x1 + sx, y1, z1 + sz, x0 + sx, y0, z0 + sz], o);
      }
      m.geometry.attributes.position.needsUpdate = true;
    }
  }

  // ---------- Les temps des nouveaux biomes ----------
  // Sable, cendres, déluge ici (lissés), et le brouillard qui va avec (haze, hazeColor)
  updateNewWeather(dt, cam, active, T, h, rain, storm) {
    let sand = 0, ash = 0, deluge = 0;
    if (active) {
      const b = this.world.gen.biomeAt(h.q, h.r);
      // (le même climat qu'ailleurs, sans la sécheresse du désert : là où il pleuvrait, le vent soulève le sable)
      if (b === BIOME.DESERT || b === BIOME.MESA) sand = smoothstep(0.3, 0.75, this.clouds.climate.at(cam.x, cam.z, T, 0, this.wet).rain);
      if (b === BIOME.VOLCANO || b === BIOME.CALDERA) ash = 0.3 + 0.7 * smoothstep(0.2, 0.7, this.here.rain || 0);
      deluge = Math.min(1, smoothstep(0.75, 0.95, rain) * smoothstep(0.35, 0.7, storm) + (b === BIOME.TOXIC ? smoothstep(0.45, 0.85, rain) : 0));
      // sous un toit ou sous terre : on ne voit pas les grains (le brouillard reste, plus léger)
      this.outside = this.groundAt(cam.x, cam.z, cam.y + 30) <= cam.y + 1;
    }
    const k = 1 - Math.exp(-dt * 0.35);
    this.sand += (sand - this.sand) * k;
    this.ash += (ash - this.ash) * k;
    this.deluge += (deluge - this.deluge) * k;
    const hs = this.sand * 0.85, ha = this.ash * 0.55, hd = this.deluge * 0.35;
    this.haze = Math.max(hs, ha, hd) * (this.outside ? 1 : 0.35);
    if (hs >= ha && hs >= hd) this.hazeColor.setRGB(0.72, 0.5, 0.3);
    else if (ha >= hd) this.hazeColor.setRGB(0.36, 0.34, 0.33);
    else this.hazeColor.setRGB(0.42, 0.47, 0.52);
  }

  // Grains de sable (qui filent avec le vent) ou cendres (qui tombent lentement) autour de la caméra
  spawnDust(i, cam, sandy, anywhere) {
    const p = this.dustPos, a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * DUST_R;
    let x = cam.x + Math.cos(a) * d, z = cam.z + Math.sin(a) * d;
    if (sandy && !anywhere) {
      // (du côté d'où vient le vent)
      const wx = this.clouds.wind.x, wz = this.clouds.wind.y, wl = Math.hypot(wx, wz) || 1, side = (Math.random() - 0.5) * 2 * DUST_R;
      x = cam.x - (wx / wl) * DUST_R * 0.95 - (wz / wl) * side; z = cam.z - (wz / wl) * DUST_R * 0.95 + (wx / wl) * side;
    }
    const y = sandy ? cam.y - 4 + Math.random() * 10 : anywhere ? cam.y - 6 + Math.random() * 20 : cam.y + 10 + Math.random() * 4;
    p[i * 3] = x - this.ax; p[i * 3 + 1] = y; p[i * 3 + 2] = z - this.az;
    this.dustPhase[i] = Math.random() * 6.28;
  }
  updateDust(dt, cam) {
    const n = this.outside ? Math.max(this.sand, this.ash) : 0;
    const show = n > 0.03;
    this.dust.visible = show;
    if (!show) { this.dustOn = false; return; }
    const sandy = this.sand >= this.ash;
    this.dust.material.color.setHex(sandy ? 0xc8935a : 0x5e5a57);
    this.dust.material.size = sandy ? 0.1 : 0.16;
    const first = !this.dustOn || this.dustSandy !== sandy;
    this.dustOn = true; this.dustSandy = sandy;
    const count = Math.floor(DUST * n * this.density), p = this.dustPos;
    const lx = cam.x - this.ax, lz = cam.z - this.az;
    const wx = this.clouds.wind.x, wz = this.clouds.wind.y, wl = Math.hypot(wx, wz) || 1;
    const speed = 8 + 10 * this.sand;
    for (let i = 0; i < DUST; i++) {
      if (i >= count) { p[i * 3 + 1] = -999; continue; }
      if (first || p[i * 3 + 1] === -999) this.spawnDust(i, cam, sandy, true);
      const ph = (this.dustPhase[i] += dt * (sandy ? 4 : 1.2));
      if (sandy) {
        p[i * 3] += (wx / wl) * speed * dt; p[i * 3 + 2] += (wz / wl) * speed * dt;
        p[i * 3 + 1] += Math.sin(ph) * 0.9 * dt;
      } else {
        p[i * 3] += (Math.sin(ph) * 0.4 + wx * 0.6) * dt; p[i * 3 + 2] += (Math.cos(ph * 0.8) * 0.4 + wz * 0.6) * dt;
        p[i * 3 + 1] -= 1.1 * dt;
      }
      const dx = p[i * 3] - lx, dz = p[i * 3 + 2] - lz;
      if (dx * dx + dz * dz > DUST_R * DUST_R * 1.1 || p[i * 3 + 1] < cam.y - 8) this.spawnDust(i, cam, sandy, false);
    }
    this.dust.geometry.setDrawRange(0, count);
    this.dust.geometry.attributes.position.needsUpdate = true;
  }

  // Pluie d'astéroïdes : certaines nuits (selon le monde et le numéro de la nuit), des étoiles
  // filantes ; de temps en temps, un météore tombe au loin (onImpact : le cratère, voir main.js)
  updateMeteors(dt, cam, active, T, daylight) {
    const night = Math.floor(T - 0.25); // (une nuit : de la fin d'un jour au matin suivant)
    this.shower = active && daylight < 0.3 && (this.forceShower || this.world.gen.hash(night, 7717, 4242) < SHOWER);
    // étoiles filantes : des traits très haut dans le ciel
    if (this.shower && this.meteors.length < METEORS && (this.nextMeteor -= dt) <= 0) {
      this.nextMeteor = 0.15 + Math.random() * 0.9;
      const a = Math.random() * Math.PI * 2, d = 40 + Math.random() * 220, dir = Math.random() * Math.PI * 2, sp = 90 + Math.random() * 90;
      this.meteors.push({ x: cam.x + Math.cos(a) * d, y: cam.y + 110 + Math.random() * 90, z: cam.z + Math.sin(a) * d,
        vx: Math.cos(dir) * sp, vy: -sp * (0.15 + Math.random() * 0.35), vz: Math.sin(dir) * sp, life: 0.5 + Math.random() * 0.8, len: 0.08 + Math.random() * 0.06 });
    }
    for (let i = this.meteors.length - 1; i >= 0; i--) {
      const m = this.meteors[i];
      m.life -= dt; m.x += m.vx * dt; m.y += m.vy * dt; m.z += m.vz * dt;
      if (m.life <= 0) this.meteors.splice(i, 1);
    }
    let n = 0;
    for (const m of this.meteors) {
      const o = n * 6;
      this.metArr[o] = m.x - this.ax; this.metArr[o + 1] = m.y; this.metArr[o + 2] = m.z - this.az;
      this.metArr[o + 3] = m.x - m.vx * m.len - this.ax; this.metArr[o + 4] = m.y - m.vy * m.len; this.metArr[o + 5] = m.z - m.vz * m.len - this.az;
      n++;
    }
    this.metLines.visible = n > 0;
    this.metLines.geometry.setDrawRange(0, n * 2);
    this.metLines.geometry.attributes.position.needsUpdate = true;
    // un météore qui tombe jusqu'au sol, au loin, sur un sol que personne n'a touché
    if (this.shower && !this.fall && (this.nextImpact -= dt) <= 0) {
      this.nextImpact = IMPACT_EVERY[0] + Math.random() * (IMPACT_EVERY[1] - IMPACT_EVERY[0]);
      const a = Math.random() * Math.PI * 2, d = 45 + Math.random() * 120;
      const x = cam.x + Math.cos(a) * d, z = cam.z + Math.sin(a) * d, hh = worldToHex(x, z), c = hexToWorld(hh.q, hh.r);
      const ground = this.topAt(hh.q, hh.r);
      if (this.naturalGround(hh.q, hh.r, ground)) {
        const T0 = 2.6, dir = Math.random() * Math.PI * 2, sx = c.x + Math.cos(dir) * 140, sz = c.z + Math.sin(dir) * 140, sy = ground + 160;
        this.fall = { x: sx, y: sy, z: sz, vx: (c.x - sx) / T0, vy: (ground - sy) / T0, vz: (c.z - sz) / T0, t: T0, q: hh.q, r: hh.r, ground, cx: c.x, cz: c.z };
      }
    }
    const f = this.fall;
    this.fallBall.visible = !!f;
    if (!f) return;
    f.t -= dt; f.x += f.vx * dt; f.y += f.vy * dt; f.z += f.vz * dt;
    this.fallBall.position.set(f.x, f.y, f.z);
    // (sa traînée : des étincelles, voir main.js)
    this.onMeteorTrail?.(f.x, f.y, f.z);
    if (f.t <= 0) {
      this.fall = null;
      this.fallBall.visible = false;
      this.flash = Math.max(this.flash, 0.5);
      playThunder(Math.hypot(f.cx - cam.x, f.cz - cam.z));
      this.onImpact?.(f.q, f.r, f.ground, f.cx, f.cz);
    }
  }
  // Le sol de la colonne (q, r) et de ses voisines est-il celui du monde généré (rien de construit) ?
  naturalGround(q, r, top) {
    const gen = this.world.gen;
    for (const [a, b] of [[0, 0], [2, 0], [-2, 0], [0, 2], [0, -2], [2, -2], [-2, 2]]) {
      const s = gen.surface(q + a, r + b);
      const t = this.topAt(q + a, r + b); // (une touffe d'herbe haute en plus : toujours le sol d'origine)
      if (t < s.h + 1 || t > s.h + 2 || isWater(s.id)) return false;
    }
    return top > 0;
  }

  // Ciel plus sombre sous la pluie, éclairé un instant par les éclairs (après sky.update)
  applyToSky(sky) {
    const dark = Math.min(0.8, this.rain * (0.3 + 0.25 * this.storm) + 0.15 * this.deluge + 0.25 * this.sand + 0.2 * this.ash);
    sky.light.intensity *= 1 - dark;
    sky.hemi.intensity *= 1 - dark * 0.6;
    if (this.flash > 0) sky.hemi.intensity += this.flash * 1.6;
    // (chaque nuage a déjà sa teinte, voir clouds.js) : un peu plus sombres sous l'orage
    sky.clouds.material.color.multiplyScalar(1 - 0.15 * this.storm - 0.05 * this.rain);
    // tempête de sable, cendres, déluge : le ciel et le brouillard prennent leur teinte
    if (this.haze > 0.01) {
      const hc = this.hazeTint || (this.hazeTint = new THREE.Color());
      hc.copy(this.hazeColor).multiplyScalar(0.25 + 0.75 * sky.daylight);
      sky.uniforms.horizon.value.lerp(hc, this.haze);
      sky.uniforms.top.value.lerp(hc, this.haze * 0.6);
      sky.scene.fog.color.lerp(hc, this.haze);
    }
  }

  // Shaders de la pluie, de la neige et de l'éclair compilés tout de suite (sinon la
  // première averse ou le premier éclair fait geler le jeu un instant)
  warmUp(renderer, scene, camera) {
    const objs = [this.rainLines, this.flakes, this.bolt, this.dust, this.metLines, this.fallBall], was = objs.map((o) => o.visible);
    objs.forEach((o) => { o.visible = true; });
    try { renderer.compile(scene, camera); } catch { /* (rien de grave) */ }
    objs.forEach((o, i) => { o.visible = was[i]; });
  }

  clear() {
    this.rain = this.storm = this.local = this.flash = this.nearStorm = 0;
    this.sand = this.ash = this.deluge = this.haze = 0;
    this.stormLook = 0;
    this.started = this.dustOn = false;
    this.meteors.length = 0; this.fall = null;
    this.rainLines.visible = this.flakes.visible = this.bolt.visible = this.dust.visible = this.metLines.visible = this.fallBall.visible = false;
    this.sound?.setLevel(0);
    this.birds?.setLevel(0);
    this.crickets?.setLevel(0);
  }
}
