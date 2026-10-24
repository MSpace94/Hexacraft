// Lumière du terrain, propagée case par case (comme dans la réalité : elle ne traverse pas les
// blocs pleins). Calculée dans les threads de travail, au maillage d'un chunk, sur le chunk et
// une bordure de LIGHT_M cases autour (la lumière d'à côté compte).
//  - Ciel : chaque colonne est éclairée par le haut jusqu'au premier bloc qui arrête la lumière
//    (niveau SKY = 15) ; de là, elle se répand dans les grottes et sous les surplombs en perdant
//    un niveau par case (deux à travers les feuilles et l'eau). Au fond d'une grotte : le noir.
//  - Torches, fours allumés, lave : même chose depuis la source, avec sa couleur.
// Chaque sommet reçoit la lumière des cases devant sa face (moyenne de quelques points : les
// ombres sont douces). Le shader du terrain (world.js) s'en sert : le soleil et la lumière du
// ciel sont multipliés par le niveau du ciel, la lumière des torches est ajoutée.
import { SIZE } from './hex.js?v=1.1.5-alpha-mvm2b95g';
const S3 = Math.sqrt(3);
import { BLOCKS, OPAQUE, isWater, MAX_ID } from './blocks.js?v=1.1.5-alpha-mvm2b95g';
import { DEPTH as DEEP } from './gen.js?v=1.1.5-alpha-mvm2b95g';

export const LIGHT_M = 12;          // bordure prise en compte autour du chunk (cases)
const SKY = 15;
// niveau d'une source selon son type (blocks.js : light) et sa couleur
const SOURCE_LEVEL = { 1: 13, 2: 8, 3: 10, 4: 13, 5: 12 };
const SOURCE_RGB = { 1: [1.0, 0.62, 0.28], 2: [1.0, 0.15, 0.08], 3: [0.75, 0.42, 0.16], 4: [1.0, 0.42, 0.1], 5: [1.0, 0.82, 0.5] };
const BLOCK_POWER = 1.8;
// luminosité d'un niveau (comme l'œil : chaque niveau en moins garde 80 % de la lumière)
const BRIGHT = Array.from({ length: 16 }, (_, l) => (l ? 0.8 ** (15 - l) : 0));

// Ce que coûte la traversée d'une case (255 : elle arrête la lumière)
const COST = new Uint8Array(MAX_ID);
for (let id = 0; id < MAX_ID; id++) {
  const b = BLOCKS[id];
  if (id && OPAQUE[id]) COST[id] = 255;
  else if (b && (b.leaves || isWater(id))) COST[id] = 2;
  else COST[id] = 1;
}
for (const [id, b] of Object.entries(BLOCKS)) if (/leaves/.test(b.top || '') && !OPAQUE[id]) COST[id] = 2;
// type de source de lumière de chaque bloc (0 : aucune), en table (plus rapide que BLOCKS[id]?.light)
const LSRC = new Uint8Array(MAX_ID);
for (const [id, b] of Object.entries(BLOCKS)) if (b.light) LSRC[id] = b.light;

