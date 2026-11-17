// Modèles 3D des objets dessinés en "pixels hexagonaux" (outils, cailloux, charbon...).
// On retrouve la grille d'hexagones de l'image, puis chaque case devient un petit prisme
// hexagonal de sa couleur : l'objet a une vraie épaisseur et des côtés, comme les objets
// de Minecraft (où chaque pixel devient un petit cube).
import * as THREE from 'three';

const S3 = Math.sqrt(3);

// ---------- Grille de l'image ----------
// Hexagones pointe en haut, de largeur w (d'un côté plat à l'autre), rangées espacées de
// w·√3/2 et décalées d'une demi-case une rangée sur deux. Renvoie { w, ox, oy, cells }
// ou null si l'image n'est pas dessinée sur une grille d'hexagones.
// Couleurs de l'image (-1 = transparent), éventuellement réduite d'un facteur `down`
function pixels(img, down) {
  const W = Math.round(img.width / down), H = Math.round(img.height / down);
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = false; // pas de couleurs mélangées aux bords des cases
  ctx.drawImage(img, 0, 0, W, H);
  const d = ctx.getImageData(0, 0, W, H).data;
  const col = new Int32Array(W * H);
  // cadre de la partie dessinée (la recherche se limite à lui)
  let bx0 = W, bx1 = -1, by0 = H, by1 = -1;
  for (let i = 0; i < W * H; i++) {
    if (d[i * 4 + 3] < 128) { col[i] = -1; continue; }
    col[i] = (d[i * 4] << 16) | (d[i * 4 + 1] << 8) | d[i * 4 + 2];
    const x = i % W, y = (i / W) | 0;
    if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y;
  }
  return { W, H, col, box: [bx0, by0, bx1, by1] };
}

export function findHexGrid(img) {
  // grandes images : la position de la grille est cherchée sur l'image réduite de moitié,
  // puis ajustée sur l'image entière
  // (très grandes images : d'abord au quart, puis ajustée à la moitié, ce qui suffit : les
  // cases font encore plus de 20 pixels)
  let down = img.width >= 600 ? 4 : img.width >= 300 ? 2 : 1;
  const last = img.width >= 600 ? 2 : 1;
  let grid = searchGrid(pixels(img, down), null);
  while (grid && down > last) {
    down /= 2;
    grid = searchGrid(pixels(img, down), { w: grid.w * 2, ox: grid.ox * 2, oy: grid.oy * 2 });
  }
  if (!grid || down === 1) return grid;
  // ramenée à la taille de l'image
  return {
    w: grid.w * down, ox: grid.ox * down, oy: grid.oy * down,
    cells: grid.cells.map((c) => ({ ...c, x: c.x * down, y: c.y * down })),
  };
}

// guess : grille approchée à ajuster (sinon recherche complète)
function searchGrid({ W, H, col, box }, guess) {
  const wStep = 0.25;
  if (box[2] < 0) return null; // image vide
  const [bx0, by0, bx1, by1] = box;
  const px = (x, y) => {
    x |= 0; y |= 0;
    return x < 0 || y < 0 || x >= W || y >= H ? -1 : col[y * W + x];
  };

  let top = null;
  const consider = (w, ox, oy) => {
    // une mauvaise grille coupe vite beaucoup de cases : on l'abandonne dès qu'elle en a
    // trop de mélangées (la bonne n'en a presque aucune)
    const s = score(w, ox, oy, false, top ? 3 + top.good * 0.08 : Infinity);
    if (!s) return;
    const v = s.good - 3 * s.bad;
    if (!top || v > top.v) top = { v, w, ox, oy, ...s };
  };
  const refine = (c0, dw, dxy) => {
    for (let w = c0.w - dw; w <= c0.w + dw + 1e-6; w += wStep) {
      for (let ox = c0.ox - dxy; ox <= c0.ox + dxy; ox++) for (let oy = c0.oy - dxy; oy <= c0.oy + dxy; oy++) consider(w, ox, oy);
    }
  };
  const finish = () => {
    if (!top || top.good < 4 || top.bad > top.good * 0.08) return null;
    const { cells } = score(top.w, top.ox, top.oy, true);
    return { w: top.w, ox: top.ox, oy: top.oy, cells };
  };
  if (guess) {
    refine(guess, 1, 3);
    return finish();
  }

  // 1) largeur des cases : longueur la plus fréquente des segments d'une même couleur
  const runs = new Map();
  for (let y = 0; y < H; y += 2) {
    let run = 0, prev = -2;
    for (let x = 0; x <= W; x++) {
      const v = x < W ? col[y * W + x] : -2;
      if (v === prev) { run++; continue; }
      if (prev >= 0 && run >= 6 && run < W / 3) runs.set(run, (runs.get(run) || 0) + 1);
      prev = v; run = 1;
    }
  }
  let mode = 0, best = 0;
  for (const [len, n] of runs) {
    // un segment fait la largeur d'une case moins les bords adoucis : on regroupe ±1
    const s = n + (runs.get(len - 1) || 0) + (runs.get(len + 1) || 0);
    if (s > best) { best = s; mode = len; }
  }
  if (!mode) return null;

  // 2) position de la grille : celle où le plus de cases sont d'une seule couleur
  //    (recherche grossière, puis fine autour du meilleur)
  const step = Math.max(1, Math.round(mode / 16));
  for (let w = mode; w <= mode * 1.12 + 1; w += 0.5) {
    const dy = (w * S3) / 2;
    for (let ox = 0; ox < w; ox += step) for (let oy = 0; oy < 2 * dy; oy += step) consider(w, ox, oy);
  }
  refine(top, 0.5, step);
  return finish();

  // couleur unie dans chaque case ? (centre + 6 points autour)
  function score(w, ox, oy, keep, maxBad = Infinity) {
    const dy = (w * S3) / 2, r = w * 0.3, rx = r / 2, ry = r * 0.85;
    let good = 0, bad = 0;
    const cells = keep ? [] : null;
    // seulement les cases qui peuvent toucher la partie dessinée
    const r0 = Math.floor((by0 - oy) / dy) - 1, r1 = Math.ceil((by1 - oy) / dy) + 1;
    const c0 = Math.floor((bx0 - ox) / w) - 1, c1 = Math.ceil((bx1 - ox) / w) + 1;
    for (let row = r0; row <= r1; row++) {
      const y = oy + row * dy, sh = row & 1 ? w / 2 : 0;
      for (let cI = c0; cI <= c1; cI++) {
        const x = ox + sh + cI * w;
        const v = px(x, y);
        const a = px(x + r, y), b = px(x - r, y), e = px(x + rx, y + ry), f = px(x - rx, y - ry), g = px(x + rx, y - ry), h = px(x - rx, y + ry);
        if (v < 0 && a < 0 && b < 0 && e < 0 && f < 0 && g < 0 && h < 0) continue;
        if (v >= 0 && a === v && b === v && e === v && f === v && g === v && h === v) {
          good++;
          if (cells) cells.push({ col: cI, row, x, y, color: v });
        } else if (++bad > maxBad) return null;
      }
    }
    return { good, bad, cells };
  }
}

