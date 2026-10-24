// Géométrie des hexagones (pointe vers le haut, dans le plan X/Z).
// Coordonnées axiales (q, r) + couche verticale y.

const S3 = Math.sqrt(3);

// Distance centre -> coin. Choisie pour que la largeur plat-à-plat vaille 1.
export const SIZE = 1 / S3;
// Distance centre -> milieu d'un bord (apothème) = 0.5
export const APOTHEM = (S3 / 2) * SIZE;

// Coins du prisme (x, z) relatifs au centre. Coin i à l'angle 60*i - 30°.
export const CORNERS = Array.from({ length: 6 }, (_, i) => {
  const a = (Math.PI / 180) * (60 * i - 30);
  return [SIZE * Math.cos(a), SIZE * Math.sin(a)];
});

// Normale du bord i (entre le coin i et le coin i+1), angle 60*i°.
export const EDGE_NORMALS = Array.from({ length: 6 }, (_, i) => {
  const a = (Math.PI / 180) * (60 * i);
  return [Math.cos(a), Math.sin(a)];
});

// Voisin qui partage le bord i.
export const NEIGHBORS = [
  [1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1],
];

export function hexToWorld(q, r) {
  return { x: SIZE * S3 * (q + r / 2), z: SIZE * 1.5 * r };
}

export function worldToHex(x, z) {
  const q = ((S3 / 3) * x - z / 3) / SIZE;
  const r = ((2 / 3) * z) / SIZE;
  return hexRound(q, r);
}

function hexRound(q, r) {
  const s = -q - r;
  let rq = Math.round(q), rr = Math.round(r);
  const rs = Math.round(s);
  const dq = Math.abs(rq - q), dr = Math.abs(rr - r), ds = Math.abs(rs - s);
  if (dq > dr && dq > ds) rq = -rr - rs;
  else if (dr > ds) rr = -rq - rs;
  return { q: rq, r: rr };
}

// Point le plus proche sur le contour de l'hexagone (centré en 0) du point (dx, dz).
function closestOnBoundary(dx, dz) {
  let best = Infinity, bx = 0, bz = 0;
  for (let i = 0; i < 6; i++) {
    const [ax, az] = CORNERS[i];
    const [cx, cz] = CORNERS[(i + 1) % 6];
    const ex = cx - ax, ez = cz - az;
    let t = ((dx - ax) * ex + (dz - az) * ez) / (ex * ex + ez * ez);
    t = Math.max(0, Math.min(1, t));
    const px = ax + ex * t, pz = az + ez * t;
    const d = (dx - px) ** 2 + (dz - pz) ** 2;
    if (d < best) { best = d; bx = px; bz = pz; }
  }
  return { x: bx, z: bz, d2: best };
}

// Plus grande "distance signée" aux bords : <= 0 signifie à l'intérieur.
function insideDepth(dx, dz) {
  let maxS = -Infinity, maxI = 0;
  for (let i = 0; i < 6; i++) {
    const s = dx * EDGE_NORMALS[i][0] + dz * EDGE_NORMALS[i][1] - APOTHEM;
    if (s > maxS) { maxS = s; maxI = i; }
  }
  return { s: maxS, i: maxI };
}

// Un cercle de rayon `radius` centré en (dx, dz) (relatif au centre de l'hexagone) le touche-t-il ?
export function circleHexOverlap(dx, dz, radius) {
  if (insideDepth(dx, dz).s <= 0) return true;
  return closestOnBoundary(dx, dz).d2 < radius * radius;
}

// Décalage à appliquer au cercle pour le sortir de l'hexagone, ou null.
export function circleHexPush(dx, dz, radius) {
  const { s, i } = insideDepth(dx, dz);
  if (s <= 0) {
    const push = radius - s;
    return [EDGE_NORMALS[i][0] * push, EDGE_NORMALS[i][1] * push];
  }
  const c = closestOnBoundary(dx, dz);
  if (c.d2 >= radius * radius) return null;
  const d = Math.sqrt(c.d2) || 1e-6;
  const k = (radius - d) / d;
  return [(dx - c.x) * k, (dz - c.z) * k];
}

// Moitié de l'hexagone du côté du bord k (dalle verticale) : coupée d'un coin au coin opposé,
// coins k - 1, k, k + 1, k + 2. Polygones convexes : liste de coins [x, z] dans l'ordre.
export const HALF_HEX = Array.from({ length: 6 }, (_, k) => [k - 1, k, k + 1, k + 2].map((i) => CORNERS[(i + 6) % 6]));

// Décalage à appliquer à un cercle (centre dx, dz, rayon radius) pour le sortir d'un polygone
// convexe, ou null s'il ne le touche pas
export function circlePolyPush(dx, dz, radius, poly) {
  const n = poly.length;
  let cx = 0, cz = 0;
  for (const [x, z] of poly) { cx += x / n; cz += z / n; }
  let maxS = -Infinity, nx = 0, nz = 0, best = Infinity, bx = 0, bz = 0;
  for (let i = 0; i < n; i++) {
    const [ax, az] = poly[i], [ex, ez] = poly[(i + 1) % n];
    // normale du bord, tournée vers l'extérieur
    let ux = ez - az, uz = -(ex - ax);
    const l = Math.hypot(ux, uz) || 1;
    ux /= l; uz /= l;
    if ((ax - cx) * ux + (az - cz) * uz < 0) { ux = -ux; uz = -uz; }
    const s = (dx - ax) * ux + (dz - az) * uz;
    if (s > maxS) { maxS = s; nx = ux; nz = uz; }
    const vx = ex - ax, vz = ez - az;
    const t = Math.max(0, Math.min(1, ((dx - ax) * vx + (dz - az) * vz) / (vx * vx + vz * vz)));
    const px = ax + vx * t, pz = az + vz * t, d = (dx - px) ** 2 + (dz - pz) ** 2;
    if (d < best) { best = d; bx = px; bz = pz; }
  }
  if (maxS <= 0) return [nx * (radius - maxS), nz * (radius - maxS)]; // (dedans : par le bord le plus proche)
  if (best >= radius * radius) return null;
  const d = Math.sqrt(best) || 1e-6, k = (radius - d) / d;
  return [(dx - bx) * k, (dz - bz) * k];
}
