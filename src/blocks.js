// Registre des blocs. Pour ajouter un bloc : ajoute sa texture dans textures.js
// puis une entrée ici, et son id dans HOTBAR.
import { LIQUIDS, CAN_MB } from './liquids.js?v=1.1.5-alpha-mwgq2wrb';
import { PC_PARTS, PC_PARTS_ID } from './pcparts.js?v=1.1.5-alpha-mwgq2wrb';
import { LORE } from './lore.js?v=1.1.5-alpha-mwgq2wrb';
import { METALS, oreName, blockName, oreTex, blockTex, REINFORCED_CONCRETE, CERAMIC, REINFORCED_GLASS } from './metals.js?v=1.1.5-alpha-mwgq2wrb';
import { ENV_BLOCKS } from './biomes.js?v=1.1.5-alpha-mwgq2wrb';
import { HX_LIST, hxIcon } from './traincatalog.js?v=1.1.5-alpha-mwgq2wrb';
import { circleHexOverlap, circleHexPush, circlePolyPush, HALF_HEX, CORNERS } from './hex.js?v=1.1.5-alpha-mwgq2wrb';

// Ids possibles des blocs et des objets (les chunks gardent les blocs sur 16 bits). Blocs
// ajoutés depuis la 1.0 : à partir de 256 ; objets : à partir de 300 ; dalles (verticales,
// deux dalles dans une case) : à partir de 1000, voir SLAB_MATS. 4000..4063 : planchettes du lore.
// Jusqu'à 4095 tout est pris : les nouveaux blocs et objets commencent à 4096. La limite reste
// sous 65 536 (les chunks gardent les ids sur 16 bits) ; les tables par id (OPAQUE, SOLID,
// light.js…) font MAX_ID cases.
export const MAX_ID = 16384;

export const AIR = 0;

// Eau : 7 = source, 9..15 = eau qui coule (9 = force 6, près de la source ... 15 = force 0),
// 16 = eau qui tombe (chute d'eau).
export const WATER = 7;
export const WATER_TOP = 0.88; // l'eau ne remplit pas tout à fait le bloc (comme Minecraft)
export const WATER_FALL = 16;
// Eau glaciale (biomes froids) : mêmes états, ids décalés : 200 = source, 201..207 = eau qui
// coule (201 = force 6 ... 207 = force 0), 208 = chute. Plus claire, et on y gèle.
export const ICE_WATER = 200, ICE_WATER_FALL = 208;
export const isIceWater = (id) => id >= 200 && id <= 208;
// id de l'eau ordinaire équivalente (même état)
const plainWater = (id) => (id === ICE_WATER ? WATER : id === ICE_WATER_FALL ? WATER_FALL : isIceWater(id) ? id - 192 : id);
export const isWater = (id) => id === WATER || (id >= 9 && id <= 16) || isIceWater(id);
export const isWaterSource = (id) => id === WATER || id === ICE_WATER;
export const flowId = (strength, ice = false) => (ice ? 207 : 15) - strength;
export const fallId = (ice) => (ice ? ICE_WATER_FALL : WATER_FALL);
export function waterStrength(id) {
  id = plainWater(id);
  if (id === WATER || id === WATER_FALL) return 7;
  if (id >= 9 && id <= 15) return 15 - id;
  return -1;
}
// Hauteur de la surface dans le bloc (0..1)
export function waterHeight(id) {
  id = plainWater(id);
  if (id === WATER || id === WATER_FALL) return WATER_TOP;
  return 0.16 + (15 - id) * 0.11;
}

export const BLOCKS = {
  1: { name: 'Herbe', top: 'grass_top', side: 'grass_side', bottom: 'dirt' },
  2: { name: 'Terre', top: 'dirt', side: 'dirt', bottom: 'dirt' },
  3: { name: 'Pierre', top: 'stone', side: 'stone', bottom: 'stone' },
  4: { name: 'Bedrock', top: 'bedrock', side: 'bedrock', bottom: 'bedrock', unbreakable: true },
  5: { name: 'Bûche de chêne', top: 'oak_log_top', side: 'oak_log', bottom: 'oak_log_top', log: true },
  // feuilles des arbres : sans tronc à moins de 4 feuilles, elles disparaissent peu à peu
  // (voir nature.js). Posées par le joueur, elles deviennent des feuilles « posées » qui
  // ne disparaissent jamais (placedAs).
  6: { name: 'Feuilles de chêne', top: 'oak_leaves', side: 'oak_leaves', bottom: 'oak_leaves', leaves: true, placedAs: 76 },
  7: { name: 'Eau', top: 'water', side: 'water', bottom: 'water', liquid: true },
  // eau glaciale : celle des biomes froids (bleu ciel ; on y gèle, voir main.js)
  200: { name: 'Eau glaciale', top: 'ice_water', side: 'ice_water', bottom: 'ice_water', liquid: true },
  8: { name: 'Sable', top: 'sand', side: 'sand', bottom: 'sand' },
  17: { name: 'Rails', top: 'rail', side: 'rail', bottom: 'rail', rail: true, item: 'texture/rails/rail.png' },
  18: { name: 'Planches de chêne', top: 'oak_planks', side: 'oak_planks', bottom: 'oak_planks' },
  19: { name: 'Rails de propulsion', top: 'powered_rail_on', side: 'powered_rail_on', bottom: 'powered_rail_on', rail: true, item: 'texture/rails/powered_rail_on.png' },
  // rail de propulsion éteint (clic droit dessus pour basculer) : freine les Hexacarts
  20: { name: 'Rails de propulsion (éteints)', top: 'powered_rail', side: 'powered_rail', bottom: 'powered_rail', rail: true, hidden: true, pick: 19, item: 'texture/rails/powered_rail.png' },
  // booster en diamant : pousse bien plus fort (clic droit : allumer / éteindre)
  21: { name: 'Rails booster en diamant', top: 'powered_rail_on_diamond', side: 'powered_rail_on_diamond', bottom: 'powered_rail_on_diamond', rail: true, item: 'texture/rails/diamond_rail_on.png' },
  22: { name: 'Rails booster en diamant (éteints)', top: 'powered_rail_bleu_diamond', side: 'powered_rail_bleu_diamond', bottom: 'powered_rail_bleu_diamond', rail: true, hidden: true, pick: 21, item: 'texture/rails/diamond_rail.png' },
  // torches : posées sur un bloc, elles éclairent (light : couleur de la lumière)
  23: { name: 'Torche', top: 'torch', side: 'torch', bottom: 'torch', torch: true, light: 1 },
  24: { name: "Torche d'énergie", top: 'redstone_torch', side: 'redstone_torch', bottom: 'redstone_torch', torch: true, light: 2 },
  25: { name: "Torche d'énergie (éteinte)", top: 'redstone_torch_off', side: 'redstone_torch_off', bottom: 'redstone_torch_off', torch: true, hidden: true, pick: 24 },
  // TNT : s'allume avec une torche en main, une torche d'énergie à côté ou une explosion
  26: { name: 'TNT', top: 'tnt_top', side: 'tnt_side', bottom: 'tnt_bottom', tnt: true },
  // Big TNT : 20 fois la puissance d'une TNT (voir tnt.js), nuage en champignon
  27: { name: 'Big TNT', top: 'big_tnt_top', side: 'big_tnt_side', bottom: 'big_tnt_bottom', tnt: true, big: true },
  28: { name: 'Pierre taillée', top: 'cobblestone', side: 'cobblestone', bottom: 'cobblestone' },
  29: { name: 'Pierre taillée moussue', top: 'mossy_cobblestone', side: 'mossy_cobblestone', bottom: 'mossy_cobblestone' },
  30: { name: 'Minerai de charbon', top: 'coal_ore', side: 'coal_ore', bottom: 'coal_ore' },
  // table de craft : face avant (outils) sur deux côtés opposés, planches en dessous
  31: {
    name: 'Table de craft', top: 'crafting_table_top', side: 'crafting_table_side', bottom: 'oak_planks',
    sides: ['crafting_table_front', 'crafting_table_side', 'crafting_table_side', 'crafting_table_front', 'crafting_table_side', 'crafting_table_side'],
  },
  // Dalles : demi-blocs. Posée en bas de la case, ou en haut (en visant le dessous d'un bloc
  // ou le haut d'un côté). Deux dalles de la même matière dans une case = le bloc plein.
  32: { name: 'Dalle de pierre taillée', top: 'cobblestone', side: 'cobblestone', bottom: 'cobblestone', slab: 'bottom', full: 28, other: 34 },
  33: { name: 'Dalle de chêne', top: 'oak_planks', side: 'oak_planks', bottom: 'oak_planks', slab: 'bottom', full: 18, other: 35 },
  34: { name: 'Dalle de pierre taillée (haute)', top: 'cobblestone', side: 'cobblestone', bottom: 'cobblestone', slab: 'top', full: 28, other: 32, hidden: true, pick: 32 },
  35: { name: 'Dalle de chêne (haute)', top: 'oak_planks', side: 'oak_planks', bottom: 'oak_planks', slab: 'top', full: 18, other: 33, hidden: true, pick: 33 },
  // biomes froids (plaines enneigées, sommets des montagnes) et désert
  36: { name: 'Herbe enneigée', top: 'snow', side: 'snow_side', bottom: 'dirt' },
  37: { name: 'Neige', top: 'snow', side: 'snow', bottom: 'snow' },
  // cactus : pique quand on le touche (en survie)
  38: { name: 'Cactus', top: 'cactus_top', side: 'cactus_side', bottom: 'cactus_top' },
  // feuilles des arbres dans la neige
  39: { name: 'Feuilles enneigées', top: 'snowy_leaves', side: 'snowy_leaves', bottom: 'snowy_leaves', leaves: true, placedAs: 77 },
  // verre : transparent (texture à trous, voir drawGlass dans mesher.js), obtenu au four
  40: { name: 'Verre', top: 'glass', side: 'glass', bottom: 'glass', glass: true },
  // TNT 200 : 200 fois la puissance d'une TNT (voir tnt.js)
  41: { name: 'TNT 200', top: 'tnt_200_top', side: 'tnt_200_side', bottom: 'tnt_200_bottom', tnt: true, big: true },
  // fer : minerai (pioche en pierre), lingot au four, bloc de fer
  60: { name: 'Minerai de fer', top: 'iron_ore', side: 'iron_ore', bottom: 'iron_ore' },
  // voltite : le courant du jeu (comme la redstone). Minerai profond (pioche en fer)
  61: { name: 'Minerai de voltite', top: 'voltite_ore', side: 'voltite_ore', bottom: 'voltite_ore' },
  62: { name: 'Bloc de fer', top: 'iron_block', side: 'iron_block', bottom: 'iron_block' },
  // bloc de voltite : donne du courant en continu à tout ce qui le touche
  63: { name: 'Bloc de voltite', top: 'voltite_block', side: 'voltite_block', bottom: 'voltite_block', source: true },
  // fil de voltite (posé avec de la voltite) : conduit le courant, éteint / allumé (voir circuits.js)
  64: { name: 'Fil de voltite', top: 'wire_off', side: 'wire_off', bottom: 'wire_off', wire: true, hidden: true, pick: 123 },
  65: { name: 'Fil de voltite (allumé)', top: 'wire_on', side: 'wire_on', bottom: 'wire_on', wire: true, hidden: true, pick: 123 },
  // bloc physique : collé à un objet, il le fait avancer quand il reçoit du courant, dans la
  // direction réglée avec la clé à molette (x, y, z)
  66: { name: 'Bloc physique', top: 'physics_top', side: 'physics_side', bottom: 'physics_top', physics: true },
  67: { name: 'Bloc physique (allumé)', top: 'physics_top_on', side: 'physics_side_on', bottom: 'physics_top_on', physics: true, hidden: true, pick: 66 },
  // volcans
  68: { name: 'Basalte', top: 'basalt', side: 'basalt', bottom: 'basalt' },
  69: { name: 'Cendre volcanique', top: 'ash', side: 'ash', bottom: 'ash' },
  70: { name: 'Soufre', top: 'sulfur', side: 'sulfur', bottom: 'sulfur' },
  71: { name: 'Tuf', top: 'tuff', side: 'tuff', bottom: 'tuff' },
  // lave : on la traverse (et on brûle), elle brille et éclaire (glow : dessinée sans ombre)
  72: { name: 'Lave', top: 'lava', side: 'lava', bottom: 'lava', lava: true, glow: true, light: 4 },
  // bloc de magma : brille, et brûle les pieds de qui marche dessus
  73: { name: 'Bloc de magma', top: 'magma', side: 'magma', bottom: 'magma', glow: true },
  74: { name: 'Obsidienne', top: 'obsidian', side: 'obsidian', bottom: 'obsidian' },
  // pousse de chêne : se pose sur l'herbe ou la terre, devient un chêne (voir nature.js)
  75: { name: 'Pousse de chêne', top: 'oak_sapling', side: 'oak_sapling', bottom: 'oak_sapling', sapling: true, item: 'texture/plantes/oak_sapling.png' },
  76: { name: 'Feuilles de chêne', top: 'oak_leaves', side: 'oak_leaves', bottom: 'oak_leaves', hidden: true, pick: 6 },
  // châtaignier (forêt européenne)
  97: { name: 'Bûche de châtaignier', top: 'chestnut_log_top', side: 'chestnut_log', bottom: 'chestnut_log_top', log: true },
  98: { name: 'Feuilles de châtaignier', top: 'chestnut_leaves', side: 'chestnut_leaves', bottom: 'chestnut_leaves', leaves: true, placedAs: 144 },
  99: { name: 'Planches de châtaignier', top: 'chestnut_planks', side: 'chestnut_planks', bottom: 'chestnut_planks' },
  144: { name: 'Feuilles de châtaignier', top: 'chestnut_leaves', side: 'chestnut_leaves', bottom: 'chestnut_leaves', hidden: true, pick: 98 },
  // pousse de châtaignier : devient un châtaignier (celui de la forêt européenne, voir nature.js)
  145: { name: 'Pousse de châtaignier', top: 'chestnut_sapling', side: 'chestnut_sapling', bottom: 'chestnut_sapling', sapling: true, chestnut: true, item: 'texture/plantes/chestnut_sapling.png' },
  // tilleul (forêt européenne)
  152: { name: 'Bûche de tilleul', top: 'linden_log_top', side: 'linden_log', bottom: 'linden_log_top', log: true },
  153: { name: 'Feuilles de tilleul', top: 'linden_leaves', side: 'linden_leaves', bottom: 'linden_leaves', leaves: true, placedAs: 155 },
  154: { name: 'Planches de tilleul', top: 'linden_planks', side: 'linden_planks', bottom: 'linden_planks' },
  155: { name: 'Feuilles de tilleul', top: 'linden_leaves', side: 'linden_leaves', bottom: 'linden_leaves', hidden: true, pick: 153 },
  // pousse de tilleul : devient un tilleul (celui de la forêt européenne, voir nature.js)
  156: { name: 'Pousse de tilleul', top: 'linden_sapling', side: 'linden_sapling', bottom: 'linden_sapling', sapling: true, linden: true, item: 'texture/plantes/linden_sapling.png' },
  // laine : ce que laissent les moutons (voir animals.js)
  194: { name: 'Laine blanche', top: 'wool_white', side: 'wool_white', bottom: 'wool_white' },
  195: { name: 'Laine grise', top: 'wool_grey', side: 'wool_grey', bottom: 'wool_grey' },
  // hélice : allumée, elle fait tourner ce qui est posé dessus (un rotor, voir structs.spinUp)
  198: { name: 'Hélice', top: 'propeller_top', side: 'propeller_side', bottom: 'propeller_bottom' },
  // stabilisateur : allumé, sur un objet collé, il le garde à l'horizontale (voir structs.stabilize)
  241: { name: 'Stabilisateur', top: 'stabilizer_top', side: 'stabilizer_side', bottom: 'stabilizer_bottom' },
  242: { name: 'Stabilisateur (allumé)', top: 'stabilizer_top_on', side: 'stabilizer_side_on', bottom: 'stabilizer_bottom', hidden: true, pick: 241 },
  // bloc cible : une destination nommée (clé à molette), qu'on choisit dans la liste du gravitron
  // gravier : les routes des villages (voir colony.js), ou 4 pierres taillées concassées
  244: { name: 'Gravier', top: 'gravel', side: 'gravel', bottom: 'gravel' },
  243: { name: 'Bloc cible', top: 'target_top', side: 'target_side', bottom: 'target_bottom' },
  // acier : la coque des vaisseaux (celle de l'épave du HEXA-7), aussi à fabriquer
  245: { name: 'Acier', top: 'steel', side: 'steel', bottom: 'steel' },
  246: { name: 'Acier assombri', top: 'dark_steel', side: 'dark_steel', bottom: 'dark_steel' },
  247: { name: 'Vieux acier', top: 'old_steel', side: 'old_steel', bottom: 'old_steel' },
  199: { name: 'Hélice (allumée)', top: 'propeller_top_on', side: 'propeller_side_on', bottom: 'propeller_bottom_on', hidden: true, pick: 198 },
  // herbe haute : pousse d'elle-même sur l'herbe (voir nature.js) ; se dessine comme une pousse
  // (sapling), mais ne grandit pas
  196: { name: 'Herbe haute', top: 'tall_grass', side: 'tall_grass', bottom: 'tall_grass', sapling: true, grass: true, item: 'texture/plantes/herbe_haute.png' },
  77: { name: 'Feuilles enneigées', top: 'snowy_leaves', side: 'snowy_leaves', bottom: 'snowy_leaves', hidden: true, pick: 39 },
  // TNT 1000 : 1000 fois la puissance d'une TNT (voir tnt.js), arme de destruction massive
  78: { name: 'TNT 1000', top: 'tnt_1000_top', side: 'tnt_1000_side', bottom: 'tnt_1000_bottom', tnt: true, big: true },
  // levier : se pose sur un bloc ; clic droit, il bascule et donne du courant de voltite
  // (comme le bloc de voltite) tant qu'il est levé (voir circuits.js)
  79: { name: 'Levier', top: 'cobblestone', side: 'cobblestone', bottom: 'cobblestone', lever: true, item: 'texture/blocs/levier/lever.png' },
  // gravitron : sur un objet physique, pilote ses blocs physiques allumés jusqu'à des
  // coordonnées (clé à molette : mode missile, avion ou bateau ; voir structs.js)
  // bloc de structure (créatif) : clic droit, enregistre ou reconstruit une structure (structures.js)
  82: { name: 'Bloc de structure', top: 'structure_block', side: 'structure_block', bottom: 'structure_block' },
  81: { name: 'Gravitron', top: 'gravitron_top', side: 'gravitron_side', bottom: 'gravitron_top' },
  // platine (pioche en fer) et tungstène (pioche en platine) : minerais plus rares et plus
  // profonds que le fer, lingots au four, outils plus rapides
  83: { name: 'Minerai de platine', top: 'platinum_ore', side: 'platinum_ore', bottom: 'platinum_ore' },
  84: { name: 'Bloc de platine', top: 'platinum_block', side: 'platinum_block', bottom: 'platinum_block' },
  85: { name: 'Minerai de tungstène', top: 'tungsten_ore', side: 'tungsten_ore', bottom: 'tungsten_ore' },
  86: { name: 'Bloc de tungstène', top: 'tungsten_block', side: 'tungsten_block', bottom: 'tungsten_block' },
  // fluorite (pioche en fer, entre le fer et le platine : près de 0) et cramoisite (pioche en
  // tungstène, tout au fond des profondeurs, deux fois plus rare que le tungstène) : minerais,
  // lingots au four, blocs
  640: { name: 'Minerai de fluorite', top: 'fluorite_ore', side: 'fluorite_ore', bottom: 'fluorite_ore' },
  641: { name: 'Bloc de fluorite', top: 'fluorite_block', side: 'fluorite_block', bottom: 'fluorite_block' },
  642: { name: 'Minerai de cramoisite', top: 'crimsonite_ore', side: 'crimsonite_ore', bottom: 'crimsonite_ore' },
  643: { name: 'Bloc de cramoisite', top: 'crimsonite_block', side: 'crimsonite_block', bottom: 'crimsonite_block' },
  // voltite impure (pioche en pierre) : son fil bleu ne se relie pas au fil de voltite
  // (on peut poser les deux côte à côte), mais alimente les mêmes choses
  87: { name: 'Minerai de voltite impure', top: 'impure_voltite_ore', side: 'impure_voltite_ore', bottom: 'impure_voltite_ore' },
  88: { name: 'Fil de voltite impure', top: 'impure_wire_off', side: 'impure_wire_off', bottom: 'impure_wire_off', wire: true, hidden: true, pick: 132 },
  89: { name: 'Fil de voltite impure (allumé)', top: 'impure_wire_on', side: 'impure_wire_on', bottom: 'impure_wire_on', wire: true, hidden: true, pick: 132 },
  // lave qui coule (comme l'eau, mais moins loin et plus lentement : voir world.js) :
  // 90..92 = force 2..0 (90 près de la source), 93 = lave qui tombe
  90: { name: 'Lave', top: 'lava', side: 'lava', bottom: 'lava', lava: true, flow: true, glow: true, light: 4, hidden: true, pick: 72 },
  91: { name: 'Lave', top: 'lava', side: 'lava', bottom: 'lava', lava: true, flow: true, glow: true, light: 4, hidden: true, pick: 72 },
  92: { name: 'Lave', top: 'lava', side: 'lava', bottom: 'lava', lava: true, flow: true, glow: true, light: 4, hidden: true, pick: 72 },
  93: { name: 'Lave', top: 'lava', side: 'lava', bottom: 'lava', lava: true, flow: true, glow: true, light: 4, hidden: true, pick: 72 },
  // lampe de voltite : s'allume quand elle reçoit du courant (comme la lampe de redstone)
  94: { name: 'Lampe de voltite', top: 'lamp_off', side: 'lamp_off', bottom: 'lamp_off' },
  95: { name: 'Lampe de voltite (allumée)', top: 'lamp_on', side: 'lamp_on', bottom: 'lamp_on', light: 5, hidden: true, pick: 94 },
  // pousse de grand chêne : devient un grand chêne (celui de la grande forêt, voir nature.js)
  96: { name: 'Pousse de grand chêne', top: 'big_oak_sapling', side: 'big_oak_sapling', bottom: 'big_oak_sapling', sapling: true, big: true, item: 'texture/plantes/big_oak_sapling.png' },
  80: { name: 'Levier (activé)', top: 'cobblestone', side: 'cobblestone', bottom: 'cobblestone', lever: true, hidden: true, pick: 79, item: 'texture/blocs/levier/lever.png' },
  // bouleau (forêts) : tronc blanc, feuillage clair
  256: { name: 'Bûche de bouleau', top: 'birch_log_top', side: 'birch_log', bottom: 'birch_log_top', log: true },
  257: { name: 'Feuilles de bouleau', top: 'birch_leaves', side: 'birch_leaves', bottom: 'birch_leaves', leaves: true, placedAs: 259 },
  258: { name: 'Planches de bouleau', top: 'birch_planks', side: 'birch_planks', bottom: 'birch_planks' },
  259: { name: 'Feuilles de bouleau', top: 'birch_leaves', side: 'birch_leaves', bottom: 'birch_leaves', hidden: true, pick: 257 },
  // pousse de bouleau : devient un bouleau (voir nature.js)
  260: { name: 'Pousse de bouleau', top: 'birch_sapling', side: 'birch_sapling', bottom: 'birch_sapling', sapling: true, birch: true, item: 'texture/plantes/birch_sapling.png' },
  // diorite : en poches dans la pierre ; polie et en briques à la table de craft
  261: { name: 'Diorite', top: 'diorite', side: 'diorite', bottom: 'diorite' },
  262: { name: 'Diorite polie', top: 'polished_diorite', side: 'polished_diorite', bottom: 'polished_diorite' },
  263: { name: 'Briques de diorite', top: 'diorite_bricks', side: 'diorite_bricks', bottom: 'diorite_bricks' },
  // fer industriel : plaques de fer rivetées (aussi cuivrées ou rouillées)
  264: { name: 'Fer industriel', top: 'industrial_iron', side: 'industrial_iron', bottom: 'industrial_iron' },
  265: { name: 'Fer industriel cuivré', top: 'industrial_iron_copper', side: 'industrial_iron_copper', bottom: 'industrial_iron_copper' },
  266: { name: 'Fer industriel rouillé', top: 'industrial_iron_rusty', side: 'industrial_iron_rusty', bottom: 'industrial_iron_rusty' },
  // Pistons : alimentés (voltite), ils sortent leur tête et poussent les blocs devant eux
  // (jusqu'à PISTON_PUSH). Vers le haut (piston : 1), ou vers le bas (-1 : posés sous un
  // bloc). Le piston sorti a sa tête dans la case suivante (voir circuits.js)
  279: { name: 'Piston', top: 'piston_face', side: 'piston_side_head', bottom: 'piston_bottom', piston: 1 },
  280: { name: 'Piston (sorti)', top: 'piston_bottom', side: 'piston_side', bottom: 'piston_bottom', piston: 1, extended: true, hidden: true, pick: 279 },
  281: { name: 'Tête de piston', top: 'piston_face', side: 'piston_side_head', bottom: 'piston_face', pistonHead: 1, shape: 'piston_head', hidden: true, pick: 279 },
  282: { name: 'Piston (vers le bas)', top: 'piston_bottom', side: 'piston_side_head_down', bottom: 'piston_face', piston: -1, hidden: true, pick: 279 },
  283: { name: 'Piston (vers le bas, sorti)', top: 'piston_bottom', side: 'piston_side_down', bottom: 'piston_bottom', piston: -1, extended: true, hidden: true, pick: 279 },
  284: { name: 'Tête de piston', top: 'piston_face', side: 'piston_side_head_down', bottom: 'piston_face', pistonHead: -1, shape: 'piston_head', hidden: true, pick: 279 },
  // terre labourée (la houe, clic droit sur de l'herbe ou de la terre) : on y sème le blé
  285: { name: 'Terre labourée', top: 'farmland', side: 'dirt', bottom: 'dirt', pick: 2 },
  // terre labourée humide (de l'eau à moins de 4 cases, voir nature.js) : les cultures y poussent
  // plus vite
  455: { name: 'Terre labourée humide', top: 'farmland_wet', side: 'dirt', bottom: 'dirt', hidden: true, pick: 2 },
  // rail de train : un nœud de la voie du train, dans l'un des 3 axes de la grille (456, 473, 474) ;
  // la voie est dessinée à part, en relief (voir tracks.js)
  456: { name: 'Rail de train', top: 'train_rail', side: 'train_rail', bottom: 'train_rail', track: 0, item: 'texture/objets/train/rail_train_hex.png' },
  473: { name: 'Rail de train', top: 'train_rail', side: 'train_rail', bottom: 'train_rail', track: 1, hidden: true, pick: 456, item: 'texture/objets/train/rail_train_hex.png' },
  474: { name: 'Rail de train', top: 'train_rail', side: 'train_rail', bottom: 'train_rail', track: 2, hidden: true, pick: 456, item: 'texture/objets/train/rail_train_hex.png' },
  // plateau du wagon plat (voir trains.js) : le sol sur lequel on construit ; il ne se casse pas
  475: { name: 'Plateau de wagon', top: 'oak_planks', side: 'dark_steel', bottom: 'dark_steel', unbreakable: true, hidden: true, deck: true },
};
// Blé : 14 stades de pousse (286 = semé ... 299 = mûr), sur la terre labourée (voir nature.js)
export const FARMLAND = 285, FARMLAND_WET = 455, WHEAT_CROP = 286, WHEAT_RIPE = 299;
export const isFarmland = (id) => id === FARMLAND || id === FARMLAND_WET;
for (let k = 0; k <= WHEAT_RIPE - WHEAT_CROP; k++) {
  BLOCKS[WHEAT_CROP + k] = {
    name: k === WHEAT_RIPE - WHEAT_CROP ? 'Blé mûr' : 'Blé', top: 'wheat_' + k, side: 'wheat_' + k, bottom: 'wheat_' + k,
    sapling: true, crop: k, hidden: true, pick: 425,
  };
}
// Pomme de terre : 8 stades (433 = plantée ... 440 = mûre), sur la terre labourée aussi ; on
// plante la pomme de terre elle-même (441)
export const POTATO_CROP = 433, POTATO_RIPE = 440, POTATO = 441, BAKED_POTATO = 442;
for (let k = 0; k <= POTATO_RIPE - POTATO_CROP; k++) {
  BLOCKS[POTATO_CROP + k] = {
    name: k === POTATO_RIPE - POTATO_CROP ? 'Pommes de terre mûres' : 'Pommes de terre', top: 'potato_' + k, side: 'potato_' + k, bottom: 'potato_' + k,
    sapling: true, crop: k, hidden: true, pick: POTATO,
  };
}
BLOCKS[WHEAT_RIPE].ripe = BLOCKS[POTATO_RIPE].ripe = true;
// Lit de villageois : une capsule hexagonale de deux blocs de haut, en planches dehors et garnie
// de laine dedans, ouverte d'un côté (comme les couchettes de la station). POD + k : le bas,
// ouvert côté k ; POD_TOP + k : le haut. On pose le bas (POD), le haut vient avec ; on entre
// dedans (pas un bloc plein). Les villageois y dorment (voir colony.js).
export const POD = 443, POD_TOP = 449;
for (let k = 0; k < 6; k++) {
  BLOCKS[POD + k] = { name: 'Lit de villageois', top: 'oak_planks', side: 'oak_planks', bottom: 'oak_planks', pod: k, shape: 'pod', ...(k ? { hidden: true, pick: POD } : {}) };
  BLOCKS[POD_TOP + k] = { name: 'Lit de villageois', top: 'oak_planks', side: 'oak_planks', bottom: 'oak_planks', pod: k, podTop: true, shape: 'pod', hidden: true, pick: POD };
}
export const isPod = (id) => id >= POD && id < POD_TOP + 6;
export const isCrop = (id) => (id >= WHEAT_CROP && id <= WHEAT_RIPE) || (id >= POTATO_CROP && id <= POTATO_RIPE);

