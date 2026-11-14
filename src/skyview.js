// Les astres du système vus depuis le monde (voir system.js, planetview.js) : depuis le sol d'une
// planète (Hexa en grand dans le ciel de la Lune, Orgon qui remplit celui de Brasia), ou depuis
// un site dans l'espace (main.js, monde « space: »). Calculé à partir des vraies orbites : les
// phases et les éclipses viennent toutes seules.
//
//  - Au sol : les astres suivent la course du soleil dans le ciel (sky.js), décalés de leur vrai
//    écart à l'étoile (longitude et latitude, vues depuis la planète). Ils sont dessinés
//    4 fois plus grands que leur vraie taille apparente (l'étoile aussi, même sur Hexa : c'est son
//    soleil, et la Lune de Hexa sa lune) : de petits points la nuit, de grands disques pour les voisins proches.
//  - Éclipse : un astre passe devant l'étoile ; la part du disque cachée assombrit le jour.
//  - Dans l'espace : les vraies directions, la vraie taille, les astéroïdes proches ; les axes
//    sont ceux de la bulle où l'on est (voir spaceflight.js).
//  - Tout en haut du ciel d'une planète : elle-même, ronde, derrière le terrain.
// Les grands astres sont longs à calculer : c'est fait peu à peu (BUDGET ms par image), sans
// figer le jeu ; en attendant, une boule de leur couleur, puis la version moins détaillée.
// Ils sont dessinés juste après le ciel et avant le monde (voir frame dans main.js) : devant le
// ciel, derrière tout le reste. Chacun a sa vraie profondeur (sinon les flancs de ses colonnes
// passeraient devant le dessus des autres), remise à zéro entre deux astres : leurs tailles
// apparentes sont faites à la main, seul l'ordre du plus loin au plus proche compte.
import * as THREE from 'three';
import { STAR, BODIES, BODY, LY, bodyPos, sunOf, sunNear, spinAngle } from './system.js?v=1.1.5-alpha-mwgq2wrb';
// (au-delà, un astre n'est plus visible du tout : ni point, ni repère)
const SEE_MAX = 30 * LY;
import { makePlanet, preparePlanet } from './planetview.js?v=1.1.5-alpha-mwgq2wrb';
import { makeBlackHole } from './blackhole.js?v=1.1.5-alpha-mwgq2wrb';

const D = 200;       // distance (dans la scène) où sont posés les astres
const DOT = 0.004;   // rayon apparent (rad) sous lequel un astre n'est qu'un point lumineux
const ALL = [STAR, ...BODIES];
const BUDGET = 3;
const ROCKS = 48;
const ROUTES = 8;      // (lignes spatiales dessinées au plus)
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const STARS = ALL.filter((b) => b.kind === 'star');
// Éclairs des sauts nédrolytiques (voir spaceflight.jumpFlashes) : visibles de loin, depuis le sol
const FLASH_MAX = 32;
const FLASH_NEAR = 3e6, FLASH_FAR = 3e7; // (pleine lumière jusqu'à 3 millions de blocs ; plus rien à 30 millions)
let glowTex = null;
function flashTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.55, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  glowTex = new THREE.CanvasTexture(c);
  glowTex.colorSpace = THREE.SRGBColorSpace;
  return glowTex;
}
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// L'éclat d'une étoile vue d'ici : 1 à la distance d'Hexa à son étoile (un pulsar, minuscule, brille
// comme une vraie étoile : son rayonnement et ses jets)
const F0 = (STAR.R / BODY.hexa.orbit) ** 2;
const relOf = (b, d) => ((b.pulsar ? STAR.R * 0.6 : b.R) / d) ** 2 / F0;
// la lumière qu'on en reçoit, telle que l'œil la perçoit (bien plus douce que la vraie loi en 1/d²)
const lightOf = (rel) => Math.min(1.5, Math.pow(rel, 0.3));

// matériau d'un astre : pas de brouillard, dans la file des objets triés (voir update)
function farify(root) {
  root.traverse((m) => {
    if (!m.material) return;
    m.frustumCulled = false;
    for (const mat of [].concat(m.material)) {
      if (mat.userData.far) continue;
      mat.userData.far = true;
      mat.fog = false;
      mat.depthWrite = !mat.transparent; // (le sol oui ; pas les halos, les nuages, les anneaux)
      mat.transparent = true; // (tous dans la même file : dessinés du plus loin au plus proche)
      mat.needsUpdate = true;
    }
  });
}

