import * as THREE from 'three';
import { findHexGrid } from './hexmodel.js?v=1.1.5-alpha-mvm2b95g';
import { isDecorTexture, decorTextures } from './decortex.js?v=1.1.5-alpha-mvm2b95g';

export const TILE = 16;
const CAP = 128;  // résolution des dessus hexagonaux (haute pour des anneaux bien lisses)
const CELL = CAP; // taille d'une case de l'atlas (les côtés 16 px y sont agrandis sans flou)
const HI = 128;   // taille des textures hexagonales (dessinées en grand) une fois réduites

// nom interne -> fichier dans le dossier texture/ (toutes dessinées en pixels hexagonaux)
const FILES = {
  bone: 'blocs/decor/bone.png',
  carpet_red: 'blocs/decor/carpet_red.png',
  checker_floor: 'blocs/decor/checker_floor.png',
  clay: 'blocs/decor/clay.png',
  cobble_street: 'blocs/decor/cobble_street.png',
  cracked_earth: 'blocs/decor/cracked_earth.png',
  cracked_stone_bricks: 'blocs/decor/cracked_stone_bricks.png',
  crystal: 'blocs/decor/crystal.png',
  dragon_scales: 'blocs/decor/dragon_scales.png',
  embers: 'blocs/decor/embers.png',
  flagstone: 'blocs/decor/flagstone.png',
  glow_fungus: 'blocs/decor/glow_fungus.png',
  half_timber: 'blocs/decor/half_timber.png',
  hay_bale: 'blocs/decor/hay_bale.png',
  honeycomb: 'blocs/decor/honeycomb.png',
  iron_plate: 'blocs/decor/iron_plate.png',
  lichen_rock: 'blocs/decor/lichen_rock.png',
  marble: 'blocs/decor/marble.png',
  moss: 'blocs/decor/moss.png',
  mossy_stone_bricks: 'blocs/decor/mossy_stone_bricks.png',
  mud_brick: 'blocs/decor/mud_brick.png',
  mushroom_block: 'blocs/decor/mushroom_block.png',
  polished_stone: 'blocs/decor/polished_stone.png',
  red_bricks: 'blocs/decor/red_bricks.png',
  rune_stone: 'blocs/decor/rune_stone.png',
  rusted_metal: 'blocs/decor/rusted_metal.png',
  dune_sand: 'blocs/decor/dune_sand.png',
  sandstone: 'blocs/decor/sandstone.png',
  sandstone_bricks: 'blocs/decor/sandstone_bricks.png',
  slate_roof: 'blocs/decor/slate_roof.png',
  stained_glass: 'blocs/decor/stained_glass.png',
  stone_bricks: 'blocs/decor/stone_bricks.png',
  swamp_mud: 'blocs/decor/swamp_mud.png',
  terracotta_roof: 'blocs/decor/terracotta_roof.png',
  thatch: 'blocs/decor/thatch.png',
  verdigris_copper: 'blocs/decor/verdigris_copper.png',
  wicker_weave: 'blocs/decor/wicker_weave.png',
  wood_parquet: 'blocs/decor/wood_parquet.png',
  grass_top: 'blocs/grass_top.png',
  dirt: 'blocs/dirt.png',
  stone: 'blocs/stone.png',
  bedrock: 'blocs/bedrock.png',
  sand: 'blocs/sand.png',
  oak_log: 'blocs/oak_log.png',
  oak_log_top: 'blocs/oak_log_top.png',
  oak_leaves: 'blocs/oak_leaves.png',
  oak_planks: 'blocs/oak_planks.png',
  chestnut_log: 'blocs/chestnut_log.png',
  chestnut_log_top: 'blocs/chestnut_log_top.png',
  chestnut_leaves: 'blocs/chestnut_leaves.png',
  chestnut_planks: 'blocs/chestnut_planks.png',
  linden_log: 'blocs/linden_log.png',
  linden_log_top: 'blocs/linden_log_top.png',
  linden_leaves: 'blocs/linden_leaves.png',
  linden_planks: 'blocs/linden_planks.png',
  cobblestone: 'blocs/cobblestone.png',
  mossy_cobblestone: 'blocs/mossy_cobblestone.png',
  coal_ore: 'blocs/coal_ore.png',
  crafting_table_top: 'blocs/crafting_table_top.png',
  crafting_table_side: 'blocs/crafting_table_side.png',
  crafting_table_front: 'blocs/crafting_table_front.png',
  water: 'blocs/water.png', // icône seulement : l'eau est dessinée par un shader
  ice_water: 'blocs/neige/ice_water.png', // (facultatif : sinon l'eau, éclaircie)
  tnt_side: 'blocs/tnt/tnt_side.png',
  tnt_top: 'blocs/tnt/tnt_top.png',
  tnt_bottom: 'blocs/tnt/tnt_bottom.png',
  big_tnt_side: 'blocs/big_tnt/big_tnt_side.png',
  big_tnt_top: 'blocs/big_tnt/big_tnt_top.png',
  big_tnt_bottom: 'blocs/big_tnt/big_tnt_bottom.png',
  rail: 'rails/rail.png',
  powered_rail: 'rails/powered_rail.png',          // rail de propulsion éteint
  powered_rail_on: 'rails/powered_rail_on.png',    // rail de propulsion allumé
  powered_rail_on_diamond: 'rails/diamond_rail_on.png', // booster en diamant allumé
  powered_rail_bleu_diamond: 'rails/diamond_rail.png',  // booster en diamant éteint
  train_rail: 'rails/train_rail.png',
  // la gare (voir trains.js) : 6 côtés, le dessus, le dessous
  gare_mur: 'blocs/gare/gare_cote1_mur_hex.png',
  gare_fenetre: 'blocs/gare/gare_cote2_fenetre_hex.png',
  gare_porte: 'blocs/gare/gare_cote3_porte_hex.png',
  gare_panneau: 'blocs/gare/gare_cote4_panneau_hex.png',
  gare_horloge: 'blocs/gare/gare_cote5_horloge_hex.png',
  gare_lampe: 'blocs/gare/gare_cote6_lampe_hex.png',
  gare_dessus: 'blocs/gare/gare_dessus_hex.png',
  gare_dessous: 'blocs/gare/gare_dessous_hex.png',              // rail de train (voir trains.js)
  torch: 'torches/torch.png',
  redstone_torch: 'torches/energy_torch.png',      // torche d'énergie
  redstone_torch_off: 'torches/energy_torch_off.png',
  grass_side: 'blocs/grass_side.png', // optionnel : composé avec la terre et l'herbe s'il manque
  snow: 'blocs/neige/snow.png',
  snow_side: 'blocs/neige/snow_side.png', // optionnel : composé avec la terre et la neige s'il manque
  cactus_side: 'blocs/desert/cactus_side.png',
  cactus_top: 'blocs/desert/cactus_top.png',
  snowy_leaves: 'blocs/neige/snowy_leaves.png', // optionnel : feuilles de chêne blanchies s'il manque
  glass: 'blocs/verre/glass.png',
  furnace_front: 'blocs/four/furnace_front.png',
  furnace_front_on: 'blocs/four/furnace_front_on.png', // four allumé
  furnace_side: 'blocs/four/furnace_side.png',
  furnace_top: 'blocs/four/furnace_top.png',
  tnt_200_side: 'blocs/tnt_200/tnt_200_side.png',
  tnt_200_top: 'blocs/tnt_200/tnt_200_top.png',
  tnt_200_bottom: 'blocs/tnt_200/tnt_200_bottom.png',
  tnt_1000_side: 'blocs/tnt_1000/tnt_1000_side.png',
  tnt_1000_top: 'blocs/tnt_1000/tnt_1000_top.png',
  tnt_1000_bottom: 'blocs/tnt_1000/tnt_1000_bottom.png',
  gravitron_side: 'blocs/gravitron/gravitron_side.png',
  gravitron_top: 'blocs/gravitron/gravitron_top.png',
  structure_block: 'blocs/structure/structure_block.png',
  // coffre : une seule planche, découpée façon Minecraft (couvercle, corps, loquet ; voir chestPart)
  chest_top: 'blocs/coffre/chest.png',
  chest_bottom: 'blocs/coffre/chest.png',
  chest_front: 'blocs/coffre/chest.png',
  chest_side: 'blocs/coffre/chest.png',
  iron_ore: 'blocs/fer/iron_ore.png',
  iron_block: 'blocs/fer/iron_block.png',
  voltite_ore: 'blocs/voltite/voltite_ore.png',
  voltite_block: 'blocs/voltite/voltite_block.png',
  // fil de voltite : un tronçon (bande) et le point du milieu, éteints / allumés
  wire_off: 'blocs/voltite/wire_off.png',
  wire_on: 'blocs/voltite/wire_on.png',
  wire_dot_off: 'blocs/voltite/wire_dot_off.png',
  wire_dot_on: 'blocs/voltite/wire_dot_on.png',
  // voltite impure : minerai et fil bleu (mêmes formes que le fil de voltite)
  impure_voltite_ore: 'blocs/voltite/impure_voltite_ore.png',
  impure_wire_off: 'blocs/voltite/impure_wire_off.png',
  impure_wire_on: 'blocs/voltite/impure_wire_on.png',
  impure_wire_dot_off: 'blocs/voltite/impure_wire_dot_off.png',
  impure_wire_dot_on: 'blocs/voltite/impure_wire_dot_on.png',
  platinum_ore: 'blocs/platine/platinum_ore.png',
  platinum_block: 'blocs/platine/platinum_block.png',
  tungsten_ore: 'blocs/tungstene/tungsten_ore.png',
  tungsten_block: 'blocs/tungstene/tungsten_block.png',
  fluorite_ore: 'blocs/fluorite/fluorite_ore.png',
  fluorite_block: 'blocs/fluorite/fluorite_block.png',
  crimsonite_ore: 'blocs/cramoisite/crimsonite_ore.png',
  crimsonite_block: 'blocs/cramoisite/crimsonite_block.png',
  physics_top: 'blocs/physique/physics_top.png',
  physics_side: 'blocs/physique/physics_side.png',
  physics_top_on: 'blocs/physique/physics_top_on.png',
  physics_side_on: 'blocs/physique/physics_side_on.png',
  basalt: 'blocs/volcan/basalt.png',
  ash: 'blocs/volcan/ash.png',
  sulfur: 'blocs/volcan/sulfur.png',
  tuff: 'blocs/volcan/tuff.png',
  lava: 'blocs/volcan/lava.png',
  magma: 'blocs/volcan/magma.png',
  obsidian: 'blocs/volcan/obsidian.png',
  oak_sapling: 'plantes/oak_sapling.png',
  big_oak_sapling: 'plantes/big_oak_sapling.png',
  chestnut_sapling: 'plantes/chestnut_sapling.png',
  linden_sapling: 'plantes/linden_sapling.png',
  tall_grass: 'plantes/herbe_haute.png',
  wool_white: 'blocs/laine_blanche.png',
  wool_grey: 'blocs/laine_grise.png',
  propeller_top: 'blocs/helice/propeller_top.png',
  propeller_side: 'blocs/helice/propeller_side.png',
  propeller_bottom: 'blocs/helice/propeller_bottom.png',
  propeller_top_on: 'blocs/helice/propeller_top_on.png',
  propeller_side_on: 'blocs/helice/propeller_side_on.png',
  propeller_bottom_on: 'blocs/helice/propeller_bottom_on.png',
  stabilizer_top: 'blocs/stabilisateur/stabilizer_top.png',
  stabilizer_top_on: 'blocs/stabilisateur/stabilizer_top_on.png',
  stabilizer_side: 'blocs/stabilisateur/stabilizer_side.png',
  stabilizer_side_on: 'blocs/stabilisateur/stabilizer_side_on.png',
  stabilizer_bottom: 'blocs/stabilisateur/stabilizer_bottom.png',
  target_top: 'blocs/cible/target_top.png',
  gravel: 'blocs/gravier/gravel.png',
  steel: 'blocs/acier/steel.png',
  dark_steel: 'blocs/acier/dark_steel.png',
  old_steel: 'blocs/acier/old_steel.png',
  target_side: 'blocs/cible/target_side.png',
  target_bottom: 'blocs/cible/target_bottom.png',
  lamp_off: 'blocs/lampe/lamp_off.png',
  lamp_on: 'blocs/lampe/lamp_on.png',
  // répéteurs : le dessus (plaque de pierre et ses deux plots), allumé ; la version
  // éteinte en est tirée (couleurs assombries, voir repeaterOff)
  repeater_red: 'blocs/repeteur/repeater_red.png',
  repeater_blue: 'blocs/repeteur/repeater_blue.png',
  birch_log: 'blocs/bouleau/birch_log.png',
  birch_log_top: 'blocs/bouleau/birch_log_top.png',
  birch_leaves: 'blocs/bouleau/birch_leaves.png',
  birch_planks: 'blocs/bouleau/birch_planks.png',
  birch_sapling: 'plantes/birch_sapling.png',
  diorite: 'blocs/diorite/diorite.png',
  polished_diorite: 'blocs/diorite/polished_diorite.png',
  diorite_bricks: 'blocs/diorite/diorite_bricks.png',
  industrial_iron: 'blocs/fer_industriel/industrial_iron.png',
  industrial_iron_copper: 'blocs/fer_industriel/industrial_iron_copper.png',
  industrial_iron_rusty: 'blocs/fer_industriel/industrial_iron_rusty.png',
  // piston : côté avec la tête (rentré), côté sans la tête (sorti), tige, dessus, dessous
  // (les côtés du piston tourné vers le bas en sont tirés, retournés : voir flipV)
  piston_side: 'blocs/piston/piston_side.png',
  piston_side_head: 'blocs/piston/piston_side_head.png',
  piston_rod: 'blocs/piston/piston_rod.png',
  piston_face: 'blocs/piston/piston_face.png',
  piston_bottom: 'blocs/piston/piston_bottom.png',
  // ordinateur : une face par côté
  computer_top: 'blocs/ordinateur/computer_top.png',
  computer_bottom: 'blocs/ordinateur/computer_bottom.png',
  computer_screen: 'blocs/ordinateur/computer_screen.png',
  computer_ports: 'blocs/ordinateur/computer_ports.png',
  computer_vent: 'blocs/ordinateur/computer_vent.png',
  computer_bays: 'blocs/ordinateur/computer_bays.png',
  computer_circuits: 'blocs/ordinateur/computer_circuits.png',
  computer_reactor: 'blocs/ordinateur/computer_reactor.png',
  // serveur : une façade par côté
  server_top: 'blocs/serveur/server_top.png',
  server_bottom: 'blocs/serveur/server_bottom.png',
  server_side_1: 'blocs/serveur/server_side_1.png',
  server_side_2: 'blocs/serveur/server_side_2.png',
  server_side_3: 'blocs/serveur/server_side_3.png',
  server_side_4: 'blocs/serveur/server_side_4.png',
  server_side_5: 'blocs/serveur/server_side_5.png',
  server_side_6: 'blocs/serveur/server_side_6.png',
  // blé : 14 stades de pousse (fond transparent)
  ...Object.fromEntries(Array.from({ length: 14 }, (_, k) => ['wheat_' + k, 'plantes/ble/wheat_' + k + '.png'])),
  ...Object.fromEntries(Array.from({ length: 8 }, (_, k) => ['potato_' + k, 'plantes/pomme_de_terre/potato_' + k + '.png'])),
  farmland: 'blocs/farmland.png', // (facultatif : sinon la terre, assombrie et creusée de sillons)
  farmland_wet: 'blocs/farmland_wet.png', // (terre labourée humide)
};
// textures à trous voulus (entre les traverses, autour d'une torche) : gardées telles quelles
const KEEP_ALPHA = new Set([...Array.from({ length: 14 }, (_, k) => 'wheat_' + k), ...Array.from({ length: 8 }, (_, k) => 'potato_' + k), 'oak_sapling', 'big_oak_sapling', 'chestnut_sapling', 'linden_sapling', 'birch_sapling', 'tall_grass', 'rail', 'powered_rail', 'powered_rail_on', 'powered_rail_on_diamond', 'powered_rail_bleu_diamond', 'train_rail', 'torch', 'redstone_torch', 'redstone_torch_off']);

