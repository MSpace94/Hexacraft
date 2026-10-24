// Mode survie (début) : 12 cœurs, inventaire avec quantités, artisanat (grille 2x2 dans
// l'inventaire, 3x3 sur la table de craft), temps de minage selon l'outil tenu et objets
// récupérés en cassant les blocs.
import {
  BLOCKS, ITEMS, STICK, COAL, isWater,
  WOODEN_PICKAXE, WOODEN_AXE, WOODEN_SHOVEL, WOODEN_SWORD, WOODEN_HOE,
  PEBBLE, RUSTIC_PICKAXE, RUSTIC_AXE, RUSTIC_SHOVEL, RUSTIC_SWORD, RUSTIC_HOE,
  STONE_PICKAXE, STONE_AXE, STONE_SHOVEL, STONE_SWORD, STONE_HOE,
  SNOW_GRASS, SNOW, CACTUS, SNOWBALL, SNOW_LEAVES, GLASS, TNT_200, TNT_1000, FURNACE, CHEST,
  IRON_ORE, VOLTITE_ORE, IRON_BLOCK, VOLTITE_BLOCK, WIRE, WIRE_ON, PHYSICS, PHYSICS_ON,
  STABILIZER, STABILIZER_ON, TARGET, GRAVEL, STEEL, DARK_STEEL, OLD_STEEL, GLUE, DOUBLE_GLUE, ROPE, WOOL_WHITE, WOOL_GREY, PROPELLER, PROPELLER_ON, GRAVITY_HAND, IRON_INGOT, VOLTITE, WRENCH, IRON_PICKAXE, IRON_AXE, IRON_SHOVEL, IRON_SWORD, IRON_HOE,
  BASALT, ASH, SULFUR, TUFF, LAVA, MAGMA, OBSIDIAN, SAPLING, LEAVES_PLACED, SNOW_LEAVES_PLACED,
  CHESTNUT_LOG, CHESTNUT_LEAVES, CHESTNUT_PLANKS, CHESTNUT_LEAVES_PLACED, CHESTNUT_SAPLING,
  CHESTNUT_STICK, CHESTNUT_PICKAXE, CHESTNUT_AXE, CHESTNUT_SHOVEL, CHESTNUT_SWORD, CHESTNUT_HOE,
  LINDEN_LOG, LINDEN_LEAVES, LINDEN_PLANKS, LINDEN_LEAVES_PLACED, LINDEN_SAPLING,
  LINDEN_STICK, LINDEN_PICKAXE, LINDEN_AXE, LINDEN_SHOVEL, LINDEN_SWORD, LINDEN_HOE,
  PLATINUM_ORE, PLATINUM_BLOCK, TUNGSTEN_ORE, TUNGSTEN_BLOCK, IMPURE_VOLTITE_ORE, IWIRE, IWIRE_ON,
  PLATINUM_INGOT, TUNGSTEN_INGOT, IMPURE_VOLTITE, PLATINUM_STICK,
  PLATINUM_PICKAXE, PLATINUM_AXE, PLATINUM_SHOVEL, PLATINUM_SWORD, PLATINUM_HOE,
  TUNGSTEN_PICKAXE, TUNGSTEN_AXE, TUNGSTEN_SHOVEL, TUNGSTEN_SWORD, TUNGSTEN_HOE, durability, makeSlot,
  FLUORITE_ORE, FLUORITE_BLOCK, CRIMSONITE_ORE, CRIMSONITE_BLOCK, FLUORITE_INGOT, CRIMSONITE_INGOT,
  FLUORITE_PICKAXE, FLUORITE_AXE, FLUORITE_SHOVEL, FLUORITE_SWORD, FLUORITE_HOE,
  CRIMSONITE_PICKAXE, CRIMSONITE_AXE, CRIMSONITE_SHOVEL, CRIMSONITE_SWORD, CRIMSONITE_HOE,
  BIRCH_LOG, BIRCH_LEAVES, BIRCH_PLANKS, BIRCH_LEAVES_PLACED, BIRCH_SAPLING,
  BIRCH_STICK, BIRCH_PICKAXE, BIRCH_AXE, BIRCH_SHOVEL, BIRCH_SWORD, BIRCH_HOE,
  DIORITE, POLISHED_DIORITE, DIORITE_BRICKS, DIORITE_PICKAXE, DIORITE_AXE, DIORITE_SHOVEL, DIORITE_SWORD, DIORITE_HOE,
  INDUSTRIAL_IRON, INDUSTRIAL_IRON_COPPER, INDUSTRIAL_IRON_RUSTY, PISTON, isPistonHead,
  CHISEL, FILE, SLEDGEHAMMER, QUENCH_BUCKET, FORGE_COAL, HOT_INGOT, CIRCUIT, COMPUTER, SERVER, SLAB_MATS, vslabId,
  FARMLAND, WHEAT_CROP, WHEAT_RIPE, isCrop, SEEDS, WHEAT, BREAD, POTATO_CROP, POTATO_RIPE, POTATO, DECOR
} from './blocks.js?v=1.1.5-alpha-mvm2b95g';
import { SMELT, FUEL, COOK_TIME } from './containers.js?v=1.1.5-alpha-mvm2b95g';
import { DEPTH } from './gen.js?v=1.1.5-alpha-mvm2b95g';

export const MAX_HEALTH = 24;  // 12 cœurs (un cœur = 2 points de vie)
// Faim : 12 icônes (une = 2 points), comme la vie. Elle baisse avec le temps (plus vite en
// courant), et en se soignant tout seul. Trop basse : on court moins vite (HUNGER_SLOW), puis
// plus du tout (HUNGER_WALK) ; sous HUNGER_GREY (1,5 icône), la vue perd peu à peu ses couleurs.
export const MAX_HUNGER = 24;
const HUNGER_SLOW = 8, HUNGER_WALK = 4, HUNGER_GREY = 3, HUNGER_REGEN = 12;
const DRAIN_IDLE = 1 / 50, DRAIN_WALK = 1 / 35, DRAIN_SPRINT = 1 / 10, DRAIN_REGEN = 0.6; // (points par seconde ; par point de vie rendu)
export const HOTBAR_SLOTS = 10;
export const INV_SIZE = 40;    // 10 dans la barre + 30 dans le sac
const AIR_TIME = 15;           // secondes sous l'eau avant de se noyer
const HARDCORE_HURT = 1.5;     // mode hardcore : dégâts multipliés
export const stackMax = (id) => ITEMS[id]?.stack ?? 64;