// Blocs orientés (four, coffre) : une variante par côté de l'hexagone, selon la direction
// de la face avant. On pose la variante tournée vers le joueur (voir facingVariant) ;
// toutes redonnent la première une fois cassées.
export const FURNACE = 42, FURNACE_ON = 48, CHEST = 54;
const facingSides = (front, side, k) => Array.from({ length: 6 }, (_, i) => (i === k ? front : side));
for (let k = 0; k < 6; k++) {
  BLOCKS[FURNACE + k] = {
    name: 'Four', top: 'furnace_top', side: 'furnace_side', bottom: 'furnace_top',
    sides: facingSides('furnace_front', 'furnace_side', k), facing: k, base: FURNACE, pick: FURNACE, hidden: k > 0, container: 'furnace',
  };
  // four allumé : sa face avant rougeoie et il éclaire autour de lui comme une torche
  BLOCKS[FURNACE_ON + k] = {
    name: 'Four (allumé)', top: 'furnace_top', side: 'furnace_side', bottom: 'furnace_top',
    sides: facingSides('furnace_front_on', 'furnace_side', k), facing: k, base: FURNACE_ON, pick: FURNACE, hidden: true, container: 'furnace', light: 3,
  };
  // coffre : un peu plus petit qu'un bloc, avec son couvercle et son loquet (voir drawChest)
  BLOCKS[CHEST + k] = {
    name: 'Coffre', top: 'chest_top', side: 'chest_side', bottom: 'chest_bottom',
    sides: facingSides('chest_front', 'chest_side', k), facing: k, base: CHEST, pick: CHEST, hidden: k > 0, container: 'chest', shape: 'chest',
  };
}
// Ordinateur et serveur : une texture différente sur chacun des 6 côtés, la première (l'écran,
// la façade) tournée vers le joueur qui le pose
export const COMPUTER = 267, SERVER = 273;
const COMPUTER_FACES = ['computer_screen', 'computer_ports', 'computer_vent', 'computer_bays', 'computer_circuits', 'computer_reactor'];
const SERVER_FACES = [1, 2, 3, 4, 5, 6].map((n) => 'server_side_' + n);
for (let k = 0; k < 6; k++) {
  BLOCKS[COMPUTER + k] = {
    name: 'Ordinateur', top: 'computer_top', side: 'computer_ports', bottom: 'computer_bottom',
    sides: COMPUTER_FACES.map((_, i) => COMPUTER_FACES[(i - k + 6) % 6]), facing: k, base: COMPUTER, pick: COMPUTER, hidden: k > 0,
  };
  BLOCKS[SERVER + k] = {
    name: 'Serveur', top: 'server_top', side: 'server_side_2', bottom: 'server_bottom',
    sides: SERVER_FACES.map((_, i) => SERVER_FACES[(i - k + 6) % 6]), facing: k, base: SERVER, pick: SERVER, hidden: k > 0,
  };
}
// Gare (voir trains.js) : posée à côté d'une voie, les trains en pilote automatique s'y arrêtent
// 10 secondes. Son panneau est tourné vers le joueur qui la pose (vers la voie, d'habitude)
export const STATION = 484;
const STATION_FACES = ['gare_panneau', 'gare_horloge', 'gare_fenetre', 'gare_porte', 'gare_lampe', 'gare_mur'];
for (let k = 0; k < 6; k++) {
  BLOCKS[STATION + k] = {
    name: 'Gare', top: 'gare_dessus', side: 'gare_mur', bottom: 'gare_dessous', light: 2,
    sides: STATION_FACES.map((_, i) => STATION_FACES[(i - k + 6) % 6]), facing: k, base: STATION, pick: STATION, hidden: k > 0, station: true,
  };
}
export const isStation = (id) => id >= STATION && id < STATION + 6;
// Butoir (bout de voie) et panneau de limitation de vitesse : dessinés en relief par la voie
// (voir tracks.js), orientés vers le joueur qui les pose. Détecteur de train : sous la voie, il
// donne du courant quand une voiture passe dessus (allumé : une source, comme un levier)
export const BUFFER_STOP = 565, SPEED_SIGN = 571, DETECTOR = 577, DETECTOR_ON = 578;
for (let k = 0; k < 6; k++) {
  BLOCKS[BUFFER_STOP + k] = { name: 'Butoir', top: 'dark_steel', side: 'dark_steel', bottom: 'dark_steel', prop: 'buffer', facing: k, base: BUFFER_STOP, pick: BUFFER_STOP, hidden: k > 0, item: 'texture/objets/train/tampon_choc_hex.png' };
  BLOCKS[SPEED_SIGN + k] = { name: 'Panneau de limitation de vitesse', top: 'dark_steel', side: 'dark_steel', bottom: 'dark_steel', prop: 'sign', facing: k, base: SPEED_SIGN, pick: SPEED_SIGN, hidden: k > 0, item: 'texture/objets/train/panneau_vitesse_hex.png' };
}
// Signal : un mât et deux feux (rouge en haut, vert en bas), tournés vers les trains qui
// arrivent : rouge tant qu'un train occupe la voie jusqu'au signal suivant (ou qu'il reçoit du
// courant) ; les trains en pilote automatique s'y arrêtent (voir tracks.js, updateSignals)
export const RAIL_SIGNAL = 768;
for (let k = 0; k < 6; k++) BLOCKS[RAIL_SIGNAL + k] = { name: 'Signal ferroviaire', top: 'dark_steel', side: 'dark_steel', bottom: 'dark_steel', prop: 'signal', facing: k, base: RAIL_SIGNAL, pick: RAIL_SIGNAL, hidden: k > 0, item: 'texture/objets/train/signal_hex.png' };
BLOCKS[DETECTOR] = { name: 'Détecteur de train', top: 'old_steel', side: 'dark_steel', bottom: 'dark_steel', detector: true };
BLOCKS[DETECTOR_ON] = { name: 'Détecteur de train', top: 'lamp_on', side: 'dark_steel', bottom: 'dark_steel', detector: true, hidden: true, pick: DETECTOR };
// (wagon plat à étage : ses montants et son garde-corps, incassables comme le plateau)
BLOCKS[579] = { name: 'Montant de wagon', top: 'dark_steel', side: 'dark_steel', bottom: 'dark_steel', unbreakable: true, hidden: true, deck: true };
BLOCKS[580] = { name: 'Garde-corps de wagon', top: 'dark_steel', side: 'dark_steel', bottom: 'dark_steel', slab: 'bottom', unbreakable: true, hidden: true, deck: true };
export const isProp = (id) => !!BLOCKS[id]?.prop;
export const isDetector = (id) => id === DETECTOR || id === DETECTOR_ON;
// Variante de id tournée vers le côté k (ou id s'il n'est pas orienté)
export function facingVariant(id, k) {
  const b = BLOCKS[id];
  return b && b.base !== undefined ? b.base + k : id;
}
// Répéteurs (comme ceux de Minecraft) : plaque de pierre posée au sol, orientée. Le courant
// entre par l'arrière (le côté tourné vers le joueur qui l'a posé) et ressort à pleine force
// (15) par l'avant, après un court délai, dans un seul sens. Rouge : il alimente le fil de
// voltite ; bleu : celui de voltite impure (il accepte le courant des deux à l'arrière).
// Une variante par sorte (rouge, bleu), par état (éteint, allumé) et par côté.
export const REPEATER = 210; // 210-215 rouge éteint, 216-221 allumé, 222-227 bleu éteint, 228-233 allumé
for (let kind = 1; kind <= 2; kind++) {
  for (let on = 0; on < 2; on++) {
    for (let k = 0; k < 6; k++) {
      const base = REPEATER + (kind - 1) * 12, color = kind === 1 ? 'red' : 'blue';
      const tex = 'repeater_' + color + (on ? '' : '_off');
      BLOCKS[base + on * 6 + k] = {
        name: kind === 1 ? 'Répéteur de voltite' : 'Répéteur de voltite impure',
        top: tex, side: 'stone', bottom: 'stone', repeater: kind, facing: k, base: base + on * 6, pick: base,
        hidden: on > 0 || k > 0, item: 'texture/objets/repeater_' + color + '.png',
      };
    }
  }
}
// Inverseurs : comme un répéteur, mais à l'envers : sans courant à l'arrière, il en donne par
// l'avant ; avec du courant à l'arrière, il n'en donne plus (plaque de basalte, plus sombre).
export const INVERTER = 170; // 170-175 rouge éteint, 176-181 allumé, 182-187 bleu éteint, 188-193 allumé
for (let kind = 1; kind <= 2; kind++) {
  for (let on = 0; on < 2; on++) {
    for (let k = 0; k < 6; k++) {
      const base = INVERTER + (kind - 1) * 12, color = kind === 1 ? 'red' : 'blue';
      BLOCKS[base + on * 6 + k] = {
        name: kind === 1 ? 'Inverseur de voltite' : 'Inverseur de voltite impure',
        top: 'inverter_' + color + (on ? '' : '_off'), side: 'basalt', bottom: 'basalt', repeater: kind, invert: true,
        facing: k, base: base + on * 6, pick: base, hidden: on > 0 || k > 0, item: 'texture/objets/inverter_' + color + '.png',
      };
    }
  }
}
export const isInverter = (id) => id >= INVERTER && id < INVERTER + 24;
// (répéteurs et inverseurs : mêmes plaques, mêmes côtés ; seule la sortie change)
export const isRepeater = (id) => (id >= REPEATER && id < REPEATER + 24) || isInverter(id);
const repBase = (id) => (isInverter(id) ? INVERTER : REPEATER);
// Torches murales : posées contre le côté d'un bloc, penchées (wall : côté où est le bloc qui
// la tient, voir NEIGHBORS). Cassées, elles redonnent une torche.
export const WALL_TORCH = 234; // 234-239
for (let k = 0; k < 6; k++) {
  BLOCKS[WALL_TORCH + k] = { name: 'Torche', top: 'torch', side: 'torch', bottom: 'torch', torch: true, light: 1, wall: k, hidden: true, pick: 23 };
}
export const isWallTorch = (id) => id >= WALL_TORCH && id < WALL_TORCH + 6;
export const repeaterKind = (id) => (id - repBase(id) < 12 ? 1 : 2);
export const isRepeaterOn = (id) => isRepeater(id) && (id - repBase(id)) % 12 >= 6;
export const repeaterIn = (id) => (id - repBase(id)) % 6;            // côté d'entrée (arrière)
export const repeaterOut = (id) => ((id - repBase(id)) % 6 + 3) % 6; // côté de sortie (avant)
export const repeaterState = (id, on) => repBase(id) + (repeaterKind(id) - 1) * 12 + (on ? 6 : 0) + repeaterIn(id);

export const isFurnace = (id) => BLOCKS[id]?.container === 'furnace';

// Durabilité des outils (survie) : nombre d'utilisations selon la matière (tier). Un outil
// usé porte w (utilisations déjà faites) dans sa case ; sans w, il est neuf.
// (paliers : 1 bois, 2 rustique, 3 pierre, 4 fer, 5 fluorite, 6 platine, 7 tungstène, 8 cramoisite)
export const DURABILITY = { 1: 60, 2: 100, 3: 132, 4: 250, 5: 400, 6: 600, 7: 1500, 8: 3000 };
export const durability = (id) => (ITEMS[id]?.tool ? DURABILITY[ITEMS[id].tier] || 0 : 0);
// Case { id, n } (avec son usure w si c'est un outil entamé, valeur vérifiée)
// (une photo : w est son numéro, voir photos.js)
export const makeSlot = (id, n, w) => (Number.isInteger(w) && w > 0 && (w < durability(id) || ITEMS[id]?.photo || ITEMS[id]?.doc) ? { id, n, w } : { id, n });
export const isChest = (id) => BLOCKS[id]?.container === 'chest';

// Hauteurs occupées dans la case (0..1) : [bas, haut]
export const isSlab = (id) => !!BLOCKS[id]?.slab;
export function blockBox(id) {
  if (BLOCKS[id]?.height) return [0, BLOCKS[id].height]; // (tapis roulant : une plaque basse)
  const s = BLOCKS[id]?.slab;
  return s === 'bottom' ? [0, 0.5] : s === 'top' ? [0.5, 1] : [0, 1];
}

export const RAIL = 17;
export const POWERED_RAIL = 19;
export const POWERED_RAIL_OFF = 20;
export const DIAMOND_RAIL = 21;
export const DIAMOND_RAIL_OFF = 22;
export const TORCH = 23;
export const TNT = 26;
export const BIG_TNT = 27;
export const CRAFTING_TABLE = 31;
export const SNOW_GRASS = 36, SNOW = 37, CACTUS = 38, SNOW_LEAVES = 39;
export const GLASS = 40, TNT_200 = 41;
export const IRON_ORE = 60, VOLTITE_ORE = 61, IRON_BLOCK = 62, VOLTITE_BLOCK = 63;
export const WIRE = 64, WIRE_ON = 65, PHYSICS = 66, PHYSICS_ON = 67;
export const PLATINUM_ORE = 83, PLATINUM_BLOCK = 84, TUNGSTEN_ORE = 85, TUNGSTEN_BLOCK = 86;
export const FLUORITE_ORE = 640, FLUORITE_BLOCK = 641, CRIMSONITE_ORE = 642, CRIMSONITE_BLOCK = 643;
export const IMPURE_VOLTITE_ORE = 87, IWIRE = 88, IWIRE_ON = 89;
export const isWire = (id) => id === WIRE || id === WIRE_ON || id === IWIRE || id === IWIRE_ON;
// Deux sortes de fil (voltite, voltite impure) : seuls les fils de la même sorte se relient
export const wireKind = (id) => (id === WIRE || id === WIRE_ON ? 1 : id === IWIRE || id === IWIRE_ON ? 2 : 0);
export const isWireOn = (id) => id === WIRE_ON || id === IWIRE_ON;
// fil de la même sorte que id, allumé ou éteint
export const wireState = (id, on) => (wireKind(id) === 2 ? (on ? IWIRE_ON : IWIRE) : on ? WIRE_ON : WIRE);
export const BASALT = 68, ASH = 69, SULFUR = 70, TUFF = 71, LAVA = 72, MAGMA = 73, OBSIDIAN = 74;
// Lave : 72 = source, 90..92 = lave qui coule (force 2..0), 93 = lave qui tombe
export const LAVA_FALL = 93;
export const isLava = (id) => id === 72 || (id >= 90 && id <= 93);
export const lavaFlowId = (strength) => 92 - strength;
export function lavaStrength(id) {
  if (id === 72 || id === LAVA_FALL) return 3;
  if (id >= 90 && id <= 92) return 92 - id;
  return -1;
}
// Hauteur de la lave dans le bloc (0..1)
export const lavaHeight = (id) => (id === 72 || id === LAVA_FALL ? 1 : 0.25 + lavaStrength(id) * 0.22);
export const LAMP = 94, LAMP_ON = 95, BIG_SAPLING = 96;
export const isLamp = (id) => id === LAMP || id === LAMP_ON;
export const SAPLING = 75, LEAVES_PLACED = 76, SNOW_LEAVES_PLACED = 77, TNT_1000 = 78;
export const WOOL_WHITE = 194, WOOL_GREY = 195, TALL_GRASS = 196;
export const CHESTNUT_LOG = 97, CHESTNUT_LEAVES = 98, CHESTNUT_PLANKS = 99, CHESTNUT_LEAVES_PLACED = 144, CHESTNUT_SAPLING = 145;
// outils en châtaignier : comme ceux en bois (même palier), avec leur propre apparence
export const CHESTNUT_STICK = 146, CHESTNUT_PICKAXE = 147, CHESTNUT_AXE = 148, CHESTNUT_SHOVEL = 149, CHESTNUT_SWORD = 150, CHESTNUT_HOE = 151;
export const LINDEN_LOG = 152, LINDEN_LEAVES = 153, LINDEN_PLANKS = 154, LINDEN_LEAVES_PLACED = 155, LINDEN_SAPLING = 156;
// outils en tilleul : comme ceux en bois (même palier), avec leur propre apparence
// nourriture : food = points de faim rendus en la mangeant (clic droit, en survie ; elle
// soigne aussi un peu, voir Survival.eat)
export const RAW_PORK = 163, COOKED_PORK = 164;
export const LINDEN_STICK = 157, LINDEN_PICKAXE = 158, LINDEN_AXE = 159, LINDEN_SHOVEL = 160, LINDEN_SWORD = 161, LINDEN_HOE = 162;
export const isLog = (id) => !!BLOCKS[id]?.log;
// bouleau, diorite, fer industriel, pistons
export const BIRCH_LOG = 256, BIRCH_LEAVES = 257, BIRCH_PLANKS = 258, BIRCH_LEAVES_PLACED = 259, BIRCH_SAPLING = 260;
export const BIRCH_STICK = 300, BIRCH_PICKAXE = 301, BIRCH_AXE = 302, BIRCH_SHOVEL = 303, BIRCH_SWORD = 304, BIRCH_HOE = 305;
export const DIORITE = 261, POLISHED_DIORITE = 262, DIORITE_BRICKS = 263;
export const DIORITE_PICKAXE = 306, DIORITE_AXE = 307, DIORITE_SHOVEL = 308, DIORITE_SWORD = 309, DIORITE_HOE = 310;
export const INDUSTRIAL_IRON = 264, INDUSTRIAL_IRON_COPPER = 265, INDUSTRIAL_IRON_RUSTY = 266;
export const PISTON = 279, PISTON_ON = 280, PISTON_HEAD = 281, PISTON_DOWN = 282, PISTON_DOWN_ON = 283, PISTON_DOWN_HEAD = 284;
export const PISTON_PUSH = 12; // blocs poussés au plus
export const isPiston = (id) => !!BLOCKS[id]?.piston;
export const isPistonHead = (id) => !!BLOCKS[id]?.pistonHead;
// objets de la forge, électronique
export const CHISEL = 322, FORGE_COAL = 323, FILE = 324, HOT_INGOT = 325, SLEDGEHAMMER = 326, QUENCH_BUCKET = 327;
export const CIRCUIT = 311;
export const LEVER = 79, LEVER_ON = 80, GRAVITRON = 81;
// blocs qui ont des réglages (clé à molette) : bloc physique, gravitron
export const hasParams = (id) => id === 66 || id === 67 || id === GRAVITRON || (id >= 4128 && id < 4134); // (4128 : pilote de route)
export const isLever = (id) => id === LEVER || id === LEVER_ON || isAnalog(id);
// feuilles qui peuvent disparaître (celles des arbres, pas celles posées par le joueur)
export const isNaturalLeaves = (id) => !!BLOCKS[id]?.leaves;
export const isPhysics = (id) => id === PHYSICS || id === PHYSICS_ON;
export const PROPELLER = 198, PROPELLER_ON = 199;
export const isPropeller = (id) => id === PROPELLER || id === PROPELLER_ON;
export const STABILIZER = 241, STABILIZER_ON = 242;
export const isStabilizer = (id) => id === STABILIZER || id === STABILIZER_ON;
export const TARGET = 243, GRAVEL = 244;
export const STEEL = 245, DARK_STEEL = 246, OLD_STEEL = 247;
// donne du courant : bloc de voltite, torche d'énergie allumée
export const isSource = (id) => id === VOLTITE_BLOCK || id === 24 || id === 80 || id === 578 || id === 3939 || (id > ANALOG && id < ANALOG + 16); // (3939 : récepteur sans fil allumé ; levier analogique levé)
// La puissance que donne une source : 15, ou le cran d'un levier analogique (voir circuits.level)
export const srcLevel = (id) => (isAnalog(id) ? id - ANALOG : isSource(id) ? 15 : 0);
export const isTnt = (id) => id === TNT || id === BIG_TNT || id === TNT_200 || id === TNT_1000 || id === FUEL_BLOCK;
export const ENERGY_TORCH = 24;
export const ENERGY_TORCH_OFF = 25;
export const TRAIN_RAIL = 456;
export const isRail = (id) => (id >= 19 && id <= 22) || id === RAIL;
export const isTorch = (id) => (id >= 23 && id <= 25) || (id >= 234 && id <= 239);
// Blocs qui s'allument / s'éteignent au clic droit
export const TOGGLE = { 19: 20, 20: 19, 21: 22, 22: 21, 24: 25, 25: 24, 79: 80, 80: 79 };

