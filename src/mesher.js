// Construction des maillages (chunks complets, chunks simplifiés, eau) et copie du monde
// pour les threads de travail. Aucun import de three.js : ce module tourne aussi bien
// dans un Web Worker que sur le thread principal. Les maillages sont rendus sous forme
// de tableaux typés, transférables d'un thread à l'autre sans copie.
import { CORNERS, NEIGHBORS, SIZE, hexToWorld } from './hex.js?v=1.1.5-alpha-mvm2b95g';
import { BLOCKS, AIR, OPAQUE, SLAB, WATER_TOP, wireKind, isWireOn, blockBox, isRail, isTorch, isWater, isTnt, isWire, isPhysics, isSource, isLever, isLamp, waterHeight, isIceWater, isLava, lavaHeight, wireStep, isRepeater, isRepeaterOn, repeaterKind, repeaterIn, repeaterOut } from './blocks.js?v=1.1.5-alpha-mvm2b95g';
import { Generator, GEN_CONTENT, WORLD_HEIGHT, DEPTH, FLAT_LOW, FLAT_LOW_Y } from './gen.js?v=1.1.5-alpha-mvm2b95g';
import { railShape, railCurve } from './rails.js?v=1.1.5-alpha-mvm2b95g';
import { computeLight, bakeLight, LIGHT_M } from './light.js?v=1.1.5-alpha-mvm2b95g';

// Texture du côté i d'un bloc : la même partout, ou une par côté (ex. table de craft)
const sideTex = (b, i) => (b.sides ? b.sides[i] : b.side);

export const CS = 16;          // taille d'un chunk en q et en r
export const H = WORLD_HEIGHT; // hauteur du monde (156 blocs, voir gen.js)
// Profondeurs (depuis HexaCraft alpha 1.2) : le monde descend jusqu'en -DEEP. Un chunk garde
// toutes ses cases dans un seul tableau (de -DEEP à H - 1), mais il est dessiné en deux
// sous-chunks verticaux : les profondeurs (-DEEP à -1) et la surface (0 à H - 1). Les
// profondeurs ne sont dessinées que près du joueur (voir world.js) : elles ne coûtent presque
// rien tant qu'on reste à la surface.
export const DEEP = DEPTH;
export const Y_MIN = -DEEP;
export const NY = H + DEEP;            // couches d'un chunk
export const OFF = DEEP * CS * CS;     // index de la case (0, 0, 0) dans le tableau d'un chunk
// sous-chunks : 0 = profondeurs, 1 = surface
export const SECTIONS = [[Y_MIN, -1], [0, H - 1]];
export const LOD_DROP = 0.04;  // la surface simplifiée passe juste sous la surface détaillée

export const idx = (lq, lr, y) => ((y + DEEP) * CS + lr) * CS + lq;
export const chunkKey = (cq, cr) => cq + ',' + cr;
export const unitKey = (s, cq, cr) => s + ':' + cq + ',' + cr;
// Taille des grands hexas d'un bloc simplifié de s x s chunks : 2 jusqu'à 4 x 4 chunks, puis la
// moitié de s (un bloc fait au plus 32 x 32 grands hexas : peu de blocs, donc peu d'appels de
// dessin, même avec une très grande distance d'affichage)
export const lodStep = (s) => (s <= 4 ? 2 : s / 2);

const EDGE_N = Array.from({ length: 6 }, (_, i) => [Math.cos((Math.PI / 3) * i), Math.sin((Math.PI / 3) * i)]);
const AO = [1, 0.78, 0.6, 0.5];  // luminosité d'un coin selon le nombre de blocs qui l'entourent

