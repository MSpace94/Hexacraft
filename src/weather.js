// Météo : pluie (neige là où il fait froid) sous les nuages, et orages avec éclairs.
// Le temps qu'il fait dépend de l'endroit (climat régional, voir climate.js) : il pleut
// sous les perturbations qui traversent le monde avec le vent, sous un nuage seulement ;
// l'orage gronde là où le climat le dit, et on voit ou entend les éclairs d'un orage
// voisin même s'il ne pleut pas ici. Tout dépend de la graine et du temps : le même temps
// pour tous les joueurs d'une partie (les éclairs, eux, tombent au hasard chez chacun).
// Les gouttes (ou flocons) tombent autour de la caméra et s'arrêtent sur le premier bloc
// de leur colonne : pas de pluie sous un toit.
import * as THREE from 'three';
import { worldToHex, hexToWorld } from './hex.js?v=1.1.5-alpha-mvm2b95g';
import { CLOUD_Y } from './clouds.js?v=1.1.5-alpha-mvm2b95g';
import { playThunder, loopSample } from './sound.js?v=1.1.5-alpha-mvm2b95g';
import { isWater } from './blocks.js?v=1.1.5-alpha-mvm2b95g';
import { BIOME } from './gen.js?v=1.1.5-alpha-mvm2b95g';
import { CS, H, idx, chunkKey, Y_MIN } from './mesher.js?v=1.1.5-alpha-mvm2b95g';

// Sons d'ambiance (dossier sons/, enregistrements de LaSonotheque.fr)
const RAIN_SOUND = 'sons/pluie_orage.mp3';
const BIRDS_SOUND = 'sons/oiseaux_campagne.mp3';
const CRICKETS_SOUND = 'sons/grillons_nuit.mp3';
// biomes tempérés où l'on entend les oiseaux : plage, plaines, forêt, rivière, lac, grande
// forêt, forêt européenne
const TEMPERATE = new Set([2, 3, 4, 6, 7, 11, 12]);

