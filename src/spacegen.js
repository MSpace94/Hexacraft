// L'espace et les autres astres dans le monde : il n'y a qu'un seul monde (voir main.js, gen.js),
// une immense carte de blocs découpée en zones, selon la coordonnée q :
//  - zone 0 : la planète d'origine ;
//  - zones 1 à 10 : les autres astres solides, chacun à ZONE blocs du précédent (leur propre terrain,
//    voir planetgen.js) ;
//  - le vide (VOID_Q) : des « bulles » de SLOT blocs de côté, chacune posée quelque part dans le
//    système (voir spaceflight.js). Rien que le vide, on y construit ce qu'on veut ;
//  - les astéroïdes (ROCK_Q) : chaque astéroïde des ceintures a sa place, calculée à partir de sa
//    cellule : tous les joueurs (et tous les threads) la trouvent sans rien se dire. Ce sont de
//    vrais blocs, à miner ou à habiter.
// Tout tient donc dans les mêmes chunks, les mêmes sauvegardes, le même multijoueur : passer d'un
// astre à l'autre n'est qu'un déplacement sur cette carte, sans rien charger ni recharger.
// Ce fichier ne dépend que de system.js : les threads de génération le lisent aussi.
import { BELTS, BODY, CUSTOM } from './system.js?v=1.1.5-alpha-mwgq2wrb';
import { ruinBlock, RUIN_BOX } from './station.js?v=1.1.5-alpha-mwgq2wrb';

const AIR = 0;
const STONE = 3, GRAVEL = 244, IRON = 60, PLATINUM = 83, TUNGSTEN = 85, FLUORITE = 640, VOLTITE = 61, COAL = 30,
  REGOLITH = 3969, MOON_ROCK = 3970, BASALT = 68, ICE = 3973;
const SQ3 = Math.sqrt(3) / 2;

// ---------- Les zones ----------
export const ZONE = 1e8;                  // (multiples de 16 : les chunks restent alignés)
export const VOID_Q = 2 ** 34, SLOT = 2 ** 22;
export const ROCK_Q = 2 ** 41, ROCK_SLOT = 4096;
const LAND = ['magmara', 'soufra', 'lune', 'ocra', 'brasia', 'azura', 'glacia', 'nox', 'vesper', 'pelagia', 'pxt3', 'pxt1', 'pxt2', 'eldra', 'lunule', 'glacyon', 'cinder', 'voss', 'halo', 'tessel', 'ash', 'pale', 'orrin', 'perse', 'lethe']; // (à la fin : les zones existantes ne bougent pas)
// les planètes des systèmes ajoutés (src/systemes) : chacune à sa zone, de 40 à 169 (voir
// customsys.assignZones : elle ne bouge pas quand on en ajoute ou en retire d'autres)
for (const b of CUSTOM.bodies) if (b.gen) LAND[b.zone - 1] = b.id;
export const Z_VOID = -1, Z_ROCK = -2;
// zone d'une colonne : 0 (origine), 1 à 8 (astres), Z_VOID, Z_ROCK
export function zoneOfQ(q) {
  if (q >= ROCK_Q - ROCK_SLOT) return Z_ROCK;
  if (q >= VOID_Q - SLOT) return Z_VOID;
  const k = Math.round(q / ZONE);
  return k >= 1 && k <= LAND.length && LAND[k - 1] ? k : 0;
}
export const zoneOfXZ = (x, z) => zoneOfQ(x - z / (2 * SQ3));
export const zoneBody = (k) => (k > 0 ? BODY[LAND[k - 1]] : k === 0 ? BODY.hexa : null);
export const bodyZone = (id) => LAND.indexOf(id) + 1; // (0 : l'origine)
export const LAND_IDS = () => LAND.filter(Boolean);
// Une bulle du vide : la case de la carte qui contient (q, r)
export const slotOfQR = (q, r) => {
  const ix = Math.round((q - VOID_Q) / SLOT), iz = Math.round(r / SLOT);
  return { ix, iz, q0: VOID_Q + ix * SLOT, r0: iz * SLOT };
};
// Le point zéro de l'endroit (x, z) : les autres astres, les bulles du vide et les astéroïdes sont
// rangés très loin sur la carte ; F3, /tp et la carte du monde comptent depuis leur propre origine,
// pour garder des nombres lisibles. name : null sur la planète d'origine
export function localOrigin(x, z) {
  const k = zoneOfXZ(x, z), r = z / SQ3, q = x - r / 2;
  let q0 = 0, r0 = 0, name = null;
  if (k > 0) { q0 = k * ZONE; name = zoneBody(k)?.name || null; }
  else if (k === Z_VOID) { ({ q0, r0 } = slotOfQR(q, r)); name = 'espace'; }
  else if (k === Z_ROCK) { const R = rockOfQR(q, r); if (R) { q0 = R.q0; r0 = R.r0; } name = 'astéroïde'; }
  return { x0: q0 + r0 / 2, z0: r0 * SQ3, q0, r0, name };
}
export const slotAt = (ix, iz) => ({ ix, iz, q0: VOID_Q + ix * SLOT, r0: iz * SLOT });
// La station Hexa-Zéro en ruine : une bulle du vide réservée (les bulles tirées au hasard restent
// sous 4000), en orbite autour de PXT-1 à dist rayons de son centre (voir spaceflight.js)
export const RUIN = { ix: 4096, iz: 4096, ref: 'pxt1', dist: 3, name: 'Hexa-Zéro (ruine)' };
export const isRuinSlot = (s) => s.ix === RUIN.ix && s.iz === RUIN.iz;

