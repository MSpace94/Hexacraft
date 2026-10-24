// Nuages : une couche d'hexagones géants (8 blocs de large) à la hauteur CLOUD_Y, seuls ou
// regroupés. Leur forme vient de la graine du monde, du numéro du jour et de l'heure
// (même ciel pour tous les joueurs d'une partie) : la couverture dépend de l'endroit (climat
// régional, voir climate.js : dégagé loin des perturbations, couvert sous la pluie) et les
// nuages se déforment lentement en dérivant avec le vent. Chaque hexagone a sa teinte et sa
// hauteur selon le temps qu'il fait dessous : blanc par beau temps, gris sous la pluie,
// presque noir et bien plus haut dans un orage (cumulonimbus).
// Ils cachent les astres et font de l'ombre : une petite carte des nuages (vue de dessus)
// est lue par le shader du terrain, qui retrouve, pour chaque pixel, le nuage entre lui et
// l'astre (voir patch) : l'ombre suit les nuages partout, bords adoucis, sans recalculer
// la carte d'ombres. L'eau s'assombrit quand un nuage cache l'astre au joueur (shade).
import * as THREE from 'three';
import { SIZE, CORNERS, NEIGHBORS, hexToWorld, worldToHex } from './hex.js?v=1.1.5-alpha-mvm2b95g';
import { seedToInt } from './gen.js?v=1.1.5-alpha-mvm2b95g';
import { Climate, DAY_SCALE } from './climate.js?v=1.1.5-alpha-mvm2b95g';

export const CLOUD_Y = 165;     // bas des nuages (le monde monte à 156)
const THICK = 4;                // épaisseur
const STORM_RISE = 2;           // un orage monte le nuage de STORM_RISE x (0..6) blocs
const DARK_LEVELS = 15;         // nuances de gris (de blanc à presque noir)
const S = 8;                    // largeur d'un hexagone de nuage (en blocs)
// Les nuages vont aussi loin que la distance d'affichage (LOD compris, voir setView). Un
// grand ciel se calcule en plusieurs images (BUDGET ms par image), et n'est refait que si le
// joueur s'est éloigné de MOVE hexagones de son centre (ou pour suivre leur évolution).
const SPEED = 1.2;              // vent (blocs par seconde)
const DAY_LENGTH = 1800;         // (comme sky.js : un jour de jeu = 30 minutes)
const FREQ = 0.17;              // taille des groupes de nuages
const SHADE = 0.15;             // lumière qui passe sous un nuage
const MAP = 256;                // résolution de la carte des nuages (pour leur ombre)
const SH_RAD = 22;              // l'ombre des nuages est calculée sur ce rayon (hexagones)
const SPAN = (SH_RAD + 1.5) * S * 2; // côté de la zone couverte par cette carte (blocs)
const MOVE = 3;
const BUDGET = 3;

const smooth = (t) => t * t * (3 - 2 * t);

function hash(a, b, c, seed) {
  let h = seed ^ Math.imul(a, 0x27d4eb2d);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b) ^ Math.imul(b, 0x165667b1);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) ^ Math.imul(c, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
}

// Bruit de valeur 3D (lissé), dans [0, 1]
function noise3(x, y, z, seed) {
  const x0 = Math.floor(x), y0 = Math.floor(y), z0 = Math.floor(z);
  const fx = smooth(x - x0), fy = smooth(y - y0), fz = smooth(z - z0);
  const L = (a, b, t) => a + (b - a) * t;
  const v = (i, j, k) => hash(x0 + i, y0 + j, z0 + k, seed);
  return L(
    L(L(v(0, 0, 0), v(1, 0, 0), fx), L(v(0, 1, 0), v(1, 1, 0), fx), fy),
    L(L(v(0, 0, 1), v(1, 0, 1), fx), L(v(0, 1, 1), v(1, 1, 1), fx), fy), fz);
}