// ---------- Recettes ----------
// Motif (lignes, '.' = case vide), clés -> id, résultat [id, quantité]. Le motif peut être
// placé n'importe où dans la grille, et retourné de gauche à droite.
const LOG = 5, LEAVES = 6, SAND = 8, PLANKS = 18, TORCH = 23, TNT = 26, BIG_TNT = 27;
const COBBLE = 28, MOSSY = 29, TABLE = 31, COBBLE_SLAB = 32, OAK_SLAB = 33;
export const RECIPES = [
  { p: ['L'], k: { L: LOG }, out: [PLANKS, 4] },
  { p: ['P', 'P'], k: { P: PLANKS }, out: [STICK, 4] },
  { p: ['PP', 'PP'], k: { P: PLANKS }, out: [TABLE, 1] },
  { p: ['K', 'S'], k: { K: COAL, S: STICK }, out: [TORCH, 4] },
  { p: ['S', 'C'], k: { S: STICK, C: COBBLE }, out: [79, 1] }, // levier
  { p: ['CCC'], k: { C: COBBLE }, out: [COBBLE_SLAB, 6] },
  { p: ['PPP'], k: { P: PLANKS }, out: [OAK_SLAB, 6] },
  { p: ['CL'], k: { C: COBBLE, L: LEAVES }, out: [MOSSY, 1] },
  { p: ['PPP', '.S.', '.S.'], k: { P: PLANKS, S: STICK }, out: [WOODEN_PICKAXE, 1] },
  { p: ['PP', 'PS', '.S'], k: { P: PLANKS, S: STICK }, out: [WOODEN_AXE, 1] },
  { p: ['P', 'S', 'S'], k: { P: PLANKS, S: STICK }, out: [WOODEN_SHOVEL, 1] },
  { p: ['P', 'P', 'S'], k: { P: PLANKS, S: STICK }, out: [WOODEN_SWORD, 1] },
  { p: ['PP', '.S', '.S'], k: { P: PLANKS, S: STICK }, out: [WOODEN_HOE, 1] },
  // outils rustiques : les mêmes formes, avec des cailloux
  { p: ['CCC', '.S.', '.S.'], k: { C: PEBBLE, S: STICK }, out: [RUSTIC_PICKAXE, 1] },
  { p: ['CC', 'CS', '.S'], k: { C: PEBBLE, S: STICK }, out: [RUSTIC_AXE, 1] },
  { p: ['C', 'S', 'S'], k: { C: PEBBLE, S: STICK }, out: [RUSTIC_SHOVEL, 1] },
  { p: ['C', 'C', 'S'], k: { C: PEBBLE, S: STICK }, out: [RUSTIC_SWORD, 1] },
  { p: ['CC', '.S', '.S'], k: { C: PEBBLE, S: STICK }, out: [RUSTIC_HOE, 1] },
  // outils en pierre : les mêmes formes, avec de la pierre taillée
  { p: ['CCC', '.S.', '.S.'], k: { C: COBBLE, S: STICK }, out: [STONE_PICKAXE, 1] },
  { p: ['CC', 'CS', '.S'], k: { C: COBBLE, S: STICK }, out: [STONE_AXE, 1] },
  { p: ['C', 'S', 'S'], k: { C: COBBLE, S: STICK }, out: [STONE_SHOVEL, 1] },
  { p: ['C', 'C', 'S'], k: { C: COBBLE, S: STICK }, out: [STONE_SWORD, 1] },
  { p: ['CC', '.S', '.S'], k: { C: COBBLE, S: STICK }, out: [STONE_HOE, 1] },
  { p: ['SKS', 'KSK', 'SKS'], k: { S: SAND, K: COAL }, out: [TNT, 1] },
  { p: ['TTT', 'TTT', 'TTT'], k: { T: TNT }, out: [BIG_TNT, 1] },
  { p: ['BBB', 'BBB', 'BBB'], k: { B: BIG_TNT }, out: [TNT_200, 1] },
  { p: ['.B.', 'BBB', '.B.'], k: { B: TNT_200 }, out: [TNT_1000, 1] },
  // outils en fer : les mêmes formes, avec des lingots
  { p: ['III', '.S.', '.S.'], k: { I: IRON_INGOT, S: STICK }, out: [IRON_PICKAXE, 1] },
  { p: ['II', 'IS', '.S'], k: { I: IRON_INGOT, S: STICK }, out: [IRON_AXE, 1] },
  { p: ['I', 'S', 'S'], k: { I: IRON_INGOT, S: STICK }, out: [IRON_SHOVEL, 1] },
  { p: ['I', 'I', 'S'], k: { I: IRON_INGOT, S: STICK }, out: [IRON_SWORD, 1] },
  { p: ['II', '.S', '.S'], k: { I: IRON_INGOT, S: STICK }, out: [IRON_HOE, 1] },
  // tige de platine (le manche des outils en platine et en tungstène)
  { p: ['P', 'P'], k: { P: PLATINUM_INGOT }, out: [PLATINUM_STICK, 4] },
  // outils en platine et en tungstène : les mêmes formes, avec des tiges de platine
  { p: ['III', '.S.', '.S.'], k: { I: PLATINUM_INGOT, S: PLATINUM_STICK }, out: [PLATINUM_PICKAXE, 1] },
  { p: ['II', 'IS', '.S'], k: { I: PLATINUM_INGOT, S: PLATINUM_STICK }, out: [PLATINUM_AXE, 1] },
  { p: ['I', 'S', 'S'], k: { I: PLATINUM_INGOT, S: PLATINUM_STICK }, out: [PLATINUM_SHOVEL, 1] },
  { p: ['I', 'I', 'S'], k: { I: PLATINUM_INGOT, S: PLATINUM_STICK }, out: [PLATINUM_SWORD, 1] },
  { p: ['II', '.S', '.S'], k: { I: PLATINUM_INGOT, S: PLATINUM_STICK }, out: [PLATINUM_HOE, 1] },
  { p: ['III', '.S.', '.S.'], k: { I: TUNGSTEN_INGOT, S: PLATINUM_STICK }, out: [TUNGSTEN_PICKAXE, 1] },
  { p: ['II', 'IS', '.S'], k: { I: TUNGSTEN_INGOT, S: PLATINUM_STICK }, out: [TUNGSTEN_AXE, 1] },
  { p: ['I', 'S', 'S'], k: { I: TUNGSTEN_INGOT, S: PLATINUM_STICK }, out: [TUNGSTEN_SHOVEL, 1] },
  { p: ['I', 'I', 'S'], k: { I: TUNGSTEN_INGOT, S: PLATINUM_STICK }, out: [TUNGSTEN_SWORD, 1] },
  { p: ['II', '.S', '.S'], k: { I: TUNGSTEN_INGOT, S: PLATINUM_STICK }, out: [TUNGSTEN_HOE, 1] },
  { p: ['III', '.S.', '.S.'], k: { I: FLUORITE_INGOT, S: STICK }, out: [FLUORITE_PICKAXE, 1] },
  { p: ['II', 'IS', '.S'], k: { I: FLUORITE_INGOT, S: STICK }, out: [FLUORITE_AXE, 1] },
  { p: ['I', 'S', 'S'], k: { I: FLUORITE_INGOT, S: STICK }, out: [FLUORITE_SHOVEL, 1] },
  { p: ['I', 'I', 'S'], k: { I: FLUORITE_INGOT, S: STICK }, out: [FLUORITE_SWORD, 1] },
  { p: ['II', '.S', '.S'], k: { I: FLUORITE_INGOT, S: STICK }, out: [FLUORITE_HOE, 1] },
  { p: ['III', '.S.', '.S.'], k: { I: CRIMSONITE_INGOT, S: PLATINUM_STICK }, out: [CRIMSONITE_PICKAXE, 1] },
  { p: ['II', 'IS', '.S'], k: { I: CRIMSONITE_INGOT, S: PLATINUM_STICK }, out: [CRIMSONITE_AXE, 1] },
  { p: ['I', 'S', 'S'], k: { I: CRIMSONITE_INGOT, S: PLATINUM_STICK }, out: [CRIMSONITE_SHOVEL, 1] },
  { p: ['I', 'I', 'S'], k: { I: CRIMSONITE_INGOT, S: PLATINUM_STICK }, out: [CRIMSONITE_SWORD, 1] },
  { p: ['II', '.S', '.S'], k: { I: CRIMSONITE_INGOT, S: PLATINUM_STICK }, out: [CRIMSONITE_HOE, 1] },
  { p: ['III', 'III', 'III'], k: { I: FLUORITE_INGOT }, out: [FLUORITE_BLOCK, 1] },
  { p: ['B'], k: { B: FLUORITE_BLOCK }, out: [FLUORITE_INGOT, 9] },
  { p: ['III', 'III', 'III'], k: { I: CRIMSONITE_INGOT }, out: [CRIMSONITE_BLOCK, 1] },
  { p: ['B'], k: { B: CRIMSONITE_BLOCK }, out: [CRIMSONITE_INGOT, 9] },
  { p: ['III', 'III', 'III'], k: { I: PLATINUM_INGOT }, out: [PLATINUM_BLOCK, 1] },
  { p: ['B'], k: { B: PLATINUM_BLOCK }, out: [PLATINUM_INGOT, 9] },
  { p: ['III', 'III', 'III'], k: { I: TUNGSTEN_INGOT }, out: [TUNGSTEN_BLOCK, 1] },
  { p: ['B'], k: { B: TUNGSTEN_BLOCK }, out: [TUNGSTEN_INGOT, 9] },
  // blocs de fer et de voltite (9 objets), et l'inverse
  { p: ['III', 'III', 'III'], k: { I: IRON_INGOT }, out: [IRON_BLOCK, 1] },
  { p: ['B'], k: { B: IRON_BLOCK }, out: [IRON_INGOT, 9] },
  { p: ['VVV', 'VVV', 'VVV'], k: { V: VOLTITE }, out: [VOLTITE_BLOCK, 1] },
  { p: ['B'], k: { B: VOLTITE_BLOCK }, out: [VOLTITE, 9] },
  // torche d'énergie : de la voltite au bout d'un bâton
  { p: ['V', 'S'], k: { V: VOLTITE, S: STICK }, out: [24, 1] },
  // clé à molette (en Y) et bloc physique (coins en fer, planches, cœur de voltite)
  { p: ['I.I', '.I.', '.I.'], k: { I: IRON_INGOT }, out: [WRENCH, 1] },
  { p: ['IPI', 'PVP', 'IPI'], k: { I: IRON_INGOT, P: PLANKS, V: VOLTITE }, out: [PHYSICS, 1] },
  // gravitron : écran de verre, voltite, bloc physique, coque de fer
  { p: ['IGI', 'VPV', 'III'], k: { I: IRON_INGOT, G: GLASS, V: VOLTITE, P: PHYSICS }, out: [81, 1] },
  // super colle (du sable autour d'une boule de neige) et main gravitationnelle (un bloc de
  // voltite entouré de fer : chère, elle déplace n'importe quel objet collé)
  { p: ['.S.', 'SBS', '.S.'], k: { S: SAND, B: SNOWBALL }, out: [GLUE, 4] },
  // double colle (deux super colles) et hélice (pales de planches, axe de fer, cœur de voltite)
  { p: ['GG'], k: { G: GLUE }, out: [DOUBLE_GLUE, 1] },
  // corde : de la laine tressée (blanche ou grise)
  { p: ['L', 'L', 'L'], k: { L: WOOL_WHITE }, out: [ROPE, 4] },
  { p: ['L', 'L', 'L'], k: { L: WOOL_GREY }, out: [ROPE, 4] },
  { p: ['PIP', '.V.'], k: { P: PLANKS, I: IRON_INGOT, V: VOLTITE }, out: [PROPELLER, 1] },
  // stabilisateur : un bloc de fer (le volant d'inertie) entouré de voltite et de fer
  { p: ['IVI', 'VBV', 'IVI'], k: { I: IRON_INGOT, V: VOLTITE, B: IRON_BLOCK }, out: [STABILIZER, 1] },
  { p: ['III', 'IVI', 'III'], k: { I: IRON_INGOT, V: VOLTITE_BLOCK }, out: [GRAVITY_HAND, 1] },
  // acier : un lingot de fer et du charbon dans de la pierre taillée ; assombri au charbon ;
  // vieilli au gravier (rouillé, rayé)
  { p: ['.C.', 'KIK', '.C.'], k: { C: 28, K: COAL, I: IRON_INGOT }, out: [STEEL, 4] },
  { p: ['SSS', 'SKS', 'SSS'], k: { S: STEEL, K: COAL }, out: [DARK_STEEL, 8] },
  { p: ['SG', 'GS'], k: { S: STEEL, G: GRAVEL }, out: [OLD_STEEL, 4] },
  // gravier : de la pierre taillée concassée
  { p: ['CC', 'CC'], k: { C: 28 }, out: [GRAVEL, 4] },
  // bloc cible : de la laine blanche autour d'un cœur de voltite (rouge)
  { p: ['.W.', 'WVW', '.W.'], k: { W: WOOL_WHITE, V: VOLTITE }, out: [TARGET, 1] },
  // lampe de voltite : du verre entouré de voltite (ou de voltite impure)
  { p: ['.V.', 'VGV', '.V.'], k: { V: VOLTITE, G: GLASS }, out: [94, 1] },
  { p: ['.V.', 'VGV', '.V.'], k: { V: IMPURE_VOLTITE, G: GLASS }, out: [94, 1] },
  // répéteurs : deux torches d'énergie et la voltite (ou la voltite impure) sur de la pierre
  { p: ['TVT', 'SSS'], k: { T: 24, V: VOLTITE, S: 3 }, out: [210, 1] },
  { p: ['TVT', 'SSS'], k: { T: 24, V: IMPURE_VOLTITE, S: 3 }, out: [222, 1] },
  // inverseurs : une torche d'énergie sur un répéteur
  { p: ['T', 'R'], k: { T: 24, R: 210 }, out: [170, 1] },
  { p: ['T', 'R'], k: { T: 24, R: 222 }, out: [182, 1] },
  // pousse de grand chêne : 4 pousses de chêne
  { p: ['SS', 'SS'], k: { S: SAPLING }, out: [96, 1] },
  // four (pierre taillée) et coffre (planches) : un anneau autour d'une case vide
  { p: ['CCC', 'C.C', 'CCC'], k: { C: COBBLE }, out: [FURNACE, 1] },
  { p: ['PPP', 'P.P', 'PPP'], k: { P: PLANKS }, out: [CHEST, 1] },
  // lit de villageois : planches dehors, laine dedans
  { p: ['PWP', 'PWP', 'PPP'], k: { P: PLANKS, W: WOOL_WHITE }, out: [443, 1] },
  { p: ['BB', 'BB'], k: { B: SNOWBALL }, out: [SNOW, 1] },
  // châtaignier, tilleul : la bûche donne des planches
  { p: ['L'], k: { L: CHESTNUT_LOG }, out: [CHESTNUT_PLANKS, 4] },
  { p: ['L'], k: { L: LINDEN_LOG }, out: [LINDEN_PLANKS, 4] },
  { p: ['L'], k: { L: BIRCH_LOG }, out: [BIRCH_PLANKS, 4] },
  // pain : 3 blés en ligne
  { p: ['WWW'], k: { W: WHEAT }, out: [BREAD, 1] },
  // diorite : polie (4 blocs, ou à la lime), en briques (4 polies, ou au burin) ; outils
  // en diorite (les mêmes formes que ceux en pierre)
  { p: ['DD', 'DD'], k: { D: DIORITE }, out: [POLISHED_DIORITE, 4] },
  { p: ['DD', 'DD'], k: { D: POLISHED_DIORITE }, out: [DIORITE_BRICKS, 4] },
  { p: ['L', 'D'], k: { L: FILE, D: DIORITE }, out: [POLISHED_DIORITE, 1] },
  { p: ['C', 'D'], k: { C: CHISEL, D: POLISHED_DIORITE }, out: [DIORITE_BRICKS, 1] },
  { p: ['CCC', '.S.', '.S.'], k: { C: DIORITE, S: STICK }, out: [DIORITE_PICKAXE, 1] },
  { p: ['CC', 'CS', '.S'], k: { C: DIORITE, S: STICK }, out: [DIORITE_AXE, 1] },
  { p: ['C', 'S', 'S'], k: { C: DIORITE, S: STICK }, out: [DIORITE_SHOVEL, 1] },
  { p: ['C', 'C', 'S'], k: { C: DIORITE, S: STICK }, out: [DIORITE_SWORD, 1] },
  { p: ['CC', '.S', '.S'], k: { C: DIORITE, S: STICK }, out: [DIORITE_HOE, 1] },
  // forge : outils du forgeron (ils restent dans la grille quand on s'en sert : voir keep),
  // charbon de forge (4 charbons tassés, brûle plus longtemps)
  { p: ['I', 'S'], k: { I: IRON_INGOT, S: STICK }, out: [CHISEL, 1] },
  { p: ['I', 'I'], k: { I: IRON_INGOT }, out: [FILE, 1] },
  { p: ['B', 'S', 'S'], k: { B: IRON_BLOCK, S: STICK }, out: [SLEDGEHAMMER, 1] },
  { p: ['I.I', '.I.'], k: { I: IRON_INGOT }, out: [QUENCH_BUCKET, 1] },
  { p: ['KK', 'KK'], k: { K: COAL }, out: [FORGE_COAL, 1] },
  // fer industriel : le lingot chaud (lingot de fer repassé au four) martelé ; cuivré à la
  // voltite et poli à la lime ; rouillé dans le seau de trempe
  { p: ['M', 'H'], k: { M: SLEDGEHAMMER, H: HOT_INGOT }, out: [INDUSTRIAL_IRON, 2] },
  { p: ['LV', '.F'], k: { L: FILE, V: VOLTITE, F: INDUSTRIAL_IRON }, out: [INDUSTRIAL_IRON_COPPER, 1] },
  { p: ['B', 'F'], k: { B: QUENCH_BUCKET, F: INDUSTRIAL_IRON }, out: [INDUSTRIAL_IRON_RUSTY, 1] },
  // piston : planches, pierre taillée, un lingot de fer (la tige) et de la voltite (le moteur)
  { p: ['PPP', 'CIC', 'CVC'], k: { P: PLANKS, C: COBBLE, I: IRON_INGOT, V: VOLTITE }, out: [PISTON, 1] },
  // électronique : circuit intégré (voltite sur du fer), ordinateur (écran de verre),
  // serveur (une baie de circuits)
  { p: ['IVI'], k: { I: IRON_INGOT, V: VOLTITE }, out: [CIRCUIT, 2] },
  { p: ['IGI', 'ICI', 'IVI'], k: { I: IRON_INGOT, G: GLASS, C: CIRCUIT, V: VOLTITE }, out: [COMPUTER, 1] },
  { p: ['ICI', 'ICI', 'ICI'], k: { I: IRON_INGOT, C: CIRCUIT }, out: [SERVER, 1] },
  // le train (voir trains.js) : rails de train, pièces, puis la locomotive et le wagon
  { p: ['S.S', 'SDS', 'S.S'], k: { S: STEEL, D: DARK_STEEL }, out: [456, 16] },
  { p: ['I', 'I', 'I'], k: { I: IRON_INGOT }, out: [459, 2] },                          // essieu
  { p: ['E.E', 'SSS'], k: { E: 459, S: STEEL }, out: [460, 1] },                       // bogie
  { p: ['DDD'], k: { D: DARK_STEEL }, out: [461, 2] },                                 // longeron
  { p: ['SS', 'SS'], k: { S: STEEL }, out: [462, 4] },                                 // plaque d'acier
  { p: ['P', 'T'], k: { P: 462, T: PLATINUM_INGOT }, out: [463, 2] },                  // plaque de coque
  { p: ['PPP'], k: { P: 462 }, out: [464, 2] },                                        // plaque de toit
  { p: ['PK'], k: { P: 462, K: COAL }, out: [465, 1] },                                // plaque de danger
  { p: ['PI'], k: { P: 462, I: IRON_INGOT }, out: [466, 2] },                          // panneau de métal
  { p: ['GG'], k: { G: GLASS }, out: [467, 2] },                                       // vitre de cabine
  { p: ['G', 'T'], k: { G: GLASS, T: TORCH }, out: [468, 2] },                         // voyant
  { p: ['.I.', 'ISI', '.I.'], k: { I: IRON_INGOT, S: STICK }, out: [469, 1] },         // ventilateur
  { p: ['II', 'II'], k: { I: IRON_INGOT }, out: [470, 1] },                            // calandre
  { p: ['HHH'], k: { H: 465 }, out: [471, 1] },                                        // pare-chocs
  { p: ['VVV', 'C.C', 'CCC'], k: { V: 467, C: 463 }, out: [472, 1] },                  // cabine
  { p: ['TFK', 'CAG', 'BLB'], k: { T: 464, F: 469, K: 471, C: 463, A: 472, G: 470, B: 460, L: 461 }, out: [457, 1] }, // locomotive
  { p: ['TTT', 'PVP', 'BLB'], k: { T: 464, P: 466, V: 468, B: 460, L: 461 }, out: [458, 1] }, // wagon
  // le wagon plat et ses pièces
  { p: ['SSS', '.S.', 'SSS'], k: { S: STEEL }, out: [483, 2] },                       // poutre en I
  { p: ['PPP', 'III'], k: { P: PLANKS, I: IRON_INGOT }, out: [482, 2] },              // plancher de wagon
  { p: ['P', 'D'], k: { P: PLATINUM_INGOT, D: DARK_STEEL }, out: [481, 4] },          // ranchet
  { p: ['PBP'], k: { P: 462, B: IRON_BLOCK }, out: [480, 2] },                         // tampon de choc
  { p: ['I.', '.I'], k: { I: IRON_INGOT }, out: [479, 1] },                            // chaîne d'attelage
  { p: ['.I.', 'I.I', '.C.'], k: { I: IRON_INGOT, C: 479 }, out: [478, 1] },           // attelage
  { p: ['..H', '.HH', 'HHH'], k: { H: 465 }, out: [477, 2] },                          // rampe de chargement
  { p: ['RPR', 'ANT', 'BFB'], k: { R: 481, P: 482, A: 478, N: 477, T: 480, B: 460, F: 483 }, out: [476, 1] }, // wagon plat
  // le wagon trémie et ses pièces
  { p: ['S.S', 'S.S', '.S.'], k: { S: STEEL }, out: [493, 1] },                        // trémie
  { p: ['PP'], k: { P: 462 }, out: [494, 2] },                                         // trappe
  { p: ['I.I', '.S.', 'I.I'], k: { I: IRON_INGOT, S: STICK }, out: [495, 1] },         // volant de trappe
  { p: ['PPP', 'P.P'], k: { P: 462 }, out: [496, 1] },                                 // couvercle
  { p: ['I.I', 'III', 'I.I'], k: { I: IRON_INGOT }, out: [497, 2] },                   // échelle
  { p: ['CTE', 'AHA', 'BLB'], k: { C: 496, T: 493, E: 497, A: 494, H: 495, B: 460, L: 461 }, out: [490, 1] }, // wagon trémie
  // le wagon passagers et ses pièces
  { p: ['W', 'P'], k: { W: WOOL_WHITE, P: PLANKS }, out: [499, 2] },                   // siège
  { p: ['RRR', 'III'], k: { R: ROPE, I: IRON_INGOT }, out: [503, 2] },                 // filet à bagages
  { p: ['PPP', '.I.'], k: { P: PLANKS, I: IRON_INGOT }, out: [506, 1] },               // table pliante
  { p: ['NT', 'SS'], k: { N: 503, T: 506, S: 499 }, out: [498, 1] },                   // banquette
  { p: ['IGI'], k: { I: IRON_INGOT, G: GLASS }, out: [500, 2] },                       // fenêtre de voiture
  { p: ['I', 'I'], k: { I: STEEL }, out: [502, 2] },                                   // barre de maintien
  { p: ['PG', 'PK'], k: { P: 462, G: GLASS, K: 502 }, out: [501, 1] },                 // porte coulissante
  { p: ['GTG'], k: { G: GLASS, T: TORCH }, out: [504, 2] },                            // plafonnier
  { p: ['P.', 'PP'], k: { P: 462 }, out: [505, 2] },                                   // marchepied
  { p: ['FMF', 'SDS', 'BKB'], k: { F: 500, M: 504, S: 498, D: 501, B: 460, K: 505 }, out: [491, 1] }, // wagon passagers
  // le wagon poseur de rails et ses pièces
  { p: ['RRR', 'RRR', 'RRR'], k: { R: 456 }, out: [507, 1] },                          // pile de rails
  { p: ['LLL', 'LLL'], k: { L: LOG }, out: [508, 1] },                                 // pile de traverses
  { p: ['.SS', '.S.', 'SS.'], k: { S: STEEL }, out: [509, 1] },                        // bras articulé
  { p: ['SIS'], k: { S: STEEL, I: IRON_INGOT }, out: [510, 2] },                       // vérin
  { p: ['VI', 'S.'], k: { V: VOLTITE, I: IRON_INGOT, S: STICK }, out: [511, 1] },     // levier de commande
  { p: ['RTA', 'VKV', 'BLB'], k: { R: 507, T: 508, A: 509, V: 510, K: 511, B: 460, L: 461 }, out: [492, 1] }, // wagon poseur de rails
  // la gare
  { p: ['GGG', 'PVP'], k: { G: GLASS, P: 462, V: VOLTITE }, out: [512, 1] },           // plaque de destination
  { p: ['.I.', 'ILI', '.S.'], k: { I: IRON_INGOT, L: 94, S: STICK }, out: [513, 2] },  // lampe de quai
  { p: ['CDC', 'GLG', 'CCC'], k: { C: COBBLE, D: 512, G: GLASS, L: 513 }, out: [484, 1] }, // gare
  // composants de locomotive (menu de la locomotive : clic molette dans la cabine)
  { p: ['P.P', 'P.P', 'PPP'], k: { P: 462 }, out: [536, 1] },                          // réservoir de carburant
  { p: ['PPP', 'P.P', 'PPP'], k: { P: 462 }, out: [537, 1] },                          // réservoir d'air
  { p: ['IVI', 'IVI', 'III'], k: { I: IRON_INGOT, V: VOLTITE }, out: [538, 1] },       // batterie
  { p: ['.F.', 'SBS', '.S.'], k: { F: 469, S: STEEL, B: IRON_BLOCK }, out: [539, 1] }, // turbocompresseur
  { p: ['ISI', 'S.S', 'ISI'], k: { I: IRON_INGOT, S: STEEL }, out: [540, 1] },         // radiateur
  { p: ['ICI', 'VIV'], k: { I: IRON_INGOT, C: CIRCUIT, V: VOLTITE }, out: [541, 1] },  // alternateur
  { p: ['.S.', 'SIS', '.S.'], k: { S: STEEL, I: IRON_INGOT }, out: [542, 1] },         // pompe à carburant
  { p: ['SSS', 'D.S'], k: { S: STEEL, D: DARK_STEEL }, out: [543, 1] },                // pot d'échappement
  { p: ['.S', 'SV', '.S'], k: { S: STEEL, V: VOLTITE }, out: [544, 1] },               // avertisseur
  { p: ['.K', 'IC'], k: { K: STICK, I: IRON_INGOT, C: CIRCUIT }, out: [545, 1] },      // manette de traction
  { p: ['S', 'B', 'S'], k: { S: STEEL, B: IRON_BLOCK }, out: [546, 1] },               // cylindre de frein
  { p: ['SGS', '.S.'], k: { S: STEEL, G: SAND }, out: [547, 1] },                      // sablière
  { p: ['VRV', 'RVR'], k: { V: VOLTITE, R: ROPE }, out: [548, 1] },                    // faisceau de câbles
  { p: ['ICI', 'VBV', 'ICI'], k: { I: IRON_INGOT, C: CIRCUIT, V: VOLTITE, B: IRON_BLOCK }, out: [549, 1] }, // transformateur
  { p: ['SCS', 'BVB', 'SCS'], k: { S: STEEL, C: CIRCUIT, B: IRON_BLOCK, V: VOLTITE }, out: [550, 1] },     // moteur de traction
  // moteurs : le premier avec des composants, les suivants à partir du précédent
  { p: ['SPS', 'RFR', 'SSS'], k: { S: STEEL, P: 542, R: 540, F: 469 }, out: [520, 1] },          // moteur diesel
  { p: ['DDD', 'DED', 'DDD'], k: { D: DARK_STEEL, E: 520 }, out: [521, 1] },                      // diesel 250 ch
  { p: ['XSX', 'SES', 'XSX'], k: { X: 543, S: STEEL, E: 520 }, out: [522, 1] },                   // essence 250 ch
  { p: ['BIB', 'IEI', 'BIB'], k: { B: IRON_BLOCK, I: IRON_INGOT, E: 522 }, out: [523, 1] },       // V8 250 ch
  { p: ['CVC', 'VAV', 'CVC'], k: { C: CIRCUIT, V: VOLTITE, A: 541 }, out: [524, 1] },             // électrique 50 V
  { p: ['FSF', 'SES', 'FSF'], k: { F: 469, S: STEEL, E: 524 }, out: [525, 1] },                   // électrique 50 V ventilé
  { p: ['PCP', 'CEC', 'PCP'], k: { P: PLATINUM_INGOT, C: CIRCUIT, E: 525 }, out: [526, 1] },      // brushless 50 V
  { p: ['TDT', 'DED', 'TDT'], k: { T: 539, D: DARK_STEEL, E: 521 }, out: [527, 1] },              // diesel turbo 500 ch
  { p: ['XCX', 'CEC', 'XCX'], k: { X: 549, C: CIRCUIT, E: 526 }, out: [528, 1] },                 // électrique 200 V
  { p: ['TPT', 'PEP', 'TPT'], k: { T: 539, P: PLATINUM_INGOT, E: 523 }, out: [529, 1] },          // V12 800 ch
  { p: ['XWX', 'WEW', 'XWX'], k: { X: 549, W: 548, E: 528 }, out: [530, 1] },                     // électrique 1000 V
  { p: ['GTG', 'TET', 'GTG'], k: { G: TUNGSTEN_INGOT, T: 539, E: 529 }, out: [531, 1] },          // W16 1500 ch
  { p: ['GRG', 'FEF', 'GRG'], k: { G: TUNGSTEN_INGOT, R: 540, F: 469, E: 531 }, out: [532, 1] },  // turbine à gaz 3000 ch
  { p: ['GBG', 'BEB', 'GBG'], k: { G: TUNGSTEN_INGOT, B: 538, E: 530 }, out: [533, 1] },          // supraconducteur 5000 V
  { p: ['GGG', 'TET', 'GGG'], k: { G: TUNGSTEN_INGOT, T: 539, E: 532 }, out: [534, 1] },          // réaction 10 000 ch
  { p: ['GVG', 'RCS', 'GVG'], k: { G: TUNGSTEN_INGOT, V: VOLTITE_BLOCK, R: 534, C: CIRCUIT, S: 533 }, out: [535, 1] }, // fusion plasma
  // wagon de queue et wagon plat à étage, et leurs pièces
  { p: ['G', 'T', 'I'], k: { G: GLASS, T: TORCH, I: IRON_INGOT }, out: [554, 2] },                // feu rouge
  { p: ['GI', '.K'], k: { G: GLASS, I: IRON_INGOT, K: STICK }, out: [555, 2] },                   // rétroviseur
  { p: ['CMC', 'PPP'], k: { C: CIRCUIT, M: 545, P: 462 }, out: [556, 1] },                        // poste de conduite
  { p: ['FRV', 'CPC', 'BLB'], k: { F: 554, R: 555, V: 467, C: 463, P: 556, B: 460, L: 461 }, out: [552, 1] }, // wagon de queue
  { p: ['SSS', 'I.I'], k: { S: STEEL, I: IRON_INGOT }, out: [560, 2] },                          // passerelle
  { p: ['PPP', 'NNN'], k: { P: 482, N: 560 }, out: [557, 1] },                                   // plateau d'étage
  { p: ['B.B', 'B.B'], k: { B: 483 }, out: [558, 1] },                                           // support d'étage
  { p: ['I.I', 'III'], k: { I: IRON_INGOT }, out: [559, 2] },                                    // garde-corps
  { p: ['..P', '.PP', 'PPP'], k: { P: 462 }, out: [561, 1] },                                    // rampe
  { p: ['I', 'S', 'I'], k: { I: IRON_INGOT, S: STEEL }, out: [562, 2] },                         // charnière de rampe
  { p: ['D', 'D', 'D'], k: { D: DARK_STEEL }, out: [563, 2] },                                   // montant
  { p: ['GMG', 'PSP', 'RWC'], k: { G: 559, M: 563, P: 557, S: 558, R: 561, W: 476, C: 562 }, out: [553, 1] }, // wagon plat à étage
  // butoir, panneau de limitation de vitesse, détecteur de train
  { p: ['TBT', 'D.D'], k: { T: 480, B: 483, D: DARK_STEEL }, out: [565, 1] },                    // butoir
  { p: ['P', 'K', 'K'], k: { P: 466, K: STICK }, out: [571, 2] },                                // panneau de limitation
  { p: ['IRI', 'SVS'], k: { I: IRON_INGOT, R: 456, S: STEEL, V: VOLTITE }, out: [577, 2] },      // détecteur de train
  // locomotives à vapeur, tender et leurs pièces
  { p: ['.P', 'PI'], k: { P: PLATINUM_INGOT, I: IRON_INGOT }, out: [584, 1] },                   // sifflet à vapeur
  { p: ['S..', '.S.', '..S'], k: { S: STEEL }, out: [585, 2] },                                  // bielle
  { p: ['.I.', 'IBI', '.I.'], k: { I: IRON_INGOT, B: IRON_BLOCK }, out: [586, 2] },              // roue motrice
  { p: ['KDK', 'DDD'], k: { K: COAL, D: DARK_STEEL }, out: [587, 2] },                           // carénage
  { p: ['.D.', 'DVD', 'DDD'], k: { D: DARK_STEEL, V: 468 }, out: [588, 1] },                     // nez profilé
  { p: ['III', 'IKI', 'BBB'], k: { I: IRON_INGOT, K: COAL, B: COBBLE }, out: [589, 1] },         // foyer
  { p: ['IGI', '.K.'], k: { I: IRON_INGOT, G: GLASS, K: STICK }, out: [590, 1] },                // manomètre
  { p: ['NCC', 'FMA', 'RBR'], k: { N: 588, C: 587, F: 589, M: 590, A: 472, R: 586, B: 585 }, out: [581, 1] }, // locomotive carénée
  { p: ['SPL', 'FMA', 'RBR'], k: { S: 584, P: 462, L: LEAVES, F: 589, M: 590, A: 472, R: 586, B: 585 }, out: [582, 1] }, // locomotive camouflée
  { p: ['KKK', 'PCP', 'BLB'], k: { K: COAL, P: 462, C: CHEST, B: 460, L: 461 }, out: [583, 1] }, // tender
  // blocs de décoration (voir DECOR dans blocks.js ; au four : argile -> briques rouges,
  // briques de pierre -> fissurées, terre -> craquelée)
  { p: ['SS', 'SS'], k: { S: 3 }, out: [631, 4] },                                       // briques de pierre
  { p: ['B', 'L'], k: { B: 631, L: LEAVES }, out: [619, 1] },                            // briques moussues
  { p: ['S', 'S'], k: { S: 3 }, out: [622, 2] },                                         // pierre polie
  { p: ['PP'], k: { P: 622 }, out: [610, 2] },                                           // dallage
  { p: ['CG', 'GC'], k: { C: COBBLE, G: GRAVEL }, out: [604, 4] },                       // pavés de rue
  { p: ['DS', 'SD'], k: { D: DIORITE, S: 3 }, out: [617, 2] },                           // marbre
  { p: ['DS', 'SD'], k: { D: 2, S: SAND }, out: [603, 2] },                              // argile
  { p: ['.R.', 'RRR'], k: { R: 623 }, out: [633, 4] },                                   // toit en tuiles
  { p: ['DW', 'WD'], k: { D: 2, W: WHEAT }, out: [620, 4] },                             // briques de terre crue
  { p: ['DL', 'LD'], k: { D: 2, L: LEAVES }, out: [632, 2] },                            // boue des marais
  { p: ['LLL', 'LLL'], k: { L: LEAVES }, out: [618, 2] },                                // mousse
  { p: ['SM'], k: { S: 3, M: 618 }, out: [616, 2] },                                     // roche à lichen
  { p: ['SS'], k: { S: SAND }, out: [626, 2] },                                          // sable des dunes
  { p: ['SSS', 'SSS'], k: { S: SAND }, out: [627, 2] },                                  // grès
  { p: ['GG', 'GG'], k: { G: 627 }, out: [628, 4] },                                     // briques de grès
  { p: ['LP', 'PL'], k: { L: LOG, P: PLANKS }, out: [612, 4] },                          // colombage
  { p: ['P.P', '.P.', 'P.P'], k: { P: PLANKS }, out: [637, 4] },                         // parquet
  { p: ['WWW', 'WWW', 'WWW'], k: { W: WHEAT }, out: [613, 1] },                          // botte de foin
  { p: ['WW', 'WW'], k: { W: WHEAT }, out: [634, 4] },                                   // chaume
  { p: ['KK', 'KK'], k: { K: STICK }, out: [636, 4] },                                   // osier tressé
  { p: ['MK', 'KM'], k: { M: 617, K: COAL }, out: [602, 4] },                            // damier
  { p: ['WV'], k: { W: WOOL_WHITE, V: VOLTITE }, out: [601, 2] },                        // moquette rouge
  { p: ['TT', 'TT'], k: { T: TUFF }, out: [600, 4] },                                    // bloc d'os
  { p: ['L', 'D'], k: { L: LEAVES, D: 2 }, out: [621, 1] },                              // chapeau de champignon
  { p: ['C', 'T'], k: { C: 621, T: TORCH }, out: [611, 1] },                             // champignon lumineux
  { p: ['VGV'], k: { G: GLASS, V: VOLTITE }, out: [607, 1] },                            // cristal
  { p: ['KM'], k: { K: COAL, M: MAGMA }, out: [609, 2] },                                // braises
  { p: ['OT', 'TO'], k: { O: OBSIDIAN, T: TUNGSTEN_INGOT }, out: [608, 2] },             // écailles de dragon
  { p: ['WP', 'PW'], k: { W: WHEAT, P: PLANKS }, out: [614, 2] },                        // rayon de miel
  { p: ['III'], k: { I: IRON_INGOT }, out: [615, 3] },                                   // plaque de fer
  { p: ['P', 'G'], k: { P: 615, G: GRAVEL }, out: [625, 1] },                            // métal rouillé
  { p: ['CL'], k: { C: INDUSTRIAL_IRON_COPPER, L: LEAVES }, out: [635, 1] },             // cuivre vert-de-gris
  { p: ['.B.', 'BBB'], k: { B: BASALT }, out: [629, 4] },                                // toit d'ardoise
  { p: ['P', 'V'], k: { P: 622, V: VOLTITE }, out: [624, 1] },                           // pierre runique
  { p: ['GVG'], k: { G: GLASS, V: VOLTITE }, out: [630, 3] },                            // vitrail
  // wagon couvert, wagon blindé et leurs pièces
  { p: ['TTT', 'PDP', 'BLB'], k: { T: 464, P: 462, D: 501, B: 460, L: 461 }, out: [591, 1] },   // wagon couvert
  { p: ['I.I', 'III', 'BLB'], k: { I: IRON_INGOT, B: 460, L: 461 }, out: [663, 1] },             // wagonnet de mine
  { p: ['III', 'ILI'], k: { I: IRON_INGOT, L: 94 }, out: [664, 1] },                            // lampe de casque
  { p: ['DLD', 'DLD'], k: { D: DARK_STEEL, L: LEAVES }, out: [595, 2] },                         // plaque de blindage
  { p: ['B', 'D', 'B'], k: { B: 460, D: DARK_STEEL }, out: [596, 1] },                           // bogie renforcé
  { p: ['.AS', 'AAS', 'AA.'], k: { A: 595, S: STEEL }, out: [593, 1] },                          // tourelle
  { p: ['I', 'T', 'P'], k: { I: IRON_INGOT, T: TNT, P: PLATINUM_INGOT }, out: [594, 4] },        // obus
  { p: ['UAU', 'AAA', 'RLR'], k: { U: 593, A: 595, R: 596, L: 461 }, out: [592, 1] },            // wagon blindé
];
// Les bois de châtaignier et de tilleul servent comme celui de chêne. Avec leurs planches, on
// obtient des bâtons et des outils de ce bois (leur propre apparence) ; table, coffre...
// restent les mêmes (sauf la dalle de chêne, qui garde sa couleur). Leur bâton remplace le
// bâton partout (torches, levier, outils en pierre...).
const WOODS = [
  [CHESTNUT_PLANKS, CHESTNUT_STICK, CHESTNUT_PICKAXE, CHESTNUT_AXE, CHESTNUT_SHOVEL, CHESTNUT_SWORD, CHESTNUT_HOE],
  [LINDEN_PLANKS, LINDEN_STICK, LINDEN_PICKAXE, LINDEN_AXE, LINDEN_SHOVEL, LINDEN_SWORD, LINDEN_HOE],
  [BIRCH_PLANKS, BIRCH_STICK, BIRCH_PICKAXE, BIRCH_AXE, BIRCH_SHOVEL, BIRCH_SWORD, BIRCH_HOE],
];
const BASE_RECIPES = [...RECIPES];
for (const [planksId, stick, pickaxe, axe, shovel, sword, hoe] of WOODS) {
  const OF = { [STICK]: stick, [WOODEN_PICKAXE]: pickaxe, [WOODEN_AXE]: axe, [WOODEN_SHOVEL]: shovel, [WOODEN_SWORD]: sword, [WOODEN_HOE]: hoe };
  const TO = { [PLANKS]: planksId, [STICK]: stick };
  for (const r of BASE_RECIPES) {
    const keys = Object.entries(r.k), planks = keys.some(([, id]) => id === PLANKS);
    if (planks && r.out[0] === OAK_SLAB) continue;
    if (!planks && !keys.some(([, id]) => id === STICK)) continue;
    RECIPES.push({
      p: r.p,
      k: Object.fromEntries(keys.map(([c, id]) => [c, TO[id] ?? id])),
      out: planks ? [OF[r.out[0]] ?? r.out[0], r.out[1]] : r.out,
    });
  }
}
// Dalles : 3 blocs en ligne (matières ajoutées : les deux premières ont leur recette plus
// haut) ; dalle verticale : 2 dalles l'une sur l'autre en donnent 2, et elle redevient une dalle
SLAB_MATS.forEach((mat, m) => {
  if (m >= 2) RECIPES.push({ p: ['FFF'], k: { F: mat.full }, out: [mat.bottom, 6] });
  RECIPES.push({ p: ['S', 'S'], k: { S: mat.bottom }, out: [vslabId(m, 0), 2] });
  RECIPES.push({ p: ['V'], k: { V: vslabId(m, 0) }, out: [mat.bottom, 1] });
});
// motifs sous forme de tableaux d'ids (et leur reflet)
for (const r of RECIPES) {
  const rows = r.p.map((line) => [...line].map((ch) => (ch === '.' ? 0 : r.k[ch])));
  r.forms = [rows, rows.map((row) => [...row].reverse())];
}