// Couleurs de secours si une texture est absente.
const FALLBACK = {
  bone: '#e6e0cc', carpet_red: '#a8282e', checker_floor: '#8a8a8a', clay: '#a4a8b4', cobble_street: '#6e6a66', cracked_earth: '#9a6e44', cracked_stone_bricks: '#7a7a7a', crystal: '#9ad8f0', dragon_scales: '#3a6a4a', embers: '#c0401a', flagstone: '#8a8478', glow_fungus: '#3ac8a0', half_timber: '#d8ccb0', hay_bale: '#d0a838', honeycomb: '#e0a020', iron_plate: '#a0a4aa', lichen_rock: '#7a8a6a', marble: '#e8e6e2', moss: '#4a7a2c', mossy_stone_bricks: '#6a7a5e', mud_brick: '#9a7452', mushroom_block: '#b83a2e', polished_stone: '#9a9a9a', red_bricks: '#9a4434', rune_stone: '#5a5e7a', rusted_metal: '#8a4a2a', dune_sand: '#d4c08a', sandstone: '#d8c898', sandstone_bricks: '#d0bc88', slate_roof: '#3e4450', stained_glass: '#8a5ab0', stone_bricks: '#848484', swamp_mud: '#4a4430', terracotta_roof: '#b0583a', thatch: '#c0a050', verdigris_copper: '#5aa08a', wicker_weave: '#a87a44', wood_parquet: '#a8743e',
  grass_top: '#5fa83a', dirt: '#8a5a36', stone: '#8a8a8a', bedrock: '#3a3a3a', oak_log: '#6b5132', oak_log_top: '#a8864f', oak_leaves: '#3f7d2c', sand: '#d8c890', water: '#2f6fb0', ice_water: '#9ad6f2', rail: '#8a7a60', powered_rail: '#8a6a40', powered_rail_on: '#b08a30', powered_rail_on_diamond: '#4aa8ff', powered_rail_bleu_diamond: '#2a5a9a', train_rail: '#3a3e48', torch: '#e0a030', redstone_torch: '#e02020', redstone_torch_off: '#602020', oak_planks: '#a8864f', tnt_side: '#d03020', tnt_top: '#c03020', tnt_bottom: '#b02818', big_tnt_side: '#e0b020', big_tnt_top: '#d0a018', big_tnt_bottom: '#b08010', cobblestone: '#7a7a7a', mossy_cobblestone: '#6a7a5a', coal_ore: '#707070', crafting_table_top: '#9a6a3a', crafting_table_side: '#8a5a30', crafting_table_front: '#8a5a30', grass_side: '#8a5a36', snow: '#eef6f8', snow_side: '#8a5a36', cactus_side: '#4f8a2c', cactus_top: '#5a9a34', snowy_leaves: '#dfe9ec', glass: '#cfe8ec', furnace_front: '#555555', furnace_front_on: '#7a5a30', furnace_side: '#6a6a6a', furnace_top: '#777777', tnt_200_side: '#2aa830', tnt_200_top: '#239a2a', tnt_200_bottom: '#1f8a26', tnt_1000_side: '#0058b0', tnt_1000_top: '#0050a8', tnt_1000_bottom: '#003a78', gravitron_side: '#1a2030', gravitron_top: '#3cdcff', structure_block: '#2a1218', chest_top: '#a8742a', chest_bottom: '#8a5e22', chest_front: '#9a6a26', chest_side: '#9a6a26', iron_ore: '#8a8a8a', iron_block: '#d8d8d8', voltite_ore: '#8a6a6a', voltite_block: '#c02020', wire_off: '#601010', wire_on: '#ff3a2a', wire_dot_off: '#601010', wire_dot_on: '#ff3a2a', impure_voltite_ore: '#7a8090', impure_wire_off: '#18306a', impure_wire_on: '#7ab4ff', impure_wire_dot_off: '#18306a', impure_wire_dot_on: '#7ab4ff', platinum_ore: '#8a8a8a', platinum_block: '#9ab0bc', tungsten_ore: '#7a7a7a', tungsten_block: '#24252d', fluorite_ore: '#7e8a8e', fluorite_block: '#a8e4d8', crimsonite_ore: '#7a6a6e', crimsonite_block: '#b02a44', physics_top: '#7a5a3a', physics_side: '#7a5a3a', physics_top_on: '#7a5a3a', physics_side_on: '#7a5a3a', basalt: '#3a3a3e', ash: '#a8a8a8', sulfur: '#e0c818', tuff: '#d0c8bc', lava: '#ff6a10', magma: '#4a2414', obsidian: '#1e1630', oak_sapling: '#3f8a2c', big_oak_sapling: '#2f7a24', lamp_off: '#5a4630', lamp_on: '#f0b840', chestnut_log: '#5a4a3a', chestnut_log_top: '#a87a44', chestnut_leaves: '#3a6a28', chestnut_planks: '#b07a44', chestnut_sapling: '#3f7a2c', linden_log: '#6e6252', linden_log_top: '#d8c098', linden_leaves: '#62a03c', linden_planks: '#dcc69c', linden_sapling: '#62a03c', repeater_red: '#8a8a8a', repeater_blue: '#8a8a8a', tall_grass: '#4f9a34', farmland: '#7a5236', farmland_wet: '#4a3022', ...Object.fromEntries(Array.from({ length: 14 }, (_, k) => ['wheat_' + k, k > 9 ? '#c8a848' : '#3a9a2a'])), ...Object.fromEntries(Array.from({ length: 8 }, (_, k) => ['potato_' + k, '#3f8a2c'])), wool_white: '#ecece8', wool_grey: '#8a8a88', propeller_top: '#3a3d45', propeller_side: '#3a3d45', propeller_bottom: '#3a3d45', propeller_top_on: '#c8a040', propeller_side_on: '#c8a040', propeller_bottom_on: '#5a606a', stabilizer_top: '#2a2c33', stabilizer_top_on: '#2a2c33', stabilizer_side: '#5a606a', stabilizer_side_on: '#3a8a50', stabilizer_bottom: '#5a606a', target_top: '#d83a30', target_side: '#e8e6e0', target_bottom: '#e8e6e0', gravel: '#8a8784', steel: '#8c8c8c', dark_steel: '#2e3038', old_steel: '#4a4e58',
  birch_log: '#e8e4dc', birch_log_top: '#d8c08a', birch_leaves: '#7ea84a', birch_planks: '#dcc48e', birch_sapling: '#7ea84a', diorite: '#d4d2d0', polished_diorite: '#dcdad8', diorite_bricks: '#c8c6c4',
  industrial_iron: '#55575c', industrial_iron_copper: '#a8603a', industrial_iron_rusty: '#6a5040',
  piston_side: '#4a4c52', piston_side_head: '#4a4c52', piston_rod: '#8a8c90', piston_face: '#6a6c72', piston_bottom: '#3a3c42',
  computer_top: '#8a90a0', computer_bottom: '#5a6070', computer_screen: '#2a5a7a', computer_ports: '#8a90a0', computer_vent: '#8a90a0', computer_bays: '#5a6070', computer_circuits: '#1a5a5a', computer_reactor: '#5a6070',
  server_top: '#3a3a3e', server_bottom: '#3a3a3e', server_side_1: '#3a3a3e', server_side_2: '#3a3a3e', server_side_3: '#3a3a3e', server_side_4: '#3a3a3e', server_side_5: '#3a3a3e', server_side_6: '#3a3a3e',
};

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function makeCanvas() {
  const c = document.createElement('canvas');
  c.width = c.height = TILE;
  return c;
}

