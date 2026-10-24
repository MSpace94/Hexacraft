// Vie des villages : métiers, chantiers, croissance (chez l'hôte seulement).
//
// Chaque villageois adulte commence par s'installer : il part couper un arbre, se fait un
// établi dans sa maison, puis un coffre où ranger son bois. Le premier installé pose le coffre
// de la mairie (dans la grande maison) : le village est fondé. Chacun prend alors un métier,
// selon ce qui manque au village :
//   bûcheron : coupe les arbres autour du village (et replante une pousse), apporte le bois ;
//   mineur   : creuse la mine (escalier en colimaçon puis galeries éclairées), apporte pierre,
//              charbon et minerais ;
//   maçon    : bâtit les chantiers du village avec ce qu'il y a dans le coffre de la mairie
//              (s'il manque quelque chose, il va le demander au bûcheron ou au mineur) ;
//   fermier  : cultive le potager (nourriture) ; pêcheur : pêche (nourriture) ;
//   berger   : tond les moutons (laine) ; artisans : travaillent à leur établi et commercent.
// Le village lance ses chantiers lui-même, un à la fois : la mine (s'il n'y en a pas encore),
// le potager, les routes de gravier jusqu'à chaque porte, puis des maisons quand il n'y a plus
// assez de lits. Avec de la nourriture et des lits libres, des enfants naissent ; ils
// grandissent et prennent un métier à leur tour.
//
// Verre : le mineur va chercher du sable (plages, déserts), se fabrique un four (8 pierres
// taillées, posé dans la mairie) et y fait fondre le sable au charbon (ou au bois) : les vitres
// des nouvelles maisons. Pas de sable dans les environs : fenêtres ouvertes.
// Croissance sans limite : tant qu'il y a de quoi manger, des lits manquent, le village bâtit
// (de plus en plus loin du puits) ; quand il est grand, des petits immeubles de trois étages
// (escalier en colimaçon autour d'un pilier central, un établi et un coffre par étage).
//
// Mécanicien (quand le village est assez grand) : avec le maçon, il bâtit une plateforme de
// lancement (un bloc cible au centre : elle apparaît dans la liste des gravitrons), puis y
// assemble des véhicules physiques pour les joueurs : un plateau de planches, deux blocs
// physiques, un gravitron réglé sur la plateforme et un levier. On monte dessus, on choisit
// une destination au gravitron (clé à molette), on lève le levier : il décolle.
//
// Sans pierre sous le village (monde plat : de la terre sur la roche du fond), pas de mine :
// maisons tout en bois (fenêtres ouvertes), chemins de terre au lieu du gravier, et pas de
// mineur (voir stoneless).
//
// Tout se voit dans le monde : arbres coupés, blocs posés un à un, coffres qui se remplissent
// (on peut y ajouter des ressources pour aider le village... ou s'y servir).
//
// Performances : rien n'est fait pour les villages loin des joueurs (leurs villageois ne sont
// pas simulés). Les décisions sont prises toutes les une ou deux secondes ; chaque frame, un
// villageois au travail ne fait qu'un test de distance. Les blocs changent un par un (au plus
// un par seconde et par villageois), la recherche d'arbres avance de quelques colonnes à la fois.
import { hexToWorld, worldToHex, NEIGHBORS } from './hex.js?v=1.1.5-alpha-mvm2b95g';
import {
  BLOCKS, SOLID, ATTACHED, AIR, GRAVITRON, LEVER, LEVER_ON, ITEMS, isWater, isLava, isLog, isNaturalLeaves, facingVariant, FURNACE, isFurnace,
  CHEST, CRAFTING_TABLE, WALL_TORCH, TORCH, GRAVEL, TALL_GRASS, SAPLING, CHESTNUT_SAPLING, LINDEN_SAPLING,
  FARMLAND, isFarmland, WHEAT_CROP, POTATO_CROP, WHEAT, POTATO, BAKED_POTATO, isCrop, BREAD, BIG_SAPLING, BIRCH_SAPLING, POD, POD_TOP, isPod,
} from './blocks.js?v=1.1.5-alpha-mvm2b95g';
import { houseBlocks, DIRS6, midCell } from './gen.js?v=1.1.5-alpha-mvm2b95g';
import { CS, H, idx, chunkKey, Y_MIN } from './mesher.js?v=1.1.5-alpha-mvm2b95g';

const hexDist = (dq, dr) => (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
const ck = (q, r) => q + ',' + r;
const rnd = (a, b) => a + Math.random() * (b - a);
const pickOf = (l) => l[Math.floor(Math.random() * l.length)];

// ---------- Métiers ----------
// skin : vêtements (texture/entites/villageois/metiers) ; artisan : travaille à son établi
export const JOBS = {
  lumberjack: { name: 'Bûcheron', skin: 'fletcher' },
  miner: { name: 'Mineur', skin: 'armorer' },
  mason: { name: 'Maçon', skin: 'mason' },
  farmer: { name: 'Fermier', skin: 'farmer' },
  fisher: { name: 'Pêcheur', skin: 'fisherman' },
  shepherd: { name: 'Berger', skin: 'shepherd' },
  toolsmith: { name: 'Forgeron', skin: 'toolsmith', artisan: true },
  weaponsmith: { name: 'Armurier', skin: 'weaponsmith', artisan: true },
  // boucher et boulanger : dans leur boutique (le rez-de-chaussée d'un immeuble), sinon chez eux
  butcher: { name: 'Boucher', skin: 'butcher' },
  baker: { name: 'Boulanger', skin: 'baker' },
  // forestier : il retire les jeunes pousses sauvages autour du village et les range à la grange
  forester: { name: 'Forestier', skin: 'forester' },
  // bâtisseurs spécialisés : le charpentier bâtit les maisons (et immeubles, hôtel, boutiques,
  // grange) ; le bâtisseur de champs, les champs. Les maçons font le reste (mine, routes, mur,
  // lampadaires...) et les aident quand ils n'ont rien à faire.
  carpenter: { name: 'Charpentier', skin: 'carpenter' },
  // feuilleteur : il retire les feuilles d'arbres qui touchent les bâtiments du village (un
  // forestier et un feuilleteur pour chaque bûcheron)
  leafer: { name: 'Feuilleteur', skin: 'leafer' },
  // constructeur de véhicules : il assemble des véhicules sur la plateforme, avec le mécanicien
  vehiclebuilder: { name: 'Constructeur de véhicules', skin: 'vehiclebuilder' },
  // chauffeur de taxi : à la plateforme ; monte sur un véhicule, parle-lui, choisis où aller :
  // il règle le gravitron et le lance
  taxi: { name: 'Chauffeur de taxi', skin: 'taxi' },
  fieldbuilder: { name: 'Bâtisseur de champs', skin: 'fieldbuilder' },
  leatherworker: { name: 'Tanneur', skin: 'leatherworker', artisan: true },
  librarian: { name: 'Bibliothécaire', skin: 'librarian', artisan: true },
  cleric: { name: 'Prêtre', skin: 'cleric', artisan: true },
  cartographer: { name: 'Cartographe', skin: 'cartographer', artisan: true },
  mechanic: { name: 'Mécanicien', skin: 'mechanic' },
  // garde : il veille la nuit (et dort le jour), chasse les zombies près du village
  guard: { name: 'Garde', skin: 'guard' },
  // policier (en ville : aux carrefours) et gendarme (aux entrées du village, à la plateforme) :
  // ils règlent la circulation le jour (chacun son tour, voir do_traffic)
  police: { name: 'Policier', skin: 'police' },
  gendarme: { name: 'Gendarme', skin: 'gendarme' },
  // militaires : recrutés par un joueur (deux tenues au choix) ; ils quittent leur village, le
  // suivent et combattent les monstres (voir animals.js, soldierThink)
  // instituteur (à l'école : les enfants y vont le jour), livreur (il dort à la poste et porte
  // les ressources d'un bâtiment à l'autre), médecin (il soigne à l'hôpital)
  teacher: { name: 'Instituteur', skin: 'teacher' },
  courier: { name: 'Livreur', skin: 'courier' },
  doctor: { name: 'Médecin', skin: 'doctor' },
  // cantonnier : il trace les chemins de gravier des portes pas encore reliées jusqu'à la route
  roadworker: { name: 'Cantonnier', skin: 'roadworker' },
  soldier: { name: 'Militaire', skin: 'militaire1', recruit: true },
  soldier2: { name: 'Militaire', skin: 'militaire2', recruit: true },
};
export const JOB_KEYS = Object.keys(JOBS);
const ARTISANS = JOB_KEYS.filter((j) => JOBS[j].artisan);
// Ce que chaque métier vend et achète : [[donné, nombre], [reçu, nombre]] (122 : lingot de fer)
export const JOB_TRADES = {
  lumberjack: [[[5, 12], [122, 1]], [[122, 1], [5, 10]], [[122, 1], [SAPLING, 3]], [[122, 2], [CHESTNUT_SAPLING, 2]]],
  miner: [[[104, 16], [122, 2]], [[122, 1], [28, 20]], [[122, 3], [123, 2]], [[122, 2], [60, 3]]],
  mason: [[[122, 1], [GRAVEL, 16]], [[122, 1], [28, 16]], [[122, 2], [40, 8]], [[122, 2], [32, 16]]],
  farmer: [[[122, 1], [164, 4]], [[163, 6], [122, 1]], [[122, 2], [96, 1]]],
  fisher: [[[122, 1], [164, 3]], [[194, 6], [122, 1]], [[122, 1], [121, 16]]],
  shepherd: [[[122, 1], [194, 6]], [[122, 1], [195, 6]], [[163, 8], [122, 1]]],
  toolsmith: [[[122, 3], [125, 1]], [[122, 2], [127, 1]], [[122, 3], [126, 1]], [[122, 2], [124, 1]]],
  weaponsmith: [[[122, 3], [128, 1]], [[122, 3], [26, 2]], [[122, 8], [130, 1]]],
  butcher: [[[163, 6], [122, 1]], [[122, 1], [164, 5]], [[104, 12], [122, 1]]],
  leatherworker: [[[194, 5], [122, 1]], [[195, 5], [122, 1]], [[122, 1], [17, 12]]],
  librarian: [[[122, 2], [40, 12]], [[122, 1], [TORCH, 16]], [[122, 6], [81, 1]]],
  cleric: [[[122, 4], [123, 3]], [[122, 1], [132, 6]], [[122, 12], [63, 1]]],
  cartographer: [[[122, 2], [243, 2]], [[122, 1], [GRAVEL, 24]], [[122, 20], [102, 1]]],
  baker: [[[122, 1], [BREAD, 4]], [[WHEAT, 12], [122, 1]], [[122, 1], [442, 4]]],
  leafer: [[[122, 1], [SAPLING, 3]], [[122, 1], [BIRCH_SAPLING, 3]]],
  vehiclebuilder: [[[122, 4], [66, 1]], [[122, 6], [81, 1]], [[122, 1], [79, 2]]],
  taxi: [],
  carpenter: [[[122, 1], [18, 24]], [[122, 2], [33, 24]], [[5, 16], [122, 1]]],
  fieldbuilder: [[[122, 1], [425, 8]], [[122, 1], [441, 6]], [[426, 12], [122, 1]]],
  forester: [[[122, 1], [SAPLING, 4]], [[122, 1], [BIRCH_SAPLING, 3]], [[122, 2], [LINDEN_SAPLING, 2]]],
  guard: [[[122, 1], [TORCH, 12]], [[122, 3], [128, 1]], [[163, 6], [122, 1]]],
  police: [[[122, 1], [TORCH, 10]], [[GRAVEL, 32], [122, 1]]],
  soldier: [], soldier2: [],
  teacher: [[[122, 1], [TORCH, 8]], [[122, 2], [40, 6]]],
  courier: [[[122, 1], [GRAVEL, 16]], [[5, 16], [122, 1]]],
  doctor: [],
  roadworker: [[[122, 1], [GRAVEL, 16]], [[GRAVEL, 32], [122, 1]]],
  gendarme: [[[122, 1], [164, 4]], [[122, 3], [128, 1]]],
  mechanic: [[[122, 3], [66, 1]], [[122, 8], [81, 1]], [[122, 4], [198, 1]], [[122, 6], [241, 1]], [[122, 2], [124, 1]]],
};

// ---------- Réglages ----------
const HOUSE_CAP = 2;           // lits par maison
const TOWER_CAP = 8;           // lits d'un petit immeuble (trois étages)
// Hôtel : quand des villageois n'ont pas de maison, les maçons bâtissent d'abord un grand
// bâtiment de deux étages (rayon HOTEL_R) qui les accueille tous
const HOTEL_CAP = 12, HOTEL_R = 4;
const JOIN_R = 48;             // un villageois né d'un œuf rejoint un village à cette distance
// bâtiments à étages (pilier et escalier au centre) : on dort à côté du pilier
const STOREYED = new Set(['tower', 'hotel', 'shop', 'apartment']);
// Grand immeuble (dès APT_AFTER maisons et le jour APT_DAY) : rayon APT_R, un hall au
// rez-de-chaussée, puis APT_FLOORS étages de 2 appartements (APT_BEDS lits chacun) autour de
// l'escalier
const APT_R = 6, APT_AFTER = 20, APT_DAY = 5, APT_FLOORS = [4, 7], APT_BEDS = 2;
// Bâtiments publics : poste (livreurs), hôpital (médecin), école (instituteur) : dès tant de maisons
const POST_AFTER = 8, HOSPITAL_AFTER = 12, SCHOOL_AFTER = 15;
const POST_R = 2, HOSPITAL_R = 4, SCHOOL_R = 5;
// Hôpital : un villageois blessé (sous HURT de sa vie) va s'y soigner ; avec le médecin, il
// reprend 1 point de vie toutes les HEAL_T secondes (sans : HEAL_SLOW)
const HURT = 0.7, HEAL_T = 0.7, HEAL_SLOW = 4, HEAL_COST = 2;
// Mine : au fond du puits, des salles (rayon ROOM_R, ROOM_H de haut), MINE_ROOMS au plus
const ROOM_R = 4, ROOM_H = 4, MINE_ROOMS = 8;
const ORES = [60, 104, 123, 83, 85, 132];
// Immeuble à boutique (boulangerie, boucherie) : la boutique au rez-de-chaussée, sans accès aux
// étages ; une porte à côté donne sur l'escalier, qui monte aux deux étages de logements
const SHOP_CAP = 6, SHOP_AFTER = 5, SHOPS = ['bakery', 'butchery'];
const SHOP_JOB = { bakery: 'baker', butchery: 'butcher' };
const CAP_OF = { tower: TOWER_CAP, hotel: HOTEL_CAP, shop: SHOP_CAP };
const aptCap = (storeys) => (storeys - 1) * 2 * APT_BEDS;
// Chantiers par spécialité : maisons (le charpentier), champs (le bâtisseur de champs, sinon
// les fermiers), le reste (les maçons)
const HOUSING = new Set(['house', 'tower', 'hotel', 'shop', 'barn', 'beds', 'grove', 'apartment', 'school', 'hospital', 'post']);
// Lits : autant d'habitants que de lits de villageois dans le bâtiment ; les bâtisseurs les posent
// (chantier « beds »). Lits voulus par sorte de bâtiment ; étages habités (n° d'étage)
const BEDS_OF = { house: HOUSE_CAP, tower: TOWER_CAP, hotel: HOTEL_CAP, shop: SHOP_CAP };
const STOREY_H = 4, BED_BATCH = 8;
const FLOORS_OF = { tower: [0, 1, 2], hotel: [0, 1], shop: [1, 2] };
// (les chemins jusqu'aux portes : le cantonnier, et les maçons quand ils n'ont rien d'autre)
const roleOf = (p) => (p.builder === 'farmer' || p.builder === 'field' ? 'field' : HOUSING.has(p.type) ? 'house' : p.type === 'road' && !p.main ? 'path' : 'other');
const ROLE_HOUSE = new Set(['house']), ROLE_FIELD = new Set(['field']), ROLE_OTHER = new Set(['other', 'path']), ROLE_BOTH = new Set(['other', 'house', 'path']);
const ROLE_PATH = new Set(['path']), ROLE_NOPATH = new Set(['other']), ROLE_NOPATH_HOUSE = new Set(['other', 'house']);
// Champs : rayon FIELD_R (un trou d'eau, deux anneaux de terre labourée : 18 cases, bordure de
// dalles) ; au plus FIELD_FARMERS fermiers par champ, un champ de plus quand ils sont tous pris
const FIELD_R = 3, FIELD_FARMERS = 2;
// Garde-manger de la boulangerie (V.pantry) : les fermiers y apportent blé et pommes de terre,
// le boulanger en fait du pain et des pommes de terre cuites (la nourriture du village : les
// naissances, voir V.food)
const PANTRY_MAX = 96;
// Feuilleteur : feuilles d'arbres à moins de LEAF_MARGIN cases d'un bâtiment (et jusqu'à
// LEAF_H blocs au-dessus de son sol) ; recherche toutes les LEAF_SCAN secondes
const LEAF_MARGIN = 2, LEAF_H = 14, LEAF_SCAN = 20, LEAF_KEEP = 40;
// Lampadaires : un poteau (3 bûches) et une torche, le long des routes, tous les LAMP_EVERY
// cases environ ; LAMP_BATCH par chantier
const LAMP_EVERY = 7, LAMP_BATCH = 6;
// Grange : un grand bâtiment (rayon BARN_R) plein de coffres, bâti le jour dès BARN_AFTER maisons
const BARN_R = 4, BARN_AFTER = 3;
// Pépinière (dès GROVE_AFTER maisons) : un grand enclos de rayon GROVE_R où les bûcherons
// plantent et coupent. Ensuite, les autres arbres du village (troncs, feuilles, pousses) ne
// servent plus : ils sont enlevés (bûcherons, feuilleteurs, forestiers). JUNK_SCAN : colonnes du
// village examinées à chaque réflexion ; WOOD_LOW : bois à la mairie sous lequel les bûcherons
// vont aussi couper en forêt
const GROVE_R = 6, GROVE_AFTER = 10, JUNK_SCAN = 160, JUNK_KEEP = 40, WOOD_LOW = 32;
// Jeunes pousses sauvages (le forestier les retire)
const WILD_SAPLINGS = new Set([SAPLING, BIG_SAPLING, CHESTNUT_SAPLING, LINDEN_SAPLING, BIRCH_SAPLING]);
const TOWER_AFTER = 6;         // maisons d'habitation avant le premier immeuble
// Mur d'enceinte (contre les zombies) : un anneau de pierre de WALL_H blocs autour du village
// (WALL_MARGIN au-delà de la zone bâtie), par tronçons de WALL_SEG cases, une torche toutes les
// 6 cases. Une porte de 3 cases au milieu de chaque côté, et partout où passe une route. Les
// maçons s'y mettent en priorité l'après-midi (dès WALL_RUSH) : le village se prépare à la nuit.
// Les maisons restent dans le mur ; plus de place : un mur plus grand (WALL_GROW cases plus
// loin), puis l'ancien est démonté (sa pierre revient à la mairie).
const WALL_H = 2, WALL_SEG = 12, WALL_AFTER = 4, WALL_MARGIN = 8, WALL_GROW = 12, WALL_RUSH = 0.25;
// Gardes (un pour GUARD_PER adultes) : la nuit, ronde dans le village ; un zombie à moins de
// GUARD_R blocs : il court le frapper (GUARD_HIT points, un coup toutes les GUARD_EVERY s)
// Circulation : un policier par carrefour (village d'au moins POLICE_AFTER adultes), un gendarme
// (village d'au moins GENDARME_AFTER adultes, avec un mur ou une plateforme) ; zone réglée autour
// de l'agent, attente d'un villageois arrêté, et le temps avant qu'on l'arrête de nouveau
const POLICE_AFTER = 10, GENDARME_AFTER = 7, TRAFFIC_R = 3.2, HOLD_T = 1.1, HOLD_COOL = 6, FAST = 8;
const policeFor = (n, roads) => (n < POLICE_AFTER || roads < 12 ? 0 : Math.min(3, 1 + Math.floor((n - POLICE_AFTER) / 15)));
const gendarmesFor = (n, V) => (n < GENDARME_AFTER || !(V.wallR || V.pad) ? 0 : n >= 20 ? 2 : 1);
const GUARD_PER = 6, GUARD_R = 28, GUARD_HIT = 5, GUARD_EVERY = 0.9;
const couriersFor = (homes) => Math.min(3, 1 + Math.floor(homes / 15));
const masonsFor = (adults) => Math.max(1, Math.ceil(adults / 6));
const leafersFor = (lumberjacks = 0) => Math.ceil(lumberjacks / 2); // (un feuilleteur pour deux bûcherons)
const guardsFor = (adults) => Math.floor((adults + 2) / GUARD_PER); // (dès 4 adultes : un garde)
const SPREAD = 4;              // le village s'étend : chantiers jusqu'à 30 + SPREAD x maisons du puits
const ANIMALS_SAFETY = 3000;   // (sécurité mémoire : au-delà, plus de naissances)
const GLASS_WANT = 16;         // vitres gardées d'avance à la mairie
const SAND_KEEP = 10;          // coins de sable connus au plus
const GROW_TIME = 1200;         // secondes avant qu'un enfant devienne adulte
const BIRTH_EVERY = 180;       // secondes entre deux naissances (au plus)
const FOOD_BIRTH = 6;          // nourriture pour une naissance
const PLAN_EVERY = 2;          // le village réfléchit toutes les PLAN_EVERY secondes
const TREE_R = 72, KEEP_TREES = 8;
const GROVE = 8;               // pousses plantées par le bûcheron (quand il n'y a plus d'arbres)
const CHOP_T = 1.1, DIG_T = 1.5, BUILD_T = 0.7, ACT_T = 1.4;
const FISH_T = [25, 45];
const CARRY_MAX = 16;          // ce qu'un villageois porte avant d'aller vider ses poches
const PACE = 1.3;              // pas pressé (au travail)
const WORK_DAY = [0.02, 0.44]; // heures de travail (0 : lever du soleil, 0.5 : coucher)
const BUILD_REACH = 5;
const CLEAR_WAIT = 90;         // un maçon attend le bûcheron au plus tant de secondes (feuilles, troncs)
const CLEAR_REACH = 5, CLEAR_T = 0.45;
const MINE_SHAFT = 48, MINE_FLOOR = 10, TUNNEL = 20, MINE_TURNS = 6;
const WOOD_KEEP = 320, STONE_KEEP = 640; // stock de la mairie au-delà duquel on arrête de couper / creuser
const MECHANIC_AFTER = 8;      // adultes avant le premier mécanicien
const PAD_R = 4;               // rayon de la plateforme de lancement
const PAD_SLOTS = [0, 2, 4];   // places de parking (côtés de la plateforme)
// Véhicules du village : au plus CARS_MAX autour de la plateforme (ou en course de taxi), un
// nouveau toutes les CAR_EVERY secondes au plus
const CARS_MAX = 2, CAR_EVERY = 120;
const VISIT_R = 700;           // un villageois peut aller visiter un village à cette distance
// Patrouille aérienne : la nuit, un garde décolle avec un véhicule de la plateforme et tourne
// au-dessus du village (AIR_H blocs plus haut), tire sur les zombies en dessous (AIR_SHOT blocs)
const AIR_H = 16, AIR_SHOT = 20, AIR_EVERY = 1.6;
const PATH_NODES = 1500;       // cases examinées au plus par recherche de chemin
// Rue principale : 3 cases de large, sur un axe qui passe par le puits (une place de gravier
// autour), qui s'allonge avec le village (STREET_STEP cases de chaque côté par chantier)
const STREET_MAX = 60, STREET_STEP = 8;
const ROAD_NODES = 6000;       // cases examinées au plus pour relier une porte à la route
const FRAME_NODES = 3000;      // ... et par image, tous villageois confondus (sinon ça attend)

// Sol naturel (on peut bâtir dessus), plantes et feuillages (on peut les enlever)
const GROUND = new Set([1, 2, 3, 8, 36, 37]);
const LEAFY = new Set([6, 39, 76, 77, 98, 144, 153, 155]);
const PLANTS = new Set([TALL_GRASS, SAPLING, 96, CHESTNUT_SAPLING, LINDEN_SAPLING, 260]);
const WOOD = [5, 97, 152], STONE = [28];
const SAPLING_OF = { 5: SAPLING, 97: CHESTNUT_SAPLING, 152: LINDEN_SAPLING, 256: 260 };
// Ce que donne un bloc creusé à la mine (0 : rien, la terre reste sur place). Seulement des
// blocs naturels : la mine ne traverse pas ce qu'un joueur a construit (sauf le plancher de
// sa propre entrée, voir mineNext).
const DIG_DROP = { 1: 0, 2: 0, 36: 0, 37: 0, 69: 0, 3: 28, 8: 8, 30: 104, 60: 60, 61: 123, 68: 68, 70: 70, 71: 71, 83: 83, 85: 85, 87: 132, [GRAVEL]: GRAVEL };
const HUT_FLOOR = { ...DIG_DROP, 18: 18 };
// Roches qu'une mine pourrait extraire (pour savoir s'il y a de la pierre sous le village)
const STONY = new Set([3, 29, 30, 60, 61, 68, 70, 71, 83, 85, 87]);
const PATH = 2; // chemin de terre (village sans pierre)
// Coût d'un bloc posé, en bûches et en pierres taillées
const WOOD_COST = { 5: 1, 97: 1, 152: 1, 18: 0.25, 99: 0.25, 154: 0.25, 33: 0.125, 35: 0.125 };
for (let k = 0; k < 6; k++) WOOD_COST[POD + k] = WOOD_COST[POD_TOP + k] = 1;
const STONE_COST = { 28: 1, 32: 0.5, 34: 0.5, [GRAVEL]: 0.25 };
const GLASS_COST = { 40: 1 };
WOOD_COST[CRAFTING_TABLE] = 1;
for (let k = 0; k < 6; k++) WOOD_COST[CHEST + k] = 2;
const GLASS = [40], SAND = [8], FUELS = [104, 5, 97, 152];

const free = (id) => id === AIR || GROUND.has(id) || PLANTS.has(id) || isNaturalLeaves(id) || isLog(id) || id === GRAVEL;
const carried = (a) => { let n = 0; for (const k in a.carry || {}) n += a.carry[k]; return n; };
const logsOf = (a) => WOOD.reduce((n, id) => n + (a.carry?.[id] || 0), 0);
function addCarry(a, id, n = 1) { if (!id) return; a.carry ||= {}; a.carry[id] = (a.carry[id] || 0) + n; }
function takeLogs(a, n) {
  for (const id of WOOD) {
    const k = Math.min(n, a.carry?.[id] || 0);
    if (!k) continue;
    a.carry[id] -= k; n -= k;
    if (!a.carry[id]) delete a.carry[id];
  }
}

// Entrée de mine : plancher et toit sur 2 cases de rayon, piliers de bûches (le centre et trois
// coins), une torche. L'escalier part de l'anneau autour du pilier central (voir mineNext).
function mineHut() {
  const out = [];
  for (let dq = -2; dq <= 2; dq++) {
    for (let dr = -2; dr <= 2; dr++) {
      if (hexDist(dq, dr) > 2) continue;
      out.push([dq, dr, 0, 18], [dq, dr, 4, 33]);
      const pillar = (dq === 0 && dr === 0) || [0, 2, 4].some((k) => DIRS6[k][0] * 2 === dq && DIRS6[k][1] * 2 === dr);
      for (let dy = 1; dy <= 3; dy++) out.push([dq, dr, dy, pillar ? 5 : AIR]);
    }
  }
  const [tq, tr] = midCell(2, 1);
  out.splice(out.findIndex((o) => o[0] === tq && o[1] === tr && o[2] === 1), 1, [tq, tr, 1, TORCH]);
  return out;
}
// Puits (comme ceux du générateur) : margelle de pierre taillée autour d'une source d'eau
const WELL = [[0, 0, 0, 7], ...DIRS6.flatMap(([a, b]) => [[a, b, 0, 28], [a, b, 1, 32]])];
// Ce que /place sait construire (en plus des structures enregistrées)
export const BUILDS = {
  village: 'un village habité (puits, mairie, quatre maisons, leurs habitants)',
  maison: 'une maison', mairie: 'la grande maison (mairie)', puits: 'un puits', mine: 'une entrée de mine', potager: 'un potager',
};
// Plateforme de lancement : un grand hexagone de pierre (planches sans pierre), un cercle de
// gravier, un bloc cible au centre, des poteaux et des torches aux six coins
function padPlan(stone) {
  const out = [];
  for (let dq = -PAD_R; dq <= PAD_R; dq++) {
    for (let dr = -PAD_R; dr <= PAD_R; dr++) {
      const d = hexDist(dq, dr);
      if (d > PAD_R) continue;
      out.push([dq, dr, 0, !d ? 243 : d === 2 ? GRAVEL : stone ? 28 : 18]);
      const corner = DIRS6.some(([a, b]) => a * PAD_R === dq && b * PAD_R === dr);
      for (let dy = 1; dy <= 6; dy++) out.push([dq, dr, dy, corner && dy === 1 ? 5 : corner && dy === 2 ? TORCH : AIR]);
    }
  }
  return out;
}
// Petit immeuble : hexagone de rayon R (3 ; l'hôtel : 4), des étages de 4 blocs. Au centre, un pilier de bûches
// et un escalier en colimaçon (une marche par bloc de hauteur, sur l'anneau autour du pilier) ;
// les planchers des étages entourent cette cage d'escalier. Fenêtres au milieu de chaque côté,
// porte au rez-de-chaussée ; une torche, un établi et un coffre à chaque étage.
function towerBlocks(storeys, wall, roof, door, win, R = 3) {
  const FH = 4, top = storeys * FH, cells = new Map();
  const put = (dq, dr, dy, id) => cells.set(dq + ',' + dr + ',' + dy, [dq, dr, dy, id]);
  const corner = (dq, dr) => DIRS6.some(([a, b]) => a * R === dq && b * R === dr);
  const side = (dq, dr) => { for (let k = 0; k < 6; k++) { const [a, b] = midCell(R, k); if (a === dq && b === dr) return k; } return -1; };
  for (let dq = -R; dq <= R; dq++) {
    for (let dr = -R; dr <= R; dr++) {
      const d = hexDist(dq, dr);
      if (d > R) continue;
      for (let st = 0; st < storeys; st++) {
        const y0 = st * FH;
        if (d === 0) put(dq, dr, y0, st ? 5 : 18);                  // pilier (et plancher en bas)
        else if (st === 0 || d >= 2) put(dq, dr, y0, 18);          // planchers autour de la cage
        else put(dq, dr, y0, AIR);
        for (let dy = 1; dy < FH; dy++) {
          if (d === R) {
            const k = side(dq, dr);
            if (!st && k === door && dy <= 2) put(dq, dr, y0 + dy, AIR);
            else if (k >= 0 && k !== door && dy === 2) put(dq, dr, y0 + dy, win);
            else put(dq, dr, y0 + dy, corner(dq, dr) ? 5 : wall);
          } else put(dq, dr, y0 + dy, d === 0 ? 5 : AIR);
        }
      }
      put(dq, dr, top, roof);
    }
  }
  // escalier : marche i (planches) à la hauteur i, en tournant autour du pilier
  for (let i = 1; i <= (storeys - 1) * FH; i++) { const [a, b] = DIRS6[i % 6]; put(a, b, i, 18); }
  for (let st = 0; st < storeys; st++) {
    const y = st * FH + 1;
    const [tq, tr] = midCell(2, (door + 3) % 6), [aq, ar] = midCell(2, (door + 2) % 6), [cq, cr] = midCell(2, (door + 4) % 6);
    put(tq, tr, y, TORCH);
    put(aq, ar, y, CRAFTING_TABLE);
    put(cq, cr, y, CHEST);
  }
  return [...cells.values()];
}
// Cases de la ligne droite entre deux cases (comprises)
function hexLine(q0, r0, q1, r1) {
  const n = hexDist(q1 - q0, r1 - r0), out = [];
  for (let i = 0; i <= n; i++) {
    const t = n ? i / n : 0;
    const x = q0 + (q1 - q0) * t, z = r0 + (r1 - r0) * t, y = -x - z;
    let rx = Math.round(x), rz = Math.round(z);
    const ry = Math.round(y), dx = Math.abs(rx - x), dy = Math.abs(ry - y), dz = Math.abs(rz - z);
    if (dx > dy && dx > dz) rx = -ry - rz; else if (dz >= dy) rz = -rx - ry;
    out.push([rx, rz]);
  }
  return out;
}
// Immeuble à boutique (voir SHOP_CAP) : un immeuble de trois étages (rayon 4), dont le
// rez-de-chaussée est fermé autour de l'escalier ; un couloir muré mène de la porte de
// l'escalier (côté door + 1) à la cage. Comptoir (et four du boulanger ou coffre du boucher)
// au fond de la boutique.
function shopLayout(door) {
  const R = 4, sd = (door + 1) % 6, [eq, er] = midCell(R, sd);
  const open = new Set(), walls = new Set();
  for (const [q, r] of hexLine(0, 0, eq, er)) if (hexDist(q, r) >= 2) open.add(ck(q, r));
  // (les murs du couloir : les cases de la boutique qui touchent le couloir ou la porte)
  for (const k of open) {
    const [q, r] = k.split(',').map(Number);
    for (const [a, b] of DIRS6) { const n = ck(q + a, r + b); if (hexDist(q + a, r + b) === 3 && !open.has(n)) walls.add(n); }
  }
  // fond de la boutique : les cases libres les plus loin de sa porte
  const [dq, dr] = midCell(R, door), back = [];
  for (let q = -3; q <= 3; q++) for (let r = -3; r <= 3; r++) if (hexDist(q, r) === 3 && !open.has(ck(q, r)) && !walls.has(ck(q, r))) back.push([q, r]);
  back.sort((x, y) => hexDist(y[0] - dq, y[1] - dr) - hexDist(x[0] - dq, x[1] - dr));
  return { R, sd, open, walls, counter: back[0], second: back[1], torch: back[2] };
}
function shopBlocks(kind, wall, roof, door, win) {
  const L = shopLayout(door), cells = new Map();
  for (const c of towerBlocks(3, wall, roof, door, win, L.R)) cells.set(c[0] + ',' + c[1] + ',' + c[2], c);
  const put = (dq, dr, dy, id) => cells.set(dq + ',' + dr + ',' + dy, [dq, dr, dy, id]);
  for (let q = -3; q <= 3; q++) {
    for (let r = -3; r <= 3; r++) {
      const d = hexDist(q, r), k = ck(q, r);
      if (d < 2) continue;
      for (let dy = 1; dy <= 3; dy++) {
        if (L.open.has(k)) put(q, r, dy, AIR);
        else if (d === 2 || L.walls.has(k)) put(q, r, dy, wall);
        else if (d === 3 && dy === 1) put(q, r, dy, AIR); // (ni coffre ni établi d'immeuble dans la boutique)
      }
    }
  }
  const [eq, er] = midCell(L.R, L.sd);
  put(eq, er, 1, AIR); put(eq, er, 2, AIR); // porte de l'escalier
  put(...L.counter, 1, CRAFTING_TABLE);
  put(...L.second, 1, kind === 'bakery' ? facingVariant(FURNACE, sideToward(...L.second, 0, 0)) : facingVariant(CHEST, sideToward(...L.second, 0, 0)));
  put(...L.torch, 1, TORCH);
  return [...cells.values()];
}
// Grange : une grande maison (rayon BARN_R) avec des coffres tout le long des murs
function barnBlocks(wall, roof, door) {
  const R = BARN_R, out = houseBlocks(R, wall, roof, door);
  const [dq, dr] = midCell(R, door);
  for (let q = -R; q <= R; q++) {
    for (let r = -R; r <= R; r++) {
      if (hexDist(q, r) !== R - 1 || hexDist(q - dq, r - dr) <= 2) continue;
      out.push([q, r, 1, facingVariant(CHEST, sideToward(q, r, 0, 0))]);
    }
  }
  return out;
}
// Pépinière : un enclos hexagonal (murs de planches de 3 blocs, poteaux de bûches et torches aux
// coins, une porte), sol d'herbe, à ciel ouvert ; 7 places pour les arbres (espacées de 3)
const GROVE_SPOTS = [[0, 0], [3, 0], [-3, 0], [0, 3], [0, -3], [3, -3], [-3, 3]];
function groveBlocks(door) {
  const R = GROVE_R, out = [];
  const corner = (q, r) => DIRS6.some(([a, b]) => a * R === q && b * R === r);
  const [dq, dr] = midCell(R, door);
  for (let q = -R; q <= R; q++) {
    for (let r = -R; r <= R; r++) {
      const d = hexDist(q, r);
      if (d > R) continue;
      out.push([q, r, -1, d < R ? 1 : 18]); // (sol d'herbe ; sous le mur, des planches)
      if (d < R) continue;
      const isDoor = hexDist(q - dq, r - dr) <= 1;
      for (let y = 0; y < 3; y++) out.push([q, r, y, isDoor && y < 2 ? AIR : corner(q, r) ? 5 : 18]);
      if (corner(q, r)) out.push([q, r, 3, TORCH]);
    }
  }
  return out;
}
// Grand immeuble : S étages de 4 blocs (rayon APT_R). Rez-de-chaussée : un hall ; aux étages,
// un palier (anneau 2) autour de l'escalier, fermé par une cloison (anneau 3) percée de deux
// portes, une par appartement ; les deux appartements sont séparés par un mur (l'axe des coins
// door et door + 3). Pilier et escalier en colimaçon au centre, fenêtres sur chaque côté.
function apartmentBlocks(S, wall, roof, door, win) {
  const R = APT_R, FH = STOREY_H, top = S * FH, cells = new Map();
  const put = (q, r, y, id) => cells.set(q + ',' + r + ',' + y, [q, r, y, id]);
  const corner = (q, r) => DIRS6.some(([a, b]) => a * R === q && b * R === r);
  const side = (q, r) => { for (let k = 0; k < 6; k++) { const [a, b] = midCell(R, k); if (a === q && b === r) return k; } return -1; };
  const split = new Set();
  for (let k = 4; k < R; k++) for (const d of [door, (door + 3) % 6]) split.add(ck(DIRS6[d][0] * k, DIRS6[d][1] * k));
  const aptDoors = new Set([(door + 1) % 6, (door + 4) % 6].map((k) => ck(...midCell(3, k))));
  for (let q = -R; q <= R; q++) {
    for (let r = -R; r <= R; r++) {
      const d = hexDist(q, r), k = ck(q, r);
      if (d > R) continue;
      for (let st = 0; st < S; st++) {
        const y0 = st * FH;
        put(q, r, y0, d === 0 ? (st ? 5 : 18) : d === 1 && st ? AIR : 18);
        for (let dy = 1; dy < FH; dy++) {
          let id = AIR;
          if (d === R) {
            const sd = side(q, r);
            if (!st && sd === door && dy <= 2) id = AIR;
            else if (sd >= 0 && (st || sd !== door) && dy === 2) id = win;
            else id = corner(q, r) ? 5 : wall;
          } else if (d === 0) id = 5;
          else if (st && d === 3) id = aptDoors.has(k) && dy <= 2 ? AIR : wall;
          else if (st && split.has(k)) id = wall;
          put(q, r, y0 + dy, id);
        }
      }
      put(q, r, top, roof);
    }
  }
  for (let i = 1; i <= (S - 1) * FH; i++) { const [a, b] = DIRS6[i % 6]; put(a, b, i, 18); }
  // torches : le palier, et une dans chaque appartement
  for (let st = 0; st < S; st++) {
    const y = st * FH + 1;
    put(...midCell(2, (door + 3) % 6), y, TORCH);
    if (st) for (const k of [(door + 1) % 6, (door + 4) % 6]) put(...midCell(4, k), y, TORCH);
  }
  return [...cells.values()];
}
// Côté d'une case par rapport au mur qui sépare les deux appartements (0 ou 1)
function aptHalf(h, q, r) {
  const c = hexToWorld(q - h.q, r - h.r), a = hexToWorld(...DIRS6[h.door]);
  return c.x * a.z - c.z * a.x > 0 ? 1 : 0;
}
// École : une grande salle (rayon SCHOOL_R), un tableau (blocs sombres) au fond, des pupitres
// (établis) ; les places des élèves : l'anneau 1 et le centre, et quelques-unes de l'anneau 3
function schoolPlan(door) {
  const R = SCHOOL_R, back = (door + 3) % 6, [bq, br] = midCell(R - 1, back), [dq, dr] = midCell(R - 1, door);
  const out = houseBlocks(R, 18, 33, door);
  for (let q = -R; q <= R; q++) for (let r = -R; r <= R; r++) {
    const d = hexDist(q, r);
    if (d === R - 1 && hexDist(q - bq, r - br) <= 1) out.push([q, r, 2, 86], [q, r, 3, 86]); // (le tableau)
    if (d === 2 && hexDist(q - bq, r - br) >= 3 && hexDist(q - dq, r - dr) >= 3) out.push([q, r, 1, CRAFTING_TABLE]); // (pupitres)
  }
  return out;
}
function schoolSeats(S) {
  const out = [[S.q, S.r]], [dq, dr] = midCell(SCHOOL_R - 1, S.door);
  for (const [a, b] of DIRS6) out.push([S.q + a, S.r + b]);
  for (let q = -3; q <= 3; q++) for (let r = -3; r <= 3; r++) if (hexDist(q, r) === 3 && hexDist(q - dq, r - dr) >= 3) out.push([S.q + q, S.r + r]);
  return out.map(([q, r]) => [q, r, S.y + 1]);
}
// Hôpital : murs de laine blanche, des lits de villageois le long des murs (ouverts vers le centre)
function hospitalPlan(door) {
  const R = HOSPITAL_R, out = houseBlocks(R, 194, 33, door), [dq, dr] = midCell(R - 1, door);
  let n = 0;
  for (let q = -R; q <= R; q++) for (let r = -R; r <= R; r++) {
    if (hexDist(q, r) !== R - 1 || hexDist(q - dq, r - dr) < 3 || (q + 2 * r) % 2) continue;
    const k = sideToward(q, r, 0, 0);
    out.push([q, r, 1, POD + k], [q, r, 2, POD_TOP + k]);
    if (++n >= 6) break;
  }
  return out;
}
// Poste : une petite maison, trois lits (les livreurs y dorment) et un coffre
function postPlan(door, wall, roof) {
  const out = houseBlocks(POST_R, wall, roof, door);
  for (const k of [2, 3, 4]) { const [q, r] = DIRS6[(door + k) % 6], s = sideToward(q, r, 0, 0); out.push([q, r, 1, POD + s], [q, r, 2, POD_TOP + s]); }
  const [cq, cr] = DIRS6[(door + 1) % 6];
  out.push([cq, cr, 1, facingVariant(CHEST, sideToward(cq, cr, 0, 0))]);
  return out;
}
// Champ : un trou d'eau, deux anneaux de terre labourée, une bordure de dalles
function fieldPlan() {
  const out = [[0, 0, -1, 7]];
  for (let dq = -FIELD_R; dq <= FIELD_R; dq++) {
    for (let dr = -FIELD_R; dr <= FIELD_R; dr++) {
      const d = hexDist(dq, dr);
      if (d >= 1 && d < FIELD_R) out.push([dq, dr, -1, FARMLAND]);
      else if (d === FIELD_R) out.push([dq, dr, 0, 33]);
    }
  }
  return out;
}
// Potager : un trou d'eau entouré de six cases de terre (les cultures), bordure de dalles
function gardenPlan() {
  const out = [[0, 0, -1, 7]];
  for (const [a, b] of DIRS6) out.push([a, b, -1, FARMLAND]); // (le blé et les pommes de terre)
  for (let dq = -2; dq <= 2; dq++) for (let dr = -2; dr <= 2; dr++) if (hexDist(dq, dr) === 2) out.push([dq, dr, 0, 33]);
  return out;
}

// Côté de la case (q, r) tourné vers le point (x, z) (face avant d'un coffre)
function sideToward(q, r, x, z) {
  const c = hexToWorld(q, r), dx = x - c.x, dz = z - c.z;
  let best = 0, bestDot = -Infinity;
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i, d = dx * Math.cos(a) + dz * Math.sin(a);
    if (d > bestDot) { bestDot = d; best = i; }
  }
  return best;
}

