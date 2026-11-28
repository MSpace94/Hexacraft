// Les biomes des planètes à style (voir planetgen.js) : une couche posée sur le relief de chaque
// style, sans jamais changer la hauteur du sol (les régions déjà explorées et les nouvelles se
// raccordent sans marche). Chaque biome change ce qui couvre le sol (dessus, dessous, mélange par
// petites touches), y fait pousser des formations (rochers, aiguilles, champignons...) et des
// plantes, et a sa couleur sur la carte du monde.
//
// Où va chaque biome (conditions, toutes facultatives) :
//   L : latitude absolue [de, à] (0 : équateur, 1 : pôle)
//   A : altitude relative [de, à] (0 : niveau de la mer ou du sol moyen, 1 : un relief de plus)
//   K, J : deux grandes régions de la planète [de, à] (bruits de 0 à 1 : ~700 et ~1800 blocs)
//   E : hauteur de l'astre dans le ciel [de, à] (planètes synchrones : 1 face à lui, -1 la nuit)
//   on : seulement là où le style a mis un de ces blocs (ses mers de basalte, ses plateaux...)
//   t : seulement sur les planètes dont la température moyenne (°C) est dans [de, à]
// Le premier biome de chaque liste est le paysage du style tel qu'il est : il prend tout ce
// qu'aucun autre ne prend. Les suivants, du plus vaste au plus rare (le dernier gagne).
//
// Ce que fait un biome : top / sub (blocs du dessus, du dessous), mix [[bloc, part]] (des touches
// d'un autre bloc), f [formations : { id, cap, p (chance par case), gap (case, blocs), r [rayon],
// h [hauteur] }], pl [[bloc, part]] (plantes, couches de neige : un bloc posé sur le sol).
// ore [[bloc, chance]] : les ressources propres au biome, dans la roche sous lui (jusqu'à 32 blocs
// sous le sol, voir planetgen.column) : le diamant des champs d'aiguilles de Voss, l'iridium de la
// poussière de Lethe... (le diamant ne se trouve plus que là : voir metals.js)
// Ce fichier n'a ni DOM ni three.js : les threads de génération le lisent aussi.
import { ALIEN_CROPS, ripeOf } from './alienflora.js?v=1.1.0-mx09tneh';

const STONE = 3, GRASS = 1, DIRT = 2, SAND = 8, SNOW = 37, TUNDRA = 36, GRAVEL = 244, DIORITE = 261, SLATE = 745, CLAY = 603,
  BASALT = 68, ASH = 69, SULFUR = 70, TUFF = 71, MAGMA = 73, OBSIDIAN = 74, IRON_ORE = 60, IRON_BLOCK = 62, CRIMSON = 642,
  CRYSTAL_BLOCK = 607, GLOW_MUSH = 611, TALL_GRASS = 196, DRY_GRASS = 4377,
  REGOLITH = 3969, MOON_ROCK = 3970, OCHRE = 3971, RED_ROCK = 3972, ICE = 3973, BLUE_ICE = 3974, NITROGEN = 3975, THOLIN = 3976,
  SALT = 3977, IO_SULFUR = 3978, PERMAFROST = 3979, LAYERED = 3980, ASH_ROCK = 3981, CRACKED_ICE = 3982,
  LICHEN = 3997, MOSS = 3998, MAT_O = 3999, MAT_G = 4082, PINK = 4083, SLAG = 4084, GLOW_CRUST = 4085, GRAPHITE = 4086,
  DIAMOND = 4087, CRYSTAL = 4088, BLACK_GLASS = 4089, REEF = 4090, RADIO = 4091, CSAND = 4092, QUARTZ = 4093, BLACK_DUST = 4094,
  GLOW_ICE = 4095, SANDSTONE = 627, DUNE = 626,
  COPPER = 4140, QUARTZ_ORE = 4142, SILICON = 4143, MAGNETITE = 4144, TITANIUM = 4147, IRIDIUM = 4148, DIAMOND_ORE = 4151,
  MUD = 4189, CHARRED_DIRT = 4192, MUSH_CAP = 4193, MUSH_GLOW = 4194, MUSH_STEM = 4196, SCRAP = 4197, RED_SAND = 4203,
  TC_Y = 4204, TC_O = 4205, TC_R = 4206, IRR_SAND = 4207, CALDERA = 4210;
const SNOWL = 760; // (couche de neige d'un bloc, voir blocks.js)

// une formation : bloc, tête, chance par case, case (blocs), rayon [de, à], hauteur [de, à]
const F = (id, cap, p, gap, r, h) => ({ id, cap, p, gap, r, h });

