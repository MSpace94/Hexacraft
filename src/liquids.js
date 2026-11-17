// Liquides et machines à liquides (HexaCraft : lot « liquides, machines ») : un seul tableau des
// liquides, les recettes des machines, et ce que vaut chaque liquide dans une fusée. Partagé par
// les blocs (blocks.js : les bidons), l'industrie (industry.js : réseaux, machines), la fusée
// (rocket.js, main.js : ravitaillement) et le Wiki. Pas de DOM, pas de three.js.
//
// La chaîne :
//   - Puits de pétrole : du pétrole brut, dans les déserts, la mesa, la jungle toxique et sous la mer.
//   - Condenseur (distillation) : pétrole brut -> pétrole léger + pétrole lourd (deux réseaux).
//   - Chambre de réaction : léger -> essence ; lourd -> gazole ; hydrogène liquide + glace d'azote
//     (des autres planètes) -> hydrazine.
//   - Mélangeur : eau + soufre (ou sel) -> électrolyte ; hydrogène liquide + poussière de fluorite
//     -> fluorium.
//   - Électrolyseur : eau (+ un peu d'électrolyte) -> oxygène liquide + hydrogène liquide.
//   - Four complexe : lingots de fer (ou ferraille) + lave -> métal en fusion ; presse hydraulique :
//     métal en fusion -> acier. Refroidisseur : lave + eau -> obsidienne.
//   - Groupe électrogène : il brûle l'essence ou le gazole d'un réseau qui le touche -> courant.
//   - La pompe pompe l'eau, ou la lave si elle n'a que de la lave autour.
// Les fusées : leurs réservoirs prennent le carburant primaire, et aussi les carburants de fusée
// (ROCKET_EQ : ce que vaut 1 mB en carburant primaire).
// (les ids en clair : blocks.js importe ce module, pour les bidons)
const STEEL = 245, OBSIDIAN = 74, SULFUR = 70, NITROGEN_ICE = 3975, SALT = 3977, IRON_INGOT_ID = 122;

// clé -> nom, texture (texture/blocs/liquides), id du bidon plein (null : le bidon de carburant
// primaire existe déjà, voir blocks.js)
export const LIQUIDS = [
  ['water', 'Eau', 'eau', 4231],
  ['fuel', 'Carburant primaire', null, null],
  ['crude', 'Pétrole brut', 'petrole_brut', 4232],
  ['light', 'Pétrole léger', 'petrole_leger', 4233],
  ['heavy', 'Pétrole lourd', 'petrole_lourd', 4234],
  ['petrol', 'Essence', 'essence', 4235],
  ['diesel', 'Gazole', 'gazole', 4236],
  ['hydrazine', 'Hydrazine', 'hydrazine', 4237],
  ['lox', 'Oxygène liquide', 'oxygene_liquide', 4238],
  ['lh2', 'Hydrogène liquide', 'hydrogene_liquide', 4239],
  ['electrolyte', 'Électrolyte', 'electrolyte', 4240],
  ['fluorium', 'Fluorium', 'fluorium', 4241],
  ['lava', 'Lave', 'lave', 4242],
  ['molten', 'Métal en fusion', 'metal_en_fusion', 4243],
];
export const LIQUID_NAME = Object.fromEntries(LIQUIDS.map(([k, n]) => [k, n]));
export const LIQUID_TEX = Object.fromEntries(LIQUIDS.filter((l) => l[2]).map(([k, , t]) => [k, t]));
// bidon plein de chaque liquide (id -> liquide, liquide -> id)
export const CAN_OF = Object.fromEntries(LIQUIDS.filter((l) => l[3]).map(([k, , , id]) => [k, id]));
export const LIQUID_OF_CAN = Object.fromEntries(LIQUIDS.filter((l) => l[3]).map(([k, , , id]) => [id, k]));
export const CAN_MB = 1000; // (un bidon)

// Fusées : 1 mB de ce liquide vaut tant de mB de carburant primaire (le reste ne brûle pas)
export const ROCKET_EQ = { fuel: 1, hydrazine: 1.6, fluorium: 2, lh2: 1.3, petrol: 0.6, diesel: 0.5 };

// Machines à liquides : les recettes, essayées dans l'ordre. in / out : { liquide: mB } (chaque
// liquide dans son propre réseau, qui touche la machine) ; items / give : [[id, n]] (dans son
// coffre). t : secondes ; w : watts pendant le travail.
export const FLUID_RECIPES = {
  condenser: { w: 30, list: [{ in: { crude: 1000 }, out: { light: 600, heavy: 400 }, t: 5 }] },
  reaction: { w: 50, list: [
    { in: { light: 1000 }, out: { petrol: 800 }, t: 6 },
    { in: { heavy: 1000 }, out: { diesel: 800 }, t: 6 },
    { in: { lh2: 500 }, items: [[NITROGEN_ICE, 1]], out: { hydrazine: 500 }, t: 6 },
  ] },
  mixer: { w: 20, list: [
    { in: { water: 1000 }, items: [[SULFUR, 1]], out: { electrolyte: 1000 }, t: 4 },
    { in: { water: 1000 }, items: [[SALT, 2]], out: { electrolyte: 1000 }, t: 4 },
    { in: { lh2: 500 }, items: [[3853, 2]], out: { fluorium: 500 }, t: 4 }, // (poussière de fluorite)
  ] },
  electrolyser: { w: 80, list: [{ in: { water: 1000, electrolyte: 50 }, out: { lox: 500, lh2: 500 }, t: 5 }] },
  furnace: { w: 30, list: [
    { in: { lava: 100 }, items: [[IRON_INGOT_ID, 1]], out: { molten: 250 }, t: 4 },
    { in: { lava: 100 }, items: [[4197, 2]], out: { molten: 250 }, t: 4 }, // (ferraille rouillée)
  ] },
  press: { w: 25, list: [{ in: { molten: 500 }, give: [[STEEL, 1]], t: 3 }] },
  cooler: { w: 15, list: [{ in: { lava: 1000, water: 500 }, give: [[OBSIDIAN, 1]], t: 3 }] },
};
// Puits de pétrole : mB de pétrole brut par seconde, et les biomes où il y en a (noms : gen.js)
export const DERRICK_MB = 60, DERRICK_W = 20;
export const OIL_BIOMES = ['DESERT', 'MESA', 'TOXIC', 'OCEAN', 'SEA'];
// Groupe électrogène : watts, et mB brûlés par seconde selon le carburant
export const GENSET_W = 120;
export const GENSET_BURN = { petrol: 8, diesel: 6 };
