// Textures sans raccord des blocs de décoration (texture/blocs/decor) : redessinées en petits
// hexagones, avec les couleurs des images d'origine.
// Le dessus d'un bloc est un grand hexagone ; ses voisins le touchent par ses six côtés. Un motif
// qui se répète exactement au pas de cette grille (16 petits hexagones d'un bloc au suivant, dans
// les deux directions) continue donc d'un bloc à l'autre, sans couture : les briques, le damier,
// les pierres d'un dallage passent d'un bloc à son voisin. Les côtés sont de même répétés à
// l'identique d'un bloc à celui du dessus, et d'une face à la suivante.
// (les images d'origine étaient plaquées en entier sur chaque face, et déformées pour remplir
// l'hexagone : chaque bloc faisait tache à côté du suivant)

const N = 16;            // petits hexagones d'un bloc au suivant (dessus)
const SC = 8, SR = 16;   // côtés : 8 colonnes, 16 rangées par bloc
const SIZE = 128;        // pixels des textures produites

// ---------- Palette d'une image (ses couleurs, du plus sombre au plus clair) ----------
function paletteOf(img) {
  const c = document.createElement('canvas');
  const w = (c.width = Math.min(220, img.width)), h = (c.height = Math.round((img.height / img.width) * w));
  const g = c.getContext('2d', { willReadFrequently: true });
  g.imageSmoothingEnabled = false;
  g.drawImage(img, 0, 0, w, h);
  const d = g.getImageData(0, 0, w, h).data, count = new Map();
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 250) continue;
    const k = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
    count.set(k, (count.get(k) || 0) + 1);
  }
  let list = [...count].sort((a, b) => b[1] - a[1]).map(([k, n]) => ({ rgb: [k >> 16, (k >> 8) & 255, k & 255], n }));
  // (on regroupe les couleurs presque pareilles : bords adoucis entre deux hexagones)
  const out = [];
  for (const p of list) {
    const near = out.find((o) => Math.hypot(o.rgb[0] - p.rgb[0], o.rgb[1] - p.rgb[1], o.rgb[2] - p.rgb[2]) < 22);
    if (near) near.n += p.n; else if (out.length < 10) out.push({ ...p });
  }
  const total = out.reduce((s, p) => s + p.n, 0) || 1;
  list = out.filter((p) => p.n / total > 0.012);
  // (le contour noir des images n'est pas une couleur du bloc)
  list = list.filter((p) => !(p.rgb[0] + p.rgb[1] + p.rgb[2] < 45 && list.length > 3));
  for (const p of list) { p.f = p.n / total; p.l = 0.3 * p.rgb[0] + 0.59 * p.rgb[1] + 0.11 * p.rgb[2]; p.css = `rgb(${p.rgb.join(',')})`; }
  list.sort((a, b) => a.l - b.l);
  const sum = list.reduce((s, p) => s + p.f, 0) || 1;
  let acc = 0;
  for (const p of list) { acc += p.f / sum; p.q = acc; } // (part cumulée, du plus sombre au plus clair)
  const byF = [...list].sort((a, b) => b.f - a.f);
  const sat = (p) => Math.max(...p.rgb) - Math.min(...p.rgb);
  return {
    list,
    at: (v) => (list.find((p) => v <= p.q) || list[list.length - 1]).css, // (selon la part de chaque couleur)
    base: byF[0].css,
    dark: list[0].css,
    light: list[list.length - 1].css,
    mid: list[Math.floor(list.length / 2)].css,
    i: (k) => list[Math.max(0, Math.min(list.length - 1, k))].css,
    // la couleur la plus vive (motifs, taches) ; la plus verte (mousse)
    accent: [...list].sort((a, b) => sat(b) - sat(a))[0].css,
    hue: (fn) => (list.find((p) => fn(...p.rgb)) || byF[0]).css,
  };
}

