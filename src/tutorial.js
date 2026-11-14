// Le tutoriel : la station Hexa-Zéro (voir station.js). ORA, l'intelligence de la station,
// guide le joueur leçon par leçon (regarder, marcher, sauter, récolter, fabriquer, miner,
// s'éclairer, se soigner, cuire du fer…) : le chapitre 1, qui finit à la navette. Le chapitre 2 (sa
// propre sauvegarde, un autre bouton du menu) commence dans l'atelier : l'usine (le courant, une
// machine, les tapis, une chaîne de production automatique), puis, dans la salle des énergies,
// l'énergie verte (roue à aubes, éoliennes, câbles) et le carburant (pompe, tuyaux, réservoirs,
// raffinerie, bidon), enfin, au garage, une voiture (roues, volant, levier analogique, colle,
// conduite sur la piste d'essai). Chaque étape a
// un objectif (en haut à droite) et des répliques (en haut de l'écran) ; l'étape est vérifiée
// en continu (inventaire, position, usine, actions signalées par le jeu avec event()). Des
// portes vitrées s'ouvrent au fil des leçons.
import * as THREE from 'three';
import {
  BLOCKS, isShaft, STICK, COAL, IRON_INGOT, COOKED_PORK, WOODEN_PICKAXE, PEBBLE, RUSTIC_PICKAXE, makeSlot,
  BOILER, BOILER_ON, DYNAMO, CABLE, CRUSHER, SHAFT, BELT, EXTRACTOR,
  WHEEL, CAR_SEAT, isCarSeat, ANALOG, isAnalog, GLUE,
  WIND_TURBINE, WATER_WHEEL, PUMP, PIPE, TANK, REFINERY, CANISTER, FUEL_CANISTER, SULFUR,
} from './blocks.js?v=1.1.5-alpha-mwgq2wrb';
import { roomAt, stationGates, SPOTS, Y0 } from './station.js?v=1.1.5-alpha-mwgq2wrb';
import { worldToHex, hexToWorld, NEIGHBORS, SIZE } from './hex.js?v=1.1.5-alpha-mwgq2wrb';
import { translate } from './i18n.js?v=1.1.5-alpha-mwgq2wrb';

const LOG = 5, PLANKS = 18, TABLE = 31, COBBLE = 28, TORCH = 23, IRON_ORE = 60, DUST = 3850;
const RECEIVE = 6; // (poussières de fer à faire arriver dans le coffre de réception)
const isFurnace = (id) => BLOCKS[id]?.container === 'furnace';
const isTorch = (id) => id === TORCH || BLOCKS[id]?.pick === TORCH;
// La voiture du garage (chapitre 2), par rapport au cercle du départ (SPOTS.car) : [dq, dr, bloc,
// étiquette, hauteur]. Les 4 roues au sol (l'avant vers l'est, +x), le dessus posé sur elles :
// des planches, le levier analogique (sur la planche posée sur une roue arrière : il l'alimente à
// travers elle ; rien ne se pose sur une roue, elle est ronde), le volant à l'arrière
const CAR_GHOSTS = [
  [1, -1, WHEEL, 'Roue', 0], [0, 1, WHEEL, 'Roue', 0], [0, -1, WHEEL, 'Roue', 0], [-1, 1, WHEEL, 'Roue', 0],
  [0, 0, PLANKS, 'Planches', 1], [1, 0, PLANKS, 'Planches', 1], [1, -1, PLANKS, 'Planches', 1], [0, 1, PLANKS, 'Planches', 1], [-1, 1, PLANKS, 'Planches', 1],
  [0, -1, PLANKS, 'Planches', 1], [-1, 0, CAR_SEAT, 'Volant', 1],
  [0, -1, ANALOG, 'Levier analogique', 2],
];
const FLAG_DQ = 26; // (le drapeau, au bout de la piste : 26 cases à l'est du départ)
// La salle des énergies (par rapport à SPOTS.energy, au bord du bassin : voir POOL dans station.js) :
// la roue à aubes et la pompe dans l'eau (hauteur -1), la ligne des tuyaux vers l'est (réservoir
// d'eau, raffinerie, réservoir de carburant), les câbles au sud, des éoliennes jusqu'à la roue
// (le premier câble posé sur elle)
const CABLE_GHOSTS = [
  [-2, 1, CABLE, 'Câble (sur la roue)'], [-2, 0, CABLE, 'Câble'], [-1, -1, CABLE, 'Câble'], [0, -1, CABLE, 'Câble'],
  [1, -1, CABLE, 'Câble'], [2, -1, CABLE, 'Câble'], [3, -1, CABLE, 'Câble'], [4, -1, CABLE, 'Câble'],
];
const ENERGY_KIT = [[WATER_WHEEL, 2], [WIND_TURBINE, 3], [CABLE, 16], [PUMP, 1], [PIPE, 8], [TANK, 3], [REFINERY, 1], [COAL, 8], [SULFUR, 4], [CANISTER, 2]];
const PART_TITLE = { 2: 'L\'usine', 3: 'Véhicules', 4: 'Énergie verte', 5: 'Carburant' };


