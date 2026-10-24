// Rails : forme d'un rail d'après ses voisins. Sans three.js : utilisé à la fois par les
// threads de travail (dessin) et par le thread principal (physique des Hexacarts).
//
// Un rail relie deux bords de son hexagone (directions 0..5, bord i = voisin i) :
//  - en ligne droite (bords opposés i et i+3),
//  - en virage à 120° (bords i et i+2) ou en virage serré à 60° (bords i et i+1),
//  - en montée : si un rail voisin est un bloc plus haut, la case devient une rampe droite
//    qui monte de 1 bloc vers ce voisin.
// La forme n'est pas stockée : elle se déduit toujours des voisins (comme ça, pas de
// désaccord possible entre le dessin et la physique).
import { NEIGHBORS } from './hex.js?v=1.1.5-alpha-mvm2b95g';
import { isRail } from './blocks.js?v=1.1.5-alpha-mvm2b95g';

export const RAIL_H = 0.0625; // épaisseur du rail au-dessus du bloc porteur

// get(q, r, y) -> id du bloc. Retourne { a, b, up } : a et b = bords reliés, up = bord
// vers lequel la rampe monte (-1 si le rail est à plat).
export function railShape(get, q, r, y) {
  const dirs = [];
  let up = -1;
  for (let i = 0; i < 6; i++) {
    const [dq, dr] = NEIGHBORS[i];
    if (isRail(get(q + dq, r + dr, y))) dirs.push(i);
    else if (isRail(get(q + dq, r + dr, y + 1))) { if (up < 0) up = i; }
    else if (isRail(get(q + dq, r + dr, y - 1))) dirs.push(i); // rampe voisine qui monte vers nous
  }
  if (up >= 0) return { a: (up + 3) % 6, b: up, up };
  if (dirs.length === 0) return { a: 3, b: 0, up: -1 };
  if (dirs.length === 1) return { a: (dirs[0] + 3) % 6, b: dirs[0], up: -1 };
  for (const d of dirs) if (dirs.includes((d + 3) % 6)) return { a: d, b: (d + 3) % 6, up: -1 };
  for (const d of dirs) if (dirs.includes((d + 2) % 6)) return { a: d, b: (d + 2) % 6, up: -1 };
  return { a: dirs[0], b: dirs[1], up: -1 };
}

// Hauteur (au-dessus du bas de la case) du rail sur le bord d, et au centre.
export function railEdgeHeight(shape, d) {
  if (shape.up < 0) return 0;
  if (d === shape.up) return 1;
  if (d === (shape.up + 3) % 6) return 0;
  return 0.5;
}
export const railCenterHeight = (shape) => (shape.up >= 0 ? 0.5 : 0);

const EDGE_N = Array.from({ length: 6 }, (_, i) => [Math.cos((Math.PI / 3) * i), Math.sin((Math.PI / 3) * i)]);

// Tracé de la voie dans sa case, du bord a au bord b : liste de points [x, y, z].
// Ligne droite (éventuellement en pente) ou arc de cercle tangent aux deux bords
// (rayon 0.87 pour le virage à 120°, 0.29 pour le virage serré à 60°).
export function railCurve(shape, cx, cz, y, a, b, n = 10) {
  const ha = y + RAIL_H + railEdgeHeight(shape, a), hb = y + RAIL_H + railEdgeHeight(shape, b);
  const [ax, az] = EDGE_N[a], [bx, bz] = EDGE_N[b];
  const pax = cx + ax * 0.5, paz = cz + az * 0.5, pbx = cx + bx * 0.5, pbz = cz + bz * 0.5;
  if ((a + 3) % 6 === b) return [[pax, ha, paz], [pbx, hb, pbz]];
  // centre du cercle sur la bissectrice des deux bords
  let ux = ax + bx, uz = az + bz;
  const ul = Math.hypot(ux, uz);
  ux /= ul; uz /= ul;
  const t = 0.5 / (ux * ax + uz * az);
  const ox = cx + ux * t, oz = cz + uz * t;
  const R = Math.hypot(pax - ox, paz - oz);
  const a0 = Math.atan2(paz - oz, pax - ox);
  let da = Math.atan2(pbz - oz, pbx - ox) - a0;
  while (da > Math.PI) da -= 2 * Math.PI;
  while (da < -Math.PI) da += 2 * Math.PI;
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const k = i / n, ang = a0 + da * k;
    pts.push([ox + Math.cos(ang) * R, ha + (hb - ha) * k, oz + Math.sin(ang) * R]);
  }
  return pts;
}