// ---------- Hasard et bruit, répétés au pas de la grille ----------
const hash = (a, b, s = 0) => { let h = (a * 374761393 + b * 668265263 + s * 2246822519) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const mod = (a, n) => ((a % n) + n) % n;
// bruit doux sur un tore n x m (cases de pas k) : de 0 à 1
function torusNoise(x, y, n, m, k, seed) {
  const gx = n / k, gy = m / k, fx = x / k, fy = y / k;
  const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
  const v = (i, j) => hash(mod(i, gx), mod(j, gy), seed);
  const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
  return (v(x0, y0) * (1 - sx) + v(x0 + 1, y0) * sx) * (1 - sy) + (v(x0, y0 + 1) * (1 - sx) + v(x0 + 1, y0 + 1) * sx) * sy;
}

// ---------- Les deux grilles ----------
// Dessus : hexagones « pointe en haut » ; (q, r) coordonnées axiales, répétées tous les N.
// Position d'une cellule dans le bloc : x, y (largeur du bloc, d'un côté au côté opposé = 1)
// ; e : 0 au centre du bloc, 1 sur son bord. col : colonne (pour les briques).
function topCell(q, r) {
  const x = (q + r / 2) / N, y = (r * Math.sqrt(3)) / 2 / N;
  // ramenée dans l'hexagone du bloc (le plus proche des centres de blocs)
  let best = null;
  for (const [a, b] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1], [1, 1], [-1, -1], [2, -1], [-2, 1], [1, -2], [-1, 2]]) {
    const cx = a + b / 2, cy = (b * Math.sqrt(3)) / 2, lx = x - cx, ly = y - cy, d = lx * lx + ly * ly;
    if (!best || d < best.d) best = { d, lx, ly };
  }
  let e = 0;
  for (let k = 0; k < 6; k++) e = Math.max(e, (best.lx * Math.cos((Math.PI / 3) * k) + best.ly * Math.sin((Math.PI / 3) * k)) / 0.5);
  return { kind: 'top', q: mod(q, N), r: mod(r, N), col: q + Math.floor(r / 2), row: r, x: best.lx, y: best.ly, e, period: [N, N] };
}
// Côté : 8 colonnes x 16 rangées (rangées impaires décalées d'une demi-colonne) ; u, v de 0 à 1
function sideCell(c, r) {
  const u = mod(c + (mod(r, 2) ? 0.5 : 0) + 0.5, SC) / SC, v = (mod(r, SR) + 0.5) / SR;
  return { kind: 'side', q: mod(c, SC), r: mod(r, SR), col: c, row: r, u, v, e: Math.max(Math.abs(u - 0.5), Math.abs(v - 0.5)) * 2, period: [SC, SR] };
}

// ---------- Motifs ----------
// Briques : rangées de h cellules (la dernière : le joint), de L cellules de long, décalées d'une
// demi-brique une rangée sur deux. Renvoie { joint, key } (key : la même pour toute la brique)
// (L divise 8, h divise 16 : le motif se répète d'un bloc au suivant)
function brick(cell, L = 8, h = 4) {
  if (cell.kind === 'side') L = Math.min(L, 4);
  const br = Math.floor(cell.row / h), off = mod(br, 2) ? L / 2 : 0;
  const jointRow = mod(cell.row, h) === h - 1;
  const p = cell.col + off, jointCol = mod(p, L) === 0;
  // (clé de la brique, la même d'un bloc au suivant : voir la répétition de la grille ; dessus :
  // un bloc plus bas, la colonne avance de 8)
  const B = Math.floor(p / L);
  let key;
  if (cell.kind === 'top') { const k1 = (2 * L) / h, M = k1 * (N / L); key = mod(k1 * B - br, M); }
  else key = mod(B, SC / L) * (SR / h) + mod(br, SR / h);
  return { joint: jointRow || jointCol, jointRow, key };
}
// Pierres irrégulières (diagramme de Voronoï répété) : { edge, key } ; n : pierres par motif
function stones(cell, n, seed, edgeW) {
  const [P, Q] = cell.period;
  let d1 = Infinity, d2 = Infinity, k1 = 0;
  for (let i = 0; i < n; i++) {
    const sx = hash(i, 1, seed) * P, sy = hash(i, 2, seed) * Q;
    for (const ox of [-P, 0, P]) for (const oy of [-Q, 0, Q]) {
      const dx = cell.q - sx - ox, dy = cell.r - sy - oy;
      // (dessus : distance dans le plan, la grille axiale est penchée)
      const d = cell.kind === 'top' ? Math.hypot(dx + dy / 2, (dy * Math.sqrt(3)) / 2) : Math.hypot(dx, dy * 0.6);
      if (d < d1) { d2 = d1; d1 = d; k1 = i; } else if (d < d2) d2 = d;
    }
  }
  return { edge: d2 - d1 < (edgeW ?? 0.9), key: k1 };
}
const noise = (cell, k, seed) => torusNoise(cell.q, cell.r, cell.period[0], cell.period[1], k, seed);
const jit = (cell, seed = 9) => hash(cell.q, cell.r, seed);