export const PLANET_BIOMES = {
  moon: [
    { n: 'Hautes terres cratérisées', c: '#a8a6a2' },
    { n: 'Mers de basalte', c: '#4a4a52', on: [BASALT] },
    { n: 'Plaines de régolithe sombre', c: '#6a6a6e', K: [0, 0.3], top: REGOLITH, mix: [[BASALT, 0.12], [BLACK_DUST, 0.08]] },
    { n: "Champs d'éjecta clairs", c: '#d6d4cf', K: [0.64, 1], top: MOON_ROCK, mix: [[REGOLITH, 0.3]], f: [F(MOON_ROCK, 0, 0.5, 9, [0.6, 1.4], [1, 3])] },
    { n: 'Dômes volcaniques', c: '#3c3c44', K: [0.3, 0.62], J: [0.76, 1], top: BASALT, mix: [[ASH_ROCK, 0.25]], f: [F(BASALT, 0, 0.25, 22, [2, 4], [2, 5])] },
    { n: "Affleurements d'ilménite", c: '#5a6a7a', K: [0.3, 0.6], J: [0, 0.16], top: MOON_ROCK, mix: [[TITANIUM, 0.05], [BASALT, 0.2]], f: [F(MOON_ROCK, TITANIUM, 0.3, 16, [0.6, 1.2], [2, 4])] },
    { n: 'Massifs anorthositiques', c: '#e2e0dc', A: [0.55, 9], top: MOON_ROCK, sub: MOON_ROCK, mix: [[DIORITE, 0.2]], f: [F(MOON_ROCK, DIORITE, 0.35, 14, [0.8, 1.6], [2, 6])] },
    { n: 'Cratères polaires glacés', c: '#bcd8e6', L: [0.78, 1], A: [-9, 0.1], top: ICE, mix: [[REGOLITH, 0.35], [CRACKED_ICE, 0.1]] },
  ],
  mars: [
    { n: 'Plaines de poussière ocre', c: '#b46034' },
    { n: 'Champs de blocs basaltiques', c: '#8a5040', K: [0.62, 1], mix: [[BASALT, 0.15]], f: [F(BASALT, 0, 0.6, 7, [0.6, 1.3], [1, 3])] },
    { n: 'Dunes sombres', c: '#3a3434', K: [0, 0.24], A: [-9, 0.4], top: BLACK_DUST, mix: [[OCHRE, 0.2]] },
    { n: 'Plateaux de roche rouge', c: '#86402a', A: [0.4, 9], top: RED_ROCK, mix: [[OCHRE, 0.3]], f: [F(RED_ROCK, 0, 0.3, 18, [1, 2.5], [2, 6])] },
    { n: "Terrasses d'argile", c: '#a89088', J: [0.72, 1], A: [-9, 0.3], top: CLAY, mix: [[LAYERED, 0.3]], f: [F(LAYERED, RED_ROCK, 0.2, 24, [2, 4], [3, 6])] },
    { n: "Coulées d'hématite", c: '#7a4a3a', K: [0.25, 0.45], J: [0.45, 0.6], top: RED_ROCK, mix: [[IRON_ORE, 0.05]], f: [F(IRON_ORE, RED_ROCK, 0.25, 15, [0.5, 1], [2, 4])] },
    { n: 'Bassins de sel', c: '#e6ddd0', J: [0, 0.15], A: [-9, -0.2], top: SALT, mix: [[OCHRE, 0.2]] },
    { n: 'Champs de geysers de CO₂', c: '#6a5048', L: [0.6, 0.74], t: [-250, 30], top: PERMAFROST, mix: [[BLACK_DUST, 0.3]], f: [F(ICE, 0, 0.3, 10, [0.4, 0.8], [1, 2])] },
    { n: 'Calottes de givre', c: '#f0f0f2', L: [0.74, 1], t: [-250, 40], top: PERMAFROST, mix: [[SNOW, 0.5]], pl: [[SNOWL, 0.4]] },
  ],
  desert: [
    { n: 'Mer de dunes', c: '#e0c070' },
    { n: 'Regs de gravier', c: '#9a9288', K: [0, 0.28], top: GRAVEL, mix: [[TUFF, 0.2]] },
    { n: 'Plateaux de soufre', c: '#e0c818', A: [0.4, 9], top: SULFUR, mix: [[LAYERED, 0.3]] },
    { n: 'Erg de sable rouge', c: '#c86a3a', K: [0.3, 0.5], J: [0.4, 0.75], top: RED_SAND },
    { n: 'Cuvettes de sel', c: '#ece8e0', K: [0.5, 1], A: [-9, -0.15], top: SALT },
    { n: 'Badlands de tuf', c: '#d0c8bc', J: [0, 0.2], A: [0, 9], top: TUFF, mix: [[LAYERED, 0.3]], f: [F(TUFF, LAYERED, 0.35, 13, [0.8, 1.6], [3, 7])] },
    { n: 'Mesas de terre cuite', c: '#c07038', J: [0.2, 0.34], A: [0.3, 9], top: TC_O, mix: [[TC_R, 0.3], [TC_Y, 0.15]], f: [F(TC_Y, TC_R, 0.2, 22, [2, 4], [3, 8])] },
    { n: 'Champs de fumerolles', c: '#e4a82a', J: [0.76, 1], top: IO_SULFUR, mix: [[ASH, 0.2]], f: [F(SULFUR, IO_SULFUR, 0.4, 9, [0.4, 0.9], [2, 5])] },
  ],
  sandstone: [
    { n: 'Désert de grès', c: '#d8c890' },
    { n: 'Dunes de sable rouge', c: '#c86a3a', K: [0.66, 1], top: RED_SAND },
    { n: 'Dalles de grès', c: '#d0b07a', A: [0.4, 9], top: SANDSTONE, mix: [[SAND, 0.2]] },
    { n: 'Oueds de gravier', c: '#8c8680', A: [-9, -0.15], top: GRAVEL, mix: [[SAND, 0.3]] },
    { n: 'Canyons de terre cuite', c: '#b85a3a', K: [0, 0.24], A: [0, 9], top: TC_R, mix: [[TC_Y, 0.3], [TC_O, 0.2]] },
    { n: 'Dômes de granite', c: '#b8b8b4', K: [0.3, 0.45], J: [0.45, 0.6], top: DIORITE, f: [F(DIORITE, 0, 0.35, 16, [1.2, 2.6], [2, 5])] },
    { n: 'Forêt de cheminées de fée', c: '#e0c8a0', J: [0.72, 1], f: [F(SANDSTONE, STONE, 0.6, 8, [0.5, 1.1], [3, 9])] },
    { n: 'Croûtes de sel', c: '#ece8e0', J: [0, 0.14], A: [-9, 0], top: SALT },
    { n: 'Champs de quartz', c: '#e8e0f0', J: [0.14, 0.24], mix: [[QUARTZ_ORE, 0.04]], f: [F(QUARTZ, 0, 0.3, 11, [0.4, 0.8], [2, 4])] },
  ],
  volcanic: [
    { n: 'Plaines de basalte', c: '#3e3e44' },
    { n: 'Champs de cendre', c: '#8a8888', K: [0.62, 1], top: ASH, mix: [[ASH_ROCK, 0.3]] },
    { n: 'Plaines de scories', c: '#1e1a18', K: [0.2, 0.34], top: SLAG, mix: [[BASALT, 0.2]] },
    { n: "Coulées d'obsidienne", c: '#24183a', J: [0.76, 1], A: [-9, 0.4], top: OBSIDIAN, mix: [[BASALT, 0.3]] },
    { n: 'Croûte incandescente', c: '#c8401a', K: [0, 0.2], A: [-9, 0.2], top: GLOW_CRUST, mix: [[BASALT, 0.5]] },
    { n: 'Champs de soufre', c: '#e0c818', J: [0, 0.2], top: SULFUR, mix: [[IO_SULFUR, 0.3]], f: [F(SULFUR, IO_SULFUR, 0.3, 11, [0.4, 0.9], [2, 4])] },
    { n: 'Champs de hornitos', c: '#5a2a1a', K: [0.34, 0.62], J: [0.45, 0.6], f: [F(BASALT, MAGMA, 0.5, 9, [0.6, 1.2], [2, 5])] },
    { n: 'Gisements de cramoisite', c: '#8a2030', K: [0.34, 0.62], J: [0.2, 0.3], mix: [[CRIMSON, 0.04], [ASH_ROCK, 0.2]] },
    { n: 'Rebords de caldeira', c: '#6a4838', A: [0.55, 9], top: CALDERA, mix: [[ASH_ROCK, 0.3]] },
  ],
  ironworld: [
    { n: 'Plaines rouillées', c: '#7a3a2a' },
    { n: 'Plaines de scories', c: '#1e1a18', K: [0.62, 1], top: SLAG, mix: [[BASALT, 0.2]] },
    { n: 'Dunes de magnétite', c: '#202024', K: [0, 0.24], top: BLACK_DUST, mix: [[MAGNETITE, 0.03]] },
    { n: 'Bassins de cendre', c: '#8a8888', A: [-9, -0.15], top: ASH },
    { n: "Crêtes d'hématite", c: '#9a6a50', A: [0.4, 9], top: RED_ROCK, mix: [[IRON_ORE, 0.1]], f: [F(IRON_ORE, RED_ROCK, 0.35, 12, [0.5, 1], [3, 7])] },
    { n: 'Champs de ferraille météoritique', c: '#7a5a40', J: [0.8, 1], mix: [[SCRAP, 0.15]], f: [F(SCRAP, 0, 0.3, 14, [0.6, 1.4], [1, 3])] },
    { n: 'Croûte incandescente', c: '#c8401a', J: [0, 0.15], top: GLOW_CRUST, mix: [[BASALT, 0.4]] },
    { n: 'Affleurements de titane', c: '#8a9aa8', K: [0.3, 0.6], J: [0.15, 0.25], top: RED_ROCK, mix: [[TITANIUM, 0.04]] },
  ],
  io: [
    { n: 'Plaines de soufre mouchetées', c: '#e4a82a' },
    { n: 'Champs de lave noire', c: '#2a2a30', K: [0, 0.2], top: BASALT, mix: [[OBSIDIAN, 0.2]] },
    { n: 'Givre de dioxyde de soufre', c: '#f0ece0', K: [0.66, 1], top: SALT, mix: [[IO_SULFUR, 0.3]] },
    { n: 'Dépôts de soufre rouge', c: '#c85a2a', J: [0.72, 1], top: RED_SAND, mix: [[IO_SULFUR, 0.3]] },
    { n: 'Plateaux stratifiés', c: '#b8925a', A: [0.4, 9], top: LAYERED, mix: [[SULFUR, 0.3]] },
    { n: 'Champs de fumerolles', c: '#e0c818', J: [0, 0.18], top: SULFUR, f: [F(SULFUR, IO_SULFUR, 0.4, 9, [0.4, 0.9], [2, 5])] },
    { n: 'Pôles sombres', c: '#4a4038', L: [0.72, 1], top: ASH_ROCK, mix: [[SALT, 0.3]] },
  ],
  europa: [
    { n: 'Croûte de glace', c: '#c8e6f4' },
    { n: 'Plaines lisses', c: '#e0f0f8', K: [0, 0.3], top: ICE, mix: [[SNOW, 0.2]] },
    { n: 'Terrains de chaos', c: '#9ab8cc', K: [0.7, 1], top: CRACKED_ICE, mix: [[BLUE_ICE, 0.3]], f: [F(ICE, CRACKED_ICE, 0.4, 10, [1, 2.2], [1, 4])] },
    { n: 'Bandes brunes', c: '#9a6a4e', J: [0.76, 1], top: THOLIN, mix: [[CRACKED_ICE, 0.4]] },
    { n: 'Plaines de sel marin', c: '#ece8e0', J: [0, 0.15], top: SALT, mix: [[ICE, 0.3]] },
    { n: 'Lenticules', c: '#5a9ad0', K: [0.4, 0.6], J: [0.4, 0.55], top: BLUE_ICE, f: [F(BLUE_ICE, 0, 0.4, 12, [1.5, 3], [1, 2])] },
    { n: 'Givre polaire', c: '#f4f8fc', L: [0.72, 1], top: SNOW, pl: [[SNOWL, 0.5]] },
  ],
  glacier: [
    { n: 'Inlandsis', c: '#f2f6fa' },
    { n: 'Glace bleue nue', c: '#5a9ad0', K: [0, 0.2], top: BLUE_ICE },
    { n: 'Pergélisol', c: '#927262', J: [0, 0.15], top: PERMAFROST, mix: [[GRAVEL, 0.2]] },
    { n: 'Lacs gelés', c: '#a8d4ec', A: [-9, -0.2], top: ICE, mix: [[CRACKED_ICE, 0.2]] },
    { n: 'Moraines', c: '#8c8680', J: [0.76, 1], A: [-9, 0.5], top: GRAVEL, mix: [[STONE, 0.3]], f: [F(STONE, 0, 0.4, 9, [0.6, 1.4], [1, 3])] },
    { n: 'Champs de séracs', c: '#7ab0dc', K: [0.72, 1], top: ICE, f: [F(BLUE_ICE, SNOW, 0.6, 8, [0.6, 1.4], [3, 7])] },
    { n: 'Nunataks', c: '#8a8a8a', A: [0.55, 9], top: DIORITE, mix: [[STONE, 0.3]], f: [F(STONE, SNOW, 0.3, 14, [0.8, 1.6], [2, 6])] },
    { n: 'Neige poudreuse', c: '#ffffff', L: [0.62, 1], pl: [[SNOWL + 1, 0.5]] },
  ],
  redice: [
    { n: 'Plaines gelées', c: '#e8ecf0' },
    { n: 'Glace bleue', c: '#5a9ad0', K: [0, 0.24], top: BLUE_ICE },
    { n: 'Givre ferrugineux', c: '#c88a7a', J: [0.72, 1], top: RED_ROCK, mix: [[SNOW, 0.5]] },
    { n: 'Pitons sombres', c: '#3e3e44', A: [0.4, 9], top: BASALT, f: [F(BASALT, SNOW, 0.35, 13, [0.6, 1.4], [3, 8])] },
    { n: 'Pénitents géants', c: '#c8e6f4', K: [0.76, 1], f: [F(ICE, 0, 0.7, 6, [0.4, 0.8], [4, 9])] },
    { n: 'Cryovolcans', c: '#9ab8cc', J: [0, 0.12], top: CRACKED_ICE, f: [F(BLUE_ICE, SNOW, 0.3, 20, [2, 4], [3, 8])] },
    { n: 'Neiges éternelles', c: '#ffffff', L: [0.56, 1], top: SNOW, pl: [[SNOWL, 0.5]] },
  ],
  pluto: [
    { n: "Plaine d'azote", c: '#ece4d8' },
    { n: 'Terres de tholins', c: '#5a3424', K: [0, 0.3], top: THOLIN, mix: [[NITROGEN, 0.2]] },
    { n: 'Plaines cratérisées', c: '#9a8070', K: [0.3, 0.45], J: [0, 0.3], top: ICE, mix: [[THOLIN, 0.4]] },
    { n: 'Givre de méthane', c: '#f0dcd8', J: [0.76, 1], top: PINK, mix: [[NITROGEN, 0.3]] },
    { n: 'Lames de méthane', c: '#c8b8c8', K: [0.3, 0.7], J: [0.56, 0.76], f: [F(BLUE_ICE, PINK, 0.7, 6, [0.4, 0.8], [4, 9])] },
    { n: "Montagnes de glace d'eau", c: '#c8e6f4', A: [0.4, 9], top: ICE, mix: [[BLUE_ICE, 0.3]], f: [F(ICE, 0, 0.3, 14, [1, 2], [2, 5])] },
    { n: 'Givre polaire', c: '#ffffff', L: [0.72, 1], top: NITROGEN, pl: [[SNOWL, 0.4]] },
  ],
  twilight: [
    { n: 'Bande du crépuscule', c: '#5c8a3a' },
    { n: 'Nuit de glace', c: '#e8f0f8', E: [-1, -0.2], top: SNOW, pl: [[SNOWL, 0.3]] },
    { n: 'Toundra du soir', c: '#9aa890', E: [-0.2, -0.08], top: TUNDRA, pl: [[DRY_GRASS, 0.08]] },
    { n: 'Désert brûlé', c: '#5a4a40', E: [0.2, 0.45], top: ASH_ROCK, mix: [[ASH, 0.3]] },
    { n: 'Savane du crépuscule', c: '#a8a050', E: [0.06, 0.2], top: GRASS, mix: [[DIRT, 0.2]], pl: [[DRY_GRASS, 0.25]] },
    { n: 'Prairies hautes', c: '#4a8a3a', E: [-0.08, 0.06], K: [0.5, 1], pl: [[TALL_GRASS, 0.3]] },
    { n: 'Marais du crépuscule', c: '#4a5a3a', E: [-0.08, 0.06], K: [0, 0.26], A: [-9, 0.25], top: MUD, mix: [[GRASS, 0.3]], pl: [[TALL_GRASS, 0.2]] },
    { n: 'Terres calcinées', c: '#2a2220', E: [0.45, 1], top: CHARRED_DIRT, mix: [[ASH_ROCK, 0.4]] },
  ],
  frozenocean: [
    { n: 'Banquise', c: '#f2f6fa' },
    { n: 'Glace noire', c: '#4a80b8', K: [0, 0.2], top: BLUE_ICE },
    { n: 'Glace de mer fissurée', c: '#9ab8cc', J: [0, 0.2], top: CRACKED_ICE },
    { n: 'Fleurs de givre', c: '#e0eef8', J: [0.45, 0.6], top: ICE, mix: [[SALT, 0.1]], pl: [[SNOWL, 0.3]] },
    { n: 'Crêtes de pression', c: '#c8e6f4', K: [0.72, 1], f: [F(ICE, SNOW, 0.6, 7, [0.6, 1.4], [2, 5])] },
    { n: 'Champs de neige', c: '#ffffff', L: [0.5, 1], J: [0.7, 1], top: SNOW, pl: [[SNOWL + 1, 0.5]] },
  ],
  eldra: [
    { n: 'Landes de lichens', c: '#2e2038' },
    { n: 'Champs de basalte noir', c: '#2a2a30', K: [0, 0.15], top: BASALT, mix: [[LICHEN, 0.3]] },
    { n: 'Prairies de mousse violette', c: '#45305a', K: [0.6, 1], A: [-0.2, 0.8], top: MOSS, mix: [[LICHEN, 0.2]] },
    { n: 'Tapis microbiens verts', c: '#4a8a3a', A: [-9, 0.1], J: [0, 0.3], top: MAT_G, mix: [[MAT_O, 0.2]] },
    { n: 'Tapis microbiens orangés', c: '#d07a28', A: [-9, 0.1], J: [0.6, 1], top: MAT_O, mix: [[MAT_G, 0.2]] },
    { n: 'Plaines de sel', c: '#ece8e0', K: [0, 0.3], J: [0.3, 0.45], top: SALT },
    { n: 'Hauts plateaux rocheux', c: '#6a6870', A: [0.65, 9], top: STONE, mix: [[LICHEN, 0.3]], f: [F(STONE, 0, 0.3, 12, [0.6, 1.4], [1, 4])] },
    { n: 'Toundra violette', c: '#8a7a9a', L: [0.55, 0.8], top: LICHEN, mix: [[SNOW, 0.3]], pl: [[SNOWL, 0.1]] },
    { n: 'Forêts de champignons lumineux', c: '#7a4aa0', K: [0.76, 1], J: [0.4, 0.7], A: [-0.2, 0.8], top: MOSS, f: [F(MUSH_STEM, MUSH_GLOW, 0.6, 7, [0.4, 0.6], [3, 7])], pl: [[GLOW_MUSH, 0.04]] },
  ],
  glacyon: [
    { n: "Plaines d'azote rose", c: '#f0dcd8' },
    { n: 'Dunes de tholins', c: '#5a3424', K: [0, 0.25], top: THOLIN },
    { n: "Glace d'azote blanche", c: '#ece4d8', K: [0.7, 1], top: NITROGEN },
    { n: "Montagnes de glace d'eau", c: '#c8e6f4', A: [0.4, 9], top: ICE, mix: [[BLUE_ICE, 0.3]] },
    { n: 'Lames de méthane', c: '#d8c0c8', J: [0.6, 0.75], f: [F(PINK, 0, 0.6, 7, [0.4, 0.8], [3, 7])] },
    { n: 'Failles de glace lumineuse', c: '#60b8ff', J: [0.86, 1], mix: [[GLOW_ICE, 0.2]] },
    { n: 'Cryovolcans', c: '#9ab8cc', J: [0, 0.12], top: CRACKED_ICE, f: [F(BLUE_ICE, NITROGEN, 0.3, 20, [2, 4], [3, 8])] },
  ],
  cinder: [
    { n: 'Plaines de scories', c: '#1e1a18' },
    { n: 'Nuit de cendres', c: '#3e3a36', E: [-1, -0.3], top: ASH_ROCK, mix: [[SLAG, 0.4]] },
    { n: 'Croûte incandescente', c: '#c8401a', E: [0.2, 1], top: GLOW_CRUST, mix: [[SLAG, 0.3]] },
    { n: "Plaines d'obsidienne", c: '#24183a', K: [0.7, 1], top: OBSIDIAN, mix: [[SLAG, 0.3]] },
    { n: 'Lacs de verre noir', c: '#0c0c10', K: [0, 0.2], top: BLACK_GLASS },
    { n: 'Crêtes de magnétite', c: '#303038', A: [0.4, 9], top: BASALT, mix: [[MAGNETITE, 0.06]] },
    { n: 'Champs de geysers de métal', c: '#9a6a50', J: [0.8, 1], f: [F(IRON_BLOCK, MAGMA, 0.4, 10, [0.4, 0.8], [2, 4])] },
  ],
  voss: [
    { n: 'Plateaux de graphite', c: '#202024' },
    { n: 'Poussière de suie', c: '#0c0c0d', K: [0.7, 1], top: BLACK_DUST },
    { n: 'Plaines de carbure', c: '#4a4e56', K: [0, 0.25], top: SLATE, mix: [[GRAPHITE, 0.4], [SILICON, 0.03]] },
    { n: 'Lacs de verre noir', c: '#0c0c10', A: [-9, -0.15], top: BLACK_GLASS },
    { n: 'Falaises de diamant', c: '#8ad8ff', A: [0.55, 9], mix: [[DIAMOND, 0.15]] },
    { n: "Champs d'aiguilles de diamant", c: '#6ab8e0', J: [0.8, 1], f: [F(DIAMOND, 0, 0.5, 9, [0.4, 0.8], [3, 7])] },
    { n: 'Gisements de diamant', c: '#4a6a80', J: [0, 0.12], mix: [[DIAMOND_ORE, 0.04]] },
  ],
  halo: [
    { n: 'Sol radiotrophe', c: '#14282e' },
    { n: 'Dunes irradiées', c: '#8a9a40', K: [0, 0.2], top: IRR_SAND },
    { n: 'Champignons lumineux', c: '#2a4a5a', K: [0.3, 0.65], J: [0, 0.2], mix: [[MOSS, 0.3]], pl: [[GLOW_MUSH, 0.08]] },
    { n: 'Récifs émergés', c: '#1880e0', A: [-9, 0.15], J: [0.5, 0.8], top: REEF, mix: [[SAND, 0.4]] },
    { n: 'Plaines de verre noir', c: '#0c0c10', J: [0.8, 1], top: BLACK_GLASS },
    { n: "Falaises d'aurore", c: '#b8b8c8', A: [0.55, 9], top: DIORITE, mix: [[CRYSTAL, 0.1]] },
    { n: 'Forêts de cristaux', c: '#5ad8e0', K: [0.66, 1], f: [F(CRYSTAL, 0, 0.6, 7, [0.4, 0.8], [2, 6])] },
  ],
  tessel: [
    { n: 'Dunes de sable de cristal', c: '#e0dcec' },
    { n: 'Désert de sable blanc', c: '#e8e0c8', K: [0, 0.25], top: SAND, mix: [[CSAND, 0.5]] },
    { n: 'Plateaux de quartz', c: '#ddd2ec', A: [0.4, 9], top: QUARTZ },
    { n: 'Cuvettes de sel', c: '#ece8e0', A: [-9, -0.15], top: SALT },
    { n: 'Champs de cristaux', c: '#c8e8f0', K: [0.7, 1], f: [F(CRYSTAL_BLOCK, 0, 0.5, 8, [0.3, 0.7], [1, 3])] },
    { n: 'Aiguilles de quartz', c: '#c8b8e0', J: [0.76, 1], f: [F(QUARTZ, 0, 0.6, 8, [0.4, 0.9], [3, 8])] },
    { n: 'Géodes ouvertes', c: '#a890c8', J: [0, 0.12], mix: [[QUARTZ_ORE, 0.05]], f: [F(QUARTZ, CRYSTAL_BLOCK, 0.3, 16, [1, 2], [1, 3])] },
  ],
  perse: [
    { n: 'Glace bleue fracturée', c: '#5a9ad0' },
    { n: 'Glace fissurée', c: '#9ab8cc', K: [0, 0.25], top: CRACKED_ICE },
    { n: 'Champs de neige', c: '#f2f6fa', K: [0.7, 1], top: SNOW, pl: [[SNOWL, 0.3]] },
    { n: 'Givre salé', c: '#e0e8f0', J: [0.4, 0.55], mix: [[SALT, 0.3]] },
    { n: 'Failles lumineuses', c: '#60b8ff', J: [0.86, 1], top: GLOW_ICE, mix: [[BLUE_ICE, 0.4]] },
    { n: 'Cryovolcans géants', c: '#c8e6f4', J: [0, 0.1], f: [F(BLUE_ICE, SNOW, 0.35, 22, [2, 4.5], [4, 9])] },
  ],
  lethe: [
    { n: 'Plaines de poussière noire', c: '#0c0c0d' },
    { n: 'Champs de cratères', c: '#2a2a30', K: [0.6, 1], top: BASALT, mix: [[BLACK_DUST, 0.4]], f: [F(BASALT, 0, 0.4, 10, [0.6, 1.3], [1, 3])] },
    { n: "Hautes terres d'ardoise", c: '#4a4e56', A: [0.4, 9], top: SLATE },
    { n: 'Champs d\'obsidienne', c: '#24183a', K: [0, 0.2], top: OBSIDIAN, mix: [[BLACK_DUST, 0.4]] },
    { n: "Verre d'impact", c: '#141418', J: [0.86, 1], top: BLACK_GLASS },
    { n: "Poussière d'iridium", c: '#4a4a5a', J: [0, 0.1], mix: [[IRIDIUM, 0.03]] },
  ],
};
// (le cuivre natif : quelques déserts et mondes de fer en ont, à fleur de sol)
PLANET_BIOMES.desert.push({ n: 'Affleurements de cuivre', c: '#4a8a6a', K: [0.28, 0.5], J: [0.6, 0.72], mix: [[COPPER, 0.04]], f: [F(LAYERED, COPPER, 0.2, 16, [0.6, 1.2], [2, 4])] });
PLANET_BIOMES.ironworld.push({ n: 'Affleurements de cuivre', c: '#4a8a6a', K: [0.24, 0.62], J: [0.6, 0.72], mix: [[COPPER, 0.05]] });