// Objets (pas des blocs : ils ne vont jamais dans le monde) — ids à partir de 100
export const HEXACART = 100;
export const GLUE = 101;
export const GRAVITY_HAND = 102;
export const DOUBLE_GLUE = 209;
export const ROPE = 240;
export const STICK = 103;
export const COAL = 104;
export const WOODEN_PICKAXE = 105, WOODEN_AXE = 106, WOODEN_SHOVEL = 107, WOODEN_SWORD = 108, WOODEN_HOE = 109;
export const PEBBLE = 110;
export const RUSTIC_PICKAXE = 111, RUSTIC_AXE = 112, RUSTIC_SHOVEL = 113, RUSTIC_SWORD = 114, RUSTIC_HOE = 115;
export const STONE_PICKAXE = 116, STONE_AXE = 117, STONE_SHOVEL = 118, STONE_SWORD = 119, STONE_HOE = 120;
export const SNOWBALL = 121;
export const IRON_INGOT = 122, VOLTITE = 123, WRENCH = 124;
export const IRON_PICKAXE = 125, IRON_AXE = 126, IRON_SHOVEL = 127, IRON_SWORD = 128, IRON_HOE = 129;
export const PLATINUM_INGOT = 130, TUNGSTEN_INGOT = 131, IMPURE_VOLTITE = 132, PLATINUM_STICK = 133;
export const PLATINUM_PICKAXE = 134, PLATINUM_AXE = 135, PLATINUM_SHOVEL = 136, PLATINUM_SWORD = 137, PLATINUM_HOE = 138;
export const TUNGSTEN_PICKAXE = 139, TUNGSTEN_AXE = 140, TUNGSTEN_SHOVEL = 141, TUNGSTEN_SWORD = 142, TUNGSTEN_HOE = 143;
export const FLUORITE_INGOT = 644, CRIMSONITE_INGOT = 645;
export const FLUORITE_PICKAXE = 646, FLUORITE_AXE = 647, FLUORITE_SHOVEL = 648, FLUORITE_SWORD = 649, FLUORITE_HOE = 650;
export const CRIMSONITE_PICKAXE = 651, CRIMSONITE_AXE = 652, CRIMSONITE_SHOVEL = 653, CRIMSONITE_SWORD = 654, CRIMSONITE_HOE = 655;
export const ITEMS = {
  [HEXACART]: { name: 'Hexacart', icon: 'texture/entites/hexacart/hexacart.png' },
  // colle des blocs entre eux : ils forment un objet qu'on peut pousser (voir structs.js)
  [GLUE]: { name: 'Super colle', icon: 'texture/objets/super_glue.png' },
  // colle deux objets collés l'un à l'autre : ils n'en font plus qu'un (voir structs.merge)
  [DOUBLE_GLUE]: { name: 'Double colle', icon: 'texture/objets/double_glue.png' },
  // tendue entre deux blocs (du monde ou d'objets collés) : retient, suspend, remorque (voir ropes.js)
  [ROPE]: { name: 'Corde', icon: 'texture/objets/rope.png' },
  // attrape un objet collé et le déplace, quel que soit son poids (voir structs.js)
  [GRAVITY_HAND]: { name: 'Main gravitationnelle', icon: 'texture/objets/gravity_hand.png' },
  // ingrédient (outils, torches)
  [STICK]: { name: 'Bâton', icon: 'texture/objets/stick.png' },
  // obtenu en cassant du minerai de charbon avec une pioche
  [COAL]: { name: 'Charbon', icon: 'texture/objets/coal.png', small: true },
  // (small : petit objet rond, tenu plus petit dans la main, voir held.js)
  // Outils : cassent plus vite les blocs de leur matière (voir survival.js). tier : 1 = bois,
  // 2 = cailloux (rustiques), 3 = pierre. La pierre cassée avec une pioche en bois ne donne que des
  // cailloux ; il faut une pioche rustique pour récupérer de la pierre taillée.
  [WOODEN_PICKAXE]: { name: 'Pioche en bois', icon: 'texture/outils/bois/pickaxe.png', tool: 'pickaxe', tier: 1, stack: 1 },
  [WOODEN_AXE]: { name: 'Hache en bois', icon: 'texture/outils/bois/axe.png', tool: 'axe', tier: 1, stack: 1 },
  [WOODEN_SHOVEL]: { name: 'Pelle en bois', icon: 'texture/outils/bois/shovel.png', tool: 'shovel', tier: 1, stack: 1 },
  [WOODEN_SWORD]: { name: 'Épée en bois', icon: 'texture/outils/bois/sword.png', tool: 'sword', tier: 1, stack: 1 },
  [WOODEN_HOE]: { name: 'Houe en bois', icon: 'texture/outils/bois/hoe.png', tool: 'hoe', tier: 1, stack: 1 },
  146: { name: 'Bâton de châtaignier', icon: 'texture/objets/chestnut_stick.png' },
  147: { name: 'Pioche en châtaignier', icon: 'texture/outils/chataignier/pickaxe.png', tool: 'pickaxe', tier: 1, stack: 1 },
  148: { name: 'Hache en châtaignier', icon: 'texture/outils/chataignier/axe.png', tool: 'axe', tier: 1, stack: 1 },
  149: { name: 'Pelle en châtaignier', icon: 'texture/outils/chataignier/shovel.png', tool: 'shovel', tier: 1, stack: 1 },
  150: { name: 'Épée en châtaignier', icon: 'texture/outils/chataignier/sword.png', tool: 'sword', tier: 1, stack: 1 },
  151: { name: 'Houe en châtaignier', icon: 'texture/outils/chataignier/hoe.png', tool: 'hoe', tier: 1, stack: 1 },
  157: { name: 'Bâton de tilleul', icon: 'texture/objets/linden_stick.png' },
  158: { name: 'Pioche en tilleul', icon: 'texture/outils/tilleul/pickaxe.png', tool: 'pickaxe', tier: 1, stack: 1 },
  159: { name: 'Hache en tilleul', icon: 'texture/outils/tilleul/axe.png', tool: 'axe', tier: 1, stack: 1 },
  160: { name: 'Pelle en tilleul', icon: 'texture/outils/tilleul/shovel.png', tool: 'shovel', tier: 1, stack: 1 },
  161: { name: 'Épée en tilleul', icon: 'texture/outils/tilleul/sword.png', tool: 'sword', tier: 1, stack: 1 },
  162: { name: 'Houe en tilleul', icon: 'texture/outils/tilleul/hoe.png', tool: 'hoe', tier: 1, stack: 1 },
  // viande de cochon (voir animals.js) : crue, elle nourrit peu ; cuite au four, bien plus
  // œufs d'apparition : clic droit sur un bloc, l'animal apparaît dessus (voir animals.js)
  165: { name: 'Œuf de cochon', icon: 'texture/objets/oeuf_cochon.png', egg: 'pig' },
  166: { name: 'Œuf de mouton', icon: 'texture/objets/oeuf_mouton.png', egg: 'sheep' },
  167: { name: 'Œuf de mouton gris', icon: 'texture/objets/oeuf_mouton_gris.png', egg: 'sheep_grey' },
  168: { name: 'Œuf de renard polaire', icon: 'texture/objets/oeuf_renard_polaire.png', egg: 'fox' },
  169: { name: 'Œuf de villageois', icon: 'texture/objets/oeuf_villageois.png', egg: 'villager' },
  // créatures des autres planètes (voir creatures.js)
  4066: { name: 'Viande alien crue', icon: 'texture/objets/viande/alien_cru.png', food: 2 },
  4067: { name: 'Viande alien cuite', icon: 'texture/objets/viande/alien_cuit.png', food: 6 },
  4070: { name: 'Œuf de rampeur de poussière', icon: 'texture/objets/oeufs/ocra_crawler.png', egg: 'ocra_crawler' },
  4071: { name: 'Œuf de rôdeur des canyons', icon: 'texture/objets/oeufs/ocra_prowler.png', egg: 'ocra_prowler' },
  4072: { name: 'Œuf de carapace-givre', icon: 'texture/objets/oeufs/glacia_shell.png', egg: 'glacia_shell' },
  4073: { name: 'Œuf de croc-blizzard', icon: 'texture/objets/oeufs/glacia_fang.png', egg: 'glacia_fang' },
  4074: { name: 'Œuf de mange-scories', icon: 'texture/objets/oeufs/magmara_slag.png', egg: 'magmara_slag' },
  4075: { name: 'Œuf de bête de lave', icon: 'texture/objets/oeufs/magmara_lava.png', egg: 'magmara_lava' },
  4076: { name: 'Œuf de fouisseur des dunes', icon: 'texture/objets/oeufs/pxt1_burrower.png', egg: 'pxt1_burrower' },
  4077: { name: 'Œuf de guetteur des sables', icon: 'texture/objets/oeufs/pxt1_lurker.png', egg: 'pxt1_lurker' },
  4078: { name: 'Œuf de luciole lente', icon: 'texture/objets/oeufs/nox_firefly.png', egg: 'nox_firefly' },
  // monstres de Hexa
  4079: { name: 'Œuf d\'ombre', icon: 'texture/objets/oeufs/hexa_shade.png', egg: 'hexa_shade' },
  4080: { name: 'Œuf de hurleur', icon: 'texture/objets/oeufs/hexa_howler.png', egg: 'hexa_howler' },
  4081: { name: 'Œuf de tisseuse des grottes', icon: 'texture/objets/oeufs/hexa_weaver.png', egg: 'hexa_weaver' },
  197: { name: 'Œuf de lièvre arctique', icon: 'texture/objets/oeuf_lievre_arctique.png', egg: 'hare' },
  [RAW_PORK]: { name: 'Côtelette de porc crue', icon: 'texture/objets/raw_porkchop.png', food: 2 },
  [COOKED_PORK]: { name: 'Côtelette de porc cuite', icon: 'texture/objets/cooked_porkchop.png', food: 8 },
  // cailloux : ce que donne la pierre cassée avec une pioche en bois
  [PEBBLE]: { name: 'Caillou', icon: 'texture/objets/pebble.png', small: true },
  [RUSTIC_PICKAXE]: { name: 'Pioche rustique', icon: 'texture/outils/caillou/pickaxe.png', tool: 'pickaxe', tier: 2, stack: 1 },
  [RUSTIC_AXE]: { name: 'Hache rustique', icon: 'texture/outils/caillou/axe.png', tool: 'axe', tier: 2, stack: 1 },
  [RUSTIC_SHOVEL]: { name: 'Pelle rustique', icon: 'texture/outils/caillou/shovel.png', tool: 'shovel', tier: 2, stack: 1 },
  [RUSTIC_SWORD]: { name: 'Épée rustique', icon: 'texture/outils/caillou/sword.png', tool: 'sword', tier: 2, stack: 1 },
  [RUSTIC_HOE]: { name: 'Houe rustique', icon: 'texture/outils/caillou/hoe.png', tool: 'hoe', tier: 2, stack: 1 },
  // outils en pierre (pierre taillée, récupérée avec une pioche rustique)
  [STONE_PICKAXE]: { name: 'Pioche en pierre', icon: 'texture/outils/pierre/pickaxe.png', tool: 'pickaxe', tier: 3, stack: 1 },
  [STONE_AXE]: { name: 'Hache en pierre', icon: 'texture/outils/pierre/axe.png', tool: 'axe', tier: 3, stack: 1 },
  [STONE_SHOVEL]: { name: 'Pelle en pierre', icon: 'texture/outils/pierre/shovel.png', tool: 'shovel', tier: 3, stack: 1 },
  [STONE_SWORD]: { name: 'Épée en pierre', icon: 'texture/outils/pierre/sword.png', tool: 'sword', tier: 3, stack: 1 },
  [STONE_HOE]: { name: 'Houe en pierre', icon: 'texture/outils/pierre/hoe.png', tool: 'hoe', tier: 3, stack: 1 },
  // boule de neige : ce que donne la neige cassée à la pelle (4 font un bloc de neige)
  [SNOWBALL]: { name: 'Boule de neige', icon: 'texture/objets/snowball.png', stack: 16, small: true },
  [IRON_INGOT]: { name: 'Lingot de fer', icon: 'texture/objets/iron_ingot.png', small: true },
  // voltite : se pose au sol en fil (places : bloc posé à sa place)
  [VOLTITE]: { name: 'Voltite', icon: 'texture/objets/voltite.png', small: true, places: WIRE },
  // clé à molette : clic droit sur un bloc physique pour régler sa direction
  [WRENCH]: { name: 'Clé à molette', icon: 'texture/objets/wrench.png', stack: 1, grip: 'axe' },
  // outils en fer (tier 4) : la pioche en fer extrait la voltite
  [IRON_PICKAXE]: { name: 'Pioche en fer', icon: 'texture/outils/fer/pickaxe.png', tool: 'pickaxe', tier: 4, stack: 1 },
  [IRON_AXE]: { name: 'Hache en fer', icon: 'texture/outils/fer/axe.png', tool: 'axe', tier: 4, stack: 1 },
  [IRON_SHOVEL]: { name: 'Pelle en fer', icon: 'texture/outils/fer/shovel.png', tool: 'shovel', tier: 4, stack: 1 },
  [IRON_SWORD]: { name: 'Épée en fer', icon: 'texture/outils/fer/sword.png', tool: 'sword', tier: 4, stack: 1 },
  [IRON_HOE]: { name: 'Houe en fer', icon: 'texture/outils/fer/hoe.png', tool: 'hoe', tier: 4, stack: 1 },
  [PLATINUM_INGOT]: { name: 'Lingot de platine', icon: 'texture/objets/platinum_ingot.png', small: true },
  [TUNGSTEN_INGOT]: { name: 'Lingot de tungstène', icon: 'texture/objets/tungsten_ingot.png', small: true },
  // voltite impure : se pose au sol en fil bleu
  [IMPURE_VOLTITE]: { name: 'Voltite impure', icon: 'texture/objets/impure_voltite.png', small: true, places: IWIRE },
  // tige de platine : le manche des outils en platine et en tungstène
  [PLATINUM_STICK]: { name: 'Tige de platine', icon: 'texture/objets/platinum_stick.png' },
  [FLUORITE_INGOT]: { name: 'Lingot de fluorite', icon: 'texture/objets/fluorite_ingot.png', small: true },
  [CRIMSONITE_INGOT]: { name: 'Lingot de cramoisite', icon: 'texture/objets/crimsonite_ingot.png', small: true },
  // outils en fluorite (tier 5) : la pioche en fluorite extrait le platine
  [FLUORITE_PICKAXE]: { name: 'Pioche en fluorite', icon: 'texture/outils/fluorite/pickaxe.png', tool: 'pickaxe', tier: 5, stack: 1 },
  [FLUORITE_AXE]: { name: 'Hache en fluorite', icon: 'texture/outils/fluorite/axe.png', tool: 'axe', tier: 5, stack: 1 },
  [FLUORITE_SHOVEL]: { name: 'Pelle en fluorite', icon: 'texture/outils/fluorite/shovel.png', tool: 'shovel', tier: 5, stack: 1 },
  [FLUORITE_SWORD]: { name: 'Épée en fluorite', icon: 'texture/outils/fluorite/sword.png', tool: 'sword', tier: 5, stack: 1 },
  [FLUORITE_HOE]: { name: 'Houe en fluorite', icon: 'texture/outils/fluorite/hoe.png', tool: 'hoe', tier: 5, stack: 1 },
  // outils en cramoisite (tier 8) : les plus rapides
  [CRIMSONITE_PICKAXE]: { name: 'Pioche en cramoisite', icon: 'texture/outils/cramoisite/pickaxe.png', tool: 'pickaxe', tier: 8, stack: 1 },
  [CRIMSONITE_AXE]: { name: 'Hache en cramoisite', icon: 'texture/outils/cramoisite/axe.png', tool: 'axe', tier: 8, stack: 1 },
  [CRIMSONITE_SHOVEL]: { name: 'Pelle en cramoisite', icon: 'texture/outils/cramoisite/shovel.png', tool: 'shovel', tier: 8, stack: 1 },
  [CRIMSONITE_SWORD]: { name: 'Épée en cramoisite', icon: 'texture/outils/cramoisite/sword.png', tool: 'sword', tier: 8, stack: 1 },
  [CRIMSONITE_HOE]: { name: 'Houe en cramoisite', icon: 'texture/outils/cramoisite/hoe.png', tool: 'hoe', tier: 8, stack: 1 },
  // outils en platine (tier 6) : la pioche en platine extrait le tungstène
  [PLATINUM_PICKAXE]: { name: 'Pioche en platine', icon: 'texture/outils/platine/pickaxe.png', tool: 'pickaxe', tier: 6, stack: 1 },
  [PLATINUM_AXE]: { name: 'Hache en platine', icon: 'texture/outils/platine/axe.png', tool: 'axe', tier: 6, stack: 1 },
  [PLATINUM_SHOVEL]: { name: 'Pelle en platine', icon: 'texture/outils/platine/shovel.png', tool: 'shovel', tier: 6, stack: 1 },
  [PLATINUM_SWORD]: { name: 'Épée en platine', icon: 'texture/outils/platine/sword.png', tool: 'sword', tier: 6, stack: 1 },
  [PLATINUM_HOE]: { name: 'Houe en platine', icon: 'texture/outils/platine/hoe.png', tool: 'hoe', tier: 6, stack: 1 },
  // outils en tungstène (tier 7) : la pioche en tungstène extrait la cramoisite
  [TUNGSTEN_PICKAXE]: { name: 'Pioche en tungstène', icon: 'texture/outils/tungstene/pickaxe.png', tool: 'pickaxe', tier: 7, stack: 1 },
  [TUNGSTEN_AXE]: { name: 'Hache en tungstène', icon: 'texture/outils/tungstene/axe.png', tool: 'axe', tier: 7, stack: 1 },
  [TUNGSTEN_SHOVEL]: { name: 'Pelle en tungstène', icon: 'texture/outils/tungstene/shovel.png', tool: 'shovel', tier: 7, stack: 1 },
  [TUNGSTEN_SWORD]: { name: 'Épée en tungstène', icon: 'texture/outils/tungstene/sword.png', tool: 'sword', tier: 7, stack: 1 },
  [TUNGSTEN_HOE]: { name: 'Houe en tungstène', icon: 'texture/outils/tungstene/hoe.png', tool: 'hoe', tier: 7, stack: 1 },
  // bouleau : comme le bois (même palier), avec sa propre apparence
  300: { name: 'Bâton de bouleau', icon: 'texture/objets/birch_stick.png' },
  301: { name: 'Pioche en bouleau', icon: 'texture/outils/bouleau/pickaxe.png', tool: 'pickaxe', tier: 1, stack: 1 },
  302: { name: 'Hache en bouleau', icon: 'texture/outils/bouleau/axe.png', tool: 'axe', tier: 1, stack: 1 },
  303: { name: 'Pelle en bouleau', icon: 'texture/outils/bouleau/shovel.png', tool: 'shovel', tier: 1, stack: 1 },
  304: { name: 'Épée en bouleau', icon: 'texture/outils/bouleau/sword.png', tool: 'sword', tier: 1, stack: 1 },
  305: { name: 'Houe en bouleau', icon: 'texture/outils/bouleau/hoe.png', tool: 'hoe', tier: 1, stack: 1 },
  // diorite : comme la pierre (même palier)
  306: { name: 'Pioche en diorite', icon: 'texture/outils/diorite/pickaxe.png', tool: 'pickaxe', tier: 3, stack: 1 },
  307: { name: 'Hache en diorite', icon: 'texture/outils/diorite/axe.png', tool: 'axe', tier: 3, stack: 1 },
  308: { name: 'Pelle en diorite', icon: 'texture/outils/diorite/shovel.png', tool: 'shovel', tier: 3, stack: 1 },
  309: { name: 'Épée en diorite', icon: 'texture/outils/diorite/sword.png', tool: 'sword', tier: 3, stack: 1 },
  310: { name: 'Houe en diorite', icon: 'texture/outils/diorite/hoe.png', tool: 'hoe', tier: 3, stack: 1 },
  // circuits intégrés (électronique : ordinateur, serveur)
  [CIRCUIT]: { name: 'Circuit intégré', icon: 'texture/objets/circuits/integrated_circuit.png', small: true },
  312: { name: 'Circuit intégré doré', icon: 'texture/objets/circuits/circuit_dore.png', small: true },
  313: { name: 'Circuit intégré rouge', icon: 'texture/objets/circuits/circuit_rouge.png', small: true },
  314: { name: 'Circuit intégré sombre', icon: 'texture/objets/circuits/circuit_sombre.png', small: true },
  315: { name: 'Circuit intégré vert', icon: 'texture/objets/circuits/circuit_vert.png', small: true },
  // planchettes (porte-documents)
  316: { name: 'Planchette', icon: 'texture/objets/planchettes/clipboard.png', stack: 16 },
  317: { name: 'Planchette et plume', icon: 'texture/objets/planchettes/clipboard_quill.png', stack: 16 },
  318: { name: 'Planchette vide', icon: 'texture/objets/planchettes/clipboard_empty.png', stack: 16 },
  319: { name: 'Planchette futuriste', icon: 'texture/objets/planchettes/clipboard_future.png', stack: 1, doc: true, hidden: true },
  320: { name: 'Planchette futuriste vide', icon: 'texture/objets/planchettes/clipboard_future_empty.png', stack: 16 },
  321: { name: 'Planchette futuriste corrompue', icon: 'texture/objets/planchettes/clipboard_future_corrupted.png', stack: 16 },
  // forge : outils du forgeron (keep : ils restent dans la grille quand on fabrique avec),
  // charbon de forge (combustible), lingot chaud (lingot de fer repassé au four, qui se
  // martèle en fer industriel)
  [CHISEL]: { name: 'Burin', icon: 'texture/objets/forge/burin.png', stack: 1, grip: 'shovel', keep: true },
  [FORGE_COAL]: { name: 'Charbon de forge', icon: 'texture/objets/forge/charbon_forge.png', small: true },
  [FILE]: { name: 'Lime', icon: 'texture/objets/forge/lime.png', stack: 1, grip: 'shovel', keep: true },
  [HOT_INGOT]: { name: 'Lingot chaud', icon: 'texture/objets/forge/lingot_chaud.png', small: true },
  [SLEDGEHAMMER]: { name: 'Masse de forge', icon: 'texture/objets/forge/masse_forge.png', stack: 1, grip: 'axe', keep: true },
  [QUENCH_BUCKET]: { name: 'Seau de trempe', icon: 'texture/objets/forge/seau_trempe.png', stack: 1, keep: true },
  328: { name: 'Feuille de lapis', icon: 'texture/objets/lapis_sheet.png' },
  // blé : les graines se sèment sur la terre labourée ; le blé fait du pain
  425: { name: 'Graines de blé', icon: 'texture/objets/ble/seeds.png', places: 286, small: true },
  426: { name: 'Blé', icon: 'texture/objets/ble/wheat.png' },
  427: { name: 'Pain', icon: 'texture/objets/ble/bread.png', food: 6 },
  // viandes (moutons, renards), à cuire au four
  428: { name: 'Gigot de mouton cru', icon: 'texture/objets/viande/mouton_cru.png', food: 2 },
  429: { name: 'Gigot de mouton cuit', icon: 'texture/objets/viande/mouton_cuit.png', food: 7 },
  430: { name: 'Viande de renard crue', icon: 'texture/objets/viande/renard_cru.png', food: 2 },
  431: { name: 'Viande de renard cuite', icon: 'texture/objets/viande/renard_cuit.png', food: 5 },
  432: { name: 'Œuf de zombie', icon: 'texture/objets/oeuf_zombie.png', egg: 'zombie' },
  // pomme de terre : se mange crue (peu), ou se plante sur la terre labourée ; cuite au four
  441: { name: 'Pomme de terre', icon: 'texture/objets/pomme_de_terre/potato.png', food: 1, places: 433 },
  442: { name: 'Pomme de terre cuite', icon: 'texture/objets/pomme_de_terre/baked_potato.png', food: 6 },
  // le train (voir trains.js) : la locomotive et le wagon se posent sur un rail ; les pièces se
  // fabriquent à la table de craft
  457: { name: 'Locomotive', icon: 'texture/objets/train/locomotive_hex.png', train: 'loco', stack: 1 },
  458: { name: 'Wagon', icon: 'texture/objets/train/wagon_hex.png', train: 'wagon', stack: 1 },
  459: { name: 'Essieu', icon: 'texture/objets/train/essieu_hex.png' },
  460: { name: 'Bogie', icon: 'texture/objets/train/bogie_hex.png' },
  461: { name: 'Longeron', icon: 'texture/objets/train/longeron_hex.png' },
  462: { name: "Plaque d'acier", icon: 'texture/objets/train/plaque_acier_hex.png' },
  463: { name: 'Plaque de coque', icon: 'texture/objets/train/plaque_coque_hex.png' },
  464: { name: 'Plaque de toit', icon: 'texture/objets/train/plaque_toit_hex.png' },
  465: { name: 'Plaque de danger', icon: 'texture/objets/train/plaque_danger_hex.png' },
  466: { name: 'Panneau de métal', icon: 'texture/objets/train/panneau_metal_hex.png' },
  467: { name: 'Vitre de cabine', icon: 'texture/objets/train/vitre_hex.png' },
  468: { name: 'Voyant', icon: 'texture/objets/train/voyant_hex.png' },
  469: { name: 'Ventilateur', icon: 'texture/objets/train/ventilateur_hex.png' },
  470: { name: 'Calandre', icon: 'texture/objets/train/calandre_hex.png' },
  471: { name: 'Pare-chocs', icon: 'texture/objets/train/pare_chocs_hex.png' },
  472: { name: 'Cabine', icon: 'texture/objets/train/cabine_hex.png' },
  // le wagon plat : on construit dessus (une base qui roule) ; ses pièces
  476: { name: 'Wagon plat', icon: 'texture/objets/train/wagon_plat_hex.png', train: 'flat', stack: 1 },
  477: { name: 'Rampe de chargement', icon: 'texture/objets/train/rampe_chargement_hex.png' },
  478: { name: 'Attelage', icon: 'texture/objets/train/attelage_hex.png' },
  479: { name: "Chaîne d'attelage", icon: 'texture/objets/train/chaine_attelage_hex.png' },
  480: { name: 'Tampon de choc', icon: 'texture/objets/train/tampon_choc_hex.png' },
  481: { name: 'Ranchet', icon: 'texture/objets/train/ranchet_hex.png' },
  482: { name: 'Plancher de wagon', icon: 'texture/objets/train/plancher_wagon_hex.png' },
  483: { name: 'Poutre en I', icon: 'texture/objets/train/poutre_i_hex.png' },
  // nouveaux wagons (voir trains.js) : trémie (ramasse les objets au sol, se vide dans un coffre
  // sous la voie), passagers (6 places assises), poseur de rails (pose la voie devant le train)
  490: { name: 'Wagon trémie', icon: 'texture/objets/train/wagon_tremie_hex.png', train: 'hopper', stack: 1 },
  491: { name: 'Wagon passagers', icon: 'texture/objets/train/wagon_passagers_hex.png', train: 'passenger', stack: 1 },
  492: { name: 'Wagon poseur de rails', icon: 'texture/objets/train/wagon_pose_rails_hex.png', train: 'layer', stack: 1 },
  // leurs pièces
  493: { name: 'Trémie', icon: 'texture/objets/train/tremie_hex.png' },
  494: { name: 'Trappe', icon: 'texture/objets/train/trappe_hex.png' },
  495: { name: 'Volant de trappe', icon: 'texture/objets/train/volant_trappe_hex.png' },
  496: { name: 'Couvercle', icon: 'texture/objets/train/couvercle_hex.png' },
  497: { name: 'Échelle', icon: 'texture/objets/train/echelle_hex.png' },
  498: { name: 'Banquette', icon: 'texture/objets/train/banquette_hex.png' },
  499: { name: 'Siège', icon: 'texture/objets/train/siege_hex.png' },
  500: { name: 'Fenêtre de voiture', icon: 'texture/objets/train/fenetre_passagers_hex.png' },
  501: { name: 'Porte coulissante', icon: 'texture/objets/train/porte_coulissante_hex.png' },
  502: { name: 'Barre de maintien', icon: 'texture/objets/train/barre_maintien_hex.png' },
  503: { name: 'Filet à bagages', icon: 'texture/objets/train/filet_bagages_hex.png' },
  504: { name: 'Plafonnier', icon: 'texture/objets/train/plafonnier_hex.png' },
  505: { name: 'Marchepied', icon: 'texture/objets/train/marchepied_hex.png' },
  506: { name: 'Table pliante', icon: 'texture/objets/train/table_pliante_hex.png' },
  507: { name: 'Pile de rails', icon: 'texture/objets/train/pile_rails_hex.png' },
  508: { name: 'Pile de traverses', icon: 'texture/objets/train/pile_traverses_hex.png' },
  509: { name: 'Bras articulé', icon: 'texture/objets/train/bras_articule_hex.png' },
  510: { name: 'Vérin', icon: 'texture/objets/train/verin_hex.png' },
  511: { name: 'Levier de commande', icon: 'texture/objets/train/levier_hex.png' },
  // la gare
  512: { name: 'Plaque de destination', icon: 'texture/objets/train/plaque_destination_hex.png' },
  513: { name: 'Lampe de quai', icon: 'texture/objets/train/lampe_hex.png' },
  // moteurs de locomotive (menu de la locomotive : clic molette dans la cabine) : vitesse,
  // accélération, consommation, énergie (fuel : charbon, bois ; elec : voltite ; none : aucune)
  520: { name: "Moteur diesel", icon: 'texture/objets/train/moteur_diesel_hex.png', stack: 1, comp: { slot: 'engine', vmax: 23, acc: 1, burn: 0.9, power: 'fuel' } },
  521: { name: "Moteur diesel 250 ch", icon: 'texture/objets/train/moteur_diesel_250ch_hex.png', stack: 1, comp: { slot: 'engine', vmax: 26, acc: 1.15, burn: 1, power: 'fuel' } },
  522: { name: "Moteur essence 250 ch", icon: 'texture/objets/train/moteur_essence_250ch_hex.png', stack: 1, comp: { slot: 'engine', vmax: 26, acc: 1.3, burn: 1.3, power: 'fuel' } },
  523: { name: "Moteur V8 250 ch", icon: 'texture/objets/train/moteur_v8_250ch_hex.png', stack: 1, comp: { slot: 'engine', vmax: 28, acc: 1.4, burn: 1.4, power: 'fuel' } },
  524: { name: "Moteur électrique 50 V", icon: 'texture/objets/train/moteur_electrique_50v_hex.png', stack: 1, comp: { slot: 'engine', vmax: 25, acc: 1.2, burn: 0.8, power: 'elec' } },
  525: { name: "Moteur électrique 50 V ventilé", icon: 'texture/objets/train/moteur_electrique_50v_ventile_hex.png', stack: 1, comp: { slot: 'engine', vmax: 27, acc: 1.25, burn: 0.75, power: 'elec' } },
  526: { name: "Moteur brushless 50 V", icon: 'texture/objets/train/moteur_brushless_50v_hex.png', stack: 1, comp: { slot: 'engine', vmax: 29, acc: 1.4, burn: 0.7, power: 'elec' } },
  527: { name: "Moteur diesel turbo 500 ch", icon: 'texture/objets/train/moteur_diesel_turbo_500ch_hex.png', stack: 1, comp: { slot: 'engine', vmax: 32, acc: 1.6, burn: 1.3, power: 'fuel' } },
  528: { name: "Moteur électrique 200 V", icon: 'texture/objets/train/moteur_electrique_200v_hex.png', stack: 1, comp: { slot: 'engine', vmax: 35, acc: 1.8, burn: 0.9, power: 'elec' } },
  529: { name: "Moteur V12 800 ch", icon: 'texture/objets/train/moteur_v12_800ch_hex.png', stack: 1, comp: { slot: 'engine', vmax: 38, acc: 2, burn: 1.8, power: 'fuel' } },
  530: { name: "Moteur électrique 1000 V", icon: 'texture/objets/train/moteur_electrique_1000v_hex.png', stack: 1, comp: { slot: 'engine', vmax: 42, acc: 2.3, burn: 1, power: 'elec' } },
  531: { name: "Moteur W16 1500 ch", icon: 'texture/objets/train/moteur_w16_1500ch_hex.png', stack: 1, comp: { slot: 'engine', vmax: 46, acc: 2.6, burn: 2.2, power: 'fuel' } },
  532: { name: "Turbine à gaz 3000 ch", icon: 'texture/objets/train/turbine_gaz_3000ch_hex.png', stack: 1, comp: { slot: 'engine', vmax: 52, acc: 3, burn: 2.8, power: 'fuel' } },
  533: { name: "Moteur supraconducteur 5000 V", icon: 'texture/objets/train/moteur_supraconducteur_5000v_hex.png', stack: 1, comp: { slot: 'engine', vmax: 58, acc: 3.4, burn: 1.2, power: 'elec' } },
  534: { name: "Moteur à réaction 10 000 ch", icon: 'texture/objets/train/moteur_reaction_10000ch_hex.png', stack: 1, comp: { slot: 'engine', vmax: 66, acc: 4, burn: 3.5, power: 'fuel' } },
  535: { name: "Moteur à fusion plasma", icon: 'texture/objets/train/moteur_plasma_fusion_hex.png', stack: 1, comp: { slot: 'engine', vmax: 75, acc: 4.5, burn: 0, power: 'none' } },
  // composants de locomotive (8 emplacements ; chacun compte, même en plusieurs exemplaires)
  536: { name: "Réservoir de carburant", icon: 'texture/objets/train/reservoir_carburant_hex.png', stack: 16, comp: { slot: 'part', kind: 'tank', max: 2 } },
  537: { name: "Réservoir d'air", icon: 'texture/objets/train/reservoir_air_hex.png', stack: 16, comp: { slot: 'part', kind: 'air', max: 1 } },
  538: { name: "Batterie", icon: 'texture/objets/train/batterie_hex.png', stack: 16, comp: { slot: 'part', kind: 'battery', max: 2 } },
  539: { name: "Turbocompresseur", icon: 'texture/objets/train/turbocompresseur_hex.png', stack: 16, comp: { slot: 'part', kind: 'turbo', max: 1 } },
  540: { name: "Radiateur", icon: 'texture/objets/train/radiateur_hex.png', stack: 16, comp: { slot: 'part', kind: 'radiator', max: 1 } },
  541: { name: "Alternateur", icon: 'texture/objets/train/alternateur_hex.png', stack: 16, comp: { slot: 'part', kind: 'alternator', max: 1 } },
  542: { name: "Pompe à carburant", icon: 'texture/objets/train/pompe_carburant_hex.png', stack: 16, comp: { slot: 'part', kind: 'pump', max: 1 } },
  543: { name: "Pot d'échappement", icon: 'texture/objets/train/pot_echappement_hex.png', stack: 16, comp: { slot: 'part', kind: 'exhaust', max: 1 } },
  544: { name: "Avertisseur", icon: 'texture/objets/train/avertisseur_hex.png', stack: 16, comp: { slot: 'part', kind: 'horn', max: 1 } },
  545: { name: "Manette de traction", icon: 'texture/objets/train/manette_traction_hex.png', stack: 16, comp: { slot: 'part', kind: 'throttle', max: 1 } },
  546: { name: "Cylindre de frein", icon: 'texture/objets/train/cylindre_frein_hex.png', stack: 16, comp: { slot: 'part', kind: 'brake', max: 2 } },
  547: { name: "Sablière", icon: 'texture/objets/train/sabliere_hex.png', stack: 16, comp: { slot: 'part', kind: 'sander', max: 1 } },
  548: { name: "Faisceau de câbles", icon: 'texture/objets/train/faisceau_cables_hex.png', stack: 16, comp: { slot: 'part', kind: 'wiring', max: 1 } },
  549: { name: "Transformateur", icon: 'texture/objets/train/transformateur_hex.png', stack: 16, comp: { slot: 'part', kind: 'transformer', max: 1 } },
  550: { name: "Moteur de traction", icon: 'texture/objets/train/moteur_traction_hex.png', stack: 16, comp: { slot: 'part', kind: 'traction', max: 2 } },
  // la casquette de conducteur (se porte sur la tête : emplacement d'équipement)
  551: { name: 'Casquette de conducteur', icon: 'texture/objets/train/casquette_conducteur_hex.png', stack: 1, wear: 'head' },
  // wagon de queue (une cabine à l'arrière : conduire en marche arrière) et wagon plat à étage
  552: { name: 'Wagon de queue', icon: 'texture/objets/train/wagon_queue_hex.png', train: 'tail', stack: 1 },
  553: { name: 'Wagon plat à étage', icon: 'texture/objets/train/wagon_plat_etage_hex.png', train: 'flat2', stack: 1 },
  554: { name: 'Feu rouge', icon: 'texture/objets/train/feu_rouge_hex.png' },
  555: { name: 'Rétroviseur', icon: 'texture/objets/train/retroviseur_hex.png' },
  556: { name: 'Poste de conduite', icon: 'texture/objets/train/poste_conduite_hex.png' },
  557: { name: "Plateau d'étage", icon: 'texture/objets/train/plateau_etage_hex.png' },
  558: { name: "Support d'étage", icon: 'texture/objets/train/support_etage_hex.png' },
  559: { name: 'Garde-corps', icon: 'texture/objets/train/garde_corps_hex.png' },
  560: { name: 'Passerelle', icon: 'texture/objets/train/passerelle_hex.png' },
  561: { name: 'Rampe', icon: 'texture/objets/train/rampe_hex.png' },
  562: { name: 'Charnière de rampe', icon: 'texture/objets/train/charniere_rampe_hex.png' },
  563: { name: 'Montant', icon: 'texture/objets/train/montant_hex.png' },
  // locomotives à vapeur (voir trains.js, STYLES) et leur tender, leurs pièces
  581: { name: 'Locomotive à vapeur carénée', icon: 'texture/objets/train/loco_vapeur_profilee_hex.png', train: 'loco', style: 'streamline', stack: 1 },
  582: { name: 'Locomotive à vapeur camouflée', icon: 'texture/objets/train/loco_vapeur_camouflee_hex.png', train: 'loco', style: 'war', stack: 1 },
  583: { name: 'Tender', icon: 'texture/objets/train/tender_hex.png', train: 'tender', stack: 1 },
  584: { name: 'Sifflet à vapeur', icon: 'texture/objets/train/sifflet_vapeur_hex.png', stack: 16, comp: { slot: 'part', kind: 'whistle' } },
  585: { name: 'Bielle', icon: 'texture/objets/train/bielle_hex.png' },
  586: { name: 'Roue motrice', icon: 'texture/objets/train/roue_motrice_hex.png' },
  587: { name: 'Carénage', icon: 'texture/objets/train/carenage_hex.png' },
  588: { name: 'Nez profilé', icon: 'texture/objets/train/nez_profile_hex.png' },
  589: { name: 'Foyer', icon: 'texture/objets/train/foyer_hex.png' },
  590: { name: 'Manomètre', icon: 'texture/objets/train/manometre_hex.png' },
  // composants de locomotive à vapeur : sans effet sur les autres moteurs ; steam : ce que chacun
  // multiplie (acc, vmax, burn : consommation, tank : réservoir, brake, slope : pentes, smoke : fumée,
  // mass : poids des wagons), voir limits() dans trains.js
  900: { name: 'Manomètre double', icon: 'texture/objets/train/manometre_double_hex.png', stack: 16, comp: { slot: 'part', kind: 'gauge2', steam: { burn: 0.92, acc: 1.05 } } },
  901: { name: 'Piston renforcé', icon: 'texture/objets/train/piston_renforce_hex.png', stack: 16, comp: { slot: 'part', kind: 'piston', steam: { acc: 1.15 } } },
  902: { name: 'Plaque de blindage à vapeur', icon: 'texture/objets/train/plaque_blindage_vapeur_hex.png', stack: 16, comp: { slot: 'part', kind: 'armor', steam: { mass: 1.1, slope: 0.8 } } },
  903: { name: "Réchauffeur d'eau", icon: 'texture/objets/train/rechauffeur_eau_hex.png', stack: 16, comp: { slot: 'part', kind: 'feedheater', steam: { burn: 0.9 } } },
  904: { name: 'Régulateur de pression', icon: 'texture/objets/train/regulateur_pression_hex.png', stack: 16, comp: { slot: 'part', kind: 'regulator', steam: { vmax: 1.06 } } },
  905: { name: 'Ressort de suspension', icon: 'texture/objets/train/ressort_suspension_hex.png', stack: 16, comp: { slot: 'part', kind: 'spring', steam: { vmax: 1.05, brake: 1.1 } } },
  906: { name: 'Surchauffeur', icon: 'texture/objets/train/surchauffeur_hex.png', stack: 16, comp: { slot: 'part', kind: 'superheater', steam: { acc: 1.1, vmax: 1.05 } } },
  907: { name: 'Joint haute pression', icon: 'texture/objets/train/joint_haute_pression_hex.png', stack: 16, comp: { slot: 'part', kind: 'seal', steam: { burn: 0.94 } } },
  908: { name: 'Alimentateur de charbon', icon: 'texture/objets/train/alimentateur_charbon_hex.png', stack: 16, comp: { slot: 'part', kind: 'stoker', steam: { tank: 1.4 } } },
  909: { name: 'Calorifuge', icon: 'texture/objets/train/calorifuge_hex.png', stack: 16, comp: { slot: 'part', kind: 'lagging', steam: { burn: 0.9 } } },
  910: { name: 'Chaudière haute pression', icon: 'texture/objets/train/chaudiere_haute_pression_hex.png', stack: 16, comp: { slot: 'part', kind: 'hpboiler', steam: { vmax: 1.1, acc: 1.1, burn: 1.15 } } },
  911: { name: 'Chaudière renforcée', icon: 'texture/objets/train/chaudiere_renforcee_hex.png', stack: 16, comp: { slot: 'part', kind: 'boiler', steam: { tank: 1.3, acc: 1.05 } } },
  912: { name: 'Cheminée à double tirage', icon: 'texture/objets/train/cheminee_double_tirage_hex.png', stack: 16, comp: { slot: 'part', kind: 'chimney', steam: { acc: 1.08, smoke: 0.6 } } },
  913: { name: "Compresseur d'air", icon: 'texture/objets/train/compresseur_air_hex.png', stack: 16, comp: { slot: 'part', kind: 'compressor', steam: { brake: 1.25 } } },
  914: { name: 'Cylindre compound', icon: 'texture/objets/train/cylindre_compound_hex.png', stack: 16, comp: { slot: 'part', kind: 'compound', steam: { acc: 1.12, burn: 0.92 } } },
  915: { name: 'Distribution Walschaerts', icon: 'texture/objets/train/distribution_walschaerts_hex.png', stack: 16, comp: { slot: 'part', kind: 'walschaerts', steam: { vmax: 1.08 } } },
  916: { name: 'Échappement amélioré', icon: 'texture/objets/train/echappement_ameliore_hex.png', stack: 16, comp: { slot: 'part', kind: 'blastpipe', steam: { acc: 1.06, smoke: 0.7 } } },
  917: { name: 'Essieu renforcé', icon: 'texture/objets/train/essieu_renforce_hex.png', stack: 16, comp: { slot: 'part', kind: 'axle', steam: { mass: 0.85 } } },
  918: { name: 'Grille de foyer', icon: 'texture/objets/train/grille_foyer_hex.png', stack: 16, comp: { slot: 'part', kind: 'grate', steam: { burn: 0.92 } } },
  // industrie : poussières du concasseur (un minerai en donne deux, fondues au four : un lingot
  // chacune), pièces des machines
  3850: { name: 'Poussière de fer', icon: 'texture/objets/industrie/poussiere_fer.png', small: true },
  3851: { name: 'Poussière de platine', icon: 'texture/objets/industrie/poussiere_platine.png', small: true },
  3852: { name: 'Poussière de tungstène', icon: 'texture/objets/industrie/poussiere_tungstene.png', small: true },
  3853: { name: 'Poussière de fluorite', icon: 'texture/objets/industrie/poussiere_fluorite.png', small: true },
  3854: { name: 'Poussière de cramoisite', icon: 'texture/objets/industrie/poussiere_cramoisite.png', small: true },
  3855: { name: 'Engrenage', icon: 'texture/objets/industrie/engrenage.png' },
  3856: { name: 'Bobine de cuivre', icon: 'texture/objets/industrie/bobine.png' },  // wagon couvert (un coffre) et wagon blindé (tourelles à canon, voir trains.js), leurs pièces
  591: { name: 'Wagon couvert', icon: 'texture/objets/train/wagon_couvert_hex.png', train: 'covered', stack: 1 },
  592: { name: 'Wagon blindé', icon: 'texture/objets/train/wagon_blinde_hex.png', train: 'armored', stack: 1 },
  593: { name: 'Tourelle', icon: 'texture/objets/train/tourelle_hex.png' },
  594: { name: 'Obus', icon: 'texture/objets/train/obus_hex.png', stack: 16 },
  595: { name: 'Plaque de blindage', icon: 'texture/objets/train/plaque_blindage_hex.png' },
  596: { name: 'Bogie renforcé', icon: 'texture/objets/train/bogie_renforce_hex.png' },
  // wagonnet de mine : ce qu'on casse tout près de lui tombe dedans (voir main.js)
  663: { name: 'Wagonnet de mine', icon: 'texture/objets/train/wagon_tremie_hex.png', train: 'mine', stack: 1 },
  // lampe de casque : se porte sur la tête, éclaire devant soi (voir world.js, uLamp)
  664: { name: 'Lampe de casque', icon: 'texture/blocs/lampe/lamp_on.png', stack: 1, wear: 'head' },
  // œuf d'Hexalien : un Hexalien apparaît là où on vise, et vit autour (voir hexaliens.js)
  665: { name: "Œuf d'Hexalien", icon: 'texture/objets/oeuf_hexalien.png', hexEgg: true },
};
export const STEAM_STREAMLINE = 581, STEAM_WAR = 582, TENDER = 583;
export const MINE_WAGON = 663, HELMET_LAMP = 664;
export const CONDUCTOR_CAP = 551, TAIL_WAGON = 552, FLAT2_WAGON = 553;
// Statistiques d'un moteur / d'un composant de locomotive (voir trains.js), ou null
export const compOf = (id) => ITEMS[id]?.comp || null;
// Les pièces de locomotive à vapeur, par sorte (kind -> objet)
export const STEAM_PART = {};
for (const [id, it] of Object.entries(ITEMS)) if (it.comp?.steam) STEAM_PART[it.comp.kind] = Number(id);
export const HOPPER_WAGON = 490, PASSENGER_WAGON = 491, LAYER_WAGON = 492;
export const SEEDS = 425, WHEAT = 426, BREAD = 427;
export const RAW_MUTTON = 428, COOKED_MUTTON = 429, RAW_FOX = 430, COOKED_FOX = 431;
// pièces d'ordinateur (voir pcparts.js) : secrètes, cachées (inventaire créatif, wiki) tant
// que la commande /secret on ne les a pas montrées
// la collection de véhicules (voir traincatalog.js) : locomotives, tenders, voitures, wagons
for (const v of HX_LIST) ITEMS[v.item] = { name: v.name, icon: hxIcon(v.model), train: v.kind, style: v.model, stack: 1 };
PC_PARTS.forEach(([file, name], i) => { ITEMS[PC_PARTS_ID + i] = { name, icon: 'texture/objets/pc/' + file + '.png', pc: true, hidden: true }; });
export function setSecretItems(on) {
  for (const it of Object.values(ITEMS)) if (it.pc) it.hidden = !on;
}