// Étapes : goal (objectif), hint (comment faire), say (répliques au début), check (fait ?
// ou texte de progression), then (répliques une fois faite), open (porte qui s'ouvre), act
// (action du jeu une fois faite)
const STEPS = [
  {
    id: 'look', goal: 'Regarde autour de toi', hint: 'Bouge la souris',
    say: [
      'Bonjour, cadet. Ici ORA, l\'intelligence de la station Hexa-Zéro.',
      'Nous sommes en orbite autour de PXT-1, dans le système PXT, à 45 années-lumière d\'Hexa. Par les hublots, tu verras la planète juste à côté de la station.',
      'Avant de rejoindre l\'équipage du HEXA-7, tu dois réussir ta formation de survie. Je vais te guider pas à pas.',
      'Commence par regarder autour de toi avec la souris.',
    ],
    wait: true, // (la présentation d'ORA est dite en entier avant de passer à la suite)
    check: (t) => t.looked > 2.2,
  },
  {
    id: 'walk', goal: 'Sors de ta cabine', hint: '{k:forward} {k:left} {k:back} {k:right} pour marcher',
    say: ['Parfait. Marche avec {forward}, {left}, {back} et {right}, et sors de ta cabine par la porte, vers le couloir.'],
    check: (t) => t.x > 0.5,
  },
  {
    id: 'jump', goal: 'Saute par-dessus la caisse', hint: '{k:jump} pour sauter',
    say: ['Une caisse bloque le couloir. Avance vers elle et appuie sur {jump} pour sauter par-dessus.'],
    check: (t) => t.x > 8,
    then: ['Bien sauté ! Pour courir, maintiens {sprint} en marchant, ou appuie deux fois sur {forward}.'],
  },
  {
    id: 'serre', goal: 'Va jusqu\'à la serre', hint: 'Au bout du couloir',
    say: ['Continue jusqu\'à la serre hydroponique, au bout du couloir.'],
    check: (t) => t.x > 17,
  },
  {
    id: 'logs', goal: 'Récolte 4 bûches', hint: 'Vise un tronc et <b>maintiens le clic gauche</b>',
    say: [
      'Voici la serre. Ces arbres nous donnent de l\'oxygène… et du bois.',
      'Vise un tronc et maintiens le clic gauche jusqu\'à ce qu\'il se casse. Récupère 4 bûches.',
    ],
    check: (t) => t.count(LOG) >= 4 || `Bûches : ${t.count(LOG)} / 4`,
  },
  {
    id: 'inv', goal: 'Ouvre ton inventaire', hint: '{k:inventory}',
    say: ['Très bien. Ce que tu ramasses va dans ton inventaire : appuie sur {inventory} pour l\'ouvrir.'],
    check: (t) => t.opened.has(2),
  },
  {
    id: 'planks', goal: 'Fabrique des planches', hint: 'Une bûche dans la grille, puis clic sur le résultat',
    say: [
      'En haut, c\'est ta grille d\'artisanat. Prends une bûche (clic) et pose-la dans une case : 4 planches apparaissent à droite.',
      'Clique sur le résultat pour le prendre. Astuce : Maj + clic fabrique tout ce que tu peux d\'un coup.',
    ],
    check: (t) => t.count(PLANKS) >= 4 || `Planches : ${t.count(PLANKS)} / 4`,
  },
  {
    id: 'table', goal: 'Fabrique une table de craft', hint: 'Une planche dans chacune des 4 cases',
    say: ['Maintenant, mets une planche dans chacune des 4 cases de la grille : ça donne une table de craft.'],
    check: (t) => t.count(TABLE) >= 1,
  },
  {
    id: 'place', goal: 'Pose la table de craft', hint: 'Choisis-la dans ta barre (molette ou 1…0), puis <b>clic droit</b> sur le sol',
    say: [
      'Ferme l\'inventaire avec {inventory}. Tes objets en main sont dans la barre du bas : choisis la table avec la molette ou les touches 1 à 0.',
      'Puis fais un clic droit sur le sol pour la poser.',
    ],
    check: (t) => t.placed.has('table'),
  },
  {
    id: 'useTable', goal: 'Utilise la table de craft', hint: '<b>Clic droit</b> sur la table',
    say: ['Fais un clic droit sur la table pour t\'en servir.'],
    check: (t) => t.opened.has(3),
  },
  {
    id: 'pickaxe', goal: 'Fabrique une pioche en bois', hint: 'Bâtons : 2 planches l\'une sur l\'autre. Pioche : 3 planches en haut, 2 bâtons au milieu',
    say: [
      'La table a une grille de 3 sur 3, pour les objets plus grands. D\'abord des bâtons : deux planches l\'une au-dessus de l\'autre.',
      'Puis la pioche : trois planches sur la ligne du haut, et deux bâtons au milieu, en dessous.',
      'Toutes les recettes sont aussi dans le Wiki, dans le menu (Échap).',
    ],
    check: (t) => t.count(WOODEN_PICKAXE) >= 1,
    then: ['Excellent ! J\'ouvre la porte de la soute à échantillons, après la serre.'],
    open: 'mine',
  },
  {
    id: 'mine', goal: 'Va dans la soute à échantillons', hint: 'La porte après la serre est ouverte',
    say: ['Rejoins la soute à échantillons : la porte vitrée est ouverte.'],
    check: (t) => t.x > 43,
  },
  {
    id: 'pebbles', goal: 'Mine l\'astéroïde : 3 cailloux', hint: 'La pioche en main, <b>clic gauche maintenu</b> sur la pierre',
    say: [
      'Ce morceau d\'astéroïde a été ramené pour l\'entraînement. Prends ta pioche en main et creuse la pierre.',
      'Avec une pioche en bois, la pierre ne donne que des cailloux. Récupères-en 3.',
    ],
    check: (t) => t.count(PEBBLE) >= 3 || `Cailloux : ${t.count(PEBBLE)} / 3`,
  },
  {
    id: 'rustic', goal: 'Fabrique une pioche rustique', hint: 'Sur la table de la soute : 3 cailloux en haut, 2 bâtons au milieu',
    say: [
      'Avec ces cailloux, fabrique une pioche rustique : la même forme que la pioche en bois, avec des cailloux à la place des planches.',
      'Une table de craft t\'attend dans la soute. Il te faut encore 2 bâtons : refais-en avec des planches si besoin.',
    ],
    check: (t) => t.count(RUSTIC_PICKAXE) >= 1,
  },
  {
    id: 'cobble', goal: 'Récupère 8 pierres taillées et 2 charbons', hint: 'Mine la pierre et les points noirs avec la pioche rustique',
    say: [
      'La pioche rustique détache la pierre en blocs entiers : de la pierre taillée. Il en faut 8.',
      'Les taches noires dans la roche, c\'est du charbon. Prends-en au moins 2.',
    ],
    check: (t) => (t.count(COBBLE) >= 8 && t.count(COAL) >= 2) || `Pierre taillée : ${Math.min(8, t.count(COBBLE))} / 8 — Charbon : ${Math.min(2, t.count(COAL))} / 2`,
  },
  {
    id: 'torches', goal: 'Fabrique des torches', hint: 'Un charbon au-dessus d\'un bâton',
    say: [
      'Le couloir suivant est plongé dans le noir : ses lampes ont grillé pendant la dernière tempête solaire.',
      'Fabrique des torches : un charbon au-dessus d\'un bâton. Ça en donne 4.',
    ],
    check: (t) => t.count(TORCH) >= 4,
    then: ['Je déverrouille le couloir sombre. Éclaire-le !'],
    open: 'dark',
  },
  {
    id: 'light', goal: 'Pose 3 torches dans le couloir sombre', hint: 'Torche en main, <b>clic droit</b> sur le sol ou un mur',
    say: ['Prends les torches en main et fais un clic droit pour en poser, au sol ou sur les murs. Pose-en au moins 3 dans le couloir sombre.'],
    check: (t) => t.darkTorches >= 3 || `Torches posées : ${t.darkTorches} / 3`,
    then: ['C\'est beaucoup mieux. Sur une planète, la nuit est noire aussi : garde toujours des torches sur toi.'],
  },
  {
    id: 'forge', goal: 'Rejoins la forge', hint: 'Au bout du couloir sombre',
    say: ['Avance jusqu\'à la forge, au bout du couloir.'],
    check: (t) => t.x > 75.5,
    act: 'leak',
    then: [
      '!Alerte ! Micro-météorite… fuite d\'air dans la forge !',
      'La fuite est colmatée. Mais tu as perdu de la vie : tes cœurs sont au-dessus de ta barre d\'objets. S\'ils tombent à zéro, tu perds connaissance.',
    ],
  },
  {
    id: 'chest', goal: 'Ouvre le coffre de secours', hint: '<b>Clic droit</b> sur le coffre',
    say: ['Il y a un coffre de secours dans la forge. Fais un clic droit dessus pour l\'ouvrir, et prends tout ce qu\'il contient (Maj + clic : tout d\'un coup).'],
    check: (t) => t.opened.has('chest'),
  },
  {
    id: 'eat', goal: 'Mange une ration', hint: 'Le porc cuit en main, <b>clic droit</b>',
    say: ['Pour te soigner, mange : prends le porc cuit dans ta main et fais un clic droit. Tes cœurs remontent aussi tout seuls, mais lentement.'],
    check: (t) => t.ate || t.fullHealth,
    then: ['Te voilà requinqué.'],
  },
  {
    id: 'furnace', goal: 'Fabrique un four et pose-le', hint: '8 pierres taillées en anneau sur la table (le centre vide)',
    say: [
      'Le coffre contenait aussi du minerai de fer. Pour le fondre, il faut un four.',
      'Sur la table de la forge, mets 8 pierres taillées tout autour de la grille, en laissant le centre vide. Puis pose le four.',
    ],
    check: (t) => t.placed.has('furnace'),
  },
  {
    id: 'smelt', goal: 'Fais fondre un lingot de fer', hint: 'Clic droit sur le four : minerai en haut, charbon en bas',
    say: [
      'Clic droit sur le four. En haut, le minerai de fer ; en bas, le charbon, qui sert de combustible.',
      'Attends que le lingot sorte à droite, puis prends-le.',
      'Sur une planète, le minerai de fer se cache sous terre, et il faut au moins une pioche en pierre pour l\'extraire.',
    ],
    check: (t) => t.count(IRON_INGOT) >= 1,
    then: [
      'Bravo ! Avec le fer, tu pourras faire de bien meilleurs outils. Le premier chapitre de ta formation est terminé.',
      'Le deuxième chapitre, l\'industrie et les véhicules, t\'attend quand tu veux : choisis-le dans le menu, au bouton Tutoriel.',
      'Pour l\'instant, la navette t\'attend au hangar. J\'ouvre la porte.',
    ],
    open: 'hangar',
  },
  {
    id: 'shuttle', goal: 'Monte dans la navette du hangar', hint: 'Entre par la porte, à l\'arrière',
    say: ['Traverse le hangar et monte dans la navette.'],
    check: (t) => t.inShuttle,
    // (la suite : la navette part, voir departure.js ; ORA parle dans la cinématique)
  },
];