// Sens des triangles calculé une fois pour toutes (face tournée vers l'extérieur).
const cross = (a, b, c) => {
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
  const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  return [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
};
const TOP_FLIP = cross([CORNERS[0][0], 1, CORNERS[0][1]], [CORNERS[1][0], 1, CORNERS[1][1]], [CORNERS[2][0], 1, CORNERS[2][1]])[1] < 0;
const SIDE_FLIP = EDGE_N.map(([nx, nz], i) => {
  const [ax, az] = CORNERS[i], [bx, bz] = CORNERS[(i + 1) % 6];
  const c = cross([ax, 0, az], [bx, 0, bz], [bx, 1, bz]);
  return c[0] * nx + c[2] * nz < 0;
});

// Sphère englobante [x, y, z, rayon] des positions (comme computeBoundingSphere de three.js :
// centre de la boîte, plus grande distance) : calculée ici, dans le thread de travail, plutôt que
// sur le thread principal à l'arrivée du maillage
function sphereOf(pos) {
  let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
  for (let i = 0; i < pos.length; i += 3) {
    const x = pos[i], y = pos[i + 1], z = pos[i + 2];
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (y < y0) y0 = y; if (y > y1) y1 = y;
    if (z < z0) z0 = z; if (z > z1) z1 = z;
  }
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, cz = (z0 + z1) / 2;
  let m = 0;
  for (let i = 0; i < pos.length; i += 3) {
    const dx = pos[i] - cx, dy = pos[i + 1] - cy, dz = pos[i + 2] - cz, d = dx * dx + dy * dy + dz * dz;
    if (d > m) m = d;
  }
  return new Float32Array([cx, cy, cz, Math.sqrt(m)]);
}

// ---------- Assemblage de la géométrie ----------

// Terrain : positions, uv, normales, occlusion (couleur).
export class MeshBuilder {
  constructor() { this.pos = []; this.uv = []; this.nor = []; this.col = []; this.ind = []; }

  // Face hexagonale (dessus si up, sinon dessous) de rayon s, uv précalculés.
  cap(cx, y, cz, s, uv, ao, up) {
    const base = this.pos.length / 3, ny = up ? 1 : -1;
    for (let k = 0; k < 6; k++) {
      this.pos.push(cx + CORNERS[k][0] * s, y, cz + CORNERS[k][1] * s);
      this.uv.push(uv[2 * k], uv[2 * k + 1]);
      this.nor.push(0, ny, 0);
      const a = ao ? ao[k] : 1;
      this.col.push(a, a, a);
    }
    const flip = up ? TOP_FLIP : !TOP_FLIP;
    for (let i = 1; i < 5; i++) {
      if (flip) this.ind.push(base, base + i + 1, base + i);
      else this.ind.push(base, base + i, base + i + 1);
    }
  }

  // Face de côté i entre les hauteurs y0 et y1.
  side(i, cx, cz, y0, y1, s, uv, a0, a1, a2, a3) {
    const base = this.pos.length / 3;
    const [ax, az] = CORNERS[i], [bx, bz] = CORNERS[(i + 1) % 6];
    const nx = EDGE_N[i][0], nz = EDGE_N[i][1];
    this.pos.push(cx + ax * s, y0, cz + az * s, cx + bx * s, y0, cz + bz * s, cx + bx * s, y1, cz + bz * s, cx + ax * s, y1, cz + az * s);
    this.uv.push(uv[0], uv[1], uv[2], uv[3], uv[4], uv[5], uv[6], uv[7]);
    this.nor.push(nx, 0, nz, nx, 0, nz, nx, 0, nz, nx, 0, nz);
    this.col.push(a0, a0, a0, a1, a1, a1, a2, a2, a2, a3, a3, a3);
    if (SIDE_FLIP[i]) this.ind.push(base, base + 2, base + 1, base, base + 3, base + 2);
    else this.ind.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  // Quadrilatère quelconque (points [x,y,z], uv [u,v]) ; normale calculée, tournée vers le haut.
  // Le sens des triangles suit la normale : la face avant regarde vers le haut (sinon, en
  // double face, three.js retourne la normale et la face paraît dans l'ombre).
  quad(p, t) {
    const base = this.pos.length / 3;
    const ux = p[1][0] - p[0][0], uy = p[1][1] - p[0][1], uz = p[1][2] - p[0][2];
    const vx = p[3][0] - p[0][0], vy = p[3][1] - p[0][1], vz = p[3][2] - p[0][2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1;
    const down = ny < 0;
    const s = down ? -1 / l : 1 / l;
    nx *= s; ny *= s; nz *= s;
    for (let k = 0; k < 4; k++) {
      this.pos.push(p[k][0], p[k][1], p[k][2]);
      this.uv.push(t[k][0], t[k][1]);
      this.nor.push(nx, ny, nz);
      this.col.push(1, 1, 1);
    }
    // le sens 0-1-2 a pour normale (u x v) : on l'inverse si elle pointait vers le bas
    if (down) this.ind.push(base, base + 2, base + 1, base, base + 3, base + 2);
    else this.ind.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  // Polygone convexe plat (points [x,y,z], uv [u,v]) tourné vers la normale n
  poly(p, t, n) {
    const base = this.pos.length / 3;
    for (let k = 0; k < p.length; k++) {
      this.pos.push(p[k][0], p[k][1], p[k][2]);
      this.uv.push(t[k][0], t[k][1]);
      this.nor.push(n[0], n[1], n[2]);
      this.col.push(1, 1, 1);
    }
    const c = cross(p[0], p[1], p[2]), front = c[0] * n[0] + c[1] * n[1] + c[2] * n[2] > 0;
    for (let i = 1; i < p.length - 1; i++) {
      if (front) this.ind.push(base, base + i, base + i + 1);
      else this.ind.push(base, base + i + 1, base + i);
    }
  }

  // Terrain simplifié : la même chose en plus léger (normales sur un octet, pas de couleur quand
  // elle vaut 1 partout, index sur 16 bits si possible) : deux fois moins de mémoire graphique
  compactArrays() {
    const n = this.pos.length / 3;
    const normal = new Int8Array(this.nor.length);
    for (let i = 0; i < normal.length; i++) normal[i] = Math.round(this.nor[i] * 127);
    const out = { position: new Float32Array(this.pos), uv: new Float32Array(this.uv), normal };
    let plain = true;
    for (let i = 0; i < this.col.length && plain; i++) if (this.col[i] !== 1) plain = false;
    if (!plain) out.color = new Float32Array(this.col);
    out.index = n < 65536 ? new Uint16Array(this.ind) : new Uint32Array(this.ind);
    if (this.light) out.light = this.light;
    out.sphere = sphereOf(out.position);
    return out;
  }

  // Chunk complet : normales sur un octet, ombrage des coins (couleur) sur un octet, index sur 16
  // bits si possible, sphère englobante déjà calculée : un tiers de mémoire graphique en moins et
  // moins de travail à l'arrivée sur le thread principal (même dessin)
  chunkArrays() {
    const n = this.pos.length / 3;
    const position = new Float32Array(this.pos);
    // (arrondis depuis la valeur 32 bits d'avant : exactement les mêmes normales et ombres)
    const nor = new Float32Array(this.nor), col = new Float32Array(this.col);
    const normal = new Int8Array(nor.length), color = new Uint8Array(col.length);
    for (let i = 0; i < nor.length; i++) normal[i] = Math.round(nor[i] * 127);
    for (let i = 0; i < col.length; i++) color[i] = Math.round(col[i] * 255);
    return {
      position,
      uv: new Float32Array(this.uv),
      normal,
      color,
      index: n < 65536 ? new Uint16Array(this.ind) : new Uint32Array(this.ind),
      ...(this.light ? { light: this.light } : {}),
      sphere: sphereOf(position),
    };
  }

  arrays() {
    return {
      position: new Float32Array(this.pos),
      uv: new Float32Array(this.uv),
      normal: new Float32Array(this.nor),
      color: new Float32Array(this.col),
      index: new Uint32Array(this.ind),
      ...(this.light ? { light: this.light } : {}),
    };
  }
}

// Eau : positions, normales, profondeur et courant (pour le shader de l'eau).
class WaterBuilder {
  constructor() { this.pos = []; this.nor = []; this.dep = []; this.flow = []; this.ice = []; this.ind = []; }

  // Surface hexagonale : ys = hauteur de chaque coin, (fx, fz) = courant, ice : 1 = eau glaciale
  cap(cx, ys, cz, s, depths, fx, fz, ice = 0) {
    const base = this.pos.length / 3;
    for (let k = 0; k < 6; k++) {
      this.pos.push(cx + CORNERS[k][0] * s, ys[k], cz + CORNERS[k][1] * s);
      this.nor.push(0, 1, 0);
      this.dep.push(depths[k]);
      this.flow.push(fx, fz);
      this.ice.push(ice);
    }
    for (let i = 1; i < 5; i++) {
      if (TOP_FLIP) this.ind.push(base, base + i + 1, base + i);
      else this.ind.push(base, base + i, base + i + 1);
    }
  }

  // Côté i : du bas y0 jusqu'aux hauteurs ya (coin i) et yb (coin i+1)
  side(i, cx, cz, y0, ya, yb, ice = 0) {
    const base = this.pos.length / 3;
    this.ice.push(ice, ice, ice, ice);
    const [ax, az] = CORNERS[i], [bx, bz] = CORNERS[(i + 1) % 6];
    const nx = EDGE_N[i][0], nz = EDGE_N[i][1];
    this.pos.push(cx + ax, y0, cz + az, cx + bx, y0, cz + bz, cx + bx, yb, cz + bz, cx + ax, ya, cz + az);
    this.nor.push(nx, 0, nz, nx, 0, nz, nx, 0, nz, nx, 0, nz);
    this.dep.push(1, 1, 1, 1);
    this.flow.push(0, 0, 0, 0, 0, 0, 0, 0);
    if (SIDE_FLIP[i]) this.ind.push(base, base + 2, base + 1, base, base + 3, base + 2);
    else this.ind.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  arrays() {
    if (!this.ind.length) return null;
    const position = new Float32Array(this.pos), n = this.pos.length / 3;
    return {
      position,
      normal: new Float32Array(this.nor),
      depth: new Float32Array(this.dep),
      flow: new Float32Array(this.flow),
      ice: new Float32Array(this.ice),
      index: n < 65536 ? new Uint16Array(this.ind) : new Uint32Array(this.ind),
      sphere: sphereOf(position),
    };
  }
}

// Tampons à transférer entre threads (sans copie)
export function transferList(...meshes) {
  const list = [];
  for (const m of meshes) if (m) for (const a of Object.values(m)) list.push(a.buffer);
  return list;
}

// ---------- Copie du monde (générateur + modifications du joueur) ----------
// Chaque thread de travail en garde une, tenue à jour par le thread principal.
export class BlockSource {
  constructor({ gtype, seed, version, mods, chunkVer, surfaceOnly, cap }) {
    this.cap = cap || 640; // chunks gardés en cache au plus (voir World.plan)
    this.gen = new Generator(gtype, seed, H, version);
    this.gen.surfaceOnly = !!surfaceOnly; // (monde du menu : pas de profondeurs, voir World.setGenerator)
    this.mods = new Map((mods || []).map(([k, list]) => [k, new Map(list)]));
    this.chunkVer = new Map(chunkVer || []);
    // (la dernière réponse est gardée : le générateur la demande pour presque chaque case d'un même
    // chunk ; refaite si la liste a changé)
    let vq = NaN, vr = NaN, vn = -1, vv = GEN_CONTENT;
    this.gen.versionAt = (q, r) => {
      const cq = Math.floor(q / CS), cr = Math.floor(r / CS);
      if (cq !== vq || cr !== vr || vn !== this.chunkVer.size) { vq = cq; vr = cr; vn = this.chunkVer.size; vv = this.chunkVer.get(chunkKey(cq, cr)) ?? GEN_CONTENT; }
      return vv;
    };
    this.gen.setOldChunks(this.chunkVer);
    this.cache = new Map(); // chunks déjà générés (les plus anciens sont oubliés)
    this.tops = new WeakMap(); // données d'un chunk -> sa plus haute couche non vide (voir topOf)
  }

  // Plus haute couche d'un chunk qui contient un bloc (au-dessus : de l'air), en cache ; tenue à
  // jour par applyMods (un bloc posé plus haut la remonte ; un bloc retiré la laisse : c'est sans
  // danger, on lit seulement un peu plus d'air)
  topOf(data) {
    let t = this.tops.get(data);
    if (t !== undefined) return t;
    const LAYER = CS * CS;
    for (t = H - 1; t >= Y_MIN; t--) {
      let any = false;
      for (let i = (t + DEEP) * LAYER, e = i + LAYER; i < e; i++) if (data[i]) { any = true; break; }
      if (any) break;
    }
    this.tops.set(data, t);
    return t;
  }

  // Données d'un chunk : généré + modifications du joueur.
  chunk(cq, cr) {
    const k = chunkKey(cq, cr);
    let data = this.cache.get(k);
    if (data) { this.cache.delete(k); this.cache.set(k, data); return data; } // (le plus récent en dernier)
    data = new Uint16Array(CS * CS * NY); // (ids des blocs sur 16 bits : voir MAX_ID)
    this.gen.fillChunk(data, cq * CS, cr * CS, CS, idx);
    const m = this.mods.get(k);
    if (m) for (const [i, id] of m) data[i] = id;
    this.cache.set(k, data);
    // (la lumière lit les chunks voisins : on en garde assez pour toute la zone en détail)
    while (this.cache.size > this.cap) this.cache.delete(this.cache.keys().next().value);
    return data;
  }

  getBlock(q, r, y) {
    if (y < Y_MIN) return 4;
    if (y >= H) return AIR;
    const cq = Math.floor(q / CS), cr = Math.floor(r / CS);
    const k = chunkKey(cq, cr);
    const c = this.cache.get(k);
    const i = idx(q - cq * CS, r - cr * CS, y);
    if (c) return c[i];
    if (this.mods.has(k)) return this.chunk(cq, cr)[i];
    return this.gen.block(q, r, y);
  }

  // Bloc visible le plus haut de la colonne : h/id (peut être de l'eau), fh/fid (fond opaque).
  surface(q, r) {
    const cq = Math.floor(q / CS), cr = Math.floor(r / CS);
    const k = chunkKey(cq, cr);
    const data = this.cache.get(k) || (this.mods.has(k) ? this.chunk(cq, cr) : null);
    if (!data) return this.gen.surface(q, r);
    return columnSurface(data, q - cq * CS, r - cr * CS);
  }

  // Modifications reçues du thread principal : [clé chunk, index, id (-1 = retirée)]
  applyMods(list) {
    for (const [k, i, id] of list) {
      let m = this.mods.get(k);
      if (id < 0) {
        if (m) { m.delete(i); if (!m.size) this.mods.delete(k); }
        this.cache.delete(k); // sera regénéré proprement
        continue;
      }
      if (!m) this.mods.set(k, (m = new Map()));
      m.set(i, id);
      const c = this.cache.get(k);
      if (c) {
        c[i] = id;
        const t = this.tops.get(c), y = Math.floor(i / (CS * CS)) - DEEP;
        if (id && t !== undefined && y > t) this.tops.set(c, y);
      }
    }
  }
}

// Surface d'une colonne dans les données d'un chunk.
export function columnSurface(data, lq, lr) {
  let y = H - 1;
  // on ignore l'air et les rails (trop fins pour compter dans le terrain lointain)
  const skip = (id) => id === AIR || (!OPAQUE[id] && !isWater(id));
  while (y >= Y_MIN && skip(data[idx(lq, lr, y)])) y--;
  if (y < Y_MIN) return { h: Y_MIN - 1, id: AIR, fh: Y_MIN - 1, fid: AIR }; // (colonne vide)
  const h = y, id = data[idx(lq, lr, y)];
  if (!isWater(id)) return { h, id, fh: h, fid: id };
  while (y >= Y_MIN && !OPAQUE[data[idx(lq, lr, y)]]) y--;
  return { h, id, fh: y, fid: y >= Y_MIN ? data[idx(lq, lr, y)] : AIR };
}

// ---------- Chunk complet ----------
// src : objet avec getBlock(q, r, y) (pour les cases hors du chunk)
// uv  : texture -> { cap: [...], side: [...] } (coordonnées dans l'atlas)
// sec : sous-chunk à dessiner (voir SECTIONS : 0 = profondeurs, 1 = surface)
export function buildChunkArrays(src, cq, cr, data, uv, sec = 1) {
  const [yBase, yTop] = SECTIONS[sec];
  const q0 = cq * CS, r0 = cr * CS;
  const mb = new MeshBuilder();
  const wb = new WaterBuilder();
  const rb = new MeshBuilder(); // rails (matériau à transparence découpée)
  rb.twoSided = true;
  const gb = new MeshBuilder(); // torches (toujours éclairées)
  const lights = [];            // torches allumées : x, y, z, couleur
  const LAYER = CS * CS;

  // Couche la plus haute contenant un bloc : on ignore tout l'air au-dessus
  let maxY = yTop;
  while (maxY > yBase) {
    let any = false;
    for (let i = (maxY + DEEP) * LAYER, e = i + LAYER; i < e; i++) if (data[i]) { any = true; break; }
    if (any) break;
    maxY--;
  }

  // le chunk et ses 8 voisins, lus directement (la lumière les génère de toute façon) : pas de
  // clé de chunk à fabriquer pour chaque case du bord
  const around = new Array(9);
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) around[(a + 1) * 3 + b + 1] = a === 0 && b === 0 ? data : src.chunk ? src.chunk(cq + a, cr + b) : null;
  const get = (lq, lr, y) => {
    if (y < Y_MIN) return 4;
    if (y >= H) return AIR;
    if (lq >= 0 && lq < CS && lr >= 0 && lr < CS) return data[((y + DEEP) * CS + lr) * CS + lq];
    if (lq >= -CS && lq < 2 * CS && lr >= -CS && lr < 2 * CS) {
      const a = lq < 0 ? 0 : lq >= CS ? 2 : 1, b = lr < 0 ? 0 : lr >= CS ? 2 : 1, d = around[a * 3 + b];
      if (d) return d[((y + DEEP) * CS + lr - (b - 1) * CS) * CS + lq - (a - 1) * CS];
    }
    return src.getBlock(q0 + lq, r0 + lr, y);
  };
  // "solid" ici = opaque : cache la face voisine et compte pour l'ombrage des coins
  const solid = (lq, lr, y) => OPAQUE[get(lq, lr, y)];
  // profondeur d'eau sous (et y compris) la case
  const waterDepth = (lq, lr, y) => {
    let k = 0;
    while (k < 12 && isWater(get(lq, lr, y - k))) k++;
    return k;
  };
  // hauteur de la surface d'une case d'eau (1 si de l'eau la recouvre)
  const surfH = (lq, lr, y, id) => (isWater(get(lq, lr, y + 1)) ? 1 : waterHeight(id));
  const depths = [0, 0, 0, 0, 0, 0];
  const ys = [0, 0, 0, 0, 0, 0];
  const hn = [0, 0, 0, 0, 0, 0]; // hauteur d'eau des voisines (-1 = pas d'eau)
  const ao = [0, 0, 0, 0, 0, 0];
  const nb = new Uint8Array(6);  // voisins opaques à la même hauteur
  const W = SIZE * Math.sqrt(3);

  // Sous-sol enfoui : sous la première case non opaque d'une colonne et de ses 6 voisines, tout
  // est caché (aucune face à dessiner). Chaque colonne commence donc juste en dessous : avec un
  // monde de 156 de haut, la plupart des cases de pierre ne sont même plus regardées.
  // (on part d'une case sous le sous-chunk : une grotte des profondeurs juste sous la surface
  // fait voir le dessous des blocs de la couche 0)
  const yFloor = Math.max(Y_MIN, yBase - 1);
  const floorOf = (lq, lr) => {
    let y = yFloor;
    if (lq >= 0 && lq < CS && lr >= 0 && lr < CS) {
      while (y <= maxY && OPAQUE[data[((y + DEEP) * CS + lr) * CS + lq]]) y++;
    } else {
      while (y <= maxY && OPAQUE[get(lq, lr, y)]) y++;
    }
    return y;
  };
  const floors = new Int16Array((CS + 2) * (CS + 2)); // colonnes du chunk et leur bordure
  for (let lr = -1; lr <= CS; lr++) {
    for (let lq = -1; lq <= CS; lq++) {
      // (les coins opposés de la bordure ne touchent aucune colonne du chunk)
      if ((lq === -1 && lr === -1) || (lq === CS && lr === CS)) continue;
      floors[(lr + 1) * (CS + 2) + lq + 1] = floorOf(lq, lr);
    }
  }
  const start = new Int16Array(CS * CS);
  let minStart = maxY + 1;
  for (let lr = 0; lr < CS; lr++) {
    for (let lq = 0; lq < CS; lq++) {
      let s = floors[(lr + 1) * (CS + 2) + lq + 1] - 1;
      for (let k = 0; k < 6; k++) {
        const f = floors[(lr + NEIGHBORS[k][1] + 1) * (CS + 2) + lq + NEIGHBORS[k][0] + 1];
        if (f < s) s = f;
      }
      start[lr * CS + lq] = s < yBase ? yBase : s;
      if (start[lr * CS + lq] < minStart) minStart = start[lr * CS + lq];
    }
  }

  for (let y = minStart; y <= maxY; y++) {
    for (let lr = 0; lr < CS; lr++) {
      for (let lq = 0; lq < CS; lq++) {
        const id = data[((y + DEEP) * CS + lr) * CS + lq];
        if (id === AIR || y < start[lr * CS + lq]) continue;
        const cx = W * (q0 + lq + (r0 + lr) / 2), cz = SIZE * 1.5 * (r0 + lr);

        if (isWater(id)) {
          const surf = get(lq, lr, y + 1) === AIR;
          // (sous la surface : seulement les côtés contre l'air, à pleine hauteur ; les hauteurs et le
          // courant ne servent qu'à la surface)
          if (!surf) {
            for (let i = 0; i < 6; i++) {
              const nid = get(lq + NEIGHBORS[i][0], lr + NEIGHBORS[i][1], y);
              if (!OPAQUE[nid] && !isWater(nid)) wb.side(i, cx, cz, y, y + 1, y + 1, isIceWater(id) ? 1 : 0);
            }
            continue;
          }
          const h0 = surfH(lq, lr, y, id);
          let fx = 0, fz = 0;
          for (let k = 0; k < 6; k++) {
            const nq = lq + NEIGHBORS[k][0], nr = lr + NEIGHBORS[k][1];
            const nid = get(nq, nr, y);
            hn[k] = isWater(nid) ? surfH(nq, nr, y, nid) : -1;
            // courant : vers les voisines plus basses (ou vides)
            const drop = hn[k] >= 0 ? h0 - hn[k] : (OPAQUE[nid] ? 0 : h0 * 0.5);
            if (drop > 0) { fx += EDGE_N[k][0] * drop; fz += EDGE_N[k][1] * drop; }
          }
          // hauteur de chaque coin = moyenne des cases d'eau qui s'y touchent (surface continue)
          let prev = 5;
          for (let k = 0; k < 6; k++) {
            let sum = h0, n = 1;
            if (hn[prev] >= 0) { sum += hn[prev]; n++; }
            if (hn[k] >= 0) { sum += hn[k]; n++; }
            ys[k] = y + (hn[prev] === 1 || hn[k] === 1 || h0 === 1 ? 1 : sum / n);
            prev = k;
          }
          if (surf) {
            // profondeur à chaque coin = moyenne des 3 cases qui s'y touchent (0 sur la rive)
            const d = waterDepth(lq, lr, y);
            const nd = (k) => {
              const n = NEIGHBORS[k], nid = get(lq + n[0], lr + n[1], y);
              if (isWater(nid)) return waterDepth(lq + n[0], lr + n[1], y);
              return OPAQUE[nid] ? 0 : d;
            };
            let p = nd(5);
            for (let k = 0; k < 6; k++) {
              const c = nd(k);
              depths[k] = (d + p + c) / 3;
              p = c;
            }
            wb.cap(cx, ys, cz, 1, depths, fx, fz, isIceWater(id) ? 1 : 0);
          }
          for (let i = 0; i < 6; i++) {
            const nid = get(lq + NEIGHBORS[i][0], lr + NEIGHBORS[i][1], y);
            if (!OPAQUE[nid] && !isWater(nid)) {
              wb.side(i, cx, cz, y, surf ? ys[i] : y + 1, surf ? ys[(i + 1) % 6] : y + 1, isIceWater(id) ? 1 : 0);
            }
          }
          continue;
        }

        if (BLOCKS[id]?.track !== undefined || BLOCKS[id]?.prop) continue; // (rail de train, butoir, panneau : dessinés à part, voir tracks.js)
        if (isRail(id)) {
          const shape = railShape((q, r, yy) => get(q - q0, r - r0, yy), q0 + lq, r0 + lr, y);
          drawRail(rb, uv, id, shape, cx, cz, y);
          continue;
        }

        if (isTorch(id)) {
          drawTorch(gb, uv, id, cx, cz, y, lights);
          continue;
        }


        if (isWire(id)) {
          drawWire(rb, uv, id, cx, cz, y, (dq, dr, dy) => get(lq + dq, lr + dr, y + dy));
          continue;
        }

        if (BLOCKS[id].sapling) {
          drawPlant(rb, uv, id, cx, cz, y);
          continue;
        }

        if (isLever(id)) {
          drawLever(mb, rb, uv, id, cx, cz, y);
          continue;
        }

        if (isRepeater(id)) {
          drawRepeater(mb, gb, uv, id, cx, cz, y);
          continue;
        }

        // dalle verticale ; deux dalles dans la case
        if (BLOCKS[id].vslab !== undefined) {
          drawVSlab(mb, uv, id, cx, cz, y, (dq, dr, dy) => get(lq + dq, lr + dr, y + dy));
          continue;
        }
        if (BLOCKS[id].dslab) {
          drawDoubleSlab(mb, uv, id, cx, cz, y, (dq, dr, dy) => get(lq + dq, lr + dr, y + dy));
          continue;
        }
        if (SLAB[id]) {
          drawSlab(mb, uv, id, cx, cz, y, (dq, dr, dy) => get(lq + dq, lr + dr, y + dy));
          continue;
        }

        const b = BLOCKS[id];
        if (b.glass) {
          drawGlass(rb, uv, id, cx, cz, y, (dq, dr, dy) => get(lq + dq, lr + dr, y + dy));
          continue;
        }
        if (b.shape === 'chest') {
          drawChest(mb, uv, id, cx, cz, y);
          continue;
        }
        if (b.shape === 'piston_head') {
          drawPistonHead(mb, uv, id, cx, cz, y);
          continue;
        }
        if (b.shape === 'pod') {
          drawPod(mb, uv, id, cx, cz, y, (dq, dr, dy) => get(lq + dq, lr + dr, y + dy));
          continue;
        }
        // four allumé, lave : ils éclairent (la lave seulement en surface, sinon un lac
        // entier ferait des centaines de lumières)
        if (b.light && !(b.lava && isLava(get(lq, lr, y + 1)))) lights.push(cx, y + 0.6, cz, b.light);
        if (b.flow) {
          drawLavaFlow(gb, uv, id, cx, cz, y, (dq, dr, dy) => get(lq + dq, lr + dr, y + dy));
          continue;
        }
        // lave, magma : toujours lumineux (dessinés sans ombre, avec les torches)
        const out = b.glow ? gb : mb;
        for (let i = 0; i < 6; i++) nb[i] = solid(lq + NEIGHBORS[i][0], lr + NEIGHBORS[i][1], y);

        if (!solid(lq, lr, y + 1)) {
          // Occlusion : le coin k touche les voisins k-1 et k (une couche au-dessus)
          let up0 = solid(lq + NEIGHBORS[5][0], lr + NEIGHBORS[5][1], y + 1);
          const first = up0;
          for (let k = 0; k < 6; k++) {
            const up1 = k === 5 ? first : solid(lq + NEIGHBORS[k][0], lr + NEIGHBORS[k][1], y + 1);
            ao[k] = AO[up0 + up1];
            up0 = up1;
          }
          out.cap(cx, y + 1, cz, 1, uv[b.top].cap, ao, true);
        }
        if (!solid(lq, lr, y - 1)) out.cap(cx, y, cz, 1, uv[b.bottom].cap, null, false);

        for (let i = 0; i < 6; i++) {
          if (nb[i]) continue;
          const nq = lq + NEIGHBORS[i][0], nr = lr + NEIGHBORS[i][1];
          // Occlusion : coin intérieur (voisins d'à côté), sol devant (bas), surplomb (haut)
          const sideA = nb[(i + 5) % 6], sideB = nb[(i + 1) % 6];
          const below = solid(nq, nr, y - 1), above = solid(nq, nr, y + 1);
          out.side(i, cx, cz, y, y + 1, 1, uv[sideTex(b, i)].side,
            AO[sideA + below], AO[sideB + below], AO[sideB + above], AO[sideA + above]);
        }
      }
    }
  }

  // lumière propagée (ciel et torches, arrêtée par les blocs pleins : voir light.js)
  if (mb.pos.length || rb.pos.length) {
    // (les sources de lumière de l'autre sous-chunk comptent : la zone déborde de LIGHT_M)
    const light = computeLight(src, cq, cr, CS, H, Math.max(Y_MIN, minStart - LIGHT_M), Math.min(H - 1, sec === 0 ? yTop + LIGHT_M : maxY + 2));
    bakeLight(mb, light);
    bakeLight(rb, light); // les rails aussi
  }
  return {
    opaque: mb.chunkArrays(), water: wb.arrays(),
    rails: rb.ind.length ? rb.chunkArrays() : null,
    glow: gb.ind.length ? gb.chunkArrays() : null,
    lights: lights.length ? { list: new Float32Array(lights) } : null,
  };
}

// ---------- Lumière des torches, simplifiée (chunks lointains simplifiés seulement) ----------
// Chaque sommet reçoit la lumière des torches proches : couleur, baisse avec la distance, plus
// forte sur les faces tournées vers elle (sans murs : de si loin, ça ne se voit pas). Les
// chunks détaillés ont la vraie lumière propagée (light.js).
export const TORCH_REACH = 10;
// 1 torche, 2 torche d'énergie, 3 four allumé (plus doux), 4 lave
const TORCH_RGB = { 1: [1.0, 0.6, 0.24], 2: [1.0, 0.12, 0.07], 3: [0.55, 0.28, 0.1], 4: [1.0, 0.38, 0.08] };
const TORCH_POWER = 1.6;

// Torches (posées par les joueurs : elles sont dans les modifications) autour d'une zone
function torchesAround(src, q0, r0, span) {
  const out = [];
  if (!src.mods || !src.mods.size) return out;
  const R = TORCH_REACH + 1;
  const c0q = Math.floor((q0 - R) / CS), c1q = Math.floor((q0 + span + R) / CS);
  const c0r = Math.floor((r0 - R) / CS), c1r = Math.floor((r0 + span + R) / CS);
  for (let cq = c0q; cq <= c1q; cq++) {
    for (let cr = c0r; cr <= c1r; cr++) {
      const m = src.mods.get(chunkKey(cq, cr));
      if (!m) continue;
      for (const [i, id] of m) {
        const light = BLOCKS[id]?.light;
        if (!light) continue;
        const lq = i % CS, lr = Math.floor(i / CS) % CS, y = Math.floor(i / (CS * CS)) - DEEP;
        const c = hexToWorld(cq * CS + lq, cr * CS + lr);
        out.push([c.x, y + 0.6, c.z, TORCH_RGB[light] || TORCH_RGB[1]]);
      }
    }
  }
  return out;
}

function bakeTorchLight(mb, torches) {
  if (!torches.length || !mb.pos.length) return;
  const n = mb.pos.length / 3, R2 = TORCH_REACH * TORCH_REACH;
  const tl = new Float32Array(n * 3);
  let any = false;
  for (let v = 0; v < n; v++) {
    const px = mb.pos[v * 3], py = mb.pos[v * 3 + 1], pz = mb.pos[v * 3 + 2];
    const nx = mb.nor[v * 3], ny = mb.nor[v * 3 + 1], nz = mb.nor[v * 3 + 2];
    let r = 0, g = 0, b = 0;
    for (const [lx, ly, lz, rgb] of torches) {
      const dx = lx - px, dy = ly - py, dz = lz - pz, d2 = dx * dx + dy * dy + dz * dz;
      if (d2 >= R2) continue;
      const d = Math.sqrt(d2);
      const fall = (1 - d / TORCH_REACH) ** 2;
      // (valeur absolue : les rails sont visibles des deux côtés)
      const dot = (dx * nx + dy * ny + dz * nz) / d;
      // (comme les vraies lumières : au moins 45 % sur les faces qui ne la regardent pas)
      const face = d > 0.05 ? (mb.twoSided ? Math.abs(dot) : Math.max(0, dot)) * 0.55 + 0.45 : 1;
      const k = fall * face * TORCH_POWER;
      r += rgb[0] * k; g += rgb[1] * k; b += rgb[2] * k;
    }
    if (r + g + b > 0) {
      any = true;
      tl[v * 3] = Math.min(2, r); tl[v * 3 + 1] = Math.min(2, g); tl[v * 3 + 2] = Math.min(2, b);
    }
  }
  if (!any) return;
  const out = new Float32Array(n * 4);
  for (let v = 0; v < n; v++) { out[v * 4] = tl[v * 3]; out[v * 4 + 1] = tl[v * 3 + 1]; out[v * 4 + 2] = tl[v * 3 + 2]; out[v * 4 + 3] = 1; }
  mb.light = out;
}

// Rail : bande qui suit le tracé (droit, en pente ou en arc de cercle) d'un bord à l'autre
function drawRail(rb, uv, id, shape, cx, cz, y) {
  const pts = railCurve(shape, cx, cz, y, shape.a, shape.b);
  const [ru0, rv0, ru1, rv1] = uv[BLOCKS[id].top].rect;
  const U = (u) => ru0 + (ru1 - ru0) * u, V = (v) => rv0 + (rv1 - rv0) * v;
  const W2 = 0.36; // demi-largeur (la même partout)
  const m = pts.length;
  // Virage serré (demi-tour sur deux côtés voisins) : le rail tourne autour d'un coin de
  // l'hexagone, à 0.29 seulement. Le côté intérieur, plus large que ce rayon, se replierait :
  // il s'arrête au coin (les traverses s'y rejoignent en éventail).
  const turn = (shape.b - shape.a + 6) % 6;
  let pivot = null;
  if (turn === 1 || turn === 5) {
    let best = Infinity;
    for (const [kx, kz] of CORNERS) {
      const px = cx + kx, pz = cz + kz;
      const d = pts.map((p) => Math.hypot(p[0] - px, p[2] - pz));
      const spread = Math.max(...d) - Math.min(...d);
      if (spread < best) { best = spread; pivot = [px, pz]; }
    }
  }
  // bords gauche (-1) et droit (+1) du rail au point i
  const edge = (i, sgn) => {
    const p = pts[i], pa = pts[Math.max(0, i - 1)], pb = pts[Math.min(m - 1, i + 1)];
    const tx = pb[0] - pa[0], tz = pb[2] - pa[2], tl = Math.hypot(tx, tz) || 1;
    const nx = (-tz / tl) * sgn, nz = (tx / tl) * sgn;
    let w = W2;
    if (pivot && nx * (pivot[0] - p[0]) + nz * (pivot[1] - p[2]) > 0) {
      w = Math.min(W2, Math.hypot(pivot[0] - p[0], pivot[1] - p[2])); // (côté du coin)
    }
    return [p[0] + nx * w, p[1], p[2] + nz * w];
  };
  for (let i = 0; i + 1 < m; i++) {
    const v0 = V(i / (m - 1)), v1 = V((i + 1) / (m - 1));
    rb.quad(
      [edge(i, -1), edge(i + 1, -1), edge(i + 1, 1), edge(i, 1)],
      [[U(0), v0], [U(0), v1], [U(1), v1], [U(1), v0]],
    );
  }
}

// Lave qui coule : moins haute que la source (pleine si de la lave tombe dessus). Côtés :
// seulement la partie qui dépasse de la lave voisine.
function drawLavaFlow(gb, uv, id, cx, cz, y, near) {
  const b = BLOCKS[id];
  const h = isLava(near(0, 0, 1)) ? 1 : lavaHeight(id);
  const lh = (n, dq, dr) => (isLava(near(dq, dr, 1)) ? 1 : lavaHeight(n));
  if (h < 1 || !OPAQUE[near(0, 0, 1)]) gb.cap(cx, y + h, cz, 1, uv[b.top].cap, null, true);
  const below = near(0, 0, -1);
  if (!OPAQUE[below] && !isLava(below)) gb.cap(cx, y, cz, 1, uv[b.bottom].cap, null, false);
  for (let i = 0; i < 6; i++) {
    const [dq, dr] = NEIGHBORS[i], n = near(dq, dr, 0);
    if (OPAQUE[n]) continue;
    const lo = isLava(n) ? lh(n, dq, dr) : 0;
    if (lo >= h) continue;
    const s = uv[b.side].side, v0 = s[1], v1 = s[5];
    const va = v0 + (v1 - v0) * lo, vb = v0 + (v1 - v0) * h;
    gb.side(i, cx, cz, y + lo, y + h, 1, [s[0], va, s[2], va, s[4], vb, s[6], vb], 1, 1, 1, 1);
  }
}

// Dalle : prisme hexagonal d'une demi-hauteur. near(dq, dr, dy) : bloc voisin.
// Faces cachées : contre un bloc opaque, ou contre une dalle de la même moitié (côtés),
// ou contre la moitié d'en face d'une dalle voisine (dessus / dessous).
// inner : la case contient aussi l'autre moitié (pas de face au milieu)
function drawSlab(mb, uv, id, cx, cz, y, near, inner = false) {
  const b = BLOCKS[id];
  const [lo, hi] = blockBox(id);
  if (hi < 1 ? !inner : !(OPAQUE[near(0, 0, 1)] || SLAB[near(0, 0, 1)] === 1)) mb.cap(cx, y + hi, cz, 1, uv[b.top].cap, null, true);
  if (lo > 0 ? !inner : !(OPAQUE[near(0, 0, -1)] || SLAB[near(0, 0, -1)] === 2)) mb.cap(cx, y + lo, cz, 1, uv[b.bottom].cap, null, false);
  for (let i = 0; i < 6; i++) {
    const n = near(NEIGHBORS[i][0], NEIGHBORS[i][1], 0);
    if (OPAQUE[n] || SLAB[n] === SLAB[id]) continue;
    // la moitié correspondante de la texture du côté
    const s = uv[sideTex(b, i)].side, v0 = s[1], v1 = s[5];
    const va = v0 + (v1 - v0) * lo, vb = v0 + (v1 - v0) * hi;
    mb.side(i, cx, cz, y + lo, y + hi, 1, [s[0], va, s[2], va, s[4], vb, s[6], vb], 1, 1, 1, 1);
  }
}

// Dalle verticale : la moitié de l'hexagone du côté vslab (coins k - 1 à k + 2), toute la
// hauteur ; la face de la coupe passe par les coins k + 2 et k - 1. cut : dessiner la coupe
// (pas quand l'autre moitié est dans la case)
function drawVSlab(mb, uv, id, cx, cz, y, near, cut = true) {
  const b = BLOCKS[id], k = b.vslab;
  const C = (i) => CORNERS[(i + 6) % 6], idx = [k - 1, k, k + 1, k + 2];
  const capUv = (tex) => idx.map((i) => { const u = uv[tex].cap, j = (i + 6) % 6; return [u[2 * j], u[2 * j + 1]]; });
  const ring = (yy) => idx.map((i) => [cx + C(i)[0], yy, cz + C(i)[1]]);
  if (!OPAQUE[near(0, 0, 1)]) mb.poly(ring(y + 1), capUv(b.top), [0, 1, 0]);
  if (!OPAQUE[near(0, 0, -1)]) mb.poly(ring(y), capUv(b.bottom), [0, -1, 0]);
  for (const i of [k - 1, k, k + 1]) {
    const j = (i + 6) % 6;
    if (OPAQUE[near(NEIGHBORS[j][0], NEIGHBORS[j][1], 0)]) continue;
    mb.side(j, cx, cz, y, y + 1, 1, uv[sideTex(b, j)].side, 1, 1, 1, 1);
  }
  if (!cut) return;
  // la coupe va d'un coin à l'autre en passant par le centre : deux fois la largeur d'un côté.
  // Deux faces (coin -> centre, centre -> coin), chacune avec la texture entière (une seule,
  // étirée sur toute la coupe, était deux fois trop large)
  const s = uv[b.side].side, A = C(k + 2), B = C(k - 1), n = [-EDGE_N[k][0], 0, -EDGE_N[k][1]];
  const t = [[s[0], s[1]], [s[2], s[3]], [s[4], s[5]], [s[6], s[7]]];
  for (const [P, Q] of [[A, [0, 0]], [[0, 0], B]]) {
    mb.poly([[cx + P[0], y, cz + P[1]], [cx + Q[0], y, cz + Q[1]], [cx + Q[0], y + 1, cz + Q[1]], [cx + P[0], y + 1, cz + P[1]]], t, n);
  }
}

// Lit de villageois (le bas ou le haut, voir blocks.js) : une capsule hexagonale ouverte côté k,
// en planches dehors et en laine dedans (parois jusqu'au rayon POD_IN) ; le bas a son matelas,
// le haut son plafond et le toit
const POD_IN = 0.8, POD_BED = 0.18, POD_CEIL = 0.82;
function drawPod(mb, uv, id, cx, cz, y, near) {
  const b = BLOCKS[id], k = b.pod, top = !!b.podTop;
  const wood = uv.oak_planks || uv[b.side], wool = uv.wool_white || wood;
  const C = (i, s = 1) => { const c = CORNERS[(i + 6) % 6]; return [cx + c[0] * s, cz + c[1] * s]; };
  const quad = (a, bb, y0, y1, tex, n) => mb.poly([[a[0], y0, a[1]], [bb[0], y0, bb[1]], [bb[0], y1, bb[1]], [a[0], y1, a[1]]], [[tex[0], tex[1]], [tex[2], tex[3]], [tex[4], tex[5]], [tex[6], tex[7]]], n);
  for (let i = 0; i < 6; i++) {
    if (i === k) continue;
    // dehors : la planche (cachée contre un bloc plein) ; dedans : la laine, tournée vers le centre
    if (!OPAQUE[near(NEIGHBORS[i][0], NEIGHBORS[i][1], 0)]) mb.side(i, cx, cz, y, y + 1, 1, wood.side, 1, 1, 1, 1);
    quad(C(i, POD_IN), C(i + 1, POD_IN), y, y + 1, wool.side, [-EDGE_N[i][0], 0, -EDGE_N[i][1]]);
  }
  // l'ouverture : l'épaisseur des parois de chaque côté (planche)
  const mid = C(k, 0.5).map((v, j) => (v + C(k + 1, 0.5)[j]) / 2);
  for (const i of [k, k + 1]) {
    const o = C(i), n0 = [mid[0] - o[0], mid[1] - o[1]], l = Math.hypot(...n0) || 1;
    quad(o, C(i, POD_IN), y, y + 1, wood.side, [n0[0] / l, 0, n0[1] / l]);
  }
  const out = EDGE_N[k];
  if (!top) {
    if (!OPAQUE[near(0, 0, -1)]) mb.cap(cx, y, cz, 1, wood.cap, null, false);
    // le matelas (laine) et son bord côté ouverture
    mb.cap(cx, y + POD_BED, cz, POD_IN, wool.cap, null, true);
    quad(C(k, POD_IN), C(k + 1, POD_IN), y, y + POD_BED, wool.side, [out[0], 0, out[1]]);
    // le seuil (entre la paroi et le matelas, dans l'ouverture)
    quad(C(k), C(k + 1), y, y + POD_BED, wood.side, [out[0], 0, out[1]]);
  } else {
    if (!OPAQUE[near(0, 0, 1)]) mb.cap(cx, y + 1, cz, 1, wood.cap, null, true);
    // le plafond (laine) et le linteau au-dessus de l'ouverture
    mb.cap(cx, y + POD_CEIL, cz, POD_IN, wool.cap, null, false);
    quad(C(k), C(k + 1), y + POD_CEIL, y + 1, wood.side, [out[0], 0, out[1]]);
    quad(C(k, POD_IN), C(k + 1, POD_IN), y + POD_CEIL, y + 1, wood.side, [-out[0], 0, -out[1]]);
  }
}

// Deux dalles dans la case (de matières différentes) : chacune sa moitié, sans la face du milieu
function drawDoubleSlab(mb, uv, id, cx, cz, y, near) {
  for (const part of BLOCKS[id].dslab) {
    if (BLOCKS[part].vslab !== undefined) drawVSlab(mb, uv, part, cx, cz, y, near, false);
    else drawSlab(mb, uv, part, cx, cz, y, near, true);
  }
}

// Torche : prisme hexagonal découpé dans la texture (sa partie visible), posé sur le bloc
// découpage par défaut (texture absente) : bâton en bas, flamme au-dessus
const TORCH_PARTS = { stick: [0.44, 0.35, 0.56, 1], flame: [0.4, 0.1, 0.6, 0.35] };
function drawTorch(gb, uv, id, cx, cz, y, lights) {
  const wall = BLOCKS[id].wall;
  const v0 = gb.pos.length;
  // Comme dans Minecraft : un bâton fin, et au bout une flamme un peu plus large.
  // Chaque partie reprend sa zone de la texture (sans être étirée sur toute la torche).
  const t = uv[BLOCKS[id].top];
  const [ru0, rv0, ru1, rv1] = t.rect;
  const { stick, flame } = t.parts || TORCH_PARTS;
  const U = (u) => ru0 + (ru1 - ru0) * u, V = (v) => rv0 + (rv1 - rv0) * (1 - v);
  const band = ([x0, y0, x1, y1]) => [U(x1), V(y1), U(x0), V(y1), U(x0), V(y0), U(x1), V(y0)];
  const dot = (u, v) => { const a = U(u), b = V(v); return [a, b, a, b, a, b, a, b, a, b, a, b]; };
  const TOTAL = 0.66; // hauteur de la torche (bloc = 1)
  // haut du bâton (selon la texture, mais la flamme garde au moins 0.2 de haut)
  const hs = y + Math.min(TOTAL - 0.2, TOTAL * (stick[3] - stick[1]) / (stick[3] - flame[1]));
  const top = y + TOTAL;
  const sw = 0.12, fw = 0.18; // largeurs du bâton et de la flamme
  const st = band(stick), fl = band(flame);
  for (let i = 0; i < 6; i++) gb.side(i, cx, cz, y, hs, sw, st, 1, 1, 1, 1);
  for (let i = 0; i < 6; i++) gb.side(i, cx, cz, hs, top, fw, fl, 1, 1, 1, 1);
  // dessus : le cœur clair de la flamme ; dessous de la flamme : son orange
  const fu = (flame[0] + flame[2]) / 2, fv = flame[1] + (flame[3] - flame[1]) * 0.45;
  gb.cap(cx, top, cz, fw, dot(fu, fv), null, true);
  gb.cap(cx, hs, cz, fw, dot(flame[0] + 0.01, fv), null, false);
  let lx = cx, ly = top - 0.1, lz = cz;
  if (wall !== undefined) {
    // torche murale : le pied contre le bloc (côté wall), un peu plus haut, la tête penchée
    // vers l'extérieur (comme dans Minecraft)
    const [nx, nz] = EDGE_N[wall], BASE = 0.445, LIFT = 0.2, LEAN = 0.42;
    for (let i = v0; i < gb.pos.length; i += 3) {
      const h = gb.pos[i + 1] - y;
      gb.pos[i] += nx * (BASE - LEAN * h);
      gb.pos[i + 1] += LIFT;
      gb.pos[i + 2] += nz * (BASE - LEAN * h);
    }
    lx = cx + nx * (BASE - LEAN * (TOTAL - 0.1)); ly += LIFT; lz = cz + nz * (BASE - LEAN * (TOTAL - 0.1));
  }
  if (BLOCKS[id].light && lights) lights.push(lx, ly, lz, BLOCKS[id].light);
}

// Verre : bloc plein dessiné avec la texture à trous (matériau des rails : transparence
// découpée, visible des deux côtés). Pas de face entre deux blocs de verre.
function drawGlass(rb, uv, id, cx, cz, y, at) {
  const b = BLOCKS[id];
  const hide = (n) => OPAQUE[n] || n === id;
  if (!hide(at(0, 0, 1))) rb.cap(cx, y + 1, cz, 1, uv[b.top].cap, null, true);
  if (!hide(at(0, 0, -1))) rb.cap(cx, y, cz, 1, uv[b.bottom].cap, null, false);
  for (let i = 0; i < 6; i++) {
    if (hide(at(NEIGHBORS[i][0], NEIGHBORS[i][1], 0))) continue;
    rb.side(i, cx, cz, y, y + 1, 1, uv[sideTex(b, i)].side, 1, 1, 1, 1);
  }
}

// Coffre : prisme un peu plus petit qu'un bloc (7/8 de large et de haut), comme dans Minecraft
const CHEST_SIZE = 0.875;
function drawChest(mb, uv, id, cx, cz, y) {
  const b = BLOCKS[id], s = CHEST_SIZE;
  mb.cap(cx, y + s, cz, s, uv[b.top].cap, null, true);
  mb.cap(cx, y, cz, s, uv[b.bottom].cap, null, false);
  for (let i = 0; i < 6; i++) mb.side(i, cx, cz, y, y + s, s, uv[sideTex(b, i)].side, 1, 1, 1, 1);
}

// Tête de piston : une plaque (le quart du bloc, du côté où il pousse) et la tige au milieu,
// jusqu'au piston
const PISTON_PLATE = 0.25, PISTON_ROD = 0.24;
function drawPistonHead(mb, uv, id, cx, cz, y) {
  const b = BLOCKS[id], up = b.pistonHead > 0;
  const p0 = up ? y + 1 - PISTON_PLATE : y, p1 = p0 + PISTON_PLATE;
  mb.cap(cx, p1, cz, 1, uv[up ? b.top : 'piston_bottom'].cap, null, true);
  mb.cap(cx, p0, cz, 1, uv[up ? 'piston_bottom' : b.bottom].cap, null, false);
  // bord de la plaque : la bande de la tête dans la texture du côté (en haut, ou en bas
  // pour le piston tourné vers le bas)
  const s = uv[b.side].side, v0 = s[1], v1 = s[5];
  const [a, c] = up ? [1 - PISTON_PLATE, 1] : [0, PISTON_PLATE];
  const va = v0 + (v1 - v0) * a, vb = v0 + (v1 - v0) * c;
  for (let i = 0; i < 6; i++) mb.side(i, cx, cz, p0, p1, 1, [s[0], va, s[2], va, s[4], vb, s[6], vb], 1, 1, 1, 1);
  // tige : le milieu de la texture de la tige
  const r = uv.piston_rod.side, ua = r[0] + (r[2] - r[0]) * 0.4, ub = r[0] + (r[2] - r[0]) * 0.6;
  const r0 = up ? y : p1, r1 = up ? p0 : y + 1;
  const rv0 = r[1] + (r[5] - r[1]) * (up ? 0 : PISTON_PLATE), rv1 = r[1] + (r[5] - r[1]) * (up ? 1 - PISTON_PLATE : 1);
  for (let i = 0; i < 6; i++) mb.side(i, cx, cz, r0, r1, PISTON_ROD, [ua, rv0, ub, rv0, ub, rv1, ua, rv1], 1, 1, 1, 1);
}

// Fil de voltite : à plat sur le sol, un point au milieu et un tronçon vers chaque voisin
// qu'il relie (fil de la même sorte, bloc de voltite, torche d'énergie, bloc physique, TNT)
export const wireLinks = (n, id = n) => (isWire(n) ? wireKind(n) === wireKind(id) : isSource(n) || n === 25 || isPhysics(n) || isTnt(n) || isLever(n) || isLamp(n));
function drawWire(rb, uv, id, cx, cz, y, at) {
  const on = isWireOn(id), pre = wireKind(id) === 2 ? 'impure_' : '';
  const strip = uv[pre + (on ? 'wire_on' : 'wire_off')].rect, dot = uv[pre + (on ? 'wire_dot_on' : 'wire_dot_off')].rect;
  const tex = (r, u, v) => [r[0] + (r[2] - r[0]) * u, r[1] + (r[3] - r[1]) * (1 - v)];
  const yy = y + 0.015, W = 0.1, L = 0.5;
  let links = 0;
  for (let i = 0; i < 6; i++) {
    const [dq, dr] = NEIGHBORS[i], step = wireStep(at, id, dq, dr);
    const n = at(dq, dr, 0);
    // un répéteur : relié par son arrière (entrée), ou par son avant s'il alimente ce fil
    if (isRepeater(n)) {
      const side = (i + 3) % 6;
      if (side !== repeaterIn(n) && !(side === repeaterOut(n) && repeaterKind(n) === wireKind(id))) continue;
    } else if (step === null && !wireLinks(n, id)) continue;
    links++;
    const [nx, nz] = EDGE_N[i], tx = -nz * W, tz = nx * W;
    rb.quad(
      [[cx + tx, yy, cz + tz], [cx + nx * L + tx, yy, cz + nz * L + tz], [cx + nx * L - tx, yy, cz + nz * L - tz], [cx - tx, yy, cz - tz]],
      [tex(strip, 0, 0), tex(strip, 1, 0), tex(strip, 1, 1), tex(strip, 0, 1)],
    );
    // il monte sur le bloc voisin : un tronçon debout contre sa face
    if (step === 1) {
      const e = L - 0.012, ex = cx + nx * e, ez = cz + nz * e, top = y + 1 + 0.015;
      rb.quad(
        [[ex + tx, yy, ez + tz], [ex + tx, top, ez + tz], [ex - tx, top, ez - tz], [ex - tx, yy, ez - tz]],
        [tex(strip, 0, 0), tex(strip, 1, 0), tex(strip, 1, 1), tex(strip, 0, 1)],
      );
    }
  }
  // le point du milieu, un peu plus haut (pas de scintillement avec les tronçons)
  const d = links ? 0.16 : 0.24, dy = yy + 0.003;
  rb.quad(
    [[cx - d, dy, cz - d], [cx + d, dy, cz - d], [cx + d, dy, cz + d], [cx - d, dy, cz + d]],
    [tex(dot, 0, 0), tex(dot, 1, 0), tex(dot, 1, 1), tex(dot, 0, 1)],
  );
}

// Répéteur : plaque de pierre fine, le dessus (la texture) tourné vers la sortie, et deux
// petits plots qui s'allument (couleur du courant) quand il donne du courant
const REP_H = 0.125, REP_POSTS = [0.3, -0.18], REP_POST_R = 0.075, REP_POST_H = 0.2;
function drawRepeater(mb, gb, uv, id, cx, cz, y) {
  const on = isRepeaterOn(id), red = repeaterKind(id) === 1;
  const stone = uv[BLOCKS[id].side], top = uv[BLOCKS[id].top].rect; // (inverseur : basalte)
  // avant (haut de l'image) : direction de la sortie ; droite de l'image : perpendiculaire
  const a = (Math.PI / 3) * repeaterOut(id), fx = Math.cos(a), fz = Math.sin(a), rx = -fz, rz = fx;
  const cap = [];
  for (const [x, z] of CORNERS) {
    const tu = 0.5 + (x * rx + z * rz) / (2 * SIZE), tv = 0.5 + (x * fx + z * fz) / (2 * SIZE);
    cap.push(top[0] + (top[2] - top[0]) * tu, top[1] + (top[3] - top[1]) * tv);
  }
  mb.cap(cx, y + REP_H, cz, 1, cap, null, true);
  mb.cap(cx, y, cz, 1, stone.cap, null, false);
  const r = stone.rect, vb = r[1] + (r[3] - r[1]) * (1 - REP_H);
  const band = [r[2], vb, r[0], vb, r[0], r[3], r[2], r[3]];
  for (let i = 0; i < 6; i++) mb.side(i, cx, cz, y, y + REP_H, 1, band, 1, 1, 1, 1);
  // plots : brillants quand il est allumé (matériau des flammes)
  const post = uv[(red ? '' : 'impure_') + (on ? 'wire_dot_on' : 'wire_dot_off')];
  const b = on ? gb : mb, s = REP_POST_R / SIZE;
  for (const d of REP_POSTS) {
    const px = cx + fx * d, pz = cz + fz * d, y0 = y + REP_H, y1 = y0 + REP_POST_H;
    b.cap(px, y1, pz, s, post.cap, null, true);
    for (let i = 0; i < 6; i++) b.side(i, px, pz, y0, y1, s, post.side, 1, 1, 1, 1);
  }
}

// Plante (pousse d'arbre) : trois panneaux verticaux croisés à 60°, comme une étoile à
// six branches vue de dessus (texture à trous : matériau des rails)
function drawPlant(rb, uv, id, cx, cz, y) {
  const r = uv[BLOCKS[id].side].rect, h = 0.85, w = 0.42;
  const U = (u) => r[0] + (r[2] - r[0]) * u, V = (v) => r[1] + (r[3] - r[1]) * (1 - v);
  for (let k = 0; k < 3; k++) {
    const a = (Math.PI / 3) * k + Math.PI / 6, dx = Math.cos(a) * w, dz = Math.sin(a) * w;
    rb.quad(
      [[cx - dx, y, cz - dz], [cx + dx, y, cz + dz], [cx + dx, y + h, cz + dz], [cx - dx, y + h, cz - dz]],
      [[U(0), V(1)], [U(1), V(1)], [U(1), V(0)], [U(0), V(0)]], // (V : 0 = haut de l'image)
    );
  }
}

// Levier : socle de pierre (petit prisme hexagonal) et manche en bois incliné, d'un côté
// quand il est baissé, de l'autre quand il est levé (activé : bout rouge de voltite)
function drawLever(mb, rb, uv, id, cx, cz, y) {
  const on = id === 80, base = 0.14, s = 0.62;
  const stone = uv.cobblestone;
  mb.cap(cx, y + base, cz, s, stone.cap, null, true);
  mb.cap(cx, y, cz, s, stone.cap, null, false);
  const r = stone.rect, vb = r[1] + (r[3] - r[1]) * 0.86;
  const band = [r[2], vb, r[0], vb, r[0], r[3], r[2], r[3]];
  for (let i = 0; i < 6; i++) mb.side(i, cx, cz, y, y + base, s, band, 1, 1, 1, 1);
  // manche : prisme carré le long de d (incliné de 40° vers +x ou -x)
  const a = (on ? 1 : -1) * 0.7, L = 0.62, w = 0.055;
  const d = [Math.sin(a), Math.cos(a), 0], e1 = [0, 0, 1], e2 = [Math.cos(a), -Math.sin(a), 0];
  const o = [cx, y + base, cz];
  const P = (t, u, v) => [0, 1, 2].map((k) => o[k] + d[k] * t + e1[k] * u + e2[k] * v);
  const wood = uv.oak_log.rect;
  const U = (u) => wood[0] + (wood[2] - wood[0]) * u, V = (v) => wood[1] + (wood[3] - wood[1]) * (1 - v);
  const tw = [[U(0.42), V(0)], [U(0.42), V(1)], [U(0.58), V(1)], [U(0.58), V(0)]];
  const sides = [[w, w], [w, -w], [-w, -w], [-w, w]];
  for (let k = 0; k < 4; k++) {
    const [u0, v0] = sides[k], [u1, v1] = sides[(k + 1) % 4];
    rb.quad([P(0, u0, v0), P(L, u0, v0), P(L, u1, v1), P(0, u1, v1)], tw);
  }
  // bout du manche : bois, ou rouge vif quand le levier donne du courant
  const tip = uv[on ? 'wire_dot_on' : 'oak_log_top'].rect;
  const T = (u, v) => [tip[0] + (tip[2] - tip[0]) * u, tip[1] + (tip[3] - tip[1]) * v];
  rb.quad([P(L, w, w), P(L, w, -w), P(L, -w, -w), P(L, -w, w)], [T(0.3, 0.3), T(0.7, 0.3), T(0.7, 0.7), T(0.3, 0.7)]);
}

// ---------- Bloc simplifié (LOD) ----------
// u : { s (taille en chunks : 1, 2 ou 4), cq, cr }. src : objet avec surface(q, r).
// Petit ensemble de blocs hors de la grille du monde (TNT allumée, objet collé) :
// blocks = [[q, r, y, id], ...] en coordonnées locales. Faces cachées entre blocs retirées.
export function buildBlocksArrays(blocks, uv) {
  const mb = new MeshBuilder();
  const at = new Map();
  for (const [q, r, y, id] of blocks) at.set(q + ',' + r + ',' + y, id);
  const opaque = (q, r, y) => OPAQUE[at.get(q + ',' + r + ',' + y) || 0];
  const W = SIZE * Math.sqrt(3);
  for (const [q, r, y, id] of blocks) {
    const b = BLOCKS[id];
    if (!b) continue;
    const cx = W * (q + r / 2), cz = SIZE * 1.5 * r;
    const near = (dq, dr, dy) => at.get((q + dq) + ',' + (r + dr) + ',' + (y + dy)) || AIR;
    if (b.vslab !== undefined) { drawVSlab(mb, uv, id, cx, cz, y, near); continue; }
    if (b.dslab) { drawDoubleSlab(mb, uv, id, cx, cz, y, near); continue; }
    if (SLAB[id]) {
      drawSlab(mb, uv, id, cx, cz, y, (dq, dr, dy) => at.get((q + dq) + ',' + (r + dr) + ',' + (y + dy)) || AIR);
      continue;
    }
    if (b.shape === 'chest') { drawChest(mb, uv, id, cx, cz, y); continue; }
    if (b.shape === 'piston_head') { drawPistonHead(mb, uv, id, cx, cz, y); continue; }
    if (b.shape === 'pod') { drawPod(mb, uv, id, cx, cz, y, near); continue; }
    if (!OPAQUE[id]) continue;
    if (!opaque(q, r, y + 1)) mb.cap(cx, y + 1, cz, 1, uv[b.top].cap, null, true);
    if (!opaque(q, r, y - 1)) mb.cap(cx, y, cz, 1, uv[b.bottom].cap, null, false);
    for (let i = 0; i < 6; i++) {
      if (opaque(q + NEIGHBORS[i][0], r + NEIGHBORS[i][1], y)) continue;
      mb.side(i, cx, cz, y, y + 1, 1, uv[sideTex(b, i)].side, 1, 1, 1, 1);
    }
  }
  return mb.ind.length ? mb.arrays() : null;
}

// Objet collé : blocs pleins, rails et torches, en coordonnées locales.
// Renvoie { opaque, rails, glow, lights } (chacun peut être null).
export function buildStructArrays(blocks, uv) {
  const at = new Map();
  for (const [q, r, y, id] of blocks) at.set(q + ',' + r + ',' + y, id);
  const get = (q, r, y) => at.get(q + ',' + r + ',' + y) || AIR;
  const full = blocks.filter(([, , , id]) => OPAQUE[id] || SLAB[id] || BLOCKS[id]?.shape);
  const rb = new MeshBuilder(), gb = new MeshBuilder(), lights = [];
  for (const [q, r, y, id] of blocks) {
    const { x: cx, z: cz } = hexToWorld(q, r);
    if (BLOCKS[id]?.track !== undefined || BLOCKS[id]?.prop) continue;
    if (isRail(id)) drawRail(rb, uv, id, railShape(get, q, r, y), cx, cz, y);
    else if (isTorch(id)) drawTorch(gb, uv, id, cx, cz, y, lights);
    else if (BLOCKS[id]?.glass) drawGlass(rb, uv, id, cx, cz, y, (dq, dr, dy) => get(q + dq, r + dr, y + dy));
    else if (isWire(id)) drawWire(rb, uv, id, cx, cz, y, (dq, dr, dy) => get(q + dq, r + dr, y + dy));
    else if (BLOCKS[id]?.sapling) drawPlant(rb, uv, id, cx, cz, y);
    else if (isLever(id)) drawLever(rb, rb, uv, id, cx, cz, y); // (socle avec le manche)
    else if (isRepeater(id)) drawRepeater(rb, gb, uv, id, cx, cz, y);
    // blocs qui éclairent (lampe allumée...) : comme dans le monde
    if (BLOCKS[id]?.light && !isTorch(id)) lights.push(cx, y + 0.6, cz, BLOCKS[id].light);
  }
  return {
    opaque: full.length ? buildBlocksArrays(full, uv) : null,
    rails: rb.ind.length ? rb.arrays() : null,
    glow: gb.ind.length ? gb.arrays() : null,
    lights,
  };
}

export function buildLodArrays(src, u, uv) {
  const step = lodStep(u.s);
  const span = u.s * CS;
  const q0 = u.cq * CS, r0 = u.cr * CS;
  const mb = new MeshBuilder();
  const wb = new WaterBuilder();
  const inside = (q, r) => q >= q0 && q < q0 + span && r >= r0 && r < r0 + span;
  // surface de chaque colonne, gardée le temps du calcul (celle d'un grand hexa sert aussi à ses 6
  // voisins : 7 fois moins de calculs)
  const seen = new Map();
  const surfaceAt = (q, r) => {
    const k = q * 4194304 + r;
    let sf = seen.get(k);
    if (!sf) { sf = src.surface(q, r); seen.set(k, sf); }
    return sf;
  };
  // Ancien monde plat : vu d'en dessous (entre sa bedrock en 0 et le monde plat d'en bas), le
  // terrain simplifié a aussi un plafond (le dessous de la bedrock) et un sol (l'herbe d'en bas),
  // sombres comme sous terre ; sans eux, on voyait au travers
  const under = src.gen?.type === 'flat' && src.gen.version < FLAT_LOW;
  const DARK = [0.04, 0.04, 0.04, 0.04, 0.04, 0.04];

  for (let b = 0; b < span; b += step) {
    for (let a = 0; a < span; a += step) {
      const q = q0 + a, r = r0 + b;
      const sf = surfaceAt(q, r);
      if (sf.fh < Y_MIN) continue; // (colonne vide)
      // le terrain simplifié suit le fond (sous l'eau), l'eau est ajoutée par-dessus
      const h = sf.fh, blk = BLOCKS[sf.fid];
      const { x: cx, z: cz } = hexToWorld(q, r);
      // Les grands hexas du bord ne suivent pas exactement le bord en zigzag du bloc :
      // on les agrandit un peu pour boucher les fentes, et toute la surface simplifiée
      // est très légèrement plus basse que le terrain détaillé (pas de scintillement).
      let border = false;
      for (let i = 0; i < 6 && !border; i++) border = !inside(q + NEIGHBORS[i][0] * step, r + NEIGHBORS[i][1] * step);
      const s = border ? step * 1.5 : step;
      const top = h + 1 - LOD_DROP;
      mb.cap(cx, top, cz, s, uv[blk.top].cap, null, true);
      if (under) {
        mb.cap(cx, LOD_DROP, cz, s, uv.bedrock.cap, DARK, false);
        mb.cap(cx, FLAT_LOW_Y + 1 - LOD_DROP, cz, s, uv.grass_top.cap, DARK, true);
      }
      if (isWater(sf.id)) {
        const d = sf.h - sf.fh, wy = sf.h + WATER_TOP - LOD_DROP;
        wb.cap(cx, [wy, wy, wy, wy, wy, wy], cz, s, [d, d, d, d, d, d], 0, 0, isIceWater(sf.id) ? 1 : 0);
      }

      for (let i = 0; i < 6; i++) {
        const nq = q + NEIGHBORS[i][0] * step, nr = r + NEIGHBORS[i][1] * step;
        const hn = surfaceAt(nq, nr).fh;
        // au bord du bloc on prolonge vers le bas ("jupe") pour cacher les jointures (plus
        // profonde pour les grands hexas : le bloc voisin, plus ou moins détaillé, ne tombe pas
        // pile à la même hauteur ; sans elle, on voyait le ciel par des fentes en montagne)
        // (au bord : le bloc voisin a ses propres grands hexas, centrés ailleurs ; on descend sous
        // le plus bas des points entre ici et deux pas plus loin, sinon on voyait le vide par une
        // fente entre les deux)
        let bottom = hn;
        if (!inside(nq, nr)) {
          const dq = NEIGHBORS[i][0], dr = NEIGHBORS[i][1], st = Math.max(1, step >> 1);
          for (let k = 1; k <= step * 2; k += k < st ? st - 1 || 1 : st) bottom = Math.min(bottom, surfaceAt(q + dq * k, r + dr * k).fh);
          bottom = Math.min(bottom, h - 3 - step) - 1;
        }
        // (jamais sous la couche 0 pour un terrain au-dessus : sous la bedrock d'un ancien monde
        // plat, ou dans une grotte des profondeurs, on voyait ces jupes pendre en grillage)
        if (h >= 0 && bottom < 0) bottom = 0;
        if (bottom >= h) continue;
        mb.side(i, cx, cz, h - LOD_DROP, top, s, uv[sideTex(blk, i)].side, 1, 1, 1, 1);
        if (h > bottom + 1) {
          // grandes falaises (montagnes de 100 blocs) : en tronçons, sinon la texture serait étirée
          // (sous la pierre et la neige des montagnes : de la pierre, pas de la terre)
          const rock = sf.fid === 3 || sf.fid === 37 || h - bottom > 4;
          const tex = uv[rock ? 'stone' : 'dirt'].side, seg = step * 2;
          for (let y0 = bottom + 1; y0 < h; y0 += seg) mb.side(i, cx, cz, y0 - LOD_DROP, Math.min(h, y0 + seg) - LOD_DROP, s, tex, 1, 1, 1, 1);
        }
      }
    }
  }

  bakeTorchLight(mb, torchesAround(src, q0, r0, span));
  return { opaque: mb.compactArrays(), water: wb.arrays() };
}
