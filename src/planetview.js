// Planètes vues de l'espace (vol spatial, cinématique d'arrivée, ciel) : des sphères pavées
// d'hexagones, comme le reste du jeu (un polyèdre de Goldberg : un icosaèdre découpé, dont chaque
// sommet devient une case hexagonale ; il reste 12 pentagones). Chaque case est un petit prisme
// en relief ; sa couleur vient du vrai terrain de la planète (voir sample) : vue d'en haut, la
// planète ressemble au monde où l'on se pose.
//  - océans lisses et brillants (reflet de l'étoile), terres mates ;
//  - atmosphère : un halo sur le bord, de la couleur de son ciel, et le côté nuit sombre ;
//  - nuages : une couche de cases blanches qui dérive ;
//  - géantes : des bandes, des anneaux de petits hexagones ;
//  - étoile : une sphère en shader et son rayonnement (voir starfx.js).
// Toutes les planètes sont faites au rayon 1 (à l'appelant de les mettre à l'échelle).
import * as THREE from 'three';
import { makeBeam, makeGlow, makeStarSurface } from './starfx.js?v=1.1.5-alpha-mwgq2wrb';

const cache = new Map(); // fréquence -> { verts, tiles } (la grille de cases)

// Grille de Goldberg de fréquence f : 10 f² + 2 cases. tiles[i] : { c (centre), poly (coins) }
export function goldberg(f) {
  if (cache.has(f)) return cache.get(f);
  const t = (1 + Math.sqrt(5)) / 2;
  const V = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map((v) => new THREE.Vector3(...v).normalize());
  const F = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
  const verts = [], index = new Map(), faces = [];
  const vid = (p) => {
    const k = Math.round(p.x * 1e5) + ',' + Math.round(p.y * 1e5) + ',' + Math.round(p.z * 1e5);
    let i = index.get(k);
    if (i === undefined) { i = verts.length; verts.push(p.clone()); index.set(k, i); }
    return i;
  };
  for (const [a, b, c] of F) {
    const A = V[a], B = V[b], C = V[c], grid = [];
    for (let i = 0; i <= f; i++) {
      grid.push([]);
      for (let j = 0; j <= f - i; j++) {
        const p = new THREE.Vector3().addScaledVector(A, (f - i - j) / f).addScaledVector(B, i / f).addScaledVector(C, j / f).normalize();
        grid[i].push(vid(p));
      }
    }
    for (let i = 0; i < f; i++) {
      for (let j = 0; j < f - i; j++) {
        faces.push([grid[i][j], grid[i + 1][j], grid[i][j + 1]]);
        if (j < f - i - 1) faces.push([grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]]);
      }
    }
  }
  // chaque sommet : une case dont les coins sont les centres des triangles qui le touchent
  const around = verts.map(() => []);
  const cent = faces.map(([a, b, c]) => new THREE.Vector3().add(verts[a]).add(verts[b]).add(verts[c]).normalize());
  faces.forEach((fc, i) => { for (const v of fc) around[v].push(i); });
  const tiles = verts.map((c, i) => {
    const n = c, u = new THREE.Vector3().crossVectors(Math.abs(n.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0), n).normalize(), w = new THREE.Vector3().crossVectors(n, u);
    const poly = around[i].map((fi) => cent[fi]).sort((p, q) => Math.atan2(p.dot(w), p.dot(u)) - Math.atan2(q.dot(w), q.dot(u)));
    return { c, poly };
  });
  const g = { verts, tiles };
  cache.set(f, g);
  return g;
}