// Cases à moins de TREE_R du centre, des plus proches aux plus lointaines (recherche d'arbres)
let SPIRAL = null;
function spiral() {
  if (SPIRAL) return SPIRAL;
  SPIRAL = [];
  for (let dq = -TREE_R; dq <= TREE_R; dq++) for (let dr = -TREE_R; dr <= TREE_R; dr++) if (hexDist(dq, dr) <= TREE_R) SPIRAL.push([dq, dr]);
  SPIRAL.sort((a, b) => hexDist(a[0], a[1]) - hexDist(b[0], b[1]));
  return SPIRAL;
}

export class Colony {
  constructor(animals, species) {
    this.animals = animals;
    this.species = species;
    this.world = animals.world;
    this.containers = null;   // coffres (voir main.js)
    this.villages = new Map(); // clé -> village
    this.planted = new Set();  // pousses plantées par un joueur ("q,r,y") : le forestier n'y touche pas
    this.players = [];
    this.clock = 0;
  }

  clear() { this.villages.clear(); this.planted.clear(); }
  // Un joueur a planté une pousse ici (voir main.js)
  markPlanted(q, r, y) { this.planted.add(q + ',' + r + ',' + y); if (this.planted.size > 5000) this.planted.delete(this.planted.values().next().value); }
  // Une pousse que le forestier peut arracher : sauvage (pas plantée par le village ni par un
  // joueur) et dans le village (dans son mur, sinon dans la zone bâtie) : les forêts autour
  // repoussent librement
  wildSapling(V, q, r, y) {
    if (this.planted.has(q + ',' + r + ',' + y)) return false;
    // (avec une pépinière : toutes les pousses du village hors de la pépinière ; sans : celles qui
    // n'ont pas été plantées par les bûcherons)
    if (V.grove ? this.inGrove(V, q, r) : V.saplings?.some((p) => p[0] === q && p[1] === r)) return false;
    return this.inVillage(V, q, r);
  }
  // Le village (son mur, sinon la zone bâtie) ; la pépinière (son enclos)
  villageR(V) { return V.wallR || Math.ceil(this.reach(V) / 0.866); }
  inVillage(V, q, r) { return hexDist(q - V.q, r - V.r) <= this.villageR(V); }
  inGrove(V, q, r) { return !!V.grove && hexDist(q - V.grove.q, r - V.grove.r) < V.grove.rad; }
  // Les places des arbres de la pépinière : [q, r, y] (y : au-dessus du sol)
  groveSpots(V) { return V.grove ? GROVE_SPOTS.map(([a, b]) => [V.grove.q + a, V.grove.r + b, V.grove.y]) : []; }
  // Avec une pépinière : on repère petit à petit, dans tout le village, les arbres (V.trees,
  // marqués junk), les feuilles (V.junkLeaves) et les pousses (V.wild) hors de la pépinière
  scanJunk(V) {
    if (!V.grove) return;
    const S = spiral(), R = this.villageR(V);
    V.junkLeaves = (V.junkLeaves || []).filter(([q, r, y]) => this.loaded(q, r) && isNaturalLeaves(this.get(q, r, y)));
    V.wild ||= [];
    for (let n = 0; n < JUNK_SCAN; n++) {
      const [dq, dr] = S[V.junkScan = ((V.junkScan || 0) + 1) % S.length];
      if (hexDist(dq, dr) > R) { V.junkScan = 0; break; } // (spirale : au-delà, plus rien du village)
      const q = V.q + dq, r = V.r + dr;
      if (!this.loaded(q, r) || this.inGrove(V, q, r)) continue;
      const s = this.world.surface(q, r);
      if (isWater(s.id)) continue;
      let leaf = false;
      for (let y = s.h, k = 0; k < 30 && y > 1; k++, y--) {
        const id = this.get(q, r, y);
        if (isNaturalLeaves(id)) {
          if (!leaf && V.junkLeaves.length < JUNK_KEEP) { V.junkLeaves.push([q, r, y]); leaf = true; }
          continue;
        }
        if (WILD_SAPLINGS.has(id)) { if (V.wild.length < 24 && this.wildSapling(V, q, r, y) && !V.wild.some((p) => p[0] === q && p[1] === r)) V.wild.push([q, r, y]); break; }
        if (isLog(id)) {
          // un tronc posé au sol : un arbre à abattre (une bûche posée par un joueur, une
          // maison : pas un arbre, isTree le vérifie)
          if (GROUND.has(this.get(q, r, y - 1))) {
            if (this.isTree(q, r, y) && !V.trees.some((t) => t.q === q && t.r === r)) V.trees.push({ q, r, y, claim: 0, until: 0, junk: true });
            break;
          }
          continue;
        }
        if (id === AIR || PLANTS.has(id)) continue;
        break;
      }
    }
  }

  workTime() {
    const t = this.animals.talk.time();
    return t >= WORK_DAY[0] && t < WORK_DAY[1];
  }
  say(a, k, p = 1) { if (a && Math.random() < p) this.animals.talk.say(a, k); }
  get(q, r, y) { return this.world.getBlock(q, r, y); }
  set(q, r, y, id) { return this.world.setBlock(q, r, y, id); }
  loaded(q, r) { return this.world.isLoaded?.(q, r) ?? true; }

  // ---------- Villages ----------
  // Village du villageois (créé au besoin à partir de celui du générateur), ou null : un
  // villageois né d'un œuf rejoint le village le plus proche (à moins de JOIN_R blocs, même un
  // village posé avec /place) et s'y installe ; loin de tout village, il vit comme avant
  villageOf(a) {
    if (!a.home) return null;
    // (sans village : on recherche toutes les 10 s, un village a pu être posé ou s'être chargé)
    const retry = a.vk === null && this.clock - (a.vkT ?? -99) > 10;
    if (a.vk === undefined || retry || (a.vk && !this.villages.has(a.vk))) {
      a.vkT = this.clock;
      let best = null, bd = JOIN_R;
      for (const V of this.villages.values()) {
        const d = Math.hypot(V.x - a.home.x, V.z - a.home.z);
        if (d < bd) { bd = d; best = V; }
      }
      const v = best ? null : this.world.gen?.villagesNear?.(a.home.x, a.home.z, JOIN_R)?.[0];
      a.vk = best ? best.key : v ? v.key : null;
      if (v && !this.villages.has(v.key) && v.houses) this.villages.set(v.key, this.create(v));
      // (il vit désormais autour du puits de ce village)
      const V = a.vk && this.villages.get(a.vk);
      if (V) a.home = { x: V.x, z: V.z };
    }
    return a.vk ? this.villages.get(a.vk) || null : null;
  }

  create(v) {
    const c = hexToWorld(v.q, v.r);
    const houses = v.houses.map((h) => (STOREYED.has(h.kind) ? { q: h.q, r: h.r, y: h.y, rad: h.rad, door: h.door, kind: h.kind, cap: CAP_OF[h.kind], ...(SHOPS.includes(h.shop) ? { shop: h.shop } : {}) } : { q: h.q, r: h.r, y: h.y, rad: h.rad, door: h.door }));
    return {
      key: v.key, q: v.q, r: v.r, y: v.y, x: c.x, z: c.z, houses,
      hallI: houses.findIndex((h) => h.rad >= 3), // la grande maison : la mairie
      hall: [], mine: null, oldMines: [], fields: [], projects: [], roads: [], roadSet: new Set(),
      pantry: { wheat: 0, potato: 0, bread: 0, baked: 0 }, lamps: [], // (garde-manger de la boulangerie, lampadaires)
      food: 4, birthT: BIRTH_EVERY / 2, failT: 0, planT: 0,
      trees: [], scan: 0, fish: null, members: [],
      clearing: new Set(), // feuilles et troncs qui gênent un chantier ("q,r,y") : pour les bûcherons
      wallR: 0, wallDone: [], oldWallR: null, // mur d'enceinte : rayon, tronçons finis, ancien mur à démonter
      barn: null, wild: [], // la grange (ses coffres) ; jeunes pousses sauvages repérées (pour le forestier)
    };
  }

  serialize() {
    const out = [...this.villages.values()].map((V) => ({
      key: V.key, q: V.q, r: V.r, y: V.y, houses: V.houses, hallI: V.hallI, steps: V.steps, hall: V.hall, mine: V.mine, oldMines: V.oldMines,
      fields: V.fields, pantry: V.pantry, lamps: V.lamps, projects: V.projects, roads: V.roads, saplings: V.saplings || [], stoneless: V.stoneless, sands: V.sands || [], furnace: V.furnace || null, pad: V.pad || null, roadSet: [...V.roadSet], food: V.food, birthT: V.birthT,
      axis: V.axis, mainLen: V.mainLen || 0, streetStop: V.streetStop || [false, false],
      wallR: V.wallR || 0, wallDone: V.wallDone, oldWallR: V.oldWallR || 0, barn: V.barn || null, grove: V.grove || null,
      school: V.school || null, hospital: V.hospital || null, post: V.post || null,
    }));
    if (out.length && this.planted.size) out[0].planted = [...this.planted];
    return out;
  }