// ---------- Les ressources propres à certains biomes ----------
const LEAD = 4145, GALLIUM = 4146, URANITE = 4149, GRAVITITE = 4150, ALUMINIUM = 4141, PLATINUM = 83, TUNGSTEN = 85, FLUORITE = 640;
const ORES = {
  moon: { "Affleurements d'ilménite": [[TITANIUM, 0.035]] },
  mars: { "Coulées d'hématite": [[MAGNETITE, 0.025], [IRON_ORE, 0.03]], "Terrasses d'argile": [[ALUMINIUM, 0.03]] },
  desert: { 'Affleurements de cuivre': [[COPPER, 0.04]] },
  sandstone: { 'Champs de quartz': [[QUARTZ_ORE, 0.04]] },
  volcanic: { 'Gisements de cramoisite': [[CRIMSON, 0.04]], 'Rebords de caldeira': [[TUNGSTEN, 0.015]] },
  ironworld: { "Crêtes d'hématite": [[IRON_ORE, 0.05]], 'Affleurements de titane': [[TITANIUM, 0.04]], 'Dunes de magnétite': [[MAGNETITE, 0.04]],
    'Champs de ferraille météoritique': [[PLATINUM, 0.015]], 'Affleurements de cuivre': [[COPPER, 0.04]] },
  io: { 'Dépôts de soufre rouge': [[LEAD, 0.025]] },
  europa: { 'Plaines de sel marin': [[GALLIUM, 0.015]] },
  glacier: { 'Pergélisol': [[FLUORITE, 0.025]] },
  pluto: { 'Terres de tholins': [[LEAD, 0.025]] },
  eldra: { 'Hauts plateaux rocheux': [[ALUMINIUM, 0.03]] },
  glacyon: { 'Failles de glace lumineuse': [[GRAVITITE, 0.01]] },
  cinder: { 'Crêtes de magnétite': [[MAGNETITE, 0.04]], 'Champs de geysers de métal': [[PLATINUM, 0.025]] },
  voss: { "Champs d'aiguilles de diamant": [[DIAMOND_ORE, 0.04]], 'Gisements de diamant': [[DIAMOND_ORE, 0.025]], 'Plaines de carbure': [[SILICON, 0.04]] },
  halo: { 'Dunes irradiées': [[URANITE, 0.03]], 'Forêts de cristaux': [[QUARTZ_ORE, 0.025]] },
  tessel: { 'Géodes ouvertes': [[QUARTZ_ORE, 0.05]], 'Aiguilles de quartz': [[GALLIUM, 0.015]] },
  perse: { 'Failles lumineuses': [[GRAVITITE, 0.012]] },
  lethe: { "Poussière d'iridium": [[IRIDIUM, 0.04]], "Verre d'impact": [[PLATINUM, 0.015]] },
  twilight: { 'Terres calcinées': [[TUNGSTEN, 0.015]] },
  frozenocean: { 'Glace noire': [[FLUORITE, 0.015]] },
};
for (const [style, list] of Object.entries(ORES)) for (const B of PLANET_BIOMES[style]) if (list[B.n]) B.ore = list[B.n];

