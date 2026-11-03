// Personnage fait de prismes hexagonaux, habillé avec une skin Minecraft 64x64.
//
// Chaque partie (tête, corps, bras, jambes) est un prisme hexagonal vertical avec
// une face tournée vers l'avant (-Z) et une vers l'arrière. La bande de côté de la
// skin (droite | devant | gauche | dos) est enroulée autour des 6 faces :
// le devant et le dos occupent une face entière, chaque côté est partagé
// entre les deux faces diagonales qui l'entourent.
import * as THREE from 'three';

const PX = 1.8 / 32;   // taille d'un pixel de skin en unités monde (32 px = 1.8 de haut)
const WIDEN = 0.66;     // demi-largeur de l'hexagone (coin à coin) / largeur de la partie
const DEEPEN = 0.57;    // demi-profondeur de l'hexagone / profondeur de la partie

// Coins de l'hexagone, dans l'ordre droite -> devant -> gauche -> dos (le perso regarde -Z, sa droite est +X).
function hexCorners(X, Z) {
  return [[X, 0], [X / 2, -Z], [-X / 2, -Z], [-X, 0], [-X / 2, Z], [X / 2, Z]];
}

/**
 * Prisme hexagonal texturé (aussi utilisé pour les animaux, voir animals.js).
 * w, h, d : taille de la partie en pixels de skin ; (u0, v0) : coin de la partie dans la skin.
 * y0 : bas du prisme (en pixels, relatif au pivot). grow : épaississement (couche extérieure).
 * px : taille d'un pixel de skin en unités monde. tw, th : taille de la texture (pixels).
 */
export function hexPart({ w, h, d, u0, v0, y0 = -h, grow = 0, px = PX, tw = 64, th = 64 }) {
  const X = (WIDEN * w + grow) * px;
  const Z = (DEEPEN * d + grow) * px;
  const yb = (y0 - grow) * px, yt = (y0 + h + grow) * px;
  const C = hexCorners(X, Z);
  const uv = (px, py) => [px / tw, py / th];

  const pos = [], uvs = [], ind = [];
  const poly = (verts, tex, nx, ny, nz) => {
    const base = pos.length / 3;
    const [a, b, c] = verts;
    const cx = (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]);
    const cy = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
    const cz = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    const flip = cx * nx + cy * ny + cz * nz < 0;
    verts.forEach((v, i) => { pos.push(...v); uvs.push(...tex[i]); });
    for (let i = 1; i < verts.length - 1; i++) {
      if (flip) ind.push(base, base + i + 1, base + i);
      else ind.push(base, base + i, base + i + 1);
    }
  };

  // Côtés : position de chaque coin le long de la bande de la skin (en pixels).
  const anchors = [d / 2, d, d + w, d + w + d / 2, 2 * d + w, 2 * d + 2 * w];
  const vTop = v0 + d, vBot = v0 + d + h;
  for (let k = 0; k < 6; k++) {
    const [ax, az] = C[k], [bx, bz] = C[(k + 1) % 6];
    const ua = u0 + (k === 5 ? 0 : anchors[k]);
    const ub = u0 + (k === 5 ? d / 2 : anchors[k + 1]);
    poly(
      [[ax, yb, az], [bx, yb, bz], [bx, yt, bz], [ax, yt, az]],
      [uv(ua, vBot), uv(ub, vBot), uv(ub, vTop), uv(ua, vTop)],
      (ax + bx) / 2, 0, (az + bz) / 2,
    );
  }

  // Dessus et dessous
  const capU = (x) => (X - x) / (2 * X) * w;
  poly(C.map(([x, z]) => [x, yt, z]), C.map(([x, z]) => uv(u0 + d + capU(x), v0 + (Z - z) / (2 * Z) * d)), 0, 1, 0);
  poly(C.map(([x, z]) => [x, yb, z]), C.map(([x, z]) => uv(u0 + d + w + capU(x), v0 + (z + Z) / (2 * Z) * d)), 0, -1, 0);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(ind);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Pavé texturé comme une partie de personnage de Minecraft (aperçu « style Minecraft », voir
 * SkinView) : mêmes paramètres que hexPart. La skin se plie autour du pavé comme dans Minecraft :
 * bande droite | devant | gauche | dos, dessus et dessous au-dessus (le perso regarde -Z, sa
 * droite est +X).
 */