const RADIUS = 22;        // zone de pluie autour de la caméra (blocs)
const TOP = 26;           // les gouttes partent jusqu'à TOP blocs au-dessus de la caméra
const DROPS = 1400;       // gouttes de pluie
const FLAKES = 900;       // flocons de neige
const RAIN_SPEED = 26, SNOW_SPEED = 2.6;
const RAIN_LEN = 0.7;     // longueur d'une goutte
const STORM_LOOK = 2;     // durée (s) entre deux recherches d'orage aux alentours
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

    // pluie : des traits
    this.dropPos = new Float32Array(DROPS * 3);
    this.dropVel = new Float32Array(DROPS);
    this.dropEnd = new Float32Array(DROPS);
    const rg = new THREE.BufferGeometry();
    this.rainArr = new Float32Array(DROPS * 6);
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
    const h = worldToHex(x, z), k = h.q * 100003 + h.r;
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
    pos[i * 3] = x; pos[i * 3 + 1] = Math.min(y, sky); pos[i * 3 + 2] = z;
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
      rain = f.rain * this.local;
      storm = f.storm * this.local;
    }
    const k = 1 - Math.exp(-dt * 0.5);
    this.rain += (rain - this.rain) * k;
    this.storm += (storm - this.storm) * k;
    const h = worldToHex(cam.x, cam.z);
    this.snow = active && this.world.gen.isCold(h.q, h.r);

    this.updateDrops(dt, cam);
    this.updateBolt(dt, cam, active, T);
    // pluie qui tombe (pas la neige, silencieuse) : bruit de pluie, plus fort sous l'orage
    const level = this.snow ? 0 : this.rain * (0.55 + 0.45 * this.storm);
    if (level > 0.01 && !this.sound) this.sound = loopSample(RAIN_SOUND, 0.9, 'weather');
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
    if (birds > 0.01 && !this.birds) this.birds = loopSample(BIRDS_SOUND, 0.55);
    this.birds?.setLevel(birds);
    if (crickets > 0.01 && !this.crickets) this.crickets = loopSample(CRICKETS_SOUND, 0.5);
    this.crickets?.setLevel(crickets);
  }

  updateDrops(dt, cam) {
    const n = this.rain;
    const showRain = n > 0.02 && !this.snow, showSnow = n > 0.02 && this.snow;
    this.rainLines.visible = showRain;
    this.flakes.visible = showSnow;
    if (!showRain && !showSnow) { this.started = false; return; }
    const first = !this.started;
    this.started = true;
    if (showRain) {
      const count = Math.floor(DROPS * n * this.density), p = this.dropPos, arr = this.rainArr;
      // un peu de vent : les gouttes penchent
      const gust = 3 + 11 * this.storm * (0.75 + 0.25 * Math.sin(this.clock * 1.7)); // (tempête : rafales)
      const wx = this.clouds.wind.x * gust, wz = this.clouds.wind.y * gust;
      for (let i = 0; i < DROPS; i++) {
        if (i >= count) { this.dropVel[i] = 0; continue; } // (pas dessinée : voir setDrawRange)
        if (first || this.dropVel[i] === 0) { this.spawn(p, i, this.dropEnd, cam, true); this.dropVel[i] = RAIN_SPEED * (0.85 + Math.random() * 0.3); }
        p[i * 3] += wx * dt; p[i * 3 + 2] += wz * dt;
        p[i * 3 + 1] -= this.dropVel[i] * dt;
        const dx = p[i * 3] - cam.x, dz = p[i * 3 + 2] - cam.z;
        if (p[i * 3 + 1] < this.dropEnd[i] || dx * dx + dz * dz > RADIUS * RADIUS * 1.2) this.spawn(p, i, this.dropEnd, cam, false);
        const o = i * 6, L = RAIN_LEN / RAIN_SPEED;
        arr[o] = p[i * 3]; arr[o + 1] = p[i * 3 + 1]; arr[o + 2] = p[i * 3 + 2];
        arr[o + 3] = p[i * 3] - wx * L; arr[o + 4] = p[i * 3 + 1] + RAIN_LEN; arr[o + 5] = p[i * 3 + 2] - wz * L;
      }
      this.rainLines.geometry.setDrawRange(0, count * 2);
      this.rainLines.geometry.attributes.position.needsUpdate = true;
      this.rainLines.material.opacity = 0.3 + 0.3 * n;
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
        const dx = p[i * 3] - cam.x, dz = p[i * 3 + 2] - cam.z;
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
    const a = Math.random() * Math.PI * 2, d = 30 + Math.random() * 140;
    const x = cam.x + Math.cos(a) * d, z = cam.z + Math.sin(a) * d;
    const h = worldToHex(x, z), c = hexToWorld(h.q, h.r);
    const st = this.forecast(x, z, T, this.tmp).storm;
    if (st < 0.3 || Math.random() > st || this.world.gen.isCold(h.q, h.r)) { this.nextBolt = 0.7; return; }
    this.nextBolt = 4 + Math.random() * 14 / this.nearStorm;
    const ground = this.world.gen.surface(h.q, h.r).h + 1;
    // ligne brisée : chaque point s'écarte un peu au hasard
    const N = this.boltArr.length / 3;
    let px = c.x, pz = c.z;
    for (let i = 0; i < N; i++) {
      const f = i / (N - 1);
      if (i > 0 && i < N - 1) { px += (Math.random() - 0.5) * 2.2; pz += (Math.random() - 0.5) * 2.2; }
      this.boltArr[i * 3] = i === N - 1 ? c.x + (px - c.x) * 0.3 : px;
      this.boltArr[i * 3 + 1] = CLOUD_Y + (ground - CLOUD_Y) * f;
      this.boltArr[i * 3 + 2] = i === N - 1 ? c.z + (pz - c.z) * 0.3 : pz;
    }
    this.buildBolt(cam);
    this.boltTime = 0.3;
    this.flash = 1;
    playThunder(Math.hypot(x - cam.x, z - cam.z));
  }

  // Rubans de l'éclair : chaque tronçon, élargi de côté (face à la caméra)
  buildBolt(cam) {
    const p = this.boltArr, N = BOLT_POINTS;
    for (const m of this.bolt.children) {
      const a = m.geometry.attributes.position.array, w = m.width / 2;
      for (let i = 0; i < N - 1; i++) {
        const x0 = p[i * 3], y0 = p[i * 3 + 1], z0 = p[i * 3 + 2], x1 = p[i * 3 + 3], y1 = p[i * 3 + 4], z1 = p[i * 3 + 5];
        // côté : perpendiculaire au tronçon et à la direction de la caméra
        const vx = (x0 + x1) / 2 - cam.x, vz = (z0 + z1) / 2 - cam.z, vl = Math.hypot(vx, vz) || 1;
        const sx = (-vz / vl) * w, sz = (vx / vl) * w;
        const o = i * 18;
        a.set([x0 - sx, y0, z0 - sz, x1 - sx, y1, z1 - sz, x1 + sx, y1, z1 + sz, x0 - sx, y0, z0 - sz, x1 + sx, y1, z1 + sz, x0 + sx, y0, z0 + sz], o);
      }
      m.geometry.attributes.position.needsUpdate = true;
    }
  }

  // Ciel plus sombre sous la pluie, éclairé un instant par les éclairs (après sky.update)
  applyToSky(sky) {
    const dark = this.rain * (0.3 + 0.25 * this.storm);
    sky.light.intensity *= 1 - dark;
    sky.hemi.intensity *= 1 - dark * 0.6;
    if (this.flash > 0) sky.hemi.intensity += this.flash * 1.6;
    // (chaque nuage a déjà sa teinte, voir clouds.js) : un peu plus sombres sous l'orage
    sky.clouds.material.color.multiplyScalar(1 - 0.15 * this.storm - 0.05 * this.rain);
  }

  // Shaders de la pluie, de la neige et de l'éclair compilés tout de suite (sinon la
  // première averse ou le premier éclair fait geler le jeu un instant)
  warmUp(renderer, scene, camera) {
    const objs = [this.rainLines, this.flakes, this.bolt], was = objs.map((o) => o.visible);
    objs.forEach((o) => { o.visible = true; });
    try { renderer.compile(scene, camera); } catch { /* (rien de grave) */ }
    objs.forEach((o, i) => { o.visible = was[i]; });
  }

  clear() {
    this.rain = this.storm = this.local = this.flash = this.nearStorm = 0;
    this.stormLook = 0;
    this.started = false;
    this.rainLines.visible = this.flakes.visible = this.bolt.visible = false;
    this.sound?.setLevel(0);
    this.birds?.setLevel(0);
    this.crickets?.setLevel(0);
  }
}