export const HOTBAR = [1, 2, 3, 18, 26, 23, RAIL, HEXACART, GLUE, GRAVITY_HAND];

// ---------- Blocs de décoration (texture/blocs/decor) ----------
// [id, texture, nom, matière (voir MATTER_OF dans survival.js), couleur sur la carte]
export const DECOR = [
  [600, 'bone', "Bloc d'os", 'stone', '#e6e0cc'],
  [601, 'carpet_red', "Moquette rouge", 'wool', '#a8282e'],
  [602, 'checker_floor', "Carrelage en damier", 'stone', '#8a8a8a'],
  [603, 'clay', "Argile", 'dirt', '#a4a8b4'],
  [604, 'cobble_street', "Pavés de rue", 'stone', '#6e6a66'],
  [605, 'cracked_earth', "Terre craquelée", 'dirt', '#9a6e44'],
  [606, 'cracked_stone_bricks', "Briques de pierre fissurées", 'stone', '#7a7a7a'],
  [607, 'crystal', "Cristal", 'glass', '#9ad8f0'],
  [608, 'dragon_scales', "Écailles de dragon", 'hard', '#3a6a4a'],
  [609, 'embers', "Braises", 'stone', '#c0401a'],
  [610, 'flagstone', "Dallage de pierre", 'stone', '#8a8478'],
  [611, 'glow_fungus', "Champignon lumineux", 'wood', '#3ac8a0'],
  [612, 'half_timber', "Colombage", 'wood', '#d8ccb0'],
  [613, 'hay_bale', "Botte de foin", 'wool', '#d0a838'],
  [614, 'honeycomb', "Rayon de miel", 'wood', '#e0a020'],
  [615, 'iron_plate', "Plaque de fer", 'stone', '#a0a4aa'],
  [616, 'lichen_rock', "Roche à lichen", 'stone', '#7a8a6a'],
  [617, 'marble', "Marbre", 'stone', '#e8e6e2'],
  [618, 'moss', "Mousse", 'dirt', '#4a7a2c'],
  [619, 'mossy_stone_bricks', "Briques de pierre moussues", 'stone', '#6a7a5e'],
  [620, 'mud_brick', "Briques de terre crue", 'stone', '#9a7452'],
  [621, 'mushroom_block', "Chapeau de champignon", 'wood', '#b83a2e'],
  [622, 'polished_stone', "Pierre polie", 'stone', '#9a9a9a'],
  [623, 'red_bricks', "Briques rouges", 'stone', '#9a4434'],
  [624, 'rune_stone', "Pierre runique", 'stone', '#5a5e7a'],
  [625, 'rusted_metal', "Métal rouillé", 'stone', '#8a4a2a'],
  [626, 'dune_sand', "Sable des dunes", 'dirt', '#d4c08a'],
  [627, 'sandstone', "Grès", 'stone', '#d8c898'],
  [628, 'sandstone_bricks', "Briques de grès", 'stone', '#d0bc88'],
  [629, 'slate_roof', "Toit d'ardoise", 'stone', '#3e4450'],
  [630, 'stained_glass', "Vitrail", 'glass', '#8a5ab0'],
  [631, 'stone_bricks', "Briques de pierre", 'stone', '#848484'],
  [632, 'swamp_mud', "Boue des marais", 'dirt', '#4a4430'],
  [633, 'terracotta_roof', "Toit en tuiles", 'stone', '#b0583a'],
  [634, 'thatch', "Chaume", 'wool', '#c0a050'],
  [635, 'verdigris_copper', "Cuivre vert-de-gris", 'stone', '#5aa08a'],
  [636, 'wicker_weave', "Osier tressé", 'wood', '#a87a44'],
  [637, 'wood_parquet', "Parquet", 'wood', '#a8743e'],
  // (briques de couleur, ardoise, béton...)
  [725, 'bricks_beige', "Briques beiges", 'stone', '#cdb892'],
  [726, 'bricks_white', "Briques blanches", 'stone', '#ecebe7'],
  [727, 'bricks_light_blue', "Briques bleu clair", 'stone', '#76aae0'],
  [728, 'bricks_blue', "Briques bleues", 'stone', '#4a6fb8'],
  [729, 'bricks_maroon', "Briques bordeaux", 'stone', '#924553'],
  [730, 'bricks_cyan', "Briques cyan", 'stone', '#52b3cb'],
  [731, 'bricks_light_gray', "Briques gris clair", 'stone', '#c4c6c9'],
  [732, 'bricks_gray', "Briques grises", 'stone', '#86898d'],
  [733, 'bricks_yellow', "Briques jaunes", 'stone', '#d9b84a'],
  [734, 'bricks_magenta', "Briques magenta", 'stone', '#ba55a4'],
  [735, 'bricks_navy', "Briques bleu marine", 'stone', '#384f83'],
  [736, 'bricks_brown', "Briques marron", 'stone', '#8f6344'],
  [737, 'bricks_black', "Briques noires", 'stone', '#44464b'],
  [738, 'bricks_orange', "Briques orange", 'stone', '#c9743a'],
  [739, 'bricks_pink', "Briques roses", 'stone', '#e196b2'],
  [740, 'bricks_bright_red', "Briques rouge vif", 'stone', '#a84a3f'],
  [741, 'bricks_turquoise', "Briques turquoise", 'stone', '#3f9f95'],
  [742, 'bricks_lime', "Briques vert clair", 'stone', '#b2ce63'],
  [743, 'bricks_green', "Briques vertes", 'stone', '#69a458'],
  [744, 'bricks_purple', "Briques violettes", 'stone', '#906ec4'],
  [745, 'slate', "Ardoise", 'stone', '#5d6570'],
  [746, 'concrete', "Béton gris", 'stone', '#84878b'],
  [747, 'cut_sandstone', "Grès taillé", 'stone', '#d8c490'],
  [748, 'pavers', "Pavés", 'stone', '#8a8680'],
  [749, 'clay_tiles', "Tuiles de terre cuite", 'stone', '#a24d3e'],
];
// 607 :, light: 4
// 609 :, light: 3
// 611 :, light: 3
// 624 :, light: 2
// 630 :, glass: true
const DECOR_EXTRA = { 607: { light: 4 }, 609: { light: 3 }, 611: { light: 3 }, 624: { light: 2 }, 630: { glass: true } };
for (const [id, tex, name] of DECOR) BLOCKS[id] = { name, top: tex, side: tex, bottom: tex, ...(DECOR_EXTRA[id] || {}) };