// ---------- Chapitre 2 : l'industrie (l'atelier) et les véhicules (le garage), voir station.js ----------
// (le joueur commence dans l'atelier ; part 2 : l'usine, part 3 : la voiture)
const STEPS2 = [
  {
    id: 'intro2', part: 2, goal: 'Écoute ORA', hint: 'Tu es dans l\'atelier de la station',
    say: [
      'Bienvenue au deuxième chapitre, cadet. Sur une planète, tu ne pourras pas tout faire à la main.',
      'Ici, à l\'atelier, tu vas apprendre à faire travailler les machines à ta place. Ensuite, au garage, tu construiras ta première voiture.',
    ],
    wait: true,
    check: () => true,
  },
  {
    id: 'kit', part: 2, goal: 'Prends le matériel de l\'atelier', hint: '<b>Clic droit</b> sur le coffre près de l\'entrée, Maj + clic pour tout prendre',
    say: [
      'Bienvenue à l\'atelier. Ici, on apprend à faire travailler les machines à ta place.',
      'Le coffre près de l\'entrée contient tout le matériel de la leçon. Prends tout.',
    ],
    check: (t) => t.fac.plant || (t.count(BOILER) >= 1 && t.count(DYNAMO) >= 1 && t.count(CRUSHER) >= 1),
  },
  // (ghosts : les blocs fantômes, là où poser les blocs de l'étape : [dq, dr, bloc, étiquette], par
  // rapport au coffre de minerai, au début de la ligne au sol ; voir showGhosts)
  {
    id: 'plant', part: 2, goal: 'Construis une centrale : chaudière + dynamo', hint: 'Pose-les sur les <b>blocs fantômes</b> bleus : la dynamo doit <b>toucher</b> la chaudière',
    say: [
      'D\'abord, le courant. Toutes les machines de l\'usine marchent à l\'électricité.',
      'La chaudière brûle du charbon et fait de la vapeur ; la dynamo qui la touche la transforme en électricité : 40 watts par chaudière.',
      'Les blocs fantômes bleus te montrent où les poser, à côté de la ligne au sol. Prends la chaudière en main et vise son fantôme, puis la dynamo.',
    ],
    ghosts: [[6, 2, BOILER, 'Chaudière'], [6, 1, DYNAMO, 'Dynamo']],
    check: (t) => t.fac.plant,
  },
  {
    id: 'crush', part: 2, goal: 'Concasse du minerai de fer', hint: 'Concasseur sur son fantôme, <b>charbon</b> dans la chaudière (case du bas), <b>minerai</b> dans le concasseur (case du haut)',
    say: [
      'Maintenant, une machine : le concasseur. Pose-le sur son fantôme, sur la ligne : il touche la dynamo, il reçoit donc le courant.',
      'Les blocs électriques qui se touchent forment un réseau. Pour relier des blocs éloignés, on pose des câbles entre eux.',
      'Clic droit sur la chaudière et mets du charbon dans sa case du bas. Elle ne brûle que quand une machine a besoin de courant : pas de gaspillage.',
      'Puis clic droit sur le concasseur, mets du minerai de fer en haut, et récupère ce qui sort à droite.',
    ],
    ghosts: [[6, 0, CRUSHER, 'Concasseur']],
    check: (t) => t.count(DUST) >= 2 || t.fac.dust || t.fac.problem || `Poussière de fer : ${t.count(DUST)} / 2`,
    then: [
      'Un minerai donne deux poussières de fer, et chaque poussière fond au four en un lingot : le double de fer !',
      'Mais remplir la machine à la main, ce n\'est pas encore de l\'automatisation. Construisons une ligne qui travaille toute seule.',
    ],
  },
  {
    id: 'belt', part: 2, goal: 'Tends un tapis jusqu\'au concasseur', hint: '2 arbres sur leurs fantômes ; tapis en main, <b>clic droit</b> sur l\'arbre <b>1</b>, puis sur l\'arbre <b>2</b>',
    say: [
      'Un tapis roulant se tend entre deux arbres de transmission, posés en ligne droite. Pose les deux arbres sur leurs fantômes.',
      'Prends le tapis en main. Clic droit sur l\'arbre 1, celui du côté du minerai, puis sur l\'arbre 2, contre le concasseur.',
      'Le sens compte : le tapis roule du premier arbre cliqué vers le second. Au bout, ce qu\'il porte entre dans la machine.',
    ],
    ghosts: [[2, 0, SHAFT, 'Arbre 1 (clic en premier)'], [5, 0, SHAFT, 'Arbre 2']],
    check: (t) => t.fac.feeds || (t.fac.belts ? 'Ce tapis ne roule pas vers le concasseur : casse une poulie, et recommence en cliquant d\'abord sur l\'arbre 1' : ''),
    then: ['Parfait. Un tapis consomme un tout petit peu de courant : il en reçoit, car il touche le concasseur.'],
  },
  {
    id: 'extract', part: 2, goal: 'Pose l\'extracteur contre le coffre de minerai', hint: 'Debout sur la ligne, <b>regarde le coffre</b> et pose l\'extracteur sur son fantôme',
    say: [
      'L\'extracteur sort les objets du coffre qui est devant lui, et les pose derrière lui : ici, sur le début du tapis.',
      'Il se tourne selon ta position : tiens-toi sur la ligne, regarde le coffre de minerai, et pose-le sur son fantôme.',
    ],
    ghosts: [[1, 0, EXTRACTOR, 'Extracteur']],
    check: (t) => t.fac.extractorOk || (t.fac.extractor ? 'L\'extracteur est mal tourné : casse-le, et repose-le en regardant le coffre de minerai' : ''),
    then: ['Regarde : le minerai sort du coffre, roule sur le tapis et entre dans le concasseur. Tout seul !'],
  },
  {
    id: 'belt2', part: 2, goal: 'Tends un tapis du concasseur au coffre de réception', hint: 'Arbre <b>1</b> contre le concasseur, arbre <b>2</b> contre le coffre ; clic droit sur le 1, puis sur le 2',
    say: [
      'Une machine pose ce qu\'elle produit sur un tapis qui la touche. Il en faut un deuxième, du concasseur jusqu\'au coffre de réception, à l\'est.',
      'Pose les deux arbres sur leurs fantômes et tends le tapis : d\'abord l\'arbre contre le concasseur, puis celui contre le coffre.',
    ],
    ghosts: [[7, 0, SHAFT, 'Arbre 1 (clic en premier)'], [10, 0, SHAFT, 'Arbre 2']],
    check: (t) => t.fac.toChest || (t.fac.belts >= 2 ? 'Ce tapis ne roule pas vers le coffre de réception : casse une poulie, et recommence en cliquant d\'abord contre le concasseur' : ''),
  },
  {
    id: 'chain', part: 2, goal: `Fais arriver ${RECEIVE} poussières dans le coffre de réception`, hint: 'Coffre de minerai → extracteur → tapis → concasseur → tapis → coffre de réception',
    say: [
      'Ta chaîne de production est complète. Il ne reste qu\'à la laisser tourner : la poussière va arriver dans le coffre de réception.',
      'Si rien ne bouge, je te dirai ce qui ne va pas, en jaune, sous l\'objectif.',
    ],
    check: (t) => (t.fac.received >= RECEIVE && t.fac.extractor) || t.fac.problem || `Poussière reçue : ${Math.min(RECEIVE, t.fac.received)} / ${RECEIVE}`,
    then: [
      'Magnifique ! Ta première usine tourne toute seule : tu n\'as plus qu\'à remplir le coffre de minerai.',
      'Pour aller plus loin : clic droit avec un objet en main sur un extracteur, un entonnoir ou un bras, et seuls ces objets passent. C\'est un filtre.',
      'Le répartiteur partage un tapis en plusieurs, l\'assembleur fabrique tout seul, la presse et la scie travaillent au-dessus des tapis, les quais chargent les trains.',
      'Toutes les recettes et toutes les machines sont dans le Wiki. Mais ta chaudière mange du charbon sans arrêt…',
      'J\'ouvre la salle des énergies, à l\'est de l\'atelier : là-bas, le courant vient de l\'eau et du vent.',
    ],
    open: ['atelier', 'energie'],
  },
  // ---------- L'énergie verte (la salle des énergies) ----------
  {
    id: 'energie', part: 4, goal: 'Rejoins la salle des énergies', hint: 'La porte à l\'est de l\'atelier',
    say: ['La salle des énergies est derrière la porte à l\'est de l\'atelier. Rejoins-la.'],
    check: (t) => t.room === 'energie',
  },
  {
    id: 'greenkit', part: 4, goal: 'Prends le matériel de la salle', hint: '<b>Clic droit</b> sur le coffre près de l\'entrée, Maj + clic pour tout prendre',
    say: [
      'Ici, pas de charbon : le courant vient de l\'eau du bassin et du vent. Gratuit, et pour toujours.',
      'Le coffre près de l\'entrée contient le matériel de deux leçons : l\'énergie verte, puis le carburant des fusées. Prends tout.',
    ],
    check: (t) => t.en.wheels > 0 || (t.count(WATER_WHEEL) >= 1 && t.count(WIND_TURBINE) >= 2 && t.count(CABLE) >= 8 && t.count(PUMP) >= 1),
  },
  {
    id: 'wheel', part: 4, goal: 'Pose la roue à aubes dans le bassin', hint: 'Vise le <b>fond du bassin</b>, à travers l\'eau, sur son fantôme',
    say: [
      'La roue à aubes tourne avec l\'eau qui la touche : 2 watts par case d\'eau dormante, 8 par case d\'eau qui coule, jusqu\'à 40 watts.',
      'Pose-la sur son fantôme, dans le bassin : vise le fond du bassin à travers l\'eau, elle se pose dedans.',
    ],
    ghostAt: 'energy',
    ghosts: [[-2, 1, WATER_WHEEL, 'Roue à aubes', -1]],
    check: (t) => t.en.wheelW > 0 || (t.en.wheels ? 'La roue à aubes doit toucher de l\'eau' : ''),
    then: ['Elle tourne ! Ici l\'eau dort : trois cases d\'eau, 6 watts. Au bord d\'une rivière ou sous une cascade, elle en donnerait bien plus.'],
  },
  {
    id: 'wind', part: 4, goal: 'Pose les 2 éoliennes', hint: 'Sur leurs fantômes, au sud du bassin',
    say: [
      'L\'éolienne prend le vent : 6 watts au niveau de la mer, et plus elle est haute, plus elle en donne. La pluie et surtout l\'orage la font tourner plus vite.',
      'Sur une planète, pose-les en haut des collines, ou sur une tour. Ici, pose les deux éoliennes sur leurs fantômes.',
    ],
    ghostAt: 'energy',
    ghosts: [[1, -2, WIND_TURBINE, 'Éolienne'], [3, -2, WIND_TURBINE, 'Éolienne']],
    check: (t) => t.en.winds >= 2 || `Éoliennes : ${t.en.winds} / 2`,
  },
  {
    id: 'cables', part: 4, goal: 'Relie la roue et les éoliennes avec des câbles', hint: 'Câbles sur les fantômes : le premier <b>sur la roue à aubes</b>, puis la ligne devant les éoliennes',
    say: [
      'Une machine ne partage son courant qu\'avec ce qu\'elle touche. Pour réunir la roue et les éoliennes en un seul réseau, il faut des câbles.',
      'Pose les câbles sur leurs fantômes : le premier sur la roue à aubes, puis la ligne qui passe devant les éoliennes.',
    ],
    ghostAt: 'energy',
    ghosts: CABLE_GHOSTS,
    check: (t) => t.en.linked || (t.ghostsLeft ? `Câbles restants : ${t.ghostsLeft}` : 'La roue et les deux éoliennes ne sont pas encore dans le même réseau'),
    then: ['Un seul réseau, trois sources : environ 20 watts, sans un gramme de charbon. Vise un câble : tu vois ce que son réseau produit et ce qu\'il consomme.'],
  },
  // ---------- Le carburant (la salle des énergies) ----------
  {
    id: 'pump', part: 5, goal: 'Pompe 1 000 mB d\'eau dans le réservoir', hint: 'La pompe dans le bassin, un <b>tuyau par-dessus</b>, les tuyaux, puis le réservoir',
    say: [
      'Passons aux liquides : c\'est avec eux qu\'on fait le carburant des fusées.',
      'La pompe à eau, posée dans l\'eau, remplit les tuyaux et les réservoirs qui la touchent. Elle demande 10 watts : elle touche la roue à aubes, elle a donc le courant.',
      'Pose la pompe dans le bassin, à côté de la roue. Puis un tuyau par-dessus, les tuyaux jusqu\'au fantôme du réservoir, et le réservoir.',
      'Les tuyaux et les réservoirs qui se touchent forment un réseau de liquide, qui ne porte qu\'un liquide à la fois. Vise le réservoir pour voir ce qu\'il contient.',
    ],
    ghostAt: 'energy',
    ghosts: [[-1, 1, PUMP, 'Pompe à eau', -1], [-1, 1, PIPE, 'Tuyau'], [0, 0, PIPE, 'Tuyau'], [1, 0, PIPE, 'Tuyau'], [2, 0, PIPE, 'Tuyau'], [3, 0, TANK, 'Réservoir d\'eau']],
    check: (t) => t.en.water >= 1000 || (t.en.water > 0 ? `Eau : ${Math.floor(t.en.water)} / 1 000 mB` : t.ghostsLeft ? `Blocs restants : ${t.ghostsLeft}` : t.en.pumpState),
  },
  {
    id: 'refine', part: 5, goal: 'Raffine 1 000 mB de carburant primaire', hint: 'Raffinerie et 2e réservoir sur leurs fantômes ; <b>clic droit</b> sur la raffinerie : 4 charbons et 2 soufres',
    say: [
      'La raffinerie fait le carburant primaire, celui des fusées : 2 charbons, 1 soufre et 1 000 mB d\'eau donnent 500 mB de carburant. Elle demande 40 watts.',
      'Pose-la contre le réservoir d\'eau : elle touche aussi le dernier câble, elle a donc le courant. Puis le deuxième réservoir, de l\'autre côté : elle y versera le carburant.',
      'Les deux réservoirs ne se touchent pas : sinon l\'eau et le carburant seraient dans le même réseau. Enfin, clic droit sur la raffinerie : 4 charbons et 2 soufres dans son coffre, pour deux fournées.',
      'Ton réseau donne 20 watts pour 50 demandés : tout marche, mais plus lentement. Plus de roues et d\'éoliennes, et ça irait plus vite.',
    ],
    ghostAt: 'energy',
    ghosts: [[4, 0, REFINERY, 'Raffinerie'], [5, 0, TANK, 'Réservoir de carburant']],
    check: (t) => t.en.fuel >= 1000 || (t.ghostsLeft ? `Blocs restants : ${t.ghostsLeft}` : t.en.refState || `Carburant : ${Math.floor(t.en.fuel)} / 1 000 mB`),
  },
  {
    id: 'canister', part: 5, goal: 'Remplis un bidon de carburant', hint: 'Bidon vide en main, <b>clic droit</b> sur le réservoir de carburant',
    say: ['Ton carburant est prêt. Pour l\'emporter, prends un bidon vide en main et fais un clic droit sur le réservoir de carburant : 1 000 mB par bidon.'],
    check: (t) => t.count(FUEL_CANISTER) >= 1,
    then: [
      'Parfait ! Avec ce bidon en main, un clic droit sur le réservoir d\'une fusée le remplit.',
      'Pour aller plus loin : le puits de pétrole, le condenseur et la chambre de réaction donnent l\'essence et le gazole, et l\'électrolyseur l\'hydrogène. Tout est dans le Wiki.',
      'Passons aux véhicules : j\'ouvre le couloir du garage. Retourne dans l\'atelier, ressors par son couloir, et prends celui d\'en face, vers le sud.',
    ],
    open: 'garage',
  },
  // ---------- Les véhicules : une voiture (le garage) ----------
  {
    id: 'garage', part: 3, goal: 'Rejoins le garage', hint: 'Par l\'atelier : ressors par son couloir, traverse, et prends celui du sud',
    say: ['Retourne dans l\'atelier et ressors par son couloir : en face, de l\'autre côté, un couloir part vers le sud. Il mène au garage.'],
    check: (t) => t.room === 'garage',
  },
  {
    id: 'carkit', part: 3, goal: 'Prends le matériel du garage', hint: '<b>Clic droit</b> sur le coffre près de l\'entrée, Maj + clic pour tout prendre',
    say: [
      'Voici le garage, et sa piste d\'essai. Ici, on construit des véhicules.',
      'Un véhicule, c\'est simplement des blocs collés ensemble, qui bougent comme un seul objet. Le coffre près de l\'entrée contient tout ce qu\'il faut. Prends tout.',
    ],
    check: (t) => !!t.car || (t.count(WHEEL) >= 4 && t.count(CAR_SEAT) >= 1 && t.count(ANALOG) >= 1 && t.count(GLUE) >= 1),
  },
  {
    id: 'carbuild', part: 3, goal: 'Construis la voiture sur les fantômes', hint: 'D\'abord les <b>4 roues</b> au sol, puis le dessus : planches et <b>volant</b>, enfin le <b>levier analogique</b> sur la planche de la roue arrière',
    say: [
      'D\'abord les roues : pose-les sur les quatre fantômes du bas. Ce sont elles qui touchent le sol.',
      'Ensuite le dessus de la voiture, posé sur les roues : des planches et le volant à l\'arrière. Puis le levier analogique, sur la planche qui couvre la roue arrière : on ne pose rien sur une roue, elle est ronde.',
      'Le volant donne l\'avant de la voiture : c\'est le côté opposé à toi quand tu le poses. Pose-le en regardant vers le bout de la piste, à l\'est.',
    ],
    ghostAt: 'car',
    ghosts: CAR_GHOSTS,
    check: (t) => !!t.car || t.ghostsDone || (t.ghostsLeft ? `Blocs restants : ${t.ghostsLeft}` : ''),
  },
  {
    id: 'carglue', part: 3, goal: 'Colle la voiture et assemble-la', hint: 'Super colle en main : <b>clic droit</b> sur chaque bloc, puis <b>Maj + clic droit</b> sur l\'un d\'eux',
    say: [
      'Pour l\'instant, ce ne sont que des blocs posés. Prends la super colle et fais un clic droit sur chacun des 12 blocs de la voiture : ils brillent quand ils sont collés.',
      'Quand tout est collé, Maj + clic droit sur l\'un d\'eux : les blocs deviennent un seul objet, qui roule.',
    ],
    check: (t) => !!t.car || (t.glued ? `Blocs collés : ${t.glued} / 12` : ''),
    then: ['Ta voiture existe ! Elle tombe, roule et se pousse comme un vrai objet.'],
  },
  {
    id: 'carlever', part: 3, goal: 'Donne du courant aux roues', hint: '<b>Clic droit</b> sur le levier analogique (Maj + clic droit : moins). Mets-le sur 3 ou 4',
    say: [
      'Les roues ne roulent toutes seules que si elles reçoivent du courant de voltite : un levier, un bloc de voltite ou un fil qui les touche, ou un levier posé sur le bloc juste au-dessus d\'elles.',
      'Ton levier analogique est sur la planche qui couvre une roue : il l\'alimente à travers elle. Chaque clic droit monte d\'un cran, et la vitesse suit le cran. Au garage, 3 ou 4 suffit largement.',
    ],
    check: (t) => (t.car?.car?.lv | 0) > 0,
    then: ['Parfait. Une seule roue alimentée suffit : toutes les roues de la voiture deviennent motrices.'],
  },
  {
    id: 'carsit', part: 3, goal: 'Assieds-toi au volant', hint: '<b>Clic droit</b> sur le volant',
    say: ['Maintenant, clic droit sur le volant pour t\'asseoir.'],
    check: (t) => t.driving,
  },
  {
    id: 'cardrive', part: 3, goal: 'Roule jusqu\'au drapeau, au bout de la piste', hint: '{k:forward} avancer, {k:back} freiner puis reculer, {k:left} {k:right} tourner, {k:jump} freiner',
    say: [
      'Avec {forward}, la voiture accélère. {back} freine, puis recule. {left} et {right} tournent les roues de devant, et {jump} freine fort.',
      'Roule jusqu\'au drapeau bleu, au bout de la piste. Doucement dans les virages !',
    ],
    ghostAt: 'car',
    ghosts: [[FLAG_DQ, 0, 'flag', 'Drapeau']],
    check: (t) => (t.driving && t.nearFlag) || (!t.driving && t.car ? 'Remonte au volant (clic droit dessus)' : ''),
    then: ['Bien conduit ! Fais demi-tour : braque à fond en roulant doucement, ou recule en braquant.'],
  },
  {
    id: 'carback', part: 3, goal: 'Reviens te garer au départ', hint: 'Arrête-toi sur le cercle du départ, à l\'ouest de la piste',
    say: ['Ramène la voiture au cercle du départ, à l\'ouest, et arrête-toi dessus.'],
    ghostAt: 'car',
    ghosts: [[0, 0, 'flag', 'Départ']],
    check: (t) => (t.driving && t.nearStart && t.slow) || (!t.driving && t.car ? 'Remonte au volant (clic droit dessus)' : ''),
    then: [
      'Garée pile au bon endroit ! Lève-toi avec Maj.',
      'Pour aller plus loin : un pilote de route conduit tout seul, d\'étape en étape. Des hélices font voler un objet, et des blocs physiques le poussent. Tout est dans le Wiki, à la page Objets physiques.',
      'Le deuxième chapitre est terminé, cadet. La navette t\'attend au hangar : j\'ouvre la porte.',
    ],
    open: 'hangar',
  },
  {
    id: 'shuttle', part: 3, goal: 'Monte dans la navette du hangar', hint: 'Le hangar est à l\'est du couloir',
    say: ['Ressors du garage, va vers l\'est jusqu\'au hangar, et monte dans la navette.'],
    check: (t) => t.inShuttle,
  },
];
const CHAPTERS = { 1: STEPS, 2: STEPS2 };
// (anciennes sauvegardes : l'étape « atelier » du chapitre 2 n'existe plus)
const RENAMED = { atelier: 'intro2' };