// src : BlockSource (chunk(cq, cr) donne les données d'un chunk) ; yLo..yHi : hauteurs utiles
export function computeLight(src, cq, cr, CS, H, yLo, yHi) {
  const M = LIGHT_M, RW = CS + 2 * M, NY = yHi - yLo + 1, L = RW * RW;
  const q0 = cq * CS - M, r0 = cr * CS - M;
  const N = L * NY;
  const cost = new Uint8Array(N), sky = new Uint8Array(N), blk = new Uint8Array(N), col = new Uint8Array(N);
  const buckets = Array.from({ length: 16 }, () => []);
  const bbuckets = Array.from({ length: 16 }, () => []);
  // données des 9 chunks autour
  const chunks = new Map();
  const dataOf = (q, r) => {
    const c = Math.floor(q / CS), d = Math.floor(r / CS), k = c * 4096 + d;
    let a = chunks.get(k);
    if (!a) { a = src.chunk(c, d); chunks.set(k, a); }
    return a;
  };
  for (let rr = 0; rr < RW; rr++) {
    for (let rq = 0; rq < RW; rq++) {
      const q = q0 + rq, r = r0 + rr, data = dataOf(q, r);
      const lq = q - Math.floor(q / CS) * CS, lr = r - Math.floor(r / CS) * CS;
      // la colonne : coût de chaque case, et le ciel par le haut. Au-dessus du plus haut bloc du
      // chunk, tout est de l'air sous le ciel : on ne lit rien (src.topOf, voir BlockSource)
      const top = src.topOf ? Math.min(H - 1, src.topOf(data)) : H - 1;
      for (let y = Math.min(yHi, H - 1); y > top && y >= yLo; y--) {
        const i = ((y - yLo) * RW + rr) * RW + rq;
        cost[i] = 1; sky[i] = SKY; buckets[SKY].push(i);
      }
      let open = true;
      for (let y = top; y >= yLo; y--) {
        const id = data[((y + DEEP) * CS + lr) * CS + lq];
        const c = COST[id];
        if (y <= yHi) {
          const i = ((y - yLo) * RW + rr) * RW + rq;
          cost[i] = c;
          if (open && c === 1) { sky[i] = SKY; buckets[SKY].push(i); }
          const s = LSRC[id];
          if (s) {
            const lv = SOURCE_LEVEL[s] || 10;
            if (lv > blk[i]) { blk[i] = lv; col[i] = s; bbuckets[lv].push(i); }
          }
        }
        if (c !== 1) {
          open = false;
          // (le ciel est caché : au-dessus de la zone, plus rien à lire)
          if (y > yHi + 1) y = yHi + 1;
        }
      }
    }
  }
  spread(sky, cost, buckets, null, RW, NY);
  spread(blk, cost, bbuckets, col, RW, NY);

  // Lumière au point (x, y, z) du monde : [r, g, b, ciel] (null hors de la zone ou dans un bloc)
  // (case hexagonale du point : comme worldToHex, sans fabriquer d'objet ; 5 fois par sommet)
  const at = (x, y, z, out) => {
    const fq = ((S3 / 3) * x - z / 3) / SIZE, fr = ((2 / 3) * z) / SIZE, fs = -fq - fr;
    let hq = Math.round(fq), hr = Math.round(fr);
    const hs = Math.round(fs), dq = Math.abs(hq - fq), dr = Math.abs(hr - fr), ds = Math.abs(hs - fs);
    if (dq > dr && dq > ds) hq = -hr - hs;
    else if (dr > ds) hr = -hq - hs;
    const rq = hq - q0, rr = hr - r0, yy = Math.floor(y);
    if (rq < 0 || rr < 0 || rq >= RW || rr >= RW) return false;
    if (yy > yHi) { out[3] += 1; return true; }        // (au-dessus : le ciel)
    if (yy < yLo) return false;
    const i = ((yy - yLo) * RW + rr) * RW + rq;
    if (cost[i] === 255) return false;
    const b = BRIGHT[blk[i]] * BLOCK_POWER, rgb = SOURCE_RGB[col[i]] || SOURCE_RGB[1];
    out[0] += rgb[0] * b; out[1] += rgb[1] * b; out[2] += rgb[2] * b; out[3] += BRIGHT[sky[i]];
    return true;
  };
  const acc = [0, 0, 0, 0];
  // Lumière d'un sommet (position p, normale n) : moyenne de 5 points devant la face
  const vertex = (px, py, pz, nx, ny, nz, out, o) => {
    acc[0] = acc[1] = acc[2] = acc[3] = 0;
    const sx = px + nx * 0.5, sy = py + ny * 0.5, sz = pz + nz * 0.5;
    // deux directions dans le plan de la face
    let ax, ay, az, bx, by, bz;
    if (Math.abs(ny) > 0.7) { ax = 1; ay = 0; az = 0; bx = 0; by = 0; bz = 1; } else { ax = -nz; ay = 0; az = nx; bx = 0; by = 1; bz = 0; }
    let n = 0;
    const D = 0.3;
    if (at(sx, sy, sz, acc)) n++;
    if (at(sx + ax * D, sy + ay * D, sz + az * D, acc)) n++;
    if (at(sx - ax * D, sy - ay * D, sz - az * D, acc)) n++;
    if (at(sx + bx * D, sy + by * D, sz + bz * D, acc)) n++;
    if (at(sx - bx * D, sy - by * D, sz - bz * D, acc)) n++;
    if (!n) { out[o] = out[o + 1] = out[o + 2] = 0; out[o + 3] = 0; return; }
    out[o] = Math.min(2, acc[0] / n); out[o + 1] = Math.min(2, acc[1] / n); out[o + 2] = Math.min(2, acc[2] / n); out[o + 3] = acc[3] / n;
  };
  return { vertex };
}

