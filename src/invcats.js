// Onglets de l'inventaire créatif : chaque bloc ou objet va dans une catégorie, et y prend un
// rang (sa famille : les outils d'un même matériau ensemble, les dalles après leur bloc…).
// L'onglet « Tout » montre les catégories l'une après l'autre, dans cet ordre.
import { BLOCKS, ITEMS, PIPIENS_SOILS, ETHAN_SOILS } from './blocks.js?v=1.1.5-alpha-mwgq2wrb';
import { METALS } from './metals.js?v=1.1.5-alpha-mwgq2wrb';
import { ENV_BLOCKS, TOXIC_PLANKS, TERRACOTTA_Y, TERRACOTTA_O, TERRACOTTA_R, RUSTY_SCRAP } from './biomes.js?v=1.1.5-alpha-mwgq2wrb';
// nouveaux minerais (voir metals.js) : minerais et blocs (nature), lingots et poussières (industrie)
const METAL_ROCK = new Set(METALS.flatMap((m) => [m.ore, m.block]));
const METAL_ITEM = new Set(METALS.flatMap((m) => [m.product, m.dust].filter(Boolean)));
// blocs des nouveaux biomes (voir biomes.js) : nature, sauf ce qui sert à construire
const ENV_IDS = new Set(ENV_BLOCKS.map((b) => b[0]));
const ENV_BUILD = new Set([TOXIC_PLANKS, TERRACOTTA_Y, TERRACOTTA_O, TERRACOTTA_R, RUSTY_SCRAP]);

export const INV_TABS = [
  ['all', 'Tout'], ['build', 'Construction'], ['deco', 'Décoration'], ['nature', 'Nature'], ['food', 'Agriculture'],
  ['tools', 'Outils et armes'], ['elec', 'Électricité'], ['mech', 'Mécanique'], ['ind', 'Industrie'],
  ['train', 'Train'], ['space', 'Espace'], ['pc', 'PC'],
];
const ORDER = Object.fromEntries(INV_TABS.map(([k], i) => [k, i]));

const inRange = (id, a, b) => id >= a && id <= b;
const has = (name, ...words) => words.some((w) => name.includes(w));

// Outils : par matériau, du plus simple au plus fort (pioche, hache, pelle, épée, houe)
const TOOL_SETS = [105, 147, 158, 301, 111, 116, 306, 125, 134, 139, 646, 651];

const MECH = new Set([66, 81, 82, 198, 241, 279, 3930, 3931, 3941, 100, 101, 209, 240, 102, 3940]);
const ELEC = new Set([24, 63, 79, 94, 123, 132, 170, 182, 210, 222, 243, 267, 273, 3937, 3938, 311, 312, 313, 314, 315]);
const DECO = new Set([23, 194, 195, 443, 600, 601, 602, 607, 608, 609, 611, 613, 614, 621, 624, 630, 636, 3923]);
const FOOD = new Set([285, 613, 425, 426, 427, 428, 429, 430, 431, 163, 164, 441, 442]);
const SPACE_IDS = new Set([3951, 3952, 3953, 3962, 3968]);

// [catégorie, rang, place dans la famille (sinon : le numéro)] (cache : les pièces de PC et d'autres objets s'ajoutent au chargement)
const cache = new Map();
export function invCategory(id) {
  let c = cache.get(id);
  if (!c) { c = classify(id); cache.set(id, c); }
  return c;
}