// Chaque style : (cellule, palette) -> couleur
const STYLES = {
  // matière unie : taches douces dans les proportions de l'image
  noise: (c, P) => P.at(Math.min(0.999, noise(c, 4, 1) * 0.75 + jit(c) * 0.25)),
  // taches lumineuses ou vives sur la matière (braises, champignons, lichen)
  spots: (c, P) => (jit(c, 3) > 0.84 ? P.accent : P.at(Math.min(0.999, noise(c, 4, 1) * 0.6 + jit(c) * 0.3))),
  bricks: (c, P, o = {}) => {
    const b = brick(c, o.L, o.h);
    if (b.joint) return o.mortar === 'light' ? P.light : P.dark;
    const t = hash(b.key, 7, 5) * 0.75 + jit(c) * 0.25;
    if (o.moss && noise(c, 4, 4) > 0.62) return P.hue((r, g, bl) => g > r + 10 && g > bl);
    if (o.cracks && jit(c, 11) > 0.93) return P.dark;
    return P.at(o.mortar === 'light' ? 0.02 + t * 0.7 : 0.4 + t * 0.59);
  },
  // tuiles de toit : chaque rangée de tuiles plus claire en haut, sombre en bas
  roof: (c, P) => { const b = brick(c, 4, 4), k = mod(c.row, 4); return k === 3 ? P.dark : P.at(0.3 + (2 - k) * 0.15 + hash(b.key, 3) * 0.25); },
  // écailles : comme des tuiles, plus serrées, avec un reflet
  scales: (c, P) => { const b = brick(c, 2, 2); return b.jointRow ? P.dark : mod(c.col + (mod(Math.floor(c.row / 2), 2) ? 1 : 0), 2) ? P.mid : P.light; },
  // damier : losanges de 4 x 4 petits hexagones
  checker: (c, P) => (mod(Math.floor(c.q / 4) + Math.floor(c.r / 4), 2) ? P.dark : P.light),
  // pierres d'un dallage, pavés : joints sombres
  stones: (c, P, o = {}) => { const s = stones(c, o.n || 5, o.seed || 3); return s.edge ? P.dark : P.at(0.3 + hash(s.key, 4, o.seed) * 0.69); },
  // terre craquelée : fentes sombres, plaques claires
  cracks: (c, P) => { const s = stones(c, 6, 8, 0.6); return s.edge ? P.dark : P.at(0.45 + hash(s.key, 4) * 0.5); },
  // vitrail : verres colorés, plomb sombre
  glass: (c, P) => { const s = stones(c, 5, 12, 0.55); return s.edge ? P.dark : P.i(1 + Math.floor(hash(s.key, 4, 12) * (P.list.length - 1))); },
  // cristal : facettes de teintes différentes, arêtes claires
  facets: (c, P) => { const s = stones(c, 5, 21); return s.edge ? P.light : P.at(0.1 + hash(s.key, 4, 21) * 0.8); },
  // marbre : veines sombres sur fond clair
  marble: (c, P) => { const n = noise(c, 4, 13); return Math.abs(n - 0.5) < 0.06 ? P.dark : P.at(0.45 + jit(c) * 0.54); },
  // couches (grès) : rangées de teintes
  layers: (c, P) => P.at(Math.min(0.999, 0.15 + hash(mod(c.row, c.period[1]), 1, 30) * 0.6 + jit(c) * 0.24)),
  // dunes : ondulations
  ripples: (c, P) => P.at(Math.min(0.999, (mod(c.row + Math.floor(noise(c, 4, 2) * 3), 3) / 3) * 0.6 + jit(c) * 0.39)),
  // paille (foin, chaume) : brins le long des colonnes ; sur le côté du foin, deux liens
  straw: (c, P, o = {}) => {
    if (o.bands && c.kind === 'side' && (c.r === 4 || c.r === 11)) return P.dark;
    return P.at(Math.min(0.999, hash(mod(c.col, 8), 2, 40) * 0.55 + jit(c) * 0.44));
  },
  // osier : nattes de 2 x 2 cellules, alternées
  weave: (c, P) => { const a = mod(Math.floor(c.col / 2) + Math.floor(c.row / 2), 2); return (a ? mod(c.row, 2) : mod(c.col, 2)) ? P.dark : P.at(0.5 + jit(c) * 0.49); },
  // parquet : lames de bois, joint fin
  parquet: (c, P) => { const b = brick(c, 4, 2); return b.jointRow && jit(c, 2) > 0.3 ? P.dark : P.at(0.25 + hash(b.key, 9) * 0.7); },
  // rayon de miel : alvéoles (une cellule sur deux plus sombre)
  comb: (c, P) => (mod(c.q, 4) === 0 && mod(c.r, 4) === 0 ? P.dark : P.at(0.4 + jit(c) * 0.59)),
  // colombage : enduit clair ; sur les côtés, poteaux, sablières et écharpes (le dessus : l'enduit)
  timber: (c, P) => {
    if (c.kind === 'top') return P.at(0.55 + noise(c, 4, 3) * 0.2 + jit(c) * 0.24);
    const diag = Math.abs((c.u - 0.5) - (c.v - 0.5)) < 0.07;
    return c.q === 0 || c.r === 0 || c.r === 15 || diag ? P.dark : P.at(0.55 + jit(c) * 0.44);
  },
  // plaque de fer : tôles jointes en rangées, rivets réguliers
  plate: (c, P) => {
    if (mod(c.row, 8) === 0) return P.dark;
    if (mod(c.row, 8) === 2 && mod(c.col, 4) === 1) return P.light;
    return P.at(0.3 + noise(c, 4, 6) * 0.4 + jit(c) * 0.2);
  },
  // pierre polie : unie, à peine nuancée
  polished: (c, P) => P.at(0.35 + noise(c, 4, 7) * 0.4 + jit(c) * 0.2),
  // pierre runique : pierre sombre, des runes qui brillent çà et là
  runes: (c, P) => (noise(c, 4, 15) > 0.62 && jit(c, 15) > 0.45 ? P.accent : P.at(Math.min(0.6, noise(c, 4, 8) * 0.5 + jit(c) * 0.1))),
  // tapis : fond rouge, réseau de losanges dorés, fleurons clairs
  carpet: (c, P) => {
    const qa = mod(c.q, 8), rb = mod(c.r, 8);
    if (qa === 0 || rb === 0) return P.accent;
    if (qa === 4 && rb === 4) return P.light;
    return jit(c) > 0.9 ? P.dark : P.base;
  },
};