// ---------- Les astéroïdes des ceintures (les mêmes partout) ----------
export const ROCK_CELL = 2500;
export const rockHash = (a, b, c, s) => { const h = Math.sin(a * 127.1 + b * 311.7 + c * 74.7 + s * 19.3) * 43758.5453; return h - Math.floor(h); };
export const inBelt = (x, y, z, pad = 5000) => {
  const rad = Math.hypot(x, z);
  return BELTS.some(([a, b, h]) => rad > a - pad && rad < b + pad && Math.abs(y) < h);
};
// Les astéroïdes des cellules autour du point (x, y, z) (repère de l'étoile) :
// [{ x, y, z (centre), rx, ry, rz (rayons), k (graine), ice }]
export function rocksNear(x, y, z, reach = 1, out = []) {
  out.length = 0;
  if (!inBelt(x, y, z)) return out;
  const cx = Math.floor(x / ROCK_CELL), cy = Math.floor(y / ROCK_CELL), cz = Math.floor(z / ROCK_CELL);
  for (let i = -reach; i <= reach; i++) for (let j = -reach; j <= reach; j++) for (let k = -reach; k <= reach; k++) {
    const a = cx + i, b = cy + j, c = cz + k;
    for (let m = 0; m < 5; m++) {
      if (rockHash(a, b, c, m) > 0.6) continue;
      const s = 4 + rockHash(a, b, c, m + 40) ** 3 * 120;
      out.push({
        x: (a + rockHash(a, b, c, m + 10)) * ROCK_CELL, y: (b + rockHash(a, b, c, m + 20)) * ROCK_CELL, z: (c + rockHash(a, b, c, m + 30)) * ROCK_CELL,
        rx: s * (0.7 + rockHash(a, b, c, m + 50) * 0.6), ry: s, rz: s * (0.7 + rockHash(a, b, c, m + 60) * 0.6),
        k: Math.floor(rockHash(a, b, c, m + 70) * 1e6), ice: Math.hypot(x, z) > 5e8 || rockHash(a, b, c, m + 80) < 0.15,
        a, b, c, m,
      });
    }
  }
  return out;
}

// La place d'un astéroïde sur la carte (de sa cellule a, b, c et de son numéro m)
const A0 = 600000, B0 = 9000;
export function rockSlot(a, b, c, m) {
  const bb = b + B0, u = (a + A0) * 300 + (bb % 300), v = (c + A0) * 300 + Math.floor(bb / 300) * 5 + m;
  return { u, v, q0: ROCK_Q + u * ROCK_SLOT, r0: v * ROCK_SLOT };
}
export function rockOfQR(q, r) {
  const u = Math.round((q - ROCK_Q) / ROCK_SLOT), v = Math.round(r / ROCK_SLOT);
  const w = v % 300;
  const a = Math.floor(u / 300) - A0, c = Math.floor(v / 300) - A0, m = w % 5, b = Math.floor(w / 5) * 300 + (u % 300) - B0;
  if (rockHash(a, b, c, m) > 0.6) return null;
  const s = 4 + rockHash(a, b, c, m + 40) ** 3 * 120;
  const x = (a + rockHash(a, b, c, m + 10)) * ROCK_CELL, y = (b + rockHash(a, b, c, m + 20)) * ROCK_CELL, z = (c + rockHash(a, b, c, m + 30)) * ROCK_CELL;
  return {
    x, y, z, rx: s * (0.7 + rockHash(a, b, c, m + 50) * 0.6), ry: s, rz: s * (0.7 + rockHash(a, b, c, m + 60) * 0.6),
    k: Math.floor(rockHash(a, b, c, m + 70) * 1e6), ice: Math.hypot(x, z) > 5e8 || rockHash(a, b, c, m + 80) < 0.15,
    a, b, c, m, u, v, q0: ROCK_Q + u * ROCK_SLOT, r0: v * ROCK_SLOT,
  };
}

// Le terrain d'une bulle ou d'un astéroïde
export class SiteTerrain {
  // rocks : les astéroïdes de cette place, autour de son centre (aucun : le vide)
  constructor(rocks, { H, DEPTH }) {
    this.H = H;
    this.DEPTH = DEPTH;
    this.sea = -999;
    this.v3 = false;
    this.versionAt = () => 14;
    this.rocks = rocks;
  }

