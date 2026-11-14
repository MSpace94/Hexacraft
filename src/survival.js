// Mode survie (début) : 12 cœurs, inventaire avec quantités, artisanat (grille 2x2 dans
// l'inventaire, 3x3 sur la table de craft), temps de minage selon l'outil tenu et objets
// récupérés en cassant les blocs.
import { METALS, METAL, METAL_BY_ORE, METAL_BY_BLOCK, REINFORCED_CONCRETE, CERAMIC, REINFORCED_GLASS } from './metals.js?v=1.1.5-alpha-mwgq2wrb';
import { ENV_BLOCKS, TOXIC_LOG, TOXIC_PLANKS, TOXIC_LEAVES, TOXIC_LEAVES_PLACED, TOXIC_MUD, TOXIC_SAP, RED_SAND, TERRACOTTA_R, TERRACOTTA_O, TERRACOTTA_Y } from './biomes.js?v=1.1.5-alpha-mwgq2wrb';
import {
  BLOCKS, ITEMS, STICK, COAL, isWater,
  WOODEN_PICKAXE, WOODEN_AXE, WOODEN_SHOVEL, WOODEN_SWORD, WOODEN_HOE,
  PEBBLE, RUSTIC_PICKAXE, RUSTIC_AXE, RUSTIC_SHOVEL, RUSTIC_SWORD, RUSTIC_HOE,
  STONE_PICKAXE, STONE_AXE, STONE_SHOVEL, STONE_SWORD, STONE_HOE,
  SNOW_GRASS, SNOW, CACTUS, SNOWBALL, SNOW_LAYER, isSnowLayer, SNOW_LEAVES, GLASS, TNT_200, TNT_1000, FURNACE, CHEST,
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
} from './blocks.js?v=1.1.5-alpha-mwgq2wrb';
import { SMELT, FUEL, COOK_TIME } from './containers.js?v=1.1.5-alpha-mwgq2wrb';
import { machineAccepts, WORK_TIME } from './industry.js?v=1.1.5-alpha-mwgq2wrb';
import { DEPTH } from './gen.js?v=1.1.5-alpha-mwgq2wrb';
import { HX_LIST } from './traincatalog.js?v=1.1.5-alpha-mwgq2wrb';

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
// Véhicules de la collection (traincatalog.js) : la recette de leur sorte, avec un ingrédient à
// eux (X : sa couleur, son chargement...)
function hxRecipes() {
  const X = {
    carenee: 588, p231: 601, a3: 635, a1: 618, v2: 608, loco19: 614, american: 636, t030: 625, petite: 621, blindee: 595, panzerlok: 627, chibi: 607,
    locotracteur: 615, draisine: 593,
    tender: 587, tender231: 601, tenderCouloir: 635, tenderV2: 608, tender19: 614, tenderUS: 636, tenderPetit: 621, tenderBlinde: 595, tenderPanzer: 627,
    voiture: 618, voitureVerte: 629, lits: 601, restaurant: 506, voitureY: 612, voitureEilzug: 615, voitureDzug: 637, voitureConte: 607, infanterie: 595, fourgon: 554,
    fourgonLuxe: 624, fourgonDzug: 629, fourgonVert: 618, couvert: 637, couvertSable: 627, couvertGs: 623, betail: 613, citerne: 635, conteneur: 625, fusee: 594,
    bache: WOOL_GREY, guerite: 620, ranchers: 483, platAvion: PROPELLER, fourgonSable: 626,
    tremie: WHEAT, wagonCanon: 594, wagonDCA: IRON_BLOCK, tombereauFlak: STEEL, tombereauChar: TUNGSTEN_INGOT, wagonTourelles: 593, flakBois: PLANKS,
  };
  const base = {
    steam: { p: ['SXC', 'FMA', 'RBR'], k: { S: 584, C: 587, F: 589, M: 590, A: 472, R: 586, B: 585 } },
    fuel: { p: ['TXK', 'CAG', 'BLB'], k: { T: 464, K: 471, C: 463, A: 472, G: 470, B: 460, L: 461 } },
    tender: { p: ['KXK', 'PCP', 'BLB'], k: { K: COAL, P: 462, C: CHEST, B: 460, L: 461 } },
    passenger: { p: ['FXF', 'SDS', 'BKB'], k: { F: 500, S: 498, D: 501, B: 460, K: 505 } },
    covered: { p: ['TXT', 'PDP', 'BLB'], k: { T: 464, P: 462, D: 501, B: 460, L: 461 } },
    hopper: { p: ['XTE', 'AHA', 'BLB'], k: { T: 493, E: 497, A: 494, H: 495, B: 460, L: 461 } },
    armored: { p: ['UXU', 'AAA', 'RLR'], k: { U: 593, A: 595, R: 596, L: 461 } },
  };
  return HX_LIST.map((v) => {
    const b = base[v.kind === 'loco' ? v.eng.power : v.kind];
    return { p: b.p, k: { ...b.k, X: X[v.model] }, out: [v.item, 1] };
  });
}
// les produits des nouveaux minerais (voir metals.js) : lingots, cristaux, plaquettes, aimants
const CU = METAL.cuivre.product, AL = METAL.aluminium.product, QZ = METAL.quartz.product, SI = METAL.silicium.product;
const MAG = METAL.magnetite.product, PB = METAL.plomb.product, GA = METAL.gallium.product, TI = METAL.titane.product;
const IR = METAL.iridium.product, GRAV = METAL.gravitite.product;
export const RECIPES = [
  { p: ['L'], k: { L: LOG }, out: [PLANKS, 4] },
  { p: ['P', 'P'], k: { P: PLANKS }, out: [STICK, 4] },
  { p: ['PP', 'PP'], k: { P: PLANKS }, out: [TABLE, 1] },
  { p: ['K', 'S'], k: { K: COAL, S: STICK }, out: [TORCH, 4] },
  { p: ['S', 'C'], k: { S: STICK, C: COBBLE }, out: [79, 1] }, // levier
  { p: ['V', 'L', 'I'], k: { V: VOLTITE, L: 79, I: IRON_INGOT }, out: [4099, 1] }, // levier analogique (16 crans)
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
  { p: ['PAP', '.V.'], k: { P: PLANKS, A: AL, V: VOLTITE }, out: [PROPELLER, 1] }, // (axe en aluminium : léger)
  { p: ['.K.', 'KAK', '.K.'], k: { K: COAL, A: AL }, out: [4121, 2] }, // roues (pneu noir de charbon, jante d'aluminium)
  { p: ['I.I', 'III', 'PPP'], k: { I: IRON_INGOT, P: PLANKS }, out: [4122, 1] }, // volant (siège du conducteur)
  { p: ['V', 'G', 'I'], k: { V: VOLTITE, G: 81, I: IRON_INGOT }, out: [4128, 1] }, // pilote de route (un gravitron qui roule)
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
  { p: ['SSS'], k: { S: SNOW }, out: [SNOW_LAYER, 6] },                     // couches de neige
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
  // électronique : circuit intégré (pistes de cuivre et voltite sur une plaquette de silicium),
  // ordinateur (écran de verre), serveur (une baie de circuits)
  { p: ['CVC', '.S.'], k: { C: CU, V: VOLTITE, S: SI }, out: [CIRCUIT, 3] },
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
  // butoir, panneau de limitation de vitesse, détecteur de train, signal
  { p: ['TBT', 'D.D'], k: { T: 480, B: 483, D: DARK_STEEL }, out: [565, 1] },                    // butoir
  { p: ['P', 'K', 'K'], k: { P: 466, K: STICK }, out: [571, 2] },                                // panneau de limitation
  { p: ['IRI', 'SVS'], k: { I: IRON_INGOT, R: 456, S: STEEL, V: VOLTITE }, out: [577, 2] },      // détecteur de train
  { p: ['L', 'P', 'K'], k: { L: 94, P: 462, K: STICK }, out: [768, 1] },                           // signal ferroviaire
  // appareil photo et papier photo (voir photos.js)
  { p: ['IGI', 'ILI'], k: { I: IRON_INGOT, G: 40, L: 94 }, out: [3942, 1] },                        // appareil photo
  { p: ['WWW', '.C.'], k: { W: 426, C: COAL }, out: [3943, 4] },                                    // papier photo
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
  // composants de locomotive à vapeur (le plus souvent à partir du foyer, du manomètre, des bielles)
  { p: ['MIM'], k: { M: 590, I: IRON_INGOT }, out: [900, 1] },                                     // manomètre double
  { p: ['SBS', '.S.'], k: { S: STEEL, B: 585 }, out: [901, 1] },                                  // piston renforcé
  { p: ['DDD', 'DPD', 'DDD'], k: { D: DARK_STEEL, P: 595 }, out: [902, 1] },                      // plaque de blindage à vapeur
  { p: ['IGI', 'IKI'], k: { I: IRON_INGOT, G: GLASS, K: COAL }, out: [903, 1] },                  // réchauffeur d'eau
  { p: ['.M.', 'SPS'], k: { M: 590, S: STEEL, P: PLATINUM_INGOT }, out: [904, 1] },               // régulateur de pression
  { p: ['S.S', '.D.', 'S.S'], k: { S: STEEL, D: DARK_STEEL }, out: [905, 1] },                    // ressort de suspension
  { p: ['ISI', 'SFS', 'ISI'], k: { I: IRON_INGOT, S: STEEL, F: 589 }, out: [906, 1] },            // surchauffeur
  { p: ['.R.', 'RPR', '.R.'], k: { R: ROPE, P: PLATINUM_INGOT }, out: [907, 2] },                 // joint haute pression
  { p: ['KKK', 'SFS'], k: { K: COAL, S: STEEL, F: 589 }, out: [908, 1] },                         // alimentateur de charbon
  { p: ['WWW', 'SSS'], k: { W: WOOL_WHITE, S: STEEL }, out: [909, 2] },                           // calorifuge
  { p: ['TMT', 'TFT', 'TTT'], k: { T: TUNGSTEN_INGOT, M: 590, F: 589 }, out: [910, 1] },          // chaudière haute pression
  { p: ['DMD', 'DFD', 'DDD'], k: { D: DARK_STEEL, M: 590, F: 589 }, out: [911, 1] },              // chaudière renforcée
  { p: ['S.S', 'S.S', 'SFS'], k: { S: STEEL, F: 589 }, out: [912, 1] },                           // cheminée à double tirage
  { p: ['SAS', 'SBS'], k: { S: STEEL, A: 537, B: IRON_BLOCK }, out: [913, 1] },                   // compresseur d'air
  { p: ['PDP'], k: { P: 901, D: DARK_STEEL }, out: [914, 1] },                                    // cylindre compound
  { p: ['B.B', '.R.', 'B.B'], k: { B: 585, R: 586 }, out: [915, 1] },                             // distribution Walschaerts
  { p: ['P.P', '.S.', 'P.P'], k: { P: PLATINUM_INGOT, S: STEEL }, out: [916, 1] },                // échappement amélioré
  { p: ['RSR'], k: { R: 586, S: STEEL }, out: [917, 1] },                                         // essieu renforcé
  { p: ['D.D', 'DKD', 'D.D'], k: { D: DARK_STEEL, K: COAL }, out: [918, 1] },                     // grille de foyer
  // industrie (voir industry.js) : pièces, réseau électrique, machines, tapis et bras
  { p: ['.I.', 'ISI', '.I.'], k: { I: IRON_INGOT, S: STEEL }, out: [3855, 4] },                   // engrenage
  { p: ['.C.', 'CIC', '.C.'], k: { C: CU, I: IRON_INGOT }, out: [3856, 2] },                     // bobine de cuivre
  { p: ['SSS', 'S.S', 'SFS'], k: { S: STEEL, F: FURNACE }, out: [3800, 1] },                     // chaudière à vapeur
  { p: ['SBS', 'GVG', 'SBS'], k: { S: STEEL, B: 3856, G: 3855, V: VOLTITE }, out: [3802, 1] },    // dynamo à vapeur
  { p: ['PBP', '.G.', '.S.'], k: { P: 462, B: 3856, G: 3855, S: STEEL }, out: [3803, 1] },       // éolienne
  { p: ['PLP', 'LGL', 'PLP'], k: { P: 18, L: 5, G: 3855 }, out: [3804, 1] },                      // roue à aubes
  { p: ['WWW', 'CCC', 'WWW'], k: { W: WOOL_WHITE, C: CU }, out: [3805, 16] },                     // câble haute tension (laine blanche…)
  { p: ['WWW', 'CCC', 'WWW'], k: { W: WOOL_GREY, C: CU }, out: [3805, 16] },                      // (… ou grise)
  { p: ['SBS', 'BMB', 'SBS'], k: { S: STEEL, B: 3856, M: MAG }, out: [3806, 1] },                 // transformateur (noyau d'aimant)
  { p: ['SPS', 'VCV', 'SPS'], k: { S: STEEL, P: PB, V: VOLTITE, C: CIRCUIT }, out: [3807, 1] },    // batterie de stockage (plaques de plomb)
  { p: ['SGS', 'GPG', 'SSS'], k: { S: STEEL, G: 3855, P: PISTON }, out: [3808, 1] },             // concasseur
  { p: ['SB', 'BS'], k: { S: 8, B: 623 }, out: [3811, 4] },                                      // briques réfractaires
  { p: ['BBB', 'BFB', 'BBB'], k: { B: 3811, F: FURNACE }, out: [3809, 1] },                      // haut fourneau
  { p: ['SSS', 'GGG', 'PBP'], k: { S: STEEL, G: 3855, P: 462, B: 3856 }, out: [3812, 1] },        // laminoir
  { p: ['SBS', 'GDG', '.D.'], k: { S: STEEL, B: 3856, G: 3855, D: DARK_STEEL }, out: [3813, 1] }, // foreuse
  { p: ['F'], k: { F: 3813 }, out: [4115, 1] }, // foreuse horizontale (la foreuse couchée)
  { p: ['F'], k: { F: 4115 }, out: [3813, 1] }, // (et redressée)
  { p: ['WWW', 'GSG'], k: { W: WOOL_WHITE, G: 3855, S: STEEL }, out: [3814, 2] },                // tapis roulant (un tapis : jusqu'à 20 cases)
  { p: ['WWW', 'GSG'], k: { W: WOOL_GREY, G: 3855, S: STEEL }, out: [3814, 2] },                 // (laine blanche ou grise)
  { p: ['S', 'I', 'S'], k: { S: STEEL, I: IRON_INGOT }, out: [3831, 8] },                                             // arbre de transmission
  { p: ['.S.', 'GPG', 'SBS'], k: { S: STEEL, G: 3855, P: PISTON, B: 3856 }, out: [3820, 2] },     // bras de transfert
  { p: ['PPP', 'GCG', 'SSS'], k: { P: 18, G: 3855, C: CHEST, S: STEEL }, out: [3826, 1] },        // quai de chargement
  { p: ['L'], k: { L: 3826 }, out: [3827, 1] },                                                   // quai de déchargement
  { p: ['U'], k: { U: 3827 }, out: [3826, 1] },                                                   // (et l'inverse)
  { p: ['SWS', 'WKW', 'SWS'], k: { S: STEEL, W: WOOL_WHITE, K: COAL }, out: [3828, 1] },          // filtre à fumée
  { p: ['B.B', 'B.B', 'B.B'], k: { B: 623 }, out: [3829, 4] },                                    // cheminée d'usine
  // liquides, carburant primaire, nédrolytium (voir industry.js)
  { p: ['CGC'], k: { C: CU, G: GLASS }, out: [3954, 8] },                                        // tuyau (cuivre)
  { p: ['PPP', 'PGP', 'PPP'], k: { P: 462, G: GLASS }, out: [3955, 1] },                          // réservoir industriel
  { p: ['SPS', 'GBG', 'STS'], k: { S: STEEL, P: PISTON, G: 3855, B: 3856, T: 3954 }, out: [3956, 1] }, // pompe à eau
  { p: ['STS', 'FBF', 'SCS'], k: { S: STEEL, T: 3955, F: FURNACE, B: 3856, C: CIRCUIT }, out: [3957, 1] }, // raffinerie
  { p: ['F.F', 'FBF', 'DFD'], k: { F: 3811, B: 3809, D: DARK_STEEL }, out: [3958, 1] },          // creuset à nédrolytium
  { p: ['NTN', 'CBC', 'DRD'], k: { N: 3962, T: 3937, C: 3993, B: 3953, D: DARK_STEEL, R: 3963 }, out: [4098, 1] }, // balise interstellaire (la fin du jeu)
  { p: ['.P.', 'P.P', 'PPP'], k: { P: 462 }, out: [3960, 4] },                                    // bidon vide
  { p: ['CC', 'CC'], k: { C: 3961 }, out: [3959, 1] },                                            // cuve de carburant primaire
  { p: ['C'], k: { C: 3959 }, out: [3961, 4] },                                                   // (et l'inverse)
  { p: ['NNN', 'NNN', 'NNN'], k: { N: 3962 }, out: [3953, 1] },                                   // bloc de nédrolytium
  { p: ['B'], k: { B: 3953 }, out: [3962, 9] },                                                   // (et l'inverse)
  // lot liquides : tuyaux, réservoirs, machines à liquides, groupe électrogène (voir liquids.js)
  { p: ['PTP'], k: { P: 462, T: 3954 }, out: [4214, 4] },                                         // tuyau renforcé
  { p: ['CCC', 'CTC', 'CCC'], k: { C: CU, T: 3955 }, out: [4215, 1] },                            // réservoir en cuivre
  { p: ['TPT', 'PRP', 'TPT'], k: { T: TI, P: 462, R: 4215 }, out: [4216, 1] },                    // réservoir renforcé
  { p: ['S.S', 'SPS', 'SGS'], k: { S: STEEL, P: 3956, G: 3855 }, out: [4217, 1] },                // puits de pétrole
  { p: ['CTC', 'BKB', 'SSS'], k: { C: CU, T: 3955, B: 3856, K: CIRCUIT }, out: [4218, 1] },       // condenseur
  { p: ['SGS', 'TFT', 'SKS'], k: { S: STEEL, G: REINFORCED_GLASS, T: 3955, F: FURNACE, K: CIRCUIT }, out: [4219, 1] }, // chambre de réaction
  { p: ['CPC', 'BTB', 'SKS'], k: { C: CU, P: PLATINUM_INGOT, B: 3856, T: 3955, S: STEEL, K: CIRCUIT }, out: [4220, 1] }, // électrolyseur
  { p: ['STS', 'GHG', 'SBS'], k: { S: STEEL, T: 3955, G: 3855, H: PROPELLER, B: 3856 }, out: [4221, 1] }, // mélangeur
  { p: ['RRR', 'RHR', 'SKS'], k: { R: 3811, H: 3809, S: STEEL, K: CIRCUIT }, out: [4222, 1] },     // four complexe
  { p: ['SPS', 'IKI', 'SSS'], k: { S: STEEL, P: PISTON, I: 462, K: CIRCUIT }, out: [4223, 1] },   // presse hydraulique
  { p: ['CTC', 'CVC', 'SBS'], k: { C: CU, T: 3954, V: 3908, S: STEEL, B: 3856 }, out: [4224, 1] }, // refroidisseur
  { p: ['STS', 'BGB', 'SKS'], k: { S: STEEL, T: 3955, B: 3856, G: 3855, K: CIRCUIT }, out: [4225, 1] }, // groupe électrogène
  // lot liquides : moteurs de fusée, flotteur (voir rocket.js)
  { p: ['TKT', 'RNR', 'T.T'], k: { T: TI, K: CIRCUIT, R: 3955, N: 3964 }, out: [4226, 1] },       // réacteur chimique
  { p: ['AVA', 'KNK', '.I.'], k: { A: GA, V: VOLTITE_BLOCK, K: CIRCUIT, N: 3964, I: IR }, out: [4227, 1] }, // propulseur ionique
  { p: ['TVT', 'FNF', 'TKT'], k: { T: TUNGSTEN_INGOT, V: VOLTITE, F: FLUORITE_INGOT, N: 3985, K: CIRCUIT }, out: [4228, 1] }, // réacteur plasma
  { p: ['ICI', 'PNP', 'D.D'], k: { I: IR, C: CRIMSONITE_INGOT, P: 4228, N: 3962, D: DARK_STEEL }, out: [4229, 1] }, // tuyère stellaire
  { p: ['AAA', 'A.A', 'AAA'], k: { A: AL }, out: [4230, 4] },                                     // flotteur (creux, en aluminium)
  // étanchéité : portes, soudure (voir doors.js)
  { p: ['SGS', 'SPS', 'SGS'], k: { S: STEEL, G: REINFORCED_GLASS, P: PISTON }, out: [4244, 2] },  // sas
  { p: ['PP', 'PG', 'PP'], k: { P: 462, G: REINFORCED_GLASS }, out: [4246, 1] },                 // porte étanche (2 de haut)
  { p: ['SBS', 'SPS', 'SBS'], k: { S: STEEL, B: 3856, P: PISTON }, out: [4250, 2] },             // porte électrique
  { p: ['SVS', 'QKQ', 'SVS'], k: { S: STEEL, V: VOLTITE, Q: QZ, K: CIRCUIT }, out: [4252, 2] },   // porte holographique (quartz)
  { p: ['SPS', 'STS', 'SPS'], k: { S: STEEL, P: PISTON, T: 3954 }, out: [4254, 4] },             // porte hydraulique
  { p: ['..C', '.B.', 'S..'], k: { C: CU, B: 3856, S: STEEL }, out: [4256, 1] },                 // soudure de joint
  // mécanique (voir structs.js, blocs mécaniques)
  { p: ['S.S', 'SGS'], k: { S: STEEL, G: 3855 }, out: [4257, 2] },                               // charnière
  { p: ['SGS', 'GBG', 'SGS'], k: { S: STEEL, G: 3855, B: 3856 }, out: [4259, 1] },               // rotor
  { p: ['SGS', 'BKB', 'SSS'], k: { S: STEEL, G: 3855, B: 3856, K: CIRCUIT }, out: [4261, 1] },   // servomoteur
  { p: ['SGS', 'SPS', 'SGS'], k: { S: STEEL, G: 3855, P: PISTON }, out: [4263, 2] },             // rail de translation
  { p: ['TVT', 'GKG', 'TVT'], k: { T: TI, V: VOLTITE_BLOCK, G: GRAV, K: CIRCUIT }, out: [4265, 1] }, // accentueur inertiel (gravitite)
  { p: ['TGT', 'VKV', 'TGT'], k: { T: TI, V: VOLTITE, G: GRAV, K: CIRCUIT }, out: [4267, 1] },   // nullifieur inertiel
  { p: ['.S.', 'SPS', 'D.D'], k: { S: STEEL, P: PISTON, D: DARK_STEEL }, out: [4269, 2] },       // train d'atterrissage
  // armes à main, munitions (voir weapons.js) ; uranium : METAL.uranite (raffiné 4173, bloc 4161)
  { p: ['SSS', 'PI.'], k: { S: STEEL, P: PLANKS, I: IRON_INGOT }, out: [4270, 1] },                // pistolet
  { p: ['SSS', 'PPK'], k: { S: STEEL, P: PLANKS, K: CIRCUIT }, out: [4271, 1] },                   // fusil
  { p: ['MMM', 'CVC', 'TTT'], k: { M: MAG, C: CU, V: VOLTITE_BLOCK, T: TI }, out: [4272, 1] },     // railgun (aimants)
  { p: ['QVQ', 'TKT', 'T..'], k: { Q: QZ, V: VOLTITE, T: TI, K: CIRCUIT }, out: [4273, 1] },       // arme à énergie
  { p: ['.SS', 'CS.'], k: { S: STEEL, C: 3960 }, out: [4274, 1] },                                 // lance-flammes (un bidon)
  { p: ['P', 'C', 'K'], k: { P: PB, C: CU, K: COAL }, out: [4275, 16] },                           // balles (plomb, douille de cuivre)
  { p: ['U', 'C', 'K'], k: { U: 4173, C: CU, K: COAL }, out: [4276, 8] },                          // balles en uranium appauvri
  { p: ['T', 'T', 'M'], k: { T: TI, M: MAG }, out: [4277, 4] },                                    // tiges de railgun
  { p: ['QVQ', 'CVC'], k: { Q: QZ, V: VOLTITE, C: CU }, out: [4278, 2] },                          // cellules d'énergie
  { p: ['.S.', 'STS', 'S.S'], k: { S: STEEL, T: 26 }, out: [4279, 2] },                            // roquettes (TNT)
  { p: ['.K.', 'ATA', 'A.A'], k: { K: CIRCUIT, A: AL, T: 27 }, out: [4280, 2] },                   // missiles (Big TNT)
  { p: ['PTS'], k: { P: PISTON, T: 27, S: STEEL }, out: [4281, 1] },                               // torpille
  { p: ['D', 'T', 'D'], k: { D: DARK_STEEL, T: 27 }, out: [4282, 2] },                             // obus lourds
  { p: ['UNU', 'NTN', 'UNU'], k: { U: 4161, N: 3962, T: TNT_1000 }, out: [4283, 1] },              // charge nucléaire (très chère)
  // armes en blocs, chambre de chargement, accumulateur, boucliers
  { p: ['DDD', 'SKS', 'SPS'], k: { D: DARK_STEEL, S: STEEL, K: CIRCUIT, P: PISTON }, out: [4284, 1] }, // canon automatique
  { p: ['SSS', 'TKT', 'SSS'], k: { S: STEEL, T: TI, K: CIRCUIT }, out: [4285, 1] },                // lance-roquettes
  { p: ['AKA', 'AKA', 'TTT'], k: { A: AL, K: CIRCUIT, T: TI }, out: [4286, 1] },                   // lance-missiles
  { p: ['SSS', 'PKP', 'SSS'], k: { S: STEEL, P: PISTON, K: CIRCUIT }, out: [4287, 1] },            // lance-torpilles
  { p: ['MCM', 'MVM', 'TTT'], k: { M: MAG, C: CU, V: VOLTITE_BLOCK, T: TI }, out: [4288, 1] },     // canon à bobine
  { p: ['DDD', 'DID', 'RRR'], k: { D: DARK_STEEL, I: IRON_BLOCK, R: REINFORCED_CONCRETE }, out: [4289, 1] }, // canon Gustave
  { p: ['.D.', 'DSD', 'SPS'], k: { D: DARK_STEEL, S: STEEL, P: PISTON }, out: [4296, 1] },         // canon d'artillerie
  { p: ['.A.', 'SKS', 'DMD'], k: { A: 4284, S: STEEL, K: CIRCUIT, D: DARK_STEEL, M: PISTON }, out: [4300, 1] }, // tourelle à balles (un canon automatique)
  { p: ['.A.', 'SKS', 'DMD'], k: { A: 4286, S: STEEL, K: CIRCUIT, D: DARK_STEEL, M: PISTON }, out: [4301, 1] }, // tourelle lance-missiles
  { p: ['QVQ', 'SKS', 'DMD'], k: { Q: QZ, V: VOLTITE_BLOCK, S: STEEL, K: CIRCUIT, D: DARK_STEEL, M: PISTON }, out: [4302, 1] }, // tourelle laser
  { p: ['DDD', 'DCD', 'DDD'], k: { D: DARK_STEEL, C: CHEST }, out: [4290, 1] },                    // chambre de chargement
  { p: ['CBC', 'BVB', 'CBC'], k: { C: CU, B: 3807, V: VOLTITE_BLOCK }, out: [4291, 1] },           // accumulateur électrique
  { p: ['QVQ', 'VKV', 'TTT'], k: { Q: QZ, V: VOLTITE_BLOCK, K: CIRCUIT, T: TI }, out: [4292, 1] }, // émetteur de bouclier
  { p: ['.Q.', 'TKT', 'TVT'], k: { Q: QZ, T: TI, K: CIRCUIT, V: VOLTITE }, out: [4293, 1] },       // déflecteur
  { p: ['ECE', 'EKE', 'TTT'], k: { E: CERAMIC, C: CU, K: CIRCUIT, T: TI }, out: [4294, 1] },       // projecteur de bouclier thermique
  { p: ['IGI', 'GNG', 'IGI'], k: { I: IR, G: GRAV, N: 3962 }, out: [4295, 1] },                     // générateur de bouclier stellaire
  // fusées (voir rocket.js)
  { p: ['DND', 'CVC', 'DID'], k: { D: DARK_STEEL, N: 3962, C: CIRCUIT, V: VOLTITE_BLOCK, I: IR }, out: [3963, 1] }, // réacteur au nédrolytium (tuyère d'iridium)
  { p: ['.T.', 'TST', 'T.T'], k: { T: TUNGSTEN_INGOT, S: STEEL }, out: [3964, 1] },               // tuyère
  { p: ['SPS', 'PTP', 'SPS'], k: { S: STEEL, P: PLATINUM_INGOT, T: 3955 }, out: [3965, 1] },       // réservoir de fusée
  { p: ['TPT', 'RDR', 'TPT'], k: { T: TI, P: PLATINUM_INGOT, R: 3965, D: DARK_STEEL }, out: [3984, 1] }, // réservoir de fusée avancé (titane)
  { p: ['TCT', 'SNS', 'T.T'], k: { T: TUNGSTEN_INGOT, C: CIRCUIT, S: STEEL, N: 3964 }, out: [3985, 1] }, // réacteur classique
  { p: ['SGS', 'CVC', 'SSS'], k: { S: STEEL, G: GLASS, C: CIRCUIT, V: VOLTITE }, out: [3966, 1] }, // poste de pilotage
  { p: ['S.S', 'SWS'], k: { S: STEEL, W: WOOL_WHITE }, out: [3996, 1] },                            // siège passager
  { p: ['S.S', 'SWS'], k: { S: STEEL, W: WOOL_GREY }, out: [3996, 1] },                             // (laine blanche ou grise)
  // stations et vaisseaux automatisés (voir orbital.js)
  { p: ['DND', 'CVC', 'DND'], k: { D: DARK_STEEL, N: 3953, C: CIRCUIT, V: VOLTITE }, out: [3986, 1] }, // noyau de station
  { p: ['SGS', 'WCW', 'SPS'], k: { S: STEEL, G: GLASS, W: WOOL_WHITE, C: CIRCUIT, P: 3954 }, out: [3987, 1] }, // générateur d'oxygène
  { p: ['DTD', 'CVC', 'DTD'], k: { D: DARK_STEEL, T: GRAV, C: CIRCUIT, V: VOLTITE_BLOCK }, out: [3988, 1] }, // générateur de gravité (gravitite)
  { p: ['GGG', 'AWA', 'SCS'], k: { G: GLASS, A: GA, W: SI, S: STEEL, C: CIRCUIT }, out: [3989, 2] }, // panneau solaire (cellules de gallium et silicium)
  { p: ['A.A', 'PCP', 'A.A'], k: { A: AL, P: 3954, C: CIRCUIT }, out: [3990, 2] }, // port d'amarrage (aluminium)
  { p: ['DDD', 'D.D', 'DDD'], k: { D: 462 }, out: [3991, 1] },                                    // entrepôt orbital
  { p: ['.T.', 'SCS', 'SNS'], k: { T: TUNGSTEN_INGOT, S: STEEL, C: CIRCUIT, N: 3964 }, out: [3992, 1] }, // lanceur de cargo
  { p: ['CGC', 'CVC', 'SSS'], k: { C: CIRCUIT, G: GLASS, V: VOLTITE, S: STEEL }, out: [3993, 1] }, // ordinateur de bord
  { p: ['S.S', 'SCS', 'SSS'], k: { S: STEEL, C: CIRCUIT }, out: [3994, 1] },                      // baie de drones
  { p: ['.C.', 'TNT', '.P.'], k: { C: CIRCUIT, T: TUNGSTEN_INGOT, N: 3964, P: PLATINUM_INGOT }, out: [3995, 1] }, // drone de minage
  { p: ['.S.', '.S.', 'DSD'], k: { S: STEEL, D: DARK_STEEL }, out: [3967, 2] },                    // pied d'atterrissage
  { p: ['WWW', 'WGW'], k: { W: WOOL_WHITE, G: REINFORCED_GLASS }, out: [3968, 1] },                // casque spatial (visière en verre renforcé)
  // automatisation (voir industry.js)
  { p: ['I.I', 'IBI', '.I.'], k: { I: IRON_INGOT, B: 3856 }, out: [3896, 2] },                     // entonnoir électrique
  { p: ['F'], k: { F: 3896 }, out: [3902, 1] },                                                   // extracteur électrique
  { p: ['X'], k: { X: 3902 }, out: [3896, 1] },                                                   // (et l'inverse)
  { p: ['SPS', 'GBG', 'SSS'], k: { S: STEEL, P: PROPELLER, G: 3855, B: 3856 }, out: [3908, 1] },   // ventilateur électrique
  { p: ['SBS', 'GPG', '.I.'], k: { S: STEEL, B: 3856, G: 3855, P: PISTON, I: IRON_BLOCK }, out: [3914, 1] }, // presse électrique
  { p: ['SBS', 'G.G', '.I.'], k: { S: STEEL, B: 3856, G: 3855, I: IRON_INGOT }, out: [3915, 1] },  // scie électrique
  { p: ['GTG', 'BCB', 'SSS'], k: { G: 3855, T: 31, B: 3856, C: CHEST, S: STEEL }, out: [3916, 1] }, // assembleur
  { p: ['.S.', 'SGS', '.S.'], k: { S: STEEL, G: 3855 }, out: [3922, 2] },                          // répartiteur
  // nouveaux matériaux (voir metals.js) : verre renforcé (quartz), béton armé, céramique
  { p: ['GQG'], k: { G: GLASS, Q: QZ }, out: [REINFORCED_GLASS, 3] },
  { p: ['GSG', 'SIS', 'GSG'], k: { G: GRAVEL, S: SAND, I: IRON_INGOT }, out: [REINFORCED_CONCRETE, 8] },
  { p: ['AQ', 'QA'], k: { A: 603, Q: QZ }, out: [CERAMIC, 4] },
  // les blocs des nouveaux biomes (voir biomes.js) : planches toxiques, terre cuite de couleur
  // (argile et sable rouge, comme dans la mesa)
  { p: ['L'], k: { L: TOXIC_LOG }, out: [TOXIC_PLANKS, 4] },
  { p: ['AS', 'SA'], k: { A: 603, S: RED_SAND }, out: [TERRACOTTA_R, 4] },
  { p: ['R', 'S'], k: { R: TERRACOTTA_R, S: SAND }, out: [TERRACOTTA_O, 1] },
  { p: ['O', 'S'], k: { O: TERRACOTTA_O, S: SAND }, out: [TERRACOTTA_Y, 1] },
  // les blocs des nouveaux minerais : 9 lingots (cristaux…) <-> un bloc
  ...METALS.flatMap((m) => [
    { p: ['III', 'III', 'III'], k: { I: m.product }, out: [m.block, 1] },
    { p: ['B'], k: { B: m.block }, out: [m.product, 9] },
  ]),
  // idées des joueurs
  { p: ['WWW', 'MMM'], k: { W: 426, M: MAGMA }, out: [3923, 1] },                                 // gâteau chauffant
  { p: ['L', 'L'], k: { L: 5 }, out: [3924, 4] },                                                  // poteaux (chêne, bouleau, châtaignier, tilleul, pierre, fer)
  { p: ['L', 'L'], k: { L: 256 }, out: [3925, 4] },
  { p: ['L', 'L'], k: { L: CHESTNUT_LOG }, out: [3926, 4] },
  { p: ['L', 'L'], k: { L: LINDEN_LOG }, out: [3927, 4] },
  { p: ['C', 'C'], k: { C: 28 }, out: [3928, 4] },
  { p: ['I', 'I'], k: { I: IRON_INGOT }, out: [3929, 4] },
  { p: ['SSS', '.I.', 'SSS'], k: { S: STEEL, I: IRON_INGOT }, out: [3930, 2] },                   // ressort
  { p: ['G', 'P'], k: { G: GLUE, P: PISTON }, out: [3931, 1] },                                    // piston agrippant
  { p: ['.V.', 'ICI', 'III'], k: { V: VOLTITE, I: IRON_INGOT, C: CIRCUIT }, out: [3937, 1] },      // émetteur de voltite
  { p: ['.I.', 'ICI', 'IVI'], k: { V: VOLTITE, I: IRON_INGOT, C: CIRCUIT }, out: [3938, 1] },      // récepteur de voltite
  { p: ['WWW', 'WCW', 'WWW'], k: { W: WOOL_WHITE, C: CIRCUIT }, out: [3940, 1] },                  // schématique
  { p: ['SRS', 'GPG', 'SSS'], k: { S: STEEL, R: 17, G: 3855, P: PISTON }, out: [3941, 1] },        // assembleur de chariot
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
  // briques de couleur : 8 briques rouges autour d'un colorant, ou deux couleurs mêlées
  ...[[726, 600], [732, 69], [737, COAL], [733, 70], [736, 2], [740, 645], [743, LEAVES], [728, 328], [741, 635], [744, 644], [725, SAND]]
    .map(([out, x]) => ({ p: ['RRR', 'RXR', 'RRR'], k: { R: 623, X: x }, out: [out, 8] })),
  ...[[727, 728, 726], [731, 732, 726], [739, 740, 726], [738, 740, 733], [742, 743, 726], [730, 728, 743], [734, 744, 739], [735, 728, 737], [729, 740, 737]]
    .map(([out, a, b]) => ({ p: ['AB'], k: { A: a, B: b }, out: [out, 2] })),
  { p: ['BB', 'BB'], k: { B: BASALT }, out: [745, 4] },                                  // ardoise
  { p: ['SG', 'GS'], k: { S: SAND, G: GRAVEL }, out: [746, 4] },                         // béton gris
  { p: ['GG'], k: { G: 627 }, out: [747, 2] },                                           // grès taillé
  { p: ['CS', 'SC'], k: { C: COBBLE, S: 3 }, out: [748, 4] },                            // pavés
  { p: ['.C.', 'CCC'], k: { C: 603 }, out: [749, 4] },                                   // tuiles de terre cuite
  // wagon couvert, wagon blindé et leurs pièces
  { p: ['TTT', 'PDP', 'BLB'], k: { T: 464, P: 462, D: 501, B: 460, L: 461 }, out: [591, 1] },   // wagon couvert
  { p: ['I.I', 'III', 'BLB'], k: { I: IRON_INGOT, B: 460, L: 461 }, out: [663, 1] },             // wagonnet de mine
  { p: ['III', 'ILI'], k: { I: IRON_INGOT, L: 94 }, out: [664, 1] },                            // lampe de casque
  { p: ['DLD', 'DLD'], k: { D: DARK_STEEL, L: LEAVES }, out: [595, 2] },                         // plaque de blindage
  { p: ['B', 'D', 'B'], k: { B: 460, D: DARK_STEEL }, out: [596, 1] },                           // bogie renforcé
  { p: ['.AS', 'AAS', 'AA.'], k: { A: 595, S: STEEL }, out: [593, 1] },                          // tourelle
  { p: ['I', 'T', 'P'], k: { I: IRON_INGOT, T: TNT, P: PLATINUM_INGOT }, out: [594, 4] },        // obus
  { p: ['UAU', 'AAA', 'RLR'], k: { U: 593, A: 595, R: 596, L: 461 }, out: [592, 1] },            // wagon blindé
  ...hxRecipes(),
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
  23: 'instant', 24: 'instant', 25: 'instant', 26: 'instant', 234: 'instant', 235: 'instant', 236: 'instant', 237: 'instant', 238: 'instant', 239: 'instant', 27: 'instant', 79: 'instant', 80: 'instant', ...Object.fromEntries(Array.from({ length: 16 }, (_, k) => [4099 + k, 'instant'])),
  [GLASS]: 'glass', [TNT_200]: 'instant', [TNT_1000]: 'instant',
  [IRON_ORE]: 'stone', [VOLTITE_ORE]: 'stone', [IRON_BLOCK]: 'stone', [VOLTITE_BLOCK]: 'stone',
  [WIRE]: 'instant', [WIRE_ON]: 'instant', [IWIRE]: 'instant', [IWIRE_ON]: 'instant',
  [PLATINUM_ORE]: 'stone', [PLATINUM_BLOCK]: 'stone', [TUNGSTEN_ORE]: 'hard', [TUNGSTEN_BLOCK]: 'hard', [FLUORITE_ORE]: 'stone', [FLUORITE_BLOCK]: 'stone', [CRIMSONITE_ORE]: 'hard', [CRIMSONITE_BLOCK]: 'hard', [IMPURE_VOLTITE_ORE]: 'stone', [PHYSICS]: 'wood', [PHYSICS_ON]: 'wood', [PROPELLER]: 'wood', [PROPELLER_ON]: 'wood', [STABILIZER]: 'stone', [STABILIZER_ON]: 'stone', 81: 'stone',
  194: 'wool', 195: 'wool', [TARGET]: 'wool', [GRAVEL]: 'dirt', [STEEL]: 'stone', [DARK_STEEL]: 'stone', [OLD_STEEL]: 'stone', 196: 'instant',
  [BASALT]: 'stone', [SULFUR]: 'stone', [TUFF]: 'stone', [MAGMA]: 'stone', [ASH]: 'dirt', [OBSIDIAN]: 'obsidian',
};
// nouveaux minerais et leurs blocs, nouveaux matériaux (voir metals.js)
for (const m of METALS) MATTER_OF[m.ore] = MATTER_OF[m.block] = m.hard;
MATTER_OF[REINFORCED_CONCRETE] = 'hard'; MATTER_OF[CERAMIC] = 'stone'; MATTER_OF[REINFORCED_GLASS] = 'stone';
// roches, sables et glaces des autres planètes (3969 à 3982, voir blocks.js)
{
  const M = { 3969: 'dirt', 3970: 'stone', 3971: 'dirt', 3972: 'stone', 3973: 'stone', 3974: 'stone', 3975: 'dirt', 3976: 'dirt', 3977: 'stone', 3978: 'stone', 3979: 'dirt', 3980: 'stone', 3981: 'stone', 3982: 'stone', 3997: 'dirt', 3998: 'dirt', 3999: 'dirt', 4082: 'dirt', 4083: 'dirt',
    4084: 'stone', 4085: 'stone', 4086: 'stone', 4087: 'stone', 4088: 'stone', 4089: 'stone', 4090: 'stone', 4091: 'dirt', 4092: 'dirt', 4093: 'stone', 4094: 'dirt', 4095: 'stone', 4098: 'stone' };
  Object.assign(MATTER_OF, M);
}
// blocs de décoration : leur matière (voir DECOR dans blocks.js)
for (const [id, , , m] of DECOR) MATTER_OF[id] = m;
// blocs des nouveaux biomes (voir biomes.js)
for (const [id, , , m] of ENV_BLOCKS) MATTER_OF[id] = m;
for (let n = 0; n < 8; n++) MATTER_OF[SNOW_LAYER + n] = 'snow'; // couches de neige
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
for (const [id, , , m] of DECOR) if (m === 'stone' || m === 'hard') NEEDS_PICKAXE.add(id);
for (const [id, , , m] of ENV_BLOCKS) if (m === 'stone' || m === 'hard') NEEDS_PICKAXE.add(id);
for (const m of METALS) { NEEDS_PICKAXE.add(m.ore); NEEDS_PICKAXE.add(m.block); }
NEEDS_PICKAXE.add(REINFORCED_CONCRETE); NEEDS_PICKAXE.add(CERAMIC); NEEDS_PICKAXE.add(REINFORCED_GLASS);
for (const id of [3970, 3972, 3974, 3977, 3978, 3980, 3981]) NEEDS_PICKAXE.add(id); // (roches des planètes) // (décoration en pierre)
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
  if (BLOCKS[id].photo) return null; // (la photo accrochée revient avec son numéro, voir breakBlock dans main.js)
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
  // nouveaux minerais (voir metals.js) : la bonne pioche, puis le minerai (à fondre) ou ses
  // cristaux ; leurs blocs : la même pioche
  const mo = METAL_BY_ORE[id], mb = METAL_BY_BLOCK[id];
  if (mo) return it.tier >= mo.tier ? (mo.gem ? [mo.product, mo.gem[0] + Math.floor(Math.random() * (mo.gem[1] - mo.gem[0] + 1))] : [id, 1]) : null;
  if (mb) return it.tier >= mb.tier ? [id, 1] : null;
  if (id === FLUORITE_ORE || id === FLUORITE_BLOCK) return it.tier >= 4 ? [id, 1] : null;
  if (id === PLATINUM_ORE || id === PLATINUM_BLOCK) return it.tier >= 5 ? [id, 1] : null;
  if (id === TUNGSTEN_ORE || id === TUNGSTEN_BLOCK) return it.tier >= 6 ? [id, 1] : null;
  if (id === CRIMSONITE_ORE || id === CRIMSONITE_BLOCK) return it.tier >= 7 ? [id, 1] : null;
  if (id === SNOW_GRASS) return [2, 1]; // herbe enneigée -> terre
  // neige : 4 boules de neige à la pelle, une seule à la main
  if (id === SNOW) return [SNOWBALL, it?.tool === 'shovel' ? 4 : 1];
  // couche de neige : une boule par épaisseur à la pelle, une seule à la main
  if (isSnowLayer(id)) return [SNOWBALL, it?.tool === 'shovel' ? BLOCKS[id].layer : 1];
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
  // feuilles toxiques : parfois un bâton (pas de pousse : l'arbre toxique ne se replante pas)
  if (id === TOXIC_LEAVES || id === TOXIC_LEAVES_PLACED) return Math.random() < 0.12 ? [STICK, 1] : null;
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
    // livre de recettes (rempli à la première ouverture : voir buildBook)
    this.el.book = document.getElementById('recipe-book');
    this.el.bookList = document.getElementById('recipe-list');
    this.el.bookSearch = document.getElementById('recipe-search');
    this.el.bookSearch.addEventListener('input', () => this.renderBook());
    this.book = null;
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
    this.boxKind = null;
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
    this.el.book.hidden = false;
    this.buildBook();
    this.render();
  }

  // Coffre, four ou machine : box = son contenu (voir containers.js) ; info : { title, kind } d'une
  // machine (voir industry.js)
  openBox(box, info = null) {
    this.box = box;
    this.boxKind = info?.kind || null;
    this.gridN = 0;
    this.grid.fill(null);
    this.cursor = null;
    this.open = true;
    this.el.title.textContent = info?.title || (box.type === 'chest' ? 'Coffre' : 'Four');
    this.el.equip.hidden = true;
    this.el.book.hidden = true;
    this.showBox(box.type);
    this.render();
  }

  showBox(type) {
    this.el.craft.hidden = !!type;
    this.el.chest.hidden = type !== 'chest';
    this.el.furnace.hidden = type !== 'furnace' && type !== 'machine';
    // (machine électrique : pas de combustible, la flamme montre le courant reçu)
    const fuel = type !== 'machine' || this.boxKind === 'boiler' || this.boxKind === 'blast';
    this.furEls.fuel.hidden = !fuel;
    this.el.furnace.classList.toggle('powered', !fuel);
    this.furEls.input.hidden = this.boxKind === 'boiler' || this.boxKind === 'drill';
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
    if (this.box.type === 'machine') {
      if (machineAccepts(this.boxKind, s.id, false)) return this.putIn({ kind: 'fin' }, s.id, s.n, s.w);
      if (machineAccepts(this.boxKind, s.id, true)) return this.putIn({ kind: 'ffuel' }, s.id, s.n, s.w);
      return s.n;
    }
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
    // (une machine ne prend que ce qu'elle sait travailler)
    if (ref.kind === 'fin' && this.cursor && this.box?.type === 'machine' && !machineAccepts(this.boxKind, this.cursor.id, false)) return;
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

  // ---------- Livre de recettes (craft rapide) ----------
  // Une case par recette : ce qu'on peut fabriquer avec son inventaire d'abord (les autres grisées)
  buildBook() {
    if (this.book) return;
    this.book = [];
    const seen = new Set();
    for (const rec of RECIPES) {
      const [id, n] = rec.out;
      const name = this.ui.name(id);
      if (!name) continue;
      const f = rec.forms[0], need = new Map();
      for (const row of f) for (const x of row) if (x) need.set(x, (need.get(x) || 0) + 1);
      // (la même recette déclarée deux fois : une seule case)
      const sig = id + ':' + [...need].sort((a, b) => a[0] - b[0]).join(';') + ':' + f.length + 'x' + f[0].length;
      if (seen.has(sig)) continue;
      seen.add(sig);
      const el = document.createElement('div');
      el.className = 'rb-item';
      el.appendChild(this.ui.icon(id, 36));
      if (n > 1) { const b = document.createElement('b'); b.textContent = n; el.appendChild(b); }
      el.title = name + (n > 1 ? ' ×' + n : '') + '\n' + [...need].map(([x, k]) => k + ' ' + this.ui.name(x)).join(' + ');
      const e = { rec, el, need, big: f.length > 2 || f[0].length > 2, search: name.toLowerCase() };
      el.addEventListener('mousedown', (ev) => { ev.preventDefault(); if (ev.button === 0) this.fillRecipe(e, ev.shiftKey); });
      // (tactile : un toucher remplit, un double toucher fabrique tout)
      let last = 0;
      el.addEventListener('touchend', (ev) => {
        ev.preventDefault();
        const now = performance.now();
        if (now - last < 320) { last = 0; this.fillRecipe(e, true); } else { last = now; this.fillRecipe(e, false); }
      }, { passive: false });
      this.el.bookList.appendChild(el);
      this.book.push(e);
    }
  }

  // Combien d'objets id dans l'inventaire
  countOf(id) {
    let n = 0;
    for (const s of this.slots) if (s && s.id === id) n += s.n;
    return n;
  }

  // Peut-on faire cette recette avec l'inventaire (et ce qu'il y a déjà dans la grille) ?
  canMake(e) {
    for (const [id, k] of e.need) {
      let n = this.countOf(id);
      for (let i = 0; i < 9; i++) if (this.grid[i]?.id === id) n += this.grid[i].n;
      if (n < k) return false;
    }
    return true;
  }

  // Met la recette dans la grille (all : autant de fois que possible, et fabrique tout d'un coup)
  fillRecipe(e, all) {
    const n = this.gridN, f = e.rec.forms[0];
    if (!n || this.box) return;
    if (f.length > n || f[0].length > n) return;
    // ce qui est déjà dans la grille retourne dans l'inventaire
    for (let i = 0; i < 9; i++) {
      const g = this.grid[i];
      if (!g) continue;
      const left = this.add(g.id, g.n, 0, INV_SIZE, g.w);
      this.grid[i] = left ? makeSlot(g.id, left, g.w) : null;
    }
    if (this.grid.some(Boolean)) { this.changed(); return; } // (inventaire plein)
    // combien de fois (les outils de la forge ne s'usent pas : un seul suffit)
    let times = all ? 64 : 1;
    for (const [id, k] of e.need) {
      if (ITEMS[id]?.keep) { if (this.countOf(id) < k) times = 0; continue; }
      times = Math.min(times, Math.floor(this.countOf(id) / k), stackMax(id));
    }
    if (times <= 0) { this.changed(); return; }
    for (let r = 0; r < f.length; r++) {
      for (let c = 0; c < f[r].length; c++) {
        const id = f[r][c];
        if (!id) continue;
        const want = ITEMS[id]?.keep ? 1 : times, w = this.takeOut(id, want);
        this.grid[r * n + c] = makeSlot(id, want, w);
      }
    }
    if (all) this.takeResult(true);
    else this.changed();
  }

  // Retire k objets id de l'inventaire (le sac d'abord, la barre ensuite) ; renvoie l'usure du premier
  takeOut(id, k) {
    let w = 0, first = true;
    const order = [];
    for (let i = HOTBAR_SLOTS; i < INV_SIZE; i++) order.push(i);
    for (let i = 0; i < HOTBAR_SLOTS; i++) order.push(i);
    for (const i of order) {
      const s = this.slots[i];
      if (!s || s.id !== id || k <= 0) continue;
      if (first) { w = s.w || 0; first = false; }
      const t = Math.min(k, s.n);
      s.n -= t; k -= t;
      if (s.n <= 0) this.slots[i] = null;
    }
    return w;
  }

  // Les cases du livre : faisables d'abord, filtrées par la recherche (et en 2x2 : sans les grandes)
  renderBook() {
    if (!this.book || this.el.book.hidden) return;
    const q = this.el.bookSearch.value.trim().toLowerCase();
    for (const e of this.book) {
      const show = (!e.big || this.gridN === 3) && (!q || e.search.includes(q));
      e.el.hidden = !show;
      if (!show) continue;
      const can = this.canMake(e);
      e.el.classList.toggle('can', can);
      e.el.style.order = can ? 0 : 1;
    }
  }

  render() {
    this.invEls.forEach((el, i) => this.fill(el, this.slots[i]));
    if (!this.box && this.gridN) this.renderBook();
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
    if (!b || (b.type !== 'furnace' && b.type !== 'machine')) return;
    const powered = b.type === 'machine' && this.boxKind !== 'boiler' && this.boxKind !== 'blast';
    this.el.flame.style.height = (powered ? (b.rate || 0) * 100 : b.burnMax ? (b.burn / b.burnMax) * 100 : 0) + '%';
    const work = b.type === 'machine' ? WORK_TIME[this.boxKind] || 1 : COOK_TIME;
    this.el.arrow.style.width = (this.boxKind === 'boiler' ? 0 : Math.min(1, b.cook / work) * 100) + '%';
  }

  // ---------- Vie ----------
  buildHud() {
    this.heartsEl = document.getElementById('hearts');
    this.hurtEl = document.getElementById('hurt');
    // une graduation par cœur, une par cuisse (voir style.css)
    const cells = (parent, n, cls) => Array.from({ length: n }, () => {
      const el = document.createElement('i');
      el.className = cls;
      parent.appendChild(el);
      return el;
    });
    this.heartEls = cells(this.heartsEl, MAX_HEALTH / 2, 'heart');
    this.hungerEl = document.getElementById('hunger');
    this.hungerEls = cells(this.hungerEl, MAX_HUNGER / 2, 'food');
  }

  renderHunger() {
    const h = Math.ceil(this.hunger);
    this.hungerEls.forEach((el, i) => {
      const left = h - i * 2;
      el.dataset.k = left >= 2 ? 'full' : left === 1 ? 'half' : 'empty';
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
    this.heartEls.forEach((el, i) => {
      const hp = this.health - i * 2;
      el.dataset.k = hp >= 2 ? 'full' : hp >= 1 ? 'half' : 'empty';
      el.dataset.fx = this.heartStyle;
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
    if (p.bounced) { p.bounced = false; this.airTop = null; } // (un ressort amortit la chute)
    if (p.inWater || p.fly || p.riding || p.attached || p.standingOn || p.aboard) this.airTop = null;
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
    if (p.pos.y < -DEPTH - 20 && !p.world.inVoid(p.pos.x, p.pos.z)) this.damage(MAX_HEALTH * 10); // tombé sous le monde
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
    // boue et sève toxiques sous les pieds (jungle toxique) : un demi-cœur par seconde
    if (this.prick === 0 && p.onGround && !p.fly && (p.standsOn(TOXIC_MUD) || p.standsOn(TOXIC_SAP))) { this.prick = 1; this.damage(1); }
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