// Les blocs fantômes : une forme, deux matériaux (partagés : ils palpitent ensemble)
const Ghost = {
  geo: null, edges: null, fill: null, edge: null,
  init() {
    if (this.geo) return;
    this.geo = new THREE.CylinderGeometry(SIZE * 0.97, SIZE * 0.97, 0.97, 6);
    this.edges = new THREE.EdgesGeometry(this.geo);
    this.fill = new THREE.MeshBasicMaterial({ color: '#3fd6ee', transparent: true, opacity: 0.25, depthWrite: false });
    this.edge = new THREE.LineBasicMaterial({ color: '#9ff4ff', transparent: true, opacity: 0.9 });
  },
  // le nom du bloc, sur une étiquette toujours tournée vers la caméra
  label(text) {
    const cv = document.createElement('canvas'), g = cv.getContext('2d'), font = '700 30px Segoe UI, system-ui, sans-serif';
    g.font = font;
    const w = Math.ceil(g.measureText(text).width) + 28;
    cv.width = w; cv.height = 46;
    g.font = font;
    g.fillStyle = 'rgba(8, 22, 30, 0.85)';
    g.fillRect(0, 0, w, 46);
    g.fillStyle = '#3fd6ee';
    g.fillRect(0, 0, 4, 46);
    g.fillStyle = '#e8faff';
    g.textBaseline = 'middle';
    g.fillText(text, 16, 24);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
    sp.scale.set(w / 46 * 0.32, 0.32, 1);
    sp.renderOrder = 10;
    return sp;
  },
};