// Propagation (du plus fort au plus faible) : chaque case voisine reçoit le niveau moins le
// coût de sa traversée, si c'est mieux que ce qu'elle a
function spread(val, cost, buckets, col, RW, NY) {
  const L = RW * RW;
  let lv = 0, c = 0;
  const push = (n) => {
    const ct = cost[n];
    if (ct === 255) return;
    const nl = lv - ct;
    if (nl <= val[n]) return;
    val[n] = nl;
    if (col) col[n] = c;
    if (nl > 1) buckets[nl].push(n);
  };
  for (lv = 15; lv > 1; lv--) {
    const list = buckets[lv];
    for (let k = 0; k < list.length; k++) {
      const i = list[k];
      if (val[i] !== lv) continue;
      const rq = i % RW, rr = ((i / RW) | 0) % RW, y = (i / L) | 0;
      c = col ? col[i] : 0;
      // voisins : les 6 côtés (axial q, r) puis dessus / dessous
      if (rq + 1 < RW) push(i + 1);
      if (rq > 0) push(i - 1);
      if (rr + 1 < RW) push(i + RW);
      if (rr > 0) push(i - RW);
      if (rq + 1 < RW && rr > 0) push(i + 1 - RW);
      if (rq > 0 && rr + 1 < RW) push(i - 1 + RW);
      if (y + 1 < NY) push(i + L);
      if (y > 0) push(i - L);
    }
  }
}

// Lumière de chaque sommet d'un maillage (MeshBuilder : pos, nor) : tableau de 4 par sommet
export function bakeLight(mb, light) {
  const n = mb.pos.length / 3;
  if (!n) return;
  const out = new Float32Array(n * 4);
  for (let v = 0; v < n; v++) {
    light.vertex(mb.pos[v * 3], mb.pos[v * 3 + 1], mb.pos[v * 3 + 2], mb.nor[v * 3], mb.nor[v * 3 + 1], mb.nor[v * 3 + 2], out, v * 4);
  }
  mb.light = out;
}


// Lumière d'une source (type de blocks.js : light) à la distance d (blocs), comme la lumière
// propagée (un niveau de moins par bloc) : [r, g, b] ajoutés à out, sans les murs (objets
// collés, voir structs.relight)
export function sourceLight(kind, d, k, out) {
  const lv = Math.floor((SOURCE_LEVEL[kind] || 10) - d);
  if (lv <= 0) return;
  const b = BRIGHT[Math.min(15, lv)] * BLOCK_POWER * k, rgb = SOURCE_RGB[kind] || SOURCE_RGB[1];
  out[0] += rgb[0] * b; out[1] += rgb[1] * b; out[2] += rgb[2] * b;
}
export const SOURCE_REACH = 14; // une source n'éclaire pas plus loin