// part du disque de rayon a cachée par un disque de rayon b dont le centre est à d (angles)
const relief = (alt, R) => Math.min(1, 0.1 + alt / (R * 0.3));

function overlap(a, b, d) {
  if (d >= a + b) return 0;
  if (d <= Math.abs(b - a)) return b >= a ? 1 : (b * b) / (a * a);
  const a2 = a * a, b2 = b * b;
  const k1 = Math.acos(Math.max(-1, Math.min(1, (d * d + a2 - b2) / (2 * d * a))));
  const k2 = Math.acos(Math.max(-1, Math.min(1, (d * d + b2 - a2) / (2 * d * b))));
  const area = a2 * k1 + b2 * k2 - 0.5 * Math.sqrt(Math.max(0, (-d + a + b) * (d + a - b) * (d - a + b) * (d + a + b)));
  return Math.min(1, area / (Math.PI * a2));
}

export class SystemView {
  // sample(b) : couleurs du terrain d'un astre (main.planetSample), seed : graine du monde
  constructor(sample) {
    this.sample = sample;
    this.scene = new THREE.Scene();
    this.light = new THREE.DirectionalLight(0xfff2dc, 2.2);
    this.scene.add(this.light, this.light.target, new THREE.AmbientLight(0x50586a, 0.15));
    // dans l'espace : la deuxième étoile la plus brillante (elle éclaire un peu, sans ombres)
    this.light2 = new THREE.DirectionalLight(0xffffff, 0);
    this.scene.add(this.light2, this.light2.target);
    this.lightK = 1;   // (force de la lumière de l'étoile, d'après sa distance : voir sky.siteUpdate)
    this.light2K = 0;
    this.lightColor = new THREE.Color(1, 1, 1);
    this.light2Color = new THREE.Color(1, 1, 1);
    this.glare = 0;    // (l'œil ébloui par l'étoile proche, de 0 à 1 : il s'y fait peu à peu)
    this._tA = 0;
    this.flareDir = new THREE.Vector3(); // (la direction de l'étoile qui éblouit, dans le monde : voir lensflare.js)
    this.flareColor = new THREE.Color();
    this.items = new Map(); // id -> { g (modèle), seed, detail, job, jobDetail }
    this.ball = new THREE.SphereGeometry(1, 20, 14);
    this.jobs = [];
    this._qi = new THREE.Quaternion();
    this._t = new THREE.Quaternion();
    this.dots = null;
    this.flashes = [];   // [{ x, y, z (absolu), size (fraction de D), k (éclat, 0 à 1), color }] : voir spaceflight.js
    this.flashSprites = [];
    // (un groupe dessiné après tous les astres : les modèles des astres sont des groupes triés entre eux)
    this.flashGroup = new THREE.Group();
    this.flashGroup.renderOrder = 9100;
    this.scene.add(this.flashGroup);
    this.on = false;
    this.eclipse = 0;
    this.seed = null;
    this._v = new THREE.Vector3();
    this._n = new THREE.Vector3();
    this._s = new THREE.Vector3();
    this._sunA = new THREE.Vector3();
    this._sunB = new THREE.Vector3();
    // (dans la file de dessin, avant chaque astre : on repart d'une profondeur vide)
    const blank = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3));
    const none = new THREE.MeshBasicMaterial({ transparent: true, colorWrite: false, depthWrite: false, fog: false });
    this.clears = [...ALL, null].map(() => {
      const c = new THREE.Mesh(blank, none);
      c.frustumCulled = false;
      c.onBeforeRender = (r) => { r.state.buffers.depth.setMask(true); r.clearDepth(); };
      this.scene.add(c);
      return c;
    });
  }

  // Le modèle d'un astre (preparé peu à peu la première fois qu'il est assez grand pour être vu)
  // (detail : plus de cases pour un astre qui paraît grand)
  model(b, detail = 20) {
    let it = this.items.get(b.id);
    if (it?.seed !== this.seed) {
      if (it) this.scene.remove(it.g);
      it = { g: null, seed: this.seed, detail: 0, job: null, jobDetail: 0 };
      this.items.set(b.id, it);
      // (en attendant : une boule)
      const col = b.colors?.mid || b.bands?.[0] || b.color || '#888888';
      if (b.kind === 'hole') {
        it.g = makeBlackHole(b);
        farify(it.g);
        this.scene.add(it.g);
        return it.g;
      }
      it.g = new THREE.Group();
      it.g.add(new THREE.Mesh(this.ball, b.kind === 'star' ? new THREE.MeshBasicMaterial({ color: col }) : new THREE.MeshLambertMaterial({ color: col })));
      it.g.rotation.z = b.tilt || 0;
      farify(it.g);
      this.scene.add(it.g);
    }
    if (b.kind === 'hole') return it.g;
    if (b.kind === 'star') detail = 14;
    if (it.detail !== detail && it.jobDetail !== detail) {
      const opt = { lazySample: this.sample ? () => this.sample(b, this.seed) : null, detail, cacheKey: b.id + '|' + this.seed };
      it.jobDetail = detail;
      it.job = b.kind === 'star' ? null : preparePlanet(b, opt);
      if (!this.jobs.includes(it)) this.jobs.push(it);
      it.make = () => {
        const g = makePlanet(b, opt);
        // (une étoile : sa surface aplatie face à la caméra, comme son rayonnement, voir starfx.js)
        const fl = b.kind === 'star' && g.userData.surf?.userData?.uniforms?.uFlat; if (fl) fl.value = 1;
        farify(g);
        this.scene.remove(it.g);
        g.position.copy(it.g.position); g.scale.copy(it.g.scale); g.quaternion.copy(it.g.quaternion); g.visible = it.g.visible;
        this.scene.add(g);
        it.g = g;
        it.detail = detail;
      };
    }
    return it.g;
  }
  // Un peu de travail à chaque image
  work() {
    const it = this.jobs[0];
    if (!it) return;
    const end = performance.now() + BUDGET;
    while (performance.now() < end) {
      if (it.job && !it.job.next().done) continue;
      it.job = null;
      it.make();
      it.make = null;
      this.jobs.shift();
      return;
    }
  }

  // Les astéroïdes proches (dans une ceinture)
  rockLayer() {
    if (this.rockMesh) return this.rockMesh;
    const m = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }), ROCKS);
    m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(ROCKS * 3), 3);
    m.renderOrder = 9000;
    farify(m);
    this.scene.add(m);
    return (this.rockMesh = m);
  }
  placeRocks(list, O) {
    if (!list?.length && !this.rockMesh) return;
    const m = this.rockLayer(), v = this._v, mt = (this._mt ||= new THREE.Matrix4()), sc = (this._sc ||= new THREE.Vector3()), q0 = (this._q0 ||= new THREE.Quaternion()), c = (this._cc ||= new THREE.Color());
    let n = 0;
    for (const R of list || []) {
      if (n >= ROCKS) break;
      v.set(R.x - O.x, R.y - O.y, R.z - O.z);
      const d = v.length();
      if (d < 1) continue;
      const k = D / d;
      v.multiplyScalar(k);
      sc.set(R.rx * k, R.ry * k, R.rz * k);
      m.setMatrixAt(n, mt.compose(v, q0, sc));
      m.setColorAt(n, c.set(R.ice ? 0xc8dce8 : 0x8a8078));
      n++;
    }
    m.count = n;
    m.instanceMatrix.needsUpdate = true;
    m.instanceColor.needsUpdate = true;
  }

  // Les lignes spatiales (voir spaceflight.curveOf), de loin ; les astres passent devant
  placeRoutes(list, O) {
    if (!list?.length && !this.routes) return;
    if (!this.routes) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(ROUTES * 256 * 6), 3));
      const l = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x8fa3b8, transparent: true, opacity: 0.55, depthWrite: false, fog: false }));
      l.frustumCulled = false;
      l.renderOrder = -1;
      this.scene.add(l);
      this.routes = l;
    }
    const attr = this.routes.geometry.getAttribute('position'), arr = attr.array;
    const put = (P, k, n) => {
      const x = P[k] - O.x, y = P[k + 1] - O.y, z = P[k + 2] - O.z, d = Math.hypot(x, y, z), s = D / (d || 1);
      arr[n] = x * s; arr[n + 1] = y * s; arr[n + 2] = z * s;
      return d;
    };
    let n = 0;
    for (const c of (list || []).slice(0, ROUTES)) {
      for (let i = 0; i < 256; i++) {
        const a = put(c.pos, i * 3, n), b = put(c.pos, i * 3 + 3, n + 3);
        if (a > 4000 && b > 4000) n += 6; // (tout près : ce sont les vrais rails)
      }
    }
    this.routes.geometry.setDrawRange(0, n / 3);
    attr.needsUpdate = true;
  }

  // Les points (astres lointains)
  dotLayer() {
    if (this.dots) return this.dots;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(ALL.length * 3), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(ALL.length * 3), 3));
    const p = new THREE.Points(g, new THREE.PointsMaterial({ size: 2.6, sizeAttenuation: false, vertexColors: true, transparent: true }));
    p.renderOrder = -1; // (avant les astres)
    farify(p);
    this.scene.add(p);
    return (this.dots = p);
  }

  // o : { seed, day (jours, avec la fraction), here (id de l'astre où l'on est) | at ({ x, y, z }
  //   absolu : dans l'espace), sunDir (au sol : direction du soleil de sky.js), angle, tilt,
  //   sunPath (angle, tilt) -> direction (au sol), daylight }
  // (moonInfo : la Lune de Hexa vue d'ici, { lit (part éclairée), waxing (croissante), y (hauteur) })
  // Rend la part de l'étoile cachée (éclipse), de 0 à 1.
  update(o) {
    this.on = true;
    this.work();
    if (o.seed !== this.seed) this.seed = o.seed;
    const O = o.here ? bodyPos(o.here, o.day, o.seed) : o.at;
    const surface = !!o.here, K = surface ? 4 : 1;
    // l'astre qui éclaire cet endroit (l'étoile, ou le trou noir dans son système), vu d'ici
    let sun = surface ? sunOf(BODY[o.here]) : sunNear(O, o.day, o.seed);
    // dans l'espace : les deux étoiles les plus brillantes vues d'ici. La plus brillante éclaire et fait
    // les ombres, l'autre éclaire un peu ; entre deux étoiles, la lumière passe de l'une à l'autre
    // sans saut (près d'un trou noir : c'est lui, comme avant)
    let rel1 = 1, second = null;
    if (!surface) {
      const lit = (this._lit ||= STARS.map((b) => ({ b, P: { x: 0, y: 0, z: 0 }, rel: 0 })));
      for (const e of lit) { bodyPos(e.b.id, o.day, o.seed, e.P); e.rel = relOf(e.b, Math.max(1, Math.hypot(e.P.x - O.x, e.P.y - O.y, e.P.z - O.z))); }
      lit.sort((a, b) => b.rel - a.rel);
      if (sun.kind !== 'hole') { sun = lit[0].b; rel1 = lit[0].rel; second = lit[1] || null; } else second = lit[0];
    }
    const SP = bodyPos(sun.id, o.day, o.seed, this._sp ||= { x: 0, y: 0, z: 0 });
    const sx = SP.x - O.x, sy = SP.y - O.y, sz = SP.z - O.z, sd = Math.hypot(sx, sy, sz);
    const sLon = Math.atan2(sz, sx), sLat = Math.asin(sy / sd), sRad = Math.asin(Math.min(1, sun.R / sd));
    // au sol : le plan de la course du soleil
    let n = null;
    if (surface) {
      const a = o.sunPath(o.angle), b = o.sunPath(o.angle + Math.PI / 2);
      n = this._n.crossVectors(a, b).normalize();
      this.light.position.copy(o.sunDir);
    } else {
      // (sur une ligne spatiale, près d'un astre : encore son soleil à lui, voir spaceflight.js)
      this._sunA.set(sx / sd, sy / sd, sz / sd);
      if (o.sunK > 0) this._sunA.lerp(this._sunB.copy(o.sunLocal).applyQuaternion(o.frameQ), o.sunK).normalize();
      this.light.position.copy(this._sunA);
    }
    // l'œil s'habitue à l'éclat de l'étoile (quelques secondes) : C dans sky.siteUpdate, et les autres astres
    const now = performance.now(), dtA = Math.min(0.25, (now - (this._tA || now)) / 1000);
    this._tA = now;
    const G = surface || sun.kind === 'hole' ? 0 : smooth(-4, 1, Math.log10(Math.max(1e-30, rel1)));
    this.glare += (G - this.glare) * (1 - Math.exp(-dtA * 1.2));
    this.lightK = surface || sun.kind === 'hole' ? 1 : lightOf(rel1);
    this.lightColor.set(sun.color || '#ffffff');
    this.light.color.set(surface ? 0xfff2dc : 0xffffff);
    if (!surface) this.light.color.lerp(this.lightColor, 0.35);
    if (second && second.b !== sun) {
      const P = second.P, d = Math.max(1, Math.hypot(P.x - O.x, P.y - O.y, P.z - O.z));
      this.light2.position.set((P.x - O.x) / d, (P.y - O.y) / d, (P.z - O.z) / d);
      this.light2K = lightOf(second.rel) * (second.b.dim ?? 1);
      this.light2Color.set(second.b.color || '#ffffff');
      this.light2.color.set(0xffffff).lerp(this.light2Color, 0.35);
    } else this.light2K = 0;
    this.light2.intensity = 2.2 * this.light2K;
    this.flareOn = false;
    this.light.target.position.set(0, 0, 0);
    // (dans une bulle : ses axes ; tout le reste s'y place)
    if (o.frameQ) this._qi.copy(o.frameQ).invert(); else this._qi.identity();
    this.scene.quaternion.copy(this._qi);
    this.placeRocks(surface ? null : o.rocks, O);
    this.placeRoutes(surface ? null : o.routes, O);
    const dots = this.dotLayer(), dp = dots.geometry.getAttribute('position'), dc = dots.geometry.getAttribute('color');
    let nd = 0, ecl = 0;
    this.moonInfo = null;
    const order = [];
    for (const b of ALL) {
      if (b.id === o.here) {
        // tout en haut du ciel : la planète, ronde, sous nos pieds
        if (!o.below) { this.hideModel(b.id); continue; }
        const dist = b.R + o.below.alt, g = this.model(b, 36), k = D / dist;
        g.visible = true;
        g.position.set(0, -dist * k, 0);
        g.scale.setScalar(b.R * k);
        g.quaternion.copy(this._t.copy(o.below.Q).invert());
        if (b.tilt) g.quaternion.multiply(this._t.setFromAxisAngle(this._s.set(0, 0, 1), b.tilt));
        if (b.locked) g.quaternion.multiply(this._t.setFromAxisAngle(Y_AXIS, spinAngle(b, o.day, o.seed)));
        g.userData.update?.(0.016, this._s.copy(this.light.position).normalize(), relief(o.below.alt, b.R));
        order.push([0, g]);
        continue;
      }
      if (o.hide && o.hide.has(b.id)) { this.hideModel(b.id); continue; }
      let dir, dist, ang;
      if (b === sun) {
        dist = sd; ang = sRad;
        dir = surface ? this._v.copy(o.sunDir) : this._v.copy(this._sunA);
      } else {
        const P = bodyPos(b.id, o.day, o.seed);
        const vx = P.x - O.x, vy = P.y - O.y, vz = P.z - O.z;
        dist = Math.hypot(vx, vy, vz);
        if (dist > SEE_MAX) { this.hideModel(b.id); continue; }
        ang = Math.asin(Math.min(1, b.R / dist));
        if (surface && !o.local) {
          const lon = Math.atan2(vz, vx), lat = Math.asin(vy / dist);
          let dl = lon - sLon;
          dl = Math.atan2(Math.sin(dl), Math.cos(dl));
          const dlat = lat - sLat;
          dir = this._v.copy(o.sunPath(o.angle - dl)).multiplyScalar(Math.cos(dlat)).addScaledVector(n, Math.sin(dlat)).normalize();
          if (b.id === 'lune') {
            const c = Math.max(-1, Math.min(1, dir.dot(o.sunDir)));
            this.moonInfo = { lit: (1 - c) / 2, waxing: Math.sin(dl) > 0, y: dir.y };
          }
          // devant l'étoile ? (plus près qu'elle)
          if (dist < sd) ecl = Math.max(ecl, overlap(sRad, ang, Math.hypot(dl * Math.cos(sLat), dlat)));
        } else {
          dir = this._v.set(vx / dist, vy / dist, vz / dist);
          if (dist < sd) {
            const c = (vx * sx + vy * sy + vz * sz) / (dist * sd);
            ecl = Math.max(ecl, overlap(sRad, ang, Math.acos(Math.max(-1, Math.min(1, c)))));
          }
          if (o.local) dir.applyQuaternion(o.local); // (planète synchrone : les vraies directions)
        }
      }
      // (un trou noir n'est pas agrandi autant : on le verrait de bien trop près)
      const r = Math.min(1.3, ang * (surface && b.kind === 'hole' ? 1.5 : K));
      if (r < DOT && b !== sun && b.kind !== 'star') {
        // un point : visible la nuit (ou quand l'air est rare)
        this.hideModel(b.id);
        const k = (1 - (o.daylight ?? 0) * 0.95) * Math.min(1, 0.35 + r / DOT) * (1 - 0.7 * this.glare);
        if (k < 0.02) continue;
        dp.setXYZ(nd, dir.x * D, dir.y * D, dir.z * D);
        const c = new THREE.Color(b.colors?.mid || b.color || '#ffffff');
        dc.setXYZ(nd, c.r * k + 0.15 * k, c.g * k + 0.15 * k, c.b * k + 0.15 * k);
        nd++;
        continue;
      }
      const g = this.model(b, r > 0.5 ? 36 : r > 0.12 ? 28 : 20);
      g.visible = true;
      g.quaternion.setFromAxisAngle(this._s.set(0, 0, 1), b.tilt || 0);
      if (b.locked) g.quaternion.multiply(this._t.setFromAxisAngle(Y_AXIS, spinAngle(b, o.day, o.seed)));
      if (surface && o.local) g.quaternion.premultiply(o.local);
      g.userData.setDist?.(dist / b.R);
      g.position.copy(dir).multiplyScalar(D);
      // (au sol : agrandi ; dans l'espace : à sa vraie taille, même tout près)
      g.scale.setScalar(surface ? D * Math.tan(Math.max(r, DOT)) : Math.max(b.R * (D / dist), D * DOT));
      g.userData.update?.(0.016, this._s.copy(this.light.position).normalize().applyQuaternion(this._qi), relief(dist - b.R, b.R));
      if (g.userData.glow) this.starLook(g, b, b === sun, surface, dist, ang, o.daylight ?? 0);
      if (g.userData.beamLook) {
        // (pulsar : ses faisceaux à leur vraie taille, pas agrandis avec l'étoile ; trop petits pour
        // être vus de si loin, ils s'effacent : il ne reste que le flash quand ils passent sur nous)
        const real = (b.R * D) / dist, len = real * 420;
        g.userData.beamLook(Math.min(1, real / g.scale.x), Math.min(1, len / 6) * (surface ? 1 - (o.daylight ?? 0) * 0.9 : 1));
      }
      if (!surface && b === sun) { this.flareOn = true; this.flareDir.copy(dir).applyQuaternion(this._qi); this.flareColor.set(b.color || '#ffffff'); }
      order.push([dist, g]);
    }
    // les éclairs des sauts (et les vaisseaux en saut, des points qui filent)
    this.placeFlashes(O, (vx, vy, vz, dist) => {
      if (surface && !o.local) {
        const lon = Math.atan2(vz, vx), lat = Math.asin(vy / dist);
        let dl = lon - sLon;
        dl = Math.atan2(Math.sin(dl), Math.cos(dl));
        return this._v.copy(o.sunPath(o.angle - dl)).multiplyScalar(Math.cos(lat - sLat)).addScaledVector(n, Math.sin(lat - sLat)).normalize();
      }
      const d = this._v.set(vx / dist, vy / dist, vz / dist);
      return surface && o.local ? d.applyQuaternion(o.local) : d;
    }, surface ? o.daylight ?? 0 : 0, K);
    // les plus loin d'abord (pas d'écriture de profondeur)
    order.sort((a, b) => b[0] - a[0]);
    order.forEach(([, g], i) => g.traverse((m) => { m.renderOrder = i * 4 + (m.renderOrder % 4 || 0); }));
    this.clears.forEach((c, i) => { c.visible = i <= order.length; c.renderOrder = i < order.length ? i * 4 - 0.5 : 8999.5; });
    dp.needsUpdate = dc.needsUpdate = true;
    dots.geometry.setDrawRange(0, nd);
    // (éclipse : la lumière de l'étoile baisse aussi pour les astres)
    this.sunDim = sun.dim ?? 1;
    // (au sol, la nuit : l'œil s'habitue au noir, la lune et les planètes éclairées brillent)
    const night = surface ? 1 + 3 * (1 - Math.min(1, o.daylight ?? 1)) : 1;
    this.light.intensity = 2.2 * (1 - ecl) * this.sunDim * night * this.lightK;
    this.eclipse = ecl;
    return ecl;
  }

  // Une étoile vue d'ici (A) : de loin, un point net de sa couleur ; en approchant, il brille de plus
  // en plus, prend une lueur et des aigrettes ; tout près, son vrai rayonnement, puis sa surface.
  // Tout suit son éclat (sa taille et sa distance) : rien n'apparaît d'un coup.
  starLook(g, b, isSun, surface, dist, ang, daylight) {
    const glow = g.userData.glow, u = glow.userData.uniforms, surf = g.userData.surf;
    if (surface && isSun) { u.uSize.value = g.userData.glowSize; u.uOpacity.value = 1; surf.scale.setScalar(1); return; }
    const L = Math.log10(Math.max(1e-30, relOf(b, dist)));
    const th = Math.max(0.0035 + 0.05 * smooth(-10, -1, L), ang * g.userData.glowSize * smooth(-2.5, -0.5, L));
    u.uSize.value = Math.max(1.05, (D * Math.tan(Math.min(1.2, th))) / g.scale.x);
    let op = smooth(-13.5, -6, L) * smooth(SEE_MAX, SEE_MAX * 0.6, dist);
    if (!isSun) op *= 1 - 0.75 * this.glare; // (C : ébloui par l'étoile proche, on voit moins les autres)
    if (surface) op *= 1 - daylight * 0.95;
    u.uOpacity.value = op;
    surf.scale.setScalar(Math.max(1e-3, smooth(-13.5, -8, L) * (surface ? 1 - daylight * 0.9 : 1)));
    g.visible = op > 0.003;
  }

  hideModel(id) {
    const it = this.items.get(id);
    if (it) it.g.visible = false;
  }

  // dirOf(vx, vy, vz, dist) : la direction dans ce ciel d'un point absolu (à vx, vy, vz d'ici)
  // (K : les astres sont grossis K fois au sol ; un éclair près d'un astre s'en écarte d'autant)
  placeFlashes(O, dirOf, daylight, K) {
    let n = 0;
    const k1 = f => (f.rx !== undefined ? K - 1 : 0);
    for (const f of this.flashes) {
      if (n >= FLASH_MAX) break;
      const e = k1(f), vx = f.x + (f.rx || 0) * e - O.x, vy = f.y + (f.ry || 0) * e - O.y, vz = f.z + (f.rz || 0) * e - O.z, dist = Math.hypot(vx, vy, vz);
      if (dist < 1 || dist > FLASH_FAR) continue;
      const far = dist < FLASH_NEAR ? 1 : 1 - Math.log(dist / FLASH_NEAR) / Math.log(FLASH_FAR / FLASH_NEAR);
      const k = f.k * far * (1 - daylight * 0.55);
      if (k < 0.02) continue;
      let sp = this.flashSprites[n];
      if (!sp) {
        sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: flashTexture(), color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, fog: false }));
        sp.frustumCulled = false;
        this.flashGroup.add(sp);
        this.flashSprites[n] = sp;
      }
      const dir = dirOf(vx, vy, vz, dist);
      sp.position.copy(dir).multiplyScalar(D * 0.97);
      sp.scale.setScalar(D * f.size * (0.6 + 0.4 * far));
      sp.material.color.set(f.color || '#e6dcff');
      sp.material.opacity = Math.min(1, k);
      sp.visible = true;
      n++;
    }
    for (let i = n; i < this.flashSprites.length; i++) this.flashSprites[i].visible = false;
  }

  hide() { this.on = false; }

  render(renderer, camera) {
    if (!this.on) return;
    // (les astres sont autour de la caméra : sa position telle que la voit la carte graphique, près
    // de zéro, voir origin.js ; pas celle du monde, qui peut valoir des dizaines de milliards)
    this.scene.position.setFromMatrixPosition(camera.matrixWorld);
    const ac = renderer.autoClear;
    renderer.autoClear = false;
    renderer.render(this.scene, camera);
    renderer.autoClear = ac;
  }
}