export class Tutorial {
  // game : { survival, player, world, containers, industry, hurt(n), visible(), onFinish(), blip(),
  // alarm(), gateSound() }
  constructor(game) {
    this.game = game;
    this.on = false;
    this.el = document.createElement('div');
    this.el.id = 'tuto';
    this.el.hidden = true;
    // (les répliques d'ORA, sous l'objectif)
    this.el.innerHTML = `<div id="tuto-col">
      <div id="tuto-quest"><div class="tq-head"></div><div class="tq-goal"></div><div class="tq-prog"></div><div class="tq-hint"></div></div>
      <div id="tuto-talk" class="off"><div class="tt-face"><span>ORA</span></div><div class="tt-text"></div></div></div>`;
    document.body.appendChild(this.el);
    this.q = {
      head: this.el.querySelector('.tq-head'), goal: this.el.querySelector('.tq-goal'),
      prog: this.el.querySelector('.tq-prog'), hint: this.el.querySelector('.tq-hint'),
      box: this.el.querySelector('#tuto-quest'),
      talk: this.el.querySelector('#tuto-talk'), text: this.el.querySelector('.tt-text'),
    };
    this.ghosts = [];
    this.ghostStep = -1;
    this.ghostT = 0;
  }

  // state : { step, id, dark, filled, filled2 } (sauvegardé avec le monde) ou rien (début)
  start(state) {
    this.on = true;
    // (l'étape d'après son nom : une sauvegarde d'avant de nouvelles étapes reprend au bon endroit)
    // (le chapitre ; une ancienne sauvegarde arrêtée dans la partie usine : le chapitre 2)
    const id = RENAMED[state?.id] || state?.id;
    this.chapter = state?.chapter === 2 || (!state?.chapter && id && !STEPS.some((s) => s.id === id) && STEPS2.some((s) => s.id === id)) ? 2 : 1;
    this.steps = CHAPTERS[this.chapter];
    const byId = id ? this.steps.findIndex((s) => s.id === id) : -1;
    this.step = byId >= 0 ? byId : Math.max(0, Math.min(this.steps.length, state?.step | 0));
    this.darkTorches = state?.dark | 0;
    this.filled = !!state?.filled;
    this.filled2 = !!state?.filled2;
    this.filled3 = !!state?.filled3;
    this.filled4 = !!state?.filled4;
    this.placed = new Set(); // (ce qui a été posé : table, four ; gardé d'une étape à l'autre)
    this.opened = new Set(); // (les écrans déjà ouverts : inventaire 2, table 3, coffre)
    this.lines = [];
    this.line = null;
    this.ate = false;
    this.done = this.step >= this.steps.length;
    this.lastLook = null;
    this.looked = 0;
    this.clock = 0;
    // portes déjà ouvertes (si la sauvegarde ne les a pas gardées)
    for (let i = 0; i < this.step; i++) if (this.steps[i].open) this.openGate(this.steps[i].open, true);
    this.el.hidden = false;
    if (!this.done) this.enter();
    else this.showGoal();
  }

