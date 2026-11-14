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
import { seedToInt, mulberry32 } from './gen.js?v=1.1.5-alpha-mwgq2wrb';
import { Clouds } from './clouds.js?v=1.1.5-alpha-mwgq2wrb';

export const DAY_LENGTH = 1800; // durée d'un jour complet, en secondes (30 minutes)
const SKY_R = 380;
const SHADOW_SIZE = 34;        // demi-côté de la zone d'ombres autour du joueur
const SHADOW_SNAP = 4;
const ANGLE_STEP = (0.25 * Math.PI) / 180;

const SPACE_BLACK = new THREE.Color(0x02030a), SPACE_RIM = new THREE.Color(0x1a2a48);
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const col = (hex) => new THREE.Color(hex);
const P = {
  dayTop: col(0x3a7fdc), dayHorizon: col(0xa8d2ff),
  nightTop: col(0x02040c), nightHorizon: col(0x0b132c),
  sunset: col(0xf28a3e),
  hemiDay: col(0xc4dcff), hemiNight: col(0x4b64a8),
  groundDay: col(0x6e6852), groundNight: col(0x2a3350),
  sunLight: col(0xfff2dc), sunsetLight: col(0xff9448), moonLight: col(0xa2b6ff),
  overcast: col(0x8c96a4), overcastNight: col(0x05070c),
};

// Direction du soleil pour une heure t (0 = lever, 0.25 = midi, 0.5 = coucher, 0.75 = minuit)
// (tilt : inclinaison de sa course ; plus elle est forte, plus le soleil reste bas : l'hiver, voir seasons.js)
function sunDirection(angle, out, tilt = 0.3) {
  return out.set(Math.cos(angle), Math.sin(angle), tilt).normalize();
}