function fromImage(img, name) {
  if (name.startsWith('chest_')) return chestPart(img, name);
  if (name.startsWith('wire_') || name.startsWith('impure_wire_')) return cropOpaque(img);
  if (img.width > 64 && KEEP_ALPHA.has(name)) {
    const c = document.createElement('canvas');
    c.width = c.height = HI;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    // rails : on garde seulement la hauteur où la voie est pleine (sans la marge vide ni
    // les pointes des hexagones en haut et en bas), sinon il reste un trou entre deux rails
    const [y0, y1] = RAILS.has(name) ? railRows(img) : [0, img.height - 1];
    ctx.drawImage(img, 0, y0, img.width, y1 - y0 + 1, 0, 0, HI, HI);
    c.hexArt = true;
    if (TORCHES.has(name)) c.parts = torchParts(c);
    return c;
  }
  if (img.width > 64) return fromHexArt(img, HOLES.has(name));
  const c = makeCanvas();
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 0, 0, TILE, TILE);
  return c;
}

const TORCHES = new Set(['torch', 'redstone_torch', 'redstone_torch_off']);
const RAILS = new Set(['rail', 'powered_rail', 'powered_rail_on', 'powered_rail_on_diamond', 'powered_rail_bleu_diamond', 'train_rail']);

// Rangées de l'image où la voie est pleine : la première et la dernière rangée dessinées
// sont les pointes des hexagones ; on part de là jusqu'à retrouver (presque) autant de
// pixels qu'un peu plus loin, là où les deux rails sont entiers.
function railRows(img) {
  const probe = document.createElement('canvas');
  probe.width = img.width; probe.height = img.height;
  const pctx = probe.getContext('2d', { willReadFrequently: true });
  pctx.drawImage(img, 0, 0);
  const d = pctx.getImageData(0, 0, img.width, img.height).data;
  const rows = new Array(img.height).fill(0);
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) if (d[(y * img.width + x) * 4 + 3] >= 128) rows[y]++;
  }
  let a = rows.findIndex((n) => n > 0), b = rows.length - 1;
  while (b > 0 && !rows[b]) b--;
  if (a < 0 || b - a < 80) return [0, img.height - 1];
  const reach = Math.round((b - a) * 0.04); // (environ une demi-hauteur d'hexagone)
  const top = rows[a + reach], bottom = rows[b - reach];
  while (a < b && rows[a] < top * 0.9) a++;
  while (b > a && rows[b] < bottom * 0.9) b--;
  return [a, b];
}