// Résultat de la grille (ids, n x n) ou null
export function craftResult(ids, n) {
  let r0 = n, r1 = -1, c0 = n, c1 = -1;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!ids[r * n + c]) continue;
      r0 = Math.min(r0, r); r1 = Math.max(r1, r); c0 = Math.min(c0, c); c1 = Math.max(c1, c);
    }
  }
  if (r1 < 0) return null;
  const h = r1 - r0 + 1, w = c1 - c0 + 1;
  for (const rec of RECIPES) {
    for (const f of rec.forms) {
      if (f.length !== h || f[0].length !== w) continue;
      let ok = true;
      for (let r = 0; r < h && ok; r++) for (let c = 0; c < w && ok; c++) ok = f[r][c] === ids[(r0 + r) * n + c0 + c];
      if (ok) return { id: rec.out[0], n: rec.out[1] };
    }
  }
  return null;
}

// ---------- Minage ----------
// Matière de chaque bloc : temps pour le casser à la main, et outil qui va plus vite.
const MATTER = {
  dirt: { time: 0.75, tool: 'shovel', fast: 0.45 },
  stone: { time: 5, tool: 'pickaxe', fast: 0.22 },
  wood: { time: 2.5, tool: 'axe', fast: 0.4 },
  leaves: { time: 0.35, tool: 'sword', fast: 0.4 },
  rail: { time: 0.7, tool: 'pickaxe', fast: 0.5 },
  snow: { time: 0.5, tool: 'shovel', fast: 0.3 },
  glass: { time: 0.45, tool: null, fast: 1 },
  obsidian: { time: 25, tool: 'pickaxe', fast: 0.22 }, // très dure : il faut une pioche en fer
  hard: { time: 12, tool: 'pickaxe', fast: 0.22 },     // tungstène
  instant: { time: 0.05, tool: null, fast: 1 },
  wool: { time: 0.8, tool: null, fast: 1 },
};
const MATTER_OF = {
  1: 'dirt', 2: 'dirt', 8: 'dirt', [SNOW_GRASS]: 'dirt', [SNOW]: 'snow',
  3: 'stone', 28: 'stone', 29: 'stone', 30: 'stone', 32: 'stone', 34: 'stone',
  5: 'wood', 18: 'wood', 31: 'wood', 33: 'wood', 35: 'wood', [CHESTNUT_LOG]: 'wood', [CHESTNUT_PLANKS]: 'wood',
  [CHESTNUT_LEAVES]: 'leaves', [CHESTNUT_LEAVES_PLACED]: 'leaves', [CHESTNUT_SAPLING]: 'instant',
  [LINDEN_LOG]: 'wood', [LINDEN_PLANKS]: 'wood',
  [LINDEN_LEAVES]: 'leaves', [LINDEN_LEAVES_PLACED]: 'leaves', [LINDEN_SAPLING]: 'instant',
  [BIRCH_LOG]: 'wood', [BIRCH_PLANKS]: 'wood', [BIRCH_LEAVES]: 'leaves', [BIRCH_LEAVES_PLACED]: 'leaves', [BIRCH_SAPLING]: 'instant',
  [DIORITE]: 'stone', [POLISHED_DIORITE]: 'stone', [DIORITE_BRICKS]: 'stone', [FARMLAND]: 'dirt', 455: 'dirt',
  ...Object.fromEntries(Array.from({ length: 12 }, (_, k) => [443 + k, 'wood'])),
  ...Object.fromEntries(Array.from({ length: WHEAT_RIPE - WHEAT_CROP + 1 }, (_, k) => [WHEAT_CROP + k, 'instant'])),
  ...Object.fromEntries(Array.from({ length: POTATO_RIPE - POTATO_CROP + 1 }, (_, k) => [POTATO_CROP + k, 'instant'])),
  [INDUSTRIAL_IRON]: 'stone', [INDUSTRIAL_IRON_COPPER]: 'stone', [INDUSTRIAL_IRON_RUSTY]: 'stone',
  279: 'stone', 280: 'stone', 281: 'stone', 282: 'stone', 283: 'stone', 284: 'stone',
  ...Object.fromEntries(Array.from({ length: 6 }, (_, k) => [484 + k, 'stone'])), // gare
  ...Object.fromEntries(Array.from({ length: 12 }, (_, k) => [565 + k, 'rail'])), 577: 'rail', 578: 'rail', // butoir, panneau, détecteur
  6: 'leaves', [SNOW_LEAVES]: 'leaves', [CACTUS]: 'leaves', [LEAVES_PLACED]: 'leaves', [SNOW_LEAVES_PLACED]: 'leaves', [SAPLING]: 'instant', 96: 'instant', 94: 'glass', 95: 'glass', ...Object.fromEntries(Array.from({ length: 24 }, (_, i) => [210 + i, 'instant'])), ...Object.fromEntries(Array.from({ length: 24 }, (_, i) => [170 + i, 'instant'])),
  17: 'rail', 19: 'rail', 20: 'rail', 21: 'rail', 22: 'rail', 456: 'rail', 473: 'rail', 474: 'rail',
  23: 'instant', 24: 'instant', 25: 'instant', 26: 'instant', 234: 'instant', 235: 'instant', 236: 'instant', 237: 'instant', 238: 'instant', 239: 'instant', 27: 'instant', 79: 'instant', 80: 'instant',
  [GLASS]: 'glass', [TNT_200]: 'instant', [TNT_1000]: 'instant',
  [IRON_ORE]: 'stone', [VOLTITE_ORE]: 'stone', [IRON_BLOCK]: 'stone', [VOLTITE_BLOCK]: 'stone',
  [WIRE]: 'instant', [WIRE_ON]: 'instant', [IWIRE]: 'instant', [IWIRE_ON]: 'instant',
  [PLATINUM_ORE]: 'stone', [PLATINUM_BLOCK]: 'stone', [TUNGSTEN_ORE]: 'hard', [TUNGSTEN_BLOCK]: 'hard', [FLUORITE_ORE]: 'stone', [FLUORITE_BLOCK]: 'stone', [CRIMSONITE_ORE]: 'hard', [CRIMSONITE_BLOCK]: 'hard', [IMPURE_VOLTITE_ORE]: 'stone', [PHYSICS]: 'wood', [PHYSICS_ON]: 'wood', [PROPELLER]: 'wood', [PROPELLER_ON]: 'wood', [STABILIZER]: 'stone', [STABILIZER_ON]: 'stone', 81: 'stone',
  194: 'wool', 195: 'wool', [TARGET]: 'wool', [GRAVEL]: 'dirt', [STEEL]: 'stone', [DARK_STEEL]: 'stone', [OLD_STEEL]: 'stone', 196: 'instant',
  [BASALT]: 'stone', [SULFUR]: 'stone', [TUFF]: 'stone', [MAGMA]: 'stone', [ASH]: 'dirt', [OBSIDIAN]: 'obsidian',
};
// blocs de décoration : leur matière (voir DECOR dans blocks.js)
for (const [id, , , m] of DECOR) MATTER_OF[id] = m;
// La matière d'un bloc ('dirt', 'stone', 'wood', 'leaves'...), ou undefined
export const matterOf = (id) => MATTER_OF[id];
// fours (toutes orientations, allumés ou non) : de la pierre ; coffres : du bois
for (let k = 0; k < 12; k++) MATTER_OF[FURNACE + k] = 'stone';
for (let k = 0; k < 6; k++) MATTER_OF[CHEST + k] = 'wood';
// ordinateurs et serveurs (toutes orientations) : de la pierre (boîtier de métal)
for (let k = 0; k < 6; k++) MATTER_OF[COMPUTER + k] = MATTER_OF[SERVER + k] = 'stone';
// dalles (toutes, verticales, deux dalles) : la matière de leur bloc plein
for (const [id, b] of Object.entries(BLOCKS)) if (b.slabMat !== undefined && !MATTER_OF[id]) MATTER_OF[id] = MATTER_OF[SLAB_MATS[b.slabMat].full];
// sans pioche, la pierre ne donne rien (comme dans Minecraft)
const NEEDS_PICKAXE = new Set([3, 28, 29, 30, 32, 34, IRON_ORE, VOLTITE_ORE, IRON_BLOCK, VOLTITE_BLOCK,
  PLATINUM_ORE, PLATINUM_BLOCK, TUNGSTEN_ORE, TUNGSTEN_BLOCK, FLUORITE_ORE, FLUORITE_BLOCK, CRIMSONITE_ORE, CRIMSONITE_BLOCK, IMPURE_VOLTITE_ORE, STEEL, DARK_STEEL, OLD_STEEL, BASALT, SULFUR, TUFF, MAGMA, OBSIDIAN, ...Array.from({ length: 12 }, (_, k) => FURNACE + k),
  DIORITE, POLISHED_DIORITE, DIORITE_BRICKS, INDUSTRIAL_IRON, INDUSTRIAL_IRON_COPPER, INDUSTRIAL_IRON_RUSTY]);