const _c = new THREE.Color();
// Maillage des cases : color(dir) -> { color, h (relief, en rayon), sea (océan lisse) } ; inset :
// le liseré sombre entre les cases (0 : aucun)
export function tileMesh(f, color, opt = {}) {
  const job = tileSteps(f, color, opt);
  let r = job.next();
  while (!r.done) r = job.next();
  return r.value;
}
// La même chose, morceau par morceau (générateur : next() rend la main toutes les quelques cases ;
// pour ne pas figer le jeu, voir skyview.js)
export function* tileSteps(f, color, { inset = 0.08, wall = true, base = 1 } = {}) {
  const { tiles } = goldberg(f);
  const pos = [], col = [], nor = [], gloss = [];
  const push = (p, n, c, s) => { pos.push(p.x, p.y, p.z); nor.push(n.x, n.y, n.z); col.push(c.r, c.g, c.b); gloss.push(s); };
  for (let i = 0; i < tiles.length; i++) {
    if (i % 64 === 63) yield;
    const t = tiles[i], I = color(t.c), top = base + (I.h || 0), s = I.glow ? 2 : I.sea ? 1 : 0;
    _c.set(I.color);
    const c = _c.clone();
    const edge = c.clone().multiplyScalar(0.82);
    const center = t.c.clone().multiplyScalar(top);
    const ring = t.poly.map((p) => p.clone().lerp(t.c, inset).normalize().multiplyScalar(top));
    const outer = t.poly.map((p) => p.clone().normalize().multiplyScalar(top));
    for (let k = 0; k < ring.length; k++) {
      const a = ring[k], b = ring[(k + 1) % ring.length];
      push(center, t.c, c, s); push(a, t.c, c, s); push(b, t.c, c, s);
      if (inset > 0) {
        const A = outer[k], B = outer[(k + 1) % outer.length];
        push(a, t.c, edge, s); push(A, t.c, edge, s); push(B, t.c, edge, s);
        push(a, t.c, edge, s); push(B, t.c, edge, s); push(b, t.c, edge, s);
      }
    }
    // flancs : jusqu'au pied de la case (le relief se voit au bord des continents, des montagnes)
    if (wall && (I.h || 0) > 0.0005) {
      const low = base - 0.002, side = c.clone().multiplyScalar(0.62);
      for (let k = 0; k < outer.length; k++) {
        const A = outer[k], B = outer[(k + 1) % outer.length];
        const a0 = t.poly[k].clone().normalize().multiplyScalar(low), b0 = t.poly[(k + 1) % outer.length].clone().normalize().multiplyScalar(low);
        const n = new THREE.Vector3().subVectors(B, A).cross(t.c).normalize().negate();
        push(A, n, side, 0); push(a0, n, side, 0); push(b0, n, side, 0);
        push(A, n, side, 0); push(b0, n, side, 0); push(B, n, side, 0);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('gloss', new THREE.Float32BufferAttribute(gloss, 1));
  g.computeBoundingSphere();
  return g;
}

// Matière des cases : éclairée par l'étoile (côté nuit très sombre), reflet sur les océans
function surfaceMaterial() {
  const m = new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 60, specular: 0x000000, flatShading: false });
  m.userData.relief = { value: 1 }; // (hauteur du relief, de 0 à 1 : voir update)
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uRelief = m.userData.relief;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float gloss;\nvarying float vGloss;\nuniform float uRelief;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGloss = gloss;\nfloat rLen = length(transformed);\ntransformed *= (1.0 + (rLen - 1.0) * uRelief) / rLen;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vGloss;')
      .replace('vec3 specular = vec3( 0.0 );', '')
      .replace('#include <lights_phong_fragment>', '#include <lights_phong_fragment>\nmaterial.specularColor = vec3(0.5, 0.47, 0.4) * (vGloss > 1.5 ? 0.0 : vGloss);\nmaterial.specularShininess = mix(10.0, 140.0, min(vGloss, 1.0));\nif (vGloss > 1.5) totalEmissiveRadiance += diffuseColor.rgb * 0.75;');
  };
  return m;
}

