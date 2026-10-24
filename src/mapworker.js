// Thread de la carte du monde : dessine des tuiles vues du dessus (biomes + relief
// ombré) pour une graine donnée, sans ralentir le jeu.
import { Generator, BIOME, BIOME_COLORS, SAND, WORLD_HEIGHT, GEN_CONTENT } from './gen.js?v=1.1.5-alpha-mvm2b95g';
import { worldToHex } from './hex.js?v=1.1.5-alpha-mvm2b95g';

const TILE_PX = 128;
const SNOW_COLOR = [238, 244, 248];
const LAVA_COLOR = [255, 110, 20];
const ICE_COLOR = [150, 210, 240]; // eau glaciale

let gen = null;
let genKey = '';

// old : chunks déjà visités avant le monde surélevé ("cq,cr"), envoyés une fois par monde
function setup(type, seed, version, old) {
  const key = type + '|' + seed + '|' + version;
  if (key !== genKey) {
    genKey = key;
    gen = new Generator(type, seed, WORLD_HEIGHT, version);
    gen.versionAt = (q, r) => (gen.oldSet.has(Math.floor(q / 16) + ',' + Math.floor(r / 16)) ? 6 : GEN_CONTENT);
  }
  if (old) gen.setOldChunks(old.map((k) => [k, 6]));
}

// Hauteur et biome au point (x, z) du monde.
function sample(x, z) {
  if (gen.v3) return gen.columnAt(x, z);
  const { q, r } = worldToHex(x, z);
  const h = gen.height(q, r);
  if (gen.type === 'flat') return { h, biome: BIOME.PLAINS };
  const top = gen.terrain(h, h);
  let biome = BIOME.PLAINS;
  if (h < gen.sea) biome = h < gen.sea - 6 ? BIOME.OCEAN : BIOME.SEA;
  else if (top === SAND) biome = BIOME.BEACH;
  else if (h > 38) biome = BIOME.MOUNTAIN;
  return { h, biome };
}

function drawTile(tx, tz, scale) {
  const N = TILE_PX;
  const hs = new Float32Array((N + 1) * (N + 1));
  const bs = new Uint8Array((N + 1) * (N + 1));
  const sn = new Uint8Array((N + 1) * (N + 1)); // sommets enneigés
  const seas = new Uint8Array((N + 1) * (N + 1)); // niveau de la mer (ancien ou surélevé)
  // une ligne et une colonne de plus (au nord-ouest) pour l'ombrage du relief
  const x0 = tx * N * scale, z0 = tz * N * scale;
  for (let j = 0; j <= N; j++) {
    for (let i = 0; i <= N; i++) {
      const s = sample(x0 + (i - 1) * scale, z0 + (j - 1) * scale);
      hs[j * (N + 1) + i] = s.h;
      bs[j * (N + 1) + i] = s.biome;
      sn[j * (N + 1) + i] = (s.snow || 0) | ((s.lava || 0) << 1) | (s.ice ? 4 : 0);
      seas[j * (N + 1) + i] = s.sea ?? gen.sea;
    }
  }
  const px = new Uint8ClampedArray(N * N * 4);
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const k = (j + 1) * (N + 1) + (i + 1), sea = seas[k];
      const h = hs[k], b = bs[k];
      const c = sn[k] & 2 ? LAVA_COLOR : sn[k] & 4 ? ICE_COLOR : sn[k] ? SNOW_COLOR : BIOME_COLORS[b];
      let f;
      if (h < sea) {
        f = 0.75 + 0.25 * Math.max(0, 1 - (sea - h) / 16); // plus sombre au large
      } else {
        // lumière venant du nord-ouest : pentes éclairées / à l'ombre
        const d = (h - hs[k - (N + 1) - 1]) / scale;
        f = 0.9 + Math.max(-0.35, Math.min(0.35, d * 0.9)) + Math.min(60, h - sea) * 0.006;
        if (b === BIOME.MOUNTAIN && h > sea + 24 && !sn[k]) f += 0.25; // sommets clairs
      }
      const o = (j * N + i) * 4;
      px[o] = c[0] * f; px[o + 1] = c[1] * f; px[o + 2] = c[2] * f; px[o + 3] = 255;
    }
  }
  return px;
}

self.onmessage = (e) => {
  const m = e.data;
  if (m.type === 'tile') {
    setup(m.gtype, m.seed, m.version, m.old);
    const px = drawTile(m.tx, m.tz, m.scale);
    self.postMessage({ type: 'tile', key: m.key, px }, [px.buffer]);
  } else if (m.type === 'spawn') {
    setup(m.gtype, m.seed, m.version, m.old);
    self.postMessage({ type: 'spawn', key: m.key, spawn: gen.findSpawn() });
  }
};