// Torche : sépare le bâton (étroit, en bas) de la flamme (plus large, en haut), pour le
// modèle 3D (voir drawTorch dans mesher.js). Renvoie { stick, flame } : [x0, y0, x1, y1]
// entre 0 et 1 (y vers le bas). Les deux rectangles sont ensuite bouchés : les bords en
// zigzag des hexagones laisseraient voir à travers la torche.
function torchParts(c) {
  const W = c.width, H = c.height, ctx = c.getContext('2d');
  const img = ctx.getImageData(0, 0, W, H), d = img.data;
  const rx0 = new Int32Array(H).fill(-1), rx1 = new Int32Array(H).fill(-1);
  let y0 = H, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (d[(y * W + x) * 4 + 3] < 128) continue;
    if (rx0[y] < 0) rx0[y] = x;
    rx1[y] = x;
    if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  if (y1 < 0) return null;
  // largeur du bâton : le bas de l'image (40 %)
  let sx0 = W, sx1 = -1;
  for (let y = Math.round(y1 - (y1 - y0) * 0.4); y <= y1; y++) {
    if (rx0[y] < 0) continue;
    sx0 = Math.min(sx0, rx0[y]); sx1 = Math.max(sx1, rx1[y]);
  }
  // en remontant : la flamme commence là où une ligne déborde du bâton
  const tol = Math.max(2, (sx1 - sx0) * 0.1);
  let split = y0;
  for (let y = y1; y >= y0; y--) {
    if (rx0[y] >= 0 && (rx0[y] < sx0 - tol || rx1[y] > sx1 + tol)) { split = y + 1; break; }
  }
  let fx0 = W, fx1 = -1;
  for (let y = y0; y < split; y++) {
    if (rx0[y] < 0) continue;
    fx0 = Math.min(fx0, rx0[y]); fx1 = Math.max(fx1, rx1[y]);
  }
  if (fx1 < 0 || split - y0 < 3) split = Math.round(y0 + (y1 - y0) * 0.3), fx0 = sx0, fx1 = sx1;

  // Bouche chaque rectangle : un pixel transparent prend la couleur du plus proche pixel
  // plein de sa ligne (ou, sur une ligne vide, de la ligne d'au-dessous / d'au-dessus).
  const fill = (ax, ay, bx, by) => {
    const rows = [];
    for (let y = ay; y <= by; y++) {
      const full = [];
      for (let x = ax; x <= bx; x++) if (d[(y * W + x) * 4 + 3] >= 128) full.push(x);
      rows.push(full);
    }
    for (let y = ay; y <= by; y++) {
      let src = y, full = rows[y - ay];
      for (let k = 1; !full.length && k <= by - ay; k++) {
        if (y + k <= by && rows[y + k - ay].length) { src = y + k; full = rows[src - ay]; }
        else if (y - k >= ay && rows[y - k - ay].length) { src = y - k; full = rows[src - ay]; }
      }
      if (!full.length) continue;
      let j = 0;
      for (let x = ax; x <= bx; x++) {
        while (j + 1 < full.length && Math.abs(full[j + 1] - x) <= Math.abs(full[j] - x)) j++;
        const o = (y * W + x) * 4;
        if (src === y && d[o + 3] >= 128) continue;
        const s = (src * W + full[j]) * 4;
        d[o] = d[s]; d[o + 1] = d[s + 1]; d[o + 2] = d[s + 2]; d[o + 3] = 255;
      }
    }
  };
  fill(sx0, split, sx1, y1);
  fill(fx0, y0, fx1, split - 1);
  ctx.putImageData(img, 0, 0);
  return {
    stick: [sx0 / W, split / H, (sx1 + 1) / W, (y1 + 1) / H],
    flame: [fx0 / W, y0 / H, (fx1 + 1) / W, split / H],
  };
}