for (const [id, , , m] of DECOR) if (m === 'stone' || m === 'hard') NEEDS_PICKAXE.add(id); // (décoration en pierre)
for (const [id, b] of Object.entries(BLOCKS)) if (b.slabMat !== undefined && NEEDS_PICKAXE.has(SLAB_MATS[b.slabMat].full)) NEEDS_PICKAXE.add(+id);

// held : objet tenu. Un outil rustique (cailloux) va 1,5 fois plus vite qu'un outil en bois,
// un outil en pierre 2 fois plus vite, un outil en fer 2,6 fois plus vite, en fluorite 3 fois,
// en platine 3,4 fois, en tungstène 4,5 fois, en cramoisite 6 fois.
const TIER_SPEED = [1, 1, 1.5, 2, 2.6, 3, 3.4, 4.5, 6];
export function breakTime(id, held) {
  const m = MATTER[MATTER_OF[id]] || MATTER.dirt;
  const it = ITEMS[held];
  if (!it?.tool || it.tool !== m.tool) return m.time;
  return (m.time * m.fast) / (TIER_SPEED[it.tier] || 1);
}

// Ce que donne un bloc cassé : [id, quantité] ou null
export function dropOf(id, held) {
  if (!BLOCKS[id] || BLOCKS[id].unbreakable || isWater(id)) return null;
  const it = ITEMS[held];
  if (NEEDS_PICKAXE.has(id) && it?.tool !== 'pickaxe') return null;
  if (id === 1 || id === FARMLAND || id === 455) return [2, 1]; // herbe, terre labourée -> terre
  // herbe haute : parfois des graines de blé
  if (BLOCKS[id].grass) return Math.random() < 0.15 ? [SEEDS, 1] : null;
  // blé : mûr, du blé (et des graines, voir extraDrop) ; sinon, la graine revient
  // pommes de terre : mûres, 2 à 4 ; sinon, celle qu'on a plantée
  if (id >= POTATO_CROP && id <= POTATO_RIPE) return [POTATO, id === POTATO_RIPE ? 2 + Math.floor(Math.random() * 3) : 1];
  if (isCrop(id)) return id === WHEAT_RIPE ? [WHEAT, 1] : [SEEDS, 1];
  // pierre : une pioche en bois ne fait qu'en détacher des cailloux (1 à 3) ; il faut une
  // pioche rustique pour la récupérer en pierre taillée
  if (id === 3) return it.tier >= 2 ? [COBBLE, 1] : [PEBBLE, 1 + Math.floor(Math.random() * 3)];
  if (id === 30) return [COAL, 1];      // minerai -> charbon
  // fer : il faut une pioche en pierre (le minerai se fond ensuite au four)
  if (id === IRON_ORE) return it.tier >= 3 ? [IRON_ORE, 1] : null;
  // voltite : il faut une pioche en fer ; 2 à 4 cristaux
  if (id === VOLTITE_ORE) return it.tier >= 4 ? [VOLTITE, 2 + Math.floor(Math.random() * 3)] : null;
  if (id === OBSIDIAN) return it.tier >= 4 ? [OBSIDIAN, 1] : null; // pioche en fer
  // voltite impure : pioche en pierre ; 2 à 5 cristaux
  if (id === IMPURE_VOLTITE_ORE) return it.tier >= 3 ? [IMPURE_VOLTITE, 2 + Math.floor(Math.random() * 4)] : null;
  // fluorite : pioche en fer ; platine : pioche en fluorite ; tungstène : pioche en platine ;
  // cramoisite : pioche en tungstène (fondus ensuite au four)
  if (id === FLUORITE_ORE || id === FLUORITE_BLOCK) return it.tier >= 4 ? [id, 1] : null;
  if (id === PLATINUM_ORE || id === PLATINUM_BLOCK) return it.tier >= 5 ? [id, 1] : null;
  if (id === TUNGSTEN_ORE || id === TUNGSTEN_BLOCK) return it.tier >= 6 ? [id, 1] : null;
  if (id === CRIMSONITE_ORE || id === CRIMSONITE_BLOCK) return it.tier >= 7 ? [id, 1] : null;
  if (id === SNOW_GRASS) return [2, 1]; // herbe enneigée -> terre
  // neige : 4 boules de neige à la pelle, une seule à la main
  if (id === SNOW) return [SNOWBALL, it?.tool === 'shovel' ? 4 : 1];
  // feuilles de châtaignier : 12 % de chances d'une pousse, sinon parfois un bâton de châtaignier
  if (id === CHESTNUT_LEAVES || id === CHESTNUT_LEAVES_PLACED) {
    if (Math.random() < 0.12) return [CHESTNUT_SAPLING, 1];
    return Math.random() < 0.15 ? [CHESTNUT_STICK, 1] : null;
  }
  // feuilles de tilleul : 12 % de chances d'une pousse, sinon parfois un bâton de tilleul
  if (id === LINDEN_LEAVES || id === LINDEN_LEAVES_PLACED) {
    if (Math.random() < 0.12) return [LINDEN_SAPLING, 1];
    return Math.random() < 0.15 ? [LINDEN_STICK, 1] : null;
  }
  // feuilles de bouleau : 12 % de chances d'une pousse, sinon parfois un bâton de bouleau
  if (id === BIRCH_LEAVES || id === BIRCH_LEAVES_PLACED) {
    if (Math.random() < 0.12) return [BIRCH_SAPLING, 1];
    return Math.random() < 0.15 ? [BIRCH_STICK, 1] : null;
  }
  // tête de piston : rien (on récupère le piston en cassant son corps)
  if (isPistonHead(id)) return null;
  // feuilles : 15 % de chances d'une pousse, sinon parfois un bâton
  if ([LEAVES, SNOW_LEAVES, LEAVES_PLACED, SNOW_LEAVES_PLACED].includes(id)) {
    if (Math.random() < 0.15) return [SAPLING, 1];
    return Math.random() < 0.12 ? [STICK, 1] : null;
  }
  return [BLOCKS[id].pick ?? id, 1];
}

