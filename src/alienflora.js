// Les plantes extraterrestres cultivables : chacune pousse seulement sur les sols de son genre de
// monde (pas besoin de terre labourée ni d'eau : elles vivent de ce que leur donne leur planète).
// On les trouve sauvages dans les biomes dont le sol leur va (voir planetbiomes.js) : cassées
// mûres, elles donnent leur récolte, qui se replante (comme les carottes).
// Ce module n'a ni DOM ni three.js : les threads de génération le lisent aussi.
//
// base : premier stade (base + stages - 1 : mûre) ; item : la récolte (qui se plante) ;
// soil : les blocs sur lesquels elle pousse ; tile : le nom de ses textures (tile_0 ... tile_3)
export const ALIEN_CROPS = [
  {
    key: 'mousse', name: 'Touffes de mousse violette', ripeName: 'Touffes de mousse violette mûres', item: 4576, base: 4572, stages: 4, food: 3, tile: 'alien_moss',
    itemName: 'Touffe de mousse violette', icon: 'texture/objets/nourriture/mousse_violette.png',
    soilName: 'les sols froids (régolithe, pergélisol, toundra, tholins, azote, mousse, lichen)',
    // régolithe, roche lunaire, pergélisol, toundra, tholins, glace d'azote, poussière noire, lichen, mousse
    soil: [3969, 3970, 3979, 36, 3976, 3975, 4094, 3997, 3998],
  },
  {
    key: 'cristal', name: 'Cristaux végétaux', ripeName: 'Cristaux végétaux mûrs', item: 4581, base: 4577, stages: 4, food: 2, tile: 'alien_crystal',
    itemName: 'Fruit de cristal', icon: 'texture/objets/nourriture/fruit_cristal.png',
    soilName: 'les sols minéraux (quartz, sable de cristal, sel, granite, ardoise, graphite)',
    // quartz, sable de cristal, sel, diorite, ardoise, graphite, verre noir
    soil: [4093, 4092, 3977, 261, 745, 4086, 4089],
  },
  {
    key: 'braise', name: 'Lichen de braise', ripeName: 'Lichen de braise mûr', item: 4587, base: 4583, stages: 4, food: 4, tile: 'alien_ember',
    itemName: 'Lichen de braise', icon: 'texture/objets/nourriture/lichen_braise.png',
    soilName: 'les sols brûlants (basalte, cendre, tuf, soufre, scories, terre calcinée)',
    // basalte, cendre, soufre, tuf, soufre d'Io, roche de cendre, scories, terre calcinée
    soil: [68, 69, 70, 71, 3978, 3981, 4084, 4192],
  },
  {
    key: 'bulbe', name: 'Bulbes des dunes', ripeName: 'Bulbes des dunes mûrs', item: 4592, base: 4588, stages: 4, food: 5, tile: 'alien_bulb',
    itemName: 'Bulbe des dunes', icon: 'texture/objets/nourriture/bulbe_dunes.png',
    soilName: 'les sols secs (ocre, roche rouge, sable rouge, sable, argile, terre cuite)',
    // ocre, roche rouge, sable rouge, sable, dune, argile, roche litée, sable irradié, terres cuites
    soil: [3971, 3972, 4203, 8, 626, 603, 3980, 4207, 4204, 4205, 4206],
  },
];
// (id d'un stade -> sa plante)
export const ALIEN_CROP_OF = {};
for (const C of ALIEN_CROPS) for (let k = 0; k < C.stages; k++) ALIEN_CROP_OF[C.base + k] = C;
export const ripeOf = (C) => C.base + C.stages - 1;

// Le scanner orbital (I et II, voir exploration.js) et les blocs des plans du carnet
export const SCANNER = 4593, SCANNER_II = 4594;
export const CRYSTAL_LANTERN = 4596, MOSS_CARPET = 4597;
// Le carnet d'exploration, en objet (clic droit, ou la touche L quand on l'a sur soi), et la
// tablette (clic droit : YouTube dans le jeu, voir tablette.js)
export const JOURNAL_ITEM = 4598, TABLET = 4599;
// Œufs d'apparition des créatures des biomes (voir creatures.js) : à partir de 4560
export const BIOME_EGG = 4560;