// Phases de la lune (pour l'affichage) : elles viennent de la vraie lune d'Hexa (voir skyview.js)
export const MOON_PHASE_NAMES = ['pleine lune', 'gibbeuse décroissante', 'dernier quartier', 'dernier croissant', 'nouvelle lune', 'premier croissant', 'premier quartier', 'gibbeuse croissante'];

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
        // Placé tout au fond (profondeur maximale), dessiné avant le reste (voir frame dans main.js)
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

    // Le soleil et la lune : les vrais astres du système (l'étoile Hexa et la Lune de Hexa), dessinés
    // par skyview.js à leur vraie place ; leurs phases et les éclipses viennent toutes seules
    this.moonPhase = 0;
    this.moonLit = 1;

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
    // dans l'espace : la deuxième étoile la plus brillante (sans ombres, voir skyview.js)
    this.light2 = new THREE.DirectionalLight(0xffffff, 0);
    scene.add(this.light2, this.light2.target);

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
    this.space = false; // l'espace (monde du tutoriel, en orbite autour de PXT-1) : voir spaceUpdate
    this.planet = null; // une autre planète du système (voir system.js) : son ciel, sans nuages ni lune
    // les astres du système (voir skyview.js) : view (SystemView), viewHere (l'astre où l'on est),
    // viewAt (dans l'espace : position absolue), viewSeed (graine du monde)
    this.view = null;
    this.viewHere = null;
    this.viewAt = null;
    this.viewQ = null;      // (les axes de la bulle où l'on est)
    this.viewRocks = null;  // (les astéroïdes proches)
    this.viewBelow = null;  // (tout en haut du ciel : la planète sous nos pieds, { alt, Q })
    this.viewSeed = '0';
    this.eclipse = 0;
    this._pa = new THREE.Color();
    this._pb = new THREE.Color();
  }

  // Dans le vide (voir spaceflight.js) : ciel noir, l'étoile Hexa et les astres à leur
  // vraie place (skyview.js) ; la lumière vient de l'étoile
  siteUpdate(center) {
    const u = this.uniforms;
    const sunK = this.viewSunK || 0;
    const sunLocal = sunK > 0 ? sunDirection((this.t || 0) * Math.PI * 2, this._sunL ||= new THREE.Vector3(), Math.round((this.tilt ?? 0.3) * 50) / 50) : null;
    const ecl = this.view.update({ seed: this.viewSeed, day: (this.days || 0) + (this.t || 0), at: this.viewAt, frameQ: this.viewQ, rocks: this.viewRocks, sunK, sunLocal, routes: this.viewRoutes });
    this.eclipse = ecl;
    const dir = this.lightDir.copy(this.view.light.position).normalize().applyQuaternion(this.view.scene.quaternion);
    u.top.value.setRGB(0.002, 0.003, 0.008);
    u.horizon.value.setRGB(0.004, 0.005, 0.012);
    u.glow.value.setRGB(0.25, 0.2, 0.12).multiplyScalar(1 - ecl);
    u.sunDir.value.copy(dir);
    // (près d'un astre, sur une ligne spatiale : la lumière du jour y est encore, voir sunK)
    this.daylight = sunLocal ? smooth(-0.18, 0.22, sunLocal.y) * sunK : 0;
    this.scene.fog.color.setRGB(0.004, 0.005, 0.012);
    this.clouds.mesh.visible = false;
    this.clouds.shadow.uCloudShade.value = 1;
    this.clouds.coverage = 0;
    // (près d'une étoile, l'œil ébloui ne voit presque plus le fond étoilé : il s'y fait peu à peu)
    const glare = this.view.glare || 0;
    for (const l of this.starLayers) { l.material.opacity = 1 - 0.75 * glare; l.visible = true; }
    u.glow.value.multiplyScalar(this.view.lightK);
    // la lumière de l'étoile monte en s'en approchant (voir skyview.js lightOf), de sa couleur
    this.light.color.setRGB(1, 0.95, 0.86).lerp(this.view.lightColor, 0.3);
    this.light.intensity = 2.6 * (1 - ecl) * (this.view.sunDim ?? 1) * this.view.lightK;
    // la deuxième étoile : un peu de lumière de sa direction
    this.light2.position.copy(this.view.light2.position).normalize().applyQuaternion(this.view.scene.quaternion);
    this.light2.color.setRGB(1, 1, 1).lerp(this.view.light2Color, 0.4);
    this.light2.intensity = 2.6 * this.view.light2K;
    // loin de tout : une faible lueur bleutée, celle des étoiles lointaines
    this.hemi.color.setRGB(0.3, 0.33, 0.45);
    this.hemi.groundColor.setRGB(0.08, 0.08, 0.12);
    this.hemi.intensity = 0.16 + 0.06 * Math.min(1, this.view.lightK);
    const cx = Math.round(center.x / SHADOW_SNAP) * SHADOW_SNAP;
    const cy = Math.round(center.y / SHADOW_SNAP) * SHADOW_SNAP;
    const cz = Math.round(center.z / SHADOW_SNAP) * SHADOW_SNAP;
    const key = `site|${cx}|${cy}|${cz}|${Math.round(dir.x * 200)}|${Math.round(dir.y * 200)}|${Math.round(dir.z * 200)}`;
    if (key !== this.shadowKey) {
      this.shadowKey = key;
      this.light.position.set(cx + dir.x * 220, cy + dir.y * 220, cz + dir.z * 220);
      this.light.target.position.set(cx, cy, cz);
      this.light.target.updateMatrixWorld();
      this.needsShadow = true;
    }
  }

  // L'espace lointain, loin de toute étoile : un ciel noir semé d'étoiles qui ne bougent pas,
  // une lueur de nébuleuse, pas de soleil, pas de lune, pas de nuages. Presque pas de lumière
  // dehors : la station s'éclaire avec ses lampes.
  spaceUpdate(center, camera) {
    if (this.viewAt && this.view) { this.siteUpdate(center); return; }
    this.view?.hide();
    this.light2.intensity = 0;
    const u = this.uniforms;
    u.top.value.setRGB(0.003, 0.004, 0.012);
    u.horizon.value.setRGB(0.012, 0.01, 0.03);
    u.glow.value.setRGB(0.09, 0.03, 0.14); // (la nébuleuse, très loin)
    u.sunDir.value.set(-0.5, 0.35, 0.8).normalize();
    this.daylight = 0;
    this.scene.fog.color.setRGB(0.01, 0.01, 0.025);
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

  // Le numéro du jour (la phase de la lune vient de sa vraie orbite : voir update)
  setDay(day) {
    this.days = day;
  }

  // t : heure du jour dans [0, 1). center : position du joueur. camera : caméra active.
  update(t, center, camera, dt = 0) {
    this.group.position.copy(camera.position);
    this.dome.position.copy(camera.position);
    this.t = t;
    if (this.space) { this.spaceUpdate(center, camera); return; }
    // (sur une autre planète, l'étoile est dessinée par skyview.js, à sa vraie taille)
    this.clouds.mesh.visible = !this.planet;

    this.light2.intensity = 0;
    const angle = t * Math.PI * 2;
    const tilt = Math.round((this.tilt ?? 0.3) * 50) / 50; // (par pas : les ombres ne sont pas refaites sans cesse)
    // (planète en rotation synchrone : l'astre ne bouge jamais dans son ciel, voir spaceflight.updateSky)
    const fixed = this.planet && this.fixedSun ? this.fixedSun : null;
    const sunDir = fixed ? this.sunDir.copy(fixed) : sunDirection(angle, this.sunDir, tilt);
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
    // (planète synchrone : le disque d'accrétion est immense, il éclaire encore quand le trou est sous l'horizon)
    const useSun = sunH > (fixed ? -0.2 : -0.04);
    const cl = this.clouds;
    cl.shrink = this.landK ?? 1;
    cl.update(this.days, t, camera, this._dir.copy(sunDir).multiplyScalar(useSun ? 1 : -1), dt, !useSun);
    if (this.planet) { cl.coverage = 0; cl.shadow.uCloudShade.value = 1; }
    const cover = cl.coverage;
    const grey = this._tmp2.copy(P.overcastNight).lerp(P.overcast, day);
    u.top.value.lerp(grey, cover * 0.55);
    u.horizon.value.lerp(grey, cover * 0.4);
    cl.material.color.setRGB(1, 1, 1).lerp(P.overcast, cover * 0.5);
    cl.material.emissive.copy(u.horizon.value).multiplyScalar(0.45);
    // autre planète : la couleur de son ciel (plus noir quand l'air est rare)
    const A = this.planet?.atmo;
    if (A) {
      const k = A.density;
      u.top.value.copy(P.nightTop).lerp(this._pa.set(A.sky), day * Math.min(1, k * 1.2));
      u.horizon.value.copy(P.nightHorizon).lerp(this._pb.set(A.horizon), day * Math.min(1, k * 1.2)).lerp(P.sunset, sunset * 0.4 * k);
      u.glow.value.multiplyScalar(k);
    }
    // très haut (en fusée) : l'air se raréfie, le ciel noircit et les étoiles paraissent, jusqu'à
    // l'espace (voir rocket.js SPACE_Y et spaceflight.js)
    const thin = smooth(170, 450, this.alt ?? 0);
    if (thin > 0) {
      u.top.value.lerp(SPACE_BLACK, thin);
      u.horizon.value.lerp(SPACE_RIM, thin * 0.8);
      u.glow.value.multiplyScalar(1 - thin * 0.8);
    }
    this.thin = thin;
    // (au bout d'une ligne spatiale : le ciel de l'astre s'efface, sans coupure, voir spaceflight.js)
    const land = this.landK ?? 1;
    if (land < 1) { u.top.value.multiplyScalar(land); u.horizon.value.multiplyScalar(land); u.glow.value.multiplyScalar(land); }
    // les astres du système, à leur place (et les éclipses : voir skyview.js)
    let ecl = 0;
    // (sur Hexa, même hors du système : le menu, un monde sans espace)
    const here = this.viewHere || (this.planet ? null : 'hexa');
    this.moonUp = 0;
    if (this.view && here) {
      const k = A ? Math.min(1, A.density * 1.2) : 1;
      ecl = this.view.update({
        seed: this.viewSeed, day: (this.days || 0) + t, here, sunDir, angle,
        sunPath: (a) => sunDirection(a, new THREE.Vector3(), tilt), daylight: Math.max(0, day * k - thin),
        below: this.viewBelow, local: fixed ? this.viewLocal : null,
      });
      if (ecl > 0) {
        const k2 = 1 - ecl * 0.93;
        u.top.value.multiplyScalar(k2);
        u.horizon.value.multiplyScalar(k2);
        u.glow.value.multiplyScalar(k2);
      }
      // la lune d'Hexa : sa part éclairée et sa phase, d'après sa vraie place
      const M = here === 'hexa' ? this.view.moonInfo : null;
      if (M) {
        this.moonLit = M.lit;
        this.moonUp = smooth(-0.05, 0.15, M.y);
        const s = Math.round(4 * (1 - M.lit));
        this.moonPhase = M.waxing ? (8 - s) % 8 : s;
      }
    } else this.view?.hide();
    this.eclipse = ecl;
    this.scene.fog.color.copy(u.horizon.value);

    // Étoiles
    this.stars.rotation.z = fixed ? 0 : angle;
    const starAlpha = Math.max(1 - smooth(-0.25, 0.08, sunH), A ? 1 - Math.min(1, A.density * 1.5) : 0, thin, ecl * 0.9); // (sans air : des étoiles en plein jour)
    for (const l of this.starLayers) { l.material.opacity = starAlpha; l.visible = starAlpha > 0.01; }

    // Lumière directionnelle : soleil au-dessus de l'horizon, sinon lune
    if (useSun) {
      this.light.color.copy(P.sunsetLight).lerp(P.sunLight, smooth(0, 0.35, sunH));
      this.light.intensity = fixed ? 2.6 * smooth(-0.2, 0.1, sunH) : 2.8 * smooth(-0.04, 0.2, sunH);
    } else {
      this.light.color.copy(P.moonLight);
      // la lumière de la lune suit sa phase (nuit de nouvelle lune : très sombre)
      this.light.intensity = (0.15 + 0.55 * this.moonLit * this.moonUp) * smooth(-0.04, 0.2, -sunH) * (fixed ? 0.2 : 1); // (la nuit éternelle n'a pas de lune)
    }
    // Lumière du ciel (ambiante) volontairement plus faible que l'astre :
    // les zones à l'ombre sont nettement plus sombres que les zones éclairées.
    this.hemi.color.copy(P.hemiNight).lerp(P.hemiDay, day);
    this.hemi.groundColor.copy(P.groundNight).lerp(P.groundDay, day);
    this.hemi.intensity = 0.35 + 0.55 * day;
    // ciel couvert : un peu moins de soleil direct (l'ombre des nuages est dans le shader
    // du terrain, voir clouds.js)
    this.light.intensity *= 1 - cover * 0.3;
    if (ecl > 0 && useSun) { this.light.intensity *= 1 - ecl; this.hemi.intensity *= 1 - ecl * 0.7; }

    // Un système sans vraie lumière (Ethan : des pulsars) : un jour faible et bleuté. Halo est
    // éclairée par ses aurores (vertes, roses, dorées, qui changent lentement) et ses mers lumineuses :
    // jamais de nuit noire, des étoiles toujours visibles
    const S = this.planet && this.view ? this.view.sunDim ?? 1 : 1;
    if (S < 1) {
      this.light.intensity *= S;
      this.light.color.lerp(this._pa.setRGB(0.62, 0.66, 1), 0.6);
      this.hemi.intensity *= 0.55 + S * 0.5;
    }
    if (this.planet?.aurora) {
      const ph = ((this.days || 0) + t) * 6, w = 0.5 + 0.5 * Math.sin(ph), v = 0.5 + 0.5 * Math.sin(ph * 0.61 + 2);
      const au = this._pb.setRGB(0.15 + 0.55 * v * (1 - w), 0.85 - 0.45 * v, 0.45 + 0.25 * w * v); // (vert, rose, or)
      u.top.value.lerp(this._tmp.copy(au).multiplyScalar(0.28), 0.75);
      u.horizon.value.lerp(this._tmp.copy(au).multiplyScalar(0.55), 0.7);
      u.glow.value.copy(au).multiplyScalar(0.35);
      this.scene.fog.color.copy(u.horizon.value);
      this.hemi.color.copy(au).lerp(this._tmp.setRGB(0.4, 0.6, 0.9), 0.4);
      this.hemi.groundColor.setRGB(0.05, 0.12, 0.2);
      this.hemi.intensity = Math.max(this.hemi.intensity, 0.85);
      this.daylight = Math.max(this.daylight, 0.45);
      for (const l of this.starLayers) { l.material.opacity = Math.max(l.material.opacity, 0.6); l.visible = true; }
    }

    // Ombres : direction arrondie + zone recentrée par pas → recalcul rare
    const qa = Math.round(angle / ANGLE_STEP) * ANGLE_STEP;
    if (fixed) this.lightDir.set(Math.round(fixed.x * 100) / 100, Math.round(fixed.y * 100) / 100, Math.round(fixed.z * 100) / 100).normalize();
    else sunDirection(qa, this.lightDir, tilt);
    if (fixed && useSun && this.lightDir.y < 0.12) { this.lightDir.y = 0.12; this.lightDir.normalize(); } // (la lumière rase, sans passer sous le sol)
    if (!useSun) this.lightDir.negate();
    const cx = Math.round(center.x / SHADOW_SNAP) * SHADOW_SNAP;
    const cy = Math.round(center.y / SHADOW_SNAP) * SHADOW_SNAP;
    const cz = Math.round(center.z / SHADOW_SNAP) * SHADOW_SNAP;
    const key = `${fixed ? this.lightDir.x.toFixed(3) + this.lightDir.z.toFixed(3) : qa.toFixed(5)}|${tilt}|${useSun}|${cx}|${cy}|${cz}`;
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
