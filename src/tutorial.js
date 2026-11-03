// Le tutoriel : la station Hexa-Zéro (voir station.js). ORA, l'intelligence de la station,
// guide le joueur leçon par leçon (regarder, marcher, sauter, récolter, fabriquer, miner,
// s'éclairer, se soigner, cuire du fer…), puis, dans l'atelier, la deuxième partie : l'usine
// (le courant, une machine, les tapis, une chaîne de production automatique). Chaque étape a
// un objectif (en haut à droite) et des répliques (en haut de l'écran) ; l'étape est vérifiée
// en continu (inventaire, position, usine, actions signalées par le jeu avec event()). Des
// portes vitrées s'ouvrent au fil des leçons.
import * as THREE from 'three';
import {
  BLOCKS, isShaft, STICK, COAL, IRON_INGOT, COOKED_PORK, WOODEN_PICKAXE, PEBBLE, RUSTIC_PICKAXE, makeSlot,
  BOILER, BOILER_ON, DYNAMO, CABLE, CRUSHER, SHAFT, BELT, EXTRACTOR,
} from './blocks.js?v=1.1.5-alpha-mw17vbxj';
import { roomAt, stationGates, SPOTS, Y0 } from './station.js?v=1.1.5-alpha-mw17vbxj';
import { worldToHex, hexToWorld, NEIGHBORS, SIZE } from './hex.js?v=1.1.5-alpha-mw17vbxj';
import { translate } from './i18n.js?v=1.1.5-alpha-mw17vbxj';

const LOG = 5, PLANKS = 18, TABLE = 31, COBBLE = 28, TORCH = 23, IRON_ORE = 60, DUST = 3850;
const RECEIVE = 6; // (poussières de fer à faire arriver dans le coffre de réception)
const isFurnace = (id) => BLOCKS[id]?.container === 'furnace';
const isTorch = (id) => id === TORCH || BLOCKS[id]?.pick === TORCH;