  stop() {
    this.on = false;
    this.clearGhosts();
    this.el.hidden = true;
    this.lines = [];
    this.line = null;
  }

  save() {
    return { chapter: this.chapter, step: this.step, id: this.steps[this.step]?.id || null, dark: this.darkTorches, filled: this.filled, filled2: this.filled2, filled3: this.filled3, filled4: this.filled4 };
  }

  // Le jeu signale une action : 'place' (id, x, z), 'eat'
  event(type, id, x, z) {
    if (!this.on) return;
    if (type === 'place') {
      if (id === TABLE) this.placed.add('table');
      if (isFurnace(id)) this.placed.add('furnace');
      if (isTorch(id) && roomAt(x, z) === 'hall3') this.darkTorches++;
    }
    if (type === 'eat') this.ate = true;
  }

  // ---------- étapes ----------
  enter() {
    const s = this.steps[this.step];
    this.ate = false;
    this.say(s.say, this.step);
    this.showGoal();
  }

  showGoal() {
    const s = this.steps[this.step];
    this.q.box.classList.remove('pop');
    void this.q.box.offsetWidth;
    this.q.box.classList.add('pop');
    if (!s) {
      this.q.head.textContent = 'Formation terminée';
      this.q.goal.textContent = 'Tu peux explorer la station';
      this.q.hint.innerHTML = '';
      this.q.prog.textContent = '';
      return;
    }
    // (chapitre 2 : la partie usine, puis la partie véhicules, comptées chacune à part)
    const part = s.part || 1, first = this.steps.findIndex((x) => (x.part || 1) === part);
    const n = this.steps.filter((x) => (x.part || 1) === part).length;
    const title = this.chapter === 2 ? 'Chapitre 2 · ' + (PART_TITLE[part] || '') : 'Chapitre 1 · Survie';
    this.q.head.textContent = `${title} · étape ${this.step - first + 1} / ${n}`;
    this.q.goal.textContent = s.goal;
    this.q.hint.innerHTML = this.fmt(translate(s.hint || ''), true); // (traduit avant de mettre les touches)
    this.q.prog.textContent = '';
  }

  complete() {
    const s = this.steps[this.step];
    this.game.blip(true);
    if (s.open) this.openGate(s.open);
    if (s.act === 'leak') { this.game.alarm(); this.game.hurt(9); }
    // les explications de l'étape réussie ne servent plus : on les saute (le joueur a été plus
    // rapide qu'ORA), la réplique en cours finit vite
    // (de même pour les « bravo » d'avant, sauf ceux qui comptent : porte, alerte, fin)
    this.lines = this.lines.filter((l) => l.tag !== this.step && !(l.tag?.minor && l.tag.step < this.step));
    if (this.line?.tag === this.step) { this.line.shown = this.line.text.length; this.q.text.textContent = this.line.text; this.line.t = 0; this.line.hold = Math.min(this.line.hold, 0.5); }
    if (s.then) this.say(s.then, s.open || s.act ? null : { minor: true, step: this.step });
    this.step++;
    if (this.step >= this.steps.length) {
      this.done = true;
      this.showGoal();
      this.lines = [];
      this.line = null;
      this.q.talk.classList.add('off');
      this.game.onFinish();
      return;
    }
    this.enter();
  }

  openGate(name, quiet = false) {
    const w = this.game.world;
    let any = false;
    for (const [q, r, y] of [name].flat().flatMap((n) => stationGates()[n] || [])) if (w.getBlock(q, r, y) === 40) { w.setBlock(q, r, y, 0); any = true; }
    if (any) { w.changed = true; if (!quiet) this.game.gateSound(); }
  }

  // Le coffre de secours de la forge : des rations, du minerai de fer, du charbon (une fois,
  // dès que son chunk est chargé)
  fillChest() {
    const { q, r } = worldToHex(SPOTS.chest.x, SPOTS.chest.z), w = this.game.world;
    if (!w.isLoaded(q, r)) return;
    const box = this.game.containers.at(q, r, Y0 + 1);
    this.filled = true;
    if (!box) return;
    [[COOKED_PORK, 3], [IRON_ORE, 3], [COAL, 4], [STICK, 2]].forEach(([id, n], i) => { box.slots[i] = makeSlot(id, n); });
    w.changed = true;
  }

  // Les coffres de l'atelier : le matériel de la leçon (avec de quoi recommencer une erreur), et
  // le minerai au début de la ligne de production
  fillAtelier() {
    const w = this.game.world, kit = worldToHex(SPOTS.kit.x, SPOTS.kit.z), ore = worldToHex(SPOTS.ore.x, SPOTS.ore.z);
    if (!w.isLoaded(kit.q, kit.r) || !w.isLoaded(ore.q, ore.r)) return;
    this.filled2 = true;
    const fill = (at, list) => {
      const box = this.game.containers.at(at.q, at.r, Y0 + 1);
      if (box) list.forEach(([id, n], i) => { box.slots[i] = makeSlot(id, n); });
    };
    fill(kit, [[BOILER, 1], [DYNAMO, 1], [CRUSHER, 1], [COAL, 32], [IRON_ORE, 6], [SHAFT, 6], [BELT, 3], [EXTRACTOR, 1], [CABLE, 16]]);
    fill(ore, [[IRON_ORE, 64]]);
    w.changed = true;
  }

  // Le coffre du garage : de quoi construire la voiture (et quelques blocs en plus)
  fillGarage() {
    const w = this.game.world, at = worldToHex(SPOTS.garageKit.x, SPOTS.garageKit.z);
    if (!w.isLoaded(at.q, at.r)) return;
    this.filled3 = true;
    const box = this.game.containers.at(at.q, at.r, Y0 + 1);
    if (box) [[WHEEL, 6], [PLANKS, 12], [CAR_SEAT, 1], [ANALOG, 1], [GLUE, 1]].forEach(([id, n], i) => { box.slots[i] = makeSlot(id, n); });
    w.changed = true;
  }

  // Le coffre de la salle des énergies : l'énergie verte et le carburant (avec de quoi recommencer)
  fillEnergie() {
    const w = this.game.world, at = worldToHex(SPOTS.energyKit.x, SPOTS.energyKit.z);
    if (!w.isLoaded(at.q, at.r)) return;
    this.filled4 = true;
    const box = this.game.containers.at(at.q, at.r, Y0 + 1);
    if (box) ENERGY_KIT.forEach(([id, n], i) => { box.slots[i] = makeSlot(id, n); });
    w.changed = true;
  }