export class Clouds {
  constructor(scene) {
    this.material = new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true, transparent: true, fog: false });
    this.wx = {}; // (temps calculé pour un hexagone, voir work)
    this.uniforms = { uCam: { value: new THREE.Vector3() }, uFade: { value: new THREE.Vector2() } };
    this.setView(192);
    // les nuages s'effacent au loin (au lieu de s'arrêter net)
    this.material.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, this.uniforms);
      sh.vertexShader = 'varying vec3 vCloudW;\n' + sh.vertexShader.replace('#include <project_vertex>',
        '#include <project_vertex>\n  vCloudW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = 'uniform vec3 uCam;\nuniform vec2 uFade;\nvarying vec3 vCloudW;\n' + sh.fragmentShader.replace('#include <dithering_fragment>',
        '#include <dithering_fragment>\n  gl_FragColor.a *= 0.93 * (1.0 - smoothstep(uFade.x, uFade.y, distance(vCloudW.xz, uCam.xz)));');
    };
    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), this.material);
    // leur ombre : carte vue de dessus, lue par le shader du terrain (voir patch)
    this.map = new THREE.DataTexture(new Uint8Array(MAP * MAP), MAP, MAP, THREE.RedFormat);
    this.map.magFilter = this.map.minFilter = THREE.LinearFilter;
    this.shadow = {
      uCloudMap: { value: this.map },
      uCloudOrigin: { value: new THREE.Vector2() },   // coin de la carte (x, z du monde)
      uCloudSpan: { value: SPAN },
      uCloudY: { value: CLOUD_Y + THICK / 2 },
      uCloudLight: { value: new THREE.Vector3(0, 1, 0) }, // vers l'astre qui éclaire
      uCloudShade: { value: SHADE },
    };
    this.mesh.frustumCulled = false;
    // dessinés avant les autres objets transparents (fumée, champignon de la TNT...) : ceux-ci
    // passent alors devant les nuages quand ils sont devant, et derrière sinon. Dessinés
    // après, les nuages recouvraient toute la fumée, même celle d'en dessous.
    this.mesh.renderOrder = -1;
    scene.add(this.mesh);
    this.setSeed('hexacraft');
    this.cells = null;
    this.clock = 0;
    this.shade = 1;           // lumière de l'astre vue par le joueur (1 : dégagé)
    this.coverage = 0;        // part du ciel couverte au-dessus du joueur (0..1)
    this.base = { q: 0, r: 0 };
  }

  setSeed(seed) {
    this.seed = seedToInt(String(seed)) ^ 0xc10d5;
    const a = hash(1, 2, 3, this.seed) * Math.PI * 2;  // direction du vent propre au monde
    this.wind = new THREE.Vector2(Math.cos(a), Math.sin(a));
    // le temps qu'il fait dérive avec les nuages
    this.climate = new Climate(this.seed, this.wind, DAY_LENGTH * SPEED);
    this.cells = null;
    this.job = null;
  }

  // Distance d'affichage (blocs, LOD compris) : les nuages vont jusque-là et s'effacent au bout
  setView(dist) {
    const rad = Math.max(14, Math.ceil(dist / (S * 0.86)) + 1);
    this.uniforms.uFade.value.set(dist * 0.6, dist * 0.95);
    if (rad === this.rad) return;
    this.rad = rad;                    // rayon de la zone de nuages (hexagones)
    this.go = rad + 2;                 // grille calculée : un peu plus (côtés des bords)
    this.gw = this.go * 2 + 1;
    this.pixelCell = null;
    this.cells = null;
    this.job = null;
  }

  // L'hexagone de nuage (q, r) existe-t-il au temps T ? (la couverture vient du climat de
  // l'endroit ; les hexagones sont dans le repère du vent, comme le climat)
  on(q, r, T) {
    const c = hexToWorld(q, r);
    const thr = this.threshold(this.climate.coverAdv(c.x * S, c.z * S, T));
    const x = c.x / SIZE * FREQ * 0.5, z = c.z / SIZE * FREQ * 0.5, t = T * 1.2 * DAY_SCALE;
    const n = noise3(x, z, t, this.seed) * 0.62 + noise3(x * 2.3, z * 2.3, t * 1.7, this.seed ^ 0x55) * 0.38;
    return n + (hash(q, r, Math.floor(T * 6 * DAY_SCALE), this.seed) - 0.5) * 0.08 > thr;
  }

  threshold(c) {
    // seuil du bruit pour couvrir à peu près la part c du ciel
    return 0.7 - c * 0.4;
  }

  // Décalage du vent (blocs) au temps T
  offset(T, out) {
    const d = T * DAY_LENGTH * SPEED;
    return out.set(this.wind.x * d, this.wind.y * d);
  }

  // Un nuage au-dessus du point (x, z) du monde au temps T ?
  covered(x, z, T) {
    const o = this.offset(T, new THREE.Vector2());
    const h = worldToHex((x - o.x) / S, (z - o.y) / S);
    return this.on(h.q, h.r, T);
  }

  // days : numéro du jour, t : heure (0..1), lightDir : vers l'astre qui éclaire
  update(days, t, camera, lightDir, dt) {
    const T = days + t;
    const o = this.offset(T, new THREE.Vector2());
    const cam = camera.position;
    this.coverage = this.climate.coverAdv(cam.x - o.x, cam.z - o.y, T);
    this.uniforms.uCam.value.copy(cam);
    const h = worldToHex((cam.x - o.x) / S, (cam.z - o.y) / S);
    // la forme change lentement : on la refait de temps en temps, ou si on s'est éloigné
    // du centre (le premier ciel est calculé d'un coup, les suivants peu à peu)
    this.clock -= dt;
    const dq = h.q - this.base.q, dr = h.r - this.base.r;
    const far = Math.max(Math.abs(dq), Math.abs(dr), Math.abs(dq + dr)) > MOVE;
    if (!this.cells) {
      this.start(h.q, h.r, T);
      this.work(Infinity);
    } else if (this.job) this.work(BUDGET);
    else if (far || this.clock <= 0) {
      this.clock = 2 + this.rad / 30;
      this.start(h.q, h.r, T);
      this.work(BUDGET);
    }
    const b = hexToWorld(this.base.q, this.base.r);
    this.mesh.position.set(o.x + b.x * S, CLOUD_Y, o.y + b.z * S);
    const sh = this.shadow;
    sh.uCloudOrigin.value.set(this.mesh.position.x - SPAN / 2, this.mesh.position.z - SPAN / 2);
    sh.uCloudLight.value.copy(lightDir);
    // astre bas sur l'horizon : leur ombre s'efface (elle tomberait trop loin)
    sh.uCloudShade.value = 1 - (1 - SHADE) * Math.min(1, Math.max(0, (lightDir.y - 0.08) / 0.15));
    // l'astre est-il caché par un nuage, vu d'ici ?
    let target = 1;
    if (lightDir.y > 0.03 && cam.y < CLOUD_Y) {
      const s = (CLOUD_Y + THICK / 2 - cam.y) / lightDir.y;
      if (this.covered(cam.x + lightDir.x * s, cam.z + lightDir.z * s, T)) target = SHADE;
    }
    this.shade += (target - this.shade) * (1 - Math.exp(-dt * 2.5));
  }

  // Ajoute l'ombre des nuages à un matériau Lambert (onBeforeCompile) : la lumière de
  // l'astre est réduite si un nuage se trouve entre le pixel et lui
  patch(sh) {
    Object.assign(sh.uniforms, this.shadow);
    sh.vertexShader = 'varying vec3 vCloudPos;\n' + sh.vertexShader.replace('#include <project_vertex>',
      '#include <project_vertex>\n  vCloudPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    const SUN = 'getDirectionalLightInfo( directionalLight, directLight );';
    const SHADE = SUN + '\n\t\tdirectLight.color *= cloudLight();';
    const begin = THREE.ShaderChunk.lights_fragment_begin.replace(SUN, SHADE);
    sh.fragmentShader = `varying vec3 vCloudPos;
uniform sampler2D uCloudMap;
uniform vec2 uCloudOrigin;
uniform float uCloudSpan, uCloudY, uCloudShade;
uniform vec3 uCloudLight;
float cloudLight() {
  if (uCloudShade >= 0.999 || vCloudPos.y > uCloudY) return 1.0;
  vec2 p = vCloudPos.xz + uCloudLight.xz * ((uCloudY - vCloudPos.y) / uCloudLight.y);
  vec2 uv = (p - uCloudOrigin) / uCloudSpan;
  if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) return 1.0;
  // (au bord de la zone calculée, l'ombre s'efface doucement)
  float edge = smoothstep(0.0, 0.08, min(min(uv.x, uv.y), min(1.0 - uv.x, 1.0 - uv.y)));
  return mix(1.0, uCloudShade, texture2D(uCloudMap, uv).r * edge);
}
` + (sh.fragmentShader.includes('#include <lights_fragment_begin>')
      ? sh.fragmentShader.replace('#include <lights_fragment_begin>', begin)
      : sh.fragmentShader.replace(SUN, SHADE)); // (morceau déjà recopié par le terrain, voir world.js)
  }

  // Nouveau ciel centré sur l'hexagone (cq, cr), au temps T : calculé par work()
  start(cq, cr, T) {
    this.job = { cq, cr, T, cells: new Uint8Array(this.gw * this.gw), dq: -this.go };
  }

  // Avance le calcul pendant au plus budget ms, par rangées d'hexagones :
  //  1. quels hexagones sont des nuages (bruit)
  //  2. leur maillage (dessus, dessous, côtés au bord d'un nuage)
  //  3. carte de leur ombre, et on remplace l'ancien ciel
  work(budget) {
    const j = this.job, go = this.go, gw = this.gw, RAD = this.rad, end = performance.now() + budget;
    const cells = j.cells;
    while (j.dq <= go) {
      const dq = j.dq++;
      for (let dr = Math.max(-go, -dq - go); dr <= Math.min(go, -dq + go); dr++) {
        const q = j.cq + dq, r = j.cr + dr;
        if (!this.on(q, r, j.T)) continue;
        // teinte et hauteur : selon la pluie et l'orage sous ce nuage (valeur rangée dans
        // la case : 1 + nuance + 16 x montée, pour comparer deux ciels d'un coup)
        const c = hexToWorld(q, r), w = this.climate.atAdv(c.x * S, c.z * S, j.T, 0, this.wx);
        // (un ciel chargé est déjà grisâtre ; la pluie et l'orage le font virer au gris foncé)
        const dark = Math.min(1, 0.18 * w.cover + 0.25 * Math.max(0, w.cover - 0.6) + 0.65 * w.rain ** 0.7 + 0.45 * w.storm);
        const rise = w.storm > 0.12 ? Math.min(6, Math.round(w.storm * 7)) : 0;
        cells[(dq + go) * gw + dr + go] = 1 + Math.round(dark * DARK_LEVELS) + rise * 16;
      }
      if (performance.now() > end) return;
    }
    if (!j.pos) {
      // rien n'a changé : on garde le ciel actuel
      if (this.cells && this.base.q === j.cq && this.base.r === j.cr && cells.every((v, i) => v === this.cells[i])) {
        this.job = null;
        return;
      }
      let count = 0;
      for (const v of cells) if (v) count++;
      // dessus et dessous : 4 triangles chacun ; côtés : au plus 2 triangles x 6
      j.pos = new Float32Array(count * 20 * 9);
      j.nor = new Float32Array(j.pos.length);
      j.col = new Float32Array(j.pos.length);
      j.o = 0;
      j.gq = -RAD;
    }
    const cell = (dq, dr) => (Math.abs(dq) <= go && Math.abs(dr) <= go ? cells[(dq + go) * gw + dr + go] : 0);
    const top = (v) => THICK + ((v - 1) >> 4) * STORM_RISE;              // hauteur du dessus
    const shade = (v) => 1 - (((v - 1) & 15) / DARK_LEVELS) * 0.8;       // clarté (1 : blanc)
    const pos = j.pos, nor = j.nor, col = j.col;
    let lum = 1;
    const tri = (ax, ay, az, bx, by, bz, cx, cy, cz, nx, ny, nz) => {
      const o = j.o;
      pos[o] = ax; pos[o + 1] = ay; pos[o + 2] = az; pos[o + 3] = bx; pos[o + 4] = by; pos[o + 5] = bz;
      pos[o + 6] = cx; pos[o + 7] = cy; pos[o + 8] = cz;
      for (let v = 0; v < 9; v += 3) { nor[o + v] = nx; nor[o + v + 1] = ny; nor[o + v + 2] = nz; col[o + v] = col[o + v + 1] = col[o + v + 2] = lum; }
      j.o += 9;
    };
    while (j.gq <= RAD) {
      const dq = j.gq++;
      for (let dr = Math.max(-RAD, -dq - RAD); dr <= Math.min(RAD, -dq + RAD); dr++) {
        const v = cell(dq, dr);
        if (!v) continue;
        const c = hexToWorld(dq, dr), cx = c.x * S, cz = c.z * S, h = top(v), l = shade(v);
        // coins (hexagone de nuage S fois plus large qu'un bloc)
        const X = (i) => cx + CORNERS[i % 6][0] * S, Z = (i) => cz + CORNERS[i % 6][1] * S;
        for (let k = 1; k <= 4; k++) {
          lum = l;
          tri(X(0), h, Z(0), X(k + 1), h, Z(k + 1), X(k), h, Z(k), 0, 1, 0); // dessus
          lum = l * 0.7; // (le dessous d'un nuage est bien plus sombre : la base grise)
          tri(X(0), 0, Z(0), X(k), 0, Z(k), X(k + 1), 0, Z(k + 1), 0, -1, 0); // dessous
        }
        lum = l * 0.85;
        for (let i = 0; i < 6; i++) {
          // côté i : du dessus du voisin (ou du bas s'il n'y a pas de nuage) jusqu'au nôtre
          const n = cell(dq + NEIGHBORS[i][0], dr + NEIGHBORS[i][1]), y0 = n ? top(n) : 0;
          if (y0 >= h) continue;
          const ax = X(i), az = Z(i), bx = X(i + 1), bz = Z(i + 1);
          const a = Math.PI / 3 * i, nx = Math.cos(a), nz = Math.sin(a);
          tri(ax, y0, az, ax, h, az, bx, h, bz, nx, 0, nz);
          tri(ax, y0, az, bx, h, bz, bx, y0, bz, nx, 0, nz);
        }
      }
      if (performance.now() > end) return;
    }
    this.job = null;
    this.cells = cells;
    this.base = { q: j.cq, r: j.cr };
    // carte des nuages : centrée sur l'hexagone de base (chaque pixel sait sous quel
    // hexagone il est, calculé une fois pour toutes)
    if (!this.pixelCell) {
      this.pixelCell = new Int32Array(MAP * MAP);
      const px = SPAN / MAP;
      for (let y = 0; y < MAP; y++) {
        for (let x = 0; x < MAP; x++) {
          const h = worldToHex(((x + 0.5) * px - SPAN / 2) / S, ((y + 0.5) * px - SPAN / 2) / S);
          this.pixelCell[y * MAP + x] = Math.abs(h.q) <= go && Math.abs(h.r) <= go ? (h.q + go) * gw + h.r + go : -1;
        }
      }
    }
    const data = this.map.image.data, pc = this.pixelCell;
    for (let p = 0; p < data.length; p++) data[p] = pc[p] >= 0 && cells[pc[p]] ? 255 : 0;
    this.map.needsUpdate = true;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos.subarray(0, j.o), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor.subarray(0, j.o), 3));
    g.setAttribute('color', new THREE.BufferAttribute(j.col.subarray(0, j.o), 3));
    this.mesh.geometry.dispose();
    this.mesh.geometry = g;
  }
}