// Style de chaque texture (et ses réglages)
const STYLE_OF = {
  bone: ['noise'], carpet_red: ['carpet'], checker_floor: ['checker'], clay: ['noise'], cobble_street: ['stones', { n: 7, seed: 5 }],
  cracked_earth: ['cracks'], cracked_stone_bricks: ['bricks', { cracks: true }], crystal: ['facets'], dragon_scales: ['scales'],
  embers: ['spots'], flagstone: ['stones', { n: 4, seed: 9 }], glow_fungus: ['spots'], half_timber: ['timber'], hay_bale: ['straw', { bands: true }],
  honeycomb: ['comb'], iron_plate: ['plate'], lichen_rock: ['spots'], marble: ['marble'], moss: ['noise'], mossy_stone_bricks: ['bricks', { moss: true }],
  mud_brick: ['bricks', { L: 4, h: 4 }], mushroom_block: ['spots'], polished_stone: ['polished'], red_bricks: ['bricks', { mortar: 'light' }],
  rune_stone: ['runes'], rusted_metal: ['noise'], dune_sand: ['ripples'], sandstone: ['layers'], sandstone_bricks: ['bricks'],
  slate_roof: ['roof'], stained_glass: ['glass'], stone_bricks: ['bricks'], swamp_mud: ['noise'], terracotta_roof: ['roof'], thatch: ['straw'],
  verdigris_copper: ['spots'], wicker_weave: ['weave'], wood_parquet: ['parquet'],
};
export const isDecorTexture = (name) => !!STYLE_OF[name];