// Ce que donne en plus un bloc cassé (le blé mûr : 1 à 3 graines, à ressemer) : [id, n] ou null
export function extraDrop(id) {
  return id === WHEAT_RIPE ? [SEEDS, 1 + Math.floor(Math.random() * 3)] : null;
}

// Barre d'usure d'un outil entamé (sous l'icône, du vert au rouge) et usure dans l'infobulle
export function wearBar(el, s) {
  el.querySelector('.dur')?.remove();
  const max = s && durability(s.id);
  if (!max) return;
  el.title += ` (${max - (s.w || 0)} / ${max})`;
  if (!s.w) return;
  const f = Math.max(0, 1 - s.w / max);
  const bar = document.createElement('i');
  bar.className = 'dur';
  const fill = document.createElement('i');
  fill.style.width = Math.round(f * 100) + '%';
  fill.style.background = `hsl(${Math.round(f * 120)}, 85%, 48%)`;
  bar.appendChild(fill);
  el.appendChild(bar);
}

// ---------- Survie ----------
export class Survival {
  // ui : { icon(id, size), name(id), onChange(), onDeath(), onHurt(amount), onCraft() }
  constructor(ui) {
    this.ui = ui;
    this.on = false;
    this.slots = new Array(INV_SIZE).fill(null); // { id, n }
    this.grid = new Array(9).fill(null);
    this.head = null;        // équipement : ce qu'on porte sur la tête (casquette...)
    this.gridN = 2;
    this.cursor = null;
    this.health = MAX_HEALTH;
    this.hunger = MAX_HUNGER;
    this.dead = false;
    this.hardcore = false;  // mode hardcore : une seule vie, dégâts plus forts (voir main.js)
    this.air = AIR_TIME;
    this.airTop = null;     // plus haut point de la chute en cours
    this.sinceHurt = 99;
    this.regen = 0;
    this.drown = 0;
    this.prick = 0;         // temps avant la prochaine piqûre de cactus
    this.burnTick = 0;      // en feu : temps depuis la dernière brûlure
    this.heartStyle = '';   // cœurs normaux, en feu ('burning') ou gelés ('frozen')
    // (images chargées d'avance : pas de cœur vide le temps de les charger)
    this.heartImgs = ['full_burning', 'half_burning', 'full_frozen', 'half_frozen'].map((n) => { const i = new Image(); i.src = 'texture/interface/coeurs/' + n + '.png'; return i; });
    this.hover = null;
    this.buildHud();
    this.buildScreen();
  }