// ---------- Couches de neige (voir snow.js) ----------
// 8 épaisseurs (layer : 1 à 8 huitièmes de bloc), sur le dessus d'un bloc plein, d'une dalle
// (une dalle basse : la neige descend dans sa moitié vide) ou d'une dalle verticale (sur sa
// moitié pleine, et en contrebas dans sa moitié vide). On s'y enfonce (elle ne bloque pas).
export const SNOW_LAYER = 760;
for (let n = 1; n <= 8; n++) {
  BLOCKS[SNOW_LAYER + n - 1] = { name: 'Couche de neige', top: 'snow', side: 'snow', bottom: 'snow', shape: 'snow', thin: true, layer: n, hidden: n > 1, pick: SNOW_LAYER };
}
export const isSnowLayer = (id) => id >= SNOW_LAYER && id < SNOW_LAYER + 8;
export const snowLayerId = (n) => SNOW_LAYER + n - 1;
// La neige tient-elle sur ce bloc ? (bloc plein, dalle, dalle verticale ; une couche épaisse de 8)
export const holdsSnow = (id) => !!(SUPPORT[id] || SLAB[id] === 1 || SLAB[id] === 3 || BLOCKS[id]?.dslab || id === SNOW_LAYER + 7) && !BLOCKS[id]?.glow;
// Hauteur du bas de la neige dans sa case, d'après le bloc d'en dessous (dalle basse : -0,5)
export const snowBase = (below) => (SLAB[below] === 1 ? -0.5 : 0);

// ---------- Industrie (voir industry.js) ----------
// power : la place du bloc dans le réseau électrique (gen : produit, use : consomme ses watts,
// store : batterie, link : câble, transformateur). machine : ce que fait une machine à
// inventaire (container 'machine' : entrée, combustible, sortie, comme le four). Les tapis et
// les bras sont orientés (base + k : k, le côté vers le joueur qui l'a posé ; ils vont vers le
// côté opposé). Loin de tout le reste : ids 3800 et plus (les dalles en prennent jusqu'à ~3300).
export const BOILER = 3800, BOILER_ON = 3801, DYNAMO = 3802, WIND_TURBINE = 3803, WATER_WHEEL = 3804;
export const CABLE = 3805, TRANSFORMER = 3806, BATTERY_BLOCK = 3807, CRUSHER = 3808, BLAST_FURNACE = 3809, BLAST_FURNACE_ON = 3810;
export const FIREBRICK = 3811, ROLLING_MILL = 3812, DRILL = 3813, BELT = 3814, ARM = 3820, LOADER = 3826, UNLOADER = 3827;
export const SMOKE_FILTER = 3828, FACTORY_CHIMNEY = 3829, CORRUGATED = 3830;
// Tapis roulants (comme ceux du mod Create) : on tend un tapis (l'objet BELT) entre deux arbres
// de transmission alignés, à plat ou en pente (une marche par case). Ses cases : CONVEYOR +
// facing * 6 + slope * 3 + part (facing : le sens de la bande, vers le haut pour une pente ;
// part : 0 milieu, 1 poulie du début, 2 poulie de la fin). Voir industry.js
export const SHAFT = 3831, CONVEYOR = 3860;
export const conveyorId = (facing, slope, part) => CONVEYOR + facing * 6 + slope * 3 + part;
const facingFront = (front, back, side, k) => Array.from({ length: 6 }, (_, i) => (i === (k + 3) % 6 ? front : i === k ? back : side));
Object.assign(BLOCKS, {
  [BOILER]: { name: 'Chaudière à vapeur', top: 'boiler_top', side: 'boiler_side', bottom: 'boiler_top', container: 'machine', machine: 'boiler' },
  [BOILER_ON]: { name: 'Chaudière à vapeur (allumée)', top: 'boiler_top', side: 'boiler_side_on', bottom: 'boiler_top', container: 'machine', machine: 'boiler', pick: BOILER, hidden: true, light: 3 },
  [DYNAMO]: { name: 'Dynamo à vapeur', top: 'dynamo_top', side: 'dynamo_side', bottom: 'dynamo_top', power: 'gen' },
  [WIND_TURBINE]: { name: 'Éolienne', top: 'wind_top', side: 'wind_side', bottom: 'dynamo_top', power: 'gen', shape: 'wind', thin: true },
  [WATER_WHEEL]: { name: 'Roue à aubes', top: 'water_wheel_top', side: 'water_wheel_side', bottom: 'water_wheel_top', power: 'gen', shape: 'wheel', thin: true },
  [CABLE]: { name: 'Câble haute tension', top: 'cable', side: 'cable', bottom: 'cable', power: 'link', shape: 'cable', thin: true },
  [TRANSFORMER]: { name: 'Transformateur', top: 'transformer_top', side: 'transformer_side', bottom: 'transformer_top', power: 'link' },
  [BATTERY_BLOCK]: { name: 'Batterie de stockage', top: 'battery_top', side: 'battery_side', bottom: 'battery_top', power: 'store' },
  [CRUSHER]: { name: 'Concasseur', top: 'crusher_top', side: 'crusher_side', bottom: 'machine_bottom', container: 'machine', machine: 'crusher', power: 'use' },
  [BLAST_FURNACE]: { name: 'Haut fourneau', top: 'firebrick', side: 'blast_side', bottom: 'firebrick', container: 'machine', machine: 'blast' },
  [BLAST_FURNACE_ON]: { name: 'Haut fourneau (allumé)', top: 'firebrick', side: 'blast_side_on', bottom: 'firebrick', container: 'machine', machine: 'blast', pick: BLAST_FURNACE, hidden: true, light: 4 },
  [FIREBRICK]: { name: 'Briques réfractaires', top: 'firebrick', side: 'firebrick', bottom: 'firebrick' },
  [ROLLING_MILL]: { name: 'Laminoir', top: 'mill_top', side: 'mill_side', bottom: 'machine_bottom', container: 'machine', machine: 'mill', power: 'use' },
  [DRILL]: { name: 'Foreuse', top: 'drill_top', side: 'drill_side', bottom: 'drill_bottom', container: 'machine', machine: 'drill', power: 'use' },
  [LOADER]: { name: 'Quai de chargement', top: 'loader_top', side: 'loader_side', bottom: 'machine_bottom', power: 'use', dock: 'load' },
  [UNLOADER]: { name: 'Quai de déchargement', top: 'unloader_top', side: 'loader_side', bottom: 'machine_bottom', power: 'use', dock: 'unload' },
  [SMOKE_FILTER]: { name: 'Filtre à fumée', top: 'filter_top', side: 'filter_side', bottom: 'filter_top' },
  [FACTORY_CHIMNEY]: { name: "Cheminée d'usine", top: 'chimney_top', side: 'chimney_side', bottom: 'chimney_side' },
  [CORRUGATED]: { name: 'Tôle ondulée', top: 'corrugated', side: 'corrugated', bottom: 'corrugated' },
});
for (let k = 0; k < 6; k++) {
  // tapis roulant : l'objet qu'on tend entre deux arbres (BELT) ; les anciens tapis d'une case
  // (BELT + k, d'avant les arbres) restent posés, inertes, et redonnent un tapis
  BLOCKS[BELT + k] = { name: 'Tapis roulant', top: 'belt_top', side: 'belt_side', bottom: 'machine_bottom', shape: 'belt', height: 0.25, facing: k, pick: BELT, hidden: k > 0, oldBelt: true };
  // arbre de transmission : une barre couchée d'un bord à l'autre de la case (axe k % 3)
  BLOCKS[SHAFT + k] = { name: 'Arbre de transmission', top: 'shaft', side: 'shaft', bottom: 'shaft', shape: 'shaft', thin: true, facing: k, base: SHAFT, pick: SHAFT, hidden: k > 0 };
  // bras de transfert : prend derrière lui (côté du joueur), pose devant
  BLOCKS[ARM + k] = { name: 'Bras de transfert', top: 'arm_top', side: 'arm_side', bottom: 'machine_bottom', sides: facingFront('arm_front', 'arm_back', 'arm_side', k), facing: k, base: ARM, pick: ARM, hidden: k > 0, power: 'use', arm: true };
}
for (let f = 0; f < 6; f++) for (let sl = 0; sl < 2; sl++) for (let part = 0; part < 3; part++) {
  BLOCKS[conveyorId(f, sl, part)] = { name: 'Tapis roulant', top: 'conveyor', side: 'belt_side', bottom: 'conveyor', shape: 'conveyor', height: 0.5, facing: f, slope: sl, part, pick: BELT, hidden: true, power: 'use', belt: true };
}
// Automatisation (comme le mod Create, mais à l'électricité ; voir industry.js). Orientés comme
// le bras : k, le côté vers le joueur qui l'a posé (l'arrière) ; l'avant, le côté opposé.
//  - entonnoir : posé contre un coffre (devant lui) ; il y range ce qui passe derrière lui (tapis,
//    cartons) ; l'extracteur fait l'inverse : il sort du coffre et pose derrière lui
//  - ventilateur : souffle devant lui ; ce qui est derrière lui (lave, magma, four allumé : cuisson ;
//    eau : lavage) traite les objets des tapis et les cartons dans son souffle
//  - presse, scie : posées au-dessus d'un tapis, elles arrêtent la pile qui passe dessous et la
//    transforment
//  - assembleur : un coffre qui fabrique tout seul l'objet choisi, et le pose devant lui
//  - répartiteur : ce qui y entre ressort par ses autres côtés, chacun son tour
export const FUNNEL = 3896, EXTRACTOR = 3902, FAN = 3908, PRESS = 3914, SAW = 3915, ASSEMBLER = 3916, SPLITTER = 3922;
Object.assign(BLOCKS, {
  [PRESS]: { name: 'Presse électrique', top: 'press_top', side: 'press_side', bottom: 'press_bottom', power: 'use', station: 'press' },
  [SAW]: { name: 'Scie électrique', top: 'saw_top', side: 'saw_side', bottom: 'saw_bottom', power: 'use', station: 'saw' },
  [SPLITTER]: { name: 'Répartiteur', top: 'splitter_top', side: 'splitter_side', bottom: 'splitter_top', power: 'use', splitter: true },
});
for (let k = 0; k < 6; k++) {
  BLOCKS[FUNNEL + k] = { name: 'Entonnoir électrique', top: 'funnel_in_top', side: 'funnel_side', bottom: 'machine_bottom', sides: facingFront('funnel_side', 'funnel_mouth', 'funnel_side', k), facing: k, base: FUNNEL, pick: FUNNEL, hidden: k > 0, power: 'use', funnel: 'in', filter: true };
  BLOCKS[EXTRACTOR + k] = { name: 'Extracteur électrique', top: 'funnel_out_top', side: 'funnel_side', bottom: 'machine_bottom', sides: facingFront('funnel_side', 'funnel_mouth', 'funnel_side', k), facing: k, base: EXTRACTOR, pick: EXTRACTOR, hidden: k > 0, power: 'use', funnel: 'out', filter: true };
  BLOCKS[FAN + k] = { name: 'Ventilateur électrique', top: 'fan_side', side: 'fan_side', bottom: 'fan_side', sides: facingFront('fan_front', 'fan_back', 'fan_side', k), facing: k, base: FAN, pick: FAN, hidden: k > 0, power: 'use', fan: true };
  BLOCKS[ASSEMBLER + k] = { name: 'Assembleur', top: 'assembler_top', side: 'assembler_side', bottom: 'machine_bottom', sides: facingFront('assembler_front', 'assembler_side', 'assembler_side', k), facing: k, base: ASSEMBLER, pick: ASSEMBLER, hidden: k > 0, power: 'use', container: 'chest', assembler: true };
}
BLOCKS[ARM].filter = true;
for (let k = 1; k < 6; k++) BLOCKS[ARM + k].filter = true;
// ---------- Idées des joueurs ----------
//  - gâteau chauffant : réchauffe l'air autour de lui (la neige fond), et le climat du monde
//    entier tant qu'il y en a (réchauffement climatique, voir seasons.js)
//  - poteaux : un mince pilier hexagonal (barrières, lampadaires, piliers de pont)
//  - ressort : on rebondit dessus (le joueur, les objets collés)
//  - piston agrippant : comme le piston, mais il ramène le bloc devant lui en rentrant
//  - émetteur / récepteur de voltite : du courant sans fil, entre ceux réglés sur le même objet
//    (la fréquence : clic droit avec un objet en main, comme les liens de Create)
//  - assembleur de chariot : sous un rail ; alimenté, il charge sur l'Hexacart qui passe les
//    blocs posés au-dessus de lui ; sans courant, il les repose (voir cartloads.js)
export const HEAT_CAKE = 3923, POST = 3924, SPRING = 3930, STICKY_PISTON = 3931, RADIO_TX = 3937, RADIO_RX = 3938, RADIO_RX_ON = 3939, SCHEMATIC = 3940, CART_ASSEMBLER = 3941;
export const POST_MATS = [['chêne', 'oak_log', 'oak_log_top'], ['bouleau', 'birch_log', 'birch_log_top'], ['châtaignier', 'chestnut_log', 'chestnut_log_top'],
  ['tilleul', 'linden_log', 'linden_log_top'], ['pierre taillée', 'cobblestone', 'cobblestone'], ['fer', 'iron_block', 'iron_block']];
