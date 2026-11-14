// Les nouveaux biomes (HexaCraft : lot « environnement ») : leurs blocs (textures de
// texture/blocs/environnement) et leurs réglages, partagés par la génération (gen.js, dans les
// threads aussi : ce module n'a ni DOM ni three.js), les blocs (blocks.js), la survie et la météo.
//
// En surface (seulement dans les chunks créés depuis cette version : ENV_GEN, voir gen.js) :
//   mesa                 : certains déserts, sable rouge et buttes de terre cuite en couches
//   jungle toxique       : les forêts et plaines chaudes et humides, arbres toxiques, boue toxique
//   champignons géants   : de rares forêts tempérées, champignons de 8 à 13 blocs de haut
//   caldeira             : certains volcans effondrés : un grand cratère plat, un lac de lave,
//                          des arbres calcinés
//   montagnes flottantes : des îles de pierre flottante dans le ciel, au-dessus de certaines plaines
// Sous terre :
//   cavernes de glace    : sous les régions froides, de grandes cavernes de glace
//   grottes luxuriantes  : sous les forêts et la jungle, mousse, boue, champignons lumineux
//   l'Abysse             : le fond de l'abîme : pierre abyssale, blocs eldritch, sable irradié
export const ENV_GEN = 16; // (voir GEN_CONTENT dans gen.js)

// Les blocs (ids 4189 à 4213 : voir blocks.js)
export const MUD = 4189, TOXIC_MUD = 4190, CHARRED_WOOD = 4191, CHARRED_DIRT = 4192;
export const MUSH_CAP = 4193, MUSH_CAP_GLOW = 4194, MUSH_GILLS = 4195, MUSH_STEM = 4196;
export const RUSTY_SCRAP = 4197, TOXIC_LEAVES = 4198, TOXIC_LOG = 4199, TOXIC_PLANKS = 4200;
export const TOXIC_STONE = 4201, TOXIC_SAP = 4202, RED_SAND = 4203;
export const TERRACOTTA_Y = 4204, TERRACOTTA_O = 4205, TERRACOTTA_R = 4206;
export const IRRADIATED_SAND = 4207, ABYSS_STONE = 4208, FLOAT_STONE = 4209, CALDERA_STONE = 4210;
export const CRATER_STONE = 4211, ELDRITCH = 4212, TOXIC_LEAVES_PLACED = 4213;

// [id, texture, nom, matière (voir MATTER_OF dans survival.js), réglages du bloc]
export const ENV_BLOCKS = [
  [MUD, 'boue', 'Boue', 'dirt', {}],
  [TOXIC_MUD, 'boue_toxique', 'Boue toxique', 'dirt', {}],
  [CHARRED_WOOD, 'bois_carbonise', 'Bois calciné', 'wood', { log: true }],
  [CHARRED_DIRT, 'terre_carbonisee', 'Terre calcinée', 'dirt', {}],
  [MUSH_CAP, 'chapeau_champignon_geant', 'Chapeau de champignon géant', 'wood', {}],
  [MUSH_CAP_GLOW, 'chapeau_champignon_lumineux', 'Chapeau de champignon lumineux', 'wood', { light: 3 }],
  [MUSH_GILLS, 'lamelles_champignon', 'Lamelles de champignon', 'wood', {}],
  [MUSH_STEM, 'pied_champignon_geant', 'Pied de champignon géant', 'wood', {}],
  [RUSTY_SCRAP, 'ferraille_rouillee', 'Ferraille rouillée', 'stone', {}],
  [TOXIC_LEAVES, 'feuilles_toxiques', 'Feuilles toxiques', 'leaves', { leaves: true, placedAs: TOXIC_LEAVES_PLACED }],
  [TOXIC_LOG, 'tronc_toxique', 'Tronc toxique', 'wood', { log: true, top: 'tronc_toxique_dessus', bottom: 'tronc_toxique_dessus' }],
  [TOXIC_PLANKS, 'planches_toxiques', 'Planches toxiques', 'wood', {}],
  [TOXIC_STONE, 'pierre_toxique', 'Pierre toxique', 'stone', {}],
  [TOXIC_SAP, 'seve_toxique', 'Sève toxique', 'dirt', { light: 2 }],
  [RED_SAND, 'sable_rouge', 'Sable rouge', 'dirt', {}],
  [TERRACOTTA_Y, 'terre_cuite_jaune', 'Terre cuite jaune', 'stone', {}],
  [TERRACOTTA_O, 'terre_cuite_orange', 'Terre cuite orange', 'stone', {}],
  [TERRACOTTA_R, 'terre_cuite_rouge', 'Terre cuite rouge', 'stone', {}],
  [IRRADIATED_SAND, 'sable_irradie', 'Sable irradié', 'dirt', { light: 1 }],
  [ABYSS_STONE, 'pierre_abyssale', 'Pierre abyssale', 'hard', {}],
  [FLOAT_STONE, 'pierre_flottante', 'Pierre flottante', 'stone', {}],
  [CALDERA_STONE, 'pierre_de_caldeira', 'Pierre de caldeira', 'stone', {}],
  [CRATER_STONE, 'pierre_cratere', 'Pierre de cratère', 'stone', {}],
  [ELDRITCH, 'bloc_eldritch', 'Bloc eldritch', 'hard', { light: 2 }],
  [TOXIC_LEAVES_PLACED, 'feuilles_toxiques', 'Feuilles toxiques', 'leaves', { hidden: true, pick: TOXIC_LEAVES }],
];
// (le dessus du tronc toxique : sa propre texture)
export const ENV_TEXTURES = [...new Set(ENV_BLOCKS.flatMap(([, t, , , o]) => [t, o.top].filter(Boolean)))];

// Les nouveaux biomes (à la suite de BIOME dans gen.js)
export const NEW_BIOMES = [
  // [clé, nom, couleur sur la carte]
  ['MESA', 'Mesa', [190, 96, 52]],
  ['TOXIC', 'Jungle toxique', [96, 150, 34]],
  ['MUSHROOM', 'Champignons géants', [132, 72, 160]],
  ['CALDERA', 'Caldeira', [112, 60, 46]],
  ['FLOATING', 'Montagnes flottantes', [150, 170, 210]],
];
export const FIRST_NEW_BIOME = 13;