function classify(id) {
  const b = BLOCKS[id], it = ITEMS[id], d = b || it || {};
  const name = d.name || '';
  if (it?.pc) return ['pc', 0];
  // (une dalle : juste après son bloc)
  if ((d.slab !== undefined || d.vslab !== undefined) && BLOCKS[d.full] && d.full !== id) { const c = invCategory(d.full); return [c[0], c[1], d.full + (d.vslab !== undefined ? 0.2 : 0.1)]; }
  if ([31, 42, 54].includes(id)) return ['build', 0]; // (établi, four, coffre)
  // ---- espace : fusées, station orbitale, nédrolytium ----
  if (SPACE_IDS.has(id) || inRange(id, 3960, 3968) || inRange(id, 3983, 3996)) {
    return ['space', id === 3953 || id === 3962 ? 0 : inRange(id, 3960, 3961) || id === 3983 ? 1 : inRange(id, 3963, 3967) || inRange(id, 3984, 3985) || id === 3996 ? 2 : id === 3968 ? 3 : 4];
  }
  // ---- lot liquides : moteurs de fusée (espace), flotteur (mécanique), le reste (industrie : liquides) ----
  // ---- armes (à main, munitions, en blocs) et boucliers ----
  if (inRange(id, 4300, 4302)) return ['tools', 33]; // (tourelles : avec les armes en blocs)
  if (inRange(id, 4270, 4296)) return ['tools', id <= 4274 ? 31 : id <= 4283 ? 32 : id <= 4289 || id === 4296 ? 33 : 34];
  // ---- étanchéité, mécanique (portes, soudure : mécanique ; train d'atterrissage : espace) ----
  if (inRange(id, 4244, 4268)) return ['mech', id <= 4256 ? 2 : 1];
  if (id === 4269) return ['space', 2];
  if (inRange(id, 4214, 4243)) return inRange(id, 4226, 4229) ? ['space', 2] : id === 4230 ? ['mech', 1] : ['ind', 5];
  // ---- train ----
  if ((id >= 456 && id <= 513) || (id >= 520 && id <= 596) || inRange(id, 663, 724) || inRange(id, 900, 918) || it?.train || it?.comp || [17, 19, 21, 565, 571, 577, 768].includes(id)) {
    // voies et signalisation, puis locomotives, tenders, voitures et wagons, puis pièces et composants
    if ([17, 19, 21, 456, 484, 565, 571, 577, 768].includes(id)) return ['train', 0];
    if (it?.train) return ['train', has(name, 'Locomotive', 'Pacific', 'Locotracteur', 'Draisine') ? 1 : has(name, 'Tender') ? 2 : 3];
    if (it?.comp) return ['train', 5];
    return ['train', 4];
  }
  // ---- outils et armes ----
  if (d.tool) {
    const k = TOOL_SETS.findIndex((s) => id >= s && id < s + 5);
    return ['tools', k < 0 ? 20 : k];
  }
  if (d.tnt && id !== 3959) return ['tools', 30];
  if (id > 4000 && id < 4064 && it?.doc) return ['tools', 41]; // (planchettes futuristes du lore)
  if ([121, 124, 3942, 3943, 3944, 316, 317, 318, 319, 320, 321, 328, 551, 664].includes(id) || d.wear) return ['tools', 40];
  if (d.egg || d.hexEgg) return ['food', 9];
  // ---- mécanique : objets collés, physique, pistons ----
  if (MECH.has(id)) return ['mech', [100, 101, 209, 240, 102, 3940, 3941].includes(id) ? 0 : 1];
  // ---- électricité : voltite, circuits, logique ----
  if (ELEC.has(id) || d.repeater || d.radio || d.lever) return ['elec', [123, 132, 63].includes(id) ? 0 : inRange(id, 311, 315) ? 1 : 2];
  // ---- industrie : matières, machines, énergie, liquides ----
  if (inRange(id, 3800, 3931) || inRange(id, 3954, 3959) || inRange(id, 3850, 3856) || inRange(id, 322, 327)) {
    if (inRange(id, 3850, 3856) || inRange(id, 322, 327)) return ['ind', 1];
    if (d.fluid) return ['ind', 5];
    if (d.power && !d.container && !d.machine && !d.funnel && !d.arm && !d.dock && !d.station && !d.splitter && !d.fan && !d.assembler) return ['ind', 2]; // (énergie)
    if (inRange(id, 3954, 3959)) return ['ind', 5];
    if (d.oldBelt || inRange(id, 3820, 3827) || d.funnel || d.splitter || d.fan || inRange(id, 3831, 3831)) return ['ind', 4];
    if (inRange(id, 3924, 3929)) return ['build', 6];
    if (d.machine || d.container || d.station || d.assembler) return ['ind', 3];
    return ['ind', 6];
  }
  if (METAL_ROCK.has(id)) return ['nature', 4];
  if (METAL_ITEM.has(id)) return ['ind', 0];
  if (ENV_IDS.has(id)) return ENV_BUILD.has(id) ? ['build', 3] : d.log || d.leaves ? ['nature', 2] : ['nature', 3];
  if ([104, 122, 130, 131, 644, 645, 103, 110, 133, 146, 157, 300].includes(id)) return ['ind', [103, 110, 133, 146, 157, 300].includes(id) ? 0.5 : 0];
  // ---- agriculture ----
  if (FOOD.has(id) || d.food) return ['food', d.food ? 2 : 1];
  // ---- décoration ----
  if (DECO.has(id) || d.torch || (d.light && b && !d.lava)) return ['deco', d.torch || d.light ? 0 : 1];
  if (b?.glass) return ['build', 5];
  // ---- nature : terrain, minerais, arbres, liquides, sols des planètes ----
  if (b && (d.log || d.leaves || d.sapling || d.liquid || d.lava || d.layer || inRange(id, 3969, 3982) || PIPIENS_SOILS.includes(id) || ETHAN_SOILS.includes(id) || [1, 2, 3, 4, 8, 30, 36, 37, 38, 60, 61, 62, 68, 69, 70, 71, 73, 74, 83, 84, 85, 86, 87, 244, 261, 603, 605, 616, 618, 626, 627, 632, 640, 641, 642, 643].includes(id))) {
    if (d.liquid || d.lava) return ['nature', 5];
    if (d.log || d.leaves || d.sapling) return ['nature', 2];
    if (inRange(id, 3969, 3982) || PIPIENS_SOILS.includes(id) || ETHAN_SOILS.includes(id)) return ['nature', 6];
    if ([68, 69, 70, 71, 73, 74].includes(id)) return ['nature', 3];
    if (has(name, 'Minerai') || has(name, 'Bloc de')) return ['nature', 4];
    return ['nature', 1];
  }
  // ---- construction ----
  if (b) {
    if (has(name, 'chêne', 'bouleau', 'châtaignier', 'tilleul', 'Parquet', 'Colombage', 'Chaume')) return ['build', 2];
    if (has(name, 'Brique')) return ['build', 3];
    if (has(name, 'acier', 'Acier', 'fer', 'Fer', 'Tôle', 'Métal', 'Cuivre', 'métal')) return ['build', 4];
    if (has(name, 'Toit', 'Tuiles', 'Ardoise')) return ['build', 4.5];
    return ['build', 1];
  }
  return ['tools', 50];
}

// Ordre d'affichage : catégorie, famille, puis numéro
export function invSort(a, b) {
  const A = invCategory(a), B = invCategory(b);
  return ORDER[A[0]] - ORDER[B[0]] || A[1] - B[1] || (A[2] ?? a) - (B[2] ?? b);
}