  // Où en est la salle des énergies : roues à aubes (et ce qu'elles produisent), éoliennes, un seul
  // réseau pour la roue et les éoliennes, l'eau et le carburant des réservoirs, et ce qui bloque la
  // pompe et la raffinerie (le texte à montrer)
  energy() {
    const ind = this.game.industry, C = this.game.containers;
    const e = { wheels: 0, wheelW: 0, winds: 0, linked: false, water: 0, fuel: 0, pumpState: '', refState: '' };
    if (!ind) return e;
    let wheelNet = null;
    const windNets = [];
    for (const [k, id] of ind.nodes) {
      const [q, r, y] = k.split(',').map(Number), net = ind.netOf.get(k);
      if (id === WATER_WHEEL) {
        e.wheels++;
        const w = ind.genPower(q, r, y, id);
        e.wheelW += w;
        if (w > 0) wheelNet = net;
      } else if (id === WIND_TURBINE) {
        e.winds++;
        windNets.push(net);
      } else if (id === PUMP) {
        e.pumpState = !net?.gens.length ? 'La pompe n\'a pas de courant : elle doit toucher la roue à aubes' : 'La pompe doit être dans l\'eau, et toucher un tuyau relié au réservoir';
      } else if (id === REFINERY) {
        const st = C.map.get(k)?.state;
        e.refState = !net?.gens.length ? 'La raffinerie n\'a pas de courant : elle doit toucher un câble du réseau'
          : st === 'water' ? 'La raffinerie attend 1 000 mB d\'eau : le réservoir d\'eau doit la toucher'
            : st === 'out' ? 'Il faut un 2e réservoir contre la raffinerie, qui ne touche pas celui d\'eau'
              : st === 'items' ? 'Clic droit sur la raffinerie : 2 charbons et 1 soufre dans son coffre' : '';
      }
    }
    e.linked = !!wheelNet && windNets.length >= 2 && windNets.every((n) => n === wheelNet);
    for (const n of ind.fnets || []) {
      if (n.f === 'water') e.water = Math.max(e.water, n.n);
      if (n.f === 'fuel') e.fuel = Math.max(e.fuel, n.n);
    }
    return e;
  }

  // Une pièce de la voiture perdue (cassée, tombée, jetée) avant que la voiture soit collée : le
  // coffre du garage en redonne, sinon le joueur restait bloqué. (ce qui manque : le kit, moins ce
  // qu'on a sur soi, dans le coffre et déjà posé sur les fantômes)
  refillGarage(count) {
    const w = this.game.world, at = worldToHex(SPOTS.garageKit.x, SPOTS.garageKit.z);
    const box = w.isLoaded(at.q, at.r) && this.game.containers.at(at.q, at.r, Y0 + 1);
    if (!box) return;
    let added = false;
    for (const [id, need] of [[WHEEL, 4], [PLANKS, 6], [CAR_SEAT, 1], [ANALOG, 1], [GLUE, 1]]) {
      let have = count(id);
      for (const x of box.slots) if (x?.id === id) have += x.n;
      for (const g of this.ghosts) if (g.id === id && g.ok) have++;
      if (have >= need) continue;
      const i = box.slots.findIndex((x) => !x);
      if (i < 0) break;
      box.slots[i] = makeSlot(id, need - have);
      added = true;
    }
    if (added) {
      w.changed = true;
      this.say(["Il te manquait une pièce de la voiture : j'en ai remis dans le coffre du garage."]);
    }
  }

  // La voiture du joueur : l'objet collé qui a au moins 4 roues et un volant (le plus proche du départ)
  findCar() {
    const list = this.game.structs?.list || [], c = SPOTS.car;
    let best = null, bd = Infinity;
    for (const s of list) {
      if (!s.car || s.car.wheels < 4 || s.car.seat === null) continue;
      const d = Math.hypot(s.pos.x - c.x, s.pos.z - c.z);
      if (d < bd) { bd = d; best = s; }
    }
    return best;
  }

  // Où en est l'usine du joueur : une centrale (dynamo contre une chaudière), une poussière de
  // fer sortie d'un concasseur, des tapis (l'un roule vers un concasseur, l'autre vers le coffre
  // de réception), un extracteur (tourné vers un coffre), ce qu'a reçu le coffre de réception, et
  // ce qui empêche l'usine de tourner (problem : le texte à montrer, ou null)
  factory() {
    const ind = this.game.industry, w = this.game.world, C = this.game.containers;
    const f = { plant: false, dust: false, belts: 0, feeds: false, toChest: false, extractor: false, extractorOk: false, received: 0, problem: null };
    if (!ind) return f;
    const powered = (k) => ind.netOf.get(k)?.gens.length > 0;
    let crusher = null, extractor = null, fuel = false, lit = false, unpowered = false;
    for (const [k, id] of ind.nodes) {
      const [q, r, y] = k.split(',').map(Number);
      if (id === DYNAMO && !f.plant) {
        for (const [dq, dr] of [...NEIGHBORS, [0, 0]]) for (const dy of dq || dr ? [0] : [-1, 1]) {
          const n = w.getBlock(q + dq, r + dr, y + dy);
          if (n === BOILER || n === BOILER_ON) f.plant = true;
        }
      }
      if (id === BOILER_ON) lit = true;
      if ((id === BOILER || id === BOILER_ON) && C.at(q, r, y)?.fuel) fuel = true;
      if (id === CRUSHER) {
        crusher ||= k;
        if (C.at(q, r, y)?.output?.id === DUST) f.dust = true;
      }
      if (BLOCKS[id]?.base === EXTRACTOR) {
        f.extractor = true;
        extractor ||= k;
        const [fq, fr] = NEIGHBORS[(BLOCKS[id].facing + 3) % 6];
        if (BLOCKS[w.getBlock(q + fq, r + fr, y)]?.container === 'chest') { f.extractorOk = true; extractor = k; }
      }
    }
    const rec = worldToHex(SPOTS.reception.x, SPOTS.reception.z);
    for (const B of ind.belts.values()) {
      f.belts++;
      if (!powered(B.key)) unpowered = true;
      const [q, r, y] = B.cells[ind.outIndex(B)].split(',').map(Number), [dq, dr] = NEIGHBORS[ind.outSide(B)];
      if (w.getBlock(q + dq, r + dr, y) === CRUSHER) f.feeds = true;
      if (q + dq === rec.q && r + dr === rec.r && y === Y0 + 1) f.toChest = true;
    }
    for (const sl of C.at(rec.q, rec.r, Y0 + 1)?.slots || []) if (sl?.id === DUST) f.received += sl.n;
    if (!f.plant) f.problem = 'Il manque la centrale : une dynamo collée contre une chaudière';
    else if (crusher && !fuel && !lit) f.problem = 'La chaudière n\'a pas de charbon : clic droit dessus, et charbon dans la case du bas';
    else if (crusher && !powered(crusher)) f.problem = 'Le concasseur n\'a pas de courant : il doit toucher la dynamo, ou un câble relié à elle';
    else if (extractor && !powered(extractor)) f.problem = 'L\'extracteur n\'a pas de courant : il doit toucher le tapis, ou un câble relié à la dynamo';
    else if (unpowered) f.problem = 'Un tapis n\'a pas de courant : il doit toucher une machine, ou un câble relié à la dynamo';
    return f;
  }

  // (la ligne de production ne manque jamais de minerai : le coffre se remplit quand il est vide)
  refillOre() {
    const at = worldToHex(SPOTS.ore.x, SPOTS.ore.z), box = this.game.containers.at(at.q, at.r, Y0 + 1);
    if (!box || box.slots.some((x) => x?.id === IRON_ORE)) return;
    const i = box.slots.findIndex((x) => !x);
    if (i >= 0) { box.slots[i] = makeSlot(IRON_ORE, 32); this.game.world.changed = true; }
  }