// Halo de l'atmosphère : plus fort au bord, seulement du côté éclairé (et un peu au terminateur)
function atmoMaterial(color, strength = 1) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uSun: { value: new THREE.Vector3(1, 0, 0) }, uK: { value: strength } },
    vertexShader: `varying vec3 vN; varying vec3 vV; varying vec3 vW;
      void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = normalize(mat3(modelMatrix) * normal); vN = normalize(normalMatrix * normal); vV = normalize(-(viewMatrix * w).xyz); gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform vec3 uColor; uniform vec3 uSun; uniform float uK; varying vec3 vN; varying vec3 vV; varying vec3 vW;
      void main() { float rim = pow(1.0 - max(dot(vN, vV), 0.0), 2.6); float lit = smoothstep(-0.35, 0.45, dot(vW, uSun));
        gl_FragColor = vec4(uColor * rim * lit * 1.6 * uK, rim * lit * uK); }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.FrontSide,
  });
}

const hash3 = (v, s = 0) => { const h = Math.sin(v.x * 127.1 + v.y * 311.7 + v.z * 74.7 + s * 19.3) * 43758.5453; return h - Math.floor(h); };

// Une planète (ou l'étoile) au rayon 1. body : voir system.js. sample(dir) -> { color, h, sea }
// (le vrai terrain ; sinon : ses couleurs). detail : fréquence de la grille. Renvoie le groupe, avec
// userData.update(dt, sunDir) à appeler à chaque image (nuages, halo).
const SURF_CACHE = new Map(); // (cacheKey -> géométrie des cases : longue à calculer depuis le vrai terrain)
// La couleur des cases d'un astre (sans terrain : ses bandes, ou sa couleur moyenne)
function colorOf(body, color) {
  if (!color && body.bands) {
    const B = body.bands;
    color = (d) => {
      const lat = d.y + Math.sin(d.x * 6 + d.z * 3) * 0.04;
      const i = Math.floor((lat + 1) * B.length * 1.6) % B.length;
      const spot = body.spot && Math.hypot(d.x - 0.6, d.y + 0.25, d.z - 0.75) < 0.16;
      return { color: spot ? body.spot : B[(i + B.length) % B.length], h: 0 };
    };
  }
  return color || (() => ({ color: body.colors?.mid || '#888888', h: 0 }));
}
const cloudColor = (d) => {
  const k = Math.sin(d.x * 5.1 + Math.sin(d.y * 4.3) * 2) * Math.cos(d.z * 4.7 - d.y * 2) + (hash3(d, 7) - 0.5) * 0.9;
  return { color: k > 0.35 ? '#ffffff' : '#000000', h: 0 };
};
// Prépare peu à peu ce qui est long à calculer pour un astre (générateur : voir tileSteps) ; à la
// fin, makePlanet avec le même cacheKey et le même detail ne calcule plus rien. Les cases de
// l'étoile, peu nombreuses, ne passent pas par là.
export function* preparePlanet(body, { lazySample = null, detail = 22, cacheKey }) {
  const ck = cacheKey + '|' + detail;
  if (!SURF_CACHE.has(ck)) {
    const sg = yield* tileSteps(detail, colorOf(body, lazySample?.() || null), { inset: body.bands ? 0.04 : 0.08 });
    sg.userData.cached = true;
    SURF_CACHE.set(ck, sg);
  }
  if (body.clouds !== false && body.atmo?.density >= 0.5 && !body.bands && !CLOUD_CACHE.has(detail)) CLOUD_CACHE.set(detail, cloudGeometry(yield* tileSteps(detail, cloudColor, { inset: 0.18, wall: false, base: 1.018 })));
}
const CLOUD_CACHE = new Map(); // (detail -> la couche de nuages, la même pour tous)
// (cases noires : invisibles)
function cloudGeometry(geo) {
  const pos = geo.getAttribute('position'), colA = geo.getAttribute('color'), keep = [];
  for (let i = 0; i < pos.count; i += 3) if (colA.getX(i) > 0.5) keep.push(i);
  const p2 = new Float32Array(keep.length * 9), n2 = new Float32Array(keep.length * 9);
  const nA = geo.getAttribute('normal');
  keep.forEach((i, k) => { for (let j = 0; j < 3; j++) { p2.set([pos.getX(i + j), pos.getY(i + j), pos.getZ(i + j)], k * 9 + j * 3); n2.set([nA.getX(i + j), nA.getY(i + j), nA.getZ(i + j)], k * 9 + j * 3); } });
  geo.dispose();
  const cg = new THREE.BufferGeometry();
  cg.setAttribute('position', new THREE.BufferAttribute(p2, 3));
  cg.setAttribute('normal', new THREE.BufferAttribute(n2, 3));
  cg.userData.cached = true;
  return cg;
}

export function makePlanet(body, { sample = null, lazySample = null, detail = 22, clouds = true, cacheKey = null } = {}) {
  const g = new THREE.Group();
  g.userData.body = body;
  // étoile à neutrons (Ethan) : un point minuscule, blanc-bleu, d'un éclat intense ; Alpha lance
  // deux faisceaux qui balaient le ciel (ralentis : à 238 tours par seconde, on ne verrait qu'un
  // flou). Quand un faisceau passe sur nous, l'étoile flashe.
  if (body.pulsar) {
    const core = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    g.add(core);
    const glow = makeGlow({ size: 60, color: body.color, corona: body.corona, core: 0xffffff, halo: 1.4, spikes: 0.6, streamers: 0.25, flash: !!body.beams });
    g.add(glow);
    let spin = null, tilt = null;
    const ticks = [];
    if (body.beams) {
      spin = new THREE.Group();
      tilt = new THREE.Group();
      for (const s of [1, -1]) {
        // (un faisceau fin et très long, blanc au cœur, bleu au bord ; un second, large et pâle, autour)
        for (const [len, r0, r1, op, sharp] of [[420, 0.6, 9, 1, 3.2], [300, 2, 26, 0.28, 2.2]]) {
          const b = makeBeam({ length: len, r0, r1, color: body.corona, core: 0xf4f8ff, opacity: op, fall: 1.15, sharp, dust: 0.25 });
          if (s < 0) b.rotation.x = Math.PI;
          b.renderOrder = 1;
          b.userData.op0 = op;
          tilt.add(b);
          ticks.push(b.userData.tick);
        }
      }
      tilt.rotation.z = 0.7; // (l'axe magnétique est incliné sur l'axe de rotation)
      spin.add(tilt);
      g.add(spin);
    }
    // (vue de loin, l'étoile est réglée par skyview.js : la taille de son rayonnement, son éclat)
    Object.assign(g.userData, { glow, glowSize: 60, surf: core, beams: spin });
    // (les faisceaux ont leur vraie taille : k, l'échelle réelle par rapport à celle du modèle,
    // que skyview agrandit de loin pour qu'on voie l'étoile ; fade : leur éclat)
    g.userData.beamLook = (k, fade) => {
      if (!spin) return;
      spin.scale.setScalar(k);
      spin.visible = fade > 0.003;
      for (const m of tilt.children) m.material.opacity = m.userData.op0 * fade;
    };
    const ax = new THREE.Vector3(), q = new THREE.Quaternion();
    g.userData.update = (dt) => {
      glow.userData.uniforms.uTime.value += dt;
      if (!spin) return;
      spin.rotation.y += dt * 1.6;
      for (const t of ticks) t(dt);
      ax.set(0, 1, 0).applyQuaternion(q.copy(spin.quaternion).multiply(tilt.quaternion));
      glow.userData.uniforms.uAxis.value.copy(ax);
    };
    return g;
  }
  // étoile : une sphère qui bouillonne (granulation hexagonale, taches, bord assombri) et son rayonnement
  if (body.kind === 'star') {
    const surf = makeStarSurface({ color: body.color, corona: body.corona, cells: 34, seed: (body.R % 97) * 0.37 });
    g.add(surf);
    const glow = makeGlow({ size: 26, color: body.color, corona: body.corona, core: 0xffffff, halo: 1.2, spikes: 0.25, streamers: 1 });
    g.add(glow);
    Object.assign(g.userData, { glow, glowSize: 26, surf });
    g.userData.update = (dt) => {
      surf.userData.uniforms.uTime.value += dt;
      glow.userData.uniforms.uTime.value += dt;
      surf.rotation.y += dt * 0.01;
    };
    return g;
  }
  // (lazySample : () -> sample, appelé seulement si la géométrie n'est pas déjà en cache)
  const ck = cacheKey && cacheKey + '|' + detail;
  let sg = ck && SURF_CACHE.get(ck);
  if (!sg) {
    sg = tileMesh(detail, colorOf(body, sample || lazySample?.() || null), { inset: body.bands ? 0.04 : 0.08 });
    if (ck) { sg.userData.cached = true; SURF_CACHE.set(ck, sg); }
  }
  const surf = new THREE.Mesh(sg, surfaceMaterial());
  g.add(surf);
  // nuages (les planètes à atmosphère dense, pas les géantes : leurs bandes en tiennent lieu)
  let cl = null;
  if (clouds && body.clouds !== false && body.atmo?.density >= 0.5 && !body.bands) {
    let cg = CLOUD_CACHE.get(detail);
    if (!cg) { cg = cloudGeometry(tileMesh(detail, cloudColor, { inset: 0.18, wall: false, base: 1.018 })); CLOUD_CACHE.set(detail, cg); }
    cl = new THREE.Mesh(cg, new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, depthWrite: false }));
    g.add(cl);
  }
  // atmosphère
  let atmo = null;
  if (body.atmo?.rim) {
    atmo = new THREE.Mesh(new THREE.SphereGeometry(1.06, 48, 32), atmoMaterial(body.atmo.rim, Math.max(0.35, body.atmo.density)));
    g.add(atmo);
  }
  // anneaux : de petits hexagones en couronnes
  if (body.rings) {
    const hexGeo = new THREE.CircleGeometry(1, 6);
    let n = 0;
    const list = [];
    for (const [a, b, o] of body.rings) {
      const count = Math.round(6000 * (b - a));
      for (let i = 0; i < count; i++) list.push([a + Math.random() * (b - a), Math.random() * Math.PI * 2, o]);
      n += count;
    }
    const mat = new THREE.MeshLambertMaterial({ color: body.ringColor ?? 0xc8e0ea, transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false });
    const inst = new THREE.InstancedMesh(hexGeo, mat, n);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)), s = new THREE.Vector3(), p = new THREE.Vector3();
    list.forEach(([r, a, o], i) => {
      p.set(Math.cos(a) * r, (Math.random() - 0.5) * 0.004, Math.sin(a) * r);
      s.setScalar(0.01 + Math.random() * 0.02 * o);
      inst.setMatrixAt(i, m.compose(p, q, s));
      inst.setColorAt(i, _c.setHSL(0.53 + Math.random() * 0.04, 0.25, 0.55 + o * 0.35));
    });
    const ring = new THREE.Group();
    ring.add(inst);
    ring.rotation.z = 0.08;
    g.add(ring);
    g.userData.ring = ring;
  }
  g.rotation.z = body.tilt || 0;
  // (relief : tout près de la surface, les colonnes s'aplatissent, sinon elles feraient des centaines de blocs)
  g.userData.update = (dt, sunDir, relief = 1) => {
    surf.material.userData.relief.value = relief;
    // (la surface ne tourne pas : le point visé dans l'espace est celui où l'on arrive)
    if (cl) { cl.rotation.y += dt * 0.007; cl.rotation.x = Math.sin(cl.rotation.y * 0.5) * 0.02; }
    if (g.userData.ring) g.userData.ring.rotation.y += dt * 0.002;
    if (atmo && sunDir) atmo.material.uniforms.uSun.value.copy(sunDir);
  };
  return g;
}

// Couleur d'une case d'après un relief (hauteurs du générateur) : océan, plaine, montagne, sommet
export function paletteColor(colors, h, sea, lo, hi, glow = false) {
  if (h < sea) return glow ? { color: colors.sea, h: 0, glow: true } : { color: colors.sea, h: 0, sea: true };
  const k = Math.max(0, Math.min(1, (h - Math.max(sea, lo)) / Math.max(1, hi - Math.max(sea, lo))));
  const c = k < 0.33 ? lerpHex(colors.low, colors.mid, k / 0.33) : k < 0.75 ? lerpHex(colors.mid, colors.high, (k - 0.33) / 0.42) : lerpHex(colors.high, colors.peak, (k - 0.75) / 0.25);
  return { color: c, h: 0.004 + k * 0.022 };
}
const _l1 = new THREE.Color(), _l2 = new THREE.Color();
function lerpHex(a, b, t) { return '#' + _l1.set(a).lerp(_l2.set(b), Math.max(0, Math.min(1, t))).getHexString(); }

// Coordonnées du monde (blocs) d'une direction de la sphère : longitude -> x (d'est en ouest, pour
// que le monde vu de dessus et la sphère vue de dehors ne soient pas l'un le miroir de l'autre),
// latitude -> z (span : largeur du monde échantillonnée sur un tour)
export function dirToWorld(d, span) {
  const lon = -Math.atan2(d.z, d.x), lat = Math.asin(Math.max(-1, Math.min(1, d.y)));
  return { x: (lon / (Math.PI * 2)) * span, z: (-lat / Math.PI) * span * 0.5 };
}
// L'inverse : la direction d'un point du monde
export function worldToDir(x, z, span, out = new THREE.Vector3()) {
  const lon = -(x / span) * Math.PI * 2, lat = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, (-z / (span * 0.5)) * Math.PI));
  return out.set(Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon));
}