// Fil de voltite : seule la partie dessinée de l'image (bande ou point), étirée sur la case
function cropOpaque(img) {
  const probe = document.createElement('canvas');
  probe.width = img.width; probe.height = img.height;
  const pctx = probe.getContext('2d', { willReadFrequently: true });
  pctx.drawImage(img, 0, 0);
  const d = pctx.getImageData(0, 0, img.width, img.height).data;
  let x0 = img.width, y0 = img.height, x1 = -1, y1 = -1;
  for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) {
    if (d[(y * img.width + x) * 4 + 3] < 128) continue;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  const c = document.createElement('canvas');
  c.width = c.height = HI;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  if (x1 < 0) return c;
  // (les bords en zigzag des hexagones restent transparents : découpés au rendu)
  ctx.drawImage(img, x0, y0, x1 - x0 + 1, y1 - y0 + 1, 0, 0, HI, HI);
  c.hexArt = true;
  return c;
}

// Textures hexagonales dont les trous sont voulus (le verre) : bords en zigzag coupés,
// mais l'intérieur reste transparent
const HOLES = new Set(['glass']);

// Coffre : la planche suit le patron d'un coffre de Minecraft (64 unités de large).
// Couvercle : dessus (28, 0), côtés (0..56, 14) sur 5 de haut ; corps : dessous (14, 19),
// côtés (0..56, 33) sur 10 de haut ; loquet en (0, 0). Les côtés du bloc montrent le
// couvercle au-dessus du corps (la face avant porte le loquet).
function chestPart(img, name) {
  const k = img.width / 64;
  const c = document.createElement('canvas');
  c.width = c.height = HI;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#3a2a1a'; // les joints sombres entre les planches (bords transparents)
  ctx.fillRect(0, 0, HI, HI);
  // rectangle (u, v, w, h) de la planche, un peu rentré pour éviter les bords en zigzag
  const cut = (u, v, w, h, dx, dy, dw, dh) => {
    const m = 0.35;
    ctx.drawImage(img, (u + m) * k, (v + m) * k, (w - 2 * m) * k, (h - 2 * m) * k, dx, dy, dw, dh);
  };
  if (name === 'chest_top') cut(28, 0, 14, 14, 0, 0, HI, HI);
  else if (name === 'chest_bottom') cut(14, 19, 14, 14, 0, 0, HI, HI);
  else {
    const u = name === 'chest_front' ? 14 : 0;
    const lid = Math.round(HI * 5 / 15);
    cut(u, 14, 14, 5, 0, 0, HI, lid);
    cut(u, 33, 14, 10, 0, lid, HI, HI - lid);
    if (name === 'chest_front') {
      // loquet, à cheval entre le couvercle et le corps
      const w = HI * 0.2, h = HI * 0.26;
      ctx.drawImage(img, 0, 0, 6.5 * k, 4.6 * k, (HI - w) / 2, lid - h * 0.45, w, h);
    }
  }
  c.hexArt = true;
  return c;
}