  load(list) {
    this.villages.clear();
    this.planted.clear();
    if (!Array.isArray(list)) return;
    for (const d of list) {
      if (!d || typeof d.key !== 'string' || !Number.isFinite(d.q) || !Number.isFinite(d.r) || !Array.isArray(d.houses)) continue;
      const V = this.create({ key: d.key, q: d.q, r: d.r, y: d.y, houses: d.houses.filter((h) => h && [h.q, h.r, h.y, h.rad, h.door].every(Number.isFinite)) });
      V.hallI = Number.isInteger(d.hallI) ? d.hallI : V.hallI;
      V.steps = !!d.steps;
      if (typeof d.stoneless === 'boolean') V.stoneless = d.stoneless;
      V.sands = Array.isArray(d.sands) ? d.sands.filter((p) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite)) : [];
      V.pad = d.pad && [d.pad.q, d.pad.r, d.pad.y].every(Number.isFinite) ? { q: d.pad.q, r: d.pad.r, y: d.pad.y, cars: [] } : null;
      V.furnace = Array.isArray(d.furnace) && d.furnace.length === 3 && d.furnace.every(Number.isFinite) ? d.furnace : null;
      for (const h of V.houses) if (!STOREYED.has(h.kind)) { delete h.kind; delete h.cap; }
      V.hall = Array.isArray(d.hall) ? d.hall.filter((p) => Array.isArray(p) && p.length === 3 && p.every(Number.isFinite)) : [];
      V.mine = d.mine && Number.isFinite(d.mine.q) && Array.isArray(d.mine.path) ? d.mine : null;
      V.oldMines = Array.isArray(d.oldMines) ? d.oldMines : [];
      // champs (l'ancien potager d'une sauvegarde : le premier champ)
      const okField = (F) => F && Number.isFinite(F.q) && Number.isFinite(F.r) && Array.isArray(F.cells);
      V.fields = (Array.isArray(d.fields) ? d.fields : []).filter(okField);
      if (okField(d.garden)) V.fields.unshift({ q: d.garden.q, r: d.garden.r, rad: 2, cells: d.garden.cells });
      const pt = d.pantry || {};
      V.pantry = { wheat: pt.wheat | 0, potato: pt.potato | 0, bread: pt.bread | 0, baked: pt.baked | 0 };
      V.lamps = Array.isArray(d.lamps) ? d.lamps.filter((p) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite)) : [];
      V.projects = Array.isArray(d.projects) ? d.projects.filter((p) => p && Array.isArray(p.ops) && Number.isInteger(p.i)) : [];
      V.roads = Array.isArray(d.roads) ? d.roads : [];
      V.saplings = Array.isArray(d.saplings) ? d.saplings.filter((p) => Array.isArray(p) && p.length === 3) : [];
      V.roadSet = new Set(Array.isArray(d.roadSet) ? d.roadSet : []);
      if ([0, 1, 2].includes(d.axis)) V.axis = d.axis;
      V.mainLen = Number.isInteger(d.mainLen) ? d.mainLen : 0;
      V.streetStop = Array.isArray(d.streetStop) ? d.streetStop.map(Boolean) : [false, false];
      V.wallR = Number.isInteger(d.wallR) && d.wallR > 0 ? d.wallR : 0;
      V.wallDone = Array.isArray(d.wallDone) ? d.wallDone.filter(Number.isInteger) : [];
      V.oldWallR = Number.isInteger(d.oldWallR) && d.oldWallR > 0 ? d.oldWallR : null;
      V.barn = d.barn && [d.barn.q, d.barn.r, d.barn.y, d.barn.rad, d.barn.door].every(Number.isFinite) && Array.isArray(d.barn.chests)
        ? { q: d.barn.q, r: d.barn.r, y: d.barn.y, rad: d.barn.rad, door: d.barn.door, chests: d.barn.chests.filter((p) => Array.isArray(p) && p.length === 3 && p.every(Number.isFinite)) } : null;
      V.grove = d.grove && [d.grove.q, d.grove.r, d.grove.y, d.grove.rad, d.grove.door].every(Number.isFinite)
        ? { q: d.grove.q, r: d.grove.r, y: d.grove.y, rad: d.grove.rad, door: d.grove.door } : null;
      for (const k of ['school', 'hospital', 'post']) {
        const B = d[k];
        V[k] = B && [B.q, B.r, B.y, B.rad, B.door].every(Number.isFinite) ? { q: B.q, r: B.r, y: B.y, rad: B.rad, door: B.door } : null;
      }
      V.food = Number.isFinite(d.food) ? d.food : 4;
      V.birthT = Number.isFinite(d.birthT) ? d.birthT : BIRTH_EVERY;
      if (Array.isArray(d.planted)) for (const k of d.planted.slice(0, 5000)) if (typeof k === 'string') this.planted.add(k);
      this.villages.set(V.key, V);
    }
  }

  homes(V) { return V.houses.filter((_, i) => i !== V.hallI); }
  houseOf(V, a) { return a.house ? V.houses.find((h, i) => i !== V.hallI && ck(h.q, h.r) === a.house) || null : null; }

  // Cases de l'anneau `ring` d'une maison, de la plus éloignée de la porte à la plus proche
  // (au niveau du plancher + 1) : établi et coffres
  slots(h, ring) {
    const [dq, dr] = midCell(h.rad, h.door), out = [];
    for (let a = -ring; a <= ring; a++) for (let b = -ring; b <= ring; b++) if (hexDist(a, b) === ring) out.push([a, b]);
    out.sort((u, v) => hexDist(v[0] - dq, v[1] - dr) - hexDist(u[0] - dq, u[1] - dr) || u[0] - v[0] || u[1] - v[1]);
    return out.map(([a, b]) => [h.q + a, h.r + b, h.y + 1]);
  }
  tableAt(h) { return this.slots(h, h.rad - 1)[0]; }
  // ---------- Lits ----------
  // Hauteurs où l'on se tient à chaque étage habité (une boutique : pas au rez-de-chaussée)
  floors(h) {
    const list = h.kind === 'apartment' ? Array.from({ length: (h.storeys || 5) - 1 }, (_, i) => i + 1) : FLOORS_OF[h.kind] || [0];
    return list.map((s) => h.y + 1 + s * STOREY_H);
  }
  bedsWanted(h) { return h.kind === 'apartment' ? aptCap(h.storeys || 5) : BEDS_OF[h.kind || 'house'] || HOUSE_CAP; }
  // Les lits posés dans le bâtiment : [q, r, y] du bas de chaque lit (recomptés quand il est
  // chargé ; sinon h.beds reste celui du dernier comptage)
  countBeds(h) {
    if (!this.loaded(h.q, h.r)) return h.beds || null;
    const out = [], R = h.rad - 1;
    for (const y of this.floors(h)) {
      for (let a = -R; a <= R; a++) for (let b = -R; b <= R; b++) {
        if (hexDist(a, b) > R) continue;
        const B = BLOCKS[this.get(h.q + a, h.r + b, y)];
        if (B?.pod !== undefined && !B.podTop) out.push([h.q + a, h.r + b, y]);
      }
    }
    h.beds = out;
    return out;
  }
  // Où poser les lits qui manquent : [q, r, y, côté de l'ouverture]. Contre les murs (l'anneau
  // intérieur), sans couper le passage : chaque lit garde une case libre devant son ouverture,
  // et tout ce qu'on pouvait atteindre à l'étage (porte, escalier, établi, coffre) le reste.
  bedPlan(h, n) {
    const out = [], R = h.rad - 1, storeyed = STOREYED.has(h.kind);
    if (!this.loaded(h.q, h.r) || n <= 0) return out;
    const inside = (q, r) => hexDist(q - h.q, r - h.r) <= R;
    // (grand immeuble : APT_BEDS lits dans chaque appartement)
    const perHalf = h.kind === 'apartment' ? APT_BEDS : Infinity;
    for (const y of this.floors(h)) {
      if (out.length >= n) break;
      const taken = new Set(), entries = new Set(), halves = [0, 0];
      for (let a = -R; a <= R; a++) for (let b = -R; b <= R; b++) if (hexDist(a, b) <= R && isPod(this.get(h.q + a, h.r + b, y)) && perHalf < Infinity) halves[aptHalf(h, h.q + a, h.r + b)]++;
      const open = (q, r) => inside(q, r) && !taken.has(ck(q, r)) && this.stand(q, r, y);
      // d'où l'on arrive : la porte (rez-de-chaussée), sinon l'escalier (autour du pilier)
      const starts = [];
      if (y === h.y + 1) { const [dq, dr] = midCell(R, h.door); if (open(h.q + dq, h.r + dr)) starts.push([h.q + dq, h.r + dr]); }
      if (!starts.length) for (const [a, b] of NEIGHBORS) if (open(h.q + a, h.r + b)) starts.push([h.q + a, h.r + b]);
      if (!starts.length && open(h.q, h.r)) starts.push([h.q, h.r]);
      if (!starts.length) continue;
      // (cases atteignables, et leur distance à l'arrivée)
      const reach = () => {
        const seen = new Map(starts.filter(([q, r]) => open(q, r)).map(([q, r]) => [ck(q, r), 0]));
        const todo = [...seen.keys()].map((k) => k.split(',').map(Number));
        for (let i = 0; i < todo.length; i++) {
          const [q, r] = todo[i], d = seen.get(ck(q, r));
          for (const [a, b] of NEIGHBORS) { const k = ck(q + a, r + b); if (!seen.has(k) && open(q + a, r + b)) { seen.set(k, d + 1); todo.push([q + a, r + b]); } }
        }
        return seen;
      };
      // (établi, coffres, four : on doit toujours pouvoir s'en approcher)
      const furniture = [];
      for (let a = -R; a <= R; a++) for (let b = -R; b <= R; b++) {
        const id = this.get(h.q + a, h.r + b, y);
        if (hexDist(a, b) <= R && (id === CRAFTING_TABLE || BLOCKS[id]?.container)) furniture.push([h.q + a, h.r + b]);
      }
      const usable = (set) => furniture.every(([q, r]) => NEIGHBORS.some(([a, b]) => set.has(ck(q + a, r + b))));
      let seen = reach();
      const needF = !storeyed && usable(seen); // (dans un immeuble, l'établi et le coffre d'étage ne servent à personne)
      const ring = [];
      for (let a = -R; a <= R; a++) for (let b = -R; b <= R; b++) if (hexDist(a, b) === R) ring.push([h.q + a, h.r + b]);
      // (les plus loin de la porte ou de l'escalier d'abord : le bout des couloirs)
      const far = (c) => seen.get(ck(c[0], c[1])) ?? -1;
      ring.sort((u, v) => far(v) - far(u) || u[0] - v[0] || u[1] - v[1]);
      for (const [q, r] of ring) {
        if (out.length >= n) break;
        if (halves[aptHalf(h, q, r)] >= perHalf) continue;
        const k = ck(q, r);
        if (!seen.has(k) || entries.has(k) || !this.stand(q, r, y, true) || starts.some(([sq, sr]) => sq === q && sr === r)) continue;
        // l'ouverture : une case voisine atteignable (vers le centre de préférence ; à l'étage d'un
        // immeuble, pas dans la cage d'escalier)
        let side = -1, sd = Infinity;
        NEIGHBORS.forEach(([a, b], i) => {
          const eq = q + a, er = r + b, d = hexDist(eq - h.q, er - h.r);
          if (!seen.has(ck(eq, er)) || (storeyed && d < 2)) return;
          if (d < sd) { sd = d; side = i; }
        });
        if (side < 0) continue;
        taken.add(k);
        const after = reach();
        if (after.size !== seen.size - 1 || (needF && !usable(after))) { taken.delete(k); continue; }
        seen = after;
        entries.add(ck(q + NEIGHBORS[side][0], r + NEIGHBORS[side][1]));
        out.push([q, r, y, side]);
        halves[aptHalf(h, q, r)]++;
      }
    }
    return out;
  }
  // Peut-on se tenir dans la case ? (blocs du monde ; pas sur un lit ; une torche, de l'herbe :
  // on passe) ; empty : rien du tout (pour y poser un lit)
  stand(q, r, y, empty = false) {
    const here = this.get(q, r, y), up = this.get(q, r, y + 1), down = this.get(q, r, y - 1);
    if (empty ? here !== AIR || up !== AIR : SOLID[here] || SOLID[up] || isWater(here) || isLava(here)) return false;
    return !!SOLID[down] && !isPod(down);
  }
  // Chantier de lits : les blocs à poser dans les bâtiments qui en manquent (les plus en manque
  // d'abord), le bas puis le haut de chaque lit
  bedOps(V) {
    const ops = [], homes = [];
    for (const h of this.homes(V)) {
      if (!this.loaded(h.q, h.r)) continue;
      const have = this.countBeds(h)?.length || 0;
      if (have < this.bedsWanted(h)) homes.push([h, this.bedsWanted(h) - have]);
    }
    homes.sort((x, y) => y[1] - x[1]);
    for (const [h, n] of homes) {
      if (ops.length / 2 >= BED_BATCH) break;
      for (const [q, r, y, k] of this.bedPlan(h, Math.min(n, BED_BATCH - ops.length / 2))) ops.push([q, r, y, POD + k], [q, r, y + 1, POD_TOP + k]);
    }
    return ops;
  }
  chestAt(h) { return this.slots(h, h.rad - 1)[1]; }
  // Habitants : autant que de lits (pas encore comptés : ce que le bâtiment devrait en avoir)
  capOf(h) { return h.beds ? h.beds.length : h.cap || HOUSE_CAP; }
  hasTable(h) { if (STOREYED.has(h.kind)) return true; const p = this.tableAt(h); return !this.loaded(p[0], p[1]) || this.get(...p) === CRAFTING_TABLE; }
  hasChest(h) { if (STOREYED.has(h.kind)) return true; const p = this.chestAt(h); return !this.loaded(p[0], p[1]) || BLOCKS[this.get(...p)]?.container === 'chest'; }

  // ---------- Coffres ----------
  box(p) { return this.containers?.at(p[0], p[1], p[2]) || null; }
  hallBoxes(V) {
    V.hall = V.hall.filter((p) => !this.loaded(p[0], p[1]) || BLOCKS[this.get(...p)]?.container === 'chest');
    return V.hall.map((p) => this.box(p)).filter(Boolean);
  }
  hallOk(V) { return V.hall.length > 0 && this.hallBoxes(V).length > 0; }
  barnBoxes(V) {
    if (!V.barn) return [];
    V.barn.chests = V.barn.chests.filter((p) => !this.loaded(p[0], p[1]) || BLOCKS[this.get(...p)]?.container === 'chest');
    return V.barn.chests.map((p) => this.box(p)).filter(Boolean);
  }
  count(boxes, ids) {
    let n = 0;
    for (const b of boxes) for (const s of b.slots) if (s && ids.includes(s.id)) n += s.n;
    return n;
  }
  take(boxes, ids, n) {
    for (const b of boxes) {
      for (let i = 0; i < b.slots.length && n > 0; i++) {
        const s = b.slots[i];
        if (!s || !ids.includes(s.id)) continue;
        const k = Math.min(n, s.n);
        s.n -= k; n -= k;
        if (!s.n) b.slots[i] = null;
      }
    }
    this.world.changed = true;
  }
  // Range n objets id dans le coffre ; renvoie ce qui n'y rentre pas
  put(box, id, n) {
    const max = ITEMS[id]?.stack ?? 64;
    for (const s of box.slots) {
      if (!n) break;
      if (s && s.id === id && s.n < max && !s.w) { const k = Math.min(n, max - s.n); s.n += k; n -= k; }
    }
    for (let i = 0; i < box.slots.length && n; i++) {
      if (box.slots[i]) continue;
      const k = Math.min(n, max);
      box.slots[i] = { id, n: k };
      n -= k;
    }
    this.world.changed = true;
    return n;
  }
  // Vide ses poches dans ces coffres (la mairie : un coffre de plus s'ils sont pleins)
  unload(a, boxes, V = null) {
    for (const k of Object.keys(a.carry || {})) {
      let n = a.carry[k];
      for (const b of boxes) if (n) n = this.put(b, +k, n);
      // (plein : un coffre de plus, autant qu'il en faut)
      while (n && V) { const b = this.newHallChest(V); if (!b) break; n = this.put(b, +k, n); }
      delete a.carry[k];
    }
  }
  // Les coffres sont pleins : un coffre de plus dans la mairie (tant qu'il y a de la place)
  newHallChest(V) {
    for (const p of this.hallSpots(V)) {
      if (V.hall.some((h) => h[0] === p[0] && h[1] === p[1] && h[2] === p[2])) continue;
      if (this.get(p[0], p[1], p[2]) !== AIR) continue;
      // (deuxième rangée : seulement posé sur un coffre)
      if (p[3] && BLOCKS[this.get(p[0], p[1], p[2] - 1)]?.container !== 'chest') continue;
      const b = this.placeChest(V, [p[0], p[1], p[2]]);
      if (b) this.say(V.members.find((m) => m.active && m.type === 'villager'), 'look', 0.3);
      return b;
    }
    return null;
  }
  // Où vont les coffres de la mairie, dans l'ordre : le long des murs de la grande maison (loin
  // de la porte d'abord), puis plus près du centre (sans boucher l'entrée, ni prendre la torche
  // du centre ou la place du four), puis une deuxième rangée posée sur les premiers coffres
  // ([q, r, y, 1]). Sans mairie : autour du puits.
  hallSpots(V) {
    const h = V.houses[V.hallI];
    let floor;
    if (h) {
      const [dq, dr] = midCell(h.rad, h.door), dq0 = h.q + dq, dr0 = h.r + dr;
      const inner = h.rad > 2 ? this.slots(h, h.rad - 2) : [];
      const oven = V.furnace || inner[0]; // (place du four, gardée même s'il n'est pas encore fait)
      floor = [...this.slots(h, h.rad - 1), ...inner]
        // (un couloir reste libre de la porte au centre : on peut toujours entrer, et le four
        // reste accessible)
        .filter((p) => hexDist(p[0] - dq0, p[1] - dr0) > 1 && hexDist(p[0] - dq0, p[1] - dr0) + hexDist(p[0] - h.q, p[1] - h.r) > hexDist(dq0 - h.q, dr0 - h.r)
          && !(oven && p[0] === oven[0] && p[1] === oven[1]));
    } else {
      floor = DIRS6.map(([a, b]) => {
        const q = V.q + a * 3, r = V.r + b * 3, g = this.groundAt(q, r);
        return [q, r, g ? g.y + 1 : V.y + 1];
      });
    }
    return [...floor, ...floor.map(([q, r, y]) => [q, r, y + 1, 1])];
  }
  placeChest(V, p, house = V.houses[V.hallI]) {
    const c = house ? hexToWorld(house.q, house.r) : { x: V.x, z: V.z };
    // (vers le centre de la maison ; à côté du puits : dos au puits)
    const k = house ? sideToward(p[0], p[1], c.x, c.z) : (sideToward(p[0], p[1], c.x, c.z) + 3) % 6;
    if (!this.set(p[0], p[1], p[2], facingVariant(CHEST, k))) return null;
    if (V && (!house || house === V.houses[V.hallI])) V.hall.push(p);
    return this.box(p);
  }

  // ---------- Terrain ----------
  // Sol de la colonne (sous les arbres et les plantes) : { y, id }, ou null (pas chargée)
  groundAt(q, r) {
    if (!this.loaded(q, r)) return null;
    let y = this.world.surface(q, r).h;
    for (let n = 0; n < 32 && y > 0; n++, y--) {
      const id = this.get(q, r, y);
      if (id === AIR || LEAFY.has(id) || isLog(id) || PLANTS.has(id) || (!SOLID[id] && !isWater(id))) continue;
      return { y, id };
    }
    return null;
  }
  // Emprises déjà prises : puits, maisons, mine, potager, chantiers
  footprints(V) {
    const out = [[V.q, V.r, 1]];
    for (const h of V.houses) out.push([h.q, h.r, h.rad]);
    for (const m of [V.mine, ...V.oldMines]) if (m) out.push([m.q, m.r, 2]);
    for (const F of V.fields) out.push([F.q, F.r, F.rad || 2]);
    if (V.pad) out.push([V.pad.q, V.pad.r, PAD_R]);
    if (V.barn) out.push([V.barn.q, V.barn.r, V.barn.rad]);
    if (V.grove) out.push([V.grove.q, V.grove.r, V.grove.rad]);
    for (const B of [V.school, V.hospital, V.post]) if (B) out.push([B.q, B.r, B.rad]);
    for (const p of V.projects) if (p.rad) out.push([p.q, p.r, p.rad]);
    return out;
  }
  // Un terrain assez plat, sans arbre ni eau, à distance [dmin, dmax] du puits
  findSite(V, rad, dmin, dmax) {
    const foot = [];
    for (let a = -rad; a <= rad; a++) for (let b = -rad; b <= rad; b++) if (hexDist(a, b) <= rad) foot.push([a, b]);
    const taken = this.footprints(V);
    // (la rue principale, même pas encore faite, et une case de trottoir de chaque côté)
    const street = this.streetPlan(V, 1);
    for (let t = 0; t < 40; t++) {
      const ang = Math.random() * Math.PI * 2, d = rnd(dmin, dmax);
      const { q, r } = worldToHex(V.x + Math.cos(ang) * d, V.z + Math.sin(ang) * d);
      if (taken.some(([tq, tr, tr2]) => hexDist(q - tq, r - tr) < rad + tr2 + 2)) continue;
      // (dans le mur d'enceinte, loin de l'ancien qui va être démonté)
      const dw = hexDist(q - V.q, r - V.r);
      if (V.wallR && dw > V.wallR - rad - 3) continue;
      if (V.oldWallR && Math.abs(dw - V.oldWallR) <= rad + 1) continue;
      let lo = Infinity, hi = -Infinity, ok = true;
      const cols = [];
      for (const [a, b] of foot) {
        const g = this.groundAt(q + a, r + b);
        if (!g || !GROUND.has(g.id) || isLog(this.get(q + a, r + b, g.y + 1)) || V.roadSet.has(ck(q + a, r + b)) || street.has(ck(q + a, r + b))) { ok = false; break; }
        lo = Math.min(lo, g.y); hi = Math.max(hi, g.y);
        cols.push([q + a, r + b, g.y]);
      }
      if (!ok || hi - lo > 2) continue;
      return { q, r, base: hi + 1, cols };
    }
    return null;
  }
  // Ordre des travaux : on dégage (de haut en bas), on remblaie et on bâtit (de bas en haut),
  // puis torches. Remblai en terre sous le plancher.
  opsFor(list, site, clearH, fill = 2) {
    const { q, r, base } = site, clear = [], solid = [], late = [], spec = new Set();
    for (const [dq, dr, dy] of list) spec.add((q + dq) + ',' + (r + dr) + ',' + (base + dy));
    for (const [cq, cr, gy] of site.cols) {
      for (let y = gy + 1; y < base; y++) if (!spec.has(cq + ',' + cr + ',' + y)) solid.push([cq, cr, y, fill]);
      for (let y = base; y <= base + clearH; y++) if (!spec.has(cq + ',' + cr + ',' + y)) clear.push([cq, cr, y, AIR]);
    }
    for (const [dq, dr, dy, id] of list) {
      const op = [q + dq, r + dr, base + dy, id];
      (id === AIR ? clear : ATTACHED[id] ? late : solid).push(op);
    }
    clear.sort((a, b) => b[2] - a[2]);
    solid.sort((a, b) => a[2] - b[2]);
    return [...clear, ...solid, ...late];
  }
  costOf(ops) {
    let wood = 0, stone = 0, glass = 0;
    for (const o of ops) { wood += WOOD_COST[o[3]] || 0; stone += STONE_COST[o[3]] || 0; glass += GLASS_COST[o[3]] || 0; }
    return { wood: Math.ceil(wood), stone: Math.ceil(stone), glass: Math.ceil(glass) };
  }
  // Des vitres pour ce chantier ? Seulement si le village peut en faire (du sable connu, de la
  // pierre pour le four) ou en a déjà : sinon les fenêtres restent ouvertes
  windows(V, n) {
    if (V.stoneless) return AIR;
    return (V.sands?.length && (this.furnaceAt(V) || this.count(this.hallBoxes(V), STONE) >= 8)) || this.count(this.hallBoxes(V), GLASS) >= n ? 40 : AIR;
  }
  // Distance au puits jusqu'à laquelle le village bâtit (il s'étend en grandissant)
  reach(V) { return Math.min(400, 30 + SPREAD * V.houses.length); }

  // ---------- Chantiers ----------
  launch(V, type, arg) {
    let p = null;
    if (type === 'house') {
      const site = this.findSite(V, 2, 9, this.reach(V));
      if (!site) return false;
      const door = this.doorToward(V, site.q, site.r, 2);
      // murs en pierre si la mine en donne assez, sinon en planches
      // (sans pierre du tout : tout en bois, et les fenêtres restent ouvertes, faute de verre)
      const stone = !V.stoneless && this.count(this.hallBoxes(V), STONE) >= 40;
      let plan = houseBlocks(2, stone ? 28 : 18, stone ? 32 : 33, door);
      const win = this.windows(V, 2);
      if (win !== 40) plan = plan.map(([a, b, c, id]) => [a, b, c, id === 40 ? win : id]);
      p = { type, q: site.q, r: site.r, y: site.base, rad: 2, door, ops: this.opsFor(plan, site, 6) };
      p.ops.push(...this.doorstep(p, 2));
    } else if (type === 'tower') {
      const site = this.findSite(V, 3, 12, this.reach(V));
      if (!site) return false;
      const door = this.doorToward(V, site.q, site.r, 3);
      const stone = !V.stoneless && this.count(this.hallBoxes(V), STONE) >= 80;
      const plan = towerBlocks(3, stone ? 28 : 18, stone ? 32 : 33, door, this.windows(V, 15));
      p = { type, q: site.q, r: site.r, y: site.base, rad: 3, door, ops: this.opsFor(plan, site, 14) };
      p.ops.push(...this.doorstep(p, 2));
    } else if (type === 'hotel') {
      // hôtel : deux étages, plus large qu'un immeuble, en pierre si la mine en donne assez
      const site = this.findSite(V, HOTEL_R, 12, this.reach(V) + 10);
      if (!site) return false;
      const door = this.doorToward(V, site.q, site.r, HOTEL_R);
      const stone = !V.stoneless && this.count(this.hallBoxes(V), STONE) >= 80;
      const plan = towerBlocks(2, stone ? 28 : 18, stone ? 32 : 33, door, this.windows(V, 14), HOTEL_R);
      p = { type, q: site.q, r: site.r, y: site.base, rad: HOTEL_R, door, ops: this.opsFor(plan, site, 10) };
      p.ops.push(...this.doorstep(p, 2));
    } else if (type === 'pad') {
      const site = this.findSite(V, PAD_R, 16, this.reach(V) + 10);
      if (!site) return false;
      p = { type, q: site.q, r: site.r, y: site.base, rad: PAD_R, ops: this.opsFor(padPlan(!V.stoneless && this.count(this.hallBoxes(V), STONE) >= 40), site, 24) }; // (ciel dégagé au-dessus : on décolle)
    } else if (type === 'mine') {
      const site = this.findSite(V, 2, 14, 34);
      if (!site) return false;
      p = { type, q: site.q, r: site.r, y: site.base, rad: 2, door: this.doorToward(V, site.q, site.r, 2), ops: this.opsFor(mineHut(), site, 6) };
      p.ops.push(...this.doorstep(p, 2));
    } else if (type === 'garden') {
      const site = this.findSite(V, 2, 6, 22);
      if (!site) return false;
      p = { type, q: site.q, r: site.r, y: site.base, rad: 2, builder: 'farmer', ops: this.opsFor(gardenPlan(), site, 2) };
    } else if (type === 'field') {
      // un champ : le bâtisseur de champs (sinon les fermiers) le prépare
      const site = this.findSite(V, FIELD_R, 6, this.reach(V));
      if (!site) return false;
      p = { type, q: site.q, r: site.r, y: site.base, rad: FIELD_R, builder: 'field', ops: this.opsFor(fieldPlan(), site, 2) };
    } else if (type === 'beds') {
      // lits de villageois dans les bâtiments qui en manquent (arg : les blocs à poser, voir bedOps)
      p = { type, ops: arg };
    } else if (type === 'lights') {
      // lampadaires le long des routes : un poteau de 3 bûches et une torche
      p = { type, posts: arg, ops: [] };
      for (const [q, r, gy] of arg) p.ops.push([q, r, gy + 1, 5], [q, r, gy + 2, 5], [q, r, gy + 3, 5]);
      for (const [q, r, gy] of arg) p.ops.push([q, r, gy + 4, TORCH]);
    } else if (type === 'apartment') {
      // grand immeuble : en pierre s'il y en a assez, sinon en planches
      const site = this.findSite(V, APT_R, 14, this.reach(V) + 12);
      if (!site) return false;
      const door = this.doorToward(V, site.q, site.r, APT_R), S = 1 + APT_FLOORS[0] + Math.floor(Math.random() * (APT_FLOORS[1] - APT_FLOORS[0] + 1));
      const stone = !V.stoneless && this.count(this.hallBoxes(V), STONE) >= 300;
      const plan = apartmentBlocks(S, stone ? 28 : 18, stone ? 32 : 33, door, this.windows(V, 40));
      p = { type, q: site.q, r: site.r, y: site.base, rad: APT_R, door, storeys: S, cap: aptCap(S), ops: this.opsFor(plan, site, S * STOREY_H + 2) };
      p.ops.push(...this.doorstep(p, 2));
    } else if (type === 'school' || type === 'hospital' || type === 'post') {
      // bâtiments publics
      const rad = type === 'school' ? SCHOOL_R : type === 'hospital' ? HOSPITAL_R : POST_R;
      const site = this.findSite(V, rad, 10, this.reach(V) + 10);
      if (!site) return false;
      const door = this.doorToward(V, site.q, site.r, rad), stone = !V.stoneless && this.count(this.hallBoxes(V), STONE) >= 60;
      const plan = type === 'school' ? schoolPlan(door) : type === 'hospital' ? hospitalPlan(door) : postPlan(door, stone ? 28 : 18, stone ? 32 : 33);
      p = { type, q: site.q, r: site.r, y: site.base, rad, door, ops: this.opsFor(plan, site, 7) };
      p.ops.push(...this.doorstep(p, 2));
    } else if (type === 'grove') {
      // pépinière : la place des arbres du village (ciel dégagé au-dessus, pour qu'ils poussent)
      const site = this.findSite(V, GROVE_R, 12, this.reach(V) + 12);
      if (!site) return false;
      const door = this.doorToward(V, site.q, site.r, GROVE_R);
      p = { type, q: site.q, r: site.r, y: site.base, rad: GROVE_R, door, ops: this.opsFor(groveBlocks(door), site, 14) };
      p.ops.push(...this.doorstep(p, 2));
    } else if (type === 'barn') {
      // grange : en bois, des coffres tout le long des murs
      const site = this.findSite(V, BARN_R, 10, this.reach(V) + 6);
      if (!site) return false;
      const door = this.doorToward(V, site.q, site.r, BARN_R);
      p = { type, q: site.q, r: site.r, y: site.base, rad: BARN_R, door, ops: this.opsFor(barnBlocks(18, 33, door), site, 7) };
      p.ops.push(...this.doorstep(p, 2));
    } else if (type === 'shop') {
      // immeuble à boutique (arg : 'bakery' ou 'butchery'), en pierre s'il y en a assez
      const site = this.findSite(V, 4, 12, this.reach(V) + 10);
      if (!site) return false;
      const door = this.doorToward(V, site.q, site.r, 4);
      const stone = !V.stoneless && this.count(this.hallBoxes(V), STONE) >= 80;
      const plan = shopBlocks(arg, stone ? 28 : 18, stone ? 32 : 33, door, this.windows(V, 14));
      p = { type, shop: arg, q: site.q, r: site.r, y: site.base, rad: 4, door, ops: this.opsFor(plan, site, 14) };
      p.ops.push(...this.doorstep(p, 2), ...this.doorstep({ ...p, door: (door + 1) % 6 }, 2));
    } else if (type === 'wall') {
      // un tronçon du mur d'enceinte (rien à bâtir là : portes, eau... il est fait)
      p = { type, seg: arg, R: V.wallR, ops: this.wallOps(V, V.wallR, arg) };
      if (!p.ops.length) { V.wallDone.push(arg); return false; }
    } else if (type === 'road' && arg.main) {
      // un bout de rue principale (de t0 à t1 cases du puits)
      p = { type, main: arg.t1, to: 'main:' + arg.t1, ops: this.roadCellOps(V, this.streetCells(V, arg.t0, arg.t1, true)) };
      if (!p.ops.length) { V.mainLen = arg.t1; return false; }
    } else if (type === 'road') {
      // de la porte jusqu'à la route la plus proche, en contournant les maisons
      const cells = this.branchCells(V, arg[0], arg[1]);
      p = { type, to: ck(arg[0], arg[1]), ops: cells ? this.roadCellOps(V, cells) : [] };
      if (!p.ops.length) { V.roads.push(p.to); return false; }
    }
    p.i = 0;
    p.cost = this.costOf(p.ops);
    this.markClearing(V, p);
    p.paid = !p.cost.wood && !p.cost.stone && !p.cost.glass;
    V.projects.push(p);
    const who = pickOf(V.members.filter((a) => a.type === 'villager' && a.active));
    this.say(who, type === 'road' ? 'towork' : 'look', 0.7);
    return true;
  }
  // Où poser les prochains lampadaires : à côté des routes (pas dessus, ni dans une maison), loin
  // de ceux qui existent ou sont en chantier
  lampSpots(V) {
    const near = [...V.lamps, ...V.projects.filter((p) => p.type === 'lights').flatMap((p) => p.posts)];
    const taken = this.footprints(V), street = this.streetPlan(V, 0), out = [];
    for (const k of [...V.roadSet].sort()) {
      if (out.length >= LAMP_BATCH) break;
      const [q, r] = k.split(',').map(Number);
      if (!this.loaded(q, r) || [...near, ...out].some((p) => hexDist(p[0] - q, p[1] - r) < LAMP_EVERY)) continue;
      for (const [a, b] of NEIGHBORS) {
        const nq = q + a, nr = r + b, nk = ck(nq, nr);
        if (V.roadSet.has(nk) || street.has(nk) || taken.some(([tq, tr, tR]) => hexDist(nq - tq, nr - tr) <= tR + 1)) continue;
        if (V.wallR && Math.abs(hexDist(nq - V.q, nr - V.r) - V.wallR) <= 1) continue; // (pas dans le mur)
        const g = this.groundAt(nq, nr);
        if (!g || !GROUND.has(g.id)) continue;
        let clear = true;
        for (let y = g.y + 1; y <= g.y + 5 && clear; y++) clear = free(this.get(nq, nr, y)) && !isLog(this.get(nq, nr, y));
        if (!clear) continue;
        out.push([nq, nr, g.y]);
        break;
      }
    }
    return out;
  }
  // Porte d'une maison au centre (q, r) : le côté le plus proche du puits (comme le générateur)
  doorToward(V, q, r, rad) {
    let door = 0, best = -Infinity;
    for (let d = 0; d < 6; d++) {
      const [a, b] = midCell(rad, d);
      const dq = q + a - V.q, dr = r + b - V.r, score = -(dq * dq + dr * dr + dq * dr);
      if (score > best) { best = score; door = d; }
    }
    return door;
  }
  // Marches devant la porte (une maison posée plus haut que le terrain) : chaque case vers
  // l'extérieur est au plus un bloc plus bas que la précédente. [q, r, y, id] à remplir.
  doorstep(h, id) {
    const out = [], [dq, dr] = midCell(h.rad, h.door), [a, b] = DIRS6[h.door];
    let top = h.y;
    for (let k = 1; k <= 4; k++) {
      const q = h.q + dq + a * k, r = h.r + dr + b * k, g = this.groundAt(q, r);
      if (!g || isWater(g.id) || g.y >= top - 1) break;
      top -= 1;
      for (let y = g.y + 1; y <= top; y++) out.push([q, r, y, id]);
    }
    return out;
  }
  // Devant la porte (case dehors)
  doorFront(h) { const [a, b] = midCell(h.rad, h.door), [c, d] = DIRS6[h.door]; return [h.q + a + c, h.r + b + d]; }
  // Prochaine route à faire : la rue principale (assez longue pour le village), puis un chemin
  // depuis chaque porte, la mine, le potager
  nextRoad(V) {
    const len = V.mainLen || 0, want = this.streetTarget(V);
    // un premier bout de rue (la place du puits), pour que les chemins aient où se raccorder ;
    // ensuite, les maisons pas encore reliées passent avant l'allongement de la rue
    // (pas une porte dont le chemin est déjà en chantier ; un seul bout de rue à la fois)
    const busy = new Set(V.projects.filter((p) => p.type === 'road').map((p) => p.to));
    const mainBusy = V.projects.some((p) => p.type === 'road' && p.main);
    if (!len && !mainBusy) return { main: true, t0: 0, t1: Math.min(want, STREET_STEP) };
    const ends = this.homes(V).concat(V.houses[V.hallI] || []).map((h) => this.doorFront(h));
    if (V.mine) ends.push(this.doorFront({ ...V.mine, rad: 2 }));
    for (const F of V.fields) ends.push([F.q + (F.rad || 2) + 1, F.r]);
    if (V.pad) ends.push([V.pad.q + PAD_R + 1, V.pad.r]);
    for (const B of [V.barn, V.grove, V.school, V.hospital, V.post]) if (B && Number.isInteger(B.door)) ends.push(this.doorFront(B));
    const end = ends.find(([q, r]) => !V.roads.includes(ck(q, r)) && !busy.has(ck(q, r)));
    if (end) return end;
    return len && len < want && !mainBusy ? { main: true, t0: len + 1, t1: Math.min(want, len + STREET_STEP) } : null;
  }
  // Portes pas encore reliées à la route (ni en chantier)
  unlinked(V) {
    const busy = new Set(V.projects.filter((p) => p.type === 'road').map((p) => p.to));
    const ends = this.homes(V).concat(V.houses[V.hallI] || []).map((h) => this.doorFront(h));
    for (const B of [V.barn, V.grove, V.school, V.hospital, V.post]) if (B && Number.isInteger(B.door)) ends.push(this.doorFront(B));
    return ends.filter(([q, r]) => !V.roads.includes(ck(q, r)) && !busy.has(ck(q, r))).length;
  }
  // ---------- Rue principale et chemins ----------
  // Longueur voulue de la rue (de chaque côté du puits) : elle grandit avec le village
  streetTarget(V) { return Math.min(STREET_MAX, 10 + 4 * V.houses.length); }
  // Emprises qui arrêtent une route (sans le puits : la place l'entoure)
  roadBlocks(V) { return this.footprints(V).filter(([q, r]) => q !== V.q || r !== V.r); }
  // Axe de la rue (0..2 : une direction de l'hexagone et son opposée) : celui qui traverse le
  // moins de maisons (choisi une fois pour toutes)
  streetAxis(V) {
    if ([0, 1, 2].includes(V.axis)) return V.axis;
    const taken = this.roadBlocks(V);
    let best = 0, bestN = Infinity;
    for (let d = 0; d < 3; d++) {
      const [a, b] = DIRS6[d];
      let n = Math.random() * 0.5;
      for (let t = 2; t <= 30; t++) for (const sg of [1, -1]) {
        const q = V.q + sg * t * a, r = V.r + sg * t * b;
        if (taken.some(([tq, tr, rad]) => hexDist(q - tq, r - tr) <= rad + 1)) n++;
      }
      if (n < bestN) { bestN = n; best = d; }
    }
    return (V.axis = best);
  }
  // Cases de la rue entre t0 et t1 cases du puits, des deux côtés (3 de large ; la place autour
  // du puits avec le premier bout). De chaque côté, elle s'arrête devant une maison (stop : on
  // le retient, elle ne repart plus de ce côté).
  streetCells(V, t0, t1, stop = false) {
    const d = this.streetAxis(V), [a, b] = DIRS6[d], [na, nb] = DIRS6[(d + 1) % 6];
    const taken = this.roadBlocks(V), inside = (q, r, m = 0) => taken.some(([tq, tr, rad]) => hexDist(q - tq, r - tr) <= rad + m);
    const out = [];
    if (t0 === 0) {
      for (let x = -2; x <= 2; x++) for (let y = -2; y <= 2; y++) if (hexDist(x, y) === 2 && !inside(V.q + x, V.r + y)) out.push([V.q + x, V.r + y]);
    }
    V.streetStop ||= [false, false];
    [1, -1].forEach((sg, side) => {
      if (V.streetStop[side]) return;
      for (let t = Math.max(t0, 2); t <= t1; t++) {
        const cq = V.q + sg * t * a, cr = V.r + sg * t * b;
        if (inside(cq, cr)) { if (stop) V.streetStop[side] = true; return; }
        for (const k of [-1, 0, 1]) if (!inside(cq + k * na, cr + k * nb)) out.push([cq + k * na, cr + k * nb]);
      }
    });
    return out;
  }
  // La rue prévue en entier (jusqu'à sa longueur voulue), élargie de margin cases : un Set "q,r"
  streetPlan(V, margin = 0) {
    const d = this.streetAxis(V), [na, nb] = DIRS6[(d + 1) % 6], set = new Set();
    for (const [q, r] of this.streetCells(V, 0, this.streetTarget(V))) {
      for (let k = -margin; k <= margin; k++) set.add(ck(q + k * na, r + k * nb));
    }
    return set;
  }
  // Chemin depuis la case (q0, r0) devant une porte jusqu'à la route la plus proche (déjà faite,
  // ou la rue prévue) : recherche en largeur qui contourne les maisons, la mine, le potager,
  // l'eau et les marches de plus d'un bloc. Les cases du chemin, ou null s'il n'y en a pas.
  branchCells(V, q0, r0) {
    const street = this.streetPlan(V), taken = this.footprints(V), far = this.reach(V) + 20;
    const isRoad = (q, r) => V.roadSet.has(ck(q, r)) || street.has(ck(q, r));
    if (isRoad(q0, r0)) return [];
    const g0 = this.groundAt(q0, r0);
    if (!g0) return null;
    const start = ck(q0, r0), prev = new Map([[start, null]]), hy = new Map([[start, g0.y]]), queue = [[q0, r0]];
    let found = null;
    for (let i = 0; i < queue.length && i < ROAD_NODES && !found; i++) {
      const [q, r] = queue[i], y = hy.get(ck(q, r));
      for (const [a, b] of DIRS6) {
        const nq = q + a, nr = r + b, k = ck(nq, nr);
        if (prev.has(k) || hexDist(nq - V.q, nr - V.r) > far) continue;
        if (isRoad(nq, nr)) { prev.set(k, ck(q, r)); found = k; break; }
        if (taken.some(([tq, tr, rad]) => hexDist(nq - tq, nr - tr) <= rad)) continue;
        const g = this.groundAt(nq, nr);
        if (!g || !GROUND.has(g.id) || Math.abs(g.y - y) > 1) continue;
        prev.set(k, ck(q, r));
        hy.set(k, g.y);
        queue.push([nq, nr]);
      }
    }
    if (!found) return null;
    const cells = [];
    for (let k = prev.get(found); k; k = prev.get(k)) cells.push(k.split(',').map(Number));
    return cells;
  }
  // Route de gravier sur ces cases : le dessus du sol devient du gravier (les plantes et les
  // arbres au-dessus sont dégagés)
  roadCellOps(V, cells) {
    const ops = [], done = new Set();
    for (const [q, r] of cells) {
      const k = ck(q, r);
      if (done.has(k) || V.roadSet.has(k)) continue;
      done.add(k);
      const g = this.groundAt(q, r);
      if (!g || !GROUND.has(g.id)) continue;
      ops.push([q, r, g.y, V.stoneless ? PATH : GRAVEL]);
      for (let y = g.y + 1; y <= g.y + 8; y++) {
        const id = this.get(q, r, y);
        if (PLANTS.has(id) || isLog(id) || (y <= g.y + 3 && LEAFY.has(id))) ops.push([q, r, y, AIR]);
        else if (id !== AIR && !LEAFY.has(id)) break;
      }
    }
    return ops;
  }
  // Payé avec le coffre de la mairie ?
  canPay(V, p) {
    const boxes = this.hallBoxes(V);
    return this.count(boxes, WOOD) >= p.cost.wood && this.count(boxes, STONE) >= p.cost.stone && this.count(boxes, GLASS) >= (p.cost.glass || 0);
  }
  pay(V, p) {
    if (!this.canPay(V, p)) return false;
    const boxes = this.hallBoxes(V);
    this.take(boxes, WOOD, p.cost.wood);
    this.take(boxes, STONE, p.cost.stone);
    this.take(boxes, GLASS, p.cost.glass || 0);
    p.paid = true;
    return true;
  }
  missing(V, p) {
    const boxes = this.hallBoxes(V);
    return { wood: Math.max(0, p.cost.wood - this.count(boxes, WOOD)), stone: Math.max(0, p.cost.stone - this.count(boxes, STONE)), glass: Math.max(0, (p.cost.glass || 0) - this.count(boxes, GLASS)) };
  }
  finish(V, p) {
    V.projects.splice(V.projects.indexOf(p), 1);
    if (p.type === 'house') V.houses.push({ q: p.q, r: p.r, y: p.y, rad: p.rad, door: p.door });
    else if (p.type === 'pad') {
      V.pad = { q: p.q, r: p.r, y: p.y, cars: [] };
      // son bloc cible porte un nom : on le retrouve dans la liste des gravitrons
      this.nameTarget?.(p.q + ',' + p.r + ',' + p.y, 'Plateforme de lancement');
    } else if (STOREYED.has(p.type)) V.houses.push({ q: p.q, r: p.r, y: p.y, rad: p.rad, door: p.door, kind: p.type, cap: p.cap || CAP_OF[p.type], ...(p.storeys ? { storeys: p.storeys } : {}), ...(p.shop ? { shop: p.shop } : {}) });
    else if (p.type === 'school' || p.type === 'hospital' || p.type === 'post') { V[p.type] = { q: p.q, r: p.r, y: p.y, rad: p.rad, door: p.door }; this.say(pickOf(V.members), 'look', 0.8); }
    else if (p.type === 'grove') { V.grove = { q: p.q, r: p.r, y: p.y, rad: p.rad, door: p.door }; V.junkScan = 0; this.say(pickOf(V.members), 'look', 0.8); }
    else if (p.type === 'barn') V.barn = { q: p.q, r: p.r, y: p.y, rad: p.rad, door: p.door, chests: p.ops.filter((o) => BLOCKS[o[3]]?.container === 'chest').map((o) => [o[0], o[1], o[2]]) };
    else if (p.type === 'mine') V.mine = { q: p.q, r: p.r, y: p.y, door: p.door, i: 0, shaftDone: false, tun: null, done: false, path: [], dug: 0 };
    else if (p.type === 'garden') V.fields.push({ q: p.q, r: p.r, rad: 2, cells: DIRS6.map(([a, b]) => ({ q: p.q + a, r: p.r + b, y: p.y - 1 })) });
    else if (p.type === 'field') {
      const cells = [];
      for (let a = -FIELD_R; a <= FIELD_R; a++) for (let b = -FIELD_R; b <= FIELD_R; b++) { const d = hexDist(a, b); if (d >= 1 && d < FIELD_R) cells.push({ q: p.q + a, r: p.r + b, y: p.y - 1 }); }
      V.fields.push({ q: p.q, r: p.r, rad: FIELD_R, cells });
    } else if (p.type === 'lights') V.lamps.push(...p.posts.map(([q, r]) => [q, r]));
    else if (p.type === 'wall') {
      if (p.R === V.wallR) V.wallDone.push(p.seg);
      if (this.wallComplete(V)) this.dropOldWall(V);
    } else if (p.type === 'road') {
      V.roads.push(p.to);
      if (p.main) V.mainLen = Math.max(V.mainLen || 0, p.main);
      for (const o of p.ops) if (o[3] === GRAVEL || o[3] === PATH) V.roadSet.add(ck(o[0], o[1]));
    }
  }
  // Depuis quand ce bloc attend les bûcherons (pas sauvegardé : on recompte après un chargement)
  since(o) {
    this.waiting ||= new WeakMap();
    let v = this.waiting.get(o);
    if (v === undefined) this.waiting.set(o, (v = this.clock));
    return v;
  }
  // Bûcherons du village (qui peuvent dégager un chantier)
  lumberjacks(V) { return V.members.some((b) => b.job === 'lumberjack' && b.active && !b.dead); }
  // Feuilles et troncs dans l'emprise d'un chantier : les bûcherons les enlèvent avant le maçon
  markClearing(V, p) {
    for (const [q, r, y] of p.ops) {
      const id = this.get(q, r, y);
      if (LEAFY.has(id) || isLog(id)) V.clearing.add(q + ',' + r + ',' + y);
    }
  }

  // Une case où l'on ne peut pas poser de bloc : un villageois ou un joueur s'y tient
  occupied(q, r, y) {
    // (qui chevauche vraiment la case : à moins de 0,8 de son centre)
    const c = hexToWorld(q, r);
    const inside = (p, h) => Math.hypot(p.x - c.x, p.z - c.z) < 0.8 && p.y < y + 1 && p.y + h > y;
    for (const a of this.animals.list) if (a.active && !a.dead && inside(a.pos, 1.8)) return a;
    for (const p of this.players) if (inside(p.pos, 1.8)) return p;
    return null;
  }

  // ---------- Le village réfléchit ----------
  tick(dt, list, players) {
    this.clock += dt;
    this.nodes = 0;
    this.players = players;
    for (const V of this.villages.values()) V.members.length = 0;
    for (const a of list) if (a.vk && !a.dead) this.villages.get(a.vk)?.members.push(a);
    for (const V of this.villages.values()) {
      if (!V.members.some((a) => a.active)) continue;
      V.planT -= dt;
      if (V.planT > 0) continue;
      V.planT = PLAN_EVERY;
      this.plan(V);
    }
  }

  plan(V) {
    V.planned = true;
    for (const a of V.members) if (a.active && a.pos.y > 0) this.unstick(V, a);
    if (V.stoneless === undefined) V.stoneless = this.noStone(V);
    // (chantier lancé avant de le savoir, qui attend de la pierre qui n'existe pas : abandonné)
    if (V.stoneless) V.projects = V.projects.filter((p) => p.paid || (p.type !== 'mine' && !(p.cost?.stone > 0)));
    // (maisons du générateur : des marches de pierre devant les portes trop hautes)
    if (!V.steps && V.houses.every((h) => this.loaded(h.q, h.r))) {
      V.steps = true;
      for (const h of V.houses) for (const [q, r, y, id] of this.doorstep(h, 28)) if (free(this.get(q, r, y))) this.set(q, r, y, id);
    }
    const adults = V.members.filter((a) => a.type === 'villager');
    // les enfants grandissent
    for (const k of V.members) {
      if (k.type === 'villager') continue;
      k.age = (k.age || 0) + PLAN_EVERY;
      if (k.age >= GROW_TIME) this.grow(k);
    }
    // chacun sa maison (autant d'habitants que de lits)
    for (const h of this.homes(V)) this.countBeds(h);
    const occ = new Map(this.homes(V).map((h) => [ck(h.q, h.r), 0]));
    const capK = new Map(this.homes(V).map((h) => [ck(h.q, h.r), this.capOf(h)]));
    for (const a of V.members) if (a.house && occ.has(a.house) && occ.get(a.house) < capK.get(a.house)) occ.set(a.house, occ.get(a.house) + 1); else a.house = null;
    for (const a of V.members) {
      if (a.house) continue;
      let best = null;
      for (const [k, n] of occ) if (n < capK.get(k) && (best === null || n / capK.get(k) < occ.get(best) / capK.get(best))) best = k;
      if (best) { a.house = best; occ.set(best, occ.get(best) + 1); }
    }
    // (chacun son lit dans sa maison, enfants compris)
    const inHouse = new Map();
    for (const a of V.members) if (a.house) { const n = inHouse.get(a.house) || 0; a.bed = n; inHouse.set(a.house, n + 1); } else a.bed = 0;
    const pop = V.members.length;
    let beds = 0;
    for (const c of capK.values()) beds += c;
    // naissances : de quoi manger, un lit libre
    V.birthT -= PLAN_EVERY;
    if (V.birthT <= 0 && V.food >= FOOD_BIRTH && adults.length >= 2 && pop < beds && this.animals.list.length < ANIMALS_SAFETY) {
      const k = [...occ].find(([kk, n]) => n < capK.get(kk))?.[0];
      const h = k && V.houses.find((h) => ck(h.q, h.r) === k);
      if (h && this.loaded(h.q, h.r)) {
        // (à côté du pilier central dans un immeuble, au milieu de la maison sinon)
        const [sq, sr, sy] = this.homeSpot(h);
        const c = hexToWorld(sq, sr);
        const kid = this.animals.add('villager_child', c.x + 0.2, sy, c.z);
        kid.home = { x: V.x, z: V.z };
        kid.vk = V.key;
        kid.house = k;
        kid.age = 0;
        this.onEvent?.('birth', c.x, c.z);
        V.food -= FOOD_BIRTH;
        V.birthT = BIRTH_EVERY;
        const parent = adults.find((a) => a.house === k) || adults[0];
        this.say(parent, 'greet');
        this.animals.talk.later(kid, 'hi', 1.2);
      }
    }
    this.scan(V);
    this.scanJunk(V);
    if (!this.hallOk(V)) return; // (pas encore fondé)
    // chantiers du village (un à la fois de chaque sorte)
    V.failT -= PLAN_EVERY;
    if (V.failT > 0) return;
    const jobs = {};
    for (const a of adults) if (a.job) jobs[a.job] = (jobs[a.job] || 0) + 1;
    // un métier manque (un village déjà installé : forestier, charpentier, bâtisseur de champs,
    // gardes, boulanger et boucher pour leurs boutiques) : quelqu'un change de métier, de
    // préférence un du même domaine en trop (un bûcheron devient forestier, un maçon
    // charpentier, un fermier bâtisseur de champs) ; sinon un villageois sans métier, un artisan
    const wanted = [];
    // assez de maçons pour les routes, le mur, les lampadaires : un pour 6 adultes (pris d'abord
    // parmi les feuilleteurs)
    // (et assez de bûcherons : le bois des chantiers et des lits)
    const ljWant = Math.max(1, Math.ceil(adults.length / 8));
    for (let n = jobs.lumberjack || 0; n < Math.min(3, ljWant); n++) wanted.push('lumberjack');
    for (let n = jobs.mason || 0; n < Math.min(4, masonsFor(adults.length)); n++) wanted.push('mason');
    // (des portes pas reliées à la route : un cantonnier)
    if (!jobs.roadworker && this.homes(V).length >= 4 && this.unlinked(V) >= 2) wanted.push('roadworker');
    if (this.wantsForester(V) && (jobs.forester || 0) < (jobs.lumberjack || 0)) wanted.push('forester');
    if ((jobs.leafer || 0) < leafersFor(jobs.lumberjack) && this.homes(V).length >= 2) wanted.push('leafer');
    // (le mécanicien bâtit la plateforme : sans lui, ni plateforme ni véhicules)
    if (!jobs.mechanic && !V.stoneless && adults.length >= MECHANIC_AFTER) wanted.push('mechanic');
    if ((V.pad || V.projects.some((p) => p.type === 'pad')) && !jobs.vehiclebuilder) wanted.push('vehiclebuilder');
    if (V.pad && !jobs.taxi) wanted.push('taxi');
    if (!jobs.carpenter && this.homes(V).length >= 4 && adults.length >= 6) wanted.push('carpenter');
    if (!jobs.fieldbuilder && (jobs.farmer || 0) >= 2 && adults.length >= 8) wanted.push('fieldbuilder');
    if ((jobs.guard || 0) < guardsFor(adults.length)) wanted.push('guard');
    if ((jobs.police || 0) < policeFor(adults.length, V.roadSet.size)) wanted.push('police');
    if ((jobs.gendarme || 0) < gendarmesFor(adults.length, V)) wanted.push('gendarme');
    if (V.school && !jobs.teacher) wanted.push('teacher');
    if (V.hospital && !jobs.doctor) wanted.push('doctor');
    if (V.post) for (let n = jobs.courier || 0; n < couriersFor(this.homes(V).length); n++) wanted.push('courier');
    for (const s of SHOPS) if (V.houses.some((h) => h.shop === s) && !jobs[SHOP_JOB[s]]) wanted.push(SHOP_JOB[s]);
    // (un métier « en trop » : au moins 2 du même, et toujours 2 fermiers pour nourrir le village)
    const spare = (j) => adults.find((b) => b.job === j && (jobs[j] || 0) > (j === 'farmer' ? 2 : j === 'lumberjack' ? ljWant : 1));
    for (const job of wanted) {
      const free = adults.find((b) => !b.job) || adults.find((b) => JOBS[b.job]?.artisan);
      const same = { carpenter: 'mason', fieldbuilder: 'farmer', vehiclebuilder: 'mechanic', roadworker: 'mason' }[job];
      // (un maçon : un feuilleteur d'abord ; jamais un maçon pris pour un autre métier, sauf
      // le charpentier, sinon ils s'échangeraient sans fin)
      const leafer = job === 'mason' && adults.find((b) => b.job === 'leafer');
      const b = leafer || (same && spare(same)) || free || spare('farmer') || spare('lumberjack') || spare('forester');
      if (!b) continue;
      if (b.job) jobs[b.job]--;
      if (b.task) this.end(b, b.task, 0);
      b.job = job;
      jobs[job] = (jobs[job] || 0) + 1;
    }
    const has = (t) => V.projects.some((p) => p.type === t);
    if (V.mine?.done) { V.oldMines.push({ q: V.mine.q, r: V.mine.r }); V.mine = null; }
    // (sans pierre : ni mine, et les routes et maisons n'attendent pas de mine)
    const ready = V.mine || V.stoneless;
    if (!V.stoneless && !V.mine && !has('mine') && (jobs.miner || adults.length >= 3)) {
      if (!this.launch(V, 'mine')) V.failT = 30;
      return;
    }
    // champs : un dès qu'il y a un fermier, un de plus quand chaque champ a ses FIELD_FARMERS fermiers
    if (jobs.farmer && !has('field') && !has('garden') && jobs.farmer > FIELD_FARMERS * V.fields.length - (V.fields.length ? 0 : 1) && !this.launch(V, 'field')) V.failT = 30;
    // lampadaires le long des routes (pour éclairer le village la nuit)
    if (ready && V.roadSet.size >= 6 && !has('lights')) { const posts = this.lampSpots(V); if (posts.length) this.launch(V, 'lights', posts); }
    if (jobs.mechanic && ready && !V.pad && !has('pad') && !this.launch(V, 'pad')) V.failT = 30;
    // routes : autant de chantiers que de maçons (chacun le sien), chacun vers une porte différente
    const masons = Math.max(1, jobs.mason || 0);
    for (let n = 0; ready && n < 8 && V.projects.filter((p) => p.type === 'road').length < masons + 2 * (jobs.roadworker || 0); n++) {
      const t = this.nextRoad(V);
      if (!t) break;
      this.launch(V, 'road', t);
    }
    // la grange (le jour, comme tous les chantiers), puis les boutiques (boulangerie, boucherie)
    if (ready && !V.barn && !has('barn') && this.homes(V).length >= BARN_AFTER && !this.launch(V, 'barn')) V.failT = 30;
    if (ready && !V.grove && !has('grove') && this.homes(V).length >= GROVE_AFTER && !this.launch(V, 'grove')) V.failT = 30;
    // bâtiments publics : la poste, l'hôpital, l'école
    for (const [type, after] of [['post', POST_AFTER], ['hospital', HOSPITAL_AFTER], ['school', SCHOOL_AFTER]]) {
      if (ready && !V[type] && !has(type) && this.homes(V).length >= after && !this.launch(V, type)) V.failT = 30;
    }
    if (ready && !has('shop') && this.homes(V).length >= SHOP_AFTER) {
      const kind = SHOPS.find((s) => !V.houses.some((h) => h.shop === s));
      if (kind && !this.launch(V, 'shop', kind)) V.failT = 30;
    }
    // mur d'enceinte (le village a quelques maisons et de la pierre) : un tronçon par maçon
    if (ready && !V.stoneless && this.homes(V).length >= WALL_AFTER) {
      V.wallR ||= this.wallRadius(V);
      for (let n = 0; n < 8 && V.projects.filter((p) => p.type === 'wall').length < masons; n++) {
        const seg = this.nextWall(V);
        if (seg === null) break;
        this.launch(V, 'wall', seg);
      }
    }
    // plus assez de lits : une maison, ou (village déjà grand) un petit immeuble
    // (plusieurs chantiers à la fois quand il y a des maçons pour ça : un par maçon ; les lits
    // déjà en chantier comptent)
    const housing = V.projects.filter((p) => p.type === 'house' || STOREYED.has(p.type));
    const coming = housing.reduce((n, p) => n + (p.cap || CAP_OF[p.type] || HOUSE_CAP), 0);
    // des villageois sans maison (et pas assez de lits en chantier pour eux) : un hôtel d'abord
    // (sans attendre la mine : sans assez de pierre, il est en bois)
    // des lits manquent dans les bâtiments : les bâtisseurs les posent (avant tout le reste)
    if (!has('beds')) { const ops = this.bedOps(V); if (ops.length) this.launch(V, 'beds', ops); }
    // (les lits qui manquent encore dans les bâtiments : ils viendront, pas besoin de bâtir pour eux)
    const bedsComing = this.homes(V).reduce((n, h) => n + (h.beds ? Math.max(0, this.bedsWanted(h) - h.beds.length) : 0), 0);
    const homeless = V.members.filter((a) => !a.house).length;
    if (homeless > coming + bedsComing && !has('hotel')) {
      if (this.launch(V, 'hotel')) return;
    }
    if (pop + 2 > beds + coming + bedsComing && ready && housing.length < masons) {
      // (grand village, à partir du jour APT_DAY : parfois un grand immeuble)
      const huge = this.homes(V).length >= APT_AFTER && (this.day?.() ?? 0) >= APT_DAY && Math.random() < 0.5;
      const big = huge || (this.homes(V).length >= TOWER_AFTER && Math.random() < 0.5);
      if (!this.launch(V, huge ? 'apartment' : big ? 'tower' : 'house') && !(big && this.launch(V, 'house'))) {
        V.failT = 30;
        // plus de place dans le mur : un mur plus grand (l'ancien sera démonté une fois fini)
        if (this.wallComplete(V) && !V.oldWallR && this.wallRadius(V) + WALL_GROW > V.wallR) {
          V.oldWallR = V.wallR;
          V.wallR += WALL_GROW;
          V.wallDone = [];
        }
      }
    }
  }

  grow(k) {
    k.type = 'villager';
    k.hp = this.species.villager.health;
    k.age = undefined;
    this.say(k, 'hello');
  }

  // Recherche d'arbres (et d'un coin de pêche) autour du village, quelques colonnes à la fois
  scan(V) {
    const wantSand = !V.stoneless && (V.sands ||= []).length < 3;
    const wantWild = V.members.some((b) => b.job === 'forester') && (V.wild ||= []).length < 6;
    if (V.trees.length >= KEEP_TREES && V.fish && !wantSand && !wantWild) return;
    const S = spiral(), n = V.trees.length > 2 ? 40 : 300;
    for (let i = 0; i < n; i++) {
      const [dq, dr] = S[V.scan];
      V.scan = (V.scan + 1) % S.length;
      const q = V.q + dq, r = V.r + dr;
      if (!this.loaded(q, r)) continue;
      const s = this.world.surface(q, r);
      if (isWater(s.id)) {
        if (!V.fish && hexDist(dq, dr) > 3) this.fishSpot(V, q, r, s.h);
        continue;
      }
      // une jeune pousse sauvage (pas une de celles que les bûcherons ont plantées)
      if (wantWild && V.wild.length < 12) {
        const top = this.get(q, r, s.h + 1);
        if (WILD_SAPLINGS.has(top) && this.wildSapling(V, q, r, s.h + 1) && !V.wild.some((p) => p[0] === q && p[1] === r)) V.wild.push([q, r, s.h + 1]);
      }
      // sable à découvert (plage, désert) : de quoi faire du verre
      if (s.id === 8 && V.sands.length < SAND_KEEP && hexDist(dq, dr) > 3 && !V.sands.some((p) => hexDist(p[0] - q, p[1] - r) < 6)) V.sands.push([q, r]);
      if (V.trees.length >= KEEP_TREES) continue;
      let y = s.h;
      for (let k = 0; k < 28 && y > 1; k++, y--) {
        const id = this.get(q, r, y);
        if (isLog(id)) {
          if (GROUND.has(this.get(q, r, y - 1))) {
            if (this.isTree(q, r, y) && !V.trees.some((t) => t.q === q && t.r === r)) V.trees.push({ q, r, y, claim: 0, until: 0 });
            break;
          }
          continue;
        }
        if (id === AIR || LEAFY.has(id) || PLANTS.has(id)) continue;
        break;
      }
    }
  }
  // Pas de pierre sous le village (monde plat) : on sonde quelques colonnes autour du puits,
  // jusqu'à 64 blocs sous le sol. undefined : pas encore chargé (on réessaiera).
  noStone(V) {
    for (const [a, b] of [[0, 0], [5, 0], [-5, 0], [0, 5], [0, -5]]) {
      const q = V.q + a, r = V.r + b, g = this.groundAt(q, r);
      if (!g) return undefined;
      for (let y = g.y - 1; y > 0 && y > g.y - 64; y--) if (STONY.has(this.get(q, r, y))) return false;
    }
    return true;
  }

  // Un vrai arbre (un tronc coiffé de feuilles naturelles), pas les piliers d'une maison
  isTree(q, r, y) {
    let top = y;
    while (top < y + 30 && isLog(this.get(q, r, top + 1))) top++;
    if (isNaturalLeaves(this.get(q, r, top + 1))) return true;
    for (const [a, b] of NEIGHBORS) if (isNaturalLeaves(this.get(q + a, r + b, top)) || isNaturalLeaves(this.get(q + a, r + b, top + 1))) return true;
    return false;
  }
  // Coin de pêche : une case de terre ferme au bord de l'eau
  fishSpot(V, wq, wr, wy) {
    // (pas dans le trou d'eau du potager ni dans le puits)
    if (V.fields.some((F) => hexDist(wq - F.q, wr - F.r) <= 1) || hexDist(wq - V.q, wr - V.r) <= 1) return;
    for (const [a, b] of NEIGHBORS) {
      const g = this.groundAt(wq + a, wr + b);
      if (g && GROUND.has(g.id) && g.y >= wy && g.y <= wy + 1 && this.get(wq + a, wr + b, g.y + 2) === AIR) {
        V.fish = { q: wq + a, r: wr + b, y: g.y + 1, wq, wr };
        return;
      }
    }
  }
  sheepNear(V) {
    return this.animals.list.filter((s) => (s.type === 'sheep' || s.type === 'sheep_grey') && !s.dead && s.active && Math.hypot(s.pos.x - V.x, s.pos.z - V.z) < 48);
  }

  chooseJob(V) {
    const n = {};
    for (const b of V.members) if (b.job) n[b.job] = (n[b.job] || 0) + 1;
    const adults = V.members.filter((b) => b.type === 'villager').length;
    if (!n.lumberjack) return 'lumberjack';
    if (!n.miner && !V.stoneless) return 'miner';
    if (!n.mason) return 'mason';
    if (!n.farmer) return 'farmer';
    if ((n.guard || 0) < guardsFor(adults)) return 'guard';
    if ((n.police || 0) < policeFor(adults, V.roadSet.size)) return 'police';
    if ((n.gendarme || 0) < gendarmesFor(adults, V)) return 'gendarme';
    if (V.school && !n.teacher) return 'teacher';
    if (!n.roadworker && this.homes(V).length >= 4 && this.unlinked(V) >= 2) return 'roadworker';
    if (V.hospital && !n.doctor) return 'doctor';
    if (V.post && (n.courier || 0) < couriersFor(this.homes(V).length)) return 'courier';
    if (this.wantsForester(V) && (n.forester || 0) < (n.lumberjack || 0)) return 'forester';
    if ((n.leafer || 0) < leafersFor(n.lumberjack) && this.homes(V).length >= 2) return 'leafer';
    if (V.pad && !n.vehiclebuilder) return 'vehiclebuilder';
    if (V.pad && !n.taxi) return 'taxi';
    if (!n.carpenter && this.homes(V).length >= 3) return 'carpenter';
    if (!n.fieldbuilder && (n.farmer || 0) >= 2) return 'fieldbuilder';
    for (const s of SHOPS) if (V.houses.some((h) => h.shop === s) && !n[SHOP_JOB[s]]) return SHOP_JOB[s];
    if ((n.lumberjack || 0) < Math.ceil(adults / 5)) return 'lumberjack';
    if ((n.mason || 0) < masonsFor(adults)) return 'mason';
    if (!V.stoneless && (n.miner || 0) < Math.ceil(adults / 10)) return 'miner';
    // (au plus FIELD_FARMERS fermiers par champ, plus de quoi en ouvrir un nouveau)
    if ((n.farmer || 0) + (n.fisher || 0) < Math.ceil(adults / 4)) return V.fish && !n.fisher ? 'fisher' : (n.farmer || 0) < FIELD_FARMERS * (V.fields.length + 1) ? 'farmer' : 'lumberjack';
    if (!n.shepherd && this.sheepNear(V).length) return 'shepherd';
    if (!n.mechanic && !V.stoneless && adults >= MECHANIC_AFTER) return 'mechanic';
    if (V.fish && !n.fisher) return 'fisher';
    const left = ARTISANS.filter((j) => !n[j]);
    return pickOf(left.length ? left : ['lumberjack', 'mason', ...ARTISANS]);
  }

  // Résumé pour le joueur (fenêtre de commerce)
  describe(a) {
    const V = a.vk && this.villages.get(a.vk);
    if (!V) return '';
    const p = V.projects.find((p) => p.type !== 'road') || V.projects[0];
    const names = { field: 'un champ', lights: 'des lampadaires', barn: 'la grange', shop: 'une boutique', wall: 'le mur d\'enceinte', pad: 'la plateforme de lancement', house: 'une maison', tower: 'un petit immeuble', hotel: 'un hôtel', mine: 'la mine', garden: 'le potager', road: 'une route',
      beds: 'des lits', grove: 'la pépinière', apartment: 'un grand immeuble', school: 'l\'école', hospital: 'l\'hôpital', post: 'la poste' };
    let txt = `Village : ${V.members.length} habitants · ${this.homes(V).length} maisons`;
    if (V.pad) { const n = PAD_SLOTS.filter((k) => this.carAt(V, k)).length; txt += ` · plateforme de lancement : ${n} véhicule${n > 1 ? 's' : ''} prêt${n > 1 ? 's' : ''}`; }
    if (!this.hallOk(V)) return txt + ' · pas encore de mairie';
    if (p) {
      const m = this.missing(V, p), need = [m.wood && `${m.wood} bûches`, m.stone && `${m.stone} pierres taillées`, m.glass && `${m.glass} vitres`].filter(Boolean);
      txt += ` · chantier : ${names[p.type] || p.type}` + (p.paid ? ` (${Math.round((p.i / p.ops.length) * 100)} %)` : need.length ? ` (il manque ${need.join(' et ')} à la mairie)` : '');
    }
    return txt;
  }

  // ---------- Commande /place ----------
  // Pose une pièce ([dq, dr, dy, id]) en (q, r), plancher (dy = 0) en base : remblai dessous,
  // terrain dégagé au-dessus (clearH blocs). base absente : au niveau du sol (le milieu des
  // hauteurs de l'emprise ; fallback si elle n'est pas chargée).
  placeList(list, q, r, base, clearH, fill, fallback) {
    const cols = new Map();
    for (const [dq, dr] of list) cols.set(ck(q + dq, r + dr), [q + dq, r + dr]);
    const ground = [...cols.values()].map(([cq, cr]) => [cq, cr, this.groundAt(cq, cr)?.y]);
    if (base === undefined) {
      const ys = ground.map((g) => g[2]).filter(Number.isFinite).sort((a, b) => a - b);
      base = ys.length ? ys[ys.length >> 1] : fallback;
    }
    const site = { q, r, base, cols: ground.map(([cq, cr, gy]) => [cq, cr, Number.isFinite(gy) ? Math.min(gy, base - 1) : base - 1]) };
    let n = 0;
    for (const [oq, or, oy, id] of this.opsFor(list, site, clearH, fill)) if (this.get(oq, or, oy) !== id && this.set(oq, or, oy, id)) n++;
    return { base, n };
  }

  // /place <type> en (q, r) ; y : hauteur des pieds de celui qui la pose ; (fx, fz) : d'où on la
  // regarde (la porte d'une maison est tournée de ce côté). Renvoie le message pour le chat.
  build(type, q, r, y, fx, fz) {
    const p = worldToHex(fx, fz);
    const door = hexDist(p.q - q, p.r - r) > 0 ? this.doorToward(p, q, r, 2) : 0;
    let res;
    if (type === 'village') {
      const V = this.buildVillage(q, r, y);
      return V ? `Village posé : ${V.houses.length} maisons et leurs habitants (ils vont s'installer et l'agrandir)` : 'Il y a déjà un village posé ici';
    }
    if (type === 'maison') res = this.placeList(houseBlocks(2, 18, 33, door), q, r, y - 1, 6, 28);
    else if (type === 'mairie') res = this.placeList(houseBlocks(3, 18, 33, door), q, r, y - 1, 7, 28);
    else if (type === 'puits') res = this.placeList(WELL, q, r, y - 1, 4, 28);
    else if (type === 'mine') res = this.placeList(mineHut(), q, r, y - 1, 6, 2);
    else if (type === 'potager') res = this.placeList(gardenPlan(), q, r, y, 2, 2);
    else return null;
    return `${BUILDS[type][0].toUpperCase() + BUILDS[type].slice(1)} : ${res.n} blocs posés`;
  }

  // Un village complet, adapté au terrain (chaque maison à la hauteur du sol sous elle) : puits
  // au centre, mairie et quatre maisons autour, portes vers le puits, un adulte par maison et
  // deux enfants. Il vit ensuite comme ceux du générateur (voir plan).
  buildVillage(q, r, y) {
    const key = 'P:' + q + ':' + r;
    if (this.villages.has(key)) return null;
    const well = this.placeList(WELL, q, r, undefined, 6, 28, y - 1);
    const c = hexToWorld(q, r), houses = [], a0 = Math.random() * Math.PI * 2;
    for (let i = 0; i < 5; i++) {
      const rad = i ? 2 : 3, d = i ? rnd(12, 14) : 13;
      const ang = a0 + (i * Math.PI * 2) / 5 + rnd(-0.15, 0.15);
      const { q: hq, r: hr } = worldToHex(c.x + Math.cos(ang) * d, c.z + Math.sin(ang) * d);
      const door = this.doorToward({ q, r }, hq, hr, rad);
      const { base } = this.placeList(houseBlocks(rad, pickOf([18, 18, 99, 154, 28]), Math.random() < 0.6 ? 33 : 32, door), hq, hr, undefined, 7, 28, y - 1);
      houses.push({ q: hq, r: hr, y: base, rad, door });
    }
    for (const h of houses) for (const [sq, sr, sy, id] of this.doorstep(h, 28)) this.set(sq, sr, sy, id);
    const V = this.create({ key, q, r, y: well.base, houses });
    V.steps = true;
    this.villages.set(key, V);
    houses.forEach((h, i) => {
      const p = hexToWorld(h.q, h.r);
      const a = this.animals.add('villager', p.x, h.y + 1, p.z);
      a.home = { x: c.x, z: c.z };
      a.vk = key;
      if (i < 2) {
        const k = this.animals.add('villager_child', p.x + 0.3, h.y + 1, p.z + 0.3);
        k.home = { x: c.x, z: c.z };
        k.vk = key;
        k.age = 0;
      }
    });
    return V;
  }

  // ---------- Chaque villageois ----------
  // Appelé à chaque frame (villageois actif, chez l'hôte) : vrai s'il est occupé par le village
  think(a, dt) {
    if (JOBS[a.job]?.recruit) return false; // (militaire : plus de village)
    // (assis dans un véhicule sans y conduire : un passager, il attend)
    if (a.seat && a.task?.kind !== 'taxiride' && a.task?.kind !== 'airpatrol') { a.state = 'idle'; return true; }
    const V = this.villageOf(a);
    if (!V) return false;
    if (a.state === 'talk') return true;
    if (a.work > 0) a.work -= dt;
    if (a.holdCool > 0) a.holdCool -= dt;
    // pris dans un bloc : il en sort (toutes les secondes et demie)
    if ((a.solidT = (a.solidT || 0) - dt) <= 0) {
      a.solidT = 1.5;
      if (!a.riding && !a.seat && this.animals.collides(a) && this.escape(a) && a.task) this.end(a, a.task, 0.5);
    }
    if (a.task?.kind === 'patrol' && (a.zT = (a.zT || 0) - dt) <= 0) {
      a.zT = 1;
      if (this.zombieNear(V, a)) this.end(a, a.task, 0);
    }
    if (a.task) { this.run(a, V, a.task, dt); return true; }
    a.brainT = (a.brainT || 0) - dt;
    if (a.brainT > 0) return false;
    a.brainT = rnd(0.8, 1.6);
    const t = this.decide(a, V);
    if (!t) return false;
    a.task = t;
    this.run(a, V, t, dt);
    return true;
  }

  decide(a, V) {
    // blessé : à l'hôpital (de jour comme de nuit)
    if (a.type === 'villager' && V.hospital && a.hp < (this.species[a.type]?.health || 20) * HURT && this.loaded(V.hospital.q, V.hospital.r) && this.hospitalBed(V, a)) return { kind: 'heal' };
    // garde : il dort le jour, veille la nuit
    if (a.job === 'guard' && a.type === 'villager') {
      if (this.workTime()) return this.homeOf(V, a) || V.hallI >= 0 ? { kind: 'rest', guard: true } : null;
      return this.guardTask(a, V);
    }
    if (!this.workTime()) return this.homeOf(V, a) || V.hallI >= 0 ? { kind: 'rest' } : null;
    // les enfants vont à l'école (le jour, la plupart du temps)
    if (a.type === 'villager_child' && V.school && this.loaded(V.school.q, V.school.r) && Math.random() < 0.8) return { kind: 'school' };
    if (a.type !== 'villager' || !V.planned) return null; // (les maisons ne sont pas encore attribuées)
    // s'installer : un établi, puis un coffre (avec le bois de son premier arbre)
    const h = this.houseOf(V, a);
    if (h && this.loaded(h.q, h.r) && (!this.hasTable(h) || !this.hasChest(h))) {
      const need = (this.hasTable(h) ? 0 : 1) + (this.hasChest(h) ? 0 : 2);
      if (logsOf(a) >= Math.min(need, this.hasTable(h) ? 2 : 1)) return { kind: 'home' };
      // pas d'arbre à couper : il prend le bois à la mairie (s'il y en a)
      // (et s'il n'y a d'arbres nulle part, un monde plat : il en plante, ils pousseront)
      return this.chopTask(a, V) || (this.hallOk(V) && this.count(this.hallBoxes(V), WOOD) >= need ? { kind: 'fetch', n: need } : this.plantTask(a, V));
    }
    if ((a.job === 'forester' || a.job === 'leafer') && carried(a) && V.barn) return { kind: 'stash' }; // (les pousses : à la grange)
    if (a.job === 'farmer' && (a.carry?.[WHEAT] || a.carry?.[POTATO]) && this.bakery(V)) return { kind: 'deliver' }; // (la récolte : au boulanger)
    if (carried(a) && this.hallOk(V)) return { kind: 'deposit' };
    if (carried(a) && h) return { kind: 'home' };
    if (!this.hallOk(V)) return { kind: 'hall' };
    if (a.job === 'miner' && V.stoneless) a.job = null; // (rien à miner : il change de métier)
    if (!a.job) {
      a.job = this.chooseJob(V);
      // il va le dire à un voisin (ou demander de la pierre, du bois...)
      const b = V.members.find((b) => b !== a && b.type === 'villager' && b.active && Math.hypot(b.pos.x - a.pos.x, b.pos.z - a.pos.z) < 24);
      if (b) return { kind: 'chat', who: b, lines: [pickOf(['towork', 'look', 'listen']), a.job === 'miner' ? 'stone' : a.job === 'lumberjack' ? 'wood' : 'working'] };
    }
    switch (a.job) {
      case 'lumberjack': {
        // (assez de bois à la mairie : il ne coupe plus, il dégage les chantiers et replante)
        const full = this.hallOk(V) && this.count(this.hallBoxes(V), WOOD) >= this.keep(V, 'wood', WOOD_KEEP);
        // (les arbres inutiles du village : abattus même quand la mairie est pleine)
        return this.clearTask(a, V) || (full ? this.chopTask(a, V, true) : this.chopTask(a, V)) || this.plantTask(a, V);
      }
      case 'miner': {
        // le verre d'abord (four, sable), puis la mine (un seul mineur au front de taille)
        const g = this.glassTask(a, V);
        if (g) return g;
        const digging = V.members.some((b) => b !== a && b.task?.kind === 'mine');
        const stocked = this.count(this.hallBoxes(V), STONE) >= this.keep(V, 'stone', STONE_KEEP); // (assez de pierre en réserve)
        if (V.mine && !V.mine.done && !digging && !stocked) return { kind: 'mine' };
        if (stocked) return V.sands?.length && Math.random() < 0.3 ? { kind: 'sand' } : null;
        if (digging) return V.sands?.length && Math.random() < 0.5 ? { kind: 'sand' } : this.chopTask(a, V);
        // pas encore de mine : il aide à réunir le bois de son chantier
        return V.projects.some((p) => p.type === 'mine' && !p.paid) ? this.chopTask(a, V) : null;
      }
      case 'mason': {
        // (le reste d'abord ; les maisons quand il n'y a pas de charpentier, ou rien d'autre à faire)
        const carp = V.members.some((b) => b.job === 'carpenter' && b.active && !b.dead);
        // (un cantonnier s'occupe des chemins : le maçon fait le reste, et l'aide s'il n'a rien)
        const rw = V.members.some((b) => b.job === 'roadworker' && b.active && !b.dead);
        const other = rw ? ROLE_NOPATH : ROLE_OTHER, both = rw ? ROLE_NOPATH_HOUSE : ROLE_BOTH;
        const t = carp ? this.masonTask(a, V, other) || this.masonTask(a, V, ROLE_HOUSE, true) : this.masonTask(a, V, both);
        return t || (rw ? this.masonTask(a, V, ROLE_PATH, true) : null);
      }
      case 'carpenter': return this.masonTask(a, V, ROLE_HOUSE) || this.masonTask(a, V, ROLE_OTHER, true);
      case 'fieldbuilder': return this.masonTask(a, V, ROLE_FIELD) || (this.fieldOf(V, a, true) ? { kind: 'farm' } : null);
      case 'mechanic': return this.mechanicTask(a, V);
      case 'farmer': {
        // (pas de bâtisseur de champs : les fermiers préparent eux-mêmes le champ)
        if (!V.members.some((b) => b.job === 'fieldbuilder' && b.active && !b.dead)) { const t = this.masonTask(a, V, ROLE_FIELD); if (t) return t; }
        return this.fieldOf(V, a) ? { kind: 'farm' } : null;
      }
      case 'fisher': return V.fish ? { kind: 'fish' } : null;
      case 'shepherd': return this.sheepNear(V).length ? { kind: 'shear' } : null;
      case 'forester': return this.foresterTask(a, V);
      case 'leafer': return this.leaferTask(a, V);
      case 'vehiclebuilder': return V.pad || V.projects.some((p) => p.type === 'pad') ? this.mechanicTask(a, V) : this.masonTask(a, V, ROLE_OTHER, true);
      case 'taxi': return V.pad && this.loaded(V.pad.q, V.pad.r) ? { kind: 'taxiwait' } : null;
      case 'roadworker': return this.masonTask(a, V, ROLE_PATH) || (Math.random() < 0.5 ? this.masonTask(a, V, ROLE_OTHER, true) : null);
      case 'teacher': return V.school && this.loaded(V.school.q, V.school.r) ? { kind: 'teach' } : null;
      case 'doctor': return V.hospital && this.loaded(V.hospital.q, V.hospital.r) ? { kind: 'doctor' } : null;
      case 'courier': return this.courierTask(a, V);
      case 'police':
      case 'gendarme': return this.trafficTask(a, V);
      case 'baker':
      case 'butcher': {
        const shop = V.houses.find((s) => s.shop === (a.job === 'baker' ? 'bakery' : 'butchery'));
        if (shop) return { kind: 'shopwork', h: shop };
        return h && Math.random() < 0.6 ? { kind: 'craft' } : null;
      }
      default: return h && Math.random() < 0.6 ? { kind: 'craft' } : null;
    }
  }

  // roles : les chantiers de ces spécialités (voir roleOf) ; onlyPaid : seulement aider sur un
  // chantier déjà payé (un spécialiste qui donne un coup de main, sans aller chercher de matériaux)
  masonTask(a, V, roles = ROLE_BOTH, onlyPaid = false) {
    // un chantier commencé, sinon le premier qu'on peut payer (la mine d'abord : elle donne la
    // pierre des autres), sinon on va chercher ce qui manque au plus important
    // (un chemin qui relie une maison passe avant tout ; la rue principale, en dernier)
    // (le mur d'enceinte : avant tout l'après-midi, pour être prêts à la nuit ; sinon après)
    const ORDER = { mine: 0, house: 1, tower: 1, hotel: 1, barn: 1, shop: 1, grove: 1, apartment: 1, school: 1.5, hospital: 1.5, post: 1.5, pad: 4, road: 3 };
    const rush = this.animals.talk.time() >= WALL_RUSH;
    const rank = (p) => (p.type === 'wall' ? (rush ? -2 : 2) : p.type === 'road' && !p.main ? -1 : ORDER[p.type] ?? 3);
    const ORDER2 = { ...ORDER, field: 1, garden: 1, lights: 2.5, beds: 0.5 };
    const list = V.projects.filter((p) => roles.has(roleOf(p)) && (!onlyPaid || p.paid)).sort((x, y) => (p2(x) - p2(y)));
    function p2(p) { return p.type === 'wall' || p.type === 'road' ? rank(p) : ORDER2[p.type] ?? 3; }
    // (un maçon par chantier : à plusieurs, chacun bâtit autre chose, c'est plus efficace ; s'ils
    // sont tous pris, il aide sur celui qui a le plus de travail restant)
    const busy = (p) => V.members.some((b) => b !== a && b.task?.kind === 'build' && b.task.p === p);
    const open = list.filter((p) => !busy(p));
    const helping = list.filter((p) => p.paid).sort((x, y) => (y.ops.length - y.i) - (x.ops.length - x.i))[0];
    const p = open.find((p) => p.paid) || open.find((p) => this.canPay(V, p)) || helping || open[0];
    if (!p) return null;
    if (p.paid || this.pay(V, p)) { this.say(a, 'towork', 0.3); return { kind: 'build', p }; }
    // il manque de quoi bâtir : il va le demander (ou couper du bois s'il n'y a pas de bûcheron)
    const m = this.missing(V, p), what = m.wood ? 'wood' : 'stone';
    const job = what === 'wood' ? 'lumberjack' : 'miner';
    const who = V.members.find((b) => b.job === job && b.active && b !== a);
    if (who && Math.random() < 0.5) return { kind: 'chat', who, lines: [what, 'wait'], answer: ['working', 'done', 'here'] };
    if (what === 'wood' && !who) return this.chopTask(a, V);
    return Math.random() < 0.3 ? { kind: 'craft' } : null;
  }

  // Un chantier est encombré de feuilles ou de troncs : le bûcheron va les enlever (au plus deux
  // bûcherons en même temps)
  clearTask(a, V) {
    if (!V.clearing.size) return null;
    for (const k of [...V.clearing]) {
      const [q, r, y] = k.split(',').map(Number);
      if (this.loaded(q, r)) { const id = this.get(q, r, y); if (!LEAFY.has(id) && !isLog(id)) V.clearing.delete(k); }
    }
    if (!V.clearing.size) return null;
    if (V.members.filter((b) => b !== a && b.task?.kind === 'clear').length >= 2) return null;
    // la case la plus proche
    let best = null, bd = Infinity;
    for (const k of V.clearing) {
      const [q, r, y] = k.split(',').map(Number), c = hexToWorld(q, r), d = Math.hypot(c.x - a.pos.x, c.z - a.pos.z) + Math.abs(y - a.pos.y);
      if (d < bd) { bd = d; best = [q, r, y]; }
    }
    return { kind: 'clear', at: best };
  }
  // Enlève les feuilles et les troncs du chantier à sa portée (le bois va dans ses poches)
  do_clear(a, V, t, dt) {
    const [q, r, y] = t.at;
    if (!t.phase) { t.phase = 'go'; this.goCell(a, t, q, r, undefined, 3, CLEAR_REACH); return; }
    let next = null, bd = Infinity;
    for (const k of V.clearing) {
      const [cq, cr, cy] = k.split(',').map(Number), c = hexToWorld(cq, cr);
      const d = Math.hypot(c.x - a.pos.x, c.z - a.pos.z);
      if (d <= CLEAR_REACH + 1 && Math.abs(cy - a.pos.y) <= 7 && d + Math.abs(cy - a.pos.y) * 0.2 < bd) { bd = d + Math.abs(cy - a.pos.y) * 0.2; next = [cq, cr, cy]; }
    }
    if (!next) { this.say(a, 'done', 0.3); this.end(a, t, 0.3); return; }
    if (!this.act(a, t, dt, CLEAR_T, ...this.xz(next))) return;
    const id = this.get(...next);
    V.clearing.delete(next.join(','));
    if (LEAFY.has(id) || isLog(id)) {
      if (isLog(id)) addCarry(a, id);
      this.set(next[0], next[1], next[2], AIR);
    }
    if (carried(a) >= CARRY_MAX * 2) this.end(a, t);
  }

  // Plus d'arbre à couper : le bûcheron plante des pousses autour du village (elles deviennent
  // des arbres, voir nature.js)
  plantTask(a, V) {
    V.saplings = (V.saplings || []).filter((p) => !this.loaded(p[0], p[1]) || PLANTS.has(this.get(...p)));
    // avec une pépinière : une place vide de la pépinière
    if (V.grove) {
      for (const [q, r, y] of this.groveSpots(V)) {
        if (!this.loaded(q, r) || this.get(q, r, y) !== AIR || this.get(q, r, y + 1) !== AIR) continue;
        const under = this.get(q, r, y - 1);
        if (under !== 1 && under !== 2) continue;
        if (V.members.some((b) => b !== a && b.task?.kind === 'plant' && b.task.at[0] === q && b.task.at[1] === r)) continue;
        return { kind: 'plant', at: [q, r, y] };
      }
      return null;
    }
    if (V.saplings.length >= GROVE) return null;
    const taken = this.footprints(V);
    for (let n = 0; n < 20; n++) {
      const ang = Math.random() * Math.PI * 2, d = rnd(14, 30);
      const { q, r } = worldToHex(V.x + Math.cos(ang) * d, V.z + Math.sin(ang) * d);
      if (taken.some(([tq, tr, rad]) => hexDist(q - tq, r - tr) <= rad + 2) || V.roadSet.has(ck(q, r))) continue;
      if (V.saplings.some((p) => hexDist(p[0] - q, p[1] - r) < 4)) continue;
      const g = this.groundAt(q, r);
      if (!g || (g.id !== 1 && g.id !== 2) || this.get(q, r, g.y + 1) !== AIR || this.get(q, r, g.y + 2) !== AIR) continue;
      return { kind: 'plant', at: [q, r, g.y + 1] };
    }
    return null;
  }
  do_plant(a, V, t, dt) {
    const [q, r, y] = t.at;
    if (!t.phase) { t.phase = 'go'; this.goCell(a, t, q, r, y, 1, 2.5); return; }
    if (!this.act(a, t, dt, ACT_T, ...this.xz(t.at))) return;
    const under = this.get(q, r, y - 1);
    if (this.get(q, r, y) === AIR && (under === 1 || under === 2)) {
      this.set(q, r, y, SAPLING);
      (V.saplings ||= []).push([q, r, y]);
      this.say(a, 'plant', 0.4);
    }
    this.end(a, t, rnd(2, 6));
  }

  chopTask(a, V, onlyJunk = false) {
    if (onlyJunk && !V.grove) return null;
    let best = null, bd = Infinity;
    V.trees = V.trees.filter((t) => !this.loaded(t.q, t.r) || isLog(this.get(t.q, t.r, t.y)));
    // avec une pépinière : d'abord les arbres inutiles du village, puis ceux de la pépinière
    // (grands : avec leurs feuilles) ; en forêt seulement s'il manque du bois à la mairie
    let rank = null;
    if (V.grove) {
      for (const [q, r, y] of this.groveSpots(V)) {
        if (this.loaded(q, r) && isLog(this.get(q, r, y)) && this.isTree(q, r, y) && !V.trees.some((t) => t.q === q && t.r === r)) V.trees.push({ q, r, y, claim: 0, until: 0, grove: true });
      }
      const low = !this.hallOk(V) || this.count(this.hallBoxes(V), WOOD) < WOOD_LOW;
      rank = (t) => (t.junk || (this.inVillage(V, t.q, t.r) && !this.inGrove(V, t.q, t.r)) ? 0 : onlyJunk ? Infinity : this.inGrove(V, t.q, t.r) ? 1000 : low ? 2000 : Infinity);
    }
    for (const t of V.trees) {
      if (t.claim && t.claim !== a.id && t.until > this.clock) continue;
      if (rank && rank(t) === Infinity) continue;
      const c = hexToWorld(t.q, t.r), d = Math.hypot(c.x - a.pos.x, c.z - a.pos.z) + (rank ? rank(t) : 0);
      if (d < bd) { bd = d; best = t; }
    }
    if (!best) return null;
    best.claim = a.id;
    best.until = this.clock + 240;
    return { kind: 'chop', tree: best };
  }

  // ---------- Exécution ----------
  run(a, V, t, dt) {
    if (t.wait) { const D = t.dest; this.goCell(a, t, D.q, D.r, D.y, D.reach, D.near); return; }
    if (t.goal && !this.walk(a, t, dt)) return;
    if (t.failed && t.kind !== 'build') {
      this.drop(V, t);
      this.end(a, t);
      // (plusieurs échecs de suite : il s'écarte un peu avant de réessayer, autre point de départ)
      if ((a.fails = (a.fails || 0) + 1) >= 3) {
        a.fails = 0;
        const me = worldToHex(a.pos.x, a.pos.z), [dq, dr] = pickOf(NEIGHBORS);
        a.task = { kind: 'away', from: [me.q - dq, me.r - dr] };
      }
      return;
    }
    if (!this.workTime() && t.kind !== 'rest' && t.kind !== 'deposit' && t.kind !== 'home' && t.kind !== 'patrol' && t.kind !== 'fight' && t.kind !== 'away' && t.kind !== 'taxiride' && t.kind !== 'airpatrol' && t.kind !== 'heal') {
      // la nuit tombe : on rentre (le mineur remonte d'abord)
      if (t.kind === 'mine' && t.phase !== 'up') { this.mineUp(a, V, t); return; }
      if (t.kind !== 'mine') { this.drop(V, t); this.end(a, t); return; }
    }
    this['do_' + t.kind](a, V, t, dt);
  }
  drop(V, t) { if (t.tree && t.tree.until) t.tree.until = 0; }
  end(a, t, rest = rnd(0.5, 1.5)) {
    a.task = null;
    a.target = null;
    if (a.state === 'walk' || a.state === 'work') a.state = 'idle';
    a.timer = rnd(0.5, 2);
    a.pace = 1;
    a.brainT = rest;
  }

  // Marche vers t.goal (puis les points suivants de t.path) ; vrai une fois arrivé
  go(a, t, x, z, reach = 1, y) {
    t.goal = { x, z, reach, y };
    t.tries = 0;
    t.walkT = 0;
    a.target = { x, z };
    a.state = 'walk';
    a.timer = 999;
    a.pace = PACE;
  }
  follow(a, t, pts, reach = 1) {
    t.path = pts.slice(1);
    t.pathReach = reach;
    const [x, z, y] = pts[0];
    this.go(a, t, x, z, pts.length > 1 ? 0.5 : reach, y);
  }
  // Aller vers la case (q, r) (à la hauteur y si on la connaît), à `reach` cases près, par le
  // plus court chemin (voir findPath). near : s'il n'y arrive pas, assez près pour travailler.
  goCell(a, t, q, r, y, reach = 0, near = 0) {
    t.dest = { q, r, y, reach, near };
    if (this.nodes > FRAME_NODES) { t.wait = true; a.state = 'idle'; return true; } // (à l'image suivante)
    t.wait = false;
    const path = this.findPath(a.pos, q, r, y, reach);
    if (!path) return this.giveUp(a, t);
    t.partial = !path.done;
    if (!path.length) { t.goal = null; a.state = 'work'; return true; }
    this.follow(a, t, path.map((c) => this.cellPos(c)), 0.45);
    return true;
  }
  // Pas de chemin : assez près quand même ? (sinon la tâche échoue)
  giveUp(a, t) {
    const d = t.dest;
    t.goal = null;
    t.path = null;
    a.target = null;
    if (d && d.near) {
      const c = hexToWorld(d.q, d.r);
      if (Math.hypot(c.x - a.pos.x, c.z - a.pos.z) <= d.near) { a.state = 'work'; return true; }
    }
    t.failed = true;
    a.state = 'idle';
    return false;
  }
  walk(a, t, dt) {
    const g = t.goal;
    // arrêté par un agent de la circulation : il attend son tour, puis repart
    if (a.hold > 0) {
      a.hold -= dt;
      a.state = 'idle';
      a.target = null;
      if (a.hold <= 0) { a.state = 'walk'; a.target = { x: g.x, z: g.z }; a.timer = 999; }
      return false;
    }
    const d = Math.hypot(g.x - a.pos.x, g.z - a.pos.z);
    if (d <= g.reach && (g.y === undefined || Math.abs(a.pos.y - g.y) < 1.2)) {
      if (t.path?.length) {
        const [x, z, y] = t.path.shift();
        const last = !t.path.length;
        g.x = x; g.z = z; g.y = y; g.reach = last ? t.pathReach : 0.5;
        t.tries = 0;
        a.target = { x, z };
        a.state = 'walk';
        return false;
      }
      // bout d'un chemin partiel (destination lointaine) : on cherche la suite
      if (t.partial && t.dest && (t.replans = (t.replans || 0) + 1) <= 6) {
        const D = t.dest;
        this.goCell(a, t, D.q, D.r, D.y, D.reach, D.near);
        return !t.goal;
      }
      t.goal = null;
      a.target = null;
      a.state = 'work';
      a.pace = 1;
      a.fails = 0;
      return true;
    }
    t.walkT += dt;
    if (a.state !== 'walk' || t.walkT > 90) {
      // coincé contre un coin, une marche, un rebord : après quelques essais, il franchit d'un
      // bond le petit bout qui reste jusqu'au point suivant (tout près, et libre)
      if (t.tries >= 3 && this.hop(a, g)) { t.tries = 0; a.state = 'walk'; return false; }
      // arrêté (une bête, un joueur, un bloc posé entre-temps...) : on réessaie, puis on
      // recalcule le chemin, puis on renonce
      if (++t.tries > 12 || t.walkT > 90) {
        const D = t.dest;
        if (D && (t.replans = (t.replans || 0) + 1) <= 3) { this.goCell(a, t, D.q, D.r, D.y, D.reach, D.near); return !t.goal; }
        this.giveUp(a, t);
        return true;
      }
      a.target = { x: g.x + rnd(-0.15, 0.15), z: g.z + rnd(-0.15, 0.15) };
      a.state = 'walk';
      a.timer = 999;
    }
    return false;
  }

  // Bond jusqu'au point g (s'il est à moins de 1,7 bloc, à peu près à la même hauteur, et qu'on
  // peut s'y tenir)
  hop(a, g) {
    const d = Math.hypot(g.x - a.pos.x, g.z - a.pos.z);
    if (d > 1.7) return false;
    const c = worldToHex(g.x, g.z), y0 = g.y ?? Math.floor(a.pos.y + 0.05);
    for (const y of [y0, y0 + 1, y0 - 1]) {
      if (Math.abs(y - a.pos.y) > 1.3 || !this.loaded(c.q, c.r)) continue;
      this.fq = this.fr = NaN;
      if (!this.standable(c.q, c.r, y)) continue;
      a.pos.set(g.x, y + 0.01, g.z);
      a.vel?.set(0, 0, 0);
      return true;
    }
    return false;
  }
  // Pris dans un bloc (posé sur lui, un éboulement...) : il en sort par la case libre la plus proche
  escape(a) {
    const me = worldToHex(a.pos.x, a.pos.z), fy = Math.floor(a.pos.y + 0.05);
    this.fq = this.fr = NaN;
    for (let R = 0; R <= 3; R++) {
      for (let dq = -R; dq <= R; dq++) for (let dr = -R; dr <= R; dr++) {
        if (hexDist(dq, dr) !== R || !this.loaded(me.q + dq, me.r + dr)) continue;
        for (const dy of [0, 1, -1, 2, -2]) {
          if (!this.standable(me.q + dq, me.r + dr, fy + dy) || isPod(this.get(me.q + dq, me.r + dr, fy + dy))) continue;
          const c = hexToWorld(me.q + dq, me.r + dr);
          a.pos.set(c.x, fy + dy + 0.01, c.z);
          a.vel?.set(0, 0, 0);
          return true;
        }
      }
    }
    return false;
  }

  // ---------- Chemins ----------
  // Peut-on se tenir dans la case (q, r) à la hauteur y ? (sol dessous, deux cases libres, ni
  // eau ni lave)
  // (un lit de villageois : on y entre, par son ouverture, voir findPath)
  standable(q, r, y) {
    const here = this.fast(q, r, y), up = this.fast(q, r, y + 1), down = this.fast(q, r, y - 1);
    return !(SOLID[here] && !isPod(here)) && !isWater(here) && !isLava(here) && !(SOLID[up] && !isPod(up)) && !!SOLID[down] && !isPod(down);
  }
  // Lecture rapide d'un bloc pendant une recherche de chemin (données du chunk gardées sous la
  // main ; hors des chunks chargés : un mur)
  fast(q, r, y) {
    if (y < Y_MIN) return 4;
    if (y >= H) return AIR;
    const cq = Math.floor(q / CS), cr = Math.floor(r / CS);
    if (cq !== this.fq || cr !== this.fr) {
      this.fq = cq; this.fr = cr;
      this.fd = this.world.chunks?.get(chunkKey(cq, cr))?.data || null;
    }
    return this.fd ? this.fd[idx(q - cq * CS, r - cr * CS, y)] : 4; // (chunk pas chargé : on n'y va pas)
  }
  // A* sur les cases : marche à plat, monte d'un bloc (un saut), descend de trois au plus. Les
  // routes de gravier coûtent moins cher (on les prend). budget : cases examinées au plus ; au-
  // delà, chemin jusqu'à la case la plus proche du but (done = false). null : aucun chemin.
  findPath(pos, tq, tr, ty, reach = 0, budget = PATH_NODES) {
    this.fq = this.fr = NaN; // (les blocs ont pu changer depuis la dernière recherche)
    const { q: sq, r: sr } = worldToHex(pos.x, pos.z);
    let sy = Math.floor(pos.y + 0.05);
    if (!this.standable(sq, sr, sy)) {
      if (this.standable(sq, sr, sy + 1)) sy++;
      else if (this.standable(sq, sr, sy - 1)) sy--;
    }
    const goal = (q, r, y) => hexDist(q - tq, r - tr) <= reach && (ty === undefined || Math.abs(y - ty) <= 2);
    const h = (q, r, y) => 1.4 * (Math.max(0, hexDist(q - tq, r - tr) - reach) + (ty === undefined ? 0 : Math.abs(y - ty) * 0.3));
    const start = { q: sq, r: sr, y: sy, g: 0, f: h(sq, sr, sy), from: null };
    if (goal(sq, sr, sy)) return Object.assign([], { done: true });
    const kOf = (q, r, y) => ((q + 32768) * 65536 + (r + 32768)) * 256 + y; // (clé numérique)
    const open = [start], seen = new Map([[kOf(sq, sr, sy), start]]);
    let best = start, n = 0;
    const push = (node) => { // tas binaire sur f
      open.push(node);
      let i = open.length - 1;
      while (i > 0) { const p = (i - 1) >> 1; if (open[p].f <= node.f) break; open[i] = open[p]; i = p; }
      open[i] = node;
    };
    const pop = () => {
      const top = open[0], last = open.pop();
      if (open.length) {
        let i = 0;
        for (;;) {
          const l = 2 * i + 1, r = l + 1;
          let m = i, fm = last.f;
          if (l < open.length && open[l].f < fm) { m = l; fm = open[l].f; }
          if (r < open.length && open[r].f < fm) m = r;
          if (m === i) break;
          open[i] = open[m];
          i = m;
        }
        open[i] = last;
      }
      return top;
    };
    let found = null;
    while (open.length && n++ < budget) {
      this.nodes = (this.nodes || 0) + 1;
      const cur = pop();
      if (cur.closed) continue;
      cur.closed = true;
      if (goal(cur.q, cur.r, cur.y)) { found = cur; break; }
      if (cur.f - cur.g < best.f - best.g) best = cur;
      const inPod = BLOCKS[this.fast(cur.q, cur.r, cur.y)]?.pod;
      for (let i = 0; i < 6; i++) {
        const [a, b] = NEIGHBORS[i];
        // (dans un lit : on n'en sort que par son ouverture)
        if (inPod !== undefined && i !== inPod) continue;
        const q = cur.q + a, r = cur.r + b;
        let ny = null;
        for (const dy of [0, 1, -1, -2, -3]) {
          const y = cur.y + dy;
          if (dy === 1 && SOLID[this.fast(cur.q, cur.r, cur.y + 2)]) continue; // (place pour sauter)
          if (!this.standable(q, r, y)) continue;
          if (dy < 0) { // on y descend : la case doit être libre jusqu'à notre tête
            let clear = true;
            for (let yy = y + 2; yy <= cur.y + 1; yy++) if (SOLID[this.fast(q, r, yy)]) { clear = false; break; }
            if (!clear) continue;
          }
          ny = y;
          break;
        }
        if (ny === null) continue;
        // (on n'entre dans un lit que par son ouverture, de plain-pied)
        const pod = BLOCKS[this.fast(q, r, ny)]?.pod;
        if (pod !== undefined && ((i + 3) % 6 !== pod || ny !== cur.y)) continue;
        const k = kOf(q, r, ny);
        const road = this.fast(q, r, ny - 1) === GRAVEL;
        const g = cur.g + (road ? 0.7 : 1) + (ny !== cur.y ? 0.5 : 0);
        const old = seen.get(k);
        if (old && (old.closed || old.g <= g)) continue;
        const node = { q, r, y: ny, g, f: g + h(q, r, ny), from: cur };
        seen.set(k, node);
        push(node);
      }
    }
    const end = found || (hexDist(best.q - tq, best.r - tr) + 3 < hexDist(sq - tq, sr - tr) ? best : null);
    if (!end) return null;
    const out = [];
    for (let c = end; c && c !== start; c = c.from) out.push([c.q, c.r, c.y]);
    out.reverse();
    out.done = !!found;
    return out;
  }
  face(a, x, z) { a.yaw = Math.atan2(-(x - a.pos.x), -(z - a.pos.z)); a.headTarget = 0; }
  // Attente de travail (t.clock) : vrai quand l'action peut se faire
  act(a, t, dt, time, x, z) {
    a.state = 'work';
    a.work = 0.3;
    if (x !== undefined) this.face(a, x, z);
    if (t.clock === undefined) t.clock = time;
    t.clock -= dt;
    if (t.clock > 0) return false;
    t.clock = time;
    return true;
  }

  // Couper un arbre (du haut vers le bas), replanter une pousse
  do_chop(a, V, t, dt) {
    const tr = t.tree, c = hexToWorld(tr.q, tr.r);
    if (!t.phase) {
      t.phase = 'go';
      this.goCell(a, t, tr.q, tr.r, tr.y, 2, 4);
      return;
    }
    if (t.phase === 'go') {
      if (!isLog(this.get(tr.q, tr.r, tr.y))) { this.end(a, t); return; }
      t.logs = this.treeLogs(tr);
      t.phase = 'cut';
      this.say(a, pickOf(['wood', 'working']), 0.25);
      return;
    }
    if (!this.act(a, t, dt, CHOP_T, c.x, c.z)) return;
    const L = t.logs.pop();
    if (L) {
      const id = this.get(L[0], L[1], L[2]);
      if (isLog(id)) { this.set(L[0], L[1], L[2], AIR); addCarry(a, id); }
      if (carried(a) < 64) return;
    }
    // l'arbre est à terre : une pousse à sa place (avec une pépinière : seulement dans la pépinière ;
    // un arbre inutile du village, lui, ne repousse pas)
    const under = this.get(tr.q, tr.r, tr.y - 1);
    if (this.get(tr.q, tr.r, tr.y) === AIR && (under === 1 || under === 2) && (!V.grove || this.inGrove(V, tr.q, tr.r))) {
      this.set(tr.q, tr.r, tr.y, SAPLING_OF[t.logs.id] || SAPLING);
      (V.saplings ||= []).push([tr.q, tr.r, tr.y]); // (plantée par le village : le forestier la laisse pousser)
    }
    V.trees.splice(V.trees.indexOf(tr), 1);
    this.say(a, 'done', 0.3);
    this.end(a, t);
  }
  // Bûches de l'arbre (reliées entre elles, branches comprises), la plus haute en dernier
  treeLogs(tr) {
    const seen = new Set(), out = [], queue = [[tr.q, tr.r, tr.y]];
    let first = 0;
    while (queue.length && out.length < 120) {
      const [q, r, y] = queue.shift(), k = q + ',' + r + ',' + y;
      if (seen.has(k)) continue;
      seen.add(k);
      const id = this.get(q, r, y);
      if (!isLog(id) || hexDist(q - tr.q, r - tr.r) > 6 || y < tr.y) continue;
      if (!first) first = id;
      out.push([q, r, y]);
      queue.push([q, r, y + 1], [q, r, y - 1]);
      for (const [a, b] of NEIGHBORS) queue.push([q + a, r + b, y], [q + a, r + b, y + 1]);
    }
    out.sort((u, v) => u[2] - v[2]);
    out.id = first;
    return out;
  }

  // Chez lui : poser l'établi, puis le coffre, et y ranger le reste du bois
  do_home(a, V, t, dt) {
    const h = this.houseOf(V, a);
    if (!h) { this.end(a, t); return; }
    const c = hexToWorld(h.q, h.r);
    if (!t.phase) { t.phase = 'go'; this.goCell(a, t, h.q, h.r, h.y + 1, 1, 2.5); return; }
    const tp = this.tableAt(h), cp = this.chestAt(h);
    if (!this.hasTable(h)) {
      if (!this.act(a, t, dt, ACT_T, ...this.xz(tp))) return;
      if (logsOf(a) >= 1 && free(this.get(...tp))) { takeLogs(a, 1); this.set(...tp, CRAFTING_TABLE); this.say(a, 'myhome', 0.6); }
      else { this.end(a, t); return; }
      return;
    }
    if (!this.hasChest(h)) {
      if (!this.act(a, t, dt, ACT_T, ...this.xz(cp))) return;
      if (logsOf(a) >= 2 && free(this.get(...cp))) { takeLogs(a, 2); this.placeChest(null, cp, h); }
      else { this.end(a, t); return; }
      return;
    }
    if (!this.act(a, t, dt, ACT_T, ...this.xz(cp))) return;
    const b = this.box(cp);
    if (b) this.unload(a, [b]);
    this.end(a, t);
  }
  xz(p) { const c = hexToWorld(p[0], p[1]); return [c.x, c.z]; }

  // Le premier installé pose le coffre de la mairie (et y vide ses poches)
  do_hall(a, V, t, dt) {
    if (this.hallOk(V)) { this.end(a, t, 0.2); return; }
    const p = this.hallSpots(V).find((s) => free(this.get(...s)));
    if (!p) { this.end(a, t, 20); return; }
    const [x, z] = this.xz(p);
    if (!t.phase) { t.phase = 'go'; this.goCell(a, t, p[0], p[1], p[2], 1, 2.5); return; }
    if (!this.act(a, t, dt, ACT_T, x, z)) return;
    const b = this.placeChest(V, p);
    if (b) this.unload(a, [b], V);
    this.say(a, 'ourhome');
    for (const w of V.members) if (w !== a && w.active && Math.random() < 0.4) this.animals.talk.later(w, pickOf(['look', 'thanks', 'friend']), rnd(1, 3));
    this.end(a, t);
  }

  // ---------- Mécanicien ----------
  // Place de parking k de la plateforme : centre [q, r], hauteur du plateau (sur la plateforme)
  // (milieu d'un côté, à 3 du centre : loin des poteaux des coins et du bloc cible)
  slotOf(V, k) { const [a, b] = midCell(3, k); return [V.pad.q + a, V.pad.r + b, V.pad.y + 1]; }
  // Un véhicule (un objet physique) est-il garé à cette place ?
  carAt(V, k) {
    const [q, r, y] = this.slotOf(V, k), c = hexToWorld(q, r);
    return (this.structs?.list || []).some((s) => Math.hypot(s.pos.x - c.x, s.pos.z - c.z) < 2.5 && Math.abs(s.pos.y - y) < 3);
  }
  // Une place libre (rien de garé, rien de posé dessus), ou -1
  freeSlot(V, me = null) {
    for (const k of PAD_SLOTS) {
      if (this.carAt(V, k)) continue;
      if (V.members.some((b) => b !== me && b.task?.kind === 'vehicle')) return -1; // (un véhicule à la fois)
      const [q, r, y] = this.slotOf(V, k);
      if ([[0, 0], ...NEIGHBORS].every(([a, b]) => this.get(q + a, r + b, y) === AIR && this.get(q + a, r + b, y + 1) === AIR)) return k;
    }
    return -1;
  }
  // Ce que coûte un véhicule, pris à la mairie : 3 bûches et 2 voltites et 2 fers (minerai ou
  // lingots) quand le village en a ; sinon (la voltite est rare) 3 bûches et 6 pierres, ou 7
  // bûches sans pierre. Liste de [ids, nombre], ou null s'il manque quelque chose
  carParts(V) {
    const boxes = this.hallBoxes(V), enough = (l) => l.every(([ids, n]) => this.count(boxes, ids) >= n);
    for (const l of [[[WOOD, 3], [[123], 2], [[60, 122], 2]], [[WOOD, 3], [STONE, 6]], [[WOOD, 7]]]) if (enough(l)) return l;
    return null;
  }
  // Véhicules du village : ceux garés autour de la plateforme, et ceux partis en course de taxi
  carCount(V) {
    const c = hexToWorld(V.pad.q, V.pad.r), list = this.structs?.list || [];
    const near = list.filter((s) => Math.hypot(s.pos.x - c.x, s.pos.z - c.z) < PAD_R + 6 && Math.abs(s.pos.y - V.pad.y) < 12);
    const away = V.members.filter((b) => (b.task?.kind === 'taxiride' || b.task?.kind === 'airpatrol') && !near.includes(b.task.s)).length;
    return near.length + away;
  }
  mechanicTask(a, V) {
    const pad = V.projects.find((p) => p.type === 'pad');
    if (pad && (pad.paid || this.pay(V, pad))) return { kind: 'build', p: pad };
    // (assez de véhicules, ou le dernier est tout récent : pas de nouveau)
    if (V.pad && this.loaded(V.pad.q, V.pad.r) && this.clock >= (V.carT || 0) && this.carCount(V) < CARS_MAX) {
      const k = this.freeSlot(V, a);
      if (k >= 0 && this.carParts(V)) return { kind: 'vehicle', slot: k };
      // il manque de la voltite ou du fer : il va en parler au mineur
      if (k >= 0 && Math.random() < 0.2) {
        const who = V.members.find((b) => b.job === 'miner' && b.active);
        if (who) return { kind: 'chat', who, lines: ['iron', 'give'], answer: ['working', 'wait'] };
      }
    }
    return this.houseOf(V, a) && Math.random() < 0.5 ? { kind: 'craft' } : null;
  }
  // Assemble un véhicule à une place de la plateforme, bloc par bloc, puis le colle
  do_vehicle(a, V, t, dt) {
    if (!V.pad || !this.structs) { this.end(a, t); return; }
    const [q, r, y] = this.slotOf(V, t.slot);
    // (il se tient vers le centre de la plateforme, pas sur les cases du véhicule)
    if (!t.phase) { t.phase = 'go'; const [iq, ir] = midCell(1, t.slot); this.goCell(a, t, V.pad.q + iq, V.pad.r + ir, undefined, 0, 4); return; }
    if (!t.parts) {
      const cost = this.carParts(V);
      if (!cost || this.carAt(V, t.slot)) { this.end(a, t, 10); return; }
      const boxes = this.hallBoxes(V);
      for (const [ids, n] of cost) this.take(boxes, ids, n);
      const [p0, p3, g1] = [DIRS6[0], DIRS6[3], DIRS6[1]];
      t.parts = [[q, r, y, 18], ...NEIGHBORS.map(([dq, dr]) => [q + dq, r + dr, y, 18]),
        [q + p0[0], r + p0[1], y + 1, 66], [q + p3[0], r + p3[1], y + 1, 66], [q + g1[0], r + g1[1], y + 1, 81], [q, r, y + 1, 79]];
      t.n = 0;
      this.say(a, 'working', 0.5);
    }
    if (t.n < t.parts.length) {
      if (!this.act(a, t, dt, BUILD_T * 1.5, ...this.xz([q, r]))) return;
      const [pq, pr, py, id] = t.parts[t.n++];
      // (quelqu'un sur la case : on la reprend un peu plus tard)
      if (this.get(pq, pr, py) === AIR && this.occupied(pq, pr, py) && (t.retry = (t.retry || 0) + 1) < 20) { t.parts.push(t.parts[t.n - 1]); return; }
      if (this.get(pq, pr, py) === AIR && !this.occupied(pq, pr, py)) this.set(pq, pr, py, id);
      return;
    }
    // réglages : les blocs physiques (leur vitesse fait la vitesse maximale), le gravitron (vers
    // la plateforme : levier levé sans autre destination, il y reste)
    const W = this.structs.worldParams, pc = hexToWorld(V.pad.q, V.pad.r);
    for (const [pq, pr, py, id] of t.parts) {
      if (id === 66) W.set(pq + ',' + pr + ',' + py, [12, 0, 0]);
      if (id === 81) W.set(pq + ',' + pr + ',' + py, [Math.round(pc.x), V.pad.y + 1, Math.round(pc.z), 1]);
    }
    const s = this.structs.assemble(t.parts.filter(([pq, pr, py, id]) => this.get(pq, pr, py) === id).map(([pq, pr, py]) => [pq, pr, py]));
    if (s) { this.say(a, 'look'); this.animals.talk.later(a, 'done', 1.4); V.carT = this.clock + CAR_EVERY; }
    this.end(a, t, rnd(5, 15));
  }

  // ---------- Verre ----------
  // Four du village (dans la mairie, ou à côté du puits), s'il existe : [q, r, y]
  furnaceAt(V) {
    const F = V.furnace;
    if (F && (!this.loaded(F[0], F[1]) || isFurnace(this.get(...F)))) return F;
    V.furnace = null;
    return null;
  }
  furnaceSpot(V) {
    const h = V.houses[V.hallI];
    if (h) return this.slots(h, Math.max(1, h.rad - 2)).find((p) => this.get(...p) === AIR) || null;
    const [a, b] = DIRS6[4], q = V.q + a * 3, r = V.r + b * 3, g = this.groundAt(q, r);
    return g && this.get(q, r, g.y + 1) === AIR ? [q, r, g.y + 1] : null;
  }
  // Ce que le mineur a à faire pour le verre (ou null) : récupérer les vitres, recharger le
  // four, se fabriquer un four, aller chercher du sable
  glassTask(a, V) {
    if (V.stoneless || !this.hallOk(V)) return null;
    const boxes = this.hallBoxes(V), F = this.furnaceAt(V);
    const sand = this.count(boxes, SAND), glass = this.count(boxes, GLASS), fuel = this.count(boxes, FUELS);
    if (F) {
      const c = this.box(F);
      if (c && (c.output?.n >= 4 || (!c.burn && c.output) || (sand >= 4 && !c.input && (c.fuel || fuel)) || (c.input && !c.fuel && !c.burn && fuel))) return { kind: 'smelt' };
    }
    if (glass >= GLASS_WANT) return null;
    if (!F) return this.count(boxes, STONE) >= 8 && this.furnaceSpot(V) ? { kind: 'furnace' } : null;
    if (sand < 8 && V.sands?.length && Math.random() < 0.6) return { kind: 'sand' };
    return null;
  }
  // Se fabrique un four (8 pierres taillées de la mairie) et le pose
  do_furnace(a, V, t, dt) {
    const p = t.at || (t.at = this.furnaceSpot(V));
    if (!p || this.furnaceAt(V)) { this.end(a, t); return; }
    if (!t.phase) { t.phase = 'go'; this.goCell(a, t, p[0], p[1], p[2], 1, 2.5); return; }
    if (!this.act(a, t, dt, ACT_T * 2, ...this.xz(p))) return;
    const boxes = this.hallBoxes(V);
    if (this.count(boxes, STONE) < 8 || this.get(...p) !== AIR) { this.end(a, t, 5); return; }
    this.take(boxes, STONE, 8);
    const h = V.houses[V.hallI], c = h ? hexToWorld(h.q, h.r) : { x: V.x, z: V.z };
    const k = h ? sideToward(p[0], p[1], c.x, c.z) : (sideToward(p[0], p[1], c.x, c.z) + 3) % 6;
    this.set(p[0], p[1], p[2], facingVariant(FURNACE, k));
    V.furnace = p;
    this.say(a, 'look', 0.6);
    this.end(a, t);
  }
  // Va creuser le sable d'un coin connu (le dessus seulement, loin de l'eau), jusqu'à 16
  do_sand(a, V, t, dt) {
    if (!t.spot) {
      const list = V.sands || [];
      if (!list.length) { this.end(a, t); return; }
      t.spot = list.reduce((b, p) => { const c = hexToWorld(p[0], p[1]), d = Math.hypot(c.x - a.pos.x, c.z - a.pos.z); return d < b.d ? { p, d } : b; }, { p: null, d: Infinity }).p;
    }
    const [sq, sr] = t.spot;
    if (!t.phase) { t.phase = 'go'; this.goCell(a, t, sq, sr, undefined, 1, 3); return; }
    if (!this.act(a, t, dt, DIG_T * 0.6, ...this.xz(t.spot))) return;
    // une case de sable à découvert autour du coin, sans eau à côté (pas d'inondation)
    let cell = null;
    for (const [dq, dr] of [[0, 0], ...NEIGHBORS, ...NEIGHBORS.map(([x, y]) => [2 * x, 2 * y])]) {
      const q = sq + dq, r = sr + dr, g = this.groundAt(q, r);
      if (!g || g.id !== 8 || this.get(q, r, g.y + 1) !== AIR) continue;
      if (NEIGHBORS.some(([x, y]) => isWater(this.get(q + x, r + y, g.y)) || isWater(this.get(q + x, r + y, g.y + 1)))) continue;
      cell = [q, r, g.y];
      break;
    }
    if (!cell) { V.sands = V.sands.filter((p) => p !== t.spot); this.end(a, t); return; }
    this.set(...cell, AIR);
    addCarry(a, 8);
    if (carried(a) >= CARRY_MAX) { this.say(a, 'done', 0.3); this.end(a, t); }
  }
  // Au four : récupère les vitres, remet du sable et du combustible (charbon, sinon bûches)
  do_smelt(a, V, t, dt) {
    const F = this.furnaceAt(V);
    if (!F) { this.end(a, t); return; }
    if (!t.phase) { t.phase = 'go'; this.goCell(a, t, F[0], F[1], F[2], 1, 2.5); return; }
    if (!this.act(a, t, dt, ACT_T, ...this.xz(F))) return;
    const c = this.box(F), boxes = this.hallBoxes(V);
    if (!c || c.type !== 'furnace') { this.end(a, t); return; }
    if (c.output) {
      let n = c.output.n;
      for (const b of boxes) if (n) n = this.put(b, c.output.id, n);
      c.output = n ? { id: c.output.id, n } : null;
    }
    if (!c.input || c.input.id === 8) {
      const k = Math.min(64 - (c.input?.n || 0), this.count(boxes, SAND));
      if (k > 0) { this.take(boxes, SAND, k); c.input = { id: 8, n: (c.input?.n || 0) + k }; }
    }
    if (!c.fuel && c.input) {
      for (const id of FUELS) {
        const k = Math.min(id === 104 ? 8 : 16, this.count(boxes, [id]));
        if (k > 0) { this.take(boxes, [id], k); c.fuel = { id, n: k }; break; }
      }
    }
    this.world.changed = true;
    this.say(a, 'working', 0.2);
    this.end(a, t, rnd(5, 15));
  }

  // Prendre du bois à la mairie (pour son établi et son coffre)
  do_fetch(a, V, t, dt) {
    const p = this.hallStand(V);
    if (!p || !this.hallOk(V)) { this.end(a, t); return; }
    if (!t.phase) { t.phase = 'go'; this.goCell(a, t, p[0], p[1], p[2], 1, 2.5); return; }
    if (!this.act(a, t, dt, ACT_T, ...this.xz(p))) return;
    const boxes = this.hallBoxes(V);
    for (const id of WOOD) {
      const k = Math.min(t.n - logsOf(a), this.count(boxes, [id]));
      if (k > 0) { this.take(boxes, [id], k); addCarry(a, id, k); }
    }
    this.say(a, 'thanks', 0.4);
    this.end(a, t, 0.2);
  }

  // Vider ses poches dans les coffres de la mairie
  // Où se tenir pour se servir dans les coffres de la mairie : au milieu de la grande maison (on
  // les a tous à portée de main), ou devant le premier coffre (sans mairie)
  hallStand(V) {
    const h = V.houses[V.hallI];
    return h ? [h.q, h.r, h.y + 1] : V.hall[0];
  }
  do_deposit(a, V, t, dt) {
    const p = this.hallStand(V);
    if (!p || !this.hallOk(V)) { this.end(a, t); return; }
    const [x, z] = this.xz(p);
    if (!t.phase) { t.phase = 'go'; this.goCell(a, t, p[0], p[1], p[2], 1, 2.5); return; }
    if (!this.act(a, t, dt, ACT_T, x, z)) return;
    if (a.carry?.[60] || a.carry?.[123]) this.say(a, 'iron', 0.5);
    else this.say(a, 'here', 0.2);
    this.unload(a, this.hallBoxes(V), V);
    this.end(a, t);
  }

  // Bâtir un chantier, bloc par bloc
  do_build(a, V, t, dt) {
    const p = t.p;
    if (!V.projects.includes(p)) { this.end(a, t); return; }
    if (!p.paid && !this.pay(V, p)) { this.end(a, t, 5); return; }
    if (t.failed) { t.failed = false; t.force = this.clock + 30; }
    let op = null;
    for (let n = 0; n < 40 && p.i < p.ops.length; n++) {
      const o = p.ops[p.i], cur = this.get(o[0], o[1], o[2]);
      if (cur === o[3] || !(free(cur) || LEAFY.has(cur))) { p.i++; continue; }
      // un lit : le bas seulement si le haut a sa place, le haut seulement sur son bas
      if (o[3] >= POD && o[3] < POD_TOP + 6 && (o[3] >= POD_TOP ? this.get(o[0], o[1], o[2] - 1) !== o[3] - (POD_TOP - POD) : this.get(o[0], o[1], o[2] + 1) !== AIR)) { p.i++; continue; }
      // des feuilles (ou un tronc) à la place : c'est le travail des bûcherons, on le leur
      // laisse un moment (le maçon fait la suite) ; personne pour le faire : il s'en charge
      if ((LEAFY.has(cur) || isLog(cur)) && this.lumberjacks(V) && this.since(o) > this.clock - CLEAR_WAIT) {
        V.clearing.add(o[0] + ',' + o[1] + ',' + o[2]);
        p.ops.splice(p.i, 1);
        p.ops.splice(Math.min(p.ops.length, p.i + 8), 0, o);
        continue;
      }
      op = o;
      break;
    }
    if (p.i >= p.ops.length) {
      this.finish(V, p);
      this.say(a, pickOf(['done', 'look', 'ourhome']), 0.8);
      this.end(a, t);
      return;
    }
    if (!op) return;
    const [x, z] = this.xz(op), d = Math.hypot(x - a.pos.x, z - a.pos.z);
    if (d > BUILD_REACH && !(t.force > this.clock && d < 14)) {
      // (pas de chemin jusque-là : il reviendra plus tard)
      if (t.force > this.clock) { this.end(a, t, 5); return; }
      t.replans = 0;
      this.goCell(a, t, op[0], op[1], undefined, 3, BUILD_REACH);
      return;
    }
    if (!this.act(a, t, dt, BUILD_T, x, z)) return;
    const [q, r, y, id] = op, cur = this.get(q, r, y);
    let who = id !== AIR && this.occupied(q, r, y);
    // quelqu'un a les pieds dans la case d'un plancher (et de la place au-dessus) : on pose le
    // bloc et il se retrouve dessus
    // (pas sur un mur qui monte encore, ni sur un toit : il s'y retrouverait coincé ; il s'écarte)
    if (who && SOLID[id] && who.pos.y < y + 0.6 && !SOLID[this.get(q, r, y + 1)] && !SOLID[this.get(q, r, y + 2)] && this.liftable(p, q, r, y)) {
      for (const b of [...this.animals.list, ...this.players]) if (b.pos && this.occupied(q, r, y) === b) { b.pos.y = y + 1.01; if (b.vel) b.vel.y = Math.max(0, b.vel.y); }
      who = this.occupied(q, r, y);
    }
    if (who) {
      // quelqu'un est dans le passage : ce bloc sera posé plus tard (on ne l'oublie pas : une
      // marche d'escalier ou un pilier manquant gênerait tout le monde)
      p.ops.splice(p.i, 1);
      p.ops.splice(Math.min(p.ops.length, p.i + 8), 0, op); // (un peu plus tard, pas tout à la fin)
      // c'est le maçon lui-même : il s'écarte ; un autre villageois : il lui demande de bouger
      if (who === a) { const [dq, dr] = pickOf(NEIGHBORS); t.replans = 0; this.goCell(a, t, q + 2 * dq, r + 2 * dr, undefined, 1, 0); }
      else if (who.home && this.species[who.type]?.villager && who.task?.kind !== 'away') {
        this.say(a, 'wait', 0.3);
        if (who.task) this.end(who, who.task, 0);
        who.task = { kind: 'away', from: [q, r] };
      }
      return;
    }
    if (isLog(cur)) addCarry(a, cur); // (un arbre sur le chantier : son bois va à la mairie)
    this.set(q, r, y, id);
    p.i++;
  }

  // Peut-on poser ce bloc sous les pieds de quelqu'un (il se retrouve dessus) ? Seulement un
  // plancher : au ras du sol, ou un étage d'immeuble ; pas un mur (un bloc du plan juste
  // au-dessus) ni un toit
  liftable(p, q, r, y) {
    if (!p.rad) return false; // (lampadaire, mur, route : pas un bâtiment, rien à soulever dessus)
    if (p.ops.some((o) => o[0] === q && o[1] === r && o[2] === y + 1 && SOLID[o[3]])) return false;
    if (p.y === undefined || y <= p.y + 1) return true;
    // (étage d'un immeuble : un plafond au-dessus dans le plan)
    return STOREYED.has(p.type) && p.ops.some((o) => o[0] === q && o[1] === r && o[2] > y + 2 && SOLID[o[3]]);
  }

  // Coincé sur un toit (ou en haut d'un mur) : il saute à terre, juste à côté du bâtiment
  unstick(V, a) {
    if (!a.active || a.dead || a.riding || a.seat) return false;
    // (sur la plateforme de lancement, un champ, un véhicule : il n'est pas sur un toit)
    // (un bâtisseur au travail est sur son chantier exprès : les étages d'un immeuble pas encore
    // couvert ne sont pas un toit ; il sera décoincé une fois le chantier fini, s'il le faut)
    if (['vehicle', 'taxiwait', 'traffic', 'airpatrol', 'taxiride', 'build', 'clear', 'home'].includes(a.task?.kind)) return false;
    const me = worldToHex(a.pos.x, a.pos.z), fy = Math.floor(a.pos.y + 0.01);
    // (seulement les bâtiments qui ont un toit : maisons, immeubles, grange, et leurs chantiers)
    const roofs = [...V.houses.map((h) => [h.q, h.r, h.rad]), ...[V.barn, V.school, V.hospital, V.post].filter(Boolean).map((B) => [B.q, B.r, B.rad]),
      ...V.projects.filter((p) => p.rad && HOUSING.has(p.type)).map((p) => [p.q, p.r, p.rad])];
    const foot = roofs.find(([q, r, rad]) => rad >= 2 && hexDist(me.q - q, me.r - r) <= rad);
    if (!foot || !this.loaded(me.q, me.r)) return false;
    // (à l'étage d'un immeuble, il y a un toit au-dessus : il n'est pas coincé)
    for (let y = fy + 2; y < fy + 16; y++) if (SOLID[this.get(me.q, me.r, y)]) return false;
    const taken = this.footprints(V);
    let best = null, bd = Infinity;
    const [fq, fr, rad] = foot, R = rad + 4;
    for (let dq = -R; dq <= R; dq++) for (let dr = -R; dr <= R; dr++) {
      const q = fq + dq, r = fr + dr;
      if (hexDist(dq, dr) > R || taken.some(([tq, tr, tR]) => hexDist(q - tq, r - tr) <= tR)) continue;
      const g = this.groundAt(q, r);
      if (!g || isWater(g.id) || isLava(g.id)) continue;
      const y = g.y + 1;
      if (fy < y + 2) continue; // (pas plus bas que lui de 2 blocs : il n'est pas sur un toit)
      if (SOLID[this.get(q, r, y)] || SOLID[this.get(q, r, y + 1)] || isWater(this.get(q, r, y))) continue;
      const c = hexToWorld(q, r), d = Math.hypot(c.x - a.pos.x, c.z - a.pos.z);
      if (d < bd) { bd = d; best = [c.x, y, c.z]; }
    }
    if (!best) return false;
    a.pos.set(best[0], best[1] + 0.01, best[2]);
    a.vel?.set(0, 0, 0);
    if (a.task) this.end(a, a.task, rnd(0.5, 1.5));
    this.say(a, 'careful', 0.2);
    return true;
  }

  // Cadeau d'un joueur à un villageois : il va dans les coffres de la mairie (ce qui n'y entre
  // pas est perdu) ; renvoie les villageois de son village (ils l'apprennent tous)
  receive(a, id, n) {
    const V = a.vk ? this.villages.get(a.vk) : null;
    if (!V) return [];
    for (const b of this.hallBoxes(V)) { if (!n) break; n = this.put(b, id, n); }
    return V.members;
  }

  // ---------- Gardes ----------
  // Un zombie près du village (le plus proche de ce garde), ou null
  zombieNear(V, a) {
    let best = null, bd = GUARD_R;
    const far = (V.wallR ? V.wallR * 0.866 : 20) + GUARD_R * 0.5;
    for (const z of this.animals.list) {
      if (z.dead || !z.active || !this.species[z.type]?.hostile) continue;
      if (Math.hypot(z.pos.x - V.x, z.pos.z - V.z) > far) continue;
      const d = Math.hypot(z.pos.x - a.pos.x, z.pos.z - a.pos.z);
      if (d < bd) { bd = d; best = z; }
    }
    return best;
  }
  guardTask(a, V) {
    // un garde (un seul) part en patrouille aérienne s'il y a un véhicule libre à la plateforme
    const air = this.airTask(a, V);
    if (air) return air;
    const z = this.zombieNear(V, a);
    if (z) { this.say(a, pickOf(['zombie', 'defend', 'careful']), 0.7); return { kind: 'fight', z }; }
    // ronde : un point au hasard dans le village (le long du mur, s'il y en a un)
    const R = V.wallR ? (V.wallR - 3) * 0.866 : 14, ang = Math.random() * Math.PI * 2, d = rnd(R * 0.5, R);
    const c = worldToHex(V.x + Math.cos(ang) * d, V.z + Math.sin(ang) * d);
    return { kind: 'patrol', q: c.q, r: c.r };
  }
  airTask(a, V) {
    if (!V.pad || !this.structs || !this.loaded(V.pad.q, V.pad.r) || V.members.some((b) => b.task?.kind === 'airpatrol')) return null;
    const pc = hexToWorld(V.pad.q, V.pad.r);
    const s = this.structs.list.find((x) => Math.hypot(x.pos.x - pc.x, x.pos.z - pc.z) < PAD_R + 6 && Math.abs(x.pos.y - V.pad.y) < 12 && this.controls(x)
      && !this.animals.list.some((b) => b.seat?.s === x) && !(this.players || []).some((p) => p.standingOn === x || p.attached === x));
    return s ? { kind: 'airpatrol', s } : null;
  }
  // Le garde monte dans le véhicule, fait des ronds au-dessus du village toute la nuit (un
  // parcours en boucle du gravitron) et tire sur les zombies ; au jour, il le ramène à sa place
  do_airpatrol(a, V, t, dt) {
    const S = this.structs, s = t.s;
    if (!S || !S.list.includes(s) || !V.pad) { if (a.seat) this.unseat(a, V); this.end(a, t); return; }
    const c = this.controls(s);
    if (!c) { if (a.seat) this.unseat(a, V); this.end(a, t); return; }
    if (!t.phase) { t.phase = 'go'; const h = worldToHex(s.pos.x, s.pos.z); this.goCell(a, t, h.q, h.r, undefined, 2, 4); return; }
    if (t.phase === 'go') {
      if (!this.seatOn(a, s, c.grav)) { this.end(a, t, 5); return; }
      t.home = [Math.round(s.pos.x), Math.round(s.pos.y), Math.round(s.pos.z)];
      // la ronde : 6 points autour du puits, au-dessus des toits
      // (parcours du gravitron : [x0, y0, z0, mode avion, en boucle, arrêt0, x1, y1, z1, arrêt1, ...])
      const R = Math.max(14, (V.wallR ? V.wallR * 0.866 : 24) - 4), y = V.pad.y + AIR_H, pts = [];
      for (let i = 0; i < 6; i++) { const ang = (i / 6) * Math.PI * 2; pts.push([Math.round(V.x + Math.cos(ang) * R), y, Math.round(V.z + Math.sin(ang) * R)]); }
      this.fly(s, c, [...pts[0], 1, 1, 0, ...pts.slice(1).flatMap((p) => [...p, 0])]);
      t.phase = 'air'; t.t = 0; t.cd = 0;
      this.say(a, 'defend', 0.8);
      return;
    }
    a.state = 'idle';
    t.t += dt;
    if (t.phase === 'air') {
      // il tire sur les zombies en dessous (le plus proche, à portée)
      if ((t.cd -= dt) <= 0) {
        t.cd = AIR_EVERY;
        let best = null, bd = AIR_SHOT;
        for (const z of this.animals.list) {
          if (z.dead || !z.active || !this.species[z.type]?.hostile) continue;
          const d = Math.hypot(z.pos.x - a.pos.x, z.pos.z - a.pos.z) + Math.max(0, a.pos.y - z.pos.y - AIR_H - 6);
          if (d < bd) { bd = d; best = z; }
        }
        if (best) {
          this.face(a, best.pos.x, best.pos.z);
          a.work = 0.5;
          this.animals.hit(best, GUARD_HIT, a.pos.x, a.pos.z);
          if (best.dead) this.onEvent?.('guard', best.pos.x, best.pos.z);
          else this.say(a, 'zombie', 0.15);
        }
      }
      // le jour se lève : retour à la plateforme
      if (this.workTime()) { this.fly(s, c, [...t.home, 1]); t.phase = 'back'; t.t = 0; }
    } else if ((Math.hypot(s.pos.x - t.home[0], s.pos.z - t.home[2]) < 2.5 && Math.abs(s.pos.y - t.home[1]) < 4) || t.t > 240) {
      this.unseat(a, V);
      this.end(a, t, rnd(2, 5));
    }
  }
  do_patrol(a, V, t, dt) {
    if (!t.phase) { t.phase = 'go'; t.wait = rnd(3, 8); this.goCell(a, t, t.q, t.r, undefined, 2, 4); return; }
    // arrivé : il regarde autour de lui un moment
    a.state = 'idle';
    if (Math.random() < dt * 0.8) a.headTarget = (Math.random() - 0.5) * 1.6;
    if ((t.wait -= dt) <= 0) this.end(a, t, rnd(0.3, 1));
  }
  // Combat : il court droit sur le zombie (tout près : sans chercher de chemin), le frappe
  do_fight(a, V, t, dt) {
    const z = t.z;
    if (!z || z.dead || !z.active || this.workTime()) { if (z?.dead) this.say(a, pickOf(['done', 'fine']), 0.7); this.end(a, t, 0.5); return; }
    const d = Math.hypot(z.pos.x - a.pos.x, z.pos.z - a.pos.z);
    if (d > GUARD_R * 1.5) { this.end(a, t); return; }
    if (d > 1.6 || Math.abs(z.pos.y - a.pos.y) > 1.5) {
      if (d > 10) {
        // loin : par le plus court chemin (repris quand il arrive)
        t.replans = 0;
        const c = worldToHex(z.pos.x, z.pos.z);
        this.goCell(a, t, c.q, c.r, Math.floor(z.pos.y), 2, 8);
        return;
      }
      a.state = 'walk';
      a.pace = 2.2;
      a.timer = 999;
      a.target = { x: z.pos.x, z: z.pos.z };
      return;
    }
    a.state = 'idle';
    a.target = null;
    this.face(a, z.pos.x, z.pos.z);
    a.work = 0.3;
    if ((t.cd = (t.cd || 0) - dt) > 0) return;
    t.cd = GUARD_EVERY;
    this.animals.hit(z, GUARD_HIT, a.pos.x, a.pos.z);
    if (z.dead) this.onEvent?.('guard', z.pos.x, z.pos.z); // (succès : un joueur a vu ça ?)
  }

  // ---------- Mur d'enceinte ----------
  // Rayon de l'anneau (en cases) : la zone bâtie, plus une marge
  wallRadius(V) { return Math.ceil((this.reach(V) + WALL_MARGIN) / 0.866); }
  // Case j (0 .. R-1) du côté s de l'anneau de rayon R
  ringCell(V, R, s, j) {
    const [a, b] = DIRS6[s], [c, d] = DIRS6[(s + 2) % 6];
    return [V.q + a * R + c * j, V.r + b * R + d * j];
  }
  // Tronçon suivant à bâtir (côté x 100 + rang), ou null : tout l'anneau est fait ou en chantier
  nextWall(V) {
    const R = V.wallR, n = Math.ceil(R / WALL_SEG);
    for (let s = 0; s < 6; s++) {
      for (let k = 0; k < n; k++) {
        const seg = s * 100 + k;
        if (!V.wallDone.includes(seg) && !V.projects.some((p) => p.type === 'wall' && p.seg === seg && p.R === R)) return seg;
      }
    }
    return null;
  }
  wallComplete(V) { return !!V.wallR && this.nextWall(V) === null && !V.projects.some((p) => p.type === 'wall'); }
  wallOps(V, R, seg) {
    const s = Math.floor(seg / 100), k = seg % 100, mid = Math.floor(R / 2);
    const street = this.streetPlan(V, 1), taken = this.footprints(V);
    const ops = [], top = [];
    for (let j = k * WALL_SEG; j < Math.min(R, (k + 1) * WALL_SEG); j++) {
      const [q, r] = this.ringCell(V, R, s, j);
      // portes : au milieu du côté, sur les routes (faites ou prévues), et pas à travers une maison
      if (Math.abs(j - mid) <= 1 || V.roadSet.has(ck(q, r)) || street.has(ck(q, r))) continue;
      if (taken.some(([tq, tr, tR]) => hexDist(q - tq, r - tr) <= tR)) continue;
      const g = this.groundAt(q, r);
      if (!g || isWater(g.id) || isLava(g.id) || !SOLID[g.id] || !GROUND.has(g.id) && !STONY.has(g.id)) continue;
      for (let y = g.y + 1; y <= g.y + WALL_H; y++) ops.push([q, r, y, 28]);
      if (j % 6 === 3) top.push([q, r, g.y + WALL_H + 1, TORCH]);
    }
    return [...ops, ...top];
  }
  // L'ancien mur (un plus grand est fini) : démonté, sa pierre revient à la mairie
  dropOldWall(V) {
    const R = V.oldWallR;
    V.oldWallR = null;
    if (!R) return;
    let stone = 0;
    for (let s = 0; s < 6; s++) {
      for (let j = 0; j < R; j++) {
        const [q, r] = this.ringCell(V, R, s, j);
        if (!this.loaded(q, r)) continue;
        let y = this.world.surface(q, r).h;
        if (this.get(q, r, y + 1) === TORCH) this.set(q, r, y + 1, AIR);
        for (let n = 0; n < WALL_H && this.get(q, r, y) === 28; n++, y--) { this.set(q, r, y, AIR); stone++; }
      }
    }
    for (const b of this.hallBoxes(V)) { if (!stone) break; stone = this.put(b, 28, stone); }
  }

  // ---------- Boutiques ----------
  // Boulanger, boucher : au comptoir de leur boutique ; le boulanger y fait du pain avec le blé
  // de la mairie (3 blés : un pain, et de quoi nourrir le village)
  bakery(V) { return V.houses.find((h) => h.shop === 'bakery') || null; }
  // Fermier : sa récolte va au garde-manger de la boulangerie
  do_deliver(a, V, t, dt) {
    const B = this.bakery(V);
    if (!B) { this.end(a, t); return; }
    const [cq, cr] = shopLayout(B.door).counter;
    if (!t.phase) { t.phase = 'go'; this.goCell(a, t, B.q + cq, B.r + cr, B.y + 1, 1, 2.5); return; }
    if (!this.act(a, t, dt, ACT_T, ...this.xz([B.q + cq, B.r + cr]))) return;
    const P = V.pantry;
    P.wheat += a.carry[WHEAT] || 0;
    P.potato += a.carry[POTATO] || 0;
    delete a.carry[WHEAT];
    delete a.carry[POTATO];
    // (garde-manger plein : le surplus va à la mairie)
    const over = (k, id) => { if (P[k] > PANTRY_MAX && this.hallOk(V)) { addCarry(a, id, P[k] - PANTRY_MAX); P[k] = PANTRY_MAX; } };
    over('wheat', WHEAT); over('potato', POTATO);
    this.say(a, 'here', 0.4);
    const baker = V.members.find((b) => b.job === 'baker' && b.active);
    if (baker) this.animals.talk.later(baker, 'thanks', 0.8);
    this.end(a, t, rnd(1, 3));
  }
  do_shopwork(a, V, t, dt) {
    const h = t.h;
    if (!V.houses.includes(h)) { this.end(a, t); return; }
    const [cq, cr] = shopLayout(h.door).counter, q = h.q + cq, r = h.r + cr;
    if (!t.phase) { t.phase = 'go'; t.time = rnd(20, 40); this.goCell(a, t, q, r, h.y + 1, 1, 2.5); return; }
    this.act(a, t, dt, 1, ...this.xz([q, r]));
    if ((t.time -= dt) > 0) return;
    if (h.shop === 'bakery') {
      // du pain (3 blés) et des pommes de terre cuites, par fournées de 4, pour nourrir le village
      const P = V.pantry;
      if (P.wheat < 3 && this.hallOk(V) && this.count(this.hallBoxes(V), [WHEAT]) >= 3) { this.take(this.hallBoxes(V), [WHEAT], 3); P.wheat += 3; }
      let made = 0;
      for (let n = 0; n < 4 && P.wheat >= 3 && P.bread < PANTRY_MAX; n++) { P.wheat -= 3; P.bread++; made++; }
      for (let n = 0; n < 4 && P.potato >= 1 && P.baked < PANTRY_MAX; n++) { P.potato--; P.baked++; made++; }
      if (made) { V.food += made; this.say(a, 'here', 0.4); }
      // (le village mange ce qui est cuit : le garde-manger ne déborde pas, le boulanger continue)
      P.bread = Math.min(P.bread, 24); P.baked = Math.min(P.baked, 24);
    }
    this.say(a, 'done', 0.15);
    this.end(a, t, rnd(5, 15));
  }

  // ---------- Forestier ----------
  // Un forestier dans ce village ? Dès BARN_AFTER maisons (sans grange encore : il range ses
  // pousses à la mairie)
  wantsForester(V) { return !!V.barn || this.homes(V).length >= BARN_AFTER; }
  // Ranger ce qu'il porte : à la grange, sinon à la mairie
  stashTask(V) { return V.barn ? { kind: 'stash' } : this.hallOk(V) ? { kind: 'deposit' } : null; }
  // La pousse sauvage la plus proche (repérée par scan), sinon ranger ce qu'il porte
  foresterTask(a, V) {
    if (carried(a) >= 8) return this.stashTask(V);
    V.wild = (V.wild || []).filter(([q, r, y]) => (!this.loaded(q, r) || WILD_SAPLINGS.has(this.get(q, r, y))) && this.wildSapling(V, q, r, y));
    let best = null, bd = Infinity;
    for (const w of V.wild) {
      const c = hexToWorld(w[0], w[1]), d = Math.hypot(c.x - a.pos.x, c.z - a.pos.z);
      if (d < bd && !V.members.some((b) => b !== a && b.task?.kind === 'uproot' && b.task.p === w)) { bd = d; best = w; }
    }
    if (best) return { kind: 'uproot', p: best };
    return carried(a) ? this.stashTask(V) : null;
  }
  do_uproot(a, V, t, dt) {
    const [q, r, y] = t.p;
    if (!t.phase) { t.phase = 'go'; this.goCell(a, t, q, r, y, 1, 2.5); return; }
    if (!this.act(a, t, dt, ACT_T, ...this.xz([q, r]))) return;
    const id = this.get(q, r, y);
    if (WILD_SAPLINGS.has(id)) {
      this.set(q, r, y, AIR);
      addCarry(a, BLOCKS[id].pick ?? id, 1);
      this.say(a, 'plant', 0.1);
    }
    V.wild = V.wild.filter((w) => w !== t.p);
    this.end(a, t, rnd(0.5, 2));
  }
  // Feuilles d'arbres trop près des bâtiments : repérées de temps en temps (V.leaves)
  scanLeaves(V) {
    if (this.clock < (V.leafT || 0)) return;
    V.leafT = this.clock + LEAF_SCAN;
    const out = [], seen = new Set();
    const builds = [...V.houses, ...(V.barn ? [V.barn] : [])];
    for (const h of builds) {
      if (!this.loaded(h.q, h.r)) continue;
      const R = (h.rad || 2) + LEAF_MARGIN;
      for (let dq = -R; dq <= R && out.length < LEAF_KEEP; dq++) {
        for (let dr = -R; dr <= R && out.length < LEAF_KEEP; dr++) {
          if (hexDist(dq, dr) > R) continue;
          const q = h.q + dq, r = h.r + dr;
          for (let y = h.y; y <= h.y + LEAF_H; y++) {
            if (!isNaturalLeaves(this.get(q, r, y))) continue;
            const k = q + ',' + r + ',' + y;
            if (!seen.has(k)) { seen.add(k); out.push([q, r, y]); }
          }
        }
      }
    }
    // (avec une pépinière : toutes les feuilles du village hors de la pépinière)
    for (const p of V.junkLeaves || []) if (out.length < LEAF_KEEP * 2 && !seen.has(p.join(','))) { seen.add(p.join(',')); out.push(p); }
    V.leaves = out;
  }
  leaferTask(a, V) {
    if (carried(a) >= 8) return this.stashTask(V);
    this.scanLeaves(V);
    V.leaves = (V.leaves || []).filter(([q, r, y]) => this.loaded(q, r) && isNaturalLeaves(this.get(q, r, y)));
    let best = null, bd = Infinity;
    for (const p of V.leaves) {
      if (V.members.some((b) => b !== a && b.task?.kind === 'leaf' && b.task.p === p)) continue;
      const c = hexToWorld(p[0], p[1]), d = Math.hypot(c.x - a.pos.x, c.z - a.pos.z);
      if (d < bd) { bd = d; best = p; }
    }
    if (best) return { kind: 'leaf', p: best };
    return carried(a) ? this.stashTask(V) : null;
  }
  // Il retire la feuille visée et celles qui la touchent (au plus 6 d'un coup) ; parfois une pousse
  do_leaf(a, V, t, dt) {
    const [q, r, y] = t.p;
    if (!t.phase) { t.phase = 'go'; this.goCell(a, t, q, r, undefined, 2, BUILD_REACH); return; }
    if (!this.act(a, t, dt, ACT_T, ...this.xz([q, r]))) return;
    const todo = [[q, r, y]], done = new Set();
    let n = 0;
    while (todo.length && n < 6) {
      const [cq, cr, cy] = todo.shift(), k = cq + ',' + cr + ',' + cy;
      if (done.has(k) || !isNaturalLeaves(this.get(cq, cr, cy))) continue;
      done.add(k);
      this.set(cq, cr, cy, AIR);
      n++;
      if (Math.random() < 0.05) addCarry(a, SAPLING, 1);
      for (const [dq, dr] of NEIGHBORS) todo.push([cq + dq, cr + dr, cy]);
      todo.push([cq, cr, cy + 1], [cq, cr, cy - 1]);
    }
    if (n) this.say(a, 'working', 0.1);
    V.leaves = (V.leaves || []).filter((p) => p !== t.p);
    this.end(a, t, rnd(0.5, 1.5));
  }
  // Réserve voulue à la mairie : la réserve habituelle, ou ce qu'attend le plus gros chantier
  // pas encore payé (un grand immeuble), un peu plus
  keep(V, kind, base) {
    let need = 0;
    for (const p of V.projects) if (!p.paid && p.cost) need = Math.max(need, p.cost[kind] || 0);
    return Math.max(base, need + 32);
  }

  // ---------- École ----------
  do_teach(a, V, t, dt) {
    const S = V.school;
    if (!S) { this.end(a, t); return; }
    const [bq, br] = midCell(SCHOOL_R - 3, (S.door + 3) % 6);
    if (!t.phase) { t.phase = 'go'; t.time = rnd(40, 80); this.goCell(a, t, S.q + bq, S.r + br, S.y + 1, 0, 2); return; }
    a.state = 'idle';
    this.face(a, ...this.xz([S.q, S.r]));
    if (Math.random() < dt * 0.15) { this.say(a, pickOf(['listen', 'look', 'working'])); a.work = 0.6; }
    if ((t.time -= dt) <= 0) this.end(a, t, rnd(1, 3));
  }
  do_school(a, V, t, dt) {
    const S = V.school;
    if (!S) { this.end(a, t); return; }
    if (!t.phase) {
      t.phase = 'go'; t.time = rnd(60, 120);
      // sa place : la première libre
      const seats = schoolSeats(S), used = new Set(V.members.filter((b) => b !== a && b.task?.kind === 'school' && b.task.seat).map((b) => ck(...b.task.seat)));
      t.seat = seats.find((p) => !used.has(ck(p[0], p[1]))) || pickOf(seats);
      this.goCell(a, t, ...t.seat, 0, 2.5);
      return;
    }
    a.state = 'idle';
    const [bq, br] = midCell(SCHOOL_R - 1, (S.door + 3) % 6);
    this.face(a, ...this.xz([S.q + bq, S.r + br])); // (vers le tableau)
    if (Math.random() < dt * 0.03) this.say(a, pickOf(['look', 'fine', 'hi']));
    if ((t.time -= dt) <= 0) this.end(a, t, rnd(1, 4));
  }

  // ---------- Hôpital ----------
  // Lits de l'hôpital (et de la poste) : les lits posés dans le bâtiment
  bedsIn(B) {
    const out = [];
    if (!B || !this.loaded(B.q, B.r)) return out;
    for (let a = -B.rad; a <= B.rad; a++) for (let b = -B.rad; b <= B.rad; b++) {
      if (hexDist(a, b) >= B.rad) continue;
      const id = this.get(B.q + a, B.r + b, B.y + 1);
      if (BLOCKS[id]?.pod !== undefined && !BLOCKS[id].podTop) out.push([B.q + a, B.r + b, B.y + 1]);
    }
    return out;
  }
  hospitalBed(V, a) {
    const used = new Set(V.members.filter((b) => b !== a && b.task?.kind === 'heal' && b.task.bed).map((b) => ck(...b.task.bed)));
    return this.bedsIn(V.hospital).find((p) => !used.has(ck(p[0], p[1]))) || null;
  }
  do_heal(a, V, t, dt) {
    const max = this.species[a.type]?.health || 20;
    if (!V.hospital) { this.end(a, t); return; }
    if (!t.phase) {
      t.phase = 'go';
      t.bed = this.hospitalBed(V, a);
      if (!t.bed) { this.end(a, t); return; }
      this.say(a, 'help', 0.5);
      this.goCell(a, t, ...t.bed, 0, 2.5);
      return;
    }
    a.state = 'idle';
    const doc = V.members.some((b) => b.job === 'doctor' && b.task?.kind === 'doctor' && b.task.phase === 'care');
    if ((t.clock = (t.clock ?? 0) + dt) >= (doc ? HEAL_T : HEAL_SLOW)) { t.clock = 0; a.hp = Math.min(max, a.hp + 1); }
    if (a.hp >= max) { this.say(a, 'thanks', 0.8); this.end(a, t, rnd(1, 3)); }
  }
  do_doctor(a, V, t, dt) {
    const B = V.hospital;
    if (!B) { this.end(a, t); return; }
    if (!t.phase) { t.phase = 'go'; t.time = rnd(40, 90); this.goCell(a, t, B.q, B.r, B.y + 1, 1, 2.5); return; }
    t.phase = 'care';
    a.state = 'idle';
    // il passe de patient en patient
    const p = V.members.find((b) => b.task?.kind === 'heal' && b.task.phase && Math.hypot(b.pos.x - a.pos.x, b.pos.z - a.pos.z) < B.rad * 1.5);
    if (p) { this.face(a, p.pos.x, p.pos.z); if (Math.random() < dt) a.work = 0.4; if (Math.random() < dt * 0.05) this.say(a, 'fine'); }
    if ((t.time -= dt) <= 0) this.end(a, t, rnd(1, 3));
  }

  // ---------- Poste ----------
  // Son lit à la poste (le n-ième livreur, le n-ième lit), ou null
  postBed(V, a) {
    if (!V.post) return null;
    const beds = this.bedsIn(V.post), couriers = V.members.filter((b) => b.job === 'courier');
    return beds[couriers.indexOf(a)] || null;
  }
  mineBoxes(V) {
    const M = V.mine;
    if (!M?.chests) return [];
    return M.chests.map((p) => (this.loaded(p[0], p[1]) && BLOCKS[this.get(...p)]?.container === 'chest' ? this.box(p) : null)).filter(Boolean);
  }
  // Où va le livreur : { from, to, ids (null : tout), n } ; un lieu : 'hall', 'mine', 'barn',
  // 'bakery', ou une maison d'artisan (sa clé)
  courierTask(a, V) {
    if (carried(a)) return this.hallOk(V) ? { kind: 'deposit' } : null;
    if (!this.hallOk(V)) return null;
    const hall = this.hallBoxes(V), busy = (from, to) => V.members.some((b) => b !== a && b.task?.kind === 'courier' && b.task.from === from && b.task.to === to);
    const go = (from, to, ids, n) => (busy(from, to) ? null : { kind: 'courier', from, to, ids, n });
    const any = (boxes) => boxes.some((b) => b.slots.some(Boolean));
    // la mine -> la mairie (la pierre et les minerais des mineurs)
    if (any(this.mineBoxes(V))) { const t = go('mine', 'hall', null, 64); if (t) return t; }
    // le blé et les pommes de terre -> la boulangerie
    if (this.bakery(V) && this.count(hall, [WHEAT, POTATO]) >= 6) { const t = go('hall', 'bakery', [WHEAT, POTATO], 32); if (t) return t; }
    // un chantier attend du bois ou de la pierre (pour les maçons) : la grange -> la mairie
    if (V.barn) {
      const barn = this.barnBoxes(V), want = V.projects.find((p) => !p.paid && (this.missing(V, p).wood || this.missing(V, p).stone));
      if (want) {
        const m = this.missing(V, want), ids = m.wood ? WOOD : STONE;
        if (this.count(barn, ids)) { const t = go('barn', 'hall', ids, 64); if (t) return t; }
      }
      // trop de bois à la mairie -> la grange
      if (this.count(hall, WOOD) > this.keep(V, 'wood', WOOD_KEEP)) { const t = go('hall', 'barn', WOOD, 64); if (t) return t; }
    }
    // les minerais -> les artisans (le coffre de leur maison)
    if (this.count(hall, ORES) >= 8) {
      const art = V.members.find((b) => JOBS[b.job]?.artisan && this.houseOf(V, b) && this.loaded(this.houseOf(V, b).q, this.houseOf(V, b).r) && this.hasChest(this.houseOf(V, b)));
      if (art) { const t = go('hall', art.house, ORES, 16); if (t) return t; }
    }
    return null;
  }
  // Lieu d'un trajet : [q, r, y] où se tenir, et ses coffres
  placeOf(V, w) {
    if (w === 'hall') return { at: this.hallStand(V), boxes: () => this.hallBoxes(V) };
    if (w === 'mine') return V.mine?.chests?.length ? { at: V.mine.chests[0], boxes: () => this.mineBoxes(V) } : null;
    if (w === 'barn') return V.barn ? { at: [V.barn.q, V.barn.r, V.barn.y + 1], boxes: () => this.barnBoxes(V) } : null;
    if (w === 'bakery') { const B = this.bakery(V); if (!B) return null; const [cq, cr] = shopLayout(B.door).counter; return { at: [B.q + cq, B.r + cr, B.y + 1], pantry: true }; }
    const h = V.houses.find((x) => ck(x.q, x.r) === w);
    return h ? { at: this.chestAt(h), boxes: () => [this.box(this.chestAt(h))].filter(Boolean) } : null;
  }
  do_courier(a, V, t, dt) {
    const from = this.placeOf(V, t.from), to = this.placeOf(V, t.to);
    if (!from || !to) { this.end(a, t); return; }
    if (!t.phase) { t.phase = 'go1'; this.goCell(a, t, ...from.at, 2, 3.5); return; }
    if (t.phase === 'go1') {
      if (!this.act(a, t, dt, ACT_T, ...this.xz(from.at))) return;
      // il prend (au plus t.n objets)
      let n = t.n;
      for (const b of from.boxes()) for (let i = 0; i < b.slots.length && n > 0; i++) {
        const s = b.slots[i];
        if (!s || (t.ids && !t.ids.includes(s.id))) continue;
        const k = Math.min(n, s.n);
        addCarry(a, s.id, k); s.n -= k; n -= k;
        if (!s.n) b.slots[i] = null;
      }
      this.world.changed = true;
      if (n === t.n) { this.end(a, t, rnd(2, 5)); return; }
      this.say(a, 'here', 0.3);
      t.phase = 'go2'; t.clock = undefined;
      this.goCell(a, t, ...to.at, 2, 3.5);
      return;
    }
    if (!this.act(a, t, dt, ACT_T, ...this.xz(to.at))) return;
    if (to.pantry) {
      // (à la boulangerie : dans le garde-manger)
      V.pantry.wheat += a.carry[WHEAT] || 0; V.pantry.potato += a.carry[POTATO] || 0;
      delete a.carry[WHEAT]; delete a.carry[POTATO];
    } else {
      for (const k of Object.keys(a.carry || {})) {
        let n = a.carry[k];
        for (const b of to.boxes()) if (n) n = this.put(b, +k, n);
        if (n) a.carry[k] = n; else delete a.carry[k];
      }
    }
    this.say(a, 'done', 0.3);
    this.end(a, t, rnd(1, 3)); // (ce qui n'est pas rentré : à la mairie, voir courierTask)
  }

  // ---------- Circulation ----------
  // Où se poster : le policier, aux carrefours (les routes qui se croisent, près du centre) ; le
  // gendarme, à la plateforme quand un véhicule arrive ou part, sinon aux entrées du village (les
  // routes au mur d'enceinte, ou les plus loin du puits)
  trafficTask(a, V) {
    const taken = new Set(V.members.filter((b) => b !== a && b.task?.kind === 'traffic').map((b) => ck(...b.task.post)));
    if (a.job === 'gendarme' && V.pad && this.padBusy(V) && !taken.has(ck(V.pad.q, V.pad.r))) return { kind: 'traffic', post: [V.pad.q, V.pad.r], pad: true };
    const cells = [];
    for (const k of V.roadSet) {
      if (taken.has(k)) continue;
      const [q, r] = k.split(',').map(Number);
      if (!this.loaded(q, r)) continue;
      const deg = NEIGHBORS.filter(([x, y]) => V.roadSet.has(ck(q + x, r + y))).length, d = hexDist(q - V.q, r - V.r);
      if (a.job === 'police') { if (deg >= 3) cells.push([q, r, deg * 10 - d]); } else cells.push([q, r, V.wallR ? -Math.abs(d - V.wallR) * 4 + deg : d]);
    }
    if (!cells.length) return a.job === 'gendarme' && V.pad ? { kind: 'traffic', post: [V.pad.q, V.pad.r], pad: true } : null;
    cells.sort((x, y) => y[2] - x[2]);
    const [q, r] = pickOf(cells.slice(0, 3));
    return { kind: 'traffic', post: [q, r] };
  }
  // Un véhicule bouge au-dessus de la plateforme (il arrive ou décolle)
  padBusy(V) {
    const c = hexToWorld(V.pad.q, V.pad.r);
    return (this.structs?.list || []).some((s) => s.vel && s.vel.lengthSq() > 1 && Math.hypot(s.pos.x - c.x, s.pos.z - c.z) < 16 && s.pos.y > V.pad.y + 1.5 && s.pos.y < V.pad.y + 40);
  }
  do_traffic(a, V, t, dt) {
    if (!t.phase) { t.phase = 'go'; t.time = rnd(45, 90); t.scan = 0; this.goCell(a, t, t.post[0], t.post[1], undefined, t.pad ? 2 : 0, 2.5); return; }
    a.state = 'idle';
    if ((t.time -= dt) <= 0) { this.end(a, t, rnd(1, 3)); return; }
    if ((t.scan -= dt) > 0) return;
    t.scan = 0.25;
    const c = hexToWorld(t.post[0], t.post[1]);
    // la plateforme : on la dégage pour le véhicule qui arrive (sauf ceux qui y travaillent)
    if (t.pad) {
      if (!this.padBusy(V)) { if ((t.calm = (t.calm || 0) + 0.25) > 20) { this.end(a, t, 1); return; } } else t.calm = 0;
      if (t.calm === 0) {
        for (const b of V.members) {
          if (b === a || !b.active || b.dead || b.riding || b.seat || ['vehicle', 'taxiwait', 'away'].includes(b.task?.kind)) continue;
          if (Math.hypot(b.pos.x - c.x, b.pos.z - c.z) > PAD_R + 0.5 || Math.abs(b.pos.y - V.pad.y - 1) > 2) continue;
          if (b.task) this.end(b, b.task, 0);
          b.task = { kind: 'away', from: [t.post[0], t.post[1]] };
          this.face(a, b.pos.x, b.pos.z);
          a.work = 0.6;
          if (!(a.saidT > this.clock)) { this.say(a, 'clearpad'); a.saidT = this.clock + 5; }
        }
      }
    }
    // les passants : un seul à la fois au carrefour (le plus près passe, les autres attendent)
    const walkers = V.members.filter((b) => b !== a && b.active && !b.dead && b.state === 'walk' && b.task?.goal && Math.hypot(b.pos.x - c.x, b.pos.z - c.z) < TRAFFIC_R && Math.abs(b.pos.y - a.pos.y) < 2.5);
    if (walkers.length) {
      walkers.sort((x, y) => Math.hypot(x.pos.x - c.x, x.pos.z - c.z) - Math.hypot(y.pos.x - c.x, y.pos.z - c.z));
      const pass = walkers.includes(t.pass) ? t.pass : walkers[0];
      t.pass = pass;
      let stopped = null;
      for (const b of walkers) if (b !== pass && !(b.holdCool > 0)) { b.hold = HOLD_T; b.holdCool = HOLD_COOL; stopped = b; }
      // (il fait signe : bras levé vers celui qu'il arrête, puis vers celui qui passe)
      const who = stopped || pass;
      this.face(a, who.pos.x, who.pos.z);
      a.work = 0.5;
      if (!(a.saidT > this.clock)) { this.say(a, stopped ? 'stop' : pickOf(['pass', 'move'])); a.saidT = this.clock + rnd(4, 8); }
    } else t.pass = null;
    // un joueur qui fonce (véhicule, sprint) tout près : « Ralentissez ! »
    this.seen ||= new WeakMap();
    for (const p of this.players || []) {
      const last = this.seen.get(p), now = this.clock;
      this.seen.set(p, { x: p.pos.x, z: p.pos.z, t: now });
      if (!last || now - last.t > 1 || now - last.t <= 0) continue;
      const v = Math.hypot(p.pos.x - last.x, p.pos.z - last.z) / (now - last.t);
      if (v > FAST && Math.hypot(p.pos.x - a.pos.x, p.pos.z - a.pos.z) < 12 && Math.abs(p.pos.y - a.pos.y) < 4 && !(a.slowT > this.clock)) {
        this.face(a, p.pos.x, p.pos.z);
        a.work = 0.8;
        this.say(a, 'slow');
        a.slowT = this.clock + 8;
      }
    }
  }

  // ---------- Course de taxi ----------
  // Le chauffeur monte dans le véhicule (k : son gravitron) et part vers dest [x, y, z] ; arrivé,
  // il attend que le passager descende, puis ramène le véhicule à sa place sur la plateforme
  // Asseoir a sur le véhicule s : le dessus d'un bloc libre (ni sous un joueur, ni à la place
  // d'un autre assis), le plus près de la case k (le gravitron) ; faux s'il n'y a plus de place
  seatOn(a, s, k = null) {
    const V3 = a.pos.constructor, [gq, gr, gy] = k ? k.split(',').map(Number) : [0, 0, 0];
    const taken = [...(this.players || []).filter((p) => p.standingOn === s || p.attached === s).map((p) => this.structs.toLocal(s, p.pos, new V3())),
      ...this.animals.list.filter((b) => b !== a && b.seat?.s === s).map((b) => b.seat.L)];
    let best = null, bd = Infinity;
    for (const key of s.blocks.keys()) {
      const [q, r, y] = key.split(',').map(Number);
      if (s.blocks.has(q + ',' + r + ',' + (y + 1)) || s.blocks.has(q + ',' + r + ',' + (y + 2))) continue;
      const c = hexToWorld(q, r);
      if (taken.some((L) => Math.hypot(L.x - c.x, L.z - c.z) < 0.8 && Math.abs(L.y - y - 1) < 1.5)) continue;
      const d = hexDist(q - gq, r - gr) + Math.abs(y - gy);
      if (d < bd) { bd = d; best = [c.x, y + 1, c.z]; }
    }
    if (!best) return false;
    a.seat = { s, L: new V3(...best) };
    a.state = 'idle';
    a.target = null;
    return true;
  }
  // Le gravitron et le levier d'un véhicule : { grav, lever } (clés), ou null
  controls(s) {
    let grav = null, lever = null;
    for (const [k, id] of s.blocks) { if (id === GRAVITRON) grav = k; else if (id === LEVER || id === LEVER_ON) lever = k; }
    return grav && lever ? { grav, lever } : null;
  }
  // Lancer le véhicule : levier levé, réglages du gravitron (une destination ou un parcours)
  fly(s, c, params) {
    this.structs.setParams(s, c.grav, params);
    if (s.blocks.get(c.lever) !== LEVER_ON) { s.blocks.set(c.lever, LEVER_ON); this.structs.afterEdit(s); }
  }
  // Descendre d'un véhicule là où il est (posé) : la case libre la plus proche au sol
  dropOff(b, s) {
    b.seat = null;
    const h = worldToHex(s.pos.x, s.pos.z);
    for (let R = 1; R <= 5; R++) {
      for (let dq = -R; dq <= R; dq++) for (let dr = -R; dr <= R; dr++) {
        if (hexDist(dq, dr) !== R || !this.loaded(h.q + dq, h.r + dr)) continue;
        const g = this.groundAt(h.q + dq, h.r + dr);
        if (!g || isWater(g.id) || isLava(g.id) || Math.abs(g.y - s.pos.y) > 8 || SOLID[this.get(h.q + dq, h.r + dr, g.y + 2)]) continue;
        const c = hexToWorld(h.q + dq, h.r + dr);
        b.pos.set(c.x, g.y + 1.01, c.z);
        b.vel?.set(0, 0, 0);
        return true;
      }
    }
    return false;
  }
  // Course de taxi : who = le passager (un joueur : null), passagers villageois en plus (ses
  // militaires, un villageois en visite)
  taxiStart(a, s, k, dest, riders = []) {
    if (!a || !s || !this.structs) return false;
    const V = this.villageOf(a);
    if (a.task) this.end(a, a.task, 0);
    if (!this.seatOn(a, s, k)) return false;
    const aboard = [];
    for (const b of riders) { if (b !== a && !b.dead && this.seatOn(b, s, k)) { if (b.task) this.end(b, b.task, 0); aboard.push(b); } }
    a.task = { kind: 'taxiride', s, k, dest, home: [s.pos.x, s.pos.y, s.pos.z], phase: 'out', t: 0, vk: V?.key, riders: aboard };
    return true;
  }
  unseat(a, V) {
    a.seat = null;
    // (sur la plateforme, à côté du véhicule : pas dedans)
    if (V?.pad) { const c = hexToWorld(V.pad.q, V.pad.r); a.pos.set(c.x, V.pad.y + 1.01, c.z); }
    a.vel?.set(0, 0, 0);
  }
  do_taxiride(a, V, t, dt) {
    const S = this.structs, s = t.s;
    if (!S || !S.list.includes(s)) { a.seat = null; this.end(a, t); return; }
    a.state = 'idle';
    t.t += dt;
    const near = ([x, y, z], R = 3) => Math.hypot(s.pos.x - x, s.pos.z - z) < R && Math.abs(s.pos.y - y) < 4;
    const goHome = () => { S.setParams(s, t.k, [Math.round(t.home[0]), Math.round(t.home[1]), Math.round(t.home[2]), 1]); t.phase = 'back'; t.t = 0; };
    if (t.phase === 'out') {
      // arrivé (ou bloqué en route depuis 4 minutes) : on dépose les passagers (les militaires
      // descendent ; un visiteur descend, se promène, puis remonte)
      if (near(t.dest) || t.t > 240) {
        t.phase = 'drop'; t.t = 0; this.say(a, 'here');
        for (const b of t.riders || []) if (b.seat?.s === s && !b.visit) this.dropOff(b, s);
        if (t.visit) this.say(t.visit, 'look', 0.8);
      }
    } else if (t.phase === 'drop') {
      const aboard = (this.players || []).some((p) => p.attached === s || p.standingOn === s);
      if ((!aboard && t.t > (t.visit ? 20 : 3)) || t.t > 45) { this.say(a, 'bye'); goHome(); }
    } else if (near(t.home, 2.5) || t.t > 300) {
      // de retour à sa place : il descend sur la plateforme (et son visiteur avec lui)
      for (const b of t.riders || []) { if (b.seat?.s === s) { b.seat = null; this.unseat(b, V); } b.visit = false; }
      if (t.visit) this.say(t.visit, 'thanks', 0.8);
      this.unseat(a, V);
      this.end(a, t, rnd(2, 5));
    }
  }

  // Chauffeur de taxi : il attend les clients à la plateforme (voir main.js : la destination)
  do_taxiwait(a, V, t, dt) {
    if (!V.pad) { this.end(a, t); return; }
    if (!t.phase) { t.phase = 'go'; t.time = rnd(20, 40); this.goCell(a, t, V.pad.q, V.pad.r, V.pad.y + 1, 2, 4); return; }
    a.state = 'idle';
    if (Math.random() < dt * 0.4) a.headTarget = (Math.random() - 0.5) * 1.6;
    if ((t.time -= dt) <= 0) { if (!this.visitTrip(a, V)) this.end(a, t, rnd(1, 3)); }
  }
  // De temps en temps (le jour), le chauffeur emmène un villageois sans travail visiter un autre
  // village qui a une plateforme (à moins de VISIT_R blocs), puis le ramène
  visitTrip(a, V) {
    if (Math.random() > 0.15 || !this.workTime() || this.animals.talk.time() > WORK_DAY[1] - 0.12) return false;
    const pc = hexToWorld(V.pad.q, V.pad.r);
    const other = [...this.villages.values()].find((W) => W !== V && W.pad && Math.hypot(W.x - V.x, W.z - V.z) < VISIT_R);
    if (!other) return false;
    const guest = V.members.find((b) => b !== a && b.type === 'villager' && b.active && !b.seat && (!b.job || JOBS[b.job]?.artisan) && Math.hypot(b.pos.x - pc.x, b.pos.z - pc.z) < 40);
    if (!guest) return false;
    // un véhicule garé, libre
    const s = (this.structs?.list || []).find((x) => Math.hypot(x.pos.x - pc.x, x.pos.z - pc.z) < PAD_R + 6 && Math.abs(x.pos.y - V.pad.y) < 12 && this.controls(x)
      && !this.animals.list.some((b) => b.seat?.s === x) && !(this.players || []).some((p) => p.standingOn === x || p.attached === x));
    if (!s) return false;
    const c = this.controls(s), oc = hexToWorld(other.pad.q, other.pad.r), dest = [Math.round(oc.x), other.pad.y + 3, Math.round(oc.z)];
    guest.visit = true;
    if (!this.taxiStart(a, s, c.grav, dest, [guest])) { guest.visit = false; return false; }
    a.task.visit = guest;
    this.fly(s, c, [...dest, 1]);
    this.say(guest, 'look', 0.8);
    return true;
  }

  // Ranger ses pousses dans les coffres de la grange (pleins : à la mairie)
  do_stash(a, V, t, dt) {
    const B = V.barn;
    if (!B) { this.end(a, t); return; }
    if (!t.phase) { t.phase = 'go'; this.goCell(a, t, B.q, B.r, B.y + 1, 2, 3); return; }
    if (!this.act(a, t, dt, ACT_T, ...this.xz([B.q, B.r]))) return;
    this.unload(a, this.barnBoxes(V));
    if (carried(a) && this.hallOk(V)) this.unload(a, this.hallBoxes(V), V);
    this.say(a, 'done', 0.2);
    this.end(a, t, rnd(2, 5));
  }

  // S'écarter d'une case (un maçon doit y poser un bloc)
  do_away(a, V, t, dt) {
    if (!t.phase) {
      t.phase = 'go';
      const [q, r] = t.from, me = worldToHex(a.pos.x, a.pos.z);
      let dq = me.q - q, dr = me.r - r;
      if (!dq && !dr) [dq, dr] = pickOf(NEIGHBORS);
      const l = Math.max(1, hexDist(dq, dr));
      this.goCell(a, t, Math.round(q + (dq / l) * 3), Math.round(r + (dr / l) * 3), undefined, 1, 0);
      return;
    }
    this.end(a, t, rnd(1, 3));
  }

  // Aller voir quelqu'un et lui dire quelque chose (il répond)
  do_chat(a, V, t, dt) {
    const w = t.who;
    if (!w || w.dead || !w.active) { this.end(a, t); return; }
    if (!t.phase) { t.phase = 'go'; const c = worldToHex(w.pos.x, w.pos.z); this.goCell(a, t, c.q, c.r, Math.floor(w.pos.y), 2, 4); return; }
    if (t.phase === 'go') {
      t.phase = 'talk';
      t.clock = 0;
      t.i = 0;
      return;
    }
    this.face(a, w.pos.x, w.pos.z);
    a.state = 'idle';
    t.clock -= dt;
    if (t.clock > 0) return;
    if (t.i < t.lines.length) { this.say(a, t.lines[t.i++]); t.clock = 1.4; return; }
    this.animals.talk.later(w, pickOf(t.answer || ['thanks', 'fine', 'working']), 0.3);
    this.end(a, t, 4);
  }

  // Le champ de ce fermier (au plus FIELD_FARMERS par champ) ; any : n'importe lequel (le
  // bâtisseur de champs qui aide)
  fieldOf(V, a, any = false) {
    if (!V.fields.length) return null;
    if (any) return V.fields[Math.floor(Math.random() * V.fields.length)];
    const count = (i) => V.members.filter((b) => b !== a && b.job === 'farmer' && b.field === i).length;
    if (!(a.field >= 0 && a.field < V.fields.length && count(a.field) < FIELD_FARMERS)) {
      let best = -1;
      for (let i = 0; i < V.fields.length; i++) if (count(i) < FIELD_FARMERS && (best < 0 || count(i) < count(best))) best = i;
      a.field = best;
    }
    return a.field >= 0 ? V.fields[a.field] : null;
  }
  // Potager : du blé et des pommes de terre, une case sur deux, sur la terre labourée (le
  // fermier laboure lui-même un ancien potager d'herbe). Ils poussent tout seuls (voir
  // nature.js) ; mûrs, il les récolte (nourriture du village, et la récolte va à la mairie) et
  // replante aussitôt.
  do_farm(a, V, t, dt) {
    const G = t.G ||= this.fieldOf(V, a, a.job !== 'farmer');
    if (!G || !V.fields.includes(G)) { this.end(a, t); return; }
    if (!t.phase) { t.phase = 'go'; this.goCell(a, t, G.q, G.r, undefined, 2, 3.5); return; }
    const todo = (g) => {
      const ground = this.get(g.q, g.r, g.y), up = this.get(g.q, g.r, g.y + 1);
      if (isFarmland(ground)) return up === AIR || up === TALL_GRASS || !!BLOCKS[up]?.ripe;
      return (ground === 1 || ground === 2) && (up === AIR || up === TALL_GRASS);
    };
    const cell = G.cells.find(todo);
    if (!cell) {
      a.state = 'idle';
      t.idle = (t.idle || 0) + dt;
      if (t.idle > 6) this.end(a, t, rnd(8, 20));
      return;
    }
    if (!this.act(a, t, dt, ACT_T, ...this.xz([cell.q, cell.r]))) return;
    const up = this.get(cell.q, cell.r, cell.y + 1);
    const crop = G.cells.indexOf(cell) % 2 ? POTATO_CROP : WHEAT_CROP;
    if (up === TALL_GRASS) this.set(cell.q, cell.r, cell.y + 1, AIR);
    if (!isFarmland(this.get(cell.q, cell.r, cell.y))) {
      // un ancien potager d'herbe : il laboure
      this.set(cell.q, cell.r, cell.y, FARMLAND);
    } else if (BLOCKS[up]?.ripe) {
      // récolte (et la case est aussitôt replantée)
      const potato = up !== WHEAT_CROP + 13;
      V.food += 3;
      addCarry(a, potato ? POTATO : WHEAT, potato ? 2 : 2);
      this.set(cell.q, cell.r, cell.y + 1, potato ? POTATO_CROP : WHEAT_CROP);
      this.say(a, 'harvest', 0.3);
    } else if (this.get(cell.q, cell.r, cell.y + 1) === AIR) {
      this.set(cell.q, cell.r, cell.y + 1, crop);
      this.say(a, 'plant', 0.15);
    }
    if ((t.n = (t.n || 0) + 1) >= 8) this.end(a, t, rnd(5, 15));
  }

  // Pêche au bord de l'eau (nourriture)
  do_fish(a, V, t, dt) {
    const F = V.fish;
    if (!F || !isWater(this.world.surface(F.wq, F.wr).id) || V.fields.some((G) => hexDist(F.wq - G.q, F.wr - G.r) <= 1)) { V.fish = null; a.job = null; this.end(a, t); return; }
    const [x, z] = this.xz([F.q, F.r]), [wx, wz] = this.xz([F.wq, F.wr]);
    if (!t.phase) { t.phase = 'go'; this.goCell(a, t, F.q, F.r, F.y, 0, 2); return; }
    if (!this.act(a, t, dt, rnd(...FISH_T), wx, wz)) return;
    V.food += 1;
    this.say(a, 'look', 0.2);
    if ((t.n = (t.n || 0) + 1) >= 3) this.end(a, t, rnd(10, 30));
  }

  // Tondre les moutons du coin (laine pour la mairie)
  do_shear(a, V, t, dt) {
    if (!t.sheep || t.sheep.dead || !t.sheep.active) {
      const list = this.sheepNear(V).filter((s) => !(s.shornT > this.clock));
      if (!list.length || (t.n || 0) >= 3) { this.end(a, t, rnd(10, 30)); return; }
      t.sheep = list.reduce((b, s) => (Math.hypot(s.pos.x - a.pos.x, s.pos.z - a.pos.z) < Math.hypot(b.pos.x - a.pos.x, b.pos.z - a.pos.z) ? s : b));
      t.phase = null;
    }
    const s = t.sheep;
    if (!t.phase) { t.phase = 'go'; const c = worldToHex(s.pos.x, s.pos.z); this.goCell(a, t, c.q, c.r, Math.floor(s.pos.y), 1, 2.5); return; }
    if (Math.hypot(s.pos.x - a.pos.x, s.pos.z - a.pos.z) > 2.5) { t.phase = null; return; }
    if (!this.act(a, t, dt, 2.5, s.pos.x, s.pos.z)) return;
    addCarry(a, s.type === 'sheep_grey' ? 195 : 194, 1 + (Math.random() < 0.5 ? 1 : 0));
    s.shornT = this.clock + 300;
    t.sheep = null;
    t.n = (t.n || 0) + 1;
  }

  // Artisan : au travail à son établi
  do_craft(a, V, t, dt) {
    const h = this.houseOf(V, a);
    if (!h) { this.end(a, t); return; }
    const c = hexToWorld(h.q, h.r);
    if (!t.phase) { t.phase = 'go'; t.time = rnd(15, 35); this.goCell(a, t, ...this.homeSpot(h), 1, 2.5); return; }
    const [x, z] = this.xz(this.tableAt(h));
    this.act(a, t, dt, 1, x, z);
    if ((t.time -= dt) <= 0) { this.say(a, 'done', 0.15); this.end(a, t, rnd(10, 30)); }
  }

  // La nuit : à la maison (sans maison : près du puits)
  homeOf(V, a) { return this.houseOf(V, a); }
  // Où se tenir chez soi : le centre de la maison (dans un immeuble, à côté du pilier : pas
  // dans la cage d'escalier)
  // (à quelle hauteur : dans un immeuble à boutique, au premier étage)
  homeY(h) { return h.y + (h.kind === 'shop' ? 5 : 1); }
  // Une case dehors autour du bâtiment h, différente pour chaque villageois (sa place)
  aroundSpot(V, h, a) {
    const R = h.rad + 2, ring = [];
    for (let x = -R; x <= R; x++) for (let y = -R; y <= R; y++) if (hexDist(x, y) === R) ring.push([h.q + x, h.r + y]);
    return ring[(Math.max(0, V.members.indexOf(a)) * 5) % ring.length];
  }
  // [q, r, y] : son lit (who), sinon le centre de la maison, ou à côté du pilier d'un immeuble
  homeSpot(h, who = null) {
    const bed = who && h.beds?.[who.bed || 0];
    if (bed && this.loaded(bed[0], bed[1]) && isPod(this.get(...bed))) return bed;
    if (!STOREYED.has(h.kind)) return [h.q, h.r, this.homeY(h)];
    const [a, b] = midCell(2, (h.door + 3) % 6);
    return [h.q + a, h.r + b, this.homeY(h)];
  }
  do_rest(a, V, t, dt) {
    const h = this.houseOf(V, a) || V.houses[V.hallI];
    const c = h ? hexToWorld(h.q, h.r) : { x: V.x, z: V.z };
    if (!t.phase) {
      t.phase = 'go';
      // (sans maison : chacun sa place autour de la mairie, pas tous au même endroit)
      const pb = a.job === 'courier' && this.postBed(V, a);
      if (pb) this.goCell(a, t, ...pb, 0, 3);
      else if (!this.houseOf(V, a) && h) { const [q, r] = this.aroundSpot(V, h, a); this.goCell(a, t, q, r, undefined, 1, 4); }
      else if (h) this.goCell(a, t, ...this.homeSpot(h, a), 0, 3);
      else this.goCell(a, t, V.q, V.r, undefined, 3, 6);
      return;
    }
    a.state = 'idle';
    if (Math.random() < dt * 0.3) a.headTarget = (Math.random() - 0.5) * 1.2;
    if (t.guard ? !this.workTime() : this.workTime()) this.end(a, t, rnd(0, 3));
  }

  // ---------- Mine ----------
  cellPos(p) { const c = hexToWorld(p[0], p[1]); return [c.x, c.z, p[2]]; }
  mineDoor(M) { const [q, r] = this.doorFront({ ...M, rad: 2 }); return [q, r, undefined]; }
  do_mine(a, V, t, dt) {
    const M = V.mine;
    if (!M || M.done) { this.mineUp(a, V, t); return; }
    if (!t.phase) {
      // jusqu'à l'entrée, puis chaque marche jusqu'au front de taille
      t.phase = 'door';
      const [q, r] = this.mineDoor(M);
      this.goCell(a, t, q, r, undefined, 1, 3);
      return;
    }
    if (t.phase === 'door') {
      t.phase = 'down';
      if (M.path.length) { this.follow(a, t, M.path.map((p) => this.cellPos(p)), 0.5); return; }
    }
    if (t.phase === 'up') { this.end(a, t); return; }
    // (arrivé aux coffres de la mine : il y range ce qu'il porte, puis retourne creuser)
    if (t.phase === 'stash') {
      const p = M.chests?.[0];
      if (!p || !this.act(a, t, dt, ACT_T, ...this.xz(p))) { if (!p) this.mineUp(a, V, t); return; }
      for (const k of Object.keys(a.carry || {})) {
        let n = a.carry[k];
        for (const b of this.mineBoxes(V)) if (n) n = this.put(b, +k, n);
        if (n) a.carry[k] = n; else delete a.carry[k];
      }
      this.say(a, 'done', 0.2);
      if (carried(a)) { this.mineUp(a, V, t); return; }
      t.phase = t.unit ? 'dig' : 'down'; t.clock = undefined;
    }
    if (t.phase === 'down' || t.phase === 'step') { t.phase = 'dig'; t.unit = this.mineNext(M); t.clock = DIG_T; return; }
    // creuser
    if (carried(a) >= CARRY_MAX) {
      // des coffres dans la mine (et un livreur pour les vider) : il y range tout ; sinon il remonte
      const p = M.chests?.[0];
      if (p && V.members.some((b) => b.job === 'courier') && this.mineBoxes(V).some((b) => b.slots.some((s) => !s))) {
        t.phase = 'stash'; t.clock = undefined;
        this.goCell(a, t, ...p, 1, 2.5);
        return;
      }
      this.mineUp(a, V, t);
      return;
    }
    const u = t.unit;
    if (!u) { M.done = true; this.say(a, 'done'); this.mineUp(a, V, t); return; }
    const [sx, sz] = this.xz(u.stand);
    const next = u.cells.find((c) => this.get(...c) !== AIR);
    // (trop loin de ce qu'il creuse, après un détour aux coffres : il y retourne)
    if (Math.hypot(sx - a.pos.x, sz - a.pos.z) > 2.6) { t.clock = undefined; this.goCell(a, t, ...u.stand, 1, 2.5); return; }
    if (next) {
      if (!this.act(a, t, dt, DIG_T, sx, sz)) return;
      const id = this.get(...next), drop = HUT_FLOOR[id];
      if (drop === undefined) { u.cells.length = 0; return; } // (un bloc posé par un joueur : on n'y touche pas)
      this.set(next[0], next[1], next[2], AIR);
      addCarry(a, drop);
      if (id === 60 || id === 61) this.say(a, 'iron', 0.6);
      return;
    }
    // marche (ou bout de galerie) creusée : sol bouché, torche, on avance
    const [q, r, y] = u.stand;
    if (!SOLID[this.get(q, r, y - 1)]) this.set(q, r, y - 1, 28);
    if (u.torch && SOLID[this.get(u.torch[3], u.torch[4], u.torch[2])] && this.get(u.torch[0], u.torch[1], u.torch[2]) === AIR) this.set(u.torch[0], u.torch[1], u.torch[2], WALL_TORCH + u.torch[5]);
    if (!u.room) M.path.push(u.stand); // (dans une salle : on y marche librement)
    if (u.room) { /* (salle : voir mineNext) */ } else if (u.tunnel) { M.tun.q = q; M.tun.r = r; M.tun.k++; } else M.i++;
    M.dug++;
    t.phase = 'step';
    t.unit = null;
    this.go(a, t, sx, sz, 0.45, y);
  }
  mineUp(a, V, t) {
    const M = V.mine;
    if (!M || t.phase === 'up') { this.end(a, t); return; }
    t.phase = 'up';
    // (remonte par les marches déjà descendues : celles du chemin jusqu'à sa position)
    const pts = [this.mineDoor(M), ...M.path].map((p) => this.cellPos(p));
    let k = 0, bd = Infinity;
    pts.forEach((p, i) => { const d = Math.hypot(p[0] - a.pos.x, p[1] - a.pos.z) + Math.abs(p[2] - a.pos.y) * 2; if (d < bd) { bd = d; k = i; } });
    this.follow(a, t, pts.slice(0, k + 1).reverse(), 1.5);
  }
  // Prochaine partie à creuser : une marche de l'escalier en colimaçon (trois blocs de haut,
  // autour du pilier central), puis, au fond, une galerie qui serpente (deux blocs de haut)
  mineNext(M) {
    for (let guard = 0; guard < 10; guard++) {
      if (M.done) return null;
      if (!M.shaftDone) {
        const i = M.i, [a, b] = DIRS6[i % 6], q = M.q + a, r = M.r + b, y = M.y - i;
        if (y <= MINE_FLOOR || i >= MINE_SHAFT) { M.shaftDone = true; continue; }
        const cells = [[q, r, y], [q, r, y + 1], [q, r, y + 2]];
        // (les trois premières marches traversent le plancher de l'entrée)
        if (!this.diggable(cells, i < 3 ? HUT_FLOOR : DIG_DROP)) { M.shaftDone = true; if (i < 3) M.done = true; continue; }
        return { cells, stand: [q, r, y], torch: i % 6 === 5 ? this.torchFor(q, r, y + 1, -a, -b) : null };
      }
      // au fond : de grandes salles (rayon ROOM_R, ROOM_H de haut), creusées colonne par colonne
      // en partant de leur entrée ; trois piliers au milieu. Chacune touche la précédente.
      if (!M.room) {
        if ((M.rooms || 0) >= MINE_ROOMS) { M.done = true; continue; }
        const last = M.path[M.path.length - 1];
        if (!last) { M.done = true; continue; }
        const prev = M.lastRoom, d = prev ? (prev.d + pickOf([0, 1, 5])) % 6 : (M.i + 5) % 6;
        const cq = prev ? prev.q + DIRS6[d][0] * (2 * ROOM_R + 1) : last[0] + DIRS6[d][0] * ROOM_R;
        const cr = prev ? prev.r + DIRS6[d][1] * (2 * ROOM_R + 1) : last[1] + DIRS6[d][1] * ROOM_R;
        const [eq, er] = prev ? [cq - DIRS6[d][0] * ROOM_R, cr - DIRS6[d][1] * ROOM_R] : [last[0], last[1]];
        const pillar = (q, r) => [0, 2, 4].some((k) => q === cq + DIRS6[k][0] * 2 && r === cr + DIRS6[k][1] * 2);
        const list = [];
        for (let a = -ROOM_R; a <= ROOM_R; a++) for (let b = -ROOM_R; b <= ROOM_R; b++) {
          if (hexDist(a, b) > ROOM_R || pillar(cq + a, cr + b)) continue;
          list.push([cq + a, cr + b]);
        }
        list.sort((u, v) => hexDist(u[0] - eq, u[1] - er) - hexDist(v[0] - eq, v[1] - er));
        M.room = { q: cq, r: cr, y: prev ? prev.y : last[2], d, list, i: 0 };
      }
      const Rm = M.room;
      let unit = null;
      while (Rm.i < Rm.list.length && !unit) {
        const [q, r] = Rm.list[Rm.i++], cells = [];
        for (let h = 0; h < ROOM_H; h++) cells.push([q, r, Rm.y + h]);
        if (!this.loaded(q, r) || cells.every((c) => this.get(...c) === AIR) || !this.diggable(cells)) continue;
        unit = { cells, stand: [q, r, Rm.y], room: true };
      }
      if (unit) return unit;
      // salle finie : des torches ; dans la première, les coffres de la mine
      for (const k of [1, 3, 5]) {
        const q = Rm.q + DIRS6[k][0] * 3, r = Rm.r + DIRS6[k][1] * 3;
        if (this.get(q, r, Rm.y) === AIR && SOLID[this.get(q, r, Rm.y - 1)]) this.set(q, r, Rm.y, TORCH);
      }
      if (!M.chests) {
        M.chests = [];
        for (const k of [(Rm.d + 2) % 6, (Rm.d + 4) % 6]) {
          const q = Rm.q + DIRS6[k][0] * (ROOM_R - 1), r = Rm.r + DIRS6[k][1] * (ROOM_R - 1);
          if (this.get(q, r, Rm.y) !== AIR || !SOLID[this.get(q, r, Rm.y - 1)]) continue;
          this.set(q, r, Rm.y, facingVariant(CHEST, sideToward(q, r, ...this.xz([Rm.q, Rm.r]))));
          M.chests.push([q, r, Rm.y]);
        }
      }
      M.path.push([Rm.q, Rm.r, Rm.y]); // (le chemin passe par le centre de chaque salle)
      M.rooms = (M.rooms || 0) + 1;
      M.lastRoom = { q: Rm.q, r: Rm.r, y: Rm.y, d: Rm.d };
      M.room = null;
    }
    return null;
  }
  // Torche murale en (q, r, y), accrochée au bloc voisin (dq, dr) : [q, r, y, bq, br, côté]
  torchFor(q, r, y, dq, dr) {
    const k = NEIGHBORS.findIndex(([a, b]) => a === dq && b === dr);
    return k < 0 ? null : [q, r, y, q + dq, r + dr, k];
  }
  // Ces blocs se creusent sans danger (pas d'eau ni de lave à côté, rien de posé par un joueur)
  diggable(cells, drops = DIG_DROP) {
    for (const [q, r, y] of cells) {
      if (!this.loaded(q, r)) return false;
      const id = this.get(q, r, y);
      if (id !== AIR && drops[id] === undefined) return false;
      for (const [a, b] of NEIGHBORS) { const n = this.get(q + a, r + b, y); if (isWater(n) || isLava(n)) return false; }
      const up = this.get(q, r, y + 1);
      if (isWater(up) || isLava(up)) return false;
    }
    return true;
  }
}