  // ---------- blocs fantômes ----------
  // Là où poser les blocs de l'étape (ghosts) : un prisme bleu transparent qui palpite, et son nom
  // au-dessus. Il disparaît quand le bon bloc y est posé.
  showGhosts(dt) {
    const s = this.steps[this.step], list = !this.done && this.game.scene ? s?.ghosts : null;
    if (this.ghostStep !== this.step) {
      this.clearGhosts();
      this.ghostStep = this.step;
      if (list) this.makeGhosts(list);
    }
    if (!this.ghosts.length) return;
    this.ghostT += dt;
    const w = this.game.world, hidden = this.el.hidden;
    // (un étage ne se montre que quand celui du dessous est fait : les roues avant le dessus)
    let low = Infinity;
    for (const g of this.ghosts) {
      const id = w.getBlock(g.q, g.r, g.y);
      g.ok = g.id === 'flag' ? false : g.id === SHAFT ? isShaft(id) || !!BLOCKS[id]?.belt
        : g.id === EXTRACTOR ? BLOCKS[id]?.base === EXTRACTOR
          : g.id === CAR_SEAT ? isCarSeat(id)
            : g.id === ANALOG ? isAnalog(id)
              : g.id === BOILER ? id === BOILER || id === BOILER_ON : id === g.id;
      if (!g.ok && g.id !== 'flag') low = Math.min(low, g.dy);
    }
    this.ghostsLeft = 0;
    for (const g of this.ghosts) {
      if (!g.ok && g.id !== 'flag') this.ghostsLeft++;
      g.obj.visible = !g.ok && !hidden && g.dy <= low;
    }
    const k = 0.5 + 0.5 * Math.sin(this.ghostT * 4);
    Ghost.fill.opacity = 0.16 + 0.14 * k;
    Ghost.edge.opacity = 0.55 + 0.4 * k;
  }

  // (ghostAt : le point de départ des positions, SPOTS.ore par défaut ; 'flag' : un drapeau, une
  // haute colonne, à atteindre plutôt qu'un bloc à poser ; une étiquette par nom, pas plus)
  makeGhosts(list) {
    Ghost.init();
    const at = SPOTS[this.steps[this.step]?.ghostAt || 'ore'], o = worldToHex(at.x, at.z), named = new Set();
    for (const [dq, dr, id, label, dy = 0] of list) {
      const q = o.q + dq, r = o.r + dr, y = Y0 + 1 + dy, c = hexToWorld(q, r), flag = id === 'flag';
      const obj = new THREE.Group();
      obj.position.set(c.x, y + 0.5, c.z);
      const body = new THREE.Group();
      body.add(new THREE.Mesh(Ghost.geo, Ghost.fill), new THREE.LineSegments(Ghost.edges, Ghost.edge));
      if (flag) { body.scale.set(1.6, 4, 1.6); body.position.y = 1.5; }
      obj.add(body);
      let tag = null;
      if (!named.has(label)) {
        named.add(label);
        tag = Ghost.label(translate(label));
        tag.position.y = flag ? 4 : 0.95;
        obj.add(tag);
      }
      this.game.scene.add(obj);
      this.ghosts.push({ q, r, y, dy, id, obj, tag });
    }
  }

  clearGhosts() {
    for (const g of this.ghosts) {
      g.obj.removeFromParent();
      g.tag?.material.map.dispose();
      g.tag?.material.dispose();
    }
    this.ghosts = [];
    this.ghostStep = -1;
  }

  // Les touches dans les textes : {inventory} -> le nom de la touche choisie (Options > Touches),
  // {k:inventory} -> la même dans une case de touche (objectifs)
  fmt(text, html = false) {
    return String(text).replace(/\{(k:)?(\w+)\}/g, (m, kb, a) => {
      const n = this.game.keyName?.(a);
      if (!n) return m;
      return kb && html ? '<kbd>' + n.replace(/[<>&]/g, '') + '</kbd>' : n;
    });
  }

  // ---------- répliques ----------
  // tag : l'étape dont ce sont les explications (null : à dire quoi qu'il arrive)
  say(lines, tag = null) {
    if (lines) for (const text of lines) this.lines.push({ text, tag });
  }

  updateTalk(dt) {
    if (!this.line && this.lines.length) {
      let { text, tag } = this.lines.shift(), alert = false;
      text = this.fmt(translate(text));
      if (text.startsWith('!')) { alert = true; text = text.slice(1); }
      this.line = { text, tag, shown: 0, hold: 1.3 + text.length / 30, t: 0 };
      this.q.talk.classList.remove('off');
      this.q.talk.classList.toggle('alert', alert);
      this.game.blip(false);
    }
    const L = this.line;
    if (!L) {
      if (this.afterTalk) { const f = this.afterTalk; this.afterTalk = null; f(); }
      return;
    }
    L.t += dt;
    if (L.shown < L.text.length) {
      L.shown = Math.min(L.text.length, L.shown + dt * 62);
      this.q.text.textContent = L.text.slice(0, Math.floor(L.shown));
      if (L.shown >= L.text.length) L.t = 0;
      return;
    }
    // (d'autres répliques attendent : on enchaîne un peu plus vite)
    if (L.t > (this.lines.length ? L.hold * 0.75 : L.hold)) {
      this.line = null;
      if (!this.lines.length) this.q.talk.classList.add('off');
    }
  }

  // ---------- chaque image ----------
  update(dt) {
    if (!this.on) return;
    this.el.hidden = !this.game.visible();
    this.showGhosts(dt);
    if (this.el.hidden) return; // (menu pause, mort, cinématique : ORA attend)
    this.updateTalk(dt);
    if (this.done) return;
    const g = this.game, p = g.player, sv = g.survival;
    if (this.chapter === 1) { if (!this.filled) this.fillChest(); }
    else {
      if (!this.filled2) this.fillAtelier();
      else if (this.step >= this.steps.findIndex((x) => x.id === 'extract') && this.steps[this.step]?.part === 2) this.refillOre();
      if (!this.filled3) this.fillGarage();
      if (!this.filled4) this.fillEnergie();
    }
    // la souris : on additionne les mouvements du regard
    if (this.lastLook) this.looked += Math.abs(Math.atan2(Math.sin(p.yaw - this.lastLook[0]), Math.cos(p.yaw - this.lastLook[0]))) + Math.abs(p.pitch - this.lastLook[1]);
    this.lastLook = [p.yaw, p.pitch];
    if ((this.clock -= dt) > 0) return;
    this.clock = 0.15;
    const count = (id) => {
      let n = 0;
      for (const s of sv.slots) if (s?.id === id) n += s.n;
      if (sv.cursor?.id === id) n += sv.cursor.n;
      return n;
    };
    const sh = g.shuttle;
    if (sv.open) this.opened.add(sv.box ? sv.box.type : sv.gridN);
    const ctx = {
      x: p.pos.x, room: roomAt(p.pos.x, p.pos.z), looked: this.looked, count, placed: this.placed, darkTorches: this.darkTorches, ate: this.ate,
      opened: this.opened,
      fullHealth: sv.health >= 24,
      fac: this.steps[this.step]?.part === 2 ? this.factory() : null,
      en: this.steps[this.step]?.part === 4 || this.steps[this.step]?.part === 5 ? this.energy() : null,
      ghostsLeft: this.ghostsLeft | 0,
      inShuttle: Math.hypot(p.pos.x - sh.x, p.pos.z - sh.z) < 1.3 && p.pos.y < sh.y + 3,
    };
    // la voiture (partie véhicules) : assemblée ? au volant ? près du drapeau, du départ ?
    if (this.steps[this.step]?.part === 3) {
      const car = this.findCar(), P = g.pilot?.(), st = SPOTS.car;
      const d = (x, z) => (car ? Math.hypot(car.pos.x - x, car.pos.z - z) : Infinity);
      Object.assign(ctx, {
        car, glued: g.structs?.glued.size | 0,
        ghostsDone: this.ghosts.length > 0 && !this.ghostsLeft, ghostsLeft: this.ghostsLeft | 0,
        driving: !!(car && P?.car && P.s === car),
        nearFlag: d(st.x + FLAG_DQ, st.z) < 3.5,
        nearStart: d(st.x, st.z) < 2.5,
        slow: !!car && Math.abs(car.car.v) < 1.5,
      });
      // (toutes les 2 s, avant que la voiture soit collée)
      if (!car && this.filled3 && (this.steps[this.step].id === 'carbuild' || this.steps[this.step].id === 'carkit') && (this.refillT = (this.refillT || 0) + 0.15) >= 2) {
        this.refillT = 0;
        this.refillGarage(count);
      }
    }
    const s = this.steps[this.step];
    // (étape « wait » : pas avant qu'ORA ait commencé sa dernière réplique ; les autres se
    // valident dès que c'est fait, même pendant les explications)
    if (s.wait && this.lines.some((l) => l.tag === this.step)) return;
    const r = s.check(ctx);
    if (r === true) this.complete();
    else this.q.prog.textContent = typeof r === 'string' ? r : '';
  }
}