// Étapes : goal (objectif), hint (comment faire), say (répliques au début), check (fait ?
// ou texte de progression), then (répliques une fois faite), open (porte qui s'ouvre), act
// (action du jeu une fois faite)
const STEPS = [
  {
    id: 'look', goal: 'Regarde autour de toi', hint: 'Bouge la souris',
    say: [
      'Bonjour, cadet. Ici ORA, l\'intelligence de la station Hexa-Zéro.',
      'Nous dérivons dans l\'espace lointain : l\'étoile la plus proche est à plus de trois années-lumière. Ici, pas de soleil… seulement nos lampes.',
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
      'Bravo ! Avec le fer, tu pourras faire de bien meilleurs outils. La première partie de ta formation est terminée.',
      'Mais sur une planète, tu ne pourras pas tout faire à la main. Deuxième partie : l\'usine. J\'ouvre le couloir de l\'atelier, au nord, juste avant le hangar.',
    ],
    open: 'atelier',
  },
  // ---------- Deuxième partie : l'usine (l'atelier, voir station.js) ----------
  {
    id: 'atelier', part: 2, goal: 'Rejoins l\'atelier', hint: 'Le couloir au nord, juste avant le hangar',
    say: ['Prends le couloir qui part vers le nord, entre la forge et le hangar : il mène à l\'atelier.'],
    check: (t) => t.room === 'atelier',
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
      'Toutes les recettes et toutes les machines sont dans le Wiki. Ta formation est finie, cadet : la navette t\'attend au hangar.',
    ],
    open: 'hangar',
  },
  {
    id: 'shuttle', part: 2, goal: 'Monte dans la navette du hangar', hint: 'Entre par la porte, à l\'arrière',
    say: ['Traverse le hangar et monte dans la navette.'],
    check: (t) => t.inShuttle,
    // (la suite : la navette part, voir departure.js ; ORA parle dans la cinématique)
  },
];
// (le début de la deuxième partie, et le nombre d'étapes de chaque partie)
const PART2 = STEPS.findIndex((s) => s.part === 2);
const EXTRACT = STEPS.findIndex((s) => s.id === 'extract');

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
    const byId = state?.id ? STEPS.findIndex((s) => s.id === state.id) : -1;
    this.step = byId >= 0 ? byId : Math.max(0, Math.min(STEPS.length, state?.step | 0));
    this.darkTorches = state?.dark | 0;
    this.filled = !!state?.filled;
    this.filled2 = !!state?.filled2;
    this.placed = new Set(); // (ce qui a été posé : table, four ; gardé d'une étape à l'autre)
    this.opened = new Set(); // (les écrans déjà ouverts : inventaire 2, table 3, coffre)
    this.lines = [];
    this.line = null;
    this.ate = false;
    this.done = this.step >= STEPS.length;
    this.lastLook = null;
    this.looked = 0;
    this.clock = 0;
    // portes déjà ouvertes (si la sauvegarde ne les a pas gardées)
    for (let i = 0; i < this.step; i++) if (STEPS[i].open) this.openGate(STEPS[i].open, true);
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
    return { step: this.step, id: STEPS[this.step]?.id || null, dark: this.darkTorches, filled: this.filled, filled2: this.filled2 };
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
    const s = STEPS[this.step];
    this.ate = false;
    this.say(s.say, this.step);
    this.showGoal();
  }

  showGoal() {
    const s = STEPS[this.step];
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
    this.q.head.textContent = s.part === 2
      ? `L'usine · étape ${this.step - PART2 + 1} / ${STEPS.length - PART2}`
      : `Formation · étape ${this.step + 1} / ${PART2}`;
    this.q.goal.textContent = s.goal;
    this.q.hint.innerHTML = this.fmt(translate(s.hint || ''), true); // (traduit avant de mettre les touches)
    this.q.prog.textContent = '';
  }

  complete() {
    const s = STEPS[this.step];
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
    if (this.step >= STEPS.length) {
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
    for (const [q, r, y] of stationGates()[name] || []) if (w.getBlock(q, r, y) === 40) { w.setBlock(q, r, y, 0); any = true; }
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
    const s = STEPS[this.step], list = !this.done && this.game.scene ? s?.ghosts : null;
    if (this.ghostStep !== this.step) {
      this.clearGhosts();
      this.ghostStep = this.step;
      if (list) this.makeGhosts(list);
    }
    if (!this.ghosts.length) return;
    this.ghostT += dt;
    const w = this.game.world, hidden = this.el.hidden;
    for (const g of this.ghosts) {
      const id = w.getBlock(g.q, g.r, g.y);
      const ok = g.id === SHAFT ? isShaft(id) || !!BLOCKS[id]?.belt
        : g.id === EXTRACTOR ? BLOCKS[id]?.base === EXTRACTOR
          : g.id === BOILER ? id === BOILER || id === BOILER_ON : id === g.id;
      g.obj.visible = !ok && !hidden;
    }
    const k = 0.5 + 0.5 * Math.sin(this.ghostT * 4);
    Ghost.fill.opacity = 0.16 + 0.14 * k;
    Ghost.edge.opacity = 0.55 + 0.4 * k;
  }

  makeGhosts(list) {
    Ghost.init();
    const o = worldToHex(SPOTS.ore.x, SPOTS.ore.z);
    for (const [dq, dr, id, label] of list) {
      const q = o.q + dq, r = o.r + dr, y = Y0 + 1, c = hexToWorld(q, r);
      const obj = new THREE.Group();
      obj.position.set(c.x, y + 0.5, c.z);
      obj.add(new THREE.Mesh(Ghost.geo, Ghost.fill), new THREE.LineSegments(Ghost.edges, Ghost.edge));
      const tag = Ghost.label(translate(label));
      tag.position.y = 0.95;
      obj.add(tag);
      this.game.scene.add(obj);
      this.ghosts.push({ q, r, y, id, obj, tag });
    }
  }

  clearGhosts() {
    for (const g of this.ghosts) {
      g.obj.removeFromParent();
      g.tag.material.map.dispose();
      g.tag.material.dispose();
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
    if (!this.filled) this.fillChest();
    if (!this.filled2) this.fillAtelier();
    else if (this.step >= EXTRACT && !this.done) this.refillOre();
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
      fac: STEPS[this.step]?.part === 2 ? this.factory() : null,
      inShuttle: Math.hypot(p.pos.x - sh.x, p.pos.z - sh.z) < 1.3 && p.pos.y < sh.y + 3,
    };
    const s = STEPS[this.step];
    // (étape « wait » : pas avant qu'ORA ait commencé sa dernière réplique ; les autres se
    // valident dès que c'est fait, même pendant les explications)
    if (s.wait && this.lines.some((l) => l.tag === this.step)) return;
    const r = s.check(ctx);
    if (r === true) this.complete();
    else this.q.prog.textContent = typeof r === 'string' ? r : '';
  }
}
