// Les nouveaux minerais (HexaCraft : lot « minerais ») : un seul tableau, partagé par la génération
// (gen.js, dans les threads aussi : ce module n'a ni DOM ni three.js), les blocs (blocks.js), la
// survie (dureté, ce que donne un minerai, recettes : survival.js), le four (containers.js), le
// concasseur (industry.js), les textures (textures.js) et le Wiki.
//
// Chaque minerai a son usage, pour ne pas faire doublon avec la voltite (l'énergie) :
//   cuivre : câbles, bobines, tuyaux        aluminium : roues, hélices, pièces légères
//   quartz : verre renforcé, circuits         silicium : circuits, panneaux solaires
//   magnétite : aimants (transformateurs)     plomb : batteries, blindage
//   gallium : panneaux solaires               titane : réservoirs avancés, coques
//   iridium : réacteurs                       uranite : uranium (plus tard : le nucléaire)
//   gravitite : générateur de gravité         diamant : seulement décoratif (son bloc)
//
// Génération (seulement dans les chunks créés depuis cette version : ORE_GEN, voir gen.js) :
//   surf : au-dessus de 0 [bas, haut, chance] ; deep : de -1 à -80 ; abyss : sous -80.
//   boost : [biome, facteur] : plus de filons dans ce biome (le biome du centre du filon).
//   Biomes : 5 montagnes, 8 désert, 9 plaines enneigées, 10 volcan (voir BIOME dans gen.js).
// tier : la pioche qu'il faut (3 pierre, 4 fer, 5 fluorite, 6 platine, 7 tungstène).
// gem : le minerai donne directement des cristaux (gem : [min, max]) au lieu de se fondre.
export const ORE_GEN = 15; // (voir GEN_CONTENT dans gen.js)