Object.assign(BLOCKS, {
  [HEAT_CAKE]: { name: 'Gâteau chauffant', top: 'cake_top', side: 'cake_side', bottom: 'cake_bottom', shape: 'cake', height: 0.5, heater: true, light: 2 },
  [SPRING]: { name: 'Ressort', top: 'spring_top', side: 'spring_side', bottom: 'spring_bottom', spring: true },
  [STICKY_PISTON]: { name: 'Piston agrippant', top: 'sticky_face', side: 'piston_side_head', bottom: 'piston_bottom', piston: 1, sticky: true },
  [STICKY_PISTON + 1]: { name: 'Piston agrippant (sorti)', top: 'piston_bottom', side: 'piston_side', bottom: 'piston_bottom', piston: 1, sticky: true, extended: true, hidden: true, pick: STICKY_PISTON },
  [STICKY_PISTON + 2]: { name: 'Tête de piston agrippant', top: 'sticky_face', side: 'piston_side_head', bottom: 'sticky_face', pistonHead: 1, shape: 'piston_head', hidden: true, pick: STICKY_PISTON },
  [STICKY_PISTON + 3]: { name: 'Piston agrippant (vers le bas)', top: 'piston_bottom', side: 'piston_side_head_down', bottom: 'sticky_face', piston: -1, sticky: true, hidden: true, pick: STICKY_PISTON },
  [STICKY_PISTON + 4]: { name: 'Piston agrippant (vers le bas, sorti)', top: 'piston_bottom', side: 'piston_side_down', bottom: 'piston_bottom', piston: -1, sticky: true, extended: true, hidden: true, pick: STICKY_PISTON },
  [STICKY_PISTON + 5]: { name: 'Tête de piston agrippant', top: 'sticky_face', side: 'piston_side_head_down', bottom: 'sticky_face', pistonHead: -1, shape: 'piston_head', hidden: true, pick: STICKY_PISTON },
  [RADIO_TX]: { name: 'Émetteur de voltite', top: 'radio_tx_top', side: 'radio_side', bottom: 'machine_bottom', radio: 'tx' },
  [RADIO_RX]: { name: 'Récepteur de voltite', top: 'radio_rx_top', side: 'radio_side', bottom: 'machine_bottom', radio: 'rx' },
  [RADIO_RX_ON]: { name: 'Récepteur de voltite (allumé)', top: 'radio_rx_top_on', side: 'radio_side', bottom: 'machine_bottom', radio: 'rx', hidden: true, pick: RADIO_RX, light: 1 },
  [CART_ASSEMBLER]: { name: 'Assembleur de chariot', top: 'cart_asm_top', side: 'cart_asm_side', bottom: 'machine_bottom', cartAsm: true },
});
// schématique (un objet) : voir schematics.js
ITEMS[SCHEMATIC] = { name: 'Schématique', icon: 'texture/objets/suggestions/schematique.png' };
// photos (voir photos.js) : l'appareil, le papier, la photo prise (son numéro : dans w) ; accrochée
// à un mur, un cadre (photoSide : le côté du mur, comme les torches murales)
export const CAMERA = 3942, PHOTO_PAPER = 3943, PHOTO = 3944, PHOTO_FRAME = 3945; // 3945-3950
ITEMS[CAMERA] = { name: 'Appareil photo', icon: 'texture/objets/photo/appareil_photo_hex.png', stack: 1 };
ITEMS[PHOTO_PAPER] = { name: 'Papier photo', icon: 'texture/objets/photo/papier_photo_hex.png' };
ITEMS[PHOTO] = { name: 'Photo', icon: 'texture/objets/photo/photo_hex.png', stack: 1, photo: true };
for (let k = 0; k < 6; k++) BLOCKS[PHOTO_FRAME + k] = { name: 'Photo', top: 'oak_planks', side: 'oak_planks', bottom: 'oak_planks', photo: true, photoSide: k, hidden: true, pick: PHOTO };
export const isPhotoFrame = (id) => id >= PHOTO_FRAME && id < PHOTO_FRAME + 6;
// épave du Traveler-98 (voir wreck dans gen.js, et lore.js pour les fiches des planchettes)
export const HULL = 3951, CONSOLE = 3952, NEDROLYTIUM = 3953;
// Planchettes futuristes : une par fiche du lore (LORE_ITEM + numéro de la fiche, voir lore.js)
export const LORE_ITEM = 4000;
export const loreDoc = (id) => (id > LORE_ITEM && id < LORE_ITEM + 64 && ITEMS[id]?.doc ? id - LORE_ITEM : 0);
for (const [n, d] of Object.entries(LORE)) ITEMS[LORE_ITEM + +n] = { name: 'Planchette futuriste — ' + d.title, icon: 'texture/objets/planchettes/clipboard_future.png', stack: 1, doc: +n };
BLOCKS[HULL] = { name: 'Coque du Traveler-98', top: 'traveler_hull', side: 'traveler_hull', bottom: 'traveler_hull' };
BLOCKS[CONSOLE] = { name: 'Console de bord', top: 'traveler_console_top', side: 'traveler_console', bottom: 'traveler_hull', light: 1 };
BLOCKS[NEDROLYTIUM] = { name: 'Bloc de nédrolytium', top: 'nedrolytium', side: 'nedrolytium', bottom: 'nedrolytium', light: 3 };
// ---------- Liquides et carburant primaire (voir industry.js) ----------
// fluid : la place du bloc dans les réseaux de liquides. Les tuyaux et les réservoirs qui se
// touchent forment un réseau qui porte un seul liquide (eau ou carburant primaire) ; la pompe
// et la raffinerie touchent ces réseaux sans en faire partie (elles y prennent, elles y versent).
export const PIPE = 3954, TANK = 3955, PUMP = 3956, REFINERY = 3957, CRUCIBLE = 3958, FUEL_BLOCK = 3959;
export const CANISTER = 3960, FUEL_CANISTER = 3961, NED_INGOT = 3962;
Object.assign(BLOCKS, {
  [PIPE]: { name: 'Tuyau', top: 'pipe', side: 'pipe', bottom: 'pipe', fluid: 'pipe', shape: 'cable', thin: true },
  [TANK]: { name: 'Réservoir industriel', top: 'tank_top', side: 'tank_side', bottom: 'tank_top', fluid: 'tank' },
  [PUMP]: { name: 'Pompe à eau', top: 'pump_top', side: 'pump_side', bottom: 'machine_bottom', fluid: 'pump', power: 'use' },
  [REFINERY]: { name: 'Raffinerie', top: 'refinery_top', side: 'refinery_side', bottom: 'machine_bottom', fluid: 'refinery', power: 'use', container: 'chest', titled: true },
  [CRUCIBLE]: { name: 'Creuset à nédrolytium', top: 'crucible_top', side: 'crucible_side', bottom: 'machine_bottom', power: 'use', container: 'chest', crucible: true, titled: true, light: 1 },
  // carburant primaire en bloc : une cuve scellée ; la lave, le magma, une flamme ou une explosion
  // à côté la font sauter (voir tnt.js)
  [FUEL_BLOCK]: { name: 'Cuve de carburant primaire', top: 'fuel_block_top', side: 'fuel_block', bottom: 'fuel_block_top', tnt: true, light: 2 },
});
ITEMS[CANISTER] = { name: 'Bidon vide', icon: 'texture/objets/espace/bidon.png', stack: 16 };
ITEMS[FUEL_CANISTER] = { name: 'Bidon de carburant primaire', icon: 'texture/objets/espace/bidon_carburant.png', stack: 16, fuelMb: 1000 };
// (sans recette : il remplit d'un coup le réservoir visé, et ne se vide jamais)
export const CREATIVE_CANISTER = 3983;
ITEMS[CREATIVE_CANISTER] = { name: 'Bidon de carburant primaire créatif', icon: 'texture/objets/espace/bidon_creatif.png', stack: 1 };
ITEMS[NED_INGOT] = { name: 'Lingot de nédrolytium', icon: 'texture/objets/espace/lingot_nedrolytium.png' };
export const isFluidBlock = (id) => !!BLOCKS[id]?.fluid;
// ---------- Fusées (voir rocket.js) ----------
// Une fusée est un objet collé (Super colle) qui a des tuyères. Le réacteur, s'il touche un bloc
// de nédrolytium de la fusée, alimente jusqu'à 4 tuyères ; elles brûlent le carburant des
// réservoirs de fusée (remplis par les tuyaux, comme un réservoir industriel, ou au bidon) et
// poussent vers le haut de la fusée. On la pilote assis au poste de pilotage.
export const REACTOR = 3963, NOZZLE = 3964, ROCKET_TANK = 3965, COCKPIT = 3966, LANDING_LEG = 3967, SPACE_HELMET = 3968, ROCKET_TANK_ADV = 3984, ENGINE = 3985;
// siège passager : on s'y assoit et on voyage avec la fusée, sans rien commander (à plusieurs,
// un seul pilote : les autres prennent un siège)
export const PASSENGER_SEAT = 3996;
Object.assign(BLOCKS, {
  [REACTOR]: { name: 'Réacteur au nédrolytium', top: 'reactor_top', side: 'reactor_side', bottom: 'reactor_top', light: 2 },
  [NOZZLE]: { name: 'Tuyère', top: 'nozzle_top', side: 'nozzle_side', bottom: 'nozzle_bottom', thrust: 1 },
  [ENGINE]: { name: 'Réacteur classique', top: 'engine_top', side: 'engine_side', bottom: 'engine_bottom', thrust: 1.2 },
  [ROCKET_TANK]: { name: 'Réservoir de fusée', top: 'rocket_tank_top', side: 'rocket_tank_side', bottom: 'rocket_tank_top', fluid: 'tank', cap: 8000, rocketTank: true },
  [ROCKET_TANK_ADV]: { name: 'Réservoir de fusée avancé', top: 'rocket_tank_adv_top', side: 'rocket_tank_adv_side', bottom: 'rocket_tank_adv_top', fluid: 'tank', cap: 20000, rocketTank: true },
  [COCKPIT]: { name: 'Poste de pilotage', top: 'cockpit_top', side: 'cockpit_side', bottom: 'traveler_hull', light: 1 },
  [PASSENGER_SEAT]: { name: 'Siège passager', top: 'seat_top', side: 'seat_side', bottom: 'traveler_hull' },
  [LANDING_LEG]: { name: "Pied d'atterrissage", top: 'leg_top', side: 'leg_side', bottom: 'leg_top', shape: 'post' },
});
// ---------- Stations et vaisseaux automatisés (voir orbital.js) ----------
export const STATION_CORE = 3986, OXYGEN_GEN = 3987, GRAVITY_GEN = 3988, SOLAR_PANEL = 3989, DOCK_PORT = 3990, ORBITAL_STORE = 3991, CARGO_LAUNCHER = 3992, FLIGHT_COMPUTER = 3993, DRONE_BAY = 3994, MINING_DRONE = 3995;
Object.assign(BLOCKS, {
  [STATION_CORE]: { name: 'Noyau de station', top: 'station_core_top', side: 'station_core_side', bottom: 'station_core_top', power: 'link', orb: 'core', light: 2 },
  [OXYGEN_GEN]: { name: "Générateur d'oxygène", top: 'oxygen_top', side: 'oxygen_side', bottom: 'machine_bottom', power: 'use', orb: 'oxy', orbUse: true },
  [GRAVITY_GEN]: { name: 'Générateur de gravité', top: 'gravity_top', side: 'gravity_side', bottom: 'machine_bottom', power: 'use', orb: 'grav', orbUse: true },
  [SOLAR_PANEL]: { name: 'Panneau solaire', top: 'solar_top', side: 'solar_side', bottom: 'machine_bottom', power: 'gen', orb: 'solar', solar: true, remote: true },
  [DOCK_PORT]: { name: "Port d'amarrage", top: 'dock_port_top', side: 'dock_port_side', bottom: 'dock_port_top', power: 'use', fluid: 'pipe', orb: 'port', orbUse: true, remote: true },
  [ORBITAL_STORE]: { name: 'Entrepôt orbital', top: 'orbital_store_top', side: 'orbital_store_side', bottom: 'orbital_store_top', container: 'chest', orb: 'store', titled: true },
  [CARGO_LAUNCHER]: { name: 'Lanceur de cargo', top: 'launcher_top', side: 'launcher_side', bottom: 'machine_bottom', power: 'use', orb: 'launch', orbUse: true, remote: true },
  [FLIGHT_COMPUTER]: { name: 'Ordinateur de bord', top: 'flight_computer_top', side: 'flight_computer_side', bottom: 'machine_bottom', orb: 'computer', light: 1 },
  [DRONE_BAY]: { name: 'Baie de drones', top: 'drone_bay_top', side: 'drone_bay_side', bottom: 'machine_bottom', power: 'use', container: 'chest', orb: 'bay', orbUse: true, remote: true, titled: true },
});
ITEMS[MINING_DRONE] = { name: 'Drone de minage', icon: 'texture/objets/espace/drone_minage.png', stack: 8 };
// casque spatial : se porte sur la tête ; on respire sur les planètes sans air (voir planetgen.js)
ITEMS[SPACE_HELMET] = { name: 'Casque spatial', icon: 'texture/objets/espace/casque_spatial.png', stack: 1, wear: 'head' };
// ---------- Liquides, machines, propulsion (voir liquids.js, industry.js, rocket.js) ----------
// Tuyau renforcé, réservoirs en cuivre et renforcé : plus de liquide (cap, en mB). Les machines
// à liquides (fmach : leur recette, voir FLUID_RECIPES) prennent dans les réseaux qui les
// touchent et versent dans d'autres. Les moteurs de fusée : thrust (poussée), burn (consommation,
// en tuyères), selfFed (pas besoin du réacteur au nédrolytium), ion (sans carburant : du courant).
export const PIPE_HD = 4214, TANK_CU = 4215, TANK_HD = 4216, DERRICK = 4217, CONDENSER = 4218, REACTION_CHAMBER = 4219, ELECTROLYSER = 4220;
export const MIXER = 4221, COMPLEX_FURNACE = 4222, HYDRAULIC_PRESS = 4223, COOLER = 4224, GENSET = 4225;
export const CHEM_ENGINE = 4226, ION_THRUSTER = 4227, PLASMA_ENGINE = 4228, STELLAR_NOZZLE = 4229, FLOATER = 4230;
const mach = (name, tex, extra) => ({ name, top: 'l4_carter_machine', side: 'l4_' + tex, bottom: 'machine_bottom', power: 'use', ...extra });
Object.assign(BLOCKS, {
  [PIPE_HD]: { name: 'Tuyau renforcé', top: 'l4_tuyau_renforce', side: 'l4_tuyau_renforce', bottom: 'l4_tuyau_renforce', fluid: 'pipe', cap: 1000, shape: 'cable', thin: true },
  [TANK_CU]: { name: 'Réservoir en cuivre', top: 'l4_reservoir_cuivre', side: 'l4_reservoir_cuivre', bottom: 'l4_reservoir_cuivre', fluid: 'tank', cap: 32000 },
  [TANK_HD]: { name: 'Réservoir renforcé', top: 'l4_reservoir_renforce', side: 'l4_reservoir_renforce', bottom: 'l4_reservoir_renforce', fluid: 'tank', cap: 64000 },
  [DERRICK]: mach('Puits de pétrole', 'marteau_pilon', { fluid: 'derrick', titled: true }),
  [CONDENSER]: mach('Condenseur', 'condenseur', { fluid: 'machine', fmach: 'condenser', container: 'chest', titled: true }),
  [REACTION_CHAMBER]: mach('Chambre de réaction', 'chambre_de_reaction', { fluid: 'machine', fmach: 'reaction', container: 'chest', titled: true, light: 1 }),
  [ELECTROLYSER]: mach('Électrolyseur', 'electrolyseur', { fluid: 'machine', fmach: 'electrolyser', container: 'chest', titled: true }),
  [MIXER]: mach('Mélangeur', 'melangeur', { fluid: 'machine', fmach: 'mixer', container: 'chest', titled: true }),
  [COMPLEX_FURNACE]: mach('Four complexe', 'four_complexe', { fluid: 'machine', fmach: 'furnace', container: 'chest', titled: true, light: 2 }),
  [HYDRAULIC_PRESS]: mach('Presse hydraulique', 'presse', { fluid: 'machine', fmach: 'press', container: 'chest', titled: true }),
  [COOLER]: mach('Refroidisseur', 'refroidisseur', { fluid: 'machine', fmach: 'cooler', container: 'chest', titled: true }),
  [GENSET]: { name: 'Groupe électrogène', top: 'l4_carter_machine', side: 'l4_bloc_de_cables', bottom: 'machine_bottom', power: 'gen', fluid: 'genset' },
  [CHEM_ENGINE]: { name: 'Réacteur chimique', top: 'l4_reacteur_chimique', side: 'l4_reacteur_chimique', bottom: 'nozzle_bottom', thrust: 1, burn: 1.5, selfFed: true },
  [ION_THRUSTER]: { name: 'Propulseur ionique', top: 'l4_propulseur_ionique', side: 'l4_propulseur_ionique', bottom: 'nozzle_bottom', thrust: 0.15, burn: 0, selfFed: true, ion: true, light: 1 },
  [PLASMA_ENGINE]: { name: 'Réacteur plasma', top: 'l4_reacteur_plasma', side: 'l4_reacteur_plasma', bottom: 'nozzle_bottom', thrust: 2.5, burn: 1.2, light: 2 },
  [STELLAR_NOZZLE]: { name: 'Tuyère stellaire', top: 'l4_tuyere_stellaire', side: 'l4_tuyere_stellaire', bottom: 'nozzle_bottom', thrust: 5, burn: 2, light: 3 },
  [FLOATER]: { name: 'Flotteur', top: 'l4_flotteur', side: 'l4_flotteur', bottom: 'l4_flotteur' },
});
// bidons pleins de chaque liquide (le bidon de carburant primaire existe déjà, plus haut)
for (const [, name, tex, id] of LIQUIDS) {
  if (!id) continue;
  ITEMS[id] = { name: 'Bidon ' + (/^[aeiouyéèh]/i.test(name) ? 'd\'' : 'de ') + name.toLowerCase(), icon: 'texture/blocs/liquides/' + tex + '.png', stack: 16, canMb: CAN_MB };
}
// ---------- Étanchéité : portes, soudure (voir doors.js) ----------
// door : sa sorte ; fermée, un bloc plein (l'air ne passe pas) ; ouverte (doorOpen), son cadre seul.
// closedId / openId : les deux états. La porte étanche fait 2 blocs de haut (doorTop : le haut,
// posé avec le bas). La porte holographique : « fermée », c'est son champ (on le traverse, mais
// seal : il garde l'air) ; « ouverte », son cadre seul (sans courant).
export const AIRLOCK = 4244, SEAL_DOOR = 4246, SEAL_DOOR_TOP = 4248, ELEC_DOOR = 4250, HOLO_DOOR = 4252, HYDRO_DOOR = 4254, WELDER = 4256;
{
  const door = (id, name, tex, kind, extra = {}) => {
    const t = 'l4_' + tex;
    BLOCKS[id] = { name, top: t, side: t, bottom: t, door: kind, closedId: id, openId: id + 1, ...extra };
    BLOCKS[id + 1] = { name: name + ' (ouverte)', top: t, side: t, bottom: t, door: kind, doorOpen: true, closedId: id, openId: id + 1, shape: 'post', thin: true, hidden: true, pick: extra.pick ?? id };
  };
  door(AIRLOCK, 'Sas', 'sas', 'airlock');
  door(SEAL_DOOR, 'Porte étanche', 'porte_etanche_bas', 'seal');
  door(SEAL_DOOR_TOP, 'Porte étanche', 'porte_etanche_haut', 'seal', { doorTop: true, hidden: true, pick: SEAL_DOOR });
  door(ELEC_DOOR, 'Porte électrique', 'porte_electrique', 'elec');
  door(HOLO_DOOR, 'Porte holographique', 'porte_holographique', 'holo', { glass: true, thin: true, seal: true, light: 2 });
  BLOCKS[HOLO_DOOR + 1].name = 'Porte holographique (éteinte)';
  door(HYDRO_DOOR, 'Porte hydraulique', 'porte_hydraulique_tuyaux', 'hydro');
}
ITEMS[WELDER] = { name: 'Soudure de joint', icon: 'texture/blocs/etancheite/soudure_joint.png', stack: 1 };
export const isDoor = (id) => !!BLOCKS[id]?.door;