// Grande texture dessinée en "pixels hexagonaux" (887 x 765) : on retrouve sa grille
// d'hexagones pour couper les bords en zigzag (il ne reste qu'un rectangle plein), on
// bouche les trous (feuilles) avec une teinte sombre de la texture, et on la réduit à une
// case de l'atlas. La grille, ramenée dans la case, sert à composer le côté de l'herbe.
// Plus grand rectangle plein (opaque) d'une image hexagonale : [x, y, largeur, hauteur], ou null
function opaqueRect(img) {
  const W = img.width, H = img.height, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, W, H).data, on = (x, y) => d[(y * W + x) * 4 + 3] > 200;
  const L = new Int32Array(H).fill(-1), R = new Int32Array(H).fill(-1);
  let widest = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) if (on(x, y)) { if (L[y] < 0) L[y] = x; R[y] = x; }
    if (L[y] >= 0) widest = Math.max(widest, R[y] - L[y]);
  }
  // les rangées presque aussi larges que la plus large (pas les pointes du haut et du bas)
  let top = 0, bottom = H - 1;
  while (top < H && !(L[top] >= 0 && R[top] - L[top] >= widest * 0.97)) top++;
  while (bottom > top && !(L[bottom] >= 0 && R[bottom] - L[bottom] >= widest * 0.97)) bottom--;
  let left = 0, right = W - 1;
  for (let y = top; y <= bottom; y++) { left = Math.max(left, L[y]); right = Math.min(right, R[y]); }
  // et les colonnes : sous le premier pixel plein, au-dessus du dernier
  for (let x = left; x <= right; x++) {
    let t = top; while (t < bottom && !on(x, t)) t++;
    let b = bottom; while (b > t && !on(x, b)) b--;
    top = Math.max(top, t); bottom = Math.min(bottom, b);
  }
  const w = right - left - 1, h = bottom - top - 1;
  return w > W * 0.5 && h > H * 0.5 ? [left + 1, top + 1, w, h] : null;
}
function fromHexArt(img, keepHoles = false) {
  const grid = findHexGrid(img);
  let sx = 0, sy = 0, sw = img.width, sh = img.height;
  if (grid) {
    const R = grid.w / Math.sqrt(3);
    let minE = Infinity, minO = Infinity, maxE = -Infinity, maxO = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const c of grid.cells) {
      if (c.row & 1) { minO = Math.min(minO, c.x); maxO = Math.max(maxO, c.x); }
      else { minE = Math.min(minE, c.x); maxE = Math.max(maxE, c.x); }
      minY = Math.min(minY, c.y); maxY = Math.max(maxY, c.y);
    }
    const left = Math.max(minE, minO) - grid.w / 2, right = Math.min(maxE, maxO) + grid.w / 2;
    const top = minY - R / 2, bottom = maxY + R / 2;
    if (right - left > grid.w * 3 && bottom - top > grid.w * 3) {
      sx = Math.ceil(left) + 1; sy = Math.ceil(top) + 1;
      sw = Math.floor(right) - 1 - sx; sh = Math.floor(bottom) - 1 - sy;
    }
  } else {
    // grille pas reconnue (hexagones très nuancés, comme la diorite) : on garde le plus grand
    // rectangle plein de l'image, sans ses bords en dents de scie (sinon les côtés des blocs
    // montrent ces bords, bouchés en sombre)
    const r = opaqueRect(img);
    if (r) [sx, sy, sw, sh] = r;
  }
  // teinte des trous : la couleur moyenne, assombrie
  const probe = document.createElement('canvas');
  probe.width = probe.height = 32;
  const pctx = probe.getContext('2d', { willReadFrequently: true });
  pctx.drawImage(img, sx, sy, sw, sh, 0, 0, 32, 32);
  const d = pctx.getImageData(0, 0, 32, 32).data;
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 128) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
  n ||= 1;
  const c = document.createElement('canvas');
  c.width = c.height = HI;
  const ctx = c.getContext('2d');
  if (!keepHoles) {
    ctx.fillStyle = `rgb(${(r / n) * 0.42 | 0},${(g / n) * 0.42 | 0},${(b / n) * 0.42 | 0})`;
    ctx.fillRect(0, 0, HI, HI);
  }
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, HI, HI);
  c.hexArt = true;
  // un côté de bloc fait 1/√3 de large pour 1 de haut : on n'y montre que la largeur
  // correspondante de la texture, pour que les hexagones gardent leur forme
  c.sideSpan = Math.min(1, sh / (sw * Math.sqrt(3)));
  if (grid) {
    const kx = HI / sw, ky = HI / sh;
    c.hex = {
      w: grid.w * kx, R: (grid.w / Math.sqrt(3)) * ky,
      cells: grid.cells.map((cell) => ({ col: cell.col, row: cell.row, x: (cell.x - sx) * kx, y: (cell.y - sy) * ky })),
    };
  }
  return c;
}

// Côté de l'herbe pour les textures hexagonales : la terre, et en haut une frange d'herbe
// découpée suivant les hexagones (2 ou 3 rangées selon la colonne)
function composeHexGrassSide(dirt, grass) {
  const c = document.createElement('canvas');
  c.width = c.height = HI;
  const ctx = c.getContext('2d');
  ctx.drawImage(dirt, 0, 0, HI, HI);
  const { w, R, cells } = dirt.hex;
  const r0 = Math.min(...cells.map((cell) => cell.row));
  ctx.save();
  ctx.beginPath();
  for (const cell of cells) {
    const depth = 2 + (((cell.col * 7 + 3) % 5) < 2 ? 1 : 0);
    if (cell.row - r0 >= depth) continue;
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 180) * (90 + 60 * i);
      const x = cell.x + Math.cos(a) * (w / Math.sqrt(3)) * 1.02, y = cell.y - Math.sin(a) * R * 1.02;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }
  ctx.rect(0, -HI, HI, HI); // au-dessus du bord : de l'herbe aussi
  ctx.clip();
  ctx.drawImage(grass, 0, 0, HI, HI);
  ctx.restore();
  c.hexArt = true;
  c.sideSpan = dirt.sideSpan;
  return c;
}

// Feuilles enneigées : les feuilles de chêne blanchies (on garde les nuances de chaque
// hexagone, avec une teinte un peu froide, comme de la neige sur le feuillage)
function snowyLeaves(leaves) {
  const c = document.createElement('canvas');
  c.width = leaves.width; c.height = leaves.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(leaves, 0, 0);
  const img = ctx.getImageData(0, 0, c.width, c.height), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const lum = 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2];
    const v = Math.min(255, 208 + lum * 0.42); // presque aussi clair que la neige
    d[i] = v * 0.95; d[i + 1] = v * 0.98; d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  Object.assign(c, { hexArt: leaves.hexArt, hex: leaves.hex, sideSpan: leaves.sideSpan });
  return c;
}