export function boxPart({ w, h, d, u0, v0, y0 = -h, grow = 0, px = PX, tw = 64, th = 64 }) {
  const X = (w / 2 + grow) * px, Z = (d / 2 + grow) * px;
  const yb = (y0 - grow) * px, yt = (y0 + h + grow) * px;
  const pos = [], uvs = [], ind = [];
  // face : 4 coins (haut gauche, haut droit, bas droit, bas gauche, vus de dehors), rectangle de
  // la skin [u, v, largeur, hauteur], normale vers l'extérieur
  const face = (c, [u, v, fw, fh], n) => {
    const base = pos.length / 3;
    const t = [[u, v], [u + fw, v], [u + fw, v + fh], [u, v + fh]];
    c.forEach((p, i) => { pos.push(...p); uvs.push(t[i][0] / tw, t[i][1] / th); });
    // (sens des triangles : la face avant regarde vers l'extérieur)
    const [a, b, cc] = c;
    const cx = (b[1] - a[1]) * (cc[2] - a[2]) - (b[2] - a[2]) * (cc[1] - a[1]);
    const cy = (b[2] - a[2]) * (cc[0] - a[0]) - (b[0] - a[0]) * (cc[2] - a[2]);
    const cz = (b[0] - a[0]) * (cc[1] - a[1]) - (b[1] - a[1]) * (cc[0] - a[0]);
    if (cx * n[0] + cy * n[1] + cz * n[2] < 0) ind.push(base, base + 2, base + 1, base, base + 3, base + 2);
    else ind.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };
  face([[X, yt, -Z], [-X, yt, -Z], [-X, yb, -Z], [X, yb, -Z]], [u0 + d, v0 + d, w, h], [0, 0, -1]);          // devant
  face([[-X, yt, Z], [X, yt, Z], [X, yb, Z], [-X, yb, Z]], [u0 + 2 * d + w, v0 + d, w, h], [0, 0, 1]);      // dos
  face([[X, yt, Z], [X, yt, -Z], [X, yb, -Z], [X, yb, Z]], [u0, v0 + d, d, h], [1, 0, 0]);                  // côté droit
  face([[-X, yt, -Z], [-X, yt, Z], [-X, yb, Z], [-X, yb, -Z]], [u0 + d + w, v0 + d, d, h], [-1, 0, 0]);     // côté gauche
  face([[X, yt, Z], [-X, yt, Z], [-X, yt, -Z], [X, yt, -Z]], [u0 + d, v0, w, d], [0, 1, 0]);                // dessus
  face([[X, yb, -Z], [-X, yb, -Z], [-X, yb, Z], [X, yb, Z]], [u0 + d + w, v0, w, d], [0, -1, 0]);           // dessous
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(ind);
  geo.computeVertexNormals();
  return geo;
}

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

// Bras fins (skins "Alex") : la colonne 54-55 du bras droit est transparente.
function isSlim(img) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  return ctx.getImageData(54, 20, 1, 1).data[3] === 0;
}

// Posture accroupie (c : 0 debout .. 1 accroupi) : le buste se penche en avant, la tête et
// les bras suivent, les jambes plient un peu (tout le corps descend)
export function crouchPose(p, c) {
  if (!p.base) p.base = Object.fromEntries(Object.entries(p).map(([k, o]) => [k, o.position.clone()]));
  const lean = 0.45 * c, len = 12 * PX, sink = 0.1 * c;
  const dz = -Math.sin(lean) * len, dy = -(1 - Math.cos(lean)) * len - sink;
  p.body.rotation.x = -lean;
  p.body.position.set(p.base.body.x, p.base.body.y - sink, p.base.body.z);
  for (const k of ['head', 'armL', 'armR']) p[k].position.set(p.base[k].x, p.base[k].y + dy, p.base[k].z + dz);
  // les jambes reculent un peu sous le bassin
  for (const k of ['legL', 'legR']) p[k].position.set(p.base[k].x, p.base[k].y, p.base[k].z + 0.1 * c);
}

// Style des personnages (joueurs : le sien, les autres, l'aperçu) : 'hex' (prismes hexagonaux)
// ou 'box' (pavés, comme dans Minecraft) ; réglage du joueur (écran Compte)
let STYLE = 'hex';
// Chapeau porté (emplacement d'équipement « tête ») : id de l'objet, ou 0. La casquette de
// conducteur : un prisme hexagonal bleu marine (comme la tête), un bandeau doré, une visière
let capMats = null;
export function setHat(parts, id) {
  const head = parts?.head;
  if (!head) return;
  if (head.userData.hat) { head.remove(head.userData.hat); head.userData.hat = null; }
  if (id === 664) { setLampHelmet(head); return; }
  if (id !== 551) return;
  capMats ||= { navy: new THREE.MeshLambertMaterial({ color: 0x1f2f5a }), gold: new THREE.MeshLambertMaterial({ color: 0xe3b12a }), black: new THREE.MeshLambertMaterial({ color: 0x17181c }) };
  const g = new THREE.Group(), top = 8 * PX;
  const add = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; o.userData.skin = true; g.add(o); return o; };
  add(new THREE.CylinderGeometry(0.34, 0.31, 0.15, 6).rotateY(Math.PI / 2), capMats.navy, 0, top + 0.1, 0.01);
  add(new THREE.CylinderGeometry(0.315, 0.315, 0.06, 6).rotateY(Math.PI / 2), capMats.gold, 0, top + 0.02, 0.01);
  add(new THREE.BoxGeometry(0.3, 0.025, 0.16), capMats.black, 0, top + 0.0, -0.31);
  add(new THREE.BoxGeometry(0.07, 0.07, 0.02), capMats.gold, 0, top + 0.11, -0.29);
  head.add(g);
  head.userData.hat = g;
}