// ---------- Les plantes sauvages (voir alienflora.js) ----------
// Dans les biomes dont le sol leur va, quelques plantes mûres ; plus dans ceux qui portent leur nom
const WILD = { "Prairies de mousse violette": ['mousse', 0.03], 'Toundra violette': ['mousse', 0.015], 'Forêts de cristaux': ['cristal', 0.03],
  'Champs de cristaux': ['cristal', 0.02], 'Géodes ouvertes': ['cristal', 0.015], 'Champs de cendre': ['braise', 0.012], 'Terres calcinées': ['braise', 0.015],
  'Erg de sable rouge': ['bulbe', 0.01], 'Dunes de sable rouge': ['bulbe', 0.01] };
for (const list of Object.values(PLANET_BIOMES)) {
  for (const B of list) {
    const named = WILD[B.n], C = named ? ALIEN_CROPS.find((x) => x.key === named[0]) : ALIEN_CROPS.find((x) => B.top && x.soil.includes(B.top));
    if (!C) continue;
    (B.pl ||= []).push([ripeOf(C), named ? named[1] : 0.004]);
  }
}

// Les biomes possibles d'une planète (selon sa température) : [{ n, c, ... }] ; le premier est le paysage du style
export function biomesOf(style, temp) {
  const L = PLANET_BIOMES[style];
  if (!L) return null;
  return L.filter((B, i) => i === 0 || !B.t || (temp >= B.t[0] && temp <= B.t[1]));
}
// (le nom du liquide d'une planète, pour la carte)
export function fluidName(fid) {
  return fid === 72 ? 'Mer de lave' : fid === 200 ? 'Mer glaciale' : fid === 7 ? 'Mer' : 'Liquide';
}
