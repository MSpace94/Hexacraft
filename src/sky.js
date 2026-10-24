// Ciel, cycle jour/nuit et éclairage.
// La lumière directionnelle (avec ombres) vient vraiment du soleil le jour et de
// la lune la nuit : même direction que l'astre affiché. La lumière du ciel
// (hémisphérique) suit la couleur du ciel.
//
// Optimisations :
//  - le dôme, les étoiles, le soleil et la lune suivent la caméra (aucun calcul lourd)
//  - la carte d'ombres n'est recalculée que si la lumière a vraiment bougé
//    (direction arrondie à 0.25°, zone d'ombre recentrée par pas de 4 blocs)
import * as THREE from 'three';
import { seedToInt, mulberry32 } from './gen.js?v=1.1.5-alpha-mvm2b95g';
import { Clouds } from './clouds.js?v=1.1.5-alpha-mvm2b95g';

export const DAY_LENGTH = 1800; // durée d'un jour complet, en secondes (30 minutes)
const SKY_R = 380;
const SHADOW_SIZE = 34;        // demi-côté de la zone d'ombres autour du joueur
const SHADOW_SNAP = 4;
const ANGLE_STEP = (0.25 * Math.PI) / 180;

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const col = (hex) => new THREE.Color(hex);
const P = {
  dayTop: col(0x3a7fdc), dayHorizon: col(0xa8d2ff),
  nightTop: col(0x02040c), nightHorizon: col(0x0b132c),
  sunset: col(0xf28a3e),
  hemiDay: col(0xc4dcff), hemiNight: col(0x4b64a8),
  groundDay: col(0x6e6852), groundNight: col(0x2a3350),
  sunCore: col(0xfff7d0), sunCoreSet: col(0xff9d45),
  sunLight: col(0xfff2dc), sunsetLight: col(0xff9448), moonLight: col(0xa2b6ff),
  overcast: col(0x8c96a4), overcastNight: col(0x05070c),
};

// Direction du soleil pour une heure t (0 = lever, 0.25 = midi, 0.5 = coucher, 0.75 = minuit)
function sunDirection(angle, out) {
  return out.set(Math.cos(angle), Math.sin(angle), 0.3).normalize();
}

// Phases de la lune, une par nuit (cycle de 8 jours), et part de la lune éclairée
const MOON_PHASES = ['full_moon', 'waning_gibbous', 'third_quarter', 'waning_crescent', 'new_moon', 'waxing_crescent', 'first_quarter', 'waxing_gibbous'];
const MOON_LIGHT = [1, 0.75, 0.5, 0.25, 0, 0.25, 0.5, 0.75];
export const MOON_PHASE_NAMES = ['pleine lune', 'gibbeuse décroissante', 'dernier quartier', 'dernier croissant', 'nouvelle lune', 'premier croissant', 'premier quartier', 'gibbeuse croissante'];