// ---------- Mécanique : charnière, rotor, servomoteur, rail de translation, inertie ----------
// mech : comme l'hélice (voir structs.js, spinUp / turnRotor), ce qui est posé dessus devient un
// objet tenu sur son axe : la charnière le fait pivoter d'un quart de tour avec du courant ; le
// rotor le fait tourner sans fin (vitesse : le cran) ; le servomoteur le tourne à un angle (le
// cran : 0 à 180°) ; le rail de translation le soulève d'autant de blocs que le cran.
// inertia : sur un objet, alimenté : l'accentueur rend les moteurs plus vifs, le nullifieur
// annule la dérive et la rotation. Train d'atterrissage : il amortit le contact avec le sol.
export const HINGE = 4257, ROTOR_BLOCK = 4259, SERVO = 4261, SLIDE_RAIL = 4263, INERTIA_ACCENT = 4265, INERTIA_NULL = 4267, LANDING_GEAR = 4269;
{
  const two = (id, name, tex, extra) => {
    const t = 'l4_' + tex;
    BLOCKS[id] = { name, top: t, side: t, bottom: t, offId: id, onId: id + 1, ...extra };
    BLOCKS[id + 1] = { name: name + ' (allumé)', top: t, side: t, bottom: t, offId: id, onId: id + 1, on: true, hidden: true, pick: id, light: 1, ...extra };
  };
  two(HINGE, 'Charnière', 'charniere', { mech: 'hinge' });
  two(ROTOR_BLOCK, 'Rotor', 'rotor', { mech: 'rotor' });
  two(SERVO, 'Servomoteur', 'servomoteur', { mech: 'servo' });
  two(SLIDE_RAIL, 'Rail de translation', 'rail_de_translation', { mech: 'slide' });
  two(INERTIA_ACCENT, 'Accentueur inertiel', 'accentueur_inertiel', { inertia: 'accent' });
  two(INERTIA_NULL, 'Nullifieur inertiel', 'nullifieur_inertiel', { inertia: 'null' });
  BLOCKS[LANDING_GEAR] = { name: "Train d'atterrissage", top: 'l4_train_d_atterrissage', side: 'l4_train_d_atterrissage', bottom: 'l4_train_d_atterrissage', gear: true };
}
// ---------- Armes et boucliers (voir weapons.js) ----------
// Armes à main (gun : sa sorte), munitions, armes en blocs (weapon : sa sorte ; on tire depuis un
// poste de pilotage de l'objet collé qui les porte), chambre de chargement (leurs munitions),
// accumulateur électrique (la charge du canon à bobine et des boucliers), boucliers.
export const PISTOL = 4270, RIFLE = 4271, RAILGUN = 4272, ENERGY_GUN = 4273, FLAMER = 4274;
export const BULLET = 4275, DU_BULLET = 4276, RAIL_ROD = 4277, ENERGY_CELL = 4278, ROCKET_AMMO = 4279, MISSILE_AMMO = 4280, TORPEDO_AMMO = 4281, HEAVY_SHELL = 4282, NUKE_CHARGE = 4283;
export const AUTOCANNON = 4284, ROCKET_LAUNCHER = 4285, MISSILE_LAUNCHER = 4286, TORPEDO_LAUNCHER = 4287, COIL_CANNON = 4288, GUSTAVE = 4289;
export const AMMO_BOX = 4290, ACCUMULATOR = 4291, SHIELD_EMITTER = 4292, DEFLECTOR = 4293, THERMAL_SHIELD = 4294, STELLAR_SHIELD = 4295, ARTILLERY = 4296;
// Tourelles (un bloc : elles visent et tirent toutes seules sur les autres équipes, voir weapons.js)
export const TURRET_GUN = 4300, TURRET_MISSILE = 4301, TURRET_LASER = 4302;
// Les équipes (d'un objet collé, d'une tourelle posée dans le monde, d'un joueur : voir /equipe)
export const TEAMS = [
  { id: 'rouge', name: 'Rouge', color: '#e04848' },
  { id: 'bleu', name: 'Bleue', color: '#3f8cf0' },
  { id: 'vert', name: 'Verte', color: '#48c060' },
  { id: 'jaune', name: 'Jaune', color: '#f0c830' },
];
export const teamOf = (id) => TEAMS.find((t) => t.id === id) || null;
{
  const I = (f) => 'texture/objets/armes/' + f + '.png';
  ITEMS[PISTOL] = { name: 'Pistolet', icon: I('pistolet'), stack: 1, gun: 'pistol' };
  ITEMS[RIFLE] = { name: 'Fusil', icon: I('fusil'), stack: 1, gun: 'rifle' };
  ITEMS[RAILGUN] = { name: 'Railgun', icon: I('railgun'), stack: 1, gun: 'rail' };
  ITEMS[ENERGY_GUN] = { name: 'Arme à énergie', icon: I('arme_energie'), stack: 1, gun: 'energy' };
  ITEMS[FLAMER] = { name: 'Lance-flammes', icon: I('lance_flammes'), stack: 1, gun: 'flame' };
  ITEMS[BULLET] = { name: 'Balle', icon: I('balle'), stack: 64 };
  ITEMS[DU_BULLET] = { name: 'Balle en uranium appauvri', icon: I('balle_uranium'), stack: 64 };
  ITEMS[RAIL_ROD] = { name: 'Tige de railgun', icon: I('tige'), stack: 32 };
  ITEMS[ENERGY_CELL] = { name: "Cellule d'énergie", icon: I('cellule_energie'), stack: 16 };
  ITEMS[ROCKET_AMMO] = { name: 'Roquette', icon: I('roquette'), stack: 16 };
  ITEMS[MISSILE_AMMO] = { name: 'Missile', icon: I('missile'), stack: 8 };
  ITEMS[TORPEDO_AMMO] = { name: 'Torpille', icon: I('torpille'), stack: 8 };
  ITEMS[HEAVY_SHELL] = { name: 'Obus lourd', icon: I('obus_lourd'), stack: 8 };
  ITEMS[NUKE_CHARGE] = { name: 'Charge nucléaire', icon: I('charge_nucleaire'), stack: 1 };
  const B = (id, name, tex, extra) => { const t = 'l5_' + tex; BLOCKS[id] = { name, top: t, side: t, bottom: t, ...extra }; };
  B(AUTOCANNON, 'Canon automatique', 'canon_automatique', { weapon: 'auto' });
  B(ROCKET_LAUNCHER, 'Lance-roquettes', 'lance_roquettes', { weapon: 'rocket' });
  B(MISSILE_LAUNCHER, 'Lance-missiles', 'lance_missiles', { weapon: 'missile' });
  B(TORPEDO_LAUNCHER, 'Lance-torpilles', 'lance_torpilles', { weapon: 'torpedo' });
  B(COIL_CANNON, 'Canon à bobine', 'bobine_magnetique', { weapon: 'coil' });
  B(GUSTAVE, 'Canon Gustave', 'canon_gustave', { weapon: 'gustave' });
  B(ARTILLERY, "Canon d'artillerie", 'canon_artillerie', { weapon: 'artillery' });
  B(AMMO_BOX, 'Chambre de chargement', 'chambre_de_chargement', { container: 'chest', ammoBox: true });
  B(ACCUMULATOR, 'Accumulateur électrique', 'accumulateur_electrique', { accu: true });
  B(SHIELD_EMITTER, 'Émetteur de bouclier', 'emetteur_bouclier', { shield: 'emitter', light: 2 });
  B(DEFLECTOR, 'Déflecteur', 'deflecteur', { shield: 'deflector', light: 1 });
  B(THERMAL_SHIELD, 'Projecteur de bouclier thermique', 'projecteur_bouclier_thermique', { shield: 'thermal', light: 1 });
  B(STELLAR_SHIELD, 'Générateur de bouclier stellaire', 'generateur_bouclier_stellaire', { shield: 'stellar', light: 3 });
  B(TURRET_GUN, 'Tourelle à balles', 'tourelle_balles', { turret: 'gun' });
  B(TURRET_MISSILE, 'Tourelle lance-missiles', 'tourelle_missiles', { turret: 'missile' });
  B(TURRET_LASER, 'Tourelle laser', 'tourelle_laser', { turret: 'laser', light: 1 });
}
export const isMech = (id) => !!BLOCKS[id]?.mech;
export const isPivot = (id) => isPropeller(id) || isMech(id);
export const pivotOn = (id) => id === PROPELLER_ON || (isMech(id) && !!BLOCKS[id].on);
// ---------- Roches, sables et glaces des autres planètes (voir planetgen.js) ----------
// (textures : outils/textures-planetes.cjs)
export const REGOLITH = 3969, MOON_ROCK = 3970, OCHRE_SAND = 3971, RED_ROCK = 3972, ICE = 3973, BLUE_ICE = 3974, NITROGEN_ICE = 3975, THOLIN = 3976, SALT = 3977, IO_SULFUR = 3978, PERMAFROST = 3979, LAYERED_ROCK = 3980, ASH_ROCK = 3981, CRACKED_ICE = 3982;
Object.assign(BLOCKS, {
  [REGOLITH]: { name: "Régolithe", top: 'regolith', side: 'regolith', bottom: 'regolith' },
  [MOON_ROCK]: { name: "Roche lunaire", top: 'moon_rock', side: 'moon_rock', bottom: 'moon_rock' },
  [OCHRE_SAND]: { name: "Sable ocre", top: 'ochre_sand', side: 'ochre_sand', bottom: 'ochre_sand' },
  [RED_ROCK]: { name: "Roche rouge", top: 'red_rock', side: 'red_rock', bottom: 'red_rock' },
  [ICE]: { name: "Glace", top: 'ice', side: 'ice', bottom: 'ice' },
  [BLUE_ICE]: { name: "Glace bleue", top: 'blue_ice', side: 'blue_ice', bottom: 'blue_ice' },
  [NITROGEN_ICE]: { name: "Glace d'azote", top: 'nitrogen_ice', side: 'nitrogen_ice', bottom: 'nitrogen_ice' },
  [THOLIN]: { name: "Tholins", top: 'tholin', side: 'tholin', bottom: 'tholin' },
  [SALT]: { name: "Croûte de sel", top: 'salt', side: 'salt', bottom: 'salt' },
  [IO_SULFUR]: { name: "Soufre volcanique", top: 'io_sulfur', side: 'io_sulfur', bottom: 'io_sulfur' },
  [PERMAFROST]: { name: "Pergélisol", top: 'permafrost', side: 'permafrost', bottom: 'permafrost' },
  [LAYERED_ROCK]: { name: "Roche stratifiée", top: 'layered_rock', side: 'layered_rock', bottom: 'layered_rock' },
  [ASH_ROCK]: { name: "Roche de cendre", top: 'ash_rock', side: 'ash_rock', bottom: 'ash_rock' },
  [CRACKED_ICE]: { name: "Glace fissurée", top: 'crack_ice', side: 'crack_ice', bottom: 'crack_ice' },
});
// ---------- Système Pipiens : les sols d'Eldra et de Glacyon (voir planetgen.js) ----------
export const ELDRA_LICHEN = 3997, ELDRA_MOSS = 3998, MAT_ORANGE = 3999, MAT_GREEN = 4082, PINK_NITROGEN = 4083;
export const PIPIENS_SOILS = [ELDRA_LICHEN, ELDRA_MOSS, MAT_ORANGE, MAT_GREEN, PINK_NITROGEN];
Object.assign(BLOCKS, {
  [ELDRA_LICHEN]: { name: "Sol à lichens violet-noir", top: 'eldra_lichen', side: 'eldra_lichen_side', bottom: 'dirt' },
  [ELDRA_MOSS]: { name: "Mousse violette", top: 'eldra_moss', side: 'eldra_moss', bottom: 'eldra_moss' },
  [MAT_ORANGE]: { name: "Tapis microbien orangé", top: 'mat_orange', side: 'mat_orange', bottom: 'mat_orange' },
  [MAT_GREEN]: { name: "Tapis microbien vert", top: 'mat_green', side: 'mat_green', bottom: 'mat_green' },
  [PINK_NITROGEN]: { name: "Glace d'azote rose", top: 'pink_nitrogen', side: 'pink_nitrogen', bottom: 'pink_nitrogen' },
});

// ---------- Système Ethan : les sols de ses planètes (voir planetgen.js) ----------
export const SLAG = 4084, GLOW_CRUST = 4085, GRAPHITE = 4086, RAW_DIAMOND = 4087, CRYSTAL_PLANT = 4088, BLACK_GLASS = 4089,
  REEF = 4090, RADIO_SOIL = 4091, CRYSTAL_SAND = 4092, QUARTZ = 4093, BLACK_DUST = 4094, GLOW_ICE = 4095;
export const ETHAN_SOILS = [SLAG, GLOW_CRUST, GRAPHITE, RAW_DIAMOND, CRYSTAL_PLANT, BLACK_GLASS, REEF, RADIO_SOIL, CRYSTAL_SAND, QUARTZ, BLACK_DUST, GLOW_ICE];
Object.assign(BLOCKS, {
  [SLAG]: { name: "Scories noires", top: 'slag', side: 'slag', bottom: 'slag' },
  [GLOW_CRUST]: { name: "Croûte incandescente", top: 'glow_crust', side: 'glow_crust', bottom: 'glow_crust', glow: true, light: 2 },
  [GRAPHITE]: { name: "Graphite", top: 'graphite', side: 'graphite', bottom: 'graphite' },
  [RAW_DIAMOND]: { name: "Diamant brut", top: 'raw_diamond', side: 'raw_diamond', bottom: 'raw_diamond', glow: true, light: 2 },
  [CRYSTAL_PLANT]: { name: "Cristal végétal", top: 'crystal_plant', side: 'crystal_plant', bottom: 'crystal_plant', glow: true, light: 3 },
  [BLACK_GLASS]: { name: "Verre noir", top: 'black_glass', side: 'black_glass', bottom: 'black_glass' },
  [REEF]: { name: "Récif luminescent", top: 'reef', side: 'reef', bottom: 'reef', glow: true, light: 3 },
  [RADIO_SOIL]: { name: "Sol radiotrophe", top: 'radio_soil', side: 'radio_soil_side', bottom: 'dirt' },
  [CRYSTAL_SAND]: { name: "Sable de cristal", top: 'crystal_sand', side: 'crystal_sand', bottom: 'crystal_sand' },
  [QUARTZ]: { name: "Quartz", top: 'quartz', side: 'quartz', bottom: 'quartz' },
  [BLACK_DUST]: { name: "Poussière noire", top: 'black_dust', side: 'black_dust', bottom: 'black_dust' },
  [GLOW_ICE]: { name: "Glace lumineuse", top: 'glow_ice', side: 'glow_ice', bottom: 'glow_ice', glow: true, light: 3 },
});

// ---------- Les premiers ids au-delà de 4095 (voir MAX_ID) ----------
// La coque de la station Hexa-Zéro en ruine (voir station.js) : tordue, soudée par les impacts, elle
// ne se démonte plus. La balise interstellaire : la fin du jeu (voir industry.js et ending.js).
export const RUIN_HULL = 4096, RUIN_DARK = 4097, BEACON = 4098;
// Levier analogique (idée d'un joueur) : 16 crans, de 0 (rien) à 15 (pleine puissance). Clic droit :
// un cran de plus, Maj + clic droit : un de moins (maintenu, il défile). Ce qu'il alimente, fil de
// voltite compris, reçoit sa puissance : une hélice tourne plus ou moins vite (sa portance suit le
// cran), un bloc physique pousse plus ou moins fort. Un répéteur, un émetteur sans fil : tout ou
// rien (ils redonnent 15). 4099 + cran.
export const ANALOG = 4099;
// Foreuse horizontale (idée d'un joueur) : la foreuse couchée. Elle creuse devant elle (le côté
// opposé au joueur qui l'a posée), case après case, jusqu'à HDRILL_REACH ; même courant, même
// sortie (tapis, coffre, wagon). 4115 + côté (6 orientations).
export const HDRILL = 4115, HDRILL_REACH = 64;
// Voitures (voir cars.js) : des roues sous un objet collé, un volant (le siège du conducteur, il
// donne l'avant de la voiture) ou un pilote de route (il la conduit tout seul, d'étape en étape,
// comme le gravitron). Les roues roulent vers l'avant et tiennent sur le côté ; alimentées en
// voltite, elles sont motrices (levier analogique : la vitesse suit son cran).
export const WHEEL = 4121, CAR_SEAT = 4122, ROUTE_PILOT = 4128; // (volant, pilote : 6 orientations)
export const isWheel = (id) => id === WHEEL;
export const isCarSeat = (id) => id >= CAR_SEAT && id < CAR_SEAT + 6;
export const isRoutePilot = (id) => id >= ROUTE_PILOT && id < ROUTE_PILOT + 6;
export const isAnalog = (id) => id >= ANALOG && id < ANALOG + 16;
Object.assign(BLOCKS, {
  [RUIN_HULL]: { name: 'Coque en ruine', top: 'old_steel', side: 'old_steel', bottom: 'old_steel', unbreakable: true, hidden: true },
  [RUIN_DARK]: { name: 'Coque calcinée', top: 'dark_steel', side: 'dark_steel', bottom: 'dark_steel', unbreakable: true, hidden: true },
  [BEACON]: { name: 'Balise interstellaire', top: 'beacon_top', side: 'beacon_side', bottom: 'machine_bottom', power: 'use', beacon: true, titled: true, light: 2 },
});
// (ronde : voir addCarWheel dans mesher.js ; elle reste un bloc plein pour la physique)
BLOCKS[WHEEL] = { name: 'Roue', top: 'wheel_hub', side: 'wheel_tire', bottom: 'wheel_hub', wheel: true, shape: 'carwheel' };
for (let k = 0; k < 6; k++) {
  const front = (i, f, b, s) => Array.from({ length: 6 }, (_, j) => (j === (k + 3) % 6 ? f : j === k ? b : s));
  BLOCKS[CAR_SEAT + k] = { name: 'Volant', top: 'car_seat_top', side: 'car_seat_side', bottom: 'car_seat_side', sides: front(k, 'car_seat_front', 'car_seat_side', 'car_seat_side'), facing: k, base: CAR_SEAT, pick: CAR_SEAT, hidden: k > 0, carSeat: true };
  BLOCKS[ROUTE_PILOT + k] = { name: 'Pilote de route', top: 'route_pilot_top', side: 'route_pilot_side', bottom: 'machine_bottom', sides: front(k, 'route_pilot_front', 'route_pilot_side', 'route_pilot_side'), facing: k, base: ROUTE_PILOT, pick: ROUTE_PILOT, hidden: k > 0, routePilot: true, light: 1 };
}
for (let k = 0; k < 6; k++) {
  BLOCKS[HDRILL + k] = { name: 'Foreuse horizontale', top: 'drill_side', side: 'drill_side', bottom: 'machine_bottom', sides: Array.from({ length: 6 }, (_, i) => (i === (k + 3) % 6 ? 'drill_bottom' : i === k ? 'drill_top' : 'drill_side')),
    facing: k, base: HDRILL, pick: HDRILL, hidden: k > 0, container: 'machine', machine: 'drill', hdrill: true, power: 'use' };
}
for (let k = 0; k < 16; k++) {
  BLOCKS[ANALOG + k] = { name: k ? 'Levier analogique (' + k + ' / 15)' : 'Levier analogique', top: 'steel', side: 'steel', bottom: 'steel', lever: true, analog: k, item: 'texture/blocs/levier/analog_lever.png' };
  if (k) Object.assign(BLOCKS[ANALOG + k], { hidden: true, pick: ANALOG });
}

POST_MATS.forEach(([n, side, top], k) => { BLOCKS[POST + k] = { name: 'Poteau en ' + n, top, side, bottom: top, shape: 'post' }; });
// pistons : pBase, l'id du piston vers le haut de sa famille (+0 rentré, +1 sorti, +2 tête ;
// +3..+5 : les mêmes vers le bas)
for (const base of [PISTON, STICKY_PISTON]) for (let k = 0; k < 6; k++) BLOCKS[base + k].pBase = base;
// ---------- Les nouveaux minerais (voir metals.js) ----------
// Pour chacun : le minerai, son bloc de rangement (9 lingots), son lingot (ou ses cristaux) et
// la poussière du concasseur. Icônes : texture/objets/metaux (voir outils/icones-metaux.cjs).
for (const m of METALS) {
  const ot = oreTex(m), bt = blockTex(m);
  BLOCKS[m.ore] = { name: oreName(m), top: ot, side: ot, bottom: ot };
  BLOCKS[m.block] = { name: blockName(m), top: bt, side: bt, bottom: bt };
  ITEMS[m.product] = { name: m.productName, icon: 'texture/objets/metaux/' + m.key + (m.gem ? '_cristal' : '_lingot') + '.png', small: true };
  if (m.dust) ITEMS[m.dust] = { name: m.dustName, icon: 'texture/objets/metaux/' + m.key + '_poussiere.png', small: true };
}
Object.assign(BLOCKS, {
  [REINFORCED_CONCRETE]: { name: 'Béton armé', top: 'beton_arme', side: 'beton_arme', bottom: 'beton_arme' },
  [CERAMIC]: { name: 'Céramique', top: 'ceramique', side: 'ceramique', bottom: 'ceramique' },
  // (verre renforcé : un verre épais et laiteux, qui ne laisse pas voir à travers)
  [REINFORCED_GLASS]: { name: 'Verre renforcé', top: 'verre_renforce', side: 'verre_renforce', bottom: 'verre_renforce' },
});
// ---------- Les blocs des nouveaux biomes (voir biomes.js) ----------
for (const [id, tex, name, , o] of ENV_BLOCKS) {
  const { top = tex, bottom = tex, ...rest } = o;
  BLOCKS[id] = { name, top, side: tex, bottom, ...rest };
}

export const isSpring = (id) => !!BLOCKS[id]?.spring;
export const isRadio = (id) => !!BLOCKS[id]?.radio;

export const isBelt = (id) => !!BLOCKS[id]?.belt;
export const isShaft = (id) => id >= SHAFT && id < SHAFT + 6;
export const isArm = (id) => !!BLOCKS[id]?.arm;
// Le bloc fait-il partie du réseau électrique ? (machines, câbles, sources...)
export const isPowerBlock = (id) => !!BLOCKS[id]?.power;

// ---------- Dalles ----------
// Chaque matière a sa dalle horizontale (en bas ou en haut de la case) et sa dalle verticale
// (une moitié de l'hexagone, coupé d'un coin au coin opposé : 6 orientations, vslab = le côté
// de la case qu'elle occupe). Deux dalles qui se complètent dans une case : de la même matière,
// le bloc plein ; de deux matières différentes, un bloc « deux dalles » (dslab : [moitié a,
// moitié b], ids des deux dalles), qui redonne ses deux moitiés quand on le casse.
// Ne jamais changer l'ordre des matières (les ids en dépendent) : ajouter les nouvelles à la fin.
export const SLAB_MATS = [
  { name: 'pierre taillée', full: 28, bottom: 32, top: 34, tex: 'cobblestone' },
  { name: 'chêne', full: 18, bottom: 33, top: 35, tex: 'oak_planks' },
  { name: 'châtaignier', full: 99, tex: 'chestnut_planks' },
  { name: 'tilleul', full: 154, tex: 'linden_planks' },
  { name: 'bouleau', full: 258, tex: 'birch_planks' },
  { name: 'diorite polie', full: 262, tex: 'polished_diorite' },
  { name: 'briques de diorite', full: 263, tex: 'diorite_bricks' },
  { name: 'briques de pierre', full: 631, tex: 'stone_bricks' },
  { name: 'briques rouges', full: 623, tex: 'red_bricks' },
  { name: 'marbre', full: 617, tex: 'marble' },
  { name: 'briques de grès', full: 628, tex: 'sandstone_bricks' },
  { name: 'pierre polie', full: 622, tex: 'polished_stone' },
  { name: 'parquet', full: 637, tex: 'wood_parquet' },
  { name: 'pavés de rue', full: 604, tex: 'cobble_street' },
  { name: 'dallage de pierre', full: 610, tex: 'flagstone' },
  { name: 'briques de terre crue', full: 620, tex: 'mud_brick' },
];
// ids d'une matière m : base + 0 / 1 dalle basse / haute (matières ajoutées), + 2..7 dalle
// verticale côté 0..5, + 8 + m2 : en bas m, en haut m2, + 24 + 16 k + m2 : m côté k (0..2), m2
// côté k + 3
const SLAB_BASE = 1000, SLAB_STRIDE = 80;
const slabBase = (m) => SLAB_BASE + m * SLAB_STRIDE;
export const vslabId = (m, k) => slabBase(m) + 2 + k;
const hmixId = (low, high) => slabBase(low) + 8 + high;
const vmixId = (m, k, m2) => (k < 3 ? slabBase(m) + 24 + k * 16 + m2 : slabBase(m2) + 24 + (k - 3) * 16 + m);
SLAB_MATS.forEach((mat, m) => {
  const { tex, full } = mat;
  if (!mat.bottom) {
    mat.bottom = slabBase(m); mat.top = slabBase(m) + 1;
    BLOCKS[mat.bottom] = { name: 'Dalle de ' + mat.name, top: tex, side: tex, bottom: tex, slab: 'bottom', full, other: mat.top };
    BLOCKS[mat.top] = { name: 'Dalle de ' + mat.name + ' (haute)', top: tex, side: tex, bottom: tex, slab: 'top', full, other: mat.bottom, hidden: true, pick: mat.bottom };
  }
  BLOCKS[mat.bottom].slabMat = BLOCKS[mat.top].slabMat = m;
  for (let k = 0; k < 6; k++) {
    BLOCKS[vslabId(m, k)] = {
      name: 'Dalle verticale de ' + mat.name, top: tex, side: tex, bottom: tex, vslab: k, shape: 'vslab', slabMat: m, full,
      hidden: k > 0, pick: vslabId(m, 0),
    };
  }
});
SLAB_MATS.forEach((a, m) => SLAB_MATS.forEach((b, m2) => {
  if (m === m2) return;
  // (pick : la moitié d'en bas, ou du côté k)
  BLOCKS[hmixId(m, m2)] = { name: 'Dalles', top: b.tex, side: a.tex, bottom: a.tex, dslab: [a.bottom, b.top], slabMat: m, hidden: true, pick: a.bottom };
  for (let k = 0; k < 3; k++) {
    BLOCKS[vmixId(m, k, m2)] = { name: 'Dalles', top: a.tex, side: a.tex, bottom: a.tex, dslab: [vslabId(m, k), vslabId(m2, k + 3)], slabMat: m, hidden: true, pick: vslabId(m, 0) };
  }
}));
// Dalle tenue (son id d'objet) -> l'id de cette dalle dans une orientation : 'bottom', 'top' ou
// un côté 0..5 (dalle verticale)
export function slabVariant(item, where) {
  const m = BLOCKS[item]?.slabMat;
  if (m === undefined) return item;
  return typeof where === 'number' ? vslabId(m, where) : where === 'top' ? SLAB_MATS[m].top : SLAB_MATS[m].bottom;
}
// La case contient la dalle cur ; on y ajoute la dalle add : le bloc obtenu, ou null si elles
// ne se complètent pas (même moitié, ou une horizontale et une verticale)
export function slabCombine(cur, add) {
  const a = BLOCKS[cur], b = BLOCKS[add];
  if (a?.slabMat === undefined || b?.slabMat === undefined || a.dslab || b.dslab) return null;
  if (a.slab && b.slab && a.slab !== b.slab) {
    const [low, high] = a.slab === 'bottom' ? [a, b] : [b, a];
    return low.slabMat === high.slabMat ? SLAB_MATS[low.slabMat].full : hmixId(low.slabMat, high.slabMat);
  }
  if (a.vslab !== undefined && b.vslab !== undefined && (a.vslab + 3) % 6 === b.vslab) {
    return a.slabMat === b.slabMat ? SLAB_MATS[a.slabMat].full : vmixId(a.slabMat, a.vslab, b.slabMat);
  }
  return null;
}
// Moitié du bloc « deux dalles » id où tombe le point (dx, dz : depuis le centre de la case,
// fy : hauteur dans la case) : [moitié touchée, moitié qui reste]
export function slabPartAt(id, dx, fy, dz) {
  const [a, b] = BLOCKS[id].dslab;
  return inSolidPart(a, dx, fy, dz) ? [a, b] : [b, a];
}
// Collisions d'un cercle (centre dx, dz depuis le centre de la case, rayon radius) avec le bloc
// id : toute la case, ou la moitié d'une dalle verticale. blockPush : le décalage qui l'en sort
// (ou null) ; blockOverlap : le touche-t-il ?
// Lit de villageois : ses 5 parois (on entre par l'ouverture) et, en haut, le toit (de POD_ROOF à
// 1 : un villageois de 1,85 tient debout dedans). a, b : hauteurs testées dans la case (0..1).
const POD_ROOF = 0.88;
// (les deux parois qui bordent l'ouverture sont plus minces : on y passe, 0,54 de large)
const podWall = (i, s) => [CORNERS[i], CORNERS[(i + 1) % 6], CORNERS[(i + 1) % 6].map((v) => v * s), CORNERS[i].map((v) => v * s)];
const POD_WALLS = Array.from({ length: 6 }, (_, k) => Array.from({ length: 6 }, (_, i) => podWall(i, i === (k + 1) % 6 || i === (k + 5) % 6 ? 0.94 : 0.8)));
function podPush(b, dx, dz, radius, a, top) {
  if (b.podTop && top > POD_ROOF) { const p = circleHexPush(dx, dz, radius); if (p) return p; }
  for (let i = 0; i < 6; i++) if (i !== b.pod) { const p = circlePolyPush(dx, dz, radius, POD_WALLS[b.pod][i]); if (p) return p; }
  return null;
}
export function blockPush(id, dx, dz, radius, a = 0, b = 1) {
  const B = BLOCKS[id], k = B?.vslab;
  if (B?.pod !== undefined) return podPush(B, dx, dz, radius, a, b);
  return k === undefined ? circleHexPush(dx, dz, radius) : circlePolyPush(dx, dz, radius, HALF_HEX[k]);
}
export function blockOverlap(id, dx, dz, radius, a = 0, b = 1) {
  const B = BLOCKS[id], k = B?.vslab;
  if (B?.pod !== undefined) return !!podPush(B, dx, dz, radius, a, b);
  return k === undefined ? circleHexOverlap(dx, dz, radius) : !!circlePolyPush(dx, dz, radius, HALF_HEX[k]);
}
// Partie solide du bloc id à la hauteur fy (0..1 dans la case) qui touche le cercle : [bas, haut],
// ou null (les marches et plafonds : voir player.solidAt)
export function solidSpan(id, dx, dz, radius, fy) {
  const B = BLOCKS[id];
  if (B?.pod !== undefined) {
    if (B.podTop && fy >= POD_ROOF && circleHexOverlap(dx, dz, radius)) {
      for (let i = 0; i < 6; i++) if (i !== B.pod && circlePolyPush(dx, dz, radius, POD_WALLS[B.pod][i])) return [0, 1];
      return [POD_ROOF, 1];
    }
    return podPush(B, dx, dz, radius, 0, 0) ? [0, 1] : null;
  }
  let [lo, hi] = blockBox(id);
  if (B?.slope) hi = conveyorTop(B, dx, dz, radius);
  if (fy < lo || fy >= hi || !blockOverlap(id, dx, dz, radius)) return null;
  return [lo, hi];
}
// Haut de la partie solide du bloc sous le cercle (dx, dz, rayon) (un tapis en pente : sa bande)
export function solidTop(id, dx, dz, radius) {
  return BLOCKS[id]?.slope ? conveyorTop(BLOCKS[id], dx, dz, radius) : blockBox(id)[1];
}
// Tapis en pente : la hauteur de la bande sous le cercle (dx, dz, rayon), la plus haute. Elle
// monte de 0 à 1 d'un bord à l'autre de la case (les cases des poulies : à moitié à plat)
function conveyorTop(B, dx, dz, radius) {
  const a = (Math.PI / 3) * B.facing;
  let s = dx * Math.cos(a) + dz * Math.sin(a) + radius;
  if (B.part === 1) s = Math.max(0, s);
  else if (B.part === 2) s = Math.min(0, s);
  return Math.max(0, Math.min(1, 0.5 + s));
}
// Colonne (q, r) entre les hauteurs a et b (getBlock(q, r, y) donne les blocs) : un bloc solide
// touche-t-il le cercle ? Et le décalage pour l'en sortir (le premier qui touche), ou null.
export function columnOverlap(getBlock, q, r, a, b, dx, dz, radius) {
  for (let y = Math.floor(a); y < b; y++) {
    const id = getBlock(q, r, y);
    if (!SOLID[id]) continue;
    const [lo, hi] = blockBox(id);
    if (y + hi > a && y + lo < b && blockOverlap(id, dx, dz, radius, a - y, b - y)) return true;
  }
  return false;
}
export function columnPush(getBlock, q, r, a, b, dx, dz, radius) {
  for (let y = Math.floor(a); y < b; y++) {
    const id = getBlock(q, r, y);
    if (!SOLID[id]) continue;
    const [lo, hi] = blockBox(id);
    if (!(y + hi > a && y + lo < b)) continue;
    const p = blockPush(id, dx, dz, radius, a - y, b - y);
    if (p) return p;
  }
  return null;
}