// Lampe de casque : un casque de mineur jaune (prisme hexagonal), sa lampe sur le front
let lampMats = null;
function setLampHelmet(head) {
  lampMats ||= { yellow: new THREE.MeshLambertMaterial({ color: 0xe0b020 }), dark: new THREE.MeshLambertMaterial({ color: 0x2a2a2e }), glow: new THREE.MeshBasicMaterial({ color: 0xfff1c8 }) };
  const g = new THREE.Group(), top = 8 * PX;
  const add = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; o.userData.skin = true; g.add(o); return o; };
  add(new THREE.CylinderGeometry(0.28, 0.34, 0.2, 6).rotateY(Math.PI / 2), lampMats.yellow, 0, top + 0.08, 0);
  add(new THREE.CylinderGeometry(0.38, 0.38, 0.03, 6).rotateY(Math.PI / 2), lampMats.yellow, 0, top - 0.01, 0);
  add(new THREE.BoxGeometry(0.16, 0.12, 0.06), lampMats.dark, 0, top + 0.06, -0.32);
  add(new THREE.BoxGeometry(0.1, 0.07, 0.02), lampMats.glow, 0, top + 0.06, -0.355);
  head.add(g);
  head.userData.hat = g;
}

export function setCharacterStyle(s) { STYLE = s === 'box' ? 'box' : 'hex'; }
export const characterStyle = () => STYLE;
export async function buildCharacter(skinUrl, style = STYLE) {
  const box = style === 'box', makePart = box ? boxPart : hexPart;
  const g = new THREE.Group();
  const img = await loadImage(skinUrl);

  let base, outer;
  if (img && img.height === 64) {
    const tex = new THREE.Texture(img);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.flipY = false;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    base = new THREE.MeshLambertMaterial({ map: tex });
    outer = new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide });
  } else {
    base = new THREE.MeshLambertMaterial({ color: 0x2aa39c });
    outer = null;
  }
  const armW = img && img.height === 64 && isSlim(img) ? 3 : 4;

  // Ajoute une partie (couche de base + couche extérieure) à un pivot.
  const part = (parent, spec, overlay) => {
    parent.add(new THREE.Mesh(makePart(spec), base));
    if (outer && overlay) {
      parent.add(new THREE.Mesh(makePart({ ...spec, ...overlay, grow: overlay.grow ?? 0.5 }), outer));
    }
  };
  const pivot = (x, y) => {
    const p = new THREE.Group();
    p.position.set(x * PX, y * PX, 0);
    g.add(p);
    return p;
  };

  // Demi-largeurs réelles des hexagones (pour coller les membres au corps).
  // (pavés : les vraies demi-largeurs, comme dans Minecraft)
  const k = box ? 0.5 : WIDEN;
  const bodyHalf = k * 8, limbHalf = k * 4, armHalf = k * armW;

  const legR = pivot(limbHalf, 12), legL = pivot(-limbHalf, 12);
  part(legR, { w: 4, h: 12, d: 4, u0: 0, v0: 16 }, { u0: 0, v0: 32, grow: 0.25 });
  part(legL, { w: 4, h: 12, d: 4, u0: 16, v0: 48 }, { u0: 0, v0: 48, grow: 0.25 });

  const body = pivot(0, 12);
  part(body, { w: 8, h: 12, d: 4, u0: 16, v0: 16, y0: 0 }, { u0: 16, v0: 32, grow: 0.25 });

  const armR = pivot(bodyHalf + armHalf, 24), armL = pivot(-(bodyHalf + armHalf), 24);
  part(armR, { w: armW, h: 12, d: 4, u0: 40, v0: 16 }, { u0: 40, v0: 32, grow: 0.25 });
  part(armL, { w: armW, h: 12, d: 4, u0: 32, v0: 48 }, { u0: 48, v0: 48, grow: 0.25 });

  const head = pivot(0, 24);
  part(head, { w: 8, h: 8, d: 8, u0: 0, v0: 0, y0: 0 }, { u0: 32, v0: 0, grow: 0.5 });

  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  g.userData.parts = { legL, legR, armL, armR, head, body };
  return g;
}