// Inverseur : le dessus du répéteur, sa pierre grise assombrie et bleutée (comme le basalte)
function slateTile(src) {
  const c = document.createElement('canvas');
  c.width = src.width; c.height = src.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(src, 0, 0);
  const img = ctx.getImageData(0, 0, c.width, c.height), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]);
    const lum = 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2];
    if (mx - mn >= 40 || lum <= 70 || lum >= 200) continue;
    d[i] *= 0.55; d[i + 1] *= 0.55; d[i + 2] = Math.min(255, d[i + 2] * 0.55 + 18);
  }
  ctx.putImageData(img, 0, 0);
  Object.assign(c, { hexArt: src.hexArt, hex: src.hex, sideSpan: src.sideSpan });
  return c;
}

// Répéteur éteint : le dessus allumé, avec ses couleurs (le courant, les plots) assombries ;
// la pierre (grise) ne change pas
function repeaterOff(on) {
  const c = document.createElement('canvas');
  c.width = on.width; c.height = on.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(on, 0, 0);
  const img = ctx.getImageData(0, 0, c.width, c.height), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]);
    const lum = 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2];
    if (mx - mn < 40 && lum < 185) continue;
    d[i] *= 0.42; d[i + 1] *= 0.42; d[i + 2] *= 0.42;
  }
  ctx.putImageData(img, 0, 0);
  Object.assign(c, { hexArt: on.hexArt, hex: on.hex, sideSpan: on.sideSpan });
  return c;
}

// Image retournée de haut en bas (côtés du piston tourné vers le bas)
function flipV(src) {
  const c = document.createElement('canvas');
  c.width = src.width; c.height = src.height;
  const ctx = c.getContext('2d');
  ctx.translate(0, c.height);
  ctx.scale(1, -1);
  ctx.drawImage(src, 0, 0);
  Object.assign(c, { hexArt: src.hexArt, sideSpan: src.sideSpan });
  return c;
}

// Terre labourée : la terre assombrie (humide), avec des sillons plus sombres
function farmland(dirt) {
  const c = document.createElement('canvas');
  c.width = dirt.width; c.height = dirt.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(dirt, 0, 0);
  const img = ctx.getImageData(0, 0, c.width, c.height), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const y = Math.floor(i / 4 / c.width), furrow = Math.floor((y / c.height) * 6) % 2 === 0 ? 0.62 : 0.8;
    d[i] *= furrow * 0.95; d[i + 1] *= furrow * 0.9; d[i + 2] *= furrow * 0.85;
  }
  ctx.putImageData(img, 0, 0);
  Object.assign(c, { hexArt: dirt.hexArt, hex: dirt.hex, sideSpan: dirt.sideSpan });
  return c;
}

// Eau glaciale : l'eau en bleu ciel
function iceWater(water) {
  const c = document.createElement('canvas');
  c.width = water.width; c.height = water.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(water, 0, 0);
  const img = ctx.getImageData(0, 0, c.width, c.height), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const lum = 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2];
    const v = Math.min(255, 120 + lum * 0.8);
    d[i] = v * 0.62; d[i + 1] = v * 0.88; d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  Object.assign(c, { hexArt: water.hexArt, hex: water.hex, sideSpan: water.sideSpan });
  return c;
}

function noiseTile(color) {
  const c = makeCanvas();
  const ctx = c.getContext('2d');
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, TILE, TILE);
  for (let i = 0; i < 60; i++) {
    ctx.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.1)';
    ctx.fillRect((Math.random() * TILE) | 0, (Math.random() * TILE) | 0, 1, 1);
  }
  return c;
}

// Côté d'herbe : la terre avec une frange d'herbe irrégulière en haut.
function composeGrassSide(dirt, grass) {
  const c = makeCanvas();
  const ctx = c.getContext('2d');
  ctx.drawImage(dirt, 0, 0);
  const fringe = [3, 2, 3, 4, 3, 2, 2, 3, 4, 3, 3, 2, 3, 4, 2, 3];
  for (let x = 0; x < TILE; x++) {
    ctx.drawImage(grass, x, 0, 1, fringe[x], x, 0, 1, fringe[x]);
  }
  return c;
}

// Transforme une texture carrée en texture hexagonale (hexagone pointe en haut,
// inscrit dans la case) : chaque anneau carré de la source devient un anneau
// hexagonal. Les cernes d'un tronc suivent ainsi la forme du bloc.
// planar = true : simple découpe à plat (planches : les lattes restent droites).
const PLANAR_CAPS = new Set(['oak_planks', 'chestnut_planks', 'linden_planks', 'birch_planks']);
// textures hexagonales dont les anneaux doivent suivre le bord du bloc
const RING_CAPS = new Set(['oak_log_top', 'chestnut_log_top', 'linden_log_top', 'birch_log_top', 'crafting_table_top']);
const FULL_SIDES = new Set(['crafting_table_front', 'crafting_table_side', 'tnt_side', 'big_tnt_side', 'tnt_200_side', 'tnt_1000_side',
  'furnace_front', 'furnace_front_on', 'furnace_side', 'chest_front', 'chest_side', 'glass', 'physics_side', 'physics_side_on', 'propeller_side', 'propeller_side_on', 'stabilizer_side', 'stabilizer_side_on', 'target_side',
  // (faces dessinées en entier : cadres, façades, la tige du piston au milieu)
  'industrial_iron', 'industrial_iron_copper', 'industrial_iron_rusty',
  'piston_side', 'piston_side_head', 'piston_side_down', 'piston_side_head_down', 'piston_rod',
  'computer_screen', 'computer_ports', 'computer_vent', 'computer_bays', 'computer_circuits', 'computer_reactor',
  'server_side_1', 'server_side_2', 'server_side_3', 'server_side_4', 'server_side_5', 'server_side_6',
  'gare_mur', 'gare_fenetre', 'gare_porte', 'gare_panneau', 'gare_horloge', 'gare_lampe']);