// Le point (dx, dz depuis le centre de la case, fy hauteur dans la case) est-il dans la partie
// pleine du bloc id ? (dalles : une moitié ; les autres blocs : toute la case)
export function inSolidPart(id, dx, fy, dz) {
  const k = BLOCKS[id]?.vslab;
  if (k !== undefined) return dx * Math.cos((Math.PI / 3) * k) + dz * Math.sin((Math.PI / 3) * k) >= 0;
  const [lo, hi] = blockBox(id);
  return fy >= lo && fy <= hi;
}

// Tables rapides : bloc opaque (cache les faces voisines) et bloc solide (collisions).
// Eau (7, 9..16) et rails : ni opaques, ni solides.
export const OPAQUE = new Uint8Array(MAX_ID);
export const SOLID = new Uint8Array(MAX_ID);
// Dalles : solides mais pas opaques (les faces voisines restent visibles).
// SLAB : 1 = dalle basse, 2 = dalle haute. SUPPORT : un rail ou une torche peut se poser dessus.
export const SLAB = new Uint8Array(MAX_ID);
export const SUPPORT = new Uint8Array(MAX_ID);
for (const [id, b] of Object.entries(BLOCKS)) {
  OPAQUE[id] = b.liquid || b.flow || b.rail || b.track !== undefined || b.prop || b.torch || b.slab || b.glass || b.shape || b.wire || b.sapling || b.lever || b.repeater || b.photo ? 0 : 1;
  SOLID[id] = b.liquid || b.rail || b.track !== undefined || b.torch || b.wire || b.lava || b.sapling || b.lever || b.repeater || b.thin || b.photo ? 0 : 1;
  // (3 : dalle verticale)
  SLAB[id] = b.slab === 'bottom' ? 1 : b.slab === 'top' ? 2 : b.vslab !== undefined ? 3 : 0;
  SUPPORT[id] = (OPAQUE[id] && !b.lava) || b.slab === 'top' ? 1 : 0;
}
// Feuillus (chêne, châtaignier, tilleul, bouleau, naturels et posés) : nus en hiver (voir
// seasons.js), ils laissent voir à travers eux les faces des autres blocs (sol, tronc).
export const DECIDUOUS_LEAVES = [6, LEAVES_PLACED, CHESTNUT_LEAVES, CHESTNUT_LEAVES_PLACED, LINDEN_LEAVES, LINDEN_LEAVES_PLACED, BIRCH_LEAVES, BIRCH_LEAVES_PLACED];
export const BARE = new Uint8Array(MAX_ID);
for (const id of DECIDUOUS_LEAVES) BARE[id] = 1;
// Posés sur un bloc (rails, torches) : disparaissent sans support, emportés par l'eau
export const ATTACHED = new Uint8Array(MAX_ID);
for (const [id, b] of Object.entries(BLOCKS)) ATTACHED[id] = b.rail || b.torch || b.wire || b.sapling || b.lever || b.repeater ? 1 : 0;

// Masse et adhérence des blocs (objets collés, voir structs.js). Un bloc plein est un
// prisme hexagonal de 1 de haut et 1 de large : volume √3/2 ≈ 0.866 m³.
// density : masse volumique réelle (kg/m³, l'eau = 1000 : ce qui est plus léger flotte).
// mass : masse fixe des objets fins (rails, torches). grip : coefficient de frottement.
export const BLOCK_VOLUME = Math.sqrt(3) / 2;
export const WATER_DENSITY = 1000;
const MATTER = {
  1: { density: 1400, grip: 0.65 },   // herbe (terre + racines)
  2: { density: 1500, grip: 0.65 },   // terre
  3: { density: 2600, grip: 0.6 },    // pierre
  4: { density: 3000, grip: 0.6 },    // bedrock
  5: { density: 700, grip: 0.5 },     // bûche de chêne
  6: { density: 150, grip: 0.8 },     // feuilles (beaucoup d'air)
  8: { density: 1600, grip: 0.7 },    // sable
  244: { density: 1700, grip: 0.75 }, // gravier
  245: { density: 7850, grip: 0.4 }, 246: { density: 7850, grip: 0.4 }, 247: { density: 7850, grip: 0.45 }, // acier
  17: { mass: 45, grip: 0.3 },        // rails (acier sur traverses)
  456: { mass: 70, grip: 0.3 }, 473: { mass: 70, grip: 0.3 }, 474: { mass: 70, grip: 0.3 }, // rail de train (tout en acier)
  18: { density: 600, grip: 0.45 },   // planches de chêne
  194: { density: 40, grip: 0.8 }, 195: { density: 40, grip: 0.8 }, // laine : très légère, elle fait flotter (voir structs.water)
  97: { density: 650, grip: 0.5 },    // bûche de châtaignier
  98: { density: 150, grip: 0.8 }, 144: { density: 150, grip: 0.8 }, // feuilles de châtaignier
  99: { density: 560, grip: 0.45 },   // planches de châtaignier
  145: { mass: 0.5, grip: 0.5 },      // pousse de châtaignier
  152: { density: 530, grip: 0.5 },   // bûche de tilleul (bois léger et tendre)
  153: { density: 150, grip: 0.8 }, 155: { density: 150, grip: 0.8 }, // feuilles de tilleul
  154: { density: 450, grip: 0.45 },  // planches de tilleul
  156: { mass: 0.5, grip: 0.5 },      // pousse de tilleul
  19: { mass: 55, grip: 0.3 }, 20: { mass: 55, grip: 0.3 },
  21: { mass: 75, grip: 0.3 }, 22: { mass: 75, grip: 0.3 },
  23: { mass: 0.5, grip: 0.5 }, 24: { mass: 0.5, grip: 0.5 }, 25: { mass: 0.5, grip: 0.5 },
  26: { density: 1650, grip: 0.5 },   // TNT (poudre tassée)
  27: { density: 1700, grip: 0.5 },   // Big TNT
  28: { density: 2400, grip: 0.65 },  // pierre taillée (moellons : un peu d'air entre les pierres)
  29: { density: 2400, grip: 0.7 },   // pierre taillée moussue
  30: { density: 2500, grip: 0.6 },   // minerai de charbon (pierre + veines de charbon, plus léger)
  31: { density: 450, grip: 0.5 },    // table de craft (planches, en partie creuse)
  // dalles : un demi-bloc
  32: { mass: 2400 * BLOCK_VOLUME / 2, grip: 0.65 }, 34: { mass: 2400 * BLOCK_VOLUME / 2, grip: 0.65 },
  33: { mass: 600 * BLOCK_VOLUME / 2, grip: 0.45 }, 35: { mass: 600 * BLOCK_VOLUME / 2, grip: 0.45 },
  40: { density: 2500, grip: 0.4 },   // verre
  41: { density: 1750, grip: 0.5 },   // TNT 200
  60: { density: 3000, grip: 0.6 },   // minerai de fer
  61: { density: 2900, grip: 0.6 },   // minerai de voltite
  62: { density: 7870, grip: 0.4 },   // bloc de fer (fer massif)
  63: { density: 3200, grip: 0.5 },   // bloc de voltite (cristal)
  64: { mass: 0.3, grip: 0.5 }, 65: { mass: 0.3, grip: 0.5 }, // fils
  66: { density: 1800, grip: 0.6 }, 67: { density: 1800, grip: 0.6 }, // bloc physique
  241: { density: 1000, grip: 0.5 }, 242: { density: 1000, grip: 0.5 }, // stabilisateur (volant d'inertie en acier, coque légère)
  198: { density: 600, grip: 0.5 }, 199: { density: 600, grip: 0.5 }, // hélice (moteur léger : bois, un peu de fer)
  68: { density: 2900, grip: 0.65 },  // basalte
  69: { density: 900, grip: 0.7 },    // cendre volcanique (légère, poreuse)
  70: { density: 2000, grip: 0.6 },   // soufre
  71: { density: 1600, grip: 0.65 },  // tuf (roche de cendres tassées)
  72: { density: 2800, grip: 0.2 },   // lave
  73: { density: 2700, grip: 0.6 },   // magma
  74: { density: 2600, grip: 0.5 },   // obsidienne (verre volcanique)
  75: { mass: 0.5, grip: 0.5 },       // pousse
  76: { density: 150, grip: 0.8 }, 77: { density: 150, grip: 0.8 }, // feuilles posées
  78: { density: 1800, grip: 0.5 },   // TNT 1000
  79: { mass: 0.6, grip: 0.6 }, 80: { mass: 0.6, grip: 0.6 }, // levier
  ...Object.fromEntries(Array.from({ length: 16 }, (_, k) => [4099 + k, { mass: 0.9, grip: 0.6 }])), // levier analogique
  4121: { density: 1100, grip: 1 }, // roue (caoutchouc sur une jante d'acier : elle accroche)
  ...Object.fromEntries(Array.from({ length: 6 }, (_, k) => [4122 + k, { density: 450, grip: 0.5 }])), // volant (siège)
  ...Object.fromEntries(Array.from({ length: 6 }, (_, k) => [4128 + k, { density: 2400, grip: 0.5 }])), // pilote de route
  81: { density: 3000, grip: 0.5 },   // gravitron (fer, voltite, écran)
  82: { density: 2500, grip: 0.5 },   // bloc de structure
  94: { density: 2200, grip: 0.4 }, 95: { density: 2200, grip: 0.4 }, // lampe (verre et voltite)
  96: { mass: 0.5, grip: 0.5 },       // pousse de grand chêne
  ...Object.fromEntries(Array.from({ length: 24 }, (_, i) => [210 + i, { mass: 1.5, grip: 0.6 }])), // répéteurs (plaque de pierre)
  83: { density: 3200, grip: 0.6 },   // minerai de platine
  84: { density: 21450, grip: 0.35 }, // bloc de platine (le plus lourd)
  85: { density: 3400, grip: 0.6 },   // minerai de tungstène
  86: { density: 19250, grip: 0.4 },  // bloc de tungstène
  640: { density: 3200, grip: 0.6 },  // minerai de fluorite
  641: { density: 3180, grip: 0.5 },  // bloc de fluorite
  642: { density: 3600, grip: 0.6 },  // minerai de cramoisite
  643: { density: 15000, grip: 0.4 }, // bloc de cramoisite
  87: { density: 2800, grip: 0.6 },   // minerai de voltite impure
  88: { mass: 0.3, grip: 0.5 }, 89: { mass: 0.3, grip: 0.5 }, // fils de voltite impure
  256: { density: 640, grip: 0.5 },   // bûche de bouleau
  257: { density: 150, grip: 0.8 }, 259: { density: 150, grip: 0.8 }, // feuilles de bouleau
  258: { density: 550, grip: 0.45 },  // planches de bouleau
  260: { mass: 0.5, grip: 0.5 },      // pousse de bouleau
  261: { density: 2800, grip: 0.6 }, 262: { density: 2800, grip: 0.5 }, 263: { density: 2600, grip: 0.6 }, // diorite
  264: { density: 7800, grip: 0.4 }, 265: { density: 8000, grip: 0.4 }, 266: { density: 7600, grip: 0.5 }, // fer industriel
  279: { density: 2200, grip: 0.6 }, 280: { density: 2200, grip: 0.6 }, 282: { density: 2200, grip: 0.6 }, 283: { density: 2200, grip: 0.6 }, // pistons
  281: { mass: 300, grip: 0.5 }, 284: { mass: 300, grip: 0.5 }, // têtes de piston
  285: { density: 1400, grip: 0.65 }, 455: { density: 1500, grip: 0.65 }, // terre labourée
};
for (let k = 0; k < 6; k++) {
  MATTER[COMPUTER + k] = { density: 500, grip: 0.5 }; // ordinateur (boîtier creux)
  MATTER[SERVER + k] = { density: 900, grip: 0.5 };   // serveur (baie pleine de disques)
}
for (let id = WHEAT_CROP; id <= WHEAT_RIPE; id++) MATTER[id] = { mass: 0.3, grip: 0.5 }; // blé
for (let id = POTATO_CROP; id <= POTATO_RIPE; id++) MATTER[id] = { mass: 0.3, grip: 0.5 }; // pommes de terre
for (let id = POD; id < POD_TOP + 6; id++) MATTER[id] = { mass: 6, grip: 0.6 }; // lit de villageois
for (let id = STATION; id < STATION + 6; id++) MATTER[id] = { density: 1600, grip: 0.6 }; // gare (briques, creuse)
for (let k = 0; k < 6; k++) { MATTER[BUFFER_STOP + k] = { mass: 300, grip: 0.5 }; MATTER[SPEED_SIGN + k] = { mass: 30, grip: 0.5 }; MATTER[RAIL_SIGNAL + k] = { mass: 40, grip: 0.5 }; }
MATTER[HULL] = { density: 4500, grip: 0.4 }; MATTER[CONSOLE] = { density: 1500, grip: 0.5 }; MATTER[NEDROLYTIUM] = { density: 9000, grip: 0.4 };
MATTER[REACTOR] = { density: 3000, grip: 0.5 }; MATTER[NOZZLE] = { density: 2500, grip: 0.5 }; MATTER[ROCKET_TANK] = { density: 500, grip: 0.5 };
MATTER[ROCKET_TANK_ADV] = { density: 800, grip: 0.5 }; MATTER[ENGINE] = { density: 2800, grip: 0.5 };
// (lot liquides : moteurs, réservoirs ; le flotteur, très léger, porte un bateau)
MATTER[CHEM_ENGINE] = { density: 2600, grip: 0.5 }; MATTER[ION_THRUSTER] = { density: 1500, grip: 0.5 }; MATTER[PLASMA_ENGINE] = { density: 3200, grip: 0.5 };
MATTER[STELLAR_NOZZLE] = { density: 4000, grip: 0.5 }; MATTER[FLOATER] = { density: 60, grip: 0.5 };
MATTER[TANK_CU] = { density: 700, grip: 0.5 };
for (let id = 4244; id <= 4255; id++) MATTER[id] = { density: 2200, grip: 0.6 }; // (portes : acier)
for (let id = 4257; id <= 4268; id++) MATTER[id] = { density: 2600, grip: 0.6 }; // (mécanique)
for (let id = 4284; id <= 4296; id++) MATTER[id] = { density: 3000, grip: 0.6 }; // (armes, boucliers : acier épais)
MATTER[GUSTAVE] = { density: 7000, grip: 0.6 }; MATTER[AMMO_BOX] = { density: 1500, grip: 0.6 };
MATTER[LANDING_GEAR] = { mass: 300, grip: 1.2 }; MATTER[TANK_HD] = { density: 1100, grip: 0.5 }; MATTER[PIPE_HD] = { mass: 20, grip: 0.5 };
for (const id of [STATION_CORE, OXYGEN_GEN, GRAVITY_GEN, DOCK_PORT, CARGO_LAUNCHER, FLIGHT_COMPUTER, DRONE_BAY, ORBITAL_STORE]) MATTER[id] = { density: 1200, grip: 0.5 };
// nouveaux minerais (dans la roche : un peu plus lourds que la pierre) et leurs blocs (le métal)
{
  const DENS = { cuivre: 8900, aluminium: 2700, quartz: 2650, silicium: 2330, magnetite: 5200, plomb: 11300, gallium: 5900, titane: 4500, iridium: 22500, uranite: 19000, gravitite: 900, diamant: 3500 };
  for (const m of METALS) { MATTER[m.ore] = { density: 3000, grip: 0.6 }; MATTER[m.block] = { density: DENS[m.key], grip: 0.5 }; }
  MATTER[REINFORCED_CONCRETE] = { density: 2500, grip: 0.7 };
  MATTER[CERAMIC] = { density: 2300, grip: 0.55 };
  MATTER[REINFORCED_GLASS] = { density: 2600, grip: 0.4 };
}
// blocs des nouveaux biomes (voir biomes.js), selon leur matière
{
  const D = { dirt: { density: 1500, grip: 0.7 }, stone: { density: 2600, grip: 0.6 }, hard: { density: 3200, grip: 0.6 }, wood: { density: 600, grip: 0.5 }, leaves: { density: 150, grip: 0.8 } };
  for (const [id, , , m] of ENV_BLOCKS) MATTER[id] = D[m];
}
MATTER[SOLAR_PANEL] = { density: 500, grip: 0.5 };
MATTER[COCKPIT] = { density: 900, grip: 0.5 }; MATTER[PASSENGER_SEAT] = { density: 500, grip: 0.5 }; MATTER[LANDING_LEG] = { mass: 250, grip: 0.9 };
MATTER[PIPE] = { mass: 40, grip: 0.5 }; MATTER[TANK] = { density: 900, grip: 0.5 }; MATTER[FUEL_BLOCK] = { density: 1100, grip: 0.5 };
MATTER[DETECTOR] = MATTER[DETECTOR_ON] = { mass: 60, grip: 0.5 };
for (let k = 0; k < 6; k++) {
  MATTER[42 + k] = MATTER[48 + k] = { density: 2200, grip: 0.6 }; // four (pierre, creux)
  MATTER[54 + k] = { density: 350, grip: 0.5 };                    // coffre (planches, creux)
}
export const blockMass = (id) => {
  const m = MATTER[id];
  if (!m) return 1000 * BLOCK_VOLUME;
  return m.mass ?? m.density * BLOCK_VOLUME;
};
export const blockGrip = (id) => MATTER[id]?.grip ?? 0.6;
// dalles : la moitié de leur matière ; deux dalles : leurs deux moitiés
for (const [id, b] of Object.entries(BLOCKS)) {
  if (b.slabMat === undefined || MATTER[id]) continue;
  const half = (p) => blockMass(SLAB_MATS[BLOCKS[p].slabMat].full) / 2;
  MATTER[id] = { mass: b.dslab ? half(b.dslab[0]) + half(b.dslab[1]) : half(id), grip: blockGrip(SLAB_MATS[b.slabMat].full) };
}

// Fil de voltite vers la case voisine (dq, dr) : à la même hauteur (0), en montant sur le
// bloc d'à côté (+1) ou en descendant de son bord (-1), comme la redstone ; null sinon.
// at(dq, dr, dy) donne le bloc relatif au fil, id est le fil lui-même.
export function wireStep(at, id, dq, dr) {
  const kind = wireKind(id), same = (n) => wireKind(n) === kind;
  const side = at(dq, dr, 0);
  if (same(side)) return 0;
  if (OPAQUE[side]) return !OPAQUE[at(0, 0, 1)] && same(at(dq, dr, 1)) ? 1 : null;
  return same(at(dq, dr, -1)) ? -1 : null;
}