  // ---------- Chargement / sauvegarde ----------
  load(on, inv, health, hunger) {
    this.on = on;
    this.open = false;
    this.cursor = null;
    this.grid.fill(null);
    this.slots.fill(null);
    if (Array.isArray(inv)) {
      inv.forEach((s, i) => {
        if (i < INV_SIZE && s && (BLOCKS[s.id] || ITEMS[s.id]) && s.n > 0) this.slots[i] = makeSlot(s.id, Math.min(s.n, stackMax(s.id)), s.w);
      });
    }
    this.health = Number.isFinite(health) && health > 0 ? Math.min(MAX_HEALTH, health) : MAX_HEALTH;
    this.hunger = Number.isFinite(hunger) ? Math.max(0, Math.min(MAX_HUNGER, hunger)) : MAX_HUNGER;
    this.dead = false;
    this.air = AIR_TIME;
    this.airTop = null;
    this.sinceHurt = 99;
    document.body.classList.toggle('survival', on);
    this.renderHearts();
    this.renderHunger();
    this.ui.onChange();
  }

  saveInv() {
    return this.slots.map((s) => (s ? makeSlot(s.id, s.n, s.w) : null));
  }

  // ---------- Inventaire ----------
  // Ajoute des objets (d'abord sur les piles existantes, barre en premier) ; renvoie le reste
  // (w : usure d'un outil, qui ne s'empile pas)
  add(id, n, from = 0, to = INV_SIZE, w = 0) {
    const max = stackMax(id);
    for (let i = from; i < to && n > 0; i++) {
      const s = this.slots[i];
      if (s && s.id === id && s.n < max) { const k = Math.min(max - s.n, n); s.n += k; n -= k; }
    }
    for (let i = from; i < to && n > 0; i++) {
      if (this.slots[i]) continue;
      const k = Math.min(max, n);
      this.slots[i] = makeSlot(id, k, w);
      n -= k;
    }
    return n;
  }

  give(id, n, w = 0) {
    const left = this.add(id, n, 0, INV_SIZE, w);
    this.changed();
    return left;
  }

  // Retire un objet de la case i (bloc posé)
  take(i, n = 1) {
    const s = this.slots[i];
    if (!s) return false;
    s.n -= n;
    if (s.n <= 0) this.slots[i] = null;
    this.changed();
    return true;
  }

  count(i) { return this.slots[i]?.n || 0; }

  // L'outil de la case i s'use de n ; renvoie son nom s'il vient de casser
  wear(i, n = 1) {
    const s = this.slots[i], max = s && durability(s.id);
    if (!this.on || !max) return null;
    s.w = (s.w || 0) + n;
    let broke = null;
    if (s.w >= max) { broke = this.ui.name(s.id); this.slots[i] = null; }
    this.changed();
    return broke;
  }

  changed() {
    this.ui.onChange();
    if (this.open) this.render();
  }