export const METALS = [
  { key: 'cuivre', name: 'cuivre', fem: false, ore: 4140, block: 4152, product: 4164, dust: 4176, productName: 'Lingot de cuivre', dustName: 'Poussière de cuivre',
    tier: 3, hard: 'stone', salt: 2101, surf: [2, 60, 0.2], deep: [-35, -1, 0.18], boost: [10, 1.8], color: ['#5a2a14', '#c8642c', '#f4b07a'] },
  { key: 'aluminium', name: 'aluminium', fem: false, ore: 4141, block: 4153, product: 4165, dust: 4177, productName: 'Lingot d\'aluminium', dustName: 'Poussière d\'aluminium',
    tier: 3, hard: 'stone', salt: 2111, surf: [10, 80, 0.15], boost: [5, 2], color: ['#5e6670', '#c4ccd4', '#f6f8fa'] },
  { key: 'quartz', name: 'quartz', fem: false, ore: 4142, block: 4154, product: 4166, productName: 'Cristal de quartz', gem: [1, 3],
    tier: 3, hard: 'stone', salt: 2121, surf: [0, 40, 0.11], deep: [-20, -1, 0.07], boost: [8, 2.2], color: ['#8a8278', '#e8e2d6', '#ffffff'] },
  { key: 'silicium', name: 'silicium', fem: false, ore: 4143, block: 4155, product: 4167, dust: 4178, productName: 'Plaquette de silicium', dustName: 'Poussière de silicium',
    tier: 4, hard: 'stone', salt: 2131, surf: [2, 12, 0.05], deep: [-45, -12, 0.14], boost: [8, 2], color: ['#1e2438', '#4a5a8a', '#9aaee0'] },
  { key: 'magnetite', name: 'magnétite', fem: true, ore: 4144, block: 4156, product: 4168, dust: 4179, productName: 'Aimant', dustName: 'Poussière de magnétite',
    tier: 4, hard: 'stone', salt: 2141, surf: [2, 20, 0.06], deep: [-50, -5, 0.12], boost: [9, 1.8], color: ['#141418', '#3a3c48', '#8a90a8'] },
  { key: 'plomb', name: 'plomb', fem: false, ore: 4145, block: 4157, product: 4169, dust: 4180, productName: 'Lingot de plomb', dustName: 'Poussière de plomb',
    tier: 4, hard: 'stone', salt: 2151, deep: [-65, -20, 0.12], color: ['#2a2c38', '#626678', '#a4a8bc'] },
  { key: 'gallium', name: 'gallium', fem: false, ore: 4146, block: 4158, product: 4170, dust: 4181, productName: 'Lingot de gallium', dustName: 'Poussière de gallium',
    tier: 5, hard: 'stone', salt: 2161, deep: [-75, -35, 0.07], color: ['#4a5a78', '#a8bce0', '#eef4ff'] },
  { key: 'titane', name: 'titane', fem: false, ore: 4147, block: 4159, product: 4171, dust: 4182, productName: 'Lingot de titane', dustName: 'Poussière de titane',
    tier: 6, hard: 'hard', salt: 2171, deep: [-80, -45, 0.08], abyss: [-150, -81, 0.05], color: ['#3a3e48', '#8a90a0', '#d4d8e2'] },
  { key: 'iridium', name: 'iridium', fem: false, ore: 4148, block: 4160, product: 4172, dust: 4183, productName: 'Lingot d\'iridium', dustName: 'Poussière d\'iridium',
    tier: 7, hard: 'hard', salt: 2181, abyss: [-150, -81, 0.045], color: ['#6a6048', '#d8ccaa', '#fff8e4'] },
  { key: 'uranite', name: 'uranite', fem: true, ore: 4149, block: 4161, product: 4173, dust: 4184, productName: 'Uranium raffiné', dustName: 'Poussière d\'uranite',
    tier: 7, hard: 'hard', salt: 2191, deep: [-80, -65, 0.03], abyss: [-150, -81, 0.05], color: ['#1e3a14', '#5ab82a', '#c8ff7a'] },
  { key: 'gravitite', name: 'gravitite impure', fem: true, ore: 4150, block: 4162, product: 4174, dust: 4185, productName: 'Gravitite', dustName: 'Poussière de gravitite',
    tier: 8, hard: 'hard', salt: 2201, abyss: [-150, -105, 0.035], color: ['#2a1048', '#8a4ad8', '#e4c8ff'] },
  { key: 'diamant', name: 'diamant', fem: false, ore: 4151, block: 4163, product: 4175, productName: 'Diamant', gem: [1, 1],
    tier: 6, hard: 'hard', salt: 2211, deep: [-80, -60, 0.008], abyss: [-150, -81, 0.012], color: ['#1a6a6e', '#5ad8d8', '#e4ffff'] },
];
// (les noms des blocs : « Minerai de cuivre », « Bloc de cuivre » ; magnétite : « Bloc d'aimant »)
const de = (w) => (/^[aeiouyéèh]/i.test(w) ? 'd\'' : 'de ') + w; // (« d'aluminium », « de cuivre »)
export const oreName = (m) => 'Minerai ' + de(m.name);
export const blockName = (m) => (m.key === 'magnetite' ? 'Bloc d\'aimant' : m.key === 'uranite' ? 'Bloc d\'uranium' : m.key === 'gravitite' ? 'Bloc de gravitite' : 'Bloc ' + de(m.name));
// (les fichiers des textures : texture/blocs/minerais/minerai_<x>.png, texture/blocs/materiaux/bloc_<x>.png)
export const oreTex = (m) => 'minerai_' + (m.key === 'gravitite' ? 'gravitite_impure' : m.key);
export const blockTex = (m) => 'bloc_' + (m.key === 'magnetite' ? 'aimant' : m.key === 'uranite' ? 'uranium' : m.key);

export const METAL_BY_ORE = Object.fromEntries(METALS.map((m) => [m.ore, m]));
export const METAL_BY_BLOCK = Object.fromEntries(METALS.map((m) => [m.block, m]));
export const METAL = Object.fromEntries(METALS.map((m) => [m.key, m]));

// Les nouveaux matériaux (textures de texture/blocs/materiaux)
export const REINFORCED_CONCRETE = 4186, CERAMIC = 4187, REINFORCED_GLASS = 4188;

// La génération : les filons de chaque couche, dans l'ordre (le premier qui prend une case la garde)
export const SURF_ORES = METALS.filter((m) => m.surf);
export const DEEP_ORES = METALS.filter((m) => m.deep);
export const ABYSS_ORES = METALS.filter((m) => m.abyss);