function hexCap(src, planar = false) {
  const S = src.width;
  const srcData = src.getContext('2d').getImageData(0, 0, S, S).data;
  const c = document.createElement('canvas');
  c.width = c.height = CAP;
  const ctx = c.getContext('2d');
  const out = ctx.createImageData(CAP, CAP);
  const apothem = Math.sqrt(3) / 4; // hexagone de rayon 0.5 (coin) dans une case de côté 1
  const normals = Array.from({ length: 6 }, (_, k) => [Math.cos((Math.PI / 3) * k), Math.sin((Math.PI / 3) * k)]);
  const SS = 3; // sur-échantillonnage SSxSS par pixel : bords des anneaux lisses

  // Couleur de la source correspondant au point (x, y) de l'hexagone.
  const sample = (x, y, acc) => {
    if (planar) {
      const si = (Math.min(S - 1, Math.floor((0.5 + y) * S)) * S + Math.min(S - 1, Math.floor((0.5 + x) * S))) * 4;
      for (let ch = 0; ch < 4; ch++) acc[ch] += srcData[si + ch];
      return;
    }
    // "rayon hexagonal" : 0 au centre, 1 sur le bord de l'hexagone
    let hr = 0;
    for (const [nx, ny] of normals) hr = Math.max(hr, (x * nx + y * ny) / apothem);
    // même "rayon carré" dans la source, dans la même direction
    const m = Math.max(Math.abs(x), Math.abs(y)) || 1;
    const k = (Math.min(hr, 1) * 0.5) / m;
    const sx = Math.min(S - 1, Math.max(0, Math.floor((0.5 + x * k) * S)));
    const sy = Math.min(S - 1, Math.max(0, Math.floor((0.5 + y * k) * S)));
    const si = (sy * S + sx) * 4;
    for (let ch = 0; ch < 4; ch++) acc[ch] += srcData[si + ch];
  };

  const acc = [0, 0, 0, 0];
  for (let j = 0; j < CAP; j++) {
    for (let i = 0; i < CAP; i++) {
      acc.fill(0);
      for (let sj = 0; sj < SS; sj++) {
        for (let si = 0; si < SS; si++) {
          sample((i + (si + 0.5) / SS) / CAP - 0.5, (j + (sj + 0.5) / SS) / CAP - 0.5, acc);
        }
      }
      const di = (j * CAP + i) * 4;
      for (let ch = 0; ch < 4; ch++) out.data[di + ch] = acc[ch] / (SS * SS);
    }
  }
  ctx.putImageData(out, 0, 0);
  return c;
}

export async function buildAtlas() {
  const names = Object.keys(FILES);
  const images = await Promise.all(names.map((n) => loadImage('texture/' + FILES[n])));
  const tiles = {};
  names.forEach((n, i) => { if (images[i]) tiles[n] = fromImage(images[i], n); });
  for (const n of names) {
    if (tiles[n]) continue;
    if (n === 'grass_side' && tiles.dirt?.hex && tiles.grass_top?.hexArt) tiles[n] = composeHexGrassSide(tiles.dirt, tiles.grass_top);
    else if (n === 'grass_side' && tiles.dirt && tiles.grass_top) tiles[n] = composeGrassSide(tiles.dirt, tiles.grass_top);
    // côté de l'herbe enneigée : la terre avec une frange de neige
    else if (n === 'snow_side' && tiles.dirt?.hex && tiles.snow?.hexArt) tiles[n] = composeHexGrassSide(tiles.dirt, tiles.snow);
    else if (n === 'snow_side' && tiles.dirt && tiles.snow) tiles[n] = composeGrassSide(tiles.dirt, tiles.snow);
    else if (n === 'snowy_leaves' && tiles.oak_leaves) tiles[n] = snowyLeaves(tiles.oak_leaves);
    else if (n === 'ice_water' && tiles.water) tiles[n] = iceWater(tiles.water);
    else if ((n === 'farmland' || n === 'farmland_wet') && tiles.dirt) tiles[n] = farmland(tiles.dirt);
    else tiles[n] = noiseTile(FALLBACK[n]);
  }

  // répéteurs éteints (tirés des allumés) ; inverseurs : les mêmes sur une pierre sombre
  for (const color of ['red', 'blue']) {
    tiles['repeater_' + color + '_off'] = repeaterOff(tiles['repeater_' + color]);
    tiles['inverter_' + color] = slateTile(tiles['repeater_' + color]);
    tiles['inverter_' + color + '_off'] = repeaterOff(tiles['inverter_' + color]);
    names.push('repeater_' + color + '_off', 'inverter_' + color, 'inverter_' + color + '_off');
  }

  // piston tourné vers le bas : ses côtés à l'envers (la tête en bas)
  for (const n of ['piston_side', 'piston_side_head']) {
    tiles[n + '_down'] = flipV(tiles[n]);
    names.push(n + '_down');
  }

  // Version hexagonale de chaque texture, pour le dessus et le dessous des blocs.
  // (les cernes des troncs suivent l'hexagone ; les planches sont découpées à plat ; les
  // textures déjà dessinées en hexagones aussi, sauf les cernes et le dessus de la table)
  for (const n of names) {
    const planar = PLANAR_CAPS.has(n) || (tiles[n].hexArt && !RING_CAPS.has(n));
    tiles[n + '_cap'] = hexCap(tiles[n], planar);
  }
  // blocs de décoration : redessinés sans raccord d'un bloc à l'autre (voir decortex.js)
  names.forEach((n, i) => {
    if (!isDecorTexture(n) || !images[i]) return;
    try { const t = decorTextures(n, images[i]); tiles[n] = t.side; tiles[n + '_cap'] = t.cap; } catch (e) { console.warn('texture', n, e); }
  });

  // Atlas : une case de CELL px par texture (les côtés 16 px sont agrandis sans flou), en
  // grille à peu près carrée (une seule rangée dépasserait la taille maximale d'une texture).
  const all = Object.keys(tiles);
  const cols = Math.ceil(Math.sqrt(all.length)), rows = Math.ceil(all.length / cols);
  const atlas = document.createElement('canvas');
  atlas.width = CELL * cols;
  atlas.height = CELL * rows;
  const ctx = atlas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  all.forEach((n, i) => ctx.drawImage(tiles[n], (i % cols) * CELL, Math.floor(i / cols) * CELL, CELL, CELL));

  const texture = new THREE.CanvasTexture(atlas);
  texture.magFilter = THREE.NearestFilter;
  // Mipmaps : évite le scintillement du sol au loin
  texture.minFilter = THREE.NearestMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.colorSpace = THREE.SRGBColorSpace;

  const eu = 0.02 / (CELL * cols); // petit retrait pour éviter de déborder sur la case voisine
  const ev = 0.128 / (CELL * rows);
  const ranges = {};
  all.forEach((name, i) => {
    const c = i % cols, r = Math.floor(i / cols);
    // (v : 0 = bas de l'image, la rangée 0 est en haut)
    ranges[name] = [c / cols + eu, (c + 1) / cols - eu, 1 - (r + 1) / rows + ev, 1 - r / rows - ev];
  });

  return {
    texture,
    tiles,
    // largeur de la texture montrée sur un côté de bloc (1 = toute la texture). Les faces
    // de la table de craft sont dessinées comme des faces entières : on les montre en entier.
    sideSpan(name) {
      return FULL_SIDES.has(name) ? 1 : tiles[name]?.sideSpan || 1;
    },
    // (u, v) dans [0,1] de la tuile -> coordonnées dans l'atlas
    uv(name, u, v) {
      const [u0, u1, v0, v1] = ranges[name];
      return [u0 + (u1 - u0) * u, v0 + (v1 - v0) * v];
    },
  };
}