// ---------- Modèle ----------
// Prismes hexagonaux (faces avant et arrière, côtés seulement vers les cases vides),
// centrés et mis à l'échelle : la plus grande dimension fait 1. Les couleurs de l'image
// sont dans les sommets (pas de texture).
export function buildHexModel(grid, thickness = 0.9) {
  const { w, cells } = grid;
  const R = w / S3; // rayon (centre -> pointe)
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const c of cells) {
    x0 = Math.min(x0, c.x - w / 2); x1 = Math.max(x1, c.x + w / 2);
    y0 = Math.min(y0, c.y - R); y1 = Math.max(y1, c.y + R);
  }
  const k = 1 / Math.max(x1 - x0, y1 - y0);
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const T = (w * thickness * k) / 2; // demi-épaisseur

  const has = new Set(cells.map((c) => c.col + ',' + c.row));
  // voisins d'une case (rangées décalées : la rangée impaire est décalée vers la droite)
  const neighbors = (c) => {
    const o = c.row & 1;
    return [
      [c.col + 1, c.row], [c.col + o, c.row - 1], [c.col - 1 + o, c.row - 1],
      [c.col - 1, c.row], [c.col - 1 + o, c.row + 1], [c.col + o, c.row + 1],
    ];
  };
  // coins (pointe en haut), dans le même ordre que les voisins : le côté i va du coin i au
  // coin i+1 et fait face au voisin i
  const corner = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 180) * (-30 + 60 * i);
    return [Math.cos(a) * R, -Math.sin(a) * R]; // y de l'image vers le bas
  });

  const pos = [], nor = [], colr = [], idx = [];
  const color = new THREE.Color();
  const quad = (p, n, rgb) => {
    const b = pos.length / 3;
    for (const v of p) { pos.push(...v); nor.push(...n); colr.push(rgb.r, rgb.g, rgb.b); }
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  };
  for (const c of cells) {
    color.setHex(c.color, THREE.SRGBColorSpace);
    const X = (c.x - cx) * k, Y = -(c.y - cy) * k;
    const P = corner.map(([dx, dy]) => [X + dx * k, Y - dy * k]);
    // faces avant (+Z) et arrière (-Z) : éventail de 4 triangles
    for (const [z, nz] of [[T, 1], [-T, -1]]) {
      const b = pos.length / 3;
      for (const [x, y] of P) { pos.push(x, y, z); nor.push(0, 0, nz); colr.push(color.r, color.g, color.b); }
      for (let i = 1; i < 5; i++) {
        if (nz > 0) idx.push(b, b + i, b + i + 1); else idx.push(b, b + i + 1, b + i);
      }
    }
    // côtés vers les cases vides, un peu plus sombres (comme les tranches d'un objet)
    const side = color.clone().multiplyScalar(0.8);
    neighbors(c).forEach(([q, r], i) => {
      if (has.has(q + ',' + r)) return;
      const [ax, ay] = P[i], [bx, by] = P[(i + 1) % 6];
      const mx = (ax + bx) / 2 - X, my = (ay + by) / 2 - Y, l = Math.hypot(mx, my) || 1;
      quad([[ax, ay, -T], [bx, by, -T], [bx, by, T], [ax, ay, T]], [mx / l, my / l, 0], side);
    });
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3));
  geo.setIndex(idx);
  return geo;
}