  // le bloc en (q, r, y) : dans un astéroïde, ou le vide
  block(q, r, y) {
    if (!this.rocks.length) return AIR;
    const x = q + r / 2, z = r * SQ3;
    for (const R of this.rocks) {
      const b = this.rockBlock(R, x, y + 0.5, z, q, r, y);
      if (b) return b;
    }
    return AIR;
  }
  rockBlock(R, x, y, z, q, r, yi) {
    const dx = (x - R.x) / R.rx, dy = (y - R.y) / R.ry, dz = (z - R.z) / R.rz;
    const f = dx * dx + dy * dy + dz * dz;
    if (f > 1.6) return 0;
    // un relief bosselé (cratères, bosses)
    const k = R.k;
    const n = 0.14 * Math.sin(x * 0.21 + k) * Math.sin(y * 0.17 + k * 0.3) * Math.sin(z * 0.19 + k * 0.7)
      + 0.08 * Math.sin(x * 0.53 + y * 0.31 + k) * Math.cos(z * 0.47 - y * 0.29);
    const lim = (1 + n) * (1 + n);
    if (f > lim) return 0;
    const depth = (1 - Math.sqrt(f / lim)) * Math.min(R.rx, R.ry, R.rz); // (blocs sous la surface)
    if (R.ice && depth < 3) return ICE;
    if (depth < 1.5) return REGOLITH;
    if (depth < 3) return GRAVEL;
    const h = rockHash(q, r, yi, k);
    if (h < 0.012) return IRON;
    if (h < 0.018) return PLATINUM;
    if (h < 0.023) return TUNGSTEN;
    if (h < 0.027) return FLUORITE;
    if (h < 0.03) return VOLTITE;
    if (h < 0.035) return COAL;
    if (R.ice && h < 0.2) return ICE;
    return h < 0.5 ? MOON_ROCK : h < 0.8 ? STONE : BASALT;
  }

  fillChunk(data, q0, r0, CS, idx) {
    if (!this.rocks.length) return;
    const x0 = q0 + r0 / 2, z0 = r0 * SQ3, w = CS * 1.5 + 2;
    for (const R of this.rocks) {
      const ext = Math.max(R.rx, R.ry, R.rz) * 1.3 + 2;
      if (R.x + ext < x0 - 2 || R.x - ext > x0 + w || R.z + ext < z0 - 2 || R.z - ext > z0 + w) continue;
      const ylo = Math.max(-this.DEPTH, Math.floor(R.y - R.ry * 1.3) - 1), yhi = Math.min(this.H - 1, Math.ceil(R.y + R.ry * 1.3) + 1);
      for (let lr = 0; lr < CS; lr++) {
        for (let lq = 0; lq < CS; lq++) {
          const q = q0 + lq, r = r0 + lr, x = q + r / 2, z = r * SQ3;
          if (Math.abs(x - R.x) > ext || Math.abs(z - R.z) > ext) continue;
          for (let y = ylo; y <= yhi; y++) {
            const b = this.rockBlock(R, x, y + 0.5, z, q, r, y);
            if (b) data[idx(lq, lr, y)] = b;
          }
        }
      }
    }
  }

  // le dessus d'une colonne (le plus haut bloc d'astéroïde, sinon le centre du site)
  height(q, r) {
    for (let y = this.H - 1; y > -this.DEPTH && this.rocks.length; y--) if (this.block(q, r, y)) return y;
    return 0;
  }
  surface(q, r) {
    const h = this.height(q, r), id = this.block(q, r, h);
    return id ? { h, id, fh: h, fid: id } : { h: -this.DEPTH - 1, id: AIR, fh: -this.DEPTH - 1, fid: AIR }; // (colonne vide)
  }
  terrain() { return AIR; }
  biomeAt() { return 3; }
  isCold() { return true; }
  isMineChest() { return false; }
  hexCavesNear() { return []; }
  hexCaveBlock() { return -1; }
  columnAt(x, z) { return { h: 0, biome: 3, snow: false, lava: false, ice: false, sea: false }; }
  findSpawn() { return { q: 0, r: 0, y: 0 }; }
}

// Le terrain de la bulle de la station en ruine (voir station.js)
export class RuinTerrain extends SiteTerrain {
  constructor(opt) { super([], opt); }
  block(q, r, y) { return ruinBlock(q, r, y); }
  fillChunk(data, q0, r0, CS, idx) {
    const B = RUIN_BOX;
    for (let lr = 0; lr < CS; lr++) {
      for (let lq = 0; lq < CS; lq++) {
        const q = q0 + lq, r = r0 + lr, x = q + r / 2, z = r * SQ3;
        if (x < B.x0 || x > B.x1 || z < B.z0 || z > B.z1) continue;
        for (let y = B.y0; y <= B.y1; y++) {
          const b = ruinBlock(q, r, y);
          if (b) data[idx(lq, lr, y)] = b;
        }
      }
    }
  }
  height(q, r) {
    for (let y = RUIN_BOX.y1; y >= RUIN_BOX.y0; y--) if (ruinBlock(q, r, y)) return y;
    return 0;
  }
  surface(q, r) {
    const h = this.height(q, r), id = ruinBlock(q, r, h);
    return id ? { h, id, fh: h, fid: id } : { h: -this.DEPTH - 1, id: AIR, fh: -this.DEPTH - 1, fid: AIR };
  }
}