  // ---------- Écran d'inventaire / table de craft ----------
  buildScreen() {
    this.el = {
      title: document.getElementById('craft-title'),
      grid: document.getElementById('craft-grid'),
      out: document.getElementById('craft-out'),
      main: document.getElementById('sinv-main'),
      hot: document.getElementById('sinv-hot'),
      cursor: document.getElementById('sinv-cursor'),
    };
    const make = (parent, ref) => {
      const el = document.createElement('div');
      el.className = 'slot';
      this.touchSlot(el, ref);
      el.addEventListener('mousedown', (e) => { e.preventDefault(); this.click(ref, e.button, e.shiftKey); });
      el.addEventListener('mouseenter', () => { this.hover = ref; });
      el.addEventListener('mouseleave', () => { if (this.hover === ref) this.hover = null; });
      parent.appendChild(el);
      return el;
    };
    this.invEls = [];
    for (let i = 0; i < INV_SIZE; i++) this.invEls[i] = make(i < HOTBAR_SLOTS ? this.el.hot : this.el.main, { kind: 'inv', i });
    this.gridEls = Array.from({ length: 9 }, (_, i) => make(this.el.grid, { kind: 'grid', i }));
    // équipement (dans l'inventaire) : la tête
    this.el.equip = document.getElementById('sinv-equip');
    this.headEl = make(document.getElementById('sinv-head-slot'), { kind: 'head' });
    // coffre (30 cases) et four (entrée, combustible, résultat)
    this.el.craft = document.getElementById('craft-box');
    this.el.chest = document.getElementById('box-chest');
    this.el.furnace = document.getElementById('box-furnace');
    this.chestEls = Array.from({ length: 30 }, (_, i) => make(this.el.chest, { kind: 'box', i }));
    const hook = (id, ref) => {
      const el = document.getElementById(id);
      this.touchSlot(el, ref);
      el.addEventListener('mousedown', (e) => { e.preventDefault(); this.click(ref, e.button, e.shiftKey); });
      el.addEventListener('mouseenter', () => { this.hover = ref; });
      el.addEventListener('mouseleave', () => { if (this.hover === ref) this.hover = null; });
      return el;
    };
    this.furEls = { input: hook('fur-in', { kind: 'fin' }), fuel: hook('fur-fuel', { kind: 'ffuel' }), output: hook('fur-out', { kind: 'fout' }) };
    this.el.flame = document.getElementById('fur-flame');
    this.el.arrow = document.getElementById('fur-arrow');
    this.el.out.addEventListener('mousedown', (e) => { e.preventDefault(); this.takeResult(e.shiftKey); });
    // (tactile : double toucher sur le résultat, tout fabriquer d'un coup, comme Maj)
    let outLast = 0;
    this.el.out.addEventListener('touchend', (e) => {
      e.preventDefault();
      const now = performance.now();
      if (now - outLast < 320) { outLast = 0; this.takeResult(true); } else { outLast = now; this.takeResult(false); }
    }, { passive: false });
    this.el.out.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
    document.addEventListener('mousemove', (e) => {
      this.el.cursor.style.transform = `translate(${e.clientX - 22}px, ${e.clientY - 22}px)`;
    });
  }

  // Écran tactile (iPad, téléphone) : pas de clic droit ni de Maj. Toucher : clic gauche ;
  // appui long : clic droit (prendre la moitié d'une pile, ou poser un seul objet) ;
  // double toucher : ranger la pile de l'autre côté (Maj + clic)
  touchSlot(el, ref) {
    let timer = 0, long = false, last = 0;
    const moveCursor = (t) => { this.el.cursor.style.transform = `translate(${t.clientX - 22}px, ${t.clientY - 60}px)`; };
    el.addEventListener('touchstart', (e) => {
      e.preventDefault(); // (pas de clic de souris imité ensuite)
      moveCursor(e.changedTouches[0]);
      long = false;
      clearTimeout(timer);
      timer = setTimeout(() => { long = true; navigator.vibrate?.(15); this.click(ref, 2, false); }, 380);
    }, { passive: false });
    el.addEventListener('touchmove', (e) => { e.preventDefault(); moveCursor(e.changedTouches[0]); }, { passive: false });
    el.addEventListener('touchend', (e) => {
      e.preventDefault();
      clearTimeout(timer);
      if (long) return;
      const now = performance.now(), double = now - last < 320 && this.lastTouch === ref;
      last = double ? 0 : now;
      this.lastTouch = ref;
      this.click(ref, 0, false);
      if (double) this.click(ref, 0, true);
    }, { passive: false });
    el.addEventListener('touchcancel', () => clearTimeout(timer));
  }

  // n = 2 : inventaire (grille 2x2) ; n = 3 : table de craft
  openScreen(n) {
    this.box = null;
    this.showBox(null);
    this.gridN = n;
    this.grid.fill(null);
    this.cursor = null;
    this.open = true;
    this.el.title.textContent = n === 3 ? 'Table de craft' : 'Artisanat';
    this.el.grid.style.setProperty('--n', n);
    this.el.grid.dataset.n = n; // (décalage des colonnes en nid d'abeille, voir style.css)
    this.gridEls.forEach((el, i) => { el.hidden = i >= n * n; });
    this.el.equip.hidden = n !== 2;
    this.render();
  }

  // Coffre ou four : box = son contenu (voir containers.js)
  openBox(box) {
    this.box = box;
    this.gridN = 0;
    this.grid.fill(null);
    this.cursor = null;
    this.open = true;
    this.el.title.textContent = box.type === 'chest' ? 'Coffre' : 'Four';
    this.el.equip.hidden = true;
    this.showBox(box.type);
    this.render();
  }

  showBox(type) {
    this.el.craft.hidden = !!type;
    this.el.chest.hidden = type !== 'chest';
    this.el.furnace.hidden = type !== 'furnace';
  }

  // À la fermeture, la grille et l'objet tenu retournent dans l'inventaire (le contenu du
  // coffre / four reste dedans)
  closeScreen() {
    if (!this.open) return 0;
    this.open = false;
    this.box = null;
    let lost = 0;
    for (let i = 0; i < 9; i++) if (this.grid[i]) { const g = this.grid[i]; lost += this.add(g.id, g.n, 0, INV_SIZE, g.w); this.grid[i] = null; }
    if (this.cursor) { const c = this.cursor; lost += this.add(c.id, c.n, 0, INV_SIZE, c.w); this.cursor = null; }
    this.ui.onChange();
    return lost;
  }

  gridIds() {
    const n = this.gridN, ids = [];
    for (let i = 0; i < n * n; i++) ids.push(this.grid[i]?.id || 0);
    return ids;
  }

  // Case désignée par ref : inventaire, grille de craft, coffre (box) ou four (fin, ffuel, fout)
  get(ref) {
    switch (ref.kind) {
      case 'inv': return this.slots[ref.i];
      case 'grid': return this.grid[ref.i];
      case 'head': return this.head;
      case 'box': return this.box?.slots[ref.i] ?? null;
      case 'fin': return this.box?.input ?? null;
      case 'ffuel': return this.box?.fuel ?? null;
      case 'fout': return this.box?.output ?? null;
    }
    return null;
  }
  set(ref, s) {
    switch (ref.kind) {
      case 'inv': this.slots[ref.i] = s; break;
      case 'grid': this.grid[ref.i] = s; break;
      case 'head': this.head = s; break;
      case 'box': this.box.slots[ref.i] = s; break;
      case 'fin': this.box.input = s; break;
      case 'ffuel': this.box.fuel = s; break;
      case 'fout': this.box.output = s; break;
    }
  }

  // Range n objets id dans une seule case (four) ; renvoie le reste
  putIn(ref, id, n, w = 0) {
    const s = this.get(ref), max = stackMax(id);
    if (!s) { const k = Math.min(max, n); this.set(ref, makeSlot(id, k, w)); return n - k; }
    if (s.id !== id) return n;
    const k = Math.min(max - s.n, n);
    s.n += k;
    return n - k;
  }

  // Range n objets id dans le coffre (piles existantes d'abord) ; renvoie le reste
  addToChest(id, n, w = 0) {
    const max = stackMax(id), slots = this.box.slots;
    for (let i = 0; i < slots.length && n > 0; i++) {
      const s = slots[i];
      if (s && s.id === id && s.n < max) { const k = Math.min(max - s.n, n); s.n += k; n -= k; }
    }
    for (let i = 0; i < slots.length && n > 0; i++) {
      if (slots[i]) continue;
      const k = Math.min(max, n);
      slots[i] = makeSlot(id, k, w);
      n -= k;
    }
    return n;
  }

  // Maj + clic avec un coffre / four ouvert : de l'inventaire vers le coffre / four, et inversement
  shiftBox(ref, s) {
    if (ref.kind !== 'inv') return this.add(s.id, s.n, 0, INV_SIZE, s.w); // du coffre / four vers l'inventaire
    if (this.box.type === 'chest') return this.addToChest(s.id, s.n, s.w);
    if (SMELT[s.id] !== undefined) return this.putIn({ kind: 'fin' }, s.id, s.n, s.w);
    if (FUEL[s.id]) return this.putIn({ kind: 'ffuel' }, s.id, s.n, s.w);
    return s.n;
  }

  // Clic sur une case (comme dans Minecraft)
  //  gauche : prendre / poser / échanger la pile · droit : prendre la moitié / poser un seul
  //  Maj + clic : envoie la pile de la barre au sac (et inversement), ou de la grille au sac
  click(ref, button, shift) {
    const s = this.get(ref);
    // résultat du four : on ne peut que le prendre
    if (ref.kind === 'fout') {
      if (!s) return;
      if (shift) { const left = this.add(s.id, s.n, 0, INV_SIZE, s.w); this.set(ref, left ? makeSlot(s.id, left, s.w) : null); }
      else if (!this.cursor) { this.cursor = s; this.set(ref, null); }
      else if (this.cursor.id === s.id) {
        const k = Math.min(stackMax(s.id) - this.cursor.n, s.n);
        this.cursor.n += k; s.n -= k;
        if (!s.n) this.set(ref, null);
      }
      this.changed();
      return;
    }
    // case du combustible : seulement ce qui brûle ; tête : seulement ce qui se porte (un seul)
    if (ref.kind === 'ffuel' && this.cursor && !FUEL[this.cursor.id]) return;
    if (ref.kind === 'head') {
      if (this.cursor && (ITEMS[this.cursor.id]?.wear !== 'head' || this.cursor.n !== 1)) return;
      if (shift && s) { const left = this.add(s.id, s.n, 0, INV_SIZE, s.w); if (!left) this.head = null; this.changed(); return; }
      const c = this.cursor;
      this.cursor = s;
      this.head = c;
      this.changed();
      return;
    }
    if (shift && s && !this.cursor) {
      this.set(ref, null);
      let left;
      if (this.box) left = this.shiftBox(ref, s);
      else if (ref.kind === 'grid') left = this.add(s.id, s.n, 0, INV_SIZE, s.w);
      else if (ref.i < HOTBAR_SLOTS) left = this.add(s.id, s.n, HOTBAR_SLOTS, INV_SIZE, s.w);
      else left = this.add(s.id, s.n, 0, HOTBAR_SLOTS, s.w);
      if (left) this.set(ref, makeSlot(s.id, left, s.w));
    } else if (button === 2) {
      const c = this.cursor;
      if (!c) {
        if (s) { const half = Math.ceil(s.n / 2); this.cursor = makeSlot(s.id, half, s.w); s.n -= half; if (!s.n) this.set(ref, null); }
      } else if (!s) {
        this.set(ref, makeSlot(c.id, 1, c.w)); c.n--;
      } else if (s.id === c.id && s.n < stackMax(s.id)) {
        s.n++; c.n--;
      }
      if (this.cursor && this.cursor.n <= 0) this.cursor = null;
    } else if (button === 0) {
      const c = this.cursor;
      if (!c) { if (s) { this.cursor = s; this.set(ref, null); } }
      else if (!s) { this.set(ref, c); this.cursor = null; }
      else if (s.id === c.id) {
        const k = Math.min(stackMax(s.id) - s.n, c.n);
        s.n += k; c.n -= k;
        if (!c.n) this.cursor = null;
      } else { this.set(ref, c); this.cursor = s; }
    }
    this.changed();
  }