// Texture d'un astre (texture/ciel/) : dessin hexagonal sur fond transparent. Il est
// réduit au centre d'une case de 256 px, où il occupe le tiers de la largeur : l'astre a
// la même taille dans le ciel qu'avant, quel que soit son dessin.
const ASTRO_PX = 256, ASTRO_FILL = 0.33;
function astroTexture(file) {
  const c = document.createElement('canvas');
  c.width = c.height = ASTRO_PX;
  const t = new THREE.CanvasTexture(c);
  t.minFilter = THREE.LinearFilter;
  t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
  const img = new Image();
  img.onload = () => {
    // partie dessinée de l'image
    const probe = document.createElement('canvas');
    probe.width = img.width; probe.height = img.height;
    const pctx = probe.getContext('2d', { willReadFrequently: true });
    pctx.drawImage(img, 0, 0);
    const d = pctx.getImageData(0, 0, img.width, img.height).data;
    let x0 = img.width, y0 = img.height, x1 = -1, y1 = -1;
    for (let y = 0; y < img.height; y += 2) {
      for (let x = 0; x < img.width; x += 2) {
        if (d[(y * img.width + x) * 4 + 3] < 20) continue;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
    if (x1 < 0) return;
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1, k = (ASTRO_PX * ASTRO_FILL) / Math.max(bw, bh);
    const ctx = c.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, x0, y0, bw, bh, (ASTRO_PX - bw * k) / 2, (ASTRO_PX - bh * k) / 2, bw * k, bh * k);
    t.needsUpdate = true;
  };
  img.src = 'texture/ciel/' + file;
  return t;
}
// Astre : carré face à la caméra, transparent là où l'image est noire.
// Caché par le terrain (test de profondeur) et coupé sous l'horizon : on ne le voit
// jamais à travers le sol.
function astro(map, size) {
  return new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.ShaderMaterial({
    uniforms: { map: { value: map }, color: { value: new THREE.Color(1, 1, 1) } },
    transparent: true, depthWrite: false, depthTest: true,
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vDir;
      void main() {
        vUv = uv;
        vec4 w = modelMatrix * vec4(position, 1.0);
        vDir = w.xyz - cameraPosition;
        gl_Position = projectionMatrix * viewMatrix * w;
        gl_Position.z = gl_Position.w; // (tout au fond, comme le dôme : derrière le terrain lointain)
      }`,
    fragmentShader: `
      uniform sampler2D map;
      uniform vec3 color;
      varying vec2 vUv;
      varying vec3 vDir;
      void main() {
        vec4 t = texture2D(map, vUv);
        float h = normalize(vDir).y;
        float a = t.a * smoothstep(-0.012, 0.006, h);
        if (a < 0.004) discard;
        gl_FragColor = vec4(t.rgb * color, a);
        #include <colorspace_fragment>
      }`,
  }));
}

export class Sky {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    // Three.js trie d'abord par groupe : le ciel entier passe avant le terrain,
    // et à l'intérieur le dôme (-10) avant les étoiles (-9) et les astres (-8).
    this.group.renderOrder = -10;
    scene.add(this.group);

    // Dôme en dégradé + halo autour du soleil
    this.uniforms = {
      top: { value: new THREE.Color() },
      horizon: { value: new THREE.Color() },
      glow: { value: new THREE.Color() },
      sunDir: { value: new THREE.Vector3() },
    };
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(SKY_R + 5, 24, 12),
      new THREE.ShaderMaterial({
        uniforms: this.uniforms,
        side: THREE.BackSide,
        depthWrite: false,
        depthTest: true,
        // Placé tout au fond (profondeur maximale) et dessiné APRÈS le terrain : seuls les
        // pixels de ciel vraiment visibles sont calculés (avant, tout l'écran l'était, puis
        // recouvert par le terrain)
        vertexShader: `
          varying vec3 vDir;
          void main() {
            vDir = normalize(position);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            gl_Position.z = gl_Position.w;
          }`,
        fragmentShader: `
          uniform vec3 top, horizon, glow, sunDir;
          varying vec3 vDir;
          void main() {
            float h = vDir.y;
            vec3 c = mix(horizon, top, smoothstep(0.0, 0.45, h));
            c = mix(c, horizon * 0.55, smoothstep(0.0, -0.35, h));
            float g = max(dot(normalize(vDir), sunDir), 0.0);
            c += glow * (pow(g, 6.0) * 0.8 + pow(g, 60.0) * 0.6) * smoothstep(-0.4, 0.1, h);
            gl_FragColor = vec4(c, 1.0);
          }`,
      }),
    );
    // hors du groupe du ciel (qui passe en premier) : le dôme passe après le terrain
    dome.renderOrder = 50;
    dome.frustumCulled = false;
    scene.add(dome);
    this.dome = dome;

    // Étoiles : générées à partir de la graine du monde (voir setSeed), visibles la nuit.
    // Deux objets seulement : les étoiles normales et les plus brillantes.
    this.stars = new THREE.Group();
    this.starLayers = [2, 3.2].map((size) => {
      const pts = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({
        size, vertexColors: true, sizeAttenuation: false, transparent: true, depthWrite: false, fog: false,
      }));
      pts.renderOrder = -9;
      pts.frustumCulled = false;
      // tout au fond, comme le dôme : le terrain lointain (au-delà de SKY_R) passe devant
      pts.material.onBeforeCompile = (sh) => {
        sh.vertexShader = sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n  gl_Position.z = gl_Position.w;');
      };
      this.stars.add(pts);
      return pts;
    });
    this.group.add(this.stars);
    this.setSeed('hexacraft');

    // Soleil et lune : textures du jeu (texture/ciel/sun.png et les 8 phases dans ciel/lune/)
    this.sun = astro(astroTexture('sun.png'), 210);
    this.moonTextures = MOON_PHASES.map((p) => astroTexture('lune/' + p + '.png'));
    this.moon = astro(this.moonTextures[0], 170);
    this.moonPhase = 0;
    for (const g of [this.sun, this.moon]) {
      g.renderOrder = -8;
      g.frustumCulled = false;
      this.group.add(g);
    }

    // Lumières
    this.hemi = new THREE.HemisphereLight();
    scene.add(this.hemi);
    this.light = new THREE.DirectionalLight();
    this.light.castShadow = true;
    this.light.shadow.mapSize.set(2048, 2048);
    const cam = this.light.shadow.camera;
    cam.left = cam.bottom = -SHADOW_SIZE;
    cam.right = cam.top = SHADOW_SIZE;
    cam.near = 1;
    cam.far = 440; // (de quoi couvrir toute la hauteur du monde)
    cam.updateProjectionMatrix();
    this.light.shadow.bias = -0.0005;
    this.light.shadow.normalBias = 0.04;
    scene.add(this.light, this.light.target);

    this.sunDir = new THREE.Vector3();
    this._dir = new THREE.Vector3();
    this._tmp2 = new THREE.Color();
    this.lightDir = new THREE.Vector3();
    this.shadowKey = '';
    this.needsShadow = true;
    this.daylight = 1;
    this._tmp = new THREE.Color();
    this.clouds = new Clouds(scene);
    this.days = 0;
    this.space = false; // l'espace lointain (monde du tutoriel) : voir spaceUpdate
  }

  // L'espace lointain, loin de toute étoile : un ciel noir semé d'étoiles qui ne bougent pas,
  // une lueur de nébuleuse, pas de soleil, pas de lune, pas de nuages. Presque pas de lumière
  // dehors : la station s'éclaire avec ses lampes.
  spaceUpdate(center, camera) {
    const u = this.uniforms;
    u.top.value.setRGB(0.003, 0.004, 0.012);
    u.horizon.value.setRGB(0.012, 0.01, 0.03);
    u.glow.value.setRGB(0.09, 0.03, 0.14); // (la nébuleuse, très loin)
    u.sunDir.value.set(-0.5, 0.35, 0.8).normalize();
    this.daylight = 0;
    this.scene.fog.color.setRGB(0.01, 0.01, 0.025);
    this.sun.visible = this.moon.visible = false;
    this.clouds.mesh.visible = false;
    this.clouds.shadow.uCloudShade.value = 1;
    this.clouds.coverage = 0;
    this.stars.rotation.z = 0.6;
    for (const l of this.starLayers) { l.material.opacity = 1; l.visible = true; }
    // lumière froide et faible des étoiles lointaines
    this.light.color.setRGB(0.62, 0.68, 1);
    this.light.intensity = 0.35;
    this.hemi.color.setRGB(0.35, 0.38, 0.6);
    this.hemi.groundColor.setRGB(0.12, 0.1, 0.18);
    this.hemi.intensity = 0.3;
    this.lightDir.set(-0.5, 0.8, 0.35).normalize();
    const cx = Math.round(center.x / SHADOW_SNAP) * SHADOW_SNAP;
    const cy = Math.round(center.y / SHADOW_SNAP) * SHADOW_SNAP;
    const cz = Math.round(center.z / SHADOW_SNAP) * SHADOW_SNAP;
    const key = `space|${cx}|${cy}|${cz}`;
    if (key !== this.shadowKey) {
      this.shadowKey = key;
      this.light.position.set(cx + this.lightDir.x * 220, cy + this.lightDir.y * 220, cz + this.lightDir.z * 220);
      this.light.target.position.set(cx, cy, cz);
      this.light.target.updateMatrixWorld();
      this.needsShadow = true;
    }
  }

  // Ciel étoilé propre à chaque graine : nombre, position, couleur et éclat des étoiles,
  // et une "voie lactée" (bande plus dense) orientée au hasard.
  setSeed(seed) {
    this.clouds?.setSeed(seed);
    const rand = mulberry32(seedToInt(seed) ^ 0x5eed5);
    const unit = () => {
      for (;;) {
        const x = rand() * 2 - 1, y = rand() * 2 - 1, z = rand() * 2 - 1;
        const l = x * x + y * y + z * z;
        if (l > 0.01 && l <= 1) { const k = 1 / Math.sqrt(l); return [x * k, y * k, z * k]; }
      }
    };
    const axis = unit();
    const tints = [[0.75, 0.83, 1], [1, 1, 1], [1, 1, 1], [1, 0.93, 0.78], [1, 0.8, 0.62]];
    const layers = [{ pos: [], col: [] }, { pos: [], col: [] }];
    const count = 1100 + Math.floor(rand() * 900);
    for (let i = 0; i < count; i++) {
      let [x, y, z] = unit();
      if (rand() < 0.35) {
        // attirée vers le plan de la voie lactée
        const d = x * axis[0] + y * axis[1] + z * axis[2];
        const k = 0.85 + rand() * 0.12;
        x -= axis[0] * d * k; y -= axis[1] * d * k; z -= axis[2] * d * k;
        const l = Math.hypot(x, y, z) || 1;
        x /= l; y /= l; z /= l;
      }
      const bright = rand() < 0.05;
      const tint = tints[Math.floor(rand() * tints.length)];
      const b = bright ? 1 : 0.45 + rand() * 0.55;
      const layer = layers[bright ? 1 : 0];
      layer.pos.push(x * SKY_R, y * SKY_R, z * SKY_R);
      layer.col.push(tint[0] * b, tint[1] * b, tint[2] * b);
    }
    layers.forEach((l, i) => {
      const g = this.starLayers[i].geometry;
      g.setAttribute('position', new THREE.Float32BufferAttribute(l.pos, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(l.col, 3));
      g.computeBoundingSphere();
    });
  }

  // Phase de la lune d'après le numéro du jour
  setDay(day) {
    this.days = day;
    const phase = ((Math.floor(day) % 8) + 8) % 8;
    if (phase === this.moonPhase) return;
    this.moonPhase = phase;
    this.moon.material.uniforms.map.value = this.moonTextures[phase];
  }

  // t : heure du jour dans [0, 1). center : position du joueur. camera : caméra active.
  update(t, center, camera, dt = 0) {
    this.group.position.copy(camera.position);
    this.dome.position.copy(camera.position);
    if (this.space) { this.spaceUpdate(center, camera); return; }
    this.sun.visible = this.moon.visible = true;
    this.clouds.mesh.visible = true;

    const angle = t * Math.PI * 2;
    const sunDir = sunDirection(angle, this.sunDir);
    const sunH = sunDir.y;
    const day = smooth(-0.18, 0.22, sunH);
    const sunset = Math.exp(-(((sunH - 0.03) / 0.14) ** 2));
    this.daylight = day;

    // Couleurs du ciel
    const u = this.uniforms;
    u.top.value.copy(P.nightTop).lerp(P.dayTop, day);
    u.horizon.value.copy(P.nightHorizon).lerp(P.dayHorizon, day).lerp(P.sunset, sunset * 0.55);
    u.glow.value.copy(P.sunset).multiplyScalar(sunset * 0.9).add(this._tmp.setScalar(0.12 * day));
    u.sunDir.value.copy(sunDir);
    // Nuages (voir clouds.js) : un ciel couvert est plus gris, et plus sombre
    const useSun = sunH > -0.04;
    const cl = this.clouds;
    cl.update(this.days, t, camera, this._dir.copy(sunDir).multiplyScalar(useSun ? 1 : -1), dt);
    const cover = cl.coverage;
    const grey = this._tmp2.copy(P.overcastNight).lerp(P.overcast, day);
    u.top.value.lerp(grey, cover * 0.55);
    u.horizon.value.lerp(grey, cover * 0.4);
    cl.material.color.setRGB(1, 1, 1).lerp(P.overcast, cover * 0.5);
    cl.material.emissive.copy(u.horizon.value).multiplyScalar(0.45);
    this.scene.fog.color.copy(u.horizon.value);

    // Astres
    this.sun.position.copy(sunDir).multiplyScalar(SKY_R - 20);
    this.moon.position.copy(sunDir).multiplyScalar(-(SKY_R - 20));
    this.sun.material.uniforms.color.value.copy(P.sunCore).lerp(P.sunCoreSet, sunset);
    this.sun.lookAt(camera.position);
    this.moon.lookAt(camera.position);
    this.stars.rotation.z = angle;
    const starAlpha = 1 - smooth(-0.25, 0.08, sunH);
    for (const l of this.starLayers) { l.material.opacity = starAlpha; l.visible = starAlpha > 0.01; }

    // Lumière directionnelle : soleil au-dessus de l'horizon, sinon lune
    if (useSun) {
      this.light.color.copy(P.sunsetLight).lerp(P.sunLight, smooth(0, 0.35, sunH));
      this.light.intensity = 2.8 * smooth(-0.04, 0.2, sunH);
    } else {
      this.light.color.copy(P.moonLight);
      // la lumière de la lune suit sa phase (nuit de nouvelle lune : très sombre)
      this.light.intensity = (0.15 + 0.55 * MOON_LIGHT[this.moonPhase]) * smooth(-0.04, 0.2, -sunH);
    }
    // Lumière du ciel (ambiante) volontairement plus faible que l'astre :
    // les zones à l'ombre sont nettement plus sombres que les zones éclairées.
    this.hemi.color.copy(P.hemiNight).lerp(P.hemiDay, day);
    this.hemi.groundColor.copy(P.groundNight).lerp(P.groundDay, day);
    this.hemi.intensity = 0.35 + 0.55 * day;
    // ciel couvert : un peu moins de soleil direct (l'ombre des nuages est dans le shader
    // du terrain, voir clouds.js)
    this.light.intensity *= 1 - cover * 0.3;

    // Ombres : direction arrondie + zone recentrée par pas → recalcul rare
    const qa = Math.round(angle / ANGLE_STEP) * ANGLE_STEP;
    sunDirection(qa, this.lightDir);
    if (!useSun) this.lightDir.negate();
    const cx = Math.round(center.x / SHADOW_SNAP) * SHADOW_SNAP;
    const cy = Math.round(center.y / SHADOW_SNAP) * SHADOW_SNAP;
    const cz = Math.round(center.z / SHADOW_SNAP) * SHADOW_SNAP;
    const key = `${qa.toFixed(5)}|${useSun}|${cx}|${cy}|${cz}`;
    if (key !== this.shadowKey) {
      this.shadowKey = key;
      this.light.position.set(cx + this.lightDir.x * 220, cy + this.lightDir.y * 220, cz + this.lightDir.z * 220);
      this.light.target.position.set(cx, cy, cz);
      this.light.target.updateMatrixWorld();
      this.needsShadow = true;
    }
  }
}

// Heure affichée (t = 0 → 6h00)
export function clockText(t) {
  const minutes = Math.floor(((t * 24 + 6) % 24) * 60);
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}
