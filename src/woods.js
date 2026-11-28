// Les nouveaux bois (érable, noyer, bouleau alien, olivier, ginkgo, liquidambar) : pour chacun,
// une bûche, des feuilles, des planches, une pousse, un bâton et les 5 outils en bois (même
// palier que le bois). Partagé par blocks.js, survival.js, textures.js, nature.js, gen.js
// (dans les threads aussi : ni DOM ni three.js ici). Les arbres et leurs biomes : voir gen.js
// (woodTree) et biomes.js (WOOD_GEN).
//
// Les ids : à partir de 4310, 11 par bois (dans cet ordre) :
//   bûche, feuilles, planches, feuilles posées, pousse, bâton, pioche, hache, pelle, épée, houe
// puis les sols de leurs biomes (litière de feuilles, herbe sèche).
// Ne jamais changer l'ordre des bois (les ids en dépendent) : ajouter les nouveaux à la fin.

// key : préfixe des textures ; dir : dossier de texture/blocs ; tools : dossier de texture/outils
// de : « Bûche de … », en : « Pioche en … » ; evergreen : garde ses feuilles en hiver
// color : couleurs de secours [écorce, cernes, feuilles, planches] (si une image manque)
export const WOODS = [
  { key: 'maple', dir: 'erable', nom: 'érable', de: "d'érable", en: 'en érable', color: ['#5e5550', '#c8955e', '#c0402a', '#c48a5a'] },
  { key: 'walnut', dir: 'noyer', nom: 'noyer', de: 'de noyer', en: 'en noyer', color: ['#4a3a2e', '#8a6440', '#3e6a2a', '#6a4a30'] },
  { key: 'alien_birch', dir: 'bouleau_alien', nom: 'bouleau alien', de: 'de bouleau alien', en: 'en bouleau alien', color: ['#d8dcc8', '#c8c08a', '#9ab83e', '#d4cfa0'] },
  { key: 'olive', dir: 'olivier', nom: 'olivier', de: "d'olivier", en: 'en olivier', evergreen: true, color: ['#7a6a52', '#c0a670', '#7a8a52', '#b89a68'] },
  { key: 'ginkgo', dir: 'ginkgo', nom: 'ginkgo', de: 'de ginkgo', en: 'en ginkgo', color: ['#6a5a48', '#d0b07a', '#e0b830', '#d2b07c'] },
  { key: 'liquidambar', dir: 'liquidambar', nom: 'liquidambar', de: 'de liquidambar', en: 'en liquidambar', color: ['#5c4a3e', '#f0b040', '#c8501e', '#b06a40'] },
];
export const WOOD_BASE = 4310, WOOD_IDS = 11;
// rang de chaque pièce dans les 11 ids d'un bois
export const W = { LOG: 0, LEAVES: 1, PLANKS: 2, LEAVES_PLACED: 3, SAPLING: 4, STICK: 5, PICKAXE: 6, AXE: 7, SHOVEL: 8, SWORD: 9, HOE: 10 };
WOODS.forEach((w, i) => {
  w.base = WOOD_BASE + i * WOOD_IDS;
  for (const [k, n] of Object.entries(W)) w[k] = w.base + n;
});
export const [MAPLE, WALNUT, ALIEN_BIRCH, OLIVE, GINKGO, LIQUIDAMBAR] = WOODS;
// sols des biomes : litière de feuilles (forêt d'automne), herbe sèche (savane, oliveraie)
export const LEAF_LITTER = WOOD_BASE + WOODS.length * WOOD_IDS, DRY_GRASS = LEAF_LITTER + 1;

// Le bois d'un id (bûche, feuilles, pousse, bâton, outil…), ou null
export const woodOf = (id) => (id >= WOOD_BASE && id < LEAF_LITTER ? WOODS[Math.floor((id - WOOD_BASE) / WOOD_IDS)] : null);

const TOOL_NAMES = [['PICKAXE', 'Pioche', 'pickaxe'], ['AXE', 'Hache', 'axe'], ['SHOVEL', 'Pelle', 'shovel'], ['SWORD', 'Épée', 'sword'], ['HOE', 'Houe', 'hoe']];

// Les blocs (pour BLOCKS, voir blocks.js)
export function woodBlocks() {
  const out = {};
  for (const w of WOODS) {
    const k = w.key;
    out[w.LOG] = { name: 'Bûche ' + w.de, top: k + '_log_top', side: k + '_log', bottom: k + '_log_top', log: true };
    out[w.LEAVES] = { name: 'Feuilles ' + w.de, top: k + '_leaves', side: k + '_leaves', bottom: k + '_leaves', leaves: true, placedAs: w.LEAVES_PLACED };
    out[w.PLANKS] = { name: 'Planches ' + w.de, top: k + '_planks', side: k + '_planks', bottom: k + '_planks' };
    out[w.LEAVES_PLACED] = { name: 'Feuilles ' + w.de, top: k + '_leaves', side: k + '_leaves', bottom: k + '_leaves', hidden: true, pick: w.LEAVES };
    out[w.SAPLING] = { name: 'Pousse ' + w.de, top: k + '_sapling', side: k + '_sapling', bottom: k + '_sapling', sapling: true, wood: k, item: 'texture/plantes/' + k + '_sapling.png' };
  }
  out[LEAF_LITTER] = { name: 'Litière de feuilles', top: 'leaf_litter', side: 'leaf_litter_side', bottom: 'dirt' };
  out[DRY_GRASS] = { name: 'Herbe sèche', top: 'dry_grass', side: 'dry_grass_side', bottom: 'dirt' };
  return out;
}

// Les objets (pour ITEMS, voir blocks.js) : bâton et outils (palier du bois)
export function woodItems() {
  const out = {};
  for (const w of WOODS) {
    out[w.STICK] = { name: 'Bâton ' + w.de, icon: 'texture/objets/' + w.key + '_stick.png' };
    for (const [K, nom, f] of TOOL_NAMES) out[w[K]] = { name: nom + ' ' + w.en, icon: 'texture/outils/' + w.dir + '/' + f + '.png', tool: f, tier: 1, stack: 1 };
  }
  return out;
}

// Les textures (pour FILES, voir textures.js) : nom -> fichier de texture/
export function woodFiles() {
  const out = {};
  for (const w of WOODS) {
    for (const p of ['log', 'log_top', 'leaves', 'planks']) out[w.key + '_' + p] = 'blocs/' + w.dir + '/' + w.key + '_' + p + '.png';
    out[w.key + '_sapling'] = 'plantes/' + w.key + '_sapling.png';
  }
  for (const n of ['leaf_litter', 'leaf_litter_side', 'dry_grass', 'dry_grass_side']) out[n] = 'blocs/environnement/' + n + '.png';
  return out;
}
// couleurs de secours (si une image manque : la bûche de liquidambar en attendant la sienne)
export function woodFallback() {
  const out = { leaf_litter: '#b0562a', leaf_litter_side: '#8a5a36', dry_grass: '#c8b05a', dry_grass_side: '#8a5a36' };
  for (const w of WOODS) {
    const [bark, ring, leaves, planks] = w.color;
    Object.assign(out, { [w.key + '_log']: bark, [w.key + '_log_top']: ring, [w.key + '_leaves']: leaves, [w.key + '_planks']: planks, [w.key + '_sapling']: leaves });
  }
  return out;
}