  // Prendre le résultat (Maj : fabriquer autant que possible, droit dans l'inventaire)
  takeResult(shift) {
    let made = 0;
    for (let guard = 0; guard < 64; guard++) {
      const res = craftResult(this.gridIds(), this.gridN);
      if (!res) break;
      if (shift) {
        if (!this.fits(res.id, res.n)) break;
        this.add(res.id, res.n);
      } else if (!this.cursor) {
        this.cursor = { ...res };
      } else if (this.cursor.id === res.id && this.cursor.n + res.n <= stackMax(res.id)) {
        this.cursor.n += res.n;
      } else break;
      made++;
      for (let i = 0; i < this.gridN * this.gridN; i++) {
        const g = this.grid[i];
        // (les outils de la forge servent sans être consommés)
        if (g && !ITEMS[g.id]?.keep && --g.n <= 0) this.grid[i] = null;
      }
      if (!shift) break;
    }
    if (made) this.ui.onCraft?.();
    this.changed();
  }

  fits(id, n) {
    const max = stackMax(id);
    let room = 0;
    for (const s of this.slots) room += !s ? max : s.id === id ? max - s.n : 0;
    return room >= n;
  }

  // Touche 1..0 sur une case survolée : échange avec la case de la barre
  numberKey(k) {
    if (!this.open || !this.hover) return;
    const s = this.get(this.hover), h = this.slots[k];
    if (this.hover.kind === 'inv' && this.hover.i === k) return;
    // résultat du four : on peut le prendre, pas y poser ; combustible : seulement ce qui brûle
    if (h && (this.hover.kind === 'fout' || (this.hover.kind === 'ffuel' && !FUEL[h.id]))) return;
    this.slots[k] = s;
    this.set(this.hover, h);
    this.changed();
  }

  fill(el, s, size = 48) {
    el.querySelector('canvas')?.remove();
    el.querySelector('b')?.remove();
    el.querySelector('.dur')?.remove();
    el.title = s ? this.ui.name(s.id) : '';
    if (!s) return;
    el.prepend(this.ui.icon(s.id, size));
    if (s.n > 1) {
      const b = document.createElement('b');
      b.textContent = s.n;
      el.appendChild(b);
    }
    wearBar(el, s);
  }

  render() {
    this.invEls.forEach((el, i) => this.fill(el, this.slots[i]));
    if (this.box) {
      if (this.box.type === 'chest') this.chestEls.forEach((el, i) => this.fill(el, this.box.slots[i]));
      else {
        for (const k of ['input', 'fuel', 'output']) this.fill(this.furEls[k], this.box[k], k === 'output' ? 60 : 48);
        this.renderProgress();
      }
    }
    this.gridEls.forEach((el, i) => this.fill(el, this.grid[i]));
    this.fill(this.headEl, this.head);
    const res = craftResult(this.gridIds(), this.gridN);
    this.fill(this.el.out, res, 60);
    this.el.out.classList.toggle('ready', !!res);
    this.el.cursor.innerHTML = '';
    if (this.cursor) {
      const holder = document.createElement('div');
      holder.className = 'slot ghost';
      this.fill(holder, this.cursor, 44);
      this.el.cursor.appendChild(holder);
    }
  }

  // Four : flamme (combustible qui reste) et flèche (cuisson en cours)
  renderProgress() {
    const b = this.box;
    if (!b || b.type !== 'furnace') return;
    this.el.flame.style.height = (b.burnMax ? (b.burn / b.burnMax) * 100 : 0) + '%';
    this.el.arrow.style.width = (b.cook / COOK_TIME) * 100 + '%';
  }

  // ---------- Vie ----------
  buildHud() {
    this.heartsEl = document.getElementById('hearts');
    this.hurtEl = document.getElementById('hurt');
    // chaque cœur : l'image normale, et par-dessus ses versions en feu et gelée (fondu de
    // l'une à l'autre, voir style.css)
    this.heartEls = Array.from({ length: MAX_HEALTH / 2 }, () => {
      const el = document.createElement('span');
      el.className = 'heart';
      const layer = (cls) => { const img = document.createElement('img'); img.alt = ''; img.className = cls; el.appendChild(img); return img; };
      el.base = layer('base');
      el.burning = layer('alt');
      el.frozen = layer('alt');
      this.heartsEl.appendChild(el);
      return el;
    });
    // faim : à droite, en miroir des cœurs
    this.hungerEl = document.getElementById('hunger');
    this.hungerEls = Array.from({ length: MAX_HUNGER / 2 }, () => {
      const img = document.createElement('img');
      img.alt = '';
      this.hungerEl.appendChild(img);
      return img;
    });
  }

  renderHunger() {
    const h = Math.ceil(this.hunger);
    this.hungerEls.forEach((img, i) => {
      const left = h - i * 2, src = left >= 2 ? 'full' : left === 1 ? 'half' : 'empty';
      if (img.dataset.s !== src) { img.src = `texture/interface/faim/${src}.png`; img.dataset.s = src; }
    });
    this.hungerEl.classList.toggle('low', this.hunger <= HUNGER_WALK);
  }

  // Manger : la faim remonte, et la vie un peu (le quart de ce que rend l'aliment)
  eat(food) {
    this.hunger = Math.min(MAX_HUNGER, this.hunger + food);
    this.heal(Math.max(1, Math.round(food / 4)));
    this.renderHunger();
  }
  canEat() { return this.hunger < MAX_HUNGER || this.health < MAX_HEALTH; }
  // Effets de la faim : vitesse de course (1 : normale ... 0 : on ne court plus) et couleurs
  // de la vue (1 : normales ... 0 : noir et blanc)
  sprintFactor() {
    if (!this.on) return 1;
    return Math.max(0, Math.min(1, (this.hunger - HUNGER_WALK) / (HUNGER_SLOW - HUNGER_WALK)));
  }
  colorFactor() {
    if (!this.on || this.dead) return 1;
    return Math.max(0, Math.min(1, this.hunger / HUNGER_GREY));
  }

  // Cœurs en feu ou gelés (style : '', 'burning' ou 'frozen' ; les cœurs vides ne changent pas)
  setHeartStyle(style) {
    if (style === this.heartStyle) return;
    this.heartStyle = style;
    this.renderHearts();
  }

  // Vie rendue (nourriture)
  heal(n) {
    this.health = Math.min(MAX_HEALTH, this.health + n);
    this.renderHearts();
  }

  renderHearts() {
    const set = (img, src) => { if (img.dataset.s !== src) { img.src = `texture/interface/coeurs/${src}.png`; img.dataset.s = src; } };
    this.heartEls.forEach((el, i) => {
      const hp = this.health - i * 2;
      const kind = hp >= 2 ? 'full' : hp === 1 ? 'half' : 'empty';
      set(el.base, kind);
      // (les cœurs vides ne prennent ni feu ni givre)
      for (const style of ['burning', 'frozen']) {
        const on = this.heartStyle === style && kind !== 'empty';
        if (kind !== 'empty') set(el[style], kind + '_' + style);
        el[style].classList.toggle('on', on);
      }
      el.base.classList.toggle('off', !!this.heartStyle && kind !== 'empty');
    });
    this.heartsEl.classList.toggle('low', this.health <= 4);
  }

  // Mode hardcore : les cœurs du hardcore, des dégâts 1,5 fois plus forts
  setHardcore(on) {
    this.hardcore = !!on;
    this.heartsEl.classList.toggle('hardcore', this.hardcore);
  }

  damage(n) {
    if (!this.on || this.dead || n <= 0) return;
    if (this.hardcore) n = Math.ceil(n * HARDCORE_HURT);
    this.health = Math.max(0, this.health - n);
    this.sinceHurt = 0;
    this.regen = 0;
    this.renderHearts();
    this.hurtEl.classList.remove('on');
    void this.hurtEl.offsetWidth; // relance l'animation
    this.hurtEl.classList.add('on');
    this.heartsEl.classList.remove('hit');
    void this.heartsEl.offsetWidth;
    this.heartsEl.classList.add('hit');
    this.ui.onHurt?.(n);
    if (this.health <= 0) {
      this.dead = true;
      this.ui.onDeath();
    }
  }

  respawn() {
    this.health = MAX_HEALTH;
    this.hunger = MAX_HUNGER;
    this.renderHunger();
    this.dead = false;
    this.air = AIR_TIME;
    this.airTop = null;
    this.renderHearts();
  }

  // Explosion : dégâts selon la distance (jusqu'à deux fois le rayon de destruction)
  explosion(center, R, big, player) {
    if (!this.on) return;
    const d = Math.hypot(player.pos.x - center.x, player.pos.y + 0.9 - center.y, player.pos.z - center.z);
    const reach = R * 2;
    if (d >= reach) return;
    this.damage(Math.round((1 - d / reach) * [22, 80, 160, 400][big | 0]));
  }

  // Chutes, noyade, vide, régénération (à chaque image, en jouant)
  update(dt, p) {
    if (!this.on || this.dead) return;
    // chute : on retient le point le plus haut, les dégâts tombent à l'atterrissage
    // (plus de 3 blocs de chute : 1 point par bloc en plus ; l'eau amortit tout)
    // Porté par un objet physique (monté dessus), on ne tombe pas : sinon, monté dans le ciel
    // avec lui, on prenait toute la hauteur en dégâts en retouchant le sol.
    if (p.inWater || p.fly || p.riding || p.attached || p.standingOn) this.airTop = null;
    else if (p.onGround) {
      if (this.airTop !== null) {
        const fall = this.airTop - p.pos.y;
        if (fall > 3.4) this.damage(Math.floor(fall - 3));
      }
      this.airTop = null;
    } else {
      this.airTop = this.airTop === null ? p.pos.y : Math.max(this.airTop, p.pos.y);
    }
    // noyade : 15 s de souffle, puis 1 cœur par seconde
    if (p.headInWater) {
      this.air -= dt;
      if (this.air <= 0) {
        this.drown += dt;
        if (this.drown >= 1) { this.drown = 0; this.damage(2); }
      }
    } else {
      this.air = Math.min(AIR_TIME, this.air + dt * 5);
      this.drown = 0;
    }
    if (p.pos.y < -DEPTH - 20) this.damage(MAX_HEALTH * 10); // tombé dans le vide
    // cactus : un demi-cœur toutes les 0,5 s tant qu'on le touche
    this.prick = Math.max(0, this.prick - dt);
    if (this.prick === 0 && !p.fly && p.touchesBlock(CACTUS)) { this.prick = 0.5; this.damage(1); }
    // lave : 2 cœurs toutes les 0,5 s ; en feu après en être sorti (voir main.js) : un
    // demi-cœur par seconde ; magma sous les pieds : un demi-cœur
    if (this.prick === 0 && p.inLava) { this.prick = 0.5; this.damage(4); }
    if (p.burning && !p.inLava) {
      this.burnTick += dt;
      if (this.burnTick >= 1) { this.burnTick = 0; this.damage(1); }
    } else this.burnTick = 0;
    if (this.prick === 0 && p.onGround && !p.fly && p.standsOn(MAGMA)) { this.prick = 0.5; this.damage(1); }
    // faim : elle baisse avec le temps, plus vite en marchant et surtout en courant
    const moving = Math.hypot(p.vel.x, p.vel.z) > 0.5 && !p.fly;
    const before = Math.ceil(this.hunger);
    this.hunger = Math.max(0, this.hunger - dt * (p.fly ? DRAIN_IDLE : p.sprint && moving ? DRAIN_SPRINT : moving ? DRAIN_WALK : DRAIN_IDLE));
    // régénération lente, 4 s après le dernier coup, si on n'a pas trop faim (elle creuse)
    this.sinceHurt += dt;
    if (this.health < MAX_HEALTH && this.sinceHurt > 4 && this.hunger >= HUNGER_REGEN) {
      this.regen += dt;
      if (this.regen >= 2.5) { this.regen = 0; this.health++; this.hunger = Math.max(0, this.hunger - DRAIN_REGEN); this.renderHearts(); }
    }
    if (Math.ceil(this.hunger) !== before) this.renderHunger();
  }
}