// Dessine un hexagone « pointe en haut » de centre (x, y), de rayon rx (horizontal) / ry
function hex(g, x, y, rx, ry) {
  g.beginPath();
  for (let k = 0; k < 6; k++) {
    const a = (Math.PI / 3) * k + Math.PI / 6;
    g[k ? 'lineTo' : 'moveTo'](x + Math.cos(a) * rx, y + Math.sin(a) * ry);
  }
  g.closePath();
  g.fill();
  g.stroke();
}

// Les deux textures du bloc name, d'après son image : { side, cap }
export function decorTextures(name, img) {
  const [style, opts] = STYLE_OF[name];
  const P = paletteOf(img), fn = STYLES[style];
  const color = (cell) => fn(cell, P, opts);
  const make = () => { const c = document.createElement('canvas'); c.width = c.height = SIZE; const g = c.getContext('2d'); g.lineWidth = 1.2; return [c, g]; };

  // côté : la face (1/√3 de large pour 1 de haut) occupe toute la texture
  const [side, sg] = make();
  const cw = SIZE / SC, rh = SIZE / SR, rx = cw / Math.sqrt(3), ry = rh * 2 / 3;
  for (let r = -1; r <= SR; r++) {
    for (let c = -1; c <= SC; c++) {
      const col = color(sideCell(c, r));
      sg.fillStyle = sg.strokeStyle = col;
      hex(sg, (c + 0.5 + (mod(r, 2) ? 0.5 : 0)) * cw, (r + 0.5) * rh, rx * 1.02, ry * 1.02);
    }
  }
  side.hexArt = true;
  side.sideSpan = 1;

  // dessus : l'hexagone du bloc (coin à 0,5 du centre de l'image, voir hexCap dans textures.js)
  const [cap, cg] = make();
  const flat = 0.866 * SIZE;             // largeur du bloc, d'un côté à l'autre, en pixels
  const s = flat / N, R = s / Math.sqrt(3); // petits hexagones : écart, rayon
  for (let r = -N; r <= N; r++) {
    for (let q = -N - 4; q <= N + 4; q++) {
      const x = SIZE / 2 + s * (q + r / 2), y = SIZE / 2 + R * 1.5 * r;
      if (x < -s || x > SIZE + s || y < -s || y > SIZE + s) continue;
      const col = color(topCell(q, r));
      cg.fillStyle = cg.strokeStyle = col;
      hex(cg, x, y, R * 1.02, R * 1.02);
    }
  }
  return { side, cap };
}
